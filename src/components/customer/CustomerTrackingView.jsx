import React, { useState, useEffect } from 'react';
import { 
  PackageCheck, Search, AlertCircle, Activity, Maximize2, 
  ChevronRight, User, Truck, StickyNote, XCircle, Clipboard, 
  CheckCircle, Loader2, MapPin, Calendar, Clock, Sparkles 
} from 'lucide-react';
import ImageViewer from '../common/ImageViewer';
import ShopFooter from '../common/ShopFooter';
import { applyThemeVariables } from '../../utils/themeManager';
import { processImageUrl, formatDate, renderDeliveryTime } from '../../utils/formatters';
import { systemStatusTypes } from '../../constants/appConstants';

export const CustomerTrackingView = ({ data, shopInfo, dealStatuses = [], transportStatuses = [] }) => {
  const [previewImage, setPreviewImage] = useState(null); 

  // Set Document Title and apply active shop theme dynamically
  useEffect(() => {
    const title = shopInfo?.shopName ? `ติดตามสถานะงาน - ${shopInfo.shopName}` : 'ติดตามสถานะงาน';
    document.title = title;
    if (shopInfo?.themeColor) {
      applyThemeVariables(shopInfo.themeColor, shopInfo.themeMode, shopInfo.customColorValue);
    }
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
    <div className="min-h-screen bg-slate-50/70 pb-safe font-sans flex flex-col antialiased selection:bg-indigo-500 selection:text-white">
      {/* Image Viewer Portal */}
      {previewImage && <ImageViewer src={previewImage} onClose={() => setPreviewImage(null)} />}

      {/* Hero Header matching Active Theme */}
      <div 
        className="theme-logo-bg text-white pt-8 pb-12 px-4 rounded-b-[2.5rem] shadow-xl relative overflow-hidden z-0 md:pt-14 md:pb-24 md:rounded-b-[3.5rem] transition-all"
        style={{
          background: 'var(--theme-logo-bg, var(--theme-gradient-image, var(--theme-main, #8b5cf6)))',
          boxShadow: '0 20px 25px -5px var(--theme-shadow, rgba(139, 92, 246, 0.25))'
        }}
      >
        {/* Ambient Glows */}
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
        <div 
          className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full blur-3xl pointer-events-none"
          style={{ backgroundColor: 'var(--theme-light, #faf5ff)', opacity: 0.2 }}
        ></div>
        <div className="absolute top-2 right-4 opacity-10 pointer-events-none">
          <PackageCheck className="w-28 h-28 transform rotate-12 md:w-56 md:h-56 md:opacity-15" />
        </div>
        <div className="relative z-10 flex flex-col items-center text-center space-y-2.5 max-w-2xl mx-auto">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-none drop-shadow-sm">
            {shopInfo?.shopName || 'ติดตามสถานะงาน'}
          </h1>
          <div className="inline-flex items-center gap-2 bg-white/20 px-3.5 py-1.5 rounded-full backdrop-blur-md border border-white/25 shadow-xs">
            <Search className="w-3.5 h-3.5 text-white/90" />
            <p className="text-white text-xs sm:text-sm font-bold tracking-wide">ระบบติดตามสถานะ (Tracking Status)</p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="w-full max-w-5xl mx-auto px-4 relative z-10 space-y-4 md:space-y-6 -mt-7 md:-mt-16 mb-12 md:mb-20 pb-4 md:pb-8 flex-1">
        {/* Row 1: Main Card (Name, ID, Status, Image Preview, Timeline) */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow p-5 sm:p-7 md:p-8 flex flex-col gap-6 relative">
          <div className="flex flex-col md:flex-row md:items-center md:gap-8 justify-between">
            {/* Top Area: Info (Left) + Small Image Preview (Right) */}
            <div className="flex items-start justify-between gap-4 md:flex-1">
              <div className="flex flex-col gap-2 min-w-0 flex-1">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight line-clamp-2 md:text-3xl">
                  {data.name}
                </h2>
                
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-black text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-3 py-1 rounded-xl text-xs sm:text-sm tracking-wide shadow-2xs">
                    {data.id}
                  </span>
                  <span className={`px-3 py-1 rounded-xl text-xs sm:text-sm font-bold border flex items-center gap-1.5 shadow-2xs ${dealState.color}`}>
                    {dealState.type === 'cancelled' ? <AlertCircle className="w-3.5 h-3.5" /> : <Activity className="w-3.5 h-3.5" />}
                    {dealState.label}
                  </span>
                </div>
              </div>

              {/* Right: Small Image Preview */}
              {data.image && (
                <div 
                  className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 shrink-0 rounded-2xl overflow-hidden border-2 border-white shadow-md bg-slate-100 relative group cursor-pointer transition-transform hover:scale-105"
                  onClick={() => setPreviewImage({
                    images: Array.isArray(data.images) && data.images.length > 0 ? data.images : [data.image],
                    initialIndex: 0,
                    title: 'รูปภาพอ้างอิง'
                  })}
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
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/35 transition-colors flex items-center justify-center">
                    <Maximize2 className="w-4 h-4 text-white opacity-80 group-hover:opacity-100 drop-shadow-sm transition-opacity" />
                  </div>
                </div>
              )}
            </div>

            {/* PC Separator */}
            <div className="hidden md:block w-px bg-slate-100 self-stretch my-1"></div>
            <div className="h-px bg-slate-100 w-full md:hidden my-1"></div>

            {/* Timeline Section */}
            <div className="w-full md:flex-1 pt-2 md:pt-0">
              <div className="relative w-full py-1">
                {/* Connecting Line */}
                <div className="absolute left-[12.5%] right-[12.5%] top-[18px] md:top-[22px] h-1 bg-slate-100 -z-0 rounded-full"></div>

                <div className="grid grid-cols-4 w-full relative z-10">
                  {steps.map((stepId, idx) => {
                    const info = getStepInfo(stepId);
                    const StepIcon = info.icon;

                    return (
                      <div key={stepId} className="flex flex-col items-center gap-2 relative">
                        {idx < steps.length - 1 && (
                          <div className="absolute top-[18px] md:top-[22px] -right-2 transform -translate-y-1/2 z-0 pointer-events-none">
                            <ChevronRight className="w-3.5 h-3.5 text-slate-300 md:w-4 md:h-4" />
                          </div>
                        )}

                        <div className={`w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all duration-300 ${info.colorClass}`}>
                          <StepIcon className={`w-4 h-4 md:w-5 md:h-5 ${info.status === 'current' ? 'animate-pulse' : ''}`} strokeWidth={info.status === 'current' ? 2.5 : 2} />
                        </div>
                        <span className={`text-xs font-bold text-center leading-tight transition-colors ${info.status === 'current' ? 'text-indigo-700 font-black' : 'text-slate-500'}`}>
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

        {/* Row 2: Two Columns Info Grid (General Info & Delivery Info) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {/* Box 1: General Info */}
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm sm:text-base border-b border-indigo-50 pb-2.5 mb-3.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <span>ข้อมูลทั่วไป</span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-1 border-b border-slate-50">
                  <span className="text-xs sm:text-sm font-semibold text-slate-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" /> วันที่
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-slate-800 text-right">{formatDate(data.rawDateTime)}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-50">
                  <span className="text-xs sm:text-sm font-semibold text-slate-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> ศิลปิน
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-slate-800 text-right">{data.artist || '-'}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-xs sm:text-sm font-semibold text-slate-400 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" /> ลูกค้า
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-slate-800 text-right">{data.customer || '-'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Box 2: Delivery Details */}
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="flex items-center gap-2 text-rose-700 font-bold text-sm sm:text-base border-b border-rose-50 pb-2.5 mb-3.5">
                <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <Truck className="w-4 h-4" />
                </div>
                <span>การจัดส่ง</span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-start py-1 border-b border-slate-50">
                  <span className="text-xs sm:text-sm font-semibold text-slate-400 flex items-center gap-1.5 shrink-0">
                    <Clock className="w-3.5 h-3.5 text-rose-500" /> กำหนดส่ง
                  </span>
                  <div className="text-xs sm:text-sm font-bold text-slate-800 text-right">{renderDeliveryTime(data)}</div>
                </div>
                <div className="flex justify-between items-start py-1 border-b border-slate-50 gap-2">
                  <span className="text-xs sm:text-sm font-semibold text-slate-400 flex items-center gap-1.5 shrink-0">
                    <MapPin className="w-3.5 h-3.5 text-rose-500" /> สถานที่
                  </span>
                  <div className="text-right flex-1 flex flex-col items-end">
                    <span className="text-xs sm:text-sm font-bold text-slate-800 leading-snug">{data.location || '-'}</span>
                    {data.mapLink && (
                      <a 
                        href={data.mapLink} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-bold mt-1 bg-blue-50 px-2.5 py-0.5 rounded-md hover:bg-blue-100 transition-colors cursor-pointer"
                      >
                        <MapPin className="w-3 h-3 text-blue-600" /> แผนที่ Google Map
                      </a>
                    )}
                  </div>
                </div>
                {(data.recipient || data.recipientPhone) && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-xs sm:text-sm font-semibold text-slate-400 shrink-0">ผู้รับ</span>
                    <div className="text-right">
                      <span className="text-xs sm:text-sm font-bold text-slate-800">{data.recipient || '-'}</span>
                      {data.recipientPhone && (
                        <a 
                          href={`tel:${data.recipientPhone}`} 
                          className="text-xs sm:text-sm font-bold text-indigo-600 hover:text-indigo-800 block underline decoration-indigo-200"
                        >
                          {data.recipientPhone}
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Note Card */}
        {data.note && (
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <StickyNote className="w-4 h-4" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-800">หมายเหตุ</h3>
            </div>
            <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200/80 text-xs sm:text-sm font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">
              {data.note}
            </div>
          </div>
        )}
      </div>

      {/* Footer Section with Clean Separation */}
      <ShopFooter shopInfo={shopInfo} maxWidthClass="max-w-5xl" />
    </div>
  );
};

export default CustomerTrackingView;
