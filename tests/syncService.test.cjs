const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parse } = require('@babel/parser');
const root = path.resolve(__dirname, '..');
const clone = x => structuredClone(x);
const remote = (id, extra = {}) => ({ id, name: id, raw_delivery_start: '2026-11-10T10:00:00', ...extra });
const local = (id, extra = {}) => ({ id, rawDeliveryStart: '2026-11-10T10:00:00', ...extra });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function makeStore(keyName = 'id', initialItems = [], deletedLog = null) {
  const map = new Map(initialItems.map(x => [x[keyName], clone(x)]));
  return {
    map,
    toArray: async () => clone([...map.values()]),
    get: async id => clone(map.get(id)),
    bulkGet: async ids => ids.map(id => clone(map.get(id))),
    put: async row => map.set(row[keyName], clone(row)),
    bulkPut: async items => items.forEach(row => map.set(row[keyName], clone(row))),
    delete: async id => { if (deletedLog) deletedLog.push(id); map.delete(id); },
    bulkDelete: async ids => ids.forEach(id => { if (deletedLog) deletedLog.push(id); map.delete(id); }),
    clear: async () => map.clear()
  };
}
async function harness(initial = [], respond = () => ({ data: [], error: null, count: 0 }), extraGlobals = {}) {
  const requests = [], deleted = [], listeners = [], channels = [], removedChannels = [];
  const projectsStore = makeStore('id', initial, deleted);
  const rows = projectsStore.map;
  const db = {
    transaction: async (_mode, _table, callback) => callback(),
    projects: projectsStore,
    quotations: makeStore('id'),
    material_rates: makeStore('id'),
    delivery_locations: makeStore('id'),
    artists: makeStore('id'),
    customers: makeStore('id'),
    staff: makeStore('id'),
    sync_meta: makeStore('key')
  };
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'test-user' } } } }) },
    from(table) {
      const q = { table, op: 'select', filters: [] };
      for (const method of ['select','gte','lte','lt','gt','eq','like','ilike','in','order','range','limit','maybeSingle','single','upsert','insert','update','delete']) {
        q[method] = (...args) => { q[method + 'Args'] = args; if (['insert','update','delete','upsert'].includes(method)) q.op = method; if (['eq','like','ilike','in','gte','lte','lt','gt'].includes(method)) q.filters.push([method, ...args]); return q; };
      }
      q.then = (ok, fail) => { requests.push(q); return Promise.resolve().then(() => respond(q)).then(ok, fail); };
      return q;
    },
    rpc(name, payload) { const q = { table: name, op: 'rpc', payload }; requests.push(q); return Promise.resolve().then(() => respond(q)); },
    channel(name) {
      const ch = {
        name,
        on(event, filter, cb) { listeners.push({ channel: name, event, filter, cb }); return this; },
        subscribe() { return this; },
        send() { return Promise.resolve(); }
      };
      channels.push(ch);
      return ch;
    },
    removeChannel(ch) { removedChannels.push(ch); }
  };
  const schemas = await import(pathToFileURL(path.join(root, 'src/schemas/index.js')));
  const warehouseMock = {
    resetWarehouseAuthSession: () => {},
    onWarehouseAuthSessionChange: () => () => {},
    initWarehouseAuthListener: () => {},
    generateIdempotencyKey: () => '00000000-0000-4000-8000-000000000001',
    dispatchWarehouseCommand: () => Promise.resolve({ success: true }),
    loadWarehouseSummary: () => Promise.resolve({}),
    loadCashSummary: () => Promise.resolve({}),
    loadWarehouseOperations: () => Promise.resolve({}),
    loadWarehouseHistory: () => Promise.resolve({}),
    createItem: () => Promise.resolve({ success: true }),
    saveItemMetadata: () => Promise.resolve({ success: true }),
    addAssetUnit: () => Promise.resolve({ success: true })
  };
  const useNullClient = extraGlobals.__nullClient === true;
  const cleanGlobals = { ...extraGlobals };
  delete cleanGlobals.__nullClient;
  const activeClient = useNullClient ? null : client;
  const context = vm.createContext({ console: { log() {}, warn() {}, error() {} }, Date, Map, Set, Promise, JSON, Uint8Array, Math, ...cleanGlobals });
  const module = new vm.SourceTextModule(fs.readFileSync(path.join(root, 'src/services/syncService.js'), 'utf8'), { context });
  await module.link(specifier => {
    const exports = specifier.includes('supabaseClient') ? { supabase: activeClient, getActiveClient: () => activeClient }
      : specifier === './db' ? { db }
      : specifier.includes('formatters') ? { generateTrackingToken: () => '' }
      : specifier.includes('warehouseService') ? warehouseMock
      : schemas;
    return new vm.SyntheticModule(Object.keys(exports), function () { for (const [key, value] of Object.entries(exports)) this.setExport(key, value); }, { context });
  });
  await module.evaluate();
  return { api: module.namespace, rows, requests, deleted, listeners, channels, removedChannels, db };
}

