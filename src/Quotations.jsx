import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  FileText,
  Search,
  Plus,
  ExternalLink,
  Printer,
  Copy,
  Check,
  Clock,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Tag,
  Eye,
  DollarSign,
  TrendingUp,
  User,
  Calendar,
  X,
  Share2,
  Calculator,
  Layers,
  Palette,
  Package,
  Trash2,
  Edit,
  ArrowRight,
  Settings,
  RotateCcw,
  Link as LinkIcon,
  HelpCircle,
  ChevronDown
} from 'lucide-react';
import { CustomerQuotationView } from './components/customer/CustomerQuotationView';
import { db } from './services/db';
import {
  loadMaterialRatesLocalFirst,
  saveMaterialRateSync,
  loadQuotationsLocalFirst,
  saveQuotationSync,
  deleteQuotationSync,
  DEFAULT_MATERIAL_RATES,
  fetchLatest30ProjectsFromSupabase,
  loadInventoryLocalFirst,
  saveProjectChecklistItemSync
} from './services/syncService';
import Toast from './components/common/Toast';
import ConfirmDialog from './components/common/ConfirmDialog';
import { useStickyFilter } from './hooks/useStickyFilter';

function Quotations({
  activities = [],
  allProjects = [],
  customers = [],
  shopInfo = {},
  dealStatuses = [],
  inventoryItems = [],
  isCreateOpen = false,
  onCloseCreate,
  onOpenProjectModal,
  onRefresh
}) {
  // Navigation & Filter States
  const { isFilterStuck, filterSentinelRef } = useStickyFilter();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'unlinked' | 'linked'
  const [previewProject, setPreviewProject] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Customer Autocomplete States
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const customerDropdownRef = useRef(null);

  // Data States
  const [quotationDocs, setQuotationDocs] = useState([]);
  const [materialRates, setMaterialRates] = useState(DEFAULT_MATERIAL_RATES);
  const [isLoading, setIsLoading] = useState(true);

  // Master Rates Modal
  const [isRatesModalOpen, setIsRatesModalOpen] = useState(false);
  const [editingRates, setEditingRates] = useState([]);
  const [newRateName, setNewRateName] = useState('');
  const [newRatePrice, setNewRatePrice] = useState('');

  // Quotation & Costing Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDocId, setEditingDocId] = useState(null);
  const [quoteNo, setQuoteNo] = useState('');
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [projectCode, setProjectCode] = useState(''); // e.g. 'P-0001' or ''
  const [note, setNote] = useState('');
  const [markupPercent, setMarkupPercent] = useState(30);
  const [finalPriceInput, setFinalPriceInput] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null, quoteNo: '' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

  // Project Combobox Search State
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const projectDropdownRef = useRef(null);

  // Section 3.2: Backdrop Items (ตร.ม.)
  const [backdropItems, setBackdropItems] = useState([]);

  // Section 3.3: Floral / Props Items
  const [floralItems, setFloralItems] = useState([]);
  const [activeFloralDropdownIndex, setActiveFloralDropdownIndex] = useState(null);
  const floralDropdownRef = useRef(null);

  // Inventory Items State (Linked to Local-First Dexie Store)
  const [localInventory, setLocalInventory] = useState(inventoryItems);

  useEffect(() => {
    loadInventoryLocalFirst((items) => {
      if (Array.isArray(items) && items.length > 0) {
        setLocalInventory(items);
      }
    });
  }, []);

  useEffect(() => {
    if (Array.isArray(inventoryItems) && inventoryItems.length > 0) {
      setLocalInventory(inventoryItems);
    }
  }, [inventoryItems]);

  // Click outside to close floral inventory dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (floralDropdownRef.current && !floralDropdownRef.current.contains(e.target)) {
        setActiveFloralDropdownIndex(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load Quotations and Material Rates from Local-First DB on mount
  useEffect(() => {
    loadMaterialRatesLocalFirst((rates) => {
      if (Array.isArray(rates) && rates.length > 0) {
        setMaterialRates(rates);
      }
    });

    loadQuotationsLocalFirst((docs) => {
      if (Array.isArray(docs) && docs.length > 0) {
        setQuotationDocs(docs);
      } else if (activities.length > 0) {
        // Seed initial quotations from activities so user has existing history to view, edit and clone
        const seeded = activities.slice(0, 40).map((act, i) => {
          const qItems = act.quotationItems || [];
          const quotedAmount = qItems.length > 0
            ? qItems.reduce((sum, q) => sum + (parseFloat(q.price) || 0), 0)
            : (parseFloat(act.wage) || 0);

          const cogs = Math.round(quotedAmount * 0.7);

          return {
            id: `qt-seed-${act.id}`,
            quote_no: `QT-2026-${String(i + 1).padStart(3, '0')}`,
            title: act.name || 'งานจัดดอกไม้',
            client_name: act.customer || '',
            project_code: act.id,
            backdrop_items: [
              {
                id: `bd-${act.id}-1`,
                materialId: 'mat-fb-5mm',
                materialName: 'ฟิวเจอร์บอร์ด 5 มม. พร้อมไดคัท',
                detail: act.name || 'ฉากหลัก',
                width: 2.4,
                height: 2.4,
                qty: 1,
                totalSqm: 5.76,
                basePriceSqm: 450,
                unitPriceSqm: 450,
                isOverridden: false,
                lineTotal: 2592
              }
            ],
            floral_items: [
              {
                id: `fl-${act.id}-1`,
                name: 'ซุ้มดอกไม้ประดับหน้างาน + โฟมโอเอซิส',
                unit: 'เซ็ต',
                qty: 1,
                unitPrice: Math.max(1000, cogs - 2592),
                lineTotal: Math.max(1000, cogs - 2592)
              }
            ],
            backdrop_cost: 2592,
            floral_cost: Math.max(1000, cogs - 2592),
            total_cost: cogs,
            markup_percent: 30,
            final_price: quotedAmount,
            note: '',
            created_at: act.deliveryDate || act.date || new Date().toISOString(),
            updated_at: act.deliveryDate || act.date || new Date().toISOString()
          };
        });

        setQuotationDocs(seeded);
        db.quotations.bulkPut(seeded).catch(() => {});
      }
      setIsLoading(false);
    });
  }, [activities]);

  // Listen to single header button from App.jsx
  useEffect(() => {
    if (isCreateOpen) {
      handleOpenCreateModal();
      if (onCloseCreate) onCloseCreate();
    }
  }, [isCreateOpen]);

  // Listen to header events for create and rates
  useEffect(() => {
    const handleCreate = () => handleOpenCreateModal();
    const handleRates = () => handleOpenRatesModal();
    window.addEventListener('trigger-create-quotation', handleCreate);
    window.addEventListener('trigger-rates-quotation', handleRates);
    return () => {
      window.removeEventListener('trigger-create-quotation', handleCreate);
      window.removeEventListener('trigger-rates-quotation', handleRates);
    };
  }, []);

  // Close project & customer dropdowns when clicked outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(event.target)) {
        setIsProjectDropdownOpen(false);
      }
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target)) {
        setIsCustomerDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut: close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isRatesModalOpen) {
          setIsRatesModalOpen(false);
        } else if (isModalOpen) {
          setIsModalOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, isRatesModalOpen]);

  const [directProjects, setDirectProjects] = useState([]);

  // Fetch latest 30 projects from Supabase in background (ultra-lean ~1.2 KB)
  useEffect(() => {
    let isMounted = true;
    fetchLatest30ProjectsFromSupabase().then(res => {
      if (isMounted && res && res.length > 0) {
        setDirectProjects(res);
      }
    });
    return () => { isMounted = false; };
  }, []);

  // Sort projects strictly from largest project number to smallest (e.g. P-0400 -> P-0001)
  const sortedProjects = useMemo(() => {
    const local = allProjects.length > 0 ? allProjects : activities;
    // Deduplicate by id while merging direct cloud items
    const map = new Map();
    local.forEach(p => { if (p && p.id) map.set(p.id, p); });
    directProjects.forEach(p => { if (p && p.id) map.set(p.id, { ...map.get(p.id), ...p }); });
    const combined = Array.from(map.values());

    return combined.sort((a, b) => {
      const numA = parseInt(String(a.id || '').replace(/\D/g, '') || '0', 10);
      const numB = parseInt(String(b.id || '').replace(/\D/g, '') || '0', 10);
      if (numB !== numA) return numB - numA;
      return String(b.id || '').localeCompare(String(a.id || ''), undefined, { numeric: true });
    });
  }, [allProjects, activities, directProjects]);

  // Filtered 30 Projects for Combobox Search (.slice(0, 30) for 0ms ultra-fast response)
  const filteredProjectOptions = useMemo(() => {
    const q = projectSearchQuery.toLowerCase().trim();
    if (!q) return sortedProjects.slice(0, 30);

    return sortedProjects
      .filter(p =>
        (p.id && p.id.toLowerCase().includes(q)) ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.artist && p.artist.toLowerCase().includes(q)) ||
        (p.customer && p.customer.toLowerCase().includes(q))
      )
      .slice(0, 30);
  }, [sortedProjects, projectSearchQuery]);

  // Real-time Calculations for Backdrop & Structure Items
  const calculatedBackdrops = useMemo(() => {
    return backdropItems.map(item => {
      const w = Number(item.width) || 0;
      const h = Number(item.height) || 0;
      const q = Number(item.qty) || 1;
      const totalSqm = Math.round(w * h * q * 100) / 100;

      // Find standard price from material rates if not set
      const standardRate = materialRates.find(r => r.id === item.materialId || r.name === item.materialName);
      const basePriceSqm = item.basePriceSqm !== undefined && item.basePriceSqm !== '' && !isNaN(Number(item.basePriceSqm))
        ? Number(item.basePriceSqm)
        : (standardRate ? Number(standardRate.default_price_sqm) : 0);
      const unitPriceSqm = item.unitPriceSqm !== undefined && item.unitPriceSqm !== '' && !isNaN(Number(item.unitPriceSqm))
        ? Number(item.unitPriceSqm)
        : basePriceSqm;
      const isOverridden = basePriceSqm > 0 && unitPriceSqm !== basePriceSqm;
      const lineTotal = Math.round(totalSqm * unitPriceSqm);

      return {
        ...item,
        totalSqm,
        basePriceSqm,
        unitPriceSqm: item.unitPriceSqm !== undefined ? item.unitPriceSqm : unitPriceSqm,
        isOverridden,
        lineTotal
      };
    });
  }, [backdropItems, materialRates]);

  // Real-time Calculations for Floral & Equipment Items
  const calculatedFloral = useMemo(() => {
    return floralItems.map(item => {
      const q = item.qty !== undefined && item.qty !== '' ? (Number(item.qty) || 0) : 1;
      const p = item.unitPrice !== undefined && item.unitPrice !== '' ? (Number(item.unitPrice) || 0) : 0;
      const lineTotal = Math.round(q * p);
      return {
        ...item,
        lineTotal
      };
    });
  }, [floralItems]);

  // Summary Totals
  const totalBackdropCost = useMemo(() => {
    return calculatedBackdrops.reduce((sum, item) => sum + item.lineTotal, 0);
  }, [calculatedBackdrops]);

  const totalFloralCost = useMemo(() => {
    return calculatedFloral.reduce((sum, item) => sum + item.lineTotal, 0);
  }, [calculatedFloral]);

  const totalCost = totalBackdropCost + totalFloralCost;

  // Suggested Selling Price based on % Markup
  const suggestedPrice = useMemo(() => {
    const markupRatio = (Number(markupPercent) || 0) / 100;
    return Math.round(totalCost * (1 + markupRatio));
  }, [totalCost, markupPercent]);

  // Final Price (User override or suggested)
  const finalPrice = finalPriceInput !== null ? finalPriceInput : suggestedPrice;
  const estimatedProfit = Math.round(finalPrice - totalCost);
  const estimatedProfitMargin = finalPrice > 0 ? Math.round((estimatedProfit / finalPrice) * 100) : 0;

  // Lookup map for projects to retrieve project opening date and time
  const projectMap = useMemo(() => {
    const map = new Map();
    (allProjects.length > 0 ? allProjects : activities).forEach(p => {
      if (p && p.id) map.set(p.id, p);
    });
    return map;
  }, [allProjects, activities]);

  // Customer candidates compiled from customers list + past activities
  const customerCandidates = useMemo(() => {
    const map = new Map();

    // 1. From customers table/prop
    (customers || []).forEach(c => {
      if (!c) return;
      const name = (c.name || '').trim();
      if (!name || name === '-' || name === '--' || name.toLowerCase() === 'null') return;
      const key = name.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          name,
          phone: c.phone || '',
          social: c.social || c.base || '',
          source: 'database',
          projectCount: 0
        });
      }
    });

    // 2. From past projects/activities
    (allProjects.length > 0 ? allProjects : activities).forEach(p => {
      if (!p) return;
      const name = (p.customer || '').trim();
      if (!name || name === '-' || name === '--' || name.toLowerCase() === 'null') return;
      const key = name.toLowerCase();
      if (map.has(key)) {
        const existing = map.get(key);
        existing.projectCount = (existing.projectCount || 0) + 1;
        if (!existing.phone && p.customerPhone) existing.phone = p.customerPhone;
        if (!existing.social && p.customerSocial) existing.social = p.customerSocial;
      } else {
        map.set(key, {
          name,
          phone: p.customerPhone || '',
          social: p.customerSocial || '',
          source: 'project',
          projectCount: 1
        });
      }
    });

    return Array.from(map.values());
  }, [customers, allProjects, activities]);

  // Filtered customer candidates based on clientName input
  const filteredCustomerCandidates = useMemo(() => {
    const q = (clientName || '').trim().toLowerCase();
    if (!q) return customerCandidates.slice(0, 8);
    return customerCandidates.filter(c => 
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.social && c.social.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [customerCandidates, clientName]);

  // Format date and time using project's opening date and time
  const getQuotationDisplayDate = (doc) => {
    const linkedProj = doc?.project_code ? projectMap.get(doc.project_code) : null;
    const rawVal = linkedProj?.rawDateTime || linkedProj?.date || linkedProj?.created_at || doc?.created_at || doc?.updated_at;
    if (!rawVal) return '-';

    if (typeof rawVal === 'string') {
      // If it contains a range like "14/11/2569 18:04 - 14/11/2569 19:04", extract opening time (first part)
      if (rawVal.includes(' - ')) {
        return rawVal.split(' - ')[0].trim();
      }
      // If already formatted like "14/11/2569 18:04"
      if (rawVal.includes('/') && rawVal.includes(':')) {
        return rawVal.trim();
      }
    }

    const d = new Date(rawVal);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear() + 543;
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    }

    return String(rawVal);
  };

  // Helper to generate next quote number
  const generateNextQuoteNo = () => {
    const yearStr = new Date().getFullYear();
    const existingNums = quotationDocs.map(d => {
      const match = (d.quote_no || '').match(/QT-\d+-(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    });
    const maxNum = existingNums.length > 0 ? Math.max(...existingNums, 0) : 0;
    return `QT-${yearStr}-${String(maxNum + 1).padStart(3, '0')}`;
  };

  // Filtered Quotation Documents for Main Table (เรียงเลขมากไปน้อย ล่าสุดอยู่บนสุด)
  const filteredQuotations = useMemo(() => {
    return quotationDocs
      .filter(doc => {
        const q = searchQuery.toLowerCase().trim();
        const matchSearch = !q ||
          (doc.quote_no && doc.quote_no.toLowerCase().includes(q)) ||
          (doc.title && doc.title.toLowerCase().includes(q)) ||
          (doc.client_name && doc.client_name.toLowerCase().includes(q)) ||
          (doc.project_code && doc.project_code.toLowerCase().includes(q));

        const isLinked = Boolean(doc.project_code && doc.project_code.trim());
        const matchFilter =
          filterTab === 'all' ||
          (filterTab === 'linked' && isLinked) ||
          (filterTab === 'unlinked' && !isLinked);

        return matchSearch && matchFilter;
      })
      .sort((a, b) => {
        const noA = a.quote_no || '';
        const noB = b.quote_no || '';
        return noB.localeCompare(noA, undefined, { numeric: true });
      });
  }, [quotationDocs, searchQuery, filterTab]);

  // Stats Counters
  const stats = useMemo(() => {
    const total = quotationDocs.length;
    const linked = quotationDocs.filter(d => Boolean(d.project_code && d.project_code.trim())).length;
    const unlinked = total - linked;
    const totalQuotedValue = quotationDocs.reduce((sum, d) => sum + (Number(d.final_price) || 0), 0);
    const totalCostValue = quotationDocs.reduce((sum, d) => sum + (Number(d.total_cost) || 0), 0);
    return { total, linked, unlinked, totalQuotedValue, totalCostValue };
  }, [quotationDocs]);

  // Open Create Modal with fresh form
  const handleOpenCreateModal = () => {
    const newNo = generateNextQuoteNo();

    setEditingDocId(null);
    setQuoteNo(newNo);
    setTitle('');
    setClientName('');
    setProjectCode('');
    setProjectSearchQuery('');
    setNote('');
    setMarkupPercent(30);
    setFinalPriceInput(null);

    // Initial blank backdrop item
    setBackdropItems([
      {
        id: `bd-${Date.now()}`,
        materialId: '',
        materialName: '',
        detail: '',
        width: '',
        height: '',
        qty: 1,
        basePriceSqm: '',
        unitPriceSqm: ''
      }
    ]);

    // Initial blank floral item
    setFloralItems([
      {
        id: `fl-${Date.now()}`,
        name: '',
        unit: '',
        qty: 1,
        unitPrice: '',
        inventory_id: null,
        base_cost: 0
      }
    ]);

    setIsModalOpen(true);
  };

  // Open Edit Modal with existing doc
  const handleOpenEditModal = (doc) => {
    setEditingDocId(doc.id);
    setQuoteNo(doc.quote_no || `QT-${Date.now()}`);
    setTitle(doc.title || '');
    setClientName(doc.client_name || '');
    setProjectCode(doc.project_code || '');
    setProjectSearchQuery(doc.project_code || '');
    setNote(doc.note || '');
    setMarkupPercent(doc.markup_percent ?? 30);
    setFinalPriceInput(doc.final_price ?? null);

    setBackdropItems(Array.isArray(doc.backdrop_items) && doc.backdrop_items.length > 0
      ? doc.backdrop_items
      : [{
          id: `bd-${Date.now()}`,
          materialId: '',
          materialName: '',
          detail: '',
          width: '',
          height: '',
          qty: 1,
          basePriceSqm: '',
          unitPriceSqm: ''
        }]
    );

    setFloralItems(Array.isArray(doc.floral_items) && doc.floral_items.length > 0
      ? doc.floral_items.map((f, i) => ({ ...f, id: f.id ? `${f.id}-${i}` : `fl-${Date.now()}-${i}` }))
      : []
    );

    setIsModalOpen(true);
  };

  // Clone Flow (Core Feature 6.2 in หน้าเสนอราคา.md)
  const handleCloneQuotation = (doc) => {
    const newNo = generateNextQuoteNo();

    setEditingDocId(null); // Clear ID so it saves as new
    setQuoteNo(newNo);
    setTitle(`${doc.title || 'งานจัดดอกไม้'} (สำเนา)`);
    setClientName(doc.client_name || '');
    setProjectCode(''); // Clear project_code to wait for new project linking
    setProjectSearchQuery('');
    setNote(doc.note || '');
    setMarkupPercent(doc.markup_percent ?? 30);
    setFinalPriceInput(doc.final_price ?? null);

    // Deep copy backdrop & floral items with new IDs
    const clonedBackdrops = (doc.backdrop_items || []).map((b, i) => ({
      ...b,
      id: `bd-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`
    }));

    const clonedFloral = (doc.floral_items || []).map((f, i) => ({
      ...f,
      id: `fl-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`
    }));

    setBackdropItems(clonedBackdrops);
    setFloralItems(clonedFloral);
    setIsModalOpen(true);
  };

  // Add Item Handlers
  const handleAddBackdropRow = () => {
    setBackdropItems(prev => [
      ...prev,
      {
        id: `bd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        materialId: '',
        materialName: '',
        detail: '',
        width: '',
        height: '',
        qty: 1,
        basePriceSqm: '',
        unitPriceSqm: ''
      }
    ]);
  };

  // Row Handlers for Section 3.3 (Floral & Inventory Items)
  const handleAddFloralRow = () => {
    setFloralItems(prev => [
      ...prev,
      {
        id: `fl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: '',
        unit: '',
        qty: 1,
        unitPrice: '',
        inventory_id: null,
        base_cost: 0
      }
    ]);
  };

  const handleSelectInventoryItem = (index, invItem) => {
    const cost = Number(invItem.average_cost) || 0;
    const updated = [...floralItems];
    updated[index] = {
      ...updated[index],
      name: invItem.name,
      unit: invItem.unit || 'ชิ้น',
      unitPrice: cost, // Populate purchase cost as starting price
      base_cost: cost,
      inventory_id: invItem.id,
      inventory_code: invItem.code,
      current_stock: invItem.current_stock,
      min_alert_threshold: invItem.min_alert_threshold
    };
    setFloralItems(updated);
    setActiveFloralDropdownIndex(null);
    showToast(`ดึงข้อมูล "${invItem.name}" (ต้นทุน ฿${cost.toLocaleString()}) เรียบร้อย`, 'success');
  };

  const handleSelectCustomItem = (index, customName) => {
    const updated = [...floralItems];
    updated[index] = {
      ...updated[index],
      name: customName || '',
      inventory_id: null,
      base_cost: 0
    };
    setFloralItems(updated);
    setActiveFloralDropdownIndex(null);
  };

  const handleSetCostPrice = (index, cost) => {
    const updated = [...floralItems];
    updated[index] = {
      ...updated[index],
      unitPrice: cost
    };
    setFloralItems(updated);
    showToast(`ปรับราคาเสนอเท่าต้นทุนคลัง ฿${cost.toLocaleString()} แล้ว`, 'info');
  };

  // Handle Material Selection Change
  const handleMaterialChange = (index, selectedRateName) => {
    const matchedRate = materialRates.find(r => r.name === selectedRateName);
    const updated = [...backdropItems];
    if (matchedRate) {
      updated[index].materialId = matchedRate.id;
      updated[index].materialName = matchedRate.name;
      updated[index].basePriceSqm = Number(matchedRate.default_price_sqm);
      updated[index].unitPriceSqm = Number(matchedRate.default_price_sqm); // Reset to standard
    } else {
      updated[index].materialId = '';
      updated[index].materialName = selectedRateName || '';
      updated[index].basePriceSqm = '';
      updated[index].unitPriceSqm = '';
    }
    setBackdropItems(updated);
  };

  // Revert price back to standard price (ปุ่มกด คืนค่า ใน Price Override Logic)
  const handleRevertBasePrice = (index) => {
    const updated = [...backdropItems];
    updated[index].unitPriceSqm = updated[index].basePriceSqm;
    setBackdropItems(updated);
  };

  // Save Quotation
  const handleSaveQuotation = async (e) => {
    if (e) e.preventDefault();
    if (!title.trim()) {
      showToast('กรุณาระบุชื่องาน / ศิลปิน', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const linkedProj = projectCode ? projectMap.get(projectCode) : null;
      const projectDate = linkedProj?.rawDateTime || linkedProj?.date || linkedProj?.created_at;

      const payload = {
        id: editingDocId || undefined,
        quote_no: quoteNo,
        title: title.trim(),
        client_name: clientName.trim(),
        project_code: projectCode.trim() || null,
        backdrop_items: calculatedBackdrops.map(b => ({
          ...b,
          width: Number(b.width) || 0,
          height: Number(b.height) || 0,
          qty: Number(b.qty) || 1,
          unitPriceSqm: Number(b.unitPriceSqm) || 0
        })),
        floral_items: calculatedFloral.map(f => ({
          ...f,
          qty: Number(f.qty) || 1,
          unitPrice: Number(f.unitPrice) || 0
        })),
        backdrop_cost: totalBackdropCost,
        floral_cost: totalFloralCost,
        total_cost: totalCost,
        markup_percent: Number(markupPercent) || 30,
        final_price: finalPrice,
        note: note.trim(),
        created_at: projectDate || (editingDocId ? undefined : new Date().toISOString())
      };

      const saved = await saveQuotationSync(payload);

      // Auto-sync items to Project Preparation Checklist (Spec Section 3 & 4)
      if (payload.project_code) {
        for (const item of calculatedFloral) {
          saveProjectChecklistItemSync({
            project_id: payload.project_code,
            item_name: item.name,
            item_type: item.item_type || 'consumable',
            category_name: item.item_type === 'banknote' ? 'ธนบัตร' : item.item_type === 'reusable' ? 'วัสดุหมุนเวียน' : item.item_type === 'asset' ? 'อุปกรณ์ยืม-คืน' : item.item_type === 'task' ? 'งานบริการ' : 'พัสดุสิ้นเปลือง',
            required_qty: Number(item.qty) || 1,
            unit: item.unit || 'ชุด',
            unit_cost: Number(item.unitPrice) || 0,
            notes: item.item_type === 'reusable' ? 'เสร็จงานต้องนับคืนคลัง' : item.item_type === 'banknote' ? `มูลค่า ${((Number(item.qty) || 1) * (Number(item.unitPrice) || 0)).toLocaleString()} บาท` : ''
          }).catch(chkErr => console.warn('Checklist sync notice:', chkErr));
        }
      }

      // Update state
      setQuotationDocs(prev => {
        const idx = prev.findIndex(d => d.id === saved.id || d.quote_no === saved.quote_no);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [saved, ...prev];
      });

      setIsModalOpen(false);
      showToast('บันทึกการคำนวณราคาเรียบร้อย', 'success');
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast('บันทึกการคำนวณราคาไม่สำเร็จ: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Trigger Delete Confirmation Modal
  const promptDeleteQuotation = (id, quoteNumber) => {
    setDeleteConfirm({
      isOpen: true,
      id,
      quoteNo: quoteNumber || ''
    });
  };

  // Confirmed Delete Quotation
  const handleConfirmDeleteQuotation = async () => {
    if (!deleteConfirm.id) return;
    try {
      await deleteQuotationSync(deleteConfirm.id);
      setQuotationDocs(prev => prev.filter(d => d.id !== deleteConfirm.id));
      setDeleteConfirm({ isOpen: false, id: null, quoteNo: '' });
      setIsModalOpen(false);
      showToast('ลบรายการคำนวณราคาเรียบร้อย', 'success');
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast('ลบไม่สำเร็จ: ' + err.message, 'error');
    }
  };

  // Open Master Rates Modal
  const handleOpenRatesModal = () => {
    setEditingRates([...materialRates]);
    setIsRatesModalOpen(true);
  };

  // Save Master Rates
  const handleSaveMasterRates = async (e) => {
    e.preventDefault();
    try {
      for (const rate of editingRates) {
        await saveMaterialRateSync(rate);
      }
      setMaterialRates(editingRates);
      setIsRatesModalOpen(false);
      showToast('บันทึกราคากลางเรียบร้อย', 'success');
    } catch (err) {
      showToast('บันทึกราคากลางล้มเหลว: ' + err.message, 'error');
    }
  };

  // Add New Master Rate
  const handleAddNewRate = () => {
    if (!newRateName.trim() || !newRatePrice) return;
    const newRate = {
      id: `mat-${Date.now()}`,
      name: newRateName.trim(),
      default_price_sqm: parseFloat(newRatePrice) || 0,
      is_active: true
    };
    setEditingRates([...editingRates, newRate]);
    setNewRateName('');
    setNewRatePrice('');
  };

  // Copy Quotation Link
  const handleCopyLink = (qNo) => {
    const url = `${window.location.origin}/quotations?q=${encodeURIComponent(qNo)}`;
    navigator.clipboard.writeText(url);
    setCopiedId(qNo);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="flex flex-col gap-6 min-h-full pb-24 md:pb-6 px-4 sm:px-8 lg:px-10 pt-4">
      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-slate-600">รายการคำนวณราคาทั้งหมด</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Calculator className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">{stats.total} รายการ</p>
          <div className="mt-1 pt-1 border-t border-slate-50 text-xs text-slate-500 font-medium">คลังประวัติคำนวณต้นทุน</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-amber-800">ยังไม่ผูกโปรเจกต์ (Draft)</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-700">{stats.unlinked} รายการ</p>
          <div className="mt-1 pt-1 border-t border-slate-50 text-xs text-amber-700 font-semibold">ประเมินราคาล่วงหน้า</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-emerald-800">ผูกโปรเจกต์แล้ว (Linked)</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-700">{stats.linked} รายการ</p>
          <div className="mt-1 pt-1 border-t border-slate-50 text-xs text-emerald-700 font-semibold">เชื่อมโยงรหัสโปรเจกต์ P-XXXX</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-indigo-800">มูลค่ายอดคำนวณราคารวม</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-indigo-700">฿{stats.totalQuotedValue.toLocaleString()}</p>
          <div className="mt-1 pt-1 border-t border-slate-50 text-xs text-indigo-700 font-semibold">รวมราคาเสนอขายลูกค้า</div>
        </div>
      </div>

      {/* 2.1 ส่วนบน: Header & Filter Bar */}
      <div 
        ref={filterSentinelRef} 
        className="w-full h-0 -my-3 pointer-events-none opacity-0"
      />
      <div className={`bg-white/95 backdrop-blur-md transition-all duration-200 ease-in-out z-20 sticky top-[calc(56px+env(safe-area-inset-top,0px))] md:top-0 ${
        isFilterStuck
          ? '-mx-4 sm:-mx-8 lg:-mx-10 py-2 sm:py-2.5 px-4 sm:px-8 lg:px-10 border-b border-slate-100 shadow-sm rounded-b-[2rem] sm:rounded-b-3xl rounded-t-none'
          : 'p-3 sm:p-3.5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-[0_2px_12px_rgb(0,0,0,0.03)]'
      }`}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาจากชื่อศิลปิน, ชื่องาน, เลขที่คำนวณราคา (QT-XXXX), หรือเลขโปรเจกต์ (P-XXXX)..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition cursor-pointer"
                title="ล้างข้อความค้นหา"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Status Filter Dropdown (Replaces bulky button tabs) */}
            <div className="relative flex-1 sm:w-56 shrink-0">
              <select
                value={filterTab}
                onChange={(e) => setFilterTab(e.target.value)}
                className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none cursor-pointer shadow-2xs transition-colors"
              >
                <option value="all">สถานะ: ทั้งหมด ({quotationDocs.length})</option>
                <option value="unlinked">ยังไม่ผูกโปรเจกต์ ({stats.unlinked})</option>
                <option value="linked">ผูกโปรเจกต์แล้ว ({stats.linked})</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Reset Filter Button */}
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFilterTab('all');
              }}
              className="h-10 w-10 bg-slate-50 border border-slate-200/70 text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 rounded-xl font-bold transition-all flex items-center justify-center shrink-0 active:scale-95 cursor-pointer shadow-2xs"
              title="ล้างค่าตัวกรองทั้งหมด"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2.2 ส่วนตารางข้อมูล (Quotation Data Table - Desktop View) */}
      <div className="hidden md:block bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wider">
                <th className="py-3.5 px-5">เลขที่คำนวณราคา</th>
                <th className="py-3.5 px-4">ชื่องาน / ศิลปิน</th>
                <th className="py-3.5 px-4">เลขโปรเจกต์ที่ผูก</th>
                <th className="py-3.5 px-4">สรุปรายการสเปก</th>
                <th className="py-3.5 px-4 text-right">ต้นทุนรวม (Cost)</th>
                <th className="py-3.5 px-4 text-right">ราคาเสนอขาย (Quote)</th>
                <th className="py-3.5 px-5 text-right">จัดการ (Actions)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredQuotations.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-500 font-medium text-sm">
                    ไม่พบรายการคำนวณราคา กดปุ่ม "+ คำนวณราคา" เพื่อเริ่มต้นประเมินต้นทุน
                  </td>
                </tr>
              ) : (
                filteredQuotations.map((doc) => {
                  const bdList = doc.backdrop_items || [];
                  const flList = doc.floral_items || [];
                  const totalSqm = bdList.reduce((sum, b) => sum + (Number(b.totalSqm) || 0), 0);
                  const hasOverride = bdList.some(b => b.isOverridden);

                  return (
                    <tr
                      key={doc.id || doc.quote_no}
                      className="hover:bg-slate-50/60 transition-colors group cursor-pointer"
                      onClick={() => handleOpenEditModal(doc)}
                    >
                      {/* เลขใบเสนอราคา */}
                      <td className="py-3.5 px-5 font-bold">
                        <div className="font-mono text-xs sm:text-sm text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg inline-block font-black">
                          {doc.quote_no}
                        </div>
                        <div className="text-xs text-slate-500 font-medium mt-1">
                          {getQuotationDisplayDate(doc)}
                        </div>
                      </td>

                      {/* ชื่องาน / ศิลปิน */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-sm sm:text-base group-hover:text-indigo-600 transition-colors">
                          {doc.title}
                        </div>
                        {doc.client_name && (
                          <div className="text-xs text-slate-600 font-medium mt-0.5">
                            ลูกค้า: {doc.client_name}
                          </div>
                        )}
                      </td>

                      {/* เลขโปรเจกต์ที่ผูก */}
                      <td className="py-3.5 px-4">
                        {doc.project_code ? (
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-mono font-black text-xs sm:text-sm border border-emerald-200">
                            {doc.project_code}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 font-bold text-xs sm:text-sm border border-amber-200">
                            รอผูกโปรเจกต์
                          </span>
                        )}
                      </td>

                      {/* สรุปรายการ */}
                      <td className="py-3.5 px-4 text-xs sm:text-sm">
                        <div className="text-slate-800 font-medium">
                          Backdrop {bdList.length} รายการ ({totalSqm.toFixed(1)} ตร.ม.)
                        </div>
                        <div className="text-slate-500 font-medium mt-0.5">
                          ดอกไม้/อุปกรณ์ {flList.length} รายการ
                        </div>
                        {hasOverride && (
                          <span className="inline-block mt-1 text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                            มีปรับราคาหน้างาน
                          </span>
                        )}
                      </td>

                      {/* ต้นทุนรวม */}
                      <td className="py-3.5 px-4 text-right font-bold text-slate-700 text-sm sm:text-base">
                        ฿{Number(doc.total_cost || 0).toLocaleString()}
                      </td>

                      {/* ราคาเสนอ (Quote) */}
                      <td className="py-3.5 px-4 text-right font-black text-indigo-700 text-base sm:text-lg">
                        ฿{Number(doc.final_price || 0).toLocaleString()}
                        <div className="text-xs text-emerald-700 font-bold mt-0.5">
                          +{doc.markup_percent || 30}% Markup
                        </div>
                      </td>

                      {/* จัดการ (Actions) */}
                      <td className="py-3.5 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEditModal(doc)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                            title="ดู/แก้ไขข้อมูล"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleCloneQuotation(doc)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                            title="ใช้เป็นต้นแบบ (Clone)"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleCopyLink(doc.quote_no)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-colors cursor-pointer"
                            title="คัดลอกลิงก์"
                          >
                            {copiedId === doc.quote_no ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => promptDeleteQuotation(doc.id, doc.quote_no)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="ลบรายการคำนวณราคา"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards View */}
      <div className="md:hidden space-y-3">
        {filteredQuotations.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-100 text-center text-slate-400">
            ไม่พบรายการคำนวณราคา
          </div>
        ) : (
          filteredQuotations.map((doc) => (
            <div
              key={doc.id || doc.quote_no}
              className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3 cursor-pointer"
              onClick={() => handleOpenEditModal(doc)}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                      {doc.quote_no}
                    </span>
                    {doc.project_code ? (
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-emerald-50 text-emerald-800">
                        {doc.project_code}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-800">
                        รอผูกโปรเจกต์
                      </span>
                    )}
                    <span className="text-xs text-slate-500 font-medium ml-auto">
                      {getQuotationDisplayDate(doc)}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm mt-1">{doc.title}</h3>
                  {doc.client_name && (
                    <p className="text-xs text-slate-600 font-medium">ลูกค้า: {doc.client_name}</p>
                  )}
                </div>

                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleCloneQuotation(doc)}
                    className="p-1.5 text-slate-400 hover:text-emerald-600"
                    title="โคลนงาน"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="bg-slate-50 p-2.5 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500 text-xs font-medium block">ต้นทุนรวม</span>
                  <span className="font-bold text-slate-700 text-sm">฿{Number(doc.total_cost || 0).toLocaleString()}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 text-xs font-medium block">ราคาเสนอขาย</span>
                  <span className="font-black text-indigo-700 text-base">฿{Number(doc.final_price || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 3. MODAL เสนอราคาต้นทุน (QUOTATION & COSTING MODAL - ตามพิมพ์เขียว) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md backdrop-animate-in"
            onClick={() => setIsModalOpen(false)}
          />

          <div
            className="bg-white w-full max-w-5xl sm:rounded-[2.5rem] rounded-2xl shadow-2xl relative z-10 overflow-hidden border border-slate-100 flex flex-col max-h-[92vh] modal-animate-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 sm:px-8 sm:py-5 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-20 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 sm:p-3 bg-indigo-50 text-indigo-600 rounded-xl sm:rounded-2xl shrink-0">
                  <Calculator className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                      {editingDocId ? 'แก้ไขการคำนวณราคา' : 'คำนวณราคาใหม่'}
                    </h3>
                    <span className="bg-indigo-50 text-indigo-700 text-xs sm:text-sm px-2.5 py-0.5 sm:py-1 rounded-lg font-bold border border-indigo-200 font-mono w-fit">
                      {quoteNo}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">
                    คำนวณพื้นที่ ตร.ม. อัตโนมัติ ปรับราคาหน้างาน และผูกเลขโปรเจกต์ย้อนหลัง
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-colors active:scale-95 cursor-pointer"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveQuotation} className="flex flex-col flex-1 overflow-hidden">
              {/* Scrollable Form Body */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-8 custom-scrollbar space-y-6 overscroll-contain">
                {/* ส่วนที่ 3.1: ข้อมูลงาน & Searchable Project Combobox */}
                <div className="bg-gradient-to-b from-slate-50/90 to-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-black">1</div>
                      <h4 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wide">
                        ข้อมูลงาน & การผูกโปรเจกต์
                      </h4>
                    </div>
                    {projectCode ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200 shadow-2xs">
                          <Check className="w-3.5 h-3.5" />
                          ผูกกับโปรเจกต์: <strong className="font-mono">{projectCode}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setProjectCode('');
                            setProjectSearchQuery('');
                          }}
                          className="text-xs font-bold text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                        >
                          ปลดการผูก
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-slate-600 bg-slate-100/80 px-2.5 py-1 rounded-lg">
                        ราคาประเมินอิสระ (ยังไม่ผูกโปรเจกต์)
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
                    {/* ชื่องาน / ศิลปิน * */}
                    <div className="sm:col-span-7">
                      <label className="block text-sm font-bold text-slate-800 mb-1">
                        ชื่องาน / ศิลปิน *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="เช่น ซุ้มดอกไม้คอนเสิร์ต Nunew DMD, งานแฟนมีต..."
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:font-normal placeholder:text-slate-400 shadow-2xs"
                      />
                    </div>

                    {/* ชื่อลูกค้า / บ้านเบส (Searchable Autocomplete จากฐานข้อมูลลูกค้าและประวัติงาน) */}
                    <div className="sm:col-span-5 relative" ref={customerDropdownRef}>
                      <label className="block text-sm font-bold text-slate-800 mb-1 flex items-center justify-between">
                        <span>ชื่อลูกค้า / ผู้ติดต่อ / บ้านเบส</span>
                        {customerCandidates.length > 0 && (
                          <span className="text-xs text-slate-500 font-medium">
                            (ค้นหาลูกค้าเก่าอัตโนมัติ)
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        placeholder="เช่น คุณแพรว, DMD FC, Butterbear..."
                        value={clientName}
                        onFocus={() => setIsCustomerDropdownOpen(true)}
                        onChange={(e) => {
                          setClientName(e.target.value);
                          setIsCustomerDropdownOpen(true);
                        }}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-400 shadow-2xs"
                      />

                      {/* Dropdown Customer Candidates */}
                      {isCustomerDropdownOpen && filteredCustomerCandidates.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 max-h-56 overflow-y-auto divide-y divide-slate-100">
                          <div className="px-3 py-1.5 bg-slate-50 text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between sticky top-0 backdrop-blur-sm z-10">
                            <span>รายชื่อลูกค้าในฐานข้อมูล</span>
                            <span>{filteredCustomerCandidates.length} รายการ</span>
                          </div>
                          {filteredCustomerCandidates.map((c, i) => (
                            <div
                              key={i}
                              onClick={() => {
                                setClientName(c.name);
                                setIsCustomerDropdownOpen(false);
                              }}
                              className="p-2.5 hover:bg-violet-50/80 cursor-pointer text-xs sm:text-sm flex items-center justify-between transition-colors group"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-800 group-hover:text-violet-700 transition-colors">
                                  {c.name}
                                </span>
                                {c.projectCount > 0 ? (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-100">
                                    ลูกค้าเก่า ({c.projectCount} งาน)
                                  </span>
                                ) : (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                                    ลูกค้าในระบบ
                                  </span>
                                )}
                              </div>
                              <div className="text-xs font-mono text-slate-500 group-hover:text-violet-600 transition-colors">
                                {c.phone || c.social}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* ช่องผูกเลขโปรเจกต์ (Searchable Combobox / Autocomplete) */}
                    <div className="sm:col-span-12 relative" ref={projectDropdownRef}>
                      <label className="block text-sm font-bold text-slate-800 mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <LinkIcon className="w-3.5 h-3.5 text-indigo-500" />
                          <span>ผูกกับโปรเจกต์ในระบบ (ทางเลือก - พิมพ์ค้นหารหัสหรือชื่อ)</span>
                        </span>
                        {projectCode && (
                          <span className="text-xs font-mono text-emerald-600 font-bold">
                            เลือก: {projectCode}
                          </span>
                        )}
                      </label>
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="พิมพ์รหัสโปรเจกต์ เช่น P-0001 หรือชื่อศิลปิน เพื่อค้นหา..."
                          value={projectCode ? `${projectCode} - ${projectSearchQuery}` : projectSearchQuery}
                          onFocus={() => setIsProjectDropdownOpen(true)}
                          onChange={(e) => {
                            setProjectCode('');
                            setProjectSearchQuery(e.target.value);
                            setIsProjectDropdownOpen(true);
                          }}
                          className={`w-full pl-10 pr-10 py-2.5 bg-white border rounded-xl text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 transition-all shadow-2xs ${
                            projectCode
                              ? 'border-emerald-300 bg-emerald-50/40 text-emerald-900 font-mono'
                              : 'border-slate-200 text-slate-800 focus:ring-indigo-500'
                          }`}
                        />
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>

                      {/* Dropdown Options */}
                      {isProjectDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 max-h-60 overflow-y-auto divide-y divide-slate-100">
                          <div
                            onClick={() => {
                              setProjectCode('');
                              setProjectSearchQuery('');
                              setIsProjectDropdownOpen(false);
                            }}
                            className="p-3 hover:bg-slate-50 cursor-pointer text-xs font-bold text-amber-700 flex items-center justify-between"
                          >
                            <span>-- ไม่ผูกเลขโปรเจกต์ (ประเมินราคาคร่าวๆ) --</span>
                            {!projectCode && <Check className="w-4 h-4 text-amber-600" />}
                          </div>

                          {filteredProjectOptions.length === 0 ? (
                            <div className="p-3 text-xs sm:text-sm text-slate-500 font-medium text-center">
                              ไม่พบโปรเจกต์ที่ตรงกับคำค้นหา
                            </div>
                          ) : (
                            filteredProjectOptions.map(p => (
                              <div
                                key={p.id}
                                onClick={() => {
                                  setProjectCode(p.id);
                                  setProjectSearchQuery(p.name || p.artist || '');
                                  setIsProjectDropdownOpen(false);
                                }}
                                className="p-3 hover:bg-indigo-50/80 cursor-pointer text-xs flex items-center justify-between transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg">
                                    {p.id}
                                  </span>
                                  <span className="font-bold text-slate-800">{p.name || 'งานจัดดอกไม้'}</span>
                                  {p.artist && (
                                    <span className="text-purple-600 font-semibold bg-purple-50 px-2 py-0.5 rounded-md">
                                      {p.artist}
                                    </span>
                                  )}
                                </div>
                                {projectCode === p.id && <Check className="w-4 h-4 text-emerald-600 font-bold" />}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ส่วนที่ 3.2: ตารางคำนวณ Backdrop / ป้าย (คิดเป็น ตารางเมตร - ตร.ม.) */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-black">2</div>
                      <div>
                        <h4 className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-2">
                          <span>คำนวณ Backdrop & โครงสร้างป้าย (คิดตาม ตร.ม.)</span>
                        </h4>
                        <p className="text-xs sm:text-sm text-slate-600 font-medium">
                          กว้าง x สูง x จำนวน = ตร.ม. อัตโนมัติ พร้อมดึงราคากลาง และแก้ไขราคาต่อหน่วยได้อิสระ
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {calculatedBackdrops.map((item, index) => (
                      <div
                        key={item.id}
                        className={`rounded-2xl border transition-all shadow-xs overflow-hidden ${
                          item.isOverridden
                            ? 'bg-amber-50/30 border-amber-300 hover:border-amber-400'
                            : 'bg-white border-slate-200/90 hover:border-indigo-300'
                        }`}
                      >
                        {/* Mobile Card Header */}
                        <div className="sm:hidden bg-gradient-to-r from-indigo-600 to-blue-600 px-3.5 py-2 flex items-center justify-between text-white shadow-2xs">
                          <span className="font-black text-xs flex items-center gap-1.5 tracking-wide">
                            <Layers className="w-3.5 h-3.5 text-white/90" />
                            รายการที่ {index + 1}
                          </span>
                          {backdropItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setBackdropItems(backdropItems.filter((_, i) => i !== index))}
                              className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition active:scale-90"
                              title={`ลบรายการที่ ${index + 1}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="p-4 space-y-3">
                        {/* Row 1: วัสดุ & จุดติดตั้ง */}
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                          <div className="sm:col-span-7">
                            <label className="text-xs sm:text-sm font-bold text-slate-800 mb-1 flex items-center gap-1">
                              <span>ชนิดวัสดุโครงสร้าง / ป้าย</span>
                              <span className="text-slate-500 font-medium text-xs">(ราคากลาง)</span>
                            </label>
                            <div className="relative">
                              <select
                                value={item.materialName || ''}
                                onChange={(e) => handleMaterialChange(index, e.target.value)}
                                className="w-full pl-3 pr-8 py-2 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors cursor-pointer appearance-none"
                              >
                                <option value="">-- เลือกชนิดวัสดุโครงสร้าง --</option>
                                {materialRates.map(r => (
                                  <option key={r.id || r.name} value={r.name}>
                                    {r.name} — ฿{Number(r.default_price_sqm).toLocaleString()} / ตร.ม.
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                          </div>

                          <div className="sm:col-span-5">
                            <label className="text-xs sm:text-sm font-bold text-slate-800 mb-1 block">
                              จุดติดตั้ง / ชื่องานย่อย
                            </label>
                            <input
                              type="text"
                              value={item.detail || ''}
                              onChange={(e) => {
                                const updated = [...backdropItems];
                                updated[index].detail = e.target.value;
                                setBackdropItems(updated);
                              }}
                              placeholder="เช่น ฉากหลังถ่ายรูป, ป้ายสแตนดี้ทางเข้า"
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        </div>

                        {/* Row 2: ขนาด (กว้าง x สูง x จำนวน) => พื้นที่ ตร.ม. => ราคา/ตร.ม. => รวมเงิน */}
                        <div className="grid grid-cols-2 sm:grid-cols-12 gap-2 sm:gap-3 items-end pt-2 border-t border-slate-100">
                          {/* กว้าง */}
                          <div className="col-span-1 sm:col-span-2">
                            <label className="text-xs sm:text-sm font-bold text-slate-700 block mb-1">กว้าง (เมตร)</label>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              placeholder="0"
                              value={item.width !== undefined && item.width !== null ? item.width : ''}
                              onChange={(e) => {
                                const updated = [...backdropItems];
                                updated[index].width = e.target.value === '' ? '' : (parseFloat(e.target.value) || 0);
                                setBackdropItems(updated);
                              }}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-center font-bold text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono shadow-2xs"
                            />
                          </div>

                          {/* สูง */}
                          <div className="col-span-1 sm:col-span-2">
                            <label className="text-xs sm:text-sm font-bold text-slate-700 block mb-1">สูง/ยาว (เมตร)</label>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              placeholder="0"
                              value={item.height !== undefined && item.height !== null ? item.height : ''}
                              onChange={(e) => {
                                const updated = [...backdropItems];
                                updated[index].height = e.target.value === '' ? '' : (parseFloat(e.target.value) || 0);
                                setBackdropItems(updated);
                              }}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-center font-bold text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono shadow-2xs"
                            />
                          </div>

                          {/* จำนวน */}
                          <div className="col-span-1 sm:col-span-1">
                            <label className="text-xs sm:text-sm font-bold text-slate-700 block mb-1">จำนวน</label>
                            <input
                              type="number"
                              min="1"
                              placeholder="1"
                              value={item.qty !== undefined && item.qty !== null ? item.qty : 1}
                              onChange={(e) => {
                                const updated = [...backdropItems];
                                updated[index].qty = e.target.value === '' ? '' : (parseInt(e.target.value, 10) || 1);
                                setBackdropItems(updated);
                              }}
                              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-center font-bold text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono shadow-2xs"
                            />
                          </div>

                          {/* รวม ตร.ม. (Calculated Badge) */}
                          <div className="col-span-1 sm:col-span-2 text-center">
                            <label className="text-xs sm:text-sm font-bold text-slate-700 block mb-1">พื้นที่รวม</label>
                            <div className="py-1.5 px-2 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs sm:text-sm font-black font-mono text-indigo-700">
                              {item.totalSqm.toFixed(2)} <span className="text-xs font-bold text-indigo-600">ตร.ม.</span>
                            </div>
                          </div>

                          {/* ราคา/ตร.ม. (Editable + Override / Revert button) */}
                          <div className="col-span-1 sm:col-span-2">
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs sm:text-sm font-bold text-slate-700">฿ / ตร.ม.</label>
                              {item.isOverridden && (
                                <button
                                  type="button"
                                  onClick={() => handleRevertBasePrice(index)}
                                  className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-0.5 cursor-pointer"
                                  title="คืนค่าเป็นราคากลาง"
                                >
                                  <RotateCcw className="w-3 h-3" /> คืนค่า
                                </button>
                              )}
                            </div>
                            <input
                              type="number"
                              placeholder="0"
                              value={item.unitPriceSqm !== undefined && item.unitPriceSqm !== null ? item.unitPriceSqm : ''}
                              onChange={(e) => {
                                const updated = [...backdropItems];
                                updated[index].unitPriceSqm = e.target.value === '' ? '' : (parseFloat(e.target.value) || 0);
                                setBackdropItems(updated);
                              }}
                              className={`w-full px-2.5 py-1.5 border rounded-xl font-bold font-mono text-xs sm:text-sm text-right focus:outline-none focus:ring-2 shadow-2xs ${
                                item.isOverridden
                                  ? 'border-amber-400 bg-amber-50/50 text-amber-900 focus:ring-amber-400'
                                  : 'border-slate-200 bg-white text-slate-800 focus:ring-indigo-500'
                              }`}
                            />
                          </div>

                          {/* รวมเงิน & ปุ่มลบ */}
                          <div className="col-span-1 sm:col-span-3 flex items-center justify-end gap-2">
                            <div className="text-right flex-1">
                              <label className="text-xs sm:text-sm font-bold text-slate-700 block mb-0.5">รวมเงิน</label>
                              <span className="font-black text-slate-900 text-sm sm:text-base font-mono">
                                ฿{item.lineTotal.toLocaleString()}
                              </span>
                            </div>
                            {backdropItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setBackdropItems(backdropItems.filter((_, i) => i !== index))}
                                className="hidden sm:flex p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                                title="ลบรายการนี้"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* แถบเพิ่มรายการ & สรุปยอดรวม Backdrop ด้านล่าง */}
                  <div className="flex justify-between items-center mt-3 pt-1">
                    <button
                      type="button"
                      onClick={handleAddBackdropRow}
                      className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-3 py-2 rounded-xl transition-all active:scale-95 cursor-pointer w-fit"
                    >
                      <Plus className="w-4 h-4" />
                      <span>เพิ่มรายการป้าย/ฉาก</span>
                    </button>
                    <div className="text-xs sm:text-sm font-bold text-indigo-800 bg-indigo-50 px-3.5 py-1.5 rounded-xl border border-indigo-100">
                      รวม: ฿{totalBackdropCost.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* ส่วนที่ 3.3: ตารางดอกไม้ กระดาษ พร็อพ และอุปกรณ์เสริม */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold">3</div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                          <span>รายการดอกไม้ กระดาษ พร็อพ และบริการเสริม</span>
                        </h4>
                        <p className="text-xs sm:text-sm text-slate-600 font-medium">
                          ดึงข้อมูลและราคาต้นทุนจากคลังพัสดุอัตโนมัติ หรือพิมพ์รายการเสริมเองได้อิสระ
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Clean Floral Table List with Inline Inventory Dropdown */}
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-visible shadow-xs">
                    {/* Table Header (shown on sm screens and up) */}
                    <div className="hidden sm:grid grid-cols-12 gap-3 px-4 py-2.5 bg-slate-50/80 border-b border-slate-200 text-xs sm:text-sm font-bold text-slate-700">
                      <div className="col-span-5">ชื่อรายการ / พัสดุจากคลัง</div>
                      <div className="col-span-1 text-center">หน่วย</div>
                      <div className="col-span-1 text-center">จำนวน</div>
                      <div className="col-span-2 text-right">ราคา/หน่วย (฿)</div>
                      <div className="col-span-2 text-right">รวมเงิน (฿)</div>
                      <div className="col-span-1 text-center">ลบ</div>
                    </div>

                    {/* Floral Items */}
                    <div className="space-y-3 sm:space-y-0">
                      {calculatedFloral.map((item, index) => {
                        const matchedInv = localInventory.find(
                          inv => inv.id === item.inventory_id || (item.name && inv.name.trim().toLowerCase() === item.name.trim().toLowerCase())
                        );
                        const invCost = matchedInv ? (Number(matchedInv.average_cost) || 0) : 0;
                        const unitPrice = Number(item.unitPrice) || 0;
                        const isDropdownOpen = activeFloralDropdownIndex === index;
                        const openUpwards = floralItems.length > 2 && index >= floralItems.length - 2;

                        const searchQuery = (item.name || '').trim().toLowerCase();
                        const filteredInventory = localInventory.filter(inv => {
                          if (!searchQuery) return true;
                          const nameMatch = inv.name && inv.name.toLowerCase().includes(searchQuery);
                          const codeMatch = inv.code && inv.code.toLowerCase().includes(searchQuery);
                          return nameMatch || codeMatch;
                        });

                        const isExactMatch = matchedInv && matchedInv.name.trim().toLowerCase() === searchQuery;

                        return (
                          <div
                            key={item.id}
                            className="rounded-2xl sm:rounded-none border sm:border-0 border-violet-100 overflow-hidden bg-white sm:bg-transparent shadow-xs sm:shadow-none transition-colors relative"
                          >
                            {/* Mobile Card Header */}
                            <div className="sm:hidden bg-gradient-to-r from-violet-600 to-indigo-600 px-3.5 py-2 flex items-center justify-between text-white shadow-2xs">
                              <span className="font-black text-xs flex items-center gap-1.5 tracking-wide">
                                <Palette className="w-3.5 h-3.5 text-white/90" />
                                รายการที่ {index + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => setFloralItems(floralItems.filter((_, i) => i !== index))}
                                className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition active:scale-90"
                                title={`ลบรายการที่ ${index + 1}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="p-3 sm:px-4 sm:py-3.5 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 items-start border-b sm:border-b-0 border-slate-100 last:border-b-0 hover:bg-slate-50/60 transition-colors relative">
                            {/* Col 1: Item Name / Combobox (col-span-5) */}
                            <div className="sm:col-span-5 relative" ref={isDropdownOpen ? floralDropdownRef : null}>
                              <span className="sm:hidden text-xs font-bold text-slate-700 block mb-0.5">
                                ชื่อรายการ / พัสดุจากคลัง
                              </span>

                              <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                  {matchedInv ? (
                                    <Package className="w-4 h-4 text-violet-600" />
                                  ) : (
                                    <Edit className="w-3.5 h-3.5 text-slate-400" />
                                  )}
                                </div>

                                <input
                                  type="text"
                                  placeholder="ค้นหาพัสดุในคลัง หรือพิมพ์ชื่อรายการเอง..."
                                  value={item.name}
                                  onFocus={() => setActiveFloralDropdownIndex(index)}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const updated = [...floralItems];
                                    updated[index] = {
                                      ...updated[index],
                                      name: val,
                                      inventory_id: val ? updated[index].inventory_id : null
                                    };
                                    setFloralItems(updated);
                                    if (activeFloralDropdownIndex !== index) {
                                      setActiveFloralDropdownIndex(index);
                                    }
                                  }}
                                  className={`w-full pl-9 pr-8 py-2 bg-slate-50/70 hover:bg-white focus:bg-white border rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all shadow-2xs h-[38px] ${
                                    matchedInv ? 'border-violet-200' : 'border-slate-200'
                                  }`}
                                />

                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                  {item.name && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = [...floralItems];
                                        updated[index] = { ...updated[index], name: '', inventory_id: null, base_cost: 0 };
                                        setFloralItems(updated);
                                        setActiveFloralDropdownIndex(index);
                                      }}
                                      className="p-1 text-slate-300 hover:text-slate-600 rounded cursor-pointer"
                                      title="ล้างข้อความ"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setActiveFloralDropdownIndex(isDropdownOpen ? null : index)}
                                    className="p-1 text-slate-400 hover:text-violet-600 rounded transition cursor-pointer"
                                    title="แสดงรายการในคลัง"
                                  >
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                                  </button>
                                </div>
                              </div>

                              {/* Dropdown Menu (Opens upward near bottom to prevent modal clipping) */}
                              {isDropdownOpen && (
                                <div className={`absolute left-0 right-0 ${openUpwards ? 'bottom-full mb-1.5' : 'top-full mt-1.5'} bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-2 max-h-64 overflow-y-auto divide-y divide-slate-100`}>
                                  <div className="px-3 py-2 text-xs font-bold text-slate-600 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                      <Package className="w-4 h-4 text-violet-600" />
                                      คลังพัสดุ ({filteredInventory.length} รายการ)
                                    </span>
                                    <span className="text-xs text-slate-500 font-medium">คลิกเพื่อดึงข้อมูลและราคาทุน</span>
                                  </div>

                                  {/* Custom option if user typed something not strictly matching */}
                                  {searchQuery && !isExactMatch && (
                                    <div
                                      onClick={() => handleSelectCustomItem(index, item.name)}
                                      className="p-2.5 hover:bg-violet-50/70 rounded-xl cursor-pointer flex items-center justify-between transition-colors text-violet-700 font-semibold text-xs"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Plus className="w-3.5 h-3.5 text-violet-500" />
                                        <span>ใช้ชื่อนี้: &ldquo;{item.name}&rdquo;</span>
                                      </div>
                                      <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-md font-semibold">
                                        รายการกำหนดเอง (นอกคลัง)
                                      </span>
                                    </div>
                                  )}

                                  {/* Inventory items list */}
                                  {filteredInventory.map(inv => {
                                    const isOutOfStock = (inv.current_stock ?? 0) <= 0;
                                    const isLowStock = !isOutOfStock && (inv.current_stock ?? 0) <= (inv.min_alert_threshold || 5);
                                    const cost = Number(inv.average_cost) || 0;

                                    return (
                                      <div
                                        key={inv.id}
                                        onClick={() => handleSelectInventoryItem(index, inv)}
                                        className={`p-2.5 hover:bg-violet-50/70 rounded-xl cursor-pointer flex items-center justify-between transition-colors group ${
                                          matchedInv?.id === inv.id ? 'bg-violet-50/50 ring-1 ring-violet-200' : ''
                                        }`}
                                      >
                                        <div className="space-y-0.5 pr-2">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                              {inv.code || '-'}
                                            </span>
                                            <span className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-violet-700 transition-colors">
                                              {inv.name}
                                            </span>
                                          </div>

                                          <div className="flex items-center gap-2 text-xs">
                                            {isOutOfStock ? (
                                              <span className="inline-flex items-center gap-1 font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 text-xs">
                                                <AlertTriangle className="w-3 h-3" /> หมดสต็อก (0 {inv.unit || 'ชิ้น'})
                                              </span>
                                            ) : isLowStock ? (
                                              <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-xs">
                                                <AlertCircle className="w-3 h-3" /> ใกล้หมด (เหลือ {inv.current_stock} {inv.unit || 'ชิ้น'})
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 text-xs">
                                                คงเหลือ: {inv.current_stock} {inv.unit || 'ชิ้น'}
                                              </span>
                                            )}

                                            {inv.storage_location && (
                                              <span className="text-xs text-slate-500 hidden sm:inline">
                                                ที่เก็บ: {inv.storage_location}
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        <div className="text-right shrink-0">
                                          <span className="text-xs text-slate-500 font-medium block">ต้นทุนคลัง</span>
                                          <span className="font-mono font-bold text-violet-700 text-xs sm:text-sm">
                                            ฿{cost.toLocaleString()}
                                          </span>
                                          <span className="text-xs text-slate-500 block">/{inv.unit || 'ชิ้น'}</span>
                                        </div>
                                      </div>
                                    );
                                  })}

                                  {filteredInventory.length === 0 && (
                                    <div className="p-4 text-center text-xs sm:text-sm text-slate-500 space-y-1.5">
                                      <p className="font-semibold text-slate-700">ไม่พบพัสดุในคลังที่ตรงกับคำค้นหา</p>
                                      {item.name && (
                                        <button
                                          type="button"
                                          onClick={() => handleSelectCustomItem(index, item.name)}
                                          className="text-violet-700 hover:text-violet-800 font-bold underline cursor-pointer"
                                        >
                                          ใช้เป็นรายการกำหนดเอง: &ldquo;{item.name}&rdquo;
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Selected Inventory Info Badge (Under Input) */}
                              {matchedInv ? (
                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                  {/* Stock status badge */}
                                  {(matchedInv.current_stock ?? 0) <= 0 ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                                      หมดสต็อก (0 {matchedInv.unit || 'ชิ้น'})
                                    </span>
                                  ) : (matchedInv.current_stock ?? 0) <= (matchedInv.min_alert_threshold || 5) ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                      ใกล้หมด! เหลือ {matchedInv.current_stock} {matchedInv.unit || 'ชิ้น'}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700">
                                      <Package className="w-3.5 h-3.5 text-slate-500" />
                                      คงเหลือ: {matchedInv.current_stock} {matchedInv.unit || 'ชิ้น'}
                                    </span>
                                  )}

                                  {/* Cost Reference Tag */}
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-100">
                                    <Tag className="w-3.5 h-3.5 text-violet-500" />
                                    ทุนคลัง: <strong className="font-mono">฿{invCost.toLocaleString()}</strong>
                                  </span>

                                  {/* Profit / Margin comparison badge */}
                                  {unitPrice > invCost && invCost > 0 ? (
                                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                                      +฿{(unitPrice - invCost).toLocaleString()} กำไร ({Math.round(((unitPrice - invCost) / invCost) * 100)}%)
                                    </span>
                                  ) : unitPrice < invCost ? (
                                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                      <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                                      ต่ำกว่าทุน -฿{(invCost - unitPrice).toLocaleString()}
                                    </span>
                                  ) : invCost > 0 ? (
                                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200">
                                      เท่าทุนคลัง
                                    </span>
                                  ) : null}

                                  {/* Quick button to restore price to base cost */}
                                  {unitPrice !== invCost && invCost > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => handleSetCostPrice(index, invCost)}
                                      className="text-xs text-violet-700 hover:text-violet-900 underline font-bold cursor-pointer ml-1"
                                      title="ปรับราคาเสนอให้เท่ากับต้นทุนคลัง"
                                    >
                                      ดึงราคาทุน
                                    </button>
                                  )}
                                </div>
                              ) : item.name ? (
                                <div className="mt-1 flex items-center gap-1 text-xs text-slate-500 font-medium">
                                  <span>รายการกำหนดเอง (นอกคลังพัสดุ)</span>
                                </div>
                              ) : null}
                            </div>

                            {/* Subgrid for Unit, Qty, UnitPrice on mobile, contents on sm+ */}
                            <div className="grid grid-cols-3 sm:contents gap-2 items-start">
                              {/* Col 2: Unit (sm:col-span-1) */}
                              <div className="sm:col-span-1">
                                <span className="sm:hidden text-xs font-bold text-slate-700 block mb-0.5">หน่วยนับ</span>
                                <input
                                  type="text"
                                  placeholder="หน่วย"
                                  value={item.unit || ''}
                                  onChange={(e) => {
                                    const updated = [...floralItems];
                                    updated[index].unit = e.target.value;
                                    setFloralItems(updated);
                                  }}
                                  className="w-full px-1.5 py-2 bg-slate-50/70 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-center text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all shadow-2xs h-[38px]"
                                />
                              </div>

                              {/* Col 3: Qty (sm:col-span-1) */}
                              <div className="sm:col-span-1">
                                <span className="sm:hidden text-xs font-bold text-slate-700 block mb-0.5">จำนวน</span>
                                <input
                                  type="number"
                                  min="1"
                                  placeholder="1"
                                  value={item.qty !== undefined && item.qty !== null ? item.qty : 1}
                                  onChange={(e) => {
                                    const updated = [...floralItems];
                                    updated[index].qty = e.target.value === '' ? '' : (parseFloat(e.target.value) || 0);
                                    setFloralItems(updated);
                                  }}
                                  className="w-full px-1 py-2 bg-slate-50/70 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-center font-mono font-bold text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all shadow-2xs h-[38px]"
                                />
                                {matchedInv && matchedInv.item_type !== 'task' && (matchedInv.current_stock ?? 0) < (Number(item.qty) || 0) && (Number(item.qty) > 0) && (
                                  <span className="text-xs font-bold text-rose-600 block text-center mt-0.5">
                                    เกินสต็อก
                                  </span>
                                )}
                              </div>

                              {/* Col 4: Price / Unit (sm:col-span-2) */}
                              <div className="sm:col-span-2">
                                <span className="sm:hidden text-xs font-bold text-slate-700 block mb-0.5">ราคาเสนอ/หน่วย (฿)</span>
                                <input
                                  type="number"
                                  placeholder="0"
                                  value={item.unitPrice !== undefined && item.unitPrice !== null ? item.unitPrice : ''}
                                  onChange={(e) => {
                                    const updated = [...floralItems];
                                    updated[index].unitPrice = e.target.value === '' ? '' : (parseFloat(e.target.value) || 0);
                                    setFloralItems(updated);
                                  }}
                                  className="w-full px-2 py-2 bg-slate-50/70 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-right font-mono font-bold text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all shadow-2xs h-[38px]"
                                />
                              </div>
                            </div>

                            {/* Subflex for Total and Delete on mobile, contents on sm+ */}
                            <div className="flex sm:contents items-center justify-between pt-1 sm:pt-0">
                              {/* Col 5: Line Total (sm:col-span-2) */}
                              <div className="sm:col-span-2 text-left sm:text-right">
                                <span className="sm:hidden text-xs font-bold text-slate-700 block mb-0.5">รวมเงิน</span>
                                <div className="h-[38px] flex items-center justify-start sm:justify-end">
                                  <span className="font-mono font-bold text-slate-800 text-xs sm:text-sm">
                                    ฿{item.lineTotal.toLocaleString()}
                                  </span>
                                </div>
                              </div>

                              {/* Col 6: Delete button (sm:col-span-1) */}
                              <div className="hidden sm:flex sm:col-span-1 items-center justify-end sm:justify-center">
                                <div className="h-[38px] flex items-center justify-end sm:justify-center">
                                  <button
                                    type="button"
                                    onClick={() => setFloralItems(floralItems.filter((_, i) => i !== index))}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="ลบรายการนี้"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                            </div>
                          </div>
                        );
                      })}

                      {floralItems.length === 0 && (
                        <div className="p-8 text-center text-slate-500 space-y-2">
                          <Palette className="w-8 h-8 text-slate-400 mx-auto" />
                          <p className="font-bold text-slate-700 text-sm">ยังไม่มีรายการดอกไม้หรืออุปกรณ์เสริม</p>
                          <p className="text-xs sm:text-sm text-slate-500 font-medium">กด &ldquo;+ เพิ่มรายการเสริม&rdquo; ด้านล่าง เพื่อเลือกพัสดุจากคลังหรือกรอกรายการเสริม</p>
                        </div>
                      )}
                    </div>

                    {/* แถบเพิ่มรายการ & สรุปยอดรวม Floral ด้านล่าง */}
                    <div className="flex justify-between items-center px-4 py-3 bg-slate-50/70 border-t border-slate-200 rounded-b-2xl">
                      <button
                        type="button"
                        onClick={handleAddFloralRow}
                        className="flex items-center gap-2 text-xs font-semibold text-violet-600 hover:text-violet-700 hover:bg-violet-50 px-3 py-1.5 rounded-xl transition-all active:scale-95 cursor-pointer w-fit"
                      >
                        <Plus className="w-4 h-4" />
                        <span>เพิ่มรายการเสริม</span>
                      </button>
                      <div className="text-xs sm:text-sm font-bold text-violet-700 bg-violet-50 px-3.5 py-1.5 rounded-xl border border-violet-100">
                        รวม: ฿{totalFloralCost.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ส่วนที่ 3.4: หมายเหตุ & สรุปยอดราคา (Markup & Final Price) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2">
                  {/* หมายเหตุการผลิต/ติดตั้ง */}
                  <div className="lg:col-span-5 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-black">4</div>
                      <label className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wide">
                        หมายเหตุการผลิต / ข้อกำหนดหน้างาน
                      </label>
                    </div>
                    <textarea
                      rows="5"
                      placeholder="ระบุข้อกำหนดเพิ่มเติม เช่น สีธีมหลัก, เวลาส่งมอบ, ข้อควรระวังหน้างาน..."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none shadow-2xs"
                    />
                    {/* Quick note chips */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-slate-600">คีย์เวิร์ดด่วน:</span>
                      {['ธีมพาสเทลสดใส', 'ส่งมอบก่อน 12:00 น.', 'ต้องแลกบัตรเข้าพื้นที่', 'มีบันไดสูง 3 ขั้น'].map(chip => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => setNote(prev => prev ? `${prev}\n• ${chip}` : `• ${chip}`)}
                          className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-lg font-semibold transition cursor-pointer"
                        >
                          + {chip}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* สรุปต้นทุนและการตั้งราคา (User-Centric Financial Summary Card) */}
                  <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/90 shadow-md shadow-slate-200/40 p-5 sm:p-6 space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-violet-50 text-violet-600 rounded-xl">
                          <Calculator className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm sm:text-base font-black text-slate-900">สรุปโครงสร้างต้นทุน &amp; กำไร</h4>
                          <p className="text-xs sm:text-sm text-slate-500 font-medium">คำนวณราคาเสนอและกำไรสุทธิเรียลไทม์</p>
                        </div>
                      </div>
                      <span className="text-xs sm:text-sm font-mono font-bold text-slate-600 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
                        {backdropItems.length} ป้าย | {floralItems.length} เสริม
                      </span>
                    </div>

                    {/* Cost Breakdown Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
                        <span className="text-xs sm:text-sm font-bold text-slate-700 block">ต้นทุนป้ายโครงสร้าง (ตร.ม.)</span>
                        <span className="font-mono font-black text-slate-900 text-base sm:text-lg mt-0.5">
                          ฿{totalBackdropCost.toLocaleString()}
                        </span>
                      </div>
                      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
                        <span className="text-xs sm:text-sm font-bold text-slate-700 block">ต้นทุนดอกไม้ &amp; พัสดุเสริม</span>
                        <span className="font-mono font-black text-slate-900 text-base sm:text-lg mt-0.5">
                          ฿{totalFloralCost.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Total Cost COGS Banner */}
                    <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-amber-50/80 border border-amber-200/80">
                      <div>
                        <span className="text-xs sm:text-sm font-bold text-amber-950 block">ต้นทุนจริงรวมทั้งหมด (Total Cost)</span>
                        <span className="text-xs text-amber-800 font-medium">ค่าป้ายโครงสร้าง + พัสดุและดอกไม้</span>
                      </div>
                      <span className="font-mono font-black text-amber-900 text-lg sm:text-xl">
                        ฿{totalCost.toLocaleString()}
                      </span>
                    </div>

                    {/* Markup Buttons & Final Price Box (Redesigned High-Contrast UX/UI) */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
                      {/* Row 1: Markup % Quick Select */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                            <TrendingUp className="w-4 h-4 text-violet-600" />
                            <span>บวกอัตรากำไร (% Markup)</span>
                          </label>
                          <span className="text-xs text-slate-600 font-medium">เลือกกำไรด่วน หรือพิมพ์ % เอง</span>
                        </div>

                        <div className="bg-slate-100/90 p-1.5 rounded-2xl flex items-center gap-1.5">
                          {[20, 30, 40, 50].map(pct => {
                            const isSelected = markupPercent === pct && finalPriceInput === null;
                            return (
                              <button
                                key={pct}
                                type="button"
                                onClick={() => {
                                  setMarkupPercent(pct);
                                  setFinalPriceInput(null);
                                }}
                                className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-sm font-black'
                                    : 'bg-white text-slate-700 hover:text-slate-900 border border-slate-200/60 shadow-2xs hover:bg-slate-50'
                                }`}
                              >
                                +{pct}%
                              </button>
                            );
                          })}

                          <div className="flex items-center gap-1 bg-white border border-slate-200/80 rounded-xl px-2.5 py-1.5 w-24 shrink-0 focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/20 shadow-2xs">
                            <input
                              type="number"
                              value={markupPercent}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setMarkupPercent(val);
                                setFinalPriceInput(null);
                              }}
                              className="w-full text-center text-xs sm:text-sm font-black font-mono text-slate-900 focus:outline-none"
                              placeholder="0"
                            />
                            <span className="text-xs sm:text-sm font-bold text-slate-600">%</span>
                          </div>
                        </div>
                      </div>

                      {/* Row 2: Final Price to Client Input */}
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <label className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5 whitespace-nowrap">
                            <span>ราคาเสนอสุทธิ</span>
                            <span className="text-slate-500 font-semibold text-xs">(Final Price)</span>
                          </label>
                          <span className="text-xs sm:text-sm text-slate-600 font-medium block mt-0.5">
                            ยอดรวมสุทธิในการคำนวณราคา
                          </span>
                        </div>

                        <div className="relative min-w-[200px] sm:min-w-[240px]">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-violet-600 text-xl pointer-events-none">฿</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={finalPrice ? Number(finalPrice).toLocaleString('en-US') : (finalPrice === 0 ? '0' : '')}
                            placeholder="0"
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9]/g, '');
                              setFinalPriceInput(raw === '' ? 0 : parseInt(raw, 10));
                            }}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-bold font-mono text-xl sm:text-2xl text-right focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 shadow-xs transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Estimated Profit Banner */}
                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div>
                          <span className="text-xs sm:text-sm font-bold text-emerald-950 block">กำไรประเมินสุทธิของร้าน (Net Profit)</span>
                          <span className="text-xs text-emerald-800 font-medium">ราคาเสนอสุทธิ - ต้นทุนรวม</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-emerald-700 text-base sm:text-lg">
                          +{estimatedProfit >= 0 ? `฿${estimatedProfit.toLocaleString()}` : `-฿${Math.abs(estimatedProfit).toLocaleString()}`}
                        </span>
                        <span className="px-3 py-1 bg-emerald-600 text-white rounded-xl font-bold font-mono text-xs sm:text-sm shadow-xs">
                          {estimatedProfitMargin}% margin
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            {/* Sticky Modal Footer Action Buttons (Core 3.4 in หน้าเสนอราคา.md) */}
            <div className="px-5 py-4 sm:px-8 sm:py-5 border-t border-slate-100 bg-white/95 backdrop-blur-xl sticky bottom-0 z-30 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div>
                {editingDocId && (
                  <button
                    type="button"
                    onClick={() => promptDeleteQuotation(editingDocId, quoteNo)}
                    className="py-2.5 px-4 text-rose-600 hover:bg-rose-50 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">ลบใบงาน</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="py-3 px-5 sm:px-6 rounded-2xl text-slate-600 bg-slate-100/80 hover:bg-slate-200 font-bold text-sm transition-all active:scale-95 cursor-pointer"
                >
                  ยกเลิก
                </button>

                {editingDocId && (
                  <button
                    type="button"
                    onClick={() => handleCloneQuotation({
                      quote_no: quoteNo,
                      title,
                      client_name: clientName,
                      project_code: projectCode,
                      backdrop_items: calculatedBackdrops,
                      floral_items: calculatedFloral,
                      note,
                      markup_percent: markupPercent,
                      final_price: finalPrice
                    })}
                    className="py-3 px-4 sm:px-5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-2xl font-bold text-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 border border-emerald-200/50"
                  >
                    <Copy className="w-4 h-4" />
                    <span className="hidden sm:inline">โคลนเป็นรายการใหม่</span>
                  </button>
                )}

                <button
                  type="submit"
                  disabled={isSaving}
                  className="py-3 px-7 sm:px-8 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-0.5 hover:scale-[1.01] transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกราคาโปรเจกต์'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    )}

      {/* 4. MODAL ตั้งค่าราคากลางวัสดุ (MATERIAL MASTER PRICE MODAL - ตามพิมพ์เขียว) */}
      {isRatesModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md backdrop-animate-in"
            onClick={() => setIsRatesModalOpen(false)}
          />

          <div
            className="bg-white w-full max-w-xl sm:rounded-[2.5rem] rounded-2xl shadow-2xl relative z-10 overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] modal-animate-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky Header */}
            <div className="px-5 py-4 sm:px-8 sm:py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-20 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 sm:p-3 bg-indigo-50 text-indigo-600 rounded-xl sm:rounded-2xl shrink-0">
                  <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                    ตั้งค่าราคากลางวัสดุต่อ ตร.ม.
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">
                    กำหนดราคามาตรฐานต่อ ตร.ม. สำหรับใช้ดึงเป็นค่าเริ่มต้นในการคำนวณราคาใหม่
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRatesModalOpen(false)}
                className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-colors active:scale-95 cursor-pointer"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveMasterRates} className="flex flex-col flex-1 overflow-hidden">
              {/* Scrollable Form Body */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-8 custom-scrollbar space-y-4 overscroll-contain">
                <div className="text-xs sm:text-sm text-amber-900 bg-amber-50/90 p-4 rounded-2xl border border-amber-200/80 leading-relaxed font-medium">
                  💡 <b>กฎความถูกต้องของข้อมูล:</b> การแก้ไขราคากลางจะมีผลกับ <u>รายการคำนวณราคาใหม่</u> เท่านั้น จะไม่กระทบตัวเลขในรายการคำนวณราคาเดิมที่เคยบันทึกไปแล้ว
                </div>

                {/* Table of Material Rates */}
                <div className="space-y-2">
                  {editingRates.map((rate, index) => (
                    <div
                      key={rate.id || index}
                      className="p-3.5 sm:p-4 bg-slate-50/70 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="flex-1 font-bold text-slate-800 text-sm sm:text-base">
                        {rate.name}
                      </div>
                      <div className="flex items-center gap-2 w-40">
                        <input
                          type="number"
                          min="0"
                          value={rate.default_price_sqm}
                          onChange={(e) => {
                            const updated = [...editingRates];
                            updated[index].default_price_sqm = parseFloat(e.target.value) || 0;
                            setEditingRates(updated);
                          }}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-right font-black font-mono text-sm sm:text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                        />
                        <span className="text-slate-600 shrink-0 font-bold text-xs sm:text-sm">฿/ตร.ม.</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add New Rate Row */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="ชื่อวัสดุใหม่ เช่น พลาสวูด 10 มม."
                    value={newRateName}
                    onChange={(e) => setNewRateName(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                  />
                  <input
                    type="number"
                    placeholder="ราคา/ตร.ม."
                    value={newRatePrice}
                    onChange={(e) => setNewRatePrice(e.target.value)}
                    className="w-28 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                  />
                  <button
                    type="button"
                    onClick={handleAddNewRate}
                    className="px-4 py-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs sm:text-sm font-bold shrink-0 transition active:scale-95 cursor-pointer"
                  >
                    + เพิ่ม
                  </button>
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="px-5 py-4 sm:px-8 sm:py-5 border-t border-slate-100 bg-white/95 backdrop-blur-xl sticky bottom-0 z-30 flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsRatesModalOpen(false)}
                  className="py-3 px-5 sm:px-6 rounded-2xl text-slate-600 bg-slate-100/80 hover:bg-slate-200 font-bold text-sm transition-all active:scale-95 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="py-3 px-7 sm:px-8 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-0.5 hover:scale-[1.01] transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>บันทึกราคากลาง</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="ยืนยันการลบรายการคำนวณราคา"
        message={`ต้องการลบรายการคำนวณราคาเลขที่ "${deleteConfirm.quoteNo}" ออกจากระบบหรือไม่? การกระทำนี้ไม่สามารถย้อนคืนได้`}
        confirmText="ยืนยันลบ"
        cancelText="ยกเลิก"
        type="danger"
        onConfirm={handleConfirmDeleteQuotation}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: null, quoteNo: '' })}
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

export default React.memo(Quotations);
