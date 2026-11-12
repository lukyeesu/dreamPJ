const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const esbuild = require('esbuild');
const { JSDOM } = require('jsdom');

// 1. Setup isolated JSDOM environment
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

// 2. In-memory JSX component loader via async esbuild with service interception for 100% offline isolation
async function loadInventoryComponent(entryRelativePath) {
  const absPath = path.resolve(__dirname, entryRelativePath);

  const mockServicePlugin = {
    name: 'mock-services',
    setup(build) {
      build.onResolve({ filter: /(warehouseService|productionService|supabaseClient)/ }, (args) => ({
        path: args.path,
        namespace: 'mock-ws'
      }));
      build.onLoad({ filter: /.*/, namespace: 'mock-ws' }, () => ({
        contents: `
          export function generateIdempotencyKey() {
            return 'mock-idempotency-key-' + Math.random().toString(36).substring(2, 9);
          }
          export const dispatchWarehouseCommand = async () => ({ success: true });
          export const listWarehousePeople = async () => ({ people: [{ key:'recipient:11111111-1111-4111-8111-111111111111', recipient_id:'11111111-1111-4111-8111-111111111111', name:'Field lead', kind:'casual_helper' }], has_more: false });
          export const resolveWarehousePerson = async ({ personKey }) => ({ recipient_id: personKey, name: 'Resolved Person' });
          export const createProductionIssue = async () => ({ success: true, data: { issue: { id: 'doc-1' }, assignment: { id: 'asgn-1' } } });
          export const loadProductionProject = async () => ({ project: { id: 'P-0001' }, assignments: [], summary: {}, permissions: { can_check: true } });
          export const getActiveClient = () => null;
        `,
        loader: 'js'
      }));
    }
  };

  const result = await esbuild.build({
    entryPoints: [absPath],
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'node',
    jsx: 'automatic',
    plugins: [mockServicePlugin],
    define: {
      'import.meta.env': '{}',
      'import.meta.env.VITE_SUPABASE_URL': '""',
      'import.meta.env.VITE_SUPABASE_ANON_KEY': '""'
    },
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

test('Plan C — Inventory Components Real DOM Regression Suite', async (t) => {
  const StockTable = await loadInventoryComponent('../src/components/inventory/StockTable.jsx');
  const IssueCartDrawer = await loadInventoryComponent('../src/components/inventory/IssueCartDrawer.jsx');
  // Test Fixtures
  const mockCategories = [
    { id: 'cat-flowers', name: 'ดอกไม้พลาสติก', type: 'reusable' },
    { id: 'cat-scissors', name: 'กรรไกร', type: 'asset' }
  ];

  const mockItems = [
    {
      id: 'item-flower-white',
      name: 'ทิวลิปพลาสติก',
      code: 'FL-W-01',
      item_type: 'reusable',
      category_id: 'cat-flowers',
      color: 'ขาว',
      size: 'M',
      storage_location: 'โซน A',
      status: 'in_service',
      quantity_on_hand: 200,
      current_stock: 200
    },
    {
      id: 'item-flower-pink',
      name: 'ทิวลิปพลาสติก',
      code: 'FL-P-02',
      item_type: 'reusable',
      category_id: 'cat-flowers',
      color: 'ชมพู',
      size: 'L',
      storage_location: 'โซน A',
      status: 'in_service',
      quantity_on_hand: 150,
      current_stock: 150
    },
    {
      id: 'item-scissors-blue',
      name: 'กรรไกรตัดริบบิ้น',
      code: 'SC-BL',
      item_type: 'asset',
      category_id: 'cat-scissors',
      color: 'ฟ้า',
      size: 'S',
      storage_location: 'ตู้ B',
      status: 'in_service',
      quantity_on_hand: 0,
      current_stock: 0 // Tool quantity is computed from serialized units
    },
    {
      id: 'item-banknote-test',
      name: 'ธนบัตร 100 บาท',
      code: 'CASH-100',
      item_type: 'banknote',
      category_id: 'cat-cash',
      color: '',
      size: '',
      storage_location: 'ตู้เซฟ',
      status: 'in_service'
    }
  ];

  // 2 tools with the same color ('ฟ้า') - one available, one borrowed by 'ป้านิด'
  const mockAssetUnits = [
    {
      id: 'u-001',
      unit_code: 'SC-001',
      item_id: 'item-scissors-blue',
      status: 'AVAILABLE',
      borrowed_by: null
    },
    {
      id: 'u-002',
      unit_code: 'SC-002',
      item_id: 'item-scissors-blue',
      status: 'BORROWED',
      borrowed_by: 'ป้านิด'
    }
  ];

  await t.test('1. StockTable: Category filtering (flowers vs scissors)', () => {
    const { container, unmount } = render(
      React.createElement(StockTable, {
        items: mockItems,
        categories: mockCategories,
        assetUnits: mockAssetUnits
      })
    );

    // Initial render displays all physical items (excludes banknote)
    assert.ok(container.textContent.includes('ทิวลิปพลาสติก'));
    assert.ok(container.textContent.includes('กรรไกรตัดริบบิ้น'));
    assert.equal(container.textContent.includes('ธนบัตร 100 บาท'), false, 'Banknotes must be excluded from stock table');

    // Filter by Flowers category
    const catSelect = Array.from(container.querySelectorAll('select')).find((s) =>
      Array.from(s.options).some((o) => o.text.includes('ดอกไม้พลาสติก'))
    );
    assert.ok(catSelect);

    act(() => {
      fireEvent.change(catSelect, { target: { value: 'cat-flowers' } });
    });

    assert.ok(container.textContent.includes('ทิวลิปพลาสติก'));
    assert.equal(container.textContent.includes('กรรไกรตัดริบบิ้น'), false, 'Scissors should be hidden');

    // Filter by Scissors category
    act(() => {
      fireEvent.change(catSelect, { target: { value: 'cat-scissors' } });
    });

    assert.ok(container.textContent.includes('กรรไกรตัดริบบิ้น'));
    assert.equal(container.textContent.includes('ทิวลิปพลาสติก'), false, 'Flowers should be hidden');

    unmount();
  });

  await t.test('2. StockTable: Color filtering separates same item model into distinct color balances', () => {
    const { container, unmount } = render(
      React.createElement(StockTable, {
        items: mockItems,
        categories: mockCategories,
        assetUnits: mockAssetUnits
      })
    );

    // Find color filter select
    const colorSelect = Array.from(container.querySelectorAll('select')).find((s) =>
      Array.from(s.options).some((o) => o.value === 'ชมพู')
    );
    assert.ok(colorSelect);

    // Filter by Pink
    act(() => {
      fireEvent.change(colorSelect, { target: { value: 'ชมพู' } });
    });

    // Inspect actual table tbody rows to avoid false matches on dropdown select options
    const tbody = container.querySelector('tbody');
    assert.ok(tbody);
    const tableRows = Array.from(tbody.querySelectorAll('tr'));
    const pinkRows = tableRows.filter((r) => r.textContent.includes('ชมพู'));
    const whiteRows = tableRows.filter((r) => r.textContent.includes('ขาว'));

    assert.ok(pinkRows.length > 0, 'Pink items must be displayed in table');
    assert.equal(whiteRows.length, 0, 'White items must be filtered out from table');

    // Also verify responsive mobile card list
    const mobileCards = Array.from(container.querySelectorAll('.md\\:hidden > div')).filter((el) =>
      el.textContent.includes('ทิวลิปพลาสติก')
    );
    assert.ok(mobileCards.every((c) => c.textContent.includes('ชมพู') && !c.textContent.includes('ขาว')));

    // Filter by White
    act(() => {
      fireEvent.change(colorSelect, { target: { value: 'ขาว' } });
    });

    const tableRowsWhite = Array.from(tbody.querySelectorAll('tr'));
    const pinkRowsAfter = tableRowsWhite.filter((r) => r.textContent.includes('ชมพู'));
    const whiteRowsAfter = tableRowsWhite.filter((r) => r.textContent.includes('ขาว'));

    assert.ok(whiteRowsAfter.length > 0, 'White items must be displayed in table');
    assert.equal(pinkRowsAfter.length, 0, 'Pink items must be filtered out from table');

    unmount();
  });

  await t.test('3. StockTable: Accurate tool availability computed from serialized units, not parent stock', () => {
    const { container, unmount } = render(
      React.createElement(StockTable, {
        items: mockItems,
        categories: mockCategories,
        assetUnits: mockAssetUnits
      })
    );

    // Scissors has 2 serialized units: 1 AVAILABLE (SC-001), 1 BORROWED (SC-002 by ป้านิด)
    // Parent stock quantity_on_hand is 0, but computed availability must be 1 from units
    const tbody = container.querySelector('tbody');
    assert.ok(tbody);

    // The tool item row in the table
    const toolRow = Array.from(tbody.querySelectorAll('tr')).find((r) =>
      r.textContent.includes('กรรไกรตัดริบบิ้น')
    );
    assert.ok(toolRow, 'Scissors row must be rendered in table');
    assert.ok(toolRow.textContent.includes('กำลังยืมอยู่ 1'), 'Must display 1 borrowed unit');
    assert.ok(toolRow.textContent.includes('รหัสรายชิ้นทั้งหมด 2 ชิ้น'), 'Must display 2 total units');

    // Expand the unit identities sub-row
    const expandBtn = toolRow.querySelector('button[title="แสดงรหัสรายชิ้นทั้งหมด"]');
    assert.ok(expandBtn, 'Expand button must exist for tool item');

    act(() => {
      fireEvent.click(expandBtn);
    });

    // Sub-row reveals individual unit codes, status badges, and holder names
    assert.ok(container.textContent.includes('SC-001'), 'SC-001 must be revealed upon expand');
    assert.ok(container.textContent.includes('SC-002'), 'SC-002 must be revealed upon expand');
    assert.ok(container.textContent.includes('พร้อมใช้ในคลัง'), 'SC-001 status should show available in warehouse');
    assert.ok(container.textContent.includes('ป้านิด'), 'SC-002 holder name must be shown');

    unmount();
  });

  await t.test('4. StockTable: Search query matches unit codes (SC-001) and reset clears filters', () => {
    const { container, unmount } = render(
      React.createElement(StockTable, {
        items: mockItems,
        categories: mockCategories,
        assetUnits: mockAssetUnits
      })
    );

    const searchInput = container.querySelector('input[type="text"]');
    assert.ok(searchInput);

    // Search by unit code
    act(() => {
      fireEvent.change(searchInput, { target: { value: 'SC-001' } });
    });

    assert.ok(container.textContent.includes('กรรไกรตัดริบบิ้น'));
    assert.equal(container.textContent.includes('ทิวลิปพลาสติก'), false);

    // Reset filters
    const resetBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent.includes('ล้างตัวกรอง')
    );
    if (resetBtn) {
      act(() => {
        fireEvent.click(resetBtn);
      });
      assert.ok(container.textContent.includes('ทิวลิปพลาสติก'));
      assert.ok(container.textContent.includes('กรรไกรตัดริบบิ้น'));
    }

    unmount();
  });

  await t.test('5. StockTable: Recovery prompt banner renders when pending recovered materials exist', () => {
    let navigated = false;
    const { container, unmount } = render(
      React.createElement(StockTable, {
        items: mockItems,
        categories: mockCategories,
        assetUnits: mockAssetUnits,
        pendingRecoveryCount: 90,
        onNavigateToRecovery: () => {
          navigated = true;
        }
      })
    );

    assert.ok(container.textContent.includes('มีวัสดุเก็บกลับ 90 ชิ้น'));
    assert.ok(container.textContent.includes('รอคัดแยก ยังไม่รวมเข้าสต็อกพร้อมใช้'));

    const inspectBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent.includes('ตรวจรับ')
    );
    assert.ok(inspectBtn);

    act(() => {
      fireEvent.click(inspectBtn);
    });

    assert.equal(navigated, true);

    unmount();
  });

  await t.test('6. IssueCartDrawer: Mode switching between Production and Field Round', () => {
    const { container, unmount } = render(
      React.createElement(IssueCartDrawer, {
        isOpen: true,
        cartItems: [
          {
            id: 'item-flower-white',
            name: 'ทิวลิปพลาสติก',
            color: 'ขาว',
            quantity: 50,
            item_type: 'reusable'
          }
        ],
        activities: [],
        recipients: []
      })
    );

    // Initial mode is production
    assert.ok(container.textContent.includes('เบิกผลิตงาน'));

    // Switch to Field Round mode
    const fieldModeBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent.includes('ออกหน้างาน')
    );
    assert.ok(fieldModeBtn);

    act(() => {
      fireEvent.click(fieldModeBtn);
    });

    assert.ok(container.textContent.includes('ชุดสำรองออกหน้างาน'));
    assert.ok(container.textContent.includes('รหัสรอบออกงาน'));

    unmount();
  });

  await t.test('7. IssueCartDrawer: Casual helper selection (no system account required)', () => {
    const mockRecipients = [
      { id: 'rec-staff-1', name: 'คุณสมศักดิ์', recipient_type: 'staff', is_active: true },
      { id: 'rec-helper-1', name: 'ป้านิด (คนช่วยงาน)', recipient_type: 'casual_helper', is_active: true }
    ];

    const { container, unmount } = render(
      React.createElement(IssueCartDrawer, {
        isOpen: true,
        cartItems: [{ id: 'item-flower-white', name: 'ทิวลิป', quantity: 10, item_type: 'reusable' }],
        recipients: mockRecipients
      })
    );

    // Switch to casual helper tab (labeled 'ผู้ช่วยภายนอก' in UI)
    const helperTabBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent.includes('ผู้ช่วยภายนอก') || b.textContent.includes('ผู้ช่วย')
    );
    assert.ok(helperTabBtn, 'Casual helper tab button must exist');

    act(() => {
      fireEvent.click(helperTabBtn);
    });

    // Recipient select should include casual helper
    assert.ok(container.textContent.includes('ป้านิด (คนช่วยงาน)'), 'Casual helper must be listed without requiring account');

    unmount();
  });

  await t.test('8. IssueCartDrawer: Field Round across 15 job stops issues tool once (not 15 times)', async () => {
    // 15 job stops
    const mockActivities = Array.from({ length: 15 }, (_, i) => ({
      id: `job-${i + 1}`,
      name: `จุดติดตั้งที่ ${i + 1}`,
      title: `จุดติดตั้งที่ ${i + 1}`,
      customer_name: `ลูกค้า ${i + 1}`
    }));

    let submittedPayload = null;
    const { container, unmount } = render(
      React.createElement(IssueCartDrawer, {
        isOpen: true,
        cartItems: [
          {
            id: 'item-scissors-blue',
            name: 'กรรไกรตัดริบบิ้น',
            item_type: 'asset',
            quantity: 1,
            selectedUnits: ['SC-001']
          }
        ],
        activities: mockActivities,
        onSubmitIssue: (payload) => {
          submittedPayload = payload;
        }
      })
    );

    // Switch to Field Round
    const fieldModeBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent.includes('ออกหน้างาน') || b.textContent.includes('ชุดสำรอง')
    );
    assert.ok(fieldModeBtn, 'Field round mode button must exist');
    act(() => {
      fireEvent.click(fieldModeBtn);
    });

    // A field lead must be chosen from the canonical registry, never typed as an unlinked name.
    const leadPicker = container.querySelector('button[aria-haspopup="listbox"]');
    assert.ok(leadPicker, 'Field lead registry picker must exist');
    await act(async () => { fireEvent.click(leadPicker); await new Promise(resolve => setTimeout(resolve, 80)); });
    const leadOption = container.querySelector('button[role="option"]');
    assert.ok(leadOption, 'Canonical field lead option must exist');
    await act(async () => { fireEvent.click(leadOption); });

    // Select project stops by checking checkboxes
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    assert.ok(checkboxes.length > 0, 'Project checkboxes should be rendered');
    act(() => {
      checkboxes.forEach((cb) => fireEvent.click(cb));
    });

    // Submit form (button shows 'ยืนยันเปิดรอบ...')
    const submitBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent.includes('ยืนยันเปิดรอบ') || b.textContent.includes('ยืนยัน')
    );
    assert.ok(submitBtn, 'Submit button must exist');
    assert.equal(submitBtn.disabled, false, 'Submit button must be enabled when valid');

    act(() => {
      fireEvent.click(submitBtn);
    });

    assert.ok(submittedPayload, 'Payload must be submitted');
    assert.equal(submittedPayload.issueMode, 'field_round');
    // Tool unit codes array contains exactly ONE code ('SC-001')
    assert.deepEqual(submittedPayload.items[0].unitCodes, ['SC-001']);
    assert.equal(submittedPayload.items[0].quantity, 1, 'Tool quantity must be 1, not 15');

    unmount();
  });

  await t.test('9. IssueCartDrawer: Duplicate prevention and idempotency key fingerprinting', () => {
    let capturedPayloads = [];
    const mockActivities = [{ id: 'act-1', name: 'งานแต่งคุณโบว์', customer_name: 'คุณโบว์' }];
    const mockRecipients = [{ id: 'rec-1', name: 'สมศักดิ์', recipient_type: 'staff' }];

    const { container, rerender, unmount } = render(
      React.createElement(IssueCartDrawer, {
        isOpen: true,
        activities: mockActivities,
        recipients: mockRecipients,
        cartItems: [
          {
            id: 'item-flower-white',
            name: 'ทิวลิปขาว',
            item_type: 'reusable',
            quantity: 10,
            current_stock: 50
          }
        ],
        isSubmitting: false,
        onSubmitIssue: (payload) => {
          capturedPayloads.push(payload);
        }
      })
    );

    // Select project from dropdown
    const projectSelect = container.querySelector('select');
    assert.ok(projectSelect, 'Project select must exist');
    act(() => {
      fireEvent.change(projectSelect, { target: { value: 'act-1' } });
    });

    const recipientSelect = container.querySelector('select[aria-label]');
    assert.ok(recipientSelect, 'Recipient registry selector must exist');
    act(() => { fireEvent.change(recipientSelect, { target: { value: 'rec-1' } }); });

    const getSubmitBtn = () =>
      Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent.includes('ยืนยันเบิก') || b.textContent.includes('ยืนยัน')
      );

    const submitBtn = getSubmitBtn();
    assert.ok(submitBtn, 'Submit button must exist in production mode');
    assert.equal(submitBtn.disabled, false, 'Submit button should be enabled');

    // First submit
    act(() => {
      fireEvent.click(submitBtn);
    });
    assert.equal(capturedPayloads.length, 1);
    const key1 = capturedPayloads[0].idempotencyKey;
    assert.ok(key1, 'Idempotency key must be generated');

    // While submitting, submit button must be disabled
    rerender(
      React.createElement(IssueCartDrawer, {
        isOpen: true,
        activities: mockActivities,
        recipients: mockRecipients,
        cartItems: [
          {
            id: 'item-flower-white',
            name: 'ทิวลิปขาว',
            item_type: 'reusable',
            quantity: 10,
            current_stock: 50
          }
        ],
        isSubmitting: true,
        onSubmitIssue: (payload) => {
          capturedPayloads.push(payload);
        }
      })
    );

    const disabledSubmitBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent.includes('กำลังบันทึก')
    );
    assert.ok(disabledSubmitBtn, 'Disabled submit button with loading text must be present');
    assert.equal(disabledSubmitBtn.disabled, true, 'Submit button must be disabled while submitting');

    // Network retry with exact same payload reuses the same idempotency key
    rerender(
      React.createElement(IssueCartDrawer, {
        isOpen: true,
        activities: mockActivities,
        recipients: mockRecipients,
        cartItems: [
          {
            id: 'item-flower-white',
            name: 'ทิวลิปขาว',
            item_type: 'reusable',
            quantity: 10,
            current_stock: 50
          }
        ],
        isSubmitting: false,
        onSubmitIssue: (payload) => {
          capturedPayloads.push(payload);
        }
      })
    );

    const retrySubmitBtn = getSubmitBtn();
    act(() => {
      fireEvent.click(retrySubmitBtn);
    });
    assert.equal(capturedPayloads.length, 2);
    assert.equal(capturedPayloads[1].idempotencyKey, key1, 'Identical payload retry must reuse the same idempotency key');

    // Corrected payload (e.g. quantity changed to 20) generates a NEW idempotency key
    rerender(
      React.createElement(IssueCartDrawer, {
        isOpen: true,
        activities: mockActivities,
        recipients: mockRecipients,
        cartItems: [
          {
            id: 'item-flower-white',
            name: 'ทิวลิปขาว',
            item_type: 'reusable',
            quantity: 20,
            current_stock: 50
          }
        ],
        isSubmitting: false,
        onSubmitIssue: (payload) => {
          capturedPayloads.push(payload);
        }
      })
    );

    const correctedSubmitBtn = getSubmitBtn();
    act(() => {
      fireEvent.click(correctedSubmitBtn);
    });
    assert.equal(capturedPayloads.length, 3);
    assert.notEqual(
      capturedPayloads[2].idempotencyKey,
      key1,
      'Corrected payload must receive a newly generated idempotency key'
    );

    unmount();
  });
});
