import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

const OverviewView = ({
  userProfile,
  stats = [],
  sortedActivitiesForOverview = [],
  onSeeAllPlans,
  renderTable
}) => {
  return (
    <div className="space-y-8 px-4 sm:px-8 lg:px-10 pt-6 pb-24 md:pb-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            สวัสดี, {userProfile?.name?.split(' ')[0] || 'User'}
          </h2>
          <p className="text-slate-500 mt-2 text-base font-medium">
            สรุปสถานะงานประจำวันที่ {new Date().toLocaleDateString('th-TH')}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-white p-8 rounded-[2rem] shadow-[0_2px_20px_rgb(0,0,0,0.04)] border border-slate-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300"
          >
            <div className="flex justify-between items-start mb-6">
              <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color}`}>
                <stat.icon className="w-7 h-7" />
              </div>
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${
                  stat.isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'
                }`}
              >
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
            onClick={onSeeAllPlans}
            className="text-indigo-600 font-bold hover:text-indigo-700 text-sm transition bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl"
          >
            ดูประวัติทั้งหมด
          </button>
        </div>
        {renderTable && renderTable(5, sortedActivitiesForOverview)}
      </div>
    </div>
  );
};

export default OverviewView;
