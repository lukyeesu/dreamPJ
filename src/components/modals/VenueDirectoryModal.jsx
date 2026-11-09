import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  MapPin, 
  Navigation, 
  Truck, 
  Plus, 
  Phone, 
  Building2, 
  ShieldAlert, 
  ExternalLink 
} from 'lucide-react';

export default function VenueDirectoryModal({ 
  isOpen, 
  onClose, 
  venues = [], 
  onSelectVenue 
}) {
  if (!isOpen) return null;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState('all');

  // Keyboard shortcut: close modal on Escape
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Extract unique zones
  const zones = useMemo(() => {
    const set = new Set();
    venues.forEach(v => {
      if (v.zone && v.zone.trim()) set.add(v.zone.trim());
    });
    return Array.from(set).sort();
  }, [venues]);

  // Filtered venues
  const filteredVenues = useMemo(() => {
    return venues.filter(v => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || 
        (v.name && v.name.toLowerCase().includes(q)) ||
        (Array.isArray(v.aliases) && v.aliases.some(a => a.toLowerCase().includes(q))) ||
        (v.zone && v.zone.toLowerCase().includes(q));

      const matchZone = selectedZone === 'all' || v.zone === selectedZone;

      return matchSearch && matchZone;
    });
  }, [venues, searchQuery, selectedZone]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-md backdrop-animate-in"
        onClick={onClose}
      />

      <div 
        className="bg-white w-full max-w-4xl sm:rounded-[2.5rem] rounded-2xl shadow-2xl relative z-10 overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] modal-animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 sm:px-8 sm:py-6 border-b border-slate-100 bg-white sticky top-0 z-20 shrink-0 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 sm:p-3 bg-indigo-50 text-indigo-600 rounded-xl sm:rounded-2xl shrink-0">
                <Truck className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                    คลังลายแทงสถานที่จัดส่ง
                  </h3>
                  <span className="bg-indigo-50 text-indigo-600 text-xs sm:text-xs px-2.5 py-0.5 sm:py-1 rounded-lg font-bold border border-indigo-100 w-fit">
                    Delivery Locations
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  พิกัดจุดโหลดของจริง ประตูเทียบรถ และเคล็ดลับการเข้าตึกสำหรับทีมงาน
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

          {/* Search & Zone Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อสถานที่ หรือคำย่อ เช่น อิมแพ็ค, ctw, พารากอน, ชาเลนเจอร์..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50/70 border border-slate-200 text-slate-900 rounded-xl sm:rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold"
              />
            </div>
            <div className="shrink-0">
              <select
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-50/70 border border-slate-200 text-slate-800 font-bold rounded-xl sm:rounded-2xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
              >
                <option value="all">ทุกโซน ({venues.length})</option>
                {zones.map(z => (
                  <option key={z} value={z}>{z}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Venues Grid */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8 custom-scrollbar space-y-4 overscroll-contain">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold px-1">
            <span>พบทั้งหมด {filteredVenues.length} สถานที่</span>
            {searchQuery && <span className="text-indigo-600">คำค้น: "{searchQuery}"</span>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredVenues.map((venue) => (
              <div
                key={venue.id || venue.name}
                onClick={() => onSelectVenue && onSelectVenue(venue)}
                className="p-5 rounded-3xl bg-slate-50 hover:bg-white border border-slate-100 hover:border-indigo-200 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {venue.zone || 'ทั่วไป'}
                    </span>
                    {venue.dock_contact_phone && (
                      <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {venue.dock_contact_phone}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-black text-slate-900 group-hover:text-indigo-600 transition">
                    {venue.name}
                  </h3>

                  {venue.gate_info && (
                    <p className="text-xs text-slate-600 line-clamp-2">
                      <span className="font-bold text-slate-700">🚪 ประตู: </span>
                      {venue.gate_info}
                    </p>
                  )}

                  {venue.parking_height_limit && (
                    <p className="text-xs text-amber-700 font-medium">
                      <span className="font-bold">⚠️ ความสูงรถ: </span>
                      {venue.parking_height_limit}
                    </p>
                  )}
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-600 group-hover:underline flex items-center gap-1">
                    <span>เปิดลายแทงนำทาง</span>
                    <ExternalLink className="w-3 h-3" />
                  </span>

                  {venue.loading_dock_map_link && (
                    <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                      มีพิกัดจุดโหลดจริง
                    </span>
                  )}
                </div>
              </div>
            ))}

            {filteredVenues.length === 0 && (
              <div className="col-span-2 text-center py-12 text-slate-400">
                <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                <p className="text-sm font-bold">ไม่พบสถานที่ที่ตรงกับคำค้นหา</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 sm:px-8 sm:py-5 border-t border-slate-100 bg-white/95 backdrop-blur-xl sticky bottom-0 z-30 flex items-center justify-between gap-3 shrink-0">
          <p className="text-xs text-slate-500 font-medium hidden sm:block">
            คลิกที่สถานที่ใดก็ได้เพื่อดูพิกัดจุดโหลดของจริงและแก้ไขลายแทง
          </p>
          <button
            onClick={onClose}
            className="py-3 px-7 sm:px-8 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-0.5 hover:scale-[1.01] transition-all duration-300 active:scale-95 cursor-pointer ml-auto"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
