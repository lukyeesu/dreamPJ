import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Plus,
  Edit2,
  Trash2,
  Tags,
  CheckCircle2,
  RotateCcw,
  Archive,
  Loader2
} from 'lucide-react';
import Toast from '../common/Toast.jsx';
import { useWarehouseCommandKey } from '../../hooks/useWarehouseCommandKey.js';

/**
 * CategoryManageModal Component
 * Manages user-defined categories (inventory_categories):
 * - Create new category with stable idempotencyKey
 * - Rename existing category
 * - Retire / Restore category (soft deletion preserves historical records)
 * - Prevents double submission with synchronous pending ref
 * - Fully responsive portal z-[110] with reachable flex layout
 */
export default function CategoryManageModal({
  isOpen = false,
  onClose,
  categories = [],
  onCreateCategory,
  onRenameCategory,
  onRetireCategory,
  isSubmitting = false
}) {
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState('consumable');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [toastMessage, setToastMessage] = useState(null);
  const [isLocalPending, setIsLocalPending] = useState(false);

  const isPendingRef = useRef(false);
  const previouslyFocusedRef = useRef(null);
  const { getKey, clearKey } = useWarehouseCommandKey();

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

  const handleCreate = async (e) => {
    e.preventDefault();
    if (isPendingRef.current || pending || !newCatName.trim()) return;

    const payload = {
      name: newCatName.trim(),
      type: newCatType
    };

    const actionName = 'category_create';
    const idempotencyKey = getKey(actionName, payload);
    const fullPayload = {
      ...payload,
      idempotencyKey
    };

    isPendingRef.current = true;
    setIsLocalPending(true);

    try {
      if (typeof onCreateCategory !== 'function') throw new Error('Save is unavailable. Please try again.');
      if (onCreateCategory) {
        await onCreateCategory(fullPayload);
      }
      clearKey(actionName);
      setNewCatName('');
      setToastMessage({ type: 'success', text: `เพิ่มหมวดหมู่ "${payload.name}" เรียบร้อยแล้ว` });
    } catch (err) {
      setToastMessage({ type: 'error', text: err.message || 'เพิ่มหมวดหมู่ไม่สำเร็จ' });
    } finally {
      isPendingRef.current = false;
      setIsLocalPending(false);
    }
  };

  const handleSaveRename = async (id) => {
    if (isPendingRef.current || pending || !editingName.trim()) return;

    const payload = { id, name: editingName.trim() };
    const actionName = `category_rename_${id}`;
    const idempotencyKey = getKey(actionName, payload);

    isPendingRef.current = true;
    setIsLocalPending(true);

    try {
      if (typeof onRenameCategory !== 'function') throw new Error('Save is unavailable. Please try again.');
      if (onRenameCategory) {
        await onRenameCategory(id, payload.name, idempotencyKey);
      }
      clearKey(actionName);
      setEditingId(null);
      setEditingName('');
      setToastMessage({ type: 'success', text: 'เปลี่ยนชื่อหมวดหมู่สำเร็จ' });
    } catch (err) {
      setToastMessage({ type: 'error', text: err.message || 'เปลี่ยนชื่อไม่สำเร็จ' });
    } finally {
      isPendingRef.current = false;
      setIsLocalPending(false);
    }
  };

  const handleToggleRetire = async (cat) => {
    if (isPendingRef.current || pending) return;
    const nextActive = cat.is_active === false;
    const payload = { id: cat.id, is_active: nextActive };
    const actionName = `category_retire_${cat.id}`;
    const idempotencyKey = getKey(actionName, payload);

    isPendingRef.current = true;
    setIsLocalPending(true);

    try {
      if (typeof onRetireCategory !== 'function') throw new Error('Save is unavailable. Please try again.');
      if (onRetireCategory) {
        await onRetireCategory(cat.id, nextActive, idempotencyKey);
      }
      clearKey(actionName);
      setToastMessage({
        type: 'success',
        text: nextActive ? `เปิดใช้งานหมวดหมู่ "${cat.name}" อีกครั้ง` : `เลิกใช้งานหมวดหมู่ "${cat.name}" แล้ว`
      });
    } catch (err) {
      setToastMessage({ type: 'error', text: err.message || 'ดำเนินการไม่สำเร็จ' });
    } finally {
      isPendingRef.current = false;
      setIsLocalPending(false);
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
              <Tags className="w-5 h-5 text-[var(--theme-main,#8b5cf6)]" />
              <span>จัดการหมวดหมู่พัสดุ (Categories)</span>
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              เพิ่ม เปลี่ยนชื่อ และเลิกใช้หมวดหมู่ โดยประวัติเดิมยังคงอยู่ครบถ้วน
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

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto min-w-0">
          {/* Add Category Form */}
          <form onSubmit={handleCreate} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5">
            <label className="block text-sm font-bold text-slate-700">
              + สร้างหมวดหมู่ใหม่:
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <input
                type="text"
                required
                disabled={pending}
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="เช่น ดอกไม้พลาสติก, กรรไกร, ริบบิ้น..."
                className="flex-1 w-full min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm sm:text-sm outline-hidden focus:border-[var(--theme-main,#8b5cf6)]"
              />
              <select
                value={newCatType}
                onChange={(e) => setNewCatType(e.target.value)}
                disabled={pending}
                className="w-full sm:w-auto min-h-[44px] px-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-hidden"
              >
                <option value="consumable">สิ้นเปลือง</option>
                <option value="reusable">ใช้ซ้ำ</option>
                <option value="asset">เครื่องมือ</option>
              </select>
              <button
                type="submit"
                disabled={pending || !newCatName.trim()}
                className="w-full sm:w-auto min-h-[44px] px-4 bg-[var(--theme-main,#8b5cf6)] hover:bg-[var(--theme-hover,#7c3aed)] disabled:opacity-50 text-[var(--theme-on-main,#ffffff)] rounded-xl text-sm font-bold shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
              >
                {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>เพิ่มหมวด</span>
              </button>
            </div>
          </form>

          {/* Category List */}
          <div className="space-y-1.5 min-w-0">
            <label className="block text-sm font-bold text-slate-500 uppercase tracking-wider">
              รายการหมวดหมู่ทั้งหมด ({categories.length})
            </label>

            {categories.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-400">
                ยังไม่มีหมวดหมู่ในระบบ
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                {categories.map((cat) => {
                  const isEditing = editingId === cat.id;
                  const isRetired = cat.is_active === false;

                  return (
                    <div
                      key={cat.id}
                      className={`p-3 flex items-center justify-between gap-2 transition ${
                        isRetired ? 'bg-slate-50 opacity-60' : 'hover:bg-slate-50/50'
                      }`}
                    >
                      {isEditing ? (
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            disabled={pending}
                            className="flex-1 min-h-[44px] px-2.5 py-1.5 text-sm sm:text-sm border border-[var(--theme-main,#8b5cf6)] rounded-lg outline-hidden bg-white"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveRename(cat.id)}
                            disabled={pending || !editingName.trim()}
                            className="min-h-[44px] px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold cursor-pointer"
                          >
                            บันทึก
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setEditingName('');
                            }}
                            disabled={pending}
                            className="min-h-[44px] px-2.5 border border-slate-200 text-slate-500 rounded-lg text-sm hover:bg-slate-100 cursor-pointer"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`text-sm sm:text-sm font-bold truncate ${
                                isRetired ? 'line-through text-slate-400' : 'text-slate-800'
                              }`}
                            >
                              {cat.name}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-md font-semibold shrink-0 ${
                                cat.type === 'asset'
                                  ? 'bg-purple-100 text-purple-700'
                                  : cat.type === 'reusable'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {cat.type === 'asset'
                                ? 'เครื่องมือ'
                                : cat.type === 'reusable'
                                ? 'ใช้ซ้ำ'
                                : 'สิ้นเปลือง'}
                            </span>
                            {isRetired && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-600 font-medium shrink-0">
                                เลิกใช้งาน
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(cat.id);
                                setEditingName(cat.name);
                              }}
                              disabled={pending || isRetired}
                              title="เปลี่ยนชื่อ"
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg transition cursor-pointer disabled:opacity-30"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleRetire(cat)}
                              disabled={pending}
                              title={isRetired ? 'เปิดใช้งานใหม่' : 'เลิกใช้งาน'}
                              className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition cursor-pointer ${
                                isRetired
                                  ? 'text-emerald-600 hover:text-emerald-700'
                                  : 'text-slate-400 hover:text-rose-600'
                              }`}
                            >
                              {isRetired ? (
                                <RotateCcw className="w-4 h-4" />
                              ) : (
                                <Archive className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Pinned Reachable Footer */}
        <div className="flex items-center justify-end p-3 sm:p-4 border-t border-slate-100 bg-slate-50/60 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="min-h-[44px] px-5 py-2 border border-slate-200 text-slate-700 rounded-xl text-sm sm:text-sm font-bold hover:bg-slate-50 cursor-pointer disabled:opacity-50"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
}
