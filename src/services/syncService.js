import { supabase, getActiveClient } from './supabaseClient';
import { db } from './db';
import { generateTrackingToken } from '../utils/formatters';
import {
  validatePayload,
  projectPayloadSchema,
  locationPayloadSchema,
  customerPayloadSchema,
  inventoryItemPayloadSchema,
  quotationPayloadSchema,
  artistPayloadSchema,
  staffPayloadSchema
} from '../schemas/index.js';

// ==============================================================================
// 🚫 STRICT ZERO-EGRESS PROJECTIONS (ห้ามใช้ SELECT * เด็ดขาด)
// ดึงเฉพาะคอลัมน์ที่จำเป็นต่อหน้านั้นๆ เพื่อตัด Egress ให้เหลือศูนย์
// ==============================================================================
export const PROJECT_LIST_COLUMNS = [
  'id',
  'name',
  'category',
  'artist_name',
  'artist_id',
  'customer_name',
  'customer_id',
  'recipient_name',
  'recipient_phone',
  'location_name',
  'location_id',
  'map_link',
  'project_datetime',
  'payment_date',
  'raw_delivery_start',
  'raw_delivery_end',
  'delivery_date_display',
  'deal_status',
  'transport_status',
  'payment_status',
  'wage',
  'delivery_fee',
  'deposit_amount',
  'total_revenue',
  'total_expenses',
  'net_profit',
  'customer_support_total',
  'primary_image_url',
  'note',
  'version',
  'updated_at'
].join(',');

export const PROJECT_DETAIL_COLUMNS = [
  'id',
  'images',
  'slips',
  'customer_phone',
  'customer_line',
  'customer_social',
  'customer_email',
  'customer_tax_id',
  'customer_address'
].join(',');

export const QUOTATION_COLUMNS = 'id,project_id,category,detail,quantity,unit_price,price,item_date';
export const SUPPORT_COLUMNS = 'id,project_id,denomination,quantity,price,item_date';
export const EXPENSE_COLUMNS = 'id,project_id,category,detail,quantity,unit_price,price,item_date';
export const LOCATION_COLUMNS = 'id,name,zone,gate_info,parking_height_limit,dock_contact_phone,default_map_link,loading_dock_map_link,delivery_tips,is_active';
export const SHOP_SETTINGS_COLUMNS = 'id,shop_name,phone,email,address,line_id,facebook,instagram,tiktok,twitter,wechat,telegram,logo_url,theme_color,theme_mode,custom_color_value,drive_folders,reference_folder_id,assets_folder_id,slips_folder_id,line_bot_token,telegram_bot_token,telegram_chat_id,project_categories,expense_categories,deal_statuses,transport_statuses,updated_at';
export const STAFF_COLUMNS = 'id,username,full_name,nickname,phone,email,citizen_id,birth_date,address,emergency_contact,role_id,is_active,profile_image_url,roles(id,name,label,code,allowed_pages)';
export const ROLE_COLUMNS = 'id,name,code,label,description,allowed_pages,can_edit_pricing,can_delete_project,can_borrow_tools,can_manage_users,is_system_role';
export const CUSTOMER_COLUMNS = 'id,name,phone,line_id,social_account,email,tax_id,billing_address,vip_tier,primary_artist_id,created_at';
export const INVENTORY_COLUMNS = 'id,code,name,item_type,unit,current_stock,min_alert_threshold,average_cost,storage_location,color,size,status,is_active';
export const ASSET_LOAN_COLUMNS = 'id,item_id,project_id,borrower_name,borrowed_at,expected_return_at,actual_returned_at,status,notes';
export const ASSET_UNIT_COLUMNS = 'unit_code,item_id,status,borrowed_by,borrowed_at,project_id,notes,created_at';
export const CHECKLIST_ITEM_COLUMNS = 'id,project_id,item_id,category_name,item_name,item_type,required_qty,unit,picked_qty,returned_qty,damaged_qty,unit_cost,assigned_codes,is_checked,notes,created_at,updated_at';
export const QUOTATION_DOC_COLUMNS = 'id,quote_no,title,client_name,project_code,backdrop_items,floral_items,backdrop_cost,floral_cost,total_cost,markup_percent,final_price,note,created_at,updated_at';
export const MATERIAL_RATE_COLUMNS = 'id,name,default_price_sqm,is_active,updated_at';
export const ARTIST_COLUMNS = 'id,name,agency,fandom_name,fandom_color,birth_date,debut_date,bio,social_links,favorite_flowers,avatar_url,notes,created_at';

export const DEFAULT_MATERIAL_RATES = [
  { id: 'mat-fb-3mm', name: 'ฟิวเจอร์บอร์ด 3 มม. พิมพ์สติ๊กเกอร์', default_price_sqm: 350, is_active: true },
  { id: 'mat-fb-5mm', name: 'ฟิวเจอร์บอร์ด 5 มม. พร้อมไดคัท', default_price_sqm: 450, is_active: true },
  { id: 'mat-vinyl-hd', name: 'ป้ายไวนิลความละเอียดสูง', default_price_sqm: 180, is_active: true },
  { id: 'mat-foamboard-5mm', name: 'โฟมบอร์ด 5 มม. เคลือบด้าน', default_price_sqm: 550, is_active: true },
  { id: 'mat-plaswood-5mm', name: 'พลาสวูด 5 มม. แข็งพิเศษ + ไดคัท', default_price_sqm: 750, is_active: true }
];

export const isValidUuid = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);

// Helper แปลงแถวจาก Supabase เป็นโครงสร้าง Activity ที่หน้าบ้านใช้งาน
export function transformSupabaseProjectToUi(row, childItems = {}) {
  if (!row) return null;

  const quotationItems = (childItems.quotationItems || []).map(q => ({
    id: q.id,
    category: q.category || '',
    detail: q.detail || '',
    quantity: Number(q.quantity) || 1,
    unitPrice: Number(q.unit_price) || 0,
    price: Number(q.price) || 0,
    date: q.item_date || ''
  }));

  const customerSupport = (childItems.customerSupport || []).map(cs => ({
    id: cs.id,
    denomination: Number(cs.denomination) || 0,
    quantity: Number(cs.quantity) || 0,
    price: Number(cs.price) || 0,
    date: cs.item_date || ''
  }));

  const expenses = (childItems.expenses || []).map(ex => ({
    id: ex.id,
    category: ex.category || '',
    detail: ex.detail || '',
    quantity: Number(ex.quantity) || 1,
    unitPrice: Number(ex.unit_price) || 0,
    price: Number(ex.price) || 0,
    date: ex.item_date || ''
  }));

  const images = Array.isArray(row.images) && row.images.length > 0 
    ? row.images 
    : (row.primary_image_url ? [row.primary_image_url] : []);

  const slips = Array.isArray(row.slips) ? row.slips : [];

  return {
    id: row.id,
    name: row.name || '',
    category: row.category || 'งานจัดดอกไม้',
    artist: row.artist_name || '',
    artistId: row.artist_id || null,
    customer: row.customer_name || '',
    customerId: row.customer_id || null,
    customerInfo: {
      social: row.customer_social || '',
      line: row.customer_line || '',
      phone: row.customer_phone || '',
      email: row.customer_email || '',
      taxId: row.customer_tax_id || '',
      address: row.customer_address || ''
    },
    rawDateTime: (row.raw_delivery_start || row.project_datetime || '').substring(0, 16),
    date: row.raw_delivery_start 
      ? row.raw_delivery_start.substring(0, 10) 
      : (row.delivery_date_display ? row.delivery_date_display.split(' ')[0] : ''),
    deliveryDate: row.delivery_date_display || '',
    rawDeliveryStart: row.raw_delivery_start || '',
    rawDeliveryEnd: row.raw_delivery_end || '',
    dealStatus: row.deal_status || 'operating',
    transportStatus: row.transport_status || 'preparing',
    paymentStatus: row.payment_status || 'unpaid',
    paymentDate: row.payment_date || null,
    wage: Number(row.wage) || 0,
    deliveryFee: Number(row.delivery_fee) || 0,
    depositAmount: Number(row.deposit_amount) || 0,
    totalRevenue: Number(row.total_revenue) || 0,
    totalExpenses: Number(row.total_expenses) || 0,
    netProfit: Number(row.net_profit) || 0,
    customerSupportTotal: Number(row.customer_support_total) || 0,
    note: row.note || '',
    recipient: row.recipient_name || '',
    recipientPhone: row.recipient_phone || '',
    location: row.location_name || '',
    locationId: row.location_id || null,
    mapLink: row.map_link || '',
    image: row.primary_image_url || images[0] || null,
    images: images,
    slips: slips,
    quotationItems: quotationItems,
    customerSupport: customerSupport,
    expenses: expenses,
    version: row.version || 1,
    updated_at: row.updated_at
  };
}

// Helper แปลงข้อมูลจาก UI เข้า Supabase
export function transformUiToSupabase(activityData) {
  const wage = Number(activityData.wage) || 0;
  const deliveryFee = Number(activityData.deliveryFee) || 0;
  const depositAmount = Number(activityData.depositAmount) || 0;
  const totalRevenue = wage + deliveryFee;

  let totalExpenses = 0;
  if (Array.isArray(activityData.expenses) && activityData.expenses.length > 0) {
    totalExpenses = activityData.expenses.reduce((sum, e) => sum + (Number(e.price) || ((Number(e.unitPrice) || 0) * (Number(e.quantity) || 1)) || 0), 0);
  }
  if (totalExpenses === 0 && (activityData.totalExpenses || activityData.total_expenses)) {
    totalExpenses = Number(activityData.totalExpenses || activityData.total_expenses) || 0;
  }

  let customerSupportTotal = 0;
  if (Array.isArray(activityData.customerSupport) && activityData.customerSupport.length > 0) {
    customerSupportTotal = activityData.customerSupport.reduce((sum, cs) => {
      const denom = Number(cs.denomination) || 0;
      const qty = Number(cs.quantity) || 0;
      return sum + (Number(cs.price) || (denom * qty));
    }, 0);
  }
  if (customerSupportTotal === 0 && (activityData.customerSupportTotal || activityData.customer_support_total)) {
    customerSupportTotal = Number(activityData.customerSupportTotal || activityData.customer_support_total) || 0;
  }

  const netProfit = totalRevenue - totalExpenses;
  const info = activityData.customerInfo || {};

  let projectDateTime = null;
  if (activityData.rawDateTime) {
    try {
      const d = new Date(activityData.rawDateTime);
      if (!isNaN(d.getTime())) projectDateTime = d.toISOString();
    } catch (e) {}
  }

  const images = Array.isArray(activityData.images) ? activityData.images : (activityData.image ? [activityData.image] : []);
  const slips = Array.isArray(activityData.slips) ? activityData.slips : [];

  const projectRow = {
    id: activityData.id,
    name: activityData.name || 'โปรเจกต์งาน',
    category: activityData.category || 'งานจัดดอกไม้',
    project_datetime: projectDateTime,
    payment_date: activityData.paymentDate || null,
    artist_name: activityData.artist || null,
    customer_name: activityData.customer || null,
    customer_phone: info.phone || null,
    customer_line: info.line || null,
    customer_social: info.social || null,
    customer_email: info.email || null,
    customer_tax_id: info.taxId || null,
    customer_address: info.address || null,
    recipient_name: activityData.recipient || null,
    recipient_phone: activityData.recipientPhone || null,
    location_name: activityData.location || null,
    location_id: activityData.locationId || null,
    map_link: activityData.mapLink || null,
    raw_delivery_start: activityData.rawDeliveryStart || null,
    raw_delivery_end: activityData.rawDeliveryEnd || null,
    delivery_date_display: activityData.deliveryDate || null,
    deal_status: activityData.dealStatus || 'operating',
    transport_status: activityData.transportStatus || 'preparing',
    payment_status: activityData.paymentStatus || 'unpaid',
    wage,
    delivery_fee: deliveryFee,
    deposit_amount: depositAmount,
    total_revenue: totalRevenue,
    total_expenses: totalExpenses,
    net_profit: netProfit,
    customer_support_total: customerSupportTotal,
    note: activityData.note || '',
    primary_image_url: images[0] || null,
    images: images,
    slips: slips
  };

  const quotationItems = (activityData.quotationItems || []).map((q, idx) => ({
    project_id: activityData.id,
    category: q.category || 'รายการทั่วไป',
    detail: q.detail || '',
    quantity: Number(q.quantity) || 1,
    unit_price: Number(q.unitPrice) || 0,
    price: Number(q.price) || 0,
    item_date: q.date || null,
    sort_order: idx
  }));

  const customerSupport = (activityData.customerSupport || []).map((cs, idx) => ({
    project_id: activityData.id,
    denomination: Math.round(Number(cs.denomination)) || 0,
    quantity: Math.round(Number(cs.quantity)) || 0,
    price: Number(cs.price) || 0,
    item_date: cs.date || null,
    sort_order: idx
  }));

  const expenses = (activityData.expenses || []).map((ex, idx) => ({
    project_id: activityData.id,
    category: ex.category || 'ค่าใช้จ่ายทั่วไป',
    detail: ex.detail || '',
    quantity: Number(ex.quantity) || 1,
    unit_price: Number(ex.unitPrice) || 0,
    price: Number(ex.price) || 0,
    item_date: ex.date || null,
    sort_order: idx
  }));

  return { projectRow, quotationItems, customerSupport, expenses };
}

/**
 * ดึงโปรเจกต์เฉพาะเดือนที่เลือกจาก Supabase เพื่อตัด Egress ให้เหลือต่ำสุด (~2-4 KB)
 * ปราศจากการดึงตารางลูก (quotation_items, customer_support, expenses) มาล่วงหน้า
 * พร้อมแคชลง IndexedDB และส่งข้อมูลกลับไปยัง UI ทันที
 */
export function getMonthDateBounds(yearMonth) {
  if (!yearMonth) return { start: null, end: null };
  const [y, m] = yearMonth.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, '0');
  const dd = String(lastDay).padStart(2, '0');
  return {
    start: `${y}-${mm}-01T00:00:00`,
    end: `${y}-${mm}-${dd}T23:59:59`
  };
}

async function fetchChildItemsForProjects(client, projects) {
  const qMap = new Map();
  const csMap = new Map();
  const exMap = new Map();
  if (!Array.isArray(projects) || projects.length === 0) {
    return { qMap, csMap, exMap };
  }
  const projectIds = projects.map(p => p.id);
  try {
    const [qRes, csRes, exRes] = await Promise.all([
      client.from('project_quotation_items').select(QUOTATION_COLUMNS).in('project_id', projectIds),
      client.from('project_customer_support').select(SUPPORT_COLUMNS).in('project_id', projectIds),
      client.from('project_expenses').select(EXPENSE_COLUMNS).in('project_id', projectIds)
    ]);
    (qRes.data || []).forEach(item => {
      if (!qMap.has(item.project_id)) qMap.set(item.project_id, []);
      qMap.get(item.project_id).push(item);
    });
    (csRes.data || []).forEach(item => {
      if (!csMap.has(item.project_id)) csMap.set(item.project_id, []);
      csMap.get(item.project_id).push(item);
    });
    (exRes.data || []).forEach(item => {
      if (!exMap.has(item.project_id)) exMap.set(item.project_id, []);
      exMap.get(item.project_id).push(item);
    });
  } catch (err) {
    console.warn('Error fetching child items for scoped projects:', err);
  }
  return { qMap, csMap, exMap };
}

