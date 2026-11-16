import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import {
  Camera,
  CameraOff,
  ChevronLeft,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FlipHorizontal,
  Image as ImageIcon,
  QrCode,
  ScanLine
} from 'lucide-react';
import { decodeQrPayload } from '../../utils/qrLabels.js';
import Toast from '../common/Toast.jsx';

/**
 * QrScanner Component
 *
 * Full-screen mobile-first QR & Code 128 barcode scanner inspired by Thai PromptPay / TrueMoney UX.
 * Supports edge-to-edge live camera preview, sweeping scan line, hardware flashlight (torch),
 * photo album image decoding, USB/Bluetooth/manual code fallback, and leak-free stream lifecycle.
 *
 * Props:
 *   - isOpen: boolean (whether scanner is displayed)
 *   - onClose: () => void (handler to close scanner)
 *   - onScan: (unitCode: string, resultObj: object) => void (callback when code is recognized)
 *   - title: string (top bar title, defaults to 'สแกน')
 *   - subtitle: string (supporting hint under top bar)
 *   - autoStart: boolean (auto-start rear camera on open; defaults to false for deterministic tests, enabled in live app)
 *   - codeReaderInstance: object (optional dependency injection for testing/mocking)
 */
export default function QrScanner({
  isOpen = true,
  onClose,
  onScan,
  title = 'สแกน',
  subtitle = 'สแกนของว่างเพื่อหยิบใส่กระเป๋า หรือสแกนของยืมเพื่อรับคืนทันที',
  autoStart = false,
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
  const [torchOn, setTorchOn] = useState(false);
  const [isDecodingImage, setIsDecodingImage] = useState(false);

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const codeReaderRef = useRef(null);
  const controlsRef = useRef(null);
  const activeStreamRef = useRef(null);
  const generationTokenRef = useRef(0);
  const activeStreamsRef = useRef(new Set());
  const streamTokenMapRef = useRef(new WeakMap());
  const lastScannedRef = useRef({ unitCode: '', timestamp: 0 });
  const previousFocusRef = useRef(null);
  const isMountedRef = useRef(true);
  const startCameraRef = useRef(null);

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

  const getOrCreateReader = useCallback(() => {
    if (!codeReaderRef.current) {
      const hints = new Map([
        [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE, BarcodeFormat.CODE_128]],
        [DecodeHintType.TRY_HARDER, true]
      ]);
      codeReaderRef.current = codeReaderInstance || new BrowserMultiFormatReader(hints);
    }
    return codeReaderRef.current;
  }, [codeReaderInstance]);

  // Cleanly stop hardware media streams and active scanner controls
  const stopHardwareMedia = useCallback(() => {
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
    setTorchOn(false);
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
    setTorchOn(false);
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
      if (isMountedRef.current) {
        setVideoDevices(videoInputs);
      }

      const hasLabels = videoInputs.some((d) => Boolean(d.label && d.label.trim()));
      if (hasLabels && videoInputs.length > 0 && !selectedDeviceId) {
        const rearCamera = videoInputs.find(
          (d) =>
            /back|rear|environment|หลัง/i.test(d.label) ||
            /camera2 0/i.test(d.label)
        );
        if (rearCamera && isMountedRef.current) {
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

    if (typeof latestOnScanRef.current === 'function') {
      latestOnScanRef.current(decoded.unitCode, decoded);
    }
  }, []);

  // Start continuous QR scanner with monotonically increasing generation token
  const startCamera = async (targetDeviceId = selectedDeviceId) => {
    stopHardwareMedia();

    const currentToken = ++generationTokenRef.current;
    setIsLoadingCamera(true);
    setTorchOn(false);
    setScanStatus(null);

    const capturedVideoEl = videoRef.current;

    try {
      const reader = getOrCreateReader();

      await loadDevices();

      if (currentToken !== generationTokenRef.current || !isMountedRef.current) {
        return;
      }

      if (!capturedVideoEl) {
        if (isMountedRef.current) setIsLoadingCamera(false);
        return;
      }

      const scanCallback = (result) => {
        if (currentToken !== generationTokenRef.current) return;
        if (result) {
          handleRecognizedPayload(result.getText());
        }
      };

      let controls;
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

      const stream = controls?.stream || capturedVideoEl.srcObject;
      if (stream && typeof stream === 'object') {
        streamTokenMapRef.current.set(stream, currentToken);
        activeStreamsRef.current.add(stream);
      }

      if (currentToken !== generationTokenRef.current || !isMountedRef.current) {
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

        if (capturedVideoEl && capturedVideoEl.srcObject === stream) {
          capturedVideoEl.srcObject = activeStreamRef.current || null;
        }
        return;
      }

      controlsRef.current = controls;
      activeStreamRef.current = stream || capturedVideoEl.srcObject || null;
      setCameraActive(true);
      setIsLoadingCamera(false);

      loadDevices();
    } catch (err) {
      if (currentToken !== generationTokenRef.current || !isMountedRef.current) return;
      setIsLoadingCamera(false);
      setCameraActive(false);

      let msg = 'ไม่สามารถเปิดกล้องได้';
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        msg = 'กรุณาอนุญาตสิทธิ์เข้าถึงกล้องในการตั้งค่าเบราว์เซอร์เพื่อใช้งานระบบสแกน';
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        msg = 'ไม่พบอุปกรณ์กล้องบนอุปกรณ์นี้ กรุณาใช้แถบ "พิมพ์รหัส" หรือเลือกรูปจากอัลบั้มแทน';
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

  startCameraRef.current = startCamera;

  // Auto-start rear camera immediately when opened in live full-screen mode
  useEffect(() => {
    if (isOpen && autoStart && activeTab === 'camera') {
      startCameraRef.current?.();
    }
  }, [isOpen, autoStart, activeTab]);

  // Toggle hardware flashlight / torch on rear mobile camera
  const toggleTorch = async () => {
    if (!cameraActive) {
      setToastMessage({
        type: 'error',
        message: 'กรุณาเปิดกล้องก่อนใช้งานไฟฉาย'
      });
      return;
    }

    const nextTorch = !torchOn;
    try {
      if (typeof controlsRef.current?.switchTorch === 'function') {
        await controlsRef.current.switchTorch(nextTorch);
        if (isMountedRef.current) setTorchOn(nextTorch);
        return;
      }

      const track = activeStreamRef.current?.getVideoTracks?.()?.[0];
      const capabilities = track?.getCapabilities?.();
      if (track && capabilities?.torch && typeof track.applyConstraints === 'function') {
        await track.applyConstraints({ advanced: [{ torch: nextTorch }] });
        if (isMountedRef.current) setTorchOn(nextTorch);
        return;
      }

      setToastMessage({
        type: 'error',
        message: 'กล้องของอุปกรณ์นี้ไม่รองรับการเปิดไฟฉาย'
      });
    } catch {
      setToastMessage({
        type: 'error',
        message: 'ไม่สามารถสลับไฟฉายบนอุปกรณ์นี้ได้'
      });
    }
  };

  // Decode QR / Code 128 barcode directly from a photo selected from album
  const handleAlbumFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsDecodingImage(true);
    setScanStatus(null);
    const objectUrl = URL.createObjectURL(file);

    try {
      const reader = getOrCreateReader();
      let result = null;
      if (typeof reader.decodeFromImageUrl === 'function') {
        result = await reader.decodeFromImageUrl(objectUrl);
      } else if (typeof reader.decodeFromImageElement === 'function') {
        result = await reader.decodeFromImageElement(objectUrl);
      } else {
        throw new Error('ตัวอ่านไม่รองรับการถอดรหัสจากรูปภาพ');
      }

      if (result && typeof result.getText === 'function') {
        handleRecognizedPayload(result.getText());
      } else {
        setScanStatus({
          type: 'error',
          message: 'ไม่พบ QR หรือบาร์โค้ดในรูปภาพที่เลือก'
        });
      }
    } catch {
      if (isMountedRef.current) {
        setScanStatus({
          type: 'error',
          message: 'ไม่พบ QR หรือบาร์โค้ดในรูปภาพ กรุณาเลือกรูปที่เห็นรหัสชัดเจน'
        });
      }
    } finally {
      URL.revokeObjectURL(objectUrl);
      if (isMountedRef.current) {
        setIsDecodingImage(false);
      }
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
      className="fixed inset-0 z-[120] h-[100dvh] w-full flex flex-col bg-zinc-950 text-white overflow-hidden select-none animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-scanner-title"
    >
      <style>{`
        @keyframes f2uLaserSweep {
          0% { transform: translateY(-76px); opacity: 0.8; }
          50% { transform: translateY(76px); opacity: 1; }
          100% { transform: translateY(-76px); opacity: 0.8; }
        }
        .f2u-laser-sweep {
          animation: f2uLaserSweep 2.6s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .f2u-laser-sweep {
            animation: none;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Upper Full-Bleed Scanner / Manual Viewport */}
      <div className="relative flex-1 min-h-0 flex flex-col justify-between overflow-hidden">
        {/* Live Edge-to-Edge Camera Video */}
        <video
          ref={videoRef}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            activeTab === 'camera' && cameraActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          playsInline
          muted
        />

        {/* Ambient Vignette Scrims for Legibility Over Any Camera Scene */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black/75 via-black/35 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-black/80 via-black/35 to-transparent"
        />

        {/* Top Floating AppBar (16pt = 16px Base Padding + Safe Area Top) */}
        <header
          className="relative z-20 w-full px-4 pb-2"
          style={{ paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))' }}
        >
          <div className="max-w-2xl mx-auto w-full grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            {/* Left Zone: Minimal Back Chevron */}
            <div className="justify-self-start">
              <button
                type="button"
                onClick={handleClose}
                aria-label="ปิดหน้าต่างสแกน"
                className="w-11 h-11 min-h-[44px] min-w-[44px] -ml-2 rounded-full flex items-center justify-center text-white hover:bg-white/15 active:scale-95 transition cursor-pointer"
              >
                <ChevronLeft className="w-7 h-7" strokeWidth={2.2} />
              </button>
            </div>

            {/* Center Zone: Crisp Title */}
            <h2
              id="qr-scanner-title"
              className="text-lg font-bold tracking-tight text-white text-center truncate max-w-[60vw]"
            >
              {title}
            </h2>

            {/* Right Zone: Optional Camera Flip + Circular Outlined Torch Button */}
            <div className="justify-self-end flex items-center gap-2">
              {activeTab === 'camera' && videoDevices.length > 1 && (
                <button
                  type="button"
                  onClick={toggleFlipCamera}
                  aria-label="สลับกล้องหน้าหรือหลัง"
                  title="สลับกล้องหน้า/หลัง"
                  className="w-10 h-10 min-h-[44px] min-w-[44px] rounded-full border border-white/50 bg-black/25 text-white hover:bg-white/15 active:scale-95 transition flex items-center justify-center cursor-pointer"
                >
                  <FlipHorizontal className="w-4 h-4" />
                </button>
              )}

              {activeTab === 'camera' && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  aria-label="เปิดหรือปิดไฟฉาย"
                  aria-pressed={torchOn}
                  title={torchOn ? 'ปิดไฟฉาย' : 'เปิดไฟฉาย'}
                  className={`w-10 h-10 min-h-[44px] min-w-[44px] rounded-full border flex items-center justify-center transition active:scale-95 cursor-pointer ${
                    torchOn
                      ? 'bg-amber-400 border-amber-300 text-zinc-950'
                      : 'border-white/75 bg-black/20 text-white hover:bg-white/15'
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-5 h-5"
                    aria-hidden="true"
                  >
                    <path d="M8 3h8l-1.5 5.5v9.5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2V8.5L8 3Z" />
                    <path d="M8 6h8" />
                    <path d="M12 12v2" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Supporting Badges & Subtitle Underneath Top Bar */}
          {activeTab === 'camera' && (
            <div className="max-w-md mx-auto mt-3 flex flex-col items-center gap-1.5 text-center px-2">
              <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs font-medium text-white/90">
                <span>รองรับสติกเกอร์</span>
                <span className="px-2 py-0.5 rounded bg-white text-slate-900 font-bold text-[11px] tracking-tight shadow-xs">
                  QR Code
                </span>
                <span>และ</span>
                <span className="px-2 py-0.5 rounded bg-white/90 text-slate-900 font-bold text-[11px] tracking-tight shadow-xs">
                  Barcode 128
                </span>
              </div>
              <p className="text-xs text-white/75 leading-relaxed line-clamp-2">{subtitle}</p>
            </div>
          )}
        </header>

        {/* Center Scan Sweep Zone OR Manual Code Entry Card */}
        <div className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center px-4">
          {activeTab === 'camera' ? (
            <>
              {/* Horizontal Sweeping Laser Scan Line + Trailing Glow Band */}
              {cameraActive && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none w-full max-w-[340px] flex flex-col items-center justify-center"
                >
                  <div className="w-full f2u-laser-sweep">
                    <div className="h-[2px] w-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.95)] rounded-full" />
                    <div
                      className="h-20 w-[94%] mx-auto"
                      style={{
                        background:
                          'linear-gradient(180deg, color-mix(in srgb, var(--theme-main, #f97316) 46%, transparent) 0%, transparent 100%)'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Camera Inactive / Connecting Prompt */}
              {!cameraActive && (
                <div className="w-full max-w-xs rounded-3xl bg-zinc-900/80 backdrop-blur-md border border-white/15 p-6 text-center shadow-2xl">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-3 text-white/90">
                    {isLoadingCamera ? (
                      <RefreshCw className="w-6 h-6 animate-spin" />
                    ) : (
                      <CameraOff className="w-6 h-6" />
                    )}
                  </div>
                  <p className="text-sm font-semibold text-white mb-1">
                    {isLoadingCamera ? 'กำลังเปิดกล้องสแกน...' : 'กล้องยังไม่ทำงาน'}
                  </p>
                  <p className="text-xs text-white/70 mb-4 leading-relaxed">
                    กดปุ่มด้านล่างเพื่อเปิดกล้องสแกนเต็มหน้าจอ หรือเลือกรูปสติกเกอร์จากอัลบั้ม
                  </p>
                  <button
                    type="button"
                    onClick={() => startCamera()}
                    style={{
                      backgroundColor: 'var(--theme-main, #8b5cf6)',
                      color: 'var(--theme-on-main, #ffffff)'
                    }}
                    className="w-full min-h-[44px] px-5 py-2.5 rounded-full font-semibold text-sm transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
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
            </>
          ) : (
            /* Manual Input & USB/Bluetooth Barcode Gun Sheet */
            <div className="w-full max-w-md bg-white text-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="manual-code-input" className="block text-sm font-bold text-slate-800">
                    รหัสครุภัณฑ์ / รหัสกล่องวัสดุ
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="manual-code-input"
                      type="text"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      placeholder="เช่น SC-001, DR-002 หรือ ITM-3826"
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
                      className="min-h-[44px] px-5 py-2 disabled:bg-slate-200 disabled:text-slate-400 font-semibold text-sm rounded-xl transition cursor-pointer"
                    >
                      เพิ่ม
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs text-slate-600 space-y-1">
                  <p className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5" style={{ color: 'var(--theme-ink, #4c1d95)' }} />
                    คำแนะนำการใช้งาน
                  </p>
                  <p>• หากใช้ปืนยิงบาร์โค้ดแบบ USB / Bluetooth คลิกช่องนี้แล้วยิงโค้ดได้ทันที</p>
                  <p>
                    • รองรับทั้งรหัสเต็ม <code>F2U:T:SC-001</code> และรหัสย่อ <code>SC-001</code>
                  </p>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Lower Floating Controls Over Camera Feed: Status Banner + Helper Text + Choose from Album Pill */}
        <div className="relative z-20 w-full max-w-md mx-auto px-4 pb-6 pt-2 flex flex-col items-center gap-3.5">
          {scanStatus && (
            <div
              className={`w-full p-3.5 rounded-2xl border backdrop-blur-md flex items-start gap-3 shadow-lg animate-in fade-in slide-in-from-bottom-1 duration-200 ${
                scanStatus.type === 'success'
                  ? 'bg-emerald-950/90 border-emerald-400/50 text-emerald-50'
                  : 'bg-rose-950/90 border-rose-400/50 text-rose-50'
              }`}
            >
              {scanStatus.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 text-sm">
                <p className="font-semibold">{scanStatus.message}</p>
                {scanStatus.code && (
                  <p className="text-xs mt-0.5 text-emerald-200">
                    ส่งรหัสไปยังรายการคลังเรียบร้อยแล้ว
                  </p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'camera' && (
            <>
              <p className="text-sm font-medium text-white/95 tracking-wide text-center drop-shadow-xs">
                วาง QR หรือ บาร์โค้ดให้อยู่ในจอ
              </p>

              <input
                ref={fileInputRef}
                id="qr-album-file-input"
                type="file"
                accept="image/*"
                onChange={handleAlbumFileChange}
                className="hidden"
                aria-label="เลือกรูปจากอัลบั้ม"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isDecodingImage}
                className="min-h-[46px] px-6 py-2.5 rounded-full bg-black/60 hover:bg-black/75 backdrop-blur-md border border-white/15 text-white text-sm font-semibold flex items-center justify-center gap-2.5 shadow-lg active:scale-95 transition cursor-pointer disabled:opacity-60"
              >
                {isDecodingImage ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    กำลังอ่านรูปภาพ...
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-4 h-4" />
                    เลือกรูปจากอัลบั้ม
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Bottom Clean White 2-Tab Bar (Matches Native Thai Scanner Bar) */}
      <nav
        aria-label="โหมดการสแกน"
        className="relative z-20 bg-white border-t border-slate-100 shrink-0"
        style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="max-w-md mx-auto w-full grid grid-cols-2 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('camera')}
            style={activeTab === 'camera' ? { color: 'var(--theme-ink, #c2410c)' } : undefined}
            className={`min-h-[54px] py-1.5 px-4 flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
              activeTab === 'camera' ? 'font-bold' : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            <ScanLine
              className="w-6 h-6"
              style={activeTab === 'camera' ? { color: 'var(--theme-main, #f97316)' } : undefined}
            />
            <span className="text-xs">สแกน</span>
            <span
              className={`h-[3px] w-8 rounded-full transition-opacity ${
                activeTab === 'camera' ? 'opacity-100' : 'opacity-0'
              }`}
              style={{ backgroundColor: 'var(--theme-main, #f97316)' }}
            />
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('manual');
              if (cameraActive) pauseCamera();
            }}
            style={activeTab === 'manual' ? { color: 'var(--theme-ink, #c2410c)' } : undefined}
            className={`min-h-[54px] py-1.5 px-4 flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
              activeTab === 'manual' ? 'font-bold' : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            <QrCode
              className="w-6 h-6"
              style={activeTab === 'manual' ? { color: 'var(--theme-main, #f97316)' } : undefined}
            />
            <span className="text-xs">
              พิมพ์รหัส<span className="sr-only"> / บาร์โค้ด</span>
            </span>
            <span
              className={`h-[3px] w-8 rounded-full transition-opacity ${
                activeTab === 'manual' ? 'opacity-100' : 'opacity-0'
              }`}
              style={{ backgroundColor: 'var(--theme-main, #f97316)' }}
            />
          </button>
        </div>
      </nav>

      {toastMessage && (
        <Toast
          message={toastMessage.message}
          type={toastMessage.type}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>,
    document.body
  );
}
