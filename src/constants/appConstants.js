// App Constants: Themes, Color Presets, Status Types

export const themeColors = {
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

export const colorPresets = [
  { name: 'Slate', value: 'bg-slate-50 text-slate-500 border-slate-200', dot: 'bg-slate-400' },
  { name: 'Blue', value: 'bg-blue-50 text-blue-700 border-blue-100', dot: 'bg-blue-500' },
  { name: 'Indigo', value: 'bg-indigo-50 text-indigo-700 border-indigo-100', dot: 'bg-indigo-500' },
  { name: 'Violet', value: 'bg-violet-50 text-violet-700 border-violet-100', dot: 'bg-violet-500' },
  { name: 'Amber', value: 'bg-amber-50 text-amber-700 border-amber-100', dot: 'bg-amber-500' },
  { name: 'Emerald', value: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-500' },
  { name: 'Rose', value: 'bg-rose-50 text-rose-700 border-rose-100', dot: 'bg-rose-500' },
  { name: 'Orange', value: 'bg-orange-50 text-orange-700 border-orange-100', dot: 'bg-orange-500' },
];

export const systemStatusTypes = [
  { value: 'completed', label: 'งานเสร็จสิ้น', color: 'text-emerald-600 bg-emerald-50' },
  { value: 'active', label: 'กำลังดำเนินการ', color: 'text-blue-600 bg-blue-50' },
  { value: 'pending', label: 'รอดำเนินการ', color: 'text-amber-600 bg-amber-50' },
  { value: 'cancelled', label: 'ยกเลิก/มีปัญหา', color: 'text-rose-600 bg-rose-50' },
  { value: 'declined', label: 'ลูกค้าไม่อนุมัติ', color: 'text-gray-600 bg-gray-50' }
];
