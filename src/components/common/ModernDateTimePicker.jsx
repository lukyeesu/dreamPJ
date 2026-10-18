import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Clock, ArrowUp, ChevronUp } from 'lucide-react';
import { formatDate } from '../../utils/formatters';

const ModernDateTimePicker = ({ 
  value, 
  onChange, 
  placeholder, 
  hasTime = true, 
  minDate, 
  className, 
  compact = false, 
  disabled = false, 
  pickerType = 'date' 
}) => {
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
      if (isOpen) setIsOpen(false);
    };

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
            );
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
                  setViewMode(viewMode === 'years' ? 'days' : 'years');
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

export default ModernDateTimePicker;
