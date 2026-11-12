-- DEVELOPMENT SNAPSHOT: superseded direction after the user's consolidation request.
-- If already applied, preserve all data. Do not rerun or manually drop its tables.
-- The compact migration and installation order are being prepared and are not ready yet.
-- ==============================================================================
-- FLOWER2U (F2U) — INVENTORY PLAN C: PRODUCTION RELATIONAL TRANSACTION ENGINE
-- Additive, rerunnable, pure-relational migration for Plan C inventory & cash.
-- Single transaction, zero loss of legacy data, server-enforced RBAC.
-- ==============================================================================

BEGIN;

-- 1. Safely add columns to existing legacy tables
ALTER TABLE public.inventory_categories 
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE public.inventory_categories DROP CONSTRAINT IF EXISTS inventory_categories_type_check;
ALTER TABLE public.inventory_categories ADD CONSTRAINT inventory_categories_type_check 
    CHECK (type IN ('asset', 'consumable', 'reusable', 'reusable_material'));

ALTER TABLE public.inventory_items 
    ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.inventory_categories(id) ON DELETE SET NULL;

ALTER TABLE public.inventory_items DROP CONSTRAINT IF EXISTS inventory_items_item_type_check;
ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_item_type_check 
    CHECK (lower(item_type) IN ('asset', 'reusable', 'consumable', 'banknote', 'task', 'reusable_material'));

-- 2. PLAN C DOMAIN TABLES (All use gen_random_uuid() natively)

-- 2.1 Recipient Registry (Staff, Casual Helpers, Teams - independent of login/employment)
CREATE TABLE IF NOT EXISTS public.inventory_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    recipient_type TEXT NOT NULL DEFAULT 'individual' CHECK (recipient_type IN ('individual', 'team', 'casual_helper', 'staff')),
    contact_info TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_inventory_recipients_type ON public.inventory_recipients(recipient_type);
CREATE INDEX IF NOT EXISTS idx_inventory_recipients_active ON public.inventory_recipients(is_active);

-- 2.2 Recipient Teams (Team members & named primary receiver)
CREATE TABLE IF NOT EXISTS public.inventory_recipient_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_recipient_id UUID NOT NULL REFERENCES public.inventory_recipients(id) ON DELETE CASCADE,
    primary_recipient_id UUID REFERENCES public.inventory_recipients(id) ON DELETE SET NULL,
    primary_receiver_name TEXT NOT NULL,
    member_names TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 2.3 Field Installation Rounds (Shared tool kit across multiple project locations)
CREATE TABLE IF NOT EXISTS public.inventory_field_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    recipient_id UUID REFERENCES public.inventory_recipients(id) ON DELETE SET NULL,
    recipient_name_snapshot TEXT NOT NULL,
    team_members_snapshot TEXT[] DEFAULT '{}',
    expected_return_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'RETURNED', 'PARTIAL_RETURNED', 'CLOSED')),
    notes TEXT,
    created_by_auth_user_id UUID,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_field_rounds_status ON public.inventory_field_rounds(status);

-- 2.4 Field Round Linked Projects (1 round covers 15+ project sites without issuing tools twice)
CREATE TABLE IF NOT EXISTS public.inventory_field_round_projects (
    round_id UUID NOT NULL REFERENCES public.inventory_field_rounds(id) ON DELETE CASCADE,
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    sort_order INT DEFAULT 0,
    PRIMARY KEY (round_id, project_id)
);

-- 2.5 Transaction Documents (Issues, Returns, Recoveries, Adjustments)
CREATE TABLE IF NOT EXISTS public.inventory_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_number TEXT NOT NULL UNIQUE,
    doc_type TEXT NOT NULL CHECK (doc_type IN ('PRODUCTION_ISSUE', 'FIELD_ISSUE', 'RETURN_UNUSED', 'RECOVERY', 'OPENING_STOCK', 'ADJUSTMENT')),
    project_id TEXT REFERENCES public.projects(id) ON DELETE SET NULL,
    round_id UUID REFERENCES public.inventory_field_rounds(id) ON DELETE SET NULL,
    recipient_id UUID REFERENCES public.inventory_recipients(id) ON DELETE SET NULL,
    recipient_name_snapshot TEXT NOT NULL,
    team_members_snapshot TEXT[] DEFAULT '{}',
    idempotency_key UUID UNIQUE,
    idempotency_payload_hash TEXT,
    status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'CANCELLED')),
    notes TEXT,
    actor_auth_user_id UUID,
    actor_name_snapshot TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_inventory_docs_project ON public.inventory_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_inventory_docs_round ON public.inventory_documents(round_id);
CREATE INDEX IF NOT EXISTS idx_inventory_docs_type ON public.inventory_documents(doc_type);

-- 2.6 Material Movements (Consumables and Reusables immutable ledger)
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.inventory_documents(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('ISSUE', 'RETURN_UNUSED', 'RECOVERY_INSPECTED', 'RECOVERY_PENDING', 'INSPECTION_ACCEPT', 'INSPECTION_REJECT_DAMAGED', 'OPENING_STOCK', 'ADJUSTMENT', 'PROCUREMENT_RECEIVE')),
    quantity NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
    delta_stock NUMERIC(10,2) NOT NULL,
    source_issue_movement_id UUID REFERENCES public.inventory_movements(id) ON DELETE SET NULL,
    source_item_variant_snapshot JSONB,
    notes TEXT,
    actor_auth_user_id UUID,
    actor_name_snapshot TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_item ON public.inventory_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_source ON public.inventory_movements(source_issue_movement_id);

-- 2.7 Material Recoveries (Reusable items returned from job sites, direct or pending inspection)
CREATE TABLE IF NOT EXISTS public.inventory_material_recoveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.inventory_documents(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
    source_issue_movement_id UUID NOT NULL REFERENCES public.inventory_movements(id) ON DELETE RESTRICT,
    recovered_qty NUMERIC(10,2) NOT NULL CHECK (recovered_qty > 0),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'INSPECTED', 'DIRECT_COMPLETED')),
    inspected_good_qty NUMERIC(10,2) DEFAULT 0 CHECK (inspected_good_qty >= 0),
    inspected_damaged_qty NUMERIC(10,2) DEFAULT 0 CHECK (inspected_damaged_qty >= 0),
    inspected_at TIMESTAMPTZ,
    inspected_by_auth_user_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_material_recoveries_status ON public.inventory_material_recoveries(status);

