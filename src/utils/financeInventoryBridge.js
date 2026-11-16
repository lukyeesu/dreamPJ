import { db } from '../services/db.js';
import * as warehouseService from '../services/warehouseService.js';

const SYNC_LEDGER_KEY = 'f2u_fin_inv_synced_ledger_v1';
const VALID_CASH_DENOMINATIONS = new Set([20, 50, 100, 500, 1000]);

let memorySyncedSet = new Set();

/**
 * Generates a deterministic UUID v4-shaped string from an arbitrary seed string
 * so server-side `warehouse_dispatch(p_idempotency_key UUID)` deduplicates
 * the exact same financial line even across devices or page reloads!
 */
export function deterministicUuidFromSeed(seed) {
  const str = String(seed || 'default-seed');
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  let h3 = 0x9e3779b9 ^ str.length;
  let h4 = 0x85ebca6b ^ str.length;

  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 2246822507);
    h4 = Math.imul(h4 ^ ch, 3266489909);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  h3 = Math.imul(h3 ^ (h3 >>> 16), 2246822507) ^ Math.imul(h4 ^ (h4 >>> 13), 3266489909);
  h4 = Math.imul(h4 ^ (h4 >>> 16), 2246822507) ^ Math.imul(h3 ^ (h3 >>> 13), 3266489909);

  const hex = (
    (h1 >>> 0).toString(16).padStart(8, '0') +
    (h2 >>> 0).toString(16).padStart(8, '0') +
    (h3 >>> 0).toString(16).padStart(8, '0') +
    (h4 >>> 0).toString(16).padStart(8, '0')
  );

  // Format as valid RFC 4122 UUID (version 4 nibble + variant 8..b nibble)
  const variantNibble = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variantNibble}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

async function loadSyncedLedger() {
  try {
    if (db?.sync_meta && typeof db.sync_meta.get === 'function') {
      const rec = await db.sync_meta.get(SYNC_LEDGER_KEY);
      if (rec && Array.isArray(rec.value)) {
        rec.value.forEach((k) => memorySyncedSet.add(k));
      }
    }
  } catch {}
  return memorySyncedSet;
}

async function markSyncedInLedger(keys = []) {
  keys.forEach((k) => memorySyncedSet.add(k));
  try {
    if (db?.sync_meta && typeof db.sync_meta.put === 'function') {
      const arr = Array.from(memorySyncedSet).slice(-2000);
      await db.sync_meta.put({ key: SYNC_LEDGER_KEY, value: arr, updated_at: Date.now() });
    }
  } catch {}
}

const NON_STOCK_EXPENSE_KEYWORDS = [
  'ค่ารถ',
  'ค่าเดินทาง',
  'น้ำมัน',
  'ทางด่วน',
  'ที่จอดรถ',
  'แท็กซี่',
  'grab',
  'lalamove',
  'ขนส่ง',
  'ค่าส่ง',
  'ค่าแรง',
  'ค่าจ้าง',
  'เงินเดือน',
  'เบี้ยเลี้ยง',
  'โอที',
  'ค่าไฟ',
  'ค่าน้ำ',
  'ค่าเช่า',
  'อินเทอร์เน็ต',
  'โทรศัพท์',
  'อาหาร',
  'เครื่องดื่ม',
  'กาแฟ',
  'เลี้ยงทีม',
  'ภาษี',
  'ธรรมเนียม',
  'โฆษณา',
  'ยิงแอด'
];

/**
 * Detects if a text describes physical Thai banknotes (20, 50, 100, 500, 1000)
 * e.g. "ธนบัตร 50 บาท", "แบงค์ 100", "แลกแบงค์ 20"
 */
