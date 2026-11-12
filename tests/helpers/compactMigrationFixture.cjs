const fs = require('node:fs');
const path = require('node:path');
const { createProductionPgHarness, setAuthUser, ADMIN_AUTH_ID, TECH_AUTH_ID } = require('./productionFixture.cjs');

async function seedRealisticLegacyData(pg) {
  // 1. Projects and Items
  await pg.exec(`
    INSERT INTO public.projects (id, name)
    VALUES 
      ('P-101', 'Grand Floral Gala'),
      ('P-102', 'Summer Blossom Exhibition')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.inventory_categories (id, name, type)
    VALUES 
      ('c0000001-0000-4000-8000-000000000001', 'ดอกไม้สด', 'consumable'),
      ('c0000001-0000-4000-8000-000000000002', 'เครื่องมือช่าง', 'asset'),
      ('c0000001-0000-4000-8000-000000000003', 'โครงสร้างและเสา', 'reusable_material')
    ON CONFLICT (name) DO NOTHING;

    INSERT INTO public.inventory_items (id, code, name, category_id, item_type, unit, current_stock)
    VALUES 
      ('b0000001-0000-4000-8000-000000000001', 'FLW-ROSE', 'กุหลาบแดงฮอลแลนด์', 'c0000001-0000-4000-8000-000000000001', 'consumable', 'ดอก', 500),
      ('b0000001-0000-4000-8000-000000000002', 'FLW-LILY', 'ลิลลี่ขาว', 'c0000001-0000-4000-8000-000000000001', 'consumable', 'กิ่ง', 200),
      ('b0000001-0000-4000-8000-000000000003', 'TOOL-DRL', 'สว่านไร้สาย Makita 18V', 'c0000001-0000-4000-8000-000000000002', 'asset', 'ตัว', 5),
      ('b0000001-0000-4000-8000-000000000004', 'TOOL-CUT', 'คีมตัดกิ่ง Solo', 'c0000001-0000-4000-8000-000000000002', 'asset', 'อัน', 10),
      ('b0000001-0000-4000-8000-000000000005', 'STR-ARCH', 'ซุ้มเหล็กโค้ง 2.4m', 'c0000001-0000-4000-8000-000000000003', 'reusable', 'ชุด', 4)
    ON CONFLICT (code) DO NOTHING;

    -- Asset Units
    INSERT INTO public.asset_units (unit_code, item_id, status)
    VALUES 
      ('DRL-01', 'b0000001-0000-4000-8000-000000000003', 'AVAILABLE'),
      ('DRL-02', 'b0000001-0000-4000-8000-000000000003', 'AVAILABLE'),
      ('CUT-01', 'b0000001-0000-4000-8000-000000000004', 'AVAILABLE'),
      ('CUT-02', 'b0000001-0000-4000-8000-000000000004', 'AVAILABLE'),
      ('CUT-03', 'b0000001-0000-4000-8000-000000000004', 'AVAILABLE')
    ON CONFLICT (unit_code) DO NOTHING;

    -- Recipients & Teams
    INSERT INTO public.inventory_recipients (id, name, recipient_type, is_active)
    VALUES 
      ('a0000001-0000-4000-8000-000000000001', 'ช่างสมหมาย ดอกไม้เอก', 'individual', true),
      ('a0000001-0000-4000-8000-000000000002', 'ทีมประกอบฉาก A', 'team', true),
      ('a0000001-0000-4000-8000-000000000003', 'น้องมุก ผู้ช่วยพิเศษ', 'casual_helper', true)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.inventory_recipient_teams (id, team_recipient_id, primary_recipient_id, primary_receiver_name, member_names, is_active)
    VALUES 
      ('a0000001-0000-4000-8000-000000000010', 'a0000001-0000-4000-8000-000000000002', 'a0000001-0000-4000-8000-000000000001', 'ช่างสมหมาย ดอกไม้เอก', ARRAY['ช่างสมหมาย', 'น้องต้น', 'น้องจอย'], true)
    ON CONFLICT (id) DO NOTHING;
  `);

  // 2. Existing inventory_documents & movements
  await pg.exec(`
    INSERT INTO public.inventory_documents (id, doc_number, doc_type, project_id, recipient_id, recipient_name_snapshot, status, idempotency_key, idempotency_payload_hash)
    VALUES 
      ('d0000001-0000-4000-8000-000000000001', 'DOC-ISSUE-001', 'PRODUCTION_ISSUE', 'P-101', 'a0000001-0000-4000-8000-000000000001', 'ช่างสมหมาย ดอกไม้เอก', 'COMPLETED', '11111111-2222-4000-8000-000000000001', 'hash-issue-001')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.inventory_movements (id, document_id, item_id, movement_type, quantity, delta_stock, actor_name_snapshot)
    VALUES 
      ('e0000001-0000-4000-8000-000000000001', 'd0000001-0000-4000-8000-000000000001', 'b0000001-0000-4000-8000-000000000001', 'ISSUE', 100, -100, 'Admin Person')
    ON CONFLICT (id) DO NOTHING;
  `);

  // 3. Field rounds, FIELD_ISSUE doc referencing round_id, and 15 round projects
  await pg.exec(`
    INSERT INTO public.inventory_field_rounds (id, round_code, title, recipient_id, recipient_name_snapshot, status)
    VALUES 
      ('f0000001-0000-4000-8000-000000000001', 'RND-2026-001', 'รอบส่งของงานแต่งเช้า', 'a0000001-0000-4000-8000-000000000001', 'ช่างสมหมาย ดอกไม้เอก', 'IN_PROGRESS')
    ON CONFLICT (id) DO NOTHING;

    -- Existing FIELD_ISSUE with non-null round_id pointing to inventory_field_rounds BEFORE migration
    INSERT INTO public.inventory_documents (id, doc_number, doc_type, project_id, round_id, recipient_id, recipient_name_snapshot, status)
    VALUES 
      ('d0000001-0000-4000-8000-000000000002', 'DOC-FIELD-001', 'FIELD_ISSUE', 'P-101', 'f0000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000001', 'ช่างสมหมาย ดอกไม้เอก', 'COMPLETED')
    ON CONFLICT (id) DO NOTHING;
  `);

  // Seed 15 round project links
  for (let p = 1; p <= 15; p++) {
    const pId = `P-RND-${String(p).padStart(2, '0')}`;
    await pg.exec(`
      INSERT INTO public.projects (id, name) VALUES ('${pId}', 'Project Round Target ${p}') ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.inventory_field_round_projects (round_id, project_id, sort_order)
      VALUES ('f0000001-0000-4000-8000-000000000001', '${pId}', ${p})
      ON CONFLICT (round_id, project_id) DO NOTHING;
    `);
  }

  // 4. Material recovery & Tool custody
  await pg.exec(`
    INSERT INTO public.inventory_material_recoveries (id, document_id, item_id, source_issue_movement_id, recovered_qty, inspected_good_qty, inspected_damaged_qty, status)
    VALUES 
      ('d0000001-0000-4000-8000-000000000020', 'd0000001-0000-4000-8000-000000000001', 'b0000001-0000-4000-8000-000000000001', 'e0000001-0000-4000-8000-000000000001', 20, 15, 5, 'INSPECTED')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.asset_unit_custody (id, unit_code, document_id, project_id, recipient_id, recipient_name_snapshot, is_active, due_date, return_status)
    VALUES 
      ('c0000002-0000-4000-8000-000000000001', 'DRL-01', 'd0000001-0000-4000-8000-000000000001', 'P-101', 'a0000001-0000-4000-8000-000000000001', 'ช่างสมหมาย ดอกไม้เอก', true, timezone('utc'::text, now() + interval '3 days'), NULL),
      ('c0000002-0000-4000-8000-000000000002', 'CUT-01', 'd0000001-0000-4000-8000-000000000001', 'P-101', 'a0000001-0000-4000-8000-000000000001', 'ช่างสมหมาย ดอกไม้เอก', false, timezone('utc'::text, now()), 'AVAILABLE')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.inventory_incidents (id, unit_code, incident_type, document_id, responsible_recipient_id, recipient_name_snapshot, resolution_status, notes)
    VALUES 
      ('d0000001-0000-4000-8000-000000000030', 'CUT-01', 'BROKEN', 'd0000001-0000-4000-8000-000000000001', 'a0000001-0000-4000-8000-000000000001', 'ช่างสมหมาย ดอกไม้เอก', 'OPEN', 'สปริงคีมหักขณะใช้งาน')
    ON CONFLICT (id) DO NOTHING;
  `);

  // 5. Cash vault, Reservations, Batches, Prepared sets, Movements
  await pg.exec(`
    UPDATE public.cash_vault_denominations 
    SET physical_count = 500, reserved_count = 100, is_initialized = true 
    WHERE denomination = 100;

    UPDATE public.cash_vault_denominations 
    SET physical_count = 200, reserved_count = 40, is_initialized = true 
    WHERE denomination = 500;

    INSERT INTO public.cash_job_reservations (id, project_id, denomination, reserved_count)
    VALUES 
      ('c0000003-0000-4000-8000-000000000001', 'P-101', 100, 100),
      ('c0000003-0000-4000-8000-000000000002', 'P-101', 500, 40)
    ON CONFLICT (project_id, denomination) DO NOTHING;

    INSERT INTO public.cash_helper_batches (id, batch_code, project_id, recipient_id, recipient_name_snapshot, denomination, issued_count, prepared_count, returned_raw_count, handed_over_count, status)
    VALUES 
      ('c0000004-0000-4000-8000-000000000001', 'CB-2611-0001', 'P-101', 'a0000001-0000-4000-8000-000000000003', 'น้องมุก ผู้ช่วยพิเศษ', 100, 50, 40, 10, 40, 'HANDED_OVER')
    ON CONFLICT (batch_code) DO NOTHING;

    INSERT INTO public.cash_prepared_sets (id, project_id, denomination, prepared_count, delivered_count)
    VALUES 
      ('c0000005-0000-4000-8000-000000000001', 'P-101', 100, 40, 20)
    ON CONFLICT (project_id, denomination) DO NOTHING;

    INSERT INTO public.cash_movements (id, action_type, project_id, batch_id, denomination, note_count, from_location, to_location, actor_name_snapshot)
    VALUES 
      ('c0000006-0000-4000-8000-000000000001', 'ISSUE_HELPER_BATCH', 'P-101', 'c0000004-0000-4000-8000-000000000001', 100, 50, 'MAIN_VAULT', 'HELPER_POCKET', 'Admin Person')
    ON CONFLICT (id) DO NOTHING;
  `);

  // 6. Idempotency records
  await pg.exec(`
    INSERT INTO public.inventory_idempotency_records (idempotency_key, actor_auth_user_id, action_name, payload_hash, response_payload)
    VALUES 
      ('11111111-2222-4000-8000-000000000001', '${ADMIN_AUTH_ID}', 'warehouse_issue_stock', 'hash-issue-001', '{"success": true, "doc_id": "d0000001-0000-4000-8000-000000000001"}'::jsonb),
      ('11111111-2222-4000-8000-000000000002', '${ADMIN_AUTH_ID}', 'warehouse_audit_check', 'hash-cmd-002', '{"cached": true, "status": "ok"}'::jsonb)
    ON CONFLICT (idempotency_key) DO NOTHING;
  `);

  // 7. 10 Helper Work assignments with submissions and inspections
  for (let i = 1; i <= 10; i++) {
    const pad = String(i).padStart(4, '0');
    const aId = `a0000000-0000-4000-8000-${pad}00000001`;
    const lineId = `b0000000-0000-4000-8000-${pad}00000001`;
    const subId = `c0000000-0000-4000-8000-${pad}00000001`;
    const subLineId = `d0000000-0000-4000-8000-${pad}00000001`;
    const inspId = `e0000000-0000-4000-8000-${pad}00000001`;
    const inspLineId = `f0000000-0000-4000-8000-${pad}00000001`;
    const evtId = `10000000-0000-4000-8000-${pad}00000001`;

    await pg.exec(`
      INSERT INTO public.production_assignments (
        id, project_id, recipient_id, responsible_name, title, status, version
      )
      VALUES (
        '${aId}', 'P-101', 'a0000001-0000-4000-8000-000000000003', 'น้องมุก ผู้ช่วยพิเศษ', 'งานจัดช่อดอกไม้โต๊ะ VIP #${i}', 'in_progress', 1
      ) ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.production_assignment_lines (
        id, assignment_id, description, required_qty, submitted_qty, accepted_qty, rejected_qty, pending_qty
      )
      VALUES (
        '${lineId}', '${aId}', 'ช่อโต๊ะ VIP แบบหรูหรา', 10, 5, 4, 1, 0
      ) ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.production_submissions (
        id, assignment_id, submitted_by_name, status
      )
      VALUES (
        '${subId}', '${aId}', 'น้องมุก ผู้ช่วยพิเศษ', 'inspected'
      ) ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.production_submission_lines (
        id, submission_id, line_id, quantity, accepted_qty, rejected_qty
      )
      VALUES (
        '${subLineId}', '${subId}', '${lineId}', 5, 4, 1
      ) ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.production_inspections (
        id, submission_id, inspector_name, notes
      )
      VALUES (
        '${inspId}', '${subId}', 'ช่างสมหมาย ดอกไม้เอก', 'ผ่าน 4 ช่อ อีก 1 ช่อดอกเหี่ยว'
      ) ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.production_inspection_lines (
        id, inspection_id, submission_line_id, accepted_qty, rejected_qty
      )
      VALUES (
        '${inspLineId}', '${inspId}', '${subLineId}', 4, 1
      ) ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.production_assignment_events (
        id, assignment_id, event_type, actor_name, from_status, to_status, reason
      )
      VALUES (
        '${evtId}', '${aId}', 'status_changed', 'ช่างสมหมาย ดอกไม้เอก', 'in_progress', 'submitted', 'ส่งตรวจรอบที่ 1'
      ) ON CONFLICT (id) DO NOTHING;
    `);
  }

  // 8. Legacy tables (asset_loans, inventory_procurements, inventory_disposals, project_checklist_items)
  await pg.exec(`
    CREATE TABLE IF NOT EXISTS public.asset_loans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
      project_id TEXT REFERENCES public.projects(id) ON DELETE SET NULL,
      borrower_name TEXT NOT NULL,
      borrower_user_id UUID,
      borrowed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
      expected_return_at TIMESTAMPTZ,
      actual_returned_at TIMESTAMPTZ,
      condition_out TEXT DEFAULT 'good',
      condition_in TEXT,
      status TEXT NOT NULL DEFAULT 'borrowed',
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
    );

    CREATE TABLE IF NOT EXISTS public.project_checklist_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
      item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
      category_name TEXT,
      item_name TEXT NOT NULL,
      item_type TEXT NOT NULL,
      required_qty NUMERIC(10,2) NOT NULL DEFAULT 1,
      unit TEXT DEFAULT 'ชิ้น',
      picked_qty NUMERIC(10,2) DEFAULT 0,
      returned_qty NUMERIC(10,2) DEFAULT 0,
      damaged_qty NUMERIC(10,2) DEFAULT 0,
      unit_cost NUMERIC(10,2) DEFAULT 0,
      assigned_codes JSONB DEFAULT '[]'::jsonb,
      is_checked BOOLEAN DEFAULT FALSE,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
      updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
    );

    INSERT INTO public.asset_loans (id, item_id, project_id, borrower_name, status, notes)
    VALUES 
      ('a0000002-0000-4000-8000-000000000001', 'b0000001-0000-4000-8000-000000000003', 'P-101', 'ช่างสมหมาย ดอกไม้เอก', 'borrowed', 'ยืมสว่านรุ่นเก่า')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.inventory_procurements (id, item_id, quantity, unit_price, procurement_code)
    VALUES 
      ('a0000003-0000-4000-8000-000000000001', 'b0000001-0000-4000-8000-000000000001', 200, 25.50, 'PRC-2611-0001')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.inventory_disposals (id, item_id, quantity, disposal_code, salvage_value, financial_loss)
    VALUES 
      ('a0000004-0000-4000-8000-000000000001', 'b0000001-0000-4000-8000-000000000001', 15, 'DSP-2611-0001', 0, 375.00)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.project_checklist_items (id, project_id, item_id, item_name, item_type, required_qty, picked_qty)
    VALUES 
      ('a0000005-0000-4000-8000-000000000001', 'P-101', 'b0000001-0000-4000-8000-000000000001', 'กุหลาบแดงฮอลแลนด์', 'consumable', 100, 100),
      ('a0000005-0000-4000-8000-000000000002', 'P-101', 'b0000001-0000-4000-8000-000000000003', 'สว่านไร้สาย Makita 18V', 'asset', 2, 2)
    ON CONFLICT (id) DO NOTHING;
  `);
}

async function runCompactMigration(pg) {
  const sqlPath = path.resolve(__dirname, '../../database_scripts/drafts/compact_schema.sql.part');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  try {
    await pg.exec(`
      BEGIN;
      SELECT set_config('flower.compact_build', 'v2', false);
      ${sql}
      COMMIT;
    `);
  } catch (err) {
    await pg.exec('ROLLBACK;').catch(() => {});
    throw err;
  }
}

module.exports = {
  seedRealisticLegacyData,
  runCompactMigration
};
