const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');

function makeStore(keyName = 'id') {
  const map = new Map();
  return {
    map,
    get: async (id) => map.get(id),
    put: async (row) => map.set(row[keyName], structuredClone(row)),
    delete: async (id) => map.delete(id)
  };
}

async function createSyncHarness(respond = () => ({ data: null, error: null })) {
  const channels = [];
  const listeners = [];
  const sent = [];
  const dispatchedEvents = [];
  const bcMessages = [];
  const queries = [];

  const db = {
    staff: makeStore('id'),
    sync_meta: makeStore('key')
  };

  const client = {
    auth: { getSession: async () => ({ data: { session: null } }) },
    from(table) {
      const q = { table, filters: [] };
      for (const method of ['select', 'eq', 'maybeSingle', 'single']) {
        q[method] = (...args) => {
          q[method + 'Args'] = args;
          if (method === 'eq') q.filters.push(args);
          return q;
        };
      }
      q.then = (ok, fail) => {
        queries.push(q);
        return Promise.resolve().then(() => respond(q)).then(ok, fail);
      };
      return q;
    },
    channel(name) {
      const ch = {
        name,
        on(event, filter, cb) {
          listeners.push({ channel: name, event, filter, cb });
          return this;
        },
        subscribe() {
          return this;
        },
        send(payload) {
          sent.push({ channel: name, payload });
          return Promise.resolve('ok');
        }
      };
      channels.push(ch);
      return ch;
    },
    removeChannel() {}
  };

  class MockCustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  }

  class MockBroadcastChannel {
    constructor(name) {
      this.name = name;
    }
    postMessage(msg) {
      bcMessages.push({ channel: this.name, msg });
    }
    close() {}
  }

  const storageMap = new Map();
  const mockLocalStorage = {
    getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
    setItem: (k, v) => storageMap.set(k, String(v)),
    removeItem: (k) => storageMap.delete(k)
  };

  const mockWindow = {
    dispatchEvent(evt) {
      dispatchedEvents.push(evt);
      return true;
    },
    addEventListener() {},
    removeEventListener() {}
  };

  const schemas = await import(pathToFileURL(path.join(root, 'src/schemas/index.js')));
  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    Date,
    Map,
    Set,
    Promise,
    JSON,
    Uint8Array,
    Math,
    window: mockWindow,
    CustomEvent: MockCustomEvent,
    BroadcastChannel: MockBroadcastChannel,
    localStorage: mockLocalStorage
  });

  const mod = new vm.SourceTextModule(
    fs.readFileSync(path.join(root, 'src/services/syncService.js'), 'utf8'),
    { context }
  );
  await mod.link((specifier) => {
    const exports = specifier.includes('supabaseClient')
      ? { supabase: client, getActiveClient: () => client }
      : specifier === './db'
        ? { db }
        : specifier.includes('warehouseService')
          ? { resetWarehouseAuthSession: () => {} }
          : schemas;
    return new vm.SyntheticModule(
      Object.keys(exports),
      function () {
        for (const [k, v] of Object.entries(exports)) this.setExport(k, v);
      },
      { context }
    );
  });
  await mod.evaluate();

  return { api: mod.namespace, channels, listeners, sent, dispatchedEvents, bcMessages, queries, db };
}

test('broadcastPermissionsUpdated sends to realtime-roles-channel matching subscribeToRolesRealtime', async () => {
  const h = await createSyncHarness();
  const received = [];
  const unsub = h.api.subscribeToRolesRealtime((matrix) => received.push(matrix));

  const rolesListener = h.listeners.find(
    (l) => l.channel === 'realtime-roles-channel' && l.event === 'broadcast' && l.filter?.event === 'PERMISSIONS_UPDATED'
  );
  assert.ok(rolesListener, 'subscribeToRolesRealtime should listen on realtime-roles-channel');

  const nextPerms = { driver: { label: 'Driver', allowed_pages: ['Calendar', 'Locations'] } };
  h.api.broadcastPermissionsUpdated(nextPerms);

  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].channel, 'realtime-roles-channel');
  assert.notEqual(h.sent[0].channel, 'flower2u_global_sync');
  assert.equal(h.sent[0].payload.event, 'PERMISSIONS_UPDATED');
  assert.deepEqual(h.sent[0].payload.payload.permissions, nextPerms);

  rolesListener.cb({ payload: h.sent[0].payload.payload });
  assert.deepEqual(received, [nextPerms]);
  unsub();
});

