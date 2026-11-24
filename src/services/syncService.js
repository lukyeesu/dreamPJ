import { supabase, getActiveClient } from './supabaseClient';
import { db } from './db';
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
  'note',
  'version',
  'updated_at'
].join(',');

export const PROJECT_DETAIL_COLUMNS = [
  'id',
  'primary_image_url',
  'images',
  'slips',
  'customer_phone',
  'customer_line',
  'customer_social',
  'customer_email',
  'customer_tax_id',
  'customer_address',
  'updated_at'
].join(',');

export const QUOTATION_LEGACY_COLUMNS = 'id,project_id,category,detail,quantity,unit_price,price,item_date';
export const QUOTATION_COLUMNS = 'id,project_id,category,detail,quantity,unit_price,price,item_date,is_voided';
export const SUPPORT_COLUMNS = 'id,project_id,denomination,quantity,price,item_date';
export const EXPENSE_LEGACY_COLUMNS = 'id,project_id,category,detail,quantity,unit_price,price,item_date';
export const EXPENSE_COLUMNS = 'id,project_id,category,detail,quantity,unit_price,price,item_date,is_voided';
export const LOCATION_COLUMNS = 'id,name,zone,gate_info,parking_height_limit,dock_contact_phone,default_map_link,loading_dock_map_link,delivery_tips,is_active';
export const SHOP_SETTINGS_LEGACY_COLUMNS = 'id,shop_name,phone,email,address,line_id,facebook,instagram,tiktok,twitter,wechat,telegram,logo_url,theme_color,theme_mode,custom_color_value,drive_folders,reference_folder_id,assets_folder_id,slips_folder_id,line_bot_token,telegram_bot_token,telegram_chat_id,project_categories,expense_categories,deal_statuses,transport_statuses,updated_at';
export const SHOP_SETTINGS_COLUMNS = 'id,shop_name,phone,email,address,line_id,facebook,instagram,tiktok,twitter,wechat,telegram,logo_url,theme_color,theme_mode,custom_color_value,drive_folders,reference_folder_id,assets_folder_id,slips_folder_id,line_bot_token,telegram_bot_token,telegram_chat_id,project_categories,expense_categories,deal_statuses,transport_statuses,payment_statuses,updated_at';
export const STAFF_LEGACY_COLUMNS = 'id,username,full_name,nickname,phone,email,citizen_id,birth_date,address,emergency_contact,role_id,is_active,profile_image_url,roles(id,name,label,code,allowed_pages)';
export const STAFF_COLUMNS = 'id,username,full_name,nickname,phone,email,citizen_id,birth_date,address,emergency_contact,role_id,is_active,banned_until,is_banned_permanent,ban_reason,profile_image_url,roles(id,name,label,code,allowed_pages)';
export const ROLE_COLUMNS = 'id,name,code,label,description,allowed_pages,can_edit_pricing,can_delete_project,can_borrow_tools,can_manage_users,is_system_role';
export const CUSTOMER_COLUMNS = 'id,name,phone,line_id,social_account,email,tax_id,billing_address,vip_tier,primary_artist_id,created_at';
export const INVENTORY_COLUMNS = 'id,code,name,category_id,item_type,unit,current_stock,min_alert_threshold,average_cost,storage_location,color,size,status,is_active';
export const ASSET_LOAN_COLUMNS = 'id,item_id,project_id,borrower_name,borrowed_at,expected_return_at,actual_returned_at,status,notes';
export const ASSET_UNIT_COLUMNS = 'unit_code,item_id,status,borrowed_by,borrowed_at,project_id,notes,created_at';
export const CHECKLIST_ITEM_COLUMNS = 'id,project_id,item_id,category_name,item_name,item_type,required_qty,unit,picked_qty,returned_qty,damaged_qty,unit_cost,assigned_codes,is_checked,notes,created_at,updated_at';
export const QUOTATION_DOC_COLUMNS = 'id,quote_no,title,client_name,project_code,backdrop_items,floral_items,backdrop_cost,floral_cost,total_cost,markup_percent,final_price,note,created_at,updated_at';
export const MATERIAL_RATE_COLUMNS = 'id,name,default_price_sqm,is_active,updated_at';
export const ARTIST_COLUMNS = 'id,name,agency,fandom_name,fandom_color,birth_date,debut_date,bio,social_links,favorite_flowers,avatar_url,notes,created_at';

export const DEFAULT_PERMISSION_MATRIX = {
  admin: {
    label: 'แอดมิน (Admin)',
    code: '11',
    allowed_pages: ['Calendar', 'Plans', 'Finance', 'Quotations', 'Inventory', 'Locations', 'Artists', 'Customers', 'Staff', 'Analytics', 'Settings'],
    can_edit_pricing: true,
    can_delete_project: true,
    can_borrow_tools: true,
    can_manage_users: true
  },
  technician: {
    label: 'ช่างจัดดอกไม้ (Technician)',
    code: '21',
    allowed_pages: ['Calendar', 'Plans', 'Inventory', 'Locations', 'Artists'],
    can_edit_pricing: false,
    can_delete_project: false,
    can_borrow_tools: true,
    can_manage_users: false
  },
  driver: {
    label: 'พนักงานจัดส่ง (Driver)',
    code: '31',
    allowed_pages: ['Calendar', 'Plans', 'Locations'],
    can_edit_pricing: false,
    can_delete_project: false,
    can_borrow_tools: false,
    can_manage_users: false
  },
  accountant: {
    label: 'ฝ่ายบัญชี/การเงิน (Accountant)',
    code: '41',
    allowed_pages: ['Calendar', 'Plans', 'Finance', 'Quotations', 'Customers', 'Analytics'],
    can_edit_pricing: true,
    can_delete_project: false,
    can_borrow_tools: false,
    can_manage_users: false
  }
};

export const DEFAULT_PAYMENT_STATUSES = [
  { value: 'unpaid', label: 'รอชำระเงิน (Unpaid)', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'deposit', label: 'ชำระมัดจำแล้ว (Partial / Deposit)', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'paid', label: 'ชำระครบถ้วนแล้ว (Paid)', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'refunded', label: 'คืนเงิน / ยกเลิก (Refunded)', color: 'bg-rose-50 text-rose-700 border-rose-200' }
];

export const DEFAULT_MATERIAL_RATES = [
  { id: '00000000-0000-4000-8000-000000000101', name: 'ฟิวเจอร์บอร์ด 3 มม. พิมพ์สติ๊กเกอร์', default_price_sqm: 350, is_active: true },
  { id: '00000000-0000-4000-8000-000000000102', name: 'ฟิวเจอร์บอร์ด 5 มม. พร้อมไดคัท', default_price_sqm: 450, is_active: true },
  { id: '00000000-0000-4000-8000-000000000103', name: 'ป้ายไวนิลความละเอียดสูง', default_price_sqm: 180, is_active: true },
  { id: '00000000-0000-4000-8000-000000000104', name: 'โฟมบอร์ด 5 มม. เคลือบด้าน', default_price_sqm: 550, is_active: true },
  { id: '00000000-0000-4000-8000-000000000105', name: 'พลาสวูด 5 มม. แข็งพิเศษ + ไดคัท', default_price_sqm: 750, is_active: true }
];

export const isMissingPaymentStatusesColumnError = (error) => {
  if (!error) return false;
  const msg = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toLowerCase();
  if (error.code === '42703' || error.code === 'PGRST204') {
    return !msg.trim() || msg.includes('payment_statuses');
  }
  return msg.includes('payment_statuses') && (
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find')
  );
};

export const isMissingIsVoidedColumnError = (error) => {
  if (!error) return false;
  const msg = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toLowerCase();
  if (error.code === '42703' || error.code === 'PGRST204') {
    return !msg.trim() || msg.includes('is_voided');
  }
  return msg.includes('is_voided') && (
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find')
  );
};

export const isMissingStaffBanColumnError = (error) => {
  if (!error) return false;
  const msg = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toLowerCase();
  if (error.code === '42703' || error.code === 'PGRST204') {
    return !msg.trim() || msg.includes('banned_until') || msg.includes('is_banned_permanent') || msg.includes('ban_reason');
  }
  return (msg.includes('banned_until') || msg.includes('is_banned_permanent') || msg.includes('ban_reason')) && (
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find')
  );
};

export const isValidUuid = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);

function generateRandomUuid() {
  if (typeof globalThis !== 'undefined' && typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof globalThis !== 'undefined' && typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function sanitizeRemoteImageUrl(val) {
  if (!val) return '';
  const raw = typeof val === 'string' ? val : (typeof val === 'object' ? (val.url ?? val.src ?? '') : '');
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  if (lower.startsWith('data:') || lower.startsWith('blob:') || trimmed.length > 2048) {
    return '';
  }
  return trimmed;
}

export async function allocateNextProjectCodeSync(localActivities = []) {
  let localMax = 0;
  if (Array.isArray(localActivities)) {
    for (const item of localActivities) {
      const rawId = typeof item === 'string' ? item : (item?.id ?? item?.code ?? '');
      const m = String(rawId || '').trim().match(/^P-(\d+)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > localMax) localMax = n;
      }
    }
  }

  const client = getActiveClient();
  if (client) {
    try {
      const { data: rpcData, error: rpcErr } = await client.rpc('allocate_next_project_code');
      if (!rpcErr && rpcData !== null && rpcData !== undefined) {
        if (typeof rpcData === 'number' && Number.isFinite(rpcData) && rpcData > 0) {
          return 'P-' + String(Math.trunc(rpcData)).padStart(4, '0');
        }
        const rawCode = typeof rpcData === 'string' ? rpcData.trim() : String(rpcData?.code ?? rpcData?.project_code ?? rpcData?.id ?? '').trim();
        const rpcMatch = rawCode.match(/^P-(\d+)$/);
        if (rpcMatch) {
          const rpcNum = parseInt(rpcMatch[1], 10);
          return 'P-' + String(rpcNum).padStart(4, '0');
        }
      }
    } catch (_) {}

    let remoteMax = 0;
    try {
      let query = client.from('projects').select('id');
      query = typeof query.like === 'function' ? query.like('id', 'P-%') : query.ilike('id', 'P-%');
      const { data: rows, error: qErr } = await query.order('id', { ascending: false }).limit(25);
      if (!qErr && Array.isArray(rows)) {
        for (const r of rows) {
          const m = String(r?.id || '').trim().match(/^P-(\d+)$/);
          if (m) {
            const n = parseInt(m[1], 10);
            if (n > remoteMax) remoteMax = n;
          }
        }
      }
    } catch (_) {}

    const next = Math.max(remoteMax, localMax) + 1;
    return 'P-' + String(next).padStart(4, '0');
  }

  const next = localMax + 1;
  return 'P-' + String(next).padStart(4, '0');
}

const isChildItemVoided = (item) => Boolean(item?.is_voided || item?.isVoided);

const toLocalDateTimeInput = (val) => {
  if (!val) return '';
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/.test(str)) {
    return str.replace(' ', 'T').substring(0, 16);
  }
  const d = new Date(str);
  if (isNaN(d.getTime())) return str.substring(0, 16);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
};

// Helper แปลงแถวจาก Supabase เป็นโครงสร้าง Activity ที่หน้าบ้านใช้งาน
export function transformSupabaseProjectToUi(row, childItems = {}, existing = {}) {
  if (!row) return null;

  const quotationItems = (childItems.quotationItems || []).map(q => ({
    id: q.id,
    category: q.category || '',
    detail: q.detail || '',
    quantity: Number(q.quantity) || 1,
    unitPrice: Number(q.unit_price) || 0,
    price: Number(q.price) || 0,
    date: q.item_date || '',
    is_voided: Boolean(q.is_voided)
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
    date: ex.item_date || '',
    is_voided: Boolean(ex.is_voided)
  }));

  const images = Array.isArray(row.images) && row.images.length > 0
    ? row.images
    : (row.primary_image_url ? [row.primary_image_url] : []);

  const slips = Array.isArray(row.slips) ? row.slips : [];
  const resolvedImages = row.images === undefined ? (existing.images || images) : images;
  const resolvedImage = row.primary_image_url !== undefined
    ? (row.primary_image_url || resolvedImages[0] || null)
    : (row.images !== undefined ? (resolvedImages[0] || null) : (existing.image || resolvedImages[0] || null));

  const existingUpdatedAt = existing?.updated_at ?? existing?.updatedAt ?? null;
  const invalidateStaleChildren = Boolean(
    childItems.quotationItems === undefined &&
    existing &&
    row.updated_at &&
    existingUpdatedAt &&
    existingUpdatedAt !== row.updated_at
  );

  return {
    id: row.id,
    name: row.name || '',
    category: row.category || 'งานจัดดอกไม้',
    artist: row.artist_name || '',
    artistId: row.artist_id || null,
    customer: row.customer_name || '',
    customerId: row.customer_id || null,
    customerInfo: {
      social: row.customer_social === undefined ? (existing.customerInfo?.social || '') : (row.customer_social || ''),
      line: row.customer_line === undefined ? (existing.customerInfo?.line || '') : (row.customer_line || ''),
      phone: row.customer_phone === undefined ? (existing.customerInfo?.phone || '') : (row.customer_phone || ''),
      email: row.customer_email === undefined ? (existing.customerInfo?.email || '') : (row.customer_email || ''),
      taxId: row.customer_tax_id === undefined ? (existing.customerInfo?.taxId || '') : (row.customer_tax_id || ''),
      address: row.customer_address === undefined ? (existing.customerInfo?.address || '') : (row.customer_address || '')
    },
    rawDateTime: toLocalDateTimeInput(row.project_datetime || row.raw_delivery_start),
    date: row.raw_delivery_start
      ? row.raw_delivery_start.substring(0, 10)
      : (row.delivery_date_display && row.delivery_date_display.trim() !== '-'
          ? row.delivery_date_display.split(' ')[0]
          : (toLocalDateTimeInput(row.project_datetime).substring(0, 10) || '')),
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
    image: resolvedImage,
    images: resolvedImages,
    slips: row.slips === undefined ? (existing.slips || slips) : slips,
    quotationItems: childItems.quotationItems === undefined
      ? (invalidateStaleChildren ? [] : (existing.quotationItems || quotationItems))
      : quotationItems,
    customerSupport: childItems.customerSupport === undefined
      ? (invalidateStaleChildren ? [] : (existing.customerSupport || customerSupport))
      : customerSupport,
    expenses: childItems.expenses === undefined
      ? (invalidateStaleChildren ? [] : (existing.expenses || expenses))
      : expenses,
    version: row.version || 1,
    updated_at: row.updated_at
  };
}

