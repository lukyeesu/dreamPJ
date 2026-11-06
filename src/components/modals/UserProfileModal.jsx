import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  User, 
  Camera, 
  Eye, 
  EyeOff, 
  Phone, 
  Mail, 
  MapPin, 
  Shield, 
  KeyRound, 
  AlertCircle,
  Sparkles,
  CreditCard,
  HeartHandshake,
  Calendar,
  Lock
} from 'lucide-react';
import { saveStaffSync } from '../../services/syncService';
import db from '../../services/db';
import ModernDateTimePicker from '../common/ModernDateTimePicker';

export default function UserProfileModal({
  isOpen,
  onClose,
  userProfile,
  onUpdateProfile,
  showToast = () => {},
  handleProfileImageUpload = null
}) {
  const [formData, setFormData] = useState({
    name: '',
    nickname: '',
    username: '',
    phone: '',
    email: '',
    citizen_id: '',
    birth_date: '',
    address: '',
    emergency_contact: '',
    avatar_url: '',
    password: '',
    confirmPassword: ''
  });

  const [staffInfo, setStaffInfo] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load latest staff data from db.staff when modal opens
  useEffect(() => {
    if (!isOpen || !userProfile?.username) return;

    let isMounted = true;
    const fetchStaffData = async () => {
      try {
        const staff = await db.staff.where('username').equalsIgnoreCase(userProfile.username).first();
        if (isMounted) {
          if (staff) {
            setStaffInfo(staff);
            setFormData({
              name: staff.name || userProfile.name || '',
              nickname: staff.nickname || '',
              username: staff.username || userProfile.username || '',
              phone: staff.phone || userProfile.phone || '',
              email: staff.email || userProfile.email || '',
              citizen_id: staff.citizen_id || '',
              birth_date: staff.birth_date || '',
              address: staff.address || '',
              emergency_contact: staff.emergency_contact || '',
              avatar_url: staff.avatar_url || staff.image || userProfile.image || '',
              password: staff.password || '',
              confirmPassword: staff.password || ''
            });
          } else {
            setFormData({
              name: userProfile.name || '',
              nickname: '',
              username: userProfile.username || '',
              phone: userProfile.phone || '',
              email: userProfile.email || '',
              citizen_id: '',
              birth_date: '',
              address: '',
              emergency_contact: '',
              avatar_url: userProfile.image || '',
              password: '',
              confirmPassword: ''
            });
          }
        }
      } catch (err) {
        console.warn('Could not load staff for profile modal:', err);
      }
    };

    fetchStaffData();
    return () => { isMounted = false; };
  }, [isOpen, userProfile]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const staffCode = staffInfo?.id || staffInfo?.staff_code || userProfile?.id || userProfile?.staff_code || '2611001';
  const roleName = staffInfo?.role || userProfile?.role || 'technician';
  const roleLabel = staffInfo?.role_label || (
    roleName === 'admin' ? 'ผู้ดูแลระบบ' :
    roleName === 'technician' ? 'ช่างจัดดอกไม้' :
    roleName === 'driver' ? 'พนักงานจัดส่ง' : 'ฝ่ายบัญชีและการเงิน'
  );

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!formData.name.trim()) {
      showToast('กรุณาระบุชื่อ-นามสกุล', 'error');
      return;
    }

    if (formData.password && formData.password !== formData.confirmPassword) {
      showToast('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        id: staffCode,
        username: formData.username || userProfile.username,
        password: formData.password || staffInfo?.password || '1',
        name: formData.name.trim(),
        nickname: formData.nickname.trim(),
        role: roleName,
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        citizen_id: formData.citizen_id.trim(),
        birth_date: formData.birth_date || null,
        address: formData.address.trim(),
        emergency_contact: formData.emergency_contact.trim(),
        avatar_url: formData.avatar_url.trim(),
        image: formData.avatar_url.trim(),
        is_active: staffInfo?.is_active !== undefined ? staffInfo.is_active : true
      };

      const saved = await saveStaffSync(payload);

      // Update local storage and app state
      const updatedProfile = {
        ...userProfile,
        id: staffCode,
        staff_code: staffCode,
        name: payload.name,
        nickname: payload.nickname,
        phone: payload.phone,
        email: payload.email,
        citizen_id: payload.citizen_id,
        birth_date: payload.birth_date,
        address: payload.address,
        emergency_contact: payload.emergency_contact,
        image: payload.avatar_url || payload.image,
        avatar_url: payload.avatar_url || payload.image,
        role: roleName,
        role_label: roleLabel
      };

      localStorage.setItem('nexus_profile', JSON.stringify(updatedProfile));
      if (onUpdateProfile) onUpdateProfile(updatedProfile);

      showToast('บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว', 'success');
      onClose();
    } catch (err) {
      console.error('Error saving profile:', err);
      showToast('เกิดข้อผิดพลาดในการบันทึกโปรไฟล์', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-md backdrop-animate-in"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="bg-white w-full max-w-2xl sm:rounded-[2.5rem] rounded-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] relative z-10 modal-animate-in">
        
        {/* Sticky Header */}
        <div className="px-5 py-4 sm:px-8 sm:py-5 border-b border-slate-100 bg-white sticky top-0 z-20 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 sm:p-3 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl shadow-md shadow-indigo-200">
              <User className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  โปรไฟล์ของฉัน
                </h3>
                <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg">
                  {staffCode}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                ดูและจัดการข้อมูลส่วนตัว ข้อมูลติดต่อ และรหัสผ่านของคุณ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-colors cursor-pointer active:scale-95"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Form Body (Scrollable) */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 sm:p-8 custom-scrollbar space-y-6 overscroll-contain">
            
            {/* Top Identity Card */}
            <div className="p-4 bg-gradient-to-br from-indigo-50/70 via-slate-50 to-purple-50/40 rounded-2xl border border-indigo-100/70 flex flex-col sm:flex-row items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center shrink-0 overflow-hidden ring-4 ring-white shadow-lg text-2xl relative group">
                {formData.avatar_url ? (
                  <img
                    src={formData.avatar_url}
                    alt={formData.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  formData.name ? formData.name.charAt(0).toUpperCase() : 'U'
                )}

                <label className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white" title="คลิกเพื่อเปลี่ยนรูปถ่าย">
                  <Camera className="w-5 h-5 text-white" />
                  <span className="text-[9px] font-bold mt-0.5">เปลี่ยนรูป</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0];
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          setFormData(prev => ({ ...prev, avatar_url: event.target.result }));
                        };
                        reader.readAsDataURL(file);
                        if (handleProfileImageUpload) {
                          handleProfileImageUpload(file);
                        }
                      }
                    }}
                  />
                </label>
              </div>

              <div className="flex-1 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
                  <h4 className="text-base sm:text-lg font-black text-slate-900">
                    {formData.name || 'พนักงาน'}
                  </h4>
                  {formData.nickname && (
                    <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-lg font-bold w-fit mx-auto sm:mx-0">
                      {formData.nickname}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1.5 text-xs text-slate-500 font-medium">
                  <span className="font-mono text-indigo-600 font-bold bg-white px-2 py-0.5 rounded border border-indigo-100">
                    ID: {staffCode}
                  </span>
                  <span>•</span>
                  <span>@{formData.username || userProfile.username}</span>
                  <span>•</span>
                  <span className="bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded border border-emerald-100">
                    {roleLabel}
                  </span>
                </div>

                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-indigo-700 hover:bg-indigo-50 border border-indigo-200 text-xs font-bold transition shadow-2xs cursor-pointer mt-2.5">
                  <Camera className="w-3.5 h-3.5 text-indigo-600" />
                  <span>เปลี่ยนรูปถ่ายโปรไฟล์</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0];
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          setFormData(prev => ({ ...prev, avatar_url: event.target.result }));
                        };
                        reader.readAsDataURL(file);
                        if (handleProfileImageUpload) {
                          handleProfileImageUpload(file);
                        }
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Row 1: Full Name & Nickname */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ชื่อ-นามสกุลจริง *
                </label>
                <input
                  type="text"
                  required
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

            {/* Row 2: Citizen ID & Birth Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-indigo-500" />
                    <span>เลขประจำตัวประชาชน (13 หลัก)</span>
                  </span>
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
                  onChange={(val) => setFormData({ ...formData, birth_date: val })}
                  placeholder="เลือกวันเดือนปีเกิด"
                  hasTime={false}
                />
              </div>
            </div>

            {/* Row 3: Phone & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-500" />
                  <span>เบอร์โทรศัพท์ติดต่อ</span>
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="เช่น 081-234-5678"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-purple-500" />
                  <span>อีเมล</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="เช่น staff@flower2u.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                />
              </div>
            </div>

            {/* Row 4: Emergency Contact */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <HeartHandshake className="w-3.5 h-3.5 text-rose-500" />
                <span>ผู้ติดต่อฉุกเฉิน (ชื่อ &amp; เบอร์โทร)</span>
              </label>
              <input
                type="text"
                value={formData.emergency_contact}
                onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                placeholder="เช่น คุณแม่ 089-999-9999"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
            </div>

            {/* Row 4: Address */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-500" />
                <span>ที่อยู่ปัจจุบัน / ที่อยู่ตามบัตรประชาชน</span>
              </label>
              <textarea
                rows={2}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="เช่น 123/45 ถนน... แขวง... เขต... จังหวัด..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
            </div>

            {/* Security / Password Section */}
            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3.5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Lock className="w-4 h-4 text-indigo-600" />
                <span>เปลี่ยนรหัสผ่านบัญชีของคุณ</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    รหัสผ่านใหม่
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="กำหนดรหัสผ่านใหม่"
                      className="w-full pl-3.5 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-bold font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
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
                  <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center justify-between">
                    <span>ยืนยันรหัสผ่านใหม่</span>
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
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      placeholder="กรอกรหัสผ่านซ้ำอีกรอบ"
                      className={`w-full pl-3.5 pr-10 py-2.5 bg-white border rounded-xl text-xs sm:text-sm font-bold font-mono focus:outline-none focus:ring-2 transition ${
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
            </div>

          </div>

          {/* Sticky Footer */}
          <div className="px-5 py-4 sm:px-8 sm:py-5 border-t border-slate-100 bg-white/95 backdrop-blur-xl sticky bottom-0 z-30 flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
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
              <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูลโปรไฟล์'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
