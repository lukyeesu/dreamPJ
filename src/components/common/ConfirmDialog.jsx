import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Info, HelpCircle, CheckCircle2 } from 'lucide-react';

/**
 * Custom Confirmation Dialog to replace native browser `window.confirm()` and `window.alert()`.
 * Fully themed with Tailwind CSS and glassmorphism backdrop.
 */
const ConfirmDialog = ({
  isOpen,
  title = 'ยืนยันการดำเนินการ',
  message,
  confirmText = 'ยืนยัน',
  cancelText = 'ยกเลิก',
  type = 'danger', // 'danger' | 'warning' | 'info' | 'success'
  onConfirm,
  onCancel,
  isLoading = false
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isLoading && onCancel) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen) return null;

  const iconMap = {
    danger: <AlertTriangle className="w-8 h-8 text-rose-600" />,
    warning: <AlertTriangle className="w-8 h-8 text-amber-500" />,
    info: <Info className="w-8 h-8 text-indigo-600" />,
    success: <CheckCircle2 className="w-8 h-8 text-emerald-600" />
  };

  const bgMap = {
    danger: 'bg-rose-100',
    warning: 'bg-amber-100',
    info: 'bg-indigo-100',
    success: 'bg-emerald-100'
  };

  const btnMap = {
    danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200 focus:ring-rose-500',
    warning: 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200 focus:ring-amber-500',
    info: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 focus:ring-indigo-500',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 focus:ring-emerald-500'
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={!isLoading && onCancel ? onCancel : undefined}
      />
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 sm:p-7 w-full max-w-sm relative z-10 animate-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center gap-4">
          <div className={`p-4 rounded-2xl ${bgMap[type] || bgMap.danger}`}>
            {iconMap[type] || iconMap.danger}
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-black text-slate-800">{title}</h3>
            {message && <p className="text-sm text-slate-600 leading-relaxed font-medium">{message}</p>}
          </div>
          <div className="flex gap-3 w-full mt-2">
            {cancelText ? (
              <button
                type="button"
                onClick={onCancel}
                disabled={isLoading}
                className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-bold transition-all disabled:opacity-50"
              >
                {cancelText}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 flex items-center justify-center gap-2 ${btnMap[type] || btnMap.danger}`}
            >
              {isLoading && (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmDialog;
