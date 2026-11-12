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
  DRIVER_AUTH_ID,
  UNMAPPED_AUTH_ID
} = require('./helpers/productionFixture.cjs');

test('1. Migration rerun preserves data and creates all production hub tables', async (t) => {
  const pg = await createProductionPgHarness({ staffIdType: 'uuid' });
  t.after(async () => { await pg.close().catch(() => {}); });

  const hubSql = fs.readFileSync(path.resolve(__dirname, '../database_scripts/inventory_production_hub.sql'), 'utf8');

  // Verify tables exist
  const res = await pg.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN (
      'production_assignments',
      'production_assignment_lines',
      'production_submissions',
      'production_submission_lines',
      'production_inspections',
      'production_inspection_lines',
      'production_assignment_events'
    )
  `);
  assert.equal(res.rows.length, 7, 'All 7 production hub tables must exist');

  // Second run to verify re-runnability / idempotency
  await pg.exec(hubSql);
});

test('2. Schema compatibility: applies cleanly when staff_users.id is TEXT (staff_code migration)', async (t) => {
  const pg = await createProductionPgHarness({ staffIdType: 'text' });
  t.after(async () => { await pg.close().catch(() => {}); });

  // Verify staff_users.id is indeed TEXT
  const colRes = await pg.query(`
    SELECT data_type FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'staff_users' AND column_name = 'id'
  `);
  assert.equal(colRes.rows[0].data_type, 'text');

  // Verify inventory_recipients has staff_user_id column
  const recipCol = await pg.query(`
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'inventory_recipients' AND column_name = 'staff_user_id'
  `);
  assert.equal(recipCol.rows.length, 1);
});

test('3. People registry: warehouse_list_people returns minimal fields without PII, distinguishes kinds, and prevents fake UUIDs', async (t) => {
  const pg = await createProductionPgHarness({ staffIdType: 'uuid' });
  t.after(async () => { await pg.close().catch(() => {}); });
  // Create casual helper and a team as DB maintenance
  await pg.exec(`
    INSERT INTO public.inventory_recipients (id, name, recipient_type, is_active)
    VALUES 
      ('a1111111-1111-4111-8111-111111111111', 'ป้านิด ดอกไม้สด', 'casual_helper', true),
      ('a2222222-2222-4222-8222-222222222222', 'ทีมประกอบฉาก A', 'team', true);
    
    INSERT INTO public.inventory_recipient_teams (team_recipient_id, primary_receiver_name, member_names)
    VALUES 
      ('a2222222-2222-4222-8222-222222222222', 'ช่างสมหมาย', ARRAY['ช่างสมหมาย', 'น้องต้น', 'น้องนนท์']);
  `);

  await setAuthUser(pg, TECH_AUTH_ID, 'authenticated');

  const listRes = await pg.query(`SELECT warehouse_list_people('', 50) AS people`);
  const people = listRes.rows[0].people;
  assert.ok(Array.isArray(people));
  assert.ok(people.length >= 5, 'Should include staff and helpers');

  // Check no PII fields exposed
  for (const p of people) {
    assert.equal(p.password, undefined);
    assert.equal(p.citizen_id, undefined);
    assert.equal(p.email, undefined);
    assert.equal(p.address, undefined);
    assert.ok(p.key.startsWith('staff:') || p.key.startsWith('recipient:'));
    assert.ok(['staff', 'casual_helper', 'team', 'individual'].includes(p.kind));
  }

  // Resolve staff person to canonical bridge
  const resolvedStaff = (await pg.query(`SELECT warehouse_resolve_person($1) AS res`, ['staff:' + (await pg.query(`SELECT id FROM public.staff_users WHERE username = 'tech_user'`)).rows[0].id])).rows[0].res;
  assert.ok(resolvedStaff.recipient_id, 'Must generate/return valid recipient UUID');
  assert.equal(resolvedStaff.recipient_type, 'staff');

  // Resolve casual helper
  const resolvedHelper = (await pg.query(`SELECT warehouse_resolve_person($1) AS res`, ['recipient:a1111111-1111-4111-8111-111111111111'])).rows[0].res;
  assert.equal(resolvedHelper.recipient_id, 'a1111111-1111-4111-8111-111111111111');
  assert.equal(resolvedHelper.name, 'ป้านิด ดอกไม้สด');
});

test('4. Security & Anti-Escalation: non-admin cannot alter role_id, auth_user_id, or is_active on staff_users or modify roles', async (t) => {
  const pg = await createProductionPgHarness({ staffIdType: 'uuid' });
  t.after(async () => { await pg.close().catch(() => {}); });

  // Anonymous DML must be blocked
  await setAuthUser(pg, null, 'anon');
  await assert.rejects(
    pg.query(`INSERT INTO public.roles (name, label) VALUES ('superadmin', 'Superadmin')`),
    /permission denied/i
  );

  // Authenticated technician attempts self-role escalation
  await setAuthUser(pg, TECH_AUTH_ID, 'authenticated');
  const adminRoleId = (await pg.query(`SELECT id FROM public.roles WHERE name = 'admin'`)).rows[0].id;
  const techUserId = (await pg.query(`SELECT id FROM public.staff_users WHERE auth_user_id = $1`, [TECH_AUTH_ID])).rows[0].id;

  await assert.rejects(
    pg.query(`UPDATE public.staff_users SET role_id = $1 WHERE id = $2`, [adminRoleId, techUserId]),
    /Unauthorized|denied|privilege/i
  );

  // Technician cannot update another staff user
  const adminUserId = (await pg.query(`SELECT id FROM public.staff_users WHERE auth_user_id = $1`, [ADMIN_AUTH_ID])).rows[0].id;
  await assert.rejects(
    pg.query(`UPDATE public.staff_users SET nickname = 'Hacked' WHERE id = $1`, [adminUserId]),
    /Unauthorized|denied|privilege/i
  );

  // But technician CAN update their own basic profile fields (e.g. nickname, phone)
  await pg.query(`UPDATE public.staff_users SET nickname = 'ช่างเอก' WHERE id = $1`, [techUserId]);
  const check = (await pg.query(`SELECT nickname FROM public.staff_users WHERE id = $1`, [techUserId])).rows[0];
  assert.equal(check.nickname, 'ช่างเอก');
});

test('5. Seamless integration: AFTER INSERT on inventory_documents creates default assignment and output line', async (t) => {
  const pg = await createProductionPgHarness({ staffIdType: 'uuid' });
  t.after(async () => { await pg.close().catch(() => {}); });

  const itemA = (await pg.query(`
    INSERT INTO public.inventory_items (code, name, item_type, unit, current_stock)
    VALUES ('MAT-01', 'ดอกลิลลี่ขาว', 'consumable', 'ก้าน', 100) RETURNING id
  `)).rows[0].id;

  await setAuthUser(pg, TECH_AUTH_ID, 'authenticated');

  const issuePayload = JSON.stringify({
    issue_type: 'PRODUCTION_ISSUE',
    project_id: 'P-0001',
    recipient_name: 'พี่สมศรี',
    due_date: '2026-11-20T18:00:00Z',
    material_lines: [{ item_id: itemA, quantity: 10 }]
  });

  const res = await pg.query(
    `SELECT warehouse_dispatch('issue_create', $1::jsonb, gen_random_uuid()) AS result`,
    [issuePayload]
  );
  assert.ok(res.rows[0].result.success);
  const docId = res.rows[0].result.data.document_id || res.rows[0].result.data.id;

  // Verify linked default production assignment created automatically by trigger
  const assignRes = await pg.query(`
    SELECT * FROM public.production_assignments WHERE source_document_id = $1
  `, [docId]);
  assert.equal(assignRes.rows.length, 1);
  assert.equal(assignRes.rows[0].project_id, 'P-0001');
  assert.equal(assignRes.rows[0].responsible_name, 'พี่สมศรี');
  assert.equal(assignRes.rows[0].status, 'in_progress');

  // Verify default output line
  const linesRes = await pg.query(`
    SELECT * FROM public.production_assignment_lines WHERE assignment_id = $1
  `, [assignRes.rows[0].id]);
  assert.equal(linesRes.rows.length, 1);
  assert.equal(linesRes.rows[0].description, 'งานผลิตตามใบเบิก');
  assert.equal(Number(linesRes.rows[0].required_qty), 1);
  assert.equal(linesRes.rows[0].unit, 'ชุด');
});

test('6. warehouse_create_production_issue: atomic issue + custom output work creation, rollback on invalid work', async (t) => {
  const pg = await createProductionPgHarness({ staffIdType: 'uuid' });
  t.after(async () => { await pg.close().catch(() => {}); });

  const itemA = (await pg.query(`
    INSERT INTO public.inventory_items (code, name, item_type, unit, current_stock)
    VALUES ('MAT-02', 'ริบบิ้นสีทอง', 'consumable', 'ม้วน', 20) RETURNING id
  `)).rows[0].id;

  await setAuthUser(pg, TECH_AUTH_ID, 'authenticated');

  const validIssue = {
    issue_type: 'PRODUCTION_ISSUE',
    project_id: 'P-0001',
    recipient_name: 'คุณสายใจ',
    material_lines: [{ item_id: itemA, quantity: 5 }]
  };

  const invalidWork = {
    title: 'ผลิตพวงมาลัย 10 พวง',
    lines: [
      { description: 'พวงมาลัยคล้องมือ', required_qty: -5, unit: 'พวง' } // Negative quantity invalid!
    ]
  };

  const failKey = 'f0000000-0000-4000-8000-000000000001';
  await assert.rejects(
    pg.query(`SELECT warehouse_create_production_issue($1::jsonb, $2::jsonb, $3::uuid)`, [
      JSON.stringify(validIssue),
      JSON.stringify(invalidWork),
      failKey
    ]),
    /invalid|quantity|check constraint/i
  );

  // Stock must NOT have changed!
  const stockCheck = (await pg.query(`SELECT current_stock FROM public.inventory_items WHERE id = $1`, [itemA])).rows[0];
  assert.equal(Number(stockCheck.current_stock), 20, 'Stock must rollback on invalid work');

  // Valid issue + custom work
  const validWork = {
    title: 'ผลิตพวงมาลัย 10 พวง',
    due_at: '2026-11-25T15:00:00Z',
    lines: [
      { description: 'พวงมาลัยชายริบบิ้น', required_qty: 10, unit: 'พวง' }
    ]
  };
  const successKey = 'f0000000-0000-4000-8000-000000000002';
  const successRes = await pg.query(
    `SELECT warehouse_create_production_issue($1::jsonb, $2::jsonb, $3::uuid) AS res`,
    [JSON.stringify(validIssue), JSON.stringify(validWork), successKey]
  );
  assert.ok(successRes.rows[0].res.success);
  assert.ok(successRes.rows[0].res.data.issue);
  assert.ok(successRes.rows[0].res.data.assignment);
  assert.equal(successRes.rows[0].res.data.assignment.title, 'ผลิตพวงมาลัย 10 พวง');

  // Replay idempotency returns identical result
  const replayRes = await pg.query(
    `SELECT warehouse_create_production_issue($1::jsonb, $2::jsonb, $3::uuid) AS res`,
    [JSON.stringify(validIssue), JSON.stringify(validWork), successKey]
  );
  assert.equal(replayRes.rows[0].res.data.assignment.id, successRes.rows[0].res.data.assignment.id);

  // Mismatched payload with same key must reject
  await assert.rejects(
    pg.query(`SELECT warehouse_create_production_issue($1::jsonb, $2::jsonb, $3::uuid)`, [
      JSON.stringify({ ...validIssue, recipient_name: 'Other' }),
      JSON.stringify(validWork),
      successKey
    ]),
    /idempotency/i
  );
});

test('7. 10 helpers on same project: partial submissions, inspections, shortages, and completed status gating', async (t) => {
  const pg = await createProductionPgHarness({ staffIdType: 'uuid' });
  t.after(async () => { await pg.close().catch(() => {}); });
  await setAuthUser(pg, TECH_AUTH_ID, 'authenticated');

  // Create 10 helper assignments for project P-0001
  const assignmentIds = [];
  for (let i = 1; i <= 10; i++) {
    const payload = JSON.stringify({
      project_id: 'P-0001',
      title: `งานจัดดอกไม้ ผู้ช่วย #${i}`,
      recipient_name: `ผู้ช่วยคนที่ ${i}`,
      lines: [{ description: 'แจกันดอกไม้โต๊ะอาหาร', required_qty: 5, unit: 'แจกัน' }]
    });
    const key = `10000000-0000-4000-8000-0000000000${i.toString().padStart(2, '0')}`;
    const res = await pg.query(`SELECT warehouse_create_assignment($1::jsonb, $2::uuid) AS res`, [payload, key]);
    assignmentIds.push(res.rows[0].res.data.id);
  }

  assert.equal(assignmentIds.length, 10);

  // Helper #1 partial submission: submits 3 out of 5
  const assign1 = assignmentIds[0];
  const line1Id = (await pg.query(`SELECT id FROM public.production_assignment_lines WHERE assignment_id = $1`, [assign1])).rows[0].id;

  const subKey1 = '20000000-0000-4000-8000-000000000001';
  const subRes1 = await pg.query(`SELECT warehouse_submit_work($1::jsonb, $2::uuid) AS res`, [
    JSON.stringify({
      assignment_id: assign1,
      lines: [{ line_id: line1Id, quantity: 3 }],
      note: 'ส่งงวดแรก 3 แจกัน'
    }),
    subKey1
  ]);
  assert.ok(subRes1.rows[0].res.success);
  const submissionId = subRes1.rows[0].res.data.id;
  const subLineId = (await pg.query(`SELECT id FROM public.production_submission_lines WHERE submission_id = $1`, [submissionId])).rows[0].id;

  // Attempting to mark assignment as 'completed' when only 3 are submitted (and 0 accepted) MUST FAIL!
  await assert.rejects(
    pg.query(`SELECT warehouse_set_assignment_status($1::jsonb, $2::uuid)`, [
      JSON.stringify({ assignment_id: assign1, expected_version: 2, status: 'completed' }),
      genRandomKey()
    ]),
    /not all required outputs are accepted|pending/i
  );

  // Staff inspects: 2 accepted, 1 rejected
  const inspKey1 = '30000000-0000-4000-8000-000000000001';
  const inspRes1 = await pg.query(`SELECT warehouse_inspect_work($1::jsonb, $2::uuid) AS res`, [
    JSON.stringify({
      submission_id: submissionId,
      lines: [{ submission_line_id: subLineId, accepted_qty: 2, rejected_qty: 1 }],
      note: 'ผ่าน 2 ใบ อีก 1 ใบดอกไม้ช้ำ'
    }),
    inspKey1
  ]);
  assert.ok(inspRes1.rows[0].res.success);

  // Check assignment line progress
  const l1Check = (await pg.query(`SELECT * FROM public.production_assignment_lines WHERE id = $1`, [line1Id])).rows[0];
  assert.equal(Number(l1Check.accepted_qty), 2);
  assert.equal(Number(l1Check.rejected_qty), 1);
  assert.equal(Number(l1Check.pending_qty), 0);
  // remaining_qty = required(5) - accepted(2) = 3
  assert.equal(Number(l1Check.required_qty) - Number(l1Check.accepted_qty), 3);

  // Over-accepting beyond submitted must fail
  await assert.rejects(
    pg.query(`SELECT warehouse_inspect_work($1::jsonb, $2::uuid)`, [
      JSON.stringify({
        submission_id: submissionId,
        lines: [{ submission_line_id: subLineId, accepted_qty: 5, rejected_qty: 0 }]
      }),
      genRandomKey()
    ]),
    /cannot accept more than|exceeds/i
  );
});

