import React, { useState } from 'react';
import { 
  X, 
  MapPin, 
  Navigation, 
  Truck, 
  Phone, 
  ShieldAlert, 
  Info, 
  Edit3, 
  Save, 
  ExternalLink,
  Building2,
  Check
} from 'lucide-react';
import { saveLocationSync } from '../../services/syncService';
import Toast from '../common/Toast';

export default function VenueDetailModal({ isOpen, onClose, venue, onUpdateVenue }) {
  if (!isOpen || !venue) return null;

  const [isEditing, setIsEditing] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [formData, setFormData] = useState({
    name: venue.name || '',
    zone: venue.zone || 'ทั่วไป',
    default_map_link: venue.default_map_link || '',
    loading_dock_map_link: venue.loading_dock_map_link || '',
    gate_info: venue.gate_info || '',
    parking_height_limit: venue.parking_height_limit || '',
    dock_contact_phone: venue.dock_contact_phone || '',
    delivery_tips: venue.delivery_tips || ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Keyboard shortcut: close modal on Escape
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isEditing) setIsEditing(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, onClose]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        ...venue,
        ...formData,
        updated_at: new Date().toISOString()
      };
      await saveLocationSync(payload);
      if (onUpdateVenue) onUpdateVenue(payload);
      setIsEditing(false);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error('Save venue error:', err);
      setToast({ show: true, message: 'ไม่สามารถบันทึกข้อมูลสถานที่ได้: ' + err.message, type: 'error' });
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

      <div 
        className="bg-white w-full max-w-2xl sm:rounded-[2.5rem] rounded-2xl shadow-2xl relative z-10 overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] modal-animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 sm:px-8 sm:py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 sm:p-3 bg-indigo-50 text-indigo-600 rounded-xl sm:rounded-2xl shrink-0">
              <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  {formData.name || venue.name}
                </h3>
                {formData.zone && (
                  <span className="bg-indigo-50 text-indigo-600 text-xs sm:text-xs px-2.5 py-0.5 sm:py-1 rounded-lg font-bold border border-indigo-100 w-fit">
                    {formData.zone}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                ลายแทงสถานที่จัดส่ง จุดเทียบของ และข้อควรระวังหน้างาน
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-colors active:scale-95 cursor-pointer"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8 custom-scrollbar space-y-5 overscroll-contain">
          {savedSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>บันทึกการอัปเดตลายแทงสถานที่เรียบร้อยแล้ว</span>
            </div>
          )}

          {!isEditing ? (
            <>
              {/* Dual-Pin Navigation Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {formData.loading_dock_map_link ? (
                  <a
                    href={formData.loading_dock_map_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-600 active:scale-98 text-white rounded-2xl font-bold text-xs shadow-md shadow-amber-200 transition"
                  >
                    <Truck className="w-4 h-4" />
                    <span>นำทางจุดโหลดของจริง</span>
                    <ExternalLink className="w-3 h-3 opacity-80" />
                  </a>
                ) : (
                  <div className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-400 rounded-2xl text-xs font-medium">
                    <Truck className="w-4 h-4" />
                    <span>ไม่มีพิกัดจุดโหลดของ</span>
                  </div>
                )}

                {formData.default_map_link ? (
                  <a
                    href={formData.default_map_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 active:scale-98 rounded-2xl font-bold text-xs border border-indigo-200 transition"
                  >
                    <MapPin className="w-4 h-4 text-indigo-600" />
                    <span>พิกัดหน้าห้าง/นัดลูกค้า</span>
                    <ExternalLink className="w-3 h-3 text-indigo-400" />
                  </a>
                ) : null}
              </div>

              {/* Gate & Dock Details */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-sky-100 text-sky-600 shrink-0 mt-0.5">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">ประตู & จุดเทียบรถขนของ</h4>
                    <p className="text-sm font-semibold text-slate-800 mt-0.5">
                      {formData.gate_info || 'ยังไม่ได้ระบุประตู (กดปุ่มแก้ไขด้านล่างเพื่อเพิ่ม)'}
                    </p>
                  </div>
                </div>

                {formData.parking_height_limit && (
                  <div className="flex items-start gap-3 pt-2 border-t border-slate-200/60">
                    <div className="p-2 rounded-xl bg-amber-100 text-amber-600 shrink-0 mt-0.5">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">จำกัดความสูงรถ</h4>
                      <p className="text-sm font-semibold text-slate-800 mt-0.5">
                        {formData.parking_height_limit}
                      </p>
                    </div>
                  </div>
                )}

                {formData.dock_contact_phone && (
                  <div className="flex items-start gap-3 pt-2 border-t border-slate-200/60">
                    <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600 shrink-0 mt-0.5">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">เบอร์โทร รปภ./จุดโหลดของ</h4>
                      <a 
                        href={`tel:${formData.dock_contact_phone}`}
                        className="text-sm font-bold text-emerald-600 hover:underline mt-0.5 inline-block"
                      >
                        {formData.dock_contact_phone} (กดเพื่อโทรออก)
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Delivery Tips & Gate Pass Rules */}
              <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-100 space-y-2">
                <div className="flex items-center gap-2 text-amber-800 font-bold text-xs">
                  <Info className="w-4 h-4 text-amber-600" />
                  <span>กฎการเข้าตึก / เคล็ดลับหน้างาน</span>
                </div>
                <p className="text-xs text-amber-900 leading-relaxed font-medium">
                  {formData.delivery_tips || 'ไม่มีบันทึกข้อควรระวังพิเศษ'}
                </p>
              </div>
            </>
          ) : (
            /* Editing Form */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">โซนพื้นที่</label>
                <input 
                  type="text" 
                  value={formData.zone}
                  onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                  placeholder="เช่น นนทบุรี-เมืองทอง, สยาม-ปทุมวัน"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">พิกัดจุดโหลดของจริง (Google Maps)</label>
                <input 
                  type="text" 
                  value={formData.loading_dock_map_link}
                  onChange={(e) => setFormData({ ...formData, loading_dock_map_link: e.target.value })}
                  placeholder="https://maps.app.goo.gl/..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">พิกัดหน้าห้าง / นัดลูกค้า (Google Maps)</label>
                <input 
                  type="text" 
                  value={formData.default_map_link}
                  onChange={(e) => setFormData({ ...formData, default_map_link: e.target.value })}
                  placeholder="https://maps.app.goo.gl/..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">ประตู & ลิฟต์ขนของ</label>
                <textarea 
                  rows={2}
                  value={formData.gate_info}
                  onChange={(e) => setFormData({ ...formData, gate_info: e.target.value })}
                  placeholder="เช่น เข้าทางถนนพระราม 1 ลานจอด B1 ประตูโหลด 3 ลิฟต์ Service C"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">จำกัดความสูงรถ</label>
                  <input 
                    type="text" 
                    value={formData.parking_height_limit}
                    onChange={(e) => setFormData({ ...formData, parking_height_limit: e.target.value })}
                    placeholder="เช่น ไม่เกิน 2.10 เมตร"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">เบอร์โทร รปภ./จุดโหลด</label>
                  <input 
                    type="text" 
                    value={formData.dock_contact_phone}
                    onChange={(e) => setFormData({ ...formData, dock_contact_phone: e.target.value })}
                    placeholder="02-xxx-xxxx"
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">กฎแลกบัตร / ข้อควรระวังหน้างาน</label>
                <textarea 
                  rows={2}
                  value={formData.delivery_tips}
                  onChange={(e) => setFormData({ ...formData, delivery_tips: e.target.value })}
                  placeholder="เช่น ต้องแลกบัตรชั้น B1, ห้ามสวมรองเท้าแตะ"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 sm:px-8 sm:py-5 border-t border-slate-100 bg-white/95 backdrop-blur-xl sticky bottom-0 z-30 flex items-center justify-between gap-3 shrink-0">
          {!isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="py-3 px-5 sm:px-6 rounded-2xl text-slate-700 bg-slate-100/80 hover:bg-slate-200 font-bold text-sm transition-all active:scale-95 cursor-pointer flex items-center gap-2"
              >
                <Edit3 className="w-4 h-4" />
                <span>แก้ไขลายแทงสถานที่</span>
              </button>
              <button
                onClick={onClose}
                className="py-3 px-7 sm:px-8 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-0.5 hover:scale-[1.01] transition-all duration-300 active:scale-95 cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className="py-3 px-5 sm:px-6 rounded-2xl text-slate-600 bg-slate-100/80 hover:bg-slate-200 font-bold text-sm transition-all active:scale-95 cursor-pointer"
                disabled={isSaving}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="py-3 px-7 sm:px-8 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-0.5 hover:scale-[1.01] transition-all duration-300 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกลายแทง'}</span>
              </button>
            </>
          )}
        </div>
      </div>

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
