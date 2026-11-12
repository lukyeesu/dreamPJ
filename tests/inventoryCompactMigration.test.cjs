const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createProductionPgHarness, BASE_FIXTURE_SQL, ADMIN_AUTH_ID, setAuthUser } = require('./helpers/productionFixture.cjs');
const { seedRealisticLegacyData, runCompactMigration } = require('./helpers/compactMigrationFixture.cjs');

test('1. Migration from 22 legacy/hub/plan-c tables preserves all data, IDs, and totals into exact 8 tables', async (t) => {
  const pg = await createProductionPgHarness({ staffIdType: 'uuid' });
  t.after(async () => { await pg.close().catch(() => {}); });

  await seedRealisticLegacyData(pg);

  // Pre-migration baseline captures
  const preStock = (await pg.query("SELECT current_stock FROM public.inventory_items WHERE code = 'FLW-ROSE'")).rows[0].current_stock;
  assert.equal(Number(preStock), 500);

  // Run the compact schema migration
  await runCompactMigration(pg);

  // A. Exactly 8 canonical inventory tables must exist in public schema
  const invTablesRes = await pg.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN (
      'inventory_categories',
      'inventory_items',
      'asset_units',
      'inventory_recipients',
      'inventory_documents',
      'inventory_document_lines',
      'inventory_movements',
      'cash_vault_denominations'
    )
    ORDER BY table_name;
  `);
  assert.equal(invTablesRes.rows.length, 8, 'Must have exactly 8 canonical inventory tables');

  // B. None of the 22 retired tables must exist
  const retiredRes = await pg.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN (
      'inventory_recipient_teams',
      'inventory_field_rounds',
      'inventory_field_round_projects',
      'inventory_material_recoveries',
      'asset_unit_custody',
      'inventory_incidents',
      'cash_job_reservations',
      'cash_helper_batches',
      'cash_prepared_sets',
      'cash_movements',
      'inventory_idempotency_records',
      'production_assignments',
      'production_assignment_lines',
      'production_submissions',
      'production_submission_lines',
      'production_inspections',
      'production_inspection_lines',
      'production_assignment_events',
      'asset_loans',
      'inventory_procurements',
      'inventory_disposals',
      'project_checklist_items'
    );
  `);
  assert.equal(retiredRes.rows.length, 0, 'All 22 retired tables must be dropped');

  // C. Lossless ID coverage: Material recoveries preserved in inventory_document_lines
  const recLine = (await pg.query("SELECT * FROM public.inventory_document_lines WHERE id = 'd0000001-0000-4000-8000-000000000020'")).rows[0];
  assert.ok(recLine, 'Material recovery ID must be preserved in document lines');
  assert.equal(recLine.line_type, 'RECOVERY');
  assert.equal(Number(recLine.quantity), 20);
  assert.equal(Number(recLine.accepted_qty), 15);
  assert.equal(Number(recLine.rejected_qty), 5);
  assert.equal(recLine.status, 'INSPECTED');

  // D. Lossless ID coverage: Custody records preserved in inventory_document_lines with recipient_id & due_at
  const custLine = (await pg.query("SELECT * FROM public.inventory_document_lines WHERE id = 'c0000002-0000-4000-8000-000000000001'")).rows[0];
  assert.ok(custLine, 'Tool custody ID must be preserved in document lines');
  assert.equal(custLine.line_type, 'TOOL_CUSTODY');
  assert.equal(custLine.unit_code, 'DRL-01');
  assert.equal(custLine.recipient_id, 'a0000001-0000-4000-8000-000000000001');
  assert.ok(custLine.due_at, 'Custody line due_at must be populated from due_date/expected_return_at');

  // Active custody reflected on asset_units
  const unitDrl = (await pg.query("SELECT * FROM public.asset_units WHERE unit_code = 'DRL-01'")).rows[0];
  assert.equal(unitDrl.status, 'BORROWED');
  assert.equal(unitDrl.active_custody_line_id, 'c0000002-0000-4000-8000-000000000001');
  assert.equal(unitDrl.active_recipient_id, 'a0000001-0000-4000-8000-000000000001');

  // E. FIELD_ISSUE document with non-null round_id preserved & 15 round project links migrated
  const fieldDoc = (await pg.query("SELECT * FROM public.inventory_documents WHERE id = 'd0000001-0000-4000-8000-000000000002'")).rows[0];
  assert.ok(fieldDoc, 'FIELD_ISSUE document must be preserved');
  assert.equal(fieldDoc.doc_type, 'FIELD_ISSUE');
  assert.equal(fieldDoc.round_id, 'f0000001-0000-4000-8000-000000000001');

  const roundProjRes = await pg.query("SELECT * FROM public.inventory_document_lines WHERE line_type = 'ROUND_PROJECT' AND round_id = 'f0000001-0000-4000-8000-000000000001'");
  assert.equal(roundProjRes.rows.length, 15, 'All 15 round project links must be preserved as lines');

  // F. 10 Helper Work assignments with lines, submissions, inspections, events
  for (let i = 1; i <= 10; i++) {
    const pad = String(i).padStart(4, '0');
    const aId = `a0000000-0000-4000-8000-${pad}00000001`;
    const lineId = `b0000000-0000-4000-8000-${pad}00000001`;
    const subId = `c0000000-0000-4000-8000-${pad}00000001`;
    const subLineId = `d0000000-0000-4000-8000-${pad}00000001`;
    const inspId = `e0000000-0000-4000-8000-${pad}00000001`;
    const inspLineId = `f0000000-0000-4000-8000-${pad}00000001`;
    const evtId = `10000000-0000-4000-8000-${pad}00000001`;

    const workDoc = (await pg.query("SELECT * FROM public.inventory_documents WHERE id = $1", [aId])).rows[0];
    assert.ok(workDoc, `Work assignment ${i} must exist in inventory_documents`);
    assert.equal(workDoc.doc_type, 'WORK');

    const workLine = (await pg.query("SELECT * FROM public.inventory_document_lines WHERE id = $1", [lineId])).rows[0];
    assert.ok(workLine, `Work output line ${i} must exist in inventory_document_lines`);
    assert.equal(workLine.line_type, 'WORK_OUTPUT');
    assert.equal(Number(workLine.accepted_qty), 4);
    assert.equal(Number(workLine.rejected_qty), 1);

    const subDoc = (await pg.query("SELECT * FROM public.inventory_documents WHERE id = $1", [subId])).rows[0];
    assert.ok(subDoc, `Submission ${i} must exist in inventory_documents`);
    assert.equal(subDoc.doc_type, 'SUBMISSION');
    assert.equal(subDoc.parent_document_id, aId);

    const subLine = (await pg.query("SELECT * FROM public.inventory_document_lines WHERE id = $1", [subLineId])).rows[0];
    assert.ok(subLine, `Submission line ${i} must exist in inventory_document_lines`);
    assert.equal(subLine.line_type, 'SUBMISSION');
    assert.equal(subLine.source_line_id, lineId);

    const inspDoc = (await pg.query("SELECT * FROM public.inventory_documents WHERE id = $1", [inspId])).rows[0];
    assert.ok(inspDoc, `Inspection ${i} must exist in inventory_documents`);
    assert.equal(inspDoc.doc_type, 'INSPECTION');
    assert.equal(inspDoc.parent_document_id, subId);

    const inspLine = (await pg.query("SELECT * FROM public.inventory_document_lines WHERE id = $1", [inspLineId])).rows[0];
    assert.ok(inspLine, `Inspection line ${i} must exist in inventory_document_lines`);
    assert.equal(inspLine.line_type, 'INSPECTION');
    assert.equal(inspLine.source_line_id, subLineId);

    const movEvt = (await pg.query("SELECT * FROM public.inventory_movements WHERE id = $1", [evtId])).rows[0];
    assert.ok(movEvt, `Event ${i} must exist in inventory_movements`);
    assert.equal(movEvt.movement_type, 'status_changed');
  }

  // G. Cash batches, vault, and movements
  const cbDoc = (await pg.query("SELECT * FROM public.inventory_documents WHERE id = 'c0000004-0000-4000-8000-000000000001'")).rows[0];
  assert.ok(cbDoc, 'Cash batch must exist as CASH_BATCH document');
  assert.equal(cbDoc.doc_type, 'CASH_BATCH');
  assert.equal(cbDoc.is_cash, true);

  const cmMov = (await pg.query("SELECT * FROM public.inventory_movements WHERE id = 'c0000006-0000-4000-8000-000000000001'")).rows[0];
  assert.ok(cmMov, 'Cash movement must exist in inventory_movements');
  assert.equal(cmMov.movement_type, 'ISSUE_HELPER_BATCH');
  assert.equal(Number(cmMov.quantity), 50);
  assert.equal(cmMov.denomination, 100);

  // Vault denominations
  const v100 = (await pg.query("SELECT * FROM public.cash_vault_denominations WHERE denomination = 100")).rows[0];
  assert.equal(v100.physical_count, 500);
  assert.equal(v100.reserved_count, 100);

  // H. Material stock intact
  const postStock = (await pg.query("SELECT current_stock FROM public.inventory_items WHERE code = 'FLW-ROSE'")).rows[0].current_stock;
  assert.equal(Number(postStock), 500, 'Material physical stock must be completely unchanged');

  // I. Idempotency merge
  const attachedDoc = (await pg.query("SELECT * FROM public.inventory_documents WHERE idempotency_key = '11111111-2222-4000-8000-000000000001'")).rows[0];
  assert.equal(attachedDoc.action_name, 'warehouse_issue_stock');
  assert.deepEqual(attachedDoc.response_payload, { success: true, doc_id: 'd0000001-0000-4000-8000-000000000001' });

  const cmdDoc = (await pg.query("SELECT * FROM public.inventory_documents WHERE idempotency_key = '11111111-2222-4000-8000-000000000002'")).rows[0];
  assert.ok(cmdDoc, 'Unlinked idempotency record must become COMMAND document');
  assert.equal(cmdDoc.doc_type, 'COMMAND');
  assert.equal(cmdDoc.action_name, 'warehouse_audit_check');

  // J. Legacy tables (loans, procurements, disposals, checklist)
  const loanDoc = (await pg.query("SELECT * FROM public.inventory_documents WHERE id = 'a0000002-0000-4000-8000-000000000001'")).rows[0];
  assert.ok(loanDoc);
  assert.equal(loanDoc.doc_type, 'LEGACY_LOAN');

  const procDoc = (await pg.query("SELECT * FROM public.inventory_documents WHERE id = 'a0000003-0000-4000-8000-000000000001'")).rows[0];
  assert.ok(procDoc);
  assert.equal(procDoc.doc_type, 'PROCUREMENT');

  const dspDoc = (await pg.query("SELECT * FROM public.inventory_documents WHERE id = 'a0000004-0000-4000-8000-000000000001'")).rows[0];
  assert.ok(dspDoc);
  assert.equal(dspDoc.doc_type, 'DISPOSAL');

  const chkLine = (await pg.query("SELECT * FROM public.inventory_document_lines WHERE id = 'a0000005-0000-4000-8000-000000000001'")).rows[0];
  assert.ok(chkLine);
  assert.equal(chkLine.line_type, 'CHECKLIST');

  // K. System migration marker
  const migMarker = (await pg.query("SELECT * FROM public.inventory_documents WHERE doc_type = 'SYSTEM_MIGRATION'")).rows[0];
  assert.ok(migMarker, 'SYSTEM_MIGRATION version marker must exist');
  assert.equal(migMarker.metadata.version, 2);
  assert.equal(migMarker.metadata.table_count, 8);
});

