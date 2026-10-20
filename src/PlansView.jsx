import React from 'react';
import { Plus } from 'lucide-react';

const PlansView = ({
  stats = [],
  renderFilterCard,
  renderTable,
  filteredAndSortedActivities = [],
  onOpenModal
}) => {
  return (
    <div className="space-y-6 sm:space-y-8 flex flex-col min-h-full pb-24 md:pb-6">
      {/* 4 Summary KPI Cards (นำมาจากหน้าภาพรวมแผนงาน พร้อมรองรับการคลิกเพื่อกรองสถานะ) */}
      {stats.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 px-4 sm:px-8 lg:px-10 pt-4">
          {stats.map((stat, index) => (
            <div
              key={index}
              onClick={stat.onClick}
              className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-[0_2px_12px_rgb(0,0,0,0.03)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between group cursor-pointer active:scale-95"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500">{stat.title}</span>
                <div className={`p-1.5 sm:p-2 rounded-xl group-hover:scale-110 transition-transform ${stat.bg} ${stat.color}`}>
                  <stat.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
              <p className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight tabular-nums">
                {stat.value}
              </p>
              <div className="mt-1.5 pt-1.5 border-t border-slate-50 text-[11px] text-slate-400 font-medium flex items-center justify-between">
                <span>{stat.change}</span>
                {stat.onClick && (
                  <span className="text-indigo-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity text-[10px] hidden sm:inline">
                    กรองข้อมูล →
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sticky Filter Toolbar */}
      {renderFilterCard && renderFilterCard()}

      {/* Main Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden p-2 mx-4 sm:mx-8 lg:mx-10 mb-10">
        <div className="px-6 py-5 sm:px-8 sm:py-6 flex items-center justify-between border-b border-slate-50">
          <h3 className="text-lg sm:text-xl font-bold text-slate-900">แผนงานทั้งหมด</h3>
          <div className="flex gap-2">
            <button
              onClick={onOpenModal} 
              className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition cursor-pointer"
              title="เพิ่มแผนงานใหม่"
            >
              <Plus className="w-5 h-5"/>
            </button>
          </div>
        </div>
        {renderTable && renderTable(0, filteredAndSortedActivities)}
      </div>
    </div>
  );
};

export default PlansView;