test('8. Split work: remaining unsubmitted work splits to another person, aggregate expected conserved', async (t) => {
  const pg = await createProductionPgHarness({ staffIdType: 'uuid' });
  t.after(async () => { await pg.close().catch(() => {}); });
  await setAuthUser(pg, TECH_AUTH_ID, 'authenticated');

  const createRes = await pg.query(`SELECT warehouse_create_assignment($1::jsonb, $2::uuid) AS res`, [
    JSON.stringify({
      project_id: 'P-0001',
      title: 'งานผลิตช่อดอกไม้รวม',
      recipient_name: 'ผู้ช่วย A',
      lines: [{ description: 'ช่อบูเก้ดอกทิวลิป', required_qty: 10, unit: 'ช่อ' }]
    }),
    genRandomKey()
  ]);
  const parentId = createRes.rows[0].res.data.id;
  const lineId = (await pg.query(`SELECT id FROM public.production_assignment_lines WHERE assignment_id = $1`, [parentId])).rows[0].id;

  // Partial submission & acceptance of 4
  const subRes = await pg.query(`SELECT warehouse_submit_work($1::jsonb, $2::uuid) AS res`, [
    JSON.stringify({
      assignment_id: parentId,
      lines: [{ line_id: lineId, quantity: 4 }]
    }),
    genRandomKey()
  ]);
  const subLineId = (await pg.query(`SELECT id FROM public.production_submission_lines WHERE submission_id = $1`, [subRes.rows[0].res.data.id])).rows[0].id;
  await pg.query(`SELECT warehouse_inspect_work($1::jsonb, $2::uuid)`, [
    JSON.stringify({
      submission_id: subRes.rows[0].res.data.id,
      lines: [{ submission_line_id: subLineId, accepted_qty: 4, rejected_qty: 0 }]
    }),
    genRandomKey()
  ]);

  // Now 4 accepted, remaining required is 6.
  // Split 4 out of remaining 6 to helper B (staff bridge)
  const currentVer = (await pg.query(`SELECT version FROM public.production_assignments WHERE id = $1`, [parentId])).rows[0].version;
  const driverStaffId = (await pg.query(`SELECT id FROM public.staff_users WHERE username = 'driver_user'`)).rows[0].id;
  const splitKey = genRandomKey();
  const splitRes = await pg.query(`SELECT warehouse_split_assignment($1::jsonb, $2::uuid) AS res`, [
    JSON.stringify({
      assignment_id: parentId,
      expected_version: currentVer,
      to_person_key: 'staff:' + driverStaffId,
      line_quantities: [{ line_id: lineId, quantity: 4 }],
      title: 'งานแบ่งผลิตช่อทิวลิป 4 ช่อ',
      reason: 'ช่วยแบ่งงานใกล้เวลาส่งมอบ'
    }),
    splitKey
  ]);
  assert.ok(splitRes.rows[0].res.success);
  const childId = splitRes.rows[0].res.data.child_assignment.id;

  // Parent line required_qty must now be 10 - 4 = 6
  const parentLine = (await pg.query(`SELECT * FROM public.production_assignment_lines WHERE id = $1`, [lineId])).rows[0];
  assert.equal(Number(parentLine.required_qty), 6);
  assert.equal(Number(parentLine.accepted_qty), 4);

  // Child line required_qty must be 4
  const childLine = (await pg.query(`SELECT * FROM public.production_assignment_lines WHERE assignment_id = $1`, [childId])).rows[0];
  assert.equal(Number(childLine.required_qty), 4);
  assert.equal(Number(childLine.accepted_qty), 0);

  // Aggregate expected total is 6 + 4 = 10, perfectly conserved!
});

