import React, { useState, useMemo } from 'react';
import {
  Package,
  Layers,
  RotateCcw,
  Wrench,
  Banknote,
  Search,
  Plus,
  Minus,
  Tags,
  Edit2,
  Check,
  X,
  AlertTriangle,
  ShoppingBag,
  Trash2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import InventoryItemImage from './InventoryItemImage.jsx';
import StatusDropdown from '../common/StatusDropdown.jsx';
import HeaderFilterPortal from '../common/HeaderFilterPortal.jsx';
import { useWarehouseCommandKey } from '../../hooks/useWarehouseCommandKey.js';
import {
  evaluateStagedBagAvailability,
  replaceUnitInStagedBagObject
} from '../../utils/stagedBagsService.js';

const BANKNOTE_SPECS = [
  {
    denomination: 20,
    name: 'ธนบัตร 20 บาท',
    bgClass: 'bg-emerald-50/80 border-emerald-200',
    badgeClass: 'bg-emerald-700 text-white',
    accentText: 'text-emerald-950',
    subText: 'text-emerald-800'
  },
  {
    denomination: 50,
    name: 'ธนบัตร 50 บาท',
    bgClass: 'bg-sky-50/80 border-sky-200',
    badgeClass: 'bg-sky-700 text-white',
    accentText: 'text-sky-950',
    subText: 'text-sky-800'
  },
  {
    denomination: 100,
    name: 'ธนบัตร 100 บาท',
    bgClass: 'bg-rose-50/80 border-rose-200',
    badgeClass: 'bg-rose-700 text-white',
    accentText: 'text-rose-950',
    subText: 'text-rose-800'
  },
  {
    denomination: 500,
    name: 'ธนบัตร 500 บาท',
    bgClass: 'bg-violet-50/80 border-violet-200',
    badgeClass: 'bg-violet-700 text-white',
    accentText: 'text-violet-950',
    subText: 'text-violet-800'
  },
  {
    denomination: 1000,
    name: 'ธนบัตร 1,000 บาท',
    bgClass: 'bg-amber-50/80 border-amber-200',
    badgeClass: 'bg-amber-800 text-white',
    accentText: 'text-amber-950',
    subText: 'text-amber-800'
  }
];

function normalizeItemClass(rawType) {
  const t = String(rawType || '').trim().toLowerCase();
  if (t === 'asset' || t === 'tool' || t === 'equipment') return 'asset';
  if (t === 'reusable') return 'reusable';
  if (t === 'banknote') return 'banknote';
  if (t === 'task') return 'task';
  return 'consumable';
}

export default function GameBackpackGrid({
  items = [],
  categories = [],
  assetUnits = [],
  operations = null,
  cashSummary = null,
  isPrivilegedCashUser = false,
  activities = [],
  stagedBags = [],
  bagItems = [],
  bagCashLines = [],
  isRefreshing = false,
  onSmartScanClick,
  onOpenHistory,
  onRefreshAll,
  onTapPickItem,
  onUpdateBagItemQty,
  onTapPickCash,
  onUpdateCashLine,
  onLoadStagedBagToDock,
  onSaveStagedBag,
  onDeleteStagedBag,
  onQuickReturnTool,
  onQuickSalvageReusable,
  onQuickCompleteCashBatch,
  onQuickReturnRawCashBatch,
  onQuickRestockItem,
  onQuickDepositCash,
  onOpenCreateItem,
  onOpenEditItem,
  onOpenAddUnit,
  onOpenPrintItem,
  onOpenCategories,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false
}) {
  const [activeClass, setActiveClass] = useState('ALL'); // 'ALL' | 'consumable' | 'reusable' | 'asset' | 'banknote'
  const [activeCategoryId, setActiveCategoryId] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [isOutStripExpanded, setIsOutStripExpanded] = useState(false);

  // Reusable salvage inline state { [movementId]: goodQty }
  const [salvageInputs, setSalvageInputs] = useState({});
  const [busyActionId, setBusyActionId] = useState(null);

  // Quick Restock Popover state
  const [restockTarget, setRestockTarget] = useState(null); // { kind: 'item' | 'cash', id, denomination, name, unit, item }
  const [restockQty, setRestockQty] = useState(10);
  const [expenseTotalBaht, setExpenseTotalBaht] = useState('');
  const [cashSourceMode, setCashSourceMode] = useState('bank_reserve'); // 'bank_reserve' | 'project_support'
  const [cashProjectId, setCashProjectId] = useState('');
  const [isSubmittingRestock, setIsSubmittingRestock] = useState(false);
  const [recentRestockMap, setRecentRestockMap] = useState({});

  const { getKey, clearKey } = useWarehouseCommandKey();

  // Map bag items for O(1) active state lookup on cards
  const bagItemById = useMemo(() => {
    const map = new Map();
    (bagItems || []).forEach((b) => {
      map.set(String(b.id || b.item_id), b);
    });
    return map;
  }, [bagItems]);

  const bagCashByDenom = useMemo(() => {
    const map = new Map();
    (bagCashLines || []).forEach((c) => {
      map.set(Number(c.denomination), c);
    });
    return map;
  }, [bagCashLines]);

  // Categories map
  const categoryMap = useMemo(() => {
    const map = new Map();
    (categories || []).forEach((c) => {
      if (c && c.id && c.is_active !== false) {
        map.set(String(c.id), c);
      }
    });
    return map;
  }, [categories]);

  // Tool availability stats per item_id
  const toolStatsByItemId = useMemo(() => {
    const stats = new Map();
    (assetUnits || []).forEach((u) => {
      if (!u?.item_id) return;
      const key = String(u.item_id);
      if (!stats.has(key)) {
        stats.set(key, { total: 0, available: 0, borrowed: 0, units: [] });
      }
      const entry = stats.get(key);
      entry.total += 1;
      entry.units.push(u);
      const isAvail =
        String(u.status || '').toUpperCase() === 'AVAILABLE' &&
        !u.borrowed_by &&
        !u.active_recipient;
      if (isAvail) entry.available += 1;
      else entry.borrowed += 1;
    });
    return stats;
  }, [assetUnits]);

  // Clean catalog items from Supabase (no legacy banknote/task rows)
  const cleanCatalogItems = useMemo(() => {
    return (items || []).filter((it) => {
      if (!it || it.is_active === false) return false;
      const cls = normalizeItemClass(it.item_type);
      return cls !== 'banknote' && cls !== 'task';
    });
  }, [items]);

  // STRICT REAL SUPABASE BANKNOTE SLOTS:
  // Never fabricate 5 fake x0 slots when cashSummary is null or uninitialized!
  const banknoteSlots = useMemo(() => {
    if (!isPrivilegedCashUser || !cashSummary || !Array.isArray(cashSummary.denominations)) {
      return [];
    }
    const denomsFromServer = cashSummary.denominations;
    const activeBatches = Array.isArray(cashSummary.helper_batches) ? cashSummary.helper_batches : [];

    return BANKNOTE_SPECS.map((spec) => {
      const row = denomsFromServer.find((d) => Number(d.denomination) === spec.denomination);
      if (!row) return null;

      const physical = Number(row.physical_count) || 0;
      const reserved = Number(row.reserved_count) || 0;
      const available =
        row.available_count !== undefined
          ? Number(row.available_count)
          : Math.max(0, physical - reserved);
      const threshold = Number(row.low_alert_threshold) || 0;
      const isInitialized = Boolean(row.is_initialized);

      const foldingCount = activeBatches
        .filter((b) => Number(b.denomination) === spec.denomination)
        .reduce((sum, b) => {
          const rem = Math.max(
            0,
            (Number(b.issued_count) || 0) -
              (Number(b.prepared_count) || 0) -
              (Number(b.returned_raw_count) || 0) -
              (Number(b.handed_over_count) || 0)
          );
          return sum + rem;
        }, 0);

      const hasRealData = isInitialized || physical > 0 || reserved > 0 || foldingCount > 0;
      if (!hasRealData) return null;

      return {
        ...spec,
        id: `cash-${spec.denomination}`,
        physicalCount: physical,
        reservedCount: reserved,
        availableCount: available,
        foldingCount,
        lowThreshold: threshold,
        isLowStock: threshold > 0 && available <= threshold
      };
    }).filter(Boolean);
  }, [isPrivilegedCashUser, cashSummary]);

  // Low-stock calculation across real items
  const lowStockStats = useMemo(() => {
    let itemLowCount = 0;
    const lowItemIds = new Set();

    cleanCatalogItems.forEach((it) => {
      const cls = normalizeItemClass(it.item_type);
      const threshold = Number(it.min_alert_threshold) || 0;
      if (cls === 'asset') {
        const st = toolStatsByItemId.get(String(it.id));
        const avail = st ? st.available : Number(it.current_stock) || 0;
        if (threshold > 0 && avail <= threshold) {
          itemLowCount += 1;
          lowItemIds.add(String(it.id));
        }
      } else {
        const stock = Number(it.current_stock) || 0;
        if (stock <= 0 || (threshold > 0 && stock <= threshold)) {
          itemLowCount += 1;
          lowItemIds.add(String(it.id));
        }
      }
    });

    const cashLowCount = banknoteSlots.filter((b) => b.isLowStock).length;
    return {
      totalLow: itemLowCount + cashLowCount,
      lowItemIds
    };
  }, [cleanCatalogItems, toolStatsByItemId, banknoteSlots]);

  // Sub-categories matching active class
  const visibleSubCategories = useMemo(() => {
    if (activeClass === 'banknote') return [];
    const activeCats = Array.from(categoryMap.values()).filter((cat) => {
      if (activeClass === 'ALL') return true;
      return normalizeItemClass(cat.type) === activeClass;
    });

    const counts = new Map();
    cleanCatalogItems.forEach((it) => {
      if (activeClass !== 'ALL' && normalizeItemClass(it.item_type) !== activeClass) return;
      if (it.category_id) {
        const k = String(it.category_id);
        counts.set(k, (counts.get(k) || 0) + 1);
      }
    });

    return activeCats.map((cat) => ({
      ...cat,
      itemCount: counts.get(String(cat.id)) || 0
    }));
  }, [categoryMap, activeClass, cleanCatalogItems]);

  // Filtered items
  const filteredItems = useMemo(() => {
    if (activeClass === 'banknote') return [];
    const q = searchQuery.trim().toLowerCase();

    return cleanCatalogItems.filter((it) => {
      const cls = normalizeItemClass(it.item_type);
      if (activeClass !== 'ALL' && cls !== activeClass) return false;
      if (activeCategoryId !== 'ALL' && String(it.category_id || '') !== String(activeCategoryId)) return false;
      if (onlyLowStock && !lowStockStats.lowItemIds.has(String(it.id))) return false;

      if (q) {
        const catName = it.category_id ? categoryMap.get(String(it.category_id))?.name || '' : '';
        const unitCodesStr = (toolStatsByItemId.get(String(it.id))?.units || [])
          .map((u) => u.unit_code)
          .join(' ')
          .toLowerCase();
        const hay = `${it.name || ''} ${it.code || ''} ${it.color || ''} ${it.size || ''} ${catName} ${unitCodesStr}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [cleanCatalogItems, activeClass, activeCategoryId, onlyLowStock, lowStockStats, searchQuery, categoryMap, toolStatsByItemId]);

  // Filtered banknotes
  const filteredBanknotes = useMemo(() => {
    if (!isPrivilegedCashUser) return [];
    if (activeClass !== 'ALL' && activeClass !== 'banknote') return [];
    if (activeCategoryId !== 'ALL') return [];

    const q = searchQuery.trim().toLowerCase();
    return banknoteSlots.filter((b) => {
      if (onlyLowStock && !b.isLowStock) return false;
      if (q) {
        const hay = `${b.name} แบงค์ ${b.denomination} ธนบัตร เงินสด`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [isPrivilegedCashUser, activeClass, activeCategoryId, banknoteSlots, onlyLowStock, searchQuery]);

  // Evaluated Staged Bags (Shopping-cart greyed-out conflict state!)
  const evaluatedStagedBags = useMemo(() => {
    return (stagedBags || [])
      .map((bag) => evaluateStagedBagAvailability(bag, items, assetUnits, stagedBags))
      .filter(Boolean);
  }, [stagedBags, items, assetUnits]);

  // Real active Out-on-Job items from Supabase (tools + reusable flowers + folding cash batches)
  const activeBorrowedTools = useMemo(() => {
    return (assetUnits || []).filter(
      (u) => String(u.status || '').toUpperCase() === 'BORROWED' || u.borrowed_by || u.active_recipient
    );
  }, [assetUnits]);

  const activeReusableLines = useMemo(() => {
    const issueLines = Array.isArray(operations?.issue_lines) ? operations.issue_lines : [];
    return issueLines.filter((ln) => {
      const rem = Number(ln.remaining_qty ?? ln.issued_qty) || 0;
      const itemType = normalizeItemClass(ln.item_type);
      return rem > 0 && itemType === 'reusable';
    });
  }, [operations]);

  const activeCashBatches = useMemo(() => {
    if (!isPrivilegedCashUser || !Array.isArray(cashSummary?.helper_batches)) return [];
    return cashSummary.helper_batches
      .map((b) => {
        const rem = Math.max(
          0,
          (Number(b.issued_count) || 0) -
            (Number(b.prepared_count) || 0) -
            (Number(b.returned_raw_count) || 0) -
            (Number(b.handed_over_count) || 0)
        );
        return { ...b, remainingCount: rem };
      })
      .filter((b) => b.remainingCount > 0);
  }, [isPrivilegedCashUser, cashSummary]);

  const totalOutOnJob = activeBorrowedTools.length + activeReusableLines.length + activeCashBatches.length;

  // Class counts
  const classCounts = useMemo(() => {
    let consumable = 0;
    let reusable = 0;
    let asset = 0;
    cleanCatalogItems.forEach((it) => {
      const c = normalizeItemClass(it.item_type);
      if (c === 'consumable') consumable += 1;
      else if (c === 'reusable') reusable += 1;
      else if (c === 'asset') asset += 1;
    });
    return {
      all: cleanCatalogItems.length + banknoteSlots.length,
      consumable,
      reusable,
      asset,
      banknote: banknoteSlots.length
    };
  }, [cleanCatalogItems, banknoteSlots]);

  const openRestockPopover = (target) => {
    setRestockTarget(target);
    setRestockQty(target.kind === 'cash' ? 20 : 10);
    setExpenseTotalBaht('');
    setCashSourceMode('bank_reserve');
    setCashProjectId('');
  };

  const handleConfirmQuickRestock = async (e) => {
    e.preventDefault();
    if (!restockTarget || isSubmittingRestock) return;
    const qty = Math.max(1, Math.floor(Number(restockQty) || 0));
    if (qty <= 0) return;

    setIsSubmittingRestock(true);
    try {
      if (restockTarget.kind === 'cash') {
        const actionName = `quick_cash_${restockTarget.denomination}`;
        const idempotencyKey = getKey(actionName, {
          denomination: restockTarget.denomination,
          qty,
          mode: cashSourceMode,
          projectId: cashProjectId
        });
        await onQuickDepositCash?.({
          denomination: restockTarget.denomination,
          noteCount: qty,
          sourceMode: cashSourceMode,
          projectId: cashSourceMode === 'project_support' ? cashProjectId || null : null,
          idempotencyKey
        });
        clearKey(actionName);
        setRecentRestockMap((prev) => ({ ...prev, [`cash-${restockTarget.denomination}`]: qty }));
      } else {
        const baht = Number(expenseTotalBaht) || 0;
        const shouldRecordExpense = baht > 0;
        const actionName = `quick_stock_${restockTarget.id}`;
        const idempotencyKey = getKey(actionName, {
          itemId: restockTarget.id,
          qty,
          baht
        });
        await onQuickRestockItem?.({
          item: restockTarget.item,
          itemId: restockTarget.id,
          quantity: qty,
          recordExpenseToo: shouldRecordExpense,
          expenseTotalBaht: baht,
          expenseProjectId: 'SHOP-STOCK',
          idempotencyKey
        });
        clearKey(actionName);
        setRecentRestockMap((prev) => ({ ...prev, [String(restockTarget.id)]: qty }));
      }
      setRestockTarget(null);
    } catch {
      // Error toast handled by parent
    } finally {
      setIsSubmittingRestock(false);
    }
  };

  return (
    <div className="space-y-4 pb-24 md:pb-4">
      {/* ===================================================================== */}
      {/* 1. HEADER-INTEGRATED SEARCH & CATEGORY FILTER PORTAL                   */}
      {/* ===================================================================== */}
      <HeaderFilterPortal
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ค้นหาของในกระเป๋า, สี, หมวดหมู่ หรือรหัส..."
        desktopInputWidthClass="w-36 lg:w-48 xl:w-60"
        activeFilterCount={[
          activeClass !== 'ALL',
          activeCategoryId !== 'ALL',
          onlyLowStock
        ].filter(Boolean).length}
        onReset={() => {
          setSearchQuery('');
          setActiveClass('ALL');
          setActiveCategoryId('ALL');
          setOnlyLowStock(false);
        }}
      >
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[
              { id: 'ALL', label: 'ทั้งหมด', count: classCounts.all, icon: ShoppingBag },
              { id: 'consumable', label: 'ใช้แล้วหมดไป', count: classCounts.consumable, icon: Layers },
              { id: 'reusable', label: 'วนใช้ซ้ำ', count: classCounts.reusable, icon: RotateCcw },
              { id: 'asset', label: 'อุปกรณ์', count: classCounts.asset, icon: Wrench },
              ...(isPrivilegedCashUser
                ? [{ id: 'banknote', label: 'ธนบัตร', count: classCounts.banknote, icon: Banknote }]
                : [])
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeClass === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveClass(tab.id);
                    setActiveCategoryId('ALL');
                  }}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                    active
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[11px] tabular-nums ${
                      active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}

            {lowStockStats.totalLow > 0 && (
              <button
                type="button"
                onClick={() => setOnlyLowStock((v) => !v)}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  onlyLowStock
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>ใกล้หมด {lowStockStats.totalLow}</span>
              </button>
            )}
          </div>

          {activeClass !== 'banknote' && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => setActiveCategoryId('ALL')}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap border transition cursor-pointer shrink-0 ${
                  activeCategoryId === 'ALL'
                    ? 'bg-violet-100 text-violet-900 border-violet-300'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                ทุกหมวดย่อย
              </button>
              {visibleSubCategories.map((cat) => {
                const active = String(activeCategoryId) === String(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategoryId(cat.id)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap border transition cursor-pointer shrink-0 ${
                      active
                        ? 'bg-violet-100 text-violet-900 border-violet-300'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {cat.name} ({cat.itemCount})
                  </button>
                );
              })}
              <button
                type="button"
                onClick={onOpenCategories}
                className="px-2.5 py-1 rounded-full text-xs font-semibold text-slate-600 hover:text-violet-700 bg-slate-100 hover:bg-violet-50 transition flex items-center gap-1 whitespace-nowrap cursor-pointer shrink-0"
              >
                <Tags className="w-3 h-3" />
                <span>จัดการหมวดย่อย</span>
              </button>
            </div>
          )}
        </div>
      </HeaderFilterPortal>

      {/* ===================================================================== */}
      {/* 3. STAGED BAGS STRIP (Pre-Packed Bags — Greyed-out if taken!)         */}
      {/* ===================================================================== */}
      {evaluatedStagedBags.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-800">
              กระเป๋าที่จัดเตรียมไว้ ({evaluatedStagedBags.length})
            </span>
            <span className="text-xs text-slate-600">แตะเพื่อเปิดเบิกออกงาน หรือสลับของที่ถูกหยิบไปก่อน</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {evaluatedStagedBags.map((bag) => (
              <div
                key={bag.id}
                className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 ${
                  bag.hasAnyGreyedOut
                    ? 'bg-slate-50 border-amber-300'
                    : 'bg-violet-50/40 border-violet-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-slate-900 truncate">{bag.title}</span>
                      {bag.hasAnyGreyedOut ? (
                        <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[11px] font-bold">
                          มีของไม่ว่าง {bag.greyedOutCount} ชิ้น
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                          พร้อมออกงาน
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {bag.evaluatedLines.map((ln) => (
                        <span
                          key={ln.item_id}
                          className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                            ln.isGreyedOut
                              ? 'bg-slate-200 text-slate-500 line-through'
                              : 'bg-white text-slate-700 border border-slate-200'
                          }`}
                        >
                          {ln.name} {ln.isTool ? `(${(ln.unitCodes || []).join(', ')})` : `x${ln.quantity}`}
                        </span>
                      ))}
                    </div>

                    {/* Inline 1-Tap Swap for Greyed-Out Tool Units right on the card! */}
                    {bag.evaluatedLines.map((ln) =>
                      (ln.unitEvaluations || [])
                        .filter((ue) => ue.isGreyedOut)
                        .map((ue) => (
                          <div
                            key={`${bag.id}-${ue.unitCode}`}
                            className="mt-2 p-2 rounded-lg bg-slate-200/80 flex items-center justify-between gap-2 text-xs text-slate-700"
                          >
                            <span>
                              {ue.unitCode} ถูกเอาออกไปแล้ว ({ue.takenBy})
                            </span>
                            {ue.replacementCandidates.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const raw = (stagedBags || []).find((b) => b.id === bag.id);
                                  if (raw) {
                                    onSaveStagedBag?.(
                                      replaceUnitInStagedBagObject(raw, ln.item_id, ue.unitCode, ue.replacementCandidates[0])
                                    );
                                  }
                                }}
                                className="px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-bold cursor-pointer shrink-0"
                              >
                                สลับเป็น {ue.replacementCandidates[0]}
                              </button>
                            )}
                          </div>
                        ))
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteStagedBag?.(bag.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer shrink-0"
                    title="ลบกระเป๋าที่พักไว้"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => onLoadStagedBagToDock?.(bag)}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-violet-600 text-white text-xs font-bold transition cursor-pointer"
                  >
                    เปิดกระเป๋าเพื่อออกงาน
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 4. ACTIVE OUT-ON-JOB STRIP (1-Tap Return / Flower Salvage / Cash)     */}
      {/* ===================================================================== */}
      {totalOutOnJob > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setIsOutStripExpanded((v) => !v)}
            className="w-full p-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-xs sm:text-sm font-bold text-slate-900">
                ของที่เอาออกไปใช้งาน / กำลังพับเงินตอนนี้ ({totalOutOnJob} รายการ)
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-violet-700">
              <span>{isOutStripExpanded ? 'ซ่อนรายการ' : 'กดคืนของ / นับดอกไม้กลับ'}</span>
              {isOutStripExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {isOutStripExpanded && (
            <div className="p-4 pt-0 border-t border-slate-100 space-y-3">
              {/* Borrowed Tools */}
              {activeBorrowedTools.map((unit) => {
                const holder = unit.active_recipient || unit.borrowed_by || 'ออกหน้างาน';
                const toolItem = items.find((i) => String(i.id) === String(unit.item_id));
                const busyKey = `ret-${unit.unit_code}`;
                return (
                  <div
                    key={unit.unit_code}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="text-xs">
                      <span className="font-bold text-slate-900">
                        {toolItem?.name || 'อุปกรณ์'} ({unit.unit_code})
                      </span>
                      <span className="text-slate-600 ml-2">อยู่กับ: {holder}</span>
                    </div>
                    <button
                      type="button"
                      disabled={busyActionId === busyKey}
                      onClick={async () => {
                        setBusyActionId(busyKey);
                        try {
                          await onQuickReturnTool?.(unit.unit_code);
                        } finally {
                          setBusyActionId(null);
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                    >
                      {busyActionId === busyKey ? 'กำลังรับคืน...' : 'คืนเข้าคลัง'}
                    </button>
                  </div>
                );
              })}

              {/* Reusable Flower Salvage (1-Tap Good Qty -> Auto Broken Qty, Zero Employee Debt!) */}
              {activeReusableLines.map((ln) => {
                const movId = ln.movement_id || ln.id;
                const remQty = Number(ln.remaining_qty ?? ln.issued_qty) || 0;
                const goodVal = salvageInputs[movId] !== undefined ? salvageInputs[movId] : remQty;
                const goodNum = Math.max(0, Math.min(remQty, Math.floor(Number(goodVal) || 0)));
                const brokenNum = Math.max(0, remQty - goodNum);
                const busyKey = `salv-${movId}`;

                return (
                  <div
                    key={movId}
                    className="p-3 rounded-xl bg-sky-50/60 border border-sky-200 flex flex-wrap items-center justify-between gap-2.5"
                  >
                    <div className="text-xs space-y-0.5">
                      <div className="font-bold text-slate-900">
                        {ln.item_name || ln.name} (เอาออกไป {remQty} {ln.unit || 'ชิ้น'})
                      </div>
                      <div className="text-slate-600">
                        งาน: {ln.project_id || 'ทั่วไป'} · เสียหายหน้างาน {brokenNum} ชิ้น (ตัดชำรุดตามจริง ไม่คิดเงินคนงาน)
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-slate-700">เก็บดีกลับ:</label>
                      <input
                        type="number"
                        min="0"
                        max={remQty}
                        value={goodVal}
                        onChange={(e) => setSalvageInputs((prev) => ({ ...prev, [movId]: e.target.value }))}
                        className="w-16 px-2 py-1 rounded-lg bg-white border border-sky-300 text-center text-xs font-bold tabular-nums"
                      />
                      <button
                        type="button"
                        disabled={busyActionId === busyKey}
                        onClick={async () => {
                          setBusyActionId(busyKey);
                          try {
                            await onQuickSalvageReusable?.({
                              line: ln,
                              goodQty: goodNum,
                              damagedQty: brokenNum
                            });
                          } finally {
                            setBusyActionId(null);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold cursor-pointer"
                      >
                        {busyActionId === busyKey ? 'กำลังบันทึก...' : 'รับคืนเข้าคลัง'}
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Banknote Folding Batches (Who holds how much money & status!) */}
              {activeCashBatches.map((batch) => {
                const busyKey = `cashbatch-${batch.id}`;
                return (
                  <div
                    key={batch.id}
                    className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="text-xs">
                      <span className="font-bold text-emerald-950">
                        {batch.recipient_name || 'คนพับเงิน'} · แบงค์ {batch.denomination} x {batch.remainingCount} ใบ
                      </span>
                      <span className="text-emerald-800 ml-2">
                        (฿{(Number(batch.denomination) * batch.remainingCount).toLocaleString()} · งาน {batch.project_id || '-'} · กำลังพับ)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={busyActionId === busyKey}
                        onClick={async () => {
                          setBusyActionId(busyKey);
                          try {
                            await onQuickCompleteCashBatch?.(batch);
                          } finally {
                            setBusyActionId(null);
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer"
                      >
                        พับเสร็จ รับคืนครบ
                      </button>
                      <button
                        type="button"
                        disabled={busyActionId === busyKey}
                        onClick={async () => {
                          setBusyActionId(busyKey);
                          try {
                            await onQuickReturnRawCashBatch?.(batch);
                          } finally {
                            setBusyActionId(null);
                          }
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-semibold cursor-pointer"
                      >
                        คืนแบงค์เปล่า
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 5. BANKNOTE TAB QUICK DEPOSIT STRIP (Only when on ธนบัตร tab)         */}
      {/* ===================================================================== */}
      {activeClass === 'banknote' && isPrivilegedCashUser && (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs sm:text-sm font-bold text-emerald-950">
            เลือกชนิดธนบัตรเพื่อเติมเข้าคลังเงินสด:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {BANKNOTE_SPECS.map((sp) => (
              <button
                key={sp.denomination}
                type="button"
                onClick={() =>
                  openRestockPopover({
                    kind: 'cash',
                    denomination: sp.denomination,
                    name: sp.name,
                    unit: 'ใบ'
                  })
                }
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-700 hover:text-white text-emerald-900 border border-emerald-300 text-xs font-bold transition cursor-pointer tabular-nums"
              >
                + ฿{sp.denomination.toLocaleString()}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 6. VISUAL BACKPACK ITEM GRID (Direct 1-Tap Pick into Bag!)            */}
      {/* ===================================================================== */}
      {filteredBanknotes.length === 0 && filteredItems.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
            <Package className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              {searchQuery || onlyLowStock
                ? 'ไม่พบของในกระเป๋าตามเงื่อนไขที่ค้นหา'
                : activeClass === 'banknote'
                  ? 'ยังไม่มีธนบัตรในคลังตอนนี้'
                  : 'ยังไม่มีรายการของในหมวดนี้บน Supabase'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {activeClass === 'banknote'
                ? 'กดปุ่ม + ฿20 ถึง + ฿1,000 ด้านบนเพื่อรับธนบัตรเข้าคลัง หรือบันทึกเงินสนับสนุนศิลปินจากหน้าโปรเจกต์ได้เลย'
                : 'กดปุ่ม "+ เพิ่มของใหม่" ด้านบน หรือลงบิลซื้อของในหน้าการเงิน ระบบจะเพิ่มเข้ากระเป๋าคลังให้อัตโนมัติ'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
          {/* Real Banknote Cards (Only rendered when Supabase has real counts!) */}
          {filteredBanknotes.map((bn) => {
            const pickedCash = bagCashByDenom.get(bn.denomination);
            const recentAdded = recentRestockMap[`cash-${bn.denomination}`];

            return (
              <div
                key={bn.id}
                onClick={() => {
                  if (bn.availableCount > 0) {
                    onTapPickCash?.(bn.denomination, 20);
                  }
                }}
                className={`group relative rounded-2xl border p-4 flex flex-col justify-between transition cursor-pointer select-none ${
                  pickedCash
                    ? 'ring-2 ring-violet-600 border-violet-600 bg-violet-50/40'
                    : bn.bgClass
                }`}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-bold tabular-nums ${bn.badgeClass}`}>
                    ฿{bn.denomination.toLocaleString()}
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-slate-900 text-white text-xs font-bold tabular-nums">
                    x{bn.availableCount.toLocaleString()} ใบ
                  </span>
                </div>

                <div className="my-4 text-center">
                  <Banknote className={`w-9 h-9 mx-auto mb-1.5 ${bn.accentText}`} />
                  <div className={`font-bold text-sm ${bn.accentText}`}>{bn.name}</div>
                  <div className={`text-xs font-semibold tabular-nums ${bn.subText}`}>
                    ฿{(bn.availableCount * bn.denomination).toLocaleString()}
                  </div>
                  {bn.foldingCount > 0 && (
                    <div className="mt-1 text-[11px] font-semibold text-slate-700">
                      กำลังพับอยู่ {bn.foldingCount} ใบ
                    </div>
                  )}
                  {recentAdded > 0 && (
                    <div className="mt-1 text-[11px] font-bold text-emerald-700">
                      เพิ่งเติม +{recentAdded} ใบ
                    </div>
                  )}
                </div>

                {/* Bottom Action: Inline Stepper if picked, else Quick Restock button */}
                <div
                  className="pt-2 border-t border-black/5 flex items-center justify-between gap-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  {pickedCash ? (
                    <div className="w-full flex items-center justify-between bg-white rounded-xl p-1 border border-violet-300">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateCashLine?.(bn.denomination, Math.max(0, Number(pickedCash.noteCount) - 10))
                        }
                        className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-800 cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-bold text-violet-900 tabular-nums">
                        หยิบ {pickedCash.noteCount} ใบ
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateCashLine?.(
                            bn.denomination,
                            Math.min(bn.availableCount, Number(pickedCash.noteCount) + 10)
                          )
                        }
                        className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-800 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-[11px] font-semibold text-slate-600">
                        {bn.availableCount > 0 ? 'แตะเพื่อหยิบ' : 'หมดคลัง'}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          openRestockPopover({
                            kind: 'cash',
                            denomination: bn.denomination,
                            name: bn.name,
                            unit: 'ใบ'
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-900 hover:text-white text-slate-800 border border-slate-300 text-xs font-bold transition cursor-pointer"
                      >
                        + เติม
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* Real Catalog Item Slot Cards */}
          {filteredItems.map((item) => {
            const cls = normalizeItemClass(item.item_type);
            const isTool = cls === 'asset';
            const toolSt = isTool ? toolStatsByItemId.get(String(item.id)) : null;
            const availableQty = isTool
              ? toolSt
                ? toolSt.available
                : Number(item.current_stock) || 0
              : Number(item.current_stock) || 0;
            const totalToolQty = isTool ? (toolSt ? toolSt.total : Number(item.current_stock) || 0) : null;
            const isLow = lowStockStats.lowItemIds.has(String(item.id));
            const isOut = availableQty <= 0;
            const picked = bagItemById.get(String(item.id));
            const recentAdded = recentRestockMap[String(item.id)];
            const catName = item.category_id ? categoryMap.get(String(item.category_id))?.name : '';

            return (
              <div
                key={item.id}
                onClick={() => {
                  if (!isOut || picked) {
                    onTapPickItem?.(item);
                  }
                }}
                className={`group relative rounded-2xl border p-4 flex flex-col justify-between transition select-none ${
                  picked
                    ? 'bg-violet-50/40 border-violet-600 ring-2 ring-violet-600 cursor-pointer'
                    : isOut
                      ? 'bg-slate-50 border-slate-200 opacity-80'
                      : 'bg-white border-slate-200 hover:border-violet-300 cursor-pointer'
                }`}
              >
                {/* Top Row: Edit / Unit Code Quick Icons + Stock Stack Badge */}
                <div className="flex items-start justify-between gap-1.5 z-10">
                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenEditItem?.(item)}
                      className="p-1.5 rounded-lg bg-slate-100/90 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                      title="แก้ไขข้อมูลสินค้า"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    {isTool && (
                      <button
                        type="button"
                        onClick={() => onOpenAddUnit?.(item)}
                        className="px-1.5 py-1 rounded-lg bg-slate-100/90 hover:bg-violet-100 text-slate-700 hover:text-violet-800 text-[10px] font-bold transition cursor-pointer"
                        title="เพิ่มรหัสประจำชิ้น เช่น SC-001"
                      >
                        +รหัส
                      </button>
                    )}
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-lg text-xs font-bold tabular-nums ${
                      isOut
                        ? 'bg-rose-100 text-rose-800'
                        : isLow
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-slate-900 text-white'
                    }`}
                  >
                    {isTool && toolSt
                      ? `${availableQty}/${totalToolQty}`
                      : `x${availableQty.toLocaleString()}`}
                  </span>
                </div>

                {/* Visual Slot Center (Photo or Crisp Icon) */}
                <div className="my-2.5 flex flex-col items-center text-center">
                  <div className="w-20 h-20 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden flex items-center justify-center mb-2">
                    {item.image_url ? (
                      <InventoryItemImage
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : isTool ? (
                      <Wrench className="w-8 h-8 text-slate-500" />
                    ) : cls === 'reusable' ? (
                      <RotateCcw className="w-8 h-8 text-sky-600" />
                    ) : (
                      <Package className="w-8 h-8 text-violet-600" />
                    )}
                  </div>

                  <h4 className="font-bold text-xs sm:text-sm text-slate-900 line-clamp-2 leading-snug">
                    {item.name}
                  </h4>

                  <div className="mt-1 flex flex-wrap items-center justify-center gap-1 text-[11px] text-slate-500">
                    {catName && <span>{catName}</span>}
                    {item.storage_location && (
                      <span>{catName ? `· ${item.storage_location}` : item.storage_location}</span>
                    )}
                  </div>

                  {recentAdded > 0 && (
                    <span className="mt-1 text-[11px] font-bold text-emerald-700">
                      เพิ่งเติม +{recentAdded} {item.unit || 'ชิ้น'}
                    </span>
                  )}
                </div>

                {/* Bottom Action: Inline Stepper when Picked, or +เติม Button */}
                <div
                  className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  {picked ? (
                    <div className="w-full flex items-center justify-between bg-white rounded-xl p-1 border border-violet-300">
                      <button
                        type="button"
                        onClick={() => {
                          if (isTool) {
                            onTapPickItem?.(item);
                          } else {
                            onUpdateBagItemQty?.(item.id, Number(picked.quantity) - 1);
                          }
                        }}
                        className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-800 cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-bold text-violet-900 tabular-nums">
                        {isTool
                          ? `เลือก ${(picked.unitCodes || []).length || 1}`
                          : `${picked.quantity} ${item.unit || 'ชิ้น'}`}
                      </span>
                      {!isTool ? (
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateBagItemQty?.(item.id, Math.min(availableQty, Number(picked.quantity) + 1))
                          }
                          className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-800 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <Check className="w-4 h-4 text-violet-600 mr-1.5" />
                      )}
                    </div>
                  ) : (
                    <>
                      <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                        {isOut ? 'ของหมด' : 'แตะเพื่อหยิบ'}
                      </span>
                      {!isTool ? (
                        <button
                          type="button"
                          onClick={() =>
                            openRestockPopover({
                              kind: 'item',
                              id: item.id,
                              name: item.name,
                              unit: item.unit || 'ชิ้น',
                              item
                            })
                          }
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-800 text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0"
                        >
                          + เติม
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenPrintItem?.(item)}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition cursor-pointer"
                        >
                          QR
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Load More Pagination */}
      {hasMore && activeClass !== 'banknote' && (
        <div className="pt-2 text-center">
          <button
            type="button"
            disabled={isLoadingMore}
            onClick={onLoadMore}
            className="min-h-[42px] px-6 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 transition cursor-pointer"
          >
            {isLoadingMore ? 'กำลังโหลดเพิ่ม...' : 'แสดงของในกระเป๋าเพิ่มเติม'}
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* QUICK RESTOCK POPOVER (1-Step + Auto Finance Expense Sync!)           */}
      {/* ===================================================================== */}
      {restockTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setRestockTarget(null)}
        >
          <form
            onSubmit={handleConfirmQuickRestock}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                เติมเข้ากระเป๋า: {restockTarget.name}
              </h3>
              <button
                type="button"
                onClick={() => setRestockTarget(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {restockTarget.kind === 'cash' && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">เลือกชนิดธนบัตร</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {BANKNOTE_SPECS.map((sp) => (
                    <button
                      key={sp.denomination}
                      type="button"
                      onClick={() =>
                        setRestockTarget((prev) => ({
                          ...prev,
                          denomination: sp.denomination,
                          name: sp.name
                        }))
                      }
                      className={`py-1.5 rounded-lg text-xs font-bold border cursor-pointer tabular-nums ${
                        restockTarget.denomination === sp.denomination
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      {sp.denomination}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                จำนวนที่เติม ({restockTarget.unit || 'ชิ้น'})
              </label>
              <div className="flex gap-1.5">
                {[5, 10, 20, 50, 100].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRestockQty(preset)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border cursor-pointer tabular-nums ${
                      Number(restockQty) === preset
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    +{preset}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="1"
                required
                value={restockQty}
                onChange={(e) => setRestockQty(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 tabular-nums focus:outline-none focus:border-violet-500"
              />
            </div>

            {restockTarget.kind === 'item' ? (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  ยอดซื้อรวม ฿ (กรอกเมื่อซื้อเข้าใหม่ — ระบบลงบิลหน้าการเงินให้อัตโนมัติ)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={expenseTotalBaht}
                  onChange={(e) => setExpenseTotalBaht(e.target.value)}
                  placeholder="เว้นว่างได้หากแค่นับของเติมสต็อก"
                  className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 tabular-nums focus:outline-none focus:border-violet-500"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCashSourceMode('bank_reserve')}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border cursor-pointer ${
                      cashSourceMode === 'bank_reserve'
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    เบิกธนาคารสำรองร้าน
                  </button>
                  <button
                    type="button"
                    onClick={() => setCashSourceMode('project_support')}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border cursor-pointer ${
                      cashSourceMode === 'project_support'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    เงินสนับสนุนโปรเจกต์
                  </button>
                </div>
                {cashSourceMode === 'project_support' && (
                  <StatusDropdown
                    value={cashProjectId}
                    onChange={(val) => setCashProjectId(val)}
                    placeholder="เลือกโปรเจกต์ที่จองธนบัตร..."
                    showDot={false}
                    size="sm"
                    options={[
                      { value: '', label: 'เลือกโปรเจกต์ที่จองธนบัตร...' },
                      ...(activities || [])
                        .filter((a) => a?.id && a.id !== 'SHOP-STOCK')
                        .slice(0, 30)
                        .map((a) => ({
                          value: a.id,
                          label: `${a.id} · ${a.name || a.customer}`
                        }))
                    ]}
                    className="w-full"
                  />
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmittingRestock}
              className="w-full min-h-[44px] py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-bold transition cursor-pointer"
            >
              {isSubmittingRestock ? 'กำลังบันทึก...' : 'ยืนยันเติมเข้าคลัง'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
