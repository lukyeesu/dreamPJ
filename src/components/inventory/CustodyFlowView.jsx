import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRightLeft,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  UserCheck,
  User,
  Users,
  Calendar,
  Clock,
  ShieldCheck,
  Package,
  Wrench,
  HelpCircle,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Layers,
  Loader2
} from 'lucide-react';
import ConfirmDialog from '../common/ConfirmDialog.jsx';
import ModernDateTimePicker from '../common/ModernDateTimePicker.jsx';
import Toast from '../common/Toast.jsx';
import PersonPicker from './PersonPicker.jsx';
import { useWarehouseCommandKey } from '../../hooks/useWarehouseCommandKey.js';

/**
 * CustodyFlowView Component
 * Manages the "เบิก–คืน" view:
 * 1. Active tool unit custody & field installation rounds
 * 2. Partial tool return with condition (good / broken / missing) + Thai Labor Sections 76/77 notice
 * 3. Tool handover to named recipient with explicit acceptance
 * 4. Material return with source_issue_movement_id link and remaining returnable cap
 * 5. Reusable material recovery & Real Inspection Queue with inspectRecovery
 * 6. Legacy borrowed units adoption / return via adoptOrReturnLegacyTool
 */
export default function CustodyFlowView({
  assetUnits = [],
  legacyBorrowedUnits = [],
  items = [],
  rounds = [],
  operations = { issue_lines: [], recoveries: [], custodies: [], incidents: [] },
  onReturnTools,
  onHandoverTools,
  onAdoptOrReturnLegacyTool,
  onReturnMaterials,
  onRecoverMaterials,
  onInspectRecovery,
  isSubmitting = false
}) {
  // Sub-tabs: 'tools' | 'rounds' | 'material_return' | 'inspection' | 'legacy_tools'
  const [subTab, setSubTab] = useState('tools');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  // Return Tool Modal state
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [toolToReturn, setToolToReturn] = useState(null);
  const [returnCondition, setReturnCondition] = useState('good'); // 'good' | 'broken' | 'missing'
  const [returnNotes, setReturnNotes] = useState('');
  const [isConfirmIncidentOpen, setIsConfirmIncidentOpen] = useState(false);

  // Handover Tool Modal state
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);
  const [toolToHandover, setToolToHandover] = useState(null);
  const [handoverTargetName, setHandoverTargetName] = useState('');
  const [handoverTargetId, setHandoverTargetId] = useState('');
  const [handoverAccepted, setHandoverAccepted] = useState(true);
  const [handoverNotes, setHandoverNotes] = useState('');

  // Material Return / Recovery Form state
  const [selectedIssueLineId, setSelectedIssueLineId] = useState('');
  const [materialQty, setMaterialQty] = useState(1);
  const [returnType, setReturnType] = useState('unused'); // 'unused' | 'recovery'
  const [inspectNow, setInspectNow] = useState(true);
  const [directGoodQty, setDirectGoodQty] = useState(1);
  const [directDamagedQty, setDirectDamagedQty] = useState(0);
  const [materialNotes, setMaterialNotes] = useState('');

  // Inspection Queue Modal state
  const [inspectingLot, setInspectingLot] = useState(null);
  const [inspectGoodQty, setInspectGoodQty] = useState(1);
  const [inspectDamagedQty, setInspectDamagedQty] = useState(0);

  // Command key manager for stable request UUIDs across retries
  const { getKey, clearKey } = useWarehouseCommandKey();
  const isPendingRef = useRef(false);

  // Items map for quick lookup
  const itemMap = useMemo(() => {
    const map = new Map();
    for (const it of items) map.set(String(it.id), it);
    return map;
  }, [items]);

  // Active borrowed tools (units currently held by someone)
  const activeBorrowedTools = useMemo(() => {
    return assetUnits.filter((u) => {
      const isBorrowed = String(u.status || '').toUpperCase() === 'BORROWED' || Boolean(u.borrowed_by);
      if (!isBorrowed) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const codeMatch = String(u.unit_code || '').toLowerCase().includes(q);
        const holderMatch = String(u.borrowed_by || '').toLowerCase().includes(q);
        const item = itemMap.get(String(u.item_id));
        const itemNameMatch = String(item?.name || '').toLowerCase().includes(q);
        return codeMatch || holderMatch || itemNameMatch;
      }
      return true;
    });
  }, [assetUnits, searchQuery, itemMap]);

  // Active Field Rounds
  const activeFieldRounds = useMemo(() => {
    return rounds.filter(r => r.status !== 'completed' && r.status !== 'cancelled');
  }, [rounds]);

  // Available source issue lines
  const sourceIssueLines = useMemo(() => {
    return operations.issue_lines || [];
  }, [operations.issue_lines]);

  // Pending Recovery Queue
  const pendingRecoveries = useMemo(() => {
    return (operations.recoveries || []).filter(
      r => r.status === 'PENDING' || r.inspect_now === false
    );
  }, [operations.recoveries]);

  // Selected issue line details
  const selectedIssueLine = useMemo(() => {
    return sourceIssueLines.find(l => String(l.id) === String(selectedIssueLineId));
  }, [sourceIssueLines, selectedIssueLineId]);

  // Global ESC listener for open modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isPendingRef.current && !isSubmitting) {
        if (isConfirmIncidentOpen) {
          setIsConfirmIncidentOpen(false);
        } else if (isReturnModalOpen) {
          setIsReturnModalOpen(false);
        } else if (isHandoverModalOpen) {
          setIsHandoverModalOpen(false);
        } else if (inspectingLot) {
          setInspectingLot(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isConfirmIncidentOpen, isReturnModalOpen, isHandoverModalOpen, inspectingLot, isSubmitting]);

  // Return Tool
  const handleOpenReturnModal = (unit) => {
    setToolToReturn(unit);
    setReturnCondition('good');
    setReturnNotes('');
    setIsReturnModalOpen(true);
  };

  const handleConfirmReturn = () => {
    if (!toolToReturn) return;
    if (returnCondition === 'missing' || returnCondition === 'broken') {
      setIsConfirmIncidentOpen(true);
      return;
    }
    executeReturn();
  };

  const executeReturn = async () => {
    if (isPendingRef.current || isSubmitting || !toolToReturn) return;
    setIsConfirmIncidentOpen(false);

    const payload = {
      returns: [
        {
          unit_code: toolToReturn.unit_code,
          condition: returnCondition === 'lost' ? 'missing' : returnCondition,
          notes: returnNotes.trim()
        }
      ]
    };
    const actionName = 'tool_return';
    const idempotencyKey = getKey(actionName, payload);

    isPendingRef.current = true;
    try {
      if (typeof onReturnTools !== 'function') throw new Error('ยังไม่สามารถบันทึกการคืนได้');
      await onReturnTools({
        ...payload,
        idempotencyKey
      }, () => {
        isPendingRef.current = false;
        clearKey(actionName);
        setIsReturnModalOpen(false);
        const unitCode = toolToReturn?.unit_code;
        setToolToReturn(null);
        setToastMessage({ type: 'success', text: `บันทึกรับคืนเครื่องมือ ${unitCode} เรียบร้อยแล้ว` });
      });
    } catch (err) {
      isPendingRef.current = false;
      setToastMessage({ type: 'error', text: err.message || 'บันทึกรับคืนเครื่องมือไม่สำเร็จ' });
    } finally { isPendingRef.current = false; }
  };

  // Handover Tool
  const handleOpenHandoverModal = (unit) => {
    setToolToHandover(unit);
    setHandoverTargetName('');
    setHandoverTargetId('');
    setHandoverAccepted(false);
    setHandoverNotes('');
    setIsHandoverModalOpen(true);
  };

  const handleConfirmHandover = async () => {
    if (isPendingRef.current || isSubmitting) return;
    if (!toolToHandover || !handoverTargetName.trim() || !handoverTargetId || !handoverAccepted) return;

    const payload = {
      unitCodes: [toolToHandover.unit_code],
      toRecipientId: handoverTargetId || null,
      toRecipientName: handoverTargetName.trim(),
      accepted: handoverAccepted,
      notes: handoverNotes.trim()
    };
    const actionName = 'tool_handover';
    const idempotencyKey = getKey(actionName, payload);

    isPendingRef.current = true;
    try {
      if (typeof onHandoverTools !== 'function') throw new Error('ยังไม่สามารถบันทึกการส่งต่อได้');
      await onHandoverTools({
        ...payload,
        idempotencyKey
      }, () => {
        isPendingRef.current = false;
        clearKey(actionName);
        setIsHandoverModalOpen(false);
        const unitCode = toolToHandover?.unit_code;
        const targetName = handoverTargetName;
        setToolToHandover(null);
        setToastMessage({ type: 'success', text: `บันทึกส่งต่อ ${unitCode} ให้ ${targetName} เรียบร้อยแล้ว` });
      });
    } catch (err) {
      isPendingRef.current = false;
      setToastMessage({ type: 'error', text: err.message || 'บันทึกส่งต่อเครื่องมือไม่สำเร็จ' });
    } finally { isPendingRef.current = false; }
  };

  // Return Legacy Tool
  const handleReturnLegacy = async (unitCode) => {
    if (!onAdoptOrReturnLegacyTool || isPendingRef.current || isSubmitting) return;
    const payload = { unitCode, action: 'return_available' };
    const actionName = `legacy_tool_return_${unitCode}`;
    const idempotencyKey = getKey(actionName, payload);

    isPendingRef.current = true;
    try {
      await onAdoptOrReturnLegacyTool({
        ...payload,
        idempotencyKey
      }, () => {
        isPendingRef.current = false;
        clearKey(actionName);
        setToastMessage({ type: 'success', text: `ปรับสถานะเครื่องมือเดิม ${unitCode} เป็นพร้อมใช้แล้ว` });
      });
    } catch (err) {
      isPendingRef.current = false;
      setToastMessage({ type: 'error', text: err.message || 'ปรับสถานะเครื่องมือเดิมไม่สำเร็จ' });
    } finally { isPendingRef.current = false; }
  };

  // Submit Material Return / Recovery
  const handleSubmitMaterialFlow = async (e) => {
    e.preventDefault();
    if (isPendingRef.current || isSubmitting) return;

    const rawQty = String(materialQty).trim();
    if (!/^\d+$/.test(rawQty) || Number(rawQty) <= 0) {
      setToastMessage({ type: 'error', text: 'จำนวนต้องเป็นจำนวนเต็มบวกที่มากกว่าศูนย์ (ไม่อนุญาตทศนิยม)' });
      return;
    }
    const parsedQty = Number(rawQty);

    const sourceId = selectedIssueLine?.source_issue_movement_id || selectedIssueLine?.id || null;
    const itemId = selectedIssueLine?.item_id;
    if (!itemId || !sourceId || !Number.isSafeInteger(parsedQty)) {
      setToastMessage({ type: 'error', text: 'กรุณาเลือกรายการต้นทางก่อนบันทึกคืนหรือเก็บกลับ' });
      return;
    }

    if (returnType === 'unused') {
      const payload = {
        projectId: selectedIssueLine?.project_id || null,
        recipientName: selectedIssueLine?.recipient_name_snapshot || 'ส่งคืนที่คลัง',
        items: [{
          source_issue_movement_id: sourceId,
          item_id: itemId,
          quantity: parsedQty
        }],
        notes: materialNotes.trim()
      };
      const actionName = 'material_return';
      const idempotencyKey = getKey(actionName, payload);

      isPendingRef.current = true;
      try {
        if (typeof onReturnMaterials !== 'function') throw new Error('ยังไม่สามารถบันทึกการคืนได้');
        await onReturnMaterials({
          ...payload,
          idempotencyKey
        }, () => {
          isPendingRef.current = false;
          clearKey(actionName);
          setToastMessage({ type: 'success', text: `รับคืนวัสดุเหลือใช้จำนวน ${parsedQty} ชิ้นเรียบร้อย` });
          setMaterialQty(1);
          setMaterialNotes('');
        });
      } catch (err) {
        isPendingRef.current = false;
        setToastMessage({ type: 'error', text: err.message || 'บันทึกรับคืนวัสดุไม่สำเร็จ' });
      } finally { isPendingRef.current = false; }
    } else {
      // Reusable material recovery
      let good = 0;
      let damaged = 0;
      if (inspectNow) {
        const rawGood = String(directGoodQty).trim();
        const rawDamaged = String(directDamagedQty).trim();
        if (!/^\d+$/.test(rawGood) || !/^\d+$/.test(rawDamaged)) {
          setToastMessage({ type: 'error', text: 'จำนวนของดีและชำรุดต้องเป็นจำนวนเต็มบวกหรือศูนย์ (ไม่อนุญาตทศนิยม)' });
          return;
        }
        good = Number(rawGood);
        damaged = Number(rawDamaged);
        if (good + damaged !== parsedQty) {
          setToastMessage({
            type: 'error',
            text: `ยอดรวมของดี (${good}) + ชำรุด (${damaged}) ต้องเท่ากับยอดที่กู้คืน (${parsedQty})`
          });
          return;
        }
      }

      const payload = {
        projectId: selectedIssueLine?.project_id || null,
        recipientName: selectedIssueLine?.recipient_name_snapshot || 'เก็บกลับจากหน้างาน',
        items: [{
          source_issue_movement_id: sourceId,
          item_id: itemId,
          recovered_qty: parsedQty,
          inspect_now: inspectNow,
          good_qty: inspectNow ? good : 0,
          damaged_qty: inspectNow ? damaged : 0,
          notes: materialNotes.trim()
        }],
        notes: materialNotes.trim()
      };
      const actionName = 'material_recover';
      const idempotencyKey = getKey(actionName, payload);

      isPendingRef.current = true;
      try {
        if (typeof onRecoverMaterials !== 'function') throw new Error('ยังไม่สามารถบันทึกการเก็บกลับได้');
        await onRecoverMaterials({
          ...payload,
          idempotencyKey
        }, () => {
          isPendingRef.current = false;
          clearKey(actionName);
          setToastMessage({
            type: 'success',
            text: inspectNow
              ? `บันทึกวัสดุกู้คืน ${parsedQty} ชิ้น (พร้อมใช้ ${good}) เรียบร้อย`
              : `ส่งวัสดุกู้คืน ${parsedQty} ชิ้นเข้าคิวรอตรวจสภาพเรียบร้อย`
          });
          setMaterialQty(1);
          setMaterialNotes('');
        });
      } catch (err) {
        isPendingRef.current = false;
        setToastMessage({ type: 'error', text: err.message || 'บันทึกกู้คืนวัสดุไม่สำเร็จ' });
      } finally { isPendingRef.current = false; }
    }
  };

  // Inspect Pending Recovery Lot
  const handleConfirmInspect = async () => {
    if (!inspectingLot || isPendingRef.current || isSubmitting) return;

    const rawGood = String(inspectGoodQty).trim();
    const rawDamaged = String(inspectDamagedQty).trim();
    if (!/^\d+$/.test(rawGood) || !/^\d+$/.test(rawDamaged)) {
      setToastMessage({ type: 'error', text: 'จำนวนของดีและชำรุดต้องเป็นจำนวนเต็มบวกหรือศูนย์ (ไม่อนุญาตทศนิยม)' });
      return;
    }
    const good = Number(rawGood);
    const damaged = Number(rawDamaged);

    const sum = good + damaged;
    if (sum !== Number(inspectingLot.recovered_qty)) {
      setToastMessage({
        type: 'error',
        text: `ยอดรวมของดี (${good}) + ชำรุด (${damaged}) ต้องเท่ากับยอดที่กู้คืนมา (${inspectingLot.recovered_qty})`
      });
      return;
    }

    const payload = {
      recoveryId: inspectingLot.id,
      goodQty: good,
      damagedQty: damaged
    };
    const actionName = 'recovery_inspect';
    const idempotencyKey = getKey(actionName, payload);

    isPendingRef.current = true;
    try {
      if (typeof onInspectRecovery !== 'function') throw new Error('ยังไม่สามารถบันทึกการตรวจรับได้');
      await onInspectRecovery({
        ...payload,
        idempotencyKey
      }, () => {
        isPendingRef.current = false;
        clearKey(actionName);
        setToastMessage({ type: 'success', text: `ตรวจรับของดี ${good} ชิ้นเข้าสต็อกพร้อมใช้เรียบร้อย` });
        setInspectingLot(null);
      });
    } catch (err) {
      isPendingRef.current = false;
      setToastMessage({ type: 'error', text: err.message || 'บันทึกตรวจสภาพวัสดุไม่สำเร็จ' });
    } finally { isPendingRef.current = false; }
  };

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <Toast
          message={toastMessage.text}
          type={toastMessage.type}
          onClose={() => setToastMessage(null)}
        />
      )}

      {/* Sub-navigation tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/90 pb-2 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setSubTab('tools')}
          className={`min-h-[44px] px-3.5 py-2 rounded-xl text-sm sm:text-sm font-bold transition whitespace-nowrap cursor-pointer flex items-center ${
            subTab === 'tools'
              ? 'bg-[var(--theme-main)] text-[var(--theme-on-main)] shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          เครื่องมือที่ยืมอยู่ ({activeBorrowedTools.length})
        </button>

        <button
          type="button"
          onClick={() => setSubTab('rounds')}
          className={`min-h-[44px] px-3.5 py-2 rounded-xl text-sm sm:text-sm font-bold transition whitespace-nowrap cursor-pointer flex items-center ${
            subTab === 'rounds'
              ? 'bg-[var(--theme-main)] text-[var(--theme-on-main)] shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          รอบออกงานติดตั้ง ({activeFieldRounds.length})
        </button>

        <button
          type="button"
          onClick={() => setSubTab('material_return')}
          className={`min-h-[44px] px-3.5 py-2 rounded-xl text-sm sm:text-sm font-bold transition whitespace-nowrap cursor-pointer flex items-center ${
            subTab === 'material_return'
              ? 'bg-[var(--theme-main)] text-[var(--theme-on-main)] shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          คืนวัสดุเหลือใช้ / รับวัสดุกลับ
        </button>

        <button
          type="button"
          onClick={() => setSubTab('inspection')}
          className={`min-h-[44px] px-3.5 py-2 rounded-xl text-sm sm:text-sm font-bold transition whitespace-nowrap cursor-pointer flex items-center ${
            subTab === 'inspection'
              ? 'bg-[var(--theme-main)] text-[var(--theme-on-main)] shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          คิวตรวจคัดแยกวัสดุ ({pendingRecoveries.length})
        </button>

        {legacyBorrowedUnits.length > 0 && (
          <button
            type="button"
            onClick={() => setSubTab('legacy_tools')}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl text-sm sm:text-sm font-bold transition whitespace-nowrap cursor-pointer flex items-center ${
              subTab === 'legacy_tools'
                ? 'bg-[var(--theme-main)] text-[var(--theme-on-main)] shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            เครื่องมือเดิมรอปรับสถานะ ({legacyBorrowedUnits.length})
          </button>
        )}
      </div>

      {/* --- SUBTAB 1: Active Borrowed Tools --- */}
      {subTab === 'tools' && (
        <section className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-3.5 border-b border-slate-200/80 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหารหัสเครื่องมือ, ผู้ยืม, หรืองาน..."
                className="w-full min-h-[44px] pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm sm:text-sm outline-hidden focus:border-[var(--theme-main)]"
              />
            </div>
            <p className="text-sm text-slate-500 font-medium">
              แสดง {activeBorrowedTools.length} รายการเครื่องมือที่ยังไม่คืน
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold text-sm uppercase border-b border-slate-200">
                  <th className="py-3 px-4">รหัสประจำชิ้น</th>
                  <th className="py-3 px-4">รายการเครื่องมือ</th>
                  <th className="py-3 px-4">ผู้ถือครองปัจจุบัน</th>
                  <th className="py-3 px-4">โปรเจกต์ / รอบออกงาน</th>
                  <th className="py-3 px-4">วันที่ยืม</th>
                  <th className="py-3 px-4 text-right">การกระทำ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeBorrowedTools.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <ShieldCheck className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
                      <p className="font-semibold text-slate-700 text-sm">ไม่มีเครื่องมือค้างยืมในขณะนี้</p>
                      <p className="text-sm text-slate-400 mt-1">เครื่องมือทุกชิ้นอยู่ในคลังพร้อมใช้งานทั้งหมด</p>
                    </td>
                  </tr>
                ) : (
                  activeBorrowedTools.map((unit) => {
                    const item = itemMap.get(String(unit.item_id));
                    return (
                      <tr key={unit.unit_code} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-mono font-bold text-[var(--theme-ink)]">
                          {unit.unit_code}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 text-sm">{item?.name || 'เครื่องมือ'}</div>
                          {item?.color && <span className="text-sm text-slate-500">สี{item.color}</span>}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-800 text-sm sm:text-sm flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>{unit.borrowed_by || 'ไม่ระบุชื่อ'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600 font-medium">
                          {unit.project_id || 'รอบออกงานทั่วไป'}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-500">
                          {unit.borrowed_at ? new Date(unit.borrowed_at).toLocaleDateString('th-TH') : '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenHandoverModal(unit)}
                              className="min-h-[44px] px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-sm font-bold border border-slate-200 transition cursor-pointer flex items-center"
                            >
                              ส่งต่อ
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenReturnModal(unit)}
                              className="min-h-[44px] px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-sm font-bold border border-emerald-200 transition cursor-pointer flex items-center"
                            >
                              รับคืน
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
      )}

      {/* --- SUBTAB 2: Field Installation Rounds --- */}
      {subTab === 'rounds' && (
        <section className="bg-white border border-slate-200 rounded-2xl shadow-xs p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">
              รอบออกงานติดตั้งและส่งมอบ (Field Installation Rounds)
            </h3>
            <span className="text-sm text-slate-500">
              * เครื่องมือชุดเดียวยืมครั้งเดียว คลุมได้ 15 จุดส่ง ไม่ถูกคืนอัตโนมัติเมื่อจบแต่ละจุด
            </span>
          </div>

          {activeFieldRounds.length === 0 ? (
            <div className="py-10 text-center border-2 border-dashed border-slate-200 rounded-2xl">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-600">ไม่มีรอบออกงานที่กำลังปฏิบัติงาน</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeFieldRounds.map((round) => (
                <div key={round.id || round.round_code} className="p-4 border border-slate-200 rounded-2xl bg-slate-50/60 space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-mono text-sm font-bold px-2 py-0.5 rounded bg-[var(--theme-light)] text-[var(--theme-ink)] border border-rose-100">
                        {round.round_code}
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm mt-1">{round.title || 'รอบออกงาน'}</h4>
                    </div>
                    <span className="text-sm font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      กำลังปฏิบัติงาน
                    </span>
                  </div>

                  <div className="text-sm text-slate-600 space-y-1">
                    <div>ผู้รับผิดชอบหลัก: <strong>{round.recipient_name || '—'}</strong></div>
                    {round.team_members && round.team_members.length > 0 && (
                      <div>สมาชิกทีม: {round.team_members.join(', ')}</div>
                    )}
                    <div>จำนวนจุดส่งในรอบ: <strong>{round.project_ids?.length || 0} จุดงาน</strong></div>
                  </div>

                  {round.unit_codes && round.unit_codes.length > 0 && (
                    <div className="pt-2 border-t border-slate-200">
                      <span className="text-sm font-semibold text-slate-500">เครื่องมือประจำรอบ:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {round.unit_codes.map((code) => (
                          <span key={code} className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-sm font-bold text-slate-800">
                            {code}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* --- SUBTAB 3: Material Return & Recovery Form --- */}
      {subTab === 'material_return' && (
        <section className="bg-white border border-slate-200 rounded-2xl shadow-xs p-4 max-w-2xl space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">บันทึกรับคืนวัสดุเหลือใช้และเก็บกลับ</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              รับวัสดุเหลือใช้คืนสต็อก หรือกู้คืนดอกไม้/พร็อพที่เก็บกลับจากหน้างาน
            </p>
          </div>

          <form onSubmit={handleSubmitMaterialFlow} className="space-y-3.5">
            {/* Flow Type Segmented Tab */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">ประเภทการรับกลับ:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setReturnType('unused')}
                  className={`min-h-[44px] py-2 px-3 rounded-xl text-sm font-bold border transition text-left cursor-pointer ${
                    returnType === 'unused'
                      ? 'bg-[var(--theme-light,#f5f3ff)] border-[var(--theme-main,#8b5cf6)] text-[var(--theme-main,#8b5cf6)]'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  <div className="font-bold">1. คืนวัสดุเหลือใช้ (Unused)</div>
                  <div className="text-sm opacity-75 font-normal">วัสดุที่เบิกไปแล้วไม่ได้ใช้ คืนเข้าสต็อกพร้อมใช้</div>
                </button>

                <button
                  type="button"
                  onClick={() => setReturnType('recovery')}
                  className={`min-h-[44px] py-2 px-3 rounded-xl text-sm font-bold border transition text-left cursor-pointer ${
                    returnType === 'recovery'
                      ? 'bg-[var(--theme-light,#f5f3ff)] border-[var(--theme-main,#8b5cf6)] text-[var(--theme-main,#8b5cf6)]'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  <div className="font-bold">2. กู้คืนวัสดุจากชิ้นงาน (Recovery)</div>
                  <div className="text-sm opacity-75 font-normal">ดอกไม้พลาสติก/พร็อพที่เก็บกลับหลังจบงาน</div>
                </button>
              </div>
            </div>

            {/* Source Issue Movement Link */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                รายการเบิกต้นทาง (เลือกเพื่อคำนวณยอดคืนสะสม):
              </label>
              <select
                value={selectedIssueLineId}
                onChange={(e) => {
                  setSelectedIssueLineId(e.target.value);
                  const line = sourceIssueLines.find(l => String(l.id) === e.target.value);
                  if (line) {
                    setMaterialQty(line.remaining_qty || 1);
                    setDirectGoodQty(line.remaining_qty || 1);
                  }
                }}
                className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm sm:text-sm text-slate-800 outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
              >
                <option value="">-- เลือกรายการเบิกต้นทาง --</option>
                {sourceIssueLines.map((line) => (
                  <option key={line.id} value={line.id}>
                    {line.item_name} {line.color ? `(สี${line.color})` : ''} - เบิกไป {line.issued_qty} (คงเหลือคืนได้ {line.remaining_qty || line.issued_qty} {line.unit})
                  </option>
                ))}
              </select>
            </div>

            {selectedIssueLine && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm space-y-1">
                <div>ผู้รับเดิม: <strong>{selectedIssueLine.recipient_name_snapshot || '—'}</strong></div>
                <div>ยอดที่เบิกไป: <strong>{selectedIssueLine.issued_qty} {selectedIssueLine.unit}</strong></div>
                <div>ยอดคืนได้สูงสุด (Cap): <strong className="text-emerald-700">{selectedIssueLine.remaining_qty || selectedIssueLine.issued_qty} {selectedIssueLine.unit}</strong></div>
              </div>
            )}

            {/* Quantity */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                จำนวนที่รับคืน/เก็บกลับ: <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                min="1"
                max={selectedIssueLine?.remaining_qty || undefined}
                value={materialQty}
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                  setMaterialQty(val);
                  setDirectGoodQty(val);
                }}
                className="w-full min-h-[44px] px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
              />
            </div>

            {/* Inspect Choice for Recovery */}
            {returnType === 'recovery' && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="text-sm font-bold text-slate-700">การตรวจสภาพวัสดุกู้คืน:</div>
                <div className="space-y-1.5">
                  <label className="min-h-[44px] flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="inspect_option"
                      checked={inspectNow}
                      onChange={() => setInspectNow(true)}
                      className="text-[var(--theme-main,#8b5cf6)] focus:ring-[var(--theme-main,#8b5cf6)]"
                    />
                    <span>ตรวจสภาพเรียบร้อยแล้ว เพิ่มเข้าสต็อกพร้อมใช้ทันที</span>
                  </label>

                  {inspectNow && (
                    <div className="grid grid-cols-2 gap-2 pl-6 pt-1">
                      <div>
                        <label className="block text-sm font-semibold text-emerald-800">จำนวนที่ใช้ได้ (ดี):</label>
                        <input
                          type="number"
                          min="0"
                          max={materialQty}
                          value={directGoodQty}
                          onChange={(e) => {
                            const g = Math.max(0, parseInt(e.target.value, 10) || 0);
                            setDirectGoodQty(g);
                            setDirectDamagedQty(Math.max(0, materialQty - g));
                          }}
                          className="w-full min-h-[44px] px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-sm font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-rose-800">จำนวนที่ชำรุด:</label>
                        <input
                          type="number"
                          min="0"
                          max={materialQty}
                          value={directDamagedQty}
                          onChange={(e) => {
                            const d = Math.max(0, parseInt(e.target.value, 10) || 0);
                            setDirectDamagedQty(d);
                            setDirectGoodQty(Math.max(0, materialQty - d));
                          }}
                          className="w-full min-h-[44px] px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-sm font-bold"
                        />
                      </div>
                    </div>
                  )}

                  <label className="min-h-[44px] flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                    <input
                      type="radio"
                      name="inspect_option"
                      checked={!inspectNow}
                      onChange={() => setInspectNow(false)}
                      className="text-[var(--theme-main,#8b5cf6)] focus:ring-[var(--theme-main,#8b5cf6)]"
                    />
                    <span>ยังไม่ได้ตรวจ/คัดแยก ส่งเข้าคิวรอตรวจสภาพก่อน</span>
                  </label>
                </div>
                <p className="text-sm text-slate-500">
                  * ดอกไม้ที่ไม่ได้รับกลับถือว่าใช้ไปกับชิ้นงาน ไม่นับเป็นของหายหรือหนี้พนักงาน
                </p>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">หมายเหตุ:</label>
              <textarea
                rows={2}
                value={materialNotes}
                onChange={(e) => setMaterialNotes(e.target.value)}
                placeholder="ระบุรายละเอียดสภาพของหรือหมายเหตุเพิ่มเติม..."
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || Number(materialQty) <= 0}
              className="w-full min-h-[44px] px-4 py-2 bg-[var(--theme-main,#8b5cf6)] hover:bg-[var(--theme-hover,#7c3aed)] text-[var(--theme-on-main,#ffffff)] rounded-xl text-sm font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันรับวัสดุเข้าคลัง'}
            </button>
          </form>
        </section>
      )}

      {/* --- SUBTAB 4: Real Inspection Queue --- */}
      {subTab === 'inspection' && (
        <section className="bg-white border border-slate-200 rounded-2xl shadow-xs p-4 space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              คิวตรวจคัดแยกวัสดุกู้คืน (Material Inspection Queue)
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              ตรวจนับและแยกของดีเพิ่มเข้าสต็อกพร้อมใช้ ส่วนที่ชำรุดแยกเก็บบันทึกประวัติ
            </p>
          </div>

          {pendingRecoveries.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-1.5" />
              <p className="text-sm font-bold text-slate-600">ไม่มีวัสดุรอตรวจคัดแยก</p>
              <p className="text-sm text-slate-400 mt-0.5">วัสดุกู้คืนทั้งหมดได้รับการตรวจรับเรียบร้อยแล้ว</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {pendingRecoveries.map((lot) => (
                <div key={lot.id} className="p-4 border border-slate-200 rounded-2xl bg-slate-50/60 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{lot.item_name}</h4>
                      <div className="text-sm text-slate-500">
                        {lot.color && <span>สี{lot.color} · </span>}
                        <span>จำนวนกู้คืน: <strong>{lot.recovered_qty} {lot.unit || 'ชิ้น'}</strong></span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-sm font-bold bg-amber-100 text-amber-800">
                      รอคัดแยก
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setInspectingLot(lot);
                        setInspectGoodQty(lot.recovered_qty);
                        setInspectDamagedQty(0);
                      }}
                      className="min-h-[44px] px-3.5 py-1.5 bg-[var(--theme-main)] hover:bg-[var(--theme-hover)] text-[var(--theme-on-main)] rounded-xl text-sm font-bold transition cursor-pointer"
                    >
                      ตรวจคัดแยก
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* --- SUBTAB 5: Legacy Tools Adoption --- */}
      {subTab === 'legacy_tools' && legacyBorrowedUnits.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-2xl shadow-xs p-4 space-y-3">
          <h3 className="text-base font-bold text-slate-900">
            เครื่องมือเดิมที่ค้างยืมจากระบบเดิม (Legacy Borrowed Units)
          </h3>
          <p className="text-sm text-slate-500">
            เครื่องมือที่มีสถานะยืมก่อนติดตั้งระบบ Plan C สามารถปรับเป็นพร้อมใช้ได้ทันที
          </p>

          <div className="divide-y divide-slate-100">
            {legacyBorrowedUnits.map(u => (
              <div key={u.unit_code} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold text-slate-800 text-sm">{u.unit_code}</span>
                  <div className="text-sm text-slate-500">ผู้ยืมเดิม: {u.borrowed_by || '—'}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleReturnLegacy(u.unit_code)}
                  className="min-h-[44px] px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-sm font-bold border border-emerald-200 cursor-pointer"
                >
                  รับคืนเข้าคลัง (Legacy)
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* --- CONFIRM DIALOG FOR LOSS / DAMAGE --- */}
      <ConfirmDialog
        isOpen={isConfirmIncidentOpen}
        title={`ยืนยันบันทึกเครื่องมือ${returnCondition === 'missing' ? 'สูญหาย' : 'ชำรุด'}`}
        message={`ต้องการบันทึกสถานะของ ${toolToReturn?.unit_code} เป็น "${returnCondition === 'missing' ? 'สูญหาย' : 'ชำรุด'}" ใช่หรือไม่? ระบบจะแยกรายการเพื่อเปิดการตรวจสอบและไม่หักค่าจ้างอัตโนมัติ`}
        confirmText="ยืนยันบันทึก"
        cancelText="กลับไปแก้ไข"
        type={returnCondition === 'missing' ? 'danger' : 'warning'}
        onConfirm={executeReturn}
        onCancel={() => setIsConfirmIncidentOpen(false)}
      />

      {/* --- MODAL 1: Return Tool Dialog --- */}
      {isReturnModalOpen && toolToReturn && (() => {
        const returnModalJSX = (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isPendingRef.current && !isSubmitting) {
                setIsReturnModalOpen(false);
              }
            }}
          >
            <div className="bg-white rounded-2xl max-w-md w-full max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 min-w-0 overflow-hidden">
              <header className="flex items-start justify-between border-b border-slate-100 p-4 sm:p-5 shrink-0">
                <div>
                  <h4 className="text-base sm:text-lg font-bold text-slate-900">รับคืนเครื่องมือ {toolToReturn.unit_code}</h4>
                  <p className="text-sm text-slate-500 mt-0.5">
                    ผู้ถือครอง: <strong>{toolToReturn.borrowed_by || 'ไม่ระบุ'}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsReturnModalOpen(false)}
                  disabled={isPendingRef.current || isSubmitting}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer disabled:opacity-40"
                >
                  ✕
                </button>
              </header>

              <div className="p-4 sm:p-5 space-y-3.5 flex-1 overflow-y-auto min-w-0">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">สภาพเครื่องมือที่รับคืน:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'good', label: 'สมบูรณ์ (พร้อมใช้)', color: 'text-emerald-700 border-emerald-300 bg-emerald-50' },
                      { id: 'broken', label: 'ชำรุด (ส่งซ่อม)', color: 'text-amber-800 border-amber-300 bg-amber-50' },
                      { id: 'missing', label: 'สูญหาย / หาไม่พบ', color: 'text-rose-700 border-rose-300 bg-rose-50' }
                    ].map((cond) => (
                      <button
                        key={cond.id}
                        type="button"
                        onClick={() => setReturnCondition(cond.id)}
                        disabled={isPendingRef.current || isSubmitting}
                        className={`min-h-[44px] p-2 rounded-xl text-sm font-bold border transition text-center cursor-pointer flex flex-col items-center justify-center ${
                          returnCondition === cond.id
                            ? cond.color + ' ring-2 ring-offset-1 ring-slate-400'
                            : 'bg-white border-slate-200 text-slate-600'
                        }`}
                      >
                        <span>{cond.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">หมายเหตุสภาพ / เหตุผล:</label>
                  <textarea
                    rows={2}
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    disabled={isPendingRef.current || isSubmitting}
                    placeholder="ระบุอาการชำรุดหรือสถานที่ที่พบ..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm sm:text-sm outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
                  />
                </div>

                {returnCondition !== 'good' && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900 leading-relaxed">
                    <strong>ข้อกำหนดความรับผิดชอบ:</strong> การบันทึกชำรุดหรือสูญหายเป็นการเปิดบันทึกเพื่อตรวจสอบข้อเท็จจริง ไม่มีการเฉลี่ยหักเงินทีมหรือค่าจ้างโดยอัตโนมัติ (ตาม พ.ร.บ. คุ้มครองแรงงาน ม.76/77)
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 p-3 sm:p-4 border-t border-slate-100 bg-slate-50/60 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsReturnModalOpen(false)}
                  disabled={isPendingRef.current || isSubmitting}
                  className="min-h-[44px] px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm sm:text-sm font-bold hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReturn}
                  disabled={isPendingRef.current || isSubmitting}
                  className="min-h-[44px] px-5 py-2 bg-[var(--theme-main,#8b5cf6)] hover:bg-[var(--theme-hover,#7c3aed)] text-[var(--theme-on-main,#ffffff)] rounded-xl text-sm sm:text-sm font-bold transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {(isPendingRef.current || isSubmitting) && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
                  <span>{isPendingRef.current || isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันรับคืน'}</span>
                </button>
              </div>
            </div>
          </div>
        );
        return typeof document !== 'undefined' && document.body ? createPortal(returnModalJSX, document.body) : returnModalJSX;
      })()}

      {/* --- MODAL 2: Handover Tool Dialog --- */}
      {isHandoverModalOpen && toolToHandover && (() => {
        const handoverModalJSX = (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isPendingRef.current && !isSubmitting) {
                setIsHandoverModalOpen(false);
              }
            }}
          >
            <div className="bg-white rounded-2xl max-w-md w-full max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 min-w-0 overflow-hidden">
              <header className="flex items-start justify-between border-b border-slate-100 p-4 sm:p-5 shrink-0">
                <div>
                  <h4 className="text-base sm:text-lg font-bold text-slate-900">ส่งต่อเครื่องมือ {toolToHandover.unit_code}</h4>
                  <p className="text-sm text-slate-500 mt-0.5">
                    ส่งต่อจาก: <strong>{toolToHandover.borrowed_by || 'ไม่ระบุ'}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHandoverModalOpen(false)}
                  disabled={isPendingRef.current || isSubmitting}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer disabled:opacity-40"
                >
                  ✕
                </button>
              </header>

              <div className="p-4 sm:p-5 space-y-3.5 flex-1 overflow-y-auto min-w-0">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    เลือกผู้รับต่อ: <span className="text-rose-600">*</span>
                  </label>
                  <PersonPicker
                    value={handoverTargetId ? { recipient_id: handoverTargetId, name: handoverTargetName } : (handoverTargetName || null)}
                    onChange={(selection) => {
                      if (selection) {
                        setHandoverTargetId(selection.recipient_id || selection.recipientId || '');
                        setHandoverTargetName(selection.name || selection.primary_receiver_name || '');
                      } else {
                        setHandoverTargetId('');
                        setHandoverTargetName('');
                      }
                    }}
                    placeholder="เลือกหรือค้นหาผู้รับต่อ (พนักงาน/ผู้ช่วย/ทีม)..."
                    allowAddNew={true}
                    disabled={isPendingRef.current || isSubmitting}
                  />
                </div>

                <label className="min-h-[44px] flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={handoverAccepted}
                    disabled={isPendingRef.current || isSubmitting}
                    onChange={(e) => setHandoverAccepted(e.target.checked)}
                    className="w-4 h-4 rounded text-[var(--theme-main,#8b5cf6)] focus:ring-[var(--theme-main,#8b5cf6)]"
                  />
                  <span>ผู้รับปลายทางยืนยันรับเครื่องมือเรียบร้อยแล้ว (Accepted)</span>
                </label>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">หมายเหตุการส่งต่อ:</label>
                  <textarea
                    rows={2}
                    value={handoverNotes}
                    disabled={isPendingRef.current || isSubmitting}
                    onChange={(e) => setHandoverNotes(e.target.value)}
                    placeholder="เช่น ส่งต่อให้ทีมติดตั้งหน้างานจุดที่ 2..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm sm:text-sm outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 p-3 sm:p-4 border-t border-slate-100 bg-slate-50/60 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsHandoverModalOpen(false)}
                  disabled={isPendingRef.current || isSubmitting}
                  className="min-h-[44px] px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm sm:text-sm font-bold hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleConfirmHandover}
                  disabled={isPendingRef.current || isSubmitting || !handoverTargetName.trim()}
                  className="min-h-[44px] px-5 py-2 bg-[var(--theme-main,#8b5cf6)] hover:bg-[var(--theme-hover,#7c3aed)] text-[var(--theme-on-main,#ffffff)] rounded-xl text-sm sm:text-sm font-bold transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {(isPendingRef.current || isSubmitting) && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
                  <span>{isPendingRef.current || isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันการส่งต่อ'}</span>
                </button>
              </div>
            </div>
          </div>
        );
        return typeof document !== 'undefined' && document.body ? createPortal(handoverModalJSX, document.body) : handoverModalJSX;
      })()}

      {/* --- MODAL 3: Inspect Recovery Lot Dialog --- */}
      {inspectingLot && (() => {
        const inspectModalJSX = (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isPendingRef.current && !isSubmitting) {
                setInspectingLot(null);
              }
            }}
          >
            <div className="bg-white rounded-2xl max-w-md w-full max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 min-w-0 overflow-hidden">
              <header className="flex items-start justify-between border-b border-slate-100 p-4 sm:p-5 shrink-0">
                <div>
                  <h4 className="text-base sm:text-lg font-bold text-slate-900">ตรวจคัดแยก {inspectingLot.item_name}</h4>
                  <p className="text-sm text-slate-500 mt-0.5">ยอดที่กู้คืนมาทั้งหมด: <strong>{inspectingLot.recovered_qty} ชิ้น</strong></p>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectingLot(null)}
                  disabled={isPendingRef.current || isSubmitting}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer disabled:opacity-40"
                >
                  ✕
                </button>
              </header>

              <div className="p-4 sm:p-5 space-y-3.5 flex-1 overflow-y-auto min-w-0">
                <div>
                  <label className="block text-sm font-bold text-emerald-800 mb-1">
                    จำนวนที่ตรวจแล้วใช้ได้ (พร้อมใช้):
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    max={inspectingLot.recovered_qty}
                    disabled={isPendingRef.current || isSubmitting}
                    value={inspectGoodQty}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      if (raw === '') {
                        setInspectGoodQty('');
                        return;
                      }
                      const g = Math.max(0, parseInt(raw, 10) || 0);
                      setInspectGoodQty(g);
                      setInspectDamagedQty(Math.max(0, inspectingLot.recovered_qty - g));
                    }}
                    className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-rose-800 mb-1">
                    จำนวนที่ชำรุดเสียหาย (ไม่เพิ่มสต็อก):
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    max={inspectingLot.recovered_qty}
                    disabled={isPendingRef.current || isSubmitting}
                    value={inspectDamagedQty}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      if (raw === '') {
                        setInspectDamagedQty('');
                        return;
                      }
                      const d = Math.max(0, parseInt(raw, 10) || 0);
                      setInspectDamagedQty(d);
                      setInspectGoodQty(Math.max(0, inspectingLot.recovered_qty - d));
                    }}
                    className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-hidden focus:border-rose-500"
                  />
                </div>

                <p className="text-sm text-slate-500">
                  * ระบบจะเพิ่มเฉพาะยอดของดี ({inspectGoodQty || 0} ชิ้น) เข้าสู่สต็อกพร้อมใช้
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 p-3 sm:p-4 border-t border-slate-100 bg-slate-50/60 shrink-0">
                <button
                  type="button"
                  onClick={() => setInspectingLot(null)}
                  disabled={isPendingRef.current || isSubmitting}
                  className="min-h-[44px] px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm sm:text-sm font-bold hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleConfirmInspect}
                  disabled={isPendingRef.current || isSubmitting}
                  className="min-h-[44px] px-5 py-2 bg-[var(--theme-main,#8b5cf6)] hover:bg-[var(--theme-hover,#7c3aed)] text-[var(--theme-on-main,#ffffff)] rounded-xl text-sm sm:text-sm font-bold transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {(isPendingRef.current || isSubmitting) && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
                  <span>{isPendingRef.current || isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันผลการตรวจรับ'}</span>
                </button>
              </div>
            </div>
          </div>
        );
        return typeof document !== 'undefined' && document.body ? createPortal(inspectModalJSX, document.body) : inspectModalJSX;
      })()}
    </div>
  );
}
