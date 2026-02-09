import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Home,
  BarChart2,
  Settings,
  Search,
  Menu,
  X,
  TrendingUp,
  TrendingDown,
  Clipboard,
  CheckCircle,
  Clock,
  AlertCircle,
  MoreHorizontal,
  FileText,
  Users,
  List,
  User,
  Shield,
  LogOut,
  ChevronRight,
  ChevronLeft,
  ArrowUpRight,
  Folder,
  Plus,
  Calendar,
  MapPin,
  Trash2,
  DollarSign,
  Briefcase,
  Truck,
  Tag,
  Edit,
  AlertTriangle,
  Phone,
  ExternalLink,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  RotateCcw,
  ChevronDown,
  PieChart,
  Activity,
  Hourglass,
  Trophy,
  Crown,
  SlidersHorizontal,
  StickyNote,
  Bell,
  Mail,
  Save,
  Moon,
  Camera,
  ListPlus,
  XCircle,
  GripVertical,
  Check,
  Palette,
  CalendarDays,
  Gift,
  Wallet,
  ThumbsDown,
  Layers,
  ChevronUp,
  Loader2,
  Wifi,
  WifiOff,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  Image as ImageIcon,
  UploadCloud,
  HardDrive,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Share2,
  Copy,
  Printer,
  Link as LinkIcon,
  PackageCheck
} from 'lucide-react';

// --- CONFIGURATION ---
// นำ Web App URL ที่ได้จากการ Deploy Apps Script มาวางที่นี่
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwwbLiohFgwdwHCqAScpPPfuNMrJPlLn2XB9PV5CPKIB8paFYd0J1ZXyOP5C2bGD0ZgyA/exec"; 
// ---------------------

const navItems = [
  { name: 'Overview', icon: Home, label: 'ภาพรวมแผนงาน' },
  { name: 'Analytics', icon: BarChart2, label: 'วิเคราะห์ประสิทธิภาพ' },
  { name: 'Plans', icon: List, label: 'รายการแผนงาน' },
  { name: 'Settings', icon: Settings, label: 'ตั้งค่า' },
];

const colorPresets = [
  { name: 'Slate', value: 'bg-slate-50 text-slate-500 border-slate-200', dot: 'bg-slate-400' },
  { name: 'Blue', value: 'bg-blue-50 text-blue-700 border-blue-100', dot: 'bg-blue-500' },
  { name: 'Indigo', value: 'bg-indigo-50 text-indigo-700 border-indigo-100', dot: 'bg-indigo-500' },
  { name: 'Violet', value: 'bg-violet-50 text-violet-700 border-violet-100', dot: 'bg-violet-500' },
  { name: 'Amber', value: 'bg-amber-50 text-amber-700 border-amber-100', dot: 'bg-amber-500' },
  { name: 'Emerald', value: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-500' },
  { name: 'Rose', value: 'bg-rose-50 text-rose-700 border-rose-100', dot: 'bg-rose-500' },
  { name: 'Orange', value: 'bg-orange-50 text-orange-700 border-orange-100', dot: 'bg-orange-500' },
];

const systemStatusTypes = [
  { value: 'completed', label: 'งานเสร็จสิ้น', color: 'text-emerald-600 bg-emerald-50' },
  { value: 'active', label: 'กำลังดำเนินการ', color: 'text-blue-600 bg-blue-50' },
  { value: 'pending', label: 'รอดำเนินการ', color: 'text-amber-600 bg-amber-50' },
  { value: 'cancelled', label: 'ยกเลิก/มีปัญหา', color: 'text-rose-600 bg-rose-50' },
  { value: 'declined', label: 'ลูกค้าไม่อนุมัติ', color: 'text-gray-600 bg-gray-50' }
];

const processImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  if (url.includes('drive.google.com') && url.includes('id=')) {
      const idMatch = url.match(/id=([a-zA-Z0-9_-]+)/);
      if (idMatch && idMatch[1]) {
          return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w4000`;
      }
  }
  return url;
};

const formatDate = (isoString) => {
  if (!isoString) return "";
  const dateObj = new Date(isoString);
  if (isNaN(dateObj.getTime())) return "";
  
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear() + 543;
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

const renderDeliveryTime = (item) => {
  const start = formatDate(item.rawDeliveryStart);
  const end = formatDate(item.rawDeliveryEnd || item.rawDeliveryDateTime);
  
  if (item.rawDeliveryStart && (item.rawDeliveryEnd || item.rawDeliveryDateTime)) {
      return (
          <div className="flex flex-col">
              <span>{start}</span>
              <span>{end}</span>
          </div>
      );
  }
  return <span>{end || item.deliveryDate || '-'}</span>;
};

const ImageViewer = ({ src, onClose }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [initialDistance, setInitialDistance] = useState(0);

  const containerRef = useRef(null);

  useEffect(() => {
    const handleWheel = (e) => {
      e.preventDefault();
      const newScale = Math.max(1, Math.min(scale + (e.deltaY * -0.01), 5));
      setScale(newScale);
    };
    
    const container = containerRef.current;
    if (container) {
       container.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
        if(container) container.removeEventListener('wheel', handleWheel);
    }
  }, [scale]);

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      setInitialDistance(dist);
    } else if (e.touches.length === 1 && scale > 1) {
       setIsDragging(true);
       setStartPos({ x: e.touches[0].pageX - position.x, y: e.touches[0].pageY - position.y });
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      if (initialDistance > 0) {
        const delta = dist - initialDistance;
        const newScale = Math.max(1, Math.min(scale + (delta * 0.01), 5));
        setScale(newScale);
        setInitialDistance(dist);
      }
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      e.preventDefault();
      setPosition({
        x: e.touches[0].pageX - startPos.x,
        y: e.touches[0].pageY - startPos.y
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setInitialDistance(0);
  };

  const handleMouseDown = (e) => {
     if (scale > 1) {
         setIsDragging(true);
         setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y });
     }
  };

  const handleMouseMove = (e) => {
      if (isDragging && scale > 1) {
          setPosition({ x: e.clientX - startPos.x, y: e.clientY - startPos.y });
      }
  };

  const handleMouseUp = () => setIsDragging(false);

  useEffect(() => {
     if (scale === 1) setPosition({ x: 0, y: 0 });
  }, [scale]);

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col animate-in fade-in duration-300">
       <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-50 bg-gradient-to-b from-black/50 to-transparent">
          <div className="text-white/80 text-sm font-bold flex items-center gap-2">
             <ImageIcon className="w-4 h-4" />
             Preview
          </div>
          <div className="flex items-center gap-4">
             <div className="flex gap-2 bg-white/10 rounded-full p-1 backdrop-blur-md">
                <button 
                    onClick={() => setScale(Math.max(1, scale - 0.5))}
                    className="p-2 text-white hover:bg-white/20 rounded-full transition"
                >
                    <ZoomOut className="w-5 h-5" />
                </button>
                <button 
                    onClick={() => setScale(Math.min(5, scale + 0.5))}
                    className="p-2 text-white hover:bg-white/20 rounded-full transition"
                >
                    <ZoomIn className="w-5 h-5" />
                </button>
             </div>
             <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition">
                <X className="w-6 h-6" />
             </button>
          </div>
       </div>

       <div 
          ref={containerRef}
          className="flex-1 flex items-center justify-center overflow-hidden cursor-move touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
       >
          <img 
              src={src} 
              alt="Full Preview"
              style={{ 
                  transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                  transition: isDragging ? 'none' : 'transform 0.2s ease-out',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain'
              }}
              draggable={false}
          />
       </div>
       <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/50 text-xs font-medium pointer-events-none bg-black/30 px-3 py-1 rounded-full backdrop-blur-sm">
          {scale === 1 ? 'Pinch or Scroll to Zoom' : `${Math.round(scale * 100)}%`}
       </div>
    </div>,
    document.body
  );
};

// --- Customer Tracking View ---
const CustomerTrackingView = ({ data }) => {
  if (!data) return null;

  // คำนวณยอดเรียกเก็บสุทธิ
  const wage = parseFloat(data.wage) || 0;
  const support = data.customerSupport ? data.customerSupport.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0) : 0;
  const netReceivable = wage + support;

  // Helper เพื่อกำหนดสถานะ Timeline
  const getStepStatus = (step) => {
    // Logic ง่ายๆ เพื่อจำลอง Timeline จาก status
    const deal = data.dealStatus || 'pending';
    const transport = data.transportStatus || 'pending';

    // Step 1: รับเรื่อง (Always true if data exists)
    if (step === 1) return 'completed';

    // Step 2: ดำเนินการ (Confirmed/Active deal)
    if (step === 2) {
       if (deal === 'confirmed' || deal === 'active' || deal === 'completed') return 'completed';
       if (deal === 'pending') return 'current';
       return 'pending';
    }

    // Step 3: กำลังจัดส่ง/ติดตั้ง (Active Transport)
    if (step === 3) {
       if (transport === 'delivering' || transport === 'installed' || transport === 'completed' || transport === 'delivered') return 'completed';
       if ((deal === 'confirmed' || deal === 'active') && transport !== 'pending') return 'current';
       return 'pending';
    }

    // Step 4: เสร็จสิ้น (Completed/Delivered)
    if (step === 4) {
       if (deal === 'completed' || transport === 'delivered' || transport === 'completed') return 'completed';
       return 'pending';
    }
    return 'pending';
  };

  const steps = [
    { id: 1, label: 'รับเรื่อง', icon: Clipboard },
    { id: 2, label: 'ดำเนินการ', icon: Activity },
    { id: 3, label: 'จัดส่ง/ติดตั้ง', icon: Truck },
    { id: 4, label: 'เสร็จสิ้น', icon: CheckCircle },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
       {/* Mobile Header-like Card */}
       <div className="bg-indigo-600 text-white p-6 pb-12 rounded-b-[2.5rem] shadow-lg shadow-indigo-200 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
             <PackageCheck className="w-32 h-32 transform rotate-12" />
          </div>
          <div className="relative z-10 flex flex-col items-center text-center gap-2 mt-4">
             <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-2 shadow-inner border border-white/10">
                <Search className="w-6 h-6 text-white" />
             </div>
             <h1 className="text-2xl font-black tracking-tight">ติดตามสถานะงาน</h1>
             <p className="text-indigo-100 text-sm font-medium">Project Tracking System</p>
             <div className="mt-4 bg-white/10 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/20 text-xs font-bold text-indigo-50">
                ID: {data.id}
             </div>
          </div>
       </div>

       <div className="max-w-md mx-auto px-4 -mt-8 relative z-20 space-y-6">
          
          {/* Status Card */}
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
             <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 text-center">สถานะปัจจุบัน</h2>
             <div className="flex justify-between items-start relative px-2">
                {/* Connecting Line */}
                <div className="absolute top-4 left-4 right-4 h-0.5 bg-slate-100 -z-10"></div>
                
                {steps.map((step, idx) => {
                   const status = getStepStatus(step.id);
                   let colorClass = 'bg-slate-100 text-slate-400 border-slate-200'; // pending
                   if (status === 'completed') colorClass = 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-200';
                   if (status === 'current') colorClass = 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200 scale-110';

                   return (
                      <div key={step.id} className="flex flex-col items-center gap-2">
                         <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${colorClass}`}>
                            <step.icon className="w-4 h-4" />
                         </div>
                         <span className={`text-[10px] font-bold ${status === 'current' ? 'text-indigo-600' : 'text-slate-400'}`}>
                            {step.label}
                         </span>
                      </div>
                   );
                })}
             </div>
             <div className="mt-6 text-center">
                <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold ${
                    data.dealStatus === 'cancelled' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-600'
                }`}>
                    {data.dealStatus === 'cancelled' ? <AlertCircle className="w-4 h-4"/> : <Activity className="w-4 h-4 text-indigo-500"/>}
                    {data.dealStatus === 'cancelled' ? 'ยกเลิก/มีปัญหา' : `สถานะ: ${data.dealStatus || 'กำลังดำเนินการ'}`}
                </span>
             </div>
          </div>

          {/* Project Details (Part 1) */}
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
             <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                รายละเอียดงาน
             </h3>
             <div className="space-y-4">
                <div>
                   <p className="text-xs text-slate-400 font-bold mb-1">ชื่อโครงการ</p>
                   <p className="text-base font-bold text-slate-800 leading-tight">{data.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <p className="text-xs text-slate-400 font-bold mb-1">วันที่เริ่ม</p>
                      <p className="text-sm font-bold text-slate-600">{formatDate(data.rawDateTime)}</p>
                   </div>
                   <div>
                      <p className="text-xs text-slate-400 font-bold mb-1">ศิลปิน</p>
                      <p className="text-sm font-bold text-slate-600">{data.artist}</p>
                   </div>
                </div>
                <div>
                   <p className="text-xs text-slate-400 font-bold mb-1">ลูกค้า</p>
                   <p className="text-sm font-bold text-slate-600">{data.customer}</p>
                </div>
             </div>
          </div>

          {/* Delivery & Location (Part 2) */}
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
             <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-600" />
                การจัดส่ง & สถานที่
             </h3>
             <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="flex items-start gap-3">
                   <Clock className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                   <div>
                      <p className="text-xs text-slate-400 font-bold">กำหนดส่ง</p>
                      <div className="text-sm font-bold text-slate-700">{renderDeliveryTime(data)}</div>
                   </div>
                </div>
                <div className="flex items-start gap-3">
                   <MapPin className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                   <div>
                      <p className="text-xs text-slate-400 font-bold">สถานที่</p>
                      <p className="text-sm font-bold text-slate-700">{data.location || '-'}</p>
                      {data.mapLink && (
                         <a href={data.mapLink} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1">
                            <ExternalLink className="w-3 h-3" /> เปิดแผนที่
                         </a>
                      )}
                   </div>
                </div>
                {(data.recipient || data.recipientPhone) && (
                   <div className="flex items-start gap-3 pt-2 border-t border-slate-200 mt-2">
                      <User className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                         <p className="text-xs text-slate-400 font-bold">ผู้รับ</p>
                         <p className="text-sm font-bold text-slate-700">{data.recipient || '-'}</p>
                         <p className="text-xs font-medium text-slate-500">{data.recipientPhone}</p>
                      </div>
                   </div>
                )}
             </div>
          </div>

          {/* Images */}
          {data.image && (
             <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 px-2 flex items-center gap-2">
                   <ImageIcon className="w-4 h-4" /> รูปภาพอ้างอิง
                </h3>
                <div className="rounded-2xl overflow-hidden border border-slate-100 bg-slate-50">
                   <img src={processImageUrl(data.image)} alt="Reference" className="w-full h-auto object-contain max-h-80" />
                </div>
             </div>
          )}

          {/* Net Amount */}
          <div className="bg-gradient-to-br from-indigo-600 to-violet-600 text-white p-6 rounded-[2rem] shadow-lg shadow-indigo-200">
             <div className="flex justify-between items-center">
                <div>
                   <p className="text-indigo-200 text-xs font-bold uppercase tracking-wider mb-1">ยอดชำระสุทธิ</p>
                   <p className="text-xs text-indigo-100 opacity-80">Net Receivable</p>
                </div>
                <div className="text-right">
                   <p className="text-3xl font-black tracking-tight">฿{netReceivable.toLocaleString()}</p>
                </div>
             </div>
          </div>

          <div className="text-center pb-8">
             <p className="text-xs text-slate-400">Powered by LukYeePlan</p>
          </div>

       </div>
    </div>
  );
};

const SharePreviewModal = ({ data, onClose }) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isLinkCopied, setIsLinkCopied] = useState(false); // New state for link copy

  // คำนวณยอดเรียกเก็บสุทธิ
  const wage = parseFloat(data.wage) || 0;
  const support = data.customerSupport ? data.customerSupport.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0) : 0;
  const netReceivable = wage + support;

  const handleCopyText = () => {
    const text = `
📋 *รายละเอียดงาน (Job Summary)*
🆔 ${data.id}
📌 โครงการ: ${data.name}
📅 วันที่: ${formatDate(data.rawDateTime)}
🎭 ศิลปิน: ${data.artist}
👤 ลูกค้า: ${data.customer}

🚚 *การจัดส่ง & สถานที่*
⏰ กำหนดส่ง: ${renderDeliveryTime(data)?.props?.children?.[0]?.props?.children || renderDeliveryTime(data)?.props?.children || '-'}
📍 สถานที่: ${data.location || '-'}
🗺️ แผนที่: ${data.mapLink || '-'}
📞 ผู้รับ: ${data.recipient || '-'} (${data.recipientPhone || '-'})