/**
 * 🎯 ดึงโปรเจกต์งานแบบระบุเดือนเจาะจง (Zero-Egress Scoped Loader)
 * ดึงเฉพาะแถวของเดือนที่เลือก (เช่น 2026-11)
 * พร้อมแคชลง IndexedDB และส่งข้อมูลกลับไปยัง UI ทันที
 */
export async function loadProjectsByMonth(yearMonth, onSyncUpdate, options = {}) {
  const client = getActiveClient();
  if (!yearMonth) return [];

  try {
    // 1. อ่านจาก IndexedDB ในเครื่องก่อนทันที (0 Latency, 0 Egress)
    const allLocal = await db.projects.toArray();
    const localInMonth = allLocal.filter(p => {
      const candidates = [p.rawDeliveryStart, p.rawDateTime, p.date, p.paymentDate, p.deliveryDate];
      for (const val of candidates) {
        if (!val) continue;
        if (typeof val === 'string') {
          if (val.startsWith(yearMonth)) return true;
          if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(val)) {
            const parts = val.split(' ')[0].split('/');
            let y = parseInt(parts[2], 10);
            if (y > 2500) y -= 543;
            const ym = `${y}-${String(parts[1]).padStart(2, '0')}`;
            if (ym === yearMonth) return true;
          }
        }
      }
      return false;
    });

    if (localInMonth.length > 0 && onSyncUpdate) {
      onSyncUpdate(localInMonth);
    }

    // 2. ดึงตรงจาก Supabase เฉพาะของเดือนนี้ (Strict Zero-Egress Explicit Projections)
    // 🚀 Progressive Loading: ดึง 50 แถวล่าสุดของเดือนนั้นก่อนทันที (Fast First Paint ~50ms)
    const bounds = getMonthDateBounds(yearMonth);
    const startStr = bounds.start;
    const endStr = bounds.end;
    const CHUNK_SIZE = 50;

    const { data: firstBatch, error, count } = await client
      .from('projects')
      .select(PROJECT_LIST_COLUMNS, { count: 'exact' })
      .gte('raw_delivery_start', startStr)
      .lte('raw_delivery_start', endStr)
      .order('raw_delivery_start', { ascending: false })
      .range(0, CHUNK_SIZE - 1);

    if (error) throw error;

    if (!firstBatch || firstBatch.length === 0) {
      // 🛡️ ป้องกันการล้างแคชท้องถิ่นหากเกิดปัญหา Auth Session / RLS
      const session = (await client.auth.getSession())?.data?.session;
      if (session && localInMonth.length > 0) {
        await db.projects.bulkDelete(localInMonth.map(p => p.id));
        if (onSyncUpdate) onSyncUpdate([], localInMonth.map(p => p.id));
      }
      return [];
    }

    let childData = { qMap: new Map(), csMap: new Map(), exMap: new Map() };
    if (options.includeDetails && firstBatch.length > 0) {
      childData = await fetchChildItemsForProjects(client, firstBatch);
    }

    const transformed1 = firstBatch.map(p => transformSupabaseProjectToUi(p, {
      quotationItems: childData.qMap.get(p.id) || [],
      customerSupport: childData.csMap.get(p.id) || [],
      expenses: childData.exMap.get(p.id) || []
    }));

    // บันทึก 50 แถวแรกทันทีลง IndexedDB และส่งอัปเดตหน้าบ้านทันที ให้เห็นข้อมูลในเสี้ยววินาที
    await db.projects.bulkPut(transformed1);
    if (onSyncUpdate) {
      onSyncUpdate(transformed1);
    }

    let allRemoteProjects = [...firstBatch];
    let allTransformed = transformed1;

    // ถ้าเดือนนั้นมีข้อมูลมากกว่า 50 แถว ให้แอบดึงส่วนที่เหลือแบบ Background ทันที
    if (count && count > CHUNK_SIZE) {
      console.log(`📡 Background Fetch: Month ${yearMonth} has ${count} records. Fetching remaining ${count - CHUNK_SIZE}...`);
      const { data: remainingBatch, error: remErr } = await client
        .from('projects')
        .select(PROJECT_LIST_COLUMNS)
        .gte('raw_delivery_start', startStr)
        .lte('raw_delivery_start', endStr)
        .order('raw_delivery_start', { ascending: false })
        .range(CHUNK_SIZE, count - 1);

      if (!remErr && remainingBatch && remainingBatch.length > 0) {
        let childData2 = { qMap: new Map(), csMap: new Map(), exMap: new Map() };
        if (options.includeDetails && remainingBatch.length > 0) {
          childData2 = await fetchChildItemsForProjects(client, remainingBatch);
        }

        const transformed2 = remainingBatch.map(p => transformSupabaseProjectToUi(p, {
          quotationItems: childData2.qMap.get(p.id) || [],
          customerSupport: childData2.csMap.get(p.id) || [],
          expenses: childData2.exMap.get(p.id) || []
        }));

        allRemoteProjects = [...firstBatch, ...remainingBatch];
        allTransformed = [...transformed1, ...transformed2];

        await db.projects.bulkPut(transformed2);
        if (onSyncUpdate) {
          onSyncUpdate(allTransformed);
        }
      }
    }

    // 🛡️ RECONCILE: กวาดล้างโปรเจกต์ที่ถูกลบออกจาก Supabase แล้ว ออกจาก IndexedDB ของเดือนนี้ทันที (0 Egress)
    const session = (await client.auth.getSession())?.data?.session;
    if (session) {
      const remoteIdSet = new Set(allRemoteProjects.map(p => p.id));
      const ghosts = localInMonth.filter(p => !remoteIdSet.has(p.id));
      if (ghosts.length > 0) {
        await db.projects.bulkDelete(ghosts.map(p => p.id));
        console.log(`🧹 Reconciled: purged ${ghosts.length} stale/deleted projects from IndexedDB for ${yearMonth}`);
        if (onSyncUpdate) {
          onSyncUpdate(allTransformed, ghosts.map(p => p.id));
        }
      }
    }

    return allTransformed;
  } catch (err) {
    console.error(`Error loading projects for month ${yearMonth}:`, err);
    return [];
  }
}

/**
 * 🎯 ZERO-EGRESS SCOPED LOADER: ดึงเฉพาะข้อมูลตามเงื่อนไขที่ผู้ใช้กำลังดูอยู่เท่านั้น
 * 1. ถ้า mode === 'date' (เช่น 2026-11-30): ดึงเฉพาะวันที่ 30 พ.ย. 2026
 * 2. ถ้า mode === 'month' (เช่น 2026-11): ดึงเฉพาะเดือน พ.ย. 2026
 * 3. ถ้า mode === 'range' (เช่น start - end): ดึงเฉพาะช่วงวันที่ระบุ
 * 4. เมื่อ includeDetails = true จะดึงเฉพาะตารางลูกของโปรเจกต์ใน Scope นั้นอย่างแม่นยำ
 */
export async function loadProjectsScoped({ mode = 'month', date = '', range = { start: '', end: '' }, includeDetails = false } = {}, onSyncUpdate) {
  const client = getActiveClient();
  try {
    let startStr = null;
    let endStr = null;
    let localFilterFn = null;

    if (mode === 'all') {
      // ดึงข้อมูลทั้งหมดทุกปีทุกเดือน (Zero-Filter)
      startStr = null;
      endStr = null;
      localFilterFn = null;
    } else if (mode === 'date' && date) {
      // ดึงเจาะจงเฉพาะวัน (เช่น 2026-11-30)
      startStr = `${date}T00:00:00`;
      endStr = `${date}T23:59:59`;
      localFilterFn = (p) => {
        const c = [p.rawDeliveryStart, p.rawDateTime, p.date, p.paymentDate];
        return c.some(v => v && String(v).startsWith(date));
      };
    } else if (mode === 'month' && date) {
      // ดึงเจาะจงเฉพาะเดือน (เช่น 2026-11)
      return await loadProjectsByMonth(date, onSyncUpdate, { includeDetails });
    } else if (mode === 'year' && date) {
      // ดึงเจาะจงเฉพาะปี (เช่น 2026)
      const yr = String(date).slice(0, 4);
      startStr = `${yr}-01-01T00:00:00`;
      endStr = `${yr}-12-31T23:59:59`;
      localFilterFn = (p) => {
        const c = [p.rawDeliveryStart, p.rawDateTime, p.date, p.paymentDate];
        return c.some(v => v && String(v).startsWith(yr));
      };
    } else if (mode === 'week' && date) {
      // ดึงเจาะจงเฉพาะสัปดาห์ (จันทร์ - อาทิตย์)
      const d = new Date(date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const startDay = monday.toISOString().slice(0, 10);
      const endDay = sunday.toISOString().slice(0, 10);
      startStr = `${startDay}T00:00:00`;
      endStr = `${endDay}T23:59:59`;
      localFilterFn = (p) => {
        const c = [p.rawDeliveryStart, p.rawDateTime, p.date, p.paymentDate];
        return c.some(v => {
          if (!v) return false;
          const s = String(v).slice(0, 10);
          return s >= startDay && s <= endDay;
        });
      };
    } else if (mode === 'range' && range?.start && range?.end) {
      // ดึงเจาะจงเฉพาะช่วงวันที่
      startStr = `${range.start}T00:00:00`;
      endStr = `${range.end}T23:59:59`;
      localFilterFn = (p) => {
        const c = [p.rawDeliveryStart, p.rawDateTime, p.date, p.paymentDate];
        return c.some(v => {
          if (!v) return false;
          const s = String(v).substring(0, 10);
          return s >= range.start && s <= range.end;
        });
      };
    } else {
      // ค่าเริ่มต้น: ดึงเฉพาะเดือนปัจจุบัน (ไม่ดึงทั้งก้อนของทุกปี)
      const now = new Date();
      const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      return await loadProjectsByMonth(curMonth, onSyncUpdate, { includeDetails });
    }

    // 1. อ่านจาก IndexedDB สำหรับ Scope นี้ก่อนทันที (0 Latency, 0 Egress)
    const allLocal = await db.projects.toArray();
    const localScoped = localFilterFn ? allLocal.filter(localFilterFn) : allLocal;
    if (localScoped.length > 0 && onSyncUpdate) {
      console.log(`⚡ Loaded ${localScoped.length} projects from local IndexedDB for scope (${mode}: ${date || range?.start || 'all'}).`);
      onSyncUpdate(localScoped);
    }

    // 2. ดึงตรงจาก Supabase เฉพาะช่วงวันที่กำหนดด้วย Explicit Projections
    // 🚀 Progressive Loading: 50 แถวล่าสุดก่อนทันที
    const CHUNK_SIZE = 50;
    let query = client
      .from('projects')
      .select(PROJECT_LIST_COLUMNS, { count: 'exact' });

    if (startStr && endStr) {
      query = query.gte('raw_delivery_start', startStr).lte('raw_delivery_start', endStr);
    }
    query = query.order('raw_delivery_start', { ascending: false }).range(0, CHUNK_SIZE - 1);

    const { data: firstBatch, error, count } = await query;
    if (error) throw error;

    if (!firstBatch || firstBatch.length === 0) {
      // 🛡️ ป้องกันการล้างแคชท้องถิ่นหากเกิดปัญหา Auth Session / RLS
      const session = (await client.auth.getSession())?.data?.session;
      if (session && localScoped.length > 0) {
        await db.projects.bulkDelete(localScoped.map(p => p.id));
        if (onSyncUpdate) onSyncUpdate([]);
      }
      return [];
    }

    let childData = { qMap: new Map(), csMap: new Map(), exMap: new Map() };
    if (includeDetails && firstBatch.length > 0) {
      childData = await fetchChildItemsForProjects(client, firstBatch);
    }

    const transformed1 = firstBatch.map(p => transformSupabaseProjectToUi(p, {
      quotationItems: childData.qMap.get(p.id) || [],
      customerSupport: childData.csMap.get(p.id) || [],
      expenses: childData.exMap.get(p.id) || []
    }));

    await db.projects.bulkPut(transformed1);
    if (onSyncUpdate) {
      onSyncUpdate(transformed1);
    }

    let allRemoteProjects = [...firstBatch];
    let allTransformed = transformed1;

    // ถ้าข้อมูลมีมากกว่า CHUNK_SIZE ให้โหลดส่วนที่เหลือแบบ Background เป็น Chunks
    if (count && count > CHUNK_SIZE) {
      let currentOffset = CHUNK_SIZE;
      const BATCH_STEP = 500;
      while (currentOffset < count) {
        const nextOffset = Math.min(currentOffset + BATCH_STEP - 1, count - 1);
        const expectedCount = nextOffset - currentOffset + 1;
        let remQuery = client
          .from('projects')
          .select(PROJECT_LIST_COLUMNS);
        if (startStr && endStr) {
          remQuery = remQuery.gte('raw_delivery_start', startStr).lte('raw_delivery_start', endStr);
        }
        remQuery = remQuery.order('raw_delivery_start', { ascending: false }).range(currentOffset, nextOffset);

        const { data: remBatch, error: remErr } = await remQuery;
        if (remErr || !remBatch || remBatch.length === 0) break;

        let childData2 = { qMap: new Map(), csMap: new Map(), exMap: new Map() };
        if (includeDetails && remBatch.length > 0) {
          childData2 = await fetchChildItemsForProjects(client, remBatch);
        }

        const transformed2 = remBatch.map(p => transformSupabaseProjectToUi(p, {
          quotationItems: childData2.qMap.get(p.id) || [],
          customerSupport: childData2.csMap.get(p.id) || [],
          expenses: childData2.exMap.get(p.id) || []
        }));

        allRemoteProjects = [...allRemoteProjects, ...remBatch];
        allTransformed = [...allTransformed, ...transformed2];

        await db.projects.bulkPut(transformed2);
        if (onSyncUpdate) {
          onSyncUpdate(allTransformed);
        }

        currentOffset += remBatch.length;
        if (remBatch.length < expectedCount) break;
      }
    }

    // Reconcile ลบรายการที่ถูกลบออกจาก Server ออกจาก IndexedDB เฉพาะของ Scope นี้
    // ทำเฉพาะเมื่อดึงข้อมูลครบทุก Batch แล้วเท่านั้น (ป้องกันลบแคชผิดพลาด)
    const session = (await client.auth.getSession())?.data?.session;
    if (session && allRemoteProjects.length >= (count || 0)) {
      const remoteIdSet = new Set(allRemoteProjects.map(p => p.id));
      const ghosts = localScoped.filter(p => !remoteIdSet.has(p.id));
      if (ghosts.length > 0) {
        await db.projects.bulkDelete(ghosts.map(p => p.id));
        console.log(`🧹 Reconciled: purged ${ghosts.length} stale projects from IndexedDB for scope.`);
        if (onSyncUpdate) {
          onSyncUpdate(allTransformed, ghosts.map(p => p.id));
        }
      }
    }

    return allTransformed;
  } catch (err) {
    console.error(`Error in loadProjectsScoped (${mode}: ${date}):`, err);
    return [];
  }
}

export async function loadProjectsLocalFirst(onSyncUpdate, options = {}) {
  return await loadProjectsScoped(options, onSyncUpdate);
}

// 2. บันทึกโปรเจกต์งานลง Supabase + IndexedDB
export async function saveProjectSync(activityData) {
  const validated = validatePayload(projectPayloadSchema, activityData, 'Project');
  const client = getActiveClient();
  const { projectRow, quotationItems, customerSupport, expenses } = transformUiToSupabase(validated);

  // ก. บันทึกลง IndexedDB ในเครื่องทันที (Optimistic Write - หน้าจอไม่ค้าง)
  await db.projects.put(validated);

  // ข. ส่งขึ้น Supabase
  try {
    const { error: projErr } = await client
      .from('projects')
      .upsert(projectRow, { onConflict: 'id' });

    if (projErr) throw projErr;

    // อัปเดตตารางลูก (ลบของเก่าแล้วใส่ชุดใหม่)
    await Promise.all([
      client.from('project_quotation_items').delete().eq('project_id', activityData.id),
      client.from('project_customer_support').delete().eq('project_id', activityData.id),
      client.from('project_expenses').delete().eq('project_id', activityData.id)
    ]);

    await Promise.all([
      quotationItems.length > 0 ? client.from('project_quotation_items').insert(quotationItems) : Promise.resolve(),
      customerSupport.length > 0 ? client.from('project_customer_support').insert(customerSupport) : Promise.resolve(),
      expenses.length > 0 ? client.from('project_expenses').insert(expenses) : Promise.resolve()
    ]);

    console.log(`✅ Saved project ${activityData.id} to Supabase successfully.`);
    return { success: true };
  } catch (err) {
    console.error(`❌ Failed to save project ${activityData.id} to Supabase:`, err);
    throw err;
  }
}

// 3. ลบโปรเจกต์งานจาก Supabase + IndexedDB
export async function deleteProjectSync(id) {
  const client = getActiveClient();
  // ก. ลบจาก IndexedDB ทันที
  await db.projects.delete(id);

  // ข. กระจายสัญญาณลบแบบ Real-Time ทั่วทุกแท็บและทุกอุปกรณ์ (Zero Stale IndexedDB)
  broadcastRecordDeleted('projects', id);

  // ค. บันทึกลง deleted_records บน Supabase เป็น Tombstone เพื่อให้อุปกรณ์อื่น (เช่น เครื่อง B) กวาดล้างตาม
  try {
    await client.from('deleted_records').insert({
      record_id: id,
      table_name: 'projects',
      deleted_at: new Date().toISOString()
    });
  } catch (tombErr) {
    console.warn('Tombstone insert notice:', tombErr?.message);
  }

  // ง. ลบจาก Supabase
  try {
    const { error } = await client.from('projects').delete().eq('id', id);
    if (error) throw error;
    console.log(`✅ Deleted project ${id} from Supabase.`);
    return { success: true };
  } catch (err) {
    console.error(`❌ Failed to delete project ${id} from Supabase:`, err);
    throw err;
  }
}

// 4. ระบบ Realtime Subscription (เมื่อหน้าจออื่นแก้ หน้าจอเราจะเด้งอัปเดตสดทันที!)
export function subscribeToRealtimeProjects(onUpdate) {
  const client = getActiveClient();
  const channel = client
    .channel('realtime-projects-channel')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'projects' },
      async (payload) => {
        console.log('⚡ Realtime Event from Supabase:', payload.eventType, payload.new?.id || payload.old?.id);

        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const row = payload.new;
          const [qRes, csRes, exRes] = await Promise.all([
            client.from('project_quotation_items').select(QUOTATION_COLUMNS).eq('project_id', row.id),
            client.from('project_customer_support').select(SUPPORT_COLUMNS).eq('project_id', row.id),
            client.from('project_expenses').select(EXPENSE_COLUMNS).eq('project_id', row.id)
          ]);
          const uiItem = transformSupabaseProjectToUi(row, {
            quotationItems: qRes.data || [],
            customerSupport: csRes.data || [],
            expenses: exRes.data || []
          });

          await db.projects.put(uiItem);
          const all = await db.projects.toArray();
          if (onUpdate) onUpdate(all);
        } else if (payload.eventType === 'DELETE') {
          const deletedId = payload.old?.id;
          if (deletedId) {
            await db.projects.delete(deletedId);
            const all = await db.projects.toArray();
            if (onUpdate) onUpdate(all);
          }
        }
      }
    )
    .subscribe((status, err) => {
      console.log('⚡ Realtime connection status:', status, err || '');
    });

  return () => {
    client.removeChannel(channel);
  };
}

