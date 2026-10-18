import React from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';

const LoadingOverlay = () => createPortal(
  <div className="fixed inset-0 z-[100] bg-white/60 backdrop-blur-[2px] flex items-center justify-center animate-in fade-in duration-200">
    <div className="flex flex-col items-center gap-4 bg-white p-8 rounded-[2rem] shadow-2xl border border-slate-100">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center shadow-inner">
            <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
          </div>
        </div>
      </div>
      <div className="text-center">
        <p className="text-slate-800 font-bold text-lg">กำลังประมวลผล</p>
        <p className="text-slate-500 text-sm">กรุณารอสักครู่...</p>
      </div>
    </div>
  </div>,
  document.body
);

export default LoadingOverlay;
