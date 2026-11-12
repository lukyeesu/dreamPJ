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
async function harness(initial = [], respond = () => ({ data: [], error: null, count: 0 })) {
  const rows = new Map(initial.map(x => [x.id, clone(x)]));
  const requests = [], deleted = [], listeners = [];
  const db = { transaction: async (_mode, _table, callback) => callback(), projects: {
    toArray: async () => clone([...rows.values()]), get: async id => clone(rows.get(id)),
    bulkGet: async ids => ids.map(id => clone(rows.get(id))),
    put: async row => rows.set(row.id, clone(row)), bulkPut: async items => items.forEach(row => rows.set(row.id, clone(row))),
    delete: async id => { deleted.push(id); rows.delete(id); },
    bulkDelete: async ids => ids.forEach(id => { deleted.push(id); rows.delete(id); })
  } };
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'test-user' } } } }) },
    from(table) {
      const q = { table, op: 'select', filters: [] };
      for (const method of ['select','gte','lte','lt','gt','eq','in','order','range','limit','maybeSingle','upsert','insert','delete']) {
        q[method] = (...args) => { q[method + 'Args'] = args; if (['insert','delete','upsert'].includes(method)) q.op = method; if (['eq','in','gte','lte','lt'].includes(method)) q.filters.push([method, ...args]); return q; };
      }
      q.then = (ok, fail) => { requests.push(q); return Promise.resolve().then(() => respond(q)).then(ok, fail); };
      return q;
    },
    rpc(name, payload) { const q = { table: name, op: 'rpc', payload }; requests.push(q); return Promise.resolve().then(() => respond(q)); },
    channel() { return { on(event, filter, cb) { listeners.push({ event, filter, cb }); return this; }, subscribe() { return this; } }; },
    removeChannel() {}
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
  const context = vm.createContext({ console: { log() {}, warn() {}, error() {} }, Date, Map, Set, Promise, JSON });
  const module = new vm.SourceTextModule(fs.readFileSync(path.join(root, 'src/services/syncService.js'), 'utf8'), { context });
  await module.link(specifier => {
    const exports = specifier.includes('supabaseClient') ? { supabase: client, getActiveClient: () => client }
      : specifier === './db' ? { db }
      : specifier.includes('formatters') ? { generateTrackingToken: () => '' }
      : specifier.includes('warehouseService') ? warehouseMock
      : schemas;
    return new vm.SyntheticModule(Object.keys(exports), function () { for (const [key, value] of Object.entries(exports)) this.setExport(key, value); }, { context });
  });
  await module.evaluate();
  return { api: module.namespace, rows, requests, deleted, listeners, db };
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
  const deps = { isLoggedIn: true, activeTab: 'Analytics', analyticsFilter: { dateMode: 'month', date: '2026-11', dateRange: {}, category: 'all', status: 'all' }, loadProjectsScoped: () => Promise.resolve([]), applyProjectsData() {}, setIsAnalyticsLoading() {}, setServerAnalytics(result) { value = result; }, fetchServerAnalytics: () => (++calls === 1 ? old.promise : latest.promise) };
  const cleanup = evaluate(src.code(effect.arguments[0]), deps)(); cleanup();
  evaluate(src.code(effect.arguments[0]), { ...deps, analyticsFilter: { ...deps.analyticsFilter, date: '2026-12' } })();
  latest.resolve({ month: '2026-12' }); await new Promise(r => setImmediate(r));
  old.resolve({ month: '2026-11' }); await new Promise(r => setImmediate(r));
  assert.equal(value.month, '2026-12');
});
test('inactive Finance and Analytics tabs do not load data', async () => {
  const src = sourceNodes('src/App.jsx'); let loads = 0, rpcs = 0;
  const deps = { isLoggedIn: true, activeTab: 'Calendar', visitedTabs: new Set(['Finance','Analytics','Calendar']), financeFilter: { dateMode: 'month', date: '2026-11', dateRange: {} }, analyticsFilter: { dateMode: 'month', date: '2026-11', dateRange: {}, category: 'all', status: 'all' }, loadProjectsScoped: () => { loads++; return Promise.resolve([]); }, fetchServerAnalytics: () => { rpcs++; return Promise.resolve(null); }, applyProjectsData() {}, setIsAnalyticsLoading() {}, setServerAnalytics() {} };
  const effects = src.effects.filter(x => /loadProjectsScoped/.test(src.code(x.arguments[0])) && /financeFilter|analyticsFilter/.test(src.code(x.arguments[0])));
  assert.equal(effects.length, 2); effects.forEach(e => evaluate(src.code(e.arguments[0]), deps)());
  await new Promise(r => setImmediate(r)); assert.equal(loads, 0); assert.equal(rpcs, 0);
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
test('deleting the last quotation does not seed replacement documents', () => {
  const src = sourceNodes('src/Quotations.jsx');
  const effect = src.effects.find(x => src.code(x.arguments[0]).includes('const seeded'));
  let seeds = 0;
  const deps = { isLoading: false, initializedQuotationsRef: { current: false }, quotationDocs: [{ id: 'existing' }], activities: [local('p1')], setQuotationDocs() { seeds++; }, db: { quotations: { bulkPut: () => Promise.resolve() } } };
  evaluate(src.code(effect.arguments[0]), deps)();
  evaluate(src.code(effect.arguments[0]), { ...deps, quotationDocs: [] })();
  assert.equal(seeds, 0);
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
