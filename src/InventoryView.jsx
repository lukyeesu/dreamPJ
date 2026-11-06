import React, { useState, useMemo, useEffect } from 'react';
import {
  Package,
  Layers,
  Wrench,
  AlertTriangle,
  Search,
  Plus,
  CheckCircle2,
  Clock,
  ArrowRightLeft,
  Edit,
  Trash2,
  Check,
  X,
  Filter,
  DollarSign,
  Tag,
  MapPin,
  Calendar,
  ExternalLink,
  Printer,
  RotateCcw,
  Scissors,
  Sparkles,
  Banknote,
  FileCheck2,
  ListTodo,
  Boxes,
  User,
  ShieldCheck,
  CheckSquare,
  Square,
  ChevronDown,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  ArrowUpRight
} from 'lucide-react';
import {
  saveInventoryItemSync,
  deleteInventoryItemSync,
  saveAssetLoanSync,
  returnAssetLoanSync,
  loadAssetUnitsLocalFirst,
  saveAssetUnitSync,
  deleteAssetUnitSync,
  loadProjectChecklistLocalFirst,
  saveProjectChecklistItemSync,
  deleteProjectChecklistItemSync,
  toggleChecklistItemSync,
  borrowAssetUnitsSync,
  returnAssetUnitsSync,
  reconcileProjectItemSync,
  DEFAULT_INVENTORY_ITEMS_SPEC,
  DEFAULT_ASSET_UNITS
} from './services/syncService';
import ModernDateTimePicker from './components/common/ModernDateTimePicker';
import Toast from './components/common/Toast';
import ConfirmDialog from './components/common/ConfirmDialog';

