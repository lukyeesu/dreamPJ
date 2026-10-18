import React, { useState, useEffect } from 'react';
import { 
  PackageCheck, Search, AlertCircle, Activity, Maximize2, 
  ChevronRight, User, Truck, StickyNote, XCircle, Clipboard, 
  CheckCircle, Loader2, MapPin 
} from 'lucide-react';
import ImageViewer from '../common/ImageViewer';
import ShopFooter from '../common/ShopFooter';
import { processImageUrl, formatDate, renderDeliveryTime } from '../../utils/formatters';
import { systemStatusTypes } from '../../constants/appConstants';

export const CustomerTrackingView = ({ data, shopInfo, dealStatuses = [], transportStatuses = [] }) => {
  const [previewImage, setPreviewImage] = useState(null); 

  // Set Document Title dynamically
  useEffect(() => {
    const title = shopInfo?.shopName ? `ติดตามสถานะงาน - ${shopInfo.shopName}` : 'ติดตามสถานะงาน';
    document.title = title;
  }, [shopInfo]);

  if (!data) return null;

  // Helper to resolve status type and label from value
  const resolveStatus = (value, list) => {
    // Find matching status in the provided list (from settings)
    const found = list.find(s => s.value === value);
    if (found) return { type: found.type, label: found.label, color: found.color };
    
    // Fallback to system types if not found in list (backward compatibility)
    const sys = systemStatusTypes.find(s => s.value === value);
    if (sys) return { type: sys.value, label: sys.label, color: sys.color };

    // Fallback if nothing matches
    return { type: 'pending', label: value || '-', color: 'text-slate-500 bg-slate-50' };
  };

  const dealState = resolveStatus(data.dealStatus, dealStatuses);
  const transportState = resolveStatus(data.transportStatus, transportStatuses);

  // Helper to determine Timeline Step Appearance
  const getStepInfo = (stepId) => {
    const dType = dealState.type || 'pending';
    const tType = transportState.type || 'pending';
    
    const isDealCancelled = dType === 'cancelled';
    const isTransportCancelled = tType === 'cancelled' || tType === 'issue';
    
    // Global Override: ถ้ามีปัญหาหรือยกเลิก ให้แสดงกากบาทแดงทุกช่อง
    if (isDealCancelled || isTransportCancelled) {
      return { status: 'error', text: 'ปิดงานมีปัญหา', colorClass: 'bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-200', icon: XCircle };
    }

    // Step 1: รับเรื่อง (Deal)
    if (stepId === 1) {
      if (dType === 'declined') return { status: 'declined', text: 'ปฏิเสธ', colorClass: 'bg-white text-slate-400 border-2 border-slate-200', icon: XCircle };
      
      // Pending -> รอดำเนินการ
      if (dType === 'pending') return { status: 'pending', text: 'รอดำเนินการ', colorClass: 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200 ring-4 ring-indigo-50', icon: Clipboard };
      
      // Active/Completed -> รับเรื่อง
      if (dType === 'active' || dType === 'completed') return { status: 'completed', text: 'รับเรื่อง', colorClass: 'bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-200', icon: CheckCircle };
      
      return { status: 'wait', text: 'รอ', colorClass: 'bg-white text-slate-300 border-2 border-slate-200', icon: Clipboard };
    }

    // Step 2: ดำเนินการ (Deal)
    if (stepId === 2) {
      if (dType === 'declined' || dType === 'pending') return { status: 'wait', text: '-', colorClass: 'bg-white text-slate-200 border-2 border-slate-100', icon: Activity };
      
      // Active -> ดำเนินการ
      if (dType === 'active') return { status: 'current', text: 'ดำเนินการ', colorClass: 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200 ring-4 ring-indigo-50', icon: Loader2 };
      
      // Completed -> งานเสร็จสิ้น
      if (dType === 'completed') return { status: 'completed', text: 'งานเสร็จสิ้น', colorClass: 'bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-200', icon: CheckCircle };
      
      return { status: 'wait', text: 'รอ', colorClass: 'bg-white text-slate-300 border-2 border-slate-200', icon: Activity };
    }

    // Step 3: จัดส่ง (Transport)
    if (stepId === 3) {
      if (dType === 'pending' || dType === 'declined') return { status: 'wait', text: '-', colorClass: 'bg-white text-slate-200 border-2 border-slate-100', icon: Truck };

      // Pending -> รอจัดส่ง
      if (tType === 'pending') return { status: 'pending', text: 'รอจัดส่ง', colorClass: 'bg-white text-slate-400 border-2 border-slate-300', icon: Truck };
      
      // Active -> กำลังจัดส่ง
      if (tType === 'active') return { status: 'current', text: 'กำลังจัดส่ง', colorClass: 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-200 ring-4 ring-emerald-50', icon: Truck };
      
      // Completed -> จัดส่งแล้ว
      if (tType === 'completed') return { status: 'completed', text: 'จัดส่งแล้ว', colorClass: 'bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-200', icon: CheckCircle };
      
      return { status: 'wait', text: '-', colorClass: 'bg-white text-slate-300 border-2 border-slate-200', icon: Truck };
    }

    // Step 4: เสร็จสิ้น (Transport)
    if (stepId === 4) {
      if (tType === 'pending' || dType === 'pending' || dType === 'declined') return { status: 'wait', text: '-', colorClass: 'bg-white text-slate-200 border-2 border-slate-100', icon: CheckCircle };

      // Active -> ใกล้ถึงที่หมาย
      if (tType === 'active') return { status: 'pending', text: 'ใกล้ถึงที่หมาย', colorClass: 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-200 ring-4 ring-orange-50', icon: MapPin };
      
      // Completed -> เสร็จสิ้น
      if (tType === 'completed') return { status: 'completed', text: 'เสร็จสิ้น', colorClass: 'bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-200', icon: CheckCircle };
      
      return { status: 'wait', text: '-', colorClass: 'bg-white text-slate-300 border-2 border-slate-200', icon: CheckCircle };
    }
  };

  const steps = [1, 2, 3, 4];

  return (
    <div className="min-h-screen bg-slate-50 pb-safe font-sans flex flex-col">
      {/* Image Viewer Portal */}
      {previewImage && <ImageViewer src={processImageUrl(previewImage)} onClose={() => setPreviewImage(null)} />}

      {/* Compact Header */}
      <div className="bg-indigo-600 text-white pt-8 pb-10 px-4 rounded-b-[2rem] shadow-md shadow-indigo-200 relative overflow-hidden z-0 md:pt-16 md:pb-28 md:rounded-b-[3rem]">
        <div className="absolute top-0 right-0 p-2 opacity-10">
          <PackageCheck className="w-24 h-24 transform rotate-12 md:w-64 md:h-64 md:opacity-20" />
        </div>
        <div className="relative z-10 flex flex-col items-center text-center space-y-2">
          <h1 className="text-5xl font-black tracking-tight leading-none drop-shadow-sm md:text-7xl">
            {shopInfo?.shopName || 'ติดตามสถานะงาน'}
          </h1>
          <div className="inline-flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full backdrop-blur-md border border-white/10 shadow-sm md:px-6 md:py-2 md:mt-2">
            <Search className="w-3.5 h-3.5 text-indigo-50 md:w-5 md:h-5" />
            <p className="text-indigo-50 text-[10px] font-bold tracking-wide opacity-90 md:text-sm">ระบบติดตามสถานะ (Tracking Status)</p>
          </div>
        </div>
      </div>

      <div className="w-full max-w-5xl mx-auto px-4 relative z-10 space-y-3 -mt-6 md:-mt-20 md:space-y-6 mb-3 md:mb-0">
        {/* Row 1: Main Card (Name, ID, Status, Image Preview, Timeline) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-6 relative md:p-8 md:rounded-[2rem] md:shadow-md">
          <div className="flex flex-col md:flex-row md:items-start md:gap-8">
            {/* Top Area: Info (Left) + Small Image Preview (Right) */}
            <div className="flex justify-between items-start gap-3 md:flex-1">
              <div className="flex flex-col gap-2 min-w-0 flex-1">
                <h3 className="text-lg font-black text-slate-800 leading-tight line-clamp-2 md:text-2xl md:mb-1">{data.name}</h3>
                
                <div className="flex items-center gap-2 flex-wrap gap-y-2 content-start">
                  <span className="font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md text-xs border border-indigo-100 whitespace-nowrap md:text-sm md:px-3 md:py-1">
                    {data.id}
                  </span>
                  <span className={`px-2 py-1 rounded-md text-[10px] font-bold border flex items-center gap-1 truncate ${dealState.color} md:text-xs md:px-3 md:py-1`}>
                    {dealState.type === 'cancelled' ? <AlertCircle className="w-3 h-3 md:w-4 md:h-4"/> : <Activity className="w-3 h-3 md:w-4 md:h-4"/>}
                    {dealState.label}
                  </span>
                </div>
              </div>

              {/* Right: Small Image Preview */}
              {data.image && (
                <div 
                  className="w-16 h-16 shrink-0 rounded-xl overflow-hidden border border-slate-100 bg-slate-50 relative group cursor-pointer shadow-sm md:w-28 md:h-28 md:rounded-2xl"
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

            {/* PC Separator */}
            <div className="hidden md:block w-px bg-slate-100 self-stretch mx-4"></div>

            <div className="h-px bg-slate-100 w-full md:hidden my-2" />

            {/* Timeline Section */}
            <div className="px-0 md:flex-1 md:flex md:flex-col md:justify-center md:pt-4 w-full">
              <div className="relative w-full pt-2 pb-1">
                <div className="absolute left-[12.5%] right-[12.5%] top-[18px] h-0.5 bg-slate-100 -z-10 rounded-full md:top-[24px] md:h-1"></div>

                <div className="grid grid-cols-4 w-full">
                  {steps.map((stepId, idx) => {
                    const info = getStepInfo(stepId);
                    const StepIcon = info.icon;

                    return (
                      <div key={stepId} className="flex flex-col items-center gap-3 relative group cursor-default">
                        {idx < steps.length - 1 && (
                          <div className="absolute top-[18px] -right-0 md:top-[24px] transform -translate-y-1/2 translate-x-1/2 z-0">
                            <ChevronRight className="w-4 h-4 text-slate-300 md:w-5 md:h-5" />
                          </div>
                        )}

                        <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-500 z-10 ${info.colorClass} md:w-12 md:h-12`}>
                          <StepIcon className={`w-4 h-4 md:w-6 md:h-6 ${info.status === 'current' ? 'animate-pulse' : ''}`} strokeWidth={info.status === 'current' ? 2.5 : 2} />
                        </div>
                        <span className={`text-[10px] font-bold text-center leading-tight transition-colors duration-300 ${info.status === 'current' ? 'text-indigo-600 scale-105' : 'text-slate-400'} md:text-xs px-0.5`}>
                          {info.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-1 gap-3 md:gap-6">
          {/* Row 2: Combined Info Card */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-2 gap-3 md:p-8 md:rounded-[2rem] md:shadow-md md:gap-8">
            {/* Left Column: General Info */}
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

            {/* Right Column: Delivery Info */}
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

          {/* Note Card */}
          {data.note && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm md:p-8 md:rounded-[2rem] md:shadow-md">
              <div className="flex items-center gap-2 mb-2 md:mb-4">
                <StickyNote className="w-4 h-4 text-amber-500 md:w-5 md:h-5" />
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide md:text-lg">หมายเหตุ</h3>
              </div>
              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 text-xs text-slate-600 leading-relaxed md:text-sm md:p-4 whitespace-pre-wrap">
                {data.note}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Section */}
      <ShopFooter shopInfo={shopInfo} maxWidthClass="max-w-5xl" />
    </div>
  );
};

export default CustomerTrackingView;
