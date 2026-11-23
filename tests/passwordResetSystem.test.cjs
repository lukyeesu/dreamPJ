const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const clone = (x) => (x === undefined ? undefined : structuredClone(x));

function createMemoryLocalStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(String(k)) ? store.get(String(k)) : null),
    setItem: (k, v) => { store.set(String(k), String(v)); },
    removeItem: (k) => { store.delete(String(k)); },
    clear: () => { store.clear(); },
    _store: store
  };
}

async function createStaffHarness({
  initialStaff = [],
  nowMs = null,
  session = { user: { id: 'admin-uuid', email: 'admin@flower2u.com', user_metadata: { username: '1' } } },
  clientDisabled = false,
  respond = () => ({ data: null, error: null })
} = {}) {
  const staffRows = new Map(initialStaff.map((s) => [String(s.id), clone(s)]));
  const requests = [];
  const authCalls = [];
  const ephemeralClients = [];
  const ephemeralAuthCalls = [];
  const localStorage = createMemoryLocalStorage();
  const sessionStorage = createMemoryLocalStorage();
  let activeSession = clone(session);

  let currentNow = nowMs ?? Date.now();
  class MockDate extends Date {
    constructor(...args) {
      if (args.length === 0) {
        super(currentNow);
      } else {
        super(...args);
      }
    }
    static now() {
      return currentNow;
    }
  }

  const db = {
    transaction: async (_mode, _table, cb) => cb(),
    projects: {
      toArray: async () => [],
      get: async () => undefined,
      bulkGet: async () => [],
      put: async () => {},
      bulkPut: async () => {},
      delete: async () => {},
      bulkDelete: async () => {}
    },
    staff: {
      toArray: async () => clone([...staffRows.values()]),
      get: async (id) => clone(staffRows.get(String(id))),
      put: async (row) => { staffRows.set(String(row.id), clone(row)); },
      bulkPut: async (items) => { items.forEach((row) => staffRows.set(String(row.id), clone(row))); },
      delete: async (id) => { staffRows.delete(String(id)); },
      clear: async () => { staffRows.clear(); },
      where: (field) => ({
        equals: (val) => ({
          first: async () => clone([...staffRows.values()].find((r) => r[field] === val))
        })
      })
    }
  };

  const client = clientDisabled
    ? null
    : {
        supabaseUrl: 'https://test-project.supabase.co',
        supabaseKey: 'test-anon-key',
        auth: {
          getSession: async () => ({ data: { session: activeSession } }),
          signUp: async (payload) => {
            authCalls.push({ op: 'signUp', payload: clone(payload) });
            // Simulate Supabase GoTrue behavior: signUp on singleton overwrites active session!
            activeSession = { user: { id: 'clobbered-new-auth-user', email: payload?.email } };
            return { data: { user: activeSession.user, session: activeSession }, error: null };
          },
          updateUser: async (payload) => {
            authCalls.push({ op: 'updateUser', payload: clone(payload) });
            return { data: { user: activeSession?.user || null }, error: null };
          }
        },
        from(table) {
          const q = { table, op: 'select', filters: [] };
          for (const method of [
            'select', 'gte', 'lte', 'lt', 'gt', 'eq', 'ilike', 'in',
            'order', 'range', 'limit', 'maybeSingle', 'upsert', 'insert', 'update', 'delete'
          ]) {
            q[method] = (...args) => {
              q[method + 'Args'] = args;
              if (['insert', 'update', 'delete', 'upsert'].includes(method)) {
                q.op = method;
                q.payload = clone(args[0]);
              }
              if (['eq', 'ilike', 'in', 'gte', 'lte', 'lt'].includes(method)) {
                q.filters.push([method, ...args]);
              }
              return q;
            };
          }
          q.then = (ok, fail) => {
            requests.push(q);
            return Promise.resolve().then(() => respond(q)).then(ok, fail);
          };
          return q;
        },
        rpc(name, payload) {
          const q = { table: name, op: 'rpc', payload: clone(payload) };
          requests.push(q);
          return Promise.resolve().then(() => respond(q));
        },
        channel() {
          return { on() { return this; }, subscribe() { return this; } };
        },
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

  const supabaseJsMock = {
    createClient: (url, key, options) => {
      ephemeralClients.push({ url, key, options: clone(options) });
      return {
        auth: {
          signUp: async (payload) => {
            ephemeralAuthCalls.push({ op: 'signUp', payload: clone(payload) });
            return { data: { user: { id: 'new-auth-user', email: payload?.email } }, error: null };
          }
        }
      };
    }
  };

  const context = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    Date: MockDate,
    Map,
    Set,
    Promise,
    JSON,
    Uint8Array,
    TextEncoder,
    crypto: crypto.webcrypto,
    localStorage,
    sessionStorage
  });

  const createSynth = (exportsObj) =>
    new vm.SyntheticModule(
      Object.keys(exportsObj),
      function () {
        for (const [k, v] of Object.entries(exportsObj)) {
          this.setExport(k, v);
        }
      },
      { context }
    );

  const module = new vm.SourceTextModule(
    fs.readFileSync(path.join(root, 'src/services/syncService.js'), 'utf8'),
    {
      context,
      async importModuleDynamically(specifier) {
        const exportsObj = specifier === '@supabase/supabase-js'
          ? supabaseJsMock
          : specifier.includes('warehouseService')
            ? warehouseMock
            : {};
        const synth = createSynth(exportsObj);
        await synth.link(() => {});
        await synth.evaluate();
        return synth;
      }
    }
  );

  await module.link((specifier) => {
    const exports = specifier.includes('supabaseClient')
      ? { supabase: client, getActiveClient: () => client }
      : specifier === './db'
        ? { db }
        : specifier.includes('formatters')
          ? { generateTrackingToken: () => '' }
          : specifier.includes('warehouseService')
            ? warehouseMock
            : schemas;
    return createSynth(exports);
  });

  await module.evaluate();

  return {
    api: module.namespace,
    client,
    schemas,
    staffRows,
    requests,
    authCalls,
    ephemeralClients,
    ephemeralAuthCalls,
    localStorage,
    sessionStorage,
    advanceMinutes(mins) {
      currentNow += mins * 60 * 1000;
    }
  };
}

// -----------------------------------------------------------------------------
// 1. Zod Schema Tests (Zero-Knowledge HR Form)
// -----------------------------------------------------------------------------
test('staffFormSchema allows omitted and empty password/confirmPassword while rejecting mismatches', async () => {
  const { staffFormSchema } = await import(pathToFileURL(path.join(root, 'src/schemas/staffSchema.js')));

  const omitted = staffFormSchema.safeParse({
    username: 'somchai',
    name: 'สมชาย ใจดี',
    role: 'technician'
  });
  assert.equal(omitted.success, true);
  assert.equal(omitted.data.password, '');
  assert.equal(omitted.data.confirmPassword, '');

  const emptyStrings = staffFormSchema.safeParse({
    username: 'somying',
    password: '',
    confirmPassword: ''
  });
  assert.equal(emptyStrings.success, true);

  const matched = staffFormSchema.safeParse({
    username: 'somying',
    password: 'Secret#123',
    confirmPassword: 'Secret#123'
  });
  assert.equal(matched.success, true);

  const mismatched = staffFormSchema.safeParse({
    username: 'somying',
    password: 'Secret#123',
    confirmPassword: 'DifferentPassword'
  });
  assert.equal(mismatched.success, false);
  assert.equal(mismatched.error.issues[0].path[0], 'confirmPassword');

  const halfFilled = staffFormSchema.safeParse({
    username: 'somying',
    password: '',
    confirmPassword: 'OnlyConfirmProvided'
  });
  assert.equal(halfFilled.success, false);
});

