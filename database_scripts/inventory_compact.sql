-- Flower2U compact inventory v2. Run this complete file in Supabase SQL Editor.
-- Replaces inventory_plan_c.sql and inventory_production_hub.sql; do not run them afterward.
-- Existing inventory/cash/history is validated before the old tables are retired.
BEGIN;
SELECT set_config('flower.compact_build','v2',true);
-- ==============================================================================
-- FLOWER2U COMPACT SCHEMA & LOSSLESS MIGRATION PART (v2)
-- Owned file: database_scripts/drafts/compact_schema.sql.part
-- Establishes canonical 8 inventory tables, migrates all 22 legacy/hub/plan-c
-- tables losslessly, validates ID coverage & invariants, and retires legacy tables.
-- ==============================================================================

-- 1. FAIL-CLOSED GUARD
-- Must be executed inside an assembly transaction configured with flower.compact_build = 'v2'
DO $$
BEGIN
  IF current_setting('flower.compact_build', true) IS DISTINCT FROM 'v2' THEN
    RAISE EXCEPTION 'flower.compact_build guard violation: expected v2, got %', current_setting('flower.compact_build', true);
  END IF;
END $$;

-- Freeze both source and destination rows until this transaction commits.
-- A busy installation aborts safely instead of migrating a changing cash ledger.
DO $$
DECLARE v_table TEXT;
BEGIN
  PERFORM set_config('lock_timeout', '5s', true);
  PERFORM pg_advisory_xact_lock(781320462);
  FOREACH v_table IN ARRAY ARRAY['asset_loans', 'asset_unit_custody', 'asset_units', 'cash_helper_batches', 'cash_job_reservations', 'cash_movements', 'cash_prepared_sets', 'cash_vault_denominations', 'inventory_categories', 'inventory_disposals', 'inventory_document_lines', 'inventory_documents', 'inventory_field_round_projects', 'inventory_field_rounds', 'inventory_idempotency_records', 'inventory_incidents', 'inventory_items', 'inventory_material_recoveries', 'inventory_movements', 'inventory_procurements', 'inventory_recipient_teams', 'inventory_recipients', 'production_assignment_events', 'production_assignment_lines', 'production_assignments', 'production_inspection_lines', 'production_inspections', 'production_submission_lines', 'production_submissions', 'project_checklist_items']
  LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE', v_table);
    END IF;
  END LOOP;
END $$;

-- 2. DROP KNOWN OLD AUTOCREATE / STOCK TRIGGERS BEFORE MIGRATION
-- Prevents spurious work assignment creation or physical stock changes during import
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_doc_production_issue_create') THEN
    DROP TRIGGER IF EXISTS trg_doc_production_issue_create ON public.inventory_documents;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_cash_helper_batch_sync') THEN
    DROP TRIGGER IF EXISTS trg_cash_helper_batch_sync ON public.cash_helper_batches;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_procurement_stock_add') THEN
    DROP TRIGGER IF EXISTS trigger_procurement_stock_add ON public.inventory_procurements;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_process_inventory_disposal') THEN
    DROP TRIGGER IF EXISTS trigger_process_inventory_disposal ON public.inventory_disposals;
  END IF;
END $$;

-- 3. DETECT UNRESOLVABLE CROSS-SOURCE UUID COLLISIONS
-- If distinct source records have colliding UUIDs across tables feeding into
-- documents, lines, or movements, abort immediately rather than corrupting data.
DO $$
DECLARE
  v_collision_count INT := 0;
  v_collision_desc TEXT := '';
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _pre_doc_ids (src TEXT, id UUID) ON COMMIT DROP;
  TRUNCATE TABLE _pre_doc_ids;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_documents') THEN
    INSERT INTO _pre_doc_ids SELECT 'inventory_documents', id FROM public.inventory_documents;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_field_rounds') THEN
    INSERT INTO _pre_doc_ids SELECT 'inventory_field_rounds', id FROM public.inventory_field_rounds;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_incidents') THEN
    INSERT INTO _pre_doc_ids SELECT 'inventory_incidents', id FROM public.inventory_incidents;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cash_job_reservations') THEN
    INSERT INTO _pre_doc_ids SELECT 'cash_job_reservations', id FROM public.cash_job_reservations;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cash_helper_batches') THEN
    INSERT INTO _pre_doc_ids SELECT 'cash_helper_batches', id FROM public.cash_helper_batches;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cash_prepared_sets') THEN
    INSERT INTO _pre_doc_ids SELECT 'cash_prepared_sets', id FROM public.cash_prepared_sets;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'production_assignments') THEN
    INSERT INTO _pre_doc_ids SELECT 'production_assignments', id FROM public.production_assignments;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'production_submissions') THEN
    INSERT INTO _pre_doc_ids SELECT 'production_submissions', id FROM public.production_submissions;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'production_inspections') THEN
    INSERT INTO _pre_doc_ids SELECT 'production_inspections', id FROM public.production_inspections;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'asset_loans') THEN
    INSERT INTO _pre_doc_ids SELECT 'asset_loans', id FROM public.asset_loans;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_procurements') THEN
    INSERT INTO _pre_doc_ids SELECT 'inventory_procurements', id FROM public.inventory_procurements;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_disposals') THEN
    INSERT INTO _pre_doc_ids SELECT 'inventory_disposals', id FROM public.inventory_disposals;
  END IF;

  SELECT count(*), COALESCE(string_agg(src || ':' || id::text, ', '), '')
  INTO v_collision_count, v_collision_desc
  FROM (
    SELECT id, string_agg(src, '+') AS src
    FROM _pre_doc_ids
    GROUP BY id
    HAVING count(DISTINCT src) > 1
  ) c;

  IF v_collision_count > 0 THEN
    RAISE EXCEPTION 'Unresolvable cross-source UUID collision detected targeting inventory_documents: % [%]', v_collision_count, v_collision_desc;
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS _pre_line_ids (src TEXT, id UUID) ON COMMIT DROP;
  TRUNCATE TABLE _pre_line_ids;

  -- Some deployed checklists use TEXT keys. Keep UUID keys unchanged and map
  -- other legacy keys consistently; uniqueness failures abort before retiring data.
  CREATE TEMP TABLE IF NOT EXISTS _legacy_checklist_ids (
    legacy_id TEXT PRIMARY KEY, target_id UUID NOT NULL UNIQUE
  ) ON COMMIT DROP;
  TRUNCATE TABLE _legacy_checklist_ids;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_checklist_items') THEN
    INSERT INTO _legacy_checklist_ids (legacy_id, target_id)
    SELECT id::text, CASE
      WHEN id::text ~* '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{32})$'
        THEN id::text::uuid
      ELSE md5('flower2u:legacy:project_checklist_items:' || id::text)::uuid
    END FROM public.project_checklist_items;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_document_lines') THEN
    INSERT INTO _pre_line_ids SELECT 'inventory_document_lines', id FROM public.inventory_document_lines;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_material_recoveries') THEN
    INSERT INTO _pre_line_ids SELECT 'inventory_material_recoveries', id FROM public.inventory_material_recoveries;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'asset_unit_custody') THEN
    INSERT INTO _pre_line_ids SELECT 'asset_unit_custody', id FROM public.asset_unit_custody;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'production_assignment_lines') THEN
    INSERT INTO _pre_line_ids SELECT 'production_assignment_lines', id FROM public.production_assignment_lines;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'production_submission_lines') THEN
    INSERT INTO _pre_line_ids SELECT 'production_submission_lines', id FROM public.production_submission_lines;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'production_inspection_lines') THEN
    INSERT INTO _pre_line_ids SELECT 'production_inspection_lines', id FROM public.production_inspection_lines;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_checklist_items') THEN
    INSERT INTO _pre_line_ids SELECT 'project_checklist_items', target_id FROM _legacy_checklist_ids;
  END IF;

  SELECT count(*), COALESCE(string_agg(src || ':' || id::text, ', '), '')
  INTO v_collision_count, v_collision_desc
  FROM (
    SELECT id, string_agg(src, '+') AS src
    FROM _pre_line_ids
    GROUP BY id
    HAVING count(DISTINCT src) > 1
  ) c;

  IF v_collision_count > 0 THEN
    RAISE EXCEPTION 'Unresolvable cross-source UUID collision detected targeting inventory_document_lines: % [%]', v_collision_count, v_collision_desc;
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS _pre_mov_ids (src TEXT, id UUID) ON COMMIT DROP;
  TRUNCATE TABLE _pre_mov_ids;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_movements') THEN
    INSERT INTO _pre_mov_ids SELECT 'inventory_movements', id FROM public.inventory_movements;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cash_movements') THEN
    INSERT INTO _pre_mov_ids SELECT 'cash_movements', id FROM public.cash_movements;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'production_assignment_events') THEN
    INSERT INTO _pre_mov_ids SELECT 'production_assignment_events', id FROM public.production_assignment_events;
  END IF;

  SELECT count(*), COALESCE(string_agg(src || ':' || id::text, ', '), '')
  INTO v_collision_count, v_collision_desc
  FROM (
    SELECT id, string_agg(src, '+') AS src
    FROM _pre_mov_ids
    GROUP BY id
    HAVING count(DISTINCT src) > 1
  ) c;

  IF v_collision_count > 0 THEN
    RAISE EXCEPTION 'Unresolvable cross-source UUID collision detected targeting inventory_movements: % [%]', v_collision_count, v_collision_desc;
  END IF;
END $$;

-- 4. ESTABLISH CANONICAL 8 INVENTORY TABLES & SCHEMAS

-- 4.1 inventory_categories (Table 1/8)
CREATE TABLE IF NOT EXISTS public.inventory_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('asset', 'consumable', 'reusable_material')),
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.inventory_categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 4.2 inventory_items (Table 2/8)
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE,
    name TEXT NOT NULL,
    category_id UUID REFERENCES public.inventory_categories(id) ON DELETE SET NULL,
    item_type TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'ชิ้น',
    current_stock NUMERIC(12,2) NOT NULL DEFAULT 0,
    min_alert_threshold NUMERIC(12,2) DEFAULT 5,
    average_cost NUMERIC(12,2) DEFAULT 0,
    storage_location TEXT,
    color TEXT,
    size TEXT,
    status TEXT NOT NULL DEFAULT 'in_service',
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- A Drive URL only: image binaries remain in Google Drive, never in Supabase.
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Ensure item_type check accommodates banknote and task as historical data
DO $$
BEGIN
  ALTER TABLE public.inventory_items DROP CONSTRAINT IF EXISTS inventory_items_item_type_check;
  ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_item_type_check 
    CHECK (lower(item_type) IN ('asset', 'reusable', 'consumable', 'banknote', 'task', 'reusable_material'));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 4.3 inventory_recipients (Table 3/8)
CREATE TABLE IF NOT EXISTS public.inventory_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    recipient_type TEXT NOT NULL DEFAULT 'individual' CHECK (recipient_type IN ('individual', 'team', 'casual_helper', 'staff')),
    contact_info TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Merge team attributes & staff link columns into inventory_recipients
ALTER TABLE public.inventory_recipients ADD COLUMN IF NOT EXISTS staff_user_id TEXT;
ALTER TABLE public.inventory_recipients ADD COLUMN IF NOT EXISTS primary_recipient_id UUID REFERENCES public.inventory_recipients(id) ON DELETE SET NULL;
ALTER TABLE public.inventory_recipients ADD COLUMN IF NOT EXISTS primary_receiver_name TEXT;
ALTER TABLE public.inventory_recipients ADD COLUMN IF NOT EXISTS member_names TEXT[] DEFAULT '{}';
ALTER TABLE public.inventory_recipients ADD COLUMN IF NOT EXISTS team_is_active BOOLEAN DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.inventory_recipients'::regclass 
    AND conname = 'inventory_recipients_staff_user_id_key'
  ) THEN
    ALTER TABLE public.inventory_recipients ADD CONSTRAINT inventory_recipients_staff_user_id_key UNIQUE (staff_user_id);
  END IF;
END $$;

-- 4.4 inventory_documents (Table 4/8)
CREATE TABLE IF NOT EXISTS public.inventory_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_number TEXT NOT NULL,
    doc_type TEXT NOT NULL,
    project_id TEXT REFERENCES public.projects(id) ON DELETE RESTRICT,
    round_id UUID,
    recipient_id UUID REFERENCES public.inventory_recipients(id) ON DELETE RESTRICT,
    recipient_name_snapshot TEXT,
    team_members_snapshot TEXT[] DEFAULT '{}',
    idempotency_key UUID UNIQUE,
    idempotency_payload_hash TEXT,
    status TEXT NOT NULL DEFAULT 'COMPLETED',
    notes TEXT,
    actor_auth_user_id UUID,
    actor_name_snapshot TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Repoint project_id FK to RESTRICT if existing was SET NULL
ALTER TABLE public.inventory_documents DROP CONSTRAINT IF EXISTS inventory_documents_project_id_fkey;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.inventory_documents'::regclass 
    AND conname = 'inventory_documents_project_id_fkey'
  ) THEN
    ALTER TABLE public.inventory_documents 
      ADD CONSTRAINT inventory_documents_project_id_fkey 
      FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Drop old foreign key to inventory_field_rounds (delay re-adding until after round records copy)
ALTER TABLE public.inventory_documents DROP CONSTRAINT IF EXISTS inventory_documents_round_id_fkey;

-- Add compact canonical columns to inventory_documents
ALTER TABLE public.inventory_documents ADD COLUMN IF NOT EXISTS parent_document_id UUID REFERENCES public.inventory_documents(id) ON DELETE RESTRICT;
ALTER TABLE public.inventory_documents ADD COLUMN IF NOT EXISTS source_document_id UUID REFERENCES public.inventory_documents(id) ON DELETE RESTRICT;
ALTER TABLE public.inventory_documents ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.inventory_documents ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;
ALTER TABLE public.inventory_documents ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE public.inventory_documents ADD COLUMN IF NOT EXISTS is_cash BOOLEAN DEFAULT false;
ALTER TABLE public.inventory_documents ADD COLUMN IF NOT EXISTS denomination INTEGER;
ALTER TABLE public.inventory_documents ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.inventory_documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
ALTER TABLE public.inventory_documents ADD COLUMN IF NOT EXISTS action_name TEXT;
ALTER TABLE public.inventory_documents ADD COLUMN IF NOT EXISTS response_payload JSONB;

-- Relax old constraints safely for all new typed states
ALTER TABLE public.inventory_documents ALTER COLUMN recipient_name_snapshot DROP NOT NULL;
ALTER TABLE public.inventory_documents DROP CONSTRAINT IF EXISTS inventory_documents_doc_number_key;
ALTER TABLE public.inventory_documents DROP CONSTRAINT IF EXISTS inventory_documents_doc_type_check;
ALTER TABLE public.inventory_documents DROP CONSTRAINT IF EXISTS inventory_documents_status_check;

-- Ensure doc_type check supports full canonical doc set
ALTER TABLE public.inventory_documents ADD CONSTRAINT inventory_documents_doc_type_check CHECK (
  doc_type IN (
    'PRODUCTION_ISSUE', 'FIELD_ISSUE', 'RETURN_UNUSED', 'RECOVERY', 'OPENING_STOCK', 'ADJUSTMENT',
    'FIELD_ROUND', 'INCIDENT', 'CASH_RESERVATION', 'CASH_BATCH', 'CASH_PREPARED',
    'WORK', 'SUBMISSION', 'INSPECTION', 'WORK_EVENT', 'COMMAND',
    'LEGACY_LOAN', 'PROCUREMENT', 'DISPOSAL', 'CHECKLIST', 'SYSTEM_MIGRATION'
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.inventory_documents'::regclass 
    AND conname = 'inventory_documents_doc_type_doc_number_key'
  ) THEN
    ALTER TABLE public.inventory_documents ADD CONSTRAINT inventory_documents_doc_type_doc_number_key UNIQUE (doc_type, doc_number);
  END IF;
END $$;

-- 4.5 inventory_document_lines (Table 5/8 - NEW)
CREATE TABLE IF NOT EXISTS public.inventory_document_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.inventory_documents(id) ON DELETE RESTRICT,
    line_type TEXT NOT NULL CHECK (line_type IN (
      'ITEM', 'TOOL_CUSTODY', 'ROUND_PROJECT', 'RECOVERY',
      'WORK_OUTPUT', 'SUBMISSION', 'INSPECTION',
      'CASH_RESERVATION', 'CASH_BATCH', 'CASH_PREPARED',
      'CHECKLIST', 'LEGACY_DETAIL', 'INCIDENT'
    )),
    item_id UUID REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
    unit_code TEXT,
    recipient_id UUID REFERENCES public.inventory_recipients(id) ON DELETE RESTRICT,
    due_at TIMESTAMPTZ,
    project_id TEXT REFERENCES public.projects(id) ON DELETE RESTRICT,
    round_id UUID REFERENCES public.inventory_documents(id) ON DELETE RESTRICT,
    source_line_id UUID REFERENCES public.inventory_document_lines(id) ON DELETE RESTRICT,
    source_issue_movement_id UUID,
    description TEXT,
    unit TEXT,
    quantity NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    required_qty NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (required_qty >= 0),
    submitted_qty NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (submitted_qty >= 0),
    accepted_qty NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (accepted_qty >= 0),
    rejected_qty NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (rejected_qty >= 0),
    pending_qty NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (pending_qty >= 0),
    returned_qty NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (returned_qty >= 0),
    handed_over_qty NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (handed_over_qty >= 0),
    delivered_qty NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (delivered_qty >= 0),
    denomination INTEGER CHECK (denomination IS NULL OR denomination IN (20, 50, 100, 500, 1000)),
    status TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_cash_integer_counts CHECK (
      denomination IS NULL OR (
        quantity = trunc(quantity) AND
        required_qty = trunc(required_qty) AND
        submitted_qty = trunc(submitted_qty) AND
        accepted_qty = trunc(accepted_qty) AND
        rejected_qty = trunc(rejected_qty) AND
        pending_qty = trunc(pending_qty) AND
        returned_qty = trunc(returned_qty) AND
        handed_over_qty = trunc(handed_over_qty) AND
        delivered_qty = trunc(delivered_qty)
      )
    )
);

ALTER TABLE public.inventory_document_lines ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES public.inventory_recipients(id) ON DELETE RESTRICT;
ALTER TABLE public.inventory_document_lines ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_inv_doc_lines_doc_id ON public.inventory_document_lines(document_id);
CREATE INDEX IF NOT EXISTS idx_inv_doc_lines_line_type ON public.inventory_document_lines(line_type);
CREATE INDEX IF NOT EXISTS idx_inv_doc_lines_item_id ON public.inventory_document_lines(item_id);
CREATE INDEX IF NOT EXISTS idx_inv_doc_lines_unit_code ON public.inventory_document_lines(unit_code);
CREATE INDEX IF NOT EXISTS idx_inv_doc_lines_recipient_id ON public.inventory_document_lines(recipient_id);
CREATE INDEX IF NOT EXISTS idx_inv_doc_lines_project_id ON public.inventory_document_lines(project_id);
CREATE INDEX IF NOT EXISTS idx_inv_doc_lines_source_line ON public.inventory_document_lines(source_line_id);

-- 4.6 asset_units (Table 6/8)
CREATE TABLE IF NOT EXISTS public.asset_units (
    unit_code TEXT PRIMARY KEY,
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'AVAILABLE',
    borrowed_by TEXT,
    borrowed_at TIMESTAMPTZ,
    project_id TEXT REFERENCES public.projects(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.asset_units ADD COLUMN IF NOT EXISTS active_recipient_id UUID REFERENCES public.inventory_recipients(id) ON DELETE SET NULL;
ALTER TABLE public.asset_units ADD COLUMN IF NOT EXISTS active_custody_line_id UUID REFERENCES public.inventory_document_lines(id) ON DELETE SET NULL;
ALTER TABLE public.asset_units ADD COLUMN IF NOT EXISTS active_round_id UUID REFERENCES public.inventory_documents(id) ON DELETE SET NULL;
ALTER TABLE public.asset_units ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;

-- Ensure asset_units foreign keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.asset_units'::regclass 
    AND conname = 'asset_units_active_custody_line_id_fkey'
  ) THEN
    ALTER TABLE public.asset_units 
      ADD CONSTRAINT asset_units_active_custody_line_id_fkey 
      FOREIGN KEY (active_custody_line_id) REFERENCES public.inventory_document_lines(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.asset_units'::regclass 
    AND conname = 'asset_units_active_round_id_fkey'
  ) THEN
    ALTER TABLE public.asset_units 
      ADD CONSTRAINT asset_units_active_round_id_fkey 
      FOREIGN KEY (active_round_id) REFERENCES public.inventory_documents(id) ON DELETE SET NULL;
  END IF;
  -- Link unit_code on document lines
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.inventory_document_lines'::regclass 
    AND conname = 'inventory_document_lines_unit_code_fkey'
  ) THEN
    ALTER TABLE public.inventory_document_lines
      ADD CONSTRAINT inventory_document_lines_unit_code_fkey
      FOREIGN KEY (unit_code) REFERENCES public.asset_units(unit_code) ON DELETE RESTRICT;
  END IF;
END $$;

-- 4.7 inventory_movements (Table 7/8)
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.inventory_documents(id) ON DELETE RESTRICT,
    item_id UUID REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
    movement_type TEXT NOT NULL,
    quantity NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    delta_stock NUMERIC(12,2) NOT NULL DEFAULT 0,
    source_issue_movement_id UUID REFERENCES public.inventory_movements(id) ON DELETE RESTRICT,
    source_item_variant_snapshot JSONB,
    notes TEXT,
    actor_auth_user_id UUID,
    actor_name_snapshot TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Repoint document_id FK to RESTRICT if existing was CASCADE
ALTER TABLE public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_document_id_fkey;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.inventory_movements'::regclass 
    AND conname = 'inventory_movements_document_id_fkey'
  ) THEN
    ALTER TABLE public.inventory_movements 
      ADD CONSTRAINT inventory_movements_document_id_fkey 
      FOREIGN KEY (document_id) REFERENCES public.inventory_documents(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Repoint source_issue_movement_id FK to RESTRICT if existing was SET NULL
ALTER TABLE public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_source_issue_movement_id_fkey;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.inventory_movements'::regclass 
    AND conname = 'inventory_movements_source_issue_movement_id_fkey'
  ) THEN
    ALTER TABLE public.inventory_movements 
      ADD CONSTRAINT inventory_movements_source_issue_movement_id_fkey 
      FOREIGN KEY (source_issue_movement_id) REFERENCES public.inventory_movements(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Add compact columns to inventory_movements
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS line_id UUID REFERENCES public.inventory_document_lines(id) ON DELETE RESTRICT;
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS unit_code TEXT REFERENCES public.asset_units(unit_code) ON DELETE RESTRICT;
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES public.projects(id) ON DELETE RESTRICT;
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS round_id UUID REFERENCES public.inventory_documents(id) ON DELETE RESTRICT;
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES public.inventory_recipients(id) ON DELETE RESTRICT;
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS recipient_name_snapshot TEXT;
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS denomination INTEGER;
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS from_location TEXT;
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS to_location TEXT;
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS is_cash BOOLEAN DEFAULT false;
ALTER TABLE public.inventory_movements ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Relax item_id and constraints on movements for cash/work audit events
ALTER TABLE public.inventory_movements ALTER COLUMN item_id DROP NOT NULL;
ALTER TABLE public.inventory_movements ALTER COLUMN delta_stock SET DEFAULT 0;
ALTER TABLE public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_quantity_check;
ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_quantity_check CHECK (quantity >= 0);
ALTER TABLE public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_movement_type_check;

-- Link source_issue_movement_id on document lines
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.inventory_document_lines'::regclass 
    AND conname = 'inventory_document_lines_source_issue_movement_id_fkey'
  ) THEN
    ALTER TABLE public.inventory_document_lines
      ADD CONSTRAINT inventory_document_lines_source_issue_movement_id_fkey
      FOREIGN KEY (source_issue_movement_id) REFERENCES public.inventory_movements(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- 4.8 cash_vault_denominations (Table 8/8)
CREATE TABLE IF NOT EXISTS public.cash_vault_denominations (
    denomination INT PRIMARY KEY CHECK (denomination IN (20, 50, 100, 500, 1000)),
    physical_count INT NOT NULL DEFAULT 0 CHECK (physical_count >= 0),
    reserved_count INT NOT NULL DEFAULT 0 CHECK (reserved_count >= 0 AND reserved_count <= physical_count),
    low_alert_threshold INT NOT NULL DEFAULT 0 CHECK (low_alert_threshold >= 0),
    target_available_count INT NOT NULL DEFAULT 0 CHECK (target_available_count >= 0),
    is_initialized BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Seed existing 5 physical rows if not already present
INSERT INTO public.cash_vault_denominations (denomination, physical_count, reserved_count, low_alert_threshold, target_available_count, is_initialized)
VALUES 
    (20, 0, 0, 50, 200, false),
    (50, 0, 0, 40, 150, false),
    (100, 0, 0, 50, 200, false),
    (500, 0, 0, 20, 100, false),
    (1000, 0, 0, 10, 50, false)
ON CONFLICT (denomination) DO NOTHING;

-- 5. LOSSLESS DATA MIGRATION FROM 22 RETIRED TABLES

-- 5.1 inventory_recipient_teams -> inventory_recipients
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_recipient_teams') THEN
    UPDATE public.inventory_recipients r
    SET primary_recipient_id = t.primary_recipient_id,
        primary_receiver_name = t.primary_receiver_name,
        member_names = t.member_names,
        team_is_active = t.is_active
    FROM public.inventory_recipient_teams t
    WHERE r.id = t.team_recipient_id;
  END IF;

  -- Support staff UUID or TEXT matching
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'staff_users') THEN
    UPDATE public.inventory_recipients r
    SET staff_user_id = s.id::text
    FROM public.staff_users s
    WHERE r.recipient_type = 'staff' 
      AND r.staff_user_id IS NULL
      AND (r.name = s.full_name OR r.name = s.username);
  END IF;
END $$;

-- 5.2 inventory_field_rounds -> inventory_documents
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_field_rounds') THEN
    INSERT INTO public.inventory_documents (
      id, doc_number, doc_type, title, recipient_id, recipient_name_snapshot,
      team_members_snapshot, due_at, status, notes, actor_auth_user_id,
      metadata, created_at, updated_at, version
    )
    SELECT
      r.id,
      r.round_code,
      'FIELD_ROUND',
      r.title,
      r.recipient_id,
      r.recipient_name_snapshot,
      COALESCE(r.team_members_snapshot, '{}'),
      r.expected_return_at,
      r.status,
      r.notes,
      r.created_by_auth_user_id,
      jsonb_build_object('legacy_table', 'inventory_field_rounds', 'created_by_auth_user_id', r.created_by_auth_user_id),
      r.created_at,
      COALESCE(r.updated_at, r.created_at),
      1
    FROM public.inventory_field_rounds r
    ON CONFLICT (id) DO UPDATE SET
      doc_type = 'FIELD_ROUND',
      title = EXCLUDED.title,
      recipient_id = EXCLUDED.recipient_id,
      recipient_name_snapshot = EXCLUDED.recipient_name_snapshot,
      team_members_snapshot = EXCLUDED.team_members_snapshot,
      due_at = EXCLUDED.due_at,
      status = EXCLUDED.status,
      notes = EXCLUDED.notes;
  END IF;

  -- Link round_id self-referencing to inventory_documents now that all FIELD_ROUND documents are migrated
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.inventory_documents'::regclass 
    AND conname = 'inventory_documents_round_id_fkey'
  ) THEN
    ALTER TABLE public.inventory_documents 
      ADD CONSTRAINT inventory_documents_round_id_fkey 
      FOREIGN KEY (round_id) REFERENCES public.inventory_documents(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- 5.3 inventory_field_round_projects -> inventory_document_lines
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_field_round_projects') THEN
    INSERT INTO public.inventory_document_lines (
      document_id, round_id, line_type, project_id, status, is_active, metadata, created_at, updated_at
    )
    SELECT
      rp.round_id,
      rp.round_id,
      'ROUND_PROJECT',
      rp.project_id,
      'active',
      true,
      jsonb_build_object('sort_order', rp.sort_order, 'legacy_table', 'inventory_field_round_projects'),
      timezone('utc'::text, now()),
      timezone('utc'::text, now())
    FROM public.inventory_field_round_projects rp
    WHERE NOT EXISTS (
      SELECT 1 FROM public.inventory_document_lines l
      WHERE l.document_id = rp.round_id AND l.project_id = rp.project_id AND l.line_type = 'ROUND_PROJECT'
    );
  END IF;
END $$;

-- 5.4 inventory_material_recoveries -> inventory_document_lines
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_material_recoveries') THEN
    INSERT INTO public.inventory_document_lines (
      id, document_id, line_type, item_id, source_issue_movement_id,
      quantity, accepted_qty, rejected_qty, status, notes, metadata,
      created_at, updated_at
    )
    SELECT
      m.id,
      m.document_id,
      'RECOVERY',
      m.item_id,
      m.source_issue_movement_id,
      m.recovered_qty,
      COALESCE(m.inspected_good_qty, 0),
      COALESCE(m.inspected_damaged_qty, 0),
      m.status,
      m.notes,
      jsonb_build_object(
        'legacy_table', 'inventory_material_recoveries',
        'inspected_at', m.inspected_at,
        'inspected_by_auth_user_id', m.inspected_by_auth_user_id,
        'inspected_good_qty', m.inspected_good_qty,
        'inspected_damaged_qty', m.inspected_damaged_qty
      ),
      m.created_at,
      COALESCE(m.inspected_at, m.created_at)
    FROM public.inventory_material_recoveries m
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- 5.5 asset_unit_custody -> inventory_document_lines & asset_units
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'asset_unit_custody') THEN
    -- Fallback header for orphaned legacy custody records if neither document_id nor round_id exists
    IF EXISTS (SELECT 1 FROM public.asset_unit_custody WHERE document_id IS NULL AND round_id IS NULL) THEN
      INSERT INTO public.inventory_documents (id, doc_number, doc_type, status, notes, title, created_at, updated_at)
      VALUES (
        '00000000-0000-0000-0000-000000000001'::uuid,
        'DOC-LEGACY-CUSTODY',
        'LEGACY_LOAN',
        'COMPLETED',
        'Fallback document for legacy custody records without document_id',
        'Legacy Tool Custody Records',
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
      ) ON CONFLICT (doc_type, doc_number) DO NOTHING;
    END IF;

    INSERT INTO public.inventory_document_lines (
      id, document_id, line_type, unit_code, item_id, recipient_id, due_at, project_id, round_id,
      quantity, status, notes, metadata, created_at, updated_at
    )
    SELECT
      c.id,
      COALESCE(c.document_id, c.round_id, '00000000-0000-0000-0000-000000000001'::uuid),
      'TOOL_CUSTODY',
      c.unit_code,
      u.item_id,
      c.recipient_id,
      COALESCE((to_jsonb(c)->>'expected_return_at')::timestamptz, (to_jsonb(c)->>'due_date')::timestamptz),
      c.project_id,
      c.round_id,
      1,
      CASE 
        WHEN (to_jsonb(c) ? 'status') AND (to_jsonb(c)->>'status' IS NOT NULL) THEN to_jsonb(c)->>'status'
        WHEN (to_jsonb(c) ? 'is_active') AND (to_jsonb(c)->>'is_active')::boolean = true THEN 'ACTIVE'
        ELSE COALESCE(to_jsonb(c)->>'return_status', 'RETURNED')
      END,
      c.notes,
      jsonb_build_object(
        'legacy_table', 'asset_unit_custody',
        'recipient_id', c.recipient_id,
        'recipient_name_snapshot', c.recipient_name_snapshot,
        'borrowed_at', c.borrowed_at,
        'due_date', to_jsonb(c)->>'due_date',
        'expected_return_at', COALESCE(to_jsonb(c)->>'expected_return_at', to_jsonb(c)->>'due_date'),
        'returned_at', c.returned_at,
        'handed_over_to_custody_id', to_jsonb(c)->>'handed_over_to_custody_id'
      ),
      c.created_at,
      COALESCE(c.returned_at, c.created_at)
    FROM public.asset_unit_custody c
    LEFT JOIN public.asset_units u ON u.unit_code = c.unit_code
    ON CONFLICT (id) DO NOTHING;

    -- Update active asset_units custody pointers for ACTIVE custody
    UPDATE public.asset_units u
    SET active_recipient_id = c.recipient_id,
        active_custody_line_id = c.id,
        active_round_id = c.round_id,
        due_at = COALESCE((to_jsonb(c)->>'expected_return_at')::timestamptz, (to_jsonb(c)->>'due_date')::timestamptz),
        status = 'BORROWED'
    FROM public.asset_unit_custody c
    WHERE u.unit_code = c.unit_code 
      AND (
        ((to_jsonb(c) ? 'is_active') AND (to_jsonb(c)->>'is_active')::boolean = true) OR
        ((to_jsonb(c) ? 'status') AND upper(to_jsonb(c)->>'status') = 'ACTIVE')
      );
  END IF;
END $$;

-- 5.6 inventory_incidents -> inventory_documents & inventory_document_lines
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_incidents') THEN
    INSERT INTO public.inventory_documents (
      id, doc_number, doc_type, round_id, recipient_id, recipient_name_snapshot,
      status, notes, actor_auth_user_id, metadata, created_at, updated_at
    )
    SELECT
      inc.id,
      'INC-' || inc.id::text,
      'INCIDENT',
      inc.round_id,
      inc.responsible_recipient_id,
      inc.recipient_name_snapshot,
      inc.resolution_status,
      inc.notes,
      inc.reporter_auth_user_id,
      jsonb_build_object(
        'legacy_table', 'inventory_incidents',
        'incident_type', inc.incident_type,
        'severity', inc.severity,
        'unit_code', inc.unit_code,
        'custody_id', inc.custody_id,
        'document_id', inc.document_id
      ),
      inc.created_at,
      inc.created_at
    FROM public.inventory_incidents inc
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.inventory_document_lines (
      document_id, line_type, unit_code, item_id, round_id, quantity, status, notes, metadata, created_at, updated_at
    )
    SELECT
      inc.id,
      'INCIDENT',
      inc.unit_code,
      u.item_id,
      inc.round_id,
      1,
      inc.resolution_status,
      inc.notes,
      jsonb_build_object(
        'legacy_table', 'inventory_incidents',
        'incident_type', inc.incident_type,
        'severity', inc.severity,
        'custody_id', inc.custody_id
      ),
      inc.created_at,
      inc.created_at
    FROM public.inventory_incidents inc
    LEFT JOIN public.asset_units u ON u.unit_code = inc.unit_code
    WHERE NOT EXISTS (
      SELECT 1 FROM public.inventory_document_lines l WHERE l.document_id = inc.id AND l.line_type = 'INCIDENT'
    );
  END IF;
END $$;

-- 5.7 cash_job_reservations -> inventory_documents & inventory_document_lines
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cash_job_reservations') THEN
    INSERT INTO public.inventory_documents (
      id, doc_number, doc_type, project_id, denomination, is_cash, status, metadata, created_at, updated_at
    )
    SELECT
      r.id,
      'CRES-' || r.project_id || '-' || r.denomination::text || '-' || SUBSTRING(r.id::text FROM 1 FOR 8),
      'CASH_RESERVATION',
      r.project_id,
      r.denomination,
      true,
      'COMPLETED',
      jsonb_build_object('legacy_table', 'cash_job_reservations', 'reserved_count', r.reserved_count),
      r.created_at,
      r.updated_at
    FROM public.cash_job_reservations r
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.inventory_document_lines (
      document_id, line_type, project_id, denomination, quantity, required_qty, status, is_active, metadata, created_at, updated_at
    )
    SELECT
      r.id,
      'CASH_RESERVATION',
      r.project_id,
      r.denomination,
      r.reserved_count,
      r.reserved_count,
      'COMPLETED',
      (r.reserved_count > 0),
      jsonb_build_object('legacy_table', 'cash_job_reservations', 'reserved_count', r.reserved_count),
      r.created_at,
      r.updated_at
    FROM public.cash_job_reservations r
    WHERE NOT EXISTS (
      SELECT 1 FROM public.inventory_document_lines l WHERE l.document_id = r.id AND l.line_type = 'CASH_RESERVATION'
    );
  END IF;
END $$;

-- 5.8 cash_helper_batches -> inventory_documents & inventory_document_lines
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cash_helper_batches') THEN
    INSERT INTO public.inventory_documents (
      id, doc_number, doc_type, project_id, recipient_id, recipient_name_snapshot,
      denomination, is_cash, status, notes, metadata, created_at, updated_at
    )
    SELECT
      b.id,
      b.batch_code,
      'CASH_BATCH',
      b.project_id,
      b.recipient_id,
      b.recipient_name_snapshot,
      b.denomination,
      true,
      b.status,
      b.notes,
      jsonb_build_object(
        'legacy_table', 'cash_helper_batches',
        'issued_count', b.issued_count,
        'prepared_count', b.prepared_count,
        'returned_raw_count', b.returned_raw_count,
        'handed_over_count', b.handed_over_count
      ),
      b.created_at,
      b.updated_at
    FROM public.cash_helper_batches b
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.inventory_document_lines (
      document_id, line_type, project_id, denomination, quantity,
      accepted_qty, returned_qty, handed_over_qty, status, notes, metadata, created_at, updated_at
    )
    SELECT
      b.id,
      'CASH_BATCH',
      b.project_id,
      b.denomination,
      b.issued_count,
      b.prepared_count,
      b.returned_raw_count,
      b.handed_over_count,
      b.status,
      b.notes,
      jsonb_build_object('legacy_table', 'cash_helper_batches'),
      b.created_at,
      b.updated_at
    FROM public.cash_helper_batches b
    WHERE NOT EXISTS (
      SELECT 1 FROM public.inventory_document_lines l WHERE l.document_id = b.id AND l.line_type = 'CASH_BATCH'
    );
  END IF;
END $$;

-- 5.9 cash_prepared_sets -> inventory_documents & inventory_document_lines
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cash_prepared_sets') THEN
    INSERT INTO public.inventory_documents (
      id, doc_number, doc_type, project_id, denomination, is_cash, status, metadata, created_at, updated_at
    )
    SELECT
      p.id,
      'CPREP-' || p.project_id || '-' || p.denomination::text || '-' || SUBSTRING(p.id::text FROM 1 FOR 8),
      'CASH_PREPARED',
      p.project_id,
      p.denomination,
      true,
      'COMPLETED',
      jsonb_build_object('legacy_table', 'cash_prepared_sets', 'prepared_count', p.prepared_count, 'delivered_count', p.delivered_count),
      p.created_at,
      p.updated_at
    FROM public.cash_prepared_sets p
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.inventory_document_lines (
      document_id, line_type, project_id, denomination, quantity, delivered_qty, status, metadata, created_at, updated_at
    )
    SELECT
      p.id,
      'CASH_PREPARED',
      p.project_id,
      p.denomination,
      p.prepared_count,
      p.delivered_count,
      'COMPLETED',
      jsonb_build_object('legacy_table', 'cash_prepared_sets'),
      p.created_at,
      p.updated_at
    FROM public.cash_prepared_sets p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.inventory_document_lines l WHERE l.document_id = p.id AND l.line_type = 'CASH_PREPARED'
    );
  END IF;