test('simultaneous month callers share the remote request', async () => {
  const h = await harness([], () => ({ data: [remote('p1')], count: 1, error: null }));
  await Promise.all([h.api.loadProjectsByMonth('2026-11'), h.api.loadProjectsByMonth('2026-11')]);
  assert.equal(h.requests.length, 1);
});
test('successful empty months are throttled too', async () => {
  const h = await harness();
  await h.api.loadProjectsByMonth('2026-11'); await h.api.loadProjectsByMonth('2026-11');
  assert.equal(h.requests.length, 1);
});
test('failed fetches are retried immediately', async () => {
  let calls = 0;
  const h = await harness([local('p1')], () => ++calls === 1 ? { error: { message: 'offline' }, data: null } : { data: [remote('p1')], count: 1, error: null });
  await h.api.loadProjectsByMonth('2026-11'); await h.api.loadProjectsByMonth('2026-11');
  assert.equal(h.requests.length, 2);
});
test('every concurrent caller receives empty results and deletion IDs', async () => {
  const gate = deferred(); const h = await harness([local('p1')], async () => { await gate.promise; return { data: [], count: 0, error: null }; });
  const updates = [[], []];
  const loads = updates.map(log => h.api.loadProjectsByMonth('2026-11', (rows, ids = []) => log.push({ rows, ids })));
  await new Promise(r => setImmediate(r)); gate.resolve(); await Promise.all(loads);
  for (const log of updates) { assert(log.some(x => x.rows.length === 0 && x.ids.includes('p1'))); }
});
test('summary loads preserve cached child rows and private details', async () => {
  const rich = local('p1', { expenses: [{ price: 400 }], quotationItems: [{ price: 800 }], customerSupport: [{ price: 500 }], images: ['one','two'], slips: ['slip'], customerInfo: { phone: '0800000000', address: 'address' } });
  const h = await harness([rich], () => ({ data: [remote('p1', { primary_image_url: 'one' })], count: 1, error: null }));
  await h.api.loadProjectsByMonth('2026-11');
  const saved = h.rows.get('p1');
  for (const key of ['expenses','quotationItems','customerSupport','images','slips']) assert.deepEqual(saved[key], rich[key], key);
  for (const [key, value] of Object.entries(rich.customerInfo)) assert.equal(saved.customerInfo[key], value, key);
});
test('full detail loads can clear old child rows without clearing omitted media', async () => {
  const h = await harness([local('p1', { expenses: [{ price: 400 }], slips: ['slip'] })], q => q.table === 'projects' ? { data: [remote('p1')], count: 1, error: null } : { data: [], error: null });
  await h.api.loadProjectsByMonth('2026-11', null, { includeDetails: true });
  assert.equal(h.rows.get('p1').expenses.length, 0); assert.deepEqual(h.rows.get('p1').slips, ['slip']);
});
test('a failed second page never reconciles valid cached rows as deleted', async () => {
  const h = await harness([local('p50')], q => q.rangeArgs[0] === 0 ? { data: Array.from({ length: 50 }, (_, i) => remote('p' + i)), count: 51, error: null } : { data: null, error: { message: 'page failed' } });
  await h.api.loadProjectsByMonth('2026-11'); assert(h.rows.has('p50')); assert.equal(h.deleted.length, 0);
});
test('monthly pagination handles server row caps without deleting missing pages', async () => {
  const all = Array.from({ length: 1200 }, (_, i) => remote('p' + i));
  const h = await harness([local('p1199')], q => ({ data: all.slice(q.rangeArgs[0], Math.min(q.rangeArgs[1] + 1, q.rangeArgs[0] + 100)), count: 1200, error: null }));
  const result = await h.api.loadProjectsByMonth('2026-11');
  assert.equal(result.length, 1200); assert(h.rows.has('p1199'));
});
test('date/range loaders also deduplicate requests and propagate deletion IDs', async () => {
  const h = await harness([local('p1')]); const updates = [[], []];
  await Promise.all(updates.map(log => h.api.loadProjectsScoped({ mode: 'date', date: '2026-11-10' }, (rows, ids = []) => log.push({ rows, ids }))));
  assert.equal(h.requests.length, 1);
  for (const log of updates) assert(log.some(x => x.ids.includes('p1')));
});
test('unrelated payment dates do not cause cache deletion in another delivery scope', async () => {
  const h = await harness([local('p1', { rawDeliveryStart: '2026-12-01T10:00:00', paymentDate: '2026-11-10' })]);
  await h.api.loadProjectsByMonth('2026-11'); assert(h.rows.has('p1'));
});
test('saving uses one transaction RPC and keeps cache unchanged on failure', async () => {
  const old = local('p1', { name: 'old' });
  const h = await harness([old], q => q.op === 'rpc' || q.op === 'insert' ? { data: null, error: { message: 'child constraint failed' } } : { data: [], error: null });
  await assert.rejects(h.api.saveProjectSync({ ...old, name: 'new', expenses: [{ price: 400 }] }));
  assert.equal(h.rows.get('p1').name, 'old'); assert.equal(h.requests.length, 1); assert.equal(h.requests[0].op, 'rpc');
});
test('successful save writes local cache only after the server commits', async () => {
  const gate = deferred(); const h = await harness([local('p1', { name: 'old' })], async () => { await gate.promise; return { data: null, error: null }; });
  const saving = h.api.saveProjectSync(local('p1', { name: 'new' }));
  await new Promise(r => setImmediate(r)); assert.equal(h.rows.get('p1').name, 'old'); gate.resolve();
  assert.equal((await saving).success, true); assert.equal(h.rows.get('p1').name, 'new');
});
test('Realtime deletes propagate IDs to a merging consumer', async () => {
  const h = await harness([local('p1'), local('p2')]); let state = [...h.rows.values()];
  h.api.subscribeToRealtimeProjects((items, deletedIds = []) => {
    const map = new Map(state.filter(x => !deletedIds.includes(x.id)).map(x => [x.id, x])); items.forEach(x => map.set(x.id, x)); state = [...map.values()];
  });
  await h.listeners[0].cb({ eventType: 'DELETE', old: { id: 'p1' } });
  assert(!h.rows.has('p1')); assert(!state.some(x => x.id === 'p1'));
});
test('logging out cancels cache writes from pending project requests', async () => {
  const gate = deferred(); const h = await harness([], async () => { await gate.promise; return { data: [remote('p1')], count: 1, error: null }; });
  let updates = 0;
  const loading = h.api.loadProjectsByMonth('2026-11', () => updates++);
  await new Promise(r => setImmediate(r)); h.api.resetProjectLoadCache(); gate.resolve(); await loading;
  assert.equal(h.rows.size, 0); assert.equal(updates, 0);
});
test('failed child reads preserve detailed cache and allow immediate retry', async () => {
  const h = await harness([local('p1', { expenses: [{ price: 400 }] })], q => q.table === 'projects' ? { data: [remote('p1')], count: 1, error: null } : { data: null, error: { message: 'child read failed' } });
  await h.api.loadProjectsByMonth('2026-11', null, { includeDetails: true });
  await h.api.loadProjectsByMonth('2026-11', null, { includeDetails: true });
  assert.equal(h.rows.get('p1').expenses[0].price, 400);
  assert.equal(h.requests.filter(x => x.table === 'projects').length, 2);
});
test('summary cache does not suppress a request for financial details', async () => {
  const h = await harness([], q => q.table === 'projects' ? { data: [remote('p1')], count: 1, error: null } : { data: [], error: null });
  await h.api.loadProjectsByMonth('2026-11');
  await h.api.loadProjectsByMonth('2026-11', null, { includeDetails: true });
  assert.equal(h.requests.filter(x => x.table === 'projects').length, 2);
  assert.equal(h.requests.filter(x => x.table !== 'projects').length, 3);
});
test('a caller joining after page one receives final deletion IDs', async () => {
  const gate = deferred();
  const h = await harness([local('deleted')], async q => {
    if (q.rangeArgs[0] === 0) return { data: Array.from({ length: 50 }, (_, i) => remote('p' + i)), count: 51, error: null };
    await gate.promise; return { data: [remote('p50')], error: null };
  });
  const first = h.api.loadProjectsByMonth('2026-11'); await new Promise(r => setImmediate(r));
  const updates = []; const second = h.api.loadProjectsByMonth('2026-11', (rows, ids = []) => updates.push({ rows, ids }));
  await new Promise(r => setImmediate(r)); gate.resolve(); await Promise.all([first, second]);
  assert.equal(h.requests.length, 2); assert(updates.some(x => x.rows.length === 51 && x.ids.includes('deleted')));
});

function sourceNodes(file) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] }); const effects = [], calls = [], vars = new Map();
  function visit(n) {
    if (!n || typeof n !== 'object') return;
    if (n.type === 'CallExpression' && n.callee.name === 'useEffect') effects.push(n);
    if (n.type === 'CallExpression') calls.push(n);
    if (n.type === 'VariableDeclarator' && n.id?.name && n.init) vars.set(n.id.name, n.init);
    for (const [key, value] of Object.entries(n)) { if (['loc','start','end'].includes(key)) continue; if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') visit(value); }
  }
  visit(ast); return { effects, calls, vars, code: n => source.slice(n.start, n.end) };
}
function evaluate(code, deps) { return new Function(...Object.keys(deps), 'return (' + code + ')')(...Object.values(deps)); }
test('identical project updates preserve state identity and do not update other state inside the updater', () => {
  const src = sourceNodes('src/App.jsx'); let state = [local('p1')]; const original = state;
  const init = src.vars.get('applyProjectsData');
  const callback = init.type === 'CallExpression' ? init.arguments[0] : init;
  const update = evaluate(src.code(callback), { setAllActivities(fn) { state = fn(state); } });
  update(clone(state)); assert.equal(state, original);
  update([], ['p1']); assert.equal(state.length, 0);
});
test('an old analytics response cannot replace a newer filter result', async () => {
  const src = sourceNodes('src/App.jsx');
  const effect = src.effects.find(e => src.code(e.arguments[0]).includes('fetchServerAnalytics'));
  const old = deferred(), latest = deferred(); let calls = 0, value;
  const deps = { isLoggedIn: true, activeTab: 'Analytics', analyticsFilter: { dateMode: 'month', date: '2026-11', dateRange: {}, category: 'all', status: 'all', transport: 'all', search: '' }, loadProjectsScoped: () => Promise.resolve([]), applyProjectsData() {}, setIsAnalyticsLoading() {}, setServerAnalytics(result) { value = result; }, fetchServerAnalytics: () => (++calls === 1 ? old.promise : latest.promise) };
  const cleanup = evaluate(src.code(effect.arguments[0]), deps)(); cleanup();
  evaluate(src.code(effect.arguments[0]), { ...deps, analyticsFilter: { ...deps.analyticsFilter, date: '2026-12' } })();
  latest.resolve({ month: '2026-12' }); await new Promise(r => setImmediate(r));
  old.resolve({ month: '2026-11' }); await new Promise(r => setImmediate(r));
  assert.equal(value.month, '2026-12');
});
test('inactive Finance and Analytics tabs do not load data', async () => {
  const src = sourceNodes('src/App.jsx'); let loads = 0, rpcs = 0;
  const financeEffect = src.effects.find(x => /financeFilter/.test(src.code(x.arguments[0])) && /loadProjectsScoped/.test(src.code(x.arguments[0])));
  const analyticsEffect = src.effects.find(x => /analyticsFilter/.test(src.code(x.arguments[0])) && /fetchServerAnalytics/.test(src.code(x.arguments[0])));
  assert(financeEffect, 'expected Finance loadProjectsScoped effect');
  assert(analyticsEffect, 'expected Analytics fetchServerAnalytics effect');
  assert(!/loadProjectsScoped/.test(src.code(analyticsEffect.arguments[0])), 'Analytics effect must not bulk-load projects into IndexedDB');

  const deps = {
    isLoggedIn: true,
    activeTab: 'Calendar',
    visitedTabs: new Set(['Finance', 'Analytics', 'Calendar']),
    financeFilter: { dateMode: 'month', date: '2026-11', dateRange: {} },
    analyticsFilter: { dateMode: 'month', date: '2026-11', dateRange: {}, category: 'all', status: 'all', transport: 'all', search: '' },
    loadProjectsScoped: () => { loads++; return Promise.resolve([]); },
    fetchServerAnalytics: () => { rpcs++; return Promise.resolve(null); },
    applyProjectsData() {},
    setIsAnalyticsLoading() {},
    setServerAnalytics() {}
  };
  evaluate(src.code(financeEffect.arguments[0]), deps)();
  evaluate(src.code(analyticsEffect.arguments[0]), deps)();
  await new Promise(r => setImmediate(r));
  assert.equal(loads, 0);
  assert.equal(rpcs, 0);

  // When activeTab === 'Analytics' with dateMode: 'year', loadProjectsScoped is NEVER called and fetchServerAnalytics sends +07:00 year bounds
  const h = await harness([], q => {
    if (q.op === 'rpc' && q.table === 'get_complete_analytics') {
      return { data: { totals: { total_projects: 12, revenue: 120000, cost: 40000, profit: 80000, support: 10000 } }, error: null };
    }
    return { data: [], error: null };
  });
  let analyticsResult = null;
  evaluate(src.code(financeEffect.arguments[0]), {
    ...deps,
    activeTab: 'Analytics'
  })();
  evaluate(src.code(analyticsEffect.arguments[0]), {
    ...deps,
    activeTab: 'Analytics',
    analyticsFilter: { dateMode: 'year', date: '2026', dateRange: {}, category: 'all', status: 'all', transport: 'all', search: '' },
    fetchServerAnalytics: (f) => { rpcs++; return h.api.fetchServerAnalytics(f); },
    setServerAnalytics(res) { analyticsResult = res; }
  })();
  await new Promise(r => setImmediate(r));
  await new Promise(r => setImmediate(r));
  assert.equal(loads, 0, 'Analytics year view must never call loadProjectsScoped');
  assert.equal(h.rows.size, 0, 'Analytics year view must perform zero IndexedDB project writes');
  assert.equal(rpcs, 1);
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].op, 'rpc');
  assert.equal(h.requests[0].table, 'get_complete_analytics');
  assert.equal(h.requests[0].payload.p_start_date, '2026-01-01T00:00:00+07:00');
  assert.equal(h.requests[0].payload.p_end_date, '2026-12-31T23:59:59+07:00');
  assert.equal(analyticsResult?.totals?.total_projects, 12);
});
test('one focus event syncs deleted records once', () => {
  const src = sourceNodes('src/App.jsx'); let deleted = 0;
  const deps = {};
  for (const name of ['fetchServerProjectStats','loadLocationsLocalFirst','loadCustomersLocalFirst','loadArtistsLocalFirst','loadArtistsAndCustomersSummaryStats','loadInventoryLocalFirst','loadAssetLoansLocalFirst','applyProjectsData','setIsLoading','setServerStats','setDeliveryLocations','setCustomerList','setArtistList','setArtistSummaryStats','setCustomerSummaryStats','setInventoryItems','setAssetLoans','showToast','fetchSettings']) deps[name] = () => Promise.resolve(null);
  deps.syncDeletedRecords = () => { deleted++; return Promise.resolve([]); };
  deps.lastFocusSyncRef = {current:0};
  deps.lastMasterSyncRef = {current:0};
  deps.fetchProjects = evaluate(src.code(src.vars.get('fetchProjects')), deps);
  evaluate(src.code(src.vars.get('onFocus')), deps)(); assert.equal(deleted, 1);
});

