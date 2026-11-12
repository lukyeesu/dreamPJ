import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  QrCode,
  Loader2
} from 'lucide-react';
import Toast from '../common/Toast.jsx';
import { useWarehouseCommandKey } from '../../hooks/useWarehouseCommandKey.js';

/**
 * AddAssetUnitModal Component
 * Adds a new serialized tool unit code (e.g. SC-001, SC-002) for QR label printing and custody.
 * Includes stable idempotencyKey per action and payload.
 * Prevents double submission with synchronous pending ref.
 * Fully responsive portal z-[110] with reachable flex footer.
 */
export default function AddAssetUnitModal({
  isOpen = false,
  onClose,
  targetItem = null,
  items = [],
  onSaveUnit,
  onSearchItems,
  isSubmitting = false
}) {
  const [selectedItemId, setSelectedItemId] = useState('');
  const [unitCode, setUnitCode] = useState('');
  const [notes, setNotes] = useState('');
  const [toastMessage, setToastMessage] = useState(null);
  const [isLocalPending, setIsLocalPending] = useState(false);
  const [search, setSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const hasSearched = useRef(false);
  const searchCallback = useRef(onSearchItems);
  useEffect(() => { searchCallback.current = onSearchItems; }, [onSearchItems]);
  useEffect(() => {
    if (!isOpen || !searchCallback.current) return;
    if (!search && !hasSearched.current) return;
    hasSearched.current = true;
    let active = true;
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try { await searchCallback.current(search); }
      catch (error) { if (active) setToastMessage({type: 'error', text: error.message}); }
      finally { if (active) setIsSearching(false); }
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [isOpen, search]);

  const isPendingRef = useRef(false);
  const previouslyFocusedRef = useRef(null);
  const { getKey, clearKey } = useWarehouseCommandKey();

  // Derive default asset item ID if none manually selected
  const defaultItemId = useMemo(() => {
    if (targetItem?.id) return String(targetItem.id);
    const firstAsset = items.find((it) => it.item_type === 'asset' || it.item_type === 'tool');
    return firstAsset?.id ? String(firstAsset.id) : '';
  }, [targetItem, items]);

  const effectiveItemId = selectedItemId || defaultItemId;

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
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, isLocalPending, onClose]);

  if (!isOpen) return null;

  const pending = isSubmitting || isLocalPending || isSearching;

  const handleClose = () => {
    if (isPendingRef.current || pending) return;
    setSelectedItemId('');
    setUnitCode('');
    setNotes('');
    if (onClose) onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isPendingRef.current || pending) return;

    if (!effectiveItemId) {
      setToastMessage({ type: 'error', text: 'กรุณาเลือกรายการเครื่องมือ' });
      return;
    }
    if (!unitCode.trim()) {
      setToastMessage({ type: 'error', text: 'กรุณาระบุรหัสประจำชิ้น' });
      return;
    }

    const payload = {
      unit_code: unitCode.trim(),
      item_id: effectiveItemId,
      status: 'AVAILABLE',
      notes: notes.trim()
    };

    const actionName = 'asset_unit_add';
    const idempotencyKey = getKey(actionName, payload);
    const fullPayload = {
      ...payload,
      idempotencyKey
    };

    isPendingRef.current = true;
    setIsLocalPending(true);

    try {
      if (typeof onSaveUnit !== 'function') throw new Error('Save is unavailable. Please try again.');
      if (onSaveUnit) {
        let callbackFired = false;
        const result = onSaveUnit(fullPayload, () => {
          callbackFired = true;
          clearKey(actionName);
          setSelectedItemId('');
          setUnitCode('');
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
            setSelectedItemId('');
            setUnitCode('');
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
      setToastMessage({ type: 'error', text: err.message || 'บันทึกรหัสเครื่องมือไม่สำเร็จ' });
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isPendingRef.current && !pending) {
      handleClose();
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
              <QrCode className="w-5 h-5 text-[var(--theme-main,#8b5cf6)]" />
              <span>เพิ่มรหัสประจำชิ้นเครื่องมือ</span>
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              กำหนดรหัสต่อชิ้น แล้วเลือกพิมพ์เป็น QR หรือบาร์โค้ด
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={pending}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-4 sm:p-5 space-y-3.5 flex-1 overflow-y-auto min-w-0">
            {/* Tool Item */}
            <div>
              {onSearchItems && <input type="search" aria-label="ค้นหารายการเครื่องมือ" placeholder="ค้นหาชื่อหรือรหัสเครื่องมือ…" value={search} onChange={e => {setSearch(e.target.value); setSelectedItemId('');}} className="mb-2 w-full min-h-[44px] px-3 border border-slate-200 rounded-xl text-sm" />}
              <label className="block text-sm font-bold text-slate-700 mb-1">
                รายการเครื่องมือ: <span className="text-rose-600">*</span>
              </label>
              <select
                value={effectiveItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                required
                disabled={pending}
                className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm sm:text-sm text-slate-800 outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
              >
                <option value="">-- เลือกรายการเครื่องมือ --</option>
                {items
                  .filter((it) => it.item_type === 'asset' || it.item_type === 'tool')
                  .map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} {it.color ? `(สี${it.color})` : ''} {it.code ? `[${it.code}]` : ''}
                    </option>
                  ))}
              </select>
            </div>

            {/* Unit Code */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                รหัสประจำชิ้น (Unique Unit Code): <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                disabled={pending}
                value={unitCode}
                onChange={(e) => setUnitCode(e.target.value)}
                placeholder="เช่น SC-001, SC-002, DR-001..."
                className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                * รหัสนี้จะถูกแปลงเป็น QR รูปแบบ `F2U:T:{unitCode || '<รหัส>'}` และไม่เปลี่ยนตามผู้ถือ
              </p>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">หมายเหตุ:</label>
              <input
                type="text"
                disabled={pending}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="เช่น ด้ามสีฟ้า สติ๊กเกอร์สีส้ม..."
                className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm sm:text-sm outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
              />
            </div>
          </div>

          {/* Pinned Reachable Footer */}
          <div className="flex items-center justify-end gap-2 p-3 sm:p-4 border-t border-slate-100 bg-slate-50/60 shrink-0">
            <button
              type="button"
              onClick={handleClose}
              disabled={pending}
              className="min-h-[44px] px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm sm:text-sm font-bold hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={pending || !effectiveItemId || !unitCode.trim()}
              className="min-h-[44px] px-5 py-2 bg-[var(--theme-main,#8b5cf6)] hover:bg-[var(--theme-hover,#7c3aed)] text-[var(--theme-on-main,#ffffff)] rounded-xl text-sm sm:text-sm font-bold shadow-xs transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
            >
              {pending && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
              <span>{pending ? 'กำลังบันทึก...' : 'บันทึกรหัสประจำชิ้น'}</span>
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
