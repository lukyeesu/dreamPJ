import React, { useState, useEffect, useRef } from 'react';
import {
  Loader2,
  Camera,
  Trash2,
  Mail,
  Phone,
  HardDrive,
  Folder,
  FolderPlus,
  Receipt,
  Save,
  Bot,
  MessageCircle,
  Send,
  Link as LinkIcon,
  Store as StoreIcon,
  Image as ImageIcon,
  Palette,
  Check,
  Pipette,
  Tag,
  DollarSign,
  Briefcase,
  Truck,
  MapPin,
  Building2,
  ExternalLink,
  LogOut,
  Facebook,
  Instagram,
  Music2,
  Plus,
  XCircle,
  GripVertical,
  Layers,
  Edit,
  X,
  User,
  Shield,
  Sliders,
  Database,
  Lock,
  Eye,
  EyeOff,
  CreditCard,
  HeartHandshake,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Calendar,
  UserPlus,
  Crosshair
} from 'lucide-react';
import Toast from './components/common/Toast';
import ConfirmDialog from './components/common/ConfirmDialog';
import ModernDateTimePicker from './components/common/ModernDateTimePicker';
import { saveStaffSync, broadcastPermissionsUpdated } from './services/syncService';
import { getActiveClient } from './services/supabaseClient';
import db from './services/db';
import { applyThemeVariables, broadcastShopInfoSync } from './utils/themeManager';
import { parseCoordinatesFromInput, DEFAULT_FLOWER2U_HUB } from './Locations';

// Custom Social Icons
const LineIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className={className}>
    <path d="M64 27.487c0-14.32-14.355-25.97-32-25.97S0 13.168 0 27.487c0 12.837 11.384 23.588 26.762 25.62 1.042.225 2.46.688 2.82 1.578.322.81.21 2.076.103 2.894l-.457 2.74c-.14.81-.643 3.164 2.772 1.725s18.428-10.852 25.143-18.58h-.001C61.78 38.38 64 33.218 64 27.487" fill="currentColor"/>
    <g fill="#fff">
      <path d="M25.498 20.568h-2.245c-.344 0-.623.28-.623.623v13.943a.62.62 0 0 0 .623.62h2.245a.62.62 0 0 0 .623-.62V21.2c0-.343-.28-.623-.623-.623m15.45-.01h-2.244c-.345 0-.624.28-.624.623v8.284l-6.4-8.63c-.014-.022-.03-.043-.048-.063l-.004-.004a.4.4 0 0 0-.038-.038l-.044-.04c-.006-.004-.01-.008-.016-.012l-.032-.022-.02-.012-.033-.02c-.006-.002-.014-.006-.02-.01-.012-.006-.023-.012-.036-.016s-.014-.006-.02-.006c-.012-.006-.025-.008-.037-.012l-.022-.006c-.012-.002-.023-.006-.035-.008l-.026-.004c-.008-.002-.022-.004-.033-.004l-.032-.002c-.008 0-.014-.001-.022-.001h-2.244c-.344 0-.623.28-.623.623V35.13a.62.62 0 0 0 .623.62h2.244c.344 0 .624-.278.624-.62v-8.28l6.397 8.64a.63.63 0 0 0 .158.154c.018.014.032.022.045.03.006.004.012.008.018.01s.02.01.03.014.02.008.03.014l.06.022a.62.62 0 0 0 .168.022h2.244a.62.62 0 0 0 .623-.62V21.2c0-.343-.28-.623-.623-.623"/><path d="M20.087 32.264h-6.1V21.2c0-.344-.28-.623-.623-.623H11.12c-.344 0-.623.28-.623.623v13.942a.62.62 0 0 0 .174.431c.012.012.014.016.016.018.113.107.264.174.43.174h8.968c.344 0 .623-.28.623-.623v-2.245c0-.344-.278-.623-.623-.623m33.258-8.214c.344 0 .623-.28.623-.623V21.2c0-.344-.278-.623-.623-.623h-8.968c-.168 0-.32.067-.432.176-.012.01-.016.014-.018.018-.107.1-.173.262-.173.43v13.943a.62.62 0 0 0 .174.431l.016.016a.62.62 0 0 0 .431.174h8.968c.344 0 .623-.28.623-.623v-2.246c0-.344-.278-.623-.623-.623h-6.098v-2.357h6.098a.62.62 0 0 0 .623-.623V27.04c0-.344-.278-.624-.623-.624h-6.098V24.06h6.098z"/>
    </g>
  </svg>
);

const XIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const WeChatIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" fill="currentColor" className={className}>
    <path d="M200.803 111.88c-24.213 1.265-45.268 8.605-62.362 25.188-17.271 16.754-25.155 37.284-23 62.734-9.464-1.172-18.084-2.462-26.753-3.192-2.994-.252-6.547.106-9.083 1.537-8.418 4.75-16.488 10.113-26.053 16.092 1.755-7.938 2.891-14.889 4.902-21.575 1.479-4.914.794-7.649-3.733-10.849-29.066-20.521-41.318-51.232-32.149-82.85 8.483-29.25 29.315-46.989 57.621-56.236 38.635-12.62 82.054.253 105.547 30.927 8.485 11.08 13.688 23.516 15.063 38.224zm-111.437-9.852c.223-5.783-4.788-10.993-10.74-11.167-6.094-.179-11.106 4.478-11.284 10.483-.18 6.086 4.475 10.963 10.613 11.119 6.085.154 11.186-4.509 11.411-10.435zm58.141-11.171c-5.974.11-11.022 5.198-10.916 11.004.109 6.018 5.061 10.726 11.204 10.652 6.159-.074 10.83-4.832 10.772-10.977-.051-6.032-4.981-10.79-11.06-10.679z"/>
    <path d="M255.201 262.83c-7.667-3.414-14.7-8.536-22.188-9.318-7.459-.779-15.3 3.524-23.104 4.322-23.771 2.432-45.067-4.193-62.627-20.432-33.397-30.89-28.625-78.254 10.014-103.568 34.341-22.498 84.704-14.998 108.916 16.219 21.129 27.24 18.646 63.4-7.148 86.284-7.464 6.623-10.15 12.073-5.361 20.804.884 1.612.985 3.653 1.498 5.689zm-87.274-84.499c4.881.005 8.9-3.815 9.085-8.636.195-5.104-3.91-9.385-9.021-9.406-5.06-.023-9.299 4.318-9.123 9.346.166 4.804 4.213 8.69 9.059 8.696zm56.261-18.022c-4.736-.033-8.76 3.844-8.953 8.629-.205 5.117 3.772 9.319 8.836 9.332 4.898.016 8.768-3.688 8.946-8.562.19-5.129-3.789-9.364-8.829-9.399z"/>
  </svg>
);

const TelegramIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/>
  </svg>
);

