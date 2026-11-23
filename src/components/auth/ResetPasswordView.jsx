import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  User,
  Clock,
  Lock,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import {
  validateStaffResetTokenSync,
  consumeStaffResetTokenSync
} from '../../services/syncService';
import { processImageUrl } from '../../utils/formatters';
import { ensureThemeStylesheet } from '../../utils/themeManager';

export default function ResetPasswordView({ token, shopInfo = {}, onBackToLogin }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'invalid' | 'valid' | 'success'
  const [invalidReason, setInvalidReason] = useState('INVALID');
  const [staffInfo, setStaffInfo] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    ensureThemeStylesheet();
  }, []);

  useEffect(() => {
    setLogoError(false);
  }, [shopInfo?.logo]);

  useEffect(() => {
    let cancelled = false;

    async function verifyResetToken() {
      const cleanToken = typeof token === 'string' ? token.trim() : '';
      if (!cleanToken) {
        if (!cancelled) {
          setInvalidReason('INVALID');
          setStatus('invalid');
        }
        return;
      }

      setStatus('loading');
      setSubmitError('');

      try {
        const result = await validateStaffResetTokenSync(cleanToken);
        if (cancelled) return;

        if (result && result.valid) {
          const parsedExpMs = result.expiresAt ? new Date(result.expiresAt).getTime() : NaN;
          const initialSeconds = Number.isFinite(parsedExpMs)
            ? Math.max(0, Math.floor((parsedExpMs - Date.now()) / 1000))
            : 15 * 60;

          if (initialSeconds <= 0) {
            setInvalidReason('EXPIRED');
            setStatus('invalid');
            return;
          }

          const expiresAtMs = Number.isFinite(parsedExpMs)
            ? parsedExpMs
            : Date.now() + initialSeconds * 1000;

          setStaffInfo({
            staffId: result.staffId,
            username: result.username || '',
            fullName: result.fullName || '',
            nickname: result.nickname || '',
            expiresAt: expiresAtMs
          });
          setRemainingSeconds(initialSeconds);
          setStatus('valid');
        } else {
          setInvalidReason(result?.reason || 'INVALID');
          setStatus('invalid');
        }
      } catch {
        if (!cancelled) {
          setInvalidReason('INVALID');
          setStatus('invalid');
        }
      }
    }

    verifyResetToken();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (status !== 'valid' || !staffInfo?.expiresAt) return undefined;

    const tick = () => {
      const secsLeft = Math.max(0, Math.floor((staffInfo.expiresAt - Date.now()) / 1000));
      setRemainingSeconds(secsLeft);
      if (secsLeft <= 0) {
        setInvalidReason('EXPIRED');
        setStatus('invalid');
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [status, staffInfo?.expiresAt]);

  const isMinLength = password.trim().length >= 6;
  const isMatching = password.trim().length > 0 && password === confirmPassword;

  const mins = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
  const secs = String(remainingSeconds % 60).padStart(2, '0');
  const formattedCountdown = `${mins}:${secs}`;
  const isUrgent = remainingSeconds < 120;

  const shopDisplayName = shopInfo?.name || shopInfo?.shopName || 'Flower2you';

  const getInvalidMessage = (reason) => {
    if (reason === 'EXPIRED') {
      return 'ลิงก์เปลี่ยนรหัสผ่านนี้หมดอายุแล้ว (เกิน 15 นาที)';
    }
    if (reason === 'USED') {
      return 'ลิงก์เปลี่ยนรหัสผ่านนี้ถูกใช้งานไปแล้ว ไม่สามารถใช้ซ้ำได้';
    }
    return 'ลิงก์เปลี่ยนรหัสผ่านไม่ถูกต้องหรือถูกยกเลิกแล้ว';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isMinLength || !isMatching || isSubmitting) return;

    if (staffInfo?.expiresAt && Date.now() >= staffInfo.expiresAt) {
      setInvalidReason('EXPIRED');
      setStatus('invalid');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const cleanToken = typeof token === 'string' ? token.trim() : '';
      const result = await consumeStaffResetTokenSync(cleanToken, password);

      if (result && result.success === false) {
        if (result.reason === 'EXPIRED' || result.reason === 'USED') {
          setInvalidReason(result.reason);
          setStatus('invalid');
          return;
        }
        setSubmitError(result.message || 'ไม่สามารถบันทึกรหัสผ่านใหม่ได้ กรุณาลองใหม่อีกครั้ง');
        return;
      }

      setPassword('');
      setConfirmPassword('');
      setStatus('success');
    } catch (err) {
      const errCode = err?.code || err?.reason;
      if (errCode === 'EXPIRED' || errCode === 'USED') {
        setInvalidReason(errCode);
        setStatus('invalid');
        return;
      }
      setSubmitError(err?.message || 'ไม่สามารถบันทึกรหัสผ่านใหม่ได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-white to-violet-50/40 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-[2rem] shadow-[0_20px_60px_rgba(15,23,42,0.08)] border border-slate-100 px-6 sm:px-8 pt-14 pb-8 relative mt-6">
        {/* Floating Shop Logo */}
        <div className="absolute -top-11 left-1/2 -translate-x-1/2 w-22 h-22 rounded-full bg-white p-1.5 shadow-lg border border-slate-100 flex items-center justify-center overflow-hidden">
          {shopInfo?.logo && !logoError ? (
            <img
              src={processImageUrl(shopInfo.logo)}
              alt={shopDisplayName || 'Logo'}
              referrerPolicy="no-referrer"
              onError={() => setLogoError(true)}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <div className="w-full h-full rounded-full theme-logo-bg text-white flex items-center justify-center">
              <KeyRound className="w-8 h-8" />
            </div>
          )}
        </div>

        {/* Centered Header */}
        <div className="text-center">
          <h1 className="text-xl font-extrabold text-slate-900">{shopDisplayName}</h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
            ตั้งค่ารหัสผ่านใหม่ (Set New Password)
          </p>
        </div>

        {/* State 1: Loading */}
        {status === 'loading' && (
          <div className="mt-8 py-8 flex flex-col items-center justify-center text-center gap-3">
            <Loader2 className="w-8 h-8 text-violet-600 animate-spin" />
            <p className="text-sm font-semibold text-slate-600">
              กำลังตรวจสอบลิงก์เปลี่ยนรหัสผ่าน...
            </p>
          </div>
        )}

        {/* State 2: Invalid / Expired / Used */}
        {status === 'invalid' && (
          <div className="mt-6 space-y-5">
            <div
              className={`rounded-2xl p-4 border text-left flex items-start gap-3 ${
                invalidReason === 'EXPIRED'
                  ? 'bg-amber-50/90 border-amber-200/80 text-amber-900'
                  : 'bg-rose-50/90 border-rose-200/80 text-rose-900'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  invalidReason === 'EXPIRED'
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-rose-100 text-rose-600'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-extrabold leading-snug">
                  {getInvalidMessage(invalidReason)}
                </p>
                <p
                  className={`text-xs font-medium leading-relaxed ${
                    invalidReason === 'EXPIRED' ? 'text-amber-700' : 'text-rose-700'
                  }`}
                >
                  กรุณาติดต่อผู้ดูแลระบบเพื่อขอลิงก์เปลี่ยนรหัสผ่านใหม่
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onBackToLogin?.()}
              className="w-full h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm flex items-center justify-center transition active:scale-[0.99] cursor-pointer"
            >
              ← กลับไปหน้าเข้าสู่ระบบ
            </button>
          </div>
        )}

        {/* State 3: Active Form */}
        {status === 'valid' && staffInfo && (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {/* Staff Account Summary & Live Countdown Box */}
            <div className="rounded-2xl bg-slate-50/90 border border-slate-100 p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-white border border-slate-200/80 text-violet-600 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] text-slate-500">บัญชีพนักงาน</div>
                  <div className="text-sm font-extrabold text-slate-900 truncate">
                    {staffInfo.fullName || staffInfo.nickname || staffInfo.username || 'พนักงาน'}
                  </div>
                  {staffInfo.username ? (
                    <div className="text-xs font-semibold text-violet-600 truncate">
                      @{staffInfo.username}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-[11px] text-slate-500 flex items-center justify-end gap-1">
                  <Clock
                    className={`w-3 h-3 ${isUrgent ? 'text-rose-500' : 'text-amber-500'}`}
                  />
                  <span>หมดอายุใน</span>
                </div>
                <div
                  className={`font-extrabold text-base tabular-nums mt-0.5 ${
                    isUrgent ? 'text-rose-600' : 'text-amber-600'
                  }`}
                >
                  {formattedCountdown}
                </div>
              </div>
            </div>

            {/* Password Input 1 */}
            <div>
              <label
                htmlFor="new-password-input"
                className="block text-xs font-bold text-slate-800 mb-1.5"
              >
                รหัสผ่านใหม่ <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="new-password-input"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  disabled={isSubmitting}
                  autoComplete="new-password"
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (submitError) setSubmitError('');
                  }}
                  placeholder="กำหนดรหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)"
                  className="w-full h-11 pl-10 pr-10 rounded-xl bg-white border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((prev) => !prev)}
                  aria-label={showPass ? 'ซ่อนรหัสผ่านใหม่' : 'แสดงรหัสผ่านใหม่'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 transition cursor-pointer"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Password Input 2 */}
            <div>
              <label
                htmlFor="confirm-password-input"
                className="block text-xs font-bold text-slate-800 mb-1.5"
              >
                ยืนยันรหัสผ่านใหม่อีกครั้ง (Re-check) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="confirm-password-input"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  disabled={isSubmitting}
                  autoComplete="new-password"
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (submitError) setSubmitError('');
                  }}
                  placeholder="พิมพ์รหัสผ่านเดิมอีกครั้งเพื่อยืนยัน"
                  className="w-full h-11 pl-10 pr-10 rounded-xl bg-white border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((prev) => !prev)}
                  aria-label={showConfirm ? 'ซ่อนยืนยันรหัสผ่าน' : 'แสดงยืนยันรหัสผ่าน'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 transition cursor-pointer"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Live Validation Checklist Card */}
            <div className="rounded-xl bg-slate-50/80 border border-slate-100 p-3 space-y-1.5 text-xs font-medium">
              <div
                className={`flex items-center gap-2 transition-colors ${
                  isMinLength ? 'text-emerald-700' : 'text-slate-500'
                }`}
              >
                <CheckCircle2
                  className={`w-4 h-4 shrink-0 ${
                    isMinLength ? 'text-emerald-500' : 'text-slate-400'
                  }`}
                />
                <span>ความยาวรหัสผ่านอย่างน้อย 6 ตัวอักษร</span>
              </div>
              <div
                className={`flex items-center gap-2 transition-colors ${
                  isMatching ? 'text-emerald-700' : 'text-slate-500'
                }`}
              >
                <CheckCircle2
                  className={`w-4 h-4 shrink-0 ${
                    isMatching ? 'text-emerald-500' : 'text-slate-400'
                  }`}
                />
                <span>รหัสผ่านทั้งสองช่องต้องตรงกัน</span>
              </div>
            </div>

            {/* Inline Submit Error Banner */}
            {submitError ? (
              <div className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-xs font-bold text-rose-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            ) : null}

            {/* Primary Submit Button */}
            <button
              type="submit"
              disabled={!isMinLength || !isMatching || isSubmitting}
              className="w-full h-12 rounded-xl theme-logo-bg hover:brightness-95 text-white font-bold text-sm flex items-center justify-center gap-2 transition active:scale-[0.99] disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังบันทึกรหัสผ่าน...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>บันทึกรหัสผ่านใหม่</span>
                </>
              )}
            </button>

            {/* Back to Login Link */}
            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => onBackToLogin?.()}
                className="inline-flex items-center justify-center text-xs font-bold text-slate-600 hover:text-slate-900 transition cursor-pointer"
              >
                ← กลับไปหน้าเข้าสู่ระบบ
              </button>
            </div>
          </form>
        )}

        {/* State 4: Success */}
        {status === 'success' && (
          <div className="mt-7 space-y-5 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-extrabold text-slate-900">
                ตั้งค่ารหัสผ่านใหม่สำเร็จ!
              </h2>
              <p className="text-sm font-medium text-slate-500">
                คุณสามารถใช้รหัสผ่านใหม่เข้าสู่ระบบได้ทันที
              </p>
            </div>
            <button
              type="button"
              onClick={() => onBackToLogin?.()}
              className="w-full h-12 rounded-xl theme-logo-bg hover:brightness-95 text-white font-bold text-sm flex items-center justify-center gap-2 transition active:scale-[0.99] cursor-pointer"
            >
              ไปหน้าเข้าสู่ระบบ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