-- 2.8 Tool Asset Custody (Single active custody per unit, atomic borrow, explicit handover)
CREATE TABLE IF NOT EXISTS public.asset_unit_custody (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_code TEXT NOT NULL REFERENCES public.asset_units(unit_code) ON DELETE RESTRICT,
    document_id UUID REFERENCES public.inventory_documents(id) ON DELETE SET NULL,
    project_id TEXT REFERENCES public.projects(id) ON DELETE SET NULL,
    round_id UUID REFERENCES public.inventory_field_rounds(id) ON DELETE SET NULL,
    recipient_id UUID REFERENCES public.inventory_recipients(id) ON DELETE SET NULL,
    recipient_name_snapshot TEXT NOT NULL,
    borrowed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    due_date TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,
    return_status TEXT CHECK (return_status IN ('AVAILABLE', 'BROKEN', 'LOST')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    handed_over_to_custody_id UUID REFERENCES public.asset_unit_custody(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_asset_custody_unit ON public.asset_unit_custody(unit_code);
CREATE INDEX IF NOT EXISTS idx_asset_custody_active ON public.asset_unit_custody(is_active);

-- 2.9 Tool Incidents (Broken / Lost tool records with evidence and investigation status)
CREATE TABLE IF NOT EXISTS public.inventory_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_code TEXT REFERENCES public.asset_units(unit_code) ON DELETE SET NULL,
    incident_type TEXT NOT NULL CHECK (incident_type IN ('BROKEN', 'LOST', 'DISCREPANCY')),
    document_id UUID REFERENCES public.inventory_documents(id) ON DELETE SET NULL,
    custody_id UUID REFERENCES public.asset_unit_custody(id) ON DELETE SET NULL,
    responsible_recipient_id UUID REFERENCES public.inventory_recipients(id) ON DELETE SET NULL,
    recipient_name_snapshot TEXT,
    round_id UUID REFERENCES public.inventory_field_rounds(id) ON DELETE SET NULL,
    severity TEXT DEFAULT 'STANDARD',
    resolution_status TEXT NOT NULL DEFAULT 'OPEN' CHECK (resolution_status IN ('OPEN', 'INVESTIGATING', 'RESOLVED', 'WRITTEN_OFF')),
    notes TEXT,
    reporter_auth_user_id UUID,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.inventory_incidents(resolution_status);

-- 2.10 Cash Vault Denominations (Physical, Reserved, Available integer counts)
CREATE TABLE IF NOT EXISTS public.cash_vault_denominations (
    denomination INT PRIMARY KEY CHECK (denomination IN (20, 50, 100, 500, 1000)),
    physical_count INT NOT NULL DEFAULT 0 CHECK (physical_count >= 0),
    reserved_count INT NOT NULL DEFAULT 0 CHECK (reserved_count >= 0 AND reserved_count <= physical_count),
    low_alert_threshold INT NOT NULL DEFAULT 0 CHECK (low_alert_threshold >= 0),
    target_available_count INT NOT NULL DEFAULT 0 CHECK (target_available_count >= 0),
    is_initialized BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Initialize standard denominations if empty (0 counts - zero seeded threshold until owner sets)
INSERT INTO public.cash_vault_denominations (denomination, physical_count, reserved_count, low_alert_threshold, target_available_count, is_initialized)
VALUES 
    (20, 0, 0, 0, 0, false),
    (50, 0, 0, 0, 0, false),
    (100, 0, 0, 0, 0, false),
    (500, 0, 0, 0, 0, false),
    (1000, 0, 0, 0, 0, false)
ON CONFLICT (denomination) DO NOTHING;

-- 2.11 Cash Job Reservations
CREATE TABLE IF NOT EXISTS public.cash_job_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
    denomination INT NOT NULL REFERENCES public.cash_vault_denominations(denomination) ON DELETE RESTRICT,
    reserved_count INT NOT NULL DEFAULT 0 CHECK (reserved_count >= 0),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    UNIQUE (project_id, denomination)
);

-- 2.12 Cash Helper Batches (Multiple batches per job for folding / envelope stuffing)
CREATE TABLE IF NOT EXISTS public.cash_helper_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_code TEXT NOT NULL UNIQUE,
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
    recipient_id UUID REFERENCES public.inventory_recipients(id) ON DELETE SET NULL,
    recipient_name_snapshot TEXT NOT NULL,
    denomination INT NOT NULL REFERENCES public.cash_vault_denominations(denomination) ON DELETE RESTRICT,
    issued_count INT NOT NULL CHECK (issued_count > 0),
    prepared_count INT NOT NULL DEFAULT 0 CHECK (prepared_count >= 0 AND prepared_count <= issued_count),
    returned_raw_count INT NOT NULL DEFAULT 0 CHECK (returned_raw_count >= 0 AND returned_raw_count <= issued_count),
    handed_over_count INT NOT NULL DEFAULT 0 CHECK (handed_over_count >= 0 AND handed_over_count <= issued_count),
    status TEXT NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('ISSUED', 'PARTIAL_PREPARED', 'FULLY_PREPARED', 'RETURNED_UNUSED', 'HANDED_OVER', 'DELIVERED', 'CLOSED')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_cash_batches_project ON public.cash_helper_batches(project_id);

-- 2.13 Cash Prepared Sets (Completed banknotes prepared into gift sets, ready for delivery)
CREATE TABLE IF NOT EXISTS public.cash_prepared_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
    denomination INT NOT NULL REFERENCES public.cash_vault_denominations(denomination) ON DELETE RESTRICT,
    prepared_count INT NOT NULL DEFAULT 0 CHECK (prepared_count >= 0),
    delivered_count INT NOT NULL DEFAULT 0 CHECK (delivered_count >= 0 AND delivered_count <= prepared_count),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    UNIQUE (project_id, denomination)
);

-- 2.14 Cash Movements (Immutable money flow audit ledger)
CREATE TABLE IF NOT EXISTS public.cash_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type TEXT NOT NULL CHECK (action_type IN ('DEPOSIT', 'COUNTED_OPENING', 'RESERVE', 'RELEASE_RESERVATION', 'ISSUE_HELPER_BATCH', 'RECEIVE_PREPARED', 'RETURN_UNUSED_RAW', 'HANDOVER_BATCH', 'DELIVER_TO_CUSTOMER', 'COUNT_ADJUSTMENT')),
    project_id TEXT REFERENCES public.projects(id),
    batch_id UUID REFERENCES public.cash_helper_batches(id),
    denomination INT NOT NULL,
    note_count INT NOT NULL CHECK (note_count >= 0),
    total_value NUMERIC(12,2) GENERATED ALWAYS AS (denomination * note_count) STORED,
    from_location TEXT,
    to_location TEXT,
    actor_auth_user_id UUID,
    actor_name_snapshot TEXT,
    notes TEXT,
    idempotency_key UUID,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_cash_movements_proj ON public.cash_movements(project_id);

-- 2.15 Idempotency Ledger
CREATE TABLE IF NOT EXISTS public.inventory_idempotency_records (
    idempotency_key UUID PRIMARY KEY,
    actor_auth_user_id UUID NOT NULL,
    action_name TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    response_payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 3. SERVER PERMISSIONS & AUTH HELPERS

-- Helper 3.1: Check if user has Inventory access (Admin OR role has 'Inventory' page OR can_borrow_tools)
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

-- Helper 3.2: Check if user has Cash access (Admin or Accountant only)
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

-- Helper 3.3: Canonical action + payload hash
CREATE OR REPLACE FUNCTION public.fn_hash_action_payload(p_action TEXT, p_payload JSONB)
RETURNS TEXT AS $$
BEGIN
    RETURN md5(coalesce(p_action, '') || '::' || coalesce(p_payload::text, ''));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. ROW LEVEL SECURITY (RLS) & GRANTS

ALTER TABLE public.inventory_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_recipient_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_field_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_field_round_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_material_recoveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_unit_custody ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_vault_denominations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_job_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_helper_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_prepared_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_idempotency_records ENABLE ROW LEVEL SECURITY;

-- Revoke direct mutation from PUBLIC, anon, and authenticated on all new tables
REVOKE ALL ON public.inventory_recipients FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.inventory_recipient_teams FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.inventory_field_rounds FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.inventory_field_round_projects FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.inventory_documents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.inventory_movements FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.inventory_material_recoveries FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.asset_unit_custody FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.inventory_incidents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.cash_vault_denominations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.cash_job_reservations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.cash_helper_batches FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.cash_prepared_sets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.cash_movements FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.inventory_idempotency_records FROM PUBLIC, anon, authenticated;

-- Grant SELECT only to authenticated users (evaluated through RLS)
GRANT SELECT ON public.inventory_recipients TO authenticated;
GRANT SELECT ON public.inventory_recipient_teams TO authenticated;
GRANT SELECT ON public.inventory_field_rounds TO authenticated;
GRANT SELECT ON public.inventory_field_round_projects TO authenticated;
GRANT SELECT ON public.inventory_documents TO authenticated;
GRANT SELECT ON public.inventory_movements TO authenticated;
GRANT SELECT ON public.inventory_material_recoveries TO authenticated;
GRANT SELECT ON public.asset_unit_custody TO authenticated;
GRANT SELECT ON public.inventory_incidents TO authenticated;
GRANT SELECT ON public.cash_vault_denominations TO authenticated;
GRANT SELECT ON public.cash_job_reservations TO authenticated;
GRANT SELECT ON public.cash_helper_batches TO authenticated;
GRANT SELECT ON public.cash_prepared_sets TO authenticated;
GRANT SELECT ON public.cash_movements TO authenticated;
GRANT SELECT ON public.inventory_idempotency_records TO authenticated;

-- Policies for Inventory tables
DROP POLICY IF EXISTS "Inventory access select inventory_recipients" ON public.inventory_recipients;
CREATE POLICY "Inventory access select inventory_recipients" ON public.inventory_recipients
    FOR SELECT TO authenticated USING (public.fn_can_access_inventory(auth.uid()));

DROP POLICY IF EXISTS "Inventory access select inventory_recipient_teams" ON public.inventory_recipient_teams;
CREATE POLICY "Inventory access select inventory_recipient_teams" ON public.inventory_recipient_teams
    FOR SELECT TO authenticated USING (public.fn_can_access_inventory(auth.uid()));

DROP POLICY IF EXISTS "Inventory access select inventory_field_rounds" ON public.inventory_field_rounds;
CREATE POLICY "Inventory access select inventory_field_rounds" ON public.inventory_field_rounds
    FOR SELECT TO authenticated USING (public.fn_can_access_inventory(auth.uid()));

DROP POLICY IF EXISTS "Inventory access select inventory_field_round_projects" ON public.inventory_field_round_projects;
CREATE POLICY "Inventory access select inventory_field_round_projects" ON public.inventory_field_round_projects
    FOR SELECT TO authenticated USING (public.fn_can_access_inventory(auth.uid()));

DROP POLICY IF EXISTS "Inventory access select inventory_documents" ON public.inventory_documents;
CREATE POLICY "Inventory access select inventory_documents" ON public.inventory_documents
    FOR SELECT TO authenticated USING (public.fn_can_access_inventory(auth.uid()));

DROP POLICY IF EXISTS "Inventory access select inventory_movements" ON public.inventory_movements;
CREATE POLICY "Inventory access select inventory_movements" ON public.inventory_movements
    FOR SELECT TO authenticated USING (public.fn_can_access_inventory(auth.uid()));

DROP POLICY IF EXISTS "Inventory access select inventory_material_recoveries" ON public.inventory_material_recoveries;
CREATE POLICY "Inventory access select inventory_material_recoveries" ON public.inventory_material_recoveries
    FOR SELECT TO authenticated USING (public.fn_can_access_inventory(auth.uid()));

DROP POLICY IF EXISTS "Inventory access select asset_unit_custody" ON public.asset_unit_custody;
CREATE POLICY "Inventory access select asset_unit_custody" ON public.asset_unit_custody
    FOR SELECT TO authenticated USING (public.fn_can_access_inventory(auth.uid()));

DROP POLICY IF EXISTS "Inventory access select inventory_incidents" ON public.inventory_incidents;
CREATE POLICY "Inventory access select inventory_incidents" ON public.inventory_incidents
    FOR SELECT TO authenticated USING (public.fn_can_access_inventory(auth.uid()));

-- Policies for Cash tables: strictly fn_can_manage_cash
DROP POLICY IF EXISTS "Cash access select cash_vault_denominations" ON public.cash_vault_denominations;
CREATE POLICY "Cash access select cash_vault_denominations" ON public.cash_vault_denominations
    FOR SELECT TO authenticated USING (public.fn_can_manage_cash(auth.uid()));

DROP POLICY IF EXISTS "Cash access select cash_job_reservations" ON public.cash_job_reservations;
CREATE POLICY "Cash access select cash_job_reservations" ON public.cash_job_reservations
    FOR SELECT TO authenticated USING (public.fn_can_manage_cash(auth.uid()));

DROP POLICY IF EXISTS "Cash access select cash_helper_batches" ON public.cash_helper_batches;
CREATE POLICY "Cash access select cash_helper_batches" ON public.cash_helper_batches
    FOR SELECT TO authenticated USING (public.fn_can_manage_cash(auth.uid()));

DROP POLICY IF EXISTS "Cash access select cash_prepared_sets" ON public.cash_prepared_sets;
CREATE POLICY "Cash access select cash_prepared_sets" ON public.cash_prepared_sets
    FOR SELECT TO authenticated USING (public.fn_can_manage_cash(auth.uid()));

DROP POLICY IF EXISTS "Cash access select cash_movements" ON public.cash_movements;
CREATE POLICY "Cash access select cash_movements" ON public.cash_movements
    FOR SELECT TO authenticated USING (public.fn_can_manage_cash(auth.uid()));

DROP POLICY IF EXISTS "Idempotency select owner" ON public.inventory_idempotency_records;
CREATE POLICY "Idempotency select owner" ON public.inventory_idempotency_records
    FOR SELECT TO authenticated USING (actor_auth_user_id = auth.uid());

-- 5. UNIFIED TRANSACTIONAL COMMAND DISPATCHER (warehouse_dispatch)

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
    v_rec_actor UUID;
    v_rec_action TEXT;
    v_rec_hash TEXT;
    v_rec_resp JSONB;
    v_result JSONB;
    
    -- Variables for action handlers
    v_cat_id UUID;
    v_item_id UUID;
    v_unit_code TEXT;
    v_doc_id UUID;
    v_doc_no TEXT;
    v_move_id UUID;
    v_round_id UUID;
    v_batch_id UUID;
    v_batch_code TEXT;
    v_project_id TEXT;
    v_recipient_name TEXT;
    v_recipient_id UUID;
    v_item RECORD;
    v_unit RECORD;
    v_src_move RECORD;
    v_status TEXT;
    v_stock NUMERIC;
    v_delta NUMERIC;
    v_issued_qty NUMERIC;
    v_returned_qty NUMERIC;
    v_cum_returned NUMERIC;
    v_recovered_qty NUMERIC;
    v_good_qty NUMERIC;
    v_damaged_qty NUMERIC;
    v_recovery RECORD;
    v_custody RECORD;
    v_denom INT;
    v_note_count INT;
    v_vault RECORD;
    v_job_res RECORD;
    v_batch RECORD;
    v_prep RECORD;
    v_use_res BOOLEAN;
    v_keep_res BOOLEAN;
    v_pid_elem TEXT;
    v_arr_elem JSONB;
    v_movements_json JSONB := '[]'::jsonb;
    v_recoveries_json JSONB := '[]'::jsonb;
    v_units_json JSONB := '[]'::jsonb;
    v_is_cash_action BOOLEAN;
    v_sorted_item_ids UUID[];
    v_sorted_src_move_ids UUID[];
    v_sorted_units TEXT[];
    v_tool_count INT := 0;
    v_remaining_tools INT := 0;
    v_bool BOOLEAN;
BEGIN
    -- 1. Validate Non-null Idempotency Key
    IF p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'Idempotency key (UUID) is strictly required for mutating operations';
    END IF;

    -- 2. Serialize via Transactional Advisory Lock on Idempotency Key
    PERFORM pg_advisory_xact_lock(hashtext(p_idempotency_key::text));

    -- 3. Derive and verify authenticated caller
    v_auth_uid := auth.uid();
    IF v_auth_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required to execute warehouse actions';
    END IF;

    -- Lookup staff display name & verify active staff
    SELECT coalesce(full_name, username) INTO v_actor_name
    FROM public.staff_users
    WHERE auth_user_id = v_auth_uid AND is_active = TRUE
    LIMIT 1;

    IF v_actor_name IS NULL THEN
        RAISE EXCEPTION 'Staff mapping not found or staff account is inactive. Fail closed.';
    END IF;

    -- 4. Check action permissions
    v_is_cash_action := p_action LIKE 'cash_%';
    IF v_is_cash_action THEN
        IF NOT public.fn_can_manage_cash(v_auth_uid) THEN
            RAISE EXCEPTION 'Unauthorized: Cash management permissions required for %', p_action;
        END IF;
    ELSE
        IF NOT public.fn_can_access_inventory(v_auth_uid) THEN
            RAISE EXCEPTION 'Unauthorized: Inventory access permissions required for %', p_action;
        END IF;
    END IF;

    -- 5. Idempotency Check
    v_payload_hash := public.fn_hash_action_payload(p_action, p_payload);
    SELECT actor_auth_user_id, action_name, payload_hash, response_payload
    INTO v_rec_actor, v_rec_action, v_rec_hash, v_rec_resp
    FROM public.inventory_idempotency_records
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
        IF v_rec_action = p_action AND v_rec_hash = v_payload_hash AND v_rec_actor = v_auth_uid THEN
            RETURN v_rec_resp;
        ELSE
            RAISE EXCEPTION 'Idempotency key % reused with mismatched action, payload or actor', p_idempotency_key;
        END IF;
    END IF;

    -- 6. Action Execution
    CASE p_action

        -- -------------------------------------------------------------
        -- 6.1 ATOMIC MIXED ISSUE (Cart with consumables/reusables AND tools)
        -- -------------------------------------------------------------
        WHEN 'issue_create' THEN
            v_recipient_name := trim(coalesce(p_payload->>'recipient_name', ''));
            IF v_recipient_name = '' THEN
                RAISE EXCEPTION 'Recipient name is required for issue';
            END IF;
            v_recipient_id := (p_payload->>'recipient_id')::uuid;

            -- Validate issue_type whitelist
            IF p_payload->>'issue_type' NOT IN ('PRODUCTION_ISSUE', 'FIELD_ISSUE') THEN
                RAISE EXCEPTION 'Invalid issue_type: % (must be PRODUCTION_ISSUE or FIELD_ISSUE)', p_payload->>'issue_type';
            END IF;

            IF p_payload->>'issue_type' = 'FIELD_ISSUE' THEN
                v_round_id := (p_payload->>'round_id')::uuid;
                IF v_round_id IS NULL THEN
                    IF trim(coalesce(p_payload->>'round_code', '')) = '' THEN
                        RAISE EXCEPTION 'Round code is required for new field round';
                    END IF;

                    INSERT INTO public.inventory_field_rounds (
                        round_code, title, recipient_id, recipient_name_snapshot,
                        team_members_snapshot, expected_return_at, notes, created_by_auth_user_id
                    ) VALUES (
                        trim(p_payload->>'round_code'),
                        trim(coalesce(p_payload->>'round_title', 'Field Round ' || (p_payload->>'round_code'))),
                        v_recipient_id,
                        v_recipient_name,
                        coalesce((SELECT array_agg(trim(x)) FROM jsonb_array_elements_text(p_payload->'team_members') t(x) WHERE trim(x) != ''), '{}'),
                        coalesce((p_payload->>'expected_return_at')::timestamptz, (p_payload->>'due_date')::timestamptz),
                        p_payload->>'notes',
                        v_auth_uid
                    ) RETURNING id INTO v_round_id;

                    IF p_payload ? 'project_ids' THEN
                        FOR v_pid_elem IN SELECT jsonb_array_elements_text(p_payload->'project_ids')
                        LOOP
                            IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = v_pid_elem) THEN
                                RAISE EXCEPTION 'Project % does not exist', v_pid_elem;
                            END IF;
                            INSERT INTO public.inventory_field_round_projects (round_id, project_id)
                            VALUES (v_round_id, v_pid_elem)
                            ON CONFLICT DO NOTHING;
                        END LOOP;
                    END IF;
                END IF;

                v_doc_no := 'FLD-ISS-' || to_char(now(), 'YYYYMMDD-HH24MISS-') || substring(gen_random_uuid()::text, 1, 4);
                INSERT INTO public.inventory_documents (
                    doc_number, doc_type, round_id, recipient_id, recipient_name_snapshot,
                    team_members_snapshot, idempotency_key, idempotency_payload_hash, notes,
                    actor_auth_user_id, actor_name_snapshot
                ) VALUES (
                    v_doc_no, 'FIELD_ISSUE', v_round_id, v_recipient_id, v_recipient_name,
                    coalesce((SELECT array_agg(trim(x)) FROM jsonb_array_elements_text(p_payload->'team_members') t(x) WHERE trim(x) != ''), '{}'),
                    p_idempotency_key, v_payload_hash, p_payload->>'notes', v_auth_uid, v_actor_name
                ) RETURNING id INTO v_doc_id;

            ELSE
                v_project_id := p_payload->>'project_id';
                IF v_project_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.projects WHERE id = v_project_id) THEN
                    RAISE EXCEPTION 'Valid project_id is required for production issue';
                END IF;

                v_doc_no := 'PRD-ISS-' || to_char(now(), 'YYYYMMDD-HH24MISS-') || substring(gen_random_uuid()::text, 1, 4);
                INSERT INTO public.inventory_documents (
                    doc_number, doc_type, project_id, recipient_id, recipient_name_snapshot,
                    idempotency_key, idempotency_payload_hash, notes, actor_auth_user_id, actor_name_snapshot
                ) VALUES (
                    v_doc_no, 'PRODUCTION_ISSUE', v_project_id, v_recipient_id, v_recipient_name,
                    p_idempotency_key, v_payload_hash, p_payload->>'notes', v_auth_uid, v_actor_name
                ) RETURNING id INTO v_doc_id;
            END IF;

            -- Validate at least one material line or tool unit
            IF (NOT p_payload ? 'material_lines' OR jsonb_array_length(p_payload->'material_lines') = 0)
               AND (NOT p_payload ? 'tool_units' OR jsonb_array_length(p_payload->'tool_units') = 0) THEN
                RAISE EXCEPTION 'Issue must contain at least one material line or tool unit';
            END IF;

            -- Process Material Lines with Deterministic Locking (sort item_id to prevent deadlocks)
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
                    v_stock := v_status::numeric;
                    IF v_stock <= 0 THEN
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

                    IF v_item.current_stock < v_stock THEN
                        RAISE EXCEPTION 'Insufficient stock for item % (Requested: %, Available: %)',
                            v_item_id, v_stock, v_item.current_stock;
                    END IF;

                    UPDATE public.inventory_items
                    SET current_stock = current_stock - v_stock,
                        updated_at = timezone('utc'::text, now())
                    WHERE id = v_item_id;

                    INSERT INTO public.inventory_movements (
                        document_id, item_id, movement_type, quantity, delta_stock,
                        source_item_variant_snapshot, actor_auth_user_id, actor_name_snapshot
                    ) VALUES (
                        v_doc_id, v_item_id, 'ISSUE', v_stock, -v_stock,
                        jsonb_build_object('name', v_item.name, 'color', v_item.color, 'size', v_item.size, 'unit', v_item.unit),
                        v_auth_uid, v_actor_name
                    ) RETURNING id INTO v_move_id;

                    v_movements_json := v_movements_json || jsonb_build_object('id', v_move_id, 'item_id', v_item_id, 'quantity', v_stock);
                END LOOP;
            END IF;

            -- Process Tool Units with Deterministic Locking (sort unit_code)
            IF p_payload ? 'tool_units' AND jsonb_array_length(p_payload->'tool_units') > 0 THEN
                SELECT array_agg(elem ORDER BY elem)
                INTO v_sorted_units
                FROM jsonb_array_elements_text(p_payload->'tool_units') elem;

                IF (SELECT count(DISTINCT x) FROM unnest(v_sorted_units) x) < array_length(v_sorted_units, 1) THEN
                    RAISE EXCEPTION 'Duplicate tool unit entries in issue cart are rejected';
                END IF;

                FOREACH v_unit_code IN ARRAY v_sorted_units
                LOOP
                    SELECT u.unit_code, u.status, u.item_id, i.item_type, i.is_active INTO v_unit
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

                    IF EXISTS (SELECT 1 FROM public.asset_unit_custody WHERE unit_code = v_unit_code AND is_active = true) THEN
                        RAISE EXCEPTION 'Unit % already has active custody', v_unit_code;
                    END IF;

                    UPDATE public.asset_units
                    SET status = 'BORROWED',
                        borrowed_by = v_recipient_name,
                        borrowed_at = timezone('utc'::text, now()),
                        project_id = v_project_id,
                        updated_at = timezone('utc'::text, now())
                    WHERE unit_code = v_unit_code;

                    INSERT INTO public.asset_unit_custody (
                        unit_code, document_id, project_id, round_id, recipient_id,
                        recipient_name_snapshot, borrowed_at, due_date, is_active, notes
                    ) VALUES (
                        v_unit_code, v_doc_id, v_project_id, v_round_id, v_recipient_id,
                        v_recipient_name, timezone('utc'::text, now()),
                        (p_payload->>'due_date')::timestamptz, true, p_payload->>'notes'
                    ) RETURNING id INTO v_cat_id;

                    v_units_json := v_units_json || jsonb_build_object('unit_code', v_unit_code, 'custody_id', v_cat_id);
                END LOOP;
            END IF;

            v_result := jsonb_build_object(
                'success', true,
                'data', jsonb_build_object(
                    'document_id', v_doc_id,
                    'doc_number', v_doc_no,
                    'round_id', v_round_id,
                    'material_movements', v_movements_json,
                    'tool_custodies', v_units_json
                )
            );

        WHEN 'material_issue' THEN
            v_result := public.warehouse_dispatch('issue_create', p_payload || '{"issue_type": "PRODUCTION_ISSUE"}'::jsonb, p_idempotency_key);

        -- -------------------------------------------------------------
        -- 6.2 Material Returns (Unused)
        -- -------------------------------------------------------------
        WHEN 'material_return_unused' THEN
            IF NOT p_payload ? 'items' OR jsonb_array_length(p_payload->'items') = 0 THEN
                RAISE EXCEPTION 'Return items list cannot be empty';
            END IF;

            FOR v_arr_elem IN SELECT * FROM jsonb_array_elements(p_payload->'items')
            LOOP
                IF v_arr_elem->>'source_issue_movement_id' IS NULL OR trim(v_arr_elem->>'source_issue_movement_id') = '' THEN
                    RAISE EXCEPTION 'source_issue_movement_id is strictly required for unused return';
                END IF;
            END LOOP;

            -- Check for duplicate source movement IDs
            SELECT array_agg((elem->>'source_issue_movement_id')::uuid ORDER BY (elem->>'source_issue_movement_id')::uuid)
            INTO v_sorted_src_move_ids
            FROM jsonb_array_elements(p_payload->'items') elem;

            IF (SELECT count(DISTINCT x) FROM unnest(v_sorted_src_move_ids) x) < array_length(v_sorted_src_move_ids, 1) THEN
                RAISE EXCEPTION 'Duplicate source movement entries in return are rejected';
            END IF;

            v_doc_no := 'RET-' || to_char(now(), 'YYYYMMDD-HH24MISS-') || substring(gen_random_uuid()::text, 1, 4);

            INSERT INTO public.inventory_documents (
                doc_number, doc_type, project_id, recipient_name_snapshot,
                idempotency_key, idempotency_payload_hash, notes, actor_auth_user_id, actor_name_snapshot
            ) VALUES (
                v_doc_no, 'RETURN_UNUSED', p_payload->>'project_id', coalesce(p_payload->>'recipient_name', 'Shop Return'),
                p_idempotency_key, v_payload_hash, p_payload->>'notes', v_auth_uid, v_actor_name
            ) RETURNING id INTO v_doc_id;

            FOREACH v_move_id IN ARRAY v_sorted_src_move_ids
            LOOP
                SELECT (elem->>'quantity') INTO v_status
                FROM jsonb_array_elements(p_payload->'items') elem
                WHERE (elem->>'source_issue_movement_id')::uuid = v_move_id;

                IF v_status IS NULL OR v_status ~ '^[0-9]+(\.[0-9]+)?$' = FALSE THEN
                    RAISE EXCEPTION 'Return quantity must be finite positive number';
                END IF;
                v_returned_qty := v_status::numeric;
                IF v_returned_qty <= 0 THEN
                    RAISE EXCEPTION 'Return quantity must be strictly greater than 0';
                END IF;

                -- Lock source issue movement row FOR UPDATE
                SELECT m.id, m.item_id, m.quantity, d.project_id, d.round_id INTO v_src_move
                FROM public.inventory_movements m
                JOIN public.inventory_documents d ON m.document_id = d.id
                WHERE m.id = v_move_id AND m.movement_type = 'ISSUE'
                FOR UPDATE;

                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Source issue movement % not found or is not an ISSUE', v_move_id;
                END IF;

                -- Check context match if provided
                IF p_payload->>'project_id' IS NOT NULL AND v_src_move.project_id IS NOT NULL AND v_src_move.project_id != p_payload->>'project_id' THEN
                    RAISE EXCEPTION 'Return project context does not match source issue project';
                END IF;

                -- Calculate cumulative returns + recoveries across all statuses
                SELECT coalesce(sum(quantity), 0) INTO v_cum_returned
                FROM public.inventory_movements
                WHERE source_issue_movement_id = v_move_id AND movement_type = 'RETURN_UNUSED';

                SELECT v_cum_returned + coalesce(sum(recovered_qty), 0) INTO v_cum_returned
                FROM public.inventory_material_recoveries
                WHERE source_issue_movement_id = v_move_id;

                IF (v_cum_returned + v_returned_qty) > v_src_move.quantity THEN
                    RAISE EXCEPTION 'Cumulative return quantity (%) exceeds issued quantity (%)',
                        (v_cum_returned + v_returned_qty), v_src_move.quantity;
                END IF;

                UPDATE public.inventory_items
                SET current_stock = current_stock + v_returned_qty,
                    updated_at = timezone('utc'::text, now())
                WHERE id = v_src_move.item_id;

                INSERT INTO public.inventory_movements (
                    document_id, item_id, movement_type, quantity, delta_stock,
                    source_issue_movement_id, actor_auth_user_id, actor_name_snapshot
                ) VALUES (
                    v_doc_id, v_src_move.item_id, 'RETURN_UNUSED', v_returned_qty, v_returned_qty,
                    v_move_id, v_auth_uid, v_actor_name
                );
            END LOOP;

            v_result := jsonb_build_object('success', true, 'data', jsonb_build_object('document_id', v_doc_id, 'doc_number', v_doc_no));

        -- -------------------------------------------------------------
        -- 6.3 Material Recoveries (Reusable materials only)
        -- -------------------------------------------------------------
        WHEN 'material_recovery' THEN
            IF NOT p_payload ? 'items' OR jsonb_array_length(p_payload->'items') = 0 THEN
                RAISE EXCEPTION 'Recovery items list cannot be empty';
            END IF;

            FOR v_arr_elem IN SELECT * FROM jsonb_array_elements(p_payload->'items')
            LOOP
                IF v_arr_elem->>'source_issue_movement_id' IS NULL OR trim(v_arr_elem->>'source_issue_movement_id') = '' THEN
                    RAISE EXCEPTION 'source_issue_movement_id is strictly required for material recovery';
                END IF;
            END LOOP;

            SELECT array_agg((elem->>'source_issue_movement_id')::uuid ORDER BY (elem->>'source_issue_movement_id')::uuid)
            INTO v_sorted_src_move_ids
            FROM jsonb_array_elements(p_payload->'items') elem;

            IF (SELECT count(DISTINCT x) FROM unnest(v_sorted_src_move_ids) x) < array_length(v_sorted_src_move_ids, 1) THEN
                RAISE EXCEPTION 'Duplicate source movement entries in recovery are rejected';
            END IF;

            v_doc_no := 'RCV-' || to_char(now(), 'YYYYMMDD-HH24MISS-') || substring(gen_random_uuid()::text, 1, 4);

            INSERT INTO public.inventory_documents (
                doc_number, doc_type, project_id, recipient_name_snapshot,
                idempotency_key, idempotency_payload_hash, notes, actor_auth_user_id, actor_name_snapshot
            ) VALUES (
                v_doc_no, 'RECOVERY', p_payload->>'project_id', coalesce(p_payload->>'recipient_name', 'Recovery Team'),
                p_idempotency_key, v_payload_hash, p_payload->>'notes', v_auth_uid, v_actor_name
            ) RETURNING id INTO v_doc_id;

            FOREACH v_move_id IN ARRAY v_sorted_src_move_ids
            LOOP
                IF v_move_id IS NULL THEN
                    RAISE EXCEPTION 'source_issue_movement_id is strictly required for material recovery';
                END IF;

                SELECT elem INTO v_arr_elem
                FROM jsonb_array_elements(p_payload->'items') elem
                WHERE (elem->>'source_issue_movement_id')::uuid = v_move_id;

                IF (v_arr_elem->>'recovered_qty') ~ '^[0-9]+(\.[0-9]+)?$' = FALSE THEN
                    RAISE EXCEPTION 'Recovered quantity must be finite positive number';
                END IF;
                v_recovered_qty := (v_arr_elem->>'recovered_qty')::numeric;
                IF v_recovered_qty <= 0 THEN
                    RAISE EXCEPTION 'Recovered quantity must be strictly greater than 0';
                END IF;

                -- Lock source issue movement row
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

                IF v_arr_elem ? 'item_id' AND (v_arr_elem->>'item_id')::uuid != v_src_move.item_id THEN
                    RAISE EXCEPTION 'Item ID does not match source issue item';
                END IF;

                -- Item must be reusable
                SELECT item_type INTO v_status FROM public.inventory_items WHERE id = v_src_move.item_id;
                IF lower(v_status) NOT IN ('reusable', 'reusable_material') THEN
                    RAISE EXCEPTION 'Only reusable materials can be recovered (item % is %)', v_src_move.item_id, v_status;
                END IF;

                -- Cumulative returns + recoveries cap
                SELECT coalesce(sum(quantity), 0) INTO v_cum_returned
                FROM public.inventory_movements
                WHERE source_issue_movement_id = v_move_id AND movement_type = 'RETURN_UNUSED';

                SELECT v_cum_returned + coalesce(sum(recovered_qty), 0) INTO v_cum_returned
                FROM public.inventory_material_recoveries
                WHERE source_issue_movement_id = v_move_id;

                IF (v_cum_returned + v_recovered_qty) > v_src_move.quantity THEN
                    RAISE EXCEPTION 'Cumulative recovery quantity exceeds issued quantity';
                END IF;

                IF coalesce((v_arr_elem->>'inspect_now')::boolean, false) THEN
                    v_good_qty := coalesce((v_arr_elem->>'good_qty')::numeric, 0);
                    v_damaged_qty := coalesce((v_arr_elem->>'damaged_qty')::numeric, 0);

                    IF v_good_qty < 0 OR v_damaged_qty < 0 THEN
                        RAISE EXCEPTION 'Good and damaged quantities must be non-negative';
                    END IF;
                    IF (v_good_qty + v_damaged_qty) != v_recovered_qty THEN
                        RAISE EXCEPTION 'Good quantity (%) + Damaged quantity (%) must equal recovered quantity (%)',
                            v_good_qty, v_damaged_qty, v_recovered_qty;
                    END IF;

                    IF v_good_qty > 0 THEN
                        UPDATE public.inventory_items
                        SET current_stock = current_stock + v_good_qty,
                            updated_at = timezone('utc'::text, now())
                        WHERE id = v_src_move.item_id;

                        INSERT INTO public.inventory_movements (
                            document_id, item_id, movement_type, quantity, delta_stock,
                            source_issue_movement_id, notes, actor_auth_user_id, actor_name_snapshot
                        ) VALUES (
                            v_doc_id, v_src_move.item_id, 'RECOVERY_INSPECTED', v_good_qty, v_good_qty,
                            v_move_id, 'Directly inspected good recovery', v_auth_uid, v_actor_name
                        );
                    END IF;

                    IF v_damaged_qty > 0 THEN
                        INSERT INTO public.inventory_movements (
                            document_id, item_id, movement_type, quantity, delta_stock,
                            source_issue_movement_id, notes, actor_auth_user_id, actor_name_snapshot
                        ) VALUES (
                            v_doc_id, v_src_move.item_id, 'INSPECTION_REJECT_DAMAGED', v_damaged_qty, 0,
                            v_move_id, 'Directly inspected damaged recovery', v_auth_uid, v_actor_name
                        );
                    END IF;

                    INSERT INTO public.inventory_material_recoveries (
                        document_id, item_id, source_issue_movement_id, recovered_qty,
                        status, inspected_good_qty, inspected_damaged_qty, inspected_at, inspected_by_auth_user_id
                    ) VALUES (
                        v_doc_id, v_src_move.item_id, v_move_id, v_recovered_qty,
                        'DIRECT_COMPLETED', v_good_qty, v_damaged_qty, timezone('utc'::text, now()), v_auth_uid
                    ) RETURNING id INTO v_cat_id;

                    v_recoveries_json := v_recoveries_json || jsonb_build_object('id', v_cat_id, 'status', 'DIRECT_COMPLETED');
                ELSE
                    INSERT INTO public.inventory_material_recoveries (
                        document_id, item_id, source_issue_movement_id, recovered_qty,
                        status, notes
                    ) VALUES (
                        v_doc_id, v_src_move.item_id, v_move_id, v_recovered_qty,
                        'PENDING', v_arr_elem->>'notes'
                    ) RETURNING id INTO v_cat_id;

                    INSERT INTO public.inventory_movements (
                        document_id, item_id, movement_type, quantity, delta_stock,
                        source_issue_movement_id, notes, actor_auth_user_id, actor_name_snapshot
                    ) VALUES (
                        v_doc_id, v_src_move.item_id, 'RECOVERY_PENDING', v_recovered_qty, 0,
                        v_move_id, 'Pending warehouse sorting/inspection', v_auth_uid, v_actor_name
                    );

                    v_recoveries_json := v_recoveries_json || jsonb_build_object('id', v_cat_id, 'status', 'PENDING');
                END IF;
            END LOOP;

            v_result := jsonb_build_object(
                'success', true,
                'data', jsonb_build_object('document_id', v_doc_id, 'doc_number', v_doc_no, 'recoveries', v_recoveries_json)
            );

        -- -------------------------------------------------------------
        -- 6.4 Material Inspection
        -- -------------------------------------------------------------
        WHEN 'material_inspect_recovery' THEN
            v_cat_id := (p_payload->>'recovery_id')::uuid;
            IF (p_payload->>'good_qty') ~ '^[0-9]+(\.[0-9]+)?$' = FALSE THEN
                RAISE EXCEPTION 'good_qty must be finite non-negative number';
            END IF;
            v_good_qty := (p_payload->>'good_qty')::numeric;
            v_damaged_qty := coalesce((p_payload->>'damaged_qty')::numeric, 0);

            IF v_good_qty < 0 OR v_damaged_qty < 0 THEN
                RAISE EXCEPTION 'Good and damaged quantities must be non-negative';
            END IF;

            SELECT * INTO v_recovery
            FROM public.inventory_material_recoveries
            WHERE id = v_cat_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Recovery record % not found', v_cat_id;
            END IF;

            IF v_recovery.status != 'PENDING' THEN
                RAISE EXCEPTION 'Recovery record % is already inspected (status: %)', v_cat_id, v_recovery.status;
            END IF;

            IF (v_good_qty + v_damaged_qty) != v_recovery.recovered_qty THEN
                RAISE EXCEPTION 'Good quantity (%) + Damaged quantity (%) must equal total recovered quantity (%)',
                    v_good_qty, v_damaged_qty, v_recovery.recovered_qty;
            END IF;

            UPDATE public.inventory_material_recoveries
            SET status = 'INSPECTED',
                inspected_good_qty = v_good_qty,
                inspected_damaged_qty = v_damaged_qty,
                inspected_at = timezone('utc'::text, now()),
                inspected_by_auth_user_id = v_auth_uid
            WHERE id = v_cat_id;

            IF v_good_qty > 0 THEN
                UPDATE public.inventory_items
                SET current_stock = current_stock + v_good_qty,
                    updated_at = timezone('utc'::text, now())
                WHERE id = v_recovery.item_id;

                INSERT INTO public.inventory_movements (
                    document_id, item_id, movement_type, quantity, delta_stock,
                    source_issue_movement_id, notes, actor_auth_user_id, actor_name_snapshot
                ) VALUES (
                    v_recovery.document_id, v_recovery.item_id, 'INSPECTION_ACCEPT', v_good_qty, v_good_qty,
                    v_recovery.source_issue_movement_id, 'Inspection accepted good quantity', v_auth_uid, v_actor_name
                );
            END IF;

            IF v_damaged_qty > 0 THEN
                INSERT INTO public.inventory_movements (
                    document_id, item_id, movement_type, quantity, delta_stock,
                    source_issue_movement_id, notes, actor_auth_user_id, actor_name_snapshot
                ) VALUES (
                    v_recovery.document_id, v_recovery.item_id, 'INSPECTION_REJECT_DAMAGED', v_damaged_qty, 0,
                    v_recovery.source_issue_movement_id, 'Damaged quantity isolated', v_auth_uid, v_actor_name
                );
            END IF;

            v_result := jsonb_build_object(
                'success', true,
                'data', jsonb_build_object('recovery_id', v_cat_id, 'good_qty', v_good_qty, 'damaged_qty', v_damaged_qty)
            );

        -- -------------------------------------------------------------
        -- 6.5 Tool Borrow & Handover
        -- -------------------------------------------------------------
        WHEN 'tool_borrow' THEN
            v_result := public.warehouse_dispatch('issue_create', p_payload || '{"issue_type": "PRODUCTION_ISSUE"}'::jsonb, p_idempotency_key);

        WHEN 'tool_handover' THEN
            v_recipient_name := trim(coalesce(p_payload->>'to_recipient_name', ''));
            v_recipient_id := (p_payload->>'to_recipient_id')::uuid;

            IF v_recipient_name = '' THEN
                RAISE EXCEPTION 'Target recipient name is required for tool handover';
            END IF;

            IF NOT coalesce((p_payload->>'accepted')::boolean, false) THEN
                RAISE EXCEPTION 'Handover must be explicitly accepted by the receiver';
            END IF;

            FOR v_unit_code IN SELECT jsonb_array_elements_text(p_payload->'unit_codes')
            LOOP
                SELECT * INTO v_custody
                FROM public.asset_unit_custody
                WHERE unit_code = v_unit_code AND is_active = true
                FOR UPDATE;

                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Active custody for unit % not found', v_unit_code;
                END IF;

                UPDATE public.asset_unit_custody
                SET is_active = false,
                    returned_at = timezone('utc'::text, now()),
                    return_status = 'AVAILABLE',
                    notes = coalesce(notes, '') || ' Handed over to ' || v_recipient_name
                WHERE id = v_custody.id;

                INSERT INTO public.asset_unit_custody (
                    unit_code, project_id, round_id, recipient_id, recipient_name_snapshot,
                    borrowed_at, due_date, is_active, notes
                ) VALUES (
                    v_unit_code, v_custody.project_id, v_custody.round_id, v_recipient_id,
                    v_recipient_name, timezone('utc'::text, now()), v_custody.due_date,
                    true, p_payload->>'notes'
                ) RETURNING id INTO v_cat_id;

                UPDATE public.asset_unit_custody
                SET handed_over_to_custody_id = v_cat_id
                WHERE id = v_custody.id;

                UPDATE public.asset_units
                SET borrowed_by = v_recipient_name,
                    updated_at = timezone('utc'::text, now())
                WHERE unit_code = v_unit_code;
            END LOOP;

            v_result := jsonb_build_object('success', true, 'data', jsonb_build_object('status', 'TRANSFERRED'));

        -- -------------------------------------------------------------
        -- 6.6 Tool Return & Round Status Recomputation
        -- -------------------------------------------------------------
        WHEN 'tool_return' THEN
            FOR v_arr_elem IN SELECT * FROM jsonb_array_elements(p_payload->'returns')
            LOOP
                v_unit_code := v_arr_elem->>'unit_code';
                v_status := lower(coalesce(v_arr_elem->>'condition', 'good'));

                SELECT unit_code, status INTO v_unit
                FROM public.asset_units
                WHERE unit_code = v_unit_code
                FOR UPDATE;

                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Unit % not found', v_unit_code;
                END IF;

                SELECT * INTO v_custody
                FROM public.asset_unit_custody
                WHERE unit_code = v_unit_code AND is_active = true
                FOR UPDATE;

                IF v_status = 'good' THEN
                    UPDATE public.asset_units
                    SET status = 'AVAILABLE',
                        borrowed_by = NULL,
                        borrowed_at = NULL,
                        project_id = NULL,
                        updated_at = timezone('utc'::text, now())
                    WHERE unit_code = v_unit_code;

                    IF v_custody.id IS NOT NULL THEN
                        UPDATE public.asset_unit_custody
                        SET is_active = false,
                            returned_at = timezone('utc'::text, now()),
                            return_status = 'AVAILABLE',
                            notes = v_arr_elem->>'notes'
                        WHERE id = v_custody.id;
                    END IF;

                ELSIF v_status = 'broken' THEN
                    UPDATE public.asset_units
                    SET status = 'BROKEN',
                        updated_at = timezone('utc'::text, now())
                    WHERE unit_code = v_unit_code;

                    IF v_custody.id IS NOT NULL THEN
                        UPDATE public.asset_unit_custody
                        SET is_active = false,
                            returned_at = timezone('utc'::text, now()),
                            return_status = 'BROKEN',
                            notes = v_arr_elem->>'notes'
                        WHERE id = v_custody.id;
                    END IF;

                    INSERT INTO public.inventory_incidents (
                        unit_code, incident_type, custody_id, responsible_recipient_id,
                        recipient_name_snapshot, round_id, notes, reporter_auth_user_id
                    ) VALUES (
                        v_unit_code, 'BROKEN', v_custody.id, v_custody.recipient_id,
                        v_custody.recipient_name_snapshot, v_custody.round_id,
                        v_arr_elem->>'notes', v_auth_uid
                    );

                ELSIF v_status = 'missing' THEN
                    UPDATE public.asset_units
                    SET status = 'LOST',
                        updated_at = timezone('utc'::text, now())
                    WHERE unit_code = v_unit_code;

                    IF v_custody.id IS NOT NULL THEN
                        UPDATE public.asset_unit_custody
                        SET is_active = false,
                            returned_at = timezone('utc'::text, now()),
                            return_status = 'LOST',
                            notes = v_arr_elem->>'notes'
                        WHERE id = v_custody.id;
                    END IF;

                    INSERT INTO public.inventory_incidents (
                        unit_code, incident_type, custody_id, responsible_recipient_id,
                        recipient_name_snapshot, round_id, notes, reporter_auth_user_id
                    ) VALUES (
                        v_unit_code, 'LOST', v_custody.id, v_custody.recipient_id,
                        v_custody.recipient_name_snapshot, v_custody.round_id,
                        v_arr_elem->>'notes', v_auth_uid
                    );
                END IF;

                -- Recompute Field Round Status if custody belongs to a round
                IF v_custody.round_id IS NOT NULL THEN
                    SELECT count(*) INTO v_remaining_tools
                    FROM public.asset_unit_custody
                    WHERE round_id = v_custody.round_id AND is_active = true;

                    SELECT count(*) INTO v_tool_count
                    FROM public.asset_unit_custody
                    WHERE round_id = v_custody.round_id;

                    UPDATE public.inventory_field_rounds
                    SET status = CASE
                            WHEN v_remaining_tools = 0 THEN 'RETURNED'
                            WHEN v_remaining_tools < v_tool_count THEN 'PARTIAL_RETURNED'
                            ELSE 'IN_PROGRESS'
                        END,
                        updated_at = timezone('utc'::text, now())
                    WHERE id = v_custody.round_id;
                END IF;
            END LOOP;

            v_result := jsonb_build_object('success', true, 'data', jsonb_build_object('status', 'PROCESSED'));

        -- -------------------------------------------------------------
        -- 6.7 Tool Legacy Adoption or Return
        -- -------------------------------------------------------------
        WHEN 'tool_legacy_adopt_or_return' THEN
            v_unit_code := p_payload->>'unit_code';
            v_status := lower(p_payload->>'action');

            SELECT * INTO v_unit FROM public.asset_units WHERE unit_code = v_unit_code FOR UPDATE;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Legacy unit % not found', v_unit_code;
            END IF;

            IF v_status = 'return_available' THEN
                UPDATE public.asset_units
                SET status = 'AVAILABLE', borrowed_by = NULL, borrowed_at = NULL, project_id = NULL, updated_at = timezone('utc'::text, now())
                WHERE unit_code = v_unit_code;
            ELSIF v_status = 'adopt_custody' THEN
                INSERT INTO public.asset_unit_custody (
                    unit_code, project_id, recipient_name_snapshot, borrowed_at, is_active, notes
                ) VALUES (
                    v_unit_code, v_unit.project_id, coalesce(v_unit.borrowed_by, 'Legacy Custody'),
                    coalesce(v_unit.borrowed_at, timezone('utc'::text, now())), true, 'Adopted legacy custody into Plan C'
                );
            ELSE
                RAISE EXCEPTION 'Invalid legacy action: % (must be return_available or adopt_custody)', v_status;
            END IF;

            v_result := jsonb_build_object('success', true, 'data', jsonb_build_object('unit_code', v_unit_code, 'action', v_status));

        -- -------------------------------------------------------------
        -- 6.8 Items & Categories Metadata CRUD
        -- -------------------------------------------------------------
        WHEN 'category_create' THEN
            IF trim(coalesce(p_payload->>'name', '')) = '' THEN
                RAISE EXCEPTION 'Category name cannot be empty';
            END IF;

            INSERT INTO public.inventory_categories (name, type, is_active)
            VALUES (
                trim(p_payload->>'name'),
                coalesce(p_payload->>'type', 'consumable'),
                coalesce((p_payload->>'is_active')::boolean, true)
            )
            RETURNING id INTO v_cat_id;

            v_result := jsonb_build_object('success', true, 'data', jsonb_build_object('id', v_cat_id, 'name', trim(p_payload->>'name')));

        WHEN 'category_rename' THEN
            v_cat_id := (p_payload->>'id')::uuid;
            IF trim(coalesce(p_payload->>'name', '')) = '' THEN
                RAISE EXCEPTION 'Category name cannot be empty';
            END IF;

            UPDATE public.inventory_categories
            SET name = trim(p_payload->>'name')
            WHERE id = v_cat_id;

            v_result := jsonb_build_object('success', true, 'data', jsonb_build_object('id', v_cat_id));

        WHEN 'category_retire' THEN
            v_cat_id := (p_payload->>'id')::uuid;
            UPDATE public.inventory_categories
            SET is_active = coalesce((p_payload->>'is_active')::boolean, false)
            WHERE id = v_cat_id;

            v_result := jsonb_build_object('success', true, 'data', jsonb_build_object('id', v_cat_id));

        WHEN 'item_create' THEN
            IF trim(coalesce(p_payload->>'name', '')) = '' THEN
                RAISE EXCEPTION 'Item name cannot be empty';
            END IF;

            IF p_payload ? 'unit' AND trim(p_payload->>'unit') = '' THEN
                RAISE EXCEPTION 'Item unit cannot be empty';
            END IF;

            IF p_payload ? 'min_alert_threshold' AND (p_payload->>'min_alert_threshold') ~ '^[0-9]+(\.[0-9]+)?$' = FALSE THEN
                RAISE EXCEPTION 'min_alert_threshold must be a finite non-negative number';
            END IF;
            IF p_payload ? 'average_cost' AND (p_payload->>'average_cost') ~ '^[0-9]+(\.[0-9]+)?$' = FALSE THEN
                RAISE EXCEPTION 'average_cost must be a finite non-negative number';
            END IF;

            v_stock := coalesce((p_payload->>'initial_stock')::numeric, 0);
            IF v_stock < 0 THEN
                RAISE EXCEPTION 'Initial stock cannot be negative';
            END IF;

            v_status := lower(coalesce(p_payload->>'item_type', 'consumable'));
            IF v_stock > 0 AND v_status IN ('asset', 'banknote', 'task') THEN
                RAISE EXCEPTION 'Initial stock opening is forbidden for asset, banknote, or task items';
            END IF;

            IF p_payload ? 'category_id' AND (p_payload->>'category_id') IS NOT NULL THEN
                SELECT is_active INTO v_bool FROM public.inventory_categories WHERE id = (p_payload->>'category_id')::uuid;
                IF NOT FOUND OR NOT v_bool THEN
                    RAISE EXCEPTION 'Referenced category does not exist or is inactive';
                END IF;
            END IF;

            INSERT INTO public.inventory_items (
                code, name, category_id, item_type, unit, current_stock,
                min_alert_threshold, average_cost, storage_location, color, size, status, is_active
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
                true
            ) RETURNING id INTO v_item_id;

            IF v_stock > 0 THEN
                v_doc_no := 'OPN-' || to_char(now(), 'YYYYMMDD-') || substring(gen_random_uuid()::text, 1, 4);
                INSERT INTO public.inventory_documents (
                    doc_number, doc_type, recipient_name_snapshot, notes, actor_auth_user_id, actor_name_snapshot
                ) VALUES (
                    v_doc_no, 'OPENING_STOCK', 'System Initial Stock', coalesce(p_payload->>'opening_stock_reason', 'Item registration initial stock'),
                    v_auth_uid, v_actor_name
                ) RETURNING id INTO v_doc_id;

                INSERT INTO public.inventory_movements (
                    document_id, item_id, movement_type, quantity, delta_stock,
                    notes, actor_auth_user_id, actor_name_snapshot
                ) VALUES (
                    v_doc_id, v_item_id, 'OPENING_STOCK', v_stock, v_stock,
                    coalesce(p_payload->>'opening_stock_reason', 'Initial stock opening'), v_auth_uid, v_actor_name
                );
            END IF;

            v_result := jsonb_build_object('success', true, 'data', jsonb_build_object('id', v_item_id));

        WHEN 'item_save_metadata' THEN
            v_item_id := (p_payload->>'id')::uuid;

            IF p_payload ? 'name' AND trim(p_payload->>'name') = '' THEN
                RAISE EXCEPTION 'Item name cannot be empty';
            END IF;
            IF p_payload ? 'unit' AND trim(p_payload->>'unit') = '' THEN
                RAISE EXCEPTION 'Item unit cannot be empty';
            END IF;
            IF p_payload ? 'min_alert_threshold' AND (p_payload->>'min_alert_threshold') ~ '^[0-9]+(\.[0-9]+)?$' = FALSE THEN
                RAISE EXCEPTION 'min_alert_threshold must be a finite non-negative number';
            END IF;
            IF p_payload ? 'average_cost' AND (p_payload->>'average_cost') ~ '^[0-9]+(\.[0-9]+)?$' = FALSE THEN
                RAISE EXCEPTION 'average_cost must be a finite non-negative number';
            END IF;
            IF p_payload ? 'category_id' AND (p_payload->>'category_id') IS NOT NULL THEN
                SELECT is_active INTO v_bool FROM public.inventory_categories WHERE id = (p_payload->>'category_id')::uuid;
                IF NOT FOUND OR NOT v_bool THEN
                    RAISE EXCEPTION 'Referenced category does not exist or is inactive';
                END IF;
            END IF;

            SELECT * INTO v_item FROM public.inventory_items WHERE id = v_item_id FOR UPDATE;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Item with ID % not found', v_item_id;
            END IF;

            -- If item has history, block identity changes
            IF EXISTS (SELECT 1 FROM public.inventory_movements WHERE item_id = v_item_id)
               OR EXISTS (SELECT 1 FROM public.asset_units WHERE item_id = v_item_id) THEN
                IF (p_payload ? 'item_type' AND p_payload->>'item_type' != v_item.item_type)
                   OR (p_payload ? 'unit' AND p_payload->>'unit' != v_item.unit)
                   OR (p_payload ? 'color' AND p_payload->>'color' != coalesce(v_item.color, ''))
                   OR (p_payload ? 'size' AND p_payload->>'size' != coalesce(v_item.size, '')) THEN
                    RAISE EXCEPTION 'Cannot change item identity (type, unit, color, size) after transaction movements or asset units exist';
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
                updated_at = timezone('utc'::text, now())
            WHERE id = v_item_id;

            v_result := jsonb_build_object('success', true, 'data', jsonb_build_object('id', v_item_id));

        WHEN 'stock_adjust' THEN
            v_item_id := (p_payload->>'item_id')::uuid;
            IF (p_payload->>'delta_quantity') ~ '^-?[0-9]+(\.[0-9]+)?$' = FALSE THEN
                RAISE EXCEPTION 'delta_quantity must be a finite non-zero number';
            END IF;
            v_delta := (p_payload->>'delta_quantity')::numeric;

            IF v_delta IS NULL OR v_delta = 0 THEN
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

            INSERT INTO public.inventory_movements (
                document_id, item_id, movement_type, quantity, delta_stock,
                notes, actor_auth_user_id, actor_name_snapshot
            ) VALUES (
                v_doc_id, v_item_id, 'ADJUSTMENT', abs(v_delta), v_delta,
                p_payload->>'reason', v_auth_uid, v_actor_name
            );

            v_result := jsonb_build_object('success', true, 'data', jsonb_build_object('item_id', v_item_id, 'new_stock', (v_item.current_stock + v_delta)));

        WHEN 'unit_add' THEN
            v_item_id := (p_payload->>'item_id')::uuid;
            v_unit_code := trim(coalesce(p_payload->>'unit_code', ''));

            IF v_unit_code = '' THEN
                RAISE EXCEPTION 'Unit code is required';
            END IF;

            IF length(v_unit_code) > 64 THEN
                RAISE EXCEPTION 'Unit code exceeds maximum length of 64 characters';
            END IF;

            IF EXISTS (SELECT 1 FROM public.asset_units WHERE unit_code = v_unit_code) THEN
                RAISE EXCEPTION 'Unit code % already exists', v_unit_code;
            END IF;

            SELECT item_type, is_active INTO v_status, v_bool FROM public.inventory_items WHERE id = v_item_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Item % not found', v_item_id;
            END IF;
            IF lower(v_status) != 'asset' OR NOT v_bool THEN
                RAISE EXCEPTION 'Serialized units can only be added to an active item with item_type = "asset"';
            END IF;

            INSERT INTO public.asset_units (unit_code, item_id, status, notes)
            VALUES (v_unit_code, v_item_id, 'AVAILABLE', p_payload->>'notes');

            v_result := jsonb_build_object('success', true, 'data', jsonb_build_object('unit_code', v_unit_code));

        -- -------------------------------------------------------------
        -- 6.9 Recipient & Team Registry CRUD
        -- -------------------------------------------------------------
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
            IF p_payload ? 'name' AND trim(p_payload->>'name') = '' THEN
                RAISE EXCEPTION 'Recipient name cannot be empty';
            END IF;

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

            IF p_payload ? 'member_names' AND jsonb_array_length(p_payload->'member_names') > 0 THEN
                IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_payload->'member_names') m WHERE trim(m) = '') THEN
                    RAISE EXCEPTION 'Team member names cannot be empty';
                END IF;
            END IF;

            INSERT INTO public.inventory_recipients (name, recipient_type, is_active)
            VALUES (trim(p_payload->>'name'), 'team', true)
            RETURNING id INTO v_recipient_id;

            INSERT INTO public.inventory_recipient_teams (
                team_recipient_id, primary_receiver_name, member_names, is_active
            ) VALUES (
                v_recipient_id,
                trim(p_payload->>'primary_receiver_name'),
                coalesce((SELECT array_agg(trim(x)) FROM jsonb_array_elements_text(p_payload->'member_names') t(x) WHERE trim(x) != ''), '{}'),
                true
            ) RETURNING id INTO v_cat_id;

            v_result := jsonb_build_object('success', true, 'data', jsonb_build_object('team_id', v_cat_id, 'recipient_id', v_recipient_id));

        -- -------------------------------------------------------------
        -- 6.10 CASH VAULT OPERATIONS (Server-verified admin/accountant)
        -- -------------------------------------------------------------
        WHEN 'cash_counted_opening' THEN
            IF NOT p_payload ? 'counts' OR jsonb_array_length(p_payload->'counts') = 0 THEN
                RAISE EXCEPTION 'Opening counts array cannot be empty';
            END IF;

            -- Check duplicate denominations
            IF (SELECT count(DISTINCT (elem->>'denomination')::int) FROM jsonb_array_elements(p_payload->'counts') elem)
               < jsonb_array_length(p_payload->'counts') THEN
                RAISE EXCEPTION 'Duplicate denomination in opening counts is rejected';
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

                INSERT INTO public.cash_movements (
                    action_type, denomination, note_count, from_location, to_location,
                    actor_auth_user_id, actor_name_snapshot, notes, idempotency_key
                ) VALUES (
                    'COUNTED_OPENING', v_denom, v_note_count, 'INSPECTION', 'VAULT',
                    v_auth_uid, v_actor_name, p_payload->>'notes', p_idempotency_key
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

            INSERT INTO public.cash_movements (
                action_type, denomination, note_count, from_location, to_location,
                actor_auth_user_id, actor_name_snapshot, notes, idempotency_key
            ) VALUES (
                'DEPOSIT', v_denom, v_note_count, 'BANK/DRAWER', 'VAULT',
                v_auth_uid, v_actor_name, p_payload->>'notes', p_idempotency_key
            );

            v_result := jsonb_build_object('success', true, 'data', jsonb_build_object('denomination', v_denom, 'added', v_note_count));

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
            SET reserved_count = reserved_count + v_note_count, updated_at = timezone('utc'::text, now())
            WHERE denomination = v_denom;

            INSERT INTO public.cash_job_reservations (project_id, denomination, reserved_count, updated_at)
            VALUES (v_project_id, v_denom, v_note_count, timezone('utc'::text, now()))
            ON CONFLICT (project_id, denomination) DO UPDATE SET
                reserved_count = cash_job_reservations.reserved_count + EXCLUDED.reserved_count,
                updated_at = timezone('utc'::text, now());

            INSERT INTO public.cash_movements (
                action_type, project_id, denomination, note_count, from_location, to_location,
                actor_auth_user_id, actor_name_snapshot, notes, idempotency_key
            ) VALUES (
                'RESERVE', v_project_id, v_denom, v_note_count, 'VAULT', 'JOB_RESERVATION:' || v_project_id,
                v_auth_uid, v_actor_name, p_payload->>'notes', p_idempotency_key
            );

            v_result := jsonb_build_object('success', true, 'data', jsonb_build_object('project_id', v_project_id, 'reserved', v_note_count));

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

            SELECT * INTO v_job_res FROM public.cash_job_reservations
            WHERE project_id = v_project_id AND denomination = v_denom FOR UPDATE;

            IF NOT FOUND OR v_job_res.reserved_count < v_note_count THEN
                RAISE EXCEPTION 'Cannot release % notes: only % reserved for project %',
                    v_note_count, coalesce(v_job_res.reserved_count, 0), v_project_id;
            END IF;

            UPDATE public.cash_job_reservations
            SET reserved_count = reserved_count - v_note_count, updated_at = timezone('utc'::text, now())
            WHERE id = v_job_res.id;

            UPDATE public.cash_vault_denominations
            SET reserved_count = reserved_count - v_note_count, updated_at = timezone('utc'::text, now())
            WHERE denomination = v_denom;

            INSERT INTO public.cash_movements (
                action_type, project_id, denomination, note_count, from_location, to_location,
                actor_auth_user_id, actor_name_snapshot, notes, idempotency_key
            ) VALUES (
                'RELEASE_RESERVATION', v_project_id, v_denom, v_note_count, 'JOB_RESERVATION:' || v_project_id, 'VAULT',
                v_auth_uid, v_actor_name, p_payload->>'notes', p_idempotency_key
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
                SELECT * INTO v_job_res FROM public.cash_job_reservations
                WHERE project_id = v_project_id AND denomination = v_denom FOR UPDATE;

                IF NOT FOUND OR v_job_res.reserved_count < v_note_count THEN
                    RAISE EXCEPTION 'Insufficient job reservation for project % (Requested: %, Reserved: %)',
                        v_project_id, v_note_count, coalesce(v_job_res.reserved_count, 0);
                END IF;

                UPDATE public.cash_job_reservations
                SET reserved_count = reserved_count - v_note_count, updated_at = timezone('utc'::text, now())
                WHERE id = v_job_res.id;

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
                SET physical_count = physical_count - v_note_count, updated_at = timezone('utc'::text, now())
                WHERE denomination = v_denom;
            END IF;

            v_batch_code := 'CSH-' || v_project_id || '-' || to_char(now(), 'MMDD-') || substring(gen_random_uuid()::text, 1, 4);

            INSERT INTO public.cash_helper_batches (
                batch_code, project_id, recipient_id, recipient_name_snapshot,
                denomination, issued_count, status, notes
            ) VALUES (
                v_batch_code, v_project_id, v_recipient_id, v_recipient_name,
                v_denom, v_note_count, 'ISSUED', p_payload->>'notes'
            ) RETURNING id INTO v_batch_id;

            INSERT INTO public.cash_movements (
                action_type, project_id, batch_id, denomination, note_count, from_location, to_location,
                actor_auth_user_id, actor_name_snapshot, notes, idempotency_key
            ) VALUES (
                'ISSUE_HELPER_BATCH', v_project_id, v_batch_id, v_denom, v_note_count, 'VAULT', 'HELPER:' || v_recipient_name,
                v_auth_uid, v_actor_name, p_payload->>'notes', p_idempotency_key
            );

            v_result := jsonb_build_object(
                'success', true,
                'data', jsonb_build_object('batch', jsonb_build_object('id', v_batch_id, 'batch_code', v_batch_code, 'issued_count', v_note_count))
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

            SELECT * INTO v_batch FROM public.cash_helper_batches WHERE id = v_batch_id FOR UPDATE;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Cash batch % not found', v_batch_id;
            END IF;

            IF (v_batch.issued_count - v_batch.prepared_count - v_batch.returned_raw_count - v_batch.handed_over_count) < v_note_count THEN
                RAISE EXCEPTION 'Note count exceeds remaining notes in helper custody';
            END IF;

            UPDATE public.cash_helper_batches
            SET prepared_count = prepared_count + v_note_count,
                status = CASE 
                    WHEN (prepared_count + v_note_count + returned_raw_count + handed_over_count) >= issued_count THEN 'FULLY_PREPARED'
                    ELSE 'PARTIAL_PREPARED'
                END,
                updated_at = timezone('utc'::text, now())
            WHERE id = v_batch_id;

            INSERT INTO public.cash_prepared_sets (project_id, denomination, prepared_count, updated_at)
            VALUES (v_batch.project_id, v_batch.denomination, v_note_count, timezone('utc'::text, now()))
            ON CONFLICT (project_id, denomination) DO UPDATE SET
                prepared_count = cash_prepared_sets.prepared_count + EXCLUDED.prepared_count,
                updated_at = timezone('utc'::text, now());

            INSERT INTO public.cash_movements (
                action_type, project_id, batch_id, denomination, note_count, from_location, to_location,
                actor_auth_user_id, actor_name_snapshot, notes, idempotency_key
            ) VALUES (
                'RECEIVE_PREPARED', v_batch.project_id, v_batch_id, v_batch.denomination, v_note_count,
                'HELPER:' || v_batch.recipient_name_snapshot, 'PREPARED_SET:' || v_batch.project_id,
                v_auth_uid, v_actor_name, p_payload->>'notes', p_idempotency_key
            );

            v_result := jsonb_build_object('success', true, 'data', jsonb_build_object('batch_id', v_batch_id, 'prepared', v_note_count));

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

            SELECT * INTO v_prep FROM public.cash_prepared_sets
            WHERE project_id = v_project_id AND denomination = v_denom FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Insufficient prepared banknotes to deliver (Available: 0, Requested: %)', v_note_count;
            END IF;

            IF (v_prep.prepared_count - v_prep.delivered_count) < v_note_count THEN
                RAISE EXCEPTION 'Insufficient prepared banknotes to deliver (Available: %, Requested: %)',
                    coalesce(v_prep.prepared_count - v_prep.delivered_count, 0), v_note_count;
            END IF;

            UPDATE public.cash_prepared_sets
            SET delivered_count = delivered_count + v_note_count, updated_at = timezone('utc'::text, now())
            WHERE id = v_prep.id;

            INSERT INTO public.cash_movements (
                action_type, project_id, denomination, note_count, from_location, to_location,
                actor_auth_user_id, actor_name_snapshot, notes, idempotency_key
            ) VALUES (
                'DELIVER_TO_CUSTOMER', v_project_id, v_denom, v_note_count,
                'PREPARED_SET:' || v_project_id, 'CUSTOMER_DELIVERED',
                v_auth_uid, v_actor_name, p_payload->>'notes', p_idempotency_key
            );

            v_result := jsonb_build_object('success', true, 'data', jsonb_build_object('project_id', v_project_id, 'delivered', v_note_count));

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

            SELECT * INTO v_batch FROM public.cash_helper_batches WHERE id = v_batch_id FOR UPDATE;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Cash batch % not found', v_batch_id;
            END IF;

            IF (v_batch.issued_count - v_batch.prepared_count - v_batch.returned_raw_count - v_batch.handed_over_count) < v_note_count THEN
                RAISE EXCEPTION 'Return count exceeds remaining notes in helper custody';
            END IF;

            UPDATE public.cash_helper_batches
            SET returned_raw_count = returned_raw_count + v_note_count,
                status = CASE 
                    WHEN (prepared_count + returned_raw_count + v_note_count + handed_over_count) >= issued_count THEN 'RETURNED_UNUSED'
                    ELSE 'PARTIAL_PREPARED'
                END,
                updated_at = timezone('utc'::text, now())
            WHERE id = v_batch_id;

            IF v_keep_res THEN
                UPDATE public.cash_vault_denominations
                SET physical_count = physical_count + v_note_count,
                    reserved_count = reserved_count + v_note_count,
                    updated_at = timezone('utc'::text, now())
                WHERE denomination = v_batch.denomination;

                INSERT INTO public.cash_job_reservations (project_id, denomination, reserved_count, updated_at)
                VALUES (v_batch.project_id, v_batch.denomination, v_note_count, timezone('utc'::text, now()))
                ON CONFLICT (project_id, denomination) DO UPDATE SET
                    reserved_count = cash_job_reservations.reserved_count + EXCLUDED.reserved_count,
                    updated_at = timezone('utc'::text, now());
            ELSE
                UPDATE public.cash_vault_denominations
                SET physical_count = physical_count + v_note_count, updated_at = timezone('utc'::text, now())
                WHERE denomination = v_batch.denomination;
            END IF;

            INSERT INTO public.cash_movements (
                action_type, project_id, batch_id, denomination, note_count, from_location, to_location,
                actor_auth_user_id, actor_name_snapshot, notes, idempotency_key
            ) VALUES (
                'RETURN_UNUSED_RAW', v_batch.project_id, v_batch_id, v_batch.denomination, v_note_count,
                'HELPER:' || v_batch.recipient_name_snapshot, 'VAULT',
                v_auth_uid, v_actor_name, p_payload->>'notes', p_idempotency_key
            );

            v_result := jsonb_build_object('success', true, 'data', jsonb_build_object('batch_id', v_batch_id, 'returned', v_note_count));

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

            SELECT * INTO v_batch FROM public.cash_helper_batches WHERE id = v_batch_id FOR UPDATE;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Cash batch % not found', v_batch_id;
            END IF;

            IF (v_batch.issued_count - v_batch.prepared_count - v_batch.returned_raw_count - v_batch.handed_over_count) < v_note_count THEN
                RAISE EXCEPTION 'Handover count exceeds remaining notes in helper custody';
            END IF;

            -- Deduct from source batch and update status
            UPDATE public.cash_helper_batches
            SET handed_over_count = handed_over_count + v_note_count,
                status = CASE 
                    WHEN (prepared_count + returned_raw_count + handed_over_count + v_note_count) >= issued_count THEN 'HANDED_OVER'
                    ELSE 'PARTIAL_PREPARED'
                END,
                updated_at = timezone('utc'::text, now())
            WHERE id = v_batch_id;

            -- Create target batch for receiver
            v_batch_code := 'CSH-' || v_batch.project_id || '-XFER-' || substring(gen_random_uuid()::text, 1, 4);
            INSERT INTO public.cash_helper_batches (
                batch_code, project_id, recipient_id, recipient_name_snapshot,
                denomination, issued_count, status, notes
            ) VALUES (
                v_batch_code, v_batch.project_id, v_recipient_id, v_recipient_name,
                v_batch.denomination, v_note_count, 'ISSUED', 'Transferred from ' || v_batch.recipient_name_snapshot
            ) RETURNING id INTO v_cat_id;

            INSERT INTO public.cash_movements (
                action_type, project_id, batch_id, denomination, note_count, from_location, to_location,
                actor_auth_user_id, actor_name_snapshot, notes, idempotency_key
            ) VALUES (
                'HANDOVER_BATCH', v_batch.project_id, v_batch_id, v_batch.denomination, v_note_count,
                'HELPER:' || v_batch.recipient_name_snapshot, 'HELPER:' || v_recipient_name,
                v_auth_uid, v_actor_name, p_payload->>'notes', p_idempotency_key
            );

            v_result := jsonb_build_object('success', true, 'data', jsonb_build_object('new_batch_id', v_cat_id, 'handed_over', v_note_count));

        WHEN 'cash_update_thresholds' THEN
            v_denom := (p_payload->>'denomination')::int;
            IF v_denom NOT IN (20, 50, 100, 500, 1000) THEN
                RAISE EXCEPTION 'Invalid banknote denomination: %', v_denom;
            END IF;

            IF p_payload ? 'low_alert_threshold' AND (p_payload->>'low_alert_threshold') ~ '^[0-9]+$' = FALSE THEN
                RAISE EXCEPTION 'low_alert_threshold must be a non-negative integer';
            END IF;
            IF p_payload ? 'target_available_count' AND (p_payload->>'target_available_count') ~ '^[0-9]+$' = FALSE THEN
                RAISE EXCEPTION 'target_available_count must be a non-negative integer';
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

            INSERT INTO public.cash_movements (
                action_type, denomination, note_count, from_location, to_location,
                actor_auth_user_id, actor_name_snapshot, notes, idempotency_key
            ) VALUES (
                'COUNT_ADJUSTMENT', v_denom, abs(v_delta::int), 'AUDIT', 'VAULT',
                v_auth_uid, v_actor_name, p_payload->>'reason', p_idempotency_key
            );

            v_result := jsonb_build_object('success', true, 'data', jsonb_build_object('denomination', v_denom, 'new_physical_count', (v_vault.physical_count + v_delta::int)));

        ELSE
            RAISE EXCEPTION 'Unknown warehouse action: %', p_action;
    END CASE;

    -- 7. Persist Idempotency Record (DO NOTHING on duplicate)
    INSERT INTO public.inventory_idempotency_records (
        idempotency_key, actor_auth_user_id, action_name, payload_hash, response_payload
    ) VALUES (
        p_idempotency_key, v_auth_uid, p_action, v_payload_hash, v_result
    ) ON CONFLICT (idempotency_key) DO NOTHING;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 7. CLIENT SUMMARY & PROJECTION RPCS

CREATE OR REPLACE FUNCTION public.warehouse_get_summary()
RETURNS JSONB AS $$
DECLARE
    v_auth_uid UUID;
    v_cats JSONB;
    v_recipients JSONB;
    v_teams JSONB;
    v_rounds JSONB;
    v_items JSONB;
    v_units JSONB;
    v_legacy_units JSONB;
BEGIN
    v_auth_uid := auth.uid();
    IF NOT public.fn_can_access_inventory(v_auth_uid) THEN
        RAISE EXCEPTION 'Unauthorized: inventory access permissions required';
    END IF;

    SELECT coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) INTO v_cats
    FROM (SELECT id, name, type, is_active FROM public.inventory_categories ORDER BY name) c;

    SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) INTO v_recipients
    FROM (SELECT id, name, recipient_type, is_active FROM public.inventory_recipients ORDER BY name) r;

    SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_teams
    FROM (
        SELECT id, team_recipient_id, primary_recipient_id, primary_receiver_name, member_names, is_active
        FROM public.inventory_recipient_teams
        WHERE is_active = true
        ORDER BY primary_receiver_name
    ) t;

    SELECT coalesce(jsonb_agg(to_jsonb(rd)), '[]'::jsonb) INTO v_rounds
    FROM (
        SELECT id, round_code, title, recipient_name_snapshot, status, expected_return_at,
               (SELECT coalesce(array_agg(project_id), '{}') FROM public.inventory_field_round_projects WHERE round_id = f.id) AS project_ids
        FROM public.inventory_field_rounds f
        WHERE status IN ('IN_PROGRESS', 'PARTIAL_RETURNED')
        ORDER BY created_at DESC
    ) rd;

    -- EXCLUDE banknote items from general summary (cash is separate server-enforced)
    SELECT coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) INTO v_items
    FROM (
        SELECT id, code, name, category_id, item_type, unit, current_stock, min_alert_threshold, average_cost, storage_location, color, size, status, is_active
        FROM public.inventory_items
        WHERE is_active = true AND lower(item_type) != 'banknote'
        ORDER BY name
    ) i;

    SELECT coalesce(jsonb_agg(to_jsonb(u)), '[]'::jsonb) INTO v_units
    FROM (
        SELECT u.unit_code, u.item_id, u.status, u.borrowed_by, u.borrowed_at, u.project_id, u.notes,
               c.id AS active_custody_id, c.recipient_name_snapshot AS active_recipient, c.due_date
        FROM public.asset_units u
        LEFT JOIN public.asset_unit_custody c ON u.unit_code = c.unit_code AND c.is_active = true
        ORDER BY u.unit_code
    ) u;

    -- Legacy borrowed units without Plan C custody
    SELECT coalesce(jsonb_agg(to_jsonb(lu)), '[]'::jsonb) INTO v_legacy_units
    FROM (
        SELECT u.unit_code, u.item_id, u.status, u.borrowed_by, u.borrowed_at, u.project_id
        FROM public.asset_units u
        WHERE upper(u.status) = 'BORROWED'
          AND NOT EXISTS (SELECT 1 FROM public.asset_unit_custody c WHERE c.unit_code = u.unit_code AND c.is_active = true)
    ) lu;

    RETURN jsonb_build_object(
        'categories', v_cats,
        'recipients', v_recipients,
        'teams', v_teams,
        'rounds', v_rounds,
        'items', v_items,
        'asset_units', v_units,
        'legacy_borrowed_units', v_legacy_units
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.warehouse_get_cash_summary()
RETURNS JSONB AS $$
DECLARE
    v_auth_uid UUID;
    v_denoms JSONB;
    v_reservations JSONB;
    v_batches JSONB;
    v_prep JSONB;
    v_legacy_banknotes JSONB;
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

    SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) INTO v_reservations
    FROM (
        SELECT id, project_id, denomination, reserved_count
        FROM public.cash_job_reservations
        WHERE reserved_count > 0
        ORDER BY project_id, denomination
    ) r;

    SELECT coalesce(jsonb_agg(to_jsonb(b)), '[]'::jsonb) INTO v_batches
    FROM (
        SELECT id, batch_code, project_id, recipient_name_snapshot, denomination,
               issued_count, prepared_count, returned_raw_count, handed_over_count,
               (issued_count - prepared_count - returned_raw_count - handed_over_count) AS remaining_count,
               status
        FROM public.cash_helper_batches
        WHERE status NOT IN ('DELIVERED', 'CLOSED')
        ORDER BY created_at DESC
    ) b;

    SELECT coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) INTO v_prep
    FROM (
        SELECT id, project_id, denomination, prepared_count, delivered_count,
               (prepared_count - delivered_count) AS ready_for_delivery_count
        FROM public.cash_prepared_sets
        WHERE (prepared_count - delivered_count) > 0
        ORDER BY project_id, denomination
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
        'legacy_banknotes', v_legacy_banknotes
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- 8. PAGINATED AUDIT HISTORY RPC

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

    v_can_cash := public.fn_can_manage_cash(v_auth_uid);
    v_limit := coalesce((p_filters->>'limit')::int, 50);
    v_offset := coalesce((p_filters->>'offset')::int, 0);

    SELECT coalesce(jsonb_agg(to_jsonb(d)), '[]'::jsonb) INTO v_docs
    FROM (
        SELECT id, doc_number, doc_type, project_id, round_id, recipient_name_snapshot,
               team_members_snapshot, status, notes, actor_name_snapshot, created_at
        FROM public.inventory_documents
        WHERE (p_filters->>'project_id' IS NULL OR project_id = p_filters->>'project_id')
        ORDER BY created_at DESC
        LIMIT v_limit OFFSET v_offset
    ) d;

    SELECT coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) INTO v_moves
    FROM (
        SELECT id, document_id, item_id, movement_type, quantity, delta_stock,
               source_item_variant_snapshot, notes, actor_name_snapshot, created_at
        FROM public.inventory_movements
        ORDER BY created_at DESC
        LIMIT v_limit OFFSET v_offset
    ) m;

    IF v_can_cash AND coalesce((p_filters->>'include_cash')::boolean, true) THEN
        SELECT coalesce(jsonb_agg(to_jsonb(cm)), '[]'::jsonb) INTO v_cash_moves
        FROM (
            SELECT id, action_type, project_id, batch_id, denomination, note_count,
                   total_value, from_location, to_location, actor_name_snapshot, notes, created_at
            FROM public.cash_movements
            ORDER BY created_at DESC
            LIMIT v_limit OFFSET v_offset
        ) cm;
    END IF;

    RETURN jsonb_build_object(
        'documents', v_docs,
        'movements', v_moves,
        'cash_movements', v_cash_moves
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

-- 8.1 OPERATIONAL READ PROJECTION (Return / Inspection / Custody)

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
    v_count_issues INT := 0;
    v_count_recovs INT := 0;
    v_count_custodies INT := 0;
    v_count_incidents INT := 0;
BEGIN
    v_auth_uid := auth.uid();
    IF NOT public.fn_can_access_inventory(v_auth_uid) THEN
        RAISE EXCEPTION 'Unauthorized: inventory access permissions required';
    END IF;

    v_limit := LEAST(100, GREATEST(1, coalesce((p_filters->>'limit')::int, 100)));
    v_offset := GREATEST(0, coalesce((p_filters->>'offset')::int, 0));
    v_proj_id := p_filters->>'project_id';
    v_round_id := (p_filters->>'round_id')::uuid;

    -- 1. Outstanding Issue Lines (Residual issued - raw unused returns - recovered raw quantities)
    WITH line_agg AS (
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
            coalesce((
                SELECT sum(ret.quantity) 
                FROM public.inventory_movements ret 
                WHERE ret.source_issue_movement_id = m.id AND ret.movement_type = 'RETURN_UNUSED'
            ), 0) AS returned_qty,
            coalesce((
                SELECT sum(rcv.recovered_qty) 
                FROM public.inventory_material_recoveries rcv 
                WHERE rcv.source_issue_movement_id = m.id
            ), 0) AS recovered_qty,
            m.created_at
        FROM public.inventory_movements m
        JOIN public.inventory_documents d ON m.document_id = d.id
        JOIN public.inventory_items i ON m.item_id = i.id
        WHERE m.movement_type = 'ISSUE'
          AND (v_proj_id IS NULL OR d.project_id = v_proj_id)
          AND (v_round_id IS NULL OR d.round_id = v_round_id)
    ),
    outstanding AS (
        SELECT 
            id,
            source_issue_movement_id,
            item_id,
            project_id,
            round_id,
            recipient_name_snapshot,
            item_name,
            color,
            size,
            unit,
            issued_qty,
            returned_qty,
            recovered_qty,
            (issued_qty - returned_qty - recovered_qty) AS remaining_qty,
            created_at
        FROM line_agg
        WHERE (issued_qty - returned_qty - recovered_qty) > 0
        ORDER BY created_at DESC, id DESC
    )
    SELECT 
        coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb),
        count(*)
    INTO v_issue_lines, v_count_issues
    FROM (
        SELECT * FROM outstanding
        LIMIT v_limit OFFSET v_offset
    ) l;

    -- 2. Pending Material Recoveries (Waiting for warehouse sorting/inspection)
    SELECT 
        coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb),
        count(*)
    INTO v_recoveries, v_count_recovs
    FROM (
        SELECT 
            rec.id,
            rec.item_id,
            rec.source_issue_movement_id,
            rec.document_id,
            rec.recovered_qty,
            rec.status,
            i.name AS item_name,
            i.color,
            i.size,
            i.unit,
            d.project_id,
            d.round_id,
            rec.created_at
        FROM public.inventory_material_recoveries rec
        JOIN public.inventory_documents d ON rec.document_id = d.id
        JOIN public.inventory_items i ON rec.item_id = i.id
        WHERE rec.status = 'PENDING'
          AND (v_proj_id IS NULL OR d.project_id = v_proj_id)
          AND (v_round_id IS NULL OR d.round_id = v_round_id)
        ORDER BY rec.created_at DESC, rec.id DESC
        LIMIT v_limit OFFSET v_offset
    ) r;

    -- 3. Active Tool Custodies
    SELECT 
        coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb),
        count(*)
    INTO v_custodies, v_count_custodies
    FROM (
        SELECT 
            cust.id,
            cust.unit_code,
            cust.project_id,
            cust.round_id,
            cust.recipient_name_snapshot,
            cust.due_date,
            cust.borrowed_at,
            cust.notes,
            i.name AS item_name,
            u.status
        FROM public.asset_unit_custody cust
        JOIN public.asset_units u ON cust.unit_code = u.unit_code
        JOIN public.inventory_items i ON u.item_id = i.id
        WHERE cust.is_active = true
          AND (v_proj_id IS NULL OR cust.project_id = v_proj_id)
          AND (v_round_id IS NULL OR cust.round_id = v_round_id)
        ORDER BY cust.borrowed_at DESC, cust.id DESC
        LIMIT v_limit OFFSET v_offset
    ) c;

    -- 4. Open Incidents
    SELECT 
        coalesce(jsonb_agg(to_jsonb(inc)), '[]'::jsonb),
        count(*)
    INTO v_incidents, v_count_incidents
    FROM (
        SELECT 
            inc.id,
            inc.unit_code,
            inc.incident_type,
            inc.custody_id,
            inc.responsible_recipient_id,
            inc.recipient_name_snapshot,
            inc.round_id,
            inc.severity,
            inc.resolution_status,
            inc.notes,
            inc.created_at
        FROM public.inventory_incidents inc
        WHERE inc.resolution_status IN ('OPEN', 'INVESTIGATING')
          AND (v_round_id IS NULL OR inc.round_id = v_round_id)
        ORDER BY inc.created_at DESC, inc.id DESC
        LIMIT v_limit OFFSET v_offset
    ) inc;

    IF v_count_issues = v_limit OR v_count_recovs = v_limit OR v_count_custodies = v_limit OR v_count_incidents = v_limit THEN
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

-- 9. EXECUTION PRIVILEGES (Hardened Revoke/Grant)

REVOKE ALL ON FUNCTION public.warehouse_dispatch(TEXT, JSONB, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.warehouse_dispatch(TEXT, JSONB, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.warehouse_get_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.warehouse_get_summary() TO authenticated;

REVOKE ALL ON FUNCTION public.warehouse_get_cash_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.warehouse_get_cash_summary() TO authenticated;

REVOKE ALL ON FUNCTION public.warehouse_get_history(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.warehouse_get_history(JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.warehouse_get_operations(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.warehouse_get_operations(JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.fn_can_access_inventory(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_can_access_inventory(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.fn_can_manage_cash(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_can_manage_cash(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.fn_hash_action_payload(TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_hash_action_payload(TEXT, JSONB) TO authenticated;

COMMIT;
