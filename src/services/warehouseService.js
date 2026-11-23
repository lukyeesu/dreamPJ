import { db } from './db';
import { getActiveClient } from './supabaseClient';
import {
  isValidDenomination,
  normalizeItemType
} from '../utils/warehouse.js';

// Auth session tracking to prevent cross-session / cross-user cache corruption
let currentAuthEpoch = 0;
let currentAuthUid = null;
let catalogRevision = 0;
let currentSummaryFlight = null; // { epoch, promise }
let currentCashFlight = null;    // { epoch, promise }
const keyedFlights = new Map();  // key -> Promise
const memoryCache = new Map();   // key -> { data, timestamp }
const CACHE_TTL_MS = 30000;      // 30s TTL
const MAX_CACHE_SIZE = 100;
const authSessionSubscribers = new Set();
let authSubscriptionInitialized = false;

async function cacheCatalogRows(items, totalCount = null) {
  try {
    const rows = (items || []).filter(item => String(item.item_type || '').toLowerCase() !== 'banknote');
    if (totalCount !== null && (totalCount === 0 || rows.length >= totalCount)) {
      // Authoritative full-catalog sync: wipe any deleted or local mockup items not on Supabase
      await db.inventory_items.clear();
      if (rows.length) await db.inventory_items.bulkPut(rows);
    } else {
      const cached = await db.inventory_items.toArray();
      const cashIds = cached.filter(item => String(item.item_type || '').toLowerCase() === 'banknote').map(item => item.id);
      await Promise.all(cashIds.map(id => db.inventory_items.delete(id)));
      if (rows.length) await db.inventory_items.bulkPut(rows);
    }
  } catch { /* Cache failure must not hide confirmed server data. */ }
}

function canonicalFilterKey(prefix, filters = {}) {
  const sortedKeys = Object.keys(filters).sort();
  const parts = [];
  for (const k of sortedKeys) {
    const val = filters[k];
    if (val !== undefined && val !== null && val !== '') {
      if (Array.isArray(val)) {
        parts.push(`${k}=${val.slice().sort().join(',')}`);
      } else {
        parts.push(`${k}=${val}`);
      }
    }
  }
  return `${prefix}:${parts.join('&')}`;
}

/**
 * Reset all in-flight loaders and memory caches on login/logout
 */
export function resetWarehouseAuthSession() {
  currentAuthEpoch++;
  catalogRevision++;
  currentSummaryFlight = null;
  currentCashFlight = null;
  keyedFlights.clear();
  memoryCache.clear();
}

/**
 * Subscribe to auth session change / reset events
 */
export function onWarehouseAuthSessionChange(callback) {
  if (typeof callback === 'function') {
    authSessionSubscribers.add(callback);
    return () => authSessionSubscribers.delete(callback);
  }
  return () => {};
}

/**
 * Single listener for auth state change on Supabase client
 * Guarded optional client auth; no RPC executed inside callback.
 * Filter actual same UID: TOKEN_REFRESHED and window focus SIGNED_IN same user must NOT reset/refetch;
 * changed UID/signed out clear memory/flights.
 */
export function initWarehouseAuthListener() {
  if (authSubscriptionInitialized) return;
  const client = getActiveClient();
  if (client?.auth?.onAuthStateChange) {
    try {
      const { data } = client.auth.onAuthStateChange((event, session) => {
        const newUid = session?.user?.id || null;
        if (newUid && newUid === currentAuthUid && ['TOKEN_REFRESHED', 'SIGNED_IN', 'INITIAL_SESSION'].includes(event)) {
          return;
        }
        currentAuthUid = newUid;
        resetWarehouseAuthSession();
        for (const subscriber of authSessionSubscribers) {
          try {
            subscriber({ event, session, uid: newUid });
          } catch (err) {
            console.error('Error in onWarehouseAuthSessionChange subscriber:', err);
          }
        }
      });
      authSubscriptionInitialized = true;
      return data?.subscription;
    } catch (err) {
      console.warn('Failed to bind warehouse auth state listener:', err);
    }
  }
}

/**
 * Generate a standard UUID v4 for request idempotency
 */
export function generateIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Dispatch a transactional warehouse command to the server RPC
 * Strictly throws on remote failure — NEVER silently falls back to local-only write.
 */
export async function dispatchWarehouseCommand(action, payload, idempotencyKey = null) {
  const epoch = currentAuthEpoch;
  const client = getActiveClient();
  if (!client) {
    throw new Error('Supabase client unavailable. Warehouse operations require confirmed server connectivity.');
  }

  const key = idempotencyKey || generateIdempotencyKey();

  const { data, error } = await client.rpc('warehouse_dispatch', {
    p_action: action,
    p_payload: payload,
    p_idempotency_key: key
  });

  if (epoch !== currentAuthEpoch) {
    throw new Error('Auth session expired or changed during command execution');
  }

  if (error) {
    console.error(`Warehouse RPC dispatch failed [${action}]:`, error);
    throw new Error(error.message || `Failed to execute warehouse action: ${action}`);
  }

  if (!data || !data.success) {
    throw new Error(data?.message || `Warehouse action ${action} failed on server.`);
  }

  catalogRevision++;
  currentSummaryFlight = null;
  currentCashFlight = null;
  memoryCache.clear();
  return data;
}

