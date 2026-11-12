const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const {
  createCompactFixture, createProductionPgHarness, assembleCompact, setAuthUser,
  itemId, recipientId, TECH_AUTH_ID, ACCOUNTANT_AUTH_ID, DRIVER_AUTH_ID, ADMIN_AUTH_ID
} = require('./helpers/compactRuntimeHarness.cjs');

test('compact history: project filters cover stock and cash, migrated loan projection is bounded', async t => {
  const { pg, cmd } = await createCompactFixture(t);
  await pg.query("INSERT INTO projects(id,name) VALUES('P-0002','Second project') ON CONFLICT DO NOTHING");
  await setAuthUser(pg, TECH_AUTH_ID, 'authenticated');
  for (const projectId of ['P-0001', 'P-0002']) {
    await cmd('issue_create', {issue_type:'PRODUCTION_ISSUE',project_id:projectId,
      recipient_id:recipientId(1),recipient_name:'Helper 1',material_lines:[{item_id:itemId(1),quantity:1}]});
  }
  const history = (await pg.query("SELECT warehouse_get_history('{\"project_id\":\"P-0001\"}'::jsonb) AS result")).rows[0].result;
  assert.ok(history.movements.every(move => move.project_id === 'P-0001'));
  const issues = history.movements.filter(move => move.movement_type === 'ISSUE');
  assert.equal(issues.length, 1);
  assert.equal(Number(issues[0].delta_stock), -1);
  assert.equal(issues[0].item_name_snapshot, 'Tape');
  await setAuthUser(pg, ADMIN_AUTH_ID, null);
  await pg.query("INSERT INTO inventory_documents(doc_number,doc_type,project_id,recipient_name_snapshot,due_at,metadata) VALUES('HISTORY-LOAN','LEGACY_LOAN','P-0001','Original Borrower','2026-11-15','{\"borrowed_at\":\"2026-11-01\"}'),('HISTORY-CASH','CASH_BATCH','P-0001','Cash',null,'{}')");
  await pg.query("UPDATE inventory_documents SET is_cash=true WHERE doc_type='CASH_BATCH'");
  await pg.query("INSERT INTO inventory_movements(movement_type,project_id,is_cash,denomination,quantity) VALUES('CASH_BATCH','P-0001',true,50,1),('CASH_BATCH','P-0002',true,50,1)");
  await setAuthUser(pg, ADMIN_AUTH_ID, 'authenticated');
  const read = async filters => (await pg.query('SELECT warehouse_get_history($1::jsonb) AS result',[JSON.stringify(filters)])).rows[0].result;
  const cash = await read({project_id:'P-0001'});
  assert.equal(cash.cash_movements.length,1);
  assert.equal(cash.cash_movements[0].project_id,'P-0001');
  const hidden = await read({include_cash:false});
  assert.equal(hidden.cash_movements.length,0);
  assert.ok(hidden.documents.every(doc=>doc.doc_type!=='CASH_BATCH'));
  const loans = await read({doc_type:'LEGACY_LOAN',limit:1});
  assert.equal(loans.documents.length,1);
  assert.equal(loans.documents[0].recipient_name_snapshot,'Original Borrower');
  assert.equal(loans.documents[0].borrowed_at,'2026-11-01');
  assert.ok(loans.documents[0].due_at);
  assert.equal(loans.movements.length,0);
  assert.equal(loans.has_more,true);
});

