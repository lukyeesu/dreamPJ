import React, { useState, useMemo, useRef } from 'react';
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
  LayoutList
} from 'lucide-react';
import DateFilterControl from './components/common/DateFilterControl';

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
  setFilterDateRange: propSetFilterDateRange
}) {
  // --- View Mode State ---
  // 'sheet' = ตารางกำไรขาดทุนแบบสมุดบัญชีตามรูป (Accounting Sheet View)
  // 'dashboard' = แดชบอร์ดภาพรวมพร้อมการ์ดสถิติ (Interactive Dashboard View)
  const [viewMode, setViewMode] = useState('sheet');

  // Mobile layout mode for 'sheet': 'card' (easy mobile cards) or 'table' (full A4 table)
  const [mobileSheetLayout, setMobileSheetLayout] = useState('card');

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
    return activities.filter(item => {
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
    }).sort((a, b) => {
      const dateA = new Date(a.paymentDate || a.rawDateTime || 0).getTime();
      const dateB = new Date(b.paymentDate || b.rawDateTime || 0).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
  }, [activities, searchQuery, paymentStatusFilter, dateFilterMode, filterDate, filterDateRange, sortOrder]);

  // --- Financial Calculations ---
  const financialSummary = useMemo(() => {
    let totalRevenue = 0;       // [MODIFIED] เฉพาะค่าจ้าง/ราคาเสนอราคา ไม่รวมเงินสนับสนุนศิลปิน
    let totalQuotation = 0;     // Shop job charges
    let totalSupport = 0;       // Artist support funds
    let totalExpenses = 0;      // Actual expenses / COGS
    let totalProfit = 0;        // รายรับ - รายจ่ายจริง (Quotation - Expenses)
    let totalDeposits = 0;      // Received deposits
    let pendingReceivables = 0; // Unpaid balances (เฉพาะส่วนค่าจ้าง)
    let paidProjectsCount = 0;

    processedData.forEach(item => {
      // Calculate Quotation Wage
      const itemQuotation = item.quotationItems && item.quotationItems.length > 0
        ? item.quotationItems.reduce((sum, q) => sum + (parseFloat(q.price) || 0), 0)
        : (parseFloat(item.wage) || 0);

      // Calculate Support
      const itemSupport = item.customerSupport && item.customerSupport.length > 0
        ? item.customerSupport.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0)
        : 0;

      // Calculate Expenses
      const itemExpenses = item.expenses && item.expenses.length > 0
        ? item.expenses.reduce((sum, e) => sum + (parseFloat(e.price) || 0), 0)
        : 0;

      // [MODIFIED] รายรับ = เฉพาะค่าจ้าง/ใบเสนอราคา ไม่รวมเงินสนับสนุนศิลปิน
      const itemRevenue = itemQuotation;
      const itemProfit = itemQuotation - itemExpenses;
      const itemPaymentStatus = item.paymentStatus || (item.dealStatus === 'completed' ? 'paid' : 'unpaid');
      const itemDeposit = parseFloat(item.depositAmount) || 0;

      totalQuotation += itemQuotation;
      totalSupport += itemSupport;
      totalRevenue += itemRevenue; // Revenue is pure quotation wage
      totalExpenses += itemExpenses;
      totalProfit += itemProfit;
      totalDeposits += itemDeposit;

      if (itemPaymentStatus === 'paid') {
        paidProjectsCount++;
      } else if (itemPaymentStatus === 'deposit') {
        pendingReceivables += Math.max(0, itemRevenue - itemDeposit);
      } else if (itemPaymentStatus === 'unpaid') {
        pendingReceivables += itemRevenue;
      }
    });

    const netMarginPercent = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0;
    const aov = processedData.length > 0 ? Math.round(totalRevenue / processedData.length) : 0;

    return {
      totalRevenue,
      totalQuotation,
      totalSupport,
      totalExpenses,
      totalProfit,
      totalDeposits,
      pendingReceivables,
      paidProjectsCount,
      netMarginPercent,
      aov,
      projectCount: processedData.length
    };
  }, [processedData]);

  // --- Print in New Tab Handler (Multi-page A4 Support) ---
  const handlePrint = () => {
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
      ? `<tr><td colspan="6" style="text-align: center; padding: 24px; color: #94a3b8; font-style: italic;">ไม่พบข้อมูลบันทึกกำไรขาดทุนตามเงื่อนไขที่เลือก</td></tr>`
      : processedData.map((item) => {
          const hasQuotation = item.quotationItems && item.quotationItems.length > 0;
          const qTotal = hasQuotation
            ? item.quotationItems.reduce((sum, q) => sum + (parseFloat(q.price) || 0), 0)
            : (parseFloat(item.wage) || 0);

          const hasSupport = item.customerSupport && item.customerSupport.length > 0;
          const sTotal = hasSupport
            ? item.customerSupport.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0)
            : 0;

          const hasExpenses = item.expenses && item.expenses.length > 0;
          const eTotal = hasExpenses
            ? item.expenses.reduce((sum, e) => sum + (parseFloat(e.price) || 0), 0)
            : 0;

          const itemRevenue = qTotal;
          const netBalance = qTotal - eTotal;
          const displayProjectDate = formatItemDate(item.paymentDate || item.rawDateTime || item.date);

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

          return `
            <tr style="page-break-inside: avoid; break-inside: avoid;">
              <td style="text-align: center; font-weight: bold; white-space: nowrap; padding: 8px 6px; border-left: 1px solid #000; border-right: 1px solid #000; border-bottom: 1px dashed #000;">
                ${displayProjectDate || '-'}
              </td>
              <td style="padding: 8px 10px; border-left: 1px solid #000; border-right: 1px solid #000; border-bottom: 1px dashed #000;">
                <div style="font-weight: 800; font-size: 13px; margin-bottom: 4px; display: flex; justify-content: space-between;">
                  <span>${escapeHtml(item.id)} ${item.name ? `- ${escapeHtml(item.name)}` : ''}</span>
                  <span style="font-size: 11px; font-weight: normal; color: #64748b;">${item.customer ? `ลูกค้า: ${escapeHtml(item.customer)}` : ''}</span>
                </div>
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
              </td>
              <td style="text-align: right; font-weight: bold; padding: 8px 8px; font-variant-numeric: tabular-nums; border-left: 1px solid #000; border-right: 1px solid #000; border-bottom: 1px dashed #000;">
                ${itemRevenue > 0 ? formatCurrency(itemRevenue) : '-'}
              </td>
              <td style="text-align: right; font-weight: bold; padding: 8px 8px; font-variant-numeric: tabular-nums; border-left: 1px solid #000; border-right: 1px solid #000; border-bottom: 1px dashed #000;">
                ${sTotal > 0 ? formatCurrency(sTotal) : '-'}
              </td>
              <td style="text-align: right; font-weight: bold; padding: 8px 8px; font-variant-numeric: tabular-nums; border-left: 1px solid #000; border-right: 1px solid #000; border-bottom: 1px dashed #000;">
                ${eTotal > 0 ? formatCurrency(eTotal) : '-'}
              </td>
              <td style="text-align: right; font-weight: 800; padding: 8px 8px; font-variant-numeric: tabular-nums; border-left: 1px solid #000; border-right: 1px solid #000; border-bottom: 1px dashed #000;">
                ${formatCurrency(netBalance)}
              </td>
            </tr>
          `;
        }).join('');

    // Grand Total Summary Row (for Table)
    const grandTotalHtml = `
      <tr style="background: #f1f5f9; font-weight: 800; border-top: 2px solid #000; border-bottom: 2px solid #000; font-size: 12px; page-break-inside: avoid; break-inside: avoid;">
        <td colspan="2" style="text-align: center; padding: 10px 8px; border-top: 2px solid #000; border-bottom: 2px solid #000;">ยอดรวมสุทธิ (Grand Total)</td>
        <td style="text-align: right; padding: 10px 8px; color: #065f46; font-variant-numeric: tabular-nums; border-top: 2px solid #000; border-bottom: 2px solid #000;">฿${formatCurrency(financialSummary.totalRevenue)}</td>
        <td style="text-align: right; padding: 10px 8px; color: #3730a3; font-variant-numeric: tabular-nums; border-top: 2px solid #000; border-bottom: 2px solid #000;">฿${formatCurrency(financialSummary.totalSupport)}</td>
        <td style="text-align: right; padding: 10px 8px; color: #9f1239; font-variant-numeric: tabular-nums; border-top: 2px solid #000; border-bottom: 2px solid #000;">฿${formatCurrency(financialSummary.totalExpenses)}</td>
        <td style="text-align: right; padding: 10px 8px; color: #064e3b; font-variant-numeric: tabular-nums; background: #ecfdf5; border-top: 2px solid #000; border-bottom: 2px solid #000;">฿${formatCurrency(financialSummary.totalProfit)}</td>
      </tr>
    `;

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
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 15px rgba(0,0,0,0.18);
    }
    .top-bar-title {
      font-size: 14px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .top-bar-badge {
      background: #334155;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 12px;
      color: #93c5fd;
    }
    .btn-group {
      display: flex;
      align-items: center;
      gap: 8px;
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
        padding: 10px 14px;
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
      }
      .btn {
        padding: 8px 8px;
        font-size: 12px;
        justify-content: center;
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
    }
  </style>
</head>
<body>
  <div class="top-action-bar no-print">
    <div class="top-bar-title">
      <span>แบบฟอร์มบันทึกข้อมูลกำไรขาดทุน</span>
      <span class="top-bar-badge">${processedData.length} รายการ</span>
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

  <div class="paper-container">
    <div class="doc-header">
      <div>
        <h1 class="doc-title">บันทึกข้อมูลกำไรขาดทุน</h1>
        <p class="doc-subtitle">${escapeHtml(shopName)} ${shopPhone}</p>
      </div>
      <div class="doc-meta">
        <div><strong>วันที่พิมพ์:</strong> ${printDate} (${printTime} น.)</div>
        <div><strong>จำนวนงาน:</strong> ${processedData.length} รายการ</div>
      </div>
    </div>

    <!-- A4 Table View (Pan-able on phone, prints cleanly on paper) -->
    <div class="table-scroll-wrapper" id="tableScrollWrapper">
      <table class="accounting-table">
        <thead>
          <tr>
            <th style="width: 80px;">วันที่</th>
            <th>รายการ</th>
            <th style="width: 85px; text-align: right;">รายรับ</th>
            <th style="width: 95px; text-align: right;">เงินศิลปิน</th>
            <th style="width: 85px; text-align: right;">รายจ่าย</th>
            <th style="width: 95px; text-align: right;">คงเหลือ</th>
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
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(fullHtml);
    printWindow.document.close();
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
            onClick={() => setViewMode('sheet')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'sheet'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <TableIcon className="w-4 h-4 text-indigo-600" />
            <span>ตารางบัญชี</span>
          </button>
          <button
            onClick={() => setViewMode('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === 'dashboard'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart2 className="w-4 h-4 text-emerald-600" />
            <span>การ์ดสรุป</span>
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
            onClick={handlePrint}
            className="flex items-center justify-center w-10 h-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-100 transition-all hover:-translate-y-0.5 active:translate-y-0 shrink-0"
            title="พิมพ์เอกสาร A4"
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
          FILTER TOOLBAR (Search on Left, Multi-level Date Selector on Right)
         ========================================================================= */}
      <div className="no-print bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
        {/* Row 1: Search on Left + DateFilterControl on Right */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Left: Compact Search Input */}
          <div className="relative flex-1 md:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหารหัส, ชื่องาน, ลูกค้า, ศิลปิน..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-9 pr-8 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-bold p-1 rounded-md"
                title="ล้างข้อความค้นหา"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Right: Date Filter Control (Same as Analytics page) */}
          <div className="w-full md:w-auto min-w-[280px] sm:min-w-[340px] h-11">
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

        {/* Row 2: Payment Status Filter + Reset Filter + Sort Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            {/* Payment Status Dropdown */}
            <div className="w-48 min-w-[140px]">
              <select
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
              >
                <option value="all">สถานะ: ทั้งหมด</option>
                <option value="paid">ชำระครบแล้ว</option>
                <option value="deposit">มัดจำแล้ว</option>
                <option value="unpaid">รอชำระเงิน</option>
                <option value="refunded">คืนเงิน/ยกเลิก</option>
              </select>
            </div>

            {/* Reset Filter Button if active */}
            {(searchQuery || paymentStatusFilter !== 'all' || dateFilterMode !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setPaymentStatusFilter('all');
                  setDateFilterMode('all');
                  setFilterDate('');
                  setFilterDateRange({ start: '', end: '' });
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl text-xs font-bold hover:bg-rose-100 transition active:scale-95"
                title="ล้างตัวกรองทั้งหมด"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>ล้างตัวกรอง</span>
              </button>
            )}
          </div>

          {/* Sort Order Toggle */}
          <button
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition active:scale-95"
            title={sortOrder === 'desc' ? 'เรียงล่าสุดก่อน' : 'เรียงเก่าสุดก่อน'}
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
            <span>{sortOrder === 'desc' ? 'ล่าสุดก่อน' : 'เก่าสุดก่อน'}</span>
          </button>
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

          {/* Mobile View Toggle: Card View vs Full Table */}
          <div className="no-print md:hidden mb-4 flex items-center justify-between gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              onClick={() => setMobileSheetLayout('card')}
              className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 ${
                mobileSheetLayout === 'card'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>การ์ดอ่านง่าย</span>
            </button>
            <button
              onClick={() => setMobileSheetLayout('table')}
              className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 ${
                mobileSheetLayout === 'table'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>ตารางเต็ม A4</span>
            </button>
          </div>

          {/* Mobile Card View (Easy reading on phones) */}
          <div className={`no-print ${mobileSheetLayout === 'card' ? 'block md:hidden' : 'hidden'} space-y-3 mb-4`}>
            {/* List of Mobile Ledger Cards */}
            {processedData.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 font-medium text-xs">
                ไม่พบข้อมูลบันทึกกำไรขาดทุนตามเงื่อนไขที่เลือก
              </div>
            ) : (
              processedData.map((item, index) => {
                const hasQuotation = item.quotationItems && item.quotationItems.length > 0;
                const qTotal = hasQuotation
                  ? item.quotationItems.reduce((sum, q) => sum + (parseFloat(q.price) || 0), 0)
                  : (parseFloat(item.wage) || 0);

                const hasSupport = item.customerSupport && item.customerSupport.length > 0;
                const sTotal = hasSupport
                  ? item.customerSupport.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0)
                  : 0;

                const hasExpenses = item.expenses && item.expenses.length > 0;
                const eTotal = hasExpenses
                  ? item.expenses.reduce((sum, e) => sum + (parseFloat(e.price) || 0), 0)
                  : 0;

                const netBalance = qTotal - eTotal;
                const displayProjectDate = formatItemDate(item.paymentDate || item.rawDateTime || item.date);

                return (
                  <div key={item.id || index} className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs space-y-3">
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

                    {/* Summary 4-Column Strip for this item */}
                    <div className="grid grid-cols-4 gap-1 pt-2 border-t border-slate-100 text-center">
                      <div className="bg-slate-50 p-1.5 rounded-lg">
                        <span className="text-[9px] text-slate-400 block font-medium">รายรับ</span>
                        <span className="text-[11px] font-bold text-slate-800 tabular-nums">{qTotal > 0 ? formatCurrency(qTotal) : '-'}</span>
                      </div>
                      <div className="bg-slate-50 p-1.5 rounded-lg">
                        <span className="text-[9px] text-slate-400 block font-medium">สนับสนุน</span>
                        <span className="text-[11px] font-bold text-indigo-700 tabular-nums">{sTotal > 0 ? formatCurrency(sTotal) : '-'}</span>
                      </div>
                      <div className="bg-slate-50 p-1.5 rounded-lg">
                        <span className="text-[9px] text-slate-400 block font-medium">รายจ่าย</span>
                        <span className="text-[11px] font-bold text-rose-600 tabular-nums">{eTotal > 0 ? formatCurrency(eTotal) : '-'}</span>
                      </div>
                      <div className="bg-emerald-50/70 p-1.5 rounded-lg border border-emerald-100">
                        <span className="text-[9px] text-emerald-800 block font-bold">คงเหลือ</span>
                        <span className="text-[11px] font-black text-emerald-700 tabular-nums">{formatCurrency(netBalance)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Table Container (Shows on desktop or when mobile user switches to full table, always prints) */}
          <div className={`table-container-for-print ${mobileSheetLayout === 'table' ? 'block' : 'hidden md:block'} overflow-x-auto -mx-2 sm:mx-0`}>
            <table className="accounting-print-table w-full border-collapse border border-slate-300 text-xs sm:text-sm min-w-[680px]">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold">
                  <th className="border border-slate-300 px-3 py-2.5 text-center w-28 sm:w-32">วันที่</th>
                  <th className="border border-slate-300 px-4 py-2.5 text-center">รายการ</th>
                  <th className="border border-slate-300 px-3 py-2.5 text-right w-24 sm:w-28">รายรับ</th>
                  <th className="border border-slate-300 px-3 py-2.5 text-right w-24 sm:w-28">เงินศิลปิน</th>
                  <th className="border border-slate-300 px-3 py-2.5 text-right w-24 sm:w-28">รายจ่าย</th>
                  <th className="border border-slate-300 px-3 py-2.5 text-right w-24 sm:w-32">คงเหลือ</th>
                </tr>
              </thead>
              <tbody>
                {processedData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400 font-medium border border-slate-300">
                      ไม่พบข้อมูลบันทึกกำไรขาดทุนตามเงื่อนไขที่เลือก
                    </td>
                  </tr>
                ) : (
                  processedData.map((item, index) => {
                    // Item Calculations
                    const hasQuotation = item.quotationItems && item.quotationItems.length > 0;
                    const qTotal = hasQuotation
                      ? item.quotationItems.reduce((sum, q) => sum + (parseFloat(q.price) || 0), 0)
                      : (parseFloat(item.wage) || 0);

                    const hasSupport = item.customerSupport && item.customerSupport.length > 0;
                    const sTotal = hasSupport
                      ? item.customerSupport.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0)
                      : 0;

                    const hasExpenses = item.expenses && item.expenses.length > 0;
                    const eTotal = hasExpenses
                      ? item.expenses.reduce((sum, e) => sum + (parseFloat(e.price) || 0), 0)
                      : 0;

                    const netBalance = qTotal - eTotal;

                    // Fallback item-level date or project date
                    const displayProjectDate = formatItemDate(item.paymentDate || item.rawDateTime || item.date);

                    return (
                      <tr key={item.id || index} className="align-top hover:bg-slate-50/50 transition">
                        {/* 1. วันที่ */}
                        <td className="border-x border-slate-300 border-b border-dashed border-slate-400 px-3 py-3 text-center font-bold text-slate-800 whitespace-nowrap">
                          {displayProjectDate}
                        </td>

                        {/* 2. รายการ (ตรงตามรูปภาพตัวอย่าง 3 หมวดย่อยพร้อมวันที่ต่อท้าย) */}
                        <td className="border-x border-slate-300 border-b border-dashed border-slate-400 px-4 py-3 text-slate-800">
                          {/* รหัสงาน & ชื่อ */}
                          <div className="font-black text-slate-900 mb-1 flex items-center justify-between">
                            <span>{item.id} {item.name ? `- ${item.name}` : ''}</span>
                            <span className="no-print text-[11px] font-normal text-slate-400">
                              {item.customer ? `ลูกค้า: ${item.customer}` : ''}
                            </span>
                          </div>

                          {/* 1. เงินสนับสนุนศิลปิน (Money Order) */}
                          <div className="mt-1.5 space-y-0.5">
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
                          <div className="mt-2 space-y-0.5">
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
                          <div className="mt-2 space-y-0.5">
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
                        </td>

                        {/* 3. รายรับ (เฉพาะค่าจ้าง ไม่รวมเงินสนับสนุนศิลปิน) */}
                        <td className="border-x border-slate-300 border-b border-dashed border-slate-400 px-3 py-3 text-right font-bold text-slate-900 tabular-nums">
                          {qTotal > 0 ? formatCurrency(qTotal) : '-'}
                        </td>

                        {/* 4. เงินสนับสนุนศิลปิน */}
                        <td className="border-x border-slate-300 border-b border-dashed border-slate-400 px-3 py-3 text-right font-bold text-slate-900 tabular-nums">
                          {sTotal > 0 ? formatCurrency(sTotal) : '-'}
                        </td>

                        {/* 5. รายจ่าย */}
                        <td className="border-x border-slate-300 border-b border-dashed border-slate-400 px-3 py-3 text-right font-bold text-slate-900 tabular-nums">
                          {eTotal > 0 ? formatCurrency(eTotal) : '-'}
                        </td>

                        {/* 6. คงเหลือ */}
                        <td className="border-x border-slate-300 border-b border-dashed border-slate-400 px-3 py-3 text-right font-black text-slate-900 tabular-nums">
                          {formatCurrency(netBalance)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Grand Total Summary Row */}
              <tfoot>
                <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-400 text-xs sm:text-sm">
                  <td colSpan={2} className="border border-slate-300 px-4 py-3 text-center">
                    ยอดรวมสุทธิ (Grand Total)
                  </td>
                  <td className="border border-slate-300 px-3 py-3 text-right tabular-nums text-emerald-800">
                    ฿{formatCurrency(financialSummary.totalRevenue)}
                  </td>
                  <td className="border border-slate-300 px-3 py-3 text-right tabular-nums text-indigo-800">
                    ฿{formatCurrency(financialSummary.totalSupport)}
                  </td>
                  <td className="border border-slate-300 px-3 py-3 text-right tabular-nums text-rose-800">
                    ฿{formatCurrency(financialSummary.totalExpenses)}
                  </td>
                  <td className="border border-slate-300 px-3 py-3 text-right tabular-nums text-emerald-900 bg-emerald-50/50">
                    ฿{formatCurrency(financialSummary.totalProfit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 2: INTERACTIVE DASHBOARD VIEW (มุมมองบัตรงานบนหน้าจอ)
         ========================================================================= */}
      {viewMode === 'dashboard' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-4 sm:p-6">
            <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-indigo-600" />
              รายการงานและการเงิน ({processedData.length} รายการ)
            </h3>

            <div className="space-y-3">
              {processedData.length === 0 ? (
                <div className="text-center py-12 text-slate-400">ไม่พบงานตามเงื่อนไขที่เลือก</div>
              ) : (
                processedData.map((item) => {
                  const hasQuotation = item.quotationItems && item.quotationItems.length > 0;
                  const qTotal = hasQuotation
                    ? item.quotationItems.reduce((sum, q) => sum + (parseFloat(q.price) || 0), 0)
                    : (parseFloat(item.wage) || 0);

                  const hasSupport = item.customerSupport && item.customerSupport.length > 0;
                  const sTotal = hasSupport
                    ? item.customerSupport.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0)
                    : 0;

                  const hasExpenses = item.expenses && item.expenses.length > 0;
                  const eTotal = hasExpenses
                    ? item.expenses.reduce((sum, e) => sum + (parseFloat(e.price) || 0), 0)
                    : 0;

                  const profit = qTotal - eTotal;
                  const isExpanded = !!expandedRows[item.id];
                  const paymentStatus = item.paymentStatus || (item.dealStatus === 'completed' ? 'paid' : 'unpaid');

                  return (
                    <div
                      key={item.id}
                      className="border border-slate-200 rounded-2xl p-4 hover:border-indigo-200 hover:shadow-sm transition bg-white"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="p-2.5 bg-slate-100 rounded-xl font-mono font-black text-xs text-slate-700">
                            {item.id}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm sm:text-base">{item.name}</h4>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                              <span>ลูกค้า: <strong className="text-slate-700">{item.customer || '-'}</strong></span>
                              <span>•</span>
                              <span>ศิลปิน: <strong className="text-slate-700">{item.artist || '-'}</strong></span>
                              <span>•</span>
                              <span>วันที่: {formatDateTimeDisplay(item.paymentDate || item.rawDateTime)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Status & Summary Pills */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                            paymentStatus === 'deposit' ? 'bg-blue-100 text-blue-700' :
                            paymentStatus === 'refunded' ? 'bg-rose-100 text-rose-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {paymentStatus === 'paid' ? 'ชำระครบแล้ว' :
                             paymentStatus === 'deposit' ? `มัดจำ ฿${formatCurrency(item.depositAmount)}` :
                             paymentStatus === 'refunded' ? 'คืนเงิน/ยกเลิก' : 'รอชำระเงิน'}
                          </span>

                          <div className="text-right pl-2">
                            <span className="text-[10px] text-slate-400 font-bold block">กำไรสุทธิ</span>
                            <span className={`font-black text-sm sm:text-base ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              ฿{formatCurrency(profit)}
                            </span>
                          </div>

                          {/* Quick Edit */}
                          {onOpenProjectModal && (
                            <button
                              onClick={() => onOpenProjectModal(item, false)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                              title="แก้ไขงาน"
                            >
                              <SlidersHorizontal className="w-4 h-4" />
                            </button>
                          )}

                          {/* Expand Details */}
                          <button
                            onClick={() => toggleRowExpand(item.id)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Collapsible Sub-item Details */}
                      {isExpanded && (
                        <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs animate-in fade-in duration-200">
                          {/* Quotation breakdown */}
                          <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-100">
                            <p className="font-bold text-emerald-800 mb-1.5 flex justify-between">
                              <span>รายการเสนอราคา</span>
                              <span>฿{formatCurrency(qTotal)}</span>
                            </p>
                            <div className="space-y-1">
                              {hasQuotation ? item.quotationItems.map((q, idx) => (
                                <div key={idx} className="flex justify-between text-slate-600">
                                  <span>- {q.detail || q.category} ({formatItemDate(q.date)})</span>
                                  <span className="font-semibold">{formatCurrency(q.price)}</span>
                                </div>
                              )) : <p className="text-slate-400">-</p>}
                            </div>
                          </div>

                          {/* Support breakdown */}
                          <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100">
                            <p className="font-bold text-indigo-800 mb-1.5 flex justify-between">
                              <span>เงินสนับสนุนศิลปิน</span>
                              <span>฿{formatCurrency(sTotal)}</span>
                            </p>
                            <div className="space-y-1">
                              {hasSupport && sTotal > 0 ? item.customerSupport.map((s, idx) => (
                                <div key={idx} className="flex justify-between text-slate-600">
                                  <span>- {s.denomination}บ. x {s.quantity} ({formatItemDate(s.date)})</span>
                                  <span className="font-semibold">{formatCurrency(s.price)}</span>
                                </div>
                              )) : <p className="text-slate-400">-</p>}
                            </div>
                          </div>

                          {/* Expenses breakdown */}
                          <div className="bg-rose-50/60 p-3 rounded-xl border border-rose-100">
                            <p className="font-bold text-rose-800 mb-1.5 flex justify-between">
                              <span>รายจ่ายจริง</span>
                              <span>฿{formatCurrency(eTotal)}</span>
                            </p>
                            <div className="space-y-1">
                              {hasExpenses && eTotal > 0 ? item.expenses.map((e, idx) => (
                                <div key={idx} className="flex justify-between text-slate-600">
                                  <span>- {e.detail || e.category} ({formatItemDate(e.date)})</span>
                                  <span className="font-semibold">{formatCurrency(e.price)}</span>
                                </div>
                              )) : <p className="text-slate-400">-</p>}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
