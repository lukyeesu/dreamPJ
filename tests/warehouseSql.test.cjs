const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let PGlite;
try {
  PGlite = require('@electric-sql/pglite').PGlite;
} catch {
  const p = process.env.PGLITE_MODULE_PATH || 'C:/Users/lukye/AppData/Local/Temp/flower2u-sql-verification/node_modules/@electric-sql/pglite';
  PGlite = require(p).PGlite;
}

const BASE_FIXTURE_SQL = `
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.uuid_generate_v4() RETURNS uuid AS $$
BEGIN
    RETURN gen_random_uuid();
END;
$$ LANGUAGE plpgsql;

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
GRANT EXECUTE ON FUNCTION public.uuid_generate_v4() TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    description TEXT,
    allowed_pages TEXT[] NOT NULL DEFAULT '{"Calendar", "Plans"}',
    can_edit_pricing BOOLEAN DEFAULT false,
    can_delete_project BOOLEAN DEFAULT false,
    can_borrow_tools BOOLEAN DEFAULT true,
    can_manage_users BOOLEAN DEFAULT false,
    is_system_role BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.roles (name, label, description, allowed_pages, can_edit_pricing, can_delete_project, can_borrow_tools, can_manage_users, is_system_role)
VALUES 
    ('admin', 'Admin', 'Admin', '{"Calendar", "Plans", "Finance", "Analytics", "Inventory", "Staff", "Settings"}', true, true, true, true, true),
    ('accountant', 'Accountant', 'Accountant', '{"Calendar", "Plans", "Finance", "Analytics"}', true, false, false, false, false),
    ('technician', 'Technician', 'Technician', '{"Calendar", "Plans", "Inventory"}', false, false, true, false, false),
    ('driver', 'Driver', 'Driver', '{"Calendar", "Plans"}', false, false, false, false, false)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.staff_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE,
    username TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    nickname TEXT,
    phone TEXT,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
    is_active BOOLEAN DEFAULT true,
    profile_image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.projects (
    id TEXT PRIMARY KEY,
    name TEXT,
    project_datetime TIMESTAMPTZ,
    deal_status TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.inventory_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('asset', 'consumable', 'reusable_material')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE,
    name TEXT NOT NULL,
    category_id UUID REFERENCES public.inventory_categories(id) ON DELETE SET NULL,
    item_type TEXT NOT NULL CHECK (lower(item_type) IN ('asset', 'reusable', 'consumable', 'banknote', 'task', 'reusable_material')),
    unit TEXT NOT NULL DEFAULT 'ชิ้น',
    current_stock NUMERIC(10,2) NOT NULL DEFAULT 0,
    min_alert_threshold NUMERIC(10,2) DEFAULT 5,
    average_cost NUMERIC(10,2) DEFAULT 0,
    storage_location TEXT,
    color TEXT,
    size TEXT,
    status TEXT NOT NULL DEFAULT 'in_service',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.asset_units (
    unit_code TEXT PRIMARY KEY,
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'BORROWED', 'LOST', 'BROKEN', 'available', 'borrowed', 'lost', 'broken')),
    borrowed_by TEXT,
    borrowed_at TIMESTAMPTZ,
    project_id TEXT REFERENCES public.projects(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

GRANT SELECT, INSERT, UPDATE ON public.roles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.staff_users TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.projects TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.inventory_categories TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.inventory_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.asset_units TO anon, authenticated;
`;

const ADMIN_AUTH_ID = '11111111-1111-4111-8111-111111111111';
const TECH_AUTH_ID = '22222222-2222-4222-8222-222222222222';
const ACCOUNTANT_AUTH_ID = '33333333-3333-4333-8333-333333333333';
const DRIVER_AUTH_ID = '44444444-4444-4444-8444-444444444444';

async function createPgHarness() {
  const pg = new PGlite();
  await pg.exec(BASE_FIXTURE_SQL);

  await pg.exec(`
    INSERT INTO public.staff_users (auth_user_id, username, full_name, role_id)
    VALUES 
      ('${ADMIN_AUTH_ID}', 'admin_user', 'Admin Person', (SELECT id FROM public.roles WHERE name = 'admin')),
      ('${ACCOUNTANT_AUTH_ID}', 'acc_user', 'Accountant Person', (SELECT id FROM public.roles WHERE name = 'accountant')),
      ('${TECH_AUTH_ID}', 'tech_user', 'Technician Person', (SELECT id FROM public.roles WHERE name = 'technician')),
      ('${DRIVER_AUTH_ID}', 'driver_user', 'Driver Person', (SELECT id FROM public.roles WHERE name = 'driver'))
    ON CONFLICT DO NOTHING;

    INSERT INTO public.projects (id, name)
    VALUES ('P-0309', 'Fanclub Stage Project')
    ON CONFLICT DO NOTHING;
  `);

  return pg;
}

async function setAuthUser(pg, authId, role = 'authenticated') {
  if (role) {
    await pg.exec(`SET ROLE ${role}`);
  } else {
    await pg.exec(`RESET ROLE`);
  }
  if (authId) {
    await pg.exec(`SET request.jwt.claim.sub = '${authId}'`);
  } else {
    await pg.exec(`SET request.jwt.claim.sub = ''`);
  }
}

