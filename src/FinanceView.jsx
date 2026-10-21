import React, { useState, useMemo, useRef, useEffect, startTransition } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Gift,
  Clock,
  CheckCircle,
  AlertCircle,
  Printer,
  Download,
  Calendar,
  Filter,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  X,
  Wallet,
  Eye,
  FileText,
  RotateCcw,
  SlidersHorizontal,
  Table as TableIcon,
  BarChart2,
  ExternalLink,
  Plus,
  ArrowUpDown,
  LayoutList,
  User,
  Mic,
  Receipt,
  Maximize2
} from 'lucide-react';
import DateFilterControl from './components/common/DateFilterControl';
import { processImageUrl } from './utils/formatters';

// --- Helper Functions for Formatting ---
const formatCurrency = (amount) => {
  const num = parseFloat(amount) || 0;
  return num.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const formatItemDate = (dateVal) => {
  if (!dateVal) return '';
  if (typeof dateVal === 'string' && /^\d{2}\/\d{2}\/\d{4}/.test(dateVal)) {
    return dateVal.split(' ')[0];
  }
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear(); // CE format like in screenshot (2026)
  return `${day}/${month}/${year}`;
};

const formatDateTimeDisplay = (isoStr) => {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return String(isoStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const escapeHtml = (str) => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

export default function FinanceView({
  activities = [],
  dealStatuses = [],
  transportStatuses = [],
  shopInfo = {},
  onOpenProjectModal,
  themeColor = 'indigo',
  dateFilterMode: propDateFilterMode,
  setDateFilterMode: propSetDateFilterMode,
  filterDate: propFilterDate,
  setFilterDate: propSetFilterDate,
  filterDateRange: propFilterDateRange,
  setFilterDateRange: propSetFilterDateRange,
  isActive = true
}) {
  // --- View Mode State ---
  // 'sheet' = ตารางกำไรขาดทุนแบบสมุดบัญชีตามรูป (Accounting Sheet View)
  // 'dashboard' = แดชบอร์ดภาพรวมพร้อมการ์ดสถิติ (Interactive Dashboard View)
  // 'slips' = ตารางสลิปโอนเงิน (Slips Table View)
  const [viewMode, setViewMode] = useState('sheet');
  const [previewSlipImage, setPreviewSlipImage] = useState(null);
  const [slipsPerRow, setSlipsPerRow] = useState(3); // 3 (ชัดเจน อ่านง่าย) หรือ 4 (กะทัดรัด)
  const [slipsFilterMode, setSlipsFilterMode] = useState('all'); // 'all' (ทั้งหมด) หรือ 'has_slips' (เฉพาะที่มีสลิป)
  const [visibleCount, setVisibleCount] = useState(35); // Progressive rendering for smooth 60fps performance

  const handleViewModeChange = (mode) => {
    startTransition(() => {
      setViewMode(mode);
      setVisibleCount(35);
    });
  };

  const handleDetailModeChange = (mode) => {
    startTransition(() => {
      setTableDetailMode(mode);
    });
  };

  const handleMobileLayoutChange = (mode) => {
    startTransition(() => {
      setMobileSheetLayout(mode);
    });
  };

  const handleSlipsFilterModeChange = (mode) => {
    startTransition(() => {
      setSlipsFilterMode(mode);
      setVisibleCount(35);
    });
  };

  const handleSlipsPerRowChange = (cols) => {
    startTransition(() => {
      setSlipsPerRow(cols);
    });
  };

  const [isMobileScreen, setIsMobileScreen] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  useEffect(() => {
    const handleResize = () => setIsMobileScreen(window.innerWidth < 768);
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sticky Collision State for Filter Toolbar
  const [isFilterStuck, setIsFilterStuck] = useState(false);
  const filterSentinelRef = useRef(null);

  useEffect(() => {
    if (!isActive) return;

    let rafId = null;
    const checkSticky = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (!filterSentinelRef.current) return;
        if (filterSentinelRef.current.getClientRects().length === 0) return;

        const rect = filterSentinelRef.current.getBoundingClientRect();
        const isMobile = window.innerWidth < 768;
        const header = document.querySelector('header');
        const mainEl = document.querySelector('main');

        const targetTop = isMobile
          ? (header ? header.getBoundingClientRect().bottom : 56)
          : (mainEl ? mainEl.getBoundingClientRect().top : 0);

        const marginOffset = isMobile ? 8 : 12;
        const stuck = rect.top <= targetTop - marginOffset + 1;
        setIsFilterStuck(stuck);
      });
    };

    window.addEventListener('scroll', checkSticky, { passive: true });
    window.addEventListener('resize', checkSticky, { passive: true });
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.addEventListener('scroll', checkSticky, { passive: true });
    }

    checkSticky();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', checkSticky);
      window.removeEventListener('resize', checkSticky);
      if (mainEl) {
        mainEl.removeEventListener('scroll', checkSticky);
      }
    };
  }, [isActive]);

  // Mobile layout mode for 'sheet': 'card' (easy mobile cards) or 'table' (full A4 table)
  const [mobileSheetLayout, setMobileSheetLayout] = useState('card');
  // Detail mode for 'sheet' and print: 'compact' (สรุปย่อ ประหยัดกระดาษ) or 'detailed' (แจกแจงรายการย่อย)
  const [tableDetailMode, setTableDetailMode] = useState('compact');
  const [isMobileFilterExpanded, setIsMobileFilterExpanded] = useState(false);

  const handleResetFilters = () => {
    setSearchQuery('');
    setPaymentStatusFilter('all');
    setDateFilterMode('all');
    setFilterDate('');
    setFilterDateRange({ start: '', end: '' });
  };

  // --- Filter States ---
  // DateFilterControl modes: 'all', 'date', 'week', 'month', 'year', 'range'
  const [internalDateFilterMode, setInternalDateFilterMode] = useState('all');
  const [internalFilterDate, setInternalFilterDate] = useState('');
  const [internalFilterDateRange, setInternalFilterDateRange] = useState({ start: '', end: '' });

  const dateFilterMode = propDateFilterMode !== undefined ? propDateFilterMode : internalDateFilterMode;
  const setDateFilterMode = propSetDateFilterMode || setInternalDateFilterMode;
  const filterDate = propFilterDate !== undefined ? propFilterDate : internalFilterDate;
  const setFilterDate = propSetFilterDate || setInternalFilterDate;
  const filterDateRange = propFilterDateRange !== undefined ? propFilterDateRange : internalFilterDateRange;
  const setFilterDateRange = propSetFilterDateRange || setInternalFilterDateRange;

  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all'); // all, paid, deposit, unpaid, refunded
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('desc'); // desc = newest first

  // --- Accordion state for interactive view ---
  const [expandedRows, setExpandedRows] = useState({});

  const toggleRowExpand = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // --- Filter and Process Activities ---
  const processedData = useMemo(() => {
    const filtered = activities.filter(item => {
      // 1. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = (item.id || '').toLowerCase().includes(q);
        const matchName = (item.name || '').toLowerCase().includes(q);
        const matchCustomer = (item.customer || '').toLowerCase().includes(q);
        const matchArtist = (item.artist || '').toLowerCase().includes(q);
        if (!matchId && !matchName && !matchCustomer && !matchArtist) return false;
      }

      // 2. Payment Status Filter
      if (paymentStatusFilter !== 'all') {
        const itemPaymentStatus = item.paymentStatus || (item.dealStatus === 'completed' ? 'paid' : 'unpaid');
        if (itemPaymentStatus !== paymentStatusFilter) return false;
      }

      // 3. Date Filter (matches Analytics / App.jsx logic)
      if (dateFilterMode !== 'all') {
        const effectiveDate = item.paymentDate || item.rawDateTime || item.date;
        if (!effectiveDate) return false;

        let itemDateStr = '';
        if (typeof effectiveDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(effectiveDate)) {
          itemDateStr = effectiveDate.substring(0, 10);
        } else if (typeof effectiveDate === 'string' && /^\d{2}\/\d{2}\/\d{4}/.test(effectiveDate)) {
          const parts = effectiveDate.split(' ')[0].split('/');
          itemDateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
        } else {
          const d = new Date(effectiveDate);
          if (!isNaN(d.getTime())) {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            itemDateStr = `${yyyy}-${mm}-${dd}`;
          }
        }

        if (!itemDateStr) return false;

        if (dateFilterMode === 'date') {
          if (filterDate && itemDateStr !== filterDate) return false;
        } else if (dateFilterMode === 'month') {
          if (filterDate && !itemDateStr.startsWith(filterDate)) return false;
        } else if (dateFilterMode === 'year') {
          if (filterDate && !itemDateStr.startsWith(filterDate)) return false;
        } else if (dateFilterMode === 'range') {
          if (filterDateRange?.start && itemDateStr < filterDateRange.start) return false;
          if (filterDateRange?.end && itemDateStr > filterDateRange.end) return false;
        } else if (dateFilterMode === 'week') {
          if (filterDate) {
            const itemDate = new Date(itemDateStr);
            const weekStart = new Date(filterDate);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekStart.setHours(0, 0, 0, 0);
            weekEnd.setHours(23, 59, 59, 999);
            itemDate.setHours(12, 0, 0, 0);
            if (itemDate < weekStart || itemDate > weekEnd) return false;
          }
        }
      }

      return true;
    });

    filtered.sort((a, b) => {
      const dateA = new Date(a.paymentDate || a.rawDateTime || 0).getTime();
      const dateB = new Date(b.paymentDate || b.rawDateTime || 0).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    // Precalculate all item metrics once to maximize render performance
    return filtered.map(item => {
      const qTotal = item.quotationItems && item.quotationItems.length > 0
        ? item.quotationItems.reduce((sum, q) => sum + (parseFloat(q.price) || 0), 0)
        : (parseFloat(item.wage) || 0);

      const sTotal = item.customerSupport && item.customerSupport.length > 0
        ? item.customerSupport.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0)
        : 0;

      const eTotal = item.expenses && item.expenses.length > 0
        ? item.expenses.reduce((sum, e) => sum + (parseFloat(e.price) || 0), 0)
        : 0;

      const explicitTransfer = parseFloat(item.transferredAmount ?? item.transferAmount);
      const itemTransfer = !isNaN(explicitTransfer) && explicitTransfer > 0
        ? explicitTransfer
        : (sTotal + qTotal);

      const paymentStatus = item.paymentStatus || (item.dealStatus === 'completed' ? 'paid' : 'unpaid');
      const deposit = parseFloat(item.depositAmount) || 0;
      const dateFormatted = formatItemDate(item.paymentDate || item.rawDateTime || item.date);
      const slips = Array.isArray(item.slips) ? item.slips : (item.slip ? [item.slip] : []);

      return {
        ...item,
        _qTotal: qTotal,
        _sTotal: sTotal,
        _eTotal: eTotal,
        _transfer: itemTransfer,
        _profit: qTotal - eTotal,
        _paymentStatus: paymentStatus,
        _deposit: deposit,
        _dateFormatted: dateFormatted,
        _slips: slips,
        _hasSlips: slips.length > 0
      };
    });
  }, [activities, searchQuery, paymentStatusFilter, dateFilterMode, filterDate, filterDateRange, sortOrder]);

  // --- Financial Calculations ---
  const financialSummary = useMemo(() => {
    let totalRevenue = 0;       // เฉพาะค่าจ้าง/ราคาเสนอราคา ไม่รวมเงินสนับสนุนศิลปิน
    let totalQuotation = 0;     // Shop job charges
    let totalSupport = 0;       // Artist support funds
    let totalExpenses = 0;      // Actual expenses / COGS
    let totalProfit = 0;        // รายรับ - รายจ่ายจริง (Quotation - Expenses)
    let totalDeposits = 0;      // Received deposits
    let totalTransfers = 0;     // ยอดโอนจากลูกค้า
    let pendingReceivables = 0; // Unpaid balances (เฉพาะส่วนค่าจ้าง)
    let paidProjectsCount = 0;

    for (let i = 0; i < processedData.length; i++) {
      const item = processedData[i];
      totalQuotation += item._qTotal;
      totalSupport += item._sTotal;
      totalRevenue += item._qTotal;
      totalExpenses += item._eTotal;
      totalProfit += item._profit;
      totalDeposits += item._deposit;
      totalTransfers += item._transfer;

      if (item._paymentStatus === 'paid') {
        paidProjectsCount++;
      } else if (item._paymentStatus === 'deposit') {
        pendingReceivables += Math.max(0, item._qTotal - item._deposit);
      } else if (item._paymentStatus === 'unpaid') {
        pendingReceivables += item._qTotal;
      }
    }

    const netMarginPercent = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0;
    const aov = processedData.length > 0 ? Math.round(totalRevenue / processedData.length) : 0;

    return {
      totalRevenue,
      totalQuotation,
      totalSupport,
      totalExpenses,
      totalProfit,
      totalDeposits,
      totalTransfers,
      pendingReceivables,
      paidProjectsCount,
      netMarginPercent,
      aov,
      projectCount: processedData.length
    };
  }, [processedData]);

  // --- Data for Slips Table View ---
  const projectsWithSlipsCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < processedData.length; i++) {
      if (processedData[i]._hasSlips) count++;
    }
    return count;
  }, [processedData]);

  const displayedSlipsData = useMemo(() => {
    if (slipsFilterMode === 'has_slips') {
      return processedData.filter(item => item._hasSlips);
    }
    return processedData;
  }, [processedData, slipsFilterMode]);

  // Progressive slices for screen rendering (smooth 60fps)
  const visibleSheetData = useMemo(() => processedData.slice(0, visibleCount), [processedData, visibleCount]);
  const visibleDashboardData = useMemo(() => processedData.slice(0, visibleCount), [processedData, visibleCount]);
  const visibleSlipsData = useMemo(() => displayedSlipsData.slice(0, visibleCount), [displayedSlipsData, visibleCount]);

  // Reset visibleCount when search/filters change
  useEffect(() => {
    setVisibleCount(35);
  }, [searchQuery, paymentStatusFilter, dateFilterMode, filterDate, filterDateRange, sortOrder]);

  // Auto-load more items when scrolling near the bottom
  useEffect(() => {
    if (!isActive) return;
    const handleScroll = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      if (scrollY + windowHeight >= docHeight - 500) {
        setVisibleCount(prev => {
          const maxCount = Math.max(processedData.length, displayedSlipsData.length);
          if (prev < maxCount) {
            return Math.min(prev + 35, maxCount);
          }
          return prev;
        });
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isActive, processedData.length, displayedSlipsData.length]);

  // --- Print in New Tab Handler (Multi-page A4 Support) ---
  const handlePrint = (modeParam) => {
    const initialMode = (typeof modeParam === 'string' && ['compact', 'detailed', 'slips'].includes(modeParam))
      ? modeParam
      : (tableDetailMode === 'detailed' ? 'detailed' : 'compact');
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('เบราว์เซอร์บล็อกหน้าต่างใหม่ (Pop-up Blocked) กรุณากดอนุญาตให้เปิดหน้าต่าง Pop-up เพื่อพิมพ์เอกสาร');
      return;
    }

    const shopName = shopInfo?.shopName || 'Flower2U';
    const shopPhone = shopInfo?.phone ? `| โทร. ${escapeHtml(shopInfo.phone)}` : '';
    const printDate = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
    const printTime = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

    // Build Rows HTML for Table / Print
    const rowsHtml = processedData.length === 0
      ? `<tr><td colspan="7" style="text-align: center; padding: 24px; color: #94a3b8; font-style: italic;">ไม่พบข้อมูลบันทึกกำไรขาดทุนตามเงื่อนไขที่เลือก</td></tr>`
      : processedData.map((item) => {
          const hasQuotation = item.quotationItems && item.quotationItems.length > 0;
          const qTotal = item._qTotal;
          const itemRevenue = qTotal;
          const hasSupport = item.customerSupport && item.customerSupport.length > 0;
          const sTotal = item._sTotal;
          const hasExpenses = item.expenses && item.expenses.length > 0;
          const eTotal = item._eTotal;
          const netBalance = item._profit;
          const displayProjectDate = item._dateFormatted;
          const itemTransfer = item._transfer;

          // 1. Support lines
          let supportLinesHtml = '';
          if (hasSupport && sTotal > 0) {
            supportLinesHtml = item.customerSupport.map(sup => {
              const supDate = formatItemDate(sup.date || item.paymentDate || item.rawDateTime || item.date);
              const denomText = sup.denomination >= 20 ? `แบงค์ ${sup.denomination}บาท` : `เหรียญ ${sup.denomination}บาท`;
              const dateText = supDate ? ` - ${supDate}` : '';
              const detailText = sup.detail ? ` (${escapeHtml(sup.detail)})` : '';
              return `<div style="padding-left: 12px; color: #1e293b; font-size: 11px;">-${denomText} x ${sup.quantity}ใบ = ${formatCurrency(sup.price)}บาท${dateText}${detailText}</div>`;
            }).join('');
          } else {
            supportLinesHtml = '<div style="padding-left: 12px; color: #94a3b8; font-style: italic; font-size: 11px;">-ไม่มีรายการสนับสนุน</div>';
          }

          // 2. Quotation lines
          let quotationLinesHtml = '';
          if (hasQuotation) {
            quotationLinesHtml = item.quotationItems.map(quote => {
              const qDate = formatItemDate(quote.date || item.paymentDate || item.rawDateTime || item.date);
              const qLabel = quote.category ? `[${escapeHtml(quote.category)}] ` : '';
              const qDetail = escapeHtml(quote.detail || 'รายการงาน');
              const dateText = qDate ? ` - ${qDate}` : '';
              return `<div style="padding-left: 12px; color: #1e293b; font-size: 11px;">-${qLabel}${qDetail} ${formatCurrency(quote.price)}บาท${dateText}</div>`;
            }).join('');
          } else if (qTotal > 0) {
            quotationLinesHtml = `<div style="padding-left: 12px; color: #1e293b; font-size: 11px;">-ค่าจ้าง/บริการ ${formatCurrency(qTotal)}บาท ${displayProjectDate ? `- ${displayProjectDate}` : ''}</div>`;
          } else {
            quotationLinesHtml = '<div style="padding-left: 12px; color: #94a3b8; font-style: italic; font-size: 11px;">-ไม่มีรายการเสนอราคา</div>';
          }

          // 3. Expenses lines
          let expenseLinesHtml = '';
          if (hasExpenses && eTotal > 0) {
            expenseLinesHtml = item.expenses.map(exp => {
              const expDate = formatItemDate(exp.date || item.paymentDate || item.rawDateTime || item.date);
              const expLabel = exp.category ? `[${escapeHtml(exp.category)}] ` : '';
              const expDetail = escapeHtml(exp.detail || 'ค่าใช้จ่าย');
              const qtyText = exp.quantity > 1 ? `${exp.quantity} หน่วย ` : '';
              const dateText = expDate ? ` - ${expDate}` : '';
              return `<div style="padding-left: 12px; color: #1e293b; font-size: 11px;">-${expLabel}${expDetail} ${qtyText}${formatCurrency(exp.price)} บาท${dateText}</div>`;
            }).join('');
          } else {
            expenseLinesHtml = '<div style="padding-left: 12px; color: #94a3b8; font-style: italic; font-size: 11px;">-ไม่มีรายการค่าใช้จ่ายจริง</div>';
          }

          const clientInfo = `ลูกค้า: ${escapeHtml(item.customer || '-')} • ศิลปิน: ${escapeHtml(item.artist || '-')}`;

          return `
            <tr class="table-row-item" style="page-break-inside: avoid; break-inside: avoid;">
              <td style="text-align: center; font-weight: bold; white-space: nowrap; padding: 8px 6px; border-left: 1px solid #000; border-right: 1px solid #000; border-bottom: 1px dashed #000;">
                ${displayProjectDate || '-'}
              </td>
              <td style="padding: 8px 10px; border-left: 1px solid #000; border-right: 1px solid #000; border-bottom: 1px dashed #000;">
                <div class="job-title-row" style="font-weight: 800; font-size: 13px; line-height: 1.35; color: #0f172a;">
                  ${escapeHtml(item.id)} ${item.name ? `- ${escapeHtml(item.name)}` : ''}
                </div>
                <div class="job-client-row" style="font-size: 11px; font-weight: normal; color: #64748b; margin-top: 2px; line-height: 1.3;">
                  ${clientInfo}
                </div>
                <div class="detail-sub-list">
                  <div style="margin-top: 4px;">
                    <div style="font-weight: bold; font-size: 11px; color: #0f172a;">1.เงินสนับสนุนศิลปิน (Money Order)</div>
                    ${supportLinesHtml}
                  </div>
                  <div style="margin-top: 6px;">
                    <div style="font-weight: bold; font-size: 11px; color: #0f172a;">2.รายการเสนอราคา (Quotation)</div>
                    ${quotationLinesHtml}
                  </div>
                  <div style="margin-top: 6px;">
                    <div style="font-weight: bold; font-size: 11px; color: #0f172a;">3.รายจ่ายจริง / ต้นทุนเพิ่ม (Expenses)</div>
                    ${expenseLinesHtml}
                  </div>
                </div>
              </td>
              <td style="text-align: right; font-weight: bold; padding: 8px 8px; font-variant-numeric: tabular-nums; border-left: 1px solid #000; border-right: 1px solid #000; border-bottom: 1px dashed #000;">
                ${itemTransfer > 0 ? formatCurrency(itemTransfer) : '-'}
              </td>
              <td style="text-align: right; font-weight: bold; padding: 8px 8px; font-variant-numeric: tabular-nums; border-left: 1px solid #000; border-right: 1px solid #000; border-bottom: 1px dashed #000;">
                ${sTotal > 0 ? formatCurrency(sTotal) : '-'}
              </td>
              <td class="col-revenue" style="text-align: right; font-weight: bold; padding: 8px 8px; font-variant-numeric: tabular-nums; border-left: 1px solid #000; border-right: 1px solid #000; border-bottom: 1px dashed #000; background-color: #f0fdf4; color: #15803d;">
                ${itemRevenue > 0 ? formatCurrency(itemRevenue) : '-'}
              </td>
              <td class="col-expense" style="text-align: right; font-weight: bold; padding: 8px 8px; font-variant-numeric: tabular-nums; border-left: 1px solid #000; border-right: 1px solid #000; border-bottom: 1px dashed #000; background-color: #fff1f2; color: #be123c;">
                ${eTotal > 0 ? formatCurrency(eTotal) : '-'}
              </td>
              <td class="${netBalance >= 0 ? 'col-profit' : 'col-loss'}" style="text-align: right; font-weight: 800; padding: 8px 8px; font-variant-numeric: tabular-nums; border-left: 1px solid #000; border-right: 1px solid #000; border-bottom: 1px dashed #000; background-color: ${netBalance >= 0 ? '#e6f4ea' : '#fce8e6'}; color: ${netBalance >= 0 ? '#137333' : '#c5221f'};">
                ${formatCurrency(netBalance)}
              </td>
            </tr>
          `;
        }).join('');

    // Grand Total Summary Row (for Table)
    const grandTotalHtml = `
      <tr style="background: #f1f5f9; font-weight: 800; border-top: 2px solid #000; border-bottom: 2px solid #000; font-size: 12px; page-break-inside: avoid; break-inside: avoid;">
        <td colspan="2" style="text-align: center; padding: 10px 8px; border-top: 2px solid #000; border-bottom: 2px solid #000;">ยอดรวมสุทธิ (Grand Total)</td>
        <td style="text-align: right; padding: 10px 8px; color: #0f172a; font-variant-numeric: tabular-nums; border-top: 2px solid #000; border-bottom: 2px solid #000;">฿${formatCurrency(financialSummary.totalTransfers)}</td>
        <td style="text-align: right; padding: 10px 8px; color: #0f172a; font-variant-numeric: tabular-nums; border-top: 2px solid #000; border-bottom: 2px solid #000;">฿${formatCurrency(financialSummary.totalSupport)}</td>
        <td class="col-revenue" style="text-align: right; padding: 10px 8px; font-variant-numeric: tabular-nums; border-top: 2px solid #000; border-bottom: 2px solid #000; background-color: #bbf7d0; color: #14532d;">฿${formatCurrency(financialSummary.totalRevenue)}</td>
        <td class="col-expense" style="text-align: right; padding: 10px 8px; font-variant-numeric: tabular-nums; border-top: 2px solid #000; border-bottom: 2px solid #000; background-color: #fecdd3; color: #881337;">฿${formatCurrency(financialSummary.totalExpenses)}</td>
        <td class="${financialSummary.totalProfit >= 0 ? 'col-profit' : 'col-loss'}" style="text-align: right; padding: 10px 8px; font-variant-numeric: tabular-nums; border-top: 2px solid #000; border-bottom: 2px solid #000; background-color: ${financialSummary.totalProfit >= 0 ? '#b7e1cd' : '#fad2cf'}; color: ${financialSummary.totalProfit >= 0 ? '#0d652d' : '#b31412'};">฿${formatCurrency(financialSummary.totalProfit)}</td>
      </tr>
    `;

    // Build Attached Slips Table Rows
    const itemsWithSlips = processedData.filter(item => item._hasSlips);
    const totalAttachedSlips = processedData.reduce((sum, item) => sum + (item._slips ? item._slips.length : 0), 0);

    const slipsRowsHtml = processedData.length === 0
      ? `<tr><td colspan="2" style="text-align: center; padding: 24px; color: #94a3b8; font-style: italic;">ไม่พบข้อมูลสลิปโอนเงิน</td></tr>`
      : processedData.map((item) => {
          const itemDate = item._dateFormatted || '-';
          const slips = item._slips || [];
          const hasSlips = item._hasSlips;
          const transferAmount = item._transfer;
          const qTotal = item._qTotal;

          let slipsHtml = '';
          if (hasSlips) {
            slipsHtml = `
              <div class="slips-flex" style="display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: flex-start; margin-top: 6px;">
                ${slips.map((slip, idx) => {
                  const slipSrc = typeof slip === 'object' ? slip.url : slip;
                  const processedUrl = processImageUrl(slipSrc);
                  return `
                    <div class="slip-item" style="display: inline-flex; flex-direction: column; align-items: center; width: auto; max-width: 100%; page-break-inside: avoid; break-inside: avoid;">
                      <img
                        src="${processedUrl}"
                        alt="สลิป ${idx + 1}"
                        style="height: 240px; width: auto; max-width: 100%; object-fit: contain; display: block; border-radius: 4px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.06);"
                        onerror="this.onerror=null;this.src='https://placehold.co/300x400?text=Slip+Error';"
                      />
                      ${slips.length > 1 ? `<div style="font-size: 10px; font-weight: 700; color: #64748b; margin-top: 2px;">ใบที่ ${idx + 1}</div>` : ''}
                    </div>
                  `;
                }).join('')}
              </div>
            `;
          } else {
            slipsHtml = `
              <div style="color: #94a3b8; font-style: italic; font-size: 11px; margin-top: 2px;">
                - ไม่มีรูปสลิปแนบ -
              </div>
            `;
          }

          const clientInfo = `ลูกค้า: ${escapeHtml(item.customer || '-')} • ศิลปิน: ${escapeHtml(item.artist || '-')}`;

          return `
            <tr class="${hasSlips ? 'slip-row-has-slip' : 'slip-row-no-slip'}" style="page-break-inside: avoid; break-inside: avoid; border-bottom: 1px dashed #000;">
              <td style="width: 80px; vertical-align: top; text-align: center; font-weight: bold; font-size: 11px; padding: 8px 6px; border-left: 1px solid #000; border-right: 1px solid #000; border-bottom: 1px dashed #000; background: #fafafa;">
                ${escapeHtml(itemDate)}
              </td>
              <td style="vertical-align: top; padding: 8px 10px; border-left: 1px solid #000; border-right: 1px solid #000; border-bottom: 1px dashed #000;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 2px;">
                  <div>
                    <span style="font-weight: 800; font-size: 12px; color: #0f172a;">${escapeHtml(item.id)} ${item.name ? `- ${escapeHtml(item.name)}` : ''}</span>
                  </div>
                  ${transferAmount > 0 ? `<div style="font-size: 11px; font-weight: 700; color: #059669; background: #ecfdf5; padding: 2px 6px; border-radius: 4px; border: 1px solid #a7f3d0; white-space: nowrap;">ยอดโอน: ฿${formatCurrency(transferAmount)}</div>` : ''}
                </div>
                <div style="font-size: 11px; color: #64748b; margin-bottom: 3px;">
                  <span>${clientInfo}</span>
                  ${qTotal > 0 ? `<span style="margin: 0 4px;">•</span><span>ยอดงาน: ฿${formatCurrency(qTotal)}</span>` : ''}
                </div>
                ${slipsHtml}
              </td>
            </tr>
          `;
        }).join('');

    const fullHtml = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>บันทึกข้อมูลกำไรขาดทุน - ${escapeHtml(shopName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background: #f1f5f9;
      color: #0f172a;
      font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 11pt;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .top-action-bar {
      position: sticky;
      top: 0;
      z-index: 1000;
      background: #0f172a;
      color: #ffffff;
      box-shadow: 0 4px 15px rgba(0,0,0,0.18);
    }
    .top-bar-main {
      padding: 12px 24px;
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 16px;
    }
    .top-bar-title {
      font-size: 14px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 10px;
      justify-self: start;
      white-space: nowrap;
    }
    .top-bar-badge {
      background: #334155;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 12px;
      color: #93c5fd;
    }
    .mode-toggle-group {
      display: flex;
      align-items: center;
      gap: 10px;
      justify-self: center;
    }
    .toggle-pill-container {
      display: inline-flex;
      background: #1e293b;
      padding: 3px;
      border-radius: 10px;
      border: 1px solid #334155;
    }
    .top-bar-sub {
      background: #1e293b;
      border-top: 1px solid #334155;
      padding: 8px 24px;
      display: flex;
      justify-content: center;
      align-items: center;
      animation: fadeInSubBar 0.15s ease-out;
    }
    .sub-bar-inner {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    @keyframes fadeInSubBar {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .mode-btn {
      background: transparent;
      color: #94a3b8;
      border: none;
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 700;
      border-radius: 7px;
      cursor: pointer;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      user-select: none;
    }
    .mode-btn:hover {
      color: #ffffff;
    }
    .mode-btn.active {
      background: #4f46e5;
      color: #ffffff;
      box-shadow: 0 1px 4px rgba(0,0,0,0.3);
    }
    body.mode-compact #accountingSection,
    body.mode-detailed #accountingSection {
      display: block !important;
    }
    body.mode-compact #slipsSection,
    body.mode-detailed #slipsSection {
      display: none !important;
    }
    body.mode-compact .detail-sub-list {
      display: none !important;
    }
    body.mode-compact .job-title-row {
      margin-bottom: 0 !important;
    }
    body.mode-compact .table-row-item td {
      padding-top: 6px !important;
      padding-bottom: 6px !important;
    }
    body.mode-slips #accountingSection {
      display: none !important;
    }
    body.mode-slips #slipsSection {
      display: block !important;
    }
    .btn-group {
      display: flex;
      align-items: center;
      gap: 8px;
      justify-self: end;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }
    .btn-primary {
      background: #4f46e5;
      color: #ffffff;
      box-shadow: 0 2px 8px rgba(79, 70, 229, 0.4);
    }
    .btn-primary:hover {
      background: #4338ca;
    }
    .btn-secondary {
      background: #334155;
      color: #e2e8f0;
      border: 1px solid #475569;
    }
    .btn-secondary:hover {
      background: #475569;
      color: #ffffff;
    }
    .paper-container {
      max-width: 860px;
      margin: 24px auto 40px auto;
      background: #ffffff;
      padding: 36px 42px;
      border-radius: 12px;
      box-shadow: 0 4px 30px rgba(0,0,0,0.08);
    }
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .doc-title {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 4px 0;
      letter-spacing: -0.5px;
    }
    .doc-subtitle {
      font-size: 12px;
      font-weight: 600;
      color: #475569;
      margin: 0;
    }
    .doc-meta {
      text-align: right;
      font-size: 11px;
      color: #64748b;
      line-height: 1.4;
    }
    .table-scroll-wrapper {
      width: 100%;
    }
    .accounting-table {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #000;
      font-size: 10pt;
      line-height: 1.35;
    }
    .accounting-table th {
      border: 1px solid #000;
      background-color: #f1f5f9;
      font-weight: 700;
      text-align: center;
      padding: 8px 6px;
      color: #0f172a;
    }
    .accounting-table td {
      border-left: 1px solid #000;
      border-right: 1px solid #000;
      border-top: 1px dashed #000;
      border-bottom: 1px dashed #000;
      vertical-align: top;
    }
    /* Highlighted Columns: Revenue, Expenses, Profit/Loss (เข้มกว่า) */
    .col-revenue {
      background-color: #f0fdf4 !important;
      color: #15803d !important;
    }
    th.col-revenue {
      background-color: #dcfce7 !important;
      color: #166534 !important;
      font-weight: 800 !important;
    }
    .col-expense {
      background-color: #fff1f2 !important;
      color: #be123c !important;
    }
    th.col-expense {
      background-color: #ffe4e6 !important;
      color: #9f1239 !important;
      font-weight: 800 !important;
    }
    .col-profit {
      background-color: #e6f4ea !important;
      color: #137333 !important;
      font-weight: 800 !important;
    }
    th.col-profit {
      background-color: #ceead6 !important;
      color: #0d652d !important;
      font-weight: 800 !important;
    }
    .col-loss {
      background-color: #fce8e6 !important;
      color: #c5221f !important;
      font-weight: 800 !important;
    }
    th.col-loss {
      background-color: #fad2cf !important;
      color: #b31412 !important;
      font-weight: 800 !important;
    }
    .signature-grid {
      display: flex;
      justify-content: space-between;
      margin-top: 40px;
      padding: 0 20px;
      font-size: 12px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .sign-box {
      text-align: center;
      width: 220px;
    }
    .sign-line {
      border-bottom: 1px dotted #475569;
      height: 38px;
      margin-bottom: 6px;
    }

    @page {
      size: A4 portrait;
      margin: 10mm 10mm 12mm 10mm;
    }

    /* Screen view on mobile phones */
    @media screen and (max-width: 768px) {
      .top-action-bar {
        padding: 0;
      }
      .top-bar-main {
        padding: 10px 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        align-items: stretch;
      }
      .top-bar-title {
        font-size: 13px;
        justify-content: space-between;
      }
      .btn-group {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
        justify-self: stretch;
      }
      .btn {
        padding: 8px 8px;
        font-size: 12px;
        justify-content: center;
      }
      .top-bar-sub {
        padding: 8px 14px;
      }
      .sub-bar-inner {
        width: 100%;
        justify-content: space-between;
      }
      .paper-container {
        margin: 8px 6px 24px 6px;
        padding: 14px 10px;
        border-radius: 10px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.05);
      }
      .doc-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
      }
      .doc-title {
        font-size: 18px;
      }
      .doc-meta {
        text-align: left;
        font-size: 10px;
      }
      .table-scroll-wrapper {
        display: block;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        border: 1px solid #000;
        border-radius: 6px;
        margin-bottom: 16px;
      }
      .accounting-table {
        min-width: 680px;
      }
      .signature-grid {
        flex-direction: column;
        gap: 16px;
        margin-top: 20px;
        padding: 0;
      }
      .sign-box {
        width: 100%;
      }
      .mode-toggle-group {
        flex-direction: column;
        align-items: stretch;
        gap: 6px;
      }
      .toggle-pill-container {
        display: flex;
        flex-wrap: wrap;
        width: 100%;
        gap: 3px;
      }
      .mode-btn {
        flex: 1 1 auto;
        min-width: 80px;
        justify-content: center;
        font-size: 11px;
        padding: 6px 6px;
      }
      #slipsFilterContainer {
        justify-content: center;
      }
    }

    /* Official A4 Print Output */
    @media print {
      .no-print {
        display: none !important;
      }
      body {
        background: #ffffff !important;
        color: #000000 !important;
        font-size: 10pt !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      body.mode-compact #accountingSection,
      body.mode-detailed #accountingSection {
        display: block !important;
      }
      body.mode-compact #slipsSection,
      body.mode-detailed #slipsSection {
        display: none !important;
      }
      body.mode-slips #accountingSection {
        display: none !important;
      }
      body.mode-slips #slipsSection {
        display: block !important;
      }
      body.mode-compact .detail-sub-list {
        display: none !important;
      }
      body.mode-compact .job-title-row {
        margin-bottom: 0 !important;
      }
      body.mode-compact .table-row-item td {
        padding-top: 4px !important;
        padding-bottom: 4px !important;
        font-size: 9pt !important;
      }
      .job-client-row {
        font-size: 8pt !important;
        color: #475569 !important;
      }
      .paper-container {
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        border-radius: 0 !important;
      }
      .table-scroll-wrapper {
        display: block !important;
        overflow: visible !important;
        border: none !important;
      }
      .accounting-table {
        min-width: 100% !important;
        width: 100% !important;
        display: table !important;
        border-collapse: collapse !important;
      }
      thead {
        display: table-header-group !important;
      }
      tfoot {
        display: table-row-group !important;
      }
      tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      .signature-grid {
        display: flex !important;
        flex-direction: row !important;
        justify-content: space-between !important;
        margin-top: 40px !important;
      }
      .sign-box {
        width: 220px !important;
      }
      .col-revenue {
        background-color: #f0fdf4 !important;
        color: #15803d !important;
      }
      th.col-revenue {
        background-color: #dcfce7 !important;
        color: #166534 !important;
      }
      .col-expense {
        background-color: #fff1f2 !important;
        color: #be123c !important;
      }
      th.col-expense {
        background-color: #ffe4e6 !important;
        color: #9f1239 !important;
      }
      .col-profit {
        background-color: #e6f4ea !important;
        color: #137333 !important;
      }
      th.col-profit {
        background-color: #ceead6 !important;
        color: #0d652d !important;
      }
      .col-loss {
        background-color: #fce8e6 !important;
        color: #c5221f !important;
      }
      th.col-loss {
        background-color: #fad2cf !important;
        color: #b31412 !important;
      }
    }
  </style>
