import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import {
  Camera,
  CameraOff,
  Keyboard,
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FlipHorizontal
} from 'lucide-react';
import { decodeQrPayload } from '../../utils/qrLabels.js';
import Toast from '../common/Toast.jsx';

/**
 * QrScanner Component
 *
 * Dedicated QR and barcode scanner modal for warehouse asset tools.
 * Integrates @zxing/browser continuous scanning with rear-camera preference,
 * camera selection, hardware barcode/manual entry fallback, throttle protection,
 * and leak-free camera stream lifecycle.
 *
 * Props:
 *   - isOpen: boolean (whether modal is displayed)
 *   - onClose: () => void (handler to close modal)
 *   - onScan: (unitCode: string, resultObj: object) => void (callback when code is recognized; does NOT auto-issue)
 *   - title: string (modal title, defaults to Thai 'สแกน QR ครุภัณฑ์')
 *   - subtitle: string (optional subtitle instructions)
 *   - codeReaderInstance: object (optional dependency injection for testing/mocking)
 */
export default function QrScanner({
  isOpen = true,
  onClose,
  onScan,
  title = 'สแกน QR / บาร์โค้ดครุภัณฑ์',
  subtitle = 'จัดกล้องให้เห็น QR หรือบาร์โค้ด Code 128 หรือพิมพ์รหัสประจำชิ้น',
  codeReaderInstance
}) {
  const [activeTab, setActiveTab] = useState('camera'); // 'camera' | 'manual'
  const [cameraActive, setCameraActive] = useState(false);
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [scanStatus, setScanStatus] = useState(null); // { type: 'success' | 'error', message: string, code?: string }
  const [manualCode, setManualCode] = useState('');
  const [toastMessage, setToastMessage] = useState(null);
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);

  const videoRef = useRef(null);
  const codeReaderRef = useRef(null);
  const controlsRef = useRef(null);
  const activeStreamRef = useRef(null);
  const generationTokenRef = useRef(0);
  const activeStreamsRef = useRef(new Set());
  const streamTokenMapRef = useRef(new WeakMap());
  const lastScannedRef = useRef({ unitCode: '', timestamp: 0 });
  const previousFocusRef = useRef(null);
  const isMountedRef = useRef(true);

  // Keep latest callbacks in refs to avoid stale closures
  const latestOnScanRef = useRef(onScan);
  useEffect(() => {
    latestOnScanRef.current = onScan;
  }, [onScan]);

  const latestOnCloseRef = useRef(onClose);
  useEffect(() => {
    latestOnCloseRef.current = onClose;
  }, [onClose]);

  // Track component mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Cleanly stop hardware media streams and active scanner controls
  // Pure resource teardown without triggering synchronous React state updates inside effects
  const stopHardwareMedia = useCallback(() => {
    // Invalidate any ongoing asynchronous start calls
    generationTokenRef.current += 1;

    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch {
        // Ignore stop error
      }
      controlsRef.current = null;
    }

    activeStreamRef.current = null;

    // Stop streams registered in the active set
    if (activeStreamsRef.current) {
      activeStreamsRef.current.forEach((stream) => {
        try {
          if (stream && typeof stream.getTracks === 'function') {
            stream.getTracks().forEach((track) => {
              try {
                track.stop();
              } catch {
                // Ignore track stop error
              }
            });
          }
        } catch {
          // Ignore stream error
        }
      });
      activeStreamsRef.current.clear();
    }

    // Also stop stream currently attached to video element if any
    const videoEl = videoRef.current;
    if (videoEl && videoEl.srcObject) {
      try {
        const stream = videoEl.srcObject;
        if (stream && typeof stream.getTracks === 'function') {
          stream.getTracks().forEach((track) => {
            try {
              track.stop();
            } catch {
              // Ignore track stop error
            }
          });
        }
      } catch {
        // Ignore video stream error
      }
      videoEl.srcObject = null;
    }
  }, []);

  // UI Event: Pause camera
  const pauseCamera = useCallback(() => {
    stopHardwareMedia();
    setCameraActive(false);
    setIsLoadingCamera(false);
  }, [stopHardwareMedia]);

  // Manage open/close lifecycle and restore focus without set-state-in-effect
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement;
    } else {
      stopHardwareMedia();
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    }
  }, [isOpen, stopHardwareMedia]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen]);

  // Handle Close modal action
  const handleClose = useCallback(() => {
    stopHardwareMedia();
    setCameraActive(false);
    setIsLoadingCamera(false);
    if (latestOnCloseRef.current) {
      latestOnCloseRef.current();
    }
  }, [stopHardwareMedia]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopHardwareMedia();
    };
  }, [stopHardwareMedia]);

  // Enumerate video devices safely
  const loadDevices = useCallback(async () => {
    try {
      if (!navigator?.mediaDevices?.enumerateDevices) {
        return;
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      setVideoDevices(videoInputs);

      // Only choose default if device names are available (permission already granted)
      const hasLabels = videoInputs.some((d) => Boolean(d.label && d.label.trim()));
      if (hasLabels && videoInputs.length > 0 && !selectedDeviceId) {
        const rearCamera = videoInputs.find(
          (d) =>
            /back|rear|environment|หลัง/i.test(d.label) ||
            /camera2 0/i.test(d.label)
        );
        if (rearCamera) {
          setSelectedDeviceId(rearCamera.deviceId);
        }
      }
    } catch {
      // Ignore device enumeration error
    }
  }, [selectedDeviceId]);

  // Handle a successfully scanned or typed payload
  const handleRecognizedPayload = useCallback((rawPayload) => {
    const decoded = decodeQrPayload(rawPayload);
    if (!decoded.success) {
      if (isMountedRef.current) {
        setScanStatus({
          type: 'error',
          message: decoded.error || 'รหัส QR ไม่ถูกต้อง'
        });
      }
      return;
    }

    const now = Date.now();
    // Throttle repeated scans of the same unit code within 2 seconds
    if (
      lastScannedRef.current.unitCode === decoded.unitCode &&
      now - lastScannedRef.current.timestamp < 2000
    ) {
      return;
    }

    lastScannedRef.current = { unitCode: decoded.unitCode, timestamp: now };

    if (isMountedRef.current) {
      setScanStatus({
        type: 'success',
        message: `อ่านรหัสสำเร็จ: ${decoded.unitCode}`,
        code: decoded.unitCode
      });
    }

    // Pass recognized unit code to supervising form (always using latest callback ref)
    if (typeof latestOnScanRef.current === 'function') {
      latestOnScanRef.current(decoded.unitCode, decoded);
    }
  }, []);

  // Start continuous QR scanner with monotonically increasing generation token
  const startCamera = async (targetDeviceId = selectedDeviceId) => {
    stopHardwareMedia();

    // Increment and capture generation token for this start invocation
    const currentToken = ++generationTokenRef.current;
    setIsLoadingCamera(true);
    setScanStatus(null);

    // Capture current video element reference for this specific invocation
    const capturedVideoEl = videoRef.current;

    try {
      if (!codeReaderRef.current) {
        codeReaderRef.current = codeReaderInstance || new BrowserMultiFormatReader(new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE, BarcodeFormat.CODE_128]]]));
      }

      await loadDevices();

      // Check if cancelled during device enumeration
      if (currentToken !== generationTokenRef.current || !isMountedRef.current) {
        return;
      }

      if (!capturedVideoEl) {
        if (isMountedRef.current) setIsLoadingCamera(false);
        return;
      }

      const reader = codeReaderRef.current;
      const scanCallback = (result) => {
        // If generation token has moved on, ignore callbacks
        if (currentToken !== generationTokenRef.current) return;
        if (result) {
          handleRecognizedPayload(result.getText());
        }
      };

      let controls;
      // Prefer environment facing mode via decodeFromConstraints when no specific device is chosen
      if (typeof reader.decodeFromConstraints === 'function' && !targetDeviceId) {
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } } },
          capturedVideoEl,
          scanCallback
        );
      } else if (typeof reader.decodeFromVideoDevice === 'function') {
        controls = await reader.decodeFromVideoDevice(
          targetDeviceId || undefined,
          capturedVideoEl,
          scanCallback
        );
      } else if (typeof reader.decodeFromConstraints === 'function') {
        controls = await reader.decodeFromConstraints(
          targetDeviceId
            ? { video: { deviceId: { exact: targetDeviceId } } }
            : { video: { facingMode: { ideal: 'environment' } } },
          capturedVideoEl,
          scanCallback
        );
      }

      // Capture the stream associated with this start invocation
      const stream = controls?.stream || capturedVideoEl.srcObject;
      if (stream && typeof stream === 'object') {
        streamTokenMapRef.current.set(stream, currentToken);
        activeStreamsRef.current.add(stream);
      }

      // Check if user cancelled, closed modal, unmounted, or started a newer camera while decoding was resolving
      if (currentToken !== generationTokenRef.current || !isMountedRef.current) {
        // Obsolete start! Stop controls and only its own stream tracks
        try {
          controls?.stop?.();
        } catch {
          // Ignore
        }

        if (stream && stream !== activeStreamRef.current) {
          if (typeof stream.getTracks === 'function') {
            stream.getTracks().forEach((t) => {
              try {
                t.stop();
              } catch {
                // Ignore
              }
            });
          }
          activeStreamsRef.current.delete(stream);
        }

        // Only clear capturedVideoEl.srcObject if it still points to THIS invocation's stream!
        // Never clear or stop a newer active generation's stream!
        if (capturedVideoEl && capturedVideoEl.srcObject === stream) {
          capturedVideoEl.srcObject = activeStreamRef.current || null;
        }
        return;
      }

      controlsRef.current = controls;
      activeStreamRef.current = stream || capturedVideoEl.srcObject || null;
      setCameraActive(true);
      setIsLoadingCamera(false);

      // Re-enumerate to get human-readable labels now that permission is granted
      loadDevices();
    } catch (err) {
      if (currentToken !== generationTokenRef.current || !isMountedRef.current) return;
      setIsLoadingCamera(false);
      setCameraActive(false);

      let msg = 'ไม่สามารถเปิดกล้องได้';
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        msg = 'กรุณาอนุญาตสิทธิ์เข้าถึงกล้องในการตั้งค่าเบราว์เซอร์เพื่อใช้งานระบบสแกน';
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        msg = 'ไม่พบอุปกรณ์กล้องบนอุปกรณ์นี้ กรุณาใช้แถบ "พิมพ์รหัส" แทน';
      } else if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') {
        msg = 'กล้องกำลังถูกแอปพลิเคชันอื่นใช้งานอยู่';
      } else {
        msg = `เกิดข้อผิดพลาดในการเปิดกล้อง: ${err?.message || 'ไม่ทราบสาเหตุ'}`;
      }

      setScanStatus({
        type: 'error',
        message: msg
      });
    }
  };

  // Handle device change
  const handleDeviceChange = (e) => {
    const newDeviceId = e.target.value;
    setSelectedDeviceId(newDeviceId);
    if (cameraActive) {
      startCamera(newDeviceId);
    }
  };

  // Switch between front/back camera quickly
  const toggleFlipCamera = () => {
    if (videoDevices.length <= 1) return;
    const currentIndex = videoDevices.findIndex((d) => d.deviceId === selectedDeviceId);
    const nextIndex = (currentIndex + 1) % videoDevices.length;
    const nextDevice = videoDevices[nextIndex];
    setSelectedDeviceId(nextDevice.deviceId);
    if (cameraActive) {
      startCamera(nextDevice.deviceId);
    }
  };

  // Handle manual code submission
  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;

    handleRecognizedPayload(manualCode.trim());
    setManualCode('');
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-scanner-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)] animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
              style={{
                backgroundColor: 'var(--theme-light, #f5f3ff)',
                color: 'var(--theme-ink, #4c1d95)'
              }}
            >
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 id="qr-scanner-title" className="text-base font-bold text-slate-800">
                {title}
              </h2>
              <p className="text-xs text-slate-500">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="ปิดหน้าต่างสแกน"
            className="w-10 h-10 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Tab Selector: Camera vs Manual Entry with Theme Accents */}
        <div className="flex border-b border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setActiveTab('camera')}
            style={
              activeTab === 'camera'
                ? {
                    color: 'var(--theme-ink, #4c1d95)',
                    borderBottomColor: 'var(--theme-main, #8b5cf6)',
                    backgroundColor: 'var(--theme-light, #f5f3ff)'
                  }
                : {}
            }
            className={`flex-1 min-h-[44px] py-2.5 px-4 text-sm font-semibold flex items-center justify-center gap-2 transition ${
              activeTab === 'camera'
                ? 'border-b-2 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Camera className="w-4 h-4" />
            กล้องสแกน
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('manual');
              if (cameraActive) pauseCamera();
            }}
            style={
              activeTab === 'manual'
                ? {
                    color: 'var(--theme-ink, #4c1d95)',
                    borderBottomColor: 'var(--theme-main, #8b5cf6)',
                    backgroundColor: 'var(--theme-light, #f5f3ff)'
                  }
                : {}
            }
            className={`flex-1 min-h-[44px] py-2.5 px-4 text-sm font-semibold flex items-center justify-center gap-2 transition ${
              activeTab === 'manual'
                ? 'border-b-2 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Keyboard className="w-4 h-4" />
            พิมพ์รหัส / บาร์โค้ด
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 flex-1 min-h-0 overflow-y-auto space-y-4">
          {activeTab === 'camera' ? (
            <div className="space-y-3">
              {/* Camera Video Viewport */}
              <div className="relative w-full aspect-square max-h-[320px] mx-auto bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-800 shadow-inner">
                <video
                  ref={videoRef}
                  className={`w-full h-full object-cover transition-opacity duration-300 ${
                    cameraActive ? 'opacity-100' : 'opacity-0'
                  }`}
                  playsInline
                  muted
                />

                {/* Reticle / Viewfinder Overlay when Camera is Active */}
                {cameraActive && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div
                      className="w-48 h-48 sm:w-56 sm:h-56 border-2 border-dashed rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] transition-colors"
                      style={{ borderColor: 'var(--theme-main, #8b5cf6)' }}
                    >
                      <span
                        className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 rounded-tl-lg"
                        style={{ borderColor: 'var(--theme-main, #8b5cf6)' }}
                      />
                      <span
                        className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 rounded-tr-lg"
                        style={{ borderColor: 'var(--theme-main, #8b5cf6)' }}
                      />
                      <span
                        className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 rounded-bl-lg"
                        style={{ borderColor: 'var(--theme-main, #8b5cf6)' }}
                      />
                      <span
                        className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 rounded-br-lg"
                        style={{ borderColor: 'var(--theme-main, #8b5cf6)' }}
                      />
                    </div>
                  </div>
                )}

                {/* Inactive State: Explicit start button */}
                {!cameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-300 bg-slate-900/90">
                    <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-3 text-slate-200">
                      <CameraOff className="w-7 h-7" />
                    </div>
                    <p className="text-sm font-medium text-slate-200 mb-1">กล้องยังไม่ทำงาน</p>
                    <p className="text-xs text-slate-400 mb-4 max-w-xs">
                      กดปุ่มด้านล่างเพื่อเปิดกล้องสแกน QR หรือบาร์โค้ดของอุปกรณ์
                    </p>
                    <button
                      type="button"
                      onClick={() => startCamera()}
                      style={{
                        backgroundColor: 'var(--theme-main, #8b5cf6)',
                        color: 'var(--theme-on-main, #ffffff)',
                        boxShadow: '0 10px 15px -3px var(--theme-shadow, rgba(139, 92, 246, 0.35))'
                      }}
                      className="min-h-[44px] px-6 py-2.5 rounded-xl text-white font-semibold text-sm transition flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                      {isLoadingCamera ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          กำลังเชื่อมต่อกล้อง...
                        </>
                      ) : (
                        <>
                          <Camera className="w-4 h-4" />
                          เปิดกล้องสแกน
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Camera Controls & Device Picker */}
              {cameraActive && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  {videoDevices.length > 1 ? (
                    <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                      <select
                        value={selectedDeviceId}
                        onChange={handleDeviceChange}
                        aria-label="เลือกอุปกรณ์กล้อง"
                        className="text-xs text-slate-700 bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 flex-1 min-h-[44px]"
                      >
                        {videoDevices.map((d, idx) => (
                          <option key={d.deviceId || idx} value={d.deviceId}>
                            {d.label || `กล้องตัวที่ ${idx + 1}`}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={toggleFlipCamera}
                        title="สลับกล้องหน้า/หลัง"
                        className="p-2 min-h-[44px] min-w-[44px] rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition flex items-center justify-center cursor-pointer"
                      >
                        <FlipHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">กล้องกำลังสแกนอัตโนมัติ</span>
                  )}

                  <button
                    type="button"
                    onClick={pauseCamera}
                    className="min-h-[44px] px-3.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-200 transition ml-auto cursor-pointer"
                  >
                    พักกล้องชั่วคราว
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Manual Input & 2D Hardware Barcode Scanner Tab */
            <form onSubmit={handleManualSubmit} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label htmlFor="manual-code-input" className="block text-sm font-semibold text-slate-700">
                  รหัสครุภัณฑ์ (Unit Code)
                </label>
                <div className="flex gap-2">
                  <input
                    id="manual-code-input"
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="เช่น SC-001, DR-002 หรือ F2U:T:SC-001"
                    className="flex-1 min-h-[44px] px-3.5 py-2 border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2"
                    style={{
                      '--tw-ring-color': 'var(--theme-main, #8b5cf6)'
                    }}
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={!manualCode.trim()}
                    style={{
                      backgroundColor: manualCode.trim() ? 'var(--theme-main, #8b5cf6)' : undefined,
                      color: manualCode.trim() ? 'var(--theme-on-main, #ffffff)' : undefined
                    }}
                    className="min-h-[44px] px-5 py-2 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold text-sm rounded-xl transition cursor-pointer"
                  >
                    เพิ่ม
                  </button>
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5" style={{ color: 'var(--theme-ink, #4c1d95)' }} />
                  คำแนะนำการใช้งาน
                </p>
                <p>• หากใช้ปืนยิงบาร์โค้ดแบบ USB/Bluetooth สามารถคลิกช่องนี้แล้วยิงโค้ดได้ทันที</p>
                <p>• รองรับทั้งรหัสเต็ม <code>F2U:T:SC-001</code> และรหัสย่อ <code>SC-001</code></p>
              </div>
            </form>
          )}

          {/* Feedback & Scan Result Banner */}
          {scanStatus && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-3 animate-in fade-in slide-in-from-bottom-1 duration-200 ${
                scanStatus.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {scanStatus.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 text-sm">
                <p className="font-semibold">{scanStatus.message}</p>
                {scanStatus.code && (
                  <p className="text-xs mt-0.5 text-emerald-700">
                    ส่งรหัสไปยังรายการเลือกเรียบร้อย (กรุณากดยืนยันในหน้าหลักเพื่อบันทึก)
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer with Safe Area Padding */}
        <footer
          className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between"
          style={{ paddingBottom: 'calc(0.875rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <span className="text-xs text-slate-500">
            ระบบสแกนไม่บันทึกการเบิกอัตโนมัติ เพื่อป้องกันการยิงผิดพลาด
          </span>
          <button
            type="button"
            onClick={handleClose}
            className="min-h-[44px] px-5 py-2 rounded-xl border border-slate-300 hover:bg-slate-200/50 text-slate-700 font-semibold text-sm transition cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </footer>
      </div>

      {toastMessage && (
        <Toast
          message={toastMessage.message}
          type={toastMessage.type}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>, document.body
  );
}