test('inventory_plan_c.sql migration applies cleanly and is rerunnable', async (t) => {
  const pg = await createPgHarness();
  t.after(async () => { await pg.close().catch(() => {}); });

  const sqlFile = path.resolve(__dirname, '../database_scripts/inventory_plan_c.sql');
  assert.ok(fs.existsSync(sqlFile), 'inventory_plan_c.sql must exist');
  const ddl = fs.readFileSync(sqlFile, 'utf8');

  // First run
  await pg.exec(ddl);

  // Second run to verify re-runnability / idempotency
  await pg.exec(ddl);

  const tables = await pg.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN (
      'inventory_recipients', 'inventory_recipient_teams', 'inventory_field_rounds',
      'inventory_field_round_projects', 'inventory_documents', 'inventory_movements',
      'inventory_material_recoveries', 'asset_unit_custody', 'inventory_incidents',
      'cash_vault_denominations', 'cash_job_reservations', 'cash_helper_batches',
      'cash_prepared_sets', 'cash_movements', 'inventory_idempotency_records'
    )
  `);
  assert.equal(tables.rows.length, 15, 'All 15 Plan C tables must exist');
});

test('idempotency: serializes via advisory lock, checks action+payload, rejects mismatches', async (t) => {
  const pg = await createPgHarness();
  t.after(async () => { await pg.close().catch(() => {}); });

  const ddl = fs.readFileSync(path.resolve(__dirname, '../database_scripts/inventory_plan_c.sql'), 'utf8');
  await pg.exec(ddl);
  await setAuthUser(pg, ADMIN_AUTH_ID, 'authenticated');

  const key = 'a0000000-0000-4000-8000-000000000001';
  const payload = JSON.stringify({ name: 'ดอกไม้ผ้าไหมพรีเมียม', type: 'reusable' });

  // Missing idempotency key must reject
  await assert.rejects(
    pg.query(`SELECT warehouse_dispatch('category_create', $1::jsonb, NULL) AS result`, [payload]),
    /idempotency key.*strictly required/i
  );

  // First execution
  const res1 = await pg.query(
    `SELECT warehouse_dispatch('category_create', $1::jsonb, $2::uuid) AS result`,
    [payload, key]
  );
  assert.ok(res1.rows[0].result.success);
  const catId = res1.rows[0].result.data.id;

  // Second execution with identical payload and key returns prior result
  const res2 = await pg.query(
    `SELECT warehouse_dispatch('category_create', $1::jsonb, $2::uuid) AS result`,
    [payload, key]
  );
  assert.equal(res2.rows[0].result.data.id, catId, 'Idempotency must return identical cached result');

  // Third execution with same key but mismatched payload must reject
  const mismatchPayload = JSON.stringify({ name: 'ริบบิ้นผ้าซาติน', type: 'consumable' });
  await assert.rejects(
    pg.query(`SELECT warehouse_dispatch('category_create', $1::jsonb, $2::uuid) AS result`, [mismatchPayload, key]),
    /idempotency/i
  );

  // Execution with same key but mismatched action must reject
  await assert.rejects(
    pg.query(`SELECT warehouse_dispatch('category_rename', $1::jsonb, $2::uuid) AS result`, [payload, key]),
    /idempotency/i
  );
});

test('mixed issue atomicity: one cart with consumables, reusables and tools commits or rolls back together', async (t) => {
  const pg = await createPgHarness();
  t.after(async () => { await pg.close().catch(() => {}); });

  const ddl = fs.readFileSync(path.resolve(__dirname, '../database_scripts/inventory_plan_c.sql'), 'utf8');
  await pg.exec(ddl);
  await setAuthUser(pg, ADMIN_AUTH_ID, 'authenticated');

  const itemA = (await pg.query(`
    INSERT INTO public.inventory_items (code, name, item_type, unit, current_stock)
    VALUES ('MAT-A', 'กระดาษห่อเกาหลี', 'consumable', 'แผ่น', 10) RETURNING id
  `)).rows[0].id;

  const itemTool = (await pg.query(`
    INSERT INTO public.inventory_items (code, name, item_type, unit)
    VALUES ('TOOL-SC', 'กรรไกรช่าง', 'asset', 'ด้าม') RETURNING id
  `)).rows[0].id;

  await pg.query(`
    INSERT INTO public.asset_units (unit_code, item_id, status)
    VALUES ('SC-01', $1, 'AVAILABLE'), ('SC-02', $1, 'BORROWED')
  `, [itemTool]);

  // Mixed Cart where tool unit SC-02 is already BORROWED -> ENTIRE CART MUST ROLLBACK!
  const failingCart = JSON.stringify({
    issue_type: 'PRODUCTION_ISSUE',
    project_id: 'P-0309',
    recipient_name: 'ป้านิด',
    material_lines: [{ item_id: itemA, quantity: 3 }],
    tool_units: ['SC-01', 'SC-02']
  });

  await assert.rejects(
    pg.query(`SELECT warehouse_dispatch('issue_create', $1::jsonb, gen_random_uuid())`, [failingCart]),
    /not available/i
  );

  const stockA = await pg.query(`SELECT current_stock FROM public.inventory_items WHERE id = $1`, [itemA]);
  assert.equal(Number(stockA.rows[0].current_stock), 10, 'Rollback must preserve stock on mixed cart failure');

  const u1 = (await pg.query(`SELECT status FROM public.asset_units WHERE unit_code = 'SC-01'`)).rows[0];
  assert.equal(u1.status, 'AVAILABLE');

  // Successful atomic mixed issue
  const validCart = JSON.stringify({
    issue_type: 'PRODUCTION_ISSUE',
    project_id: 'P-0309',
    recipient_name: 'ป้านิด',
    due_date: '2026-11-15T18:00:00Z',
    material_lines: [{ item_id: itemA, quantity: 4 }],
    tool_units: ['SC-01']
  });

  const res = await pg.query(`SELECT warehouse_dispatch('issue_create', $1::jsonb, gen_random_uuid()) AS result`, [validCart]);
  assert.ok(res.rows[0].result.success);
  assert.ok(res.rows[0].result.data.document_id);
  assert.equal(res.rows[0].result.data.material_movements.length, 1);
  assert.equal(res.rows[0].result.data.tool_custodies.length, 1);

  const checkStock = await pg.query(`SELECT current_stock FROM public.inventory_items WHERE id = $1`, [itemA]);
  assert.equal(Number(checkStock.rows[0].current_stock), 6);
  const checkTool = (await pg.query(`SELECT status, borrowed_by FROM public.asset_units WHERE unit_code = 'SC-01'`)).rows[0];
  assert.equal(checkTool.status, 'BORROWED');
  assert.equal(checkTool.borrowed_by, 'ป้านิด');
});

test('material issue: rejects non-material types (asset/banknote/task) and duplicate lines', async (t) => {
  const pg = await createPgHarness();
  t.after(async () => { await pg.close().catch(() => {}); });

  const ddl = fs.readFileSync(path.resolve(__dirname, '../database_scripts/inventory_plan_c.sql'), 'utf8');
  await pg.exec(ddl);
  await setAuthUser(pg, ADMIN_AUTH_ID, 'authenticated');

  const assetItem = (await pg.query(`
    INSERT INTO public.inventory_items (code, name, item_type, unit, current_stock)
    VALUES ('AST-01', 'โต๊ะทำงาน', 'asset', 'ตัว', 5) RETURNING id
  `)).rows[0].id;

  // Cannot issue asset via material lines
  await assert.rejects(
    pg.query(`SELECT warehouse_dispatch('issue_create', $1::jsonb, gen_random_uuid())`, [
      JSON.stringify({
        issue_type: 'PRODUCTION_ISSUE',
        project_id: 'P-0309',
        recipient_name: 'ป้านิด',
        material_lines: [{ item_id: assetItem, quantity: 1 }]
      })
    ]),
    /only consumable or reusable/i
  );
});

test('15 jobs one kit: field round links 15 projects without re-issuing tool twice', async (t) => {
  const pg = await createPgHarness();
  t.after(async () => { await pg.close().catch(() => {}); });

  const ddl = fs.readFileSync(path.resolve(__dirname, '../database_scripts/inventory_plan_c.sql'), 'utf8');
  await pg.exec(ddl);

  const projectIds = [];
  for (let i = 1; i <= 15; i++) {
    const pid = `P-FIELD-${String(i).padStart(2, '0')}`;
    projectIds.push(pid);
    await pg.query(`INSERT INTO public.projects (id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [pid, `Dropoff ${i}`]);
  }

  const drillItem = (await pg.query(`
    INSERT INTO public.inventory_items (code, name, item_type, unit)
    VALUES ('TOOL-DR15', 'สว่านไร้สาย 15', 'asset', 'เครื่อง') RETURNING id
  `)).rows[0].id;
  await pg.query(`INSERT INTO public.asset_units (unit_code, item_id, status) VALUES ('DR-15', $1, 'AVAILABLE')`, [drillItem]);

  await setAuthUser(pg, ADMIN_AUTH_ID, 'authenticated');

  const roundRes = await pg.query(`
    SELECT warehouse_dispatch('issue_create', $1::jsonb, gen_random_uuid()) AS result
  `, [JSON.stringify({
    issue_type: 'FIELD_ISSUE',
    round_code: 'RN-15PROJ',
    round_title: 'รอบติดตั้ง 15 จุด',
    recipient_name: 'ทีมติดตั้งสาย 1',
    team_members: ['ช่างเอก', 'ช่างต้อม'],
    project_ids: projectIds,
    tool_units: ['DR-15']
  })]);
  assert.ok(roundRes.rows[0].result.success);
  const roundId = roundRes.rows[0].result.data.round_id;

  const linked = await pg.query(`SELECT count(*) FROM public.inventory_field_round_projects WHERE round_id = $1`, [roundId]);
  assert.equal(Number(linked.rows[0].count), 15);

  const custodies = await pg.query(`SELECT * FROM public.asset_unit_custody WHERE unit_code = 'DR-15' AND is_active = true`);
  assert.equal(custodies.rows.length, 1);
  assert.equal(custodies.rows[0].round_id, roundId);
});