// Helper แปลงข้อมูลจาก UI เข้า Supabase
export function transformUiToSupabase(activityData) {
  const rawQuotationList = Array.isArray(activityData.quotationItems) ? activityData.quotationItems : [];
  const hasMeaningfulQuotationItems = rawQuotationList.some(
    (q) => isChildItemVoided(q) || (Number(q.price) || 0) > 0 || (Number(q.unitPrice ?? q.unit_price) || 0) > 0
  );
  const quotationTotal = rawQuotationList
    .filter((q) => !isChildItemVoided(q))
    .reduce((sum, q) => sum + (Number(q.price) || ((Number(q.unitPrice ?? q.unit_price) || 0) * (Number(q.quantity) || 1)) || 0), 0);

  const wage = hasMeaningfulQuotationItems ? quotationTotal : (Number(activityData.wage) || 0);
  const deliveryFee = Number(activityData.deliveryFee) || 0;
  const depositAmount = Number(activityData.depositAmount) || 0;
  const totalRevenue = wage + deliveryFee;

  let totalExpenses = 0;
  if (Array.isArray(activityData.expenses) && activityData.expenses.length > 0) {
    totalExpenses = activityData.expenses
      .filter((e) => !isChildItemVoided(e))
      .reduce((sum, e) => sum + (Number(e.price) || ((Number(e.unitPrice ?? e.unit_price) || 0) * (Number(e.quantity) || 1)) || 0), 0);
  } else if (!Array.isArray(activityData.expenses) && (activityData.totalExpenses || activityData.total_expenses)) {
    totalExpenses = Number(activityData.totalExpenses || activityData.total_expenses) || 0;
  }

  let customerSupportTotal = 0;
  if (Array.isArray(activityData.customerSupport) && activityData.customerSupport.length > 0) {
    customerSupportTotal = activityData.customerSupport.reduce((sum, cs) => {
      const denom = Number(cs.denomination) || 0;
      const qty = Number(cs.quantity) || 0;
      return sum + (Number(cs.price) || (denom * qty));
    }, 0);
  } else if (!Array.isArray(activityData.customerSupport) && (activityData.customerSupportTotal || activityData.customer_support_total)) {
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

  const rawImages = Array.isArray(activityData.images) ? activityData.images : (activityData.image ? [activityData.image] : []);
  const images = rawImages.map(sanitizeRemoteImageUrl).filter(Boolean);
  const rawSlips = Array.isArray(activityData.slips) ? activityData.slips : [];
  const slips = rawSlips.map(sanitizeRemoteImageUrl).filter(Boolean);
  const primaryImageUrl = sanitizeRemoteImageUrl(activityData.primary_image_url ?? activityData.image ?? images[0]) || images[0] || null;

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
    primary_image_url: primaryImageUrl,
    images,
    slips
  };

  const quotationItems = rawQuotationList.map((q, idx) => ({
    id: isValidUuid(q.id) ? q.id : generateRandomUuid(),
    project_id: activityData.id,
    category: q.category || 'รายการทั่วไป',
    detail: q.detail || '',
    quantity: Number(q.quantity) || 1,
    unit_price: Number(q.unitPrice ?? q.unit_price) || 0,
    price: Number(q.price) || 0,
    item_date: q.date || q.item_date || null,
    is_voided: isChildItemVoided(q),
    sort_order: idx
  }));

  const customerSupport = (activityData.customerSupport || []).map((cs, idx) => ({
    id: isValidUuid(cs.id) ? cs.id : generateRandomUuid(),
    project_id: activityData.id,
    denomination: Math.round(Number(cs.denomination)) || 0,
    quantity: Math.round(Number(cs.quantity)) || 0,
    price: Number(cs.price) || 0,
    item_date: cs.date || cs.item_date || null,
    sort_order: idx
  }));

  const expenses = (activityData.expenses || []).map((ex, idx) => ({
    id: isValidUuid(ex.id) ? ex.id : generateRandomUuid(),
    project_id: activityData.id,
    category: ex.category || 'ค่าใช้จ่ายทั่วไป',
    detail: ex.detail || '',
    quantity: Number(ex.quantity) || 1,
    unit_price: Number(ex.unitPrice ?? ex.unit_price) || 0,
    price: Number(ex.price) || 0,
    item_date: ex.date || ex.item_date || null,
    is_voided: isChildItemVoided(ex),
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
  const projectIds = projects.map(p => p.id);
  let [qRes, csRes, exRes] = await Promise.all([
    client.from('project_quotation_items').select(QUOTATION_COLUMNS).in('project_id', projectIds),
    client.from('project_customer_support').select(SUPPORT_COLUMNS).in('project_id', projectIds),
    client.from('project_expenses').select(EXPENSE_COLUMNS).in('project_id', projectIds)
  ]);
  if (isMissingIsVoidedColumnError(qRes.error) || isMissingIsVoidedColumnError(exRes.error)) {
    const [qFallback, exFallback] = await Promise.all([
      isMissingIsVoidedColumnError(qRes.error)
        ? client.from('project_quotation_items').select(QUOTATION_LEGACY_COLUMNS).in('project_id', projectIds)
        : Promise.resolve(qRes),
      isMissingIsVoidedColumnError(exRes.error)
        ? client.from('project_expenses').select(EXPENSE_LEGACY_COLUMNS).in('project_id', projectIds)
        : Promise.resolve(exRes)
    ]);
    qRes = qFallback;
    exRes = exFallback;
  }
  for (const result of [qRes, csRes, exRes]) {
    if (result.error) throw result.error;
  }
  const group = items => {
    const map = new Map();
    for (const item of items || []) {
      if (!map.has(item.project_id)) map.set(item.project_id, []);
      map.get(item.project_id).push(item);
    }
    return map;
  };
  return { qMap: group(qRes.data), csMap: group(csRes.data), exMap: group(exRes.data) };
}

async function cacheProjectRows(rows, childData, isCurrent = () => true) {
  // Keep summary and detail responses from overwriting each other's cached fields.
  return db.transaction('rw', db.projects, async () => {
    const existing = await db.projects.bulkGet(rows.map(row => row.id));
    if (!isCurrent()) return [];
    const projects = rows.map((row, index) => transformSupabaseProjectToUi(row, childData ? {
      quotationItems: childData.qMap.get(row.id) || [],
      customerSupport: childData.csMap.get(row.id) || [],
      expenses: childData.exMap.get(row.id) || []
    } : {}, existing[index]));
    await db.projects.bulkPut(projects);
    return projects;
  });
}

export const PROJECT_LOAD_TTL_MS = 60000;
const SUMMARY_STATS_TTL_MS = 5 * 60 * 1000;
const inFlightProjectLoads = new Map();
const recentProjectLoads = new Map();
const recentlySavedProjectMap = new Map();
let summaryStatsMemCache = { data: null, fetchedAt: 0 };
let projectLoadEpoch = 0;

export function resetProjectLoadCache() {
  projectLoadEpoch++;
  inFlightProjectLoads.clear();
  recentProjectLoads.clear();
  summaryStatsMemCache = { data: null, fetchedAt: 0 };
}

export async function loadProjectsByMonth(yearMonth, onSyncUpdate, options = {}) {
  if (!yearMonth) return [];
  return loadProjectsScoped({ mode: 'month', date: yearMonth, includeDetails: !!options.includeDetails }, onSyncUpdate);
}

export async function loadProjectsScoped({ mode = 'month', date = '', range = { start: '', end: '' }, includeDetails = false, dateField = 'delivery' } = {}, onSyncUpdate) {
  const client = getActiveClient();
  const epoch = projectLoadEpoch;
  const isCurrent = () => epoch === projectLoadEpoch;
  const useProjectDate = dateField === 'project';
  const usePaymentDate = dateField === 'payment';
  let localScoped = [];
  try {
    let startStr = null;
    let endStr = null;
    if (mode === 'all') {
      // No delivery date bounds for the all-projects scope.
    } else if (mode === 'date' && date) {
      startStr = date + 'T00:00:00';
      endStr = date + 'T23:59:59';
    } else if (mode === 'year' && date) {
      const year = String(date).slice(0, 4);
      startStr = year + '-01-01T00:00:00';
      endStr = year + '-12-31T23:59:59';
    } else if (mode === 'week' && date) {
      const monday = new Date(date + 'T00:00:00');
      const day = monday.getDay();
      monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1));
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      const dayString = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      startStr = dayString(monday) + 'T00:00:00';
      endStr = dayString(sunday) + 'T23:59:59';
    } else if (mode === 'range' && range?.start && range?.end) {
      startStr = range.start + 'T00:00:00';
      endStr = range.end + 'T23:59:59';
    } else {
      const now = new Date();
      const month = mode === 'month' && date ? date : now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
      const bounds = getMonthDateBounds(month);
      startStr = bounds.start;
      endStr = bounds.end;
    }

    // Use the same date field as the remote query when reconciling deletions.
    const inScope = p => {
      if (!startStr) return true;
      if (usePaymentDate) {
        if (p.paymentDate) {
          const payDay = String(p.paymentDate).trim().slice(0, 10);
          return Boolean(payDay && payDay >= startStr.slice(0, 10) && payDay <= endStr.slice(0, 10));
        }
        return Boolean(p.rawDateTime && p.rawDateTime >= startStr && p.rawDateTime <= endStr);
      }
      const val = useProjectDate ? p.rawDateTime : p.rawDeliveryStart;
      return Boolean(val && val >= startStr && val <= endStr);
    };
    const allLocal = await db.projects.toArray();
    if (!isCurrent()) return [];
    localScoped = allLocal.filter(inScope);
    if (localScoped.length && onSyncUpdate) onSyncUpdate(localScoped);

    const cacheKey = JSON.stringify([startStr, endStr, includeDetails, dateField]);
    const inFlight = inFlightProjectLoads.get(cacheKey);
    if (inFlight) {
      if (onSyncUpdate) {
        inFlight.listeners.add(onSyncUpdate);
        if (inFlight.latest) onSyncUpdate(inFlight.latest.projects, inFlight.latest.deletedIds);
      }
      return await inFlight.promise;
    }
    const recent = recentProjectLoads.get(cacheKey);
    if (recent && Date.now() - recent.fetchedAt < PROJECT_LOAD_TTL_MS) {
      if (onSyncUpdate) onSyncUpdate(localScoped, recent.deletedIds);
      return localScoped;
    }

    const entry = { listeners: new Set(onSyncUpdate ? [onSyncUpdate] : []), latest: null, promise: null };
    const publish = (projects, deletedIds = []) => {
      if (!isCurrent()) return;
      entry.latest = { projects, deletedIds };
      for (const listener of entry.listeners) {
        try { listener(projects, deletedIds); } catch (err) { console.warn('Project update callback failed:', err); }
      }
    };
    entry.promise = (async () => {
      try {
        let allProjects = [];
        let totalCount = null;
        let offset = 0;
        let pageCount = 0;
        let cappedByScopeLimit = false;
        const maxPages = (mode === 'year' || mode === 'all') ? 2 : Infinity;
        let complete = false;
        while (!complete) {
          const batchSize = offset === 0 ? 50 : 500;
          let query = client.from('projects').select(PROJECT_LIST_COLUMNS, offset === 0 ? { count: 'exact' } : undefined);
          if (startStr && endStr) {
            if (usePaymentDate) {
              const startDay = startStr.slice(0, 10);
              const endDay = endStr.slice(0, 10);
              query = query.or(
                `and(payment_date.gte.${startDay},payment_date.lte.${endDay}),and(payment_date.is.null,project_datetime.gte.${startStr}+07:00,project_datetime.lte.${endStr}+07:00)`
              );
            } else if (useProjectDate) {
              query = query.gte('project_datetime', `${startStr}+07:00`).lte('project_datetime', `${endStr}+07:00`);
            } else {
              query = query.gte('raw_delivery_start', startStr).lte('raw_delivery_start', endStr);
            }
          }
          const orderCol = usePaymentDate || useProjectDate ? 'project_datetime' : 'raw_delivery_start';
          const { data, error, count } = await query
            .order(orderCol, { ascending: false }).order('id', { ascending: false })
            .range(offset, offset + batchSize - 1);
          if (error) throw error;
          if (!isCurrent()) return [];
          if (offset === 0 && Number.isInteger(count)) totalCount = count;
          const rows = data || [];
          if (rows.length === 0) {
            complete = totalCount !== null && offset >= totalCount;
            break;
          }
          const childData = includeDetails ? await fetchChildItemsForProjects(client, rows) : undefined;
          if (!isCurrent()) return [];
          const projects = await cacheProjectRows(rows, childData, isCurrent);
          if (!isCurrent()) return [];
          allProjects = allProjects.concat(projects);
          publish(allProjects);
          offset += rows.length;
          pageCount += 1;
          const reachedEnd = totalCount !== null ? offset >= totalCount : rows.length < batchSize;
          if (reachedEnd) {
            complete = true;
          } else if (pageCount >= maxPages) {
            complete = false;
            cappedByScopeLimit = true;
            break;
          }
        }

        const deletedIds = [];
        const remoteIds = new Set(allProjects.map(p => p.id));
        complete = complete && (totalCount === null || remoteIds.size >= totalCount);
        const session = (await client.auth.getSession())?.data?.session;
        if (!isCurrent()) return [];
        if (complete && session) {
          const currentLocal = await db.projects.toArray();
          if (!isCurrent()) return [];
          const initialIds = new Set(localScoped.map(p => p.id));
          deletedIds.push(...currentLocal.filter(p => initialIds.has(p.id) && inScope(p) && !remoteIds.has(p.id)).map(p => p.id));
          if (deletedIds.length) await db.projects.bulkDelete(deletedIds);
        }
        publish(allProjects, deletedIds);
        // Failed or incomplete downloads must remain retryable, including empty scopes (capped year/all scopes can still throttle without deleting un-fetched pages).
        if ((complete || cappedByScopeLimit) && session && isCurrent()) {
          recentProjectLoads.set(cacheKey, { fetchedAt: Date.now(), deletedIds });
        }
        return allProjects;
      } catch (err) {
        console.error('Error loading project scope:', mode, date, err);
        return localScoped;
      } finally {
        if (inFlightProjectLoads.get(cacheKey) === entry) inFlightProjectLoads.delete(cacheKey);
      }
    })();
    inFlightProjectLoads.set(cacheKey, entry);
    return await entry.promise;
  } catch (err) {
    console.error('Error reading project scope:', err);
    return localScoped;
  }
}

export async function loadProjectsLocalFirst(onSyncUpdate, options = {}) {
  return await loadProjectsScoped(options, onSyncUpdate);
}

// 2. บันทึกโปรเจกต์งานลง Supabase + IndexedDB
export async function saveProjectSync(activityData) {
  const validated = validatePayload(projectPayloadSchema, activityData, 'Project');
  const client = getActiveClient();
  const prevCached = await db.projects.get(validated.id).catch(() => null);
  const { projectRow, quotationItems, customerSupport, expenses } = transformUiToSupabase(validated);
  const { data: rpcData, error } = await client.rpc('save_project_with_items', {
    p_project: projectRow,
    p_quotation_items: quotationItems,
    p_customer_support: customerSupport,
    p_expenses: expenses
  });
  if (error) {
    if (error.code === 'PGRST202') {
      throw new Error('ระบบบันทึกโปรเจกต์ยังไม่พร้อม กรุณาติดต่อผู้ดูแลระบบ');
    }
    throw error;
  }

  const rpcUpdatedAt = typeof rpcData === 'string' ? rpcData : (rpcData?.updated_at || null);
  const explicitUpdatedAt =
    activityData?.updated_at && activityData.updated_at !== prevCached?.updated_at
      ? activityData.updated_at
      : null;
  const expectedUpdatedAt = rpcUpdatedAt || explicitUpdatedAt || null;

  const nowMs = Date.now();
  for (const [k, v] of recentlySavedProjectMap.entries()) {
    const ts = typeof v === 'number' ? v : v?.savedAt;
    if (!ts || nowMs - ts > 10000) recentlySavedProjectMap.delete(k);
  }
  recentlySavedProjectMap.set(validated.id, { savedAt: nowMs, expectedUpdatedAt });

  resetProjectLoadCache();
  const localRecord = {
    ...validated,
    wage: projectRow.wage,
    totalRevenue: projectRow.total_revenue,
    totalExpenses: projectRow.total_expenses,
    netProfit: projectRow.net_profit,
    customerSupportTotal: projectRow.customer_support_total,
    quotationItems: (validated.quotationItems || []).map((q, idx) => ({
      ...q,
      id: quotationItems[idx]?.id || q.id,
      is_voided: isChildItemVoided(q)
    })),
    customerSupport: (validated.customerSupport || []).map((cs, idx) => ({
      ...cs,
      id: customerSupport[idx]?.id || cs.id
    })),
    expenses: (validated.expenses || []).map((ex, idx) => ({
      ...ex,
      id: expenses[idx]?.id || ex.id,
      is_voided: isChildItemVoided(ex)
    }))
  };
  if (expectedUpdatedAt) {
    localRecord.updated_at = expectedUpdatedAt;
  } else {
    delete localRecord.updated_at;
  }
  delete localRecord.updatedAt;

  await db.projects.put(localRecord);
  return { success: true };
}

// 3. ลบโปรเจกต์ (ลบจาก Supabase ก่อนเสมอ หากสำเร็จจึงบันทึกลง Tombstone และล้าง IndexedDB)
export async function deleteProjectSync(id) {
  if (!id) return { success: false };
  const client = getActiveClient();

  if (client) {
    const { error } = await client.from('projects').delete().eq('id', id);
    if (error) {
      console.error(`❌ Failed to delete project ${id} from Supabase:`, error);
      throw error;
    }

    try {
      await client.from('deleted_records').insert({
        record_id: id,
        table_name: 'projects',
        deleted_at: new Date().toISOString()
      });
    } catch (tombErr) {
      console.warn('Tombstone insert notice:', tombErr?.message);
    }
  }

  resetProjectLoadCache();
  await db.projects.delete(id);
  broadcastRecordDeleted('projects', id);
  return { success: true };
}

// 4. ระบบ Realtime Subscription (เมื่อหน้าจออื่นแก้ หน้าจอเราจะเด้งอัปเดตสดทันที!)
export function subscribeToRealtimeProjects(onUpdate) {
  const client = getActiveClient();
  if (!client) return () => {};
  const channel = client
    .channel('realtime-projects-channel')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'projects' },
      async (payload) => {
        try {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            resetProjectLoadCache();
            const row = payload.new;
            if (!row?.id) return;

            const existing = await db.projects.get(row.id);
            const recentEntry = recentlySavedProjectMap.get(row.id);
            const savedAtMs = typeof recentEntry === 'number' ? recentEntry : recentEntry?.savedAt;
            const expectedTs = typeof recentEntry === 'object' ? recentEntry?.expectedUpdatedAt : null;
            const isOwnSelfEcho = Boolean(
              savedAtMs &&
              (Date.now() - savedAtMs < 3500) &&
              (!expectedTs || !row.updated_at || expectedTs === row.updated_at)
            );

            if (isOwnSelfEcho) {
              recentlySavedProjectMap.delete(row.id);
              const selfItem = transformSupabaseProjectToUi(
                row,
                {},
                existing ? { ...existing, updated_at: row.updated_at } : {}
              );
              await db.projects.put(selfItem);
              const all = await db.projects.toArray();
              if (onUpdate) onUpdate(all);
              return;
            }

            const hadDetailedChildren = Boolean(
              existing?.quotationItems?.length ||
              existing?.expenses?.length ||
              existing?.customerSupport?.length
            );

            if (!hadDetailedChildren) {
              const summaryItem = transformSupabaseProjectToUi(row, {}, existing || {});
              await db.projects.put(summaryItem);
              const all = await db.projects.toArray();
              if (onUpdate) onUpdate(all);
              return;
            }

            let [qRes, csRes, exRes] = await Promise.all([
              client.from('project_quotation_items').select(QUOTATION_COLUMNS).eq('project_id', row.id),
              client.from('project_customer_support').select(SUPPORT_COLUMNS).eq('project_id', row.id),
              client.from('project_expenses').select(EXPENSE_COLUMNS).eq('project_id', row.id)
            ]);
            if (isMissingIsVoidedColumnError(qRes.error) || isMissingIsVoidedColumnError(exRes.error)) {
              const [qFallback, exFallback] = await Promise.all([
                isMissingIsVoidedColumnError(qRes.error)
                  ? client.from('project_quotation_items').select(QUOTATION_LEGACY_COLUMNS).eq('project_id', row.id)
                  : Promise.resolve(qRes),
                isMissingIsVoidedColumnError(exRes.error)
                  ? client.from('project_expenses').select(EXPENSE_LEGACY_COLUMNS).eq('project_id', row.id)
                  : Promise.resolve(exRes)
              ]);
              qRes = qFallback;
              exRes = exFallback;
            }
            for (const result of [qRes, csRes, exRes]) {
              if (result.error) throw result.error;
            }
            const uiItem = transformSupabaseProjectToUi(row, {
              quotationItems: qRes.data || [],
              customerSupport: csRes.data || [],
              expenses: exRes.data || []
            }, existing);

            await db.projects.put(uiItem);
            const all = await db.projects.toArray();
            if (onUpdate) onUpdate(all);
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old?.id;
            if (deletedId) {
              resetProjectLoadCache();
              await db.projects.delete(deletedId);
              if (onUpdate) onUpdate([], [deletedId]);
            }
          }
        } catch (err) {
          console.warn('Realtime project update failed:', err);
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

// Persistent singleton BroadcastChannel('flower2u_sync_channel') — NEVER close immediately after postMessage!
let localSyncBroadcastChannel = null;
const localSyncSubscribers = new Set();
let localSyncEchoMarker = null;

function getLocalSyncBroadcastChannel() {
  if (localSyncBroadcastChannel) return localSyncBroadcastChannel;
  if (typeof BroadcastChannel === 'undefined') return null;
  try {
    const ch = new BroadcastChannel('flower2u_sync_channel');
    ch.onmessage = (event) => {
      const msg = event?.data;
      if (!msg) return;
      if (localSyncEchoMarker) localSyncEchoMarker();
      for (const listener of localSyncSubscribers) {
        try { listener(msg); } catch (_) {}
      }
    };
    localSyncBroadcastChannel = ch;
    return ch;
  } catch (_) {
    return null;
  }
}

function emitLocalSyncMessage(msg) {
  if (!msg) return;
  let echoedOnSameChannel = false;
  localSyncEchoMarker = () => { echoedOnSameChannel = true; };
  try {
    const bc = getLocalSyncBroadcastChannel();
    if (bc) {
      bc.postMessage(msg);
    }
  } catch (_) {
  } finally {
    localSyncEchoMarker = null;
  }

  let dispatchedWindowEvent = false;
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('f2u:local-sync', { detail: { __fromEmit: echoedOnSameChannel, payload: msg, ...msg } }));
      dispatchedWindowEvent = true;
    }
  } catch (_) {}

  if (!echoedOnSameChannel && !dispatchedWindowEvent) {
    for (const listener of localSyncSubscribers) {
      try { listener(msg); } catch (_) {}
    }
  }
}