test('rapid focus events share one background master-data refresh window', () => {
  const src=sourceNodes('src/App.jsx'); let reads=0;
  const focus=evaluate(src.code(src.vars.get('onFocus')),{
    lastFocusSyncRef:{current:0},fetchProjects(){reads++;},fetchSettings(){}
  });
  focus(); focus(); focus();
  assert.equal(reads,1,'quick window changes must not redownload master data repeatedly');
});

test('silent focus sync does not repeatedly download master dropdown lists', async () => {
  const src=sourceNodes('src/App.jsx'); let reads=0, now=1000000;
  const deps={lastMasterSyncRef:{current:0},Date:{now:()=>now}};
  for(const name of ['fetchServerProjectStats','syncDeletedRecords','loadArtistsAndCustomersSummaryStats','setIsLoading','setServerStats','applyProjectsData','showToast']) deps[name]=()=>Promise.resolve(null);
  for(const name of ['loadLocationsLocalFirst','loadCustomersLocalFirst','loadArtistsLocalFirst']) deps[name]=()=>{reads++;return Promise.resolve([]);};
  const fetch=evaluate(src.code(src.vars.get('fetchProjects')),deps);
  await fetch(false); await fetch(true); await fetch(true);
  assert.equal(reads,3,'fresh master lists should only be downloaded once');
  now+=300001; await fetch(true); assert.equal(reads,6);
  await fetch(false); assert.equal(reads,9,'explicit refresh must always bypass master freshness');
});
test('quotation remote loading does not depend on project list changes', () => {
  const src = sourceNodes('src/Quotations.jsx');
  const effect = src.effects.find(x => src.code(x.arguments[0]).includes('loadQuotationsLocalFirst'));
  assert(effect); assert(!src.code(effect.arguments[1]).includes('activities'));
});
test('deleting the last quotation does not seed replacement documents', async () => {
  const src = sourceNodes('src/Quotations.jsx');
  const effect = src.effects.find(x => src.code(x.arguments[0]).includes('const seeded'));
  if (effect) {
    let seeds = 0;
    const deps = { isLoading: false, initializedQuotationsRef: { current: false }, quotationDocs: [{ id: 'existing' }], activities: [local('p1')], setQuotationDocs() { seeds++; }, db: { quotations: { bulkPut: () => Promise.resolve() } } };
    evaluate(src.code(effect.arguments[0]), deps)();
    evaluate(src.code(effect.arguments[0]), { ...deps, quotationDocs: [] })();
    assert.equal(seeds, 0);
  } else {
    assert(!src.effects.some(x => src.code(x.arguments[0]).includes('db.quotations.bulkPut')), 'Quotations.jsx must not auto-seed quotations');
  }

  // Also verify loadQuotationsLocalFirst clears ghost local rows when remote returns []
  const h = await harness([], q => q.table === 'quotations' ? { data: [], error: null } : { data: [], error: null });
  await h.db.quotations.put({ id: '00000000-0000-4000-8000-000000000099', quote_no: 'QT-OLD', title: 'Ghost' });
  const loaded = await h.api.loadQuotationsLocalFirst();
  assert.deepEqual(clone(loaded), []);
  assert.equal((await h.db.quotations.toArray()).length, 0);
});
test('App realtime callback forwards deletion IDs', () => {
  const src = sourceNodes('src/App.jsx');
  const call = src.calls.find(n => n.callee.name === 'subscribeToRealtimeProjects');
  let received;
  const callback = evaluate(src.code(call.arguments[0]), { console: { log() {} }, applyProjectsData(...args) { received = args; } });
  callback([], ['p1']); assert.deepEqual(received, [[], ['p1']]);
});
test('App keeps the form open and reports an error when project saving fails', async () => {
  const src = sourceNodes('src/App.jsx'); const notices = []; let closed = 0, updates = 0;
  const deps = { setIsSaving() {}, formatDate: () => '', quotationItems: [], currentId: 'p1', editingId: 'p1', allActivities: [{ id: 'p1' }], deliveryLocations: [], uploadedImages: [], uploadedSlips: [], expenses: [], customerSupportItems: [], depositAmount: 0, GOOGLE_SCRIPT_URL: 'mock://uploads', getFolderIdByType: () => '', saveProjectSync: async () => { throw new Error('write failed'); }, showToast: (...args) => notices.push(args), closeModal() { closed++; }, setAllActivities() { updates++; } };
  for (const name of ['customerName','customerSocial','customerLine','customerPhone','customerEmail','customerTaxId','customerAddress','projectDateTime','deliveryStart','deliveryEnd','projectName','projectCategory','artistName','paymentDate','paymentStatus','dealStatus','transportStatus','note','recipientName','recipientPhone','locationName','mapLink']) deps[name] = '';
  await evaluate(src.code(src.vars.get('handleSaveProject')), deps)();
  assert.equal(closed, 0); assert.equal(updates, 0);
  assert(notices.some(([message, type]) => type === 'error' && message.includes('write failed')));
  assert(!notices.some(([, type]) => type === 'success'));
});

test('extractGoogleDriveFolderId parses full Drive URLs and preserves raw IDs', async () => {
  const h = await harness();
  assert.equal(h.api.extractGoogleDriveFolderId('1AbCdEf_123-xyz'), '1AbCdEf_123-xyz');
  assert.equal(h.api.extractGoogleDriveFolderId('https://drive.google.com/drive/folders/1AbCdEf_123-xyz?usp=sharing'), '1AbCdEf_123-xyz');
  assert.equal(h.api.extractGoogleDriveFolderId('https://drive.google.com/drive/u/0/folders/1AbCdEf_123-xyz'), '1AbCdEf_123-xyz');
  assert.equal(h.api.extractGoogleDriveFolderId('https://drive.google.com/open?id=1AbCdEf_123-xyz'), '1AbCdEf_123-xyz');
  assert.equal(h.api.extractGoogleDriveFolderId('   '), '');
});