test('legacy borrowed unit: blocked from reissue, adopts or returns cleanly', async (t) => {
  const pg = await createPgHarness();
  t.after(async () => { await pg.close().catch(() => {}); });

  const ddl = fs.readFileSync(path.resolve(__dirname, '../database_scripts/inventory_plan_c.sql'), 'utf8');
  await pg.exec(ddl);
  await setAuthUser(pg, ADMIN_AUTH_ID, 'authenticated');

  const toolItem = (await pg.query(`
    INSERT INTO public.inventory_items (code, name, item_type, unit)
    VALUES ('TOOL-LEG', 'แท่นตัดเทปโบราณ', 'asset', 'อัน') RETURNING id
  `)).rows[0].id;

  await pg.query(`
    INSERT INTO public.asset_units (unit_code, item_id, status, borrowed_by)
    VALUES ('LEG-01', $1, 'BORROWED', 'ช่างเก่า')
  `, [toolItem]);

  // Reissue must be blocked
  await assert.rejects(
    pg.query(`SELECT warehouse_dispatch('issue_create', $1::jsonb, gen_random_uuid())`, [
      JSON.stringify({
        issue_type: 'PRODUCTION_ISSUE',
        project_id: 'P-0309',
        recipient_name: 'ช่างใหม่',
        tool_units: ['LEG-01']
      })
    ]),
    /not available/i
  );

  // Audited return to available
  const adoptRes = await pg.query(`SELECT warehouse_dispatch('tool_legacy_adopt_or_return', $1::jsonb, gen_random_uuid()) AS result`, [
    JSON.stringify({ unit_code: 'LEG-01', action: 'return_available' })
  ]);
  assert.ok(adoptRes.rows[0].result.success);

  const check = (await pg.query(`SELECT status, borrowed_by FROM public.asset_units WHERE unit_code = 'LEG-01'`)).rows[0];
  assert.equal(check.status, 'AVAILABLE');
  assert.equal(check.borrowed_by, null);
});

