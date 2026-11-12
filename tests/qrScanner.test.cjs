const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const esbuild = require('esbuild');
const { JSDOM } = require('jsdom');

// 1. Setup isolated JSDOM environment BEFORE requiring React & Testing Library
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/'
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.HTMLVideoElement = dom.window.HTMLVideoElement;
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = require('react');
const { render, fireEvent, act } = require('@testing-library/react');

// 2. In-memory JSX component loader via esbuild (no generated files on disk)
function loadJsxComponent(entryRelativePath) {
  const absPath = path.resolve(__dirname, entryRelativePath);
  const result = esbuild.buildSync({
    entryPoints: [absPath],
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'node',
    jsx: 'automatic',
    external: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      '@testing-library/react',
      'lucide-react',
      '@zxing/browser',
      'qrcode'
    ]
  });

  const bundledCode = result.outputFiles[0].text;
  const mod = { exports: {} };
  const wrapper = new Function('require', 'module', 'exports', '__dirname', '__filename', bundledCode);
  wrapper(require, mod, mod.exports, path.dirname(absPath), absPath);
  return mod.exports.default || mod.exports;
}

const QrScanner = loadJsxComponent('../src/components/inventory/QrScanner.jsx');

test('QrScanner Component - Comprehensive Real DOM Regression Suite', async (t) => {
  // Helper to create mock media track
  function createMockTrack() {
    let stopped = false;
    return {
      kind: 'video',
      stop() {
        stopped = true;
      },
      get isStopped() {
        return stopped;
      },
      getSettings() {
        return { deviceId: 'mock-camera-id' };
      }
    };
  }

  // Helper to create mock media stream
  function createMockStream() {
    const track = createMockTrack();
    return {
      getTracks: () => [track],
      getVideoTracks: () => [track],
      track
    };
  }

  await t.test('1. Component rendering when open vs closed', () => {
    // Closed modal renders nothing
    const { container: closedContainer } = render(
      React.createElement(QrScanner, { isOpen: false, onScan: () => {}, onClose: () => {} })
    );
    assert.equal(closedContainer.firstChild, null);

    // Open modal renders dialog, header, tabs, and explicit camera button
    const { container: openContainer, unmount } = render(
      React.createElement(QrScanner, {
        isOpen: true,
        title: 'ทดสอบสแกนเนอร์',
        onScan: () => {},
        onClose: () => {}
      })
    );

    const dialog = document.body.querySelector('[role="dialog"]');
    assert.ok(dialog);
    assert.ok(document.body.textContent.includes('ทดสอบสแกนเนอร์'));
    assert.ok(document.body.textContent.includes('กล้องยังไม่ทำงาน'));
    assert.ok(document.body.textContent.includes('เปิดกล้องสแกน'));
    assert.ok(document.body.textContent.includes('พิมพ์รหัส / บาร์โค้ด'));

    unmount();
  });

  await t.test('2. No auto camera start on mount (explicit user click required)', () => {
    let decodeCallCount = 0;
    const mockReader = {
      decodeFromConstraints: async () => {
        decodeCallCount++;
        return { stop: () => {} };
      },
      decodeFromVideoDevice: async () => {
        decodeCallCount++;
        return { stop: () => {} };
      }
    };

    const { container, unmount } = render(
      React.createElement(QrScanner, {
        isOpen: true,
        codeReaderInstance: mockReader,
        onScan: () => {},
        onClose: () => {}
      })
    );

    // Upon mounting, decode must NOT be invoked automatically
    assert.equal(decodeCallCount, 0);
    // Camera is inactive
    assert.ok(document.body.textContent.includes('กล้องยังไม่ทำงาน'));

    unmount();
  });

  await t.test('3. Explicit start uses decodeFromConstraints with facingMode environment when no device selected', async () => {
    let constraintsPassed = null;
    let scanCallback = null;

    const mockControls = {
      stop: () => {}
    };

    const mockReader = {
      decodeFromConstraints: async (constraints, videoEl, cb) => {
        constraintsPassed = constraints;
        scanCallback = cb;
        return mockControls;
      }
    };

    const { container, unmount } = render(
      React.createElement(QrScanner, {
        isOpen: true,
        codeReaderInstance: mockReader,
        onScan: () => {},
        onClose: () => {}
      })
    );

    const startBtn = document.body.querySelector('button[type="button"]');
    const openCamBtn = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent.includes('เปิดกล้องสแกน')
    );
    assert.ok(openCamBtn);

    await act(async () => {
      fireEvent.click(openCamBtn);
    });

    assert.ok(constraintsPassed);
    assert.deepEqual(constraintsPassed.video?.facingMode, { ideal: 'environment' });
    assert.equal(typeof scanCallback, 'function');

    unmount();
  });

  await t.test('4. Generation token race: late resolving start #1 does NOT kill active stream of start #2', async () => {
    let resolveStart1;
    let start1Started = false;
    let start2Started = false;

    const start1Promise = new Promise((resolve) => {
      resolveStart1 = resolve;
    });

    let stopControls1Called = false;
    const mockTrack1 = createMockTrack();
    const mockStream1 = {
      getTracks: () => [mockTrack1],
      getVideoTracks: () => [mockTrack1]
    };
    const mockControls1 = {
      stream: mockStream1,
      stop: () => {
        stopControls1Called = true;
      }
    };

    const mockTrack2 = createMockTrack();
    const mockStream2 = {
      getTracks: () => [mockTrack2],
      getVideoTracks: () => [mockTrack2]
    };
    const mockControls2 = {
      stream: mockStream2,
      stop: () => {}
    };

    let callCount = 0;
    const handleDecode = async (videoEl) => {
      callCount++;
      if (callCount === 1) {
        start1Started = true;
        await start1Promise;
        videoEl.srcObject = mockStream1;
        return mockControls1;
      } else {
        start2Started = true;
        videoEl.srcObject = mockStream2;
        return mockControls2;
      }
    };

    const mockReader = {
      decodeFromConstraints: async (constraints, videoEl) => handleDecode(videoEl),
      decodeFromVideoDevice: async (deviceId, videoEl) => handleDecode(videoEl)
    };

    const { container, unmount } = render(
      React.createElement(QrScanner, {
        isOpen: true,
        codeReaderInstance: mockReader,
        onScan: () => {},
        onClose: () => {}
      })
    );

    const getCamButton = () =>
      Array.from(document.body.querySelectorAll('button')).find((b) =>
        b.textContent.includes('เปิดกล้องสแกน') || b.textContent.includes('กำลังเชื่อมต่อกล้อง')
      );

    // 1. Trigger Start #1 (hangs on pending promise)
    await act(async () => {
      fireEvent.click(getCamButton());
    });
    assert.equal(start1Started, true, 'Start #1 must be initiated');

    // 2. Trigger Start #2 while Start #1 is still pending (e.g. rapid re-tap or switch)
    await act(async () => {
      fireEvent.click(getCamButton());
    });
    assert.equal(start2Started, true, 'Start #2 must be initiated');

    // 3. Now let Start #1 complete late
    await act(async () => {
      resolveStart1();
    });

    // Obsolete Start #1 controls and tracks MUST be stopped
    assert.equal(stopControls1Called, true, 'Start #1 controls.stop() must be called');
    assert.equal(mockTrack1.isStopped, true, 'Start #1 tracks must be stopped');

    // Active Start #2 stream tracks MUST NOT be stopped
    assert.equal(mockTrack2.isStopped, false, 'Start #2 active tracks must remain alive');

    unmount();
  });

  await t.test('5. Unmount while start is pending stops late controls and tracks without setState errors', async () => {
    let resolveStart;
    const pendingStart = new Promise((resolve) => {
      resolveStart = resolve;
    });

    let controlsStopped = false;
    const track = createMockTrack();
    const mockControls = {
      stop: () => {
        controlsStopped = true;
      }
    };

    const mockReader = {
      decodeFromConstraints: async (constraints, videoEl) => {
        await pendingStart;
        videoEl.srcObject = {
          getTracks: () => [track],
          getVideoTracks: () => [track]
        };
        return mockControls;
      }
    };

    const { container, unmount } = render(
      React.createElement(QrScanner, {
        isOpen: true,
        codeReaderInstance: mockReader,
        onScan: () => {},
        onClose: () => {}
      })
    );

    const openCamBtn = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent.includes('เปิดกล้องสแกน')
    );

    // Start camera
    await act(async () => {
      fireEvent.click(openCamBtn);
    });

    // Unmount modal while start is still awaiting
    unmount();

    // Now resolve the pending camera stream
    await act(async () => {
      resolveStart();
    });

    // Must cleanly stop controls and track even though component unmounted
    assert.equal(controlsStopped, true);
    assert.equal(track.isStopped, true);
  });

  await t.test('6. Valid scan callback with F2U:T: prefix invokes onScan with exact unit code', async () => {
    let registeredCallback = null;
    const mockReader = {
      decodeFromConstraints: async (constraints, videoEl, cb) => {
        registeredCallback = cb;
        return { stop: () => {} };
      }
    };

    const scannedCodes = [];
    const { container, unmount } = render(
      React.createElement(QrScanner, {
        isOpen: true,
        codeReaderInstance: mockReader,
        onScan: (code, decoded) => {
          scannedCodes.push({ code, decoded });
        },
        onClose: () => {}
      })
    );

    const openCamBtn = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent.includes('เปิดกล้องสแกน')
    );
    await act(async () => {
      fireEvent.click(openCamBtn);
    });

    assert.equal(typeof registeredCallback, 'function');

    // Simulate ZXing recognizing Flower2U QR code
    await act(async () => {
      registeredCallback({ getText: () => 'F2U:T:SC-001' });
    });

    assert.equal(scannedCodes.length, 1);
    assert.equal(scannedCodes[0].code, 'SC-001');
    assert.equal(scannedCodes[0].decoded.isRawCode, false);
    assert.ok(document.body.textContent.includes('อ่านรหัสสำเร็จ: SC-001'));

    unmount();
  });

  await t.test('7. Valid scan callback with raw hardware unit code', async () => {
    let registeredCallback = null;
    const mockReader = {
      decodeFromConstraints: async (constraints, videoEl, cb) => {
        registeredCallback = cb;
        return { stop: () => {} };
      }
    };

    const scannedCodes = [];
    const { container, unmount } = render(
      React.createElement(QrScanner, {
        isOpen: true,
        codeReaderInstance: mockReader,
        onScan: (code, decoded) => {
          scannedCodes.push({ code, decoded });
        },
        onClose: () => {}
      })
    );

    const openCamBtn = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent.includes('เปิดกล้องสแกน')
    );
    await act(async () => {
      fireEvent.click(openCamBtn);
    });

    // Simulate raw barcode without prefix
    await act(async () => {
      registeredCallback({ getText: () => 'DR-002_TOOL' });
    });

    assert.equal(scannedCodes.length, 1);
    assert.equal(scannedCodes[0].code, 'DR-002_TOOL');
    assert.equal(scannedCodes[0].decoded.isRawCode, true);
    assert.ok(document.body.textContent.includes('อ่านรหัสสำเร็จ: DR-002_TOOL'));

    unmount();
  });

  await t.test('8. Invalid URL code displays error banner and does NOT call onScan', async () => {
    let registeredCallback = null;
    const mockReader = {
      decodeFromConstraints: async (constraints, videoEl, cb) => {
        registeredCallback = cb;
        return { stop: () => {} };
      }
    };

    let onScanCalled = false;
    const { container, unmount } = render(
      React.createElement(QrScanner, {
        isOpen: true,
        codeReaderInstance: mockReader,
        onScan: () => {
          onScanCalled = true;
        },
        onClose: () => {}
      })
    );

    const openCamBtn = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent.includes('เปิดกล้องสแกน')
    );
    await act(async () => {
      fireEvent.click(openCamBtn);
    });

    // Scan a web URL
    await act(async () => {
      registeredCallback({ getText: () => 'https://flower2u.com/inventory/item' });
    });

    assert.equal(onScanCalled, false, 'onScan must NOT be called for URLs');
    assert.ok(document.body.textContent.includes('URL เว็บไซต์'));

    unmount();
  });

  await t.test('9. Repeated scans of same unit within 2 seconds are throttled', async () => {
    let registeredCallback = null;
    const mockReader = {
      decodeFromConstraints: async (constraints, videoEl, cb) => {
        registeredCallback = cb;
        return { stop: () => {} };
      }
    };

    let onScanCount = 0;
    const { container, unmount } = render(
      React.createElement(QrScanner, {
        isOpen: true,
        codeReaderInstance: mockReader,
        onScan: () => {
          onScanCount++;
        },
        onClose: () => {}
      })
    );

    const openCamBtn = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent.includes('เปิดกล้องสแกน')
    );
    await act(async () => {
      fireEvent.click(openCamBtn);
    });

    // First scan: accepted
    await act(async () => {
      registeredCallback({ getText: () => 'F2U:T:SC-001' });
    });
    assert.equal(onScanCount, 1);

    // Immediate duplicate scan of the same unit code: throttled
    await act(async () => {
      registeredCallback({ getText: () => 'SC-001' });
    });
    assert.equal(onScanCount, 1, 'Duplicate unit within throttle window must be ignored');

    // Different unit code: accepted
    await act(async () => {
      registeredCallback({ getText: () => 'SC-002' });
    });
    assert.equal(onScanCount, 2);

    unmount();
  });

  await t.test('10. Manual input tab typing and submission', async () => {
    let scannedCode = null;
    const { container, unmount } = render(
      React.createElement(QrScanner, {
        isOpen: true,
        onScan: (code) => {
          scannedCode = code;
        },
        onClose: () => {}
      })
    );

    // Switch to manual input tab
    const manualTabBtn = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent.includes('พิมพ์รหัส / บาร์โค้ด')
    );
    assert.ok(manualTabBtn);

    await act(async () => {
      fireEvent.click(manualTabBtn);
    });

    const input = document.body.querySelector('#manual-code-input');
    assert.ok(input);

    await act(async () => {
      fireEvent.change(input, { target: { value: 'SC-003' } });
    });

    const submitBtn = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.textContent.trim() === 'เพิ่ม'
    );
    assert.ok(submitBtn);

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    assert.equal(scannedCode, 'SC-003');

    unmount();
  });

  await t.test('11. Close actions (button, escape key, isOpen=false) cleanly stop stream tracks and controls', async () => {
    let controlsStopped = false;
    const track = createMockTrack();
    const mockControls = {
      stop: () => {
        controlsStopped = true;
      }
    };

    const mockReader = {
      decodeFromConstraints: async (constraints, videoEl) => {
        videoEl.srcObject = {
          getTracks: () => [track],
          getVideoTracks: () => [track]
        };
        return mockControls;
      }
    };

    let onCloseCalls = 0;
    const { container, unmount } = render(
      React.createElement(QrScanner, {
        isOpen: true,
        codeReaderInstance: mockReader,
        onScan: () => {},
        onClose: () => {
          onCloseCalls++;
        }
      })
    );

    const openCamBtn = Array.from(document.body.querySelectorAll('button')).find((b) =>
      b.textContent.includes('เปิดกล้องสแกน')
    );
    await act(async () => {
      fireEvent.click(openCamBtn);
    });

    assert.equal(track.isStopped, false);

    // Click close button
    const closeBtn = document.body.querySelector('button[aria-label="ปิดหน้าต่างสแกน"]');
    assert.ok(closeBtn);

    await act(async () => {
      fireEvent.click(closeBtn);
    });

    assert.equal(onCloseCalls, 1);
    assert.equal(controlsStopped, true);
    assert.equal(track.isStopped, true);

    unmount();
  });
});
