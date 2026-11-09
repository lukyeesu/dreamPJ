import Dexie from 'dexie';

// สร้างฐานข้อมูล IndexedDB ประจำเครื่อง (Local-First Zero-Egress Database)
export const db = new Dexie('Flower2UDatabase');

db.version(1).stores({
  projects: 'id, project_datetime, deal_status, transport_status, payment_status, artist_name, customer_name, updated_at',
  project_quotation_items: 'id, project_id, sort_order',
  project_customer_support: 'id, project_id, denomination',
  project_expenses: 'id, project_id, sort_order',
  artists: 'id, name, birth_date',
  customers: 'id, name, phone',
  shop_settings: 'id, updated_at',
  inventory_items: 'id, code, name, item_type, status, is_active',
  asset_loans: 'id, item_id, project_id, status',
  inventory_disposals: 'id, item_id, disposal_code',
  sync_meta: 'key'
});

db.version(2).stores({
  delivery_locations: 'id, name, zone, is_active'
});

db.version(3).stores({
  material_rates: 'id, name, is_active, updated_at',
  quotations: 'id, quote_no, title, client_name, project_code, updated_at',
  artists: 'id, name, agency, fandom_name, birth_date'
});

db.version(4).stores({
  staff: 'id, username, staff_code, role, is_active'
});

db.version(5).stores({
  asset_units: 'unit_code, item_id, status, project_id',
  project_checklist_items: 'id, project_id, item_id, is_checked, item_type',
  inventory_categories: 'id, name, type'
});

// ป้องกัน Safari / มือถือ ลบแคชทิ้งด้วย Storage Persistence
if (typeof window !== 'undefined' && navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then(persistent => {
    if (persistent) {
      console.log('🛡️ IndexedDB storage is permanently persisted.');
    }
  }).catch(() => {});
}

if (typeof window !== 'undefined') {
  window.db = db;
}

// ฟังก์ชันล้างข้อมูลแคชทั้งหมดใน IndexedDB (เรียกใช้เมื่อผู้ใช้กด Logout หรือถูกระงับ เพื่อความปลอดภัยสูงสุด)
export async function clearAllLocalDatabase() {
  try {
    if (db && Array.isArray(db.tables)) {
      await Promise.allSettled(
        db.tables.map(table => table.clear().catch(e => console.warn(`Error clearing ${table.name}:`, e)))
      );
    }
    // ทำลายฐานข้อมูลใน IndexedDB เพื่อไม่ให้มีโครงสร้างหรือแคชค้างบนเครื่อง
    await db.delete().catch(() => {});
    console.log('🛡️ All IndexedDB tables and database purged cleanly.');
  } catch (err) {
    console.warn('Error clearing IndexedDB:', err);
  }
}

export default db;
