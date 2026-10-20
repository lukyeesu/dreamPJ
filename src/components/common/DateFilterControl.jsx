import React from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';
import ModernDateTimePicker from './ModernDateTimePicker';

export const DateFilterControl = ({ mode, setMode, date, setDate, range, setRange }) => {
  return (
    <div className="flex bg-white border border-slate-200 rounded-xl sm:rounded-2xl overflow-hidden h-full shadow-xs hover:border-indigo-300 transition-colors w-full md:w-auto">
      <div className={`relative ${mode === 'all' ? 'w-full' : 'w-[110px] sm:w-[125px] border-r border-slate-100'} bg-slate-50 shrink-0 h-full flex items-center`}>
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
          className="w-full h-full pl-9 pr-6 bg-transparent outline-none text-slate-700 text-xs font-bold appearance-none cursor-pointer flex items-center"
        >
          <option value="all">{mode === 'all' ? 'วันที่: ทั้งหมด' : 'ทั้งหมด'}</option>
          <option value="date">วันที่</option>
          <option value="week">รายสัปดาห์</option>
          <option value="month">เดือน</option>
          <option value="year">ปี</option>
          <option value="range">ช่วงเวลา</option>
        </select>
        <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      {mode !== 'all' && (
        <div className="flex-1 min-w-[140px] relative bg-white">

        {mode === 'date' && (
          <ModernDateTimePicker
            value={date}
            onChange={(e) => setDate(e.target.value)}
            hasTime={false}
            placeholder="เลือกวันที่..."
            pickerType="date"
          />
        )}

        {mode === 'week' && (
          <ModernDateTimePicker
            value={date}
            onChange={(e) => setDate(e.target.value)}
            hasTime={false}
            placeholder="เลือกสัปดาห์..."
            pickerType="week"
          />
        )}

        {mode === 'month' && (
          <ModernDateTimePicker
            value={date}
            onChange={(e) => setDate(e.target.value)}
            hasTime={false}
            placeholder="เลือกเดือน..."
            pickerType="month"
          />
        )}

        {mode === 'year' && (
          <ModernDateTimePicker
            value={date}
            onChange={(e) => setDate(e.target.value)}
            hasTime={false}
            placeholder="เลือกปี..."
            pickerType="year"
          />
        )}

        {mode === 'range' && (
          <div className="flex items-center h-full px-2 gap-1 w-full overflow-hidden">
            <div className="flex-1 min-w-0">
              <ModernDateTimePicker
                value={range?.start || ''}
                onChange={(e) => setRange({ ...range, start: e.target.value })}
                hasTime={false}
                placeholder="เริ่ม"
                compact={true}
                className="border-slate-200 h-9"
              />
            </div>
            <span className="text-slate-300 shrink-0">-</span>
            <div className="flex-1 min-w-0">
              <ModernDateTimePicker
                value={range?.end || ''}
                onChange={(e) => setRange({ ...range, end: e.target.value })}
                hasTime={false}
                placeholder="สิ้นสุด"
                compact={true}
                className="border-slate-200 h-9"
              />
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
};

export default DateFilterControl;