export function subscribeToLocalSyncChannel(onMessage) {
  if (typeof onMessage !== 'function') return () => {};
  getLocalSyncBroadcastChannel();
  localSyncSubscribers.add(onMessage);

  const handleWindowSync = (event) => {
    const detail = event?.detail;
    if (!detail || detail.__fromEmit) return;
    const cleanMsg = detail.payload || detail;
    try { onMessage(cleanMsg); } catch (_) {}
  };

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('f2u:local-sync', handleWindowSync);
  }

  return () => {
    localSyncSubscribers.delete(onMessage);
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('f2u:local-sync', handleWindowSync);
    }
  };
}

// 4.2 ระบบกระจายสัญญาณการลบข้อมูลข้ามแท็บและข้ามอุปกรณ์แบบ Real-Time (Zero-Egress & Zero-Stale IndexedDB)
export function broadcastRecordDeleted(table, id) {
  if (!id || !table) return;
  const msg = { type: 'RECORD_DELETED', table, id };

  // 1. กระจายสัญญาณข้ามแท็บและหน้าต่างปัจจุบันผ่าน Persistent Singleton BroadcastChannel + CustomEvent
  emitLocalSyncMessage(msg);

  // 2. กระจายสัญญาณข้ามอุปกรณ์ผ่าน Supabase Realtime Broadcast (ใช้ Egress ไม่กี่ไบต์)
  try {
    const client = getActiveClient();
    if (client) {
      const ch = client.channel('flower2u_global_sync');
      if (typeof ch?.send === 'function') {
        ch.send({
          type: 'broadcast',
          event: 'RECORD_DELETED',
          payload: { table, id }
        }).catch(() => {});
      }
    }
  } catch (e) {}
}

// 4.3 ระบบกระจายสัญญาณการปรับปรุงสิทธิ์บทบาทแบบ Real-Time (เมนูเด้งขึ้นทันทีไม่ต้องกดรีเฟรช)
export function broadcastPermissionsUpdated(permissions) {
  if (!permissions) return;

  // 1. แจ้งเตือนภายในหน้าต่างปัจจุบัน
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('f2u_permissions_updated', { detail: permissions }));
    }
  } catch (_) {}

  // 2. กระจายสัญญาณข้ามแท็บผ่าน Persistent Singleton BroadcastChannel + CustomEvent
  emitLocalSyncMessage({ type: 'PERMISSIONS_UPDATED', permissions });

  // 3. กระจายสัญญาณข้ามอุปกรณ์ผ่าน Supabase Realtime Broadcast
  try {
    const client = getActiveClient();
    if (client) {
      const ch = client.channel('flower2u_global_sync');
      if (typeof ch?.send === 'function') {
        ch.send({
          type: 'broadcast',
          event: 'PERMISSIONS_UPDATED',
          payload: { permissions }
        }).catch(() => {});
      }
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
          const { data, error } = await client.from('roles').select(ROLE_COLUMNS);
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
            const merged = { ...DEFAULT_PERMISSION_MATRIX, ...matrix };
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem('f2u_role_permissions', JSON.stringify(merged));
                if (typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('f2u_permissions_updated', { detail: merged }));
                }
              } catch (e) {}
            }
            if (onRolesUpdate) onRolesUpdate(merged);
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
              if (typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
                window.dispatchEvent(new CustomEvent('f2u_permissions_updated', { detail: payload.permissions }));
              }
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

