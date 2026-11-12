const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  createProductionPgHarness,
  setAuthUser,
  ADMIN_AUTH_ID,
  ACCOUNTANT_AUTH_ID,
  TECH_AUTH_ID,
  DRIVER_AUTH_ID
} = require('./helpers/productionFixture.cjs');

async function createCompactAssemblyHarness() {
  // Start from baseline harness where user ran the 2 old SQL scripts
  const pg = await createProductionPgHarness({ staffIdType: 'uuid' });

  // Paths to the 3 parts
  const schemaDraftPath = process.env.COMPACT_SCHEMA_PART || path.resolve(__dirname, '../database_scripts/drafts/compact_schema.sql.part');
  const coreDraftPath = process.env.COMPACT_CORE_PART || path.resolve(__dirname, '../database_scripts/drafts/compact_core.sql.part');
  const prodDraftPath = process.env.COMPACT_PRODUCTION_PART || path.resolve(__dirname, '../database_scripts/drafts/compact_production.sql.part');

  // Set assembly build guard
  await pg.exec(`SELECT set_config('flower.compact_build', 'v2', false);`);

  // Assemble Part 1: Schema migration
  if (fs.existsSync(schemaDraftPath)) {
    const schemaSql = fs.readFileSync(schemaDraftPath, 'utf8');
    await pg.exec(schemaSql);
  }

  // Assemble Part 2: Core runtime
  if (fs.existsSync(coreDraftPath)) {
    const coreSql = fs.readFileSync(coreDraftPath, 'utf8');
    await pg.exec(coreSql);
  }

  // Assemble Part 3: Production & People runtime
  const prodSql = fs.readFileSync(prodDraftPath, 'utf8');
  await pg.exec(prodSql);

  return pg;
}

test('1. Build Guard: compact_production.sql.part fails closed when flower.compact_build is not v2', async (t) => {
  const pg = await createProductionPgHarness({ staffIdType: 'uuid' });
  t.after(async () => { await pg.close().catch(() => {}); });

  const prodDraftPath = path.resolve(__dirname, '../database_scripts/drafts/compact_production.sql.part');
  const prodSql = fs.readFileSync(prodDraftPath, 'utf8');

  await assert.rejects(
    async () => { await pg.exec(prodSql); },
    /flower\.compact_build=v2 required/
  );
});

test('2. People Registry: warehouse_list_people and warehouse_resolve_person work without PII', async (t) => {
  const pg = await createCompactAssemblyHarness();
  t.after(async () => { await pg.close().catch(() => {}); });

  // Add casual helper and team
  await pg.exec(`
    INSERT INTO public.inventory_recipients (id, name, recipient_type, primary_receiver_name, member_names)
    VALUES 
      ('a1111111-1111-4111-8111-111111111111', 'ป้านิด ดอกไม้สด', 'casual_helper', 'ป้านิด', '{}'),
      ('a2222222-2222-4222-8222-222222222222', 'ทีมฉากหลัก', 'team', 'สมชาย', ARRAY['สมชาย', 'สมหวัง']);
  `);

  await setAuthUser(pg, TECH_AUTH_ID, 'authenticated');

  const listRes = await pg.query(`SELECT warehouse_list_people('', 50) AS people`);
  const people = listRes.rows[0].people;
  assert.ok(Array.isArray(people));
  assert.ok(people.length >= 5, 'Must include staff users and helpers');

  // Verify minimal fields & zero PII
  for (const p of people) {
    assert.equal(p.password, undefined);
    assert.equal(p.citizen_id, undefined);
    assert.equal(p.email, undefined);
    assert.ok(p.key.startsWith('staff:') || p.key.startsWith('recipient:'));
  }

  // Resolve staff
  const staffId = (await pg.query(`SELECT id FROM public.staff_users WHERE username = 'tech_user'`)).rows[0].id;
  const resStaff = (await pg.query(`SELECT warehouse_resolve_person($1) AS res`, ['staff:' + staffId])).rows[0].res;
  assert.ok(resStaff.recipient_id);
  assert.equal(resStaff.recipient_type, 'staff');

  // Resolve casual helper through the same canonical RPC as staff.
  const resHelper = (await pg.query(`SELECT warehouse_resolve_person($1) AS res`, ['recipient:a1111111-1111-4111-8111-111111111111'])).rows[0].res;
  assert.equal(resHelper.recipient_id, 'a1111111-1111-4111-8111-111111111111');
  assert.equal(resHelper.name, 'ป้านิด ดอกไม้สด');
});