test('2. Rerun idempotency: Running compact schema twice does not duplicate rows or fail', async (t) => {
  const pg = await createProductionPgHarness({ staffIdType: 'uuid' });
  t.after(async () => { await pg.close().catch(() => {}); });

  await seedRealisticLegacyData(pg);

  // First run
  await runCompactMigration(pg);

  const docCount1 = Number((await pg.query("SELECT count(*) FROM public.inventory_documents")).rows[0].count);
  const lineCount1 = Number((await pg.query("SELECT count(*) FROM public.inventory_document_lines")).rows[0].count);
  const movCount1 = Number((await pg.query("SELECT count(*) FROM public.inventory_movements")).rows[0].count);

  // Second run on already migrated schema
  await runCompactMigration(pg);

  const docCount2 = Number((await pg.query("SELECT count(*) FROM public.inventory_documents")).rows[0].count);
  const lineCount2 = Number((await pg.query("SELECT count(*) FROM public.inventory_document_lines")).rows[0].count);
  const movCount2 = Number((await pg.query("SELECT count(*) FROM public.inventory_movements")).rows[0].count);

  assert.equal(docCount2, docCount1, 'Rerun must not create duplicate documents');
  assert.equal(lineCount2, lineCount1, 'Rerun must not create duplicate document lines');
  assert.equal(movCount2, movCount1, 'Rerun must not create duplicate movements');
});