// Color and Theme Presets
const defaultThemeColors = {
  violet: { 
    label: 'Violet (ธีมหลัก #8B5CF6)', 
    main: '#8b5cf6', hover: '#7c3aed', light: '#f5f3ff', textLight: '#8b5cf6',
    gradientFrom: '#8b5cf6', gradientTo: '#7c3aed',
    shadow: 'rgba(139, 92, 246, 0.35)' 
  },
  rose: { 
    label: 'Rose', 
    main: '#e11d48', hover: '#be123c', light: '#fff1f2', textLight: '#f43f5e',
    gradientFrom: '#e11d48', gradientTo: '#db2777',
    shadow: 'rgba(225, 29, 72, 0.4)' 
  },
  emerald: { 
    label: 'Emerald', 
    main: '#059669', hover: '#047857', light: '#ecfdf5', textLight: '#10b981',
    gradientFrom: '#059669', gradientTo: '#14b8a6',
    shadow: 'rgba(5, 150, 105, 0.4)' 
  },
  blue: { 
    label: 'Blue', 
    main: '#2563eb', hover: '#1d4ed8', light: '#eff6ff', textLight: '#3b82f6',
    gradientFrom: '#2563eb', gradientTo: '#06b6d4',
    shadow: 'rgba(37, 99, 235, 0.4)' 
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
  indigo: { 
    label: 'Indigo', 
    main: '#4f46e5', hover: '#4338ca', light: '#eef2ff', textLight: '#6366f1',
    gradientFrom: '#4f46e5', gradientTo: '#7c3aed',
    shadow: 'rgba(79, 70, 229, 0.4)'
  },
  rainbow: { 
    label: 'Rainbow', 
    main: '#8b5cf6', hover: '#7c3aed', light: '#faf5ff', textLight: '#8b5cf6',
    gradientFrom: '#ec4899', gradientTo: '#3b82f6',
    shadow: 'rgba(139, 92, 246, 0.4)',
    isRainbow: true
  }
};

const colorPresets = [
  { name: 'Violet', value: 'bg-violet-50 text-violet-700 border-violet-100', dot: 'bg-violet-500' },
  { name: 'Rose', value: 'bg-rose-50 text-rose-700 border-rose-100', dot: 'bg-rose-500' },
  { name: 'Slate', value: 'bg-slate-50 text-slate-500 border-slate-200', dot: 'bg-slate-400' },
  { name: 'Emerald', value: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-500' },
  { name: 'Amber', value: 'bg-amber-50 text-amber-700 border-amber-100', dot: 'bg-amber-500' },
  { name: 'Blue', value: 'bg-blue-50 text-blue-700 border-blue-100', dot: 'bg-blue-500' },
  { name: 'Indigo', value: 'bg-indigo-50 text-indigo-700 border-indigo-100', dot: 'bg-indigo-500' },
  { name: 'Orange', value: 'bg-orange-50 text-orange-700 border-orange-100', dot: 'bg-orange-500' },
];

const systemStatusTypes = [
  { value: 'completed', label: 'งานเสร็จสิ้น', color: 'text-emerald-600 bg-emerald-50' },
  { value: 'active', label: 'กำลังดำเนินการ', color: 'text-blue-600 bg-blue-50' },
  { value: 'pending', label: 'รอดำเนินการ', color: 'text-amber-600 bg-amber-50' },
  { value: 'cancelled', label: 'ยกเลิก/มีปัญหา', color: 'text-rose-600 bg-rose-50' },
  { value: 'declined', label: 'ลูกค้าไม่อนุมัติ', color: 'text-gray-600 bg-gray-50' }
];

// Default Permission Matrix
export const DEFAULT_PERMISSION_MATRIX = {
  admin: {
    label: 'แอดมิน (Admin)',
    code: '11',
    allowed_pages: ['Calendar', 'Plans', 'Finance', 'Quotations', 'Inventory', 'Locations', 'Artists', 'Customers', 'Staff', 'Analytics', 'Settings'],
    can_edit_pricing: true,
    can_delete_project: true,
    can_borrow_tools: true,
    can_manage_users: true
  },
  technician: {
    label: 'ช่างจัดดอกไม้ (Technician)',
    code: '21',
    allowed_pages: ['Calendar', 'Plans', 'Inventory', 'Locations', 'Artists'],
    can_edit_pricing: false,
    can_delete_project: false,
    can_borrow_tools: true,
    can_manage_users: false
  },
  driver: {
    label: 'พนักงานจัดส่ง (Driver)',
    code: '31',
    allowed_pages: ['Calendar', 'Plans', 'Locations'],
    can_edit_pricing: false,
    can_delete_project: false,
    can_borrow_tools: false,
    can_manage_users: false
  },
  accountant: {
    label: 'ฝ่ายบัญชี/การเงิน (Accountant)',
    code: '41',
    allowed_pages: ['Calendar', 'Plans', 'Finance', 'Quotations', 'Customers', 'Analytics'],
    can_edit_pricing: true,
    can_delete_project: false,
    can_borrow_tools: false,
    can_manage_users: false
  }
};

export const SYSTEM_MODULES = [
  { id: 'Calendar', label: 'ปฏิทิน & คิวงาน (Calendar)', tag: 'calendar', desc: 'ตารางคิวงานจัดดอกไม้ ส่งมอบ นัดหมาย' },
  { id: 'Plans', label: 'แผนงาน & โปรเจกต์ (Plans)', tag: 'plans', desc: 'การจัดการโปรเจกต์ สเปกจัดฉาก ช่างหน้างาน' },
  { id: 'Finance', label: 'การเงิน & รายรับ-รายจ่าย (Finance)', tag: 'finance', desc: 'ยอดจ้าง เงินศิลปิน รายจ่ายจริง กำไรสุทธิ สลิป' },
  { id: 'Quotations', label: 'คำนวณราคา (Pricing)', tag: 'quotations', desc: 'คำนวณต้นทุนฉาก/ดอกไม้ ประเมินราคาและออกใบเสนอราคา PDF' },
  { id: 'Inventory', label: 'คลังพัสดุ & ยืม-คืน (Inventory)', tag: 'inventory', desc: 'สต็อกพัสดุ โฟม/ขาตั้ง และประวัติยืม-คืนอุปกรณ์' },
  { id: 'Locations', label: 'สถานที่จัดส่ง & นำทาง (Locations)', tag: 'location', desc: 'พิกัดส่งลูกค้า จุดโหลดของ Loading Dock เบอร์ รปภ.' },
  { id: 'Artists', label: 'ข้อมูลศิลปิน (Artists)', tag: 'artists', desc: 'ทำเนียบศิลปิน ดอกไม้ที่ชอบ ยอดซัพพอร์ตสะสม' },
  { id: 'Customers', label: 'ข้อมูลลูกค้า (Customers)', tag: 'customers', desc: 'ทะเบียนลูกค้า บ้านเบสแฟนคลับ VIP และยอดซื้อ' },
  { id: 'Staff', label: 'พนักงาน & ทีมงาน (Staff)', tag: 'staff', desc: 'บัญชีพนักงาน รหัสพนักงาน เบอร์โทร และสิทธิ์' },
  { id: 'Analytics', label: 'วิเคราะห์ธุรกิจ (Analytics)', tag: 'analytics', desc: 'กราฟรายได้ ยอดขายเฉลี่ย ศิลปินยอดนิยม' },
  { id: 'Settings', label: 'ตั้งค่าระบบ (Settings)', tag: 'settings', desc: 'ข้อมูลร้าน โลโก้ บอท และกำหนดสิทธิ์' }
];

export const ACTION_PERMISSIONS = [
  { key: 'can_edit_pricing', label: 'แก้ไขราคา & ต้นทุน (Pricing/Quotes)', desc: 'อนุญาตให้กำหนดราคาขาย ปรับต้นทุน และแก้อัตรากำไร' },
  { key: 'can_delete_project', label: 'ลบโปรเจกต์งาน (Delete Projects)', desc: 'อนุญาตให้ลบงานหรือโปรเจกต์ออกจากระบบ' },
  { key: 'can_borrow_tools', label: 'เบิก-ยืมอุปกรณ์ในคลัง (Borrow Tools)', desc: 'อนุญาตให้ทำรายการยืม-คืนอุปกรณ์และพัสดุ' },
  { key: 'can_manage_users', label: 'จัดการพนักงาน & สิทธิ์ (Manage Users)', desc: 'อนุญาตให้สร้าง/แก้ไขพนักงานและเปลี่ยนสิทธิ์การใช้งาน' }
];

const SETTINGS_CATEGORIES = [
  { id: 'permissions', label: 'สิทธิ์และบทบาท', icon: Shield, desc: 'กำหนดสิทธิ์การเข้าถึงแต่ละหน้าจอของทุกตำแหน่ง' },
  { id: 'shop', label: 'ข้อมูลร้าน & แบรนด์', icon: StoreIcon, desc: 'โลโก้ ชื่อร้าน ข้อมูลติดต่อ โซเชียล และธีมสี' },
  { id: 'integrations', label: 'การเชื่อมต่อ & บอท', icon: Bot, desc: 'Google Drive, LINE Bot, Telegram' },
  { id: 'options', label: 'ตัวเลือกระบบ', icon: Sliders, desc: 'หมวดหมู่งาน หมวดหมู่ค่าใช้จ่าย และสถานะงาน' },
  { id: 'database', label: 'ฐานข้อมูล & ซิงค์', icon: Database, desc: 'สถานะ Supabase แคชในเครื่อง และการสำรอง' }
];

const ListManager = ({ title, items = [], onAdd, onDelete, placeholder, icon: Icon, onSave }) => {
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
    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4 text-slate-800 font-bold border-b border-slate-100 pb-3">
        <div className="p-2 bg-violet-50 text-violet-600 rounded-lg">
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
          className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all font-medium"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
        />
        <button
          onClick={handleAdd}
          className="p-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-xl shadow-md shadow-violet-200/50 transition cursor-pointer active:scale-95"
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
              className="text-slate-400 hover:text-rose-500 transition-colors p-1"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">ไม่มีรายการ</p>
        )}
      </div>
    </div>
  );
};

