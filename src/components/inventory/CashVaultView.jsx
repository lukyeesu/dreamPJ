import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Banknote,
  Lock,
  Plus,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Users,
  ShieldCheck,
  Package,
  Layers,
  Send,
  HelpCircle,
  TrendingUp,
  AlertCircle,
  Sliders,
  Unlock,
  ArrowRightLeft,
  X,
  Loader2
} from 'lucide-react';
import * as warehouseService from '../../services/warehouseService.js';
import {
  SUPPORTED_DENOMINATIONS,
  isValidDenomination,
  calculateVaultAvailable,
  calculateCashRestock,
  calculateHelperRemaining,
  calculateDenominationTotalValue
} from '../../utils/warehouse.js';
import Toast from '../common/Toast.jsx';
import ConfirmDialog from '../common/ConfirmDialog.jsx';
import PersonPicker from './PersonPicker.jsx';
import { useWarehouseCommandKey } from '../../hooks/useWarehouseCommandKey.js';

/**
 * CashVaultModal Component
 * Responsive modal wrapper with createPortal to document.body (z-[110])
 * Max height 100dvh, flex container with pinned header, scrollable body, and pinned footer.
 */
function CashVaultModal({
  isOpen,
  onClose,
  title,
  subtitle = null,
  isPending = false,
  maxWidth = 'max-w-md',
  children
}) {
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = typeof document !== 'undefined' ? document.activeElement : null;
    } else if (previouslyFocusedRef.current && previouslyFocusedRef.current.focus) {
      previouslyFocusedRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isPending) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPending, onClose]);

  if (!isOpen) return null;

  const modalJSX = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) {
          onClose();
        }
      }}
    >
      <div className={`bg-white rounded-2xl ${maxWidth} w-full max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 min-w-0 overflow-hidden`}>
        <header className="flex items-start justify-between border-b border-slate-100 p-4 sm:p-5 shrink-0">
          <div>
            <h4 className="text-base sm:text-lg font-bold text-slate-900">{title}</h4>
            {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col min-w-0">
          {children}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' && document.body
    ? createPortal(modalJSX, document.body)
    : modalJSX;
}

/**
 * CashVaultView Component
 * Manages physical banknote reserves and casual helper work batches:
 * - Strict RBAC check (never persisted to IDB/LocalStorage)
 * - Denomination summary grid (20, 50, 100, 500, 1000 Baht)
 * - Restock calculation: max(0, target_available - available)
 * - Multi-helper batch distribution for folding/sleeving banknotes
 * - Prepared sets receipt (does NOT recreate free cash)
 * - Raw unused note return to vault (with keepReservation default true)
 * - Batch handover between casual helpers with explicit acceptance
 * - Project reservation management (reserve & release)
 * - Counted opening cash initialization
 * - Target & alert threshold updates
 */
