import React, { useState, useEffect } from 'react';
import { ShieldAlert, Clock, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';

export default function BannedUserModal({
  isOpen,
  onClose,
  bannedUntil = null,
  isPermanent = false,
  reason = 'โปรดติดต่อหัวหน้างานหรือผู้ดูแลระบบ'
}) {
  const [timeLeftStr, setTimeLeftStr] = useState('');

  useEffect(() => {
    if (!isOpen || isPermanent || !bannedUntil) {
      setTimeLeftStr('');
      return;
    }

    const updateCountdown = () => {
      const now = new Date().getTime();
      const target = new Date(bannedUntil).getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeftStr('หมดระยะเวลาระงับแล้ว (กรุณาลองเข้าสู่ระบบใหม่อีกครั้ง)');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const parts = [];
      if (days > 0) parts.push(`${days} วัน`);
      if (hours > 0 || days > 0) parts.push(`${hours} ชั่วโมง`);
      parts.push(`${minutes} นาที`);
      parts.push(`${seconds} วินาที`);

      setTimeLeftStr(parts.join(' '));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [isOpen, bannedUntil, isPermanent]);

  if (!isOpen) return null;

  const formattedEndDate = bannedUntil
    ? new Date(bannedUntil).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) + ' น.'
    : null;

  return (
    <div className="fixed inset-0 z-[300] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-md rounded-3xl p-6 sm:p-7 shadow-2xl border border-rose-100 text-center space-y-5 animate-scaleUp">
        {/* Ban Icon Header */}
        <div className="mx-auto w-16 h-16 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center ring-8 ring-rose-50/50 shadow-inner">
          <ShieldAlert className="w-8 h-8 animate-bounce" />
        </div>

        <div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
            isPermanent ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
          }`}>
            <AlertTriangle className="w-3.5 h-3.5" />
            {isPermanent ? 'ระงับการใช้งานถาวร' : 'ระงับการใช้งานชั่วคราว'}
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
            บัญชีผู้ใช้ถูกระงับการใช้งาน
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            ท่านถูกนำออกจากระบบและไม่สามารถเข้าใช้งานได้ในขณะนี้
          </p>
        </div>

        {/* Details Box */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-left space-y-3 text-xs sm:text-sm">
          {!isPermanent && formattedEndDate && (
            <div>
              <span className="text-slate-400 font-bold block text-xs">สิ้นสุดการระงับเมื่อ:</span>
              <span className="font-bold text-slate-800">{formattedEndDate}</span>
            </div>
          )}

          {!isPermanent && timeLeftStr && (
            <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200/60 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <span className="text-xs font-bold text-amber-800 block">ระยะเวลาคงเหลือ:</span>
                <span className="font-black text-amber-900 font-mono text-xs">{timeLeftStr}</span>
              </div>
            </div>
          )}

          <div>
            <span className="text-slate-400 font-bold block text-xs">เหตุผลการระงับ:</span>
            <span className="font-bold text-rose-700 block mt-0.5">
              {reason || 'โปรดติดต่อหัวหน้างานหรือผู้ดูแลระบบเพื่อขอข้อมูลเพิ่มเติม'}
            </span>
          </div>

          <div className="text-xs text-slate-500 pt-2 border-t border-slate-200/60">
            💡 หากต้องการขอเปิดใช้งานบัญชี หรือมีข้อสงสัย กรุณาติดต่อหัวหน้างานหรือผู้ดูแลระบบร้าน
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition shadow-md cursor-pointer text-sm"
        >
          รับทราบ
        </button>
      </div>
    </div>
  );
}
