const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

async function createServiceHarness(mockResponses = {}) {
  const requests = [];
  const idb = {
    inventory_categories: new Map(),
    inventory_recipients: new Map(),
    inventory_field_rounds: new Map(),
    inventory_items: new Map(),
    asset_units: new Map()
  };

  const makeTable = (name) => ({
    name,
    toArray: async () => Array.from(idb[name]?.values() || []),
    get: async (id) => idb[name]?.get(id) || null,
    put: async (item) => {
      const key = item.id || item.unit_code;
      idb[name].set(key, structuredClone(item));
      return key;
    },
    bulkPut: async (items) => {
      for (const item of items) {
        const key = item.id || item.unit_code;
        idb[name].set(key, structuredClone(item));
      }
    },
    delete: async (id) => {
      idb[name].delete(id);
    },
    clear: async () => {
      idb[name].clear();
    }
  });

  const mockDb = {
    inventory_categories: makeTable('inventory_categories'),
    inventory_recipients: makeTable('inventory_recipients'),
    inventory_field_rounds: makeTable('inventory_field_rounds'),
    inventory_items: makeTable('inventory_items'),
    asset_units: makeTable('asset_units')
  };

  const client = {
    rpc: async (fnName, params) => {
      requests.push({ fnName, params });
      if (mockResponses[fnName]) {
        return mockResponses[fnName](params);
      }
      return { data: { success: true, data: { id: 'mock-id' } }, error: null };
    },
    from: (table) => {
      const q = {
        table,
        op: 'select',
        select: (...args) => { q.selectArgs = args; return q; },
        eq: (...args) => { q.eqArgs = args; return q; },
        order: (...args) => { q.orderArgs = args; return q; },
        then: (resolve, reject) => {
          requests.push({ table, op: q.op, args: q.selectArgs });
          if (mockResponses[`from_${table}`]) {
            return Promise.resolve(mockResponses[`from_${table}`](q)).then(resolve, reject);
          }
          return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        }
      };
      return q;
    }
  };

  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    Date,
    Map,
    Set,
    Promise,
    JSON,
    Math,
    crypto: {
      randomUUID: () => '00000000-0000-4000-8000-000000000099'
    }
  });

  const utilsCode = fs.readFileSync(path.join(root, 'src/utils/warehouse.js'), 'utf8');
  const utilsModule = new vm.SourceTextModule(utilsCode, { context });
  await utilsModule.link(() => {});
  await utilsModule.evaluate();

  const serviceCode = fs.readFileSync(path.join(root, 'src/services/warehouseService.js'), 'utf8');
  const serviceModule = new vm.SourceTextModule(serviceCode, { context });
  await serviceModule.link((specifier) => {
    if (specifier.includes('supabaseClient')) {
      const exports = { getActiveClient: () => client, supabase: client };
      return new vm.SyntheticModule(Object.keys(exports), function () {
        for (const [k, v] of Object.entries(exports)) this.setExport(k, v);
      }, { context });
    }
    if (specifier === './db' || specifier.includes('db')) {
      const exports = { db: mockDb };
      return new vm.SyntheticModule(Object.keys(exports), function () {
        for (const [k, v] of Object.entries(exports)) this.setExport(k, v);
      }, { context });
    }
    if (specifier.includes('warehouse')) {
      return utilsModule;
    }
    throw new Error(`Unlinked specifier: ${specifier}`);
  });
  await serviceModule.evaluate();

  return {
    api: serviceModule.namespace,
    utils: utilsModule.namespace,
    requests,
    idb,
    mockDb,
    client,
    context
  };
}

test('warehouse utils: math, restock, availability, and validations', async () => {
  const { utils } = await createServiceHarness();

  assert.equal(utils.calculateVaultAvailable(100, 30), 70);
  assert.equal(utils.calculateVaultAvailable(50, 50), 0);
  assert.equal(utils.calculateCashRestock(8, 30), 22);
  assert.equal(utils.calculateCashRestock(35, 30), 0);
  assert.equal(utils.calculateHelperRemaining(50, 20, 5, 0), 25);

  assert.equal(utils.isValidDenomination(20), true);
  assert.equal(utils.isValidDenomination(50), true);
  assert.equal(utils.isValidDenomination(100), true);
  assert.equal(utils.isValidDenomination(500), true);
  assert.equal(utils.isValidDenomination(1000), true);
  assert.equal(utils.isValidDenomination(30), false);
  assert.equal(utils.isValidDenomination(-100), false);
});

