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
  Banknote,
  MapPin,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  ArrowUpRight,
  Truck
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
    <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8 py-2 w-full">
      <div className="relative w-44 h-44 sm:w-48 sm:h-48 flex items-center justify-center shrink-0">
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
          <span className="text-3xl sm:text-4xl font-black text-slate-800 leading-none">{total}</span>
          <span className="text-xs sm:text-sm font-bold text-slate-400 mt-1">งาน</span>
        </div>
      </div>
      <div className="space-y-2.5 w-full sm:flex-1 sm:max-h-[260px] sm:overflow-y-auto sm:custom-scrollbar pr-0 sm:pr-1">
        {sortedData.map((item, i) => (
          <div key={i} className="flex items-center justify-between group hover:bg-slate-50 p-2 rounded-xl transition-colors border border-transparent hover:border-slate-100">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-3 h-3 rounded-full shrink-0 transition-transform group-hover:scale-125 shadow-sm" style={{ backgroundColor: colors[i % colors.length] }}></div>
              <span className="text-xs sm:text-sm font-bold text-slate-600 truncate">{item.name}</span>
            </div>
            <span className="text-xs font-black text-slate-800 bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded-lg shadow-2xs shrink-0">{item.count} งาน</span>
          </div>
        ))}
        {sortedData.length === 0 && (
          <div className="text-center text-slate-400 text-xs py-4 italic">ไม่มีข้อมูลงาน</div>
        )}
      </div>
    </div>
  );
};

