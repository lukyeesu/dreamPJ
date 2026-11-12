import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import InventoryItemImage from './InventoryItemImage.jsx';
import {
  ShoppingBag,
  X,
  User,
  Users,
  Plus,
  Trash2,
  Calendar,
  Layers,
  ArrowRight,
  AlertCircle,
  Clock,
  RotateCcw,
  CheckCircle2,
  Factory
} from 'lucide-react';
import { generateIdempotencyKey } from '../../services/warehouseService.js';
import ModernDateTimePicker from '../common/ModernDateTimePicker.jsx';
import PersonPicker from './PersonPicker.jsx';

/**
 * IssueCartDrawer Component
 * Mixed issue cart matching Plan C specifications:
 * - Atomic Mixed Cart: Consumables, reusables, and serialized tools
 * - PRODUCTION_ISSUE vs FIELD_ISSUE (up to 15 project stops, single shared kit)
 * - Output work deliverables separate from input materials
 * - Integrated PersonPicker for canonical recipient_id resolution
 * - Preserves legacy recipient prop compatibility when provided
 * - Stable idempotency key fingerprinted to payload content
 * - Double-submission prevention with synchronous ref guard + finally unlock
 * - ModernDateTimePicker for all date/time inputs (zero native date pickers)
 * - Responsive: Desktop sidepanel, Mobile drawer z-[110] with state preservation
 */