💰 *ยอดเรียกเก็บสุทธิ: ฿${netReceivable.toLocaleString()}*
    `.trim();

    try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }
    } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
    }
  };

  const handleCopyLink = () => {
      // สร้าง Link โดยอิงจาก URL ปัจจุบัน และเพิ่ม Query Param ?tracking=ID
      // FIX: ใช้ URL Object เพื่อจัดการ Path และ Origin ให้ถูกต้อง ป้องกันปัญหา URL ซ้อนกัน
      try {
        const urlObj = new URL(window.location.href);
        urlObj.searchParams.set('tracking', data.id);
        const url = urlObj.toString();
      
        const textArea = document.createElement("textarea");
        textArea.value = url;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
            setIsLinkCopied(true);
            setTimeout(() => setIsLinkCopied(false), 2000);
        }
      } catch (err) {
          console.error('Unable to copy link', err);
      }
  };

  const handlePrint = () => {
    window.print();
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 print:p-0">
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 print:shadow-none print:w-full print:max-w-none print:h-auto print:rounded-none">
        
        <div className="px-6 py-4 bg-indigo-600 text-white flex justify-between items-center print:hidden">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            <span className="font-bold text-lg">สำหรับลูกค้า (Customer View)</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar bg-slate-50 print:bg-white print:p-0">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 print:border-none print:shadow-none">
            
            <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
               <div>
                  <h2 className="text-xl font-black text-slate-800 leading-tight">{data.name}</h2>
                  <p className="text-slate-500 text-sm mt-1">ID: <span className="font-mono font-bold text-indigo-600">{data.id}</span></p>
               </div>
               <div className="text-right">
                  <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold border border-emerald-100">
                    ใบสรุปงาน
                  </span>
               </div>
            </div>

            <div className="space-y-4 mb-6">
               <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4" /> ข้อมูลทั่วไป
               </h3>
               <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
                  <div>
                    <p className="text-slate-400 text-xs">วันที่</p>
                    <p className="font-bold text-slate-700">{formatDate(data.rawDateTime)}</p>
                  </div>
                   <div>
                    <p className="text-slate-400 text-xs">ศิลปิน</p>
                    <p className="font-bold text-slate-700">{data.artist}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-slate-400 text-xs">ลูกค้า</p>
                    <p className="font-bold text-slate-700">{data.customer}</p>
                  </div>
               </div>
            </div>

            <div className="space-y-4 mb-6">
               <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> การจัดส่ง & สถานที่
               </h3>
               <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                  <div className="flex items-start gap-3">
                     <Clock className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                     <div>
                        <p className="text-xs text-slate-400 font-bold">กำหนดส่ง</p>
                        <div className="text-sm font-bold text-slate-700">{renderDeliveryTime(data)}</div>
                     </div>
                  </div>
                  <div className="flex items-start gap-3">
                     <MapPin className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                     <div>
                        <p className="text-xs text-slate-400 font-bold">สถานที่</p>
                        <p className="text-sm font-bold text-slate-700">{data.location || '-'}</p>
                        {data.mapLink && (
                           <a href={data.mapLink} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1">
                              <ExternalLink className="w-3 h-3" /> เปิดแผนที่
                           </a>
                        )}
                     </div>
                  </div>
                  {(data.recipient || data.recipientPhone) && (
                     <div className="flex items-start gap-3 pt-2 border-t border-slate-200 mt-2">
                        <User className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                        <div>
                           <p className="text-xs text-slate-400 font-bold">ผู้รับ</p>
                           <p className="text-sm font-bold text-slate-700">{data.recipient || '-'}</p>
                           <p className="text-xs font-medium text-slate-500">{data.recipientPhone}</p>
                        </div>
                     </div>
                  )}
               </div>
            </div>

            {data.image && (
               <div className="mb-6">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-3">
                     <ImageIcon className="w-4 h-4" /> รูปภาพอ้างอิง
                  </h3>
                  <div className="rounded-xl overflow-hidden border border-slate-200">
                     <img src={processImageUrl(data.image)} alt="Project Ref" className="w-full h-auto object-contain max-h-64 bg-slate-50" />
                  </div>
               </div>
            )}

            <div className="mt-6 pt-6 border-t-2 border-dashed border-slate-200">
               <div className="bg-indigo-600 text-white p-5 rounded-2xl shadow-lg shadow-indigo-200 flex justify-between items-center">
                  <div>
                     <p className="text-indigo-200 text-xs font-bold uppercase tracking-wider">ยอดเรียกเก็บสุทธิ</p>
                     <p className="text-xs text-indigo-100 opacity-80 mt-1">Net Receivable</p>
                  </div>
                  <div className="text-right">
                     <p className="text-3xl font-black tracking-tight">฿{netReceivable.toLocaleString()}</p>
                  </div>
               </div>
            </div>

          </div>
        </div>

        {/* Buttons Action Area */}
        <div className="p-4 bg-white border-t border-slate-100 flex flex-col gap-3 print:hidden">
           <div className="flex gap-3">
               <button 
                 onClick={handleCopyLink}
                 className={`flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${isLinkCopied ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
               >
                 {isLinkCopied ? <Check className="w-5 h-5" /> : <LinkIcon className="w-5 h-5" />}
                 {isLinkCopied ? 'คัดลอกลิงก์แล้ว' : 'คัดลอกลิงก์ติดตาม'}
               </button>
               <button 
                 onClick={handleCopyText}
                 className={`flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${isCopied ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
               >
                 {isCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                 {isCopied ? 'คัดลอกข้อความแล้ว' : 'คัดลอกข้อความ'}
               </button>
           </div>
           <button 
             onClick={handlePrint}
             className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
           >
             <Printer className="w-5 h-5" />
             พิมพ์ / บันทึก PDF
           </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

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

const LoadingOverlay = () => createPortal(
  <div className="fixed inset-0 z-[100] bg-white/60 backdrop-blur-[2px] flex items-center justify-center animate-in fade-in duration-200">
     <div className="flex flex-col items-center gap-4 bg-white p-8 rounded-[2rem] shadow-2xl border border-slate-100">
        <div className="relative">
           <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
           <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center shadow-inner">
                <Loader2 className="w-4 h-4 text-indigo-600 animate-pulse" />
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

const LoginScreen = ({ onLogin, isLoading, loginError }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(username, password, rememberMe);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md p-8 rounded-[2.5rem] shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-500">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-lg shadow-indigo-200 mb-4 rotate-3 hover:rotate-6 transition-transform">
            <Clipboard className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">ProjectPlan</h1>
          <p className="text-slate-500 text-sm mt-1">เข้าสู่ระบบเพื่อจัดการแผนงาน</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">ชื่อผู้ใช้งาน</label>
            <div className="relative">
              <User className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={username}
                disabled={isLoading}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium disabled:opacity-50"
                placeholder="Username"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">รหัสผ่าน</label>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                disabled={isLoading}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium disabled:opacity-50"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-3.5 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-1">
            <input
              type="checkbox"
              id="remember"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <label htmlFor="remember" className="text-sm font-bold text-slate-600 cursor-pointer select-none">
              จดจำการเข้าสู่ระบบ
            </label>
          </div>

          <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        กำลังตรวจสอบ...
                    </>
                ) : (
                    <>
                        <LogIn className="w-5 h-5" />
                        เข้าสู่ระบบ
                    </>
                )}
              </button>
              
              {loginError && (
                  <div className="bg-rose-50 text-rose-600 text-xs font-bold p-3 rounded-xl border border-rose-100 flex items-center gap-2 animate-in slide-in-from-top-1 fade-in">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {loginError}
                  </div>
              )}
          </div>
        </form>
        
        <div className="mt-6 text-center">
           <p className="text-xs text-slate-400 bg-slate-50 py-2 px-4 rounded-lg inline-block border border-slate-100">
             ค่าเริ่มต้น: admin / password1234
           </p>
        </div>
      </div>
    </div>
  );
};

const ViewOnlyField = ({ value, type, icon: Icon }) => {
    if (!value) {
        return (
            <div className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 italic text-sm flex items-center gap-2">
                {Icon && <Icon className="w-4 h-4" />}
                <span>-</span>
            </div>
        );
    }
  
    let content = <span className="text-slate-700 font-medium truncate block">{value}</span>;
    let Wrapper = 'div';
    let wrapperProps = { className: "w-full overflow-hidden" };
  
    if (type === 'tel') {
        Wrapper = 'a';
        wrapperProps = { href: `tel:${value}`, className: "block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-indigo-50 hover:border-indigo-200 transition-colors cursor-pointer group overflow-hidden" };
        content = (
            <div className="flex items-center gap-2 text-indigo-700 font-bold group-hover:text-indigo-800 overflow-hidden">
               <Phone className="w-4 h-4 shrink-0" />
               <span className="truncate">{value}</span>
            </div>
        );
    } else if (type === 'email') {
        Wrapper = 'a';
        wrapperProps = { href: `mailto:${value}`, className: "block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-indigo-50 hover:border-indigo-200 transition-colors cursor-pointer group overflow-hidden" };
        content = (
            <div className="flex items-center gap-2 text-indigo-700 font-bold group-hover:text-indigo-800 overflow-hidden">
               <Mail className="w-4 h-4 shrink-0" />
               <span className="truncate">{value}</span>
            </div>
        );
    } else if (type === 'url') {
        Wrapper = 'a';
        wrapperProps = { href: value, target: "_blank", rel: "noreferrer", className: "block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl hover:bg-blue-50 hover:border-blue-200 transition-colors cursor-pointer group overflow-hidden" };
        content = (
            <div className="flex items-center gap-2 text-blue-600 font-bold group-hover:text-blue-700 truncate">
               <ExternalLink className="w-4 h-4 shrink-0" />
               <span className="truncate">{value}</span>
            </div>
        );
    } else {
        return (
            <div className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium flex items-center gap-2 overflow-hidden">
                {Icon && <Icon className="w-4 h-4 text-slate-400 shrink-0" />}
                <span className="truncate">{value}</span>
            </div>
        );
    }
  
    return <Wrapper {...wrapperProps}>{content}</Wrapper>;
};

const ModernDateTimePicker = ({ value, onChange, placeholder, hasTime = true, minDate, className, compact = false, disabled = false, pickerType = 'date' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const [viewMode, setViewMode] = useState(pickerType === 'year' ? 'years' : pickerType === 'month' ? 'months' : 'days'); 
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
  const wrapperRef = useRef(null);
  const popupRef = useRef(null);

  const monthsTH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
  const monthsShortTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setViewDate(d);
      }
    }
  }, [value, isOpen]);

  useEffect(() => {
    if (isOpen) {
        if (pickerType === 'year') setViewMode('years');
        else if (pickerType === 'month') setViewMode('months');
        else setViewMode('days');
    }
  }, [isOpen, pickerType]);

  const toggleOpen = () => {
    if (disabled) return; 

    if (isOpen) {
      setIsOpen(false);
      return;
    }

    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      const popupWidth = 320; 
      const popupHeight = 380; 

      let top = rect.bottom + 4;
      let left = rect.left;

      if (top + popupHeight > screenHeight) {
        top = rect.top - popupHeight - 4;
      }

      if (left + popupWidth > screenWidth) {
        left = rect.right - popupWidth;
        if (left < 10) left = 10; 
      }

      setPopupPosition({ top, left });
      setIsOpen(true);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        wrapperRef.current && 
        !wrapperRef.current.contains(event.target) &&
        popupRef.current &&
        !popupRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    
    const handleScroll = () => {
        if(isOpen) setIsOpen(false);
    }

    if (isOpen) {
        document.addEventListener("mousedown", handleClickOutside);
        window.addEventListener("scroll", handleScroll, true);
    }
    
    return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen]);

  const handleDateClick = (day) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    
    if (pickerType === 'week') {
       const dayOfWeek = newDate.getDay(); 
       const diff = newDate.getDate() - dayOfWeek;
       const sunday = new Date(newDate.setDate(diff));
       
       const offset = sunday.getTimezoneOffset() * 60000;
       const localISOTime = new Date(sunday.getTime() - offset).toISOString().slice(0, 10);
       
       onChange({ target: { value: localISOTime } });
       setIsOpen(false);
       return;
    }

    if (value) {
      const current = new Date(value);
      if (!isNaN(current.getTime())) {
        newDate.setHours(current.getHours());
        newDate.setMinutes(current.getMinutes());
      }
    } else {
        const now = new Date();
        newDate.setHours(now.getHours());
        newDate.setMinutes(now.getMinutes());
    }

    const offset = newDate.getTimezoneOffset() * 60000;
    const localISOTime = new Date(newDate.getTime() - offset).toISOString().slice(0, 16);
    
    onChange({ target: { value: localISOTime } });
    if (!hasTime) setIsOpen(false);
  };

  const handleTimeChange = (type, val) => {
    let current = value ? new Date(value) : new Date();
    if (isNaN(current.getTime())) current = new Date();

    if (type === 'timeString') {
        const [h, m] = val.split(':');
        current.setHours(parseInt(h) || 0);
        current.setMinutes(parseInt(m) || 0);
    } else {
        if (type === 'hour') current.setHours(parseInt(val) || 0);
        if (type === 'minute') current.setMinutes(parseInt(val) || 0);
    }

    const offset = current.getTimezoneOffset() * 60000;
    const localISOTime = new Date(current.getTime() - offset).toISOString().slice(0, 16);
    onChange({ target: { value: localISOTime } });
  };

  const handleClear = () => {
      onChange({ target: { value: '' } });
      setIsOpen(false);
  };

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(viewDate.getFullYear(), viewDate.getMonth());
  const startDay = getFirstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth());
  
  const currentValDate = value ? new Date(value) : null;
  const isSelected = (day) => {
      if (!currentValDate) return false;
      
      const checkDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
      
      if (pickerType === 'week') {
          const weekStart = new Date(currentValDate);
          weekStart.setHours(0,0,0,0);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          weekEnd.setHours(23,59,59,999);
          
          return checkDate >= weekStart && checkDate <= weekEnd;
      }

      return currentValDate.getDate() === day && 
             currentValDate.getMonth() === viewDate.getMonth() && 
             currentValDate.getFullYear() === viewDate.getFullYear();
  };

  const changeMonth = (offset) => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1));
  };

  const changeYear = (offset) => {
    setViewDate(new Date(viewDate.getFullYear() + offset, viewDate.getMonth(), 1));
  };

  const selectYear = (year) => {
      const newDate = new Date(year, viewDate.getMonth(), 1);
      setViewDate(newDate);
      if (pickerType === 'year') {
         onChange({ target: { value: `${year}` } });
         setIsOpen(false);
      } else {
         setViewMode('months');
      }
  };

  const selectMonth = (monthIndex) => {
      const newDate = new Date(viewDate.getFullYear(), monthIndex, 1);
      setViewDate(newDate);
      if (pickerType === 'month') {
         const mm = String(monthIndex + 1).padStart(2, '0');
         onChange({ target: { value: `${viewDate.getFullYear()}-${mm}` } });
         setIsOpen(false);
      } else {
         setViewMode('days');
      }
  };

  const getDisplayText = () => {
    if (!value) return placeholder || "เลือกวันเวลา...";
    
    if (pickerType === 'week') {
        const startDate = new Date(value);
        if (isNaN(startDate.getTime())) return value;
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        
        const startDay = startDate.getDate();
        const startMonth = monthsShortTH[startDate.getMonth()];
        const endDay = endDate.getDate();
        const endMonth = monthsShortTH[endDate.getMonth()];
        const year = startDate.getFullYear() + 543;
        
        return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${year}`;
    }

    if (pickerType === 'month') {
        const parts = value.split('-');
        if (parts.length >= 2) {
            const year = parseInt(parts[0]) + 543;
            const month = parseInt(parts[1]) - 1;
            return `${monthsTH[month]} ${year}`;
        }
        return value;
    }

    if (pickerType === 'year') {
        return parseInt(value) + 543;
    }

    return formatDate(value);
  };

  const renderContent = () => {
      if (viewMode === 'years') {
          const currentYear = viewDate.getFullYear();
          const startYear = currentYear - 7;
          const years = Array.from({length: 16}, (_, i) => startYear + i);
          
          return (
              <div className="grid grid-cols-4 gap-2 p-2">
                  {years.map(year => {
                      const isSelectedYear = pickerType === 'year' && value && parseInt(value) === year;
                      return (
                        <button
                            key={year}
                            onClick={() => selectYear(year)}
                            className={`p-2 rounded-xl text-sm font-bold transition-all ${
                                year === currentYear || isSelectedYear
                                ? 'bg-indigo-600 text-white shadow-md' 
                                : 'hover:bg-indigo-50 text-slate-700'
                            }`}
                        >
                            {year + 543}
                        </button>
                      );
                  })}
              </div>
          );
      }

      if (viewMode === 'months') {
          return (
              <div className="grid grid-cols-3 gap-3 p-2">
                  {monthsShortTH.map((m, i) => {
                      const isSelectedMonth = pickerType === 'month' && value && value === `${viewDate.getFullYear()}-${String(i + 1).padStart(2, '0')}`;
                      return (
                        <button
                            key={i}
                            onClick={() => selectMonth(i)}
                            className={`p-3 rounded-xl text-sm font-bold transition-all ${
                                i === viewDate.getMonth() || isSelectedMonth
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'hover:bg-indigo-50 text-slate-700'
                            }`}
                        >
                            {m}
                        </button>
                      );
                  })}
              </div>
          );
      }

      return (
          <>
             <div className="grid grid-cols-7 mb-2 text-center">
                {['อา','จ','อ','พ','พฤ','ศ','ส'].map(d => (
                  <span key={d} className="text-xs font-bold text-slate-400">{d}</span>
                ))}
             </div>
             <div className="grid grid-cols-7 gap-1 mb-4">
                {Array.from({ length: startDay }).map((_, i) => <div key={`empty-${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const active = isSelected(day);
                  const isToday = new Date().getDate() === day && new Date().getMonth() === new Date().getMonth() && new Date().getFullYear() === new Date().getFullYear();
                  
                  let weekClass = '';
                  if (pickerType === 'week' && active) {
                      weekClass = 'bg-indigo-100 text-indigo-700 rounded-none first:rounded-l-lg last:rounded-r-lg';
                      if (currentValDate && day === currentValDate.getDate()) weekClass += ' font-bold ring-1 ring-indigo-300';
                  }

                  return (
                    <button
                      key={day}
                      onClick={() => handleDateClick(day)}
                      className={`h-8 w-full flex items-center justify-center text-sm font-medium transition-all
                        ${pickerType !== 'week' && active ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 rounded-full' : ''}
                        ${pickerType === 'week' && active ? weekClass : 'hover:bg-indigo-50 text-slate-700 rounded-full'}
                        ${!active && isToday ? 'border border-indigo-200 bg-indigo-50/50 rounded-full' : ''}
                      `}
                    >
                      {day}
                    </button>
                  )
                })}
             </div>
          </>
      );
  };

  const baseClasses = "w-full border rounded-xl flex items-center justify-between cursor-pointer transition-all";
  const sizeClasses = compact ? "px-2.5 py-1.5" : "px-4 py-3";
  const stateClasses = disabled 
    ? 'bg-slate-100 border-slate-200 cursor-not-allowed opacity-70 pointer-events-none' 
    : `bg-white border-slate-200 hover:border-indigo-300 ${isOpen ? 'ring-2 ring-indigo-500/20 border-indigo-500' : ''}`;

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div 
        onClick={toggleOpen}
        className={`${baseClasses} ${sizeClasses} ${stateClasses} ${className || ''}`}
      >
        <span className={`font-medium truncate ${value ? 'text-slate-700' : 'text-slate-400'} ${compact ? 'text-xs' : 'text-sm'}`}>
           {getDisplayText()}
        </span>
        <CalendarDays className={`text-indigo-500 shrink-0 ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${disabled ? 'text-slate-400' : ''}`} />
      </div>

      {isOpen && createPortal(
        <div 
            ref={popupRef}
            style={{ 
                position: 'fixed', 
                top: popupPosition.top, 
                left: popupPosition.left,
                minWidth: '300px',
                maxWidth: '320px',
                zIndex: 99999
            }}
            className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 animate-in fade-in zoom-in-95 duration-200"
        >
           <div className="flex justify-between items-center mb-4 pl-1 pr-1">
              <div className="flex items-center gap-1">
                  {viewMode !== 'days' && pickerType !== 'month' && pickerType !== 'year' && (
                      <button onClick={() => setViewMode('days')} className="p-1 hover:bg-slate-100 rounded-lg mr-1">
                          <ArrowUp className="w-4 h-4 text-slate-500" />
                      </button>
                  )}
                  <button 
                    onClick={() => {
                        if (pickerType === 'year') return; 
                        if (pickerType === 'month' && viewMode === 'years') return;
                        setViewMode(viewMode === 'years' ? 'days' : 'years')
                    }}
                    disabled={pickerType === 'year'}
                    className={`font-black text-slate-800 px-2 py-1 rounded-lg transition-colors text-base ${pickerType === 'year' ? 'cursor-default' : 'hover:bg-slate-100'}`}
                  >
                    {viewMode === 'days' && `${monthsTH[viewDate.getMonth()]} ${viewDate.getFullYear() + 543}`}
                    {viewMode === 'months' && `${viewDate.getFullYear() + 543}`}
                    {viewMode === 'years' && `${viewDate.getFullYear() - 7 + 543} - ${viewDate.getFullYear() + 8 + 543}`}
                  </button>
              </div>

              <div className="flex gap-1">
                <button 
                    onClick={() => {
                        if (viewMode === 'days') changeMonth(-1);
                        else if (viewMode === 'years') changeYear(-16);
                        else changeYear(-1);
                    }} 
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"
                >
                    <ChevronUp className="w-5 h-5 -rotate-90"/>
                </button>
                <button 
                    onClick={() => {
                        if (viewMode === 'days') changeMonth(1);
                        else if (viewMode === 'years') changeYear(16);
                        else changeYear(1);
                    }} 
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500"
                >
                    <ChevronUp className="w-5 h-5 rotate-90"/>
                </button>
              </div>
           </div>

           {renderContent()}

           <div className="border-t border-slate-100 pt-3 mt-2 flex flex-col gap-3">
             {hasTime && viewMode === 'days' && pickerType === 'date' && (
                 <div className="flex flex-col gap-1 w-full">
                    <label className="text-[10px] font-bold text-slate-400 ml-1 uppercase tracking-wide">เวลา (24 ชม.)</label>
                    <div className="flex items-center bg-slate-50 rounded-xl px-3 py-2 border border-slate-200 hover:border-indigo-300 transition-all group focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:bg-white">
                       <Clock className="w-4 h-4 text-slate-400 mr-2 group-focus-within:text-indigo-500 transition-colors" />
                       <input 
                          type="time" 
                          className="bg-transparent w-full font-bold text-slate-700 outline-none text-base font-mono placeholder:text-slate-300"
                          value={value ? new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) : '00:00'}
                          onChange={(e) => handleTimeChange('timeString', e.target.value)}
                       />
                    </div>
                 </div>
             )}
             
             <div className="flex gap-2 w-full mt-1">
                <button 
                  onClick={handleClear} 
                  className="flex-1 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-rose-500 px-3 py-2 rounded-lg transition-colors"
                >
                  ล้างค่า
                </button>
                <button 
                  onClick={() => setIsOpen(false)} 
                  className="flex-1 text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-2 rounded-lg transition-colors shadow-sm shadow-indigo-200"
                >
                  เสร็จสิ้น
                </button>
             </div>
           </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const ListManager = ({ title, items, onAdd, onDelete, placeholder, icon: Icon, onSave }) => {
  const [newItem, setNewItem] = useState('');
  
  const handleAdd = () => {
    if (newItem.trim()) {
        const newItems = [...items, newItem];
        onAdd(newItem);
        onSave(newItems);
        setNewItem('');
    }
  };

  const handleDelete = (index) => {
      const newItems = items.filter((_, i) => i !== index);
      onDelete(index);
      onSave(newItems);
  };

  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4 text-slate-800 font-bold border-b border-slate-100 pb-3">
        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
           <Icon className="w-5 h-5" />
        </div>
        {title}
      </div>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
        />
        <button
          onClick={handleAdd}
          className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar max-h-[200px] space-y-2">
         {items.map((item, idx) => (
           <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl group hover:bg-slate-100 transition-colors">
              <span className="text-sm font-medium text-slate-700">{typeof item === 'string' ? item : item.label}</span>
              <button
                onClick={() => handleDelete(idx)}
                className="text-slate-300 hover:text-rose-500 transition-colors p-1"
              >
                <XCircle className="w-4 h-4" />
              </button>
           </div>
         ))}
         {items.length === 0 && <p className="text-center text-slate-400 text-xs py-4">ไม่มีรายการ</p>}
      </div>
    </div>
  );
};

const AdvancedListManager = ({ title, items, onUpdate, placeholder, icon: Icon, onSave }) => {
  const [newItemLabel, setNewItemLabel] = useState('');
  const [selectedColor, setSelectedColor] = useState(colorPresets[0].value);
  const [selectedType, setSelectedType] = useState('pending');
  
  const [isEditing, setIsEditing] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const [draggedItemIndex, setDraggedItemIndex] = useState(null);

  const handleAddOrUpdate = () => {
    if (!newItemLabel.trim()) return;

    let updatedItems;
    if (isEditing && editIndex !== null) {
      updatedItems = [...items];
      updatedItems[editIndex] = {
        ...updatedItems[editIndex],
        label: newItemLabel,
        color: selectedColor,
        type: selectedType
      };
      setIsEditing(false);
      setEditIndex(null);
    } else {
      const newItem = {
        value: `custom-${Date.now()}`,
        label: newItemLabel,
        color: selectedColor,
        type: selectedType
      };
      updatedItems = [...items, newItem];
    }
    
    onUpdate(updatedItems);
    onSave(updatedItems);

    setNewItemLabel('');
    setSelectedColor(colorPresets[0].value);
    setSelectedType('pending');
  };

  const startEdit = (index) => {
      const item = items[index];
      setNewItemLabel(item.label);
      setSelectedColor(item.color);
      setSelectedType(item.type || 'pending');
      setIsEditing(true);
      setEditIndex(index);
    };

    const cancelEdit = () => {
      setIsEditing(false);
      setEditIndex(null);
      setNewItemLabel('');
      setSelectedColor(colorPresets[0].value);
      setSelectedType('pending');
    };

    const handleDelete = (index) => {
      const updatedItems = items.filter((_, i) => i !== index);
      onUpdate(updatedItems);
      onSave(updatedItems);
      if (isEditing && editIndex === index) {
        cancelEdit();
      }
    };

  const onDragStart = (e, index) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e, index) => {
    e.preventDefault(); 
    if (draggedItemIndex === null || draggedItemIndex === index) return;

    const newItems = [...items];
    const draggedItem = newItems[draggedItemIndex];
    newItems.splice(draggedItemIndex, 1);
    newItems.splice(index, 0, draggedItem);

    setDraggedItemIndex(index);
    onUpdate(newItems);
  };

  const onDragEnd = () => {
    if (draggedItemIndex !== null) {
       onSave(items); 
    }
    setDraggedItemIndex(null);
  };

  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2 text-slate-800 font-bold">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Icon className="w-5 h-5" />
          </div>
          {title}
        </div>
        {isEditing && (
          <span className="text-xs font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded-lg animate-pulse">
            กำลังแก้ไข
          </span>
        )}
      </div>

      <div className="flex flex-col gap-3 mb-6 p-4 bg-slate-50/80 rounded-2xl border border-slate-100">
        <input
          type="text"
          value={newItemLabel}
          onChange={(e) => setNewItemLabel(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAddOrUpdate();
          }}
        />
        
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 min-w-[140px]">
              <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full h-10 pl-3 pr-8 bg-white border border-slate-200 rounded-xl text-xs font-bold appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                  {systemStatusTypes.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
              </select>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <Layers className="w-3.5 h-3.5" />
              </div>
          </div>

          {isEditing ? (
              <div className="flex gap-1 shrink-0">
                  <button
                  onClick={handleAddOrUpdate}
                  className="h-10 px-3 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition shadow-sm flex items-center justify-center"
                  title="บันทึก"
                  >
                  <Check className="w-5 h-5" />
                  </button>
                  <button
                  onClick={cancelEdit}
                  className="h-10 px-3 bg-slate-200 text-slate-500 rounded-xl hover:bg-slate-300 transition flex items-center justify-center"
                  title="ยกเลิก"
                  >
                  <X className="w-5 h-5" />
                  </button>
              </div>
              ) : (
              <button
                  onClick={handleAddOrUpdate}
                  className="h-10 px-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition shadow-indigo-200 shadow-sm font-bold flex items-center justify-center shrink-0"
                  title="เพิ่ม"
              >
                  <Plus className="w-5 h-5 mr-1" /> เพิ่ม
              </button>
          )}
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 pt-2 border-t border-slate-100">
          <Palette className="w-4 h-4 text-slate-400 shrink-0 mr-1" />
          {colorPresets.map((preset) => (
            <button
              key={preset.name}
              onClick={() => setSelectedColor(preset.value)}
              className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center transition-all ${preset.dot} ${
                selectedColor === preset.value ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-110 opacity-70 hover:opacity-100'
              }`}
              title={preset.name}
            >
              {selectedColor === preset.value && <Check className="w-3 h-3 text-white stroke-[3]" />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar max-h-[300px] space-y-2 pr-1">
         {items.map((item, idx) => {
           const sysType = systemStatusTypes.find(t => t.value === item.type);
           return (
              <div 
                  key={item.value} 
                  draggable
                  onDragStart={(e) => onDragStart(e, idx)}
                  onDragOver={(e) => onDragOver(e, idx)}
                  onDragEnd={onDragEnd}
                  className={`flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl group hover:border-indigo-100 hover:shadow-sm transition-all ${
                  isEditing && editIndex === idx ? 'ring-2 ring-amber-400 border-transparent bg-amber-50' : ''
                  } ${draggedItemIndex === idx ? 'opacity-50 scale-[0.98]' : ''}`}
              >
                  <div className="flex flex-col gap-1 overflow-hidden w-full">
                      <div className="flex items-center gap-3">
                          <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 p-1">
                              <GripVertical className="w-4 h-4" />
                          </div>
                          <div className={`w-3 h-3 rounded-full shrink-0 ${
                              colorPresets.find(c => c.value === item.color)?.dot || 'bg-slate-300'
                          }`}></div>
                          <span className={`text-sm font-medium truncate ${isEditing && editIndex === idx ? 'text-amber-700' : 'text-slate-700'}`}>
                              {item.label}
                          </span>
                      </div>
                      <div className="pl-10">
                           <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold inline-flex items-center ${sysType ? sysType.color : 'text-gray-500 bg-gray-100'}`}>
                              <Layers className="w-3 h-3 mr-1" />
                              {sysType ? sysType.label : 'ไม่ระบุ'}
                           </span>
                      </div>
                  </div>
                  
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity self-start">
                  <button
                      onClick={() => startEdit(idx)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                      title="แก้ไข"
                  >
                      <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button
                      onClick={() => handleDelete(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"
                      title="ลบ"
                  >
                      <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  </div>
              </div>
           );
         })}
         {items.length === 0 && <p className="text-center text-slate-400 text-xs py-4">ไม่มีรายการ</p>}
      </div>
    </div>
  );
};

const DateFilterControl = ({ mode, setMode, date, setDate, range, setRange }) => {
  return (
      <div className="flex bg-white border border-slate-200 rounded-2xl overflow-hidden h-full shadow-sm hover:border-indigo-300 transition-colors w-full md:w-auto">
          <div className="relative border-r border-slate-100 bg-slate-50 w-[110px] shrink-0">
               <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <CalendarDays className="w-4 h-4" />
               </div>
               <select
                  value={mode}
                  onChange={(e) => {
                      const selectedMode = e.target.value;
                      setMode(selectedMode);
                      
                      const today = new Date();
                      const yyyy = today.getFullYear();
                      const mm = String(today.getMonth() + 1).padStart(2, '0');
                      const dd = String(today.getDate()).padStart(2, '0');

                      if (selectedMode === 'date') {
                         setDate(`${yyyy}-${mm}-${dd}`);
                      } else if (selectedMode === 'month') {
                         setDate(`${yyyy}-${mm}`);
                      } else if (selectedMode === 'year') {
                         setDate(`${yyyy}`);
                      } else if (selectedMode === 'week') {
                         setDate(`${yyyy}-${mm}-${dd}`);
                      } else {
                         setDate('');
                      }
                      setRange({ start: '', end: '' });
                  }}
                  className="w-full h-full py-3.5 pl-9 pr-2 bg-transparent outline-none text-slate-700 text-xs font-bold appearance-none cursor-pointer"
               >
                  <option value="all">ทั้งหมด</option>
                  <option value="date">วันที่</option>
                  <option value="week">รายสัปดาห์</option>
                  <option value="month">เดือน</option>
                  <option value="year">ปี</option>
                  <option value="range">ช่วงเวลา</option>
               </select>
          </div>

          <div className="flex-1 min-w-[140px] relative bg-white">
              {mode === 'all' && (
                  <div className="w-full h-full flex items-center px-4 text-slate-400 text-sm italic whitespace-nowrap">
                      แสดงข้อมูลทั้งหมด
                  </div>
              )}
              
              {mode === 'date' && (
                  <ModernDateTimePicker value={date} onChange={(e) => setDate(e.target.value)} hasTime={false} placeholder="เลือกวันที่..." pickerType="date" />
              )}
              
              {mode === 'week' && (
                  <ModernDateTimePicker value={date} onChange={(e) => setDate(e.target.value)} hasTime={false} placeholder="เลือกสัปดาห์..." pickerType="week" />
              )}

              {mode === 'month' && (
                  <ModernDateTimePicker value={date} onChange={(e) => setDate(e.target.value)} hasTime={false} placeholder="เลือกเดือน..." pickerType="month" />
              )}

              {mode === 'year' && (
                   <ModernDateTimePicker value={date} onChange={(e) => setDate(e.target.value)} hasTime={false} placeholder="เลือกปี..." pickerType="year" />
              )}

              {mode === 'range' && (
                  <div className="flex items-center h-full px-2 gap-1 w-full overflow-hidden">
                      <div className="flex-1 min-w-0">
                        <ModernDateTimePicker 
                            value={range.start} 
                            onChange={(e) => setRange({...range, start: e.target.value})} 
                            hasTime={false} 
                            placeholder="เริ่ม" 
                            compact={true}
                            className="border-slate-200 h-9"
                        />
                      </div>
                      <span className="text-slate-300 shrink-0">-</span>
                      <div className="flex-1 min-w-0">
                        <ModernDateTimePicker 
                            value={range.end} 
                            onChange={(e) => setRange({...range, end: e.target.value})} 
                            hasTime={false} 
                            placeholder="สิ้นสุด" 
                            compact={true}
                            className="border-slate-200 h-9"
                        />
                      </div>
                  </div>
              )}
          </div>
      </div>
  );
};

const SortableHeader = ({ label, sortKey, sortConfig, handleSort, alignRight = false }) => (
  <th
    className={`px-6 py-4 font-medium whitespace-nowrap cursor-pointer hover:bg-slate-50 transition-colors group select-none ${alignRight ? 'text-right' : 'text-left'}`}
    onClick={() => handleSort(sortKey)}
  >
    <div className={`flex items-center gap-1 ${alignRight ? 'justify-end' : ''}`}>
      {label}
      <span className="text-slate-300 group-hover:text-indigo-500 transition-colors">
        {sortConfig.key === sortKey ? (
           sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        ) : (
           <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </span>
    </div>
  </th>
);

const App = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('nexus_sidebar_collapsed');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('nexus_sidebar_collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  const [activeTab, setActiveTab] = useState('Overview');

  useEffect(() => {
    const currentTab = navItems.find(item => item.name === activeTab);
    if (currentTab) {
      document.title = `${currentTab.label} - NexusPlan`;
    } else {
      document.title = "NexusPlan Dashboard";
    }
  }, [activeTab]);

  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [isSaving, setIsSaving] = useState(false); 

  const [visibleCount, setVisibleCount] = useState(20);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [animateCharts, setAnimateCharts] = useState(false);

  useEffect(() => {
     setAnimateCharts(false);
     const timer = setTimeout(() => setAnimateCharts(true), 300);
     return () => clearTimeout(timer);
  }, [activeTab]);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authorizedUsers, setAuthorizedUsers] = useState([
    {
      username: 'admin',
      password: 'password1234',
      name: 'Admin User',
      role: 'System Administrator',
      email: 'admin@nexusplan.com',
      phone: '-'
    },
    {
      username: 'john',
      password: 'password1234', 
      name: 'John Smith',
      role: 'Project Manager',
      email: 'john.smith@nexusplan.com',
      phone: '081-234-5678'
    }
  ]);
  const [loginError, setLoginError] = useState('');
  const [userProfile, setUserProfile] = useState(null);

  const [newUser, setNewUser] = useState({ username: '', password: '', name: '', role: '', email: '', phone: '' });
  const [isAddingUser, setIsAddingUser] = useState(false);

  const [driveFolderId, setDriveFolderId] = useState('');

  const [projectCategories, setProjectCategories] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [dealStatuses, setDealStatuses] = useState([]);
  const [transportStatuses, setTransportStatuses] = useState([]);

  const [isScrolled, setIsScrolled] = useState(false);
  const mainRef = useRef(null);
  const tabScrollPositions = useRef({});

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isModalClosing, setIsModalClosing] = useState(false);
  const [viewOnlyMode, setViewOnlyMode] = useState(false);
  const [isMobileFilterExpanded, setIsMobileFilterExpanded] = useState(false);
  
  // Share Data State
  const [shareData, setShareData] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const part3Ref = useRef(null);

  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null, fromModal: false });
  const [isDeleteClosing, setIsDeleteClosing] = useState(false);

  const [previewImage, setPreviewImage] = useState(null);

  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'desc' });
  const [searchTerm, setSearchTerm] = useState('');
  
  const [dateFilterMode, setDateFilterMode] = useState('all'); 
  const [filterDate, setFilterDate] = useState(''); 
  const [filterDateRange, setFilterDateRange] = useState({ start: '', end: '' });

  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTransport, setFilterTransport] = useState('all');

  // Tracking State
  const [trackingId, setTrackingId] = useState(null);

  useEffect(() => {
    setVisibleCount(20);
    setIsLoadingMore(false);
  }, [activeTab, searchTerm, dateFilterMode, filterDate, filterDateRange, filterCategory, filterStatus, filterTransport, sortConfig]);

  // Autocomplete Data
  const [savedArtists, setSavedArtists] = useState([]);
  const [savedCustomers, setSavedCustomers] = useState([]);
  const [savedRecipients, setSavedRecipients] = useState([]);

  const [currentId, setCurrentId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectDateTime, setProjectDateTime] = useState('');

  const [artistName, setArtistName] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerSocial, setCustomerSocial] = useState('');
  const [customerLine, setCustomerLine] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [projectCategory, setProjectCategory] = useState('');

  const [deliveryStart, setDeliveryStart] = useState('');
  const [deliveryEnd, setDeliveryEnd] = useState('');

  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [locationName, setLocationName] = useState('');
  const [mapLink, setMapLink] = useState('');
  const [uploadedImage, setUploadedImage] = useState(null);

  const [note, setNote] = useState('');

  const [wage, setWage] = useState(0);
  const [transportStatus, setTransportStatus] = useState('');
  const [dealStatus, setDealStatus] = useState('');
  
  const [expenses, setExpenses] = useState([{ category: '', detail: '', price: 0 }]);
  const [customerSupportItems, setCustomerSupportItems] = useState([{ detail: '', price: 0 }]);
  
  const [allActivities, setAllActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const auth = localStorage.getItem('nexus_auth');
    const savedProfile = localStorage.getItem('nexus_profile');
    if (auth && savedProfile) {
        setIsLoggedIn(true);
        setUserProfile(JSON.parse(savedProfile));
    }
  }, []);

  // Parse URL for tracking ID
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const trackId = searchParams.get('tracking');
    if (trackId) {
        setTrackingId(trackId);
    }
  }, []);

  const fetchSettings = async () => {
    if (!GOOGLE_SCRIPT_URL) return;
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getSettings' })
        });
        const result = await response.json();
        if (result.status === 'success' && result.data) {
            const data = result.data;
            if (data.project_categories) setProjectCategories(data.project_categories);
            if (data.expense_categories) setExpenseCategories(data.expense_categories);
            if (data.deal_statuses) setDealStatuses(data.deal_statuses);
            if (data.transport_statuses) setTransportStatuses(data.transport_statuses);
            if (data.drive_folder_id) setDriveFolderId(data.drive_folder_id);
            
            if (data.app_credentials) {
                let creds = data.app_credentials;
                if (!Array.isArray(creds)) {
                    creds = [{
                        username: creds.username,
                        password: creds.password,
                        name: 'Admin',
                        role: 'Administrator',
                        email: 'admin@nexusplan.com',
                        phone: '-'
                    }];
                }
                setAuthorizedUsers(creds);
            }
        }
    } catch (error) {
        console.error("Error fetching settings:", error);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchProjects = async () => {
    if (!GOOGLE_SCRIPT_URL) return;
    setIsLoading(true);
    try {
      const response = await fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          body: JSON.stringify({ action: 'read' })
      });
      const result = await response.json();
      
      if (result.status === 'success') {
        const uniqueItems = Array.from(
            result.data.reduce((map, item) => {
                if (item.id) map.set(item.id, item);
                return map;
            }, new Map()).values()
        );

        setAllActivities(uniqueItems);
        
        const artists = [...new Set(uniqueItems.map(item => item.artist).filter(Boolean))].sort();
        setSavedArtists(artists);

        const customersMap = new Map();
        uniqueItems.forEach(item => {
            if (item.customer && !customersMap.has(item.customer)) {
                customersMap.set(item.customer, {
                    name: item.customer,
                    social: item.customerInfo?.social || '',
                    line: item.customerInfo?.line || '',
                    phone: item.customerInfo?.phone || '',
                    email: item.customerInfo?.email || ''
                });
            }
        });
        setSavedCustomers(Array.from(customersMap.values()));

        const recipientsMap = new Map();
        uniqueItems.forEach(item => {
            if (item.recipient && !recipientsMap.has(item.recipient)) {
                recipientsMap.set(item.recipient, {
                    name: item.recipient,
                    phone: item.recipientPhone || ''
                });
            }
        });
        setSavedRecipients(Array.from(recipientsMap.values()));
      }
      await fetchSettings();

    } catch (error) {
      console.error("Error fetching data:", error);
      showToast("ไม่สามารถโหลดข้อมูลได้", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn || trackingId) {
        fetchProjects();
    }
  }, [isLoggedIn, trackingId]);

  const saveSystemSettings = async (key, value) => {
      if (!GOOGLE_SCRIPT_URL) return;
      setIsSaving(true);
      try {
          await fetch(GOOGLE_SCRIPT_URL, {
              method: 'POST',
              body: JSON.stringify({
                  action: 'saveSettings',
                  data: { [key]: value }
              })
          });
          if (key === 'app_credentials') {
              setAuthorizedUsers(value);
          }
          if (key === 'drive_folder_id') {
              setDriveFolderId(value);
          }
          showToast("บันทึกการตั้งค่าสำเร็จ", "success");
      } catch (error) {
          console.error("Error saving settings:", error);
          showToast("บันทึกการตั้งค่าไม่สำเร็จ", "error");
      } finally {
          setIsSaving(false);
      }
  };

  const handleAddUser = () => {
      if (!newUser.username || !newUser.password || !newUser.name) {
          showToast("กรุณากรอก Username, Password และชื่อ", "error");
          return;
      }
      if (authorizedUsers.some(u => u.username.toLowerCase() === newUser.username.toLowerCase())) {
          showToast("ชื่อผู้ใช้นี้มีอยู่แล้ว", "error");
          return;
      }

      const updatedUsers = [...authorizedUsers, newUser];
      saveSystemSettings('app_credentials', updatedUsers);
      setAuthorizedUsers(updatedUsers);
      setNewUser({ username: '', password: '', name: '', role: '', email: '', phone: '' });
      setIsAddingUser(false);
      showToast("เพิ่มผู้ใช้งานเรียบร้อยแล้ว");
  };

  const handleDeleteUser = (usernameToDelete) => {
      if (authorizedUsers.length <= 1) {
          showToast("ไม่สามารถลบผู้ใช้งานคนสุดท้ายได้", "error");
          return;
      }
      
      const updatedUsers = authorizedUsers.filter(u => u.username !== usernameToDelete);
      saveSystemSettings('app_credentials', updatedUsers);
      setAuthorizedUsers(updatedUsers);
      showToast("ลบผู้ใช้งานเรียบร้อยแล้ว");
  };

  const handleLogin = (user, pass, remember) => {
      setIsLoading(true);
      setLoginError('');
      
      setTimeout(() => {
          const foundUser = authorizedUsers.find(u => 
              u.username.toLowerCase() === user.toLowerCase() && u.password === pass
          );

          if (foundUser) {
              setIsLoggedIn(true);
              setUserProfile({
                  name: foundUser.name,
                  role: foundUser.role,
                  email: foundUser.email,
                  phone: foundUser.phone,
                  username: foundUser.username
              });

              setActiveTab('Overview'); 

              if (remember) {
                  localStorage.setItem('nexus_auth', 'true');
                  localStorage.setItem('nexus_profile', JSON.stringify({
                      name: foundUser.name,
                      role: foundUser.role,
                      email: foundUser.email,
                      phone: foundUser.phone,
                      username: foundUser.username
                  }));
              }
              showToast(`ยินดีต้อนรับคุณ ${foundUser.name}`, "success");
          } else {
              setLoginError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
              showToast("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", "error");
          }
          setIsLoading(false);
      }, 1000);
  };

  const handleLogout = () => {
      setIsLoggedIn(false);
      setUserProfile(null);
      setActiveTab('Overview');
      localStorage.removeItem('nexus_auth');
      localStorage.removeItem('nexus_profile');
      showToast("ออกจากระบบแล้ว");
  };

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

  const closeToast = () => {
    setToast({ ...toast, show: false });
  };

  const getPageTitle = (tabName) => {
    const tab = navItems.find(t => t.name === tabName);
    return tab ? tab.label : 'ProjectPlan';
  };

  const totalExpenses = expenses.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
  const profit = (parseFloat(wage) || 0) - totalExpenses;
  const totalSupport = customerSupportItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);

  const getDealStatusInfo = (value) => {
    return dealStatuses.find(s => s.value === value) || { label: value, color: 'bg-slate-100 text-slate-500' };
  };

  const getTransportStatusInfo = (value) => {
    return transportStatuses.find(s => s.value === value) || { label: value, color: 'bg-slate-100 text-slate-500' };
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    tabScrollPositions.current[activeTab] = scrollTop;
    setIsScrolled(scrollTop > 0);

    if (activeTab === 'Plans' || activeTab === 'Analytics') {
      if (scrollTop + clientHeight >= scrollHeight - 100) {
        if (visibleCount < filteredAndSortedActivities.length && !isLoadingMore) {
           setIsLoadingMore(true);
           setTimeout(() => {
              setVisibleCount(prev => prev + 15);
              setIsLoadingMore(false);
           }, 1000);
        }
      }
    }
  };

  // --- Image Handling Logic ---
  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1024; // Resize if width > 1024
          const scaleSize = MAX_WIDTH / img.width;
          
          if (scaleSize < 1) {
              canvas.width = MAX_WIDTH;
              canvas.height = img.height * scaleSize;
          } else {
              canvas.width = img.width;
              canvas.height = img.height;
          }
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Compress quality to 0.7
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataUrl);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const toBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });

  const handleImageUpload = async (file) => {
      setIsSaving(true);
      try {
          if (!file.type.startsWith('image/')) {
              throw new Error('กรุณาอัพโหลดไฟล์รูปภาพเท่านั้น');
          }
          
          let processedFile = file;
          // Check size > 5MB (5 * 1024 * 1024)
          if (file.size > 5 * 1024 * 1024) {
               showToast("กำลังลดขนาดไฟล์รูปภาพ...", "success");
               processedFile = await compressImage(file);
          } else {
               processedFile = await toBase64(file);
          }
          
          setUploadedImage(processedFile);
          showToast("อัพโหลดรูปภาพพร้อมบันทึก", "success");
      } catch (error) {
          console.error(error);
          showToast(error.message || "เกิดข้อผิดพลาดในการอัพโหลดรูปภาพ", "error");
      } finally {
          setIsSaving(false);
      }
  };

  const onDrop = (e) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleImageUpload(file);
  };

  const onDragOverImg = (e) => {
      e.preventDefault();
  };


  useEffect(() => {
    if (isAddModalOpen && viewOnlyMode && part3Ref.current) {
      setTimeout(() => {
        part3Ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [isAddModalOpen, viewOnlyMode]);

  useLayoutEffect(() => {
    if (mainRef.current) {
      const savedPosition = tabScrollPositions.current[activeTab] || 0;
      mainRef.current.scrollTop = savedPosition;
      setIsScrolled(savedPosition > 0);
    }
  }, [activeTab]);

  const filteredAndSortedActivities = useMemo(() => {
    let items = allActivities.filter(item => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        (item.name || '').toLowerCase().includes(searchLower) ||
        (item.id || '').toLowerCase().includes(searchLower) ||
        (item.artist || '').toLowerCase().includes(searchLower) ||
        (item.customer || '').toLowerCase().includes(searchLower) ||
        (item.note && item.note.toLowerCase().includes(searchLower));

      let matchesDate = true;
      if (item.rawDateTime) {
          const itemDateStr = item.rawDateTime.split('T')[0];
          if (dateFilterMode === 'date' && filterDate) {
              matchesDate = itemDateStr === filterDate;
          } else if (dateFilterMode === 'month' && filterDate) {
              matchesDate = item.rawDateTime.startsWith(filterDate); 
          } else if (dateFilterMode === 'year' && filterDate) {
              matchesDate = item.rawDateTime.startsWith(filterDate);
          } else if (dateFilterMode === 'range' && filterDateRange.start && filterDateRange.end) {
              matchesDate = itemDateStr >= filterDateRange.start && itemDateStr <= filterDateRange.end;
          } else if (dateFilterMode === 'week' && filterDate) {
              const itemDate = new Date(itemDateStr);
              const weekStart = new Date(filterDate);
              const weekEnd = new Date(weekStart);
              weekEnd.setDate(weekStart.getDate() + 6);
              weekStart.setHours(0,0,0,0);
              weekEnd.setHours(23,59,59,999);
              itemDate.setHours(12,0,0,0); 
              matchesDate = itemDate >= weekStart && itemDate <= weekEnd;
          }
      }

      const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
      const matchesStatus = filterStatus === 'all' || item.dealStatus === filterStatus;
      const matchesTransport = filterTransport === 'all' || item.transportStatus === filterTransport;

      return matchesSearch && matchesDate && matchesCategory && matchesStatus && matchesTransport;
    });

    if (sortConfig.key !== null) {
      items.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];
        
        if (!aValue) aValue = '';
        if (!bValue) bValue = '';

        if (typeof aValue === 'string' && typeof bValue === 'string') {
              return sortConfig.direction === 'asc'
                ? aValue.localeCompare(bValue, 'th', { numeric: true })
                : bValue.localeCompare(aValue, 'th', { numeric: true });
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return items;
  }, [allActivities, sortConfig, searchTerm, filterDate, filterDateRange, dateFilterMode, filterCategory, filterStatus, filterTransport]);

  const sortedActivitiesForOverview = useMemo(() => {
    let items = [...allActivities];
    if (sortConfig.key !== null) {
      items.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];
        if (!aValue) aValue = '';
        if (!bValue) bValue = '';
        if (typeof aValue === 'string' && typeof bValue === 'string') {
              return sortConfig.direction === 'asc'
                ? aValue.localeCompare(bValue, 'th', { numeric: true })
                : bValue.localeCompare(aValue, 'th', { numeric: true });
        }
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return items;
  }, [allActivities, sortConfig]);

  // ... (getDealType, getTransportType, stats, resetFilters, closeModal, closeDeleteModal, handlers remain same) ...
  const getDealType = (val) => dealStatuses.find(s => s.value === val)?.type || 'pending';
  const getTransportType = (val) => transportStatuses.find(s => s.value === val)?.type || 'pending';

  const stats = useMemo(() => {
    const total = allActivities.length;
    
    const completed = allActivities.filter(a => {
        const dType = getDealType(a.dealStatus);
        const tType = getTransportType(a.transportStatus);
        return tType === 'completed' && (dType === 'active' || dType === 'completed');
    }).length;

    const active = allActivities.filter(a => {
        const dType = getDealType(a.dealStatus);
        const tType = getTransportType(a.transportStatus);
        return dType === 'active' && tType !== 'completed' && tType !== 'cancelled';
    }).length;

    const pending = allActivities.filter(a => {
        const dType = getDealType(a.dealStatus);
        return dType === 'pending';
    }).length;

    const issues = allActivities.filter(a => {
        const dType = getDealType(a.dealStatus);
        const tType = getTransportType(a.transportStatus);
        return dType === 'cancelled' || tType === 'cancelled';
    }).length;

    return [
      { title: 'โครงการทั้งหมด', value: total, change: 'รวมทั้งหมด', isPositive: true, icon: Folder, color: 'text-indigo-600', bg: 'bg-indigo-50' },
      { title: 'งานเสร็จสิ้น', value: completed, change: 'ปิดจ๊อบแล้ว', isPositive: true, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
      { title: 'กำลังดำเนินการ', value: active, change: 'Active Now', isPositive: true, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
      { title: 'ยกเลิก/มีปัญหา', value: issues, change: 'ต้องตรวจสอบ', isPositive: false, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' },
    ];
  }, [allActivities, dealStatuses, transportStatuses]);

  const resetFilters = () => {
    setSearchTerm('');
    setDateFilterMode('all');
    setFilterDate('');
    setFilterDateRange({ start: '', end: '' });
    setFilterCategory('all');
    setFilterStatus('all');
    setFilterTransport('all');
  };

  const closeModal = () => {
    setIsModalClosing(true);
    setTimeout(() => {
      setIsAddModalOpen(false);
      setIsModalClosing(false);
    }, 300); // 300ms matches animation duration
  };

  const closeDeleteModal = () => {
    setIsDeleteClosing(true);
    setTimeout(() => {
      setDeleteConfirm({ ...deleteConfirm, show: false });
      setIsDeleteClosing(false);
    }, 300);
  };

  const handleCustomerChange = (e) => {
    const value = e.target.value;
    setCustomerName(value);
    const existingCustomer = savedCustomers.find(c => c.name === value);
    if (existingCustomer) {
      setCustomerSocial(existingCustomer.social || '');
      setCustomerLine(existingCustomer.line || '');
      setCustomerPhone(existingCustomer.phone || '');
      setCustomerEmail(existingCustomer.email || '');
    }
  };

  const handleRecipientChange = (e) => {
    const value = e.target.value;
    setRecipientName(value);
    const existingRecipient = savedRecipients.find(r => r.name === value);
    if (existingRecipient) {
      setRecipientPhone(existingRecipient.phone || '');
    }
  };

  const openModal = (activity = null, viewOnly = false) => {
    setViewOnlyMode(viewOnly);

    if (activity) {
      setEditingId(activity.id);
      setCurrentId(activity.id);
      setProjectName(activity.name);
      setProjectCategory(activity.category);
      setProjectDateTime(activity.rawDateTime || '');
      setArtistName(activity.artist);
      setCustomerName(activity.customer);
      if (activity.customerInfo) {
        setCustomerSocial(activity.customerInfo.social || '');
        setCustomerLine(activity.customerInfo.line || '');
        setCustomerPhone(activity.customerInfo.phone || '');
        setCustomerEmail(activity.customerInfo.email || '');
      } else {
        setCustomerSocial('');
        setCustomerLine('');
        setCustomerPhone('');
        setCustomerEmail('');
      }
      setDeliveryStart(activity.rawDeliveryStart || '');
      setDeliveryEnd(activity.rawDeliveryEnd || activity.rawDeliveryDateTime || '');

      setRecipientName(activity.recipient || '');
      setRecipientPhone(activity.recipientPhone || '');
      setLocationName(activity.location || '');
      setMapLink(activity.mapLink || '');
      setUploadedImage(activity.image || null); // Load existing image
      setWage(activity.wage);
      setExpenses(activity.expenses && activity.expenses.length > 0 ? activity.expenses : [{ category: '', detail: '', price: 0 }]);
      setCustomerSupportItems(activity.customerSupport && activity.customerSupport.length > 0 ? activity.customerSupport : [{ detail: '', price: 0 }]);
      setNote(activity.note || '');
      setDealStatus(activity.dealStatus);
      setTransportStatus(activity.transportStatus);
    } else {
      setEditingId(null);
      let nextIdNumber = 1; // เริ่มต้นที่ 1
      if (allActivities.length > 0) {
        const ids = allActivities.map(item => {
          const match = item.id.match(/\d+/); 
          return match ? parseInt(match[0]) : 0;
        });
        const maxId = Math.max(...ids);
        if (maxId > 0) nextIdNumber = maxId + 1;
      }
      setCurrentId(`P-${String(nextIdNumber).padStart(4, '0')}`);
      setProjectName('');
      setProjectCategory(projectCategories[0] || '');
      const now = new Date();
      const localIsoString = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
      setProjectDateTime(localIsoString);
      setDeliveryStart('');
      setDeliveryEnd('');
      setArtistName('');
      setCustomerName('');
      setCustomerSocial('');
      setCustomerLine('');
      setCustomerPhone('');
      setCustomerEmail('');
      setRecipientName('');
      setRecipientPhone('');
      setLocationName('');
      setMapLink('');
      setUploadedImage(null);
      setNote('');
      setWage(0);
      setExpenses([{ category: '', detail: '', price: 0 }]);
      setCustomerSupportItems([{ detail: '', price: 0 }]);
      setDealStatus(dealStatuses.length > 0 ? dealStatuses[0].value : ''); 
      setTransportStatus(transportStatuses.length > 0 ? transportStatuses[0].value : '');
    }
    setIsAddModalOpen(true);
  };

  const handleSaveProject = async () => {
    setIsSaving(true); 
    
    if (customerName) {
      const newCustomerData = {
        name: customerName,
        social: customerSocial,
        line: customerLine,
        phone: customerPhone,
        email: customerEmail
      };
      const existingCustomerIndex = savedCustomers.findIndex(c => c.name === customerName);
      if (existingCustomerIndex === -1) {
        setSavedCustomers([...savedCustomers, newCustomerData]);
      }
    }

    const displayDate = formatDate(projectDateTime);
    const displayDeliveryDate = deliveryStart && deliveryEnd
        ? `${formatDate(deliveryStart)} - ${formatDate(deliveryEnd)}`
        : deliveryEnd ? formatDate(deliveryEnd) : '-';

    const activityData = {
      id: currentId,
      name: projectName || 'โครงการใหม่ (ไม่ได้ระบุชื่อ)',
      category: projectCategory,
      artist: artistName || '-',
      customer: customerName || '-',
      customerInfo: {
        social: customerSocial,
        line: customerLine,
        phone: customerPhone,
        email: customerEmail
      },
      date: displayDate,
      rawDateTime: projectDateTime,
      deliveryDate: displayDeliveryDate,
      rawDeliveryStart: deliveryStart,
      rawDeliveryEnd: deliveryEnd,
      rawDeliveryDateTime: deliveryEnd, 
      wage: parseFloat(wage) || 0,
      dealStatus: dealStatus,
      transportStatus: transportStatus,
      expenses: expenses,
      customerSupport: customerSupportItems,
      note: note,
      recipient: recipientName,
      recipientPhone: recipientPhone,
      location: locationName,
      mapLink: mapLink,
      image: uploadedImage // Add image data
    };

    if (GOOGLE_SCRIPT_URL) {
      try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          body: JSON.stringify({ action: 'save', data: activityData })
        });
        const result = await response.json();
        if (result.status === 'success') {
          setAllActivities(prev => {
             const exists = prev.some(item => item.id === activityData.id);
             if (exists) {
                 return prev.map(item => item.id === activityData.id ? activityData : item);
             } else {
                 return [activityData, ...prev];
             }
          });

          setIsSaving(false);
          closeModal();
          showToast("บันทึกข้อมูลสำเร็จเรียบร้อย", 'success');
          fetchProjects(); 
          return;
        } else {
          // --- ส่วนที่ปรับปรุง: ตรวจสอบและแปล Error เรื่องสิทธิ์ Google Script ---
          let displayMsg = result.message;
          if (displayMsg && (displayMsg.includes("DriveApp") || displayMsg.includes("permission") || displayMsg.includes("อนุญาต"))) {
             displayMsg = "สิทธิ์ Google Drive ไม่ถูกต้อง: กรุณาเปิด Apps Script > กด Run ฟังก์ชันเพื่อขอสิทธิ์ (Authorize) > และ Deploy ใหม่อีกครั้ง";
          }
          // -----------------------------------------------------------------
          showToast("ไม่สามารถบันทึกข้อมูลได้: " + displayMsg, 'error');
        }
      } catch (error) {
        showToast("เกิดข้อผิดพลาดในการเชื่อมต่อ: " + error.message, 'error');
      }
    } else {
      if (editingId) {
        setAllActivities(allActivities.map(item => item.id === editingId ? activityData : item));
      } else {
        setAllActivities([activityData, ...allActivities]);
      }
      closeModal();
      showToast("บันทึกข้อมูลสำเร็จ (โหมดออฟไลน์)", 'success');
    }
    setIsSaving(false);
  };
  
  const handleDeleteProject = () => {
    if (editingId) {
      setDeleteConfirm({ show: true, id: editingId, fromModal: true });
    }
  };

  const handleDeleteFromTable = (e, id) => {
    e.stopPropagation();
    setDeleteConfirm({ show: true, id, fromModal: false });
  };

  const executeDelete = async () => {
    if (deleteConfirm.id) {
      setIsSaving(true);

      // ค้นหารายการที่จะลบ เพื่อเอาข้อมูลรูปภาพส่งไปให้ Backend ลบไฟล์
      const itemToDelete = allActivities.find(item => item.id === deleteConfirm.id);
      const imageInfo = itemToDelete ? itemToDelete.image : null;

      if (GOOGLE_SCRIPT_URL) {
         try {
           const response = await fetch(GOOGLE_SCRIPT_URL, {
             method: 'POST',
             body: JSON.stringify({ 
                action: 'delete', 
                id: deleteConfirm.id,
                image: imageInfo // ส่งข้อมูลรูปภาพไปด้วยเพื่อให้ Backend ลบไฟล์บน Drive
             })
           });
           const result = await response.json();
           if (result.status === 'success') {
             await fetchProjects();
             showToast("ลบข้อมูลเรียบร้อยแล้ว", 'success');
           } else {
             showToast("เกิดข้อผิดพลาดในการลบ: " + result.message, 'error');
           }
         } catch(error) {
            showToast("เกิดข้อผิดพลาดในการเชื่อมต่อ: " + error.message, 'error');
         }
      } else {
        setAllActivities(allActivities.filter(item => item.id !== deleteConfirm.id));
        showToast("ลบข้อมูลเรียบร้อยแล้ว (โหมดออฟไลน์)", 'success');
      }
      
      closeDeleteModal();
      if (deleteConfirm.fromModal) {
        closeModal();
      }
      setIsSaving(false);
    }
  };

  const handleEditFromTable = (e, item) => {
    e.stopPropagation();
    openModal(item, false);
  };

  const handleAddExpense = () => {
    setExpenses([...expenses, { category: '', detail: '', price: 0 }]);
  };

  const handleRemoveExpense = (index) => {
    const newExpenses = expenses.filter((_, i) => i !== index);
    setExpenses(newExpenses);
  };

  const handleExpenseChange = (index, field, value) => {
    const newExpenses = [...expenses];
    newExpenses[index][field] = value;
    setExpenses(newExpenses);
  };

  const handleAddSupportItem = () => {
    setCustomerSupportItems([...customerSupportItems, { detail: '', price: 0 }]);
  };

  const handleRemoveSupportItem = (index) => {
    const newItems = customerSupportItems.filter((_, i) => i !== index);
    setCustomerSupportItems(newItems);
  };

  const handleSupportItemChange = (index, field, value) => {
    const newItems = [...customerSupportItems];
    newItems[index][field] = value;
    setCustomerSupportItems(newItems);
  };

  // ... (DonutChart, renderTable, renderFilterCard remain same) ...
  const DonutChart = ({ data }) => {
    const total = data.reduce((sum, item) => sum + item.count, 0);
    const radius = 35;
    const circumference = 2 * Math.PI * radius;
    let cumulativePercent = 0;
    
    const [isLoaded, setIsLoaded] = useState(false);
    
    useEffect(() => {
        const timer = setTimeout(() => setIsLoaded(true), 100);
        return () => clearTimeout(timer);
    }, []);

    const colors = [
        '#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#3b82f6', '#ec4899', '#64748b'
    ];

    const sortedData = [...data].sort((a, b) => b.count - a.count);

    return (
       <div className="flex flex-col items-center gap-6 py-2 w-full">
         <div className="relative w-56 h-56 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full absolute inset-0 -rotate-90">
               <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#f1f5f9" strokeWidth="10" />
               {sortedData.map((item, i) => {
                  const percent = total > 0 ? item.count / total : 0;
                  const strokeLength = circumference * percent;
                  const strokeDasharray = `${strokeLength} ${circumference}`;
                  const strokeDashoffset = -1 * circumference * cumulativePercent;
                  cumulativePercent += percent;

                  return (
                    <circle
                      key={i}
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="transparent"
                      stroke={colors[i % colors.length]}
                      strokeWidth="10"
                      strokeDasharray={isLoaded ? strokeDasharray : `0 ${circumference}`}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="butt"
                      className="transition-all duration-1000 ease-out"
                      style={{ transitionDelay: `${i * 50}ms` }}
                    />
                  );
               })}
            </svg>
            <div className={`flex flex-col items-center justify-center transition-all duration-700 delay-300 ${isLoaded ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
                 <span className="text-4xl font-black text-slate-800 leading-none">{total}</span>
                 <span className="text-sm font-bold text-slate-400 mt-1">โครงการ</span>
            </div>
         </div>
         <div className="grid grid-cols-2 gap-x-6 gap-y-3 w-full px-2">
            {sortedData.map((item, i) => (
              <div key={i} className="flex items-center justify-between group hover:bg-slate-50 p-1.5 rounded-lg transition-colors">
                 <div className="flex items-center gap-2.5 min-w-0">
                   <div className={`w-3 h-3 rounded-full shrink-0 transition-transform group-hover:scale-125 shadow-sm`} style={{ backgroundColor: colors[i % colors.length] }}></div>
                   <span className="text-xs font-bold text-slate-600 truncate">{item.name}</span>
                 </div>
                 <span className="text-xs font-black text-slate-800 bg-white border border-slate-100 px-2 py-0.5 rounded-md shadow-sm">{item.count}</span>
              </div>
            ))}
            {sortedData.length === 0 && (
                <div className="col-span-2 text-center text-slate-400 text-xs py-2 italic">ไม่มีข้อมูลโครงการ</div>
            )}
         </div>
       </div>
    );
  };
  
  const renderTable = (limit = 0, customData = null) => {
    const sourceData = limit > 0 ? (customData || sortedActivitiesForOverview) : (customData || filteredAndSortedActivities);
    const displayLimit = limit > 0 ? limit : visibleCount;
    const items = sourceData.slice(0, displayLimit);

    return (
      <div className="w-full">
        <div className="md:hidden flex flex-col gap-4 p-2">
          {items.map((item, i) => {
            const itemExpenses = item.expenses ? item.expenses.reduce((sum, ex) => sum + (parseFloat(ex.price) || 0), 0) : 0;
            const itemProfit = (item.wage || 0) - itemExpenses;
            const itemSupport = item.customerSupport ? item.customerSupport.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0) : 0;
            const itemReceivable = (item.wage || 0) + itemSupport;

            const dealStatusInfo = getDealStatusInfo(item.dealStatus);
            const transportStatusInfo = getTransportStatusInfo(item.transportStatus);
            const animDelay = (i % 20) * 80;

            return (
              <div 
                key={item.id} 
                onClick={() => openModal(item, true)}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4 relative overflow-hidden space-row-animation"
                style={{ animationDelay: `${animDelay}ms` }}
              >
                <div className="flex justify-between items-start">
                   <div className="flex flex-col gap-2">
                      <span className="font-black text-indigo-600 bg-indigo-50 px-2.5 py-1.5 rounded-lg text-sm w-fit shadow-sm border border-indigo-100">{item.id}</span>
                      <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold whitespace-nowrap">
                        <Clock className="w-3.5 h-3.5" /> {item.date}
                      </div>
                   </div>
                   <div className="flex flex-col gap-1.5 items-end">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold border ${dealStatusInfo.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${dealStatusInfo.value === 'confirmed' ? 'bg-emerald-500' : dealStatusInfo.value === 'pending' ? 'bg-amber-500' : dealStatusInfo.value === 'declined' ? 'bg-gray-400' : 'bg-rose-500'}`}></span>
                          {dealStatusInfo.label}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold border ${transportStatusInfo.color}`}>
                          <Truck className="w-3 h-3" />
                          {transportStatusInfo.label}
                        </span>
                   </div>
                </div>
                <div className="h-px bg-slate-100 w-full" />
                <div className="flex flex-col gap-1 mb-2">
                    <h3 className="text-xl font-black text-slate-800 leading-tight">{item.name}</h3>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-xs font-bold border border-slate-200 w-fit flex items-center gap-1">
                        <Tag className="w-3 h-3" /> {item.category}
                    </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5 text-slate-700 text-sm font-bold">
                                <User className="w-4 h-4 text-indigo-500" /> {item.artist}
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-500 text-xs pl-5">
                                <Briefcase className="w-3 h-3" /> {item.customer}
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-0.5">
                            <div className="flex items-start gap-1.5 text-slate-700 text-sm font-bold">
                                <Clock className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" /> 
                                <div className="whitespace-nowrap">{renderDeliveryTime(item)}</div>
                            </div>
                            <div className="flex items-start gap-1.5 text-slate-500 text-xs pl-0.5">
                                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" /> 
                                {item.mapLink ? (
                                    <a 
                                        href={item.mapLink} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="text-blue-600 hover:underline line-clamp-2 leading-tight"
                                    >
                                        {item.location || '-'}
                                    </a>
                                ) : (
                                    <span className="line-clamp-2 leading-tight">{item.location || '-'}</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                {(item.recipient || item.recipientPhone) && (
                    <div className="flex justify-between items-start gap-3 text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="flex flex-col min-w-0">
                           <div className="flex gap-1">
                               <span className="font-bold text-slate-700 shrink-0">ผู้รับ:</span>
                               <span className="font-medium line-clamp-2 leading-snug break-words">
                                   {item.recipient || '-'}
                               </span>
                           </div>
                        </div>
                        {item.recipientPhone && (
                            <a 
                                href={`tel:${item.recipientPhone}`} 
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1.5 text-indigo-600 bg-white px-2.5 py-1.5 rounded-lg border border-indigo-100 shadow-sm hover:bg-indigo-50 transition-colors whitespace-nowrap shrink-0 ml-1"
                            >
                                <Phone className="w-3.5 h-3.5" />
                                <span className="font-bold text-xs">{item.recipientPhone}</span>
                            </a>
                        )}
                    </div>
                )}
                <div className="bg-slate-50 rounded-xl p-3">
                   <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-200">
                      <span className="text-xs text-slate-700 font-bold flex items-center gap-1">
                        <Wallet className="w-3 h-3" /> ยอดเรียกเก็บ
                      </span>
                      <span className="text-sm text-indigo-700 font-black">฿{itemReceivable.toLocaleString()}</span>
                   </div>
                   <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-slate-500">ค่าจ้าง</span>
                      <span className="text-xs text-emerald-600 font-bold flex items-center gap-1"><ArrowUpRight className="w-3 h-3" /> {item.wage.toLocaleString()}</span>
                   </div>
                   {itemSupport > 0 && (
                       <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-slate-500">ลูกค้าสนับสนุน</span>
                          <span className="text-xs text-blue-600 font-bold flex items-center gap-1">+ {itemSupport.toLocaleString()}</span>
                       </div>
                   )}
                   <div className="flex justify-between items-center mb-2 border-b border-slate-200 pb-2">
                      <span className="text-xs text-slate-500">รายจ่าย</span>
                      <span className="text-xs text-rose-500 font-bold flex items-center gap-1"><TrendingDown className="w-3 h-3" /> {itemExpenses.toLocaleString()}</span>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-700">กำไรสุทธิ</span>
                      <span className={`text-sm font-bold ${itemProfit >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                        {itemProfit >= 0 ? '+' : ''}{itemProfit.toLocaleString()}
                      </span>
                   </div>
                </div>
                {item.note && (
                  <div className="text-xs text-slate-500 bg-yellow-50/50 p-2 rounded-lg border border-yellow-100">
                    <span className="font-bold text-yellow-600 mr-1">หมายเหตุ:</span> {item.note}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 mt-2">
                    <button 
                        onClick={(e) => handleEditFromTable(e, item)} 
                        className="flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition-colors shadow-sm"
                    >
                        <Edit className="w-4 h-4" /> แก้ไข
                    </button>
                    <button 
                        onClick={(e) => handleDeleteFromTable(e, item.id)} 
                        className="flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 text-rose-500 hover:bg-rose-50 rounded-lg transition shadow-sm"
                        title="ลบรายการ"
                    >
                        <Trash2 className="w-4 h-4" /> ลบ
                    </button>
                </div>
              </div>
            );
          })}
          {limit === 0 && isLoadingMore && (
             <div className="flex flex-col items-center justify-center py-8 gap-3 opacity-100 transition-opacity duration-300">
                 <div className="p-3 bg-white rounded-full shadow-md border border-slate-100 animate-bounce">
                    <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                 </div>
                 <span className="text-xs text-slate-500 font-bold animate-pulse">กำลังโหลดข้อมูลเพิ่มเติม...</span>
             </div>
          )}
        </div>

        <div className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-slate-400 text-sm font-semibold border-b border-slate-50">
                    <SortableHeader label="รหัส / วันที่บันทึก" sortKey="id" sortConfig={sortConfig} handleSort={handleSort} />
                    <SortableHeader label="โครงการ / หมวดหมู่" sortKey="name" sortConfig={sortConfig} handleSort={handleSort} />
                    <SortableHeader label="ศิลปิน / ลูกค้า" sortKey="artist" sortConfig={sortConfig} handleSort={handleSort} />
                    <SortableHeader label="ผู้รับ / เบอร์โทร" sortKey="recipient" sortConfig={sortConfig} handleSort={handleSort} />
                    <SortableHeader label="กำหนดส่ง / สถานที่" sortKey="rawDeliveryDateTime" sortConfig={sortConfig} handleSort={handleSort} />
                    <SortableHeader label="สถานะ (ดีล / ขนส่ง)" sortKey="dealStatus" sortConfig={sortConfig} handleSort={handleSort} />
                    <SortableHeader label="การเงิน (บาท)" sortKey="wage" alignRight sortConfig={sortConfig} handleSort={handleSort} />
                    <SortableHeader label="หมายเหตุ" sortKey="note" sortConfig={sortConfig} handleSort={handleSort} />
                    <th className="px-6 py-4 font-medium text-right whitespace-nowrap">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {items.map((item, i) => {
                    const itemExpenses = item.expenses ? item.expenses.reduce((sum, ex) => sum + (parseFloat(ex.price) || 0), 0) : 0;
                    const itemProfit = (item.wage || 0) - itemExpenses;
                    const itemSupport = item.customerSupport ? item.customerSupport.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0) : 0;
                    const itemReceivable = (item.wage || 0) + itemSupport;

                    const dealStatusInfo = getDealStatusInfo(item.dealStatus);
                    const transportStatusInfo = getTransportStatusInfo(item.transportStatus);
                    const animDelay = (i % 20) * 50; 

                    return (
                      <tr
                        key={item.id}
                        onClick={() => openModal(item, true)}
                        className="hover:bg-slate-50/80 transition-colors group cursor-pointer space-row-animation"
                        style={{ animationDelay: `${animDelay}ms` }}
                      >
                         <td className="px-6 py-4 align-top">
                          <div className="flex flex-col gap-1">
                            <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg text-xs w-fit">{item.id}</span>
                            <div className="flex items-center gap-1.5 text-slate-500 text-xs mt-1">
                              <Clock className="w-3 h-3" />
                              {item.date}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="flex flex-col gap-1 min-w-[140px]">
                            <span className="font-bold text-slate-800 text-sm">{item.name}</span>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                              <Tag className="w-3 h-3" />
                              {item.category}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="flex flex-col gap-1.5 min-w-[140px]">
                            <div className="flex items-center gap-2">
                              <User className="w-3 h-3 text-indigo-500" />
                              <span className="text-sm font-semibold text-slate-700">{item.artist}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <Briefcase className="w-3 h-3" />
                              {item.customer}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="flex flex-col gap-1 min-w-[140px]">
                            <div className="text-sm font-medium text-slate-700">{item.recipient || '-'}</div>
                            {item.recipientPhone && (
                              <a 
                                href={`tel:${item.recipientPhone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 hover:underline transition-colors w-fit"
                              >
                                <Phone className="w-3 h-3" />
                                {item.recipientPhone}
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="flex flex-col gap-1 min-w-[160px]">
                            <div className="flex items-center gap-1.5 text-slate-700 text-sm font-medium">
                              <Clock className="w-3 h-3 text-indigo-500" />
                              <div>{renderDeliveryTime(item)}</div>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                              <MapPin className="w-3 h-3 shrink-0" />
                              {item.mapLink ? (
                                <a 
                                  href={item.mapLink} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  onClick={(e) => e.stopPropagation()} 
                                  className="text-blue-600 hover:underline truncate max-w-[140px]"
                                  title="เปิดแผนที่"
                                >
                                  {item.location || '-'}
                                </a>
                              ) : (
                                <span className="truncate max-w-[140px]">{item.location || '-'}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          <div className="flex flex-col gap-2 items-start">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border ${dealStatusInfo.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${dealStatusInfo.value === 'confirmed' ? 'bg-emerald-500' : dealStatusInfo.value === 'pending' ? 'bg-amber-500' : dealStatusInfo.value === 'declined' ? 'bg-gray-400' : 'bg-rose-500'}`}></span>
                              {dealStatusInfo.label}
                            </span>
                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border ${transportStatusInfo.color}`}>
                              <Truck className="w-3 h-3" />
                              {transportStatusInfo.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top text-right">
                            <div className="flex flex-col gap-1 items-end min-w-[120px]">
                              <span className="text-sm font-black text-slate-800" title="ยอดเรียกเก็บสุทธิ">
                                 ฿{itemReceivable.toLocaleString()}
                              </span>
                              <div className="text-xs text-slate-400 flex gap-1 items-center justify-end">
                                  <span className="text-emerald-600" title="ค่าจ้าง">{item.wage.toLocaleString()}</span>
                                  {itemSupport > 0 && <span className="text-blue-500" title="สนับสนุน">+{itemSupport.toLocaleString()}</span>}
                              </div>
                              <span className="text-xs text-rose-500 font-medium flex items-center gap-1" title="รายจ่าย">
                                <TrendingDown className="w-3 h-3" /> -{itemExpenses.toLocaleString()}
                              </span>
                              <span className={`text-xs font-bold ${itemProfit >= 0 ? 'text-indigo-600' : 'text-rose-600'} border-t border-slate-100 pt-1 mt-1 w-full text-right`} title="กำไรสุทธิ">
                                {itemProfit >= 0 ? '+' : ''}{itemProfit.toLocaleString()}
                              </span>
                            </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                            <div className="text-sm text-slate-600 max-w-[120px] whitespace-normal break-words" title={item.note}>
                              {item.note || '-'}
                            </div>
                        </td>
                        <td className="px-6 py-4 align-top text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={(e) => handleEditFromTable(e, item)}
                              className="p-2 bg-white border border-slate-200 text-indigo-600 hover:bg-indigo-50 rounded-lg transition shadow-sm"
                              title="แก้ไข"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteFromTable(e, item.id)}
                              className="p-2 bg-white border border-slate-200 text-rose-500 hover:bg-rose-50 rounded-lg transition shadow-sm"
                              title="ลบรายการ"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {limit === 0 && isLoadingMore && (
               <div className="w-full py-8 text-center border-t border-slate-50 bg-slate-50/30 animate-in fade-in slide-in-from-bottom-2">
                   <div className="flex flex-col items-center justify-center gap-3">
                      <div className="p-2 bg-white rounded-full shadow-sm border border-slate-200">
                          <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                      </div>
                      <span className="text-xs text-slate-500 font-bold animate-pulse">กำลังโหลดข้อมูลเพิ่มเติม...</span>
                   </div>
               </div>
            )}
        </div>
      </div>
    );
  };
  
  const renderFilterCard = () => (
    <div
      className={`sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-slate-200 transition-all duration-300 ease-in-out
        ${isScrolled
          ? 'mx-0 mt-0 py-3 px-4 sm:px-8 lg:px-10 border-b shadow-sm rounded-b-[2rem] rounded-t-none mb-6'
          : 'mx-4 sm:mx-8 lg:mx-10 mt-4 p-4 rounded-[2rem] border shadow-sm mb-6 translate-y-0'
        }
      `}
    >
      <div className={`flex items-center gap-2 mb-4 text-indigo-600 font-bold transition-all ${isScrolled ? 'scale-90 origin-left opacity-80 translate-y-1' : ''} hidden md:flex`}>
      </div>
      
      <div className="flex flex-col gap-3 md:hidden">
         <div className="flex gap-2">
            <div className="relative flex-1 bg-white border border-slate-200 rounded-xl shadow-sm">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Search className="w-4 h-4" />
                </div>
                <input
                    type="text"
                    placeholder="ค้นหา..."
                    className="w-full h-10 pl-9 pr-4 bg-transparent outline-none text-slate-700 text-sm font-medium placeholder:text-slate-400 rounded-xl"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <button
              onClick={() => setIsMobileFilterExpanded(!isMobileFilterExpanded)}
              className={`px-3 rounded-xl font-bold transition-colors flex items-center justify-center shadow-sm ${isMobileFilterExpanded ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            <button
              onClick={resetFilters}
              className="px-3 bg-slate-100 text-slate-500 rounded-xl font-bold hover:bg-rose-50 hover:text-rose-600 transition-colors flex items-center justify-center shadow-sm"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
         </div>

         {isMobileFilterExpanded && (
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar animate-in slide-in-from-top-2 fade-in duration-200 items-center">
                <div className="shrink-0 w-[240px]">
                    <DateFilterControl 
                        mode={dateFilterMode} setMode={setDateFilterMode}
                        date={filterDate} setDate={setFilterDate}
                        range={filterDateRange} setRange={setFilterDateRange}
                    />
                </div>
                {/* ... Filters Mobile ... */}
                <div className="relative min-w-[140px] bg-white border border-slate-200 rounded-xl shadow-sm shrink-0 h-10">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Tag className="w-3.5 h-3.5" /></div>
                  <select
                      className="w-full h-full pl-8 pr-6 bg-transparent outline-none text-slate-700 text-xs font-bold appearance-none"
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                  >
                      <option value="all">ทุกหมวดหมู่</option>
                      {projectCategories.map((cat, i) => (
                        <option key={i} value={cat}>{cat}</option>
                      ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                <div className="relative min-w-[140px] bg-white border border-slate-200 rounded-xl shadow-sm shrink-0 h-10">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Briefcase className="w-3.5 h-3.5" /></div>
                  <select
                      className="w-full h-full pl-8 pr-6 bg-transparent outline-none text-slate-700 text-xs font-bold appearance-none"
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                  >
                      <option value="all">ทุกสถานะ (ดีล)</option>
                      {dealStatuses.map((status, i) => (
                        <option key={i} value={status.value}>{status.label}</option>
                      ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                <div className="relative min-w-[140px] bg-white border border-slate-200 rounded-xl shadow-sm shrink-0 h-10">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Truck className="w-3.5 h-3.5" /></div>
                  <select
                      className="w-full h-full pl-8 pr-6 bg-transparent outline-none text-slate-700 text-xs font-bold appearance-none"
                      value={filterTransport}
                      onChange={(e) => setFilterTransport(e.target.value)}
                  >
                      <option value="all">ขนส่ง (ทั้งหมด)</option>
                      {transportStatuses.map((status, i) => (
                        <option key={i} value={status.value}>{status.label}</option>
                      ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
            </div>
         )}
      </div>
      
      <div className="hidden md:flex flex-col gap-3">
          <div className="flex gap-3 h-[48px]">
              <div className="relative flex-[2] bg-white border border-slate-200 rounded-2xl hover:border-indigo-300 transition-colors shadow-sm">
                   <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                        <Search className="w-5 h-5" />
                   </div>
                   <input
                        type="text"
                        placeholder="ค้นหาชื่อโครงการ, ศิลปิน, รหัส..."
                        className="w-full h-full pl-12 pr-4 bg-transparent outline-none text-slate-700 text-sm font-medium placeholder:text-slate-400 rounded-2xl"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                   />
              </div>

              <div className="flex-1 min-w-[300px]">
                   <DateFilterControl 
                        mode={dateFilterMode} setMode={setDateFilterMode}
                        date={filterDate} setDate={setFilterDate}
                        range={filterDateRange} setRange={setFilterDateRange}
                   />
              </div>
          </div>

          <div className="flex gap-3 h-[48px]">
              {/* ... Desktop Filters ... */}
              <div className="relative flex-1 bg-white border border-slate-200 rounded-2xl hover:border-indigo-300 transition-colors shadow-sm group">
                   <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-indigo-500 transition-colors"><Tag className="w-4 h-4" /></div>
                   <select
                        className="w-full h-full pl-11 pr-8 bg-transparent outline-none text-slate-700 text-sm font-bold appearance-none cursor-pointer rounded-2xl"
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                   >
                        <option value="all">ทุกหมวดหมู่</option>
                        {projectCategories.map((cat, i) => <option key={i} value={cat}>{cat}</option>)}
                   </select>
                   <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="relative flex-1 bg-white border border-slate-200 rounded-2xl hover:border-indigo-300 transition-colors shadow-sm group">
                   <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-indigo-500 transition-colors"><Briefcase className="w-4 h-4" /></div>
                   <select
                        className="w-full h-full pl-11 pr-8 bg-transparent outline-none text-slate-700 text-sm font-bold appearance-none cursor-pointer rounded-2xl"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                   >
                        <option value="all">ทุกสถานะ (ดีล)</option>
                        {dealStatuses.map((s, i) => <option key={i} value={s.value}>{s.label}</option>)}
                   </select>
                   <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="relative flex-1 bg-white border border-slate-200 rounded-2xl hover:border-indigo-300 transition-colors shadow-sm group">
                   <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-indigo-500 transition-colors"><Truck className="w-4 h-4" /></div>
                   <select
                        className="w-full h-full pl-11 pr-8 bg-transparent outline-none text-slate-700 text-sm font-bold appearance-none cursor-pointer rounded-2xl"
                        value={filterTransport}
                        onChange={(e) => setFilterTransport(e.target.value)}
                   >
                        <option value="all">ขนส่ง (ทั้งหมด)</option>
                        {transportStatuses.map((s, i) => <option key={i} value={s.value}>{s.label}</option>)}
                   </select>
                   <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <button
                  onClick={resetFilters}
                  className="px-5 bg-slate-100 text-slate-500 rounded-2xl font-bold hover:bg-rose-50 hover:text-rose-600 transition-colors flex items-center justify-center shadow-sm"
                  title="ล้างค่าตัวกรอง"
              >
                  <RotateCcw className="w-5 h-5" />
              </button>
          </div>
      </div>
    </div>
  );

  const renderContent = () => {
    // 1. ถ้ามี Tracking ID ให้แสดงหน้า Tracking View โดยไม่ต้อง Login
    if (trackingId) {
        if (isLoading && allActivities.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-screen w-full bg-slate-50">
                    <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                    <p className="text-slate-500 font-bold text-lg animate-pulse">กำลังค้นหาข้อมูลพัสดุ...</p>
                </div>
            );
        }
        
        const trackData = allActivities.find(item => item.id === trackingId);
        
        if (!trackData) {
             return (
                <div className="flex flex-col items-center justify-center h-screen w-full bg-slate-50 px-4 text-center">
                    <div className="p-4 bg-slate-200 rounded-full text-slate-500 mb-4">
                       <Search className="w-12 h-12" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 mb-2">ไม่พบข้อมูลงาน</h2>
                    <p className="text-slate-500 mb-6">รหัสติดตาม: <span className="font-mono font-bold text-indigo-600">{trackingId}</span> ไม่ถูกต้อง หรือถูกลบไปแล้ว</p>
                    <button onClick={() => window.location.search = ''} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200">
                        กลับหน้าหลัก
                    </button>
                </div>
             );
        }

        return <CustomerTrackingView data={trackData} />;
    }

    // 2. ถ้าไม่มี Tracking ID ก็เข้า Flow ปกติ (Login -> Dashboard)
    if (!isLoggedIn) {
        return <LoginScreen onLogin={handleLogin} isLoading={isLoading} loginError={loginError} />;
    }
    if (isLoading && allActivities.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)] w-full">
            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
            <p className="text-slate-500 font-bold text-lg animate-pulse">กำลังโหลดข้อมูล...</p>
        </div>
      );
    }
    
    // ... existing no URL check ...
    if (!GOOGLE_SCRIPT_URL) {
      return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)] w-full px-4 text-center">
            <div className="p-4 bg-amber-50 rounded-full text-amber-500 mb-4">
               <WifiOff className="w-12 h-12" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">ยังไม่ได้เชื่อมต่อฐานข้อมูล</h2>
            <p className="text-slate-500 max-w-md mb-6">
               กรุณานำ URL ที่ได้จากการ Deploy Google Apps Script มาวางในตัวแปร <code>GOOGLE_SCRIPT_URL</code> ในไฟล์ NexusPlan.jsx
            </p>
        </div>
      );
    }

    switch (activeTab) {
      case 'Overview':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 px-4 sm:px-8 lg:px-10 pt-6 pb-24 md:pb-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">สวัสดี, {userProfile?.name?.split(' ')[0] || 'User'}</h2>
                <p className="text-slate-500 mt-2 text-base font-medium">สรุปสถานะโครงการประจำวันที่ {new Date().toLocaleDateString('th-TH')}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {stats.map((stat, index) => (
                <div key={index} className="bg-white p-8 rounded-[2rem] shadow-[0_2px_20px_rgb(0,0,0,0.04)] border border-slate-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300">
                  <div className="flex justify-between items-start mb-6">
                    <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color}`}>
                      <stat.icon className="w-7 h-7" />
                    </div>
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${
                      stat.isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {stat.isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      {stat.change}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-slate-500 font-medium mb-2">{stat.title}</h3>
                    <p className="text-3xl font-bold text-slate-900 tracking-tight">{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-[2.5rem] shadow-[0_2px_20px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden p-2">
              <div className="px-8 py-6 flex items-center justify-between border-b border-slate-50">
                <h3 className="text-xl font-bold text-slate-900">บันทึกการดำเนินการล่าสุด</h3>
                <button
                  onClick={() => setActiveTab('Plans')}
                  className="text-indigo-600 font-bold hover:text-indigo-700 text-sm transition bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl"
                >
                  ดูประวัติทั้งหมด
                </button>
              </div>
              {renderTable(5, sortedActivitiesForOverview)}
            </div>
          </div>
        );

      case 'Analytics':
        const currentRevenue = filteredAndSortedActivities.reduce((sum, item) => {
          const isCancelledOrIssue = item.dealStatus === 'cancelled' || item.transportStatus === 'issue';
          return sum + (isCancelledOrIssue ? 0 : (item.wage || 0));
        }, 0);
        
        const currentSupport = filteredAndSortedActivities.reduce((sum, item) => {
          const itemSupport = item.customerSupport ? item.customerSupport.reduce((s, e) => s + (parseFloat(e.price) || 0), 0) : 0;
          return sum + itemSupport;
        }, 0);

        const currentCost = filteredAndSortedActivities.reduce((sum, item) => {
          const itemCost = item.expenses ? item.expenses.reduce((s, e) => s + (parseFloat(e.price) || 0), 0) : 0;
          return sum + itemCost;
        }, 0);
        
        const currentProfit = currentRevenue - currentCost; 

        const totalProjects = filteredAndSortedActivities.length;
        const completedProjects = filteredAndSortedActivities.filter(a => a.dealStatus === 'confirmed' && a.transportStatus === 'delivered').length;
        const activeProjects = filteredAndSortedActivities.filter(a => a.dealStatus === 'confirmed' && a.transportStatus !== 'delivered' && a.transportStatus !== 'issue').length;
        const pendingProjects = filteredAndSortedActivities.filter(a => a.dealStatus === 'pending').length;
        const issueProjects = filteredAndSortedActivities.filter(a => a.dealStatus === 'cancelled' || a.transportStatus === 'issue').length;
        const declinedProjects = filteredAndSortedActivities.filter(a => a.dealStatus === 'declined').length;
        
        const expenseBreakdown = {};
        filteredAndSortedActivities.forEach(item => {
          if (item.expenses) {
            item.expenses.forEach(ex => {
              if (ex.category) {
                expenseBreakdown[ex.category] = (expenseBreakdown[ex.category] || 0) + parseFloat(ex.price);
              }
            });
          }
        });
        const allExpensesList = Object.entries(expenseBreakdown)
          .map(([category, amount]) => ({ category, amount }))
          .sort((a, b) => b.amount - a.amount);
        const maxExpense = Math.max(...allExpensesList.map(e => e.amount), 1);
        
        const artistRevenue = {};
        filteredAndSortedActivities.forEach(item => {
           if (item.dealStatus !== 'cancelled' && item.transportStatus !== 'issue') {
               const name = item.artist || 'Unknown';
               artistRevenue[name] = (artistRevenue[name] || 0) + (item.wage || 0);
           }
        });
        const topPerformers = Object.entries(artistRevenue)
          .map(([name, amount]) => ({ name, amount }))
          .sort((a, b) => b.amount - a.amount);
        const maxPerformerRevenue = Math.max(...topPerformers.map(p => p.amount), 1);
        
        const customerRevenue = {};
        filteredAndSortedActivities.forEach(item => {
           if (item.dealStatus !== 'cancelled' && item.transportStatus !== 'issue') {
               const name = item.customer || 'Unknown';
               customerRevenue[name] = (customerRevenue[name] || 0) + (item.wage || 0);
           }
        });
        const topCustomers = Object.entries(customerRevenue)
          .map(([name, amount]) => ({ name, amount }))
          .sort((a, b) => b.amount - a.amount);
        const maxCustomerRevenue = Math.max(...topCustomers.map(p => p.amount), 1);
        
        const customerProjectCounts = {};
        filteredAndSortedActivities.forEach(item => {
           if (item.dealStatus !== 'cancelled' && item.transportStatus !== 'issue') {
               const name = item.customer || 'Unknown';
               customerProjectCounts[name] = (customerProjectCounts[name] || 0) + 1;
           }
        });
        const topCustomerByProjects = Object.entries(customerProjectCounts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);
        const maxCustomerProjectCount = Math.max(...topCustomerByProjects.map(p => p.count), 1);

        const categoryStats = {};
        filteredAndSortedActivities.forEach(item => {
           categoryStats[item.category] = (categoryStats[item.category] || 0) + 1;
        });
        const categoryData = Object.entries(categoryStats).map(([name, count]) => ({ name, count }));

        return (
          <div className="space-y-8 animate-in fade-in duration-500 flex flex-col min-h-full pb-24 md:pb-6">
             {renderFilterCard()}
             
             <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 px-4 sm:px-8 lg:px-10">
                <div className="bg-emerald-50 p-6 rounded-[2rem] border border-emerald-100 shadow-sm relative overflow-hidden group hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                   <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-emerald-100 rounded-xl text-emerald-600 group-hover:scale-110 transition-transform">
                         <DollarSign className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-bold text-emerald-700">รายได้ (ค่าจ้าง)</h3>
                   </div>
                   <p className="text-3xl font-black text-emerald-800">฿{currentRevenue.toLocaleString()}</p>
                   <p className="text-sm text-emerald-600 mt-1 font-medium">จาก {totalProjects} โครงการ</p>
                </div>

                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                   <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-slate-200 rounded-xl text-slate-600 group-hover:scale-110 transition-transform">
                         <Gift className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-700">ลูกค้าซัพพอร์ต</h3>
                   </div>
                   <p className="text-3xl font-black text-slate-800">฿{currentSupport.toLocaleString()}</p>
                   <p className="text-sm text-slate-600 mt-1 font-medium">ยอดสนับสนุนศิลปิน</p>
                </div>

                <div className="bg-rose-50 p-6 rounded-[2rem] border border-rose-100 shadow-sm relative overflow-hidden group hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                   <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-rose-100 rounded-xl text-rose-600 group-hover:scale-110 transition-transform">
                         <TrendingDown className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-bold text-rose-700">รวมรายจ่าย</h3>
                   </div>
                   <p className="text-3xl font-black text-rose-800">฿{currentCost.toLocaleString()}</p>
                   <p className="text-sm text-rose-600 mt-1 font-medium">ต้นทุนค่าใช้จ่าย</p>
                </div>

                <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100 shadow-sm relative overflow-hidden group hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                   <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600 group-hover:scale-110 transition-transform">
                         <TrendingUp className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-bold text-indigo-700">กำไรสุทธิ</h3>
                   </div>
                   <p className="text-3xl font-black text-indigo-800">฿{currentProfit.toLocaleString()}</p>
                   <p className="text-sm text-indigo-600 mt-1 font-medium">
                     Margin: {currentRevenue > 0 ? ((currentProfit/currentRevenue)*100).toFixed(1) : 0}%
                   </p>
                </div>
             </div>

             <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 px-4 sm:px-8 lg:px-10">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center hover:border-indigo-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
                     <div className="mb-2 p-2 bg-slate-50 text-slate-500 rounded-full"><Folder className="w-5 h-5" /></div>
                     <div className="text-2xl font-black text-slate-800">{totalProjects}</div>
                     <div className="text-xs font-bold text-slate-500 mt-1">โครงการทั้งหมด</div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center hover:border-emerald-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
                     <div className="mb-2 p-2 bg-emerald-50 text-emerald-500 rounded-full"><CheckCircle className="w-5 h-5" /></div>
                     <div className="text-2xl font-black text-emerald-600">{completedProjects}</div>
                     <div className="text-xs font-bold text-emerald-500 mt-1">งานเสร็จสิ้น</div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center hover:border-blue-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
                     <div className="mb-2 p-2 bg-blue-50 text-blue-500 rounded-full"><Activity className="w-5 h-5" /></div>
                     <div className="text-2xl font-black text-blue-600">{activeProjects}</div>
                     <div className="text-xs font-bold text-blue-500 mt-1">กำลังดำเนินการ</div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center hover:border-amber-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
                     <div className="mb-2 p-2 bg-amber-50 text-amber-500 rounded-full"><Clock className="w-5 h-5" /></div>
                     <div className="text-2xl font-black text-amber-600">{pendingProjects}</div>
                     <div className="text-xs font-bold text-amber-500 mt-1">รอดำเนินการ</div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center hover:border-rose-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
                     <div className="mb-2 p-2 bg-rose-50 text-rose-500 rounded-full"><AlertTriangle className="w-5 h-5" /></div>
                     <div className="text-2xl font-black text-rose-600">{issueProjects}</div>
                     <div className="text-xs font-bold text-rose-500 mt-1">ยกเลิก/มีปัญหา</div>
                </div>

                 <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center hover:border-gray-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
                     <div className="mb-2 p-2 bg-gray-50 text-gray-400 rounded-full"><ThumbsDown className="w-5 h-5" /></div>
                     <div className="text-2xl font-black text-gray-500">{declinedProjects}</div>
                     <div className="text-xs font-bold text-gray-400 mt-1">ลูกค้าไม่อนุมัติ</div>
                </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-4 sm:px-8 lg:px-10">
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col max-h-[400px]">
                  <div className="flex items-center justify-between mb-6 flex-shrink-0">
                      <h3 className="text-xl font-bold text-slate-900">สัดส่วนค่าใช้จ่ายสูงสุด</h3>
                  </div>
                  <div className="space-y-5 overflow-y-auto custom-scrollbar pr-2 flex-1">
                    {allExpensesList.length > 0 ? allExpensesList.map((item, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-sm font-bold mb-1.5">
                          <span className="text-slate-600">{item.category}</span>
                          <span className="text-slate-900">฿{item.amount.toLocaleString()}</span>
                        </div>
                        <div className="w-full h-3 bg-slate-50 rounded-full overflow-hidden">
                          <div 
                              className="h-full bg-indigo-500 rounded-full transition-all duration-1000 ease-out" 
                              style={{ width: animateCharts ? `${(item.amount / maxExpense) * 100}%` : '0%' }}
                          ></div>
                        </div>
                      </div>
                    )) : (
                      <div className="text-center text-slate-400 py-10">ไม่มีข้อมูลรายจ่าย</div>
                    )}
                  </div>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center justify-center">
                  <h3 className="text-xl font-bold text-slate-900 mb-2 self-start w-full">สัดส่วนหมวดหมู่โครงการ</h3>
                  <DonutChart data={categoryData} />
                </div>
             </div>
             <div className="px-4 sm:px-8 lg:px-10 w-full">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full">
                   <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col max-h-[400px]">
                      <div className="flex items-center justify-between mb-6 flex-shrink-0">
                         <h3 className="text-xl font-bold text-slate-900">อันดับศิลปินทำเงินสูงสุด (Top Artists Performers)</h3>
                      </div>
                      <div className="space-y-5 overflow-y-auto custom-scrollbar pr-2 flex-1">
                        {topPerformers.length > 0 ? topPerformers.map((item, i) => (
                          <div key={i} className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                i === 0 ? 'bg-yellow-100 text-yellow-700 ring-2 ring-yellow-200' : 
                                i === 1 ? 'bg-slate-100 text-slate-700 ring-2 ring-slate-200' :
                                i === 2 ? 'bg-orange-100 text-orange-700 ring-2 ring-orange-200' :
                                'bg-slate-50 text-slate-500'
                            }`}>
                                {i < 3 ? <Trophy className="w-4 h-4" /> : i + 1}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between text-sm font-bold mb-1.5">
                                    <span className="text-slate-700 truncate w-32 md:w-56">{item.name}</span>
                                    <span className="text-emerald-600">฿{item.amount.toLocaleString()}</span>
                                </div>
                                <div className="w-full h-2.5 bg-slate-50 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out" 
                                        style={{ width: animateCharts ? `${(item.amount / maxPerformerRevenue) * 100}%` : '0%' }}
                                    ></div>
                                </div>
                            </div>
                          </div>
                        )) : (
                          <div className="text-center text-slate-400 py-10">ไม่มีข้อมูลรายได้</div>
                        )}
                      </div>
                   </div>
                   <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col max-h-[400px]">
                      <div className="flex items-center justify-between mb-6 flex-shrink-0">
                         <h3 className="text-xl font-bold text-slate-900">อันดับลูกค้าทำเงินสูงสุด (Top Fan Performers)</h3>
                      </div>
                      <div className="space-y-5 overflow-y-auto custom-scrollbar pr-2 flex-1">
                        {topCustomers.length > 0 ? topCustomers.map((item, i) => (
                          <div key={i} className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                i === 0 ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-200' : 
                                i === 1 ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-200' :
                                i === 2 ? 'bg-sky-100 text-sky-700 ring-2 ring-sky-200' :
                                'bg-slate-50 text-slate-500'
                            }`}>
                                {i < 3 ? <Crown className="w-4 h-4" /> : i + 1}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between text-sm font-bold mb-1.5">
                                    <span className="text-slate-700 truncate w-32 md:w-56">{item.name}</span>
                                    <span className="text-indigo-600">฿{item.amount.toLocaleString()}</span>
                                </div>
                                <div className="w-full h-2.5 bg-slate-50 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-indigo-500 rounded-full transition-all duration-1000 ease-out" 
                                        style={{ width: animateCharts ? `${(item.amount / maxCustomerRevenue) * 100}%` : '0%' }}
                                    ></div>
                                </div>
                            </div>
                          </div>
                        )) : (
                          <div className="text-center text-slate-400 py-10">ไม่มีข้อมูลรายได้จากลูกค้า</div>
                        )}
                      </div>
                   </div>

                   <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col max-h-[400px]">
                      <div className="flex items-center justify-between mb-6 flex-shrink-0">
                         <h3 className="text-xl font-bold text-slate-900">อันดับลูกค้าจ้างงานสูงสุด (Top Customer Performers)</h3>
                      </div>
                      <div className="space-y-5 overflow-y-auto custom-scrollbar pr-2 flex-1">
                        {topCustomerByProjects.length > 0 ? topCustomerByProjects.map((item, i) => (
                          <div key={i} className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                i === 0 ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-200' : 
                                i === 1 ? 'bg-fuchsia-100 text-fuchsia-700 ring-2 ring-fuchsia-200' :
                                i === 2 ? 'bg-pink-100 text-pink-700 ring-2 ring-pink-200' :
                                'bg-slate-50 text-slate-500'
                            }`}>
                                {i < 3 ? <Crown className="w-4 h-4" /> : i + 1}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between text-sm font-bold mb-1.5">
                                    <span className="text-slate-700 truncate w-32 md:w-56">{item.name}</span>
                                    <span className="text-purple-600">{item.count} งาน</span>
                                </div>
                                <div className="w-full h-2.5 bg-slate-50 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-purple-500 rounded-full transition-all duration-1000 ease-out" 
                                        style={{ width: animateCharts ? `${(item.count / maxCustomerProjectCount) * 100}%` : '0%' }}
                                    ></div>
                                </div>
                            </div>
                          </div>
                        )) : (
                          <div className="text-center text-slate-400 py-10">ไม่มีข้อมูลการจ้างงาน</div>
                        )}
                      </div>
                   </div>
                </div>
             </div>
             <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden p-2 mx-4 sm:mx-8 lg:mx-10 mb-10">
              <div className="px-8 py-6 flex items-center justify-between border-b border-slate-50">
                <h3 className="text-xl font-bold text-slate-900">ข้อมูลแผนงาน (Filtered Data)</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => openModal()} 
                    className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition"
                  >
                    <Plus className="w-5 h-5"/>
                  </button>
                </div>
              </div>
              {renderTable(0, filteredAndSortedActivities)}
             </div>
          </div>
        );

      case 'Plans':
        return (
          <div className="space-y-8 animate-in fade-in duration-500 flex flex-col min-h-full pb-24 md:pb-6">
            {renderFilterCard()}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden p-2 mx-4 sm:mx-8 lg:mx-10 mb-10">
              <div className="px-8 py-6 flex items-center justify-between border-b border-slate-50">
                <h3 className="text-xl font-bold text-slate-900">แผนงานทั้งหมด</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => openModal()} 
                    className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition"
                  >
                    <Plus className="w-5 h-5"/>
                  </button>
                </div>
              </div>
              {renderTable(0, filteredAndSortedActivities)}
            </div>
          </div>
        );

      case 'Settings':
        return (
          <div className="space-y-8 animate-in fade-in duration-500 px-4 sm:px-8 lg:px-10 pt-6 pb-24 md:pb-6">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-extrabold text-slate-900 mb-6">ตั้งค่าระบบ</h2>
              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden mb-8">
                <div className="h-48 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 relative">
                  <div className="absolute right-6 top-6">
                     <button className="p-2 bg-white/20 backdrop-blur-md text-white rounded-xl hover:bg-white/30 transition shadow-sm">
                        <Camera className="w-5 h-5" />
                     </button>
                  </div>
                </div>
                <div className="px-8 pb-8">
                   <div className="flex flex-col items-center sm:items-start relative">
                      <div className="-mt-16 mb-6 relative z-10">
                         <div className="w-32 h-32 bg-white p-1.5 rounded-full shadow-2xl ring-4 ring-white/50">
                            <div className="w-full h-full bg-slate-100 text-slate-600 rounded-full flex items-center justify-center text-4xl font-black border border-slate-200 overflow-hidden">
                               {userProfile?.name?.charAt(0) || 'U'}
                            </div>
                         </div>
                      </div>
                      
                      <div className="w-full">
                         <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
                            <div className="text-center sm:text-left">
                               <h3 className="text-3xl font-black text-slate-900 tracking-tight mb-1">{userProfile?.name || 'Guest'}</h3>
                               <p className="text-lg text-slate-500 font-medium">{userProfile?.role || 'No Role'}</p>
                            </div>

                            <div className="flex flex-col sm:items-end gap-2 w-full sm:w-auto">
                               {userProfile?.email && (
                                   <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 w-full sm:w-auto">
                                       <div className="p-2 bg-white rounded-xl shadow-sm text-indigo-500">
                                          <Mail className="w-4 h-4" />
                                       </div>
                                       <span className="text-sm font-bold text-slate-600 pr-2">{userProfile.email}</span>
                                   </div>
                               )}
                               {userProfile?.phone && (
                                   <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 w-full sm:w-auto">
                                       <div className="p-2 bg-white rounded-xl shadow-sm text-emerald-500">
                                          <Phone className="w-4 h-4" />
                                       </div>
                                       <span className="text-sm font-bold text-slate-600 pr-2">{userProfile.phone}</span>
                                   </div>
                               )}
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
              </div>

              <div className="mb-8">
                  <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5 text-indigo-600" />
                      จัดการผู้ใช้งาน (User Management)
                  </h3>
                  <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                      <div className="space-y-4">
                          {authorizedUsers.map((user, idx) => (
                              <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 gap-4">
                                  <div className="flex items-center gap-4">
                                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-700 font-bold border border-slate-200 shadow-sm shrink-0">
                                          {user.name.charAt(0)}
                                      </div>
                                      <div>
                                          <div className="font-bold text-slate-800 flex items-center gap-2">
                                              {user.username}
                                              <span className="text-xs font-normal text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-100">
                                                  {user.role}
                                              </span>
                                          </div>
                                          <div className="text-sm text-slate-500">{user.name}</div>
                                      </div>
                                  </div>
                                  <div className="flex items-center gap-2 self-end sm:self-auto">
                                      <button 
                                          onClick={() => handleDeleteUser(user.username)}
                                          className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition"
                                          title="ลบผู้ใช้"
                                          disabled={authorizedUsers.length <= 1}
                                      >
                                          <Trash2 className="w-4 h-4" />
                                      </button>
                                  </div>
                              </div>
                          ))}
                      </div>

                      <div className="mt-6 pt-6 border-t border-slate-100">
                          {!isAddingUser ? (
                              <button 
                                  onClick={() => setIsAddingUser(true)}
                                  className="w-full py-3 bg-indigo-50 text-indigo-600 font-bold rounded-xl hover:bg-indigo-100 transition flex items-center justify-center gap-2 border border-indigo-100"
                              >
                                  <UserPlus className="w-5 h-5" />
                                  เพิ่มผู้ใช้งานใหม่
                              </button>
                          ) : (
                              <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 animate-in fade-in slide-in-from-top-2">
                                  <h4 className="font-bold text-indigo-900 mb-4">เพิ่มผู้ใช้งานใหม่</h4>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                      <input 
                                          type="text" 
                                          placeholder="Username (สำหรับ Login)" 
                                          value={newUser.username}
                                          onChange={e => setNewUser({...newUser, username: e.target.value})}
                                          className="px-4 py-2 bg-white border border-indigo-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                      />
                                      <input 
                                          type="text" 
                                          placeholder="Password" 
                                          value={newUser.password}
                                          onChange={e => setNewUser({...newUser, password: e.target.value})}
                                          className="px-4 py-2 bg-white border border-indigo-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                      />
                                      <input 
                                          type="text" 
                                          placeholder="ชื่อ-นามสกุล" 
                                          value={newUser.name}
                                          onChange={e => setNewUser({...newUser, name: e.target.value})}
                                          className="px-4 py-2 bg-white border border-indigo-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                      />
                                      <input 
                                          type="text" 
                                          placeholder="ตำแหน่ง (Role)" 
                                          value={newUser.role}
                                          onChange={e => setNewUser({...newUser, role: e.target.value})}
                                          className="px-4 py-2 bg-white border border-indigo-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                      />
                                      <input 
                                          type="email" 
                                          placeholder="Email (Optional)" 
                                          value={newUser.email}
                                          onChange={e => setNewUser({...newUser, email: e.target.value})}
                                          className="px-4 py-2 bg-white border border-indigo-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                      />
                                      <input 
                                          type="tel" 
                                          placeholder="เบอร์โทร (Optional)" 
                                          value={newUser.phone}
                                          onChange={e => setNewUser({...newUser, phone: e.target.value})}
                                          className="px-4 py-2 bg-white border border-indigo-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                      />
                                  </div>
                                  <div className="flex justify-end gap-3">
                                      <button 
                                          onClick={() => setIsAddingUser(false)}
                                          className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition"
                                      >
                                          ยกเลิก
                                      </button>
                                      <button 
                                          onClick={handleAddUser}
                                          className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-sm transition"
                                      >
                                          บันทึก
                                      </button>
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>
              </div>

              {/* Added Google Drive Settings Section */}
              <div className="mb-8">
                  <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <HardDrive className="w-5 h-5 text-blue-600" />
                      ตั้งค่า Google Drive
                  </h3>
                  <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                      <p className="text-sm text-slate-500 mb-3">
                          ระบุ Folder ID ของ Google Drive ที่ต้องการให้บันทึกรูปภาพ (ต้องเปิดแชร์สิทธิ์ Editor ให้กับอีเมลที่รัน Script)
                      </p>
                      <div className="flex gap-2">
                          <input
                              type="text"
                              placeholder="Google Drive Folder ID (e.g., 1xYz...)"
                              value={driveFolderId}
                              onChange={(e) => setDriveFolderId(e.target.value)}
                              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                          />
                          <button
                              onClick={() => saveSystemSettings('drive_folder_id', driveFolderId)}
                              className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-sm transition flex items-center gap-2 shrink-0"
                          >
                              <Save className="w-4 h-4" /> บันทึก
                          </button>
                      </div>
                  </div>
              </div>

              <h3 className="text-xl font-bold text-slate-900 mb-4">ตั้งค่าตัวเลือกระบบ (System Options)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <ListManager
                    title="หมวดหมู่โครงการ"
                    items={projectCategories}
                    onAdd={(val) => setProjectCategories([...projectCategories, val])}
                    onDelete={(idx) => setProjectCategories(projectCategories.filter((_, i) => i !== idx))}
                    placeholder="เพิ่มหมวดหมู่..."
                    icon={Tag}
                    onSave={(newItems) => saveSystemSettings('project_categories', newItems)}
                  />
                  <ListManager
                    title="หมวดหมู่ค่าใช้จ่าย"
                    items={expenseCategories}
                    onAdd={(val) => setExpenseCategories([...expenseCategories, val])}
                    onDelete={(idx) => setExpenseCategories(expenseCategories.filter((_, i) => i !== idx))}
                    placeholder="เพิ่มหมวดหมู่ค่าใช้จ่าย..."
                    icon={DollarSign}
                    onSave={(newItems) => saveSystemSettings('expense_categories', newItems)}
                  />
                  <AdvancedListManager
                    title="สถานะดีล (Deal Status)"
                    items={dealStatuses}
                    onUpdate={setDealStatuses} 
                    placeholder="เพิ่มสถานะดีล..."
                    icon={Briefcase}
                    onSave={(newItems) => saveSystemSettings('deal_statuses', newItems)}
                  />
                  <AdvancedListManager
                    title="สถานะขนส่ง (Transport)"
                    items={transportStatuses}
                    onUpdate={setTransportStatuses} 
                    placeholder="เพิ่มสถานะขนส่ง..."
                    icon={Truck}
                    onSave={(newItems) => saveSystemSettings('transport_statuses', newItems)}
                  />
              </div>
              <div className="pt-8 mt-8 border-t border-slate-100 flex flex-col-reverse sm:flex-row justify-between gap-4">
                  <button 
                    onClick={handleLogout}
                    className="px-6 py-3.5 text-rose-600 font-bold bg-white border border-rose-100 hover:bg-rose-50 rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>ออกจากระบบ</span>
                  </button>
              </div>
            </div>
          </div>
        );
      
      default: return null;
    }
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans text-slate-800 overflow-hidden selection:bg-indigo-100 selection:text-indigo-900">
      
      <style>{`
        @keyframes modalEnter {
          0% { opacity: 0; transform: scale(0.95) translateY(10px); filter: blur(2px); }
          100% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
        }
        @keyframes modalExit {
          0% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
          100% { opacity: 0; transform: scale(0.95) translateY(10px); filter: blur(2px); }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        .modal-animate-in {
          animation: modalEnter 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .modal-animate-out {
          animation: modalExit 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .backdrop-animate-out {
          animation: fadeOut 0.3s forwards;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }
        .safe-area-bottom {
          padding-bottom: env(safe-area-inset-bottom);
        }

        /* --- Space-Themed Staggered Animation (New) --- */
        @keyframes spaceRowEnter {
          0% {
            opacity: 0;
            transform: translateY(20px); /* เลื่อนขึ้นจากด้านล่าง */
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .space-row-animation {
          opacity: 0; /* เริ่มต้นซ่อนไว้เพื่อรอ Animation */
          animation: spaceRowEnter 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; /* ปรับจังหวะให้นุ่มนวล */
          will-change: transform, opacity;
        }
        /* ------------------------------------------------ */
      `}</style>
      
      {/* --- Global Feedback Elements --- */}
      {isSaving && <LoadingOverlay />} 
      {toast.show && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}
      {previewImage && <ImageViewer src={processImageUrl(previewImage)} onClose={() => setPreviewImage(null)} />}
      
      {/* Render SharePreviewModal when shareData exists */}
      {shareData && (
        <SharePreviewModal 
          data={shareData} 
          onClose={() => setShareData(null)} 
        />
      )}

      {/* --- Desktop Sidebar --- */}
      {/* Only show sidebar if logged in AND NOT in tracking mode */}
      {isLoggedIn && !trackingId && (
        <aside className={`hidden md:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-white border-r border-slate-100 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20 transition-all duration-300 relative`}>
            {/* ... Sidebar Content ... */}
            <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="absolute -right-3 top-1/2 -translate-y-1/2 p-1.5 bg-white border border-slate-200 rounded-full shadow-sm text-slate-400 hover:text-indigo-600 transition-colors z-50"
            >
                {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>

            <div className={`p-6 pb-4 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 shrink-0">
                <Clipboard className="w-6 h-6 text-white" />
            </div>
            {!isSidebarCollapsed && (
                <h1 className="text-2xl font-black bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent tracking-tight whitespace-nowrap overflow-hidden">
                ProjectPlan
                </h1>
            )}
            </div>
            
            <nav className="flex-1 px-4 py-6 space-y-2">
            {navItems.map((item) => (
                <button
                key={item.name}
                onClick={() => setActiveTab(item.name)}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'gap-4 px-6'} py-4 text-sm font-bold rounded-[1.2rem] transition-all duration-300 group ${
                    activeTab === item.name
                    ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 scale-100'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
                title={isSidebarCollapsed ? item.label : ''}
                >
                <item.icon className={`w-5 h-5 transition-transform group-hover:scale-110 ${activeTab === item.name ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} />
                {!isSidebarCollapsed && <span>{item.label}</span>}
                </button>
            ))}
            </nav>

            <div className="p-4 border-t border-slate-50">
                <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-4'} cursor-pointer p-2 sm:p-4 rounded-[1.5rem] bg-slate-50 hover:bg-white hover:shadow-lg hover:shadow-slate-100 transition-all duration-300 border border-transparent hover:border-slate-100`}>
                <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-white text-xs font-bold ring-4 ring-white shadow-md shrink-0">
                    {userProfile?.name?.charAt(0) || 'U'}
                </div>
                {!isSidebarCollapsed && (
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{userProfile?.name || 'Guest User'}</p>
                        <p className="text-xs text-slate-500 truncate font-medium">{userProfile?.role || 'Viewer'}</p>
                    </div>
                )}
                </div>
            </div>
        </aside>
      )}

      {/* --- Mobile Bottom Navigation --- */}
      {/* Only show nav if logged in AND NOT in tracking mode */}
      {isLoggedIn && !trackingId && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-200 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] safe-area-bottom pb-safe">
            <div className="relative grid grid-cols-5 h-16 items-center">
                {/* Sliding Background Indicator */}
                <div 
                    className="absolute top-2 bottom-2 bg-indigo-50 rounded-full transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1)"
                    style={{ 
                        left: `${(navItems.findIndex(i => i.name === activeTab) < 2 
                            ? (navItems.findIndex(i => i.name === activeTab) * 20) + 10 
                            : ((navItems.findIndex(i => i.name === activeTab) + 1) * 20) + 10 
                        )}%`, 
                        width: '48px',
                        transform: 'translateX(-50%)'
                    }}
                />

                {/* เมนูฝั่งซ้าย */}
                {navItems.slice(0, 2).map((item) => {
                    const isActive = activeTab === item.name;
                    return (
                        <button
                            key={item.name}
                            onClick={() => setActiveTab(item.name)}
                            className="relative flex flex-col items-center justify-center h-full w-full group cursor-pointer outline-none z-10"
                        >
                            <div className={`transition-all duration-300 ${
                                isActive ? 'text-indigo-600 scale-110' : 'text-slate-400'
                            }`}>
                                <item.icon className={`w-6 h-6 ${isActive ? 'fill-indigo-600/20' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
                            </div>
                        </button>
                    );
                })}

                {/* ปุ่มเพิ่มโครงการ */}
                <div className="relative -top-6 flex justify-center z-20 pointer-events-none">
                     <button
                        onClick={() => openModal()}
                        className="w-14 h-14 bg-indigo-600 rounded-full text-white shadow-lg shadow-indigo-200 flex items-center justify-center transform active:scale-95 transition-all border-4 border-[#F8FAFC] pointer-events-auto"
                     >
                        <Plus className="w-7 h-7" />
                     </button>
                </div>

                {/* เมนูฝั่งขวา */}
                {navItems.slice(2, 4).map((item) => {
                    const isActive = activeTab === item.name;
                    return (
                        <button
                            key={item.name}
                            onClick={() => setActiveTab(item.name)}
                            className="relative flex flex-col items-center justify-center h-full w-full group cursor-pointer outline-none z-10"
                        >
                            <div className={`transition-all duration-300 ${
                                isActive ? 'text-indigo-600 scale-110' : 'text-slate-400'
                            }`}>
                                <item.icon className={`w-6 h-6 ${isActive ? 'fill-indigo-600/20' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
                            </div>
                        </button>
                    );
                })}
            </div>
        </nav>
      )}

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Only show header if logged in AND NOT in tracking mode */}
        {isLoggedIn && !trackingId && (
            <header className="h-20 bg-white/80 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-6 sm:px-8 z-10 sticky top-0">
            <div className="flex items-center gap-4">
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {getPageTitle(activeTab)}
                </h1>
            </div>

            <div className="hidden md:flex">
                <button
                onClick={() => openModal()}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 hover:-translate-y-0.5 transition-all flex items-center gap-2"
                >
                <Plus className="w-5 h-5" />
                <span>เพิ่มรายการ</span>
                </button>
            </div>
            </header>
        )}

        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto bg-[#F8FAFC]"
          onScroll={handleScroll}
        >
          <div className="max-w-[3840px] mx-auto min-h-full flex flex-col">
            {renderContent()}
          </div>
        </main>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm ${isDeleteClosing ? 'backdrop-animate-out' : 'backdrop-animate-in'}`}
            onClick={closeDeleteModal}
          />
          <div className={`bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm relative z-10 ${isDeleteClosing ? 'modal-animate-out' : 'modal-animate-in'}`}>
            <div className="flex flex-col items-center text-center gap-4">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-full">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">ยืนยันการลบ?</h3>
                <p className="text-sm text-slate-500">คุณต้องการลบรายการนี้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้</p>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <button
                  onClick={closeDeleteModal}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={executeDelete}
                  className="flex-1 py-2.5 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition shadow-lg shadow-rose-200"
                >
                  ยืนยันลบ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modern Add Item Modal - Expanded Version */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
           {/* Backdrop */}
           <div
             className={`fixed inset-0 bg-slate-900/60 backdrop-blur-md ${isModalClosing ? 'backdrop-animate-out' : 'backdrop-animate-in'}`}
             onClick={closeModal}
           />
           
           {/* Modal Content - Responsive Layout */}
           <div className={`bg-white w-full max-w-4xl sm:rounded-[2.5rem] rounded-xl shadow-2xl relative z-10 overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] ${isModalClosing ? 'modal-animate-out' : 'modal-animate-in'}`}>
             
             {/* Header - Compact for Mobile */}
             <div className="px-4 py-4 sm:px-8 sm:py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-20">
                 <div className="flex items-center gap-3">
                   <div className="p-2 sm:p-3 bg-indigo-50 text-indigo-600 rounded-xl sm:rounded-2xl">
                      <Briefcase className="w-5 h-5 sm:w-6 sm:h-6" />
                   </div>
                   <div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                        <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                          {editingId ? (viewOnlyMode ? 'รายละเอียด' : 'แก้ไขรายการ') : 'เพิ่มรายการ'}
                        </h3>
                        {currentId && <span className="bg-indigo-50 text-indigo-600 text-[10px] sm:text-xs px-2 py-0.5 sm:py-1 rounded-lg font-bold border border-indigo-100 w-fit">{currentId}</span>}
                      </div>
                      <p className="text-xs sm:text-sm text-slate-500 font-medium hidden sm:block">
                        {viewOnlyMode ? 'ดูข้อมูลและจัดการต้นทุน' : 'กรอกข้อมูลรายละเอียดโครงการ'}
                      </p>
                   </div>
                 </div>
                 
                 {/* ส่วนปุ่มปิดและปุ่ม Share (เพิ่มปุ่ม Share ตรงนี้) */}
                 <div className="flex items-center gap-2">
                   {editingId && (
                       <button
                         onClick={() => {
                            // รวบรวมข้อมูลปัจจุบันเพื่อส่งไปยัง Share Modal
                            const currentData = {
                                id: currentId,
                                name: projectName,
                                rawDateTime: projectDateTime,
                                artist: artistName,
                                customer: customerName,
                                rawDeliveryStart: deliveryStart,
                                rawDeliveryEnd: deliveryEnd,
                                rawDeliveryDateTime: deliveryEnd,
                                location: locationName,
                                mapLink: mapLink,
                                recipient: recipientName,
                                recipientPhone: recipientPhone,
                                image: uploadedImage,
                                wage: wage,
                                customerSupport: customerSupportItems,
                                dealStatus: dealStatus, // เพิ่ม status ส่งไปด้วย
                                transportStatus: transportStatus
                            };
                            setShareData(currentData);
                         }}
                         className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-colors flex items-center gap-2 group"
                         title="แชร์ข้อมูลให้ลูกค้า"
                       >
                         <Share2 className="w-5 h-5 sm:w-6 sm:h-6" />
                         <span className="text-xs font-bold hidden sm:inline">แชร์</span>
                       </button>
                   )}
                   <button
                     onClick={closeModal}
                     className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-colors"
                   >
                     <X className="w-5 h-5 sm:w-6 sm:h-6" />
                   </button>
                 </div>
             </div>

             {/* Scrollable Body - Compact Padding */}
             <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                   {/* ... (Section 1 - Work/Project) ... */}
                   <div className="space-y-6">
                       <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                          <span className="bg-slate-900 text-white w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold">1</span>
                          <h4 className="font-bold text-slate-800 text-lg">งาน/โปรเจค</h4>
                       </div>
                       
                       <div className="space-y-4">
                          <div className="space-y-2">
                             <label className="text-sm font-bold text-slate-700 ml-1">ชื่อโครงการ/แผนงาน</label>
                             <input
                               type="text"
                               value={projectName}
                               disabled={viewOnlyMode}
                               onChange={(e) => setProjectName(e.target.value)}
                               className={`w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium ${viewOnlyMode ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                             />
                           </div>
                           
                           <div className="space-y-2">
                             <label className="text-sm font-bold text-slate-700 ml-1">วันที่ & เวลา</label>
                             <ModernDateTimePicker 
                                value={projectDateTime} 
                                onChange={(e) => setProjectDateTime(e.target.value)} 
                                placeholder="เลือกวันและเวลา..." 
                                disabled={viewOnlyMode} 
                             />
                           </div>

                           <div className="space-y-2">
                             <label className="text-sm font-bold text-slate-700 ml-1">ศิลปิน</label>
                             <input
                               type="text"
                               list="artist-list"
                               placeholder="เลือกหรือพิมพ์..."
                               value={artistName}
                               disabled={viewOnlyMode}
                               onChange={(e) => setArtistName(e.target.value)}
                               className={`w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium ${viewOnlyMode ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                             />
                           </div>
                           
                           {/* ส่วนลูกค้า */}
                           <div className="space-y-2">
                             <label className="text-sm font-bold text-slate-700 ml-1">ลูกค้า</label>
                             <input
                               type="text"
                               list="customer-list"
                               placeholder="ชื่อลูกค้า (พิมพ์เพื่อค้นหา)"
                               value={customerName}
                               disabled={viewOnlyMode}
                               onChange={handleCustomerChange} 
                               className={`w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium mb-3 ${viewOnlyMode ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                             />
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                 <input
                                   type="text"
                                   placeholder="IG / FB / TT"
                                   value={customerSocial}
                                   disabled={viewOnlyMode}
                                   onChange={(e) => setCustomerSocial(e.target.value)}
                                   className={`px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${viewOnlyMode ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                                 />
                                 <input
                                   type="text"
                                   placeholder="LINE ID"
                                   value={customerLine}
                                   disabled={viewOnlyMode}
                                   onChange={(e) => setCustomerLine(e.target.value)}
                                   className={`px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${viewOnlyMode ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                                 />
                                 {viewOnlyMode ? (
                                      <ViewOnlyField value={customerPhone} type="tel" icon={Phone} />
                                 ) : (
                                      <input
                                        type="tel"
                                        placeholder="เบอร์โทร"
                                        value={customerPhone}
                                        onChange={(e) => setCustomerPhone(e.target.value)}
                                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                      />
                                 )}
                                 {viewOnlyMode ? (
                                      <ViewOnlyField value={customerEmail} type="email" icon={Mail} />
                                 ) : (
                                      <input
                                        type="email"
                                        placeholder="อีเมล"
                                        value={customerEmail}
                                        onChange={(e) => setCustomerEmail(e.target.value)}
                                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                      />
                                 )}
                             </div>
                           </div>

                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 ml-1">หมวดหมู่</label>
                                <div className="relative">
                                  <select
                                    value={projectCategory}
                                    disabled={viewOnlyMode}
                                    onChange={(e) => setProjectCategory(e.target.value)}
                                    className={`w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium appearance-none cursor-pointer ${viewOnlyMode ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                                  >
                                    {projectCategories.map((cat, i) => (
                                        <option key={i} value={cat}>{cat}</option>
                                    ))}
                                  </select>
                                  <div className="absolute right-4 top-3.5 pointer-events-none opacity-50"><ChevronDown className="w-5 h-5" /></div>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 ml-1">สถานะ (ดีล)</label>
                                <div className="relative">
                                  <select
                                    value={dealStatus}
                                    disabled={viewOnlyMode}
                                    onChange={(e) => setDealStatus(e.target.value)}
                                    className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-bold appearance-none cursor-pointer ${
                                      getDealStatusInfo(dealStatus).color
                                    } ${viewOnlyMode ? 'opacity-70 cursor-not-allowed' : ''}`}
                                  >
                                     {dealStatuses.map((status, i) => (
                                       <option key={i} value={status.value}>{status.label}</option>
                                      ))}
                                  </select>
                                  <div className="absolute right-4 top-3.5 pointer-events-none opacity-50">
                                     <ChevronDown className="w-5 h-5" />
                                  </div>
                                </div>
                              </div>
                           </div>
                           <div className="space-y-2">
                              <label className="text-sm font-bold text-slate-700 ml-1">ราคา (ค่าจ้าง)</label>
                              <div className="relative">
                                <span className="absolute left-4 top-3 text-slate-400 font-bold text-lg">฿</span>
                                <input
                                  type="number"
                                  placeholder="0.00"
                                  value={wage}
                                  disabled={viewOnlyMode}
                                  onChange={(e) => setWage(e.target.value)}
                                  className={`w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold text-slate-900 ${viewOnlyMode ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                                />
                              </div>
                           </div>
                        </div>
                   </div>

                   {/* ส่วนที่ 2: กำหนดส่ง & รูปภาพ */}
                   <div className="space-y-6">
                       <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                          <span className="bg-slate-900 text-white w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold">2</span>
                          <h4 className="font-bold text-slate-800 text-lg">กำหนดส่ง & สถานที่ & รูปภาพ</h4>
                       </div>
                       
                       <div className="space-y-4">
                          <div className="space-y-2">
                             <label className="text-sm font-bold text-slate-700 ml-1">กำหนดส่ง (เริ่ม - สิ้นสุด)</label>
                             <div className="grid grid-cols-2 gap-2">
                                <ModernDateTimePicker 
                                    value={deliveryStart} 
                                    onChange={(e) => setDeliveryStart(e.target.value)} 
                                    placeholder="เริ่ม..." 
                                    disabled={viewOnlyMode} 
                                />
                                <ModernDateTimePicker 
                                    value={deliveryEnd} 
                                    onChange={(e) => setDeliveryEnd(e.target.value)} 
                                    placeholder="สิ้นสุด..." 
                                    disabled={viewOnlyMode} 
                                />
                             </div>
                           </div>
                           <div className="space-y-2">
                             <label className="text-sm font-bold text-slate-700 ml-1">สถานที่</label>
                             <div className="relative">
                               <MapPin className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                               <input
                                 type="text"
                                 placeholder="ระบุชื่อสถานที่"
                                 value={locationName}
                                 disabled={viewOnlyMode}
                                 onChange={(e) => setLocationName(e.target.value)}
                                 className={`w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium ${viewOnlyMode ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                               />
                             </div>
                           </div>
                           <div className="space-y-2">
                             <label className="text-sm font-bold text-slate-700 ml-1">Google Maps Link</label>
                             {viewOnlyMode ? (
                                <ViewOnlyField value={mapLink} type="url" icon={MapPin} />
                             ) : (
                                <input
                                  type="url"
                                  placeholder="https://maps.google.com/..."
                                  value={mapLink}
                                  onChange={(e) => setMapLink(e.target.value)}
                                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-blue-600"
                                />
                             )}
                           </div>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 ml-1">ผู้รับ</label>
                                <input
                                  type="text"
                                  list="recipient-list"
                                  placeholder="ชื่อผู้รับ (พิมพ์เพื่อค้นหา)"
                                  value={recipientName}
                                  disabled={viewOnlyMode}
                                  onChange={handleRecipientChange}
                                  className={`w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium ${viewOnlyMode ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 ml-1">เบอร์โทรผู้รับ</label>
                                {viewOnlyMode ? (
                                    <ViewOnlyField value={recipientPhone} type="tel" icon={Phone} />
                                ) : (
                                    <input
                                      type="tel"
                                      value={recipientPhone}
                                      onChange={(e) => setRecipientPhone(e.target.value)}
                                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                                    />
                                )}
                              </div>
                           </div>
                           
                           {/* สถานะงาน (ขนส่ง) เปลี่ยนสีได้ */}
                           <div className="space-y-2">
                              <label className="text-sm font-bold text-slate-700 ml-1">สถานะงาน (ขนส่ง)</label>
                              <div className="relative">
                                <select
                                  value={transportStatus}
                                  disabled={viewOnlyMode}
                                  onChange={(e) => setTransportStatus(e.target.value)}
                                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-bold appearance-none cursor-pointer ${
                                    getTransportStatusInfo(transportStatus).color
                                  } ${viewOnlyMode ? 'opacity-70 cursor-not-allowed' : ''}`}
                                >
                                   {transportStatuses.map((status, i) => (
                                      <option key={i} value={status.value}>{status.label}</option>
                                   ))}
                                </select>
                                <div className="absolute right-4 top-3.5 pointer-events-none opacity-50">
                                   <ChevronDown className="w-5 h-5" />
                                </div>
                              </div>
                           </div>

                           {/* Image Upload Area Moved Here */}
                          <div className="space-y-2 pt-2 border-t border-slate-100">
                             <label className="text-sm font-bold text-slate-700 ml-1">รูปภาพอ้างอิง</label>
                             {!viewOnlyMode ? (
                               <div 
                                 className="w-full border-2 border-dashed border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer group"
                                 onDrop={onDrop}
                                 onDragOver={onDragOverImg}
                                 onClick={() => document.getElementById('image-upload').click()}
                               >
                                  <input 
                                    type="file" 
                                    id="image-upload" 
                                    className="hidden" 
                                    accept="image/*"
                                    onChange={(e) => e.target.files[0] && handleImageUpload(e.target.files[0])}
                                  />
                                  {uploadedImage ? (
                                     <div 
                                        className="relative w-full h-48 rounded-xl overflow-hidden shadow-sm border border-slate-100 group/img"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPreviewImage(uploadedImage);
                                        }}
                                     >
                                         <img 
                                            src={processImageUrl(uploadedImage)} 
                                            alt="Preview" 
                                            className="w-full h-full object-contain bg-slate-50" 
                                            referrerPolicy="no-referrer"
                                            onError={(e) => {
                                                e.target.onerror = null;
                                                e.target.src = "https://placehold.co/400x300?text=Image+Load+Error";
                                            }}
                                         />
                                         <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                              <Maximize2 className="w-6 h-6 text-white" />
                                              <span className="text-white font-bold text-sm">ดูรูปขยาย</span>
                                         </div>
                                         <button 
                                            onClick={(e) => { e.stopPropagation(); setUploadedImage(null); }}
                                            className="absolute top-2 right-2 p-1.5 bg-white/80 backdrop-blur-sm text-rose-500 rounded-lg hover:bg-rose-50 hover:text-rose-600 transition shadow-sm z-10"
                                         >
                                            <Trash2 className="w-4 h-4" />
                                         </button>
                                     </div>
                                  ) : (
                                     <div className="py-6 flex flex-col items-center">
                                         <div className="p-3 bg-indigo-50 text-indigo-500 rounded-full mb-3 group-hover:scale-110 transition-transform">
                                            <UploadCloud className="w-6 h-6" />
                                         </div>
                                         <p className="text-sm font-bold text-slate-600">คลิกเพื่ออัพโหลด หรือลากไฟล์มาวาง</p>
                                         <p className="text-xs text-slate-400 mt-1">รองรับ JPG, PNG (Max 5MB)</p>
                                     </div>
                                  )}
                               </div>
                             ) : (
                                uploadedImage ? (
                                   <div 
                                        className="w-full h-64 rounded-2xl overflow-hidden shadow-sm border border-slate-100 bg-slate-50 cursor-zoom-in relative group"
                                        onClick={() => setPreviewImage(uploadedImage)}
                                   >
                                       <img 
                                          src={processImageUrl(uploadedImage)} 
                                          alt="Preview" 
                                          className="w-full h-full object-contain" 
                                          referrerPolicy="no-referrer"
                                          onError={(e) => {
                                              e.target.onerror = null;
                                              e.target.src = "https://placehold.co/400x300?text=Image+Load+Error";
                                          }}
                                       />
                                       <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm p-1.5 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                           <Maximize2 className="w-4 h-4" />
                                       </div>
                                   </div>
                                ) : (
                                   <div className="w-full px-4 py-8 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 italic text-sm flex flex-col items-center gap-2">
                                       <ImageIcon className="w-8 h-8 opacity-50" />
                                       <span>ไม่มีรูปภาพ</span>
                                   </div>
                                )
                             )}
                          </div>

                        </div>
                   </div>
                 </div>

                 {/* ส่วนที่ 3: การเงิน */}
                 <div className="mt-10 space-y-6" ref={part3Ref}>
                     {/* ... (Finance section same as before) ... */}
                     <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                          <span className="bg-slate-900 text-white w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold">3</span>
                          <h4 className="font-bold text-slate-800 text-lg">การเงิน</h4>
                     </div>

                     {/* 3.1: Customer Support (Sponsorship) */}
                     <div className="space-y-3">
                         <h5 className="font-bold text-indigo-600 text-sm flex items-center gap-1.5">
                            <Gift className="w-4 h-4" />
                            รายการลูกค้าสนับสนุนศิลปิน (ไม่รวมในต้นทุน)
                         </h5>
                         <div className="bg-indigo-50/50 rounded-2xl border border-indigo-100 p-4">
                              <div className="space-y-3">
                                  {/* Header Row */}
                                  <div className="hidden sm:grid grid-cols-12 gap-4 px-2 text-sm font-bold text-indigo-800/60">
                                      <div className="col-span-9">รายละเอียด</div>
                                      <div className="col-span-2">จำนวนเงิน</div>
                                      <div className="col-span-1"></div>
                                  </div>

                                  {/* Dynamic Rows */}
                                  {customerSupportItems.map((item, idx) => (
                                      <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start animate-in fade-in slide-in-from-left-2 duration-300">
                                          <div className="sm:col-span-9">
                                              <input
                                                  type="text"
                                                  placeholder="รายละเอียด (เช่น สนับสนุนค่าที่พัก)"
                                                  value={item.detail}
                                                  onChange={(e) => handleSupportItemChange(idx, 'detail', e.target.value)}
                                                  className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                              />
                                          </div>
                                          <div className="sm:col-span-2">
                                              <input
                                                  type="number"
                                                  placeholder="0.00"
                                                  value={item.price}
                                                  onChange={(e) => handleSupportItemChange(idx, 'price', e.target.value)}
                                                  className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-sm font-semibold text-indigo-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                              />
                                          </div>
                                          <div className="sm:col-span-1 flex justify-center pt-1">
                                              <button
                                                  onClick={() => handleRemoveSupportItem(idx)}
                                                  className="p-1.5 text-indigo-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"
                                              >
                                                  <Trash2 className="w-4 h-4" />
                                              </button>
                                          </div>
                                      </div>
                                  ))}
                              </div>

                              <button
                                  onClick={handleAddSupportItem}
                                  className="mt-4 flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100 px-3 py-2 rounded-lg transition"
                              >
                                  <Plus className="w-4 h-4" />
                                  เพิ่มรายการสนับสนุน
                              </button>
                         </div>
                     </div>

                     {/* 3.2: Expenses */}
                     <div className="space-y-3 pt-4 border-t border-slate-100">
                         <h5 className="font-bold text-slate-700 text-sm">รายจ่ายจริง (ต้นทุน)</h5>
                         <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4">
                             <div className="space-y-3">
                                {/* Header Row for Expenses */}
                                <div className="hidden sm:grid grid-cols-12 gap-4 px-2 text-sm font-bold text-slate-500">
                                   <div className="col-span-3">รายการ (หมวดหมู่)</div>
                                   <div className="col-span-6">รายละเอียด</div>
                                   <div className="col-span-2">ราคา</div>
                                   <div className="col-span-1"></div>
                                </div>

                                {/* Dynamic Rows */}
                                {expenses.map((item, idx) => (
                                   <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start animate-in fade-in slide-in-from-left-2 duration-300">
                                       <div className="sm:col-span-3">
                                          <input
                                            type="text"
                                            list="expense-categories" // Connect to datalist
                                            placeholder="เลือกหรือพิมพ์..."
                                            value={item.category}
                                            onChange={(e) => handleExpenseChange(idx, 'category', e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                          />
                                       </div>
                                       <div className="sm:col-span-6">
                                          <input
                                            type="text"
                                            placeholder="รายละเอียดเพิ่มเติม..."
                                            value={item.detail}
                                            onChange={(e) => handleExpenseChange(idx, 'detail', e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                          />
                                       </div>
                                       <div className="sm:col-span-2">
                                          <input
                                            type="number"
                                            placeholder="0.00"
                                            value={item.price}
                                            onChange={(e) => handleExpenseChange(idx, 'price', e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                          />
                                       </div>
                                       <div className="sm:col-span-1 flex justify-center pt-1">
                                          <button
                                            onClick={() => handleRemoveExpense(idx)}
                                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                       </div>
                                    </div>
                                 ))}
                              </div>

                              <button
                                onClick={handleAddExpense}
                                className="mt-4 flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-3 py-2 rounded-lg transition"
                              >
                                <Plus className="w-4 h-4" />
                                เพิ่มรายการจ่าย
                              </button>
                         </div>
                     </div>

                     {/* Summary Section */}
                     <div className="flex flex-col sm:flex-row justify-end gap-4 sm:gap-6 mt-6">
                         <div className="bg-indigo-50 p-4 rounded-2xl min-w-[180px] flex-1 sm:flex-none border border-indigo-100">
                            <p className="text-sm font-bold text-indigo-800 mb-1">ยอดเรียกเก็บลูกค้าสุทธิ</p>
                            <p className="text-2xl font-black text-indigo-900 tracking-tight">฿{((parseFloat(wage) || 0) + (customerSupportItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0))).toLocaleString()}</p>
                            <p className="text-[10px] text-indigo-600 mt-1">
                               (ค่าจ้าง {parseFloat(wage).toLocaleString()} + สนับสนุน {(customerSupportItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0)).toLocaleString()})
                            </p>
                         </div>

                         <div className="bg-emerald-50 p-4 rounded-2xl min-w-[180px] flex-1 sm:flex-none">
                            <p className="text-sm font-bold text-emerald-600 mb-1">รายได้ (ค่าจ้าง)</p>
                            <p className="text-2xl font-black text-emerald-700 tracking-tight">฿{(parseFloat(wage) || 0).toLocaleString()}</p>
                         </div>

                         <div className="bg-slate-50 p-4 rounded-2xl min-w-[180px] flex-1 sm:flex-none">
                            <p className="text-sm font-bold text-slate-500 mb-1">รวมรายจ่าย</p>
                            <p className="text-2xl font-black text-rose-600 tracking-tight">฿{totalExpenses.toLocaleString()}</p>
                         </div>
                         
                         <div className="bg-indigo-50 p-4 rounded-2xl min-w-[180px] flex-1 sm:flex-none">
                            <p className="text-sm font-bold text-indigo-500 mb-1">กำไรสุทธิ</p>
                            <p className={`text-2xl font-black tracking-tight ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {profit >= 0 ? '+' : ''}฿{profit.toLocaleString()}
                            </p>
                         </div>
                     </div>
                 </div>
                 
                 {/* ส่วนที่ 4: หมายเหตุ (Note) */}
                 <div className="mt-8 space-y-4">
                     <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                          <span className="bg-slate-900 text-white w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold">4</span>
                          <h4 className="font-bold text-slate-800 text-lg">หมายเหตุ</h4>
                     </div>
                     <div className="relative">
                         <StickyNote className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                         <textarea
                           rows={3}
                           placeholder="ระบุหมายเหตุเพิ่มเติม..."
                           value={note}
                           disabled={viewOnlyMode}
                           onChange={(e) => setNote(e.target.value)}
                           className={`w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium resize-none ${viewOnlyMode ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                         />
                     </div>
                 </div>
             </div>

             {/* Footer Actions - Compact for Mobile */}
             <div className="p-4 sm:p-8 border-t border-slate-100 bg-white sticky bottom-0 z-20 flex justify-between gap-3 sm:gap-4">
                 {/* Delete Button (Only Show in Edit Mode) */}
                 {editingId && (
                   <button
                     onClick={handleDeleteProject}
                     className="px-4 py-3 sm:px-6 sm:py-4 bg-rose-50 text-rose-600 rounded-xl sm:rounded-2xl font-bold hover:bg-rose-100 transition-colors flex items-center gap-2 text-sm sm:text-lg"
                   >
                     <Trash2 className="w-5 h-5" />
                     <span className="hidden sm:inline">ลบโครงการ</span>
                   </button>
                 )}
                 
                 <div className="flex gap-3 sm:gap-4 ml-auto w-full md:w-auto">
                   <button
                     onClick={closeModal}
                     className="flex-1 px-4 py-3 sm:px-8 sm:py-4 bg-slate-100 text-slate-600 rounded-xl sm:rounded-2xl font-bold hover:bg-slate-200 transition-colors text-sm sm:text-lg"
                   >
                     {viewOnlyMode ? 'ปิด' : 'ยกเลิก'}
                   </button>
                   <button
                     onClick={handleSaveProject}
                     className="flex-[2] px-4 py-3 sm:px-10 sm:py-4 bg-indigo-600 text-white rounded-xl sm:rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 hover:-translate-y-0.5 transition-all text-sm sm:text-lg"
                   >
                     {editingId ? 'บันทึก' : 'บันทึก'}
                   </button>
                 </div>
             </div>
           </div>
        </div>
      )}

      {/* Datalist for Autocomplete - Artists */}
      <datalist id="artist-list">
        {savedArtists.map((artist, i) => (
          <option key={i} value={artist} />
        ))}
      </datalist>

      {/* Datalist for Autocomplete - Customers */}
      <datalist id="customer-list">
        {savedCustomers.map((customer, i) => (
          <option key={i} value={customer.name} />
        ))}
      </datalist>

      {/* Datalist for Autocomplete - Recipients (New) */}
      <datalist id="recipient-list">
        {savedRecipients.map((recipient, i) => (
          <option key={i} value={recipient.name} />
        ))}
      </datalist>

      {/* Datalist for Autocomplete - Expenses */}
      <datalist id="expense-categories">
        {expenseCategories.map((cat, i) => (
          <option key={i} value={cat} />
        ))}
      </datalist>

    </div>
  );
};

export default App;