test('3. Private Helpers: warehouse_ensure_production_work and warehouse_sync_cash_work exact contracts', async (t) => {
  const pg = await createCompactAssemblyHarness();
  t.after(async () => { await pg.close().catch(() => {}); });

  // Direct call to private helper from authenticated fails because permission is revoked
  await setAuthUser(pg, TECH_AUTH_ID, 'authenticated');
  await assert.rejects(
    async () => {
      await pg.query(`SELECT warehouse_ensure_production_work('00000000-0000-0000-0000-000000000000')`);
    },
    /permission denied/
  );

  // Switch to superuser/definer context to test logic
  await setAuthUser(pg, null, null);

  // Create test PRODUCTION_ISSUE doc
  const issueRes = await pg.query(`
    INSERT INTO public.inventory_documents (
      doc_number, doc_type, project_id, status, is_cash, version
    ) VALUES (
      'ISS-TEST-001', 'PRODUCTION_ISSUE', 'P-0001', 'issued', false, 1
    ) RETURNING id;
  `);
  const issueId = issueRes.rows[0].id;

  // Run warehouse_ensure_production_work
  const workRes = await pg.query(`SELECT warehouse_ensure_production_work($1) AS work_id`, [issueId]);
  const workId = workRes.rows[0].work_id;
  assert.ok(workId, 'Should return generated WORK UUID');

  // Calling it again returns same ID (idempotent)
  const workRes2 = await pg.query(`SELECT warehouse_ensure_production_work($1) AS work_id`, [issueId]);
  assert.equal(workRes2.rows[0].work_id, workId);

  // Verify WORK_OUTPUT line created with 1 set
  const linesRes = await pg.query(`SELECT * FROM public.inventory_document_lines WHERE document_id = $1`, [workId]);
  assert.equal(linesRes.rows.length, 1);
  assert.equal(Number(linesRes.rows[0].required_qty), 1);
  assert.equal(linesRes.rows[0].line_type, 'WORK_OUTPUT');

  // Test cash work sync
  const batchRes = await pg.query(`
    INSERT INTO public.inventory_documents (
      doc_number, doc_type, project_id, status, is_cash, denomination
    ) VALUES (
      'CB-001', 'CASH_BATCH', 'P-0001', 'ACTIVE', true, 1000
    ) RETURNING id;
  `);
  const batchId = batchRes.rows[0].id;

  await pg.query(`
    INSERT INTO public.inventory_document_lines (
      document_id, line_type, quantity, accepted_qty, denomination
    ) VALUES ($1, 'CASH_BATCH', 50, 0, 1000);
  `, [batchId]);

  // Initial sync creates cash WORK
  await pg.query(`SELECT warehouse_sync_cash_work($1)`, [batchId]);
  const cashWork = await pg.query(`SELECT * FROM public.inventory_documents WHERE source_document_id = $1 AND is_cash = true`, [batchId]);
  assert.equal(cashWork.rows.length, 1);
  assert.equal(cashWork.rows[0].doc_type, 'WORK');

  // Increase accepted count and sync -> creates inspection audit receipts
  await pg.query(`
    UPDATE public.inventory_document_lines
    SET accepted_qty = 20
    WHERE document_id = $1 AND line_type = 'CASH_BATCH';
  `, [batchId]);
  await pg.query(`SELECT warehouse_sync_cash_work($1)`, [batchId]);

  // Verify SUBMISSION and INSPECTION receipts created
  const subs = await pg.query(`SELECT * FROM public.inventory_documents WHERE parent_document_id = $1 AND doc_type = 'SUBMISSION'`, [cashWork.rows[0].id]);
  assert.equal(subs.rows.length, 1);
  const insps = await pg.query(`SELECT * FROM public.inventory_documents WHERE parent_document_id = $1 AND doc_type = 'INSPECTION'`, [subs.rows[0].id]);
  assert.equal(insps.rows.length, 1);
});