test('compact runtime: mixed issue retries once, recovery restocks good items only, tools return independently', async t => {
  const { pg, cmd } = await createCompactFixture(t);
  await setAuthUser(pg, TECH_AUTH_ID, 'authenticated');
  const key = randomUUID();
  const payload = {
    issue_type: 'PRODUCTION_ISSUE', project_id: 'P-0001', recipient_id: recipientId(1), recipient_name: 'Helper 1',
    material_lines: [{ item_id: itemId(1), quantity: 5 }, { item_id: itemId(2), quantity: 10 }], tool_units: ['SC-001']
  };
  const first = await cmd('issue_create', payload, key);
  assert.equal(first.success, true);
  assert.deepEqual(await cmd('issue_create', payload, key), first);
  await assert.rejects(cmd('issue_create', { ...payload, notes: 'Different request' }, key), /Idempotency|mismatch|reused/i);
  assert.equal(Number((await pg.query('SELECT current_stock FROM inventory_items WHERE id=$1', [itemId(2)])).rows[0].current_stock), 90);
  const board = (await pg.query("SELECT warehouse_load_production_project('P-0001',25,0) AS result")).rows[0].result;
  assert.equal(board.assignments.length, 1, 'ordinary production issues must create one linked default work package');
  const sourceId = (await pg.query("SELECT id FROM inventory_movements WHERE movement_type='ISSUE' AND item_id=$1", [itemId(2)])).rows[0].id;
  await cmd('material_recovery', { project_id: 'P-0001', recipient_name: 'Helper 1', items: [{
    source_issue_movement_id: sourceId, item_id: itemId(2), recovered_qty: 9, inspect_now: true, good_qty: 8, damaged_qty: 1
  }] });
  assert.equal(Number((await pg.query('SELECT current_stock FROM inventory_items WHERE id=$1', [itemId(2)])).rows[0].current_stock), 98);
  await assert.rejects(cmd('material_return_unused', { project_id: 'P-0001', items: [{ item_id: itemId(2), source_issue_movement_id: sourceId, quantity: 2 }] }), /exceed|remaining|outstanding|more than/i);
  await cmd('tool_return', { returns: [{ unit_code: 'SC-001', condition: 'good' }] });
  const unit = (await pg.query("SELECT status,active_custody_line_id FROM asset_units WHERE unit_code='SC-001'")).rows[0];
  assert.equal(unit.status.toUpperCase(), 'AVAILABLE');
  assert.equal(unit.active_custody_line_id, null);
});

test('compact runtime: cash stays conserved through reservation, helper preparation, raw return and delivery', async t => {
  const { pg, cmd, rpc } = await createCompactFixture(t);
  await setAuthUser(pg, ACCOUNTANT_AUTH_ID, 'authenticated');
  await cmd('cash_counted_opening', { counts: [{ denomination: 50, note_count: 40 }, { denomination: 500, note_count: 20 }], notes: 'Counted fixture opening' });
  await assert.rejects(cmd('cash_counted_opening', { counts: [{ denomination: 50, note_count: 999 }] }), /opening|initialized|already|once/i);
  await cmd('cash_reserve', { project_id: 'P-0001', denomination: 50, note_count: 30 });
  const batchId = (await cmd('cash_issue_batch', {
    project_id: 'P-0001', recipient_id: recipientId(1), recipient_name: 'Helper 1', denomination: 50, note_count: 20, use_reservation: true
  })).data.batch.id;
  const receiveKey = randomUUID();
  const receive = { batch_id: batchId, note_count: 5 };
  const received = await cmd('cash_receive_prepared', receive, receiveKey);
  assert.deepEqual(await cmd('cash_receive_prepared', receive, receiveKey), received);
  await cmd('cash_return_unused_raw', { batch_id: batchId, note_count: 2, keep_reservation: true });
  await cmd('cash_deliver_to_customer', { project_id: 'P-0001', denomination: 50, note_count: 2 });
  const cash = (await pg.query('SELECT warehouse_get_cash_summary() AS result')).rows[0].result;
  const fifty = cash.denominations.find(row => Number(row.denomination) === 50);
  assert.equal(Number(fifty.physical_count), 22);
  assert.equal(Number(fifty.reserved_count), 12);
  const batch = (await pg.query("SELECT l.* FROM inventory_document_lines l WHERE l.document_id=$1 AND l.line_type='CASH_BATCH'", [batchId])).rows[0];
  assert.equal(Number(batch.accepted_qty), 5);
  assert.equal(Number(batch.returned_qty), 2);
  const prepared = (await pg.query("SELECT sum(quantity-delivered_qty) AS quantity FROM inventory_document_lines WHERE line_type='CASH_PREPARED' AND project_id='P-0001' AND denomination=50")).rows[0];
  assert.equal(Number(prepared.quantity), 3);
  assert.equal(22 + (20 - 5 - 2) + 3 + 2, 40, 'vault + raw helper + prepared + delivered note counts stay conserved');
  await assert.rejects(cmd('cash_adjust_count', { denomination: 50, delta_count: 0.5, reason: 'Invalid fractional notes' }), /integer|invalid input|whole/i);
  await setAuthUser(pg, TECH_AUTH_ID, 'authenticated');
  await assert.rejects(pg.query('SELECT warehouse_get_cash_summary()'), /Unauthorized|permission/i);
  const board = (await pg.query("SELECT warehouse_load_production_project('P-0001',25,0) AS result")).rows[0].result;
  assert.ok(board.assignments.every(row => !row.cash_only));
  const cashWork = (await pg.query("SELECT id FROM inventory_documents WHERE doc_type='WORK' AND source_document_id=$1", [batchId])).rows[0];
  // RLS must hide the cash work from this user even though the project exists.
  assert.equal(cashWork, undefined);
  assert.equal(Number((await pg.query("SELECT count(*) AS n FROM inventory_document_lines WHERE denomination IS NOT NULL")).rows[0].n), 0);
  assert.equal(Number((await pg.query("SELECT count(*) AS n FROM inventory_movements WHERE is_cash")).rows[0].n), 0);
  assert.equal(Number((await pg.query("SELECT count(*) AS n FROM cash_vault_denominations")).rows[0].n), 0);
  await assert.rejects(rpc('warehouse_submit_work', { assignment_id: batchId, lines: [] }), /Unauthorized|cash|not found/i);
});

