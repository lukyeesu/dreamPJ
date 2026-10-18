import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { systemStatusTypes } from './constants/appConstants';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  X,
  Truck,
  User,
  Briefcase,
  List,
  Phone,
  Table as TableIcon,
  CalendarDays,
  LayoutList
} from 'lucide-react';

const colorPresets = [
  { name: 'Slate', value: 'bg-slate-50 text-slate-500 border-slate-200', dot: 'bg-slate-400' },
  { name: 'Blue', value: 'bg-blue-50 text-blue-700 border-blue-100', dot: 'bg-blue-500' },
  { name: 'Indigo', value: 'bg-indigo-50 text-indigo-700 border-indigo-100', dot: 'bg-indigo-500' },
  { name: 'Violet', value: 'bg-violet-50 text-violet-700 border-violet-100', dot: 'bg-violet-500' },
  { name: 'Amber', value: 'bg-amber-50 text-amber-700 border-amber-100', dot: 'bg-amber-500' },
  { name: 'Emerald', value: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-500' },
  { name: 'Rose', value: 'bg-rose-50 text-rose-700 border-rose-100', dot: 'bg-rose-500' },
];

const CalendarView = ({ activities, onEventClick, onDayClick, dealStatuses = [], transportStatuses = [] }) => {
  const [viewDate, setViewDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month'); // 'month', 'week', 'day', 'list'
  const [selectedDayDetails, setSelectedDayDetails] = useState(null); // Data for modal
  const [isDayModalClosing, setIsDayModalClosing] = useState(false); // [ADDED] State for modal closing animation
  
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

     // [MODIFIED] Use dynamic color for event item in month/week view matches Settings
     const statusInfo = resolveStatus(ev.dealStatus, dealStatuses);
     
     // Use color from settings directly
     let itemColor = statusInfo.color || 'bg-slate-50 border-slate-200 text-slate-600';
     
     // Determine dot color based on the itemColor string (consistent with App's logic)
     let dotColor = 'bg-slate-400';
     
     // 1. Try to find exact match in presets
     const preset = colorPresets.find(p => p.value === itemColor);
     if (preset) {
         dotColor = preset.dot;
     } else {
         // 2. Heuristic match for system defaults or manual colors
         if (itemColor.includes('emerald') || itemColor.includes('green')) dotColor = 'bg-emerald-500';
         else if (itemColor.includes('blue') || itemColor.includes('indigo') || itemColor.includes('sky')) dotColor = 'bg-blue-500';
         else if (itemColor.includes('amber') || itemColor.includes('yellow') || itemColor.includes('orange')) dotColor = 'bg-amber-500';
         else if (itemColor.includes('rose') || itemColor.includes('red') || itemColor.includes('pink')) dotColor = 'bg-rose-500';
         else if (itemColor.includes('purple') || itemColor.includes('violet')) dotColor = 'bg-violet-500';
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
  const closeDayDetailsModal = () => {
      setIsDayModalClosing(true);
      setTimeout(() => {
          setSelectedDayDetails(null);
          setIsDayModalClosing(false);
      }, 300); // 300ms matches animation duration
  };

  const renderDayDetailsModal = () => {
      if (!selectedDayDetails) return null;
      const { date, events } = selectedDayDetails;

      return createPortal(
        <div className="fixed inset-0 z-[55] flex items-center justify-center p-4">
            <div 
                className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm ${isDayModalClosing ? 'backdrop-animate-out' : 'animate-in fade-in duration-300'}`} 
                onClick={closeDayDetailsModal} 
            />
            <div className={`bg-white w-full max-w-5xl rounded-[2rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh] ${isDayModalClosing ? 'modal-animate-out' : 'modal-animate-in'}`}>
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
                    <button onClick={closeDayDetailsModal} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition">
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
                                                // [ADDED] Resolve Transport Status
                                                const transportInfo = resolveStatus(item.transportStatus, transportStatuses);
                                                
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
                                                            {/* [MODIFIED] Show both Deal and Transport Status */}
                                                            <div className="flex flex-col gap-1.5 items-start">
                                                                <span className={`text-[10px] font-bold px-2 py-1 rounded-md border inline-flex items-center gap-1 ${statusInfo.color}`}>
                                                                    <div className={`w-1.5 h-1.5 rounded-full ${statusInfo.type === 'confirmed' || statusInfo.type === 'completed' ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                                                                    {statusInfo.label}
                                                                </span>
                                                                <span className={`text-[10px] font-bold px-2 py-1 rounded-md border inline-flex items-center gap-1 ${transportInfo.color}`}>
                                                                    <Truck className="w-3 h-3" />
                                                                    {transportInfo.label}
                                                                </span>
                                                            </div>
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
                                    // [ADDED] Resolve Transport Status
                                    const transportInfo = resolveStatus(item.transportStatus, transportStatuses);

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
                                                {/* [MODIFIED] Show both statuses stacked on mobile */}
                                                <div className="flex flex-col gap-1 items-end">
                                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md border inline-flex items-center gap-1 ${statusInfo.color}`}>
                                                        <div className={`w-1.5 h-1.5 rounded-full ${statusInfo.type === 'confirmed' || statusInfo.type === 'completed' ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
                                                        {statusInfo.label}
                                                    </span>
                                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md border inline-flex items-center gap-1 ${transportInfo.color}`}>
                                                        <Truck className="w-3 h-3" />
                                                        {transportInfo.label}
                                                    </span>
                                                </div>
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
                    <button onClick={closeDayDetailsModal} className="px-6 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition">
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

export default CalendarView;
