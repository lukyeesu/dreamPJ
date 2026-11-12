/**
 * Warehouse Calculation & Domain Utilities for Plan C
 * Pure functions: math, cash formulas, status normalization, and invariant checks.
 */

export const SUPPORTED_DENOMINATIONS = [20, 50, 100, 500, 1000];

export const TOOL_STATUSES = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  BORROWED: 'BORROWED',
  BROKEN: 'BROKEN',
  LOST: 'LOST'
});

export const ITEM_TYPES = Object.freeze({
  CONSUMABLE: 'consumable',
  ASSET: 'asset',
  REUSABLE: 'reusable',
  TASK: 'task',
  BANKNOTE: 'banknote'
});

/**
 * Normalizes item type (reusable_material aliases reusable)
 */
export function normalizeItemType(type) {
  if (!type) return ITEM_TYPES.CONSUMABLE;
  const lower = String(type).trim().toLowerCase();
  if (lower === 'reusable_material') return ITEM_TYPES.REUSABLE;
  return lower;
}

/**
 * Validates cash denomination integer
 */
export function isValidDenomination(denom) {
  const num = Number(denom);
  return Number.isInteger(num) && SUPPORTED_DENOMINATIONS.includes(num);
}

/**
 * Calculate available physical cash in vault
 * Formula: physical_count - reserved_count
 */
export function calculateVaultAvailable(physicalCount, reservedCount) {
  const p = Math.max(0, Math.floor(Number(physicalCount) || 0));
  const r = Math.max(0, Math.floor(Number(reservedCount) || 0));
  return Math.max(0, p - r);
}

/**
 * Calculate recommended restock for vault denomination
 * Formula: max(0, target_available - available)
 */
export function calculateCashRestock(availableCount, targetAvailableCount) {
  const avail = Math.max(0, Math.floor(Number(availableCount) || 0));
  const target = Math.max(0, Math.floor(Number(targetAvailableCount) || 0));
  return Math.max(0, target - avail);
}

/**
 * Calculate cash notes remaining in helper custody
 * Formula: issued_count - (prepared_count + returned_raw_count + handed_over_count)
 */
export function calculateHelperRemaining(issuedCount, preparedCount, returnedRawCount, handedOverCount) {
  const issued = Math.max(0, Math.floor(Number(issuedCount) || 0));
  const prepared = Math.max(0, Math.floor(Number(preparedCount) || 0));
  const returnedRaw = Math.max(0, Math.floor(Number(returnedRawCount) || 0));
  const handedOver = Math.max(0, Math.floor(Number(handedOverCount) || 0));
  return Math.max(0, issued - (prepared + returnedRaw + handedOver));
}

/**
 * Calculate total monetary value of banknotes
 */
export function calculateDenominationTotalValue(denomination, noteCount) {
  const denom = Number(denomination) || 0;
  const count = Math.max(0, Math.floor(Number(noteCount) || 0));
  return denom * count;
}

/**
 * Check if a tool unit status is considered available for new loans
 */
export function isToolAvailable(status, hasActiveCustody = false) {
  if (hasActiveCustody) return false;
  return String(status || '').trim().toUpperCase() === TOOL_STATUSES.AVAILABLE;
}

/**
 * Validate material return cumulative limits
 */
export function validateMaterialReturn(issuedQty, alreadyReturnedQty, returningQty) {
  const issued = Number(issuedQty) || 0;
  const returned = Number(alreadyReturnedQty) || 0;
  const returning = Number(returningQty) || 0;

  if (returning <= 0) {
    return { valid: false, message: 'จำนวนคืนต้องมากกว่าศูนย์' };
  }
  if (returned + returning > issued) {
    return {
      valid: false,
      message: `ยอดคืนสะสม (${returned + returning}) เกินยอดที่เบิกไป (${issued})`
    };
  }
  return { valid: true };
}
