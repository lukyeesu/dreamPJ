import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  KeyRound,
  Clock,
  Copy,
  Check,
  ExternalLink,
  X,
  Loader2
} from 'lucide-react';
import { generateQrDataUrl } from '../../utils/qrLabels.js';

export default function PasswordResetLinkModal({ isOpen, onClose, resetData }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [isQrLoading, setIsQrLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef(null);

  const basePath =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/dreamPJ')
      ? '/dreamPJ'
      : '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const resetUrl = resetData?.token
    ? `${origin}${basePath}/?reset_token=${encodeURIComponent(resetData.token)}`
    : '';

  useEffect(() => {
    if (!isOpen || !resetData?.token) return undefined;

    const handleKeyDown = (e) => {
      if (!e.defaultPrevented && e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, resetData?.token, onClose]);

  useEffect(() => {
    setCopied(false);
    if (copyTimeoutRef.current) {
      window.clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = null;
    }

    if (!isOpen || !resetUrl) {
      setQrDataUrl('');
      setIsQrLoading(false);
      return undefined;
    }

    let cancelled = false;
    setIsQrLoading(true);
    setQrDataUrl('');

    generateQrDataUrl(resetUrl, { width: 220, margin: 1 })
      .then((dataUrl) => {
        if (!cancelled) {
          setQrDataUrl(dataUrl || '');
          setIsQrLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl('');
          setIsQrLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, resetUrl]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const handleCopyLink = useCallback(async () => {
    if (!resetUrl) return;

    let didCopy = false;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(resetUrl);
        didCopy = true;
      }
    } catch {
      didCopy = false;
    }

    if (!didCopy && typeof document !== 'undefined') {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = resetUrl;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.top = '-9999px';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, resetUrl.length);
        didCopy = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {
        didCopy = false;
      }
    }

    if (didCopy) {
      setCopied(true);
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopied(false);
        copyTimeoutRef.current = null;
      }, 2500);
    }
  }, [resetUrl]);

  if (!isOpen || !resetData?.token) return null;
  if (typeof document === 'undefined') return null;

  const displayName =
    resetData.fullName || resetData.nickname || resetData.username || 'พนักงาน';
  const ttlMinutes = resetData.ttlMinutes || 15;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="password-reset-link-title"
      className="fixed inset-0 z-[280] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto backdrop-animate-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 max-w-md w-full p-6 sm:p-7 relative text-center modal-animate-in my-auto"
      >
        <button
          type="button"
          onClick={() => onClose?.()}
          aria-label="ปิดหน้าต่าง"
          className="absolute top-5 right-5 w-8 h-8 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-14 h-14 rounded-2xl theme-logo-bg text-white flex items-center justify-center shadow-lg mx-auto mb-4">
          <KeyRound className="w-7 h-7" />
        </div>

        <h2
          id="password-reset-link-title"
          className="text-xl font-extrabold text-slate-900 text-center"
        >
          สร้างลิงก์เปลี่ยนรหัสผ่านสำเร็จ
        </h2>

        <p className="mt-1.5 text-sm text-slate-500 text-center break-words">
          สำหรับพนักงาน: <b className="font-bold text-slate-800">{displayName}</b>
          {resetData.username ? (
            <span className="text-violet-600 font-semibold"> (@{resetData.username})</span>
          ) : null}
        </p>

        <div className="mt-2.5 inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-violet-50 border border-violet-100 text-violet-700 text-xs font-bold">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>ลิงก์มีอายุ {ttlMinutes} นาที (หลังจากนั้นต้องสร้างใหม่)</span>
        </div>

        <div className="mt-5 bg-slate-50/80 border border-slate-100 rounded-2xl p-4 flex flex-col items-center w-fit mx-auto">
          {isQrLoading || !qrDataUrl ? (
            <div className="w-44 h-44 rounded-xl bg-white p-2 border border-slate-100 flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-violet-600 animate-spin" />
            </div>
          ) : (
            <img
              src={qrDataUrl}
              alt="QR Code สำหรับเปลี่ยนรหัสผ่าน"
              className="w-44 h-44 rounded-xl bg-white p-2 border border-slate-100 object-contain"
            />
          )}
          <p className="mt-2.5 text-xs font-medium text-slate-500 text-center">
            สแกนด้วยมือถือเพื่อเปลี่ยนรหัสผ่านทันที
          </p>
        </div>

        <div className="mt-5 text-left">
          <label
            htmlFor="password-reset-url-input"
            className="text-xs font-bold text-slate-700 mb-1.5 block"
          >
            ลิงก์ส่งให้พนักงาน (พนักงานตั้งรหัสผ่านเอง - แอดมินไม่ทราบรหัสผ่าน)
          </label>
          <div className="flex items-center gap-2">
            <input
              id="password-reset-url-input"
              type="text"
              value={resetUrl}
              readOnly
              onFocus={(e) => e.target.select()}
              className="flex-1 min-w-0 h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className={`h-11 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shrink-0 transition active:scale-95 cursor-pointer ${
                copied
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                  : 'theme-logo-bg hover:brightness-95 text-white'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 shrink-0" />
                  <span>คัดลอกแล้ว</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 shrink-0" />
                  <span>คัดลอกลิงก์</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <a
            href={resetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-11 rounded-xl theme-logo-bg hover:brightness-95 text-white font-bold text-sm flex items-center justify-center gap-1.5 transition active:scale-95"
          >
            <ExternalLink className="w-4 h-4" /> เปิดในแท็บใหม่
          </a>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition active:scale-95 cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