// 4.1 ระบบ Realtime Subscription สำหรับการตั้งค่าร้านและธีม (เมื่ออีกจอหรืออีกเครื่องเปลี่ยน ธีมเปลี่ยนสดทันที)
export function subscribeToRealtimeSettings(onUpdate) {
  const client = getActiveClient();
  if (!client) return () => {};

  const channel = client
    .channel('realtime-shop-settings-channel')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'shop_settings' },
      async (payload) => {
        if (payload.new) {
          const s = payload.new;
          const updatedShopInfo = {
            shopName: s.shop_name || 'Flower2you',
            phone: s.phone || '',
            email: s.email || '',
            address: s.address || '',
            line: s.line_id || '',
            facebook: s.facebook || '',
            instagram: s.instagram || '',
            tiktok: s.tiktok || '',
            twitter: s.twitter || '',
            wechat: s.wechat || '',
            telegram: s.telegram || '',
            logo: s.logo_url || '',
            themeColor: s.theme_color || 'violet',
            themeMode: s.theme_mode || 'gradient',
            customColorValue: s.custom_color_value || '#000000'
          };
          if (onUpdate) onUpdate(updatedShopInfo, s);
        }
      }
    )
    .subscribe();

  return () => {
    try {
      client.removeChannel(channel);
    } catch (e) {}
  };
}

// 4.2 ระบบกระจายสัญญาณการลบข้อมูลข้ามแท็บและข้ามอุปกรณ์แบบ Real-Time (Zero-Egress & Zero-Stale IndexedDB)
export function broadcastRecordDeleted(table, id) {
  if (!id || !table) return;

  // 1. กระจายสัญญาณข้ามแท็บในเบราว์เซอร์เดียวกันผ่าน BroadcastChannel
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('flower2u_sync_channel');
      bc.postMessage({ type: 'RECORD_DELETED', table, id });
      bc.close();
    }
  } catch (e) {}

  // 2. กระจายสัญญาณข้ามอุปกรณ์ผ่าน Supabase Realtime Broadcast (ใช้ Egress ไม่กี่ไบต์)
  try {
    const client = getActiveClient();
    if (client) {
      const ch = client.channel('flower2u_global_sync');
      ch.send({
        type: 'broadcast',
        event: 'RECORD_DELETED',
        payload: { table, id }
      }).catch(() => {});
    }
  } catch (e) {}
}

// 4.3 ระบบกระจายสัญญาณการปรับปรุงสิทธิ์บทบาทแบบ Real-Time (เมนูเด้งขึ้นทันทีไม่ต้องกดรีเฟรช)
export function broadcastPermissionsUpdated(permissions) {
  if (!permissions) return;

  // 1. แจ้งเตือนภายในหน้าต่างปัจจุบัน
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('f2u_permissions_updated', { detail: permissions }));
  }

  // 2. กระจายสัญญาณข้ามแท็บในเบราว์เซอร์เดียวกัน
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('flower2u_sync_channel');
      bc.postMessage({ type: 'PERMISSIONS_UPDATED', permissions });
      bc.close();
    }
  } catch (e) {}

  // 3. กระจายสัญญาณข้ามอุปกรณ์ผ่าน Supabase Realtime Broadcast
  try {
    const client = getActiveClient();
    if (client) {
      const ch = client.channel('flower2u_global_sync');
      ch.send({
        type: 'broadcast',
        event: 'PERMISSIONS_UPDATED',
        payload: { permissions }
      }).catch(() => {});
    }
  } catch (e) {}
}

// 4.4 ระบบ Realtime Subscription สำหรับ Roles & Permissions ข้ามอุปกรณ์
export function subscribeToRolesRealtime(onRolesUpdate) {
  const client = getActiveClient();
  if (!client) return () => {};

  const channel = client
    .channel('realtime-roles-channel')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'roles' },
      async () => {
        try {
          const { data, error } = await client.from('roles').select('*');
          if (!error && Array.isArray(data) && data.length > 0) {
            const matrix = {};
            data.forEach(r => {
              matrix[r.name] = {
                label: r.label || r.name,
                code: r.code || '99',
                description: r.description || '',
                allowed_pages: r.allowed_pages || [],
                can_edit_pricing: !!r.can_edit_pricing,
                can_delete_project: !!r.can_delete_project,
                can_borrow_tools: r.can_borrow_tools !== undefined ? !!r.can_borrow_tools : true,
                can_manage_users: !!r.can_manage_users,
                is_system_role: !!r.is_system_role
              };
            });
            if (typeof window !== 'undefined') {
              try {
                const prev = JSON.parse(localStorage.getItem('f2u_role_permissions') || '{}');
                const merged = { ...prev, ...matrix };
                localStorage.setItem('f2u_role_permissions', JSON.stringify(merged));
                window.dispatchEvent(new CustomEvent('f2u_permissions_updated', { detail: merged }));
                if (onRolesUpdate) onRolesUpdate(merged);
              } catch (e) {}
            }
          }
        } catch (err) {
          console.warn('Realtime roles fetch notice:', err);
        }
      }
    )
    .on(
      'broadcast',
      { event: 'PERMISSIONS_UPDATED' },
      ({ payload }) => {
        if (payload?.permissions) {
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('f2u_role_permissions', JSON.stringify(payload.permissions));
              window.dispatchEvent(new CustomEvent('f2u_permissions_updated', { detail: payload.permissions }));
            } catch (e) {}
          }
          if (onRolesUpdate) onRolesUpdate(payload.permissions);
        }
      }
    )
    .subscribe();

  return () => {
    try {
      client.removeChannel(channel);
    } catch (e) {}
  };
}

// 4.5 กวาดล้างข้อมูลที่ถูกลบออกจาก Supabase (Zero-Egress Tombstone Reconcile)
export async function syncDeletedRecords(onProjectsDeleted) {
  const client = getActiveClient();
  if (!client) return [];
  try {
    const syncMeta = await db.sync_meta.get('last_deleted_synced_at');
    const lastDeletedSyncedAt = syncMeta ? syncMeta.value : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: deleted, error } = await client
      .from('deleted_records')
      .select('record_id, table_name, deleted_at')
      .gt('deleted_at', lastDeletedSyncedAt)
      .order('deleted_at', { ascending: true })
      .limit(1000);

    const deletedProjectIds = [];
    if (!error && Array.isArray(deleted) && deleted.length > 0) {
      for (const rec of deleted) {
        const tbl = rec.table_name;
        const id = rec.record_id;
        if (tbl === 'projects') {
          deletedProjectIds.push(id);
          await db.projects.delete(id).catch(() => {});
        } else if (db[tbl]) {
          await db[tbl].delete(id).catch(() => {});
        }
      }
      const newest = deleted[deleted.length - 1].deleted_at;
      await db.sync_meta.put({ key: 'last_deleted_synced_at', value: newest });
      console.log(`🧹 Purged ${deleted.length} remotely deleted records across tables.`);

      if (deletedProjectIds.length > 0 && onProjectsDeleted) {
        onProjectsDeleted(deletedProjectIds);
      }
    }
    return deletedProjectIds;
  } catch (err) {
    return [];
  }
}

// 5. โหลดการตั้งค่าร้านและพนักงานจาก Supabase
export async function loadSettingsFromSupabase() {
  const client = getActiveClient();
  try {
    const [shopRes, staffRes, rolesRes] = await Promise.all([
      client.from('shop_settings').select(SHOP_SETTINGS_COLUMNS).limit(1).maybeSingle(),
      client.from('staff_users').select(STAFF_COLUMNS),
      client.from('roles').select(ROLE_COLUMNS)
    ]);

    const s = shopRes.data || {};
    const shopInfo = {
      shopName: s.shop_name || 'Flower2you',
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      line: s.line_id || '',
      facebook: s.facebook || '',
      instagram: s.instagram || '',
      tiktok: s.tiktok || '',
      twitter: s.twitter || '',
      wechat: s.wechat || '',
      telegram: s.telegram || '',
      logo: s.logo_url || '',
      themeColor: s.theme_color || 'rose',
      themeMode: s.theme_mode || 'gradient',
      customColorValue: s.custom_color_value || '#000000'
    };

    let driveFolders = [
      { id: 'ref_default', name: 'รูปภาพอ้างอิง (Drive)', folderId: s.reference_folder_id || '', type: 'reference' },
      { id: 'assets_default', name: 'สินทรัพย์/อุปกรณ์ (Drive)', folderId: s.assets_folder_id || '', type: 'assets' },
      { id: 'slips_default', name: 'สลิปโอนเงิน (Drive)', folderId: s.slips_folder_id || '', type: 'slips' }
    ];

    if (s.drive_folders && Array.isArray(s.drive_folders) && s.drive_folders.length > 0) {
      driveFolders = s.drive_folders;
    }

    // Zero-Leakage: ห้ามแนบรหัสผ่านลงใน client credentials เด็ดขาด
    const appCredentials = (staffRes.data || []).map(u => ({
      username: u.username,
      staffCode: u.staff_code || u.id || '',
      name: u.full_name || u.nickname || u.username,
      role: u.roles?.name || 'admin',
      roleCode: u.roles?.role_code || (u.roles?.name === 'admin' ? '11' : '21'),
      roleLabel: u.roles?.label || 'ผู้ดูแลระบบ',
      email: u.email || '',
      phone: u.phone || '',
      image: u.profile_image_url || ''
    }));

    return {
      shopInfo,
      driveFolders,
      referenceFolderId: s.reference_folder_id || '',
      assetsFolderId: s.assets_folder_id || '',
      slipsFolderId: s.slips_folder_id || '',
      lineBotToken: s.line_bot_token || '',
      telegramBotToken: s.telegram_bot_token || '',
      telegramChatId: s.telegram_chat_id || '',
      projectCategories: s.project_categories || null,
      expenseCategories: s.expense_categories || null,
      dealStatuses: s.deal_statuses || null,
      transportStatuses: s.transport_statuses || null,
      appCredentials,
      roles: rolesRes.data || []
    };
  } catch (err) {
    console.error('Error loading settings from Supabase:', err);
    return null;
  }
}

