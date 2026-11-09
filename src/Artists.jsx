import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Users,
  Search,
  Plus,
  Trophy,
  Gift,
  Calendar,
  ExternalLink,
  Sparkles,
  TrendingUp,
  Tag,
  Edit,
  Trash2,
  X,
  Heart,
  Globe,
  Instagram,
  Twitter,
  Music2,
  Info,
  CheckCircle2,
  Cake,
  Palette,
  Camera,
  UploadCloud,
  Loader2,
  User,
  Image as ImageIcon,
  RotateCcw,
  ChevronDown
} from 'lucide-react';
import { saveArtistSync, deleteArtistSync } from './services/syncService';
import ModernDateTimePicker from './components/common/ModernDateTimePicker';
import Toast from './components/common/Toast';
import ConfirmDialog from './components/common/ConfirmDialog';
import { useStickyFilter } from './hooks/useStickyFilter';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { artistFormSchema } from './schemas/artistSchema';

const GOOGLE_DRIVE_UPLOAD_URL = import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL || 
  "https://script.google.com/macros/s/AKfycbw2WJ4tt7l__0U6XYtgHbyl0W1iGjm6oHXa9-2twBKfa1xP2-SBj2hMwaHUYp7ew_Ih/exec";

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = (err) => reject(err);
});

const compressImage = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = (event) => {
    const img = new Image();
    img.src = event.target.result;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 800;
      const scaleSize = MAX_WIDTH / img.width;
      if (scaleSize < 1) {
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
      }
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = (err) => reject(err);
  };
  reader.onerror = (err) => reject(err);
});