test('4. Unified Production Issue Creation: custom deliverables, upfront line validation and cache override', async (t) => {
  const pg = await createCompactAssemblyHarness();
  t.after(async () => { await pg.close().catch(() => {}); });

  // Ensure valid item with stock exists
  let itemRes = await pg.query(`SELECT id FROM public.inventory_items WHERE lower(item_type) NOT IN ('banknote') LIMIT 1`);
  let itemId;
  if (itemRes.rows.length === 0) {
    const catRes = await pg.query(`INSERT INTO public.inventory_categories (name, type) VALUES ('General Materials', 'consumable') ON CONFLICT DO NOTHING RETURNING id`);
    const catId = catRes.rows.length > 0 ? catRes.rows[0].id : (await pg.query(`SELECT id FROM public.inventory_categories LIMIT 1`)).rows[0].id;
    const insItem = await pg.query(`INSERT INTO public.inventory_items (name, category_id, item_type, current_stock) VALUES ('White Rose', $1, 'consumable', 100) RETURNING id`, [catId]);
    itemId = insItem.rows[0].id;
  } else {
    itemId = itemRes.rows[0].id;
    await pg.query(`UPDATE public.inventory_items SET current_stock = 100 WHERE id = $1`, [itemId]);
  }

  await setAuthUser(pg, TECH_AUTH_ID, 'authenticated');

  const idempotencyKey = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  // Upfront line validation: invalid line required_qty rejected before dispatch
  await assert.rejects(
    async () => {
      await pg.query(`
        SELECT warehouse_create_production_issue(
          jsonb_build_object(
            'issue_type', 'PRODUCTION_ISSUE',
            'project_id', 'P-0001',
            'recipient_name', 'Test',
            'material_lines', jsonb_build_array(jsonb_build_object('item_id', $1::uuid, 'quantity', 5))
          ),
          '{"title": "Custom Work", "lines": [{"description": "", "required_qty": 5}]}'::jsonb,
          $2::uuid
        );
      `, [itemId, idempotencyKey]);
    },
    /Work output description cannot be empty/
  );

  // Successful unified issue and work creation
  const createRes = await pg.query(`
    SELECT warehouse_create_production_issue(
      jsonb_build_object(
        'issue_type', 'PRODUCTION_ISSUE',
        'project_id', 'P-0001',
        'recipient_name', 'Test Staff',
        'material_lines', jsonb_build_array(jsonb_build_object('item_id', $1::uuid, 'quantity', 2))
      ),
      '{"title": "จัดซุ้มดอกไม้", "lines": [{"description": "ฉากดอกไม้สด", "required_qty": 2, "unit": "ชุด"}]}'::jsonb,
      $2::uuid
    ) AS res;
  `, [itemId, idempotencyKey]);

  const data = createRes.rows[0].res;
  assert.equal(data.success, true);
  assert.ok(data.data.issue);
  assert.ok(data.data.assignment);
  assert.equal(data.data.assignment.title, 'จัดซุ้มดอกไม้');
  assert.equal(data.data.assignment.lines.length, 1);
  assert.equal(Number(data.data.assignment.lines[0].required_qty), 2);

  // Idempotent retry returns identical payload
  const retryRes = await pg.query(`
    SELECT warehouse_create_production_issue(
      jsonb_build_object(
        'issue_type', 'PRODUCTION_ISSUE',
        'project_id', 'P-0001',
        'recipient_name', 'Test Staff',
        'material_lines', jsonb_build_array(jsonb_build_object('item_id', $1::uuid, 'quantity', 2))
      ),
      '{"title": "จัดซุ้มดอกไม้", "lines": [{"description": "ฉากดอกไม้สด", "required_qty": 2, "unit": "ชุด"}]}'::jsonb,
      $2::uuid
    ) AS res;
  `, [itemId, idempotencyKey]);
  assert.deepEqual(retryRes.rows[0].res, data);
});

