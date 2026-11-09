import React, { useState, useMemo } from 'react';
import { Truck, ArrowRight, X, Clock, MapPin, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * ตรวจสอบว่าโปรเจกต์นี้ "เสร็จแล้วหรือยัง" (Finished / Delivered / Completed / Cancelled)
 * @returns {boolean} true ถ้างานเสร็จแล้ว หรือยกเลิกแล้ว (ไม่ต้องเตือน)
 */
export function isProjectFinishedOrCancelled(item, dealStatuses = [], transportStatuses = []) {
  if (!item) return true;

  // 1. ตรวจสอบค่า String มาตรฐานและ Custom ID ตรงๆ
  const tVal = String(item.transportStatus || '').trim().toLowerCase();
  const dVal = String(item.dealStatus || '').trim().toLowerCase();

  // สถานะขนส่งที่เสร็จแล้ว (Delivered / Finished / Completed)
  if (
    tVal === 'delivered' || 
    tVal === 'completed' || 
    tVal === 'finished' || 
    tVal === 'done' || 
    tVal === 'success' ||
    tVal === 'custom-1771415278809' // "ส่งสำเร็จ" จากระบบเดิม
  ) {
    return true;
  }

  // สถานะดีลงานที่เสร็จสิ้น (Deal Completed)
  if (
    dVal === 'completed' || 
    dVal === 'finished' || 
    dVal === 'closed' || 
    dVal === 'done' ||
    dVal === 'custom-1771415025673' // "เสร็จสิ้น" จากระบบเดิม
  ) {
    return true;
  }

  // สถานะยกเลิก / ปฏิเสธ / มีปัญหา (Cancelled / Declined / Issue)
  if (
    dVal === 'cancelled' || 
    dVal === 'declined' || 
    dVal === 'custom-1771415176073' || // "ลูกค้าปฏิเสธ"
    dVal === 'custom-1771415255785' || // "ยกเลิก/มีปัญหา"
    tVal === 'cancelled' || 
    tVal === 'issue' || 
    tVal === 'custom-1771415352872'    // "ยกเลิกการส่ง"
  ) {
    return true;
  }

  // 2. ตรวจสอบจากคำนิยามสถานะ (transportStatuses & dealStatuses)
  if (Array.isArray(transportStatuses) && transportStatuses.length > 0) {
    const tDef = transportStatuses.find(s => s.value === item.transportStatus);
    if (tDef) {
      if (tDef.type === 'completed' || tDef.type === 'cancelled' || tDef.type === 'declined') return true;
      if (typeof tDef.label === 'string') {
        const lbl = tDef.label.toLowerCase();
        if (lbl.includes('ส่งสำเร็จ') || lbl.includes('ส่งแล้ว') || lbl.includes('สำเร็จ') || lbl.includes('เสร็จ')) return true;
      }
    }
  }

  if (Array.isArray(dealStatuses) && dealStatuses.length > 0) {
    const dDef = dealStatuses.find(s => s.value === item.dealStatus);
    if (dDef) {
      if (dDef.type === 'completed' || dDef.type === 'cancelled' || dDef.type === 'declined') return true;
      if (typeof dDef.label === 'string') {
        const lbl = dDef.label.toLowerCase();
        if (lbl.includes('เสร็จสิ้น') || lbl.includes('สำเร็จ') || lbl.includes('ปิดงาน')) return true;
      }
    }
  }

  // 3. ตรวจสอบ Boolean Flag ทั่วไป
  if (item.isCompleted === true || item.isFinished === true) return true;

  return false; // งานนี้ยังไม่เสร็จ (Active / Pending / In Transit)
}

export default function BatchDeliveryBanner({ 
  activities = [], 
  dealStatuses = [], 
  transportStatuses = [], 
  onSelectProject, 
  onOpenVenueModal 
}) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeClusterIndex, setActiveClusterIndex] = useState(0);

  // กรองเฉพาะงานที่ "ยังไม่เสร็จ" และจัดกลุ่มตาม วันที่ + สถานที่จัดส่ง
  const batchClusters = useMemo(() => {
    if (!Array.isArray(activities) || activities.length === 0) return [];

    const clusters = new Map(); // key: `date_location`

    activities.forEach(item => {
      // กฎเหล็ก: เตือนเฉพาะงานที่ "ยังไม่เสร็จ" เท่านั้น
      if (isProjectFinishedOrCancelled(item, dealStatuses, transportStatuses)) {
        return;
      }

      // ดึงคีย์วันที่มาตรฐาน (YYYY-MM-DD หรือเทียบเท่า)
      let dateKey = 'unknown';
      if (item.rawDeliveryDateTime) {
        dateKey = item.rawDeliveryDateTime.split('T')[0];
      } else if (item.rawDeliveryStart) {
        dateKey = item.rawDeliveryStart.split('T')[0];
      } else if (item.date) {
        const parts = item.date.split(' ')[0].split('/');
        if (parts.length === 3) {
          let yr = parseInt(parts[2], 10);
          if (yr > 2500) yr -= 543;
          dateKey = `${yr}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        } else {
          dateKey = item.date.split(' ')[0];
        }
      }

      const locKey = (item.location || item.locationName || '').trim().toLowerCase();
      if (!locKey || locKey === '-' || locKey.length < 2) return;

      const groupKey = `${dateKey}___${locKey}`;

      if (!clusters.has(groupKey)) {
        clusters.set(groupKey, {
          date: dateKey,
          displayDate: item.deliveryDate || item.deliveryDateDisplay || item.date || dateKey,
          location: item.location || item.locationName,
          items: []
        });
      }

      clusters.get(groupKey).items.push(item);
    });

    // แสดงเฉพาะกลุ่มที่มีงานยังไม่เสร็จตั้งแต่ 2 งานขึ้นไปในสถานที่และวันเดียวกัน
    return Array.from(clusters.values())
      .filter(c => c.items.length >= 2)
      .sort((a, b) => b.items.length - a.items.length);
  }, [activities, dealStatuses, transportStatuses]);

  if (isDismissed || batchClusters.length === 0) return null;

  // ป้องกัน index ล้น
  const currentIndex = Math.min(activeClusterIndex, batchClusters.length - 1);
  const currentCluster = batchClusters[currentIndex] || batchClusters[0];

  const getTransportBadge = (item) => {
    const val = item.transportStatus;
    const def = transportStatuses.find(s => s.value === val);
    if (def) {
      return { label: def.label, color: def.color || 'bg-blue-50 text-blue-700 border-blue-200' };
    }
    if (val === 'custom-1771415299552' || val === 'pending' || val === 'waiting') {
      return { label: 'รอการจัดส่ง', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    }
    if (val === 'custom-1771415315265' || val === 'in_transit' || val === 'delivering') {
      return { label: 'กำลังจัดส่ง', color: 'bg-blue-50 text-blue-700 border-blue-200' };
    }
    return { label: 'ยังไม่เสร็จ', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
  };

  return (
    <div className="mx-4 sm:mx-8 lg:mx-10 mb-4 animate-fadeIn">
      <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white rounded-2xl p-4 shadow-lg shadow-amber-500/20 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-md shrink-0 mt-0.5">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider bg-white/25 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span>⚡ Smart Batch Delivery Alert</span>
                <span className="bg-amber-900/40 text-amber-100 px-1.5 py-0.2 rounded-full text-xs">
                  เฉพาะงานที่ยังไม่เสร็จ
                </span>
              </span>
              <span className="text-xs font-semibold text-amber-100 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{currentCluster.displayDate}</span>
              </span>
              {batchClusters.length > 1 && (
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-bold">
                  กลุ่มที่ {currentIndex + 1} จาก {batchClusters.length}
                </span>
              )}
            </div>
            <h4 className="text-sm font-black mt-1 flex items-center gap-1.5 flex-wrap">
              <span>ตรวจพบ {currentCluster.items.length} งานค้างส่ง สถานที่เดียวกัน:</span>
              <span className="underline decoration-white/40 underline-offset-2">{currentCluster.location}</span>
            </h4>
            <p className="text-xs text-amber-100 mt-0.5">
              รวมเที่ยวรถวิ่งส่งพ่วงเดียวได้ ประหยัดค่าเดินทางและเตรียมของได้พร้อมกัน
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
          {batchClusters.length > 1 && (
            <div className="flex items-center bg-black/15 rounded-xl p-0.5 border border-white/20 mr-1">
              <button
                type="button"
                onClick={() => setActiveClusterIndex(prev => (prev > 0 ? prev - 1 : batchClusters.length - 1))}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition"
                title="กลุ่มก่อนหน้า"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold px-2 text-amber-100">
                {currentIndex + 1}/{batchClusters.length}
              </span>
              <button
                type="button"
                onClick={() => setActiveClusterIndex(prev => (prev < batchClusters.length - 1 ? prev + 1 : 0))}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition"
                title="กลุ่มถัดไป"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-3.5 py-1.5 bg-white text-amber-800 rounded-xl font-bold text-xs hover:bg-amber-50 transition active:scale-95 flex items-center gap-1.5 shadow-sm"
          >
            <span>{isExpanded ? 'ซ่อนรายละเอียด' : 'ดูคิวส่งพ่วง'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition"
            title="ปิดการแจ้งเตือน"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded Delivery Sequence List */}
      {isExpanded && (
        <div className="bg-amber-50/90 border border-amber-200/80 rounded-2xl p-4 mt-2 space-y-2.5 animate-fadeIn shadow-sm">
          <div className="flex items-center justify-between text-xs font-bold text-amber-900 border-b border-amber-200/50 pb-2">
            <span className="flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-amber-600" />
              <span>ลำดับคิวงานที่ยังไม่เสร็จ สำหรับจัดรถเที่ยวนี้:</span>
            </span>
            <span className="text-xs text-amber-700 bg-amber-200/60 px-2 py-0.5 rounded-full font-bold">
              ยังไม่เสร็จ {currentCluster.items.length} งาน
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {currentCluster.items.map((proj, idx) => {
              const badge = getTransportBadge(proj);
              return (
                <div 
                  key={proj.id || idx}
                  onClick={() => onSelectProject && onSelectProject(proj)}
                  className="bg-white p-3.5 rounded-xl border border-amber-100 hover:border-amber-300 hover:shadow-md cursor-pointer transition flex items-center justify-between gap-2.5 group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-mono">
                        #{idx + 1}
                      </span>
                      <span className="text-xs font-black text-slate-800 truncate">
                        {proj.id} - {proj.name}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                      <span className="truncate">ศิลปิน: <strong className="text-slate-700">{proj.artist || '-'}</strong></span>
                      {proj.deliveryDate && (
                        <span className="text-amber-800 font-medium">({proj.deliveryDate})</span>
                      )}
                    </div>

                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${badge.color}`}>
                        {badge.label}
                      </span>
                      {proj.recipient && (
                        <span className="text-xs text-slate-400 truncate">
                          ผู้รับ: {proj.recipient}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="w-7 h-7 rounded-lg bg-amber-50 group-hover:bg-amber-100 flex items-center justify-center transition shrink-0">
                    <ArrowRight className="w-4 h-4 text-amber-600 group-hover:translate-x-0.5 transition" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