/**
 * Load warehouse summary projection (Categories, Recipients, Field Rounds, Items, Asset Units, Teams)
 * In-flight deduplication enabled via { epoch, promise } tracking.
 * Warehouse summary is kept COMPLETELY MEMORY-ONLY (zero IndexedDB writes to prevent cross-user leakage).
 * Per-call await and onUpdate callback notification.
 */
export async function loadWarehouseSummary(onUpdate = null, { force = false } = {}) {
  const epoch = currentAuthEpoch;
  if (force) { catalogRevision++; currentSummaryFlight = null; memoryCache.clear(); }
  const revision = catalogRevision;
  const summaryKey = `${epoch}:${revision}:summary`;
  const cached = memoryCache.get(summaryKey);
  if (!force && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    if (typeof onUpdate === 'function') onUpdate(cached.data);
    return cached.data;
  }

  if (!currentSummaryFlight || currentSummaryFlight.epoch !== epoch || currentSummaryFlight.revision !== revision) {
    const flight = { epoch, revision, promise: null };
    flight.promise = (async () => {
      try {
        const client = getActiveClient();
        if (!client) {
          throw new Error('Supabase client unavailable.');
        }

        const { data, error } = await client.rpc('warehouse_get_summary');
        if (error) {
          throw new Error(error.message || 'Failed to fetch warehouse summary');
        }

        if (flight.epoch !== currentAuthEpoch || flight.revision !== catalogRevision) {
          return null;
        }

        if (data && Array.isArray(data.items)) {
          // Exclude any banknotes from catalog items list
          data.items = data.items.filter((it) => String(it.item_type || '').toLowerCase() !== 'banknote');
          await cacheCatalogRows(data.items, Number(data.total_items_count));
          if (flight.epoch !== currentAuthEpoch || flight.revision !== catalogRevision) return null;
          // Seed first stock page cache for default query
          const defaultKey = `${flight.epoch}:${flight.revision}:${canonicalFilterKey('stock', { limit: 50, offset: 0, search: '', item_type: '', category_id: null, color: '', size: '', availability: '' })}`;
          memoryCache.set(defaultKey, {
            data: {
              items: data.items,
              total_count: Number(data.total_items_count) || data.items.length,
              has_more: (Number(data.total_items_count) || data.items.length) > data.items.length,
              limit: 50,
              offset: 0,
              facets: data.facets || {}
            },
            timestamp: Date.now()
          });
        }

        const result = data || {
          schema_version: 2,
          total_items_count: 0,
          total_categories_count: 0,
          categories: [],
          recipients: [],
          rounds: [],
          items: [],
          asset_units: [],
          legacy_borrowed_units: [],
          teams: []
        };
        memoryCache.set(summaryKey, {data: result, timestamp: Date.now()});
        return result;
      } finally {
        if (currentSummaryFlight === flight) {
          currentSummaryFlight = null;
        }
      }
    })();
    currentSummaryFlight = flight;
  }

  const ownFlight = currentSummaryFlight;
  const result = await ownFlight.promise;

  if (result && ownFlight.epoch === currentAuthEpoch && ownFlight.revision === catalogRevision && typeof onUpdate === 'function') {
    try {
      onUpdate(result);
    } catch (err) {
      console.error('Error in loadWarehouseSummary onUpdate callback:', err);
    }
  }

  return ownFlight.epoch === currentAuthEpoch && ownFlight.revision === catalogRevision ? result : null;
}

/**
 * Load Server-Side Paginated Stock (default 50, max 100)
 * Server-filtered: search, item_type, category_id, color, size, availability.
 * In-flight deduplication by canonical filter key + auth epoch, bounded LRU/TTL cache.
 */
