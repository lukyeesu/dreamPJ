import React, { useState, useMemo, useEffect } from 'react';
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Check,
  X,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Users,
  Briefcase,
  Banknote,
  Bookmark,
  Send,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { getRecommendedCombos } from '../../utils/inventoryCombos.js';
import {
  evaluateStagedBagAvailability,
  replaceUnitInStagedBagObject,
  buildCheckoutFromEvaluatedBag
} from '../../utils/stagedBagsService.js';
import { useWarehouseCommandKey } from '../../hooks/useWarehouseCommandKey.js';

function normalizeType(rawType) {
  const t = String(rawType || '').trim().toLowerCase();
  if (t === 'asset' || t === 'tool' || t === 'equipment') return 'asset';
  if (t === 'reusable') return 'reusable';
  return 'consumable';
}

const TEAM_PRESETS = ['ทีม A', 'ทีม B', 'ทีม C'];

/**
 * GameBagDock (exported via GameActionModal.jsx for clean module graph)
 * Replaces the old multi-tab ERP modal with a Floating Game Quickbar + Slide-Up Bag Sheet.
 */
export default function GameActionModal({
  bagItems = [],
  bagCashLines = [],
  editingBagId = null,
  editingBagTitle = '',
  isExpanded = false,
  onToggleExpand,
  onClearBag,
  onUpdateBagItemQty,
  onToggleBagItemUnit,
  onAddComboItem,
  onRemoveBagItem,
  onUpdateCashLine,
  onRemoveCashLine,
  initialProjectIds = [],
  items = [],
  assetUnits = [],
  activities = [],
  recipients = [],
  cashSummary = null,
  isPrivilegedCashUser = false,
  stagedBags = [],
  onSaveStagedBag,
  onDeleteStagedBag,
  onCreateIssue,
  onIssueCashBatch,
  onRefreshAll,
  onNotify
}) {
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);
  const [projectSearch, setProjectSearch] = useState('');
  const [selectedNames, setSelectedNames] = useState([]);
  const [customNamesInput, setCustomNamesInput] = useState('');
  const [bagTitleInput, setBagTitleInput] = useState('');
  const [customCashSplits, setCustomCashSplits] = useState({}); // { `${denom}:${person}`: number }
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { getKey, clearKey } = useWarehouseCommandKey();

  // Sync external project jump (e.g. clicking "จัดของ" from a Project Card)
  useEffect(() => {
    if (Array.isArray(initialProjectIds) && initialProjectIds.length > 0) {
      setSelectedProjectIds(initialProjectIds.map(String));
    }
  }, [initialProjectIds]);

  useEffect(() => {
    setBagTitleInput(editingBagTitle || '');
  }, [editingBagTitle, editingBagId]);

  // All selected people (chips + comma-separated text)
  const allPeople = useMemo(() => {
    const typed = String(customNamesInput || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const merged = [];
    const seen = new Set();
    [...selectedNames, ...typed].forEach((name) => {
      const key = name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(name);
      }
    });
    return merged;
  }, [selectedNames, customNamesInput]);

  // Available units grouped by item_id
  const unitsByItemId = useMemo(() => {
    const map = new Map();
    (assetUnits || []).forEach((u) => {
      if (!u?.item_id) return;
      const key = String(u.item_id);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(u);
    });
    return map;
  }, [assetUnits]);

  // Live availability evaluation (handles greyed-out conflict items when a Staged Bag is loaded!)
  const evaluatedBag = useMemo(() => {
    const pseudoBag = {
      id: editingBagId || 'live-bag',
      title: bagTitleInput || allPeople[0] || 'กระเป๋าจัดของ',
      items: bagItems.map((it) => ({
        item_id: String(it.id || it.item_id),
        name: it.name,
        item_type: it.item_type,
        unit: it.unit || 'ชิ้น',
        quantity: Math.max(1, Number(it.quantity) || 1),
        unitCodes: Array.isArray(it.unitCodes) ? it.unitCodes : [],
        image_url: it.image_url || '',
        color: it.color || ''
      }))
    };
    return evaluateStagedBagAvailability(pseudoBag, items, assetUnits, stagedBags);
  }, [editingBagId, bagTitleInput, allPeople, bagItems, items, assetUnits, stagedBags]);

  // Smart Combo suggestions (Glue Gun -> Glue Sticks, Cutter -> Blades, Tape Dispenser -> Tape)
  const comboSuggestions = useMemo(() => {
    return getRecommendedCombos(bagItems, items).filter((c) => !c.isOutOfStock);
  }, [bagItems, items]);

  // Recipient quick chips (real Supabase recipients + Team A/B/C)
  const recipientChips = useMemo(() => {
    const list = [];
    const seen = new Set();
    (recipients || []).forEach((r) => {
      if (r?.name && r.is_active !== false) {
        const k = r.name.trim().toLowerCase();
        if (!seen.has(k)) {
          seen.add(k);
          list.push(r.name.trim());
        }
      }
    });
    TEAM_PRESETS.forEach((t) => {
      if (!seen.has(t.toLowerCase())) {
        seen.add(t.toLowerCase());
        list.push(t);
      }
    });
    return list;
  }, [recipients]);

  // Filtered projects for picker
  const visibleProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    const base = (activities || []).filter((a) => a && a.id && a.id !== 'SHOP-STOCK');
    if (!q) return base.slice(0, 14);
    return base
      .filter((a) => `${a.id} ${a.name || ''} ${a.customer || ''} ${a.artist || ''}`.toLowerCase().includes(q))
      .slice(0, 18);
  }, [activities, projectSearch]);

  const totalBagPositions = bagItems.length + bagCashLines.length;
  const isVisible = totalBagPositions > 0 || Boolean(isExpanded);
  if (!isVisible) return null;

  const toggleProject = (projId) => {
    const idStr = String(projId);
    setSelectedProjectIds((prev) =>
      prev.includes(idStr) ? prev.filter((p) => p !== idStr) : [...prev, idStr]
    );
  };

  const togglePersonChip = (name) => {
    setSelectedNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  // Compute banknote distribution across selected people (Auto-divide 100 ÷ 5 = 20 each!)
  const getCashSplitsForLine = (line) => {
    const denom = Number(line.denomination);
    const totalNotes = Math.max(1, Math.floor(Number(line.noteCount) || 0));
    const targets = allPeople.length > 0 ? allPeople : ['ผู้รับหลัก'];
    const baseShare = Math.floor(totalNotes / targets.length);
    const remainder = totalNotes % targets.length;

    return targets.map((person, idx) => {
      const overrideKey = `${denom}:${person}`;
      const defaultShare = baseShare + (idx < remainder ? 1 : 0);
      const count =
        customCashSplits[overrideKey] !== undefined
          ? Math.max(0, Math.floor(Number(customCashSplits[overrideKey]) || 0))
          : defaultShare;
      return { person, count, overrideKey };
    });
  };

  const handleSwapGreyUnit = (itemId, oldCode, newCode) => {
    if (!oldCode || !newCode) return;
    onToggleBagItemUnit?.(itemId, oldCode, false);
    onToggleBagItemUnit?.(itemId, newCode, true);
    if (editingBagId && typeof onSaveStagedBag === 'function') {
      const existing = (stagedBags || []).find((b) => b.id === editingBagId);
      if (existing) {
        const swapped = replaceUnitInStagedBagObject(existing, itemId, oldCode, newCode);
        onSaveStagedBag(swapped);
      }
    }
    onNotify?.(`สลับรหัสจาก ${oldCode} เป็น ${newCode} เรียบร้อย`);
  };

  // Save as Pre-Packed Staged Bag ("พักกระเป๋าเตรียมไว้ก่อน")
  const handleStageBag = async () => {
    if (bagItems.length === 0) {
      onNotify?.('หยิบของใส่กระเป๋าอย่างน้อย 1 ชิ้นก่อนพักกระเป๋าครับ', 'warning');
      return;
    }
    setIsSubmitting(true);
    try {
      const primaryPerson = allPeople[0] || 'รอระบุทีม';
      const title =
        bagTitleInput.trim() ||
        (selectedProjectIds.length > 0
          ? `${primaryPerson} · ${selectedProjectIds.join(', ')}`
          : `กระเป๋าเตรียมงาน (${primaryPerson})`);

      await onSaveStagedBag?.({
        id: editingBagId || undefined,
        title,
        mode: selectedProjectIds.length > 1 ? 'party' : 'project',
        projectId: selectedProjectIds[0] || null,
        projectIds: selectedProjectIds,
        recipientName: primaryPerson,
        teamMembers: allPeople.slice(1),
        items: bagItems.map((it) => ({
          item_id: String(it.id || it.item_id),
          name: it.name,
          item_type: it.item_type,
          unit: it.unit || 'ชิ้น',
          quantity: Math.max(1, Number(it.quantity) || 1),
          unitCodes: Array.isArray(it.unitCodes) ? it.unitCodes : [],
          image_url: it.image_url || '',
          color: it.color || ''
        }))
      });

      onNotify?.(`พักกระเป๋า "${title}" เตรียมไว้เรียบร้อย!`);
      onClearBag?.();
      onToggleExpand?.(false);
    } catch (err) {
      onNotify?.(err?.message || 'พักกระเป๋าไม่สำเร็จ', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Atomic Checkout ("เอาออกใช้งานเลย")
  const handleCheckoutNow = async () => {
    if (isSubmitting) return;
    if (allPeople.length === 0) {
      onNotify?.('เลือกหรือพิมพ์ชื่อคนรับของ / ทีมก่อนกดเอาออกใช้งานครับ', 'warning');
      return;
    }
    if (bagCashLines.length > 0 && selectedProjectIds.length === 0) {
      onNotify?.('การเบิกธนบัตรไปพับ ต้องเลือกโปรเจกต์อย่างน้อย 1 งานครับ', 'warning');
      return;
    }

    // Validate tool unit codes if tool item has registered units in Supabase
    for (const line of bagItems) {
      if (normalizeType(line.item_type) === 'asset') {
        const knownUnits = unitsByItemId.get(String(line.id || line.item_id)) || [];
        if (knownUnits.length > 0 && (!line.unitCodes || line.unitCodes.length === 0)) {
          onNotify?.(`กรุณาแตะเลือกรหัสประจำชิ้นของ "${line.name}" ในกระเป๋าก่อนเบิกครับ`, 'warning');
          return;
        }
      }
    }

    const checkoutPlan = buildCheckoutFromEvaluatedBag(evaluatedBag);
    // For tools that have 0 serialized units registered yet, treat as stock-level or warn if nothing ready
    const hasReadyItems = checkoutPlan.materialLines.length > 0 || checkoutPlan.toolUnits.length > 0;
    const hasCash = bagCashLines.length > 0;

    if (!hasReadyItems && !hasCash) {
      onNotify?.('ของในกระเป๋าถูกทีมอื่นเอาออกไปแล้ว (สีเทา) กรุณากดสลับรหัสก่อนครับ', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const primaryPerson = allPeople[0];
      const matchedRecipient = (recipients || []).find(
        (r) => String(r.name || '').trim().toLowerCase() === primaryPerson.toLowerCase()
      );

      // 1. Dispatch Materials + Tools atomically
      if (hasReadyItems) {
        const isMultiStop = selectedProjectIds.length > 1;
        const actionSeed = `bag_issue_${editingBagId || 'live'}`;
        const idemKey = getKey(actionSeed, {
          projects: selectedProjectIds,
          person: primaryPerson,
          materials: checkoutPlan.materialLines,
          tools: checkoutPlan.toolUnits
        });

        await onCreateIssue?.({
          issueType: isMultiStop ? 'FIELD_ISSUE' : 'PRODUCTION_ISSUE',
          projectId: isMultiStop ? null : (selectedProjectIds[0] || null),
          projectIds: isMultiStop ? selectedProjectIds : [],
          roundCode: isMultiStop ? `RND-${Date.now().toString().slice(-5)}` : null,
          roundTitle: isMultiStop ? `${primaryPerson} (${selectedProjectIds.length} จุดติดตั้ง)` : null,
          recipientId: matchedRecipient?.id || null,
          recipientName: primaryPerson,
          teamMembers: allPeople.slice(1),
          materialLines: checkoutPlan.materialLines,
          toolUnits: checkoutPlan.toolUnits,
          notes: bagTitleInput.trim() || '',
          idempotencyKey: idemKey
        });
        clearKey(actionSeed);
      }

      // 2. Dispatch Banknote Batches (auto-split across helpers!)
      if (hasCash && typeof onIssueCashBatch === 'function') {
        const targetProjectId = selectedProjectIds[0];
        for (const cashLine of bagCashLines) {
          const splits = getCashSplitsForLine(cashLine).filter((s) => s.count > 0);
          for (const split of splits) {
            const recMatch = (recipients || []).find(
              (r) => String(r.name || '').trim().toLowerCase() === split.person.toLowerCase()
            );
            const cashActionName = `bag_cash_${cashLine.denomination}_${split.person}`;
            const cashKey = getKey(cashActionName, {
              projectId: targetProjectId,
              denom: cashLine.denomination,
              count: split.count,
              person: split.person
            });
            await onIssueCashBatch({
              projectId: targetProjectId,
              recipientId: recMatch?.id || null,
              recipientName: split.person,
              denomination: Number(cashLine.denomination),
              noteCount: split.count,
              notes: `กระจายพับช่อเงิน (${splits.length} คน)`,
              idempotencyKey: cashKey
            });
            clearKey(cashActionName);
          }
        }
      }

      // 3. Clean up Staged Bag (keep greyed-out conflicted items if partial checkout occurred!)
      if (editingBagId) {
        if (checkoutPlan.remainingGreyItems.length > 0) {
          await onSaveStagedBag?.({
            id: editingBagId,
            title: bagTitleInput || primaryPerson,
            projectIds: selectedProjectIds,
            projectId: selectedProjectIds[0] || null,
            recipientName: primaryPerson,
            items: checkoutPlan.remainingGreyItems
          });
        } else {
          await onDeleteStagedBag?.(editingBagId);
        }
      }

      await onRefreshAll?.();
      onClearBag?.();
      setCustomCashSplits({});
      onToggleExpand?.(false);
      onNotify?.(`เอาของออกใช้งานให้ "${allPeople.join(', ')}" เรียบร้อย!`);
    } catch (err) {
      // Concurrency race fallback: refresh warehouse state so taken items turn grey automatically!
      await onRefreshAll?.();
      onNotify?.(
        err?.message || 'เบิกไม่สำเร็จ (อาจมีทีมอื่นเพิ่งหยิบตัดหน้า ระบบอัปเดตสถานะล่าสุดให้แล้ว)',
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Backdrop when expanded */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/45 backdrop-blur-xs transition-opacity"
          onClick={() => onToggleExpand?.(false)}
        />
      )}

      {/* Dock Container (Floating bottom quickbar above mobile nav, or Expanded slide-up sheet) */}
      <div
        className={`fixed inset-x-0 mx-auto max-w-4xl px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] transition-all ${
          isExpanded
            ? 'bottom-0 z-[105] pt-2'
            : 'bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-0 z-[95] pointer-events-none'
        }`}
      >
        <div
          className={`pointer-events-auto bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden flex flex-col ${
            isExpanded ? 'max-h-[85vh]' : ''
          }`}
        >
          {/* Smart Combo 1-Tap Suggestion Strip (Visible right on the bar!) */}
          {comboSuggestions.length > 0 && (
            <div className="px-3.5 py-2 bg-violet-50 border-b border-violet-100 flex items-center gap-2 overflow-x-auto">
              <Sparkles className="w-4 h-4 text-violet-600 shrink-0" />
              <span className="text-xs font-bold text-violet-900 whitespace-nowrap">หยิบคู่กันไหม:</span>
              {comboSuggestions.map((sug) => (
                <button
                  key={sug.item.id}
                  type="button"
                  onClick={() => onAddComboItem?.(sug.item, sug.suggestQty)}
                  className="px-2.5 py-1 rounded-full bg-white hover:bg-violet-600 hover:text-white text-violet-800 border border-violet-200 text-xs font-bold whitespace-nowrap transition flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Plus className="w-3 h-3" />
                  <span>
                    {sug.item.name} (+{sug.suggestQty} {sug.item.unit || 'ชิ้น'})
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Collapsed Bar Header / Sheet Top Bar */}
          <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => onToggleExpand?.(!isExpanded)}
              className="flex items-center gap-2.5 text-left min-w-0 flex-1 cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0">
                <ShoppingBag className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm truncate">
                    {editingBagId ? `แก้ไขกระเป๋าที่พักไว้` : 'กระเป๋าจัดของ'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-violet-500/30 text-violet-100 text-xs font-bold tabular-nums">
                    {totalBagPositions} รายการ
                  </span>
                  {evaluatedBag?.hasAnyGreyedOut && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/25 text-amber-200 text-xs font-bold">
                      มีของไม่ว่าง {evaluatedBag.greyedOutCount}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 truncate">
                  {isExpanded
                    ? 'เลือกงานและคนรับ แล้วกดเอาออกใช้งาน หรือพักกระเป๋าไว้ก่อน'
                    : bagItems.map((b) => `${b.name} x${b.quantity}`).join(' · ') ||
                      bagCashLines.map((c) => `แบงค์ ${c.denomination} x${c.noteCount}`).join(' · ') ||
                      'แตะการ์ดสินค้าในคลังเพื่อหยิบใส่กระเป๋า'}
                </p>
              </div>
            </button>

            <div className="flex items-center gap-2 shrink-0">
              {!isExpanded ? (
                <>
                  {totalBagPositions > 0 && (
                    <button
                      type="button"
                      onClick={onClearBag}
                      className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                      title="ล้างกระเป๋า"
                    >
                      ล้าง
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onToggleExpand?.(true)}
                    className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs sm:text-sm font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>จัดส่ง / เบิกของ</span>
                    <ChevronUp className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => onToggleExpand?.(false)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                  aria-label="ย่อกระเป๋าจัดของ"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Expanded Checkout Body */}
          {isExpanded && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 bg-slate-50/60">
              {/* 1. Picked Items & Banknotes */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800">ของที่หยิบใส่กระเป๋า</h3>
                  {totalBagPositions > 0 && (
                    <button
                      type="button"
                      onClick={onClearBag}
                      className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
                    >
                      ล้างทั้งหมด
                    </button>
                  )}
                </div>

                {totalBagPositions === 0 && (
                  <div className="p-4 rounded-xl bg-white border border-dashed border-slate-300 text-center text-xs text-slate-500">
                    ยังไม่ได้หยิบของ — ย่อแถบนี้แล้วแตะเลือกของจากตารางคลัง หรือกดปุ่มสแกนกล้องได้เลยครับ
                  </div>
                )}

                {/* Evaluated Material & Tool Lines */}
                {(evaluatedBag?.evaluatedLines || []).map((line) => {
                  const knownUnits = unitsByItemId.get(String(line.item_id)) || [];
                  return (
                    <div
                      key={line.item_id}
                      className={`p-3 rounded-xl border transition ${
                        line.isGreyedOut
                          ? 'bg-slate-100 border-slate-300 text-slate-500'
                          : 'bg-white border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-bold text-sm ${line.isGreyedOut ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                              {line.name}
                            </span>
                            {line.isGreyedOut && (
                              <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[11px] font-bold">
                                ไม่ว่าง / ของไม่พอ
                              </span>
                            )}
                          </div>
                          {!line.isTool && line.state === 'INSUFFICIENT_STOCK' && (
                            <p className="text-xs text-amber-700 font-medium mt-0.5">
                              ในคลังเหลือ {line.availableQty} {line.unit} (ปรับลดจำนวนเพื่อเบิกเท่าที่มีได้)
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {!line.isTool && (
                            <div className="inline-flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200">
                              <button
                                type="button"
                                onClick={() => onUpdateBagItemQty?.(line.item_id, Math.max(1, Number(line.quantity) - 1))}
                                className="w-7 h-7 rounded-lg hover:bg-white flex items-center justify-center text-slate-700 cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={line.quantity}
                                onChange={(e) => onUpdateBagItemQty?.(line.item_id, Math.max(1, Number(e.target.value) || 1))}
                                className="w-12 text-center text-xs font-bold bg-transparent text-slate-900 tabular-nums focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => onUpdateBagItemQty?.(line.item_id, Number(line.quantity) + 1)}
                                className="w-7 h-7 rounded-lg hover:bg-white flex items-center justify-center text-slate-700 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => onRemoveBagItem?.(line.item_id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="เอาออกจากกระเป๋า"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Serialized Tool Unit Code Chips + 1-Tap Greyed-Out Replacement */}
                      {line.isTool && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-2">
                          {(line.unitEvaluations || []).map((ue) =>
                            ue.isGreyedOut ? (
                              <div
                                key={ue.unitCode}
                                className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-slate-200/70 text-xs text-slate-700"
                              >
                                <span className="font-semibold">
                                  {ue.unitCode} ไม่ว่าง ({ue.takenBy})
                                </span>
                                {ue.replacementCandidates.length > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => handleSwapGreyUnit(line.item_id, ue.unitCode, ue.replacementCandidates[0])}
                                    className="px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-bold flex items-center gap-1 cursor-pointer"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                    <span>สลับเป็น {ue.replacementCandidates[0]}</span>
                                  </button>
                                ) : (
                                  <span className="text-slate-500">ไม่มีชิ้นสำรองว่าง</span>
                                )}
                              </div>
                            ) : null
                          )}

                          {knownUnits.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[11px] font-semibold text-slate-500 mr-1">เลือกรหัสชิ้น:</span>
                              {knownUnits.map((u) => {
                                const code = u.unit_code;
                                const selected = (line.unitCodes || []).includes(code);
                                const avail =
                                  String(u.status || '').toUpperCase() === 'AVAILABLE' &&
                                  !u.borrowed_by &&
                                  !u.active_recipient;
                                if (!avail && !selected) return null;
                                return (
                                  <button
                                    key={code}
                                    type="button"
                                    onClick={() => onToggleBagItemUnit?.(line.item_id, code, !selected)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                                      selected
                                        ? 'bg-violet-600 text-white border-violet-600'
                                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-violet-300'
                                    }`}
                                  >
                                    {code}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-amber-700">
                              อุปกรณ์นี้ยังไม่ได้ผูกบาร์โค้ดรายชิ้น (กด +รหัส บนการ์ดเพื่อสร้างรหัสอย่าง SC-001 ได้)
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Banknote Lines (Auto-divides across selected helpers!) */}
                {isPrivilegedCashUser &&
                  bagCashLines.map((cashLine) => {
                    const splits = getCashSplitsForLine(cashLine);
                    const sumSplits = splits.reduce((s, x) => s + x.count, 0);
                    return (
                      <div
                        key={cashLine.denomination}
                        className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Banknote className="w-4 h-4 text-emerald-700" />
                            <span className="font-bold text-sm text-emerald-950">
                              ธนบัตร {Number(cashLine.denomination).toLocaleString()} บาท
                            </span>
                            <span className="text-xs font-bold text-emerald-800 tabular-nums">
                              (฿{(Number(cashLine.denomination) * Number(cashLine.noteCount || 0)).toLocaleString()})
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="1"
                              value={cashLine.noteCount}
                              onChange={(e) =>
                                onUpdateCashLine?.(cashLine.denomination, Math.max(1, Math.floor(Number(e.target.value) || 1)))
                              }
                              className="w-16 px-2 py-1 rounded-lg bg-white border border-emerald-300 text-center text-xs font-bold text-emerald-950 tabular-nums"
                            />
                            <span className="text-xs font-semibold text-emerald-800">ใบ</span>
                            <button
                              type="button"
                              onClick={() => onRemoveCashLine?.(cashLine.denomination)}
                              className="p-1.5 text-emerald-700 hover:text-rose-600 rounded-lg cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Live Auto-Splitter when 2+ helpers are selected */}
                        {allPeople.length > 1 && (
                          <div className="pt-2 border-t border-emerald-200/70 space-y-1.5">
                            <div className="flex items-center justify-between text-xs text-emerald-900 font-semibold">
                              <span>แบ่งให้ {allPeople.length} คนอัตโนมัติ (ปรับแก้รายคนได้):</span>
                              <span className="tabular-nums">รวม {sumSplits} ใบ</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                              {splits.map((sp) => (
                                <div
                                  key={sp.overrideKey}
                                  className="flex items-center justify-between gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-emerald-200"
                                >
                                  <span className="text-xs font-semibold text-slate-800 truncate">{sp.person}</span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={sp.count}
                                    onChange={(e) =>
                                      setCustomCashSplits((prev) => ({
                                        ...prev,
                                        [sp.overrideKey]: Math.max(0, Math.floor(Number(e.target.value) || 0))
                                      }))
                                    }
                                    className="w-12 text-right text-xs font-bold text-emerald-800 tabular-nums focus:outline-none"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>

              {/* 2. Project Picker (Single or Multi-Stop Team Route) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4 text-violet-600" />
                    <span>เอาไปใช้งานไหน? (เลือกหลายที่พร้อมกันได้)</span>
                  </label>
                  {selectedProjectIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedProjectIds([])}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      ใช้ในเวิร์กช็อปทั่วไป
                    </button>
                  )}
                </div>

                {activities.length > 6 && (
                  <div className="relative">
                    <input
                      type="text"
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                      placeholder="ค้นหาชื่องาน, รหัสงาน, ลูกค้า..."
                      className="w-full pl-3 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-violet-500"
                    />
                    {projectSearch && (
                      <button
                        type="button"
                        onClick={() => setProjectSearch('')}
                        aria-label="ล้างคำค้นหา"
                        title="ล้างคำค้นหา"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-0.5">
                  <button
                    type="button"
                    onClick={() => setSelectedProjectIds([])}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer ${
                      selectedProjectIds.length === 0
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    เวิร์กช็อป / ไม่ระบุงาน
                  </button>
                  {visibleProjects.map((proj) => {
                    const active = selectedProjectIds.includes(String(proj.id));
                    return (
                      <button
                        key={proj.id}
                        type="button"
                        onClick={() => toggleProject(proj.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer flex items-center gap-1 max-w-[240px] ${
                          active
                            ? 'bg-violet-600 text-white border-violet-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-violet-300'
                        }`}
                      >
                        {active && <Check className="w-3 h-3 shrink-0" />}
                        <span className="truncate">
                          {proj.id} · {proj.name || proj.customer || 'โปรเจกต์'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. Person / Team / Helpers Picker */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-violet-600" />
                  <span>อยู่กับใคร / ทีมไหน? (เลือกหลายคนเพื่อแบ่งเงินพับอัตโนมัติได้)</span>
                </label>

                <div className="flex flex-wrap gap-1.5">
                  {recipientChips.map((name) => {
                    const active = selectedNames.includes(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => togglePersonChip(name)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer flex items-center gap-1 ${
                          active
                            ? 'bg-violet-600 text-white border-violet-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-violet-300'
                        }`}
                      >
                        {active && <Check className="w-3 h-3" />}
                        <span>{name}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={customNamesInput}
                    onChange={(e) => setCustomNamesInput(e.target.value)}
                    placeholder="พิมพ์ชื่อคนรับเพิ่ม (คั่นด้วย , เช่น เมย์, พลอย, นัท)"
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-violet-500"
                  />
                  <input
                    type="text"
                    value={bagTitleInput}
                    onChange={(e) => setBagTitleInput(e.target.value)}
                    placeholder="ตั้งชื่อกระเป๋า/หมายเหตุ (เช่น รอพายุหยุด ออกพรุ่งนี้)"
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action Footer when Expanded */}
          {isExpanded && (
            <div className="p-3.5 sm:px-5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
              <button
                type="button"
                disabled={isSubmitting || bagItems.length === 0}
                onClick={handleStageBag}
                className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Bookmark className="w-4 h-4 text-slate-700" />
                <span>พักกระเป๋าเตรียมไว้ก่อน</span>
              </button>

              <button
                type="button"
                disabled={isSubmitting || totalBagPositions === 0}
                onClick={handleCheckoutNow}
                className="flex-1 min-h-[44px] px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'กำลังบันทึก...' : 'เอาออกใช้งานเลย'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