export function detectBanknoteDenomination(text) {
  const raw = String(text || '').trim().toLowerCase();
  if (!raw) return null;
  const hasCashWord = raw.includes('ธนบัตร') || raw.includes('แบงค์') || raw.includes('แบงก์');
  if (!hasCashWord) return null;

  const match = raw.match(/(?:ธนบัตร|แบงค์|แบงก์)\s*(?:ใบละ\s*)?(1,?000|500|100|50|20)(?!\d)/);
  if (!match) return null;
  const denom = Number(String(match[1]).replace(/,/g, ''));
  return VALID_CASH_DENOMINATIONS.has(denom) ? denom : null;
}

/**
 * Smart default for seamless Finance/Project -> Inventory sync:
 * Returns true automatically for matched inventory items, banknotes, or physical supplies/tools,
 * while skipping non-physical expenses (transport, labor, utilities, meals).
 */
export function shouldAutoSyncExpenseLine(detail, category = '', catalogItems = []) {
  const cleanDetail = String(detail || '').trim();
  if (!cleanDetail) return false;

  if (detectBanknoteDenomination(cleanDetail)) return true;
  if (matchInventoryItemByText(cleanDetail, catalogItems)) return true;

  const combined = `${cleanDetail} ${String(category || '')}`.toLowerCase();
  const isNonStockService = NON_STOCK_EXPENSE_KEYWORDS.some((kw) => combined.includes(kw));
  return !isNonStockService;
}

/**
 * Matches free-text purchase description (e.g. "โฟมจัดดอกไม้", "เทปกาวใส")
 * against existing `inventory_items` catalog.
 */
export function matchInventoryItemByText(text, catalogItems = []) {
  const query = String(text || '').trim().toLowerCase();
  if (!query || !Array.isArray(catalogItems) || catalogItems.length === 0) return null;

  const activeItems = catalogItems.filter(
    (it) => it && it.is_active !== false && String(it.item_type || '').toLowerCase() !== 'banknote' && String(it.item_type || '').toLowerCase() !== 'task'
  );

  // 1. Exact name or code match
  const exact = activeItems.find(
    (it) => String(it.name || '').trim().toLowerCase() === query || String(it.code || '').trim().toLowerCase() === query
  );
  if (exact) return exact;

  // 2. Catalog item name contained in detail or detail contained in item name (min 2 chars)
  if (query.length >= 2) {
    const partial = activeItems.find((it) => {
      const name = String(it.name || '').trim().toLowerCase();
      return name && (name.includes(query) || query.includes(name));
    });
    if (partial) return partial;
  }

  return null;
}

/**
 * Leg 1: Finance/Project Expense -> Auto-Stock Sync into Inventory Backpack
 * Safely adjusts stock (or creates a new item if requested) with strict idempotency.
 */