export async function loadWarehouseStock(filters = {}, onUpdate = null, { force = false } = {}) {
  const epoch = currentAuthEpoch;
  const revision = catalogRevision;
  const client = getActiveClient();
  if (!client) throw new Error('Supabase client unavailable.');

  const cleanFilters = {
    limit: Math.min(100, Math.max(1, Number(filters.limit) || 50)),
    offset: Math.max(0, Number(filters.offset) || 0),
    search: typeof filters.search === 'string' ? filters.search.trim() : '',
    item_type: typeof filters.item_type === 'string' ? filters.item_type.trim().toLowerCase() : '',
    category_id: filters.category_id || null,
    color: typeof filters.color === 'string' ? filters.color.trim() : '',
    size: typeof filters.size === 'string' ? filters.size.trim() : '',
    status: typeof filters.status === 'string' ? filters.status.trim() : '',
    location: typeof filters.location === 'string' ? filters.location.trim() : '',
    availability: typeof filters.availability === 'string' ? filters.availability.trim().toLowerCase() : '',
    item_ids: Array.isArray(filters.item_ids) ? filters.item_ids : undefined
  };

  const key = `${epoch}:${revision}:${canonicalFilterKey('stock', cleanFilters)}`;

  // Check TTL cache
  const cached = memoryCache.get(key);
  if (!force && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    if (typeof onUpdate === 'function') onUpdate(cached.data);
    return cached.data;
  }

  if (!keyedFlights.has(key)) {
    const p = (async () => {
      try {
        const { data, error } = await client.rpc('warehouse_list_stock', {
          p_filters: cleanFilters
        });
        if (error) throw new Error(error.message || 'Failed to list warehouse stock');
        if (epoch !== currentAuthEpoch || revision !== catalogRevision) return null;

        const result = data || {
          items: [],
          total_count: 0,
          has_more: false,
          limit: cleanFilters.limit,
          offset: cleanFilters.offset
        };

        if (Array.isArray(result.items)) {
          result.items = result.items.filter((it) => String(it.item_type || '').toLowerCase() !== 'banknote');
          const entireCatalog = !cleanFilters.search && !cleanFilters.item_type && !cleanFilters.category_id && !cleanFilters.color && !cleanFilters.size && !cleanFilters.location && !cleanFilters.status && !cleanFilters.availability && !cleanFilters.item_ids;
          await cacheCatalogRows(result.items, entireCatalog ? result.total_count : null);
          if (epoch !== currentAuthEpoch || revision !== catalogRevision) return null;
        }

        // Bounded LRU eviction
        if (memoryCache.size >= MAX_CACHE_SIZE) {
          const firstKey = memoryCache.keys().next().value;
          memoryCache.delete(firstKey);
        }
        memoryCache.set(key, { data: result, timestamp: Date.now() });

        return result;
      } finally {
        keyedFlights.delete(key);
      }
    })();
    keyedFlights.set(key, p);
  }

  const result = await keyedFlights.get(key);
  if (result && epoch === currentAuthEpoch && revision === catalogRevision && typeof onUpdate === 'function') {
    try {
      onUpdate(result);
    } catch (err) {
      console.error('Error in loadWarehouseStock onUpdate callback:', err);
    }
  }

  return epoch === currentAuthEpoch && revision === catalogRevision ? result : null;
}

/**
 * Load Server-Side Serialized Units (default 20, max 50)
 * Look up units by item_id or exact unit_code (joins item for off-page QR lookup)
 */
export async function loadWarehouseUnits(filters = {}, onUpdate = null) {
  const epoch = currentAuthEpoch;
  const client = getActiveClient();
  if (!client) throw new Error('Supabase client unavailable.');

  const cleanFilters = {
    limit: Math.min(50, Math.max(1, Number(filters.limit) || 20)),
    offset: Math.max(0, Number(filters.offset) || 0),
    item_id: filters.item_id || null,
    unit_code: typeof filters.unit_code === 'string' ? filters.unit_code.trim() : '',
    status: typeof filters.status === 'string' ? filters.status.trim().toUpperCase() : '',
    search: typeof filters.search === 'string' ? filters.search.trim() : ''
  };

  const key = `${epoch}:${canonicalFilterKey('units', cleanFilters)}`;

  const cached = memoryCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    if (typeof onUpdate === 'function') onUpdate(cached.data);
    return cached.data;
  }

  if (!keyedFlights.has(key)) {
    const p = (async () => {
      try {
        const { data, error } = await client.rpc('warehouse_list_units', {
          p_filters: cleanFilters
        });
        if (error) throw new Error(error.message || 'Failed to list warehouse units');
        if (epoch !== currentAuthEpoch) return null;

        const result = data || {
          units: [],
          total_count: 0,
          has_more: false,
          limit: cleanFilters.limit,
          offset: cleanFilters.offset
        };

        if (memoryCache.size >= MAX_CACHE_SIZE) {
          const firstKey = memoryCache.keys().next().value;
          memoryCache.delete(firstKey);
        }
        memoryCache.set(key, { data: result, timestamp: Date.now() });

        return result;
      } finally {
        keyedFlights.delete(key);
      }
    })();
    keyedFlights.set(key, p);
  }

  const result = await keyedFlights.get(key);
  if (result && epoch === currentAuthEpoch && typeof onUpdate === 'function') {
    try {
      onUpdate(result);
    } catch (err) {
      console.error('Error in loadWarehouseUnits onUpdate callback:', err);
    }
  }

  return epoch === currentAuthEpoch ? result : null;
}

/**
 * Load Server-Side Paginated Cash List (default 20, max 50)
 * section: 'batches' | 'reservations' | 'prepared' | 'movements'
 */
