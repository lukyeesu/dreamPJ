import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Plus,
  Package,
  Layers,
  Wrench,
  AlertTriangle,
  QrCode,
  Loader2
} from 'lucide-react';
import Toast from '../common/Toast.jsx';
import InventoryItemImage from './InventoryItemImage.jsx';
import { useWarehouseCommandKey } from '../../hooks/useWarehouseCommandKey.js';

/**
 * ItemFormModal Component
 * Add / Edit catalog items:
 * - Handling types: consumable, reusable, asset
 * - Independent category_id mapping
 * - Prevents stale stock overwriting on edit (must adjust through audited flow)
 * - Allows initialStock and openingStockReason only upon initial creation with integer validation
 * - Serialized unit code addition for tools with stable idempotencyKey
 * - Fully responsive modal portal z-[110] with reachable flex footer
 */
export default function ItemFormModal({
  isOpen = false,
  onClose,
  editingItem = null,
  categories = [],
  onSaveItem,
  onAddUnit,
  defaultItemType = 'consumable',
  lockItemType = false,
  supportsItemImages = false,
  imageUploadReady = false,
  onUploadImage,
  isSubmitting = false
}) {
  const [name, setName] = useState(editingItem?.name || '');
  const [code, setCode] = useState(editingItem?.code || '');
  const [categoryId, setCategoryId] = useState(editingItem?.category_id || '');
  const [itemType, setItemType] = useState(editingItem?.item_type || defaultItemType);
  const [imageUrl, setImageUrl] = useState(editingItem?.image_url || '');
  const [unit, setUnit] = useState(editingItem?.unit || 'ชิ้น');
  const [initialStock, setInitialStock] = useState('0');
  const [openingStockReason, setOpeningStockReason] = useState('ยอดยกมาเริ่มต้น');
  const [minAlertThreshold, setMinAlertThreshold] = useState(String(editingItem?.min_alert_threshold ?? 5));
  const [storageLocation, setStorageLocation] = useState(editingItem?.storage_location || '');
  const [color, setColor] = useState(editingItem?.color || '');
  const [size, setSize] = useState(editingItem?.size || '');
  const [averageCost, setAverageCost] = useState(String(editingItem?.average_cost ?? 0));
  const [status, setStatus] = useState(editingItem?.status || 'in_service');

  // Serialized unit quick-add for tools
  const [newUnitCode, setNewUnitCode] = useState('');
  const [newUnitNotes, setNewUnitNotes] = useState('');
  const [toastMessage, setToastMessage] = useState(null);
  const [isLocalPending, setIsLocalPending] = useState(false);

  const isPendingRef = useRef(false);
  const previouslyFocusedRef = useRef(null);
  const { getKey, clearKey } = useWarehouseCommandKey();

  // Sync state with editingItem on change during render
  const [prevEditingItem, setPrevEditingItem] = useState(editingItem);
  if (editingItem !== prevEditingItem) {
    setPrevEditingItem(editingItem);
    setImageUrl(editingItem?.image_url || '');
    if (editingItem) {
      setName(editingItem.name || '');
      setCode(editingItem.code || '');
      setCategoryId(editingItem.category_id || '');
      setItemType(editingItem.item_type || 'consumable');
      setUnit(editingItem.unit || 'ชิ้น');
      setMinAlertThreshold(editingItem.min_alert_threshold !== undefined ? String(editingItem.min_alert_threshold) : '5');
      setStorageLocation(editingItem.storage_location || '');
      setColor(editingItem.color || '');
      setSize(editingItem.size || '');
      setAverageCost(editingItem.average_cost !== undefined ? String(editingItem.average_cost) : '0');
      setStatus(editingItem.status || 'in_service');
      setInitialStock('0');
      setOpeningStockReason('');
    } else {
      setName('');
      setCode('');
      setCategoryId(categories[0]?.id || '');
      setItemType('consumable');
      setUnit('ชิ้น');
      setInitialStock('0');
      setOpeningStockReason('ยอดยกมาเริ่มต้น');
      setMinAlertThreshold('5');
      setStorageLocation('');
      setColor('');
      setSize('');
      setAverageCost('0');
      setStatus('in_service');
    }
    setNewUnitCode('');
    setNewUnitNotes('');
  }

  // Save and restore focus
  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = typeof document !== 'undefined' ? document.activeElement : null;
    } else if (previouslyFocusedRef.current && previouslyFocusedRef.current.focus) {
      previouslyFocusedRef.current.focus();
    }
  }, [isOpen]);

  // ESC key listener (blocked during active pending)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isPendingRef.current && !isSubmitting && !isLocalPending) {
        if (onClose) onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, isLocalPending, onClose]);

  if (!isOpen) return null;

  const pending = isSubmitting || isLocalPending;

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || isPendingRef.current || pending) return;
    isPendingRef.current = true;
    setIsLocalPending(true);
    try {
      if (!supportsItemImages || !imageUploadReady || !onUploadImage) throw new Error('ยังไม่พร้อมอัปโหลดรูปสินค้า');
      const uploaded = await onUploadImage(file);
      if (!uploaded) throw new Error('อัปโหลดรูปไม่สำเร็จ');
      setImageUrl(uploaded);
    } catch (error) { setToastMessage({type: 'error', text: error.message || 'อัปโหลดรูปไม่สำเร็จ'}); }
    finally { isPendingRef.current = false; setIsLocalPending(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isPendingRef.current || pending) return;

    if (!name.trim()) {
      setToastMessage({ type: 'error', text: 'กรุณาระบุชื่อรายการพัสดุ' });
      return;
    }
    if (!Number.isSafeInteger(Number(minAlertThreshold)) || Number(minAlertThreshold) < 0 || !Number.isFinite(Number(averageCost)) || Number(averageCost) < 0) {
      setToastMessage({ type: 'error', text: 'เกณฑ์แจ้งเตือนต้องเป็นจำนวนเต็ม และต้นทุนต้องเป็นตัวเลขตั้งแต่ศูนย์ขึ้นไป' });
      return;
    }

    const payload = {
      id: editingItem?.id,
      name: name.trim(),
      code: code.trim(),
      category_id: categoryId || null,
      item_type: itemType,
      unit: unit.trim() || 'ชิ้น',
      min_alert_threshold: Number(minAlertThreshold),
      storage_location: storageLocation.trim(),
      color: color.trim(),
      size: size.trim(),
      average_cost: Number(averageCost),
      status: status || 'in_service'
    };
    if (supportsItemImages) payload.image_url = imageUrl || null;

    // Only allow setting initial stock & opening stock reason for brand new items
    if (!editingItem) {
      const rawStock = itemType === 'asset' ? '0' : String(initialStock).trim();
      if (rawStock !== '' && (!/^\d+$/.test(rawStock) || Number(rawStock) < 0)) {
        setToastMessage({ type: 'error', text: 'ยอดยกมาเริ่มต้นต้องเป็นจำนวนเต็มบวกหรือศูนย์ (ไม่อนุญาตทศนิยม)' });
        return;
      }
      const parsedStock = Number(rawStock) || 0;
      payload.initial_stock = parsedStock;
      payload.opening_stock_reason = parsedStock > 0 ? (openingStockReason.trim() || 'ยอดยกมาเริ่มต้น') : '';
    }

    const actionName = editingItem ? 'item_update' : 'item_create';
    const idempotencyKey = getKey(actionName, payload);
    const fullPayload = {
      ...payload,
      idempotencyKey
    };

    isPendingRef.current = true;
    setIsLocalPending(true);

    try {
      if (typeof onSaveItem !== 'function') throw new Error('Save is unavailable. Please try again.');
      if (onSaveItem) {
        let callbackFired = false;
        const result = onSaveItem(fullPayload, () => {
          callbackFired = true;
          clearKey(actionName);
          isPendingRef.current = false;
          setIsLocalPending(false);
          if (onClose) onClose();
        });

        if (!callbackFired && (!result || typeof result.then !== 'function')) throw new Error('Save did not confirm success');
        if (result && typeof result.then === 'function') {
          const confirmedResult = await result;
          if (confirmedResult?.success === false) throw new Error(confirmedResult.error || 'Save failed');
          if (!callbackFired && isPendingRef.current) {
            clearKey(actionName);
            isPendingRef.current = false;
            setIsLocalPending(false);
            if (onClose) onClose();
          }
        }
      }
    } catch (err) {
      isPendingRef.current = false;
      setIsLocalPending(false);
      setToastMessage({ type: 'error', text: err.message || 'บันทึกข้อมูลพัสดุไม่สำเร็จ' });
    }
  };

  const handleAddUnitCode = async () => {
    if (!newUnitCode.trim() || !editingItem?.id || isPendingRef.current || pending) return;

    const unitPayload = {
      unit_code: newUnitCode.trim(),
      item_id: editingItem.id,
      notes: newUnitNotes.trim(),
      status: 'AVAILABLE'
    };

    const actionName = 'asset_unit_add';
    const idempotencyKey = getKey(actionName, unitPayload);
    const fullPayload = {
      ...unitPayload,
      idempotencyKey
    };

    isPendingRef.current = true;
    setIsLocalPending(true);

    try {
      if (typeof onAddUnit !== 'function') throw new Error('Save is unavailable. Please try again.');
      if (onAddUnit) {
        let callbackFired = false;
        const result = onAddUnit(fullPayload, () => {
          callbackFired = true;
          clearKey(actionName);
          setToastMessage({ type: 'success', text: `เพิ่มรหัส ${newUnitCode} สำเร็จ` });
          setNewUnitCode('');
          setNewUnitNotes('');
          isPendingRef.current = false;
          setIsLocalPending(false);
        });

        if (!callbackFired && (!result || typeof result.then !== 'function')) throw new Error('Save did not confirm success');
        if (result && typeof result.then === 'function') {
          const confirmedResult = await result;
          if (confirmedResult?.success === false) throw new Error(confirmedResult.error || 'Save failed');
          if (!callbackFired && isPendingRef.current) {
            clearKey(actionName);
            setToastMessage({ type: 'success', text: `เพิ่มรหัส ${newUnitCode} สำเร็จ` });
            setNewUnitCode('');
            setNewUnitNotes('');
            isPendingRef.current = false;
            setIsLocalPending(false);
          }
        }
      }
    } catch (err) {
      isPendingRef.current = false;
      setIsLocalPending(false);
      setToastMessage({ type: 'error', text: err.message || 'บันทึกรหัสประจำชิ้นไม่สำเร็จ' });
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isPendingRef.current && !pending) {
      if (onClose) onClose();
    }
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={handleBackdropClick}
    >
      {toastMessage && (
        <Toast
          message={toastMessage.text}
          type={toastMessage.type}
          onClose={() => setToastMessage(null)}
        />
      )}

      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[calc(100dvh-1rem)] sm:max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 min-w-0 overflow-hidden">
        {/* Pinned Header */}
        <header className="flex items-start justify-between border-b border-slate-100 p-4 sm:p-5 shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-[var(--theme-main,#8b5cf6)]" />
              <span>{editingItem ? 'แก้ไขข้อมูลพัสดุ' : 'สร้างรายการพัสดุใหม่'}</span>
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {editingItem
                ? 'แก้ไขรายละเอียดพัสดุ (ยอดสต็อกต้องปรับผ่านบันทึกตรวจรับ/ปรับปรุงสต็อก)'
                : 'เพิ่มรายการสินค้า แล้วเลือกเบิกจากรูป ชื่อ สี และหมวดหมู่ได้ทันที'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto min-w-0">
            <div className="flex items-start gap-3 rounded-2xl bg-slate-50 border border-slate-200 p-3">
              <InventoryItemImage item={{name: name || 'รูปสินค้า', image_url: imageUrl}} className="w-20 h-20 sm:w-24 sm:h-24" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-bold text-slate-800">รูปสินค้า</p>
                <label className={`inline-flex min-h-[44px] items-center px-3 rounded-xl text-sm font-bold bg-[var(--theme-main,#8b5cf6)] text-[var(--theme-on-main,#ffffff)] ${pending || !supportsItemImages || !imageUploadReady ? 'opacity-50' : 'cursor-pointer'}`}>
                  {pending ? 'กำลังดำเนินการ…' : imageUrl ? 'เปลี่ยนรูป' : 'เพิ่มรูปสินค้า'}
                  <input aria-label="รูปสินค้า" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={pending || !supportsItemImages || !imageUploadReady} onChange={handlePhotoChange} />
                </label>
                {imageUrl && <button type="button" disabled={pending} onClick={() => setImageUrl('')} className="min-h-[44px] px-3 text-sm text-slate-600 underline cursor-pointer">เอารูปออก</button>}
                <p className="text-xs text-slate-500 break-words">{!supportsItemImages ? 'อัปเดต inventory_compact.sql เพื่อเปิดใช้รูปสินค้า' : !imageUploadReady ? 'กำหนดโฟลเดอร์รูปสินค้าใน ตั้งค่า → Google Drive ก่อน' : 'JPG / PNG / WebP ไม่เกิน 8 MB · ย่อรูปและเก็บที่ Google Drive'}</p>
              </div>
            </div>
            {/* Item Type Segmented */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">
                ใช้งานแบบไหน: <span className="text-rose-600">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: 'consumable', label: 'วัสดุสิ้นเปลือง', desc: 'ตัดสต็อกตามใช้จริง', icon: Layers },
                  { id: 'reusable', label: 'วัสดุใช้ซ้ำ', desc: 'เก็บกู้และตรวจสภาพ', icon: Package },
                  { id: 'asset', label: 'เครื่องมือ/อุปกรณ์', desc: 'ระบุรหัสชิ้น ยืม-คืน', icon: Wrench }
                ].map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={Boolean(editingItem) || lockItemType || pending}
                      onClick={() => setItemType(t.id)}
                      className={`min-h-[44px] p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                        itemType === t.id
                          ? 'bg-[var(--theme-light,#ede9fe)] border-[var(--theme-main,#8b5cf6)] text-[var(--theme-ink,#4c1d95)]'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      } ${editingItem ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-sm">
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span>{t.label}</span>
                      </div>
                      <div className="text-xs opacity-75 mt-1">{t.desc}</div>
                    </button>
                  );
                })}
              </div>
              {editingItem && (
                <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>ไม่สามารถเปลี่ยนประเภทพัสดุหลังบันทึกประวัติแล้ว</span>
                </p>
              )}
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  ชื่อรายการพัสดุ: <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={pending}
                  placeholder="เช่น ดอกกุหลาบประดิษฐ์, กรรไกรตัดแต่ง..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm sm:text-sm text-slate-900 outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">รหัสพัสดุ (SKU/Code):</label>
                <input
                  type="text"
                  disabled={pending}
                  placeholder="เช่น FLW-001, TOOL-002..."
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm sm:text-sm text-slate-900 outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
                />
              </div>
            </div>

            {/* Category & Unit */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">หมวดหมู่พัสดุ:</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  disabled={pending}
                  className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm sm:text-sm text-slate-800 outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
                >
                  <option value="">-- ไม่ระบุหมวดหมู่ --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  หน่วยนับ (Unit): <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  disabled={pending}
                  placeholder="เช่น ชิ้น, ก้าน, ม้วน, แพ็ค, ตัว..."
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm sm:text-sm text-slate-900 outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
                />
              </div>
            </div>

            {/* Attributes: Color, Size, Storage Location */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">สี (Color):</label>
                <input
                  type="text"
                  disabled={pending}
                  placeholder="เช่น แดง, ขาว, ชมพู..."
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">ขนาด (Size):</label>
                <input
                  type="text"
                  disabled={pending}
                  placeholder="เช่น S, M, L, 60cm..."
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">ตำแหน่งจัดเก็บ:</label>
                <input
                  type="text"
                  disabled={pending}
                  placeholder="เช่น ชั้น A3, ตู้ B..."
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value)}
                  className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
                />
              </div>
            </div>

            {/* Initial Stock (Only for new items) */}
            {!editingItem && itemType !== 'asset' && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                <div className="text-sm font-bold text-slate-800 flex items-center justify-between">
                  <span>จำนวนที่มีอยู่ในคลังตอนนี้:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      disabled={pending}
                      placeholder="จำนวนเริ่มต้น (จำนวนเต็ม)..."
                      value={initialStock}
                      onChange={(e) => setInitialStock(e.target.value)}
                      className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm sm:text-sm font-bold text-slate-900 outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      disabled={pending}
                      placeholder="เหตุผล เช่น ตรวจนับสต็อกเปิดร้าน..."
                      value={openingStockReason}
                      onChange={(e) => setOpeningStockReason(e.target.value)}
                      className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
                    />
                  </div>
                </div>
              </div>
            )}

            {!editingItem && itemType === 'asset' && <p className="rounded-xl p-3 bg-[var(--theme-light,#ede9fe)] text-sm text-[var(--theme-ink,#4c1d95)]">บันทึกรายการก่อน แล้วเพิ่มรหัสแต่ละชิ้น เช่น SC-001 เพื่อยืม–คืนและพิมพ์ฉลาก</p>}
            <details className="rounded-xl border border-slate-200 p-3">
              <summary className="min-h-[44px] flex items-center text-sm font-bold text-slate-700 cursor-pointer">รายละเอียดเพิ่มเติม · จุดเตือนและต้นทุน</summary>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">จุดเตือนสต็อกต่ำ (Min Alert):</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  disabled={pending}
                  value={minAlertThreshold}
                  onChange={(e) => setMinAlertThreshold(e.target.value)}
                  className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm sm:text-sm text-slate-900 outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">ต้นทุนเฉลี่ยต่อหน่วย (บาท):</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={pending}
                  value={averageCost}
                  onChange={(e) => setAverageCost(e.target.value)}
                  className="w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm sm:text-sm text-slate-900 outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
                />
              </div>
            </div>

            </details>
            {/* Serialized Units Quick Add (For Asset Items When Editing) */}
            {editingItem && (editingItem.item_type === 'asset' || itemType === 'asset') && (
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-[var(--theme-main,#8b5cf6)]" />
                    <span>เพิ่มรหัสประจำชิ้นเครื่องมือ (Asset Unit Code)</span>
                  </span>
                  <span className="text-[10px] text-slate-500">พิมพ์ฉลาก QR ต่อชิ้น</span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <input
                    type="text"
                    disabled={pending}
                    placeholder="รหัสชิ้น เช่น SC-001, SC-002..."
                    value={newUnitCode}
                    onChange={(e) => setNewUnitCode(e.target.value)}
                    className="flex-1 w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm font-mono font-bold outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
                  />
                  <input
                    type="text"
                    disabled={pending}
                    placeholder="หมายเหตุชิ้น (ถ้ามี)..."
                    value={newUnitNotes}
                    onChange={(e) => setNewUnitNotes(e.target.value)}
                    className="flex-1 w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
                  />
                  <button
                    type="button"
                    onClick={handleAddUnitCode}
                    disabled={pending || !newUnitCode.trim()}
                    className="w-full sm:w-auto min-h-[44px] px-4 bg-[var(--theme-main,#8b5cf6)] hover:bg-[var(--theme-hover,#7c3aed)] text-[var(--theme-on-main,#ffffff)] disabled:opacity-50 rounded-xl text-sm font-bold shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                  >
                    {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>+ เพิ่มชิ้น</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Pinned Reachable Footer */}
          <div className="flex items-center justify-end gap-2 p-3 sm:p-4 border-t border-slate-100 bg-slate-50/60 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="min-h-[44px] px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm sm:text-sm font-bold hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={pending || !name.trim()}
              className="min-h-[44px] px-5 py-2 bg-[var(--theme-main,#8b5cf6)] hover:bg-[var(--theme-hover,#7c3aed)] text-[var(--theme-on-main,#ffffff)] rounded-xl text-sm sm:text-sm font-bold shadow-xs transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
            >
              {pending && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
              <span>{pending ? 'กำลังบันทึก...' : editingItem ? 'บันทึกการแก้ไข' : 'สร้างรายการพัสดุ'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
}