// -----------------------------------------------------------------------------
// 2. Supabase RPC Flow Tests
// -----------------------------------------------------------------------------
test('RPC flow: create, validate, and consume staff reset token with zero password leakage', async () => {
  let tokenUsed = false;
  const rawToken = 'rst_0123456789abcdef0123456789abcdef0123456789abcdef';
  const expiresAtIso = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const h = await createStaffHarness({
    initialStaff: [{ id: '2621005', username: 'AOM', name: 'AOM', password: 'legacy-leaked-pass' }],
    respond(q) {
      if (q.op === 'rpc' && q.table === 'create_staff_reset_token') {
        return {
          data: {
            token: rawToken,
            expires_at: expiresAtIso,
            ttl_minutes: q.payload.p_ttl_minutes,
            staff_id: q.payload.p_staff_id,
            username: 'AOM',
            full_name: 'อ้อม ช่างดอกไม้',
            nickname: 'อ้อม'
          },
          error: null
        };
      }
      if (q.op === 'rpc' && q.table === 'validate_staff_reset_token') {
        if (q.payload.p_token !== rawToken) {
          return { data: { valid: false, reason: 'INVALID' }, error: null };
        }
        if (tokenUsed) {
          return { data: { valid: false, reason: 'USED' }, error: null };
        }
        return {
          data: {
            valid: true,
            staff_id: '2621005',
            username: 'AOM',
            full_name: 'อ้อม ช่างดอกไม้',
            nickname: 'อ้อม',
            expires_at: expiresAtIso
          },
          error: null
        };
      }
      if (q.op === 'rpc' && q.table === 'consume_staff_reset_token') {
        if (tokenUsed) {
          return { data: { success: false, reason: 'USED' }, error: null };
        }
        tokenUsed = true;
        return {
          data: { success: true, staff_id: '2621005', username: 'AOM' },
          error: null
        };
      }
      return { data: null, error: null };
    }
  });

  const created = await h.api.createStaffResetTokenSync('2621005', { ttlMinutes: 15 });
  assert.equal(created.token, rawToken);
  assert.equal(created.localOnly, false);
  assert.equal(created.staffId, '2621005');
  assert.equal(created.fullName, 'อ้อม ช่างดอกไม้');

  // Invalid prefix is rejected before hitting RPC
  const badPrefix = await h.api.validateStaffResetTokenSync('bad_token');
  assert.deepEqual({ ...badPrefix }, { valid: false, reason: 'INVALID' });

  const validRes = await h.api.validateStaffResetTokenSync(`  ${rawToken}  `);
  assert.equal(validRes.valid, true);
  assert.equal(validRes.staffId, '2621005');
  assert.equal(validRes.username, 'AOM');

  // Weak password (< 6 chars) rejected client-side before consuming token
  await assert.rejects(
    () => h.api.consumeStaffResetTokenSync(rawToken, '12345'),
    (err) => err.message.includes('อย่างน้อย 6 ตัวอักษร')
  );
  assert.equal(tokenUsed, false);

  // Valid one-time consumption
  const consumed = await h.api.consumeStaffResetTokenSync(rawToken, 'NewStrongPass#2026');
  assert.equal(consumed.success, true);
  assert.equal(consumed.username, 'AOM');

  // Ensure plaintext password was stripped/never written into local db.staff
  const cachedAfter = h.staffRows.get('2621005');
  assert.equal('password' in cachedAfter, false);

  // Second reuse is blocked with USED
  const validAfterUse = await h.api.validateStaffResetTokenSync(rawToken);
  assert.deepEqual({ ...validAfterUse }, { valid: false, reason: 'USED' });

  await assert.rejects(
    () => h.api.consumeStaffResetTokenSync(rawToken, 'AnotherPass#2026'),
    (err) => err.reason === 'USED' && err.message.includes('ถูกใช้งานไปแล้ว')
  );
});

test('validateStaffResetTokenSync trusts server INVALID response and does not read localStorage when RPC exists', async () => {
  const h = await createStaffHarness({
    respond(q) {
      if (q.op === 'rpc' && q.table === 'create_staff_reset_token') {
        return { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };
      }
      if (q.op === 'rpc' && q.table === 'validate_staff_reset_token') {
        return { data: { valid: false, reason: 'EXPIRED' }, error: null };
      }
      return { data: null, error: null };
    }
  });

  // Seed a local token via PGRST202 on create, then have server validate RPC respond EXPIRED
  const localToken = await h.api.createStaffResetTokenSync('2611002', { username: 'AOM' });
  assert.equal(localToken.localOnly, true);

  const check = await h.api.validateStaffResetTokenSync(localToken.token);
  assert.deepEqual({ ...check }, { valid: false, reason: 'EXPIRED' });
});

// -----------------------------------------------------------------------------
// 3. PGRST202 / Offline Fallback Flow Tests
// -----------------------------------------------------------------------------
test('PGRST202 fallback enforces SHA-256 storage, prior-token invalidation, one-time use, and 15-min TTL', async () => {
  const h = await createStaffHarness({
    nowMs: Date.parse('2026-11-24T01:00:00.000Z'),
    initialStaff: [{ id: '2611003', username: 'DREAM', name: 'หมูดรีม' }],
    respond(q) {
      if (q.op === 'rpc') {
        return {
          data: null,
          error: { code: 'PGRST202', message: 'Could not find the function public.create_staff_reset_token in the schema cache' }
        };
      }
      return { data: null, error: null };
    }
  });

  // 1. Create first token -> invalidated when second token is created for same staffId
  const first = await h.api.createStaffResetTokenSync('2611003', { ttlMinutes: 15, username: 'DREAM', fullName: 'หมูดรีม' });
  assert.equal(first.localOnly, true);
  assert.match(first.token, /^rst_[0-9a-f]{48}$/);

  // Raw token must NEVER appear in localStorage
  const rawStoredJson = h.localStorage.getItem('nexus_staff_reset_tokens_v1');
  assert(rawStoredJson && !rawStoredJson.includes(first.token));

  const second = await h.api.createStaffResetTokenSync('2611003', { ttlMinutes: 15, username: 'DREAM', fullName: 'หมูดรีม' });
  assert.notEqual(first.token, second.token);

  const firstValidation = await h.api.validateStaffResetTokenSync(first.token);
  assert.deepEqual({ ...firstValidation }, { valid: false, reason: 'USED' });

  const secondValidation = await h.api.validateStaffResetTokenSync(second.token);
  assert.equal(secondValidation.valid, true);
  assert.equal(secondValidation.staffId, '2611003');

  // 2. Weak password rejected without burning the token
  await assert.rejects(
    () => h.api.consumeStaffResetTokenSync(second.token, 'short'),
    /อย่างน้อย 6 ตัวอักษร/
  );
  assert.equal((await h.api.validateStaffResetTokenSync(second.token)).valid, true);

  // 3. Consume valid token -> marks used, updates local Dexie without plaintext password, best-effort updates staff_users
  const consumeRes = await h.api.consumeStaffResetTokenSync(second.token, 'DreamSecure#99');
  assert.equal(consumeRes.success, true);
  assert.equal(consumeRes.staffId, '2611003');

  const localStaff = h.staffRows.get('2611003');
  assert.equal('password' in localStaff, false);
  assert.equal(typeof localStaff.password_hash, 'string');
  assert.notEqual(localStaff.password_hash, 'DreamSecure#99');

  const staffTableUpdate = h.requests.find((r) => r.table === 'staff_users' && r.op === 'update');
  assert(staffTableUpdate);
  assert.equal(staffTableUpdate.payload.password, 'DreamSecure#99');

  // Reuse blocked with USED
  await assert.rejects(
    () => h.api.consumeStaffResetTokenSync(second.token, 'DreamSecure#100'),
    (err) => err.reason === 'USED' && err.message.includes('ถูกใช้งานไปแล้ว')
  );

  // 4. Create third token and advance clock past 15 minutes -> EXPIRED
  const third = await h.api.createStaffResetTokenSync('2611003', { ttlMinutes: 15 });
  h.advanceMinutes(16);

  const expiredCheck = await h.api.validateStaffResetTokenSync(third.token);
  assert.deepEqual({ ...expiredCheck }, { valid: false, reason: 'EXPIRED' });

  await assert.rejects(
    () => h.api.consumeStaffResetTokenSync(third.token, 'ValidLengthPass123'),
    (err) => err.reason === 'EXPIRED' && err.message.includes('หมดอายุ')
  );
});

