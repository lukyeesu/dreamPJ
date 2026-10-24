import React, { useState, useEffect, useRef } from 'react';
import {
  DollarSign,
  Gift,
  TrendingDown,
  TrendingUp,
  Folder,
  CheckCircle,
  Activity,
  Clock,
  AlertTriangle,
  ThumbsDown,
  Trophy,
  Crown,
  Plus
} from 'lucide-react';

const DonutChart = ({ data = [], isAnimated }) => {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  let cumulativePercent = 0;
  
  const isLoaded = isAnimated;

  const colors = [
    '#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#3b82f6', '#ec4899', '#64748b'
  ];

  const sortedData = [...data].sort((a, b) => b.count - a.count);

  return (
    <div className="flex flex-col items-center gap-6 py-2 w-full">
      <div className="relative w-56 h-56 flex items-center justify-center shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full absolute inset-0 -rotate-90">
          <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#f1f5f9" strokeWidth="10" />
          {sortedData.map((item, i) => {
            const percent = total > 0 ? item.count / total : 0;
            const strokeLength = circumference * percent;
            const strokeDasharray = `${strokeLength} ${circumference}`;
            const strokeDashoffset = -1 * circumference * cumulativePercent;
            cumulativePercent += percent;

            return (
              <circle
                key={i}
                cx="50"
                cy="50"
                r={radius}
                fill="transparent"
                stroke={colors[i % colors.length]}
                strokeWidth="10"
                strokeDasharray={isLoaded ? strokeDasharray : `0 ${circumference}`}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="butt"
                className="transition-all duration-1000 ease-out"
                style={{ transitionDelay: `${i * 50}ms` }}
              />
            );
          })}
        </svg>
        <div className={`flex flex-col items-center justify-center transition-all duration-700 delay-300 ${isLoaded ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
          <span className="text-4xl font-black text-slate-800 leading-none">{total}</span>
          <span className="text-sm font-bold text-slate-400 mt-1">งาน</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 w-full px-2">
        {sortedData.map((item, i) => (
          <div key={i} className="flex items-center justify-between group hover:bg-slate-50 p-1.5 rounded-lg transition-colors">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-3 h-3 rounded-full shrink-0 transition-transform group-hover:scale-125 shadow-sm" style={{ backgroundColor: colors[i % colors.length] }}></div>
              <span className="text-xs font-bold text-slate-600 truncate">{item.name}</span>
            </div>
            <span className="text-xs font-black text-slate-800 bg-white border border-slate-100 px-2 py-0.5 rounded-md shadow-sm">{item.count}</span>
          </div>
        ))}
        {sortedData.length === 0 && (
          <div className="col-span-2 text-center text-slate-400 text-xs py-2 italic">ไม่มีข้อมูลงาน</div>
        )}
      </div>
    </div>
  );
};

const AnalyticsView = ({
  renderFilterCard,
  analyticsData = {},
  dateFilterMode,
  resetFilters,
  setFilterStatus,
  setFilterTransport,
  openModal,
  renderTable,
  filteredAndSortedActivities = [],
  isActive = true
}) => {
  const expenseRef = useRef(null);
  const categoryRef = useRef(null);
  const artistRef = useRef(null);
  const fanRef = useRef(null);
  const customerRef = useRef(null);

  const [animState, setAnimState] = useState({
    expense: false,
    category: false,
    artist: false,
    fan: false,
    customer: false
  });

  useEffect(() => {
    let observer = null;
    let initTimer = null;

    if (isActive) {
      initTimer = setTimeout(() => {
        observer = new IntersectionObserver(
          (entries) => {
            entries.forEach(entry => {
              if (entry.isIntersecting) {
                const key = entry.target.getAttribute('data-anim-key');
                if (key) {
                  setAnimState(prev => ({ ...prev, [key]: true }));
                  if (observer) observer.unobserve(entry.target);
                }
              }
            });
          },
          { threshold: 0.1 }
        );

        const refs = [expenseRef, categoryRef, artistRef, fanRef, customerRef];
        refs.forEach(ref => {
          if (ref.current) observer.observe(ref.current);
        });
      }, 150);
    } else {
      setAnimState({ expense: false, category: false, artist: false, fan: false, customer: false });
    }

    return () => {
      if (initTimer) clearTimeout(initTimer);
      if (observer) observer.disconnect();
    };
  }, [isActive]);

  const {
    currentRevenue = 0,
    currentSupport = 0,
    currentCost = 0,
    currentProfit = 0,
    totalProjects = 0,
    completedProjects = 0,
    activeProjects = 0,
    pendingProjects = 0,
    issueProjects = 0,
    declinedProjects = 0,
    allExpensesList = [],
    maxExpense = 1,
    topPerformers = [],
    maxPerformerRevenue = 1,
    topCustomers = [],
    maxCustomerRevenue = 1,
    topCustomerByProjects = [],
    maxCustomerProjectCount = 1,
    categoryData = []
  } = analyticsData;

  return (
    <div className="space-y-8 flex flex-col min-h-full pb-24 md:pb-6">
      {renderFilterCard && renderFilterCard()}
      
      {/* 4 Summary Cards (Standard Financial Equation: 1.เงินศิลปิน -> 2.รายได้ -> 3.ค่าใช้จ่าย -> 4.กำไรสุทธิ) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 px-4 sm:px-8 lg:px-10">
        {/* 1. เงินศิลปิน (ลูกค้าซัพพอร์ต) */}
        <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-slate-200 rounded-xl text-slate-600 group-hover:scale-110 transition-transform">
              <Gift className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-700">เงินศิลปิน (ยอดสนับสนุน)</h3>
          </div>
          <p className="text-3xl font-black text-slate-800">฿{currentSupport.toLocaleString()}</p>
          <p className="text-sm text-slate-600 mt-1 font-medium">ส่งต่อศิลปิน ไม่หักกำไร</p>
        </div>

        {/* 2. รายได้ (ค่าจ้าง) */}
        <div className="bg-emerald-50 p-6 rounded-[2rem] border border-emerald-100 shadow-sm relative overflow-hidden group hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-100 rounded-xl text-emerald-600 group-hover:scale-110 transition-transform">
              <DollarSign className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-emerald-700">รายได้ (ค่าจ้าง)</h3>
          </div>
          <p className="text-3xl font-black text-emerald-800">฿{currentRevenue.toLocaleString()}</p>
          <p className="text-[10px] text-emerald-500 font-bold mt-1 italic leading-none">
            {dateFilterMode !== 'all' ? '* คำนวณจากวันที่รับชำระเงินในรอบที่เลือก' : '* คำนวณจากวันที่รับชำระเงิน'}
          </p>
          <p className="text-sm text-emerald-600 mt-1 font-medium">จาก {totalProjects} งาน</p>
        </div>

        {/* 3. ค่าใช้จ่าย (รวมรายจ่าย) */}
        <div className="bg-rose-50 p-6 rounded-[2rem] border border-rose-100 shadow-sm relative overflow-hidden group hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-rose-100 rounded-xl text-rose-600 group-hover:scale-110 transition-transform">
              <TrendingDown className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-rose-700">ค่าใช้จ่าย (รวมรายจ่าย)</h3>
          </div>
          <p className="text-3xl font-black text-rose-800">฿{currentCost.toLocaleString()}</p>
          <p className="text-sm text-rose-600 mt-1 font-medium">
            Cost: {currentRevenue > 0 ? ((currentCost / currentRevenue) * 100).toFixed(1) : 0}%
          </p>
        </div>

        {/* 4. กำไรสุทธิ */}
        <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100 shadow-sm relative overflow-hidden group hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600 group-hover:scale-110 transition-transform">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-indigo-700">กำไรสุทธิ</h3>
          </div>
          <p className="text-3xl font-black text-indigo-800">฿{currentProfit.toLocaleString()}</p>
          <p className="text-sm text-indigo-600 mt-1 font-medium">
            Margin: {currentRevenue > 0 ? ((currentProfit / currentRevenue) * 100).toFixed(1) : 0}%
          </p>
        </div>
      </div>

      {/* 6 Quick Status Filter Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 px-4 sm:px-8 lg:px-10">
        <div 
          onClick={resetFilters}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center hover:border-indigo-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer active:scale-95"
        >
          <div className="mb-2 p-2 bg-slate-50 text-slate-500 rounded-full"><Folder className="w-5 h-5" /></div>
          <div className="text-2xl font-black text-slate-800">{totalProjects}</div>
          <div className="text-xs font-bold text-slate-500 mt-1">งานทั้งหมด</div>
        </div>

        <div 
          onClick={() => { setFilterStatus('confirmed'); setFilterTransport('delivered'); }}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center hover:border-emerald-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer active:scale-95"
        >
          <div className="mb-2 p-2 bg-emerald-50 text-emerald-500 rounded-full"><CheckCircle className="w-5 h-5" /></div>
          <div className="text-2xl font-black text-emerald-600">{completedProjects}</div>
          <div className="text-xs font-bold text-emerald-500 mt-1">งานเสร็จสิ้น</div>
        </div>

        <div 
          onClick={() => { setFilterStatus('confirmed'); setFilterTransport('active_only'); }}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center hover:border-blue-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer active:scale-95"
        >
          <div className="mb-2 p-2 bg-blue-50 text-blue-500 rounded-full"><Activity className="w-5 h-5" /></div>
          <div className="text-2xl font-black text-blue-600">{activeProjects}</div>
          <div className="text-xs font-bold text-blue-500 mt-1">กำลังดำเนินการ</div>
        </div>

        <div 
          onClick={() => { setFilterStatus('pending'); setFilterTransport('all'); }}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center hover:border-amber-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer active:scale-95"
        >
          <div className="mb-2 p-2 bg-amber-50 text-amber-500 rounded-full"><Clock className="w-5 h-5" /></div>
          <div className="text-2xl font-black text-amber-600">{pendingProjects}</div>
          <div className="text-xs font-bold text-amber-500 mt-1">รอดำเนินการ</div>
        </div>

        <div 
          onClick={() => { setFilterStatus('cancelled'); setFilterTransport('all'); }}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center hover:border-rose-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer active:scale-95"
        >
          <div className="mb-2 p-2 bg-rose-50 text-rose-500 rounded-full"><AlertTriangle className="w-5 h-5" /></div>
          <div className="text-2xl font-black text-rose-600">{issueProjects}</div>
          <div className="text-xs font-bold text-rose-500 mt-1">ยกเลิก/มีปัญหา</div>
        </div>

        <div 
          onClick={() => { setFilterStatus('declined'); setFilterTransport('all'); }}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center hover:border-gray-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer active:scale-95"
        >
          <div className="mb-2 p-2 bg-gray-50 text-gray-400 rounded-full"><ThumbsDown className="w-5 h-5" /></div>
          <div className="text-2xl font-black text-gray-500">{declinedProjects}</div>
          <div className="text-xs font-bold text-gray-400 mt-1">ลูกค้าไม่อนุมัติ</div>
        </div>
      </div>

      {/* Expense & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-4 sm:px-8 lg:px-10">
        <div ref={expenseRef} data-anim-key="expense" className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col h-full min-h-[400px]">
          <div className="flex items-center justify-between mb-6 flex-shrink-0">
            <h3 className="text-xl font-bold text-slate-900">สัดส่วนค่าใช้จ่ายสูงสุด</h3>
          </div>
          <div className="space-y-5 overflow-y-auto custom-scrollbar pr-2 flex-1">
            {allExpensesList.length > 0 ? allExpensesList.map((item, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm font-bold mb-1.5">
                  <span className="text-slate-600">{item.category}</span>
                  <span className="text-slate-900">฿{item.amount.toLocaleString()}</span>
                </div>
                <div className="w-full h-3 bg-slate-50 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-500 rounded-full transition-all duration-1000 ease-out" 
                    style={{ width: animState.expense ? `${(item.amount / maxExpense) * 100}%` : '0%' }}
                  ></div>
                </div>
              </div>
            )) : (
              <div className="text-center text-slate-400 py-10">ไม่มีข้อมูลรายจ่าย</div>
            )}
          </div>
        </div>

        <div ref={categoryRef} data-anim-key="category" className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col h-full min-h-[400px]">
          <h3 className="text-xl font-bold text-slate-900 mb-6 flex-shrink-0 self-start w-full">สัดส่วนหมวดหมู่งาน</h3>
          <div className="flex-1 w-full flex items-center justify-center">
            <DonutChart data={categoryData} isAnimated={animState.category} />
          </div>
        </div>
      </div>

      {/* Top Performers */}
      <div className="px-4 sm:px-8 lg:px-10 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full">
          {/* Top Artists */}
          <div ref={artistRef} data-anim-key="artist" className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col max-h-[400px]">
            <div className="flex items-center justify-between mb-6 flex-shrink-0">
              <h3 className="text-xl font-bold text-slate-900">อันดับศิลปินทำเงินสูงสุด (Top Artists Performers)</h3>
            </div>
            <div className="space-y-5 overflow-y-auto custom-scrollbar pr-2 flex-1">
              {topPerformers.length > 0 ? topPerformers.map((item, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                    i === 0 ? 'bg-yellow-100 text-yellow-700 ring-2 ring-yellow-200' : 
                    i === 1 ? 'bg-slate-100 text-slate-700 ring-2 ring-slate-200' :
                    i === 2 ? 'bg-orange-100 text-orange-700 ring-2 ring-orange-200' :
                    'bg-slate-50 text-slate-500'
                  }`}>
                    {i < 3 ? <Trophy className="w-4 h-4" /> : i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm font-bold mb-1.5">
                      <span className="text-slate-700 truncate w-32 md:w-56">{item.name}</span>
                      <span className="text-emerald-600">฿{item.amount.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-50 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out" 
                        style={{ width: animState.artist ? `${(item.amount / maxPerformerRevenue) * 100}%` : '0%' }}
                      ></div>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-center text-slate-400 py-10">ไม่มีข้อมูลรายได้</div>
              )}
            </div>
          </div>

          {/* Top Customers (Revenue) */}
          <div ref={fanRef} data-anim-key="fan" className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col max-h-[400px]">
            <div className="flex items-center justify-between mb-6 flex-shrink-0">
              <h3 className="text-xl font-bold text-slate-900">อันดับลูกค้าทำเงินสูงสุด (Top Fan Performers)</h3>
            </div>
            <div className="space-y-5 overflow-y-auto custom-scrollbar pr-2 flex-1">
              {topCustomers.length > 0 ? topCustomers.map((item, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                    i === 0 ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-200' : 
                    i === 1 ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-200' :
                    i === 2 ? 'bg-sky-100 text-sky-700 ring-2 ring-sky-200' :
                    'bg-slate-50 text-slate-500'
                  }`}>
                    {i < 3 ? <Crown className="w-4 h-4" /> : i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm font-bold mb-1.5">
                      <span className="text-slate-700 truncate w-32 md:w-56">{item.name}</span>
                      <span className="text-indigo-600">฿{item.amount.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-50 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 rounded-full transition-all duration-1000 ease-out" 
                        style={{ width: animState.fan ? `${(item.amount / maxCustomerRevenue) * 100}%` : '0%' }}
                      ></div>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-center text-slate-400 py-10">ไม่มีข้อมูลรายได้จากลูกค้า</div>
              )}
            </div>
          </div>

          {/* Top Customers (Projects Count) */}
          <div ref={customerRef} data-anim-key="customer" className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col max-h-[400px]">
            <div className="flex items-center justify-between mb-6 flex-shrink-0">
              <h3 className="text-xl font-bold text-slate-900">อันดับลูกค้าจ้างงานสูงสุด (Top Customer Performers)</h3>
            </div>
            <div className="space-y-5 overflow-y-auto custom-scrollbar pr-2 flex-1">
              {topCustomerByProjects.length > 0 ? topCustomerByProjects.map((item, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                    i === 0 ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-200' : 
                    i === 1 ? 'bg-fuchsia-100 text-fuchsia-700 ring-2 ring-fuchsia-200' :
                    i === 2 ? 'bg-pink-100 text-pink-700 ring-2 ring-pink-200' :
                    'bg-slate-50 text-slate-500'
                  }`}>
                    {i < 3 ? <Crown className="w-4 h-4" /> : i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm font-bold mb-1.5">
                      <span className="text-slate-700 truncate w-32 md:w-56">{item.name}</span>
                      <span className="text-purple-600">{item.count} งาน</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-50 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-purple-500 rounded-full transition-all duration-1000 ease-out" 
                        style={{ width: animState.customer ? `${(item.count / maxCustomerProjectCount) * 100}%` : '0%' }}
                      ></div>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="text-center text-slate-400 py-10">ไม่มีข้อมูลการจ้างงาน</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filtered Table Section */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden p-2 mx-4 sm:mx-8 lg:mx-10 mb-10">
        <div className="px-8 py-6 flex items-center justify-between border-b border-slate-50">
          <h3 className="text-xl font-bold text-slate-900">ข้อมูลแผนงาน (Filtered Data)</h3>
          <div className="flex gap-2">
            <button
              onClick={() => openModal && openModal()} 
              className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition"
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

export default AnalyticsView;