export async function loadWarehouseCashPage(filters = {}, onUpdate = null) {
  const epoch = currentAuthEpoch;
  const client = getActiveClient();
  if (!client) throw new Error('Supabase client unavailable.');

  const cleanFilters = {
    limit: Math.min(50, Math.max(1, Number(filters.limit) || 20)),
    offset: Math.max(0, Number(filters.offset) || 0),
    section: typeof filters.section === 'string' ? filters.section.trim().toLowerCase() : 'batches',
    project_id: filters.project_id || null
  };

  const key = `${epoch}:${canonicalFilterKey('cash_page', cleanFilters)}`;

  if (!keyedFlights.has(key)) {
    const p = (async () => {
      try {
        const { data, error } = await client.rpc('warehouse_list_cash', {
          p_filters: cleanFilters
        });
        if (error) throw new Error(error.message || 'Failed to list cash pages');
        if (epoch !== currentAuthEpoch) return null;

        return (
          data || {
            section: cleanFilters.section,
            data: [],
            total_count: 0,
            has_more: false,
            limit: cleanFilters.limit,
            offset: cleanFilters.offset
          }
        );
      } finally {
        keyedFlights.delete(key);
      }
    })();
    keyedFlights.set(key, p);
  }

  const result = await keyedFlights.get(key);
  if (result && epoch === currentAuthEpoch && typeof onUpdate === 'function') {
    try {
      onUpdate(result);
    } catch (err) {
      console.error('Error in loadWarehouseCashPage onUpdate callback:', err);
    }
  }

  return epoch === currentAuthEpoch ? result : null;
}

/**
 * Load Server-Side Checklists for Projects (default 20, max 100)
 */
export async function loadWarehouseChecklists(filters = {}, onUpdate = null) {
  const epoch = currentAuthEpoch;
  const client = getActiveClient();
  if (!client) throw new Error('Supabase client unavailable.');

  const cleanFilters = {
    limit: Math.min(100, Math.max(1, Number(filters.limit) || 20)),
    offset: Math.max(0, Number(filters.offset) || 0),
    project_id: filters.project_id || null
  };

  const key = `${epoch}:${canonicalFilterKey('checklists', cleanFilters)}`;

  const cached = memoryCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    if (typeof onUpdate === 'function') onUpdate(cached.data);
    return cached.data;
  }

  if (!keyedFlights.has(key)) {
    const p = (async () => {
      try {
        const { data, error } = await client.rpc('warehouse_get_checklists', {
          p_filters: cleanFilters
        });
        if (error) throw new Error(error.message || 'Failed to fetch warehouse checklists');
        if (epoch !== currentAuthEpoch) return null;

        const result = data || {
          checklists: [],
          total_count: 0,
          has_more: false,
          limit: cleanFilters.limit,
          offset: cleanFilters.offset
        };

        if (memoryCache.size >= MAX_CACHE_SIZE) {
          const firstKey = memoryCache.keys().next().value;
          memoryCache.delete(firstKey);
        }
        memoryCache.set(key, { data: result, timestamp: Date.now() });

        return result;
      } finally {
        keyedFlights.delete(key);
      }
    })();
    keyedFlights.set(key, p);
  }

  const result = await keyedFlights.get(key);
  if (result && epoch === currentAuthEpoch && typeof onUpdate === 'function') {
    try {
      onUpdate(result);
    } catch (err) {
      console.error('Error in loadWarehouseChecklists onUpdate callback:', err);
    }
  }

  return epoch === currentAuthEpoch ? result : null;
}

/**
 * Load Cash Vault & Reservation Summary (Strictly server-verified RBAC)
 * KEPT COMPLETELY OFF IndexedDB in memory only.
 * In-flight deduplication enabled via { epoch, revision, promise } tracking + 30s memoryCache.
 * Per-call await and onUpdate callback notification.
 */
export async function loadCashSummary(onUpdate = null, { force = false } = {}) {
  const epoch = currentAuthEpoch;
  if (force) {
    currentCashFlight = null;
  }
  const revision = catalogRevision;
  const cashKey = `${epoch}:${revision}:cash_summary`;
  const cached = memoryCache.get(cashKey);
  if (!force && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    if (typeof onUpdate === 'function') onUpdate(cached.data);
    return cached.data;
  }

  if (!currentCashFlight || currentCashFlight.epoch !== epoch || currentCashFlight.revision !== revision) {
    const flight = { epoch, revision, promise: null };
    flight.promise = (async () => {
      try {
        const client = getActiveClient();
        if (!client) {
          throw new Error('Supabase client unavailable.');
        }

        const { data, error } = await client.rpc('warehouse_get_cash_summary');
        if (error) {
          throw new Error(error.message || 'Failed to fetch cash vault summary');
        }

        if (flight.epoch !== currentAuthEpoch || flight.revision !== catalogRevision) {
          return null;
        }

        const result = data || {
          denominations: [],
          reservations: [],
          helper_batches: [],
          prepared_sets: [],
          legacy_banknotes: []
        };

        if (memoryCache.size >= MAX_CACHE_SIZE) {
          const firstKey = memoryCache.keys().next().value;
          memoryCache.delete(firstKey);
        }
        memoryCache.set(cashKey, { data: result, timestamp: Date.now() });
        return result;
      } finally {
        if (currentCashFlight === flight) {
          currentCashFlight = null;
        }
      }
    })();
    currentCashFlight = flight;
  }

  const ownFlight = currentCashFlight;
  const result = await ownFlight.promise;

  if (result && ownFlight.epoch === currentAuthEpoch && ownFlight.revision === catalogRevision && typeof onUpdate === 'function') {
    try {
      onUpdate(result);
    } catch (err) {
      console.error('Error in loadCashSummary onUpdate callback:', err);
    }
  }

  return ownFlight.epoch === currentAuthEpoch && ownFlight.revision === catalogRevision ? result : null;
}

