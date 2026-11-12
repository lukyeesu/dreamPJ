import React from 'react';
import {
  Plus,
  Printer,
  QrCode,
  ArrowDownToLine,
  Tags,
  RefreshCw,
  ChevronDown
} from 'lucide-react';

/**
 * InventoryHeader Component
 * Clean, brand-aligned header bar matching Plan C visual reference
 * Theme accents, readable Thai typography,
 * and 44px touch targets on mobile.
 */
export default function InventoryHeader({
  activeTab = 'stock',
  onOpenReceiveStock,
  onOpenCategories,
  onOpenBatchPrint,
  onOpenScanner,
  onOpenCreateItem,
  onRefresh,
  isRefreshing = false
}) {
  const getTitles = () => {
    switch (activeTab) {
      case 'flows':
        return {
          title: 'เบิก–คืนพัสดุและเครื่องมือ',
          subtitle: 'บันทึกการเบิกผลิต ยืมเครื่องมือออกติดตั้ง และรับวัสดุกลับตามจริง'
        };
      case 'cash':
        return {
          title: 'เงินสด',
          subtitle: 'บริหารจัดการธนบัตรจริง นับยอด จองให้งาน และจ่ายผู้ช่วยพับ/ใส่ซอง'
        };
      case 'production':
        return {title: 'งานผลิตตามโปรเจกต์', subtitle: 'ดูผู้รับผิดชอบ งานที่ส่งแล้ว ผลตรวจรับ และรายการที่ยังขาด'};
      case 'history':
        return {
          title: 'ประวัติและการเคลื่อนไหวคลัง',
          subtitle: 'ตรวจสอบบันทึกย้อนหลัง รายการเบิก-คืน การกู้คืนวัสดุ และประวัติเดิม'
        };
      case 'stock':
      default:
        return {
          title: 'ของในคลัง',
          subtitle: 'เห็นของพร้อมใช้ แล้วเบิกผลิตงานหรือจัดชุดออกหน้างาน'
        };
    }
  };

  const { title, subtitle } = getTitles();
  const managementActions = [
    {label: 'เพิ่มพัสดุใหม่', icon: Plus, action: onOpenCreateItem},
    {label: 'หมวดหมู่', icon: Tags, action: onOpenCategories},
    {label: 'พิมพ์ฉลาก QR', icon: Printer, action: onOpenBatchPrint}
  ];

  return (
    <header className="relative z-40 flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <span>{title}</span>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              title="รีเฟรชข้อมูลคลัง"
              className="min-h-11 min-w-11 p-1.5 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
              aria-label="รีเฟรชข้อมูลคลัง"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
        </h1>
        <p className="text-sm text-slate-600 mt-0.5 font-medium leading-relaxed">
          {subtitle}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-stretch gap-2 shrink-0">
        {/* รับของเข้า */}
        {activeTab === 'stock' && <button
          type="button"
          onClick={onOpenReceiveStock}
          className="min-h-[44px] px-3.5 py-2 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-sm font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowDownToLine className="w-4 h-4 text-emerald-600" />
          <span>รับของเข้า</span>
        </button>}

        {/* สแกนยืม / คืน (Primary Rose Action) */}
        <button
          type="button"
          onClick={onOpenScanner}
          className="order-first min-h-11 px-4 py-2 bg-[var(--theme-main)] hover:bg-[var(--theme-hover)] text-[var(--theme-on-main)] rounded-xl text-sm font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <QrCode className="w-4 h-4" />
          <span>สแกนยืม / คืน</span>
        </button>
        <details className={activeTab === 'stock' ? 'relative col-span-2 sm:col-auto' : 'relative'} onKeyDown={event => {
          if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); }
        }}>
          <summary className="list-none min-h-11 px-3.5 py-2 flex items-center justify-center gap-2 border border-slate-200 rounded-xl bg-white text-sm font-semibold text-slate-700 cursor-pointer [&::-webkit-details-marker]:hidden">
            จัดการคลัง <ChevronDown className="w-4 h-4" />
          </summary>
          <div className="absolute right-0 top-full mt-2 w-60 max-w-[calc(100vw-2rem)] rounded-xl bg-white border border-slate-200 shadow-lg p-1.5">
            {managementActions.map(({label,icon,action}) => <button key={label} type="button" className="w-full min-h-11 flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={event => {
              const menu = event.currentTarget.closest('details');
              menu.open = false; menu.querySelector('summary')?.focus(); action?.();
            }}>{React.createElement(icon, {className: 'w-4 h-4 text-[var(--theme-ink)]'})}{label}</button>)}
          </div>
        </details>
      </div>
    </header>
  );
}
