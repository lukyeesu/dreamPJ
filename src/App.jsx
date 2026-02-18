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
  PackageCheck,
  Facebook,
  Instagram,
  MessageCircle,
  Music2,
  LayoutList,      
  Table as TableIcon, 
  Pipette,
  Bot, 
  Send
} from 'lucide-react';

// --- CONFIGURATION ---
// นำ Web App URL ที่ได้จากการ Deploy Apps Script มาวางที่นี่
// [UPDATED] อัปเดต URL ให้ตรงกับที่คุณให้มาล่าสุด
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw2WJ4tt7l__0U6XYtgHbyl0W1iGjm6oHXa9-2twBKfa1xP2-SBj2hMwaHUYp7ew_Ih/exec"; 
// ---------------------

// [ADDED] Helper Functions for Color Manipulation
const shadeColor = (color, percent) => {
    var f=parseInt(color.slice(1),16),t=percent<0?0:255,p=percent<0?percent*-1:percent,R=f>>16,G=f>>8&0x00FF,B=f&0x0000FF;
    return "#"+(0x1000000+(Math.round((t-R)*p)+R)*0x10000+(Math.round((t-G)*p)+G)*0x100+(Math.round((t-B)*p)+B)).toString(16).slice(1);
};

const hexToRgbString = (hex) => {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '0, 0, 0';
};

// [ADDED] Theme Configuration
const themeColors = {
  indigo: { 
    label: 'Indigo', 
    main: '#4f46e5', hover: '#4338ca', light: '#eef2ff', textLight: '#6366f1',
    gradientFrom: '#4f46e5', gradientTo: '#7c3aed',
    shadow: 'rgba(79, 70, 229, 0.4)'
  },
  blue: { 
    label: 'Blue', 
    main: '#2563eb', hover: '#1d4ed8', light: '#eff6ff', textLight: '#3b82f6',
    gradientFrom: '#2563eb', gradientTo: '#06b6d4',
    shadow: 'rgba(37, 99, 235, 0.4)' 
  },
  emerald: { 
    label: 'Emerald', 
    main: '#059669', hover: '#047857', light: '#ecfdf5', textLight: '#10b981',
    gradientFrom: '#059669', gradientTo: '#14b8a6',
    shadow: 'rgba(5, 150, 105, 0.4)' 
  },
  rose: { 
    label: 'Rose', 
    main: '#e11d48', hover: '#be123c', light: '#fff1f2', textLight: '#f43f5e',
    gradientFrom: '#e11d48', gradientTo: '#db2777',
    shadow: 'rgba(225, 29, 72, 0.4)' 
  },
  amber: { 
    label: 'Amber', 
    main: '#d97706', hover: '#b45309', light: '#fffbeb', textLight: '#f59e0b',
    gradientFrom: '#d97706', gradientTo: '#ea580c',
    shadow: 'rgba(217, 119, 6, 0.4)' 
  },
  slate: { 
    label: 'Slate', 
    main: '#475569', hover: '#334155', light: '#f8fafc', textLight: '#64748b',
    gradientFrom: '#475569', gradientTo: '#0f172a',
    shadow: 'rgba(71, 85, 105, 0.4)' 
  },
  // [ADDED] Rainbow Theme
  rainbow: { 
    label: 'Rainbow', 
    main: '#8b5cf6', hover: '#7c3aed', light: '#faf5ff', textLight: '#8b5cf6',
    gradientFrom: '#ec4899', gradientTo: '#3b82f6',
    shadow: 'rgba(139, 92, 246, 0.4)',
    isRainbow: true
  }
};

const navItems = [
  { name: 'Overview', icon: Home, label: 'ภาพรวมแผนงาน' },
  { name: 'Calendar', icon: Calendar, label: 'ปฏิทินงาน' }, // [ADDED] เพิ่มเมนูปฏิทิน
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

// [MODIFIED] ปรับปรุงฟังก์ชันแปลงลิงก์: ใช้ lh3.googleusercontent.com/d/ เพื่อแก้ปัญหา Account Chooser และโหลดรูปได้โดยไม่ต้อง Login
const processImageUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  
  // ตรวจสอบว่าเป็นลิงก์ Google Drive หรือไม่
  if (url.includes('drive.google.com')) {
      let id = null;
      // พยายามดึง ID ออกมาจากรูปแบบต่างๆ
      if (url.includes('id=')) {
          const match = url.match(/id=([a-zA-Z0-9_-]+)/);
          if (match) id = match[1];
      } else if (url.includes('/d/')) { // กรณีลิงก์แบบ /file/d/XXX/view
          const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
          if (match) id = match[1];
      } else if (url.includes('uc?')) { // กรณีลิงก์แบบ uc?export=view&id=XXX
          const match = url.match(/id=([a-zA-Z0-9_-]+)/);
          if (match) id = match[1];
      }

      // [FIX] ใช้ lh3.googleusercontent.com/d/ID เป็น Direct CDN Link
      // ลิงก์นี้จะข้ามหน้า Login ของ Google และแสดงรูปได้เลยสำหรับไฟล์สาธารณะ
      if (id) {
          return `https://lh3.googleusercontent.com/d/${id}`;
      }
  }
  return url;
};

// [ADDED] Helper to extract File ID for deletion
const getFileId = (url) => {
  if (!url) return null;
  const match = url.match(/id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
};

// [MOVED] StoreIcon moved here to be defined before usage
const StoreIcon = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7"/>
    </svg>
);

// [MODIFIED] Line Icon (New SVG Layout - Adaptable Theme Color)
const LineIcon = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className={className}>
        <path d="M64 27.487c0-14.32-14.355-25.97-32-25.97S0 13.168 0 27.487c0 12.837 11.384 23.588 26.762 25.62 1.042.225 2.46.688 2.82 1.578.322.81.21 2.076.103 2.894l-.457 2.74c-.14.81-.643 3.164 2.772 1.725s18.428-10.852 25.143-18.58h-.001C61.78 38.38 64 33.218 64 27.487" fill="currentColor"/>
        <g fill="#fff">
            <path d="M25.498 20.568h-2.245c-.344 0-.623.28-.623.623v13.943a.62.62 0 0 0 .623.62h2.245a.62.62 0 0 0 .623-.62V21.2c0-.343-.28-.623-.623-.623m15.45-.01h-2.244c-.345 0-.624.28-.624.623v8.284l-6.4-8.63c-.014-.022-.03-.043-.048-.063l-.004-.004a.4.4 0 0 0-.038-.038l-.044-.04c-.006-.004-.01-.008-.016-.012l-.032-.022-.02-.012-.033-.02c-.006-.002-.014-.006-.02-.01-.012-.006-.023-.012-.036-.016s-.014-.006-.02-.006c-.012-.006-.025-.008-.037-.012l-.022-.006c-.012-.002-.023-.006-.035-.008l-.026-.004c-.008-.002-.022-.004-.033-.004l-.032-.002c-.008 0-.014-.001-.022-.001h-2.244c-.344 0-.623.28-.623.623V35.13a.62.62 0 0 0 .623.62h2.244c.344 0 .624-.278.624-.62v-8.28l6.397 8.64a.63.63 0 0 0 .158.154c.018.014.032.022.045.03.006.004.012.008.018.01s.02.01.03.014.02.008.03.014l.06.022a.62.62 0 0 0 .168.022h2.244a.62.62 0 0 0 .623-.62V21.2c0-.343-.28-.623-.623-.623"/><path d="M20.087 32.264h-6.1V21.2c0-.344-.28-.623-.623-.623H11.12c-.344 0-.623.28-.623.623v13.942a.62.62 0 0 0 .174.431c.012.012.014.016.016.018.113.107.264.174.43.174h8.968c.344 0 .623-.28.623-.623v-2.245c0-.344-.278-.623-.623-.623m33.258-8.214c.344 0 .623-.28.623-.623V21.2c0-.344-.278-.623-.623-.623h-8.968c-.168 0-.32.067-.432.176-.012.01-.016.014-.018.018-.107.1-.173.262-.173.43v13.943a.62.62 0 0 0 .174.431l.016.016a.62.62 0 0 0 .431.174h8.968c.344 0 .623-.28.623-.623v-2.246c0-.344-.278-.623-.623-.623h-6.098v-2.357h6.098a.62.62 0 0 0 .623-.623V27.04c0-.344-.278-.624-.623-.624h-6.098V24.06h6.098z"/>
        </g>
    </svg>
);

// [ADDED] X (Twitter) Icon
const XIcon = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
);

// [MODIFIED] WeChat Icon (Official Shape from User)
const WeChatIcon = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" fill="currentColor" className={className}>
        <path d="M200.803 111.88c-24.213 1.265-45.268 8.605-62.362 25.188-17.271 16.754-25.155 37.284-23 62.734-9.464-1.172-18.084-2.462-26.753-3.192-2.994-.252-6.547.106-9.083 1.537-8.418 4.75-16.488 10.113-26.053 16.092 1.755-7.938 2.891-14.889 4.902-21.575 1.479-4.914.794-7.649-3.733-10.849-29.066-20.521-41.318-51.232-32.149-82.85 8.483-29.25 29.315-46.989 57.621-56.236 38.635-12.62 82.054.253 105.547 30.927 8.485 11.08 13.688 23.516 15.063 38.224zm-111.437-9.852c.223-5.783-4.788-10.993-10.74-11.167-6.094-.179-11.106 4.478-11.284 10.483-.18 6.086 4.475 10.963 10.613 11.119 6.085.154 11.186-4.509 11.411-10.435zm58.141-11.171c-5.974.11-11.022 5.198-10.916 11.004.109 6.018 5.061 10.726 11.204 10.652 6.159-.074 10.83-4.832 10.772-10.977-.051-6.032-4.981-10.79-11.06-10.679z"/>
        <path d="M255.201 262.83c-7.667-3.414-14.7-8.536-22.188-9.318-7.459-.779-15.3 3.524-23.104 4.322-23.771 2.432-45.067-4.193-62.627-20.432-33.397-30.89-28.625-78.254 10.014-103.568 34.341-22.498 84.704-14.998 108.916 16.219 21.129 27.24 18.646 63.4-7.148 86.284-7.464 6.623-10.15 12.073-5.361 20.804.884 1.612.985 3.653 1.498 5.689zm-87.274-84.499c4.881.005 8.9-3.815 9.085-8.636.195-5.104-3.91-9.385-9.021-9.406-5.06-.023-9.299 4.318-9.123 9.346.166 4.804 4.213 8.69 9.059 8.696zm56.261-18.022c-4.736-.033-8.76 3.844-8.953 8.629-.205 5.117 3.772 9.319 8.836 9.332 4.898.016 8.768-3.688 8.946-8.562.19-5.129-3.789-9.364-8.829-9.399z"/>
    </svg>
);

// [MODIFIED] Telegram Icon (SVG Version for Theme Coloring)
const TelegramIcon = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/>
    </svg>
);