END $$;

-- 5.10 cash_movements -> inventory_movements
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cash_movements') THEN
    INSERT INTO public.inventory_movements (
      id, document_id, movement_type, quantity, delta_stock, denomination,
      from_location, to_location, project_id, actor_auth_user_id,
      actor_name_snapshot, notes, is_cash, metadata, created_at
    )
    SELECT
      cm.id,
      cm.batch_id,
      cm.action_type,
      cm.note_count,
      0,
      cm.denomination,
      cm.from_location,
      cm.to_location,
      cm.project_id,
      cm.actor_auth_user_id,
      cm.actor_name_snapshot,
      cm.notes,
      true,
      jsonb_build_object(
        'legacy_table', 'cash_movements',
        'total_value', cm.total_value,
        'idempotency_key', cm.idempotency_key
      ),
      cm.created_at
    FROM public.cash_movements cm
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- 5.11 inventory_idempotency_records -> inventory_documents
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_idempotency_records') THEN
    -- Attach cached result to existing business header if same key
    UPDATE public.inventory_documents d
    SET action_name = COALESCE(d.action_name, r.action_name),
        idempotency_payload_hash = COALESCE(d.idempotency_payload_hash, r.payload_hash),
        response_payload = COALESCE(d.response_payload, r.response_payload),
        actor_auth_user_id = COALESCE(d.actor_auth_user_id, r.actor_auth_user_id)
    FROM public.inventory_idempotency_records r
    WHERE d.idempotency_key = r.idempotency_key;

    -- Legacy requests lacking a business header get COMMAND headers
    INSERT INTO public.inventory_documents (
      doc_number, doc_type, idempotency_key, idempotency_payload_hash,
      action_name, response_payload, actor_auth_user_id, status, metadata, created_at, updated_at
    )
    SELECT
      'CMD-' || replace(r.idempotency_key::text, '-', ''),
      'COMMAND',
      r.idempotency_key,
      r.payload_hash,
      r.action_name,
      r.response_payload,
      r.actor_auth_user_id,
      'COMPLETED',
      jsonb_build_object('legacy_table', 'inventory_idempotency_records'),
      r.created_at,
      r.created_at
    FROM public.inventory_idempotency_records r
    WHERE NOT EXISTS (
      SELECT 1 FROM public.inventory_documents d WHERE d.idempotency_key = r.idempotency_key
    );
  END IF;
END $$;

-- 5.12 7 production_* tables -> inventory_documents, inventory_document_lines, inventory_movements
DO $$
BEGIN
  -- production_assignments -> WORK headers
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'production_assignments') THEN
    INSERT INTO public.inventory_documents (
      id, doc_number, doc_type, project_id, recipient_id, recipient_name_snapshot,
      team_members_snapshot, title, due_at, status, source_document_id, is_cash,
      version, actor_auth_user_id, metadata, created_at, updated_at
    )
    SELECT
      pa.id,
      'WORK-' || pa.id::text,
      'WORK',
      pa.project_id,
      pa.recipient_id,
      pa.responsible_name,
      COALESCE(pa.team_members_snapshot, '{}'),
      pa.title,
      pa.due_at,
      pa.status,
      COALESCE(pa.source_document_id, pa.source_cash_batch_id),
      pa.cash_only,
      COALESCE(pa.version, 1),
      pa.created_by_auth_user_id,
      jsonb_build_object(
        'legacy_table', 'production_assignments',
        'source_cash_batch_id', pa.source_cash_batch_id,
        'source_document_id', pa.source_document_id,
        'responsible_name', pa.responsible_name
      ),
      pa.created_at,
      pa.updated_at
    FROM public.production_assignments pa
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- production_assignment_lines -> WORK_OUTPUT lines
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'production_assignment_lines') THEN
    INSERT INTO public.inventory_document_lines (
      id, document_id, line_type, description, required_qty, quantity, unit,
      is_active, submitted_qty, accepted_qty, rejected_qty, pending_qty,
      status, metadata, created_at, updated_at
    )
    SELECT
      pal.id,
      pal.assignment_id,
      'WORK_OUTPUT',
      pal.description,
      pal.required_qty,
      pal.required_qty,
      pal.unit,
      pal.is_active,
      pal.submitted_qty,
      pal.accepted_qty,
      pal.rejected_qty,
      pal.pending_qty,
      CASE WHEN pal.is_active THEN 'active' ELSE 'inactive' END,
      jsonb_build_object('legacy_table', 'production_assignment_lines'),
      pal.created_at,
      pal.updated_at
    FROM public.production_assignment_lines pal
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- production_submissions -> SUBMISSION headers
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'production_submissions') THEN
    INSERT INTO public.inventory_documents (
      id, doc_number, doc_type, parent_document_id, project_id, status, notes,
      actor_auth_user_id, actor_name_snapshot, metadata, created_at, updated_at
    )
    SELECT
      ps.id,
      'SUB-' || ps.id::text,
      'SUBMISSION',
      ps.assignment_id,
      (SELECT project_id FROM public.inventory_documents WHERE id = ps.assignment_id),
      ps.status,
      ps.note,
      ps.submitted_by_auth_user_id,
      ps.submitted_by_name,
      jsonb_build_object('legacy_table', 'production_submissions', 'submitted_at', ps.submitted_at),
      ps.submitted_at,
      ps.updated_at
    FROM public.production_submissions ps
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- production_submission_lines -> SUBMISSION lines
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'production_submission_lines') THEN
    INSERT INTO public.inventory_document_lines (
      id, document_id, source_line_id, line_type, quantity, accepted_qty, rejected_qty, pending_qty, status, metadata, created_at, updated_at
    )
    SELECT
      psl.id,
      psl.submission_id,
      psl.line_id,
      'SUBMISSION',
      psl.quantity,
      psl.accepted_qty,
      psl.rejected_qty,
      (psl.quantity - psl.accepted_qty - psl.rejected_qty),
      'submitted',
      jsonb_build_object('legacy_table', 'production_submission_lines'),
      COALESCE((SELECT created_at FROM public.inventory_documents WHERE id = psl.submission_id), timezone('utc'::text, now())),
      COALESCE((SELECT updated_at FROM public.inventory_documents WHERE id = psl.submission_id), timezone('utc'::text, now()))
    FROM public.production_submission_lines psl
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- production_inspections -> INSPECTION headers
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'production_inspections') THEN
    INSERT INTO public.inventory_documents (
      id, doc_number, doc_type, parent_document_id, project_id, status, notes,
      actor_auth_user_id, actor_name_snapshot, metadata, created_at, updated_at
    )
    SELECT
      pi.id,
      'INSP-' || pi.id::text,
      'INSPECTION',
      pi.submission_id,
      (SELECT project_id FROM public.inventory_documents WHERE id = pi.submission_id),
      'COMPLETED',
      pi.notes,
      pi.inspector_auth_user_id,
      pi.inspector_name,
      jsonb_build_object('legacy_table', 'production_inspections', 'inspected_at', pi.inspected_at),
      pi.inspected_at,
      pi.inspected_at
    FROM public.production_inspections pi
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- production_inspection_lines -> INSPECTION lines
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'production_inspection_lines') THEN
    INSERT INTO public.inventory_document_lines (
      id, document_id, source_line_id, line_type, quantity, accepted_qty, rejected_qty, notes, status, metadata, created_at, updated_at
    )
    SELECT
      pil.id,
      pil.inspection_id,
      pil.submission_line_id,
      'INSPECTION',
      (pil.accepted_qty + pil.rejected_qty),
      pil.accepted_qty,
      pil.rejected_qty,
      pil.notes,
      'inspected',
      jsonb_build_object('legacy_table', 'production_inspection_lines'),
      COALESCE((SELECT created_at FROM public.inventory_documents WHERE id = pil.inspection_id), timezone('utc'::text, now())),
      COALESCE((SELECT updated_at FROM public.inventory_documents WHERE id = pil.inspection_id), timezone('utc'::text, now()))
    FROM public.production_inspection_lines pil
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- production_assignment_events -> inventory_movements
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'production_assignment_events') THEN
    INSERT INTO public.inventory_movements (
      id, document_id, movement_type, quantity, delta_stock, actor_auth_user_id,
      actor_name_snapshot, notes, is_cash, metadata, created_at
    )
    SELECT
      pae.id,
      pae.assignment_id,
      pae.event_type,
      0,
      0,
      pae.actor_auth_user_id,
      pae.actor_name,
      pae.reason,
      coalesce((SELECT d.is_cash FROM public.inventory_documents d WHERE d.id = pae.assignment_id), false),
      jsonb_build_object(
        'legacy_table', 'production_assignment_events',
        'from_status', pae.from_status,
        'to_status', pae.to_status,
        'details', pae.details
      ),
      pae.created_at
    FROM public.production_assignment_events pae
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- 5.13 4 legacy tables -> inventory_documents & inventory_document_lines
DO $$
BEGIN
  -- asset_loans -> LEGACY_LOAN headers & detail lines
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'asset_loans') THEN
    INSERT INTO public.inventory_documents (
      id, doc_number, doc_type, project_id, recipient_name_snapshot, due_at,
      status, notes, actor_auth_user_id, actor_name_snapshot, metadata, created_at, updated_at
    )
    SELECT
      al.id,
      'LOAN-' || al.id::text,
      'LEGACY_LOAN',
      al.project_id,
      al.borrower_name,
      al.expected_return_at,
      al.status,
      al.notes,
      -- Legacy borrower_user_id references staff_users.id, not auth.users.id.
      (SELECT s.auth_user_id FROM public.staff_users s
       WHERE s.id::text = al.borrower_user_id::text OR s.auth_user_id::text = al.borrower_user_id::text
       ORDER BY (s.id::text = al.borrower_user_id::text) DESC LIMIT 1),
      al.borrower_name,
      jsonb_build_object(
        'legacy_table', 'asset_loans',
        'borrower_user_id', al.borrower_user_id::text,
        'condition_out', al.condition_out,
        'condition_in', al.condition_in,
        'actual_returned_at', al.actual_returned_at,
        'borrowed_at', al.borrowed_at
      ),
      al.borrowed_at,
      COALESCE(al.actual_returned_at, al.borrowed_at)
    FROM public.asset_loans al
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.inventory_document_lines (
      document_id, line_type, item_id, project_id, quantity, status, notes, metadata, created_at, updated_at
    )
    SELECT
      al.id,
      'LEGACY_DETAIL',
      al.item_id,
      al.project_id,
      1,
      al.status,
      al.notes,
      jsonb_build_object(
        'legacy_table', 'asset_loans',
        'condition_out', al.condition_out,
        'condition_in', al.condition_in,
        'borrower_name', al.borrower_name
      ),
      al.borrowed_at,
      COALESCE(al.actual_returned_at, al.borrowed_at)
    FROM public.asset_loans al
    WHERE NOT EXISTS (
      SELECT 1 FROM public.inventory_document_lines l WHERE l.document_id = al.id AND l.line_type = 'LEGACY_DETAIL'
    );
  END IF;

  -- inventory_procurements -> PROCUREMENT headers & lines
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_procurements') THEN
    INSERT INTO public.inventory_documents (
      id, doc_number, doc_type, status, notes, metadata, created_at, updated_at
    )
    SELECT
      pr.id,
      COALESCE(
        NULLIF((to_jsonb(pr) ->> 'procurement_code'), ''),
        'PROC-' || pr.id::text
      ),
      'PROCUREMENT',
      'COMPLETED',
      (to_jsonb(pr) ->> 'quality_notes'),
      jsonb_build_object(
        'legacy_table', 'inventory_procurements',
        'vendor_id', to_jsonb(pr) ->> 'vendor_id',
        'purchase_date', to_jsonb(pr) ->> 'purchase_date',
        'receipt_url', to_jsonb(pr) ->> 'receipt_url',
        'total_cost', to_jsonb(pr) -> 'total_cost',
        'unit_price', to_jsonb(pr) -> 'unit_price'
      ),
      pr.created_at,
      pr.created_at
    FROM public.inventory_procurements pr
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.inventory_document_lines (
      document_id, line_type, item_id, quantity, notes, metadata, created_at, updated_at
    )
    SELECT
      pr.id,
      'ITEM',
      pr.item_id,
      pr.quantity,
      (to_jsonb(pr) ->> 'quality_notes'),
      jsonb_build_object(
        'legacy_table', 'inventory_procurements',
        'unit_price', to_jsonb(pr) -> 'unit_price',
        'receipt_url', to_jsonb(pr) ->> 'receipt_url',
        'vendor_id', to_jsonb(pr) ->> 'vendor_id'
      ),
      pr.created_at,
      pr.created_at
    FROM public.inventory_procurements pr
    WHERE NOT EXISTS (
      SELECT 1 FROM public.inventory_document_lines l WHERE l.document_id = pr.id AND l.line_type = 'ITEM'
    );
  END IF;

  -- inventory_disposals -> DISPOSAL headers & lines
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_disposals') THEN
    INSERT INTO public.inventory_documents (
      id, doc_number, doc_type, project_id, status, notes, actor_auth_user_id, metadata, created_at, updated_at
    )
    SELECT
      d.id,
      d.disposal_code,
      'DISPOSAL',
      (to_jsonb(d) ->> 'project_id'),
      'COMPLETED',
      (to_jsonb(d) ->> 'reason_notes'),
      (SELECT s.auth_user_id FROM public.staff_users s
       WHERE s.id::text = to_jsonb(d)->>'disposed_by_user_id' OR s.auth_user_id::text = to_jsonb(d)->>'disposed_by_user_id'
       ORDER BY (s.id::text = to_jsonb(d)->>'disposed_by_user_id') DESC LIMIT 1),
      jsonb_build_object(
        'legacy_table', 'inventory_disposals',
        'disposed_by_user_id', to_jsonb(d)->>'disposed_by_user_id',
        'approved_by_user_id', to_jsonb(d)->>'approved_by_user_id',
        'reason_type', to_jsonb(d) ->> 'reason_type',
        'proof_image_url', to_jsonb(d) ->> 'proof_image_url',
        'salvage_value', to_jsonb(d) -> 'salvage_value',
        'financial_loss', to_jsonb(d) -> 'financial_loss',
        'disposal_date', to_jsonb(d) ->> 'disposal_date'
      ),
      d.created_at,
      d.created_at
    FROM public.inventory_disposals d
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.inventory_document_lines (
      document_id, line_type, item_id, project_id, quantity, notes, metadata, created_at, updated_at
    )
    SELECT
      d.id,
      'ITEM',
      d.item_id,
      (to_jsonb(d) ->> 'project_id'),
      d.quantity,
      (to_jsonb(d) ->> 'reason_notes'),
      jsonb_build_object(
        'legacy_table', 'inventory_disposals',
        'reason_type', to_jsonb(d) ->> 'reason_type',
        'salvage_value', to_jsonb(d) -> 'salvage_value',
        'financial_loss', to_jsonb(d) -> 'financial_loss'
      ),
      d.created_at,
      d.created_at
    FROM public.inventory_disposals d
    WHERE NOT EXISTS (
      SELECT 1 FROM public.inventory_document_lines l WHERE l.document_id = d.id AND l.line_type = 'ITEM'
    );
  END IF;

  -- project_checklist_items -> CHECKLIST headers (grouped by project) & detail lines
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_checklist_items') THEN
    INSERT INTO public.inventory_documents (
      id, doc_number, doc_type, project_id, title, status, metadata, created_at, updated_at
    )
    SELECT
      ('00000000-0000-5000-8000-' || LPAD(TO_HEX(dense_rank() OVER (ORDER BY pci.project_id)), 12, '0'))::uuid,
      'CHK-' || pci.project_id,
      'CHECKLIST',
      pci.project_id,
      'Project Checklist ' || pci.project_id,
      'COMPLETED',
      jsonb_build_object('legacy_table', 'project_checklist_items'),
      MIN(pci.created_at),
      MAX(pci.updated_at)
    FROM public.project_checklist_items pci
    GROUP BY pci.project_id
    ON CONFLICT (doc_type, doc_number) DO NOTHING;

    INSERT INTO public.inventory_document_lines (
      id, document_id, line_type, project_id, item_id, description, unit,
      required_qty, quantity, submitted_qty, returned_qty, rejected_qty,
      status, notes, metadata, created_at, updated_at
    )
    SELECT
      ids.target_id,
      (SELECT d.id FROM public.inventory_documents d WHERE d.doc_type = 'CHECKLIST' AND d.doc_number = 'CHK-' || pci.project_id LIMIT 1),
      'CHECKLIST',
      pci.project_id,
      pci.item_id,
      pci.item_name,
      pci.unit,
      pci.required_qty,
      pci.required_qty,
      pci.picked_qty,
      pci.returned_qty,
      pci.damaged_qty,
      CASE WHEN pci.is_checked THEN 'checked' ELSE 'unchecked' END,
      pci.notes,
      jsonb_build_object(
        'legacy_table', 'project_checklist_items',
        'legacy_id', pci.id::text,
        'category_name', pci.category_name,
        'item_type', pci.item_type,
        'unit_cost', pci.unit_cost,
        'assigned_codes', pci.assigned_codes,
        'is_checked', pci.is_checked
      ),
      pci.created_at,
      pci.updated_at
    FROM public.project_checklist_items pci
    JOIN _legacy_checklist_ids ids ON ids.legacy_id = pci.id::text
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Existing schemas may still have deletion actions that erase audit lineage.
DO $$
DECLARE v_fk RECORD; v_definition TEXT;
BEGIN
  FOR v_fk IN
    SELECT c.conrelid::regclass AS relation_name, c.conname, pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c
    WHERE c.contype = 'f' AND c.confdeltype IN ('c', 'n')
      AND c.conrelid IN ('public.inventory_documents'::regclass,
                        'public.inventory_document_lines'::regclass,
                        'public.inventory_movements'::regclass,
                        'public.asset_units'::regclass)
    ORDER BY c.conrelid, c.conname
  LOOP
    v_definition := regexp_replace(v_fk.definition, 'ON DELETE (CASCADE|SET NULL)', 'ON DELETE RESTRICT');
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', v_fk.relation_name, v_fk.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', v_fk.relation_name, v_fk.conname, v_definition);
  END LOOP;
END $$;

-- 6. STRICT INVARIANT AND ID COVERAGE VALIDATION
-- Verifies exact ID coverage, stock balances, cash totals, active custodies, and work outputs.
-- Any assertion failure throws an exception and rolls back the entire transaction.
DO $$
DECLARE
  v_missing_cnt INT;
  v_source_sum NUMERIC;
  v_target_sum NUMERIC;
  v_target_issued NUMERIC;
  v_target_prepared NUMERIC;
  v_target_returned NUMERIC;
  v_target_handed NUMERIC;
  v_rec RECORD;
BEGIN
  -- 6.1 ID Coverage Assertions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_material_recoveries') THEN
    SELECT count(*) INTO v_missing_cnt
    FROM public.inventory_material_recoveries r
    WHERE NOT EXISTS (SELECT 1 FROM public.inventory_document_lines l WHERE l.id = r.id);
    IF v_missing_cnt > 0 THEN
      RAISE EXCEPTION 'Validation failed: % inventory_material_recoveries missing from inventory_document_lines', v_missing_cnt;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'asset_unit_custody') THEN
    SELECT count(*) INTO v_missing_cnt
    FROM public.asset_unit_custody c
    WHERE NOT EXISTS (SELECT 1 FROM public.inventory_document_lines l WHERE l.id = c.id);
    IF v_missing_cnt > 0 THEN
      RAISE EXCEPTION 'Validation failed: % asset_unit_custody missing from inventory_document_lines', v_missing_cnt;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cash_movements') THEN
    SELECT count(*) INTO v_missing_cnt
    FROM public.cash_movements cm
    WHERE NOT EXISTS (SELECT 1 FROM public.inventory_movements m WHERE m.id = cm.id);
    IF v_missing_cnt > 0 THEN
      RAISE EXCEPTION 'Validation failed: % cash_movements missing from inventory_movements', v_missing_cnt;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'production_assignments') THEN
    SELECT count(*) INTO v_missing_cnt
    FROM public.production_assignments pa
    WHERE NOT EXISTS (SELECT 1 FROM public.inventory_documents d WHERE d.id = pa.id);
    IF v_missing_cnt > 0 THEN
      RAISE EXCEPTION 'Validation failed: % production_assignments missing from inventory_documents', v_missing_cnt;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'production_assignment_lines') THEN
    SELECT count(*) INTO v_missing_cnt
    FROM public.production_assignment_lines pal
    WHERE NOT EXISTS (SELECT 1 FROM public.inventory_document_lines l WHERE l.id = pal.id);
    IF v_missing_cnt > 0 THEN
      RAISE EXCEPTION 'Validation failed: % production_assignment_lines missing from inventory_document_lines', v_missing_cnt;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'production_submissions') THEN
    SELECT count(*) INTO v_missing_cnt
    FROM public.production_submissions ps
    WHERE NOT EXISTS (SELECT 1 FROM public.inventory_documents d WHERE d.id = ps.id);
    IF v_missing_cnt > 0 THEN
      RAISE EXCEPTION 'Validation failed: % production_submissions missing from inventory_documents', v_missing_cnt;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'production_submission_lines') THEN
    SELECT count(*) INTO v_missing_cnt
    FROM public.production_submission_lines psl
    WHERE NOT EXISTS (SELECT 1 FROM public.inventory_document_lines l WHERE l.id = psl.id);
    IF v_missing_cnt > 0 THEN
      RAISE EXCEPTION 'Validation failed: % production_submission_lines missing from inventory_document_lines', v_missing_cnt;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'production_inspections') THEN
    SELECT count(*) INTO v_missing_cnt
    FROM public.production_inspections pi
    WHERE NOT EXISTS (SELECT 1 FROM public.inventory_documents d WHERE d.id = pi.id);
    IF v_missing_cnt > 0 THEN
      RAISE EXCEPTION 'Validation failed: % production_inspections missing from inventory_documents', v_missing_cnt;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'production_inspection_lines') THEN
    SELECT count(*) INTO v_missing_cnt
    FROM public.production_inspection_lines pil
    WHERE NOT EXISTS (SELECT 1 FROM public.inventory_document_lines l WHERE l.id = pil.id);
    IF v_missing_cnt > 0 THEN
      RAISE EXCEPTION 'Validation failed: % production_inspection_lines missing from inventory_document_lines', v_missing_cnt;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'production_assignment_events') THEN
    SELECT count(*) INTO v_missing_cnt
    FROM public.production_assignment_events pae
    WHERE NOT EXISTS (SELECT 1 FROM public.inventory_movements m WHERE m.id = pae.id);
    IF v_missing_cnt > 0 THEN
      RAISE EXCEPTION 'Validation failed: % production_assignment_events missing from inventory_movements', v_missing_cnt;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_checklist_items') THEN
    SELECT count(*) INTO v_missing_cnt
    FROM public.project_checklist_items pci
    JOIN _legacy_checklist_ids ids ON ids.legacy_id = pci.id::text
    WHERE NOT EXISTS (SELECT 1 FROM public.inventory_document_lines l
      WHERE l.id = ids.target_id AND l.line_type = 'CHECKLIST' AND l.metadata->>'legacy_id' = pci.id::text);
    IF v_missing_cnt > 0 THEN
      RAISE EXCEPTION 'Validation failed: % project_checklist_items missing from inventory_document_lines', v_missing_cnt;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_idempotency_records') THEN
    SELECT count(*) INTO v_missing_cnt
    FROM public.inventory_idempotency_records ir
    WHERE NOT EXISTS (SELECT 1 FROM public.inventory_documents d WHERE d.idempotency_key = ir.idempotency_key);
    IF v_missing_cnt > 0 THEN
      RAISE EXCEPTION 'Validation failed: % inventory_idempotency_records missing from inventory_documents', v_missing_cnt;
    END IF;
  END IF;

  -- 6.2 Per-Denomination Totals Validation
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cash_helper_batches') THEN
    FOR v_rec IN (
      SELECT
        b.denomination,
        SUM(b.issued_count) AS exp_issued,
        SUM(b.prepared_count) AS exp_prepared,
        SUM(b.returned_raw_count) AS exp_returned,
        SUM(b.handed_over_count) AS exp_handed
      FROM public.cash_helper_batches b
      GROUP BY b.denomination
    ) LOOP
      SELECT
        COALESCE(SUM(l.quantity), 0),
        COALESCE(SUM(l.accepted_qty), 0),
        COALESCE(SUM(l.returned_qty), 0),
        COALESCE(SUM(l.handed_over_qty), 0)
      INTO v_target_issued, v_target_prepared, v_target_returned, v_target_handed
      FROM public.inventory_document_lines l
      WHERE l.line_type = 'CASH_BATCH' AND l.denomination = v_rec.denomination;

      IF v_target_issued != v_rec.exp_issued 
         OR v_target_prepared != v_rec.exp_prepared 
         OR v_target_returned != v_rec.exp_returned 
         OR v_target_handed != v_rec.exp_handed THEN
        RAISE EXCEPTION 'Denomination % batch totals mismatch: issued (% != %), prepared (% != %), returned (% != %), handed (% != %)',
          v_rec.denomination, v_target_issued, v_rec.exp_issued, v_target_prepared, v_rec.exp_prepared, v_target_returned, v_rec.exp_returned, v_target_handed, v_rec.exp_handed;
      END IF;
    END LOOP;
  END IF;

  -- Cash job reservations check
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cash_job_reservations') THEN
    FOR v_rec IN (
      SELECT r.project_id, r.denomination, r.reserved_count FROM public.cash_job_reservations r
    ) LOOP
      SELECT COALESCE(SUM(l.quantity), 0) INTO v_target_sum
      FROM public.inventory_document_lines l
      WHERE l.line_type = 'CASH_RESERVATION' AND l.project_id = v_rec.project_id AND l.denomination = v_rec.denomination;
      IF v_target_sum != v_rec.reserved_count THEN
        RAISE EXCEPTION 'Cash reservation mismatch for project %, denom %: % != %', v_rec.project_id, v_rec.denomination, v_target_sum, v_rec.reserved_count;
      END IF;
    END LOOP;
  END IF;

  -- Cash prepared sets check
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cash_prepared_sets') THEN
    FOR v_rec IN (
      SELECT p.project_id, p.denomination, p.prepared_count, p.delivered_count FROM public.cash_prepared_sets p
    ) LOOP
      SELECT COALESCE(SUM(l.quantity), 0), COALESCE(SUM(l.delivered_qty), 0)
      INTO v_target_prepared, v_target_handed
      FROM public.inventory_document_lines l
      WHERE l.line_type = 'CASH_PREPARED' AND l.project_id = v_rec.project_id AND l.denomination = v_rec.denomination;
      IF v_target_prepared != v_rec.prepared_count OR v_target_handed != v_rec.delivered_count THEN
        RAISE EXCEPTION 'Cash prepared set mismatch for project %, denom %: prepared (% != %), delivered (% != %)',
          v_rec.project_id, v_rec.denomination, v_target_prepared, v_rec.prepared_count, v_target_handed, v_rec.delivered_count;
      END IF;
    END LOOP;
  END IF;

  -- Cash vault denominations invariant check
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cash_vault_denominations') THEN
    SELECT count(*) INTO v_missing_cnt FROM public.cash_vault_denominations;
    IF v_missing_cnt != 5 THEN
      RAISE EXCEPTION 'Cash vault validation failed: expected 5 denominations, found %', v_missing_cnt;
    END IF;
    IF EXISTS (SELECT 1 FROM public.cash_vault_denominations WHERE physical_count < 0 OR reserved_count < 0 OR reserved_count > physical_count) THEN
      RAISE EXCEPTION 'Cash vault invariant validation failed: invalid physical or reserved count bounds';
    END IF;
  END IF;

  -- 6.3 Active Custody Count Validation
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'asset_unit_custody') THEN
    SELECT count(*) INTO v_source_sum 
    FROM public.asset_unit_custody c
    WHERE (
      ((to_jsonb(c) ? 'is_active') AND (to_jsonb(c)->>'is_active')::boolean = true) OR
      ((to_jsonb(c) ? 'status') AND upper(to_jsonb(c)->>'status') = 'ACTIVE')
    );
    SELECT count(*) INTO v_target_sum FROM public.asset_units WHERE active_custody_line_id IS NOT NULL;
    IF v_source_sum != v_target_sum THEN
      RAISE EXCEPTION 'Active custody count mismatch: source active % != target active %', v_source_sum, v_target_sum;
    END IF;
  END IF;

  -- 6.4 Production Output Accepted & Pending Totals Validation
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'production_assignment_lines') THEN
    SELECT COALESCE(SUM(accepted_qty), 0), COALESCE(SUM(pending_qty), 0)
    INTO v_source_sum, v_target_sum
    FROM public.production_assignment_lines;

    IF EXISTS (
      SELECT 1 FROM (
        SELECT COALESCE(SUM(accepted_qty), 0) AS a, COALESCE(SUM(pending_qty), 0) AS p
        FROM public.inventory_document_lines
        WHERE line_type = 'WORK_OUTPUT'
      ) t WHERE t.a != v_source_sum OR t.p != v_target_sum
    ) THEN
      RAISE EXCEPTION 'Production output accepted/pending totals validation failed';
    END IF;
  END IF;
END $$;

-- 7. RETIRE EXPLICIT LEGACY TABLES (NO CASCADE)
-- Dropped in reverse-dependency order with RESTRICT semantics.
-- If any unknown external table depends on them, the drop aborts and rolls back.
DROP TABLE IF EXISTS public.production_inspection_lines RESTRICT;
DROP TABLE IF EXISTS public.production_inspections RESTRICT;
DROP TABLE IF EXISTS public.production_submission_lines RESTRICT;
DROP TABLE IF EXISTS public.production_submissions RESTRICT;
DROP TABLE IF EXISTS public.production_assignment_events RESTRICT;
DROP TABLE IF EXISTS public.production_assignment_lines RESTRICT;
DROP TABLE IF EXISTS public.production_assignments RESTRICT;

DROP TABLE IF EXISTS public.cash_movements RESTRICT;
DROP TABLE IF EXISTS public.cash_prepared_sets RESTRICT;
DROP TABLE IF EXISTS public.cash_helper_batches RESTRICT;
DROP TABLE IF EXISTS public.cash_job_reservations RESTRICT;

DROP TABLE IF EXISTS public.inventory_idempotency_records RESTRICT;
DROP TABLE IF EXISTS public.inventory_incidents RESTRICT;
DROP TABLE IF EXISTS public.asset_unit_custody RESTRICT;
DROP TABLE IF EXISTS public.inventory_material_recoveries RESTRICT;
DROP TABLE IF EXISTS public.inventory_field_round_projects RESTRICT;
DROP TABLE IF EXISTS public.inventory_field_rounds RESTRICT;
DROP TABLE IF EXISTS public.inventory_recipient_teams RESTRICT;

DROP TABLE IF EXISTS public.asset_loans RESTRICT;
DROP TABLE IF EXISTS public.inventory_procurements RESTRICT;
DROP TABLE IF EXISTS public.inventory_disposals RESTRICT;
DROP TABLE IF EXISTS public.project_checklist_items RESTRICT;

-- 8. SYSTEM MIGRATION MARKER
-- Version marker document with metadata snapshot; no permanent archives or views.
INSERT INTO public.inventory_documents (
  id, doc_number, doc_type, title, status, metadata, created_at, updated_at
)
VALUES (
  '00000000-0000-5000-a000-000000000002'::uuid,
  'MIG-COMPACT-SCHEMA-V2',
  'SYSTEM_MIGRATION',
  'Inventory Compact Schema Migration v2',
  'COMPLETED',
  jsonb_build_object(
    'version', 2,
    'compact_build', 'v2',
    'table_count', 8,
    'retired_table_count', 22,
    'migrated_at', timezone('utc'::text, now())
  ),
  timezone('utc'::text, now()),
  timezone('utc'::text, now())
)
ON CONFLICT (doc_type, doc_number) DO UPDATE SET
  updated_at = timezone('utc'::text, now()),
  metadata = EXCLUDED.metadata;

-- 9. FINAL VERIFICATION: EXACTLY 8 CANONICAL TABLES AND ZERO RETIRED TABLES
DO $$
DECLARE
  v_inv_table_cnt INT;
  v_retired_cnt INT;
BEGIN
  SELECT count(*) INTO v_inv_table_cnt
  FROM information_schema.tables
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
    );

  IF v_inv_table_cnt != 8 THEN
    RAISE EXCEPTION 'Table count assertion failed: expected 8 canonical inventory tables, found %', v_inv_table_cnt;
  END IF;

  SELECT count(*) INTO v_retired_cnt
  FROM information_schema.tables
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

  IF v_retired_cnt > 0 THEN
    RAISE EXCEPTION 'Retired tables assertion failed: % retired tables still present in schema', v_retired_cnt;
  END IF;
END $$;

-- ==============================================================================
-- FLOWER2U (F2U) — COMPACT CORE TRANSACTIONAL ENGINE (Part 2 of 3)
-- Target: 8 Compact Tables Architecture (Contract v2)
-- Guard: flower.compact_build = 'v2' fail-closed
-- Notice: No BEGIN / COMMIT in this part file. The final assembler wraps all parts.
-- ==============================================================================

DO $$
BEGIN
    IF current_setting('flower.compact_build', true) IS DISTINCT FROM 'v2' THEN
        RAISE EXCEPTION 'flower.compact_build="v2" required to assemble compact_core.sql.part';
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 1. SECURITY DEFINERS, PERMISSIONS & ANTI-ESCALATION
-- ------------------------------------------------------------------------------