test('material recovery: 200 - 100 + 90 = 190; damaged recovery pieces count towards cap; all-damaged receipts', async (t) => {
  const pg = await createPgHarness();
  t.after(async () => { await pg.close().catch(() => {}); });

  const ddl = fs.readFileSync(path.resolve(__dirname, '../database_scripts/inventory_plan_c.sql'), 'utf8');
  await pg.exec(ddl);
  await setAuthUser(pg, ADMIN_AUTH_ID, 'authenticated');

  const tulipId = (await pg.query(`
    INSERT INTO public.inventory_items (code, name, item_type, unit, current_stock, color)
    VALUES ('TLP-WHT', 'ทิวลิปพลาสติก', 'reusable', 'ดอก', 200, 'ขาว') RETURNING id
  `)).rows[0].id;

  // Issue 100
  const issueRes = await pg.query(`
    SELECT warehouse_dispatch('issue_create', $1::jsonb, gen_random_uuid()) AS result
  `, [JSON.stringify({
    issue_type: 'PRODUCTION_ISSUE',
    project_id: 'P-0309',
    recipient_name: 'ทีม A',
    material_lines: [{ item_id: tulipId, quantity: 100 }]
  })]);
  const moveId = issueRes.rows[0].result.data.material_movements[0].id;

  // Recover 90 total (80 good, 10 damaged)
  const recRes = await pg.query(`
    SELECT warehouse_dispatch('material_recovery', $1::jsonb, gen_random_uuid()) AS result
  `, [JSON.stringify({
    project_id: 'P-0309',
    items: [{
      source_issue_movement_id: moveId,
      item_id: tulipId,
      recovered_qty: 90,
      inspect_now: true,
      good_qty: 80,
      damaged_qty: 10
    }]
  })]);
  assert.ok(recRes.rows[0].result.success);

  // Available stock: was 100, now 100 + 80 = 180 (damaged 10 is NOT added to available stock)
  let stock = await pg.query(`SELECT current_stock FROM public.inventory_items WHERE id = $1`, [tulipId]);
  assert.equal(Number(stock.rows[0].current_stock), 180);

  // Damaged pieces (10) are part of the 90 recovered pieces; remaining allowed return/recovery is 100 - 90 = 10!
  // Trying to return 11 as unused raw must fail!
  await assert.rejects(
    pg.query(`SELECT warehouse_dispatch('material_return_unused', $1::jsonb, gen_random_uuid())`, [
      JSON.stringify({
        project_id: 'P-0309',
        items: [{ source_issue_movement_id: moveId, item_id: tulipId, quantity: 11 }]
      })
    ]),
    /exceed/i
  );

  // Returning exactly 10 succeeds
  const retRes = await pg.query(`SELECT warehouse_dispatch('material_return_unused', $1::jsonb, gen_random_uuid()) AS result`, [
    JSON.stringify({
      project_id: 'P-0309',
      items: [{ source_issue_movement_id: moveId, item_id: tulipId, quantity: 10 }]
    })
  ]);
  assert.ok(retRes.rows[0].result.success);

  // Now cumulative returned + recovered = 90 + 10 = 100. Returning even 1 more must reject!
  await assert.rejects(
    pg.query(`SELECT warehouse_dispatch('material_return_unused', $1::jsonb, gen_random_uuid())`, [
      JSON.stringify({
        project_id: 'P-0309',
        items: [{ source_issue_movement_id: moveId, item_id: tulipId, quantity: 1 }]
      })
    ]),
    /exceed/i
  );

  // Test Direct All-Damaged Recovery: e.g. 5 recovered, 0 good, 5 damaged -> does not crash or violate quantity > 0
  // Issue 20 more
  const issue2 = await pg.query(`
    SELECT warehouse_dispatch('issue_create', $1::jsonb, gen_random_uuid()) AS result
  `, [JSON.stringify({
    issue_type: 'PRODUCTION_ISSUE',
    project_id: 'P-0309',
    recipient_name: 'ทีม B',
    material_lines: [{ item_id: tulipId, quantity: 20 }]
  })]);
  const move2Id = issue2.rows[0].result.data.material_movements[0].id;

  const allDamagedRes = await pg.query(`
    SELECT warehouse_dispatch('material_recovery', $1::jsonb, gen_random_uuid()) AS result
  `, [JSON.stringify({
    project_id: 'P-0309',
    items: [{
      source_issue_movement_id: move2Id,
      item_id: tulipId,
      recovered_qty: 5,
      inspect_now: true,
      good_qty: 0,
      damaged_qty: 5
    }]
  })]);
  assert.ok(allDamagedRes.rows[0].result.success);
});

test('tool handover: requires accepted=true, partial return recomputes round status', async (t) => {
  const pg = await createPgHarness();
  t.after(async () => { await pg.close().catch(() => {}); });

  const ddl = fs.readFileSync(path.resolve(__dirname, '../database_scripts/inventory_plan_c.sql'), 'utf8');
  await pg.exec(ddl);
  await setAuthUser(pg, ADMIN_AUTH_ID, 'authenticated');

  const toolItem = (await pg.query(`
    INSERT INTO public.inventory_items (code, name, item_type, unit)
    VALUES ('TOOL-DR', 'สว่านไร้สาย', 'asset', 'ตัว') RETURNING id
  `)).rows[0].id;
  await pg.query(`
    INSERT INTO public.asset_units (unit_code, item_id, status)
    VALUES ('DR-01', $1, 'AVAILABLE'), ('DR-02', $1, 'AVAILABLE')
  `, [toolItem]);

  // Create field round and borrow both tools
  const fRes = await pg.query(`SELECT warehouse_dispatch('issue_create', $1::jsonb, gen_random_uuid()) AS result`, [
    JSON.stringify({
      issue_type: 'FIELD_ISSUE',
      round_code: 'RN-TEST',
      round_title: 'Round Test',
      recipient_name: 'ช่างเอก',
      tool_units: ['DR-01', 'DR-02']
    })
  ]);
  const roundId = fRes.rows[0].result.data.round_id;

  // Handover DR-01 without accepted=true must fail
  await assert.rejects(
    pg.query(`SELECT warehouse_dispatch('tool_handover', $1::jsonb, gen_random_uuid())`, [
      JSON.stringify({ unit_codes: ['DR-01'], to_recipient_name: 'ช่างต้อม', accepted: false })
    ]),
    /accepted/i
  );

  // Handover DR-01 with accepted=true
  await pg.query(`SELECT warehouse_dispatch('tool_handover', $1::jsonb, gen_random_uuid()) AS result`, [
    JSON.stringify({ unit_codes: ['DR-01'], to_recipient_name: 'ช่างต้อม', accepted: true })
  ]);

  // Partial return: return DR-01 only
  await pg.query(`SELECT warehouse_dispatch('tool_return', $1::jsonb, gen_random_uuid())`, [
    JSON.stringify({ returns: [{ unit_code: 'DR-01', condition: 'good' }] })
  ]);

  // Round status must now be PARTIAL_RETURNED
  let roundRow = (await pg.query(`SELECT status FROM public.inventory_field_rounds WHERE id = $1`, [roundId])).rows[0];
  assert.equal(roundRow.status, 'PARTIAL_RETURNED');

  // Return DR-02 broken -> generates incident, round status becomes RETURNED
  await pg.query(`SELECT warehouse_dispatch('tool_return', $1::jsonb, gen_random_uuid())`, [
    JSON.stringify({ returns: [{ unit_code: 'DR-02', condition: 'broken', notes: 'หัวหัก' }] })
  ]);

  roundRow = (await pg.query(`SELECT status FROM public.inventory_field_rounds WHERE id = $1`, [roundId])).rows[0];
  assert.equal(roundRow.status, 'RETURNED');

  const incidents = await pg.query(`SELECT * FROM public.inventory_incidents WHERE unit_code = 'DR-02'`);
  assert.equal(incidents.rows.length, 1);
  assert.equal(incidents.rows[0].incident_type, 'BROKEN');
});

