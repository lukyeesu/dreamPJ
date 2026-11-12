import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  UserPlus,
  Loader2
} from 'lucide-react';
import Toast from '../common/Toast.jsx';
import { useWarehouseCommandKey } from '../../hooks/useWarehouseCommandKey.js';

/**
 * AddRecipientModal Component
 * Registers new recipients:
 * - Casual helpers (friends/relatives helping with folding/sleeving/production)
 * - Permanent staff members
 * - Installation field teams (with named primary receiver and member list)
 * Confirmed via server RPC with stable idempotencyKey per action and payload.
 * Double-click prevention with synchronous pending ref.
 * Fully responsive portal z-[110] with reachable footer.
 */
export default function AddRecipientModal({
  isOpen = false,
  onClose,
  onAddRecipient,
  isSubmitting = false
}) {
  const [name, setName] = useState('');
  const [recipientType, setRecipientType] = useState('casual_helper'); // 'casual_helper' | 'staff' | 'team'
  const [primaryReceiverName, setPrimaryReceiverName] = useState('');
  const [memberNamesText, setMemberNamesText] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [toastMessage, setToastMessage] = useState(null);
  const [isLocalPending, setIsLocalPending] = useState(false);

  const isPendingRef = useRef(false);
  const previouslyFocusedRef = useRef(null);
  const { getKey, clearKey } = useWarehouseCommandKey();

  // Save and restore focus
  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = typeof document !== 'undefined' ? document.activeElement : null;
    } else if (previouslyFocusedRef.current && previouslyFocusedRef.current.focus) {
      previouslyFocusedRef.current.focus();
    }
  }, [isOpen]);

  // ESC key listener (blocked during active pending)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isPendingRef.current && !isSubmitting && !isLocalPending) {
        if (onClose) onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, isLocalPending, onClose]);

  if (!isOpen) return null;

  const pending = isSubmitting || isLocalPending;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isPendingRef.current || pending) return;

    if (!name.trim()) {
      setToastMessage({ type: 'error', text: 'กรุณาระบุชื่อผู้รับของหรือชื่อทีม' });
      return;
    }

    let actionName = 'create_recipient';
    let payload = null;

    if (recipientType === 'team') {
      if (!primaryReceiverName.trim()) {
        setToastMessage({ type: 'error', text: 'กรุณาระบุชื่อหัวหน้าทีม/ผู้รับของหลัก' });
        return;
      }

      const members = memberNamesText
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean);

      actionName = 'create_team';
      payload = {
        isTeam: true,
        name: name.trim(),
        primaryReceiverName: primaryReceiverName.trim(),
        memberNames: members,
        notes: notes.trim()
      };
    } else {
      actionName = 'create_recipient';
      payload = {
        isTeam: false,
        name: name.trim(),
        recipientType: recipientType === 'staff' ? 'staff' : 'casual_helper',
        contactInfo: phone.trim() ? `${phone.trim()}${notes.trim() ? ` (${notes.trim()})` : ''}` : notes.trim(),
        is_active: true
      };
    }

    const idempotencyKey = getKey(actionName, payload);
    const fullPayload = {
      ...payload,
      idempotencyKey
    };

    isPendingRef.current = true;
    setIsLocalPending(true);

    try {
      if (typeof onAddRecipient !== 'function') throw new Error('Save is unavailable. Please try again.');
      if (onAddRecipient) {
        let callbackFired = false;
        const result = onAddRecipient(fullPayload, () => {
          callbackFired = true;
          clearKey(actionName);
          setName('');
          setPrimaryReceiverName('');
          setMemberNamesText('');
          setPhone('');
          setNotes('');
          isPendingRef.current = false;
          setIsLocalPending(false);
          if (onClose) onClose();
        });

        if (!callbackFired && (!result || typeof result.then !== 'function')) throw new Error('Save did not confirm success');
        if (result && typeof result.then === 'function') {
          const confirmedResult = await result;
          if (confirmedResult?.success === false) throw new Error(confirmedResult.error || 'Save failed');
          if (!callbackFired && isPendingRef.current) {
            clearKey(actionName);
            setName('');
            setPrimaryReceiverName('');
            setMemberNamesText('');
            setPhone('');
            setNotes('');
            isPendingRef.current = false;
            setIsLocalPending(false);
            if (onClose) onClose();
          }
        }
      }
    } catch (err) {
      isPendingRef.current = false;
      setIsLocalPending(false);
      setToastMessage({ type: 'error', text: err.message || 'บันทึกผู้รับของไม่สำเร็จ' });
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isPendingRef.current && !pending) {
      if (onClose) onClose();
    }
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={handleBackdropClick}
    >
      {toastMessage && (
        <Toast
          message={toastMessage.text}
          type={toastMessage.type}
          onClose={() => setToastMessage(null)}
        />
      )}

      <div className="bg-white rounded-2xl max-w-md w-full max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 min-w-0 overflow-hidden">
        {/* Pinned Header */}
        <header className="flex items-start justify-between border-b border-slate-100 p-4 sm:p-5 shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[var(--theme-main,#8b5cf6)]" />
              <span>เพิ่มผู้รับของใหม่</span>
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              ลงทะเบียนผู้ช่วยภายนอก พนักงาน หรือทีมรับผิดชอบของ
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-4 sm:p-5 space-y-3.5 flex-1 overflow-y-auto min-w-0">
            {/* Recipient Type */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">ประเภทผู้รับ:</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'casual_helper', label: 'ผู้ช่วยภายนอก', desc: 'ญาติ/เพื่อนช่วยงาน' },
                  { id: 'staff', label: 'พนักงานประจำ', desc: 'ทีมงานในระบบ' },
                  { id: 'team', label: 'ทีมติดตั้ง', desc: 'กลุ่มปฏิบัติงาน' }
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setRecipientType(t.id)}
                    disabled={pending}
                    className={`min-h-[44px] p-2 rounded-xl text-sm font-bold border transition text-left cursor-pointer ${
                      recipientType === t.id
                        ? 'bg-[var(--theme-light,#ede9fe)] border-[var(--theme-main,#8b5cf6)] text-[var(--theme-ink,#4c1d95)]'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-bold truncate">{t.label}</div>
                    <div className="text-[10px] opacity-75 font-normal mt-0.5 truncate">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                {recipientType === 'team' ? 'ชื่อทีมปฏิบัติงาน:' : 'ชื่อผู้รับของ:'} <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                disabled={pending}
                placeholder={recipientType === 'team' ? 'เช่น ทีมช่างติดตั้ง A' : 'เช่น ป้านิด, พี่เอก...'}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm sm:text-sm text-slate-900 outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
              />
            </div>

            {/* Team specifics */}
            {recipientType === 'team' && (
              <>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    ชื่อผู้รับของหลัก / หัวหน้าทีม: <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={pending}
                    placeholder="เช่น ช่างบอย (ผู้เซ็นรับผิดชอบของ)"
                    value={primaryReceiverName}
                    onChange={(e) => setPrimaryReceiverName(e.target.value)}
                    className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm sm:text-sm text-slate-900 outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    สมาชิกในทีม (คั่นด้วยจุลภาคหรือขึ้นบรรทัดใหม่):
                  </label>
                  <textarea
                    rows={2}
                    disabled={pending}
                    placeholder="เช่น ช่างเอก, ช่างต้อม, ป้านิด"
                    value={memberNamesText}
                    onChange={(e) => setMemberNamesText(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm sm:text-sm outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
                  />
                </div>
              </>
            )}

            {/* Phone (individual only) */}
            {recipientType !== 'team' && (
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">เบอร์โทรศัพท์ (ถ้ามี):</label>
                <input
                  type="tel"
                  disabled={pending}
                  placeholder="เช่น 081-234-5678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm sm:text-sm text-slate-900 outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
                />
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">หมายเหตุเพิ่มเติม:</label>
              <textarea
                rows={2}
                disabled={pending}
                placeholder="เช่น ผู้ช่วยจัดช่อเฉพาะกิจ, ช่างฟรีแลนซ์..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm sm:text-sm outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
              />
            </div>
          </div>

          {/* Pinned Reachable Footer */}
          <div className="flex items-center justify-end gap-2 p-3 sm:p-4 border-t border-slate-100 bg-slate-50/60 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="min-h-[44px] px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm sm:text-sm font-bold hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={pending || !name.trim()}
              className="min-h-[44px] px-5 py-2 bg-[var(--theme-main,#8b5cf6)] hover:bg-[var(--theme-hover,#7c3aed)] text-[var(--theme-on-main,#ffffff)] rounded-xl text-sm sm:text-sm font-bold shadow-xs transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
            >
              {pending && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
              <span>{pending ? 'กำลังบันทึก...' : 'บันทึกผู้รับของ'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
}