-- Helper 1.1: Verify if authenticated user is Administrator
CREATE OR REPLACE FUNCTION public.fn_is_admin(p_auth_uid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_role_name TEXT;
    v_curr_role TEXT;
    v_sess_role TEXT;
BEGIN
    v_sess_role := session_user;
    v_curr_role := coalesce(current_setting('role', true), v_sess_role);

    IF v_sess_role IN ('authenticated', 'anon') OR v_curr_role IN ('authenticated', 'anon') THEN
        IF p_auth_uid IS NULL THEN
            RETURN FALSE;
        END IF;
    ELSIF p_auth_uid IS NULL THEN
        -- Maintenance connection without web JWT (postgres, supabase_admin)
        RETURN TRUE;
    END IF;

    IF p_auth_uid IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT r.name INTO v_role_name
    FROM public.staff_users su
    JOIN public.roles r ON su.role_id = r.id
    WHERE su.auth_user_id = p_auth_uid
      AND su.is_active = TRUE
    LIMIT 1;

    RETURN coalesce(v_role_name = 'admin', FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- Helper 1.2: Check if user has Inventory access
CREATE OR REPLACE FUNCTION public.fn_can_access_inventory(p_auth_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_role RECORD;
BEGIN
    IF p_auth_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT r.name, r.allowed_pages, r.can_borrow_tools INTO v_role
    FROM public.staff_users su
    JOIN public.roles r ON su.role_id = r.id
    WHERE su.auth_user_id = p_auth_user_id
      AND su.is_active = TRUE
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    IF v_role.name = 'admin' THEN
        RETURN TRUE;
    END IF;

    IF v_role.allowed_pages @> '{"Inventory"}' OR v_role.can_borrow_tools = TRUE THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- Helper 1.3: Check if user has Cash management access (Admin or Accountant only)
CREATE OR REPLACE FUNCTION public.fn_can_manage_cash(p_auth_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_role_name TEXT;
BEGIN
    IF p_auth_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT r.name INTO v_role_name
    FROM public.staff_users su
    JOIN public.roles r ON su.role_id = r.id
    WHERE su.auth_user_id = p_auth_user_id
      AND su.is_active = TRUE
    LIMIT 1;

    IF v_role_name IN ('admin', 'accountant') THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- Helper 1.4: Canonical action + payload hash
CREATE OR REPLACE FUNCTION public.fn_hash_action_payload(p_action TEXT, p_payload JSONB)
RETURNS TEXT AS $$
BEGIN
    RETURN md5(coalesce(p_action, '') || '::' || coalesce(p_payload::text, ''));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger Guards: Anti-escalation protection for staff_users & roles
CREATE OR REPLACE FUNCTION public.trg_guard_staff_users_escalation()
RETURNS TRIGGER AS $$
DECLARE
    v_caller_uid UUID;
    v_caller_is_admin BOOLEAN;
BEGIN
    v_caller_uid := auth.uid();
    v_caller_is_admin := coalesce(public.fn_is_admin(v_caller_uid), FALSE);

    IF NOT v_caller_is_admin THEN
        IF v_caller_uid IS NULL THEN
            RAISE EXCEPTION 'Unauthorized: Unauthenticated callers cannot modify staff records';
        END IF;

        IF OLD.auth_user_id IS DISTINCT FROM v_caller_uid THEN
            RAISE EXCEPTION 'Unauthorized: Non-admin staff cannot modify other staff records';
        END IF;

        IF NEW.role_id IS DISTINCT FROM OLD.role_id THEN
            RAISE EXCEPTION 'Unauthorized: Non-admin staff cannot modify role_id';
        END IF;
        IF NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id THEN
            RAISE EXCEPTION 'Unauthorized: Non-admin staff cannot modify auth_user_id';
        END IF;
        IF NEW.id::text IS DISTINCT FROM OLD.id::text THEN
            RAISE EXCEPTION 'Unauthorized: Non-admin staff cannot modify user id';
        END IF;
        IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
            RAISE EXCEPTION 'Unauthorized: Non-admin staff cannot modify active status';
        END IF;

        IF (to_jsonb(NEW) - ARRAY['nickname', 'phone', 'profile_image_url', 'address', 'emergency_contact', 'full_name', 'username', 'email', 'updated_at'])
           IS DISTINCT FROM
           (to_jsonb(OLD) - ARRAY['nickname', 'phone', 'profile_image_url', 'address', 'emergency_contact', 'full_name', 'username', 'email', 'updated_at'])
        THEN
            RAISE EXCEPTION 'Unauthorized: Non-admin staff cannot modify permissions or privileged fields';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_guard_staff_users_escalation ON public.staff_users;
CREATE TRIGGER trg_guard_staff_users_escalation
BEFORE UPDATE ON public.staff_users
FOR EACH ROW
EXECUTE FUNCTION public.trg_guard_staff_users_escalation();

CREATE OR REPLACE FUNCTION public.trg_guard_staff_users_dml()
RETURNS TRIGGER AS $$
DECLARE
    v_caller_uid UUID;
    v_caller_is_admin BOOLEAN;
BEGIN
    v_caller_uid := auth.uid();
    v_caller_is_admin := coalesce(public.fn_is_admin(v_caller_uid), FALSE);

    IF NOT v_caller_is_admin THEN
        RAISE EXCEPTION 'Unauthorized: Only administrators can create or delete staff users';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_guard_staff_users_dml ON public.staff_users;
CREATE TRIGGER trg_guard_staff_users_dml
BEFORE INSERT OR DELETE ON public.staff_users
FOR EACH ROW
EXECUTE FUNCTION public.trg_guard_staff_users_dml();

CREATE OR REPLACE FUNCTION public.trg_guard_roles_dml()
RETURNS TRIGGER AS $$
DECLARE
    v_caller_uid UUID;
    v_caller_is_admin BOOLEAN;
BEGIN
    v_caller_uid := auth.uid();
    v_caller_is_admin := coalesce(public.fn_is_admin(v_caller_uid), FALSE);

    IF NOT v_caller_is_admin THEN
        RAISE EXCEPTION 'Unauthorized: Only administrators can modify roles';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_guard_roles_dml ON public.roles;
CREATE TRIGGER trg_guard_roles_dml
BEFORE INSERT OR UPDATE OR DELETE ON public.roles
FOR EACH ROW
EXECUTE FUNCTION public.trg_guard_roles_dml();

REVOKE ALL ON public.roles FROM anon, PUBLIC;
REVOKE ALL ON public.staff_users FROM anon, PUBLIC;
GRANT SELECT ON public.roles TO authenticated;
GRANT SELECT, UPDATE ON public.staff_users TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. ROW LEVEL SECURITY (RLS) & GRANTS ON 8 CANONICAL TABLES
-- ------------------------------------------------------------------------------

ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_document_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_vault_denominations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.inventory_categories FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.inventory_items FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.asset_units FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.inventory_recipients FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.inventory_documents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.inventory_document_lines FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.inventory_movements FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.cash_vault_denominations FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.inventory_categories TO authenticated;
GRANT SELECT ON public.inventory_items TO authenticated;
GRANT SELECT ON public.asset_units TO authenticated;
GRANT SELECT ON public.inventory_recipients TO authenticated;
GRANT SELECT ON public.inventory_documents TO authenticated;
GRANT SELECT ON public.inventory_document_lines TO authenticated;
GRANT SELECT ON public.inventory_movements TO authenticated;
GRANT SELECT ON public.cash_vault_denominations TO authenticated;

DROP POLICY IF EXISTS "Compact authenticated read" ON public.inventory_categories;
CREATE POLICY "Compact authenticated read" ON public.inventory_categories
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Compact authenticated read" ON public.inventory_items;
CREATE POLICY "Compact authenticated read" ON public.inventory_items
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Compact authenticated read" ON public.asset_units;
CREATE POLICY "Compact authenticated read" ON public.asset_units
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Compact authenticated read" ON public.inventory_recipients;
CREATE POLICY "Compact authenticated read" ON public.inventory_recipients
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Compact authenticated read" ON public.inventory_documents;
CREATE POLICY "Compact authenticated read" ON public.inventory_documents
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Compact authenticated read" ON public.inventory_document_lines;
CREATE POLICY "Compact authenticated read" ON public.inventory_document_lines
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Compact authenticated read" ON public.inventory_movements;
CREATE POLICY "Compact authenticated read" ON public.inventory_movements
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Compact authenticated read" ON public.cash_vault_denominations;
CREATE POLICY "Compact authenticated read" ON public.cash_vault_denominations
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Inventory access select inventory_categories" ON public.inventory_categories;
CREATE POLICY "Inventory access select inventory_categories" ON public.inventory_categories
    AS RESTRICTIVE FOR SELECT TO authenticated USING (public.fn_can_access_inventory(auth.uid()));

DROP POLICY IF EXISTS "Inventory access select inventory_items" ON public.inventory_items;
CREATE POLICY "Inventory access select inventory_items" ON public.inventory_items
    AS RESTRICTIVE FOR SELECT TO authenticated USING (
        public.fn_can_access_inventory(auth.uid())
        AND (lower(item_type) != 'banknote' OR public.fn_can_manage_cash(auth.uid()))
    );

DROP POLICY IF EXISTS "Inventory access select asset_units" ON public.asset_units;
CREATE POLICY "Inventory access select asset_units" ON public.asset_units
    AS RESTRICTIVE FOR SELECT TO authenticated USING (public.fn_can_access_inventory(auth.uid()));

DROP POLICY IF EXISTS "Inventory access select inventory_recipients" ON public.inventory_recipients;
CREATE POLICY "Inventory access select inventory_recipients" ON public.inventory_recipients
    AS RESTRICTIVE FOR SELECT TO authenticated USING (public.fn_can_access_inventory(auth.uid()));

DROP POLICY IF EXISTS "Unified access select inventory_documents" ON public.inventory_documents;
CREATE POLICY "Unified access select inventory_documents" ON public.inventory_documents
    AS RESTRICTIVE FOR SELECT TO authenticated USING (
        (NOT coalesce(is_cash, false) AND doc_type NOT LIKE 'CASH_%' AND public.fn_can_access_inventory(auth.uid()))
        OR ((coalesce(is_cash, false) OR doc_type LIKE 'CASH_%') AND public.fn_can_manage_cash(auth.uid()))
        OR public.fn_is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Unified access select inventory_document_lines" ON public.inventory_document_lines;
CREATE POLICY "Unified access select inventory_document_lines" ON public.inventory_document_lines
    AS RESTRICTIVE FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.inventory_documents d WHERE d.id = document_id
            AND (((NOT coalesce(d.is_cash, false) AND d.doc_type NOT LIKE 'CASH_%'
                    AND line_type NOT LIKE 'CASH_%' AND denomination IS NULL)
                   AND public.fn_can_access_inventory(auth.uid()))
              OR public.fn_can_manage_cash(auth.uid())))
        OR public.fn_is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Unified access select inventory_movements" ON public.inventory_movements;
CREATE POLICY "Unified access select inventory_movements" ON public.inventory_movements
    AS RESTRICTIVE FOR SELECT TO authenticated USING (
        (NOT coalesce(is_cash, false) AND denomination IS NULL AND movement_type NOT LIKE 'CASH_%'
          AND (document_id IS NULL OR EXISTS (SELECT 1 FROM public.inventory_documents d WHERE d.id = document_id))
          AND public.fn_can_access_inventory(auth.uid()))
        OR ((coalesce(is_cash, false) OR movement_type LIKE 'CASH_%') AND public.fn_can_manage_cash(auth.uid()))
        OR public.fn_is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Cash access select cash_vault_denominations" ON public.cash_vault_denominations;
CREATE POLICY "Cash access select cash_vault_denominations" ON public.cash_vault_denominations
    AS RESTRICTIVE FOR SELECT TO authenticated USING (public.fn_can_manage_cash(auth.uid()));

-- ------------------------------------------------------------------------------
-- 3. SHARED HELPER CONTRACTS (Core implements, Production consumes)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.warehouse_command_lookup(
    p_action TEXT,
    p_hash TEXT,
    p_key UUID,
    p_is_cash BOOLEAN DEFAULT false
)
RETURNS JSONB AS $$
DECLARE
    v_auth_uid UUID;
    v_doc RECORD;
BEGIN
    IF p_key IS NULL THEN
        RAISE EXCEPTION 'Idempotency key (UUID) is strictly required';
    END IF;

    -- Serialize concurrent executions of identical request key
    PERFORM pg_advisory_xact_lock(hashtext(p_key::text));

    v_auth_uid := auth.uid();
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required to execute warehouse actions';
    END IF;

    IF p_is_cash THEN
        IF NOT public.fn_can_manage_cash(v_auth_uid) THEN
            RAISE EXCEPTION 'Unauthorized: Cash management permissions required for %', p_action;
        END IF;
    ELSE
        IF NOT public.fn_can_access_inventory(v_auth_uid) THEN
            RAISE EXCEPTION 'Unauthorized: Inventory access permissions required for %', p_action;
        END IF;
    END IF;

    -- Look up existing command or business document matching key
    SELECT id, actor_auth_user_id, action_name, idempotency_payload_hash, response_payload, is_cash
    INTO v_doc
    FROM public.inventory_documents
    WHERE idempotency_key = p_key
    LIMIT 1;

    IF FOUND THEN
        IF v_doc.is_cash AND NOT public.fn_can_manage_cash(v_auth_uid) THEN
            RAISE EXCEPTION 'Unauthorized access to cached cash transaction';
        END IF;

        IF v_doc.action_name = p_action 
           AND v_doc.idempotency_payload_hash = p_hash 
           AND v_doc.actor_auth_user_id = v_auth_uid 
        THEN
            RETURN v_doc.response_payload;
        ELSE
            RAISE EXCEPTION 'Idempotency key % reused with mismatched action, payload or actor', p_key;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.warehouse_command_lookup(TEXT, TEXT, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.warehouse_command_finish(
    p_action TEXT,
    p_hash TEXT,
    p_key UUID,
    p_response JSONB,
    p_document_id UUID DEFAULT NULL,
    p_is_cash BOOLEAN DEFAULT false
)
RETURNS JSONB AS $$
DECLARE
    v_auth_uid UUID;
    v_actor_name TEXT;
    v_doc RECORD;
    v_cmd_number TEXT;
BEGIN
    v_auth_uid := auth.uid();
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required to finish warehouse command';
    END IF;

    SELECT coalesce(full_name, username) INTO v_actor_name
    FROM public.staff_users
    WHERE auth_user_id = v_auth_uid AND is_active = TRUE
    LIMIT 1;

    IF v_actor_name IS NULL THEN
        RAISE EXCEPTION 'Active staff mapping not found. Fail closed.';
    END IF;

    IF p_document_id IS NOT NULL THEN
        SELECT id, idempotency_key INTO v_doc
        FROM public.inventory_documents
        WHERE id = p_document_id
        FOR UPDATE;

        IF FOUND THEN
            IF v_doc.idempotency_key IS NULL OR v_doc.idempotency_key = p_key THEN
                -- Attach cached response directly to this new semantic business document
                UPDATE public.inventory_documents
                SET idempotency_key = p_key,
                    idempotency_payload_hash = p_hash,
                    action_name = p_action,
                    response_payload = p_response,
                    updated_at = timezone('utc'::text, now())
                WHERE id = p_document_id;

                RETURN p_response;
            ELSE
                -- Document already carries a DIFFERENT creation key; create child COMMAND header to avoid overwriting
                v_cmd_number := 'CMD-' || to_char(now(), 'YYYYMMDD-HH24MISS-') || substring(gen_random_uuid()::text, 1, 6);
                INSERT INTO public.inventory_documents (
                    doc_number, doc_type, parent_document_id, idempotency_key, idempotency_payload_hash,
                    action_name, response_payload, actor_auth_user_id, actor_name_snapshot, is_cash
                ) VALUES (
                    v_cmd_number, 'COMMAND', p_document_id, p_key, p_hash,
                    p_action, p_response, v_auth_uid, v_actor_name, p_is_cash
                ) ON CONFLICT (idempotency_key) DO UPDATE SET
                    action_name = EXCLUDED.action_name,
                    response_payload = EXCLUDED.response_payload;

                RETURN p_response;
            END IF;
        END IF;
    END IF;

    -- Standalone command record (or legacy request lacking a primary business document)
    v_cmd_number := 'CMD-' || to_char(now(), 'YYYYMMDD-HH24MISS-') || substring(gen_random_uuid()::text, 1, 6);
    INSERT INTO public.inventory_documents (
        doc_number, doc_type, idempotency_key, idempotency_payload_hash,
        action_name, response_payload, actor_auth_user_id, actor_name_snapshot, is_cash
    ) VALUES (
        v_cmd_number, 'COMMAND', p_key, p_hash,
        p_action, p_response, v_auth_uid, v_actor_name, p_is_cash
    ) ON CONFLICT (idempotency_key) DO UPDATE SET
        action_name = EXCLUDED.action_name,
        response_payload = EXCLUDED.response_payload;

    RETURN p_response;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.warehouse_command_finish(TEXT, TEXT, UUID, JSONB, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;

-- Placeholder forward declarations for production hooks (production agent overrides in part 3)
CREATE OR REPLACE FUNCTION public.warehouse_ensure_production_work(p_issue_document_id UUID)
RETURNS UUID AS $$
BEGIN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.warehouse_sync_cash_work(p_batch_document_id UUID)
RETURNS VOID AS $$
BEGIN
    RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.warehouse_ensure_production_work(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.warehouse_sync_cash_work(UUID) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 4. UNIFIED TRANSACTIONAL COMMAND DISPATCHER (warehouse_dispatch)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.warehouse_dispatch(
    p_action TEXT,
    p_payload JSONB,
    p_idempotency_key UUID
)
RETURNS JSONB AS $$
DECLARE
    v_auth_uid UUID;
    v_actor_name TEXT;
    v_payload_hash TEXT;
    v_cached JSONB;
    v_result JSONB;
    v_is_cash BOOLEAN;

    -- Identifiers and working variables
    v_doc_id UUID;
    v_doc_no TEXT;
    v_move_id UUID;
    v_line_id UUID;
    v_round_id UUID;
    v_batch_id UUID;
    v_batch_code TEXT;
    v_project_id TEXT;
    v_recipient_name TEXT;
    v_recipient_id UUID;
    v_item_id UUID;
    v_unit_code TEXT;

    -- Records
    v_item RECORD;
    v_unit RECORD;
    v_src_move RECORD;
    v_vault RECORD;
    v_batch RECORD;
    v_prep RECORD;
    v_custody RECORD;
    v_rec RECORD;

    -- Quantities and math
    v_qty NUMERIC(12,2);
    v_stock NUMERIC(12,2);
    v_delta NUMERIC(12,2);
    v_cum_returned NUMERIC(12,2);
    v_good_qty NUMERIC(12,2);
    v_damaged_qty NUMERIC(12,2);
    v_denom INT;
    v_note_count INT;
    v_use_res BOOLEAN;
    v_keep_res BOOLEAN;
    v_bool BOOLEAN;
    v_status TEXT;

    -- Iteration & Sorting arrays
    v_sorted_item_ids UUID[];
    v_sorted_src_move_ids UUID[];
    v_sorted_units TEXT[];
    v_pid_elem TEXT;
    v_arr_elem JSONB;
    v_movements_json JSONB := '[]'::jsonb;
    v_units_json JSONB := '[]'::jsonb;
    v_recoveries_json JSONB := '[]'::jsonb;

    -- Selective refresh sets
    v_affected_items UUID[] := '{}';
    v_affected_units TEXT[] := '{}';
    v_affected_projects TEXT[] := '{}';
    v_remaining_tools INT := 0;
    v_tool_count INT := 0;
BEGIN
    -- 1. Idempotency Check & Advisory Lock
    IF p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'Idempotency key (UUID) is strictly required for mutating operations';
    END IF;

    v_is_cash := (p_action LIKE 'cash_%');
    v_payload_hash := public.fn_hash_action_payload(p_action, p_payload);

    v_cached := public.warehouse_command_lookup(p_action, v_payload_hash, p_idempotency_key, v_is_cash);
    IF v_cached IS NOT NULL THEN
        RETURN v_cached;
    END IF;

    v_auth_uid := auth.uid();
    SELECT coalesce(full_name, username) INTO v_actor_name
    FROM public.staff_users
    WHERE auth_user_id = v_auth_uid AND is_active = TRUE
    LIMIT 1;

    IF v_actor_name IS NULL THEN
        RAISE EXCEPTION 'Staff mapping not found or staff account is inactive. Fail closed.';
    END IF;

    -- 2. Dispatch Action
    CASE p_action

        -- =====================================================================
        -- 2.1 ATOMIC MIXED ISSUE (Cart with materials and tools in ONE transaction)
        -- =====================================================================
        WHEN 'issue_create', 'material_issue', 'tool_borrow' THEN
            v_recipient_name := trim(coalesce(p_payload->>'recipient_name', ''));
            IF v_recipient_name = '' THEN
                RAISE EXCEPTION 'Recipient name is required for issue';
            END IF;

            v_recipient_id := (p_payload->>'recipient_id')::uuid;
            IF v_recipient_id IS NULL THEN
                SELECT id INTO v_recipient_id
                FROM public.inventory_recipients
                WHERE lower(trim(name)) = lower(v_recipient_name) AND is_active = true
                LIMIT 1;
            END IF;

            v_status := coalesce(p_payload->>'issue_type', 'PRODUCTION_ISSUE');
            IF v_status NOT IN ('PRODUCTION_ISSUE', 'FIELD_ISSUE') THEN
                RAISE EXCEPTION 'Invalid issue_type: % (must be PRODUCTION_ISSUE or FIELD_ISSUE)', v_status;
            END IF;

            IF v_status = 'FIELD_ISSUE' THEN
                v_round_id := (p_payload->>'round_id')::uuid;
                IF v_round_id IS NULL THEN
                    IF trim(coalesce(p_payload->>'round_code', '')) = '' THEN
                        RAISE EXCEPTION 'Round code is required for new field round';
                    END IF;

                    INSERT INTO public.inventory_documents (
                        doc_number, doc_type, recipient_id, recipient_name_snapshot,
                        team_members_snapshot, title, due_at, notes, actor_auth_user_id, actor_name_snapshot
                    ) VALUES (
                        trim(p_payload->>'round_code'),
                        'FIELD_ROUND',
                        v_recipient_id,
                        v_recipient_name,
                        coalesce((SELECT array_agg(trim(x)) FROM jsonb_array_elements_text(p_payload->'team_members') t(x) WHERE trim(x) != ''), '{}'),
                        trim(coalesce(p_payload->>'round_title', 'Field Round ' || (p_payload->>'round_code'))),
                        coalesce((p_payload->>'expected_return_at')::timestamptz, (p_payload->>'due_date')::timestamptz),
                        p_payload->>'notes',
                        v_auth_uid,
                        v_actor_name
                    ) RETURNING id INTO v_round_id;

                    IF p_payload ? 'project_ids' THEN
                        FOR v_pid_elem IN SELECT jsonb_array_elements_text(p_payload->'project_ids')
                        LOOP
                            IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = v_pid_elem) THEN
                                RAISE EXCEPTION 'Project % does not exist', v_pid_elem;
                            END IF;
                            INSERT INTO public.inventory_document_lines (
                                document_id, line_type, project_id, round_id, description
                            ) VALUES (
                                v_round_id, 'ROUND_PROJECT', v_pid_elem, v_round_id, 'Field round linked site'
                            );
                            v_affected_projects := array_append(v_affected_projects, v_pid_elem);
                        END LOOP;
                    END IF;
                END IF;

                v_doc_no := 'FLD-ISS-' || to_char(now(), 'YYYYMMDD-HH24MISS-') || substring(gen_random_uuid()::text, 1, 4);
                INSERT INTO public.inventory_documents (
                    doc_number, doc_type, round_id, recipient_id, recipient_name_snapshot,
                    team_members_snapshot, notes, actor_auth_user_id, actor_name_snapshot
                ) VALUES (
                    v_doc_no, 'FIELD_ISSUE', v_round_id, v_recipient_id, v_recipient_name,
                    coalesce((SELECT array_agg(trim(x)) FROM jsonb_array_elements_text(p_payload->'team_members') t(x) WHERE trim(x) != ''), '{}'),
                    p_payload->>'notes', v_auth_uid, v_actor_name
                ) RETURNING id INTO v_doc_id;

            ELSE
                v_project_id := p_payload->>'project_id';
                IF v_project_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.projects WHERE id = v_project_id) THEN
                    RAISE EXCEPTION 'Valid project_id is required for production issue';
                END IF;
                v_affected_projects := array_append(v_affected_projects, v_project_id);

                v_doc_no := 'PRD-ISS-' || to_char(now(), 'YYYYMMDD-HH24MISS-') || substring(gen_random_uuid()::text, 1, 4);
                INSERT INTO public.inventory_documents (
                    doc_number, doc_type, project_id, recipient_id, recipient_name_snapshot,
                    notes, actor_auth_user_id, actor_name_snapshot
                ) VALUES (
                    v_doc_no, 'PRODUCTION_ISSUE', v_project_id, v_recipient_id, v_recipient_name,
                    p_payload->>'notes', v_auth_uid, v_actor_name
                ) RETURNING id INTO v_doc_id;
            END IF;

            -- Validate material_lines or tool_units presence
            IF (NOT p_payload ? 'material_lines' OR jsonb_array_length(p_payload->'material_lines') = 0)
               AND (NOT p_payload ? 'tool_units' OR jsonb_array_length(p_payload->'tool_units') = 0) THEN
                RAISE EXCEPTION 'Issue must contain at least one material line or tool unit';
            END IF;

            -- Process Material Lines (Deterministic locking order on item_id)
            IF p_payload ? 'material_lines' AND jsonb_array_length(p_payload->'material_lines') > 0 THEN
                SELECT array_agg((elem->>'item_id')::uuid ORDER BY (elem->>'item_id')::uuid)
                INTO v_sorted_item_ids
                FROM jsonb_array_elements(p_payload->'material_lines') elem;

                IF (SELECT count(DISTINCT x) FROM unnest(v_sorted_item_ids) x) < array_length(v_sorted_item_ids, 1) THEN
                    RAISE EXCEPTION 'Duplicate item entries in issue cart are rejected';
                END IF;

                FOREACH v_item_id IN ARRAY v_sorted_item_ids
                LOOP
                    SELECT (elem->>'quantity') INTO v_status
                    FROM jsonb_array_elements(p_payload->'material_lines') elem
                    WHERE (elem->>'item_id')::uuid = v_item_id;

                    IF v_status IS NULL OR v_status ~ '^[0-9]+(\.[0-9]+)?$' = FALSE THEN
                        RAISE EXCEPTION 'Material quantity must be finite positive number';
                    END IF;
                    v_qty := v_status::numeric;
                    IF v_qty <= 0 THEN
                        RAISE EXCEPTION 'Material quantity must be strictly greater than 0';
                    END IF;

                    SELECT id, current_stock, name, item_type, is_active, color, size, unit INTO v_item
                    FROM public.inventory_items
                    WHERE id = v_item_id
                    FOR UPDATE;

                    IF NOT FOUND THEN
                        RAISE EXCEPTION 'Item with ID % not found', v_item_id;
                    END IF;

                    IF NOT v_item.is_active THEN
                        RAISE EXCEPTION 'Cannot issue inactive item %', v_item_id;
                    END IF;

                    IF lower(v_item.item_type) NOT IN ('consumable', 'reusable', 'reusable_material') THEN
                        RAISE EXCEPTION 'Only consumable or reusable materials can be issued via material lines (item % is %)',
                            v_item_id, v_item.item_type;
                    END IF;

                    IF v_item.current_stock < v_qty THEN
                        RAISE EXCEPTION 'Insufficient stock for item % (Requested: %, Available: %)',
                            v_item_id, v_qty, v_item.current_stock;
                    END IF;

                    UPDATE public.inventory_items
                    SET current_stock = current_stock - v_qty,
                        updated_at = timezone('utc'::text, now())
                    WHERE id = v_item_id;

                    INSERT INTO public.inventory_document_lines (
                        document_id, line_type, item_id, project_id, round_id,
                        description, unit, quantity, status
                    ) VALUES (
                        v_doc_id, 'ITEM', v_item_id, v_project_id, v_round_id,
                        v_item.name, v_item.unit, v_qty, 'ISSUED'
                    ) RETURNING id INTO v_line_id;

                    INSERT INTO public.inventory_movements (
                        document_id, line_id, item_id, movement_type, quantity, delta_stock,
                        project_id, round_id, recipient_id, recipient_name_snapshot,
                        source_item_variant_snapshot, actor_auth_user_id, actor_name_snapshot
                    ) VALUES (
                        v_doc_id, v_line_id, v_item_id, 'ISSUE', v_qty, -v_qty,
                        v_project_id, v_round_id, v_recipient_id, v_recipient_name,
                        jsonb_build_object('name', v_item.name, 'color', v_item.color, 'size', v_item.size, 'unit', v_item.unit),
                        v_auth_uid, v_actor_name
                    ) RETURNING id INTO v_move_id;

                    v_movements_json := v_movements_json || jsonb_build_object('id', v_move_id, 'item_id', v_item_id, 'quantity', v_qty);
                    v_affected_items := array_append(v_affected_items, v_item_id);
                END LOOP;
            END IF;

            -- Process Tool Units (Deterministic locking order on unit_code)
            IF p_payload ? 'tool_units' AND jsonb_array_length(p_payload->'tool_units') > 0 THEN
                SELECT array_agg(elem ORDER BY elem)
                INTO v_sorted_units
                FROM jsonb_array_elements_text(p_payload->'tool_units') elem;

                IF (SELECT count(DISTINCT x) FROM unnest(v_sorted_units) x) < array_length(v_sorted_units, 1) THEN
                    RAISE EXCEPTION 'Duplicate tool unit entries in issue cart are rejected';
                END IF;

                FOREACH v_unit_code IN ARRAY v_sorted_units
                LOOP
                    SELECT u.unit_code, u.status, u.item_id, u.active_custody_line_id, i.item_type, i.is_active, i.name INTO v_unit
                    FROM public.asset_units u
                    JOIN public.inventory_items i ON u.item_id = i.id
                    WHERE u.unit_code = v_unit_code
                    FOR UPDATE;

                    IF NOT FOUND THEN
                        RAISE EXCEPTION 'Tool unit % does not exist', v_unit_code;
                    END IF;

                    IF lower(v_unit.item_type) != 'asset' OR NOT v_unit.is_active THEN
                        RAISE EXCEPTION 'Tool unit % parent item must be an active asset', v_unit_code;
                    END IF;

                    IF upper(v_unit.status) != 'AVAILABLE' THEN
                        RAISE EXCEPTION 'Unit % is not available (status: %)', v_unit_code, v_unit.status;
                    END IF;

                    IF v_unit.active_custody_line_id IS NOT NULL THEN
                        RAISE EXCEPTION 'Unit % already has active custody line', v_unit_code;
                    END IF;

                    INSERT INTO public.inventory_document_lines (
                        document_id, line_type, item_id, unit_code, project_id, round_id,
                        recipient_id, description, quantity, due_at, is_active, status
                    ) VALUES (
                        v_doc_id, 'TOOL_CUSTODY', v_unit.item_id, v_unit_code, v_project_id, v_round_id,
                        v_recipient_id, v_unit.name, 1,
                        coalesce((p_payload->>'due_date')::timestamptz, (p_payload->>'expected_return_at')::timestamptz),
                        true, 'BORROWED'
                    ) RETURNING id INTO v_line_id;

                    UPDATE public.asset_units
                    SET status = 'BORROWED',
                        active_recipient_id = v_recipient_id,
                        active_custody_line_id = v_line_id,
                        active_round_id = v_round_id,
                        due_at = coalesce((p_payload->>'due_date')::timestamptz, (p_payload->>'expected_return_at')::timestamptz),
                        borrowed_by = v_recipient_name,
                        borrowed_at = timezone('utc'::text, now()),
                        project_id = v_project_id,
                        updated_at = timezone('utc'::text, now())
                    WHERE unit_code = v_unit_code;

                    INSERT INTO public.inventory_movements (
                        document_id, line_id, item_id, unit_code, movement_type, quantity, delta_stock,
                        project_id, round_id, recipient_id, recipient_name_snapshot,
                        notes, actor_auth_user_id, actor_name_snapshot
                    ) VALUES (
                        v_doc_id, v_line_id, v_unit.item_id, v_unit_code, 'ISSUE', 1, 0,
                        v_project_id, v_round_id, v_recipient_id, v_recipient_name,
                        'Tool borrowed', v_auth_uid, v_actor_name
                    );

                    v_units_json := v_units_json || jsonb_build_object('unit_code', v_unit_code, 'custody_id', v_line_id);
                    v_affected_units := array_append(v_affected_units, v_unit_code);
                    v_affected_items := array_append(v_affected_items, v_unit.item_id);
                END LOOP;
            END IF;

            -- Trigger linked production default work creation atomically if hook exists
            IF EXISTS (SELECT 1 FROM public.inventory_documents WHERE id = v_doc_id AND doc_type = 'PRODUCTION_ISSUE') THEN
                PERFORM public.warehouse_ensure_production_work(v_doc_id);
            END IF;

            v_result := jsonb_build_object(
                'success', true,
                'data', jsonb_build_object(
                    'document_id', v_doc_id,
                    'doc_number', v_doc_no,
                    'round_id', v_round_id,
                    'material_movements', v_movements_json,
                    'tool_custodies', v_units_json,
                    'affected_item_ids', v_affected_items,
                    'affected_unit_codes', v_affected_units,
                    'affected_project_ids', v_affected_projects
                )
            );

        -- =====================================================================
        -- 2.2 Material Returns (Unused)
        -- =====================================================================
        WHEN 'material_return_unused' THEN
            IF NOT p_payload ? 'items' OR jsonb_array_length(p_payload->'items') = 0 THEN
                RAISE EXCEPTION 'Return items list cannot be empty';
            END IF;

            SELECT array_agg((elem->>'source_issue_movement_id')::uuid ORDER BY (elem->>'source_issue_movement_id')::uuid)
            INTO v_sorted_src_move_ids
            FROM jsonb_array_elements(p_payload->'items') elem;

            IF (SELECT count(DISTINCT x) FROM unnest(v_sorted_src_move_ids) x) < array_length(v_sorted_src_move_ids, 1) THEN
                RAISE EXCEPTION 'Duplicate source movement entries in return are rejected';
            END IF;

            v_doc_no := 'RET-' || to_char(now(), 'YYYYMMDD-HH24MISS-') || substring(gen_random_uuid()::text, 1, 4);
            INSERT INTO public.inventory_documents (
                doc_number, doc_type, project_id, recipient_name_snapshot,
                notes, actor_auth_user_id, actor_name_snapshot
            ) VALUES (
                v_doc_no, 'RETURN_UNUSED', p_payload->>'project_id', coalesce(p_payload->>'recipient_name', 'Shop Return'),
                p_payload->>'notes', v_auth_uid, v_actor_name
            ) RETURNING id INTO v_doc_id;

            FOREACH v_move_id IN ARRAY v_sorted_src_move_ids
            LOOP
                SELECT (elem->>'quantity') INTO v_status
                FROM jsonb_array_elements(p_payload->'items') elem
                WHERE (elem->>'source_issue_movement_id')::uuid = v_move_id;

                IF v_status IS NULL OR v_status ~ '^[0-9]+(\.[0-9]+)?$' = FALSE THEN
                    RAISE EXCEPTION 'Return quantity must be finite positive number';
                END IF;
                v_qty := v_status::numeric;
                IF v_qty <= 0 THEN
                    RAISE EXCEPTION 'Return quantity must be strictly greater than 0';
                END IF;

                -- Lock source issue movement row
                SELECT m.id, m.item_id, m.quantity, d.project_id, d.round_id INTO v_src_move
                FROM public.inventory_movements m
                JOIN public.inventory_documents d ON m.document_id = d.id
                WHERE m.id = v_move_id AND m.movement_type = 'ISSUE'
                FOR UPDATE;

                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Source issue movement % not found or is not an ISSUE', v_move_id;
                END IF;

                IF p_payload->>'project_id' IS NOT NULL AND v_src_move.project_id IS NOT NULL AND v_src_move.project_id != p_payload->>'project_id' THEN
                    RAISE EXCEPTION 'Return project context does not match source issue project';
                END IF;

                -- Calculate cumulative returns + recoveries across all statuses
                SELECT coalesce(sum(quantity), 0) INTO v_cum_returned
                FROM public.inventory_movements
                WHERE source_issue_movement_id = v_move_id AND movement_type = 'RETURN_UNUSED';

                SELECT v_cum_returned + coalesce(sum(quantity), 0) INTO v_cum_returned
                FROM public.inventory_document_lines
                WHERE source_issue_movement_id = v_move_id AND line_type = 'RECOVERY';

                IF (v_cum_returned + v_qty) > v_src_move.quantity THEN
                    RAISE EXCEPTION 'Cumulative return quantity (%) exceeds issued quantity (%)',
                        (v_cum_returned + v_qty), v_src_move.quantity;
                END IF;

                UPDATE public.inventory_items
                SET current_stock = current_stock + v_qty,
                    updated_at = timezone('utc'::text, now())
                WHERE id = v_src_move.item_id;

                INSERT INTO public.inventory_document_lines (
                    document_id, line_type, item_id, source_issue_movement_id,
                    project_id, round_id, quantity, returned_qty, status
                ) VALUES (
                    v_doc_id, 'ITEM', v_src_move.item_id, v_move_id,
                    v_src_move.project_id, v_src_move.round_id, v_qty, v_qty, 'RETURNED'
                ) RETURNING id INTO v_line_id;

                INSERT INTO public.inventory_movements (
                    document_id, line_id, item_id, movement_type, quantity, delta_stock,
                    source_issue_movement_id, actor_auth_user_id, actor_name_snapshot
                ) VALUES (
                    v_doc_id, v_line_id, v_src_move.item_id, 'RETURN_UNUSED', v_qty, v_qty,
                    v_move_id, v_auth_uid, v_actor_name
                );

                v_affected_items := array_append(v_affected_items, v_src_move.item_id);
            END LOOP;

            v_result := jsonb_build_object(
                'success', true,
                'data', jsonb_build_object(
                    'document_id', v_doc_id,
                    'doc_number', v_doc_no,
                    'affected_item_ids', v_affected_items
                )
            );

        -- =====================================================================
        -- 2.3 Material Recoveries (Reusable items, pending or direct inspect)
        -- =====================================================================
        WHEN 'material_recovery' THEN
            IF NOT p_payload ? 'items' OR jsonb_array_length(p_payload->'items') = 0 THEN
                RAISE EXCEPTION 'Recovery items list cannot be empty';
            END IF;

            SELECT array_agg((elem->>'source_issue_movement_id')::uuid ORDER BY (elem->>'source_issue_movement_id')::uuid)
            INTO v_sorted_src_move_ids
            FROM jsonb_array_elements(p_payload->'items') elem;

            IF (SELECT count(DISTINCT x) FROM unnest(v_sorted_src_move_ids) x) < array_length(v_sorted_src_move_ids, 1) THEN
                RAISE EXCEPTION 'Duplicate source movement entries in recovery are rejected';
            END IF;

            v_doc_no := 'RCV-' || to_char(now(), 'YYYYMMDD-HH24MISS-') || substring(gen_random_uuid()::text, 1, 4);
            INSERT INTO public.inventory_documents (
                doc_number, doc_type, project_id, recipient_name_snapshot,
                notes, actor_auth_user_id, actor_name_snapshot
            ) VALUES (
                v_doc_no, 'RECOVERY', p_payload->>'project_id', coalesce(p_payload->>'recipient_name', 'Recovery Team'),
                p_payload->>'notes', v_auth_uid, v_actor_name
            ) RETURNING id INTO v_doc_id;

            FOREACH v_move_id IN ARRAY v_sorted_src_move_ids
            LOOP
                SELECT elem INTO v_arr_elem
                FROM jsonb_array_elements(p_payload->'items') elem
                WHERE (elem->>'source_issue_movement_id')::uuid = v_move_id;

                IF (v_arr_elem->>'recovered_qty') ~ '^[0-9]+(\.[0-9]+)?$' = FALSE THEN
                    RAISE EXCEPTION 'Recovered quantity must be finite positive number';
                END IF;
                v_qty := (v_arr_elem->>'recovered_qty')::numeric;
                IF v_qty <= 0 THEN
                    RAISE EXCEPTION 'Recovered quantity must be strictly greater than 0';
                END IF;

                SELECT m.id, m.item_id, m.quantity, d.project_id, d.round_id INTO v_src_move
                FROM public.inventory_movements m
                JOIN public.inventory_documents d ON m.document_id = d.id
                WHERE m.id = v_move_id AND m.movement_type = 'ISSUE'
                FOR UPDATE;

                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Source issue movement % not found', v_move_id;
                END IF;

                IF p_payload->>'project_id' IS NOT NULL AND v_src_move.project_id IS NOT NULL AND v_src_move.project_id != p_payload->>'project_id' THEN
                    RAISE EXCEPTION 'Recovery project context does not match source issue project';
                END IF;

                SELECT item_type INTO v_status FROM public.inventory_items WHERE id = v_src_move.item_id;
                IF lower(v_status) NOT IN ('reusable', 'reusable_material') THEN
                    RAISE EXCEPTION 'Only reusable materials can be recovered (item % is %)', v_src_move.item_id, v_status;
                END IF;

                -- Cumulative cap validation
                SELECT coalesce(sum(quantity), 0) INTO v_cum_returned
                FROM public.inventory_movements
                WHERE source_issue_movement_id = v_move_id AND movement_type = 'RETURN_UNUSED';

                SELECT v_cum_returned + coalesce(sum(quantity), 0) INTO v_cum_returned
                FROM public.inventory_document_lines
                WHERE source_issue_movement_id = v_move_id AND line_type = 'RECOVERY';

                IF (v_cum_returned + v_qty) > v_src_move.quantity THEN
                    RAISE EXCEPTION 'Cumulative recovery quantity exceeds issued quantity';
                END IF;

                IF coalesce((v_arr_elem->>'inspect_now')::boolean, false) THEN
                    v_good_qty := coalesce((v_arr_elem->>'good_qty')::numeric, 0);
                    v_damaged_qty := coalesce((v_arr_elem->>'damaged_qty')::numeric, 0);

                    IF v_good_qty < 0 OR v_damaged_qty < 0 THEN
                        RAISE EXCEPTION 'Good and damaged quantities must be non-negative';
                    END IF;
                    IF (v_good_qty + v_damaged_qty) != v_qty THEN
                        RAISE EXCEPTION 'Good quantity (%) + Damaged quantity (%) must equal recovered quantity (%)',
                            v_good_qty, v_damaged_qty, v_qty;
                    END IF;

                    INSERT INTO public.inventory_document_lines (
                        document_id, line_type, item_id, source_issue_movement_id,
                        project_id, round_id, quantity, accepted_qty, rejected_qty, pending_qty, status
                    ) VALUES (
                        v_doc_id, 'RECOVERY', v_src_move.item_id, v_move_id,
                        v_src_move.project_id, v_src_move.round_id, v_qty, v_good_qty, v_damaged_qty, 0, 'DIRECT_COMPLETED'
                    ) RETURNING id INTO v_line_id;

                    IF v_good_qty > 0 THEN
                        UPDATE public.inventory_items
                        SET current_stock = current_stock + v_good_qty,
                            updated_at = timezone('utc'::text, now())
                        WHERE id = v_src_move.item_id;

                        INSERT INTO public.inventory_movements (
                            document_id, line_id, item_id, movement_type, quantity, delta_stock,
                            source_issue_movement_id, notes, actor_auth_user_id, actor_name_snapshot
                        ) VALUES (
                            v_doc_id, v_line_id, v_src_move.item_id, 'RECOVERY_INSPECTED', v_good_qty, v_good_qty,
                            v_move_id, 'Directly inspected good recovery', v_auth_uid, v_actor_name
                        );
                    END IF;

                    IF v_damaged_qty > 0 THEN
                        INSERT INTO public.inventory_movements (
                            document_id, line_id, item_id, movement_type, quantity, delta_stock,
                            source_issue_movement_id, notes, actor_auth_user_id, actor_name_snapshot
                        ) VALUES (
                            v_doc_id, v_line_id, v_src_move.item_id, 'INSPECTION_REJECT_DAMAGED', v_damaged_qty, 0,
                            v_move_id, 'Directly inspected damaged recovery', v_auth_uid, v_actor_name
                        );
                    END IF;

                    v_recoveries_json := v_recoveries_json || jsonb_build_object('id', v_line_id, 'status', 'DIRECT_COMPLETED');
                ELSE
                    INSERT INTO public.inventory_document_lines (
                        document_id, line_type, item_id, source_issue_movement_id,
                        project_id, round_id, quantity, accepted_qty, rejected_qty, pending_qty, status, notes
                    ) VALUES (
                        v_doc_id, 'RECOVERY', v_src_move.item_id, v_move_id,
                        v_src_move.project_id, v_src_move.round_id, v_qty, 0, 0, v_qty, 'PENDING', v_arr_elem->>'notes'
                    ) RETURNING id INTO v_line_id;

                    INSERT INTO public.inventory_movements (
                        document_id, line_id, item_id, movement_type, quantity, delta_stock,
                        source_issue_movement_id, notes, actor_auth_user_id, actor_name_snapshot
                    ) VALUES (
                        v_doc_id, v_line_id, v_src_move.item_id, 'RECOVERY_PENDING', v_qty, 0,
                        v_move_id, 'Pending warehouse sorting/inspection', v_auth_uid, v_actor_name
                    );

                    v_recoveries_json := v_recoveries_json || jsonb_build_object('id', v_line_id, 'status', 'PENDING');
                END IF;

                v_affected_items := array_append(v_affected_items, v_src_move.item_id);
            END LOOP;

            v_result := jsonb_build_object(
                'success', true,
                'data', jsonb_build_object(
                    'document_id', v_doc_id,
                    'doc_number', v_doc_no,
                    'recoveries', v_recoveries_json,
                    'affected_item_ids', v_affected_items
                )
            );

        -- =====================================================================
        -- 2.4 Material Inspection
        -- =====================================================================
        WHEN 'material_inspect_recovery' THEN
            v_line_id := (p_payload->>'recovery_id')::uuid;
            IF (p_payload->>'good_qty') ~ '^[0-9]+(\.[0-9]+)?$' = FALSE THEN
                RAISE EXCEPTION 'good_qty must be finite non-negative number';
            END IF;
            v_good_qty := (p_payload->>'good_qty')::numeric;
            v_damaged_qty := coalesce((p_payload->>'damaged_qty')::numeric, 0);

            IF v_good_qty < 0 OR v_damaged_qty < 0 THEN
                RAISE EXCEPTION 'Good and damaged quantities must be non-negative';
            END IF;

            SELECT * INTO v_rec
            FROM public.inventory_document_lines
            WHERE id = v_line_id AND line_type = 'RECOVERY'
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Recovery line record % not found', v_line_id;
            END IF;

            IF v_rec.status != 'PENDING' THEN
                RAISE EXCEPTION 'Recovery record % is already inspected (status: %)', v_line_id, v_rec.status;
            END IF;

            IF (v_good_qty + v_damaged_qty) != v_rec.quantity THEN
                RAISE EXCEPTION 'Good quantity (%) + Damaged quantity (%) must equal total recovered quantity (%)',
                    v_good_qty, v_damaged_qty, v_rec.quantity;
            END IF;

            UPDATE public.inventory_document_lines
            SET status = 'INSPECTED',
                accepted_qty = v_good_qty,
                rejected_qty = v_damaged_qty,
                pending_qty = 0,
                updated_at = timezone('utc'::text, now())
            WHERE id = v_line_id;

            IF v_good_qty > 0 THEN
                UPDATE public.inventory_items
                SET current_stock = current_stock + v_good_qty,
                    updated_at = timezone('utc'::text, now())
                WHERE id = v_rec.item_id;

                INSERT INTO public.inventory_movements (
                    document_id, line_id, item_id, movement_type, quantity, delta_stock,
                    source_issue_movement_id, notes, actor_auth_user_id, actor_name_snapshot
                ) VALUES (
                    v_rec.document_id, v_line_id, v_rec.item_id, 'INSPECTION_ACCEPT', v_good_qty, v_good_qty,
                    v_rec.source_issue_movement_id, 'Inspection accepted good quantity', v_auth_uid, v_actor_name
                );
            END IF;

            IF v_damaged_qty > 0 THEN
                INSERT INTO public.inventory_movements (
                    document_id, line_id, item_id, movement_type, quantity, delta_stock,
                    source_issue_movement_id, notes, actor_auth_user_id, actor_name_snapshot
                ) VALUES (
                    v_rec.document_id, v_line_id, v_rec.item_id, 'INSPECTION_REJECT_DAMAGED', v_damaged_qty, 0,
                    v_rec.source_issue_movement_id, 'Damaged quantity isolated (zero stock increment)', v_auth_uid, v_actor_name
                );
            END IF;

            v_result := jsonb_build_object(
                'success', true,
                'data', jsonb_build_object(
                    'recovery_id', v_line_id,
                    'good_qty', v_good_qty,
                    'damaged_qty', v_damaged_qty,
                    'affected_item_ids', ARRAY[v_rec.item_id]
                )
            );

        -- =====================================================================
        -- 2.5 Tool Handover (Accepted handover without double active custody)
        -- =====================================================================
        WHEN 'tool_handover' THEN
            v_recipient_name := trim(coalesce(p_payload->>'to_recipient_name', ''));
            v_recipient_id := (p_payload->>'to_recipient_id')::uuid;

            IF v_recipient_name = '' THEN
                RAISE EXCEPTION 'Target recipient name is required for tool handover';
            END IF;

            IF v_recipient_id IS NULL THEN
                SELECT id INTO v_recipient_id
                FROM public.inventory_recipients
                WHERE lower(trim(name)) = lower(v_recipient_name) AND is_active = true
                LIMIT 1;
            END IF;

            IF NOT coalesce((p_payload->>'accepted')::boolean, false) THEN
                RAISE EXCEPTION 'Handover must be explicitly accepted by the receiver';
            END IF;

            FOR v_unit_code IN SELECT jsonb_array_elements_text(p_payload->'unit_codes')
            LOOP
                SELECT u.*, l.id AS custody_line_id, l.document_id, l.project_id, l.round_id, l.due_at
                INTO v_unit
                FROM public.asset_units u
                JOIN public.inventory_document_lines l ON u.active_custody_line_id = l.id
                WHERE u.unit_code = v_unit_code AND l.is_active = true
                FOR UPDATE OF u, l;

                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Active custody for unit % not found', v_unit_code;
                END IF;

                -- Deactivate prior custody line
                UPDATE public.inventory_document_lines
                SET is_active = false,
                    status = 'TRANSFERRED',
                    notes = coalesce(notes, '') || ' Handed over to ' || v_recipient_name,
                    updated_at = timezone('utc'::text, now())
                WHERE id = v_unit.custody_line_id;

                -- Create new recipient custody line referencing source line
                INSERT INTO public.inventory_document_lines (
                    document_id, line_type, item_id, unit_code, project_id, round_id,
                    recipient_id, source_line_id, quantity, due_at, is_active, status, notes
                ) VALUES (
                    v_unit.document_id, 'TOOL_CUSTODY', v_unit.item_id, v_unit_code,
                    v_unit.project_id, v_unit.round_id, v_recipient_id, v_unit.custody_line_id,
                    1, v_unit.due_at, true, 'BORROWED', p_payload->>'notes'
                ) RETURNING id INTO v_line_id;

                UPDATE public.asset_units
                SET active_recipient_id = v_recipient_id,
                    active_custody_line_id = v_line_id,
                    borrowed_by = v_recipient_name,
                    updated_at = timezone('utc'::text, now())
                WHERE unit_code = v_unit_code;

                INSERT INTO public.inventory_movements (
                    document_id, line_id, item_id, unit_code, movement_type, quantity, delta_stock,
                    project_id, round_id, recipient_id, recipient_name_snapshot,
                    notes, actor_auth_user_id, actor_name_snapshot
                ) VALUES (
                    v_unit.document_id, v_line_id, v_unit.item_id, v_unit_code, 'TOOL_HANDOVER', 1, 0,
                    v_unit.project_id, v_unit.round_id, v_recipient_id, v_recipient_name,
                    'Accepted handover to ' || v_recipient_name, v_auth_uid, v_actor_name
                );

                v_affected_units := array_append(v_affected_units, v_unit_code);
            END LOOP;

            v_result := jsonb_build_object(
                'success', true,
                'data', jsonb_build_object(
                    'status', 'TRANSFERRED',
                    'affected_unit_codes', v_affected_units
                )
            );

        -- =====================================================================
        -- 2.6 Tool Return & Condition Handling (Good / Broken / Lost)
        -- =====================================================================
        WHEN 'tool_return' THEN
            FOR v_arr_elem IN SELECT * FROM jsonb_array_elements(p_payload->'returns')
            LOOP
                v_unit_code := v_arr_elem->>'unit_code';
                v_status := lower(coalesce(v_arr_elem->>'condition', 'good'));

                SELECT u.*, l.id AS custody_line_id, l.document_id, l.project_id, l.round_id, l.recipient_id
                INTO v_unit
                FROM public.asset_units u
                LEFT JOIN public.inventory_document_lines l ON u.active_custody_line_id = l.id
                WHERE u.unit_code = v_unit_code
                FOR UPDATE OF u;

                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Unit % not found', v_unit_code;
                END IF;

                IF v_status = 'good' THEN
                    UPDATE public.asset_units
                    SET status = 'AVAILABLE',
                        active_recipient_id = NULL,
                        active_custody_line_id = NULL,
                        active_round_id = NULL,
                        borrowed_by = NULL,
                        borrowed_at = NULL,
                        due_at = NULL,
                        project_id = NULL,
                        updated_at = timezone('utc'::text, now())
                    WHERE unit_code = v_unit_code;

                    IF v_unit.custody_line_id IS NOT NULL THEN
                        UPDATE public.inventory_document_lines
                        SET is_active = false,
                            status = 'RETURNED',
                            notes = v_arr_elem->>'notes',
                            updated_at = timezone('utc'::text, now())
                        WHERE id = v_unit.custody_line_id;
                    END IF;

                    INSERT INTO public.inventory_movements (
                        document_id, item_id, unit_code, movement_type, quantity, delta_stock,
                        project_id, round_id, notes, actor_auth_user_id, actor_name_snapshot
                    ) VALUES (
                        v_unit.document_id, v_unit.item_id, v_unit_code, 'TOOL_RETURN', 1, 0,
                        v_unit.project_id, v_unit.round_id, v_arr_elem->>'notes', v_auth_uid, v_actor_name
                    );

                ELSIF v_status = 'broken' THEN
                    UPDATE public.asset_units
                    SET status = 'BROKEN',
                        active_custody_line_id = NULL,
                        updated_at = timezone('utc'::text, now())
                    WHERE unit_code = v_unit_code;

                    IF v_unit.custody_line_id IS NOT NULL THEN
                        UPDATE public.inventory_document_lines
                        SET is_active = false,
                            status = 'BROKEN',
                            notes = v_arr_elem->>'notes',
                            updated_at = timezone('utc'::text, now())
                        WHERE id = v_unit.custody_line_id;
                    END IF;

                    v_doc_no := 'INC-BRK-' || substring(gen_random_uuid()::text, 1, 8);
                    INSERT INTO public.inventory_documents (
                        doc_number, doc_type, project_id, round_id, recipient_id, recipient_name_snapshot,
                        status, notes, actor_auth_user_id, actor_name_snapshot
                    ) VALUES (
                        v_doc_no, 'INCIDENT', v_unit.project_id, v_unit.round_id, v_unit.recipient_id,
                        v_unit.borrowed_by, 'OPEN', v_arr_elem->>'notes', v_auth_uid, v_actor_name
                    ) RETURNING id INTO v_doc_id;

                    INSERT INTO public.inventory_document_lines (
                        document_id, line_type, item_id, unit_code, project_id, round_id,
                        description, quantity, status, notes
                    ) VALUES (
                        v_doc_id, 'INCIDENT', v_unit.item_id, v_unit_code, v_unit.project_id, v_unit.round_id,
                        'Tool broken during custody', 1, 'OPEN', v_arr_elem->>'notes'
                    );

                    INSERT INTO public.inventory_movements (
                        document_id, item_id, unit_code, movement_type, quantity, delta_stock,
                        project_id, round_id, notes, actor_auth_user_id, actor_name_snapshot
                    ) VALUES (
                        v_doc_id, v_unit.item_id, v_unit_code, 'TOOL_BROKEN', 1, 0,
                        v_unit.project_id, v_unit.round_id, v_arr_elem->>'notes', v_auth_uid, v_actor_name
                    );

                ELSIF v_status IN ('missing', 'lost') THEN
                    UPDATE public.asset_units
                    SET status = 'LOST',
                        active_custody_line_id = NULL,
                        updated_at = timezone('utc'::text, now())
                    WHERE unit_code = v_unit_code;

                    IF v_unit.custody_line_id IS NOT NULL THEN
                        UPDATE public.inventory_document_lines
                        SET is_active = false,
                            status = 'LOST',
                            notes = v_arr_elem->>'notes',
                            updated_at = timezone('utc'::text, now())
                        WHERE id = v_unit.custody_line_id;
                    END IF;

                    v_doc_no := 'INC-LST-' || substring(gen_random_uuid()::text, 1, 8);
                    INSERT INTO public.inventory_documents (
                        doc_number, doc_type, project_id, round_id, recipient_id, recipient_name_snapshot,
                        status, notes, actor_auth_user_id, actor_name_snapshot
                    ) VALUES (
                        v_doc_no, 'INCIDENT', v_unit.project_id, v_unit.round_id, v_unit.recipient_id,
                        v_unit.borrowed_by, 'OPEN', v_arr_elem->>'notes', v_auth_uid, v_actor_name
                    ) RETURNING id INTO v_doc_id;

                    INSERT INTO public.inventory_document_lines (
                        document_id, line_type, item_id, unit_code, project_id, round_id,
                        description, quantity, status, notes
                    ) VALUES (
                        v_doc_id, 'INCIDENT', v_unit.item_id, v_unit_code, v_unit.project_id, v_unit.round_id,
                        'Tool lost during custody', 1, 'OPEN', v_arr_elem->>'notes'
                    );

                    INSERT INTO public.inventory_movements (
                        document_id, item_id, unit_code, movement_type, quantity, delta_stock,
                        project_id, round_id, notes, actor_auth_user_id, actor_name_snapshot
                    ) VALUES (
                        v_doc_id, v_unit.item_id, v_unit_code, 'TOOL_LOST', 1, 0,
                        v_unit.project_id, v_unit.round_id, v_arr_elem->>'notes', v_auth_uid, v_actor_name
                    );
                END IF;

                -- Recompute Field Round status if unit belonged to a round
                IF v_unit.active_round_id IS NOT NULL OR v_unit.round_id IS NOT NULL THEN
                    v_round_id := coalesce(v_unit.active_round_id, v_unit.round_id);

                    SELECT count(*) INTO v_remaining_tools
                    FROM public.inventory_document_lines
                    WHERE round_id = v_round_id AND line_type = 'TOOL_CUSTODY' AND is_active = true;

                    SELECT count(*) INTO v_tool_count
                    FROM public.inventory_document_lines
                    WHERE round_id = v_round_id AND line_type = 'TOOL_CUSTODY';

                    UPDATE public.inventory_documents
                    SET status = CASE
                            WHEN v_remaining_tools = 0 THEN 'RETURNED'
                            WHEN v_remaining_tools < v_tool_count THEN 'PARTIAL_RETURNED'
                            ELSE 'IN_PROGRESS'
                        END,
                        updated_at = timezone('utc'::text, now())
                    WHERE id = v_round_id;
                END IF;

                v_affected_units := array_append(v_affected_units, v_unit_code);
            END LOOP;

            v_result := jsonb_build_object(
                'success', true,
                'data', jsonb_build_object(
                    'status', 'PROCESSED',
                    'affected_unit_codes', v_affected_units
                )
            );

        -- =====================================================================
        -- 2.7 Tool Legacy Adoption or Return
        -- =====================================================================
        WHEN 'tool_legacy_adopt_or_return' THEN
            v_unit_code := p_payload->>'unit_code';
            v_status := lower(coalesce(p_payload->>'action', ''));

            SELECT * INTO v_unit FROM public.asset_units WHERE unit_code = v_unit_code FOR UPDATE;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Legacy unit % not found', v_unit_code;
            END IF;

            IF v_status = 'return_available' THEN
                UPDATE public.asset_units
                SET status = 'AVAILABLE',
                    active_recipient_id = NULL,
                    active_custody_line_id = NULL,
                    active_round_id = NULL,
                    borrowed_by = NULL,
                    borrowed_at = NULL,
                    due_at = NULL,
                    project_id = NULL,
                    updated_at = timezone('utc'::text, now())
                WHERE unit_code = v_unit_code;

            ELSIF v_status = 'adopt_custody' THEN
                v_doc_no := 'LEG-LOAN-' || substring(gen_random_uuid()::text, 1, 8);
                INSERT INTO public.inventory_documents (
                    doc_number, doc_type, project_id, recipient_name_snapshot,
                    status, notes, actor_auth_user_id, actor_name_snapshot
                ) VALUES (
                    v_doc_no, 'LEGACY_LOAN', v_unit.project_id, coalesce(v_unit.borrowed_by, 'Legacy Custody'),
                    'COMPLETED', 'Adopted legacy custody into compact schema', v_auth_uid, v_actor_name
                ) RETURNING id INTO v_doc_id;

                INSERT INTO public.inventory_document_lines (
                    document_id, line_type, item_id, unit_code, project_id,
                    description, quantity, is_active, status
                ) VALUES (
                    v_doc_id, 'TOOL_CUSTODY', v_unit.item_id, v_unit_code, v_unit.project_id,
                    'Adopted legacy loan', 1, true, 'BORROWED'
                ) RETURNING id INTO v_line_id;

                UPDATE public.asset_units
                SET active_custody_line_id = v_line_id,
                    status = 'BORROWED',
                    updated_at = timezone('utc'::text, now())
                WHERE unit_code = v_unit_code;

            ELSE
                RAISE EXCEPTION 'Invalid legacy action: % (must be return_available or adopt_custody)', v_status;
            END IF;

            v_result := jsonb_build_object(
                'success', true,
                'data', jsonb_build_object(
                    'unit_code', v_unit_code,
                    'action', v_status,
                    'affected_unit_codes', ARRAY[v_unit_code]
                )
            );

        -- =====================================================================
        -- 2.8 Categories & Items Metadata CRUD & Audited Adjustments
        -- =====================================================================
        WHEN 'category_create' THEN
            IF trim(coalesce(p_payload->>'name', '')) = '' THEN
                RAISE EXCEPTION 'Category name cannot be empty';
            END IF;

            INSERT INTO public.inventory_categories (name, type, is_active)
            VALUES (
                trim(p_payload->>'name'),
                coalesce(p_payload->>'type', 'consumable'),
                coalesce((p_payload->>'is_active')::boolean, true)
            ) RETURNING id INTO v_doc_id;

            v_result := jsonb_build_object(
                'success', true,
                'data', jsonb_build_object('id', v_doc_id, 'name', trim(p_payload->>'name'))
            );

        WHEN 'category_rename' THEN
            v_doc_id := (p_payload->>'id')::uuid;
            IF trim(coalesce(p_payload->>'name', '')) = '' THEN
                RAISE EXCEPTION 'Category name cannot be empty';
            END IF;

            UPDATE public.inventory_categories
            SET name = trim(p_payload->>'name')
            WHERE id = v_doc_id;

            v_result := jsonb_build_object('success', true, 'data', jsonb_build_object('id', v_doc_id));

        WHEN 'category_retire' THEN
            v_doc_id := (p_payload->>'id')::uuid;
            UPDATE public.inventory_categories
            SET is_active = coalesce((p_payload->>'is_active')::boolean, false)
            WHERE id = v_doc_id;

            v_result := jsonb_build_object('success', true, 'data', jsonb_build_object('id', v_doc_id));

        WHEN 'item_create' THEN
            IF nullif(p_payload->>'image_url', '') IS NOT NULL AND (
                length(p_payload->>'image_url') > 2048 OR
                (p_payload->>'image_url') !~ '^https://(drive[.]google[.]com|lh3[.]googleusercontent[.]com)/[A-Za-z0-9_/?=&.%-]+$'
            ) THEN RAISE EXCEPTION 'Invalid Google Drive image URL'; END IF;
            IF trim(coalesce(p_payload->>'name', '')) = '' THEN
                RAISE EXCEPTION 'Item name cannot be empty';
            END IF;

            v_stock := coalesce((p_payload->>'initial_stock')::numeric, 0);
            IF v_stock < 0 THEN
                RAISE EXCEPTION 'Initial stock cannot be negative';
            END IF;

            v_status := lower(coalesce(p_payload->>'item_type', 'consumable'));
            IF v_stock > 0 AND v_status IN ('asset', 'banknote', 'task') THEN
                RAISE EXCEPTION 'Initial stock opening is forbidden for asset, banknote, or task items';
            END IF;

            INSERT INTO public.inventory_items (
                code, name, category_id, item_type, unit, current_stock,
                min_alert_threshold, average_cost, storage_location, color, size, status, is_active, image_url
            ) VALUES (
                NULLIF(trim(p_payload->>'code'), ''),
                trim(p_payload->>'name'),
                (p_payload->>'category_id')::uuid,
                v_status,
                coalesce(p_payload->>'unit', 'ชิ้น'),
                v_stock,
                coalesce((p_payload->>'min_alert_threshold')::numeric, 0),
                coalesce((p_payload->>'average_cost')::numeric, 0),
                p_payload->>'storage_location',
                p_payload->>'color',
                p_payload->>'size',
                coalesce(p_payload->>'status', 'in_service'),
                true,
                nullif(p_payload->>'image_url', '')
            ) RETURNING id INTO v_item_id;

            IF v_stock > 0 THEN
                v_doc_no := 'OPN-' || to_char(now(), 'YYYYMMDD-') || substring(gen_random_uuid()::text, 1, 4);
                INSERT INTO public.inventory_documents (
                    doc_number, doc_type, recipient_name_snapshot, notes, actor_auth_user_id, actor_name_snapshot
                ) VALUES (
                    v_doc_no, 'OPENING_STOCK', 'System Initial Stock',
                    coalesce(p_payload->>'opening_stock_reason', 'Item registration initial stock'),
                    v_auth_uid, v_actor_name
                ) RETURNING id INTO v_doc_id;

                INSERT INTO public.inventory_document_lines (
                    document_id, line_type, item_id, quantity, status
                ) VALUES (
                    v_doc_id, 'ITEM', v_item_id, v_stock, 'COMPLETED'
                ) RETURNING id INTO v_line_id;

                INSERT INTO public.inventory_movements (
                    document_id, line_id, item_id, movement_type, quantity, delta_stock,
                    notes, actor_auth_user_id, actor_name_snapshot
                ) VALUES (
                    v_doc_id, v_line_id, v_item_id, 'OPENING_STOCK', v_stock, v_stock,
                    coalesce(p_payload->>'opening_stock_reason', 'Initial stock opening'), v_auth_uid, v_actor_name
                );
            END IF;

            v_result := jsonb_build_object(
                'success', true,
                'data', jsonb_build_object(
                    'id', v_item_id,
                    'affected_item_ids', ARRAY[v_item_id]
                )
            );

        WHEN 'item_save_metadata' THEN
            IF nullif(p_payload->>'image_url', '') IS NOT NULL AND (
                length(p_payload->>'image_url') > 2048 OR
                (p_payload->>'image_url') !~ '^https://(drive[.]google[.]com|lh3[.]googleusercontent[.]com)/[A-Za-z0-9_/?=&.%-]+$'
            ) THEN RAISE EXCEPTION 'Invalid Google Drive image URL'; END IF;
            v_item_id := (p_payload->>'id')::uuid;

            SELECT * INTO v_item FROM public.inventory_items WHERE id = v_item_id FOR UPDATE;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Item with ID % not found', v_item_id;
            END IF;

            -- Block identity changes after transactions exist
            IF EXISTS (SELECT 1 FROM public.inventory_movements WHERE item_id = v_item_id)
               OR EXISTS (SELECT 1 FROM public.asset_units WHERE item_id = v_item_id) THEN
                IF (p_payload ? 'item_type' AND p_payload->>'item_type' != v_item.item_type)
                   OR (p_payload ? 'unit' AND p_payload->>'unit' != v_item.unit)
                   OR (p_payload ? 'color' AND p_payload->>'color' != coalesce(v_item.color, ''))
                   OR (p_payload ? 'size' AND p_payload->>'size' != coalesce(v_item.size, '')) THEN
                    RAISE EXCEPTION 'Cannot change item identity (type, unit, color, size) after transaction movements exist';
                END IF;
            END IF;

            UPDATE public.inventory_items
            SET name = trim(coalesce(p_payload->>'name', name)),
                category_id = CASE WHEN p_payload ? 'category_id' THEN (p_payload->>'category_id')::uuid ELSE category_id END,
                item_type = coalesce(p_payload->>'item_type', item_type),
                unit = coalesce(p_payload->>'unit', unit),
                min_alert_threshold = coalesce((p_payload->>'min_alert_threshold')::numeric, min_alert_threshold),
                average_cost = coalesce((p_payload->>'average_cost')::numeric, average_cost),
                storage_location = coalesce(p_payload->>'storage_location', storage_location),
                color = coalesce(p_payload->>'color', color),
                size = coalesce(p_payload->>'size', size),
                image_url = CASE WHEN p_payload ? 'image_url' THEN nullif(p_payload->>'image_url', '') ELSE image_url END,
                updated_at = timezone('utc'::text, now())
            WHERE id = v_item_id;

            v_result := jsonb_build_object(
                'success', true,
                'data', jsonb_build_object(
                    'id', v_item_id,
                    'affected_item_ids', ARRAY[v_item_id]
                )
            );

        WHEN 'stock_adjust' THEN
            v_item_id := (p_payload->>'item_id')::uuid;
            IF (p_payload->>'delta_quantity') ~ '^-?[0-9]+(\.[0-9]+)?$' = FALSE THEN
                RAISE EXCEPTION 'delta_quantity must be a finite non-zero number';
            END IF;
            v_delta := (p_payload->>'delta_quantity')::numeric;

            IF v_delta = 0 THEN
                RAISE EXCEPTION 'Stock adjustment delta must be non-zero';
            END IF;
            IF trim(coalesce(p_payload->>'reason', '')) = '' THEN
                RAISE EXCEPTION 'Reason is strictly required for stock adjustment';
            END IF;

            SELECT * INTO v_item FROM public.inventory_items WHERE id = v_item_id FOR UPDATE;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Item with ID % not found', v_item_id;
            END IF;

            IF lower(v_item.item_type) NOT IN ('consumable', 'reusable', 'reusable_material') THEN
                RAISE EXCEPTION 'Stock adjustment cannot alter item of type %', v_item.item_type;
            END IF;

            IF (v_item.current_stock + v_delta) < 0 THEN
                RAISE EXCEPTION 'Adjustment would result in negative stock balance (%)', (v_item.current_stock + v_delta);
            END IF;

            UPDATE public.inventory_items
            SET current_stock = current_stock + v_delta,
                updated_at = timezone('utc'::text, now())
            WHERE id = v_item_id;

            v_doc_no := 'ADJ-' || to_char(now(), 'YYYYMMDD-') || substring(gen_random_uuid()::text, 1, 4);
            INSERT INTO public.inventory_documents (
                doc_number, doc_type, recipient_name_snapshot, notes, actor_auth_user_id, actor_name_snapshot
            ) VALUES (
                v_doc_no, 'ADJUSTMENT', 'Stock Auditor', p_payload->>'reason', v_auth_uid, v_actor_name
            ) RETURNING id INTO v_doc_id;

            INSERT INTO public.inventory_document_lines (
                document_id, line_type, item_id, quantity, notes, status
            ) VALUES (
                v_doc_id, 'ITEM', v_item_id, abs(v_delta), p_payload->>'reason', 'COMPLETED'
            ) RETURNING id INTO v_line_id;

            INSERT INTO public.inventory_movements (
                document_id, line_id, item_id, movement_type, quantity, delta_stock,
                notes, actor_auth_user_id, actor_name_snapshot
            ) VALUES (
                v_doc_id, v_line_id, v_item_id, 'ADJUSTMENT', abs(v_delta), v_delta,
                p_payload->>'reason', v_auth_uid, v_actor_name
            );

            v_result := jsonb_build_object(
                'success', true,
                'data', jsonb_build_object(
                    'item_id', v_item_id,
                    'new_stock', (v_item.current_stock + v_delta),
                    'affected_item_ids', ARRAY[v_item_id]
                )
            );

        WHEN 'unit_add' THEN
            v_item_id := (p_payload->>'item_id')::uuid;
            v_unit_code := trim(coalesce(p_payload->>'unit_code', ''));

            IF v_unit_code = '' THEN
                RAISE EXCEPTION 'Unit code is required';
            END IF;

            IF EXISTS (SELECT 1 FROM public.asset_units WHERE unit_code = v_unit_code) THEN
                RAISE EXCEPTION 'Unit code % already exists', v_unit_code;
            END IF;

            SELECT item_type, is_active INTO v_status, v_bool FROM public.inventory_items WHERE id = v_item_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Item % not found', v_item_id;
            END IF;
            IF lower(v_status) != 'asset' OR NOT v_bool THEN
                RAISE EXCEPTION 'Serialized units can only be added to an active asset item';
            END IF;

            INSERT INTO public.asset_units (unit_code, item_id, status, notes)
            VALUES (v_unit_code, v_item_id, 'AVAILABLE', p_payload->>'notes');

            v_result := jsonb_build_object(
                'success', true,
                'data', jsonb_build_object(
                    'unit_code', v_unit_code,
                    'affected_unit_codes', ARRAY[v_unit_code],
                    'affected_item_ids', ARRAY[v_item_id]
                )
            );

        -- =====================================================================
        -- 2.9 Recipients & Teams (Unified into inventory_recipients)
        -- =====================================================================
        WHEN 'recipient_create' THEN
            IF trim(coalesce(p_payload->>'name', '')) = '' THEN
                RAISE EXCEPTION 'Recipient name cannot be empty';
            END IF;

            INSERT INTO public.inventory_recipients (name, recipient_type, contact_info, is_active)
            VALUES (
                trim(p_payload->>'name'),
                coalesce(p_payload->>'recipient_type', 'individual'),
                p_payload->>'contact_info',
                coalesce((p_payload->>'is_active')::boolean, true)
            ) RETURNING id INTO v_recipient_id;

            v_result := jsonb_build_object('success', true, 'data', jsonb_build_object('id', v_recipient_id));

        WHEN 'recipient_update' THEN
            v_recipient_id := (p_payload->>'id')::uuid;

            UPDATE public.inventory_recipients
            SET name = trim(coalesce(p_payload->>'name', name)),
                recipient_type = coalesce(p_payload->>'recipient_type', recipient_type),
                contact_info = coalesce(p_payload->>'contact_info', contact_info),
                is_active = coalesce((p_payload->>'is_active')::boolean, is_active),
                updated_at = timezone('utc'::text, now())
            WHERE id = v_recipient_id;

            v_result := jsonb_build_object('success', true, 'data', jsonb_build_object('id', v_recipient_id));

        WHEN 'team_create' THEN
            IF trim(coalesce(p_payload->>'name', '')) = '' OR trim(coalesce(p_payload->>'primary_receiver_name', '')) = '' THEN
                RAISE EXCEPTION 'Team name and primary receiver name cannot be empty';
            END IF;

            INSERT INTO public.inventory_recipients (
                name, recipient_type, primary_receiver_name, member_names, team_is_active, is_active
            ) VALUES (
                trim(p_payload->>'name'),
                'team',
                trim(p_payload->>'primary_receiver_name'),
                coalesce((SELECT array_agg(trim(x)) FROM jsonb_array_elements_text(p_payload->'member_names') t(x) WHERE trim(x) != ''), '{}'),
                true,
                true
            ) RETURNING id INTO v_recipient_id;

            -- Returns both team_id and recipient_id for client backward compatibility
            v_result := jsonb_build_object(
                'success', true,
                'data', jsonb_build_object('team_id', v_recipient_id, 'recipient_id', v_recipient_id)
            );

        -- =====================================================================
        -- 2.10 CASH VAULT & FINANCIAL OPERATIONS (Strict Server-enforced)
        -- =====================================================================
        WHEN 'cash_counted_opening' THEN
            IF NOT p_payload ? 'counts' OR jsonb_array_length(p_payload->'counts') = 0 THEN
                RAISE EXCEPTION 'Opening counts array cannot be empty';
            END IF;

            FOR v_arr_elem IN SELECT * FROM jsonb_array_elements(p_payload->'counts')
            LOOP
                IF (v_arr_elem->>'note_count') ~ '^[0-9]+$' = FALSE THEN
                    RAISE EXCEPTION 'Banknote count must be an integer (received: %)', v_arr_elem->>'note_count';
                END IF;

                v_denom := (v_arr_elem->>'denomination')::int;
                v_note_count := (v_arr_elem->>'note_count')::int;

                IF v_denom NOT IN (20, 50, 100, 500, 1000) THEN
                    RAISE EXCEPTION 'Invalid banknote denomination: %', v_denom;
                END IF;

                SELECT * INTO v_vault FROM public.cash_vault_denominations WHERE denomination = v_denom FOR UPDATE;
                IF FOUND AND v_vault.is_initialized THEN
                    RAISE EXCEPTION 'Denomination % already has counted baseline. Cannot reset opening.', v_denom;
                END IF;

                UPDATE public.cash_vault_denominations
                SET physical_count = v_note_count,
                    is_initialized = true,
                    updated_at = timezone('utc'::text, now())
                WHERE denomination = v_denom;

                INSERT INTO public.inventory_movements (
                    movement_type, denomination, quantity, delta_stock, is_cash,
                    from_location, to_location, actor_auth_user_id, actor_name_snapshot, notes
                ) VALUES (
                    'COUNTED_OPENING', v_denom, v_note_count, v_note_count, true,
                    'INSPECTION', 'VAULT', v_auth_uid, v_actor_name, p_payload->>'notes'
                );
            END LOOP;

            v_result := jsonb_build_object('success', true, 'data', jsonb_build_object('status', 'COUNTED_OPENING_RECORDED'));

        WHEN 'cash_deposit' THEN
            IF (p_payload->>'note_count') ~ '^[0-9]+$' = FALSE THEN
                RAISE EXCEPTION 'Banknote count must be a positive integer';
            END IF;

            v_denom := (p_payload->>'denomination')::int;
            v_note_count := (p_payload->>'note_count')::int;

            IF v_denom NOT IN (20, 50, 100, 500, 1000) OR v_note_count <= 0 THEN
                RAISE EXCEPTION 'Invalid denomination or count for cash deposit';
            END IF;

            UPDATE public.cash_vault_denominations
            SET physical_count = physical_count + v_note_count,
                is_initialized = true,
                updated_at = timezone('utc'::text, now())
            WHERE denomination = v_denom;

            INSERT INTO public.inventory_movements (
                movement_type, denomination, quantity, delta_stock, is_cash,
                from_location, to_location, actor_auth_user_id, actor_name_snapshot, notes
            ) VALUES (
                'DEPOSIT', v_denom, v_note_count, v_note_count, true,
                'BANK/DRAWER', 'VAULT', v_auth_uid, v_actor_name, p_payload->>'notes'
            );

            v_result := jsonb_build_object(
                'success', true,
                'data', jsonb_build_object('denomination', v_denom, 'added', v_note_count)
            );

        WHEN 'cash_reserve' THEN
            IF (p_payload->>'note_count') ~ '^[0-9]+$' = FALSE THEN
                RAISE EXCEPTION 'Banknote count must be an integer';
            END IF;

            v_project_id := p_payload->>'project_id';
            v_denom := (p_payload->>'denomination')::int;
            v_note_count := (p_payload->>'note_count')::int;

            IF v_project_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.projects WHERE id = v_project_id) THEN
                RAISE EXCEPTION 'Valid project_id required for cash reservation';
            END IF;
            IF v_denom NOT IN (20, 50, 100, 500, 1000) OR v_note_count <= 0 THEN
                RAISE EXCEPTION 'Invalid denomination or count';
            END IF;

            SELECT * INTO v_vault FROM public.cash_vault_denominations WHERE denomination = v_denom FOR UPDATE;
            IF (v_vault.physical_count - v_vault.reserved_count) < v_note_count THEN
                RAISE EXCEPTION 'Insufficient available vault cash for denomination % (Requested: %, Available: %)',
                    v_denom, v_note_count, (v_vault.physical_count - v_vault.reserved_count);
            END IF;

            UPDATE public.cash_vault_denominations
            SET reserved_count = reserved_count + v_note_count,
                updated_at = timezone('utc'::text, now())
            WHERE denomination = v_denom;

            v_doc_no := 'CSH-RES-' || v_project_id || '-' || substring(gen_random_uuid()::text, 1, 4);
            INSERT INTO public.inventory_documents (
                doc_number, doc_type, project_id, is_cash, denomination,
                notes, actor_auth_user_id, actor_name_snapshot
            ) VALUES (
                v_doc_no, 'CASH_RESERVATION', v_project_id, true, v_denom,
                p_payload->>'notes', v_auth_uid, v_actor_name
            ) RETURNING id INTO v_doc_id;

            INSERT INTO public.inventory_document_lines (
                document_id, line_type, project_id, denomination, quantity, status
            ) VALUES (
                v_doc_id, 'CASH_RESERVATION', v_project_id, v_denom, v_note_count, 'RESERVED'
            ) RETURNING id INTO v_line_id;

            INSERT INTO public.inventory_movements (
                document_id, line_id, project_id, movement_type, denomination, quantity, delta_stock, is_cash,
                from_location, to_location, actor_auth_user_id, actor_name_snapshot, notes
            ) VALUES (
                v_doc_id, v_line_id, v_project_id, 'RESERVE', v_denom, v_note_count, 0, true,
                'VAULT', 'JOB_RESERVATION:' || v_project_id, v_auth_uid, v_actor_name, p_payload->>'notes'
            );

            v_result := jsonb_build_object(
                'success', true,
                'data', jsonb_build_object('project_id', v_project_id, 'reserved', v_note_count, 'document_id', v_doc_id)
            );

        WHEN 'cash_release_reservation' THEN
            IF (p_payload->>'note_count') ~ '^[0-9]+$' = FALSE THEN
                RAISE EXCEPTION 'Banknote count must be an integer';
            END IF;

            v_project_id := p_payload->>'project_id';
            v_denom := (p_payload->>'denomination')::int;
            v_note_count := (p_payload->>'note_count')::int;

            IF v_note_count <= 0 THEN
                RAISE EXCEPTION 'Note count to release must be strictly greater than 0';
            END IF;

            -- Calculate total active reservation for project
            SELECT coalesce(sum(quantity - returned_qty - delivered_qty), 0) INTO v_stock
            FROM public.inventory_document_lines
            WHERE line_type = 'CASH_RESERVATION'
              AND project_id = v_project_id
              AND denomination = v_denom
              AND is_active = true;

            IF v_stock < v_note_count THEN
                RAISE EXCEPTION 'Cannot release % notes: only % reserved for project %',
                    v_note_count, v_stock, v_project_id;
            END IF;

            -- Deduct across reservation lines
            v_delta := v_note_count;
            FOR v_rec IN 
                SELECT id, (quantity - returned_qty - delivered_qty) AS rem
                FROM public.inventory_document_lines
                WHERE line_type = 'CASH_RESERVATION'
                  AND project_id = v_project_id
                  AND denomination = v_denom
                  AND is_active = true
                ORDER BY created_at ASC
                FOR UPDATE
            LOOP
                IF v_delta <= 0 THEN EXIT; END IF;
                IF v_rec.rem <= v_delta THEN
                    UPDATE public.inventory_document_lines
                    SET returned_qty = returned_qty + v_rec.rem,
                        is_active = false,
                        updated_at = timezone('utc'::text, now())
                    WHERE id = v_rec.id;
                    v_delta := v_delta - v_rec.rem;
                ELSE
                    UPDATE public.inventory_document_lines
                    SET returned_qty = returned_qty + v_delta,
                        updated_at = timezone('utc'::text, now())
                    WHERE id = v_rec.id;
                    v_delta := 0;
                END IF;
            END LOOP;

            UPDATE public.cash_vault_denominations
            SET reserved_count = reserved_count - v_note_count,
                updated_at = timezone('utc'::text, now())
            WHERE denomination = v_denom;

            INSERT INTO public.inventory_movements (
                project_id, movement_type, denomination, quantity, delta_stock, is_cash,
                from_location, to_location, actor_auth_user_id, actor_name_snapshot, notes
            ) VALUES (
                v_project_id, 'RELEASE_RESERVATION', v_denom, v_note_count, 0, true,
                'JOB_RESERVATION:' || v_project_id, 'VAULT', v_auth_uid, v_actor_name, p_payload->>'notes'
            );

            v_result := jsonb_build_object('success', true, 'data', jsonb_build_object('released', v_note_count));

        WHEN 'cash_issue_batch' THEN
            IF (p_payload->>'note_count') ~ '^[0-9]+$' = FALSE THEN
                RAISE EXCEPTION 'note_count must be an integer';
            END IF;

            v_project_id := p_payload->>'project_id';
            v_recipient_name := trim(coalesce(p_payload->>'recipient_name', ''));
            v_recipient_id := (p_payload->>'recipient_id')::uuid;
            v_denom := (p_payload->>'denomination')::int;
            v_note_count := (p_payload->>'note_count')::int;
            v_use_res := coalesce((p_payload->>'use_reservation')::boolean, false);

            IF v_project_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.projects WHERE id = v_project_id) THEN
                RAISE EXCEPTION 'Valid project_id required for cash batch';
            END IF;
            IF v_recipient_name = '' OR v_note_count <= 0 THEN
                RAISE EXCEPTION 'Recipient name and positive note count required';
            END IF;

            SELECT * INTO v_vault FROM public.cash_vault_denominations WHERE denomination = v_denom FOR UPDATE;

            IF v_use_res THEN
                SELECT coalesce(sum(quantity - returned_qty - delivered_qty), 0) INTO v_stock
                FROM public.inventory_document_lines
                WHERE line_type = 'CASH_RESERVATION' AND project_id = v_project_id AND denomination = v_denom AND is_active = true;

                IF v_stock < v_note_count THEN
                    RAISE EXCEPTION 'Insufficient job reservation for project % (Requested: %, Reserved: %)',
                        v_project_id, v_note_count, v_stock;
                END IF;

                -- Deduct from reservation lines
                v_delta := v_note_count;
                FOR v_rec IN 
                    SELECT id, (quantity - returned_qty - delivered_qty) AS rem
                    FROM public.inventory_document_lines
                    WHERE line_type = 'CASH_RESERVATION' AND project_id = v_project_id AND denomination = v_denom AND is_active = true
                    ORDER BY created_at ASC
                    FOR UPDATE
                LOOP
                    IF v_delta <= 0 THEN EXIT; END IF;
                    IF v_rec.rem <= v_delta THEN
                        UPDATE public.inventory_document_lines
                        SET delivered_qty = delivered_qty + v_rec.rem, is_active = false, updated_at = timezone('utc'::text, now())
                        WHERE id = v_rec.id;
                        v_delta := v_delta - v_rec.rem;
                    ELSE
                        UPDATE public.inventory_document_lines
                        SET delivered_qty = delivered_qty + v_delta, updated_at = timezone('utc'::text, now())
                        WHERE id = v_rec.id;
                        v_delta := 0;
                    END IF;
                END LOOP;

                UPDATE public.cash_vault_denominations
                SET physical_count = physical_count - v_note_count,
                    reserved_count = reserved_count - v_note_count,
                    updated_at = timezone('utc'::text, now())
                WHERE denomination = v_denom;
            ELSE
                IF (v_vault.physical_count - v_vault.reserved_count) < v_note_count THEN
                    RAISE EXCEPTION 'Insufficient available vault cash';
                END IF;

                UPDATE public.cash_vault_denominations
                SET physical_count = physical_count - v_note_count,
                    updated_at = timezone('utc'::text, now())
                WHERE denomination = v_denom;
            END IF;

            v_batch_code := 'CSH-' || v_project_id || '-' || to_char(now(), 'MMDD-') || substring(gen_random_uuid()::text, 1, 4);

            INSERT INTO public.inventory_documents (
                doc_number, doc_type, project_id, recipient_id, recipient_name_snapshot,
                is_cash, denomination, status, notes, actor_auth_user_id, actor_name_snapshot
            ) VALUES (
                v_batch_code, 'CASH_BATCH', v_project_id, v_recipient_id, v_recipient_name,
                true, v_denom, 'ISSUED', p_payload->>'notes', v_auth_uid, v_actor_name
            ) RETURNING id INTO v_doc_id;

            INSERT INTO public.inventory_document_lines (
                document_id, line_type, project_id, recipient_id, denomination,
                quantity, accepted_qty, returned_qty, handed_over_qty, status, is_active
            ) VALUES (
                v_doc_id, 'CASH_BATCH', v_project_id, v_recipient_id, v_denom,
                v_note_count, 0, 0, 0, 'ISSUED', true
            ) RETURNING id INTO v_line_id;

            INSERT INTO public.inventory_movements (
                document_id, line_id, project_id, movement_type, denomination, quantity, delta_stock, is_cash,
                from_location, to_location, actor_auth_user_id, actor_name_snapshot, notes
            ) VALUES (
                v_doc_id, v_line_id, v_project_id, 'ISSUE_HELPER_BATCH', v_denom, v_note_count, -v_note_count, true,
                'VAULT', 'HELPER:' || v_recipient_name, v_auth_uid, v_actor_name, p_payload->>'notes'
            );

            -- Sync linked cash work task in production hub
            PERFORM public.warehouse_sync_cash_work(v_doc_id);

            v_result := jsonb_build_object(
                'success', true,
                'data', jsonb_build_object(
                    'batch', jsonb_build_object(
                        'id', v_doc_id,
                        'batch_code', v_batch_code,
                        'issued_count', v_note_count,
                        'line_id', v_line_id
                    )
                )
            );

        WHEN 'cash_receive_prepared' THEN
            IF (p_payload->>'note_count') ~ '^[0-9]+$' = FALSE THEN
                RAISE EXCEPTION 'note_count must be an integer';
            END IF;
            v_batch_id := (p_payload->>'batch_id')::uuid;
            v_note_count := (p_payload->>'note_count')::int;

            IF v_note_count <= 0 THEN
                RAISE EXCEPTION 'Prepared note count must be strictly greater than 0';
            END IF;

            -- Locate batch header + primary cash batch line
            SELECT d.id AS doc_id, d.project_id, d.recipient_name_snapshot, d.denomination,
                   l.id AS line_id, l.quantity, l.accepted_qty, l.returned_qty, l.handed_over_qty
            INTO v_batch
            FROM public.inventory_documents d
            JOIN public.inventory_document_lines l ON l.document_id = d.id AND l.line_type = 'CASH_BATCH'
            WHERE (d.id = v_batch_id OR l.id = v_batch_id) AND d.doc_type = 'CASH_BATCH'
            FOR UPDATE OF d, l;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Cash batch % not found', v_batch_id;
            END IF;

            IF (v_batch.quantity - v_batch.accepted_qty - v_batch.returned_qty - v_batch.handed_over_qty) < v_note_count THEN
                RAISE EXCEPTION 'Note count exceeds remaining notes in helper custody';
            END IF;

            UPDATE public.inventory_document_lines
            SET accepted_qty = accepted_qty + v_note_count,
                status = CASE 
                    WHEN (accepted_qty + v_note_count + returned_qty + handed_over_qty) >= quantity THEN 'FULLY_PREPARED'
                    ELSE 'PARTIAL_PREPARED'
                END,
                updated_at = timezone('utc'::text, now())
            WHERE id = v_batch.line_id;

            UPDATE public.inventory_documents
            SET status = CASE 
                    WHEN (v_batch.accepted_qty + v_note_count + v_batch.returned_qty + v_batch.handed_over_qty) >= v_batch.quantity THEN 'FULLY_PREPARED'
                    ELSE 'PARTIAL_PREPARED'
                END,
                updated_at = timezone('utc'::text, now())
            WHERE id = v_batch.doc_id;

            v_doc_no := 'CSH-PREP-' || v_batch.project_id || '-' || substring(gen_random_uuid()::text, 1, 4);
            INSERT INTO public.inventory_documents (
                doc_number, doc_type, project_id, source_document_id, is_cash, denomination,
                status, notes, actor_auth_user_id, actor_name_snapshot
            ) VALUES (
                v_doc_no, 'CASH_PREPARED', v_batch.project_id, v_batch.doc_id, true, v_batch.denomination,
                'COMPLETED', p_payload->>'notes', v_auth_uid, v_actor_name
            ) RETURNING id INTO v_doc_id;

            INSERT INTO public.inventory_document_lines (
                document_id, line_type, project_id, source_line_id, denomination,
                quantity, delivered_qty, status, is_active
            ) VALUES (
                v_doc_id, 'CASH_PREPARED', v_batch.project_id, v_batch.line_id, v_batch.denomination,
                v_note_count, 0, 'PREPARED', true
            ) RETURNING id INTO v_line_id;

            INSERT INTO public.inventory_movements (
                document_id, line_id, project_id, movement_type, denomination, quantity, delta_stock, is_cash,
                from_location, to_location, actor_auth_user_id, actor_name_snapshot, notes
            ) VALUES (
                v_doc_id, v_line_id, v_batch.project_id, 'RECEIVE_PREPARED', v_batch.denomination, v_note_count, 0, true,
                'HELPER:' || v_batch.recipient_name_snapshot, 'PREPARED_SET:' || v_batch.project_id,
                v_auth_uid, v_actor_name, p_payload->>'notes'
            );

            PERFORM public.warehouse_sync_cash_work(v_batch.doc_id);

            v_result := jsonb_build_object(
                'success', true,
                'data', jsonb_build_object('batch_id', v_batch.doc_id, 'prepared', v_note_count)
            );

        WHEN 'cash_deliver_to_customer' THEN
            IF (p_payload->>'note_count') ~ '^[0-9]+$' = FALSE THEN
                RAISE EXCEPTION 'note_count must be an integer';
            END IF;
            v_project_id := p_payload->>'project_id';
            v_denom := (p_payload->>'denomination')::int;
            v_note_count := (p_payload->>'note_count')::int;

            IF v_note_count <= 0 THEN
                RAISE EXCEPTION 'Delivered note count must be strictly greater than 0';
            END IF;

            SELECT coalesce(sum(quantity - delivered_qty), 0) INTO v_stock
            FROM public.inventory_document_lines
            WHERE line_type = 'CASH_PREPARED' AND project_id = v_project_id AND denomination = v_denom AND is_active = true;

            IF v_stock < v_note_count THEN
                RAISE EXCEPTION 'Insufficient prepared banknotes to deliver (Available: %, Requested: %)',
                    v_stock, v_note_count;
            END IF;

            v_delta := v_note_count;
            FOR v_rec IN 
                SELECT id, (quantity - delivered_qty) AS rem
                FROM public.inventory_document_lines
                WHERE line_type = 'CASH_PREPARED' AND project_id = v_project_id AND denomination = v_denom AND is_active = true
                ORDER BY created_at ASC
                FOR UPDATE
            LOOP
                IF v_delta <= 0 THEN EXIT; END IF;
                IF v_rec.rem <= v_delta THEN
                    UPDATE public.inventory_document_lines
                    SET delivered_qty = delivered_qty + v_rec.rem, is_active = false, updated_at = timezone('utc'::text, now())
                    WHERE id = v_rec.id;
                    v_delta := v_delta - v_rec.rem;
                ELSE
                    UPDATE public.inventory_document_lines
                    SET delivered_qty = delivered_qty + v_delta, updated_at = timezone('utc'::text, now())
                    WHERE id = v_rec.id;
                    v_delta := 0;
                END IF;
            END LOOP;

            INSERT INTO public.inventory_movements (
                project_id, movement_type, denomination, quantity, delta_stock, is_cash,
                from_location, to_location, actor_auth_user_id, actor_name_snapshot, notes
            ) VALUES (
                v_project_id, 'DELIVER_TO_CUSTOMER', v_denom, v_note_count, 0, true,
                'PREPARED_SET:' || v_project_id, 'CUSTOMER_DELIVERED',
                v_auth_uid, v_actor_name, p_payload->>'notes'
            );

            v_result := jsonb_build_object(
                'success', true,
                'data', jsonb_build_object('project_id', v_project_id, 'delivered', v_note_count)
            );

        WHEN 'cash_return_unused_raw' THEN
            IF (p_payload->>'note_count') ~ '^[0-9]+$' = FALSE THEN
                RAISE EXCEPTION 'note_count must be an integer';
            END IF;
            v_batch_id := (p_payload->>'batch_id')::uuid;
            v_note_count := (p_payload->>'note_count')::int;
            v_keep_res := coalesce((p_payload->>'keep_reservation')::boolean, true);

            IF v_note_count <= 0 THEN
                RAISE EXCEPTION 'Returned note count must be strictly greater than 0';
            END IF;

            SELECT d.id AS doc_id, d.project_id, d.recipient_name_snapshot, d.denomination,
                   l.id AS line_id, l.quantity, l.accepted_qty, l.returned_qty, l.handed_over_qty
            INTO v_batch
            FROM public.inventory_documents d
            JOIN public.inventory_document_lines l ON l.document_id = d.id AND l.line_type = 'CASH_BATCH'
            WHERE (d.id = v_batch_id OR l.id = v_batch_id) AND d.doc_type = 'CASH_BATCH'
            FOR UPDATE OF d, l;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Cash batch % not found', v_batch_id;
            END IF;

            IF (v_batch.quantity - v_batch.accepted_qty - v_batch.returned_qty - v_batch.handed_over_qty) < v_note_count THEN
                RAISE EXCEPTION 'Return count exceeds remaining notes in helper custody';
            END IF;

            UPDATE public.inventory_document_lines
            SET returned_qty = returned_qty + v_note_count,
                status = CASE 
                    WHEN (accepted_qty + returned_qty + v_note_count + handed_over_qty) >= quantity THEN 'RETURNED_UNUSED'
                    ELSE 'PARTIAL_PREPARED'
                END,
                updated_at = timezone('utc'::text, now())
            WHERE id = v_batch.line_id;

            UPDATE public.inventory_documents
            SET status = CASE 
                    WHEN (v_batch.accepted_qty + v_batch.returned_qty + v_note_count + v_batch.handed_over_qty) >= v_batch.quantity THEN 'RETURNED_UNUSED'
                    ELSE 'PARTIAL_PREPARED'
                END,
                updated_at = timezone('utc'::text, now())
            WHERE id = v_batch.doc_id;

            IF v_keep_res THEN
                UPDATE public.cash_vault_denominations
                SET physical_count = physical_count + v_note_count,
                    reserved_count = reserved_count + v_note_count,
                    updated_at = timezone('utc'::text, now())
                WHERE denomination = v_batch.denomination;

                v_doc_no := 'CSH-RES-' || v_batch.project_id || '-' || substring(gen_random_uuid()::text, 1, 4);
                INSERT INTO public.inventory_documents (
                    doc_number, doc_type, project_id, is_cash, denomination,
                    notes, actor_auth_user_id, actor_name_snapshot
                ) VALUES (
                    v_doc_no, 'CASH_RESERVATION', v_batch.project_id, true, v_batch.denomination,
                    'Restored from raw unused cash return', v_auth_uid, v_actor_name
                ) RETURNING id INTO v_doc_id;

                INSERT INTO public.inventory_document_lines (
                    document_id, line_type, project_id, denomination, quantity, status
                ) VALUES (
                    v_doc_id, 'CASH_RESERVATION', v_batch.project_id, v_batch.denomination, v_note_count, 'RESERVED'
                );
            ELSE
                UPDATE public.cash_vault_denominations
                SET physical_count = physical_count + v_note_count,
                    updated_at = timezone('utc'::text, now())
                WHERE denomination = v_batch.denomination;
            END IF;

            INSERT INTO public.inventory_movements (
                document_id, line_id, project_id, movement_type, denomination, quantity, delta_stock, is_cash,
                from_location, to_location, actor_auth_user_id, actor_name_snapshot, notes
            ) VALUES (
                v_batch.doc_id, v_batch.line_id, v_batch.project_id, 'RETURN_UNUSED_RAW', v_batch.denomination, v_note_count, v_note_count, true,
                'HELPER:' || v_batch.recipient_name_snapshot, 'VAULT',
                v_auth_uid, v_actor_name, p_payload->>'notes'
            );

            PERFORM public.warehouse_sync_cash_work(v_batch.doc_id);

            v_result := jsonb_build_object(
                'success', true,
                'data', jsonb_build_object('batch_id', v_batch.doc_id, 'returned', v_note_count)
            );

        WHEN 'cash_handover_batch' THEN
            IF (p_payload->>'note_count') ~ '^[0-9]+$' = FALSE THEN
                RAISE EXCEPTION 'note_count must be an integer';
            END IF;
            v_batch_id := (p_payload->>'batch_id')::uuid;
            v_note_count := (p_payload->>'note_count')::int;
            v_recipient_name := trim(coalesce(p_payload->>'to_recipient_name', ''));
            v_recipient_id := (p_payload->>'to_recipient_id')::uuid;

            IF v_recipient_name = '' OR v_note_count <= 0 THEN
                RAISE EXCEPTION 'Target recipient name and positive note count required for batch handover';
            END IF;
            IF NOT coalesce((p_payload->>'accepted')::boolean, false) THEN
                RAISE EXCEPTION 'Handover must be explicitly accepted by the receiver';
            END IF;

            SELECT d.id AS doc_id, d.project_id, d.recipient_name_snapshot, d.denomination,
                   l.id AS line_id, l.quantity, l.accepted_qty, l.returned_qty, l.handed_over_qty
            INTO v_batch
            FROM public.inventory_documents d
            JOIN public.inventory_document_lines l ON l.document_id = d.id AND l.line_type = 'CASH_BATCH'
            WHERE (d.id = v_batch_id OR l.id = v_batch_id) AND d.doc_type = 'CASH_BATCH'
            FOR UPDATE OF d, l;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Cash batch % not found', v_batch_id;
            END IF;

            IF (v_batch.quantity - v_batch.accepted_qty - v_batch.returned_qty - v_batch.handed_over_qty) < v_note_count THEN
                RAISE EXCEPTION 'Handover count exceeds remaining notes in helper custody';
            END IF;

            UPDATE public.inventory_document_lines
            SET handed_over_count = handed_over_qty + v_note_count,
                status = CASE 
                    WHEN (accepted_qty + returned_qty + handed_over_qty + v_note_count) >= quantity THEN 'HANDED_OVER'
                    ELSE 'PARTIAL_PREPARED'
                END,
                updated_at = timezone('utc'::text, now())
            WHERE id = v_batch.line_id;

            -- Target batch document + line for receiver
            v_batch_code := 'CSH-' || v_batch.project_id || '-XFER-' || substring(gen_random_uuid()::text, 1, 4);
            INSERT INTO public.inventory_documents (
                doc_number, doc_type, project_id, recipient_id, recipient_name_snapshot,
                is_cash, denomination, status, notes, actor_auth_user_id, actor_name_snapshot
            ) VALUES (
                v_batch_code, 'CASH_BATCH', v_batch.project_id, v_recipient_id, v_recipient_name,
                true, v_batch.denomination, 'ISSUED', 'Transferred from ' || v_batch.recipient_name_snapshot,
                v_auth_uid, v_actor_name
            ) RETURNING id INTO v_doc_id;

            INSERT INTO public.inventory_document_lines (
                document_id, line_type, project_id, recipient_id, source_line_id, denomination,
                quantity, accepted_qty, returned_qty, handed_over_qty, status, is_active
            ) VALUES (
                v_doc_id, 'CASH_BATCH', v_batch.project_id, v_recipient_id, v_batch.line_id, v_batch.denomination,
                v_note_count, 0, 0, 0, 'ISSUED', true
            ) RETURNING id INTO v_line_id;

            INSERT INTO public.inventory_movements (
                document_id, line_id, project_id, movement_type, denomination, quantity, delta_stock, is_cash,
                from_location, to_location, actor_auth_user_id, actor_name_snapshot, notes
            ) VALUES (
                v_doc_id, v_line_id, v_batch.project_id, 'HANDOVER_BATCH', v_batch.denomination, v_note_count, 0, true,
                'HELPER:' || v_batch.recipient_name_snapshot, 'HELPER:' || v_recipient_name,
                v_auth_uid, v_actor_name, p_payload->>'notes'
            );

            PERFORM public.warehouse_sync_cash_work(v_batch.doc_id);
            PERFORM public.warehouse_sync_cash_work(v_doc_id);

            v_result := jsonb_build_object(
                'success', true,
                'data', jsonb_build_object('new_batch_id', v_doc_id, 'handed_over', v_note_count)
            );

        WHEN 'cash_update_thresholds' THEN
            v_denom := (p_payload->>'denomination')::int;
            IF v_denom NOT IN (20, 50, 100, 500, 1000) THEN
                RAISE EXCEPTION 'Invalid banknote denomination: %', v_denom;
            END IF;

            UPDATE public.cash_vault_denominations
            SET low_alert_threshold = coalesce((p_payload->>'low_alert_threshold')::int, low_alert_threshold),
                target_available_count = coalesce((p_payload->>'target_available_count')::int, target_available_count),
                updated_at = timezone('utc'::text, now())
            WHERE denomination = v_denom;

            v_result := jsonb_build_object('success', true, 'data', jsonb_build_object('denomination', v_denom));

        WHEN 'cash_adjust_count' THEN
            v_denom := (p_payload->>'denomination')::int;
            IF v_denom NOT IN (20, 50, 100, 500, 1000) THEN
                RAISE EXCEPTION 'Invalid banknote denomination: %', v_denom;
            END IF;

            IF (p_payload->>'delta_count') ~ '^-?[0-9]+$' = FALSE THEN
                RAISE EXCEPTION 'delta_count must be an integer';
            END IF;
            v_delta := (p_payload->>'delta_count')::numeric;

            IF v_delta = 0 THEN
                RAISE EXCEPTION 'delta_count must be non-zero';
            END IF;

            IF trim(coalesce(p_payload->>'reason', '')) = '' THEN
                RAISE EXCEPTION 'Reason is strictly required for cash count adjustment';
            END IF;

            SELECT * INTO v_vault FROM public.cash_vault_denominations WHERE denomination = v_denom FOR UPDATE;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Denomination % not found in vault', v_denom;
            END IF;

            IF (v_vault.physical_count + v_delta) < v_vault.reserved_count THEN
                RAISE EXCEPTION 'Cash adjustment would cause physical count (%) to drop below reserved count (%)',
                    (v_vault.physical_count + v_delta), v_vault.reserved_count;
            END IF;

            UPDATE public.cash_vault_denominations
            SET physical_count = physical_count + v_delta::int,
                is_initialized = true,
                updated_at = timezone('utc'::text, now())
            WHERE denomination = v_denom;

            INSERT INTO public.inventory_movements (
                movement_type, denomination, quantity, delta_stock, is_cash,
                from_location, to_location, actor_auth_user_id, actor_name_snapshot, notes
            ) VALUES (
                'COUNT_ADJUSTMENT', v_denom, abs(v_delta::int), v_delta::int, true,
                'AUDIT', 'VAULT', v_auth_uid, v_actor_name, p_payload->>'reason'
            );

            v_result := jsonb_build_object(
                'success', true,
                'data', jsonb_build_object('denomination', v_denom, 'new_physical_count', (v_vault.physical_count + v_delta::int))
            );

        -- =====================================================================
        -- 2.11 Quotation / Legacy Checklist Save Action
        -- =====================================================================
        WHEN 'legacy_checklist_save' THEN
            v_project_id := p_payload->>'project_id';
            IF v_project_id IS NULL THEN
                RAISE EXCEPTION 'project_id required for checklist';
            END IF;

            v_doc_no := 'CHK-' || v_project_id || '-' || substring(gen_random_uuid()::text, 1, 4);
            INSERT INTO public.inventory_documents (
                doc_number, doc_type, project_id, notes, actor_auth_user_id, actor_name_snapshot
            ) VALUES (
                v_doc_no, 'CHECKLIST', v_project_id, p_payload->>'notes', v_auth_uid, v_actor_name
            ) RETURNING id INTO v_doc_id;

            FOR v_arr_elem IN SELECT * FROM jsonb_array_elements(p_payload->'items')
            LOOP
                INSERT INTO public.inventory_document_lines (
                    document_id, line_type, item_id, project_id, description,
                    quantity, unit, notes, is_active
                ) VALUES (
                    v_doc_id, 'CHECKLIST', (v_arr_elem->>'item_id')::uuid, v_project_id,
                    v_arr_elem->>'name', coalesce((v_arr_elem->>'quantity')::numeric, 1),
                    coalesce(v_arr_elem->>'unit', 'ชิ้น'), v_arr_elem->>'notes', true
                );
            END LOOP;

            v_result := jsonb_build_object('success', true, 'data', jsonb_build_object('document_id', v_doc_id));

        ELSE
            RAISE EXCEPTION 'Unknown warehouse action: %', p_action;
    END CASE;

    -- 3. Cache Result via Command Finish
    PERFORM public.warehouse_command_finish(p_action, v_payload_hash, p_idempotency_key, v_result, v_doc_id, v_is_cash);

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.warehouse_dispatch(TEXT, JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.warehouse_dispatch(TEXT, JSONB, UUID) TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. READ RPCS (BOUNDED MEMORY/NETWORK BUDGET)
-- ------------------------------------------------------------------------------

-- 5.1 Warehouse Schema Version
CREATE OR REPLACE FUNCTION public.warehouse_schema_version()
RETURNS INT AS $$
BEGIN
    RETURN 2;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

REVOKE ALL ON FUNCTION public.warehouse_schema_version() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.warehouse_schema_version() TO authenticated;

-- 5.2 Summary Projection (schema_version: 2, bounded 50 first stock page, no unbounded units)
CREATE OR REPLACE FUNCTION public.warehouse_get_summary()
RETURNS JSONB AS $$
DECLARE
    v_auth_uid UUID;
    v_cats JSONB;
    v_recipients JSONB;
    v_teams JSONB;
    v_rounds JSONB;
    v_items JSONB;
    v_total_items INT;
    v_total_cats INT;
BEGIN
    v_auth_uid := auth.uid();
    IF NOT public.fn_can_access_inventory(v_auth_uid) THEN
        RAISE EXCEPTION 'Unauthorized: inventory access permissions required';
    END IF;

    SELECT count(*) INTO v_total_cats FROM public.inventory_categories WHERE is_active = true;
    SELECT count(*) INTO v_total_items FROM public.inventory_items WHERE is_active = true AND lower(item_type) != 'banknote';

    -- Categories: max 100
    SELECT coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) INTO v_cats
    FROM (
        SELECT id, name, type, is_active
        FROM public.inventory_categories
        WHERE is_active = true
        ORDER BY name
        LIMIT 100
    ) c;

    -- Recipients: max 100
    SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) INTO v_recipients
    FROM (
        SELECT id, name, recipient_type, contact_info, is_active
        FROM public.inventory_recipients
        WHERE is_active = true
        ORDER BY name
        LIMIT 100
    ) r;

    -- Teams: max 50
    SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_teams
    FROM (
        SELECT id, id AS team_recipient_id, primary_recipient_id, primary_receiver_name, member_names, team_is_active AS is_active
        FROM public.inventory_recipients
        WHERE recipient_type = 'team' AND team_is_active = true
        ORDER BY primary_receiver_name
        LIMIT 50
    ) t;

    -- Active Rounds: max 20
    SELECT coalesce(jsonb_agg(to_jsonb(rd)), '[]'::jsonb) INTO v_rounds
    FROM (
        SELECT d.id, d.doc_number AS round_code, d.title, d.recipient_name_snapshot, d.status, d.due_at AS expected_return_at,
               coalesce((SELECT array_agg(project_id) FROM public.inventory_document_lines WHERE document_id = d.id AND line_type = 'ROUND_PROJECT'), '{}') AS project_ids
        FROM public.inventory_documents d
        WHERE d.doc_type = 'FIELD_ROUND' AND d.status IN ('IN_PROGRESS', 'PARTIAL_RETURNED')
        ORDER BY d.created_at DESC
        LIMIT 20
    ) rd;

    -- First stock page only (50 items strictly bounded, banknotes segregated)
    SELECT coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) INTO v_items
    FROM (
        SELECT id, code, name, category_id, item_type, unit, current_stock, min_alert_threshold, average_cost, storage_location, color, size, status, is_active, image_url,
               (SELECT count(*) FROM public.asset_units u WHERE u.item_id = i.id) AS tool_total,
               (SELECT count(*) FROM public.asset_units u WHERE u.item_id = i.id AND upper(u.status) = 'AVAILABLE') AS tool_available
        FROM public.inventory_items i
        WHERE is_active = true AND lower(item_type) != 'banknote'
        ORDER BY name, id
        LIMIT 50
    ) i;

    RETURN jsonb_build_object(
        'schema_version', 2,
        'capabilities', jsonb_build_object('item_images', true),
        'total_items_count', v_total_items,
        'total_categories_count', v_total_cats,
        'pending_recovery_count', (SELECT count(*) FROM public.inventory_document_lines WHERE line_type = 'RECOVERY' AND pending_qty > 0),
        'pending_recoveries', (SELECT count(*) FROM public.inventory_document_lines WHERE line_type = 'RECOVERY' AND pending_qty > 0),
        'borrowed_tools', (SELECT count(*) FROM public.asset_units WHERE active_custody_line_id IS NOT NULL),
        'facets', jsonb_build_object(
            'colors', (SELECT coalesce(jsonb_agg(value), '[]'::jsonb) FROM (SELECT DISTINCT color AS value FROM public.inventory_items WHERE is_active AND lower(item_type) != 'banknote' AND nullif(color,'') IS NOT NULL ORDER BY value LIMIT 100) f),
            'sizes', (SELECT coalesce(jsonb_agg(value), '[]'::jsonb) FROM (SELECT DISTINCT size AS value FROM public.inventory_items WHERE is_active AND lower(item_type) != 'banknote' AND nullif(size,'') IS NOT NULL ORDER BY value LIMIT 100) f),
            'locations', (SELECT coalesce(jsonb_agg(value), '[]'::jsonb) FROM (SELECT DISTINCT storage_location AS value FROM public.inventory_items WHERE is_active AND lower(item_type) != 'banknote' AND nullif(storage_location,'') IS NOT NULL ORDER BY value LIMIT 100) f),
            'type_counts', (SELECT coalesce(jsonb_object_agg(item_type, count), '{}'::jsonb) FROM (SELECT lower(item_type) AS item_type, count(*) FROM public.inventory_items WHERE is_active AND lower(item_type) != 'banknote' GROUP BY lower(item_type)) f)
        ),
        'categories', v_cats,
        'recipients', v_recipients,
        'teams', v_teams,
        'rounds', v_rounds,
        'items', v_items,
        'asset_units', '[]'::jsonb,
        'legacy_borrowed_units', '[]'::jsonb
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.warehouse_get_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.warehouse_get_summary() TO authenticated;

-- 5.3 NEW: Server-Side Stock List & Filters (50 default, 100 max)
CREATE OR REPLACE FUNCTION public.warehouse_list_stock(p_filters JSONB DEFAULT '{}'::jsonb)
RETURNS JSONB AS $$
DECLARE
    v_auth_uid UUID;
    v_limit INT;
    v_offset INT;
    v_search TEXT;
    v_type TEXT;
    v_category_id UUID;
    v_color TEXT;
    v_size TEXT;
    v_location TEXT;
    v_item_status TEXT;
    v_avail TEXT;
    v_item_ids UUID[];
    v_items JSONB;
    v_total INT;
    v_has_more BOOLEAN := false;
BEGIN
    v_auth_uid := auth.uid();
    IF NOT public.fn_can_access_inventory(v_auth_uid) THEN
        RAISE EXCEPTION 'Unauthorized: inventory access permissions required';
    END IF;

    v_limit := LEAST(100, GREATEST(1, coalesce((p_filters->>'limit')::int, 50)));
    v_offset := GREATEST(0, coalesce((p_filters->>'offset')::int, 0));
    v_search := trim(coalesce(p_filters->>'search', ''));
    v_type := lower(trim(coalesce(p_filters->>'item_type', '')));
    v_category_id := (p_filters->>'category_id')::uuid;
    v_color := trim(coalesce(p_filters->>'color', ''));
    v_size := trim(coalesce(p_filters->>'size', ''));
    v_location := trim(coalesce(p_filters->>'storage_location', p_filters->>'location', ''));
    v_item_status := trim(coalesce(p_filters->>'status', ''));
    v_avail := lower(trim(coalesce(p_filters->>'availability', '')));

    IF p_filters ? 'item_ids' AND jsonb_array_length(p_filters->'item_ids') > 0 THEN
        SELECT array_agg(x::uuid) INTO v_item_ids FROM jsonb_array_elements_text(p_filters->'item_ids') x;
    END IF;

    SELECT count(*) INTO v_total
    FROM public.inventory_items i
    WHERE i.is_active = true
      AND lower(i.item_type) != 'banknote'
      AND (v_search = '' OR (i.name ILIKE '%' || v_search || '%' OR coalesce(i.code, '') ILIKE '%' || v_search || '%'))
      AND (v_type = '' OR lower(i.item_type) = v_type)
      AND (v_category_id IS NULL OR i.category_id = v_category_id)
      AND (v_color = '' OR i.color = v_color)
      AND (v_size = '' OR i.size = v_size)
      AND (v_location = '' OR i.storage_location = v_location)
      AND (v_item_status = '' OR i.status = v_item_status)
      AND (v_item_ids IS NULL OR i.id = ANY(v_item_ids))
      AND (
          v_avail = '' 
          OR (v_avail = 'in_stock' AND i.current_stock > 0)
          OR (v_avail = 'out_of_stock' AND i.current_stock <= 0)
          OR (v_avail = 'low_stock' AND i.current_stock <= i.min_alert_threshold)
      );

    SELECT coalesce(jsonb_agg(to_jsonb(row)), '[]'::jsonb) INTO v_items
    FROM (
        SELECT id, code, name, category_id, item_type, unit, current_stock, min_alert_threshold, average_cost, storage_location, color, size, status, is_active, image_url,
               (SELECT count(*) FROM public.asset_units u WHERE u.item_id = i.id) AS tool_total,
               (SELECT count(*) FROM public.asset_units u WHERE u.item_id = i.id AND upper(u.status) = 'AVAILABLE') AS tool_available
        FROM public.inventory_items i
        WHERE i.is_active = true
          AND lower(i.item_type) != 'banknote'
          AND (v_search = '' OR (i.name ILIKE '%' || v_search || '%' OR coalesce(i.code, '') ILIKE '%' || v_search || '%'))
          AND (v_type = '' OR lower(i.item_type) = v_type)
          AND (v_category_id IS NULL OR i.category_id = v_category_id)
          AND (v_color = '' OR i.color = v_color)
          AND (v_size = '' OR i.size = v_size)
      AND (v_location = '' OR i.storage_location = v_location)
      AND (v_item_status = '' OR i.status = v_item_status)
          AND (v_item_ids IS NULL OR i.id = ANY(v_item_ids))
          AND (
              v_avail = '' 
              OR (v_avail = 'in_stock' AND i.current_stock > 0)
              OR (v_avail = 'out_of_stock' AND i.current_stock <= 0)
              OR (v_avail = 'low_stock' AND i.current_stock <= i.min_alert_threshold)
          )
        ORDER BY i.name, i.id
        LIMIT v_limit OFFSET v_offset
    ) row;

    IF (v_offset + v_limit) < v_total THEN
        v_has_more := true;
    END IF;

    RETURN jsonb_build_object(
        'items', v_items,
        'facets', jsonb_build_object(
            'colors', (SELECT coalesce(jsonb_agg(value), '[]'::jsonb) FROM (SELECT DISTINCT color AS value FROM public.inventory_items WHERE is_active AND lower(item_type) != 'banknote' AND nullif(color,'') IS NOT NULL ORDER BY value LIMIT 100) f),
            'sizes', (SELECT coalesce(jsonb_agg(value), '[]'::jsonb) FROM (SELECT DISTINCT size AS value FROM public.inventory_items WHERE is_active AND lower(item_type) != 'banknote' AND nullif(size,'') IS NOT NULL ORDER BY value LIMIT 100) f),
            'locations', (SELECT coalesce(jsonb_agg(value), '[]'::jsonb) FROM (SELECT DISTINCT storage_location AS value FROM public.inventory_items WHERE is_active AND lower(item_type) != 'banknote' AND nullif(storage_location,'') IS NOT NULL ORDER BY value LIMIT 100) f),
            'type_counts', (SELECT coalesce(jsonb_object_agg(item_type, count), '{}'::jsonb) FROM (SELECT lower(item_type) AS item_type, count(*) FROM public.inventory_items WHERE is_active AND lower(item_type) != 'banknote' GROUP BY lower(item_type)) f)
        ),
        'total_count', v_total,
        'has_more', v_has_more,
        'limit', v_limit,
        'offset', v_offset
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.warehouse_list_stock(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.warehouse_list_stock(JSONB) TO authenticated;

-- 5.4 NEW: Unit Lookup & List (20 default, 50 max; joins item so QR scan finds off-page units)
CREATE OR REPLACE FUNCTION public.warehouse_list_units(p_filters JSONB DEFAULT '{}'::jsonb)
RETURNS JSONB AS $$
DECLARE
    v_auth_uid UUID;
    v_limit INT;
    v_offset INT;
    v_item_id UUID;
    v_unit_code TEXT;
    v_status TEXT;
    v_search TEXT;
    v_units JSONB;
    v_total INT;
    v_has_more BOOLEAN := false;
BEGIN
    v_auth_uid := auth.uid();
    IF NOT public.fn_can_access_inventory(v_auth_uid) THEN
        RAISE EXCEPTION 'Unauthorized: inventory access permissions required';
    END IF;

    v_limit := LEAST(50, GREATEST(1, coalesce((p_filters->>'limit')::int, 20)));
    v_offset := GREATEST(0, coalesce((p_filters->>'offset')::int, 0));
    v_item_id := (p_filters->>'item_id')::uuid;
    v_unit_code := trim(coalesce(p_filters->>'unit_code', ''));
    v_status := upper(trim(coalesce(p_filters->>'status', '')));
    v_search := trim(coalesce(p_filters->>'search', ''));

    SELECT count(*) INTO v_total
    FROM public.asset_units u
    JOIN public.inventory_items i ON u.item_id = i.id
    WHERE (v_item_id IS NULL OR u.item_id = v_item_id)
      AND (v_unit_code = '' OR u.unit_code = v_unit_code)
      AND (v_status = '' OR upper(u.status) = v_status)
      AND (v_search = '' OR (u.unit_code ILIKE '%' || v_search || '%' OR i.name ILIKE '%' || v_search || '%'));

    SELECT coalesce(jsonb_agg(to_jsonb(row)), '[]'::jsonb) INTO v_units
    FROM (
        SELECT u.unit_code, u.item_id, u.status, u.borrowed_by, u.borrowed_at, u.due_at, u.project_id, u.notes,
               u.active_custody_line_id, u.active_round_id,
               jsonb_build_object('id', i.id, 'name', i.name, 'code', i.code, 'unit', i.unit, 'image_url', i.image_url, 'item_type', i.item_type, 'color', i.color) AS item
        FROM public.asset_units u
        JOIN public.inventory_items i ON u.item_id = i.id
        WHERE (v_item_id IS NULL OR u.item_id = v_item_id)
          AND (v_unit_code = '' OR u.unit_code = v_unit_code)
          AND (v_status = '' OR upper(u.status) = v_status)
          AND (v_search = '' OR (u.unit_code ILIKE '%' || v_search || '%' OR i.name ILIKE '%' || v_search || '%'))
        ORDER BY u.unit_code
        LIMIT v_limit OFFSET v_offset
    ) row;

    IF (v_offset + v_limit) < v_total THEN
        v_has_more := true;
    END IF;

    RETURN jsonb_build_object(
        'units', v_units,
        'total_count', v_total,
        'has_more', v_has_more,
        'limit', v_limit,
        'offset', v_offset
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.warehouse_list_units(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.warehouse_list_units(JSONB) TO authenticated;

-- 5.5 Operational Read Projection (Issues, Recoveries, Custodies, Incidents - 20 default per section)
CREATE OR REPLACE FUNCTION public.warehouse_get_operations(p_filters JSONB DEFAULT '{}'::jsonb)
RETURNS JSONB AS $$
DECLARE
    v_auth_uid UUID;
    v_limit INT;
    v_offset INT;
    v_proj_id TEXT;
    v_round_id UUID;
    v_issue_lines JSONB := '[]'::jsonb;
    v_recoveries JSONB := '[]'::jsonb;
    v_custodies JSONB := '[]'::jsonb;
    v_incidents JSONB := '[]'::jsonb;
    v_has_more BOOLEAN := false;
    v_c_issues INT := 0;
    v_c_recovs INT := 0;
    v_c_custodies INT := 0;
    v_c_incidents INT := 0;
BEGIN
    v_auth_uid := auth.uid();
    IF NOT public.fn_can_access_inventory(v_auth_uid) THEN
        RAISE EXCEPTION 'Unauthorized: inventory access permissions required';
    END IF;

    v_limit := LEAST(100, GREATEST(1, coalesce((p_filters->>'limit')::int, 20)));
    v_offset := GREATEST(0, coalesce((p_filters->>'offset')::int, 0));
    v_proj_id := p_filters->>'project_id';
    v_round_id := (p_filters->>'round_id')::uuid;

    -- 1. Outstanding Material Issue Lines (Remaining = Issued - Returned - Recovered > 0)
    WITH outstanding AS (
        SELECT 
            m.id,
            m.id AS source_issue_movement_id,
            m.item_id,
            d.project_id,
            d.round_id,
            d.recipient_name_snapshot,
            coalesce(m.source_item_variant_snapshot->>'name', i.name) AS item_name,
            coalesce(m.source_item_variant_snapshot->>'color', i.color) AS color,
            coalesce(m.source_item_variant_snapshot->>'size', i.size) AS size,
            coalesce(m.source_item_variant_snapshot->>'unit', i.unit) AS unit,
            m.quantity AS issued_qty,
            coalesce((SELECT sum(ret.quantity) FROM public.inventory_movements ret WHERE ret.source_issue_movement_id = m.id AND ret.movement_type = 'RETURN_UNUSED'), 0) AS returned_qty,
            coalesce((SELECT sum(rcv.quantity) FROM public.inventory_document_lines rcv WHERE rcv.source_issue_movement_id = m.id AND rcv.line_type = 'RECOVERY'), 0) AS recovered_qty,
            m.created_at
        FROM public.inventory_movements m
        JOIN public.inventory_documents d ON m.document_id = d.id
        JOIN public.inventory_items i ON m.item_id = i.id
        WHERE m.movement_type = 'ISSUE'
          AND (v_proj_id IS NULL OR d.project_id = v_proj_id)
          AND (v_round_id IS NULL OR d.round_id = v_round_id)
    )
    SELECT coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb), count(*)
    INTO v_issue_lines, v_c_issues
    FROM (
        SELECT *, (issued_qty - returned_qty - recovered_qty) AS remaining_qty
        FROM outstanding
        WHERE (issued_qty - returned_qty - recovered_qty) > 0
        ORDER BY created_at DESC
        LIMIT v_limit OFFSET v_offset
    ) l;

    -- 2. Pending Material Recoveries (Waiting for inspection)
    SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb), count(*)
    INTO v_recoveries, v_c_recovs
    FROM (
        SELECT 
            l.id, l.item_id, l.source_issue_movement_id, l.document_id,
            l.quantity AS recovered_qty, l.status,
            i.name AS item_name, i.color, i.size, i.unit,
            l.project_id, l.round_id, l.created_at
        FROM public.inventory_document_lines l
        JOIN public.inventory_items i ON l.item_id = i.id
        WHERE l.line_type = 'RECOVERY' AND l.status = 'PENDING'
          AND (v_proj_id IS NULL OR l.project_id = v_proj_id)
          AND (v_round_id IS NULL OR l.round_id = v_round_id)
        ORDER BY l.created_at DESC
        LIMIT v_limit OFFSET v_offset
    ) r;

    -- 3. Active Tool Custodies
    SELECT coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb), count(*)
    INTO v_custodies, v_c_custodies
    FROM (
        SELECT 
            l.id, l.unit_code, l.project_id, l.round_id,
            d.recipient_name_snapshot, l.due_at AS due_date, l.created_at AS borrowed_at,
            l.notes, i.name AS item_name, u.status
        FROM public.inventory_document_lines l
        JOIN public.inventory_documents d ON l.document_id = d.id
        JOIN public.asset_units u ON l.unit_code = u.unit_code
        JOIN public.inventory_items i ON u.item_id = i.id
        WHERE l.line_type = 'TOOL_CUSTODY' AND l.is_active = true
          AND (v_proj_id IS NULL OR l.project_id = v_proj_id)
          AND (v_round_id IS NULL OR l.round_id = v_round_id)
        ORDER BY l.created_at DESC
        LIMIT v_limit OFFSET v_offset
    ) c;

    -- 4. Open Incidents
    SELECT coalesce(jsonb_agg(to_jsonb(inc)), '[]'::jsonb), count(*)
    INTO v_incidents, v_c_incidents
    FROM (
        SELECT 
            l.id, l.unit_code, l.status AS incident_type, l.project_id, l.round_id,
            d.recipient_name_snapshot, l.status AS resolution_status, l.notes, l.created_at
        FROM public.inventory_document_lines l
        JOIN public.inventory_documents d ON l.document_id = d.id
        WHERE l.line_type = 'INCIDENT' AND l.status IN ('OPEN', 'INVESTIGATING')
          AND (v_round_id IS NULL OR l.round_id = v_round_id)
        ORDER BY l.created_at DESC
        LIMIT v_limit OFFSET v_offset
    ) inc;

    IF v_c_issues = v_limit OR v_c_recovs = v_limit OR v_c_custodies = v_limit OR v_c_incidents = v_limit THEN
        v_has_more := true;
    END IF;

    RETURN jsonb_build_object(
        'issue_lines', v_issue_lines,
        'recoveries', v_recoveries,
        'custodies', v_custodies,
        'incidents', v_incidents,
        'has_more', v_has_more
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.warehouse_get_operations(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.warehouse_get_operations(JSONB) TO authenticated;

-- 5.6 Paginated History (20 default, cash excluded unless authorized, no huge JSON)
CREATE OR REPLACE FUNCTION public.warehouse_get_history(p_filters JSONB DEFAULT '{}'::jsonb)
RETURNS JSONB AS $$
DECLARE
    v_auth_uid UUID;
    v_can_cash BOOLEAN;
    v_docs JSONB;
    v_moves JSONB;
    v_cash_moves JSONB := '[]'::jsonb;
    v_limit INT;
    v_offset INT;
BEGIN
    v_auth_uid := auth.uid();
    IF NOT public.fn_can_access_inventory(v_auth_uid) THEN
        RAISE EXCEPTION 'Unauthorized: inventory access permissions required';
    END IF;

    v_can_cash := public.fn_can_manage_cash(v_auth_uid) AND coalesce((p_filters->>'include_cash')::boolean, true);
    v_limit := LEAST(50, GREATEST(1, coalesce((p_filters->>'limit')::int, 20)));
    v_offset := GREATEST(0, coalesce((p_filters->>'offset')::int, 0));

    SELECT coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) INTO v_docs
    FROM (
        SELECT id, doc_number, doc_type, project_id, round_id, recipient_name_snapshot,
               due_at, metadata->>'borrowed_at' AS borrowed_at,
               team_members_snapshot, status,
               CASE 
                   WHEN notes IS NOT NULL AND length(notes) > 256 THEN substring(notes, 1, 256) || '...'
                   ELSE notes
               END AS notes,
               actor_name_snapshot, created_at
        FROM public.inventory_documents
        WHERE (NOT coalesce(is_cash, false) OR v_can_cash)
          AND (p_filters->>'project_id' IS NULL OR project_id = p_filters->>'project_id')
          AND doc_type != 'COMMAND'
          AND (p_filters->>'doc_type' IS NULL OR doc_type = p_filters->>'doc_type')
        ORDER BY created_at DESC
        LIMIT v_limit OFFSET v_offset
    ) d;

    SELECT coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) INTO v_moves
    FROM (
        SELECT id, document_id, item_id, project_id, movement_type, quantity, delta_stock,
               source_item_variant_snapshot->>'name' AS item_name_snapshot,
               source_item_variant_snapshot->>'color' AS item_color_snapshot,
               source_item_variant_snapshot->>'unit' AS unit,
               CASE 
                   WHEN notes IS NOT NULL AND length(notes) > 256 THEN substring(notes, 1, 256) || '...'
                   ELSE notes
               END AS notes,
               actor_name_snapshot, created_at
        FROM public.inventory_movements
        WHERE NOT coalesce(is_cash, false)
          AND (p_filters->>'project_id' IS NULL OR project_id = p_filters->>'project_id')
          AND p_filters->>'doc_type' IS NULL
        ORDER BY created_at DESC
        LIMIT v_limit OFFSET v_offset
    ) m;

    IF v_can_cash AND coalesce((p_filters->>'include_cash')::boolean, true) THEN
        SELECT coalesce(jsonb_agg(to_jsonb(cm)), '[]'::jsonb) INTO v_cash_moves
        FROM (
            SELECT id, movement_type AS action_type, project_id, denomination, quantity AS note_count,
                   (denomination * quantity) AS total_value, from_location, to_location,
                   actor_name_snapshot,
                   CASE 
                       WHEN notes IS NOT NULL AND length(notes) > 256 THEN substring(notes, 1, 256) || '...'
                       ELSE notes
                   END AS notes,
                   created_at
            FROM public.inventory_movements
            WHERE is_cash = true
              AND (p_filters->>'project_id' IS NULL OR project_id = p_filters->>'project_id')
              AND p_filters->>'doc_type' IS NULL
            ORDER BY created_at DESC
            LIMIT v_limit OFFSET v_offset
        ) cm;
    END IF;

    RETURN jsonb_build_object(
        'documents', v_docs,
        'movements', v_moves,
        'cash_movements', v_cash_moves,
        'has_more', greatest(jsonb_array_length(v_docs), jsonb_array_length(v_moves), jsonb_array_length(v_cash_moves)) = v_limit
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.warehouse_get_history(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.warehouse_get_history(JSONB) TO authenticated;

-- 5.7 Cash Summary (5 vault rows + first 20 per section + has_more)
CREATE OR REPLACE FUNCTION public.warehouse_get_cash_summary()
RETURNS JSONB AS $$
DECLARE
    v_auth_uid UUID;
    v_denoms JSONB;
    v_reservations JSONB;
    v_batches JSONB;
    v_prep JSONB;
    v_legacy_banknotes JSONB;
    v_has_more_batches BOOLEAN := false;
    v_has_more_res BOOLEAN := false;
    v_has_more_prep BOOLEAN := false;
    v_cnt INT;
BEGIN
    v_auth_uid := auth.uid();
    IF NOT public.fn_can_manage_cash(v_auth_uid) THEN
        RAISE EXCEPTION 'Unauthorized: cash permissions required';
    END IF;

    SELECT coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) INTO v_denoms
    FROM (
        SELECT 
            denomination,
            physical_count,
            reserved_count,
            (physical_count - reserved_count) AS available_count,
            low_alert_threshold,
            target_available_count,
            GREATEST(0, target_available_count - (physical_count - reserved_count)) AS restock_needed,
            (denomination * physical_count) AS total_physical_value,
            (denomination * (physical_count - reserved_count)) AS total_available_value,
            is_initialized
        FROM public.cash_vault_denominations
        ORDER BY denomination
    ) d;

    -- Reservations (active lines, max 20)
    SELECT count(*) INTO v_cnt FROM public.inventory_document_lines WHERE line_type = 'CASH_RESERVATION' AND is_active = true;
    IF v_cnt > 20 THEN v_has_more_res := true; END IF;

    SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) INTO v_reservations
    FROM (
        SELECT id, project_id, denomination, (quantity - returned_qty - delivered_qty) AS reserved_count
        FROM public.inventory_document_lines
        WHERE line_type = 'CASH_RESERVATION' AND is_active = true
        ORDER BY project_id, denomination
        LIMIT 20
    ) r;

    -- Helper Batches (active, max 20)
    SELECT count(*) INTO v_cnt FROM public.inventory_documents WHERE doc_type = 'CASH_BATCH' AND status NOT IN ('DELIVERED', 'CLOSED');
    IF v_cnt > 20 THEN v_has_more_batches := true; END IF;

    SELECT coalesce(jsonb_agg(to_jsonb(b)), '[]'::jsonb) INTO v_batches
    FROM (
        SELECT d.id, d.doc_number AS batch_code, d.project_id, d.recipient_name_snapshot, d.denomination,
               l.quantity AS issued_count, l.accepted_qty AS prepared_count, l.returned_qty AS returned_raw_count, l.handed_over_qty AS handed_over_count,
               (l.quantity - l.accepted_qty - l.returned_qty - l.handed_over_qty) AS remaining_count,
               d.status
        FROM public.inventory_documents d
        JOIN public.inventory_document_lines l ON l.document_id = d.id AND l.line_type = 'CASH_BATCH'
        WHERE d.doc_type = 'CASH_BATCH' AND d.status NOT IN ('DELIVERED', 'CLOSED')
        ORDER BY d.created_at DESC
        LIMIT 20
    ) b;

    -- Prepared Sets (ready for delivery, max 20)
    SELECT count(*) INTO v_cnt FROM public.inventory_document_lines WHERE line_type = 'CASH_PREPARED' AND is_active = true;
    IF v_cnt > 20 THEN v_has_more_prep := true; END IF;

    SELECT coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) INTO v_prep
    FROM (
        SELECT id, project_id, denomination, quantity AS prepared_count, delivered_qty AS delivered_count,
               (quantity - delivered_qty) AS ready_for_delivery_count
        FROM public.inventory_document_lines
        WHERE line_type = 'CASH_PREPARED' AND is_active = true
        ORDER BY project_id, denomination
        LIMIT 20
    ) p;

    SELECT coalesce(jsonb_agg(to_jsonb(lb)), '[]'::jsonb) INTO v_legacy_banknotes
    FROM (
        SELECT id, code, name, current_stock, storage_location
        FROM public.inventory_items
        WHERE is_active = true AND lower(item_type) = 'banknote'
        ORDER BY code
    ) lb;

    RETURN jsonb_build_object(
        'denominations', v_denoms,
        'reservations', v_reservations,
        'helper_batches', v_batches,
        'prepared_sets', v_prep,
        'legacy_banknotes', v_legacy_banknotes,
        'has_more_batches', v_has_more_batches,
        'has_more_reservations', v_has_more_res,
        'has_more_prepared', v_has_more_prep
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.warehouse_get_cash_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.warehouse_get_cash_summary() TO authenticated;

-- 5.8 NEW: Paginated Cash List RPC (20 default, section filtered)
CREATE OR REPLACE FUNCTION public.warehouse_list_cash(p_filters JSONB DEFAULT '{}'::jsonb)
RETURNS JSONB AS $$
DECLARE
    v_auth_uid UUID;
    v_limit INT;
    v_offset INT;
    v_section TEXT;
    v_project_id TEXT;
    v_data JSONB;
    v_total INT;
    v_has_more BOOLEAN := false;
BEGIN
    v_auth_uid := auth.uid();
    IF NOT public.fn_can_manage_cash(v_auth_uid) THEN
        RAISE EXCEPTION 'Unauthorized: cash permissions required';
    END IF;

    v_limit := LEAST(50, GREATEST(1, coalesce((p_filters->>'limit')::int, 20)));
    v_offset := GREATEST(0, coalesce((p_filters->>'offset')::int, 0));
    v_section := lower(trim(coalesce(p_filters->>'section', 'batches')));
    v_project_id := p_filters->>'project_id';

    IF v_section = 'batches' THEN
        SELECT count(*) INTO v_total
        FROM public.inventory_documents d
        WHERE d.doc_type = 'CASH_BATCH'
          AND (v_project_id IS NULL OR d.project_id = v_project_id);

        SELECT coalesce(jsonb_agg(to_jsonb(b)), '[]'::jsonb) INTO v_data
        FROM (
            SELECT d.id, d.doc_number AS batch_code, d.project_id, d.recipient_name_snapshot, d.denomination,
                   l.quantity AS issued_count, l.accepted_qty AS prepared_count, l.returned_qty AS returned_raw_count, l.handed_over_qty AS handed_over_count,
                   (l.quantity - l.accepted_qty - l.returned_qty - l.handed_over_qty) AS remaining_count,
                   d.status, d.created_at
            FROM public.inventory_documents d
            JOIN public.inventory_document_lines l ON l.document_id = d.id AND l.line_type = 'CASH_BATCH'
            WHERE d.doc_type = 'CASH_BATCH'
              AND (v_project_id IS NULL OR d.project_id = v_project_id)
            ORDER BY d.created_at DESC
            LIMIT v_limit OFFSET v_offset
        ) b;

    ELSIF v_section = 'reservations' THEN
        SELECT count(*) INTO v_total
        FROM public.inventory_document_lines l
        WHERE l.line_type = 'CASH_RESERVATION'
          AND (v_project_id IS NULL OR l.project_id = v_project_id);

        SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) INTO v_data
        FROM (
            SELECT l.id, l.document_id, l.project_id, l.denomination,
                   l.quantity AS reserved_count, l.returned_qty, l.delivered_qty,
                   (l.quantity - l.returned_qty - l.delivered_qty) AS active_reserved_count,
                   l.is_active, l.created_at
            FROM public.inventory_document_lines l
            WHERE l.line_type = 'CASH_RESERVATION'
              AND (v_project_id IS NULL OR l.project_id = v_project_id)
            ORDER BY l.created_at DESC
            LIMIT v_limit OFFSET v_offset
        ) r;

    ELSIF v_section = 'prepared' THEN
        SELECT count(*) INTO v_total
        FROM public.inventory_document_lines l
        WHERE l.line_type = 'CASH_PREPARED'
          AND (v_project_id IS NULL OR l.project_id = v_project_id);

        SELECT coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) INTO v_data
        FROM (
            SELECT l.id, l.document_id, l.project_id, l.denomination,
                   l.quantity AS prepared_count, l.delivered_qty AS delivered_count,
                   (l.quantity - l.delivered_qty) AS ready_for_delivery_count,
                   l.is_active, l.created_at
            FROM public.inventory_document_lines l
            WHERE l.line_type = 'CASH_PREPARED'
              AND (v_project_id IS NULL OR l.project_id = v_project_id)
            ORDER BY l.created_at DESC
            LIMIT v_limit OFFSET v_offset
        ) p;

    ELSE -- movements
        SELECT count(*) INTO v_total
        FROM public.inventory_movements m
        WHERE m.is_cash = true
          AND (v_project_id IS NULL OR m.project_id = v_project_id);

        SELECT coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) INTO v_data
        FROM (
            SELECT id, movement_type AS action_type, project_id, denomination, quantity AS note_count,
                   (denomination * quantity) AS total_value, from_location, to_location,
                   actor_name_snapshot, notes, created_at
            FROM public.inventory_movements
            WHERE is_cash = true
              AND (v_project_id IS NULL OR project_id = v_project_id)
            ORDER BY created_at DESC
            LIMIT v_limit OFFSET v_offset
        ) m;
    END IF;

    IF (v_offset + v_limit) < v_total THEN
        v_has_more := true;
    END IF;

    RETURN jsonb_build_object(
        'section', v_section,
        'data', v_data,
        'total_count', v_total,
        'has_more', v_has_more,
        'limit', v_limit,
        'offset', v_offset
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.warehouse_list_cash(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.warehouse_list_cash(JSONB) TO authenticated;

-- 5.9 NEW: Quotation Checklists Reader (20 default)
CREATE OR REPLACE FUNCTION public.warehouse_get_checklists(p_filters JSONB DEFAULT '{}'::jsonb)
RETURNS JSONB AS $$
DECLARE
    v_auth_uid UUID;
    v_limit INT;
    v_offset INT;
    v_proj_id TEXT;
    v_lines JSONB;
    v_total INT;
    v_has_more BOOLEAN := false;
BEGIN
    v_auth_uid := auth.uid();
    IF NOT public.fn_can_access_inventory(v_auth_uid) THEN
        RAISE EXCEPTION 'Unauthorized: inventory access permissions required';
    END IF;

    v_limit := LEAST(100, GREATEST(1, coalesce((p_filters->>'limit')::int, 20)));
    v_offset := GREATEST(0, coalesce((p_filters->>'offset')::int, 0));
    v_proj_id := p_filters->>'project_id';

    SELECT count(*) INTO v_total
    FROM public.inventory_document_lines l
    WHERE l.line_type = 'CHECKLIST'
      AND (v_proj_id IS NULL OR l.project_id = v_proj_id);

    SELECT coalesce(jsonb_agg(to_jsonb(row)), '[]'::jsonb) INTO v_lines
    FROM (
        SELECT l.id, l.document_id, l.project_id, l.item_id, l.description AS name,
               l.quantity, l.unit, l.notes, l.is_active, l.created_at,
               i.code AS item_code
        FROM public.inventory_document_lines l
        LEFT JOIN public.inventory_items i ON l.item_id = i.id
        WHERE l.line_type = 'CHECKLIST'
          AND (v_proj_id IS NULL OR l.project_id = v_proj_id)
        ORDER BY l.created_at DESC
        LIMIT v_limit OFFSET v_offset
    ) row;

    IF (v_offset + v_limit) < v_total THEN
        v_has_more := true;
    END IF;

    RETURN jsonb_build_object(
        'checklists', v_lines,
        'total_count', v_total,
        'has_more', v_has_more,
        'limit', v_limit,
        'offset', v_offset
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.warehouse_get_checklists(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.warehouse_get_checklists(JSONB) TO authenticated;

-- 5.10 Analytics Compatibility (returns JSON, preserves all master keys, no asset_loans)
CREATE OR REPLACE FUNCTION public.get_inventory_analytics()
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_build_object(
        'total_items_count', COUNT(*),
        'total_asset_value', COALESCE(SUM(CASE WHEN lower(item_type) != 'banknote' THEN current_stock * average_cost ELSE 0 END), 0),
        'low_stock_count', COUNT(*) FILTER (WHERE current_stock <= min_alert_threshold AND lower(item_type) = 'consumable'),
        'active_loans_count', (SELECT COUNT(*) FROM public.asset_units WHERE upper(status) = 'BORROWED'),
        'overdue_loans_count', (SELECT COUNT(*) FROM public.asset_units WHERE upper(status) = 'BORROWED' AND due_at IS NOT NULL AND due_at < now()),
        'total_assets', (SELECT COUNT(*) FROM public.asset_units),
        'borrowed_assets', (SELECT COUNT(*) FROM public.asset_units WHERE upper(status) = 'BORROWED'),
        'broken_assets', (SELECT COUNT(*) FROM public.asset_units WHERE upper(status) = 'BROKEN'),
        'lost_assets', (SELECT COUNT(*) FROM public.asset_units WHERE upper(status) = 'LOST'),
        'low_stock_items', COUNT(*) FILTER (WHERE current_stock <= min_alert_threshold AND lower(item_type) != 'banknote')
    ) INTO v_result
    FROM public.inventory_items
    WHERE is_active = true AND lower(item_type) != 'banknote';

    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.get_inventory_analytics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_inventory_analytics() TO authenticated;

-- ------------------------------------------------------------------------------
-- 6. INDEXES & REALTIME SUBSCRIPTION PUBLICATION
-- ------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_inventory_docs_idempotency ON public.inventory_documents(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_docs_type_status ON public.inventory_documents(doc_type, status);
CREATE INDEX IF NOT EXISTS idx_inventory_docs_project ON public.inventory_documents(project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_docs_round ON public.inventory_documents(round_id) WHERE round_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_docs_created ON public.inventory_documents(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_lines_doc ON public.inventory_document_lines(document_id);
CREATE INDEX IF NOT EXISTS idx_inventory_lines_type_active ON public.inventory_document_lines(line_type, is_active);
CREATE INDEX IF NOT EXISTS idx_inventory_lines_item ON public.inventory_document_lines(item_id) WHERE item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_lines_unit ON public.inventory_document_lines(unit_code) WHERE unit_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_lines_source_move ON public.inventory_document_lines(source_issue_movement_id) WHERE source_issue_movement_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_moves_doc ON public.inventory_movements(document_id);
CREATE INDEX IF NOT EXISTS idx_inventory_moves_item ON public.inventory_movements(item_id) WHERE item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_moves_type ON public.inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_inventory_moves_source ON public.inventory_movements(source_issue_movement_id) WHERE source_issue_movement_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_moves_cash ON public.inventory_movements(is_cash) WHERE is_cash = true;

CREATE INDEX IF NOT EXISTS idx_asset_units_custody_line ON public.asset_units(active_custody_line_id) WHERE active_custody_line_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asset_units_status ON public.asset_units(status);

-- REPLICA IDENTITY DEFAULT on inventory_documents to save uncacheable egress
ALTER TABLE public.inventory_documents REPLICA IDENTITY DEFAULT;

-- Register inventory_documents into existing supabase_realtime publication only if exists and not member
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' 
              AND schemaname = 'public' 
              AND tablename = 'inventory_documents'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_documents;
        END IF;
    ELSE
        RAISE NOTICE 'supabase_realtime publication does not exist; skipping realtime publication registration in local environment';
    END IF;
END $$;

-- ==============================================================================
-- COMPACT INVENTORY RUNTIME: PRODUCTION & PEOPLE MODULE
-- File: database_scripts/drafts/compact_production.sql.part
--
-- Pure module piece: No BEGIN/COMMIT (assembled into single transaction).
-- Unified storage: inventory_documents, inventory_document_lines, inventory_movements.
-- Preserves existing public RPC signatures with exact parameter & return contracts.
-- ==============================================================================

-- 0. FAIL-CLOSED BUILD GUARD
DO $$
BEGIN
    IF coalesce(current_setting('flower.compact_build', true), '') <> 'v2' THEN
        RAISE EXCEPTION 'compact_production.sql.part must be executed within inventory_compact installer (flower.compact_build=v2 required)';
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 1. PEOPLE REGISTRY RPCs (PII-FREE LISTING & CANONICAL RESOLUTION)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.warehouse_list_people(
    p_query TEXT DEFAULT '',
    p_limit INT DEFAULT 20
)
RETURNS JSONB AS $$
DECLARE
    v_clean_limit INT;
    v_q TEXT;
    v_people JSONB;
BEGIN
    IF NOT (public.fn_can_access_inventory(auth.uid()) OR public.fn_can_manage_cash(auth.uid())) THEN
        RAISE EXCEPTION 'Unauthorized to list warehouse people';
    END IF;
    v_clean_limit := LEAST(GREATEST(coalesce(p_limit, 20), 1), 50);
    v_q := trim(coalesce(p_query, ''));

    SELECT coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) INTO v_people
    FROM (
        -- 1. Active staff users (without PII, bridging TEXT/UUID IDs)
        SELECT 
            'staff:' || su.id::text AS key,
            r.id AS recipient_id,
            su.id::text AS staff_user_id,
            coalesce(su.full_name, su.username) AS name,
            'staff' AS kind,
            su.id::text AS code,
            coalesce(su.full_name, su.username) AS primary_receiver_name,
            coalesce(r.member_names, ARRAY[]::text[]) AS member_names
        FROM public.staff_users su
        LEFT JOIN public.inventory_recipients r ON r.staff_user_id = su.id::text
        WHERE su.is_active = TRUE
          AND (
            v_q = '' 
            OR su.full_name ILIKE ('%' || v_q || '%')
            OR su.username ILIKE ('%' || v_q || '%')
            OR su.id::text ILIKE ('%' || v_q || '%')
          )

        UNION ALL

        -- 2. Active casual helpers & teams (stored directly in inventory_recipients)
        SELECT 
            'recipient:' || r.id::text AS key,
            r.id AS recipient_id,
            NULL AS staff_user_id,
            r.name AS name,
            r.recipient_type AS kind,
            substring(r.id::text, 1, 8) AS code,
            coalesce(r.primary_receiver_name, r.name) AS primary_receiver_name,
            coalesce(r.member_names, ARRAY[]::text[]) AS member_names
        FROM public.inventory_recipients r
        WHERE r.is_active = TRUE
          AND r.staff_user_id IS NULL
          AND r.recipient_type <> 'staff'
          AND (
            v_q = '' 
            OR r.name ILIKE ('%' || v_q || '%')
            OR coalesce(r.primary_receiver_name, '') ILIKE ('%' || v_q || '%')
          )
        ORDER BY name ASC
        LIMIT v_clean_limit
    ) p;

    RETURN v_people;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.warehouse_resolve_person(
    p_person_key TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_auth_uid UUID;
    v_ident TEXT;
    v_rec_id UUID;
    v_name TEXT;
    v_kind TEXT;
    v_primary TEXT;
    v_members TEXT[];
    v_staff RECORD;
BEGIN
    v_auth_uid := auth.uid();
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required to resolve person';
    END IF;

    IF NOT (public.fn_can_access_inventory(v_auth_uid) OR public.fn_can_manage_cash(v_auth_uid)) THEN
        RAISE EXCEPTION 'Unauthorized to resolve warehouse person';
    END IF;

    IF p_person_key LIKE 'staff:%' THEN
        v_ident := substring(p_person_key FROM 7);

        SELECT id::text AS staff_id, full_name, username INTO v_staff
        FROM public.staff_users
        WHERE id::text = v_ident AND is_active = TRUE
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Active staff user not found for key: %', p_person_key;
        END IF;

        -- Bridge into inventory_recipients with stable UUID
        INSERT INTO public.inventory_recipients (name, recipient_type, staff_user_id, is_active)
        VALUES (coalesce(v_staff.full_name, v_staff.username), 'staff', v_staff.staff_id, TRUE)
        ON CONFLICT (staff_user_id) 
        DO UPDATE SET name = EXCLUDED.name, is_active = TRUE
        RETURNING id, name, recipient_type, primary_receiver_name, member_names 
        INTO v_rec_id, v_name, v_kind, v_primary, v_members;

        RETURN jsonb_build_object(
            'recipient_id', v_rec_id,
            'name', v_name,
            'recipient_type', v_kind,
            'primary_receiver_name', coalesce(v_primary, v_name),
            'member_names', coalesce(v_members, ARRAY[]::text[])
        );

    ELSIF p_person_key LIKE 'recipient:%' THEN
        BEGIN
            v_rec_id := substring(p_person_key FROM 11)::UUID;
        EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Invalid recipient UUID in key: %', p_person_key;
        END;

        SELECT id, name, recipient_type, coalesce(primary_receiver_name, name), coalesce(member_names, ARRAY[]::text[])
        INTO v_rec_id, v_name, v_kind, v_primary, v_members
        FROM public.inventory_recipients
        WHERE id = v_rec_id AND is_active = TRUE
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Active recipient not found for key: %', p_person_key;
        END IF;

        RETURN jsonb_build_object(
            'recipient_id', v_rec_id,
            'name', v_name,
            'recipient_type', v_kind,
            'primary_receiver_name', v_primary,
            'member_names', v_members
        );
    ELSE
        RAISE EXCEPTION 'Unrecognized person key format. Expected staff:<id> or recipient:<uuid>';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Alias preserving resolve_person

-- ------------------------------------------------------------------------------
-- 2. PRIVATE PRODUCTION INTEGRATION HELPERS
-- ------------------------------------------------------------------------------

-- Helper 2.1: Automatically ensure linked WORK document for PRODUCTION_ISSUE
CREATE OR REPLACE FUNCTION public.warehouse_ensure_production_work(
    p_issue_document_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_work_id UUID;
    v_issue RECORD;
    v_doc_num TEXT;
BEGIN
    IF p_issue_document_id IS NULL THEN
        RAISE EXCEPTION 'issue_document_id is strictly required';
    END IF;

    -- Return existing linked WORK document if already present
    SELECT id INTO v_work_id
    FROM public.inventory_documents
    WHERE source_document_id = p_issue_document_id
      AND doc_type = 'WORK'
    LIMIT 1;

    IF v_work_id IS NOT NULL THEN
        RETURN v_work_id;
    END IF;

    -- Lock and verify issue document
    SELECT * INTO v_issue
    FROM public.inventory_documents
    WHERE id = p_issue_document_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Issue document % not found', p_issue_document_id;
    END IF;

    IF v_issue.doc_type <> 'PRODUCTION_ISSUE' THEN
        RAISE EXCEPTION 'Document % is not PRODUCTION_ISSUE (doc_type: %)', p_issue_document_id, v_issue.doc_type;
    END IF;

    v_doc_num := 'WRK-' || substring(v_issue.id::text, 1, 8);

    -- Create WORK header in unified inventory_documents
    INSERT INTO public.inventory_documents (
        doc_number,
        doc_type,
        project_id,
        recipient_id,
        recipient_name_snapshot,
        team_members_snapshot,
        title,
        status,
        source_document_id,
        is_cash,
        version,
        actor_auth_user_id,
        actor_name_snapshot,
        due_at,
        created_at,
        updated_at
    ) VALUES (
        v_doc_num,
        'WORK',
        v_issue.project_id,
        v_issue.recipient_id,
        v_issue.recipient_name_snapshot,
        coalesce(v_issue.team_members_snapshot, '{}'),
        'งานผลิตตามใบเบิก ' || coalesce(v_issue.doc_number, ''),
        'in_progress',
        v_issue.id,
        false,
        1,
        v_issue.actor_auth_user_id,
        coalesce(v_issue.actor_name_snapshot, 'System'),
        v_issue.due_at,
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    ) RETURNING id INTO v_work_id;

    -- Default WORK deliverable line (quantity 1.00 set)
    INSERT INTO public.inventory_document_lines (
        document_id,
        line_type,
        description,
        required_qty,
        submitted_qty,
        accepted_qty,
        rejected_qty,
        pending_qty,
        unit,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        v_work_id,
        'WORK_OUTPUT',
        'งานผลิตตามใบเบิก',
        1.00,
        0.00,
        0.00,
        0.00,
        0.00,
        'ชุด',
        true,
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    );

    -- Audit work movement event
    INSERT INTO public.inventory_movements (
        document_id,
        movement_type,
        quantity,
        delta_stock,
        project_id,
        recipient_id,
        recipient_name_snapshot,
        actor_auth_user_id,
        actor_name_snapshot,
        notes,
        metadata,
        created_at
    ) VALUES (
        v_work_id,
        'WORK_EVENT',
        0,
        0,
        v_issue.project_id,
        v_issue.recipient_id,
        v_issue.recipient_name_snapshot,
        v_issue.actor_auth_user_id,
        coalesce(v_issue.actor_name_snapshot, 'System'),
        'Auto-created from issue ' || coalesce(v_issue.doc_number, ''),
        jsonb_build_object('event_type', 'created', 'source_document_id', v_issue.id),
        timezone('utc'::text, now())
    );

    RETURN v_work_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Helper 2.2: Synchronize cash batch state with linked cash WORK assignment
CREATE OR REPLACE FUNCTION public.warehouse_sync_cash_work(
    p_batch_document_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_batch RECORD;
    v_batch_line RECORD;
    v_work_doc RECORD;
    v_work_line RECORD;
    v_work_id UUID;
    v_exp_qty NUMERIC(12,2);
    v_prep_qty NUMERIC(12,2);
    v_issued_count NUMERIC(12,2);
    v_ret_raw_count NUMERIC(12,2);
    v_handed_count NUMERIC(12,2);
    v_diff NUMERIC(12,2);
    v_sub_id UUID;
    v_sub_line_id UUID;
    v_insp_id UUID;
    v_actor_name TEXT;
    v_denom INT;
    v_code TEXT;
    v_proj_id TEXT;
    v_rec_id UUID;
    v_rec_name TEXT;
    v_status TEXT;
BEGIN
    IF p_batch_document_id IS NULL THEN
        RAISE EXCEPTION 'batch_document_id is strictly required';
    END IF;

    -- Look up batch header in inventory_documents (or legacy cash_helper_batches if present)
    SELECT * INTO v_batch
    FROM public.inventory_documents
    WHERE id = p_batch_document_id;

    IF FOUND THEN
        v_code := v_batch.doc_number;
        v_proj_id := v_batch.project_id;
        v_rec_id := v_batch.recipient_id;
        v_rec_name := v_batch.recipient_name_snapshot;
        v_denom := v_batch.denomination;
        v_status := v_batch.status;

        -- Extract quantities from batch line
        SELECT * INTO v_batch_line
        FROM public.inventory_document_lines
        WHERE document_id = p_batch_document_id
          AND line_type IN ('CASH_BATCH', 'ITEM')
        LIMIT 1;

        IF FOUND THEN
            v_exp_qty := GREATEST(0, coalesce(v_batch_line.quantity, 0) - coalesce(v_batch_line.returned_qty, 0) - coalesce(v_batch_line.handed_over_qty, 0))::NUMERIC(12,2);
            v_prep_qty := coalesce(v_batch_line.accepted_qty, 0)::NUMERIC(12,2);
        ELSE
            v_exp_qty := 0;
            v_prep_qty := 0;
        END IF;
    ELSE
        -- Fallback check on legacy cash_helper_batches if table exists during transition
        BEGIN
            EXECUTE 'SELECT batch_code, project_id, recipient_id, recipient_name_snapshot, denomination, status, issued_count, returned_raw_count, handed_over_count, prepared_count FROM public.cash_helper_batches WHERE id = $1'
            INTO v_code, v_proj_id, v_rec_id, v_rec_name, v_denom, v_status, v_issued_count, v_ret_raw_count, v_handed_count, v_prep_qty
            USING p_batch_document_id;
            
            IF v_code IS NOT NULL THEN
                v_exp_qty := GREATEST(0, coalesce(v_issued_count, 0) - coalesce(v_ret_raw_count, 0) - coalesce(v_handed_count, 0))::NUMERIC(12,2);
                v_prep_qty := coalesce(v_prep_qty, 0)::NUMERIC(12,2);
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_code := NULL;
        END;

        IF v_code IS NULL THEN
            RAISE EXCEPTION 'Cash batch % not found', p_batch_document_id;
        END IF;
    END IF;

    -- Look up linked cash WORK document
    SELECT * INTO v_work_doc
    FROM public.inventory_documents
    WHERE source_document_id = p_batch_document_id
      AND doc_type = 'WORK'
      AND is_cash = TRUE
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Create new cash WORK document
        INSERT INTO public.inventory_documents (
            doc_number,
            doc_type,
            project_id,
            recipient_id,
            recipient_name_snapshot,
            title,
            status,
            source_document_id,
            is_cash,
            denomination,
            version,
            actor_auth_user_id,
            actor_name_snapshot,
            created_at,
            updated_at
        ) VALUES (
            'WRK-CASH-' || substring(p_batch_document_id::text, 1, 8),
            'WORK',
            v_proj_id,
            v_rec_id,
            v_rec_name,
            'งานเตรียมชุดเงินสด ' || coalesce(v_code, ''),
            CASE 
                WHEN v_status = 'CANCELLED' THEN 'cancelled'
                WHEN v_status = 'FULLY_PREPARED' OR (v_exp_qty > 0 AND v_prep_qty >= v_exp_qty) THEN 'completed'
                ELSE 'in_progress'
            END,
            p_batch_document_id,
            true,
            v_denom,
            1,
            auth.uid(),
            'Cash System',
            timezone('utc'::text, now()),
            timezone('utc'::text, now())
        ) RETURNING id INTO v_work_id;

        INSERT INTO public.inventory_document_lines (
            document_id,
            line_type,
            description,
            required_qty,
            accepted_qty,
            submitted_qty,
            pending_qty,
            rejected_qty,
            unit,
            denomination,
            is_active,
            created_at,
            updated_at
        ) VALUES (
            v_work_id,
            'WORK_OUTPUT',
            'ธนบัตร ' || v_denom || ' บาท',
            v_exp_qty,
            v_prep_qty,
            v_prep_qty,
            0.00,
            0.00,
            'ใบ',
            v_denom,
            true,
            timezone('utc'::text, now()),
            timezone('utc'::text, now())
        );

        INSERT INTO public.inventory_movements (
            document_id,
            movement_type,
            quantity,
            delta_stock,
            project_id,
            recipient_id,
            recipient_name_snapshot,
            actor_auth_user_id,
            actor_name_snapshot,
            is_cash,
            denomination,
            notes,
            metadata,
            created_at
        ) VALUES (
            v_work_id,
            'WORK_EVENT',
            0,
            0,
            v_proj_id,
            v_rec_id,
            v_rec_name,
            auth.uid(),
            'Cash System',
            true,
            v_denom,
            'Cash work initialized for batch ' || coalesce(v_code, ''),
            jsonb_build_object('event_type', 'created', 'source_batch_id', p_batch_document_id),
            timezone('utc'::text, now())
        );
    ELSE
        v_work_id := v_work_doc.id;

        SELECT * INTO v_work_line
        FROM public.inventory_document_lines
        WHERE document_id = v_work_id
          AND line_type = 'WORK_OUTPUT'
        FOR UPDATE
        LIMIT 1;

        -- If prepared count increased, record audit receipt (SUBMISSION + INSPECTION)
        IF v_prep_qty > coalesce(v_work_line.accepted_qty, 0) THEN
            v_diff := v_prep_qty - coalesce(v_work_line.accepted_qty, 0);

            SELECT coalesce(full_name, username) INTO v_actor_name
            FROM public.staff_users
            WHERE auth_user_id = auth.uid()
            LIMIT 1;

            -- SUBMISSION header
            INSERT INTO public.inventory_documents (
                doc_number,
                doc_type,
                project_id,
                parent_document_id,
                recipient_id,
                recipient_name_snapshot,
                status,
                notes,
                actor_auth_user_id,
                actor_name_snapshot,
                is_cash,
                denomination,
                created_at,
                updated_at
            ) VALUES (
                'SUB-CASH-' || substring(gen_random_uuid()::text, 1, 8),
                'SUBMISSION',
                v_work_doc.project_id,
                v_work_id,
                v_work_doc.recipient_id,
                v_work_doc.recipient_name_snapshot,
                'inspected',
                'Prepared banknotes verified from cash vault flow',
                auth.uid(),
                coalesce(v_actor_name, v_work_doc.recipient_name_snapshot),
                true,
                v_denom,
                timezone('utc'::text, now()),
                timezone('utc'::text, now())
            ) RETURNING id INTO v_sub_id;

            -- SUBMISSION line
            INSERT INTO public.inventory_document_lines (
                document_id,
                line_type,
                source_line_id,
                quantity,
                accepted_qty,
                rejected_qty,
                pending_qty,
                unit,
                denomination,
                created_at,
                updated_at
            ) VALUES (
                v_sub_id,
                'SUBMISSION',
                v_work_line.id,
                v_diff,
                v_diff,
                0,
                0,
                'ใบ',
                v_denom,
                timezone('utc'::text, now()),
                timezone('utc'::text, now())
            ) RETURNING id INTO v_sub_line_id;

            -- INSPECTION header
            INSERT INTO public.inventory_documents (
                doc_number,
                doc_type,
                project_id,
                parent_document_id,
                source_document_id,
                status,
                notes,
                actor_auth_user_id,
                actor_name_snapshot,
                is_cash,
                denomination,
                created_at,
                updated_at
            ) VALUES (
                'INS-CASH-' || substring(gen_random_uuid()::text, 1, 8),
                'INSPECTION',
                v_work_doc.project_id,
                v_sub_id,
                v_work_id,
                'completed',
                'Received prepared set into cash vault',
                auth.uid(),
                coalesce(v_actor_name, 'Cashier'),
                true,
                v_denom,
                timezone('utc'::text, now()),
                timezone('utc'::text, now())
            ) RETURNING id INTO v_insp_id;

            -- INSPECTION line
            INSERT INTO public.inventory_document_lines (
                document_id,
                line_type,
                source_line_id,
                accepted_qty,
                rejected_qty,
                notes,
                unit,
                denomination,
                created_at,
                updated_at
            ) VALUES (
                v_insp_id,
                'INSPECTION',
                v_sub_line_id,
                v_diff,
                0,
                'Verified by cash receive transaction',
                'ใบ',
                v_denom,
                timezone('utc'::text, now()),
                timezone('utc'::text, now())
            );
        END IF;

        -- Update WORK line counts
        IF v_work_line.id IS NOT NULL THEN
            UPDATE public.inventory_document_lines
            SET required_qty = v_exp_qty,
                accepted_qty = v_prep_qty,
                submitted_qty = GREATEST(submitted_qty, v_prep_qty),
                updated_at = timezone('utc'::text, now())
            WHERE id = v_work_line.id;
        END IF;

        -- Update WORK header status & version
        UPDATE public.inventory_documents
        SET recipient_id = v_rec_id,
            recipient_name_snapshot = v_rec_name,
            status = CASE 
                WHEN v_status = 'CANCELLED' THEN 'cancelled'
                WHEN v_status = 'FULLY_PREPARED' OR (v_exp_qty > 0 AND v_prep_qty >= v_exp_qty) THEN 'completed'
                ELSE 'in_progress'
            END,
            version = version + 1,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_work_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ------------------------------------------------------------------------------
-- 3. UNIFIED PRODUCTION ISSUE + WORK RPC (warehouse_create_production_issue)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.warehouse_create_production_issue(
    p_issue JSONB,
    p_work JSONB,
    p_idempotency_key UUID
)
RETURNS JSONB AS $$
DECLARE
    v_auth_uid UUID;
    v_payload_hash TEXT;
    v_cached JSONB;
    v_core_issue JSONB;
    v_core_result JSONB;
    v_doc_id UUID;
    v_work_id UUID;
    v_work_lines JSONB;
    v_elem JSONB;
    v_line_desc TEXT;
    v_line_qty NUMERIC(12,2);
    v_line_unit TEXT;
    v_due_at TIMESTAMPTZ;
    v_assign_doc RECORD;
    v_result JSONB;
BEGIN
    IF p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'Idempotency key (UUID) strictly required';
    END IF;

    -- Historical production issue payload hash format
    v_payload_hash := md5('production_issue_create:' || p_issue::text || ':' || coalesce(p_work::text, '{}'));

    -- Check cached idempotent response via core command helper
    v_cached := public.warehouse_command_lookup('production_issue_create', v_payload_hash, p_idempotency_key, false);
    IF v_cached IS NOT NULL THEN
        RETURN v_cached;
    END IF;

    v_auth_uid := auth.uid();
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF NOT public.fn_can_access_inventory(v_auth_uid) THEN
        RAISE EXCEPTION 'Unauthorized to create production issue';
    END IF;

    IF (p_issue->>'issue_type') <> 'PRODUCTION_ISSUE' THEN
        RAISE EXCEPTION 'issue_type must be PRODUCTION_ISSUE';
    END IF;

    -- Validate work lines upfront so any invalid line rolls back before dispatch
    IF p_work IS NOT NULL AND p_work ? 'lines' THEN
        v_work_lines := p_work->'lines';
        FOR v_elem IN SELECT * FROM jsonb_array_elements(v_work_lines) LOOP
            v_line_qty := (v_elem->>'required_qty')::NUMERIC(12,2);
            IF v_line_qty IS NULL OR v_line_qty < 0 THEN
                RAISE EXCEPTION 'Invalid work output quantity: %', v_elem->>'required_qty';
            END IF;
            IF trim(coalesce(v_elem->>'description', '')) = '' THEN
                RAISE EXCEPTION 'Work output description cannot be empty';
            END IF;
        END LOOP;
    END IF;

    -- Call core dispatcher for issue_create inside SAME transaction
    v_core_issue := p_issue || jsonb_build_object('_production_work_hash', v_payload_hash);
    v_core_result := public.warehouse_dispatch('issue_create', v_core_issue, p_idempotency_key);

    IF NOT coalesce((v_core_result->>'success')::BOOLEAN, false) THEN
        RETURN v_core_result;
    END IF;

    v_doc_id := coalesce((v_core_result->'data'->>'document_id')::UUID, (v_core_result->'data'->>'id')::UUID);

    -- Find or ensure the linked WORK document created by core issue trigger/helper
    SELECT id INTO v_work_id
    FROM public.inventory_documents
    WHERE source_document_id = v_doc_id AND doc_type = 'WORK'
    FOR UPDATE;

    IF v_work_id IS NULL THEN
        v_work_id := public.warehouse_ensure_production_work(v_doc_id);
    END IF;

    -- Apply customized work title, due date, and output lines
    IF p_work IS NOT NULL THEN
        IF p_work ? 'due_at' AND p_work->>'due_at' IS NOT NULL THEN
            v_due_at := (p_work->>'due_at')::TIMESTAMPTZ;
        ELSIF p_work ? 'dueAt' AND p_work->>'dueAt' IS NOT NULL THEN
            v_due_at := (p_work->>'dueAt')::TIMESTAMPTZ;
        END IF;

        IF p_work ? 'title' AND trim(coalesce(p_work->>'title', '')) <> '' THEN
            UPDATE public.inventory_documents
            SET title = p_work->>'title',
                due_at = coalesce(v_due_at, due_at),
                updated_at = timezone('utc'::text, now())
            WHERE id = v_work_id;
        ELSIF v_due_at IS NOT NULL THEN
            UPDATE public.inventory_documents
            SET due_at = v_due_at,
                updated_at = timezone('utc'::text, now())
            WHERE id = v_work_id;
        END IF;

        IF p_work ? 'lines' AND jsonb_array_length(v_work_lines) > 0 THEN
            -- Replace default line with custom deliverables
            DELETE FROM public.inventory_document_lines 
            WHERE document_id = v_work_id AND line_type = 'WORK_OUTPUT';

            FOR v_elem IN SELECT * FROM jsonb_array_elements(v_work_lines) LOOP
                v_line_desc := v_elem->>'description';
                v_line_qty := (v_elem->>'required_qty')::NUMERIC(12,2);
                v_line_unit := coalesce(v_elem->>'unit', 'ชุด');

                INSERT INTO public.inventory_document_lines (
                    document_id,
                    line_type,
                    description,
                    required_qty,
                    unit,
                    is_active,
                    submitted_qty,
                    accepted_qty,
                    rejected_qty,
                    pending_qty,
                    created_at,
                    updated_at
                ) VALUES (
                    v_work_id,
                    'WORK_OUTPUT',
                    v_line_desc,
                    v_line_qty,
                    v_line_unit,
                    true,
                    0.00,
                    0.00,
                    0.00,
                    0.00,
                    timezone('utc'::text, now()),
                    timezone('utc'::text, now())
                );
            END LOOP;
        END IF;
    END IF;

    -- Build return assignment representation
    SELECT * INTO v_assign_doc FROM public.inventory_documents WHERE id = v_work_id;

    v_result := jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'issue', v_core_result->'data',
            'assignment', jsonb_build_object(
                'id', v_assign_doc.id,
                'project_id', v_assign_doc.project_id,
                'title', v_assign_doc.title,
                'status', v_assign_doc.status,
                'version', v_assign_doc.version,
                'recipient_id', v_assign_doc.recipient_id,
                'responsible_name', v_assign_doc.recipient_name_snapshot,
                'team_members_snapshot', v_assign_doc.team_members_snapshot,
                'due_at', v_assign_doc.due_at,
                'source_document_id', v_assign_doc.source_document_id,
                'lines', (
                    SELECT coalesce(jsonb_agg(jsonb_build_object(
                        'id', id,
                        'description', description,
                        'required_qty', required_qty,
                        'unit', unit,
                        'submitted_qty', submitted_qty,
                        'accepted_qty', accepted_qty,
                        'rejected_qty', rejected_qty,
                        'pending_qty', pending_qty
                    )), '[]'::jsonb)
                    FROM public.inventory_document_lines
                    WHERE document_id = v_work_id AND line_type = 'WORK_OUTPUT'
                )
            )
        )
    );

    -- Atomically override SAME request key on issue doc with unified wrapper result
    UPDATE public.inventory_documents
    SET action_name = 'production_issue_create',
        idempotency_payload_hash = v_payload_hash,
        response_payload = v_result,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_doc_id;

    -- Register with core command finish helper
    PERFORM public.warehouse_command_finish('production_issue_create', v_payload_hash, p_idempotency_key, v_result, v_doc_id, false);

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Alias preserving create_production_issue

-- ------------------------------------------------------------------------------
-- 4. PRODUCTION ASSIGNMENT LIFECYCLE RPCs
-- ------------------------------------------------------------------------------

-- 4.1 Create Standalone Assignment
CREATE OR REPLACE FUNCTION public.warehouse_create_assignment(
    p_payload JSONB,
    p_idempotency_key UUID
)
RETURNS JSONB AS $$
DECLARE
    v_auth_uid UUID;
    v_actor_name TEXT;
    v_payload_hash TEXT;
    v_cached JSONB;
    v_project_id TEXT;
    v_title TEXT;
    v_rec_id UUID;
    v_rec_name TEXT;
    v_due_at TIMESTAMPTZ;
    v_work_id UUID;
    v_doc_num TEXT;
    v_elem JSONB;
    v_lines JSONB;
    v_line_qty NUMERIC(12,2);
    v_result JSONB;
    v_person_key TEXT;
    v_resolved JSONB;
BEGIN
    IF p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'Idempotency key (UUID) strictly required';
    END IF;

    v_payload_hash := md5('assignment_create:' || p_payload::text);

    v_cached := public.warehouse_command_lookup('assignment_create', v_payload_hash, p_idempotency_key, false);
    IF v_cached IS NOT NULL THEN
        RETURN v_cached;
    END IF;

    v_auth_uid := auth.uid();
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT coalesce(full_name, username) INTO v_actor_name
    FROM public.staff_users
    WHERE auth_user_id = v_auth_uid AND is_active = TRUE
    LIMIT 1;

    IF v_actor_name IS NULL THEN
        RAISE EXCEPTION 'Active staff mapping not found';
    END IF;

    IF NOT public.fn_can_access_inventory(v_auth_uid) THEN
        RAISE EXCEPTION 'Unauthorized to create assignment';
    END IF;

    v_project_id := p_payload->>'project_id';
    IF v_project_id IS NULL OR trim(v_project_id) = '' THEN
        RAISE EXCEPTION 'project_id is required';
    END IF;

    v_title := trim(coalesce(p_payload->>'title', ''));
    IF v_title = '' THEN
        RAISE EXCEPTION 'Title is required';
    END IF;

    IF p_payload ? 'person_key' AND trim(coalesce(p_payload->>'person_key', '')) <> '' THEN
        v_person_key := p_payload->>'person_key';
        v_resolved := public.warehouse_resolve_person(v_person_key);
        v_rec_id := (v_resolved->>'recipient_id')::UUID;
        v_rec_name := v_resolved->>'name';
    ELSE
        IF p_payload ? 'recipient_id' AND p_payload->>'recipient_id' IS NOT NULL THEN
            v_rec_id := (p_payload->>'recipient_id')::UUID;
        END IF;
        v_rec_name := coalesce(p_payload->>'recipient_name', 'General Helper');
    END IF;

    IF p_payload ? 'due_at' AND p_payload->>'due_at' IS NOT NULL THEN
        v_due_at := (p_payload->>'due_at')::TIMESTAMPTZ;
    END IF;

    v_doc_num := 'WRK-' || substring(gen_random_uuid()::text, 1, 8);

    -- Create WORK document header
    INSERT INTO public.inventory_documents (
        doc_number,
        doc_type,
        project_id,
        recipient_id,
        recipient_name_snapshot,
        title,
        due_at,
        status,
        is_cash,
        version,
        actor_auth_user_id,
        actor_name_snapshot,
        action_name,
        idempotency_key,
        idempotency_payload_hash,
        created_at,
        updated_at
    ) VALUES (
        v_doc_num,
        'WORK',
        v_project_id,
        v_rec_id,
        v_rec_name,
        v_title,
        v_due_at,
        'in_progress',
        false,
        1,
        v_auth_uid,
        v_actor_name,
        'assignment_create',
        p_idempotency_key,
        v_payload_hash,
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    ) RETURNING id INTO v_work_id;

    -- Create output lines
    v_lines := coalesce(p_payload->'lines', '[]'::jsonb);
    IF jsonb_array_length(v_lines) = 0 THEN
        INSERT INTO public.inventory_document_lines (
            document_id, line_type, description, required_qty, unit, is_active,
            submitted_qty, accepted_qty, rejected_qty, pending_qty, created_at, updated_at
        ) VALUES (
            v_work_id, 'WORK_OUTPUT', 'งานผลิตตามมอบหมาย', 1.00, 'ชุด', true,
            0.00, 0.00, 0.00, 0.00, timezone('utc'::text, now()), timezone('utc'::text, now())
        );
    ELSE
        FOR v_elem IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
            v_line_qty := (v_elem->>'required_qty')::NUMERIC(12,2);
            IF v_line_qty IS NULL OR v_line_qty < 0 THEN
                RAISE EXCEPTION 'Line required quantity must be non-negative';
            END IF;
            INSERT INTO public.inventory_document_lines (
                document_id, line_type, description, required_qty, unit, is_active,
                submitted_qty, accepted_qty, rejected_qty, pending_qty, created_at, updated_at
            ) VALUES (
                v_work_id,
                'WORK_OUTPUT',
                coalesce(v_elem->>'description', 'งานผลิต'),
                v_line_qty,
                coalesce(v_elem->>'unit', 'ชุด'),
                true,
                0.00, 0.00, 0.00, 0.00,
                timezone('utc'::text, now()), timezone('utc'::text, now())
            );
        END LOOP;
    END IF;

    -- Audit movement event
    INSERT INTO public.inventory_movements (
        document_id, movement_type, quantity, delta_stock, project_id,
        recipient_id, recipient_name_snapshot, actor_auth_user_id, actor_name_snapshot,
        notes, metadata, created_at
    ) VALUES (
        v_work_id, 'WORK_EVENT', 0, 0, v_project_id,
        v_rec_id, v_rec_name, v_auth_uid, v_actor_name,
        'Created assignment ' || v_title,
        jsonb_build_object('event_type', 'created', 'details', p_payload),
        timezone('utc'::text, now())
    );

    v_result := jsonb_build_object(
        'success', true,
        'data', jsonb_build_object('id', v_work_id, 'project_id', v_project_id, 'title', v_title)
    );

    UPDATE public.inventory_documents
    SET response_payload = v_result
    WHERE id = v_work_id;

    PERFORM public.warehouse_command_finish('assignment_create', v_payload_hash, p_idempotency_key, v_result, v_work_id, false);

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Alias preserving create_assignment

-- 4.2 Update Assignment (Title, Due Date, or Remaining Quantities)
CREATE OR REPLACE FUNCTION public.warehouse_update_assignment(
    p_payload JSONB,
    p_idempotency_key UUID
)
RETURNS JSONB AS $$
DECLARE
    v_auth_uid UUID;
    v_actor_name TEXT;
    v_payload_hash TEXT;
    v_cached JSONB;
    v_assign_id UUID;
    v_expected_ver INT;
    v_assign RECORD;
    v_elem JSONB;
    v_line_id UUID;
    v_new_qty NUMERIC(12,2);
    v_existing_line RECORD;
    v_seen_line_ids UUID[] := '{}';
    v_result JSONB;
BEGIN
    IF p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'Idempotency key (UUID) strictly required';
    END IF;

    v_payload_hash := md5('assignment_update:' || p_payload::text);

    v_cached := public.warehouse_command_lookup('assignment_update', v_payload_hash, p_idempotency_key, false);
    IF v_cached IS NOT NULL THEN
        RETURN v_cached;
    END IF;

    v_auth_uid := auth.uid();
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT coalesce(full_name, username) INTO v_actor_name
    FROM public.staff_users
    WHERE auth_user_id = v_auth_uid AND is_active = TRUE
    LIMIT 1;

    IF v_actor_name IS NULL THEN
        RAISE EXCEPTION 'Active staff mapping not found';
    END IF;

    IF NOT public.fn_can_access_inventory(v_auth_uid) THEN
        RAISE EXCEPTION 'Unauthorized: Inventory access required to update assignment';
    END IF;

    v_assign_id := (p_payload->>'assignment_id')::UUID;
    v_expected_ver := (p_payload->>'expected_version')::INT;

    IF v_expected_ver IS NULL OR v_expected_ver < 1 THEN
        RAISE EXCEPTION 'expected_version must be a positive integer';
    END IF;

    -- Lock parent WORK document
    SELECT * INTO v_assign
    FROM public.inventory_documents
    WHERE id = v_assign_id AND doc_type = 'WORK'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assignment % not found', v_assign_id;
    END IF;

    IF v_assign.version <> v_expected_ver THEN
        RAISE EXCEPTION 'Version conflict: Expected version % but found % (stale overwrite rejected)', v_expected_ver, v_assign.version;
    END IF;

    IF v_assign.is_cash THEN
        IF NOT public.fn_can_manage_cash(v_auth_uid) THEN
            RAISE EXCEPTION 'Unauthorized: Cash management permissions required for cash assignment';
        END IF;
        RAISE EXCEPTION 'Generic edit of cash assignment lines is prohibited; canonical cash batch counts govern lines';
    END IF;

    IF p_payload ? 'title' AND trim(coalesce(p_payload->>'title', '')) <> '' THEN
        UPDATE public.inventory_documents SET title = p_payload->>'title' WHERE id = v_assign_id;
    END IF;
    IF p_payload ? 'due_at' THEN
        UPDATE public.inventory_documents SET due_at = (p_payload->>'due_at')::TIMESTAMPTZ WHERE id = v_assign_id;
    END IF;

    -- Update or add lines
    IF p_payload ? 'lines' THEN
        FOR v_elem IN SELECT * FROM jsonb_array_elements(p_payload->'lines') LOOP
            v_new_qty := (v_elem->>'required_qty')::NUMERIC(12,2);
            IF v_new_qty IS NULL OR v_new_qty < 0 THEN
                RAISE EXCEPTION 'Required quantity must be a non-negative number';
            END IF;

            IF v_elem ? 'id' AND v_elem->>'id' IS NOT NULL THEN
                v_line_id := (v_elem->>'id')::UUID;

                IF v_line_id = ANY(v_seen_line_ids) THEN
                    RAISE EXCEPTION 'Duplicate line ID % in update payload', v_line_id;
                END IF;
                v_seen_line_ids := array_append(v_seen_line_ids, v_line_id);

                -- Foreign line ID rejection check
                SELECT * INTO v_existing_line 
                FROM public.inventory_document_lines 
                WHERE id = v_line_id AND document_id = v_assign_id AND line_type = 'WORK_OUTPUT'
                FOR UPDATE;

                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Line % not found in assignment %', v_line_id, v_assign_id;
                END IF;

                IF v_new_qty < (v_existing_line.accepted_qty + v_existing_line.pending_qty) THEN
                    RAISE EXCEPTION 'Cannot reduce required quantity below accepted (%) + pending (%) for line %',
                        v_existing_line.accepted_qty, v_existing_line.pending_qty, v_line_id;
                END IF;

                -- History meaning preservation: prevent changing description or unit if outputs were already accepted
                IF v_existing_line.accepted_qty > 0 THEN
                    IF v_elem ? 'description' AND (v_elem->>'description') IS DISTINCT FROM v_existing_line.description THEN
                        RAISE EXCEPTION 'Cannot change description of line % because outputs have already been accepted (% accepted). Add a new output line instead',
                            v_line_id, v_existing_line.accepted_qty;
                    END IF;
                    IF v_elem ? 'unit' AND (v_elem->>'unit') IS DISTINCT FROM v_existing_line.unit THEN
                        RAISE EXCEPTION 'Cannot change unit of line % because outputs have already been accepted (% accepted). Add a new output line instead',
                            v_line_id, v_existing_line.accepted_qty;
                    END IF;
                END IF;

                UPDATE public.inventory_document_lines
                SET description = coalesce(v_elem->>'description', description),
                    required_qty = v_new_qty,
                    unit = coalesce(v_elem->>'unit', unit),
                    updated_at = timezone('utc'::text, now())
                WHERE id = v_line_id;
            ELSE
                -- New output line
                INSERT INTO public.inventory_document_lines (
                    document_id, line_type, description, required_qty, unit, is_active,
                    submitted_qty, accepted_qty, rejected_qty, pending_qty, created_at, updated_at
                ) VALUES (
                    v_assign_id,
                    'WORK_OUTPUT',
                    coalesce(v_elem->>'description', 'งานผลิตเพิ่มเติม'),
                    v_new_qty,
                    coalesce(v_elem->>'unit', 'ชุด'),
                    true,
                    0.00, 0.00, 0.00, 0.00,
                    timezone('utc'::text, now()), timezone('utc'::text, now())
                );
            END IF;
        END LOOP;
    END IF;

    -- Increment parent WORK version for realtime
    UPDATE public.inventory_documents
    SET version = version + 1,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_assign_id;

    INSERT INTO public.inventory_movements (
        document_id, movement_type, quantity, delta_stock, project_id,
        recipient_id, recipient_name_snapshot, actor_auth_user_id, actor_name_snapshot,
        notes, metadata, created_at
    ) VALUES (
        v_assign_id, 'WORK_EVENT', 0, 0, v_assign.project_id,
        v_assign.recipient_id, v_assign.recipient_name_snapshot, v_auth_uid, v_actor_name,
        p_payload->>'reason',
        jsonb_build_object('event_type', 'edited', 'reason', p_payload->>'reason', 'details', p_payload),
        timezone('utc'::text, now())
    );

    v_result := jsonb_build_object('success', true, 'data', jsonb_build_object('id', v_assign_id, 'version', v_assign.version + 1));

    PERFORM public.warehouse_command_finish('assignment_update', v_payload_hash, p_idempotency_key, v_result, v_assign_id, false);

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Alias preserving update_assignment

-- 4.3 Split Assignment (Remaining Work to Another Person)
CREATE OR REPLACE FUNCTION public.warehouse_split_assignment(
    p_payload JSONB,
    p_idempotency_key UUID
)
RETURNS JSONB AS $$
DECLARE
    v_auth_uid UUID;
    v_actor_name TEXT;
    v_payload_hash TEXT;
    v_cached JSONB;
    v_assign_id UUID;
    v_expected_ver INT;
    v_assign RECORD;
    v_to_person_key TEXT;
    v_resolved JSONB;
    v_target_rec_id UUID;
    v_target_rec_name TEXT;
    v_child_id UUID;
    v_elem JSONB;
    v_line_id UUID;
    v_split_qty NUMERIC(12,2);
    v_line RECORD;
    v_avail_unsubmitted NUMERIC(12,2);
    v_result JSONB;
BEGIN
    IF p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'Idempotency key (UUID) strictly required';
    END IF;

    v_payload_hash := md5('assignment_split:' || p_payload::text);

    v_cached := public.warehouse_command_lookup('assignment_split', v_payload_hash, p_idempotency_key, false);
    IF v_cached IS NOT NULL THEN
        RETURN v_cached;
    END IF;

    v_auth_uid := auth.uid();
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT coalesce(full_name, username) INTO v_actor_name
    FROM public.staff_users
    WHERE auth_user_id = v_auth_uid AND is_active = TRUE
    LIMIT 1;

    IF v_actor_name IS NULL THEN
        RAISE EXCEPTION 'Active staff mapping not found';
    END IF;

    IF NOT public.fn_can_access_inventory(v_auth_uid) THEN
        RAISE EXCEPTION 'Unauthorized: Inventory access required to split assignment';
    END IF;

    v_assign_id := (p_payload->>'assignment_id')::UUID;
    v_expected_ver := (p_payload->>'expected_version')::INT;

    IF v_expected_ver IS NULL OR v_expected_ver < 1 THEN
        RAISE EXCEPTION 'expected_version must be a positive integer';
    END IF;

    v_to_person_key := p_payload->>'to_person_key';
    IF v_to_person_key IS NULL THEN
        RAISE EXCEPTION 'to_person_key is required for split';
    END IF;

    v_resolved := public.warehouse_resolve_person(v_to_person_key);
    v_target_rec_id := (v_resolved->>'recipient_id')::UUID;
    v_target_rec_name := v_resolved->>'name';

    -- Lock parent WORK document
    SELECT * INTO v_assign
    FROM public.inventory_documents
    WHERE id = v_assign_id AND doc_type = 'WORK'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assignment % not found', v_assign_id;
    END IF;

    IF v_assign.version <> v_expected_ver THEN
        RAISE EXCEPTION 'Version conflict: Expected version % but found % (stale overwrite rejected)', v_expected_ver, v_assign.version;
    END IF;

    IF v_assign.is_cash THEN
        IF NOT public.fn_can_manage_cash(v_auth_uid) THEN
            RAISE EXCEPTION 'Unauthorized: Cash management permissions required for cash assignment';
        END IF;
        RAISE EXCEPTION 'Cannot split cash assignment directly; use core cash handover';
    END IF;

    -- Create child WORK document
    INSERT INTO public.inventory_documents (
        doc_number,
        doc_type,
        parent_document_id,
        project_id,
        recipient_id,
        recipient_name_snapshot,
        title,
        due_at,
        status,
        is_cash,
        version,
        actor_auth_user_id,
        actor_name_snapshot,
        created_at,
        updated_at
    ) VALUES (
        'WRK-' || substring(gen_random_uuid()::text, 1, 8),
        'WORK',
        v_assign.id,
        v_assign.project_id,
        v_target_rec_id,
        v_target_rec_name,
        coalesce(p_payload->>'title', 'งานแบ่งจาก ' || v_assign.recipient_name_snapshot),
        v_assign.due_at,
        'in_progress',
        false,
        1,
        v_auth_uid,
        v_actor_name,
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    ) RETURNING id INTO v_child_id;

    -- Deduct unsubmitted remaining work from parent and add to child
    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_payload->'line_quantities') LOOP
        v_line_id := (v_elem->>'line_id')::UUID;
        v_split_qty := (v_elem->>'quantity')::NUMERIC(12,2);

        IF v_split_qty <= 0 THEN
            RAISE EXCEPTION 'Split quantity must be strictly greater than 0';
        END IF;

        -- Lock parent line
        SELECT * INTO v_line
        FROM public.inventory_document_lines
        WHERE id = v_line_id AND document_id = v_assign_id AND line_type = 'WORK_OUTPUT'
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Line % not found in assignment %', v_line_id, v_assign_id;
        END IF;

        v_avail_unsubmitted := v_line.required_qty - v_line.accepted_qty - v_line.pending_qty;
        IF v_split_qty > v_avail_unsubmitted THEN
            RAISE EXCEPTION 'Cannot split % units from line %; only % unsubmitted units available',
                v_split_qty, v_line_id, v_avail_unsubmitted;
        END IF;

        -- Deduct from parent
        UPDATE public.inventory_document_lines
        SET required_qty = required_qty - v_split_qty,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_line_id;

        -- Add to child
        INSERT INTO public.inventory_document_lines (
            document_id, line_type, description, required_qty, unit, is_active,
            submitted_qty, accepted_qty, rejected_qty, pending_qty, created_at, updated_at
        ) VALUES (
            v_child_id, 'WORK_OUTPUT', v_line.description, v_split_qty, v_line.unit, true,
            0.00, 0.00, 0.00, 0.00, timezone('utc'::text, now()), timezone('utc'::text, now())
        );
    END LOOP;

    -- Increment parent WORK version for realtime
    UPDATE public.inventory_documents
    SET version = version + 1,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_assign_id;

    INSERT INTO public.inventory_movements (
        document_id, movement_type, quantity, delta_stock, project_id,
        recipient_id, recipient_name_snapshot, actor_auth_user_id, actor_name_snapshot,
        notes, metadata, created_at
    ) VALUES (
        v_assign_id, 'WORK_EVENT', 0, 0, v_assign.project_id,
        v_assign.recipient_id, v_assign.recipient_name_snapshot, v_auth_uid, v_actor_name,
        p_payload->>'reason',
        jsonb_build_object('event_type', 'split', 'child_assignment_id', v_child_id, 'to_person', v_target_rec_name),
        timezone('utc'::text, now())
    );

    v_result := jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'parent_assignment_id', v_assign_id,
            'child_assignment', jsonb_build_object('id', v_child_id, 'recipient_name', v_target_rec_name)
        )
    );

    PERFORM public.warehouse_command_finish('assignment_split', v_payload_hash, p_idempotency_key, v_result, v_assign_id, false);

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Alias preserving split_assignment

-- 4.4 Submit Work for Inspection
CREATE OR REPLACE FUNCTION public.warehouse_submit_work(
    p_payload JSONB,
    p_idempotency_key UUID
)
RETURNS JSONB AS $$
DECLARE
    v_auth_uid UUID;
    v_actor_name TEXT;
    v_payload_hash TEXT;
    v_cached JSONB;
    v_assign_id UUID;
    v_assign RECORD;
    v_sub_id UUID;
    v_elem JSONB;
    v_line_id UUID;
    v_sub_qty NUMERIC(12,2);
    v_line RECORD;
    v_result JSONB;
BEGIN
    IF p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'Idempotency key (UUID) strictly required';
    END IF;

    v_payload_hash := md5('work_submit:' || p_payload::text);

    v_cached := public.warehouse_command_lookup('work_submit', v_payload_hash, p_idempotency_key, false);
    IF v_cached IS NOT NULL THEN
        RETURN v_cached;
    END IF;

    v_auth_uid := auth.uid();
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT coalesce(full_name, username) INTO v_actor_name
    FROM public.staff_users
    WHERE auth_user_id = v_auth_uid AND is_active = TRUE
    LIMIT 1;

    IF v_actor_name IS NULL THEN
        RAISE EXCEPTION 'Active staff mapping not found';
    END IF;

    IF NOT (public.fn_can_access_inventory(v_auth_uid) OR public.fn_can_manage_cash(v_auth_uid)) THEN
        RAISE EXCEPTION 'Unauthorized: Inventory access required to submit work';
    END IF;

    v_assign_id := (p_payload->>'assignment_id')::UUID;

    -- Lock parent WORK document
    SELECT * INTO v_assign
    FROM public.inventory_documents
    WHERE id = v_assign_id AND doc_type = 'WORK'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assignment % not found', v_assign_id;
    END IF;

    IF v_assign.is_cash THEN
        RAISE EXCEPTION 'Generic submit on cash assignment is prohibited; prepared banknotes flow through cash ledger';
    END IF;

    IF v_assign.status IN ('completed', 'cancelled') THEN
        RAISE EXCEPTION 'Cannot submit work for assignment in % status', v_assign.status;
    END IF;

    -- Create SUBMISSION document header
    INSERT INTO public.inventory_documents (
        doc_number,
        doc_type,
        parent_document_id,
        project_id,
        recipient_id,
        recipient_name_snapshot,
        status,
        notes,
        actor_auth_user_id,
        actor_name_snapshot,
        is_cash,
        created_at,
        updated_at
    ) VALUES (
        'SUB-' || substring(gen_random_uuid()::text, 1, 8),
        'SUBMISSION',
        v_assign_id,
        v_assign.project_id,
        v_assign.recipient_id,
        v_assign.recipient_name_snapshot,
        'pending',
        p_payload->>'note',
        v_auth_uid,
        v_actor_name,
        false,
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    ) RETURNING id INTO v_sub_id;

    -- Insert submission lines and update parent pending counters
    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_payload->'lines') LOOP
        v_line_id := (v_elem->>'line_id')::UUID;
        v_sub_qty := (v_elem->>'quantity')::NUMERIC(12,2);

        IF v_sub_qty <= 0 THEN
            RAISE EXCEPTION 'Submission quantity must be strictly greater than 0';
        END IF;

        -- Lock work line
        SELECT * INTO v_line
        FROM public.inventory_document_lines
        WHERE id = v_line_id AND document_id = v_assign_id AND line_type = 'WORK_OUTPUT'
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Line % not found in assignment', v_line_id;
        END IF;

        IF (v_line.accepted_qty + v_line.pending_qty + v_sub_qty) > v_line.required_qty THEN
            RAISE EXCEPTION 'Cannot submit % units. Exceeds required quantity (%) for line %',
                v_sub_qty, v_line.required_qty, v_line_id;
        END IF;

        INSERT INTO public.inventory_document_lines (
            document_id,
            line_type,
            source_line_id,
            quantity,
            accepted_qty,
            rejected_qty,
            pending_qty,
            unit,
            created_at,
            updated_at
        ) VALUES (
            v_sub_id,
            'SUBMISSION',
            v_line_id,
            v_sub_qty,
            0.00,
            0.00,
            v_sub_qty,
            v_line.unit,
            timezone('utc'::text, now()),
            timezone('utc'::text, now())
        );

        UPDATE public.inventory_document_lines
        SET submitted_qty = submitted_qty + v_sub_qty,
            pending_qty = pending_qty + v_sub_qty,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_line_id;
    END LOOP;

    -- Update assignment status to submitted if it was in_progress
    UPDATE public.inventory_documents
    SET status = CASE WHEN status = 'in_progress' THEN 'submitted' ELSE status END,
        version = version + 1,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_assign_id;

    INSERT INTO public.inventory_movements (
        document_id, movement_type, quantity, delta_stock, project_id,
        recipient_id, recipient_name_snapshot, actor_auth_user_id, actor_name_snapshot,
        notes, metadata, created_at
    ) VALUES (
        v_assign_id, 'WORK_EVENT', 0, 0, v_assign.project_id,
        v_assign.recipient_id, v_assign.recipient_name_snapshot, v_auth_uid, v_actor_name,
        p_payload->>'note',
        jsonb_build_object('event_type', 'submission_created', 'submission_id', v_sub_id, 'note', p_payload->>'note'),
        timezone('utc'::text, now())
    );

    v_result := jsonb_build_object(
        'success', true,
        'data', jsonb_build_object('id', v_sub_id, 'assignment_id', v_assign_id)
    );

    PERFORM public.warehouse_command_finish('work_submit', v_payload_hash, p_idempotency_key, v_result, v_sub_id, false);

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Alias preserving submit_work

-- 4.5 Inspect Work (Accept / Reject per Submission Line)
CREATE OR REPLACE FUNCTION public.warehouse_inspect_work(
    p_payload JSONB,
    p_idempotency_key UUID
)
RETURNS JSONB AS $$
DECLARE
    v_auth_uid UUID;
    v_actor_name TEXT;
    v_payload_hash TEXT;
    v_cached JSONB;
    v_sub_id UUID;
    v_sub RECORD;
    v_assign RECORD;
    v_insp_id UUID;
    v_elem JSONB;
    v_sub_line_id UUID;
    v_acc_qty NUMERIC(12,2);
    v_rej_qty NUMERIC(12,2);
    v_sub_line RECORD;
    v_has_pending_sub_lines BOOLEAN;
    v_has_remaining_work BOOLEAN;
    v_result JSONB;
BEGIN
    IF p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'Idempotency key (UUID) strictly required';
    END IF;

    v_payload_hash := md5('work_inspect:' || p_payload::text);

    v_cached := public.warehouse_command_lookup('work_inspect', v_payload_hash, p_idempotency_key, false);
    IF v_cached IS NOT NULL THEN
        RETURN v_cached;
    END IF;

    v_auth_uid := auth.uid();
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT coalesce(full_name, username) INTO v_actor_name
    FROM public.staff_users
    WHERE auth_user_id = v_auth_uid AND is_active = TRUE
    LIMIT 1;

    IF v_actor_name IS NULL THEN
        RAISE EXCEPTION 'Active staff mapping not found';
    END IF;

    IF NOT (public.fn_can_access_inventory(v_auth_uid) OR public.fn_can_manage_cash(v_auth_uid)) THEN
        RAISE EXCEPTION 'Unauthorized to inspect work';
    END IF;

    v_sub_id := (p_payload->>'submission_id')::UUID;

    -- Lock SUBMISSION document
    SELECT * INTO v_sub
    FROM public.inventory_documents
    WHERE id = v_sub_id AND doc_type = 'SUBMISSION'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Submission % not found', v_sub_id;
    END IF;

    -- Lock parent WORK document
    SELECT * INTO v_assign
    FROM public.inventory_documents
    WHERE id = v_sub.parent_document_id AND doc_type = 'WORK'
    FOR UPDATE;

    IF v_assign.is_cash THEN
        RAISE EXCEPTION 'Generic inspect on cash assignment is prohibited; prepared banknotes flow through cash ledger';
    END IF;

    -- Create INSPECTION document header
    INSERT INTO public.inventory_documents (
        doc_number,
        doc_type,
        parent_document_id,
        source_document_id,
        project_id,
        status,
        notes,
        actor_auth_user_id,
        actor_name_snapshot,
        is_cash,
        created_at,
        updated_at
    ) VALUES (
        'INS-' || substring(gen_random_uuid()::text, 1, 8),
        'INSPECTION',
        v_sub_id,
        v_assign.id,
        v_assign.project_id,
        'completed',
        p_payload->>'note',
        v_auth_uid,
        v_actor_name,
        false,
        timezone('utc'::text, now()),
        timezone('utc'::text, now())
    ) RETURNING id INTO v_insp_id;

    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_payload->'lines') LOOP
        v_sub_line_id := (v_elem->>'submission_line_id')::UUID;
        v_acc_qty := coalesce((v_elem->>'accepted_qty')::NUMERIC(12,2), 0);
        v_rej_qty := coalesce((v_elem->>'rejected_qty')::NUMERIC(12,2), 0);

        IF v_acc_qty < 0 OR v_rej_qty < 0 THEN
            RAISE EXCEPTION 'Accepted and rejected quantities must be non-negative';
        END IF;

        -- Lock submission line
        SELECT * INTO v_sub_line
        FROM public.inventory_document_lines
        WHERE id = v_sub_line_id AND document_id = v_sub_id AND line_type = 'SUBMISSION'
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Submission line % not found', v_sub_line_id;
        END IF;

        IF (v_acc_qty + v_rej_qty) > v_sub_line.pending_qty THEN
            RAISE EXCEPTION 'Inspection total (% + %) cannot accept more than pending quantity (%) for line %',
                v_acc_qty, v_rej_qty, v_sub_line.pending_qty, v_sub_line_id;
        END IF;

        -- Insert INSPECTION line
        INSERT INTO public.inventory_document_lines (
            document_id,
            line_type,
            source_line_id,
            accepted_qty,
            rejected_qty,
            notes,
            unit,
            created_at,
            updated_at
        ) VALUES (
            v_insp_id,
            'INSPECTION',
            v_sub_line_id,
            v_acc_qty,
            v_rej_qty,
            v_elem->>'notes',
            v_sub_line.unit,
            timezone('utc'::text, now()),
            timezone('utc'::text, now())
        );

        -- Update submission line counters
        UPDATE public.inventory_document_lines
        SET accepted_qty = accepted_qty + v_acc_qty,
            rejected_qty = rejected_qty + v_rej_qty,
            pending_qty = pending_qty - (v_acc_qty + v_rej_qty),
            updated_at = timezone('utc'::text, now())
        WHERE id = v_sub_line_id;

        -- Update WORK_OUTPUT line counters:
        -- accepted increases accepted_qty; rejected frees remaining work (rejected_qty increases, pending decreases)
        UPDATE public.inventory_document_lines
        SET accepted_qty = accepted_qty + v_acc_qty,
            rejected_qty = rejected_qty + v_rej_qty,
            pending_qty = pending_qty - (v_acc_qty + v_rej_qty),
            updated_at = timezone('utc'::text, now())
        WHERE id = v_sub_line.source_line_id;
    END LOOP;

    -- Update SUBMISSION status
    SELECT EXISTS (
        SELECT 1 FROM public.inventory_document_lines
        WHERE document_id = v_sub_id AND line_type = 'SUBMISSION' AND pending_qty > 0
    ) INTO v_has_pending_sub_lines;

    UPDATE public.inventory_documents
    SET status = CASE WHEN v_has_pending_sub_lines THEN 'partially_inspected' ELSE 'inspected' END,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_sub_id;

    -- Update parent WORK status: if uncompleted work remains and no other pending submissions, status can revert to in_progress
    SELECT EXISTS (
        SELECT 1 FROM public.inventory_document_lines
        WHERE document_id = v_assign.id AND line_type = 'WORK_OUTPUT' AND accepted_qty < required_qty
    ) INTO v_has_remaining_work;

    IF v_has_remaining_work THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.inventory_documents
            WHERE parent_document_id = v_assign.id AND doc_type = 'SUBMISSION' AND status = 'pending'
        ) THEN
            UPDATE public.inventory_documents
            SET status = 'in_progress',
                version = version + 1,
                updated_at = timezone('utc'::text, now())
            WHERE id = v_assign.id;
        ELSE
            UPDATE public.inventory_documents
            SET version = version + 1,
                updated_at = timezone('utc'::text, now())
            WHERE id = v_assign.id;
        END IF;
    ELSE
        UPDATE public.inventory_documents
        SET version = version + 1,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_assign.id;
    END IF;

    INSERT INTO public.inventory_movements (
        document_id, movement_type, quantity, delta_stock, project_id,
        recipient_id, recipient_name_snapshot, actor_auth_user_id, actor_name_snapshot,
        notes, metadata, created_at
    ) VALUES (
        v_assign.id, 'WORK_EVENT', 0, 0, v_assign.project_id,
        v_assign.recipient_id, v_assign.recipient_name_snapshot, v_auth_uid, v_actor_name,
        p_payload->>'note',
        jsonb_build_object('event_type', 'inspection_completed', 'inspection_id', v_insp_id, 'submission_id', v_sub_id),
        timezone('utc'::text, now())
    );

    v_result := jsonb_build_object(
        'success', true,
        'data', jsonb_build_object('id', v_insp_id, 'submission_id', v_sub_id)
    );

    PERFORM public.warehouse_command_finish('work_inspect', v_payload_hash, p_idempotency_key, v_result, v_insp_id, false);

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Alias preserving inspect_work

-- 4.6 Set Assignment Status (in_progress, submitted, completed, problem, cancelled)
CREATE OR REPLACE FUNCTION public.warehouse_set_assignment_status(
    p_payload JSONB,
    p_idempotency_key UUID
)
RETURNS JSONB AS $$
DECLARE
    v_auth_uid UUID;
    v_actor_name TEXT;
    v_payload_hash TEXT;
    v_cached JSONB;
    v_assign_id UUID;
    v_expected_ver INT;
    v_new_status TEXT;
    v_reason TEXT;
    v_assign RECORD;
    v_incomplete RECORD;
    v_result JSONB;
BEGIN
    IF p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'Idempotency key (UUID) strictly required';
    END IF;

    v_payload_hash := md5('assignment_set_status:' || p_payload::text);

    v_cached := public.warehouse_command_lookup('assignment_set_status', v_payload_hash, p_idempotency_key, false);
    IF v_cached IS NOT NULL THEN
        RETURN v_cached;
    END IF;

    v_auth_uid := auth.uid();
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT coalesce(full_name, username) INTO v_actor_name
    FROM public.staff_users
    WHERE auth_user_id = v_auth_uid AND is_active = TRUE
    LIMIT 1;

    IF v_actor_name IS NULL THEN
        RAISE EXCEPTION 'Active staff mapping not found';
    END IF;

    IF NOT public.fn_can_access_inventory(v_auth_uid) THEN
        RAISE EXCEPTION 'Unauthorized: Inventory access required to set assignment status';
    END IF;

    v_assign_id := (p_payload->>'assignment_id')::UUID;
    v_expected_ver := (p_payload->>'expected_version')::INT;

    IF v_expected_ver IS NULL OR v_expected_ver < 1 THEN
        RAISE EXCEPTION 'expected_version must be a positive integer';
    END IF;

    v_new_status := p_payload->>'status';
    v_reason := trim(coalesce(p_payload->>'reason', ''));

    IF v_new_status NOT IN ('in_progress', 'submitted', 'completed', 'problem', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid assignment status: %', v_new_status;
    END IF;

    -- Lock parent WORK document
    SELECT * INTO v_assign
    FROM public.inventory_documents
    WHERE id = v_assign_id AND doc_type = 'WORK'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assignment % not found', v_assign_id;
    END IF;

    IF v_assign.version <> v_expected_ver THEN
        RAISE EXCEPTION 'Version conflict: Expected version % but found % (stale overwrite rejected)', v_expected_ver, v_assign.version;
    END IF;

    -- Cash assignment status modification requires cash permissions for any status
    IF v_assign.is_cash AND NOT public.fn_can_manage_cash(v_auth_uid) THEN
        RAISE EXCEPTION 'Unauthorized: Cash management permissions required for cash assignment';
    END IF;

    IF v_new_status = 'completed' THEN
        -- Verify all active lines are fully accepted and no pending inspection
        SELECT * INTO v_incomplete
        FROM public.inventory_document_lines
        WHERE document_id = v_assign_id
          AND line_type = 'WORK_OUTPUT'
          AND is_active = TRUE
          AND (accepted_qty < required_qty OR pending_qty > 0)
        LIMIT 1;

        IF FOUND THEN
            RAISE EXCEPTION 'Cannot complete assignment: Not all required outputs are accepted (line %: accepted %, required %, pending %)',
                v_incomplete.id, v_incomplete.accepted_qty, v_incomplete.required_qty, v_incomplete.pending_qty;
        END IF;
    END IF;

    IF v_new_status IN ('cancelled', 'problem') THEN
        IF v_reason = '' THEN
            RAISE EXCEPTION 'Reason is strictly required for % status', v_new_status;
        END IF;
    END IF;

    UPDATE public.inventory_documents
    SET status = v_new_status,
        version = version + 1,
        notes = CASE 
            WHEN v_reason <> '' THEN coalesce(notes || E'\n', '') || '[' || v_new_status || '] ' || v_reason 
            ELSE notes 
        END,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_assign_id;

    INSERT INTO public.inventory_movements (
        document_id, movement_type, quantity, delta_stock, project_id,
        recipient_id, recipient_name_snapshot, actor_auth_user_id, actor_name_snapshot,
        notes, metadata, created_at
    ) VALUES (
        v_assign_id, 'WORK_EVENT', 0, 0, v_assign.project_id,
        v_assign.recipient_id, v_assign.recipient_name_snapshot, v_auth_uid, v_actor_name,
        v_reason,
        jsonb_build_object('event_type', 'status_changed', 'from_status', v_assign.status, 'to_status', v_new_status, 'reason', v_reason),
        timezone('utc'::text, now())
    );

    v_result := jsonb_build_object(
        'success', true,
        'data', jsonb_build_object('id', v_assign_id, 'status', v_new_status, 'version', v_assign.version + 1)
    );

    PERFORM public.warehouse_command_finish('assignment_set_status', v_payload_hash, p_idempotency_key, v_result, v_assign_id, false);

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Alias preserving set_assignment_status

-- ------------------------------------------------------------------------------
-- 5. READ BUDGET & PRODUCTION BOARD RPCs
-- ------------------------------------------------------------------------------

-- 5.1 Project Production Board (Bounded Preview & Summary)
CREATE OR REPLACE FUNCTION public.warehouse_load_production_project(
    p_project_id TEXT,
    p_limit INT DEFAULT 25,
    p_offset INT DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
    v_auth_uid UUID;
    v_can_manage_cash BOOLEAN;
    v_can_check BOOLEAN;
    v_clean_limit INT;
    v_clean_offset INT;
    v_project RECORD;
    v_assignments JSONB;
    v_has_restricted BOOLEAN;
    v_total_count INT;
    v_completed_count INT;
    v_pending_review_count INT;
    v_problem_count INT;
    v_cancelled_count INT;
    v_ready_for_next BOOLEAN;
BEGIN
    v_auth_uid := auth.uid();
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    v_can_check := public.fn_can_access_inventory(v_auth_uid);
    IF NOT v_can_check THEN
        RAISE EXCEPTION 'Unauthorized to access warehouse production project';
    END IF;

    v_can_manage_cash := public.fn_can_manage_cash(v_auth_uid);

    -- Default 25, bounded between 1 and 50
    v_clean_limit := LEAST(GREATEST(coalesce(p_limit, 25), 1), 50);
    v_clean_offset := GREATEST(coalesce(p_offset, 0), 0);

    SELECT id, name INTO v_project
    FROM public.projects
    WHERE id = p_project_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Project % not found', p_project_id;
    END IF;

    -- Check if restricted cash assignments exist in this project
    SELECT EXISTS (
        SELECT 1 FROM public.inventory_documents
        WHERE project_id = p_project_id AND doc_type = 'WORK' AND is_cash = TRUE
    ) INTO v_has_restricted;

    -- Compute project-wide summary counts (excluding cash if unauthorized)
    SELECT 
        count(*)::INT,
        count(*) FILTER (WHERE status = 'completed')::INT,
        count(*) FILTER (WHERE status = 'submitted')::INT,
        count(*) FILTER (WHERE status = 'problem')::INT,
        count(*) FILTER (WHERE status = 'cancelled')::INT
    INTO 
        v_total_count,
        v_completed_count,
        v_pending_review_count,
        v_problem_count,
        v_cancelled_count
    FROM public.inventory_documents
    WHERE project_id = p_project_id
      AND doc_type = 'WORK'
      AND (NOT is_cash OR v_can_manage_cash);

    -- Ready for next step is true ONLY when there is at least 1 completed task and all tasks are resolved (not empty or all cancelled)
    v_ready_for_next := (v_total_count > 0 AND v_completed_count > 0 AND (v_completed_count + v_cancelled_count) = v_total_count);

    -- Load assignments with bounded submission preview (first 5 submissions, latest inspection info)
    SELECT coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) INTO v_assignments
    FROM (
        SELECT 
            pa.id,
            pa.title,
            pa.status,
            pa.version,
            pa.recipient_id,
            pa.recipient_name_snapshot AS responsible_name,
            pa.team_members_snapshot,
            pa.due_at,
            pa.source_document_id,
            CASE WHEN pa.is_cash THEN pa.source_document_id ELSE NULL END AS source_cash_batch_id,
            pa.is_cash AS cash_only,
            coalesce((
                SELECT jsonb_agg(jsonb_build_object(
                    'id', pal.id,
                    'description', pal.description,
                    'unit', pal.unit,
                    'required_qty', pal.required_qty,
                    'submitted_qty', pal.submitted_qty,
                    'accepted_qty', pal.accepted_qty,
                    'rejected_qty', pal.rejected_qty,
                    'pending_qty', pal.pending_qty,
                    'remaining_qty', GREATEST(0, pal.required_qty - pal.accepted_qty)
                ))
                FROM public.inventory_document_lines pal
                WHERE pal.document_id = pa.id AND pal.line_type = 'WORK_OUTPUT' AND pal.is_active = TRUE
            ), '[]'::jsonb) AS lines,
            coalesce((
                SELECT jsonb_agg(jsonb_build_object(
                    'id', ps.id,
                    'submitted_at', ps.created_at,
                    'submitted_by_name', ps.actor_name_snapshot,
                    'note', ps.notes,
                    'status', ps.status,
                    'lines', coalesce((
                        SELECT jsonb_agg(jsonb_build_object(
                            'id', psl.id,
                            'line_id', psl.source_line_id,
                            'quantity', psl.quantity,
                            'accepted_qty', psl.accepted_qty,
                            'rejected_qty', psl.rejected_qty,
                            'pending_qty', psl.pending_qty
                        ))
                        FROM public.inventory_document_lines psl
                        WHERE psl.document_id = ps.id AND psl.line_type = 'SUBMISSION'
                    ), '[]'::jsonb),
                    'inspections', coalesce((
                        SELECT jsonb_agg(jsonb_build_object(
                            'id', pi.id,
                            'inspector_name', pi.actor_name_snapshot,
                            'inspected_at', pi.created_at,
                            'notes', pi.notes,
                            'lines', coalesce((
                                SELECT jsonb_agg(jsonb_build_object(
                                    'id', pil.id,
                                    'submission_line_id', pil.source_line_id,
                                    'accepted_qty', pil.accepted_qty,
                                    'rejected_qty', pil.rejected_qty,
                                    'notes', pil.notes
                                ))
                                FROM public.inventory_document_lines pil
                                WHERE pil.document_id = pi.id AND pil.line_type = 'INSPECTION'
                            ), '[]'::jsonb)
                        ) ORDER BY pi.created_at ASC)
                        FROM public.inventory_documents pi
                        WHERE pi.parent_document_id = ps.id AND pi.doc_type = 'INSPECTION'
                    ), '[]'::jsonb)
                ) ORDER BY ps.created_at DESC)
                FROM (
                    SELECT * FROM public.inventory_documents
                    WHERE parent_document_id = pa.id AND doc_type = 'SUBMISSION'
                    ORDER BY created_at DESC
                    LIMIT 5
                ) ps
            ), '[]'::jsonb) AS submissions,
            ((SELECT count(*) FROM public.inventory_documents WHERE parent_document_id = pa.id AND doc_type = 'SUBMISSION') > 5) AS has_more_submissions,
            (
                SELECT jsonb_build_object(
                    'inspector_name', pi.actor_name_snapshot,
                    'inspected_at', pi.created_at,
                    'notes', pi.notes
                )
                FROM public.inventory_documents pi
                WHERE pi.source_document_id = pa.id AND pi.doc_type = 'INSPECTION'
                ORDER BY pi.created_at DESC
                LIMIT 1
            ) AS latest_check
        FROM public.inventory_documents pa
        WHERE pa.project_id = p_project_id
          AND pa.doc_type = 'WORK'
          AND (NOT pa.is_cash OR v_can_manage_cash)
        ORDER BY pa.created_at ASC
        LIMIT v_clean_limit
        OFFSET v_clean_offset
    ) a;

    RETURN jsonb_build_object(
        'project', jsonb_build_object('id', v_project.id, 'name', v_project.name),
        'assignments', v_assignments,
        'summary', jsonb_build_object(
            'assignment_count', v_total_count,
            'completed_count', v_completed_count,
            'pending_review_count', v_pending_review_count,
            'problem_count', v_problem_count,
            'cancelled_count', v_cancelled_count,
            'ready_for_next_step', v_ready_for_next,
            'has_restricted_work', v_has_restricted
        ),
        'permissions', jsonb_build_object(
            'can_check', v_can_check,
            'can_manage_cash', v_can_manage_cash
        ),
        'updated_at', timezone('utc'::text, now()),
        'has_more', (v_clean_offset + v_clean_limit) < v_total_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- Alias preserving load_production_project

-- 5.2 Detailed Receipts On-Demand (warehouse_get_work_details)
CREATE OR REPLACE FUNCTION public.warehouse_get_work_details(
    p_assignment_id UUID,
    p_limit INT DEFAULT 20,
    p_offset INT DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
    v_auth_uid UUID;
    v_clean_limit INT;
    v_clean_offset INT;
    v_assign RECORD;
    v_total_subs INT;
    v_submissions JSONB;
BEGIN
    v_auth_uid := auth.uid();
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF NOT (public.fn_can_access_inventory(v_auth_uid) OR public.fn_can_manage_cash(v_auth_uid)) THEN
        RAISE EXCEPTION 'Unauthorized to access warehouse production work details';
    END IF;

    v_clean_limit := LEAST(GREATEST(coalesce(p_limit, 20), 1), 100);
    v_clean_offset := GREATEST(coalesce(p_offset, 0), 0);

    SELECT * INTO v_assign
    FROM public.inventory_documents
    WHERE id = p_assignment_id AND doc_type = 'WORK';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assignment % not found', p_assignment_id;
    END IF;

    IF v_assign.is_cash AND NOT public.fn_can_manage_cash(v_auth_uid) THEN
        RAISE EXCEPTION 'Unauthorized to access cash work details';
    END IF;

    SELECT count(*)::INT INTO v_total_subs
    FROM public.inventory_documents
    WHERE parent_document_id = p_assignment_id AND doc_type = 'SUBMISSION';

    SELECT coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) INTO v_submissions
    FROM (
        SELECT 
            ps.id,
            ps.created_at AS submitted_at,
            ps.actor_name_snapshot AS submitted_by_name,
            ps.actor_auth_user_id AS submitted_by_auth_user_id,
            ps.notes AS note,
            ps.status,
            coalesce((
                SELECT jsonb_agg(jsonb_build_object(
                    'id', psl.id,
                    'line_id', psl.source_line_id,
                    'quantity', psl.quantity,
                    'accepted_qty', psl.accepted_qty,
                    'rejected_qty', psl.rejected_qty,
                    'pending_qty', psl.pending_qty,
                    'unit', psl.unit
                ))
                FROM public.inventory_document_lines psl
                WHERE psl.document_id = ps.id AND psl.line_type = 'SUBMISSION'
            ), '[]'::jsonb) AS lines,
            coalesce((
                SELECT jsonb_agg(jsonb_build_object(
                    'id', pi.id,
                    'inspector_auth_user_id', pi.actor_auth_user_id,
                    'inspector_name', pi.actor_name_snapshot,
                    'inspected_at', pi.created_at,
                    'notes', pi.notes,
                    'lines', coalesce((
                        SELECT jsonb_agg(jsonb_build_object(
                            'id', pil.id,
                            'submission_line_id', pil.source_line_id,
                            'accepted_qty', pil.accepted_qty,
                            'rejected_qty', pil.rejected_qty,
                            'notes', pil.notes
                        ))
                        FROM public.inventory_document_lines pil
                        WHERE pil.document_id = pi.id AND pil.line_type = 'INSPECTION'
                    ), '[]'::jsonb)
                ) ORDER BY pi.created_at ASC)
                FROM public.inventory_documents pi
                WHERE pi.parent_document_id = ps.id AND pi.doc_type = 'INSPECTION'
            ), '[]'::jsonb) AS inspections
        FROM public.inventory_documents ps
        WHERE ps.parent_document_id = p_assignment_id AND ps.doc_type = 'SUBMISSION'
        ORDER BY ps.created_at DESC
        LIMIT v_clean_limit
        OFFSET v_clean_offset
    ) s;

    RETURN jsonb_build_object(
        'assignment_id', p_assignment_id,
        'submissions', v_submissions,
        'total_submissions', v_total_subs,
        'has_more', (v_clean_offset + v_clean_limit) < v_total_subs
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- 5.3 Targeted Work Cards Refresh (warehouse_get_work_cards, max 25)
CREATE OR REPLACE FUNCTION public.warehouse_get_work_cards(
    p_project_id TEXT,
    p_assignment_ids UUID[]
)
RETURNS JSONB AS $$
DECLARE
    v_auth_uid UUID;
    v_can_manage_cash BOOLEAN;
    v_target_ids UUID[];
    v_cards JSONB;
BEGIN
    v_auth_uid := auth.uid();
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF NOT (public.fn_can_access_inventory(v_auth_uid) OR public.fn_can_manage_cash(v_auth_uid)) THEN
        RAISE EXCEPTION 'Unauthorized to access warehouse production cards';
    END IF;

    v_can_manage_cash := public.fn_can_manage_cash(v_auth_uid);

    -- Cap targeted refresh at 25 IDs
    SELECT array_agg(t.id) INTO v_target_ids
    FROM (
        SELECT unnest(p_assignment_ids) AS id
        LIMIT 25
    ) t;

    IF v_target_ids IS NULL OR array_length(v_target_ids, 1) = 0 THEN
        RETURN '[]'::jsonb;
    END IF;

    SELECT coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) INTO v_cards
    FROM (
        SELECT 
            pa.id,
            pa.title,
            pa.status,
            pa.version,
            pa.recipient_id,
            pa.recipient_name_snapshot AS responsible_name,
            pa.team_members_snapshot,
            pa.due_at,
            pa.source_document_id,
            CASE WHEN pa.is_cash THEN pa.source_document_id ELSE NULL END AS source_cash_batch_id,
            pa.is_cash AS cash_only,
            coalesce((
                SELECT jsonb_agg(jsonb_build_object(
                    'id', pal.id,
                    'description', pal.description,
                    'unit', pal.unit,
                    'required_qty', pal.required_qty,
                    'submitted_qty', pal.submitted_qty,
                    'accepted_qty', pal.accepted_qty,
                    'rejected_qty', pal.rejected_qty,
                    'pending_qty', pal.pending_qty,
                    'remaining_qty', GREATEST(0, pal.required_qty - pal.accepted_qty)
                ))
                FROM public.inventory_document_lines pal
                WHERE pal.document_id = pa.id AND pal.line_type = 'WORK_OUTPUT' AND pal.is_active = TRUE
            ), '[]'::jsonb) AS lines,
            coalesce((
                SELECT jsonb_agg(jsonb_build_object(
                    'id', ps.id,
                    'submitted_at', ps.created_at,
                    'submitted_by_name', ps.actor_name_snapshot,
                    'note', ps.notes,
                    'status', ps.status,
                    'lines', coalesce((
                        SELECT jsonb_agg(jsonb_build_object(
                            'id', psl.id,
                            'line_id', psl.source_line_id,
                            'quantity', psl.quantity,
                            'accepted_qty', psl.accepted_qty,
                            'rejected_qty', psl.rejected_qty,
                            'pending_qty', psl.pending_qty
                        ))
                        FROM public.inventory_document_lines psl
                        WHERE psl.document_id = ps.id AND psl.line_type = 'SUBMISSION'
                    ), '[]'::jsonb),
                    'inspections', coalesce((
                        SELECT jsonb_agg(jsonb_build_object(
                            'id', pi.id,
                            'inspector_name', pi.actor_name_snapshot,
                            'inspected_at', pi.created_at,
                            'notes', pi.notes,
                            'lines', coalesce((
                                SELECT jsonb_agg(jsonb_build_object(
                                    'id', pil.id,
                                    'submission_line_id', pil.source_line_id,
                                    'accepted_qty', pil.accepted_qty,
                                    'rejected_qty', pil.rejected_qty,
                                    'notes', pil.notes
                                ))
                                FROM public.inventory_document_lines pil
                                WHERE pil.document_id = pi.id AND pil.line_type = 'INSPECTION'
                            ), '[]'::jsonb)
                        ) ORDER BY pi.created_at ASC)
                        FROM public.inventory_documents pi
                        WHERE pi.parent_document_id = ps.id AND pi.doc_type = 'INSPECTION'
                    ), '[]'::jsonb)
                ) ORDER BY ps.created_at DESC)
                FROM (
                    SELECT * FROM public.inventory_documents
                    WHERE parent_document_id = pa.id AND doc_type = 'SUBMISSION'
                    ORDER BY created_at DESC
                    LIMIT 5
                ) ps
            ), '[]'::jsonb) AS submissions,
            ((SELECT count(*) FROM public.inventory_documents WHERE parent_document_id = pa.id AND doc_type = 'SUBMISSION') > 5) AS has_more_submissions,
            (
                SELECT jsonb_build_object(
                    'inspector_name', pi.actor_name_snapshot,
                    'inspected_at', pi.created_at,
                    'notes', pi.notes
                )
                FROM public.inventory_documents pi
                WHERE pi.source_document_id = pa.id AND pi.doc_type = 'INSPECTION'
                ORDER BY pi.created_at DESC
                LIMIT 1
            ) AS latest_check
        FROM public.inventory_documents pa
        WHERE pa.id = ANY(v_target_ids)
          AND (p_project_id IS NULL OR pa.project_id = p_project_id)
          AND pa.doc_type = 'WORK'
          AND (NOT pa.is_cash OR v_can_manage_cash)
        ORDER BY pa.created_at ASC
    ) a;

    RETURN v_cards;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- 5.4 Inspect Production Cash (Canonical Single-RPC Resolver)
CREATE OR REPLACE FUNCTION public.warehouse_inspect_production_cash(
    p_payload JSONB,
    p_idempotency_key UUID
)
RETURNS JSONB AS $$
DECLARE
    v_auth_uid UUID;
    v_payload_hash TEXT;
    v_cached JSONB;
    v_assignment_id UUID;
    v_batch_id UUID;
    v_work_doc RECORD;
    v_batch_doc RECORD;
    v_project_id TEXT;
    v_denom INT;
    v_note_count INT;
    v_notes TEXT;
    v_core_result JSONB;
BEGIN
    IF p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'Idempotency key (UUID) strictly required';
    END IF;

    v_payload_hash := md5('inspect_production_cash:' || p_payload::text);

    v_cached := public.warehouse_command_lookup('inspect_production_cash', v_payload_hash, p_idempotency_key, true);
    IF v_cached IS NOT NULL THEN
        RETURN v_cached;
    END IF;

    v_auth_uid := auth.uid();
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF NOT public.fn_can_manage_cash(v_auth_uid) THEN
        RAISE EXCEPTION 'Unauthorized: Cash management role strictly required to inspect cash';
    END IF;

    v_assignment_id := (p_payload->>'assignment_id')::UUID;
    v_batch_id := (p_payload->>'batch_id')::UUID;
    v_note_count := (p_payload->>'note_count')::INT;
    v_notes := coalesce(p_payload->>'notes', 'Prepared notes verified from production hub');

    IF v_note_count IS NULL OR v_note_count <= 0 THEN
        RAISE EXCEPTION 'note_count must be a positive integer';
    END IF;

    -- Resolve canonical cash batch from assignment or batch ID
    IF v_assignment_id IS NOT NULL THEN
        SELECT id, project_id, source_document_id, is_cash, denomination INTO v_work_doc
        FROM public.inventory_documents
        WHERE id = v_assignment_id AND doc_type = 'WORK';

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Production cash assignment not found';
        END IF;

        IF NOT v_work_doc.is_cash OR v_work_doc.source_document_id IS NULL THEN
            RAISE EXCEPTION 'Target assignment is not a canonical cash batch assignment';
        END IF;

        v_batch_id := v_work_doc.source_document_id;
        v_project_id := v_work_doc.project_id;
        v_denom := v_work_doc.denomination;
    END IF;

    IF v_batch_id IS NULL THEN
        RAISE EXCEPTION 'Either assignment_id or batch_id must be provided to inspect production cash';
    END IF;

    -- Look up batch in unified documents or fallback
    SELECT id, project_id, denomination INTO v_batch_doc
    FROM public.inventory_documents
    WHERE id = v_batch_id;

    IF FOUND THEN
        v_project_id := coalesce(v_project_id, v_batch_doc.project_id);
        v_denom := coalesce(v_denom, v_batch_doc.denomination);
    ELSE
        BEGIN
            EXECUTE 'SELECT project_id, denomination FROM public.cash_helper_batches WHERE id = $1'
            INTO v_project_id, v_denom
            USING v_batch_id;
        EXCEPTION WHEN OTHERS THEN
            v_project_id := NULL;
        END;

        IF v_project_id IS NULL THEN
            RAISE EXCEPTION 'Source cash batch % not found', v_batch_id;
        END IF;
    END IF;

    -- Dispatch canonical core cash_receive_prepared
    v_core_result := public.warehouse_dispatch(
        'cash_receive_prepared',
        jsonb_build_object(
            'project_id', v_project_id,
            'batch_id', v_batch_id,
            'denomination', v_denom,
            'note_count', v_note_count,
            'notes', v_notes
        ),
        p_idempotency_key
    );

    RETURN v_core_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ------------------------------------------------------------------------------
-- 6. GRANTS & REVOCATIONS
-- ------------------------------------------------------------------------------

-- Private helpers: revoke from PUBLIC, anon, authenticated (definer-only)
REVOKE ALL ON FUNCTION public.warehouse_ensure_production_work(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.warehouse_sync_cash_work(UUID) FROM PUBLIC, anon, authenticated;

-- Public RPCs: revoke from PUBLIC and anon; grant execute to authenticated
REVOKE ALL ON FUNCTION public.warehouse_list_people(TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.warehouse_list_people(TEXT, INT) TO authenticated;

REVOKE ALL ON FUNCTION public.warehouse_resolve_person(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.warehouse_resolve_person(TEXT) TO authenticated;


REVOKE ALL ON FUNCTION public.warehouse_create_production_issue(JSONB, JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.warehouse_create_production_issue(JSONB, JSONB, UUID) TO authenticated;


REVOKE ALL ON FUNCTION public.warehouse_create_assignment(JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.warehouse_create_assignment(JSONB, UUID) TO authenticated;


REVOKE ALL ON FUNCTION public.warehouse_update_assignment(JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.warehouse_update_assignment(JSONB, UUID) TO authenticated;


REVOKE ALL ON FUNCTION public.warehouse_split_assignment(JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.warehouse_split_assignment(JSONB, UUID) TO authenticated;


REVOKE ALL ON FUNCTION public.warehouse_submit_work(JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.warehouse_submit_work(JSONB, UUID) TO authenticated;


REVOKE ALL ON FUNCTION public.warehouse_inspect_work(JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.warehouse_inspect_work(JSONB, UUID) TO authenticated;


REVOKE ALL ON FUNCTION public.warehouse_set_assignment_status(JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.warehouse_set_assignment_status(JSONB, UUID) TO authenticated;


REVOKE ALL ON FUNCTION public.warehouse_load_production_project(TEXT, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.warehouse_load_production_project(TEXT, INT, INT) TO authenticated;


REVOKE ALL ON FUNCTION public.warehouse_get_work_details(UUID, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.warehouse_get_work_details(UUID, INT, INT) TO authenticated;

REVOKE ALL ON FUNCTION public.warehouse_get_work_cards(TEXT, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.warehouse_get_work_cards(TEXT, UUID[]) TO authenticated;

REVOKE ALL ON FUNCTION public.warehouse_inspect_production_cash(JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.warehouse_inspect_production_cash(JSONB, UUID) TO authenticated;

COMMIT;
