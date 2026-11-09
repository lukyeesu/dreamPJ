import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Clock,
  AlertTriangle,
  X,
  Check,
  Calendar,
  Lock,
  UserX,
  UserCheck
} from 'lucide-react';

const PRESETS = [
  { label: '15 นาที', value: 15, unit: 'minutes' },
  { label: '1 ชั่วโมง', value: 1, unit: 'hours' },
  { label: '24 ชั่วโมง', value: 24, unit: 'hours' },
  { label: '3 วัน', value: 3, unit: 'days' },
  { label: '7 วัน', value: 7, unit: 'days' },
  { label: '30 วัน', value: 30, unit: 'days' },
  { label: '1 ปี', value: 1, unit: 'years' },
  { label: 'ถาวร', value: null, unit: 'permanent' },
  { label: 'กำหนดเอง', value: null, unit: 'custom' }
];

export default function SuspendStaffModal({
  isOpen,
  onClose,
  staff,
  currentUser,
  onConfirmSuspend,
  onConfirmUnban,
  isProcessing = false
}) {
  const [selectedPreset, setSelectedPreset] = useState('24 ชั่วโมง');
  const [customValue, setCustomValue] = useState(1);
  const [customUnit, setCustomUnit] = useState('hours');
  const [reason, setReason] = useState('');

  // Check if target is current logged-in user
  const isSelf = useMemo(() => {
    if (!staff || !currentUser) return false;
    const staffId = staff.id || staff.staff_code;
    const myId = currentUser.staffCode || currentUser.username;
    const staffUser = (staff.username || '').toLowerCase();
    const myUser = (currentUser.username || '').toLowerCase();
    return (staffId && staffId === myId) || (staffUser && staffUser === myUser);
  }, [staff, currentUser]);

  // Is staff currently suspended?
  const isCurrentlyBanned = useMemo(() => {
    if (!staff) return false;
    if (staff.is_banned_permanent) return true;
    if (staff.is_active === false) return true;
    if (staff.banned_until) {
      return new Date(staff.banned_until) > new Date();
    }
    return false;
  }, [staff]);

  // Calculate target banned_until date
  const { computedBannedUntil, isPermanent, summaryText } = useMemo(() => {
    const now = new Date();

    if (selectedPreset === 'ถาวร') {
      return {
        computedBannedUntil: null,
        isPermanent: true,
        summaryText: 'ระงับการใช้งานถาวร (ไม่มีกำหนดเวลาสิ้นสุด)'
      };
    }

    let addMinutes = 0;
    if (selectedPreset === 'กำหนดเอง') {
      const val = Math.max(1, parseInt(customValue, 10) || 1);
      if (customUnit === 'minutes') addMinutes = val;
      else if (customUnit === 'hours') addMinutes = val * 60;
      else if (customUnit === 'days') addMinutes = val * 60 * 24;
      else if (customUnit === 'years') addMinutes = val * 60 * 24 * 365;
    } else {
      const preset = PRESETS.find(p => p.label === selectedPreset);
      if (preset) {
        if (preset.unit === 'minutes') addMinutes = preset.value;
        else if (preset.unit === 'hours') addMinutes = preset.value * 60;
        else if (preset.unit === 'days') addMinutes = preset.value * 60 * 24;
        else if (preset.unit === 'years') addMinutes = preset.value * 60 * 24 * 365;
      }
    }

    const targetDate = new Date(now.getTime() + addMinutes * 60 * 1000);
    const thaiDateStr = targetDate.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) + ' น.';

    return {
      computedBannedUntil: targetDate.toISOString(),
      isPermanent: false,
      summaryText: `ระงับชั่วคราวถึง ${thaiDateStr}`
    };
  }, [selectedPreset, customValue, customUnit]);

  if (!isOpen || !staff) return null;

  const handleApplySuspend = () => {
    if (isSelf) return;
    onConfirmSuspend({
      staffId: staff.id || staff.staff_code,
      username: staff.username,
      bannedUntil: computedBannedUntil,
      isPermanent,
      reason: reason.trim() || 'คำสั่งจากผู้ดูแลระบบ'
    });
  };

  const handleApplyUnban = () => {
    onConfirmUnban({
      staffId: staff.id || staff.staff_code,
      username: staff.username
    });
  };

  return (
    <div className="fixed inset-0 z-[260] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-lg rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5 animate-scaleUp max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              isCurrentlyBanned ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
            }`}>
              {isCurrentlyBanned ? <ShieldAlert className="w-6 h-6" /> : <UserX className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">
                {isCurrentlyBanned ? 'จัดการสถานะระงับผู้ใช้' : 'ระงับการใช้งานพนักงาน'}
              </h3>
              <p className="text-xs text-slate-400">
                เตะผู้ใช้ออกจากระบบทันที และบล็อกการเข้าสู่ระบบ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Staff Profile Strip */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-sm shrink-0">
              {(staff.nickname || staff.name || staff.username || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <span>{staff.name || staff.username}</span>
                {staff.nickname && <span className="text-xs text-slate-500">({staff.nickname})</span>}
              </div>
              <div className="text-xs text-slate-400 font-mono">
                รหัส: {staff.id || staff.staff_code} • @{staff.username}
              </div>
            </div>
          </div>

          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
            isCurrentlyBanned
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}>
            {isCurrentlyBanned ? '⛔ กำลังถูกระงับ' : '🟢 ใช้งานปกติ'}
          </span>
        </div>

        {/* Self-Protection Alert */}
        {isSelf && (
          <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-800 flex items-center gap-2.5 font-bold">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>คุณไม่สามารถระงับบัญชีของตนเองที่กำลังเข้าสู่ระบบอยู่ได้</span>
          </div>
        )}

        {/* If Currently Banned: Quick Unban Action */}
        {isCurrentlyBanned && (
          <div className="p-4 bg-rose-50/70 rounded-2xl border border-rose-100 space-y-3">
            <div className="text-xs text-rose-900 space-y-1">
              <span className="font-bold block">สถานะการระงับในปัจจุบัน:</span>
              <p className="text-slate-600">
                {staff.is_banned_permanent
                  ? 'ระงับการใช้งานถาวร'
                  : staff.banned_until
                  ? `ระงับถึง: ${new Date(staff.banned_until).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                  : 'ปิดการใช้งานบัญชี'}
              </p>
              {staff.ban_reason && (
                <p className="text-xs text-slate-500">เหตุผล: {staff.ban_reason}</p>
              )}
            </div>

            <button
              type="button"
              disabled={isProcessing}
              onClick={handleApplyUnban}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs sm:text-sm transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              <span>ปลดระงับการใช้งานทันที (ให้เข้าสู่ระบบได้)</span>
            </button>
          </div>
        )}

        {/* Ban Duration Form */}
        {!isSelf && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                เลือกระยะเวลาการระงับ (Ban Duration) *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {PRESETS.map((p) => {
                  const isSelected = selectedPreset === p.label;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setSelectedPreset(p.label)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                        isSelected
                          ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Input when 'กำหนดเอง' is selected */}
            {selectedPreset === 'กำหนดเอง' && (
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3 animate-fadeIn">
                <input
                  type="number"
                  min="1"
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  className="w-24 px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  placeholder="จำนวน"
                />
                <select
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 cursor-pointer"
                >
                  <option value="minutes">นาที (Minutes)</option>
                  <option value="hours">ชั่วโมง (Hours)</option>
                  <option value="days">วัน (Days)</option>
                  <option value="years">ปี (Years)</option>
                </select>
              </div>
            )}

            {/* Summary preview */}
            <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-100 flex items-center gap-2 text-xs text-indigo-900 font-bold">
              <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>{summaryText}</span>
            </div>

            {/* Reason input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ระบุเหตุผลการระงับ (จะแสดงให้พนักงานเห็นในหน้าจอแจ้งเตือน)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="เช่น ทำผิดระเบียบร้าน, อยู่ระหว่างตรวจสอบ, พักงาน"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs sm:text-sm transition cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isProcessing || isSelf}
                onClick={handleApplySuspend}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs sm:text-sm transition shadow-md shadow-rose-200 flex items-center justify-center gap-2 cursor-pointer"
              >
                <UserX className="w-4 h-4" />
                <span>ยืนยันระงับ & เตะออก</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