test('5. Assignment Lifecycle: concurrency expected_version, foreign line check, history preservation and split', async (t) => {
  const pg = await createCompactAssemblyHarness();
  t.after(async () => { await pg.close().catch(() => {}); });

  // Pre-seed helper recipient
  await pg.query(`
    INSERT INTO public.inventory_recipients (id, name, recipient_type, is_active)
    VALUES ('a1111111-1111-4111-8111-111111111111', 'ป้านิด ดอกไม้สด', 'casual_helper', true)
    ON CONFLICT (id) DO NOTHING;
  `);

  await setAuthUser(pg, TECH_AUTH_ID, 'authenticated');

  // Create standalone assignment
  const key1 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const assignRes = await pg.query(`
    SELECT warehouse_create_assignment(
      '{
        "project_id": "P-0001",
        "title": "งานพานพุ่ม",
        "recipient_name": "ช่างฝีมือ",
        "lines": [{"description": "พานพุ่มเงิน", "required_qty": 4, "unit": "คู่"}]
      }'::jsonb,
      $1::uuid
    ) AS res;
  `, [key1]);
  const assignId = assignRes.rows[0].res.data.id;

  // Stale expected_version fails
  const key2 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  await assert.rejects(
    async () => {
      await pg.query(`
        SELECT warehouse_update_assignment(
          jsonb_build_object(
            'assignment_id', $1::uuid,
            'expected_version', 99,
            'title', 'New Title'
          ),
          $2::uuid
        );
      `, [assignId, key2]);
    },
    /Version conflict/
  );

  // Foreign line ID rejection check
  const fakeLineId = '99999999-9999-4999-8999-999999999999';
  const key3 = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  await assert.rejects(
    async () => {
      await pg.query(`
        SELECT warehouse_update_assignment(
          jsonb_build_object(
            'assignment_id', $1::uuid,
            'expected_version', 1,
            'lines', jsonb_build_array(jsonb_build_object('id', $2::uuid, 'required_qty', 5))
          ),
          $3::uuid
        );
      `, [assignId, fakeLineId, key3]);
    },
    /not found in assignment/
  );

  // Submit work
  const lineId = (await pg.query(`SELECT id FROM public.inventory_document_lines WHERE document_id = $1`, [assignId])).rows[0].id;
  const key4 = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  const subRes = await pg.query(`
    SELECT warehouse_submit_work(
      jsonb_build_object(
        'assignment_id', $1::uuid,
        'lines', jsonb_build_array(jsonb_build_object('line_id', $2::uuid, 'quantity', 2))
      ),
      $3::uuid
    ) AS res;
  `, [assignId, lineId, key4]);
  const subId = subRes.rows[0].res.data.id;

  // Exceed required submit fails
  const key5 = '12121212-1212-4212-8212-121212121212';
  await assert.rejects(
    async () => {
      await pg.query(`
        SELECT warehouse_submit_work(
          jsonb_build_object(
            'assignment_id', $1::uuid,
            'lines', jsonb_build_array(jsonb_build_object('line_id', $2::uuid, 'quantity', 5))
          ),
          $3::uuid
        );
      `, [assignId, lineId, key5]);
    },
    /Exceeds required quantity/
  );

  // Inspect work (accept 1, reject 1)
  const subLineId = (await pg.query(`SELECT id FROM public.inventory_document_lines WHERE document_id = $1 AND line_type = 'SUBMISSION'`, [subId])).rows[0].id;
  const key6 = '13131313-1313-4313-8313-131313131313';
  await pg.query(`
    SELECT warehouse_inspect_work(
      jsonb_build_object(
        'submission_id', $1::uuid,
        'lines', jsonb_build_array(jsonb_build_object('submission_line_id', $2::uuid, 'accepted_qty', 1, 'rejected_qty', 1))
      ),
      $3::uuid
    );
  `, [subId, subLineId, key6]);

  // Check that history meaning preservation blocks changing description on accepted line
  const key7 = '14141414-1414-4414-8414-141414141414';
  const currentVer = (await pg.query(`SELECT version FROM public.inventory_documents WHERE id = $1`, [assignId])).rows[0].version;
  await assert.rejects(
    async () => {
      await pg.query(`
        SELECT warehouse_update_assignment(
          jsonb_build_object(
            'assignment_id', $1::uuid,
            'expected_version', $2::int,
            'lines', jsonb_build_array(jsonb_build_object('id', $3::uuid, 'description', 'เปลี่ยนเป็นพานพุ่มทอง', 'required_qty', 4))
          ),
          $4::uuid
        );
      `, [assignId, currentVer, lineId, key7]);
    },
    /Cannot change description/
  );

  // Split remaining unsubmitted work (required=4, accepted=1, pending=0 -> unsubmitted=3)
  const key8 = '15151515-1515-4515-8515-151515151515';
  const splitRes = await pg.query(`
    SELECT warehouse_split_assignment(
      jsonb_build_object(
        'assignment_id', $1::uuid,
        'expected_version', $2::int,
        'to_person_key', 'recipient:a1111111-1111-4111-8111-111111111111',
        'line_quantities', jsonb_build_array(jsonb_build_object('line_id', $3::uuid, 'quantity', 2))
      ),
      $4::uuid
    ) AS res;
  `, [assignId, currentVer, lineId, key8]);
  assert.equal(splitRes.rows[0].res.success, true);

  // Parent line required_qty should be reduced from 4 to 2
  const updatedParentLine = (await pg.query(`SELECT required_qty FROM public.inventory_document_lines WHERE id = $1`, [lineId])).rows[0];
  assert.equal(Number(updatedParentLine.required_qty), 2);
});

