import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import PersistentPage, { PageActiveContext } from './PersistentPage';

const FallbackActiveContext = createContext(true);
const ActiveContext = PageActiveContext || PersistentPage?.PageActiveContext || FallbackActiveContext;

/**
 * HeaderFilterPortal
 * Connects each page's Search & Filter controls into the unified 3-Zone AppBar (<header>):
 * - Wide PC (lg+): Centered Spotlight pill search bar in `#app-header-center-search-slot`,
 *   plus clean filter trigger in `#app-header-filter-slot` (or inside `[⋯]` Overflow Menu when > 3 actions).
 * - Mobile / Portrait Tablet (< lg): Minimal borderless stroke [🔍] icon in `#app-header-mobile-search-trigger-slot`
 *   and [🎚️] icon in `#app-header-filter-slot`; tapping [🔍] opens `#app-header-mobile-search` (16pt padding).
 * - Secondary filters (`children`): appear inside collapsible `#app-header-filter-drawer` right beneath <header>.
 * - Falls back gracefully when global AppBar DOM slots are absent (unit tests / SSR).
 */
export default function HeaderFilterPortal({
  searchValue = '',
  onSearchChange,
  placeholder = 'ค้นหา...',
  activeFilterCount = 0,
  onReset,
  children,
  active
}) {
  const contextActive = useContext(ActiveContext);
  const isPageActive = active !== undefined ? Boolean(active) : Boolean(contextActive);

  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [targets, setTargets] = useState(() => {
    if (typeof document === 'undefined' || typeof document.getElementById !== 'function') {
      return {
        centerSearchSlot: null,
        mobileSearchTriggerSlot: null,
        filterSlot: null,
        mobileOverlay: null,
        drawer: null
      };
    }
    return {
      centerSearchSlot: document.getElementById('app-header-center-search-slot'),
      mobileSearchTriggerSlot: document.getElementById('app-header-mobile-search-trigger-slot'),
      filterSlot: document.getElementById('app-header-filter-slot'),
      mobileOverlay: document.getElementById('app-header-mobile-search'),
      drawer: document.getElementById('app-header-filter-drawer')
    };
  });
  const centerInputRef = useRef(null);
  const standaloneInputRef = useRef(null);
  const mobileInputRef = useRef(null);

  const hasFilters = Boolean(children);
  const hasSearch = typeof onSearchChange === 'function';
  const hasActiveSearch = Boolean(searchValue && String(searchValue).trim().length > 0);
  const isDirty = hasActiveSearch || activeFilterCount > 0;

  const handleResetAll = useCallback(() => {
    if (onReset) {
      onReset();
    } else if (onSearchChange) {
      onSearchChange('');
    }
  }, [onReset, onSearchChange]);

  const resetHandlerRef = useRef(handleResetAll);
  resetHandlerRef.current = handleResetAll;

  useEffect(() => {
    if (!isPageActive) {
      setIsMobileSearchOpen(false);
      setIsFilterOpen(false);
      return undefined;
    }
    if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return undefined;

    const resolveTargets = () => {
      const centerSearchSlot = document.getElementById('app-header-center-search-slot');
      const mobileSearchTriggerSlot = document.getElementById('app-header-mobile-search-trigger-slot');
      const filterSlot = document.getElementById('app-header-filter-slot');
      const mobileOverlay = document.getElementById('app-header-mobile-search');
      const drawer = document.getElementById('app-header-filter-drawer');
      setTargets((prev) => {
        if (
          prev.centerSearchSlot === centerSearchSlot &&
          prev.mobileSearchTriggerSlot === mobileSearchTriggerSlot &&
          prev.filterSlot === filterSlot &&
          prev.mobileOverlay === mobileOverlay &&
          prev.drawer === drawer
        ) {
          return prev;
        }
        return { centerSearchSlot, mobileSearchTriggerSlot, filterSlot, mobileOverlay, drawer };
      });
    };

    resolveTargets();
    const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(resolveTargets) : null;
    return () => {
      if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
    };
  }, [isPageActive, hasFilters, hasSearch]);

  // Sync filter state & listen for toggle commands from AppBar [⋯] Overflow Menu
  useEffect(() => {
    if (typeof window === 'undefined' || !isPageActive) return undefined;

    const EventCtor = window.CustomEvent || CustomEvent;
    window.dispatchEvent(
      new EventCtor('header-filter-state-sync', {
        detail: { hasFilters, isFilterOpen, activeFilterCount, isDirty }
      })
    );

    const handleToggleEvent = () => {
      if (hasFilters) {
        if (hasSearch && typeof window !== 'undefined' && window.innerWidth < 1024) {
          setIsMobileSearchOpen(true);
        }
        setIsFilterOpen((v) => !v);
      }
    };
    const handleResetEvent = () => {
      resetHandlerRef.current?.();
    };

    window.addEventListener('trigger-toggle-header-filter', handleToggleEvent);
    window.addEventListener('trigger-reset-header-filter', handleResetEvent);
    return () => {
      window.removeEventListener('trigger-toggle-header-filter', handleToggleEvent);
      window.removeEventListener('trigger-reset-header-filter', handleResetEvent);
    };
  }, [isPageActive, hasFilters, isFilterOpen, activeFilterCount, isDirty]);

  useEffect(() => {
    if (isMobileSearchOpen && mobileInputRef.current) {
      mobileInputRef.current.focus();
    }
  }, [isMobileSearchOpen]);

  useEffect(() => {
    if (!isMobileSearchOpen && !isFilterOpen) return undefined;
    if (typeof window === 'undefined') return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isMobileSearchOpen) setIsMobileSearchOpen(false);
        else if (isFilterOpen) setIsFilterOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileSearchOpen, isFilterOpen]);

  if (!isPageActive) return null;

  const hasAnyHeaderPortal = Boolean(
    targets.centerSearchSlot || targets.mobileSearchTriggerSlot || targets.filterSlot
  );

  // Standalone / SSR test fallback when global AppBar DOM slots are not present
  if (!hasAnyHeaderPortal) {
    return (
      <div className="space-y-2">
        {hasSearch && (
          <div className="relative">
            <input
              ref={standaloneInputRef}
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={placeholder}
              className="w-full h-10 pl-3 pr-9 bg-white border border-slate-200 rounded-xl text-xs"
            />
            {hasActiveSearch && (
              <button
                type="button"
                onClick={() => {
                  onSearchChange('');
                  standaloneInputRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
                title="ล้างคำค้นหา"
                aria-label="ล้างคำค้นหา"
              >
                <X aria-hidden="true" className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    );
  }

  // 1. Wide PC (lg+) Centered Spotlight Search Bar + Minimal Icon-Only Filter beside it
  const centerSearchNode =
    (hasSearch || hasFilters) && targets.centerSearchSlot
      ? createPortal(
          <div className="w-full max-w-lg mx-auto flex items-center justify-center gap-2">
            {hasSearch && (
              <div className="flex-1 min-w-0 max-w-md flex items-center relative h-10 rounded-full bg-slate-100/90 hover:bg-slate-200/70 focus-within:bg-white border border-transparent focus-within:border-slate-300 focus-within:ring-2 focus-within:ring-violet-500/20 transition-colors">
                <Search
                  aria-hidden="true"
                  className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                />
                <input
                  ref={centerInputRef}
                  type="text"
                  value={searchValue}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={placeholder}
                  aria-label={placeholder}
                  className="w-full h-full pl-10 pr-9 bg-transparent focus:outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400 rounded-full"
                />
                {hasActiveSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      onSearchChange('');
                      centerInputRef.current?.focus();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-600"
                    title="ล้างคำค้นหา"
                    aria-label="ล้างคำค้นหา"
                  >
                    <X aria-hidden="true" className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {hasFilters && (
              <button
                type="button"
                onClick={() => setIsFilterOpen((v) => !v)}
                className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-colors active:scale-95 cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 ${
                  isFilterOpen
                    ? 'bg-slate-900 text-white'
                    : activeFilterCount > 0
                      ? 'bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100'
                      : 'bg-slate-100/90 hover:bg-slate-200/75 text-slate-700 hover:text-slate-950'
                }`}
                title={isFilterOpen ? 'ซ่อนตัวกรอง' : 'ตัวกรองข้อมูล'}
                aria-label="ตัวกรอง"
                aria-expanded={isFilterOpen}
              >
                <SlidersHorizontal aria-hidden="true" className="w-[18px] h-[18px] stroke-[2]" />
                {activeFilterCount > 0 && (
                  <span
                    className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-extrabold flex items-center justify-center tabular-nums ring-2 ring-white ${
                      isFilterOpen ? 'bg-violet-500 text-white' : 'bg-violet-600 text-white'
                    }`}
                  >
                    {activeFilterCount}
                  </span>
                )}
              </button>
            )}
          </div>,
          targets.centerSearchSlot
        )
      : null;

  // 2. Mobile / Portrait Tablet (< lg) Minimal Clean Stroke [🔍] Icon Trigger
  //    Filter icon stays tucked inside the expanded search bar so AppBar keeps room for primary actions.
  const mobileSearchTriggerNode =
    hasSearch && targets.mobileSearchTriggerSlot
      ? createPortal(
          <button
            type="button"
            onClick={() => setIsMobileSearchOpen(true)}
            className={`relative min-w-9 min-h-9 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors active:scale-95 cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 ${
              hasActiveSearch || activeFilterCount > 0 || isFilterOpen
                ? 'bg-violet-50 text-violet-700'
                : 'text-slate-900 hover:bg-slate-100'
            }`}
            title="ค้นหาและตัวกรอง"
            aria-label="เปิดช่องค้นหา"
          >
            <Search aria-hidden="true" className="w-[20px] h-[20px] stroke-[2]" />
            {activeFilterCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-violet-600 text-white text-[10px] font-extrabold flex items-center justify-center tabular-nums ring-2 ring-white">
                {activeFilterCount}
              </span>
            ) : (
              hasActiveSearch && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-violet-600 ring-2 ring-white" />
              )
            )}
          </button>,
          targets.mobileSearchTriggerSlot
        )
      : null;

  // 3. Mobile / Portrait Tablet (< lg) Standalone Filter Trigger ONLY when page has filters WITHOUT search
  const filterTriggerNode =
    hasFilters && !hasSearch && targets.filterSlot
      ? createPortal(
          <button
            type="button"
            onClick={() => setIsFilterOpen((v) => !v)}
            className={`lg:hidden relative min-w-9 min-h-9 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-colors active:scale-95 cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 ${
              isFilterOpen
                ? 'bg-slate-900 text-white'
                : activeFilterCount > 0
                  ? 'bg-violet-50 text-violet-700 hover:bg-violet-100'
                  : 'text-slate-900 hover:bg-slate-100'
            }`}
            title={isFilterOpen ? 'ซ่อนตัวกรอง' : 'ตัวกรองข้อมูล'}
            aria-label="ตัวกรอง"
            aria-expanded={isFilterOpen}
          >
            <SlidersHorizontal aria-hidden="true" className="w-[19px] h-[19px] stroke-[2]" />
            {activeFilterCount > 0 && (
              <span
                className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-extrabold flex items-center justify-center tabular-nums ring-2 ring-white ${
                  isFilterOpen ? 'bg-violet-500 text-white' : 'bg-violet-600 text-white'
                }`}
              >
                {activeFilterCount}
              </span>
            )}
          </button>,
          targets.filterSlot
        )
      : null;

  // 4. Mobile Search Overlay (16pt = 16px uniform base padding, Left [←] + Center Input [✕] + Right [🎚️])
  const mobileOverlayNode =
    isMobileSearchOpen && targets.mobileOverlay
      ? createPortal(
          <div className="lg:hidden absolute inset-0 bg-white px-4 pt-[calc(16px+env(safe-area-inset-top,0px))] pb-4 flex items-center gap-2 z-40 animate-in fade-in duration-150">
            <button
              type="button"
              onClick={() => {
                setIsMobileSearchOpen(false);
                setIsFilterOpen(false);
              }}
              className="w-10 h-10 -ml-1.5 rounded-full text-slate-900 hover:bg-slate-100 flex items-center justify-center shrink-0 active:scale-95 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
              title="กลับ"
              aria-label="ปิดแถบค้นหา"
            >
              <ArrowLeft aria-hidden="true" className="w-5 h-5 stroke-[2.2]" />
            </button>

            <div className="relative flex-1 min-w-0 h-10 bg-slate-100 focus-within:bg-white border border-transparent focus-within:border-slate-300 focus-within:ring-2 focus-within:ring-violet-500/20 rounded-full flex items-center transition-colors">
              <Search
                aria-hidden="true"
                className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              />
              <input
                ref={mobileInputRef}
                type="text"
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={placeholder}
                aria-label={placeholder}
                className="w-full h-full pl-9 pr-9 bg-transparent focus:outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400 rounded-full"
              />
              {hasActiveSearch && (
                <button
                  type="button"
                  onClick={() => {
                    onSearchChange('');
                    mobileInputRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 flex items-center justify-center transition-colors cursor-pointer"
                  title="ล้างคำค้นหา"
                  aria-label="ล้างคำค้นหา"
                >
                  <X aria-hidden="true" className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {hasFilters && (
              <button
                type="button"
                onClick={() => setIsFilterOpen((v) => !v)}
                className={`relative w-10 h-10 rounded-full flex items-center justify-center shrink-0 active:scale-95 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 ${
                  isFilterOpen
                    ? 'bg-slate-900 text-white'
                    : activeFilterCount > 0
                      ? 'bg-violet-50 text-violet-700'
                      : 'text-slate-900 hover:bg-slate-100'
                }`}
                aria-label="ตัวกรองเพิ่มเติม"
                aria-expanded={isFilterOpen}
              >
                <SlidersHorizontal aria-hidden="true" className="w-5 h-5 stroke-[2]" />
                {activeFilterCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-violet-600 text-white text-[10px] font-extrabold flex items-center justify-center tabular-nums ring-2 ring-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            )}
          </div>,
          targets.mobileOverlay
        )
      : null;

  // 5. Collapsible Filter Drawer right under <header> (compact inline Reset button, no bottom strip)
  const drawerNode =
    isFilterOpen && hasFilters && targets.drawer
      ? createPortal(
          <div className="bg-white/98 backdrop-blur-xl border-b border-slate-200/80 shadow-[0_8px_24px_rgba(15,23,42,0.06)] px-4 py-3 animate-in slide-in-from-top-1 fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-start gap-2.5 max-w-[3840px] mx-auto">
              <div className="flex-1 min-w-0">{children}</div>
              <button
                type="button"
                onClick={handleResetAll}
                disabled={!isDirty}
                className={`h-10 px-3.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 ${
                  isDirty
                    ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 active:scale-95'
                    : 'bg-slate-100 text-slate-400 border border-slate-200/70 opacity-60 cursor-not-allowed'
                }`}
                aria-label="รีเซ็ตการกรอง"
                title="รีเซ็ตการกรอง"
              >
                <RotateCcw aria-hidden="true" className="w-3.5 h-3.5" />
                <span>รีเซ็ตการกรอง</span>
              </button>
            </div>
          </div>,
          targets.drawer
        )
      : null;

  return (
    <>
      {centerSearchNode}
      {mobileSearchTriggerNode}
      {filterTriggerNode}
      {mobileOverlayNode}
      {drawerNode}
    </>
  );
}