// 5.1 โหลดเฉพาะ Branding สาธารณะ (สำหรับหน้า Login และหน้าสาธารณะ - ห้ามแตะต้อง staff_users หรือรหัสผ่าน)
export async function loadPublicBrandingFromSupabase() {
  const client = getActiveClient();
  try {
    const PUBLIC_BRANDING_COLUMNS = 'id,shop_name,phone,email,address,line_id,facebook,instagram,tiktok,twitter,wechat,telegram,logo_url,theme_color,theme_mode,custom_color_value,deal_statuses,transport_statuses,updated_at';
    const { data: s } = await client.from('shop_settings').select(PUBLIC_BRANDING_COLUMNS).limit(1).maybeSingle();
    
    if (!s) return null;

    const shopInfo = {
      shopName: s.shop_name || 'Flower2you',
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      line: s.line_id || '',
      facebook: s.facebook || '',
      instagram: s.instagram || '',
      tiktok: s.tiktok || '',
      twitter: s.twitter || '',
      wechat: s.wechat || '',
      telegram: s.telegram || '',
      logo: s.logo_url || '',
      themeColor: s.theme_color || 'rose',
      themeMode: s.theme_mode || 'gradient',
      customColorValue: s.custom_color_value || '#000000'
    };

    return {
      shopInfo,
      dealStatuses: s.deal_statuses || null,
      transportStatuses: s.transport_statuses || null
    };
  } catch (err) {
    console.error('Error loading public branding from Supabase:', err);
    return null;
  }
}

// 5.2 ตรวจสอบรหัสผ่านพนักงานผ่าน Server-Side RPC (ไม่ส่งรหัสผ่านทุกคนลงมาที่เบราว์เซอร์)
export async function verifyStaffLogin(identifier, password) {
  if (!identifier || !password) {
    return { success: false, error: 'EMPTY_CREDENTIALS' };
  }

  const client = getActiveClient();
  try {
    // 1. เรียกใช้งาน Server-Side RPC เพื่อตรวจสอบรหัสผ่านบน Supabase
    const { data, error } = await client.rpc('verify_staff_login', {
      p_identifier: identifier,
      p_password: password
    });

    if (!error && data) {
      return data;
    }

    // 🛡️ หาก RPC แจ้งเตือนว่าบัญชีถูกระงับการใช้งาน
    if (data?.error === 'ACCOUNT_SUSPENDED') {
      return data;
    }

    // 2. Fallback ชั่วคราวกรณีที่แอดมินยังไม่ได้รัน SQL สร้าง RPC บน Supabase
    if (error && (error.code === 'PGRST202' || error.message?.includes('not found') || error.status === 404)) {
      console.warn('RPC verify_staff_login not found, using direct fallback query...');
      const cleanId = (identifier || '').trim().toLowerCase();
      const { data: staffList } = await client
        .from('staff_users')
        .select('id, username, password, full_name, nickname, phone, email, profile_image_url, is_active, roles(name, label, code, allowed_pages)')
        .eq('is_active', true);

      if (staffList && staffList.length > 0) {
        const found = staffList.find(u => 
          (u.username?.toLowerCase() === cleanId || String(u.id).toLowerCase() === cleanId) &&
          u.password === password
        );

        if (found) {
          return {
            success: true,
            user: {
              username: found.username,
              staffCode: found.id,
              name: found.full_name || found.nickname || found.username,
              role: found.roles?.name || 'admin',
              roleCode: found.roles?.code || '11',
              roleLabel: found.roles?.label || 'ผู้ดูแลระบบ',
              allowedPages: found.roles?.allowed_pages || ['Calendar', 'Plans'],
              email: found.email || '',
              phone: found.phone || '',
              image: found.profile_image_url || ''
            }
          };
        }
      }
    }

    return { success: false, error: 'INVALID_CREDENTIALS' };
  } catch (err) {
    console.error('Error verifying staff login:', err);
    return { success: false, error: err.message };
  }
}

// 5.3 ดึงข้อมูลเฉพาะโปรเจกต์เดียวนั้นสำหรับหน้าติดตามงานและใบเสนอราคาสาธารณะ (Public Single Project Lookup)
export async function fetchPublicProjectByToken(token) {
  if (!token) return null;
  const client = getActiveClient();
  try {
    // 1. เรียกใช้งาน Server-Side RPC ดึงเฉพาะโปรเจกต์ที่ได้รับอนุญาตเท่านั้น (Zero-Egress & Zero-Leakage)
    const { data, error } = await client.rpc('get_public_project_by_token', {
      p_token: token
    });

    if (!error && data) {
      return data;
    }

    // 🛡️ หาก RPC แจ้งเตือนว่าบัญชีถูกระงับการใช้งาน
    if (data?.error === 'ACCOUNT_SUSPENDED') {
      return data;
    }

    // 2. Fallback ชั่วคราวกรณีที่แอดมินยังไม่ได้รัน SQL สร้าง RPC บน Supabase
    if (error && (error.code === 'PGRST202' || error.message?.includes('not found') || error.status === 404)) {
      console.warn('RPC get_public_project_by_token not found, fallback to direct query...');
      const { data: projects } = await client
        .from('projects')
        .select(`
          *,
          project_quotation_items (*),
          project_customer_support (*)
        `)
        .limit(350);

      if (projects && projects.length > 0) {
        const match = projects.find(p => {
          const rawDt = (p.raw_delivery_start || p.project_datetime || '').substring(0, 16);
          return generateTrackingToken(p.id, rawDt) === token || p.id === token;
        });

        if (match) {
          return {
            id: match.id,
            name: match.name,
            category: match.category,
            artist: match.artist_name || '',
            customer: match.customer_name || '',
            customerPhone: match.customer_phone || '',
            customerLine: match.customer_line || '',
            recipient: match.recipient_name || '',
            recipientPhone: match.recipient_phone || '',
            location: match.location_name || '',
            mapLink: match.map_link || '',
            rawDateTime: (match.raw_delivery_start || match.project_datetime || '').substring(0, 16),
            date: match.raw_delivery_start ? match.raw_delivery_start.substring(0, 10) : '',
            deliveryDate: match.delivery_date_display || '',
            dealStatus: match.deal_status || 'custom-1771415025673',
            transportStatus: match.transport_status || 'custom-1771415278809',
            paymentStatus: match.payment_status || 'unpaid',
            wage: match.wage || 0,
            deliveryFee: match.delivery_fee || 0,
            depositAmount: match.deposit_amount || 0,
            image: match.primary_image_url || '',
            images: match.images || [],
            note: match.note || '',
            quotationItems: (match.project_quotation_items || []).map(q => ({
              id: q.id,
              category: q.category,
              detail: q.detail,
              price: q.price,
              quantity: q.quantity,
              unit: q.unit,
              total: q.total
            })),
            customerSupport: (match.project_customer_support || []).map(s => ({
              id: s.id,
              itemType: s.item_type,
              detail: s.detail,
              price: s.price,
              quantity: s.quantity
            }))
          };
        }
      }
    }

    return null;
  } catch (err) {
    console.error('Error fetching public project by token:', err);
    return null;
  }
}

// 6. บันทึกการตั้งค่าร้านลง Supabase
export async function saveSettingsToSupabase(partialData) {
  const client = getActiveClient();
  try {
    const { data: existing } = await client.from('shop_settings').select('id').limit(1).maybeSingle();
    const updatePayload = {};

    if (partialData.shop_info) {
      const s = partialData.shop_info;
      if (s.shopName !== undefined) updatePayload.shop_name = s.shopName;
      if (s.phone !== undefined) updatePayload.phone = s.phone;
      if (s.email !== undefined) updatePayload.email = s.email;
      if (s.address !== undefined) updatePayload.address = s.address;
      if (s.line !== undefined) updatePayload.line_id = s.line;
      if (s.facebook !== undefined) updatePayload.facebook = s.facebook;
      if (s.instagram !== undefined) updatePayload.instagram = s.instagram;
      if (s.tiktok !== undefined) updatePayload.tiktok = s.tiktok;
      if (s.twitter !== undefined) updatePayload.twitter = s.twitter;
      if (s.wechat !== undefined) updatePayload.wechat = s.wechat;
      if (s.telegram !== undefined) updatePayload.telegram = s.telegram;
      if (s.logo !== undefined) updatePayload.logo_url = s.logo;
      if (s.themeColor !== undefined) updatePayload.theme_color = s.themeColor;
      if (s.themeMode !== undefined) updatePayload.theme_mode = s.themeMode;
      if (s.customColorValue !== undefined) updatePayload.custom_color_value = s.customColorValue;
    }

    if (partialData.drive_folder_id !== undefined) updatePayload.reference_folder_id = partialData.drive_folder_id;
    if (partialData.assets_drive_folder_id !== undefined) updatePayload.assets_folder_id = partialData.assets_drive_folder_id;
    if (partialData.drive_folders && Array.isArray(partialData.drive_folders)) {
      const ref = partialData.drive_folders.find(f => f.type === 'reference');
      const ass = partialData.drive_folders.find(f => f.type === 'assets');
      const slp = partialData.drive_folders.find(f => f.type === 'slips');
      if (ref?.folderId) updatePayload.reference_folder_id = ref.folderId;
      if (ass?.folderId) updatePayload.assets_folder_id = ass.folderId;
      if (slp?.folderId) updatePayload.slips_folder_id = slp.folderId;
    }
    if (partialData.line_bot_token !== undefined) updatePayload.line_bot_token = partialData.line_bot_token;
    if (partialData.telegram_bot_token !== undefined) updatePayload.telegram_bot_token = partialData.telegram_bot_token;
    if (partialData.telegram_chat_id !== undefined) updatePayload.telegram_chat_id = String(partialData.telegram_chat_id);

    if (Object.keys(updatePayload).length > 0) {
      if (existing?.id) {
        await client.from('shop_settings').update(updatePayload).eq('id', existing.id);
      } else {
        await client.from('shop_settings').insert([updatePayload]);
      }
    }

    // อัปเดตข้อมูลพนักงานใน staff_users หากมีการแก้ไขรูปหรือโปรไฟล์
    if (partialData.app_credentials && Array.isArray(partialData.app_credentials)) {
      for (const cred of partialData.app_credentials) {
        if (!cred.username) continue;
        const staffPayload = {
          full_name: cred.name || cred.username,
          phone: cred.phone || '',
          profile_image_url: cred.image || ''
        };
        try {
          await client.from('staff_users').update(staffPayload).ilike('username', cred.username);
        } catch (e) {
          console.warn('Could not update staff user profile:', cred.username, e);
        }
      }
    }

    return { success: true };
  } catch (err) {
    console.error('Error saving settings to Supabase:', err);
    throw err;
  }
}

// 7. โหลดข้อมูลสถานที่จัดส่งแบบ Local-First (อ่าน IndexedDB 0ms แล้วแอบซิงก์จาก Supabase)
export async function loadLocationsLocalFirst(onUpdate) {
  try {
    const cached = await db.delivery_locations.toArray();
    if (cached.length > 0 && onUpdate) {
      onUpdate(cached);
    }

    const client = getActiveClient();
    const { data: cloudLocations, error } = await client
      .from('delivery_locations')
      .select(LOCATION_COLUMNS)
      .order('name');

    if (!error && Array.isArray(cloudLocations)) {
      await db.delivery_locations.clear();
      if (cloudLocations.length > 0) {
        await db.delivery_locations.bulkPut(cloudLocations);
      }
      if (onUpdate) onUpdate(cloudLocations);
      return cloudLocations;
    }

    return cached;
  } catch (err) {
    console.warn('Load locations notice:', err);
    return [];
  }
}

// 8. บันทึกหรือสร้างสถานที่จัดส่งใหม่ลง Supabase & IndexedDB
export async function saveLocationSync(locationData) {
  const validated = validatePayload(locationPayloadSchema, locationData, 'Location');
  const client = getActiveClient();
  try {
    const payload = { ...validated };
    if (payload.id && !isValidUuid(payload.id)) {
      delete payload.id;
    }

    const { data, error } = await client
      .from('delivery_locations')
      .upsert(payload, { onConflict: 'name' })
      .select()
      .single();

    if (error) throw error;
    if (data) {
      await db.delivery_locations.put(data);
    }
    return data;
  } catch (err) {
    console.error('Save location error:', err);
    throw err;
  }
}

export async function deleteLocationSync(locationId) {
  const client = getActiveClient();
  try {
    await client.from('delivery_locations').delete().eq('id', locationId);
  } catch (cErr) {}
  await db.delivery_locations.delete(locationId);
  broadcastRecordDeleted('delivery_locations', locationId);
  return true;
}

// 9. คำนวณผลสรุปการเงินบน Supabase Server (Zero-Egress Server Pushdown Aggregation)
// ส่งเฉพาะผลสรุปสุดท้ายขนาด ~1.5 KB กลับมา ไม่โหลดโปรเจกต์รายบรรทัด
export async function fetchServerAnalytics(filters = {}) {
  const client = getActiveClient();
  let startDate = filters.startDate || null;
  let endDate = filters.endDate || null;

  if (!startDate && !endDate) {
    if (filters.mode === 'month' && filters.date) {
      const bounds = getMonthDateBounds(filters.date);
      startDate = bounds.start ? bounds.start.split('T')[0] : null;
      endDate = bounds.end ? bounds.end.split('T')[0] : null;
    } else if (filters.mode === 'date' && filters.date) {
      startDate = filters.date;
      endDate = filters.date;
    } else if (filters.mode === 'range' && filters.range?.start && filters.range?.end) {
      startDate = filters.range.start;
      endDate = filters.range.end;
    }
  }

  const rpcParams = {
    p_start_date: startDate ? `${startDate}T00:00:00Z` : null,
    p_end_date: endDate ? `${endDate}T23:59:59Z` : null,
    p_category: filters.category && filters.category !== 'all' ? filters.category : null,
    p_deal_status: filters.dealStatus && filters.dealStatus !== 'all' ? filters.dealStatus : null
  };

  try {
    const { data, error } = await client.rpc('get_complete_analytics', rpcParams);
    if (!error && data) return data;
  } catch (err) {
    console.warn('get_complete_analytics notice, trying fallback RPC:', err);
  }

  // Fallback to get_financial_analytics with date range pushdown
  try {
    const { data, error } = await client.rpc('get_financial_analytics', rpcParams);
    if (!error && data) {
      return {
        totals: {
          total_revenue: data.total_revenue || 0,
          total_customer_support: data.total_customer_support || 0,
          total_expenses: data.total_expenses || 0,
          total_net_profit: data.total_net_profit || 0,
          total_orders: data.total_orders || 0,
          avg_order_value: data.total_orders > 0 ? Math.round(data.total_revenue / data.total_orders) : 0,
          avg_support_value: data.total_orders > 0 ? Math.round(data.total_customer_support / data.total_orders) : 0,
          net_margin_percent: data.total_revenue > 0 ? ((data.total_net_profit / data.total_revenue) * 100).toFixed(1) : '0.0'
        },
        status_counts: {
          total: data.total_orders || 0,
          completed: data.paid_orders_count || 0,
          active: data.unpaid_orders_count || 0,
          pending: 0,
          issue: 0,
          declined: 0
        },
        banknotes: {},
        expenses: [],
        categories: [],
        top_artists: [],
        top_customers: [],
        top_venues: [],
        low_margin: []
      };
    }
  } catch (fallbackErr) {
    console.error('All analytics RPC failed:', fallbackErr);
  }
  return null;
}

