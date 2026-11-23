import React, { useState, useCallback, useEffect, useRef } from 'react';
import ConfirmDialog from '../components/common/ConfirmDialog.jsx';

function serializeWatchValue(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

/**
 * Guards a data-entry modal against accidental dismissal.
 * - Clicking the gray backdrop does NOT close the modal (omit backdrop onClick).
 * - Pressing X / Cancel / Escape calls requestClose():
 *   - If shouldConfirm is false (e.g. view-only mode) or nothing has been edited yet, closes immediately.
 *   - If shouldConfirm is true AND the user has entered/changed data, opens a ConfirmDialog first.
 * - Saving bypasses requestClose and calls onClose directly without confirmation.
 */
export function useModalCloseGuard({
  isOpen,
  onClose,
  shouldConfirm = true,
  dirty,
  watch,
  disabled = false,
  listenEscape = true,
  title = 'ยืนยันการปิดหน้าต่าง',
  message = 'ข้อมูลที่กรอกไว้ยังไม่ได้บันทึก หากปิดหน้าต่างนี้ข้อมูลจะหายทั้งหมด ต้องการปิดหรือไม่?',
  confirmText = 'ตกลง',
  cancelText = 'ยกเลิก',
} = {}) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [, bumpCleanTick] = useState(0);

  const serializedWatch = watch !== undefined ? serializeWatchValue(watch) : null;
  const latestSerializedWatchRef = useRef(serializedWatch);
  latestSerializedWatchRef.current = serializedWatch;
  const baselineRef = useRef(serializedWatch);
  const wasOpenRef = useRef(false);
  const wasConfirmableRef = useRef(false);
  const recapturePendingRef = useRef(false);

  if (watch !== undefined) {
    if (!isOpen) {
      wasOpenRef.current = false;
      wasConfirmableRef.current = false;
      recapturePendingRef.current = false;
    } else if (
      !wasOpenRef.current ||
      (!wasConfirmableRef.current && shouldConfirm) ||
      recapturePendingRef.current
    ) {
      baselineRef.current = serializedWatch;
      wasOpenRef.current = true;
      wasConfirmableRef.current = Boolean(shouldConfirm);
      recapturePendingRef.current = false;
    } else {
      wasConfirmableRef.current = Boolean(shouldConfirm);
    }
  } else {
    recapturePendingRef.current = false;
  }

  const hasUnsavedChanges =
    dirty !== undefined
      ? Boolean(dirty)
      : watch !== undefined
        ? serializedWatch !== baselineRef.current
        : true;

  const markClean = useCallback(() => {
    baselineRef.current = latestSerializedWatchRef.current;
    recapturePendingRef.current = true;
    bumpCleanTick((c) => c + 1);
  }, []);

  useEffect(() => {
    if (!isOpen && isConfirmOpen) {
      setIsConfirmOpen(false);
    }
  }, [isOpen, isConfirmOpen]);

  const requestClose = useCallback(() => {
    if (disabled) return;
    if (!shouldConfirm || !hasUnsavedChanges) {
      onClose?.();
      return;
    }
    setIsConfirmOpen(true);
  }, [disabled, shouldConfirm, hasUnsavedChanges, onClose]);

  const confirmClose = useCallback(() => {
    setIsConfirmOpen(false);
    onClose?.();
  }, [onClose]);

  const cancelClose = useCallback(() => {
    setIsConfirmOpen(false);
  }, []);

  useEffect(() => {
    if (!listenEscape || !isOpen || isConfirmOpen || disabled) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !e.defaultPrevented) {
        e.preventDefault();
        requestClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [listenEscape, isOpen, isConfirmOpen, disabled, requestClose]);

  const closeConfirmDialog = (
    <ConfirmDialog
      isOpen={isConfirmOpen}
      title={title}
      message={message}
      confirmText={confirmText}
      cancelText={cancelText}
      type="warning"
      onConfirm={confirmClose}
      onCancel={cancelClose}
    />
  );

  return {
    requestClose,
    isConfirmOpen,
    hasUnsavedChanges,
    markClean,
    confirmClose,
    cancelClose,
    closeConfirmDialog,
  };
}

export default useModalCloseGuard;
