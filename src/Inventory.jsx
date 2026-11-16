import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense, lazy } from 'react';
import {
  Boxes,
  Banknote,
  Clock,
  Plus,
  RefreshCw,
  Printer,
  QrCode,
  Package,
  Layers,
  Wrench,
  AlertTriangle,
  RotateCcw,
  ShoppingBag
} from 'lucide-react';
import {
  createIssue,
  createItem,
  saveItemMetadata,
  adjustStock,
  addAssetUnit,
  createRecipient,
  createTeam,
  returnTools,
  handoverTools,
  adoptOrReturnLegacyTool,
  returnUnusedMaterials,
  recoverMaterials,
  inspectRecovery,
  depositCash,
  recordCountedOpeningCash,
  reserveCash,
  releaseCashReservation,
  updateCashThresholds,
  issueCashBatch,
  handoverCashBatch,
  receivePreparedCash,
  returnUnusedRawCash,
  deliverCashToCustomer,
  createCategory,
  renameCategory,
  retireCategory,
  loadWarehouseStock,
  loadWarehouseUnits
} from './services/warehouseService.js';
import { useWarehouseData } from './hooks/useWarehouseData.js';
import { useStickyFilter } from './hooks/useStickyFilter';
import InventoryHeader from './components/inventory/InventoryHeader.jsx';
import InventoryNavTabs from './components/inventory/InventoryNavTabs.jsx';
import StockTable from './components/inventory/StockTable.jsx';
import IssueCartDrawer from './components/inventory/IssueCartDrawer.jsx';
import CustodyFlowView from './components/inventory/CustodyFlowView.jsx';
import CashVaultView from './components/inventory/CashVaultView.jsx';
import HistoryAuditView from './components/inventory/HistoryAuditView.jsx';
import ItemFormModal from './components/inventory/ItemFormModal.jsx';
import StockAdjustModal from './components/inventory/StockAdjustModal.jsx';
import CategoryManageModal from './components/inventory/CategoryManageModal.jsx';
import AddRecipientModal from './components/inventory/AddRecipientModal.jsx';
import AddAssetUnitModal from './components/inventory/AddAssetUnitModal.jsx';
import MigrationNoticeBanner from './components/inventory/MigrationNoticeBanner.jsx';
import ProductionHubView from './components/inventory/ProductionHubView.jsx';
import GameBackpackGrid from './components/inventory/GameBackpackGrid.jsx';
import GameActionModal from './components/inventory/GameActionModal.jsx';
import {
  loadStagedBags,
  upsertStagedBag,
  removeStagedBag,
  subscribeStagedBags
} from './utils/stagedBagsService.js';
import { buildProjectWithWarehouseExpense } from './utils/financeInventoryBridge.js';
import * as productionService from './services/productionService.js';
import Toast from './components/common/Toast.jsx';
import PersistentPage from './components/common/PersistentPage.jsx';
import {uploadInventoryImage} from './services/inventoryImageService.js';

// Lazy-loaded QR components with Suspense so heavy decoder/print modules are not in initial bundle
const QrScanner = lazy(() => import('./components/inventory/QrScanner.jsx'));
const QrLabelPrint = lazy(() => import('./components/inventory/QrLabelPrint.jsx'));

/**
 * Plan C + Game-Style Backpack Inventory Main Component
 */