test('saveSettingsToSupabase persists drive_folders JSONB and normalizes Drive URLs', async () => {
  let savedPayload = null;
  const h = await harness([], q => {
    if (q.table === 'shop_settings' && q.op === 'select') return { data: { id: 'shop-1' }, error: null };
    if (q.table === 'shop_settings' && q.op === 'update') {
      savedPayload = q.updateArgs[0];
      return { data: null, error: null };
    }
    return { data: [], error: null };
  });

  await h.api.saveSettingsToSupabase({
    drive_folders: [
      { id: 'f_ref', name: 'รูปอ้างอิง', type: 'reference', folderId: 'https://drive.google.com/drive/folders/REF_123?usp=sharing' },
      { id: 'f_assets', name: 'Assets', type: 'assets', folderId: '' },
      { id: 'f_slips', name: 'สลิป', type: 'slips', folderId: 'SLIP_456' },
      { id: 'f_inventory', name: 'รูปสินค้าในคลัง', type: 'inventory', folderId: 'https://drive.google.com/drive/u/0/folders/INV_789' },
      { id: 'f_custom', name: 'เอกสาร', type: 'custom', folderId: 'CUSTOM_999' }
    ]
  });

  assert(savedPayload, 'expected shop_settings update payload');
  assert.equal(savedPayload.reference_folder_id, 'REF_123');
  assert.equal(savedPayload.assets_folder_id, '');
  assert.equal(savedPayload.slips_folder_id, 'SLIP_456');
  assert.equal(savedPayload.drive_folders.length, 5);
  assert.equal(savedPayload.drive_folders.find(f => f.type === 'inventory').folderId, 'INV_789');
  assert.equal(savedPayload.drive_folders.find(f => f.type === 'custom').folderId, 'CUSTOM_999');
});

test('saveSettingsToSupabase throws when Supabase update returns an error', async () => {
  const h = await harness([], q => {
    if (q.table === 'shop_settings' && q.op === 'select') return { data: { id: 'shop-1' }, error: null };
    if (q.table === 'shop_settings' && q.op === 'update') return { data: null, error: { message: 'permission denied' } };
    return { data: [], error: null };
  });

  await assert.rejects(
    h.api.saveSettingsToSupabase({ drive_folders: [{ id: 'f_inventory', name: 'รูปสินค้าในคลัง', type: 'inventory', folderId: 'INV_789' }] }),
    /permission denied/
  );
});

test('loadSettingsFromSupabase returns null instead of empty defaults when shop_settings query fails', async () => {
  const h = await harness([], q => {
    if (q.table === 'shop_settings') return { data: null, error: { message: 'network error' } };
    return { data: [], error: null };
  });

  const result = await h.api.loadSettingsFromSupabase();
  assert.equal(result, null);
});

test('saveSettingsToSupabase persists system options arrays (categories and statuses)', async () => {
  let savedPayload = null;
  const h = await harness([], q => {
    if (q.table === 'shop_settings' && q.op === 'select') return { data: { id: 'shop-1' }, error: null };
    if (q.table === 'shop_settings' && q.op === 'update') {
      savedPayload = q.updateArgs[0];
      return { data: null, error: null };
    }
    return { data: [], error: null };
  });

  await h.api.saveSettingsToSupabase({
    project_categories: ['ช่อดอกไม้', 'ซุ้มงานอีเวนต์'],
    expense_categories: ['ค่าดอกไม้', 'ค่าขนส่ง'],
    deal_statuses: [{ value: 'custom_1', label: 'รอโอนมัดจำ', color: 'bg-amber-50' }],
    transport_statuses: [{ value: 'custom_2', label: 'กำลังจัดส่ง', type: 'active', color: 'bg-blue-50' }]
  });

  assert(savedPayload, 'expected shop_settings update payload');
  assert.deepEqual(savedPayload.project_categories, ['ช่อดอกไม้', 'ซุ้มงานอีเวนต์']);
  assert.deepEqual(savedPayload.expense_categories, ['ค่าดอกไม้', 'ค่าขนส่ง']);
  assert.deepEqual(savedPayload.deal_statuses, [{ value: 'custom_1', label: 'รอโอนมัดจำ', color: 'bg-amber-50' }]);
  assert.deepEqual(savedPayload.transport_statuses, [{ value: 'custom_2', label: 'กำลังจัดส่ง', type: 'active', color: 'bg-blue-50' }]);
});

test('App getFolderIdByType routes dedicated profiles/artists folders and falls back to assets', () => {
  const src = sourceNodes('src/App.jsx');
  const fnNode = src.vars.get('getFolderIdByType');
  assert(fnNode, 'expected getFolderIdByType in App.jsx');

  const withDedicated = evaluate(src.code(fnNode), {
    driveFolders: [
      { type: 'reference', folderId: 'REF_ID' },
      { type: 'slips', folderId: 'SLIP_ID' },
      { type: 'assets', folderId: 'ASSETS_ID' },
      { type: 'profiles', folderId: 'PROFILE_ID' },
      { type: 'artists', folderId: 'ARTIST_ID' }
    ],
    driveFolderId: 'FALLBACK_REF',
    assetsDriveFolderId: 'FALLBACK_ASSETS'
  });
  assert.equal(withDedicated('reference'), 'REF_ID');
  assert.equal(withDedicated('slips'), 'SLIP_ID');
  assert.equal(withDedicated('profiles'), 'PROFILE_ID');
  assert.equal(withDedicated('artists'), 'ARTIST_ID');
  assert.equal(withDedicated('assets'), 'ASSETS_ID');

  const withFallback = evaluate(src.code(fnNode), {
    driveFolders: [{ type: 'assets', folderId: 'ASSETS_ID' }],
    driveFolderId: 'FALLBACK_REF',
    assetsDriveFolderId: 'FALLBACK_ASSETS'
  });
  assert.equal(withFallback('profiles'), 'ASSETS_ID');
  assert.equal(withFallback('artists'), 'ASSETS_ID');
  assert.equal(withFallback('inventory'), 'ASSETS_ID');
});

test('saveSettingsToSupabase persists payment_statuses JSONB and loadSettingsFromSupabase returns paymentStatuses', async () => {
  let savedPayload = null;
  const h = await harness([], q => {
    if (q.table === 'shop_settings' && q.op === 'select') return { data: { id: 'shop-1', payment_statuses: [{ value: 'paid' }] }, error: null };
    if (q.table === 'shop_settings' && q.op === 'update') {
      savedPayload = q.updateArgs[0];
      return { data: null, error: null };
    }
    return { data: [], error: null };
  });

  await h.api.saveSettingsToSupabase({ payment_statuses: [{ value: 'unpaid' }] });
  assert(savedPayload);
  assert.deepEqual(savedPayload.payment_statuses, [{ value: 'unpaid' }]);

  const loaded = await h.api.loadSettingsFromSupabase();
  assert.deepEqual(loaded.paymentStatuses, [{ value: 'paid' }]);
});

test('loadSettingsFromSupabase falls back cleanly to legacy columns when shop_settings.payment_statuses column does not exist yet (code 42703)', async () => {
  let selects = 0;
  const h = await harness([], q => {
    if (q.table === 'shop_settings' && q.op === 'select') {
      selects++;
      if (selects === 1) return { data: null, error: { code: '42703', message: 'column payment_statuses does not exist' } };
      return { data: { id: 'shop-1' }, error: null };
    }
    return { data: [], error: null };
  });
  const loaded = await h.api.loadSettingsFromSupabase();
  assert.equal(selects, 2);
  assert(loaded);
  assert.equal(loaded.paymentStatuses, null);
});

test('saveSettingsToSupabase returns { saved: true, localOnlyPaymentStatuses: true } without throwing when payment_statuses column is missing in Supabase', async () => {
  const h = await harness([], q => {
    if (q.table === 'shop_settings' && q.op === 'select') return { data: { id: 'shop-1' }, error: null };
    if (q.table === 'shop_settings' && q.op === 'update') {
      if (q.updateArgs[0].payment_statuses) return { data: null, error: { code: '42703', message: 'column payment_statuses does not exist' } };
      return { data: null, error: null };
    }
    return { data: [], error: null };
  });

  const res = await h.api.saveSettingsToSupabase({
    payment_statuses: [{ value: 'unpaid' }],
    shop_info: { shopName: 'Test' },
    app_credentials: [{ username: 'admin', name: 'Admin User', phone: '0812345678', image: 'https://example.com/a.jpg' }]
  });
  assert.equal(res.success, true);
  assert.equal(res.saved, true);
  assert.equal(res.localOnlyPaymentStatuses, true);
  const staffUpdate = h.requests.find(q => q.table === 'staff_users' && q.op === 'update');
  assert(staffUpdate, 'expected app_credentials staff_users update even when payment_statuses falls back');
  assert.equal(staffUpdate.updateArgs[0].full_name, 'Admin User');
});

test('isMissingPaymentStatusesColumnError ignores 42703/PGRST204 errors for unrelated columns', async () => {
  const h = await harness();
  assert.equal(h.api.isMissingPaymentStatusesColumnError({ code: '42703', message: 'column shop_settings.payment_statuses does not exist' }), true);
  assert.equal(h.api.isMissingPaymentStatusesColumnError({ code: 'PGRST204', message: "Could not find the 'payment_statuses' column of 'shop_settings' in the schema cache" }), true);
  assert.equal(h.api.isMissingPaymentStatusesColumnError({ code: '42703', message: 'column shop_settings.drive_folders does not exist' }), false);
  assert.equal(h.api.isMissingPaymentStatusesColumnError({ code: 'PGRST204', message: "Could not find the 'other_col' column of 'shop_settings' in the schema cache" }), false);
});

