import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Clock,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRightLeft,
  ExternalLink,
  ShieldCheck,
  Package,
  Wrench,
  FileCheck2,
  Lock,
  ListTodo,
  Info,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Banknote
} from 'lucide-react';
import { loadWarehouseHistory, loadWarehouseChecklists } from '../../services/warehouseService.js';

/**
 * HistoryAuditView Component
 * Manages the "ประวัติ" view:
 * 1. Audited warehouse movements log with true pagination & filtering via loadWarehouseHistory
 * 2. Read-only legacy project checklists (select any activity including finished/cancelled)
 * 3. Read-only legacy asset loans
 * 4. Read-only services and tasks
 * 5. Reversal and correction explanation (Strictly NO delete-history action)
 */
export default function HistoryAuditView({
  assetLoans = [],
  checklistItems: initialChecklistItems = [],
  items = [],
  activities = [],
  onOpenProjectModal,
  isPrivilegedCash = false
}) {
  // Subtab: 'movements' | 'legacy_checklists' | 'legacy_loans' | 'legacy_tasks'
  const [activeSubTab, setActiveSubTab] = useState('movements');

  // Movements state & true pagination
  const [historyData, setHistoryData] = useState({ documents: [], movements: [], cash_movements: [] });
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [selectedProjectIdFilter, setSelectedProjectIdFilter] = useState('');
  const [movementSearchQuery, setMovementSearchQuery] = useState('');
  const [selectedMovementType, setSelectedMovementType] = useState('all');
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 20;

  // Legacy Checklists state
  const [selectedChecklistProjectId, setSelectedChecklistProjectId] = useState('');
  const [projectChecklistItems, setProjectChecklistItems] = useState(initialChecklistItems);
  const [isLoadingChecklist, setIsLoadingChecklist] = useState(false);
  const [checklistPage, setChecklistPage] = useState(0);
  const [checklistHasMore, setChecklistHasMore] = useState(false);
  const [checklistError, setChecklistError] = useState(null);
  const [checklistSearchQuery, setChecklistSearchQuery] = useState('');

  // Legacy loans search
  const [loanSearchQuery, setLoanSearchQuery] = useState('');
  const [loanRows, setLoanRows] = useState(assetLoans);
  const [loanPage, setLoanPage] = useState(0);
  const [loanHasMore, setLoanHasMore] = useState(false);
  const [loanError, setLoanError] = useState(null);
  const [isLoadingLoans, setIsLoadingLoans] = useState(false);
  const historyRequestRef = useRef(0);

  // Fetch paginated history from server RPC
  const fetchHistory = useCallback(async (page = 0) => {
    const token = ++historyRequestRef.current;
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const data = await loadWarehouseHistory({
        projectId: selectedProjectIdFilter || null,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
        includeCash: isPrivilegedCash
      });
      if (token !== historyRequestRef.current) return;
      setHistoryData(data || { documents: [], movements: [], cash_movements: [] });
      setCurrentPage(page);
    } catch (err) {
      if (token !== historyRequestRef.current) return;
      console.warn('Failed to load warehouse history:', err);
      setHistoryError(err?.message || 'ไม่สามารถโหลดประวัติธุรกรรมคลังสินค้าได้');
    } finally {
      if (token === historyRequestRef.current) setIsLoadingHistory(false);
    }
  }, [selectedProjectIdFilter, isPrivilegedCash]);

  // Load history on tab entry or filter change
  useEffect(() => {
    if (activeSubTab === 'movements') {
      fetchHistory(0);
    }
    return () => { historyRequestRef.current += 1; };
  }, [activeSubTab, selectedProjectIdFilter, fetchHistory]);

  useEffect(() => { setChecklistPage(0); }, [selectedChecklistProjectId]);
  useEffect(() => {
    if (activeSubTab !== 'legacy_checklists') return;
    let active = true;
    setIsLoadingChecklist(true); setChecklistError(null);
    loadWarehouseChecklists({project_id: selectedChecklistProjectId || null, limit: 20, offset: checklistPage * 20}).then(page => {
      if (!active || !page) return;
      setProjectChecklistItems((page.checklists || []).map(row => ({...row, item_name: row.name || row.item_name, required_qty: row.required_qty ?? row.quantity})));
      setChecklistHasMore(Boolean(page.has_more));
    }).catch(error => { if (active) setChecklistError(error.message); }).finally(() => { if (active) setIsLoadingChecklist(false); });
    return () => { active = false; };
  }, [activeSubTab, selectedChecklistProjectId, checklistPage]);

  useEffect(() => {
    if (activeSubTab !== 'legacy_loans') return;
    let active = true;
    setIsLoadingLoans(true); setLoanError(null);
    loadWarehouseHistory({docType: 'LEGACY_LOAN', includeCash: false, limit: PAGE_SIZE, offset: loanPage * PAGE_SIZE})
      .then(data => {
        if (!active) return;
        setLoanRows((data?.documents || []).map(row => ({...row,
          borrower_name: row.recipient_name_snapshot, borrowed_at: row.borrowed_at || row.created_at,
          expected_return_at: row.due_at})));
        setLoanHasMore(Boolean(data?.has_more));
      }).catch(error => { if (active) setLoanError(error.message); })
      .finally(() => { if (active) setIsLoadingLoans(false); });
    return () => { active = false; };
  }, [activeSubTab, loanPage]);

  // Filter legacy tasks/services
  const legacyTasks = useMemo(() => {
    return items.filter(it => String(it.item_type || '').toLowerCase() === 'task');
  }, [items]);

  // Filter legacy asset loans
  const filteredLoans = useMemo(() => {
    return loanRows.filter(l => {
      if (!loanSearchQuery.trim()) return true;
      const q = loanSearchQuery.toLowerCase().trim();
      const borrowerMatch = String(l.borrower_name || '').toLowerCase().includes(q);
      const notesMatch = String(l.notes || '').toLowerCase().includes(q);
      const projMatch = String(l.project_id || '').toLowerCase().includes(q);
      return borrowerMatch || notesMatch || projMatch;
    });
  }, [loanRows, loanSearchQuery]);

  // Filter legacy checklists
  const filteredChecklists = useMemo(() => {
    return projectChecklistItems.filter(c => {
      if (!checklistSearchQuery.trim()) return true;
      const q = checklistSearchQuery.toLowerCase().trim();
      const itemMatch = String(c.item_name || '').toLowerCase().includes(q);
      const catMatch = String(c.category_name || '').toLowerCase().includes(q);
      const projMatch = String(c.project_id || '').toLowerCase().includes(q);
      return itemMatch || catMatch || projMatch;
    });
  }, [projectChecklistItems, checklistSearchQuery]);

  // Filter movements
  const filteredMovements = useMemo(() => {
    const cash = isPrivilegedCash ? (historyData.cash_movements || []).map(move => ({...move,
      is_cash: true, movement_type: move.action_type, quantity: move.note_count, unit: 'ใบ',
      item_name_snapshot: `ธนบัตร ${move.denomination} บาท`,
      reason: [move.from_location && move.to_location ? `${move.from_location} → ${move.to_location}` : '', move.notes].filter(Boolean).join(' · ')
    })) : [];
    const raw = [...(historyData.movements || []), ...cash].sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return raw.filter(m => {
      if (selectedMovementType !== 'all') {
        const typeStr = String(m.movement_type || '').toLowerCase();
        if (!typeStr.includes(selectedMovementType.toLowerCase())) return false;
      }
      if (movementSearchQuery.trim()) {
        const q = movementSearchQuery.toLowerCase().trim();
        const itemMatch = String(m.item_name_snapshot || m.item_name || '').toLowerCase().includes(q);
        const docMatch = String(m.doc_number || m.document_id || '').toLowerCase().includes(q);
        const projMatch = String(m.project_id || '').toLowerCase().includes(q);
        const notesMatch = String(m.notes || '').toLowerCase().includes(q);
        return itemMatch || docMatch || projMatch || notesMatch;
      }
      return true;
    });
  }, [historyData.movements, historyData.cash_movements, isPrivilegedCash, selectedMovementType, movementSearchQuery]);

  return (
    <div className="space-y-4">
      {/* Subtab Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200/90 pb-2 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveSubTab('movements')}
          className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap cursor-pointer ${
            activeSubTab === 'movements'
              ? 'bg-[var(--theme-main)] text-[var(--theme-on-main)] shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          ประวัติการเคลื่อนไหวคลัง
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('legacy_checklists')}
          className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap cursor-pointer ${
            activeSubTab === 'legacy_checklists'
              ? 'bg-[var(--theme-main)] text-[var(--theme-on-main)] shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          ประวัติเช็กลิสต์โปรเจกต์เดิม
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('legacy_loans')}
          className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap cursor-pointer ${
            activeSubTab === 'legacy_loans'
              ? 'bg-[var(--theme-main)] text-[var(--theme-on-main)] shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          ประวัติการยืมเดิม
        </button>

        {legacyTasks.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveSubTab('legacy_tasks')}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap cursor-pointer ${
              activeSubTab === 'legacy_tasks'
                ? 'bg-[var(--theme-main)] text-[var(--theme-on-main)] shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            บริการและงานบริการ ({legacyTasks.length})
          </button>
        )}
      </div>

      {/* --- SUBTAB 1: Movement Audit Trail --- */}
      {activeSubTab === 'movements' && (
        <section className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden p-4 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                ประวัติธุรกรรมคลังสินค้า (Warehouse Audit Trail)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                บันทึกการเบิก คืน กู้คืน และการปรับปรุงยอดสต็อก โดยไม่มีการลบประวัติเพื่อความโปร่งใส
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Project Filter */}
              <select
                value={selectedProjectIdFilter}
                onChange={(e) => setSelectedProjectIdFilter(e.target.value)}
                className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-hidden focus:border-[var(--theme-main)]"
              >
                <option value="">-- ทุกโปรเจกต์งาน --</option>
                {activities.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>

              {/* Movement Type Filter */}
              <select
                value={selectedMovementType}
                onChange={(e) => setSelectedMovementType(e.target.value)}
                className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-hidden focus:border-[var(--theme-main)]"
              >
                <option value="all">ทุกประเภทธุรกรรม</option>
                <option value="issue">เบิกพัสดุ/เครื่องมือ (Issue)</option>
                <option value="return">รับคืน (Return)</option>
                <option value="recovery">กู้คืนวัสดุ (Recovery)</option>
                <option value="handover">ส่งต่อเครื่องมือ (Handover)</option>
                <option value="adjust">ปรับยอดสต็อก (Adjust)</option>
                {isPrivilegedCash && <option value="cash">เงินสด (Cash)</option>}
              </select>

              {/* Refresh button */}
              <button
                type="button"
                onClick={() => fetchHistory(currentPage)}
                disabled={isLoadingHistory}
                className="min-h-[44px] px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                <span>รีเฟรช</span>
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={movementSearchQuery}
              onChange={(e) => setMovementSearchQuery(e.target.value)}
              placeholder="ค้นหาชื่อรายการ, รหัสเอกสาร, โปรเจกต์ หรือหมายเหตุ..."
              className="w-full h-11 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm outline-hidden focus:border-[var(--theme-main)]"
            />
          </div>

          {/* Error Notice */}
          {historyError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between">
              <span>{historyError}</span>
              <button
                type="button"
                onClick={() => fetchHistory(currentPage)}
                className="px-2 py-1 bg-white border border-rose-300 rounded text-xs font-bold hover:bg-rose-100"
              >
                ลองใหม่
              </button>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold text-xs uppercase border-b border-slate-200">
                  <th className="py-3 px-4">วัน-เวลา</th>
                  <th className="py-3 px-4">ประเภทธุรกรรม</th>
                  <th className="py-3 px-4">รายการพัสดุ</th>
                  <th className="py-3 px-4">จำนวน / เปลี่ยนแปลงสต็อก</th>
                  <th className="py-3 px-4">โปรเจกต์ / ผู้รับ</th>
                  <th className="py-3 px-4">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoadingHistory ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[var(--theme-ink)]" />
                      <p className="text-xs font-bold text-slate-600">กำลังโหลดประวัติธุรกรรม...</p>
                    </td>
                  </tr>
                ) : filteredMovements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-xs font-bold text-slate-600">ยังไม่มีรายการเคลื่อนไหวตามเงื่อนไขที่เลือก</p>
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map((m) => {
                    const delta = Number(m.delta_stock ?? m.delta_quantity ?? m.quantity) || 0;
                    return (
                      <tr key={m.id || `${m.document_id}-${m.item_id}`} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 text-xs font-mono text-slate-500 whitespace-nowrap">
                          {m.created_at ? new Date(m.created_at).toLocaleString('th-TH') : '—'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            String(m.movement_type).includes('ISSUE')
                              ? 'bg-amber-100 text-amber-900'
                              : String(m.movement_type).includes('RETURN') || String(m.movement_type).includes('RECOVERY')
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-slate-100 text-slate-800'
                          }`}>
                            {m.movement_type || 'TRANSACTION'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-xs sm:text-sm text-slate-900">
                          {m.item_name_snapshot || m.item_name || m.item_id}
                          {m.item_color_snapshot && (
                            <span className="text-xs font-normal text-slate-400 ml-1.5">({m.item_color_snapshot})</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-xs sm:text-sm">
                          <span className={m.is_cash ? 'text-slate-700' : delta > 0 ? 'text-emerald-700' : delta < 0 ? 'text-rose-700' : 'text-slate-700'}>
                            {!m.is_cash && delta > 0 ? `+${delta}` : delta} {m.unit || 'ชิ้น'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          <div>{m.project_name || m.project_id || '—'}</div>
                          {m.recipient_name && <div className="text-slate-400 text-xs">{m.recipient_name}</div>}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500 max-w-xs truncate">
                          {m.reason || m.notes || '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500">
              หน้า {currentPage + 1} (สูงสุด {PAGE_SIZE} รายการต่อประเภท)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => fetchHistory(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0 || isLoadingHistory}
                className="min-h-[44px] px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold disabled:opacity-40 hover:bg-slate-50 transition flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>ก่อนหน้า</span>
              </button>
              <button
                type="button"
                onClick={() => fetchHistory(currentPage + 1)}
                disabled={!(historyData.has_more ?? ((historyData.movements || []).length === PAGE_SIZE)) || isLoadingHistory}
                className="min-h-[44px] px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold disabled:opacity-40 hover:bg-slate-50 transition flex items-center gap-1 cursor-pointer"
              >
                <span>ถัดไป</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Immutable Ledger Notice */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-2">
            <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <span>
              <strong>นโยบายความถูกต้อง:</strong> หากมีความผิดพลาดในการบันทึก ให้ใช้การบันทึกรายการปรับยอดแก้ไข (Correction/Reversal Transaction) ระบบไม่มีคำสั่งลบประวัติเพื่อรักษาหลักฐานย้อนหลัง
            </span>
          </div>
        </section>
      )}

      {/* --- SUBTAB 2: Legacy Project Checklists --- */}
      {activeSubTab === 'legacy_checklists' && (
        <section className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <header className="p-4 border-b border-slate-200/90 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                เช็กลิสต์จัดของตามโปรเจกต์เดิม (Legacy Project Checklists)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                เลือกโปรเจกต์งาน (รวมถึงงานที่เสร็จสิ้นหรือยกเลิกแล้ว) เพื่อตรวจสอบรายการของ
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Project Selector (including finished/cancelled) */}
              <select
                value={selectedChecklistProjectId}
                onChange={(e) => setSelectedChecklistProjectId(e.target.value)}
                className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-hidden focus:border-[var(--theme-main)]"
              >
                <option value="">-- ทุกโปรเจกต์งาน --</option>
                {activities.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.deal_status || 'สถานะงาน'})
                  </option>
                ))}
              </select>

              <div className="relative min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={checklistSearchQuery}
                  onChange={(e) => setChecklistSearchQuery(e.target.value)}
                  placeholder="ค้นหาชื่อรายการ..."
                  className="w-full h-10 pl-9 pr-3 bg-white border border-slate-200 rounded-xl text-xs outline-hidden focus:border-[var(--theme-main)]"
                />
              </div>
            </div>
          </header>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold text-xs uppercase border-b border-slate-200">
                  <th className="py-3 px-4">โปรเจกต์</th>
                  <th className="py-3 px-4">รายการ / หมวดหมู่</th>
                  <th className="py-3 px-4">จำนวนที่ต้องการ</th>
                  <th className="py-3 px-4">หยิบแล้ว</th>
                  <th className="py-3 px-4">รับคืนแล้ว</th>
                  <th className="py-3 px-4">สถานะเช็ก</th>
                  <th className="py-3 px-4 text-right">การกระทำ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoadingChecklist ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[var(--theme-ink)]" />
                      <p className="text-xs font-semibold text-slate-600">กำลังโหลดเช็กลิสต์...</p>
                    </td>
                  </tr>
                ) : filteredChecklists.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      <FileCheck2 className="w-8 h-8 mx-auto mb-1.5 text-slate-300" />
                      <p className="font-semibold text-slate-600 text-xs">ไม่พบรายการเช็กลิสต์เดิม</p>
                    </td>
                  </tr>
                ) : (
                  filteredChecklists.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-mono font-bold text-xs text-[var(--theme-ink)]">
                        {item.project_id || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-xs sm:text-sm">{item.item_name}</div>
                        {item.category_name && (
                          <span className="text-xs text-slate-400">{item.category_name}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-xs text-slate-800">
                        {item.required_qty} {item.unit}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-emerald-700 font-bold">
                        {item.picked_qty || 0} {item.unit}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600">
                        {item.returned_qty || 0} {item.unit}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          item.is_checked ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {item.is_checked ? 'เช็กแล้ว' : 'รอจัด'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {item.project_id && onOpenProjectModal && (
                          <button
                            type="button"
                            onClick={() => onOpenProjectModal(item.project_id)}
                            className="min-h-[44px] px-2.5 py-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>เปิดงาน</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeSubTab === 'legacy_checklists' && <div className="flex flex-wrap gap-2 items-center">
        <button type="button" className="min-h-11 border rounded-lg px-3" disabled={!checklistPage || isLoadingChecklist} onClick={() => setChecklistPage(page => page - 1)}>ก่อนหน้า</button>
        <span>หน้า {checklistPage + 1}</span>
        <button type="button" className="min-h-11 border rounded-lg px-3" disabled={!checklistHasMore || isLoadingChecklist} onClick={() => setChecklistPage(page => page + 1)}>ถัดไป</button>
        {checklistError && <span role="alert">{checklistError}</span>}
      </div>}
      {/* --- SUBTAB 3: Legacy Asset Loans --- */}
      {activeSubTab === 'legacy_loans' && (
        <section className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <header className="p-4 border-b border-slate-200/90 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                ประวัติการยืมเครื่องมือเดิม (Legacy Asset Loans)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                ประวัติการยืม-คืนเดิมที่ย้ายเข้าระบบคลังแล้ว สำหรับสืบค้นย้อนหลัง
              </p>
            </div>
            <div className="relative min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={loanSearchQuery}
                onChange={(e) => setLoanSearchQuery(e.target.value)}
                placeholder="ค้นหาผู้ยืมหรือหมายเหตุ..."
                className="w-full h-10 pl-9 pr-3 bg-white border border-slate-200 rounded-xl text-xs outline-hidden focus:border-[var(--theme-main)]"
              />
            </div>
          </header>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold text-xs uppercase border-b border-slate-200">
                  <th className="py-3 px-4">ผู้ยืม</th>
                  <th className="py-3 px-4">โปรเจกต์</th>
                  <th className="py-3 px-4">วันที่ยืม</th>
                  <th className="py-3 px-4">กำหนดคืน</th>
                  <th className="py-3 px-4">สถานะ</th>
                  <th className="py-3 px-4">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLoans.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      <p className="font-semibold text-slate-600 text-sm">{isLoadingLoans ? 'กำลังโหลดประวัติการยืม...' : loanError || 'ไม่มีประวัติการยืมเดิม'}</p>
                    </td>
                  </tr>
                ) : (
                  filteredLoans.map((loan) => (
                    <tr key={loan.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-bold text-xs sm:text-sm text-slate-900">
                        {loan.borrower_name || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-700">
                        {loan.project_id || '—'}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {loan.borrowed_at ? new Date(loan.borrowed_at).toLocaleDateString('th-TH') : '—'}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {loan.expected_return_at ? new Date(loan.expected_return_at).toLocaleDateString('th-TH') : '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          loan.status === 'RETURNED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {loan.status || 'ยืมอยู่'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {loan.notes || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeSubTab === 'legacy_loans' && <div className="flex flex-wrap items-center gap-3 text-sm">
        <button type="button" disabled={!loanPage || isLoadingLoans} onClick={() => setLoanPage(page => page - 1)} className="min-h-11 border rounded-lg px-3 disabled:opacity-40">ก่อนหน้า</button>
        <span>หน้า {loanPage + 1}</span>
        <button type="button" disabled={!loanHasMore || isLoadingLoans} onClick={() => setLoanPage(page => page + 1)} className="min-h-11 border rounded-lg px-3 disabled:opacity-40">ถัดไป</button>
        {loanError && <span role="alert">{loanError}</span>}
      </div>}

      {/* --- SUBTAB 4: Legacy Tasks / Services --- */}
      {activeSubTab === 'legacy_tasks' && legacyTasks.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden p-4 space-y-3">
          <h3 className="text-base font-bold text-slate-900">
            รายการบริการและภารกิจ (Services / Tasks)
          </h3>
          <p className="text-xs text-slate-500">
            รายการที่จัดเก็บประเภท 'task' แยกจากการนับสต็อกพัสดุจริงเพื่อไม่ให้ปะปน
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {legacyTasks.map((t) => (
              <div key={t.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="font-bold text-xs sm:text-sm text-slate-900">{t.name}</div>
                <div className="text-xs text-slate-500">รหัส: {t.code || '—'}</div>
                <div className="text-xs text-slate-600">ค่าบริการเฉลี่ย: ฿{Number(t.average_cost || 0).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