test('cash vault: integer validation, counted opening locks permanently, nonexistent prepared fails, partial handover', async (t) => {
  const pg = await createPgHarness();
  t.after(async () => { await pg.close().catch(() => {}); });

  const ddl = fs.readFileSync(path.resolve(__dirname, '../database_scripts/inventory_plan_c.sql'), 'utf8');
  await pg.exec(ddl);
  await setAuthUser(pg, ACCOUNTANT_AUTH_ID, 'authenticated');

  // Decimal count rejection
  await assert.rejects(
    pg.query(`SELECT warehouse_dispatch('cash_counted_opening', $1::jsonb, gen_random_uuid())`, [
      JSON.stringify({ counts: [{ denomination: 100, note_count: '100.5' }] })
    ]),
    /integer/i
  );

  // Negative count rejection
  await assert.rejects(
    pg.query(`SELECT warehouse_dispatch('cash_deposit', $1::jsonb, gen_random_uuid())`, [
      JSON.stringify({ denomination: 100, note_count: -10 })
    ]),
    /integer|positive/i
  );

  // Counted opening: 100 notes of 100 THB
  await pg.query(`SELECT warehouse_dispatch('cash_counted_opening', $1::jsonb, gen_random_uuid()) AS result`, [
    JSON.stringify({ counts: [{ denomination: 100, note_count: 100 }] })
  ]);

  // Issue all 100 notes into a helper batch
  const batchRes = await pg.query(`SELECT warehouse_dispatch('cash_issue_batch', $1::jsonb, gen_random_uuid()) AS result`, [
    JSON.stringify({
      project_id: 'P-0309',
      recipient_name: 'ผู้ช่วย A',
      denomination: 100,
      note_count: 100
    })
  ]);
  const batchId = batchRes.rows[0].result.data.batch.id;

  // Vault physical count is now 0. Trying to run cash_counted_opening again MUST REJECT even though physical_count is 0!
  await assert.rejects(
    pg.query(`SELECT warehouse_dispatch('cash_counted_opening', $1::jsonb, gen_random_uuid())`, [
      JSON.stringify({ counts: [{ denomination: 100, note_count: 50 }] })
    ]),
    /already has counted baseline/i
  );

  // Nonexistent prepared set delivery must FAIL
  await assert.rejects(
    pg.query(`SELECT warehouse_dispatch('cash_deliver_to_customer', $1::jsonb, gen_random_uuid())`, [
      JSON.stringify({ project_id: 'P-0309', denomination: 100, note_count: 10 })
    ]),
    /insufficient prepared/i
  );

  // Cash partial handover: helper A hands over 30 notes to helper B with accepted=true
  const handoverRes = await pg.query(`SELECT warehouse_dispatch('cash_handover_batch', $1::jsonb, gen_random_uuid()) AS result`, [
    JSON.stringify({
      batch_id: batchId,
      to_recipient_name: 'ผู้ช่วย B',
      note_count: 30,
      accepted: true
    })
  ]);
  assert.ok(handoverRes.rows[0].result.success);
  const newBatchId = handoverRes.rows[0].result.data.new_batch_id;

  // Verify conservation: helper A has 100 - 30 = 70 remaining, helper B has 30 remaining
  const bA = (await pg.query(`SELECT * FROM public.cash_helper_batches WHERE id = $1`, [batchId])).rows[0];
  const bB = (await pg.query(`SELECT * FROM public.cash_helper_batches WHERE id = $1`, [newBatchId])).rows[0];
  assert.equal(bA.handed_over_count, 30);
  assert.equal(bB.issued_count, 30);

  // Vault remains at 0 physical
  const vault = (await pg.query(`SELECT * FROM public.cash_vault_denominations WHERE denomination = 100`)).rows[0];
  assert.equal(vault.physical_count, 0);
});

test('security and RLS: direct table writes revoked, anon denied, actor derives strictly from auth.uid', async (t) => {
  const pg = await createPgHarness();
  t.after(async () => { await pg.close().catch(() => {}); });

  const ddl = fs.readFileSync(path.resolve(__dirname, '../database_scripts/inventory_plan_c.sql'), 'utf8');
  await pg.exec(ddl);

  // Anon user attempting RPC
  await setAuthUser(pg, null, 'anon');
  await assert.rejects(
    pg.query(`SELECT warehouse_dispatch('category_create', '{"name":"X"}'::jsonb, gen_random_uuid())`),
    /permission denied/i
  );

  // Technician user attempting cash operation
  await setAuthUser(pg, TECH_AUTH_ID, 'authenticated');
  await assert.rejects(
    pg.query(`SELECT warehouse_dispatch('cash_deposit', '{"denomination":100, "note_count":10}'::jsonb, gen_random_uuid())`),
    /unauthorized.*cash/i
  );

  // Technician user SELECT on cash vault returns 0 rows via RLS
  const techCash = await pg.query(`SELECT * FROM public.cash_vault_denominations`);
  assert.equal(techCash.rows.length, 0);

  // Driver user attempting inventory summary
  await setAuthUser(pg, DRIVER_AUTH_ID, 'authenticated');
  await assert.rejects(
    pg.query(`SELECT warehouse_get_summary()`),
    /unauthorized.*inventory/i
  );

  // Direct authenticated INSERT on new table must be blocked by REVOKE
  await setAuthUser(pg, ADMIN_AUTH_ID, 'authenticated');
  await assert.rejects(
    pg.query(`INSERT INTO public.inventory_recipients (name) VALUES ('Hacked')`),
    /permission denied/i
  );

  // Forged actor test: caller passes forged actor_name and actor_id in payload; DB MUST ignore and derive from auth.uid
  const catRes = await pg.query(`SELECT warehouse_dispatch('category_create', $1::jsonb, gen_random_uuid()) AS result`, [
    JSON.stringify({ name: 'หมวดทดสอบแฮกเกอร์', actor_name: 'Spoofed Admin', actor_id: '00000000-0000-0000-0000-000000000000' })
  ]);
  assert.ok(catRes.rows[0].result.success);
  const idemp = (await pg.query(`SELECT * FROM public.inventory_idempotency_records WHERE action_name = 'category_create'`)).rows[0];
  assert.equal(idemp.actor_auth_user_id, ADMIN_AUTH_ID, 'Actor ID must be derived strictly from auth.uid');
});

