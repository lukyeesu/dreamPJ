import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ArrowDownToLine,
  ArrowUpFromLine,
  Loader2
} from 'lucide-react';
import Toast from '../common/Toast.jsx';
import { useWarehouseCommandKey } from '../../hooks/useWarehouseCommandKey.js';

/**
 * StockAdjustModal Component
 * Audited stock receive and adjustment modal:
 * - Increases or decreases material quantities with mandatory reason
 * - Sends signed deltaQuantity to backend without client-side clamping
 * - Strictly rejects decimals and non-positive integers
 * - Attaches stable idempotencyKey per action & payload
 * - Prevents double submission via synchronous pending ref
 * - Fully responsive with portal z-[110] and reachable flex footer
 */
export default function StockAdjustModal({
  isOpen = false,
  onClose,
  items = [],
  onAdjustStock,
  isSubmitting = false
}) {
  const [selectedItemId, setSelectedItemId] = useState('');
  const [direction, setDirection] = useState('in'); // 'in' (receive) | 'out' (decrease)
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('supplier_receive');
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

  const selectedItem = items.find((it) => String(it.id) === String(selectedItemId));
  const pending = isSubmitting || isLocalPending;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isPendingRef.current || pending) return;

    if (!selectedItemId) {
      setToastMessage({ type: 'error', text: 'กรุณาเลือกรายการพัสดุ' });
      return;
    }

    const rawQty = String(quantity).trim();
    if (!/^\d+$/.test(rawQty) || Number(rawQty) <= 0) {
      setToastMessage({ type: 'error', text: 'จำนวนต้องเป็นจำนวนเต็มบวกที่มากกว่าศูนย์ (ไม่อนุญาตทศนิยม)' });
      return;
    }
    const parsedQty = Number(rawQty);

    const payload = {
      itemId: selectedItemId,
      direction,
      quantity: parsedQty,
      reason,
      notes: notes.trim()
    };

    const idempotencyKey = getKey('stock_adjust', payload);
    const fullPayload = {
      ...payload,
      idempotencyKey
    };

    isPendingRef.current = true;
    setIsLocalPending(true);

    try {
      if (typeof onAdjustStock !== 'function') throw new Error('Save is unavailable. Please try again.');
      if (onAdjustStock) {
        let callbackFired = false;
        const result = onAdjustStock(fullPayload, () => {
          callbackFired = true;
          clearKey('stock_adjust');
          setSelectedItemId('');
          setQuantity('');
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
            clearKey('stock_adjust');
            setSelectedItemId('');
            setQuantity('');
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
      setToastMessage({ type: 'error', text: err.message || 'บันทึกปรับปรุงสต็อกไม่สำเร็จ' });
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
            <h3 className="text-base sm:text-lg font-bold text-slate-900">รับของเข้า / ปรับปรุงยอดสต็อก</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              บันทึกการเคลื่อนไหวสต็อกจริงพร้อมเหตุผลตรวจสอบได้
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
            {/* Direction Segmented Control */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setDirection('in');
                  setReason('supplier_receive');
                }}
                disabled={pending}
                className={`min-h-[44px] py-2 px-3 rounded-xl text-sm sm:text-sm font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  direction === 'in'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ArrowDownToLine className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="truncate">1. รับของเข้า (+สต็อก)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDirection('out');
                  setReason('damaged');
                }}
                disabled={pending}
                className={`min-h-[44px] py-2 px-3 rounded-xl text-sm sm:text-sm font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  direction === 'out'
                    ? 'bg-rose-50 border-rose-300 text-rose-800'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ArrowUpFromLine className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="truncate">2. ปรับลดยอด (-สต็อก)</span>
              </button>
            </div>

            {/* Item Selector */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                เลือกรายการพัสดุ: <span className="text-rose-600">*</span>
              </label>
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                required
                disabled={pending}
                className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm sm:text-sm text-slate-800 outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
              >
                <option value="">-- เลือกรายการพัสดุ --</option>
                {items
                  .filter((it) => it.item_type !== 'banknote' && it.item_type !== 'task')
                  .map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name} {it.color ? `(สี${it.color})` : ''} - คงเหลือ {it.current_stock || 0} {it.unit}
                    </option>
                  ))}
              </select>
            </div>

            {/* Current Stock Preview */}
            {selectedItem && (
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm flex items-center justify-between">
                <span className="text-slate-500">ยอดคงเหลือในคลังปัจจุบัน:</span>
                <span className="font-bold text-slate-900 font-mono text-sm">
                  {selectedItem.current_stock || 0} {selectedItem.unit || 'ชิ้น'}
                </span>
              </div>
            )}

            {/* Quantity */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                จำนวน ({selectedItem?.unit || 'ชิ้น'}): <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                disabled={pending}
                placeholder="พิมพ์จำนวนเต็มบวก..."
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
              />
            </div>

            {/* Reason */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">เหตุผลในการทำรายการ:</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={pending}
                className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm sm:text-sm text-slate-800 outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
              >
                {direction === 'in' ? (
                  <>
                    <option value="supplier_receive">รับสินค้าใหม่จากซัพพลายเออร์</option>
                    <option value="audit_gain">ตรวจนับสต็อกประจำงวด (พบเกิน)</option>
                    <option value="supplier_return">รับสินค้าคืนจากลูกค้า/ผู้ผลิต</option>
                    <option value="other_in">อื่นๆ</option>
                  </>
                ) : (
                  <>
                    <option value="damaged">ชำรุดเสียหายจากการเก็บรักษา</option>
                    <option value="audit_loss">ตรวจนับสต็อกประจำงวด (พบขาด/หาไม่พบ)</option>
                    <option value="expired">หมดอายุ/เสื่อมสภาพ</option>
                    <option value="other_out">อื่นๆ</option>
                  </>
                )}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">หมายเหตุเพิ่มเติม:</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={pending}
                placeholder="ระบุเลขที่บิลหรือรายละเอียดเพิ่มเติม..."
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
              disabled={pending || !selectedItemId || !quantity}
              className={`min-h-[44px] px-5 py-2 text-white rounded-xl text-sm sm:text-sm font-bold shadow-xs transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5 ${
                direction === 'in' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {pending && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
              <span>{pending ? 'กำลังบันทึก...' : direction === 'in' ? 'ยืนยันรับของเข้า' : 'ยืนยันปรับลดยอด'}</span>
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