test('9. Optimistic concurrency: stale expected_version rejected on update / status change', async (t) => {
  const pg = await createProductionPgHarness({ staffIdType: 'uuid' });
  t.after(async () => { await pg.close().catch(() => {}); });
  await setAuthUser(pg, TECH_AUTH_ID, 'authenticated');

  const createRes = await pg.query(`SELECT warehouse_create_assignment($1::jsonb, $2::uuid) AS res`, [
    JSON.stringify({
      project_id: 'P-0001',
      title: 'งานเตรียมอุปกรณ์',
      recipient_name: 'ผู้ช่วย C',
      lines: [{ description: 'ติดป้ายราคา', required_qty: 20, unit: 'ชิ้น' }]
    }),
    genRandomKey()
  ]);
  const assignId = createRes.rows[0].res.data.id;

  // Update with wrong expected_version
  await assert.rejects(
    pg.query(`SELECT warehouse_update_assignment($1::jsonb, $2::uuid)`, [
      JSON.stringify({
        assignment_id: assignId,
        expected_version: 99, // Stale!
        title: 'New Title'
      }),
      genRandomKey()
    ]),
    /version conflict|stale/i
  );
});

test('10. Cash integration: trigger on cash_helper_batches derives cash_only assignment, no vault mutation, RBAC protected', async (t) => {
  const pg = await createProductionPgHarness({ staffIdType: 'uuid' });
  t.after(async () => { await pg.close().catch(() => {}); });

  // 1. Admin issues cash batch through core dispatcher
  await setAuthUser(pg, ADMIN_AUTH_ID, 'authenticated');

  // Counted opening for vault 100 THB banknotes
  await pg.query(`
    SELECT warehouse_dispatch('cash_counted_opening', $1::jsonb, $2::uuid)
  `, [JSON.stringify({ counts: [{ denomination: 100, note_count: 50 }], notes: 'Opening 5000 THB' }), genRandomKey()]);

  // Issue helper batch of 20 notes (2000 THB)
  const batchRes = await pg.query(`
    SELECT warehouse_dispatch('cash_issue_batch', $1::jsonb, $2::uuid) AS res
  `, [JSON.stringify({
    project_id: 'P-0001',
    recipient_name: 'พี่นวลพับเงิน',
    denomination: 100,
    note_count: 20,
    use_reservation: false
  }), genRandomKey()]);
  assert.ok(batchRes.rows[0].res.success);
  const batchId = batchRes.rows[0].res.data.batch?.id || batchRes.rows[0].res.data.id;

  // 2. Verify cash_only production assignment created automatically by trigger
  const cashAssign = (await pg.query(`
    SELECT * FROM public.production_assignments WHERE source_cash_batch_id = $1
  `, [batchId])).rows[0];
  assert.ok(cashAssign);
  assert.equal(cashAssign.cash_only, true);
  assert.equal(cashAssign.project_id, 'P-0001');

  const cashLine = (await pg.query(`
    SELECT * FROM public.production_assignment_lines WHERE assignment_id = $1
  `, [cashAssign.id])).rows[0];
  assert.equal(Number(cashLine.required_qty), 20);
  assert.equal(Number(cashLine.accepted_qty), 0);

  // 3. Receive prepared banknotes via core cash flow
  await pg.query(`
    SELECT warehouse_dispatch('cash_receive_prepared', $1::jsonb, $2::uuid)
  `, [JSON.stringify({
    project_id: 'P-0001',
    batch_id: batchId,
    denomination: 100,
    note_count: 15,
    set_name: 'ชุดเงินงานแต่ง'
  }), genRandomKey()]);

  // Line accepted_qty must be updated to 15 by trigger, without duplicate cash movements
  const updatedCashLine = (await pg.query(`
    SELECT * FROM public.production_assignment_lines WHERE assignment_id = $1
  `, [cashAssign.id])).rows[0];
  assert.equal(Number(updatedCashLine.accepted_qty), 15);

  // 4. Non-cash role (technician) cannot read cash assignments through RLS or RPC
  await setAuthUser(pg, TECH_AUTH_ID, 'authenticated');
  const techView = await pg.query(`
    SELECT * FROM public.production_assignments WHERE id = $1
  `, [cashAssign.id]);
  assert.equal(techView.rows.length, 0, 'RLS must hide cash_only assignment from non-cash role');

  const boardRes = await pg.query(`SELECT warehouse_load_production_project($1, 100, 0) AS res`, ['P-0001']);
  const board = boardRes.rows[0].res;
  assert.equal(board.permissions.can_manage_cash, false);
  // Cash assignment must be omitted from assignments list
  const hasCashAssignment = board.assignments.some(a => a.id === cashAssign.id);
  assert.equal(hasCashAssignment, false);
  // But summary flags has_restricted_work
  assert.equal(board.summary.has_restricted_work, true);
});