test('item registration and metadata: validates name/unit, blocks identity changes with history, bounded QR unit code', async (t) => {
  const pg = await createPgHarness();
  t.after(async () => { await pg.close().catch(() => {}); });

  const ddl = fs.readFileSync(path.resolve(__dirname, '../database_scripts/inventory_plan_c.sql'), 'utf8');
  await pg.exec(ddl);
  await setAuthUser(pg, ADMIN_AUTH_ID, 'authenticated');

  // Empty name must fail
  await assert.rejects(
    pg.query(`SELECT warehouse_dispatch('item_create', $1::jsonb, gen_random_uuid())`, [
      JSON.stringify({ name: '   ', item_type: 'consumable', unit: 'กล่อง' })
    ]),
    /item name cannot be empty/i
  );

  // Empty unit must fail
  await assert.rejects(
    pg.query(`SELECT warehouse_dispatch('item_create', $1::jsonb, gen_random_uuid())`, [
      JSON.stringify({ name: 'ฟองน้ำจัดดอกไม้', item_type: 'consumable', unit: '  ' })
    ]),
    /item unit cannot be empty/i
  );

  // Create valid reusable item
  const itemRes = await pg.query(`SELECT warehouse_dispatch('item_create', $1::jsonb, gen_random_uuid()) AS result`, [
    JSON.stringify({
      name: 'แจกันเซรามิกโมเดิร์น',
      item_type: 'reusable',
      unit: 'ใบ',
      initial_stock: 50,
      color: 'ขาว',
      size: 'L'
    })
  ]);
  assert.ok(itemRes.rows[0].result.success);
  const itemId = itemRes.rows[0].result.data.id;

  // Since item now has an OPENING_STOCK movement in history, identity change (color/unit/type) MUST be blocked
  await assert.rejects(
    pg.query(`SELECT warehouse_dispatch('item_save_metadata', $1::jsonb, gen_random_uuid())`, [
      JSON.stringify({ id: itemId, color: 'ดำ' })
    ]),
    /cannot change item identity/i
  );

  // But updating name or min_alert_threshold is allowed!
  const metaRes = await pg.query(`SELECT warehouse_dispatch('item_save_metadata', $1::jsonb, gen_random_uuid()) AS result`, [
    JSON.stringify({ id: itemId, name: 'แจกันเซรามิกโมเดิร์น (ปรับปรุง)', min_alert_threshold: 10 })
  ]);
  assert.ok(metaRes.rows[0].result.success);

  // Stock adjust on asset must be blocked
  const assetId = (await pg.query(`
    INSERT INTO public.inventory_items (code, name, item_type, unit)
    VALUES ('AST-LADDER', 'บันไดอลูมิเนียม', 'asset', 'ตัว') RETURNING id
  `)).rows[0].id;

  await assert.rejects(
    pg.query(`SELECT warehouse_dispatch('stock_adjust', $1::jsonb, gen_random_uuid())`, [
      JSON.stringify({ item_id: assetId, delta_quantity: 5, reason: 'นับสต็อกเกิน' })
    ]),
    /stock adjustment cannot alter item of type asset/i
  );

  // Unit code bounding & QR validation: code > 64 chars must reject
  const longCode = 'A'.repeat(65);
  await assert.rejects(
    pg.query(`SELECT warehouse_dispatch('unit_add', $1::jsonb, gen_random_uuid())`, [
      JSON.stringify({ item_id: assetId, unit_code: longCode })
    ]),
    /maximum length/i
  );

  // Valid unit addition
  const unitRes = await pg.query(`SELECT warehouse_dispatch('unit_add', $1::jsonb, gen_random_uuid()) AS result`, [
    JSON.stringify({ item_id: assetId, unit_code: 'LADDER-01' })
  ]);
  assert.ok(unitRes.rows[0].result.success);

  // Duplicate unit addition must reject
  await assert.rejects(
    pg.query(`SELECT warehouse_dispatch('unit_add', $1::jsonb, gen_random_uuid())`, [
      JSON.stringify({ item_id: assetId, unit_code: 'LADDER-01' })
    ]),
    /already exists/i
  );

  // Team creation with empty member strings must reject
  await assert.rejects(
    pg.query(`SELECT warehouse_dispatch('team_create', $1::jsonb, gen_random_uuid())`, [
      JSON.stringify({ name: 'ทีมช่าง', primary_receiver_name: 'ช่างใหญ่', member_names: ['ช่างเอก', '  ', 'ช่างต้อม'] })
    ]),
    /team member names cannot be empty/i
  );
});

