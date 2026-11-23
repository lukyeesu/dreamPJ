import React, { useState, useMemo, useEffect } from 'react';
import HeaderFilterPortal from './components/common/HeaderFilterPortal';
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
  ChevronDown,
  ShieldAlert,
  UserX,
  User
} from 'lucide-react';
import { loadStaffLocalFirst, saveStaffSync, deleteStaffSync, suspendStaffUserSync, unbanStaffUserSync } from './services/syncService';
import Toast from './components/common/Toast';
import ConfirmDialog from './components/common/ConfirmDialog';
import ModernDateTimePicker from './components/common/ModernDateTimePicker';
import StatusDropdown from './components/common/StatusDropdown';
import SuspendStaffModal from './components/modals/SuspendStaffModal';
import { formatDate, processImageUrl } from './utils/formatters';
import { useStickyFilter } from './hooks/useStickyFilter';
import { useModalCloseGuard } from './hooks/useModalCloseGuard';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { staffFormSchema } from './schemas/staffSchema';

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

function StaffAvatar({
  src,
  name,
  nickname,
  username,
  className = 'w-10 h-10 text-sm rounded-full ring-2 ring-slate-100',
  fallbackClassName = 'bg-slate-900 text-white font-bold'
}) {
  const resolvedSrc = processImageUrl(src || '');
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [resolvedSrc]);

  const initial = (nickname || name || username || 'U').charAt(0).toUpperCase();

  return (
    <div className={`flex items-center justify-center shrink-0 overflow-hidden shadow-sm ${className} ${fallbackClassName}`}>
      {resolvedSrc && !hasError ? (
        <img
          src={resolvedSrc}
          alt={name || username || 'Staff'}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
          onError={() => setHasError(true)}
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}

function Staff({
  activities = [],
  isCreateOpen = false,
  onCloseCreate,
  onRefresh,
  currentUser = null
}) {
  const { isFilterStuck, filterSentinelRef } = useStickyFilter();
  const [staffList, setStaffList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [copiedCode, setCopiedCode] = useState(null);
  const [suspendModal, setSuspendModal] = useState({
    isOpen: false,
    staff: null,
    isProcessing: false
  });

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
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [editingStaffExtra, setEditingStaffExtra] = useState({
    banned_until: null,
    is_banned_permanent: false,
    ban_reason: ''
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors, isDirty }
  } = useForm({
    resolver: zodResolver(staffFormSchema),
    defaultValues: {
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
    }
  });

  const watchedRole = watch('role') || 'technician';
  const watchedStaffCode = watch('staff_code') || '';
  const watchedPassword = watch('password') || '';
  const watchedConfirmPassword = watch('confirmPassword') || '';
  const watchedAvatarUrl = watch('avatar_url') || '';

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showAvatarUrlInput, setShowAvatarUrlInput] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    setAvatarError(false);
  }, [watchedAvatarUrl]);
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

  const {
    requestClose: requestCloseModal,
    isConfirmOpen: isModalCloseConfirmOpen,
    closeConfirmDialog: modalCloseConfirmDialog,
  } = useModalCloseGuard({
    isOpen: isModalOpen,
    onClose: () => setIsModalOpen(false),
    shouldConfirm: !isViewOnly,
    dirty: isDirty,
    listenEscape: false,
  });

  // Keyboard shortcut: close modals on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (e.defaultPrevented) return;
        if (isModalCloseConfirmOpen) return;
        if (isDetailModalOpen) setIsDetailModalOpen(false);
        else if (isModalOpen) requestCloseModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, isDetailModalOpen, isModalCloseConfirmOpen, requestCloseModal]);

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

    setIsViewOnly(false);
    setEditingStaffId(null);
    setEditingStaffExtra({
      banned_until: null,
      is_banned_permanent: false,
      ban_reason: ''
    });
    reset({
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
    setShowAvatarUrlInput(false);
    setAvatarError(false);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (staff, startLocked = true) => {
    const staffId = staff.id || staff.staff_code || staff.username;
    setIsViewOnly(Boolean(startLocked));
    setEditingStaffId(staffId);
    setEditingStaffExtra({
      banned_until: staff.banned_until || null,
      is_banned_permanent: !!staff.is_banned_permanent,
      ban_reason: staff.ban_reason || ''
    });
    reset({
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
      avatar_url: staff.avatar_url || staff.profile_image_url || staff.image || '',
      is_active: staff.is_active !== undefined ? staff.is_active : true
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
    setShowAvatarUrlInput(false);
    setAvatarError(false);
    setIsModalOpen(true);
  };

  // Change Role and update suggested staff code if user hasn't typed custom code
  const handleRoleChange = (newRole) => {
    setValue('role', newRole, { shouldDirty: true, shouldValidate: true });
    const isDefaultFormat = !watchedStaffCode || /^\d{7,8}$/.test(watchedStaffCode);
    if (isDefaultFormat && !editingStaffId) {
      setValue('staff_code', generateSuggestedStaffCode(newRole), { shouldDirty: true, shouldValidate: true });
    }
  };

  // Save Staff (React Hook Form onSubmit)
  const onSubmitStaff = async (formData) => {
    if (isViewOnly) return;
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
      const finalStaffCode = (formData.staff_code || '').trim() || generateSuggestedStaffCode(formData.role);
      const payload = {
        id: editingStaffId || finalStaffCode, // ID IS THE STAFF CODE DIRECTLY
        username: formData.username.trim(),
        password: formData.password.trim(),
        staff_code: finalStaffCode,
        name: (formData.name || '').trim() || formData.username.trim(),
        nickname: (formData.nickname || '').trim(),
        role: formData.role,
        role_code: roleDef.code,
        role_label: roleDef.label,
        phone: (formData.phone || '').trim(),
        email: (formData.email || '').trim(),
        citizen_id: (formData.citizen_id || '').trim(),
        birth_date: formData.birth_date || null,
        address: (formData.address || '').trim(),
        emergency_contact: (formData.emergency_contact || '').trim(),
        avatar_url: (formData.avatar_url || '').trim(),
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

  // Trigger Suspend Modal
  const handleOpenSuspendModal = (staff) => {
    setSuspendModal({
      isOpen: true,
      staff,
      isProcessing: false
    });
  };

  // Confirm Suspend / Ban Staff
  const handleConfirmSuspend = async ({ staffId, username, bannedUntil, isPermanent, reason }) => {
    setSuspendModal(prev => ({ ...prev, isProcessing: true }));
    try {
      await suspendStaffUserSync({ staffId, username, bannedUntil, isPermanent, reason });
      setStaffList(prev => prev.map(s => {
        if (s.id === staffId || s.username === username) {
          return {
            ...s,
            is_active: false,
            banned_until: isPermanent ? null : bannedUntil,
            is_banned_permanent: isPermanent,
            ban_reason: reason
          };
        }
        return s;
      }));
      showToast(isPermanent ? `ระงับการใช้งานคุณ ${username} ถาวรแล้ว (เตะออกจากระบบทันที)` : `ระงับการใช้งานคุณ ${username} เรียบร้อย (เตะออกจากระบบทันที)`, 'success');
      setSuspendModal({ isOpen: false, staff: null, isProcessing: false });
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast('เกิดข้อผิดพลาดในการระงับผู้ใช้: ' + err.message, 'error');
      setSuspendModal(prev => ({ ...prev, isProcessing: false }));
    }
  };

  // Confirm Unban Staff
  const handleConfirmUnban = async ({ staffId, username }) => {
    setSuspendModal(prev => ({ ...prev, isProcessing: true }));
    try {
      await unbanStaffUserSync({ staffId, username });
      setStaffList(prev => prev.map(s => {
        if (s.id === staffId || s.username === username) {
          return {
            ...s,
            is_active: true,
            banned_until: null,
            is_banned_permanent: false,
            ban_reason: null
          };
        }
        return s;
      }));
      showToast(`ปลดระงับการใช้งานคุณ ${username} เรียบร้อยแล้ว (สามารถเข้าใช้งานได้)`, 'success');
      setSuspendModal({ isOpen: false, staff: null, isProcessing: false });
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast('เกิดข้อผิดพลาดในการปลดระงับ: ' + err.message, 'error');
      setSuspendModal(prev => ({ ...prev, isProcessing: false }));
    }
  };

  // Copy Staff Code
  const handleCopyCode = (code) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
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

  // Filtered Staff (Zero legacy mock entries)
  const filteredStaff = useMemo(() => {
    return staffList.filter(staff => {
      // 🛡️ Filter out legacy mock accounts (e.g. staff-1, staff-2, staff-3, staff-4)
      if (staff.id && String(staff.id).startsWith('staff-')) return false;

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
    <div className="flex flex-col gap-6 pb-24 md:pb-12 animate-fadeIn max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-4">
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
              <span className="text-xs text-emerald-600 font-bold block mt-0.5">
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
              <span className="text-xs text-purple-600 font-bold block mt-0.5">
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
              <span className="text-xs text-emerald-600 font-bold block mt-0.5">
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
              <span className="text-xs text-amber-600 font-bold block mt-0.5">
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
              <span className="text-xs text-sky-600 font-bold block mt-0.5">
                รหัส 41
              </span>
            </div>
          </div>
          {roleFilter === 'accountant' && (
            <div className="w-2 h-2 rounded-full bg-sky-600 shrink-0 self-start mt-1"></div>
          )}
        </div>
      </div>

      {/* 2. Header-Integrated Search & Filter */}
      <HeaderFilterPortal
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ค้นหาชื่อพนักงาน, ชื่อเล่น, รหัส, เบอร์โทร..."
        activeFilterCount={[roleFilter !== 'all', statusFilter !== 'all'].filter(Boolean).length}
        onReset={() => {
          setSearchQuery('');
          setRoleFilter('all');
          setStatusFilter('all');
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <StatusDropdown
            size="sm"
            leftIcon={Briefcase}
            showDot={false}
            ariaLabel="กรองตามตำแหน่งงาน"
            value={roleFilter}
            onChange={(val) => setRoleFilter(val)}
            options={[
              { value: 'all', label: `ตำแหน่งทั้งหมด (${staffList.length})` },
              ...activeRoleDefinitions.map((r) => {
                const count = staffList.filter((s) => s.role === r.name).length;
                return { value: r.name, label: `${r.label} (${count})` };
              }),
            ]}
            className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-700"
            title="กรองตามตำแหน่งงาน"
          />

          <StatusDropdown
            size="sm"
            showDot={false}
            ariaLabel="กรองตามสถานะงาน"
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            options={[
              { value: 'all', label: 'สถานะทั้งหมด' },
              { value: 'active', label: `พร้อมงาน (${stats.active})` },
              { value: 'inactive', label: `พักงาน (${stats.inactive})` },
            ]}
            className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-700"
            title="กรองตามสถานะงาน"
          />
        </div>
      </HeaderFilterPortal>

      {/* 3. Staff Table Grid (Desktop) */}
      <div className="hidden md:block bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-xs font-bold text-slate-600 uppercase tracking-wider">
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
                          <StaffAvatar
                            src={staff.avatar_url || staff.profile_image_url || staff.image}
                            name={staff.name}
                            nickname={staff.nickname}
                            username={staff.username}
                            className="w-10 h-10 text-sm rounded-full ring-2 ring-slate-100"
                          />
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
                          <span className="text-xs text-slate-400 font-mono">({role.code})</span>
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
                        {(() => {
                          const isSuspended = staff.is_banned_permanent || staff.is_active === false || (staff.banned_until && new Date(staff.banned_until) > new Date());
                          return (
                            <button
                              onClick={() => handleOpenSuspendModal(staff)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition cursor-pointer shadow-2xs ${
                                isSuspended
                                  ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              }`}
                              title="คลิกเพื่อจัดการระงับ/ปลดระงับผู้ใช้"
                            >
                              <span className={`w-2 h-2 rounded-full ${isSuspended ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                              <span>{isSuspended ? (staff.is_banned_permanent ? 'ระงับถาวร' : 'ระงับการใช้งาน') : 'พร้อมทำงาน'}</span>
                            </button>
                          );
                        })()}
                      </td>

                      {/* จัดการ */}
                      <td className="py-3.5 px-5 text-right">
                        {(() => {
                          const isSuspended = staff.is_banned_permanent || staff.is_active === false || (staff.banned_until && new Date(staff.banned_until) > new Date());
                          return (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleOpenSuspendModal(staff)}
                                className={`p-1.5 rounded-lg transition cursor-pointer ${
                                  isSuspended
                                    ? 'text-rose-600 bg-rose-50 hover:bg-rose-100 ring-1 ring-rose-200'
                                    : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                }`}
                                title={isSuspended ? "จัดการการระงับ / ปลดระงับ" : "ระงับการใช้งาน (เตะออกจากระบบ)"}
                              >
                                <ShieldAlert className="w-4 h-4" />
                              </button>
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
                          );
                        })()}
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
                    <StaffAvatar
                      src={staff.avatar_url || staff.profile_image_url || staff.image}
                      name={staff.name}
                      nickname={staff.nickname}
                      username={staff.username}
                      className="w-12 h-12 text-base rounded-full ring-2 ring-slate-100"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{staff.name || staff.username}</span>
                        {staff.nickname && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">
                            {staff.nickname}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          {staff.id || staff.staff_code}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold border ${role.color}`}>
                          {role.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const isSuspended = staff.is_banned_permanent || staff.is_active === false || (staff.banned_until && new Date(staff.banned_until) > new Date());
                    return (
                      <button
                        type="button"
                        onClick={() => handleOpenSuspendModal(staff)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition cursor-pointer ${
                          isSuspended
                            ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        }`}
                        title="แตะเพื่อจัดการการระงับผู้ใช้"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isSuspended ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                        <span>{isSuspended ? (staff.is_banned_permanent ? 'ระงับถาวร' : 'ถูกระงับ') : 'พร้อม'}</span>
                      </button>
                    );
                  })()}
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
                    onClick={() => handleOpenSuspendModal(staff)}
                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition flex items-center gap-1"
                    title="ระงับการใช้งาน / เตะออกจากระบบ"
                  >
                    <ShieldAlert className="w-4 h-4" />
                  </button>
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
      {modalCloseConfirmDialog}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md backdrop-animate-in"
          />

          <div
            className="bg-white w-full max-w-4xl sm:rounded-[2rem] rounded-2xl shadow-2xl relative z-10 overflow-hidden border border-slate-100 flex flex-col max-h-[92vh] modal-animate-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header (Sticky) */}
            <div className="px-5 py-4 sm:px-8 sm:py-5 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-20 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 sm:p-3 bg-indigo-50 text-indigo-600 rounded-xl sm:rounded-2xl shrink-0">
                  <Briefcase className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                      {editingStaffId ? (isViewOnly ? 'รายละเอียดข้อมูลพนักงาน' : 'แก้ไขข้อมูลพนักงาน') : 'เพิ่มพนักงานใหม่'}
                    </h3>
                    {watchedStaffCode && (
                      <span className="bg-indigo-50 text-indigo-600 text-xs sm:text-xs px-2.5 py-0.5 sm:py-1 rounded-lg font-bold border border-indigo-100 w-fit">
                        {watchedStaffCode}
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">
                    {editingStaffId
                      ? (isViewOnly ? 'ล็อกป้องกันการแก้ไขโดยไม่ตั้งใจ กดปุ่มแก้ไขด้านล่างเพื่อปรับข้อมูล' : 'ปรับปรุงข้อมูลส่วนตัว สิทธิ์การใช้งาน และรหัสผ่าน')
                      : 'สร้างบัญชีพนักงานใหม่และกำหนดสิทธิ์เข้าใช้งานระบบ'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={requestCloseModal}
                className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-colors cursor-pointer active:scale-95"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit(onSubmitStaff)} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 custom-scrollbar overscroll-contain">
                <fieldset
                  disabled={isViewOnly}
                  className="block min-w-0 border-0 p-0 m-0 space-y-6 [&_input:disabled]:bg-slate-100 [&_input:disabled]:text-slate-500 [&_input:disabled]:cursor-not-allowed [&_select:disabled]:bg-slate-100 [&_select:disabled]:text-slate-500 [&_select:disabled]:cursor-not-allowed"
                >
                  {/* Section 1: ข้อมูลพื้นฐาน & บัญชีเข้าสู่ระบบ */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
                      <div className="w-2 h-2 rounded-full bg-indigo-600" />
                      <h4 className="text-sm font-bold text-slate-800 tracking-tight">
                        1. ข้อมูลพื้นฐาน &amp; บัญชีเข้าสู่ระบบ
                      </h4>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-5 sm:gap-6 items-center sm:items-start">
                      {/* Left Avatar Column */}
                      <div className="flex flex-col items-center gap-2 shrink-0">
                        <div className="relative">
                          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 border-dashed border-slate-200 bg-slate-50 relative flex items-center justify-center overflow-hidden shadow-inner">
                            {(() => {
                              const resolvedSrc = processImageUrl(watchedAvatarUrl);
                              if (resolvedSrc && !avatarError) {
                                return (
                                  <img
                                    src={resolvedSrc}
                                    alt="Avatar Preview"
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                    onError={() => setAvatarError(true)}
                                  />
                                );
                              }
                              return <User className="w-10 h-10 text-slate-300" />;
                            })()}
                          </div>
                          {!isViewOnly && (
                            <button
                              type="button"
                              onClick={() => setShowAvatarUrlInput(!showAvatarUrlInput)}
                              className="absolute bottom-0 right-0 p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-md transition-all active:scale-95 cursor-pointer z-10"
                              title="เปลี่ยน / ใส่ลิงก์รูปภาพ"
                            >
                              <Camera className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <span className="text-xs text-slate-400 font-medium">รูปถ่ายพนักงาน</span>
                      </div>

                      {/* Right Account Credentials Card */}
                      <div className="flex-1 w-full bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                              <span>รหัสพนักงาน (Staff Code)</span>
                              <span className="text-xs text-indigo-600 font-normal">รูปแบบ YY+PP+NNN</span>
                            </label>
                            <input
                              type="text"
                              {...register('staff_code')}
                              placeholder="เช่น 2611001"
                              className="w-full h-[46px] px-4 py-3 bg-white border border-slate-200 rounded-xl text-base font-bold font-mono text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                            />
                            {errors.staff_code && (
                              <p className="text-xs text-rose-600 font-bold mt-1">{errors.staff_code.message}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">
                              ชื่อผู้ใช้ (Username) *
                            </label>
                            <input
                              type="text"
                              {...register('username')}
                              placeholder="เช่น aom, dream, staff01"
                              className={`w-full h-[46px] px-4 py-3 bg-white border rounded-xl text-base font-medium text-slate-800 focus:outline-none focus:ring-2 transition ${
                                errors.username ? 'border-rose-300 focus:ring-rose-500/20 focus:border-rose-500' : 'border-slate-200 focus:ring-indigo-500/20 focus:border-indigo-500'
                              }`}
                            />
                            {errors.username && (
                              <p className="text-xs text-rose-600 font-bold mt-1">{errors.username.message}</p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5">
                              รหัสผ่าน (Password) *
                            </label>
                            <div className="relative">
                              <input
                                type={showPassword ? 'text' : 'password'}
                                {...register('password')}
                                placeholder="กำหนดรหัสผ่าน"
                                className={`w-full h-[46px] pl-4 pr-11 py-3 bg-white border rounded-xl text-base font-medium font-mono text-slate-800 focus:outline-none focus:ring-2 transition ${
                                  errors.password ? 'border-rose-300 focus:ring-rose-500/20 focus:border-rose-500' : 'border-slate-200 focus:ring-indigo-500/20 focus:border-indigo-500'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-indigo-600 transition rounded-lg hover:bg-slate-100 cursor-pointer"
                                title={showPassword ? 'ซ่อนรหัสผ่าน' : 'ดูรหัสผ่าน'}
                              >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                            {errors.password && (
                              <p className="text-xs text-rose-600 font-bold mt-1">{errors.password.message}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                              <span>ยืนยันรหัสผ่าน (Confirm) *</span>
                              {watchedConfirmPassword && (
                                watchedPassword === watchedConfirmPassword ? (
                                  <span className="text-xs text-emerald-600 font-bold flex items-center gap-0.5">
                                    <Check className="w-3.5 h-3.5" /> รหัสตรงกัน
                                  </span>
                                ) : (
                                  <span className="text-xs text-rose-500 font-bold">
                                    รหัสไม่ตรงกัน
                                  </span>
                                )
                              )}
                            </label>
                            <div className="relative">
                              <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                {...register('confirmPassword')}
                                placeholder="กรอกรหัสผ่านซ้ำอีกรอบ"
                                className={`w-full h-[46px] pl-4 pr-11 py-3 bg-white border rounded-xl text-base font-medium font-mono text-slate-800 focus:outline-none focus:ring-2 transition ${
                                  (watchedConfirmPassword && watchedPassword !== watchedConfirmPassword) || errors.confirmPassword
                                    ? 'border-rose-300 focus:ring-rose-500/20 focus:border-rose-500'
                                    : 'border-slate-200 focus:ring-indigo-500/20 focus:border-indigo-500'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-indigo-600 transition rounded-lg hover:bg-slate-100 cursor-pointer"
                                title={showConfirmPassword ? 'ซ่อนรหัสผ่าน' : 'ดูรหัสผ่าน'}
                              >
                                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                            {errors.confirmPassword && (
                              <p className="text-xs text-rose-600 font-bold mt-1">{errors.confirmPassword.message}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Avatar URL Input toggle */}
                    {(showAvatarUrlInput || errors.avatar_url) && (
                      <div className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-2xl animate-in fade-in duration-200">
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">
                          รูปถ่ายพนักงาน (URL หรือ Drive Link)
                        </label>
                        <input
                          type="text"
                          {...register('avatar_url')}
                          placeholder="https://... หรือ ลิงก์รูปภาพพนักงาน"
                          className="w-full h-[46px] px-4 py-3 bg-white border border-slate-200 rounded-xl text-base font-medium font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                        />
                        {errors.avatar_url && (
                          <p className="text-xs text-rose-600 font-bold mt-1">{errors.avatar_url.message}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Section 2: ข้อมูลส่วนตัว & สิทธิ์การใช้งาน */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-1 border-b border-slate-100 pt-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-600" />
                      <h4 className="text-sm font-bold text-slate-800 tracking-tight">
                        2. ข้อมูลส่วนตัว &amp; สิทธิ์การใช้งาน
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">
                          ชื่อ-นามสกุลจริง
                        </label>
                        <input
                          type="text"
                          {...register('name')}
                          placeholder="เช่น อมรรัตน์ สดใส"
                          className="w-full h-[46px] px-4 py-3 bg-white border border-slate-200 rounded-xl text-base font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                        />
                        {errors.name && (
                          <p className="text-xs text-rose-600 font-bold mt-1">{errors.name.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">
                          ชื่อเล่น
                        </label>
                        <input
                          type="text"
                          {...register('nickname')}
                          placeholder="เช่น ออม, ดรีม"
                          className="w-full h-[46px] px-4 py-3 bg-white border border-slate-200 rounded-xl text-base font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                        />
                        {errors.nickname && (
                          <p className="text-xs text-rose-600 font-bold mt-1">{errors.nickname.message}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">
                          ตำแหน่ง &amp; สิทธิ์การใช้งาน *
                        </label>
                        <StatusDropdown
                          value={watchedRole}
                          disabled={isViewOnly}
                          options={activeRoleDefinitions.map(r => ({
                            value: r.name,
                            label: `${r.label} (${r.code})`,
                            color: 'bg-white text-slate-800 border-slate-200'
                          }))}
                          showDot={false}
                          onChange={(val) => handleRoleChange(val)}
                          ariaLabel="ตำแหน่ง &amp; สิทธิ์การใช้งาน"
                          className="h-[46px] !text-base"
                        />
                        {errors.role && (
                          <p className="text-xs text-rose-600 font-bold mt-1">{errors.role.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-indigo-500" />
                            <span>วันเดือนปีเกิด (พ.ศ.)</span>
                          </span>
                          <span className="text-xs text-slate-500 font-medium">ปฏิทินไทย</span>
                        </label>
                        <Controller
                          control={control}
                          name="birth_date"
                          render={({ field }) => (
                            <ModernDateTimePicker
                              value={field.value}
                              onChange={field.onChange}
                              disabled={isViewOnly}
                              placeholder="เลือกวันเดือนปีเกิด"
                              hasTime={false}
                              className="h-[46px]"
                            />
                          )}
                        />
                        {errors.birth_date && (
                          <p className="text-xs text-rose-600 font-bold mt-1">{errors.birth_date.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                          <span>เลขประจำตัวประชาชน</span>
                          <span className="text-xs text-slate-500 font-medium">13 หลัก</span>
                        </label>
                        <input
                          type="text"
                          maxLength={17}
                          {...register('citizen_id')}
                          placeholder="x-xxxx-xxxxx-xx-x"
                          className="w-full h-[46px] px-4 py-3 bg-white border border-slate-200 rounded-xl text-base font-bold font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                        />
                        {errors.citizen_id && (
                          <p className="text-xs text-rose-600 font-bold mt-1">{errors.citizen_id.message}</p>
                        )}
                      </div>
                    </div>

                    {/* Role explanation alert */}
                    <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs sm:text-sm text-indigo-900 flex items-start gap-2.5">
                      <span className="text-base leading-none mt-0.5">💡</span>
                      <div>
                        <b>สิทธิ์ของตำแหน่ง {getRoleInfo(watchedRole).label}:</b> {getRoleInfo(watchedRole).desc}
                        <div className="text-xs text-indigo-600 mt-1">
                          (สามารถตั้งค่าสิทธิ์ว่าแต่ละตำแหน่งเปิดหน้าจอใดได้บ้าง ที่หน้า <b>ตั้งค่าระบบ &gt; สิทธิ์และบทบาท</b>)
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: ข้อมูลติดต่อ & ที่อยู่ */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-1 border-b border-slate-100 pt-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-600" />
                      <h4 className="text-sm font-bold text-slate-800 tracking-tight">
                        3. ข้อมูลติดต่อ &amp; ที่อยู่
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">
                          เบอร์โทรศัพท์ติดต่อ
                        </label>
                        <input
                          type="tel"
                          {...register('phone')}
                          placeholder="เช่น 081-234-5678"
                          className={`w-full h-[46px] px-4 py-3 bg-white border rounded-xl text-base font-medium text-slate-800 focus:outline-none focus:ring-2 transition ${
                            errors.phone ? 'border-rose-300 focus:ring-rose-500/20 focus:border-rose-500' : 'border-slate-200 focus:ring-indigo-500/20 focus:border-indigo-500'
                          }`}
                        />
                        {errors.phone && (
                          <p className="text-xs text-rose-600 font-bold mt-1">{errors.phone.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">
                          อีเมล
                        </label>
                        <input
                          type="email"
                          {...register('email')}
                          placeholder="เช่น staff@flower2u.com"
                          className={`w-full h-[46px] px-4 py-3 bg-white border rounded-xl text-base font-medium text-slate-800 focus:outline-none focus:ring-2 transition ${
                            errors.email ? 'border-rose-300 focus:ring-rose-500/20 focus:border-rose-500' : 'border-slate-200 focus:ring-indigo-500/20 focus:border-indigo-500'
                          }`}
                        />
                        {errors.email && (
                          <p className="text-xs text-rose-600 font-bold mt-1">{errors.email.message}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">
                          ผู้ติดต่อฉุกเฉิน (ชื่อ &amp; เบอร์โทร)
                        </label>
                        <input
                          type="text"
                          {...register('emergency_contact')}
                          placeholder="เช่น คุณแม่ 089-999-9999"
                          className="w-full h-[46px] px-4 py-3 bg-white border border-slate-200 rounded-xl text-base font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                        />
                        {errors.emergency_contact && (
                          <p className="text-xs text-rose-600 font-bold mt-1">{errors.emergency_contact.message}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">
                        ที่อยู่ปัจจุบัน / ที่อยู่ตามบัตร
                      </label>
                      <input
                        type="text"
                        {...register('address')}
                        placeholder="เช่น 123/45 แขวง... เขต... กทม."
                        className="w-full h-[46px] px-4 py-3 bg-white border border-slate-200 rounded-xl text-base font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                      />
                      {errors.address && (
                        <p className="text-xs text-rose-600 font-bold mt-1">{errors.address.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Section 4: สถานะบัญชี & ความปลอดภัย */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-1 border-b border-slate-100 pt-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-600" />
                      <h4 className="text-sm font-bold text-slate-800 tracking-tight">
                        4. สถานะบัญชี &amp; ความปลอดภัย
                      </h4>
                    </div>

                    {/* Suspension Banner if Staff is Banned */}
                    {editingStaffId && (editingStaffExtra.is_banned_permanent || (editingStaffExtra.banned_until && new Date(editingStaffExtra.banned_until) > new Date())) && (
                      <div className="p-4 bg-rose-50/90 border border-rose-200 rounded-2xl text-xs sm:text-sm text-rose-800 flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                          <div>
                            <div className="font-bold text-rose-900 text-sm">
                              {editingStaffExtra.is_banned_permanent ? 'บัญชีพนักงานนี้ถูกระงับการใช้งานถาวร' : 'บัญชีพนักงานนี้ถูกระงับการใช้งานชั่วคราว'}
                            </div>
                            {editingStaffExtra.banned_until && !editingStaffExtra.is_banned_permanent && (
                              <div className="text-xs text-rose-700 mt-1">
                                สิ้นสุดการระงับ: {new Date(editingStaffExtra.banned_until).toLocaleString('th-TH')}
                              </div>
                            )}
                            {editingStaffExtra.ban_reason && (
                              <div className="text-xs text-rose-600 mt-1">
                                เหตุผล: {editingStaffExtra.ban_reason}
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const target = staffList.find(s => s.id === editingStaffId || s.username === editingStaffId || s.staff_code === editingStaffId);
                            if (target) handleOpenSuspendModal(target);
                          }}
                          className="px-3.5 py-1.5 bg-white hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl font-bold text-xs shrink-0 transition cursor-pointer shadow-xs"
                        >
                          จัดการ / ปลดระงับ
                        </button>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50/80 border border-slate-200/80 rounded-2xl">
                      <label className="flex items-center gap-3 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          {...register('is_active')}
                          className="w-5 h-5 text-indigo-600 rounded-lg focus:ring-indigo-500 cursor-pointer"
                        />
                        <div>
                          <span className="text-sm font-bold text-slate-800 block">
                            เปิดใช้งานสถานะพนักงาน (Active)
                          </span>
                          <span className="text-xs text-slate-500 block">
                            พนักงานสามารถเข้าสู่ระบบและพร้อมรับมอบหมายงานตามหน้าที่
                          </span>
                        </div>
                      </label>

                      {editingStaffId && (
                        <button
                          type="button"
                          onClick={() => {
                            const target = staffList.find(s => s.id === editingStaffId || s.username === editingStaffId || s.staff_code === editingStaffId);
                            if (target) handleOpenSuspendModal(target);
                          }}
                          className={`whitespace-nowrap px-4 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition cursor-pointer shadow-xs self-start sm:self-auto ${
                            editingStaffExtra.is_banned_permanent || (editingStaffExtra.banned_until && new Date(editingStaffExtra.banned_until) > new Date())
                              ? 'bg-rose-100 text-rose-800 border border-rose-200 hover:bg-rose-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200'
                          }`}
                          title="คลิกเพื่อตั้งเวลาแบน / เตะออกจากระบบ"
                        >
                          <ShieldAlert className="w-4 h-4 text-rose-600" />
                          <span>
                            {editingStaffExtra.is_banned_permanent || (editingStaffExtra.banned_until && new Date(editingStaffExtra.banned_until) > new Date())
                              ? 'จัดการการระงับผู้ใช้'
                              : 'ระงับผู้ใช้ (เตะทันที)'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </fieldset>
              </div>

              {/* Modal Footer (Sticky at Bottom) */}
              <div className="px-5 py-4 sm:px-8 sm:py-5 border-t border-slate-100 bg-white/95 backdrop-blur-xl sticky bottom-0 z-30 flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={requestCloseModal}
                  className="py-3 px-6 sm:px-8 rounded-2xl text-slate-600 bg-slate-100/80 hover:bg-slate-200 font-bold text-sm transition-colors active:scale-95 cursor-pointer"
                >
                  {isViewOnly ? 'ปิด' : 'ยกเลิก'}
                </button>
                {isViewOnly ? (
                  <button
                    key="staff-edit-unlock-btn"
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsViewOnly(false);
                    }}
                    className="py-3 px-7 sm:px-8 bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100 rounded-2xl font-bold text-sm shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-colors cursor-pointer"
                  >
                    <Edit className="w-4 h-4" />
                    <span>แก้ไข</span>
                  </button>
                ) : (
                  <button
                    key="staff-save-submit-btn"
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
                )}
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
                <StaffAvatar
                  src={selectedStaff.avatar_url || selectedStaff.profile_image_url || selectedStaff.image}
                  name={selectedStaff.name}
                  nickname={selectedStaff.nickname}
                  username={selectedStaff.username}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border border-indigo-100 text-lg sm:text-xl"
                  fallbackClassName="bg-indigo-50 text-indigo-700 font-black"
                />
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
                  <span className="text-xs font-bold text-slate-400 block">ตำแหน่งและหน้าที่</span>
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

                {(() => {
                  const isSuspended = selectedStaff.is_banned_permanent || selectedStaff.is_active === false || (selectedStaff.banned_until && new Date(selectedStaff.banned_until) > new Date());
                  return (
                    <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${isSuspended ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="flex items-center gap-2">
                        {isSuspended ? <ShieldAlert className="w-4 h-4 text-rose-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                        <span>สถานะบัญชี:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={isSuspended ? 'text-rose-700 font-black' : 'text-emerald-600'}>
                          {isSuspended ? (selectedStaff.is_banned_permanent ? '🔴 ระงับการใช้งานถาวร' : '🟠 ถูกระงับการใช้งาน') : '🟢 พร้อมปฏิบัติงาน'}
                        </span>
                        {isSuspended && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsDetailModalOpen(false);
                              handleOpenSuspendModal(selectedStaff);
                            }}
                            className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-bold shadow-xs cursor-pointer"
                          >
                            จัดการ
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
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
                  handleOpenEditModal(selectedStaff, false);
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

      {/* Suspend / Ban Staff Modal */}
      <SuspendStaffModal
        isOpen={suspendModal.isOpen}
        onClose={() => setSuspendModal({ isOpen: false, staff: null, isProcessing: false })}
        staff={suspendModal.staff}
        currentUser={currentUser}
        onConfirmSuspend={handleConfirmSuspend}
        onConfirmUnban={handleConfirmUnban}
        isProcessing={suspendModal.isProcessing}
      />

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

export default React.memo(Staff);
