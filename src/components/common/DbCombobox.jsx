import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Database, Loader2, Search, X } from 'lucide-react';
import { db } from '../../services/db';
import { getActiveClient } from '../../services/supabaseClient';

const LOCATION_COLUMNS = 'id,name,zone,gate_info,parking_height_limit,dock_contact_phone,default_map_link,loading_dock_map_link,delivery_tips,is_active';
const ARTIST_COLUMNS = 'id,name,agency,fandom_name';
const CUSTOMER_COLUMNS = 'id,name,phone,line_id,social_account,email,vip_tier';
const INVENTORY_COLUMNS = 'id,code,name,category_id,item_type,unit,current_stock,min_alert_threshold,average_cost,storage_location,color,size,status,is_active';
const PROJECT_LOOKUP_COLUMNS = 'id,name,artist_name,customer_name,location_name,project_datetime';

const TABLE_CONFIG = {
  delivery_locations: {
    dexieTable: 'delivery_locations',
    supabaseTable: 'delivery_locations',
    columns: LOCATION_COLUMNS,
    searchColumn: 'name',
    mapRow: (row) => {
      if (!row?.name || row.is_active === false) return null;
      return {
        id: row.id || row.name,
        value: row.name,
        label: row.name,
        badge: row.zone ? `โซน ${row.zone}` : '',
        sublabel: [row.gate_info, row.parking_height_limit ? `สูงจำกัด ${row.parking_height_limit}` : '']
          .filter(Boolean)
          .join(' • '),
        keywords: `${row.name} ${row.zone || ''} ${Array.isArray(row.aliases) ? row.aliases.join(' ') : ''} ${row.gate_info || ''} ${row.delivery_tips || ''}`,
        raw: row
      };
    }
  },
  artists: {
    dexieTable: 'artists',
    supabaseTable: 'artists',
    columns: ARTIST_COLUMNS,
    searchColumn: 'name',
    mapRow: (row) => {
      if (!row?.name) return null;
      return {
        id: row.id || row.name,
        value: row.name,
        label: row.name,
        badge: row.agency || '',
        sublabel: row.fandom_name ? `Fandom: ${row.fandom_name}` : '',
        keywords: `${row.name} ${row.agency || ''} ${row.fandom_name || ''}`,
        raw: row
      };
    }
  },
  customers: {
    dexieTable: 'customers',
    supabaseTable: 'customers',
    columns: CUSTOMER_COLUMNS,
    searchColumn: 'name',
    mapRow: (row) => {
      if (!row?.name) return null;
      const contactParts = [
        row.phone || row.customerPhone || '',
        (row.line_id || row.customerLine) ? `LINE: ${row.line_id || row.customerLine}` : ''
      ].filter(Boolean);
      return {
        id: row.id || row.name,
        value: row.name,
        label: row.name,
        badge: row.vip_tier && row.vip_tier !== 'Standard' ? row.vip_tier : '',
        sublabel: contactParts.join(' • '),
        keywords: `${row.name} ${row.phone || ''} ${row.line_id || ''} ${row.email || ''}`,
        raw: row
      };
    }
  },
  projects: {
    dexieTable: 'projects',
    supabaseTable: 'projects',
    columns: PROJECT_LOOKUP_COLUMNS,
    searchColumn: 'name',
    mapRow: (row) => {
      const id = row?.id ? String(row.id) : '';
      const name = row?.name || row?.project || '';
      if (!id && !name) return null;
      const artist = row.artist_name || row.artist || '';
      const customer = row.customer_name || row.customer || '';
      return {
        id: id || name,
        value: id || name,
        label: name ? `${name}` : id,
        badge: id ? `#${id.slice(0, 8)}` : '',
        sublabel: [artist ? `ศิลปิน: ${artist}` : '', customer ? `ลูกค้า: ${customer}` : '']
          .filter(Boolean)
          .join(' • '),
        keywords: `${id} ${name} ${artist} ${customer} ${row.location_name || row.location || ''}`,
        raw: row
      };
    }
  },
  inventory_items: {
    dexieTable: 'inventory_items',
    supabaseTable: 'inventory_items',
    columns: INVENTORY_COLUMNS,
    searchColumn: 'name',
    mapRow: (row) => {
      if (!row?.name || row.is_active === false || row.status === 'disposed') return null;
      const stockText =
        row.current_stock !== undefined && row.current_stock !== null
          ? `คงเหลือ ${Number(row.current_stock || 0)} ${row.unit || 'ชิ้น'}`
          : '';
      return {
        id: row.id || row.code || row.name,
        value: row.name,
        label: row.name,
        badge: row.code || '',
        sublabel: stockText,
        keywords: `${row.name} ${row.code || ''} ${row.storage_location || ''}`,
        raw: row
      };
    }
  },
  staff: {
    dexieTable: 'staff',
    supabaseTable: null,
    columns: '',
    searchColumn: 'full_name',
    mapRow: (row) => {
      const name = row?.full_name || row?.name || row?.nickname || '';
      if (!name || row?.is_active === false) return null;
      return {
        id: row.id || name,
        value: name,
        label: name,
        badge: row.nickname || '',
        sublabel: row.phone || '',
        keywords: `${name} ${row.nickname || ''} ${row.phone || ''}`,
        raw: row
      };
    }
  }
};

