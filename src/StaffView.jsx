import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  UserCheck,
  UserPlus,
  ShieldCheck,
  Truck,
  Sparkles,
  Wallet,
  Search,
  Phone,
  Mail,
  Key,
  Edit,
  Trash2,
  X,
  Check,
  Eye,
  Calendar,
  AlertCircle,
  Copy,
  EyeOff,
  Briefcase,
  Lock,
  Camera,
  CheckCircle2,
  XCircle,
  ExternalLink,
  RotateCcw,
  Filter,
  Cloud,
  Loader2
} from 'lucide-react';
import { loadStaffLocalFirst, saveStaffSync, deleteStaffSync, syncAllStaffToSupabaseAuth } from './services/syncService';
import Toast from './components/common/Toast';
import ConfirmDialog from './components/common/ConfirmDialog';
import ModernDateTimePicker from './components/common/ModernDateTimePicker';
import { formatDate } from './utils/formatters';

const ROLE_DEFINITIONS = [
  {
    name: 'admin',
    code: '11',
    label: 'ผู้ดูแลระบบ',
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    badge: 'bg-indigo-600 text-white',
    desc: 'สิทธิ์สูงสุด เข้าถึงข้อมูลการเงิน จัดการร้าน และแก้ไขระบบทั้งหมด'
  },
  {
    name: 'technician',
    code: '21',
    label: 'ช่างจัดดอกไม้',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    badge: 'bg-emerald-600 text-white',
    desc: 'จัดทำดอกไม้ ดูคิวงาน สเปกจัดฉาก และจัดการสต็อกดอกไม้'
  },
  {
    name: 'driver',
    code: '31',
    label: 'พนักงานจัดส่ง',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    badge: 'bg-amber-600 text-white',
    desc: 'ขนส่ง ติดตั้งหน้างาน นำทางจุดโหลดของ (Loading Dock) และส่งมอบงาน'
  },
  {
    name: 'accountant',
    code: '41',
    label: 'ฝ่ายบัญชีและการเงิน',
    color: 'bg-sky-50 text-sky-700 border-sky-200',
    badge: 'bg-sky-600 text-white',
    desc: 'ตรวจสอบสลิป ค่าใช้จ่าย สรุปงบกำไรขาดทุน และออกเอกสารใบเสนอราคา'
  }
];