export async function syncExpenseLinesToWarehouse({
  projectId,
  expenseLines = [],
  catalogItems = [],
  adjustStockFn = warehouseService.adjustStock,
  createItemFn = warehouseService.createItem,
  depositCashFn = warehouseService.depositCash
}) {
  const ledger = await loadSyncedLedger();
  const syncedLineKeys = [];
  let syncedCount = 0;
  const errors = [];

  const updatedLines = [];

  for (let i = 0; i < expenseLines.length; i++) {
    const line = expenseLines[i];
    if (!line || line.is_voided || !line.syncToWarehouse) {
      updatedLines.push(line);
      continue;
    }

    const qty = Math.max(0, Number(line.warehouseQty ?? line.quantity) || 0);
    const detail = String(line.detail || '').trim();
    if (!detail || qty <= 0) {
      updatedLines.push(line);
      continue;
    }

    const stableLineKey = line.id
      ? `exp:${projectId || 'GEN'}:${line.id}`
      : `exp:${projectId || 'GEN'}:${detail}:${qty}:${line.date || ''}:${i}`;

    if (line.stockSyncedAt || ledger.has(stableLineKey)) {
      updatedLines.push({ ...line, stockSyncedAt: line.stockSyncedAt || 'synced' });
      continue;
    }

    const idempotencyKey = deterministicUuidFromSeed(stableLineKey);
    const detectedDenom = detectBanknoteDenomination(detail);
    const matchedItem = line.warehouseItemId
      ? (catalogItems || []).find((it) => String(it.id) === String(line.warehouseItemId))
      : matchInventoryItemByText(detail, catalogItems);

    try {
      if (detectedDenom && typeof depositCashFn === 'function') {
        await depositCashFn({
          denomination: detectedDenom,
          noteCount: Math.max(1, Math.floor(qty)),
          projectId: projectId || null,
          notes: `เติมธนบัตรอัตโนมัติจากหน้าการเงิน (${projectId || 'ทั่วไป'}): ${detail}`,
          idempotencyKey
        });
      } else if (matchedItem && matchedItem.id) {
        await adjustStockFn({
          itemId: matchedItem.id,
          deltaQuantity: qty,
          reason: `ซื้อเข้าอัตโนมัติจากหน้าการเงิน (${projectId || 'ทั่วไป'}): ${detail}`,
          idempotencyKey
        });
      } else if (line.createNewWarehouseItem !== false) {
        const unitCost = Number(line.unitPrice ?? line.unit_price) || (Number(line.price) ? Number(line.price) / qty : 0);
        await createItemFn({
          code: `AUTO-${Date.now().toString().slice(-5)}-${i}`,
          name: detail,
          itemType: line.warehouseItemType || 'consumable',
          unit: line.warehouseUnit || 'ชิ้น',
          minAlertThreshold: 5,
          averageCost: unitCost,
          initialStock: qty,
          openingStockReason: `สร้างและรับเข้าอัตโนมัติจากบิลการเงิน (${projectId || 'ทั่วไป'})`,
          idempotencyKey
        });
      } else {
        updatedLines.push(line);
        continue;
      }

      const nowIso = new Date().toISOString();
      syncedLineKeys.push(stableLineKey);
      syncedCount += 1;
      updatedLines.push({
        ...line,
        warehouseItemId: matchedItem?.id || line.warehouseItemId || null,
        stockSyncedAt: nowIso
      });
    } catch (err) {
      errors.push({ detail, error: err?.message || 'เติมสต็อกอัตโนมัติไม่สำเร็จ' });
      updatedLines.push(line);
    }
  }

  if (syncedLineKeys.length > 0) {
    await markSyncedInLedger(syncedLineKeys);
  }

  return { updatedLines, syncedCount, errors };
}

/**
 * Leg 2: Customer Support Banknotes -> Auto-Deposit (+ Optional Reserve) in Cash Vault
 * Strictly non-expense (does NOT touch expenses or reduce Net Profit!).
 */
export async function syncSupportCashToWarehouse({
  projectId,
  supportLines = [],
  autoReserveForProject = true,
  depositCashFn = warehouseService.depositCash,
  reserveCashFn = warehouseService.reserveCash
}) {
  const ledger = await loadSyncedLedger();
  const syncedKeys = [];
  let syncedCount = 0;
  const errors = [];
  const updatedLines = [];

  for (let i = 0; i < supportLines.length; i++) {
    const line = supportLines[i];
    const denom = Number(line?.denomination) || 0;
    const noteCount = Math.floor(Number(line?.quantity) || 0);

    if (!line || !line.syncToCashVault || !VALID_CASH_DENOMINATIONS.has(denom) || noteCount <= 0) {
      updatedLines.push(line);
      continue;
    }

    const stableKey = line.id
      ? `supcash:${projectId || 'GEN'}:${line.id}`
      : `supcash:${projectId || 'GEN'}:${denom}:${noteCount}:${line.date || ''}:${i}`;

    if (line.cashSyncedAt || ledger.has(stableKey)) {
      updatedLines.push({ ...line, cashSyncedAt: line.cashSyncedAt || 'synced' });
      continue;
    }

    try {
      const depositKey = deterministicUuidFromSeed(`${stableKey}:deposit`);
      await depositCashFn({
        denomination: denom,
        noteCount,
        projectId: projectId || null,
        notes: `รับเงินสนับสนุนศิลปินเข้าคลังธนบัตรอัตโนมัติ (${projectId || 'ทั่วไป'})`,
        idempotencyKey: depositKey
      });

      if (autoReserveForProject && projectId && typeof reserveCashFn === 'function') {
        const reserveKey = deterministicUuidFromSeed(`${stableKey}:reserve`);
        try {
          await reserveCashFn({
            projectId,
            denomination: denom,
            noteCount,
            notes: `จองธนบัตรอัตโนมัติจากเงินสนับสนุนศิลปิน (${projectId})`,
            idempotencyKey: reserveKey
          });
        } catch {
          // Reservation is optional convenience if project row hasn't synced to Supabase yet
        }
      }

      const nowIso = new Date().toISOString();
      syncedKeys.push(stableKey);
      syncedCount += 1;
      updatedLines.push({ ...line, cashSyncedAt: nowIso });
    } catch (err) {
      errors.push({ denomination: denom, error: err?.message || 'ซิงก์คลังธนบัตรไม่สำเร็จ' });
      updatedLines.push(line);
    }
  }

  if (syncedKeys.length > 0) {
    await markSyncedInLedger(syncedKeys);
  }

  return { updatedLines, syncedCount, errors };
}