test('fetchServerAnalytics computes +07:00 bounds for all modes and falls back 6-arg -> 4-arg -> get_financial_analytics on PGRST202', async () => {
  const h = await harness([], q => {
    if (q.op === 'rpc') return { data: { totals: { total_projects: 1, revenue: 1000, cost: 200, profit: 800, support: 0 } }, error: null };
    return { data: [], error: null };
  });

  // Week mode (2026-11-25 Wednesday -> Mon 2026-11-23 .. Sun 2026-11-29)
  await h.api.fetchServerAnalytics({ mode: 'week', date: '2026-11-25', category: 'ซุ้มงานอีเวนต์', dealStatus: '__kpi_completed__', transportStatus: 'active_only', search: '  Impact  ' });
  assert.deepEqual({ ...h.requests.at(-1).payload }, {
    p_start_date: '2026-11-23T00:00:00+07:00',
    p_end_date: '2026-11-29T23:59:59+07:00',
    p_category: 'ซุ้มงานอีเวนต์',
    p_deal_status: '__kpi_completed__',
    p_transport_status: 'active_only',
    p_search: 'Impact'
  });

  // Month, Date, Range, All modes
  await h.api.fetchServerAnalytics({ mode: 'month', date: '2026-02' });
  assert.equal(h.requests.at(-1).payload.p_start_date, '2026-02-01T00:00:00+07:00');
  assert.equal(h.requests.at(-1).payload.p_end_date, '2026-02-28T23:59:59+07:00');

  await h.api.fetchServerAnalytics({ mode: 'date', date: '2026-11-24' });
  assert.equal(h.requests.at(-1).payload.p_start_date, '2026-11-24T00:00:00+07:00');
  assert.equal(h.requests.at(-1).payload.p_end_date, '2026-11-24T23:59:59+07:00');

  await h.api.fetchServerAnalytics({ mode: 'range', range: { start: '2026-10-01', end: '2026-10-15' } });
  assert.equal(h.requests.at(-1).payload.p_start_date, '2026-10-01T00:00:00+07:00');
  assert.equal(h.requests.at(-1).payload.p_end_date, '2026-10-15T23:59:59+07:00');

  await h.api.fetchServerAnalytics({ mode: 'all' });
  assert.equal(h.requests.at(-1).payload.p_start_date, null);
  assert.equal(h.requests.at(-1).payload.p_end_date, null);

  // Fallback chain: 6-arg PGRST202 -> 4-arg succeeds
  const h4 = await harness([], q => {
    if (q.op === 'rpc' && q.table === 'get_complete_analytics') {
      if ('p_transport_status' in q.payload || 'p_search' in q.payload) {
        return { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.get_complete_analytics(p_category, p_deal_status, p_end_date, p_search, p_start_date, p_transport_status)' } };
      }
      return {
        data: {
          totals: { total_orders: 3, total_revenue: 9000, total_expenses: 3000, total_net_profit: 6000, total_customer_support: 1500 },
          status_counts: { total: 3, completed: 2, active: 1, pending: 0, issue: 1, declined: 0 },
          low_margin: [{ id: 'P-01', name: 'Low', artist: 'A', revenue: 1000, cost: 800, profit: 200, margin_pct: 20 }]
        },
        error: null
      };
    }
    return { data: null, error: null };
  });
  const res4 = await h4.api.fetchServerAnalytics({ mode: 'year', date: '2026-11', category: 'ช่อดอกไม้' });
  assert.equal(h4.requests.length, 2);
  assert.deepEqual(Object.keys(h4.requests[1].payload).sort(), ['p_category', 'p_deal_status', 'p_end_date', 'p_start_date']);
  assert.equal(res4.totals.revenue, 9000);
  assert.equal(res4.totals.total_projects, 3);
  assert.equal(res4.status_counts.cancelled, 1);
  assert.equal(res4.low_margin[0].marginPct, 20);

  // Fallback chain: 6-arg PGRST202 -> 4-arg PGRST202 -> get_financial_analytics succeeds
  const hFin = await harness([], q => {
    if (q.op === 'rpc' && q.table === 'get_complete_analytics') {
      return { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };
    }
    if (q.op === 'rpc' && q.table === 'get_financial_analytics') {
      return { data: { total_orders: 2, total_revenue: 5000, total_expenses: 1000, total_net_profit: 4000, total_customer_support: 500, paid_orders_count: 2, unpaid_orders_count: 0 }, error: null };
    }
    return { data: null, error: null };
  });
  const resFin = await hFin.api.fetchServerAnalytics({ mode: 'year', date: '2026' });
  assert.equal(hFin.requests.length, 3);
  assert.equal(hFin.requests[2].table, 'get_financial_analytics');
  assert.equal(resFin.totals.revenue, 5000);
  assert.equal(resFin.totals.profit, 4000);
});

test('fetchProjectDetailOnDemand hydrates and caches a full UI project when uncached in IndexedDB', async () => {
  const h = await harness([], q => {
    if (q.table === 'projects') {
      return {
        data: {
          id: 'P-0360',
          name: 'ซุ้มคอนเสิร์ตใหญ่',
          category: 'ซุ้มงานอีเวนต์',
          artist_name: 'BUS',
          customer_name: 'คุณพลอย',
          customer_phone: '0891234567',
          customer_line: '@ploy',
          location_name: 'Impact Arena',
          raw_delivery_start: '2026-11-20T09:00:00',
          deal_status: 'confirmed',
          transport_status: 'delivered',
          payment_status: 'paid',
          wage: 25000,
          total_expenses: 18000,
          images: ['https://img/1.jpg'],
          slips: ['https://img/slip1.jpg']
        },
        error: null
      };
    }
    if (q.table === 'project_quotation_items') {
      return { data: [{ id: 'q1', project_id: 'P-0360', category: 'ซุ้ม', detail: 'หลัก', quantity: 1, unit_price: 25000, price: 25000, item_date: '2026-11-20' }], error: null };
    }
    if (q.table === 'project_customer_support') {
      return { data: [{ id: 'cs1', project_id: 'P-0360', denomination: 1000, quantity: 5, price: 5000, item_date: '2026-11-20' }], error: null };
    }
    if (q.table === 'project_expenses') {
      return { data: [{ id: 'ex1', project_id: 'P-0360', category: 'ค่าดอกไม้', detail: 'กุหลาบ', quantity: 1, unit_price: 18000, price: 18000, item_date: '2026-11-20' }], error: null };
    }
    return { data: [], error: null };
  });

  assert.equal(h.rows.has('P-0360'), false);
  const full = await h.api.fetchProjectDetailOnDemand('P-0360');
  assert(full);
  assert.equal(full.id, 'P-0360');
  assert.equal(full.name, 'ซุ้มคอนเสิร์ตใหญ่');
  assert.equal(full.artist, 'BUS');
  assert.equal(full.customer, 'คุณพลอย');
  assert.equal(full.customerInfo.phone, '0891234567');
  assert.equal(full.customerInfo.line, '@ploy');
  assert.equal(full.location, 'Impact Arena');
  assert.deepEqual(full.images, ['https://img/1.jpg']);
  assert.deepEqual(full.slips, ['https://img/slip1.jpg']);
  assert.equal(full.quotationItems.length, 1);
  assert.equal(full.customerSupport.length, 1);
  assert.equal(full.expenses.length, 1);
  assert.equal(h.rows.has('P-0360'), true);
  assert.equal(h.rows.get('P-0360').name, 'ซุ้มคอนเสิร์ตใหญ่');
});

test('Zero Base64 Leak Gate + slim PROJECT_LIST_COLUMNS strips data URIs across projects, artists, staff, and settings', async () => {
  let savedRpc = null, savedArtist = null, savedStaff = null, savedShop = null;
  const h = await harness([], q => {
    if (q.op === 'rpc' && q.table === 'save_project_with_items') {
      savedRpc = q.payload;
      return { data: null, error: null };
    }
    if (q.table === 'artists' && q.op === 'upsert') {
      savedArtist = q.upsertArgs[0];
      return { data: savedArtist, error: null };
    }
    if (q.table === 'staff_users' && q.op === 'upsert') {
      savedStaff = q.upsertArgs[0];
      return { data: savedStaff, error: null };
    }
    if (q.table === 'shop_settings' && q.op === 'select') return { data: { id: 'shop-1' }, error: null };
    if (q.table === 'shop_settings' && q.op === 'update') {
      savedShop = q.updateArgs[0];
      return { data: null, error: null };
    }
    return { data: null, error: null };
  });

  assert(!h.api.PROJECT_LIST_COLUMNS.split(',').includes('primary_image_url'));
  assert(h.api.PROJECT_DETAIL_COLUMNS.split(',').includes('primary_image_url'));

  assert.equal(h.api.sanitizeRemoteImageUrl('data:image/png;base64,iVBORw0KGgo='), '');
  assert.equal(h.api.sanitizeRemoteImageUrl('https://cdn.example.com/' + 'a'.repeat(2100)), '');
  assert.equal(h.api.sanitizeRemoteImageUrl({ url: 'https://cdn.example.com/ok.jpg' }), 'https://cdn.example.com/ok.jpg');

  await h.api.saveProjectSync({
    id: 'P-0500',
    name: 'No Base64',
    images: ['data:image/jpeg;base64,AAAA', { url: 'https://cdn.example.com/ref.jpg' }],
    slips: ['data:image/png;base64,BBBB', 'https://cdn.example.com/slip.jpg']
  });
  assert.deepEqual(savedRpc.p_project.images, ['https://cdn.example.com/ref.jpg']);
  assert.deepEqual(savedRpc.p_project.slips, ['https://cdn.example.com/slip.jpg']);
  assert.equal(savedRpc.p_project.primary_image_url, 'https://cdn.example.com/ref.jpg');

  await h.api.saveArtistSync({ name: 'BUS', avatar_url: 'data:image/png;base64,CCCC' });
  assert.equal(savedArtist.avatar_url, '');

  await h.api.saveStaffSync({ id: '2611099', username: 'staff99', name: 'Staff 99', avatar_url: 'data:image/png;base64,DDDD' });
  assert.equal(savedStaff.profile_image_url, null);

  await h.api.saveSettingsToSupabase({ shop_info: { logo: 'data:image/png;base64,EEEE' } });
  assert.equal(savedShop.logo_url, '');
});

test('allocateNextProjectCodeSync uses RPC and falls back to remote max + localMax on PGRST202', async () => {
  const hRpc = await harness([], q => {
    if (q.op === 'rpc' && q.table === 'allocate_next_project_code') return { data: 'P-0375', error: null };
    return { data: [], error: null };
  });
  assert.equal(await hRpc.api.allocateNextProjectCodeSync([{ id: 'P-0100' }]), 'P-0375');

  const hFallback = await harness([], q => {
    if (q.op === 'rpc' && q.table === 'allocate_next_project_code') {
      return { data: null, error: { code: 'PGRST202', message: 'not found' } };
    }
    if (q.table === 'projects') {
      return { data: [{ id: 'P-0412' }, { id: 'P-0410' }], error: null };
    }
    return { data: [], error: null };
  });
  assert.equal(await hFallback.api.allocateNextProjectCodeSync([{ id: 'P-0400' }]), 'P-0413');
  assert.equal(await hFallback.api.allocateNextProjectCodeSync([{ id: 'P-0420' }]), 'P-0421');
  const projQuery = hFallback.requests.find(q => q.table === 'projects');
  assert(projQuery.filters.some(([op, col, val]) => op === 'like' && col === 'id' && val === 'P-%'));
  assert.equal(projQuery.limitArgs[0], 25);
});

test('subscribeToLocalSyncChannel uses singleton BroadcastChannel without closing and emits f2u:local-sync CustomEvent', async () => {
  const createdChannels = [];
  let closedCount = 0;
  class MockBroadcastChannel {
    constructor(name) {
      this.name = name;
      this.posted = [];
      this.onmessage = null;
      createdChannels.push(this);
    }
    postMessage(msg) {
      this.posted.push(msg);
      for (const ch of createdChannels) {
        if (ch !== this && ch.name === this.name && typeof ch.onmessage === 'function') {
          ch.onmessage({ data: msg });
        }
      }
    }
    close() { closedCount++; }
  }
  const winListeners = new Map();
  const mockWindow = {
    addEventListener(type, fn) { if (!winListeners.has(type)) winListeners.set(type, new Set()); winListeners.get(type).add(fn); },
    removeEventListener(type, fn) { winListeners.get(type)?.delete(fn); },
    dispatchEvent(ev) { for (const fn of winListeners.get(ev.type) || []) fn(ev); }
  };
  class MockCustomEvent {
    constructor(type, opts = {}) { this.type = type; this.detail = opts.detail; }
  }

  const h = await harness([], undefined, { BroadcastChannel: MockBroadcastChannel, window: mockWindow, CustomEvent: MockCustomEvent });
  const received = [];
  const unsub = h.api.subscribeToLocalSyncChannel(msg => received.push(msg));

  h.api.broadcastRecordDeleted('projects', 'P-0001');
  h.api.broadcastPermissionsUpdated({ admin: { can_manage_users: true } });

  assert.equal(closedCount, 0, 'singleton BroadcastChannel must never call .close() after postMessage');
  const syncChannels = createdChannels.filter(c => c.name === 'flower2u_sync_channel');
  assert.equal(syncChannels.length, 1, 'must reuse one singleton BroadcastChannel');
  assert.equal(received.length, 2);
  assert.deepEqual(clone(received[0]), { type: 'RECORD_DELETED', table: 'projects', id: 'P-0001' });
  assert.equal(received[1].type, 'PERMISSIONS_UPDATED');

  // Simulate cross-tab message from another tab's BroadcastChannel
  const otherTab = new MockBroadcastChannel('flower2u_sync_channel');
  otherTab.postMessage({ type: 'RECORD_DELETED', table: 'quotations', id: 'q-1' });
  assert.equal(received.length, 3);
  assert.equal(received[2].table, 'quotations');

  unsub();
  h.api.broadcastRecordDeleted('projects', 'P-0002');
  assert.equal(received.length, 3);
});

test('subscribeToMasterDataRealtime multiplexes 5 master tables on f2u-master-sync and emits f2u:quotations-sync', async () => {
  let quoteEvents = 0;
  const mockWindow = {
    dispatchEvent(ev) { if (ev.type === 'f2u:quotations-sync') quoteEvents++; }
  };
  class MockCustomEvent {
    constructor(type, opts = {}) { this.type = type; this.detail = opts.detail; }
  }

  const h = await harness([], undefined, { window: mockWindow, CustomEvent: MockCustomEvent });
  const seen = {};
  const unsub = h.api.subscribeToMasterDataRealtime({
    onLocationsChange: rows => { seen.locations = rows; },
    onArtistsChange: rows => { seen.artists = rows; },
    onCustomersChange: rows => { seen.customers = rows; },
    onQuotationsChange: rows => { seen.quotations = rows; },
    onMaterialRatesChange: rows => { seen.rates = rows; }
  });

  assert.equal(h.channels.filter(c => c.name === 'f2u-master-sync').length, 1);
  assert.equal(h.listeners.filter(l => l.channel === 'f2u-master-sync').length, 5);

  const byTable = tbl => h.listeners.find(l => l.channel === 'f2u-master-sync' && l.filter.table === tbl);
  await byTable('delivery_locations').cb({ eventType: 'INSERT', new: { id: 'loc-1', name: 'Impact' } });
  await byTable('artists').cb({ eventType: 'INSERT', new: { id: 'art-1', name: 'BUS', avatar_url: 'data:image/png;base64,XXXX' } });
  await byTable('customers').cb({ eventType: 'INSERT', new: { id: 'cus-1', name: 'Ploy' } });
  await byTable('quotations').cb({ eventType: 'INSERT', new: { id: 'qt-1', quote_no: 'QT-1', title: 'Quote 1' } });
  await byTable('material_rates').cb({ eventType: 'UPDATE', new: { id: 'mr-1', name: 'Vinyl', default_price_sqm: 200 } });

  assert.equal(seen.locations.length, 1);
  assert.equal(seen.artists[0].avatar_url, '');
  assert.equal(seen.customers.length, 1);
  assert.equal(seen.quotations.length, 1);
  assert.equal(seen.rates.length, 1);
  assert.equal(quoteEvents, 2);

  await byTable('quotations').cb({ eventType: 'DELETE', old: { id: 'qt-1' } });
  assert.equal(seen.quotations.length, 0);
  assert.equal(quoteEvents, 3);

  unsub();
  assert.equal(h.removedChannels.length, 1);

  const hNull = await harness([], undefined, { __nullClient: true });
  const noopUnsub = hNull.api.subscribeToMasterDataRealtime();
  assert.equal(typeof noopUnsub, 'function');
  noopUnsub();
});

test('UUID sync replaces legacy qt-/mat-/art- IDs, removes old temp keys, and throws on Supabase errors', async () => {
  const h = await harness([], q => {
    if (['quotations', 'material_rates', 'artists'].includes(q.table) && q.op === 'upsert') {
      return { data: q.upsertArgs[0], error: null };
    }
    if (q.table === 'delivery_locations' && q.op === 'upsert') {
      return { data: { id: q.upsertArgs[0].id || '00000000-0000-4000-8000-000000000999', ...q.upsertArgs[0] }, error: null };
    }
    return { data: [], error: null };
  });

  await h.db.quotations.put({ id: 'qt-123', quote_no: 'QT-001', title: 'Temp' });
  const savedQuote = await h.api.saveQuotationSync({ id: 'qt-123', quote_no: 'QT-001', title: 'Saved Quote' });
  assert(h.api.isValidUuid(savedQuote.id));
  assert.equal(await h.db.quotations.get('qt-123'), undefined);
  assert.equal((await h.db.quotations.get(savedQuote.id)).title, 'Saved Quote');

  await h.db.material_rates.put({ id: 'mat-123', name: 'Board' });
  const savedRate = await h.api.saveMaterialRateSync({ id: 'mat-123', name: 'Board', default_price_sqm: 350 });
  assert(h.api.isValidUuid(savedRate.id));
  assert.equal(await h.db.material_rates.get('mat-123'), undefined);

  await h.db.artists.put({ id: 'art-123', name: 'Artist A' });
  const savedArtist = await h.api.saveArtistSync({ id: 'art-123', name: 'Artist A' });
  assert(h.api.isValidUuid(savedArtist.id));
  assert.equal(await h.db.artists.get('art-123'), undefined);

  // saveLocationSync conflict target: id when UUID, name when no UUID
  const locNew = await h.api.saveLocationSync({ name: 'Paragon' });
  assert.equal(h.requests.at(-1).upsertArgs[1].onConflict, 'name');
  assert.equal(h.requests.at(-1).selectArgs[0], h.api.LOCATION_COLUMNS);

  await h.api.saveLocationSync({ id: locNew.id, name: 'Siam Paragon' });
  assert.equal(h.requests.at(-1).upsertArgs[1].onConflict, 'id');

  // Errors from Supabase must throw and NOT write unsynced local rows
  const hFail = await harness([], () => ({ data: null, error: { message: 'RLS denied' } }));
  await assert.rejects(hFail.api.saveQuotationSync({ quote_no: 'QT-ERR', title: 'Fail' }), err => err?.message === 'RLS denied');
  assert.equal((await hFail.db.quotations.toArray()).length, 0);
  await assert.rejects(hFail.api.saveMaterialRateSync({ name: 'Fail Rate', default_price_sqm: 100 }), err => err?.message === 'RLS denied');
  assert.equal((await hFail.db.material_rates.toArray()).length, 0);
  await assert.rejects(hFail.api.saveArtistSync({ name: 'Fail Artist' }), err => err?.message === 'RLS denied');
  assert.equal((await hFail.db.artists.toArray()).length, 0);
});

test('loadMaterialRatesLocalFirst uses valid default UUIDs only when uninitialized and clears ghost rows when cloud is empty', async () => {
  const h = await harness([], q => q.table === 'material_rates' ? { data: [], error: null } : { data: [], error: null });
  for (const r of h.api.DEFAULT_MATERIAL_RATES) assert(h.api.isValidUuid(r.id));

  // Previously initialized store + empty cloud => clears ghost rows to []
  await h.db.material_rates.put({ id: '00000000-0000-4000-8000-000000000101', name: 'Old Rate', default_price_sqm: 350, is_active: true });
  const cleared = await h.api.loadMaterialRatesLocalFirst();
  assert.deepEqual(clone(cleared), []);
  assert.equal((await h.db.material_rates.toArray()).length, 0);
});

test('roles realtime uses ROLE_COLUMNS + DEFAULT_PERMISSION_MATRIX, public lookup drops projects scan, latest30 uses real columns, and summary stats uses 5-min TTL + limit(500)', async () => {
  const h = await harness([], q => {
    if (q.table === 'roles') {
      return { data: [{ name: 'driver', label: 'Driver Custom', code: '31', allowed_pages: ['Calendar'], can_borrow_tools: false }], error: null };
    }
    if (q.op === 'rpc' && q.table === 'get_public_project_by_token') {
      return { data: null, error: { code: 'PGRST202', message: 'not found' } };
    }
    if (q.op === 'rpc' && (q.table === 'get_artists_summary_stats' || q.table === 'get_customers_summary_stats')) {
      return { data: null, error: { code: 'PGRST202', message: 'not found' } };
    }
    if (q.table === 'projects') {
      return { data: [{ id: 'P-0300', name: 'Show', customer_name: 'Alice', artist_name: 'BUS', delivery_date_display: '2026-11-20', wage: 5000, delivery_fee: 500, customer_support_total: 1000, raw_delivery_start: '2026-11-20T10:00:00' }], error: null };
    }
    return { data: [], error: null };
  });

  // Roles realtime
  let updatedRoles = null;
  h.api.subscribeToRolesRealtime(m => { updatedRoles = m; });
  const roleListener = h.listeners.find(l => l.filter?.table === 'roles');
  await roleListener.cb();
  const roleSelect = h.requests.find(q => q.table === 'roles');
  assert.equal(roleSelect.selectArgs[0], h.api.ROLE_COLUMNS);
  assert.deepEqual(updatedRoles.driver.allowed_pages, ['Calendar']);
  assert(updatedRoles.admin.can_manage_users);

  // Public project lookup must NOT scan projects table on PGRST202
  const reqBeforePublic = h.requests.length;
  const pub = await h.api.fetchPublicProjectByToken('tok-123');
  assert.equal(pub, null);
  assert.equal(h.requests.slice(reqBeforePublic).filter(q => q.table === 'projects').length, 0);

  // Latest 30 projects uses real columns
  const latest = await h.api.fetchLatest30ProjectsFromSupabase();
  assert.equal(h.requests.at(-1).selectArgs[0], 'id, name, customer_name, artist_name, delivery_date_display');
  assert.deepEqual(clone(latest[0]), { id: 'P-0300', name: 'Show', customer: 'Alice', artist: 'BUS', deliveryDate: '2026-11-20' });

  // Summary stats fallback caps at limit(500) and caches in memory for 5 minutes (0 Egress on repeat calls)
  const beforeStats = h.requests.length;
  const stats1 = await h.api.loadArtistsAndCustomersSummaryStats();
  const afterFirstStats = h.requests.length;
  const fallbackProjQuery = h.requests.slice(beforeStats).find(q => q.table === 'projects');
  assert.equal(fallbackProjQuery.limitArgs[0], 500);
  assert.equal(stats1.artistStats.bus.projectCount, 1);

  const stats2 = await h.api.loadArtistsAndCustomersSummaryStats();
  assert.equal(h.requests.length, afterFirstStats, 'second call within 5 minutes must issue 0 Supabase queries');
  assert.equal(stats2.customerStats.alice.totalSpend, 5500);
});

test('is_voided excludes voided items from totals, preserves child UUIDs, retries 42703, fixes detail resurrection, and invalidates stale summary children', async () => {
  let savedRpc = null;
  let legacy42703Count = 0;
  const h = await harness([], q => {
    if (q.op === 'rpc' && q.table === 'save_project_with_items') {
      savedRpc = q.payload;
      return { data: null, error: null };
    }
    if ((q.table === 'project_quotation_items' || q.table === 'project_expenses') && String(q.selectArgs?.[0] || '').includes('is_voided')) {
      legacy42703Count++;
      return { data: null, error: { code: '42703', message: 'column is_voided does not exist' } };
    }
    if (q.table === 'projects' && q.op === 'select') {
      return { data: { id: 'P-0700', images: [], slips: [], customer_phone: null, updated_at: '2026-11-24T12:00:00Z' }, error: null };
    }
    return { data: [], error: null };
  });

  const keepId = '00000000-0000-4000-8000-000000000777';
  await h.api.saveProjectSync({
    id: 'P-0700',
    name: 'Void Test',
    deliveryFee: 200,
    quotationItems: [
      { id: keepId, category: 'ซุ้ม', price: 10000, is_voided: false },
      { id: 'temp-q2', category: 'ยกเลิก', price: 4000, is_voided: true }
    ],
    expenses: [
      { category: 'ดอกไม้', price: 3000, is_voided: false },
      { category: 'ค่าส่งเดิม', price: 1500, is_voided: true }
    ]
  });

  assert.equal(savedRpc.p_project.wage, 10000);
  assert.equal(savedRpc.p_project.total_revenue, 10200);
  assert.equal(savedRpc.p_project.total_expenses, 3000);
  assert.equal(savedRpc.p_project.net_profit, 7200);
  assert.equal(savedRpc.p_quotation_items[0].id, keepId);
  assert(h.api.isValidUuid(savedRpc.p_quotation_items[1].id));
  assert.equal(savedRpc.p_quotation_items[1].is_voided, true);
  assert.equal(savedRpc.p_expenses[1].is_voided, true);

  // Seed existing cached rows with old deleted items, images, slips, and phone, then fetchProjectDetailOnDemand
  await h.db.projects.put({
    id: 'P-0700',
    name: 'Void Test',
    images: ['https://old.jpg'],
    slips: ['https://old-slip.jpg'],
    customerInfo: { phone: '0811111111' },
    quotationItems: [{ id: keepId, price: 10000 }],
    customerSupport: [{ id: 'cs-old', price: 1000 }],
    expenses: [{ id: 'ex-old', price: 3000 }],
    updated_at: '2026-11-20T00:00:00Z'
  });

  const detail = await h.api.fetchProjectDetailOnDemand('P-0700');
  assert(legacy42703Count >= 2, 'must retry child queries without is_voided on 42703');
  assert.deepEqual(detail.quotationItems, []);
  assert.deepEqual(detail.customerSupport, []);
  assert.deepEqual(detail.expenses, []);
  assert.deepEqual(detail.images, []);
  assert.deepEqual(detail.slips, []);
  assert.equal(detail.customerInfo.phone, '');

  // Stale child invalidation on summary load when remote updated_at changed
  const hStale = await harness([
    local('p-stale', {
      updated_at: '2026-11-20T10:00:00Z',
      expenses: [{ price: 400 }],
      quotationItems: [{ price: 1000 }],
      customerSupport: [{ price: 200 }]
    }),
    local('p-same', {
      updated_at: '2026-11-20T10:00:00Z',
      expenses: [{ price: 400 }]
    })
  ], () => ({
    data: [
      remote('p-stale', { updated_at: '2026-11-21T10:00:00Z', total_expenses: 900 }),
      remote('p-same', { updated_at: '2026-11-20T10:00:00Z', total_expenses: 400 })
    ],
    count: 2,
    error: null
  }));
  await hStale.api.loadProjectsByMonth('2026-11');
  assert.deepEqual(hStale.rows.get('p-stale').expenses, []);
  assert.deepEqual(hStale.rows.get('p-stale').quotationItems, []);
  assert.deepEqual(hStale.rows.get('p-same').expenses, [{ price: 400 }]);
});

test('deleteProjectSync deletes on Supabase first, year/all caps at 2 pages safely, syncDeletedRecords purges all tables + paginates, and Realtime skips self-echo & summary fan-out', async () => {
  // 1. deleteProjectSync aborts before local delete when Supabase fails
  const hDelFail = await harness([local('P-DEL')], q => q.op === 'delete' ? { data: null, error: { message: 'delete blocked' } } : { data: null, error: null });
  await assert.rejects(hDelFail.api.deleteProjectSync('P-DEL'), err => err?.message === 'delete blocked');
  assert(hDelFail.rows.has('P-DEL'), 'must keep local cache when remote delete fails');
  assert(!hDelFail.requests.some(q => q.table === 'deleted_records'), 'must not insert tombstone when remote delete fails');

  const callOrder = [];
  const hDelOk = await harness([local('P-DEL')], q => {
    callOrder.push(`${q.table}:${q.op}`);
    return { data: null, error: null };
  });
  await hDelOk.api.deleteProjectSync('P-DEL');
  assert.equal(callOrder[0], 'projects:delete');
  assert.equal(hDelOk.rows.has('P-DEL'), false);

  // 2. Year/All mode caps at 2 pages (<= 550 rows) without deleting un-fetched local rows
  const many = Array.from({ length: 800 }, (_, i) => remote('P-' + String(i + 1).padStart(4, '0'), { raw_delivery_start: '2026-06-15T10:00:00' }));
  const hYear = await harness([local('P-0799', { rawDeliveryStart: '2026-06-15T10:00:00' })], q => ({
    data: many.slice(q.rangeArgs[0], q.rangeArgs[1] + 1),
    count: 800,
    error: null
  }));
  const yearLoaded = await hYear.api.loadProjectsScoped({ mode: 'year', date: '2026' });
  assert.equal(yearLoaded.length, 550);
  assert.equal(hYear.requests.filter(q => q.table === 'projects').length, 2);
  assert(hYear.rows.has('P-0799'), 'capped year query must never reconcile un-fetched pages as deleted');

  // 3. syncDeletedRecords deletes across all stores (including staff_users -> db.staff) and paginates on 1000 rows
  let tombCalls = 0;
  const page1 = Array.from({ length: 1000 }, (_, i) => ({
    record_id: i === 0 ? 'P-GONE' : `ignore-${i}`,
    table_name: 'projects',
    deleted_at: `2026-11-24T00:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}Z`
  }));
  const page2 = [
    { record_id: 'qt-gone', table_name: 'quotations', deleted_at: '2026-11-24T02:00:01Z' },
    { record_id: '2611009', table_name: 'staff_users', deleted_at: '2026-11-24T02:00:02Z' }
  ];
  const hTomb = await harness([local('P-GONE')], q => {
    if (q.table === 'deleted_records') return { data: ++tombCalls === 1 ? page1 : page2, error: null };
    return { data: [], error: null };
  });
  await hTomb.db.quotations.put({ id: 'qt-gone', quote_no: 'QT-X', title: 'Gone' });
  await hTomb.db.staff.put({ id: '2611009', username: 'gone_staff' });
  const purgedProjects = await hTomb.api.syncDeletedRecords();
  assert.equal(tombCalls, 2);
  assert(purgedProjects.includes('P-GONE'));
  assert.equal(hTomb.rows.has('P-GONE'), false);
  assert.equal(await hTomb.db.quotations.get('qt-gone'), undefined);
  assert.equal(await hTomb.db.staff.get('2611009'), undefined);

  // 4. Realtime self-echo & summary-only remote update skip 3 child HTTP queries; detailed remote update fetches children
  const hRt = await harness([
    local('P-SUMMARY', { expenses: [], quotationItems: [], customerSupport: [] }),
    local('P-DETAILED', { expenses: [{ id: 'e1', price: 500 }] })
  ], q => {
    if (q.op === 'rpc' && q.table === 'save_project_with_items') return { data: null, error: null };
    if (q.table === 'project_expenses') return { data: [{ id: 'e2', project_id: 'P-DETAILED', category: 'ใหม่', quantity: 1, unit_price: 900, price: 900 }], error: null };
    return { data: [], error: null };
  });
  hRt.api.subscribeToRealtimeProjects(() => {});
  const projRt = hRt.listeners.find(l => l.filter?.table === 'projects');

  await hRt.api.saveProjectSync({ id: 'P-SELF', name: 'My Save', expenses: [{ price: 300 }] });
  const reqCountAfterSave = hRt.requests.length;
  await projRt.cb({ eventType: 'UPDATE', new: remote('P-SELF', { name: 'My Save', updated_at: '2026-11-24T03:00:00Z' }) });
  assert.equal(hRt.requests.length, reqCountAfterSave, 'self-echo within 3500ms must skip 3 child queries');
  assert.equal(hRt.rows.get('P-SELF').expenses.length, 1);

  await projRt.cb({ eventType: 'UPDATE', new: remote('P-SUMMARY', { name: 'Remote Summary', wage: 8000 }) });
  assert.equal(hRt.requests.length, reqCountAfterSave, 'remote update on summary-only row must skip 3 child queries');
  assert.equal(hRt.rows.get('P-SUMMARY').wage, 8000);

  await projRt.cb({ eventType: 'UPDATE', new: remote('P-DETAILED', { name: 'Remote Detailed' }) });
  assert.equal(hRt.requests.length - reqCountAfterSave, 3, 'remote update on detailed row must refresh 3 child tables');
  assert.equal(hRt.rows.get('P-DETAILED').expenses[0].price, 900);

  // 5. subscribeToStaffRealtime handles INSERT/UPDATE/DELETE, strips password, and loadStaffLocalFirst falls back on 42703
  let staffEvents = [];
  let staffSelectCount = 0;
  const hStaff = await harness([], q => {
    if (q.table === 'staff_users' && q.op === 'select') {
      staffSelectCount++;
      if (staffSelectCount === 1) return { data: null, error: { code: '42703', message: 'column banned_until does not exist' } };
      return { data: [{ id: '2611001', username: '1', full_name: 'Admin', is_active: true }], error: null };
    }
    return { data: [], error: null };
  });
  assert(hStaff.api.STAFF_COLUMNS.includes('banned_until'));
  const loadedStaff = await hStaff.api.loadStaffLocalFirst();
  assert.equal(staffSelectCount, 2);
  assert.equal(loadedStaff[0].id, '2611001');

  hStaff.api.subscribeToStaffRealtime((row, eventType, oldRow) => staffEvents.push({ row, eventType, oldRow }));
  const staffRt = hStaff.listeners.find(l => l.filter?.table === 'staff_users');
  assert.equal(staffRt.filter.event, '*');
  await staffRt.cb({ eventType: 'UPDATE', new: { id: '2611002', username: 'AOM', password: 'secret', is_active: false, is_banned_permanent: true, ban_reason: 'Suspended' }, old: { id: '2611002' } });
  const cachedStaff = await hStaff.db.staff.get('2611002');
  assert.equal(cachedStaff.is_banned_permanent, true);
  assert.equal('password' in cachedStaff, false);
  assert.equal('password' in staffEvents[0].row, false);
  assert.equal(staffEvents[0].eventType, 'UPDATE');

  await staffRt.cb({ eventType: 'DELETE', old: { id: '2611002' } });
  assert.equal(await hStaff.db.staff.get('2611002'), undefined);
  assert.equal(staffEvents[1].eventType, 'DELETE');
});