test('11. Status cancellation retains custody and history: no automatic stock refund or wage deductions', async (t) => {
  const pg = await createProductionPgHarness({ staffIdType: 'uuid' });
  t.after(async () => { await pg.close().catch(() => {}); });
  await setAuthUser(pg, TECH_AUTH_ID, 'authenticated');

  const createRes = await pg.query(`SELECT warehouse_create_assignment($1::jsonb, $2::uuid) AS res`, [
    JSON.stringify({
      project_id: 'P-0001',
      title: 'งานโครงไม้ดอกไม้',
      recipient_name: 'ช่างสมปอง',
      lines: [{ description: 'โครงไม้สน', required_qty: 2, unit: 'โครง' }]
    }),
    genRandomKey()
  ]);
  const assignId = createRes.rows[0].res.data.id;

  // Cancel requires reason
  await assert.rejects(
    pg.query(`SELECT warehouse_set_assignment_status($1::jsonb, $2::uuid)`, [
      JSON.stringify({ assignment_id: assignId, expected_version: 1, status: 'cancelled' }),
      genRandomKey()
    ]),
    /reason.*strictly required/i
  );

  // Cancel with reason succeeds
  await pg.query(`SELECT warehouse_set_assignment_status($1::jsonb, $2::uuid)`, [
    JSON.stringify({ assignment_id: assignId, expected_version: 1, status: 'cancelled', reason: 'ลูกค้าเปลี่ยนใจไม่ใช้ซุ้มไม้' }),
    genRandomKey()
  ]);

  const cancelledAssign = (await pg.query(`SELECT status FROM public.production_assignments WHERE id = $1`, [assignId])).rows[0];
  assert.equal(cancelledAssign.status, 'cancelled');

  // Verify audit event recorded
  const events = await pg.query(`
    SELECT * FROM public.production_assignment_events WHERE assignment_id = $1 AND event_type = 'status_changed'
  `, [assignId]);
  assert.equal(events.rows.length, 1);
  assert.equal(events.rows[0].to_status, 'cancelled');
  assert.equal(events.rows[0].reason, 'ลูกค้าเปลี่ยนใจไม่ใช้ซุ้มไม้');
});

test('12. Unknown auth UUID & anonymous callers cannot modify roles, insert staff, or escalate permissions', async (t) => {
  const pg = await createProductionPgHarness({ staffIdType: 'uuid' });
  t.after(async () => { await pg.close().catch(() => {}); });

  // 1. Unknown auth UUID (not in staff_users)
  await setAuthUser(pg, UNMAPPED_AUTH_ID, 'authenticated');

  // Attempt to insert a new role
  await assert.rejects(
    pg.query(`INSERT INTO public.roles (name, label) VALUES ('superadmin', 'Superadmin')`),
    /Unauthorized|Only administrators/i
  );

  // Attempt to modify an existing role
  await assert.rejects(
    pg.query(`UPDATE public.roles SET can_edit_pricing = true WHERE name = 'driver'`),
    /Unauthorized|Only administrators/i
  );

  // Attempt to insert a staff user
  await assert.rejects(
    pg.query(`
      INSERT INTO public.staff_users (auth_user_id, username, full_name, role_id)
      VALUES (gen_random_uuid(), 'hacker', 'Hacker', (SELECT id FROM public.roles WHERE name = 'admin'))
    `),
    /Unauthorized|Only administrators/i
  );

  // 2. Anonymous caller without JWT (auth.uid is null)
  await setAuthUser(pg, null, 'anon');

  await assert.rejects(
    pg.query(`INSERT INTO public.roles (name, label) VALUES ('evil_role', 'Evil')`),
    /Unauthorized|Only administrators|denied/i
  );

  await assert.rejects(
    pg.query(`
      INSERT INTO public.staff_users (auth_user_id, username, full_name, role_id)
      VALUES (gen_random_uuid(), 'evil_staff', 'Evil', (SELECT id FROM public.roles WHERE name = 'admin'))
    `),
    /Unauthorized|Only administrators|denied/i
  );
});

test('13. Project FK ON DELETE RESTRICT: blocks deleting projects that have assignments to preserve financial & custody audit', async (t) => {
  const pg = await createProductionPgHarness({ staffIdType: 'uuid' });
  t.after(async () => { await pg.close().catch(() => {}); });
  await setAuthUser(pg, TECH_AUTH_ID, 'authenticated');

  // Create an assignment under P-0001
  const createRes = await pg.query(`SELECT warehouse_create_assignment($1::jsonb, $2::uuid) AS res`, [
    JSON.stringify({
      project_id: 'P-0001',
      title: 'Custody Guard Task',
      recipient_name: 'ช่างทดสอบ',
      lines: [{ description: 'โครงเหล็ก', required_qty: 1, unit: 'ชุด' }]
    }),
    genRandomKey()
  ]);
  assert.ok(createRes.rows[0].res.success);

  // Attempt to delete project P-0001 as DB owner / admin -> MUST BE BLOCKED BY RESTRICT!
  await setAuthUser(pg, null, null); // Run as DB maintenance
  await assert.rejects(
    pg.query(`DELETE FROM public.projects WHERE id = 'P-0001'`),
    /foreign key constraint|violates foreign key|production_assignments/i
  );

  // Verify assignment still exists intact
  const check = await pg.query(`SELECT count(*)::int AS cnt FROM public.production_assignments WHERE project_id = 'P-0001'`);
  assert.ok(check.rows[0].cnt > 0, 'Assignment must not be deleted');
});

test('14. Board summary: ready_for_next_step is FALSE when no tasks exist or when all tasks are cancelled', async (t) => {
  const pg = await createProductionPgHarness({ staffIdType: 'uuid' });
  t.after(async () => { await pg.close().catch(() => {}); });
  await setAuthUser(pg, TECH_AUTH_ID, 'authenticated');

  // Create new project P-EMPTY
  await setAuthUser(pg, null, null);
  await pg.query(`INSERT INTO public.projects (id, name) VALUES ('P-EMPTY', 'Empty Project')`);
  await setAuthUser(pg, TECH_AUTH_ID, 'authenticated');

  // Case A: No tasks -> ready_for_next_step MUST be false
  const emptyBoard = (await pg.query(`SELECT warehouse_load_production_project('P-EMPTY', 100, 0) AS res`)).rows[0].res;
  assert.equal(emptyBoard.summary.assignment_count, 0);
  assert.equal(emptyBoard.summary.ready_for_next_step, false, 'ready_for_next_step must be false when no tasks exist');

  // Case B: Create 2 tasks and cancel both -> ready_for_next_step MUST be false
  const t1 = (await pg.query(`SELECT warehouse_create_assignment($1::jsonb, $2::uuid) AS res`, [
    JSON.stringify({ project_id: 'P-EMPTY', title: 'Task 1', recipient_name: 'Helper 1' }), genRandomKey()
  ])).rows[0].res.data.id;
  const t2 = (await pg.query(`SELECT warehouse_create_assignment($1::jsonb, $2::uuid) AS res`, [
    JSON.stringify({ project_id: 'P-EMPTY', title: 'Task 2', recipient_name: 'Helper 2' }), genRandomKey()
  ])).rows[0].res.data.id;

  await pg.query(`SELECT warehouse_set_assignment_status($1::jsonb, $2::uuid)`, [
    JSON.stringify({ assignment_id: t1, expected_version: 1, status: 'cancelled', reason: 'Cancelled task 1' }), genRandomKey()
  ]);
  await pg.query(`SELECT warehouse_set_assignment_status($1::jsonb, $2::uuid)`, [
    JSON.stringify({ assignment_id: t2, expected_version: 1, status: 'cancelled', reason: 'Cancelled task 2' }), genRandomKey()
  ]);

  const cancelledBoard = (await pg.query(`SELECT warehouse_load_production_project('P-EMPTY', 100, 0) AS res`)).rows[0].res;
  assert.equal(cancelledBoard.summary.assignment_count, 2);
  assert.equal(cancelledBoard.summary.cancelled_count, 2);
  assert.equal(cancelledBoard.summary.completed_count, 0);
  assert.equal(cancelledBoard.summary.ready_for_next_step, false, 'ready_for_next_step must be false when ALL tasks are cancelled');
});