test('compact runtime: ten helpers, partial acceptance, splitting and version/foreign-line guards', async t => {
  const { pg, rpc } = await createCompactFixture(t);
  await setAuthUser(pg, TECH_AUTH_ID, 'authenticated');
  const work = [];
  for (let n = 1; n <= 10; n++) {
    const result = await rpc('warehouse_create_assignment', {
      project_id: 'P-0001', title: `Gift package ${n}`, recipient_id: recipientId(n), recipient_name: `Helper ${n}`,
      lines: [{ description: 'Flower gift', required_qty: 10, unit: 'piece' }]
    });
    work.push(result.data.id);
  }
  let board = (await pg.query("SELECT warehouse_load_production_project('P-0001',25,0) AS result")).rows[0].result;
  assert.equal(board.assignments.length, 10);
  const first = board.assignments.find(row => row.id === work[0]);
  const lineId = first.lines[0].id;
  const submitted = await rpc('warehouse_submit_work', { assignment_id: first.id, lines: [{ line_id: lineId, quantity: 3 }], note: 'First partial delivery' });
  board = (await pg.query("SELECT warehouse_load_production_project('P-0001',25,0) AS result")).rows[0].result;
  const pending = board.assignments.find(row => row.id === first.id);
  assert.equal(Number(pending.lines[0].pending_qty), 3);
  assert.equal(Number(pending.lines[0].accepted_qty), 0);
  await assert.rejects(rpc('warehouse_set_assignment_status', { assignment_id: first.id, expected_version: pending.version, status: 'completed' }), /accepted|pending|complete|incomplete/i);
  const subLine = (await pg.query('SELECT id FROM inventory_document_lines WHERE document_id=$1', [submitted.data.id])).rows[0];
  await rpc('warehouse_inspect_work', { submission_id: submitted.data.id, lines: [{ submission_line_id: subLine.id, accepted_qty: 2, rejected_qty: 1 }], note: 'Two passed, one needs rework' });
  board = (await pg.query("SELECT warehouse_load_production_project('P-0001',25,0) AS result")).rows[0].result;
  const checked = board.assignments.find(row => row.id === first.id);
  assert.equal(Number(checked.lines[0].accepted_qty), 2);
  assert.equal(Number(checked.lines[0].pending_qty), 0);
  assert.equal(Number(checked.lines[0].remaining_qty), 8);
  const details = (await pg.query('SELECT warehouse_get_work_details($1,20,0) AS result', [first.id])).rows[0].result;
  assert.ok(details.submissions[0].inspections[0].inspector_name);
  await assert.rejects(rpc('warehouse_update_assignment', { assignment_id: first.id, title: 'Missing version' }), /expected_version|version/i);
  const foreign = board.assignments.find(row => row.id === work[1]).lines[0].id;
  await assert.rejects(rpc('warehouse_update_assignment', { assignment_id: first.id, expected_version: checked.version, lines: [{ id: foreign, required_qty: 999 }] }), /line|assignment|belong|not found/i);
  const split = await rpc('warehouse_split_assignment', { assignment_id: first.id, expected_version: checked.version, to_person_key: `recipient:${recipientId(2)}`, line_quantities: [{ line_id: lineId, quantity: 5 }], reason: 'Share remaining production' });
  assert.equal(split.success, true);
  assert.equal(Number((await pg.query("SELECT sum(required_qty) AS quantity FROM inventory_document_lines WHERE line_type='WORK_OUTPUT'")).rows[0].quantity), 100);
  assert.equal(Number((await pg.query('SELECT current_stock FROM inventory_items WHERE id=$1', [itemId(2)])).rows[0].current_stock), 100, 'assignment operations never deduct materials a second time');
  const currentVersion = Number((await pg.query('SELECT version FROM inventory_documents WHERE id=$1', [first.id])).rows[0].version);
  await setAuthUser(pg, DRIVER_AUTH_ID, 'authenticated');
  await assert.rejects(rpc('warehouse_update_assignment', { assignment_id: first.id, expected_version: currentVersion, title: 'Unauthorized edit' }), /Unauthorized|permission/i);
});