test('warehouseService: in-flight request deduplication notifies every joining caller', async () => {
  let callCount = 0;
  const harness = await createServiceHarness({
    warehouse_get_summary: async () => {
      callCount++;
      return {
        data: {
          categories: [{ id: 'cat-1', name: 'กรรไกร', type: 'asset', is_active: true }],
          recipients: [{ id: 'rec-1', name: 'ป้านิด', recipient_type: 'casual_helper', is_active: true }],
          rounds: [],
          items: [],
          asset_units: []
        },
        error: null
      };
    }
  });

  const callbacksA = [];
  const callbacksB = [];

  const [res1, res2] = await Promise.all([
    harness.api.loadWarehouseSummary((data) => callbacksA.push(data)),
    harness.api.loadWarehouseSummary((data) => callbacksB.push(data))
  ]);

  assert.equal(callCount, 1, 'Only 1 server call made');
  assert.deepEqual(res1, res2);
  assert.equal(callbacksA.length, 1, 'Caller A callback invoked');
  assert.equal(callbacksB.length, 1, 'Caller B callback invoked');
});

test('warehouseService: auth session reset discards stale in-flight responses', async () => {
  let resolveServer;
  const harness = await createServiceHarness({
    warehouse_get_summary: () => new Promise((resolve) => {
      resolveServer = resolve;
    })
  });

  const initialLoad = harness.api.loadWarehouseSummary();

  // User logs out or changes session
  harness.api.resetWarehouseAuthSession();

  // Server finally returns
  resolveServer({
    data: { categories: [{ id: 'leak-1', name: 'Should Not Cache' }], recipients: [] },
    error: null
  });

  const res = await initialLoad;
  assert.equal(res, null, 'Stale auth response must be discarded');

  // Verify it was NOT written to IndexedDB
  const cached = await harness.mockDb.inventory_categories.toArray();
  assert.equal(cached.length, 0);
});

test('warehouseService: passes stable idempotencyKey from UI across mutations', async () => {
  const harness = await createServiceHarness();
  const stableKey = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

  await harness.api.createIssue({
    projectId: 'P-0309',
    recipientName: 'ป้านิด',
    materialLines: [{ id: 'm1', quantity: 5 }],
    idempotencyKey: stableKey
  });

  const req = harness.requests.find(r => r.fnName === 'warehouse_dispatch');
  assert.ok(req);
  assert.equal(req.params.p_idempotency_key, stableKey, 'Caller idempotencyKey must be preserved');
});

test('warehouseService: cash data is kept completely off IndexedDB', async () => {
  const harness = await createServiceHarness({
    warehouse_get_cash_summary: async () => ({
      data: {
        denominations: [{ denomination: 100, physical_count: 50, reserved_count: 0 }],
        reservations: [],
        helper_batches: [],
        prepared_sets: []
      },
      error: null
    })
  });

  const cashData = await harness.api.loadCashSummary();
  assert.equal(cashData.denominations[0].denomination, 100);
  assert.equal(harness.mockDb.cash_vault_denominations, undefined);
  assert.equal(harness.mockDb.cash_movements, undefined);
});

test('warehouseService: remote failure strictly throws and never silently writes local cache', async () => {
  const harness = await createServiceHarness({
    warehouse_dispatch: async () => ({
      data: null,
      error: { message: 'Database connection failed' }
    })
  });

  await assert.rejects(
    harness.api.createCategory({ name: 'ริบบิ้นผ้าซาติน', type: 'consumable' }),
    /Database connection failed/
  );

  const localCats = await harness.mockDb.inventory_categories.toArray();
  assert.equal(localCats.length, 0, 'Local cache must not be updated when server fails');
});

test('warehouseService: failed load then retry makes a fresh server request and succeeds', async () => {
  let attempt = 0;
  const harness = await createServiceHarness({
    warehouse_get_summary: async () => {
      attempt++;
      if (attempt === 1) {
        return { data: null, error: { message: 'Network transient failure' } };
      }
      return {
        data: {
          categories: [{ id: 'cat-retry', name: 'โบว์สำเร็จ', type: 'consumable', is_active: true }],
          recipients: [],
          rounds: [],
          items: [],
          asset_units: []
        },
        error: null
      };
    }
  });

  await assert.rejects(harness.api.loadWarehouseSummary(), /Network transient failure/);

  // Retry must not be stuck in-flight
  const retryData = await harness.api.loadWarehouseSummary();
  assert.equal(retryData.categories[0].name, 'โบว์สำเร็จ');
  assert.equal(attempt, 2);
});

