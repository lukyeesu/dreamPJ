import React from 'react';
import { CalendarDays } from 'lucide-react';
import ModernDateTimePicker from './ModernDateTimePicker';
import StatusDropdown from './StatusDropdown';

export const DateFilterControl = ({ mode, setMode, date, setDate, range, setRange }) => {
  const handleModeChange = (selectedMode) => {
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
  };

  const modeOptions = [
    { value: 'all', label: mode === 'all' ? 'วันที่: ทั้งหมด' : 'ทั้งหมด' },
    { value: 'date', label: 'วันที่' },
    { value: 'week', label: 'รายสัปดาห์' },
    { value: 'month', label: 'เดือน' },
    { value: 'year', label: 'ปี' },
    { value: 'range', label: 'ช่วงเวลา' },
  ];

  return (
    <div className="flex bg-white border border-slate-200 rounded-xl sm:rounded-2xl overflow-hidden h-full shadow-xs hover:border-indigo-300 transition-colors w-full md:w-auto">
      <div className={`${mode === 'all' ? 'w-full' : 'w-[115px] sm:w-[130px] border-r border-slate-100'} bg-slate-50 shrink-0 h-full flex items-center`}>
        <StatusDropdown
          value={mode}
          onChange={handleModeChange}
          options={modeOptions}
          placeholder="เลือกรูปแบบวันที่..."
          size="sm"
          showDot={false}
          leftIcon={CalendarDays}
          className="border-0 bg-transparent rounded-none h-full py-0 shadow-none hover:border-0"
        />
      </div>

      {mode !== 'all' && (
        <div className="flex-1 min-w-[140px] relative bg-white h-full flex items-center">

        {mode === 'date' && (
          <ModernDateTimePicker
            value={date}
            onChange={(e) => setDate(e.target.value)}
            hasTime={false}
            placeholder="เลือกวันที่..."
            pickerType="date"
            className="border-0 bg-transparent rounded-none h-full py-0 shadow-none hover:border-0"
          />
        )}

        {mode === 'week' && (
          <ModernDateTimePicker
            value={date}
            onChange={(e) => setDate(e.target.value)}
            hasTime={false}
            placeholder="เลือกสัปดาห์..."
            pickerType="week"
            className="border-0 bg-transparent rounded-none h-full py-0 shadow-none hover:border-0"
          />
        )}

        {mode === 'month' && (
          <ModernDateTimePicker
            value={date}
            onChange={(e) => setDate(e.target.value)}
            hasTime={false}
            placeholder="เลือกเดือน..."
            pickerType="month"
            className="border-0 bg-transparent rounded-none h-full py-0 shadow-none hover:border-0"
          />
        )}

        {mode === 'year' && (
          <ModernDateTimePicker
            value={date}
            onChange={(e) => setDate(e.target.value)}
            hasTime={false}
            placeholder="เลือกปี..."
            pickerType="year"
            className="border-0 bg-transparent rounded-none h-full py-0 shadow-none hover:border-0"
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
                className="border-0 bg-transparent rounded-none h-full py-0 shadow-none hover:border-0"
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
                className="border-0 bg-transparent rounded-none h-full py-0 shadow-none hover:border-0"
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
