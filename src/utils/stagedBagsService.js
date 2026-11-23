import { db } from '../services/db.js';

const STAGED_BAGS_STORAGE_KEY = 'f2u_staged_bags_v1';
const BROADCAST_CHANNEL_NAME = 'flower2u_staged_bags';

let memoryBagsStore = [];

function notifyBagsChanged(bags) {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('f2u_staged_bags_updated', { detail: bags }));
    } catch {}
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        bc.postMessage({ type: 'STAGED_BAGS_UPDATED', bags });
        bc.close();
      } catch {}
    }
  }
}

export async function loadStagedBags() {
  try {
    if (db?.sync_meta && typeof db.sync_meta.get === 'function') {
      const rec = await db.sync_meta.get(STAGED_BAGS_STORAGE_KEY);
      if (rec && Array.isArray(rec.value)) {
        memoryBagsStore = rec.value;
        return rec.value;
      }
    }
  } catch {}

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(STAGED_BAGS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          memoryBagsStore = parsed;
          return parsed;
        }
      }
    } catch {}
  }

  return memoryBagsStore;
}

export async function saveStagedBagsList(bags = []) {
  const cleanBags = Array.isArray(bags) ? bags : [];
  memoryBagsStore = cleanBags;

  try {
    if (db?.sync_meta && typeof db.sync_meta.put === 'function') {
      await db.sync_meta.put({
        key: STAGED_BAGS_STORAGE_KEY,
        value: cleanBags,
        updated_at: Date.now()
      });
    }
  } catch {}

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STAGED_BAGS_STORAGE_KEY, JSON.stringify(cleanBags));
    } catch {}
  }

  notifyBagsChanged(cleanBags);
  return cleanBags;
}