// -----------------------------------------------------------------------------
// 4. saveStaffSync & loadStaffLocalFirst Zero-Leakage & Password Preservation
// -----------------------------------------------------------------------------
test('loadStaffLocalFirst strips any cached password and never injects default password "1"', async () => {
  const h = await createStaffHarness({
    initialStaff: [{ id: '2611001', username: '1', name: 'Admin', password: '1' }],
    respond(q) {
      if (q.table === 'staff_users' && q.op === 'select') {
        return {
          data: [
            {
              id: '2611001',
              username: '1',
              full_name: 'Admin User',
              nickname: 'Admin',
              is_active: true,
              roles: { name: 'admin', code: '11', label: 'ผู้ดูแลระบบ (Admin)' }
            }
          ],
          error: null
        };
      }
      return { data: null, error: null };
    }
  });

  const updates = [];
  const loaded = await h.api.loadStaffLocalFirst((rows) => updates.push(rows));
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].password, undefined);
  assert.equal('password' in h.staffRows.get('2611001'), false);
  for (const snapshot of updates) {
    for (const row of snapshot) {
      assert.equal(row.password, undefined);
    }
  }
});

test('saveStaffSync generates random locked secret on new staff creation and preserves password on staff edit', async () => {
  const h = await createStaffHarness({
    initialStaff: [{ id: '2611002', username: 'AOM', name: 'AOM Old', role: 'technician' }],
    respond(q) {
      if (q.table === 'roles') {
        return { data: { id: 'role-tech-uuid' }, error: null };
      }
      if (q.table === 'staff_users' && q.op === 'select') {
        // New staff '2621999' does NOT exist on server yet
        return { data: null, error: null };
      }
      return { data: null, error: null };
    }
  });

  // Case A: Create brand new staff (Staff.jsx passes generated staff_code as id, with NO password)
  const created = await h.api.saveStaffSync({
    id: '2621999',
    staff_code: '2621999',
    username: 'newbie',
    name: 'พนักงานใหม่',
    role: 'technician'
  });

  assert.equal('password' in created, false);
  assert.equal('password' in h.staffRows.get('2621999'), false);

  const insertUpsert = h.requests.find(
    (r) => r.table === 'staff_users' && r.op === 'upsert' && r.payload.id === '2621999'
  );
  assert(insertUpsert);
  assert.notEqual(insertUpsert.payload.password, '1');
  assert.match(insertUpsert.payload.password, /^unset_[0-9a-f]{48}$/);

  // Case B: Edit existing staff without entering a password -> must NOT include password in supaPayload
  const updated = await h.api.saveStaffSync({
    id: '2611002',
    staff_code: '2611002',
    username: 'AOM',
    name: 'AOM Updated Name',
    role: 'technician',
    password: ''
  });

  assert.equal(updated.name, 'AOM Updated Name');
  assert.equal('password' in updated, false);
  assert.equal('password' in h.staffRows.get('2611002'), false);

  const editUpsert = h.requests.find(
    (r) => r.table === 'staff_users' && r.op === 'upsert' && r.payload.id === '2611002'
  );
  assert(editUpsert);
  assert.equal('password' in editUpsert.payload, false);

  // Case C: Self-profile password update -> includes password in supaPayload & updates auth.updateUser, still zero local leakage
  const selfUpdated = await h.api.saveStaffSync({
    id: '2611001',
    staff_code: '2611001',
    username: '1',
    email: 'admin@flower2u.com',
    name: 'Admin',
    role: 'admin',
    password: 'MyNewAdminPassword!'
  });
  assert.equal('password' in selfUpdated, false);
  assert.equal('password' in h.staffRows.get('2611001'), false);

  const selfUpsert = h.requests.find(
    (r) => r.table === 'staff_users' && r.op === 'upsert' && r.payload.id === '2611001'
  );
  assert.equal(selfUpsert.payload.password, 'MyNewAdminPassword!');
  assert(h.authCalls.some((c) => c.op === 'updateUser' && c.payload.password === 'MyNewAdminPassword!'));
});

test('FORBIDDEN from create_staff_reset_token throws clear Thai Admin error and NEVER mints a local token', async () => {
  const h = await createStaffHarness({
    session: { user: { id: 'tech-uuid', email: 'aom@flower2u.internal', user_metadata: { username: 'AOM' } } },
    respond(q) {
      if (q.op === 'rpc' && q.table === 'create_staff_reset_token') {
        return {
          data: null,
          error: { code: 'P0001', message: 'FORBIDDEN: ไม่มีสิทธิ์สร้างลิงก์เปลี่ยนรหัสผ่าน' }
        };
      }
      return { data: null, error: null };
    }
  });

  // Even if attacker tampers with localStorage nexus_profile to claim role='admin', server FORBIDDEN wins
  h.localStorage.setItem('nexus_profile', JSON.stringify({ role: 'admin', username: 'AOM' }));

  await assert.rejects(
    () => h.api.createStaffResetTokenSync('2611001', { ttlMinutes: 15 }),
    (err) =>
      err.code === 'FORBIDDEN' &&
      err.message === 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถสร้างลิงก์เปลี่ยนรหัสผ่านได้'
  );

  assert.equal(h.localStorage.getItem('nexus_staff_reset_tokens_v1'), null);
});