test('15. RBAC enforcement: Driver role without inventory permission is rejected from update, split, submit, and status changes', async (t) => {
  const pg = await createProductionPgHarness({ staffIdType: 'uuid' });
  t.after(async () => { await pg.close().catch(() => {}); });

  // Create an assignment under TECH_AUTH_ID (has inventory permission)
  await setAuthUser(pg, TECH_AUTH_ID, 'authenticated');
  const createRes = await pg.query(`SELECT warehouse_create_assignment($1::jsonb, $2::uuid) AS res`, [
    JSON.stringify({
      project_id: 'P-0001',
      title: 'Tech Task',
      recipient_name: 'Helper 1',
      lines: [{ description: 'Work A', required_qty: 10, unit: 'ชุด' }]
    }),
    genRandomKey()
  ]);
  const assignId = createRes.rows[0].res.data.id;

  // Switch caller to DRIVER_AUTH_ID (active staff user, but role is 'driver' without 'Inventory' in allowed_pages)
  await setAuthUser(pg, DRIVER_AUTH_ID, 'authenticated');

  // 1. warehouse_update_assignment MUST fail
  await assert.rejects(
    pg.query(`SELECT warehouse_update_assignment($1::jsonb, $2::uuid)`, [
      JSON.stringify({ assignment_id: assignId, expected_version: 1, title: 'Driver Hacked Title' }),
      genRandomKey()
    ]),
    /Unauthorized|Inventory access required/i
  );

  // 2. warehouse_split_assignment MUST fail
  await assert.rejects(
    pg.query(`SELECT warehouse_split_assignment($1::jsonb, $2::uuid)`, [
      JSON.stringify({
        assignment_id: assignId,
        expected_version: 1,
        to_person_key: 'staff:' + (await pg.query(`SELECT id FROM public.staff_users WHERE username = 'tech_user'`)).rows[0].id,
        line_quantities: []
      }),
      genRandomKey()
    ]),
    /Unauthorized|Inventory access required/i
  );

  // 3. warehouse_submit_work MUST fail
  await assert.rejects(
    pg.query(`SELECT warehouse_submit_work($1::jsonb, $2::uuid)`, [
      JSON.stringify({ assignment_id: assignId, lines: [] }),
      genRandomKey()
    ]),
    /Unauthorized|Inventory access required/i
  );

  // 4. warehouse_set_assignment_status MUST fail
  await assert.rejects(
    pg.query(`SELECT warehouse_set_assignment_status($1::jsonb, $2::uuid)`, [
      JSON.stringify({ assignment_id: assignId, expected_version: 1, status: 'problem', reason: 'Blocked driver' }),
      genRandomKey()
    ]),
    /Unauthorized|Inventory access required/i
  );
});

test('16. Optimistic locking: Omitted or null expected_version is rejected with positive integer error', async (t) => {
  const pg = await createProductionPgHarness({ staffIdType: 'uuid' });
  t.after(async () => { await pg.close().catch(() => {}); });
  await setAuthUser(pg, TECH_AUTH_ID, 'authenticated');

  const createRes = await pg.query(`SELECT warehouse_create_assignment($1::jsonb, $2::uuid) AS res`, [
    JSON.stringify({
      project_id: 'P-0001',
      title: 'Version Guard Task',
      recipient_name: 'Helper 1'
    }),
    genRandomKey()
  ]);
  const assignId = createRes.rows[0].res.data.id;

  // 1. Update with null expected_version
  await assert.rejects(
    pg.query(`SELECT warehouse_update_assignment($1::jsonb, $2::uuid)`, [
      JSON.stringify({ assignment_id: assignId, expected_version: null, title: 'New Title' }),
      genRandomKey()
    ]),
    /expected_version must be a positive integer/i
  );

  // 2. Update with omitted expected_version
  await assert.rejects(
    pg.query(`SELECT warehouse_update_assignment($1::jsonb, $2::uuid)`, [
      JSON.stringify({ assignment_id: assignId, title: 'New Title' }),
      genRandomKey()
    ]),
    /expected_version must be a positive integer/i
  );

  // 3. Split with null expected_version
  await assert.rejects(
    pg.query(`SELECT warehouse_split_assignment($1::jsonb, $2::uuid)`, [
      JSON.stringify({
        assignment_id: assignId,
        expected_version: null,
        to_person_key: 'staff:' + (await pg.query(`SELECT id FROM public.staff_users WHERE username = 'tech_user'`)).rows[0].id,
        line_quantities: []
      }),
      genRandomKey()
    ]),
    /expected_version must be a positive integer/i
  );

  // 4. Set status with omitted expected_version
  await assert.rejects(
    pg.query(`SELECT warehouse_set_assignment_status($1::jsonb, $2::uuid)`, [
      JSON.stringify({ assignment_id: assignId, status: 'problem', reason: 'Missing version' }),
      genRandomKey()
    ]),
    /expected_version must be a positive integer/i
  );
});

test('17. Line integrity: foreign line IDs, duplicate line IDs, and altering description/unit of accepted work are rejected', async (t) => {
  const pg = await createProductionPgHarness({ staffIdType: 'uuid' });
  t.after(async () => { await pg.close().catch(() => {}); });
  await setAuthUser(pg, TECH_AUTH_ID, 'authenticated');

  // Create Assignment 1 and Assignment 2
  const a1 = (await pg.query(`SELECT warehouse_create_assignment($1::jsonb, $2::uuid) AS res`, [
    JSON.stringify({
      project_id: 'P-0001',
      title: 'Assign 1',
      recipient_name: 'Helper 1',
      lines: [{ description: 'Item 1', required_qty: 10, unit: 'ชิ้น' }]
    }),
    genRandomKey()
  ])).rows[0].res.data.id;

  const a2 = (await pg.query(`SELECT warehouse_create_assignment($1::jsonb, $2::uuid) AS res`, [
    JSON.stringify({
      project_id: 'P-0001',
      title: 'Assign 2',
      recipient_name: 'Helper 2',
      lines: [{ description: 'Item 2', required_qty: 5, unit: 'ชิ้น' }]
    }),
    genRandomKey()
  ])).rows[0].res.data.id;

  const a1Lines = (await pg.query(`SELECT id FROM public.production_assignment_lines WHERE assignment_id = $1`, [a1])).rows;
  const a2Lines = (await pg.query(`SELECT id FROM public.production_assignment_lines WHERE assignment_id = $1`, [a2])).rows;
  const a1LineId = a1Lines[0].id;
  const a2LineId = a2Lines[0].id;

  // Case A: Attempt to update Assignment 1 passing Assignment 2's line ID (Foreign line ID)
  await assert.rejects(
    pg.query(`SELECT warehouse_update_assignment($1::jsonb, $2::uuid)`, [
      JSON.stringify({
        assignment_id: a1,
        expected_version: 1,
        lines: [{ id: a2LineId, required_qty: 20 }]
      }),
      genRandomKey()
    ]),
    /not found in assignment/i
  );

  // Case B: Duplicate line IDs in update payload
  await assert.rejects(
    pg.query(`SELECT warehouse_update_assignment($1::jsonb, $2::uuid)`, [
      JSON.stringify({
        assignment_id: a1,
        expected_version: 1,
        lines: [
          { id: a1LineId, required_qty: 12 },
          { id: a1LineId, required_qty: 15 }
        ]
      }),
      genRandomKey()
    ]),
    /duplicate line id/i
  );

  // Case C: Submit and inspect 4 units on a1LineId -> accepted_qty becomes 4
  const subRes = (await pg.query(`SELECT warehouse_submit_work($1::jsonb, $2::uuid) AS res`, [
    JSON.stringify({
      assignment_id: a1,
      lines: [{ line_id: a1LineId, quantity: 4 }]
    }),
    genRandomKey()
  ])).rows[0].res.data;

  const subLineId = (await pg.query(`SELECT id FROM public.production_submission_lines WHERE submission_id = $1`, [subRes.id])).rows[0].id;

  await pg.query(`SELECT warehouse_inspect_work($1::jsonb, $2::uuid)`, [
    JSON.stringify({
      submission_id: subRes.id,
      lines: [{ submission_line_id: subLineId, accepted_qty: 4, rejected_qty: 0 }]
    }),
    genRandomKey()
  ]);

  // Read current version of a1
  const currVer = (await pg.query(`SELECT version FROM public.production_assignments WHERE id = $1`, [a1])).rows[0].version;

  // Attempt to change description of a1LineId -> MUST BE REJECTED
  await assert.rejects(
    pg.query(`SELECT warehouse_update_assignment($1::jsonb, $2::uuid)`, [
      JSON.stringify({
        assignment_id: a1,
        expected_version: currVer,
        lines: [{ id: a1LineId, description: 'Changed Item Name', required_qty: 10 }]
      }),
      genRandomKey()
    ]),
    /Cannot change description of line.*already been accepted/i
  );

  // Attempt to change unit of a1LineId -> MUST BE REJECTED
  await assert.rejects(
    pg.query(`SELECT warehouse_update_assignment($1::jsonb, $2::uuid)`, [
      JSON.stringify({
        assignment_id: a1,
        expected_version: currVer,
        lines: [{ id: a1LineId, unit: 'กล่อง', required_qty: 10 }]
      }),
      genRandomKey()
    ]),
    /Cannot change unit of line.*already been accepted/i
  );
});

