import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, AlertTriangle, X } from 'lucide-react';

const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const isSuccess = type === 'success';

  return createPortal(
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-2 fade-in duration-300 pointer-events-none w-full flex justify-center px-4">
      <div className={`pointer-events-auto flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border min-w-[280px] max-w-md w-auto ${
        isSuccess ? 'bg-white border-emerald-100 text-slate-800' : 'bg-white border-rose-100 text-slate-800'
      }`}>
        <div className={`p-2 rounded-full shrink-0 ${isSuccess ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
          {isSuccess ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className={`font-bold text-sm whitespace-nowrap ${isSuccess ? 'text-emerald-700' : 'text-rose-700'}`}>
            {isSuccess ? 'สำเร็จ' : 'แจ้งเตือน'}
          </span>
          <span className="text-sm font-medium text-slate-600 whitespace-nowrap overflow-hidden text-ellipsis">{message}</span>
        </div>
        <button onClick={onClose} className="ml-2 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>,
    document.body
  );
};

export default Toast;
