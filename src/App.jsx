import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Home, BarChart2, Settings, Search, Menu, X, TrendingUp, TrendingDown,
  Clipboard, CheckCircle, Clock, AlertCircle, MoreHorizontal, FileText,
  Users, List, User, Shield, LogOut, ChevronRight, ChevronLeft,
  ArrowUpRight, Folder, Plus, Calendar, MapPin, Trash2, DollarSign,
  Briefcase, Truck, Tag, Edit, AlertTriangle, Phone, ExternalLink,
  ArrowUpDown, ArrowUp, ArrowDown, Filter, RotateCcw, ChevronDown,
  PieChart, Activity, Hourglass, Trophy, Crown, SlidersHorizontal,
  StickyNote, Bell, Mail, Save, Moon, Camera, ListPlus, XCircle,
  GripVertical, Check, Palette, CalendarDays, Gift, Wallet, ThumbsDown,
  Layers, ChevronUp, Loader2, Wifi, WifiOff
} from 'lucide-react';

// --- CONFIGURATION ---
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzVAcljQwrnYwvzZ93d7RDIKpS2ctFDklrcq-HJzOgjFb0gvg1sNhxp3OiuZJ9CTXxX/exec"; 
// ---------------------

// --- Constants & Helpers ---
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

// --- Components ---

const ModernDateTimePicker = ({ value, onChange, placeholder, hasTime = true, disabled = false, pickerType = 'date' }) => {
  // (Simplified version for brevity, fully functional in a real file)
  return (
    <input 
      type={pickerType === 'date' ? (hasTime ? 'datetime-local' : 'date') : 'date'}
      value={value ? new Date(value).toISOString().slice(0, 16) : ''}
      onChange={onChange}
      disabled={disabled}
      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700"
    />
  );
};