test('broadcastStaffUpdated dispatches f2u_staff_updated, emits local sync STAFF_UPDATED, and broadcasts on realtime-staff-monitor', async () => {
  const h = await createSyncHarness();
  const staffPayload = {
    id: 'STF-01',
    username: 'somchai',
    full_name: 'Somchai',
    role: 'accountant',
    password: 'secret-should-be-stripped'
  };

  h.api.broadcastStaffUpdated(staffPayload);

  const staffEvt = h.dispatchedEvents.find((e) => e.type === 'f2u_staff_updated');
  assert.ok(staffEvt, 'should dispatch window CustomEvent f2u_staff_updated');
  assert.equal(staffEvt.detail.username, 'somchai');
  assert.equal('password' in staffEvt.detail, false);

  const localSyncMsg = h.bcMessages.find((m) => m.msg?.type === 'STAFF_UPDATED');
  assert.ok(localSyncMsg, 'should emit STAFF_UPDATED over LocalSyncChannel');
  assert.equal(localSyncMsg.msg.staff.role, 'accountant');

  const supaBroadcast = h.sent.find((s) => s.channel === 'realtime-staff-monitor');
  assert.ok(supaBroadcast, 'should broadcast STAFF_UPDATED on realtime-staff-monitor');
  assert.equal(supaBroadcast.payload.event, 'STAFF_UPDATED');
  assert.equal(supaBroadcast.payload.payload.staff.role, 'accountant');
});

test('subscribeToStaffRealtime resolves role_id from roles table on UPDATE and handles STAFF_UPDATED broadcast', async () => {
  const h = await createSyncHarness((q) => {
    if (q.table === 'roles') {
      return {
        data: {
          id: 'role-acc',
          name: 'accountant',
          label: 'Accountant',
          code: '41',
          allowed_pages: ['Calendar', 'Plans', 'Finance']
        },
        error: null
      };
    }
    return { data: null, error: null };
  });

  const updates = [];
  const unsub = h.api.subscribeToStaffRealtime((staffRow, eventType) => {
    updates.push({ staffRow, eventType });
  });

  const pgListener = h.listeners.find(
    (l) => l.channel === 'realtime-staff-monitor' && l.event === 'postgres_changes' && l.filter?.table === 'staff_users'
  );
  assert.ok(pgListener, 'should subscribe to postgres_changes on staff_users');

  await pgListener.cb({
    eventType: 'UPDATE',
    new: { id: 'STF-02', username: 'nida', full_name: 'Nida', role_id: 'role-acc', is_active: true }
  });

  assert.ok(h.queries.some((q) => q.table === 'roles'), 'should query roles table to resolve role_id');
  assert.equal(updates.length, 1);
  assert.equal(updates[0].eventType, 'UPDATE');
  assert.equal(updates[0].staffRow.role, 'accountant');
  assert.deepEqual(updates[0].staffRow.allowed_pages, ['Calendar', 'Plans', 'Finance']);

  const bcListener = h.listeners.find(
    (l) => l.channel === 'realtime-staff-monitor' && l.event === 'broadcast' && l.filter?.event === 'STAFF_UPDATED'
  );
  assert.ok(bcListener, 'should subscribe to STAFF_UPDATED broadcast on realtime-staff-monitor');

  await bcListener.cb({
    payload: { staff: { id: 'STF-02', username: 'nida', role: 'admin', allowed_pages: ['Calendar', 'Staff'] } }
  });

  assert.equal(updates.length, 2);
  assert.equal(updates[1].staffRow.role, 'admin');
  assert.deepEqual(updates[1].staffRow.allowed_pages, ['Calendar', 'Staff']);
  unsub();
});

test('App.jsx wires STAFF_UPDATED, f2u_staff_updated, subscribeToStaffRealtime, and syncs both localStorage and sessionStorage', () => {
  const appSource = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');

  assert.match(appSource, /localStorage\.getItem\('nexus_profile'\)\s*\|\|\s*sessionStorage\.getItem\('nexus_profile'\)/);
  assert.match(appSource, /sessionStorage\.setItem\('nexus_profile'/);
  assert.match(appSource, /const\s+applyRealtimeStaffProfile\s*=\s*\(staffRow\)\s*=>/);
  assert.match(appSource, /msg\.type\s*===\s*'STAFF_UPDATED'\s*&&\s*msg\.staff/);
  assert.match(appSource, /window\.addEventListener\('f2u_staff_updated',\s*handleLocalStaffUpdated\)/);
  assert.match(appSource, /window\.removeEventListener\('f2u_staff_updated',\s*handleLocalStaffUpdated\)/);
  assert.match(appSource, /if\s*\(isSuspended\)\s*\{[\s\S]*?\}\s*else\s*\{\s*applyRealtimeStaffProfile\(staffRow\);/);
});