/**
 * Load Paginated History (default 20, max 50) with 30s memoryCache keyed by sessionEpoch & catalogRevision
 */
export async function loadWarehouseHistory(
  { projectId = null, limit = 20, offset = 0, includeCash = true, docType = null } = {},
  { force = false } = {}
) {
  const epoch = currentAuthEpoch;
  const revision = catalogRevision;
  const client = getActiveClient();
  if (!client) throw new Error('Supabase client unavailable.');

  const boundedLimit = Math.min(50, Math.max(1, Number(limit) || 20));
  const cleanFilters = {
    project_id: projectId,
    limit: boundedLimit,
    offset: Math.max(0, Number(offset) || 0),
    include_cash: includeCash,
    ...(docType ? { doc_type: docType } : {})
  };
  const key = `${epoch}:${revision}:${canonicalFilterKey('history', cleanFilters)}`;

  const cached = memoryCache.get(key);
  if (!force && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  if (!keyedFlights.has(key)) {
    const p = (async () => {
      try {
        const { data, error } = await client.rpc('warehouse_get_history', {
          p_filters: cleanFilters
        });
        if (error) throw new Error(error.message || 'Failed to fetch warehouse history');
        if (epoch !== currentAuthEpoch) throw new Error('Auth session changed during history request');

        const result = data || { documents: [], movements: [], cash_movements: [] };
        if (epoch === currentAuthEpoch && revision === catalogRevision) {
          if (memoryCache.size >= MAX_CACHE_SIZE) {
            const firstKey = memoryCache.keys().next().value;
            memoryCache.delete(firstKey);
          }
          memoryCache.set(key, { data: result, timestamp: Date.now() });
        }
        return result;
      } finally {
        keyedFlights.delete(key);
      }
    })();
    keyedFlights.set(key, p);
  }

  return await keyedFlights.get(key);
}

/**
 * Load Operational Read Projection (Outstanding Issue Lines, Pending Recoveries, Active Custodies, Incidents)
 * Used by UI for selecting return source movement, inspecting recovery lots, and monitoring custody.
 * Cached for 30s keyed by sessionEpoch & catalogRevision.
 */
export async function loadWarehouseOperations(
  {
    projectId = null,
    roundId = null,
    limit = 20,
    offset = 0,
    section = null
  } = {},
  { force = false } = {}
) {
  const epoch = currentAuthEpoch;
  const revision = catalogRevision;
  const client = getActiveClient();
  if (!client) throw new Error('Supabase client unavailable.');

  const cleanFilters = {
    project_id: projectId,
    round_id: roundId,
    section,
    limit: Math.min(50, Math.max(1, Number(limit) || 20)),
    offset
  };
  const key = `${epoch}:${revision}:${canonicalFilterKey('operations', cleanFilters)}`;

  const cached = memoryCache.get(key);
  if (!force && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  if (!keyedFlights.has(key)) {
    const p = (async () => {
      try {
        const { data, error } = await client.rpc('warehouse_get_operations', {
          p_filters: cleanFilters
        });
        if (epoch !== currentAuthEpoch || revision !== catalogRevision) return null;
        if (error) throw new Error(error.message || 'Failed to fetch warehouse operations');

        const result = data || {
          issue_lines: [],
          recoveries: [],
          custodies: [],
          incidents: [],
          has_more: false
        };

        if (memoryCache.size >= MAX_CACHE_SIZE) {
          const firstKey = memoryCache.keys().next().value;
          memoryCache.delete(firstKey);
        }
        memoryCache.set(key, { data: result, timestamp: Date.now() });
        return result;
      } finally {
        keyedFlights.delete(key);
      }
    })();
    keyedFlights.set(key, p);
  }

  const result = await keyedFlights.get(key);
  return epoch === currentAuthEpoch && revision === catalogRevision ? result : null;
}

/**
 * Subscribe to Supabase Realtime on public.inventory_documents (debounced 500ms)
 * Invalidates warehouse read caches so stock/tool borrows/returns on Device A reflect live on Device B.
 */
export function subscribeWarehouseInventoryDocuments(onChange, { debounceMs = 500 } = {}) {
  const client = getActiveClient();
  if (!client || typeof client.channel !== 'function') {
    return () => {};
  }

  let debounceTimer = null;
  const channelName = `warehouse-inventory-documents-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const channel = client
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'inventory_documents' },
      () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          catalogRevision++;
          currentSummaryFlight = null;
          currentCashFlight = null;
          memoryCache.clear();
          if (typeof onChange === 'function') {
            onChange();
          }
        }, debounceMs);
      }
    )
    .subscribe();

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    try {
      if (typeof client.removeChannel === 'function') {
        client.removeChannel(channel);
      } else if (typeof channel.unsubscribe === 'function') {
        channel.unsubscribe();
      }
    } catch {
      // Ignore cleanup errors
    }
  };
}

// =============================================================================
// ATOMIC MIXED ISSUE (Cart with materials and tools in ONE transaction)
// =============================================================================

export async function createIssue({
  issueType = 'PRODUCTION_ISSUE',
  projectId = null,
  projectIds = [],
  roundId = null,
  roundCode = null,
  roundTitle = null,
  recipientId = null,
  recipientName,
  teamMembers = [],
  dueDate = null,
  expectedReturnAt = null,
  materialLines = [],
  toolUnits = [],
  notes = '',
  idempotencyKey = null
}) {
  const finalDueDate = dueDate || expectedReturnAt || null;

  return await dispatchWarehouseCommand('issue_create', {
    issue_type: issueType,
    project_id: projectId,
    project_ids: projectIds,
    round_id: roundId,
    round_code: roundCode,
    round_title: roundTitle,
    recipient_id: recipientId,
    recipient_name: recipientName,
    team_members: teamMembers,
    due_date: finalDueDate,
    expected_return_at: finalDueDate,
    material_lines: materialLines.map(m => ({
      item_id: m.item_id || m.id,
      quantity: Number(m.quantity)
    })),
    tool_units: toolUnits,
    notes
  }, idempotencyKey);
}

export async function issueMaterials({ projectId, recipientId = null, recipientName, items, notes = '', idempotencyKey = null }) {
  return await createIssue({
    issueType: 'PRODUCTION_ISSUE',
    projectId,
    recipientId,
    recipientName,
    materialLines: items,
    notes,
    idempotencyKey
  });
}

// =============================================================================
// MATERIAL RETURNS & RECOVERIES
// =============================================================================

export async function returnUnusedMaterials({ projectId = null, recipientName = '', items, notes = '', idempotencyKey = null }) {
  return await dispatchWarehouseCommand('material_return_unused', {
    project_id: projectId,
    recipient_name: recipientName,
    items: items.map(it => ({
      source_issue_movement_id: it.source_issue_movement_id,
      item_id: it.item_id || it.id,
      quantity: Number(it.quantity)
    })),
    notes
  }, idempotencyKey);
}

export async function recoverMaterials({ projectId, recipientName = '', items, notes = '', idempotencyKey = null }) {
  return await dispatchWarehouseCommand('material_recovery', {
    project_id: projectId,
    recipient_name: recipientName,
    items: items.map(it => ({
      source_issue_movement_id: it.source_issue_movement_id || null,
      item_id: it.item_id || it.id,
      recovered_qty: Number(it.recovered_qty),
      inspect_now: Boolean(it.inspect_now),
      good_qty: it.good_qty !== undefined ? Number(it.good_qty) : Number(it.recovered_qty),
      damaged_qty: it.damaged_qty !== undefined ? Number(it.damaged_qty) : 0,
      notes: it.notes || ''
    })),
    notes
  }, idempotencyKey);
}

export async function inspectRecovery({ recoveryId, goodQty, damagedQty = 0, idempotencyKey = null }) {
  return await dispatchWarehouseCommand('material_inspect_recovery', {
    recovery_id: recoveryId,
    good_qty: Number(goodQty),
    damaged_qty: Number(damagedQty)
  }, idempotencyKey);
}

// =============================================================================
// TOOL UNIT CUSTODY & HANDOVER
// =============================================================================

export async function borrowTools({
  projectId = null,
  roundId = null,
  recipientId = null,
  recipientName,
  unitCodes,
  dueDate = null,
  expectedReturnAt = null,
  notes = '',
  idempotencyKey = null
}) {
  return await createIssue({
    issueType: roundId ? 'FIELD_ISSUE' : 'PRODUCTION_ISSUE',
    projectId,
    roundId,
    recipientId,
    recipientName,
    dueDate,
    expectedReturnAt,
    toolUnits: unitCodes,
    notes,
    idempotencyKey
  });
}

export async function returnTools({ returns, idempotencyKey = null }) {
  return await dispatchWarehouseCommand('tool_return', {
    returns: returns.map(r => ({
      unit_code: r.unit_code,
      condition: r.condition || 'good',
      notes: r.notes || ''
    }))
  }, idempotencyKey);
}

export async function handoverTools({
  unitCodes,
  toRecipientId = null,
  toRecipientName,
  accepted = true,
  notes = '',
  idempotencyKey = null
}) {
  return await dispatchWarehouseCommand('tool_handover', {
    unit_codes: unitCodes,
    to_recipient_id: toRecipientId,
    to_recipient_name: toRecipientName.trim(),
    accepted: Boolean(accepted),
    notes
  }, idempotencyKey);
}

export async function adoptOrReturnLegacyTool({ unitCode, action = 'return_available', idempotencyKey = null }) {
  return await dispatchWarehouseCommand('tool_legacy_adopt_or_return', {
    unit_code: unitCode,
    action
  }, idempotencyKey);
}

// =============================================================================
// FIELD INSTALLATION ROUNDS
// =============================================================================

export async function createFieldRound({
  roundCode,
  title,
  recipientId = null,
  recipientName,
  teamMembers = [],
  projectIds = [],
  unitCodes = [],
  expectedReturnAt = null,
  notes = '',
  idempotencyKey = null
}) {
  return await createIssue({
    issueType: 'FIELD_ISSUE',
    roundCode,
    roundTitle: title,
    recipientId,
    recipientName,
    teamMembers,
    projectIds,
    toolUnits: unitCodes,
    dueDate: expectedReturnAt,
    expectedReturnAt,
    notes,
    idempotencyKey
  });
}

// =============================================================================
// CATEGORIES, ITEMS, & UNITS (Memory-only, no local IndexedDB cache)
// =============================================================================

export async function createCategory({ name, type, is_active = true, idempotencyKey = null }) {
  const normType = normalizeItemType(type);
  const res = await dispatchWarehouseCommand('category_create', {
    name: String(name || '').trim(),
    type: normType,
    is_active
  }, idempotencyKey);
  return res.data;
}

export async function renameCategory(id, name, idempotencyKey = null) {
  const res = await dispatchWarehouseCommand('category_rename', {
    id,
    name: String(name || '').trim()
  }, idempotencyKey);
  return res.data;
}

export async function retireCategory(id, is_active = false, idempotencyKey = null) {
  const res = await dispatchWarehouseCommand('category_retire', {
    id,
    is_active
  }, idempotencyKey);
  return res.data;
}

export async function createItem({
  code,
  name,
  categoryId = null,
  itemType = 'consumable',
  unit = 'ชิ้น',
  minAlertThreshold = 0,
  averageCost = 0,
  storageLocation = '',
  color = '',
  size = '',
  initialStock = 0,
  openingStockReason = '',
  imageUrl,
  idempotencyKey = null
}) {
  return await dispatchWarehouseCommand('item_create', {
    code,
    name,
    category_id: categoryId,
    item_type: normalizeItemType(itemType),
    unit,
    min_alert_threshold: minAlertThreshold,
    average_cost: averageCost,
    storage_location: storageLocation,
    color,
    size,
    initial_stock: initialStock,
    opening_stock_reason: openingStockReason,
    ...(imageUrl !== undefined ? {image_url: imageUrl} : {})
  }, idempotencyKey);
}

export async function saveItemMetadata({
  id,
  name,
  categoryId = null,
  itemType,
  unit,
  minAlertThreshold,
  averageCost,
  storageLocation,
  color,
  size,
  imageUrl,
  idempotencyKey = null
}) {
  return await dispatchWarehouseCommand('item_save_metadata', {
    id,
    name,
    category_id: categoryId,
    item_type: itemType ? normalizeItemType(itemType) : undefined,
    unit,
    min_alert_threshold: minAlertThreshold,
    average_cost: averageCost,
    storage_location: storageLocation,
    color,
    size,
    ...(imageUrl !== undefined ? {image_url: imageUrl} : {})
  }, idempotencyKey);
}

export async function adjustStock({ itemId, deltaQuantity, reason, idempotencyKey = null }) {
  return await dispatchWarehouseCommand('stock_adjust', {
    item_id: itemId,
    delta_quantity: Number(deltaQuantity),
    reason
  }, idempotencyKey);
}

export async function addAssetUnit({ itemId, unitCode, notes = '', idempotencyKey = null }) {
  return await dispatchWarehouseCommand('unit_add', {
    item_id: itemId,
    unit_code: unitCode,
    notes
  }, idempotencyKey);
}

// =============================================================================
// RECIPIENTS & TEAMS
// =============================================================================

export async function createRecipient({ name, recipientType = 'individual', contactInfo = '', is_active = true, idempotencyKey = null }) {
  return await dispatchWarehouseCommand('recipient_create', {
    name,
    recipient_type: recipientType,
    contact_info: contactInfo,
    is_active
  }, idempotencyKey);
}

export async function updateRecipient({ id, name, recipientType, contactInfo, is_active, idempotencyKey = null }) {
  return await dispatchWarehouseCommand('recipient_update', {
    id,
    name,
    recipient_type: recipientType,
    contact_info: contactInfo,
    is_active
  }, idempotencyKey);
}

export async function createTeam({ name, primaryReceiverName, memberNames = [], idempotencyKey = null }) {
  return await dispatchWarehouseCommand('team_create', {
    name,
    primary_receiver_name: primaryReceiverName,
    member_names: memberNames
  }, idempotencyKey);
}

// =============================================================================
// CASH OPERATIONS (STRICT SERVER-VERIFIED RBAC)
// =============================================================================

export async function depositCash({ denomination, noteCount, notes = '', idempotencyKey = null }) {
  if (!isValidDenomination(denomination)) {
    throw new Error(`Invalid banknote denomination: ${denomination}`);
  }
  return await dispatchWarehouseCommand('cash_deposit', {
    denomination: Number(denomination),
    note_count: Number(noteCount),
    notes
  }, idempotencyKey);
}

export async function recordCountedOpeningCash({ counts, notes = '', idempotencyKey = null }) {
  return await dispatchWarehouseCommand('cash_counted_opening', {
    counts: counts.map(c => ({
      denomination: Number(c.denomination),
      note_count: Number(c.note_count)
    })),
    notes
  }, idempotencyKey);
}

export async function reserveCash({ projectId, denomination, noteCount, notes = '', idempotencyKey = null }) {
  return await dispatchWarehouseCommand('cash_reserve', {
    project_id: projectId,
    denomination: Number(denomination),
    note_count: Number(noteCount),
    notes
  }, idempotencyKey);
}

export async function releaseCashReservation({ projectId, denomination, noteCount, notes = '', idempotencyKey = null }) {
  return await dispatchWarehouseCommand('cash_release_reservation', {
    project_id: projectId,
    denomination: Number(denomination),
    note_count: Number(noteCount),
    notes
  }, idempotencyKey);
}

export async function issueCashBatch({
  projectId,
  recipientId = null,
  recipientName,
  denomination,
  noteCount,
  useReservation = false,
  notes = '',
  idempotencyKey = null
}) {
  return await dispatchWarehouseCommand('cash_issue_batch', {
    project_id: projectId,
    recipient_id: recipientId,
    recipient_name: recipientName,
    denomination: Number(denomination),
    note_count: Number(noteCount),
    use_reservation: Boolean(useReservation),
    notes
  }, idempotencyKey);
}

export async function receivePreparedCash({ batchId, noteCount, notes = '', idempotencyKey = null }) {
  return await dispatchWarehouseCommand('cash_receive_prepared', {
    batch_id: batchId,
    note_count: Number(noteCount),
    notes
  }, idempotencyKey);
}

export async function returnUnusedRawCash({ batchId, noteCount, keepReservation = true, notes = '', idempotencyKey = null }) {
  return await dispatchWarehouseCommand('cash_return_unused_raw', {
    batch_id: batchId,
    note_count: Number(noteCount),
    keep_reservation: Boolean(keepReservation),
    notes
  }, idempotencyKey);
}

export async function handoverCashBatch({
  batchId,
  toRecipientId = null,
  toRecipientName,
  noteCount,
  accepted = false,
  notes = '',
  idempotencyKey = null
}) {
  return await dispatchWarehouseCommand('cash_handover_batch', {
    batch_id: batchId,
    to_recipient_id: toRecipientId,
    to_recipient_name: toRecipientName,
    note_count: Number(noteCount),
    accepted: Boolean(accepted),
    notes
  }, idempotencyKey);
}

export async function deliverCashToCustomer({ projectId, denomination, noteCount, notes = '', idempotencyKey = null }) {
  return await dispatchWarehouseCommand('cash_deliver_to_customer', {
    project_id: projectId,
    denomination: Number(denomination),
    note_count: Number(noteCount),
    notes
  }, idempotencyKey);
}

export async function updateCashThresholds({ denomination, lowAlertThreshold, targetAvailableCount, idempotencyKey = null }) {
  return await dispatchWarehouseCommand('cash_update_thresholds', {
    denomination: Number(denomination),
    low_alert_threshold: lowAlertThreshold,
    target_available_count: targetAvailableCount
  }, idempotencyKey);
}

export async function adjustCashCount({ denomination, deltaCount, reason, idempotencyKey = null }) {
  if (!isValidDenomination(denomination)) {
    throw new Error(`Invalid banknote denomination: ${denomination}`);
  }
  return await dispatchWarehouseCommand('cash_adjust_count', {
    denomination: Number(denomination),
    delta_count: Number(deltaCount),
    reason
  }, idempotencyKey);
}