// 4.4b Multiplexed Realtime Channel สำหรับ Master Data ทั้ง 5 ตารางในช่องสัญญาณเดียว ('f2u-master-sync')
export function subscribeToMasterDataRealtime({
  onLocationsChange,
  onArtistsChange,
  onCustomersChange,
  onQuotationsChange,
  onMaterialRatesChange
} = {}) {
  const client = getActiveClient();
  if (!client) return () => {};

  const dispatchQuotationsSync = () => {
    try {
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
        window.dispatchEvent(new CustomEvent('f2u:quotations-sync'));
      }
    } catch (_) {}
  };

  const configs = [
    { table: 'delivery_locations', store: 'delivery_locations', cb: onLocationsChange, notifyQuote: false },
    { table: 'artists', store: 'artists', cb: onArtistsChange, notifyQuote: false },
    { table: 'customers', store: 'customers', cb: onCustomersChange, notifyQuote: false },
    { table: 'quotations', store: 'quotations', cb: onQuotationsChange, notifyQuote: true },
    { table: 'material_rates', store: 'material_rates', cb: onMaterialRatesChange, notifyQuote: true }
  ];

  let channel = client.channel('f2u-master-sync');
  for (const cfg of configs) {
    channel = channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: cfg.table },
      async (payload) => {
        try {
          const store = db[cfg.store];
          if (!store) return;
          if ((payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') && payload.new?.id) {
            const cleanRow = cfg.table === 'artists' && payload.new.avatar_url !== undefined
              ? { ...payload.new, avatar_url: sanitizeRemoteImageUrl(payload.new.avatar_url) }
              : { ...payload.new };
            await store.put(cleanRow);
            const updatedRows = await store.toArray();
            if (cfg.cb) cfg.cb(updatedRows);
            if (cfg.notifyQuote) dispatchQuotationsSync();
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old?.id;
            if (deletedId) {
              await store.delete(deletedId);
            }
            const updatedRows = await store.toArray();
            if (cfg.cb) cfg.cb(updatedRows);
            if (cfg.notifyQuote) dispatchQuotationsSync();
          }
        } catch (err) {
          console.warn(`Master realtime (${cfg.table}) notice:`, err);
        }
      }
    );
  }
  channel.subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

const DEXIE_STORE_BY_TOMBSTONE_TABLE = {
  projects: 'projects',
  quotations: 'quotations',
  material_rates: 'material_rates',
  delivery_locations: 'delivery_locations',
  artists: 'artists',
  customers: 'customers',
  staff_users: 'staff',
  staff: 'staff',
  inventory_items: 'inventory_items'
};

// 4.5 กวาดล้างข้อมูลที่ถูกลบออกจาก Supabase (Zero-Egress Tombstone Reconcile)
export async function syncDeletedRecords(onProjectsDeleted) {
  const client = getActiveClient();
  if (!client) return [];
  try {
    const syncMeta = await db.sync_meta?.get?.('last_deleted_synced_at').catch(() => null);
    let cursor = syncMeta ? syncMeta.value : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const deletedProjectIds = [];
    let page = 0;

    while (page < 10) {
      page += 1;
      const { data: deleted, error } = await client
        .from('deleted_records')
        .select('record_id, table_name, deleted_at')
        .gt('deleted_at', cursor)
        .order('deleted_at', { ascending: true })
        .limit(1000);

      if (error || !Array.isArray(deleted) || deleted.length === 0) break;

      for (const rec of deleted) {
        const tbl = rec.table_name;
        const id = rec.record_id;
        if (!id) continue;
        if (tbl === 'projects') {
          deletedProjectIds.push(id);
          await db.projects?.delete?.(id).catch(() => {});
        } else {
          const storeName = DEXIE_STORE_BY_TOMBSTONE_TABLE[tbl] || tbl;
          if (db[storeName]?.delete) {
            await db[storeName].delete(id).catch(() => {});
          }
        }
      }

      const newest = deleted[deleted.length - 1]?.deleted_at;
      if (!newest || newest === cursor) break;
      cursor = newest;
      await db.sync_meta?.put?.({ key: 'last_deleted_synced_at', value: newest }).catch(() => {});

      if (deleted.length < 1000) break;
    }

    if (deletedProjectIds.length > 0) {
      resetProjectLoadCache();
      if (onProjectsDeleted) {
        onProjectsDeleted(deletedProjectIds);
      }
    }
    return deletedProjectIds;
  } catch (err) {
    return [];
  }
}

// แปลงลิงก์ Google Drive Folder หรือ Folder ID ให้เหลือเฉพาะ Folder ID ที่สะอาด
export function extractGoogleDriveFolderId(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const folderMatch = raw.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];
  const idMatch = raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return idMatch[1];
  return raw;
}