test('compact payload budget: a large catalog is paginated and unit rows are loaded separately', async t => {
  const pg = await createProductionPgHarness({ staffIdType: 'uuid' });
  t.after(() => pg.close());
  await pg.exec(`INSERT INTO inventory_items(code,name,item_type,unit,current_stock,color)
    SELECT 'BUDGET-'||lpad(n::text,4,'0'),'Budget item '||n,CASE WHEN n%10=0 THEN 'asset' ELSE 'consumable' END,'piece',100,CASE WHEN n%2=0 THEN 'white' ELSE 'red' END FROM generate_series(1,1000) n;
    INSERT INTO asset_units(unit_code,item_id,status) SELECT i.code||'-'||n,i.id,'AVAILABLE' FROM inventory_items i CROSS JOIN generate_series(1,20) n WHERE i.item_type='asset';`);
  await setAuthUser(pg, TECH_AUTH_ID, 'authenticated');
  const previous = (await pg.query('SELECT warehouse_get_summary() AS result')).rows[0].result;
  const previousBytes = Buffer.byteLength(JSON.stringify(previous));
  await setAuthUser(pg, null, null);
  await assembleCompact(pg);
  await setAuthUser(pg, TECH_AUTH_ID, 'authenticated');
  const summary = (await pg.query('SELECT warehouse_get_summary() AS result')).rows[0].result;
  assert.equal(summary.schema_version, 2);
  assert.ok(summary.items.length <= 50);
  assert.equal(summary.asset_units.length, 0);
  const currentBytes = Buffer.byteLength(JSON.stringify(summary));
  assert.ok(previousBytes > currentBytes * 3, 'metadata plus the first page must be much smaller than the previous full catalog');
  const page = (await pg.query('SELECT warehouse_list_stock($1::jsonb) AS result', [JSON.stringify({ limit: 50, offset: 50 })])).rows[0].result;
  assert.equal(page.items.length, 50);
  const assetId = (await pg.query("SELECT id FROM inventory_items WHERE item_type='asset' LIMIT 1")).rows[0].id;
  const units = (await pg.query('SELECT warehouse_list_units($1::jsonb) AS result', [JSON.stringify({ item_id: assetId, limit: 20 })])).rows[0].result;
  assert.equal(units.units.length, 20);
  t.diagnostic(`Synthetic fixture JSON bytes (not compressed wire usage): previous full summary=${previousBytes}; compact first page=${currentBytes}; units page=${Buffer.byteLength(JSON.stringify(units))}.`);
});
