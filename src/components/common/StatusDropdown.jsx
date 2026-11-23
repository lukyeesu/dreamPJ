import React, { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

/**
 * Derives a colored status dot CSS class from a Tailwind color/badge string.
 */
function deriveDotColor(colorStr) {
  if (!colorStr || typeof colorStr !== 'string') return 'bg-slate-400';
  const c = colorStr.toLowerCase();
  if (c.includes('emerald') || c.includes('green')) return 'bg-emerald-500';
  if (c.includes('blue') || c.includes('sky')) return 'bg-blue-500';
  if (c.includes('amber') || c.includes('yellow')) return 'bg-amber-500';
  if (c.includes('rose') || c.includes('red')) return 'bg-rose-500';
  if (c.includes('violet') || c.includes('purple') || c.includes('indigo')) return 'bg-violet-500';
  if (c.includes('orange')) return 'bg-orange-500';
  if (c.includes('teal') || c.includes('cyan')) return 'bg-teal-500';
  return 'bg-slate-400';
}

/**
 * StatusDropdown: Reusable portal-based dropdown for status/category selection.
 * Adheres strictly to Zero-Flying Rule:
 *  - Calculates position synchronously before opening
 *  - No entry animations that jump/fly into position
 *  - Unmounts when anchor scrolls out of view
 */
export default function StatusDropdown({
  value = '',
  onChange,
  options = [],
  placeholder = 'เลือกรายการ...',
  disabled = false,
  ariaLabel,
  title,
  className = '',
  showDot = true,
  leftIcon: LeftIcon = null,
  size = 'md', // 'sm' (filter bar h-10) | 'md' (form input py-3)
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  // Normalize options array into { value, label, color, dotColor }
  const normalizedOptions = options.map((opt) => {
    if (typeof opt === 'object' && opt !== null) {
      const val = opt.value ?? '';
      const lbl = opt.label ?? opt.name ?? String(val);
      const col = opt.color || '';
      const dot = opt.dotColor || deriveDotColor(col);
      return { value: val, label: lbl, color: col, dotColor: dot };
    }
    const str = String(opt);
    return { value: str, label: str, color: '', dotColor: 'bg-slate-400' };
  });

  const selectedOption = normalizedOptions.find(
    (opt) => String(opt.value) === String(value)
  );

  const computeDropdownStyle = useCallback(() => {
    if (!triggerRef.current) return null;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    // Check if trigger has scrolled completely out of visible viewport
    if (
      rect.bottom < 0 ||
      rect.top > viewportH ||
      rect.right < 0 ||
      rect.left > viewportW
    ) {
      return null;
    }

    const spaceBelow = viewportH - rect.bottom;
    const spaceAbove = rect.top;
    const width = Math.min(Math.max(rect.width, 180), Math.max(180, viewportW - 16));

    // Clamp left within viewport padding
    let left = rect.left;
    if (left + width > viewportW - 8) {
      left = Math.max(8, viewportW - width - 8);
    }
    if (left < 8) left = 8;

    // Auto-flip upward if space below is tight (<220px) and above has more space
    const openUpward = spaceBelow < 220 && spaceAbove > spaceBelow;
    const top = openUpward ? undefined : rect.bottom + 4;
    const bottom = openUpward ? viewportH - rect.top + 4 : undefined;
    const maxHeight = Math.min(
      280,
      openUpward ? Math.max(120, spaceAbove - 16) : Math.max(120, spaceBelow - 16)
    );

    return {
      position: 'fixed',
      zIndex: 300,
      width: `${width}px`,
      left: `${left}px`,
      ...(top !== undefined ? { top: `${top}px` } : {}),
      ...(bottom !== undefined ? { bottom: `${bottom}px` } : {}),
      maxHeight: `${maxHeight}px`,
    };
  }, []);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setCoords(null);
    setHighlightedIndex(-1);
  }, []);

  const openDropdown = useCallback(() => {
    if (disabled) return;
    const style = computeDropdownStyle();
    if (!style) return;
    setCoords(style);
    setIsOpen(true);

    const selIdx = normalizedOptions.findIndex(
      (opt) => String(opt.value) === String(value)
    );
    setHighlightedIndex(selIdx >= 0 ? selIdx : 0);
  }, [disabled, computeDropdownStyle, normalizedOptions, value]);

  const toggleDropdown = () => {
    if (isOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  };

  const handleSelect = (val) => {
    if (onChange) {
      onChange(val);
    }
    closeDropdown();
    if (triggerRef.current) {
      triggerRef.current.focus();
    }
  };

  // Synchronous positioning and auto-close on scroll/resize
  useLayoutEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const nextStyle = computeDropdownStyle();
      if (!nextStyle) {
        closeDropdown();
      } else {
        setCoords(nextStyle);
      }
    };

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, computeDropdownStyle, closeDropdown]);

  // Outside click listener
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e) => {
      if (
        triggerRef.current &&
        triggerRef.current.contains(e.target)
      ) {
        return;
      }
      if (
        dropdownRef.current &&
        dropdownRef.current.contains(e.target)
      ) {
        return;
      }
      closeDropdown();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen, closeDropdown]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        openDropdown();
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeDropdown();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev + 1;
        return next >= normalizedOptions.length ? 0 : next;
      });
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev - 1;
        return next < 0 ? normalizedOptions.length - 1 : next;
      });
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < normalizedOptions.length) {
        handleSelect(normalizedOptions[highlightedIndex].value);
      }
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || highlightedIndex < 0 || !dropdownRef.current) return;
    const itemEl = dropdownRef.current.querySelector(
      `[data-dropdown-index="${highlightedIndex}"]`
    );
    if (itemEl && typeof itemEl.scrollIntoView === 'function') {
      itemEl.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  // Trigger appearance
  const activeColor = selectedOption?.color
    ? selectedOption.color
    : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300';

  const displayLabel = selectedOption
    ? selectedOption.label
    : value !== '' && value !== null && value !== undefined
      ? String(value)
      : '';

  const sizeClasses =
    size === 'sm'
      ? 'h-10 px-3 py-2 text-xs sm:text-sm font-bold rounded-xl'
      : 'px-4 py-3 text-sm font-bold rounded-xl';

  return (
    <div className="relative inline-block w-full">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        title={title}
        aria-label={ariaLabel || placeholder}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={toggleDropdown}
        onKeyDown={handleKeyDown}
        className={`w-full flex items-center justify-between gap-2 border transition-colors duration-150 outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500/20 focus-visible:border-indigo-500 ${sizeClasses} ${
          isOpen ? 'ring-2 ring-indigo-500/20 border-indigo-500' : ''
        } ${
          disabled ? `${activeColor} opacity-70 cursor-not-allowed` : `${activeColor} cursor-pointer`
        } ${className}`}
      >
        <span className="flex items-center gap-2 min-w-0 truncate">
          {LeftIcon && (
            React.isValidElement(LeftIcon)
              ? LeftIcon
              : <LeftIcon aria-hidden="true" className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          )}
          {displayLabel ? (
            <>
              {showDot && selectedOption?.color && (
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${selectedOption.dotColor}`}
                />
              )}
              <span className="truncate">{displayLabel}</span>
            </>
          ) : (
            <span className="text-slate-400 font-normal truncate">
              {placeholder}
            </span>
          )}
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-indigo-600' : 'text-slate-400'
          }`}
        />
      </button>

      {isOpen &&
        coords &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: coords.position,
              zIndex: coords.zIndex,
              width: coords.width,
              left: coords.left,
              ...(coords.top !== undefined ? { top: coords.top } : {}),
              ...(coords.bottom !== undefined ? { bottom: coords.bottom } : {}),
            }}
            role="listbox"
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            className="bg-white border border-slate-200/90 rounded-2xl shadow-xl overflow-hidden outline-hidden"
          >
            <div
              style={{ maxHeight: coords.maxHeight }}
              className="overflow-y-auto overscroll-contain divide-y divide-slate-100/80"
            >
              {normalizedOptions.length === 0 ? (
                <div className="px-3.5 py-3 text-xs text-slate-400 text-center">
                  ไม่มีรายการ
                </div>
              ) : (
                normalizedOptions.map((opt, idx) => {
                  const isSelected = String(opt.value) === String(value);
                  const isHighlighted = highlightedIndex === idx;

                  return (
                    <button
                      key={`${opt.value}-${idx}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      data-dropdown-index={idx}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      onClick={() => handleSelect(opt.value)}
                      className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                        isHighlighted
                          ? 'bg-indigo-50/90 text-indigo-950'
                          : isSelected
                            ? 'bg-slate-50 text-slate-900'
                            : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <span className="flex items-center gap-2 min-w-0 flex-1">
                        {showDot && opt.color && (
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${opt.dotColor}`}
                          />
                        )}
                        <span className="text-sm font-semibold truncate">{opt.label}</span>
                      </span>
                      {isSelected && (
                        <Check className="w-4 h-4 shrink-0 text-indigo-600" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