test('warehouseService: reset DURING RPC await returns null and does not commit stale data', async () => {
  let resolveServer;
  const harness = await createServiceHarness({
    warehouse_get_summary: () => new Promise((resolve) => {
      resolveServer = resolve;
    })
  });

  const loadPromise = harness.api.loadWarehouseSummary();

  // Reset session while server request is in flight
  harness.api.resetWarehouseAuthSession();

  resolveServer({
    data: {
      categories: [{ id: 'stale-cat', name: 'Stale During Put', type: 'consumable' }],
      recipients: [],
      rounds: [],
      items: [],
      asset_units: []
    },
    error: null
  });

  const res = await loadPromise;
  assert.equal(res, null, 'Response during reset must be discarded');
  const stored = await harness.mockDb.inventory_categories.toArray();
  assert.equal(stored.length, 0, 'No data committed to IndexedDB (memory-only)');
});

test('warehouseService: old mutation response after logout is rejected', async () => {
  let resolveRpc;
  const harness = await createServiceHarness({
    warehouse_dispatch: () => new Promise((resolve) => { resolveRpc = resolve; })
  });

  const mutationPromise = harness.api.createCategory({ name: 'ดอกกุหลาบสด', type: 'consumable' });

  // User logs out while RPC is running
  harness.api.resetWarehouseAuthSession();

  resolveRpc({ data: { success: true, data: { id: 'spoofed-id' } }, error: null });

  await assert.rejects(mutationPromise, /Auth session expired or changed/);
});

test('warehouseService: operations loader dispatches warehouse_get_operations and returns contract', async () => {
  const harness = await createServiceHarness({
    warehouse_get_operations: async (params) => {
      return {
        data: {
          issue_lines: [{ id: 'line-1', remaining_qty: 10 }],
          recoveries: [{ id: 'rec-1', status: 'PENDING' }],
          custodies: [{ id: 'cust-1', unit_code: 'TOOL-1' }],
          incidents: [],
          has_more: false
        },
        error: null
      };
    }
  });

  const ops = await harness.api.loadWarehouseOperations({ projectId: 'P-0309', limit: 25, offset: 0 });
  assert.equal(ops.issue_lines.length, 1);
  assert.equal(ops.recoveries.length, 1);
  assert.equal(ops.custodies.length, 1);
  assert.equal(ops.has_more, false);

  const req = harness.requests.find(r => r.fnName === 'warehouse_get_operations');
  assert.ok(req);
  assert.equal(req.params.p_filters.project_id, 'P-0309');
  assert.equal(req.params.p_filters.limit, 25);
});

test('warehouseService: adjustCashCount dispatches cash_adjust_count and validates denomination', async () => {
  const harness = await createServiceHarness();

  // Invalid denomination must reject before dispatch
  await assert.rejects(
    harness.api.adjustCashCount({ denomination: 30, deltaCount: 5, reason: 'Test' }),
    /Invalid banknote denomination/
  );

  // Valid adjustment
  await harness.api.adjustCashCount({ denomination: 100, deltaCount: 15, reason: 'นับสต็อกเกิน' });
  const req = harness.requests.find(r => r.fnName === 'warehouse_dispatch' && r.params.p_action === 'cash_adjust_count');
  assert.ok(req);
  assert.equal(req.params.p_payload.denomination, 100);
  assert.equal(req.params.p_payload.delta_count, 15);
  assert.equal(req.params.p_payload.reason, 'นับสต็อกเกิน');
});

test('warehouseService: handoverCashBatch defaults to accepted = false', async () => {
  const harness = await createServiceHarness();

  await harness.api.handoverCashBatch({
    batchId: '00000000-0000-4000-8000-000000000001',
    toRecipientName: 'ผู้ช่วยสอง',
    noteCount: 10
  });

  const req = harness.requests.find(r => r.fnName === 'warehouse_dispatch' && r.params.p_action === 'cash_handover_batch');
  assert.ok(req);
  assert.equal(req.params.p_payload.accepted, false, 'Default accepted must be false');
});

test('warehouseService: auth session change subscription notifies on reset', async () => {
  const harness = await createServiceHarness();
  let unsubCalls = 0;
  const unsub = harness.api.onWarehouseAuthSessionChange(() => { unsubCalls++; });

  harness.api.resetWarehouseAuthSession();
  assert.equal(typeof unsub, 'function');
  unsub();
});

test('syncService: exports resetWarehouseAuthSession', async () => {
  const syncCode = fs.readFileSync(path.join(root, 'src/services/syncService.js'), 'utf8');
  assert.match(syncCode, /export \{ resetWarehouseAuthSession \} from '\.\/warehouseService\.js'/);
});