export async function upsertStagedBag(bagInput) {
  const current = await loadStagedBags();
  const nowIso = new Date().toISOString();
  const bagId = bagInput.id || `bag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const normalized = {
    id: bagId,
    title: String(bagInput.title || bagInput.recipientName || 'กระเป๋าเตรียมออกงาน').trim(),
    mode: bagInput.mode === 'project' ? 'project' : 'party', // 'project' | 'party'
    projectId: bagInput.projectId || null,
    projectIds: Array.isArray(bagInput.projectIds) ? bagInput.projectIds : (bagInput.projectId ? [bagInput.projectId] : []),
    recipientId: bagInput.recipientId || null,
    recipientName: String(bagInput.recipientName || '').trim(),
    teamMembers: Array.isArray(bagInput.teamMembers) ? bagInput.teamMembers : [],
    dueDate: bagInput.dueDate || null,
    notes: String(bagInput.notes || '').trim(),
    // items: [{ item_id, name, item_type, unit, quantity, unitCodes: ['SC-001'], image_url, color }]
    items: Array.isArray(bagInput.items) ? bagInput.items.map((it) => ({
      item_id: String(it.item_id || it.id),
      name: it.name || '',
      item_type: it.item_type || 'consumable',
      unit: it.unit || 'ชิ้น',
      quantity: Math.max(1, Number(it.quantity) || 1),
      unitCodes: Array.isArray(it.unitCodes || it.selectedUnits) ? [...(it.unitCodes || it.selectedUnits)] : [],
      image_url: it.image_url || '',
      color: it.color || ''
    })) : [],
    createdAt: bagInput.createdAt || nowIso,
    updatedAt: nowIso
  };

  const exists = current.some((b) => b.id === bagId);
  const next = exists
    ? current.map((b) => (b.id === bagId ? normalized : b))
    : [normalized, ...current];

  await saveStagedBagsList(next);
  return normalized;
}

export async function removeStagedBag(bagId) {
  const current = await loadStagedBags();
  const next = current.filter((b) => b.id !== bagId);
  await saveStagedBagsList(next);
  return next;
}

export function subscribeStagedBags(onUpdate) {
  if (typeof window === 'undefined') return () => {};

  const handleWindow = (e) => {
    if (Array.isArray(e?.detail) && typeof onUpdate === 'function') {
      onUpdate(e.detail);
    }
  };
  window.addEventListener('f2u_staged_bags_updated', handleWindow);

  let bc = null;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.onmessage = (ev) => {
        if (ev?.data?.type === 'STAGED_BAGS_UPDATED' && Array.isArray(ev.data.bags) && typeof onUpdate === 'function') {
          memoryBagsStore = ev.data.bags;
          onUpdate(ev.data.bags);
        }
      };
    } catch {}
  }

  return () => {
    window.removeEventListener('f2u_staged_bags_updated', handleWindow);
    if (bc) {
      try {
        bc.close();
      } catch {}
    }
  };
}

/**
 * Shopping-Cart Style Availability Evaluator:
 * Evaluates a staged bag against live warehouse stock and serialized tool units.
 *
 * CRITICAL RULE: Never auto-deletes unavailable items!
 * Instead, returns `isGreyedOut: true` with exact reason (`UNAVAILABLE_TAKEN`,
 * `INSUFFICIENT_STOCK`, `OUT_OF_STOCK`) and 1-click replacement suggestions (`replacementCandidates`).
 */
export function evaluateStagedBagAvailability(bag, catalogItems = [], assetUnits = [], allStagedBags = []) {
  if (!bag) return null;

  const itemMap = new Map();
  (catalogItems || []).forEach((it) => {
    if (it?.id) itemMap.set(String(it.id), it);
  });

  const unitMap = new Map();
  const availableUnitsByItemId = new Map();
  (assetUnits || []).forEach((u) => {
    if (!u?.unit_code) return;
    unitMap.set(String(u.unit_code), u);
    const isAvail = String(u.status || '').toUpperCase() === 'AVAILABLE' && !u.borrowed_by && !u.active_recipient;
    if (isAvail && u.item_id) {
      const key = String(u.item_id);
      if (!availableUnitsByItemId.has(key)) availableUnitsByItemId.set(key, []);
      availableUnitsByItemId.get(key).push(String(u.unit_code));
    }
  });

  // Track units also sitting in OTHER staged bags (soft warning before checkout)
  const otherBagUnitsMap = new Map();
  (allStagedBags || []).forEach((other) => {
    if (!other || other.id === bag.id) return;
    (other.items || []).forEach((it) => {
      (it.unitCodes || []).forEach((code) => {
        if (!otherBagUnitsMap.has(code)) otherBagUnitsMap.set(code, []);
        otherBagUnitsMap.get(code).push(other.title || other.recipientName || 'กระเป๋าอื่น');
      });
    });
  });

  // Collect all unit codes currently staged in THIS bag so replacement suggestions don't suggest already-picked codes
  const codesInThisBag = new Set(
    (bag.items || []).flatMap((it) => it.unitCodes || [])
  );

  let readyCount = 0;
  let greyedOutCount = 0;

  const evaluatedLines = (bag.items || []).map((line) => {
    const liveItem = itemMap.get(String(line.item_id));
    const itemType = String(liveItem?.item_type || line.item_type || '').toLowerCase();
    const isTool = itemType === 'asset' || itemType === 'tool';

    if (isTool) {
      const unitEvaluations = (line.unitCodes || []).map((code) => {
        const liveUnit = unitMap.get(String(code));
        const statusUpper = String(liveUnit?.status || 'AVAILABLE').toUpperCase();
        const holder = liveUnit?.active_recipient || liveUnit?.borrowed_by || '';
        const isAvailable = Boolean(liveUnit) ? (statusUpper === 'AVAILABLE' && !holder) : true;

        const allAvailForTool = availableUnitsByItemId.get(String(line.item_id)) || [];
        const replacementCandidates = allAvailForTool.filter((cand) => !codesInThisBag.has(cand));

        if (!isAvailable) {
          greyedOutCount += 1;
          return {
            unitCode: code,
            state: statusUpper === 'BROKEN' || statusUpper === 'LOST' ? 'UNAVAILABLE_DAMAGED' : 'UNAVAILABLE_TAKEN',
            isGreyedOut: true,
            takenBy: holder || (statusUpper === 'BROKEN' ? 'แจ้งชำรุด' : 'ทีมอื่นเอาออกหน้างานแล้ว'),
            sharedInOtherBags: otherBagUnitsMap.get(code) || [],
            replacementCandidates
          };
        }

        readyCount += 1;
        return {
          unitCode: code,
          state: 'READY',
          isGreyedOut: false,
          takenBy: null,
          sharedInOtherBags: otherBagUnitsMap.get(code) || [],
          replacementCandidates: []
        };
      });

      const allGreyed = unitEvaluations.length > 0 && unitEvaluations.every((u) => u.isGreyedOut);
      const hasAnyGreyed = unitEvaluations.some((u) => u.isGreyedOut);

      return {
        ...line,
        isTool: true,
        liveItem: liveItem || null,
        unitEvaluations,
        state: allGreyed ? 'UNAVAILABLE_TAKEN' : hasAnyGreyed ? 'PARTIAL_TAKEN' : 'READY',
        isGreyedOut: allGreyed,
        hasConflict: hasAnyGreyed
      };
    }

    // Material (consumable / reusable)
    const isUnavailableItem =
      !liveItem ||
      liveItem.is_active === false ||
      liveItem.status === 'retired';
    const liveStock = isUnavailableItem ? 0 : (Number(liveItem.current_stock) || 0);
    const reqQty = Math.max(1, Number(line.quantity) || 1);

    if (isUnavailableItem || liveStock <= 0) {
      greyedOutCount += 1;
      return {
        ...line,
        isTool: false,
        liveItem: liveItem || null,
        availableQty: 0,
        state: 'OUT_OF_STOCK',
        isGreyedOut: true,
        hasConflict: true
      };
    }

    if (liveItem && liveStock < reqQty) {
      greyedOutCount += 1;
      return {
        ...line,
        isTool: false,
        liveItem,
        availableQty: liveStock,
        state: 'INSUFFICIENT_STOCK',
        isGreyedOut: true,
        hasConflict: true
      };
    }

    readyCount += 1;
    return {
      ...line,
      isTool: false,
      liveItem: liveItem || null,
      availableQty: liveStock,
      state: 'READY',
      isGreyedOut: false,
      hasConflict: false
    };
  });

  return {
    ...bag,
    evaluatedLines,
    readyCount,
    greyedOutCount,
    hasAnyGreyedOut: greyedOutCount > 0,
    canCheckoutReadyItems: readyCount > 0
  };
}

/**
 * Pure helper to swap a greyed-out unit code (e.g. SC-001 taken by Team B)
 * with an available unit code (e.g. SC-002) inside a staged bag without losing its slot.
 */
export function replaceUnitInStagedBagObject(bag, itemId, oldUnitCode, newUnitCode) {
  if (!bag || !oldUnitCode || !newUnitCode) return bag;
  return {
    ...bag,
    updatedAt: new Date().toISOString(),
    items: (bag.items || []).map((it) => {
      if (String(it.item_id) !== String(itemId)) return it;
      const nextCodes = (it.unitCodes || []).map((c) => (c === oldUnitCode ? newUnitCode : c));
      return {
        ...it,
        unitCodes: [...new Set(nextCodes)]
      };
    })
  };
}

/**
 * Builds an atomic `createIssue` payload from an evaluated staged bag,
 * automatically excluding greyed-out (`UNAVAILABLE_TAKEN` / `OUT_OF_STOCK`) items
 * and keeping any unresolved greyed-out items in the bag if partial checkout occurs.
 */
export function buildCheckoutFromEvaluatedBag(evaluatedBag) {
  if (!evaluatedBag) return { materialLines: [], toolUnits: [], remainingGreyItems: [] };

  const materialLines = [];
  const toolUnits = [];
  const remainingGreyItems = [];

  for (const line of evaluatedBag.evaluatedLines || []) {
    if (line.isTool) {
      const readyCodes = (line.unitEvaluations || [])
        .filter((u) => !u.isGreyedOut)
        .map((u) => u.unitCode);
      const greyCodes = (line.unitEvaluations || [])
        .filter((u) => u.isGreyedOut)
        .map((u) => u.unitCode);

      if (readyCodes.length > 0) {
        toolUnits.push(...readyCodes);
      }
      if (greyCodes.length > 0) {
        remainingGreyItems.push({
          item_id: line.item_id,
          name: line.name,
          item_type: line.item_type,
          unit: line.unit,
          quantity: greyCodes.length,
          unitCodes: greyCodes,
          image_url: line.image_url,
          color: line.color
        });
      }
    } else {
      if (!line.isGreyedOut) {
        materialLines.push({
          item_id: line.item_id,
          quantity: Number(line.quantity) || 1
        });
      } else {
        remainingGreyItems.push({
          item_id: line.item_id,
          name: line.name,
          item_type: line.item_type,
          unit: line.unit,
          quantity: line.quantity,
          unitCodes: [],
          image_url: line.image_url,
          color: line.color
        });
      }
    }
  }

  return {
    materialLines,
    toolUnits,
    remainingGreyItems
  };
}
