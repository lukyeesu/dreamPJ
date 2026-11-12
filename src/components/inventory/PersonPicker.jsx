import React, { useState, useEffect, useRef, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { Search, UserCheck, Users, UserPlus, Check, Loader2, AlertCircle, ChevronDown, X } from 'lucide-react';
import * as productionService from '../../services/productionService.js';
import * as warehouseService from '../../services/warehouseService.js';
import { useWarehouseCommandKey } from '../../hooks/useWarehouseCommandKey.js';

/**
 * PersonPicker Component
 * Reusable, accessible, and searchable picker for staff, casual helpers, and teams.
 * - Queries DB people via productionService.listWarehousePeople with debouncing
 * - Resolves staff keys (staff:<id>) to canonical recipient UUID via resolveWarehousePerson
 * - Rejects selection if canonical UUID cannot be resolved (no fake/missing IDs)
 * - Accessible combobox with ArrowDown / ArrowUp / Enter / Escape keyboard navigation
 * - Supports creating new casual helpers/teams on the fly with portal to document.body (z-[112])
 * - Zero PII leakage
 */
export default function PersonPicker({
  value = null, // Can be string (personKey or recipient_id or name) or object
  onChange,
  placeholder = 'เลือกหรือค้นหาผู้รับผิดชอบ / ผู้ช่วยงาน...',
  disabled = false,
  filterKind = 'all', // 'all' | 'staff' | 'casual_helper' | 'team'
  allowAddNew = true,
  id = null,
  label = null,
  required = false,
  error = null,
  className = ''
}) {
  const generatedId = useId();
  const pickerId = id || generatedId;

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [peopleList, setPeopleList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // New helper inline creation modal state
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newKind, setNewKind] = useState('individual'); // 'individual' | 'team'
  const [newName, setNewName] = useState('');
  const [newPrimaryReceiver, setNewPrimaryReceiver] = useState('');
  const [newMembersText, setNewMembersText] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Selected item display info
  const [selectedPerson, setSelectedPerson] = useState(null);

  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const latestRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);
  const creatingRef = useRef(false);
  const selectingRef = useRef(false);
  const { getKey, clearKey } = useWarehouseCommandKey();

  // Mount/unmount tracking
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Synchronize incoming value without re-render loop
  useEffect(() => {
    if (!value) {
      setSelectedPerson(null);
      return;
    }
    if (typeof value === 'object') {
      setSelectedPerson(value);
    } else if (typeof value === 'string' && value.trim()) {
      setSelectedPerson((prev) =>
        prev && (prev.key === value || prev.recipient_id === value || prev.name === value)
          ? prev
          : { name: value, key: value }
      );
    }
  }, [value]);

  // Click outside listener
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  // Fetch people from server with debouncing and sequence token guard
  const fetchPeople = useCallback(
    async (query = '') => {
      const requestId = ++latestRequestIdRef.current;
      setIsLoading(true);
      setFetchError(null);
      try {
        const res = await productionService.listWarehousePeople({ query, limit: 20 });
        if (!isMountedRef.current || requestId !== latestRequestIdRef.current) {
          return; // Ignore stale out-of-order query response
        }
        if (res && Array.isArray(res.people)) {
          let filtered = res.people;
          if (filterKind !== 'all') {
            filtered = filtered.filter((p) => p.kind === filterKind);
          }
          setPeopleList(filtered);
          setHighlightedIndex(filtered.length > 0 ? 0 : -1);
        } else {
          setPeopleList([]);
          setHighlightedIndex(-1);
        }
      } catch (err) {
        if (!isMountedRef.current || requestId !== latestRequestIdRef.current) return;
        console.warn('Failed to fetch people list:', err);
        setFetchError(err.message || 'ไม่สามารถโหลดรายชื่อได้');
      } finally {
        if (isMountedRef.current && requestId === latestRequestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [filterKind]
  );

  // Handle search input change with 200ms debounce
  const handleSearchChange = (e) => {
    const q = e.target.value;
    latestRequestIdRef.current += 1;
    setSearchQuery(q);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      fetchPeople(q);
    }, 200);
  };

  const handleOpenDropdown = () => {
    if (disabled) return;
    setIsOpen(true);
    fetchPeople(searchQuery);
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 50);
  };

  // Handle selecting a person - strictly enforces canonical UUID resolution
  const handleSelect = async (person) => {
    if (!person || selectingRef.current) return;
    selectingRef.current = true;
    setIsResolving(true);
    setFetchError(null);
    try {
      let canonicalRecipientId = person.recipient_id || null;
      let resolvedData = null;

      // If staff:<id>, resolve to canonical recipient UUID via backend bridge
      if (person.key && person.key.startsWith('staff:')) {
        resolvedData = await productionService.resolveWarehousePerson({ personKey: person.key });
        if (resolvedData && resolvedData.recipient_id) {
          canonicalRecipientId = resolvedData.recipient_id;
        } else {
          canonicalRecipientId = null;
        }
      }

      // Per Plan C contract: Must reject selection when canonical UUID is missing/unresolvable
      if (!canonicalRecipientId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(canonicalRecipientId)) {
        setFetchError(`พนักงาน "${person.name}" ไม่มีรหัสทะเบียนผู้รับของ (Canonical UUID) ในระบบ`);
        return;
      }

      if (!isMountedRef.current) return;
      const finalSelection = {
        key: person.key,
        recipient_id: canonicalRecipientId,
        recipientId: canonicalRecipientId,
        staff_user_id: person.staff_user_id || null,
        name: resolvedData?.name || person.name,
        kind: person.kind,
        code: person.code || null,
        primary_receiver_name: resolvedData?.primary_receiver_name || person.primary_receiver_name || person.name,
        member_names: resolvedData?.member_names || person.member_names || []
      };

      setSelectedPerson(finalSelection);
      setIsOpen(false);
      setSearchQuery('');
      if (typeof onChange === 'function') {
        onChange(finalSelection);
      }
    } catch (err) {
      console.error('Error resolving person:', err);
      setFetchError(err.message || 'ไม่สามารถเชื่อมโยงรหัสพนักงานกับฐานข้อมูลผู้รับของได้');
    } finally {
      selectingRef.current = false;
      if (isMountedRef.current) setIsResolving(false);
    }
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setSelectedPerson(null);
    if (typeof onChange === 'function') {
      onChange(null);
    }
  };

  // Keyboard navigation for combobox (ArrowDown / ArrowUp / Enter / Escape)
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        handleOpenDropdown();
        return;
      }
      setHighlightedIndex((prev) => (prev < peopleList.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : peopleList.length - 1));
    } else if (e.key === 'Enter') {
      if (isOpen && peopleList.length > 0) {
        e.preventDefault();
        const target = (highlightedIndex >= 0 && highlightedIndex < peopleList.length)
          ? peopleList[highlightedIndex]
          : peopleList[0];
        if (target) {
          handleSelect(target);
        }
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // Create new casual helper or team on the fly
  const handleCreateNewPerson = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (creatingRef.current) return;
    if (!newName.trim()) {
      setCreateError('กรุณาระบุชื่อ');
      return;
    }

    creatingRef.current = true;
    setIsCreating(true);
    setCreateError(null);
    try {
      let createdResult = null;
      if (newKind === 'team') {
        const members = newMembersText
          .split(',')
          .map((m) => m.trim())
          .filter(Boolean);
        const payload = {
          name: newName.trim(),
          primaryReceiverName: newPrimaryReceiver.trim() || newName.trim(),
          memberNames: members
        };
        createdResult = await warehouseService.createTeam({ ...payload, idempotencyKey: getKey('picker_create', payload) });
      } else {
        const payload = {
          name: newName.trim(),
          recipientType: 'casual_helper',
          contactInfo: ''
        };
        createdResult = await warehouseService.createRecipient({ ...payload, idempotencyKey: getKey('picker_create', payload) });
      }

      // Canonical UUID from server RPC response shape { success: true, data: { id } }
      const newId =
        createdResult?.data?.id ||
        createdResult?.data?.recipient_id ||
        createdResult?.id ||
        createdResult?.recipient_id;

      if (createdResult?.success === false || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(newId))) {
        throw new Error('ไม่สามารถรับ Canonical UUID จากฐานข้อมูลได้ (ห้ามใช้รหัสจำลอง Date.now)');
      }

      clearKey('picker_create');
      if (!isMountedRef.current) return;
      const newPersonObj = {
        key: `recipient:${newId}`,
        recipient_id: newId,
        recipientId: newId,
        name: newName.trim(),
        kind: newKind === 'team' ? 'team' : 'casual_helper',
        code: null,
        primary_receiver_name: newPrimaryReceiver.trim() || newName.trim(),
        member_names:
          newKind === 'team'
            ? newMembersText
                .split(',')
                .map((m) => m.trim())
                .filter(Boolean)
            : []
      };

      setSelectedPerson(newPersonObj);
      if (typeof onChange === 'function') {
        onChange(newPersonObj);
      }

      setIsAddingNew(false);
      setIsOpen(false);
      setNewName('');
      setNewPrimaryReceiver('');
      setNewMembersText('');
    } catch (err) {
      console.error('Failed to create new helper:', err);
      setCreateError(err.message || 'ไม่สามารถบันทึกผู้ช่วยใหม่ได้');
    } finally {
      creatingRef.current = false;
      if (isMountedRef.current) setIsCreating(false);
    }
  };

  // Close modal on Escape key
  useEffect(() => {
    const handleModalEsc = (e) => {
      if (e.key === 'Escape' && isAddingNew) {
        setIsAddingNew(false);
        setCreateError(null);
      }
    };
    if (isAddingNew) {
      window.addEventListener('keydown', handleModalEsc);
    }
    return () => {
      window.removeEventListener('keydown', handleModalEsc);
    };
  }, [isAddingNew]);

  // Modal portaled to document.body with z-[112] to avoid nested form submission
  const modalPortal =
    isAddingNew && typeof document !== 'undefined'
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="เพิ่มผู้ช่วยหรือทีมใหม่"
            className="fixed inset-0 z-[112] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          >
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden p-5 space-y-4 max-h-[calc(100dvh-1rem)] overflow-y-auto">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-[var(--theme-main,#8b5cf6)]" />
                  <span>เพิ่มผู้ช่วยหรือทีมใหม่</span>
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNew(false);
                    setCreateError(null);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                  title="ปิด"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateNewPerson} className="space-y-3">
                {/* Type Switcher */}
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setNewKind('individual')}
                    className={`py-2 text-sm font-bold rounded-lg transition min-h-[44px] cursor-pointer ${
                      newKind === 'individual'
                        ? 'bg-white text-slate-800 shadow-xs'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    ผู้ช่วยรายบุคคล
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewKind('team')}
                    className={`py-2 text-sm font-bold rounded-lg transition min-h-[44px] cursor-pointer ${
                      newKind === 'team'
                        ? 'bg-white text-slate-800 shadow-xs'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    ทีมช่าง / ผู้ช่วยหลายคน
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    {newKind === 'team' ? 'ชื่อทีม *' : 'ชื่อผู้ช่วยงาน *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={newKind === 'team' ? 'เช่น ทีมจัดช่อดอกไม้ A' : 'เช่น ป้านิด (คนช่วยทำช่อ)'}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-hidden focus:border-[var(--theme-main,#8b5cf6)] min-h-[44px]"
                  />
                </div>

                {newKind === 'team' && (
                  <>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">หัวหน้าทีม / ผู้รับของหลัก</label>
                      <input
                        type="text"
                        value={newPrimaryReceiver}
                        onChange={(e) => setNewPrimaryReceiver(e.target.value)}
                        placeholder="เช่น สมศักดิ์ (หัวหน้าทีม)"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-hidden focus:border-[var(--theme-main,#8b5cf6)] min-h-[44px]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">สมาชิกในทีม (คั่นด้วยจุลภาค)</label>
                      <input
                        type="text"
                        value={newMembersText}
                        onChange={(e) => setNewMembersText(e.target.value)}
                        placeholder="เช่น นิด, อ้อย, วรรณ"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl outline-hidden focus:border-[var(--theme-main,#8b5cf6)] min-h-[44px]"
                      />
                    </div>
                  </>
                )}

                {createError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-sm">
                    {createError}
                  </div>
                )}

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingNew(false);
                      setCreateError(null);
                    }}
                    className="px-3.5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl min-h-[44px] cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="px-4 py-2 text-sm font-bold text-white bg-[var(--theme-main,#8b5cf6)] hover:bg-[var(--theme-hover,#7c3aed)] rounded-xl min-h-[44px] flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    <span>บันทึกและเลือกทันที</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {label && (
        <label htmlFor={pickerId} className="block text-sm font-bold text-slate-700 mb-1">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Main Trigger Field */}
      <button
        type="button"
        id={pickerId}
        onClick={handleOpenDropdown}
        onKeyDown={handleKeyDown}
        disabled={disabled || isResolving}
        className={`w-full min-h-[44px] px-3 py-2 bg-white border rounded-xl text-left flex items-center justify-between gap-2 transition cursor-pointer ${
          error
            ? 'border-rose-300 ring-2 ring-rose-100'
            : isOpen
            ? 'border-[var(--theme-main,#8b5cf6)] ring-2 ring-[var(--theme-light,#f5f3ff)]'
            : 'border-slate-200 hover:border-slate-300'
        } ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isResolving ? (
            <Loader2 className="w-4 h-4 text-[var(--theme-main,#8b5cf6)] animate-spin shrink-0" />
          ) : selectedPerson ? (
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                selectedPerson.kind === 'staff'
                  ? 'bg-emerald-500'
                  : selectedPerson.kind === 'team'
                  ? 'bg-blue-500'
                  : 'bg-amber-500'
              }`}
            />
          ) : (
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
          )}

          <div className="min-w-0 flex-1 truncate">
            {selectedPerson ? (
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-sm font-bold text-slate-800 truncate">{selectedPerson.name}</span>
                {selectedPerson.code && (
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono shrink-0">
                    {selectedPerson.code}
                  </span>
                )}
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                    selectedPerson.kind === 'staff'
                      ? 'bg-emerald-50 text-emerald-700'
                      : selectedPerson.kind === 'team'
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {selectedPerson.kind === 'staff' ? 'พนักงาน' : selectedPerson.kind === 'team' ? 'ทีม' : 'ผู้ช่วย'}
                </span>
              </div>
            ) : (
              <span className="text-sm text-slate-400 truncate">{placeholder}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {selectedPerson && !disabled && (
            <div
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') handleClear(e);
              }}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="ล้างค่าที่เลือก"
            >
              <X className="w-3.5 h-3.5" />
            </div>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {error && <p className="text-[11px] text-rose-500 mt-1 font-medium">{error}</p>}
      {fetchError && !isOpen && <p className="text-[11px] text-rose-500 mt-1 font-medium">{fetchError}</p>}

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          role="listbox"
          id={`${pickerId}-list`}
          className="absolute z-[120] left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden max-h-80 flex flex-col animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {/* Search Header */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
            <input
              ref={searchInputRef}
              role="combobox"
              aria-expanded={isOpen}
              aria-controls={`${pickerId}-list`}
              aria-activedescendant={highlightedIndex >= 0 ? `${pickerId}-option-${highlightedIndex}` : undefined}
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleKeyDown}
              placeholder="พิมพ์ชื่อหรือรหัสพนักงาน..."
              className="w-full text-sm bg-transparent outline-hidden py-1.5 text-slate-800 placeholder-slate-400 min-h-[44px]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  fetchPeople('');
                }}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Results List */}
          <div className="overflow-y-auto flex-1 divide-y divide-slate-50">
            {isLoading ? (
              <div className="py-6 flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--theme-main,#8b5cf6)]" />
                <span className="text-sm">กำลังค้นหารายชื่อ...</span>
              </div>
            ) : fetchError ? (
              <div className="p-4 text-center text-sm text-rose-500 space-y-1">
                <AlertCircle className="w-4 h-4 mx-auto text-rose-500 mb-1" />
                <p>{fetchError}</p>
                <button
                  type="button"
                  onClick={() => fetchPeople(searchQuery)}
                  className="text-[11px] font-bold text-[var(--theme-main,#8b5cf6)] hover:underline mt-1 cursor-pointer"
                >
                  ลองใหม่อีกครั้ง
                </button>
              </div>
            ) : peopleList.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-400 px-4">
                <Users className="w-6 h-6 mx-auto text-slate-300 mb-1" />
                <span>ไม่พบรายชื่อที่ตรงกับ "{searchQuery || ''}"</span>
              </div>
            ) : (
              peopleList.map((person, idx) => {
                const isSelected =
                  selectedPerson &&
                  (selectedPerson.key === person.key ||
                    (person.recipient_id && selectedPerson.recipient_id === person.recipient_id));
                const isHighlighted = highlightedIndex === idx;

                return (
                  <button
                    key={person.key}
                    id={`${pickerId}-option-${idx}`}
                    type="button"
                    onClick={() => handleSelect(person)}
                    className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50 transition cursor-pointer min-h-[44px] ${
                      isSelected
                        ? 'bg-[var(--theme-light,#f5f3ff)]'
                        : isHighlighted
                        ? 'bg-slate-100/80 ring-1 ring-inset ring-slate-300'
                        : ''
                    }`}
                    role="option"
                    aria-selected={isSelected || isHighlighted}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          person.kind === 'staff'
                            ? 'bg-emerald-50 text-emerald-600'
                            : person.kind === 'team'
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-amber-50 text-amber-600'
                        }`}
                      >
                        {person.kind === 'team' ? <Users className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-sm font-bold text-slate-800 truncate">{person.name}</span>
                          {person.code && (
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-1 py-0.2 rounded font-mono shrink-0">
                              {person.code}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {person.kind === 'staff' && 'พนักงานในระบบ (มีรหัสงาน)'}
                          {person.kind === 'casual_helper' && 'ผู้ช่วยอิสระ / ชั่วคราว'}
                          {person.kind === 'team' &&
                            `ทีม: ${person.member_names?.join(', ') || person.primary_receiver_name || 'หลายคน'}`}
                        </div>
                      </div>
                    </div>

                    {isSelected && <Check className="w-4 h-4 text-[var(--theme-main,#8b5cf6)] shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          {/* Quick Add Helper Action */}
          {allowAddNew && (
            <div className="p-2 border-t border-slate-100 bg-slate-50/80">
              <button
                type="button"
                onClick={() => setIsAddingNew(true)}
                className="w-full py-2 px-3 rounded-xl border border-dashed border-slate-300 hover:border-[var(--theme-main,#8b5cf6)] bg-white text-sm font-bold text-slate-700 hover:text-[var(--theme-main,#8b5cf6)] transition flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ เพิ่มผู้ช่วยงานใหม่หรือทีม</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Portal Dialog */}
      {modalPortal}
    </div>
  );
}
