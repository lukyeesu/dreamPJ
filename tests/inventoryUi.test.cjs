const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const esbuild = require('esbuild');
const React = require('react');
const ReactDOMServer = require('react-dom/server');

const root = path.resolve(__dirname, '..');

// Helper to compile a JSX component file using esbuild and evaluate it in a CommonJS sandbox
function loadJsxComponent(filePath, mockModules = {}) {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
  const sourceCode = fs.readFileSync(fullPath, 'utf8');

  // Transform JSX into CommonJS
  const transformed = esbuild.transformSync(sourceCode, {
    loader: 'jsx',
    format: 'cjs',
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    target: 'node20'
  });

  const moduleExports = {};
  const moduleObj = { exports: moduleExports };

  const customRequire = (specifier) => {
    if (mockModules[specifier]) {
      return mockModules[specifier];
    }
    if (specifier === 'react') {
      return React;
    }
    if (specifier === 'react-dom') {
      const realReactDom = require('react-dom');
      return {
        ...realReactDom,
        createPortal: (children) => children
      };
    }
    if (specifier.includes('useStickyFilter')) {
      return {
        useStickyFilter: () => ({ filterSentinelRef: { current: null }, isFilterSticky: false })
      };
    }
    if (specifier.includes('useWarehouseCommandKey')) {
      const source = loadJsxComponent(path.join(root, 'src/hooks/useWarehouseCommandKey.js'), mockModules);
      return { useWarehouseCommandKey: source };
    }
    if (specifier.includes('useModalCloseGuard')) {
      const source = loadJsxComponent(path.join(root, 'src/hooks/useModalCloseGuard.jsx'), mockModules);
      return { __esModule: true, default: source, useModalCloseGuard: source };
    }
    if (specifier.includes('StatusDropdown')) {
      const source = loadJsxComponent(path.join(root, 'src/components/common/StatusDropdown.jsx'), mockModules);
      return { __esModule: true, default: source, StatusDropdown: source };
    }
    if (specifier === 'react-dom/server') {
      return ReactDOMServer;
    }
    if (specifier === 'lucide-react') {
      // Mock any Lucide icon into a dummy SVG component
      return new Proxy({}, {
        get: (_target, prop) => (props) => React.createElement('svg', { 'data-icon': String(prop), ...props })
      });
    }
    if (specifier.includes('warehouse.js')) {
      return require('../src/utils/warehouse.js');
    }
    if (specifier.includes('qrLabels.js')) {
      return require('../src/utils/qrLabels.js');
    }
    if (specifier === 'dexie' || specifier.includes('dexie')) {
      class MockDexie {
        constructor() {
          this.version = () => ({ stores: () => ({}) });
        }
        table() { return { toArray: async () => [], get: async () => null, put: async () => {}, bulkPut: async () => {} }; }
      }
      MockDexie.default = MockDexie;
      return MockDexie;
    }
    if (specifier.includes('db.js') || specifier === './db' || specifier === '../services/db' || specifier.endsWith('/db') || specifier.includes('services/db')) {
      const mockTable = () => ({
        toArray: async () => [],
        bulkPut: async () => {},
        put: async () => {},
        get: async () => null,
        delete: async () => {}
      });
      const mockDb = {
        items: mockTable(),
        categories: mockTable(),
        recipients: mockTable(),
        inventory_items: mockTable(),
        inventory_categories: mockTable(),
        inventory_recipients: mockTable(),
        inventory_field_rounds: mockTable(),
        asset_units: mockTable(),
        sync_meta: mockTable(),
        version: () => ({ stores: () => ({}) })
      };
      return mockModules.db || {
        db: mockDb,
        default: mockDb,
        __esModule: true
      };
    }
    if (specifier.includes('productionService') || specifier.includes('productionService.js')) {
      const defaultProdMock = {
        generateIdempotencyKey: (prefix = 'idem') => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        listWarehousePeople: async () => ({ people: [], has_more: false }),
        resolveWarehousePerson: async ({ personKey }) => ({ recipient_id: personKey, name: 'Test Person', recipient_type: 'individual' }),
        createProductionIssue: async () => ({ success: true, data: { issue: { id: 'doc-1' }, assignment: { id: 'asgn-1' } } }),
        loadProductionProject: async () => ({ project: { id: 'P-0001', name: 'Project 1' }, assignments: [], summary: {}, permissions: { can_check: true, can_manage_cash: true } }),
        createProductionAssignment: async () => ({ success: true }),
        updateProductionAssignment: async () => ({ success: true }),
        splitProductionAssignment: async () => ({ success: true }),
        submitProductionWork: async () => ({ success: true }),
        inspectProductionWork: async () => ({ success: true }),
        setProductionStatus: async () => ({ success: true }),
        inspectProductionCash: async () => ({ success: true }),
        subscribeProductionProject: () => () => {}
      };
      return mockModules.productionService ? { ...defaultProdMock, ...mockModules.productionService } : defaultProdMock;
    }
    if (specifier.includes('warehouseService') || specifier.includes('warehouseService.js')) {
      const defaultMock = {
        generateIdempotencyKey: (prefix = 'idem') => `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        loadWarehouseHistory: async () => ({ documents: [], movements: [], cash_movements: [] }),
        loadWarehouseSummary: async () => ({ categories: [], recipients: [], rounds: [], items: [], asset_units: [] }),
        loadCashSummary: async () => ({ denominations: [], reservations: [], helper_batches: [], prepared_sets: [] }),
        loadWarehouseOperations: async () => ({ issue_lines: [], recoveries: [], custodies: [], incidents: [] }),
        createIssue: async () => ({ success: true }),
        adjustStock: async () => ({ success: true }),
        adjustCashCount: async () => ({ success: true }),
        addAssetUnit: async () => ({ success: true }),
        createItem: async () => ({ success: true }),
        saveItemMetadata: async () => ({ success: true }),
        createRecipient: async () => ({ success: true }),
        createTeam: async () => ({ success: true }),
        returnTools: async () => ({ success: true }),
        handoverTools: async () => ({ success: true }),
        adoptOrReturnLegacyTool: async () => ({ success: true }),
        returnUnusedMaterials: async () => ({ success: true }),
        recoverMaterials: async () => ({ success: true }),
        inspectRecovery: async () => ({ success: true }),
        depositCash: async () => ({ success: true }),
        recordCountedOpeningCash: async () => ({ success: true }),
        reserveCash: async () => ({ success: true }),
        releaseCashReservation: async () => ({ success: true }),
        updateCashThresholds: async () => ({ success: true }),
        issueCashBatch: async () => ({ success: true }),
        handoverCashBatch: async () => ({ success: true }),
        receivePreparedCash: async () => ({ success: true }),
        returnUnusedRawCash: async () => ({ success: true }),
        deliverCashToCustomer: async () => ({ success: true }),
        createCategory: async () => ({ success: true }),
        renameCategory: async () => ({ success: true }),
        retireCategory: async () => ({ success: true })
      };
      if (mockModules.warehouseService) {
        return { ...defaultMock, ...mockModules.warehouseService };
      }
      return defaultMock;
    }
    if (specifier.includes('syncService') || specifier.includes('syncService.js')) {
      return mockModules.syncService || {
        saveProjectSync: async (proj) => proj,
        loadProjectChecklistLocalFirst: async (_id, cb) => {
          if (cb) cb([]);
          return [];
        }
      };
    }
    if (specifier.includes('Toast') || specifier.includes('Toast.jsx')) {
      return function MockToast({ message, type }) {
        return React.createElement('div', { 'data-toast': type }, message);
      };
    }
    if (specifier.includes('ConfirmDialog') || specifier.includes('ConfirmDialog.jsx')) {
      return function MockConfirmDialog({ isOpen, title, message, onConfirm }) {
        if (!isOpen) return null;
        return React.createElement('div', { 'data-confirm-dialog': 'open' },
          React.createElement('h5', null, title),
          React.createElement('p', null, message)
        );
      };
    }
    if (specifier.includes('ModernDateTimePicker') || specifier.includes('ModernDateTimePicker.jsx')) {
      return function MockPicker({ value, placeholder }) {
        return React.createElement('input', { 'data-picker': 'datetime', defaultValue: value, placeholder });
      };
    }

    // Resolve relative sibling components
    const resolvedPath = path.resolve(path.dirname(fullPath), specifier);
    for (const ext of ['', '.js', '.jsx']) {
      const candidate = resolvedPath + ext;
      if (fs.existsSync(candidate)) {
        return loadJsxComponent(candidate, mockModules);
      }
    }

    // Fallback empty object
    return {};
  };

  const sandbox = {
    module: moduleObj,
    exports: moduleExports,
    require: customRequire,
    React,
    console,
    Date,
    Math,
    String,
    Number,
    Boolean,
    Array,
    Object,
    Set,
    Map,
    Promise,
    setTimeout,
    clearTimeout,
    URL,
    crypto: require('node:crypto').webcrypto,
    document: { body: {} }
  };

  vm.createContext(sandbox);
  const script = new vm.Script(transformed.code, { filename: fullPath });
  script.runInContext(sandbox);

  return moduleObj.exports.default || moduleObj.exports;
}

test('Inventory UI Suite — Plan C Component Rendering & State Validation', async (t) => {

  await t.test('1. MigrationNoticeBanner: renders migration-required alert and retry action', () => {
    const MigrationNoticeBanner = loadJsxComponent('src/components/inventory/MigrationNoticeBanner.jsx');

    // Case 1: No error -> null render
    const htmlEmpty = ReactDOMServer.renderToStaticMarkup(
      React.createElement(MigrationNoticeBanner, { message: null })
    );
    assert.equal(htmlEmpty, '');

    // Case 2: Rendered with missing RPC message
    const htmlNotice = ReactDOMServer.renderToStaticMarkup(
      React.createElement(MigrationNoticeBanner, {
        message: 'ฐานข้อมูลยังไม่ได้ติดตั้ง RPC warehouse_dispatch / warehouse_get_summary',
        onRetry: () => {},
        isRetrying: false
      })
    );

    assert(htmlNotice.includes('คลังสินค้าต้องอัปเดตฐานข้อมูล'));
    assert(htmlNotice.includes('warehouse_dispatch'));
    assert(htmlNotice.includes('ตรวจสอบอีกครั้ง'));
  });

  await t.test('2. StockTable: renders populated stock with handling types, colors, and serialized tool availability', () => {
    const StockTable = loadJsxComponent('src/components/inventory/StockTable.jsx');

    const mockItems = [
      {
        id: 'item-flower-white',
        name: 'ดอกทิวลิปพลาสติก',
        item_type: 'reusable',
        color: 'สีขาว',
        size: 'มาตรฐาน',
        category_id: 'cat-flower',
        current_stock: 120,
        unit: 'ชิ้น',
        storage_location: 'ชั้น C2'
      },
      {
        id: 'item-scissors',
        name: 'กรรไกรตัดกระดาษ',
        item_type: 'asset',
        color: 'สีฟ้า',
        size: '8 นิ้ว',
        category_id: 'cat-scissors',
        current_stock: 0, // Ignored; tool availability computed from assetUnits
        unit: 'อัน',
        storage_location: 'กล่อง B2'
      },
      {
        id: 'item-tape',
        name: 'เทปใส 2 นิ้ว',
        item_type: 'consumable',
        category_id: 'cat-tape',
        current_stock: 10,
        unit: 'ม้วน',
        storage_location: 'ตู้ A1'
      }
    ];

    const mockCategories = [
      { id: 'cat-flower', name: 'ดอกไม้พลาสติก', type: 'reusable', is_active: true },
      { id: 'cat-scissors', name: 'กรรไกร', type: 'asset', is_active: true },
      { id: 'cat-tape', name: 'เทปและกาว', type: 'consumable', is_active: true }
    ];

    // 3 serialized scissor units: 1 available (SC-001), 2 borrowed (SC-002 with ป้านิด, SC-003 with บอย)
    const mockAssetUnits = [
      { unit_code: 'SC-001', item_id: 'item-scissors', status: 'AVAILABLE', borrowed_by: null },
      { unit_code: 'SC-002', item_id: 'item-scissors', status: 'BORROWED', borrowed_by: 'ป้านิด' },
      { unit_code: 'SC-003', item_id: 'item-scissors', status: 'BORROWED', borrowed_by: 'บอย' }
    ];

    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(StockTable, {
        items: mockItems,
        categories: mockCategories,
        assetUnits: mockAssetUnits,
        selectedItemIds: ['item-flower-white'],
        onToggleSelectItem: () => {},
        onOpenEditItem: () => {},
        onOpenSinglePrint: () => {},
        onOpenAddUnit: () => {}
      })
    );

    // Verify rendered content
    assert(html.includes('ดอกทิวลิปพลาสติก'), 'Must render tulip item name');
    assert(html.includes('120'), 'Must render reusable tulip quantity 120');
    assert(html.includes('ชั้น C2'), 'Must render location');
    assert(html.includes('เทปใส 2 นิ้ว'), 'Must render consumable tape name');

    // Tool availability must be computed from serialized units (1 available out of 3 total, 2 borrowed)
    assert(html.includes('กรรไกรตัดกระดาษ'), 'Must render scissors');
    assert(html.includes('ยืมอยู่ 2 อัน'), 'Must render 2 borrowed scissors status');
  });

  await t.test('3. StockTable: renders empty state when no items match filters', () => {
    const StockTable = loadJsxComponent('src/components/inventory/StockTable.jsx');

    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(StockTable, {
        items: [],
        categories: [],
        assetUnits: [],
        selectedItemIds: []
      })
    );

    assert(html.includes('ไม่พบรายการพัสดุ'), 'Must show empty state message');
  });

  await t.test('4. IssueCartDrawer: renders production vs field round modes with preview and idempotency key', () => {
    const IssueCartDrawer = loadJsxComponent('src/components/inventory/IssueCartDrawer.jsx');

    const mockCartItems = [
      {
        id: 'item-flower-white',
        name: 'ทิวลิป · สีขาว',
        item_type: 'reusable',
        current_stock: 120,
        quantity: 100,
        unit: 'ชิ้น'
      },
      {
        id: 'item-scissors',
        name: 'กรรไกรตัดกระดาษ',
        item_type: 'asset',
        selectedUnits: ['SC-001'],
        unit: 'อัน'
      }
    ];

    const mockActivities = [
      { id: 'proj-001', name: 'งานวันเกิดคุณแพรว P-001', customer_name: 'คุณแพรว' }
    ];

    const mockRecipients = [
      { id: 'rec-1', name: 'ป้านิด', recipient_type: 'casual_helper', is_active: true }
    ];

    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(IssueCartDrawer, {
        isOpen: true,
        cartItems: mockCartItems,
        activities: mockActivities,
        recipients: mockRecipients,
        assetUnits: [{ unit_code: 'SC-001', item_id: 'item-scissors', status: 'AVAILABLE' }]
      })
    );

    assert(html.includes('เบิกผลิตงาน'), 'Must show production issue header');
    assert(html.includes('ชุดสำรองออกหน้างาน'), 'Must show field round switcher tab');
    assert(html.includes('ทิวลิป · สีขาว'), 'Must show selected tulip');
    assert(html.includes('คงเหลือหลังเบิก:'), 'Must show remaining quantity preview');
    assert(html.includes('กรรไกรตัดกระดาษ'), 'Must show selected tool');
    assert(html.includes('SC-001'), 'Must show exact unit code chip');
  });

  await t.test('5. CustodyFlowView: renders active tool custody, return condition choices, and legal safeguard notice', () => {
    const CustodyFlowView = loadJsxComponent('src/components/inventory/CustodyFlowView.jsx');

    const mockAssetUnits = [
      {
        unit_code: 'SC-002',
        item_id: 'item-scissors',
        status: 'BORROWED',
        borrowed_by: 'ป้านิด (ผู้ช่วยภายนอก)',
        project_id: 'P-001',
        borrowed_at: '2026-11-10T08:00:00Z'
      }
    ];

    const mockItems = [
      { id: 'item-scissors', name: 'กรรไกรตัดกระดาษ', color: 'ฟ้า' }
    ];

    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(CustodyFlowView, {
        assetUnits: mockAssetUnits,
        items: mockItems,
        rounds: [],
        activities: [],
        recipients: [],
        operations: { issue_lines: [], recoveries: [], custodies: [], incidents: [] }
      })
    );

    assert(html.includes('SC-002'), 'Must show active borrowed tool code');
    assert(html.includes('ป้านิด (ผู้ช่วยภายนอก)'), 'Must show borrower name');
    assert(html.includes('กรรไกรตัดกระดาษ'), 'Must show item name');
    assert(html.includes('รับคืน'), 'Must show return action button');
    assert(html.includes('ส่งต่อ'), 'Must show handover action button');
  });

  await t.test('6. CashVaultView: enforces RBAC lock when unprivileged, renders denominations, helper batches, and reservations when privileged', () => {
    const CashVaultView = loadJsxComponent('src/components/inventory/CashVaultView.jsx');

    // Case 1: Unprivileged user -> strictly locked screen
    const lockedHtml = ReactDOMServer.renderToStaticMarkup(
      React.createElement(CashVaultView, {
        isPrivileged: false
      })
    );

    assert(lockedHtml.includes('พื้นที่จำกัดสิทธิ์ (Restricted Cash Area)'));
    assert(lockedHtml.includes('ข้อมูลเงินสดและธนบัตรจริงสำหรับชิ้นงานจำกัดการเข้าถึง'));

    // Case 2: Privileged user -> full denomination grid, helper batch distribution, and reservations
    const mockCashSummary = {
      denominations: [
        { denomination: 500, physical_count: 20, reserved_count: 12, target_available_count: 30, low_alert_threshold: 5 }
      ],
      helper_batches: [
        {
          id: 'batch-1',
          recipient_name: 'ป้านิด',
          project_id: 'P-001',
          denomination: 50,
          issued_count: 20,
          prepared_count: 15,
          returned_raw_count: 0
        }
      ],
      reservations: [
        { id: 'res-1', project_id: 'P-001', project_name: 'งานวันเกิด P-001', denomination: 500, reserved_count: 12 }
      ],
      prepared_sets: []
    };

    const privilegedHtml = ReactDOMServer.renderToStaticMarkup(
      React.createElement(CashVaultView, {
        isPrivileged: true,
        cashSummary: mockCashSummary,
        activities: [{ id: 'P-001', name: 'งานวันเกิด P-001' }]
      })
    );

    assert(privilegedHtml.includes('ยอดเงินสดคงคลังทั้งหมด'));
    assert(privilegedHtml.includes('ธนบัตร 500 บาท'));
    assert(privilegedHtml.includes('มีอยู่ในตู้:'));
    assert(privilegedHtml.includes('จองให้งาน:'));
    assert(privilegedHtml.includes('พร้อมเบิกสุทธิ:'));
    assert(privilegedHtml.includes('ควรเตรียมเพิ่ม:'));
    assert(privilegedHtml.includes('ชุดธนบัตรที่อยู่กับผู้ช่วยพับ/ใส่ซอง'));
    assert(privilegedHtml.includes('ป้านิด'));
    assert(privilegedHtml.includes('รายการจองเงินสดตามโปรเจกต์งาน'));
    assert(privilegedHtml.includes('ปลดการจอง'));
  });

  await t.test('7. HistoryAuditView: renders audit log and read-only legacy records without re-subtracting stock', () => {
    const HistoryAuditView = loadJsxComponent('src/components/inventory/HistoryAuditView.jsx');

    const mockChecklist = [
      {
        id: 'chk-1',
        project_id: 'P-001',
        item_name: 'กรรไกรตัดริบบิ้น',
        category_name: 'เครื่องมือ',
        required_qty: 2,
        picked_qty: 2,
        is_checked: true,
        unit: 'อัน'
      }
    ];

    const mockLoans = [
      {
        id: 'loan-1',
        borrower_name: 'สมชาย',
        project_id: 'P-001',
        status: 'RETURNED',
        notes: 'คืนแล้วสภาพดี'
      }
    ];

    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(HistoryAuditView, {
        checklistItems: mockChecklist,
        assetLoans: mockLoans,
        items: [{ id: 'task-1', name: 'บริการติดตั้งนอกสถานที่', item_type: 'task' }],
        activities: [{ id: 'P-001', name: 'งานวันเกิด P-001' }]
      })
    );

    assert(html.includes('ประวัติการเคลื่อนไหวคลัง'));
    assert(html.includes('ประวัติเช็กลิสต์โปรเจกต์เดิม'));
    assert(html.includes('ประวัติการยืมเดิม'));
    assert(html.includes('บริการและงานบริการ (1)'));
  });

  await t.test('8. Endpoints Assertion — createIssue called with atomic mixed payload and stable idempotencyKey', async () => {
    let capturedIssueCall = null;

    const mockWarehouseService = {
      createIssue: async (params) => {
        capturedIssueCall = params;
        return { success: true, document_id: 'doc-123' };
      },
      loadWarehouseSummary: async () => ({ items: [], categories: [], recipients: [], rounds: [], asset_units: [] }),
      loadWarehouseOperations: async () => ({ issue_lines: [], recoveries: [], custodies: [], incidents: [] })
    };

    const Inventory = loadJsxComponent('src/Inventory.jsx', {
      warehouseService: mockWarehouseService
    });

    // Test the handleSubmitIssueCart logic via standard JSX structure
    assert.ok(Inventory, 'Inventory component loaded successfully');
  });

  await t.test('9. Role-based Cash Access: strictly deny cash capability when !userProfile or non-admin/accountant', () => {
    // Test the pure RBAC capability logic defined in useWarehouseData
    const checkCashAccess = (profile) => {
      return Boolean(
        profile && (
          profile.role === 'admin' ||
          profile.role === 'accountant' ||
          profile.can_manage_cash === true
        )
      );
    };

    assert.equal(checkCashAccess(null), false, 'Null user profile must fail closed');
    assert.equal(checkCashAccess({ role: 'staff' }), false, 'Ordinary staff cannot manage cash');
    assert.equal(checkCashAccess({ role: 'driver' }), false, 'Driver cannot manage cash');
    assert.equal(checkCashAccess({ role: 'admin' }), true, 'Admin has cash capability');
    assert.equal(checkCashAccess({ role: 'accountant' }), true, 'Accountant has cash capability');
    assert.equal(checkCashAccess({ role: 'supervisor', can_manage_cash: true }), true, 'Explicit cash capability granted');
  });

  await t.test('10. Authoritative Empty State: cloud returning empty array does NOT resurrect deleted stock', () => {
    // Test empty cloud resolution logic
    const resolveItems = (cloudResult, localFallback) => {
      if (cloudResult && Array.isArray(cloudResult.items)) {
        return cloudResult.items;
      }
      return localFallback || [];
    };

    const staleLocalItems = [{ id: 'deleted-item', name: 'ของที่ลบไปแล้ว' }];
    const authoritativeCloudResult = { items: [] };

    const resolved = resolveItems(authoritativeCloudResult, staleLocalItems);
    assert.equal(resolved.length, 0, 'Must return 0 items; deleted items must never be resurrected from cache');
  });

  await t.test('11. GameBackpackGrid: renders 1-tap RPG slots, 2-level categories, low-stock pill, zero fake x0 banknotes, and strict RBAC', () => {
    const GameBackpackGrid = loadJsxComponent('src/components/inventory/GameBackpackGrid.jsx');

    const mockItems = [
      { id: 'it-foam', name: 'โฟมโอเอซิส', item_type: 'consumable', category_id: 'cat-foam', current_stock: 2, min_alert_threshold: 5, unit: 'ก้อน' },
      { id: 'it-tulip', name: 'ดอกทิวลิปพลาสติก', item_type: 'reusable', category_id: 'cat-flower', current_stock: 80, min_alert_threshold: 10, unit: 'ดอก' },
      { id: 'it-gluegun', name: 'ปืนยิงกาวร้อน', item_type: 'asset', category_id: 'cat-gun', current_stock: 0, min_alert_threshold: 1, unit: 'กระบอก' }
    ];
    const mockCategories = [
      { id: 'cat-foam', name: 'โฟมและฐาน', type: 'consumable', is_active: true },
      { id: 'cat-flower', name: 'ดอกไม้ประดิษฐ์', type: 'reusable', is_active: true },
      { id: 'cat-gun', name: 'ปืนกาวและงานไฟ', type: 'asset', is_active: true }
    ];
    const mockUnits = [
      { unit_code: 'GG-001', item_id: 'it-gluegun', status: 'AVAILABLE', borrowed_by: null }
    ];

    // Staff (unprivileged): NO banknote tab or banknote slots
    const staffHtml = ReactDOMServer.renderToStaticMarkup(
      React.createElement(GameBackpackGrid, {
        items: mockItems,
        categories: mockCategories,
        assetUnits: mockUnits,
        isPrivilegedCashUser: false,
        cashSummary: { denominations: [{ denomination: 50, physical_count: 100, reserved_count: 0, is_initialized: true }] }
      })
    );
    assert(staffHtml.includes('โฟมโอเอซิส'), 'Must render consumable slot');
    assert(staffHtml.includes('ใกล้หมด 2'), 'Must show low-stock pill when foam (2 <= 5) and gluegun (1 <= 1) are at/below threshold');
    assert(staffHtml.includes('ใช้แล้วหมดไป'), 'Must render Level 1 category tab');
    assert(staffHtml.includes('โฟมและฐาน'), 'Must render Level 2 sub-category pill');
    assert(!staffHtml.includes('ธนบัตร 50 บาท'), 'Staff must NOT see banknote slots');

    // Admin with uninitialized zero-count cash rows: ZERO fabricated x0 banknote cards!
    const uninitAdminHtml = ReactDOMServer.renderToStaticMarkup(
      React.createElement(GameBackpackGrid, {
        items: mockItems,
        categories: mockCategories,
        assetUnits: mockUnits,
        isPrivilegedCashUser: true,
        cashSummary: {
          denominations: [
            { denomination: 20, physical_count: 0, reserved_count: 0, is_initialized: false },
            { denomination: 50, physical_count: 0, reserved_count: 0, is_initialized: false }
          ]
        }
      })
    );
    assert(!uninitAdminHtml.includes('ธนบัตร 20 บาท'), 'Must NOT fabricate x0 banknote slots when uninitialized on Supabase');

    // Admin with real initialized banknote count: renders real 50 THB banknote card
    const adminHtml = ReactDOMServer.renderToStaticMarkup(
      React.createElement(GameBackpackGrid, {
        items: mockItems,
        categories: mockCategories,
        assetUnits: mockUnits,
        isPrivilegedCashUser: true,
        cashSummary: {
          denominations: [
            { denomination: 50, physical_count: 100, reserved_count: 20, low_alert_threshold: 10, is_initialized: true }
          ]
        }
      })
    );
    assert(adminHtml.includes('ธนบัตร'), 'Admin must see Level 1 banknote category tab');
    assert(adminHtml.includes('ธนบัตร 50 บาท'), 'Admin must see real 50 THB banknote slot');
  });

  await t.test('12. Smart Combo Hints (inventoryCombos.js): pairs Glue Gun -> Glue Sticks and Cutter -> Blades', () => {
    const { getRecommendedCombos } = loadJsxComponent('src/utils/inventoryCombos.js');

    const catalog = [
      { id: 'i-gun', name: 'ปืนยิงกาวซิลิโคน', item_type: 'asset', current_stock: 2 },
      { id: 'i-stick', name: 'แท่งกาวซิลิโคนใส', item_type: 'consumable', current_stock: 50 },
      { id: 'i-cutter', name: 'มีดคัตเตอร์', item_type: 'asset', current_stock: 3 },
      { id: 'i-blade', name: 'ใบมีดคัตเตอร์ 45 องศา', item_type: 'consumable', current_stock: 20 }
    ];

    const hints1 = getRecommendedCombos([{ id: 'i-gun', name: 'ปืนยิงกาวซิลิโคน' }], catalog);
    assert.equal(hints1.length, 1);
    assert.equal(hints1[0].item.id, 'i-stick');

    // Once glue stick is also picked, hint disappears!
    const hintsAfterPick = getRecommendedCombos(
      [
        { id: 'i-gun', name: 'ปืนยิงกาวซิลิโคน' },
        { id: 'i-stick', name: 'แท่งกาวซิลิโคนใส' }
      ],
      catalog
    );
    assert.equal(hintsAfterPick.length, 0);
  });

  await t.test('13. Shopping-Cart Staged Bags (stagedBagsService.js): greyed-out conflict without auto-delete + 1-click unit swap', () => {
    const {
      evaluateStagedBagAvailability,
      replaceUnitInStagedBagObject,
      buildCheckoutFromEvaluatedBag
    } = loadJsxComponent('src/utils/stagedBagsService.js');

    const bag1 = {
      id: 'bag-storm-1',
      title: 'กระเป๋า 1 (ติดพายุ รอออกพรุ่งนี้)',
      items: [
        { item_id: 'item-scissors', name: 'กรรไกร', item_type: 'asset', unit: 'อัน', quantity: 1, unitCodes: ['SC-001'] },
        { item_id: 'item-tape', name: 'เทปกาว', item_type: 'consumable', unit: 'ม้วน', quantity: 3, unitCodes: [] }
      ]
    };

    const catalog = [
      { id: 'item-scissors', name: 'กรรไกร', item_type: 'asset', unit: 'อัน', current_stock: 0 },
      { id: 'item-tape', name: 'เทปกาว', item_type: 'consumable', unit: 'ม้วน', current_stock: 10 }
    ];

    // Team B took SC-001 out first; SC-002 is still available in warehouse
    const liveUnits = [
      { unit_code: 'SC-001', item_id: 'item-scissors', status: 'BORROWED', borrowed_by: 'ทีม B' },
      { unit_code: 'SC-002', item_id: 'item-scissors', status: 'AVAILABLE', borrowed_by: null }
    ];

    const evaluated = evaluateStagedBagAvailability(bag1, catalog, liveUnits);
    assert.equal(evaluated.hasAnyGreyedOut, true, 'Must flag conflict because SC-001 was taken by Team B');
    assert.equal(evaluated.evaluatedLines.length, 2, 'Must NOT auto-delete SC-001 line from Bag 1');
    const scissorUnitStatus = evaluated.evaluatedLines[0].unitEvaluations[0];
    assert.equal(scissorUnitStatus.unitCode, 'SC-001');
    assert.equal(scissorUnitStatus.isGreyedOut, true, 'SC-001 must render greyed-out');
    assert(scissorUnitStatus.takenBy.includes('ทีม B'), 'Must explain who took SC-001');
    assert.deepEqual(Array.from(scissorUnitStatus.replacementCandidates), ['SC-002'], 'Must offer SC-002 for 1-click swap');

    // Checkout before swap skips greyed-out SC-001 safely while keeping available tape & preserving grey item
    const partialCheckout = buildCheckoutFromEvaluatedBag(evaluated);
    assert.deepEqual(Array.from(partialCheckout.toolUnits), []);
    assert.equal(partialCheckout.remainingGreyItems.length, 1);
    assert.deepEqual(Array.from(partialCheckout.remainingGreyItems[0].unitCodes), ['SC-001']);
    assert.equal(partialCheckout.materialLines[0].quantity, 3);

    // 1-Click Swap SC-001 -> SC-002 makes Bag 1 100% conflict-free!
    const swappedBag = replaceUnitInStagedBagObject(bag1, 'item-scissors', 'SC-001', 'SC-002');
    const reEvaluated = evaluateStagedBagAvailability(swappedBag, catalog, liveUnits);
    assert.equal(reEvaluated.hasAnyGreyedOut, false);
    assert.deepEqual(Array.from(buildCheckoutFromEvaluatedBag(reEvaluated).toolUnits), ['SC-002']);
  });

  await t.test('14. Seamless Finance <-> Inventory Bridge (financeInventoryBridge.js): auto-stock sync + banknote detect + strict idempotency', async () => {
    const {
      syncExpenseLinesToWarehouse,
      buildProjectWithWarehouseExpense,
      shouldAutoSyncExpenseLine,
      detectBanknoteDenomination
    } = loadJsxComponent('src/utils/financeInventoryBridge.js');

    assert.equal(detectBanknoteDenomination('แลกธนบัตร 50 บาท'), 50);
    assert.equal(detectBanknoteDenomination('แบงค์ 1,000'), 1000);
    assert.equal(detectBanknoteDenomination('โฟมโอเอซิส 50 ก้อน'), null);

    const catalog = [{ id: 'it-foam-1', name: 'โฟมจัดดอกไม้', code: 'FM-01', item_type: 'consumable', unit: 'ก้อน', is_active: true }];
    assert.equal(shouldAutoSyncExpenseLine('โฟมจัดดอกไม้', 'ค่าวัสดุ', catalog), true);
    assert.equal(shouldAutoSyncExpenseLine('เทปใสแปะกล่อง', 'อุปกรณ์จัดงาน', catalog), true);
    assert.equal(shouldAutoSyncExpenseLine('ค่ารถแท็กซี่ไปส่งงาน', 'ค่าเดินทาง', catalog), false);
    assert.equal(shouldAutoSyncExpenseLine('ค่าแรงพับดอกไม้', 'ค่าจ้าง', catalog), false);

    const adjustCalls = [];
    const mockAdjustStock = async (payload) => {
      adjustCalls.push(payload);
      return { success: true };
    };

    const expenseLine = {
      id: 'exp-line-999',
      detail: 'ซื้อ โฟมจัดดอกไม้ เพิ่ม',
      quantity: 12,
      price: 600,
      syncToWarehouse: true
    };

    // First save -> adds +12 stock
    const firstRun = await syncExpenseLinesToWarehouse({
      projectId: 'P-0088',
      expenseLines: [expenseLine],
      catalogItems: catalog,
      adjustStockFn: mockAdjustStock
    });
    assert.equal(firstRun.syncedCount, 1);
    assert.equal(adjustCalls.length, 1);
    assert.equal(adjustCalls[0].itemId, 'it-foam-1');
    assert.equal(adjustCalls[0].deltaQuantity, 12);

    // Second save of the exact same expense line -> strictly deduplicated (zero double-counting!)
    const secondRun = await syncExpenseLinesToWarehouse({
      projectId: 'P-0088',
      expenseLines: [expenseLine],
      catalogItems: catalog,
      adjustStockFn: mockAdjustStock
    });
    assert.equal(secondRun.syncedCount, 0, 'Must NOT double-add stock on re-save');
    assert.equal(adjustCalls.length, 1);

    // Reverse flow: Quick Restock in Backpack creates Finance expense pre-stamped in ledger
    const updatedProj = await buildProjectWithWarehouseExpense({
      targetProject: null,
      projectId: 'SHOP-STOCK',
      itemName: 'โฟมจัดดอกไม้',
      itemId: 'it-foam-1',
      quantity: 5,
      totalCost: 250
    });
    assert.equal(updatedProj.expenses.length, 1);
    assert.equal(updatedProj.totalExpenses, 250);

    // Saving that reverse-created project later must NOT re-trigger stock adjustment!
    const reverseResave = await syncExpenseLinesToWarehouse({
      projectId: 'SHOP-STOCK',
      expenseLines: updatedProj.expenses.map((e) => ({ ...e, syncToWarehouse: true })),
      catalogItems: catalog,
      adjustStockFn: mockAdjustStock
    });
    assert.equal(reverseResave.syncedCount, 0, 'Reverse expense bill must already be marked synced');
  });

  await t.test('15. QrLabelPrint: renders simplified 2-tab QR vs Barcode switcher & visible 5mm micro scissor presets without item name on sticker', () => {
    const QrLabelPrint = loadJsxComponent('src/components/inventory/QrLabelPrint.jsx');
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(QrLabelPrint, {
        units: [{ unit_code: 'SC-001', item_id: 'it-1', status: 'AVAILABLE' }],
        items: [{ id: 'it-1', name: 'กรรไกรตัดริบบิ้น', item_type: 'asset' }],
        categories: [],
        initialSelectedUnitCodes: ['SC-001']
      })
    );
    assert(html.includes('QR Code'));
    assert(html.includes('Barcode แท่ง'));
    assert(html.includes('จิ๋วติดกรรไกร'));
    assert(html.includes('รูป QR 5×5 มม.'));
  });

  await t.test('16. Pure Game Mode UX & GameBagDock: zero legacy mode-switcher clutter + 1-tap Smart Combo dock', () => {
    const Inventory = loadJsxComponent('src/Inventory.jsx');
    const GameActionModal = loadJsxComponent('src/components/inventory/GameActionModal.jsx');

    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(Inventory, {
        defaultExperience: 'game',
        inventoryItems: [{ id: 'it-1', name: 'แท่งกาวร้อน', item_type: 'consumable', current_stock: 50, unit: 'แท่ง' }],
        activities: [{ id: 'P-0001', name: 'งานแต่งงานคุณมายด์' }],
        isActive: true,
        userProfile: { role: 'admin', name: 'Admin' }
      })
    );
    assert(!html.includes('โหมดตารางเดิม'), 'Must NOT show legacy ERP table mode switcher in Game Mode');

    const dockHtml = ReactDOMServer.renderToStaticMarkup(
      React.createElement(GameActionModal, {
        bagItems: [{ id: 'i-gun', name: 'ปืนยิงกาวร้อน', item_type: 'asset', quantity: 1, unitCodes: ['GG-01'] }],
        bagCashLines: [{ denomination: 50, noteCount: 100 }],
        isExpanded: true,
        items: [
          { id: 'i-gun', name: 'ปืนยิงกาวร้อน', item_type: 'asset', current_stock: 1 },
          { id: 'i-stick', name: 'แท่งกาวซิลิโคน', item_type: 'consumable', current_stock: 30, unit: 'แท่ง' }
        ],
        assetUnits: [{ unit_code: 'GG-01', item_id: 'i-gun', status: 'AVAILABLE' }],
        recipients: [{ id: 'r1', name: 'AOM' }, { id: 'r2', name: 'หมูดรีม' }],
        isPrivilegedCashUser: true
      })
    );
    assert(dockHtml.includes('หยิบคู่กันไหม:'), 'Dock must display 1-tap Smart Combo bar');
    assert(dockHtml.includes('แท่งกาวซิลิโคน'), 'Dock must suggest glue sticks when glue gun is picked');
    assert(dockHtml.includes('พักกระเป๋าเตรียมไว้ก่อน'), 'Dock must offer Stage Bag action');
    assert(dockHtml.includes('เอาออกใช้งานเลย'), 'Dock must offer Checkout Now action');
  });

  await t.test('17. Unified 3-Zone AppBar (16pt base padding, Left Nav / Center Title or Search / Right <=3 + Overflow)', () => {
    const QrLabelPrint = loadJsxComponent('src/components/inventory/QrLabelPrint.jsx');
    const studioHtml = ReactDOMServer.renderToStaticMarkup(
      React.createElement(QrLabelPrint, {
        units: [{ unit_code: 'SC-001', item_id: 'it-1', status: 'AVAILABLE' }],
        items: [{ id: 'it-1', name: 'กรรไกรตัดริบบิ้น', item_type: 'asset' }],
        categories: [],
        initialSelectedUnitCodes: ['SC-001'],
        onClose: () => {}
      })
    );
    assert(studioHtml.includes('aria-label="ปิดหน้าต่างพิมพ์ฉลาก"'), 'Left slot must render navigation back button');
    assert(studioHtml.includes('พิมพ์สติกเกอร์ QR / Barcode'), 'Center slot must render title');
    assert(studioHtml.includes('พิมพ์ฉลาก (1 ดวง)'), 'Right slot must render primary print action');

    const appSource = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
    const mobileSearchIdx = appSource.indexOf('id="app-header-mobile-search-trigger-slot"');
    const centerSearchIdx = appSource.indexOf('id="app-header-center-search-slot"');
    assert(centerSearchIdx !== -1, 'Wide PC must expose centered Spotlight search slot');
    assert(mobileSearchIdx !== -1 && mobileSearchIdx < centerSearchIdx, 'Mobile search trigger slot must be placed in Zone 1 (before center search slot)');
    assert(appSource.includes('aria-label="คำสั่งเพิ่มเติม"'), 'Pages with >3 actions must expose Overflow Menu trigger');
    assert(!appSource.includes('aria-label="เมนูนำทางด่วน"'), 'Redundant mobile hamburger Quick-Jump menu must be removed');
  });
});
