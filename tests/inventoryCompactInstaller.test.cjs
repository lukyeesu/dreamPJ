const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite, BASE_FIXTURE_SQL, ADMIN_AUTH_ID, setAuthUser, createProductionPgHarness } = require('./helpers/productionFixture.cjs');
const { seedRealisticLegacyData } = require('./helpers/compactMigrationFixture.cjs');
const { compactSql, assembleCompact } = require('./helpers/compactRuntimeHarness.cjs');

test('final installer upgrades actual master schema, supports runtime and reruns without old scripts', async t => {
  const pg = new PGlite(); t.after(() => pg.close());
  await pg.exec(BASE_FIXTURE_SQL.slice(0, BASE_FIXTURE_SQL.indexOf('CREATE TABLE IF NOT EXISTS public.roles')));
  await pg.exec('CREATE PUBLICATION supabase_realtime;');
  // Only the unsupported uuid-ossp extension is replaced by the test UUID shim.
  const master = fs.readFileSync(path.resolve(__dirname, '../database_scripts/supabase_master_schema.sql'), 'utf8');
  await pg.exec(master.replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";', ''));
  await assembleCompact(pg);
  await pg.query("INSERT INTO staff_users(auth_user_id,username,full_name,role_id) VALUES ($1,'compact_admin','Admin',(SELECT id FROM roles WHERE name='admin'))", [ADMIN_AUTH_ID]);
  await setAuthUser(pg, ADMIN_AUTH_ID, 'authenticated');
  const summary = (await pg.query('SELECT warehouse_get_summary() AS result')).rows[0].result;
  assert.equal(summary.schema_version, 2);
  assert.equal(summary.pending_recovery_count, 0);
  const analytics = (await pg.query('SELECT get_inventory_analytics() AS result')).rows[0].result;
  for (const key of ['total_items_count','total_asset_value','low_stock_count','active_loans_count','overdue_loans_count']) assert.ok(key in analytics);
  await setAuthUser(pg, null, null);
  await assembleCompact(pg);
  const tables = (await pg.query("SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND (relname LIKE 'inventory_%' OR relname LIKE 'cash_%' OR relname LIKE 'production_%' OR relname IN ('asset_units','asset_loans','project_checklist_items')) ORDER BY relname")).rows;
  assert.equal(tables.length, 8);
  const policies = (await pg.query("SELECT count(DISTINCT tablename) AS n FROM pg_policies WHERE schemaname='public' AND permissive='RESTRICTIVE' AND roles @> ARRAY['authenticated']::name[]")).rows[0];
  assert.equal(Number(policies.n), 8);
  const destructiveFks = (await pg.query("SELECT conname FROM pg_constraint WHERE contype='f' AND confdeltype IN ('c','n') AND conrelid IN ('inventory_documents'::regclass,'inventory_document_lines'::regclass,'inventory_movements'::regclass,'asset_units'::regclass)")).rows;
  assert.equal(destructiveFks.length, 0, 'audit lineage cannot be deleted by cascading or nulling a foreign key');
});

test('final installer preserves seeded old data and creation key/results across complete reruns', async t => {
  const pg = await createProductionPgHarness(); t.after(() => pg.close());
  await seedRealisticLegacyData(pg);
  const before = (await pg.query('SELECT denomination,physical_count,reserved_count FROM cash_vault_denominations ORDER BY denomination')).rows;
  await assembleCompact(pg);
  const counts = (await pg.query('SELECT (SELECT count(*) FROM inventory_documents) docs,(SELECT count(*) FROM inventory_document_lines) lines,(SELECT count(*) FROM inventory_movements) movements')).rows[0];
  await assembleCompact(pg);
  assert.deepEqual((await pg.query('SELECT denomination,physical_count,reserved_count FROM cash_vault_denominations ORDER BY denomination')).rows, before);
  assert.deepEqual((await pg.query('SELECT (SELECT count(*) FROM inventory_documents) docs,(SELECT count(*) FROM inventory_document_lines) lines,(SELECT count(*) FROM inventory_movements) movements')).rows[0], counts);
  const sql = compactSql();
  assert.ok(sql.includes(fs.readFileSync(path.resolve(__dirname, '../database_scripts/drafts/compact_schema.sql.part'), 'utf8')), 'installer must contain the updated schema migration');
  assert.match(sql, /LOCK TABLE public\.%I IN ACCESS EXCLUSIVE MODE/);
  assert.match(sql, /set_config\('lock_timeout', '5s', true\)/);
  assert.doesNotMatch(sql, /DROP TABLE[^;]+CASCADE/i);
});

test('final installer migrates TEXT checklist IDs, preserving UUID text and legacy identifiers across reruns', async t => {
  const pg = await createProductionPgHarness(); t.after(() => pg.close());
  await seedRealisticLegacyData(pg);
  await pg.exec(`ALTER TABLE project_checklist_items ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE project_checklist_items ALTER COLUMN id TYPE TEXT USING id::text;
    INSERT INTO project_checklist_items(id,project_id,item_name,item_type,required_qty,picked_qty)
    VALUES('chk-legacy-1700000000','P-101','Legacy checklist','consumable',7,3);`);
  await assembleCompact(pg);
  const read = async () => (await pg.query(`SELECT id,metadata->>'legacy_id' AS legacy_id,required_qty,submitted_qty
    FROM inventory_document_lines WHERE line_type='CHECKLIST' ORDER BY id`)).rows;
  const rows = await read();
  assert.equal(rows.length, 3);
  assert.ok(rows.some(row => row.id === 'a0000005-0000-4000-8000-000000000001'));
  const legacy = rows.find(row => row.legacy_id === 'chk-legacy-1700000000');
  assert.ok(legacy, 'original TEXT identifier must remain traceable');
  assert.match(legacy.id,/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i);
  assert.equal(Number(legacy.required_qty),7);
  assert.equal(Number(legacy.submitted_qty),3);
  await assembleCompact(pg);
  assert.deepEqual(await read(),rows);
});

test('ambiguous TEXT checklist UUIDs abort and preserve the original rows', async t => {
  const pg = await createProductionPgHarness(); t.after(() => pg.close());
  await seedRealisticLegacyData(pg);
  await pg.exec(`ALTER TABLE project_checklist_items ALTER COLUMN id DROP DEFAULT;
    ALTER TABLE project_checklist_items ALTER COLUMN id TYPE TEXT USING id::text;
    INSERT INTO project_checklist_items(id,project_id,item_name,item_type)
    VALUES('A0000005-0000-4000-8000-000000000001','P-101','Distinct legacy row','consumable');`);
  await assert.rejects(assembleCompact(pg), /duplicate key.*_legacy_checklist_ids_target_id_key/i);
  assert.equal(Number((await pg.query('SELECT count(*) AS n FROM project_checklist_items')).rows[0].n),3);
  assert.equal((await pg.query("SELECT data_type FROM information_schema.columns WHERE table_name='project_checklist_items' AND column_name='id'")).rows[0].data_type,'text');
});

for (const staffIdType of ['uuid', 'text']) {
  test(`legacy borrower staff IDs resolve to auth UUIDs with ${staffIdType} staff keys`, async t => {
    const pg = await createProductionPgHarness({staffIdType}); t.after(() => pg.close());
    await seedRealisticLegacyData(pg);
    const staffKey = (await pg.query('SELECT id::text AS id FROM staff_users WHERE auth_user_id=$1',[ADMIN_AUTH_ID])).rows[0].id;
    await pg.exec(`ALTER TABLE asset_loans ALTER COLUMN borrower_user_id TYPE TEXT USING borrower_user_id::text;
      ALTER TABLE project_checklist_items ALTER COLUMN id DROP DEFAULT;
      ALTER TABLE project_checklist_items ALTER COLUMN id TYPE TEXT USING id::text;
      ALTER TABLE inventory_disposals ADD COLUMN disposed_by_user_id TEXT;
      ALTER TABLE inventory_disposals ADD COLUMN approved_by_user_id TEXT;`);
    await pg.query('UPDATE asset_loans SET borrower_user_id=$1',[staffKey]);
    await pg.query('UPDATE inventory_disposals SET disposed_by_user_id=$1,approved_by_user_id=$1',[staffKey]);
    await pg.query(`INSERT INTO asset_loans(id,item_id,project_id,borrower_name,borrower_user_id,status)
      SELECT gen_random_uuid(),item_id,project_id,'Missing staff','STAFF-MISSING','borrowed' FROM asset_loans LIMIT 1`);
    await pg.query(`INSERT INTO asset_loans(id,item_id,project_id,borrower_name,borrower_user_id,status)
      SELECT gen_random_uuid(),item_id,project_id,'Direct auth reference',$1,'borrowed' FROM asset_loans LIMIT 1`,[ADMIN_AUTH_ID]);
    await assembleCompact(pg);
    const loans = (await pg.query("SELECT actor_auth_user_id,recipient_name_snapshot,metadata FROM inventory_documents WHERE doc_type='LEGACY_LOAN' ORDER BY recipient_name_snapshot")).rows;
    assert.equal(loans.length,3);
    const original = loans.find(row=>row.metadata.borrower_user_id===staffKey);
    assert.ok(original,'original staff identifier must be retained');
    assert.equal(original.actor_auth_user_id,ADMIN_AUTH_ID,'staff primary key must resolve to its login UUID');
    const missing = loans.find(row=>row.metadata.borrower_user_id==='STAFF-MISSING');
    assert.ok(missing);
    assert.equal(missing.actor_auth_user_id,null,'unknown staff must not become a fabricated auth actor');
    assert.equal(loans.find(row=>row.recipient_name_snapshot==='Direct auth reference').actor_auth_user_id,ADMIN_AUTH_ID);
    const disposal = (await pg.query("SELECT actor_auth_user_id,metadata FROM inventory_documents WHERE doc_type='DISPOSAL'")).rows[0];
    assert.equal(disposal.actor_auth_user_id,ADMIN_AUTH_ID);
    assert.equal(disposal.metadata.disposed_by_user_id,staffKey);
    assert.equal(disposal.metadata.approved_by_user_id,staffKey);
    await assembleCompact(pg);
    assert.deepEqual((await pg.query("SELECT actor_auth_user_id,recipient_name_snapshot,metadata FROM inventory_documents WHERE doc_type='LEGACY_LOAN' ORDER BY recipient_name_snapshot")).rows,loans);
  });
}

for (const convertStaffCodes of [false, true]) {
test(`populated master preserves loan and disposal actors with ${convertStaffCodes ? 'staff codes' : 'UUID staff keys'}`, async t => {
  const pg = new PGlite(); t.after(() => pg.close());
  await pg.exec(BASE_FIXTURE_SQL.slice(0,BASE_FIXTURE_SQL.indexOf('CREATE TABLE IF NOT EXISTS public.roles')));
  await pg.exec('CREATE PUBLICATION supabase_realtime;');
  const master = fs.readFileSync(path.resolve(__dirname,'../database_scripts/supabase_master_schema.sql'),'utf8');
  await pg.exec(master.replace('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',''));
  await pg.query("INSERT INTO staff_users(auth_user_id,username,full_name,role_id) VALUES($1,'legacy_actor','Original staff',(SELECT id FROM roles WHERE name='admin'))",[ADMIN_AUTH_ID]);
  await pg.exec(`INSERT INTO inventory_items(id,code,name,item_type,unit,current_stock)
    VALUES('b9000000-0000-4000-8000-000000000001','MASTER-DRILL','Legacy drill','asset','piece',5);
    INSERT INTO asset_loans(id,item_id,borrower_name,borrower_user_id)
    SELECT 'a9000000-0000-4000-8000-000000000001','b9000000-0000-4000-8000-000000000001','Original staff',id FROM staff_users WHERE username='legacy_actor';
    INSERT INTO inventory_disposals(id,disposal_code,item_id,reason_type,disposed_by_user_id,approved_by_user_id)
    SELECT 'a9000000-0000-4000-8000-000000000002','DSP-MASTER-001','b9000000-0000-4000-8000-000000000001','damaged',id,id FROM staff_users WHERE username='legacy_actor';`);
  if (convertStaffCodes) await pg.exec(fs.readFileSync(path.resolve(__dirname,'../database_scripts/migrate_staff_id_to_staff_code.sql'),'utf8'));
  const staffKey = (await pg.query("SELECT id FROM staff_users WHERE username='legacy_actor'")).rows[0].id;
  if (convertStaffCodes) assert.doesNotMatch(staffKey,/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i);
  await assembleCompact(pg);
  const rows = (await pg.query("SELECT doc_type,actor_auth_user_id,metadata FROM inventory_documents WHERE doc_type IN ('LEGACY_LOAN','DISPOSAL')")).rows;
  assert.equal(rows.length,2);
  for (const row of rows) assert.equal(row.actor_auth_user_id,ADMIN_AUTH_ID);
  assert.equal(rows.find(row=>row.doc_type==='LEGACY_LOAN').metadata.borrower_user_id,staffKey);
  assert.equal(rows.find(row=>row.doc_type==='DISPOSAL').metadata.approved_by_user_id,staffKey);
});
}