</head>
<body class="mode-${initialMode}">
  <div class="top-action-bar no-print">
    <div class="top-bar-main">
      <div class="top-bar-title">
        <span id="barTitle">${initialMode === 'slips' ? 'ตารางหลักฐานสลิปโอนเงิน' : 'แบบฟอร์มบันทึกข้อมูลกำไรขาดทุน'}</span>
        <span class="top-bar-badge">${processedData.length} รายการ</span>
      </div>

      <!-- Toggle Print Mode (3 options: Compact vs Detailed vs Slips) -->
      <div class="mode-toggle-group">
        <span style="font-size: 12px; color: #94a3b8; font-weight: 600;">รูปแบบการพิมพ์:</span>
        <div class="toggle-pill-container">
          <button id="btnModeCompact" class="mode-btn ${initialMode === 'compact' ? 'active' : ''}" onclick="setPrintMode('compact')">
            📄 แบบย่อ
          </button>
          <button id="btnModeDetailed" class="mode-btn ${initialMode === 'detailed' ? 'active' : ''}" onclick="setPrintMode('detailed')">
            📑 แบบละเอียด
          </button>
          <button id="btnModeSlips" class="mode-btn ${initialMode === 'slips' ? 'active' : ''}" onclick="setPrintMode('slips')">
            🧾 แบบสลิป (${itemsWithSlips.length} งาน)
          </button>
        </div>
      </div>

      <div class="btn-group">
        <button class="btn btn-primary" onclick="window.print()">
          พิมพ์ / บันทึก PDF
        </button>
        <button class="btn btn-secondary" onclick="window.close()">
          ปิด
        </button>
      </div>
    </div>

    <!-- Slips Filter Sub-bar (Dedicated row: completely separates filter from mode buttons so buttons NEVER jump) -->
    <div id="slipsFilterContainer" class="top-bar-sub" style="display: ${initialMode === 'slips' ? 'flex' : 'none'};">
      <div class="sub-bar-inner">
        <span style="font-size: 12px; color: #94a3b8; font-weight: 600;">แสดงรายการสลิป:</span>
        <div id="slipsFilterPill" style="display: inline-flex; align-items: center; background: #0f172a; padding: 2px; border-radius: 8px; border: 1px solid #334155;">
          <button id="btnSlipsOnly" onclick="setSlipsFilter('has_slips')" style="padding: 4px 12px; font-size: 11px; font-weight: 700; border: none; background: #4f46e5; color: #fff; border-radius: 6px; cursor: pointer; transition: all 0.15s;">
            เฉพาะมีสลิป (${itemsWithSlips.length})
          </button>
          <button id="btnSlipsAll" onclick="setSlipsFilter('all')" style="padding: 4px 12px; font-size: 11px; font-weight: 700; border: none; background: transparent; color: #94a3b8; border-radius: 6px; cursor: pointer; transition: all 0.15s;">
            ทั้งหมด (${processedData.length})
          </button>
        </div>
      </div>
    </div>
  </div>

  <div class="paper-container">
    <!-- ========================================================
         ส่วนที่ 1: ตารางบันทึกข้อมูลกำไรขาดทุน (แบบย่อ / แบบละเอียด)
         ======================================================== -->
    <div id="accountingSection">
      <div class="doc-header">
        <div>
          <h1 class="doc-title">บันทึกข้อมูลกำไรขาดทุน</h1>
          <p class="doc-subtitle">${escapeHtml(shopName)} ${shopPhone}</p>
        </div>
        <div class="doc-meta">
          <div><strong>วันที่พิมพ์:</strong> ${printDate} (${printTime} น.)</div>
          <div><strong>จำนวนงาน:</strong> ${processedData.length} รายการ</div>
          <div id="metaPrintMode"><strong>รูปแบบ:</strong> ${initialMode === 'compact' ? 'สรุปย่อ (ประหยัดกระดาษ)' : (initialMode === 'slips' ? 'ตารางสลิปโอนเงิน' : 'แจกแจงละเอียด')}</div>
        </div>
      </div>

      <!-- A4 Table View (Pan-able on phone, prints cleanly on paper) -->
      <div class="table-scroll-wrapper" id="tableScrollWrapper">
        <table class="accounting-table">
          <thead>
            <tr>
              <th style="width: 80px;">วันที่</th>
              <th>รายการ</th>
              <th style="width: 85px; text-align: right;">ยอดโอน</th>
              <th style="width: 90px; text-align: right;">เงินศิลปิน</th>
              <th class="col-revenue" style="width: 85px; text-align: right; background-color: #dcfce7; color: #166534;">รายรับ</th>
              <th class="col-expense" style="width: 85px; text-align: right; background-color: #ffe4e6; color: #9f1239;">รายจ่าย</th>
              <th class="col-profit" style="width: 95px; text-align: right; background-color: #ceead6; color: #0d652d;">กำไร/ขาดทุน</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            ${grandTotalHtml}
          </tfoot>
        </table>
      </div>

      <div class="signature-grid">
        <div class="sign-box">
          <div class="sign-line"></div>
          <div style="font-weight: bold;">ผู้จัดทำ / ผู้ลงบันทึก</div>
          <div style="color: #64748b; font-size: 11px; margin-top: 4px;">วันที่: ......./......./...........</div>
        </div>
        <div class="sign-box">
          <div class="sign-line"></div>
          <div style="font-weight: bold;">ผู้ตรวจสอบ / ผู้อนุมัติ</div>
          <div style="color: #64748b; font-size: 11px; margin-top: 4px;">วันที่: ......./......./...........</div>
        </div>
      </div>
    </div>

    <!-- ========================================================
         ส่วนที่ 2: ตารางหลักฐานสลิปโอนเงิน (แบบสลิป)
         ======================================================== -->
    <div id="slipsSection" class="slips-section">
      <div class="doc-header">
        <div>
          <h1 class="doc-title">ตารางหลักฐานสลิปโอนเงิน</h1>
          <p class="doc-subtitle">${escapeHtml(shopName)} ${shopPhone}</p>
        </div>
        <div class="doc-meta">
          <div><strong>วันที่พิมพ์:</strong> ${printDate} (${printTime} น.)</div>
          <div><strong>รายการที่มีสลิป:</strong> ${itemsWithSlips.length} รายการ (รวม ${totalAttachedSlips} ใบ)</div>
          <div><strong>รูปแบบ:</strong> ตารางสลิปโอนเงิน</div>
        </div>
      </div>

      <div class="table-scroll-wrapper">
        <table class="accounting-table" style="width: 100%; border-collapse: collapse; border: 1.5px solid #000;">
          <thead>
            <tr style="background-color: #f1f5f9;">
              <th style="width: 80px; border: 1px solid #000; padding: 8px 6px; text-align: center; font-weight: 700;">วันที่</th>
              <th style="border: 1px solid #000; padding: 8px 10px; text-align: left; font-weight: 700;">รายการ และ หลักฐานสลิปโอนเงิน</th>
            </tr>
          </thead>
          <tbody>
            ${slipsRowsHtml}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <script>
    function setPrintMode(mode) {
      var body = document.body;
      body.classList.remove('mode-compact', 'mode-detailed', 'mode-slips');
      body.classList.add('mode-' + mode);

      var btnCompact = document.getElementById('btnModeCompact');
      var btnDetailed = document.getElementById('btnModeDetailed');
      var btnSlips = document.getElementById('btnModeSlips');
      if (btnCompact) btnCompact.classList.toggle('active', mode === 'compact');
      if (btnDetailed) btnDetailed.classList.toggle('active', mode === 'detailed');
      if (btnSlips) btnSlips.classList.toggle('active', mode === 'slips');

      var slipsFilter = document.getElementById('slipsFilterContainer');
      if (slipsFilter) {
        slipsFilter.style.display = mode === 'slips' ? 'flex' : 'none';
      }

      var barTitle = document.getElementById('barTitle');
      if (barTitle) {
        barTitle.textContent = mode === 'slips' ? 'ตารางหลักฐานสลิปโอนเงิน' : 'แบบฟอร์มบันทึกข้อมูลกำไรขาดทุน';
      }

      var meta = document.getElementById('metaPrintMode');
      if (meta) {
        if (mode === 'compact') meta.innerHTML = '<strong>รูปแบบ:</strong> สรุปย่อ (ประหยัดกระดาษ)';
        else if (mode === 'detailed') meta.innerHTML = '<strong>รูปแบบ:</strong> แจกแจงละเอียด';
        else if (mode === 'slips') meta.innerHTML = '<strong>รูปแบบ:</strong> ตารางสลิปโอนเงิน';
      }
    }

    function setSlipsFilter(mode) {
      var noSlipsRows = document.querySelectorAll('.slip-row-no-slip');
      var btnOnly = document.getElementById('btnSlipsOnly');
      var btnAll = document.getElementById('btnSlipsAll');
      if (mode === 'has_slips') {
        noSlipsRows.forEach(function(r) { r.style.display = 'none'; });
        if (btnOnly) { btnOnly.style.background = '#4f46e5'; btnOnly.style.color = '#fff'; }
        if (btnAll) { btnAll.style.background = 'transparent'; btnAll.style.color = '#cbd5e1'; }
      } else {
        noSlipsRows.forEach(function(r) { r.style.display = ''; });
        if (btnAll) { btnAll.style.background = '#4f46e5'; btnAll.style.color = '#fff'; }
        if (btnOnly) { btnOnly.style.background = 'transparent'; btnOnly.style.color = '#cbd5e1'; }
      }
    }
    // Default to showing only rows with slips
    setSlipsFilter('has_slips');
  </script>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(fullHtml);
    printWindow.document.close();
  };

  // --- Print Slips Sheet Handler (Delegates to unified handlePrint('slips')) ---
  const handlePrintSlips = () => {
    handlePrint('slips');
  };

  // --- Export to CSV Handler ---
  const handleExportCSV = () => {
    if (processedData.length === 0) {
      alert("ไม่มีข้อมูลสำหรับส่งออก");
      return;
    }

    const headers = [
      "รหัสงาน",
      "วันที่",
      "ชื่องาน",
      "ลูกค้า",
      "ศิลปิน",
      "สถานะการชำระเงิน",
      "ยอดใบเสนอราคา",
      "ยอดเงินสนับสนุนศิลปิน",
      "รายจ่ายจริง",
      "กำไรสุทธิ",
      "ยอดมัดจำ"
    ];

    const rows = processedData.map(item => {
      const qTotal = item.quotationItems && item.quotationItems.length > 0
        ? item.quotationItems.reduce((sum, q) => sum + (parseFloat(q.price) || 0), 0)
        : (parseFloat(item.wage) || 0);

      const sTotal = item.customerSupport && item.customerSupport.length > 0
        ? item.customerSupport.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0)
        : 0;

      const eTotal = item.expenses && item.expenses.length > 0
        ? item.expenses.reduce((sum, e) => sum + (parseFloat(e.price) || 0), 0)
        : 0;

      const profit = qTotal - eTotal;
      const status = item.paymentStatus === 'paid' ? 'ชำระครบแล้ว'
        : item.paymentStatus === 'deposit' ? 'มัดจำแล้ว'
        : item.paymentStatus === 'refunded' ? 'คืนเงิน/ยกเลิก'
        : 'รอชำระเงิน';

      return [
        `"${item.id || ''}"`,
        `"${formatItemDate(item.paymentDate || item.rawDateTime || item.date)}"`,
        `"${(item.name || '').replace(/"/g, '""')}"`,
        `"${(item.customer || '').replace(/"/g, '""')}"`,
        `"${(item.artist || '').replace(/"/g, '""')}"`,
        `"${status}"`,
        qTotal,
        sTotal,
        eTotal,
        profit,
        parseFloat(item.depositAmount) || 0
      ].join(',');
    });

    // Add UTF-8 BOM for Thai Excel compatibility
    const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `รายงานกำไรขาดทุน_Flower2U_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full space-y-6 px-4 sm:px-8 lg:px-10 pt-4 pb-24 md:pb-10 font-sans">
      {/* =========================================================================
          PRINT-ONLY STYLES & HEADER
         ========================================================================= */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          /* Page setup for A4 */
          @page {
            size: A4 portrait;
            margin: 12mm 10mm 12mm 10mm;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 11pt !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Hide all application elements except printable sheet */
          header, aside, nav, .no-print, button, .filter-bar, footer {
            display: none !important;
          }
          .print-area {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .table-container-for-print {
            display: block !important;
          }
          /* Crisp Accounting Table Grid */
          .accounting-print-table {
            width: 100% !important;
            border-collapse: collapse !important;
            border: 1.5px solid #000 !important;
            font-size: 9.5pt !important;
            line-height: 1.35 !important;
          }
          .accounting-print-table th {
            border: 1px solid #000 !important;
            background-color: #f2f2f2 !important;
            font-weight: bold !important;
            text-align: center !important;
          }
          .accounting-print-table td {
            border-left: 1px solid #000 !important;
            border-right: 1px solid #000 !important;
            border-top: 1px dashed #000 !important;
            border-bottom: 1px dashed #000 !important;
            padding: 5px 7px !important;
            vertical-align: top !important;
          }
          .accounting-print-table tr {
            page-break-inside: avoid !important;
          }
          .accounting-print-table tfoot {
            display: table-row-group !important;
          }
          .dotted-row td {
            border-left: 1px solid #000 !important;
            border-right: 1px solid #000 !important;
            border-bottom: 1px dashed #000 !important;
            border-top: 1px dashed #000 !important;
            height: 24px !important;
          }
        }
      `}} />

      {/* =========================================================================
          TOP TOOLBAR & CONTROLS (Screen Only)
         ========================================================================= */}
      <div className="no-print flex items-center justify-between gap-2 pb-1">
        {/* View Mode Toggle: Clean segmented control */}
        <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200 shrink-0">
          <button
            onClick={() => handleViewModeChange('sheet')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'sheet'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <TableIcon className="w-4 h-4 text-indigo-600" />
            <span>ตารางบัญชี</span>
          </button>
          <button
            onClick={() => handleViewModeChange('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'dashboard'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart2 className="w-4 h-4 text-emerald-600" />
            <span>การ์ดสรุป</span>
          </button>
          <button
            onClick={() => handleViewModeChange('slips')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'slips'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Receipt className="w-4 h-4 text-amber-600" />
            <span>ตารางสลิป</span>
          </button>
        </div>

        {/* Action Buttons: Export Excel & Print */}
        <div className="flex items-center gap-2">
          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            className="flex items-center justify-center w-10 h-10 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl shadow-xs transition active:scale-95 shrink-0"
            title="ส่งออกไฟล์ Excel/CSV"
          >
            <Download className="w-5 h-5 text-emerald-600" />
          </button>

          {/* Print to A4 Button (Icon only, larger touch size) */}
          <button
            onClick={() => handlePrint(viewMode === 'slips' ? 'slips' : tableDetailMode)}
            className="flex items-center justify-center w-10 h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-100 transition-all hover:-translate-y-0.5 active:translate-y-0 shrink-0"
            title={viewMode === 'slips' ? "พิมพ์ตารางสลิป A4" : "พิมพ์เอกสาร A4"}
          >
            <Printer className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* =========================================================================
          FINANCIAL KPI CARDS (Sleek, Balanced, No Fluff)
         ========================================================================= */}
      <div className="no-print grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Card 1: รายรับรวม */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-[0_2px_12px_rgb(0,0,0,0.03)] hover:shadow-md transition flex flex-col justify-between group">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-xs font-bold text-slate-500">รายรับรวม</span>
            <div className="p-1.5 sm:p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform">
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <p className="text-base sm:text-2xl font-black text-slate-900 tracking-tight truncate tabular-nums">
            ฿{formatCurrency(financialSummary.totalRevenue)}
          </p>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50 text-[11px] text-slate-500 font-medium">
            <span className="truncate">ค่าจ้าง: ฿{formatCurrency(financialSummary.totalQuotation)}</span>
            <span className="text-indigo-600 font-bold shrink-0 ml-1">{financialSummary.projectCount} งาน</span>
          </div>
        </div>

        {/* Card 2: เงินสนับสนุนศิลปิน */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-[0_2px_12px_rgb(0,0,0,0.03)] hover:shadow-md transition flex flex-col justify-between group">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-xs font-bold text-slate-500">เงินสนับสนุน</span>
            <div className="p-1.5 sm:p-2 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform">
              <Gift className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <p className="text-base sm:text-2xl font-black text-indigo-700 tracking-tight truncate tabular-nums">
            ฿{formatCurrency(financialSummary.totalSupport)}
          </p>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50 text-[11px] text-slate-500 font-medium">
            <span className="text-indigo-600 font-semibold truncate">ยอดส่งต่อศิลปิน</span>
            <span className="text-slate-400 font-normal shrink-0">ไม่หักกำไร</span>
          </div>
        </div>

        {/* Card 3: รายจ่ายจริง (ต้นทุน) */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-[0_2px_12px_rgb(0,0,0,0.03)] hover:shadow-md transition flex flex-col justify-between group">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-xs font-bold text-slate-500">รายจ่ายจริง</span>
            <div className="p-1.5 sm:p-2 bg-rose-50 text-rose-600 rounded-xl group-hover:scale-110 transition-transform">
              <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <p className="text-base sm:text-2xl font-black text-rose-600 tracking-tight truncate tabular-nums">
            ฿{formatCurrency(financialSummary.totalExpenses)}
          </p>
          <div className="mt-2 pt-2 border-t border-slate-50 text-[11px] text-slate-500 font-medium flex justify-between items-center">
            <span>ต้นทุนต่องาน:</span>
            <span className="text-rose-600 font-bold shrink-0">
              {financialSummary.totalQuotation > 0
                ? `${((financialSummary.totalExpenses / financialSummary.totalQuotation) * 100).toFixed(1)}%`
                : '0%'}
            </span>
          </div>
        </div>

        {/* Card 4: กำไรคงเหลือสุทธิ (Hero Card) */}
        <div className="bg-gradient-to-br from-white via-white to-emerald-50/40 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-emerald-200/80 shadow-[0_2px_12px_rgb(16,185,129,0.08)] hover:shadow-md transition flex flex-col justify-between group">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-xs font-bold text-emerald-800">คงเหลือสุทธิ (กำไร)</span>
            <div className="p-1.5 sm:p-2 bg-emerald-600 text-white rounded-xl group-hover:scale-110 transition-transform shadow-sm">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <p className="text-base sm:text-2xl font-black text-emerald-700 tracking-tight truncate tabular-nums">
            ฿{formatCurrency(financialSummary.totalProfit)}
          </p>
          <div className="mt-2 pt-2 border-t border-emerald-100/60 text-[11px] text-emerald-800 font-semibold flex justify-between items-center">
            <span>Margin สุทธิ:</span>
            <span className="font-bold text-emerald-700 bg-emerald-100/60 px-1.5 py-0.5 rounded-md">{financialSummary.netMarginPercent}%</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          FILTER TOOLBAR (Clean, Modern, Unified Mobile & Desktop Filter)
         ========================================================================= */}
      <div ref={filterSentinelRef} className="h-px w-full pointer-events-none opacity-0 -mb-px" />
      <div 
        className={`no-print bg-white transition-all duration-200 ease-in-out z-40 sticky top-[calc(56px+env(safe-area-inset-top,0px))] md:top-0
          ${isFilterStuck
            ? '-mx-4 sm:-mx-8 lg:-mx-10 mt-0 py-2.5 sm:py-3 px-4 sm:px-8 lg:px-10 border-b border-slate-100 shadow-sm rounded-b-[2rem] sm:rounded-b-3xl rounded-t-none mb-4'
            : 'mt-2 sm:mt-3 p-3.5 sm:p-5 rounded-[2rem] sm:rounded-3xl border border-slate-100 shadow-[0_2px_12px_rgb(0,0,0,0.03)] mb-4'
          }
        `}
      >
        {/* --- MOBILE FILTER LAYOUT (Clean, Compact, No Clutter) --- */}
        <div className="flex flex-col gap-2.5 md:hidden">
          {/* Row 1: Search + Filter Toggle + Reset */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 bg-slate-50 border border-slate-200/70 rounded-xl h-10 flex items-center hover:bg-slate-100/60 focus-within:bg-white focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="ค้นหา..."
                className="w-full h-full pl-9 pr-8 bg-transparent outline-none text-slate-700 text-xs sm:text-sm font-medium placeholder:text-slate-400 rounded-xl"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md"
                  title="ล้างข้อความค้นหา"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* ปุ่มเปิด/ซ่อนตัวกรอง (Icon Only) */}
            <button
              type="button"
              onClick={() => setIsMobileFilterExpanded(!isMobileFilterExpanded)}
              className={`h-10 w-10 rounded-xl font-bold transition-all flex items-center justify-center shrink-0 active:scale-95 border ${
                isMobileFilterExpanded 
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200' 
                  : 'bg-slate-50 text-slate-600 border-slate-200/70 hover:bg-slate-100'
              }`}
              title={isMobileFilterExpanded ? "ซ่อนตัวกรอง" : "เปิดตัวกรองเพิ่มเติม"}
              aria-label="ตัวกรอง"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            {/* ปุ่มรีเซ็ตฟิลเตอร์ */}
            <button
              onClick={handleResetFilters}
              className="h-10 w-10 bg-slate-50 border border-slate-200/70 text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 rounded-xl font-bold transition-all flex items-center justify-center shrink-0 active:scale-95"
              title="ล้างค่าตัวกรองทั้งหมด"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* แผงฟิลเตอร์เมื่อกดเปิด (Mobile Drawer) */}
          {isMobileFilterExpanded && (
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 animate-in slide-in-from-top-2 fade-in duration-200">
              {/* 1. ตัวเลือกช่วงวันที่ (Full Width) */}
              <div className="w-full h-10">
                <DateFilterControl
                  mode={dateFilterMode}
                  setMode={setDateFilterMode}
                  date={filterDate}
                  setDate={setFilterDate}
                  range={filterDateRange}
                  setRange={setFilterDateRange}
                />
              </div>

              {/* 2. Grid 2 คอลัมน์: สถานะการชำระ + สลับเรียงลำดับ */}
              <div className="grid grid-cols-2 gap-2">
                {/* สถานะการชำระ Mobile */}
                <div className="relative bg-slate-50 border border-slate-200/70 rounded-xl h-10 flex items-center hover:border-slate-300 transition-colors">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Wallet className="w-3.5 h-3.5" />
                  </div>
                  <select
                    value={paymentStatusFilter}
                    onChange={(e) => setPaymentStatusFilter(e.target.value)}
                    className="w-full h-full pl-8 pr-6 bg-transparent outline-none text-slate-700 text-xs font-bold appearance-none cursor-pointer rounded-xl"
                  >
                    <option value="all">สถานะ: ทั้งหมด</option>
                    <option value="paid">ชำระครบแล้ว</option>
                    <option value="deposit">มัดจำแล้ว</option>
                    <option value="unpaid">รอชำระเงิน</option>
                    <option value="refunded">คืนเงิน/ยกเลิก</option>
                  </select>
                  <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {/* เรียงลำดับ Mobile */}
                <button
                  onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                  className="h-10 px-3 bg-slate-50 border border-slate-200/70 rounded-xl text-xs font-bold text-slate-600 flex items-center justify-between hover:border-slate-300 transition-colors active:scale-95"
                  title={sortOrder === 'desc' ? 'เรียงล่าสุดก่อน' : 'เรียงเก่าสุดก่อน'}
                >
                  <div className="flex items-center gap-1.5">
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    <span>เรียง:</span>
                  </div>
                  <span className="text-indigo-600 font-bold">{sortOrder === 'desc' ? 'ล่าสุด' : 'เก่าสุด'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* --- DESKTOP FILTER LAYOUT (เหมือนหน้ารายการแผนงาน แบบ 2 แถวสูง 48px) --- */}
        <div className="hidden md:flex flex-col gap-3">
          {/* แถวที่ 1: ค้นหา + ตัวเลือกวันที่ */}
          <div className="flex gap-3 h-[48px]">
            {/* กล่องค้นหา Desktop */}
            <div className="relative flex-[2] bg-slate-50 border border-slate-200/70 rounded-2xl hover:border-indigo-300 focus-within:bg-white focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all shadow-xs">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <Search className="w-5 h-5" />
              </div>
              <input
                type="text"
                placeholder="ค้นหารหัส, ชื่องาน, ลูกค้า, ศิลปิน..."
                className="w-full h-full pl-12 pr-10 bg-transparent outline-none text-slate-700 text-sm font-medium placeholder:text-slate-400 rounded-2xl"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 p-1 rounded-md"
                  title="ล้างข้อความค้นหา"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* เลือกวันที่ Desktop */}
            <div className="flex-1 min-w-[300px]">
              <DateFilterControl
                mode={dateFilterMode}
                setMode={setDateFilterMode}
                date={filterDate}
                setDate={setFilterDate}
                range={filterDateRange}
                setRange={setFilterDateRange}
              />
            </div>
          </div>

          {/* แถวที่ 2: สถานะการชำระ + สลับเรียงลำดับ + ปุ่มรีเซ็ตตัวกรอง */}
          <div className="flex gap-3 h-[48px]">
            {/* สถานะการชำระ Dropdown */}
            <div className="relative flex-1 bg-slate-50 border border-slate-200/70 rounded-2xl hover:border-indigo-300 transition-colors shadow-xs group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-indigo-500 transition-colors">
                <Wallet className="w-4 h-4" />
              </div>
              <select
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                className="w-full h-full pl-11 pr-8 bg-transparent outline-none text-slate-700 text-sm font-bold appearance-none cursor-pointer rounded-2xl"
              >
                <option value="all">สถานะการชำระ: ทั้งหมด</option>
                <option value="paid">ชำระครบแล้ว</option>
                <option value="deposit">มัดจำแล้ว</option>
                <option value="unpaid">รอชำระเงิน</option>
                <option value="refunded">คืนเงิน/ยกเลิก</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* สลับการเรียงลำดับ Sort Toggle Button */}
            <button
              onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              className="relative flex-1 bg-slate-50 border border-slate-200/70 rounded-2xl hover:border-indigo-300 transition-colors shadow-xs px-4 flex items-center justify-between cursor-pointer group"
              title={sortOrder === 'desc' ? 'เรียงล่าสุดก่อน' : 'เรียงเก่าสุดก่อน'}
            >
              <div className="flex items-center gap-2.5">
                <ArrowUpDown className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                <span className="text-sm font-bold text-slate-700">การเรียงลำดับ</span>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 bg-white border border-slate-200/80 rounded-md text-slate-600">
                {sortOrder === 'desc' ? 'ล่าสุดก่อน' : 'เก่าสุดก่อน'}
              </span>
            </button>

            {/* ปุ่มรีเซ็ตฟิลเตอร์ Desktop */}
            <button
              onClick={handleResetFilters}
              className="px-5 bg-slate-50 border border-slate-200/70 text-slate-500 rounded-2xl font-bold hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors flex items-center justify-center shadow-xs shrink-0"
              title="ล้างค่าตัวกรองทั้งหมด"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          VIEW 1: ACCOUNTING SHEET VIEW (ตารางกำไรขาดทุนตามรูปถ่าย)
         ========================================================================= */}
      {viewMode === 'sheet' && (
        <div className="print-area bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden p-4 sm:p-6">
          {/* Printable Document Header (Shows clearly in Print & Screen) */}
          <div className="mb-4 text-center sm:text-left flex flex-col sm:flex-row justify-between items-center pb-3 border-b border-slate-200">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                บันทึกข้อมูลกำไรขาดทุน
              </h1>
              <p className="text-xs text-slate-600 font-semibold mt-0.5">
                {shopInfo.shopName || 'Flower2U'} {shopInfo.phone ? `| โทร. ${shopInfo.phone}` : ''}
              </p>
            </div>
            <div className="text-xs text-slate-500 font-medium text-right mt-2 sm:mt-0">
              <p>วันที่พิมพ์: {new Date().toLocaleDateString('th-TH')}</p>
              <p>รายการทั้งหมด: {processedData.length} รายการ</p>
            </div>
          </div>

          {/* View / Print Detail Mode Selector (Compact vs Detailed) */}
          <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2.5 bg-slate-50/90 p-2 sm:p-2.5 rounded-2xl border border-slate-200/80">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>รูปแบบตารางและการพิมพ์:</span>
            </div>
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200/80 shadow-xs">
              <button
                type="button"
                onClick={() => handleDetailModeChange('compact')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  tableDetailMode === 'compact'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span>📄 สรุปย่อ (ประหยัดกระดาษ)</span>
              </button>
              <button
                type="button"
                onClick={() => handleDetailModeChange('detailed')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  tableDetailMode === 'detailed'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span>📑 ละเอียด (ดีเทล)</span>
              </button>
            </div>
          </div>

          {/* Mobile View Toggle: Card View vs Full Table */}
          <div className="no-print md:hidden mb-4 flex items-center justify-between gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              onClick={() => handleMobileLayoutChange('card')}
              className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 ${
                mobileSheetLayout === 'card'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>การ์ด</span>
            </button>
            <button
              onClick={() => handleMobileLayoutChange('table')}
              className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 ${
                mobileSheetLayout === 'table'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>ตาราง</span>
            </button>
          </div>

          {/* Mobile Card View (Easy reading on phones) */}
          {isMobileScreen && mobileSheetLayout === 'card' && (
            <div className="no-print space-y-3 mb-4">
              {/* List of Mobile Ledger Cards */}
              {processedData.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 font-medium text-xs">
                  ไม่พบข้อมูลบันทึกกำไรขาดทุนตามเงื่อนไขที่เลือก
                </div>
              ) : (
                visibleSheetData.map((item, index) => {
                const hasQuotation = item.quotationItems && item.quotationItems.length > 0;
                const qTotal = item._qTotal;
                const hasSupport = item.customerSupport && item.customerSupport.length > 0;
                const sTotal = item._sTotal;
                const hasExpenses = item.expenses && item.expenses.length > 0;
                const eTotal = item._eTotal;
                const netBalance = item._profit;
                const displayProjectDate = item._dateFormatted;
                const itemTransfer = item._transfer;

                return (
                  <div
                    key={item.id || index}
                    style={{ contentVisibility: 'auto', containIntrinsicSize: '0 80px' }}
                    className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs space-y-3"
                  >
                    {/* Header: Date + Project ID + Net badge */}
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-black bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md">
                          {displayProjectDate}
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-600">
                          {item.id}
                        </span>
                      </div>
                      <span className={`text-xs font-black px-2 py-0.5 rounded-md tabular-nums ${
                        netBalance >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {netBalance >= 0 ? '+' : ''}฿{formatCurrency(netBalance)}
                      </span>
                    </div>

                    {/* Project Title & Client/Artist */}
                    <div>
                      <h4 className="text-sm font-black text-slate-900 leading-snug">{item.name || 'ไม่มีชื่องาน'}</h4>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                        {item.customer && <span>ลูกค้า: <strong className="text-slate-700">{item.customer}</strong></span>}
                        {item.customer && item.artist && <span>•</span>}
                        {item.artist && <span>ศิลปิน: <strong className="text-slate-700">{item.artist}</strong></span>}
                      </div>
                    </div>

                    {/* Breakdown items (3 categories) */}
                    <div className="space-y-2 text-xs bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                      {/* 1. เงินสนับสนุน */}
                      <div>
                        <div className="flex items-center justify-between font-bold text-slate-800 text-[11px]">
                          <span>1. เงินสนับสนุนศิลปิน (Money Order)</span>
                          <span className="text-indigo-600 tabular-nums">{sTotal > 0 ? `฿${formatCurrency(sTotal)}` : '-'}</span>
                        </div>
                        {hasSupport && sTotal > 0 ? (
                          <div className="mt-1 space-y-0.5 pl-2 border-l-2 border-indigo-200">
                            {item.customerSupport.map((sup, sIdx) => {
                              const supDate = formatItemDate(sup.date || item.paymentDate || item.rawDateTime || item.date);
                              const denomText = sup.denomination >= 20 ? `แบงค์ ${sup.denomination}บ.` : `เหรียญ ${sup.denomination}บ.`;
                              return (
                                <p key={sIdx} className="text-[11px] text-slate-600">
                                  -{denomText} x {sup.quantity}ใบ = {formatCurrency(sup.price)}บ. {supDate ? `(${supDate})` : ''}
                                  {sup.detail ? ` ${sup.detail}` : ''}
                                </p>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 pl-2 italic">ไม่มีรายการ</p>
                        )}
                      </div>

                      {/* 2. รายการเสนอราคา */}
                      <div className="pt-1.5 border-t border-slate-200/60">
                        <div className="flex items-center justify-between font-bold text-slate-800 text-[11px]">
                          <span>2. รายการเสนอราคา (Quotation)</span>
                          <span className="text-emerald-700 tabular-nums">{qTotal > 0 ? `฿${formatCurrency(qTotal)}` : '-'}</span>
                        </div>
                        {hasQuotation ? (
                          <div className="mt-1 space-y-0.5 pl-2 border-l-2 border-emerald-200">
                            {item.quotationItems.map((quote, qIdx) => {
                              const qDate = formatItemDate(quote.date || item.paymentDate || item.rawDateTime || item.date);
                              const qLabel = quote.category ? `[${quote.category}] ` : '';
                              return (
                                <p key={qIdx} className="text-[11px] text-slate-600">
                                  -{qLabel}{quote.detail || 'รายการงาน'} {formatCurrency(quote.price)}บ. {qDate ? `(${qDate})` : ''}
                                </p>
                              );
                            })}
                          </div>
                        ) : qTotal > 0 ? (
                          <p className="text-[11px] text-slate-600 pl-2">
                            -ค่าจ้าง/บริการ {formatCurrency(qTotal)}บ.
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-400 pl-2 italic">ไม่มีรายการ</p>
                        )}
                      </div>

                      {/* 3. รายจ่ายจริง */}
                      <div className="pt-1.5 border-t border-slate-200/60">
                        <div className="flex items-center justify-between font-bold text-slate-800 text-[11px]">
                          <span>3. รายจ่ายจริง / ต้นทุนเพิ่ม (Expenses)</span>
                          <span className="text-rose-600 tabular-nums">{eTotal > 0 ? `฿${formatCurrency(eTotal)}` : '-'}</span>
                        </div>
                        {hasExpenses && eTotal > 0 ? (
                          <div className="mt-1 space-y-0.5 pl-2 border-l-2 border-rose-200">
                            {item.expenses.map((exp, eIdx) => {
                              const expDate = formatItemDate(exp.date || item.paymentDate || item.rawDateTime || item.date);
                              const expLabel = exp.category ? `[${exp.category}] ` : '';
                              return (
                                <p key={eIdx} className="text-[11px] text-slate-600">
                                  -{expLabel}{exp.detail || 'ค่าใช้จ่าย'} {exp.quantity > 1 ? `${exp.quantity}หน่วย ` : ''}{formatCurrency(exp.price)}บ. {expDate ? `(${expDate})` : ''}
                                </p>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 pl-2 italic">ไม่มีรายการ</p>
                        )}
                      </div>
                    </div>

                    {/* Summary 5-Column Strip for this item */}
                    <div className="grid grid-cols-5 gap-1 pt-2 border-t border-slate-100 text-center">
                      <div className="bg-slate-50 p-1 rounded-lg">
                        <span className="text-[9px] text-slate-400 block font-medium truncate">ยอดโอน</span>
                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-800 tabular-nums">{itemTransfer > 0 ? formatCurrency(itemTransfer) : '-'}</span>
                      </div>
                      <div className="bg-slate-50 p-1 rounded-lg">
                        <span className="text-[9px] text-slate-400 block font-medium truncate">เงินศิลปิน</span>
                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-800 tabular-nums">{sTotal > 0 ? formatCurrency(sTotal) : '-'}</span>
                      </div>
                      <div className="bg-slate-50 p-1 rounded-lg">
                        <span className="text-[9px] text-slate-400 block font-medium truncate">รายรับ</span>
                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-800 tabular-nums">{qTotal > 0 ? formatCurrency(qTotal) : '-'}</span>
                      </div>
                      <div className="bg-slate-50 p-1 rounded-lg">
                        <span className="text-[9px] text-slate-400 block font-medium truncate">รายจ่าย</span>
                        <span className="text-[10px] sm:text-[11px] font-bold text-rose-600 tabular-nums">{eTotal > 0 ? formatCurrency(eTotal) : '-'}</span>
                      </div>
                      <div className="bg-emerald-50/70 p-1 rounded-lg border border-emerald-100">
                        <span className="text-[9px] text-emerald-800 block font-bold truncate">กำไร/ขาดทุน</span>
                        <span className="text-[10px] sm:text-[11px] font-black text-emerald-700 tabular-nums">{formatCurrency(netBalance)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {visibleCount < processedData.length && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount(prev => prev + 35)}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  โหลดเพิ่มเติม (แสดง {visibleSheetData.length} จาก {processedData.length} รายการ)
                </button>
              </div>
            )}
          </div>
          )}

          {/* Table Container (Shows on desktop or when mobile user switches to full table, always prints) */}
          {(!isMobileScreen || mobileSheetLayout === 'table') && (
            <div className="table-container-for-print overflow-x-auto -mx-2 sm:mx-0">
              <table className="accounting-print-table w-full border-collapse border border-slate-300 text-xs sm:text-sm min-w-[760px]">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold">
                  <th className="border border-slate-300 px-3 py-2.5 text-center w-24 sm:w-28">วันที่</th>
                  <th className="border border-slate-300 px-4 py-2.5 text-center">รายการ</th>
                  <th className="border border-slate-300 px-3 py-2.5 text-right w-20 sm:w-24">ยอดโอน</th>
                  <th className="border border-slate-300 px-3 py-2.5 text-right w-20 sm:w-24">เงินศิลปิน</th>
                  <th className="border border-slate-300 px-3 py-2.5 text-right w-20 sm:w-24 bg-emerald-50/70 text-emerald-800 font-bold">รายรับ</th>
                  <th className="border border-slate-300 px-3 py-2.5 text-right w-20 sm:w-24 bg-rose-50/70 text-rose-800 font-bold">รายจ่าย</th>
                  <th className="border border-slate-300 px-3 py-2.5 text-right w-24 sm:w-28 bg-[#ceead6] text-[#0d652d] font-bold">กำไร/ขาดทุน</th>
                </tr>
              </thead>
              <tbody>
                {processedData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400 font-medium border border-slate-300">
                      ไม่พบข้อมูลบันทึกกำไรขาดทุนตามเงื่อนไขที่เลือก
                    </td>
                  </tr>
                ) : (
                  visibleSheetData.map((item, index) => {
                    // Precomputed Item Metrics
                    const hasQuotation = item.quotationItems && item.quotationItems.length > 0;
                    const qTotal = item._qTotal;
                    const hasSupport = item.customerSupport && item.customerSupport.length > 0;
                    const sTotal = item._sTotal;
                    const hasExpenses = item.expenses && item.expenses.length > 0;
                    const eTotal = item._eTotal;
                    const netBalance = item._profit;
                    const itemTransfer = item._transfer;
                    const displayProjectDate = item._dateFormatted;
                    const clientInfo = `ลูกค้า: ${item.customer || '-'} • ศิลปิน: ${item.artist || '-'}`;
                    const isCompact = tableDetailMode === 'compact';

                    return (
                      <tr
                        key={item.id || index}
                        style={{ contentVisibility: 'auto', containIntrinsicSize: '0 54px' }}
                        className="align-top hover:bg-slate-50/50 transition"
                      >
                        {/* 1. วันที่ */}
                        <td className={`border-x border-slate-300 border-b border-dashed border-slate-400 px-3 ${isCompact ? 'py-2' : 'py-3'} text-center font-bold text-slate-800 whitespace-nowrap`}>
                          {displayProjectDate}
                        </td>

                        {/* 2. รายการ */}
                        <td className={`border-x border-slate-300 border-b border-dashed border-slate-400 px-4 ${isCompact ? 'py-2' : 'py-3'} text-slate-800`}>
                          {/* รหัสงาน & ชื่อ */}
                          <div className="font-black text-slate-900 leading-snug">
                            {item.id} {item.name ? `- ${item.name}` : ''}
                          </div>
                          <div className="no-print text-[11px] font-normal text-slate-400 mt-0.5 leading-tight">
                            {clientInfo}
                          </div>

                          {/* 3 หมวดย่อย (แสดงเฉพาะเมื่อเลือกแบบละเอียด) */}
                          {!isCompact && (
                            <div className="mt-2 space-y-2 border-t border-slate-100 pt-1.5">
                              {/* 1. เงินสนับสนุนศิลปิน (Money Order) */}
                              <div className="space-y-0.5">
                                <p className="font-bold text-slate-900 text-xs">
                                  1.เงินสนับสนุนศิลปิน (Money Order)
                                </p>
                                {hasSupport && sTotal > 0 ? (
                                  item.customerSupport.map((sup, sIdx) => {
                                    const supDate = formatItemDate(sup.date || item.paymentDate || item.rawDateTime || item.date);
                                    const denomText = sup.denomination >= 20 ? `แบงค์ ${sup.denomination}บาท` : `เหรียญ ${sup.denomination}บาท`;
                                    return (
                                      <p key={sIdx} className="text-xs text-slate-700 pl-3">
                                        -{denomText} x {sup.quantity}ใบ = {formatCurrency(sup.price)}บาท {supDate ? `- ${supDate}` : ''}
                                        {sup.detail ? ` (${sup.detail})` : ''}
                                      </p>
                                    );
                                  })
                                ) : (
                                  <p className="text-xs text-slate-400 pl-3 italic">-ไม่มีรายการสนับสนุน</p>
                                )}
                              </div>

                              {/* 2. รายการเสนอราคา (Quotation) */}
                              <div className="space-y-0.5">
                                <p className="font-bold text-slate-900 text-xs">
                                  2.รายการเสนอราคา (Quotation)
                                </p>
                                {hasQuotation ? (
                                  item.quotationItems.map((quote, qIdx) => {
                                    const qDate = formatItemDate(quote.date || item.paymentDate || item.rawDateTime || item.date);
                                    const qLabel = quote.category ? `[${quote.category}] ` : '';
                                    const qDetail = quote.detail || 'รายการงาน';
                                    return (
                                      <p key={qIdx} className="text-xs text-slate-700 pl-3">
                                        -{qLabel}{qDetail} {formatCurrency(quote.price)}บาท {qDate ? `- ${qDate}` : ''}
                                      </p>
                                    );
                                  })
                                ) : qTotal > 0 ? (
                                  <p className="text-xs text-slate-700 pl-3">
                                    -ค่าจ้าง/บริการ {formatCurrency(qTotal)}บาท {displayProjectDate ? `- ${displayProjectDate}` : ''}
                                  </p>
                                ) : (
                                  <p className="text-xs text-slate-400 pl-3 italic">-ไม่มีรายการเสนอราคา</p>
                                )}
                              </div>

                              {/* 3. รายจ่ายจริง / ต้นทุนเพิ่ม (Expenses) */}
                              <div className="space-y-0.5">
                                <p className="font-bold text-slate-900 text-xs">
                                  3.รายจ่ายจริง / ต้นทุนเพิ่ม (Expenses)
                                </p>
                                {hasExpenses && eTotal > 0 ? (
                                  item.expenses.map((exp, eIdx) => {
                                    const expDate = formatItemDate(exp.date || item.paymentDate || item.rawDateTime || item.date);
                                    const expLabel = exp.category ? `[${exp.category}] ` : '';
                                    const expDetail = exp.detail || 'ค่าใช้จ่าย';
                                    return (
                                      <p key={eIdx} className="text-xs text-slate-700 pl-3">
                                        -{expLabel}{expDetail} {exp.quantity > 1 ? `${exp.quantity} หน่วย ` : ''}{formatCurrency(exp.price)} บาท {expDate ? `- ${expDate}` : ''}
                                      </p>
                                    );
                                  })
                                ) : (
                                  <p className="text-xs text-slate-400 pl-3 italic">-ไม่มีรายการค่าใช้จ่ายจริง</p>
                                )}
                              </div>
                            </div>
                          )}
                        </td>

                        {/* 3. ยอดโอน */}
                        <td className={`border-x border-slate-300 border-b border-dashed border-slate-400 px-3 ${isCompact ? 'py-2' : 'py-3'} text-right font-bold text-slate-900 tabular-nums`}>
                          {itemTransfer > 0 ? formatCurrency(itemTransfer) : '-'}
                        </td>

                        {/* 4. เงินศิลปิน */}
                        <td className={`border-x border-slate-300 border-b border-dashed border-slate-400 px-3 ${isCompact ? 'py-2' : 'py-3'} text-right font-bold text-slate-900 tabular-nums`}>
                          {sTotal > 0 ? formatCurrency(sTotal) : '-'}
                        </td>

                        {/* 5. รายรับ (เฉพาะค่าจ้าง ไม่รวมเงินสนับสนุนศิลปิน) */}
                        <td className={`border-x border-slate-300 border-b border-dashed border-slate-400 px-3 ${isCompact ? 'py-2' : 'py-3'} text-right font-bold text-emerald-700 bg-emerald-50/30 tabular-nums`}>
                          {qTotal > 0 ? formatCurrency(qTotal) : '-'}
                        </td>

                        {/* 6. รายจ่าย */}
                        <td className={`border-x border-slate-300 border-b border-dashed border-slate-400 px-3 ${isCompact ? 'py-2' : 'py-3'} text-right font-bold text-rose-600 bg-rose-50/30 tabular-nums`}>
                          {eTotal > 0 ? formatCurrency(eTotal) : '-'}
                        </td>

                        {/* 7. กำไร/ขาดทุน */}
                        <td className={`border-x border-slate-300 border-b border-dashed border-slate-400 px-3 ${isCompact ? 'py-2' : 'py-3'} text-right font-black tabular-nums ${netBalance >= 0 ? 'bg-[#e6f4ea] text-[#137333]' : 'bg-[#fce8e6] text-[#c5221f]'}`}>
                          {formatCurrency(netBalance)}
                        </td>
                      </tr>
                    );
                  })
                )}

                {visibleCount < processedData.length && (
                  <tr className="no-print">
                    <td colSpan={7} className="text-center py-3 bg-slate-50 border border-slate-300">
                      <button
                        type="button"
                        onClick={() => setVisibleCount(prev => prev + 35)}
                        className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 transition cursor-pointer shadow-2xs"
                      >
                        โหลดเพิ่มเติม (แสดง {visibleSheetData.length} จาก {processedData.length} รายการ)
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>

              {/* Grand Total Summary Row */}
              <tfoot>
                <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-400 text-xs sm:text-sm">
                  <td colSpan={2} className="border border-slate-300 px-4 py-3 text-center">
                    ยอดรวมสุทธิ (Grand Total)
                  </td>
                  <td className="border border-slate-300 px-3 py-3 text-right tabular-nums text-slate-900">
                    ฿{formatCurrency(financialSummary.totalTransfers)}
                  </td>
                  <td className="border border-slate-300 px-3 py-3 text-right tabular-nums text-slate-900">
                    ฿{formatCurrency(financialSummary.totalSupport)}
                  </td>
                  <td className="border border-slate-300 px-3 py-3 text-right tabular-nums text-emerald-800 bg-emerald-100/50 font-bold">
                    ฿{formatCurrency(financialSummary.totalRevenue)}
                  </td>
                  <td className="border border-slate-300 px-3 py-3 text-right tabular-nums text-rose-800 bg-rose-100/50 font-bold">
                    ฿{formatCurrency(financialSummary.totalExpenses)}
                  </td>
                  <td className={`border border-slate-300 px-3 py-3 text-right tabular-nums font-black ${financialSummary.totalProfit >= 0 ? 'bg-[#b7e1cd] text-[#0d652d]' : 'bg-[#fad2cf] text-[#b31412]'}`}>
                    ฿{formatCurrency(financialSummary.totalProfit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          )}
        </div>
      )}

      {/* =========================================================================
          VIEW 2: INTERACTIVE DASHBOARD VIEW (มุมมองบัตรงานบนหน้าจอ)
         ========================================================================= */}
      {viewMode === 'dashboard' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100">
              <h3 className="text-base sm:text-xl lg:text-2xl font-black text-slate-900 flex items-center gap-2.5">
                <BarChart2 className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
                <span>รายการงานและการเงิน ({processedData.length} รายการ)</span>
              </h3>

              {/* Quick Actions: Toggle expand all */}
              {processedData.length > 0 && (
                <button
                  onClick={() => {
                    const allExpanded = processedData.every(item => expandedRows[item.id]);
                    if (allExpanded) {
                      setExpandedRows({});
                    } else {
                      const all = {};
                      processedData.forEach(item => { all[item.id] = true; });
                      setExpandedRows(all);
                    }
                  }}
                  className="self-start sm:self-auto text-xs sm:text-sm lg:text-base font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100/70 px-3.5 sm:px-4 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <LayoutList className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                  <span>
                    {processedData.every(item => expandedRows[item.id])
                      ? 'ย่อรายละเอียดทั้งหมด'
                      : 'ขยายรายละเอียดทั้งหมด'}
                  </span>
                </button>
              )}
            </div>

            <div className="space-y-4 sm:space-y-5">
              {processedData.length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-medium text-xs sm:text-base">
                  ไม่พบงานตามเงื่อนไขที่เลือก
                </div>
              ) : (
                visibleDashboardData.map((item) => {
                  const hasQuotation = item.quotationItems && item.quotationItems.length > 0;
                  const qTotal = item._qTotal;
                  const hasSupport = item.customerSupport && item.customerSupport.length > 0;
                  const sTotal = item._sTotal;
                  const hasExpenses = item.expenses && item.expenses.length > 0;
                  const eTotal = item._eTotal;
                  const profit = item._profit;
                  const isExpanded = !!expandedRows[item.id];
                  const paymentStatus = item._paymentStatus;
                  const displayDate = item._dateFormatted;

                  return (
                    <div
                      key={item.id}
                      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 120px' }}
                      className="border border-slate-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-7 hover:border-indigo-200 hover:shadow-lg transition-all duration-200 bg-white"
                    >
                      {/* --- ROW 1: Header (ID + Title + Status + Action) --- */}
                      <div className="flex items-start justify-between gap-3 sm:gap-4">
                        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
                          <span className="shrink-0 px-2.5 py-1 sm:px-3.5 sm:py-1.5 bg-slate-100 text-slate-700 font-mono font-black text-xs sm:text-sm lg:text-base rounded-xl border border-slate-200/70">
                            {item.id}
                          </span>
                          <h4 className="font-black text-slate-900 text-sm sm:text-lg lg:text-xl truncate leading-snug" title={item.name}>
                            {item.name || 'ไม่มีชื่องาน'}
                          </h4>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                          {/* Payment Status Pill */}
                          <span className={`px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-[11px] sm:text-xs lg:text-sm font-bold border whitespace-nowrap ${
                            paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70' :
                            paymentStatus === 'deposit' ? 'bg-sky-50 text-sky-700 border-sky-200/70' :
                            paymentStatus === 'refunded' ? 'bg-rose-50 text-rose-700 border-rose-200/70' :
                            'bg-amber-50 text-amber-700 border-amber-200/70'
                          }`}>
                            {paymentStatus === 'paid' ? 'ชำระครบแล้ว' :
                             paymentStatus === 'deposit' ? `มัดจำ ฿${formatCurrency(item.depositAmount)}` :
                             paymentStatus === 'refunded' ? 'คืนเงิน/ยกเลิก' : 'รอชำระเงิน'}
                          </span>

                          {/* Quick Edit Button */}
                          {onOpenProjectModal && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onOpenProjectModal(item, false); }}
                              className="w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition active:scale-95 cursor-pointer"
                              title="แก้ไขงาน"
                            >
                              <SlidersHorizontal className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* --- ROW 2: Metadata (Date, Customer, Artist) --- */}
                      <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-6 gap-y-1.5 mt-2 sm:mt-3 text-xs sm:text-sm lg:text-base text-slate-500 font-medium">
                        {displayDate && (
                          <span className="flex items-center gap-1.5 sm:gap-2 text-slate-600">
                            <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-slate-400 shrink-0" />
                            <span>{displayDate}</span>
                          </span>
                        )}
                        {item.customer && (
                          <span className="flex items-center gap-1.5 sm:gap-2 truncate max-w-[200px] sm:max-w-none">
                            <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-slate-400 shrink-0" />
                            <span className="text-slate-400">ลูกค้า:</span>
                            <strong className="text-slate-700 font-bold truncate">{item.customer}</strong>
                          </span>
                        )}
                        {item.artist && (
                          <span className="flex items-center gap-1.5 sm:gap-2 truncate max-w-[200px] sm:max-w-none">
                            <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-slate-400 shrink-0" />
                            <span className="text-slate-400">ศิลปิน:</span>
                            <strong className="text-slate-700 font-bold truncate">{item.artist}</strong>
                          </span>
                        )}
                      </div>

                      {/* --- ROW 3: Financial 4-Step Metric Strip (The Financial Equation: Revenue -> Support -> Expenses = Profit) --- */}
                      <div className="mt-3.5 sm:mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 lg:gap-3.5 text-left">
                        {/* 1. รายรับ (Quotation) */}
                        <div className="bg-slate-50/80 p-3 sm:p-3.5 lg:p-4 rounded-xl sm:rounded-2xl border border-slate-100 flex flex-col justify-between">
                          <span className="text-xs sm:text-sm lg:text-base font-bold text-slate-500 block truncate">
                            1. รายรับ (ค่าจ้าง)
                          </span>
                          <span className="text-base sm:text-lg md:text-xl xl:text-2xl font-black text-slate-900 tracking-tight tabular-nums mt-1 sm:mt-1.5">
                            ฿{formatCurrency(qTotal)}
                          </span>
                          <span className="text-[11px] sm:text-xs lg:text-sm text-slate-400 font-medium truncate mt-1">
                            {hasQuotation ? `${item.quotationItems.length} รายการ` : 'ค่าจ้างรวม'}
                          </span>
                        </div>

                        {/* 2. เงินส่งต่อศิลปิน (Support) */}
                        <div className="bg-indigo-50/40 p-3 sm:p-3.5 lg:p-4 rounded-xl sm:rounded-2xl border border-indigo-100/70 flex flex-col justify-between">
                          <span className="text-xs sm:text-sm lg:text-base font-bold text-indigo-700 block truncate">
                            2. ส่งต่อศิลปิน
                          </span>
                          <span className="text-base sm:text-lg md:text-xl xl:text-2xl font-black text-indigo-700 tracking-tight tabular-nums mt-1 sm:mt-1.5">
                            {sTotal > 0 ? `฿${formatCurrency(sTotal)}` : '-'}
                          </span>
                          <span className="text-[11px] sm:text-xs lg:text-sm text-indigo-400 font-medium truncate mt-1">
                            {sTotal > 0 ? `${item.customerSupport?.length || 0} รายการ` : 'ไม่มียอดส่งต่อ'}
                          </span>
                        </div>

                        {/* 3. รายจ่ายจริง (Expenses) */}
                        <div className="bg-rose-50/40 p-3 sm:p-3.5 lg:p-4 rounded-xl sm:rounded-2xl border border-rose-100/70 flex flex-col justify-between">
                          <span className="text-xs sm:text-sm lg:text-base font-bold text-rose-700 block truncate">
                            3. รายจ่ายจริง
                          </span>
                          <span className="text-base sm:text-lg md:text-xl xl:text-2xl font-black text-rose-600 tracking-tight tabular-nums mt-1 sm:mt-1.5">
                            {eTotal > 0 ? `฿${formatCurrency(eTotal)}` : '-'}
                          </span>
                          <span className="text-[11px] sm:text-xs lg:text-sm text-rose-400 font-medium truncate mt-1">
                            {eTotal > 0 ? `${item.expenses?.length || 0} รายการ` : 'ไม่มีต้นทุนเพิ่ม'}
                          </span>
                        </div>

                        {/* 4. คงเหลือสุทธิ (Net Margin / Hero Pill) */}
                        <div className={`p-3 sm:p-3.5 lg:p-4 rounded-xl sm:rounded-2xl border flex flex-col justify-between ${
                          profit >= 0
                            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900 shadow-xs'
                            : 'bg-rose-50/80 border-rose-200 text-rose-900 shadow-xs'
                        }`}>
                          <span className={`text-xs sm:text-sm lg:text-base font-bold block truncate ${
                            profit >= 0 ? 'text-emerald-800' : 'text-rose-800'
                          }`}>
                            4. กำไรสุทธิ
                          </span>
                          <span className={`text-base sm:text-lg md:text-xl xl:text-2xl font-black tracking-tight tabular-nums mt-1 sm:mt-1.5 ${
                            profit >= 0 ? 'text-emerald-700' : 'text-rose-600'
                          }`}>
                            {profit >= 0 ? '+' : ''}฿{formatCurrency(profit)}
                          </span>
                          <span className={`text-[11px] sm:text-xs lg:text-sm font-semibold truncate mt-1 ${
                            profit >= 0 ? 'text-emerald-600' : 'text-rose-500'
                          }`}>
                            {qTotal > 0 ? `Margin ${((profit / qTotal) * 100).toFixed(0)}%` : '-'}
                          </span>
                        </div>
                      </div>

                      {/* --- ROW 4: Full-width Clickable Toggle Accordion Bar --- */}
                      <button
                        onClick={() => toggleRowExpand(item.id)}
                        className="w-full mt-3 sm:mt-5 pt-3 sm:pt-4 border-t border-slate-100 flex items-center justify-between text-xs sm:text-sm lg:text-base font-bold text-slate-500 hover:text-indigo-600 transition group select-none cursor-pointer"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span>{isExpanded ? 'ซ่อนรายละเอียดรายการย่อย' : 'ดูแจกแจงรายการย่อย'}</span>
                          <span className="text-[11px] sm:text-xs lg:text-sm px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-md group-hover:bg-indigo-50 group-hover:text-indigo-600 font-semibold">
                            {(item.quotationItems?.length || 0) + (item.customerSupport?.length || 0) + (item.expenses?.length || 0)} รายการ
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400 group-hover:text-indigo-600 shrink-0 font-medium">
                          <span className="text-xs sm:text-sm hidden sm:inline">{isExpanded ? 'ย่อ' : 'ขยาย'}</span>
                          {isExpanded ? <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5" /> : <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />}
                        </div>
                      </button>

                      {/* --- ROW 5: Detailed Breakdown Drawer (When Expanded) --- */}
                      {isExpanded && (
                        <div className="mt-3 sm:mt-5 pt-3 sm:pt-5 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 lg:gap-5 animate-in fade-in duration-200">
                          {/* 1. Quotation breakdown */}
                          <div className="bg-slate-50/90 p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200/70 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-200 text-emerald-800 font-bold text-xs sm:text-sm lg:text-base">
                                <span className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-emerald-600 shrink-0" />
                                  <span>รายการเสนอราคา</span>
                                </span>
                                <span className="tabular-nums font-black text-emerald-700 text-sm sm:text-base lg:text-lg">฿{formatCurrency(qTotal)}</span>
                              </div>
                              <div className="space-y-2">
                                {hasQuotation ? (
                                  item.quotationItems.map((q, idx) => (
                                    <div key={idx} className="flex items-start justify-between gap-2.5 text-slate-600 text-xs sm:text-sm pb-1.5 border-b border-slate-100 last:border-b-0">
                                      <div className="truncate flex-1">
                                        <span className="font-semibold text-slate-700 block">{q.detail || 'รายการงาน'}</span>
                                        <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-400 mt-0.5">
                                          {q.category && <span>({q.category})</span>}
                                          {q.date && <span>{formatItemDate(q.date)}</span>}
                                        </div>
                                      </div>
                                      <span className="font-bold text-slate-800 tabular-nums shrink-0 text-xs sm:text-sm lg:text-base">฿{formatCurrency(q.price)}</span>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-xs sm:text-sm text-slate-400 italic">ค่าจ้าง/บริการเหมา ฿{formatCurrency(qTotal)}</p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* 2. Support breakdown */}
                          <div className="bg-indigo-50/50 p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-indigo-100 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-indigo-100 text-indigo-900 font-bold text-xs sm:text-sm lg:text-base">
                                <span className="flex items-center gap-2">
                                  <Gift className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-indigo-600 shrink-0" />
                                  <span>เงินส่งต่อศิลปิน</span>
                                </span>
                                <span className="tabular-nums font-black text-indigo-700 text-sm sm:text-base lg:text-lg">{sTotal > 0 ? `฿${formatCurrency(sTotal)}` : '-'}</span>
                              </div>
                              <div className="space-y-2">
                                {hasSupport && sTotal > 0 ? (
                                  item.customerSupport.map((s, idx) => {
                                    const denomText = s.denomination >= 20 ? `แบงค์ ${s.denomination}บ.` : `เหรียญ ${s.denomination}บ.`;
                                    return (
                                      <div key={idx} className="flex items-start justify-between gap-2.5 text-slate-600 text-xs sm:text-sm pb-1.5 border-b border-indigo-100/50 last:border-b-0">
                                        <div className="truncate flex-1">
                                          <span className="font-semibold text-slate-700 block">{denomText} x {s.quantity}</span>
                                          <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-400 mt-0.5">
                                            {s.detail && <span>({s.detail})</span>}
                                            {s.date && <span>{formatItemDate(s.date)}</span>}
                                          </div>
                                        </div>
                                        <span className="font-bold text-indigo-700 tabular-nums shrink-0 text-xs sm:text-sm lg:text-base">฿{formatCurrency(s.price)}</span>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <p className="text-xs sm:text-sm text-slate-400 italic">ไม่มีรายการส่งต่อศิลปิน</p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* 3. Expenses breakdown */}
                          <div className="bg-rose-50/50 p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-rose-100 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-rose-100 text-rose-900 font-bold text-xs sm:text-sm lg:text-base">
                                <span className="flex items-center gap-2">
                                  <TrendingDown className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-rose-600 shrink-0" />
                                  <span>รายจ่ายจริง (ต้นทุน)</span>
                                </span>
                                <span className="tabular-nums font-black text-rose-700 text-sm sm:text-base lg:text-lg">{eTotal > 0 ? `฿${formatCurrency(eTotal)}` : '-'}</span>
                              </div>
                              <div className="space-y-2">
                                {hasExpenses && eTotal > 0 ? (
                                  item.expenses.map((e, idx) => (
                                    <div key={idx} className="flex items-start justify-between gap-2.5 text-slate-600 text-xs sm:text-sm pb-1.5 border-b border-rose-100/50 last:border-b-0">
                                      <div className="truncate flex-1">
                                        <span className="font-semibold text-slate-700 block">{e.detail || 'ค่าใช้จ่าย'}</span>
                                        <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-400 mt-0.5">
                                          {e.category && <span>({e.category})</span>}
                                          {e.quantity > 1 && <span>จำนวน: {e.quantity}</span>}
                                          {e.date && <span>{formatItemDate(e.date)}</span>}
                                        </div>
                                      </div>
                                      <span className="font-bold text-rose-600 tabular-nums shrink-0 text-xs sm:text-sm lg:text-base">฿{formatCurrency(e.price)}</span>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-xs sm:text-sm text-slate-400 italic">ไม่มีรายการรายจ่ายเพิ่มเติม</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {visibleCount < processedData.length && (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setVisibleCount(prev => prev + 35)}
                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold rounded-2xl transition cursor-pointer"
                  >
                    โหลดเพิ่มเติม (แสดง {visibleDashboardData.length} จาก {processedData.length} รายการ)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 3: SLIPS TABLE VIEW (ตารางสลิปโอนเงิน)
         ========================================================================= */}
      {viewMode === 'slips' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            {/* Header Toolbar */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    ตารางสลิปโอนเงิน ({displayedSlipsData.length} รายการ)
                  </h3>
                  <p className="text-xs text-slate-400">
                    แสดงรายการงานและหลักฐานสลิปโอนเงิน (มีสลิป {projectsWithSlipsCount} งาน)
                  </p>
                </div>
              </div>

              {/* Toolbar Controls */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Slips Filter Toggle: ทั้งหมด vs เฉพาะที่มีสลิป */}
                <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => handleSlipsFilterModeChange('all')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                      slipsFilterMode === 'all'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    ทั้งหมด ({processedData.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSlipsFilterModeChange('has_slips')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer ${
                      slipsFilterMode === 'has_slips'
                        ? 'bg-white text-indigo-700 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <span>เฉพาะมีสลิป</span>
                    <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.2 rounded-full font-extrabold">
                      {projectsWithSlipsCount}
                    </span>
                  </button>
                </div>

                {/* Columns per Row Toggle: 3 vs 4 */}
                <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => handleSlipsPerRowChange(3)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                      slipsPerRow === 3
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                    title="แถวละ 3 รูป - ขนาดใหญ่ ตัวหนังสือและยอดเงินอ่านชัดเจน"
                  >
                    3 รูป/แถว (ชัดเจน)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSlipsPerRowChange(4)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                      slipsPerRow === 4
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                    title="แถวละ 4 รูป - ขนาดกะทัดรัด"
                  >
                    4 รูป/แถว
                  </button>
                </div>

                {/* Print Slips Button */}
                <button
                  type="button"
                  onClick={() => handlePrint('slips')}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs active:scale-95 shrink-0"
                  title="พิมพ์ตารางสลิปโอนเงิน A4"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>พิมพ์ A4</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-bold text-slate-600">
                    <th className="py-3.5 px-4 w-28 sm:w-36 text-center border-r border-slate-200/60">
                      วันที่
                    </th>
                    <th className="py-3.5 px-4 sm:px-6">
                      รายการ
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedSlipsData.length > 0 ? (
                    visibleSlipsData.map((item) => {
                      const itemDate = item._dateFormatted;
                      const slips = item._slips;
                      const hasSlips = item._hasSlips;

                      return (
                        <tr
                          key={item.id}
                          style={{ contentVisibility: 'auto', containIntrinsicSize: '0 160px' }}
                          className="hover:bg-slate-50/40 transition"
                        >
                          {/* Date Column */}
                          <td className="py-4 px-4 align-top text-center border-r border-slate-100">
                            <span className="font-bold text-slate-900 text-xs sm:text-sm block">
                              {itemDate || '-'}
                            </span>
                          </td>

                          {/* Item & Slips Grid Column */}
                          <td className="py-4 px-4 sm:px-6 align-top">
                            {/* Project Header */}
                            <div className="mb-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 text-sm sm:text-base">
                                  <span className="text-indigo-600 font-extrabold">{item.id}</span>
                                  {' - '}
                                  <span>{item.name || 'ไม่มีชื่อโปรเจค'}</span>
                                </span>
                                {onOpenProjectModal && (
                                  <button
                                    onClick={() => onOpenProjectModal(item, false)}
                                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                                    title="เปิดแก้ไขงาน"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
                                <span>ลูกค้า: <strong className="text-slate-600 font-semibold">{item.customer || '-'}</strong></span>
                                <span>•</span>
                                <span>ศิลปิน: <strong className="text-slate-600 font-semibold">{item.artist || '-'}</strong></span>
                                {item.wage > 0 && (
                                  <>
                                    <span>•</span>
                                    <span>ยอดงาน: <strong className="text-slate-700 font-semibold">฿{formatCurrency(item.wage)}</strong></span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Slips Flex Grid or No-Slip Note */}
                            {hasSlips ? (
                              <div className="flex flex-wrap items-start gap-3 pt-1">
                                {slips.map((slip, slipIdx) => {
                                  const slipSrc = typeof slip === 'object' ? slip.url : slip;
                                  return (
                                    <div
                                      key={slip.id || slipIdx}
                                      onClick={() => setPreviewSlipImage(slipSrc)}
                                      className={`group relative rounded-xl overflow-hidden border border-slate-200 bg-white shadow-2xs hover:shadow-md hover:border-indigo-400 transition-all cursor-pointer ${
                                        slipsPerRow === 3 ? 'h-64 sm:h-72' : 'h-48 sm:h-56'
                                      } w-auto max-w-full`}
                                    >
                                      <img
                                        src={processImageUrl(slipSrc)}
                                        alt={`สลิปโอนเงิน ${slipIdx + 1}`}
                                        className="h-full w-auto max-w-full object-contain transition-transform duration-200 group-hover:scale-102"
                                        referrerPolicy="no-referrer"
                                        onError={(e) => {
                                          e.target.onerror = null;
                                          e.target.src = "https://placehold.co/300x400?text=Slip+Error";
                                        }}
                                      />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white">
                                        <Maximize2 className="w-5 h-5" />
                                        <span className="text-xs font-bold">ดูขยาย</span>
                                      </div>
                                      <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 bg-black/60 backdrop-blur-xs rounded text-[10px] text-white font-medium">
                                        ใบที่ {slipIdx + 1}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-xs text-slate-400 italic py-1">
                                - ไม่มีรูปสลิปแนบ -
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={2} className="py-16 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-400">
                          <div className="p-3 bg-slate-100 rounded-full mb-3">
                            <Receipt className="w-8 h-8 opacity-40 text-slate-500" />
                          </div>
                          <p className="font-bold text-slate-600 text-sm">ไม่พบรายการตามเงื่อนไขที่เลือก</p>
                          <p className="text-xs text-slate-400 mt-1 max-w-sm">
                            ลองปรับเปลี่ยนคำค้นหาหรือช่วงวันที่ในแถบด้านบน
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}

                  {visibleCount < displayedSlipsData.length && (
                    <tr className="no-print">
                      <td colSpan={2} className="py-3 text-center bg-slate-50 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={() => setVisibleCount(prev => prev + 35)}
                          className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition cursor-pointer shadow-2xs"
                        >
                          โหลดเพิ่มเติม (แสดง {visibleSlipsData.length} จาก {displayedSlipsData.length} รายการ)
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal for Slips View */}
      {previewSlipImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewSlipImage(null)}
        >
          <div
            className="relative max-w-2xl max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl p-2 flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewSlipImage(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition shadow-md"
              title="ปิด"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={processImageUrl(previewSlipImage)}
              alt="สลิปโอนเงินขนาดเต็ม"
              className="max-h-[82vh] w-auto max-w-full object-contain rounded-xl"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      )}
    </div>
  );
}