test('6. Completion Guard & Problem/Cancellation Reasons', async (t) => {
  const pg = await createCompactAssemblyHarness();
  t.after(async () => { await pg.close().catch(() => {}); });

  await setAuthUser(pg, TECH_AUTH_ID, 'authenticated');

  const key1 = '21212121-2121-4121-8121-212121212121';
  const assignRes = await pg.query(`
    SELECT warehouse_create_assignment(
      '{"project_id": "P-0001", "title": "ซุ้มงานแต่ง"}'::jsonb,
      $1::uuid
    ) AS res;
  `, [key1]);
  const assignId = assignRes.rows[0].res.data.id;

  // Completing without fully accepted output deliverables is rejected
  const key2 = '22222222-2222-4222-8222-222222222222';
  await assert.rejects(
    async () => {
      await pg.query(`
        SELECT warehouse_set_assignment_status(
          jsonb_build_object('assignment_id', $1::uuid, 'expected_version', 1, 'status', 'completed'),
          $2::uuid
        );
      `, [assignId, key2]);
    },
    /Not all required outputs are accepted/
  );

  // Problem / Cancelled status strictly requires non-empty reason
  const key3 = '23232323-2323-4323-8323-232323232323';
  await assert.rejects(
    async () => {
      await pg.query(`
        SELECT warehouse_set_assignment_status(
          jsonb_build_object('assignment_id', $1::uuid, 'expected_version', 1, 'status', 'problem', 'reason', '   '),
          $2::uuid
        );
      `, [assignId, key3]);
    },
    /Reason is strictly required/
  );

  // Successfully sets problem status with reason
  const key4 = '24242424-2424-4424-8424-242424242424';
  const statusRes = await pg.query(`
    SELECT warehouse_set_assignment_status(
      jsonb_build_object('assignment_id', $1::uuid, 'expected_version', 1, 'status', 'problem', 'reason', 'ขาดดอกกุหลาบขาว'),
      $2::uuid
    ) AS res;
  `, [assignId, key4]);
  assert.equal(statusRes.rows[0].res.data.status, 'problem');
});

test('7. Read Budget & Realtime: load_production_project, get_work_details, get_work_cards, inspect_production_cash', async (t) => {
  const pg = await createCompactAssemblyHarness();
  t.after(async () => { await pg.close().catch(() => {}); });

  // Seed cash batch document & line as definer
  const batchRes = await pg.query(`
    INSERT INTO public.inventory_documents (
      doc_number, doc_type, project_id, status, is_cash, denomination
    ) VALUES (
      'CB-100', 'CASH_BATCH', 'P-0001', 'ACTIVE', true, 500
    ) RETURNING id;
  `);
  const batchId = batchRes.rows[0].id;

  await pg.query(`
    INSERT INTO public.inventory_document_lines (
      document_id, line_type, quantity, accepted_qty, denomination
    ) VALUES ($1, 'CASH_BATCH', 100, 0, 500);
  `, [batchId]);

  // Sync to create cash work
  await pg.query(`SELECT warehouse_sync_cash_work($1)`, [batchId]);

  const cashWorkId = (await pg.query(`SELECT id FROM public.inventory_documents WHERE source_document_id = $1 AND is_cash = true`, [batchId])).rows[0].id;

  // Test load_production_project as technician (non-cash)
  await setAuthUser(pg, TECH_AUTH_ID, 'authenticated');
  const boardRes = await pg.query(`SELECT warehouse_load_production_project('P-0001', 25, 0) AS res;`);
  const board = boardRes.rows[0].res;
  assert.ok(board.project);
  assert.ok(board.summary);
  assert.equal(board.summary.has_restricted_work, true);
  // Cash work hidden from technician assignments list
  assert.equal(board.assignments.length, 0);

  // Switch to accountant (cash role) and test warehouse_inspect_production_cash
  await setAuthUser(pg, ACCOUNTANT_AUTH_ID, 'authenticated');
  const keyCash = '31313131-3131-4131-8131-313131313131';
  const cashInspectRes = await pg.query(`
    SELECT warehouse_inspect_production_cash(
      jsonb_build_object('assignment_id', $1::uuid, 'note_count', 50),
      $2::uuid
    ) AS res;
  `, [cashWorkId, keyCash]);
  assert.equal(cashInspectRes.rows[0].res.success, true);

  // Test warehouse_get_work_details
  const detailsRes = await pg.query(`SELECT warehouse_get_work_details($1::uuid, 20, 0) AS res;`, [cashWorkId]);
  const details = detailsRes.rows[0].res;
  assert.equal(details.assignment_id, cashWorkId);
  assert.ok(details.submissions.length >= 1);

  // Test warehouse_get_work_cards targeted refresh
  const cardsRes = await pg.query(`SELECT warehouse_get_work_cards('P-0001', ARRAY[$1::uuid]) AS res;`, [cashWorkId]);
  const cards = cardsRes.rows[0].res;
  assert.equal(cards.length, 1);
  assert.equal(cards[0].id, cashWorkId);
});
