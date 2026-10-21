import React, { useState } from 'react';
import {
  Loader2,
  Camera,
  Trash2,
  Mail,
  Phone,
  Users,
  UserPlus,
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
  LogOut,
  Facebook,
  Instagram,
  Music2,
  Plus,
  XCircle,
  GripVertical,
  Layers,
  Edit,
  X
} from 'lucide-react';

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
  rainbow: { 
    label: 'Rainbow', 
    main: '#8b5cf6', hover: '#7c3aed', light: '#faf5ff', textLight: '#8b5cf6',
    gradientFrom: '#ec4899', gradientTo: '#3b82f6',
    shadow: 'rgba(139, 92, 246, 0.4)',
    isRainbow: true
  }
};

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

const AdvancedListManager = ({ title, items = [], onUpdate, placeholder, icon: Icon, onSave }) => {
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

const SettingsView = ({
  isSyncingSettings,
  isUploadingProfile,
  handleProfileImageUpload,
  userProfile,
  requestDeleteProfile,
  authorizedUsers = [],
  handleDeleteUser,
  isAddingUser,
  setIsAddingUser,
  newUser,
  setNewUser,
  handleAddUser,
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
  processImageUrl = (url) => url
}) => {
  return (
    <div className="space-y-8 px-4 sm:px-8 lg:px-10 pt-6 pb-24 md:pb-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <h2 className="text-3xl font-extrabold text-slate-900">ตั้งค่าระบบ</h2>
          {isSyncingSettings && (
            <span className="flex items-center gap-1.5 text-xs font-bold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full animate-pulse border border-indigo-100 shadow-sm">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ซิงค์ข้อมูลล่าสุด...
            </span>
          )}
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden mb-8">
          <div className="h-48 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 relative">
            <div className="absolute right-6 top-6">
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
                  <div className="w-full h-full bg-slate-100 text-slate-600 rounded-full flex items-center justify-center text-4xl font-black border border-slate-200 overflow-hidden relative">
                    {userProfile?.image ? (
                      <img 
                        src={processImageUrl(userProfile.image)} 
                        alt="Profile" 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.target.onerror = null; 
                          e.target.style.display = 'none';
                          e.target.parentElement.classList.add('bg-slate-200');
                          e.target.parentElement.innerHTML = `<span class="text-4xl text-slate-400">${userProfile?.name?.charAt(0) || 'U'}</span>`;
                        }}
                      />
                    ) : (
                      userProfile?.name?.charAt(0) || 'U'
                    )}
                    
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

                  {/* Upload Button */}
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

                  {/* Delete Button */}
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

        {/* User Management */}
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

        {/* Google Drive Settings (Multi-Folder Management) */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-blue-600" />
              ตั้งค่า Google Drive (แยกโฟลเดอร์ตามหมวดหมู่)
            </h3>
            <button
              type="button"
              onClick={() => {
                const newId = `folder_${Date.now()}`;
                const newFolder = {
                  id: newId,
                  name: `โฟลเดอร์ใหม่ ${(driveFolders || []).length + 1}`,
                  folderId: '',
                  type: 'custom'
                };
                if (setDriveFolders) setDriveFolders([...(driveFolders || []), newFolder]);
              }}
              className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
            >
              <FolderPlus className="w-4 h-4" />
              เพิ่มโฟลเดอร์
            </button>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
            <p className="text-xs text-slate-500">
              ระบุ Folder ID จาก Google Drive เพื่อแยกจัดเก็บไฟล์ตามหมวดหมู่ (เช่น สลิปโอนเงิน, รูปภาพงาน, โลโก้/Assets) ทำให้ค้นหาและเป็นระเบียบยิ่งขึ้น
            </p>

            <div className="space-y-3">
              {(driveFolders && driveFolders.length > 0 ? driveFolders : [
                { id: 'f_ref', name: 'รูปภาพอ้างอิงงาน', folderId: driveFolderId || '', type: 'reference' },
                { id: 'f_slips', name: 'สลิปโอนเงินลูกค้า', folderId: '', type: 'slips' },
                { id: 'f_assets', name: 'ไฟล์ตกแต่งและ Assets', folderId: assetsDriveFolderId || '', type: 'assets' }
              ]).map((folder, index) => {
                const folderType = folder.type || 'custom';
                const typeConfig = {
                  slips: { label: 'สลิปโอนเงิน (Payment Slips)', icon: Receipt, color: 'text-amber-600 bg-amber-50 border-amber-200' },
                  reference: { label: 'รูปภาพอ้างอิงงาน (Reference)', icon: ImageIcon, color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
                  assets: { label: 'ไฟล์ตกแต่ง / Assets ร้าน', icon: Palette, color: 'text-blue-600 bg-blue-50 border-blue-200' },
                  custom: { label: 'กำหนดเอง (Custom)', icon: Folder, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' }
                }[folderType] || { label: 'กำหนดเอง (Custom)', icon: Folder, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
                const IconComponent = typeConfig.icon;

                return (
                  <div
                    key={folder.id || index}
                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`p-1.5 rounded-lg border flex items-center justify-center ${typeConfig.color}`}>
                          <IconComponent className="w-4 h-4" />
                        </span>
                        <input
                          type="text"
                          value={folder.name || ''}
                          onChange={(e) => {
                            const updated = (driveFolders || []).map(f => f.id === folder.id ? { ...f, name: e.target.value } : f);
                            if (setDriveFolders) setDriveFolders(updated);
                          }}
                          placeholder="ชื่อโฟลเดอร์"
                          className="font-bold text-sm text-slate-800 bg-transparent border-b border-dashed border-slate-300 focus:border-indigo-500 focus:outline-none px-1 py-0.5"
                        />
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <select
                          value={folder.type || 'custom'}
                          onChange={(e) => {
                            const updated = (driveFolders || []).map(f => f.id === folder.id ? { ...f, type: e.target.value } : f);
                            if (setDriveFolders) setDriveFolders(updated);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="slips">สลิปโอนเงิน (Payment Slips)</option>
                          <option value="reference">รูปภาพอ้างอิงงาน (Reference)</option>
                          <option value="assets">ไฟล์ตกแต่ง / Assets</option>
                          <option value="custom">กำหนดเอง (Custom)</option>
                        </select>

                        {(driveFolders || []).length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = (driveFolders || []).filter(f => f.id !== folder.id);
                              if (setDriveFolders) setDriveFolders(updated);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="ลบโฟลเดอร์นี้"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        placeholder="Google Drive Folder ID (e.g., 1xYz...)"
                        value={folder.folderId || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          const updated = (driveFolders || []).map(f => f.id === folder.id ? { ...f, folderId: val } : f);
                          if (setDriveFolders) setDriveFolders(updated);
                          if (folder.type === 'reference' && setDriveFolderId) setDriveFolderId(val);
                          if (folder.type === 'assets' && setAssetsDriveFolderId) setAssetsDriveFolderId(val);
                        }}
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition min-w-0"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  const newId = `folder_${Date.now()}`;
                  const newFolder = {
                    id: newId,
                    name: `โฟลเดอร์ใหม่ ${(driveFolders || []).length + 1}`,
                    folderId: '',
                    type: 'custom'
                  };
                  if (setDriveFolders) setDriveFolders([...(driveFolders || []), newFolder]);
                }}
                className="w-full sm:w-auto px-4 py-2 border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/20 text-slate-600 hover:text-blue-600 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                เพิ่มโฟลเดอร์อีก
              </button>

              <button
                type="button"
                onClick={() => {
                  const refFolder = (driveFolders || []).find(f => f.type === 'reference');
                  const assetsFolder = (driveFolders || []).find(f => f.type === 'assets');
                  const payload = {
                    drive_folders: driveFolders
                  };
                  if (refFolder && refFolder.folderId) {
                    payload.drive_folder_id = refFolder.folderId.trim();
                  }
                  if (assetsFolder && assetsFolder.folderId) {
                    payload.assets_drive_folder_id = assetsFolder.folderId.trim();
                  }
                  if (saveSystemSettings) {
                    saveSystemSettings(payload);
                  }
                }}
                className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm transition flex items-center justify-center gap-2 text-sm"
              >
                <Save className="w-4 h-4" />
                บันทึกการตั้งค่า Google Drive
              </button>
            </div>
          </div>
        </div>

        {/* Chatbot AI Settings */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Bot className="w-5 h-5 text-sky-600" />
            เชื่อมต่อ Chatbot AI (Access Tokens)
          </h3>
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
            <div className="grid grid-cols-1 gap-6">
              {/* LINE Bot Token */}
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

              {/* Telegram Settings */}
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
                    
                    {/* Deploy Link Input for Webhook */}
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

                {/* 2. Chat ID Input */}
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
                    *วิธีใช้: ทักบอทด้วยคำว่า <code>/id</code> แล้วกดปุ่ม &quot;ดึง ID ล่าสุด&quot; ระบบจะใส่เลขให้อัตโนมัติ
                  </p>
                </div>
              </div>

              {/* Web App URL */}
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
                  *สำคัญ: ระบุ URL ของเว็บไซต์นี้ เพื่อให้บอทสร้างปุ่ม &quot;ดูสถานะงาน&quot; ได้ถูกต้อง
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

        {/* Shop Contact Settings */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <StoreIcon className="w-5 h-5 text-indigo-600" />
            ข้อมูลติดต่อร้านค้า (Shop Contact)
          </h3>
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              
              {/* Logo Upload */}
              <div className="sm:col-span-2 flex items-center justify-center mb-4">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-2xl bg-white border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden hover:border-indigo-300 transition-colors relative shadow-sm cursor-pointer">
                    {shopInfo.logo ? (
                      <img 
                        src={processImageUrl(shopInfo.logo)} 
                        alt="Shop Logo" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => { e.target.style.display = 'none'; if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'; }}
                      />
                    ) : null}
                    
                    <div className={`flex-col items-center justify-center text-slate-400 ${shopInfo.logo ? 'hidden' : 'flex'}`}>
                      {isUploadingLogo ? <Loader2 className="w-6 h-6 animate-spin text-indigo-500" /> : <ImageIcon className="w-8 h-8 opacity-50" />}
                      <span className="text-[10px] font-bold mt-1 text-slate-300">{isUploadingLogo ? '...' : 'LOGO'}</span>
                    </div>

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
                  value={shopInfo.phone || ''}
                  onChange={e => setShopInfo({...shopInfo, phone: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 ml-1">อีเมล</label>
                <input 
                  type="email" 
                  placeholder="อีเมลร้าน" 
                  value={shopInfo.email || ''}
                  onChange={e => setShopInfo({...shopInfo, email: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-bold text-slate-500 ml-1">ที่อยู่ / สำนักงาน</label>
                <textarea 
                  rows={2}
                  placeholder="ที่อยู่ร้านค้า..." 
                  value={shopInfo.address || ''}
                  onChange={e => setShopInfo({...shopInfo, address: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 ml-1 flex items-center gap-1"><LineIcon className="w-3 h-3 text-[#06C755]"/> Line URL</label>
                <input 
                  type="text" 
                  placeholder="https://line.me/ti/p/..." 
                  value={shopInfo.line || ''}
                  onChange={e => setShopInfo({...shopInfo, line: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 ml-1 flex items-center gap-1"><Facebook className="w-3 h-3 text-[#1877F2]"/> Facebook URL</label>
                <input 
                  type="text" 
                  placeholder="https://facebook.com/..." 
                  value={shopInfo.facebook || ''}
                  onChange={e => setShopInfo({...shopInfo, facebook: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 ml-1 flex items-center gap-1"><Instagram className="w-3 h-3 text-[#C13584]"/> Instagram URL</label>
                <input 
                  type="text" 
                  placeholder="https://instagram.com/..." 
                  value={shopInfo.instagram || ''}
                  onChange={e => setShopInfo({...shopInfo, instagram: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 ml-1 flex items-center gap-1"><Music2 className="w-3 h-3 text-black"/> TikTok URL</label>
                <input 
                  type="text" 
                  placeholder="https://tiktok.com/@..." 
                  value={shopInfo.tiktok || ''}
                  onChange={e => setShopInfo({...shopInfo, tiktok: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

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
                disabled={isSaving || isUploadingLogo}
                className={`px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-sm transition flex items-center justify-center gap-2 ${isSaving || isUploadingLogo ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-700'}`}
              >
                {isUploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isUploadingLogo ? 'กำลังอัปโหลด...' : 'บันทึกข้อมูล'}
              </button>
            </div>
          </div>
        </div>

        {/* Theme Customization */}
        <div className="mb-8">
          <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Palette className="w-5 h-5 text-indigo-600" />
            ปรับแต่งธีม (Theme & Appearance)
          </h3>
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
            <div className="flex flex-col gap-6">
              
              {/* Primary Color Selection */}
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

                  <div className="w-px h-8 bg-slate-200 mx-1"></div>

                  {/* Custom Color Button */}
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
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600"></div>
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
                    <div className="w-6 h-6 rounded-full bg-indigo-600"></div>
                    สีเดียว (Solid)
                  </button>
                </div>
              </div>

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

        {/* System Options */}
        <h3 className="text-xl font-bold text-slate-900 mb-4">ตั้งค่าตัวเลือกระบบ (System Options)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ListManager
            title="หมวดหมู่งาน"
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

        {/* Logout */}
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
};

export default SettingsView;
