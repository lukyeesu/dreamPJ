import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  Phone,
  MessageCircle,
  ExternalLink,
  Crown,
  Heart,
  TrendingUp,
  ShoppingBag,
  Filter,
  Edit,
  Copy,
  Check,
  Building,
  Calendar,
  X,
  Eye
} from 'lucide-react';
import { saveCustomerSync } from './services/syncService';
import Toast from './components/common/Toast';

function CustomersView({
  customers = [],
  activities = [],
  isCreateOpen = false,
  onCloseCreate,
  onOpenProjectModal,
  onFilterByCustomer,
  onRefresh
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTier, setSelectedTier] = useState('all');
  const [sortBy, setSortBy] = useState('spend'); // 'spend' | 'orders' | 'name'
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    line_id: '',
    social_account: '',
    email: '',
    tax_id: '',
    billing_address: '',
    vip_tier: 'general'
  });

  // Listen to single top header button
  useEffect(() => {
    if (isCreateOpen) {
      handleOpenModal();
      if (onCloseCreate) onCloseCreate();
    }
  }, [isCreateOpen]);

  // Keyboard shortcut: close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  // Aggregate customer intelligence across both customers table and activities
  const customerDirectory = useMemo(() => {
    const map = new Map();

    // 1. Seed from customers table
    customers.forEach(c => {
      const key = (c.name || '').trim().toLowerCase();
      if (!key) return;
      map.set(key, {
        id: c.id,
        name: c.name,
        phone: c.phone || '',
        line_id: c.line_id || '',
        social_account: c.social_account || '',
        email: c.email || '',
        tax_id: c.tax_id || '',
        billing_address: c.billing_address || '',
        vip_tier: c.vip_tier || 'general',
        projectCount: 0,
        totalSpend: 0,
        totalSupport: 0,
        lastOrderDate: '',
        lastProjectId: null,
        projects: []
      });
    });

    // 2. Aggregate from all project activities
    activities.forEach(item => {
      const cName = (item.customer || '').trim();
      if (!cName || cName === '-' || cName === 'Unknown') return;
      const key = cName.toLowerCase();

      if (!map.has(key)) {
        const info = item.customerInfo || {};
        map.set(key, {
          id: item.customerId || null,
          name: cName,
          phone: info.phone || '',
          line_id: info.line || '',
          social_account: info.social || '',
          email: info.email || '',
          tax_id: info.taxId || '',
          billing_address: info.address || '',
          vip_tier: 'general',
          projectCount: 0,
          totalSpend: 0,
          totalSupport: 0,
          lastOrderDate: '',
          lastProjectId: null,
          projects: []
        });
      }

      const entry = map.get(key);
      entry.projectCount += 1;
      entry.totalSpend += (item.wage || 0) + (parseFloat(item.deliveryFee) || 0);

      const support = (item.customerSupport || []).reduce((sum, cs) => sum + (parseFloat(cs.price) || 0), 0);
      entry.totalSupport += support;

      const dateStr = item.deliveryDate || item.date || '';
      if (dateStr && (!entry.lastOrderDate || dateStr > entry.lastOrderDate)) {
        entry.lastOrderDate = dateStr;
        entry.lastProjectId = item.id;
      }

      if (entry.projects.length < 5) {
        entry.projects.push(item);
      }
    });

    const list = Array.from(map.values());

    // Sort
    return list.sort((a, b) => {
      if (sortBy === 'spend') return b.totalSpend - a.totalSpend;
      if (sortBy === 'orders') return b.projectCount - a.projectCount;
      return a.name.localeCompare(b.name, 'th');
    });
  }, [customers, activities, sortBy]);

  // Filtered
  const filteredCustomers = useMemo(() => {
    return customerDirectory.filter(c => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q ||
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.line_id.toLowerCase().includes(q) ||
        c.social_account.toLowerCase().includes(q);

      const matchTier = selectedTier === 'all' || c.vip_tier === selectedTier;

      return matchSearch && matchTier;
    });
  }, [customerDirectory, searchQuery, selectedTier]);

  // Overall KPIs
  const stats = useMemo(() => {
    const total = customerDirectory.length;
    const repeat = customerDirectory.filter(c => c.projectCount > 1).length;
    const vipFandom = customerDirectory.filter(c => c.vip_tier === 'vip_fandom' || c.totalSpend >= 20000).length;
    const totalSpendAll = customerDirectory.reduce((sum, c) => sum + c.totalSpend, 0);
    return { total, repeat, vipFandom, totalSpendAll };
  }, [customerDirectory]);

  // Open Add/Edit Modal
  const handleOpenModal = (customer = null) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name || '',
        phone: customer.phone || '',
        line_id: customer.line_id || '',
        social_account: customer.social_account || '',
        email: customer.email || '',
        tax_id: customer.tax_id || '',
        billing_address: customer.billing_address || '',
        vip_tier: customer.vip_tier || 'general'
      });
    } else {
      setEditingCustomer(null);
      setFormData({
        name: '',
        phone: '',
        line_id: '',
        social_account: '',
        email: '',
        tax_id: '',
        billing_address: '',
        vip_tier: 'general'
      });
    }
    setIsModalOpen(true);
  };

  // Submit Save Customer
  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('กรุณากรอกชื่อลูกค้า', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        ...formData,
        id: editingCustomer?.id || undefined
      };
      await saveCustomerSync(payload);
      showToast('บันทึกข้อมูลลูกค้าสำเร็จ', 'success');
      setIsModalOpen(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      showToast('บันทึกไม่สำเร็จ: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderVipBadge = (tier) => {
    switch (tier) {
      case 'vip_fandom':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-pink-100 text-pink-700 border border-pink-200">
            <Heart className="w-3 h-3 fill-pink-500 text-pink-500" /> Fandom VIP
          </span>
        );
      case 'gold':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Crown className="w-3 h-3 text-amber-600" /> VIP Gold
          </span>
        );
      case 'silver':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
            VIP Silver
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
            ลูกค้าทั่วไป
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 flex flex-col min-h-full pb-24 md:pb-6 px-4 sm:px-8 lg:px-10 pt-4">
      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-500">ลูกค้าทั้งหมด</span>
            <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">{stats.total.toLocaleString()} ราย</p>
          <div className="mt-1 pt-1 border-t border-slate-50 text-[11px] text-slate-400">ในระบบจัดการ</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-700">ลูกค้าสั่งซ้ำ (Repeat)</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-700">{stats.repeat.toLocaleString()} ราย</p>
          <div className="mt-1 pt-1 border-t border-slate-50 text-[11px] text-emerald-600">มากกว่า 1 โปรเจกต์</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-pink-700">VIP & บ้านเบสแฟนคลับ</span>
            <div className="p-2 rounded-xl bg-pink-50 text-pink-600">
              <Heart className="w-4 h-4 sm:w-5 sm:h-5 fill-pink-500 text-pink-500" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-pink-700">{stats.vipFandom.toLocaleString()} ราย</p>
          <div className="mt-1 pt-1 border-t border-slate-50 text-[11px] text-pink-600">ลูกค้าประจำคนสำคัญ</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-indigo-700">ยอดรายรับสะสมรวม</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-indigo-700">฿{Math.round(stats.totalSpendAll).toLocaleString()}</p>
          <div className="mt-1 pt-1 border-t border-slate-50 text-[11px] text-indigo-600">จากลูกค้าทั้งหมด</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อลูกค้า, เบอร์โทร, LINE, โซเชียล..."
            className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50 focus:bg-white transition-all font-medium"
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

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-bold text-slate-500">ระดับ:</span>
            <select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value)}
              className="text-xs sm:text-sm py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">ทั้งหมด ({customerDirectory.length})</option>
              <option value="vip_fandom">Fandom VIP</option>
              <option value="gold">VIP Gold</option>
              <option value="silver">VIP Silver</option>
              <option value="general">ลูกค้าทั่วไป</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-bold text-slate-500">เรียงตาม:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs sm:text-sm py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="spend">ยอดใช้จ่ายสูงสุด</option>
              <option value="orders">จำนวนงานมากสุด</option>
              <option value="name">ชื่อ ก-ฮ / A-Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-5">ลูกค้า / บ้านเบส</th>
                <th className="py-3.5 px-4">ระดับสมาชิก</th>
                <th className="py-3.5 px-4">ช่องทางติดต่อ</th>
                <th className="py-3.5 px-4 text-center">จำนวนงาน</th>
                <th className="py-3.5 px-4 text-right">ยอดสั่งซื้อสะสม</th>
                <th className="py-3.5 px-4">งานล่าสุด</th>
                <th className="py-3.5 px-5 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    ไม่พบข้อมูลลูกค้าที่ตรงกับการค้นหา
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => (
                  <tr key={cust.name} className="hover:bg-slate-50/60 transition-colors group">
                    <td className="py-3.5 px-5 font-bold text-slate-900">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs shrink-0 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                          {cust.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {cust.name}
                          </div>
                          {cust.social_account && (
                            <div className="text-xs text-slate-400 font-normal">
                              {cust.social_account}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {renderVipBadge(cust.vip_tier)}
                    </td>

                    <td className="py-3.5 px-4 text-xs">
                      <div className="space-y-1">
                        {cust.phone && (
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{cust.phone}</span>
                          </div>
                        )}
                        {cust.line_id && (
                          <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>{cust.line_id}</span>
                          </div>
                        )}
                        {!cust.phone && !cust.line_id && (
                          <span className="text-slate-400">-</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => onFilterByCustomer && onFilterByCustomer(cust.name)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition-colors cursor-pointer"
                        title="คลิกเพื่อดูกิจกรรมงานทั้งหมดของลูกค้ารายนี้"
                      >
                        <span>{cust.projectCount} งาน</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-right font-black text-slate-800">
                      ฿{Math.round(cust.totalSpend).toLocaleString()}
                      {cust.totalSupport > 0 && (
                        <div className="text-[11px] text-purple-600 font-semibold">
                          ซัพพอร์ต ฿{Math.round(cust.totalSupport).toLocaleString()}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-xs text-slate-500">
                      {cust.lastOrderDate ? (
                        <div>
                          <div>{cust.lastOrderDate}</div>
                          {cust.lastProjectId && (
                            <button
                              onClick={() => onOpenProjectModal && onOpenProjectModal(cust.lastProjectId)}
                              className="text-[11px] text-indigo-600 hover:underline font-bold"
                            >
                              {cust.lastProjectId}
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    <td className="py-3.5 px-5 text-right">
                      <button
                        onClick={() => handleOpenModal(cust)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        title="แก้ไขข้อมูลลูกค้า"
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
        {filteredCustomers.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-100 text-center text-slate-400">
            ไม่พบข้อมูลลูกค้า
          </div>
        ) : (
          filteredCustomers.map((cust) => (
            <div
              key={cust.name}
              className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xs shrink-0">
                    {cust.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{cust.name}</h3>
                    {cust.social_account && (
                      <p className="text-xs text-slate-400">{cust.social_account}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {renderVipBadge(cust.vip_tier)}
                  <button
                    onClick={() => handleOpenModal(cust)}
                    className="p-1 text-slate-400 hover:text-indigo-600"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Contacts */}
              <div className="bg-slate-50 p-2.5 rounded-xl text-xs space-y-1">
                {cust.phone && (
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Phone className="w-3 h-3" /> โทร:
                    </span>
                    <a href={`tel:${cust.phone}`} className="font-bold text-slate-800">
                      {cust.phone}
                    </a>
                  </div>
                )}
                {cust.line_id && (
                  <div className="flex items-center justify-between text-emerald-700">
                    <span className="text-slate-400 flex items-center gap-1">
                      <MessageCircle className="w-3 h-3" /> LINE:
                    </span>
                    <span className="font-bold">{cust.line_id}</span>
                  </div>
                )}
              </div>

              {/* Stats & Actions */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 text-[10px] block">ยอดสั่งซื้อรวม</span>
                  <span className="font-black text-slate-900">฿{Math.round(cust.totalSpend).toLocaleString()}</span>
                </div>
                <button
                  onClick={() => onFilterByCustomer && onFilterByCustomer(cust.name)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 font-bold flex items-center gap-1 hover:bg-indigo-100"
                >
                  <span>{cust.projectCount} งาน</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Customer Add/Edit Modal */}
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
            {/* Sticky Header */}
            <div className="px-5 py-4 sm:px-8 sm:py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-20 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 sm:p-3 bg-indigo-50 text-indigo-600 rounded-xl sm:rounded-2xl shrink-0">
                  <Users className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                      {editingCustomer ? 'แก้ไขข้อมูลลูกค้า' : 'เพิ่มลูกค้าใหม่'}
                    </h3>
                    {editingCustomer?.name && (
                      <span className="bg-indigo-50 text-indigo-600 text-[10px] sm:text-xs px-2.5 py-0.5 sm:py-1 rounded-lg font-bold border border-indigo-100 w-fit">
                        {editingCustomer.name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">
                    บันทึกข้อมูลเพื่อความสะดวกรวดเร็วในการติดต่อและออกใบเสนอราคา
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

            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
              {/* Scrollable Form Body */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-8 custom-scrollbar space-y-5 overscroll-contain">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">ชื่อลูกค้า / ชื่อบ้านเบส *</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น คุณแพรว, Fandom Nunew Official"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl sm:rounded-2xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">เบอร์โทรศัพท์</label>
                    <input
                      type="tel"
                      placeholder="0812345678"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl sm:rounded-2xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">LINE ID</label>
                    <input
                      type="text"
                      placeholder="@line_id"
                      value={formData.line_id}
                      onChange={(e) => setFormData({ ...formData, line_id: e.target.value })}
                      className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl sm:rounded-2xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">โซเชียลมีเดีย / X (Twitter) / IG</label>
                    <input
                      type="text"
                      placeholder="@twitter_account"
                      value={formData.social_account}
                      onChange={(e) => setFormData({ ...formData, social_account: e.target.value })}
                      className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl sm:rounded-2xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">อีเมล</label>
                    <input
                      type="email"
                      placeholder="customer@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl sm:rounded-2xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">ระดับ VIP สมาชิก</label>
                  <select
                    value={formData.vip_tier}
                    onChange={(e) => setFormData({ ...formData, vip_tier: e.target.value })}
                    className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl sm:rounded-2xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  >
                    <option value="general">ลูกค้าทั่วไป (General)</option>
                    <option value="silver">VIP Silver</option>
                    <option value="gold">VIP Gold</option>
                    <option value="vip_fandom">Fandom VIP (แฟนด้อมคนสำคัญ)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">ที่อยู่ออกใบกำกับ / เอกสาร</label>
                  <textarea
                    rows="3"
                    placeholder="ที่อยู่สำหรับออกบิลและจัดส่งเอกสาร..."
                    value={formData.billing_address}
                    onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
                    className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl sm:rounded-2xl text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                  ></textarea>
                </div>
              </div>

              {/* Sticky Footer */}
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
                  <span>{isSaving ? 'กำลังบันทึก...' : (editingCustomer ? 'บันทึกการแก้ไข' : 'เพิ่มลูกค้า')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

export default React.memo(CustomersView);