const Analytics = ({
  renderFilterCard,
  analyticsData = {},
  isLoading = false,
  dateFilterMode,
  resetFilters,
  setFilterStatus,
  setFilterTransport,
  openModal,
  renderTable,
  filteredAndSortedActivities = [],
  isActive = true,
  onOpenVenueModal,
  onSelectProject
}) => {
  const expenseRef = useRef(null);
  const categoryRef = useRef(null);
  const artistRef = useRef(null);
  const fanRef = useRef(null);
  const customerRef = useRef(null);
  const venueRef = useRef(null);

  const [copiedBanknote, setCopiedBanknote] = useState(false);

  const [animState, setAnimState] = useState({
    expense: false,
    category: false,
    artist: false,
    fan: false,
    customer: false,
    venue: false
  });

  useEffect(() => {
    let observer = null;
    let initTimer = null;

    if (isActive && !isLoading) {
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

        const refs = [expenseRef, categoryRef, artistRef, fanRef, customerRef, venueRef];
        refs.forEach(ref => {
          if (ref.current) observer.observe(ref.current);
        });
      }, 150);
    } else {
      setAnimState({ expense: false, category: false, artist: false, fan: false, customer: false, venue: false });
    }

    return () => {
      if (initTimer) clearTimeout(initTimer);
      if (observer) observer.disconnect();
    };
  }, [isActive, isLoading]);

  const {
    currentRevenue = 0,
    currentSupport = 0,
    currentCost = 0,
    currentProfit = 0,
    avgOrderValue = 0,
    avgSupportValue = 0,
    netMarginPercent = '0.0',
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
    categoryData = [],
    banknoteBreakdown = {},
    topVenues = [],
    maxVenueCount = 1,
    lowMarginProjects = []
  } = analyticsData;

  const totalBanknotesCount = Object.values(banknoteBreakdown).reduce((sum, item) => sum + (item?.count || 0), 0);
  const totalBanknotesAmount = Object.values(banknoteBreakdown).reduce((sum, item) => sum + (item?.amount || 0), 0);

  const handleCopyBanknotes = () => {
    const lines = [
      '📋 รายการเตรียมเบิกธนบัตรเงินซัพพอร์ตศิลปิน (Flower2U)',
      `💵 ธนบัตร 1,000 บาท: ${(banknoteBreakdown[1000]?.count || 0).toLocaleString()} ใบ (฿${(banknoteBreakdown[1000]?.amount || 0).toLocaleString()})`,
      `💵 ธนบัตร 500 บาท: ${(banknoteBreakdown[500]?.count || 0).toLocaleString()} ใบ (฿${(banknoteBreakdown[500]?.amount || 0).toLocaleString()})`,
      `💵 ธนบัตร 100 บาท: ${(banknoteBreakdown[100]?.count || 0).toLocaleString()} ใบ (฿${(banknoteBreakdown[100]?.amount || 0).toLocaleString()})`,
      `💵 ธนบัตร 50 บาท: ${(banknoteBreakdown[50]?.count || 0).toLocaleString()} ใบ (฿${(banknoteBreakdown[50]?.amount || 0).toLocaleString()})`,
      `💵 ธนบัตร 20 บาท: ${(banknoteBreakdown[20]?.count || 0).toLocaleString()} ใบ (฿${(banknoteBreakdown[20]?.amount || 0).toLocaleString()})`,
      '------------------------------',
      `💰 รวมเงินซัพพอร์ตทั้งหมด: ฿${totalBanknotesAmount.toLocaleString()} (จำนวน ${totalBanknotesCount.toLocaleString()} ฉบับ)`
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedBanknote(true);
    setTimeout(() => setCopiedBanknote(false), 2000);
  };

  return (
    <div className="flex flex-col min-h-full pb-24 md:pb-6 gap-6 pt-4">
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
          {isLoading ? (
            <div className="space-y-2 py-1">
              <div className="h-9 w-32 bg-slate-200 animate-pulse rounded-xl" />
              <div className="h-4 w-28 bg-slate-200/70 animate-pulse rounded-md" />
            </div>
          ) : (
            <>
              <p className="text-3xl font-black text-slate-800">฿{currentSupport.toLocaleString()}</p>
              <p className="text-sm text-slate-600 mt-1 font-medium">ส่งต่อศิลปิน ไม่หักกำไร</p>
            </>
          )}
        </div>

        {/* 2. รายได้ (ค่าจ้าง) */}
        <div className="bg-emerald-50 p-6 rounded-[2rem] border border-emerald-100 shadow-sm relative overflow-hidden group hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-100 rounded-xl text-emerald-600 group-hover:scale-110 transition-transform">
              <DollarSign className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-emerald-700">รายได้ (ค่าจ้าง)</h3>
          </div>
          {isLoading ? (
            <div className="space-y-2 py-1">
              <div className="h-9 w-36 bg-emerald-200/60 animate-pulse rounded-xl" />
              <div className="h-4 w-40 bg-emerald-200/50 animate-pulse rounded-md" />
            </div>
          ) : (
            <>
              <p className="text-3xl font-black text-emerald-800">฿{currentRevenue.toLocaleString()}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100/90 px-2.5 py-0.5 rounded-lg">
                  AOV: ฿{avgOrderValue.toLocaleString()} / งาน
                </span>
                <span className="text-xs text-emerald-600 font-medium">จาก {totalProjects} งาน</span>
              </div>
              <p className="text-xs text-emerald-700 font-bold mt-1.5 italic leading-none">
                {dateFilterMode !== 'all' ? '* คำนวณจากวันที่รับชำระเงินในรอบที่เลือก' : '* คำนวณจากวันที่รับชำระเงิน'}
              </p>
            </>
          )}
        </div>

        {/* 3. ค่าใช้จ่าย (รวมรายจ่าย) */}
        <div className="bg-rose-50 p-6 rounded-[2rem] border border-rose-100 shadow-sm relative overflow-hidden group hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-rose-100 rounded-xl text-rose-600 group-hover:scale-110 transition-transform">
              <TrendingDown className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-rose-700">ค่าใช้จ่าย (รวมรายจ่าย)</h3>
          </div>
          {isLoading ? (
            <div className="space-y-2 py-1">
              <div className="h-9 w-32 bg-rose-200/60 animate-pulse rounded-xl" />
              <div className="h-4 w-24 bg-rose-200/50 animate-pulse rounded-md" />
            </div>
          ) : (
            <>
              <p className="text-3xl font-black text-rose-800">฿{currentCost.toLocaleString()}</p>
              <p className="text-sm text-rose-600 mt-1 font-medium">
                Cost: {currentRevenue > 0 ? ((currentCost / currentRevenue) * 100).toFixed(1) : 0}%
              </p>
            </>
          )}
        </div>

        {/* 4. กำไรสุทธิ */}
        <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100 shadow-sm relative overflow-hidden group hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600 group-hover:scale-110 transition-transform">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-indigo-700">กำไรสุทธิ</h3>
          </div>
          {isLoading ? (
            <div className="space-y-2 py-1">
              <div className="h-9 w-36 bg-indigo-200/60 animate-pulse rounded-xl" />
              <div className="h-4 w-28 bg-indigo-200/50 animate-pulse rounded-md" />
            </div>
          ) : (
            <>
              <p className="text-3xl font-black text-indigo-800">฿{currentProfit.toLocaleString()}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className={`text-xs font-black px-2.5 py-0.5 rounded-lg ${
                  Number(netMarginPercent) >= 50
                    ? 'bg-indigo-200/80 text-indigo-800'
                    : Number(netMarginPercent) >= 30
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-700'
                }`}>
                  Net Margin: {netMarginPercent}%
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 6 Quick Status Filter Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 px-4 sm:px-8 lg:px-10">
        <div 
          onClick={resetFilters}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center hover:border-indigo-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer active:scale-95"
        >
          <div className="mb-2 p-2 bg-slate-50 text-slate-500 rounded-full"><Folder className="w-5 h-5" /></div>
          {isLoading ? (
            <div className="h-8 w-12 bg-slate-200 animate-pulse rounded-lg mx-auto" />
          ) : (
            <div className="text-2xl font-black text-slate-800">{totalProjects}</div>
          )}
          <div className="text-xs font-bold text-slate-500 mt-1">งานทั้งหมด</div>
        </div>

        <div 
          onClick={() => { setFilterStatus('confirmed'); setFilterTransport('delivered'); }}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center hover:border-emerald-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer active:scale-95"
        >
          <div className="mb-2 p-2 bg-emerald-50 text-emerald-500 rounded-full"><CheckCircle className="w-5 h-5" /></div>
          {isLoading ? (
            <div className="h-8 w-12 bg-emerald-200/60 animate-pulse rounded-lg mx-auto" />
          ) : (
            <div className="text-2xl font-black text-emerald-600">{completedProjects}</div>
          )}
          <div className="text-xs font-bold text-emerald-500 mt-1">งานเสร็จสิ้น</div>
        </div>

        <div 
          onClick={() => { setFilterStatus('confirmed'); setFilterTransport('active_only'); }}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center hover:border-blue-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer active:scale-95"
        >
          <div className="mb-2 p-2 bg-blue-50 text-blue-500 rounded-full"><Activity className="w-5 h-5" /></div>
          {isLoading ? (
            <div className="h-8 w-12 bg-blue-200/60 animate-pulse rounded-lg mx-auto" />
          ) : (
            <div className="text-2xl font-black text-blue-600">{activeProjects}</div>
          )}
          <div className="text-xs font-bold text-blue-500 mt-1">กำลังดำเนินการ</div>
        </div>

        <div 
          onClick={() => { setFilterStatus('pending'); setFilterTransport('all'); }}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center hover:border-amber-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer active:scale-95"
        >
          <div className="mb-2 p-2 bg-amber-50 text-amber-500 rounded-full"><Clock className="w-5 h-5" /></div>
          {isLoading ? (
            <div className="h-8 w-12 bg-amber-200/60 animate-pulse rounded-lg mx-auto" />
          ) : (
            <div className="text-2xl font-black text-amber-600">{pendingProjects}</div>
          )}
          <div className="text-xs font-bold text-amber-500 mt-1">รอดำเนินการ</div>
        </div>

        <div 
          onClick={() => { setFilterStatus('cancelled'); setFilterTransport('all'); }}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center hover:border-rose-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer active:scale-95"
        >
          <div className="mb-2 p-2 bg-rose-50 text-rose-500 rounded-full"><AlertTriangle className="w-5 h-5" /></div>
          {isLoading ? (
            <div className="h-8 w-12 bg-rose-200/60 animate-pulse rounded-lg mx-auto" />
          ) : (
            <div className="text-2xl font-black text-rose-600">{issueProjects}</div>
          )}
          <div className="text-xs font-bold text-rose-500 mt-1">ยกเลิก/มีปัญหา</div>
        </div>

        <div 
          onClick={() => { setFilterStatus('declined'); setFilterTransport('all'); }}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center hover:border-gray-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer active:scale-95"
        >
          <div className="mb-2 p-2 bg-gray-50 text-gray-400 rounded-full"><ThumbsDown className="w-5 h-5" /></div>
          {isLoading ? (
            <div className="h-8 w-12 bg-slate-200 animate-pulse rounded-lg mx-auto" />
          ) : (
            <div className="text-2xl font-black text-gray-500">{declinedProjects}</div>
          )}
          <div className="text-xs font-bold text-gray-400 mt-1">ลูกค้าไม่อนุมัติ</div>
        </div>
      </div>

      {/* Expense Breakdown (Standalone Full-Width Card) */}
      <div className="px-4 sm:px-8 lg:px-10">
        <div ref={expenseRef} data-anim-key="expense" className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between mb-6 flex-shrink-0">
            <h3 className="text-xl font-bold text-slate-900">สัดส่วนค่าใช้จ่ายสูงสุด</h3>
          </div>
          <div className="space-y-5 overflow-y-auto custom-scrollbar pr-2 flex-1">
            {isLoading ? (
              <div className="space-y-5 animate-pulse">
                {[75, 50, 85, 35, 60].map((w, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="h-4 bg-slate-200 rounded-md" style={{ width: `${80 + (idx * 25) % 60}px` }} />
                      <div className="h-4 bg-slate-200 rounded-md w-16" />
                    </div>
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-200/80 rounded-full" style={{ width: `${w}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : allExpensesList.length > 0 ? (
              allExpensesList.map((item, i) => (
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
              ))
            ) : (
              <div className="text-center text-slate-400 py-10">ไม่มีข้อมูลรายจ่าย</div>
            )}
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
              {isLoading ? (
                <div className="space-y-4 animate-pulse">
                  {[85, 65, 45, 30].map((w, idx) => (
                    <div key={idx} className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="h-4 bg-slate-200 rounded-md" style={{ width: `${90 + (idx * 20) % 50}px` }} />
                          <div className="h-4 bg-slate-200 rounded-md w-20" />
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-slate-200/80 rounded-full" style={{ width: `${w}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : topPerformers.length > 0 ? (
                topPerformers.map((item, i) => (
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
                ))
              ) : (
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
              {isLoading ? (
                <div className="space-y-4 animate-pulse">
                  {[80, 60, 40, 25].map((w, idx) => (
                    <div key={idx} className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="h-4 bg-slate-200 rounded-md" style={{ width: `${85 + (idx * 25) % 55}px` }} />
                          <div className="h-4 bg-slate-200 rounded-md w-20" />
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-slate-200/80 rounded-full" style={{ width: `${w}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : topCustomers.length > 0 ? (
                topCustomers.map((item, i) => (
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
                ))
              ) : (
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
              {isLoading ? (
                <div className="space-y-4 animate-pulse">
                  {[75, 55, 35, 20].map((w, idx) => (
                    <div key={idx} className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="h-4 bg-slate-200 rounded-md" style={{ width: `${90 + (idx * 20) % 50}px` }} />
                          <div className="h-4 bg-slate-200 rounded-md w-16" />
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-slate-200/80 rounded-full" style={{ width: `${w}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : topCustomerByProjects.length > 0 ? (
                topCustomerByProjects.map((item, i) => (
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
                ))
              ) : (
                <div className="text-center text-slate-400 py-10">ไม่มีข้อมูลการจ้างงาน</div>
              )}
            </div>
          </div>

          {/* Project Categories Breakdown */}
          <div ref={categoryRef} data-anim-key="category" className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col sm:max-h-[400px] lg:max-h-[420px]">
            <div className="flex items-center justify-between mb-4 sm:mb-6 flex-shrink-0">
              <h3 className="text-xl font-bold text-slate-900">สัดส่วนหมวดหมู่งาน</h3>
            </div>
            <div className="flex-1 w-full flex items-center justify-center min-h-0 sm:overflow-y-auto sm:custom-scrollbar">
              {isLoading ? (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8 py-2 w-full animate-pulse">
                  <div className="w-44 h-44 sm:w-48 sm:h-48 rounded-full border-[14px] border-slate-100 flex items-center justify-center shrink-0">
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="w-12 h-7 bg-slate-200 rounded-lg" />
                      <div className="w-8 h-3.5 bg-slate-100 rounded-md" />
                    </div>
                  </div>
                  <div className="space-y-3 w-full sm:flex-1 pr-1">
                    {[1, 2, 3, 4].map(idx => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-50/60">
                        <div className="flex items-center gap-2.5">
                          <div className="w-3 h-3 rounded-full bg-slate-200 shrink-0" />
                          <div className="h-4 bg-slate-200 rounded-md" style={{ width: `${70 + idx * 20}px` }} />
                        </div>
                        <div className="h-4 bg-slate-200 rounded-md w-12" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <DonutChart data={categoryData} isAnimated={animState.category} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Venue Intelligence & Banknote Float Calculator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 px-4 sm:px-8 lg:px-10">
        {/* 1. เครื่องคำนวณเบิกธนบัตรเงินซัพพอร์ต */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">แจกแจงธนบัตรเงินซัพพอร์ต</h3>
                  <p className="text-xs text-slate-400 font-medium">คำนวณจำนวนธนบัตรแต่ละชนิดเพื่อเบิกธนาคาร</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyBanknotes}
                className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-xl text-xs font-bold transition active:scale-95 flex items-center gap-1.5"
                title="คัดลอกรายการเบิกธนาคาร"
              >
                {copiedBanknote ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600">คัดลอกแล้ว!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>คัดลอกยอดเบิก</span>
                  </>
                )}
              </button>
            </div>

            {/* Banknote List */}
            <div className="space-y-2.5 mt-4">
              {isLoading ? (
                <div className="space-y-2.5 animate-pulse">
                  {[1, 2, 3, 4, 5].map(idx => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-6 bg-slate-200 rounded-xl" />
                        <div className="w-16 h-4 bg-slate-200 rounded-md" />
                      </div>
                      <div className="w-20 h-4 bg-slate-200 rounded-md" />
                    </div>
                  ))}
                </div>
              ) : (
                [
                  { denom: 1000, label: '฿1,000', color: 'bg-amber-500/10 text-amber-900 border-amber-200/80', badge: 'bg-amber-600 text-white' },
                  { denom: 500, label: '฿500', color: 'bg-purple-500/10 text-purple-900 border-purple-200/80', badge: 'bg-purple-600 text-white' },
                  { denom: 100, label: '฿100', color: 'bg-red-500/10 text-red-900 border-red-200/80', badge: 'bg-red-600 text-white' },
                  { denom: 50, label: '฿50', color: 'bg-blue-500/10 text-blue-900 border-blue-200/80', badge: 'bg-blue-600 text-white' },
                  { denom: 20, label: '฿20', color: 'bg-emerald-500/10 text-emerald-900 border-emerald-200/80', badge: 'bg-emerald-600 text-white' },
                ].map(({ denom, label, color, badge }) => {
                  const item = banknoteBreakdown[denom] || { count: 0, amount: 0 };
                  return (
                    <div 
                      key={denom} 
                      className={`flex items-center justify-between p-3 rounded-2xl border ${color} transition-all duration-200 hover:scale-[1.01]`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 rounded-xl text-xs font-black shadow-sm ${badge}`}>
                          {label}
                        </span>
                        <span className="text-xs font-bold text-slate-700">
                          {item.count.toLocaleString()} <span className="font-medium text-slate-400">ใบ</span>
                        </span>
                      </div>
                      <span className="text-sm font-black text-slate-800">
                        ฿{item.amount.toLocaleString()}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
            {isLoading ? (
              <>
                <div className="h-4 w-36 bg-slate-200 animate-pulse rounded-md" />
                <div className="h-5 w-24 bg-slate-200 animate-pulse rounded-md" />
              </>
            ) : (
              <>
                <span className="text-xs font-bold text-slate-500">
                  รวมธนบัตรทั้งหมด <span className="text-slate-800 font-black">{totalBanknotesCount.toLocaleString()}</span> ฉบับ
                </span>
                <span className="text-base font-black text-emerald-600">
                  ฿{totalBanknotesAmount.toLocaleString()}
                </span>
              </>
            )}
          </div>
        </div>

        {/* 2. อันดับทำเล & สถานที่จัดส่งยอดนิยม */}
        <div ref={venueRef} data-anim-key="venue" className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col h-full min-h-[400px]">
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">ทำเล & สถานที่จัดส่งยอดนิยม</h3>
                <p className="text-xs text-slate-400 font-medium">สถานที่จัดงานที่ไปส่งบ่อยที่สุด (Top Delivery Locations)</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 overflow-y-auto custom-scrollbar pr-2 flex-1 mt-2">
            {isLoading ? (
              <div className="space-y-4 animate-pulse">
                {[80, 60, 45, 30].map((w, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-slate-200 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="h-3.5 bg-slate-200 rounded-md" style={{ width: `${100 + (idx * 25) % 60}px` }} />
                        <div className="h-3.5 bg-slate-200 rounded-md w-14" />
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-slate-200/80 rounded-full" style={{ width: `${w}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : topVenues.length > 0 ? (
              topVenues.map((v, i) => (
                <div key={i} className="flex items-center gap-3 group">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                    i === 0 ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-200' :
                    i === 1 ? 'bg-slate-100 text-slate-700 ring-2 ring-slate-200' :
                    i === 2 ? 'bg-orange-100 text-orange-800 ring-2 ring-orange-200' :
                    'bg-slate-50 text-slate-500'
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center text-xs font-bold mb-1">
                      <span className="text-slate-700 truncate pr-2 group-hover:text-indigo-600 transition">
                        {v.name}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-indigo-600 font-black">{v.count} งาน</span>
                        {onOpenVenueModal && (
                          <button
                            type="button"
                            onClick={() => onOpenVenueModal(v.name)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 rounded-md transition"
                            title="ดูลายแทง Loading Dock"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-indigo-500 to-sky-500 rounded-full transition-all duration-1000 ease-out" 
                        style={{ width: animState.venue ? `${(v.count / maxVenueCount) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-slate-400 py-10 text-xs italic">ไม่มีข้อมูลสถานที่จัดส่ง</div>
            )}
          </div>
        </div>
      </div>

      {/* Low Margin Anomaly Radar */}
      {lowMarginProjects && lowMarginProjects.length > 0 && (
        <div className="px-4 sm:px-8 lg:px-10">
          <div className="bg-gradient-to-r from-rose-50/90 via-amber-50/60 to-rose-50/90 p-6 sm:p-7 rounded-[2.5rem] border border-rose-200/70 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-rose-100 text-rose-600 rounded-2xl shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-black text-rose-900 tracking-tight">
                  ระบบตรวจจับงานเสี่ยงต้นทุนสูง (Low Margin Radar)
                </h4>
                <p className="text-xs text-rose-700 font-medium">
                  พบ {lowMarginProjects.length} งาน ที่มีกำไรต่ำกว่า 40% (ต้นทุนวัตถุดิบ/ค่าเดินทางเกิน 60%) ควรตรวจสอบความคุ้มค่า
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
              {lowMarginProjects.map((p, idx) => (
                <div
                  key={p.id || idx}
                  onClick={() => onSelectProject && onSelectProject(p)}
                  className="bg-white p-4 rounded-2xl border border-rose-100 shadow-sm hover:border-rose-300 hover:shadow-md transition cursor-pointer group"
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-indigo-600 transition">
                      {p.name}
                    </span>
                    <span className="text-xs font-black text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full shrink-0">
                      {p.marginPct.toFixed(0)}% margin
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 truncate font-medium">
                    ศิลปิน: {p.artist || '-'}
                  </div>
                  <div className="flex justify-between text-xs font-bold mt-2.5 pt-2 border-t border-slate-50">
                    <span className="text-slate-500">ค่าจ้าง ฿{p.revenue.toLocaleString()}</span>
                    <span className="text-rose-600">ต้นทุน ฿{p.cost.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(Analytics);