export default function IssueCartDrawer({
  isOpen = true,
  onClose = null,
  cartItems = [],
  onUpdateCartItemQty,
  onUpdateCartItemUnits,
  onRemoveCartItem,
  onClearCart,
  activities = [],
  recipients = [],
  assetUnits = [],
  initialProjectId = '',
  onSubmitIssue,
  isSubmitting = false
}) {
  // Mode: 'production' | 'field_round'
  const [issueMode, setIssueMode] = useState('production');

  // Production Form fields
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId || '');
  const [selectedPerson, setSelectedPerson] = useState(null); // From PersonPicker
  const [recipientTypeTab, setRecipientTypeTab] = useState('staff'); // 'staff' | 'casual_helper' | 'team'
  const [selectedRecipientId, setSelectedRecipientId] = useState(''); // Legacy prop selector
  const [customRecipientName, setCustomRecipientName] = useState('');
  const [notes, setNotes] = useState('');

  // Production Deliverables ('สิ่งที่ต้องส่ง / กำหนดส่ง')
  const [workTitle, setWorkTitle] = useState('งานผลิตตามใบเบิก');
  const [workDueAt, setWorkDueAt] = useState('');
  const [workLines, setWorkLines] = useState([
    { description: 'ชิ้นงานผลิตสำเร็จ', requiredQty: 1, unit: 'ชุด' }
  ]);

  // Field Round Form fields
  const [roundCode, setRoundCode] = useState(() => `RN-${new Date().toISOString().slice(5, 10).replace('-', '')}-01`);
  const [roundTitle, setRoundTitle] = useState('รอบส่งมอบและติดตั้ง');
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);
  const [primaryReceiverName, setPrimaryReceiverName] = useState('');
  const [fieldPerson, setFieldPerson] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);
  const [teamMembersText, setTeamMembersText] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');

  // Filter inside cart for materials
  const [cartCategoryFilter, setCartCategoryFilter] = useState('all');

  // Double-submission synchronous guard ref
  const isPendingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  useEffect(() => {
    if (!isMobile || !isOpen) return;
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const close = (event) => { if (event.key === 'Escape' && !isPendingRef.current) onCloseRef.current?.(); };
    window.addEventListener('keydown', close);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', close); previous?.focus?.(); };
  }, [isMobile, isOpen]);

  // Sync isPendingRef when isSubmitting changes
  useEffect(() => {
    if (!isSubmitting) {
      isPendingRef.current = false;
    }
  }, [isSubmitting]);

  // Sync initialProjectId prop when changed
  useEffect(() => {
    if (initialProjectId) {
      setSelectedProjectId(initialProjectId);
    }
  }, [initialProjectId]);

  // Stable idempotency key fingerprinted to payload content
  const idempotencyKeyRef = useRef(generateIdempotencyKey());
  const lastPayloadFingerprintRef = useRef('');

  // Helper to fingerprint payload
  const computePayloadFingerprint = (payload) => {
    return JSON.stringify({
      mode: payload.issueMode,
      pId: payload.projectId,
      pIds: payload.projectIds,
      recId: payload.recipientId,
      rec: payload.recipientName,
      items: payload.items?.map((it) => ({ id: it.item_id, q: it.quantity, u: it.unitCodes })),
      round: payload.fieldRound?.roundCode,
      notes: payload.notes,
      fieldRound: payload.fieldRound,
      work: payload.productionWork
        ? { t: payload.productionWork.title, d: payload.productionWork.dueAt, l: payload.productionWork.lines }
        : null
    });
  };

  // Filter recipients by type tab for legacy prop mode
  const filteredRecipients = useMemo(() => {
    if (!Array.isArray(recipients) || recipients.length === 0) return [];
    const list = recipients.filter((r) => {
      if (r.is_active === false) return false;
      const type = String(r.recipient_type || 'staff').toLowerCase();
      if (recipientTypeTab === 'staff') return type === 'staff' || type === 'employee';
      if (recipientTypeTab === 'casual_helper')
        return type === 'casual_helper' || type === 'external' || type === 'helper' || type === 'individual';
      if (recipientTypeTab === 'team') return type === 'team';
      return true;
    });
    if (list.length > 0) return list;
    return recipients.filter((r) => r.is_active !== false);
  }, [recipients, recipientTypeTab]);

  // Effective recipient derived without arbitrary auto-selecting first person
  const effectiveRecipient = useMemo(() => {
    // If PersonPicker was used:
    if (selectedPerson) {
      return {
        id: selectedPerson.recipient_id || selectedPerson.recipientId || null,
        name: selectedPerson.name || '',
        kind: selectedPerson.kind || null
      };
    }
    // If legacy dropdown was used:
    if (selectedRecipientId === 'custom') {
      return { id: null, name: customRecipientName };
    }
    if (selectedRecipientId) {
      const match = recipients.find((r) => String(r.id) === String(selectedRecipientId));
      if (match) return { id: String(match.id), name: customRecipientName || match.name };
    }
    // Do NOT arbitrarily auto-select first recipient from filtered list!
    return { id: null, name: customRecipientName };
  }, [selectedPerson, selectedRecipientId, customRecipientName, recipients]);

  // Handle legacy selected recipient change
  const handleSelectRecipient = (e) => {
    const recId = e.target.value;
    setSelectedRecipientId(recId);
    if (recId === 'custom') {
      setCustomRecipientName('');
    } else {
      const match = recipients.find((r) => String(r.id) === String(recId));
      if (match) {
        setCustomRecipientName(match.name);
        if (match.recipient_type === 'team') {
          if (match.primary_receiver_name) setPrimaryReceiverName(match.primary_receiver_name);
          if (Array.isArray(match.member_names)) setTeamMembersText(match.member_names.join(', '));
        }
      }
    }
  };

  // Compute available units per asset item
  const availableUnitsByItemId = useMemo(() => {
    const map = new Map();
    for (const unit of assetUnits) {
      if (!unit || !unit.item_id) continue;
      const status = String(unit.status || '').toUpperCase();
      const isAvailable = (status === 'AVAILABLE' || !status) && !unit.borrowed_by;
      if (!isAvailable) continue;

      const itemId = String(unit.item_id);
      if (!map.has(itemId)) map.set(itemId, []);
      map.get(itemId).push(unit);
    }
    return map;
  }, [assetUnits]);

  // Filtered cart items
  const displayedCartItems = useMemo(() => {
    if (cartCategoryFilter === 'all') return cartItems;
    return cartItems.filter((it) => String(it.category_id || '') === cartCategoryFilter);
  }, [cartItems, cartCategoryFilter]);

  // Unique categories in cart
  const cartCategories = useMemo(() => {
    const catMap = new Map();
    for (const it of cartItems) {
      if (it.category_id && it.category_name) {
        catMap.set(String(it.category_id), it.category_name);
      }
    }
    return Array.from(catMap.entries()).map(([id, name]) => ({ id, name }));
  }, [cartItems]);

  // Validation
  const validationError = useMemo(() => {
    if (cartItems.length === 0) {
      return 'กรุณาเลือกรายการพัสดุหรือเครื่องมือใส่ตะกร้าอย่างน้อย 1 รายการ';
    }

    if (issueMode === 'production') {
      if (!selectedProjectId) {
        return 'กรุณาเลือกโปรเจกต์งานที่ต้องการเบิก';
      }
      const name = (effectiveRecipient.name || customRecipientName).trim();
      if (!name || !effectiveRecipient.id) {
        return 'กรุณาเลือกหรือระบุชื่อผู้รับของ / ผู้ช่วยงาน';
      }
    } else {
      if (!roundCode.trim()) {
        return 'กรุณาระบุรหัสรอบออกงาน';
      }
      if (!primaryReceiverName.trim() || !fieldPerson?.recipient_id) {
        return 'กรุณาระบุชื่อผู้รับผิดชอบหลักของรอบออกงาน';
      }
    }

    // Check material quantities and tool units
    for (const item of cartItems) {
      const isAsset =
        String(item.item_type || '').toLowerCase() === 'asset' ||
        String(item.item_type || '').toLowerCase() === 'tool';
      if (isAsset) {
        const units = item.selectedUnits || [];
        if (units.length === 0) {
          return `กรุณาเลือกรหัสประจำชิ้นสำหรับเครื่องมือ "${item.name}" อย่างน้อย 1 ชิ้น`;
        }
      } else {
        const qty = Number(item.quantity);
        if (!Number.isSafeInteger(qty) || qty <= 0) {
          return `กรุณาระบุจำนวนที่ต้องการเบิกสำหรับ "${item.name}"`;
        }
        const available = Math.max(0, Number(item.current_stock) || 0);
        if (qty > available) {
          return `ยอดเบิก "${item.name}" (${qty}) เกินสต็อกพร้อมใช้ (${available})`;
        }
      }
    }

    if (issueMode === 'production' && (!workLines.length || workLines.some((line) => !line.description.trim() || !Number.isSafeInteger(Number(line.requiredQty)) || Number(line.requiredQty) <= 0))) return 'กรุณาระบุชิ้นงานและจำนวนเต็มบวกให้ครบ';

    return null;
  }, [cartItems, issueMode, selectedProjectId, effectiveRecipient, customRecipientName, roundCode, primaryReceiverName, fieldPerson, workLines]);

  // Form submission handler
  const handleConfirm = async () => {
    if (validationError || isSubmitting || isPendingRef.current) return;

    const recipientName =
      issueMode === 'production'
        ? (effectiveRecipient.name || customRecipientName).trim()
        : primaryReceiverName.trim();

    const recipientId =
      issueMode === 'production'
        ? (effectiveRecipient.id || (selectedRecipientId && selectedRecipientId !== 'custom' ? selectedRecipientId : null))
        : fieldPerson?.recipient_id;

    const candidatePayload = {
      issueMode,
      projectId: issueMode === 'production' ? selectedProjectId : null,
      recipientId,
      recipientName,
      notes: notes.trim(),
      items: cartItems.map((item) => ({
        id: item.id,
        item_id: item.id,
        name: item.name,
        item_type: item.item_type,
        quantity: Number(item.quantity) || 1,
        unitCodes: item.selectedUnits || []
      })),
      fieldRound:
        issueMode === 'field_round'
          ? {
              roundCode: roundCode.trim(),
              title: roundTitle.trim(),
              projectIds: selectedProjectIds,
              primaryReceiver: primaryReceiverName.trim(),
              teamMembers: teamMembersText
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
              expectedReturnAt: expectedReturnDate || null
            }
          : null,
      productionWork:
        issueMode === 'production'
          ? {
              title: workTitle.trim() || 'งานผลิตตามใบเบิก',
              dueAt: workDueAt || null,
              lines: workLines.map((l) => ({
                description: l.description.trim() || 'ชิ้นงานผลิตสำเร็จ',
                requiredQty: Number(l.requiredQty) || 1,
                unit: l.unit || 'ชุด'
              }))
            }
          : null
    };

    // Fingerprint idempotency key: If payload changed, generate NEW key; if unchanged (network retry), reuse same key
    const currentFingerprint = computePayloadFingerprint(candidatePayload);
    if (currentFingerprint !== lastPayloadFingerprintRef.current) {
      idempotencyKeyRef.current = generateIdempotencyKey();
      lastPayloadFingerprintRef.current = currentFingerprint;
    }

    const finalPayload = {
      ...candidatePayload,
      idempotencyKey: idempotencyKeyRef.current
    };

    isPendingRef.current = true;
    setSubmitError('');
    try {
      if (typeof onSubmitIssue !== 'function') throw new Error('ยังไม่สามารถเชื่อมต่อการบันทึกใบเบิกได้');
      if (typeof onSubmitIssue === 'function') {
        const maybePromise = onSubmitIssue(finalPayload, () => {
          // Callback on confirmed server success only resets fields
          isPendingRef.current = false;
          idempotencyKeyRef.current = generateIdempotencyKey();
          lastPayloadFingerprintRef.current = '';
          setSelectedPerson(null);
          setSelectedRecipientId('');
          setCustomRecipientName('');
          setNotes('');
          if (typeof onClearCart === 'function') {
            onClearCart();
          }
        });
        if (maybePromise && typeof maybePromise.then === 'function') {
          await maybePromise;
        }
      }
    } catch (err) {
      setSubmitError(err.message || 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      // Ensure pending lock is unlocked on failure so user can retry with stable key
      isPendingRef.current = false;
    }
  };

  const activeRecipientDisplay = effectiveRecipient.name || customRecipientName;

  // Responsive Drawer: On desktop always visible or embedded; on mobile full drawer above nav
  const isHiddenMobile = !isOpen;

  const content = (
    <div
      role="complementary"
      aria-label="ตะกร้าเบิกพัสดุและเครื่องมือ"
      className={`${
        isHiddenMobile ? 'hidden lg:flex' : 'fixed inset-0 z-[110] lg:relative lg:inset-auto lg:z-auto flex'
      } flex-col bg-white lg:border lg:border-slate-200 lg:rounded-2xl lg:shadow-xs overflow-hidden h-[100dvh] lg:h-full max-w-full pb-[env(safe-area-inset-bottom)]`}
    >
      {/* Header */}
      <header className="p-4 border-b border-slate-200/90 bg-slate-50/60 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-[var(--theme-light,#f5f3ff)] text-[var(--theme-main,#8b5cf6)] rounded-xl">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 leading-tight">
              {issueMode === 'production' ? 'เบิกผลิตงาน' : 'ชุดสำรองออกหน้างาน'}
            </h2>
            <p className="text-sm text-slate-500">{cartItems.length} รายการในตะกร้า</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {cartItems.length > 0 && onClearCart && (
            <button
              type="button"
              onClick={onClearCart}
              className="text-sm font-semibold text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-lg transition cursor-pointer min-h-[44px]"
              title="ล้างตะกร้าทั้งหมด"
            >
              ล้าง
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="ปิดตะกร้า"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* Mode Switcher */}
      <div className="p-3 border-b border-slate-100 bg-white shrink-0">
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100/80 rounded-xl">
          <button
            type="button"
            onClick={() => setIssueMode('production')}
            className={`py-2 px-3 text-sm font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px] ${
              issueMode === 'production'
                ? 'bg-white text-[var(--theme-main,#8b5cf6)] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Factory className="w-4 h-4" />
            <span>เบิกผลิตงาน</span>
          </button>
          <button
            type="button"
            onClick={() => setIssueMode('field_round')}
            className={`py-2 px-3 text-sm font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer min-h-[44px] ${
              issueMode === 'field_round'
                ? 'bg-white text-[var(--theme-main,#8b5cf6)] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>ชุดสำรองออกหน้างาน</span>
          </button>
        </div>
      </div>

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {cartItems.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <ShoppingBag className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-sm font-bold text-slate-600">ตะกร้าว่างเปล่า</p>
            <p className="text-sm text-slate-400">คลิกปุ่ม "ใส่ตะกร้า" จากตารางสต็อก เพื่อเริ่มสร้างรายการเบิก</p>
          </div>
        ) : (
          <>
            {/* Category Filter Chips if multiple categories in cart */}
            {cartCategories.length > 1 && (
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-sm">
                <button
                  type="button"
                  onClick={() => setCartCategoryFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap min-h-[44px] cursor-pointer ${
                    cartCategoryFilter === 'all'
                      ? 'bg-[var(--theme-main,#8b5cf6)] text-[var(--theme-on-main,#ffffff)]'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  ทั้งหมด
                </button>
                {cartCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCartCategoryFilter(cat.id)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap min-h-[44px] cursor-pointer ${
                      cartCategoryFilter === cat.id
                        ? 'bg-[var(--theme-main,#8b5cf6)] text-[var(--theme-on-main,#ffffff)]'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-2.5">
              {displayedCartItems.map((item) => {
                const isAsset =
                  String(item.item_type || '').toLowerCase() === 'asset' ||
                  String(item.item_type || '').toLowerCase() === 'tool';
                const availableUnits = availableUnitsByItemId.get(String(item.id)) || [];
                const remainingAfterIssue = Math.max(0, (item.current_stock || 0) - (Number(item.quantity) || 1));

                return (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-2 hover:border-slate-300 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <InventoryItemImage item={item} className="w-11 h-11" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              isAsset ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
                            }`}
                          >
                            {isAsset ? 'เครื่องมือ' : 'วัสดุ'}
                          </span>
                          <span className="text-sm font-bold text-slate-800 truncate block">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 font-mono">
                          <span>พร้อมใช้: {item.current_stock || 0} {item.unit || 'ชิ้น'}</span>
                          {!isAsset && (
                            <span className="text-slate-500 font-semibold">
                              คงเหลือหลังเบิก: {remainingAfterIssue} {item.unit || 'ชิ้น'}
                            </span>
                          )}
                        </div>
                      </div>

                      {onRemoveCartItem && (
                        <button
                          type="button"
                          onClick={() => onRemoveCartItem(item.id)}
                          className="p-1 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                          title="ลบออกจากตะกร้า"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Quantity or Serialized Units Selector */}
                    {isAsset ? (
                      <div className="space-y-1 pt-1 border-t border-slate-200/60">
                        <span className="text-[10px] font-bold text-slate-500 block">
                          เลือกรหัสชิ้นเครื่องมือ (Serial Number) *
                        </span>
                        {availableUnits.length === 0 ? (
                          <p className="text-[11px] text-rose-500">ไม่มีเครื่องมือพร้อมให้ยืมในสต็อก</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
                            {availableUnits.map((unit) => {
                              const isSelected = (item.selectedUnits || []).includes(unit.unit_code);
                              return (
                                <button
                                  key={unit.unit_code}
                                  type="button"
                                  onClick={() => {
                                    if (!onUpdateCartItemUnits) return;
                                    const current = item.selectedUnits || [];
                                    const next = isSelected
                                      ? current.filter((c) => c !== unit.unit_code)
                                      : [...current, unit.unit_code];
                                    onUpdateCartItemUnits(item.id, next);
                                  }}
                                  className={`px-2 py-1 rounded-lg text-sm font-mono font-bold transition border min-h-[44px] cursor-pointer ${
                                    isSelected
                                      ? 'bg-[var(--theme-main,#8b5cf6)] text-[var(--theme-on-main,#ffffff)] border-[var(--theme-main,#8b5cf6)]'
                                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  {unit.unit_code}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-sm">
                        <span className="font-medium text-slate-600">จำนวนที่ต้องการเบิก:</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="1"
                            max={item.current_stock || 9999}
                            value={item.quantity || 1}
                            onChange={(e) => {
                              if (onUpdateCartItemQty) {
                                onUpdateCartItemQty(item.id, Number(e.target.value));
                              }
                            }}
                            className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-center font-bold text-slate-800 outline-hidden focus:border-[var(--theme-main,#8b5cf6)] min-h-[44px]"
                          />
                          <span className="text-slate-500">{item.unit || 'ชิ้น'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Configuration Section when items exist */}
        {cartItems.length > 0 && (
          <div className="pt-4 border-t border-slate-200 space-y-3.5">
            {issueMode === 'production' ? (
              <>
                {/* Project Selection */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    โปรเจกต์งานที่เบิกผลิต *
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 outline-hidden focus:border-[var(--theme-main,#8b5cf6)] min-h-[44px] cursor-pointer"
                  >
                    <option value="">-- เลือกโปรเจกต์ --</option>
                    {activities.map((act) => (
                      <option key={act.id} value={act.id}>
                        {act.id} {act.name || act.title ? `— ${act.name || act.title}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Recipient Selection: PersonPicker or Legacy Recipient Props */}
                {Array.isArray(recipients) && recipients.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-bold text-slate-700">ผู้รับของ / ผู้ช่วยงาน *</label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setRecipientTypeTab('staff')}
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-lg transition min-h-[44px] cursor-pointer ${
                            recipientTypeTab === 'staff'
                              ? 'bg-[var(--theme-light,#f5f3ff)] text-[var(--theme-main,#8b5cf6)]'
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          พนักงาน
                        </button>
                        <button
                          type="button"
                          onClick={() => setRecipientTypeTab('casual_helper')}
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-lg transition min-h-[44px] cursor-pointer ${
                            recipientTypeTab === 'casual_helper'
                              ? 'bg-[var(--theme-light,#f5f3ff)] text-[var(--theme-main,#8b5cf6)]'
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          ผู้ช่วยภายนอก
                        </button>
                        <button
                          type="button"
                          onClick={() => setRecipientTypeTab('team')}
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-lg transition min-h-[44px] cursor-pointer ${
                            recipientTypeTab === 'team'
                              ? 'bg-[var(--theme-light,#f5f3ff)] text-[var(--theme-main,#8b5cf6)]'
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          ทีม
                        </button>
                      </div>
                    </div>

                    <select
                      aria-label="เลือกผู้รับของจากทะเบียน"
                      value={selectedRecipientId || ''}
                      onChange={handleSelectRecipient}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 outline-hidden focus:border-[var(--theme-main,#8b5cf6)] min-h-[44px] cursor-pointer"
                    >
                      <option value="">-- เลือกผู้รับมอบหมายงาน --</option>
                      {filteredRecipients.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} {r.recipient_type === 'team' ? '(ทีม)' : ''}
                        </option>
                      ))}
                    </select>

                    {selectedRecipientId === 'custom' && (
                      <input
                        type="text"
                        value={customRecipientName}
                        onChange={(e) => setCustomRecipientName(e.target.value)}
                        placeholder="ระบุชื่อผู้รับของหรือผู้ช่วย..."
                        className="w-full mt-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 outline-hidden focus:border-[var(--theme-main,#8b5cf6)] min-h-[44px]"
                      />
                    )}
                  </div>
                ) : null}
                <PersonPicker label="ค้นหาจากพนักงาน ผู้ช่วย หรือทีม" value={selectedPerson} onChange={(person) => { setSelectedPerson(person); setSelectedRecipientId(''); setCustomRecipientName(''); }} />

                {/* Production Deliverables ('สิ่งที่ต้องส่ง / กำหนดส่ง') */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-800 flex items-center gap-1">
                      <Factory className="w-3.5 h-3.5 text-[var(--theme-main,#8b5cf6)]" />
                      สิ่งที่ต้องส่งกลับ (Deliverables)
                    </span>
                    <button
                      type="button"
                      onClick={() => setWorkLines([...workLines, { description: '', requiredQty: 1, unit: 'ชุด' }])}
                      className="text-[11px] font-bold text-[var(--theme-main,#8b5cf6)] hover:underline min-h-[44px] cursor-pointer"
                    >
                      + เพิ่มชิ้นงาน
                    </button>
                  </div>

                  <input
                    type="text"
                    value={workTitle}
                    onChange={(e) => setWorkTitle(e.target.value)}
                    placeholder="ชื่องานผลิต เช่น ช่อดอกไม้รับปริญญา 10 ช่อ"
                    className="w-full px-2.5 py-1.5 text-sm bg-white border border-slate-200 rounded-lg outline-hidden min-h-[44px]"
                  />

                  <div className="space-y-1.5">
                    {workLines.map((line, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => {
                            const updated = [...workLines];
                            updated[idx].description = e.target.value;
                            setWorkLines(updated);
                          }}
                          placeholder="รายละเอียดชิ้นงาน"
                          className="flex-1 px-2 py-1 text-sm bg-white border border-slate-200 rounded-lg outline-hidden min-h-[44px]"
                        />
                        <input
                          type="number"
                          min="1"
                          value={line.requiredQty}
                          onChange={(e) => {
                            const updated = [...workLines];
                            updated[idx].requiredQty = e.target.value;
                            setWorkLines(updated);
                          }}
                          className="w-14 px-1.5 py-1 text-sm bg-white border border-slate-200 rounded-lg text-center outline-hidden min-h-[44px]"
                        />
                        <input
                          type="text"
                          value={line.unit}
                          onChange={(e) => {
                            const updated = [...workLines];
                            updated[idx].unit = e.target.value;
                            setWorkLines(updated);
                          }}
                          className="w-12 px-1.5 py-1 text-sm bg-white border border-slate-200 rounded-lg text-center outline-hidden min-h-[44px]"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="pt-1">
                    <label className="block text-[11px] font-bold text-slate-600 mb-0.5">กำหนดส่งชิ้นงาน</label>
                    <ModernDateTimePicker
                      value={workDueAt}
                      onChange={(e) => setWorkDueAt(e?.target ? e.target.value : e)}
                      hasTime={true}
                      placeholder="เลือกกำหนดส่งชิ้นงาน..."
                      compact={true}
                    />
                  </div>
                </div>
              </>
            ) : (
              /* Field Round Form */
              <>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">ชื่อรอบออกงาน</label>
                  <input value={roundTitle} onChange={(event) => setRoundTitle(event.target.value)} className="w-full border rounded-xl p-3 text-sm min-h-[44px]" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    รหัสรอบออกงาน *
                  </label>
                  <input
                    type="text"
                    value={roundCode}
                    onChange={(e) => setRoundCode(e.target.value)}
                    placeholder="เช่น RN-202611-01"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-800 outline-hidden focus:border-[var(--theme-main,#8b5cf6)] min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    ชื่อผู้รับผิดชอบหลักรอบออกงาน *
                  </label>
                  <PersonPicker value={fieldPerson} onChange={(person) => { setFieldPerson(person); setPrimaryReceiverName(person?.primary_receiver_name || person?.name || ''); setTeamMembersText((person?.member_names || []).join(', ')); }} required placeholder="เลือกผู้รับของหลักหรือทีมติดตั้ง..." />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    เลือกจุดงานที่ต้องส่งมอบในรอบนี้ ({selectedProjectIds.length} จุด)
                  </label>
                  <div className="max-h-36 overflow-y-auto space-y-1 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                    {activities.map((act) => {
                      const isChecked = selectedProjectIds.includes(act.id);
                      return (
                        <label
                          key={act.id}
                          className="flex items-center gap-2 text-sm p-1 hover:bg-slate-100 rounded cursor-pointer min-h-[44px]"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setSelectedProjectIds((prev) =>
                                isChecked ? prev.filter((id) => id !== act.id) : [...prev, act.id]
                              );
                            }}
                            className="rounded border-slate-300 text-[var(--theme-main,#8b5cf6)] min-w-[18px] min-h-[18px]"
                          />
                          <span className="truncate">{act.name || act.title || act.id}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    กำหนดคืนเครื่องมือโดยประมาณ
                  </label>
                  <ModernDateTimePicker
                    value={expectedReturnDate}
                    onChange={(e) => setExpectedReturnDate(e?.target ? e.target.value : e)}
                    hasTime={false}
                    placeholder="เลือกวันที่คาดว่าจะส่งคืน..."
                    compact={true}
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                หมายเหตุเพิ่มเติม (ถ้ามี)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ระบุข้อความหรือเงื่อนไขเพิ่มเติม (ถ้ามี)..."
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 outline-hidden focus:border-[var(--theme-main,#8b5cf6)] min-h-[44px]"
              />
            </div>
          </div>
        )}
      </div>

      {/* Cart Footer & Action Button */}
      {cartItems.length > 0 && (
        <footer className="p-4 border-t border-slate-200 bg-slate-50/80 space-y-2 shrink-0">
          {submitError && <p role="alert" className="text-sm text-red-700">{submitError}</p>}
          {validationError && (
            <div className="flex items-start gap-1.5 p-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm font-semibold leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{validationError}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleConfirm}
            disabled={Boolean(validationError) || isSubmitting}
            className="w-full min-h-[44px] py-2.5 px-4 bg-[var(--theme-main,#8b5cf6)] hover:bg-[var(--theme-hover,#7c3aed)] active:bg-[var(--theme-hover,#7c3aed)] disabled:opacity-50 text-[var(--theme-on-main,#ffffff)] rounded-xl text-sm font-bold shadow-md shadow-violet-900/15 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <span>กำลังบันทึกข้อมูล...</span>
            ) : (
              <>
                <span>
                  {issueMode === 'production'
                    ? `ยืนยันเบิกให้ ${activeRecipientDisplay || 'ผู้รับ'}`
                    : `ยืนยันเปิดรอบ ${roundCode}`}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <p className="text-center text-sm text-slate-400">
            {issueMode === 'production'
              ? 'บันทึกวัสดุ เครื่องมือ และงานที่ต้องส่งกลับพร้อมกัน'
              : 'เครื่องมือร่วมชุดเดียวยืมครั้งเดียว คลุมทุกจุดส่ง คืนเมื่อเสร็จสิ้นรอบ'}
          </p>
        </footer>
      )}
    </div>
  );
  return isMobile && isOpen && typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}