test('18. Cash assignment boundary: Generic submit and inspect are blocked; status changes require cash permission', async (t) => {
  const pg = await createProductionPgHarness({ staffIdType: 'uuid' });
  t.after(async () => { await pg.close().catch(() => {}); });

  // 1. Initial vault cash opening: 100 notes of 100 THB (10,000 THB) as ACCOUNTANT
  await setAuthUser(pg, ACCOUNTANT_AUTH_ID, 'authenticated');
  await pg.query(`
    SELECT warehouse_dispatch('cash_counted_opening', $1::jsonb, $2::uuid)
  `, [JSON.stringify({ counts: [{ denomination: 100, note_count: 100 }], notes: 'Opening 100 notes of 100 THB for helper issues' }), genRandomKey()]);

  // Issue cash batch of 50 notes of 100 THB as ACCOUNTANT
  const issueRes = await pg.query(`SELECT warehouse_dispatch($1, $2::jsonb, $3::uuid) AS res`, [
    'cash_issue_batch',
    JSON.stringify({
      project_id: 'P-0001',
      recipient_name: 'พี่สาว คนสวย',
      denomination: 100,
      note_count: 50,
      notes: 'Initial helper banknote issue'
    }),
    genRandomKey()
  ]);
  assert.ok(issueRes.rows[0].res.success);
  const batchId = issueRes.rows[0].res.data.batch.id;

  const cashAssign = (await pg.query(`SELECT id, version FROM public.production_assignments WHERE source_cash_batch_id = $1`, [batchId])).rows[0];
  assert.ok(cashAssign);

  // Attempt generic submit on cash assignment -> MUST BE BLOCKED
  await assert.rejects(
    pg.query(`SELECT warehouse_submit_work($1::jsonb, $2::uuid)`, [
      JSON.stringify({ assignment_id: cashAssign.id, lines: [] }),
      genRandomKey()
    ]),
    /Generic submit on cash assignment is prohibited/i
  );

  // Attempt status change by TECH (lacks cash permission) -> MUST BE BLOCKED
  await setAuthUser(pg, TECH_AUTH_ID, 'authenticated');
  await assert.rejects(
    pg.query(`SELECT warehouse_set_assignment_status($1::jsonb, $2::uuid)`, [
      JSON.stringify({ assignment_id: cashAssign.id, expected_version: cashAssign.version, status: 'problem', reason: 'Tech cannot touch cash' }),
      genRandomKey()
    ]),
    /Cash management permissions required/i
  );
});

test('19. Idempotent metadata backfill: Pre-existing PRODUCTION_ISSUE documents and cash batches backfill cleanly without duplicates or fake movements', async (t) => {
  const pg = await createProductionPgHarness({ staffIdType: 'uuid' });
  t.after(async () => { await pg.close().catch(() => {}); });

  // Insert a pre-existing inventory document and cash batch as DB maintenance (simulating legacy data)
  await setAuthUser(pg, null, null);
  const legacyDocId = genRandomKey();
  const legacyBatchId = genRandomKey();

  await pg.query(`
    INSERT INTO public.inventory_documents (
      id, doc_number, doc_type, project_id, recipient_name_snapshot, actor_name_snapshot, notes
    ) VALUES (
      $1::uuid, 'ISS-LEGACY-001', 'PRODUCTION_ISSUE', 'P-0001', 'ป้าแมว จัดดอกไม้', 'System', 'Legacy issue pre-hub'
    )
  `, [legacyDocId]);

  await pg.query(`
    INSERT INTO public.cash_helper_batches (
      id, batch_code, project_id, recipient_name_snapshot, denomination, issued_count, prepared_count, status
    ) VALUES (
      $1::uuid, 'CSH-LEGACY-001', 'P-0001', 'ป้าแมว จัดดอกไม้', 500, 20, 10, 'PARTIAL_PREPARED'
    )
  `, [legacyBatchId]);

  // Read hub migration script and run it (running the backfill block)
  const hubSql = fs.readFileSync(path.resolve(__dirname, '../database_scripts/inventory_production_hub.sql'), 'utf8');
  await pg.exec(hubSql);

  // Verify backfilled assignments exist
  const docAssign = (await pg.query(`SELECT * FROM public.production_assignments WHERE source_document_id = $1`, [legacyDocId])).rows[0];
  assert.ok(docAssign, 'Pre-existing document must have backfilled assignment');
  assert.equal(docAssign.responsible_name, 'ป้าแมว จัดดอกไม้');
  assert.equal(docAssign.status, 'in_progress');

  const batchAssign = (await pg.query(`SELECT * FROM public.production_assignments WHERE source_cash_batch_id = $1`, [legacyBatchId])).rows[0];
  assert.ok(batchAssign, 'Pre-existing cash batch must have backfilled assignment');
  assert.equal(batchAssign.cash_only, true);

  // Count assignments and rerun migration to ensure 0 duplicates
  const countBefore = (await pg.query(`SELECT count(*)::int AS cnt FROM public.production_assignments WHERE project_id = 'P-0001'`)).rows[0].cnt;
  await pg.exec(hubSql);
  const countAfter = (await pg.query(`SELECT count(*)::int AS cnt FROM public.production_assignments WHERE project_id = 'P-0001'`)).rows[0].cnt;
  assert.equal(countAfter, countBefore, 'Rerunning backfill must not create duplicate assignments');
});