test('3. Schema compatibility: applies cleanly when staff_users.id is TEXT (staff_code migration)', async (t) => {
  const pg = await createProductionPgHarness({ staffIdType: 'text' });
  t.after(async () => { await pg.close().catch(() => {}); });

  await seedRealisticLegacyData(pg);

  // Verify staff_users.id is TEXT
  const staffIdType = (await pg.query(`
    SELECT data_type FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'staff_users' AND column_name = 'id'
  `)).rows[0].data_type;
  assert.equal(staffIdType, 'text');

  // Run migration
  await runCompactMigration(pg);

  // Verify inventory_recipients has staff_user_id column as TEXT
  const colRes = await pg.query(`
    SELECT data_type FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'inventory_recipients' AND column_name = 'staff_user_id'
  `);
  assert.equal(colRes.rows[0].data_type, 'text');
});

test('4. Fail-closed rollback: Unknown external table dependency aborts without CASCADE and rolls back transaction', async (t) => {
  const pg = await createProductionPgHarness({ staffIdType: 'uuid' });
  t.after(async () => { await pg.close().catch(() => {}); });

  await seedRealisticLegacyData(pg);

  // Create an unknown external table referencing inventory_field_rounds
  await pg.exec(`
    CREATE TABLE public.external_audit_tracker (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      field_round_id UUID REFERENCES public.inventory_field_rounds(id) ON DELETE RESTRICT
    );
    INSERT INTO public.external_audit_tracker (field_round_id) 
    VALUES ('f0000001-0000-4000-8000-000000000001');
  `);

  // Attempt migration using runCompactMigration which has explicit BEGIN ... COMMIT
  await assert.rejects(async () => {
    await runCompactMigration(pg);
  }, /depends on|violates|cannot drop table/i);

  // Verify rollback: legacy tables and data remain intact
  const roundRes = await pg.query("SELECT * FROM public.inventory_field_rounds WHERE id = 'f0000001-0000-4000-8000-000000000001'");
  assert.equal(roundRes.rows.length, 1, 'Field round must still exist after abortive rollback');

  const extRes = await pg.query("SELECT * FROM public.external_audit_tracker");
  assert.equal(extRes.rows.length, 1, 'External table must remain completely unharmed');
});