// 5. โหลดการตั้งค่าร้านและพนักงานจาก Supabase
export async function loadSettingsFromSupabase() {
  const client = getActiveClient();
  try {
    let [shopRes, staffRes, rolesRes] = await Promise.all([
      client.from('shop_settings').select(SHOP_SETTINGS_COLUMNS).limit(1).maybeSingle(),
      client.from('staff_users').select(STAFF_COLUMNS),
      client.from('roles').select(ROLE_COLUMNS)
    ]);

    if (shopRes.error && isMissingPaymentStatusesColumnError(shopRes.error)) {
      shopRes = await client.from('shop_settings').select(SHOP_SETTINGS_LEGACY_COLUMNS).limit(1).maybeSingle();
    }

    if (staffRes.error && isMissingStaffBanColumnError(staffRes.error)) {
      staffRes = await client.from('staff_users').select(STAFF_LEGACY_COLUMNS);
    }

    if (shopRes.error) {
      throw shopRes.error;
    }

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
      paymentStatuses: Array.isArray(s.payment_statuses) && s.payment_statuses.length > 0 ? s.payment_statuses : null,
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
  if (!client) return null;
  try {
    // เรียกใช้งาน Server-Side RPC ดึงเฉพาะโปรเจกต์ที่ได้รับอนุญาตเท่านั้น (Zero-Egress & Zero-Leakage)
    const { data, error } = await client.rpc('get_public_project_by_token', {
      p_token: token
    });

    if (!error && data) {
      return data;
    }

    if (data?.error === 'ACCOUNT_SUSPENDED') {
      return data;
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
      if (s.logo !== undefined) updatePayload.logo_url = sanitizeRemoteImageUrl(s.logo);
      if (s.themeColor !== undefined) updatePayload.theme_color = s.themeColor;
      if (s.themeMode !== undefined) updatePayload.theme_mode = s.themeMode;
      if (s.customColorValue !== undefined) updatePayload.custom_color_value = s.customColorValue;
    }

    if (partialData.drive_folder_id !== undefined) updatePayload.reference_folder_id = extractGoogleDriveFolderId(partialData.drive_folder_id);
    if (partialData.assets_drive_folder_id !== undefined) updatePayload.assets_folder_id = extractGoogleDriveFolderId(partialData.assets_drive_folder_id);
    if (partialData.drive_folders && Array.isArray(partialData.drive_folders)) {
      const normalizedFolders = partialData.drive_folders.map(f => ({
        ...f,
        folderId: extractGoogleDriveFolderId(f?.folderId)
      }));
      updatePayload.drive_folders = normalizedFolders;
      const ref = normalizedFolders.find(f => f.type === 'reference');
      const ass = normalizedFolders.find(f => f.type === 'assets');
      const slp = normalizedFolders.find(f => f.type === 'slips');
      if (ref) updatePayload.reference_folder_id = ref.folderId;
      if (ass) updatePayload.assets_folder_id = ass.folderId;
      if (slp) updatePayload.slips_folder_id = slp.folderId;
    }
    if (partialData.line_bot_token !== undefined) updatePayload.line_bot_token = partialData.line_bot_token;
    if (partialData.telegram_bot_token !== undefined) updatePayload.telegram_bot_token = partialData.telegram_bot_token;
    if (partialData.telegram_chat_id !== undefined) updatePayload.telegram_chat_id = String(partialData.telegram_chat_id);
    if (Array.isArray(partialData.project_categories)) updatePayload.project_categories = partialData.project_categories;
    if (Array.isArray(partialData.expense_categories)) updatePayload.expense_categories = partialData.expense_categories;
    if (Array.isArray(partialData.deal_statuses)) updatePayload.deal_statuses = partialData.deal_statuses;
    if (Array.isArray(partialData.transport_statuses)) updatePayload.transport_statuses = partialData.transport_statuses;
    if (Array.isArray(partialData.payment_statuses)) updatePayload.payment_statuses = partialData.payment_statuses;

    let localOnlyPaymentStatuses = false;

    if (Object.keys(updatePayload).length > 0) {
      let writeRes = existing?.id
        ? await client.from('shop_settings').update(updatePayload).eq('id', existing.id)
        : await client.from('shop_settings').insert([updatePayload]);

      if (writeRes?.error && updatePayload.payment_statuses !== undefined && isMissingPaymentStatusesColumnError(writeRes.error)) {
        delete updatePayload.payment_statuses;
        localOnlyPaymentStatuses = true;
        if (Object.keys(updatePayload).length > 0) {
          writeRes = existing?.id
            ? await client.from('shop_settings').update(updatePayload).eq('id', existing.id)
            : await client.from('shop_settings').insert([updatePayload]);
          if (writeRes?.error) throw new Error(writeRes.error.message || 'ไม่สามารถบันทึกการตั้งค่าลงฐานข้อมูลได้');
        } else {
          writeRes = null;
        }
      }

      if (writeRes?.error) {
        throw new Error(writeRes.error.message || 'ไม่สามารถบันทึกการตั้งค่าลงฐานข้อมูลได้');
      }
    }

    // อัปเดตข้อมูลพนักงานใน staff_users หากมีการแก้ไขรูปหรือโปรไฟล์
    if (partialData.app_credentials && Array.isArray(partialData.app_credentials)) {
      for (const cred of partialData.app_credentials) {
        if (!cred.username) continue;
        const staffPayload = {
          full_name: cred.name || cred.username,
          phone: cred.phone || '',
          profile_image_url: sanitizeRemoteImageUrl(cred.image)
        };
        try {
          await client.from('staff_users').update(staffPayload).ilike('username', cred.username);
        } catch (e) {
          console.warn('Could not update staff user profile:', cred.username, e);
        }
      }
    }

    return {
      success: true,
      saved: true,
      ...(localOnlyPaymentStatuses ? { localOnlyPaymentStatuses: true } : {})
    };
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
    const hasUuid = Boolean(payload.id && isValidUuid(payload.id));
    if (!hasUuid) {
      delete payload.id;
    }

    const { data, error } = await client
      .from('delivery_locations')
      .upsert(payload, { onConflict: hasUuid ? 'id' : 'name' })
      .select(LOCATION_COLUMNS)
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
  if (client && isValidUuid(locationId)) {
    const { error } = await client.from('delivery_locations').delete().eq('id', locationId);
    if (error) throw error;
    try {
      await client.from('deleted_records').insert({
        record_id: locationId,
        table_name: 'delivery_locations',
        deleted_at: new Date().toISOString()
      });
    } catch (_) {}
  }
  await db.delivery_locations.delete(locationId);
  broadcastRecordDeleted('delivery_locations', locationId);
  return true;
}

// 9. คำนวณผลสรุปการเงินบน Supabase Server (Zero-Egress Server Pushdown Aggregation)
// ส่งเฉพาะผลสรุปสุดท้ายขนาด ~1.5 KB กลับมา ไม่โหลดโปรเจกต์รายบรรทัด
function normalizeServerAnalyticsResponse(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  if (!raw.totals && !raw.status_counts && !raw.low_margin) return raw;

  const t = raw.totals || {};
  const totalProjects = Number(t.total_projects ?? t.total_orders ?? t.project_count ?? 0);
  const revenue = Number(t.revenue ?? t.total_revenue ?? 0);
  const support = Number(t.support ?? t.total_customer_support ?? t.total_support ?? 0);
  const cost = Number(t.cost ?? t.total_expenses ?? 0);
  const profit = Number(t.profit ?? t.total_net_profit ?? t.net_profit ?? (revenue - cost));
  const avgOrderValue = Number(t.avg_order_value ?? (totalProjects > 0 ? Math.round(revenue / totalProjects) : 0));
  const avgSupportValue = Number(t.avg_support_value ?? (totalProjects > 0 ? Math.round(support / totalProjects) : 0));
  const netMarginNum = Number(
    t.net_margin_pct ?? t.net_margin_percent ?? (revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0)
  );

  const sc = raw.status_counts || {};
  const cancelledCount = Number(sc.cancelled ?? sc.issue ?? 0);

  return {
    ...raw,
    totals: {
      ...t,
      total_projects: totalProjects,
      total_orders: totalProjects,
      revenue,
      total_revenue: revenue,
      support,
      total_customer_support: support,
      cost,
      total_expenses: cost,
      profit,
      total_net_profit: profit,
      avg_order_value: avgOrderValue,
      avg_support_value: avgSupportValue,
      net_margin_pct: netMarginNum,
      net_margin_percent: t.net_margin_percent ?? netMarginNum.toFixed(1)
    },
    status_counts: {
      total: Number(sc.total ?? totalProjects),
      completed: Number(sc.completed ?? 0),
      active: Number(sc.active ?? 0),
      pending: Number(sc.pending ?? 0),
      cancelled: cancelledCount,
      issue: Number(sc.issue ?? cancelledCount),
      declined: Number(sc.declined ?? 0)
    },
    top_customers_by_projects: Array.isArray(raw.top_customers_by_projects) ? raw.top_customers_by_projects : [],
    low_margin: Array.isArray(raw.low_margin)
      ? raw.low_margin.map((item) => {
          const rev = Number(item.revenue ?? 0);
          const itemCost = Number(item.cost ?? 0);
          const marginVal = Number(
            item.marginPct ?? item.margin_pct ?? (rev > 0 ? (((rev - itemCost) / rev) * 100).toFixed(1) : 0)
          );
          return {
            ...item,
            revenue: rev,
            cost: itemCost,
            profit: Number(item.profit ?? (rev - itemCost)),
            marginPct: marginVal,
            margin_pct: marginVal
          };
        })
      : []
  };
}

export async function fetchServerAnalytics(filters = {}) {
  const client = getActiveClient();
  if (!client) return null;

  let p_start_date = null;
  let p_end_date = null;

  if (filters.startDate || filters.endDate) {
    if (filters.startDate) {
      const s = String(filters.startDate);
      p_start_date = s.includes('T') ? s : `${s}T00:00:00+07:00`;
    }
    if (filters.endDate) {
      const e = String(filters.endDate);
      p_end_date = e.includes('T') ? e : `${e}T23:59:59+07:00`;
    }
  } else if (filters.mode === 'all') {
    p_start_date = null;
    p_end_date = null;
  } else if (filters.mode === 'year' && filters.date) {
    const year = String(filters.date).slice(0, 4);
    p_start_date = `${year}-01-01T00:00:00+07:00`;
    p_end_date = `${year}-12-31T23:59:59+07:00`;
  } else if (filters.mode === 'month' && filters.date) {
    const bounds = getMonthDateBounds(filters.date);
    p_start_date = bounds.start ? `${bounds.start}+07:00` : null;
    p_end_date = bounds.end ? `${bounds.end}+07:00` : null;
  } else if (filters.mode === 'week' && filters.date) {
    const monday = new Date(filters.date + 'T00:00:00');
    const day = monday.getDay();
    monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1));
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    const dayString = (d) =>
      d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    p_start_date = `${dayString(monday)}T00:00:00+07:00`;
    p_end_date = `${dayString(sunday)}T23:59:59+07:00`;
  } else if (filters.mode === 'date' && filters.date) {
    p_start_date = `${filters.date}T00:00:00+07:00`;
    p_end_date = `${filters.date}T23:59:59+07:00`;
  } else if (filters.mode === 'range') {
    p_start_date = filters.range?.start ? `${filters.range.start}T00:00:00+07:00` : null;
    p_end_date = filters.range?.end ? `${filters.range.end}T23:59:59+07:00` : null;
  }

  const p_category = filters.category && filters.category !== 'all' ? filters.category : null;
  const dealVal = filters.dealStatus ?? filters.status ?? null;
  const p_deal_status = dealVal && dealVal !== 'all' ? dealVal : null;
  const transportVal = filters.transportStatus ?? filters.transport ?? null;
  const p_transport_status = transportVal && transportVal !== 'all' ? transportVal : null;
  const searchStr = typeof filters.search === 'string' ? filters.search.trim() : '';
  const p_search = searchStr !== '' ? searchStr : null;

  const rpcParams6 = {
    p_start_date,
    p_end_date,
    p_category,
    p_deal_status,
    p_transport_status,
    p_search
  };

  const rpcParams4 = {
    p_start_date,
    p_end_date,
    p_category,
    p_deal_status
  };

  const isSignatureMissing = (err) =>
    Boolean(
      err &&
        (err.code === 'PGRST202' ||
          err.code === '42883' ||
          /could not find the function|schema cache/i.test(`${err.message || ''} ${err.details || ''} ${err.hint || ''}`))
    );

  try {
    const { data, error } = await client.rpc('get_complete_analytics', rpcParams6);
    if (!error && data) return normalizeServerAnalyticsResponse(data);
    if (error && !isSignatureMissing(error)) {
      console.warn('get_complete_analytics 6-arg notice:', error);
      return null;
    }
  } catch (err) {
    console.warn('get_complete_analytics 6-arg notice, trying 4-arg fallback:', err);
  }

  // Fallback 1: Legacy 4-arg get_complete_analytics when 6-arg SQL has not been deployed yet
  try {
    const { data, error } = await client.rpc('get_complete_analytics', rpcParams4);
    if (!error && data) return normalizeServerAnalyticsResponse(data);
    if (error && !isSignatureMissing(error)) {
      console.warn('get_complete_analytics 4-arg notice:', error);
      return null;
    }
  } catch (err4) {
    console.warn('get_complete_analytics 4-arg notice, trying get_financial_analytics:', err4);
  }

  // Fallback 2: get_financial_analytics with date range pushdown
  try {
    const { data, error } = await client.rpc('get_financial_analytics', rpcParams4);
    if (!error && data) {
      return normalizeServerAnalyticsResponse({
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
          cancelled: 0,
          issue: 0,
          declined: 0
        },
        banknotes: {},
        expenses: [],
        categories: [],
        top_artists: [],
        top_customers: [],
        top_customers_by_projects: [],
        top_venues: [],
        low_margin: []
      });
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

    const { qMap, csMap, exMap } = await fetchChildItemsForProjects(client, projects);

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
    const existing = (await db.projects.get(projectId)) || null;

    // กรณีโปรเจกต์ยังไม่อยู่ใน IndexedDB (เช่น กดจาก Low Margin Radar ในหน้า Analytics โหมด Server-Side)
    // ให้ดึงคอลัมน์หลัก + คอลัมน์รายละเอียด + ตารางลูกของโปรเจกต์เดียวนี้ แล้วแปลงและแคชลง IndexedDB ทันที
    if (!existing?.id) {
      const fullColumns = [...new Set([...PROJECT_LIST_COLUMNS.split(','), ...PROJECT_DETAIL_COLUMNS.split(',')])].join(',');
      const { data: projData, error: projErr } = await client
        .from('projects')
        .select(fullColumns)
        .eq('id', projectId)
        .maybeSingle();

      if (projErr) throw projErr;
      if (!projData) return null;

      const childData = await fetchChildItemsForProjects(client, [projData]);
      const fullProject = transformSupabaseProjectToUi(projData, {
        quotationItems: childData.qMap.get(projData.id) || [],
        customerSupport: childData.csMap.get(projData.id) || [],
        expenses: childData.exMap.get(projData.id) || []
      });
      await db.projects.put(fullProject);
      return fullProject;
    }

    let [detailRes, qRes, csRes, exRes] = await Promise.all([
      client.from('projects').select(PROJECT_DETAIL_COLUMNS).eq('id', projectId).maybeSingle(),
      client.from('project_quotation_items').select(QUOTATION_COLUMNS).eq('project_id', projectId),
      client.from('project_customer_support').select(SUPPORT_COLUMNS).eq('project_id', projectId),
      client.from('project_expenses').select(EXPENSE_COLUMNS).eq('project_id', projectId)
    ]);

    if (isMissingIsVoidedColumnError(qRes.error) || isMissingIsVoidedColumnError(exRes.error)) {
      const [qFallback, exFallback] = await Promise.all([
        isMissingIsVoidedColumnError(qRes.error)
          ? client.from('project_quotation_items').select(QUOTATION_LEGACY_COLUMNS).eq('project_id', projectId)
          : Promise.resolve(qRes),
        isMissingIsVoidedColumnError(exRes.error)
          ? client.from('project_expenses').select(EXPENSE_LEGACY_COLUMNS).eq('project_id', projectId)
          : Promise.resolve(exRes)
      ]);
      qRes = qFallback;
      exRes = exFallback;
    }

    const data = detailRes.data || {};
    const hasDetailRow = !detailRes.error && Boolean(detailRes.data);

    const qItems = (qRes.data || []).map(q => ({
      id: q.id,
      category: q.category || '',
      detail: q.detail || '',
      quantity: Number(q.quantity) || 1,
      unitPrice: Number(q.unit_price) || 0,
      price: Number(q.price) || 0,
      date: q.item_date || '',
      is_voided: Boolean(q.is_voided)
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
      date: ex.item_date || '',
      is_voided: Boolean(ex.is_voided)
    }));

    const nextImages = !detailRes.error && Array.isArray(data.images)
      ? data.images
      : (existing?.images || []);
    const nextSlips = !detailRes.error && Array.isArray(data.slips)
      ? data.slips
      : (existing?.slips || []);
    const nextImage = hasDetailRow && (data.primary_image_url !== undefined || Array.isArray(data.images))
      ? (data.primary_image_url || nextImages[0] || null)
      : (existing?.image || nextImages[0] || null);

    const resolveCustomerField = (remoteVal, existingVal) => {
      if (!hasDetailRow || remoteVal === undefined) return existingVal ?? '';
      return remoteVal ?? '';
    };

    const merged = {
      ...existing,
      image: nextImage,
      images: nextImages,
      slips: nextSlips,
      customerInfo: {
        ...(existing?.customerInfo || {}),
        phone: resolveCustomerField(data.customer_phone, existing?.customerInfo?.phone),
        address: resolveCustomerField(data.customer_address, existing?.customerInfo?.address),
        email: resolveCustomerField(data.customer_email, existing?.customerInfo?.email),
        line: resolveCustomerField(data.customer_line, existing?.customerInfo?.line),
        social: resolveCustomerField(data.customer_social, existing?.customerInfo?.social),
        taxId: resolveCustomerField(data.customer_tax_id, existing?.customerInfo?.taxId)
      },
      quotationItems: !qRes.error ? qItems : (existing?.quotationItems || []),
      customerSupport: !csRes.error ? csItems : (existing?.customerSupport || []),
      expenses: !exRes.error ? exItems : (existing?.expenses || []),
      ...(hasDetailRow && data.updated_at ? { updated_at: data.updated_at } : {})
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
      .select('id, name, customer_name, artist_name, delivery_date_display')
      .order('id', { ascending: false })
      .limit(30);

    if (error) throw error;
    return (data || []).map(p => ({
      id: p.id,
      name: p.name || '',
      customer: p.customer_name || '',
      artist: p.artist_name || '',
      deliveryDate: p.delivery_date_display || ''
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
  if (client && isValidUuid(customerId)) {
    const { error } = await client.from('customers').delete().eq('id', customerId);
    if (error) throw error;
    try {
      await client.from('deleted_records').insert({
        record_id: customerId,
        table_name: 'customers',
        deleted_at: new Date().toISOString()
      });
    } catch (_) {}
  }
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

// Purged legacy mockup catalog items — strictly load real rows from Supabase only
export const DEFAULT_INVENTORY_ITEMS_SPEC = [];
export const DEFAULT_ASSET_UNITS = [];

// 13. คลังพัสดุและสต๊อก (Inventory Items) - Local-First + Zero-Egress Sync
export async function loadInventoryLocalFirst(onUpdate) {
  try {
    // Purge any legacy banknote rows from IndexedDB (banknotes must remain memory-only)
    try {
      await db.inventory_items.filter((it) => String(it.item_type || '').toLowerCase() === 'banknote').delete();
    } catch {}

    let cached = await db.inventory_items.toArray();
    cached = cached.filter((it) => String(it.item_type || '').toLowerCase() !== 'banknote');

    if (cached.length > 0 && onUpdate) {
      onUpdate(cached);
    }

    try {
      const {loadWarehouseStock} = await import('./warehouseService.js');
      const page = await loadWarehouseStock();
      if (page) {
        const rows = page.items || [];
        if (!page.has_more) {
          await db.inventory_items.clear();
          if (rows.length) await db.inventory_items.bulkPut(rows);
        } else if (rows.length) {
          await db.inventory_items.bulkPut(rows);
        }
        onUpdate?.(rows);
        return rows;
      }
    } catch { /* Read-only cached catalog remains available offline. */ }

    return cached;
  } catch (err) {
    console.warn('Load inventory notice:', err);
    return [];
  }
}

export async function saveInventoryItemSync(itemData) {
  const validated = validatePayload(inventoryItemPayloadSchema, itemData, 'InventoryItem');
  const client = getActiveClient();
  try {
    const payload = {
      name: validated.name,
      category_id: validated.category_id || null,
      item_type: validated.item_type || 'consumable',
      unit: validated.unit || 'ชิ้น',
      current_stock: Number(validated.current_stock) || 0,
      min_alert_threshold: validated.min_alert_threshold !== undefined ? Number(validated.min_alert_threshold) : 5,
      average_cost: Number(validated.average_cost) || 0,
      storage_location: validated.storage_location || '',
      color: validated.color || '',
      size: validated.size || '',
      status: validated.status || 'in_service',
      is_active: validated.is_active !== undefined ? validated.is_active : true
    };

    if (validated.id && isValidUuid(validated.id)) {
      payload.id = validated.id;
      // Do not overwrite current_stock on metadata update from form
      delete payload.current_stock;
    } else if (validated.id) {
      payload.id = validated.id;
      delete payload.current_stock;
    } else {
      payload.id = generateRandomUuid();
    }

    if (validated.code) {
      payload.code = validated.code;
    }

    const { data, error } = await client
      .from('inventory_items')
      .upsert(payload)
      .select(INVENTORY_COLUMNS)
      .single();

    if (error) throw error;
    if (data) {
      await db.inventory_items.put(data);
      return data;
    }
    throw new Error('No data returned from inventory item upsert');
  } catch (err) {
    console.error('Error saving inventory item:', err);
    throw err;
  }
}

export async function deleteInventoryItemSync(itemId) {
  const client = getActiveClient();
  try {
    const { error } = await client.from('inventory_items').update({ is_active: false }).eq('id', itemId);
    if (error) throw error;
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
    if (cached.length > 0 && onUpdate) {
      onUpdate(cached);
    }

    const client = getActiveClient();
    try {
      const { data: cloudUnits, error } = await client
        .from('asset_units')
        .select(ASSET_UNIT_COLUMNS)
        .order('unit_code');

      if (!error && Array.isArray(cloudUnits)) {
        await db.asset_units.clear();
        if (cloudUnits.length > 0) {
          await db.asset_units.bulkPut(cloudUnits);
        }
        if (onUpdate) onUpdate(cloudUnits);
        return cloudUnits;
      }
    } catch (cErr) {}

    return cached;
  } catch (err) {
    console.warn('Load asset units notice:', err);
    return [];
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

    const { data, error } = await client
      .from('asset_units')
      .upsert(payload)
      .select(ASSET_UNIT_COLUMNS)
      .single();

    if (error) throw error;
    if (data) {
      await db.asset_units.put(data);
      return data;
    }
    throw new Error('No data returned from asset unit upsert');
  } catch (err) {
    console.error('Error saving asset unit:', err);
    throw err;
  }
}

export async function deleteAssetUnitSync(unitCode) {
  const client = getActiveClient();
  try {
    const { error } = await client.from('asset_units').delete().eq('unit_code', unitCode);
    if (error) throw error;
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
    if (client) {
      try {
        const { data, error } = await client.rpc('warehouse_get_checklists', {
          p_filters: {
            project_id: projectId || null,
            limit: 20,
            offset: 0
          }
        });

        if (!error && data && Array.isArray(data.checklists)) {
          const mapped = data.checklists.map((c) => ({
            id: c.id,
            document_id: c.document_id,
            project_id: c.project_id,
            item_id: c.item_id || null,
            item_name: c.name || '',
            category_name: '',
            required_qty: Number(c.quantity) || 1,
            unit: c.unit || 'ชิ้น',
            picked_qty: 0,
            returned_qty: 0,
            damaged_qty: 0,
            unit_cost: 0,
            assigned_codes: [],
            is_checked: false,
            notes: c.notes || '',
            item_code: c.item_code || '',
            created_at: c.created_at || new Date().toISOString()
          }));

          if (mapped.length > 0) {
            await db.project_checklist_items.bulkPut(mapped);
          }
          if (onUpdate) onUpdate(mapped);
          return mapped;
        }
      } catch (cErr) {
        console.warn('warehouse_get_checklists notice:', cErr);
      }
    }

    return cached;
  } catch (err) {
    console.warn('Load project checklist notice:', err);
    return [];
  }
}

export async function saveProjectChecklistItemSync(itemData) {
  const client = getActiveClient();
  if (!client) {
    throw new Error('Supabase client unavailable. Checklist save requires confirmed server connectivity.');
  }

  const payload = {
    project_id: itemData.project_id,
    notes: itemData.notes || '',
    items: [
      {
        item_id: itemData.item_id || null,
        name: itemData.item_name || itemData.name,
        quantity: Number(itemData.required_qty) || 1,
        unit: itemData.unit || 'ชิ้น',
        notes: itemData.notes || ''
      }
    ]
  };

  const idempotencyKey = itemData.idempotencyKey || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : null);

  const { data, error } = await client.rpc('warehouse_dispatch', {
    p_action: 'legacy_checklist_save',
    p_payload: payload,
    p_idempotency_key: idempotencyKey
  });

  if (error) {
    console.error('Error saving checklist item via warehouse_dispatch:', error);
    throw new Error(error.message || 'Failed to save checklist item');
  }

  if (!data?.success || !data?.data?.document_id) throw new Error(data?.message || 'Checklist save was not confirmed');
  const docId = data.data.document_id;
  const savedRecord = {
    id: docId,
    project_id: itemData.project_id,
    item_id: itemData.item_id || null,
    item_name: itemData.item_name || itemData.name,
    category_name: itemData.category_name || '',
    required_qty: Number(itemData.required_qty) || 1,
    unit: itemData.unit || 'ชิ้น',
    picked_qty: Number(itemData.picked_qty) || 0,
    returned_qty: Number(itemData.returned_qty) || 0,
    damaged_qty: Number(itemData.damaged_qty) || 0,
    unit_cost: Number(itemData.unit_cost) || 0,
    assigned_codes: Array.isArray(itemData.assigned_codes) ? itemData.assigned_codes : [],
    is_checked: Boolean(itemData.is_checked),
    notes: itemData.notes || '',
    created_at: new Date().toISOString()
  };

  try {
    await db.project_checklist_items.put(savedRecord);
  } catch {}

  return savedRecord;
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

    await db.project_checklist_items.put(updated);
    return updated;
  } catch (err) {
    console.error('Error toggling checklist item:', err);
    throw err;
  }
}

export async function deleteProjectChecklistItemSync(itemId) {
  try {
    await db.project_checklist_items.delete(itemId);
    return true;
  } catch (err) {
    console.error('Error deleting checklist item:', err);
    throw err;
  }
}

export async function borrowAssetUnitsSync() {
  throw new Error('Deprecated: asset_loans and direct loan updates have been retired. Use warehouseService.borrowTools or createIssue.');
}

export async function returnAssetUnitsSync() {
  throw new Error('Deprecated: asset_loans and direct loan updates have been retired. Use warehouseService.returnTools.');
}

export async function reconcileProjectItemSync() {
  throw new Error('Deprecated: direct reconciliation on retired tables has been superseded by warehouse operations.');
}

// 14. ทะเบียนยืม-คืนอุปกรณ์ (Asset Loans) - Read-Only Local Cache
export async function loadAssetLoansLocalFirst(onUpdate) {
  try {
    const cached = await db.asset_loans.toArray().catch(() => []);
    if (cached.length > 0 && onUpdate) {
      onUpdate(cached);
    }
    return cached;
  } catch (err) {
    console.warn('Load asset loans notice:', err);
    return [];
  }
}

export async function saveAssetLoanSync() {
  throw new Error('Deprecated: asset_loans table has been retired. Use warehouseService custody commands.');
}

export async function returnAssetLoanSync() {
  throw new Error('Deprecated: use warehouseService.returnTools for confirmed custody returns.');
}

// 15. ราคากลางวัสดุ ตร.ม. (Material Rates) - Local-First + Zero-Egress Sync
export async function loadMaterialRatesLocalFirst(onUpdate) {
  try {
    const rawCached = await db.material_rates.toArray();
    const legacyMatRows = rawCached.filter((r) => !r?.id || String(r.id).startsWith('mat-'));
    if (legacyMatRows.length > 0) {
      for (const leg of legacyMatRows) {
        if (leg?.id) await db.material_rates.delete(leg.id).catch(() => {});
      }
    }

    let cached = rawCached.filter((r) => r?.id && !String(r.id).startsWith('mat-'));
    const hadValidCached = cached.length > 0;
    const initMeta = await db.sync_meta?.get?.('material_rates_initialized').catch(() => null);
    const wasInitialized = Boolean(initMeta?.value || rawCached.length > 0);

    if (hadValidCached && onUpdate) {
      onUpdate(cached);
    }

    const client = getActiveClient();
    if (!client) {
      if (!hadValidCached && !wasInitialized) {
        await db.material_rates.bulkPut(DEFAULT_MATERIAL_RATES);
        await db.sync_meta?.put?.({ key: 'material_rates_initialized', value: true }).catch(() => {});
        if (onUpdate) onUpdate(DEFAULT_MATERIAL_RATES);
        return DEFAULT_MATERIAL_RATES;
      }
      if (!hadValidCached && onUpdate) onUpdate([]);
      return cached;
    }

    const { data: cloudRates, error } = await client
      .from('material_rates')
      .select(MATERIAL_RATE_COLUMNS)
      .order('name');

    if (!error && Array.isArray(cloudRates)) {
      await db.material_rates.clear();
      if (cloudRates.length > 0) {
        await db.material_rates.bulkPut(cloudRates);
        await db.sync_meta?.put?.({ key: 'material_rates_initialized', value: true }).catch(() => {});
        if (onUpdate) onUpdate(cloudRates);
        return cloudRates;
      }

      if (!wasInitialized) {
        await db.material_rates.bulkPut(DEFAULT_MATERIAL_RATES);
        await db.sync_meta?.put?.({ key: 'material_rates_initialized', value: true }).catch(() => {});
        if (onUpdate) onUpdate(DEFAULT_MATERIAL_RATES);
        return DEFAULT_MATERIAL_RATES;
      }

      if (onUpdate) onUpdate([]);
      return [];
    }

    if (!hadValidCached && !wasInitialized) {
      await db.material_rates.bulkPut(DEFAULT_MATERIAL_RATES);
      await db.sync_meta?.put?.({ key: 'material_rates_initialized', value: true }).catch(() => {});
      if (onUpdate) onUpdate(DEFAULT_MATERIAL_RATES);
      return DEFAULT_MATERIAL_RATES;
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
    const rawId = rateData?.id ? String(rateData.id) : '';
    const oldTempId = rawId && !isValidUuid(rawId) ? rawId : null;
    const resolvedId = rawId && isValidUuid(rawId) ? rawId : generateRandomUuid();

    const payload = {
      id: resolvedId,
      name: String(rateData?.name || '').trim(),
      default_price_sqm: Number(rateData?.default_price_sqm) || 0,
      is_active: rateData?.is_active !== undefined ? Boolean(rateData.is_active) : true,
      updated_at: new Date().toISOString()
    };

    if (client) {
      const { data, error } = await client
        .from('material_rates')
        .upsert(payload, { onConflict: 'id' })
        .select(MATERIAL_RATE_COLUMNS)
        .single();
      if (error) throw error;
      const saved = data || payload;
      if (oldTempId && oldTempId !== saved.id) {
        await db.material_rates.delete(oldTempId).catch(() => {});
      }
      await db.material_rates.put(saved);
      return saved;
    }

    if (oldTempId && oldTempId !== payload.id) {
      await db.material_rates.delete(oldTempId).catch(() => {});
    }
    await db.material_rates.put(payload);
    return payload;
  } catch (err) {
    console.error('Error saving material rate:', err);
    throw err;
  }
}

export async function deleteMaterialRateSync(rateId) {
  const client = getActiveClient();
  if (client && isValidUuid(rateId)) {
    const { error } = await client.from('material_rates').delete().eq('id', rateId);
    if (error) throw error;
    try {
      await client.from('deleted_records').insert({
        record_id: rateId,
        table_name: 'material_rates',
        deleted_at: new Date().toISOString()
      });
    } catch (_) {}
  }
  await db.material_rates.delete(rateId);
  broadcastRecordDeleted('material_rates', rateId);
  return true;
}

// 16. เอกสารใบเสนอราคา (Quotations) - Local-First + Zero-Egress Sync
export async function loadQuotationsLocalFirst(onUpdate) {
  try {
    const cached = await db.quotations.toArray();
    if (onUpdate) {
      onUpdate(cached);
    }

    const client = getActiveClient();
    if (!client) {
      return cached;
    }

    const { data: cloudQuotes, error } = await client
      .from('quotations')
      .select(QUOTATION_DOC_COLUMNS)
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(cloudQuotes)) {
      await db.quotations.clear();
      if (cloudQuotes.length > 0) {
        await db.quotations.bulkPut(cloudQuotes);
      }
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
    const oldTempId = validated.id && !isValidUuid(validated.id) ? validated.id : null;
    const resolvedId = validated.id && isValidUuid(validated.id) ? validated.id : generateRandomUuid();

    const payload = {
      id: resolvedId,
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
    if (!validated.id || oldTempId) {
      payload.created_at = validated.created_at || new Date().toISOString();
    }

    if (client) {
      const { data, error } = await client
        .from('quotations')
        .upsert(payload, { onConflict: 'id' })
        .select(QUOTATION_DOC_COLUMNS)
        .single();
      if (error) throw error;
      const saved = data || payload;
      if (oldTempId && oldTempId !== saved.id) {
        await db.quotations.delete(oldTempId).catch(() => {});
      }
      await db.quotations.put(saved);
      return saved;
    }

    if (oldTempId && oldTempId !== payload.id) {
      await db.quotations.delete(oldTempId).catch(() => {});
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
    if (client && isValidUuid(quoteId)) {
      const { error } = await client.from('quotations').delete().eq('id', quoteId);
      if (error) throw error;
      try {
        await client.from('deleted_records').insert({
          record_id: quoteId,
          table_name: 'quotations',
          deleted_at: new Date().toISOString()
        });
      } catch (_) {}
    }
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

// 17.1 สถิติรวมศิลปินและลูกค้าแบบ All-Time (Server Aggregated Summary Stats + 5-min In-Memory TTL Cache)
export async function loadArtistsAndCustomersSummaryStats(onUpdate, options = {}) {
  try {
    const now = Date.now();
    if (!options?.force && summaryStatsMemCache.data && now - summaryStatsMemCache.fetchedAt < SUMMARY_STATS_TTL_MS) {
      if (onUpdate) onUpdate(summaryStatsMemCache.data);
      return summaryStatsMemCache.data;
    }

    // 1. ส่งข้อมูลแคชจาก IndexedDB ทันที (Local-First 0ms)
    const cachedMeta = await db.sync_meta?.get?.('artists_customers_summary_stats').catch(() => null);
    if (cachedMeta && cachedMeta.value && onUpdate) {
      onUpdate(cachedMeta.value);
    }

    // 2. ดึงข้อมูลสรุปแบบ Zero-Egress Server RPC (150ms / ~2 KB)
    const client = getActiveClient();
    if (!client) {
      return cachedMeta?.value || { artistStats: {}, customerStats: {} };
    }

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
        summaryStatsMemCache = { data: result, fetchedAt: Date.now() };
        await db.sync_meta?.put?.({ key: 'artists_customers_summary_stats', value: result, updated_at: Date.now() }).catch(() => {});
        if (onUpdate) onUpdate(result);
        return result;
      }
    } catch (rpcErr) {
      console.warn('RPC summary stats fallback to projection:', rpcErr);
    }

    // Fallback: ดึงข้อมูลสรุปแบบ Zero-Egress Projection จาก Supabase (จำกัดสูงสุด 500 รายการล่าสุด)
    const { data, error } = await client
      .from('projects')
      .select('artist_name, customer_name, wage, customer_support_total, delivery_fee, raw_delivery_start, project_datetime')
      .order('raw_delivery_start', { ascending: false })
      .limit(500);

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
      summaryStatsMemCache = { data: result, fetchedAt: Date.now() };
      await db.sync_meta?.put?.({ key: 'artists_customers_summary_stats', value: result, updated_at: Date.now() }).catch(() => {});
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
    const oldTempId = validated.id && !isValidUuid(validated.id) ? validated.id : null;
    const resolvedId = validated.id && isValidUuid(validated.id) ? validated.id : generateRandomUuid();

    const payload = {
      id: resolvedId,
      name: validated.name,
      agency: validated.agency || '',
      fandom_name: validated.fandom_name || '',
      fandom_color: validated.fandom_color || '',
      birth_date: validated.birth_date || null,
      debut_date: validated.debut_date || null,
      bio: validated.bio || '',
      social_links: validated.social_links || {},
      favorite_flowers: validated.favorite_flowers || '',
      avatar_url: sanitizeRemoteImageUrl(validated.avatar_url),
      notes: validated.notes || ''
    };
    if (!validated.id || oldTempId) {
      payload.created_at = new Date().toISOString();
    }

    if (client) {
      const { data, error } = await client
        .from('artists')
        .upsert(payload, { onConflict: 'id' })
        .select(ARTIST_COLUMNS)
        .single();
      if (error) throw error;
      const saved = data || payload;
      if (oldTempId && oldTempId !== saved.id) {
        await db.artists.delete(oldTempId).catch(() => {});
      }
      await db.artists.put(saved);
      return saved;
    }

    if (oldTempId && oldTempId !== payload.id) {
      await db.artists.delete(oldTempId).catch(() => {});
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
    if (client && isValidUuid(artistId)) {
      const { error } = await client.from('artists').delete().eq('id', artistId);
      if (error) throw error;
      try {
        await client.from('deleted_records').insert({
          record_id: artistId,
          table_name: 'artists',
          deleted_at: new Date().toISOString()
        });
      } catch (_) {}
    }
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

function generateSecureHex(byteLength = 24) {
  const bytes = new Uint8Array(byteLength);
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteLength; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashResetTokenSha256(value) {
  const text = String(value || '');
  if (
    typeof globalThis !== 'undefined' &&
    globalThis.crypto?.subtle &&
    typeof globalThis.TextEncoder !== 'undefined'
  ) {
    const encoded = new globalThis.TextEncoder().encode(text);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Deterministic non-reversible fallback only when WebCrypto is unavailable in a bare VM sandbox
  let h1 = 0xdeadbeef ^ text.length;
  let h2 = 0x41c6ce57 ^ text.length;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

function stripStaffPassword(staffRow) {
  if (!staffRow || typeof staffRow !== 'object') return staffRow;
  const { password: _omitPassword, ...cleanRow } = staffRow;
  return cleanRow;
}

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

    const validCached = cached
      .filter(s => s && s.id && !String(s.id).startsWith('staff-'))
      .map(stripStaffPassword);
    if (validCached.length === 0) {
      await db.staff.bulkPut(DEFAULT_STAFF_MEMBERS);
      if (onUpdate) onUpdate(DEFAULT_STAFF_MEMBERS);
    } else if (onUpdate) {
      onUpdate(validCached);
    }

    const client = getActiveClient();
    let { data: cloudStaff, error } = await client
      .from('staff_users')
      .select(STAFF_COLUMNS);

    if (error && isMissingStaffBanColumnError(error)) {
      const fallbackRes = await client
        .from('staff_users')
        .select(STAFF_LEGACY_COLUMNS);
      cloudStaff = fallbackRes.data;
      error = fallbackRes.error;
    }

    if (!error && Array.isArray(cloudStaff) && cloudStaff.length > 0) {
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
            avatar_url: sanitizeRemoteImageUrl(u.profile_image_url),
            is_active: u.is_active !== undefined ? u.is_active : true,
            banned_until: u.banned_until || null,
            is_banned_permanent: Boolean(u.is_banned_permanent),
            ban_reason: u.ban_reason || '',
            created_at: u.created_at || ''
          };
        });

      // Clear local staff table so any stale mock entries or leaked passwords are permanently removed
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
  const rawInputPassword = typeof staffData?.password === 'string' ? staffData.password.trim() : '';
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

    // Determine whether this staff record already exists (UPDATE vs INSERT)
    let existingLocal = null;
    try {
      existingLocal = (await db.staff?.get?.(staffId)) || null;
    } catch (_) {}

    let isUpdate = Boolean(existingLocal);
    if (staffData?.isNew === true) {
      isUpdate = false;
    } else if (staffData?.isUpdate === true) {
      isUpdate = true;
    } else if (!isUpdate && client && (staffData?.id || staffData?.staff_code)) {
      try {
        const { data: existingRemote } = await client
          .from('staff_users')
          .select('id')
          .eq('id', staffId)
          .maybeSingle();
        if (existingRemote?.id) {
          isUpdate = true;
        }
      } catch (_) {}
    }

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

    // Never persist plaintext password into local db.staff or returned UI payload
    const cleanStaffAvatar = sanitizeRemoteImageUrl(validated.avatar_url || validated.image || '');
    const payload = {
      ...(existingLocal ? stripStaffPassword(existingLocal) : {}),
      id: staffId,
      username: validated.username,
      staff_code: staffId,
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
      avatar_url: cleanStaffAvatar,
      is_active: validated.is_active !== undefined ? validated.is_active : true,
      updated_at: new Date().toISOString()
    };
    delete payload.password;

    // Try cloud upsert to Supabase
    try {
      if (client) {
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
          profile_image_url: cleanStaffAvatar || null,
          is_active: payload.is_active
        };

        if (rawInputPassword.length > 0) {
          supaPayload.password = rawInputPassword;
        } else if (!isUpdate) {
          // Strong locked placeholder secret on INSERT so nobody can log in with default '1' before using reset link
          supaPayload.password = `unset_${generateSecureHex(24)}`;
        }

        const { error: upsertErr } = await client.from('staff_users').upsert(supaPayload);
        if (upsertErr && 'password' in supaPayload) {
          const errMsg = `${upsertErr.message || ''} ${upsertErr.details || ''} ${upsertErr.hint || ''}`.toLowerCase();
          if (
            (upsertErr.code === '42703' || upsertErr.code === 'PGRST204') &&
            errMsg.includes('password')
          ) {
            const { password: _dropPassword, ...fallbackSupaPayload } = supaPayload;
            await client.from('staff_users').upsert(fallbackSupaPayload);
          }
        }

        // If password was explicitly changed and signed-in Supabase Auth user matches, update Auth password too
        if (rawInputPassword.length > 0 && client.auth) {
          try {
            const sessionRes = await client.auth.getSession?.();
            const authUser = sessionRes?.data?.session?.user;
            if (authUser && typeof client.auth.updateUser === 'function') {
              const authEmail = String(authUser.email || '').trim().toLowerCase();
              const cleanUsername = String(payload.username || '').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || 'staff';
              const internalEmail = `${cleanUsername}@flower2u.internal`;
              const targetEmail = String(payload.email || '').trim().toLowerCase();
              const metaUser = String(authUser.user_metadata?.username || '').trim().toLowerCase();
              if (
                (targetEmail && authEmail === targetEmail) ||
                authEmail === internalEmail ||
                (metaUser && metaUser === String(payload.username || '').trim().toLowerCase())
              ) {
                const paddedPass = rawInputPassword.length < 6 ? rawInputPassword.padEnd(6, '0') : rawInputPassword;
                await client.auth.updateUser({ password: paddedPass });
              }
            }
          } catch (_) {}
        }

        // 🛡️ Auto-register to Supabase Auth when creating new staff or setting password
        if (!isUpdate || rawInputPassword.length > 0) {
          try {
            const authRes = await syncStaffToSupabaseAuth({
              ...payload,
              password: supaPayload.password
            });
            if (authRes?.user?.id) {
              payload.auth_user_id = authRes.user.id;
            }
          } catch (authErr) {
            console.warn('Background Supabase Auth auto-sync notice:', authErr);
          }
        }
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
 * ใช้ Ephemeral Supabase Client แยกอิสระเพื่อป้องกัน signUp() เขียนทับ Session ของ Admin ที่ล็อกอินอยู่
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

    // Supabase Auth requires minimum 6 characters for password (never default to predictable '123456')
    const rawPass = String(staffData.password || '').trim() || `unset_${generateSecureHex(24)}`;
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

    // 1. Primary path: Server-side Admin SECURITY DEFINER RPC (bypasses Confirm Email & SMTP rate limits)
    const staffId = String(staffData.id || staffData.staff_code || '').trim();
    if (staffId && typeof client.rpc === 'function') {
      try {
        const rpcPayload = { p_staff_id: staffId };
        if (staffData.password && String(staffData.password).trim()) {
          rpcPayload.p_password = String(staffData.password).trim();
        }
        const { data: rpcData, error: rpcErr } = await client.rpc('provision_staff_auth_user', rpcPayload);
        if (!rpcErr && rpcData?.success) {
          return {
            success: true,
            alreadyExists: Boolean(rpcData.already_exists),
            email: rpcData.email || email,
            user: rpcData.auth_user_id ? { id: rpcData.auth_user_id, email: rpcData.email || email } : undefined
          };
        }
        if (rpcErr && rpcErr.code !== 'PGRST202' && !String(rpcErr.message || '').includes('provision_staff_auth_user')) {
          console.warn(`provision_staff_auth_user notice for ${email}:`, rpcErr.message);
        }
      } catch (rpcCatchErr) {
        console.warn('provision_staff_auth_user fallback notice:', rpcCatchErr?.message || rpcCatchErr);
      }
    }

    // 2. Fallback path: Ephemeral signUp client (when RPC is not yet installed)
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl =
      client.supabaseUrl ||
      import.meta?.env?.VITE_SUPABASE_URL ||
      '';
    const supabaseKey =
      client.supabaseKey ||
      import.meta?.env?.VITE_SUPABASE_ANON_KEY ||
      '';

    const ephemeralClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'nexus_ephemeral_signup'
      }
    });

    const { data, error } = await ephemeralClient.auth.signUp({
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
      const bc = getStaffKickBroadcastChannel();
      if (bc) {
        bc.postMessage({
          type: 'FORCE_KICK_BANNED',
          staffId,
          username,
          bannedUntil,
          isPermanent: !!isPermanent,
          reason: reason || 'คำสั่งจากผู้ดูแลระบบ'
        });
      }
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
      const bc = getStaffKickBroadcastChannel();
      if (bc) {
        bc.postMessage({
          type: 'STAFF_UNBANNED',
          staffId,
          username
        });
      }
    } catch (e) {}

    return { success: true };
  } catch (err) {
    console.error('Error unbanning staff:', err);
    throw err;
  }
}

let staffKickBroadcastChannel = null;
function getStaffKickBroadcastChannel() {
  if (staffKickBroadcastChannel) return staffKickBroadcastChannel;
  if (typeof BroadcastChannel === 'undefined') return null;
  try {
    staffKickBroadcastChannel = new BroadcastChannel('flower2u_staff_kick');
    return staffKickBroadcastChannel;
  } catch (_) {
    return null;
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
      { event: '*', schema: 'public', table: 'staff_users' },
      async (payload) => {
        try {
          const eventType = payload.eventType;
          const cleanNew = payload.new ? stripStaffPassword(payload.new) : null;
          const cleanOld = payload.old ? stripStaffPassword(payload.old) : null;

          if (eventType === 'DELETE') {
            const deletedId = cleanOld?.id || cleanOld?.staff_code;
            if (deletedId) {
              await db.staff?.delete?.(deletedId).catch(() => {});
            }
          } else if ((eventType === 'INSERT' || eventType === 'UPDATE') && cleanNew) {
            const staffId = cleanNew.id || cleanNew.staff_code;
            if (staffId && db.staff?.put) {
              const prev = (await db.staff?.get?.(staffId).catch(() => null)) || {};
              const mergedStaff = {
                ...stripStaffPassword(prev),
                id: staffId,
                username: cleanNew.username ?? prev.username ?? '',
                staff_code: staffId,
                name: cleanNew.full_name || cleanNew.name || prev.name || cleanNew.nickname || cleanNew.username || '',
                nickname: cleanNew.nickname ?? prev.nickname ?? '',
                email: cleanNew.email ?? prev.email ?? '',
                phone: cleanNew.phone ?? prev.phone ?? '',
                citizen_id: cleanNew.citizen_id ?? prev.citizen_id ?? '',
                birth_date: cleanNew.birth_date ?? prev.birth_date ?? '',
                address: cleanNew.address ?? prev.address ?? '',
                emergency_contact: cleanNew.emergency_contact ?? prev.emergency_contact ?? '',
                avatar_url: sanitizeRemoteImageUrl(cleanNew.profile_image_url ?? cleanNew.avatar_url ?? prev.avatar_url ?? ''),
                is_active: cleanNew.is_active !== undefined ? cleanNew.is_active : (prev.is_active ?? true),
                banned_until: cleanNew.banned_until !== undefined ? cleanNew.banned_until : (prev.banned_until ?? null),
                is_banned_permanent: cleanNew.is_banned_permanent !== undefined ? Boolean(cleanNew.is_banned_permanent) : Boolean(prev.is_banned_permanent),
                ban_reason: cleanNew.ban_reason !== undefined ? (cleanNew.ban_reason || '') : (prev.ban_reason || '')
              };
              await db.staff.put(mergedStaff).catch(() => {});
            }
          }

          if (onStaffUpdate && (cleanNew || cleanOld)) {
            onStaffUpdate(cleanNew || cleanOld, eventType, cleanOld);
          }
        } catch (err) {
          console.warn('Staff realtime update notice:', err);
        }
      }
    )
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}

/**
 * 18.4 Zero-Knowledge One-Time Password Reset System (Server RPC + Local Fallback)
 */
const STAFF_RESET_STORAGE_KEY = 'nexus_staff_reset_tokens_v1';
const ADMIN_ONLY_RESET_MESSAGE = 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถสร้างลิงก์เปลี่ยนรหัสผ่านได้';
let memoryResetTokensFallback = [];

function isResetRpcUnavailableError(error) {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toLowerCase();
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    msg.includes('could not find the function') ||
    msg.includes('schema cache') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('offline')
  );
}

function isResetForbiddenError(error, data) {
  const dataCode = String(data?.error || data?.reason || '').toUpperCase();
  if (dataCode === 'FORBIDDEN') return true;
  if (!error) return false;
  const code = String(error.code || '').toUpperCase();
  const msg = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
  const upper = msg.toUpperCase();
  return (
    code === 'FORBIDDEN' ||
    upper.includes('FORBIDDEN') ||
    msg.includes('ไม่มีสิทธิ์')
  );
}

function isResetUnauthorizedError(error, data) {
  const dataCode = String(data?.error || data?.reason || '').toUpperCase();
  if (dataCode === 'UNAUTHORIZED') return true;
  if (!error) return false;
  const code = String(error.code || '').toUpperCase();
  const upper = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`.toUpperCase();
  return (
    code === '42501' ||
    code === 'UNAUTHORIZED' ||
    upper.includes('UNAUTHORIZED') ||
    upper.includes('PERMISSION DENIED')
  );
}

function readLocalCallerProfile() {
  try {
    const raw =
      (typeof globalThis !== 'undefined' && globalThis.localStorage?.getItem?.('nexus_profile')) ||
      (typeof globalThis !== 'undefined' && globalThis.sessionStorage?.getItem?.('nexus_profile')) ||
      null;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}

function isLocalProfileAdmin(profile) {
  if (!profile || typeof profile !== 'object') return false;
  const role = String(profile.role || '').trim().toLowerCase();
  if (role === 'admin' || role === 'owner') return true;
  if (Array.isArray(profile.allowedPages) && profile.allowedPages.includes('Staff')) {
    return true;
  }
  return false;
}

function isStaffRecordSuspended(staff) {
  if (!staff || typeof staff !== 'object') return false;
  if (staff.is_active === false) return true;
  if (staff.is_banned_permanent === true) return true;
  if (staff.banned_until) {
    const untilMs = new Date(staff.banned_until).getTime();
    if (Number.isFinite(untilMs) && untilMs > Date.now()) return true;
  }
  return false;
}

function readLocalResetTokens() {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      const raw = globalThis.localStorage.getItem(STAFF_RESET_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (_) {
    return [];
  }
  return [...memoryResetTokensFallback];
}

function writeLocalResetTokens(entries) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  memoryResetTokensFallback = safeEntries;
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      globalThis.localStorage.setItem(STAFF_RESET_STORAGE_KEY, JSON.stringify(safeEntries));
    }
  } catch (_) {}
}

function createResetError(reason, customMessage) {
  let message = customMessage;
  if (!message) {
    if (reason === 'WEAK_PASSWORD') {
      message = 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร';
    } else if (reason === 'EXPIRED') {
      message = 'ลิงก์เปลี่ยนรหัสผ่านหมดอายุแล้ว กรุณาขอลิงก์ใหม่';
    } else if (reason === 'USED') {
      message = 'ลิงก์นี้ถูกใช้งานไปแล้ว ไม่สามารถใช้ซ้ำได้';
    } else if (reason === 'SUSPENDED') {
      message = 'บัญชีผู้ใช้นี้ถูกระงับการใช้งาน ไม่สามารถตั้งรหัสผ่านใหม่ได้';
    } else if (reason === 'FORBIDDEN') {
      message = ADMIN_ONLY_RESET_MESSAGE;
    } else {
      message = 'ลิงก์เปลี่ยนรหัสผ่านไม่ถูกต้อง';
    }
  }
  const err = new Error(message);
  err.reason = reason || 'INVALID';
  err.code = reason || 'INVALID';
  return err;
}

export async function createStaffResetTokenSync(
  staffId,
  { ttlMinutes = 15, username = '', fullName = '', nickname = '' } = {}
) {
  const cleanStaffId = String(staffId ?? '').trim();
  if (!cleanStaffId) {
    throw new Error('กรุณาระบุรหัสพนักงานสำหรับสร้างลิงก์เปลี่ยนรหัสผ่าน');
  }

  const clampedTtl = Math.min(1440, Math.max(5, Number(ttlMinutes) || 15));
  const client = getActiveClient();

  if (client && typeof client.rpc === 'function') {
    let rpcResult;
    let networkErr = null;
    try {
      rpcResult = await client.rpc('create_staff_reset_token', {
        p_staff_id: cleanStaffId,
        p_ttl_minutes: clampedTtl
      });
    } catch (err) {
      networkErr = err;
    }

    const rpcError = networkErr || rpcResult?.error;

    if (isResetForbiddenError(rpcError, rpcResult?.data)) {
      throw createResetError('FORBIDDEN', ADMIN_ONLY_RESET_MESSAGE);
    }

    if (!networkErr && rpcResult && !rpcResult.error && rpcResult.data?.token) {
      const data = rpcResult.data;
      return {
        token: data.token,
        expiresAt: data.expires_at || data.expiresAt,
        ttlMinutes: Number(data.ttl_minutes ?? data.ttlMinutes ?? clampedTtl),
        staffId: String(data.staff_id ?? data.staffId ?? cleanStaffId),
        username: data.username ?? username ?? '',
        fullName: data.full_name ?? data.fullName ?? fullName ?? '',
        nickname: data.nickname ?? nickname ?? '',
        localOnly: false
      };
    }

    if (isResetUnauthorizedError(rpcError, rpcResult?.data)) {
      let hasAuthSession = false;
      try {
        const sessionRes = await client.auth?.getSession?.();
        hasAuthSession = Boolean(sessionRes?.data?.session?.user);
      } catch (_) {}

      const localProfile = readLocalCallerProfile();
      if (hasAuthSession || !isLocalProfileAdmin(localProfile)) {
        throw createResetError('FORBIDDEN', ADMIN_ONLY_RESET_MESSAGE);
      }
      // Allow local fallback ONLY when auth.uid() is null in dev/local custom login AND local nexus_profile is admin
    } else if (rpcError && !isResetRpcUnavailableError(rpcError)) {
      throw new Error(rpcError.message || 'ไม่สามารถสร้างลิงก์ตั้งรหัสผ่านได้');
    }
  }

  // Never allow non-admin local profile to mint local fallback tokens
  const callerProfile = readLocalCallerProfile();
  if (callerProfile && !isLocalProfileAdmin(callerProfile)) {
    throw createResetError('FORBIDDEN', ADMIN_ONLY_RESET_MESSAGE);
  }

  // Local fallback (when Supabase is unconfigured/offline, RPC PGRST202 not yet deployed, or dev local admin without JWT)
  let resolvedUsername = username || '';
  let resolvedFullName = fullName || '';
  let resolvedNickname = nickname || '';
  try {
    const cachedStaff = await db.staff?.get?.(cleanStaffId);
    if (cachedStaff) {
      resolvedUsername = resolvedUsername || cachedStaff.username || '';
      resolvedFullName = resolvedFullName || cachedStaff.name || cachedStaff.full_name || '';
      resolvedNickname = resolvedNickname || cachedStaff.nickname || '';
    }
  } catch (_) {}

  const token = `rst_${generateSecureHex(24)}`;
  const tokenHash = await hashResetTokenSha256(token);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const expiresAt = new Date(nowMs + clampedTtl * 60 * 1000).toISOString();

  const existing = readLocalResetTokens().map((entry) => {
    if (entry && String(entry.staffId) === cleanStaffId && !entry.usedAt) {
      return { ...entry, usedAt: nowIso };
    }
    return entry;
  });

  existing.push({
    tokenHash,
    staffId: cleanStaffId,
    username: resolvedUsername,
    fullName: resolvedFullName,
    nickname: resolvedNickname,
    expiresAt,
    usedAt: null
  });
  writeLocalResetTokens(existing);

  return {
    token,
    expiresAt,
    ttlMinutes: clampedTtl,
    staffId: cleanStaffId,
    username: resolvedUsername,
    fullName: resolvedFullName,
    nickname: resolvedNickname,
    localOnly: true
  };
}

export async function validateStaffResetTokenSync(token) {
  const cleanToken = String(token || '').trim();
  if (!cleanToken || !cleanToken.startsWith('rst_')) {
    return { valid: false, reason: 'INVALID' };
  }

  const client = getActiveClient();
  if (client && typeof client.rpc === 'function') {
    let rpcResult;
    let networkErr = null;
    try {
      rpcResult = await client.rpc('validate_staff_reset_token', {
        p_token: cleanToken
      });
    } catch (err) {
      networkErr = err;
    }

    if (!networkErr && rpcResult && !rpcResult.error && rpcResult.data) {
      const data = rpcResult.data;
      if (data.valid) {
        return {
          valid: true,
          staffId: data.staff_id || data.staffId || '',
          username: data.username || '',
          fullName: data.full_name || data.fullName || '',
          nickname: data.nickname || '',
          expiresAt: data.expires_at || data.expiresAt || null
        };
      }
      return {
        valid: false,
        reason: data.reason || 'INVALID'
      };
    }

    const rpcError = networkErr || rpcResult?.error;
    if (rpcError && !isResetRpcUnavailableError(rpcError)) {
      return { valid: false, reason: 'INVALID' };
    }
  }

  // Local fallback ONLY when Supabase is offline/unconfigured or RPC returns PGRST202
  const tokenHash = await hashResetTokenSha256(cleanToken);
  const entries = readLocalResetTokens();
  const entry = entries.find((item) => item && item.tokenHash === tokenHash);
  if (!entry) {
    return { valid: false, reason: 'INVALID' };
  }
  if (entry.usedAt) {
    return { valid: false, reason: 'USED' };
  }
  const expiresMs = entry.expiresAt ? new Date(entry.expiresAt).getTime() : NaN;
  if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) {
    return { valid: false, reason: 'EXPIRED' };
  }

  try {
    const cachedStaff = await db.staff?.get?.(String(entry.staffId));
    if (isStaffRecordSuspended(cachedStaff)) {
      return { valid: false, reason: 'SUSPENDED' };
    }
  } catch (_) {}

  return {
    valid: true,
    staffId: entry.staffId,
    username: entry.username || '',
    fullName: entry.fullName || '',
    nickname: entry.nickname || '',
    expiresAt: entry.expiresAt
  };
}

export async function consumeStaffResetTokenSync(token, newPassword) {
  const cleanPassword = String(newPassword || '').trim();
  if (cleanPassword.length < 6) {
    throw createResetError('WEAK_PASSWORD', 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
  }

  const cleanToken = String(token || '').trim();
  if (!cleanToken || !cleanToken.startsWith('rst_')) {
    throw createResetError('INVALID');
  }

  const client = getActiveClient();
  if (client && typeof client.rpc === 'function') {
    let rpcResult;
    let networkErr = null;
    try {
      rpcResult = await client.rpc('consume_staff_reset_token', {
        p_token: cleanToken,
        p_new_password: cleanPassword
      });
    } catch (err) {
      networkErr = err;
    }

    if (!networkErr && rpcResult && !rpcResult.error && rpcResult.data) {
      const data = rpcResult.data;
      if (!data.success) {
        throw createResetError(data.reason || 'INVALID', data.message);
      }

      // Ensure local Dexie db.staff never retains any stale plaintext password
      const targetStaffId = data.staff_id || data.staffId;
      if (targetStaffId) {
        try {
          const existingStaff = await db.staff?.get?.(String(targetStaffId));
          if (existingStaff && 'password' in existingStaff) {
            await db.staff.put(stripStaffPassword(existingStaff));
          }
        } catch (_) {}
      }

      return {
        success: true,
        staffId: String(targetStaffId || ''),
        username: data.username || ''
      };
    }

    const rpcError = networkErr || rpcResult?.error;
    if (rpcError && !isResetRpcUnavailableError(rpcError)) {
      throw new Error(rpcError.message || 'ไม่สามารถเปลี่ยนรหัสผ่านได้');
    }
  }

  // Local PGRST202 / offline fallback
  const tokenHash = await hashResetTokenSha256(cleanToken);
  const entries = readLocalResetTokens();
  const idx = entries.findIndex((item) => item && item.tokenHash === tokenHash);
  if (idx === -1) {
    throw createResetError('INVALID');
  }

  const entry = entries[idx];
  if (entry.usedAt) {
    throw createResetError('USED');
  }

  const expiresMs = entry.expiresAt ? new Date(entry.expiresAt).getTime() : NaN;
  if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) {
    throw createResetError('EXPIRED');
  }

  let existingStaff = null;
  try {
    existingStaff = await db.staff?.get?.(String(entry.staffId));
  } catch (_) {}

  if (isStaffRecordSuspended(existingStaff)) {
    throw createResetError('SUSPENDED');
  }

  const nowIso = new Date().toISOString();
  entries[idx] = { ...entry, usedAt: nowIso };
  writeLocalResetTokens(entries);

  try {
    if (existingStaff) {
      await db.staff.put({
        ...stripStaffPassword(existingStaff),
        password_hash: await hashResetTokenSha256(cleanPassword),
        updated_at: nowIso
      });
    }
  } catch (_) {}

  if (client?.auth && typeof client.from === 'function') {
    try {
      const sessionRes = await client.auth.getSession?.();
      if (sessionRes?.data?.session) {
        await client
          .from('staff_users')
          .update({ password: cleanPassword })
          .eq('id', entry.staffId);
      }
    } catch (_) {}
  }

  return {
    success: true,
    staffId: entry.staffId,
    username: entry.username || ''
  };
}

export { resetWarehouseAuthSession } from './warehouseService.js';