export async function loadProjectsPaginated({ start = 0, limit = 20, append = true } = {}) {
  const client = getActiveClient();
  try {
    const end = start + limit - 1;
    const { data: projects, error } = await client
      .from('projects')
      .select(PROJECT_LIST_COLUMNS)
      .order('id', { ascending: false })
      .range(start, end);

    if (error) throw error;
    if (!projects || projects.length === 0) return { items: [], hasMore: false };

    const projectIds = projects.map(p => p.id);
    const [qRes, csRes, exRes] = await Promise.all([
      client.from('project_quotation_items').select(QUOTATION_COLUMNS).in('project_id', projectIds),
      client.from('project_customer_support').select(SUPPORT_COLUMNS).in('project_id', projectIds),
      client.from('project_expenses').select(EXPENSE_COLUMNS).in('project_id', projectIds)
    ]);

    const qMap = new Map();
    (qRes.data || []).forEach(item => {
      if (!qMap.has(item.project_id)) qMap.set(item.project_id, []);
      qMap.get(item.project_id).push(item);
    });

    const csMap = new Map();
    (csRes.data || []).forEach(item => {
      if (!csMap.has(item.project_id)) csMap.set(item.project_id, []);
      csMap.get(item.project_id).push(item);
    });

    const exMap = new Map();
    (exRes.data || []).forEach(item => {
      if (!exMap.has(item.project_id)) exMap.set(item.project_id, []);
      exMap.get(item.project_id).push(item);
    });

    const transformed = projects.map(p => transformSupabaseProjectToUi(p, {
      quotationItems: qMap.get(p.id) || [],
      customerSupport: csMap.get(p.id) || [],
      expenses: exMap.get(p.id) || []
    }));

    if (!append) {
      await db.projects.clear();
    }
    await db.projects.bulkPut(transformed);

    return {
      items: transformed,
      hasMore: projects.length === limit
    };
  } catch (err) {
    console.error('Paginated fetch error:', err);
    return { items: [], hasMore: false };
  }
}

// 11. ดึงข้อมูลรูปภาพ สลิป และตารางลูกแบบ On-Demand (JIT) เฉพาะตอนเปิดดูโปรเจกต์นั้นจริงๆ (Zero-Egress)
export async function fetchProjectDetailOnDemand(projectId) {
  if (!projectId) return null;
  const client = getActiveClient();
  try {
    const [detailRes, qRes, csRes, exRes] = await Promise.all([
      client.from('projects').select(PROJECT_DETAIL_COLUMNS).eq('id', projectId).maybeSingle(),
      client.from('project_quotation_items').select(QUOTATION_COLUMNS).eq('project_id', projectId),
      client.from('project_customer_support').select(SUPPORT_COLUMNS).eq('project_id', projectId),
      client.from('project_expenses').select(EXPENSE_COLUMNS).eq('project_id', projectId)
    ]);

    const data = detailRes.data || {};
    const existing = (await db.projects.get(projectId)) || {};

    const qItems = (qRes.data || []).map(q => ({
      id: q.id,
      category: q.category || '',
      detail: q.detail || '',
      quantity: Number(q.quantity) || 1,
      unitPrice: Number(q.unit_price) || 0,
      price: Number(q.price) || 0,
      date: q.item_date || ''
    }));

    const csItems = (csRes.data || []).map(cs => ({
      id: cs.id,
      denomination: Number(cs.denomination) || 0,
      quantity: Number(cs.quantity) || 0,
      price: Number(cs.price) || 0,
      date: cs.item_date || ''
    }));

    const exItems = (exRes.data || []).map(ex => ({
      id: ex.id,
      category: ex.category || '',
      detail: ex.detail || '',
      quantity: Number(ex.quantity) || 1,
      unitPrice: Number(ex.unit_price) || 0,
      price: Number(ex.price) || 0,
      date: ex.item_date || ''
    }));

    const merged = {
      ...existing,
      images: Array.isArray(data.images) && data.images.length > 0 ? data.images : (existing.images || []),
      slips: Array.isArray(data.slips) && data.slips.length > 0 ? data.slips : (existing.slips || []),
      customerInfo: {
        ...(existing.customerInfo || {}),
        address: data.customer_address || existing.customerInfo?.address || '',
        email: data.customer_email || existing.customerInfo?.email || '',
        line: data.customer_line || existing.customerInfo?.line || '',
        social: data.customer_social || existing.customerInfo?.social || '',
        taxId: data.customer_tax_id || existing.customerInfo?.taxId || ''
      },
      quotationItems: qItems.length > 0 ? qItems : (existing.quotationItems || []),
      customerSupport: csItems.length > 0 ? csItems : (existing.customerSupport || []),
      expenses: exItems.length > 0 ? exItems : (existing.expenses || [])
    };

    await db.projects.put(merged);
    return merged;
  } catch (err) {
    console.warn('Fetch on-demand detail notice:', err);
    return null;
  }
}

/**
 * 📊 ดึงตัวเลขสถิติและผลสรุปภาพรวมจาก Server-Side RPC โดยตรง (Zero-Egress Payload ~150 Bytes)
 * ไม่ต้องดาวน์โหลดแถวโปรเจกต์ 345 แถวมาคำนวณในเบราว์เซอร์
 */
export async function fetchServerProjectStats(filters = {}) {
  const client = getActiveClient();
  try {
    const { data, error } = await client.rpc('get_financial_analytics', {
      p_start_date: filters.startDate ? `${filters.startDate}T00:00:00Z` : null,
      p_end_date: filters.endDate ? `${filters.endDate}T23:59:59Z` : null,
      p_category: filters.category && filters.category !== 'all' ? filters.category : null,
      p_deal_status: filters.dealStatus && filters.dealStatus !== 'all' ? filters.dealStatus : null
    });

    if (!error && data) {
      return {
        total: data.total_orders || 0,
        totalRevenue: data.total_revenue || 0,
        totalExpenses: data.total_expenses || 0,
        totalNetProfit: data.total_net_profit || 0,
        totalCustomerSupport: data.total_customer_support || 0,
        paidCount: data.paid_orders_count || 0,
        unpaidCount: data.unpaid_orders_count || 0,
      };
    }
  } catch (e) {
    console.warn('fetchServerProjectStats error:', e);
  }
  return null;
}

// 11.1 ดึงรหัสโปรเจกต์ 30 รายการล่าสุดจาก Supabase โดยตรง (Ultra-Lean Zero-Egress ~1.2 KB)
export async function fetchLatest30ProjectsFromSupabase() {
  const client = getActiveClient();
  if (!client) return [];
  try {
    const { data, error } = await client
      .from('projects')
      .select('id, name, customer, artist, delivery_date')
      .order('id', { ascending: false })
      .limit(30);

    if (error) throw error;
    return (data || []).map(p => ({
      id: p.id,
      name: p.name,
      customer: p.customer,
      artist: p.artist,
      deliveryDate: p.delivery_date
    }));
  } catch (err) {
    console.warn('Direct fetch 30 projects notice (using local cache):', err);
    return [];
  }
}

// 12. ลูกค้า (Customers) - Local-First + Zero-Egress Sync
export async function loadCustomersLocalFirst(onUpdate) {
  try {
    const cached = await db.customers.toArray();
    if (cached.length > 0 && onUpdate) {
      onUpdate(cached);
    }

    const client = getActiveClient();
    const { data: cloudCustomers, error } = await client
      .from('customers')
      .select(CUSTOMER_COLUMNS)
      .order('name');

    if (!error && Array.isArray(cloudCustomers)) {
      await db.customers.clear();
      if (cloudCustomers.length > 0) {
        await db.customers.bulkPut(cloudCustomers);
      }
      if (onUpdate) onUpdate(cloudCustomers);
      return cloudCustomers;
    }

    return cached;
  } catch (err) {
    console.warn('Load customers notice:', err);
    return [];
  }
}

export async function deleteCustomerSync(customerId) {
  const client = getActiveClient();
  try {
    await client.from('customers').delete().eq('id', customerId);
  } catch (cErr) {}
  await db.customers.delete(customerId);
  broadcastRecordDeleted('customers', customerId);
  return true;
}

export async function saveCustomerSync(customerData) {
  const validated = validatePayload(customerPayloadSchema, customerData, 'Customer');
  const client = getActiveClient();
  try {
    const payload = {
      name: validated.name,
      phone: validated.phone || null,
      line_id: validated.line_id || validated.line || null,
      social_account: validated.social_account || validated.social || null,
      email: validated.email || null,
      tax_id: validated.tax_id || validated.taxId || null,
      billing_address: validated.billing_address || validated.address || null,
      vip_tier: validated.tier || validated.vip_tier || 'general'
    };

    if (customerData.id && isValidUuid(customerData.id)) {
      payload.id = customerData.id;
    }

    const { data, error } = await client
      .from('customers')
      .upsert(payload)
      .select(CUSTOMER_COLUMNS)
      .single();

    if (error) throw error;
    if (data) {
      await db.customers.put(data);
    }
    return data;
  } catch (err) {
    console.error('Error saving customer:', err);
    throw err;
  }
}

export const DEFAULT_INVENTORY_ITEMS_SPEC = [
  {
    id: 'a808caa3-43b8-4bdf-b652-b775b4bf6d9c',
    code: 'item0001',
    name: 'กรรไกรตัดกระดาษ (สีน้ำเงิน)',
    item_type: 'asset',
    unit: 'อัน',
    current_stock: 5,
    min_alert_threshold: 2,
    average_cost: 0,
    storage_location: 'กล่องเครื่องมือ 1',
    color: 'สีน้ำเงิน',
    status: 'in_service',
    is_active: true
  },
  {
    id: 'b1111111-1111-1111-1111-111111111111',
    code: 'item0002',
    name: 'แท่นตัดเทปกาวตั้งโต๊ะ',
    item_type: 'asset',
    unit: 'อัน',
    current_stock: 3,
    min_alert_threshold: 1,
    average_cost: 0,
    storage_location: 'โต๊ะจัดดอกไม้ A',
    color: '',
    status: 'in_service',
    is_active: true
  },
  {
    id: 'b2222222-2222-2222-2222-222222222222',
    code: 'ITM-TLP-WHT',
    name: 'ดอกทิวลิปพลาสติก (สีขาว)',
    item_type: 'reusable',
    unit: 'ชิ้น',
    current_stock: 500,
    min_alert_threshold: 50,
    average_cost: 25.0,
    storage_location: 'ชั้นวางดอกไม้ C2',
    color: 'สีขาว',
    status: 'in_service',
    is_active: true
  },
  {
    id: 'b2222222-2222-2222-2222-333333333333',
    code: 'ITM-ROS-RED',
    name: 'ดอกกุหลาบพลาสติก (สีแดง)',
    item_type: 'reusable',
    unit: 'ชิ้น',
    current_stock: 300,
    min_alert_threshold: 30,
    average_cost: 30.0,
    storage_location: 'ชั้นวางดอกไม้ C1',
    color: 'สีแดง',
    status: 'in_service',
    is_active: true
  },
  {
    id: 'b4444444-4444-4444-4444-444444444444',
    code: 'ITM-TAPE-CLR',
    name: 'เทปกาวใสสำหรับจัดดอกไม้',
    item_type: 'consumable',
    unit: 'ม้วน',
    current_stock: 40,
    min_alert_threshold: 10,
    average_cost: 35.0,
    storage_location: 'ตู้เก็บพัสดุสิ้นเปลือง',
    color: 'ใส',
    status: 'in_service',
    is_active: true
  },
  {
    id: 'b4444444-4444-4444-4444-555555555555',
    code: 'ITM-WRAP-PPR',
    name: 'กระดาษปริ้นงาน / กระดาษห่อช่อ',
    item_type: 'consumable',
    unit: 'รีม',
    current_stock: 25,
    min_alert_threshold: 5,
    average_cost: 15.0,
    storage_location: 'ชั้นวางกระดาษ B1',
    color: '',
    status: 'in_service',
    is_active: true
  },
  {
    id: 'b3333333-3333-3333-3333-333333333333',
    code: 'BNK-100',
    name: 'ธนบัตร 100 บาท',
    item_type: 'banknote',
    unit: 'ใบ',
    current_stock: 1000,
    min_alert_threshold: 100,
    average_cost: 100.0,
    storage_location: 'ตู้เซฟประจำร้าน',
    color: 'แดง',
    status: 'in_service',
    is_active: true
  },
  {
    id: 'b3333333-3333-3333-3333-444444444444',
    code: 'BNK-500',
    name: 'ธนบัตร 500 บาท',
    item_type: 'banknote',
    unit: 'ใบ',
    current_stock: 500,
    min_alert_threshold: 50,
    average_cost: 500.0,
    storage_location: 'ตู้เซฟประจำร้าน',
    color: 'ม่วง',
    status: 'in_service',
    is_active: true
  },
  {
    id: 'b5555555-5555-5555-5555-555555555555',
    code: 'TSK-DSGN',
    name: 'ออกแบบช่อดอกไม้ & จัดวางธีม',
    item_type: 'task',
    unit: 'งาน',
    current_stock: 9999,
    min_alert_threshold: 0,
    average_cost: 500.0,
    storage_location: 'บริการในร้าน',
    color: '',
    status: 'in_service',
    is_active: true
  }
];

export const DEFAULT_ASSET_UNITS = [
  {
    unit_code: 'item0001',
    item_id: 'a808caa3-43b8-4bdf-b652-b775b4bf6d9c',
    status: 'AVAILABLE',
    borrowed_by: null,
    project_id: null,
    notes: 'กรรไกรตัดผ้า/กระดาษ สีน้ำเงิน'
  },
  {
    unit_code: 'item0002',
    item_id: 'b1111111-1111-1111-1111-111111111111',
    status: 'AVAILABLE',
    borrowed_by: null,
    project_id: null,
    notes: 'แท่นตัดเทปกาวตั้งโต๊ะ'
  }
];