export default function Inventory({
  inventoryItems = [],
  assetLoans = [],
  activities = [],
  isCreateOpen = false,
  onCloseCreate,
  onHistoryModeChange,
  onOpenProjectModal,
  onSaveActivity,
  defaultExperience = 'classic',
  externalGameActionRequest = null,
  onClearExternalGameAction,
  onRefresh,
  isActive = true,
  userProfile = null,
  inventoryImageFolderId = '',
  driveUploadUrl = ''
}) {
  // Game Mode vs Classic Table Mode ('game' is passed as default from App.jsx)
  const [viewExperience, setViewExperience] = useState(defaultExperience); // 'game' | 'history' | 'classic'
  // 4 Primary Navigation Tabs for classic mode: 'stock' | 'flows' | 'cash' | 'history'
  const [activeMainTab, setActiveMainTab] = useState('stock');
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  // Live Game Bag Dock State (1-tap pick, smart scan, staged bags, auto cash split)
  const [gameBagItems, setGameBagItems] = useState([]);
  const [gameBagCashLines, setGameBagCashLines] = useState([]);
  const [isGameBagExpanded, setIsGameBagExpanded] = useState(false);
  const [editingStagedBagId, setEditingStagedBagId] = useState(null);
  const [editingStagedBagTitle, setEditingStagedBagTitle] = useState('');
  const [gameInitialProjectIds, setGameInitialProjectIds] = useState([]);

  // Pre-packed / Staged Bags State
  const [stagedBags, setStagedBags] = useState([]);

  // Sticky Filter Sentinel
  const { filterSentinelRef } = useStickyFilter();

  // Central warehouse data hook (with migration fallback & zero IDB cash leak)
  const {
    items,
    categories,
    capabilities,
    recipients,
    rounds,
    assetUnits,
    legacyBorrowedUnits,
    checklistItems,
    stockPage, setStockPage, setItems, setAssetUnits, borrowedToolCount,
    operations,
    pendingRecoveryCount,
    cashSummary,
    isCashLoading,
    cashError,
    cashErrorType,
    isLoading,
    summaryError,
    isMigrationRequired,
    isPrivilegedCashUser,
    refreshSummary: refreshSummaryMetadata,
    refreshCash,
    refreshOperations
  } = useWarehouseData({
    isActive,
    inventoryItemsProp: inventoryItems,
    assetLoansProp: assetLoans,
    activitiesProp: activities,
    userProfile,
    activeMainTab
  });

  // Global Toast
  const [toast, setToast] = useState(null);
  const showToast = useCallback((text, type = 'success') => {
    setToast({ text, type });
  }, []);

  // Issue Cart State
  const [cartItems, setCartItems] = useState([]);
  const [isSubmittingCart, setIsSubmittingCart] = useState(false);
  const isPendingSubmitRef = useRef(false);

  // Modals visibility
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isStockAdjustOpen, setIsStockAdjustOpen] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [isAddRecipientOpen, setIsAddRecipientOpen] = useState(false);
  const [isAddUnitOpen, setIsAddUnitOpen] = useState(false);
  const [targetItemForUnit, setTargetItemForUnit] = useState(null);
  const [unitCatalogItems, setUnitCatalogItems] = useState(null);
  const [creatingToolForPrint, setCreatingToolForPrint] = useState(false);
  const returnToPrintRef = useRef(false);
  const unitCatalogRequestRef = useRef(0);

  // QR Modals & Scanner Mode ('borrow' | 'return')
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerIntent, setScannerIntent] = useState('borrow'); // 'borrow' | 'return'
  const [isPrintWorkspaceOpen, setIsPrintWorkspaceOpen] = useState(false);
  const [printUnitCodes, setPrintUnitCodes] = useState([]);

  // Watch for external create trigger (from App.jsx header "+ เพิ่มพัสดุใหม่")
  useEffect(() => {
    if (isCreateOpen) {
      setEditingItem(null);
      setIsItemModalOpen(true);
      if (onCloseCreate) onCloseCreate();
    }
  }, [isCreateOpen, onCloseCreate]);

  useEffect(() => {
    if (typeof onHistoryModeChange === 'function') {
      onHistoryModeChange(viewExperience === 'history');
    }
  }, [viewExperience, onHistoryModeChange]);

  const [unitsPages, setUnitsPages] = useState({});
  const [issueProjectId, setIssueProjectId] = useState('');
  const [printUnits, setPrintUnits] = useState([]);
  const stockQueryRef = useRef({limit: 50, offset: 0});
  const stockRequestRef = useRef(0);
  const inventoryActiveRef = useRef(isActive);
  useEffect(() => { inventoryActiveRef.current = isActive; }, [isActive]);
  const loadingMoreStockRef = useRef(false);
  const loadStockPage = useCallback(async (changes = {}, force = false, append = false) => {
    if (!inventoryActiveRef.current || isMigrationRequired) return;
    const query = {...stockQueryRef.current, ...changes};
    if (!append) stockQueryRef.current = query;
    const token = ++stockRequestRef.current;
    setStockPage(prev => ({...prev, loading: true, error: null}));
    try {
      const page = await loadWarehouseStock(query, null, {force});
      if (!page || token !== stockRequestRef.current) return;
      setItems(previous => append ? [...new Map([...previous, ...(page.items || [])].map(item => [item.id, item])).values()] : page.items || []);
      setStockPage(page);
    } catch (error) {
      if (token === stockRequestRef.current) setStockPage(prev => ({...prev, loading: false, error: error.message}));
    }
  }, [isMigrationRequired, setItems, setStockPage]);
  const loadMoreStock = useCallback(async () => {
    if (!isActive || activeMainTab !== 'stock' || loadingMoreStockRef.current || stockPage?.loading || !stockPage?.has_more) return;
    loadingMoreStockRef.current = true;
    try { await loadStockPage({offset: Number(stockPage.offset || 0) + Number(stockPage.limit || 50)}, false, true); }
    finally { loadingMoreStockRef.current = false; }
  }, [isActive, activeMainTab, stockPage, loadStockPage]);
  const refreshSummary = useCallback(async () => {
    await refreshSummaryMetadata();
    await loadStockPage();
  }, [refreshSummaryMetadata, loadStockPage]);
  const loadItemUnits = useCallback(async (itemId, offset = 0) => {
    try {
      const page = await loadWarehouseUnits({item_id: itemId, offset, limit: 20});
      if (!page) return;
      setAssetUnits(prev => [...new Map([...prev, ...(page.units || [])].map(unit => [unit.unit_code, unit])).values()]);
      setUnitsPages(prev => ({...prev, [itemId]: page}));
    } catch (error) { showToast(error.message, 'error'); }
  }, [setAssetUnits, showToast]);
  const openPrint = async (item = null) => {
    try {
      const rows = [];
      let offset = 0;
      while (rows.length < 500) {
        const page = await loadWarehouseUnits({item_id: item?.id, offset, limit: 50});
        if (!page) return;
        rows.push(...(page.units || []));
        if (!page.has_more) break;
        offset += 50;
      }
      setPrintUnits(rows);
      setPrintUnitCodes(item ? rows.map(unit => unit.unit_code) : []);
      setIsPrintWorkspaceOpen(true);
    } catch (error) { showToast(error.message, 'error'); }
  };

  // Connect AppBar buttons from App.jsx header (Scan, Print, History, Refresh)
  useEffect(() => {
    if (!isActive || typeof window === 'undefined') return undefined;

    const handleTriggerScan = () => {
      setScannerIntent('borrow');
      setIsScannerOpen(true);
    };
    const handleTriggerPrint = () => {
      openPrint();
    };
    const handleTriggerHistory = () => {
      setViewExperience((prev) => (prev === 'history' ? 'game' : 'history'));
    };
    const handleTriggerRefresh = () => {
      refreshSummary();
      refreshOperations();
      if (isPrivilegedCashUser) refreshCash();
      if (typeof onRefresh === 'function') onRefresh();
    };

    window.addEventListener('trigger-inventory-scan', handleTriggerScan);
    window.addEventListener('trigger-inventory-print', handleTriggerPrint);
    window.addEventListener('trigger-inventory-history', handleTriggerHistory);
    window.addEventListener('trigger-inventory-refresh', handleTriggerRefresh);

    return () => {
      window.removeEventListener('trigger-inventory-scan', handleTriggerScan);
      window.removeEventListener('trigger-inventory-print', handleTriggerPrint);
      window.removeEventListener('trigger-inventory-history', handleTriggerHistory);
      window.removeEventListener('trigger-inventory-refresh', handleTriggerRefresh);
    };
  });

  const loadUnitCatalog = async (search = '') => {
    const request = ++unitCatalogRequestRef.current;
    const page = await loadWarehouseStock({item_type: 'asset', search, limit: 100, offset: 0});
    if (!page) throw new Error('โหลดรายการเครื่องมือไม่สำเร็จ');
    if (request === unitCatalogRequestRef.current) setUnitCatalogItems(page.items || []);
    return page.items || [];
  };
  const handleAddPrintUnit = async () => {
    try {
      const tools = await loadUnitCatalog();
      setIsPrintWorkspaceOpen(false);
      returnToPrintRef.current = true;
      if (tools.length) {
        setTargetItemForUnit(null);
        setIsAddUnitOpen(true);
      } else {
        setCreatingToolForPrint(true);
        setEditingItem(null);
        setIsItemModalOpen(true);
        showToast('เพิ่มรายการเครื่องมือก่อน จากนั้นระบบจะพาไปสร้างรหัสและพิมพ์ฉลาก');
      }
    } catch (error) { showToast(error.message, 'error'); }
  };

  // Count active borrowed tools
  const activeBorrowCount = useMemo(() => {
    return borrowedToolCount ?? assetUnits.filter(u => String(u.status || '').toUpperCase() === 'BORROWED' || u.borrowed_by).length;
  }, [assetUnits, borrowedToolCount]);

  // Cart item selection & quantity management
  const selectedItemIds = useMemo(() => {
    return cartItems.map(it => String(it.id));
  }, [cartItems]);

  const handleToggleSelectItem = useCallback((item) => {
    const itemId = String(item.id);
    const isAsset = String(item.item_type || '').toLowerCase() === 'asset' || String(item.item_type || '').toLowerCase() === 'tool';

    setCartItems((prev) => {
      const exists = prev.some(it => String(it.id) === itemId);
      if (exists) {
        return prev.filter(it => String(it.id) !== itemId);
      } else {
        // Pre-select first available unit if it's an asset tool
        let preSelectedUnits = [];
        if (isAsset) {
          const firstAvail = assetUnits.find(u => String(u.item_id) === itemId && String(u.status || '').toUpperCase() === 'AVAILABLE' && !u.borrowed_by);
          if (firstAvail) preSelectedUnits = [firstAvail.unit_code];
        }

        return [
          ...prev,
          {
            ...item,
            quantity: 1,
            selectedUnits: preSelectedUnits
          }
        ];
      }
    });
    if (isAsset) loadItemUnits(itemId);
  }, [assetUnits, loadItemUnits]);

  const handleUpdateCartItemQty = useCallback((itemId, qty) => {
    setCartItems(prev => prev.map(it => String(it.id) === String(itemId) ? { ...it, quantity: qty } : it));
  }, []);

  const handleUpdateCartItemUnits = useCallback((itemId, units) => {
    setCartItems(prev => prev.map(it => String(it.id) === String(itemId) ? { ...it, selectedUnits: units } : it));
  }, []);

  const handleRemoveCartItem = useCallback((itemId) => {
    setCartItems(prev => prev.filter(it => String(it.id) !== String(itemId)));
  }, []);

  const handleClearCart = useCallback(() => {
    setCartItems([]);
    setIsMobileCartOpen(false);
  }, []);

  // Handle barcode / QR scan result (Smart Auto-Detect in Game Mode: Available -> Bag, Borrowed -> Instant Return!)
  const handleScanCode = useCallback(async (scannedCode) => {
    const code = String(scannedCode || '').trim();
    if (!code) return;

    // 1. Check serialized tool unit first (exact match)
    let unitMatch = assetUnits.find(u => u.unit_code === code);
    if (!unitMatch) {
      try { unitMatch = (await loadWarehouseUnits({unit_code: code, limit: 1}))?.units?.[0]; }
      catch { /* May be an item barcode instead of a unit code */ }
    }

    if (viewExperience === 'game') {
      if (unitMatch) {
        const itemMatch = items.find(it => String(it.id) === String(unitMatch.item_id)) || (unitMatch.item ? {...unitMatch.item, item_type: 'asset'} : null);
        setAssetUnits(prev => [...new Map([...prev, unitMatch].map(unit => [unit.unit_code, unit])).values()]);
        const isBorrowed = String(unitMatch.status || '').toUpperCase() === 'BORROWED' || Boolean(unitMatch.borrowed_by) || Boolean(unitMatch.active_recipient);

        if (isBorrowed) {
          // Instant 1-Step Return!
          try {
            await returnTools({ returns: [{ unit_code: unitMatch.unit_code, condition: 'good' }] });
            setIsScannerOpen(false);
            showToast(`คืนสำเร็จ! รับ "${itemMatch?.name || 'อุปกรณ์'} (${unitMatch.unit_code})" กลับเข้าคลังแล้ว`);
            await refreshSummary();
            await refreshOperations();
          } catch (err) {
            showToast(err.message || `รับคืน ${unitMatch.unit_code} ไม่สำเร็จ`, 'error');
          }
          return;
        }

        if (!itemMatch) {
          showToast(`พบรหัส "${code}" แต่ไม่พบข้อมูลสินค้าในคลัง`, 'error');
          return;
        }

        // Available unit -> Add straight into Game Bag!
        setGameBagItems((prev) => {
          const exists = prev.find((it) => String(it.id) === String(itemMatch.id));
          if (exists) {
            const nextCodes = exists.unitCodes?.includes(unitMatch.unit_code)
              ? exists.unitCodes
              : [...(exists.unitCodes || []), unitMatch.unit_code];
            return prev.map((it) =>
              String(it.id) === String(itemMatch.id)
                ? { ...it, quantity: nextCodes.length, unitCodes: nextCodes }
                : it
            );
          }
          return [...prev, { ...itemMatch, quantity: 1, unitCodes: [unitMatch.unit_code] }];
        });
        setIsScannerOpen(false);
        showToast(`หยิบ "${itemMatch.name} (${unitMatch.unit_code})" ใส่กระเป๋าแล้ว`);
        return;
      }

      // 2. Check catalog item code / barcode (consumable or reusable box barcode!)
      let catalogMatch = items.find(it => String(it.code || '').trim() === code);
      if (!catalogMatch) {
        try {
          const page = await loadWarehouseStock({ search: code, limit: 5, offset: 0 });
          catalogMatch = (page?.items || []).find(it => String(it.code || '').trim() === code);
        } catch {}
      }
      if (catalogMatch) {
        setGameBagItems((prev) => {
          const exists = prev.find((it) => String(it.id) === String(catalogMatch.id));
          if (exists) {
            return prev.map((it) =>
              String(it.id) === String(catalogMatch.id) ? { ...it, quantity: Number(it.quantity || 1) + 1 } : it
            );
          }
          return [...prev, { ...catalogMatch, quantity: 1, unitCodes: [] }];
        });
        setIsScannerOpen(false);
        showToast(`หยิบ "${catalogMatch.name}" (+1 ${catalogMatch.unit || 'ชิ้น'}) ใส่กระเป๋าแล้ว`);
        return;
      }

      showToast(`ไม่พบรหัส "${code}" บน Supabase`, 'error');
      return;
    }

    // Classic mode scan flow
    if (!unitMatch) {
      showToast(`ไม่พบรหัสเครื่องมือ "${code}" ในระบบคลัง`, 'error');
      return;
    }

    const itemMatch = items.find(it => String(it.id) === String(unitMatch.item_id)) || (unitMatch.item ? {...unitMatch.item, item_type: 'asset'} : null);
    if (unitMatch) setAssetUnits(prev => [...new Map([...prev, unitMatch].map(unit => [unit.unit_code, unit])).values()]);
    if (!itemMatch) {
      showToast(`รหัส "${code}" ไม่มีรายการพัสดุที่สอดคล้องในฐานข้อมูล`, 'error');
      return;
    }

    if (scannerIntent === 'return') {
      setActiveMainTab('flows');
      setIsScannerOpen(false);
      showToast(`สแกนพบเครื่องมือ "${itemMatch.name} (${unitMatch.unit_code})" ในระบบ สามารถกดรับคืนได้ในหน้านี้`);
      return;
    }

    const isUnitAvailable = String(unitMatch.status || '').toUpperCase() === 'AVAILABLE' && !unitMatch.borrowed_by;
    if (!isUnitAvailable) {
      showToast(`เครื่องมือรหัส "${unitMatch.unit_code}" ถูกยืมอยู่แล้ว (ผู้ถือครอง: ${unitMatch.borrowed_by || 'ไม่ระบุ'})`, 'error');
      return;
    }

    let alreadyInCart = false;
    cartItems.forEach(ci => {
      if (ci.selectedUnits && ci.selectedUnits.includes(unitMatch.unit_code)) {
        alreadyInCart = true;
      }
    });

    if (alreadyInCart) {
      showToast(`รหัส ${unitMatch.unit_code} ถูกเลือกอยู่ในตะกร้าแล้ว`);
      return;
    }

    setCartItems((prev) => {
      const existingCartItem = prev.find(it => String(it.id) === String(itemMatch.id));
      if (existingCartItem) {
        const units = existingCartItem.selectedUnits || [];
        return prev.map(it => String(it.id) === String(itemMatch.id)
          ? { ...it, selectedUnits: [...units, unitMatch.unit_code] }
          : it
        );
      } else {
        return [
          ...prev,
          {
            ...itemMatch,
            quantity: 1,
            selectedUnits: [unitMatch.unit_code]
          }
        ];
      }
    });

    showToast(`เพิ่ม "${itemMatch.name} (${unitMatch.unit_code})" ลงในตะกร้าแล้ว`);
  }, [assetUnits, items, setAssetUnits, viewExperience, scannerIntent, cartItems, showToast, refreshSummary, refreshOperations]);

  // Submit Issue Cart transaction (Atomic mixed cart via createIssue with stable idempotency key)
  const handleSubmitIssueCart = async (payload, onSuccess) => {
    if (isPendingSubmitRef.current) return;
    isPendingSubmitRef.current = true;
    setIsSubmittingCart(true);

    try {
      const isField = payload.issueType === 'FIELD_ISSUE' || payload.issueMode === 'field' || payload.issueMode === 'field_round';
      const resolvedMaterialLines = (payload.materialLines && payload.materialLines.length > 0)
        ? payload.materialLines
        : (payload.items
            ? payload.items
                .filter(it => String(it.item_type || '').toLowerCase() !== 'asset' && String(it.item_type || '').toLowerCase() !== 'tool')
                .map(m => ({ item_id: m.item_id || m.id, quantity: Number(m.quantity) || 1 }))
            : []);

      const resolvedToolUnits = (payload.toolUnits && payload.toolUnits.length > 0)
        ? payload.toolUnits
        : (payload.items
            ? payload.items
                .filter(it => String(it.item_type || '').toLowerCase() === 'asset' || String(it.item_type || '').toLowerCase() === 'tool')
                .flatMap(t => t.unitCodes || [])
            : []);

      // Mixed cart uses createProductionIssue when productionWork is provided, or createIssue
      if (!isField && payload.productionWork && typeof productionService.createProductionIssue === 'function') {
        await productionService.createProductionIssue({
          issue: {
            projectId: payload.projectId,
            recipientId: payload.recipientId,
            recipientName: payload.recipientName,
            dueDate: payload.dueDate || payload.productionWork?.dueAt,
            notes: payload.notes,
            materialLines: resolvedMaterialLines.map(m => ({ itemId: m.item_id, quantity: m.quantity })),
            toolUnits: resolvedToolUnits
          },
          work: payload.productionWork,
          idempotencyKey: payload.idempotencyKey
        });
      } else {
        await createIssue({
          issueType: isField ? 'FIELD_ISSUE' : 'PRODUCTION_ISSUE',
          projectId: isField ? null : (payload.projectId || null),
          projectIds: isField ? (payload.projectIds || payload.fieldRound?.projectIds || []) : [],
          roundCode: isField ? (payload.roundCode || payload.fieldRound?.roundCode || null) : null,
          roundTitle: isField ? (payload.roundTitle || payload.fieldRound?.title || null) : null,
          recipientId: payload.recipientId || null,
          recipientName: payload.recipientName || (payload.fieldRound?.primaryReceiver || ''),
          teamMembers: isField ? (payload.teamMembers || payload.fieldRound?.teamMembers || []) : [],
          dueDate: payload.dueDate || (payload.fieldRound?.expectedReturnAt || null),
          materialLines: resolvedMaterialLines,
          toolUnits: resolvedToolUnits,
          notes: payload.notes || '',
          idempotencyKey: payload.idempotencyKey
        });
      }

      // Confirmed write: clear cart and invoke onSuccess
      showToast(`บันทึกการเบิกสำเร็จเรียบร้อย`);
      handleClearCart();
      setIsMobileCartOpen(false);
      if (onSuccess) onSuccess();

      // Refresh data (if refresh fails, inform user that transaction succeeded on server)
      try {
        await refreshSummary();
        await refreshOperations();
      } catch (refreshErr) {
        console.warn('Post-transaction refresh failed:', refreshErr);
        showToast('บันทึกการเบิกสำเร็จแล้ว แต่การดึงข้อมูลล่าสุดล้มเหลว กรุณากดรีเฟรช', 'warning');
      }
    } catch (err) {
      console.error('Issue cart transaction failed:', err);
      // DO NOT clear cart on failed write
      showToast(err.message || 'บันทึกการเบิกไม่สำเร็จ กรุณาตรวจสอบหรือลองใหม่อีกครั้ง', 'error');
      throw err;
    } finally {
      setIsSubmittingCart(false);
      isPendingSubmitRef.current = false;
    }
  };

  // Tool Returns & Handovers
  const handleReturnTools = async ({ returns, idempotencyKey }, onSuccess) => {
    try {
      await returnTools({ returns, idempotencyKey });
      showToast('บันทึกรับคืนเครื่องมือเรียบร้อย');
      if (onSuccess) onSuccess();
      await refreshSummary();
      await refreshOperations();
    } catch (err) {
      console.error('Return tools failed:', err);
      showToast(err.message || 'บันทึกรับคืนเครื่องมือไม่สำเร็จ', 'error');
      throw err;
    }
  };

  const handleHandoverTools = async ({ unitCodes, toRecipientId, toRecipientName, accepted, notes, idempotencyKey }, onSuccess) => {
    try {
      await handoverTools({ unitCodes, toRecipientId, toRecipientName, accepted: Boolean(accepted), notes, idempotencyKey });
      showToast(`ส่งต่อเครื่องมือให้ ${toRecipientName} สำเร็จแล้ว`);
      if (onSuccess) onSuccess();
      await refreshSummary();
      await refreshOperations();
    } catch (err) {
      console.error('Handover tools failed:', err);
      showToast(err.message || 'บันทึกส่งต่อเครื่องมือไม่สำเร็จ', 'error');
      throw err;
    }
  };

  const handleAdoptOrReturnLegacyTool = async ({ unitCode, action, idempotencyKey }, onSuccess) => {
    try {
      await adoptOrReturnLegacyTool({ unitCode, action, idempotencyKey });
      showToast(action === 'adopt' ? `รับเครื่องมือ ${unitCode} เข้าสู่ระบบใหม่แล้ว` : `บันทึกคืนเครื่องมือเดิม ${unitCode} เรียบร้อย`);
      if (onSuccess) onSuccess();
      await refreshSummary();
    } catch (err) {
      showToast(err.message || 'จัดการเครื่องมือเดิมไม่สำเร็จ', 'error');
      throw err;
    }
  };

  // Material Returns & Recoveries
  const handleReturnMaterials = async (data, onSuccess) => {
    try {
      await returnUnusedMaterials(data);
      showToast('บันทึกรับคืนวัสดุที่ไม่ได้ใช้เรียบร้อย');
      if (onSuccess) onSuccess();
      await refreshSummary();
      await refreshOperations();
    } catch (err) {
      showToast(err.message || 'รับคืนวัสดุไม่สำเร็จ', 'error');
      throw err;
    }
  };

  const handleRecoverMaterials = async (data, onSuccess) => {
    try {
      await recoverMaterials(data);
      showToast('บันทึกการกู้คืนวัสดุเรียบร้อย');
      if (onSuccess) onSuccess();
      await refreshSummary();
      await refreshOperations();
    } catch (err) {
      showToast(err.message || 'กู้คืนวัสดุไม่สำเร็จ', 'error');
      throw err;
    }
  };

  const handleInspectRecovery = async (data, onSuccess) => {
    try {
      await inspectRecovery(data);
      showToast('ตรวจสภาพและบันทึกวัสดุเข้าสต็อกเรียบร้อย');
      if (onSuccess) onSuccess();
      await refreshSummary();
      await refreshOperations();
    } catch (err) {
      showToast(err.message || 'ตรวจสภาพวัสดุไม่สำเร็จ', 'error');
      throw err;
    }
  };

  // Cash Operations (Strictly server-verified RBAC)
  const handleDepositCash = async (data) => {
    await depositCash(data);
    await refreshCash();
  };

  const handleRecordCountedOpening = async (data) => {
    await recordCountedOpeningCash(data);
    await refreshCash();
  };

  const handleReserveCash = async (data) => {
    await reserveCash(data);
    await refreshCash();
  };

  const handleReleaseCashReservation = async (data) => {
    await releaseCashReservation(data);
    await refreshCash();
  };

  const handleUpdateCashThresholds = async (data) => {
    await updateCashThresholds(data);
    await refreshCash();
  };

  const handleIssueCashBatch = async (data) => {
    await issueCashBatch(data);
    await refreshCash();
  };

  const handleHandoverCashBatch = async (data) => {
    await handoverCashBatch(data);
    await refreshCash();
  };

  const handleReceivePreparedCash = async (data) => {
    await receivePreparedCash(data);
    await refreshCash();
  };

  const handleReturnUnusedRawCash = async (data) => {
    await returnUnusedRawCash(data);
    await refreshCash();
  };

  const handleDeliverCashToCustomer = async (data) => {
    await deliverCashToCustomer(data);
    await refreshCash();
  };

  // Category Operations
  const handleCreateCategory = async (data) => {
    await createCategory(data);
    await refreshSummary();
  };

  const handleRenameCategory = async (id, name, key) => {
    await renameCategory(id, name, key);
    await refreshSummary();
  };

  const handleRetireCategory = async (id, isActiveVal, key) => {
    await retireCategory(id, isActiveVal, key);
    await refreshSummary();
  };

  // Catalog Item Save (createItem for new, saveItemMetadata for existing)
  const handleSaveItem = async (payload, onSuccess) => {
    try {
      let createdItem;
      if (payload.id) {
        // Edit existing item: metadata only, never overwrites current_stock
        await saveItemMetadata({
          id: payload.id,
          name: payload.name,
          categoryId: payload.category_id,
          itemType: payload.item_type,
          unit: payload.unit,
          minAlertThreshold: payload.min_alert_threshold,
          averageCost: payload.average_cost,
          storageLocation: payload.storage_location,
          color: payload.color,
          size: payload.size,
          imageUrl: payload.image_url,
          idempotencyKey: payload.idempotencyKey
        });
        showToast('แก้ไขข้อมูลพัสดุสำเร็จ');
      } else {
        // Create new item: audited initial stock
        createdItem = await createItem({
          code: payload.code,
          name: payload.name,
          categoryId: payload.category_id,
          itemType: payload.item_type,
          unit: payload.unit,
          minAlertThreshold: payload.min_alert_threshold,
          averageCost: payload.average_cost,
          storageLocation: payload.storage_location,
          color: payload.color,
          size: payload.size,
          imageUrl: payload.image_url,
          initialStock: payload.initial_stock || 0,
          openingStockReason: payload.opening_stock_reason || '',
          idempotencyKey: payload.idempotencyKey
        });
        showToast('สร้างรายการพัสดุใหม่เรียบร้อยแล้ว');
      }
      if (onSuccess) onSuccess();
      if (creatingToolForPrint && createdItem?.data?.id) {
        returnToPrintRef.current = true;
        const tool = {...payload, id: createdItem.data.id};
        setTargetItemForUnit(tool);
        setUnitCatalogItems([tool]);
        setIsAddUnitOpen(true);
      }
      await refreshSummary();
    } catch (err) {
      showToast(err.message || 'บันทึกข้อมูลพัสดุไม่สำเร็จ', 'error');
      throw err;
    }
  };

  // Serialized Unit Code Save
  const handleSaveUnit = async (payload, onSuccess) => {
    try {
      await addAssetUnit({
        itemId: payload.item_id,
        unitCode: payload.unit_code,
        notes: payload.notes || '',
        idempotencyKey: payload.idempotencyKey
      });
      showToast(`บันทึกรหัสประจำชิ้น ${payload.unit_code} สำเร็จ`);
      const returnToPrint = returnToPrintRef.current;
      if (onSuccess) onSuccess();
      if (returnToPrint) {
        returnToPrintRef.current = false;
        await openPrint({id: payload.item_id});
      }
      await refreshSummary();
    } catch (err) {
      showToast(err.message || 'บันทึกรหัสเครื่องมือไม่สำเร็จ', 'error');
      throw err;
    }
  };

  const handleQuickCreatePrintUnit = async ({ itemId, unitCode, idempotencyKey }) => {
    await addAssetUnit({
      itemId,
      unitCode,
      notes: '',
      idempotencyKey
    });
    showToast(`สร้างรหัส ${unitCode} พร้อมพิมพ์แล้ว`);
    const rows = [];
    let offset = 0;
    while (rows.length < 500) {
      const page = await loadWarehouseUnits({ offset, limit: 50 });
      if (!page) break;
      rows.push(...(page.units || []));
      if (!page.has_more) break;
      offset += 50;
    }
    setPrintUnits(rows);
    await refreshSummary();
    return unitCode;
  };

  // Stock Receive / Adjustment (Sends signed delta without client-side clamp)
  const handleAdjustStock = async ({ itemId, direction, quantity, reason, notes, idempotencyKey }, onSuccess) => {
    const delta = direction === 'in' ? Number(quantity) : -Number(quantity);
    const fullReason = notes ? `${reason}: ${notes}` : reason;

    try {
      await adjustStock({
        itemId,
        deltaQuantity: delta,
        reason: fullReason, idempotencyKey
      });
      showToast(direction === 'in' ? `รับของเข้า ${quantity} ชิ้น เรียบร้อย` : `ปรับลดยอด ${quantity} ชิ้น เรียบร้อย`);
      if (onSuccess) onSuccess();
      await refreshSummary();
    } catch (err) {
      showToast(err.message || 'ปรับปรุงยอดสต็อกไม่สำเร็จ', 'error');
      throw err;
    }
  };

  // Add recipient (Individual or Team) with server confirmation (zero fake IDs)
  const handleAddRecipient = async (recipientData, onSuccess) => {
    try {
      if (recipientData.isTeam) {
        await createTeam({
          name: recipientData.name,
          primaryReceiverName: recipientData.primaryReceiverName,
          memberNames: recipientData.memberNames,
          idempotencyKey: recipientData.idempotencyKey
        });
        showToast(`ลงทะเบียนทีม "${recipientData.name}" สำเร็จ`);
      } else {
        await createRecipient({
          name: recipientData.name,
          recipientType: recipientData.recipientType,
          contactInfo: recipientData.contactInfo,
          idempotencyKey: recipientData.idempotencyKey,
          is_active: true
        });
        showToast(`ลงทะเบียนผู้รับ "${recipientData.name}" สำเร็จ`);
      }
      if (onSuccess) onSuccess();
      await refreshSummary();
    } catch (err) {
      showToast(err.message || 'ลงทะเบียนผู้รับไม่สำเร็จ', 'error');
      throw err;
    }
  };

  // Load & subscribe to Pre-packed Staged Bags
  useEffect(() => {
    let active = true;
    loadStagedBags().then((bags) => {
      if (active) setStagedBags(bags);
    });
    const unsub = subscribeStagedBags((bags) => {
      if (active) setStagedBags(bags);
    });
    return () => {
      active = false;
      unsub();
    };
  }, []);

  // Watch external Game Action shortcut (e.g. from Project Cards on Home/Plans page!)
  useEffect(() => {
    if (externalGameActionRequest && externalGameActionRequest.projectId) {
      setViewExperience('game');
      setGameInitialProjectIds([String(externalGameActionRequest.projectId)]);
      setIsGameBagExpanded(true);
      if (typeof onClearExternalGameAction === 'function') {
        onClearExternalGameAction();
      }
    }
  }, [externalGameActionRequest, onClearExternalGameAction]);

  // =========================================================================
  // 1-TAP GAME BAG DOCK HANDLERS
  // =========================================================================
  const handleTapPickGameItem = useCallback((item) => {
    if (!item?.id) return;
    const itemId = String(item.id);
    const cls = String(item.item_type || '').trim().toLowerCase();
    const isAsset = cls === 'asset' || cls === 'tool' || cls === 'equipment';

    if (isAsset) {
      loadItemUnits(itemId);
      setGameBagItems((prev) => {
        const existing = prev.find((it) => String(it.id) === itemId);
        if (existing) {
          return prev.filter((it) => String(it.id) !== itemId);
        }
        const availUnits = (assetUnits || []).filter(
          (u) =>
            String(u.item_id) === itemId &&
            String(u.status || '').toUpperCase() === 'AVAILABLE' &&
            !u.borrowed_by &&
            !u.active_recipient
        );
        const prePicked = availUnits.length > 0 ? [availUnits[0].unit_code] : [];
        return [...prev, { ...item, quantity: Math.max(1, prePicked.length), unitCodes: prePicked }];
      });
      return;
    }

    const maxStock = Math.max(0, Number(item.current_stock) || 0);
    setGameBagItems((prev) => {
      const existing = prev.find((it) => String(it.id) === itemId);
      if (existing) {
        const nextQty = Math.min(maxStock || existing.quantity + 1, Number(existing.quantity || 1) + 1);
        return prev.map((it) => (String(it.id) === itemId ? { ...it, quantity: nextQty } : it));
      }
      if (maxStock <= 0) return prev;
      return [...prev, { ...item, quantity: 1, unitCodes: [] }];
    });
  }, [assetUnits, loadItemUnits]);

  const handleUpdateGameBagItemQty = useCallback((itemId, nextQty) => {
    const num = Math.floor(Number(nextQty) || 0);
    if (num <= 0) {
      setGameBagItems((prev) => prev.filter((it) => String(it.id) !== String(itemId)));
      return;
    }
    setGameBagItems((prev) =>
      prev.map((it) => (String(it.id) === String(itemId) ? { ...it, quantity: num } : it))
    );
  }, []);

  const handleToggleGameBagItemUnit = useCallback((itemId, unitCode, checked) => {
    setGameBagItems((prev) =>
      prev.map((it) => {
        if (String(it.id) !== String(itemId)) return it;
        const currentCodes = Array.isArray(it.unitCodes) ? it.unitCodes : [];
        const nextCodes = checked
          ? currentCodes.includes(unitCode)
            ? currentCodes
            : [...currentCodes, unitCode]
          : currentCodes.filter((c) => c !== unitCode);
        return {
          ...it,
          unitCodes: nextCodes,
          quantity: Math.max(1, nextCodes.length)
        };
      })
    );
  }, []);

  const handleAddComboToGameBag = useCallback((companionItem, suggestQty = 1) => {
    if (!companionItem?.id) return;
    const compId = String(companionItem.id);
    const maxStock = Math.max(1, Number(companionItem.current_stock) || 1);
    const addQty = Math.min(maxStock, Math.max(1, Number(suggestQty) || 1));
    setGameBagItems((prev) => {
      const exists = prev.find((it) => String(it.id) === compId);
      if (exists) {
        return prev.map((it) =>
          String(it.id) === compId
            ? { ...it, quantity: Math.min(maxStock, Number(it.quantity || 1) + addQty) }
            : it
        );
      }
      return [...prev, { ...companionItem, quantity: addQty, unitCodes: [] }];
    });
  }, []);

  const handleRemoveGameBagItem = useCallback((itemId) => {
    setGameBagItems((prev) => prev.filter((it) => String(it.id) !== String(itemId)));
  }, []);

  const handleTapPickGameCash = useCallback((denomination, step = 20) => {
    const denom = Number(denomination);
    if (!denom) return;
    const denomRow = (cashSummary?.denominations || []).find((d) => Number(d.denomination) === denom);
    const maxAvail = denomRow
      ? Number(denomRow.available_count ?? Math.max(0, (Number(denomRow.physical_count) || 0) - (Number(denomRow.reserved_count) || 0)))
      : 0;
    if (maxAvail <= 0) return;

    setGameBagCashLines((prev) => {
      const exists = prev.find((c) => Number(c.denomination) === denom);
      if (exists) {
        const nextCount = Math.min(maxAvail, Number(exists.noteCount || 0) + step);
        return prev.map((c) => (Number(c.denomination) === denom ? { ...c, noteCount: nextCount } : c));
      }
      return [...prev, { denomination: denom, noteCount: Math.min(maxAvail, step) }];
    });
  }, [cashSummary]);

  const handleUpdateGameCashLine = useCallback((denomination, nextCount) => {
    const denom = Number(denomination);
    const count = Math.floor(Number(nextCount) || 0);
    if (count <= 0) {
      setGameBagCashLines((prev) => prev.filter((c) => Number(c.denomination) !== denom));
      return;
    }
    setGameBagCashLines((prev) =>
      prev.map((c) => (Number(c.denomination) === denom ? { ...c, noteCount: count } : c))
    );
  }, []);

  const handleRemoveGameCashLine = useCallback((denomination) => {
    setGameBagCashLines((prev) => prev.filter((c) => Number(c.denomination) !== Number(denomination)));
  }, []);

  const handleClearGameBag = useCallback(() => {
    setGameBagItems([]);
    setGameBagCashLines([]);
    setEditingStagedBagId(null);
    setEditingStagedBagTitle('');
    setIsGameBagExpanded(false);
  }, []);

  const handleLoadStagedBagToDock = useCallback((bag) => {
    if (!bag) return;
    const hydrated = (bag.items || []).map((line) => {
      const catalogItem = items.find((i) => String(i.id) === String(line.item_id)) || {};
      const cls = String(line.item_type || catalogItem.item_type || '').toLowerCase();
      if (cls === 'asset' || cls === 'tool' || cls === 'equipment') {
        loadItemUnits(line.item_id);
      }
      return {
        ...catalogItem,
        id: line.item_id,
        name: line.name || catalogItem.name,
        unit: line.unit || catalogItem.unit || 'ชิ้น',
        item_type: line.item_type || catalogItem.item_type || 'consumable',
        quantity: Number(line.quantity) || 1,
        unitCodes: Array.isArray(line.unit_codes) ? line.unit_codes : []
      };
    });
    setGameBagItems(hydrated);
    setEditingStagedBagId(bag.id);
    setEditingStagedBagTitle(bag.title || '');
    const projIds = Array.isArray(bag.projectIds) && bag.projectIds.length > 0
      ? bag.projectIds
      : bag.projectId
        ? [bag.projectId]
        : [];
    setGameInitialProjectIds(projIds);
    setIsGameBagExpanded(true);
  }, [items, loadItemUnits]);

  const handleQuickReturnToolFromGrid = useCallback(async (unitCode) => {
    await handleReturnTools({
      returns: [{ unit_code: unitCode, condition: 'good' }]
    });
  }, [handleReturnTools]);

  const handleQuickSalvageReusableFromGrid = useCallback(async ({ line, goodQty, damagedQty }) => {
    await handleRecoverMaterials({
      projectId: line.project_id || null,
      recipientName: line.recipient_name || '',
      items: [
        {
          source_issue_movement_id: line.movement_id || line.id,
          item_id: line.item_id,
          recovered_qty: Number(goodQty) + Number(damagedQty),
          inspect_now: true,
          good_qty: Number(goodQty),
          damaged_qty: Number(damagedQty)
        }
      ],
      notes: `เก็บของวนใช้ซ้ำกลับคลัง (ดี ${goodQty}, ชำรุดหน้างาน ${damagedQty} ไม่คิดเงินพนักงาน)`
    });
  }, [handleRecoverMaterials]);

  const handleQuickCompleteCashBatchFromGrid = useCallback(async (batch) => {
    try {
      await receivePreparedCash({
        batchId: batch.id,
        preparedCount: batch.remainingCount,
        notes: 'รับช่อเงินที่พับเสร็จเข้าคลังพร้อมส่งลูกค้า'
      });
      await refreshCash();
      showToast(`รับช่อเงินแบงค์ ${batch.denomination} (${batch.remainingCount} ใบ) จาก ${batch.recipient_name || 'คนพับ'} เรียบร้อย!`);
    } catch (err) {
      showToast(err.message || 'รับช่อเงินไม่สำเร็จ', 'error');
      throw err;
    }
  }, [refreshCash, showToast]);

  const handleQuickReturnRawCashBatchFromGrid = useCallback(async (batch) => {
    try {
      await returnUnusedRawCash({
        batchId: batch.id,
        returnCount: batch.remainingCount,
        keepReservation: true,
        notes: 'รับคืนธนบัตรเปล่าเข้าคลัง'
      });
      await refreshCash();
      showToast(`รับคืนธนบัตรเปล่า ${batch.denomination} (${batch.remainingCount} ใบ) เข้าคลังเรียบร้อย!`);
    } catch (err) {
      showToast(err.message || 'รับคืนธนบัตรไม่สำเร็จ', 'error');
      throw err;
    }
  }, [refreshCash, showToast]);

  // Quick Restock from Game Backpack (+ Optional Seamless Finance Expense Sync!)
  const handleQuickRestockFromBackpack = async ({
    itemId,
    item,
    quantity,
    recordExpenseToo,
    expenseTotalBaht,
    expenseProjectId,
    idempotencyKey
  }) => {
    await adjustStock({
      itemId,
      deltaQuantity: Number(quantity),
      reason: recordExpenseToo
        ? `เติมของเข้ากระเป๋า + ลงบิลการเงิน (${expenseProjectId || 'SHOP-STOCK'})`
        : 'เติมของด่วนจากกระเป๋าคลัง',
      idempotencyKey
    });

    if (recordExpenseToo && Number(expenseTotalBaht) > 0) {
      try {
        const targetProj = (activities || []).find(
          (a) => String(a.id || '').toLowerCase() === String(expenseProjectId || 'SHOP-STOCK').toLowerCase()
        );
        const updatedProj = await buildProjectWithWarehouseExpense({
          targetProject: targetProj,
          projectId: expenseProjectId || 'SHOP-STOCK',
          itemName: item?.name || 'เติมของคลังสินค้า',
          itemId,
          quantity: Number(quantity),
          totalCost: Number(expenseTotalBaht)
        });
        if (typeof onSaveActivity === 'function') {
          await onSaveActivity(updatedProj);
        }
        showToast(`เติม +${quantity} ${item?.unit || 'ชิ้น'} เข้ากระเป๋า และลงบิลรายจ่ายหน้าการเงินเรียบร้อย!`);
      } catch (finErr) {
        showToast(`เติมของเข้าคลังสำเร็จ แต่บันทึกบิลการเงินไม่สำเร็จ: ${finErr.message}`, 'warning');
      }
    } else {
      showToast(`เติมของ +${quantity} ${item?.unit || 'ชิ้น'} เข้ากระเป๋าคลังเรียบร้อย!`);
    }

    await refreshSummary();
  };

  // Quick Deposit Banknotes from Game Backpack (Bank Reserve vs Project Support)
  const handleQuickDepositCashFromBackpack = async ({
    denomination,
    noteCount,
    sourceMode,
    projectId,
    idempotencyKey
  }) => {
    await depositCash({
      denomination: Number(denomination),
      noteCount: Number(noteCount),
      projectId: sourceMode === 'project_support' ? projectId : null,
      notes:
        sourceMode === 'project_support'
          ? `รับธนบัตรสนับสนุนศิลปินเข้าโปรเจกต์ ${projectId}`
          : 'เบิกเงินสำรองร้านจากธนาคารเข้าคลังธนบัตร (ไม่คิดเป็นรายจ่าย)',
      idempotencyKey
    });

    if (sourceMode === 'project_support' && projectId) {
      try {
        await reserveCash({
          projectId,
          denomination: Number(denomination),
          noteCount: Number(noteCount),
          notes: `จองธนบัตรอัตโนมัติให้งาน ${projectId}`
        });
      } catch {
        // Optional reservation convenience
      }
    }

    await refreshCash();
    showToast(`เติมธนบัตร ${denomination} บาท (+${noteCount} ใบ) เข้ากระเป๋าคลังเรียบร้อย!`);
  };

  const handleSaveStagedBag = async (bagPayload) => {
    const saved = await upsertStagedBag(bagPayload);
    const all = await loadStagedBags();
    setStagedBags(all);
    return saved;
  };

  const handleDeleteStagedBag = async (bagId) => {
    const remaining = await removeStagedBag(bagId);
    setStagedBags(remaining);
  };

  return (
    <div className="w-full max-w-[3840px] mx-auto p-4 pb-28 md:pb-4 space-y-4">
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.text}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Migration Notice Banner if Supabase RPC is pending */}
      <MigrationNoticeBanner
        message={isMigrationRequired ? summaryError : null}
        onRetry={refreshSummary}
        isRetrying={isLoading}
      />

      {/* General Error Banner if summary load failed and not just migration */}
      {!isMigrationRequired && summaryError && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between gap-3 text-rose-900 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{summaryError}</span>
          </div>
          <button
            type="button"
            onClick={refreshSummary}
            disabled={isLoading}
            className="min-h-[44px] px-3 py-1.5 bg-white border border-rose-300 rounded-xl text-xs font-bold text-rose-800 hover:bg-rose-100 transition flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>ลองใหม่</span>
          </button>
        </div>
      )}

      {/* Sentinel for sticky filter calculation */}
      <div ref={filterSentinelRef} className="h-0 w-full" />

      {/* ===================================================================== */}
      {/* EXPERIENCE 1 (DEFAULT IN APP): PURE GAME-STYLE BACKPACK INVENTORY     */}
      {/* ===================================================================== */}
      {viewExperience === 'game' && (
        isLoading && items.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-[var(--theme-main,#8b5cf6)] animate-spin mx-auto" />
            <p className="text-sm font-bold text-slate-700">กำลังเปิดกระเป๋าคลังสินค้า...</p>
          </div>
        ) : (
          <GameBackpackGrid
            items={items}
            categories={categories}
            assetUnits={assetUnits}
            operations={operations}
            cashSummary={cashSummary}
            isPrivilegedCashUser={isPrivilegedCashUser}
            activities={activities}
            stagedBags={stagedBags}
            bagItems={gameBagItems}
            bagCashLines={gameBagCashLines}
            isRefreshing={isLoading || isCashLoading}
            onSmartScanClick={() => {
              setScannerIntent('borrow');
              setIsScannerOpen(true);
            }}
            onOpenHistory={() => setViewExperience('history')}
            onRefreshAll={() => {
              refreshSummary();
              refreshOperations();
              if (isPrivilegedCashUser) refreshCash();
              if (typeof onRefresh === 'function') onRefresh();
            }}
            onTapPickItem={handleTapPickGameItem}
            onUpdateBagItemQty={handleUpdateGameBagItemQty}
            onTapPickCash={handleTapPickGameCash}
            onUpdateCashLine={handleUpdateGameCashLine}
            onLoadStagedBagToDock={handleLoadStagedBagToDock}
            onSaveStagedBag={handleSaveStagedBag}
            onDeleteStagedBag={handleDeleteStagedBag}
            onQuickReturnTool={handleQuickReturnToolFromGrid}
            onQuickSalvageReusable={handleQuickSalvageReusableFromGrid}
            onQuickCompleteCashBatch={handleQuickCompleteCashBatchFromGrid}
            onQuickReturnRawCashBatch={handleQuickReturnRawCashBatchFromGrid}
            onQuickRestockItem={handleQuickRestockFromBackpack}
            onQuickDepositCash={handleQuickDepositCashFromBackpack}
            onOpenCreateItem={() => {
              setEditingItem(null);
              setIsItemModalOpen(true);
            }}
            onOpenEditItem={(item) => {
              setEditingItem(item);
              setIsItemModalOpen(true);
            }}
            onOpenAddUnit={(item) => {
              setTargetItemForUnit(item);
              setIsAddUnitOpen(true);
            }}
            onOpenPrintItem={openPrint}
            onOpenCategories={() => setIsCategoriesOpen(true)}
            onLoadMore={loadMoreStock}
            hasMore={Boolean(stockPage?.has_more)}
            isLoadingMore={Boolean(stockPage?.loading)}
          />
        )
      )}

      {/* ===================================================================== */}
      {/* EXPERIENCE 2: QUICK AUDIT HISTORY BOOK (TOGGLED VIA APPBAR)           */}
      {/* ===================================================================== */}
      {viewExperience === 'history' && (
        <HistoryAuditView
          assetLoans={assetLoans}
          checklistItems={checklistItems}
          items={items}
          activities={activities}
          onOpenProjectModal={onOpenProjectModal}
          isPrivilegedCash={isPrivilegedCashUser}
        />
      )}

      {/* ===================================================================== */}
      {/* EXPERIENCE 3: CLASSIC TABLE VIEW (PRESERVED FOR LEGACY AUDIT TESTS)   */}
      {/* ===================================================================== */}
      {viewExperience === 'classic' && (
        <>
          <InventoryHeader
            activeTab={activeMainTab}
            onOpenReceiveStock={() => setIsStockAdjustOpen(true)}
            onOpenCategories={() => setIsCategoriesOpen(true)}
            onOpenBatchPrint={() => openPrint()}
            onOpenScanner={() => {
              setScannerIntent('borrow');
              setIsScannerOpen(true);
            }}
            onOpenCreateItem={() => {
              setEditingItem(null);
              setIsItemModalOpen(true);
            }}
            onRefresh={() => {
              refreshSummary();
              if (activeMainTab === 'flows') refreshOperations();
              if (activeMainTab === 'cash') refreshCash();
              if (typeof onRefresh === 'function') onRefresh();
            }}
            isRefreshing={isLoading || isCashLoading}
          />

          <InventoryNavTabs
            activeTab={activeMainTab}
            onChangeTab={tab => { setIsMobileCartOpen(false); setActiveMainTab(tab); }}
            activeBorrowCount={activeBorrowCount}
            activeRecoveryPendingCount={pendingRecoveryCount}
          />

          {isLoading && items.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-[var(--theme-main,#8b5cf6)] animate-spin mx-auto" />
              <p className="text-sm font-bold text-slate-700">กำลังโหลดข้อมูลคลังสินค้า...</p>
            </div>
          ) : (
            <>
          {/* ========================================================================= */}
          {/* TAB 1: ของในคลัง (Stock View with Contextual Issue Cart)                   */}
          {/* ========================================================================= */}
          <PersistentPage active={activeMainTab === 'stock'} className={`grid grid-cols-1 lg:grid-cols-12 gap-5 items-start ${cartItems.length ? 'pb-40 md:pb-20 lg:pb-0' : ''}`}>
              {/* Main Stock Table / Catalog (8 cols on desktop) */}
              <div className={cartItems.length ? 'lg:col-span-8 space-y-4' : 'lg:col-span-12 space-y-4'}>
                <StockTable
                  serverPage={stockPage}
                  onQueryChange={loadStockPage}
                  onLoadMore={loadMoreStock}
                  isActive={isActive && activeMainTab === 'stock'}
                  onLoadUnits={loadItemUnits}
                  unitsPages={unitsPages}
                  items={items}
                  categories={categories}
                  assetUnits={assetUnits}
                  selectedItemIds={selectedItemIds}
                  onToggleSelectItem={handleToggleSelectItem}
                  onOpenEditItem={(item) => {
                    setEditingItem(item);
                    setIsItemModalOpen(true);
                  }}
                  onOpenSinglePrint={openPrint}
                  onOpenAddUnit={(item) => {
                    setTargetItemForUnit(item);
                    setIsAddUnitOpen(true);
                  }}
                  onNavigateToRecovery={() => setActiveMainTab('flows')}
                  pendingRecoveryCount={pendingRecoveryCount}
                />
              </div>

              {cartItems.length > 0 && <button type="button" onClick={() => setIsMobileCartOpen(true)} className="lg:hidden fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] md:bottom-4 left-4 right-4 z-40 min-h-12 rounded-2xl bg-[var(--theme-main)] text-[var(--theme-on-main)] font-bold shadow-lg">เปิดรายการเบิก ({cartItems.length})</button>}
              {/* Contextual Issue Cart Drawer (4 cols on desktop) */}
              <div className={cartItems.length ? 'lg:col-span-4 lg:sticky lg:top-4 space-y-3' : 'hidden'}>
                <IssueCartDrawer
                  isOpen={isActive && activeMainTab === 'stock' && isMobileCartOpen && cartItems.length > 0}
                  onClose={() => setIsMobileCartOpen(false)}
                  initialProjectId={issueProjectId}
                  cartItems={cartItems}
                  onUpdateCartItemQty={handleUpdateCartItemQty}
                  onUpdateCartItemUnits={handleUpdateCartItemUnits}
                  onRemoveCartItem={handleRemoveCartItem}
                  onClearCart={handleClearCart}
                  activities={activities}
                  recipients={recipients}
                  assetUnits={assetUnits}
                  onOpenAddRecipient={() => setIsAddRecipientOpen(true)}
                  onSubmitIssue={handleSubmitIssueCart}
                  isSubmitting={isSubmittingCart}
                />
              </div>
            </PersistentPage>

          {/* ========================================================================= */}
          {/* TAB 2: เบิก–คืน (Custody Flow & Production Hub)                             */}
          {/* ========================================================================= */}
          {activeMainTab === 'flows' && (
            <div className="space-y-4">
                <CustodyFlowView
                  assetUnits={assetUnits}
                  items={items}
                  rounds={rounds}
                  activities={activities}
                  recipients={recipients}
                  operations={operations}
                  legacyBorrowedUnits={legacyBorrowedUnits}
                  onReturnTools={handleReturnTools}
                  onHandoverTools={handleHandoverTools}
                  onAdoptOrReturnLegacyTool={handleAdoptOrReturnLegacyTool}
                  onReturnMaterials={handleReturnMaterials}
                  onRecoverMaterials={handleRecoverMaterials}
                  onInspectRecovery={handleInspectRecovery}
                />
            </div>
          )}

          {activeMainTab === 'production' && <ProductionHubView
            activities={activities}
            initialProjectId={issueProjectId}
            isActive={isActive}
            userProfile={userProfile}
            onOpenIssueCartWithProject={projectId => {
              setIssueProjectId(projectId || ''); setIsMobileCartOpen(true); setActiveMainTab('stock');
            }}
          />}

          {/* ========================================================================= */}
          {/* TAB 3: เงินสด (Petty Cash Vault - RBAC Gated)                         */}
          {/* ========================================================================= */}
          {activeMainTab === 'cash' && (
            <CashVaultView
              cashSummary={cashSummary}
              isLoading={isCashLoading}
              error={cashError}
              errorType={cashErrorType}
              isPrivileged={isPrivilegedCashUser}
              activities={activities}
              recipients={recipients}
              legacyBanknotes={items.filter(it => it.item_type === 'banknote')}
              onDepositCash={handleDepositCash}
              onRecordCountedOpening={handleRecordCountedOpening}
              onReserveCash={handleReserveCash}
              onReleaseCashReservation={handleReleaseCashReservation}
              onUpdateCashThresholds={handleUpdateCashThresholds}
              onIssueCashBatch={handleIssueCashBatch}
              onHandoverCashBatch={handleHandoverCashBatch}
              onReceivePreparedCash={handleReceivePreparedCash}
              onReturnUnusedRawCash={handleReturnUnusedRawCash}
              onDeliverCashToCustomer={handleDeliverCashToCustomer}
              onRefreshCash={refreshCash}
            />
          )}

          {/* ========================================================================= */}
          {/* TAB 4: ประวัติ (History Audit & Legacy Records)                           */}
          {/* ========================================================================= */}
          {activeMainTab === 'history' && (
            <HistoryAuditView
              assetLoans={assetLoans}
              checklistItems={checklistItems}
              items={items}
              activities={activities}
              onOpenProjectModal={onOpenProjectModal}
              isPrivilegedCash={isPrivilegedCashUser}
            />
          )}
            </>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* MODALS & FLOATING GAME BAG DOCK                                           */}
      {/* ========================================================================= */}

      {/* Floating + Slide-Up Game Bag Dock (Appears automatically when items/cash are picked!) */}
      {isActive && viewExperience === 'game' && (
        <GameActionModal
          bagItems={gameBagItems}
          bagCashLines={gameBagCashLines}
          editingBagId={editingStagedBagId}
          editingBagTitle={editingStagedBagTitle}
          isExpanded={isGameBagExpanded}
          onToggleExpand={() => setIsGameBagExpanded((v) => !v)}
          onClearBag={handleClearGameBag}
          onUpdateBagItemQty={handleUpdateGameBagItemQty}
          onToggleBagItemUnit={handleToggleGameBagItemUnit}
          onAddComboItem={handleAddComboToGameBag}
          onRemoveBagItem={handleRemoveGameBagItem}
          onUpdateCashLine={handleUpdateGameCashLine}
          onRemoveCashLine={handleRemoveGameCashLine}
          initialProjectIds={gameInitialProjectIds}
          items={items}
          assetUnits={assetUnits}
          activities={activities}
          recipients={recipients}
          cashSummary={cashSummary}
          isPrivilegedCashUser={isPrivilegedCashUser}
          stagedBags={stagedBags}
          onSaveStagedBag={handleSaveStagedBag}
          onDeleteStagedBag={handleDeleteStagedBag}
          onCreateIssue={handleSubmitIssueCart}
          onIssueCashBatch={handleIssueCashBatch}
          onRefreshAll={async () => {
            await refreshSummary();
            await refreshOperations();
            if (isPrivilegedCashUser) await refreshCash();
          }}
          onNotify={showToast}
        />
      )}

      {/* Add / Edit Catalog Item Modal */}
      {isItemModalOpen && <ItemFormModal
        isOpen={isItemModalOpen}
        onClose={() => {
          setIsItemModalOpen(false);
          setEditingItem(null);
          setCreatingToolForPrint(false);
          returnToPrintRef.current = false;
        }}
        editingItem={editingItem}
        categories={categories}
        onSaveItem={handleSaveItem}
        onAddUnit={handleSaveUnit}
        defaultItemType={creatingToolForPrint ? 'asset' : 'consumable'}
        lockItemType={creatingToolForPrint}
        supportsItemImages={capabilities.item_images === true}
        imageUploadReady={Boolean(inventoryImageFolderId && driveUploadUrl)}
        onUploadImage={(file) => uploadInventoryImage(file, {folderId: inventoryImageFolderId, scriptUrl: driveUploadUrl})}
      />}

      {/* Stock Receive / Adjust Modal */}
      <StockAdjustModal
        isOpen={isStockAdjustOpen}
        onClose={() => setIsStockAdjustOpen(false)}
        items={items}
        onAdjustStock={handleAdjustStock}
      />

      {/* Category Management Modal */}
      <CategoryManageModal
        isOpen={isCategoriesOpen}
        onClose={() => setIsCategoriesOpen(false)}
        categories={categories}
        onCreateCategory={handleCreateCategory}
        onRenameCategory={handleRenameCategory}
        onRetireCategory={handleRetireCategory}
      />

      {/* Add Recipient (Casual helper / Staff / Team) Modal */}
      <AddRecipientModal
        isOpen={isAddRecipientOpen}
        onClose={() => setIsAddRecipientOpen(false)}
        onAddRecipient={handleAddRecipient}
      />

      {/* Add Serialized Tool Unit Code Modal */}
      {isAddUnitOpen && <AddAssetUnitModal
        isOpen={isAddUnitOpen}
        onClose={() => {
          setIsAddUnitOpen(false);
          setTargetItemForUnit(null);
          setUnitCatalogItems(null);
          returnToPrintRef.current = false;
          unitCatalogRequestRef.current += 1;
        }}
        targetItem={targetItemForUnit}
        items={unitCatalogItems || items}
        onSearchItems={unitCatalogItems && !targetItemForUnit ? loadUnitCatalog : undefined}
        onSaveUnit={handleSaveUnit}
      />}

      {/* QR Scanner Modal (Lazy loaded, leak-proof unmount on isActive=false) */}
      {isActive && isScannerOpen && (
        <Suspense fallback={
          <div className="fixed inset-0 z-[120] bg-zinc-950 flex flex-col items-center justify-center p-4 text-white">
            <RefreshCw className="w-7 h-7 animate-spin mb-3 opacity-80" />
            <div className="text-sm font-semibold text-white/90">กำลังเปิดกล้องสแกน...</div>
          </div>
        }>
          <QrScanner
            isOpen={isScannerOpen}
            autoStart={true}
            onClose={() => setIsScannerOpen(false)}
            onScan={handleScanCode}
          />
        </Suspense>
      )}

      {/* QR Label Print Workspace (Lazy loaded, leak-proof unmount on isActive=false) */}
      {isActive && isPrintWorkspaceOpen && (
        <Suspense fallback={
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="p-4 bg-white rounded-xl shadow-lg text-xs font-bold text-slate-700">กำลังเตรียมระบบพิมพ์ฉลาก QR...</div>
          </div>
        }>
          <QrLabelPrint
            units={printUnits}
            items={[...new Map([...items, ...printUnits.filter(unit => unit.item).map(unit => unit.item)].map(item => [item.id, item])).values()]}
            categories={categories}
            initialSelectedUnitCodes={printUnitCodes}
            onAddUnitRequest={handleAddPrintUnit}
            onQuickCreateUnit={handleQuickCreatePrintUnit}
            onClose={() => {
              setIsPrintWorkspaceOpen(false);
              setPrintUnitCodes([]);
            }}
            onPrintSuccess={() => showToast('ส่งคำสั่งพิมพ์ฉลากสำเร็จ')}
          />
        </Suspense>
      )}
    </div>
  );
}