function normalizeOption(opt, tableCfg) {
  if (!opt) return null;
  if (typeof opt === 'string') {
    const trimmed = opt.trim();
    if (!trimmed) return null;
    return {
      id: trimmed,
      value: trimmed,
      label: trimmed,
      badge: '',
      sublabel: '',
      keywords: trimmed,
      raw: opt
    };
  }
  if (opt.value !== undefined && opt.label !== undefined) {
    return {
      id: opt.id || opt.value,
      value: String(opt.value),
      label: String(opt.label),
      badge: opt.badge || '',
      sublabel: opt.sublabel || '',
      keywords: opt.keywords || `${opt.label} ${opt.value} ${opt.badge || ''} ${opt.sublabel || ''}`,
      raw: opt.raw || opt
    };
  }
  if (tableCfg?.mapRow) {
    return tableCfg.mapRow(opt);
  }
  const fallbackName = opt.name || opt.label || opt.title || opt.id;
  if (!fallbackName) return null;
  return {
    id: opt.id || fallbackName,
    value: String(fallbackName),
    label: String(fallbackName),
    badge: opt.zone ? `โซน ${opt.zone}` : opt.code || '',
    sublabel: opt.phone || opt.gate_info || '',
    keywords: `${fallbackName} ${opt.zone || ''} ${Array.isArray(opt.aliases) ? opt.aliases.join(' ') : ''} ${opt.phone || ''} ${opt.code || ''}`,
    raw: opt
  };
}

/**
 * DbCombobox
 * Reusable DB-backed searchable dropdown replacing native HTML5 datalist inputs.
 * - Reads instant local cache (props `options` + IndexedDB Dexie table)
 * - Performs bounded Zero-Egress Supabase lookup (`limit(20)`, explicit columns only) when searching
 * - Includes built-in [✕] clear button and respects locked/disabled modal state
 */