function InventoryView({
  inventoryItems = [],
  assetLoans = [],
  activities = [],
  isCreateOpen = false,
  onCloseCreate,
  onOpenProjectModal,
  onRefresh
}) {
  // 4 Tabs: 'stock' | 'checklist' | 'units' | 'loans'
  const [activeTab, setActiveTab] = useState('checklist');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Asset Units State (Serialized item0001, item0002...)
  const [assetUnits, setAssetUnits] = useState(DEFAULT_ASSET_UNITS);
  const [unitStatusFilter, setUnitStatusFilter] = useState('all');

  // Project Checklist State (Spec from d:\WebappDreame\_Markdown_.md_.md)
  const [checklistItems, setChecklistItems] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  // Item Modal State
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemFormData, setItemFormData] = useState({
    code: '',
    name: '',
    item_type: 'consumable',
    unit: 'ชิ้น',
    current_stock: 0,
    min_alert_threshold: 5,
    average_cost: 0,
    storage_location: '',
    color: '',
    size: '',
    status: 'in_service'
  });

  // Loan Modal State
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [loanFormData, setLoanFormData] = useState({
    item_id: '',
    project_id: '',
    borrower_name: '',
    expected_return_at: '',
    notes: ''
  });

  // Unit Modal State (Add Serialized Unit)
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [unitFormData, setUnitFormData] = useState({
    unit_code: '',
    item_id: '',
    status: 'AVAILABLE',
    notes: '',
    batch_count: 1
  });

  // Add Checklist Item Modal State
  const [isAddChecklistModalOpen, setIsAddChecklistModalOpen] = useState(false);
  const [checklistFormData, setChecklistFormData] = useState({
    mode: 'inventory', // 'inventory' | 'custom_task'
    item_id: '',
    item_name: '',
    item_type: 'consumable',
    category_name: '',
    required_qty: 1,
    unit: 'ชิ้น',
    unit_cost: 0,
    notes: ''
  });

  // Reconciliation Modal State (วัสดุหมุนเวียน คืนของดี คำนวณเสียหาย)
  const [reconcileTarget, setReconcileTarget] = useState(null); // checklist item
  const [reconcileForm, setReconcileForm] = useState({
    returned_qty: 0,
    damaged_qty: 0
  });

  // Borrow Units Modal State (ยืมกรรไกร/อุปกรณ์ระบุรหัสรายชิ้น)
  const [borrowTarget, setBorrowTarget] = useState(null); // checklist item
  const [borrowForm, setBorrowForm] = useState({
    selectedCodes: [],
    borrowerName: ''
  });

  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [returnConfirm, setReturnConfirm] = useState({ isOpen: false, loanId: null });
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, type: '', id: null, title: '' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

  // Active / Ongoing Projects (ไม่แสดงงานที่ COMPLETED หรือ CANCELLED ตามสเปกข้อ 5)
  const activeProjects = useMemo(() => {
    return activities.filter(p => {
      const deal = (p.dealStatus || p.deal_status || '').toLowerCase();
      const transport = (p.transportStatus || p.transport_status || '').toLowerCase();
      const isFinished = ['completed', 'finished', 'done', 'delivered'].includes(deal) || ['delivered', 'completed'].includes(transport);
      const isCancelled = ['cancelled', 'rejected'].includes(deal);
      return !isFinished && !isCancelled;
    });
  }, [activities]);

  // Set default selected project
  useEffect(() => {
    if (!selectedProjectId && (activeProjects.length > 0 || activities.length > 0)) {
      const first = activeProjects[0] || activities[0];
      if (first) {
        setSelectedProjectId(first.id);
      }
    }
  }, [activeProjects, activities, selectedProjectId]);

  // Load Asset Units & Checklist on mount
  useEffect(() => {
    loadAssetUnitsLocalFirst(setAssetUnits);
  }, []);

  // Load Checklist Items when selected project changes
  useEffect(() => {
    if (selectedProjectId) {
      loadProjectChecklistLocalFirst(selectedProjectId, (items) => {
        setChecklistItems(items);
      });
    }
  }, [selectedProjectId]);

  // Current selected project object
  const currentProject = useMemo(() => {
    return activities.find(p => p.id === selectedProjectId) || activeProjects[0] || null;
  }, [activities, activeProjects, selectedProjectId]);

  // Listen to single header button from App.jsx
  useEffect(() => {
    if (isCreateOpen) {
      if (activeTab === 'stock') {
        handleOpenItemModal();
      } else if (activeTab === 'checklist') {
        setIsAddChecklistModalOpen(true);
      } else if (activeTab === 'units') {
        setIsUnitModalOpen(true);
      } else {
        setIsLoanModalOpen(true);
      }
      if (onCloseCreate) onCloseCreate();
    }
  }, [isCreateOpen, activeTab]);

  // Keyboard shortcut: close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isItemModalOpen) setIsItemModalOpen(false);
        else if (isLoanModalOpen) setIsLoanModalOpen(false);
        else if (isUnitModalOpen) setIsUnitModalOpen(false);
        else if (isAddChecklistModalOpen) setIsAddChecklistModalOpen(false);
        else if (reconcileTarget) setReconcileTarget(null);
        else if (borrowTarget) setBorrowTarget(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isItemModalOpen, isLoanModalOpen, isUnitModalOpen, isAddChecklistModalOpen, reconcileTarget, borrowTarget]);

  // Statistics for Stock (5 Types)
  const stockStats = useMemo(() => {
    const totalItems = inventoryItems.length;
    const lowStockCount = inventoryItems.filter(i => {
      const stock = Number(i.current_stock) || 0;
      const threshold = Number(i.min_alert_threshold) || 5;
      return i.item_type !== 'task' && stock <= threshold;
    }).length;

    const inServiceCount = inventoryItems.filter(i => i.status === 'in_service').length;
    const totalValuation = inventoryItems.reduce((sum, i) => {
      if (i.item_type === 'task') return sum;
      const qty = Number(i.current_stock) || 0;
      const cost = Number(i.average_cost) || 0;
      return sum + (qty * cost);
    }, 0);

    return { totalItems, lowStockCount, inServiceCount, totalValuation };
  }, [inventoryItems]);

  // Statistics for Units
  const unitStats = useMemo(() => {
    const total = assetUnits.length;
    const available = assetUnits.filter(u => u.status === 'AVAILABLE' || u.status === 'available').length;
    const borrowed = assetUnits.filter(u => u.status === 'BORROWED' || u.status === 'borrowed').length;
    const broken = assetUnits.filter(u => u.status === 'BROKEN' || u.status === 'LOST' || u.status === 'broken' || u.status === 'lost').length;
    return { total, available, borrowed, broken };
  }, [assetUnits]);

  // Statistics for Checklist
  const checklistStats = useMemo(() => {
    const total = checklistItems.length;
    const checked = checklistItems.filter(i => i.is_checked).length;
    const percent = total > 0 ? Math.round((checked / total) * 100) : 0;
    
    const taskCount = checklistItems.filter(i => i.item_type === 'task' || i.item_type === 'TASK').length;
    const banknoteCount = checklistItems.filter(i => i.item_type === 'banknote' || i.item_type === 'BANKNOTE').length;
    const banknoteValue = checklistItems
      .filter(i => i.item_type === 'banknote' || i.item_type === 'BANKNOTE')
      .reduce((sum, i) => sum + ((Number(i.required_qty) || 0) * (Number(i.unit_cost) || 0)), 0);
    const reusableCount = checklistItems.filter(i => i.item_type === 'reusable' || i.item_type === 'REUSABLE' || i.item_type === 'reusable_material').length;
    const assetCount = checklistItems.filter(i => i.item_type === 'asset' || i.item_type === 'ASSET').length;

    return { total, checked, percent, taskCount, banknoteCount, banknoteValue, reusableCount, assetCount };
  }, [checklistItems]);

  // Statistics for Loans
  const loanStats = useMemo(() => {
    const now = new Date();
    const borrowed = assetLoans.filter(l => l.status === 'borrowed').length;
    const returned = assetLoans.filter(l => l.status === 'returned').length;
    const overdue = assetLoans.filter(l => {
      if (l.status !== 'borrowed' || !l.expected_return_at) return false;
      return new Date(l.expected_return_at) < now;
    }).length;

    return { borrowed, returned, overdue };
  }, [assetLoans]);

  // Filtered Stock Items (Support 5 Types)
  const filteredStock = useMemo(() => {
    return inventoryItems.filter(item => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q ||
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.code && item.code.toLowerCase().includes(q)) ||
        (item.storage_location && item.storage_location.toLowerCase().includes(q)) ||
        (item.color && item.color.toLowerCase().includes(q));

      const matchType = selectedType === 'all' || item.item_type === selectedType;
      const matchStatus = selectedStatus === 'all' || item.status === selectedStatus;

      return matchSearch && matchType && matchStatus;
    });
  }, [inventoryItems, searchQuery, selectedType, selectedStatus]);

  // Filtered Asset Units
  const filteredUnits = useMemo(() => {
    return assetUnits.filter(unit => {
      const q = searchQuery.toLowerCase().trim();
      const parentItem = inventoryItems.find(i => i.id === unit.item_id);
      const matchSearch = !q ||
        (unit.unit_code && unit.unit_code.toLowerCase().includes(q)) ||
        (unit.borrowed_by && unit.borrowed_by.toLowerCase().includes(q)) ||
        (unit.project_id && unit.project_id.toLowerCase().includes(q)) ||
        (parentItem?.name && parentItem.name.toLowerCase().includes(q));

      const matchStatus = unitStatusFilter === 'all' || unit.status.toUpperCase() === unitStatusFilter.toUpperCase();
      return matchSearch && matchStatus;
    });
  }, [assetUnits, inventoryItems, searchQuery, unitStatusFilter]);

  // Filtered Loans
  const filteredLoans = useMemo(() => {
    return assetLoans.filter(loan => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q ||
        (loan.borrower_name && loan.borrower_name.toLowerCase().includes(q)) ||
        (loan.project_id && loan.project_id.toLowerCase().includes(q)) ||
        (loan.item?.name && loan.item.name.toLowerCase().includes(q));

      return matchSearch;
    });
  }, [assetLoans, searchQuery]);

  // Open item modal for add/edit
  const handleOpenItemModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      setItemFormData({
        code: item.code || '',
        name: item.name || '',
        item_type: item.item_type || 'consumable',
        unit: item.unit || 'ชิ้น',
        current_stock: item.current_stock ?? 0,
        min_alert_threshold: item.min_alert_threshold ?? 5,
        average_cost: item.average_cost ?? 0,
        storage_location: item.storage_location || '',
        color: item.color || '',
        size: item.size || '',
        status: item.status || 'in_service'
      });
    } else {
      setEditingItem(null);
      setItemFormData({
        code: `item${String(inventoryItems.length + 1).padStart(4, '0')}`,
        name: '',
        item_type: 'consumable',
        unit: 'ชิ้น',
        current_stock: 0,
        min_alert_threshold: 5,
        average_cost: 0,
        storage_location: '',
        color: '',
        size: '',
        status: 'in_service'
      });
    }
    setIsItemModalOpen(true);
  };

  // Submit Save Item
  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!itemFormData.name.trim()) {
      showToast('กรุณากรอกชื่อพัสดุ', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...itemFormData,
        id: editingItem?.id || undefined,
        current_stock: parseFloat(itemFormData.current_stock) || 0,
        min_alert_threshold: parseFloat(itemFormData.min_alert_threshold) || 0,
        average_cost: parseFloat(itemFormData.average_cost) || 0
      };

      await saveInventoryItemSync(payload);
      setIsItemModalOpen(false);
      showToast('บันทึกพัสดุสำเร็จ', 'success');
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast('บันทึกพัสดุล้มเหลว: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Quick Stock Adjust (+1 / -1)
  const handleQuickAdjustStock = async (item, delta) => {
    const newStock = Math.max(0, (Number(item.current_stock) || 0) + delta);
    try {
      await saveInventoryItemSync({
        ...item,
        current_stock: newStock
      });
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Adjust stock error:', err);
    }
  };

  // Submit Create Serialized Unit(s)
  const handleSaveUnit = async (e) => {
    e.preventDefault();
    if (!unitFormData.item_id) {
      showToast('กรุณาเลือกอุปกรณ์แม่', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const count = Math.max(1, parseInt(unitFormData.batch_count) || 1);
      const baseCode = unitFormData.unit_code.trim() || `item${String(assetUnits.length + 1).padStart(4, '0')}`;

      for (let i = 0; i < count; i++) {
        let code = baseCode;
        if (count > 1) {
          // Auto increment number
          const match = baseCode.match(/^(.*?)(\d+)$/);
          if (match) {
            const prefix = match[1];
            const num = parseInt(match[2], 10) + i;
            code = `${prefix}${String(num).padStart(match[2].length, '0')}`;
          } else {
            code = `${baseCode}-${i + 1}`;
          }
        }

        await saveAssetUnitSync({
          unit_code: code,
          item_id: unitFormData.item_id,
          status: unitFormData.status,
          notes: unitFormData.notes
        });
      }

      await loadAssetUnitsLocalFirst(setAssetUnits);
      setIsUnitModalOpen(false);
      showToast(`บันทึกรหัสรายชิ้น ${count} รายการเรียบร้อย`, 'success');
    } catch (err) {
      showToast('บันทึกรหัสรายชิ้นล้มเหลว: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Checklist Checkmark (Done-item strikethrough)
  const handleToggleChecklist = async (chkItem) => {
    const newChecked = !chkItem.is_checked;
    setChecklistItems(prev => prev.map(item => item.id === chkItem.id ? { ...item, is_checked: newChecked } : item));
    try {
      await toggleChecklistItemSync(chkItem.id, newChecked);
    } catch (err) {
      console.error('Toggle checklist error:', err);
    }
  };

  // Seed Demo Checklist from Spec (ตามข้อ 4 ใน _Markdown_.md_.md)
  const handleSeedDemoChecklist = async () => {
    if (!selectedProjectId) return;
    setIsSaving(true);
    try {
      const sampleItems = [
        {
          project_id: selectedProjectId,
          item_name: 'ออกแบบช่อดอกไม้ & จัดวางธีม',
          category_name: 'งานบริการ',
          item_type: 'task',
          required_qty: 1,
          unit: 'งาน',
          unit_cost: 500,
          notes: 'ติ๊กเมื่อออกแบบเสร็จ',
          is_checked: false
        },
        {
          project_id: selectedProjectId,
          item_name: 'ธนบัตร 100 บาท',
          category_name: 'ธนบัตร',
          item_type: 'banknote',
          required_qty: 50,
          unit: 'ใบ',
          unit_cost: 100,
          notes: 'มูลค่า 5,000 บาท (เบิกแล้วตัดยอดเงินสด)',
          is_checked: false
        },
        {
          project_id: selectedProjectId,
          item_name: 'ดอกทิวลิปพลาสติก (สีขาว)',
          category_name: 'วัสดุหมุนเวียน',
          item_type: 'reusable',
          required_qty: 100,
          unit: 'ชิ้น',
          unit_cost: 25,
          notes: 'เสร็จงานต้องนับคืนคลัง',
          is_checked: false
        },
        {
          project_id: selectedProjectId,
          item_name: 'กรรไกรตัดกระดาษ (สีน้ำเงิน)',
          category_name: 'อุปกรณ์ยืม-คืน',
          item_type: 'asset',
          required_qty: 1,
          unit: 'อัน',
          unit_cost: 0,
          assigned_codes: ['item0001'],
          notes: 'รหัสที่ยืม: item0001 (นาย A)',
          is_checked: true
        }
      ];

      for (const item of sampleItems) {
        await saveProjectChecklistItemSync(item);
      }

      await loadProjectChecklistLocalFirst(selectedProjectId, setChecklistItems);
      showToast('โหลดเช็กลิสต์ตัวอย่างจากสเปกเรียบร้อย', 'success');
    } catch (err) {
      showToast('โหลดเช็กลิสต์ล้มเหลว: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Submit Add Checklist Item
  const handleSaveChecklistItem = async (e) => {
    e.preventDefault();
    if (!selectedProjectId) {
      showToast('กรุณาเลือกโปรเจกต์', 'error');
      return;
    }
    if (!checklistFormData.item_name.trim()) {
      showToast('กรุณาระบุชื่อรายการ', 'error');
      return;
    }

    setIsSaving(true);
    try {
      await saveProjectChecklistItemSync({
        ...checklistFormData,
        project_id: selectedProjectId,
        required_qty: parseFloat(checklistFormData.required_qty) || 1,
        unit_cost: parseFloat(checklistFormData.unit_cost) || 0
      });

      await loadProjectChecklistLocalFirst(selectedProjectId, setChecklistItems);
      setIsAddChecklistModalOpen(false);
      showToast('เพิ่มรายการเช็กลิสต์สำเร็จ', 'success');
    } catch (err) {
      showToast('เพิ่มรายการไม่สำเร็จ: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Submit Reconcile (รับคืนของดี + คำนวณเสียหาย)
  const handleExecuteReconciliation = async (e) => {
    e.preventDefault();
    if (!reconcileTarget) return;

    setIsSaving(true);
    try {
      const ret = Number(reconcileForm.returned_qty) || 0;
      const dam = Number(reconcileForm.damaged_qty) || 0;

      await reconcileProjectItemSync({
        projectId: selectedProjectId,
        checklistItemId: reconcileTarget.id,
        itemId: reconcileTarget.item_id,
        returnedQty: ret,
        damagedQty: dam
      });

      await loadProjectChecklistLocalFirst(selectedProjectId, setChecklistItems);
      setReconcileTarget(null);
      showToast(`รับคืนของดี ${ret} ชิ้น และตัดยอดชำรุด ${dam} ชิ้นเรียบร้อย`, 'success');
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast('คืนพัสดุล้มเหลว: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Submit Borrow Asset Units
  const handleExecuteBorrowUnits = async (e) => {
    e.preventDefault();
    if (!borrowTarget || borrowForm.selectedCodes.length === 0) {
      showToast('กรุณาเลือกอย่างน้อย 1 รหัสอุปกรณ์', 'error');
      return;
    }
    if (!borrowForm.borrowerName.trim()) {
      showToast('กรุณาระบุชื่อผู้ยืม', 'error');
      return;
    }

    setIsSaving(true);
    try {
      await borrowAssetUnitsSync({
        projectId: selectedProjectId,
        unitCodes: borrowForm.selectedCodes,
        borrowerName: borrowForm.borrowerName.trim(),
        checklistItemId: borrowTarget.id
      });

      await loadAssetUnitsLocalFirst(setAssetUnits);
      await loadProjectChecklistLocalFirst(selectedProjectId, setChecklistItems);
      setBorrowTarget(null);
      showToast(`บันทึกการยืม ${borrowForm.selectedCodes.join(', ')} เรียบร้อย`, 'success');
    } catch (err) {
      showToast('บันทึกการยืมล้มเหลว: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Return Serialized Unit back to AVAILABLE
  const handleReturnAssetUnitDirectly = async (unitCode) => {
    try {
      await returnAssetUnitsSync({ unitCodes: [unitCode] });
      await loadAssetUnitsLocalFirst(setAssetUnits);
      if (selectedProjectId) {
        await loadProjectChecklistLocalFirst(selectedProjectId, setChecklistItems);
      }
      showToast(`คืนอุปกรณ์ ${unitCode} กลับเข้าสถานะพร้อมใช้งานแล้ว`, 'success');
    } catch (err) {
      showToast('คืนอุปกรณ์ล้มเหลว: ' + err.message, 'error');
    }
  };

  // Helper Badge Colors for 5 Types
  const getItemTypeBadge = (type) => {
    const t = (type || '').toLowerCase();
    switch (t) {
      case 'asset':
        return <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/50 flex items-center gap-1 w-fit">✂️ อุปกรณ์ยืม-คืน</span>;
      case 'reusable':
      case 'reusable_material':
        return <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-pink-50 text-pink-700 border border-pink-200/50 flex items-center gap-1 w-fit">🌸 วัสดุหมุนเวียน</span>;
      case 'consumable':
        return <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200/50 flex items-center gap-1 w-fit">📦 พัสดุสิ้นเปลือง</span>;
      case 'banknote':
        return <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/50 flex items-center gap-1 w-fit">💵 ธนบัตร</span>;
      case 'task':
        return <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200/50 flex items-center gap-1 w-fit">🛠️ งานบริการ/ขั้นตอน</span>;
      default:
        return <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 w-fit">{type}</span>;
    }
  };

  const renderStatusBadge = (status, stock, threshold) => {
    if (stock <= 0) {
      return <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-100 text-rose-700">หมดสต๊อก</span>;
    }
    if (stock <= threshold) {
      return <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-700">ใกล้หมด</span>;
    }
    switch (status) {
      case 'in_service':
        return <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-700">พร้อมใช้งาน</span>;
      case 'maintenance':
        return <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-orange-100 text-orange-700">ส่งซ่อม/บำรุง</span>;
      case 'written_off':
        return <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-500 line-through">ปลดระวาง</span>;
      default:
        return <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-600">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 flex flex-col min-h-full pb-24 md:pb-6 px-4 sm:px-8 lg:px-10 pt-4">
      {/* 4 Summary Metric Cards */}
      {activeTab === 'stock' ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 no-print">
          <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500">พัสดุในคลังทั้งหมด</span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <Package className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-slate-900">{stockStats.totalItems} รายการ</p>
            <div className="mt-1 pt-1 border-t border-slate-50 text-[11px] text-slate-400">ครบ 5 ประเภทตามสเปก</div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-rose-700">พัสดุใกล้หมด / เตือนสั่ง</span>
              <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-rose-600">{stockStats.lowStockCount} รายการ</p>
            <div className="mt-1 pt-1 border-t border-slate-50 text-[11px] text-rose-600">ถึงเกณฑ์แจ้งเตือน</div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-700">พร้อมใช้งานปกติ</span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-emerald-600">{stockStats.inServiceCount} รายการ</p>
            <div className="mt-1 pt-1 border-t border-slate-50 text-[11px] text-emerald-600">สภาพสมบูรณ์พร้อมใช้</div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-indigo-700">มูลค่าพัสดุและธนบัตรรวม</span>
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-indigo-700">฿{Math.round(stockStats.totalValuation).toLocaleString()}</p>
            <div className="mt-1 pt-1 border-t border-slate-50 text-[11px] text-indigo-600">คำนวณตามต้นทุนและหน้าเงิน</div>
          </div>
        </div>
      ) : activeTab === 'checklist' ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 no-print">
          <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500">ความพร้อมเตรียมของ</span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <FileCheck2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-emerald-600">{checklistStats.percent}%</p>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-1">
              <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${checklistStats.percent}%` }} />
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-700">ธนบัตรเงินสดที่ต้องเบิก</span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <Banknote className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-emerald-800">฿{checklistStats.banknoteValue.toLocaleString()}</p>
            <div className="mt-1 pt-1 border-t border-slate-50 text-[11px] text-slate-500">{checklistStats.banknoteCount} รายการธนบัตร</div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-pink-700">วัสดุหมุนเวียน (ต้องคืน)</span>
              <div className="p-2 rounded-xl bg-pink-50 text-pink-600">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-pink-600">{checklistStats.reusableCount} รายการ</p>
            <div className="mt-1 pt-1 border-t border-slate-50 text-[11px] text-pink-600">นับคืนของดีหลังจบงาน</div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-indigo-700">อุปกรณ์ยืม-คืน (มีรหัส)</span>
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <Scissors className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-indigo-600">{checklistStats.assetCount} รายการ</p>
            <div className="mt-1 pt-1 border-t border-slate-50 text-[11px] text-indigo-600">ระบุรหัสชิ้นและช่างที่ยืม</div>
          </div>
        </div>
      ) : activeTab === 'units' ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 no-print">
          <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500">รหัสรายชิ้นทั้งหมด</span>
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <Tag className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-slate-900">{unitStats.total} ชิ้น</p>
            <div className="mt-1 pt-1 border-t border-slate-50 text-[11px] text-slate-400">item0001, item0002...</div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-700">พร้อมใช้งาน (ว่าง)</span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-emerald-600">{unitStats.available} ชิ้น</p>
            <div className="mt-1 pt-1 border-t border-slate-50 text-[11px] text-emerald-600">อยู่ในคลังพร้อมให้ยืม</div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-700">กำลังใช้งาน (ยืมออก)</span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <ArrowRightLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-amber-600">{unitStats.borrowed} ชิ้น</p>
            <div className="mt-1 pt-1 border-t border-slate-50 text-[11px] text-amber-600">ช่างถืออยู่หน้างาน</div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-rose-700">ชำรุด / สูญหาย</span>
              <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-rose-600">{unitStats.broken} ชิ้น</p>
            <div className="mt-1 pt-1 border-t border-slate-50 text-[11px] text-rose-600">รอซ่อมหรือตัดจำหน่าย</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 no-print">
          <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-700">อุปกรณ์ที่กำลังถูกยืม</span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <ArrowRightLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-amber-600">{loanStats.borrowed} รายการ</p>
            <div className="mt-1 pt-1 border-t border-slate-50 text-[11px] text-amber-600">อยู่หน้างาน / ทีมงานถืออยู่</div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-rose-700">เกินกำหนดส่งคืน</span>
              <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-rose-600">{loanStats.overdue} รายการ</p>
            <div className="mt-1 pt-1 border-t border-slate-50 text-[11px] text-rose-600">ต้องติดตามทวงคืน</div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-700">รับคืนเข้าคลังแล้ว</span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <Check className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-emerald-600">{loanStats.returned} ครั้ง</p>
            <div className="mt-1 pt-1 border-t border-slate-50 text-[11px] text-emerald-600">ประวัติการยืมในอดีต</div>
          </div>
        </div>
      )}

      {/* Tabs Navigation Toolbar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm space-y-4 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Sub-tabs (4 Tabs) */}
          <div className="flex gap-1.5 p-1 bg-slate-100 rounded-2xl w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => setActiveTab('checklist')}
              className={`py-2 px-3.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'checklist'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <ListTodo className="w-4 h-4 text-emerald-600" />
              <span>📋 เช็กลิสต์เตรียมของ & เบิก-คืน</span>
            </button>
            <button
              onClick={() => setActiveTab('stock')}
              className={`py-2 px-3.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'stock'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Package className="w-4 h-4 text-amber-500" />
              <span>📦 สต็อกพัสดุ ({inventoryItems.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('units')}
              className={`py-2 px-3.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'units'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Tag className="w-4 h-4 text-indigo-500" />
              <span>🏷️ รหัสรายชิ้นอุปกรณ์ ({assetUnits.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('loans')}
              className={`py-2 px-3.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'loans'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Wrench className="w-4 h-4 text-slate-500" />
              <span>🔄 ประวัติยืม-คืน</span>
            </button>
          </div>

          {/* Tab Actions */}
          <div className="flex items-center gap-2">
            {activeTab === 'checklist' && (
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                <span>พิมพ์ใบเตรียมของ</span>
              </button>
            )}

            {activeTab === 'checklist' && (
              <button
                type="button"
                onClick={() => setIsAddChecklistModalOpen(true)}
                className="px-3.5 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm shadow-violet-200/50 transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ เพิ่มรายการเช็ก</span>
              </button>
            )}

            {activeTab === 'stock' && (
              <button
                type="button"
                onClick={() => handleOpenItemModal()}
                className="px-3.5 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm shadow-violet-200/50 transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ เพิ่มพัสดุใหม่</span>
              </button>
            )}

            {activeTab === 'units' && (
              <button
                type="button"
                onClick={() => setIsUnitModalOpen(true)}
                className="px-3.5 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm shadow-violet-200/50 transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ สร้างรหัสรายชิ้น</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters according to active tab */}
        {activeTab === 'checklist' && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
            {/* Project Picker (Active / Quoting Only according to Spec 5.1) */}
            <div className="flex-1 max-w-xl">
              <label className="text-[11px] font-bold text-slate-500 block mb-1 flex items-center gap-1.5">
                <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>เลือกโปรเจกต์ที่ต้องเตรียมของ (เฉพาะงานที่ยังไม่เสร็จสิ้น):</span>
              </label>
              <div className="relative">
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full py-2.5 pl-3 pr-8 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none cursor-pointer"
                >
                  {activeProjects.length === 0 ? (
                    <option value="">-- ไม่พบงานที่กำลังดำเนินการ --</option>
                  ) : (
                    activeProjects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.id} — {p.name || p.artist || 'งานจัดดอกไม้'} {p.customer ? `(${p.customer})` : ''} [{p.date || p.deliveryDate || 'รอกำหนด'}]
                      </option>
                    ))
                  )}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Quick Demo Seed */}
            {checklistItems.length === 0 && (
              <button
                type="button"
                onClick={handleSeedDemoChecklist}
                className="py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer self-end"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>โหลดตัวอย่างเช็กลิสต์ตามสเปก</span>
              </button>
            )}
          </div>
        )}

        {activeTab === 'stock' && (
          <div className="space-y-3 pt-2 border-t border-slate-100">
            {/* 5-Types Pills Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
              <span className="text-xs font-bold text-slate-400 mr-1 shrink-0">หมวดหมู่:</span>
              {[
                { id: 'all', label: 'ทั้งหมด' },
                { id: 'asset', label: '✂️ อุปกรณ์ยืม-คืน (Asset)' },
                { id: 'reusable', label: '🌸 วัสดุหมุนเวียน (Reusable)' },
                { id: 'consumable', label: '📦 พัสดุสิ้นเปลือง (Consumable)' },
                { id: 'banknote', label: '💵 ธนบัตร (Banknote)' },
                { id: 'task', label: '🛠️ งานบริการ/ขั้นตอน (Task)' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedType(t.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    selectedType === t.id
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหาชื่อพัสดุ, รหัส, จุดจัดเก็บ, สี..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50 focus:bg-white transition-colors"
                />
              </div>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="text-xs sm:text-sm py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 w-full sm:w-auto"
              >
                <option value="all">ทุกสถานะความพร้อม</option>
                <option value="in_service">พร้อมใช้งานปกติ</option>
                <option value="maintenance">ส่งซ่อม / บำรุง</option>
                <option value="written_off">ปลดระวาง</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === 'units' && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหารหัสรายชิ้น เช่น item0001, ชื่ออุปกรณ์, ผู้ยืม..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white transition-colors"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
              {[
                { id: 'all', label: 'ทั้งหมด' },
                { id: 'AVAILABLE', label: '🟢 พร้อมใช้ (ว่าง)' },
                { id: 'BORROWED', label: '🟠 กำลังใช้งาน' },
                { id: 'BROKEN', label: '🔴 ชำรุด/สูญหาย' }
              ].map(s => (
                <button
                  key={s.id}
                  onClick={() => setUnitStatusFilter(s.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    unitStatusFilter === s.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PROJECT CHECKLIST & RECONCILIATION (Core Specification)           */}
      {/* ========================================================================= */}
      {activeTab === 'checklist' && (
        <div id="project-checklist" className="space-y-4">
          {/* Print-Only Header (แสดงเฉพาะเวลาสั่งพิมพ์ A4) */}
          <div className="print-only hidden p-6 text-center border-b border-slate-300">
            <h2 className="text-xl font-black">Flower2U Workshop & Warehouse Hub</h2>
            <h3 className="text-base font-bold text-slate-800 mt-1">
              ใบเตรียมอุปกรณ์และเช็กลิสต์: {currentProject?.name || currentProject?.artist || selectedProjectId}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              รหัสโปรเจกต์: {selectedProjectId} | ศิลปิน: {currentProject?.artist || '-'} | กำหนดส่ง: {currentProject?.date || currentProject?.deliveryDate || '-'}
            </p>
          </div>

          {/* Desktop Table View */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4 text-center w-12">เช็ก</th>
                    <th className="py-3.5 px-4 w-36">หมวดหมู่</th>
                    <th className="py-3.5 px-4">รายการ</th>
                    <th className="py-3.5 px-4 text-center w-28">จำนวนที่ใช้</th>
                    <th className="py-3.5 px-4">รหัสอุปกรณ์ / การเบิก-คืน / หมายเหตุ</th>
                    <th className="py-3.5 px-4 text-right no-print w-28">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {checklistItems.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-14 text-center text-slate-400 space-y-2">
                        <ListTodo className="w-10 h-10 text-slate-300 mx-auto" />
                        <p className="font-bold text-slate-600">ยังไม่มีรายการเช็กลิสต์ในโปรเจกต์นี้</p>
                        <p className="text-xs text-slate-400">กดปุ่ม "+ เพิ่มรายการเช็ก" หรือ "โหลดตัวอย่างเช็กลิสต์ตามสเปก"</p>
                      </td>
                    </tr>
                  ) : (
                    checklistItems.map((chk, index) => {
                      const isAsset = chk.item_type === 'asset' || chk.item_type === 'ASSET';
                      const isReusable = chk.item_type === 'reusable' || chk.item_type === 'REUSABLE' || chk.item_type === 'reusable_material';
                      const isBanknote = chk.item_type === 'banknote' || chk.item_type === 'BANKNOTE';
                      const isTask = chk.item_type === 'task' || chk.item_type === 'TASK';

                      return (
                        <tr
                          key={chk.id || index}
                          id={`row-${chk.id || index}`}
                          className={`transition-all hover:bg-slate-50/80 ${
                            chk.is_checked ? 'done-item' : 'bg-white'
                          }`}
                        >
                          {/* 1. Checkbox */}
                          <td className="py-3.5 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={Boolean(chk.is_checked)}
                              onChange={() => handleToggleChecklist(chk)}
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                          </td>

                          {/* 2. Category */}
                          <td className="py-3.5 px-4">
                            {getItemTypeBadge(chk.item_type)}
                          </td>

                          {/* 3. Item Name */}
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            <span className={chk.is_checked ? 'line-through text-slate-400' : ''}>
                              {chk.item_name}
                            </span>
                            {chk.unit_cost > 0 && !isBanknote && (
                              <span className="text-[11px] text-slate-400 font-normal block">
                                ต้นทุน: ฿{Number(chk.unit_cost).toLocaleString()} / {chk.unit}
                              </span>
                            )}
                          </td>

                          {/* 4. Required Qty */}
                          <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-800">
                            {chk.required_qty} {chk.unit || 'ชิ้น'}
                          </td>

                          {/* 5. Details / Asset Codes / Reconciliation */}
                          <td className="py-3.5 px-4 text-xs">
                            {isTask && (
                              <span className="text-slate-500">
                                {chk.notes || 'ติ๊กเมื่อออกแบบ / จัดทำเสร็จสิ้น'}
                              </span>
                            )}

                            {isBanknote && (
                              <div className="space-y-0.5">
                                <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md inline-block">
                                  มูลค่า: ฿{((Number(chk.required_qty) || 0) * (Number(chk.unit_cost) || 100)).toLocaleString()} บาท
                                </span>
                                <span className="text-slate-400 block text-[10px]">เบิกยอดจากตู้เซฟ</span>
                              </div>
                            )}

                            {isAsset && (
                              <div className="flex items-center gap-2 flex-wrap">
                                {chk.assigned_codes && chk.assigned_codes.length > 0 ? (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-slate-500 font-semibold">รหัสที่ยืม:</span>
                                    {chk.assigned_codes.map(c => (
                                      <span key={c} className="font-mono font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200/50">
                                        {c}
                                      </span>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() => handleReturnAssetUnitDirectly(chk.assigned_codes[0])}
                                      className="text-[10px] text-rose-500 hover:underline font-bold no-print cursor-pointer"
                                    >
                                      คืนของ
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 no-print">
                                    <span className="text-amber-600 font-medium">ยังไม่ได้เลือกรหัสชิ้น</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setBorrowTarget(chk);
                                        setBorrowForm({ selectedCodes: [], borrowerName: currentProject?.name || '' });
                                      }}
                                      className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold cursor-pointer"
                                    >
                                      + เลือกรหัสยืม
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {isReusable && (
                              <div className="space-y-1">
                                <div className="text-slate-600">
                                  <span>{chk.notes || 'เสร็จงานต้องนับคืนคลัง'}</span>
                                  {chk.returned_qty > 0 && (
                                    <span className="text-emerald-700 font-bold ml-1.5">
                                      (คืนแล้ว: {chk.returned_qty} ชิ้น)
                                    </span>
                                  )}
                                  {chk.damaged_qty > 0 && (
                                    <span className="text-rose-600 font-bold ml-1.5">
                                      (ชำรุด: {chk.damaged_qty} ชิ้น)
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReconcileTarget(chk);
                                    setReconcileForm({
                                      returned_qty: chk.required_qty,
                                      damaged_qty: 0
                                    });
                                  }}
                                  className="text-[11px] px-2 py-0.5 bg-pink-50 hover:bg-pink-100 text-pink-700 font-bold rounded-lg border border-pink-200/60 no-print cursor-pointer"
                                >
                                  🔄 คืนของ & คิดของเสียหาย
                                </button>
                              </div>
                            )}

                            {!isTask && !isBanknote && !isAsset && !isReusable && (
                              <span className="text-slate-500">
                                {chk.notes || 'เบิกแล้วตัดสต็อกทันที'}
                              </span>
                            )}
                          </td>

                          {/* 6. Action */}
                          <td className="py-3.5 px-4 text-right no-print">
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteProjectChecklistItemSync(chk.id);
                                setChecklistItems(prev => prev.filter(i => i.id !== chk.id));
                                showToast('ลบรายการเช็กลิสต์แล้ว', 'success');
                              }}
                              className="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                              title="ลบรายการ"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: STOCK INVENTORY (5 Types according to spec)                        */}
      {/* ========================================================================= */}
      {activeTab === 'stock' && (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-5">รหัสพัสดุ</th>
                    <th className="py-3.5 px-4">ชื่อพัสดุ / สเปก</th>
                    <th className="py-3.5 px-4">ประเภท (5 Types)</th>
                    <th className="py-3.5 px-4 text-center">คงเหลือในคลัง</th>
                    <th className="py-3.5 px-4 text-center">จุดเตือนสั่ง</th>
                    <th className="py-3.5 px-4 text-right">ต้นทุนเฉลี่ย / หน่วย</th>
                    <th className="py-3.5 px-4">จุดจัดเก็บ</th>
                    <th className="py-3.5 px-4">สถานะ</th>
                    <th className="py-3.5 px-5 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredStock.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="py-12 text-center text-slate-400">
                        ไม่พบพัสดุที่ค้นหา
                      </td>
                    </tr>
                  ) : (
                    filteredStock.map((item) => (
                      <tr key={item.id || item.code} className="hover:bg-slate-50/60 transition-colors group">
                        <td className="py-3.5 px-5 font-mono text-xs font-bold text-slate-500">
                          {item.code || '-'}
                        </td>

                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          <div className="group-hover:text-amber-600 transition-colors">
                            {item.name}
                          </div>
                          {(item.color || item.size) && (
                            <div className="text-xs text-slate-400 font-normal mt-0.5">
                              {item.color && <span>สี: {item.color} </span>}
                              {item.size && <span>ขนาด: {item.size}</span>}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-xs">
                          {getItemTypeBadge(item.item_type)}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {item.item_type === 'task' ? (
                            <span className="text-xs font-semibold text-slate-400">ไม่มีสต็อก (บริการ)</span>
                          ) : item.item_type === 'banknote' ? (
                            <span className="font-mono font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200/50">
                              {item.current_stock ?? 0} {item.unit || 'ใบ'}
                            </span>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200">
                              <button
                                onClick={() => handleQuickAdjustStock(item, -1)}
                                className="w-5 h-5 rounded-md bg-white text-slate-600 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center font-bold text-xs shadow-xs cursor-pointer"
                                title="ลดสต๊อก 1"
                              >
                                -
                              </button>
                              <span className="font-black text-slate-900 px-1 min-w-[28px] text-center">
                                {item.current_stock ?? 0}
                              </span>
                              <button
                                onClick={() => handleQuickAdjustStock(item, 1)}
                                className="w-5 h-5 rounded-md bg-white text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 flex items-center justify-center font-bold text-xs shadow-xs cursor-pointer"
                                title="เพิ่มสต๊อก 1"
                              >
                                +
                              </button>
                              <span className="text-xs text-slate-400 ml-0.5">{item.unit || 'ชิ้น'}</span>
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-center text-xs font-semibold text-slate-500">
                          {item.item_type === 'task' ? '-' : `${item.min_alert_threshold ?? 5} ${item.unit || 'ชิ้น'}`}
                        </td>

                        <td className="py-3.5 px-4 text-right font-black text-slate-800">
                          ฿{Number(item.average_cost || 0).toLocaleString()}
                        </td>

                        <td className="py-3.5 px-4 text-xs text-slate-600">
                          {item.storage_location ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              {item.storage_location}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {renderStatusBadge(item.status, item.current_stock, item.min_alert_threshold)}
                        </td>

                        <td className="py-3.5 px-5 text-right">
                          <button
                            onClick={() => handleOpenItemModal(item)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                            title="แก้ไขพัสดุ"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards View */}
          <div className="md:hidden space-y-3">
            {filteredStock.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl text-center text-slate-400">
                ไม่พบพัสดุที่ค้นหา
              </div>
            ) : (
              filteredStock.map((item) => (
                <div key={item.id || item.code} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-slate-400">{item.code || '-'}</span>
                      <h4 className="font-bold text-slate-900 text-sm">{item.name}</h4>
                    </div>
                    {getItemTypeBadge(item.item_type)}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-50">
                    <div>
                      <span className="text-slate-400 block text-[10px]">คงเหลือ</span>
                      <span className="font-black text-slate-800">{item.current_stock} {item.unit}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">ต้นทุน</span>
                      <span className="font-black text-slate-800">฿{Number(item.average_cost || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                    {renderStatusBadge(item.status, item.current_stock, item.min_alert_threshold)}
                    <button
                      onClick={() => handleOpenItemModal(item)}
                      className="px-3 py-1 bg-slate-100 hover:bg-amber-50 hover:text-amber-700 text-slate-700 rounded-lg text-xs font-bold"
                    >
                      แก้ไข
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ASSET UNITS (Serialized item0001, item0002...)                     */}
      {/* ========================================================================= */}
      {activeTab === 'units' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-5">รหัสชิ้น (Unit Code)</th>
                    <th className="py-3.5 px-4">ชื่ออุปกรณ์แม่</th>
                    <th className="py-3.5 px-4 text-center">สถานะ</th>
                    <th className="py-3.5 px-4">ผู้ยืม / งานปัจจุบัน</th>
                    <th className="py-3.5 px-4">วันที่ยืม</th>
                    <th className="py-3.5 px-4">หมายเหตุ</th>
                    <th className="py-3.5 px-5 text-right">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredUnits.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-slate-400 space-y-2">
                        <Tag className="w-8 h-8 text-slate-300 mx-auto" />
                        <p className="font-bold text-slate-600">ไม่พบรหัสรายชิ้น</p>
                        <p className="text-xs text-slate-400">กดปุ่ม "+ สร้างรหัสรายชิ้น" เพื่อลงทะเบียนอุปกรณ์รายชิ้น</p>
                      </td>
                    </tr>
                  ) : (
                    filteredUnits.map((unit) => {
                      const parent = inventoryItems.find(i => i.id === unit.item_id);
                      const isAvail = unit.status === 'AVAILABLE' || unit.status === 'available';
                      const isBorrowed = unit.status === 'BORROWED' || unit.status === 'borrowed';

                      return (
                        <tr key={unit.unit_code} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-5 font-mono font-black text-indigo-700">
                            {unit.unit_code}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            {parent?.name || 'อุปกรณ์ยืม-คืน'}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {isAvail ? (
                              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold inline-block">
                                🟢 พร้อมใช้งาน (ว่าง)
                              </span>
                            ) : isBorrowed ? (
                              <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold inline-block">
                                🟠 กำลังใช้งาน
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-lg text-xs font-bold inline-block">
                                🔴 {unit.status}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs font-medium text-slate-700">
                            {unit.borrowed_by ? (
                              <div className="space-y-0.5">
                                <span className="font-bold text-indigo-900 block">{unit.borrowed_by}</span>
                                {unit.project_id && <span className="text-[10px] text-slate-400">โปรเจกต์: {unit.project_id}</span>}
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-500 font-mono">
                            {unit.borrowed_at ? new Date(unit.borrowed_at).toLocaleDateString('th-TH') : '-'}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-500">
                            {unit.notes || '-'}
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            {isBorrowed ? (
                              <button
                                type="button"
                                onClick={() => handleReturnAssetUnitDirectly(unit.unit_code)}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition cursor-pointer"
                              >
                                รับคืน
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteAssetUnitSync(unit.unit_code);
                                  setAssetUnits(prev => prev.filter(u => u.unit_code !== unit.unit_code));
                                  showToast(`ลบรหัส ${unit.unit_code} แล้ว`, 'success');
                                }}
                                className="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                title="ลบรหัสนี้"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: LOANS HISTORY                                                      */}
      {/* ========================================================================= */}
      {activeTab === 'loans' && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-5">อุปกรณ์ที่ยืม</th>
                  <th className="py-3.5 px-4">ผู้ยืม</th>
                  <th className="py-3.5 px-4">โปรเจกต์</th>
                  <th className="py-3.5 px-4">เวลายืม</th>
                  <th className="py-3.5 px-4">กำหนดคืน</th>
                  <th className="py-3.5 px-4">สถานะ</th>
                  <th className="py-3.5 px-5 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredLoans.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400">
                      ไม่พบประวัติการยืม-คืน
                    </td>
                  </tr>
                ) : (
                  filteredLoans.map((loan) => (
                    <tr key={loan.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-5 font-bold text-slate-900">
                        {loan.item?.name || 'เครื่องมือ/อุปกรณ์'}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700">
                        {loan.borrower_name}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-mono text-indigo-600">
                        {loan.project_id || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500">
                        {loan.borrowed_at ? new Date(loan.borrowed_at).toLocaleDateString('th-TH') : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500">
                        {loan.expected_return_at ? new Date(loan.expected_return_at).toLocaleDateString('th-TH') : '-'}
                      </td>
                      <td className="py-3.5 px-4">
                        {loan.status === 'borrowed' ? (
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold">
                            กำลังยืม
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold">
                            คืนแล้ว
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        {loan.status === 'borrowed' && (
                          <button
                            onClick={async () => {
                              await returnAssetLoanSync(loan.id);
                              if (onRefresh) onRefresh();
                              showToast('รับคืนอุปกรณ์เรียบร้อย', 'success');
                            }}
                            className="px-3 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs rounded-lg transition"
                          >
                            รับคืน
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADD / EDIT INVENTORY ITEM (5 Types)                              */}
      {/* ========================================================================= */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md backdrop-animate-in" onClick={() => setIsItemModalOpen(false)} />
          <div className="bg-white w-full max-w-2xl sm:rounded-[2.5rem] rounded-2xl shadow-2xl relative z-10 overflow-hidden border border-slate-100 flex flex-col max-h-[92vh] modal-animate-in" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 sm:px-8 sm:py-5 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-20 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 sm:p-3 bg-amber-50 text-amber-600 rounded-xl sm:rounded-2xl shrink-0">
                  <Package className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                    {editingItem ? 'แก้ไขข้อมูลพัสดุ' : 'เพิ่มพัสดุใหม่เข้าคลัง'}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">
                    รองรับ 5 ประเภทรายการตามสเปกระบบคลังและเช็กลิสต์
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setIsItemModalOpen(false)} className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition cursor-pointer">
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 sm:p-8 custom-scrollbar space-y-4">
                {/* 5-Types Selector with visual cards */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    เลือกประเภทรายการ (5 Item Types) *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { id: 'asset', label: '1. อุปกรณ์ยืม-คืน (Asset)', desc: 'นับแยกรายชิ้น มีรหัส (item0001) ต้นทุน 0 บาท' },
                      { id: 'reusable', label: '2. วัสดุหมุนเวียน (Reusable)', desc: 'นับจำนวนรวม คืนของดี คิดต้นทุนเฉพาะส่วนเสียหาย' },
                      { id: 'consumable', label: '3. พัสดุสิ้นเปลือง (Consumable)', desc: 'นับจำนวนรวม เบิกแล้วตัดสต็อกทันที' },
                      { id: 'banknote', label: '4. ธนบัตร (Banknote)', desc: 'นับจำนวนใบ คิดมูลค่าตามหน้าเงินจริง' },
                      { id: 'task', label: '5. งานบริการ/ขั้นตอน (Task)', desc: 'ไม่มีสต็อก ใช้แสดงในใบเสนอราคาและเช็กลิสต์' }
                    ].map(t => (
                      <div
                        key={t.id}
                        onClick={() => setItemFormData({ ...itemFormData, item_type: t.id })}
                        className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                          itemFormData.item_type === t.id
                            ? 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-400/20'
                            : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className="text-xs font-bold text-slate-900 block">{t.label}</span>
                        <span className="text-[11px] text-slate-500 block mt-0.5">{t.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">รหัสพัสดุ (SKU / Code)</label>
                    <input
                      type="text"
                      value={itemFormData.code}
                      onChange={(e) => setItemFormData({ ...itemFormData, code: e.target.value })}
                      placeholder="เช่น item0001, TLP-WHT"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">ชื่อพัสดุ / รายการ *</label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น กรรไกรตัดผ้า, ธนบัตร 100 บาท"
                      value={itemFormData.name}
                      onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                {itemFormData.item_type !== 'task' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">จำนวนสต็อกคงเหลือ</label>
                      <input
                        type="number"
                        min="0"
                        value={itemFormData.current_stock}
                        onChange={(e) => setItemFormData({ ...itemFormData, current_stock: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-black font-mono text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">หน่วยนับ</label>
                      <input
                        type="text"
                        placeholder="ชิ้น / อัน / ใบ / ม้วน"
                        value={itemFormData.unit}
                        onChange={(e) => setItemFormData({ ...itemFormData, unit: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {itemFormData.item_type === 'banknote' ? 'มูลค่าหน้าธนบัตร (฿)' : 'ต้นทุนต่อหน่วย (฿)'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={itemFormData.average_cost}
                        onChange={(e) => setItemFormData({ ...itemFormData, average_cost: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-black font-mono text-slate-800"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">ตำแหน่งจัดเก็บ (Shelf / Bin)</label>
                    <input
                      type="text"
                      placeholder="เช่น ชั้นวาง C2, ตู้เซฟ, กล่องเครื่องมือ"
                      value={itemFormData.storage_location}
                      onChange={(e) => setItemFormData({ ...itemFormData, storage_location: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">สถานะความพร้อม</label>
                    <select
                      value={itemFormData.status}
                      onChange={(e) => setItemFormData({ ...itemFormData, status: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold"
                    >
                      <option value="in_service">พร้อมใช้งานปกติ</option>
                      <option value="maintenance">ส่งซ่อม / บำรุงรักษา</option>
                      <option value="written_off">ปลดระวาง</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="px-5 py-4 sm:px-8 sm:py-5 border-t border-slate-100 bg-white sticky bottom-0 z-20 flex justify-end gap-2.5">
                <button type="button" onClick={() => setIsItemModalOpen(false)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer">
                  ยกเลิก
                </button>
                <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-md shadow-amber-200 cursor-pointer">
                  {isSaving ? 'กำลังบันทึก...' : 'บันทึกพัสดุ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADD SERIALIZED ASSET UNIT (item0001, item0002...)                */}
      {/* ========================================================================= */}
      {isUnitModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md backdrop-animate-in" onClick={() => setIsUnitModalOpen(false)} />
          <div className="bg-white w-full max-w-lg sm:rounded-[2.5rem] rounded-2xl shadow-2xl relative z-10 overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] modal-animate-in" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 sm:px-8 sm:py-5 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-20 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 sm:p-3 bg-indigo-50 text-indigo-600 rounded-xl sm:rounded-2xl shrink-0">
                  <Tag className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">สร้างรหัสรายชิ้นอุปกรณ์ (Asset Units)</h3>
                  <p className="text-xs text-slate-500 font-medium">กำกับรหัส เช่น item0001 สำหรับติดตามการยืม-คืน</p>
                </div>
              </div>
              <button type="button" onClick={() => setIsUnitModalOpen(false)} className="p-2 hover:bg-slate-100 text-slate-400 rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUnit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 sm:p-8 space-y-4 overflow-y-auto">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">เลือกอุปกรณ์แม่ (เฉพาะประเภท Asset) *</label>
                  <select
                    required
                    value={unitFormData.item_id}
                    onChange={(e) => setUnitFormData({ ...unitFormData, item_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800"
                  >
                    <option value="">-- เลือกอุปกรณ์ --</option>
                    {inventoryItems.filter(i => i.item_type === 'asset' || i.item_type === 'ASSET' || i.item_type === 'tool').map(i => (
                      <option key={i.id} value={i.id}>{i.name} ({i.code || '-'})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">รหัสเริ่มต้น (Unit Code)</label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น item0001, SCIS-01"
                      value={unitFormData.unit_code}
                      onChange={(e) => setUnitFormData({ ...unitFormData, unit_code: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">สร้างต่อเนื่อง (จำนวนชิ้น)</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={unitFormData.batch_count}
                      onChange={(e) => setUnitFormData({ ...unitFormData, batch_count: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono font-bold text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">หมายเหตุประจำชิ้น</label>
                  <input
                    type="text"
                    placeholder="เช่น ด้ามสีน้ำเงิน, แท่นตัดเบอร์ 2"
                    value={unitFormData.notes}
                    onChange={(e) => setUnitFormData({ ...unitFormData, notes: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div className="px-5 py-4 sm:px-8 sm:py-5 border-t border-slate-100 flex justify-end gap-2.5">
                <button type="button" onClick={() => setIsUnitModalOpen(false)} className="px-5 py-2.5 bg-slate-100 rounded-xl text-xs font-bold">ยกเลิก</button>
                <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200">
                  {isSaving ? 'กำลังบันทึก...' : 'บันทึกรหัสรายชิ้น'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ADD CHECKLIST ITEM TO PROJECT                                    */}
      {/* ========================================================================= */}
      {isAddChecklistModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md backdrop-animate-in" onClick={() => setIsAddChecklistModalOpen(false)} />
          <div className="bg-white w-full max-w-lg sm:rounded-[2.5rem] rounded-2xl shadow-2xl relative z-10 overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] modal-animate-in" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 sm:px-8 sm:py-5 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-20 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 sm:p-3 bg-emerald-50 text-emerald-600 rounded-xl sm:rounded-2xl shrink-0">
                  <ListTodo className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">เพิ่มรายการในเช็กลิสต์เตรียมของ</h3>
                  <p className="text-xs text-slate-500 font-medium">โปรเจกต์: {selectedProjectId}</p>
                </div>
              </div>
              <button type="button" onClick={() => setIsAddChecklistModalOpen(false)} className="p-2 hover:bg-slate-100 text-slate-400 rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveChecklistItem} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 sm:p-8 space-y-4 overflow-y-auto">
                {/* Mode Select */}
                <div className="flex p-1 bg-slate-100 rounded-xl gap-1">
                  <button
                    type="button"
                    onClick={() => setChecklistFormData({ ...checklistFormData, mode: 'inventory' })}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${checklistFormData.mode === 'inventory' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}
                  >
                    📦 เลือกจากคลังพัสดุ
                  </button>
                  <button
                    type="button"
                    onClick={() => setChecklistFormData({ ...checklistFormData, mode: 'custom_task', item_type: 'task', category_name: 'งานบริการ' })}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${checklistFormData.mode === 'custom_task' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'}`}
                  >
                    🛠️ สร้างขั้นตอนงานเอง
                  </button>
                </div>

                {checklistFormData.mode === 'inventory' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">เลือกวัสดุ/อุปกรณ์จากคลัง *</label>
                    <select
                      required
                      value={checklistFormData.item_id}
                      onChange={(e) => {
                        const itm = inventoryItems.find(i => i.id === e.target.value);
                        if (itm) {
                          setChecklistFormData({
                            ...checklistFormData,
                            item_id: itm.id,
                            item_name: itm.name,
                            item_type: itm.item_type,
                            category_name: itm.item_type === 'asset' ? 'อุปกรณ์ยืม-คืน' : itm.item_type === 'reusable' ? 'วัสดุหมุนเวียน' : itm.item_type === 'banknote' ? 'ธนบัตร' : itm.item_type === 'task' ? 'งานบริการ' : 'พัสดุสิ้นเปลือง',
                            unit: itm.unit || 'ชิ้น',
                            unit_cost: itm.average_cost || 0
                          });
                        }
                      }}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800"
                    >
                      <option value="">-- เลือกรายการจากคลัง --</option>
                      {inventoryItems.map(i => (
                        <option key={i.id} value={i.id}>
                          [{i.item_type}] {i.name} (คงเหลือ: {i.current_stock} {i.unit})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">ชื่องานบริการ / ขั้นตอนการทำงาน *</label>
                    <input
                      type="text"
                      required
                      placeholder="เช่น ออกแบบช่อดอกไม้, ปริ้นท์ป้ายหน้างาน"
                      value={checklistFormData.item_name}
                      onChange={(e) => setChecklistFormData({ ...checklistFormData, item_name: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">จำนวนที่ใช้ *</label>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      required
                      value={checklistFormData.required_qty}
                      onChange={(e) => setChecklistFormData({ ...checklistFormData, required_qty: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-black font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">หน่วยนับ</label>
                    <input
                      type="text"
                      value={checklistFormData.unit}
                      onChange={(e) => setChecklistFormData({ ...checklistFormData, unit: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">หมายเหตุ / คำแนะนำการเตรียมของ</label>
                  <input
                    type="text"
                    placeholder="เช่น เสร็จงานต้องนับคืนคลัง, ติ๊กเมื่อจัดเสร็จ"
                    value={checklistFormData.notes}
                    onChange={(e) => setChecklistFormData({ ...checklistFormData, notes: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div className="px-5 py-4 sm:px-8 sm:py-5 border-t border-slate-100 flex justify-end gap-2.5">
                <button type="button" onClick={() => setIsAddChecklistModalOpen(false)} className="px-5 py-2.5 bg-slate-100 rounded-xl text-xs font-bold">ยกเลิก</button>
                <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-200">
                  {isSaving ? 'กำลังบันทึก...' : 'เพิ่มรายการ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: RECONCILIATION (รับคืนวัสดุหมุนเวียน & คิดของเสียหาย)              */}
      {/* ========================================================================= */}
      {reconcileTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md backdrop-animate-in" onClick={() => setReconcileTarget(null)} />
          <div className="bg-white w-full max-w-lg sm:rounded-[2.5rem] rounded-2xl shadow-2xl relative z-10 overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] modal-animate-in" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 sm:px-8 sm:py-5 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-20 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 sm:p-3 bg-pink-50 text-pink-600 rounded-xl sm:rounded-2xl shrink-0">
                  <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">รับคืนวัสดุหมุนเวียน & คิดของเสียหาย</h3>
                  <p className="text-xs text-slate-500 font-medium">{reconcileTarget.item_name}</p>
                </div>
              </div>
              <button type="button" onClick={() => setReconcileTarget(null)} className="p-2 hover:bg-slate-100 text-slate-400 rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteReconciliation} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 sm:p-8 space-y-4 overflow-y-auto">
                <div className="p-4 bg-pink-50/50 rounded-2xl border border-pink-100 text-xs space-y-1">
                  <div className="flex justify-between text-slate-600">
                    <span>จำนวนที่เบิกไปใช้งาน:</span>
                    <strong className="font-mono text-slate-900">{reconcileTarget.required_qty} {reconcileTarget.unit}</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>ราคาต้นทุนต่อหน่วย:</span>
                    <strong className="font-mono text-slate-900">฿{Number(reconcileTarget.unit_cost || 0).toLocaleString()}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">จำนวนของดีที่คืนสต็อก (ชิ้น) *</label>
                    <input
                      type="number"
                      min="0"
                      max={reconcileTarget.required_qty}
                      required
                      value={reconcileForm.returned_qty}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        const dam = Math.max(0, reconcileTarget.required_qty - val);
                        setReconcileForm({ returned_qty: val, damaged_qty: dam });
                      }}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-black font-mono text-emerald-700 text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">ของชำรุดเสียหาย (ชิ้น)</label>
                    <input
                      type="number"
                      min="0"
                      value={reconcileForm.damaged_qty}
                      onChange={(e) => setReconcileForm({ ...reconcileForm, damaged_qty: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-black font-mono text-rose-600 text-center"
                    />
                  </div>
                </div>

                {/* Damage cost calculation */}
                <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200/60 text-xs flex justify-between items-center">
                  <span className="font-bold text-amber-900">ต้นทุนความเสียหายที่คิดเข้าโปรเจกต์:</span>
                  <span className="font-mono font-black text-rose-600 text-base">
                    ฿{Math.round(reconcileForm.damaged_qty * (reconcileTarget.unit_cost || 0)).toLocaleString()} บาท
                  </span>
                </div>
              </div>

              <div className="px-5 py-4 sm:px-8 sm:py-5 border-t border-slate-100 flex justify-end gap-2.5">
                <button type="button" onClick={() => setReconcileTarget(null)} className="px-5 py-2.5 bg-slate-100 rounded-xl text-xs font-bold">ยกเลิก</button>
                <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-bold shadow-md shadow-pink-200">
                  {isSaving ? 'กำลังบันทึก...' : 'บันทึกการรับคืน & ตัดยอด'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: BORROW ASSET UNITS (เลือกรหัสชิ้น item0001 สำหรับยืม)             */}
      {/* ========================================================================= */}
      {borrowTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md backdrop-animate-in" onClick={() => setBorrowTarget(null)} />
          <div className="bg-white w-full max-w-lg sm:rounded-[2.5rem] rounded-2xl shadow-2xl relative z-10 overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] modal-animate-in" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 sm:px-8 sm:py-5 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-20 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 sm:p-3 bg-indigo-50 text-indigo-600 rounded-xl sm:rounded-2xl shrink-0">
                  <Scissors className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">เลือกรหัสอุปกรณ์รายชิ้นที่ยืม</h3>
                  <p className="text-xs text-slate-500 font-medium">{borrowTarget.item_name}</p>
                </div>
              </div>
              <button type="button" onClick={() => setBorrowTarget(null)} className="p-2 hover:bg-slate-100 text-slate-400 rounded-xl">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteBorrowUnits} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 sm:p-8 space-y-4 overflow-y-auto">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ชื่อช่าง / ผู้ยืมอุปกรณ์ *</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น ช่างสมชาย, นาย A"
                    value={borrowForm.borrowerName}
                    onChange={(e) => setBorrowForm({ ...borrowForm, borrowerName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    เลือกรหัสรายชิ้นที่ว่างอยู่ (สถานะ AVAILABLE) *
                  </label>
                  <div className="max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 custom-scrollbar">
                    {assetUnits.filter(u => u.status === 'AVAILABLE' || u.status === 'available').length === 0 ? (
                      <p className="text-xs text-slate-400 p-3 text-center">ไม่มีรหัสชิ้นว่างอยู่ในขณะนี้</p>
                    ) : (
                      assetUnits.filter(u => u.status === 'AVAILABLE' || u.status === 'available').map(u => (
                        <label key={u.unit_code} className="flex items-center gap-2.5 p-2 bg-white rounded-xl border border-slate-200/80 cursor-pointer hover:bg-indigo-50/50">
                          <input
                            type="checkbox"
                            checked={borrowForm.selectedCodes.includes(u.unit_code)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setBorrowForm({ ...borrowForm, selectedCodes: [...borrowForm.selectedCodes, u.unit_code] });
                              } else {
                                setBorrowForm({ ...borrowForm, selectedCodes: borrowForm.selectedCodes.filter(c => c !== u.unit_code) });
                              }
                            }}
                            className="w-4 h-4 rounded text-indigo-600"
                          />
                          <span className="font-mono font-bold text-xs text-indigo-900">{u.unit_code}</span>
                          <span className="text-xs text-slate-500">{u.notes || 'อุปกรณ์พร้อมใช้งาน'}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="px-5 py-4 sm:px-8 sm:py-5 border-t border-slate-100 flex justify-end gap-2.5">
                <button type="button" onClick={() => setBorrowTarget(null)} className="px-5 py-2.5 bg-slate-100 rounded-xl text-xs font-bold">ยกเลิก</button>
                <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200">
                  {isSaving ? 'กำลังบันทึก...' : 'บันทึกการยืม & ขีดฆ่าเช็กลิสต์'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Toast */}
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ show: false, message: '', type: 'success' })}
        />
      )}
    </div>
  );
}

export default InventoryView;
