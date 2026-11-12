import { resetProductionSession } from '../services/productionService.js';
import { useState, useEffect, useRef, useCallback } from 'react';
import * as warehouseService from '../services/warehouseService.js';
import { db } from '../services/db.js';

/**
 * useWarehouseData Hook
 * Central state and lifecycle controller for Plan C Inventory.
 * Provides active-page gating, in-flight deduplication, authoritative empty cloud state,
 * zero IDB cash leakage, and operations tracking.
 */
export function useWarehouseData({
  isActive = true,
  inventoryItemsProp = [],
  assetLoansProp = [],
  activitiesProp = [],
  userProfile = null,
  activeMainTab = 'stock' // 'stock' | 'flows' | 'cash' | 'history'
}) {
  // Stable refs for props to prevent effect trigger loops on parent array re-renders
  const inventoryItemsPropRef = useRef(inventoryItemsProp);
  inventoryItemsPropRef.current = inventoryItemsProp;

  const assetLoansPropRef = useRef(assetLoansProp);
  assetLoansPropRef.current = assetLoansProp;

  const activitiesPropRef = useRef(activitiesProp);
  activitiesPropRef.current = activitiesProp;

  // Primitive auth identity (supporting username, id, staffCode, and staff_code)
  const authUserId = userProfile?.username || userProfile?.id || userProfile?.staffCode || userProfile?.staff_code || null;
  const authUserRole = userProfile?.role || null;

  // Strictly server-aligned role hint (server remains the ultimate enforcer)
  // Fail-closed: No profile => false (deny)
  const isPrivilegedCashUser = Boolean(
    userProfile && (
      authUserRole === 'admin' ||
      authUserRole === 'accountant' ||
      userProfile.can_manage_cash === true
    )
  );

  // Core warehouse projections
  const [items, setItems] = useState([]);
  const [stockPage, setStockPage] = useState(null);
  const [summaryCounts, setSummaryCounts] = useState({});
  const [capabilities, setCapabilities] = useState({});
  const [categories, setCategories] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [assetUnits, setAssetUnits] = useState([]);
  const [legacyBorrowedUnits, setLegacyBorrowedUnits] = useState([]);
  const [checklistItems, setChecklistItems] = useState([]);

  // Operations state (active issue lines, recoveries, custodies, incidents)
  const [operations, setOperations] = useState({
    issue_lines: [],
    recoveries: [],
    custodies: [],
    incidents: [],
    has_more: false
  });
  const [isOperationsLoading, setIsOperationsLoading] = useState(false);

  // Cash state (STRICTLY memory-only, never persisted in localStorage or IndexedDB)
  const [cashSummary, setCashSummary] = useState(null);
  const [isCashLoading, setIsCashLoading] = useState(false);
  const [cashError, setCashError] = useState(null);
  const [cashErrorType, setCashErrorType] = useState(null); // 'permission' | 'migration' | 'network'

  // Loading & Error States
  const [isLoading, setIsLoading] = useState(true);
  const [summaryError, setSummaryError] = useState(null);
  const [isMigrationRequired, setIsMigrationRequired] = useState(false);
  const [isStaleFallback, setIsStaleFallback] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [authSessionVersion, setAuthSessionVersion] = useState(0);

  // Subscribe to external auth session changes (logout / user switch)
  useEffect(() => {
    if (typeof warehouseService.initWarehouseAuthListener === 'function') {
      warehouseService.initWarehouseAuthListener();
    }
    if (typeof warehouseService.onWarehouseAuthSessionChange === 'function') {
      const unsub = warehouseService.onWarehouseAuthSessionChange(() => {
        resetProductionSession();
        // Clear sensitive cash state from memory and cancel in-flight queries
        setItems([]); setCategories([]); setRecipients([]); setRounds([]);
        setAssetUnits([]); setLegacyBorrowedUnits([]); setChecklistItems([]);
        setStockPage(null); setSummaryCounts({}); setCapabilities({});
        setOperations({issue_lines: [], recoveries: [], custodies: [], incidents: [], has_more: false});
        setIsOperationsLoading(false);
        hasInitializedSummaryRef.current = false;
        lastSummaryLoadedAtRef.current = 0;
        setCashSummary(null);
        setCashError(null);
        setCashErrorType(null);
        setIsCashLoading(false);
        currentSummaryTokenRef.current += 1;
        currentCashTokenRef.current += 1;
        currentOperationsTokenRef.current += 1;
        // Invalidate state to trigger React effect reload cleanly (no RPC inside auth callback)
        setAuthSessionVersion((v) => v + 1);
      });
      return () => {
        if (typeof unsub === 'function') unsub();
      };
    }
  }, []);

  // Request & Token guards to prevent unmount / race condition leaks
  const isMountedRef = useRef(true);
  const currentSummaryTokenRef = useRef(0);
  const currentCashTokenRef = useRef(0);
  const currentOperationsTokenRef = useRef(0);
  const hasInitializedSummaryRef = useRef(false);
  const lastSummaryLoadedAtRef = useRef(0);

  /**
   * Safe read-only fallback when Supabase RPCs are missing or network is down.
   * Strictly reads real local IndexedDB cache or initial props — NO fake demo categories!
   */
  const loadFallbackData = useCallback(async () => {
    let localCategories = [];
    let localRecipients = [];
    let localRounds = [];
    let localItems = [];
    let localUnits = [];

    try {
      if (db?.inventory_categories) {
        localCategories = await db.inventory_categories.toArray().catch(() => []);
      }
      if (db?.inventory_recipients) {
        localRecipients = await db.inventory_recipients.toArray().catch(() => []);
      }
      if (db?.inventory_field_rounds) {
        localRounds = await db.inventory_field_rounds.toArray().catch(() => []);
      }
      if (db?.inventory_items) {
        localItems = await db.inventory_items.toArray().catch(() => []);
      }
      if (db?.asset_units) {
        localUnits = await db.asset_units.toArray().catch(() => []);
      }
    } catch {
      // Ignore IDB errors
    }

    if (!isMountedRef.current) return;

    // Use IDB items or legacy prop items as read-only fallback
    const resolvedItems = localItems.length > 0 ? localItems : (inventoryItemsPropRef.current || []);
    const noncash = resolvedItems.filter(it => String(it.item_type || '').toLowerCase() !== 'banknote');
    setItems(noncash);
    setCategories(localCategories);
    setRecipients(localRecipients);
    setRounds(localRounds);
    setAssetUnits(localUnits);
    setIsStaleFallback(true);
  }, []);

  /**
   * Load core warehouse summary projection with deduplication and migration gate
   */
  const fetchSummary = useCallback(async (isManualRefresh = false) => {
    if (!isActive) return;
    if (!isManualRefresh && hasInitializedSummaryRef.current && Date.now() - lastSummaryLoadedAtRef.current < 30000) return;

    const token = ++currentSummaryTokenRef.current;
    if (!hasInitializedSummaryRef.current || isManualRefresh) {
      setIsLoading(true);
    }
    setSummaryError(null);

    try {
      const result = await warehouseService.loadWarehouseSummary(null, {force: isManualRefresh});

      if (!isMountedRef.current || token !== currentSummaryTokenRef.current) return;

      if (result && Number(result.schema_version) !== 2) {
        throw new Error('warehouse_get_summary requires compact schema_version 2');
      }
      if (result) {
        setCapabilities(result.capabilities || {});
        // Authoritative: If cloud returns items: [], it means 0 items exist (do not resurrect deleted stock!)
        if (!hasInitializedSummaryRef.current) {
          setItems(Array.isArray(result.items) ? result.items : []);
          setStockPage({items: result.items || [], total_count: Number(result.total_items_count) || 0, offset: 0, limit: 50, has_more: Number(result.total_items_count) > (result.items || []).length, facets: result.facets || {}});
        }
        setSummaryCounts(result.counts || {pending_recoveries: result.pending_recoveries ?? result.pending_recovery_count, borrowed_tools: result.borrowed_tools});
        setCategories(Array.isArray(result.categories) ? result.categories : []);
        setRecipients(Array.isArray(result.recipients) ? result.recipients : []);
        setRounds(Array.isArray(result.rounds) ? result.rounds : []);
        if (!hasInitializedSummaryRef.current || isManualRefresh) setAssetUnits(Array.isArray(result.asset_units) ? result.asset_units : []);
        setLegacyBorrowedUnits(Array.isArray(result.legacy_borrowed_units) ? result.legacy_borrowed_units : []);

        setIsMigrationRequired(false);
        setIsStaleFallback(false);
      }
      hasInitializedSummaryRef.current = true;
      lastSummaryLoadedAtRef.current = Date.now();
      setLastRefreshedAt(new Date());
    } catch (err) {
      if (!isMountedRef.current || token !== currentSummaryTokenRef.current) return;
      console.warn('Warehouse summary load failed, evaluating migration gate:', err);

      const errMessage = String(err?.message || '');
      const isMissingRpc = (
        errMessage.includes('warehouse_get_summary') ||
        (errMessage.includes('function') && errMessage.includes('does not exist')) ||
        errMessage.includes('42883') ||
        errMessage.includes('42P01') ||
        errMessage.includes('PGRST202')
      );

      if (isMissingRpc) {
        setIsMigrationRequired(true);
        setSummaryError('ต้องติดตั้ง inventory_compact.sql รุ่นใหม่ก่อนใช้งาน ข้อมูลแคชเปิดอ่านได้เท่านั้น');
      } else {
        setSummaryError(errMessage || 'ไม่สามารถโหลดข้อมูลคลังสินค้าจากเซิร์ฟเวอร์ได้');
      }

      // Safe local-first read-only fallback
      setCapabilities({});
      await loadFallbackData();
    } finally {
      if (isMountedRef.current && token === currentSummaryTokenRef.current) {
        setIsLoading(false);
      }
    }
  }, [isActive, loadFallbackData]);

  /**
   * Load operations (issue lines, recoveries, custodies, incidents)
   * Follows the Coordinator-defined contract.
   */
  const fetchOperations = useCallback(async ({ projectId = null, roundId = null, limit = 20, offset = 0 } = {}) => {
    if (!isActive) return;

    const token = ++currentOperationsTokenRef.current;
    setIsOperationsLoading(true);

    try {
      if (typeof warehouseService.loadWarehouseOperations === 'function') {
        const data = await warehouseService.loadWarehouseOperations({ projectId, roundId, limit, offset });
        if (!isMountedRef.current || token !== currentOperationsTokenRef.current) return;
        setOperations(data || { issue_lines: [], recoveries: [], custodies: [], incidents: [], has_more: false });
      } else {
        // Forward-compatible fallback when backend is still deploying loadWarehouseOperations
        if (!isMountedRef.current || token !== currentOperationsTokenRef.current) return;
        setOperations({ issue_lines: [], recoveries: [], custodies: [], incidents: [], has_more: false });
      }
    } catch (err) {
      if (!isMountedRef.current || token !== currentOperationsTokenRef.current) return;
      console.warn('Operations load notice:', err);
    } finally {
      if (isMountedRef.current && token === currentOperationsTokenRef.current) {
        setIsOperationsLoading(false);
      }
    }
  }, [isActive]);

  /**
   * Load Cash Summary (STRICT SERVER-VERIFIED RBAC)
   * Only called when activeMainTab === 'cash' AND user is privileged.
   */
  const fetchCash = useCallback(async () => {
    if (!isActive || activeMainTab !== 'cash') return;

    if (!isPrivilegedCashUser) {
      setCashError('คุณไม่มีสิทธิ์เข้าถึงข้อมูลเงินสด (จำกัดเฉพาะบทบาทผู้ดูแลระบบและฝ่ายบัญชี)');
      setCashErrorType('permission');
      setCashSummary(null);
      return;
    }

    const token = ++currentCashTokenRef.current;
    setIsCashLoading(true);
    setCashError(null);
    setCashErrorType(null);

    try {
      const data = await warehouseService.loadCashSummary();
      if (!isMountedRef.current || token !== currentCashTokenRef.current) return;

      setCashSummary(data || {
        denominations: [],
        reservations: [],
        helper_batches: [],
        prepared_sets: []
      });
    } catch (err) {
      if (!isMountedRef.current || token !== currentCashTokenRef.current) return;
      const errMessage = String(err?.message || '');

      if (errMessage.includes('permission') || errMessage.includes('42501') || errMessage.includes('Unauthorized')) {
        setCashError('เซิร์ฟเวอร์ปฏิเสธการเข้าถึง: คุณไม่มีสิทธิ์จัดการเงินสดตามนโยบายความปลอดภัย');
        setCashErrorType('permission');
      } else if (errMessage.includes('warehouse_get_cash_summary') || errMessage.includes('42883')) {
        setCashError('ระบบเงินสดยังไม่ได้ติดตั้งบนฐานข้อมูล Supabase');
        setCashErrorType('migration');
      } else {
        setCashError(errMessage || 'เกิดข้อผิดพลาดในการโหลดข้อมูลเงินสด');
        setCashErrorType('network');
      }
      setCashSummary(null);
    } finally {
      if (isMountedRef.current && token === currentCashTokenRef.current) {
        setIsCashLoading(false);
      }
    }
  }, [isActive, activeMainTab, isPrivilegedCashUser]);

  // Initial and active-page gated effect (depends ONLY on primitive isActive, authUserId, and authSessionVersion)
  useEffect(() => {
    isMountedRef.current = true;
    const tokenRef = currentSummaryTokenRef;
    if (isActive) {
      fetchSummary(false);
    }
    return () => {
      // Invalidate current summary token on unmount or tab change
      tokenRef.current += 1;
    };
  }, [isActive, authUserId, authSessionVersion, fetchSummary]);

  // Operations fetch effect when entering 'flows' or 'history'
  useEffect(() => {
    if (isActive && (activeMainTab === 'flows')) {
      fetchOperations();
    }
  }, [isActive, activeMainTab, authUserId, authSessionVersion, fetchOperations]);

  // Cash loading & immediate clearance effect
  useEffect(() => {
    if (isActive && activeMainTab === 'cash' && isPrivilegedCashUser) {
      fetchCash();
    } else {
      // Immediately clear sensitive cash state from memory on tab deactivation or role change
      setCashSummary(null);
      setCashError(null);
      setCashErrorType(null);
      setIsCashLoading(false);
      currentCashTokenRef.current++;
    }
  }, [isActive, activeMainTab, isPrivilegedCashUser, authUserId, authSessionVersion, fetchCash]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Compute pending recoveries count from actual operations
  const pendingRecoveryCount = summaryCounts.pending_recoveries ?? (operations.recoveries || []).filter(
    r => r.status === 'PENDING' || r.inspect_now === false
  ).length;
  const refreshSummary = useCallback(() => fetchSummary(true), [fetchSummary]);

  return {
    items,
    stockPage,
    borrowedToolCount: summaryCounts.borrowed_tools,
    setStockPage,
    setItems,
    capabilities,
    categories,
    setCategories,
    recipients,
    setRecipients,
    rounds,
    setRounds,
    assetUnits,
    setAssetUnits,
    legacyBorrowedUnits,
    setLegacyBorrowedUnits,
    checklistItems,
    setChecklistItems,
    operations,
    isOperationsLoading,
    pendingRecoveryCount,
    cashSummary,
    isCashLoading,
    cashError,
    cashErrorType,
    isLoading,
    summaryError,
    isMigrationRequired,
    isStaleFallback,
    lastRefreshedAt,
    isPrivilegedCashUser,
    refreshSummary,
    refreshCash: fetchCash,
    refreshOperations: fetchOperations
  };
}
