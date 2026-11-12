import React from 'react';
import { RefreshCw, Database } from 'lucide-react';

/**
 * MigrationNoticeBanner
 * Non-blocking advisory banner displayed when backend Supabase warehouse RPCs
 * have not yet been deployed. Keeps legacy data and stock readable.
 */
export default function MigrationNoticeBanner({ message, onRetry, isRetrying }) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 bg-amber-100 rounded-xl text-amber-700 shrink-0 mt-0.5 sm:mt-0">
          <Database className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold flex items-center gap-1.5 text-amber-950">
            <span>คลังสินค้าต้องอัปเดตฐานข้อมูล</span>
          </h4>
          <p className="text-sm text-amber-800 mt-0.5 leading-relaxed">
            {message}
          </p>
          <p className="text-sm text-amber-800 mt-1">
            ข้อมูลที่แสดงอาจเป็นข้อมูลที่บันทึกไว้ล่าสุด กรุณาอัปเดตก่อนเบิก คืน หรือแก้ไขยอด
          </p>
        </div>
      </div>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="min-h-11 px-3.5 py-2 bg-white hover:bg-amber-100/80 active:bg-amber-200 text-amber-900 border border-amber-300 rounded-xl text-sm font-bold flex items-center gap-1.5 transition shrink-0 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
          <span>{isRetrying ? 'กำลังตรวจสอบ...' : 'ตรวจสอบอีกครั้ง'}</span>
        </button>
      )}
    </div>
  );
}