const generateTrackingToken = (id, dateStr) => {
  if (!id || !dateStr) return id;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return id;
  
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear() + 543;
  const HH = String(d.getHours()).padStart(2, '0');
  const mn = String(d.getMinutes()).padStart(2, '0');
  
  return `${id}${dd}${mm}${yyyy}${HH}${mn}`;
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

// [NEW] Shop Footer Component (Compact & Centered 100px Height, Adjustable Width)
const ShopFooter = ({ shopInfo, maxWidthClass = "max-w-7xl" }) => {
  if (!shopInfo) return null;

  return (
    <footer className="bg-white border-t border-slate-200 mt-auto pb-safe w-full">
      <div className={`${maxWidthClass} mx-auto px-4 w-full h-auto md:h-[100px] flex flex-col md:flex-row items-center justify-between gap-2 py-3 md:py-0`}>
          {/* Left: Brand & Contact Info */}
          <div className="flex flex-row flex-wrap items-center justify-center md:justify-start md:flex-col md:items-start gap-x-4 gap-y-1">
              <div className="flex items-center gap-3 text-slate-700">
                  {/* [MODIFIED] Display Logo: Size 36x36px (w-9 h-9) as requested */}
                  <div className="shrink-0 w-9 h-9 rounded-md overflow-hidden flex items-center justify-center relative">
                      {shopInfo.logo ? (
                          <img 
                            src={processImageUrl(shopInfo.logo)} 
                            alt="Shop Logo" 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                          />
                      ) : null}
                      
                      {/* Fallback Icon (Only visible if no logo or error) */}
                      <div className={`w-full h-full bg-slate-100 text-slate-400 flex items-center justify-center border border-slate-200 rounded-md ${shopInfo.logo ? 'hidden' : 'flex'}`}>
                          <StoreIcon className="w-5 h-5" />
                      </div>
                  </div>
                  <span className="text-sm font-bold text-slate-800">{shopInfo.shopName || 'ร้านค้า'}</span>
              </div>
              
              <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
                  {shopInfo.phone && (
                      <a href={`tel:${shopInfo.phone}`} className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors">
                          <Phone className="w-3.5 h-3.5" /> 
                          {shopInfo.phone}
                      </a>
                  )}
                  {shopInfo.email && (
                      <a href={`mailto:${shopInfo.email}`} className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors">
                          <Mail className="w-3.5 h-3.5" /> 
                          {shopInfo.email}
                      </a>
                  )}
              </div>
          </div>
          
          {/* Right: Socials & Address */}
          <div className="flex flex-col md:flex-col-reverse items-center md:items-end gap-1.5">
              {shopInfo.address && (
                  <p className="text-xs font-medium text-slate-500 text-center md:text-right leading-tight max-w-[300px] line-clamp-1">
                      {shopInfo.address}
                  </p>
              )}

              <div className="flex items-center gap-3">
                  {/* [MODIFIED] Use LineIcon instead of MessageCircle */}
                  {shopInfo.line && (
                      <a href={shopInfo.line} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-[#06C755] transition-all hover:scale-110">
                          <LineIcon className="w-5 h-5" />
                      </a>
                  )}
                  {shopInfo.facebook && (
                      <a href={shopInfo.facebook} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-[#1877F2] transition-all hover:scale-110">
                          <Facebook className="w-5 h-5 fill-current" />
                      </a>
                  )}
                  {shopInfo.instagram && (
                      <a href={shopInfo.instagram} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-[#C13584] transition-all hover:scale-110">
                          <Instagram className="w-5 h-5" />
                      </a>
                  )}
                  {shopInfo.tiktok && (
                      <a href={shopInfo.tiktok} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-black transition-all hover:scale-110">
                          <Music2 className="w-5 h-5" />
                      </a>
                  )}
                  {/* [ADDED] Twitter (X) & WeChat Icons in Footer */}
                  {shopInfo.twitter && (
                      <a href={shopInfo.twitter} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-black transition-all hover:scale-110">
                          <XIcon className="w-4 h-4" />
                      </a>
                  )}
                  {shopInfo.wechat && (
                      <a href={shopInfo.wechat} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-[#07C160] transition-all hover:scale-110">
                          <WeChatIcon className="w-5 h-5" />
                      </a>
                  )}
                  {/* [ADDED] Telegram Icon in Footer */}
                  {shopInfo.telegram && (
                      <a href={shopInfo.telegram} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-[#0088cc] transition-all hover:scale-110">
                          <TelegramIcon className="w-5 h-5" />
                      </a>
                  )}
              </div>
          </div>
      </div>
    </footer>
  );
};

// [UPDATED COMPONENT] Calendar View Implementation - Fixed Errors & Logic
// [MODIFIED] Added dealStatuses and transportStatuses props
const CalendarView = ({ activities, onEventClick, onDayClick, dealStatuses = [], transportStatuses = [] }) => {
  const [viewDate, setViewDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month'); // 'month', 'week', 'day', 'list'
  const [selectedDayDetails, setSelectedDayDetails] = useState(null); // Data for modal
  
  const monthsTH = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
  // [FIX] Added missing monthsShortTH definition
  const monthsShortTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const daysTH = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  const daysShortTH = ['อา','จ','อ','พ','พฤ','ศ','ส'];

  // [ADDED] Helper to resolve status for Calendar
  const resolveStatus = (value, list) => {
      const found = list.find(s => s.value === value);
      if (found) return { label: found.label, color: found.color, type: found.type };
      
      const sys = systemStatusTypes.find(s => s.value === value);
      if (sys) return { label: sys.label, color: sys.color, type: sys.value };

      return { label: value || '-', color: 'bg-slate-100 text-slate-500 border-slate-200' };
  };

  const changePeriod = (offset) => {
    const newDate = new Date(viewDate);
    if (viewMode === 'month') {
        newDate.setMonth(newDate.getMonth() + offset);
    } else if (viewMode === 'week' || viewMode === 'list') {
        newDate.setDate(newDate.getDate() + (offset * 7));
    } else if (viewMode === 'day') {
        newDate.setDate(newDate.getDate() + offset);
    }
    setViewDate(newDate);
  };

  const isToday = (dateObj) => {
    const today = new Date();
    return dateObj.getDate() === today.getDate() && 
           dateObj.getMonth() === today.getMonth() && 
           dateObj.getFullYear() === today.getFullYear();
  };

  // [OPTIMIZATION] Group events by day using rawDeliveryStart
  const eventsMap = useMemo(() => {
    const map = {};
    activities.forEach(item => {
        // Requirement 4: Use rawDeliveryStart (Delivery Start Date) -> fallback to rawDateTime
        const dateStr = item.rawDeliveryStart || item.rawDeliveryDateTime || item.rawDateTime;
        if(!dateStr) return;
        
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return;

        // Key "YYYY-M-D"
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (!map[key]) map[key] = [];
        map[key].push(item);
    });
    
    // Sort by time within each day
    Object.keys(map).forEach(key => {
        map[key].sort((a, b) => {
            const dateA = new Date(a.rawDeliveryStart || a.rawDateTime);
            const dateB = new Date(b.rawDeliveryStart || b.rawDateTime);
            return dateA - dateB;
        });
    });
    
    return map;
  }, [activities]);

  const getEventsForDate = (dateObj) => {
    const key = `${dateObj.getFullYear()}-${dateObj.getMonth()}-${dateObj.getDate()}`;
    return eventsMap[key] || [];
  };

  // --- Render Helpers ---
  const renderEventItem = (ev, idx) => {
     // [MODIFIED] Removed duplicate declarations and legacy logic. 
     // Now resolving status first to get the correct type/color.

     const timeStr = ev.rawDeliveryStart 
        ? new Date(ev.rawDeliveryStart).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})
        : (ev.rawDateTime ? new Date(ev.rawDateTime).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'}) : '');

     // Requirement 2: Format "Time ProjectName (ArtistName)"
     const displayText = `${timeStr ? timeStr + ' ' : ''}${ev.name} (${ev.artist || '-'})`;

     // [MODIFIED] Use dynamic color for event item in month/week view
     const statusInfo = resolveStatus(ev.dealStatus, dealStatuses);
     
     // Override small view colors based on status type for better visibility
     let itemColor = 'bg-slate-50 border-slate-200 text-slate-600';
     let dotColor = 'bg-slate-400';

     // Map status info color classes to simpler logic for small calendar items
     const sType = statusInfo.type || ev.dealStatus;
     
     if (sType === 'confirmed' || sType === 'active') {
         itemColor = 'bg-blue-50 border-blue-100 text-blue-700';
         dotColor = 'bg-blue-500';
     } else if (sType === 'completed') {
         itemColor = 'bg-emerald-50 border-emerald-100 text-emerald-700';
         dotColor = 'bg-emerald-500';
     } else if (sType === 'cancelled') {
         itemColor = 'bg-rose-50 border-rose-100 text-rose-700';
         dotColor = 'bg-rose-500';
     } else if (sType === 'pending') {
         itemColor = 'bg-amber-50 border-amber-100 text-amber-700';
         dotColor = 'bg-amber-500';
     }

     return (
       <button 
          key={idx} 
          onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
          // [MODIFIED] Ultra compact for mobile (8px font, tighter tracking, hidden dot)
          className={`text-[8px] sm:text-xs text-left px-0.5 py-0.5 sm:px-2 sm:py-1 rounded-[3px] sm:rounded-md border truncate transition-all w-full mb-0.5 sm:mb-1 flex items-center gap-0.5 sm:gap-1 shrink-0 h-auto min-h-[16px] sm:min-h-[26px] ${itemColor} leading-none`}
          title={`${timeStr} ${ev.name} (${ev.artist})`}
       >
          <div className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full shrink-0 ${dotColor} hidden sm:block`}></div>
          <span className="truncate font-medium tracking-tighter">{displayText}</span>
       </button>
     );
  };

  // --- Views ---
  const renderMonthView = () => {
      const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
      const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
      
      return (
        <div className="flex-1 bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full relative">
            <div className="overflow-x-auto flex-1 flex flex-col custom-scrollbar">
                {/* [MODIFIED] Removed min-width to allow squeezing on mobile (Fit to screen) */}
                <div className="w-full flex flex-col flex-1 h-full">
                    <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50 shrink-0">
                        {daysShortTH.map((d, i) => (
                            <div key={d} className={`py-2 sm:py-3 text-center text-[10px] sm:text-sm font-bold ${i===0 || i===6 ? 'text-rose-500' : 'text-slate-500'}`}>{d}</div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 flex-1 auto-rows-fr bg-slate-50/10 overflow-y-auto">
                        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                            <div key={`empty-${i}`} className="border-b border-r border-slate-100 bg-slate-50/20 min-h-[50px] sm:min-h-[140px]"></div>
                        ))}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const currentDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
                            const events = getEventsForDate(currentDate);
                            const isCurrent = isToday(currentDate);
                            
                            return (
                                <div 
                                    key={day} 
                                    onClick={() => setSelectedDayDetails({ date: currentDate, events })}
                                    // [MODIFIED] Reduced min-height and padding for mobile
                                    className={`border-b border-r border-slate-100 p-0.5 sm:p-2 flex flex-col gap-0.5 sm:gap-1 transition-colors hover:bg-indigo-50/30 group min-h-[50px] sm:min-h-[140px] relative cursor-pointer ${isCurrent ? 'bg-indigo-50/20' : 'bg-white'}`}
                                >
                                    <div className="flex justify-between items-start p-0.5 sm:p-1">
                                        <span className={`text-[10px] sm:text-sm font-bold w-4 h-4 sm:w-7 sm:h-7 flex items-center justify-center rounded-full ${isCurrent ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-700'}`}>
                                            {day}
                                        </span>
                                        {events.length > 0 && <span className="text-[8px] sm:text-[10px] font-bold text-slate-400 bg-slate-100 px-1 sm:px-1.5 rounded-full border border-slate-200">+{events.length}</span>}
                                    </div>
                                    <div className="flex-1 flex flex-col gap-0.5 overflow-y-auto custom-scrollbar mt-0.5 sm:mt-1 px-0 max-h-[80px] sm:max-h-[140px]">
                                        {events.map((ev, idx) => renderEventItem(ev, idx))}
                                    </div>
                                </div>
                            );
                        })}
                        {Array.from({ length: (7 - ((firstDayOfMonth + daysInMonth) % 7)) % 7 }).map((_, i) => (
                            <div key={`end-empty-${i}`} className="border-b border-r border-slate-100 bg-slate-50/20"></div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      );
  };

  const renderWeekView = () => {
      const startOfWeek = new Date(viewDate);
      startOfWeek.setDate(viewDate.getDate() - viewDate.getDay());
      const days = Array.from({length: 7}, (_, i) => {
          const d = new Date(startOfWeek);
          d.setDate(startOfWeek.getDate() + i);
          return d;
      });

      // [MODIFIED] Added horizontal scroll wrapper for mobile
      return (
        <div className="flex-1 bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full relative">
             <div className="overflow-x-auto flex-1 flex flex-col custom-scrollbar">
                 {/* Container with min-width to force horizontal scroll on small screens */}
                 <div className="min-w-[1000px] md:min-w-0 flex flex-col flex-1 h-full">
                     {/* Header Row */}
                     <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50 shrink-0">
                        {days.map((d, i) => {
                            const isCurrent = isToday(d);
                            return (
                                <div key={i} className={`py-3 text-center border-r border-slate-100 last:border-0 ${i===0||i===6?'text-rose-500':'text-slate-600'}`}>
                                    <div className="text-xs font-bold opacity-70">{daysShortTH[i]}</div>
                                    <div className={`text-lg font-black ${isCurrent ? 'text-indigo-600' : ''}`}>{d.getDate()}</div>
                                </div>
                            );
                        })}
                     </div>
                     
                     {/* Content Row */}
                     <div className="grid grid-cols-7 flex-1 overflow-y-auto bg-white divide-x divide-slate-100">
                         {days.map((d, i) => {
                             const events = getEventsForDate(d);
                             const isCurrent = isToday(d);
                             return (
                                 <div 
                                    key={i} 
                                    onClick={() => setSelectedDayDetails({ date: d, events })}
                                    className={`p-2 flex flex-col gap-1 min-h-[300px] hover:bg-slate-50 cursor-pointer overflow-y-auto custom-scrollbar ${isCurrent ? 'bg-indigo-50/10' : ''}`}
                                 >
                                     {events.map((ev, idx) => renderEventItem(ev, idx))}
                                 </div>
                             );
                         })}
                     </div>
                 </div>
             </div>
             {/* Hint for mobile scroll */}
             <div className="md:hidden absolute bottom-2 right-4 bg-black/20 text-white text-[10px] px-2 py-1 rounded-full pointer-events-none backdrop-blur-sm animate-pulse">
                เลื่อนซ้าย-ขวา เพื่อดูเพิ่มเติม
             </div>
        </div>
      );
  };

  const renderDayView = () => {
      const events = getEventsForDate(viewDate);
      const isCurrentDay = isToday(viewDate);
      
      return (
          <div className="flex-1 bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col p-6">
              <div className="flex items-center gap-3 mb-6">
                  <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center border shadow-sm ${isCurrentDay ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-indigo-100 text-indigo-600 border-indigo-200'}`}>
                      <span className="text-[10px] font-bold uppercase">{daysShortTH[viewDate.getDay()]}</span>
                      <span className="text-xl font-black leading-none">{viewDate.getDate()}</span>
                  </div>
                  <div>
                      <h3 className="text-xl font-bold text-slate-900">{daysTH[viewDate.getDay()]}ที่ {viewDate.getDate()} {monthsTH[viewDate.getMonth()]} {viewDate.getFullYear()+543}</h3>
                      <p className="text-slate-500 text-sm font-medium">{events.length} รายการ</p>
                  </div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                  {events.length > 0 ? events.map((ev, idx) => {
                      // [MODIFIED] Resolve Status for Day View List
                      const statusInfo = resolveStatus(ev.dealStatus, dealStatuses);
                      return (
                      <div key={idx} onClick={() => onEventClick(ev)} className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer bg-white group">
                          {/* [MODIFIED] Show ID above Time in Day View List - Match Table UI (No border/shadow) */}
                          <div className="w-20 text-center shrink-0 flex flex-col items-center gap-1">
                              <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg text-xs w-fit whitespace-nowrap">
                                  {ev.id}
                              </span>
                              <span className="text-sm font-black text-slate-700 block">
                                  {ev.rawDeliveryStart ? new Date(ev.rawDeliveryStart).toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'}) : '-'}
                              </span>
                          </div>
                          <div className="w-1 h-10 bg-slate-200 rounded-full group-hover:bg-indigo-500 transition-colors"></div>
                          <div className="flex-1 min-w-0">
                              <div className="flex justify-between">
                                  <h4 className="font-bold text-slate-800 truncate">{ev.name}</h4>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusInfo.color}`}>
                                      {statusInfo.label}
                                  </span>
                              </div>
                              <p className="text-sm text-slate-500 truncate flex items-center gap-1">
                                  <User className="w-3 h-3" /> {ev.artist} 
                                  <span className="text-slate-300">|</span> 
                                  <Briefcase className="w-3 h-3" /> {ev.customer}
                              </p>
                          </div>
                      </div>
                  )}) : (
                      <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                          <Calendar className="w-10 h-10 mb-2 opacity-20" />
                          <p>ไม่มีรายการในวันนี้</p>
                      </div>
                  )}
              </div>
          </div>
      );
  };

  const renderListView = () => {
      const startOfWeek = new Date(viewDate);
      startOfWeek.setDate(viewDate.getDate() - viewDate.getDay());
      const days = Array.from({length: 7}, (_, i) => {
          const d = new Date(startOfWeek);
          d.setDate(startOfWeek.getDate() + i);
          return d;
      });

      return (
          <div className="flex-1 bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col p-4 sm:p-6 overflow-y-auto custom-scrollbar">
              <h3 className="font-bold text-slate-800 mb-4 px-2 flex items-center gap-2">
                  <List className="w-5 h-5 text-indigo-600" /> 
                  รายการประจำสัปดาห์
              </h3>
              <div className="space-y-6">
                  {days.map((d, dayIdx) => {
                      const events = getEventsForDate(d);
                      const isCurrent = isToday(d);
                      
                      return (
                          <div key={dayIdx} className="space-y-2">
                              <div className={`sticky top-0 z-10 px-3 py-2 rounded-lg flex items-center gap-2 border-l-4 ${isCurrent ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-slate-50 border-slate-300 text-slate-600'}`}>
                                  <span className="font-black w-6 text-right">{d.getDate()}</span>
                                  <span className="font-bold text-sm uppercase">{daysTH[d.getDay()]}</span>
                                  <div className="h-px bg-current opacity-10 flex-1 ml-2"></div>
                              </div>
                              <div className="pl-4 space-y-2">
                                  {events.length > 0 ? events.map((ev, idx) => (
                                      <div key={idx} onClick={() => onEventClick(ev)} className="bg-white border border-slate-100 p-3 rounded-xl hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer flex gap-3">
                                          {/* [MODIFIED] Match Table ID UI in List View (No border/shadow) */}
                                          <div className="text-xs font-bold text-slate-500 pt-1 w-20 shrink-0 flex flex-col items-center gap-1">
                                              <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg text-xs w-fit whitespace-nowrap">
                                                  {ev.id}
                                              </span>
                                              <span>{ev.rawDeliveryStart ? new Date(ev.rawDeliveryStart).toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'}) : '-'}</span>
                                          </div>
                                          <div className="flex-1 min-w-0">
                                              <div className="flex justify-between items-start">
                                                  <span className="font-bold text-slate-800 text-sm truncate">{ev.name}</span>
                                                  <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 whitespace-nowrap">{ev.category}</span>
                                              </div>
                                              <div className="text-xs text-slate-500 mt-0.5 truncate">
                                                  <span className="font-medium text-indigo-600">{ev.artist}</span> • {ev.customer}
                                              </div>
                                          </div>
                                      </div>
                                  )) : <div className="text-xs text-slate-300 pl-2 italic">ไม่มีรายการ</div>}
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      );
  };

  // --- Requirement 3: Day Details Modal (Using Portal for better z-index management) ---
  const renderDayDetailsModal = () => {
      if (!selectedDayDetails) return null;
      const { date, events } = selectedDayDetails;

      return createPortal(
        <div className="fixed inset-0 z-[55] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedDayDetails(null)} />
            <div className="bg-white w-full max-w-5xl rounded-[2rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex flex-col items-center justify-center border border-indigo-100">
                            <span className="text-[10px] font-bold uppercase">{daysShortTH[date.getDay()]}</span>
                            <span className="text-xl font-black leading-none">{date.getDate()}</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-900">รายการประจำวัน</h3>
                            <p className="text-slate-500 text-sm font-medium">{daysTH[date.getDay()]}ที่ {date.getDate()} {monthsTH[date.getMonth()]} {date.getFullYear()+543}</p>
                        </div>
                    </div>
                    <button onClick={() => setSelectedDayDetails(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/50">
                    {events.length > 0 ? (
                        <>
                            {/* Desktop Table View */}
                            <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wide">
                                                <th className="p-4 font-bold w-[10%]">เวลา</th>
                                                <th className="p-4 font-bold w-[20%]">โปรเจค</th>
                                                <th className="p-4 font-bold w-[20%]">ศิลปิน/ลูกค้า</th>
                                                <th className="p-4 font-bold w-[20%]">ผู้รับ</th>
                                                <th className="p-4 font-bold w-[15%]">สถานะ</th>
                                                <th className="p-4 font-bold w-[15%] text-right">ยอดเงิน</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {events.map((item, i) => {
                                                const time = item.rawDeliveryStart ? new Date(item.rawDeliveryStart).toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'}) : '-';
                                                // [MODIFIED] Resolve Status for Modal Table
                                                const statusInfo = resolveStatus(item.dealStatus, dealStatuses);
                                                
                                                return (
                                                    <tr key={i} onClick={() => onEventClick(item)} className="hover:bg-indigo-50/30 cursor-pointer transition-colors group">
                                                        {/* [MODIFIED] Match Table ID UI in Details Modal Table (No border/shadow) */}
                                                        <td className="p-4 font-bold text-slate-700 whitespace-nowrap align-top">
                                                            <div className="flex flex-col gap-1">
                                                                <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg text-xs w-fit whitespace-nowrap">
                                                                    {item.id}
                                                                </span>
                                                                <span className="mt-1">{time}</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4 align-top">
                                                            <div className="font-bold text-slate-900">{item.name}</div>
                                                            <div className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded w-fit mt-1">{item.category}</div>
                                                        </td>
                                                        <td className="p-4 align-top">
                                                            <div className="text-sm font-bold text-indigo-600">{item.artist}</div>
                                                            <div className="text-xs text-slate-500">{item.customer}</div>
                                                        </td>
                                                        <td className="p-4 align-top">
                                                            <div className="text-sm font-bold text-slate-700">{item.recipient || '-'}</div>
                                                            {item.recipientPhone && (
                                                                <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                                                    <Phone className="w-3 h-3" /> {item.recipientPhone}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="p-4 align-top">
                                                            <span className={`text-[10px] font-bold px-2 py-1 rounded-md border inline-flex items-center gap-1 ${statusInfo.color}`}>
                                                                <div className={`w-1.5 h-1.5 rounded-full ${statusInfo.type === 'confirmed' || statusInfo.type === 'completed' ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                                                                {statusInfo.label}
                                                            </span>
                                                        </td>
                                                        <td className="p-4 align-top text-right font-bold text-slate-800">
                                                            {parseFloat(item.wage || 0).toLocaleString()}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Mobile Card View */}
                            <div className="md:hidden space-y-3">
                                {events.map((item, i) => {
                                    const time = item.rawDeliveryStart ? new Date(item.rawDeliveryStart).toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'}) : '-';
                                    // [MODIFIED] Resolve Status for Mobile Card in Modal
                                    const statusInfo = resolveStatus(item.dealStatus, dealStatuses);

                                    return (
                                        <div key={i} onClick={() => onEventClick(item)} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3 active:scale-95 transition-transform">
                                            {/* [MODIFIED] Match Table ID UI in Mobile Card Header (No border/shadow) */}
                                            <div className="flex justify-between items-start">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg text-xs w-fit whitespace-nowrap">{item.id}</span>
                                                    <div className="flex items-center gap-1">
                                                         <Clock className="w-3 h-3 text-slate-400" />
                                                         <span className="text-xs font-bold text-slate-500">{time} น.</span>
                                                    </div>
                                                </div>
                                                <span className={`text-[10px] font-bold px-2 py-1 rounded-md border inline-flex items-center gap-1 ${statusInfo.color}`}>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${statusInfo.type === 'confirmed' || statusInfo.type === 'completed' ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                                                    {statusInfo.label}
                                                </span>
                                            </div>
                                            
                                            <div>
                                                <h4 className="font-bold text-slate-900 text-sm line-clamp-2">{item.name}</h4>
                                                <div className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded w-fit mt-1">{item.category}</div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100">
                                                <div>
                                                    <p className="text-[10px] text-slate-400">ศิลปิน</p>
                                                    <p className="font-bold text-indigo-600 truncate">{item.artist}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-slate-400">ลูกค้า</p>
                                                    <p className="truncate">{item.customer}</p>
                                                </div>
                                                <div className="col-span-2 pt-1 border-t border-slate-200 mt-1">
                                                    <p className="text-[10px] text-slate-400">ผู้รับ</p>
                                                    <div className="flex items-center gap-1">
                                                        <span className="truncate font-medium">{item.recipient || '-'}</span>
                                                        {item.recipientPhone && <span className="text-slate-400 text-[10px]">({item.recipientPhone})</span>}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                                                <span className="text-xs font-bold text-slate-400">ยอดเงิน</span>
                                                <span className="text-sm font-black text-slate-800">฿{parseFloat(item.wage || 0).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <div className="p-4 bg-white rounded-full shadow-sm mb-3">
                                <Calendar className="w-8 h-8 text-slate-300" />
                            </div>
                            <p className="font-bold">ไม่มีรายการงานในวันนี้</p>
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-slate-100 bg-white flex justify-end">
                    <button onClick={() => setSelectedDayDetails(null)} className="px-6 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition">
                        ปิด
                    </button>
                </div>
            </div>
        </div>,
        document.body
      );
  };

  const getTitle = () => {
      if (viewMode === 'month') return `${monthsTH[viewDate.getMonth()]} ${viewDate.getFullYear() + 543}`;
      if (viewMode === 'day') return `${viewDate.getDate()} ${monthsTH[viewDate.getMonth()]} ${viewDate.getFullYear() + 543}`;
      if (viewMode === 'week' || viewMode === 'list') {
          const start = new Date(viewDate);
          start.setDate(start.getDate() - start.getDay());
          const end = new Date(start);
          end.setDate(end.getDate() + 6);
          if (start.getMonth() === end.getMonth()) {
              return `${start.getDate()} - ${end.getDate()} ${monthsTH[start.getMonth()]} ${start.getFullYear() + 543}`;
          } else {
              return `${start.getDate()} ${monthsShortTH[start.getMonth()]} - ${end.getDate()} ${monthsShortTH[end.getMonth()]} ${end.getFullYear() + 543}`;
          }
      }
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 px-4 sm:px-8 lg:px-10 pt-6 pb-24 md:pb-6 h-full flex flex-col">
       {/* Requirement 3: Day Details Modal */}
       {renderDayDetailsModal()}

       {/* [MODIFIED] Reorganized Header for Better Mobile Layout */}
       <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-2">
          {/* Title Section */}
          <div className="w-full xl:w-auto">
             <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">ปฏิทินงาน</h2>
             <p className="text-slate-500 mt-1 text-sm font-medium">
                 {viewMode === 'list' 
                    ? `รายการสัปดาห์ของ ${monthsTH[viewDate.getMonth()]} ${viewDate.getFullYear() + 543}` 
                    : `ภาพรวม ${monthsTH[viewDate.getMonth()]} ${viewDate.getFullYear() + 543}`
                 }
             </p>
          </div>
          
          {/* Controls Section (Date & View Switcher) */}
          <div className="flex flex-col gap-3 w-full xl:w-auto xl:flex-row xl:items-center">
             {/* View Switcher - Grid layout on mobile for even spacing - MOVED UP */}
             <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-xl w-full xl:w-auto xl:flex">
                 {[
                     { id: 'month', label: 'เดือน', icon: Calendar },
                     { id: 'week', label: 'สัปดาห์', icon: TableIcon },
                     { id: 'day', label: 'วัน', icon: CalendarDays },
                     { id: 'list', label: 'รายการ', icon: LayoutList },
                 ].map(mode => (
                     <button
                        key={mode.id}
                        onClick={() => setViewMode(mode.id)}
                        className={`px-2 py-2 sm:px-3 sm:py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                            viewMode === mode.id 
                            ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' 
                            : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                        }`}
                     >
                         <mode.icon className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                         <span className="hidden sm:inline">{mode.label}</span>
                     </button>
                 ))}
             </div>

             {/* Date Navigation - Full width on mobile - MOVED DOWN */}
             <div className="flex items-center justify-between bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-full xl:w-auto">
                <button onClick={() => changePeriod(-1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition"><ChevronLeft className="w-5 h-5"/></button>
                <span className="text-sm font-bold text-slate-700 min-w-[120px] text-center select-none truncate px-2 flex-1">
                    {getTitle()}
                </span>
                <div className="flex items-center">
                    <button onClick={() => changePeriod(1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition"><ChevronRight className="w-5 h-5"/></button>
                    <div className="w-px h-6 bg-slate-100 mx-1"></div>
                    <button onClick={() => setViewDate(new Date())} className="ml-1 mr-1 px-3 py-1.5 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-lg hover:bg-indigo-100 transition whitespace-nowrap">วันนี้</button>
                </div>
             </div>
          </div>
       </div>

       {viewMode === 'month' && renderMonthView()}
       {viewMode === 'week' && renderWeekView()}
       {viewMode === 'day' && renderDayView()}
       {viewMode === 'list' && renderListView()}
    </div>
  );
};

// --- Customer Quotation View (New Component) ---
// [MODIFIED] Added dealStatuses prop to resolve custom status labels
const CustomerQuotationView = ({ data, shopInfo, dealStatuses = [] }) => {
  const [previewImage, setPreviewImage] = useState(null);

  // [ADDED] Set Document Title dynamically
  useEffect(() => {
      const title = shopInfo?.shopName ? `ใบเสนอราคา - ${shopInfo.shopName}` : 'ใบเสนอราคา';
      document.title = title;
  }, [shopInfo]);

  if (!data) return null;

  // [ADDED] Helper to resolve status type and label from value (Same as TrackingView)
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

  // [MODIFIED] Use resolveStatus instead of finding directly to handle custom IDs correctly
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
              {/* Row 3: Financial Summary Card (Same as Modal) */}
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

                  {/* Net Total - Adjusted padding/size for PC */}
                  <div className="pt-4 border-t-2 border-slate-200 flex flex-col items-end bg-slate-100/50 -mx-5 -mb-5 p-5 rounded-b-2xl md:p-6 md:-mx-8 md:-mb-8 md:rounded-b-[2rem]">
                      <span className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">ยอดเรียกเก็บสุทธิ</span>
                      <span className="text-3xl font-black text-indigo-600 leading-none tabular-nums">฿{netReceivable.toLocaleString()}</span>
                  </div>
              </div>
          </div>

          {/* Shop Contact Card Removed */}
       </div>

       {/* Footer Section */}
       <ShopFooter shopInfo={shopInfo} maxWidthClass="max-w-5xl" />
    </div>
  );
};

// --- Customer Tracking View ---
// [MODIFIED] Added dealStatuses and transportStatuses props to resolve custom status labels/types
const CustomerTrackingView = ({ data, shopInfo, dealStatuses = [], transportStatuses = [] }) => {
  const [previewImage, setPreviewImage] = useState(null); 

  // [ADDED] Set Document Title dynamically
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

      // Fallback if nothing matches (fixes "custom-..." showing up)
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

      // --- Deal Status Controls Step 1 & 2 ---

      // Step 1: รับเรื่อง (Deal)
      if (stepId === 1) {
          if (dType === 'declined') return { status: 'declined', text: 'ปฏิเสธ', colorClass: 'bg-white text-slate-400 border-2 border-slate-200', icon: XCircle };
          
          // Pending -> รอดำเนินการ (สีระบบ/Indigo)
          if (dType === 'pending') return { status: 'pending', text: 'รอดำเนินการ', colorClass: 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200 ring-4 ring-indigo-50', icon: Clipboard };
          
          // Active/Completed -> รับเรื่อง (เขียว)
          if (dType === 'active' || dType === 'completed') return { status: 'completed', text: 'รับเรื่อง', colorClass: 'bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-200', icon: CheckCircle };
          
          return { status: 'wait', text: 'รอ', colorClass: 'bg-white text-slate-300 border-2 border-slate-200', icon: Clipboard };
      }

      // Step 2: ดำเนินการ (Deal)
      if (stepId === 2) {
          if (dType === 'declined' || dType === 'pending') return { status: 'wait', text: '-', colorClass: 'bg-white text-slate-200 border-2 border-slate-100', icon: Activity };
          
          // Active -> ดำเนินการ (เปลี่ยนจากเทาเป็นสีระบบ/Indigo)
          if (dType === 'active') return { status: 'current', text: 'ดำเนินการ', colorClass: 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200 ring-4 ring-indigo-50', icon: Loader2 };
          
          // Completed -> งานเสร็จสิ้น (เขียว)
          if (dType === 'completed') return { status: 'completed', text: 'งานเสร็จสิ้น', colorClass: 'bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-200', icon: CheckCircle };
          
          return { status: 'wait', text: 'รอ', colorClass: 'bg-white text-slate-300 border-2 border-slate-200', icon: Activity };
      }

      // --- Transport Status Controls Step 3 & 4 ---

      // Step 3: จัดส่ง (Transport)
      if (stepId === 3) {
          // ถ้าดีลยังไม่เดินหน้า ขนส่งก็ยังไม่เริ่ม
          if (dType === 'pending' || dType === 'declined') return { status: 'wait', text: '-', colorClass: 'bg-white text-slate-200 border-2 border-slate-100', icon: Truck };

          // Pending -> รอจัดส่ง (สีเทา)
          if (tType === 'pending') return { status: 'pending', text: 'รอจัดส่ง', colorClass: 'bg-white text-slate-400 border-2 border-slate-300', icon: Truck };
          
          // Active -> กำลังจัดส่ง (เขียว)
          if (tType === 'active') return { status: 'current', text: 'กำลังจัดส่ง', colorClass: 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-200 ring-4 ring-emerald-50', icon: Truck };
          
          // Completed -> จัดส่งแล้ว (เขียว)
          if (tType === 'completed') return { status: 'completed', text: 'จัดส่งแล้ว', colorClass: 'bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-200', icon: CheckCircle };
          
          return { status: 'wait', text: '-', colorClass: 'bg-white text-slate-300 border-2 border-slate-200', icon: Truck };
      }

      // Step 4: เสร็จสิ้น (Transport)
      if (stepId === 4) {
          if (tType === 'pending' || dType === 'pending' || dType === 'declined') return { status: 'wait', text: '-', colorClass: 'bg-white text-slate-200 border-2 border-slate-100', icon: CheckCircle };

          // Active -> ใกล้ถึงที่หมาย (สีส้ม)
          if (tType === 'active') return { status: 'pending', text: 'ใกล้ถึงที่หมาย', colorClass: 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-200 ring-4 ring-orange-50', icon: MapPin };
          
          // Completed -> เสร็จสิ้น (เขียว)
          if (tType === 'completed') return { status: 'completed', text: 'เสร็จสิ้น', colorClass: 'bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-200', icon: CheckCircle };
          
          // [FIXED] เอาเงื่อนไข dType === 'completed' ออก เพื่อไม่ให้ดีลจบมาบังคับให้ขนส่งจบด้วย
          
          return { status: 'wait', text: '-', colorClass: 'bg-white text-slate-300 border-2 border-slate-200', icon: CheckCircle };
      }
  };

  const steps = [1, 2, 3, 4]; // Use IDs directly

  return (
    <div className="min-h-screen bg-slate-50 pb-safe font-sans flex flex-col">
       {/* Image Viewer Portal */}
       {previewImage && <ImageViewer src={processImageUrl(previewImage)} onClose={() => setPreviewImage(null)} />}

       {/* Compact Header - Adjusted padding/margin to prevent overlap */}
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
                        {/* Project Name */}
                        <h3 className="text-lg font-black text-slate-800 leading-tight line-clamp-2 md:text-2xl md:mb-1">{data.name}</h3>
                        
                        {/* ID & Status Badge - Added gap-y-2 and content-start for safer wrapping */}
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
                            {/* Zoom Icon Overlay */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                 <Maximize2 className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 drop-shadow-sm md:w-8 md:h-8" />
                            </div>
                        </div>
                    )}
                </div>

                {/* PC Separator */}
                <div className="hidden md:block w-px bg-slate-100 self-stretch mx-4"></div>

                <div className="h-px bg-slate-100 w-full md:hidden my-2" />

                {/* Timeline Section - Updated for better mobile layout (Grid based) */}
                <div className="px-0 md:flex-1 md:flex md:flex-col md:justify-center md:pt-4 w-full">
                   <div className="relative w-full pt-2 pb-1">
                        {/* Background Line - Positioned using percentages for better Grid alignment */}
                        <div className="absolute left-[12.5%] right-[12.5%] top-[18px] h-0.5 bg-slate-100 -z-10 rounded-full md:top-[24px] md:h-1"></div>

                        <div className="grid grid-cols-4 w-full">
                            {steps.map((stepId, idx) => {
                                const info = getStepInfo(stepId);
                                const StepIcon = info.icon;

                                return (
                                    <div key={stepId} className="flex flex-col items-center gap-3 relative group cursor-default">
                                        {/* Next Arrow (>) */}
                                        {idx < steps.length - 1 && (
                                            <div className="absolute top-[18px] -right-0 md:top-[24px] transform -translate-y-1/2 translate-x-1/2 z-0">
                                                <ChevronRight className="w-4 h-4 text-slate-300 md:w-5 md:h-5" />
                                            </div>
                                        )}

                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-500 z-10 ${info.colorClass} md:w-12 md:h-12`}>
                                            <StepIcon className={`w-4 h-4 md:w-6 md:h-6 ${info.status === 'current' ? 'animate-pulse' : ''}`} strokeWidth={info.status === 'current' ? 2.5 : 2} />
                                        </div>
                                        {/* Label - Adjusted font size for mobile */}
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
              {/* Row 2: Combined Info Card (Compact 2 Columns) */}
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

              {/* Shop Contact Card Removed */}
          </div>

       </div>

       {/* Footer Section */}
       <ShopFooter shopInfo={shopInfo} maxWidthClass="max-w-5xl" />
    </div>
  );
};

// [MODIFIED] Removed userProfile prop
const SharePreviewModal = ({ data, onClose, shopInfo }) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isLinkCopied, setIsLinkCopied] = useState(false); // New state for link copy
  const [isQuoteLinkCopied, setIsQuoteLinkCopied] = useState(false); // [NEW] state for quote link copy

  // คำนวณยอดต่างๆ เพื่อใช้แสดงผล
  const totalSupport = data.customerSupport ? data.customerSupport.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0) : 0;
  
  // ตรวจสอบว่ามีรายการ Quotation แบบละเอียดหรือไม่
  const hasQuotationItems = data.quotationItems && data.quotationItems.length > 0;
  
  const totalQuotation = hasQuotationItems
      ? data.quotationItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0) 
      : (parseFloat(data.wage) || 0);

  const netReceivable = totalSupport + totalQuotation;

  const handleCopyText = () => {
    // สร้างข้อความรายละเอียดเงินสนับสนุน (Money Order)
    let moneyOrderDetails = "";
    if (data.customerSupport && data.customerSupport.some(i => parseFloat(i.price) > 0)) {
        moneyOrderDetails += "\n💵 *เงินสนับสนุนศิลปิน (Money Order)*\n";
        data.customerSupport.filter(item => parseFloat(item.price) > 0).forEach(item => {
            const type = item.denomination >= 20 ? 'แบงค์' : 'เหรียญ';
            const unit = item.denomination >= 20 ? 'ใบ' : 'เหรียญ';
            moneyOrderDetails += `- ${type} ${item.denomination} (${item.quantity} ${unit}): ${parseFloat(item.price).toLocaleString()} บ.\n`;
        });
    }

    // [FIX] Added Logic for Quotation Details generation
    let quotationDetails = "";
    if (hasQuotationItems) {
        quotationDetails += "\n📄 *รายการเสนอราคา (Quotation)*\n";
        data.quotationItems.forEach(item => {
             quotationDetails += `- ${item.category ? `[${item.category}] ` : ''}${item.detail || '-'}: ${parseFloat(item.price).toLocaleString()} บ.\n`;
        });
    } else {
        // Fallback for legacy wage display
        if (parseFloat(data.wage) > 0) {
            quotationDetails += `\n📄 *ค่าบริการรวม:* ${parseFloat(data.wage).toLocaleString()} บ.\n`;
        }
    }

    // Fix for potential undefined error in renderDeliveryTime text extraction
    const deliveryElement = renderDeliveryTime(data);
    let deliveryText = '-';
    try {
        if (deliveryElement?.props?.children) {
            const children = deliveryElement.props.children;
            if (Array.isArray(children)) {
               // Assuming format <span>Start</span><span>End</span> in div
               deliveryText = children.map(c => c?.props?.children).filter(Boolean).join(' - ');
            } else {
               deliveryText = children;
            }
        }
    } catch(e) {
        deliveryText = data.deliveryDate || '-';
    }

    const text = `
📋 *รายละเอียดงาน (Job Summary)*
🆔 ${data.id}
📌 โครงการ: ${data.name}
📅 วันที่: ${formatDate(data.rawDateTime)}
🎭 ศิลปิน: ${data.artist}
👤 ลูกค้า: ${data.customer}

🚚 *การจัดส่ง & สถานที่*
⏰ กำหนดส่ง: ${deliveryText}
📍 สถานที่: ${data.location || '-'}
🗺️ แผนที่: ${data.mapLink || '-'}
📞 ผู้รับ: ${data.recipient || '-'} (${data.recipientPhone || '-'})
${moneyOrderDetails}${quotationDetails}
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
      // สร้าง Link โดยอิงจาก URL ปัจจุบัน และเพิ่ม Query Param ?tracking=TOKEN
      try {
        const urlObj = new URL(window.location.href);
        // [FIX] Use generateTrackingToken for secure link
        const secureToken = generateTrackingToken(data.id, data.rawDateTime);
        urlObj.searchParams.set('tracking', secureToken);
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

  // [NEW] Function to copy quotation link
  const handleCopyQuoteLink = () => {
      try {
        const urlObj = new URL(window.location.href);
        const secureToken = generateTrackingToken(data.id, data.rawDateTime);
        urlObj.searchParams.delete('tracking');
        urlObj.searchParams.set('quotation', secureToken);
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
            setIsQuoteLinkCopied(true);
            setTimeout(() => setIsQuoteLinkCopied(false), 2000);
        }
      } catch (err) {
          console.error('Unable to copy quotation link', err);
      }
  };

  const handlePrint = () => {
    // 1. Prepare Data & Calculations
    const sName = shopInfo?.shopName || 'ไม่ระบุชื่อร้านค้า';
    const sAddress = shopInfo?.address || '-';
    const sPhone = shopInfo?.phone || '-';
    const sEmail = shopInfo?.email || '-';
    const sTaxId = shopInfo?.taxId || '-'; 
    const sLogo = shopInfo?.logo ? processImageUrl(shopInfo.logo) : null;
    
    // Customer Info
    const cName = data.customer || 'ลูกค้าทั่วไป';
    // [MODIFIED] Use address from data instead of placeholder
    const cAddress = data.customerInfo?.address || '-'; 
    const cTaxId = data.customerInfo?.taxId || '-'; 
    const cPhone = data.customerInfo?.phone || '-';
    const cEmail = data.customerInfo?.email || '-';

    // Recipient & Delivery Info
    const rName = data.recipient || '-';
    const rPhone = data.recipientPhone || '-';
    const rLocation = data.location || '-';
    
    let rDate = data.deliveryDate;
    if (!rDate || rDate === '-') {
        if (data.rawDeliveryStart || data.rawDeliveryEnd || data.rawDeliveryDateTime) {
            const start = formatDate(data.rawDeliveryStart);
            const end = formatDate(data.rawDeliveryEnd || data.rawDeliveryDateTime);
            if (data.rawDeliveryStart && (data.rawDeliveryEnd || data.rawDeliveryDateTime)) {
                rDate = `${start} - ${end}`;
            } else {
                rDate = end || start;
            }
        } else {
            rDate = '-';
        }
    }

    // Prepare Items List
    const allItems = [];
    if (data.quotationItems) {
        data.quotationItems.forEach(item => {
            allItems.push({ ...item, type: 'quotation' });
        });
    }
    // Convert legacy wage if no items
    if (allItems.length === 0 && parseFloat(data.wage) > 0) {
        allItems.push({ category: '', detail: 'ค่าบริการรวม', price: data.wage, type: 'quotation' });
    }
    if (data.customerSupport) {
        data.customerSupport.forEach(item => {
            if (parseFloat(item.price) > 0) {
                allItems.push({ ...item, type: 'support' });
            }
        });
    }

    // Totals Calculation
    const totalSupport = data.customerSupport ? data.customerSupport.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0) : 0;
    const totalQuotation = data.quotationItems ? data.quotationItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0) : (parseFloat(data.wage) || 0);
    const grandTotal = totalSupport + totalQuotation;
    
    const vatableAmount = totalQuotation; 
    const vatRate = 0.07;
    const preVatAmount = vatableAmount / 1.07;
    const vatAmount = vatableAmount - preVatAmount;
    const nonVatableAmount = totalSupport;

    // Helper: Arabic Number to Thai Text
    const ArabicNumberToText = (n) => {
        n = parseFloat(n);
        if (n === 0) return "ศูนย์บาทถ้วน";
        
        const nums = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
        const units = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];
        
        let nStr = n.toFixed(2).toString();
        let [integer, fraction] = nStr.split('.');
        let text = "";

        // Integer Part
        if (parseInt(integer) === 0) {
            text = "ศูนย์";
        } else {
            let len = integer.length;
            for (let i = 0; i < len; i++) {
                let digit = parseInt(integer.charAt(i));
                let pos = len - i - 1;
                let unitIndex = pos % 6;

                if (digit !== 0) {
                    if (unitIndex === 0 && digit === 1 && i > 0 && parseInt(integer.charAt(i - 1)) !== 0) {
                        // Case: Ends with 1 (Ed) e.g., 11, 21, 101, but not 1, 10, 100
                        // Logic: Unit position, digit is 1, not the first digit of the number
                        // Exception: 1,000,001 (One Million One) -> The last 1 is Ed.
                        // Exception: 101,000,000 (One Hundred One Million) -> The 1 at pos 6 is Ed.
                        text += "เอ็ด";
                    } else if (unitIndex === 1 && digit === 2) {
                        text += "ยี่";
                    } else if (unitIndex === 1 && digit === 1) {
                        // Sip (10) - do not pronounce "Nueng"
                    } else {
                        text += nums[digit];
                    }
                    text += units[unitIndex];
                }

                // Add 'Lan' (Million) logic
                // Must add "Lan" at position 6, 12, 18, etc. even if digit is 0
                // (e.g. 200,000,000 -> "Song Roi" + "Lan")
                if (pos > 0 && pos % 6 === 0) {
                    text += "ล้าน";
                }
            }
        }
        
        text += "บาท";

        // Fraction Part (Satang)
        if (parseInt(fraction) === 0) {
            text += "ถ้วน";
        } else {
            if (parseInt(fraction) > 0) {
                let fLen = fraction.length;
                for (let i = 0; i < fLen; i++) {
                    let digit = parseInt(fraction.charAt(i));
                    let pos = fLen - i - 1; // 1 (Ten), 0 (Unit)
                    
                    if (digit !== 0) {
                        if (pos === 0 && digit === 1 && i > 0) { 
                            text += "เอ็ด";
                        } else if (pos === 1 && digit === 2) {
                            text += "ยี่";
                        } else if (pos === 1 && digit === 1) {
                            // Sip
                        } else {
                            text += nums[digit];
                        }
                        
                        if (pos === 1) text += "สิบ";
                    }
                }
                text += "สตางค์";
            }
        }
        return text;
    };

    const bahtText = ArabicNumberToText(grandTotal);
    const dateStr = formatDate(data.rawDateTime || new Date().toISOString()).split(' ')[0];
    const docNo = `INV${data.id.replace(/\D/g, '')}`; 

    // [MODIFIED] Pagination Logic - Dynamic capacity based on page index
    const pages = [];
    // หน้าแรก (มี Header/Info): จุได้น้อยกว่า - ปรับเพิ่มจำนวนแถวเนื่องจากลดขนาดตารางลงแล้ว
    const ROWS_FIRST_PAGE_MAX = 24; // ปรับเพิ่มเพื่อให้รองรับรายการได้มากขึ้นกรณีไม่มีสรุป
    const ROWS_FIRST_PAGE_WITH_SUM = 16; // [FIXED] ปรับเป็น 16 ตามที่แจ้งว่าพื้นที่พอสำหรับ 16 รายการ + สรุปยอด
    // หน้าถัดไป (ไม่มี Header): จุได้เยอะกว่า
    const ROWS_OTHER_PAGE_MAX = 36; // ปรับเพิ่มตามสัดส่วน
    const ROWS_OTHER_PAGE_WITH_SUM = 30; // ปรับเพิ่มตามสัดส่วน
    
    let remainingItems = [...allItems];
    let currentPageIdx = 0;

    // ถ้าไม่มีรายการเลย ให้สร้าง array เปล่าเพื่อให้ลูปทำงานอย่างน้อย 1 ครั้ง
    if (remainingItems.length === 0) {
        pages.push({ items: [], isLast: true, pageIndex: 0 });
    } else {
        while (remainingItems.length > 0) {
            const isFirstPage = currentPageIdx === 0;
            const capacityFull = isFirstPage ? ROWS_FIRST_PAGE_MAX : ROWS_OTHER_PAGE_MAX;
            const capacityWithSum = isFirstPage ? ROWS_FIRST_PAGE_WITH_SUM : ROWS_OTHER_PAGE_WITH_SUM;

            if (remainingItems.length <= capacityWithSum) {
                // เหลือรายการน้อย ใส่ลงหน้าปัจจุบันพร้อมสรุปยอดได้เลย
                pages.push({ items: remainingItems, isLast: true, pageIndex: currentPageIdx });
                remainingItems = [];
            } else if (remainingItems.length <= capacityFull) {
                // ใส่หน้าปัจจุบันพอดี แต่ไม่พอสำหรับสรุปยอด -> แยกรายการไว้หน้านี้ แล้วปัดสรุปไปหน้าถัดไป (หน้าเปล่า)
                pages.push({ items: remainingItems, isLast: false, pageIndex: currentPageIdx });
                remainingItems = [];
                // เพิ่มหน้าสรุป
                currentPageIdx++;
                pages.push({ items: [], isLast: true, pageIndex: currentPageIdx });
            } else {
                // รายการเยอะเกิน ตัดใส่หน้าปัจจุบันเต็มความจุ แล้ววนลูปต่อ
                pages.push({ items: remainingItems.slice(0, capacityFull), isLast: false, pageIndex: currentPageIdx });
                remainingItems = remainingItems.slice(capacityFull);
            }
            currentPageIdx++;
        }
    }

    // Template Generator (Per Page)
    const generatePageHtml = (pageData, pageIndex, totalPages, type) => {
        let rowsHtml = '';
        // คำนวณลำดับที่ต่อเนื่อง
        let startSeq = 0;
        for (let i = 0; i < pageIndex; i++) {
            startSeq += pages[i].items.length;
        }
        let seq = startSeq + 1;

        pageData.items.forEach(item => {
             const isSupport = item.type === 'support';
             // [MODIFIED] Compact single-line description
             const desc = isSupport 
                ? `<span class="font-semibold text-gray-800">เงินสนับสนุน (${item.denomination >= 20 ? 'แบงค์' : 'เหรียญ'} ${item.denomination})</span> <span class="text-[10px] text-gray-400">* Non-Vat</span>`
                : `<span class="font-semibold text-gray-800">${item.category || '-'}</span> <span class="text-xs text-gray-600 ml-1">${item.detail || ''}</span>`;

             rowsHtml += `
             <tr class="border-b border-gray-200">
                <!-- [MODIFIED] Reduced padding for compact rows -->
                <td class="py-1 px-1.5 text-center align-top">${seq++}</td>
                <td class="py-1 px-1.5 align-top leading-tight">${desc}</td>
                <td class="py-1 px-1.5 text-right align-top">${isSupport ? item.quantity : '1.00'}</td>
                <td class="py-1 px-1.5 text-right align-top">${isSupport 
                    ? (parseFloat(item.price)/parseInt(item.quantity || 1)).toLocaleString(undefined, {minimumFractionDigits: 2}) 
                    : parseFloat(item.price).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td class="py-1 px-1.5 text-right align-top">0.00</td>
                <td class="py-1 px-1.5 text-right font-semibold align-top">${parseFloat(item.price).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
             </tr>`;
        });

        // [MODIFIED] Check if it's the first page
        const isFirstPage = pageIndex === 0;

        return `
        <div class="receipt-a4-container ${type === 'ต้นฉบับ' ? 'page-break-after' : ''} bg-white px-8 py-6 relative flex flex-col">
            <!-- Header (Only on First Page) -->
            ${isFirstPage ? `
            <div class="flex justify-between items-start mb-2 shrink-0"> <!-- ADDED shrink-0 to prevent overlapping -->
                <div class="flex flex-col gap-3 w-[60%] mt-2">
                    <div class="flex gap-4">
                        ${sLogo ? `<img src="${sLogo}" class="w-20 h-20 object-contain rounded-md" />` : ''}
                        <div>
                            <h2 class="text-lg font-bold text-gray-800 leading-tight">${sName}</h2>
                            <p class="text-xs text-gray-500 mt-0.5 leading-tight">${sAddress}</p>
                            <p class="text-[10px] text-gray-500 mt-0.5 font-medium">เลขประจำตัวผู้เสียภาษี: ${sTaxId}</p>
                            <div class="flex gap-3 mt-1 text-[10px] text-gray-500">
                                ${sPhone ? `<span class="flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg> ${sPhone}</span>` : ''}
                                ${sEmail ? `<span class="flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg> ${sEmail}</span>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="flex flex-col justify-between items-end text-right w-[38%]">
                    <div>
                        <div class="text-xs text-gray-500 mb-0.5">(${type})</div>
                        <h1 class="text-xl font-bold text-green-600 tracking-tight leading-none">ใบเสร็จรับเงิน/ใบกำกับภาษี</h1>
                    </div>
                    <div class="border border-green-200 bg-green-50 rounded-lg p-2 text-xs text-left shadow-sm force-print-bg w-[65%] mt-2">
                        <div class="grid grid-cols-[auto,1fr] gap-x-2 gap-y-0.5">
                            <strong class="text-green-800">เลขที่:</strong> <span class="text-gray-700 font-mono font-bold">${docNo}</span>
                            <strong class="text-green-800">วันที่:</strong> <span class="text-gray-700">${dateStr}</span>
                            <strong class="text-green-800">อ้างอิง:</strong> <span class="text-gray-700 truncate">${data.id}</span>
                        </div>
                    </div>
                </div>
            </div>

            <hr class="border-t-2 border-gray-100 my-2 shrink-0" />

            <!-- Info Section & Image (Only on First Page) -->
            <div class="grid grid-cols-12 gap-3 text-xs mb-2 items-stretch min-h-[145px] shrink-0"> <!-- MODIFIED: mb-1 to mb-2 -->
                <div class="col-span-7 flex flex-col gap-2">
                    <div class="bg-gray-50 rounded-lg p-2.5 border border-gray-100 relative flex-1 flex flex-col justify-center">
                        <div class="absolute top-0 right-0 p-1.5 opacity-10 pointer-events-none">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        </div>
                        <div class="flex items-center gap-1.5 mb-1">
                            <h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">ลูกค้า (Customer)</h3>
                        </div>
                        <div class="grid grid-cols-[80px,1fr] gap-y-0.5 text-xs relative z-10">
                             <span class="text-gray-500 font-bold">ชื่อ:</span>
                             <div class="text-gray-800 font-bold truncate">${cName}</div>
                             ${cPhone !== '-' ? `<span class="text-gray-500 font-bold">เบอร์โทร:</span><div class="text-gray-800 truncate">${cPhone}</div>` : ''}
                             ${cEmail !== '-' ? `<span class="text-gray-500 font-bold">อีเมล:</span><div class="text-gray-800 truncate">${cEmail}</div>` : ''}
                             <span class="text-gray-500 font-bold">เลขที่ภาษี:</span><div class="text-gray-800 truncate">${cTaxId}</div>
                             <span class="text-gray-500 font-bold">ที่อยู่:</span><div class="text-gray-800 leading-tight line-clamp-2">${cAddress}</div>
                        </div>
                    </div>
                    <div class="bg-gray-50 rounded-lg p-2.5 border border-gray-100 relative flex-1 flex flex-col justify-center">
                        <div class="absolute top-0 right-0 p-1.5 opacity-10 pointer-events-none">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
                        </div>
                         <div class="flex items-center gap-1.5 mb-1">
                            <h3 class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">จัดส่ง (Shipping)</h3>
                        </div>
                        <div class="grid grid-cols-[80px,1fr] gap-y-1 relative z-10">
                            <span class="text-gray-500 font-bold">ผู้รับ:</span>
                            <div class="text-gray-800 font-bold truncate">${rName} ${rPhone !== '-' ? `<span class="font-normal text-gray-600 text-[10px] ml-1">(${rPhone})</span>` : ''}</div>
                            <span class="text-gray-500 font-bold">กำหนดส่ง:</span><div class="text-gray-800 truncate">${rDate}</div>
                            <span class="text-gray-500 font-bold">สถานที่:</span><div class="text-gray-800 leading-tight line-clamp-2">${rLocation}</div>
                        </div>
                    </div>
                </div>
                <div class="col-span-5 relative">
                     <div class="absolute inset-0 bg-gray-50 border border-gray-100 rounded-lg flex flex-col overflow-hidden">
                        <!-- [MODIFIED] Removed "Picture" label overlay -->
                        <div class="w-full h-full flex items-center justify-center bg-gray-50">
                            ${data.image 
                                ? `<img src="${processImageUrl(data.image)}" class="w-full h-full object-contain" />` 
                                : `<div class="flex flex-col items-center gap-1 opacity-20"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg><span class="text-xs font-bold">No Image</span></div>`
                            }
                        </div>
                     </div>
                </div>
            </div>
            ` : `
            <!-- Minimal Header for Subsequent Pages -->
            <div class="flex justify-between items-center mb-2 pb-2 border-b border-gray-100 shrink-0"> <!-- MODIFIED: mb-1 to mb-2 -->
                <div class="text-xs font-bold text-gray-400">ใบเสร็จรับเงิน (ต่อ)</div>
                <div class="text-xs text-gray-400">อ้างอิง: ${data.id}</div>
            </div>
            `}

            <!-- Table (Paginated) - Display only if there are items -->
            ${pageData.items.length > 0 ? `
            <div class="mb-6 mt-0">
                <table class="w-full text-xs">
                    <thead>
                        <tr class="bg-green-50 text-green-800 border-y border-green-100 force-print-bg">
                            <th class="p-1.5 w-10 text-center font-bold first:rounded-l-lg">ลำดับ</th>
                            <th class="p-1.5 text-left font-bold">รายละเอียด</th>
                            <th class="p-1.5 w-16 text-right font-bold">จำนวน</th>
                            <th class="p-1.5 w-24 text-right font-bold">ราคา/หน่วย</th>
                            <th class="p-1.5 w-20 text-right font-bold">ส่วนลด</th>
                            <th class="p-1.5 w-28 text-right font-bold last:rounded-r-lg">จำนวนเงิน</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </div>
            ` : ''}

            <!-- Summary & Signature Section (Only on Last Page) -->
            ${pageData.isLast ? `
            <div class="mt-0 break-inside-avoid"> <!-- MODIFIED: mt-4 to mt-0 because table has mb-6 -->
                
                <!-- [MODIFIED] Section 1: Notes & Subtotals List (Aligned Top) -->
                <div class="flex flex-col sm:flex-row justify-between items-start gap-6 mb-2">
                    <div class="flex-1 text-xs">
                        <strong class="text-gray-700 mr-1">หมายเหตุ:</strong>
                        <span class="text-gray-600 leading-relaxed">${data.note || '-'}</span>
                    </div>
                    <div class="w-full sm:w-[350px] space-y-1.5 text-xs">
                        <div class="flex justify-between text-gray-600"><span>มูลค่าสินค้า (ก่อนภาษี)</span><span>${preVatAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                        <div class="flex justify-between text-gray-600"><span>ภาษีมูลค่าเพิ่ม 7%</span><span>${vatAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                        ${nonVatableAmount > 0 ? `<div class="flex justify-between text-gray-600"><span>เงินสนับสนุน (ยกเว้นภาษี)</span><span>${nonVatableAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>` : ''}
                        <div class="flex justify-between text-gray-600 border-b border-gray-200 pb-2"><span>ส่วนลด</span><span>0.00</span></div>
                    </div>
                </div>

                <!-- [MODIFIED] Section 2: Equal Height Cards (Text Amount & Grand Total) -->
                <div class="flex flex-col sm:flex-row justify-between items-stretch gap-6 mb-4">
                    <div class="flex-1 flex flex-col justify-center items-start bg-green-50 p-2 rounded-lg border border-green-200 force-print-bg">
                        <span class="text-green-700 text-[10px] font-bold">จำนวนเงินตัวอักษร</span>
                        <strong class="text-green-800 text-sm font-bold tracking-tight leading-tight mt-0.5">(${bahtText})</strong>
                    </div>
                    <div class="w-full sm:w-[350px] flex flex-col justify-center items-end bg-green-50 p-2 rounded-lg border border-green-200 force-print-bg">
                        <span class="text-green-700 text-[10px] font-bold">จำนวนเงินทั้งสิ้น</span>
                        <strong class="text-green-800 text-xl font-black tracking-tight leading-none mt-0.5">฿${grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</strong>
                    </div>
                </div>
                
                <div class="flex gap-8 justify-between mt-2">
                    <div class="text-center w-1/2 px-8">
                        <div class="h-8 border-b border-dotted border-gray-800 w-full mb-1"></div>
                        <span class="text-xs font-bold text-black">ผู้รับวางบิล</span>
                        <div class="mt-1 text-[9px] text-gray-400">วันที่ ...../...../..........</div>
                    </div>
                    <div class="text-center w-1/2 px-8">
                        <div class="h-8 border-b border-dotted border-gray-800 w-full mb-1"></div>
                        <span class="text-xs font-bold text-black">ผู้รับเงิน</span>
                        <div class="mt-1 text-[9px] text-gray-400">วันที่ ...../...../..........</div>
                    </div>
                </div>
            </div>` : ``}
            
            <!-- Page Number Footer -->
            <div class="absolute bottom-4 right-8 text-[10px] text-gray-400">
                หน้า ${pageIndex + 1} / ${totalPages}
            </div>
        </div>
        `;
    };

    const generateFullDoc = (type) => {
        return pages.map((page, idx) => generatePageHtml(page, idx, pages.length, type)).join('');
    };

    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>พิมพ์ใบเสร็จ - ${data.id}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;700&display=swap" rel="stylesheet">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;700&display=swap');
            body { 
                font-family: 'Sarabun', sans-serif; 
                background: #52525b; 
                padding: 20px;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            .receipt-a4-container {
                width: 210mm;
                height: 297mm; /* [MODIFIED] Fixed A4 Height */
                min-height: 297mm;
                margin: 0 auto 20px auto;
                background: white;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                padding: 40px;
                position: relative;
                overflow: hidden; /* Ensure content stays in page */
                box-sizing: border-box;
            }
            .keep-together {
                page-break-inside: avoid;
                break-inside: avoid;
            }
            @media print {
                /* [MODIFIED] Target both html and body to force text color white on browser UI */
                html, body { 
                    width: 100%;
                    height: auto; /* [MODIFIED] Changed from 100% to auto to avoid forcing height issues */
                    background: white; 
                    margin: 0;
                    padding: 0;
                    /* color: white !important;  REMOVED to prevent interfering with content colors */
                }
                .receipt-a4-container {
                    width: 100%;
                    height: 297mm; /* Force A4 height in print */
                    box-shadow: none;
                    margin: 0;
                    padding: 40px !important; /* Keep padding */
                    page-break-after: always;
                    color: initial; /* [MODIFIED] Allow colors to show */
                    visibility: visible;
                    overflow: hidden;
                }
                .receipt-a4-container:last-child {
                    page-break-after: auto;
                }
                
                .page-break-after {
                    page-break-after: always;
                }
                .force-print-bg {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                @page { 
                    size: A4; 
                    margin: 0; /* [MODIFIED] Reset margins to 0 to prevent overflow causing extra blank pages */
                }
                .no-print { display: none !important; }
            }
        </style>
      </head>
      <body>
        <!-- [MODIFIED] Desktop Controls with Toggle -->
        <div class="no-print hidden sm:flex fixed top-4 right-4 z-50 gap-3 items-center">
            <div class="flex bg-gray-800/80 backdrop-blur-md rounded-lg p-1 border border-white/10">
                <button id="desk-btn-original" onclick="setMode('original')" class="px-4 py-2 rounded-md text-sm font-bold bg-white text-gray-900 shadow-sm transition-all">ต้นฉบับ</button>
                <button id="desk-btn-copy" onclick="setMode('copy')" class="px-4 py-2 rounded-md text-sm font-bold text-gray-300 hover:text-white transition-all">สำเนา</button>
            </div>
            <button onclick="window.print()" class="bg-blue-600 text-white px-6 py-2 rounded-lg shadow-lg font-bold hover:bg-blue-700 transition flex items-center gap-2 border border-white/20">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                พิมพ์
            </button>
            <button onclick="window.close()" class="bg-gray-500 text-white px-6 py-2 rounded-lg shadow-lg font-bold hover:bg-gray-600 transition border border-white/20">
                ปิด
            </button>
        </div>

        <!-- [MODIFIED] Mobile Controls with Toggle & Big Print Button -->
        <div class="no-print flex sm:hidden fixed bottom-8 right-8 z-50 flex-col gap-4 items-end">
            <div class="flex bg-white rounded-full p-1.5 shadow-xl border border-gray-100 mb-2">
                <button id="mob-btn-original" onclick="setMode('original')" class="px-5 py-2.5 rounded-full text-xs font-bold bg-indigo-600 text-white shadow-sm transition-all">ต้นฉบับ</button>
                <button id="mob-btn-copy" onclick="setMode('copy')" class="px-5 py-2.5 rounded-full text-xs font-bold text-gray-500 hover:bg-gray-50 transition-all">สำเนา</button>
            </div>
            <button onclick="window.print()" class="w-[125px] h-[125px] bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center border-4 border-white/30 backdrop-blur-md active:scale-95 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            </button>
        </div>

        <!-- [MODIFIED] Generate Paginated Content -->
        <div id="original-container">
            ${generateFullDoc('ต้นฉบับ')}
        </div>
        <div id="copy-container" style="display:none;">
            ${generateFullDoc('สำเนา')}
        </div>
        
        <script>
            function setMode(mode) {
                const orig = document.getElementById('original-container');
                const copy = document.getElementById('copy-container');
                const dOrig = document.getElementById('desk-btn-original');
                const dCopy = document.getElementById('desk-btn-copy');
                const mOrig = document.getElementById('mob-btn-original');
                const mCopy = document.getElementById('mob-btn-copy');

                if (mode === 'original') {
                    orig.style.display = 'block';
                    copy.style.display = 'none';
                    dOrig.className = 'px-4 py-2 rounded-md text-sm font-bold bg-white text-gray-900 shadow-sm transition-all';
                    dCopy.className = 'px-4 py-2 rounded-md text-sm font-bold text-gray-300 hover:text-white transition-all';
                    mOrig.className = 'px-5 py-2.5 rounded-full text-xs font-bold bg-indigo-600 text-white shadow-sm transition-all';
                    mCopy.className = 'px-5 py-2.5 rounded-full text-xs font-bold text-gray-500 hover:bg-gray-50 transition-all';
                } else {
                    orig.style.display = 'none';
                    copy.style.display = 'block';
                    dOrig.className = 'px-4 py-2 rounded-md text-sm font-bold text-gray-300 hover:text-white transition-all';
                    dCopy.className = 'px-4 py-2 rounded-md text-sm font-bold bg-white text-gray-900 shadow-sm transition-all';
                    mOrig.className = 'px-5 py-2.5 rounded-full text-xs font-bold text-gray-500 hover:bg-gray-50 transition-all';
                    mCopy.className = 'px-5 py-2.5 rounded-full text-xs font-bold bg-indigo-600 text-white shadow-sm transition-all';
                }
            }
        </script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(fullHtml);
        printWindow.document.close();
    } else {
        alert('Pop-up ถูกบล็อก กรุณาอนุญาต Pop-up สำหรับเว็บไซต์นี้');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 sm:p-4 print:p-0">
      <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-white w-full max-w-lg sm:rounded-3xl rounded-none h-full sm:h-auto shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[100dvh] sm:max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 print:shadow-none print:w-full print:max-w-none print:h-auto print:rounded-none">
        
        {/* Header - Fixed on top */}
        <div className="px-5 py-4 bg-white border-b border-slate-100 flex justify-between items-center print:hidden shrink-0 z-20 sticky top-0">
          <div className="flex items-center gap-3">
             <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600">
                <Share2 className="w-5 h-5" />
             </div>
             <div>
                <h3 className="font-bold text-slate-800 text-base leading-tight">สรุปรายละเอียดงาน</h3>
                <p className="text-[10px] text-slate-500 font-medium">สำหรับลูกค้า (Customer View)</p>
             </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Scrollable with soft background */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50 p-4 sm:p-6 print:bg-white print:p-0">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-6 print:border-none print:shadow-none">
            
            {/* Project Header */}
            <div>
               <div className="flex justify-between items-start gap-3 mb-2">
                  <h2 className="text-xl font-black text-slate-800 leading-tight break-words">{data.name}</h2>
                  {data.id && <span className="shrink-0 bg-indigo-50 text-indigo-600 text-[10px] px-2 py-1 rounded-md font-bold border border-indigo-100">{data.id}</span>}
               </div>
               <div className="flex flex-wrap gap-2">
                   <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 text-[10px] px-2 py-1 rounded-md font-bold border border-emerald-100">
                      <FileText className="w-3 h-3" /> ใบสรุปงาน
                   </span>
               </div>
            </div>

            {/* General Info Card */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
               <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <User className="w-3.5 h-3.5" /> ข้อมูลทั่วไป
               </h4>
               <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                  <div>
                    <p className="text-[10px] text-slate-400 mb-0.5">วันที่</p>
                    <p className="text-sm font-bold text-slate-700">{formatDate(data.rawDateTime)}</p>
                  </div>
                   <div>
                    <p className="text-[10px] text-slate-400 mb-0.5">ศิลปิน</p>
                    <p className="text-sm font-bold text-slate-700">{data.artist}</p>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-slate-200/60">
                    <p className="text-[10px] text-slate-400 mb-0.5">ลูกค้า</p>
                    <p className="text-sm font-bold text-slate-700">{data.customer}</p>
                  </div>
               </div>
            </div>

            {/* Delivery Info Card */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
               <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5" /> การจัดส่ง & สถานที่
               </h4>
               <div className="space-y-3">
                  <div className="flex gap-3">
                     <div className="shrink-0 mt-0.5 text-indigo-500"><Clock className="w-4 h-4" /></div>
                     <div>
                        <p className="text-[10px] text-slate-400 mb-0.5 font-bold">กำหนดส่ง</p>
                        <div className="text-sm font-bold text-slate-700">{renderDeliveryTime(data)}</div>
                     </div>
                  </div>
                  <div className="flex gap-3">
                     <div className="shrink-0 mt-0.5 text-rose-500"><MapPin className="w-4 h-4" /></div>
                     <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-baseline mb-0.5">
                            <p className="text-[10px] text-slate-400 font-bold">สถานที่</p>
                            {data.mapLink && (
                                <a href={data.mapLink} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-1">
                                    เปิดแผนที่ <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                            )}
                        </div>
                        <p className="text-sm font-bold text-slate-700 leading-snug">{data.location || '-'}</p>
                     </div>
                  </div>
                  {(data.recipient || data.recipientPhone) && (
                     <div className="flex gap-3 pt-3 mt-1 border-t border-slate-200/60">
                        <div className="shrink-0 mt-0.5 text-emerald-500"><User className="w-4 h-4" /></div>
                        <div>
                           <p className="text-[10px] text-slate-400 mb-0.5 font-bold">ผู้รับ</p>
                           <p className="text-sm font-bold text-slate-700">{data.recipient || '-'}</p>
                           {data.recipientPhone && <p className="text-xs text-slate-500 mt-0.5 font-medium">{data.recipientPhone}</p>}
                        </div>
                     </div>
                  )}
               </div>
            </div>

            {/* Image Section */}
            {data.image && (
               <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                     <ImageIcon className="w-3.5 h-3.5" /> รูปภาพอ้างอิง
                  </h4>
                  <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 relative">
                     <img 
                        src={processImageUrl(data.image)} 
                        alt="Project Ref" 
                        className="w-full h-auto object-contain max-h-60" 
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.parentElement.innerHTML = '<div class="p-4 text-center text-slate-400 text-xs">ไม่สามารถโหลดรูปภาพได้</div>';
                        }}
                     />
                  </div>
               </div>
            )}

            {/* Money Summary Section - Card Style */}
            <div className="pt-2">
               <div className="bg-white rounded-xl border-2 border-dashed border-slate-200 p-4 sm:p-5 relative overflow-hidden">
                  {/* Decorative Icon */}
                  <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
                      <Wallet className="w-24 h-24 -rotate-12" />
                  </div>
                  
                  <h3 className="text-base font-black text-slate-800 text-center uppercase tracking-wide mb-5 relative z-10">สรุปยอดเรียกเก็บเงิน</h3>
                  
                  <div className="space-y-5 relative z-10">
                      
                      {/* 1. Money Order */}
                      {data.customerSupport && data.customerSupport.some(i => parseFloat(i.price) > 0) && (
                          <div className="space-y-2">
                              <div className="flex justify-between items-center border-b border-indigo-100 pb-1.5 mb-1">
                                  <h4 className="text-xs font-bold text-indigo-600 flex items-center gap-1.5">
                                     <div className="p-1 bg-indigo-100 rounded-md"><Gift className="w-3 h-3" /></div>
                                     เงินสนับสนุนศิลปิน
                                  </h4>
                                  <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">฿{totalSupport.toLocaleString()}</span>
                              </div>
                              <div className="space-y-1.5">
                                  {data.customerSupport.filter(item => parseFloat(item.price) > 0).map((item, idx) => (
                                      <div key={idx} className="flex justify-between items-center text-xs text-slate-600 px-1">
                                          <span className="flex items-center gap-2">
                                              <span className="w-1 h-1 bg-indigo-400 rounded-full shrink-0"></span>
                                              {item.denomination >= 20 ? 'แบงค์' : 'เหรียญ'} {item.denomination} x {item.quantity}
                                          </span>
                                          <span className="font-medium text-slate-900 tabular-nums">{parseFloat(item.price).toLocaleString()}</span>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}

                      {/* 2. Quotation */}
                      <div className="space-y-2">
                          <div className="flex justify-between items-center border-b border-emerald-100 pb-1.5 mb-1">
                              <h4 className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                                 <div className="p-1 bg-emerald-100 rounded-md"><FileText className="w-3 h-3" /></div>
                                 รายการเสนอราคา
                              </h4>
                              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">฿{totalQuotation.toLocaleString()}</span>
                          </div>
                          <div className="space-y-2">
                              {hasQuotationItems ? (
                                  data.quotationItems.map((item, idx) => (
                                      <div key={idx} className="flex justify-between items-start text-xs px-1">
                                          <div className="flex flex-col pr-2">
                                              <div className="flex flex-wrap items-baseline gap-1">
                                                  {item.category && (
                                                      <span className="font-bold text-slate-700 whitespace-nowrap">{item.category}</span>
                                                  )}
                                                  <span className="text-slate-500 font-medium break-all">{item.detail}</span>
                                              </div>
                                          </div>
                                          <span className="font-bold text-slate-900 tabular-nums whitespace-nowrap pt-0.5">
                                              {parseFloat(item.price).toLocaleString()}
                                          </span>
                                      </div>
                                  ))
                              ) : (
                                  <div className="flex justify-between items-center text-xs text-slate-600 px-1">
                                      <span className="flex items-center gap-2">
                                          <span className="w-1 h-1 bg-emerald-400 rounded-full"></span>
                                          ค่าบริการรวม
                                      </span>
                                      <span className="font-bold text-slate-900 tabular-nums">{totalQuotation.toLocaleString()}</span>
                                  </div>
                              )}
                          </div>
                      </div>

                      {/* 3. Net Total */}
                      <div className="pt-4 border-t border-slate-200 mt-2">
                          <div className="flex justify-between items-end bg-slate-50 p-4 rounded-xl border border-slate-100">
                              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">ยอดเรียกเก็บสุทธิ</span>
                              <span className="text-2xl font-black text-indigo-600 leading-none tabular-nums">฿{netReceivable.toLocaleString()}</span>
                          </div>
                      </div>
                  </div>
               </div>
            </div>

          </div>
        </div>

        {/* Buttons Action Area (Fixed Bottom) */}
        <div className="p-4 bg-white border-t border-slate-100 flex flex-col gap-3 print:hidden shrink-0 safe-area-bottom-modal">
           <div className="grid grid-cols-2 gap-3">
               <button 
                 onClick={handleCopyLink}
                 className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${isLinkCopied ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
               >
                 {isLinkCopied ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
                 {isLinkCopied ? 'คัดลอกลิงก์' : 'ลิงก์ติดตามงาน'}
               </button>
               {/* [NEW] Quotation Link Button */}
               <button 
                 onClick={handleCopyQuoteLink}
                 className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${isQuoteLinkCopied ? 'bg-purple-50 text-purple-600 border border-purple-100' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
               >
                 {isQuoteLinkCopied ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
                 {isQuoteLinkCopied ? 'คัดลอกลิงก์' : 'ลิงก์เสนอราคา'}
               </button>
           </div>
           
           <div className="grid grid-cols-2 gap-3">
               <button 
                 onClick={handleCopyText}
                 className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${isCopied ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
               >
                 {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                 {isCopied ? 'คัดลอกข้อความ' : 'คัดลอกข้อความ'}
               </button>
               <button 
                 onClick={handlePrint}
                 className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
               >
                 <Printer className="w-4 h-4" />
                 พิมพ์ / บันทึก PDF
               </button>
           </div>
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
           {/* Outer Ring spins */}
           <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
           <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center shadow-inner">
                {/* [MODIFIED] Inner Icon spins instead of pulses for better feedback */}
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

const SortableHeader = ({ label, sortKey, sortConfig, handleSort, alignRight = false, className = '' }) => (
  <th
    className={`px-4 py-4 font-medium whitespace-nowrap cursor-pointer hover:bg-slate-50 transition-colors group select-none ${alignRight ? 'text-right' : 'text-left'} ${className}`}
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
  
  // [ADDED] State for Mobile Profile Menu
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  // [ADDED] State to track if settings are loaded (to prevent color flash on public pages)
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);

  // [ADDED] State to track if main images are preloaded (for tracking/quotation pages)
  // เริ่มต้นเป็น false ถ้ามี tracking/quotation ID เพื่อบังคับให้รอโหลดรูปก่อน
  const [areImagesLoaded, setAreImagesLoaded] = useState(() => {
      const params = new URLSearchParams(window.location.search);
      return !(params.has('tracking') || params.has('quotation'));
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
  
  // [MODIFIED] Initialize authorizedUsers from localStorage immediately for instant login check
  const [authorizedUsers, setAuthorizedUsers] = useState(() => {
    const defaultUsers = [
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
    ];

    try {
        const saved = localStorage.getItem('nexus_authorized_users');
        return saved ? JSON.parse(saved) : defaultUsers;
    } catch (e) {
        return defaultUsers;
    }
  });

  const [loginError, setLoginError] = useState('');
  const [userProfile, setUserProfile] = useState(null);

  const [newUser, setNewUser] = useState({ username: '', password: '', name: '', role: '', email: '', phone: '' });
  const [isAddingUser, setIsAddingUser] = useState(false);

  const [driveFolderId, setDriveFolderId] = useState('');
  const [assetsDriveFolderId, setAssetsDriveFolderId] = useState(''); 
  
  // [ADDED] State for Chatbot Tokens
  const [lineBotToken, setLineBotToken] = useState('');
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [webAppUrl, setWebAppUrl] = useState(''); 
  
  // [ADDED] State for Google Script Deploy URL (Initialized with constant)
  const [deployUrl, setDeployUrl] = useState(GOOGLE_SCRIPT_URL);

  const [shopInfo, setShopInfo] = useState(() => {
      try {
          const saved = localStorage.getItem('nexus_shop_info');
          return saved ? JSON.parse(saved) : {
              shopName: '',
              phone: '',
              email: '',
              address: '',
              line: '',
              facebook: '',
              instagram: '',
              tiktok: '',
              twitter: '', 
              wechat: '',  
              telegram: '', // [ADDED]
              logo: '',
              themeColor: 'indigo',
              themeMode: 'gradient',
              customColorValue: '#000000'
          };
      } catch (e) {
          return {
              shopName: '',
              phone: '',
              email: '',
              address: '',
              line: '',
              facebook: '',
              instagram: '',
              tiktok: '',
              twitter: '', 
              wechat: '',  
              telegram: '', // [ADDED]
              logo: '',
              themeColor: 'indigo',
              themeMode: 'gradient',
              customColorValue: '#000000'
          };
      }
  });

  useLayoutEffect(() => {
      let theme;
      const isGradient = shopInfo.themeMode === 'gradient';

      // [ADDED] Logic for Custom Color Calculation
      if (shopInfo.themeColor === 'custom' && shopInfo.customColorValue) {
          const mainColor = shopInfo.customColorValue;
          theme = {
              main: mainColor,
              hover: shadeColor(mainColor, -0.1), // Darken 10%
              light: shadeColor(mainColor, 0.93), // Very light tint (93%)
              textLight: mainColor,
              gradientFrom: mainColor,
              gradientTo: shadeColor(mainColor, -0.25), // Darken 25% for gradient end
              shadow: `rgba(${hexToRgbString(mainColor)}, 0.4)`
          };
      } else {
          theme = themeColors[shopInfo.themeColor] || themeColors.indigo;
      }
      
      const styleId = 'nexus-theme-styles';
      let style = document.getElementById(styleId);
      if (!style) {
          style = document.createElement('style');
          style.id = styleId;
          document.head.appendChild(style);
      }

      // Generate CSS to override Tailwind 'indigo' classes
      const css = `
          :root {
              --theme-main: ${theme.main};
              --theme-hover: ${theme.hover};
              --theme-light: ${theme.light};
              --theme-text-light: ${theme.textLight};
              --theme-shadow: ${theme.shadow};
          }
          
          /* Backgrounds */
          .bg-indigo-600 { background-color: var(--theme-main) !important; }
          .hover\\:bg-indigo-700:hover { background-color: var(--theme-hover) !important; }
          .bg-indigo-50 { background-color: var(--theme-light) !important; }
          .bg-indigo-100 { background-color: var(--theme-light) !important; filter: brightness(0.95); } /* Adjusted logic for 100 */
          
          /* Texts */
          .text-indigo-600 { color: var(--theme-main) !important; }
          .text-indigo-700 { color: var(--theme-hover) !important; }
          .text-indigo-500 { color: var(--theme-text-light) !important; }
          
          /* Borders */
          .border-indigo-100, .border-indigo-200 { border-color: ${theme.light} !important; filter: brightness(0.9); }
          .border-indigo-600 { border-color: var(--theme-main) !important; }
          .hover\\:border-indigo-300:hover { border-color: var(--theme-text-light) !important; opacity: 0.8; }

          /* Shadows */
          .shadow-indigo-200 { --tw-shadow-color: ${theme.shadow} !important; }
          
          /* Gradients */
          .from-indigo-600 { --tw-gradient-from: ${theme.gradientFrom} !important; var(--tw-gradient-to, ${theme.gradientFrom}) !important; }
          .to-violet-600 { --tw-gradient-to: ${theme.gradientTo} !important; }
          .bg-gradient-to-r {
              ${!isGradient 
                  ? `background-image: none !important; background-color: var(--theme-main) !important;` 
                  : (theme.isRainbow 
                      ? `background-image: linear-gradient(to right, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #a855f7, #ec4899) !important;` 
                      : `background-image: linear-gradient(to right, var(--tw-gradient-from), var(--tw-gradient-to)) !important;`)
              }
          }
      `;
      style.textContent = css;

  }, [shopInfo.themeColor, shopInfo.themeMode, shopInfo.customColorValue]);

  const [projectCategories, setProjectCategories] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [dealStatuses, setDealStatuses] = useState([]);
  const [transportStatuses, setTransportStatuses] = useState([]);

  // [ADDED] State for Profile Upload
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);
  // [ADDED] State for Logo Upload
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

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

  // [ADDED] State for Logo Delete Confirmation Modal
  const [deleteLogoConfirm, setDeleteLogoConfirm] = useState(false);
  const [isDeleteLogoClosing, setIsDeleteLogoClosing] = useState(false);

  // [ADDED] State for Profile Delete Confirmation Modal
  const [deleteProfileConfirm, setDeleteProfileConfirm] = useState(false);
  const [isDeleteProfileClosing, setIsDeleteProfileClosing] = useState(false);

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
  // [MODIFIED] Initialize from URL params immediately to handle title correctly on load
  const [trackingId, setTrackingId] = useState(() => {
      if (typeof window !== 'undefined') {
          return new URLSearchParams(window.location.search).get('tracking');
      }
      return null;
  });
  
  const [quotationId, setQuotationId] = useState(() => {
      if (typeof window !== 'undefined') {
          return new URLSearchParams(window.location.search).get('quotation');
      }
      return null;
  });

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
  const [customerTaxId, setCustomerTaxId] = useState(''); // [ADDED] State for Customer Tax ID
  // [ADDED] State for Customer Address
  const [customerAddress, setCustomerAddress] = useState(''); 
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
  const [deliveryFee, setDeliveryFee] = useState(0); // [NEW] State for Delivery Fee
  const [transportStatus, setTransportStatus] = useState('');
  const [dealStatus, setDealStatus] = useState('');
  
  const [expenses, setExpenses] = useState([{ category: '', detail: '', price: 0 }]);
  // [MODIFIED] New State for Quotation List
  const [quotationItems, setQuotationItems] = useState([{ category: '', detail: '', price: 0 }]);
  // [MODIFIED] Updated State structure for Support Items
  const [customerSupportItems, setCustomerSupportItems] = useState([{ denomination: 20, quantity: 0, price: 0 }]);
  
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

  // [MODIFIED] Updated Title Logic to respect Tracking/Quotation modes and Shop Name
  useEffect(() => {
    // ถ้าอยู่ในโหมดติดตามหรือเสนอราคา ให้ข้ามการตั้งชื่อตาม Tab หลักไปเลย
    // ปล่อยให้ Component ลูก (CustomerTrackingView/CustomerQuotationView) จัดการชื่อเองเมื่อข้อมูลพร้อม
    if (trackingId) {
        document.title = "กำลังตรวจสอบสถานะ..."; 
        return;
    }
    if (quotationId) {
        document.title = "กำลังโหลดใบเสนอราคา...";
        return;
    }

    const appTitle = shopInfo?.shopName || 'NexusPlan';
    const currentTab = navItems.find(item => item.name === activeTab);
    
    if (currentTab) {
      document.title = `${currentTab.label} - ${appTitle}`;
    } else {
      document.title = `${appTitle} Dashboard`;
    }
  }, [activeTab, trackingId, quotationId, shopInfo]);

  const fetchSettings = async () => {
    if (!GOOGLE_SCRIPT_URL) {
        setIsSettingsLoaded(true);
        return;
    }
    
    // [MODIFIED] Add Timeout race to prevent indefinite loading if backend is slow
    // ให้เวลาโหลด Settings สูงสุด 5 วินาที ถ้าเกินให้แสดงผลเลย (ใช้ Default Theme)
    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('timeout'), 5000));
    
    try {
        const fetchPromise = fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getSettings' })
        });

        const response = await Promise.race([fetchPromise, timeoutPromise]);
        
        if (response === 'timeout') {
            console.warn('Settings fetch timed out, using defaults.');
            // ไม่ต้องทำอะไร ปล่อยให้ finally ทำงานเพื่อเปิดหน้าเว็บ
        } else {
            const result = await response.json();
            if (result.status === 'success' && result.data) {
                const data = result.data;
                if (data.project_categories) setProjectCategories(data.project_categories);
                if (data.expense_categories) setExpenseCategories(data.expense_categories);
                if (data.deal_statuses) setDealStatuses(data.deal_statuses);
                if (data.transport_statuses) setTransportStatuses(data.transport_statuses);
                if (data.drive_folder_id) setDriveFolderId(data.drive_folder_id);
                if (data.assets_drive_folder_id) setAssetsDriveFolderId(data.assets_drive_folder_id);
                
                // [ADDED] Load Chatbot Tokens from settings
                if (data.line_bot_token) setLineBotToken(data.line_bot_token);
                if (data.telegram_bot_token) setTelegramBotToken(data.telegram_bot_token);
                if (data.telegram_chat_id) setTelegramChatId(data.telegram_chat_id);
                if (data.web_app_url) setWebAppUrl(data.web_app_url);

                if (data.shop_info) {
                    setShopInfo(data.shop_info);
                    localStorage.setItem('nexus_shop_info', JSON.stringify(data.shop_info));
                }
                
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
                    // [ADDED] Cache credentials to localStorage for instant login next time
                    localStorage.setItem('nexus_authorized_users', JSON.stringify(creds));

                    // [NEW FIX] Sync current logged-in user profile with latest data from server
                    // แก้ปัญหารูปโปรไฟล์ไม่เปลี่ยนเมื่อ Login เครื่องอื่น หรือ Refresh
                    const currentLocalProfile = localStorage.getItem('nexus_profile');
                    if (currentLocalProfile) {
                        const currentObj = JSON.parse(currentLocalProfile);
                        const updatedUser = creds.find(u => u.username.toLowerCase() === currentObj.username.toLowerCase());
                        
                        if (updatedUser) {
                            // เช็คว่ารูปภาพหรือข้อมูลสำคัญเปลี่ยนไปไหม
                            if (updatedUser.image !== currentObj.image || updatedUser.name !== currentObj.name || updatedUser.role !== currentObj.role) {
                                const newProfile = {
                                    ...currentObj,
                                    name: updatedUser.name,
                                    role: updatedUser.role,
                                    email: updatedUser.email,
                                    phone: updatedUser.phone,
                                    image: updatedUser.image
                                };
                                // อัปเดตทั้งใน State และ LocalStorage ทันที
                                setUserProfile(newProfile);
                                localStorage.setItem('nexus_profile', JSON.stringify(newProfile));
                            }
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error fetching settings:", error);
    } finally {
        setIsSettingsLoaded(true); // Mark settings as loaded regardless of success/fail/timeout
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchProjects = async () => {
    if (!GOOGLE_SCRIPT_URL) return;
    setIsLoading(true);
    
    // [MODIFIED] Add timeout logic (15s) to prevent infinite loading if server is slow
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000));

    try {
      // Create the fetch promise
      const fetchPromise = fetch(GOOGLE_SCRIPT_URL, {
          method: 'POST',
          body: JSON.stringify({ action: 'read' })
      });

      // Race between fetch and timeout
      const response = await Promise.race([fetchPromise, timeoutPromise]);
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
            // [MODIFIED] Improved logic to merge customer info (keep latest available data including Address)
            if (item.customer) {
                const existing = customersMap.get(item.customer) || {};
                const info = item.customerInfo || {};
                
                customersMap.set(item.customer, {
                    name: item.customer,
                    social: info.social || existing.social || '',
                    line: info.line || existing.line || '',
                    phone: info.phone || existing.phone || '',
                    email: info.email || existing.email || '',
                    taxId: info.taxId || existing.taxId || '', 
                    address: info.address || existing.address || '' // [ADDED] Map Address for Auto-complete
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
      // [REMOVED] await fetchSettings(); // ตัดออกเพราะเรียกแยกใน useEffect แล้ว เพื่อความรวดเร็ว
    } catch (error) {
      console.error("Error fetching data:", error);
      showToast("การเชื่อมต่อล่าช้า ระบบกำลังทำงานในโหมด Offline", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn || trackingId || quotationId) { // [FIX] Add quotationId condition
        fetchProjects();
    }
  }, [isLoggedIn, trackingId, quotationId]);

  // [ADDED] Effect to Preload Images for Tracking/Quotation views
  useEffect(() => {
      if ((trackingId || quotationId) && allActivities.length > 0) {
          const targetToken = trackingId || quotationId;
          const foundItem = allActivities.find(item => 
              generateTrackingToken(item.id, item.rawDateTime) === targetToken
          );

          // [MODIFIED] Add Timeout to ensure page shows even if image is slow
          // ให้เวลารูปโหลดสูงสุด 3 วินาที ถ้าเกินให้แสดงหน้าเว็บเลย (รูปค่อยตามมา)
          const timer = setTimeout(() => {
              setAreImagesLoaded(true);
          }, 3000);

          if (foundItem && foundItem.image) {
              const img = new Image();
              img.src = processImageUrl(foundItem.image);
              // [FIX] Ensure state updates only if component mounted
              img.onload = () => {
                  clearTimeout(timer);
                  setAreImagesLoaded(true);
              };
              img.onerror = () => {
                  clearTimeout(timer);
                  setAreImagesLoaded(true); // แสดงผลแม้รูปเสีย
              };
          } else {
              clearTimeout(timer);
              setAreImagesLoaded(true); // ไม่มีรูป หรือไม่พบข้อมูล ให้แสดงผลเลย
          }
          
          return () => clearTimeout(timer);
      } else if (!trackingId && !quotationId) {
          setAreImagesLoaded(true); // หน้า Dashboard ปกติไม่ต้องรอ
      } else if ((trackingId || quotationId) && !isLoading && allActivities.length === 0) {
          // กรณีโหลดเสร็จแล้วแต่ไม่เจอข้อมูล ก็ให้ปลดล็อกเลย
          setAreImagesLoaded(true);
      }
  }, [allActivities, trackingId, quotationId, isLoading]);

  const saveSystemSettings = async (key, value) => {
      if (!GOOGLE_SCRIPT_URL) return;
      setIsSaving(true);
      
      // [MODIFIED] Support saving object (multiple keys) or single key
      const payloadData = (typeof key === 'object') ? key : { [key]: value };

      try {
          await fetch(GOOGLE_SCRIPT_URL, {
              method: 'POST',
              body: JSON.stringify({
                  action: 'saveSettings',
                  data: payloadData
              })
          });
          
          // Update Local States based on payload keys
          if (payloadData.app_credentials) {
              setAuthorizedUsers(payloadData.app_credentials);
              localStorage.setItem('nexus_authorized_users', JSON.stringify(payloadData.app_credentials));
          }
          if (payloadData.drive_folder_id) {
              setDriveFolderId(payloadData.drive_folder_id);
          }
          if (payloadData.assets_drive_folder_id) { 
              setAssetsDriveFolderId(payloadData.assets_drive_folder_id);
          }
          if (payloadData.line_bot_token !== undefined) {
              setLineBotToken(payloadData.line_bot_token);
          }
          if (payloadData.telegram_bot_token !== undefined) {
              setTelegramBotToken(payloadData.telegram_bot_token);
          }
          if (payloadData.telegram_chat_id !== undefined) { // [ADDED] Update Chat ID
              setTelegramChatId(payloadData.telegram_chat_id);
          }
          if (payloadData.web_app_url !== undefined) { 
              setWebAppUrl(payloadData.web_app_url);
          }
          if (payloadData.gemini_api_key !== undefined) {
              setGeminiApiKey(payloadData.gemini_api_key);
          }
          if (payloadData.shop_info) {
              setShopInfo(payloadData.shop_info);
              localStorage.setItem('nexus_shop_info', JSON.stringify(payloadData.shop_info));
          }
          showToast("บันทึกการตั้งค่าสำเร็จ", "success");
      } catch (error) {
          console.error("Error saving settings:", error);
          showToast("บันทึกการตั้งค่าไม่สำเร็จ", "error");
      } finally {
          setIsSaving(false);
      }
  };

  // [ADDED] Function to fetch latest Telegram Chat ID from backend
  const handleFetchTelegramId = async () => {
    if (!GOOGLE_SCRIPT_URL) return;
    showToast("กำลังดึง Chat ID ล่าสุด...", "info");
    try {
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'getLatestChatId' })
      });
      const result = await response.json();
      if (result.status === 'success' && result.chatId) {
        setTelegramChatId(result.chatId);
        showToast("ดึง Chat ID เรียบร้อย: " + result.chatId, "success");
      } else {
        showToast("ไม่พบ Chat ID ล่าสุด (ลองพิมพ์ /id หาบอทก่อน)", "error");
      }
    } catch (error) {
      showToast("เกิดข้อผิดพลาดในการดึง ID", "error");
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
      
      // [MODIFIED] Reduced delay from 1000ms to 100ms for instant feel
      // Previously, we waited for server sync, but now we use cached 'authorizedUsers' so check is instant.
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
                  username: foundUser.username,
                  image: foundUser.image 
              });

              setActiveTab('Overview'); 

              if (remember) {
                  localStorage.setItem('nexus_auth', 'true');
                  localStorage.setItem('nexus_profile', JSON.stringify({
                      name: foundUser.name,
                      role: foundUser.role,
                      email: foundUser.email,
                      phone: foundUser.phone,
                      username: foundUser.username,
                      image: foundUser.image
                  }));
              }
              showToast(`ยินดีต้อนรับคุณ ${foundUser.name}`, "success");
          } else {
              setLoginError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
              showToast("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", "error");
          }
          setIsLoading(false);
      }, 100); // Reduced delay
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
              setVisibleCount(prev => prev + 5);
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

  // [ADDED] Handle Profile Image Upload
  const handleProfileImageUpload = async (file) => {
      if (!file) return;
      
      // ตรวจสอบว่าตั้งค่า Assets Folder ID หรือยัง
      if (!assetsDriveFolderId && GOOGLE_SCRIPT_URL) {
          showToast("กรุณาระบุ Assets Folder ID ในตั้งค่าก่อนอัปโหลดรูปโปรไฟล์", "error");
          return;
      }

      setIsUploadingProfile(true);
      try {
          if (!file.type.startsWith('image/')) {
              throw new Error('กรุณาอัพโหลดไฟล์รูปภาพเท่านั้น');
          }

          // 1. Compress Image & Get Base64
          let processedFile = file;
          let base64Data = "";
          
          if (file.size > 2 * 1024 * 1024) { // ถ้าไฟล์ใหญ่กว่า 2MB ให้ย่อ
               base64Data = await compressImage(file);
          } else {
               base64Data = await toBase64(file);
          }

          // 2. Optimistic Update: แสดงรูปทันทีโดยใช้ Base64 (เพื่อให้ผู้ใช้เห็นว่ารูปเปลี่ยนทันที)
          const tempProfile = { ...userProfile, image: base64Data };
          setUserProfile(tempProfile);

          if (GOOGLE_SCRIPT_URL) {
              const cleanBase64 = base64Data.split(',')[1];
              const mimeType = base64Data.split(',')[0].match(/:(.*?);/)[1];
              const fileName = `profile_${userProfile.username}_${Date.now()}.jpg`;

              const response = await fetch(GOOGLE_SCRIPT_URL, {
                  method: 'POST',
                  body: JSON.stringify({
                      action: 'uploadAsset', 
                      data: {
                          fileData: cleanBase64,
                          mimeType: mimeType,
                          fileName: fileName,
                          folderId: assetsDriveFolderId
                      }
                  })
              });

              const result = await response.json();
              if (result.status === 'success' && result.url) {
                  // [MODIFIED] สร้างลิงก์แบบ uc?export=view สำหรับบันทึก (ตามที่ระบบใช้อยู่)
                  // แต่เมื่อแสดงผล processImageUrl จะแปลงเป็น thumbnail ให้เอง
                  let newImageUrl = result.url;
                  if (result.fileId) {
                      newImageUrl = `https://drive.google.com/uc?export=view&id=${result.fileId}`;
                  }
                  
                  // 3. Final Update: บันทึก URL จริงลง State
                  const finalProfile = { ...userProfile, image: newImageUrl };
                  setUserProfile(finalProfile);
                  localStorage.setItem('nexus_profile', JSON.stringify(finalProfile));

                  // 4. Update Authorized Users List
                  const updatedUsers = authorizedUsers.map(u => 
                      u.username.toLowerCase() === userProfile.username.toLowerCase() 
                      ? { ...u, image: newImageUrl } 
                      : u
                  );
                  setAuthorizedUsers(updatedUsers);

                  // 5. Sync to Backend Settings
                  await saveSystemSettings('app_credentials', updatedUsers);
                  
                  showToast("อัปเดตรูปโปรไฟล์สำเร็จ", "success");
              } else {
                  throw new Error(result.message || "Upload failed");
              }
          } else {
              // Offline Mode
              const updatedProfile = { ...userProfile, image: base64Data };
              setUserProfile(updatedProfile);
              localStorage.setItem('nexus_profile', JSON.stringify(updatedProfile));
              
              const updatedUsers = authorizedUsers.map(u => 
                  u.username.toLowerCase() === userProfile.username.toLowerCase() 
                  ? { ...u, image: base64Data } 
                  : u
              );
              setAuthorizedUsers(updatedUsers);
              showToast("เปลี่ยนรูปโปรไฟล์ (Offline)", "success");
          }

      } catch (error) {
          console.error(error);
          showToast("เกิดข้อผิดพลาด: " + error.message, "error");
      } finally {
          setIsUploadingProfile(false);
      }
  };

  // [ADDED] Handle Profile Image Delete Request (Open Modal)
  const requestDeleteProfile = () => {
      if (userProfile?.image) {
          setDeleteProfileConfirm(true);
      }
  };

  // [ADDED] Close Delete Profile Modal
  const closeDeleteProfileModal = () => {
      setIsDeleteProfileClosing(true);
      setTimeout(() => {
          setDeleteProfileConfirm(false);
          setIsDeleteProfileClosing(false);
      }, 300);
  };

  // [ADDED] Execute Profile Image Delete
  const executeDeleteProfile = async () => {
      // 0. Get File ID before removing from state
      const fileId = getFileId(userProfile?.image);

      // 1. Update Local State
      const updatedProfile = { ...userProfile, image: '' };
      setUserProfile(updatedProfile);
      localStorage.setItem('nexus_profile', JSON.stringify(updatedProfile));

      // 2. Update Authorized Users List
      const updatedUsers = authorizedUsers.map(u => 
          u.username.toLowerCase() === userProfile.username.toLowerCase() 
          ? { ...u, image: '' } 
          : u
      );
      setAuthorizedUsers(updatedUsers);

      // 3. Save to Backend & Delete File
      if (GOOGLE_SCRIPT_URL) {
          try {
              // Update Settings
              await saveSystemSettings('app_credentials', updatedUsers);
              
              // Delete actual file from Drive
              if (fileId) {
                  fetch(GOOGLE_SCRIPT_URL, {
                      method: 'POST',
                      body: JSON.stringify({ action: 'deleteFile', id: fileId })
                  }).catch(err => console.error("Failed to delete profile image from Drive:", err));
              }

              showToast("ลบรูปโปรไฟล์เรียบร้อยแล้ว", "success");
          } catch (error) {
              console.error("Error deleting profile image:", error);
              showToast("เกิดข้อผิดพลาดในการบันทึก", "error");
          }
      } else {
          showToast("ลบรูปโปรไฟล์เรียบร้อยแล้ว (Offline)", "success");
      }
      closeDeleteProfileModal();
  };

  // [ADDED] Handle Shop Logo Upload
  const handleLogoUpload = async (file) => {
      if (!file) return;
      
      if (!assetsDriveFolderId && GOOGLE_SCRIPT_URL) {
          showToast("กรุณาระบุ Assets Folder ID ในตั้งค่าก่อนอัปโหลดโลโก้", "error");
          return;
      }

      setIsUploadingLogo(true);
      try {
          if (!file.type.startsWith('image/')) {
              throw new Error('กรุณาอัพโหลดไฟล์รูปภาพเท่านั้น');
          }

          // 1. Compress Image & Get Base64
          let processedFile = file;
          let base64Data = "";
          
          if (file.size > 2 * 1024 * 1024) { 
               base64Data = await compressImage(file);
          } else {
               base64Data = await toBase64(file);
          }

          // 2. Optimistic Update
          const tempShopInfo = { ...shopInfo, logo: base64Data };
          setShopInfo(tempShopInfo);

          if (GOOGLE_SCRIPT_URL) {
              const cleanBase64 = base64Data.split(',')[1];
              const mimeType = base64Data.split(',')[0].match(/:(.*?);/)[1];
              const fileName = `shop_logo_${Date.now()}.jpg`;

              const response = await fetch(GOOGLE_SCRIPT_URL, {
                  method: 'POST',
                  body: JSON.stringify({
                      action: 'uploadAsset', 
                      data: {
                          fileData: cleanBase64,
                          mimeType: mimeType,
                          fileName: fileName,
                          folderId: assetsDriveFolderId
                      }
                  })
              });

              const result = await response.json();
              if (result.status === 'success' && result.url) {
                  let newLogoUrl = result.url;
                  // Force uc?export=view
                  if (result.fileId) {
                      newLogoUrl = `https://drive.google.com/uc?export=view&id=${result.fileId}`;
                  } else if (newLogoUrl.includes('id=')) {
                      const idMatch = newLogoUrl.match(/id=([a-zA-Z0-9_-]+)/);
                      if (idMatch && idMatch[1]) {
                          newLogoUrl = `https://drive.google.com/uc?export=view&id=${idMatch[1]}`;
                      }
                  }
                  
                  // 3. Final Update & Save
                  const finalShopInfo = { ...shopInfo, logo: newLogoUrl };
                  setShopInfo(finalShopInfo);
                  await saveSystemSettings('shop_info', finalShopInfo);
                  
                  showToast("อัปเดตโลโก้ร้านค้าสำเร็จ", "success");
              } else {
                  throw new Error(result.message || "Upload failed");
              }
          } else {
              // Offline Mode
              const updatedShopInfo = { ...shopInfo, logo: base64Data };
              setShopInfo(updatedShopInfo);
              showToast("เปลี่ยนโลโก้ร้านค้า (Offline)", "success");
          }

      } catch (error) {
          console.error(error);
          showToast("เกิดข้อผิดพลาด: " + error.message, "error");
      } finally {
          setIsUploadingLogo(false);
      }
  };

  // [ADDED] Handle Shop Logo Delete Request (Open Modal)
  const requestDeleteLogo = () => {
      if (shopInfo.logo) {
          setDeleteLogoConfirm(true);
      }
  };

  // [ADDED] Close Delete Logo Modal
  const closeDeleteLogoModal = () => {
      setIsDeleteLogoClosing(true);
      setTimeout(() => {
          setDeleteLogoConfirm(false);
          setIsDeleteLogoClosing(false);
      }, 300);
  };

  // [ADDED] Execute Shop Logo Delete
  const executeDeleteLogo = async () => {
      const fileId = getFileId(shopInfo.logo);

      // Optimistic Update
      const tempShopInfo = { ...shopInfo, logo: '' };
      setShopInfo(tempShopInfo);

      if (GOOGLE_SCRIPT_URL) {
          try {
              // Update Settings
              await saveSystemSettings('shop_info', tempShopInfo);
              
              // Delete actual file from Drive
              if (fileId) {
                  fetch(GOOGLE_SCRIPT_URL, {
                      method: 'POST',
                      body: JSON.stringify({ action: 'deleteFile', id: fileId })
                  }).catch(err => console.error("Failed to delete logo from Drive:", err));
              }

              showToast("ลบโลโก้เรียบร้อยแล้ว", "success");
          } catch (error) {
              console.error("Error deleting logo settings:", error);
              showToast("เกิดข้อผิดพลาดในการบันทึกการลบ", "error");
          }
      } else {
          showToast("ลบโลโก้เรียบร้อยแล้ว (Offline)", "success");
      }
      closeDeleteLogoModal();
  };

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
      
      // [FIX] ป้องกันการ Render ซ้ำซ้อนโดยเช็คค่าก่อน Set State
      const shouldBeScrolled = savedPosition > 0;
      if (isScrolled !== shouldBeScrolled) {
         setIsScrolled(shouldBeScrolled);
      }
    }
  }, [activeTab]); // ลบ isScrolled ออกจาก dependency เพื่อป้องกัน loop

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
      
      // [FIX] Added logic for 'active_only' transport filter to exclude completed/cancelled items
      let matchesTransport = true;
      if (filterTransport === 'active_only') {
          matchesTransport = 
            item.transportStatus !== 'delivered' && 
            item.transportStatus !== 'completed' && 
            item.transportStatus !== 'issue' && 
            item.transportStatus !== 'cancelled';
      } else {
          matchesTransport = filterTransport === 'all' || item.transportStatus === filterTransport;
      }

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

  // [OPTIMIZATION] Memoize Analytics Calculations - แก้ปัญหา Lag โดยย้ายการคำนวณหนักๆ มาไว้ที่นี่
  const analyticsData = useMemo(() => {
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

    return {
        currentRevenue, currentSupport, currentCost, currentProfit,
        totalProjects, completedProjects, activeProjects, pendingProjects, issueProjects, declinedProjects,
        allExpensesList, maxExpense,
        topPerformers, maxPerformerRevenue,
        topCustomers, maxCustomerRevenue,
        topCustomerByProjects, maxCustomerProjectCount,
        categoryData
    };
  }, [filteredAndSortedActivities]); // คำนวณใหม่เฉพาะเมื่อข้อมูลเปลี่ยน

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
      setCustomerTaxId(existingCustomer.taxId || '');
      // [ADDED] Load address from saved customer
      setCustomerAddress(existingCustomer.address || ''); 
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
        setCustomerTaxId(activity.customerInfo.taxId || '');
        // [ADDED] Load address
        setCustomerAddress(activity.customerInfo.address || ''); 
      } else {
        setCustomerSocial('');
        setCustomerLine('');
        setCustomerPhone('');
        setCustomerEmail('');
        setCustomerTaxId('');
        // [ADDED] Reset address
        setCustomerAddress(''); 
      }
      setDeliveryStart(activity.rawDeliveryStart || '');
      setDeliveryEnd(activity.rawDeliveryEnd || activity.rawDeliveryDateTime || '');

      setRecipientName(activity.recipient || '');
      setRecipientPhone(activity.recipientPhone || '');
      setLocationName(activity.location || '');
      setMapLink(activity.mapLink || '');
      setUploadedImage(activity.image || null); // Load existing image
      
      // [MODIFIED] Load Quotation Items or migrate from legacy wage/deliveryFee
      if (activity.quotationItems && activity.quotationItems.length > 0) {
          setQuotationItems(activity.quotationItems);
          // Calculate total wage for display consistency if needed, but we rely on items now
          const totalWage = activity.quotationItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
          setWage(totalWage);
      } else {
          // Backward compatibility: Convert legacy wage/delivery to list items
          const initialItems = [];
          if (activity.wage > 0) initialItems.push({ category: 'ค่าบริการ/อุปกรณ์', detail: 'ค่าจ้างเดิม', price: activity.wage });
          if (activity.deliveryFee > 0) initialItems.push({ category: 'ค่าจัดส่ง', detail: 'ค่าส่งเดิม', price: activity.deliveryFee });
          
          if (initialItems.length === 0) initialItems.push({ category: '', detail: '', price: 0 });
          setQuotationItems(initialItems);
          setWage(activity.wage || 0);
      }

      // [MODIFIED] Load Customer Support Items with fallback
      if (activity.customerSupport && activity.customerSupport.length > 0) {
          // Check if it's new format (has denomination) or old format
          const mappedSupport = activity.customerSupport.map(item => {
              if (item.denomination !== undefined) return item;
              // Migrate old format: detail -> price (assume custom amount)
              return { denomination: 1, quantity: item.price, price: item.price }; 
          });
          setCustomerSupportItems(mappedSupport);
      } else {
          setCustomerSupportItems([{ denomination: 20, quantity: 0, price: 0 }]);
      }

      setExpenses(activity.expenses && activity.expenses.length > 0 ? activity.expenses : [{ category: '', detail: '', price: 0 }]);
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
      setCustomerTaxId('');
      // [ADDED] Reset address
      setCustomerAddress(''); 
      setRecipientName('');
      setRecipientPhone('');
      setLocationName('');
      setMapLink('');
      setUploadedImage(null);
      setNote('');
      setWage(0);
      setDeliveryFee(0); // [NEW] Reset Delivery Fee
      setExpenses([{ category: '', detail: '', price: 0 }]);
      setQuotationItems([{ category: '', detail: '', price: 0 }]); // Reset Quotation
      setCustomerSupportItems([{ denomination: 20, quantity: 0, price: 0 }]); // Reset Support
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
        email: customerEmail,
        taxId: customerTaxId,
        // [ADDED] Save address to customer list
        address: customerAddress 
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

    // Calculate totals for summary fields
    const totalQuotation = quotationItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);

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
        email: customerEmail,
        taxId: customerTaxId,
        // [ADDED] Save address to activity data
        address: customerAddress 
      },
      date: displayDate,
      rawDateTime: projectDateTime,
      deliveryDate: displayDeliveryDate,
      rawDeliveryStart: deliveryStart,
      rawDeliveryEnd: deliveryEnd,
      rawDeliveryDateTime: deliveryEnd, 
      wage: totalQuotation, // Save total as wage for table sorting/display
      deliveryFee: 0, // Deprecated in favor of quotationItems, set 0 or keep for legacy
      quotationItems: quotationItems, // [NEW] Save detailed quotation
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

  // [NEW] Quotation Handlers
  const handleAddQuotationItem = () => {
    setQuotationItems([...quotationItems, { category: '', detail: '', price: 0 }]);
  };

  const handleRemoveQuotationItem = (index) => {
    const newItems = quotationItems.filter((_, i) => i !== index);
    setQuotationItems(newItems);
  };

  const handleQuotationItemChange = (index, field, value) => {
    const newItems = [...quotationItems];
    newItems[index][field] = value;
    setQuotationItems(newItems);
  };

  // [NEW] Support Item Handlers with Calculator Logic
  const handleAddSupportItem = () => {
    setCustomerSupportItems([...customerSupportItems, { denomination: 20, quantity: 0, price: 0 }]);
  };

  const handleRemoveSupportItem = (index) => {
    const newItems = customerSupportItems.filter((_, i) => i !== index);
    setCustomerSupportItems(newItems);
  };

  // [REMOVED] handleSendToChatbot function as requested

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

    // [ADDED] Helper to get dot color based on status color class (Consistent with Settings)
    const getStatusDotColor = (info) => {
        if (!info || !info.color) return 'bg-slate-400';
        
        // 1. Try to find exact match in presets (for custom statuses added via Settings)
        const preset = colorPresets.find(p => p.value === info.color);
        if (preset) return preset.dot;

        // 2. Heuristic match for system defaults or manual colors
        if (info.color.includes('emerald') || info.color.includes('green')) return 'bg-emerald-500';
        if (info.color.includes('blue') || info.color.includes('indigo') || info.color.includes('sky')) return 'bg-blue-500';
        if (info.color.includes('amber') || info.color.includes('yellow') || info.color.includes('orange')) return 'bg-amber-500';
        if (info.color.includes('rose') || info.color.includes('red') || info.color.includes('pink')) return 'bg-rose-500';
        if (info.color.includes('purple') || info.color.includes('violet')) return 'bg-violet-500';
        
        return 'bg-slate-400';
    };

    return (
      <div className="w-full">
        {/* Mobile View (Card Layout) - Restored */}
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
                          <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(dealStatusInfo)}`}></span>
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
                {/* [MODIFIED] Mobile Action Buttons - Chatbot Button Removed */}
                <div className="grid grid-cols-3 gap-2 mt-2">
                    <button 
                        onClick={(e) => handleDeleteFromTable(e, item.id)} 
                        className="flex items-center justify-center gap-1.5 py-2.5 bg-rose-50 border border-rose-100 text-rose-600 font-bold hover:bg-rose-100 rounded-xl transition shadow-sm"
                        title="ลบรายการ"
                    >
                        <Trash2 className="w-4 h-4" /> 
                    </button>
                    <button 
                        onClick={(e) => handleEditFromTable(e, item)} 
                        className="flex items-center justify-center gap-1.5 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
                    >
                        <Edit className="w-4 h-4" /> แก้ไข
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); setShareData(item); }} 
                        className="flex items-center justify-center gap-1.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold rounded-xl transition-colors shadow-sm"
                        title="แชร์ให้ลูกค้า"
                    >
                        <Share2 className="w-4 h-4" /> แชร์
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
            {/* Desktop Table Container with responsive constraints */}
            <div className="overflow-x-auto overflow-y-hidden pb-4 custom-scrollbar">
              {/* [MODIFIED] Removed max-w constraint to let table grow with screen */}
              <div className="min-w-fit w-full">
                {/* [MODIFIED] Changed table-fixed to table-auto for better content adaptation */}
                <table className="w-full min-w-[1280px] table-auto">
                  <thead>
                    <tr className="text-slate-400 text-sm font-semibold border-b border-slate-50">
                      {/* [MODIFIED] Adjusted widths to be relative/min-width for table-auto */}
                      <SortableHeader className="w-[12%] min-w-[120px]" label="รหัส / วันที่" sortKey="id" sortConfig={sortConfig} handleSort={handleSort} />
                      <SortableHeader className="w-[18%] min-w-[200px]" label="โปรเจค / หมวดหมู่" sortKey="name" sortConfig={sortConfig} handleSort={handleSort} />
                      <SortableHeader className="w-[12%] min-w-[150px]" label="ศิลปิน / ลูกค้า" sortKey="artist" sortConfig={sortConfig} handleSort={handleSort} />
                      <SortableHeader className="w-[12%] min-w-[150px]" label="ผู้รับ / เบอร์โทร" sortKey="recipient" sortConfig={sortConfig} handleSort={handleSort} />
                      <SortableHeader className="w-[14%] min-w-[180px]" label="กำหนดส่ง / สถานที่" sortKey="rawDeliveryDateTime" sortConfig={sortConfig} handleSort={handleSort} />
                      <SortableHeader className="w-[10%] min-w-[120px]" label="สถานะ" sortKey="dealStatus" sortConfig={sortConfig} handleSort={handleSort} />
                      <SortableHeader className="w-[10%] min-w-[100px]" label="การเงิน (บาท)" sortKey="wage" alignRight sortConfig={sortConfig} handleSort={handleSort} />
                      <SortableHeader className="w-[8%] min-w-[100px]" label="หมายเหตุ" sortKey="note" sortConfig={sortConfig} handleSort={handleSort} />
                      <th className="w-[8%] min-w-[100px] px-2 py-4 font-medium text-right whitespace-nowrap">ดำเนินการ</th>
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
                          <td className="px-4 py-4 align-top">
                            <div className="flex flex-col gap-1">
                              <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg text-xs w-fit whitespace-nowrap">{item.id}</span>
                              {/* [MODIFIED] Date: whitespace-nowrap to prevent truncation */}
                              <div className="flex items-center gap-1.5 text-slate-500 text-xs mt-1 whitespace-nowrap">
                                <Clock className="w-3 h-3 shrink-0" />
                                {item.date}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="flex flex-col gap-1 w-full">
                              {/* [MODIFIED] Project Name: whitespace-normal break-words to wrap text */}
                              <span className="font-bold text-slate-800 text-sm whitespace-normal break-words leading-tight" title={item.name}>{item.name}</span>
                              <div className="flex items-center gap-1.5 text-xs text-slate-500 whitespace-nowrap">
                                <Tag className="w-3 h-3 shrink-0" />
                                {item.category}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="flex flex-col gap-1.5 w-full">
                              <div className="flex items-center gap-2 whitespace-normal break-words">
                                <User className="w-3 h-3 text-indigo-500 shrink-0" />
                                <span className="text-sm font-semibold text-slate-700">{item.artist}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-500 whitespace-normal break-words">
                                <Briefcase className="w-3 h-3 shrink-0" />
                                <span>{item.customer}</span>
                              </div>
                            </div>
                          </td>
                          {/* [MODIFIED] Recipient Column: Allow wrapping */}
                          <td className="px-4 py-4 align-top">
                            <div className="flex flex-col gap-1 w-full">
                              <div className="text-sm font-medium text-slate-700 whitespace-normal break-words" title={item.recipient || '-'}>{item.recipient || '-'}</div>
                              {item.recipientPhone && (
                                <a 
                                  href={`tel:${item.recipientPhone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 hover:underline transition-colors w-fit whitespace-nowrap"
                                >
                                  <Phone className="w-3 h-3 shrink-0" />
                                  {item.recipientPhone}
                                </a>
                              )}
                            </div>
                          </td>
                          {/* [MODIFIED] Delivery Column: Prevent wrapping for time, allow wrapping for location */}
                          <td className="px-4 py-4 align-top">
                            <div className="flex flex-col gap-1 w-full">
                              <div className="flex items-center gap-1.5 text-slate-700 text-sm font-medium whitespace-nowrap">
                                <Clock className="w-3 h-3 text-indigo-500 shrink-0" />
                                <div>{renderDeliveryTime(item)}</div>
                              </div>
                              <div className="flex items-start gap-1.5 text-xs text-slate-500">
                                <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                                {item.mapLink ? (
                                  <a 
                                    href={item.mapLink} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    onClick={(e) => e.stopPropagation()} 
                                    className="text-blue-600 hover:underline whitespace-normal break-words w-full leading-tight"
                                    title={item.location}
                                  >
                                    {item.location || '-'}
                                  </a>
                                ) : (
                                  <span className="whitespace-normal break-words w-full leading-tight" title={item.location}>{item.location || '-'}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="flex flex-col gap-2 items-start w-full">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border w-full max-w-[140px] truncate ${dealStatusInfo.color}`}>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStatusDotColor(dealStatusInfo)}`}></span>
                                <span className="truncate">{dealStatusInfo.label}</span>
                              </span>
                              <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border w-full max-w-[140px] truncate ${transportStatusInfo.color}`}>
                                <Truck className="w-3 h-3 shrink-0" />
                                <span className="truncate">{transportStatusInfo.label}</span>
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top text-right">
                              <div className="flex flex-col gap-1 items-end w-full">
                                <span className="text-sm font-black text-slate-800 whitespace-nowrap" title="ยอดเรียกเก็บสุทธิ">
                                  ฿{itemReceivable.toLocaleString()}
                                </span>
                                <div className="text-xs text-slate-400 flex gap-1 items-center justify-end w-full whitespace-nowrap">
                                    <span className="text-emerald-600" title="ค่าจ้าง">{item.wage.toLocaleString()}</span>
                                    {itemSupport > 0 && <span className="text-blue-500" title="สนับสนุน">+{itemSupport.toLocaleString()}</span>}
                                </div>
                                <span className="text-xs text-rose-500 font-medium flex items-center justify-end gap-1 w-full whitespace-nowrap" title="รายจ่าย">
                                  <TrendingDown className="w-3 h-3 shrink-0" /> -{itemExpenses.toLocaleString()}
                                </span>
                                <span className={`text-xs font-bold ${itemProfit >= 0 ? 'text-indigo-600' : 'text-rose-600'} border-t border-slate-100 pt-1 mt-1 w-full text-right whitespace-nowrap`} title="กำไรสุทธิ">
                                  {itemProfit >= 0 ? '+' : ''}{itemProfit.toLocaleString()}
                                </span>
                              </div>
                          </td>
                          <td className="px-4 py-4 align-top">
                              <div className="text-sm text-slate-600 whitespace-normal break-words line-clamp-3" title={item.note}>
                                {item.note || '-'}
                              </div>
                          </td>
                          <td className="px-2 py-4 align-top text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); setShareData(item); }}
                                className="p-2 bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 rounded-lg transition shadow-sm"
                                title="แชร์"
                              >
                                <Share2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => handleEditFromTable(e, item)}
                                className="p-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg transition shadow-sm"
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
                      <option value="active_only">กำลังดำเนินการ (Active)</option> {/* Added Option */}
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
                        <option value="active_only">กำลังดำเนินการ (Active)</option> {/* Added Option */}
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
        // [MODIFIED] Check isSettingsLoaded AND areImagesLoaded to ensure theme & images are ready before text
        // ป้องกันการแสดงผลด้วยสี Indigo ก่อนที่ธีมจะโหลดเสร็จ และป้องกันรูปกระพริบ
        if ((isLoading && allActivities.length === 0) || !isSettingsLoaded || !areImagesLoaded) {
            return (
                <div className="flex flex-col items-center justify-center h-screen w-full bg-slate-50">
                    <Loader2 className="w-12 h-12 text-slate-400 animate-spin mb-4" />
                    <p className="text-slate-500 font-bold text-lg animate-pulse">กำลังค้นหาข้อมูลพัสดุ...</p>
                </div>
            );
        }
        
        // [FIX] Match against generated token instead of direct ID for security
        const trackData = allActivities.find(item => 
            generateTrackingToken(item.id, item.rawDateTime) === trackingId
        );
        
        if (!trackData) {
             return (
                <div className="flex flex-col items-center justify-center h-screen w-full bg-slate-50 px-4 text-center">
                    <div className="p-4 bg-slate-200 rounded-full text-slate-500 mb-4">
                       <Search className="w-12 h-12" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 mb-2">ไม่พบข้อมูลงาน</h2>
                    <p className="text-slate-500 mb-6">รหัสติดตาม: <span className="font-mono font-bold text-indigo-600 break-all">{trackingId}</span> ไม่ถูกต้อง หรือถูกลบไปแล้ว</p>
                    {/* [REMOVED] Back to Home button for security */}
                </div>
             );
        }

        // [MODIFIED] Pass dealStatuses and transportStatuses props
        return <CustomerTrackingView data={trackData} shopInfo={shopInfo} dealStatuses={dealStatuses} transportStatuses={transportStatuses} />;
    }

    // [NEW] Quotation View Logic
    if (quotationId) {
        // [MODIFIED] Check isSettingsLoaded AND areImagesLoaded to ensure theme & images are ready before text
        if ((isLoading && allActivities.length === 0) || !isSettingsLoaded || !areImagesLoaded) {
            return (
                <div className="flex flex-col items-center justify-center h-screen w-full bg-slate-50">
                    <Loader2 className="w-12 h-12 text-slate-400 animate-spin mb-4" />
                    <p className="text-slate-500 font-bold text-lg animate-pulse">กำลังโหลดใบเสนอราคา...</p>
                </div>
            );
        }
        
        const quoteData = allActivities.find(item => 
            generateTrackingToken(item.id, item.rawDateTime) === quotationId
        );
        
        if (!quoteData) {
             return (
                <div className="flex flex-col items-center justify-center h-screen w-full bg-slate-50 px-4 text-center">
                    <div className="p-4 bg-slate-200 rounded-full text-slate-500 mb-4">
                       <FileText className="w-12 h-12" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 mb-2">ไม่พบข้อมูลใบเสนอราคา</h2>
                    <p className="text-slate-500 mb-6">รหัสเอกสาร: <span className="font-mono font-bold text-indigo-600 break-all">{quotationId}</span> ไม่ถูกต้อง หรือถูกลบไปแล้ว</p>
                    {/* [REMOVED] Back to Home button for security */}
                </div>
             );
        }

        // [MODIFIED] Pass dealStatuses prop to resolve labels correctly
        return <CustomerQuotationView data={quoteData} shopInfo={shopInfo} dealStatuses={dealStatuses} />;
    }

    // 2. ถ้าไม่มี Tracking ID ก็เข้า Flow ปกติ (Login -> Dashboard)
    if (!isLoggedIn) {
        return <LoginScreen onLogin={handleLogin} isLoading={isLoading} loginError={loginError} />;
    }
    // [MODIFIED] Use isSettingsLoaded to prevent flash of wrong theme
    if ((isLoading && allActivities.length === 0) || !isSettingsLoaded) {
      return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)] w-full">
            <Loader2 className="w-12 h-12 text-slate-400 animate-spin mb-4" />
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

    // [OPTIMIZATION] Destructure Data for Persistent Views
    // เตรียมข้อมูล Analytics ไว้เสมอ (เพราะเราจะ Render ทิ้งไว้แบบ hidden)
    const {
        currentRevenue, currentSupport, currentCost, currentProfit,
        totalProjects, completedProjects, activeProjects, pendingProjects, issueProjects, declinedProjects,
        allExpensesList, maxExpense,
        topPerformers, maxPerformerRevenue,
        topCustomers, maxCustomerRevenue,
        topCustomerByProjects, maxCustomerProjectCount,
        categoryData
    } = analyticsData;

    // [PERFORMANCE FIX] ใช้เทคนิค Persistent Layout (ซ่อน/แสดง) แทนการ Unmount Component เพื่อความลื่นไหลสูงสุด
    return (
      <>
        {/* --- Tab 1: Overview --- */}
        <div className={activeTab === 'Overview' ? 'block space-y-8 px-4 sm:px-8 lg:px-10 pt-6 pb-24 md:pb-6' : 'hidden'}>
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

        {/* --- Tab 2: Calendar --- */}
        <div className={activeTab === 'Calendar' ? 'block h-full' : 'hidden'}>
          <CalendarView 
            activities={allActivities} 
            onEventClick={(item) => openModal(item, true)} 
            // [MODIFIED] Pass Statuses to Calendar for resolving custom IDs
            dealStatuses={dealStatuses}
            transportStatuses={transportStatuses}
          />
        </div>

        {/* --- Tab 3: Analytics --- */}
        <div className={activeTab === 'Analytics' ? 'block space-y-8 flex flex-col min-h-full pb-24 md:pb-6' : 'hidden'}>
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
                   <p className="text-sm text-rose-600 mt-1 font-medium">
                     Cost: {currentRevenue > 0 ? ((currentCost/currentRevenue)*100).toFixed(1) : 0}%
                   </p>
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
                <div 
                    onClick={resetFilters}
                    className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center hover:border-indigo-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer active:scale-95"
                >
                     <div className="mb-2 p-2 bg-slate-50 text-slate-500 rounded-full"><Folder className="w-5 h-5" /></div>
                     <div className="text-2xl font-black text-slate-800">{totalProjects}</div>
                     <div className="text-xs font-bold text-slate-500 mt-1">โครงการทั้งหมด</div>
                </div>

                <div 
                    onClick={() => { setFilterStatus('confirmed'); setFilterTransport('delivered'); }}
                    className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center hover:border-emerald-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer active:scale-95"
                >
                     <div className="mb-2 p-2 bg-emerald-50 text-emerald-500 rounded-full"><CheckCircle className="w-5 h-5" /></div>
                     <div className="text-2xl font-black text-emerald-600">{completedProjects}</div>
                     <div className="text-xs font-bold text-emerald-500 mt-1">งานเสร็จสิ้น</div>
                </div>

                <div 
                    onClick={() => { setFilterStatus('confirmed'); setFilterTransport('active_only'); }}
                    className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center hover:border-blue-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer active:scale-95"
                >
                     <div className="mb-2 p-2 bg-blue-50 text-blue-500 rounded-full"><Activity className="w-5 h-5" /></div>
                     <div className="text-2xl font-black text-blue-600">{activeProjects}</div>
                     <div className="text-xs font-bold text-blue-500 mt-1">กำลังดำเนินการ</div>
                </div>

                <div 
                    onClick={() => { setFilterStatus('pending'); setFilterTransport('all'); }}
                    className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center hover:border-amber-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer active:scale-95"
                >
                     <div className="mb-2 p-2 bg-amber-50 text-amber-500 rounded-full"><Clock className="w-5 h-5" /></div>
                     <div className="text-2xl font-black text-amber-600">{pendingProjects}</div>
                     <div className="text-xs font-bold text-amber-500 mt-1">รอดำเนินการ</div>
                </div>

                <div 
                    onClick={() => { setFilterStatus('cancelled'); setFilterTransport('all'); }}
                    className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center hover:border-rose-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer active:scale-95"
                >
                     <div className="mb-2 p-2 bg-rose-50 text-rose-500 rounded-full"><AlertTriangle className="w-5 h-5" /></div>
                     <div className="text-2xl font-black text-rose-600">{issueProjects}</div>
                     <div className="text-xs font-bold text-rose-500 mt-1">ยกเลิก/มีปัญหา</div>
                </div>

                 <div 
                    onClick={() => { setFilterStatus('declined'); setFilterTransport('all'); }}
                    className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center hover:border-gray-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer active:scale-95"
                >
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

        {/* --- Tab 4: Plans --- */}
        <div className={activeTab === 'Plans' ? 'block space-y-8 flex flex-col min-h-full pb-24 md:pb-6' : 'hidden'}>
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

        {/* --- Tab 5: Settings --- */}
        <div className={activeTab === 'Settings' ? 'block space-y-8 px-4 sm:px-8 lg:px-10 pt-6 pb-24 md:pb-6' : 'hidden'}>
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-extrabold text-slate-900 mb-6">ตั้งค่าระบบ</h2>
              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden mb-8">
                <div className="h-48 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 relative">
                  <div className="absolute right-6 top-6">
                     {/* [MODIFIED] Camera Button to Trigger File Input */}
                     <label className={`p-2 bg-white/20 backdrop-blur-md text-white rounded-xl hover:bg-white/30 transition shadow-sm cursor-pointer flex items-center justify-center ${isUploadingProfile ? 'opacity-50 pointer-events-none' : ''}`}>
                        {isUploadingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                        <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => e.target.files[0] && handleProfileImageUpload(e.target.files[0])}
                        />
                     </label>
                  </div>
                </div>
                <div className="px-8 pb-8">
                   <div className="flex flex-col items-center sm:items-start relative">
                      <div className="-mt-16 mb-6 relative z-10">
                         <div className="w-32 h-32 bg-white p-1.5 rounded-full shadow-2xl ring-4 ring-white/50 relative group">
                            {/* [MODIFIED] Display Profile Image */}
                            <div className="w-full h-full bg-slate-100 text-slate-600 rounded-full flex items-center justify-center text-4xl font-black border border-slate-200 overflow-hidden relative">
                               {userProfile?.image ? (
                                   <img 
                                        src={processImageUrl(userProfile.image)} 
                                        alt="Profile" 
                                        className="w-full h-full object-cover" 
                                        referrerPolicy="no-referrer"
                                        onError={(e) => {
                                            e.target.onerror = null; 
                                            // Fallback if image fails to load
                                            e.target.style.display = 'none';
                                            e.target.parentElement.classList.add('bg-slate-200');
                                            e.target.parentElement.innerHTML = `<span class="text-4xl text-slate-400">${userProfile?.name?.charAt(0) || 'U'}</span>`;
                                        }}
                                   />
                               ) : (
                                   userProfile?.name?.charAt(0) || 'U'
                               )}
                               
                               {/* Hover Overlay for upload (Still available on center click) */}
                               <label className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10">
                                    <Camera className="w-8 h-8 text-white drop-shadow-md" />
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        className="hidden" 
                                        onChange={(e) => e.target.files[0] && handleProfileImageUpload(e.target.files[0])}
                                    />
                               </label>
                            </div>
                            
                            {isUploadingProfile && (
                                <div className="absolute inset-0 flex items-center justify-center bg-white/50 rounded-full z-20 backdrop-blur-sm">
                                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                                </div>
                            )}

                            {/* [MODIFIED] Profile Action Buttons */}
                            {/* 1. Upload Button (Bottom-Left) */}
                            <label className={`absolute bottom-0 left-0 p-2.5 bg-white text-indigo-600 rounded-full shadow-lg border border-slate-100 cursor-pointer hover:bg-indigo-50 transition-all z-30 ${isUploadingProfile ? 'pointer-events-none opacity-80' : ''}`}>
                                {isUploadingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    disabled={isUploadingProfile}
                                    onChange={(e) => e.target.files[0] && handleProfileImageUpload(e.target.files[0])}
                                />
                            </label>

                            {/* 2. Delete Button (Bottom-Right) - Changed position as requested */}
                            {userProfile?.image && !isUploadingProfile && (
                                <button
                                    onClick={requestDeleteProfile}
                                    className="absolute bottom-0 right-0 p-2.5 bg-white text-rose-500 border border-slate-200 rounded-full shadow-md hover:bg-rose-50 hover:text-rose-600 transition-all z-30 group/delete"
                                    title="ลบรูปโปรไฟล์"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            )}
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
                                      {/* [MODIFIED] User Avatar in List - Show Image if available */}
                                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-slate-700 font-bold border border-slate-200 shadow-sm shrink-0 overflow-hidden relative">
                                          {user.image ? (
                                              <>
                                                  <img 
                                                      src={processImageUrl(user.image)} 
                                                      alt={user.name} 
                                                      className="w-full h-full object-cover"
                                                      referrerPolicy="no-referrer"
                                                      onError={(e) => { 
                                                          e.target.style.display = 'none'; 
                                                          if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                                                      }}
                                                  />
                                                  <div className="hidden absolute inset-0 w-full h-full items-center justify-center bg-white text-slate-700">
                                                      {user.name.charAt(0).toUpperCase()}
                                                  </div>
                                              </>
                                          ) : (
                                              user.name.charAt(0).toUpperCase()
                                          )}
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
                      
                      {/* Main Data Folder */}
                      <div className="mb-6">
                          <label className="text-sm font-bold text-slate-700 mb-1 block">
                              โฟลเดอร์เก็บข้อมูลงาน (Work Data)
                          </label>
                          <p className="text-xs text-slate-500 mb-3">
                              ระบุ Folder ID สำหรับเก็บรูปภาพงานและเอกสารโครงการ
                          </p>
                          <div className="flex flex-col sm:flex-row gap-3">
                              <input
                                  type="text"
                                  placeholder="Work Data Folder ID (e.g., 1xYz...)"
                                  value={driveFolderId}
                                  onChange={(e) => setDriveFolderId(e.target.value)}
                                  className="w-full sm:flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all min-w-0"
                              />
                              <button
                                  onClick={() => saveSystemSettings('drive_folder_id', driveFolderId)}
                                  className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-sm transition flex items-center justify-center gap-2 shrink-0"
                              >
                                  <Save className="w-4 h-4" /> บันทึก
                              </button>
                          </div>
                      </div>

                      {/* Assets/Media Folder */}
                      <div className="pt-6 border-t border-slate-100">
                          <label className="text-sm font-bold text-slate-700 mb-1 block flex items-center gap-2">
                              โฟลเดอร์เก็บไฟล์ตกแต่ง (Assets & Media)
                              <span className="bg-blue-100 text-blue-600 text-[10px] px-2 py-0.5 rounded-full">New</span>
                          </label>
                          <p className="text-xs text-slate-500 mb-3">
                              ระบุ Folder ID สำหรับเก็บ Logo ร้าน, รูปโปรไฟล์ผู้ใช้ และไฟล์ตกแต่ง UI อื่นๆ (แยกจากข้อมูลงาน)
                          </p>
                          <div className="flex flex-col sm:flex-row gap-3">
                              <input
                                  type="text"
                                  placeholder="Assets Folder ID (e.g., 1xYz...)"
                                  value={assetsDriveFolderId}
                                  onChange={(e) => setAssetsDriveFolderId(e.target.value)}
                                  className="w-full sm:flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all min-w-0"
                              />
                              <button
                                  onClick={() => saveSystemSettings('assets_drive_folder_id', assetsDriveFolderId)}
                                  className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-sm transition shrink-0"
                              >
                                  บันทึก ID
                              </button>
                          </div>
                      </div>
                  </div>
              </div>

              {/* [ADDED] Chatbot AI Settings Card - Positioned below Google Drive */}
              <div className="mb-8">
                  <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <Bot className="w-5 h-5 text-sky-600" />
                      เชื่อมต่อ Chatbot AI (Access Tokens)
                  </h3>
                  <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                      <div className="grid grid-cols-1 gap-6">
                          {/* Line Bot Token */}
                          <div className="space-y-2">
                              <label className="text-sm font-bold text-slate-700 ml-1 flex items-center gap-2">
                                  <MessageCircle className="w-4 h-4 text-[#06C755]" />
                                  LINE Channel Access Token
                              </label>
                              <input 
                                  type="text" 
                                  placeholder="วาง Long-lived Access Token จาก LINE Developers ที่นี่..." 
                                  value={lineBotToken}
                                  onChange={e => setLineBotToken(e.target.value)}
                                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all font-mono"
                              />
                          </div>

                          {/* [RESTORED] Telegram Settings Section */}
                          <div className="space-y-4 pt-4 border-t border-slate-100">
                              <label className="text-sm font-bold text-slate-700 ml-1 flex items-center gap-2">
                                  <Send className="w-4 h-4 text-[#0088cc]" />
                                  Telegram Settings
                              </label>
                              
                              {/* 1. Bot Token Input */}
                              <div className="space-y-1">
                                  <span className="text-[10px] font-bold text-slate-400 ml-1">Telegram Bot Token</span>
                                  <div className="flex flex-col gap-2">
                                      <input 
                                          type="text" 
                                          placeholder="วาง Token จาก BotFather (เช่น 12345:ABCdef...)" 
                                          value={telegramBotToken}
                                          onChange={e => setTelegramBotToken(e.target.value)}
                                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all font-mono"
                                      />
                                      
                                      {/* Deploy Link Input for Webhook Registration */}
                                      <div className="space-y-1 pt-1">
                                          <span className="text-[10px] font-bold text-slate-400 ml-1">Google Apps Script URL (Deploy Link สำหรับ Webhook)</span>
                                          <input 
                                              type="text" 
                                              placeholder="https://script.google.com/macros/s/.../exec" 
                                              value={deployUrl}
                                              onChange={e => setDeployUrl(e.target.value)}
                                              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all font-mono text-slate-600"
                                          />
                                      </div>

                                      <div className="flex flex-wrap gap-2 mt-1">
                                        {/* Set Webhook Button */}
                                        {telegramBotToken && deployUrl && (
                                            <a 
                                                href={`https://api.telegram.org/bot${telegramBotToken}/setWebhook?url=${deployUrl}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="px-3 py-2 bg-sky-50 text-sky-600 font-bold rounded-lg hover:bg-sky-100 transition flex items-center justify-center gap-2 text-xs border border-sky-100"
                                                title="กด 1 ครั้งเพื่อเริ่มใช้งาน (Set Webhook)"
                                            >
                                                <LinkIcon className="w-3.5 h-3.5" />
                                                เชื่อมต่อ Webhook
                                            </a>
                                        )}
                                        {/* Delete Webhook Button */}
                                        {telegramBotToken && (
                                            <a 
                                                href={`https://api.telegram.org/bot${telegramBotToken}/deleteWebhook`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="px-3 py-2 bg-rose-50 text-rose-600 font-bold rounded-lg hover:bg-rose-100 transition flex items-center justify-center gap-2 text-xs border border-rose-100"
                                                title="กดเมื่อบอทค้าง หรือส่งรัวๆ"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                ยกเลิก Webhook
                                            </a>
                                        )}
                                      </div>
                                  </div>
                              </div>

                              {/* 2. Chat ID Input with Fetch Button */}
                              <div className="space-y-1">
                                  <span className="text-[10px] font-bold text-slate-400 ml-1">Telegram Chat ID (สำหรับแจ้งเตือน Admin)</span>
                                  <div className="flex gap-2">
                                      <input 
                                          type="text" 
                                          placeholder="ระบุ Chat ID (เช่น -100xxxx หรือ User ID)" 
                                          value={telegramChatId}
                                          onChange={e => setTelegramChatId(e.target.value)}
                                          className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all font-mono"
                                      />
                                      <button
                                          onClick={handleFetchTelegramId}
                                          className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-sky-50 hover:text-sky-600 hover:border-sky-100 transition flex items-center justify-center gap-2 text-xs border border-slate-200 whitespace-nowrap"
                                          title="ดึง ID ล่าสุดที่ทักบอทมา"
                                      >
                                          <Bot className="w-4 h-4" />
                                          ดึง ID ล่าสุด
                                      </button>
                                  </div>
                                  <p className="text-[10px] text-slate-400 ml-1">
                                      *วิธีใช้: ทักบอทด้วยคำว่า <code>/id</code> แล้วกดปุ่ม "ดึง ID ล่าสุด" ระบบจะใส่เลขให้อัตโนมัติ
                                  </p>
                              </div>
                          </div>

                          {/* Web App URL Configuration */}
                          <div className="space-y-2 pt-4 border-t border-slate-100">
                              <label className="text-sm font-bold text-slate-700 ml-1 flex items-center gap-2">
                                  <LinkIcon className="w-4 h-4 text-indigo-600" />
                                  ลิงก์หน้าเว็บของคุณ (Web App URL)
                              </label>
                              <div className="flex flex-col sm:flex-row gap-3">
                                  <input 
                                      type="url" 
                                      placeholder="เช่น https://flower2youlukyee.vercel.app" 
                                      value={webAppUrl}
                                      onChange={e => setWebAppUrl(e.target.value)}
                                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                  />
                              </div>
                              <p className="text-[10px] text-slate-400 ml-1">
                                  *สำคัญ: ระบุ URL ของเว็บไซต์นี้ เพื่อให้บอทสร้างปุ่ม "ดูสถานะงาน" ได้ถูกต้อง
                              </p>
                          </div>
                      </div>

                      <div className="mt-6 pt-6 border-t border-slate-100 flex justify-end">
                          <button
                              onClick={() => saveSystemSettings({ 
                                  line_bot_token: lineBotToken, 
                                  telegram_bot_token: telegramBotToken,
                                  telegram_chat_id: telegramChatId,
                                  web_app_url: webAppUrl
                              })}
                              className="px-6 py-3 bg-sky-600 text-white font-bold rounded-xl hover:bg-sky-700 shadow-sm transition flex items-center justify-center gap-2 shrink-0"
                          >
                              <Save className="w-4 h-4" /> บันทึกการตั้งค่า Chatbot
                          </button>
                      </div>
                  </div>
              </div>

              {/* Added Shop Contact Settings Section */}
              <div className="mb-8">
                  <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <StoreIcon className="w-5 h-5 text-indigo-600" />
                      ข้อมูลติดต่อร้านค้า (Shop Contact)
                  </h3>
                  <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                          
                          {/* [MODIFIED] Logo Upload Section with Delete Button */}
                          <div className="sm:col-span-2 flex items-center justify-center mb-4">
                              <div className="relative group">
                                  <div className="w-24 h-24 rounded-2xl bg-white border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden hover:border-indigo-300 transition-colors relative shadow-sm cursor-pointer">
                                      {shopInfo.logo ? (
                                          <img 
                                            src={processImageUrl(shopInfo.logo)} 
                                            alt="Shop Logo" 
                                            className="w-full h-full object-cover"
                                            referrerPolicy="no-referrer"
                                            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                                          />
                                      ) : null}
                                      
                                      <div className={`flex-col items-center justify-center text-slate-400 ${shopInfo.logo ? 'hidden' : 'flex'}`}>
                                          {isUploadingLogo ? <Loader2 className="w-6 h-6 animate-spin text-indigo-500" /> : <ImageIcon className="w-8 h-8 opacity-50" />}
                                          <span className="text-[10px] font-bold mt-1 text-slate-300">{isUploadingLogo ? '...' : 'LOGO'}</span>
                                      </div>

                                      {/* Overlay for upload */}
                                      <label className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10">
                                          <Camera className="w-6 h-6 mb-1 drop-shadow-md" />
                                          <span className="text-[10px] font-bold drop-shadow-md">เปลี่ยนรูป</span>
                                          <input 
                                              type="file" 
                                              accept="image/*" 
                                              className="hidden" 
                                              onChange={(e) => e.target.files[0] && handleLogoUpload(e.target.files[0])}
                                              disabled={isUploadingLogo}
                                          />
                                      </label>
                                  </div>

                                  {/* [MODIFIED] Delete Button Position (Bottom-Right) */}
                                  {shopInfo.logo && (
                                      <button
                                          onClick={requestDeleteLogo}
                                          className="absolute -bottom-2 -right-2 p-1.5 bg-white text-rose-500 border border-slate-200 rounded-full shadow-md hover:bg-rose-50 hover:text-rose-600 transition-all z-20 group/delete"
                                          title="ลบโลโก้"
                                      >
                                          <Trash2 className="w-4 h-4" />
                                      </button>
                                  )}
                              </div>
                          </div>

                          <div className="space-y-1 sm:col-span-2">
                              <label className="text-xs font-bold text-slate-500 ml-1">ชื่อร้านค้า</label>
                              <input 
                                  type="text" 
                                  placeholder="ชื่อร้านของคุณ" 
                                  value={shopInfo.shopName || ''}
                                  onChange={e => setShopInfo({...shopInfo, shopName: e.target.value})}
                                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                              />
                          </div>
                          
                          {/* [ADDED] Tax ID Input for Shop */}
                          <div className="space-y-1 sm:col-span-2">
                              <label className="text-xs font-bold text-slate-500 ml-1">เลขประจำตัวผู้เสียภาษี (Tax ID)</label>
                              <input 
                                  type="text" 
                                  placeholder="เลขผู้เสียภาษีร้านค้า..." 
                                  value={shopInfo.taxId || ''}
                                  onChange={e => setShopInfo({...shopInfo, taxId: e.target.value})}
                                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                              />
                          </div>

                          <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500 ml-1">เบอร์โทรศัพท์</label>
                              <input 
                                  type="tel" 
                                  placeholder="เบอร์โทรร้าน" 
                                  value={shopInfo.phone}
                                  onChange={e => setShopInfo({...shopInfo, phone: e.target.value})}
                                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                              />
                          </div>
                          <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500 ml-1">อีเมล</label>
                              <input 
                                  type="email" 
                                  placeholder="อีเมลร้าน" 
                                  value={shopInfo.email}
                                  onChange={e => setShopInfo({...shopInfo, email: e.target.value})}
                                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                              />
                          </div>
                          <div className="space-y-1 sm:col-span-2">
                              <label className="text-xs font-bold text-slate-500 ml-1">ที่อยู่ / สำนักงาน</label>
                              <textarea 
                                  rows={2}
                                  placeholder="ที่อยู่ร้านค้า..." 
                                  value={shopInfo.address}
                                  onChange={e => setShopInfo({...shopInfo, address: e.target.value})}
                                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                              />
                          </div>
                          
                          <div className="space-y-1">
                              {/* [MODIFIED] Use LineIcon in Settings Label */}
                              <label className="text-xs font-bold text-slate-500 ml-1 flex items-center gap-1"><LineIcon className="w-3 h-3 text-[#06C755]"/> Line URL</label>
                              <input 
                                  type="text" 
                                  placeholder="https://line.me/ti/p/..." 
                                  value={shopInfo.line}
                                  onChange={e => setShopInfo({...shopInfo, line: e.target.value})}
                                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                              />
                          </div>
                          <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500 ml-1 flex items-center gap-1"><Facebook className="w-3 h-3 text-[#1877F2]"/> Facebook URL</label>
                              <input 
                                  type="text" 
                                  placeholder="https://facebook.com/..." 
                                  value={shopInfo.facebook}
                                  onChange={e => setShopInfo({...shopInfo, facebook: e.target.value})}
                                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                              />
                          </div>
                          <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500 ml-1 flex items-center gap-1"><Instagram className="w-3 h-3 text-[#C13584]"/> Instagram URL</label>
                              <input 
                                  type="text" 
                                  placeholder="https://instagram.com/..." 
                                  value={shopInfo.instagram}
                                  onChange={e => setShopInfo({...shopInfo, instagram: e.target.value})}
                                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                              />
                          </div>
                          <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500 ml-1 flex items-center gap-1"><Music2 className="w-3 h-3 text-black"/> TikTok URL</label>
                              <input 
                                  type="text" 
                                  placeholder="https://tiktok.com/@..." 
                                  value={shopInfo.tiktok}
                                  onChange={e => setShopInfo({...shopInfo, tiktok: e.target.value})}
                                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                              />
                          </div>

                          {/* [ADDED] Twitter (X) & WeChat Inputs */}
                          <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500 ml-1 flex items-center gap-1"><XIcon className="w-3 h-3 text-black"/> Twitter (X) URL</label>
                              <input 
                                  type="text" 
                                  placeholder="https://x.com/..." 
                                  value={shopInfo.twitter || ''}
                                  onChange={e => setShopInfo({...shopInfo, twitter: e.target.value})}
                                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                              />
                          </div>
                          <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500 ml-1 flex items-center gap-1"><WeChatIcon className="w-3 h-3 text-[#07C160]"/> WeChat URL / ID</label>
                              <input 
                                  type="text" 
                                  placeholder="WeChat ID หรือ Link" 
                                  value={shopInfo.wechat || ''}
                                  onChange={e => setShopInfo({...shopInfo, wechat: e.target.value})}
                                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                              />
                          </div>
                          
                          {/* [ADDED] Telegram Input in Settings */}
                          <div className="space-y-1">
                              <label className="text-xs font-bold text-slate-500 ml-1 flex items-center gap-1"><TelegramIcon className="w-3 h-3 text-[#0088cc]"/> Telegram Contact URL</label>
                              <input 
                                  type="text" 
                                  placeholder="https://t.me/..." 
                                  value={shopInfo.telegram || ''}
                                  onChange={e => setShopInfo({...shopInfo, telegram: e.target.value})}
                                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                              />
                          </div>

                      </div>

                      <div className="flex justify-end">
                          <button
                              onClick={() => saveSystemSettings('shop_info', shopInfo)}
                              className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-sm transition flex items-center justify-center gap-2"
                          >
                              <Save className="w-4 h-4" /> บันทึกข้อมูล
                          </button>
                      </div>
                  </div>
              </div>

              {/* [ADDED] Theme Customization Section */}
              <div className="mb-8">
                  <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <Palette className="w-5 h-5 text-indigo-600" />
                      ปรับแต่งธีม (Theme & Appearance)
                  </h3>
                  <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                      <div className="flex flex-col gap-6">
                          
                          {/* Color Selection */}
                          <div>
                              <label className="text-sm font-bold text-slate-700 mb-3 block">เลือกสีหลัก (Primary Color)</label>
                              <div className="flex flex-wrap gap-3 items-center">
                                  {Object.entries(themeColors).map(([key, theme]) => (
                                      <button
                                          key={key}
                                          onClick={() => setShopInfo({...shopInfo, themeColor: key})}
                                          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                                              shopInfo.themeColor === key 
                                              ? 'ring-4 ring-offset-2 ring-slate-200 scale-110 shadow-md' 
                                              : 'hover:scale-105 hover:shadow-sm opacity-80 hover:opacity-100'
                                          }`}
                                          style={{ background: key === 'rainbow' ? 'linear-gradient(135deg, #ef4444, #eab308, #3b82f6, #a855f7)' : theme.main }}
                                          title={theme.label}
                                      >
                                          {shopInfo.themeColor === key && <Check className="w-6 h-6 text-white drop-shadow-sm" strokeWidth={3} />}
                                      </button>
                                  ))}

                                  {/* Divider */}
                                  <div className="w-px h-8 bg-slate-200 mx-1"></div>

                                  {/* [ADDED] Custom Color Button (Pipette) */}
                                  <div className="relative group">
                                      <label 
                                          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-sm relative overflow-hidden ${
                                              shopInfo.themeColor === 'custom' 
                                              ? 'ring-4 ring-offset-2 ring-slate-200 scale-110' 
                                              : 'hover:scale-105 hover:shadow-md border border-slate-100'
                                          }`}
                                          style={{ 
                                              background: shopInfo.themeColor === 'custom' 
                                                  ? shopInfo.customColorValue 
                                                  : 'conic-gradient(from 90deg, #FF0000, #FFFF00, #00FF00, #00FFFF, #0000FF, #FF00FF, #FF0000)'
                                          }}
                                          title="สีที่กำหนดเอง (Custom)"
                                      >
                                          <input 
                                              type="color" 
                                              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                              value={shopInfo.customColorValue || '#000000'}
                                              onChange={(e) => setShopInfo({
                                                  ...shopInfo, 
                                                  themeColor: 'custom',
                                                  customColorValue: e.target.value
                                              })}
                                          />
                                          {/* Icon Overlay */}
                                          <div className={`pointer-events-none z-0 ${shopInfo.themeColor === 'custom' ? 'text-white drop-shadow-md' : 'text-slate-700 bg-white/80 p-2 rounded-full backdrop-blur-sm shadow-sm'}`}>
                                              {shopInfo.themeColor === 'custom' ? (
                                                  <Check className="w-6 h-6" strokeWidth={3} />
                                              ) : (
                                                  <Pipette className="w-5 h-5" />
                                              )}
                                          </div>
                                      </label>
                                      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
                                          กำหนดเอง
                                      </div>
                                  </div>
                              </div>
                          </div>

                          <div className="w-full h-px bg-slate-100"></div>

                          {/* Mode Selection */}
                          <div>
                              <label className="text-sm font-bold text-slate-700 mb-3 block">รูปแบบการแสดงผล (Display Mode)</label>
                              <div className="flex gap-4">
                                  <button
                                      onClick={() => setShopInfo({...shopInfo, themeMode: 'gradient'})}
                                      className={`flex-1 py-4 px-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 font-bold ${
                                          shopInfo.themeMode === 'gradient'
                                          ? 'border-indigo-600 bg-indigo-50 text-indigo-600'
                                          : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'
                                      }`}
                                  >
                                      <div className={`w-6 h-6 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600`}></div>
                                      ไล่เฉดสี (Gradient)
                                  </button>
                                  <button
                                      onClick={() => setShopInfo({...shopInfo, themeMode: 'solid'})}
                                      className={`flex-1 py-4 px-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 font-bold ${
                                          shopInfo.themeMode === 'solid'
                                          ? 'border-indigo-600 bg-indigo-50 text-indigo-600'
                                          : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'
                                      }`}
                                  >
                                      <div className={`w-6 h-6 rounded-full bg-indigo-600`}></div>
                                      สีเดียว (Solid)
                                  </button>
                              </div>
                          </div>

                          {/* Save Button for Theme */}
                          <div className="flex justify-end pt-2">
                              <button
                                  onClick={() => saveSystemSettings('shop_info', shopInfo)}
                                  className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-sm transition flex items-center justify-center gap-2"
                              >
                                  <Save className="w-4 h-4" /> บันทึกธีม
                              </button>
                          </div>
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
      </>
    );
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
        /* Fix for Modal Footer to have proper spacing above Safe Area */
        .safe-area-bottom-modal {
          padding-bottom: calc(1rem + env(safe-area-inset-bottom));
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
          shopInfo={shopInfo} // [MODIFIED] Pass shopInfo prop to modal
          // [REMOVED] userProfile prop
          onClose={() => setShareData(null)} 
        />
      )}

      {/* --- Desktop Sidebar --- */}
      {/* Only show sidebar if logged in AND NOT in tracking mode */}
      {isLoggedIn && !trackingId && !quotationId && (
        <aside className={`hidden md:flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-72'} bg-white border-r border-slate-100 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20 transition-all duration-300 relative`}>
            {/* ... Sidebar Content ... */}
            <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="absolute -right-3 top-1/2 -translate-y-1/2 p-1.5 bg-white border border-slate-200 rounded-full shadow-sm text-slate-400 hover:text-indigo-600 transition-colors z-50"
            >
                {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>

            <div className={`p-6 pb-4 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
            {/* [MODIFIED] Sidebar Logo & Title based on Shop Info */}
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 shrink-0 overflow-hidden relative">
                {shopInfo.logo ? (
                    <img 
                        src={processImageUrl(shopInfo.logo)} 
                        alt="App Logo" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => { 
                            e.target.style.display = 'none'; 
                            if(e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                        }}
                    />
                ) : null}
                <div className={`w-full h-full flex items-center justify-center ${shopInfo.logo ? 'hidden' : 'flex'}`}>
                    <Clipboard className="w-6 h-6 text-white" />
                </div>
            </div>
            {!isSidebarCollapsed && (
                <h1 className="text-2xl font-black bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent tracking-tight whitespace-nowrap overflow-hidden">
                {shopInfo.shopName || 'ProjectPlan'}
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
                {/* [MODIFIED] Profile Image in Sidebar */}
                <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-white text-xs font-bold ring-4 ring-white shadow-md shrink-0 overflow-hidden">
                    {userProfile?.image ? (
                        <img 
                            src={processImageUrl(userProfile.image)} 
                            alt="Profile" 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                        />
                    ) : (
                        userProfile?.name?.charAt(0) || 'U'
                    )}
                    {/* Fallback text if image fails loading (hidden by default if img present) */}
                    {userProfile?.image && <div className="hidden w-full h-full items-center justify-center bg-slate-900 text-white">{userProfile?.name?.charAt(0) || 'U'}</div>}
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
      {isLoggedIn && !trackingId && !quotationId && (
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
        {isLoggedIn && !trackingId && !quotationId && (
            <header className="h-20 bg-white/80 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-6 sm:px-8 z-50 sticky top-0">
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

            {/* [ADDED] Mobile Profile Menu Button - Resized to be more compact */}
            <div className="md:hidden relative">
                <button
                    onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                    className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 text-xs font-bold shadow-sm active:scale-95 transition-all hover:bg-slate-200 overflow-hidden"
                >
                    {userProfile?.image ? (
                        <img 
                            src={processImageUrl(userProfile.image)} 
                            alt="Profile" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={(e) => { e.target.style.display = 'none'; e.target.parentElement.innerText = userProfile?.name?.charAt(0) || 'U'; }}
                        />
                    ) : (
                        userProfile?.name ? userProfile.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />
                    )}
                </button>
                
                {isProfileMenuOpen && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsProfileMenuOpen(false)}></div>
                        <div className="absolute right-0 top-12 bg-white rounded-xl shadow-xl border border-slate-100 p-1.5 min-w-[160px] z-20 animate-in fade-in zoom-in-95 origin-top-right flex flex-col gap-1">
                            {/* User Info Header */}
                            <div className="px-2 py-2 border-b border-slate-50 mb-1">
                                <p className="text-xs font-bold text-slate-800 truncate">{userProfile?.name}</p>
                                <p className="text-[10px] text-slate-500 truncate">{userProfile?.role}</p>
                            </div>

                            {/* Settings Button */}
                            <button 
                                onClick={() => { setActiveTab('Settings'); setIsProfileMenuOpen(false); }}
                                className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors text-left"
                            >
                                <div className="p-1 bg-slate-100 rounded-md text-slate-600">
                                    <Settings className="w-3.5 h-3.5" />
                                </div>
                                <span>ตั้งค่า</span>
                            </button>

                            {/* [ADDED] Logout Button */}
                            <button 
                                onClick={() => { setIsProfileMenuOpen(false); handleLogout(); }}
                                className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-rose-50 text-rose-600 text-xs font-bold transition-colors text-left"
                            >
                                <div className="p-1 bg-rose-100 rounded-md text-rose-500">
                                    <LogOut className="w-3.5 h-3.5" />
                                </div>
                                <span>ออกจากระบบ</span>
                            </button>
                        </div>
                    </>
                )}
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

      {/* [ADDED] Logo Delete Confirmation Modal */}
      {deleteLogoConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm ${isDeleteLogoClosing ? 'backdrop-animate-out' : 'backdrop-animate-in'}`}
            onClick={closeDeleteLogoModal}
          />
          <div className={`bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm relative z-10 ${isDeleteLogoClosing ? 'modal-animate-out' : 'modal-animate-in'}`}>
            <div className="flex flex-col items-center text-center gap-4">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-full">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">ยืนยันลบรูปร้านค้า?</h3>
                <p className="text-sm text-slate-500">คุณต้องการลบโลโก้ร้านค้านี้ใช่หรือไม่?</p>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <button
                  onClick={closeDeleteLogoModal}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={executeDeleteLogo}
                  className="flex-1 py-2.5 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition shadow-lg shadow-rose-200"
                >
                  ลบรูป
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* [ADDED] Profile Delete Confirmation Modal */}
      {deleteProfileConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm ${isDeleteProfileClosing ? 'backdrop-animate-out' : 'backdrop-animate-in'}`}
            onClick={closeDeleteProfileModal}
          />
          <div className={`bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm relative z-10 ${isDeleteProfileClosing ? 'modal-animate-out' : 'modal-animate-in'}`}>
            <div className="flex flex-col items-center text-center gap-4">
              <div className="p-3 bg-rose-100 text-rose-600 rounded-full">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">ยืนยันลบรูปโปรไฟล์?</h3>
                <p className="text-sm text-slate-500">คุณต้องการลบรูปโปรไฟล์นี้ใช่หรือไม่?</p>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <button
                  onClick={closeDeleteProfileModal}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={executeDeleteProfile}
                  className="flex-1 py-2.5 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition shadow-lg shadow-rose-200"
                >
                  ลบรูป
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
                                // [MODIFIED] Add customerInfo object to ensure contact details appear in print
                                customerInfo: {
                                    social: customerSocial,
                                    line: customerLine,
                                    phone: customerPhone,
                                    email: customerEmail,
                                    taxId: customerTaxId // [FIX] Added missing Tax ID
                                },
                                rawDeliveryStart: deliveryStart,
                                rawDeliveryEnd: deliveryEnd,
                                rawDeliveryDateTime: deliveryEnd,
                                location: locationName,
                                mapLink: mapLink,
                                recipient: recipientName,
                                recipientPhone: recipientPhone,
                                image: uploadedImage,
                                wage: wage,
                                quotationItems: quotationItems, 
                                customerSupport: customerSupportItems,
                                dealStatus: dealStatus, 
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

                                 {/* [ADDED] Customer Tax ID Input */}
                                 {viewOnlyMode ? (
                                      <div className="sm:col-span-2">
                                        <ViewOnlyField value={customerTaxId} type="text" icon={FileText} />
                                      </div>
                                 ) : (
                                      <input
                                        type="text"
                                        placeholder="เลขประจำตัวผู้เสียภาษี (Tax ID)"
                                        value={customerTaxId}
                                        onChange={(e) => setCustomerTaxId(e.target.value)}
                                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:col-span-2"
                                      />
                                 )}

                                 {/* [ADDED] Customer Address Input (New Row) */}
                                 {viewOnlyMode ? (
                                      <div className="sm:col-span-2">
                                        <ViewOnlyField value={customerAddress} type="text" icon={MapPin} />
                                      </div>
                                 ) : (
                                      <textarea
                                        rows={2}
                                        placeholder="ที่อยู่ลูกค้า (แสดงบนใบเสร็จ)"
                                        value={customerAddress}
                                        onChange={(e) => setCustomerAddress(e.target.value)}
                                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:col-span-2 resize-none"
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
                           {/* Wage Input Removed from here */}
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
                     <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                          <span className="bg-slate-900 text-white w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold">3</span>
                          <h4 className="font-bold text-slate-800 text-lg">การเงิน & เสนอราคา (Quotation)</h4>
                     </div>

                     {/* 3.1: Customer Support (Bank Calculator) */}
                     <div className="space-y-3">
                         <h5 className="font-bold text-indigo-700 text-sm flex items-center gap-2">
                            <span className="bg-indigo-100 text-indigo-700 w-5 h-5 rounded-full flex items-center justify-center text-xs">1</span>
                            เงินสนับสนุนศิลปิน (Money Order)
                         </h5>
                         <div className="bg-indigo-50/50 rounded-2xl border border-indigo-100 p-4">
                              <div className="space-y-3">
                                  {/* Header Row */}
                                  <div className="hidden sm:grid grid-cols-12 gap-3 px-2 text-xs font-bold text-indigo-800/60 uppercase tracking-wide">
                                      <div className="col-span-4">ประเภทแบงค์ (บาท)</div>
                                      <div className="col-span-3">จำนวน (ใบ/เหรียญ)</div>
                                      <div className="col-span-4">รวมเป็นเงิน (บาท)</div>
                                      <div className="col-span-1"></div>
                                  </div>

                                  {/* Dynamic Rows */}
                                  {customerSupportItems.map((item, idx) => (
                                      <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center animate-in fade-in slide-in-from-left-2 duration-300 bg-white p-2 sm:p-0 rounded-xl sm:bg-transparent border sm:border-none border-indigo-100 shadow-sm sm:shadow-none">
                                          <div className="sm:col-span-4 relative">
                                              <span className="sm:hidden text-xs font-bold text-indigo-400 mb-1 block">ประเภทแบงค์</span>
                                              <select
                                                  value={item.denomination}
                                                  onChange={(e) => handleSupportItemChange(idx, 'denomination', e.target.value)}
                                                  className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 appearance-none font-bold text-slate-700"
                                              >
                                                  {[1000, 500, 100, 50, 20, 10, 5, 2, 1].map(val => (
                                                      <option key={val} value={val}>{val >= 20 ? `แบงค์ ${val}` : `เหรียญ ${val}`}</option>
                                                  ))}
                                              </select>
                                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none hidden sm:block" />
                                          </div>
                                          <div className="sm:col-span-3">
                                              <span className="sm:hidden text-xs font-bold text-indigo-400 mb-1 block">จำนวน</span>
                                              <input
                                                  type="number"
                                                  placeholder="จำนวน"
                                                  value={item.quantity}
                                                  onChange={(e) => handleSupportItemChange(idx, 'quantity', e.target.value)}
                                                  className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-center"
                                              />
                                          </div>
                                          <div className="sm:col-span-4">
                                              <span className="sm:hidden text-xs font-bold text-indigo-400 mb-1 block">รวมเงิน</span>
                                              <input
                                                  type="number"
                                                  placeholder="0.00"
                                                  value={item.price}
                                                  onChange={(e) => handleSupportItemChange(idx, 'price', e.target.value)}
                                                  className="w-full px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-sm font-black text-indigo-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-right"
                                              />
                                          </div>
                                          <div className="sm:col-span-1 flex justify-center sm:justify-end">
                                              <button
                                                  onClick={() => handleRemoveSupportItem(idx)}
                                                  className="p-2 text-indigo-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"
                                              >
                                                  <Trash2 className="w-4 h-4" />
                                              </button>
                                          </div>
                                      </div>
                                  ))}
                              </div>

                              <div className="flex justify-between items-center mt-4">
                                  <button
                                      onClick={handleAddSupportItem}
                                      className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 px-3 py-2 rounded-lg transition w-fit"
                                  >
                                      <Plus className="w-4 h-4" />
                                      เพิ่มรายการเงิน
                                  </button>
                                  <div className="text-sm font-bold text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                                      รวม: ฿{customerSupportItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0).toLocaleString()}
                                  </div>
                              </div>
                         </div>
                     </div>

                     {/* 3.2: Quotation Items (Replaces Service + Delivery) */}
                     <div className="space-y-3 pt-4 border-t border-slate-100">
                         <h5 className="font-bold text-emerald-700 text-sm flex items-center gap-2">
                            <span className="bg-emerald-100 text-emerald-700 w-5 h-5 rounded-full flex items-center justify-center text-xs">2</span>
                            รายการเสนอราคา (Quotation)
                         </h5>
                         <div className="bg-emerald-50/50 rounded-2xl border border-emerald-100 p-4">
                             <div className="space-y-3">
                                {/* Header Row */}
                                <div className="hidden sm:grid grid-cols-12 gap-3 px-2 text-xs font-bold text-emerald-800/60 uppercase tracking-wide">
                                   <div className="col-span-3">หมวดหมู่</div>
                                   <div className="col-span-6">รายละเอียดรายการ</div>
                                   <div className="col-span-2">ราคา (บาท)</div>
                                   <div className="col-span-1"></div>
                                </div>

                                {/* Dynamic Rows */}
                                {quotationItems.map((item, idx) => (
                                   <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start animate-in fade-in slide-in-from-left-2 duration-300 bg-white p-3 sm:p-0 rounded-xl sm:bg-transparent border sm:border-none border-emerald-100 shadow-sm sm:shadow-none">
                                       <div className="sm:col-span-3">
                                          <span className="sm:hidden text-xs font-bold text-emerald-500 mb-1 block">หมวดหมู่</span>
                                          <input
                                            type="text"
                                            list="expense-categories" 
                                            placeholder="ระบุหมวดหมู่..."
                                            value={item.category}
                                            onChange={(e) => handleQuotationItemChange(idx, 'category', e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                          />
                                       </div>
                                       <div className="sm:col-span-6">
                                          <span className="sm:hidden text-xs font-bold text-emerald-500 mb-1 block">รายละเอียด</span>
                                          <input
                                            type="text"
                                            placeholder="รายละเอียดเพิ่มเติม..."
                                            value={item.detail}
                                            onChange={(e) => handleQuotationItemChange(idx, 'detail', e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                          />
                                       </div>
                                       <div className="sm:col-span-2">
                                          <span className="sm:hidden text-xs font-bold text-emerald-500 mb-1 block">ราคา</span>
                                          <input
                                            type="number"
                                            placeholder="0.00"
                                            value={item.price}
                                            onChange={(e) => handleQuotationItemChange(idx, 'price', e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg text-sm font-black text-emerald-700 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-right"
                                          />
                                       </div>
                                       <div className="sm:col-span-1 flex justify-center sm:justify-end pt-1">
                                          <button
                                            onClick={() => handleRemoveQuotationItem(idx)}
                                            className="p-2 text-emerald-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                       </div>
                                    </div>
                                 ))}
                              </div>

                              <div className="flex justify-between items-center mt-4">
                                  <button
                                    onClick={handleAddQuotationItem}
                                    className="flex items-center gap-2 text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100 px-3 py-2 rounded-lg transition w-fit"
                                  >
                                    <Plus className="w-4 h-4" />
                                    เพิ่มรายการเสนอราคา
                                  </button>
                                  <div className="text-sm font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                                      รวม: ฿{quotationItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0).toLocaleString()}
                                  </div>
                              </div>
                         </div>
                     </div>

                     {/* 3.3: Expenses (Moved to Row 3) */}
                     <div className="space-y-3 pt-4 border-t border-slate-100">
                         <h5 className="font-bold text-rose-700 text-sm flex items-center gap-2">
                            <TrendingDown className="w-4 h-4" />
                            รายจ่ายจริง / ต้นทุนเพิ่ม (Expenses)
                         </h5>
                         <p className="text-[10px] text-slate-400 -mt-1 ml-6">รายการนี้ไม่แสดงให้ลูกค้าเห็น (ใช้สำหรับคำนวณกำไรภายใน)</p>
                         <div className="bg-rose-50/50 rounded-2xl border border-rose-100 p-4">
                             <div className="space-y-3">
                                {/* Header Row */}
                                <div className="hidden sm:grid grid-cols-12 gap-3 px-2 text-xs font-bold text-rose-800/60 uppercase tracking-wide">
                                   <div className="col-span-3">หมวดหมู่</div>
                                   <div className="col-span-6">รายละเอียด</div>
                                   <div className="col-span-2">ราคา (บาท)</div>
                                   <div className="col-span-1"></div>
                                </div>

                                {expenses.map((item, idx) => (
                                   <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start animate-in fade-in slide-in-from-left-2 duration-300 bg-white p-3 sm:p-0 rounded-xl sm:bg-transparent border sm:border-none border-rose-100 shadow-sm sm:shadow-none">
                                       <div className="sm:col-span-3">
                                          <span className="sm:hidden text-xs font-bold text-rose-400 mb-1 block">หมวดหมู่</span>
                                          <input
                                            type="text"
                                            list="expense-categories" 
                                            placeholder="หมวดหมู่..."
                                            value={item.category}
                                            onChange={(e) => handleExpenseChange(idx, 'category', e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-rose-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-500/20"
                                          />
                                       </div>
                                       <div className="sm:col-span-6">
                                          <span className="sm:hidden text-xs font-bold text-rose-400 mb-1 block">รายละเอียด</span>
                                          <input
                                            type="text"
                                            placeholder="รายละเอียด..."
                                            value={item.detail}
                                            onChange={(e) => handleExpenseChange(idx, 'detail', e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-rose-200 rounded-lg text-sm focus:ring-2 focus:ring-rose-500/20"
                                          />
                                       </div>
                                       <div className="sm:col-span-2">
                                          <span className="sm:hidden text-xs font-bold text-rose-400 mb-1 block">ราคา</span>
                                          <input
                                            type="number"
                                            placeholder="0.00"
                                            value={item.price}
                                            onChange={(e) => handleExpenseChange(idx, 'price', e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-rose-200 rounded-lg text-sm font-semibold text-rose-800 focus:ring-2 focus:ring-rose-500/20 text-right"
                                          />
                                       </div>
                                       <div className="sm:col-span-1 flex justify-center sm:justify-end pt-1">
                                          <button
                                            onClick={() => handleRemoveExpense(idx)}
                                            className="p-2 text-rose-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                       </div>
                                    </div>
                                 ))}
                              </div>

                              <div className="flex justify-between items-center mt-4">
                                  <button
                                    onClick={handleAddExpense}
                                    className="flex items-center gap-2 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-2 rounded-lg transition w-fit"
                                  >
                                    <Plus className="w-4 h-4" />
                                    เพิ่มรายการจ่าย
                                  </button>
                                  <div className="text-sm font-bold text-rose-800 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100">
                                      รวม: ฿{expenses.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0).toLocaleString()}
                                  </div>
                              </div>
                         </div>
                     </div>

                     {/* Summary Section - Redesigned */}
                     <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                         <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 flex flex-col justify-between">
                            <div>
                                <p className="text-sm font-bold text-indigo-800 mb-1">ยอดรวมสุทธิ</p>
                                <p className="text-[10px] text-indigo-600 mb-2">(เรียกเก็บลูกค้า)</p>
                            </div>
                            <p className={`font-black text-indigo-900 tracking-tight break-all leading-tight ${((quotationItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0)) + (customerSupportItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0))).toString().length > 9 ? 'text-xl' : 'text-2xl'}`}>
                                ฿{((quotationItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0)) + (customerSupportItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0))).toLocaleString()}
                            </p>
                         </div>

                         <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex flex-col justify-between">
                            <p className="text-sm font-bold text-emerald-600 mb-2">เสนอราคา</p>
                            <p className={`font-black text-emerald-700 tracking-tight break-all leading-tight text-2xl`}>
                                ฿{(quotationItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0)).toLocaleString()}
                            </p>
                         </div>

                         <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col justify-between">
                            <p className="text-sm font-bold text-slate-500 mb-2">รวมรายจ่ายจริง</p>
                            <p className={`font-black text-rose-600 tracking-tight break-all leading-tight ${totalExpenses.toString().length > 9 ? 'text-xl' : 'text-2xl'}`}>
                                ฿{totalExpenses.toLocaleString()}
                            </p>
                         </div>
                         
                         <div className="bg-indigo-600 text-white p-4 rounded-2xl shadow-lg shadow-indigo-200 flex flex-col justify-between">
                            <p className="text-sm font-bold text-indigo-100 mb-2">กำไร (ไม่รวมเงินออเดอร์)</p>
                            <p className={`font-black tracking-tight break-all leading-tight ${((quotationItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0)) - totalExpenses).toString().length > 9 ? 'text-xl' : 'text-2xl'}`}>
                              {((quotationItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0)) - totalExpenses) >= 0 ? '+' : ''}฿{((quotationItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0)) - totalExpenses).toLocaleString()}
                            </p>
                         </div>
                     </div>

                     {/* Quick Save Button for Finance Section (View Only Mode) */}
                     {viewOnlyMode && (
                        <div className="mt-4 flex justify-end animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 p-2 pl-4 rounded-2xl">
                                <span className="text-xs font-bold text-amber-700">
                                    <AlertCircle className="w-3 h-3 inline mr-1 mb-0.5" />
                                    แก้ไขยอดเงินแล้ว อย่าลืมกดบันทึก
                                </span>
                                <button
                                    onClick={handleSaveProject}
                                    className="px-5 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl shadow-md shadow-emerald-200 hover:bg-emerald-700 hover:-translate-y-0.5 transition-all flex items-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    บันทึกยอดเงิน
                                </button>
                            </div>
                        </div>
                     )}
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

             {/* Footer Actions - Responsive: Mobile (35/65) | PC (Split Left/Right) */}
             <div className="px-4 pt-4 sm:px-8 sm:py-6 border-t border-slate-100 bg-white/90 backdrop-blur-xl sticky bottom-0 z-30 safe-area-bottom-modal">
                 <div className="flex items-center justify-center sm:justify-between gap-3 w-full">
                     
                     {/* Left Side: Delete Button (35% on Mobile, Auto on PC) */}
                     {/* Using a conditional rendering for the wrapper to maintain layout */}
                     {editingId ? (
                        <button
                             onClick={handleDeleteProject}
                             className="w-[35%] sm:w-auto group flex items-center justify-center gap-2 py-3.5 sm:px-6 rounded-2xl text-rose-500 bg-rose-50 hover:bg-rose-100 transition-all duration-300 border border-transparent hover:border-rose-100 active:scale-95 shadow-sm shrink-0"
                             title="ลบรายการ"
                           >
                             <Trash2 className="w-5 h-5 shrink-0" />
                             <span className="font-bold text-sm hidden sm:inline">ลบรายการ</span>
                             <span className="font-bold text-sm sm:hidden">ลบ</span>
                        </button>
                     ) : (
                        <div className="hidden sm:block"></div> /* Spacer for PC alignment if needed */
                     )}

                     {/* Right Side: Main Actions (Remaining width on Mobile, Auto/Right on PC) */}
                     <div className={`${editingId ? 'flex-1' : 'w-full'} sm:flex-none sm:w-auto sm:ml-auto`}>
                         {viewOnlyMode ? (
                            <button
                                onClick={() => setViewOnlyMode(false)}
                                className="w-full sm:w-auto py-3.5 px-6 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-2xl font-bold hover:bg-indigo-100 hover:border-indigo-200 hover:-translate-y-0.5 shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center gap-2 active:scale-95"
                            >
                                <Edit className="w-5 h-5" />
                                <span>แก้ไข</span>
                            </button>
                         ) : (
                            <button
                                onClick={handleSaveProject}
                                className="w-full sm:w-auto py-3.5 px-8 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-200 hover:shadow-indigo-300 hover:shadow-2xl hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 flex items-center justify-center gap-2 active:scale-95"
                            >
                                <Save className="w-5 h-5" />
                                <span>บันทึก</span>
                            </button>
                         )}
                     </div>
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