test('UNAUTHORIZED / PGRST202 local fallback is strictly restricted to Admin nexus_profile when auth.uid() is null', async () => {
  // 1. Custom login without Supabase JWT (session: null) + non-admin nexus_profile -> BLOCKED
  const nonAdminHarness = await createStaffHarness({
    session: null,
    respond(q) {
      if (q.op === 'rpc' && q.table === 'create_staff_reset_token') {
        return {
          data: null,
          error: { code: 'P0001', message: 'UNAUTHORIZED: กรุณาเข้าสู่ระบบก่อนสร้างลิงก์ตั้งรหัสผ่าน' }
        };
      }
      return { data: null, error: null };
    }
  });

  nonAdminHarness.localStorage.setItem('nexus_profile', JSON.stringify({ role: 'technician', username: 'AOM' }));

  await assert.rejects(
    () => nonAdminHarness.api.createStaffResetTokenSync('2611001'),
    (err) =>
      err.code === 'FORBIDDEN' &&
      err.message === 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถสร้างลิงก์เปลี่ยนรหัสผ่านได้'
  );
  assert.equal(nonAdminHarness.localStorage.getItem('nexus_staff_reset_tokens_v1'), null);

  // 2. Custom login without Supabase JWT (session: null) + admin nexus_profile -> allowed dev/local fallback
  const devAdminHarness = await createStaffHarness({
    session: null,
    initialStaff: [{ id: '2611002', username: 'AOM', name: 'อ้อม' }],
    respond(q) {
      if (q.op === 'rpc' && q.table === 'create_staff_reset_token') {
        return {
          data: null,
          error: { code: 'P0001', message: 'UNAUTHORIZED: กรุณาเข้าสู่ระบบก่อนสร้างลิงก์ตั้งรหัสผ่าน' }
        };
      }
      return { data: null, error: null };
    }
  });

  devAdminHarness.localStorage.setItem('nexus_profile', JSON.stringify({ role: 'admin', username: '1' }));
  const fallbackRes = await devAdminHarness.api.createStaffResetTokenSync('2611002');
  assert.equal(fallbackRes.localOnly, true);
  assert.match(fallbackRes.token, /^rst_[0-9a-f]{48}$/);

  // 3. PGRST202 with non-admin nexus_profile -> BLOCKED
  const pgrstNonAdmin = await createStaffHarness({
    respond(q) {
      if (q.op === 'rpc') {
        return { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };
      }
      return { data: null, error: null };
    }
  });
  pgrstNonAdmin.localStorage.setItem('nexus_profile', JSON.stringify({ role: 'driver', username: 'DRV1' }));
  await assert.rejects(
    () => pgrstNonAdmin.api.createStaffResetTokenSync('2611001'),
    (err) => err.code === 'FORBIDDEN'
  );
  assert.equal(pgrstNonAdmin.localStorage.getItem('nexus_staff_reset_tokens_v1'), null);
});

test('suspended or inactive staff cannot validate or consume password reset tokens', async () => {
  // Server RPC SUSPENDED response
  const rpcHarness = await createStaffHarness({
    respond(q) {
      if (q.op === 'rpc' && q.table === 'validate_staff_reset_token') {
        return { data: { valid: false, reason: 'SUSPENDED' }, error: null };
      }
      if (q.op === 'rpc' && q.table === 'consume_staff_reset_token') {
        return {
          data: {
            success: false,
            reason: 'SUSPENDED',
            message: 'บัญชีผู้ใช้นี้ถูกระงับการใช้งาน ไม่สามารถตั้งรหัสผ่านใหม่ได้'
          },
          error: null
        };
      }
      return { data: null, error: null };
    }
  });

  const token = 'rst_abcdef0123456789abcdef0123456789abcdef0123456789';
  const check = await rpcHarness.api.validateStaffResetTokenSync(token);
  assert.deepEqual({ ...check }, { valid: false, reason: 'SUSPENDED' });

  await assert.rejects(
    () => rpcHarness.api.consumeStaffResetTokenSync(token, 'StrongPass#2026'),
    (err) => err.reason === 'SUSPENDED' && err.message.includes('ระงับ')
  );

  // Local PGRST202 fallback also blocks banned/inactive staff
  const localHarness = await createStaffHarness({
    nowMs: Date.parse('2026-11-24T01:00:00.000Z'),
    initialStaff: [
      { id: '2611009', username: 'BANNED_STAFF', name: 'ถูกแบน', is_active: true, is_banned_permanent: true }
    ],
    respond(q) {
      if (q.op === 'rpc') {
        return { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };
      }
      return { data: null, error: null };
    }
  });
  localHarness.localStorage.setItem('nexus_profile', JSON.stringify({ role: 'admin', username: '1' }));

  const minted = await localHarness.api.createStaffResetTokenSync('2611009');
  const localCheck = await localHarness.api.validateStaffResetTokenSync(minted.token);
  assert.deepEqual({ ...localCheck }, { valid: false, reason: 'SUSPENDED' });

  await assert.rejects(
    () => localHarness.api.consumeStaffResetTokenSync(minted.token, 'StrongPass#2026'),
    (err) => err.reason === 'SUSPENDED'
  );
});

test('syncStaffToSupabaseAuth uses an isolated ephemeral Supabase client so signUp never clobbers Admin session', async () => {
  const h = await createStaffHarness({
    session: { user: { id: 'admin-uuid-preserve', email: 'admin@flower2u.com', user_metadata: { username: '1' } } },
    respond(q) {
      if (q.table === 'roles') {
        return { data: { id: 'role-tech-uuid' }, error: null };
      }
      return { data: null, error: null };
    }
  });

  await h.api.saveStaffSync({
    id: '2621888',
    staff_code: '2621888',
    username: 'Somchai.New',
    name: 'สมชาย พนักงานใหม่',
    role: 'technician'
  });

  // 1. Singleton client.auth.signUp must NEVER be called
  assert.equal(h.authCalls.filter((c) => c.op === 'signUp').length, 0);

  // 2. Admin session on singleton client remains 100% intact
  const sessionAfter = await h.client.auth.getSession();
  assert.equal(sessionAfter.data.session.user.id, 'admin-uuid-preserve');
  assert.equal(sessionAfter.data.session.user.email, 'admin@flower2u.com');

  // 3. Ephemeral client was created with strict non-persisting isolated auth options
  assert.equal(h.ephemeralClients.length, 1);
  assert.deepEqual(h.ephemeralClients[0].options, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'nexus_ephemeral_signup'
    }
  });
  assert.equal(h.ephemeralAuthCalls.length, 1);
  assert.equal(h.ephemeralAuthCalls[0].payload.email, 'somchainew@flower2u.internal');
});