test('5. Fresh master install path: sets up canonical 8 tables directly without running obsolete 22-table scripts', async (t) => {
  const pg = new (require('@electric-sql/pglite').PGlite)();
  t.after(async () => { await pg.close().catch(() => {}); });

  // Only run BASE_FIXTURE_SQL (shared master schema)
  await pg.exec(BASE_FIXTURE_SQL);

  // Add mock analytics function if baseline lacks it
  await pg.exec(`
    CREATE OR REPLACE FUNCTION public.get_inventory_analytics() RETURNS JSON AS $$
    BEGIN
      RETURN '{}'::json;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Run compact schema via runCompactMigration
  await runCompactMigration(pg);

  // Verify 8 tables
  const invTablesRes = await pg.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN (
      'inventory_categories',
      'inventory_items',
      'asset_units',
      'inventory_recipients',
      'inventory_documents',
      'inventory_document_lines',
      'inventory_movements',
      'cash_vault_denominations'
    )
    ORDER BY table_name;
  `);
  assert.equal(invTablesRes.rows.length, 8, 'Fresh install must produce exactly 8 canonical inventory tables');

  // Verify categories is_active column & functionality
  const catInsert = await pg.query(`
    INSERT INTO public.inventory_categories (name, type, is_active)
    VALUES ('ริบบิ้นและโบว์', 'consumable', true)
    RETURNING id, is_active;
  `);
  const catId = catInsert.rows[0].id;
  assert.equal(catInsert.rows[0].is_active, true);

  // Verify typed stock and inventory_items
  const itemInsert = await pg.query(`
    INSERT INTO public.inventory_items (code, name, category_id, item_type, unit, current_stock, is_active)
    VALUES ('RIB-RED', 'ริบบิ้นผ้าซาติน สีแดง 2 นิ้ว', $1, 'consumable', 'ม้วน', 25, true)
    RETURNING id, current_stock;
  `, [catId]);
  const itemId = itemInsert.rows[0].id;
  assert.equal(Number(itemInsert.rows[0].current_stock), 25);

  // Verify stock quantity alias is not present
  const colCheck = await pg.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'inventory_items' AND column_name = 'stock_quantity'
  `);
  assert.equal(colCheck.rows.length, 0, 'Invented stock_quantity column should not be added');

  // Verify 5 cash vault denominations initialized and typed
  const vaultRows = (await pg.query("SELECT denomination, physical_count, is_initialized FROM public.cash_vault_denominations ORDER BY denomination")).rows;
  assert.deepEqual(vaultRows.map(r => r.denomination), [20, 50, 100, 500, 1000]);
  assert.equal(vaultRows.every(r => r.physical_count === 0 && r.is_initialized === false), true);

  // Typed cash update check
  await pg.exec(`
    UPDATE public.cash_vault_denominations
    SET physical_count = 50, is_initialized = true
    WHERE denomination = 100;
  `);
  const cashCheck = (await pg.query("SELECT physical_count, is_initialized FROM public.cash_vault_denominations WHERE denomination = 100")).rows[0];
  assert.equal(cashCheck.physical_count, 50);
  assert.equal(cashCheck.is_initialized, true);

  // Verify SYSTEM_MIGRATION marker exists
  const marker = (await pg.query("SELECT * FROM public.inventory_documents WHERE doc_type = 'SYSTEM_MIGRATION'")).rows[0];
  assert.ok(marker);

  // Runtime smoke: If compact_core.sql.part is available, apply it and test warehouse_get_summary + get_inventory_analytics
  const coreDraftPath = process.env.COMPACT_CORE_PART || path.resolve(__dirname, '../database_scripts/drafts/compact_core.sql.part');
  if (fs.existsSync(coreDraftPath)) {
    // Seed admin staff user to test authenticated calls
    await pg.exec(`
      INSERT INTO public.staff_users (auth_user_id, username, full_name, role_id)
      VALUES ('${ADMIN_AUTH_ID}', 'admin_user', 'Admin Person', (SELECT id FROM public.roles WHERE name = 'admin'))
      ON CONFLICT DO NOTHING;
    `);

    const coreSql = fs.readFileSync(coreDraftPath, 'utf8');
    await pg.exec(coreSql);

    // Set auth to admin to run warehouse_get_summary
    await setAuthUser(pg, ADMIN_AUTH_ID, 'authenticated');

    const summaryRes = await pg.query("SELECT public.warehouse_get_summary() AS summary;");
    const summary = summaryRes.rows[0].summary;
    assert.ok(summary, 'warehouse_get_summary must return valid object');
    assert.ok(Array.isArray(summary.categories), 'summary.categories must be array');
    assert.ok(summary.categories.some(c => c.name === 'ริบบิ้นและโบว์'), 'Inserted category must appear in summary');

    // get_inventory_analytics smoke
    const analyticsRes = await pg.query("SELECT public.get_inventory_analytics() AS analytics;");
    assert.ok(analyticsRes.rows[0].analytics, 'get_inventory_analytics must return analytics object');
  }
});

test('6. Fail-closed guard: Throws error if flower.compact_build is not set to v2', async (t) => {
  const pg = new (require('@electric-sql/pglite').PGlite)();
  t.after(async () => { await pg.close().catch(() => {}); });

  await pg.exec(BASE_FIXTURE_SQL);

  const sqlPath = path.resolve(__dirname, '../database_scripts/drafts/compact_schema.sql.part');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  await assert.rejects(async () => {
    await pg.exec(sql);
  }, /flower\.compact_build guard violation/i);
});