function Artists({
  artists = [],
  artistStats = {},
  activities = [],
  assetsDriveFolderId = '',
  isCreateOpen = false,
  onCloseCreate,
  onOpenProjectModal,
  onFilterByArtist,
  onRefresh
}) {
  const { isFilterStuck, filterSentinelRef } = useStickyFilter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgency, setSelectedAgency] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedArtistForDetail, setSelectedArtistForDetail] = useState(null);
  const [editingArtist, setEditingArtist] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, artistId: null, artistName: '' });
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);

  // Form State (React Hook Form + Zod)
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(artistFormSchema),
    defaultValues: {
      name: '',
      agency: '',
      fandom_name: '',
      fandom_color: '#ec4899',
      birth_date: '',
      debut_date: '',
      bio: '',
      social_links: { twitter: '', instagram: '', tiktok: '', weibo: '' },
      favorite_flowers: '',
      avatar_url: '',
      notes: ''
    }
  });

  const watchedAvatarUrl = watch('avatar_url') || '';
  const watchedFandomColor = watch('fandom_color') || '#ec4899';
  const watchedName = watch('name') || '';

  // Upload Avatar File to Google Drive
  const handleUploadAvatarFile = async (file) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('กรุณาเลือกไฟล์รูปภาพเท่านั้น (JPG, PNG, WebP)', 'error');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      let base64Data = '';
      if (file.size > 1 * 1024 * 1024) {
        base64Data = await compressImage(file);
      } else {
        base64Data = await fileToBase64(file);
      }

      // Show temporary preview immediately
      setValue('avatar_url', base64Data);

      // Target Google Drive Folder ID
      const targetFolderId = assetsDriveFolderId && assetsDriveFolderId.trim() !== ''
        ? assetsDriveFolderId.trim()
        : '1SRD4Qr9X5XgD4niCwlmDyZR78pWUx-XX';

      const cleanArtistName = (watchedName || 'artist').replace(/[^a-zA-Z0-9_\u0E00-\u0E7F]/g, '_');
      const fileName = `artist_${cleanArtistName}_${Date.now()}.png`;
      const mimeType = base64Data.split(',')[0].match(/:(.*?);/)?.[1] || 'image/png';

      const response = await fetch(GOOGLE_DRIVE_UPLOAD_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'uploadAsset',
          data: {
            folderId: targetFolderId,
            fileData: base64Data,
            fileName: fileName,
            mimeType: mimeType
          }
        })
      });

      const result = await response.json();
      if (result.status === 'success' && (result.url || result.fileId)) {
        const directUrl = result.fileId
          ? `https://lh3.googleusercontent.com/d/${result.fileId}`
          : (result.url || base64Data);
        setValue('avatar_url', directUrl);
        showToast('อัปโหลดรูปภาพไปยัง Google Drive สำเร็จ', 'success');
      } else {
        throw new Error(result.message || 'ไม่สามารถอัปโหลดไปยัง Google Drive ได้');
      }
    } catch (err) {
      console.error('Error uploading artist avatar:', err);
      showToast('เกิดข้อผิดพลาดในการอัปโหลด: ' + err.message, 'error');
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

  // Listen to single header button
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

  // Aggregate artists from explicit artists table, server summary stats, and loaded project activities
  const artistDirectory = useMemo(() => {
    const map = new Map();
    const hasServerStats = artistStats && typeof artistStats === 'object' && Object.keys(artistStats).length > 0;

    // 1. Seed from explicit artists table
    artists.forEach(a => {
      const key = (a.name || '').trim().toLowerCase();
      if (!key || key === '-' || key === 'unknown') return;
      const serverStat = (hasServerStats && artistStats[key]) ? artistStats[key] : null;
      map.set(key, {
        id: a.id,
        name: a.name,
        agency: a.agency || '',
        fandom_name: a.fandom_name || '',
        fandom_color: a.fandom_color || '#ec4899',
        birth_date: a.birth_date || '',
        debut_date: a.debut_date || '',
        bio: a.bio || '',
        social_links: a.social_links || {},
        favorite_flowers: a.favorite_flowers || '',
        avatar_url: a.avatar_url || '',
        notes: a.notes || '',
        projectCount: serverStat ? serverStat.projectCount : 0,
        totalRevenue: serverStat ? serverStat.totalRevenue : 0,
        totalSupport: serverStat ? serverStat.totalSupport : 0,
        categories: new Set(),
        lastActiveDate: serverStat ? serverStat.lastActiveDate : '',
        sampleProjects: []
      });
    });

    // 2. Also seed any artists discovered from server summary stats that aren't in artists table yet
    if (hasServerStats) {
      Object.entries(artistStats).forEach(([key, stat]) => {
        if (!key || key === '-' || key === 'unknown' || map.has(key)) return;
        map.set(key, {
          id: null,
          name: stat.name || key,
          agency: '',
          fandom_name: '',
          fandom_color: '#ec4899',
          birth_date: '',
          debut_date: '',
          bio: '',
          social_links: {},
          favorite_flowers: '',
          avatar_url: '',
          notes: '',
          projectCount: stat.projectCount || 0,
          totalRevenue: stat.totalRevenue || 0,
          totalSupport: stat.totalSupport || 0,
          categories: new Set(),
          lastActiveDate: stat.lastActiveDate || '',
          sampleProjects: []
        });
      });
    }

    // 3. Aggregate from activities (calculate samples & fallback stats if serverStats not loaded)
    activities.forEach(item => {
      const name = (item.artist || '').trim();
      if (!name || name === '-' || name === 'Unknown') return;
      const key = name.toLowerCase();

      if (!map.has(key)) {
        map.set(key, {
          id: item.artistId || null,
          name,
          agency: '',
          fandom_name: '',
          fandom_color: '#ec4899',
          birth_date: '',
          debut_date: '',
          bio: '',
          social_links: {},
          favorite_flowers: '',
          avatar_url: '',
          notes: '',
          projectCount: 0,
          totalRevenue: 0,
          totalSupport: 0,
          categories: new Set(),
          lastActiveDate: '',
          sampleProjects: []
        });
      }

      const entry = map.get(key);
      if (!hasServerStats) {
        entry.projectCount += 1;
        const qSum = item.quotationItems && item.quotationItems.length > 0
          ? item.quotationItems.reduce((sum, q) => sum + (parseFloat(q.price) || 0), 0)
          : 0;
        entry.totalRevenue += qSum > 0 ? qSum : (parseFloat(item.wage || item.totalRevenue || item.total_revenue) || 0);

        const calcSupport = (item.customerSupport && item.customerSupport.length > 0)
          ? item.customerSupport.reduce((sum, cs) => sum + (parseFloat(cs.price) || 0), 0)
          : 0;
        const support = calcSupport > 0 ? calcSupport : (parseFloat(item.customerSupportTotal || item.customer_support_total) || 0);
        entry.totalSupport += support;

        const dateStr = item.deliveryDate || item.date || '';
        if (dateStr && (!entry.lastActiveDate || dateStr > entry.lastActiveDate)) {
          entry.lastActiveDate = dateStr;
        }
      }

      if (item.category) entry.categories.add(item.category);
      if (entry.sampleProjects.length < 5) {
        entry.sampleProjects.push(item);
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      if (b.totalSupport !== a.totalSupport) return b.totalSupport - a.totalSupport;
      return b.projectCount - a.projectCount;
    });
  }, [artists, artistStats, activities]);

  // Unique Agencies
  const agencies = useMemo(() => {
    const set = new Set();
    artistDirectory.forEach(a => {
      if (a.agency && a.agency.trim()) set.add(a.agency.trim());
    });
    return Array.from(set).sort();
  }, [artistDirectory]);

  // Filtered artists
  const filteredArtists = useMemo(() => {
    return artistDirectory.filter(a => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q ||
        a.name.toLowerCase().includes(q) ||
        (a.agency && a.agency.toLowerCase().includes(q)) ||
        (a.fandom_name && a.fandom_name.toLowerCase().includes(q)) ||
        (a.bio && a.bio.toLowerCase().includes(q));

      const matchAgency = selectedAgency === 'all' || a.agency === selectedAgency;
      return matchSearch && matchAgency;
    });
  }, [artistDirectory, searchQuery, selectedAgency]);

  // Overall stats
  const totalArtists = artistDirectory.length;
  const totalSupportAll = artistDirectory.reduce((sum, a) => sum + a.totalSupport, 0);
  const totalJobsAll = artistDirectory.reduce((sum, a) => sum + a.projectCount, 0);

  // Open Create / Edit Modal
  const handleOpenCreateModal = (artist = null) => {
    if (artist) {
      setEditingArtist(artist);
      reset({
        name: artist.name || '',
        agency: artist.agency || '',
        fandom_name: artist.fandom_name || '',
        fandom_color: artist.fandom_color || '#ec4899',
        birth_date: artist.birth_date || '',
        debut_date: artist.debut_date || '',
        bio: artist.bio || '',
        social_links: {
          twitter: artist.social_links?.twitter || '',
          instagram: artist.social_links?.instagram || '',
          tiktok: artist.social_links?.tiktok || '',
          weibo: artist.social_links?.weibo || ''
        },
        favorite_flowers: artist.favorite_flowers || '',
        avatar_url: artist.avatar_url || '',
        notes: artist.notes || ''
      });
    } else {
      setEditingArtist(null);
      reset({
        name: '',
        agency: '',
        fandom_name: '',
        fandom_color: '#ec4899',
        birth_date: '',
        debut_date: '',
        bio: '',
        social_links: { twitter: '', instagram: '', tiktok: '', weibo: '' },
        favorite_flowers: '',
        avatar_url: '',
        notes: ''
      });
    }
    setIsModalOpen(true);
  };

  // Open Detail / Dossier Modal
  const handleOpenDetailModal = (artist) => {
    setSelectedArtistForDetail(artist);
    setIsDetailModalOpen(true);
  };

  // Submit Save Artist (React Hook Form onSubmit)
  const onSubmitArtist = async (formData) => {
    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        id: editingArtist?.id || undefined
      };
      await saveArtistSync(payload);
      showToast('บันทึกข้อมูลศิลปินสำเร็จ', 'success');
      setIsModalOpen(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast('บันทึกข้อมูลศิลปินไม่สำเร็จ: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Trigger Delete Confirmation Modal
  const handleDeleteClick = (artist) => {
    setDeleteConfirm({
      isOpen: true,
      artistId: artist.id,
      artistName: artist.name
    });
  };

  // Confirmed Delete Artist
  const handleConfirmDelete = async () => {
    if (!deleteConfirm.artistId) return;
    try {
      await deleteArtistSync(deleteConfirm.artistId);
      showToast('ลบข้อมูลศิลปินเรียบร้อย', 'success');
      setDeleteConfirm({ isOpen: false, artistId: null, artistName: '' });
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast('ลบไม่สำเร็จ: ' + err.message, 'error');
    }
  };

  // Helper: Calculate Age
  const getAge = (birthDateStr) => {
    if (!birthDateStr) return null;
    const birth = new Date(birthDateStr);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <div className="flex flex-col gap-6 min-h-full pb-24 md:pb-6 px-4 sm:px-8 lg:px-10 pt-4">
      {/* 3 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500">ศิลปินในระบบทั้งหมด</span>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">{totalArtists} ท่าน</p>
            <div className="text-xs text-slate-400 mt-0.5">ครอบคลุมทุกค่ายและแฟนด้อม</div>
          </div>
          <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-purple-700">ยอดเงินซัพพอร์ตศิลปินสะสม</span>
            <p className="text-2xl sm:text-3xl font-black text-purple-700 mt-1">฿{totalSupportAll.toLocaleString()}</p>
            <div className="text-xs text-purple-600 mt-0.5">ส่งต่อศิลปิน 100% เต็ม</div>
          </div>
          <div className="p-3 rounded-2xl bg-purple-50 text-purple-600">
            <Gift className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-emerald-700">จำนวนงาน</span>
            <p className="text-2xl sm:text-3xl font-black text-emerald-700 mt-1">{totalJobsAll} งาน</p>
            <div className="text-xs text-emerald-600 mt-0.5">Backdrop, ช่อถือ, ช่อขาตั้ง</div>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Search & Agency Filter Toolbar */}
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
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="ค้นหาชื่อศิลปิน, ค่ายสังกัด, ชื่อแฟนด้อม, หรือข้อมูลประวัติ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 font-medium"
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
            {/* Agency Dropdown */}
            <div className="relative w-44 sm:w-56 shrink-0">
              <select
                value={selectedAgency}
                onChange={(e) => setSelectedAgency(e.target.value)}
                className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 appearance-none cursor-pointer shadow-2xs transition-colors"
              >
                <option value="all">ทุกสังกัด / ค่าย ({artistDirectory.length})</option>
                {agencies.map(ag => (
                  <option key={ag} value={ag}>{ag}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Reset Button */}
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedAgency('all');
              }}
              className="h-10 w-10 bg-slate-50 border border-slate-200/70 text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 rounded-xl font-bold transition-all flex items-center justify-center shrink-0 active:scale-95 cursor-pointer shadow-2xs"
              title="ล้างค่าตัวกรองทั้งหมด"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3.5 px-5">อันดับ / ศิลปิน</th>
                <th className="py-3.5 px-4">สังกัด / ค่าย</th>
                <th className="py-3.5 px-4">แฟนด้อม & สีประจำตัว</th>
                <th className="py-3.5 px-4">วันเกิด / อายุ</th>
                <th className="py-3.5 px-4 text-center">จำนวนงาน</th>
                <th className="py-3.5 px-4 text-right">เงินซัพพอร์ตสะสม</th>
                <th className="py-3.5 px-4">ประวัติย่อ / ความชอบ</th>
                <th className="py-3.5 px-5 text-right">จัดการ & ประวัติ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredArtists.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    ไม่พบข้อมูลศิลปินที่ตรงกับการค้นหา
                  </td>
                </tr>
              ) : (
                filteredArtists.map((artist, idx) => {
                  const age = getAge(artist.birth_date);

                  return (
                    <tr
                      key={artist.name}
                      className="hover:bg-slate-50/60 transition-colors group cursor-pointer"
                      onClick={() => handleOpenDetailModal(artist)}
                    >
                      <td className="py-3.5 px-5 font-bold text-slate-900">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                            idx === 0 ? 'bg-amber-100 text-amber-800 ring-2 ring-amber-300' :
                            idx === 1 ? 'bg-slate-100 text-slate-700 ring-2 ring-slate-300' :
                            idx === 2 ? 'bg-orange-100 text-orange-800 ring-2 ring-orange-300' :
                            'bg-purple-50 text-purple-700'
                          }`}>
                            {idx < 3 ? <Trophy className="w-4 h-4" /> : `#${idx + 1}`}
                          </div>

                          {artist.avatar_url ? (
                            <img
                              src={artist.avatar_url}
                              alt={artist.name}
                              className="w-9 h-9 rounded-full object-cover border border-slate-200"
                            />
                          ) : (
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-xs"
                              style={{ backgroundColor: artist.fandom_color || '#ec4899' }}
                            >
                              {artist.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}

                          <div>
                            <div className="font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
                              {artist.name}
                            </div>
                            {artist.fandom_name && (
                              <div className="text-xs text-slate-400 font-normal">
                                แฟนคลับ: {artist.fandom_name}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-xs font-semibold text-slate-600">
                        {artist.agency ? (
                          <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-bold">
                            {artist.agency}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs">
                        {artist.fandom_color ? (
                          <div className="flex items-center gap-1.5 font-medium">
                            <span
                              className="w-3.5 h-3.5 rounded-full inline-block border border-white shadow-xs"
                              style={{ backgroundColor: artist.fandom_color }}
                            />
                            <span className="text-slate-700">{artist.fandom_name || 'แฟนคลับ'}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        {artist.birth_date ? (
                          <div className="flex items-center gap-1">
                            <Cake className="w-3.5 h-3.5 text-pink-500" />
                            <span>{artist.birth_date}</span>
                            {age !== null && <span className="text-slate-400">({age} ปี)</span>}
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-black text-xs border border-emerald-200">
                          {artist.projectCount} งาน
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-black text-purple-700">
                        ฿{artist.totalSupport.toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-500 max-w-xs truncate">
                        {artist.bio || artist.favorite_flowers || '-'}
                      </td>

                      <td className="py-3.5 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleOpenDetailModal(artist)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                            title="ดูประวัติและข้อมูลเต็ม"
                          >
                            <Info className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenCreateModal(artist)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="แก้ไขข้อมูลศิลปิน"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onFilterByArtist && onFilterByArtist(artist.name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="ดูกิจกรรมงานทั้งหมด"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                          {artist.id && (
                            <button
                              onClick={() => handleDeleteClick(artist)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="ลบข้อมูลศิลปิน"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
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
        {filteredArtists.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-100 text-center text-slate-400">
            ไม่พบข้อมูลศิลปิน
          </div>
        ) : (
          filteredArtists.map((artist, idx) => (
            <div
              key={artist.name}
              className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3 cursor-pointer"
              onClick={() => handleOpenDetailModal(artist)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-xs shrink-0"
                    style={{ backgroundColor: artist.fandom_color || '#ec4899' }}
                  >
                    {artist.avatar_url ? (
                      <img src={artist.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      artist.name.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{artist.name}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                      {artist.agency && <span className="font-semibold text-slate-700">{artist.agency}</span>}
                      {artist.fandom_name && <span className="text-pink-600 font-medium">({artist.fandom_name})</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleOpenCreateModal(artist)}
                    className="p-1.5 text-slate-400 hover:text-purple-600"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onFilterByArtist && onFilterByArtist(artist.name)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                  {artist.id && (
                    <button
                      onClick={() => handleDeleteClick(artist)}
                      className="p-1.5 text-slate-400 hover:text-rose-600"
                      title="ลบข้อมูลศิลปิน"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Bio & Details Snippet */}
              {artist.bio && (
                <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50 p-2 rounded-xl">
                  {artist.bio}
                </p>
              )}

              {/* Financial & Job count */}
              <div className="bg-slate-50 p-2.5 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-600 text-xs font-bold block">เงินซัพพอร์ตสะสม</span>
                  <span className="font-black text-purple-700">฿{artist.totalSupport.toLocaleString()}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-600 text-xs font-bold block">จำนวนงาน</span>
                  <span className="font-black text-slate-900">{artist.projectCount} งาน</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* CREATE / EDIT ARTIST MODAL */}
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
                <div className="p-2.5 sm:p-3 bg-purple-50 text-purple-600 rounded-xl sm:rounded-2xl shrink-0">
                  <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                      {editingArtist ? 'แก้ไขข้อมูลศิลปิน' : 'เพิ่มข้อมูลศิลปินใหม่'}
                    </h3>
                    {editingArtist?.name && (
                      <span className="bg-purple-50 text-purple-600 text-xs sm:text-xs px-2.5 py-0.5 sm:py-1 rounded-lg font-bold border border-purple-100 w-fit">
                        {editingArtist.name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">
                    บันทึกประวัติ สังกัด แฟนด้อม สีประจำตัว และช่องทางติดต่อโซเชียล
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
            <form onSubmit={handleSubmit(onSubmitArtist)} className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 sm:p-8 custom-scrollbar space-y-6 overscroll-contain">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">ชื่อศิลปิน *</label>
                    <input
                      type="text"
                      placeholder="เช่น Nunew Chawarin, Zee Pruk"
                      {...register('name')}
                      className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm font-bold focus:bg-white focus:outline-none focus:ring-2 transition ${
                        errors.name ? 'border-rose-300 focus:ring-rose-500/20 focus:border-rose-500' : 'border-slate-200 focus:ring-purple-500/20 focus:border-purple-500'
                      }`}
                    />
                    {errors.name && (
                      <p className="text-xs text-rose-600 font-bold mt-1">{errors.name.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">สังกัด / ค่ายเพลง (Agency)</label>
                    <input
                      type="text"
                      placeholder="เช่น Domundi, GMMTV, BEC"
                      {...register('agency')}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">ชื่อกลุ่มแฟนคลับ (Fandom Name)</label>
                    <input
                      type="text"
                      placeholder="เช่น นานุ, ซอนมุล"
                      {...register('fandom_name')}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">สีประจำตัว / สีแฟนด้อม (Hex / Color)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={watchedFandomColor}
                        onChange={(e) => setValue('fandom_color', e.target.value)}
                        className="w-10 h-10 p-0.5 rounded-xl border border-slate-200 cursor-pointer"
                      />
                      <input
                        type="text"
                        placeholder="#EC4899"
                        {...register('fandom_color')}
                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">วันเกิด (Birthday)</label>
                    <Controller
                      control={control}
                      name="birth_date"
                      render={({ field }) => (
                        <ModernDateTimePicker
                          value={field.value}
                          onChange={field.onChange}
                          hasTime={false}
                          placeholder="เลือกวันเกิด..."
                          className="w-full bg-slate-50 border-slate-200"
                        />
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-purple-600" />
                        รูปโปรไฟล์ศิลปิน
                      </span>
                      {isUploadingAvatar && (
                        <span className="text-xs font-medium text-purple-600 flex items-center gap-1 animate-pulse">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          กำลังอัปโหลด Google Drive...
                        </span>
                      )}
                    </label>

                    <div className="flex items-center gap-3 p-2 bg-slate-50/90 rounded-2xl border border-slate-200/90 shadow-2xs">
                      {/* Avatar Preview Box (Clickable & Droppable) */}
                      <div
                        onClick={() => !isUploadingAvatar && fileInputRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (e.dataTransfer.files?.[0]) handleUploadAvatarFile(e.dataTransfer.files[0]);
                        }}
                        className="relative w-14 h-14 rounded-2xl shrink-0 cursor-pointer overflow-hidden border-2 border-purple-200 hover:border-purple-400 group transition-all shadow-xs flex items-center justify-center bg-white"
                        style={{ backgroundColor: watchedAvatarUrl ? 'transparent' : (watchedFandomColor || '#ec4899') }}
                        title="คลิกเพื่อเลือกรูปภาพจากเครื่อง หรือลากไฟล์มาวาง"
                      >
                        {watchedAvatarUrl ? (
                          <img
                            src={watchedAvatarUrl}
                            alt="Avatar"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <span className="font-black text-white text-base">
                            {watchedName ? watchedName.slice(0, 2).toUpperCase() : <User className="w-5 h-5 text-white" />}
                          </span>
                        )}
                        <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs font-bold gap-0.5">
                          <UploadCloud className="w-3.5 h-3.5" />
                          <span>เปลี่ยน</span>
                        </div>
                        {isUploadingAvatar && (
                          <div className="absolute inset-0 bg-purple-900/60 backdrop-blur-xs flex items-center justify-center text-white">
                            <Loader2 className="w-5 h-5 animate-spin" />
                          </div>
                        )}
                      </div>

                      {/* Info & Action Buttons */}
                      <div className="flex-1 min-w-0">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) handleUploadAvatarFile(e.target.files[0]);
                          }}
                          disabled={isUploadingAvatar}
                        />

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploadingAvatar}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer disabled:opacity-50"
                          >
                            <UploadCloud className="w-3.5 h-3.5" />
                            {watchedAvatarUrl ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}
                          </button>

                          {watchedAvatarUrl && (
                            <button
                              type="button"
                              onClick={() => setValue('avatar_url', '')}
                              disabled={isUploadingAvatar}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                              title="ลบรูปโปรไฟล์"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              ลบ
                            </button>
                          )}
                        </div>

                        <p className="text-xs text-slate-500 mt-1 truncate">
                          เก็บบน Google Drive (Assets) • JPG, PNG
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ประวัติโดยย่อ / ข้อมูลสำคัญ (Bio)</label>
                  <textarea
                    rows="3"
                    placeholder="เขียนประวัติ ผลงานเด่น วันสำคัญ หรือข้อควรระวังในการจัดดอกไม้..."
                    {...register('bio')}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition"
                  ></textarea>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">ดอกไม้ที่ชอบ / โทนที่ชอบ</label>
                    <input
                      type="text"
                      placeholder="เช่น ดอกทิวลิปขาว, กุหลาบพาสเทล"
                      {...register('favorite_flowers')}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">X (Twitter) / IG Account</label>
                    <input
                      type="text"
                      placeholder="@artist_account"
                      {...register('social_links.twitter')}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition"
                    />
                  </div>
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
                  className="py-3 px-7 sm:px-8 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-purple-200 hover:shadow-purple-300 hover:-translate-y-0.5 hover:scale-[1.01] transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูลศิลปิน'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ARTIST DOSSIER / FULL DETAIL MODAL */}
      {isDetailModalOpen && selectedArtistForDetail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md backdrop-animate-in"
            onClick={() => setIsDetailModalOpen(false)}
          />

          <div
            className="bg-white w-full max-w-2xl sm:rounded-[2.5rem] rounded-2xl shadow-2xl relative z-10 border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] modal-animate-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header (Sticky) */}
            <div className="px-5 py-4 sm:px-8 sm:py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-20 shrink-0">
              <div className="flex items-center gap-3.5">
                <div
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-white text-lg sm:text-xl font-black shadow-sm overflow-hidden shrink-0 border border-slate-200"
                  style={{
                    backgroundColor: selectedArtistForDetail.fandom_color || '#8b5cf6'
                  }}
                >
                  {selectedArtistForDetail.avatar_url ? (
                    <img
                      src={selectedArtistForDetail.avatar_url}
                      alt={selectedArtistForDetail.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    selectedArtistForDetail.name.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                      {selectedArtistForDetail.name}
                    </h3>
                    {selectedArtistForDetail.fandom_name && (
                      <span className="bg-purple-50 text-purple-600 text-xs sm:text-xs px-2.5 py-0.5 rounded-lg font-bold border border-purple-100 w-fit">
                        แฟนด้อม: {selectedArtistForDetail.fandom_name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium flex items-center gap-2 mt-0.5">
                    <span className="font-bold text-slate-700">{selectedArtistForDetail.agency || 'ศิลปินอิสระ'}</span>
                    {selectedArtistForDetail.birth_date && (
                      <>
                        <span>•</span>
                        <span>เกิด {selectedArtistForDetail.birth_date}</span>
                      </>
                    )}
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

            {/* Dossier Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-8 custom-scrollbar space-y-6 overscroll-contain">
              {/* Financial & Job Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-slate-100">
                  <span className="text-slate-600 text-xs font-bold block font-bold">ยอดเงินซัพพอร์ตสะสม</span>
                  <p className="text-lg sm:text-xl font-black text-purple-700 mt-1">
                    ฿{selectedArtistForDetail.totalSupport.toLocaleString()}
                  </p>
                </div>
                <div className="bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-slate-100">
                  <span className="text-slate-600 text-xs font-bold block font-bold">จำนวนงานที่จัดดอกไม้</span>
                  <p className="text-lg sm:text-xl font-black text-emerald-700 mt-1">
                    {selectedArtistForDetail.projectCount} งาน
                  </p>
                </div>
                <div className="bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-slate-100 col-span-2 sm:col-span-1">
                  <span className="text-slate-600 text-xs font-bold block font-bold">วันเกิด / อายุ</span>
                  <p className="text-sm font-bold text-slate-800 mt-1">
                    {selectedArtistForDetail.birth_date || 'ไม่ระบุ'}
                    {getAge(selectedArtistForDetail.birth_date) !== null && ` (${getAge(selectedArtistForDetail.birth_date)} ปี)`}
                  </p>
                </div>
              </div>

              {/* Bio & History */}
              {selectedArtistForDetail.bio ? (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    ประวัติและข้อมูลสำคัญ
                  </h4>
                  <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100 text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                    {selectedArtistForDetail.bio}
                  </div>
                </div>
              ) : null}

              {/* Preferences & Flowers */}
              {selectedArtistForDetail.favorite_flowers && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    ดอกไม้และสไตล์ที่ชอบ
                  </h4>
                  <div className="bg-pink-50/60 p-4 rounded-2xl border border-pink-100 text-xs sm:text-sm font-medium text-pink-900 flex items-center gap-2">
                    <span className="text-base">🌸</span>
                    <span>{selectedArtistForDetail.favorite_flowers}</span>
                  </div>
                </div>
              )}

              {/* Recent Sample Projects */}
              {selectedArtistForDetail.sampleProjects?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                    ประวัติงานล่าสุด
                  </h4>
                  <div className="space-y-2">
                    {selectedArtistForDetail.sampleProjects.map((p, i) => (
                      <div
                        key={p.id || i}
                        onClick={() => {
                          setIsDetailModalOpen(false);
                          if (onOpenProjectModal) onOpenProjectModal(p.id);
                        }}
                        className="p-3.5 rounded-2xl bg-slate-50 hover:bg-purple-50/60 border border-slate-100 hover:border-purple-200 transition-colors flex items-center justify-between text-xs cursor-pointer group"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded-lg">
                            {p.id}
                          </span>
                          <span className="font-bold text-slate-800 group-hover:text-purple-700 transition-colors">
                            {p.name || 'งานจัดดอกไม้'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 font-medium">{p.deliveryDate || p.date || ''}</span>
                          <ExternalLink className="w-3.5 h-3.5 text-purple-600" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Actions Sticky Footer */}
            <div className="px-5 py-4 sm:px-8 sm:py-5 border-t border-slate-100 bg-white/95 backdrop-blur-xl sticky bottom-0 z-30 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsDetailModalOpen(false);
                  handleOpenCreateModal(selectedArtistForDetail);
                }}
                className="py-3 px-5 sm:px-6 rounded-2xl text-slate-700 bg-slate-100/80 hover:bg-slate-200 font-bold text-sm transition-all active:scale-95 cursor-pointer flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                <span>แก้ไขข้อมูล</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsDetailModalOpen(false);
                  if (onFilterByArtist) onFilterByArtist(selectedArtistForDetail.name);
                }}
                className="py-3 px-6 sm:px-8 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-purple-200 hover:shadow-purple-300 hover:-translate-y-0.5 hover:scale-[1.01] transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
              >
                <span>ดูกิจกรรมงานของ {selectedArtistForDetail.name}</span>
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="ยืนยันการลบข้อมูลศิลปิน"
        message={`ต้องการลบข้อมูลศิลปิน "${deleteConfirm.artistName}" ออกจากระบบอย่างถาวรหรือไม่? การกระทำนี้ไม่สามารถย้อนคืนได้`}
        confirmText="ยืนยันลบศิลปิน"
        cancelText="ยกเลิก"
        type="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, artistId: null, artistName: '' })}
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

export default React.memo(Artists);