function StaffView({
  activities = [],
  isCreateOpen = false,
  onCloseCreate,
  onRefresh
}) {
  const [staffList, setStaffList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [copiedCode, setCopiedCode] = useState(null);
  const [isSyncingAuth, setIsSyncingAuth] = useState(false);

  // Dynamic Custom Roles from Settings / LocalStorage / Supabase
  const [customRoles, setCustomRoles] = useState(() => {
    try {
      const saved = localStorage.getItem('f2u_role_permissions');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });

  useEffect(() => {
    const handlePermissionsUpdated = (e) => {
      if (e.detail) setCustomRoles(e.detail);
    };
    window.addEventListener('f2u_permissions_updated', handlePermissionsUpdated);
    return () => window.removeEventListener('f2u_permissions_updated', handlePermissionsUpdated);
  }, []);

  const activeRoleDefinitions = useMemo(() => {
    if (!customRoles) return ROLE_DEFINITIONS;
    const merged = [...ROLE_DEFINITIONS];
    Object.entries(customRoles).forEach(([roleKey, roleData]) => {
      const existingIndex = merged.findIndex(r => r.name === roleKey);
      if (existingIndex >= 0) {
        merged[existingIndex] = {
          ...merged[existingIndex],
          label: roleData.label || merged[existingIndex].label,
          code: roleData.code || merged[existingIndex].code,
          desc: roleData.description || merged[existingIndex].desc
        };
      } else {
        merged.push({
          name: roleKey,
          code: roleData.code || '51',
          label: roleData.label || roleKey,
          color: 'bg-purple-50 text-purple-700 border-purple-200',
          badge: 'bg-purple-600 text-white',
          desc: roleData.description || 'บทบาทที่กำหนดขึ้นเอง'
        });
      }
    });
    return merged;
  }, [customRoles]);

  // Edit / Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    staff_code: '',
    name: '',
    nickname: '',
    role: 'technician',
    phone: '',
    email: '',
    citizen_id: '',
    birth_date: '',
    address: '',
    emergency_contact: '',
    avatar_url: '',
    is_active: true
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, staff: null });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

  // Detail Modal State
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Initial Load
  useEffect(() => {
    loadStaffLocalFirst((staff) => {
      if (Array.isArray(staff) && staff.length > 0) {
        setStaffList(staff);
      }
    });
  }, []);

  // Listen to single header button trigger from App.jsx
  useEffect(() => {
    if (isCreateOpen) {
      handleOpenCreateModal();
      if (onCloseCreate) onCloseCreate();
    }
  }, [isCreateOpen]);

  // Keyboard shortcut: close modals on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isModalOpen) setIsModalOpen(false);
        if (isDetailModalOpen) setIsDetailModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, isDetailModalOpen]);

  // Helper to generate staff code automatically
  const generateSuggestedStaffCode = (roleName) => {
    const yearStr = String(new Date().getFullYear()).slice(-2); // e.g. '26'
    const roleDef = activeRoleDefinitions.find(r => r.name === roleName) || activeRoleDefinitions[1] || { code: '21' };
    const roleCode = roleDef.code;

    // Find highest sequence of this year
    let maxSeq = 0;
    staffList.forEach(s => {
      const code = s.id || s.staff_code || '';
      if (code.length >= 7 && code.startsWith(yearStr)) {
        const seq = parseInt(code.slice(4), 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    });

    const nextSeq = String(maxSeq + 1).padStart(3, '0');
    return `${yearStr}${roleCode}${nextSeq}`;
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    const defaultRole = 'technician';
    const suggestedCode = generateSuggestedStaffCode(defaultRole);

    setEditingStaffId(null);
    setFormData({
      username: '',
      password: '',
      confirmPassword: '',
      staff_code: suggestedCode,
      name: '',
      nickname: '',
      role: defaultRole,
      phone: '',
      email: '',
      citizen_id: '',
      birth_date: '',
      address: '',
      emergency_contact: '',
      avatar_url: '',
      is_active: true
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (staff) => {
    const staffId = staff.id || staff.staff_code || staff.username;
    setEditingStaffId(staffId);
    setFormData({
      username: staff.username || '',
      password: staff.password || '',
      confirmPassword: staff.password || '',
      staff_code: staff.id || staff.staff_code || '',
      name: staff.name || '',
      nickname: staff.nickname || '',
      role: staff.role || 'technician',
      phone: staff.phone || '',
      email: staff.email || '',
      citizen_id: staff.citizen_id || '',
      birth_date: staff.birth_date || '',
      address: staff.address || '',
      emergency_contact: staff.emergency_contact || '',
      avatar_url: staff.avatar_url || staff.image || '',
      is_active: staff.is_active !== undefined ? staff.is_active : true
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
    setIsModalOpen(true);
  };

  // Change Role and update suggested staff code if user hasn't typed custom code
  const handleRoleChange = (newRole) => {
    const isDefaultFormat = !formData.staff_code || /^\d{7,8}$/.test(formData.staff_code);
    if (isDefaultFormat && !editingStaffId) {
      setFormData(prev => ({
        ...prev,
        role: newRole,
        staff_code: generateSuggestedStaffCode(newRole)
      }));
    } else {
      setFormData(prev => ({ ...prev, role: newRole }));
    }
  };

  // Save Staff
  const handleSaveStaff = async (e) => {
    if (e) e.preventDefault();
    if (!formData.username.trim()) {
      showToast('กรุณาระบุชื่อผู้ใช้ (Username)', 'error');
      return;
    }
    if (!formData.password.trim()) {
      showToast('กรุณาระบุรหัสผ่าน', 'error');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      showToast('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง', 'error');
      return;
    }

    // Check duplicate username on create
    if (!editingStaffId) {
      const exists = staffList.some(
        s => s.username.toLowerCase() === formData.username.trim().toLowerCase()
      );
      if (exists) {
        showToast(`ชื่อผู้ใช้ "${formData.username}" มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น`, 'error');
        return;
      }
    }

    setIsSaving(true);
    try {
      const roleDef = activeRoleDefinitions.find(r => r.name === formData.role) || activeRoleDefinitions[1] || { code: '21', label: 'พนักงาน' };
      const finalStaffCode = formData.staff_code.trim() || generateSuggestedStaffCode(formData.role);
      const payload = {
        id: editingStaffId || finalStaffCode, // ID IS THE STAFF CODE DIRECTLY
        username: formData.username.trim(),
        password: formData.password.trim(),
        staff_code: finalStaffCode,
        name: formData.name.trim() || formData.username.trim(),
        nickname: formData.nickname.trim(),
        role: formData.role,
        role_code: roleDef.code,
        role_label: roleDef.label,
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        citizen_id: (formData.citizen_id || '').trim(),
        birth_date: formData.birth_date || null,
        address: (formData.address || '').trim(),
        emergency_contact: (formData.emergency_contact || '').trim(),
        avatar_url: formData.avatar_url.trim(),
        is_active: formData.is_active
      };

      const saved = await saveStaffSync(payload);

      setStaffList(prev => {
        const idx = prev.findIndex(s => s.id === saved.id || s.username === saved.username);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [saved, ...prev];
      });

      setIsModalOpen(false);
      showToast('บันทึกข้อมูลพนักงานเรียบร้อย', 'success');
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast('บันทึกข้อมูลพนักงานไม่สำเร็จ: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Trigger Delete Confirmation Modal
  const promptDeleteStaff = (staff) => {
    if (staffList.length <= 1) {
      showToast('ไม่สามารถลบพนักงานคนสุดท้ายของร้านได้', 'error');
      return;
    }
    setDeleteConfirm({
      isOpen: true,
      staff
    });
  };

  // Confirmed Delete Staff
  const handleConfirmDeleteStaff = async () => {
    if (!deleteConfirm.staff) return;
    const staff = deleteConfirm.staff;

    try {
      await deleteStaffSync(staff.id, staff.username);
      setStaffList(prev => prev.filter(s => s.id !== staff.id && s.username !== staff.username));
      if (selectedStaff && (selectedStaff.id === staff.id || selectedStaff.username === staff.username)) {
        setIsDetailModalOpen(false);
      }
      setDeleteConfirm({ isOpen: false, staff: null });
      showToast('ลบพนักงานออกจากระบบเรียบร้อย', 'success');
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast('ลบไม่สำเร็จ: ' + err.message, 'error');
    }
  };

  // Toggle Active Status
  const handleToggleActive = async (staff) => {
    const updated = {
      ...staff,
      is_active: !staff.is_active
    };
    try {
      await saveStaffSync(updated);
      setStaffList(prev => prev.map(s => (s.id === staff.id || s.username === staff.username ? updated : s)));
      showToast(updated.is_active ? `เปิดการใช้งานพนักงาน ${staff.name || staff.username}` : `พักการทำงานพนักงาน ${staff.name || staff.username}`, 'success');
    } catch (err) {
      showToast('ปรับสถานะไม่สำเร็จ: ' + err.message, 'error');
    }
  };

  // Copy Staff Code
  const handleCopyCode = (code) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Batch Sync all staff accounts to Supabase Auth
  const handleSyncAllAuth = async () => {
    if (isSyncingAuth) return;
    setIsSyncingAuth(true);
    try {
      const res = await syncAllStaffToSupabaseAuth(staffList);
      if (res.errors && res.errors.length > 0) {
        showToast(`ซิงก์เรียบร้อย: ใหม่ ${res.synced} บัญชี, มีอยู่แล้ว ${res.existing} บัญชี (ติดขัด ${res.errors.length})`, 'warning');
      } else {
        showToast(`ซิงก์ระบบบัญชีพนักงานสำเร็จ: เพิ่มใหม่ ${res.synced} บัญชี (มีอยู่แล้ว ${res.existing} บัญชี)`, 'success');
      }
    } catch (err) {
      showToast('เกิดข้อผิดพลาดในการซิงก์บัญชีพนักงาน: ' + (err.message || 'ไม่ทราบสาเหตุ'), 'error');
    } finally {
      setIsSyncingAuth(false);
    }
  };

  // Stats Counters
  const stats = useMemo(() => {
    const total = staffList.length;
    const admins = staffList.filter(s => s.role === 'admin').length;
    const technicians = staffList.filter(s => s.role === 'technician').length;
    const drivers = staffList.filter(s => s.role === 'driver').length;
    const accountants = staffList.filter(s => s.role === 'accountant').length;
    const active = staffList.filter(s => s.is_active !== false).length;
    const inactive = staffList.filter(s => s.is_active === false).length;
    return { total, admins, technicians, drivers, accountants, active, inactive };
  }, [staffList]);

  // Filtered Staff
  const filteredStaff = useMemo(() => {
    return staffList.filter(staff => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q ||
        (staff.name && staff.name.toLowerCase().includes(q)) ||
        (staff.nickname && staff.nickname.toLowerCase().includes(q)) ||
        (staff.username && staff.username.toLowerCase().includes(q)) ||
        (staff.id && staff.id.toLowerCase().includes(q)) ||
        (staff.staff_code && staff.staff_code.toLowerCase().includes(q)) ||
        (staff.phone && staff.phone.includes(q)) ||
        (staff.email && staff.email.toLowerCase().includes(q));

      const matchRole = roleFilter === 'all' || staff.role === roleFilter;

      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && staff.is_active !== false) ||
        (statusFilter === 'inactive' && staff.is_active === false);

      return matchSearch && matchRole && matchStatus;
    }).sort((a, b) => {
      // Sort by staff_code descending (latest staff first)
      const codeA = a.id || a.staff_code || '';
      const codeB = b.id || b.staff_code || '';
      return codeB.localeCompare(codeA, undefined, { numeric: true });
    });
  }, [staffList, searchQuery, roleFilter, statusFilter]);

  // Find role label and badge style
  const getRoleInfo = (roleName) => {
    return activeRoleDefinitions.find(r => r.name === roleName) || {
      name: roleName,
      code: '99',
      label: roleName || 'พนักงาน',
      color: 'bg-slate-50 text-slate-700 border-slate-200',
      badge: 'bg-slate-600 text-white',
      desc: 'พนักงานทั่วไปในระบบ'
    };
  };

  return (
    <div className="space-y-6 pb-24 md:pb-12 animate-fadeIn max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-4">
      {/* 1. Header KPI Cards (Interactive Quick Filters) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* Total Staff */}
        <div
          onClick={() => { setRoleFilter('all'); setStatusFilter('all'); }}
          className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center justify-between select-none ${
            roleFilter === 'all' && statusFilter === 'all'
              ? 'bg-indigo-50/60 border-indigo-300 ring-2 ring-indigo-500/30 shadow-md scale-[1.01]'
              : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-sm'
          }`}
          title="คลิกเพื่อดูพนักงานทั้งหมด"
        >
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-xl shrink-0 transition-colors ${
              roleFilter === 'all' && statusFilter === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-indigo-50 text-indigo-600'
            }`}>
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500 block">พนักงานทั้งหมด</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl sm:text-2xl font-black text-slate-900">{stats.total}</span>
                <span className="text-xs text-slate-400">ท่าน</span>
              </div>
              <span className="text-[11px] text-emerald-600 font-bold block mt-0.5">
                พร้อมงาน {stats.active}/{stats.total}
              </span>
            </div>
          </div>
          {roleFilter === 'all' && statusFilter === 'all' && (
            <div className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 self-start mt-1"></div>
          )}
        </div>

        {/* Admins */}
        <div
          onClick={() => setRoleFilter(roleFilter === 'admin' ? 'all' : 'admin')}
          className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center justify-between select-none ${
            roleFilter === 'admin'
              ? 'bg-purple-50/60 border-purple-300 ring-2 ring-purple-500/30 shadow-md scale-[1.01]'
              : 'bg-white border-slate-100 hover:border-purple-200 hover:shadow-sm'
          }`}
          title="คลิกเพื่อกรองเฉพาะผู้ดูแลระบบ"
        >
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-xl shrink-0 transition-colors ${
              roleFilter === 'admin' ? 'bg-purple-600 text-white shadow-sm' : 'bg-purple-50 text-purple-600'
            }`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500 block">ผู้ดูแลระบบ</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl sm:text-2xl font-black text-purple-900">{stats.admins}</span>
                <span className="text-xs text-slate-400">ท่าน</span>
              </div>
              <span className="text-[11px] text-purple-600 font-bold block mt-0.5">
                รหัส 11
              </span>
            </div>
          </div>
          {roleFilter === 'admin' && (
            <div className="w-2 h-2 rounded-full bg-purple-600 shrink-0 self-start mt-1"></div>
          )}
        </div>

        {/* Technicians */}
        <div
          onClick={() => setRoleFilter(roleFilter === 'technician' ? 'all' : 'technician')}
          className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center justify-between select-none ${
            roleFilter === 'technician'
              ? 'bg-emerald-50/60 border-emerald-300 ring-2 ring-emerald-500/30 shadow-md scale-[1.01]'
              : 'bg-white border-slate-100 hover:border-emerald-200 hover:shadow-sm'
          }`}
          title="คลิกเพื่อกรองเฉพาะช่างจัดดอกไม้"
        >
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-xl shrink-0 transition-colors ${
              roleFilter === 'technician' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-emerald-50 text-emerald-600'
            }`}>
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500 block">ช่างจัดดอกไม้</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl sm:text-2xl font-black text-emerald-900">{stats.technicians}</span>
                <span className="text-xs text-slate-400">ท่าน</span>
              </div>
              <span className="text-[11px] text-emerald-600 font-bold block mt-0.5">
                รหัส 21
              </span>
            </div>
          </div>
          {roleFilter === 'technician' && (
            <div className="w-2 h-2 rounded-full bg-emerald-600 shrink-0 self-start mt-1"></div>
          )}
        </div>

        {/* Drivers */}
        <div
          onClick={() => setRoleFilter(roleFilter === 'driver' ? 'all' : 'driver')}
          className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center justify-between select-none ${
            roleFilter === 'driver'
              ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-500/30 shadow-md scale-[1.01]'
              : 'bg-white border-slate-100 hover:border-amber-200 hover:shadow-sm'
          }`}
          title="คลิกเพื่อกรองเฉพาะทีมจัดส่ง"
        >
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-xl shrink-0 transition-colors ${
              roleFilter === 'driver' ? 'bg-amber-600 text-white shadow-sm' : 'bg-amber-50 text-amber-600'
            }`}>
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500 block">จัดส่ง & โลจิสติกส์</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl sm:text-2xl font-black text-amber-900">{stats.drivers}</span>
                <span className="text-xs text-slate-400">ท่าน</span>
              </div>
              <span className="text-[11px] text-amber-600 font-bold block mt-0.5">
                รหัส 31
              </span>
            </div>
          </div>
          {roleFilter === 'driver' && (
            <div className="w-2 h-2 rounded-full bg-amber-600 shrink-0 self-start mt-1"></div>
          )}
        </div>

        {/* Accountants */}
        <div
          onClick={() => setRoleFilter(roleFilter === 'accountant' ? 'all' : 'accountant')}
          className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer col-span-2 sm:col-span-1 flex items-center justify-between select-none ${
            roleFilter === 'accountant'
              ? 'bg-sky-50/60 border-sky-300 ring-2 ring-sky-500/30 shadow-md scale-[1.01]'
              : 'bg-white border-slate-100 hover:border-sky-200 hover:shadow-sm'
          }`}
          title="คลิกเพื่อกรองเฉพาะฝ่ายบัญชี"
        >
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-xl shrink-0 transition-colors ${
              roleFilter === 'accountant' ? 'bg-sky-600 text-white shadow-sm' : 'bg-sky-50 text-sky-600'
            }`}>
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500 block">ฝ่ายบัญชี</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-xl sm:text-2xl font-black text-sky-900">{stats.accountants}</span>
                <span className="text-xs text-slate-400">ท่าน</span>
              </div>
              <span className="text-[11px] text-sky-600 font-bold block mt-0.5">
                รหัส 41
              </span>
            </div>
          </div>
          {roleFilter === 'accountant' && (
            <div className="w-2 h-2 rounded-full bg-sky-600 shrink-0 self-start mt-1"></div>
          )}
        </div>
      </div>

      {/* 2. Controls & Search Bar (Revamped Filter System) */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Box with Clear Button */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อพนักงาน, ชื่อเล่น, รหัส (2611XXX), Username, เบอร์โทร..."
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
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

          {/* Sync to Supabase Auth Button */}
          <button
            type="button"
            onClick={handleSyncAllAuth}
            disabled={isSyncingAuth || staffList.length === 0}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm shrink-0 cursor-pointer ${
              isSyncingAuth
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 active:scale-95'
            }`}
            title="ซิงก์ผู้ใช้พนักงานทั้งหมดเข้าสู่ Supabase Auth (auth.users)"
          >
            {isSyncingAuth ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span>กำลังซิงก์ Auth...</span>
              </>
            ) : (
              <>
                <Cloud className="w-4 h-4 text-indigo-600" />
                <span>ซิงก์ Supabase Auth</span>
              </>
            )}
          </button>
        </div>

        {/* Filter Toolbar: Roles & Status */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
          {/* Role Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-xs">
            <span className="text-[11px] font-bold text-slate-400 mr-1 shrink-0 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> ตำแหน่ง:
            </span>
            <button
              onClick={() => setRoleFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                roleFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              <span>ทั้งหมด</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${roleFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
                {staffList.length}
              </span>
            </button>
            {activeRoleDefinitions.map(r => {
              const count = staffList.filter(s => s.role === r.name).length;
              const isSelected = roleFilter === r.name;
              return (
                <button
                  key={r.name}
                  onClick={() => setRoleFilter(isSelected ? 'all' : r.name)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? `${r.badge || 'bg-indigo-600 text-white'} shadow-sm`
                      : `${r.color || 'bg-slate-50 text-slate-700'} hover:opacity-90`
                  }`}
                >
                  <span>{r.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-black/5 text-slate-700'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Status Filter & Reset */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  statusFilter === 'all' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                สถานะทั้งหมด
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'active' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-emerald-700'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>พร้อมงาน ({stats.active})</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('inactive')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'inactive' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                <span>พักงาน ({stats.inactive})</span>
              </button>
            </div>

            {/* Quick Reset Button */}
            {(roleFilter !== 'all' || statusFilter !== 'all' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setRoleFilter('all');
                  setStatusFilter('all');
                  setSearchQuery('');
                }}
                className="p-1.5 text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition flex items-center gap-1 font-bold cursor-pointer"
                title="ล้างตัวกรองทั้งหมด"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">รีเซ็ต</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Staff Table Grid (Desktop) */}
      <div className="hidden md:block bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-5">รหัสพนักงาน</th>
                <th className="py-3.5 px-4">พนักงาน & ชื่อผู้ใช้</th>
                <th className="py-3.5 px-4">ตำแหน่ง & สิทธิ์</th>
                <th className="py-3.5 px-4">เบอร์โทรศัพท์</th>
                <th className="py-3.5 px-4">อีเมล</th>
                <th className="py-3.5 px-4 text-center">สถานะ</th>
                <th className="py-3.5 px-5 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400 text-sm">
                    ไม่พบข้อมูลพนักงานที่ตรงกับเงื่อนไขการค้นหา
                  </td>
                </tr>
              ) : (
                filteredStaff.map((staff) => {
                  const role = getRoleInfo(staff.role);
                  return (
                    <tr
                      key={staff.id || staff.username}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* รหัสพนักงาน */}
                      <td className="py-3.5 px-5 font-bold">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg tracking-wider">
                            {staff.id || staff.staff_code || '-'}
                          </span>
                          {(staff.id || staff.staff_code) && (
                            <button
                              onClick={() => handleCopyCode(staff.id || staff.staff_code)}
                              className="p-1 text-slate-300 hover:text-indigo-600 transition"
                              title="คัดลอกรหัสพนักงาน"
                            >
                              {copiedCode === (staff.id || staff.staff_code) ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* ชื่อ & โปรไฟล์ */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center shrink-0 overflow-hidden ring-2 ring-slate-100 text-sm shadow-sm">
                            {staff.avatar_url ? (
                              <img
                                src={staff.avatar_url}
                                alt={staff.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            ) : (
                              (staff.nickname || staff.name || staff.username || 'U').charAt(0).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-2">
                              <span>{staff.name || staff.username}</span>
                              {staff.nickname && (
                                <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold">
                                  ({staff.nickname})
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 font-mono flex items-center gap-1">
                              <span>@{staff.username}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* ตำแหน่ง & สิทธิ์ */}
                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold shadow-2xs">
                          <span className={`w-2 h-2 rounded-full ${role.badge}`} />
                          <span className={role.color.split(' ')[1]}>{role.label}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({role.code})</span>
                        </div>
                      </td>

                      {/* เบอร์โทร */}
                      <td className="py-3.5 px-4 text-xs">
                        {staff.phone ? (
                          <a
                            href={`tel:${staff.phone}`}
                            className="inline-flex items-center gap-1.5 text-slate-600 hover:text-indigo-600 font-medium transition"
                          >
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{staff.phone}</span>
                          </a>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* อีเมล */}
                      <td className="py-3.5 px-4 text-xs">
                        {staff.email ? (
                          <a
                            href={`mailto:${staff.email}`}
                            className="inline-flex items-center gap-1.5 text-slate-600 hover:text-indigo-600 font-medium transition truncate max-w-[200px]"
                          >
                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{staff.email}</span>
                          </a>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* สถานะ */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleToggleActive(staff)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border transition cursor-pointer ${
                            staff.is_active !== false
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                          }`}
                          title="คลิกเพื่อสลับสถานะ"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${staff.is_active !== false ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          <span>{staff.is_active !== false ? 'พร้อมทำงาน' : 'พักงาน'}</span>
                        </button>
                      </td>

                      {/* จัดการ */}
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setSelectedStaff(staff);
                              setIsDetailModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                            title="ดูประวัติและผลงาน"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(staff)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition cursor-pointer"
                            title="แก้ไขข้อมูลพนักงาน"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => promptDeleteStaff(staff)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="ลบพนักงาน"
                            disabled={staffList.length <= 1}
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

      {/* 4. Mobile Cards Grid */}
      <div className="md:hidden space-y-3">
        {filteredStaff.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-100 text-center text-slate-400 text-sm">
            ไม่พบข้อมูลพนักงาน
          </div>
        ) : (
          filteredStaff.map((staff) => {
            const role = getRoleInfo(staff.role);
            return (
              <div
                key={staff.id || staff.username}
                className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center shrink-0 overflow-hidden ring-2 ring-slate-100 text-base shadow-sm">
                      {staff.avatar_url ? (
                        <img
                          src={staff.avatar_url}
                          alt={staff.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      ) : (
                        (staff.nickname || staff.name || staff.username || 'U').charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{staff.name || staff.username}</span>
                        {staff.nickname && (
                          <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">
                            {staff.nickname}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          {staff.id || staff.staff_code}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${role.color}`}>
                          {role.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      staff.is_active !== false
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}
                  >
                    {staff.is_active !== false ? 'พร้อม' : 'พัก'}
                  </span>
                </div>

                {/* Contacts */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-50">
                  {staff.phone ? (
                    <a
                      href={`tel:${staff.phone}`}
                      className="flex items-center gap-1.5 p-2 bg-slate-50 rounded-xl text-slate-700 font-bold"
                    >
                      <Phone className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="truncate">{staff.phone}</span>
                    </a>
                  ) : (
                    <div className="p-2 bg-slate-50 rounded-xl text-slate-400 text-center">-</div>
                  )}

                  {staff.email ? (
                    <a
                      href={`mailto:${staff.email}`}
                      className="flex items-center gap-1.5 p-2 bg-slate-50 rounded-xl text-slate-700 font-bold truncate"
                    >
                      <Mail className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                      <span className="truncate">{staff.email}</span>
                    </a>
                  ) : (
                    <div className="p-2 bg-slate-50 rounded-xl text-slate-400 text-center">-</div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-50">
                  <button
                    onClick={() => {
                      setSelectedStaff(staff);
                      setIsDetailModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>ดูโปรไฟล์</span>
                  </button>
                  <button
                    onClick={() => handleOpenEditModal(staff)}
                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition flex items-center gap-1"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>แก้ไข</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 5. Create / Edit Staff Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md backdrop-animate-in"
            onClick={() => setIsModalOpen(false)}
          />

          <div
            className="bg-white w-full max-w-2xl sm:rounded-[2.5rem] rounded-2xl shadow-2xl relative z-10 overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] modal-animate-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header (Sticky) */}
            <div className="px-5 py-4 sm:px-8 sm:py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-20 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 sm:p-3 bg-indigo-50 text-indigo-600 rounded-xl sm:rounded-2xl shrink-0">
                  <Briefcase className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                      {editingStaffId ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงานใหม่'}
                    </h3>
                    {formData.staff_code && (
                      <span className="bg-indigo-50 text-indigo-600 text-[10px] sm:text-xs px-2.5 py-0.5 sm:py-1 rounded-lg font-bold border border-indigo-100 w-fit">
                        {formData.staff_code}
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">
                    {editingStaffId ? 'ปรับปรุงข้อมูลส่วนตัว สิทธิ์การใช้งาน และรหัสผ่าน' : 'สร้างบัญชีพนักงานใหม่และกำหนดสิทธิ์เข้าใช้งานระบบ'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-colors cursor-pointer active:scale-95"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveStaff} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 sm:p-8 custom-scrollbar space-y-6 overscroll-contain">
                {/* Row 1: Username & Staff Code */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ชื่อผู้ใช้ (Username) *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="เช่น aom, dream, staff01"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>รหัสพนักงาน (Staff Code)</span>
                      <span className="text-[10px] text-indigo-600 font-normal">รูปแบบ YY+PP+NNN</span>
                    </label>
                    <input
                      type="text"
                      value={formData.staff_code}
                      onChange={(e) => setFormData({ ...formData, staff_code: e.target.value })}
                      placeholder="เช่น 2611001"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold font-mono text-indigo-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                    />
                  </div>
                </div>

                {/* Row 2: Password & Confirm Password (Eye icon INSIDE frame + Re-check validation) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      รหัสผ่าน (Password) *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="กำหนดรหัสผ่าน"
                        className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-indigo-600 transition rounded-lg hover:bg-slate-100 cursor-pointer"
                        title={showPassword ? 'ซ่อนรหัสผ่าน' : 'ดูรหัสผ่าน'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>ยืนยันรหัสผ่าน (Confirm) *</span>
                      {formData.confirmPassword && (
                        formData.password === formData.confirmPassword ? (
                          <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> รหัสตรงกัน
                          </span>
                        ) : (
                          <span className="text-[10px] text-rose-500 font-bold">
                            รหัสไม่ตรงกัน
                          </span>
                        )
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        placeholder="กรอกรหัสผ่านซ้ำอีกรอบ"
                        className={`w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border rounded-xl text-xs sm:text-sm font-bold font-mono focus:bg-white focus:outline-none focus:ring-2 transition ${
                          formData.confirmPassword && formData.password !== formData.confirmPassword
                            ? 'border-rose-300 focus:ring-rose-500/20 focus:border-rose-500'
                            : 'border-slate-200 focus:ring-indigo-500/20 focus:border-indigo-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-indigo-600 transition rounded-lg hover:bg-slate-100 cursor-pointer"
                        title={showConfirmPassword ? 'ซ่อนรหัสผ่าน' : 'ดูรหัสผ่าน'}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Row 3: Role Selection & Citizen ID */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ตำแหน่ง & สิทธิ์การใช้งาน *
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => handleRoleChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition cursor-pointer"
                    >
                      {activeRoleDefinitions.map(r => (
                        <option key={r.name} value={r.name}>
                          {r.label} ({r.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>เลขประจำตัวประชาชน</span>
                      <span className="text-[10px] text-slate-400 font-normal">13 หลัก</span>
                    </label>
                    <input
                      type="text"
                      maxLength={17}
                      value={formData.citizen_id}
                      onChange={(e) => setFormData({ ...formData, citizen_id: e.target.value })}
                      placeholder="x-xxxx-xxxxx-xx-x"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                    />
                  </div>
                </div>

                {/* Role explanation alert */}
                <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs text-indigo-800 flex items-start gap-2">
                  <span className="text-sm">💡</span>
                  <div>
                    <b>สิทธิ์ของตำแหน่ง {getRoleInfo(formData.role).label}:</b> {getRoleInfo(formData.role).desc}
                    <div className="text-[11px] text-indigo-600 mt-0.5">
                      (สามารถตั้งค่าสิทธิ์ว่าแต่ละตำแหน่งเปิดหน้าจอใดได้บ้าง ที่หน้า <b>ตั้งค่าระบบ &gt; สิทธิ์และบทบาท</b>)
                    </div>
                  </div>
                </div>

                {/* Row 4: Birth Date & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                        <span>วันเดือนปีเกิด (พ.ศ.)</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">ปฏิทินไทย</span>
                    </label>
                    <ModernDateTimePicker
                      value={formData.birth_date}
                      onChange={(val) => setFormData(prev => ({ ...prev, birth_date: val }))}
                      placeholder="เลือกวันเดือนปีเกิด"
                      hasTime={false}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      เบอร์โทรศัพท์ติดต่อ
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="เช่น 081-234-5678"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                    />
                  </div>
                </div>

                {/* Row 5: Full Name & Nickname */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ชื่อ-นามสกุลจริง
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="เช่น อมรรัตน์ สดใส"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ชื่อเล่น
                    </label>
                    <input
                      type="text"
                      value={formData.nickname}
                      onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                      placeholder="เช่น ออม, ดรีม"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                    />
                  </div>
                </div>

                {/* Row 6: Email & Emergency Contact */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      อีเมล
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="เช่น staff@flower2u.com"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ผู้ติดต่อฉุกเฉิน (ชื่อ &amp; เบอร์โทร)
                    </label>
                    <input
                      type="text"
                      value={formData.emergency_contact}
                      onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                      placeholder="เช่น คุณแม่ 089-999-9999"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                    />
                  </div>
                </div>

                {/* Row 7: Address */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ที่อยู่ปัจจุบัน / ที่อยู่ตามบัตร
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="เช่น 123/45 แขวง... เขต... กทม."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                  />
                </div>

                {/* Row 6: Avatar URL */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    รูปถ่ายพนักงาน (URL หรือ Drive Link)
                  </label>
                  <input
                    type="text"
                    value={formData.avatar_url}
                    onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                    placeholder="https://lh3.googleusercontent.com/... หรือ ลิงก์รูปภาพ"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                  />
                </div>

                {/* Row 6: Active Status Checkbox */}
                <div className="pt-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        เปิดใช้งานสถานะพนักงาน (Active)
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        พนักงานสามารถเข้าสู่ระบบและพร้อมรับมอบหมายงานตามหน้าที่
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Modal Footer (Sticky at Bottom) */}
              <div className="px-5 py-4 sm:px-8 sm:py-5 border-t border-slate-100 bg-white/95 backdrop-blur-xl sticky bottom-0 z-30 flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="py-3 px-5 sm:px-6 rounded-2xl text-slate-600 bg-slate-100/80 hover:bg-slate-200 font-bold text-sm transition-all active:scale-95 cursor-pointer"
                >
                  ยกเลิก
                </button>
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
                  <span>{isSaving ? 'กำลังบันทึก...' : (editingStaffId ? 'บันทึกการแก้ไข' : 'สร้างบัญชีพนักงาน')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Staff Detail Dossier Modal */}
      {isDetailModalOpen && selectedStaff && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md backdrop-animate-in"
            onClick={() => setIsDetailModalOpen(false)}
          />

          <div
            className="bg-white w-full max-w-xl sm:rounded-[2.5rem] rounded-2xl shadow-2xl relative z-10 overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] modal-animate-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header (Sticky) */}
            <div className="px-5 py-4 sm:px-8 sm:py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-20 shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 font-black flex items-center justify-center text-lg sm:text-xl shrink-0 overflow-hidden shadow-sm">
                  {selectedStaff.avatar_url ? (
                    <img
                      src={selectedStaff.avatar_url}
                      alt={selectedStaff.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    (selectedStaff.nickname || selectedStaff.name || selectedStaff.username || 'U').charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                      {selectedStaff.name || selectedStaff.username}
                    </h3>
                    {selectedStaff.nickname && (
                      <span className="bg-indigo-50 text-indigo-600 text-xs px-2.5 py-0.5 rounded-lg font-bold border border-indigo-100 w-fit">
                        {selectedStaff.nickname}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium flex items-center gap-2 mt-0.5">
                    <span className="font-mono font-bold text-slate-700">{selectedStaff.id || selectedStaff.staff_code}</span>
                    <span>•</span>
                    <span>@{selectedStaff.username}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-colors active:scale-95 cursor-pointer"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            {/* Content (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-8 custom-scrollbar space-y-5 overscroll-contain">
              {/* Role badge card */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block">ตำแหน่งและหน้าที่</span>
                  <span className="text-base font-bold text-slate-800">
                    {getRoleInfo(selectedStaff.role).label}
                  </span>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {getRoleInfo(selectedStaff.role).desc}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-xl text-xs font-black border ${getRoleInfo(selectedStaff.role).color}`}>
                  รหัส {getRoleInfo(selectedStaff.role).code}
                </span>
              </div>

              {/* Contact info list */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">ข้อมูลการติดต่อ</h4>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs font-bold">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Phone className="w-4 h-4 text-indigo-500" />
                    <span>เบอร์โทรศัพท์:</span>
                  </div>
                  {selectedStaff.phone ? (
                    <a href={`tel:${selectedStaff.phone}`} className="text-indigo-600 hover:underline">
                      {selectedStaff.phone}
                    </a>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs font-bold">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Mail className="w-4 h-4 text-purple-500" />
                    <span>อีเมล:</span>
                  </div>
                  {selectedStaff.email ? (
                    <a href={`mailto:${selectedStaff.email}`} className="text-indigo-600 hover:underline">
                      {selectedStaff.email}
                    </a>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </div>

                {selectedStaff.birth_date && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs font-bold">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Calendar className="w-4 h-4 text-amber-500" />
                      <span>วันเดือนปีเกิด:</span>
                    </div>
                    <span className="text-slate-800">
                      {formatDate(selectedStaff.birth_date, 'full')}
                    </span>
                  </div>
                )}

                {selectedStaff.citizen_id && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs font-bold">
                    <div className="flex items-center gap-2 text-slate-600">
                      <span className="text-sm">🪪</span>
                      <span>เลขประจำตัวประชาชน:</span>
                    </div>
                    <span className="font-mono text-slate-700">{selectedStaff.citizen_id}</span>
                  </div>
                )}

                {selectedStaff.emergency_contact && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs font-bold">
                    <div className="flex items-center gap-2 text-slate-600">
                      <span className="text-sm">🚨</span>
                      <span>ผู้ติดต่อฉุกเฉิน:</span>
                    </div>
                    <span className="text-slate-700">{selectedStaff.emergency_contact}</span>
                  </div>
                )}

                {selectedStaff.address && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start justify-between text-xs font-bold gap-2">
                    <div className="flex items-center gap-2 text-slate-600 shrink-0">
                      <span className="text-sm">🏠</span>
                      <span>ที่อยู่:</span>
                    </div>
                    <span className="text-slate-700 text-right font-normal">{selectedStaff.address}</span>
                  </div>
                )}

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs font-bold">
                  <div className="flex items-center gap-2 text-slate-600">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>สถานะการทำงาน:</span>
                  </div>
                  <span className={selectedStaff.is_active !== false ? 'text-emerald-600' : 'text-slate-400'}>
                    {selectedStaff.is_active !== false ? '🟢 พร้อมปฏิบัติงาน' : '⚪ พักงาน'}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions (Sticky Footer) */}
            <div className="px-5 py-4 sm:px-8 sm:py-5 border-t border-slate-100 bg-white/95 backdrop-blur-xl sticky bottom-0 z-30 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="py-3 px-6 rounded-2xl text-slate-600 bg-slate-100/80 hover:bg-slate-200 font-bold text-sm transition-all active:scale-95 cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsDetailModalOpen(false);
                  handleOpenEditModal(selectedStaff);
                }}
                className="py-3 px-7 sm:px-8 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-0.5 hover:scale-[1.01] transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
              >
                <Edit className="w-4 h-4" />
                <span>แก้ไขข้อมูลพนักงาน</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="ยืนยันการลบพนักงาน"
        message={`ต้องการลบข้อมูลพนักงาน "${deleteConfirm.staff?.name || deleteConfirm.staff?.username}" (รหัส: ${deleteConfirm.staff?.id || deleteConfirm.staff?.staff_code}) ออกจากระบบหรือไม่?`}
        confirmText="ยืนยันลบพนักงาน"
        cancelText="ยกเลิก"
        type="danger"
        onConfirm={handleConfirmDeleteStaff}
        onCancel={() => setDeleteConfirm({ isOpen: false, staff: null })}
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

export default React.memo(StaffView);
