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
  Maximize2,
  Edit,
  Trash2,
  Check,
  Tag,
  Briefcase,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Activity
} from 'lucide-react';
import DateFilterControl from './components/common/DateFilterControl';
import { processImageUrl } from './utils/formatters';
import ImageViewer from './components/common/ImageViewer';
import { saveProjectSync } from './services/syncService';
import ModernDateTimePicker from './components/common/ModernDateTimePicker';
import Toast from './components/common/Toast';
import ConfirmDialog from './components/common/ConfirmDialog';

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
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${mins} น.`;
};

const formatItemDateTime = (item) => {
  if (!item) return '-';
  const raw = item.rawDeliveryStart || item.rawDateTime;
  if (raw && typeof raw === 'string' && raw.includes('T')) {
    const [dPart, tPart] = raw.split('T');
    const [y, m, d] = dPart.split('-');
    const time = tPart ? tPart.substring(0, 5) : '';
    let year = parseInt(y, 10);
    return `${d}/${m}/${year}${time ? ` ${time} น.` : ''}`;
  }
  if (item.deliveryDate && typeof item.deliveryDate === 'string') {
    const firstPart = item.deliveryDate.split(' - ')[0];
    if (firstPart && firstPart.trim()) {
      return firstPart.trim() + (firstPart.includes(':') && !firstPart.includes('น.') ? ' น.' : '');
    }
  }
  if (item.date) return item.date;
  if (item.paymentDate) return formatItemDate(item.paymentDate);
  return '-';
};

const getItemLedgerDateTime = (item, entry) => {
  const raw = (entry && entry.date) || item.rawDeliveryStart || item.rawDateTime || item.paymentDate || item.deliveryDate || item.date;
  if (!raw) return { date: '-', time: '-' };

  // If raw has 'T' (ISO format e.g. 2026-11-05T16:16:23)
  if (typeof raw === 'string' && raw.includes('T')) {
    const [dPart, tPart] = raw.split('T');
    const [y, m, d] = dPart.split('-');
    const yearNum = parseInt(y, 10);
    const beYear = yearNum > 2400 ? yearNum : yearNum + 543;
    const timeStr = tPart ? tPart.substring(0, 8).replace('Z', '') : '';
    const formattedTime = timeStr ? (timeStr.includes(':') ? `${timeStr} น.` : `${timeStr} น.`) : '-';
    return {
      date: `${d}/${m}/${beYear}`,
      time: formattedTime
    };
  }

  // If raw is already DD/MM/YYYY or DD/MM/YYYY HH:mm:ss
  if (typeof raw === 'string' && /^\d{2}\/\d{2}\/\d{4}/.test(raw)) {
    const parts = raw.split(' ');
    const datePart = parts[0];
    const timePart = parts.slice(1).join(' ').trim();
    const [d, m, y] = datePart.split('/');
    const yearNum = parseInt(y, 10);
    const beYear = yearNum > 2400 ? yearNum : yearNum + 543;
    return {
      date: `${d}/${m}/${beYear}`,
      time: timePart ? (timePart.includes('น.') ? timePart : `${timePart} น.`) : '-'
    };
  }

  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const beYear = d.getFullYear() > 2400 ? d.getFullYear() : d.getFullYear() + 543;
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    const secs = String(d.getSeconds()).padStart(2, '0');
    const hasSpecificTime = hours !== '00' || mins !== '00' || secs !== '00';
    return {
      date: `${day}/${month}/${beYear}`,
      time: hasSpecificTime ? `${hours}:${mins}:${secs} น.` : '-'
    };
  }

  return { date: String(raw).split(' ')[0] || '-', time: '-' };
};

const getProjectStatementRows = (item) => {
  const rows = [];

  // 1. เงินศิลปิน (Customer Support) -> เงินโอนเข้าบัญชี = จัดเป็น "รายรับ"
  const supportItems = [];
  if (Array.isArray(item.customerSupport) && item.customerSupport.length > 0) {
    item.customerSupport.forEach((cs) => {
      const val = parseFloat(cs.price) || ((parseFloat(cs.denomination) || 0) * (parseFloat(cs.quantity) || 1)) || 0;
      if (val > 0 || (cs.denomination && cs.quantity)) {
        supportItems.push({
          name: `แบงค์ ${formatCurrency(cs.denomination)} x ${cs.quantity || 1} ใบ`,
          amount: val
        });
      }
    });
  }

  const sTotal = item._sTotal || (supportItems.reduce((sum, it) => sum + it.amount, 0));

  if (sTotal > 0 || supportItems.length > 0) {
    rows.push({
      key: `${item.id}-support`,
      type: 'support',
      typeBadge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      typeLabel: 'เงินศิลปิน',
      title: item.name || 'เงินศิลปิน (โอนเข้าบัญชี)',
      category: 'เงินสนับสนุน',
      items: supportItems.length > 0 ? supportItems : [{ name: 'ยอดเงินส่งต่อศิลปินรวม', amount: sTotal }],
      incomeAmount: sTotal,
      expenseAmount: 0,
      isIncome: true,
      paymentStatus: item._paymentStatus || 'paid',
    });
  }

  // 2. รายการขาย / ใบเสนอราคา (Quotation Items / Revenue) -> ถือเป็น "รายรับ"
  const quotationItems = [];
  if (Array.isArray(item.quotationItems) && item.quotationItems.length > 0) {
    item.quotationItems.forEach((q) => {
      const val = parseFloat(q.price) || ((parseFloat(q.unitPrice) || 0) * (parseFloat(q.quantity) || 1)) || 0;
      quotationItems.push({
        name: `${q.detail || q.category || 'รายการค่าจ้าง'}${q.quantity > 1 ? ` (${q.quantity} รายการ)` : ''}`,
        amount: val
      });
    });
  }

  const qTotal = item._qTotal || parseFloat(item.wage) || (quotationItems.reduce((sum, it) => sum + it.amount, 0));

  if (qTotal > 0 || quotationItems.length > 0) {
    rows.push({
      key: `${item.id}-quotation`,
      type: 'revenue',
      typeBadge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      typeLabel: 'รายรับ',
      title: item.name || 'ค่าจ้างโปรเจกต์',
      category: item.category || 'งานบริการ',
      items: quotationItems.length > 0 ? quotationItems : [{ name: item.name || 'ค่าจ้างโปรเจกต์', amount: qTotal }],
      incomeAmount: qTotal,
      expenseAmount: 0,
      isIncome: true,
      paymentStatus: item._paymentStatus || 'unpaid',
    });
  }

  // 3. รายจ่ายจริง (Expenses) -> ถือเป็น "รายจ่าย" (สีแดง)
  const expenseItems = [];
  if (Array.isArray(item.expenses) && item.expenses.length > 0) {
    item.expenses.forEach((ex) => {
      const val = parseFloat(ex.price) || ((parseFloat(ex.unitPrice) || 0) * (parseFloat(ex.quantity) || 1)) || 0;
      if (val > 0 || ex.detail || ex.category) {
        expenseItems.push({
          name: `${ex.detail || ex.category || 'ค่าใช้จ่าย'}${ex.quantity > 1 ? ` (${ex.quantity})` : ''}`,
          amount: val
        });
      }
    });
  }

  const eTotal = item._eTotal || parseFloat(item.totalExpenses) || (expenseItems.reduce((sum, it) => sum + it.amount, 0));

  if (eTotal > 0 || expenseItems.length > 0) {
    rows.push({
      key: `${item.id}-expense`,
      type: 'expense',
      typeBadge: 'bg-rose-50 text-rose-700 border-rose-200',
      typeLabel: 'รายจ่ายจริง',
      title: 'ค่าใช้จ่ายจริงของงาน',
      category: 'ต้นทุน/ค่าใช้จ่าย',
      items: expenseItems.length > 0 ? expenseItems : [{ name: 'ยอดค่าใช้จ่ายจริงรวม', amount: eTotal }],
      incomeAmount: 0,
      expenseAmount: eTotal,
      isIncome: false,
      paymentStatus: 'paid', // รายจ่ายถือว่าจ่ายไปแล้ว
    });
  }

  // กรณีโปรเจกต์ยังไม่มีข้อมูลใดๆ ให้แสดง 1 แถวเริ่มต้น
  if (rows.length === 0) {
    rows.push({
      key: `${item.id}-blank`,
      type: 'revenue',
      typeBadge: 'bg-slate-50 text-slate-600 border-slate-200',
      typeLabel: 'แผนงาน',
      title: item.name || 'ไม่มีชื่อโปรเจกต์',
      category: item.category || '-',
      items: [],
      incomeAmount: 0,
      expenseAmount: 0,
      isIncome: true,
      paymentStatus: item._paymentStatus || 'unpaid',
    });
  }

  return rows;
};

const getProjectFinancialItems = (item) => {
  const lineItems = [];

  // 1. เงินศิลปิน (Customer Support)
  if (Array.isArray(item.customerSupport) && item.customerSupport.length > 0) {
    item.customerSupport.forEach((cs, i) => {
      const val = parseFloat(cs.price) || ((parseFloat(cs.denomination) || 0) * (parseFloat(cs.quantity) || 1)) || 0;
      lineItems.push({
        id: cs.id || `cs-${item.id}-${i}`,
        type: 'support',
        typeLabel: 'เงินศิลปิน',
        typeBadge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        detail: `แบงค์ ${formatCurrency(cs.denomination)} บาท x ${cs.quantity || 1} ใบ`,
        amountSupport: val,
        amountRevenue: 0,
        amountExpense: 0,
      });
    });
  } else if ((item._sTotal || 0) > 0) {
    lineItems.push({
      id: `cs-sum-${item.id}`,
      type: 'support',
      typeLabel: 'เงินศิลปิน',
      typeBadge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      detail: 'ยอดเงินส่งต่อศิลปินรวม',
      amountSupport: item._sTotal,
      amountRevenue: 0,
      amountExpense: 0,
    });
  }

  // 2. รายรับ (Quotation Items / Revenue)
  if (Array.isArray(item.quotationItems) && item.quotationItems.length > 0) {
    item.quotationItems.forEach((q, i) => {
      const val = parseFloat(q.price) || ((parseFloat(q.unitPrice) || 0) * (parseFloat(q.quantity) || 1)) || 0;
      lineItems.push({
        id: q.id || `q-${item.id}-${i}`,
        type: 'revenue',
        typeLabel: 'รายรับ',
        typeBadge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        detail: `${q.detail || q.category || 'รายการค่าจ้าง'}${q.quantity > 1 ? ` (${q.quantity} รายการ)` : ''}`,
        amountSupport: 0,
        amountRevenue: val,
        amountExpense: 0,
      });
    });
  } else if ((item._qTotal || 0) > 0 || parseFloat(item.wage) > 0) {
    const val = item._qTotal || parseFloat(item.wage) || 0;
    lineItems.push({
      id: `q-sum-${item.id}`,
      type: 'revenue',
      typeLabel: 'รายรับ',
      typeBadge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      detail: item.name || 'ค่าจ้างโปรเจกต์',
      amountSupport: 0,
      amountRevenue: val,
      amountExpense: 0,
    });
  }

  // 3. รายจ่ายจริง (Expenses)
  if (Array.isArray(item.expenses) && item.expenses.length > 0) {
    item.expenses.forEach((ex, i) => {
      const val = parseFloat(ex.price) || ((parseFloat(ex.unitPrice) || 0) * (parseFloat(ex.quantity) || 1)) || 0;
      lineItems.push({
        id: ex.id || `ex-${item.id}-${i}`,
        type: 'expense',
        typeLabel: 'รายจ่ายจริง',
        typeBadge: 'bg-rose-50 text-rose-700 border-rose-200',
        detail: ex.detail || ex.category || 'ค่าใช้จ่ายจริง',
        category: ex.category || '',
        amountSupport: 0,
        amountRevenue: 0,
        amountExpense: val,
      });
    });
  } else if ((item._eTotal || 0) > 0 || parseFloat(item.totalExpenses) > 0) {
    const val = item._eTotal || parseFloat(item.totalExpenses) || 0;
    lineItems.push({
      id: `ex-sum-${item.id}`,
      type: 'expense',
      typeLabel: 'รายจ่ายจริง',
      typeBadge: 'bg-rose-50 text-rose-700 border-rose-200',
      detail: 'ยอดค่าใช้จ่ายจริงรวม',
      amountSupport: 0,
      amountRevenue: 0,
      amountExpense: val,
    });
  }

  return lineItems;
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

function FinanceView({
  activities = [],
  dealStatuses = [],
  transportStatuses = [],
  shopInfo = {},
  onOpenProjectModal,
  onSaveActivity,
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
  // 'feed' = แถวรายการรายรับ-รายจ่าย แก้ไข/ยกเลิกได้สด (Transaction Feed View - Default)
  // 'sheet' = ตารางกำไรขาดทุนแบบสมุดบัญชีสำหรับพิมพ์ A4 (Accounting Sheet View)
  // 'dashboard' = แดชบอร์ดภาพรวมพร้อมการ์ดสถิติ (Interactive Dashboard View)
  // 'slips' = ตารางสลิปโอนเงิน (Slips Table View)
  const [viewMode, setViewMode] = useState('feed');
  const [feedSearchQuery, setFeedSearchQuery] = useState('');
  const [feedTypeFilter, setFeedTypeFilter] = useState('all'); // 'all' | 'income' | 'expense' | 'support'
  const [isAddTxModalOpen, setIsAddTxModalOpen] = useState(false);
  const [isEditTxModalOpen, setIsEditTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [editFormData, setEditFormData] = useState({ detail: '', category: '', amount: 0, is_voided: false });
  const [newTxFormData, setNewTxFormData] = useState({
    type: 'income',
    code: 'INC-รอการบันทึก',
    dateTime: new Date().toISOString(),
    projectId: '',
    channel: 'โอนเงิน',
    category: 'ค่าจัดดอกไม้/บริการ',
    artist: '',
    customer: '',
    items: [{ id: 1, detail: '', quantity: 1, price: '' }],
    discountValue: 0,
    discountType: 'baht',
    taxType: 'none',
    note: ''
  });

  // Dynamic calculations for Add Transaction Modal
  const calcTxSubtotal = useMemo(() => {
    return (newTxFormData.items || []).reduce((sum, it) => {
      const q = Number(it.quantity) || 1;
      const p = Number(it.price) || 0;
      return sum + (q * p);
    }, 0);
  }, [newTxFormData.items]);

  const calcTxDiscount = useMemo(() => {
    const dVal = Number(newTxFormData.discountValue) || 0;
    if (newTxFormData.discountType === 'percent') {
      return (calcTxSubtotal * dVal) / 100;
    }
    return dVal;
  }, [calcTxSubtotal, newTxFormData.discountValue, newTxFormData.discountType]);

  const calcTxAfterDiscount = useMemo(() => {
    return Math.max(0, calcTxSubtotal - calcTxDiscount);
  }, [calcTxSubtotal, calcTxDiscount]);

  const calcTxTax = useMemo(() => {
    if (newTxFormData.taxType === 'exclude') {
      return calcTxAfterDiscount * 0.07;
    }
    if (newTxFormData.taxType === 'include') {
      return calcTxAfterDiscount - (calcTxAfterDiscount / 1.07);
    }
    return 0;
  }, [calcTxAfterDiscount, newTxFormData.taxType]);

  const calcTxNetTotal = useMemo(() => {
    if (newTxFormData.taxType === 'exclude') {
      return calcTxAfterDiscount + calcTxTax;
    }
    return calcTxAfterDiscount;
  }, [calcTxAfterDiscount, calcTxTax, newTxFormData.taxType]);

  const handleAddTxItem = () => {
    setNewTxFormData(prev => ({
      ...prev,
      items: [...prev.items, { id: Date.now(), detail: '', quantity: 1, price: '' }]
    }));
  };

  const handleRemoveTxItem = (idx) => {
    if (newTxFormData.items.length <= 1) return;
    setNewTxFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  const handleUpdateTxItem = (idx, field, val) => {
    setNewTxFormData(prev => ({
      ...prev,
      items: prev.items.map((it, i) => i === idx ? { ...it, [field]: val } : it)
    }));
  };
  const [isTxSaving, setIsTxSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'danger',
    confirmText: 'ยืนยัน',
    onConfirm: null
  });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };
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

  // Keyboard shortcut: close modals on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (previewSlipImage) setPreviewSlipImage(null);
        else if (isAddTxModalOpen) setIsAddTxModalOpen(false);
        else if (isEditTxModalOpen) setIsEditTxModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewSlipImage, isAddTxModalOpen, isEditTxModalOpen]);

  // Listen to Top Header "+ เพิ่มรายรับ/จ่าย" button event
  useEffect(() => {
    const handleTriggerCreate = () => setIsAddTxModalOpen(true);
    window.addEventListener('trigger-create-finance-tx', handleTriggerCreate);
    return () => window.removeEventListener('trigger-create-finance-tx', handleTriggerCreate);
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
  const [isDesktopFilterExpanded, setIsDesktopFilterExpanded] = useState(false);

  const handleResetFilters = () => {
    setSearchQuery('');
    setPaymentStatusFilter('all');
    setDateFilterMode('month');
    const now = new Date();
    setFilterDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    setFilterDateRange({ start: '', end: '' });
  };

  // --- Filter States ---
  // DateFilterControl modes: 'all', 'date', 'week', 'month', 'year', 'range'
  const [internalDateFilterMode, setInternalDateFilterMode] = useState('month');
  const [internalFilterDate, setInternalFilterDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
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

  // Helper สำหรับดึงและแปลงวันที่โปรเจกต์ให้เป็นมาตรฐานสากล YYYY-MM-DD (รองรับทั้ง ค.ศ. และ พ.ศ.)
  const getEffectiveItemDateStr = (item) => {
    const candidates = [
      item.rawDeliveryStart,
      item.rawDateTime,
      item.date,
      item.paymentDate,
      item.deliveryDate
    ];

    for (const val of candidates) {
      if (!val) continue;
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
          return trimmed.substring(0, 10);
        }
        if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(trimmed)) {
          const parts = trimmed.split(' ')[0].split('/');
          let y = parseInt(parts[2], 10);
          if (y > 2500) y -= 543; // แปลง พ.ศ. เป็น ค.ศ.
          const mm = String(parts[1]).padStart(2, '0');
          const dd = String(parts[0]).padStart(2, '0');
          return `${y}-${mm}-${dd}`;
        }
      }
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
    }
    return '';
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
        const itemDateStr = getEffectiveItemDateStr(item);
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

  // =========================================================================
  // TRANSACTION FEED: Extract Row-by-Row Line Items (Zero-Egress & Interactive)
  // =========================================================================
  const feedTransactions = useMemo(() => {
    const list = [];
    for (let i = 0; i < processedData.length; i++) {
      const p = processedData[i];

      // 1. Income Items (Quotation Items or Base Wage)
      if (p.quotationItems && p.quotationItems.length > 0) {
        p.quotationItems.forEach((q, idx) => {
          list.push({
            id: q.id || `${p.id}-q-${idx}`,
            projectId: p.id,
            projectName: p.name,
            customer: p.customer,
            artist: p.artist,
            date: q.date || p.deliveryDate || p.rawDateTime || '',
            category: q.category || 'ค่าจัดดอกไม้/บริการ',
            detail: q.detail || 'รายการเสนอราคา',
            type: 'income',
            amount: Number(q.price) || 0,
            quantity: Number(q.quantity) || 1,
            unitPrice: Number(q.unitPrice) || Number(q.price) || 0,
            status: p._paymentStatus || 'unpaid',
            isVoided: Boolean(q.is_voided),
            rawItem: q,
            parentProject: p
          });
        });
      } else if (p.wage || p.deliveryFee) {
        const totalW = (Number(p.wage) || 0) + (Number(p.deliveryFee) || 0);
        list.push({
          id: `${p.id}-wage`,
          projectId: p.id,
          projectName: p.name,
          customer: p.customer,
          artist: p.artist,
          date: p.deliveryDate || p.rawDateTime || '',
          category: 'ค่าบริการจัดดอกไม้',
          detail: 'ค่าจ้างรวม' + (p.deliveryFee ? ` (รวมส่ง ${p.deliveryFee})` : ''),
          type: 'income',
          amount: totalW,
          quantity: 1,
          unitPrice: totalW,
          status: p._paymentStatus || 'unpaid',
          isVoided: false,
          rawItem: null,
          parentProject: p
        });
      }

      // 2. Expense Items
      (p.expenses || []).forEach((e, idx) => {
        list.push({
          id: e.id || `${p.id}-e-${idx}`,
          projectId: p.id,
          projectName: p.name,
          customer: p.customer,
          artist: p.artist,
          date: e.date || p.deliveryDate || p.rawDateTime || '',
          category: e.category || 'ค่าใช้จ่ายทั่วไป',
          detail: e.detail || 'ซื้อของ/อุปกรณ์',
          type: 'expense',
          amount: Number(e.price) || 0,
          quantity: Number(e.quantity) || 1,
          unitPrice: Number(e.unitPrice) || Number(e.price) || 0,
          status: 'paid',
          isVoided: Boolean(e.is_voided),
          rawItem: e,
          parentProject: p
        });
      });

      // 3. Customer Support Items
      (p.customerSupport || []).forEach((cs, idx) => {
        const denom = Number(cs.denomination) || 0;
        const qty = Number(cs.quantity) || 0;
        const price = Number(cs.price) || (denom * qty);
        list.push({
          id: cs.id || `${p.id}-cs-${idx}`,
          projectId: p.id,
          projectName: p.name,
          customer: p.customer,
          artist: p.artist,
          date: cs.date || p.deliveryDate || p.rawDateTime || '',
          category: 'เงินสนับสนุนศิลปิน',
          detail: `ธนบัตร ฿${denom.toLocaleString()} x ${qty} ใบ`,
          type: 'support',
          amount: price,
          quantity: qty,
          unitPrice: denom,
          status: 'paid',
          isVoided: false,
          rawItem: cs,
          parentProject: p
        });
      });
    }

    return list.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.projectId.localeCompare(a.projectId));
  }, [processedData]);

  // Filtered Feed Transactions
  const filteredFeedTransactions = useMemo(() => {
    return feedTransactions.filter(tx => {
      const q = feedSearchQuery.toLowerCase().trim();
      const matchSearch = !q ||
        tx.projectId.toLowerCase().includes(q) ||
        tx.detail.toLowerCase().includes(q) ||
        tx.category.toLowerCase().includes(q) ||
        (tx.customer && tx.customer.toLowerCase().includes(q)) ||
        (tx.artist && tx.artist.toLowerCase().includes(q));

      const matchType = feedTypeFilter === 'all' || tx.type === feedTypeFilter;
      return matchSearch && matchType;
    });
  }, [feedTransactions, feedSearchQuery, feedTypeFilter]);

  // Handlers for Transaction Feed Actions
  const handleOpenEditTx = (tx) => {
    setEditingTx(tx);
    setEditFormData({
      detail: tx.detail,
      category: tx.category,
      amount: tx.amount,
      is_voided: tx.isVoided
    });
    setIsEditTxModalOpen(true);
  };

  const handleSaveEditTx = async (e) => {
    e.preventDefault();
    if (!editingTx) return;
    setIsTxSaving(true);
    try {
      const project = activities.find(a => a.id === editingTx.projectId);
      if (!project) throw new Error('ไม่พบข้อมูลโปรเจกต์งาน');
      const clone = JSON.parse(JSON.stringify(project));

      if (editingTx.type === 'expense') {
        clone.expenses = (clone.expenses || []).map(e => {
          if (e.id === editingTx.id || (e.detail === editingTx.detail && Number(e.price) === Number(editingTx.amount))) {
            return {
              ...e,
              detail: editFormData.detail,
              category: editFormData.category,
              price: Number(editFormData.amount),
              unit_price: Number(editFormData.amount),
              is_voided: editFormData.is_voided
            };
          }
          return e;
        });
      } else if (editingTx.type === 'income') {
        if (clone.quotationItems && clone.quotationItems.length > 0) {
          clone.quotationItems = clone.quotationItems.map(q => {
            if (q.id === editingTx.id || (q.detail === editingTx.detail && Number(q.price) === Number(editingTx.amount))) {
              return {
                ...q,
                detail: editFormData.detail,
                category: editFormData.category,
                price: Number(editFormData.amount),
                unit_price: Number(editFormData.amount),
                is_voided: editFormData.is_voided
              };
            }
            return q;
          });
        } else {
          clone.wage = Number(editFormData.amount);
        }
      }

      // Recalculate totals
      const totalRev = (clone.quotationItems || []).reduce((s, q) => s + (q.is_voided ? 0 : Number(q.price) || 0), 0) || (Number(clone.wage) || 0) + (Number(clone.deliveryFee) || 0);
      const totalExp = (clone.expenses || []).reduce((s, e) => s + (e.is_voided ? 0 : Number(e.price) || 0), 0);
      clone.totalRevenue = totalRev;
      clone.totalExpenses = totalExp;
      clone.netProfit = totalRev - totalExp;

      await saveProjectSync(clone);
      if (onSaveActivity) onSaveActivity(clone);
      setIsEditTxModalOpen(false);
      showToast('บันทึกการแก้ไขเรียบร้อย', 'success');
    } catch (err) {
      showToast('บันทึกการแก้ไขไม่สำเร็จ: ' + err.message, 'error');
    } finally {
      setIsTxSaving(false);
    }
  };

  const handleToggleVoidTx = (tx) => {
    const willVoid = !tx.isVoided;
    const confirmMsg = willVoid
      ? `คุณต้องการยกเลิก (Void) รายการ "${tx.detail}" (฿${tx.amount.toLocaleString()}) หรือไม่? ยอดนี้จะไม่ถูกนำไปคิดกำไรขาดทุน`
      : `คุณต้องการเปิดใช้งานรายการ "${tx.detail}" คืนสู่บัญชีหรือไม่?`;

    setConfirmDialog({
      isOpen: true,
      title: willVoid ? 'ยืนยันการยกเลิกรายการ' : 'ยืนยันการกู้คืนรายการ',
      message: confirmMsg,
      type: willVoid ? 'warning' : 'info',
      confirmText: willVoid ? 'ยกเลิกรายการ' : 'เปิดใช้งานรายการ',
      onConfirm: async () => {
        try {
          const project = activities.find(a => a.id === tx.projectId);
          if (!project) return;
          const clone = JSON.parse(JSON.stringify(project));

          if (tx.type === 'expense') {
            clone.expenses = (clone.expenses || []).map(e => {
              if (e.id === tx.id || (e.detail === tx.detail && Number(e.price) === Number(tx.amount))) {
                return { ...e, is_voided: willVoid };
              }
              return e;
            });
          } else if (tx.type === 'income') {
            if (clone.quotationItems && clone.quotationItems.length > 0) {
              clone.quotationItems = clone.quotationItems.map(q => {
                if (q.id === tx.id || (q.detail === tx.detail && Number(q.price) === Number(tx.amount))) {
                  return { ...q, is_voided: willVoid };
                }
                return q;
              });
            }
          }

          const totalRev = (clone.quotationItems || []).reduce((s, q) => s + (q.is_voided ? 0 : Number(q.price) || 0), 0) || (Number(clone.wage) || 0) + (Number(clone.deliveryFee) || 0);
          const totalExp = (clone.expenses || []).reduce((s, e) => s + (e.is_voided ? 0 : Number(e.price) || 0), 0);
          clone.totalRevenue = totalRev;
          clone.totalExpenses = totalExp;
          clone.netProfit = totalRev - totalExp;

          await saveProjectSync(clone);
          if (onSaveActivity) onSaveActivity(clone);
          showToast(willVoid ? 'ยกเลิกรายการเรียบร้อย' : 'กู้คืนรายการเรียบร้อย', 'success');
        } catch (err) {
          showToast('ยกเลิกรายการไม่สำเร็จ: ' + err.message, 'error');
        } finally {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleDeleteTx = (tx) => {
    setConfirmDialog({
      isOpen: true,
      title: 'ยืนยันการลบรายการ',
      message: `ต้องการลบรายการ "${tx.detail}" (฿${tx.amount.toLocaleString()}) ออกจากระบบถาวรหรือไม่?`,
      type: 'danger',
      confirmText: 'ยืนยันลบ',
      onConfirm: async () => {
        try {
          const project = activities.find(a => a.id === tx.projectId);
          if (!project) return;
          const clone = JSON.parse(JSON.stringify(project));

          if (tx.type === 'expense') {
            clone.expenses = (clone.expenses || []).filter(e => e.id !== tx.id && !(e.detail === tx.detail && Number(e.price) === Number(tx.amount)));
          } else if (tx.type === 'income') {
            if (clone.quotationItems && clone.quotationItems.length > 0) {
              clone.quotationItems = clone.quotationItems.filter(q => q.id !== tx.id && !(q.detail === tx.detail && Number(q.price) === Number(tx.amount)));
            }
          } else if (tx.type === 'support') {
            clone.customerSupport = (clone.customerSupport || []).filter(cs => cs.id !== tx.id);
          }

          const totalRev = (clone.quotationItems || []).reduce((s, q) => s + (q.is_voided ? 0 : Number(q.price) || 0), 0) || (Number(clone.wage) || 0) + (Number(clone.deliveryFee) || 0);
          const totalExp = (clone.expenses || []).reduce((s, e) => s + (e.is_voided ? 0 : Number(e.price) || 0), 0);
          clone.totalRevenue = totalRev;
          clone.totalExpenses = totalExp;
          clone.netProfit = totalRev - totalExp;

          await saveProjectSync(clone);
          if (onSaveActivity) onSaveActivity(clone);
          showToast('ลบรายการเรียบร้อย', 'success');
        } catch (err) {
          showToast('ลบรายการไม่สำเร็จ: ' + err.message, 'error');
        } finally {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleCreateTx = async (e) => {
    e.preventDefault();
    const validItems = (newTxFormData.items || []).filter(it => it.detail.trim() && Number(it.price) > 0);
    if (validItems.length === 0) {
      showToast('กรุณากรอกรายละเอียดและราคาอย่างน้อย 1 รายการ', 'error');
      return;
    }

    setIsTxSaving(true);
    try {
      const pId = (newTxFormData.projectId || '').trim() || `P-${Date.now().toString().slice(-4)}`;
      let project = activities.find(a => a.id.toLowerCase() === pId.toLowerCase());

      if (!project) {
        // Create auto fallback project container so transaction is never lost
        project = {
          id: pId,
          name: newTxFormData.customer ? `งาน ${newTxFormData.customer}` : `รายการ ${pId}`,
          customer: newTxFormData.customer || 'ลูกค้าทั่วไป',
          artist: newTxFormData.artist || '',
          category: newTxFormData.category || (newTxFormData.type === 'income' ? 'ค่าจัดดอกไม้/บริการ' : 'ค่าใช้จ่ายทั่วไป'),
          deliveryDate: newTxFormData.dateTime ? newTxFormData.dateTime.substring(0, 10) : new Date().toISOString().substring(0, 10),
          rawDateTime: newTxFormData.dateTime || new Date().toISOString(),
          paymentChannel: newTxFormData.channel || 'โอนเงิน',
          paymentStatus: 'paid',
          quotationItems: [],
          expenses: [],
          customerSupport: [],
          totalRevenue: 0,
          totalExpenses: 0,
          netProfit: 0
        };
      }

      const clone = JSON.parse(JSON.stringify(project));
      if (newTxFormData.artist) clone.artist = newTxFormData.artist;
      if (newTxFormData.customer) clone.customer = newTxFormData.customer;
      if (newTxFormData.channel) clone.paymentChannel = newTxFormData.channel;

      const txDate = newTxFormData.dateTime || new Date().toISOString();

      validItems.forEach((it, idx) => {
        const lineId = `tx_${Date.now()}_${idx}`;
        const qty = Number(it.quantity) || 1;
        const unitP = Number(it.price) || 0;
        const linePrice = qty * unitP;

        if (newTxFormData.type === 'expense') {
          if (!clone.expenses) clone.expenses = [];
          clone.expenses.push({
            id: lineId,
            category: newTxFormData.category || 'ค่าใช้จ่ายทั่วไป',
            detail: it.detail.trim(),
            quantity: qty,
            unit_price: unitP,
            unitPrice: unitP,
            price: linePrice,
            date: txDate,
            paymentChannel: newTxFormData.channel || 'โอนเงิน',
            is_voided: false
          });
        } else if (newTxFormData.type === 'income') {
          if (!clone.quotationItems) clone.quotationItems = [];
          clone.quotationItems.push({
            id: lineId,
            category: newTxFormData.category || 'ค่าจัดดอกไม้/บริการ',
            detail: it.detail.trim(),
            quantity: qty,
            unit_price: unitP,
            unitPrice: unitP,
            price: linePrice,
            date: txDate,
            paymentChannel: newTxFormData.channel || 'โอนเงิน',
            is_voided: false
          });
        }
      });

      // Recalculate totals
      const totalRev = (clone.quotationItems || []).reduce((s, q) => s + (q.is_voided ? 0 : Number(q.price) || 0), 0) || (Number(clone.wage) || 0) + (Number(clone.deliveryFee) || 0);
      const totalExp = (clone.expenses || []).reduce((s, e) => s + (e.is_voided ? 0 : Number(e.price) || 0), 0);
      clone.totalRevenue = totalRev;
      clone.totalExpenses = totalExp;
      clone.netProfit = totalRev - totalExp;

      await saveProjectSync(clone);
      if (onSaveActivity) onSaveActivity(clone);
      setIsAddTxModalOpen(false);
      setNewTxFormData({
        type: 'income',
        code: 'INC-รอการบันทึก',
        dateTime: new Date().toISOString(),
        projectId: '',
        channel: 'โอนเงิน',
        category: 'ค่าจัดดอกไม้/บริการ',
        artist: '',
        customer: '',
        items: [{ id: Date.now(), detail: '', quantity: 1, price: '' }],
        discountValue: 0,
        discountType: 'baht',
        taxType: 'none',
        note: ''
      });
      showToast(`บันทึก${newTxFormData.type === 'income' ? 'รายรับ' : 'รายจ่าย'} ${validItems.length} รายการ เรียบร้อย`, 'success');
    } catch (err) {
      showToast('เพิ่มรายการไม่สำเร็จ: ' + err.message, 'error');
    } finally {
      setIsTxSaving(false);
    }
  };
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
      showToast('เบราว์เซอร์บล็อกหน้าต่างใหม่ (Pop-up Blocked) กรุณากดอนุญาตให้เปิดหน้าต่าง Pop-up เพื่อพิมพ์เอกสาร', 'error');
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
      showToast('ไม่มีข้อมูลสำหรับส่งออก', 'warning');
      return;
    }

    const headers = [
      "รหัสงาน",
      "วันที่",
      "ชื่องาน",
      "ลูกค้า",
      "ศิลปิน",
      "สถานะการชำระเงิน",
      "ยอดเงินสนับสนุนศิลปิน",
      "ยอดใบเสนอราคา",
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
        sTotal,
        qTotal,
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
        <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200 shrink-0 overflow-x-auto">
          <button
            onClick={() => handleViewModeChange('feed')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              viewMode === 'feed'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <LayoutList className="w-4 h-4 text-emerald-600" />
            <span>รายรับ-รายจ่าย</span>
          </button>
          <button
            onClick={() => handleViewModeChange('sheet')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              viewMode === 'sheet'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <TableIcon className="w-4 h-4 text-indigo-600" />
            <span>ตารางบัญชี (พิมพ์)</span>
          </button>
          <button
            onClick={() => handleViewModeChange('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              viewMode === 'dashboard'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart2 className="w-4 h-4 text-sky-600" />
            <span>การ์ดสรุป</span>
          </button>
          <button
            onClick={() => handleViewModeChange('slips')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
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
          FINANCIAL KPI CARDS (Adaptive, Balanced, Fully Responsive)
         ========================================================================= */}
      <div className="no-print grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5 lg:gap-4">
        {/* Card 1: เงินสนับสนุนศิลปิน */}
        <div className="bg-white p-3 sm:p-4 lg:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-[0_2px_12px_rgb(0,0,0,0.03)] hover:shadow-md transition flex flex-col justify-between group">
          <div className="flex items-center justify-between mb-1.5 sm:mb-2">
            <span className="text-xs sm:text-sm font-bold text-slate-500">เงินสนับสนุน</span>
            <div className="p-1.5 sm:p-2 bg-indigo-50 text-indigo-600 rounded-xl group-hover:scale-110 transition-transform">
              <Gift className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="my-1.5 sm:my-2 flex flex-col justify-center">
            {(() => {
              const formatted = formatCurrency(financialSummary.totalSupport);
              const len = formatted.length;
              const sizeClass = len >= 13
                ? 'text-base sm:text-xl md:text-base lg:text-xl xl:text-2xl 2xl:text-3xl'
                : len >= 9
                  ? 'text-lg sm:text-2xl md:text-lg lg:text-2xl xl:text-3xl 2xl:text-4xl'
                  : 'text-xl sm:text-3xl md:text-xl lg:text-3xl xl:text-4xl 2xl:text-5xl';
              return (
                <div className="flex items-baseline font-black tracking-tight text-indigo-700 truncate tabular-nums">
                  <span className="text-xs sm:text-sm font-bold opacity-60 mr-0.5 select-none shrink-0">฿</span>
                  <span className={`${sizeClass} truncate`}>{formatted}</span>
                </div>
              );
            })()}
          </div>
          <div className="flex items-center justify-between mt-1.5 pt-2 sm:mt-2 sm:pt-2.5 border-t border-slate-100 text-xs text-slate-500 font-medium">
            <span className="text-[11px] sm:text-xs text-slate-600 font-medium whitespace-nowrap">ส่งต่อศิลปิน</span>
            <span className="inline-flex items-center font-medium text-[10px] sm:text-xs text-slate-600 bg-slate-100 px-1.5 sm:px-2 py-0.5 rounded-full shrink-0">
              ไม่หักกำไร
            </span>
          </div>
        </div>

        {/* Card 2: รายรับรวม */}
        <div className="bg-white p-3 sm:p-4 lg:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-[0_2px_12px_rgb(0,0,0,0.03)] hover:shadow-md transition flex flex-col justify-between group">
          <div className="flex items-center justify-between mb-1.5 sm:mb-2">
            <span className="text-xs sm:text-sm font-bold text-slate-500">รายรับรวม</span>
            <div className="p-1.5 sm:p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform">
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="my-1.5 sm:my-2 flex flex-col justify-center">
            {(() => {
              const formatted = formatCurrency(financialSummary.totalRevenue);
              const len = formatted.length;
              const sizeClass = len >= 13
                ? 'text-base sm:text-xl md:text-base lg:text-xl xl:text-2xl 2xl:text-3xl'
                : len >= 9
                  ? 'text-lg sm:text-2xl md:text-lg lg:text-2xl xl:text-3xl 2xl:text-4xl'
                  : 'text-xl sm:text-3xl md:text-xl lg:text-3xl xl:text-4xl 2xl:text-5xl';
              return (
                <div className="flex items-baseline font-black tracking-tight text-slate-900 truncate tabular-nums">
                  <span className="text-xs sm:text-sm font-bold opacity-60 mr-0.5 select-none shrink-0">฿</span>
                  <span className={`${sizeClass} truncate`}>{formatted}</span>
                </div>
              );
            })()}
          </div>
          <div className="flex items-center justify-between mt-1.5 pt-2 sm:mt-2 sm:pt-2.5 border-t border-slate-100 text-xs text-slate-500 font-medium">
            <span className="text-[11px] sm:text-xs text-slate-500 font-medium whitespace-nowrap" title={`ยอดจ้างรวม: ฿${formatCurrency(financialSummary.totalQuotation)}`}>ยอดจ้างรวม</span>
            <span className="inline-flex items-center font-bold text-[11px] sm:text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100/60 shrink-0">
              {financialSummary.projectCount} งาน
            </span>
          </div>
        </div>

        {/* Card 3: รายจ่ายจริง (ต้นทุน) */}
        <div className="bg-white p-3 sm:p-4 lg:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-[0_2px_12px_rgb(0,0,0,0.03)] hover:shadow-md transition flex flex-col justify-between group">
          <div className="flex items-center justify-between mb-1.5 sm:mb-2">
            <span className="text-xs sm:text-sm font-bold text-slate-500">รายจ่ายจริง</span>
            <div className="p-1.5 sm:p-2 bg-rose-50 text-rose-600 rounded-xl group-hover:scale-110 transition-transform">
              <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="my-1.5 sm:my-2 flex flex-col justify-center">
            {(() => {
              const formatted = formatCurrency(financialSummary.totalExpenses);
              const len = formatted.length;
              const sizeClass = len >= 13
                ? 'text-base sm:text-xl md:text-base lg:text-xl xl:text-2xl 2xl:text-3xl'
                : len >= 9
                  ? 'text-lg sm:text-2xl md:text-lg lg:text-2xl xl:text-3xl 2xl:text-4xl'
                  : 'text-xl sm:text-3xl md:text-xl lg:text-3xl xl:text-4xl 2xl:text-5xl';
              return (
                <div className="flex items-baseline font-black tracking-tight text-rose-600 truncate tabular-nums">
                  <span className="text-xs sm:text-sm font-bold opacity-60 mr-0.5 select-none shrink-0">฿</span>
                  <span className={`${sizeClass} truncate`}>{formatted}</span>
                </div>
              );
            })()}
          </div>
          <div className="flex items-center justify-between mt-1.5 pt-2 sm:mt-2 sm:pt-2.5 border-t border-slate-100 text-xs text-slate-500 font-medium">
            <span className="text-[11px] sm:text-xs text-slate-500 font-medium whitespace-nowrap">ต้นทุนต่องาน</span>
            <span className="inline-flex items-center font-bold text-[11px] sm:text-xs text-rose-700 bg-rose-50 px-1.5 sm:px-2 py-0.5 rounded-full border border-rose-100/60 shrink-0">
              {financialSummary.totalQuotation > 0
                ? `${((financialSummary.totalExpenses / financialSummary.totalQuotation) * 100).toFixed(1)}%`
                : '0%'}
            </span>
          </div>
        </div>

        {/* Card 4: กำไรคงเหลือสุทธิ (Hero Card) */}
        <div className="bg-gradient-to-br from-white via-white to-emerald-50/50 p-3 sm:p-4 lg:p-5 rounded-2xl sm:rounded-3xl border border-emerald-200/80 shadow-[0_2px_12px_rgb(16,185,129,0.08)] hover:shadow-md transition flex flex-col justify-between group">
          <div className="flex items-center justify-between mb-1.5 sm:mb-2">
            <span className="text-xs sm:text-sm font-bold text-emerald-800">คงเหลือสุทธิ (กำไร)</span>
            <div className="p-1.5 sm:p-2 bg-emerald-600 text-white rounded-xl group-hover:scale-110 transition-transform shadow-xs">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="my-1.5 sm:my-2 flex flex-col justify-center">
            {(() => {
              const formatted = formatCurrency(financialSummary.totalProfit);
              const len = formatted.length;
              const sizeClass = len >= 13
                ? 'text-base sm:text-xl md:text-base lg:text-xl xl:text-2xl 2xl:text-3xl'
                : len >= 9
                  ? 'text-lg sm:text-2xl md:text-lg lg:text-2xl xl:text-3xl 2xl:text-4xl'
                  : 'text-xl sm:text-3xl md:text-xl lg:text-3xl xl:text-4xl 2xl:text-5xl';
              const colorClass = financialSummary.totalProfit >= 0 ? 'text-emerald-700' : 'text-rose-600';
              return (
                <div className={`flex items-baseline font-black tracking-tight ${colorClass} truncate tabular-nums`}>
                  <span className="text-xs sm:text-sm font-bold opacity-60 mr-0.5 select-none shrink-0">฿</span>
                  <span className={`${sizeClass} truncate`}>{formatted}</span>
                </div>
              );
            })()}
          </div>
          <div className="flex items-center justify-between mt-1.5 pt-2 sm:mt-2 sm:pt-2.5 border-t border-emerald-100/80 text-xs font-semibold text-emerald-800">
            <span className="text-[11px] sm:text-xs text-emerald-800 font-bold whitespace-nowrap">Margin สุทธิ</span>
            <span className="inline-flex items-center gap-1 font-bold text-[11px] sm:text-xs text-emerald-800 bg-emerald-100/80 px-1.5 sm:px-2 py-0.5 rounded-full border border-emerald-200/80 shrink-0">
              <TrendingUp className="w-3 h-3 text-emerald-600 shrink-0" />
              <span>{financialSummary.netMarginPercent}%</span>
            </span>
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

        {/* --- DESKTOP FILTER LAYOUT (แถวเดียวเป็นค่าเริ่มต้น กดปุ่มเพื่อเปิดตัวกรองเพิ่มเติม) --- */}
        <div className="hidden md:flex flex-col gap-2.5">
          {/* แถวที่ 1: ค้นหา + ตัวเลือกวันที่ + ปุ่มตัวกรองเพิ่มเติม + ปุ่มรีเซ็ต */}
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
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
                  title="ล้างข้อความค้นหา"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* เลือกวันที่ Desktop */}
            <div className="flex-1 min-w-[280px]">
              <DateFilterControl
                mode={dateFilterMode}
                setMode={setDateFilterMode}
                date={filterDate}
                setDate={setFilterDate}
                range={filterDateRange}
                setRange={setFilterDateRange}
              />
            </div>

            {/* ปุ่มเปิด/ซ่อนตัวกรองเพิ่มเติม Desktop */}
            <button
              type="button"
              onClick={() => setIsDesktopFilterExpanded(!isDesktopFilterExpanded)}
              className={`h-[48px] px-3.5 rounded-2xl font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 active:scale-95 border cursor-pointer ${
                isDesktopFilterExpanded 
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-200' 
                  : (paymentStatusFilter !== 'all' || sortOrder !== 'desc')
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
              }`}
              title={isDesktopFilterExpanded ? "ซ่อนตัวกรองเพิ่มเติม" : "เปิดตัวกรองเพิ่มเติม"}
              aria-label="ตัวกรอง"
            >
              <SlidersHorizontal className="w-4 h-4" />
              {(paymentStatusFilter !== 'all' || sortOrder !== 'desc') && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  isDesktopFilterExpanded ? 'bg-white text-indigo-600' : 'bg-indigo-200 text-indigo-800'
                }`}>
                  {[paymentStatusFilter !== 'all', sortOrder !== 'desc'].filter(Boolean).length}
                </span>
              )}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isDesktopFilterExpanded ? 'rotate-180' : ''}`} />
            </button>

            {/* ปุ่มรีเซ็ตฟิลเตอร์ Desktop */}
            <button
              onClick={handleResetFilters}
              className="px-5 bg-slate-50 border border-slate-200/70 text-slate-500 rounded-2xl font-bold hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors flex items-center justify-center shadow-xs shrink-0 cursor-pointer active:scale-95"
              title="ล้างค่าตัวกรองทั้งหมด"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* แถวที่ 2: สถานะการชำระ + สลับเรียงลำดับ (ซ่อนเริ่มต้น แสดงเมื่อกดปุ่มตัวกรอง) */}
          {isDesktopFilterExpanded && (
            <div className="flex gap-3 h-[48px] pt-1 animate-in slide-in-from-top-2 fade-in duration-200">
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
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          VIEW 0: FINANCIAL COLUMN TABLE VIEW (ตารางคอลัมน์การเงิน รายรับ-รายจ่าย)
         ========================================================================= */}
      {viewMode === 'feed' && (
        <div className="space-y-4">
          {/* Desktop View: Modern Financial Column Table (เหมือนหน้าแผนงาน คอลัมน์ชัดเจน โฟกัสเฉพาะตัวเลขการเงิน) */}
          <div className="hidden md:block bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-[1050px] table-auto border-collapse">
                <thead>
                  <tr className="text-slate-400 text-xs font-bold border-b border-slate-200 bg-slate-50/80 select-none">
                    <th className="w-[13%] min-w-[125px] px-4 py-3.5 text-left">วันที่/เวลา</th>
                    <th className="w-[11%] min-w-[110px] px-4 py-3.5 text-left">เลขที่บิล</th>
                    <th className="w-[28%] min-w-[260px] px-4 py-3.5 text-left">รายละเอียด</th>
                    <th className="w-[12%] min-w-[120px] px-4 py-3.5 text-left">ประเภท/หมวดหมู่</th>
                    <th className="w-[14%] min-w-[140px] px-4 py-3.5 text-left">ลูกค้า / ศิลปิน</th>
                    <th className="w-[12%] min-w-[120px] px-4 py-3.5 text-right font-black text-slate-700">จำนวนเงิน</th>
                    <th className="w-[10%] min-w-[95px] px-4 py-3.5 text-center">สถานะ</th>
                    <th className="w-[10%] min-w-[90px] px-4 py-3.5 text-right">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {visibleSheetData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-slate-400">
                        <LayoutList className="w-12 h-12 mx-auto mb-2 text-slate-300 opacity-80" />
                        <p className="font-medium text-slate-500">ไม่พบข้อมูลโปรเจกต์การเงินตามเงื่อนไขที่เลือก</p>
                      </td>
                    </tr>
                  ) : (
                    visibleSheetData.map((item, projectIdx) => {
                      const statementRows = getProjectStatementRows(item);

                      return (
                        <React.Fragment key={item.id || projectIdx}>
                          {statementRows.map((entry, rowIdx) => {
                            const isFirstRow = rowIdx === 0;
                            const dtParts = getItemLedgerDateTime(item, entry);

                            return (
                              <tr
                                key={entry.key}
                                onClick={() => onOpenProjectModal && onOpenProjectModal(item)}
                                className={`transition-colors group cursor-pointer border-b border-slate-100 ${
                                  isFirstRow
                                    ? 'border-t-2 border-slate-200/90 bg-white hover:bg-slate-50/90'
                                    : 'bg-slate-50/40 hover:bg-slate-100/70'
                                }`}
                              >
                                {/* 1. วันที่/เวลา */}
                                <td className="px-4 py-3.5 align-top">
                                  <div className="flex flex-col items-start leading-tight">
                                    <span className="font-bold text-xs text-slate-900">
                                      {dtParts.date}
                                    </span>
                                    <span className="text-[11px] text-slate-500 font-mono mt-0.5">
                                      {dtParts.time}
                                    </span>
                                  </div>
                                </td>

                                {/* 2. เลขที่บิล */}
                                <td className="px-4 py-3.5 align-top">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`font-mono font-black text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                                        isFirstRow
                                          ? 'text-sky-700 bg-sky-50 border-sky-200'
                                          : 'text-slate-600 bg-slate-100/80 border-slate-200'
                                      }`}
                                    >
                                      {item.id}
                                    </span>
                                    {!isFirstRow && (
                                      <span className="text-[10px] text-slate-400 font-mono select-none">↳</span>
                                    )}
                                  </div>
                                </td>

                                {/* 3. รายละเอียด */}
                                <td className="px-4 py-3.5 align-top">
                                  <div className="flex flex-col gap-1">
                                    <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-sm leading-snug">
                                      {entry.title}
                                    </h4>
                                    {entry.items && entry.items.length > 0 && (
                                      <div className="mt-1 space-y-0.5 text-xs text-slate-600">
                                        {entry.items.map((it, itIdx) => (
                                          <div key={itIdx} className="flex items-center gap-1.5 py-0.5">
                                            <span className="text-slate-400">•</span>
                                            <span className="font-medium text-slate-700">{it.name}</span>
                                            {it.amount > 0 && (
                                              <span className="text-slate-500 font-mono text-[11px]">
                                                (฿{formatCurrency(it.amount)})
                                              </span>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </td>

                                {/* 4. ประเภท/หมวดหมู่ */}
                                <td className="px-4 py-3.5 align-top">
                                  <div className="flex flex-col gap-1 items-start">
                                    <span
                                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border whitespace-nowrap ${entry.typeBadge}`}
                                    >
                                      {entry.typeLabel}
                                    </span>
                                    {entry.category && entry.category !== '-' && (
                                      <span className="text-[10px] font-semibold text-slate-500 px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200">
                                        {entry.category}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* 5. ลูกค้า / ศิลปิน (Strictly Artist on top, Customer below) */}
                                <td className="px-4 py-3.5 align-top">
                                  <div className="flex flex-col gap-1 text-xs">
                                    {item.artist ? (
                                      <div className="flex items-center gap-1.5 text-indigo-600 font-bold">
                                        <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                        <span className="truncate">{item.artist}</span>
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 text-xs">-</span>
                                    )}
                                    {item.customer && (
                                      <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                                        <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <span className="truncate">{item.customer}</span>
                                      </div>
                                    )}
                                  </div>
                                </td>

                                {/* 6. จำนวนเงิน (+฿... emerald green, -฿... rose red) */}
                                <td className="px-4 py-3.5 align-top text-right tabular-nums">
                                  {entry.isIncome && entry.incomeAmount > 0 ? (
                                    <div className="flex flex-col items-end">
                                      <span className="font-black text-sm text-emerald-600">
                                        +฿{formatCurrency(entry.incomeAmount)}
                                      </span>
                                      <span className="text-[10px] text-emerald-700/70 font-semibold">
                                        {entry.type === 'support' ? 'เงินศิลปิน' : 'รายรับ'}
                                      </span>
                                    </div>
                                  ) : !entry.isIncome && entry.expenseAmount > 0 ? (
                                    <div className="flex flex-col items-end">
                                      <span className="font-black text-sm text-rose-600">
                                        -฿{formatCurrency(entry.expenseAmount)}
                                      </span>
                                      <span className="text-[10px] text-rose-600/70 font-semibold">รายจ่ายจริง</span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-300 font-mono">฿0</span>
                                  )}
                                </td>

                                {/* 7. สถานะ */}
                                <td className="px-4 py-3.5 align-top text-center">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap ${
                                      entry.paymentStatus === 'paid'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : entry.paymentStatus === 'deposit'
                                        ? 'bg-sky-50 text-sky-700 border-sky-200'
                                        : entry.paymentStatus === 'cancelled'
                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        entry.paymentStatus === 'paid'
                                          ? 'bg-emerald-500'
                                          : entry.paymentStatus === 'deposit'
                                          ? 'bg-sky-500'
                                          : entry.paymentStatus === 'cancelled'
                                          ? 'bg-rose-500'
                                          : 'bg-amber-500'
                                      }`}
                                    />
                                    {entry.paymentStatus === 'paid'
                                      ? 'ชำระแล้ว'
                                      : entry.paymentStatus === 'deposit'
                                      ? 'ชำระมัดจำ'
                                      : entry.paymentStatus === 'cancelled'
                                      ? 'ยกเลิก'
                                      : 'รอชำระเงิน'}
                                  </span>
                                </td>

                                {/* 8. ดำเนินการ */}
                                <td className="px-4 py-3.5 align-top text-right" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center justify-end gap-1.5">
                                    {item._slips && item._slips.length > 0 && isFirstRow && (
                                      <button
                                        type="button"
                                        onClick={() => setPreviewSlipImage(item._slips[0])}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition font-bold text-xs cursor-pointer shadow-xs"
                                        title="คลิกเพื่อดูสลิปหลักฐานโอนเงิน"
                                      >
                                        <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>{item._slips.length}</span>
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => onOpenProjectModal && onOpenProjectModal(item)}
                                      className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition cursor-pointer"
                                      title="เปิดดูรายละเอียดโปรเจกต์"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setNewTxFormData(prev => ({
                                          ...prev,
                                          projectId: item.id,
                                          customer: item.customer || '',
                                          artist: item.artist || ''
                                        }));
                                        setIsAddTxModalOpen(true);
                                      }}
                                      className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 border border-transparent hover:border-emerald-100 transition cursor-pointer"
                                      title="เพิ่มรายการในโปรเจกต์นี้"
                                    >
                                      <Plus className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination / Progressive Load */}
            {visibleCount < processedData.length && (
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount(prev => prev + 35)}
                  className="px-6 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 shadow-sm transition active:scale-95 cursor-pointer"
                >
                  โหลดข้อมูลเพิ่มเติม (แสดง {visibleSheetData.length} จาก {processedData.length} รายการ)
                </button>
              </div>
            )}
          </div>

          {/* Mobile View: Clean Financial Touch Cards (โฟกัสเฉพาะตัวเลขการเงิน 4 ลำดับ) */}
          <div className="md:hidden flex flex-col gap-3.5">
            {visibleSheetData.length === 0 ? (
              <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                <LayoutList className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="text-slate-500 text-xs font-medium">ไม่พบข้อมูลโปรเจกต์ตามเงื่อนไข</p>
              </div>
            ) : (
              visibleSheetData.map((item, idx) => {
                const statementRows = getProjectStatementRows(item);

                return (
                  <div
                    key={item.id || idx}
                    onClick={() => onOpenProjectModal && onOpenProjectModal(item)}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 flex flex-col gap-3.5 transition active:scale-[0.99] cursor-pointer"
                  >
                    {/* Header Row: ID + Date + Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg">
                          {item.id}
                        </span>
                        <span className="text-xs text-slate-700 font-semibold flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-indigo-500" />
                          {formatItemDateTime(item)}
                        </span>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          item._paymentStatus === 'paid'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : item._paymentStatus === 'deposit'
                            ? 'bg-sky-50 text-sky-700 border-sky-200'
                            : item._paymentStatus === 'cancelled'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {item._paymentStatus === 'paid'
                          ? 'ชำระแล้ว'
                          : item._paymentStatus === 'deposit'
                          ? 'มัดจำ'
                          : item._paymentStatus === 'cancelled'
                          ? 'ยกเลิก'
                          : 'รอชำระ'}
                      </span>
                    </div>

                    {/* Project & Category */}
                    <div>
                      <h4 className="font-black text-slate-900 text-base leading-snug line-clamp-2">
                        {item.name || 'ไม่มีชื่อโปรเจกต์'}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {item.category && (
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {item.category}
                          </span>
                        )}
                        {item.artist && (
                          <span className="text-[11px] font-semibold text-indigo-600">
                            ศิลปิน: {item.artist}
                          </span>
                        )}
                        {item.customer && (
                          <span className="text-[11px] text-slate-500">
                            ลูกค้า: {item.customer}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Statement Entries Breakdown (สเตตเมนต์ธนาคาร: เงินศิลปิน, รายรับ, รายจ่าย) */}
                    <div className="space-y-2 pt-1 border-t border-slate-100">
                      {statementRows.map((entry) => (
                        <div
                          key={entry.key}
                          className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-200/70 flex flex-col gap-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${entry.typeBadge}`}
                            >
                              {entry.typeLabel}
                            </span>
                            <div className="text-right">
                              {entry.isIncome && entry.incomeAmount > 0 ? (
                                <span className="font-black text-xs text-emerald-600 tabular-nums">
                                  +฿{formatCurrency(entry.incomeAmount)}
                                </span>
                              ) : !entry.isIncome && entry.expenseAmount > 0 ? (
                                <span className="font-black text-xs text-rose-600 tabular-nums">
                                  -฿{formatCurrency(entry.expenseAmount)}
                                </span>
                              ) : (
                                <span className="text-slate-300 font-mono text-xs">-</span>
                              )}
                            </div>
                          </div>

                          {/* Sub-items */}
                          {entry.items && entry.items.length > 0 && (
                            <div className="space-y-1 pl-1 pt-1 border-t border-slate-200/50">
                              {entry.items.map((it, itIdx) => (
                                <div
                                  key={itIdx}
                                  className="flex items-center justify-between text-[11px] text-slate-600 font-mono"
                                >
                                  <span className="truncate pr-2">• {it.name}</span>
                                  {it.amount > 0 && (
                                    <span className="font-semibold text-slate-700 shrink-0">
                                      ฿{formatCurrency(it.amount)}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Card Actions */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                      {item._slips && item._slips.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setPreviewSlipImage(item._slips[0])}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold cursor-pointer"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>ดูสลิป ({item._slips.length})</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">ไม่มีสลิป</span>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setNewTxFormData(prev => ({ ...prev, projectId: item.id }));
                            setIsAddTxModalOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>เพิ่มรับ/จ่าย</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenProjectModal && onOpenProjectModal(item)}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm cursor-pointer"
                        >
                          เปิดดูงาน
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {visibleCount < processedData.length && (
              <button
                type="button"
                onClick={() => setVisibleCount(prev => prev + 35)}
                className="w-full py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 font-bold text-xs shadow-sm active:scale-98 transition text-center"
              >
                โหลดเพิ่มเติม ({visibleSheetData.length}/{processedData.length})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {isEditTxModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md backdrop-animate-in"
            onClick={() => setIsEditTxModalOpen(false)}
          />

          <div
            className="bg-white w-full max-w-lg sm:rounded-[2.5rem] rounded-2xl shadow-2xl relative z-10 overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] modal-animate-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky Header */}
            <div className="px-5 py-4 sm:px-8 sm:py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-20 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 sm:p-3 bg-amber-50 text-amber-600 rounded-xl sm:rounded-2xl shrink-0">
                  <Edit className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                      แก้ไขรายการธุรกรรม
                    </h3>
                    {editingTx?.projectId && (
                      <span className="bg-amber-50 text-amber-700 text-[10px] sm:text-xs px-2.5 py-0.5 sm:py-1 rounded-lg font-bold border border-amber-100 font-mono w-fit">
                        {editingTx.projectId}
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">
                    แก้ไขข้อมูลธุรกรรม หรือทำเครื่องหมาย Void
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditTxModalOpen(false)}
                className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-colors active:scale-95 cursor-pointer"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveEditTx} className="flex flex-col flex-1 overflow-hidden">
              {/* Scrollable Form Body */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-8 custom-scrollbar space-y-4 overscroll-contain">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">หมวดหมู่</label>
                  <input
                    type="text"
                    value={editFormData.category}
                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl sm:rounded-2xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">รายละเอียดรายการ *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.detail}
                    onChange={(e) => setEditFormData({ ...editFormData, detail: e.target.value })}
                    className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl sm:rounded-2xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">จำนวนเงิน (฿) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    value={editFormData.amount}
                    onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                    className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl sm:rounded-2xl text-sm font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>

                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="void_checkbox"
                    checked={editFormData.is_voided}
                    onChange={(e) => setEditFormData({ ...editFormData, is_voided: e.target.checked })}
                    className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <label htmlFor="void_checkbox" className="text-xs font-bold text-slate-700 cursor-pointer">
                    ยกเลิกรายการนี้ (Void) - ไม่นำยอดนี้ไปคิดกำไรขาดทุน
                  </label>
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="px-5 py-4 sm:px-8 sm:py-5 border-t border-slate-100 bg-white/95 backdrop-blur-xl sticky bottom-0 z-30 flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditTxModalOpen(false)}
                  className="py-3 px-5 sm:px-6 rounded-2xl text-slate-600 bg-slate-100/80 hover:bg-slate-200 font-bold text-sm transition-all active:scale-95 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isTxSaving}
                  className="py-3 px-7 sm:px-8 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-emerald-200 hover:shadow-emerald-300 hover:-translate-y-0.5 hover:scale-[1.01] transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isTxSaving ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>{isTxSaving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {isAddTxModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md backdrop-animate-in"
            onClick={() => setIsAddTxModalOpen(false)}
          />

          <div
            className="bg-white w-full max-w-2xl sm:max-w-3xl sm:rounded-[2.5rem] rounded-2xl shadow-2xl relative z-10 overflow-hidden border border-slate-100 flex flex-col max-h-[92vh] modal-animate-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky Header */}
            <div className="px-5 py-4 sm:px-8 sm:py-5 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-20 shrink-0">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 sm:p-3 rounded-2xl shrink-0 shadow-sm ${
                  newTxFormData.type === 'income'
                    ? 'bg-emerald-500 text-white shadow-emerald-200'
                    : 'bg-rose-500 text-white shadow-rose-200'
                }`}>
                  {newTxFormData.type === 'income' ? (
                    <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
                  ) : (
                    <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                    เพิ่มรายการใหม่
                  </h3>
                  <p className="text-xs font-black text-slate-400 tracking-wider uppercase mt-0.5">
                    MANUAL TRANSACTION
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddTxModalOpen(false)}
                className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-colors active:scale-95 cursor-pointer"
                title="ปิดหน้าต่าง"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateTx} className="flex flex-col flex-1 overflow-hidden">
              {/* Scrollable Form Body */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-8 custom-scrollbar space-y-4 overscroll-contain">
                {/* 1. Transaction Type Toggle Cards (รายรับ vs รายจ่าย แบบการ์ดปุ่มกด) */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <button
                    type="button"
                    onClick={() => setNewTxFormData(prev => ({ ...prev, type: 'income', code: 'INC-รอการบันทึก' }))}
                    className={`py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2.5 transition-all cursor-pointer font-black text-sm sm:text-base border-2 ${
                      newTxFormData.type === 'income'
                        ? 'border-emerald-500 bg-emerald-50/70 text-emerald-800 shadow-sm shadow-emerald-100 ring-2 ring-emerald-400/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-500'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      newTxFormData.type === 'income' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
                    }`}>
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <span>รายรับ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewTxFormData(prev => ({ ...prev, type: 'expense', code: 'EXP-รอการบันทึก' }))}
                    className={`py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2.5 transition-all cursor-pointer font-black text-sm sm:text-base border-2 ${
                      newTxFormData.type === 'expense'
                        ? 'border-rose-500 bg-rose-50/70 text-rose-800 shadow-sm shadow-rose-100 ring-2 ring-rose-400/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-500'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      newTxFormData.type === 'expense' ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-400'
                    }`}>
                      <TrendingDown className="w-4 h-4" />
                    </div>
                    <span>รายจ่าย</span>
                  </button>
                </div>

                {/* 2. Top Row: เลขที่รายการ & วันที่ทำรายการ (ไว้ด้านบนสุดตามรูปถ่าย) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">เลขที่รายการ</label>
                    <input
                      type="text"
                      readOnly
                      value={newTxFormData.code}
                      className="w-full px-4 py-3 bg-slate-100/80 border border-slate-200 rounded-2xl text-sm font-mono font-bold text-slate-600 cursor-not-allowed select-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                      <span>วันที่ทำรายการ *</span>
                      <span className="text-[11px] text-indigo-600 font-semibold">(ระบุวันและเวลา)</span>
                    </label>
                    <ModernDateTimePicker
                      value={newTxFormData.dateTime}
                      onChange={(e) => setNewTxFormData(prev => ({ ...prev, dateTime: e.target.value }))}
                      hasTime={true}
                      placeholder="เลือกวันและเวลาทำรายการ..."
                      className="w-full border-slate-200"
                    />
                  </div>
                </div>

                {/* 3. Project ID & Channel */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">รหัสงาน (Project ID) *</label>
                    <input
                      list="project-id-suggestions"
                      type="text"
                      value={newTxFormData.projectId}
                      onChange={(e) => setNewTxFormData(prev => ({ ...prev, projectId: e.target.value }))}
                      placeholder="เช่น P-0309"
                      className="w-full px-4 py-3 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-2xl text-sm uppercase font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                    <datalist id="project-id-suggestions">
                      {activities.slice(0, 15).map(a => (
                        <option key={a.id} value={a.id}>{a.name || a.customer}</option>
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">ช่องทางการชำระเงิน</label>
                    <select
                      value={newTxFormData.channel}
                      onChange={(e) => setNewTxFormData(prev => ({ ...prev, channel: e.target.value }))}
                      className="w-full px-4 py-3 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                    >
                      <option value="โอนเงิน">โอนเงิน (Mobile Banking)</option>
                      <option value="เงินสด">เงินสด (Cash)</option>
                      <option value="บัตรเครดิต">บัตรเครดิต (Credit Card)</option>
                      <option value="พร้อมเพย์">พร้อมเพย์ (PromptPay)</option>
                    </select>
                  </div>
                </div>

                {/* 4. Artist & Customer Meta */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                      <span>ศิลปิน (Artist)</span>
                    </label>
                    <input
                      type="text"
                      value={newTxFormData.artist}
                      onChange={(e) => setNewTxFormData(prev => ({ ...prev, artist: e.target.value }))}
                      placeholder="เช่น Nunew DMD"
                      className="w-full px-4 py-3 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                      <span>ลูกค้า (Customer)</span>
                    </label>
                    <input
                      type="text"
                      value={newTxFormData.customer}
                      onChange={(e) => setNewTxFormData(prev => ({ ...prev, customer: e.target.value }))}
                      placeholder="เช่น คุณวิไลลักษณ์"
                      className="w-full px-4 py-3 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                {/* 5. Section: รายการสินค้าและบริการ (ตามรูปถ่าย เพิ่มได้เรื่อยๆ) */}
                <div className="border border-slate-200/90 rounded-3xl p-4 sm:p-5 bg-white space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-sm text-slate-800">
                        รายการสินค้าและบริการ <span className="text-rose-500">*</span>
                      </h4>
                      <span className="text-xs text-slate-400 font-semibold">
                        ({newTxFormData.items.length} รายการ)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddTxItem}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-black transition-all active:scale-95 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-4 h-4 text-sky-600" />
                      <span>เพิ่มรายการ</span>
                    </button>
                  </div>

                  {/* Header labels on desktop */}
                  <div className="hidden sm:grid sm:grid-cols-12 gap-2 text-xs font-bold text-slate-400 px-2 py-1 select-none">
                    <div className="col-span-6">รายละเอียด</div>
                    <div className="col-span-2 text-center">จำนวน</div>
                    <div className="col-span-2 text-right">ราคา</div>
                    <div className="col-span-2 text-right">รวม</div>
                  </div>

                  {/* Item Rows */}
                  <div className="space-y-2">
                    {newTxFormData.items.map((it, idx) => {
                      const itemTotal = (Number(it.quantity) || 1) * (Number(it.price) || 0);

                      return (
                        <div
                          key={it.id || idx}
                          className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-2.5 items-center bg-slate-50/80 p-2.5 sm:p-3 rounded-2xl border border-slate-200/70 hover:border-slate-300 transition-colors"
                        >
                          <div className="sm:col-span-6">
                            <input
                              type="text"
                              placeholder="ค้นหาหรือพิมพ์ชื่อรายการ..."
                              value={it.detail}
                              onChange={(e) => handleUpdateTxItem(idx, 'detail', e.target.value)}
                              required
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                            />
                          </div>
                          <div className="flex items-center gap-2 sm:col-span-2">
                            <span className="text-xs text-slate-500 font-bold sm:hidden">จำนวน:</span>
                            <input
                              type="number"
                              min="1"
                              value={it.quantity}
                              onChange={(e) => handleUpdateTxItem(idx, 'quantity', e.target.value)}
                              className="w-full px-2 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-center text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                          </div>
                          <div className="flex items-center gap-2 sm:col-span-2">
                            <span className="text-xs text-slate-500 font-bold sm:hidden">ราคา:</span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0"
                              value={it.price}
                              onChange={(e) => handleUpdateTxItem(idx, 'price', e.target.value)}
                              required
                              className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-right text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                            />
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-2 sm:col-span-2">
                            <span className="text-xs text-slate-500 font-bold sm:hidden">รวม:</span>
                            <span className="font-black text-sm text-slate-900 tabular-nums">
                              {formatCurrency(itemTotal)} บาท
                            </span>
                            {newTxFormData.items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveTxItem(idx)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="ลบรายการนี้"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 6. Section: สรุปคำนวณเงิน + ส่วนลด + ภาษี (ตามรูปถ่าย) */}
                <div className="bg-slate-50/90 border border-slate-200/90 rounded-3xl p-4 sm:p-5 space-y-3.5">
                  {/* รวมเป็นเงิน */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-700">รวมเป็นเงิน</span>
                    <span className="text-base font-black text-slate-900 tabular-nums">
                      {formatCurrency(calcTxSubtotal)} บาท
                    </span>
                  </div>

                  {/* ส่วนลด */}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-slate-700">ส่วนลด</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={newTxFormData.discountValue || ''}
                        onChange={(e) => setNewTxFormData(prev => ({ ...prev, discountValue: e.target.value }))}
                        placeholder="0.00"
                        className="w-28 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-right text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                      />
                      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => setNewTxFormData(prev => ({ ...prev, discountType: 'baht' }))}
                          className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                            newTxFormData.discountType === 'baht'
                              ? 'bg-sky-500 text-white shadow-xs'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          บาท
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewTxFormData(prev => ({ ...prev, discountType: 'percent' }))}
                          className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                            newTxFormData.discountType === 'percent'
                              ? 'bg-sky-500 text-white shadow-xs'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          %
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* การคิดภาษี (รวม VAT | แยก VAT | ไม่มี VAT) */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-200/60">
                    <span className="text-sm font-bold text-slate-700">การคิดภาษี</span>
                    <div className="flex items-center gap-4 text-xs font-bold text-slate-700">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="taxType"
                          checked={newTxFormData.taxType === 'include'}
                          onChange={() => setNewTxFormData(prev => ({ ...prev, taxType: 'include' }))}
                          className="w-4 h-4 text-sky-600 focus:ring-sky-500 cursor-pointer"
                        />
                        <span>รวม VAT</span>
                      </label>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="taxType"
                          checked={newTxFormData.taxType === 'exclude'}
                          onChange={() => setNewTxFormData(prev => ({ ...prev, taxType: 'exclude' }))}
                          className="w-4 h-4 text-sky-600 focus:ring-sky-500 cursor-pointer"
                        />
                        <span>แยก VAT</span>
                      </label>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="taxType"
                          checked={newTxFormData.taxType === 'none'}
                          onChange={() => setNewTxFormData(prev => ({ ...prev, taxType: 'none' }))}
                          className="w-4 h-4 text-sky-600 focus:ring-sky-500 cursor-pointer"
                        />
                        <span>ไม่มี VAT</span>
                      </label>
                    </div>
                  </div>

                  {/* ยอดสุทธิ Hero Card */}
                  <div className="bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-2xl p-4 flex items-center justify-between shadow-lg shadow-sky-500/25">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
                        <Activity className="w-5 h-5 text-white" />
                      </div>
                      <span className="font-black text-base sm:text-lg text-white">ยอดสุทธิ</span>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-2xl sm:text-3xl tracking-tight tabular-nums text-white">
                        {formatCurrency(calcTxNetTotal)} ฿
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="px-5 py-4 sm:px-8 sm:py-5 border-t border-slate-100 bg-white/95 backdrop-blur-xl sticky bottom-0 z-30 flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddTxModalOpen(false)}
                  className="py-3 px-5 sm:px-6 rounded-2xl text-slate-600 bg-slate-100/80 hover:bg-slate-200 font-bold text-sm transition-all active:scale-95 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isTxSaving}
                  className="py-3 px-7 sm:px-8 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-emerald-200 hover:shadow-emerald-300 hover:-translate-y-0.5 hover:scale-[1.01] transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isTxSaving ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>{isTxSaving ? 'กำลังบันทึก...' : 'บันทึกรายการ'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

                      {/* --- ROW 3: Financial 4-Step Metric Strip (The Financial Equation: Support -> Revenue -> Expenses = Profit) --- */}
                      <div className="mt-3.5 sm:mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 lg:gap-3.5 text-left">
                        {/* 1. เงินส่งต่อศิลปิน (Support) */}
                        <div className="bg-indigo-50/40 p-3 sm:p-3.5 lg:p-4 rounded-xl sm:rounded-2xl border border-indigo-100/70 flex flex-col justify-between">
                          <span className="text-xs sm:text-sm lg:text-base font-bold text-indigo-700 block truncate">
                            1. ส่งต่อศิลปิน
                          </span>
                          <span className="text-base sm:text-lg md:text-xl xl:text-2xl font-black text-indigo-700 tracking-tight tabular-nums mt-1 sm:mt-1.5">
                            {sTotal > 0 ? `฿${formatCurrency(sTotal)}` : '-'}
                          </span>
                          <span className="text-[11px] sm:text-xs lg:text-sm text-indigo-400 font-medium truncate mt-1">
                            {sTotal > 0 ? `${item.customerSupport?.length || 0} รายการ` : 'ไม่มียอดส่งต่อ'}
                          </span>
                        </div>

                        {/* 2. รายรับ (Quotation) */}
                        <div className="bg-slate-50/80 p-3 sm:p-3.5 lg:p-4 rounded-xl sm:rounded-2xl border border-slate-100 flex flex-col justify-between">
                          <span className="text-xs sm:text-sm lg:text-base font-bold text-slate-500 block truncate">
                            2. รายรับ
                          </span>
                          <span className="text-base sm:text-lg md:text-xl xl:text-2xl font-black text-slate-900 tracking-tight tabular-nums mt-1 sm:mt-1.5">
                            ฿{formatCurrency(qTotal)}
                          </span>
                          <span className="text-[11px] sm:text-xs lg:text-sm text-slate-400 font-medium truncate mt-1">
                            {hasQuotation ? `${item.quotationItems.length} รายการ` : 'ค่าจ้างรวม'}
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
                          {/* 1. Support breakdown */}
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

                          {/* 2. Quotation breakdown */}
                          <div className="bg-slate-50/90 p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200/70 flex flex-col justify-between">
                            <div>
                              <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-200 text-emerald-800 font-bold text-xs sm:text-sm lg:text-base">
                                <span className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-emerald-600 shrink-0" />
                                  <span>รายการเสนอราคา (รายรับ)</span>
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
                                      onClick={() => setPreviewSlipImage({
                                        images: slips,
                                        initialIndex: slipIdx,
                                        title: `สลิปโอนเงิน - ${item.customerName || item.jobName || 'รายการ'}`
                                      })}
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
        <ImageViewer
          src={previewSlipImage}
          onClose={() => setPreviewSlipImage(null)}
        />
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText="ยกเลิก"
        type={confirmDialog.type}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Toast Notification */}
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ ...toast, show: false })}
        />
      )}
    </div>
  );
}

export default React.memo(FinanceView);