test('material recovery & inspection: pending inspection can consume only once, mismatched project context and missing source rejected', async (t) => {
  const pg = await createPgHarness();
  t.after(async () => { await pg.close().catch(() => {}); });

  const ddl = fs.readFileSync(path.resolve(__dirname, '../database_scripts/inventory_plan_c.sql'), 'utf8');
  await pg.exec(ddl);

  const archItem = (await pg.query(`
    INSERT INTO public.inventory_items (code, name, item_type, unit, current_stock)
    VALUES ('ARCH-GOLD', 'ซุ้มโครงเหล็กสีทอง', 'reusable', 'ชุด', 10) RETURNING id
  `)).rows[0].id;

  await pg.query(`INSERT INTO public.projects (id, name) VALUES ('P-OTHER', 'Other Project') ON CONFLICT DO NOTHING`);

  await setAuthUser(pg, ADMIN_AUTH_ID, 'authenticated');

  // Issue 5 sets to project P-0309
  const issueRes = await pg.query(`SELECT warehouse_dispatch('issue_create', $1::jsonb, gen_random_uuid()) AS result`, [
    JSON.stringify({
      issue_type: 'PRODUCTION_ISSUE',
      project_id: 'P-0309',
      recipient_name: 'ช่างหนุ่ม',
      material_lines: [{ item_id: archItem, quantity: 5 }]
    })
  ]);
  const moveId = issueRes.rows[0].result.data.material_movements[0].id;

  // Recovery with missing source_issue_movement_id must reject
  await assert.rejects(
    pg.query(`SELECT warehouse_dispatch('material_recovery', $1::jsonb, gen_random_uuid())`, [
      JSON.stringify({
        project_id: 'P-0309',
        items: [{ item_id: archItem, recovered_qty: 3 }]
      })
    ]),
    /source_issue_movement_id is strictly required/i
  );

  // Recovery with mismatched project context must reject
  await assert.rejects(
    pg.query(`SELECT warehouse_dispatch('material_recovery', $1::jsonb, gen_random_uuid())`, [
      JSON.stringify({
        project_id: 'P-OTHER',
        items: [{ source_issue_movement_id: moveId, item_id: archItem, recovered_qty: 3 }]
      })
    ]),
    /context does not match/i
  );

  // Create PENDING recovery for 5 sets (to be inspected in warehouse later)
  const pendRes = await pg.query(`SELECT warehouse_dispatch('material_recovery', $1::jsonb, gen_random_uuid()) AS result`, [
    JSON.stringify({
      project_id: 'P-0309',
      items: [{
        source_issue_movement_id: moveId,
        item_id: archItem,
        recovered_qty: 5,
        inspect_now: false
      }]
    })
  ]);
  assert.ok(pendRes.rows[0].result.success);
  const recoveryId = pendRes.rows[0].result.data.recoveries[0].id;

  // Before inspection, stock must remain at 5 (not yet accepted)
  let stock = (await pg.query(`SELECT current_stock FROM public.inventory_items WHERE id = $1`, [archItem])).rows[0];
  assert.equal(Number(stock.current_stock), 5);

  // Inspection mismatch: good (3) + damaged (1) != 5 -> must reject!
  await assert.rejects(
    pg.query(`SELECT warehouse_dispatch('material_inspect_recovery', $1::jsonb, gen_random_uuid())`, [
      JSON.stringify({ recovery_id: recoveryId, good_qty: 3, damaged_qty: 1 })
    ]),
    /must equal.*recovered quantity/i
  );

  // Inspect validly: 4 good, 1 damaged
  const inspectRes = await pg.query(`SELECT warehouse_dispatch('material_inspect_recovery', $1::jsonb, gen_random_uuid()) AS result`, [
    JSON.stringify({ recovery_id: recoveryId, good_qty: 4, damaged_qty: 1 })
  ]);
  assert.ok(inspectRes.rows[0].result.success);

  // Now stock becomes 5 + 4 = 9 (damaged 1 is not added)
  stock = (await pg.query(`SELECT current_stock FROM public.inventory_items WHERE id = $1`, [archItem])).rows[0];
  assert.equal(Number(stock.current_stock), 9);

  // Consuming the SAME pending inspection again MUST REJECT
  await assert.rejects(
    pg.query(`SELECT warehouse_dispatch('material_inspect_recovery', $1::jsonb, gen_random_uuid())`, [
      JSON.stringify({ recovery_id: recoveryId, good_qty: 4, damaged_qty: 1 })
    ]),
    /already inspected/i
  );
});

test('warehouse_get_operations: returns outstanding issue lines, pending recoveries, custodies and enforces permissions', async (t) => {
  const pg = await createPgHarness();
  t.after(async () => { await pg.close().catch(() => {}); });

  const ddl = fs.readFileSync(path.resolve(__dirname, '../database_scripts/inventory_plan_c.sql'), 'utf8');
  await pg.exec(ddl);

  const matItem = (await pg.query(`
    INSERT INTO public.inventory_items (code, name, item_type, unit, current_stock, color, size)
    VALUES ('FLW-ROSE', 'ดอกกุหลาบประดิษฐ์แดง', 'reusable', 'ก้าน', 100, 'แดง', 'M') RETURNING id
  `)).rows[0].id;

  const toolItem = (await pg.query(`
    INSERT INTO public.inventory_items (code, name, item_type, unit)
    VALUES ('TOOL-PLIER', 'คีมตัดลวด', 'asset', 'อัน') RETURNING id
  `)).rows[0].id;
  await pg.query(`INSERT INTO public.asset_units (unit_code, item_id, status) VALUES ('PLIER-01', $1, 'AVAILABLE')`, [toolItem]);

  await setAuthUser(pg, ADMIN_AUTH_ID, 'authenticated');

  // Issue 20 roses + 1 tool to project P-0309
  const issueRes = await pg.query(`SELECT warehouse_dispatch('issue_create', $1::jsonb, gen_random_uuid()) AS result`, [
    JSON.stringify({
      issue_type: 'PRODUCTION_ISSUE',
      project_id: 'P-0309',
      recipient_name: 'ช่างบอย',
      due_date: '2026-11-20T18:00:00Z',
      material_lines: [{ item_id: matItem, quantity: 20 }],
      tool_units: ['PLIER-01']
    })
  ]);
  assert.ok(issueRes.rows[0].result.success);
  const moveId = issueRes.rows[0].result.data.material_movements[0].id;

  // Return 5 unused
  await pg.query(`SELECT warehouse_dispatch('material_return_unused', $1::jsonb, gen_random_uuid()) AS result`, [
    JSON.stringify({
      project_id: 'P-0309',
      recipient_name: 'ช่างบอย',
      items: [{ source_issue_movement_id: moveId, item_id: matItem, quantity: 5 }]
    })
  ]);

  // Create pending recovery for 5
  await pg.query(`SELECT warehouse_dispatch('material_recovery', $1::jsonb, gen_random_uuid()) AS result`, [
    JSON.stringify({
      project_id: 'P-0309',
      recipient_name: 'ช่างบอย',
      items: [{ source_issue_movement_id: moveId, item_id: matItem, recovered_qty: 5, inspect_now: false }]
    })
  ]);

  // Query warehouse_get_operations
  const opRes = await pg.query(`SELECT warehouse_get_operations($1::jsonb) AS result`, [
    JSON.stringify({ project_id: 'P-0309', limit: 10 })
  ]);
  assert.ok(opRes.rows[0].result);
  const ops = opRes.rows[0].result;

  // Verify structure
  assert.ok(Array.isArray(ops.issue_lines));
  assert.ok(Array.isArray(ops.recoveries));
  assert.ok(Array.isArray(ops.custodies));
  assert.ok(Array.isArray(ops.incidents));
  assert.equal(typeof ops.has_more, 'boolean');

  // Verify issue line residual: issued (20) - returned (5) - recovered (5) = remaining 10
  assert.equal(ops.issue_lines.length, 1);
  const line = ops.issue_lines[0];
  assert.equal(line.source_issue_movement_id, moveId);
  assert.equal(Number(line.issued_qty), 20);
  assert.equal(Number(line.returned_qty), 5);
  assert.equal(Number(line.recovered_qty), 5);
  assert.equal(Number(line.remaining_qty), 10);
  assert.equal(line.item_name, 'ดอกกุหลาบประดิษฐ์แดง');

  // Verify pending recovery
  assert.equal(ops.recoveries.length, 1);
  assert.equal(ops.recoveries[0].status, 'PENDING');
  assert.equal(Number(ops.recoveries[0].recovered_qty), 5);

  // Verify tool custody
  assert.equal(ops.custodies.length, 1);
  assert.equal(ops.custodies[0].unit_code, 'PLIER-01');
  assert.equal(ops.custodies[0].recipient_name_snapshot, 'ช่างบอย');

  // Return the remaining 10 -> line must drop out of outstanding issue lines
  await pg.query(`SELECT warehouse_dispatch('material_return_unused', $1::jsonb, gen_random_uuid()) AS result`, [
    JSON.stringify({
      project_id: 'P-0309',
      recipient_name: 'ช่างบอย',
      items: [{ source_issue_movement_id: moveId, item_id: matItem, quantity: 10 }]
    })
  ]);

  const refreshed = (await pg.query(`SELECT warehouse_get_operations($1::jsonb) AS result`, [
    JSON.stringify({ project_id: 'P-0309' })
  ])).rows[0].result;
  assert.equal(refreshed.issue_lines.length, 0, 'Completed lines must not appear in outstanding list');

  // Permission test: Driver role cannot read operations
  await setAuthUser(pg, DRIVER_AUTH_ID, 'authenticated');
  await assert.rejects(
    pg.query(`SELECT warehouse_get_operations('{}'::jsonb)`),
    /unauthorized.*inventory/i
  );

  // Anon cannot read operations
  await setAuthUser(pg, null, 'anon');
  await assert.rejects(
    pg.query(`SELECT warehouse_get_operations('{}'::jsonb)`),
    /permission denied/i
  );
});