const SortableListManager = ({ 
  title, 
  items = [], 
  onUpdate, 
  placeholder, 
  icon: Icon, 
  onSave,
  type = 'status'
}) => {
  const [newItemLabel, setNewItemLabel] = useState('');
  const [newItemType, setNewItemType] = useState('active');
  const [selectedColor, setSelectedColor] = useState(colorPresets[0].value);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [draggedItemIndex, setDraggedItemIndex] = useState(null);

  const handleAddOrUpdate = () => {
    if (!newItemLabel.trim()) return;

    if (editingIndex >= 0) {
      const updated = [...items];
      updated[editingIndex] = {
        ...updated[editingIndex],
        label: newItemLabel.trim(),
        type: type === 'transport' ? newItemType : undefined,
        color: selectedColor
      };
      onUpdate(updated);
      onSave(updated);
      setEditingIndex(-1);
    } else {
      const newItem = {
        value: `custom_${Date.now()}`,
        label: newItemLabel.trim(),
        type: type === 'transport' ? newItemType : undefined,
        color: selectedColor
      };
      const updated = [...items, newItem];
      onUpdate(updated);
      onSave(updated);
    }

    setNewItemLabel('');
    setSelectedColor(colorPresets[0].value);
    setNewItemType('active');
  };

  const handleEdit = (index) => {
    const item = items[index];
    setEditingIndex(index);
    setNewItemLabel(item.label || '');
    setSelectedColor(item.color || colorPresets[0].value);
    if (item.type) setNewItemType(item.type);
  };

  const handleCancelEdit = () => {
    setEditingIndex(-1);
    setNewItemLabel('');
    setSelectedColor(colorPresets[0].value);
    setNewItemType('active');
  };

  const handleDelete = (index) => {
    const updatedItems = items.filter((_, i) => i !== index);
    onUpdate(updatedItems);
    onSave(updatedItems);
    if (editingIndex === index) handleCancelEdit();
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
    setDraggedItemIndex(null);
    onSave(items);
  };

  const isEditing = editingIndex >= 0;

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2 text-slate-800 font-bold">
          <div className="p-2 bg-violet-50 text-violet-600 rounded-lg">
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
          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all font-medium"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAddOrUpdate();
          }}
        />
        
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 min-w-[140px]">
            <select
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              className="w-full pl-8 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all cursor-pointer"
            >
              {colorPresets.map(preset => (
                <option key={preset.name} value={preset.value}>
                  {preset.name}
                </option>
              ))}
            </select>
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <span className={`w-3 h-3 rounded-full block ${colorPresets.find(p => p.value === selectedColor)?.dot || 'bg-slate-400'}`} />
            </div>
          </div>

          <div className="flex gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={handleAddOrUpdate}
                  className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition flex items-center justify-center font-bold text-xs cursor-pointer active:scale-95 shadow-sm"
                  title="บันทึก"
                >
                  <Check className="w-4 h-4 mr-1" /> บันทึก
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="p-2 bg-slate-200 text-slate-600 rounded-xl hover:bg-slate-300 transition flex items-center justify-center cursor-pointer active:scale-95"
                  title="ยกเลิก"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                onClick={handleAddOrUpdate}
                className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-xl transition flex items-center justify-center font-bold text-xs shadow-md shadow-violet-200/50 cursor-pointer active:scale-95"
                title="เพิ่ม"
              >
                <Plus className="w-4 h-4 mr-1" /> เพิ่ม
              </button>
            )}
          </div>
        </div>

        {/* Color preview row */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider mr-1">สีพรีเซ็ต:</span>
          {colorPresets.map(preset => (
            <button
              key={preset.name}
              type="button"
              onClick={() => setSelectedColor(preset.value)}
              className={`w-5 h-5 rounded-full ${preset.dot} transition-transform flex items-center justify-center cursor-pointer ${
                selectedColor === preset.value ? 'scale-125 ring-2 ring-violet-500 ring-offset-1' : 'hover:scale-110 opacity-70 hover:opacity-100'
              }`}
              title={preset.name}
            >
              {selectedColor === preset.value && <Check className="w-3 h-3 text-white stroke-[3]" />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar max-h-[300px] space-y-2 pr-1">
        {items.map((item, idx) => (
          <div 
            key={item.value || idx} 
            draggable
            onDragStart={(e) => onDragStart(e, idx)}
            onDragOver={(e) => onDragOver(e, idx)}
            onDragEnd={onDragEnd}
            className={`flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white hover:border-slate-300 transition-all cursor-move select-none shadow-sm ${
              draggedItemIndex === idx ? 'opacity-40 border-dashed border-violet-400' : ''
            } ${editingIndex === idx ? 'ring-2 ring-amber-400 bg-amber-50/20' : ''}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <GripVertical className="w-4 h-4 text-slate-400 shrink-0" />
              <span className={`text-xs px-2.5 py-1 rounded-lg border font-bold truncate ${item.color || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                {item.label}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0 ml-2">
              <button
                onClick={() => handleEdit(idx)}
                className="p-1 text-slate-400 hover:text-violet-600 rounded-lg hover:bg-slate-50 transition cursor-pointer"
                title="แก้ไข"
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(idx)}
                className="p-1 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-50 transition cursor-pointer"
                title="ลบ"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

function Settings({
  isSyncingSettings,
  isUploadingProfile,
  handleProfileImageUpload,
  userProfile,
  requestDeleteProfile,
  driveFolderId,
  setDriveFolderId,
  driveFolders = [],
  setDriveFolders,
  saveSystemSettings,
  assetsDriveFolderId,
  setAssetsDriveFolderId,
  lineBotToken,
  setLineBotToken,
  telegramBotToken,
  setTelegramBotToken,
  deployUrl,
  setDeployUrl,
  telegramChatId,
  setTelegramChatId,
  handleFetchTelegramId,
  webAppUrl,
  setWebAppUrl,
  shopInfo = {},
  setShopInfo,
  isUploadingLogo,
  handleLogoUpload,
  requestDeleteLogo,
  isSaving,
  themeColors = defaultThemeColors,
  projectCategories = [],
  setProjectCategories,
  expenseCategories = [],
  setExpenseCategories,
  dealStatuses = [],
  setDealStatuses,
  transportStatuses = [],
  setTransportStatuses,
  handleLogout,
  processImageUrl = (url) => url,
  defaultCategory = 'permissions',
  onUpdateUserProfile = null
}) {
  const [activeCategory, setActiveCategory] = useState(defaultCategory || 'permissions');
  const displayedDriveFolders = driveFolders.some(f => f.type === 'inventory') ? driveFolders : [...driveFolders, {id: 'f_inventory', name: 'รูปสินค้าในคลัง', type: 'inventory', folderId: ''}];
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Theme Sync & Lag-free Debounced Save
  const saveThemeTimeoutRef = useRef(null);
  const rafThemeIdRef = useRef(null);
  const customColorInputRef = useRef(null);
  const customSwatchRef = useRef(null);
  const shopInfoRef = useRef(shopInfo);
  shopInfoRef.current = shopInfo;

  // GPS Location Locator State & Handler
  const [isLocatingGps, setIsLocatingGps] = useState(false);

  const handleGetShopCurrentGps = () => {
    if (!navigator.geolocation) {
      showToast('เบราว์เซอร์ไม่รองรับ Geolocation', 'error');
      return;
    }
    setIsLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        const coordsStr = `${lat}, ${lng}`;
        const mapUrl = `https://maps.google.com/?q=${lat},${lng}`;
        const updatedShop = {
          ...shopInfo,
          gpsLocation: coordsStr,
          mapLink: shopInfo.mapLink || mapUrl
        };
        setShopInfo(updatedShop);
        setIsLocatingGps(false);
        showToast(`ดึงพิกัดร้านจาก GPS สำเร็จ: ${coordsStr}`, 'success');
      },
      (err) => {
        setIsLocatingGps(false);
        showToast(`ไม่สามารถดึงพิกัดได้: ${err.message}`, 'error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Sync native input value when shopInfo.customColorValue updates externally
  useEffect(() => {
    if (customColorInputRef.current && shopInfo.customColorValue) {
      customColorInputRef.current.value = shopInfo.customColorValue;
    }
    if (customSwatchRef.current && shopInfo.themeColor === 'custom' && shopInfo.customColorValue) {
      customSwatchRef.current.style.background = shopInfo.customColorValue;
    }
  }, [shopInfo.customColorValue, shopInfo.themeColor]);

  const applyThemeUpdate = (updatedShopInfo) => {
    setShopInfo(updatedShopInfo);
    applyThemeVariables(updatedShopInfo.themeColor, updatedShopInfo.themeMode, updatedShopInfo.customColorValue);
    try {
      localStorage.setItem('nexus_shop_info', JSON.stringify(updatedShopInfo));
      broadcastShopInfoSync(updatedShopInfo);
    } catch (e) {}

    // 350ms Debounce for backend/network write to ensure silky-smooth 60fps color selection
    if (saveThemeTimeoutRef.current) clearTimeout(saveThemeTimeoutRef.current);
    saveThemeTimeoutRef.current = setTimeout(() => {
      if (saveSystemSettings) {
        saveSystemSettings('shop_info', updatedShopInfo, { silent: true });
      }
    }, 350);
  };

  const handleColorDrag = (val) => {
    if (!val) return;
    // 1. Instantly update custom swatch DOM directly (0ms, no React render)
    if (customSwatchRef.current) {
      customSwatchRef.current.style.background = val;
    }
    // 2. 60-120fps CSS variable update on :root (0.02ms)
    if (rafThemeIdRef.current) cancelAnimationFrame(rafThemeIdRef.current);
    rafThemeIdRef.current = requestAnimationFrame(() => {
      applyThemeVariables('custom', shopInfoRef.current?.themeMode, val);
    });
    // 3. Debounce React state & storage sync to avoid re-rendering App.jsx during active drag
    if (saveThemeTimeoutRef.current) clearTimeout(saveThemeTimeoutRef.current);
    saveThemeTimeoutRef.current = setTimeout(() => {
      applyThemeUpdate({
        ...shopInfoRef.current,
        themeColor: 'custom',
        customColorValue: val
      });
    }, 180);
  };

  const handleColorCommit = (val) => {
    if (!val) return;
    if (rafThemeIdRef.current) cancelAnimationFrame(rafThemeIdRef.current);
    if (saveThemeTimeoutRef.current) clearTimeout(saveThemeTimeoutRef.current);
    if (customSwatchRef.current) {
      customSwatchRef.current.style.background = val;
    }
    applyThemeVariables('custom', shopInfoRef.current?.themeMode, val);
    applyThemeUpdate({
      ...shopInfoRef.current,
      themeColor: 'custom',
      customColorValue: val
    });
  };

  // Permissions Matrix State (matching Screenshot 2)
  const [permissionMatrix, setPermissionMatrix] = useState(() => {
    try {
      const saved = localStorage.getItem('f2u_role_permissions');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_PERMISSION_MATRIX;
  });
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);

  // Custom Role Modal & Delete State
  const [isAddRoleModalOpen, setIsAddRoleModalOpen] = useState(false);
  const [newRoleForm, setNewRoleForm] = useState({
    label: '',
    name: '',
    code: '',
    description: '',
    allowed_pages: ['Calendar', 'Plans'],
    can_edit_pricing: false,
    can_delete_project: false,
    can_borrow_tools: true,
    can_manage_users: false
  });
  const [deleteRoleConfirm, setDeleteRoleConfirm] = useState({ isOpen: false, roleKey: null, roleLabel: '' });

  // Load Cloud Roles from Supabase on mount
  useEffect(() => {
    const fetchCloudRoles = async () => {
      try {
        const client = getActiveClient();
        if (!client) return;
        const { data, error } = await client.from('roles').select('*');
        if (!error && Array.isArray(data) && data.length > 0) {
          const cloudMatrix = {};
          data.forEach(r => {
            const def = DEFAULT_PERMISSION_MATRIX[r.name] || {};
            cloudMatrix[r.name] = {
              label: r.label || def.label || r.name,
              code: r.code || def.code || '99',
              description: r.description || def.description || '',
              allowed_pages: Array.isArray(r.allowed_pages) && r.allowed_pages.length > 0 ? r.allowed_pages : (def.allowed_pages || []),
              can_edit_pricing: r.can_edit_pricing !== undefined ? !!r.can_edit_pricing : !!def.can_edit_pricing,
              can_delete_project: r.can_delete_project !== undefined ? !!r.can_delete_project : !!def.can_delete_project,
              can_borrow_tools: r.can_borrow_tools !== undefined ? !!r.can_borrow_tools : (def.can_borrow_tools !== undefined ? def.can_borrow_tools : true),
              can_manage_users: r.can_manage_users !== undefined ? !!r.can_manage_users : !!def.can_manage_users,
              is_system_role: ['admin', 'technician', 'driver', 'accountant'].includes(r.name) || !!r.is_system_role
            };
          });
          setPermissionMatrix(prev => {
            const merged = { ...DEFAULT_PERMISSION_MATRIX, ...prev, ...cloudMatrix };
            localStorage.setItem('f2u_role_permissions', JSON.stringify(merged));
            return merged;
          });
        }
      } catch (err) {
        console.warn('Could not load roles from Supabase:', err);
      }
    };
    fetchCloudRoles();
  }, []);

  // Update defaultCategory when passed from parent
  useEffect(() => {
    if (defaultCategory) setActiveCategory(defaultCategory);
  }, [defaultCategory]);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

  // Toggle Page in Permission Matrix
  const handleTogglePage = (roleKey, pageId) => {
    setPermissionMatrix(prev => {
      const currentRole = prev[roleKey] || { allowed_pages: [] };
      const pages = currentRole.allowed_pages || [];
      const hasPage = pages.includes(pageId) || (pageId === 'Locations' && pages.includes('Venues'));
      let updatedPages;
      if (hasPage) {
        updatedPages = pages.filter(p => p !== pageId && (pageId !== 'Locations' || p !== 'Venues'));
      } else {
        updatedPages = [...pages.filter(p => pageId !== 'Locations' || p !== 'Venues'), pageId];
      }
      return {
        ...prev,
        [roleKey]: {
          ...currentRole,
          allowed_pages: updatedPages
        }
      };
    });
  };

  // Toggle Action Permission in Permission Matrix
  const handleToggleAction = (roleKey, actionKey) => {
    setPermissionMatrix(prev => {
      const currentRole = prev[roleKey] || {};
      return {
        ...prev,
        [roleKey]: {
          ...currentRole,
          [actionKey]: !currentRole[actionKey]
        }
      };
    });
  };

  // Save Permission Matrix to LocalStorage & Supabase
  const handleSavePermissionMatrix = async () => {
    setIsSavingPermissions(true);
    try {
      localStorage.setItem('f2u_role_permissions', JSON.stringify(permissionMatrix));
      broadcastPermissionsUpdated(permissionMatrix);

      // Upsert all roles to Supabase roles table
      try {
        const client = getActiveClient();
        if (client) {
          for (const [roleName, p] of Object.entries(permissionMatrix)) {
            await client.from('roles').upsert({
              name: roleName,
              label: p.label || roleName,
              code: p.code || '99',
              description: p.description || '',
              allowed_pages: p.allowed_pages || [],
              can_edit_pricing: !!p.can_edit_pricing,
              can_delete_project: !!p.can_delete_project,
              can_borrow_tools: !!p.can_borrow_tools,
              can_manage_users: !!p.can_manage_users,
              is_system_role: p.is_system_role !== undefined ? p.is_system_role : ['admin', 'technician', 'driver', 'accountant'].includes(roleName)
            }, { onConflict: 'name' });
          }
        }
      } catch (cErr) {
        console.warn('Could not sync roles to Supabase:', cErr);
      }

      showToast('บันทึกการตั้งค่าสิทธิ์และบทบาทเรียบร้อยแล้ว', 'success');
    } catch (err) {
      showToast('เกิดข้อผิดพลาดในการบันทึกสิทธิ์', 'error');
    } finally {
      setIsSavingPermissions(false);
    }
  };

  // Reset Permission Matrix to Defaults
  const handleResetPermissions = () => {
    setPermissionMatrix(DEFAULT_PERMISSION_MATRIX);
    showToast('รีเซ็ตสิทธิ์เป็นค่าเริ่มต้นแล้ว (กรุณากดบันทึก)', 'info');
  };

  // Helper to open Add Role modal with auto-suggested 2-digit code
  const handleOpenAddRole = () => {
    const existingCodes = Object.values(permissionMatrix)
      .map(r => parseInt(r.code, 10))
      .filter(n => !isNaN(n) && n >= 10 && n < 90);
    const maxCode = existingCodes.length > 0 ? Math.max(...existingCodes) : 41;
    const nextCode = String(maxCode >= 41 ? maxCode + 10 : 51);

    setNewRoleForm({
      label: '',
      name: '',
      code: nextCode,
      description: '',
      allowed_pages: ['Calendar', 'Plans'],
      can_edit_pricing: false,
      can_delete_project: false,
      can_borrow_tools: true,
      can_manage_users: false
    });
    setIsAddRoleModalOpen(true);
  };

  // Create new Custom Role
  const handleCreateRole = async (e) => {
    if (e) e.preventDefault();
    if (!newRoleForm.label.trim()) {
      showToast('กรุณาระบุชื่อตำแหน่ง (ภาษาไทย)', 'error');
      return;
    }
    
    // Auto generate role key if blank
    let roleKey = newRoleForm.name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!roleKey) {
      roleKey = 'role_' + Date.now().toString(36);
    }

    if (permissionMatrix[roleKey]) {
      showToast(`รหัสบทบาท "${roleKey}" มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น`, 'error');
      return;
    }

    const newRole = {
      label: newRoleForm.label.trim(),
      code: newRoleForm.code.trim() || '51',
      description: newRoleForm.description.trim(),
      allowed_pages: newRoleForm.allowed_pages || ['Calendar', 'Plans'],
      can_edit_pricing: !!newRoleForm.can_edit_pricing,
      can_delete_project: !!newRoleForm.can_delete_project,
      can_borrow_tools: !!newRoleForm.can_borrow_tools,
      can_manage_users: !!newRoleForm.can_manage_users,
      is_system_role: false
    };

    const updated = {
      ...permissionMatrix,
      [roleKey]: newRole
    };

    setPermissionMatrix(updated);
    localStorage.setItem('f2u_role_permissions', JSON.stringify(updated));
    broadcastPermissionsUpdated(updated);

    // Persist to Supabase if connected
    try {
      const client = getActiveClient();
      if (client) {
        await client.from('roles').upsert({
          name: roleKey,
          label: newRole.label,
          code: newRole.code,
          description: newRole.description,
          allowed_pages: newRole.allowed_pages,
          can_edit_pricing: newRole.can_edit_pricing,
          can_delete_project: newRole.can_delete_project,
          can_borrow_tools: newRole.can_borrow_tools,
          can_manage_users: newRole.can_manage_users,
          is_system_role: false
        }, { onConflict: 'name' });
      }
    } catch (err) {
      console.warn('Could not save new role to Supabase:', err);
    }

    setIsAddRoleModalOpen(false);
    showToast(`เพิ่มบทบาท "${newRole.label}" เรียบร้อยแล้ว`, 'success');
  };

  // Delete Custom Role Confirmation
  const handleConfirmDeleteRole = async () => {
    if (!deleteRoleConfirm.roleKey) return;
    const roleKey = deleteRoleConfirm.roleKey;

    const copy = { ...permissionMatrix };
    delete copy[roleKey];

    setPermissionMatrix(copy);
    localStorage.setItem('f2u_role_permissions', JSON.stringify(copy));
    broadcastPermissionsUpdated(copy);

    try {
      const client = getActiveClient();
      if (client) {
        await client.from('roles').delete().eq('name', roleKey);
      }
    } catch (err) {
      console.warn('Could not delete role from Supabase:', err);
    }

    setDeleteRoleConfirm({ isOpen: false, roleKey: null, roleLabel: '' });
    showToast('ลบบทบาทเรียบร้อยแล้ว', 'success');
  };

  return (
    <div className="w-full flex-1 px-4 sm:px-8 lg:px-10 pt-4 pb-24 md:pb-12 min-h-full space-y-6">
      
      {/* Settings Top Context Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 font-medium">
          <span className="text-slate-400">ระบบ Flower2U</span>
          <span className="text-slate-300">/</span>
          <span className="text-violet-700 font-bold bg-violet-50 px-2.5 py-1 rounded-xl border border-violet-100/80 flex items-center gap-1.5">
            {(() => {
              const currentCat = SETTINGS_CATEGORIES.find(c => c.id === activeCategory);
              if (!currentCat) return <span>ตั้งค่าระบบ</span>;
              const IconComp = currentCat.icon;
              return (
                <>
                  <IconComp className="w-3.5 h-3.5 text-violet-600" />
                  <span>{currentCat.label}</span>
                </>
              );
            })()}
          </span>
          <span className="hidden md:inline text-slate-400 text-xs">
            — {SETTINGS_CATEGORIES.find(c => c.id === activeCategory)?.desc}
          </span>
        </div>

        {isSyncingSettings && (
          <span className="flex items-center gap-1.5 text-xs font-bold bg-violet-50 text-violet-700 px-3 py-1 rounded-full animate-pulse border border-violet-100 shadow-sm">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            กำลังซิงค์การตั้งค่า...
          </span>
        )}
      </div>

      {/* Main 2-Column Responsive Layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        
        {/* Left Column: Categorized Navigation (Sticky on Desktop) */}
        <aside className="w-full lg:w-64 xl:w-72 shrink-0 lg:sticky lg:top-16 self-start space-y-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm p-2 sm:p-3 overflow-hidden">
            <div className="text-xs font-extrabold text-slate-400 uppercase tracking-wider px-3 py-2 hidden lg:block">
              หมวดหมู่การตั้งค่า
            </div>
            
            {/* Nav list / horizontal scroll on mobile */}
            <div className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible custom-scrollbar pb-1 lg:pb-0">
              {SETTINGS_CATEGORIES.map(cat => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all text-left shrink-0 lg:shrink cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md shadow-violet-200/60'
                        : 'text-slate-600 hover:bg-violet-50/50 hover:text-slate-900'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg shrink-0 ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{cat.label}</div>
                      <div className={`text-xs font-normal truncate hidden lg:block ${isActive ? 'text-violet-100' : 'text-slate-400'}`}>
                        {cat.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Right Column: Active Category Content */}
        <main className="flex-1 w-full min-w-0 space-y-6">

          {/* ============================================================ */}
          {/* TAB: ROLES & PERMISSIONS MATRIX */}
          {/* ============================================================ */}
          {activeCategory === 'permissions' && (
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden p-5 sm:p-7 space-y-6">
              
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-violet-50 text-violet-600 rounded-2xl shrink-0 mt-0.5 border border-violet-100/80">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                      ตารางสิทธิ์การใช้งานของแต่ละตำแหน่ง (Roles &amp; Permissions Matrix)
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                      กำหนดการเข้าถึงหน้าจอและฟังก์ชันพิเศษของแต่ละตำแหน่งในร้านค้า เพิ่มบทบาทใหม่ หรือปรับแต่งสิทธิ์
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 self-start xl:self-center">
                  <button
                    type="button"
                    onClick={handleOpenAddRole}
                    className="px-3.5 py-2 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-bold rounded-xl border border-violet-200/80 transition flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>+ เพิ่มบทบาทใหม่</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetPermissions}
                    className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    title="รีเซ็ตเป็นค่าเริ่มต้น"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>ค่าเริ่มต้น</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePermissionMatrix}
                    disabled={isSavingPermissions}
                    className="px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white text-xs font-bold rounded-xl shadow-md shadow-violet-200/50 transition flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    {isSavingPermissions ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>บันทึกสิทธิ์</span>
                  </button>
                </div>
              </div>

              {/* Matrix Table with Sticky Row Label Column & Centered Toggle Cells */}
              <div className="overflow-x-auto border border-slate-200/80 rounded-2xl shadow-sm">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-700">
                      <th className="py-3.5 px-5 font-extrabold min-w-[240px] sm:min-w-[280px] sticky left-0 z-20 bg-slate-50 border-r border-slate-200/80 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                        <span className="text-xs uppercase tracking-wider text-slate-600">ส่วนของระบบ / ฟังก์ชันการใช้งาน</span>
                      </th>
                      {Object.keys(permissionMatrix).map(roleKey => {
                        const r = permissionMatrix[roleKey] || DEFAULT_PERMISSION_MATRIX[roleKey] || {};
                        const isProtected = roleKey === 'admin' || r.is_system_role;
                        return (
                          <th key={roleKey} className="py-3.5 px-4 font-bold text-center min-w-[140px] sm:min-w-[160px] border-r border-slate-100 last:border-r-0 relative group">
                            <div className="flex flex-col items-center justify-center gap-1">
                              <div className="flex items-center gap-1.5 justify-center">
                                <span className="text-slate-900 font-black text-xs sm:text-sm text-center line-clamp-1">{r.label}</span>
                                {!isProtected && (
                                  <button
                                    type="button"
                                    onClick={() => setDeleteRoleConfirm({ isOpen: true, roleKey, roleLabel: r.label })}
                                    className="opacity-40 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                    title={`ลบบทบาท ${r.label}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                              <span className="font-mono text-xs font-bold text-violet-700 bg-violet-100/70 px-2 py-0.5 rounded-full border border-violet-200/60 shadow-xs">
                                รหัส {r.code || '99'}
                              </span>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {/* Section 1: Modules / Pages */}
                    <tr className="bg-slate-100/70 border-y border-slate-200/80">
                      <td colSpan={Object.keys(permissionMatrix).length + 1} className="py-2.5 px-5 text-xs font-extrabold text-slate-600 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <Layers className="w-3.5 h-3.5 text-violet-600" />
                          <span>การเข้าถึงหน้าจอและเมนูนำทาง (Navigation Access)</span>
                        </div>
                      </td>
                    </tr>

                    {SYSTEM_MODULES.map((mod) => (
                      <tr key={mod.id} className="hover:bg-violet-50/20 transition-colors group">
                        <td className="py-3 px-5 font-medium sticky left-0 z-10 bg-white group-hover:bg-violet-50/20 border-r border-slate-200/80 shadow-[2px_0_5px_rgba(0,0,0,0.02)] transition-colors">
                          <div className="text-slate-800 font-bold text-xs sm:text-sm">{mod.label}</div>
                          <div className="text-xs text-slate-500 font-medium mt-0.5 leading-snug">{mod.desc}</div>
                        </td>

                        {Object.keys(permissionMatrix).map(roleKey => {
                          const isAllowed = permissionMatrix[roleKey]?.allowed_pages?.includes(mod.id) || (mod.id === 'Locations' && permissionMatrix[roleKey]?.allowed_pages?.includes('Venues'));
                          return (
                            <td 
                              key={roleKey} 
                              onClick={() => handleTogglePage(roleKey, mod.id)}
                              className="py-3 px-4 text-center cursor-pointer border-r border-slate-100 last:border-r-0 hover:bg-violet-50/40 transition-colors select-none"
                            >
                              <div className="flex items-center justify-center">
                                <div className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all ${
                                  isAllowed 
                                    ? 'bg-violet-600 text-white shadow-xs shadow-violet-300' 
                                    : 'border-2 border-slate-200 hover:border-slate-300 bg-white'
                                }`}>
                                  {isAllowed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}

                    {/* Section 2: Special Actions */}
                    <tr className="bg-slate-100/70 border-y border-slate-200/80">
                      <td colSpan={Object.keys(permissionMatrix).length + 1} className="py-2.5 px-5 text-xs font-extrabold text-slate-600 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <Lock className="w-3.5 h-3.5 text-violet-600" />
                          <span>สิทธิ์การทำรายการพิเศษ (Action Permissions)</span>
                        </div>
                      </td>
                    </tr>

                    {ACTION_PERMISSIONS.map((action) => (
                      <tr key={action.key} className="hover:bg-violet-50/20 transition-colors group">
                        <td className="py-3 px-5 font-medium sticky left-0 z-10 bg-white group-hover:bg-violet-50/20 border-r border-slate-200/80 shadow-[2px_0_5px_rgba(0,0,0,0.02)] transition-colors">
                          <div className="text-slate-800 font-bold text-xs sm:text-sm">{action.label}</div>
                          <div className="text-xs text-slate-500 font-medium mt-0.5 leading-snug">{action.desc}</div>
                        </td>

                        {Object.keys(permissionMatrix).map(roleKey => {
                          const isGranted = permissionMatrix[roleKey]?.[action.key];
                          return (
                            <td 
                              key={roleKey} 
                              onClick={() => handleToggleAction(roleKey, action.key)}
                              className="py-3 px-4 text-center cursor-pointer border-r border-slate-100 last:border-r-0 hover:bg-violet-50/40 transition-colors select-none"
                            >
                              <div className="flex items-center justify-center">
                                <div className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all ${
                                  isGranted 
                                    ? 'bg-violet-600 text-white shadow-xs shadow-violet-300' 
                                    : 'border-2 border-slate-200 hover:border-slate-300 bg-white'
                                }`}>
                                  {isGranted && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bottom Notice */}
              <div className="p-4 bg-violet-50/70 rounded-2xl border border-violet-100/90 flex items-start gap-3 text-xs text-violet-950">
                <CheckCircle2 className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-bold">การมีผลบังคับใช้:</span> เมื่อบันทึกสิทธิ์ พนักงานในระบบจะเห็นเฉพาะเมนูที่ตำแหน่งตนเองได้รับอนุญาตทันที สำหรับผู้ดูแลระบบ (Admin) จะมีสิทธิ์เข้าถึงทุกหน้าโดยสมบูรณ์
                </div>
              </div>

              {/* Modal: Add New Role */}
              {isAddRoleModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4">
                  <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-md backdrop-animate-in"
                    onClick={() => setIsAddRoleModalOpen(false)}
                  />
                  <div className="bg-white w-full max-w-lg rounded-2xl sm:rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] relative z-10 modal-animate-in">
                    <div className="px-5 py-4 border-b border-slate-100 bg-white sticky top-0 z-20 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-violet-50 text-violet-600 rounded-xl">
                          <UserPlus className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-base font-black text-slate-900">เพิ่มบทบาท / ตำแหน่งใหม่</h4>
                          <p className="text-xs text-slate-500">สร้างตำแหน่งใหม่และกำหนดสิทธิ์เข้าถึงหน้าจอ</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsAddRoleModalOpen(false)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={handleCreateRole} className="flex flex-col flex-1 overflow-hidden">
                      <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 custom-scrollbar">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              ชื่อตำแหน่ง (ภาษาไทย) *
                            </label>
                            <input
                              type="text"
                              required
                              value={newRoleForm.label}
                              onChange={(e) => setNewRoleForm({ ...newRoleForm, label: e.target.value })}
                              placeholder="เช่น ผู้จัดการสาขา, ช่างภาพ"
                              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              รหัส 2 หลัก *
                            </label>
                            <input
                              type="text"
                              required
                              maxLength={3}
                              value={newRoleForm.code}
                              onChange={(e) => setNewRoleForm({ ...newRoleForm, code: e.target.value })}
                              placeholder="เช่น 51"
                              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono font-bold text-center focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                            <span>Key ระบบ (ภาษาอังกฤษพิมพ์เล็ก)</span>
                            <span className="text-xs text-slate-400">เว้นว่างไว้เพื่อสร้างอัตโนมัติ</span>
                          </label>
                          <input
                            type="text"
                            value={newRoleForm.name}
                            onChange={(e) => setNewRoleForm({ ...newRoleForm, name: e.target.value })}
                            placeholder="เช่น branch_manager, photographer"
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            คำอธิบายบทบาทและหน้าที่
                          </label>
                          <textarea
                            rows={2}
                            value={newRoleForm.description}
                            onChange={(e) => setNewRoleForm({ ...newRoleForm, description: e.target.value })}
                            placeholder="ระบุหน้าที่ความรับผิดชอบของตำแหน่งนี้..."
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                          />
                        </div>

                        {/* Page Permissions Checklist */}
                        <div className="pt-2 border-t border-slate-100">
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold text-slate-800">
                              กำหนดหน้าจอที่มองเห็นได้:
                            </label>
                            <div className="flex items-center gap-2 text-xs">
                              <button
                                type="button"
                                onClick={() => setNewRoleForm({ ...newRoleForm, allowed_pages: SYSTEM_MODULES.map(m => m.id) })}
                                className="text-violet-600 font-bold hover:underline cursor-pointer"
                              >
                                เลือกทั้งหมด
                              </button>
                              <span>|</span>
                              <button
                                type="button"
                                onClick={() => setNewRoleForm({ ...newRoleForm, allowed_pages: [] })}
                                className="text-slate-400 font-bold hover:underline cursor-pointer"
                              >
                                ล้าง
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto custom-scrollbar p-2 bg-slate-50 rounded-xl border border-slate-200/60">
                            {SYSTEM_MODULES.map(mod => {
                              const checked = (newRoleForm.allowed_pages || []).includes(mod.id) || (mod.id === 'Locations' && (newRoleForm.allowed_pages || []).includes('Venues'));
                              return (
                                <label
                                  key={mod.id}
                                  className={`flex items-center gap-2 p-2 rounded-lg text-xs cursor-pointer transition select-none ${
                                    checked ? 'bg-violet-50/90 text-violet-900 font-bold border border-violet-200/80' : 'text-slate-600 hover:bg-white'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      const cur = newRoleForm.allowed_pages || [];
                                      const next = checked
                                        ? cur.filter(id => id !== mod.id && (mod.id !== 'Locations' || id !== 'Venues'))
                                        : [...cur.filter(id => mod.id !== 'Locations' || id !== 'Venues'), mod.id];
                                      setNewRoleForm({ ...newRoleForm, allowed_pages: next });
                                    }}
                                    className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 accent-violet-600"
                                  />
                                  <span className="truncate">{mod.label.split('(')[0].trim()}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        {/* Action Permissions */}
                        <div className="pt-2 border-t border-slate-100 space-y-2">
                          <label className="text-xs font-bold text-slate-800 block">
                            สิทธิ์การทำรายการพิเศษ:
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {ACTION_PERMISSIONS.map(act => (
                              <label
                                key={act.key}
                                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition select-none border ${
                                  newRoleForm[act.key]
                                    ? 'bg-violet-50/90 text-violet-900 font-bold border-violet-200/80'
                                    : 'text-slate-600 border-slate-100 hover:bg-slate-50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={!!newRoleForm[act.key]}
                                  onChange={() => setNewRoleForm({ ...newRoleForm, [act.key]: !newRoleForm[act.key] })}
                                  className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 accent-violet-600"
                                />
                                <span className="truncate">{act.label.split('(')[0].trim()}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2.5">
                        <button
                          type="button"
                          onClick={() => setIsAddRoleModalOpen(false)}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                        >
                          ยกเลิก
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-violet-200/60 transition cursor-pointer active:scale-95"
                        >
                          สร้างบทบาทใหม่
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Delete Role Confirm Dialog */}
              <ConfirmDialog
                isOpen={deleteRoleConfirm.isOpen}
                title="ยืนยันการลบบทบาท"
                message={`คุณต้องการลบบทบาท "${deleteRoleConfirm.roleLabel}" หรือไม่? หากลบแล้วพนักงานในบทบาทนี้จะถูกนำทางตามค่าเริ่มต้นของระบบ`}
                confirmText="ลบบทบาท"
                cancelText="ยกเลิก"
                type="danger"
                onConfirm={handleConfirmDeleteRole}
                onCancel={() => setDeleteRoleConfirm({ isOpen: false, roleKey: null, roleLabel: '' })}
              />

            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 3: SHOP & BRANDING (ข้อมูลร้าน & แบรนด์) */}
          {/* ============================================================ */}
          {activeCategory === 'shop' && (
            <div className="space-y-6">
              {/* Shop Profile & Logo */}
              <div className="bg-white p-6 sm:p-8 rounded-2xl sm:rounded-[2rem] border border-slate-200/80 shadow-sm space-y-6">
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
                  <StoreIcon className="w-5 h-5 text-violet-600" />
                  <span>ข้อมูลร้านและช่องทางติดต่อ (Shop Branding)</span>
                </h3>

                {/* Logo Uploader */}
                <div className="flex flex-col sm:flex-row items-center gap-5 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-20 h-20 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                    {shopInfo.logoUrl ? (
                      <img src={processImageUrl(shopInfo.logoUrl)} alt="Logo" className="w-full h-full object-contain p-2" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-slate-300" />
                    )}
                  </div>

                  <div className="space-y-2 text-center sm:text-left flex-1">
                    <h4 className="font-bold text-sm text-slate-800">โลโก้ร้านค้า (Shop Logo)</h4>
                    <p className="text-xs text-slate-500">สำหรับแสดงบนหัวบิล หัวเอกสารเสนอราคา และหัวตาราง</p>
                    <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                      <label className="px-3.5 py-1.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-violet-200/40">
                        {isUploadingLogo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                        <span>อัปโหลดโลโก้</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => e.target.files[0] && handleLogoUpload(e.target.files[0])}
                        />
                      </label>
                      {shopInfo.logoUrl && (
                        <button
                          type="button"
                          onClick={requestDeleteLogo}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold border border-rose-100 transition cursor-pointer"
                        >
                          ลบโลโก้
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Shop Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">ชื่อร้าน / แบรนด์</label>
                    <input
                      type="text"
                      value={shopInfo.shopName || ''}
                      onChange={(e) => setShopInfo({ ...shopInfo, shopName: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">เบอร์โทรศัพท์ร้าน</label>
                    <input
                      type="tel"
                      value={shopInfo.phone || ''}
                      onChange={(e) => setShopInfo({ ...shopInfo, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">อีเมลร้าน</label>
                    <input
                      type="email"
                      value={shopInfo.email || ''}
                      onChange={(e) => setShopInfo({ ...shopInfo, email: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">LINE ID</label>
                    <input
                      type="text"
                      value={shopInfo.line || ''}
                      onChange={(e) => setShopInfo({ ...shopInfo, line: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ที่อยู่หน้าร้าน / สตูดิโอ</label>
                  <textarea
                    rows={2}
                    value={shopInfo.address || ''}
                    onChange={(e) => setShopInfo({ ...shopInfo, address: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
                  />
                </div>

                {/* GPS Location & Coordinates for Logistics Map */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-50/70 via-violet-50/40 to-slate-50 border border-indigo-100 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-black text-slate-900">
                          พิกัด GPS หน้าร้าน / คลังกระจายสินค้า (Logistics Hub)
                        </h4>
                        <p className="text-xs text-slate-500">
                          พิกัดนี้จะใช้เป็นจุดเริ่มต้นคำนวณระยะทางและเส้นทางในหน้า <b>"สถานที่จัดส่ง"</b> โดยอัตโนมัติ
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleGetShopCurrentGps}
                      disabled={isLocatingGps}
                      className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                      title="กดเพื่อดึงพิกัด GPS จากตำแหน่งเครื่องของคุณปัจจุบัน"
                    >
                      <Crosshair className={`w-3.5 h-3.5 ${isLocatingGps ? 'animate-spin text-indigo-600' : 'text-indigo-600'}`} />
                      <span>{isLocatingGps ? 'กำลังระบุพิกัด...' : '📍 ดึงพิกัดจาก GPS ปัจจุบัน'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        พิกัดละติจูด, ลองจิจูด (Latitude, Longitude)
                      </label>
                      <input
                        type="text"
                        placeholder="เช่น 13.736717, 100.523186 หรือวางลิงก์ Google Maps"
                        value={shopInfo.gpsLocation || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setShopInfo(prev => ({ ...prev, gpsLocation: val }));
                        }}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
                      />
                      <span className="text-xs text-slate-400 mt-1 block">
                        รองรับทั้งตัวเลขพิกัด หรือวางลิงก์ Google Maps ทุกรูปแบบ
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700">
                          ลิงก์ Google Maps ของร้าน
                        </label>
                        {shopInfo.mapLink && (
                          <a
                            href={shopInfo.mapLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                          >
                            <span>ทดสอบเปิดแผนที่</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <input
                        type="url"
                        placeholder="https://maps.google.com/?q=..."
                        value={shopInfo.mapLink || ''}
                        onChange={(e) => setShopInfo(prev => ({ ...prev, mapLink: e.target.value }))}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
                      />
                      <span className="text-xs text-slate-400 mt-1 block">
                        ลิงก์ Google Maps สำหรับให้ทีมงานหรือลูกค้าเปิดดูพิกัดร้าน
                      </span>
                    </div>
                  </div>
                </div>

                {/* Social media inputs */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">ช่องทางโซเชียลมีเดีย</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                      <Facebook className="w-4 h-4 text-blue-600 shrink-0" />
                      <input
                        type="text"
                        placeholder="Facebook Page"
                        value={shopInfo.facebook || ''}
                        onChange={(e) => setShopInfo({ ...shopInfo, facebook: e.target.value })}
                        className="w-full bg-transparent text-xs font-medium focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                      <Instagram className="w-4 h-4 text-pink-600 shrink-0" />
                      <input
                        type="text"
                        placeholder="Instagram Account"
                        value={shopInfo.instagram || ''}
                        onChange={(e) => setShopInfo({ ...shopInfo, instagram: e.target.value })}
                        className="w-full bg-transparent text-xs font-medium focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                      <Music2 className="w-4 h-4 text-slate-900 shrink-0" />
                      <input
                        type="text"
                        placeholder="TikTok"
                        value={shopInfo.tiktok || ''}
                        onChange={(e) => setShopInfo({ ...shopInfo, tiktok: e.target.value })}
                        className="w-full bg-transparent text-xs font-medium focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                      <XIcon className="w-4 h-4 text-slate-800 shrink-0" />
                      <input
                        type="text"
                        placeholder="X / Twitter"
                        value={shopInfo.twitter || ''}
                        onChange={(e) => setShopInfo({ ...shopInfo, twitter: e.target.value })}
                        className="w-full bg-transparent text-xs font-medium focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Theme Selector (ตรงตาม Screenshot 183053: Swatches ทรงกลม + ตัวดูดสี + เลือก Gradient/Solid) */}
                <div className="pt-4 border-t border-slate-100 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Palette className="w-4 h-4 text-violet-600" />
                      <span>ธีมสีหลักของระบบ (Theme Color)</span>
                    </h4>
                    <span className="text-xs text-slate-600 font-medium">
                      เลือกสีสำเร็จรูป หรือคลิกหลอดดูดเพื่อเลือกสีเองแบบ Real-time
                    </span>
                  </div>

                  {/* Circular Color Swatches */}
                  <div className="flex flex-wrap items-center gap-3.5 py-1">
                    {Object.entries(themeColors).map(([key, theme]) => {
                      const isSelected = shopInfo.themeColor === key;
                      const bgStyle = theme.isRainbow
                        ? 'linear-gradient(135deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #a855f7, #ec4899)'
                        : theme.main;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            applyThemeUpdate({ ...shopInfo, themeColor: key });
                          }}
                          className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full relative overflow-hidden transition-all duration-200 flex items-center justify-center cursor-pointer shadow-sm hover:scale-105 active:scale-95 ${
                            isSelected
                              ? 'ring-4 ring-offset-2 ring-slate-400 scale-110 shadow-md'
                              : 'hover:shadow-md'
                          }`}
                          style={{ background: bgStyle }}
                          title={theme.label}
                        >
                          {isSelected && (
                            <Check className="w-5 h-5 sm:w-6 sm:h-6 text-white drop-shadow-md" strokeWidth={3} />
                          )}
                        </button>
                      );
                    })}

                    {/* Custom Color Pipette Swatch */}
                    <div className="relative group">
                      <label
                        ref={customSwatchRef}
                        className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-transform duration-150 cursor-pointer shadow-sm relative overflow-hidden ${
                          shopInfo.themeColor === 'custom'
                            ? 'ring-4 ring-offset-2 ring-slate-400 scale-110 shadow-md'
                            : 'hover:scale-105 hover:shadow-md border border-slate-200'
                        }`}
                        style={{
                          background:
                            shopInfo.themeColor === 'custom' && shopInfo.customColorValue
                              ? shopInfo.customColorValue
                              : 'conic-gradient(from 90deg, #FF0000, #FFFF00, #00FF00, #00FFFF, #0000FF, #FF00FF, #FF0000)'
                        }}
                        title="กำหนดสีเอง (Custom Color)"
                      >
                        <input
                          ref={(el) => {
                            customColorInputRef.current = el;
                            if (el && !el._hasNativeChangeListener) {
                              el._hasNativeChangeListener = true;
                              el.addEventListener('change', (e) => handleColorCommit(e.target.value));
                            }
                          }}
                          type="color"
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                          defaultValue={shopInfo.customColorValue || '#8B5CF6'}
                          onInput={(e) => handleColorDrag(e.target.value)}
                        />
                        <div
                          className={`pointer-events-none z-0 ${
                            shopInfo.themeColor === 'custom'
                              ? 'text-white drop-shadow-md'
                              : 'text-slate-700 bg-white/80 p-1.5 rounded-full backdrop-blur-sm shadow-xs'
                          }`}
                        >
                          {shopInfo.themeColor === 'custom' ? (
                            <Check className="w-5 h-5 sm:w-6 sm:h-6 text-white drop-shadow-md" strokeWidth={3} />
                          ) : (
                            <Pipette className="w-4 h-4 sm:w-5 sm:h-5" />
                          )}
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Mode Selection (Gradient vs Solid) */}
                  <div className="pt-2">
                    <label className="text-xs font-bold text-slate-700 mb-2 block">
                      รูปแบบการแสดงผล (Display Mode)
                    </label>
                    <div className="flex gap-3 max-w-md">
                      <button
                        type="button"
                        onClick={() => applyThemeUpdate({ ...shopInfo, themeMode: 'gradient' })}
                        className={`flex-1 py-2.5 px-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 font-bold text-xs cursor-pointer ${
                          shopInfo.themeMode !== 'solid'
                            ? 'border-violet-600 bg-violet-50 text-violet-700 shadow-xs'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full bg-gradient-to-r from-violet-600 to-purple-600" />
                        <span>ไล่เฉดสี (Gradient)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => applyThemeUpdate({ ...shopInfo, themeMode: 'solid' })}
                        className={`flex-1 py-2.5 px-4 rounded-xl border-2 transition-all flex items-center justify-center gap-2 font-bold text-xs cursor-pointer ${
                          shopInfo.themeMode === 'solid'
                            ? 'border-violet-600 bg-violet-50 text-violet-700 shadow-xs'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full bg-violet-600" />
                        <span>สีเดียว (Solid)</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      // ซิงค์พิกัดเข้า flower2u_hub_settings สำหรับหน้า VenuesView ทันที
                      const parsed = parseCoordinatesFromInput(shopInfo.gpsLocation) || DEFAULT_FLOWER2U_HUB.coords;
                      const hubPayload = {
                        name: shopInfo.shopName || DEFAULT_FLOWER2U_HUB.name,
                        description: shopInfo.address || DEFAULT_FLOWER2U_HUB.description,
                        coords: parsed,
                        mapLink: shopInfo.mapLink || `https://maps.google.com/?q=${parsed[0]},${parsed[1]}`
                      };
                      try {
                        localStorage.setItem('flower2u_hub_settings', JSON.stringify(hubPayload));
                        window.dispatchEvent(new CustomEvent('flower2u_hub_updated', { detail: hubPayload }));
                      } catch (e) {}

                      saveSystemSettings('shop_info', shopInfo);
                    }}
                    className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-violet-200/50 transition flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Save className="w-4 h-4" />
                    <span>บันทึกข้อมูลร้าน</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 4: INTEGRATIONS & BOTS (การเชื่อมต่อ & บอท) */}
          {/* ============================================================ */}
          {activeCategory === 'integrations' && (
            <div className="space-y-6">
              {/* Google Drive */}
              <div className="bg-white p-6 sm:p-8 rounded-2xl sm:rounded-[2rem] border border-slate-200/80 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                    <HardDrive className="w-5 h-5 text-blue-600" />
                    <span>โฟลเดอร์ Google Drive (จัดเก็บไฟล์)</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      const newFolder = { id: `folder_${Date.now()}`, name: 'โฟลเดอร์ใหม่', type: 'custom', folderId: '' };
                      setDriveFolders([...driveFolders, newFolder]);
                    }}
                    className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-bold border border-blue-100 transition flex items-center gap-1 cursor-pointer"
                  >
                    <FolderPlus className="w-4 h-4" />
                    <span>เพิ่มโฟลเดอร์</span>
                  </button>
                </div>

                <p className="text-xs text-slate-500">
                  ระบุ Folder ID สำหรับไฟล์แต่ละประเภท รูปสินค้าในคลังใช้โฟลเดอร์เฉพาะได้ หากเว้นว่างจะใช้โฟลเดอร์ Assets เดิม
                </p>

                <div className="space-y-3">
                  {displayedDriveFolders.map((f, idx) => (
                    <div key={f.id || idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                        <input
                          type="text"
                          value={f.name || ''}
                          onChange={(e) => {
                            const updated = [...displayedDriveFolders];
                            updated[idx] = {...f, name: e.target.value};
                            setDriveFolders(updated);
                          }}
                          placeholder="ชื่อโฟลเดอร์"
                          className="w-full min-w-0 min-h-[44px] font-bold text-xs sm:text-sm bg-transparent border-b border-dashed border-slate-300 focus:outline-none focus:border-[var(--theme-main)]"
                        />
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <input
                          type="text"
                          value={f.folderId || ''}
                          onChange={(e) => {
                            const updated = [...displayedDriveFolders];
                            updated[idx] = {...f, folderId: e.target.value.trim()};
                            setDriveFolders(updated);
                          }}
                          placeholder="Drive Folder ID"
                          className="flex-1 min-w-0 min-h-[44px] sm:w-56 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[var(--theme-main)]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = displayedDriveFolders.filter((_, i) => i !== idx);
                            setDriveFolders(updated);
                          }}
                          disabled={f.type === 'inventory'}
                          aria-label={`ลบโฟลเดอร์ ${f.name}`}
                          className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition cursor-pointer disabled:opacity-30"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => saveSystemSettings('drive_folders', displayedDriveFolders)}
                    disabled={isSaving}
                    className="px-5 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-violet-200/50 transition flex items-center gap-2 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>บันทึก Google Drive</span>
                  </button>
                </div>
              </div>

              {/* Chatbot AI (LINE & Telegram) */}
              <div className="bg-white p-6 sm:p-8 rounded-2xl sm:rounded-[2rem] border border-slate-200/80 shadow-sm space-y-6">
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
                  <Bot className="w-5 h-5 text-sky-600" />
                  <span>การเชื่อมต่อ LINE Bot &amp; Telegram Bot</span>
                </h3>

                <div className="grid grid-cols-1 gap-6">
                  {/* LINE Bot */}
                  <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-3">
                    <div className="flex items-center gap-2">
                      <LineIcon className="w-5 h-5 text-emerald-600" />
                      <h4 className="font-bold text-sm text-slate-800">LINE Messaging API (Line Bot)</h4>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Channel Access Token</label>
                      <input
                        type="password"
                        value={lineBotToken || ''}
                        onChange={(e) => setLineBotToken(e.target.value)}
                        placeholder="วาง Channel Access Token จาก LINE Developers"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  </div>

                  {/* Telegram Bot */}
                  <div className="p-4 bg-sky-50/50 rounded-2xl border border-sky-100 space-y-3">
                    <div className="flex items-center gap-2">
                      <TelegramIcon className="w-5 h-5 text-sky-600" />
                      <h4 className="font-bold text-sm text-slate-800">Telegram Bot Notifications</h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Bot Token</label>
                        <input
                          type="password"
                          value={telegramBotToken || ''}
                          onChange={(e) => setTelegramBotToken(e.target.value)}
                          placeholder="123456789:ABCdef..."
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Chat ID</label>
                        <input
                          type="text"
                          value={telegramChatId || ''}
                          onChange={(e) => setTelegramChatId(e.target.value)}
                          placeholder="-100xxxxxxxxx"
                          className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      saveSystemSettings('line_bot_token', lineBotToken);
                      saveSystemSettings('telegram_bot_token', telegramBotToken);
                      saveSystemSettings('telegram_chat_id', telegramChatId);
                      showToast('บันทึกการตั้งค่าบอทเรียบร้อยแล้ว', 'success');
                    }}
                    className="px-5 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-violet-200/50 transition flex items-center gap-2 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>บันทึกการตั้งค่าบอท</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 5: SYSTEM OPTIONS (ตัวเลือกระบบ) */}
          {/* ============================================================ */}
          {activeCategory === 'options' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ListManager
                  title="หมวดหมู่งาน (Project Categories)"
                  items={projectCategories}
                  onAdd={(val) => setProjectCategories([...projectCategories, val])}
                  onDelete={(idx) => setProjectCategories(projectCategories.filter((_, i) => i !== idx))}
                  placeholder="เพิ่มหมวดหมู่งาน..."
                  icon={Tag}
                  onSave={(newItems) => saveSystemSettings('project_categories', newItems)}
                />

                <ListManager
                  title="หมวดหมู่ค่าใช้จ่าย (Expense Categories)"
                  items={expenseCategories}
                  onAdd={(val) => setExpenseCategories([...expenseCategories, val])}
                  onDelete={(idx) => setExpenseCategories(expenseCategories.filter((_, i) => i !== idx))}
                  placeholder="เพิ่มหมวดหมู่ค่าใช้จ่าย..."
                  icon={DollarSign}
                  onSave={(newItems) => saveSystemSettings('expense_categories', newItems)}
                />

                <SortableListManager
                  title="สถานะดีลงาน (Deal Status)"
                  items={dealStatuses}
                  onUpdate={setDealStatuses} 
                  placeholder="เพิ่มสถานะดีล..."
                  icon={Briefcase}
                  onSave={(newItems) => saveSystemSettings('deal_statuses', newItems)}
                  type="status"
                />

                <SortableListManager
                  title="สถานะขนส่ง (Transport Status)"
                  items={transportStatuses}
                  onUpdate={setTransportStatuses} 
                  placeholder="เพิ่มสถานะขนส่ง..."
                  icon={Truck}
                  onSave={(newItems) => saveSystemSettings('transport_statuses', newItems)}
                  type="transport"
                />
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 6: DATABASE & SYNC (ฐานข้อมูล & ซิงค์) */}
          {/* ============================================================ */}
          {activeCategory === 'database' && (
            <div className="bg-white p-6 sm:p-8 rounded-2xl sm:rounded-[2rem] border border-slate-200/80 shadow-sm space-y-6">
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
                <Database className="w-5 h-5 text-violet-600" />
                <span>สถานะฐานข้อมูลและแคช (Database &amp; Storage)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <span className="text-xs font-bold text-emerald-600 uppercase block">ฐานข้อมูลออฟไลน์</span>
                  <span className="text-lg font-black text-emerald-950 block mt-1">IndexedDB Active</span>
                  <p className="text-xs text-emerald-700 mt-1">จัดเก็บข้อมูลโปรเจกต์ คำนวณราคา และพัสดุในเครื่อง 0ms</p>
                </div>

                <div className="p-4 bg-violet-50 rounded-2xl border border-violet-100">
                  <span className="text-xs font-bold text-violet-600 uppercase block">คลาวด์ซิงค์</span>
                  <span className="text-lg font-black text-violet-950 block mt-1">Supabase Cloud</span>
                  <p className="text-xs text-violet-700 mt-1">เชื่อมต่อตาราง staff_users, projects, quotations แบบ Realtime</p>
                </div>

                <div className="p-4 bg-slate-100/70 rounded-2xl border border-slate-200/80">
                  <span className="text-xs font-bold text-slate-600 uppercase block">ความปลอดภัย</span>
                  <span className="text-lg font-black text-slate-900 block mt-1">Role-Based Guard</span>
                  <p className="text-xs text-slate-600 mt-1">ระบบจำกัดสิทธิ์หน้าจอตามตำแหน่งงาน 100%</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                <h4 className="font-bold text-xs text-slate-700 uppercase">ล้างข้อมูลแคชชั่วคราว (Clear Local Cache)</h4>
                <p className="text-xs text-slate-500">
                  หากพบว่าข้อมูลในเครื่องไม่ตรงกับระบบคลาวด์ สามารถล้างแคชเพื่อดึงข้อมูลสดจาก Supabase ใหม่ได้
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem('f2u_projects_cache');
                      showToast('ล้างแคชเรียบร้อยแล้ว กำลังโหลดข้อมูลใหม่', 'info');
                      setTimeout(() => window.location.reload(), 800);
                    }}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    ล้างแคชและรีเฟรชหน้าเว็บ
                  </button>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Toast Notification */}
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ show: false, message: '', type: 'success' })}
        />
      )}

    </div>
  );
}

export default React.memo(Settings);