test('SQL migration enforces RLS, Admin-only FORBIDDEN guard, to_jsonb ban checks, and sanitized auth.users email sync', () => {
  const sql = fs.readFileSync(path.join(root, 'database_scripts/add_password_reset_system.sql'), 'utf8');
  assert.match(sql, /CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.staff_password_resets/i);
  assert.match(sql, /ALTER TABLE public\.staff_password_resets ENABLE ROW LEVEL SECURITY;/i);
  assert.match(sql, /REVOKE ALL ON TABLE public\.staff_password_resets FROM PUBLIC,\s*anon,\s*authenticated;/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.create_staff_reset_token/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.validate_staff_reset_token/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.consume_staff_reset_token/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.create_staff_reset_token\(TEXT,\s*INT\) TO authenticated;/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.validate_staff_reset_token\(TEXT\) TO anon,\s*authenticated;/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.consume_staff_reset_token\(TEXT,\s*TEXT\) TO anon,\s*authenticated;/i);

  // Security Audit checks:
  // 1. Admin role authorization & FORBIDDEN exception in create_staff_reset_token
  assert.match(sql, /LEFT JOIN public\.roles r ON s\.role_id = r\.id/i);
  assert.match(sql, /FORBIDDEN:\s*ไม่มีสิทธิ์สร้างลิงก์เปลี่ยนรหัสผ่าน/);
  assert.match(sql, /can_manage_users/i);

  // 2. Schema-resilient to_jsonb suspension/ban checks (is_banned_permanent & banned_until)
  assert.match(sql, /is_banned_permanent/);
  assert.match(sql, /banned_until/);
  assert.match(sql, /to_jsonb\(/i);

  // 3. auth.users sync matches auth_user_id UUID + regexp_replace sanitized @flower2u.internal email
  assert.match(sql, /auth_user_id/);
  assert.match(sql, /regexp_replace\(v_username,\s*'\[\^a-zA-Z0-9_-\]',\s*'',\s*'g'\)/);
});

test('run_all_updates_once.sql combines all migrations without plaintext passwords and executes idempotently twice in PGlite', async (t) => {
  const unifiedPath = path.join(root, 'database_scripts/run_all_updates_once.sql');
  const sql = fs.readFileSync(unifiedPath, 'utf8');

  // 1. Static completeness & zero-plaintext-leakage audit
  assert.match(sql, /กดปุ่ม\s*"Run"\s*เพียงครั้งเดียว/);
  assert.match(sql, /CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS payment_statuses JSONB/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS project_categories JSONB/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS expense_categories JSONB/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS deal_statuses JSONB/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS transport_statuses JSONB/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS drive_folders JSONB/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ/i);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS is_banned_permanent BOOLEAN/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.staff_password_resets/i);
  assert.match(sql, /REVOKE ALL ON TABLE public\.staff_password_resets FROM PUBLIC,\s*anon,\s*authenticated;/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.suspend_staff_user/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.verify_staff_login/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.create_staff_reset_token/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.validate_staff_reset_token/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.consume_staff_reset_token/i);
  assert.match(sql, /DROP FUNCTION IF EXISTS public\.get_complete_analytics\(TEXT,\s*TEXT,\s*TEXT,\s*TEXT\);/i);
  assert.match(sql, /DROP FUNCTION IF EXISTS public\.get_complete_analytics\(TIMESTAMPTZ,\s*TIMESTAMPTZ,\s*TEXT,\s*TEXT\);/i);
  assert.match(sql, /DROP FUNCTION IF EXISTS public\.get_complete_analytics\(TIMESTAMPTZ,\s*TIMESTAMPTZ,\s*TEXT,\s*TEXT,\s*TEXT,\s*TEXT\);/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.get_complete_analytics/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.get_complete_analytics\(TIMESTAMPTZ,\s*TIMESTAMPTZ,\s*TEXT,\s*TEXT,\s*TEXT,\s*TEXT\) TO authenticated;/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.deleted_records/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.record_generic_deletion/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.save_project_with_items/i);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.allocate_next_project_code/i);
  assert.match(sql, /ALTER TABLE public\.projects REPLICA IDENTITY DEFAULT;/i);
  assert.match(sql, /NOTIFY pgrst,\s*'reload schema';/i);
  assert.doesNotMatch(sql, /SET\s+password\s*=\s*'(1|1234|aom@2026)'/i);

  // 2. Live PostgreSQL execution & double-run idempotency in PGlite + pgcrypto
  const { PGlite } = require('@electric-sql/pglite');
  const { pgcrypto } = require('@electric-sql/pglite/contrib/pgcrypto');

  const ADMIN_UID = '11111111-1111-4111-8111-111111111111';
  const TECH_UID = '22222222-2222-4222-8222-222222222222';

  const bootstrapAuthSql = `
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.users (
      id UUID PRIMARY KEY,
      email TEXT UNIQUE,
      encrypted_password TEXT,
      banned_until TIMESTAMPTZ,
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
    BEGIN
      RETURN NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
    EXCEPTION WHEN OTHERS THEN
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql STABLE;

    CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB AS $$
    BEGIN
      RETURN COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::JSONB, '{}'::JSONB);
    EXCEPTION WHEN OTHERS THEN
      RETURN '{}'::JSONB;
    END;
    $$ LANGUAGE plpgsql STABLE;

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
      END IF;
    END $$;

    GRANT USAGE ON SCHEMA public TO anon, authenticated;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
    GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated;

    CREATE TABLE IF NOT EXISTS public.projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'งานจัดดอกไม้',
      project_datetime TIMESTAMPTZ,
      payment_date DATE,
      artist_name TEXT,
      customer_name TEXT,
      location_name TEXT,
      raw_delivery_start TEXT,
      deal_status TEXT NOT NULL DEFAULT 'confirmed',
      transport_status TEXT NOT NULL DEFAULT 'preparing',
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      wage NUMERIC(12,2) DEFAULT 0,
      delivery_fee NUMERIC(12,2) DEFAULT 0,
      deposit_amount NUMERIC(12,2) DEFAULT 0,
      total_revenue NUMERIC(12,2) DEFAULT 0,
      total_expenses NUMERIC(12,2) DEFAULT 0,
      net_profit NUMERIC(12,2) DEFAULT 0,
      customer_support_total NUMERIC(12,2) DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS public.project_quotation_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
      category TEXT NOT NULL DEFAULT 'รายการทั่วไป',
      detail TEXT DEFAULT '',
      quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
      unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
      price NUMERIC(12,2) NOT NULL DEFAULT 0,
      item_date DATE
    );

    CREATE TABLE IF NOT EXISTS public.project_customer_support (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
      denomination INT NOT NULL,
      quantity INT NOT NULL DEFAULT 0,
      price NUMERIC(14,2) NOT NULL DEFAULT 0,
      item_date DATE
    );

    CREATE TABLE IF NOT EXISTS public.project_expenses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
      category TEXT NOT NULL DEFAULT 'ค่าใช้จ่ายทั่วไป',
      detail TEXT DEFAULT '',
      quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
      unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
      price NUMERIC(12,2) NOT NULL DEFAULT 0,
      item_date DATE
    );

    -- Seed optional business tables with legacy permissive anon policies to test RLS lockdown & triggers
    CREATE TABLE IF NOT EXISTS public.quotations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      quote_no TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL
    );
    ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow app full access to quotations" ON public.quotations
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    GRANT ALL ON public.quotations TO anon, authenticated;

    CREATE TABLE IF NOT EXISTS public.material_rates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      default_price_sqm NUMERIC(10,2) NOT NULL DEFAULT 0
    );
    ALTER TABLE public.material_rates ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow app full access to material_rates" ON public.material_rates
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    GRANT ALL ON public.material_rates TO anon, authenticated;

    CREATE TABLE IF NOT EXISTS public.delivery_locations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL UNIQUE
    );
    ALTER TABLE public.delivery_locations ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow app full access" ON public.delivery_locations
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    GRANT ALL ON public.delivery_locations TO anon, authenticated;

    -- Seed REPLICA IDENTITY FULL on projects + legacy deletion trigger + supabase_realtime publication
    ALTER TABLE public.projects REPLICA IDENTITY FULL;

    CREATE TABLE IF NOT EXISTS public.deleted_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      table_name TEXT NOT NULL DEFAULT 'projects',
      record_id TEXT NOT NULL,
      deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE OR REPLACE FUNCTION public.record_project_deletion() RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO public.deleted_records (record_id, table_name, deleted_at)
      VALUES (OLD.id, 'projects', now());
      RETURN OLD;
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER trigger_record_project_deletion
      AFTER DELETE ON public.projects
      FOR EACH ROW EXECUTE FUNCTION public.record_project_deletion();

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
      END IF;
    END $$;

    -- Seed conflicting legacy overloads to verify run_all_updates_once.sql drops them cleanly
    CREATE OR REPLACE FUNCTION public.get_complete_analytics(TEXT, TEXT, TEXT, TEXT)
      RETURNS JSON LANGUAGE sql AS 'SELECT ''{}''::json';
    CREATE OR REPLACE FUNCTION public.get_complete_analytics(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT)
      RETURNS JSON LANGUAGE sql AS 'SELECT ''{}''::json';
  `;

  // Scenario A: Fresh/partial DB -> run twice -> full RPC verification
  const pg = new PGlite({ extensions: { pgcrypto } });
  t.after(async () => { await pg.close().catch(() => {}); });

  await pg.exec(bootstrapAuthSql);
  await pg.exec(sql); // First run
  await pg.exec(sql); // Second run (100% idempotent)

  // Verify shop_settings columns & single-row deduplication on third run
  await pg.exec(`
    INSERT INTO public.shop_settings (shop_name, updated_at) VALUES ('Old Row', '2026-01-01T00:00:00Z');
    INSERT INTO public.shop_settings (shop_name, payment_statuses, updated_at)
    VALUES ('Latest Shop', '[{"value":"paid","label":"Paid"}]'::jsonb, '2026-11-24T00:00:00Z');
  `);
  await pg.exec(sql);
  const shopRows = (await pg.query(`SELECT shop_name, payment_statuses FROM public.shop_settings`)).rows;
  assert.equal(shopRows.length, 1);
  assert.equal(shopRows[0].shop_name, 'Latest Shop');
  assert.equal(shopRows[0].payment_statuses[0].value, 'paid');

  // Seed Admin & Technician in staff_users + auth.users
  await pg.exec(`
    INSERT INTO auth.users (id, email, encrypted_password) VALUES
      ('${ADMIN_UID}', 'admin@flower2u.com', 'initial'),
      ('${TECH_UID}', 'aom@flower2u.internal', 'initial');

    INSERT INTO public.staff_users (id, auth_user_id, username, full_name, nickname, email, role_id, is_active)
    VALUES
      ('2611001', '${ADMIN_UID}', '1', 'Admin Boss', 'Boss', 'admin@flower2u.com', (SELECT id FROM public.roles WHERE name = 'admin'), true),
      ('2611002', '${TECH_UID}', 'AOM', 'อ้อม ช่างดอกไม้', 'อ้อม', 'aom@flower2u.internal', (SELECT id FROM public.roles WHERE name = 'technician'), true);
  `);

  // Non-admin technician blocked from creating reset token
  await pg.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${TECH_UID}';`);
  await assert.rejects(
    () => pg.query(`SELECT public.create_staff_reset_token('2611001', 15)`),
    /FORBIDDEN/
  );

  // Direct table access to staff_password_resets blocked for authenticated & anon
  await assert.rejects(
    () => pg.query(`SELECT * FROM public.staff_password_resets`),
    /permission denied/i
  );

  // Admin creates reset token for Technician '2611002'
  await pg.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${ADMIN_UID}';`);
  const mintedRes = await pg.query(`SELECT public.create_staff_reset_token('2611002', 15) AS res`);
  const minted = mintedRes.rows[0].res;
  assert.match(minted.token, /^rst_[0-9a-f]{48}$/);
  assert.equal(minted.staff_id, '2611002');

  // Verify database stores SHA-256 hash and NEVER raw token
  await pg.exec(`RESET ROLE;`);
  const storedRes = await pg.query(`SELECT token_hash FROM public.staff_password_resets WHERE staff_id = '2611002'`);
  assert.equal(storedRes.rows.length, 1);
  assert.notEqual(storedRes.rows[0].token_hash, minted.token);
  const expectedHash = crypto.createHash('sha256').update(minted.token).digest('hex');
  assert.equal(storedRes.rows[0].token_hash, expectedHash);

  // Anonymous employee validates & consumes one-time token
  await pg.exec(`SET ROLE anon; SET request.jwt.claim.sub = '';`);
  const validCheck = (await pg.query(`SELECT public.validate_staff_reset_token($1) AS res`, [minted.token])).rows[0].res;
  assert.equal(validCheck.valid, true);
  assert.equal(validCheck.username, 'AOM');
  assert.equal('password' in validCheck, false);

  const weakRes = (await pg.query(`SELECT public.consume_staff_reset_token($1, '12345') AS res`, [minted.token])).rows[0].res;
  assert.equal(weakRes.success, false);
  assert.equal(weakRes.reason, 'WEAK_PASSWORD');

  const okRes = (await pg.query(`SELECT public.consume_staff_reset_token($1, 'NewSecret#2026') AS res`, [minted.token])).rows[0].res;
  assert.equal(okRes.success, true);
  assert.equal(okRes.staff_id, '2611002');

  // Reusing same token fails with USED
  const reuseRes = (await pg.query(`SELECT public.consume_staff_reset_token($1, 'AnotherSecret#2026') AS res`, [minted.token])).rows[0].res;
  assert.equal(reuseRes.success, false);
  assert.equal(reuseRes.reason, 'USED');

  // Verify login works with new password & auth.users bcrypt password matches
  const loginOk = (await pg.query(`SELECT public.verify_staff_login('AOM', 'NewSecret#2026') AS res`)).rows[0].res;
  assert.equal(loginOk.success, true);
  assert.equal('password' in loginOk.user, false);

  await pg.exec(`RESET ROLE;`);
  const bcryptMatch = (await pg.query(
    `SELECT (encrypted_password = extensions.crypt('NewSecret#2026', encrypted_password)) AS matched FROM auth.users WHERE id = $1`,
    [TECH_UID]
  )).rows[0].matched;
  assert.equal(bcryptMatch, true);

  // Suspension blocks anon (ACL permission denied) and non-admin callers (FORBIDDEN), and allows Admin
  await pg.exec(`SET ROLE anon; SET request.jwt.claim.sub = '';`);
  await assert.rejects(
    () => pg.query(`SELECT public.suspend_staff_user('2611001', NULL, true, 'hack') AS res`),
    /permission denied/i
  );

  await pg.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${TECH_UID}';`);
  const techSuspend = (await pg.query(`SELECT public.suspend_staff_user('2611001', NULL, true, 'hack') AS res`)).rows[0].res;
  assert.equal(techSuspend.success, false);
  assert.equal(techSuspend.error, 'FORBIDDEN');

  await pg.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${ADMIN_UID}';`);
  const adminSuspend = (await pg.query(`SELECT public.suspend_staff_user('2611002', NULL, true, 'พักงาน') AS res`)).rows[0].res;
  assert.equal(adminSuspend.success, true);

  const mintedBanned = (await pg.query(`SELECT public.create_staff_reset_token('2611002', 15) AS res`)).rows[0].res;
  await pg.exec(`SET ROLE anon; SET request.jwt.claim.sub = '';`);
  const bannedValidate = (await pg.query(`SELECT public.validate_staff_reset_token($1) AS res`, [mintedBanned.token])).rows[0].res;
  assert.equal(bannedValidate.valid, false);
  assert.equal(bannedValidate.reason, 'SUSPENDED');

  // Verify Server-Side Analytics RPC (public.get_complete_analytics) ACL + single-pass aggregation
  await assert.rejects(
    () => pg.query(`SELECT public.get_complete_analytics() AS res`),
    /permission denied/i
  );

  await pg.exec(`RESET ROLE;`);
  await pg.exec(`
    INSERT INTO public.projects (
      id, name, category, raw_delivery_start, artist_name, customer_name, location_name,
      deal_status, transport_status, wage, total_expenses, customer_support_total
    ) VALUES
      ('P-0101', 'ซุ้มคอนเสิร์ตใหญ่', 'ซุ้มงานอีเวนต์', '2026-11-15T10:00:00', 'BUS', 'คุณพลอย', 'Impact Arena', 'confirmed', 'delivered', 20000, 15000, 5000),
      ('P-0102', 'ช่อดอกไม้รับปริญญา', 'ช่อดอกไม้', '2026-11-20T14:00:00', '4EVE', 'คุณพลอย', 'Siam Paragon', 'confirmed', 'preparing', 10000, 3000, 2000),
      ('P-0103', 'งานยกเลิกทดสอบ', 'ช่อดอกไม้', '2026-11-22T09:00:00', '-', 'คุณเมย์', 'Impact Arena', 'cancelled', 'cancelled', 5000, 0, 0);

    INSERT INTO public.project_quotation_items (project_id, category, quantity, unit_price, price)
    VALUES ('P-0101', 'ซุ้มหลัก', 1, 22000, 22000);

    INSERT INTO public.project_customer_support (project_id, denomination, quantity, price)
    VALUES ('P-0101', 1000, 5, 5000), ('P-0102', 500, 4, 2000);

    INSERT INTO public.project_expenses (project_id, category, quantity, unit_price, price)
    VALUES ('P-0101', 'ค่าดอกไม้สด', 1, 16000, 16000);
  `);

  await pg.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${ADMIN_UID}';`);
  const yearAnalytics = (await pg.query(
    `SELECT public.get_complete_analytics('2026-01-01T00:00:00+07:00'::timestamptz, '2026-12-31T23:59:59+07:00'::timestamptz) AS res`
  )).rows[0].res;

  // P-0101: itemized revenue 22000, itemized cost 16000, support 5000
  // P-0102: fallback revenue 10000, unitemized fallback cost 3000 ('ไม่ระบุหมวดหมู่'), support 2000
  // P-0103: fallback revenue 5000, cost 0, support 0
  assert.equal(yearAnalytics.totals.total_projects, 3);
  assert.equal(yearAnalytics.totals.revenue, 37000);
  assert.equal(yearAnalytics.totals.cost, 19000);
  assert.equal(yearAnalytics.totals.profit, 18000);
  assert.equal(yearAnalytics.totals.support, 7000);
  assert.equal(yearAnalytics.status_counts.total, 3);
  assert.equal(yearAnalytics.status_counts.completed, 1);
  assert.equal(yearAnalytics.status_counts.active, 1);
  assert.equal(yearAnalytics.status_counts.cancelled, 1);
  assert.equal(yearAnalytics.banknotes['1000'].count, 5);
  assert.equal(yearAnalytics.banknotes['500'].amount, 2000);
  assert.equal(yearAnalytics.expenses.some(e => e.category === 'ไม่ระบุหมวดหมู่' && e.amount === 3000), true);
  assert.equal(yearAnalytics.top_artists[0].name, 'BUS');
  assert.equal(yearAnalytics.top_customers_by_projects[0].name, 'คุณพลอย');
  assert.equal(yearAnalytics.top_customers_by_projects[0].count, 2);
  assert.equal(yearAnalytics.top_venues[0].name, 'Impact Arena');
  assert.equal(yearAnalytics.low_margin.length, 1);
  assert.equal(yearAnalytics.low_margin[0].id, 'P-0101');

  // Clicking a KPI status filter keeps status_counts across the full date/category/search scope while filtering totals
  const completedOnly = (await pg.query(
    `SELECT public.get_complete_analytics('2026-01-01T00:00:00+07:00'::timestamptz, '2026-12-31T23:59:59+07:00'::timestamptz, NULL, '__kpi_completed__', NULL, NULL) AS res`
  )).rows[0].res;
  assert.equal(completedOnly.totals.total_projects, 1);
  assert.equal(completedOnly.totals.revenue, 22000);
  assert.equal(completedOnly.status_counts.total, 3);
  assert.equal(completedOnly.status_counts.active, 1);

  // Verify REPLICA IDENTITY DEFAULT on projects & supabase_realtime publication membership
  await pg.exec(`RESET ROLE;`);
  const replIdent = (await pg.query(
    `SELECT relreplident FROM pg_class WHERE oid = 'public.projects'::regclass`
  )).rows[0].relreplident;
  assert.equal(replIdent, 'd');

  const pubTables = (await pg.query(
    `SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public'`
  )).rows.map((r) => r.tablename);
  for (const expectedTbl of [
    'projects',
    'deleted_records',
    'quotations',
    'material_rates',
    'delivery_locations',
    'staff_users',
    'shop_settings',
    'roles'
  ]) {
    assert.equal(pubTables.includes(expectedTbl), true, `Expected ${expectedTbl} in supabase_realtime`);
  }

  // Verify RLS & ACL lockdown on deleted_records, quotations, material_rates, delivery_locations, and new RPCs
  await pg.exec(`SET ROLE anon; SET request.jwt.claim.sub = '';`);
  for (const lockedTbl of ['deleted_records', 'quotations', 'material_rates', 'delivery_locations']) {
    await assert.rejects(
      () => pg.query(`SELECT * FROM public.${lockedTbl}`),
      /permission denied/i
    );
  }
  await assert.rejects(
    () => pg.query(`SELECT public.allocate_next_project_code()`),
    /permission denied/i
  );
  await assert.rejects(
    () => pg.query(`SELECT public.save_project_with_items('{"id":"P-9999","name":"Hack"}'::jsonb)`),
    /permission denied/i
  );

  // Verify save_project_with_items preserves valid child UUIDs, persists is_voided, and get_complete_analytics excludes voided items
  await pg.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${ADMIN_UID}';`);

  // Before adding P-0104, max project code across P-0101..P-0103 is P-0103 -> next is P-0104
  const nextCode1 = (await pg.query(`SELECT public.allocate_next_project_code() AS code`)).rows[0].code;
  assert.equal(nextCode1, 'P-0104');

  const qActiveId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const qVoidedId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const exActiveId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const exVoidedId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

  await pg.query(
    `SELECT public.save_project_with_items($1::jsonb, $2::jsonb, '[]'::jsonb, $3::jsonb)`,
    [
      JSON.stringify({
        id: nextCode1,
        name: 'โปรเจกต์ทดสอบ Void รายการย่อย',
        category: 'ซุ้มงานอีเวนต์',
        raw_delivery_start: '2026-11-25T10:00:00',
        deal_status: 'confirmed',
        transport_status: 'preparing',
        payment_status: 'unpaid',
        wage: 12000,
        total_revenue: 12000,
        total_expenses: 4000,
        net_profit: 8000
      }),
      JSON.stringify([
        { id: qActiveId, category: 'ป้ายหลักใช้งานจริง', quantity: 1, unit_price: 12000, price: 12000, is_voided: false },
        { id: qVoidedId, category: 'รายการเสนอราคาที่ยกเลิก', quantity: 1, unit_price: 99000, price: 99000, is_voided: true }
      ]),
      JSON.stringify([
        { id: exActiveId, category: 'ค่ารถขนส่ง', quantity: 1, unit_price: 4000, price: 4000, is_voided: false },
        { id: exVoidedId, category: 'ค่าของยกเลิก', quantity: 1, unit_price: 88000, price: 88000, is_voided: true }
      ])
    ]
  );

  // Re-save P-0104 to verify child UUIDs stay 100% stable across updates
  await pg.query(
    `SELECT public.save_project_with_items($1::jsonb, $2::jsonb, '[]'::jsonb, $3::jsonb)`,
    [
      JSON.stringify({
        id: nextCode1,
        name: 'โปรเจกต์ทดสอบ Void รายการย่อย (อัปเดต)',
        category: 'ซุ้มงานอีเวนต์',
        raw_delivery_start: '2026-11-25T10:00:00',
        deal_status: 'confirmed',
        transport_status: 'preparing',
        payment_status: 'unpaid',
        wage: 12000,
        total_revenue: 12000,
        total_expenses: 4000,
        net_profit: 8000
      }),
      JSON.stringify([
        { id: qActiveId, category: 'ป้ายหลักใช้งานจริง', quantity: 1, unit_price: 12000, price: 12000, is_voided: false },
        { id: qVoidedId, category: 'รายการเสนอราคาที่ยกเลิก', quantity: 1, unit_price: 99000, price: 99000, is_voided: true }
      ]),
      JSON.stringify([
        { id: exActiveId, category: 'ค่ารถขนส่ง', quantity: 1, unit_price: 4000, price: 4000, is_voided: false },
        { id: exVoidedId, category: 'ค่าของยกเลิก', quantity: 1, unit_price: 88000, price: 88000, is_voided: true }
      ])
    ]
  );

  const savedQItems = (await pg.query(
    `SELECT id::text AS id, price::numeric AS price, is_voided FROM public.project_quotation_items WHERE project_id = $1 ORDER BY sort_order ASC`,
    [nextCode1]
  )).rows;
  assert.deepEqual(savedQItems.map((r) => ({ id: r.id, is_voided: r.is_voided })), [
    { id: qActiveId, is_voided: false },
    { id: qVoidedId, is_voided: true }
  ]);

  const savedExItems = (await pg.query(
    `SELECT id::text AS id, category, is_voided FROM public.project_expenses WHERE project_id = $1 ORDER BY sort_order ASC`,
    [nextCode1]
  )).rows;
  assert.deepEqual(savedExItems.map((r) => ({ id: r.id, category: r.category, is_voided: r.is_voided })), [
    { id: exActiveId, category: 'ค่ารถขนส่ง', is_voided: false },
    { id: exVoidedId, category: 'ค่าของยกเลิก', is_voided: true }
  ]);

  // Verify get_complete_analytics filters out voided quotation items (99000) & voided expenses (88000)
  const afterVoidAnalytics = (await pg.query(
    `SELECT public.get_complete_analytics('2026-01-01T00:00:00+07:00'::timestamptz, '2026-12-31T23:59:59+07:00'::timestamptz) AS res`
  )).rows[0].res;
  assert.equal(afterVoidAnalytics.totals.total_projects, 4);
  assert.equal(afterVoidAnalytics.totals.revenue, 37000 + 12000);
  assert.equal(afterVoidAnalytics.totals.cost, 19000 + 4000);
  assert.equal(afterVoidAnalytics.expenses.some((e) => e.category === 'ค่าของยกเลิก'), false);
  assert.equal(afterVoidAnalytics.expenses.some((e) => e.category === 'ค่ารถขนส่ง' && e.amount === 4000), true);

  // Verify record_generic_deletion trigger (exact single tombstone, no duplicate from legacy trigger) + allocate_next_project_code tombstone awareness
  const quoteId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  await pg.query(
    `INSERT INTO public.quotations (id, quote_no, title) VALUES ($1::uuid, 'QT-2026-001', 'ใบเสนอราคาทดสอบ')`,
    [quoteId]
  );
  await pg.query(
    `INSERT INTO public.projects (id, name, deal_status, transport_status, payment_status) VALUES ('P-0108', 'งานที่จะลบ', 'confirmed', 'preparing', 'unpaid')`
  );
  await pg.query(`DELETE FROM public.projects WHERE id = 'P-0108'`);
  await pg.query(`DELETE FROM public.quotations WHERE id = $1::uuid`, [quoteId]);

  const projectTombstones = (await pg.query(
    `SELECT table_name, record_id FROM public.deleted_records WHERE table_name = 'projects' AND record_id = 'P-0108'`
  )).rows;
  assert.equal(projectTombstones.length, 1);

  const quoteTombstones = (await pg.query(
    `SELECT table_name, record_id FROM public.deleted_records WHERE table_name = 'quotations' AND record_id = $1`,
    [quoteId]
  )).rows;
  assert.equal(quoteTombstones.length, 1);

  // allocate_next_project_code inspects deleted_records ('P-0108') so it returns 'P-0109' and never reuses deleted codes
  const nextCodeAfterDelete = (await pg.query(`SELECT public.allocate_next_project_code() AS code`)).rows[0].code;
  assert.equal(nextCodeAfterDelete, 'P-0109');

  // Scenario B: Legacy DB with UUID staff_users.id + inventory_compact anti-escalation trigger -> run twice cleanly
  const pgLegacy = new PGlite({ extensions: { pgcrypto } });
  t.after(async () => { await pgLegacy.close().catch(() => {}); });

  await pgLegacy.exec(bootstrapAuthSql);
  await pgLegacy.exec(`
    CREATE TABLE public.roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL
    );
    CREATE TABLE public.staff_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      auth_user_id UUID UNIQUE,
      username TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      role_id UUID NOT NULL REFERENCES public.roles(id),
      is_active BOOLEAN DEFAULT true
    );
    CREATE OR REPLACE FUNCTION public.fn_is_admin(p_uid UUID) RETURNS BOOLEAN AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.staff_users s JOIN public.roles r ON s.role_id = r.id
        WHERE s.auth_user_id = p_uid AND r.name = 'admin' AND s.is_active = true
      );
    $$ LANGUAGE sql STABLE SECURITY DEFINER;
    CREATE OR REPLACE FUNCTION public.trg_guard_staff_users_escalation() RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'legacy stub to be upgraded';
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER trg_guard_staff_users_escalation
      BEFORE UPDATE ON public.staff_users
      FOR EACH ROW EXECUTE FUNCTION public.trg_guard_staff_users_escalation();
  `);

  await pgLegacy.exec(sql);
  await pgLegacy.exec(sql);

  const legacyIds = (await pgLegacy.query(`
    INSERT INTO public.staff_users (auth_user_id, username, full_name, role_id)
    VALUES
      ('${ADMIN_UID}', 'legacy_admin', 'Legacy Admin', (SELECT id FROM public.roles WHERE name = 'admin')),
      ('${TECH_UID}', 'legacy_tech', 'Legacy Tech', (SELECT id FROM public.roles WHERE name = 'technician'))
    RETURNING id::text AS id, username
  `)).rows;
  const legacyTechId = legacyIds.find((r) => r.username === 'legacy_tech').id;

  await pgLegacy.exec(`GRANT SELECT, UPDATE ON public.staff_users TO authenticated;`);
  await pgLegacy.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${ADMIN_UID}';`);
  const legacyToken = (await pgLegacy.query(`SELECT public.create_staff_reset_token($1, 15) AS res`, [legacyTechId])).rows[0].res.token;

  // Anonymous reset consumption succeeds even with UUID staff_users.id + trg_guard_staff_users_escalation active
  await pgLegacy.exec(`SET ROLE anon; SET request.jwt.claim.sub = '';`);
  const legacyConsumed = (await pgLegacy.query(`SELECT public.consume_staff_reset_token($1, 'LegacyUuid#2026') AS res`, [legacyToken])).rows[0].res;
  assert.equal(legacyConsumed.success, true);

  // Meanwhile direct role escalation by Technician is still blocked by trg_guard_staff_users_escalation
  await pgLegacy.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${TECH_UID}';`);
  await assert.rejects(
    () => pgLegacy.query(`UPDATE public.staff_users SET role_id = (SELECT id FROM public.roles WHERE name = 'admin') WHERE auth_user_id = '${TECH_UID}'`),
    /Unauthorized/
  );
});
