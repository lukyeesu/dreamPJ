import React, { useState, useEffect } from 'react';
import { FileText, DollarSign, AlertCircle, Activity, Maximize2, User, Truck, Gift, StickyNote } from 'lucide-react';
import ImageViewer from '../common/ImageViewer';
import ShopFooter from '../common/ShopFooter';
import { processImageUrl, formatDate, renderDeliveryTime } from '../../utils/formatters';
import { systemStatusTypes } from '../../constants/appConstants';

export const CustomerQuotationView = ({ data, shopInfo, dealStatuses = [] }) => {
  const [previewImage, setPreviewImage] = useState(null);

  // Set Document Title dynamically
  useEffect(() => {
    const title = shopInfo?.shopName ? `ใบเสนอราคา - ${shopInfo.shopName}` : 'ใบเสนอราคา';
    document.title = title;
  }, [shopInfo]);

  if (!data) return null;

  // Helper to resolve status type and label from value
  const resolveStatus = (value, list) => {
    const found = list.find(s => s.value === value);
    if (found) return { type: found.type, label: found.label, color: found.color };
    
    const sys = systemStatusTypes.find(s => s.value === value);
    if (sys) return { type: sys.value, label: sys.label, color: sys.color };

    return { type: 'pending', label: value || '-', color: 'text-slate-500 bg-slate-50' };
  };

  // Calculate Financials
  const totalSupport = data.customerSupport ? data.customerSupport.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0) : 0;
  const hasQuotationItems = data.quotationItems && data.quotationItems.length > 0;
  const totalQuotation = hasQuotationItems
    ? data.quotationItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0) 
    : (parseFloat(data.wage) || 0);
  const netReceivable = totalSupport + totalQuotation;

  const dealStatusInfo = resolveStatus(data.dealStatus, dealStatuses);

  return (
    <div className="min-h-screen bg-slate-50 pb-safe font-sans flex flex-col">
      {previewImage && <ImageViewer src={processImageUrl(previewImage)} onClose={() => setPreviewImage(null)} />}

      {/* Compact Header */}
      <div className="bg-indigo-600 text-white pt-8 pb-10 px-4 rounded-b-[2rem] shadow-md shadow-indigo-200 relative overflow-hidden z-0 md:pt-16 md:pb-28 md:rounded-b-[3rem]">
        <div className="absolute top-0 right-0 p-2 opacity-10">
          <FileText className="w-24 h-24 transform -rotate-12 md:w-64 md:h-64 md:opacity-20" />
        </div>
        <div className="relative z-10 flex flex-col items-center text-center space-y-2">
          <h1 className="text-5xl font-black tracking-tight leading-none drop-shadow-sm md:text-7xl">
            {shopInfo?.shopName || 'รายละเอียดใบเสนอราคา'}
          </h1>
          <div className="inline-flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full backdrop-blur-md border border-white/10 shadow-sm md:px-6 md:py-2 md:mt-2">
            <DollarSign className="w-3.5 h-3.5 text-indigo-50 md:w-5 md:h-5" />
            <p className="text-indigo-50 text-[10px] font-bold tracking-wide opacity-90 md:text-sm">ใบเสนอราคา (Quotation View)</p>
          </div>
        </div>
      </div>

      <div className="w-full max-w-5xl mx-auto px-4 relative z-10 space-y-3 -mt-6 md:-mt-20 md:space-y-0 md:grid md:grid-cols-12 md:gap-8 mb-3 md:mb-0">
        {/* LEFT COLUMN (Desktop): Main Info & Details */}
        <div className="md:col-span-7 space-y-3 md:space-y-6">
          {/* Row 1: Main Card (Name, ID, Image) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col gap-4 relative overflow-hidden md:p-8 md:rounded-[2rem] md:shadow-md">
            <div className="flex justify-between items-start gap-3">
              <div className="flex flex-col gap-2 min-w-0 flex-1">
                <h3 className="text-lg font-black text-slate-800 leading-tight line-clamp-2 md:text-2xl md:mb-1">{data.name}</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-md text-xs border border-indigo-100 whitespace-nowrap md:text-sm md:px-3 md:py-1">
                    {data.id}
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1 truncate ${dealStatusInfo.color} md:text-xs md:px-3 md:py-1`}>
                    {data.dealStatus === 'cancelled' ? <AlertCircle className="w-3 h-3 md:w-4 md:h-4"/> : <Activity className="w-3 h-3 md:w-4 md:h-4"/>}
                    {dealStatusInfo.label}
                  </span>
                </div>
              </div>
              {data.image && (
                <div 
                  className="w-16 h-16 shrink-0 rounded-xl overflow-hidden border border-slate-100 bg-slate-50 relative group cursor-pointer shadow-sm md:w-32 md:h-32 md:rounded-2xl"
                  onClick={() => setPreviewImage(data.image)}
                >
                  <img 
                    src={processImageUrl(data.image)} 
                    alt="Preview" 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer"
                    onError={(e) => { 
                      e.target.style.display = 'none'; 
                      if (e.target.parentElement) e.target.parentElement.style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    <Maximize2 className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 drop-shadow-sm md:w-8 md:h-8" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Combined Info Card */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-2 gap-3 md:p-8 md:rounded-[2rem] md:shadow-md md:gap-8">
            <div className="flex flex-col gap-2 border-r border-slate-100 pr-2 md:gap-4 md:pr-6">
              <div className="flex items-center gap-1.5 text-indigo-500 mb-1 md:mb-2">
                <User className="w-3.5 h-3.5 md:w-5 md:h-5" />
                <span className="text-[10px] font-bold uppercase text-slate-400 md:text-sm">ข้อมูลทั่วไป</span>
              </div>
              <div>
                <p className="text-[9px] text-slate-400 md:text-xs md:mb-1">วันที่</p>
                <p className="text-xs font-bold text-slate-700 truncate md:text-base">{formatDate(data.rawDateTime)}</p>
              </div>
              <div>
                <p className="text-[9px] text-slate-400 md:text-xs md:mb-1">ศิลปิน</p>
                <p className="text-xs font-bold text-slate-700 truncate md:text-base">{data.artist}</p>
              </div>
              <div>
                <p className="text-[9px] text-slate-400 md:text-xs md:mb-1">ลูกค้า</p>
                <p className="text-xs font-bold text-slate-700 truncate md:text-base">{data.customer}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 pl-1 md:gap-4 md:pl-4">
              <div className="flex items-center gap-1.5 text-rose-500 mb-1 md:mb-2">
                <Truck className="w-3.5 h-3.5 md:w-5 md:h-5" />
                <span className="text-[10px] font-bold uppercase text-slate-400 md:text-sm">จัดส่ง</span>
              </div>
              <div>
                <p className="text-[9px] text-slate-400 md:text-xs md:mb-1">กำหนดส่ง</p>
                <div className="text-xs font-bold text-slate-700 truncate md:text-base">{renderDeliveryTime(data)}</div>
              </div>
              <div>
                <div className="flex justify-between items-center">
                  <p className="text-[9px] text-slate-400 md:text-xs md:mb-1">สถานที่</p>
                  {data.mapLink && (
                    <a href={data.mapLink} target="_blank" rel="noreferrer" className="text-[9px] text-blue-600 font-bold hover:underline md:text-xs">
                      Map
                    </a>
                  )}
                </div>
                <p className="text-xs font-bold text-slate-700 line-clamp-2 leading-tight md:text-base">{data.location || '-'}</p>
              </div>
              {(data.recipient || data.recipientPhone) && (
                <div>
                  <p className="text-[9px] text-slate-400 md:text-xs md:mb-1">ผู้รับ</p>
                  <p className="text-xs font-bold text-slate-700 truncate md:text-base">{data.recipient || '-'}</p>
                  {data.recipientPhone && <a href={`tel:${data.recipientPhone}`} className="text-[10px] text-indigo-600 font-bold block md:text-sm">{data.recipientPhone}</a>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (Desktop): Financial Summary */}
        <div className="md:col-span-5 space-y-3 md:space-y-6">
          {/* Row 3: Financial Summary Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5 md:p-8 md:rounded-[2rem] md:shadow-lg md:sticky md:top-6">
            <h3 className="text-lg font-black text-slate-800 text-center uppercase tracking-wide md:text-xl md:mb-6">สรุปยอดเรียกเก็บเงิน</h3>
            
            {/* Money Order */}
            {data.customerSupport && data.customerSupport.some(i => parseFloat(i.price) > 0) && (
              <div className="space-y-2 md:space-y-3">
                <div className="flex justify-between items-center border-b border-indigo-100 pb-1 mb-2 md:pb-2">
                  <h4 className="text-sm font-bold text-indigo-600 flex items-center gap-2 md:text-base">
                    <Gift className="w-4 h-4 md:w-5 md:h-5" />
                    เงินสนับสนุนศิลปิน
                  </h4>
                  <span className="text-sm font-bold text-indigo-700 md:text-lg">฿{totalSupport.toLocaleString()}</span>
                </div>
                <ul className="space-y-2 pl-2 md:space-y-3">
                  {data.customerSupport.filter(item => parseFloat(item.price) > 0).map((item, idx) => (
                    <li key={idx} className="flex justify-between items-center text-xs text-slate-600 border-b border-slate-100 last:border-0 pb-1 last:pb-0 md:text-sm md:pb-2">
                      <span className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-indigo-300 rounded-full md:w-2 md:h-2"></span>
                        {item.denomination >= 20 ? 'แบงค์' : 'เหรียญ'} {item.denomination} x {item.quantity} {item.denomination >= 20 ? 'ใบ' : 'เหรียญ'}
                      </span>
                      <span className="font-medium text-slate-800 tabular-nums">{parseFloat(item.price).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Quotation Items */}
            <div className="space-y-2 md:space-y-3">
              <div className="flex justify-between items-center border-b border-emerald-100 pb-1 mb-2 md:pb-2">
                <h4 className="text-sm font-bold text-emerald-600 flex items-center gap-2 md:text-base">
                  <FileText className="w-4 h-4 md:w-5 md:h-5" />
                  รายการเสนอราคา
                </h4>
                <span className="text-sm font-bold text-emerald-700 md:text-lg">฿{totalQuotation.toLocaleString()}</span>
              </div>
              <ul className="space-y-2 pl-2 md:space-y-3">
                {hasQuotationItems ? (
                  data.quotationItems.map((item, idx) => (
                    <li key={idx} className="flex justify-between items-start text-xs text-slate-600 border-b border-slate-100 last:border-0 pb-1 last:pb-0 md:text-sm md:pb-2">
                      <div className="flex items-start gap-2 pr-2">
                        <span className="w-1.5 h-1.5 bg-emerald-300 rounded-full mt-1.5 shrink-0 md:w-2 md:h-2 md:mt-2"></span>
                        <span className="font-medium text-slate-600 break-words">
                          {item.category && <span className="font-bold text-slate-700 mr-1">{item.category}</span>}
                          {item.detail || '-'}
                        </span>
                      </div>
                      <span className="font-medium text-slate-800 tabular-nums whitespace-nowrap">
                        {parseFloat(item.price).toLocaleString()}
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="flex justify-between items-center text-xs text-slate-600 border-b border-slate-100 last:border-0 pb-1 last:pb-0 md:text-sm md:pb-2">
                    <span className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-emerald-300 rounded-full md:w-2 md:h-2"></span>
                      ค่าบริการรวม
                    </span>
                    <span className="font-medium text-slate-800 tabular-nums">{totalQuotation.toLocaleString()}</span>
                  </li>
                )}
              </ul>
            </div>

            {/* Wrapper for Bottom Section (Note + Net Total) */}
            <div className="flex flex-col -mx-5 -mb-5 rounded-b-2xl overflow-hidden md:-mx-8 md:-mb-8 md:rounded-b-[2rem] mt-2">
              {/* Note Section */}
              {data.note && (
                <div className="bg-amber-50/50 p-5 md:p-6 border-t-2 border-amber-100/50 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-amber-600">
                    <StickyNote className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">หมายเหตุ</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap font-medium md:text-sm">
                    {data.note}
                  </p>
                </div>
              )}

              {/* Net Total Section */}
              <div className={`flex flex-col items-end bg-slate-100/50 p-5 md:p-6 ${data.note ? 'border-t border-slate-200' : 'border-t-2 border-slate-200'}`}>
                <span className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">ยอดเรียกเก็บสุทธิ</span>
                <span className="text-3xl font-black text-indigo-600 leading-none tabular-nums">฿{netReceivable.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Section */}
      <ShopFooter shopInfo={shopInfo} maxWidthClass="max-w-5xl" />
    </div>
  );
};

export default CustomerQuotationView;