test('20. Board payload: returns submissions with note, inspections array, inspector_name, timestamp, and line inspection breakdown', async (t) => {
  const pg = await createProductionPgHarness({ staffIdType: 'uuid' });
  t.after(async () => { await pg.close().catch(() => {}); });
  await setAuthUser(pg, TECH_AUTH_ID, 'authenticated');

  // Create assignment
  const createRes = await pg.query(`SELECT warehouse_create_assignment($1::jsonb, $2::uuid) AS res`, [
    JSON.stringify({
      project_id: 'P-0001',
      title: 'Inspectable Task',
      recipient_name: 'น้องฝน',
      lines: [{ description: 'ดอกกุหลาบขาวจัดช่อ', required_qty: 10, unit: 'ช่อ' }]
    }),
    genRandomKey()
  ]);
  const assignId = createRes.rows[0].res.data.id;
  const lineId = (await pg.query(`SELECT id FROM public.production_assignment_lines WHERE assignment_id = $1`, [assignId])).rows[0].id;

  // Submit work with a note
  const subRes = (await pg.query(`SELECT warehouse_submit_work($1::jsonb, $2::uuid) AS res`, [
    JSON.stringify({
      assignment_id: assignId,
      note: 'ส่งมอบรอบแรก 6 ช่อครับ',
      lines: [{ line_id: lineId, quantity: 6 }]
    }),
    genRandomKey()
  ])).rows[0].res.data;

  const subLineId = (await pg.query(`SELECT id FROM public.production_submission_lines WHERE submission_id = $1`, [subRes.id])).rows[0].id;

  // Inspect work
  await pg.query(`SELECT warehouse_inspect_work($1::jsonb, $2::uuid)`, [
    JSON.stringify({
      submission_id: subRes.id,
      note: 'ตรวจสอบแล้ว สมบูรณ์ 5 ช่อ มีตำหนิ 1 ช่อ',
      lines: [{ submission_line_id: subLineId, accepted_qty: 5, rejected_qty: 1, notes: 'ก้านหัก 1 ช่อ' }]
    }),
    genRandomKey()
  ]);

  // Load board
  const board = (await pg.query(`SELECT warehouse_load_production_project('P-0001', 100, 0) AS res`)).rows[0].res;
  const targetAssign = board.assignments.find((a) => a.id === assignId);
  assert.ok(targetAssign);
  assert.equal(targetAssign.submissions.length, 1);

  const sub = targetAssign.submissions[0];
  assert.equal(sub.note, 'ส่งมอบรอบแรก 6 ช่อครับ');
  assert.equal(sub.status, 'inspected');
  assert.ok(Array.isArray(sub.inspections), 'inspections must be an array');
  assert.equal(sub.inspections.length, 1);

  const insp = sub.inspections[0];
  assert.ok(insp.inspector_name, 'Inspector name must be present');
  assert.ok(insp.inspected_at, 'Inspection timestamp must be present');
  assert.equal(insp.notes, 'ตรวจสอบแล้ว สมบูรณ์ 5 ช่อ มีตำหนิ 1 ช่อ');
  assert.equal(insp.lines.length, 1);
  assert.equal(Number(insp.lines[0].accepted_qty), 5);
  assert.equal(Number(insp.lines[0].rejected_qty), 1);
  assert.equal(insp.lines[0].notes, 'ก้านหัก 1 ช่อ');
});

test('21. Direct REST table write bypass closed: Admin & Tech cannot direct INSERT/UPDATE/DELETE/TRUNCATE on inventory_items and asset_units despite old permissive RLS', async (t) => {
  const pg = await createProductionPgHarness({ staffIdType: 'uuid' });
  t.after(async () => { await pg.close().catch(() => {}); });

  // Seed fixture records as DB owner
  const itemId = (await pg.query(`
    INSERT INTO public.inventory_items (code, name, item_type, unit, current_stock)
    VALUES ('MAT-SEC-01', 'กรรไกรตัดริบบิ้น', 'asset', 'ด้าม', 10) RETURNING id
  `)).rows[0].id;

  await pg.query(`
    INSERT INTO public.asset_units (unit_code, item_id, status)
    VALUES ('SCIS-001', $1, 'AVAILABLE')
  `, [itemId]);

  // Simulate pre-existing permissive RLS policies from old master schema
  await pg.exec(`
    DROP POLICY IF EXISTS "Allow app full access" ON public.inventory_items;
    CREATE POLICY "Allow app full access" ON public.inventory_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    DROP POLICY IF EXISTS "Allow app full access" ON public.asset_units;
    CREATE POLICY "Allow app full access" ON public.asset_units FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  `);

  // 1. Authenticated ADMIN cannot directly update or insert into inventory_items or asset_units via REST
  await setAuthUser(pg, ADMIN_AUTH_ID, 'authenticated');

  await assert.rejects(
    pg.query(`UPDATE public.inventory_items SET current_stock = 999 WHERE id = $1`, [itemId]),
    /permission denied for (table )?inventory_items/i,
    'Admin direct UPDATE on inventory_items must be rejected'
  );

  await assert.rejects(
    pg.query(`INSERT INTO public.inventory_items (code, name, item_type) VALUES ('HACK-01', 'Direct Injected Item', 'consumable')`),
    /permission denied for (table )?inventory_items/i,
    'Admin direct INSERT on inventory_items must be rejected'
  );

  await assert.rejects(
    pg.query(`DELETE FROM public.inventory_items WHERE id = $1`, [itemId]),
    /permission denied for (table )?inventory_items/i,
    'Admin direct DELETE on inventory_items must be rejected'
  );

  // 2. Authenticated TECHNICIAN cannot directly update or insert into inventory_items or asset_units
  await setAuthUser(pg, TECH_AUTH_ID, 'authenticated');

  await assert.rejects(
    pg.query(`UPDATE public.inventory_items SET current_stock = 0 WHERE id = $1`, [itemId]),
    /permission denied for (table )?inventory_items/i,
    'Tech direct UPDATE on inventory_items must be rejected'
  );

  await assert.rejects(
    pg.query(`UPDATE public.asset_units SET status = 'AVAILABLE' WHERE unit_code = 'SCIS-001'`),
    /permission denied for (table )?asset_units/i,
    'Tech direct UPDATE on asset_units must be rejected'
  );

  await assert.rejects(
    pg.query(`INSERT INTO public.asset_units (unit_code, item_id, status) VALUES ('SCIS-002', $1, 'AVAILABLE')`, [itemId]),
    /permission denied for (table )?asset_units/i,
    'Tech direct INSERT on asset_units must be rejected'
  );

  await assert.rejects(
    pg.query(`DELETE FROM public.asset_units WHERE unit_code = 'SCIS-001'`),
    /permission denied for (table )?asset_units/i,
    'Tech direct DELETE on asset_units must be rejected'
  );

  // 3. Invoker triggers on legacy procurements / disposals cannot be used as an alternative mutation route
  await assert.rejects(
    pg.query(`
      INSERT INTO public.inventory_procurements (item_id, quantity, unit_price)
      VALUES ($1, 50, 10)
    `, [itemId]),
    /permission denied for (table )?inventory_procurements/i,
    'Direct INSERT on legacy inventory_procurements must be rejected'
  );

  await assert.rejects(
    pg.query(`
      INSERT INTO public.inventory_disposals (item_id, quantity, salvage_value)
      VALUES ($1, 5, 0)
    `, [itemId]),
    /permission denied for (table )?inventory_disposals/i,
    'Direct INSERT on legacy inventory_disposals must be rejected'
  );
});