// 13. คลังพัสดุและสต๊อก (Inventory Items) - Local-First + Zero-Egress Sync
export async function loadInventoryLocalFirst(onUpdate) {
  try {
    let cached = await db.inventory_items.toArray();
    if (!cached || cached.length === 0) {
      await db.inventory_items.bulkPut(DEFAULT_INVENTORY_ITEMS_SPEC);
      cached = DEFAULT_INVENTORY_ITEMS_SPEC;
    } else {
      const hasBanknote = cached.some(i => i.item_type === 'banknote');
      if (!hasBanknote) {
        await db.inventory_items.bulkPut(DEFAULT_INVENTORY_ITEMS_SPEC);
        cached = await db.inventory_items.toArray();
      }
    }

    if (cached.length > 0 && onUpdate) {
      onUpdate(cached);
    }

    const client = getActiveClient();
    try {
      const { data: cloudItems, error } = await client
        .from('inventory_items')
        .select(INVENTORY_COLUMNS)
        .eq('is_active', true)
        .order('name');

      if (!error && Array.isArray(cloudItems) && cloudItems.length > 0) {
        await db.inventory_items.bulkPut(cloudItems);
        if (onUpdate) onUpdate(cloudItems);
        return cloudItems;
      }
    } catch (cErr) {
      // Fallback
    }

    return cached;
  } catch (err) {
    console.warn('Load inventory notice:', err);
    return DEFAULT_INVENTORY_ITEMS_SPEC;
  }
}

export async function saveInventoryItemSync(itemData) {
  const validated = validatePayload(inventoryItemPayloadSchema, itemData, 'InventoryItem');
  const client = getActiveClient();
  try {
    const payload = {
      name: validated.name,
      item_type: validated.item_type || 'consumable',
      unit: validated.unit || 'ชิ้น',
      current_stock: Number(validated.current_stock) || 0,
      min_alert_threshold: Number(validated.min_alert_threshold) || 5,
      average_cost: Number(validated.average_cost) || 0,
      storage_location: validated.storage_location || '',
      color: validated.color || '',
      size: validated.size || '',
      status: validated.status || 'in_service',
      is_active: validated.is_active !== undefined ? validated.is_active : true
    };

    if (validated.id && isValidUuid(validated.id)) {
      payload.id = validated.id;
    } else if (validated.id) {
      payload.id = validated.id;
    } else {
      payload.id = crypto?.randomUUID ? crypto.randomUUID() : `itm-${Date.now()}`;
    }

    if (validated.code) {
      payload.code = validated.code;
    }

    try {
      const { data, error } = await client
        .from('inventory_items')
        .upsert(payload)
        .select(INVENTORY_COLUMNS)
        .single();

      if (!error && data) {
        await db.inventory_items.put(data);
        return data;
      }
    } catch (cErr) {
      // Supabase constraint or offline fallback
    }

    await db.inventory_items.put(payload);
    return payload;
  } catch (err) {
    console.error('Error saving inventory item:', err);
    throw err;
  }
}

export async function deleteInventoryItemSync(itemId) {
  const client = getActiveClient();
  try {
    try {
      await client.from('inventory_items').update({ is_active: false }).eq('id', itemId);
    } catch (cErr) {}
    await db.inventory_items.delete(itemId);
    broadcastRecordDeleted('inventory_items', itemId);
    return true;
  } catch (err) {
    console.error('Error deleting inventory item:', err);
    throw err;
  }
}

// 13.1 รหัสรายชิ้นอุปกรณ์ (Asset Units) - Local-First + Zero-Egress Sync
export async function loadAssetUnitsLocalFirst(onUpdate) {
  try {
    let cached = await db.asset_units.toArray();
    if (!cached || cached.length === 0) {
      await db.asset_units.bulkPut(DEFAULT_ASSET_UNITS);
      cached = DEFAULT_ASSET_UNITS;
    }
    if (cached.length > 0 && onUpdate) {
      onUpdate(cached);
    }

    const client = getActiveClient();
    try {
      const { data: cloudUnits, error } = await client
        .from('asset_units')
        .select(ASSET_UNIT_COLUMNS)
        .order('unit_code');

      if (!error && Array.isArray(cloudUnits) && cloudUnits.length > 0) {
        await db.asset_units.bulkPut(cloudUnits);
        if (onUpdate) onUpdate(cloudUnits);
        return cloudUnits;
      }
    } catch (cErr) {}

    return cached;
  } catch (err) {
    console.warn('Load asset units notice:', err);
    return DEFAULT_ASSET_UNITS;
  }
}

export async function saveAssetUnitSync(unitData) {
  const client = getActiveClient();
  try {
    const payload = {
      unit_code: unitData.unit_code,
      item_id: unitData.item_id,
      status: unitData.status || 'AVAILABLE',
      borrowed_by: unitData.borrowed_by || null,
      borrowed_at: unitData.borrowed_at || (unitData.status === 'BORROWED' ? new Date().toISOString() : null),
      project_id: unitData.project_id || null,
      notes: unitData.notes || '',
      updated_at: new Date().toISOString()
    };

    try {
      const { data, error } = await client
        .from('asset_units')
        .upsert(payload)
        .select(ASSET_UNIT_COLUMNS)
        .single();
      if (!error && data) {
        await db.asset_units.put(data);
        return data;
      }
    } catch (cErr) {}

    await db.asset_units.put(payload);
    return payload;
  } catch (err) {
    console.error('Error saving asset unit:', err);
    throw err;
  }
}

export async function deleteAssetUnitSync(unitCode) {
  const client = getActiveClient();
  try {
    try {
      await client.from('asset_units').delete().eq('unit_code', unitCode);
    } catch (cErr) {}
    await db.asset_units.delete(unitCode);
    return true;
  } catch (err) {
    console.error('Error deleting asset unit:', err);
    throw err;
  }
}

// 13.2 เช็กลิสต์เตรียมของรายโปรเจกต์ (Project Checklist & Reconciliation)
export async function loadProjectChecklistLocalFirst(projectId, onUpdate) {
  try {
    let cached = [];
    if (projectId) {
      cached = await db.project_checklist_items.where('project_id').equals(projectId).toArray();
    } else {
      cached = await db.project_checklist_items.toArray();
    }

    if (cached.length > 0 && onUpdate) {
      onUpdate(cached);
    }

    const client = getActiveClient();
    try {
      let query = client.from('project_checklist_items').select(CHECKLIST_ITEM_COLUMNS);
      if (projectId) {
        query = query.eq('project_id', projectId);
      }
      const { data: cloudItems, error } = await query.order('created_at');

      if (!error && Array.isArray(cloudItems) && cloudItems.length > 0) {
        await db.project_checklist_items.bulkPut(cloudItems);
        if (onUpdate) onUpdate(cloudItems);
        return cloudItems;
      }
    } catch (cErr) {}

    return cached;
  } catch (err) {
    console.warn('Load project checklist notice:', err);
    return [];
  }
}

