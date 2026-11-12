import React, { useState, useMemo, useEffect, useRef } from 'react';
import InventoryItemImage from './InventoryItemImage.jsx';
import {
  Search,
  Filter,
  RotateCcw,
  Check,
  AlertTriangle,
  QrCode,
  Edit2,
  Package,
  Layers,
  Wrench,
  CheckCircle2,
  Clock,
  ArrowRight,
  ExternalLink,
  Plus,
  ChevronDown,
  ChevronUp,
  User,
  ShieldCheck
} from 'lucide-react';
import { TOOL_STATUSES } from '../../utils/warehouse.js';

/**
 * StockTable Component
 * Implements the core inventory catalog table and cards matching Plan C visual reference:
 * - Handling type bar: ทั้งหมด / วัสดุใช้ซ้ำ / สิ้นเปลือง / เครื่องมือ
 * - Combined filters: Search, Category, Color, Size, Location, Status, and Reset
 * - Discoverable individual tool unit identities (code, status, holder) under each item
 * - Selection integration with contextual issue cart
 * - Material recovery prompt banner
 */
export default function StockTable({
  items = [],
  categories = [],
  assetUnits = [],
  selectedItemIds = [],
  onToggleSelectItem,
  onOpenEditItem,
  onOpenSinglePrint,
  onOpenAddUnit,
  onNavigateToRecovery,
  serverPage = null,
  onQueryChange,
  onLoadMore,
  isActive = true,
  onLoadUnits,
  unitsPages = {},
  pendingRecoveryCount = 0
}) {
  // Filters state
  const [activeTypeTab, setActiveTypeTab] = useState('all'); // 'all' | 'reusable' | 'consumable' | 'asset'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedColor, setSelectedColor] = useState('all');
  const [selectedSize, setSelectedSize] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false);

  const serverMode = typeof onQueryChange === 'function';
  const loadMoreSentinel = useRef(null);
  useEffect(() => {
    if (!isActive || !serverMode || !serverPage?.has_more || serverPage.loading || serverPage.error || !loadMoreSentinel.current || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) onLoadMore?.();
    }, {rootMargin: '180px 0px'});
    observer.observe(loadMoreSentinel.current);
    return () => observer.disconnect();
  }, [isActive, serverMode, serverPage?.has_more, serverPage?.loading, serverPage?.error, serverPage?.offset, onLoadMore]);
  useEffect(() => {
    if (!serverMode) return;
    const timer = setTimeout(() => onQueryChange({
      search: searchQuery, item_type: activeTypeTab === 'all' ? '' : activeTypeTab,
      category_id: selectedCategory === 'all' ? null : selectedCategory,
      color: selectedColor === 'all' ? '' : selectedColor,
      size: selectedSize === 'all' ? '' : selectedSize,
      location: selectedLocation === 'all' ? '' : selectedLocation,
      status: selectedStatus === 'all' ? '' : selectedStatus, offset: 0, limit: 50
    }), 250);
    return () => clearTimeout(timer);
  }, [serverMode, onQueryChange, searchQuery, activeTypeTab, selectedCategory, selectedColor, selectedSize, selectedLocation, selectedStatus]);

  // Expanded items to view individual tool units
  const [expandedItemIds, setExpandedItemIds] = useState(new Set());

  const toggleExpandItem = (itemId) => {
    if (serverMode && !expandedItemIds.has(itemId)) onLoadUnits?.(itemId, 0);
    setExpandedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  // Compute tool units mapping: item_id -> { total, available, borrowed, broken, lost, units: [] }
  const toolUnitsMap = useMemo(() => {
    const map = new Map();
    for (const unit of assetUnits) {
      if (!unit || !unit.item_id) continue;
      const itemId = String(unit.item_id);
      if (!map.has(itemId)) {
        map.set(itemId, {
          total: 0,
          available: 0,
          borrowed: 0,
          broken: 0,
          lost: 0,
          units: []
        });
      }
      const stats = map.get(itemId);
      stats.total++;
      stats.units.push(unit);

      const status = String(unit.status || '').toUpperCase();
      if (status === TOOL_STATUSES.BORROWED || unit.borrowed_by) {
        stats.borrowed++;
      } else if (status === TOOL_STATUSES.BROKEN) {
        stats.broken++;
      } else if (status === TOOL_STATUSES.LOST) {
        stats.lost++;
      } else if (status === TOOL_STATUSES.AVAILABLE) {
        stats.available++;
      } else {
        stats.available++;
      }
    }
    if (serverMode) for (const item of items) {
      const stats = map.get(String(item.id)) || {units: [], borrowed: 0, broken: 0, lost: 0};
      stats.total = Number(item.tool_total ?? item.current_stock) || 0;
      stats.available = Number(item.tool_available ?? item.current_stock) || 0;
      map.set(String(item.id), stats);
    }
    return map;
  }, [assetUnits, items, serverMode]);

  // Extract unique colors, sizes, & locations for dropdowns
  const availableColors = useMemo(() => {
    if (serverMode) return serverPage?.facets?.colors || [];
    const colors = new Set();
    for (const item of items) {
      if (item.color && item.color.trim()) {
        colors.add(item.color.trim());
      }
    }
    return Array.from(colors);
  }, [items, serverMode, serverPage]);

  const availableSizes = useMemo(() => {
    if (serverMode) return serverPage?.facets?.sizes || [];
    const sizes = new Set();
    for (const item of items) {
      if (item.size && item.size.trim()) {
        sizes.add(item.size.trim());
      }
    }
    return Array.from(sizes);
  }, [items, serverMode, serverPage]);

  const availableLocations = useMemo(() => {
    if (serverMode) return serverPage?.facets?.locations || [];
    const locs = new Set();
    for (const item of items) {
      if (item.storage_location && item.storage_location.trim()) {
        locs.add(item.storage_location.trim());
      }
    }
    return Array.from(locs);
  }, [items, serverMode, serverPage]);

  // Category lookup map
  const categoryMap = useMemo(() => {
    const map = new Map();
    for (const cat of categories) {
      map.set(String(cat.id), cat.name);
    }
    return map;
  }, [categories]);

  // Filtered Items (excluding banknotes and service tasks from ordinary stock list)
  const filteredItems = useMemo(() => {
    if (serverMode) return items;
    return items.filter((item) => {
      // Exclude legacy banknotes and tasks from physical stock list
      const type = String(item.item_type || 'consumable').toLowerCase();
      if (type === 'banknote' || type === 'task') return false;

      // Handling type tab
      if (activeTypeTab !== 'all') {
        if (activeTypeTab === 'reusable' && type !== 'reusable' && type !== 'reusable_material') {
          return false;
        }
        if (activeTypeTab === 'consumable' && type !== 'consumable') {
          return false;
        }
        if (activeTypeTab === 'asset' && type !== 'asset' && type !== 'tool') {
          return false;
        }
      }

      // Category filter
      if (selectedCategory !== 'all') {
        if (String(item.category_id || '') !== String(selectedCategory)) {
          return false;
        }
      }

      // Color filter
      if (selectedColor !== 'all') {
        if (String(item.color || '').trim() !== selectedColor) {
          return false;
        }
      }

      // Size filter (Real combined filter)
      if (selectedSize !== 'all') {
        if (String(item.size || '').trim() !== selectedSize) {
          return false;
        }
      }

      // Location filter
      if (selectedLocation !== 'all') {
        if (String(item.storage_location || '').trim() !== selectedLocation) {
          return false;
        }
      }

      // Status filter
      if (selectedStatus !== 'all') {
        if (String(item.status || 'in_service') !== selectedStatus) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const nameMatch = String(item.name || '').toLowerCase().includes(query);
        const codeMatch = String(item.code || '').toLowerCase().includes(query);
        const colorMatch = String(item.color || '').toLowerCase().includes(query);
        const sizeMatch = String(item.size || '').toLowerCase().includes(query);
        const catName = categoryMap.get(String(item.category_id)) || '';
        const catMatch = catName.toLowerCase().includes(query);
        const locationMatch = String(item.storage_location || '').toLowerCase().includes(query);

        // Check if any serialized unit code matches exactly or includes
        const toolStats = toolUnitsMap.get(String(item.id));
        const unitMatch = toolStats?.units?.some(u => String(u.unit_code || '').toLowerCase().includes(query));

        if (!nameMatch && !codeMatch && !colorMatch && !sizeMatch && !catMatch && !locationMatch && !unitMatch) {
          return false;
        }
      }

      return true;
    });
  }, [items, serverMode, activeTypeTab, selectedCategory, selectedColor, selectedSize, selectedLocation, selectedStatus, searchQuery, categoryMap, toolUnitsMap]);

  // Count items by handling type
  const countsByType = useMemo(() => {
    if (serverMode) {
      const counts = serverPage?.facets?.type_counts;
      return counts ? {
        all: Object.values(counts).reduce((sum, n) => sum + Number(n || 0), 0),
        reusable: Number(counts.reusable || 0) + Number(counts.reusable_material || 0),
        consumable: Number(counts.consumable || 0),
        asset: Number(counts.asset || 0)
      } : {all: Number(serverPage?.total_count) || 0};
    }
    let all = 0;
    let reusable = 0;
    let consumable = 0;
    let asset = 0;

    for (const it of items) {
      const type = String(it.item_type || 'consumable').toLowerCase();
      if (type === 'banknote' || type === 'task') continue;
      all++;
      if (type === 'reusable' || type === 'reusable_material') reusable++;
      else if (type === 'asset' || type === 'tool') asset++;
      else consumable++;
    }

    return { all, reusable, consumable, asset };
  }, [items, serverMode, serverPage]);

  const handleResetFilters = () => {
    setActiveTypeTab('all');
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedColor('all');
    setSelectedSize('all');
    setSelectedLocation('all');
    setSelectedStatus('all');
  };

  const getSwatchStyle = (colorName) => {
    if (!colorName) return null;
    const lower = colorName.toLowerCase();
    if (lower.includes('ขาว') || lower.includes('white')) return 'bg-white border-slate-300';
    if (lower.includes('ชมพู') || lower.includes('pink')) return 'bg-rose-300 border-rose-400';
    if (lower.includes('แดง') || lower.includes('red')) return 'bg-red-500 border-red-600';
    if (lower.includes('ฟ้า') || lower.includes('น้ำเงิน') || lower.includes('blue')) return 'bg-blue-400 border-blue-500';
    if (lower.includes('ม่วง') || lower.includes('purple') || lower.includes('violet')) return 'bg-purple-400 border-purple-500';
    if (lower.includes('เหลือง') || lower.includes('yellow')) return 'bg-amber-300 border-amber-400';
    if (lower.includes('เขียว') || lower.includes('green')) return 'bg-emerald-400 border-emerald-500';
    if (lower.includes('ดำ') || lower.includes('black')) return 'bg-slate-900 border-slate-900';
    if (lower.includes('ทอง') || lower.includes('gold')) return 'bg-amber-500 border-amber-600';
    return 'bg-slate-200 border-slate-400';
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Recovery Prompt Banner */}
      {pendingRecoveryCount > 0 && (
        <div className="flex items-center justify-between p-3.5 bg-emerald-50/90 border border-emerald-200 rounded-2xl text-emerald-950 text-xs sm:text-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-700">
              <Package className="w-4 h-4" />
            </div>
            <span>
              <strong>มีวัสดุเก็บกลับ {pendingRecoveryCount} ชิ้น</strong> · รอคัดแยก ยังไม่รวมเข้าสต็อกพร้อมใช้
            </span>
          </div>
          <button
            type="button"
            onClick={onNavigateToRecovery}
            className="min-h-[44px] px-3 text-emerald-800 hover:text-emerald-950 font-bold underline underline-offset-2 flex items-center gap-1 cursor-pointer"
          >
            <span>ตรวจรับ</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Container */}
      <section className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {/* Typebar */}
        <div className="flex items-center gap-2 sm:gap-6 border-b border-slate-200/90 px-4 h-12 overflow-x-auto no-scrollbar select-none bg-slate-50/50">
          {[
            { id: 'all', label: 'ทั้งหมด', count: countsByType.all },
            { id: 'reusable', label: 'วัสดุใช้ซ้ำ', count: countsByType.reusable ?? '—' },
            { id: 'consumable', label: 'สิ้นเปลือง', count: countsByType.consumable ?? '—' },
            { id: 'asset', label: 'เครื่องมือ', count: countsByType.asset ?? '—' }
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTypeTab(t.id)}
              className={`h-full flex items-center gap-1.5 text-xs sm:text-sm font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
                activeTypeTab === t.id
                  ? 'text-[var(--theme-ink)] border-[var(--theme-main)]'
                  : 'text-slate-500 hover:text-slate-800 border-transparent'
              }`}
            >
              <span>{t.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-xs font-semibold ${
                activeTypeTab === t.id ? 'bg-[var(--theme-light)] text-[var(--theme-ink)]' : 'bg-slate-200/70 text-slate-600'
              }`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Filter Controls Bar */}
        <div className="p-3 sm:p-4 border-b border-slate-200/80 bg-white flex flex-wrap items-center gap-2">
          {/* Search box */}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อ หมวดหมู่ สี ขนาด หรือรหัส..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-[var(--theme-main)] rounded-xl text-xs sm:text-sm text-slate-800 transition outline-hidden min-h-[44px]"
            />
          </div>

          {/* Category Dropdown */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 font-medium focus:border-[var(--theme-main)] outline-hidden cursor-pointer"
          >
            <option value="all">ทุกหมวดหมู่</option>
            {categories.filter(c => c.is_active !== false).map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          {/* Color Dropdown */}
          {availableColors.length > 0 && (
            <select
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              className="min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 font-medium focus:border-[var(--theme-main)] outline-hidden cursor-pointer"
            >
              <option value="all">ทุกสี</option>
              {availableColors.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
          )}

          {/* Size Dropdown */}
          {availableSizes.length > 0 && (
            <select
              value={selectedSize}
              onChange={(e) => setSelectedSize(e.target.value)}
              className="min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-700 font-medium focus:border-[var(--theme-main)] outline-hidden cursor-pointer"
            >
              <option value="all">ทุกขนาด</option>
              {availableSizes.map((sz) => (
                <option key={sz} value={sz}>
                  {sz}
                </option>
              ))}
            </select>
          )}

          {/* Advanced Filters Toggle */}
          <button
            type="button"
            onClick={() => setIsAdvancedFilterOpen(!isAdvancedFilterOpen)}
            className={`min-h-[44px] px-3 border rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition cursor-pointer ${
              isAdvancedFilterOpen || selectedLocation !== 'all' || selectedStatus !== 'all'
                ? 'bg-rose-50 border-rose-300 text-[var(--theme-ink)]'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>ตัวกรองเพิ่ม</span>
          </button>

          {/* Reset Filters */}
          <button
            type="button"
            onClick={handleResetFilters}
            title="รีเซ็ตตัวกรองทั้งหมด"
            className="min-h-[44px] px-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl text-xs sm:text-sm font-medium transition flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">ล้างตัวกรอง</span>
          </button>
        </div>

        {/* Collapsible Advanced Filters */}
        {isAdvancedFilterOpen && (
          <div className="p-3 bg-slate-50 border-b border-slate-200/80 flex flex-wrap items-center gap-3 animate-in fade-in duration-150">
            {/* Storage Location */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600">จุดเก็บ:</label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="min-h-[44px] px-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 font-medium outline-hidden"
              >
                <option value="all">ทุกจุดเก็บ</option>
                {availableLocations.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-600">สถานะ:</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="min-h-[44px] px-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 font-medium outline-hidden"
              >
                <option value="all">ทุกสถานะ</option>
                <option value="in_service">พร้อมใช้งาน (in_service)</option>
                <option value="maintenance">กำลังซ่อมบำรุง (maintenance)</option>
                <option value="retired">เลิกใช้งาน (retired)</option>
              </select>
            </div>
          </div>
        )}

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-bold text-xs uppercase border-b border-slate-200">
                <th className="py-3 px-4 w-12 text-center">เลือก</th>
                <th className="py-3 px-4">รายการ / สี / ขนาด</th>
                <th className="py-3 px-4">พร้อมใช้</th>
                <th className="py-3 px-4">การใช้งาน & รหัสรายชิ้น</th>
                <th className="py-3 px-4">ที่เก็บ</th>
                <th className="py-3 px-4 text-right">การกระทำ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Package className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="font-semibold text-slate-600 text-sm">ไม่พบรายการพัสดุตามตัวกรองที่เลือก</p>
                    <p className="text-xs text-slate-400 mt-1">ลองล้างตัวกรองหรือเพิ่มพัสดุใหม่เข้าสู่ระบบ</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const itemId = String(item.id);
                  const isSelected = selectedItemIds.includes(itemId);
                  const isAsset = String(item.item_type || '').toLowerCase() === 'asset' || String(item.item_type || '').toLowerCase() === 'tool';
                  const isReusable = String(item.item_type || '').toLowerCase() === 'reusable' || String(item.item_type || '').toLowerCase() === 'reusable_material';
                  const isExpanded = expandedItemIds.has(itemId);

                  // Compute availability
                  let availableQty = 0;
                  let toolInfo = null;

                  if (isAsset) {
                    toolInfo = toolUnitsMap.get(itemId) || { total: 0, available: 0, borrowed: 0, broken: 0, lost: 0, units: [] };
                    availableQty = toolInfo.available;
                  } else {
                    availableQty = Math.max(0, Number(item.current_stock) || 0);
                  }

                  const minThreshold = Number(item.min_alert_threshold) || 0;
                  const isLowStock = !isAsset && minThreshold > 0 && availableQty <= minThreshold;
                  const catName = categoryMap.get(String(item.category_id)) || (isAsset ? 'เครื่องมือ' : isReusable ? 'วัสดุใช้ซ้ำ' : 'วัสดุสิ้นเปลือง');
                  const swatchClass = getSwatchStyle(item.color);

                  return (
                    <React.Fragment key={item.id}>
                      <tr
                        className={`transition ${isSelected ? 'bg-rose-50/40 hover:bg-rose-50/70' : 'hover:bg-slate-50/70'}`}
                      >
                        {/* Selection Checkbox */}
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => onToggleSelectItem(item)}
                            className={`w-11 h-11 rounded-lg border flex items-center justify-center transition cursor-pointer ${
                              isSelected
                                ? 'bg-[var(--theme-main)] border-[var(--theme-main)] text-[var(--theme-on-main)] shadow-xs'
                                : 'bg-white border-slate-300 hover:border-slate-400'
                            }`}
                            aria-label={`เลือก ${item.name}`}
                            aria-pressed={isSelected}
                          >
                            {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                          </button>
                        </td>

                        {/* Name / Color / Size / Type */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <InventoryItemImage item={item} />
                            <span className="font-bold text-slate-900 text-sm">{item.name}</span>
                            {isAsset && toolInfo && (serverMode || toolInfo.units.length > 0) && (
                              <button
                                type="button"
                                onClick={() => toggleExpandItem(itemId)}
                                className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 cursor-pointer"
                                title="แสดงรหัสรายชิ้นทั้งหมด"
                              >
                                <span>{toolInfo.units.length} ชิ้น</span>
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-slate-500">
                            {swatchClass && (
                              <span className={`w-3 h-3 rounded-full border shrink-0 ${swatchClass}`} />
                            )}
                            {item.color && (
                              <span className="font-semibold text-slate-700">{item.color}</span>
                            )}
                            {item.size && (
                              <span className="font-medium text-slate-600">· ขนาด: {item.size}</span>
                            )}
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                              {catName}
                            </span>
                            {item.code && (
                              <span className="font-mono text-slate-400 text-xs">({item.code})</span>
                            )}
                          </div>
                        </td>

                        {/* Available Quantity */}
                        <td className="py-3 px-4">
                          <div className="flex items-baseline gap-1">
                            <span className={`text-lg font-black tabular-nums font-mono ${availableQty === 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                              {availableQty}
                            </span>
                            <span className="text-xs text-slate-500 font-medium">
                              {item.unit || (isAsset ? 'เครื่อง' : 'ชิ้น')}
                            </span>
                          </div>
                          {isLowStock && (
                            <div className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 bg-amber-50 text-amber-800 rounded text-xs font-bold border border-amber-200">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span>ใกล้หมด (เกณฑ์ {minThreshold})</span>
                            </div>
                          )}
                        </td>

                        {/* Usage & Tool Units Summary */}
                        <td className="py-3 px-4">
                          {isAsset ? (
                            <div className="text-xs text-slate-600 space-y-0.5">
                              {toolInfo && toolInfo.borrowed > 0 ? (
                                <div className="font-bold text-amber-700">
                                  กำลังยืมอยู่ {toolInfo.borrowed} {item.unit || 'ชิ้น'}
                                </div>
                              ) : (
                                <span className="text-emerald-700 font-semibold">พร้อมเบิกใช้งานทั้งหมด</span>
                              )}
                              <div className="text-slate-400 text-xs">
                                รหัสรายชิ้นทั้งหมด {toolInfo?.total || 0} ชิ้น
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500">
                              {isReusable ? 'วัสดุใช้ซ้ำ · รับคืนได้ตามจริง' : 'วัสดุสิ้นเปลือง · ตัดยอดเมื่อเบิก'}
                            </div>
                          )}
                        </td>

                        {/* Storage Location */}
                        <td className="py-3 px-4 text-xs font-semibold text-slate-700">
                          {item.storage_location || '—'}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isAsset && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onOpenAddUnit && onOpenAddUnit(item)}
                                  className="min-h-[44px] px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 transition flex items-center gap-1 cursor-pointer"
                                  title="เพิ่มรหัสประจำชิ้นเครื่องมือใหม่"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>เพิ่มรหัส</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onOpenSinglePrint && onOpenSinglePrint(item)}
                                  className="min-h-[44px] px-2.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer flex items-center"
                                  title="พิมพ์ฉลาก QR"
                                >
                                  <QrCode className="w-4 h-4" />
                                </button>
                              </>
                            )}

                            <button
                              type="button"
                              onClick={() => onOpenEditItem && onOpenEditItem(item)}
                              className="min-h-[44px] px-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer flex items-center"
                              title="แก้ไขรายละเอียด"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => onToggleSelectItem(item)}
                              className={`min-h-[44px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center ${
                                isSelected
                                  ? 'bg-[var(--theme-light)] text-[var(--theme-ink)] hover:bg-[var(--theme-light)]'
                                  : 'bg-[var(--theme-light)] hover:bg-[var(--theme-light)] text-[var(--theme-ink)]'
                              }`}
                            >
                              {isSelected ? 'เลือกแล้ว' : 'เบิกใช้'}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Sub-Row showing individual unit identities */}
                      {isExpanded && isAsset && toolInfo && (
                        <tr className="bg-slate-50/80 border-b border-slate-200">
                          <td colSpan={6} className="py-3 px-6">
                            <div className="space-y-2">
                              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <QrCode className="w-3.5 h-3.5 text-[var(--theme-ink)]" />
                                <span>รายชื่อรหัสประจำชิ้นทั้งหมดของ {item.name}:</span>
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                {toolInfo.units.map((u) => {
                                  const status = String(u.status || '').toUpperCase();
                                  const isAvail = (status === 'AVAILABLE' || !status) && !u.borrowed_by;
                                  return (
                                    <div
                                      key={u.unit_code}
                                      className="p-2 bg-white rounded-lg border border-slate-200 text-xs flex items-center justify-between"
                                    >
                                      <div>
                                        <span className="font-mono font-bold text-slate-900">{u.unit_code}</span>
                                        <div className="text-slate-500 mt-0.5">
                                          {isAvail ? (
                                            <span className="text-emerald-700 font-bold">พร้อมใช้ในคลัง</span>
                                          ) : (
                                            <span className="text-amber-800 font-bold">
                                              อยู่กับ: {u.borrowed_by || 'ผู้ยืม'}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                        isAvail ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                      }`}>
                                        {status}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredItems.length === 0 ? (
            <div className="py-12 px-4 text-center text-slate-400">
              <Package className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="font-semibold text-slate-600 text-sm">ไม่พบรายการพัสดุ</p>
              <p className="text-xs text-slate-400 mt-1">ลองล้างตัวกรองหรือเพิ่มพัสดุใหม่</p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const itemId = String(item.id);
              const isSelected = selectedItemIds.includes(itemId);
              const isAsset = String(item.item_type || '').toLowerCase() === 'asset' || String(item.item_type || '').toLowerCase() === 'tool';
              const isReusable = String(item.item_type || '').toLowerCase() === 'reusable' || String(item.item_type || '').toLowerCase() === 'reusable_material';
              const isExpanded = expandedItemIds.has(itemId);

              let availableQty = 0;
              let toolInfo = null;
              if (isAsset) {
                toolInfo = toolUnitsMap.get(itemId) || { total: 0, available: 0, borrowed: 0, broken: 0, units: [] };
                availableQty = toolInfo.available;
              } else {
                availableQty = Math.max(0, Number(item.current_stock) || 0);
              }

              const swatchClass = getSwatchStyle(item.color);

              return (
                <div
                  key={item.id}
                  className={`p-3.5 flex flex-col gap-2.5 transition ${isSelected ? 'bg-rose-50/50' : 'bg-white'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <InventoryItemImage item={item} className="w-14 h-14" />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-900 text-sm sm:text-base leading-snug">
                        {item.name}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-slate-500">
                        {swatchClass && (
                          <span className={`w-3 h-3 rounded-full border shrink-0 ${swatchClass}`} />
                        )}
                        {item.color && (
                          <span className="font-semibold text-slate-700">{item.color}</span>
                        )}
                        {item.size && (
                          <span className="font-medium text-slate-600">· {item.size}</span>
                        )}
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                          {categoryMap.get(String(item.category_id)) || (isAsset ? 'เครื่องมือ' : (isReusable ? 'วัสดุใช้ซ้ำ' : 'วัสดุ'))}
                        </span>
                        {item.storage_location && (
                          <span className="text-slate-500">· {item.storage_location}</span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-lg font-black tabular-nums font-mono text-slate-900">
                        {availableQty} <span className="text-xs font-normal text-slate-500">{item.unit || 'ชิ้น'}</span>
                      </div>
                      <span className="text-xs text-slate-500 block">พร้อมใช้</span>
                    </div>
                  </div>

                  {isAsset && toolInfo && toolInfo.borrowed > 0 && (
                    <div className="text-xs font-semibold text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200/80">
                      ยืมอยู่ {toolInfo.borrowed} {item.unit || 'ชิ้น'}
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1">
                      {isAsset && (
                        <>
                          <button
                            type="button"
                            onClick={() => toggleExpandItem(itemId)}
                            className="min-h-[44px] px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200 flex items-center gap-1"
                          >
                            <span>รหัส ({toolInfo?.units?.length || 0})</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenAddUnit && onOpenAddUnit(item)}
                            className="min-h-[44px] px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200"
                          >
                            + รหัส
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenSinglePrint && onOpenSinglePrint(item)}
                            className="min-h-[44px] px-2.5 text-slate-500 hover:bg-slate-100 rounded-lg flex items-center"
                            title="พิมพ์ฉลาก"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenEditItem && onOpenEditItem(item)}
                        className="min-h-[44px] px-2.5 text-slate-400 hover:bg-slate-100 rounded-lg flex items-center"
                        title="แก้ไข"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onToggleSelectItem(item)}
                      className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--theme-main)] text-[var(--theme-on-main)] shadow-xs'
                          : 'bg-[var(--theme-light)] hover:bg-[var(--theme-light)] text-[var(--theme-ink)] border border-[var(--theme-main)]'
                      }`}
                    >
                      {isSelected ? <Check className="w-4 h-4 stroke-[3]" /> : null}
                      <span>{isSelected ? 'เลือกแล้ว' : 'เบิกใช้'}</span>
                    </button>
                  </div>

                  {/* Expanded unit list on mobile */}
                  {isExpanded && isAsset && toolInfo && (
                    <div className="pt-2 border-t border-slate-200 space-y-1.5">
                      <div className="text-xs font-bold text-slate-700">รหัสรายชิ้น ({toolInfo.units.length}):</div>
                      <div className="space-y-1">
                        {toolInfo.units.map(u => (
                          <div key={u.unit_code} className="p-1.5 bg-slate-50 rounded border border-slate-200 text-xs flex justify-between">
                            <span className="font-mono font-bold text-slate-800">{u.unit_code}</span>
                            <span className="text-slate-500">{u.borrowed_by ? `อยู่กับ ${u.borrowed_by}` : 'พร้อมใช้'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {serverMode && <div className="p-3 flex flex-wrap gap-2">
          {Object.entries(unitsPages).filter(([id, page]) => expandedItemIds.has(id) && page.has_more).map(([id, page]) => <button key={id} type="button" className="min-h-11 px-3 border rounded-lg" onClick={() => onLoadUnits?.(id, page.offset + page.limit)}>โหลดเครื่องมือเพิ่มเติม</button>)}
          <div ref={loadMoreSentinel} className="w-full flex items-center justify-center min-h-[44px]" aria-live="polite">
            {serverPage?.has_more ? <button type="button" aria-label="โหลดเพิ่มเติม" disabled={serverPage.loading} className="min-h-[44px] px-4 border border-slate-200 rounded-xl text-sm font-bold text-[var(--theme-ink)] cursor-pointer disabled:opacity-50" onClick={() => onLoadMore?.()}>{serverPage.loading ? 'กำลังโหลดรายการ…' : 'โหลดเพิ่มเติม'}</button>
              : serverPage?.loading && <span className="text-sm text-slate-500">กำลังโหลดรายการ…</span>}
          </div>
          {serverPage?.error && <span role="alert">{serverPage.error}</span>}
        </div>}
        {/* Table Foot */}
        <footer className="p-3 sm:px-4 bg-slate-50/70 border-t border-slate-200 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            แสดง {filteredItems.length} จากทั้งหมด {serverMode ? serverPage?.total_count || 0 : countsByType.all} รายการ
            {selectedItemIds.length > 0 && (
              <span className="font-bold text-[var(--theme-ink)] ml-1.5">
                (เลือกไว้ในตะกร้า {selectedItemIds.length} รายการ)
              </span>
            )}
          </div>
          <div className="text-slate-400 text-xs">
            * เครื่องมือคำนวณจำนวนพร้อมใช้จากรหัสชิ้นงานจริง
          </div>
        </footer>
      </section>
    </div>
  );
}