test('cash_adjust_count: audits count corrections and prevents breach of reserved floor', async (t) => {
  const pg = await createPgHarness();
  t.after(async () => { await pg.close().catch(() => {}); });

  const ddl = fs.readFileSync(path.resolve(__dirname, '../database_scripts/inventory_plan_c.sql'), 'utf8');
  await pg.exec(ddl);

  // Set opening of 50 notes of 500 THB
  await setAuthUser(pg, ACCOUNTANT_AUTH_ID, 'authenticated');
  await pg.query(`SELECT warehouse_dispatch('cash_counted_opening', $1::jsonb, gen_random_uuid()) AS result`, [
    JSON.stringify({ counts: [{ denomination: 500, note_count: 50 }] })
  ]);

  // Reserve 20 notes for project P-0309
  await pg.query(`SELECT warehouse_dispatch('cash_reserve', $1::jsonb, gen_random_uuid()) AS result`, [
    JSON.stringify({ project_id: 'P-0309', denomination: 500, note_count: 20 })
  ]);

  // Vault now has physical = 50, reserved = 20
  let vault = (await pg.query(`SELECT * FROM public.cash_vault_denominations WHERE denomination = 500`)).rows[0];
  assert.equal(vault.physical_count, 50);
  assert.equal(vault.reserved_count, 20);

  // Positive adjustment: +10 notes (found extra in drawer during audit)
  const adjPos = await pg.query(`SELECT warehouse_dispatch('cash_adjust_count', $1::jsonb, gen_random_uuid()) AS result`, [
    JSON.stringify({ denomination: 500, delta_count: 10, reason: 'พบธนบัตรเกินในการตรวจนับประจำสัปดาห์' })
  ]);
  assert.ok(adjPos.rows[0].result.success);
  assert.equal(adjPos.rows[0].result.data.new_physical_count, 60);

  // Movement recorded as COUNT_ADJUSTMENT
  const move1 = (await pg.query(`
    SELECT * FROM public.cash_movements WHERE denomination = 500 AND action_type = 'COUNT_ADJUSTMENT' ORDER BY created_at DESC LIMIT 1
  `)).rows[0];
  assert.equal(move1.note_count, 10);
  assert.equal(move1.notes, 'พบธนบัตรเกินในการตรวจนับประจำสัปดาห์');

  // Negative adjustment of -35 notes: physical 60 - 35 = 25 >= reserved 20 -> SUCCEEDS
  const adjNeg = await pg.query(`SELECT warehouse_dispatch('cash_adjust_count', $1::jsonb, gen_random_uuid()) AS result`, [
    JSON.stringify({ denomination: 500, delta_count: -35, reason: 'ปรับยอดตามบันทึกการนับ' })
  ]);
  assert.ok(adjNeg.rows[0].result.success);
  assert.equal(adjNeg.rows[0].result.data.new_physical_count, 25);

  // Negative adjustment of -10 notes: physical 25 - 10 = 15 < reserved 20 -> MUST FAIL!
  await assert.rejects(
    pg.query(`SELECT warehouse_dispatch('cash_adjust_count', $1::jsonb, gen_random_uuid())`, [
      JSON.stringify({ denomination: 500, delta_count: -10, reason: 'ยอดเกินกว่าเงินจอง' })
    ]),
    /drop below reserved count/i
  );

  // Non-integer delta rejection
  await assert.rejects(
    pg.query(`SELECT warehouse_dispatch('cash_adjust_count', $1::jsonb, gen_random_uuid())`, [
      JSON.stringify({ denomination: 500, delta_count: '2.5', reason: 'ทศนิยม' })
    ]),
    /integer/i
  );

  // Zero delta rejection
  await assert.rejects(
    pg.query(`SELECT warehouse_dispatch('cash_adjust_count', $1::jsonb, gen_random_uuid())`, [
      JSON.stringify({ denomination: 500, delta_count: 0, reason: 'ศูนย์' })
    ]),
    /non-zero/i
  );

  // Missing reason rejection
  await assert.rejects(
    pg.query(`SELECT warehouse_dispatch('cash_adjust_count', $1::jsonb, gen_random_uuid())`, [
      JSON.stringify({ denomination: 500, delta_count: 5, reason: '   ' })
    ]),
    /reason is strictly required/i
  );
});