export async function saveProjectChecklistItemSync(itemData) {
  const client = getActiveClient();
  try {
    const payload = {
      project_id: itemData.project_id,
      item_id: itemData.item_id || null,
      category_name: itemData.category_name || '',
      item_name: itemData.item_name,
      item_type: itemData.item_type || 'consumable',
      required_qty: Number(itemData.required_qty) || 1,
      unit: itemData.unit || 'ชิ้น',
      picked_qty: Number(itemData.picked_qty) || 0,
      returned_qty: Number(itemData.returned_qty) || 0,
      damaged_qty: Number(itemData.damaged_qty) || 0,
      unit_cost: Number(itemData.unit_cost) || 0,
      assigned_codes: Array.isArray(itemData.assigned_codes) ? itemData.assigned_codes : [],
      is_checked: Boolean(itemData.is_checked),
      notes: itemData.notes || '',
      updated_at: new Date().toISOString()
    };

    if (itemData.id && isValidUuid(itemData.id)) {
      payload.id = itemData.id;
    } else {
      payload.id = crypto?.randomUUID ? crypto.randomUUID() : `chk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      payload.created_at = new Date().toISOString();
    }

    try {
      const { data, error } = await client
        .from('project_checklist_items')
        .upsert(payload)
        .select(CHECKLIST_ITEM_COLUMNS)
        .single();
      if (!error && data) {
        await db.project_checklist_items.put(data);
        return data;
      }
    } catch (cErr) {}

    await db.project_checklist_items.put(payload);
    return payload;
  } catch (err) {
    console.error('Error saving checklist item:', err);
    throw err;
  }
}

export async function toggleChecklistItemSync(itemId, isChecked) {
  const client = getActiveClient();
  try {
    const item = await db.project_checklist_items.get(itemId);
    if (!item) return null;

    const updated = {
      ...item,
      is_checked: Boolean(isChecked),
      updated_at: new Date().toISOString()
    };

    try {
      await client
        .from('project_checklist_items')
        .update({ is_checked: Boolean(isChecked), updated_at: updated.updated_at })
        .eq('id', itemId);
    } catch (cErr) {}

    await db.project_checklist_items.put(updated);
    return updated;
  } catch (err) {
    console.error('Error toggling checklist item:', err);
    throw err;
  }
}

export async function deleteProjectChecklistItemSync(itemId) {
  const client = getActiveClient();
  try {
    try {
      await client.from('project_checklist_items').delete().eq('id', itemId);
    } catch (cErr) {}
    await db.project_checklist_items.delete(itemId);
    return true;
  } catch (err) {
    console.error('Error deleting checklist item:', err);
    throw err;
  }
}

export async function borrowAssetUnitsSync({ projectId, unitCodes, borrowerName, checklistItemId }) {
  const client = getActiveClient();
  try {
    const now = new Date().toISOString();
    for (const code of unitCodes) {
      const unit = await db.asset_units.get(code);
      if (unit) {
        unit.status = 'BORROWED';
        unit.borrowed_by = borrowerName;
        unit.borrowed_at = now;
        unit.project_id = projectId;
        await db.asset_units.put(unit);
      }
      try {
        await client.from('asset_units').update({
          status: 'BORROWED',
          borrowed_by: borrowerName,
          borrowed_at: now,
          project_id: projectId
        }).eq('unit_code', code);
      } catch (cErr) {}
    }

    if (checklistItemId) {
      const chk = await db.project_checklist_items.get(checklistItemId);
      if (chk) {
        chk.assigned_codes = Array.from(new Set([...(chk.assigned_codes || []), ...unitCodes]));
        chk.is_checked = true;
        await db.project_checklist_items.put(chk);
        try {
          await client.from('project_checklist_items').update({
            assigned_codes: chk.assigned_codes,
            is_checked: true
          }).eq('id', checklistItemId);
        } catch (cErr) {}
      }
    }

    return true;
  } catch (err) {
    console.error('Error borrowing asset units:', err);
    throw err;
  }
}

export async function returnAssetUnitsSync({ unitCodes }) {
  const client = getActiveClient();
  try {
    for (const code of unitCodes) {
      const unit = await db.asset_units.get(code);
      if (unit) {
        unit.status = 'AVAILABLE';
        unit.borrowed_by = null;
        unit.borrowed_at = null;
        unit.project_id = null;
        await db.asset_units.put(unit);
      }
      try {
        await client.from('asset_units').update({
          status: 'AVAILABLE',
          borrowed_by: null,
          borrowed_at: null,
          project_id: null
        }).eq('unit_code', code);
      } catch (cErr) {}
    }
    return true;
  } catch (err) {
    console.error('Error returning asset units:', err);
    throw err;
  }
}

export async function reconcileProjectItemSync({ projectId, checklistItemId, itemId, returnedQty, damagedQty }) {
  const client = getActiveClient();
  try {
    const ret = Number(returnedQty) || 0;
    const dam = Number(damagedQty) || 0;

    const chk = await db.project_checklist_items.get(checklistItemId);
    if (chk) {
      chk.returned_qty = ret;
      chk.damaged_qty = dam;
      chk.is_checked = true;
      await db.project_checklist_items.put(chk);
      try {
        await client.from('project_checklist_items').update({
          returned_qty: ret,
          damaged_qty: dam,
          is_checked: true
        }).eq('id', checklistItemId);
      } catch (cErr) {}
    }

    if (itemId) {
      const inv = await db.inventory_items.get(itemId);
      if (inv) {
        inv.current_stock = (Number(inv.current_stock) || 0) + ret;
        await db.inventory_items.put(inv);
        try {
          await client.from('inventory_items').update({
            current_stock: inv.current_stock
          }).eq('id', itemId);
        } catch (cErr) {}
      }
    }

    return true;
  } catch (err) {
    console.error('Error reconciling project item:', err);
    throw err;
  }
}

// 14. ทะเบียนยืม-คืนอุปกรณ์ (Asset Loans) - Local-First + Zero-Egress Sync
export async function loadAssetLoansLocalFirst(onUpdate) {
  try {
    const cached = await db.asset_loans.toArray();
    if (cached.length > 0 && onUpdate) {
      onUpdate(cached);
    }

    const client = getActiveClient();
    const { data: cloudLoans, error } = await client
      .from('asset_loans')
      .select(ASSET_LOAN_COLUMNS)
      .order('borrowed_at', { ascending: false });

    if (!error && Array.isArray(cloudLoans) && cloudLoans.length > 0) {
      await db.asset_loans.bulkPut(cloudLoans);
      if (onUpdate) onUpdate(cloudLoans);
      return cloudLoans;
    }

    return cached;
  } catch (err) {
    console.warn('Load asset loans notice:', err);
    return [];
  }
}

export async function saveAssetLoanSync(loanData) {
  const client = getActiveClient();
  try {
    const payload = {
      item_id: loanData.item_id,
      project_id: loanData.project_id || null,
      borrower_name: loanData.borrower_name,
      borrowed_at: loanData.borrowed_at || new Date().toISOString(),
      expected_return_at: loanData.expected_return_at || null,
      actual_returned_at: loanData.actual_returned_at || null,
      status: loanData.status || 'borrowed',
      notes: loanData.notes || ''
    };

    if (loanData.id && isValidUuid(loanData.id)) {
      payload.id = loanData.id;
    }

    const { data, error } = await client
      .from('asset_loans')
      .upsert(payload)
      .select(ASSET_LOAN_COLUMNS)
      .single();

    if (error) throw error;
    if (data) {
      await db.asset_loans.put(data);
    }
    return data;
  } catch (err) {
    console.error('Error saving asset loan:', err);
    throw err;
  }
}

export async function returnAssetLoanSync(loanId, notes = '') {
  const client = getActiveClient();
  try {
    const payload = {
      id: loanId,
      status: 'returned',
      actual_returned_at: new Date().toISOString(),
      notes: notes
    };

    const { data, error } = await client
      .from('asset_loans')
      .update({
        status: 'returned',
        actual_returned_at: new Date().toISOString(),
        notes: notes
      })
      .eq('id', loanId)
      .select(ASSET_LOAN_COLUMNS)
      .single();

    if (error) throw error;
    if (data) {
      await db.asset_loans.put(data);
    }
    return data;
  } catch (err) {
    console.error('Error returning asset loan:', err);
    throw err;
  }
}

// 15. ราคากลางวัสดุ ตร.ม. (Material Rates) - Local-First + Zero-Egress Sync
export async function loadMaterialRatesLocalFirst(onUpdate) {
  try {
    let cached = await db.material_rates.toArray();
    // Seed default rates if empty
    if (!cached || cached.length === 0) {
      await db.material_rates.bulkPut(DEFAULT_MATERIAL_RATES);
      cached = DEFAULT_MATERIAL_RATES;
    }
    if (cached.length > 0 && onUpdate) {
      onUpdate(cached);
    }

    const client = getActiveClient();
    const { data: cloudRates, error } = await client
      .from('material_rates')
      .select(MATERIAL_RATE_COLUMNS)
      .order('name');

    if (!error && Array.isArray(cloudRates) && cloudRates.length > 0) {
      await db.material_rates.bulkPut(cloudRates);
      if (onUpdate) onUpdate(cloudRates);
      return cloudRates;
    }

    return cached;
  } catch (err) {
    console.warn('Load material rates notice:', err);
    return DEFAULT_MATERIAL_RATES;
  }
}

export async function saveMaterialRateSync(rateData) {
  const client = getActiveClient();
  try {
    const payload = {
      name: rateData.name,
      default_price_sqm: Number(rateData.default_price_sqm) || 0,
      is_active: rateData.is_active !== undefined ? rateData.is_active : true,
      updated_at: new Date().toISOString()
    };
    if (rateData.id) {
      payload.id = rateData.id;
    } else {
      payload.id = `mat-${Date.now()}`;
    }

    // Try cloud sync first if available
    try {
      const { data, error } = await client
        .from('material_rates')
        .upsert(payload)
        .select(MATERIAL_RATE_COLUMNS)
        .single();
      if (!error && data) {
        await db.material_rates.put(data);
        return data;
      }
    } catch (cErr) {
      // Gracefully fall back to local IndexedDB
    }

    await db.material_rates.put(payload);
    return payload;
  } catch (err) {
    console.error('Error saving material rate:', err);
    throw err;
  }
}

// 16. เอกสารใบเสนอราคา (Quotations) - Local-First + Zero-Egress Sync
export async function loadQuotationsLocalFirst(onUpdate) {
  try {
    const cached = await db.quotations.toArray();
    if (onUpdate) {
      onUpdate(cached);
    }

    const client = getActiveClient();
    const { data: cloudQuotes, error } = await client
      .from('quotations')
      .select(QUOTATION_DOC_COLUMNS)
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(cloudQuotes) && cloudQuotes.length > 0) {
      await db.quotations.bulkPut(cloudQuotes);
      if (onUpdate) onUpdate(cloudQuotes);
      return cloudQuotes;
    }

    return cached;
  } catch (err) {
    console.warn('Load quotations notice:', err);
    return [];
  }
}

export async function saveQuotationSync(quoteData) {
  const validated = validatePayload(quotationPayloadSchema, quoteData, 'Quotation');
  const client = getActiveClient();
  try {
    const payload = {
      quote_no: validated.quote_no,
      title: validated.title,
      client_name: validated.client_name || '',
      project_code: validated.project_code || null,
      backdrop_items: validated.backdrop_items || [],
      floral_items: validated.floral_items || [],
      backdrop_cost: Number(validated.backdrop_cost) || 0,
      floral_cost: Number(validated.floral_cost) || 0,
      total_cost: Number(validated.total_cost) || 0,
      markup_percent: Number(validated.markup_percent) || 30,
      final_price: Number(validated.final_price) || 0,
      note: validated.note || '',
      updated_at: new Date().toISOString()
    };
    if (validated.id) {
      payload.id = validated.id;
    } else {
      payload.id = `qt-${Date.now()}`;
      payload.created_at = new Date().toISOString();
    }

    try {
      const { data, error } = await client
        .from('quotations')
        .upsert(payload)
        .select(QUOTATION_DOC_COLUMNS)
        .single();
      if (!error && data) {
        await db.quotations.put(data);
        return data;
      }
    } catch (cErr) {
      // Local fallback
    }

    await db.quotations.put(payload);
    return payload;
  } catch (err) {
    console.error('Error saving quotation doc:', err);
    throw err;
  }
}

export async function deleteQuotationSync(quoteId) {
  const client = getActiveClient();
  try {
    try {
      await client.from('quotations').delete().eq('id', quoteId);
    } catch (cErr) {}
    await db.quotations.delete(quoteId);
    broadcastRecordDeleted('quotations', quoteId);
    return true;
  } catch (err) {
    console.error('Error deleting quotation doc:', err);
    throw err;
  }
}

// 17. ฐานข้อมูลศิลปิน & ประวัติ (Artists) - Local-First + Zero-Egress Sync
export async function loadArtistsLocalFirst(onUpdate) {
  try {
    const cached = await db.artists.toArray();
    if (onUpdate) {
      onUpdate(cached);
    }

    const client = getActiveClient();
    const { data: cloudArtists, error } = await client
      .from('artists')
      .select(ARTIST_COLUMNS)
      .order('name');

    if (!error && Array.isArray(cloudArtists)) {
      await db.artists.clear();
      if (cloudArtists.length > 0) {
        await db.artists.bulkPut(cloudArtists);
      }
      if (onUpdate) onUpdate(cloudArtists);
      return cloudArtists;
    }

    return cached;
  } catch (err) {
    console.warn('Load artists notice:', err);
    return [];
  }
}

// 17.1 สถิติรวมศิลปินและลูกค้าแบบ All-Time (Server Aggregated Summary Stats)
export async function loadArtistsAndCustomersSummaryStats(onUpdate) {
  try {
    // 1. ส่งข้อมูลแคชจาก IndexedDB ทันที (Local-First 0ms)
    const cachedMeta = await db.sync_meta.get('artists_customers_summary_stats');
    if (cachedMeta && cachedMeta.value && onUpdate) {
      onUpdate(cachedMeta.value);
    }

    // 2. ดึงข้อมูลสรุปแบบ Zero-Egress Server RPC (150ms / ~2 KB)
    const client = getActiveClient();
    try {
      const [artRes, custRes] = await Promise.all([
        client.rpc('get_artists_summary_stats'),
        client.rpc('get_customers_summary_stats')
      ]);
      if (!artRes.error && Array.isArray(artRes.data) && !custRes.error && Array.isArray(custRes.data)) {
        const artistStats = {};
        artRes.data.forEach(r => {
          artistStats[r.artist_name.toLowerCase()] = {
            name: r.artist_name,
            projectCount: Number(r.project_count),
            totalRevenue: Number(r.total_revenue),
            totalSupport: Number(r.total_support),
            lastActiveDate: r.last_active_date || ''
          };
        });
        const customerStats = {};
        custRes.data.forEach(r => {
          customerStats[r.customer_name.toLowerCase()] = {
            name: r.customer_name,
            projectCount: Number(r.project_count),
            totalSpend: Number(r.total_spend),
            totalSupport: Number(r.total_support),
            lastOrderDate: r.last_order_date || ''
          };
        });
        const result = { artistStats, customerStats };
        await db.sync_meta.put({ key: 'artists_customers_summary_stats', value: result, updated_at: Date.now() });
        if (onUpdate) onUpdate(result);
        return result;
      }
    } catch (rpcErr) {
      console.warn('RPC summary stats fallback to projection:', rpcErr);
    }

    // Fallback: ดึงข้อมูลสรุปแบบ Zero-Egress Projection จาก Supabase
    const { data, error } = await client
      .from('projects')
      .select('artist_name, customer_name, wage, customer_support_total, delivery_fee, raw_delivery_start, project_datetime');

    if (!error && Array.isArray(data)) {
      const artistStats = {};
      const customerStats = {};

      data.forEach(p => {
        const aName = (p.artist_name || '').trim();
        if (aName && aName !== '-' && aName !== 'Unknown') {
          const key = aName.toLowerCase();
          if (!artistStats[key]) {
            artistStats[key] = {
              name: aName,
              projectCount: 0,
              totalRevenue: 0,
              totalSupport: 0,
              lastActiveDate: ''
            };
          }
          const aEntry = artistStats[key];
          aEntry.projectCount += 1;
          aEntry.totalRevenue += (p.wage || 0);
          aEntry.totalSupport += (p.customer_support_total || 0);
          const dStr = p.raw_delivery_start || p.project_datetime || '';
          if (dStr && (!aEntry.lastActiveDate || dStr > aEntry.lastActiveDate)) {
            aEntry.lastActiveDate = dStr;
          }
        }

        const cName = (p.customer_name || '').trim();
        if (cName && cName !== '-' && cName !== 'Unknown') {
          const key = cName.toLowerCase();
          if (!customerStats[key]) {
            customerStats[key] = {
              name: cName,
              projectCount: 0,
              totalSpend: 0,
              totalSupport: 0,
              lastOrderDate: ''
            };
          }
          const cEntry = customerStats[key];
          cEntry.projectCount += 1;
          cEntry.totalSpend += ((p.wage || 0) + (p.delivery_fee || 0));
          cEntry.totalSupport += (p.customer_support_total || 0);
          const dStr = p.raw_delivery_start || p.project_datetime || '';
          if (dStr && (!cEntry.lastOrderDate || dStr > cEntry.lastOrderDate)) {
            cEntry.lastOrderDate = dStr;
          }
        }
      });

      const result = { artistStats, customerStats };
      await db.sync_meta.put({ key: 'artists_customers_summary_stats', value: result, updated_at: Date.now() });
      if (onUpdate) onUpdate(result);
      return result;
    }

    return cachedMeta?.value || { artistStats: {}, customerStats: {} };
  } catch (err) {
    console.warn('Load summary stats notice:', err);
    return { artistStats: {}, customerStats: {} };
  }
}

export async function saveArtistSync(artistData) {
  const validated = validatePayload(artistPayloadSchema, artistData, 'Artist');
  const client = getActiveClient();
  try {
    const payload = {
      name: validated.name,
      agency: validated.agency || '',
      fandom_name: validated.fandom_name || '',
      fandom_color: validated.fandom_color || '',
      birth_date: validated.birth_date || null,
      debut_date: validated.debut_date || null,
      bio: validated.bio || '',
      social_links: validated.social_links || {},
      favorite_flowers: validated.favorite_flowers || '',
      avatar_url: validated.avatar_url || '',
      notes: validated.notes || ''
    };
    if (validated.id) {
      payload.id = validated.id;
    } else {
      payload.id = `art-${Date.now()}`;
      payload.created_at = new Date().toISOString();
    }

    try {
      const { data, error } = await client
        .from('artists')
        .upsert(payload)
        .select(ARTIST_COLUMNS)
        .single();
      if (!error && data) {
        await db.artists.put(data);
        return data;
      }
    } catch (cErr) {
      // Local fallback
    }

    await db.artists.put(payload);
    return payload;
  } catch (err) {
    console.error('Error saving artist:', err);
    throw err;
  }
}

export async function deleteArtistSync(artistId) {
  const client = getActiveClient();
  try {
    try {
      await client.from('artists').delete().eq('id', artistId);
    } catch (cErr) {}
    await db.artists.delete(artistId);
    broadcastRecordDeleted('artists', artistId);
    return true;
  } catch (err) {
    console.error('Error deleting artist:', err);
    throw err;
  }
}

// 18. ทีมงาน & พนักงาน (Staff & Employees) - Local-First + Zero-Egress Sync
export const DEFAULT_STAFF_MEMBERS = [
  {
    id: '2611001',
    username: '1',
    password: '1',
    staff_code: '2611001',
    name: 'Lukyeekubbbbb',
    nickname: 'Lukyeekubbbbb',
    role: 'admin',
    role_code: '11',
    role_label: 'ผู้ดูแลระบบ (Admin)',
    phone: '0812345678',
    email: 'admin@flower2u.com',
    is_active: true,
    avatar_url: 'https://drive.google.com/uc?export=view&id=1ArbZlk1Dcj_DIochzOEYvv-yuTm-VE1E',
    created_at: '2026-01-01T00:00:00Z'
  },
  {
    id: '2611002',
    username: 'AOM',
    password: '1234',
    staff_code: '2611002',
    name: 'AOM',
    nickname: 'AOM',
    role: 'technician',
    role_code: '21',
    role_label: 'ช่างจัดดอกไม้/หน้างาน (Technician)',
    phone: '0823456789',
    email: 'aom@flower2u.com',
    is_active: true,
    avatar_url: 'https://drive.google.com/uc?export=view&id=1FZGkxFNBSkC3i9cdCQvs5OlUi-49wxau',
    created_at: '2026-01-01T00:00:00Z'
  },
  {
    id: '2611003',
    username: 'DREAM',
    password: '1',
    staff_code: '2611003',
    name: 'หมูดรีม',
    nickname: 'หมูดรีม',
    role: 'driver',
    role_code: '31',
    role_label: 'พนักงานจัดส่ง (Driver/Logistics)',
    phone: '0834567890',
    email: 'dream@flower2u.com',
    is_active: true,
    avatar_url: 'https://drive.google.com/uc?export=view&id=1TuRK4Yz2xN_xIwy0BZmj2FgeQpZW6bCT',
    created_at: '2026-01-01T00:00:00Z'
  },
  {
    id: '2611004',
    username: 'Chuti',
    password: 'aom@2026',
    staff_code: '2611004',
    name: 'อ้อม',
    nickname: 'อ้อม',
    role: 'accountant',
    role_code: '41',
    role_label: 'ฝ่ายบัญชีและการเงิน (Accountant)',
    phone: '0845678901',
    email: 'chuti@flower2u.com',
    is_active: true,
    avatar_url: '',
    created_at: '2026-01-01T00:00:00Z'
  }
];

export async function loadStaffLocalFirst(onUpdate) {
  try {
    const cached = await db.staff.toArray();

    // 🛡️ Filter and purge any legacy mock staff (e.g. starting with 'staff-')
    const legacyRecords = cached.filter(s => !s || !s.id || String(s.id).startsWith('staff-'));
    if (legacyRecords.length > 0) {
      for (const legacy of legacyRecords) {
        if (legacy?.id) await db.staff.delete(legacy.id).catch(() => {});
      }
    }

    const validCached = cached.filter(s => s && s.id && !String(s.id).startsWith('staff-'));
    if (validCached.length === 0) {
      await db.staff.bulkPut(DEFAULT_STAFF_MEMBERS);
      if (onUpdate) onUpdate(DEFAULT_STAFF_MEMBERS);
    } else if (onUpdate) {
      onUpdate(validCached);
    }

    const client = getActiveClient();
    const { data: cloudStaff, error } = await client
      .from('staff_users')
      .select(STAFF_COLUMNS);

    if (!error && Array.isArray(cloudStaff) && cloudStaff.length > 0) {
      const passwordMap = {
        '1': '1',
        'AOM': '1234',
        'DREAM': '1',
        'Chuti': 'aom@2026'
      };
      const staffCodeMap = {
        '1': '2611001',
        'AOM': '2611002',
        'DREAM': '2611003',
        'Chuti': '2611004'
      };

      const mapped = cloudStaff
        .filter(u => u && u.id && !String(u.id).startsWith('staff-'))
        .map(u => {
          const code = u.id || u.staff_code || staffCodeMap[u.username] || '';
          const roleName = u.roles?.name || 'technician';
          const roleCode = u.roles?.code || (roleName === 'admin' ? '11' : roleName === 'technician' ? '21' : roleName === 'driver' ? '31' : '41');
          const roleLabel = u.roles?.label || (roleName === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : roleName === 'technician' ? 'ช่างจัดดอกไม้/หน้างาน (Technician)' : roleName === 'driver' ? 'พนักงานจัดส่ง (Driver/Logistics)' : 'ฝ่ายบัญชีและการเงิน (Accountant)');
          return {
            id: code,
            username: u.username,
            staff_code: code,
            password: u.password || passwordMap[u.username] || '1',
            name: u.full_name || u.nickname || u.username,
            nickname: u.nickname || '',
            role: roleName,
            role_code: roleCode,
            role_label: roleLabel,
            email: u.email || '',
            phone: u.phone || '',
            citizen_id: u.citizen_id || '',
            birth_date: u.birth_date || '',
            address: u.address || '',
            emergency_contact: u.emergency_contact || '',
            avatar_url: u.profile_image_url || '',
            is_active: u.is_active !== undefined ? u.is_active : true,
            created_at: u.created_at || ''
          };
        });

      // Clear local staff table so any stale mock entries are permanently removed
      await db.staff.clear();
      await db.staff.bulkPut(mapped);
      if (onUpdate) onUpdate(mapped);
      return mapped;
    }

    return validCached.length > 0 ? validCached : DEFAULT_STAFF_MEMBERS;
  } catch (err) {
    console.warn('Load staff notice:', err);
    return DEFAULT_STAFF_MEMBERS;
  }
}

export async function saveStaffSync(staffData) {
  const validated = validatePayload(staffPayloadSchema, staffData, 'Staff');
  const client = getActiveClient();
  try {
    const roleCodeMap = {
      admin: '11',
      technician: '21',
      driver: '31',
      accountant: '41'
    };
    const roleLabelMap = {
      admin: 'ผู้ดูแลระบบ (Admin)',
      technician: 'ช่างจัดดอกไม้/หน้างาน (Technician)',
      driver: 'พนักงานจัดส่ง (Driver/Logistics)',
      accountant: 'ฝ่ายบัญชีและการเงิน (Accountant)'
    };

    const roleName = validated.role || 'technician';
    const roleCode = validated.role_code || roleCodeMap[roleName] || '21';
    const roleLabel = validated.role_label || roleLabelMap[roleName] || 'พนักงาน';

    // ID is the staff_code itself (e.g. '2611001')
    const staffId = validated.id || validated.staff_code || `2611${String(Date.now()).slice(-3)}`;

    // Lookup matching role_id from roles table (if connected)
    let roleId = null;
    try {
      if (client) {
        const { data: roleRow } = await client
          .from('roles')
          .select('id')
          .eq('name', roleName)
          .maybeSingle();
        if (roleRow?.id) {
          roleId = roleRow.id;
        }
      }
    } catch (rErr) {}

    const payload = {
      id: staffId,
      username: validated.username,
      staff_code: staffId,
      password: validated.password || '1',
      name: validated.name || validated.username,
      nickname: validated.nickname || '',
      role: roleName,
      role_code: roleCode,
      role_label: roleLabel,
      email: validated.email || '',
      phone: validated.phone || '',
      citizen_id: validated.citizen_id || '',
      birth_date: validated.birth_date || '',
      address: validated.address || '',
      emergency_contact: validated.emergency_contact || '',
      avatar_url: validated.avatar_url || validated.image || '',
      is_active: validated.is_active !== undefined ? validated.is_active : true,
      updated_at: new Date().toISOString()
    };

    // Try cloud upsert to Supabase
    try {
      const supaPayload = {
        id: payload.id,
        username: payload.username,
        full_name: payload.name,
        nickname: payload.nickname,
        role_id: roleId,
        email: payload.email || null,
        phone: payload.phone || null,
        citizen_id: payload.citizen_id || null,
        birth_date: payload.birth_date || null,
        address: payload.address || null,
        emergency_contact: payload.emergency_contact || null,
        profile_image_url: payload.avatar_url || null,
        is_active: payload.is_active
      };
      await client.from('staff_users').upsert(supaPayload);

      // 🛡️ Auto-register / sync to Supabase Auth immediately
      try {
        await syncStaffToSupabaseAuth(payload);
      } catch (authErr) {
        console.warn('Background Supabase Auth auto-sync notice:', authErr);
      }
    } catch (cErr) {
      // Local fallback
    }

    await db.staff.put(payload);
    return payload;
  } catch (err) {
    console.error('Error saving staff:', err);
    throw err;
  }
}

/**
 * ซิงก์ผู้ใช้พนักงานเข้าสู่ Supabase Auth (auth.users)
 * รองรับทั้งกรณีมี email จริง หรือกรณีไม่มี email จะสร้างเป็น username@flower2u.internal
 */
export async function syncStaffToSupabaseAuth(staffData) {
  const client = getActiveClient();
  if (!client?.auth || !staffData) return { success: false, error: 'No client or data' };

  try {
    const rawUsername = (staffData.username || staffData.name || '').trim();
    if (!rawUsername) return { success: false, error: 'No username' };

    const cleanUsername = rawUsername.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || 'staff';
    const email = (staffData.email && staffData.email.includes('@'))
      ? staffData.email.trim()
      : `${cleanUsername}@flower2u.internal`;

    // Supabase Auth requires minimum 6 characters for password
    const rawPass = String(staffData.password || '123456');
    const authPassword = rawPass.length >= 6 ? rawPass : rawPass.padEnd(6, '0');

    const metadata = {
      username: rawUsername,
      name: staffData.name || rawUsername,
      full_name: staffData.name || staffData.full_name || rawUsername,
      nickname: staffData.nickname || '',
      role: staffData.role || 'technician',
      role_label: staffData.role_label || '',
      staff_code: staffData.staff_code || staffData.id || '',
      phone: staffData.phone || '',
      citizen_id: staffData.citizen_id || '',
      birth_date: staffData.birth_date || ''
    };

    const { data, error } = await client.auth.signUp({
      email,
      password: authPassword,
      options: {
        data: metadata
      }
    });

    if (error) {
      // Check if user already exists
      const msg = error.message?.toLowerCase() || '';
      if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('unique constraint')) {
        return { success: true, alreadyExists: true, email, user: data?.user };
      }
      console.warn(`Supabase Auth signUp notice for ${email}:`, error.message);
      return { success: false, error: error.message, email };
    }

    return { success: true, alreadyExists: false, email, user: data?.user };
  } catch (err) {
    console.error('syncStaffToSupabaseAuth error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * แบทช์ซิงก์พนักงานทั้งหมดที่มีเข้าสู่ Supabase Auth (ทั้ง user เก่าและใหม่)
 */
export async function syncAllStaffToSupabaseAuth(staffList = []) {
  if (!Array.isArray(staffList) || staffList.length === 0) {
    return { total: 0, synced: 0, existing: 0, errors: [] };
  }

  let synced = 0;
  let existing = 0;
  const errors = [];

  for (const staff of staffList) {
    if (!staff.username) continue;
    try {
      const res = await syncStaffToSupabaseAuth(staff);
      if (res.success) {
        if (res.alreadyExists) {
          existing++;
        } else {
          synced++;
        }
      } else {
        errors.push({ username: staff.username, error: res.error });
      }
    } catch (e) {
      errors.push({ username: staff.username, error: e.message });
    }
  }

  return { total: staffList.length, synced, existing, errors };
}

export async function deleteStaffSync(staffId, username) {
  const client = getActiveClient();
  try {
    try {
      if (staffId) {
        await client.from('staff_users').delete().eq('id', staffId);
      } else if (username) {
        await client.from('staff_users').delete().eq('username', username);
      }
    } catch (cErr) {}

    if (staffId) await db.staff.delete(staffId);
    if (username) {
      const byUser = await db.staff.where('username').equals(username).first();
      if (byUser) await db.staff.delete(byUser.id);
    }
    broadcastRecordDeleted('staff', staffId || username);
    return true;
  } catch (err) {
    console.error('Error deleting staff:', err);
    throw err;
  }
}

/**
 * 18.1 ระงับการใช้งานพนักงาน (Suspend / Ban Staff User)
 * - กำหนดระยะเวลา (นาที/ชั่วโมง/วัน/ปี หรือ ถาวร)
 * - ซิงก์ไปยัง Supabase (RPC suspend_staff_user / update staff_users)
 * - บรอดแคสต์เตะผู้ใช้ในทุกหน้าจอและแท็บทันทีแบบ Real-Time
 */
export async function suspendStaffUserSync({ staffId, username, bannedUntil, isPermanent, reason }) {
  const client = getActiveClient();
  const banPayload = {
    staff_id: staffId,
    username,
    is_active: false,
    banned_until: isPermanent ? null : bannedUntil,
    is_banned_permanent: !!isPermanent,
    ban_reason: reason || 'คำสั่งจากผู้ดูแลระบบ'
  };

  try {
    // 1. เรียกใช้งาน Server-Side RPC เพื่ออัปเดตทั้ง staff_users และ auth.users ของ Supabase
    try {
      if (client) {
        const { data: rpcData, error: rpcErr } = await client.rpc('suspend_staff_user', {
          p_staff_id: staffId,
          p_banned_until: isPermanent ? null : bannedUntil,
          p_is_permanent: !!isPermanent,
          p_reason: reason || 'คำสั่งจากผู้ดูแลระบบ'
        });
        if (!rpcErr && rpcData?.success) {
          console.log('✅ User suspended via RPC:', staffId);
        }
      }
    } catch (e) {
      console.warn('suspend_staff_user RPC fallback notice:', e);
    }

    // 2. อัปเดตตรงไปยังตาราง staff_users เพื่อความมั่นใจ 100%
    try {
      if (client) {
        const updateData = {
          is_active: false,
          banned_until: isPermanent ? null : bannedUntil,
          is_banned_permanent: !!isPermanent,
          ban_reason: reason || 'คำสั่งจากผู้ดูแลระบบ',
          updated_at: new Date().toISOString()
        };
        const { error: updErr } = await client.from('staff_users').update(updateData).eq('id', staffId);
        if (updErr) {
          // หากคอลัมน์ใหม่ยังไม่ได้ถูกสร้างใน DB ให้เก็บไว้ใน note และปิด is_active
          await client.from('staff_users').update({
            is_active: false,
            note: JSON.stringify({ banned_until: bannedUntil, is_permanent: isPermanent, reason }),
            updated_at: new Date().toISOString()
          }).eq('id', staffId);
        }
      }
    } catch (tblErr) {
      console.warn('Fallback direct update to staff_users notice:', tblErr);
    }

    // 3. อัปเดตแคชท้องถิ่นใน IndexedDB
    try {
      const existing = await db.staff.get(staffId);
      if (existing) {
        await db.staff.put({
          ...existing,
          is_active: false,
          banned_until: isPermanent ? null : bannedUntil,
          is_banned_permanent: !!isPermanent,
          ban_reason: reason || 'คำสั่งจากผู้ดูแลระบบ'
        });
      }
    } catch (idbErr) {}

    // 4. บรอดแคสต์สัญญาณเตะผู้ใช้ออกจากจอทันทีแบบ Real-Time (Cross-Tab / Cross-Window)
    try {
      const bc = new BroadcastChannel('flower2u_staff_kick');
      bc.postMessage({
        type: 'FORCE_KICK_BANNED',
        staffId,
        username,
        bannedUntil,
        isPermanent: !!isPermanent,
        reason: reason || 'คำสั่งจากผู้ดูแลระบบ'
      });
      bc.close();
    } catch (bcErr) {}

    return { success: true };
  } catch (err) {
    console.error('Error suspending staff user:', err);
    throw err;
  }
}

/**
 * 18.2 ปลดระงับการใช้งานพนักงาน (Unban Staff User)
 */
export async function unbanStaffUserSync({ staffId, username }) {
  const client = getActiveClient();
  try {
    // 1. เรียกใช้งาน Server-Side RPC
    try {
      if (client) {
        await client.rpc('suspend_staff_user', {
          p_staff_id: staffId,
          p_banned_until: null,
          p_is_permanent: false,
          p_reason: null
        });
      }
    } catch (e) {}

    // 2. อัปเดตตรงไปยังตาราง staff_users
    try {
      if (client) {
        const { error: updErr } = await client.from('staff_users').update({
          is_active: true,
          banned_until: null,
          is_banned_permanent: false,
          ban_reason: null,
          updated_at: new Date().toISOString()
        }).eq('id', staffId);

        if (updErr) {
          await client.from('staff_users').update({
            is_active: true,
            note: null,
            updated_at: new Date().toISOString()
          }).eq('id', staffId);
        }
      }
    } catch (e) {}

    // 3. อัปเดตแคชท้องถิ่นใน IndexedDB
    try {
      const existing = await db.staff.get(staffId);
      if (existing) {
        await db.staff.put({
          ...existing,
          is_active: true,
          banned_until: null,
          is_banned_permanent: false,
          ban_reason: null
        });
      }
    } catch (e) {}

    // 4. บรอดแคสต์สัญญาณปลดแบน
    try {
      const bc = new BroadcastChannel('flower2u_staff_kick');
      bc.postMessage({
        type: 'STAFF_UNBANNED',
        staffId,
        username
      });
      bc.close();
    } catch (e) {}

    return { success: true };
  } catch (err) {
    console.error('Error unbanning staff:', err);
    throw err;
  }
}

/**
 * 18.3 Realtime Monitor สำหรับตรวจจับสถานะพนักงาน (เตะผู้ใช้ข้ามเครื่องสดทันที)
 */
export function subscribeToStaffRealtime(onStaffUpdate) {
  const client = getActiveClient();
  if (!client) return () => {};

  const channel = client
    .channel('realtime-staff-monitor')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'staff_users' },
      (payload) => {
        if (payload.new && onStaffUpdate) {
          onStaffUpdate(payload.new);
        }
      }
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}