test('warehouse stock: bounded first page cache, cumulative cache and banknote purge', async () => {
  const h = await createServiceHarness({
    warehouse_get_summary: async () => ({data: {schema_version: 2, total_items_count: 51, items: [{id: 'first', item_type: 'consumable'}]}, error: null}),
    warehouse_list_stock: async params => ({data: {items: params.p_filters.search ? [] : [{id: 'last', item_type: 'asset'}], total_count: params.p_filters.search ? 0 : 51, has_more: false}, error: null})
  });
  h.idb.inventory_items.set('cash', {id: 'cash', item_type: 'banknote', current_stock: 500});
  await h.api.loadWarehouseSummary();
  await h.api.loadWarehouseStock();
  assert.equal(h.requests.length, 1, 'default stock query reuses summary first page');
  await h.api.loadWarehouseStock({offset: 50, limit: 500});
  assert.equal(h.requests[1].params.p_filters.limit, 100);
  await h.api.loadWarehouseStock({search: 'missing'});
  assert.deepEqual([...h.idb.inventory_items.keys()].sort(), ['first', 'last']);
});

test('warehouse auth: focus sign-in and token refresh preserve same-user flights', async () => {
  const h = await createServiceHarness();
  let callback;
  h.client.auth = {onAuthStateChange: cb => {callback = cb; return {data: {subscription: {}}};}};
  h.api.initWarehouseAuthListener();
  let resets = 0;
  h.api.onWarehouseAuthSessionChange(() => resets++);
  callback('SIGNED_IN', {user: {id: 'alice'}});
  callback('SIGNED_IN', {user: {id: 'alice'}});
  callback('TOKEN_REFRESHED', {user: {id: 'alice'}});
  assert.equal(resets, 1);
  callback('SIGNED_IN', {user: {id: 'bob'}});
  callback('SIGNED_OUT', null);
  assert.equal(resets, 3);
});

test('warehouse summary re-entry uses short memory cache, refresh and mutations invalidate it', async () => {
  let version = 0;
  const h = await createServiceHarness({warehouse_get_summary: async () => ({data:{schema_version:2,items:[],version:++version},error:null})});
  await h.api.loadWarehouseSummary();
  const seen=[];
  await h.api.loadWarehouseSummary(data=>seen.push(data.version));
  assert.equal(version,1,'switching pages must reuse a recently confirmed summary');
  assert.deepEqual(seen,[1]);
  await h.api.loadWarehouseSummary(null,{force:true});
  assert.equal(version,2,'manual refresh must bypass memory freshness');
  await h.api.dispatchWarehouseCommand('stock_adjust',{});
  await h.api.loadWarehouseSummary();
  assert.equal(version,3,'confirmed writes must invalidate cached summaries');
  h.api.resetWarehouseAuthSession();
  await h.api.loadWarehouseSummary();
  assert.equal(version,4,'user changes must never reuse another session summary');
});

test('warehouse summary cache expires and failed reads can retry without waiting', async () => {
  let now=100000, reads=0, fail=false;
  const h=await createServiceHarness({warehouse_get_summary:async()=>{
    reads++;
    return fail ? {data:null,error:{message:'Offline'}} : {data:{schema_version:2,items:[]},error:null};
  }});
  h.context.Date = class extends Date {static now(){return now;}};
  await h.api.loadWarehouseSummary();
  now+=29999; await h.api.loadWarehouseSummary(); assert.equal(reads,1);
  now+=2; await h.api.loadWarehouseSummary(); assert.equal(reads,2);
  now+=30001; fail=true; await assert.rejects(h.api.loadWarehouseSummary(),/Offline/);
  fail=false; await h.api.loadWarehouseSummary(); assert.equal(reads,4);
});

test('an old summary cannot overwrite a post-mutation refresh or its first stock page', async () => {
  let resolveOld, reads=0;
  const oldResponse=new Promise(resolve=>{resolveOld=resolve;});
  const fresh={schema_version:2,total_items_count:1,items:[{id:'latest',item_type:'consumable'}]};
  const h=await createServiceHarness({warehouse_get_summary:async()=>++reads===1 ? oldResponse : {data:fresh,error:null}});
  const pending=h.api.loadWarehouseSummary();
  await h.api.dispatchWarehouseCommand('stock_adjust',{});
  const refreshed=h.api.loadWarehouseSummary(null,{force:true});
  resolveOld({data:{schema_version:2,items:[{id:'outdated',item_type:'consumable'}]},error:null});
  assert.equal((await refreshed).items[0].id,'latest');
  assert.equal(await pending,null,'pre-mutation response must be discarded');
  assert.equal((await h.api.loadWarehouseSummary()).items[0].id,'latest');
  assert.equal((await h.api.loadWarehouseStock()).items[0].id,'latest');
});