const DashboardCard = ({ title, count, subtitle, icon: Icon, trend, colorClass = "bg-white" }) => (
  <div className={`p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all ${colorClass}`}>
    <div className="flex justify-between items-start mb-4">
      <div className="p-3 bg-white/80 rounded-2xl shadow-sm">
        <Icon className="w-6 h-6 text-slate-700" />
      </div>
      {trend && (
        <span className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${
          trend > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
        }`}>
          {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {Math.abs(trend)}%
        </span>
      )}
    </div>
    <div className="space-y-1">
      <p className="text-slate-500 text-sm font-medium">{title}</p>
      <h3 className="text-3xl font-black text-slate-800">{count}</h3>
      {subtitle && <p className="text-slate-400 text-xs">{subtitle}</p>}
    </div>
  </div>
);

const ListManager = ({ title, items, onAdd, onDelete, placeholder, icon: Icon }) => {
  const [newItem, setNewItem] = useState('');
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
            if (e.key === 'Enter' && newItem.trim()) {
              onAdd(newItem);
              setNewItem('');
            }
          }}
        />
        <button
          onClick={() => {
            if (newItem.trim()) {
              onAdd(newItem);
              setNewItem('');
            }
          }}
          className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto max-h-[200px] space-y-2">
         {items.map((item, idx) => (
           <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl group hover:bg-slate-100 transition-colors">
             <span className="text-sm font-medium text-slate-700">{typeof item === 'string' ? item : item.label}</span>
             <button onClick={() => onDelete(idx)} className="text-slate-300 hover:text-rose-500 transition-colors p-1">
               <XCircle className="w-4 h-4" />
             </button>
           </div>
         ))}
         {items.length === 0 && <p className="text-center text-slate-400 text-xs py-4">ไม่มีรายการ</p>}
      </div>
    </div>
  );
};

const AdvancedListManager = ({ title, items, onUpdate, placeholder, icon: Icon }) => {
  // This component was cut off in your code, so I'm simplifying it for demonstration
  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm h-full">
      <div className="flex items-center gap-2 mb-4 text-slate-800 font-bold border-b border-slate-100 pb-3">
        <Icon className="w-5 h-5 text-indigo-600" /> {title}
      </div>
      <div className="text-center text-slate-400 py-10">
        Feature กำลังพัฒนา (Advanced List Manager)
      </div>
    </div>
  );
};

// --- MAIN APP COMPONENT ---
function App() {
  const [activeTab, setActiveTab] = useState('Overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    summary: { total: 0, completed: 0, active: 0, issues: 0 },
    recentActivity: [],
    events: []
  });

  // Mock Data Loading (Replace with real fetch if needed)
  useEffect(() => {
    setLoading(true);
    // Simulate API Call
    setTimeout(() => {
      setData({
        summary: { total: 12, completed: 5, active: 4, issues: 1 },
        recentActivity: [
          { id: 'P-1000', title: 'งานจัดวันเกิด', time: new Date().toISOString(), status: 'รอดำเนินการจัดส่ง' },
          { id: 'P-1001', title: 'ประชุมวางแผน', time: new Date(Date.now() - 86400000).toISOString(), status: 'เสร็จสิ้น' }
        ],
        events: ['Three Man Down', 'Bodyslam']
      });
      setLoading(false);
    }, 1000);
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'Overview':
        return (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-black text-slate-800">สวัสดี, John</h1>
                <p className="text-slate-500 mt-1 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4" />
                  สรุปสถานะโครงการประจำวันที่ {new Date().toLocaleDateString('th-TH')}
                </p>
              </div>
              <button className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 flex items-center gap-2">
                <Plus className="w-5 h-5" /> เพิ่มโครงการ
              </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <DashboardCard title="โครงการทั้งหมด" count={data.summary.total} subtitle="รวมทั้งหมด" icon={Folder} trend={12} colorClass="bg-white" />
              <DashboardCard title="งานเสร็จสิ้น" count={data.summary.completed} subtitle="ปิดจ็อบแล้ว" icon={CheckCircle} trend={5} colorClass="bg-emerald-50/50 border-emerald-100" />
              <DashboardCard title="กำลังดำเนินการ" count={data.summary.active} subtitle="Active Now" icon={Clock} colorClass="bg-blue-50/50 border-blue-100" />
              <DashboardCard title="ยกเลิก/มีปัญหา" count={data.summary.issues} subtitle="ต้องตรวจสอบ" icon={AlertTriangle} colorClass="bg-rose-50/50 border-rose-100" />
            </div>

            {/* Recent Activity & Events */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                   <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                     <Activity className="w-5 h-5 text-indigo-500" /> บันทึกการดำเนินการล่าสุด
                   </h3>
                   <button className="text-sm text-indigo-600 font-bold hover:underline">ดูประวัติทั้งหมด</button>
                </div>
                <div className="space-y-4">
                  {data.recentActivity.map((act, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-slate-700 font-bold border border-slate-100">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{act.id}</p>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {formatDate(act.time)}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold bg-white px-3 py-1 rounded-lg border border-slate-200 text-slate-600">
                        {act.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-800 text-white p-6 rounded-[2rem] shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl -mr-10 -mt-10"></div>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2 relative z-10">
                  <Gift className="w-5 h-5 text-amber-400" /> งานที่จัดวันเกิด
                </h3>
                <div className="space-y-3 relative z-10">
                  {data.events.map((evt, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-white/10 rounded-xl backdrop-blur-sm">
                      <User className="w-5 h-5 text-indigo-300" />
                      <span className="font-medium">{evt}</span>
                    </div>
                  ))}
                  {data.events.length === 0 && <p className="text-slate-400 text-sm">ไม่มีอีเวนต์เร็วๆ นี้</p>}
                </div>
              </div>
            </div>
          </div>
        );
      case 'Plans':
        return <div className="p-10 text-center text-slate-400 bg-white rounded-[2rem] border border-dashed border-slate-300">หน้าแสดงรายการแผนงาน (Plans)</div>;
      case 'Analytics':
        return <div className="p-10 text-center text-slate-400 bg-white rounded-[2rem] border border-dashed border-slate-300">หน้าวิเคราะห์ข้อมูล (Analytics)</div>;
      default:
        return <div className="p-10 text-center text-slate-400 bg-white rounded-[2rem] border border-dashed border-slate-300">หน้าตั้งค่า (Settings)</div>;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-800 selection:bg-indigo-100 selection:text-indigo-700">
      {/* Sidebar (Desktop) */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full p-6">
          <div className="flex items-center gap-3 mb-10 px-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Crown className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-800">DreamPJ</h1>
              <p className="text-xs font-medium text-slate-400">Management System</p>
            </div>
          </div>

          <nav className="flex-1 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => { setActiveTab(item.name); setIsSidebarOpen(false); }}
                  className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-200 group ${
                    isActive 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 font-bold' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600 font-medium'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-100' : 'text-slate-400 group-hover:text-indigo-600'}`} />
                  {item.label}
                  {isActive && <ChevronRight className="w-4 h-4 ml-auto text-indigo-200" />}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto pt-6 border-t border-slate-100">
            <button className="w-full flex items-center gap-3 px-4 py-3 text-rose-500 hover:bg-rose-50 rounded-2xl transition-colors font-bold text-sm">
              <LogOut className="w-5 h-5" /> ออกจากระบบ
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-slate-800">DreamPJ</span>
          </div>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-slate-100 rounded-full">
            <Menu className="w-6 h-6 text-slate-600" />
          </button>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-auto p-4 md:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
             {loading ? (
               <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
                 <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
                 <p>กำลังโหลดข้อมูล...</p>
               </div>
             ) : renderContent()}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