/**
 * Leg 3 (Reverse): Quick Restock in Game Backpack -> Create Expense Bill in Finance
 * Pre-stamps `stockSyncedAt` and records in ledger so opening/saving that project later
 * NEVER re-adds the stock a second time!
 */
export async function buildProjectWithWarehouseExpense({
  targetProject,
  projectId = 'SHOP-STOCK',
  itemName,
  itemId = null,
  quantity,
  totalCost,
  category = 'ค่าวัสดุ/เติมคลังสินค้า',
  paymentChannel = 'โอนเงิน'
}) {
  const qty = Math.max(1, Number(quantity) || 1);
  const total = Math.max(0, Number(totalCost) || 0);
  const unitPrice = Math.round((total / qty) * 100) / 100;
  const nowIso = new Date().toISOString();
  const lineId = `inv_exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const baseProject = targetProject
    ? JSON.parse(JSON.stringify(targetProject))
    : {
        id: projectId,
        name: projectId === 'SHOP-STOCK' ? 'บิลซื้อของเข้าคลังกลางร้าน' : `รายการซื้อเข้าคลัง ${projectId}`,
        customer: 'คลังสินค้ากลาง (Flower2U)',
        artist: '-',
        category: 'ค่าวัสดุ/อุปกรณ์',
        deliveryDate: nowIso.slice(0, 10),
        rawDateTime: nowIso,
        paymentChannel,
        paymentStatus: 'paid',
        dealStatus: 'confirmed',
        transportStatus: 'completed',
        quotationItems: [],
        expenses: [],
        customerSupport: [],
        totalRevenue: 0,
        totalExpenses: 0,
        netProfit: 0
      };

  if (!Array.isArray(baseProject.expenses)) baseProject.expenses = [];
  baseProject.expenses.push({
    id: lineId,
    category,
    detail: itemName,
    quantity: qty,
    unit_price: unitPrice,
    unitPrice,
    price: total,
    date: nowIso,
    paymentChannel,
    warehouseItemId: itemId,
    syncToWarehouse: true,
    stockSyncedAt: nowIso,
    is_voided: false
  });

  const totalRev =
    (baseProject.quotationItems || []).reduce((s, q) => s + (q.is_voided ? 0 : Number(q.price) || 0), 0) ||
    (Number(baseProject.wage) || 0) + (Number(baseProject.deliveryFee) || 0);
  const totalExp = (baseProject.expenses || []).reduce((s, e) => s + (e.is_voided ? 0 : Number(e.price) || 0), 0);

  baseProject.totalRevenue = totalRev;
  baseProject.totalExpenses = totalExp;
  baseProject.netProfit = totalRev - totalExp;

  await markSyncedInLedger([`exp:${baseProject.id}:${lineId}`]);
  return baseProject;
}