export default function CashVaultView({
  cashSummary = null,
  isLoading = false,
  error = null,
  errorType = null, // 'permission' | 'migration' | 'network'
  isPrivileged = false,
  activities = [],
  legacyBanknotes = [],
  onDepositCash,
  onRecordCountedOpening,
  onReserveCash,
  onReleaseCashReservation,
  onUpdateCashThresholds,
  onIssueCashBatch,
  onHandoverCashBatch,
  onReceivePreparedCash,
  onReturnUnusedRawCash,
  onDeliverCashToCustomer,
  onAdjustCashCount,
  onRefreshCash
}) {
  const [toastMessage, setToastMessage] = useState(null);

  // Active dialog state: 'deposit' | 'opening' | 'reserve' | 'release' | 'thresholds' | 'issue_batch' | 'handover' | 'receive_prepared' | 'return_raw' | 'deliver' | 'adjust_count'
  const [activeDialog, setActiveDialog] = useState(null);

  // Command key manager for stable request UUIDs across retries
  const { getKey, clearKey } = useWarehouseCommandKey();
  const isPendingRef = useRef(false);

  // Deposit Form
  const [depositDenom, setDepositDenom] = useState(500);
  const [depositCount, setDepositCount] = useState('');
  const [depositNotes, setDepositNotes] = useState('');

  // Counted Opening Form
  const [openingCounts, setOpeningCounts] = useState({ 20: '', 50: '', 100: '', 500: '', 1000: '' });
  const [openingNotes, setOpeningNotes] = useState('');

  // Reserve Form
  const [reserveProjectId, setReserveProjectId] = useState('');
  const [reserveDenom, setReserveDenom] = useState(500);
  const [reserveCount, setReserveCount] = useState('');
  const [reserveNotes, setReserveNotes] = useState('');

  // Release Reservation Form
  const [releaseProjectId, setReleaseProjectId] = useState('');
  const [releaseDenom, setReleaseDenom] = useState(500);
  const [releaseCount, setReleaseCount] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');

  // Update Thresholds Form
  const [thresholdDenom, setThresholdDenom] = useState(100);
  const [lowAlertThreshold, setLowAlertThreshold] = useState('');
  const [targetAvailableCount, setTargetAvailableCount] = useState('');

  // Issue Helper Batch Form (5-10+ helpers per job)
  const [batchProjectId, setBatchProjectId] = useState('');
  const [batchRecipientName, setBatchRecipientName] = useState('');
  const [batchRecipientId, setBatchRecipientId] = useState('');
  const [batchDenom, setBatchDenom] = useState(50);
  const [batchCount, setBatchCount] = useState('');
  const [batchUseReservation, setBatchUseReservation] = useState(false);
  const [batchNotes, setBatchNotes] = useState('');

  // Handover Helper Batch Form
  const [selectedBatchForHandover, setSelectedBatchForHandover] = useState(null);
  const [handoverToRecipientId, setHandoverToRecipientId] = useState('');
  const [handoverToRecipientName, setHandoverToRecipientName] = useState('');
  const [handoverCount, setHandoverCount] = useState('');
  const [handoverAccepted, setHandoverAccepted] = useState(false);
  const [handoverNotes, setHandoverNotes] = useState('');

  // Receive Prepared Form
  const [selectedBatchForReceive, setSelectedBatchForReceive] = useState(null);
  const [preparedCount, setPreparedCount] = useState('');
  const [receiveNotes, setReceiveNotes] = useState('');

  // Return Unused Raw Form
  const [selectedBatchForReturn, setSelectedBatchForReturn] = useState(null);
  const [returnRawCount, setReturnRawCount] = useState('');
  const [keepReservation, setKeepReservation] = useState(true); // Default true
  const [returnRawNotes, setReturnRawNotes] = useState('');

  // Deliver to Customer Form
  const [deliverProjectId, setDeliverProjectId] = useState('');
  const [deliverDenom, setDeliverDenom] = useState(500);
  const [deliverCount, setDeliverCount] = useState('');
  const [deliverNotes, setDeliverNotes] = useState('');

  // Privileged Cash Count Adjustment Form
  const [adjustDenom, setAdjustDenom] = useState(100);
  const [adjustDelta, setAdjustDelta] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  // Submitting state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Strict integer validation (rejects decimals)
  const isStrictPositiveInt = (val) => {
    const s = String(val).trim();
    return /^\d+$/.test(s) && Number(s) > 0;
  };

  const isStrictNonNegativeInt = (val) => {
    const s = String(val).trim();
    return /^\d+$/.test(s) && Number(s) >= 0;
  };

  const isStrictNonZeroInt = (val) => {
    const s = String(val).trim();
    return /^-?\d+$/.test(s) && Number(s) !== 0;
  };

  // Global ESC listener for active dialog
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isPendingRef.current && !isSubmitting) {
        if (activeDialog) setActiveDialog(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDialog, isSubmitting]);

  // Denominations normalized array - declared unconditionally before any early returns
  const denominationsData = useMemo(() => {
    const rawDenoms = cashSummary?.denominations || [];
    return SUPPORTED_DENOMINATIONS.map((d) => {
      const match = rawDenoms.find(r => Number(r.denomination) === d);
      const physical = match ? Number(match.physical_count) || 0 : 0;
      const reserved = match ? Number(match.reserved_count) || 0 : 0;
      const target = match ? Number(match.target_available_count) || 0 : 0;
      const lowAlert = match ? Number(match.low_alert_threshold) || 0 : 0;
      const available = calculateVaultAvailable(physical, reserved);
      const restock = calculateCashRestock(available, target);
      const totalVal = calculateDenominationTotalValue(d, physical);

      return {
        denomination: d,
        physical_count: physical,
        reserved_count: reserved,
        available_count: available,
        target_available_count: target,
        low_alert_threshold: lowAlert,
        restock_needed: restock,
        total_value: totalVal
      };
    });
  }, [cashSummary]);

  // Total cash in vault across all denominations
  const totalVaultBaht = useMemo(() => {
    return denominationsData.reduce((acc, d) => acc + d.total_value, 0);
  }, [denominationsData]);

  // Helper Batches (notes issued to casual helpers for folding/sleeving)
  const helperBatches = useMemo(() => {
    return cashSummary?.helper_batches || [];
  }, [cashSummary]);

  // Reservations
  const reservations = useMemo(() => {
    return cashSummary?.reservations || [];
  }, [cashSummary]);

  // Prepared Sets
  const preparedSets = useMemo(() => {
    return cashSummary?.prepared_sets || [];
  }, [cashSummary]);

  // If user is not privileged, display restricted notice
  if (!isPrivileged) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center max-w-lg mx-auto my-8 shadow-xs">
        <div className="w-14 h-14 bg-rose-50 text-[var(--theme-main,#8b5cf6)] rounded-2xl flex items-center justify-center mx-auto mb-3">
          <Lock className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">พื้นที่จำกัดสิทธิ์ (Restricted Cash Area)</h3>
        <p className="text-sm text-slate-500 mt-1 leading-relaxed">
          ข้อมูลเงินสดและธนบัตรจริงสำหรับชิ้นงานจำกัดการเข้าถึงเฉพาะผู้บริหาร (Admin) และฝ่ายบัญชี (Accountant) ที่ได้รับมอบหมายเท่านั้น
        </p>
        <p className="text-sm text-slate-400 mt-4">
          * การเป็นผู้รับของหรือผู้ช่วยงานไม่ได้รับสิทธิ์เข้าถึงข้อมูลเงินสดของร้านโดยอัตโนมัติ
        </p>
      </div>
    );
  }

  // Handlers (keep form inputs and stable key on error, only reset/close on confirmed success)
  const handleDepositSubmit = async (e) => {
    e.preventDefault();
    if (isPendingRef.current || isSubmitting) return;

    if (!isValidDenomination(depositDenom)) {
      setToastMessage({ type: 'error', text: 'ชนิดธนบัตรไม่ถูกต้อง' });
      return;
    }
    if (!isStrictPositiveInt(depositCount)) {
      setToastMessage({ type: 'error', text: 'กรุณาระบุจำนวนใบเป็นจำนวนเต็มบวกที่มากกว่า 0 (ไม่อนุญาตทศนิยม)' });
      return;
    }

    const count = Number(depositCount);
    const payload = {
      denomination: depositDenom,
      noteCount: count,
      notes: depositNotes.trim()
    };
    const actionName = 'cash_deposit';
    const idempotencyKey = getKey(actionName, payload);
    const fullPayload = { ...payload, idempotencyKey };

    isPendingRef.current = true;
    setIsSubmitting(true);
    try {
      if (typeof onDepositCash !== 'function') throw new Error('Save is unavailable. Please try again.');
      if (onDepositCash) {
        await onDepositCash(fullPayload);
      }
      clearKey(actionName);
      setActiveDialog(null);
      setDepositCount('');
      setDepositNotes('');
      setToastMessage({ type: 'success', text: `บันทึกรับเงินสด ${depositDenom} บาท x ${count} ใบ เข้าคลังเรียบร้อย` });
    } catch (err) {
      setToastMessage({ type: 'error', text: err.message || 'บันทึกฝากเงินไม่สำเร็จ' });
    } finally {
      isPendingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleOpeningSubmit = async (e) => {
    e.preventDefault();
    if (isPendingRef.current || isSubmitting) return;

    const counts = [];
    for (const d of SUPPORTED_DENOMINATIONS) {
      const val = openingCounts[d];
      if (val !== '' && val !== undefined) {
        if (!isStrictNonNegativeInt(val)) {
          setToastMessage({ type: 'error', text: `จำนวนธนบัตร ${d} บาท ต้องเป็นจำนวนเต็มบวกหรือศูนย์ (ไม่อนุญาตทศนิยม)` });
          return;
        }
        counts.push({ denomination: d, note_count: Number(val) });
      }
    }

    if (counts.length === 0) {
      setToastMessage({ type: 'error', text: 'กรุณาระบุจำนวนธนบัตรอย่างน้อย 1 ชนิด' });
      return;
    }

    const payload = {
      counts,
      notes: openingNotes.trim()
    };
    const actionName = 'cash_counted_opening';
    const idempotencyKey = getKey(actionName, payload);
    const fullPayload = { ...payload, idempotencyKey };

    isPendingRef.current = true;
    setIsSubmitting(true);
    try {
      if (typeof onRecordCountedOpening !== 'function') throw new Error('Save is unavailable. Please try again.');
      if (onRecordCountedOpening) {
        await onRecordCountedOpening(fullPayload);
      }
      clearKey(actionName);
      setActiveDialog(null);
      setOpeningCounts({ 20: '', 50: '', 100: '', 500: '', 1000: '' });
      setOpeningNotes('');
      setToastMessage({ type: 'success', text: 'บันทึกยอดนับเปิดคลังเริ่มต้นเรียบร้อย' });
    } catch (err) {
      setToastMessage({ type: 'error', text: err.message || 'บันทึกยอดเปิดคลังไม่สำเร็จ' });
    } finally {
      isPendingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleReserveSubmit = async (e) => {
    e.preventDefault();
    if (isPendingRef.current || isSubmitting) return;

    if (!reserveProjectId) {
      setToastMessage({ type: 'error', text: 'กรุณาเลือกโปรเจกต์งานที่ต้องการจองเงิน' });
      return;
    }
    if (!isStrictPositiveInt(reserveCount)) {
      setToastMessage({ type: 'error', text: 'กรุณาระบุจำนวนใบเป็นจำนวนเต็มบวกที่มากกว่า 0 (ไม่อนุญาตทศนิยม)' });
      return;
    }

    const count = Number(reserveCount);
    const payload = {
      projectId: reserveProjectId,
      denomination: reserveDenom,
      noteCount: count,
      notes: reserveNotes.trim()
    };
    const actionName = 'cash_reserve';
    const idempotencyKey = getKey(actionName, payload);
    const fullPayload = { ...payload, idempotencyKey };

    isPendingRef.current = true;
    setIsSubmitting(true);
    try {
      if (typeof onReserveCash !== 'function') throw new Error('Save is unavailable. Please try again.');
      if (onReserveCash) {
        await onReserveCash(fullPayload);
      }
      clearKey(actionName);
      setActiveDialog(null);
      setReserveCount('');
      setReserveNotes('');
      setToastMessage({ type: 'success', text: `จองธนบัตร ${reserveDenom} บาท x ${count} ใบ ให้งานเรียบร้อย` });
    } catch (err) {
      setToastMessage({ type: 'error', text: err.message || 'การจองเงินสดไม่สำเร็จ' });
    } finally {
      isPendingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleReleaseSubmit = async (e) => {
    e.preventDefault();
    if (isPendingRef.current || isSubmitting) return;

    if (!releaseProjectId) {
      setToastMessage({ type: 'error', text: 'กรุณาเลือกโปรเจกต์งานที่ต้องการปลดการจอง' });
      return;
    }
    if (!isStrictPositiveInt(releaseCount)) {
      setToastMessage({ type: 'error', text: 'กรุณาระบุจำนวนใบเป็นจำนวนเต็มบวกที่มากกว่า 0 (ไม่อนุญาตทศนิยม)' });
      return;
    }

    const count = Number(releaseCount);
    const payload = {
      projectId: releaseProjectId,
      denomination: releaseDenom,
      noteCount: count,
      notes: releaseNotes.trim()
    };
    const actionName = 'cash_release';
    const idempotencyKey = getKey(actionName, payload);
    const fullPayload = { ...payload, idempotencyKey };

    isPendingRef.current = true;
    setIsSubmitting(true);
    try {
      if (typeof onReleaseCashReservation !== 'function') throw new Error('Save is unavailable. Please try again.');
      if (onReleaseCashReservation) {
        await onReleaseCashReservation(fullPayload);
      }
      clearKey(actionName);
      setActiveDialog(null);
      setReleaseCount('');
      setReleaseNotes('');
      setToastMessage({ type: 'success', text: `ปลดการจองธนบัตร ${releaseDenom} บาท x ${count} ใบ คืนสู่ยอดพร้อมเบิกเรียบร้อย` });
    } catch (err) {
      setToastMessage({ type: 'error', text: err.message || 'การปลดการจองไม่สำเร็จ' });
    } finally {
      isPendingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleThresholdsSubmit = async (e) => {
    e.preventDefault();
    if (isPendingRef.current || isSubmitting) return;

    if (!isStrictNonNegativeInt(lowAlertThreshold) || !isStrictNonNegativeInt(targetAvailableCount)) {
      setToastMessage({ type: 'error', text: 'กรุณาระบุเกณฑ์เป็นจำนวนเต็มที่มากกว่าหรือเท่ากับ 0 (ไม่อนุญาตทศนิยม)' });
      return;
    }

    const low = Number(lowAlertThreshold);
    const target = Number(targetAvailableCount);
    const payload = {
      denomination: thresholdDenom,
      lowAlertThreshold: low,
      targetAvailableCount: target
    };
    const actionName = 'cash_thresholds';
    const idempotencyKey = getKey(actionName, payload);
    const fullPayload = { ...payload, idempotencyKey };

    isPendingRef.current = true;
    setIsSubmitting(true);
    try {
      if (typeof onUpdateCashThresholds !== 'function') throw new Error('Save is unavailable. Please try again.');
      if (onUpdateCashThresholds) {
        await onUpdateCashThresholds(fullPayload);
      }
      clearKey(actionName);
      setActiveDialog(null);
      setToastMessage({ type: 'success', text: `อัปเดตเกณฑ์แจ้งเตือนธนบัตร ${thresholdDenom} บาท เรียบร้อย` });
    } catch (err) {
      setToastMessage({ type: 'error', text: err.message || 'อัปเดตเกณฑ์ไม่สำเร็จ' });
    } finally {
      isPendingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleIssueBatchSubmit = async (e) => {
    e.preventDefault();
    if (isPendingRef.current || isSubmitting) return;

    if (!batchProjectId || !batchRecipientName.trim() || !batchRecipientId) {
      setToastMessage({ type: 'error', text: 'กรุณาระบุโปรเจกต์และชื่อผู้ช่วยรับเงิน' });
      return;
    }
    if (!isStrictPositiveInt(batchCount)) {
      setToastMessage({ type: 'error', text: 'กรุณาระบุจำนวนใบเป็นจำนวนเต็มบวกที่มากกว่า 0 (ไม่อนุญาตทศนิยม)' });
      return;
    }

    const count = Number(batchCount);
    const payload = {
      projectId: batchProjectId,
      recipientId: batchRecipientId || null,
      recipientName: batchRecipientName.trim(),
      denomination: batchDenom,
      noteCount: count,
      useReservation: batchUseReservation,
      notes: batchNotes.trim()
    };
    const actionName = 'cash_issue_batch';
    const idempotencyKey = getKey(actionName, payload);
    const fullPayload = { ...payload, idempotencyKey };

    isPendingRef.current = true;
    setIsSubmitting(true);
    try {
      if (typeof onIssueCashBatch !== 'function') throw new Error('Save is unavailable. Please try again.');
      if (onIssueCashBatch) {
        await onIssueCashBatch(fullPayload);
      }
      clearKey(actionName);
      setActiveDialog(null);
      setBatchCount('');
      setBatchNotes('');
      setBatchRecipientId('');
      setBatchRecipientName('');
      setToastMessage({
        type: 'success',
        text: `จ่ายธนบัตร ${batchDenom} บาท x ${count} ใบ ให้ ${batchRecipientName} พับ/ใส่ซองแล้ว`
      });
    } catch (err) {
      setToastMessage({ type: 'error', text: err.message || 'จ่ายธนบัตรไม่สำเร็จ' });
    } finally {
      isPendingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleHandoverBatchSubmit = async (e) => {
    e.preventDefault();
    if (isPendingRef.current || isSubmitting) return;

    if (!selectedBatchForHandover || !handoverToRecipientName.trim() || !handoverToRecipientId) {
      setToastMessage({ type: 'error', text: 'กรุณาระบุผู้รับส่งต่อธนบัตร' });
      return;
    }
    if (!isStrictPositiveInt(handoverCount)) {
      setToastMessage({ type: 'error', text: 'กรุณาระบุจำนวนใบเป็นจำนวนเต็มบวก (ไม่อนุญาตทศนิยม)' });
      return;
    }
    if (!handoverAccepted) {
      setToastMessage({ type: 'error', text: 'ต้องมีเครื่องหมายยืนยันว่าผู้รับปลายทางได้รับเงินแล้ว' });
      return;
    }

    const count = Number(handoverCount);
    const payload = {
      batchId: selectedBatchForHandover.id,
      toRecipientId: handoverToRecipientId || null,
      toRecipientName: handoverToRecipientName.trim(),
      noteCount: count,
      accepted: true,
      notes: handoverNotes.trim()
    };
    const actionName = 'cash_handover_batch';
    const idempotencyKey = getKey(actionName, payload);
    const fullPayload = { ...payload, idempotencyKey };

    isPendingRef.current = true;
    setIsSubmitting(true);
    try {
      if (typeof onHandoverCashBatch !== 'function') throw new Error('Save is unavailable. Please try again.');
      if (onHandoverCashBatch) {
        await onHandoverCashBatch(fullPayload);
      }
      clearKey(actionName);
      setActiveDialog(null);
      setSelectedBatchForHandover(null);
      setHandoverCount('');
      setHandoverNotes('');
      setHandoverToRecipientId('');
      setHandoverToRecipientName('');
      setHandoverAccepted(false);
      setToastMessage({
        type: 'success',
        text: `ส่งต่อธนบัตร ${count} ใบ ให้ ${handoverToRecipientName} เรียบร้อย`
      });
    } catch (err) {
      setToastMessage({ type: 'error', text: err.message || 'ส่งต่อธนบัตรไม่สำเร็จ' });
    } finally {
      isPendingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleReceivePreparedSubmit = async (e) => {
    e.preventDefault();
    if (isPendingRef.current || isSubmitting) return;

    if (!selectedBatchForReceive || !isStrictPositiveInt(preparedCount)) {
      setToastMessage({ type: 'error', text: 'กรุณาระบุจำนวนชุดที่พับ/เตรียมแล้วเป็นจำนวนเต็มบวก (ไม่อนุญาตทศนิยม)' });
      return;
    }

    const count = Number(preparedCount);
    const payload = {
      batchId: selectedBatchForReceive.id,
      noteCount: count,
      notes: receiveNotes.trim()
    };
    const actionName = 'cash_receive_prepared';
    const idempotencyKey = getKey(actionName, payload);
    const fullPayload = { ...payload, idempotencyKey };

    isPendingRef.current = true;
    setIsSubmitting(true);
    try {
      if (typeof onReceivePreparedCash !== 'function') throw new Error('Save is unavailable. Please try again.');
      if (onReceivePreparedCash) {
        await onReceivePreparedCash(fullPayload);
      }
      clearKey(actionName);
      setActiveDialog(null);
      setSelectedBatchForReceive(null);
      setPreparedCount('');
      setReceiveNotes('');
      setToastMessage({
        type: 'success',
        text: `ตรวจรับชุดเงินที่เตรียมแล้ว ${count} ใบ เข้าชุดงานเรียบร้อย (ไม่เพิ่มเงินสดพร้อมเบิก)`
      });
    } catch (err) {
      setToastMessage({ type: 'error', text: err.message || 'ตรวจรับชุดเงินไม่สำเร็จ' });
    } finally {
      isPendingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleReturnRawSubmit = async (e) => {
    e.preventDefault();
    if (isPendingRef.current || isSubmitting) return;

    if (!selectedBatchForReturn || !isStrictPositiveInt(returnRawCount)) {
      setToastMessage({ type: 'error', text: 'กรุณาระบุจำนวนใบที่คืนเป็นจำนวนเต็มบวก (ไม่อนุญาตทศนิยม)' });
      return;
    }

    const count = Number(returnRawCount);
    const payload = {
      batchId: selectedBatchForReturn.id,
      noteCount: count,
      keepReservation,
      notes: returnRawNotes.trim()
    };
    const actionName = 'cash_return_raw';
    const idempotencyKey = getKey(actionName, payload);
    const fullPayload = { ...payload, idempotencyKey };

    isPendingRef.current = true;
    setIsSubmitting(true);
    try {
      if (typeof onReturnUnusedRawCash !== 'function') throw new Error('Save is unavailable. Please try again.');
      if (onReturnUnusedRawCash) {
        await onReturnUnusedRawCash(fullPayload);
      }
      clearKey(actionName);
      setActiveDialog(null);
      setSelectedBatchForReturn(null);
      setReturnRawCount('');
      setReturnRawNotes('');
      setKeepReservation(true); // reset to default true
      setToastMessage({
        type: 'success',
        text: `รับคืนธนบัตรที่ไม่ได้ใช้ ${count} ใบ เข้าตู้นิรภัยเรียบร้อย`
      });
    } catch (err) {
      setToastMessage({ type: 'error', text: err.message || 'คืนเงินสดไม่สำเร็จ' });
    } finally {
      isPendingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleDeliverSubmit = async (e) => {
    e.preventDefault();
    if (isPendingRef.current || isSubmitting) return;

    if (!deliverProjectId) {
      setToastMessage({ type: 'error', text: 'กรุณาเลือกโปรเจกต์งานที่ส่งมอบ' });
      return;
    }
    if (!isValidDenomination(deliverDenom)) {
      setToastMessage({ type: 'error', text: 'ชนิดธนบัตรไม่ถูกต้อง' });
      return;
    }
    if (!isStrictPositiveInt(deliverCount)) {
      setToastMessage({ type: 'error', text: 'กรุณาระบุจำนวนใบที่ส่งมอบเป็นจำนวนเต็มบวก (ไม่อนุญาตทศนิยม)' });
      return;
    }

    const count = Number(deliverCount);
    const payload = {
      projectId: deliverProjectId,
      denomination: deliverDenom,
      noteCount: count,
      notes: deliverNotes.trim()
    };
    const actionName = 'cash_deliver';
    const idempotencyKey = getKey(actionName, payload);
    const fullPayload = { ...payload, idempotencyKey };

    isPendingRef.current = true;
    setIsSubmitting(true);
    try {
      if (typeof onDeliverCashToCustomer === 'function') {
        await onDeliverCashToCustomer(fullPayload);
      } else if (typeof warehouseService.deliverCashToCustomer === 'function') {
        await warehouseService.deliverCashToCustomer(fullPayload);
      }
      clearKey(actionName);
      setActiveDialog(null);
      setDeliverCount('');
      setDeliverNotes('');
      setToastMessage({
        type: 'success',
        text: `ส่งมอบธนบัตร ${deliverDenom} บาท x ${count} ใบ ให้ลูกค้าตามโปรเจกต์เรียบร้อย`
      });
      if (onRefreshCash) onRefreshCash();
    } catch (err) {
      setToastMessage({ type: 'error', text: err.message || 'ส่งมอบเงินให้ลูกค้าไม่สำเร็จ' });
    } finally {
      isPendingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    if (isPendingRef.current || isSubmitting) return;

    if (!isValidDenomination(adjustDenom)) {
      setToastMessage({ type: 'error', text: 'ชนิดธนบัตรไม่ถูกต้อง' });
      return;
    }
    if (!isStrictNonZeroInt(adjustDelta)) {
      setToastMessage({ type: 'error', text: 'กรุณาระบุส่วนต่างจำนวนใบ (+ หรือ -) เป็นจำนวนเต็มที่ไม่เท่ากับ 0 (ไม่อนุญาตทศนิยม)' });
      return;
    }

    const delta = Number(adjustDelta);
    if (!adjustReason.trim()) {
      setToastMessage({ type: 'error', text: 'กรุณาระบุเหตุผลในการปรับปรุงยอดนับจริง (จำเป็นเพื่อการตรวจสอบ)' });
      return;
    }

    const payload = {
      denomination: adjustDenom,
      deltaCount: delta,
      reason: adjustReason.trim()
    };
    const actionName = 'cash_adjust_count';
    const idempotencyKey = getKey(actionName, payload);
    const fullPayload = { ...payload, idempotencyKey };

    isPendingRef.current = true;
    setIsSubmitting(true);
    try {
      if (typeof onAdjustCashCount === 'function') {
        await onAdjustCashCount(fullPayload);
      } else if (typeof warehouseService.adjustCashCount === 'function') {
        await warehouseService.adjustCashCount(fullPayload);
      }
      clearKey(actionName);
      setActiveDialog(null);
      setAdjustDelta('');
      setAdjustReason('');
      setToastMessage({
        type: 'success',
        text: `ปรับยอดตรวจนับธนบัตร ${adjustDenom} บาท (${delta > 0 ? '+' : ''}${delta} ใบ) สำเร็จ`
      });
      if (onRefreshCash) onRefreshCash();
    } catch (err) {
      setToastMessage({ type: 'error', text: err.message || 'ปรับปรุงยอดตรวจนับไม่สำเร็จ' });
    } finally {
      isPendingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4" aria-busy={isLoading}>
      {isLoading && <p role="status" className="text-sm text-slate-600">กำลังโหลดข้อมูลคลังเงิน...</p>}
      {/* Toast Notice */}
      {toastMessage && (
        <Toast
          message={toastMessage.text}
          type={toastMessage.type}
          onClose={() => setToastMessage(null)}
        />
      )}

      {/* Error Banners with Distinct Categorization */}
      {error && (
        <div className={`p-4 rounded-2xl border text-sm flex items-start gap-3 shadow-xs ${
          errorType === 'permission'
            ? 'bg-rose-50 border-rose-200 text-rose-800'
            : errorType === 'migration'
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-slate-50 border-slate-200 text-slate-800'
        }`}>
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-[var(--theme-ink)]" />
          <div className="flex-1">
            <h4 className="font-bold">
              {errorType === 'permission'
                ? 'เซิร์ฟเวอร์ปฏิเสธการเข้าถึงสิทธิ์เงินสด'
                : errorType === 'migration'
                ? 'ยังไม่ได้ติดตั้งระบบเงินสดบนฐานข้อมูล'
                : 'เกิดข้อผิดพลาดในการเชื่อมต่อคลังเงินสด'}
            </h4>
            <p className="text-sm mt-1 leading-relaxed opacity-90">{error}</p>
            {onRefreshCash && (
              <button
                type="button"
                onClick={onRefreshCash}
                className="mt-2 px-3 py-1 bg-white border border-slate-300 rounded-lg text-sm font-bold hover:bg-slate-100 transition cursor-pointer"
              >
                ลองใหม่อีกครั้ง
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top Banner / Actions Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">
            ยอดเงินสดคงคลังทั้งหมด (ตู้นิรภัยร้าน)
          </span>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tabular-nums mt-0.5">
            ฿{totalVaultBaht.toLocaleString('th-TH')}
            <span className="text-sm font-normal text-slate-500 ml-2">บาท</span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            * เงินสดจริง แยกจากการคำนวณต้นทุนวัสดุและไม่บันทึกแคชค้างในเบราว์เซอร์
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setDepositCount('');
              setDepositNotes('');
              setActiveDialog('deposit');
            }}
            className="min-h-[44px] px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-sm sm:text-sm font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <ArrowDownToLine className="w-4 h-4 text-emerald-600" />
            <span>ฝากเงินเข้าคลัง</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setOpeningCounts({ 20: '', 50: '', 100: '', 500: '', 1000: '' });
              setOpeningNotes('');
              setActiveDialog('opening');
            }}
            className="min-h-[44px] px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl text-sm sm:text-sm font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-slate-600" />
            <span>นับยอดเปิดคลัง</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setReserveCount('');
              setReserveNotes('');
              setActiveDialog('reserve');
            }}
            className="min-h-[44px] px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-sm sm:text-sm font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Lock className="w-4 h-4 text-amber-600" />
            <span>จองเงินให้งาน</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setReleaseCount('');
              setReleaseNotes('');
              setActiveDialog('release');
            }}
            className="min-h-[44px] px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-xl text-sm sm:text-sm font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Unlock className="w-4 h-4 text-blue-600" />
            <span>ปลดการจอง</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAdjustDelta('');
              setAdjustReason('');
              setActiveDialog('adjust_count');
            }}
            className="min-h-[44px] px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded-xl text-sm sm:text-sm font-bold flex items-center gap-1.5 transition cursor-pointer"
            title="ปรับปรุงยอดนับจริงกรณีเงินเกิน/ขาด (มีบันทึกตรวจสอบ)"
          >
            <Sliders className="w-4 h-4 text-purple-600" />
            <span>ปรับยอดนับจริง</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setDeliverCount('');
              setDeliverNotes('');
              setActiveDialog('deliver');
            }}
            className="min-h-[44px] px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-xl text-sm sm:text-sm font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>ส่งมอบเงินให้ลูกค้า</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setBatchCount('');
              setBatchNotes('');
              setActiveDialog('issue_batch');
            }}
            className="min-h-[44px] px-4 py-2 bg-[var(--theme-main,#8b5cf6)] hover:bg-[var(--theme-hover,#7c3aed)] text-[var(--theme-on-main,#ffffff)] rounded-xl text-sm sm:text-sm font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>จ่ายให้ผู้ช่วยพับ/ใส่ซอง</span>
          </button>
        </div>
      </div>

      {/* Denominations Grid (Cards matching Plan C warehouse-stock.html) */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Banknote className="w-5 h-5 text-slate-600" />
            <span>ชนิดธนบัตรและเป้าหมายพร้อมเบิก</span>
          </h3>
          <span className="text-sm text-slate-400">
            สูตรพร้อมเบิก: มีอยู่จริง − จองไว้ตามงาน
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {denominationsData.map((d) => (
            <div
              key={d.denomination}
              className="p-3.5 border border-slate-200 rounded-2xl bg-slate-50/50 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-500">
                    ธนบัตร {d.denomination} บาท
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-sm font-bold text-[var(--theme-ink)]">
                      ฿{d.total_value.toLocaleString()}
                    </span>
                    <button
                      type="button"
                      title="ตั้งค่าเกณฑ์เป้าหมายและแจ้งเตือน"
                      onClick={() => {
                        setThresholdDenom(d.denomination);
                        setLowAlertThreshold(String(d.low_alert_threshold));
                        setTargetAvailableCount(String(d.target_available_count));
                        setActiveDialog('thresholds');
                      }}
                      className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-2 space-y-1">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-slate-500">มีอยู่ในตู้:</span>
                    <strong className="font-mono text-slate-800">{d.physical_count} ใบ</strong>
                  </div>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-slate-500">จองให้งาน:</span>
                    <strong className="font-mono text-amber-700">{d.reserved_count} ใบ</strong>
                  </div>
                  <div className="flex items-baseline justify-between text-sm pt-1 border-t border-slate-200">
                    <span className="font-bold text-slate-700">พร้อมเบิกสุทธิ:</span>
                    <strong className="font-mono text-sm font-black text-emerald-700">
                      {d.available_count} ใบ
                    </strong>
                  </div>
                </div>
              </div>

              {/* Target & Restock */}
              <div className="mt-3 pt-2 border-t border-slate-200 text-sm">
                {d.restock_needed > 0 ? (
                  <div className="p-1.5 bg-amber-50 rounded-lg text-amber-900 font-bold flex items-center justify-between">
                    <span>ควรเตรียมเพิ่ม:</span>
                    <span className="font-mono text-amber-800 font-black">
                      +{d.restock_needed} ใบ (฿{(d.restock_needed * d.denomination).toLocaleString()})
                    </span>
                  </div>
                ) : (
                  <span className="text-slate-400 text-sm block text-center">
                    ยอดพร้อมใช้เพียงพอตามเป้า ({d.target_available_count} ใบ)
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Helper Batches Table (Notes given to casual helpers for folding/sleeving) */}
      <section className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <header className="p-4 border-b border-slate-200/90 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              ชุดธนบัตรที่อยู่กับผู้ช่วยพับ/ใส่ซอง (Casual Helper Batches)
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              งานผลิต 1 งานแจกธนบัตรให้ผู้ช่วย 5–10 คนได้ ติดตามแยกผู้รับและการตรวจรับกลับ
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setBatchCount('');
              setBatchNotes('');
              setActiveDialog('issue_batch');
            }}
            className="text-sm font-bold text-[var(--theme-ink)] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>จ่ายชุดเงินใหม่</span>
          </button>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-bold text-sm uppercase border-b border-slate-200">
                <th className="py-3 px-4">ผู้ช่วยรับเงิน</th>
                <th className="py-3 px-4">โปรเจกต์งาน</th>
                <th className="py-3 px-4">ชนิดธนบัตร</th>
                <th className="py-3 px-4">จำนวนที่จ่าย</th>
                <th className="py-3 px-4">ตรวจรับแล้ว</th>
                <th className="py-3 px-4">คงค้างอยู่</th>
                <th className="py-3 px-4 text-right">การกระทำ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {helperBatches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    <ShieldCheck className="w-8 h-8 mx-auto mb-1.5 text-slate-300" />
                    <p className="font-semibold text-slate-600 text-sm">ไม่มีธนบัตรค้างอยู่กับผู้ช่วยในขณะนี้</p>
                    <p className="text-sm text-slate-400 mt-0.5">
                      เมื่อจ่ายเงินให้คนช่วยพับ/ใส่ซอง รายการจะปรากฏที่นี่เพื่อตรวจรับกลับ
                    </p>
                  </td>
                </tr>
              ) : (
                helperBatches.map((batch) => {
                  const issued = Number(batch.issued_count) || 0;
                  const prepared = Number(batch.prepared_count) || 0;
                  const returned = Number(batch.returned_raw_count) || 0;
                  const remaining = calculateHelperRemaining(issued, prepared, returned, 0);

                  return (
                    <tr key={batch.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {batch.recipient_name || batch.recipient_name_snapshot}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600 font-medium">
                        {batch.project_name || batch.project_id || 'งานผลิต'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-sm px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                          {batch.denomination} บาท
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        {issued} ใบ (฿{(issued * batch.denomination).toLocaleString()})
                      </td>
                      <td className="py-3 px-4 font-mono text-emerald-700 font-bold">
                        {prepared} ใบ
                      </td>
                      <td className="py-3 px-4 font-mono text-amber-700 font-black">
                        {remaining} ใบ
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBatchForReceive(batch);
                              setPreparedCount(remaining > 0 ? String(remaining) : '');
                              setReceiveNotes('');
                              setActiveDialog('receive_prepared');
                            }}
                            disabled={remaining <= 0}
                            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-sm font-bold border border-emerald-200 transition disabled:opacity-40 cursor-pointer"
                          >
                            รับชุดพับ
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBatchForReturn(batch);
                              setReturnRawCount(remaining > 0 ? String(remaining) : '');
                              setKeepReservation(true);
                              setReturnRawNotes('');
                              setActiveDialog('return_raw');
                            }}
                            disabled={remaining <= 0}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold transition disabled:opacity-40 cursor-pointer"
                          >
                            คืนเงินสด
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBatchForHandover(batch);
                              setHandoverCount(remaining > 0 ? String(remaining) : '');
                              setHandoverAccepted(false);
                              setHandoverNotes('');
                              setActiveDialog('handover');
                            }}
                            disabled={remaining <= 0}
                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-lg text-sm font-bold border border-indigo-200 transition disabled:opacity-40 cursor-pointer"
                          >
                            ส่งต่อ
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Active Project Reservations Section */}
      {reservations.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <header className="p-4 border-b border-slate-200/90 bg-slate-50/60 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-600" />
              <span>รายการจองเงินสดตามโปรเจกต์งาน (Active Job Reservations)</span>
            </h3>
            <span className="text-sm text-slate-400">
              {reservations.length} รายการจอง
            </span>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold text-sm uppercase border-b border-slate-200">
                  <th className="py-3 px-4">โปรเจกต์งาน</th>
                  <th className="py-3 px-4">ชนิดธนบัตร</th>
                  <th className="py-3 px-4">จำนวนที่จองไว้</th>
                  <th className="py-3 px-4">มูลค่าที่จอง</th>
                  <th className="py-3 px-4 text-right">การกระทำ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reservations.map((res) => (
                  <tr key={res.id || `${res.project_id}-${res.denomination}`} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {res.project_name || res.project_id}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-sm px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                        {res.denomination} บาท
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-amber-700">
                      {res.reserved_count} ใบ
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      ฿{(Number(res.reserved_count) * Number(res.denomination)).toLocaleString()} บาท
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setReleaseProjectId(res.project_id);
                          setReleaseDenom(Number(res.denomination));
                          setReleaseCount(String(res.reserved_count));
                          setReleaseNotes('');
                          setActiveDialog('release');
                        }}
                        className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg text-sm font-bold border border-blue-200 transition cursor-pointer"
                      >
                        ปลดการจอง
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Prepared Sets Ready for Customer Delivery */}
      {preparedSets.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <header className="p-4 border-b border-slate-200/90 bg-slate-50/60 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-600" />
              <span>ชุดธนบัตรพับเสร็จพร้อมส่งมอบลูกค้า (Prepared Cash Sets)</span>
            </h3>
            <span className="text-sm text-slate-400">
              {preparedSets.length} รายการชุดงาน
            </span>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold text-sm uppercase border-b border-slate-200">
                  <th className="py-3 px-4">โปรเจกต์งาน</th>
                  <th className="py-3 px-4">ชื่อชุด / หมายเหตุ</th>
                  <th className="py-3 px-4">ชนิดธนบัตร</th>
                  <th className="py-3 px-4">จำนวนใบ</th>
                  <th className="py-3 px-4">มูลค่ารวม</th>
                  <th className="py-3 px-4 text-right">การกระทำ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preparedSets.map((ps, idx) => (
                  <tr key={ps.id || idx} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {ps.project_name || ps.project_id || 'งานผลิต'}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600">
                      {ps.set_name || ps.notes || 'ชุดธนบัตรพับเสร็จ'}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-sm">
                      {ps.denomination} บาท
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-700">
                      {ps.note_count} ใบ
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      ฿{(Number(ps.note_count) * Number(ps.denomination)).toLocaleString()} บาท
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setDeliverProjectId(ps.project_id);
                          setDeliverDenom(Number(ps.denomination));
                          setDeliverCount(String(ps.note_count));
                          setDeliverNotes(ps.set_name || '');
                          setActiveDialog('deliver');
                        }}
                        className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-sm font-bold border border-emerald-200 transition cursor-pointer"
                      >
                        ส่งมอบลูกค้า
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Read-Only Legacy Banknotes Audit */}
      {legacyBanknotes.length > 0 && (
        <section className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm text-slate-600 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>ประวัติธนบัตรเดิมจากระบบก่อนหน้า (Legacy Banknotes Reconciliation)</span>
            </span>
            <span className="text-slate-400">คงไว้เพื่อการตรวจสอบย้อนหลัง ไม่รวมเป็นยอดเงินสดอัตโนมัติ</span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {legacyBanknotes.map((lb) => (
              <span key={lb.id} className="px-2 py-1 bg-white border border-slate-200 rounded-lg font-mono">
                {lb.name}: <strong>{lb.current_stock}</strong> {lb.unit}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* --- MODAL 1: Deposit Cash Dialog --- */}
      <CashVaultModal
        isOpen={activeDialog === 'deposit'}
        onClose={() => setActiveDialog(null)}
        title="ฝากเงินสดเข้าตู้นิรภัยร้าน"
        subtitle="บันทึกรับเงินที่ถอนจากธนาคารเข้าสู่ยอดคงคลัง"
        isPending={isSubmitting}
      >
        <form onSubmit={handleDepositSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-4 sm:p-5 space-y-3.5 flex-1 overflow-y-auto min-w-0">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">ชนิดธนบัตร:</label>
              <div className="grid grid-cols-5 gap-1.5">
                {SUPPORTED_DENOMINATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDepositDenom(d)}
                    disabled={isSubmitting}
                    className={`min-h-[44px] py-2 rounded-xl text-sm font-mono font-bold border transition text-center cursor-pointer ${
                      depositDenom === d
                        ? 'bg-[var(--theme-main,#8b5cf6)] text-[var(--theme-on-main,#ffffff)] border-[var(--theme-main,#8b5cf6)]'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {d}฿
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                จำนวนใบ (จำนวนเต็มบวก): <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                disabled={isSubmitting}
                placeholder="พิมพ์จำนวนใบที่ฝากเข้า..."
                value={depositCount}
                onChange={(e) => setDepositCount(e.target.value)}
                className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
              />
              <p className="text-sm text-emerald-700 font-bold mt-1">
                มูลค่ารวมหน้าตั๋ว: ฿{(depositDenom * (isStrictPositiveInt(depositCount) ? Number(depositCount) : 0)).toLocaleString()} บาท
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">หมายเหตุ:</label>
              <input
                type="text"
                disabled={isSubmitting}
                value={depositNotes}
                onChange={(e) => setDepositNotes(e.target.value)}
                placeholder="เช่น ถอนจากธนาคารกสิกรไทย..."
                className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm sm:text-sm outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 p-3 sm:p-4 border-t border-slate-100 bg-slate-50/60 shrink-0">
            <button
              type="button"
              onClick={() => setActiveDialog(null)}
              disabled={isSubmitting}
              className="min-h-[44px] px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm sm:text-sm font-bold hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !depositCount}
              className="min-h-[44px] px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm sm:text-sm font-bold shadow-xs transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
              <span>{isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันฝากเงิน'}</span>
            </button>
          </div>
        </form>
      </CashVaultModal>

      {/* --- MODAL 2: Record Counted Opening Cash --- */}
      <CashVaultModal
        isOpen={activeDialog === 'opening'}
        onClose={() => setActiveDialog(null)}
        title="นับยอดเปิดคลังเริ่มต้น (Counted Opening)"
        subtitle="บันทึกจำนวนธนบัตรจริงที่มีอยู่เริ่มต้นครั้งแรก (ไม่สามารถเขียนทับซ้ำได้)"
        maxWidth="max-w-lg"
        isPending={isSubmitting}
      >
        <form onSubmit={handleOpeningSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-4 sm:p-5 space-y-3.5 flex-1 overflow-y-auto min-w-0">
            <div className="space-y-2">
              {SUPPORTED_DENOMINATIONS.map((d) => (
                <div key={d} className="flex items-center justify-between gap-3 p-2.5 bg-slate-50 rounded-xl">
                  <span className="font-bold text-sm sm:text-sm text-slate-700 min-w-[90px]">
                    ธนบัตร {d}฿:
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    disabled={isSubmitting}
                    placeholder="จำนวนใบ"
                    value={openingCounts[d]}
                    onChange={(e) => setOpeningCounts((prev) => ({ ...prev, [d]: e.target.value }))}
                    className="w-28 min-h-[44px] px-2.5 bg-white border border-slate-200 rounded-lg text-right font-mono font-bold text-sm sm:text-sm outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
                  />
                  <span className="text-sm font-mono font-semibold text-slate-500 min-w-[80px] text-right">
                    ฿{(d * (isStrictNonNegativeInt(openingCounts[d]) ? Number(openingCounts[d]) : 0)).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">หมายเหตุ:</label>
              <input
                type="text"
                disabled={isSubmitting}
                value={openingNotes}
                onChange={(e) => setOpeningNotes(e.target.value)}
                placeholder="เช่น ยอดนับตรวจเปิดตู้ครั้งแรก..."
                className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm sm:text-sm outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 p-3 sm:p-4 border-t border-slate-100 bg-slate-50/60 shrink-0">
            <button
              type="button"
              onClick={() => setActiveDialog(null)}
              disabled={isSubmitting}
              className="min-h-[44px] px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm sm:text-sm font-bold hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[44px] px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm sm:text-sm font-bold shadow-xs transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
              <span>{isSubmitting ? 'กำลังบันทึก...' : 'บันทึกยอดเปิดคลัง'}</span>
            </button>
          </div>
        </form>
      </CashVaultModal>

      {/* --- MODAL 3: Reserve Cash Dialog --- */}
      <CashVaultModal
        isOpen={activeDialog === 'reserve'}
        onClose={() => setActiveDialog(null)}
        title="จองธนบัตรให้โปรเจกต์งาน"
        subtitle="กันยอดในตู้ไว้สำหรับงาน ไม่ให้งานอื่นเบิกซ้ำ"
        isPending={isSubmitting}
      >
        <form onSubmit={handleReserveSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-4 sm:p-5 space-y-3.5 flex-1 overflow-y-auto min-w-0">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                โปรเจกต์งาน: <span className="text-rose-600">*</span>
              </label>
              <select
                value={reserveProjectId}
                onChange={(e) => setReserveProjectId(e.target.value)}
                required
                disabled={isSubmitting}
                className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm sm:text-sm text-slate-800 outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
              >
                <option value="">-- เลือกโปรเจกต์งาน --</option>
                {activities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name || a.title || a.id}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">ชนิดธนบัตร:</label>
              <div className="grid grid-cols-5 gap-1.5">
                {SUPPORTED_DENOMINATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setReserveDenom(d)}
                    disabled={isSubmitting}
                    className={`min-h-[44px] py-2 rounded-xl text-sm font-mono font-bold border transition text-center cursor-pointer ${
                      reserveDenom === d
                        ? 'bg-[var(--theme-main,#8b5cf6)] text-[var(--theme-on-main,#ffffff)] border-[var(--theme-main,#8b5cf6)]'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {d}฿
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                จำนวนใบที่จอง: <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                disabled={isSubmitting}
                placeholder="พิมพ์จำนวนใบที่ต้องการจอง..."
                value={reserveCount}
                onChange={(e) => setReserveCount(e.target.value)}
                className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
              />
              <p className="text-sm text-amber-800 font-bold mt-1">
                มูลค่าจองหน้าตั๋ว: ฿{(reserveDenom * (isStrictPositiveInt(reserveCount) ? Number(reserveCount) : 0)).toLocaleString()} บาท
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">หมายเหตุ:</label>
              <input
                type="text"
                disabled={isSubmitting}
                value={reserveNotes}
                onChange={(e) => setReserveNotes(e.target.value)}
                placeholder="เช่น จองทำช่อเงินวันเกิด..."
                className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm sm:text-sm outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 p-3 sm:p-4 border-t border-slate-100 bg-slate-50/60 shrink-0">
            <button
              type="button"
              onClick={() => setActiveDialog(null)}
              disabled={isSubmitting}
              className="min-h-[44px] px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm sm:text-sm font-bold hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !reserveProjectId || !reserveCount}
              className="min-h-[44px] px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm sm:text-sm font-bold shadow-xs transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
              <span>{isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันจองเงิน'}</span>
            </button>
          </div>
        </form>
      </CashVaultModal>

      {/* --- MODAL 4: Release Reservation Dialog --- */}
      <CashVaultModal
        isOpen={activeDialog === 'release'}
        onClose={() => setActiveDialog(null)}
        title="ปลดการจองธนบัตร"
        subtitle="คืนยอดที่จองไว้ให้กลับเป็นเงินสดพร้อมเบิกสำหรับงานอื่น"
        isPending={isSubmitting}
      >
        <form onSubmit={handleReleaseSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-4 sm:p-5 space-y-3.5 flex-1 overflow-y-auto min-w-0">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                โปรเจกต์งาน: <span className="text-rose-600">*</span>
              </label>
              <select
                value={releaseProjectId}
                onChange={(e) => setReleaseProjectId(e.target.value)}
                required
                disabled={isSubmitting}
                className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm sm:text-sm text-slate-800 outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
              >
                <option value="">-- เลือกโปรเจกต์งาน --</option>
                {activities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name || a.title || a.id}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">ชนิดธนบัตร:</label>
              <div className="grid grid-cols-5 gap-1.5">
                {SUPPORTED_DENOMINATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setReleaseDenom(d)}
                    disabled={isSubmitting}
                    className={`min-h-[44px] py-2 rounded-xl text-sm font-mono font-bold border transition text-center cursor-pointer ${
                      releaseDenom === d
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {d}฿
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                จำนวนใบที่ปลด: <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                disabled={isSubmitting}
                placeholder="พิมพ์จำนวนใบที่ต้องการปลด..."
                value={releaseCount}
                onChange={(e) => setReleaseCount(e.target.value)}
                className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
              />
              <p className="text-sm text-blue-700 font-bold mt-1">
                มูลค่าปลดการจอง: ฿{(releaseDenom * (isStrictPositiveInt(releaseCount) ? Number(releaseCount) : 0)).toLocaleString()} บาท
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">หมายเหตุ:</label>
              <input
                type="text"
                disabled={isSubmitting}
                value={releaseNotes}
                onChange={(e) => setReleaseNotes(e.target.value)}
                placeholder="เช่น ลูกค้าเปลี่ยนแบบ ลดจำนวนเงิน..."
                className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm sm:text-sm outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 p-3 sm:p-4 border-t border-slate-100 bg-slate-50/60 shrink-0">
            <button
              type="button"
              onClick={() => setActiveDialog(null)}
              disabled={isSubmitting}
              className="min-h-[44px] px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm sm:text-sm font-bold hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !releaseProjectId || !releaseCount}
              className="min-h-[44px] px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm sm:text-sm font-bold shadow-xs transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
              <span>{isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันปลดการจอง'}</span>
            </button>
          </div>
        </form>
      </CashVaultModal>

      {/* --- MODAL 5: Update Cash Thresholds Dialog --- */}
      <CashVaultModal
        isOpen={activeDialog === 'thresholds'}
        onClose={() => setActiveDialog(null)}
        title={`ตั้งค่าเกณฑ์ธนบัตร ${thresholdDenom} บาท`}
        subtitle="กำหนดเป้าหมายพร้อมเบิกและจุดแจ้งเตือนเงินใกล้หมด"
        isPending={isSubmitting}
      >
        <form onSubmit={handleThresholdsSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-4 sm:p-5 space-y-3.5 flex-1 overflow-y-auto min-w-0">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                เป้าหมายพร้อมเบิก (Target Available Count): <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required
                disabled={isSubmitting}
                placeholder="เช่น 50"
                value={targetAvailableCount}
                onChange={(e) => setTargetAvailableCount(e.target.value)}
                className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
              />
              <p className="text-sm text-slate-500 mt-1">
                ระบบจะคำนวณ restock_needed = max(0, เป้าหมาย − พร้อมเบิกจริง)
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                เกณฑ์แจ้งเตือนเงินต่ำ (Low Alert Threshold): <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required
                disabled={isSubmitting}
                placeholder="เช่น 10"
                value={lowAlertThreshold}
                onChange={(e) => setLowAlertThreshold(e.target.value)}
                className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 p-3 sm:p-4 border-t border-slate-100 bg-slate-50/60 shrink-0">
            <button
              type="button"
              onClick={() => setActiveDialog(null)}
              disabled={isSubmitting}
              className="min-h-[44px] px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm sm:text-sm font-bold hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[44px] px-5 py-2 bg-[var(--theme-main,#8b5cf6)] hover:bg-[var(--theme-hover,#7c3aed)] text-[var(--theme-on-main,#ffffff)] rounded-xl text-sm sm:text-sm font-bold shadow-xs transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
              <span>{isSubmitting ? 'กำลังบันทึก...' : 'บันทึกเกณฑ์'}</span>
            </button>
          </div>
        </form>
      </CashVaultModal>

      {/* --- MODAL 6: Issue Cash Batch to Helper Dialog --- */}
      <CashVaultModal
        isOpen={activeDialog === 'issue_batch'}
        onClose={() => setActiveDialog(null)}
        title="จ่ายเงินสดให้ผู้ช่วยพับ/ใส่ซอง"
        subtitle="แบ่งจ่ายเงินจริงให้ผู้ช่วยเตรียมชิ้นงาน (ตรวจสอบผ่าน PersonPicker)"
        isPending={isSubmitting}
      >
        <form onSubmit={handleIssueBatchSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-4 sm:p-5 space-y-3.5 flex-1 overflow-y-auto min-w-0">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                โปรเจกต์งาน: <span className="text-rose-600">*</span>
              </label>
              <select
                value={batchProjectId}
                onChange={(e) => setBatchProjectId(e.target.value)}
                required
                disabled={isSubmitting}
                className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm sm:text-sm text-slate-800 outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
              >
                <option value="">-- เลือกโปรเจกต์งาน --</option>
                {activities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name || a.title || a.id}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                ผู้ช่วยรับเงิน: <span className="text-rose-600">*</span>
              </label>
              <PersonPicker
                value={batchRecipientId ? { recipient_id: batchRecipientId, name: batchRecipientName } : (batchRecipientName || null)}
                onChange={(sel) => {
                  if (sel) {
                    setBatchRecipientId(sel.recipient_id || sel.recipientId || '');
                    setBatchRecipientName(sel.name || sel.primary_receiver_name || '');
                  } else {
                    setBatchRecipientId('');
                    setBatchRecipientName('');
                  }
                }}
                placeholder="เลือกหรือค้นหาผู้ช่วยรับเงิน (พนักงาน/ผู้ช่วยภายนอก)..."
                allowAddNew={true}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">ชนิดธนบัตร:</label>
              <div className="grid grid-cols-5 gap-1.5">
                {SUPPORTED_DENOMINATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setBatchDenom(d)}
                    disabled={isSubmitting}
                    className={`min-h-[44px] py-2 rounded-xl text-sm font-mono font-bold border transition text-center cursor-pointer ${
                      batchDenom === d
                        ? 'bg-[var(--theme-main,#8b5cf6)] text-[var(--theme-on-main,#ffffff)] border-[var(--theme-main,#8b5cf6)]'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {d}฿
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                จำนวนใบที่จ่าย: <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                disabled={isSubmitting}
                placeholder="พิมพ์จำนวนใบที่จ่ายให้ผู้ช่วย..."
                value={batchCount}
                onChange={(e) => setBatchCount(e.target.value)}
                className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
              />
              <p className="text-sm text-[var(--theme-main,#8b5cf6)] font-bold mt-1">
                มูลค่ารวมหน้าตั๋ว: ฿{(batchDenom * (isStrictPositiveInt(batchCount) ? Number(batchCount) : 0)).toLocaleString()} บาท
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer pt-1 min-h-[44px]">
              <input
                type="checkbox"
                checked={batchUseReservation}
                disabled={isSubmitting}
                onChange={(e) => setBatchUseReservation(e.target.checked)}
                className="w-4 h-4 rounded text-[var(--theme-main,#8b5cf6)] focus:ring-[var(--theme-main,#8b5cf6)]"
              />
              <span>ตัดจากยอดที่เคยจองไว้สำหรับงานนี้ (ถ้ามี)</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 p-3 sm:p-4 border-t border-slate-100 bg-slate-50/60 shrink-0">
            <button
              type="button"
              onClick={() => setActiveDialog(null)}
              disabled={isSubmitting}
              className="min-h-[44px] px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm sm:text-sm font-bold hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !batchProjectId || !batchRecipientName.trim() || !batchCount}
              className="min-h-[44px] px-5 py-2 bg-[var(--theme-main,#8b5cf6)] hover:bg-[var(--theme-hover,#7c3aed)] text-[var(--theme-on-main,#ffffff)] rounded-xl text-sm sm:text-sm font-bold shadow-xs transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
              <span>{isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันจ่ายเงิน'}</span>
            </button>
          </div>
        </form>
      </CashVaultModal>

      {/* --- MODAL 7: Handover Cash Batch to Another Helper --- */}
      <CashVaultModal
        isOpen={activeDialog === 'handover' && Boolean(selectedBatchForHandover)}
        onClose={() => setActiveDialog(null)}
        title="ส่งต่อธนบัตรให้ผู้ช่วยอื่น"
        subtitle={`ส่งต่อจาก: ${selectedBatchForHandover?.recipient_name} (ธนบัตร ${selectedBatchForHandover?.denomination} บาท)`}
        isPending={isSubmitting}
      >
        <form onSubmit={handleHandoverBatchSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-4 sm:p-5 space-y-3.5 flex-1 overflow-y-auto min-w-0">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                ผู้รับส่งต่อปลายทาง: <span className="text-rose-600">*</span>
              </label>
              <PersonPicker
                value={handoverToRecipientId ? { recipient_id: handoverToRecipientId, name: handoverToRecipientName } : (handoverToRecipientName || null)}
                onChange={(sel) => {
                  if (sel) {
                    setHandoverToRecipientId(sel.recipient_id || sel.recipientId || '');
                    setHandoverToRecipientName(sel.name || sel.primary_receiver_name || '');
                  } else {
                    setHandoverToRecipientId('');
                    setHandoverToRecipientName('');
                  }
                }}
                placeholder="เลือกหรือค้นหาผู้รับต่อ (พนักงาน/ผู้ช่วยภายนอก)..."
                allowAddNew={true}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                จำนวนใบที่ส่งต่อ: <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                disabled={isSubmitting}
                placeholder="พิมพ์จำนวนใบที่ส่งต่อ..."
                value={handoverCount}
                onChange={(e) => setHandoverCount(e.target.value)}
                className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
              />
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <label className="flex items-start gap-2 text-sm font-medium text-slate-700 cursor-pointer min-h-[44px]">
                <input
                  type="checkbox"
                  checked={handoverAccepted}
                  disabled={isSubmitting}
                  onChange={(e) => setHandoverAccepted(e.target.checked)}
                  className="w-4 h-4 rounded text-[var(--theme-main,#8b5cf6)] focus:ring-[var(--theme-main,#8b5cf6)] mt-0.5"
                />
                <span>
                  <strong>การยืนยันการรับมอบ (accepted = true):</strong> ข้าพเจ้ายืนยันว่าผู้รับปลายทางได้ตรวจนับธนบัตรจริงและยอมรับการส่งมอบแล้ว
                </span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">หมายเหตุ:</label>
              <input
                type="text"
                disabled={isSubmitting}
                value={handoverNotes}
                onChange={(e) => setHandoverNotes(e.target.value)}
                placeholder="เช่น มอบหมายให้ช่วยพับต่อ..."
                className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm sm:text-sm outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 p-3 sm:p-4 border-t border-slate-100 bg-slate-50/60 shrink-0">
            <button
              type="button"
              onClick={() => setActiveDialog(null)}
              disabled={isSubmitting}
              className="min-h-[44px] px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm sm:text-sm font-bold hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !handoverToRecipientName.trim() || !handoverCount || !handoverAccepted}
              className="min-h-[44px] px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm sm:text-sm font-bold shadow-xs transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
              <span>{isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันส่งต่อ'}</span>
            </button>
          </div>
        </form>
      </CashVaultModal>

      {/* --- MODAL 8: Receive Prepared Cash Dialog --- */}
      <CashVaultModal
        isOpen={activeDialog === 'receive_prepared' && Boolean(selectedBatchForReceive)}
        onClose={() => setActiveDialog(null)}
        title="ตรวจรับชุดธนบัตรที่เตรียมแล้ว"
        subtitle={`รับจาก: ${selectedBatchForReceive?.recipient_name} (ธนบัตร ${selectedBatchForReceive?.denomination} บาท)`}
        isPending={isSubmitting}
      >
        <form onSubmit={handleReceivePreparedSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-4 sm:p-5 space-y-3.5 flex-1 overflow-y-auto min-w-0">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                จำนวนใบที่พับ/ใส่ซองเสร็จแล้ว: <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                disabled={isSubmitting}
                placeholder="พิมพ์จำนวนใบที่พับเสร็จ..."
                value={preparedCount}
                onChange={(e) => setPreparedCount(e.target.value)}
                className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
              />
            </div>

            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 leading-relaxed">
              <strong>หลักความถูกต้อง:</strong> ธนบัตรที่พับหรือใส่ซองเสร็จแล้วจะเปลี่ยนสถานะเป็นชุดงานเตรียมส่งมอบของโปรเจกต์นั้น โดย <strong>ไม่ถูกบวกเป็นเงินสดพร้อมเบิก</strong> ในตู้นิรภัยซ้ำ
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">หมายเหตุ:</label>
              <input
                type="text"
                disabled={isSubmitting}
                value={receiveNotes}
                onChange={(e) => setReceiveNotes(e.target.value)}
                placeholder="เช่น ตรวจนับครบตามจำนวน เรียบร้อย..."
                className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm sm:text-sm outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 p-3 sm:p-4 border-t border-slate-100 bg-slate-50/60 shrink-0">
            <button
              type="button"
              onClick={() => setActiveDialog(null)}
              disabled={isSubmitting}
              className="min-h-[44px] px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm sm:text-sm font-bold hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !preparedCount}
              className="min-h-[44px] px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm sm:text-sm font-bold shadow-xs transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
              <span>{isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันตรวจรับชุดงาน'}</span>
            </button>
          </div>
        </form>
      </CashVaultModal>

      {/* --- MODAL 9: Return Raw Unused Cash Dialog --- */}
      <CashVaultModal
        isOpen={activeDialog === 'return_raw' && Boolean(selectedBatchForReturn)}
        onClose={() => setActiveDialog(null)}
        title="รับคืนเงินสดที่ไม่ได้ใช้เข้าตู้"
        subtitle={`รับจาก: ${selectedBatchForReturn?.recipient_name} (ธนบัตร ${selectedBatchForReturn?.denomination} บาท)`}
        isPending={isSubmitting}
      >
        <form onSubmit={handleReturnRawSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-4 sm:p-5 space-y-3.5 flex-1 overflow-y-auto min-w-0">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                จำนวนใบที่คืนเข้าตู้: <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                disabled={isSubmitting}
                placeholder="พิมพ์จำนวนใบที่คืนเข้าตู้..."
                value={returnRawCount}
                onChange={(e) => setReturnRawCount(e.target.value)}
                className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
              />
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="text-sm font-bold text-slate-700">การจัดการสถานะการจอง:</div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer min-h-[44px]">
                <input
                  type="radio"
                  name="keep_reservation"
                  checked={keepReservation === true}
                  disabled={isSubmitting}
                  onChange={() => setKeepReservation(true)}
                  className="w-4 h-4 text-[var(--theme-main,#8b5cf6)] focus:ring-[var(--theme-main,#8b5cf6)]"
                />
                <span>ยังคงสถานะจองไว้ให้งานนี้ต่อ (ค่าเริ่มต้น — ไม่เพิ่มยอดพร้อมเบิกให้งานอื่น)</span>
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer min-h-[44px]">
                <input
                  type="radio"
                  name="keep_reservation"
                  checked={keepReservation === false}
                  disabled={isSubmitting}
                  onChange={() => setKeepReservation(false)}
                  className="w-4 h-4 text-[var(--theme-main,#8b5cf6)] focus:ring-[var(--theme-main,#8b5cf6)]"
                />
                <span>ปล่อยการจอง คืนเป็นเงินสดพร้อมเบิกให้งานอื่นทันที</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">หมายเหตุ:</label>
              <input
                type="text"
                disabled={isSubmitting}
                value={returnRawNotes}
                onChange={(e) => setReturnRawNotes(e.target.value)}
                placeholder="ระบุเหตุผลที่คืนเงินสด..."
                className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm sm:text-sm outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 p-3 sm:p-4 border-t border-slate-100 bg-slate-50/60 shrink-0">
            <button
              type="button"
              onClick={() => setActiveDialog(null)}
              disabled={isSubmitting}
              className="min-h-[44px] px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm sm:text-sm font-bold hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !returnRawCount}
              className="min-h-[44px] px-5 py-2 bg-[var(--theme-main,#8b5cf6)] hover:bg-[var(--theme-hover,#7c3aed)] text-[var(--theme-on-main,#ffffff)] rounded-xl text-sm sm:text-sm font-bold shadow-xs transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
              <span>{isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันรับคืนเข้าตู้'}</span>
            </button>
          </div>
        </form>
      </CashVaultModal>

      {/* --- MODAL 10: Deliver Cash to Customer Dialog --- */}
      <CashVaultModal
        isOpen={activeDialog === 'deliver'}
        onClose={() => setActiveDialog(null)}
        title="ส่งมอบเงินสดให้ลูกค้าตามโปรเจกต์"
        subtitle="บันทึกส่งมอบชิ้นงานธนบัตร (Prepared Set) ออกจากร้านอย่างเป็นทางการ"
        isPending={isSubmitting}
      >
        <form onSubmit={handleDeliverSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-4 sm:p-5 space-y-3.5 flex-1 overflow-y-auto min-w-0">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                โปรเจกต์งานที่ส่งมอบ: <span className="text-rose-600">*</span>
              </label>
              <select
                value={deliverProjectId}
                onChange={(e) => setDeliverProjectId(e.target.value)}
                disabled={isSubmitting}
                className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm sm:text-sm outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
                required
              >
                <option value="">-- เลือกโปรเจกต์ --</option>
                {activities.map((act) => (
                  <option key={act.id} value={act.id}>
                    {act.id} {act.name || act.title ? `— ${act.name || act.title}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">ชนิดธนบัตร:</label>
              <div className="grid grid-cols-5 gap-1.5">
                {SUPPORTED_DENOMINATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDeliverDenom(d)}
                    disabled={isSubmitting}
                    className={`min-h-[44px] py-2 rounded-xl text-sm font-mono font-bold border transition text-center cursor-pointer ${
                      deliverDenom === d
                        ? 'bg-[var(--theme-main,#8b5cf6)] text-[var(--theme-on-main,#ffffff)] border-[var(--theme-main,#8b5cf6)]'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    ฿{d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                จำนวนใบที่ส่งมอบ: <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                disabled={isSubmitting}
                placeholder="พิมพ์จำนวนใบที่ส่งมอบ..."
                value={deliverCount}
                onChange={(e) => setDeliverCount(e.target.value)}
                className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">หมายเหตุ:</label>
              <input
                type="text"
                disabled={isSubmitting}
                value={deliverNotes}
                onChange={(e) => setDeliverNotes(e.target.value)}
                placeholder="เช่น ส่งมอบชุดช่อดอกไม้ใส่ซองพร้อมใบเสร็จ..."
                className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm sm:text-sm outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 p-3 sm:p-4 border-t border-slate-100 bg-slate-50/60 shrink-0">
            <button
              type="button"
              onClick={() => setActiveDialog(null)}
              disabled={isSubmitting}
              className="min-h-[44px] px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm sm:text-sm font-bold hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !deliverCount}
              className="min-h-[44px] px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm sm:text-sm font-bold shadow-xs transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
              <span>{isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันส่งมอบลูกค้า'}</span>
            </button>
          </div>
        </form>
      </CashVaultModal>

      {/* --- MODAL 11: Adjust Cash Count Dialog (Privileged) --- */}
      <CashVaultModal
        isOpen={activeDialog === 'adjust_count'}
        onClose={() => setActiveDialog(null)}
        title="ปรับปรุงยอดตรวจนับจริง (Count Adjustment)"
        subtitle="สำหรับแก้ไขยอดนับคลังกรณีพบเงินเกิน/ขาด โดยมีประวัติตรวจสอบ"
        isPending={isSubmitting}
      >
        <form onSubmit={handleAdjustSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-4 sm:p-5 space-y-3.5 flex-1 overflow-y-auto min-w-0">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">ชนิดธนบัตร:</label>
              <div className="grid grid-cols-5 gap-1.5">
                {SUPPORTED_DENOMINATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setAdjustDenom(d)}
                    disabled={isSubmitting}
                    className={`min-h-[44px] py-2 rounded-xl text-sm font-mono font-bold border transition text-center cursor-pointer ${
                      adjustDenom === d
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    ฿{d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                ส่วนต่างจำนวนใบ (Delta Count): <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                step="1"
                required
                disabled={isSubmitting}
                placeholder="เช่น +5 หากเงินเกิน, -2 หากเงินขาด..."
                value={adjustDelta}
                onChange={(e) => setAdjustDelta(e.target.value)}
                className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-hidden focus:border-purple-600"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                * ใส่ค่าบวกเพื่อเพิ่มยอด หรือค่าลบเพื่อลดยอดตรวจนับจริง (ไม่อนุญาตทศนิยม)
              </span>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                เหตุผลในการปรับปรุง (Reason): <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                disabled={isSubmitting}
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="เช่น พบธนบัตรตกหล่นหลังตู้ / ปรับยอดตามรายงานตรวจสอบประจำเดือน..."
                className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm sm:text-sm outline-hidden focus:border-purple-600"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 p-3 sm:p-4 border-t border-slate-100 bg-slate-50/60 shrink-0">
            <button
              type="button"
              onClick={() => setActiveDialog(null)}
              disabled={isSubmitting}
              className="min-h-[44px] px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm sm:text-sm font-bold hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !adjustDelta || !adjustReason}
              className="min-h-[44px] px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm sm:text-sm font-bold shadow-xs transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
              <span>{isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันปรับยอดนับจริง'}</span>
            </button>
          </div>
        </form>
      </CashVaultModal>
    </div>
  );
}