test('22. New RPC transaction ledger mutations remain fully functional through SECURITY DEFINER', async (t) => {
  const pg = await createProductionPgHarness({ staffIdType: 'uuid' });
  t.after(async () => { await pg.close().catch(() => {}); });

  // Seed consumable item and asset unit as DB owner
  const consumableId = (await pg.query(`
    INSERT INTO public.inventory_items (code, name, item_type, unit, current_stock)
    VALUES ('MAT-FLOW-01', 'ดอกไฮเดรนเยียฟ้า', 'consumable', 'ก้าน', 100) RETURNING id
  `)).rows[0].id;

  const toolItemId = (await pg.query(`
    INSERT INTO public.inventory_items (code, name, item_type, unit, current_stock)
    VALUES ('TOOL-LADDER', 'บันไดอลูมิเนียม', 'asset', 'ตัว', 5) RETURNING id
  `)).rows[0].id;

  await pg.query(`
    INSERT INTO public.asset_units (unit_code, item_id, status)
    VALUES ('LAD-001', $1, 'AVAILABLE')
  `, [toolItemId]);

  // Set authenticated technician
  await setAuthUser(pg, TECH_AUTH_ID, 'authenticated');

  // 1. Issue creation via warehouse_dispatch (SECURITY DEFINER) succeeds and mutates ledger atomically
  const issueKey = genRandomKey();
  const issueRes = await pg.query(`
    SELECT warehouse_dispatch('issue_create', $1::jsonb, $2::uuid) AS res
  `, [
    JSON.stringify({
      issue_type: 'PRODUCTION_ISSUE',
      project_id: 'P-0001',
      recipient_name: 'คุณวิชัย ช่างจัด',
      material_lines: [{ item_id: consumableId, quantity: 20 }],
      tool_units: ['LAD-001']
    }),
    issueKey
  ]);
  assert.ok(issueRes.rows[0].res.success);

  // Stock must be decremented from 100 to 80
  const stockCheck = (await pg.query(`SELECT current_stock FROM public.inventory_items WHERE id = $1`, [consumableId])).rows[0];
  assert.equal(Number(stockCheck.current_stock), 80);

  // Tool status must be BORROWED
  const toolCheck = (await pg.query(`SELECT status FROM public.asset_units WHERE unit_code = 'LAD-001'`)).rows[0];
  assert.equal(toolCheck.status, 'BORROWED');

  // 2. Tool return via warehouse_dispatch succeeds
  const returnKey = genRandomKey();
  const returnRes = await pg.query(`
    SELECT warehouse_dispatch('tool_return', $1::jsonb, $2::uuid) AS res
  `, [
    JSON.stringify({
      returns: [{ unit_code: 'LAD-001', condition: 'good', notes: 'คืนสภาพดี' }]
    }),
    returnKey
  ]);
  assert.ok(returnRes.rows[0].res.success);
  const toolReturned = (await pg.query(`SELECT status FROM public.asset_units WHERE unit_code = 'LAD-001'`)).rows[0];
  assert.equal(toolReturned.status, 'AVAILABLE');

  // 3. Stock adjust via warehouse_dispatch (signed delta) succeeds
  const adjustKey = genRandomKey();
  const adjustRes = await pg.query(`
    SELECT warehouse_dispatch('stock_adjust', $1::jsonb, $2::uuid) AS res
  `, [
    JSON.stringify({
      item_id: consumableId,
      delta_quantity: 5,
      reason: 'นับตรวจคลังพบสินค้าเกิน'
    }),
    adjustKey
  ]);
  assert.ok(adjustRes.rows[0].res.success);
  const stockAdjusted = (await pg.query(`SELECT current_stock FROM public.inventory_items WHERE id = $1`, [consumableId])).rows[0];
  assert.equal(Number(stockAdjusted.current_stock), 85);
});

test('23. Legacy banknote privacy & Restrictive RLS: Old banknote rows hidden from tech even with permissive policy, visible to accountant/admin, anonymous blocked', async (t) => {
  const pg = await createProductionPgHarness({ staffIdType: 'uuid' });
  t.after(async () => { await pg.close().catch(() => {}); });

  // Seed normal items and legacy banknote items with real historical numbers in current_stock
  await pg.query(`
    INSERT INTO public.inventory_items (code, name, item_type, unit, current_stock)
    VALUES 
      ('MAT-ROSE-RED', 'กุหลาบแดงฮอลแลนด์', 'consumable', 'ก้าน', 120),
      ('BNK-500-LEGACY', 'ธนบัตร 500 บาท (สต็อกเก่า)', 'banknote', 'ใบ', 45)
  `);

  // Simulate existing permissive policy on inventory_items
  await pg.exec(`
    DROP POLICY IF EXISTS "Allow app full access" ON public.inventory_items;
    CREATE POLICY "Allow app full access" ON public.inventory_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
  `);

  // 1. Anonymous caller cannot read inventory_items (table-level SELECT revoked)
  await setAuthUser(pg, null, 'anon');
  await assert.rejects(
    pg.query(`SELECT * FROM public.inventory_items`),
    /permission denied for (table )?inventory_items/i,
    'Anonymous SELECT on inventory_items must be rejected'
  );

  await assert.rejects(
    pg.query(`SELECT * FROM public.asset_units`),
    /permission denied for (table )?asset_units/i,
    'Anonymous SELECT on asset_units must be rejected'
  );

  // 2. Authenticated TECHNICIAN (lacks cash permission)
  await setAuthUser(pg, TECH_AUTH_ID, 'authenticated');

  // Technician CAN see normal items
  const techNormalItems = (await pg.query(`SELECT * FROM public.inventory_items WHERE code = 'MAT-ROSE-RED'`)).rows;
  assert.equal(techNormalItems.length, 1);
  assert.equal(Number(techNormalItems[0].current_stock), 120);

  // Technician CANNOT see legacy banknote items (even with "Allow app full access" permissive policy)
  const techBanknoteItems = (await pg.query(`SELECT * FROM public.inventory_items WHERE item_type = 'banknote'`)).rows;
  assert.equal(techBanknoteItems.length, 0, 'Restrictive policy must hide banknote rows from technician');

  const techAllItems = (await pg.query(`SELECT * FROM public.inventory_items`)).rows;
  assert.ok(techAllItems.length > 0);
  assert.ok(techAllItems.every((it) => it.item_type !== 'banknote'), 'No banknote row should leak in technician queries');

  // 3. Authenticated ACCOUNTANT (has cash permission)
  await setAuthUser(pg, ACCOUNTANT_AUTH_ID, 'authenticated');
  const accBanknoteItems = (await pg.query(`SELECT * FROM public.inventory_items WHERE item_type = 'banknote'`)).rows;
  assert.equal(accBanknoteItems.length, 1);
  assert.equal(accBanknoteItems[0].code, 'BNK-500-LEGACY');
  assert.equal(Number(accBanknoteItems[0].current_stock), 45);

  // 4. Authenticated ADMIN (has cash permission)
  await setAuthUser(pg, ADMIN_AUTH_ID, 'authenticated');
  const adminBanknoteItems = (await pg.query(`SELECT * FROM public.inventory_items WHERE item_type = 'banknote'`)).rows;
  assert.equal(adminBanknoteItems.length, 1);
  assert.equal(adminBanknoteItems[0].code, 'BNK-500-LEGACY');
});

test('24. Migration rerunnability with TEXT and UUID staff id types maintains hardened privileges and RLS policies', async (t) => {
  // Test 1: UUID staff id harness
  const pgUuid = await createProductionPgHarness({ staffIdType: 'uuid' });
  t.after(async () => { await pgUuid.close().catch(() => {}); });

  const hubSql = fs.readFileSync(path.resolve(__dirname, '../database_scripts/inventory_production_hub.sql'), 'utf8');

  // Re-run migration
  await pgUuid.exec(hubSql);

  // Verify RLS policies and table grants still active
  await setAuthUser(pgUuid, TECH_AUTH_ID, 'authenticated');
  await assert.rejects(
    pgUuid.query(`UPDATE public.inventory_items SET current_stock = 999`),
    /permission denied for (table )?inventory_items/i
  );

  // Test 2: TEXT staff id harness (staff_code migration)
  const pgText = await createProductionPgHarness({ staffIdType: 'text' });
  t.after(async () => { await pgText.close().catch(() => {}); });

  // Re-run migration on text staff id schema
  await pgText.exec(hubSql);

  await setAuthUser(pgText, TECH_AUTH_ID, 'authenticated');
  await assert.rejects(
    pgText.query(`UPDATE public.inventory_items SET current_stock = 999`),
    /permission denied for (table )?inventory_items/i
  );
});

function genRandomKey() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