export default function DbCombobox({
  value = '',
  onChange,
  onSelectOption,
  options = [],
  dbTable = null,
  placeholder = 'พิมพ์ค้นหาหรือเลือกจากรายการ...',
  disabled = false,
  required = false,
  id,
  name,
  ariaLabel,
  leftIcon: LeftIcon = null,
  containerClassName = '',
  inputClassName = '',
  emptyText = 'ไม่พบรายการในฐานข้อมูล (พิมพ์ข้อความใหม่ได้เลย)',
  maxResults = 30
}) {
  const generatedId = useId();
  const listboxId = `${id || generatedId}-listbox`;
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const hasUserTypedRef = useRef(false);

  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dbItems, setDbItems] = useState([]);
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState(null);

  const tableCfg = dbTable ? TABLE_CONFIG[dbTable] || null : null;
  const stringValue = value === null || value === undefined ? '' : String(value);
  const hasValue = stringValue.trim().length > 0;

  // Close if disabled becomes true (e.g., modal switched to view-only lock)
  useEffect(() => {
    if (disabled && isOpen) {
      hasUserTypedRef.current = false;
      setIsOpen(false);
    }
  }, [disabled, isOpen]);

  // Load IndexedDB table authoritatively when dropdown opens (zero network cost)
  useEffect(() => {
    if (!isOpen || !tableCfg?.dexieTable) return undefined;
    let cancelled = false;

    const loadDexie = async () => {
      try {
        const table = db?.[tableCfg.dexieTable];
        if (!table || typeof table.toArray !== 'function') return;
        const rows = await table.toArray();
        if (!cancelled && Array.isArray(rows)) {
          const byKey = new Map();
          rows.forEach((r) => {
            const norm = tableCfg.mapRow(r);
            if (norm) byKey.set(norm.value.toLowerCase(), norm);
          });
          setDbItems(Array.from(byKey.values()));
        }
      } catch {
        // Ignore IndexedDB unavailability in SSR / unit tests
      }
    };

    loadDexie();
    return () => {
      cancelled = true;
    };
  }, [isOpen, tableCfg]);

  // Merge prop options + DB options without duplicates
  const mergedOptions = useMemo(() => {
    const byKey = new Map();
    const list = Array.isArray(options) ? options : [];
    list.forEach((rawOpt) => {
      const norm = normalizeOption(rawOpt, tableCfg);
      if (norm) {
        const key = `${norm.value.toLowerCase()}::${norm.badge || ''}`;
        if (!byKey.has(key)) byKey.set(key, norm);
      }
    });
    dbItems.forEach((norm) => {
      if (norm) {
        const key = `${norm.value.toLowerCase()}::${norm.badge || ''}`;
        if (!byKey.has(key)) byKey.set(key, norm);
      }
    });
    return Array.from(byKey.values());
  }, [options, dbItems, tableCfg]);

  // Bounded live Supabase search when dropdown is open and user types (or local list is empty)
  useEffect(() => {
    if (!isOpen || disabled || !tableCfg?.supabaseTable) return undefined;

    const q = stringValue.trim();
    const shouldFetchInitial = dbItems.length === 0 && (!Array.isArray(options) || options.length === 0);
    if (!q && !shouldFetchInitial) return undefined;

    if (q && !hasUserTypedRef.current) {
      const qLower = q.toLowerCase();
      const hasLocalMatch = mergedOptions.some((item) => {
        const labelLower = item.label.toLowerCase();
        const valueLower = item.value.toLowerCase();
        const hay = (item.keywords || `${item.label} ${item.sublabel} ${item.badge}`).toLowerCase();
        return labelLower === qLower || valueLower === qLower || hay.includes(qLower);
      });
      if (hasLocalMatch) return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const client = typeof getActiveClient === 'function' ? getActiveClient() : null;
        if (!client || typeof client.from !== 'function') return;

        setIsLoadingRemote(true);
        let query = client.from(tableCfg.supabaseTable).select(tableCfg.columns);
        if (q) {
          const safeQ = q.replace(/[%_,]/g, ' ').trim();
          if (safeQ) {
            if (dbTable === 'projects') {
              query = query.or(`name.ilike.%${safeQ}%,artist_name.ilike.%${safeQ}%,customer_name.ilike.%${safeQ}%`);
            } else if (dbTable === 'inventory_items') {
              query = query.or(`name.ilike.%${safeQ}%,code.ilike.%${safeQ}%`);
            } else {
              query = query.ilike(tableCfg.searchColumn, `%${safeQ}%`);
            }
          }
        }
        const { data, error } = await query.limit(20);
        if (!cancelled && !error && Array.isArray(data)) {
          setDbItems((prev) => {
            const byKey = new Map();
            prev.forEach((item) => byKey.set(item.value.toLowerCase(), item));
            data.forEach((row) => {
              const norm = tableCfg.mapRow(row);
              if (norm) byKey.set(norm.value.toLowerCase(), norm);
            });
            return Array.from(byKey.values());
          });
        }
      } catch {
        // Offline / test fallback
      } finally {
        if (!cancelled) setIsLoadingRemote(false);
      }
    }, q ? 220 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, disabled, dbTable, tableCfg, stringValue, dbItems.length, options, mergedOptions]);

  const filteredOptions = useMemo(() => {
    const q = stringValue.trim().toLowerCase();
    if (!q) return mergedOptions.slice(0, maxResults);

    // If current value matches an option strictly and user just opened dropdown, still prioritize matches cleanly
    const scored = [];
    for (const item of mergedOptions) {
      const labelLower = item.label.toLowerCase();
      const valueLower = item.value.toLowerCase();
      const hay = (item.keywords || `${item.label} ${item.sublabel} ${item.badge}`).toLowerCase();
      if (labelLower === q || valueLower === q) {
        scored.push({ item, score: 0 });
      } else if (labelLower.startsWith(q) || valueLower.startsWith(q)) {
        scored.push({ item, score: 1 });
      } else if (hay.includes(q)) {
        scored.push({ item, score: 2 });
      }
    }
    scored.sort((a, b) => a.score - b.score || a.item.label.localeCompare(b.item.label, 'th'));
    return scored.slice(0, maxResults).map((s) => s.item);
  }, [mergedOptions, stringValue, maxResults]);

  // Compute floating portal position synchronously so dropdown never flashes or flies in
  const computeDropdownStyle = useCallback(() => {
    if (!inputRef.current || typeof window === 'undefined') return null;
    const rect = inputRef.current.getBoundingClientRect();
    const viewportW = window.innerWidth || 1024;
    const viewportH = window.innerHeight || 768;

    // Anchor scrolled completely out of the viewport (real browser only)
    if (rect.width > 0 && rect.height > 0 && (rect.bottom < 0 || rect.top > viewportH)) {
      return { outOfView: true };
    }

    const width = Math.min(Math.max(rect.width, 200), Math.max(200, viewportW - 16));
    const left = Math.min(Math.max(8, rect.left), Math.max(8, viewportW - width - 8));
    const spaceBelow = viewportH - rect.bottom;
    const spaceAbove = rect.top;
    const openUpward = rect.height > 0 && spaceBelow < 220 && spaceAbove > spaceBelow;

    if (openUpward) {
      return {
        position: 'fixed',
        left,
        bottom: viewportH - rect.top + 6,
        width,
        maxHeight: Math.min(240, Math.max(120, spaceAbove - 16)),
        zIndex: 300
      };
    }

    return {
      position: 'fixed',
      left,
      top: rect.bottom + 6,
      width,
      maxHeight: Math.min(240, Math.max(120, spaceBelow - 16)),
      zIndex: 300
    };
  }, []);

  const openDropdown = useCallback(() => {
    if (disabled) return;
    const pos = computeDropdownStyle();
    if (pos?.outOfView) return;
    if (pos) setDropdownStyle(pos);
    setIsOpen(true);
  }, [disabled, computeDropdownStyle]);

  const closeDropdown = useCallback(() => {
    hasUserTypedRef.current = false;
    setIsOpen(false);
    setActiveIndex(-1);
    setDropdownStyle(null);
  }, []);

  const updateDropdownPosition = useCallback(() => {
    const pos = computeDropdownStyle();
    if (!pos) return;
    if (pos.outOfView) {
      closeDropdown();
      return;
    }
    setDropdownStyle(pos);
  }, [computeDropdownStyle, closeDropdown]);

  useLayoutEffect(() => {
    if (!isOpen || disabled) return undefined;
    updateDropdownPosition();
    if (typeof window === 'undefined') return undefined;
    window.addEventListener('scroll', updateDropdownPosition, true);
    window.addEventListener('resize', updateDropdownPosition);
    return () => {
      window.removeEventListener('scroll', updateDropdownPosition, true);
      window.removeEventListener('resize', updateDropdownPosition);
    };
  }, [isOpen, disabled, updateDropdownPosition]);

  // Outside click listener
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return undefined;
    const handlePointerDown = (e) => {
      const clickedInsideRoot = rootRef.current && rootRef.current.contains(e.target);
      const clickedInsideDropdown = dropdownRef.current && dropdownRef.current.contains(e.target);
      if (!clickedInsideRoot && !clickedInsideDropdown) {
        closeDropdown();
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen, closeDropdown]);

  const commitOption = useCallback(
    (opt) => {
      if (!opt || disabled) return;
      onChange?.(opt.value);
      onSelectOption?.(opt);
      closeDropdown();
    },
    [disabled, onChange, onSelectOption, closeDropdown]
  );

  const handleClear = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    onChange?.('');
    onSelectOption?.(null);
    setActiveIndex(-1);
    openDropdown();
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        openDropdown();
        setActiveIndex(0);
      } else {
        setActiveIndex((prev) => (filteredOptions.length ? (prev + 1) % filteredOptions.length : -1));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isOpen && filteredOptions.length) {
        setActiveIndex((prev) => (prev <= 0 ? filteredOptions.length - 1 : prev - 1));
      }
    } else if (e.key === 'Enter' && isOpen && activeIndex >= 0 && filteredOptions[activeIndex]) {
      e.preventDefault();
      commitOption(filteredOptions[activeIndex]);
    } else if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      e.stopPropagation();
      closeDropdown();
    }
  };

  const defaultInputClasses =
    'w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm text-slate-800 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors';

  const leftPadClass = LeftIcon ? 'pl-9' : '';
  const rightPadClass = disabled ? 'pr-8' : hasValue ? 'pr-14' : 'pr-9';

  return (
    <div ref={rootRef} className={`relative ${containerClassName}`}>
      {LeftIcon && (
        <LeftIcon
          aria-hidden="true"
          className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10"
        />
      )}

      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-label={ariaLabel || placeholder}
        value={stringValue}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => {
          openDropdown();
        }}
        onClick={() => {
          openDropdown();
        }}
        onChange={(e) => {
          if (disabled) return;
          hasUserTypedRef.current = true;
          onChange?.(e.target.value);
          openDropdown();
          setActiveIndex(-1);
        }}
        onKeyDown={handleKeyDown}
        className={`${inputClassName || defaultInputClasses} ${leftPadClass} ${rightPadClass}`}
      />

      {!disabled && hasValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-7 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          title="ล้างคำค้นหา"
          aria-label="ล้างคำค้นหา"
        >
          <X aria-hidden="true" className="w-3.5 h-3.5" />
        </button>
      )}

      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (isOpen) {
            closeDropdown();
          } else {
            openDropdown();
            inputRef.current?.focus();
          }
        }}
        aria-label="เปิดรายการตัวเลือก"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg text-slate-400 hover:text-slate-700 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center transition-colors cursor-pointer"
      >
        {isLoadingRemote ? (
          <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin text-indigo-500" />
        ) : (
          <ChevronDown
            aria-hidden="true"
            className={`w-4 h-4 transition-transform duration-150 ${isOpen ? 'rotate-180 text-indigo-600' : ''}`}
          />
        )}
      </button>

      {isOpen && !disabled && (() => {
        const activeStyle = dropdownStyle || computeDropdownStyle();
        if (!activeStyle || activeStyle.outOfView) return null;

        const listboxNode = (
          <div
            ref={dropdownRef}
            id={listboxId}
            role="listbox"
            style={{
              position: activeStyle.position,
              left: activeStyle.left,
              top: activeStyle.top,
              bottom: activeStyle.bottom,
              width: activeStyle.width,
              zIndex: activeStyle.zIndex
            }}
            className="bg-white border border-slate-200/90 rounded-2xl shadow-xl overflow-hidden"
          >
            {dbTable && (
              <div className="px-3 py-1.5 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <Database aria-hidden="true" className="w-3 h-3 text-indigo-500" />
                  <span>ค้นหาจากฐานข้อมูล ({filteredOptions.length})</span>
                </span>
                {isLoadingRemote && <span className="text-indigo-600 font-medium">กำลังค้นหา...</span>}
              </div>
            )}

            <div
              style={activeStyle.maxHeight ? { maxHeight: activeStyle.maxHeight } : undefined}
              className="max-h-56 overflow-y-auto overscroll-contain divide-y divide-slate-100/80"
            >
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt, idx) => {
                  const isSelected = opt.value.toLowerCase() === stringValue.trim().toLowerCase();
                  const isHighlighted = idx === activeIndex;
                  return (
                    <button
                      key={`${opt.id}-${idx}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => commitOption(opt)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                        isHighlighted
                          ? 'bg-indigo-50/90 text-indigo-950'
                          : isSelected
                            ? 'bg-slate-50 text-slate-900'
                            : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-semibold truncate">{opt.label}</span>
                          {opt.badge && (
                            <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-bold shrink-0">
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        {opt.sublabel && (
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">{opt.sublabel}</p>
                        )}
                      </div>
                      {isSelected && (
                        <Check aria-hidden="true" className="w-4 h-4 text-indigo-600 shrink-0" />
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="px-3.5 py-3 text-xs text-slate-500 flex items-center gap-2">
                  <Search aria-hidden="true" className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{emptyText}</span>
                </div>
              )}
            </div>
          </div>
        );

        return typeof document !== 'undefined' && document.body
          ? createPortal(listboxNode, document.body)
          : listboxNode;
      })()}
    </div>
  );
}
