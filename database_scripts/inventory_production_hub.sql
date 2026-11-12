-- DEVELOPMENT SNAPSHOT: superseded direction after the user's consolidation request.
-- If already applied, preserve all data. Do not rerun or manually drop its tables.
-- The compact migration and installation order are being prepared and are not ready yet.
-- ==============================================================================
-- FLOWER2U (F2U) — PROJECT PRODUCTION HUB BACKEND EXTENSION
-- Additive, rerunnable, pure-relational migration extending Plan C
-- Project production tracking, multi-helper assignments, inspection, and cash bridge
-- Single transaction, server-enforced RBAC, zero data loss
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. SECURITY & ANTI-ESCALATION HARDENING (ROLES & STAFF_USERS)
-- ------------------------------------------------------------------------------

-- Helper: Check if caller is Admin without trusting client input
CREATE OR REPLACE FUNCTION public.fn_is_admin(p_auth_uid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_role_name TEXT;
    v_curr_role TEXT;
    v_sess_role TEXT;
BEGIN
    v_sess_role := session_user;
    v_curr_role := coalesce(current_setting('role', true), v_sess_role);

    -- If connection is running under PostgreSQL authenticated/anon web roles
    IF v_sess_role IN ('authenticated', 'anon') OR v_curr_role IN ('authenticated', 'anon') THEN
        IF p_auth_uid IS NULL THEN
            RETURN FALSE;
        END IF;
    ELSIF p_auth_uid IS NULL THEN
        -- Direct DB owner / maintenance connection without web JWT (e.g. postgres, supabase_admin)
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

-- Revoke anonymous DML
REVOKE INSERT, UPDATE, DELETE ON public.roles FROM anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.staff_users FROM anon, PUBLIC;

-- Guard Trigger on staff_users: Block non-admin from modifying role_id, auth_user_id, id, is_active, or permissions
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

        -- Ordinary caller: cannot modify other staff records
        IF OLD.auth_user_id IS DISTINCT FROM v_caller_uid THEN
            RAISE EXCEPTION 'Unauthorized: Non-admin staff cannot modify other staff records';
        END IF;

        -- Cannot alter role_id, auth_user_id, id, or is_active
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

        -- Guard all non-profile fields (permissions, privileges, etc.)
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

-- Guard Trigger on staff_users: Block non-admin INSERT and DELETE
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

-- Guard Trigger on roles: Block non-admin modification
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

-- ------------------------------------------------------------------------------
-- 2. PEOPLE REGISTRY ENHANCEMENT (BRIDGING STAFF & CASUAL HELPERS)
-- ------------------------------------------------------------------------------

-- Add type-agnostic TEXT staff_user_id to inventory_recipients (handles UUID or TEXT staff_users.id)
ALTER TABLE public.inventory_recipients ADD COLUMN IF NOT EXISTS staff_user_id TEXT;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_schema = 'public' 
          AND table_name = 'inventory_recipients' 
          AND constraint_name = 'uq_inventory_recipients_staff_user_id'
    ) THEN
        ALTER TABLE public.inventory_recipients ADD CONSTRAINT uq_inventory_recipients_staff_user_id UNIQUE (staff_user_id);
    END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_recipients_staff_user_id 
    ON public.inventory_recipients(staff_user_id) 
    WHERE staff_user_id IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 3. PRODUCTION DOMAIN TABLES
-- ------------------------------------------------------------------------------

-- 3.1 Production Assignments (Task ownership within project)
CREATE TABLE IF NOT EXISTS public.production_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
    recipient_id UUID REFERENCES public.inventory_recipients(id) ON DELETE SET NULL,
    responsible_name TEXT NOT NULL,
    team_members_snapshot TEXT[] DEFAULT '{}',
    title TEXT NOT NULL,
    due_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'completed', 'problem', 'cancelled')),
    source_document_id UUID UNIQUE REFERENCES public.inventory_documents(id) ON DELETE SET NULL,
    source_cash_batch_id UUID UNIQUE REFERENCES public.cash_helper_batches(id) ON DELETE SET NULL,
    cash_only BOOLEAN NOT NULL DEFAULT false,
    version INTEGER NOT NULL DEFAULT 1,
    created_by_auth_user_id UUID,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_production_assignments_project ON public.production_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_production_assignments_recipient ON public.production_assignments(recipient_id);
CREATE INDEX IF NOT EXISTS idx_production_assignments_status ON public.production_assignments(status);
CREATE INDEX IF NOT EXISTS idx_production_assignments_doc ON public.production_assignments(source_document_id);
CREATE INDEX IF NOT EXISTS idx_production_assignments_cash ON public.production_assignments(source_cash_batch_id);

-- Idempotently ensure project foreign key uses ON DELETE RESTRICT to protect financial & custody audit trails
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = 'public'
          AND tc.table_name = 'production_assignments'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND kcu.column_name = 'project_id'
    ) LOOP
        EXECUTE 'ALTER TABLE public.production_assignments DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;

    ALTER TABLE public.production_assignments
        ADD CONSTRAINT production_assignments_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE RESTRICT;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- 3.2 Production Assignment Lines (Expected deliverables per assignment)
CREATE TABLE IF NOT EXISTS public.production_assignment_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES public.production_assignments(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    required_qty NUMERIC(12,2) NOT NULL CHECK (required_qty >= 0),
    unit TEXT NOT NULL DEFAULT 'ชุด',
    is_active BOOLEAN NOT NULL DEFAULT true,
    submitted_qty NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (submitted_qty >= 0),
    accepted_qty NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (accepted_qty >= 0),
    rejected_qty NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (rejected_qty >= 0),
    pending_qty NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (pending_qty >= 0),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_production_assignment_lines_assign ON public.production_assignment_lines(assignment_id);

-- 3.3 Production Submissions (Partial/full work deliveries)
CREATE TABLE IF NOT EXISTS public.production_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES public.production_assignments(id) ON DELETE CASCADE,
    submitted_by_auth_user_id UUID,
    submitted_by_name TEXT NOT NULL,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'inspected', 'partially_inspected')),
    submitted_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_production_submissions_assign ON public.production_submissions(assignment_id);

-- 3.4 Production Submission Lines
CREATE TABLE IF NOT EXISTS public.production_submission_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES public.production_submissions(id) ON DELETE CASCADE,
    line_id UUID NOT NULL REFERENCES public.production_assignment_lines(id) ON DELETE CASCADE,
    quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
    accepted_qty NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (accepted_qty >= 0),
    rejected_qty NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (rejected_qty >= 0),
    pending_qty NUMERIC(12,2) GENERATED ALWAYS AS (quantity - accepted_qty - rejected_qty) STORED,
    CONSTRAINT chk_sub_line_limits CHECK (accepted_qty + rejected_qty <= quantity)
);
CREATE INDEX IF NOT EXISTS idx_production_submission_lines_sub ON public.production_submission_lines(submission_id);
CREATE INDEX IF NOT EXISTS idx_production_submission_lines_line ON public.production_submission_lines(line_id);

-- 3.5 Production Inspections (Staff inspection decisions)
CREATE TABLE IF NOT EXISTS public.production_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES public.production_submissions(id) ON DELETE CASCADE,
    inspector_auth_user_id UUID,
    inspector_name TEXT NOT NULL,
    inspected_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_production_inspections_sub ON public.production_inspections(submission_id);

-- 3.6 Production Inspection Lines
CREATE TABLE IF NOT EXISTS public.production_inspection_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id UUID NOT NULL REFERENCES public.production_inspections(id) ON DELETE CASCADE,
    submission_line_id UUID NOT NULL REFERENCES public.production_submission_lines(id) ON DELETE CASCADE,
    accepted_qty NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (accepted_qty >= 0),
    rejected_qty NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (rejected_qty >= 0),
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_production_inspection_lines_insp ON public.production_inspection_lines(inspection_id);

-- 3.7 Production Assignment Events (Immutable lifecycle & audit log)
CREATE TABLE IF NOT EXISTS public.production_assignment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES public.production_assignments(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('created', 'edited', 'split', 'status_changed', 'submission_created', 'inspection_completed', 'cash_inspected')),
    actor_auth_user_id UUID,
    actor_name TEXT NOT NULL,
    from_status TEXT,
    to_status TEXT,
    reason TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_production_events_assign ON public.production_assignment_events(assignment_id);

-- ------------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY & PERMISSION POLICIES
-- ------------------------------------------------------------------------------

ALTER TABLE public.production_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_assignment_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_submission_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_inspection_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_assignment_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.production_assignments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.production_assignment_lines FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.production_submissions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.production_submission_lines FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.production_inspections FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.production_inspection_lines FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.production_assignment_events FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.production_assignments TO authenticated;
GRANT SELECT ON public.production_assignment_lines TO authenticated;
GRANT SELECT ON public.production_submissions TO authenticated;
GRANT SELECT ON public.production_submission_lines TO authenticated;
GRANT SELECT ON public.production_inspections TO authenticated;
GRANT SELECT ON public.production_inspection_lines TO authenticated;
GRANT SELECT ON public.production_assignment_events TO authenticated;

DROP POLICY IF EXISTS rls_select_production_assignments ON public.production_assignments;
CREATE POLICY rls_select_production_assignments ON public.production_assignments
FOR SELECT TO authenticated
USING (
    (cash_only AND public.fn_can_manage_cash(auth.uid()))
    OR (NOT cash_only AND public.fn_can_access_inventory(auth.uid()))
    OR public.fn_is_admin(auth.uid())
);

DROP POLICY IF EXISTS rls_select_production_lines ON public.production_assignment_lines;
CREATE POLICY rls_select_production_lines ON public.production_assignment_lines
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.production_assignments a
        WHERE a.id = assignment_id
          AND (
            (a.cash_only AND public.fn_can_manage_cash(auth.uid()))
            OR (NOT a.cash_only AND public.fn_can_access_inventory(auth.uid()))
            OR public.fn_is_admin(auth.uid())
          )
    )
);

DROP POLICY IF EXISTS rls_select_production_submissions ON public.production_submissions;
CREATE POLICY rls_select_production_submissions ON public.production_submissions
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.production_assignments a
        WHERE a.id = assignment_id
          AND (
            (a.cash_only AND public.fn_can_manage_cash(auth.uid()))
            OR (NOT a.cash_only AND public.fn_can_access_inventory(auth.uid()))
            OR public.fn_is_admin(auth.uid())
          )
    )
);

DROP POLICY IF EXISTS rls_select_production_sub_lines ON public.production_submission_lines;
CREATE POLICY rls_select_production_sub_lines ON public.production_submission_lines
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.production_submissions s
        JOIN public.production_assignments a ON s.assignment_id = a.id
        WHERE s.id = submission_id
          AND (
            (a.cash_only AND public.fn_can_manage_cash(auth.uid()))
            OR (NOT a.cash_only AND public.fn_can_access_inventory(auth.uid()))
            OR public.fn_is_admin(auth.uid())
          )
    )
);

DROP POLICY IF EXISTS rls_select_production_inspections ON public.production_inspections;
CREATE POLICY rls_select_production_inspections ON public.production_inspections
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.production_submissions s
        JOIN public.production_assignments a ON s.assignment_id = a.id
        WHERE s.id = submission_id
          AND (
            (a.cash_only AND public.fn_can_manage_cash(auth.uid()))
            OR (NOT a.cash_only AND public.fn_can_access_inventory(auth.uid()))
            OR public.fn_is_admin(auth.uid())
          )
    )
);

DROP POLICY IF EXISTS rls_select_production_insp_lines ON public.production_inspection_lines;
CREATE POLICY rls_select_production_insp_lines ON public.production_inspection_lines
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.production_inspections i
        JOIN public.production_submissions s ON i.submission_id = s.id
        JOIN public.production_assignments a ON s.assignment_id = a.id
        WHERE i.id = inspection_id
          AND (
            (a.cash_only AND public.fn_can_manage_cash(auth.uid()))
            OR (NOT a.cash_only AND public.fn_can_access_inventory(auth.uid()))
            OR public.fn_is_admin(auth.uid())
          )
    )
);

DROP POLICY IF EXISTS rls_select_production_events ON public.production_assignment_events;
CREATE POLICY rls_select_production_events ON public.production_assignment_events
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.production_assignments a
        WHERE a.id = assignment_id
          AND (
            (a.cash_only AND public.fn_can_manage_cash(auth.uid()))
            OR (NOT a.cash_only AND public.fn_can_access_inventory(auth.uid()))
            OR public.fn_is_admin(auth.uid())
          )
    )
);

-- ------------------------------------------------------------------------------
-- 4.8 BASE INVENTORY DIRECT REST MUTATION REVOCATION & RESTRICTIVE BANKNOTE RLS
-- ------------------------------------------------------------------------------

-- Revoke direct DML from PUBLIC, anon, and authenticated on base inventory tables.
-- All inventory mutations must strictly proceed through transactional SECURITY DEFINER RPCs (warehouse_dispatch).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.inventory_items FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.asset_units FROM PUBLIC, anon, authenticated;

-- Revoke direct DML on legacy procurement & disposal tables if they exist to prevent invoker trigger bypasses
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_procurements') THEN
        EXECUTE 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.inventory_procurements FROM PUBLIC, anon, authenticated';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inventory_disposals') THEN
        EXECUTE 'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.inventory_disposals FROM PUBLIC, anon, authenticated';
    END IF;
END $$;

-- Revoke anonymous SELECT on base inventory items and asset units
REVOKE SELECT ON public.inventory_items FROM PUBLIC, anon;
REVOKE SELECT ON public.asset_units FROM PUBLIC, anon;

-- Grant SELECT to authenticated users (evaluated through RLS)
GRANT SELECT ON public.inventory_items TO authenticated;
GRANT SELECT ON public.asset_units TO authenticated;

-- Ensure Row Level Security is enabled on base tables
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_units ENABLE ROW LEVEL SECURITY;

-- Permissive SELECT policy for authenticated users with inventory or cash access
DROP POLICY IF EXISTS rls_select_inventory_items_permissive ON public.inventory_items;
CREATE POLICY rls_select_inventory_items_permissive ON public.inventory_items
FOR SELECT TO authenticated
USING (public.fn_can_access_inventory(auth.uid()) OR public.fn_can_manage_cash(auth.uid()));

DROP POLICY IF EXISTS rls_select_asset_units_permissive ON public.asset_units;
CREATE POLICY rls_select_asset_units_permissive ON public.asset_units
FOR SELECT TO authenticated
USING (public.fn_can_access_inventory(auth.uid()) OR public.fn_can_manage_cash(auth.uid()));

-- RESTRICTIVE SELECT policy on inventory_items:
-- Legacy banknote rows (item_type = 'banknote') in inventory_items may contain historical real cash numbers in current_stock.
-- This RESTRICTIVE policy acts as an absolute constraint (combined via AND with all permissive policies, including legacy policies like 'Allow app full access'),
-- hiding banknote rows from any caller who lacks cash management permissions (e.g. technicians, unmapped users, or anonymous callers).
DROP POLICY IF EXISTS rls_restrict_banknote_inventory_items ON public.inventory_items;
CREATE POLICY rls_restrict_banknote_inventory_items ON public.inventory_items
AS RESTRICTIVE
FOR SELECT TO authenticated
USING (
    lower(item_type) <> 'banknote'
    OR public.fn_can_manage_cash(auth.uid())
);

-- ------------------------------------------------------------------------------
-- 5. REALTIME REPLICA IDENTITY
-- ------------------------------------------------------------------------------

ALTER TABLE public.production_assignments REPLICA IDENTITY FULL;
ALTER TABLE public.production_assignment_lines REPLICA IDENTITY FULL;
ALTER TABLE public.production_submissions REPLICA IDENTITY FULL;
ALTER TABLE public.production_submission_lines REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.production_assignments;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.production_assignment_lines;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.production_submissions;
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- ------------------------------------------------------------------------------
-- 6. CORE INTEGRATION TRIGGERS
-- ------------------------------------------------------------------------------

-- Trigger 6.1: AFTER INSERT on inventory_documents creates linked default assignment
CREATE OR REPLACE FUNCTION public.trg_doc_production_issue_create()
RETURNS TRIGGER AS $$
DECLARE
    v_assign_id UUID;
BEGIN
    IF NEW.doc_type = 'PRODUCTION_ISSUE' AND NEW.project_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.production_assignments WHERE source_document_id = NEW.id) THEN
            INSERT INTO public.production_assignments (
                project_id,
                recipient_id,
                responsible_name,
                team_members_snapshot,
                title,
                status,
                source_document_id,
                cash_only,
                version,
                created_by_auth_user_id
            ) VALUES (
                NEW.project_id,
                NEW.recipient_id,
                NEW.recipient_name_snapshot,
                coalesce(NEW.team_members_snapshot, '{}'),
                'งานผลิตตามใบเบิก ' || NEW.doc_number,
                'in_progress',
                NEW.id,
                false,
                1,
                NEW.actor_auth_user_id
            ) RETURNING id INTO v_assign_id;

            INSERT INTO public.production_assignment_lines (
                assignment_id,
                description,
                required_qty,
                unit,
                is_active
            ) VALUES (
                v_assign_id,
                'งานผลิตตามใบเบิก',
                1.00,
                'ชุด',
                true
            );

            INSERT INTO public.production_assignment_events (
                assignment_id,
                event_type,
                actor_auth_user_id,
                actor_name,
                from_status,
                to_status,
                reason,
                details
            ) VALUES (
                v_assign_id,
                'created',
                NEW.actor_auth_user_id,
                coalesce(NEW.actor_name_snapshot, 'System'),
                NULL,
                'in_progress',
                'Auto-created from issue ' || NEW.doc_number,
                jsonb_build_object('source_document_id', NEW.id)
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_doc_production_issue_create ON public.inventory_documents;
CREATE TRIGGER trg_doc_production_issue_create
AFTER INSERT ON public.inventory_documents
FOR EACH ROW
EXECUTE FUNCTION public.trg_doc_production_issue_create();

-- Trigger 6.2: AFTER INSERT OR UPDATE on cash_helper_batches syncs cash_only assignment
CREATE OR REPLACE FUNCTION public.trg_cash_helper_batch_sync()
RETURNS TRIGGER AS $$
DECLARE
    v_assign_id UUID;
    v_line_id UUID;
    v_exp_qty NUMERIC(12,2);
    v_prep_qty NUMERIC(12,2);
    v_diff NUMERIC(12,2);
    v_sub_id UUID;
    v_sub_line_id UUID;
    v_insp_id UUID;
    v_actor_name TEXT;
BEGIN
    v_exp_qty := GREATEST(0, NEW.issued_count - NEW.returned_raw_count - NEW.handed_over_count)::NUMERIC(12,2);
    v_prep_qty := NEW.prepared_count::NUMERIC(12,2);

    SELECT id INTO v_assign_id
    FROM public.production_assignments
    WHERE source_cash_batch_id = NEW.id;

    IF v_assign_id IS NULL THEN
        -- Insert new cash_only assignment
        INSERT INTO public.production_assignments (
            project_id,
            recipient_id,
            responsible_name,
            title,
            status,
            source_cash_batch_id,
            cash_only,
            version,
            created_by_auth_user_id
        ) VALUES (
            NEW.project_id,
            NEW.recipient_id,
            NEW.recipient_name_snapshot,
            'งานเตรียมชุดเงินสด ' || NEW.batch_code,
            'in_progress',
            NEW.id,
            true,
            1,
            auth.uid()
        ) RETURNING id INTO v_assign_id;

        INSERT INTO public.production_assignment_lines (
            assignment_id,
            description,
            required_qty,
            unit,
            is_active,
            accepted_qty,
            submitted_qty
        ) VALUES (
            v_assign_id,
            'ธนบัตร ' || NEW.denomination || ' บาท',
            v_exp_qty,
            'ใบ',
            true,
            v_prep_qty,
            v_prep_qty
        );

        INSERT INTO public.production_assignment_events (
            assignment_id,
            event_type,
            actor_auth_user_id,
            actor_name,
            details
        ) VALUES (
            v_assign_id,
            'created',
            auth.uid(),
            'Cash System',
            jsonb_build_object('batch_code', NEW.batch_code, 'issued_count', NEW.issued_count)
        );
    ELSE
        SELECT id INTO v_line_id
        FROM public.production_assignment_lines
        WHERE assignment_id = v_assign_id
        LIMIT 1;

        -- Prepared count increase creates an inspection audit receipt
        IF TG_OP = 'UPDATE' AND NEW.prepared_count > OLD.prepared_count THEN
            v_diff := (NEW.prepared_count - OLD.prepared_count)::NUMERIC(12,2);

            SELECT coalesce(full_name, username) INTO v_actor_name
            FROM public.staff_users
            WHERE auth_user_id = auth.uid()
            LIMIT 1;

            INSERT INTO public.production_submissions (
                assignment_id,
                submitted_by_auth_user_id,
                submitted_by_name,
                note,
                status
            ) VALUES (
                v_assign_id,
                auth.uid(),
                coalesce(v_actor_name, NEW.recipient_name_snapshot),
                'Prepared banknotes verified from cash vault flow',
                'inspected'
            ) RETURNING id INTO v_sub_id;

            INSERT INTO public.production_submission_lines (
                submission_id,
                line_id,
                quantity,
                accepted_qty,
                rejected_qty
            ) VALUES (
                v_sub_id,
                v_line_id,
                v_diff,
                v_diff,
                0
            ) RETURNING id INTO v_sub_line_id;

            INSERT INTO public.production_inspections (
                submission_id,
                inspector_auth_user_id,
                inspector_name,
                notes
            ) VALUES (
                v_sub_id,
                auth.uid(),
                coalesce(v_actor_name, 'Cashier'),
                'Received prepared set into cash vault'
            ) RETURNING id INTO v_insp_id;

            INSERT INTO public.production_inspection_lines (
                inspection_id,
                submission_line_id,
                accepted_qty,
                rejected_qty,
                notes
            ) VALUES (
                v_insp_id,
                v_sub_line_id,
                v_diff,
                0,
                'Verified by cash receive transaction'
            );
        END IF;

        UPDATE public.production_assignment_lines
        SET required_qty = v_exp_qty,
            accepted_qty = v_prep_qty,
            submitted_qty = GREATEST(submitted_qty, v_prep_qty),
            updated_at = timezone('utc'::text, now())
        WHERE id = v_line_id;

        UPDATE public.production_assignments
        SET recipient_id = NEW.recipient_id,
            responsible_name = NEW.recipient_name_snapshot,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_assign_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_cash_helper_batch_sync ON public.cash_helper_batches;
CREATE TRIGGER trg_cash_helper_batch_sync
AFTER INSERT OR UPDATE ON public.cash_helper_batches
FOR EACH ROW
EXECUTE FUNCTION public.trg_cash_helper_batch_sync();

-- ------------------------------------------------------------------------------
-- 6.3 IDEMPOTENT METADATA BACKFILL (CORE PRODUCTION ISSUES & CASH BATCHES)
-- Pure metadata synchronization for pre-existing records; zero physical stock/cash mutation.
-- Rerunnable: does not create duplicate assignments or spurious event logs.
-- ------------------------------------------------------------------------------

DO $$
DECLARE
    v_doc RECORD;
    v_batch RECORD;
    v_assign_id UUID;
    v_exp_qty NUMERIC(12,2);
    v_prep_qty NUMERIC(12,2);
BEGIN
    -- 1. Backfill pre-existing PRODUCTION_ISSUE documents
    FOR v_doc IN 
        SELECT d.* 
        FROM public.inventory_documents d
        WHERE d.doc_type = 'PRODUCTION_ISSUE' 
          AND d.project_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM public.production_assignments pa 
              WHERE pa.source_document_id = d.id
          )
    LOOP
        INSERT INTO public.production_assignments (
            project_id,
            recipient_id,
            responsible_name,
            team_members_snapshot,
            title,
            status,
            source_document_id,
            cash_only,
            version,
            created_by_auth_user_id
        ) VALUES (
            v_doc.project_id,
            v_doc.recipient_id,
            v_doc.recipient_name_snapshot,
            coalesce(v_doc.team_members_snapshot, '{}'),
            'งานผลิตตามใบเบิก ' || v_doc.doc_number,
            'in_progress',
            v_doc.id,
            false,
            1,
            v_doc.actor_auth_user_id
        ) RETURNING id INTO v_assign_id;

        INSERT INTO public.production_assignment_lines (
            assignment_id,
            description,
            required_qty,
            unit,
            is_active
        ) VALUES (
            v_assign_id,
            'งานผลิตตามใบเบิก',
            1.00,
            'ชุด',
            true
        );
    END LOOP;

    -- 2. Backfill pre-existing cash_helper_batches
    FOR v_batch IN 
        SELECT b.* 
        FROM public.cash_helper_batches b
        WHERE NOT EXISTS (
            SELECT 1 FROM public.production_assignments pa 
            WHERE pa.source_cash_batch_id = b.id
        )
    LOOP
        v_exp_qty := GREATEST(0, v_batch.issued_count - v_batch.returned_raw_count - v_batch.handed_over_count)::NUMERIC(12,2);
        v_prep_qty := v_batch.prepared_count::NUMERIC(12,2);

        INSERT INTO public.production_assignments (
            project_id,
            recipient_id,
            responsible_name,
            title,
            status,
            source_cash_batch_id,
            cash_only,
            version,
            created_by_auth_user_id
        ) VALUES (
            v_batch.project_id,
            v_batch.recipient_id,
            v_batch.recipient_name_snapshot,
            'งานเตรียมชุดเงินสด ' || v_batch.batch_code,
            CASE 
                WHEN v_batch.status = 'FULLY_PREPARED' OR v_prep_qty >= v_exp_qty THEN 'completed'
                WHEN v_batch.status = 'CANCELLED' THEN 'cancelled'
                ELSE 'in_progress'
            END,
            v_batch.id,
            true,
            1,
            NULL
        ) RETURNING id INTO v_assign_id;

        INSERT INTO public.production_assignment_lines (
            assignment_id,
            description,
            required_qty,
            unit,
            is_active,
            accepted_qty,
            submitted_qty
        ) VALUES (
            v_assign_id,
            'ธนบัตร ' || v_batch.denomination || ' บาท',
            v_exp_qty,
            'ใบ',
            true,
            v_prep_qty,
            v_prep_qty
        );
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 7. PEOPLE RPCs (LISTING & RESOLUTION)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.warehouse_list_people(
    p_query TEXT DEFAULT '',
    p_limit INT DEFAULT 50
)
RETURNS JSONB AS $$
DECLARE
    v_clean_limit INT;
    v_q TEXT;
    v_people JSONB;
BEGIN
    v_clean_limit := LEAST(GREATEST(coalesce(p_limit, 50), 1), 100);
    v_q := trim(coalesce(p_query, ''));

    SELECT coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) INTO v_people
    FROM (
        -- 1. Active staff users (without PII)
        SELECT 
            'staff:' || su.id::text AS key,
            r.id AS recipient_id,
            su.id::text AS staff_user_id,
            coalesce(su.full_name, su.username) AS name,
            'staff' AS kind,
            su.id::text AS code,
            coalesce(su.full_name, su.username) AS primary_receiver_name,
            ARRAY[]::text[] AS member_names
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

        -- 2. Active casual helpers & teams from inventory_recipients (excluding staff bridged ones)
        SELECT 
            'recipient:' || r.id::text AS key,
            r.id AS recipient_id,
            NULL AS staff_user_id,
            r.name AS name,
            r.recipient_type AS kind,
            substring(r.id::text, 1, 8) AS code,
            coalesce(t.primary_receiver_name, r.name) AS primary_receiver_name,
            coalesce(t.member_names, ARRAY[]::text[]) AS member_names
        FROM public.inventory_recipients r
        LEFT JOIN public.inventory_recipient_teams t ON t.team_recipient_id = r.id AND t.is_active = TRUE
        WHERE r.is_active = TRUE
          AND r.staff_user_id IS NULL
          AND r.recipient_type <> 'staff'
          AND (
            v_q = '' 
            OR r.name ILIKE ('%' || v_q || '%')
            OR coalesce(t.primary_receiver_name, '') ILIKE ('%' || v_q || '%')
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
    v_prefix TEXT;
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
        RETURNING id, name, recipient_type INTO v_rec_id, v_name, v_kind;

        RETURN jsonb_build_object(
            'recipient_id', v_rec_id,
            'name', v_name,
            'recipient_type', v_kind,
            'primary_receiver_name', v_name,
            'member_names', ARRAY[]::text[]
        );

    ELSIF p_person_key LIKE 'recipient:%' THEN
        BEGIN
            v_rec_id := substring(p_person_key FROM 11)::UUID;
        EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'Invalid recipient UUID in key: %', p_person_key;
        END;

        SELECT r.id, r.name, r.recipient_type, coalesce(t.primary_receiver_name, r.name), coalesce(t.member_names, ARRAY[]::text[])
        INTO v_rec_id, v_name, v_kind, v_primary, v_members
        FROM public.inventory_recipients r
        LEFT JOIN public.inventory_recipient_teams t ON t.team_recipient_id = r.id AND t.is_active = TRUE
        WHERE r.id = v_rec_id AND r.is_active = TRUE
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

-- ------------------------------------------------------------------------------
-- 8. UNIFIED PRODUCTION ISSUE + WORK RPC (warehouse_create_production_issue)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.warehouse_create_production_issue(
    p_issue JSONB,
    p_work JSONB,
    p_idempotency_key UUID
)
RETURNS JSONB AS $$
DECLARE
    v_auth_uid UUID;
    v_actor_name TEXT;
    v_payload_hash TEXT;
    v_cached RECORD;
    v_core_issue JSONB;
    v_core_result JSONB;
    v_doc_id UUID;
    v_assign RECORD;
    v_work_lines JSONB;
    v_elem JSONB;
    v_line_desc TEXT;
    v_line_qty NUMERIC(12,2);
    v_line_unit TEXT;
    v_result JSONB;
    v_due_at TIMESTAMPTZ;
BEGIN
    IF p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'Idempotency key (UUID) strictly required';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext(p_idempotency_key::text));

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
        RAISE EXCEPTION 'Unauthorized to create production issue';
    END IF;

    IF (p_issue->>'issue_type') <> 'PRODUCTION_ISSUE' THEN
        RAISE EXCEPTION 'issue_type must be PRODUCTION_ISSUE';
    END IF;

    v_payload_hash := md5('production_issue_create:' || p_issue::text || ':' || coalesce(p_work::text, '{}'));

    SELECT * INTO v_cached
    FROM public.inventory_idempotency_records
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
        IF v_cached.action_name <> 'production_issue_create' OR v_cached.payload_hash <> v_payload_hash OR v_cached.actor_auth_user_id <> v_auth_uid THEN
            RAISE EXCEPTION 'Idempotency mismatch: Key reused with different action or payload';
        END IF;
        RETURN v_cached.response_payload;
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

    -- Call core dispatcher for issue_create
    v_core_issue := p_issue || jsonb_build_object('_production_work_hash', v_payload_hash);
    v_core_result := public.warehouse_dispatch('issue_create', v_core_issue, p_idempotency_key);

    IF NOT coalesce((v_core_result->>'success')::BOOLEAN, false) THEN
        RETURN v_core_result;
    END IF;

    v_doc_id := coalesce((v_core_result->'data'->>'document_id')::UUID, (v_core_result->'data'->>'id')::UUID);

    -- The AFTER INSERT trigger on inventory_documents already created the default assignment
    SELECT * INTO v_assign
    FROM public.production_assignments
    WHERE source_document_id = v_doc_id
    FOR UPDATE;

    IF v_assign.id IS NULL THEN
        RAISE EXCEPTION 'Expected linked production assignment not found for document %', v_doc_id;
    END IF;

    -- Apply customized work title, due date, and output lines
    IF p_work IS NOT NULL THEN
        IF p_work ? 'due_at' AND p_work->>'due_at' IS NOT NULL THEN
            v_due_at := (p_work->>'due_at')::TIMESTAMPTZ;
        ELSIF p_work ? 'dueAt' AND p_work->>'dueAt' IS NOT NULL THEN
            v_due_at := (p_work->>'dueAt')::TIMESTAMPTZ;
        END IF;

        IF p_work ? 'title' AND trim(coalesce(p_work->>'title', '')) <> '' THEN
            UPDATE public.production_assignments
            SET title = p_work->>'title',
                due_at = coalesce(v_due_at, due_at),
                updated_at = timezone('utc'::text, now())
            WHERE id = v_assign.id;
        ELSIF v_due_at IS NOT NULL THEN
            UPDATE public.production_assignments
            SET due_at = v_due_at,
                updated_at = timezone('utc'::text, now())
            WHERE id = v_assign.id;
        END IF;

        IF p_work ? 'lines' AND jsonb_array_length(v_work_lines) > 0 THEN
            -- Replace default line with custom output deliverables
            DELETE FROM public.production_assignment_lines WHERE assignment_id = v_assign.id;

            FOR v_elem IN SELECT * FROM jsonb_array_elements(v_work_lines) LOOP
                v_line_desc := v_elem->>'description';
                v_line_qty := (v_elem->>'required_qty')::NUMERIC(12,2);
                v_line_unit := coalesce(v_elem->>'unit', 'ชุด');

                INSERT INTO public.production_assignment_lines (
                    assignment_id,
                    description,
                    required_qty,
                    unit,
                    is_active
                ) VALUES (
                    v_assign.id,
                    v_line_desc,
                    v_line_qty,
                    v_line_unit,
                    true
                );
            END LOOP;
        END IF;
    END IF;

    -- Construct return payload
    SELECT to_jsonb(a) INTO v_result
    FROM (
        SELECT 
            pa.*,
            coalesce((
                SELECT jsonb_agg(to_jsonb(pal))
                FROM public.production_assignment_lines pal
                WHERE pal.assignment_id = pa.id
            ), '[]'::jsonb) AS lines
        FROM public.production_assignments pa
        WHERE pa.id = v_assign.id
    ) a;

    v_result := jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'issue', v_core_result->'data',
            'assignment', v_result
        )
    );

    INSERT INTO public.inventory_idempotency_records (
        idempotency_key,
        action_name,
        payload_hash,
        actor_auth_user_id,
        response_payload
    ) VALUES (
        p_idempotency_key,
        'production_issue_create',
        v_payload_hash,
        v_auth_uid,
        v_result
    )
    ON CONFLICT (idempotency_key) DO UPDATE
    SET action_name = EXCLUDED.action_name,
        payload_hash = EXCLUDED.payload_hash,
        actor_auth_user_id = EXCLUDED.actor_auth_user_id,
        response_payload = EXCLUDED.response_payload;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ------------------------------------------------------------------------------
-- 9. PRODUCTION ASSIGNMENT LIFECYCLE RPCs
-- ------------------------------------------------------------------------------

-- 9.1 Create Production Assignment (Standalone without material issue)
CREATE OR REPLACE FUNCTION public.warehouse_create_assignment(
    p_payload JSONB,
    p_idempotency_key UUID
)
RETURNS JSONB AS $$
DECLARE
    v_auth_uid UUID;
    v_actor_name TEXT;
    v_payload_hash TEXT;
    v_cached RECORD;
    v_project_id TEXT;
    v_title TEXT;
    v_rec_id UUID;
    v_rec_name TEXT;
    v_due_at TIMESTAMPTZ;
    v_assign_id UUID;
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

    PERFORM pg_advisory_xact_lock(hashtext(p_idempotency_key::text));

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

    v_payload_hash := md5('assignment_create:' || p_payload::text);

    SELECT * INTO v_cached
    FROM public.inventory_idempotency_records
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
        IF v_cached.action_name <> 'assignment_create' OR v_cached.payload_hash <> v_payload_hash OR v_cached.actor_auth_user_id <> v_auth_uid THEN
            RAISE EXCEPTION 'Idempotency mismatch: Key reused with different action or payload';
        END IF;
        RETURN v_cached.response_payload;
    END IF;

    v_project_id := p_payload->>'project_id';
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

    INSERT INTO public.production_assignments (
        project_id,
        recipient_id,
        responsible_name,
        title,
        due_at,
        status,
        cash_only,
        version,
        created_by_auth_user_id
    ) VALUES (
        v_project_id,
        v_rec_id,
        v_rec_name,
        v_title,
        v_due_at,
        'in_progress',
        false,
        1,
        v_auth_uid
    ) RETURNING id INTO v_assign_id;

    v_lines := coalesce(p_payload->'lines', '[]'::jsonb);
    IF jsonb_array_length(v_lines) = 0 THEN
        INSERT INTO public.production_assignment_lines (
            assignment_id, description, required_qty, unit, is_active
        ) VALUES (v_assign_id, 'งานผลิตตามมอบหมาย', 1.00, 'ชุด', true);
    ELSE
        FOR v_elem IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
            v_line_qty := (v_elem->>'required_qty')::NUMERIC(12,2);
            IF v_line_qty IS NULL OR v_line_qty < 0 THEN
                RAISE EXCEPTION 'Line required quantity must be non-negative';
            END IF;
            INSERT INTO public.production_assignment_lines (
                assignment_id,
                description,
                required_qty,
                unit,
                is_active
            ) VALUES (
                v_assign_id,
                coalesce(v_elem->>'description', 'งานผลิต'),
                v_line_qty,
                coalesce(v_elem->>'unit', 'ชุด'),
                true
            );
        END LOOP;
    END IF;

    INSERT INTO public.production_assignment_events (
        assignment_id, event_type, actor_auth_user_id, actor_name, from_status, to_status, details
    ) VALUES (
        v_assign_id, 'created', v_auth_uid, v_actor_name, NULL, 'in_progress', p_payload
    );

    v_result := jsonb_build_object(
        'success', true,
        'data', jsonb_build_object('id', v_assign_id, 'project_id', v_project_id, 'title', v_title)
    );

    INSERT INTO public.inventory_idempotency_records (
        idempotency_key, action_name, payload_hash, actor_auth_user_id, response_payload
    ) VALUES (
        p_idempotency_key, 'assignment_create', v_payload_hash, v_auth_uid, v_result
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 9.2 Update Production Assignment
CREATE OR REPLACE FUNCTION public.warehouse_update_assignment(
    p_payload JSONB,
    p_idempotency_key UUID
)
RETURNS JSONB AS $$
DECLARE
    v_auth_uid UUID;
    v_actor_name TEXT;
    v_payload_hash TEXT;
    v_cached RECORD;
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

    PERFORM pg_advisory_xact_lock(hashtext(p_idempotency_key::text));

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

    v_payload_hash := md5('assignment_update:' || p_payload::text);

    SELECT * INTO v_cached
    FROM public.inventory_idempotency_records
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
        IF v_cached.action_name <> 'assignment_update' OR v_cached.payload_hash <> v_payload_hash OR v_cached.actor_auth_user_id <> v_auth_uid THEN
            RAISE EXCEPTION 'Idempotency mismatch: Key reused with different action or payload';
        END IF;
        RETURN v_cached.response_payload;
    END IF;

    v_assign_id := (p_payload->>'assignment_id')::UUID;
    v_expected_ver := (p_payload->>'expected_version')::INT;

    IF v_expected_ver IS NULL OR v_expected_ver < 1 THEN
        RAISE EXCEPTION 'expected_version must be a positive integer';
    END IF;

    SELECT * INTO v_assign
    FROM public.production_assignments
    WHERE id = v_assign_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assignment % not found', v_assign_id;
    END IF;

    IF v_assign.version <> v_expected_ver THEN
        RAISE EXCEPTION 'Version conflict: Expected version % but found % (stale overwrite rejected)', v_expected_ver, v_assign.version;
    END IF;

    IF v_assign.cash_only THEN
        IF NOT public.fn_can_manage_cash(v_auth_uid) THEN
            RAISE EXCEPTION 'Unauthorized: Cash management permissions required for cash assignment';
        END IF;
        RAISE EXCEPTION 'Generic edit of cash assignment lines is prohibited; canonical cash batch counts govern lines';
    END IF;

    -- Update title or due_at if provided
    IF p_payload ? 'title' AND trim(coalesce(p_payload->>'title', '')) <> '' THEN
        UPDATE public.production_assignments SET title = p_payload->>'title' WHERE id = v_assign_id;
    END IF;
    IF p_payload ? 'due_at' THEN
        UPDATE public.production_assignments SET due_at = (p_payload->>'due_at')::TIMESTAMPTZ WHERE id = v_assign_id;
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

                SELECT * INTO v_existing_line 
                FROM public.production_assignment_lines 
                WHERE id = v_line_id AND assignment_id = v_assign_id 
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

                UPDATE public.production_assignment_lines
                SET description = coalesce(v_elem->>'description', description),
                    required_qty = v_new_qty,
                    unit = coalesce(v_elem->>'unit', unit),
                    updated_at = timezone('utc'::text, now())
                WHERE id = v_line_id;
            ELSE
                -- New line
                INSERT INTO public.production_assignment_lines (
                    assignment_id, description, required_qty, unit, is_active
                ) VALUES (
                    v_assign_id,
                    coalesce(v_elem->>'description', 'งานผลิตเพิ่มเติม'),
                    v_new_qty,
                    coalesce(v_elem->>'unit', 'ชุด'),
                    true
                );
            END IF;
        END LOOP;
    END IF;

    UPDATE public.production_assignments
    SET version = version + 1,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_assign_id;

    INSERT INTO public.production_assignment_events (
        assignment_id, event_type, actor_auth_user_id, actor_name, reason, details
    ) VALUES (
        v_assign_id, 'edited', v_auth_uid, v_actor_name, p_payload->>'reason', p_payload
    );

    v_result := jsonb_build_object('success', true, 'data', jsonb_build_object('id', v_assign_id, 'version', v_assign.version + 1));

    INSERT INTO public.inventory_idempotency_records (
        idempotency_key, action_name, payload_hash, actor_auth_user_id, response_payload
    ) VALUES (
        p_idempotency_key, 'assignment_update', v_payload_hash, v_auth_uid, v_result
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 9.3 Split Production Assignment (Remaining work to another person)
CREATE OR REPLACE FUNCTION public.warehouse_split_assignment(
    p_payload JSONB,
    p_idempotency_key UUID
)
RETURNS JSONB AS $$
DECLARE
    v_auth_uid UUID;
    v_actor_name TEXT;
    v_payload_hash TEXT;
    v_cached RECORD;
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

    PERFORM pg_advisory_xact_lock(hashtext(p_idempotency_key::text));

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

    v_payload_hash := md5('assignment_split:' || p_payload::text);

    SELECT * INTO v_cached
    FROM public.inventory_idempotency_records
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
        IF v_cached.action_name <> 'assignment_split' OR v_cached.payload_hash <> v_payload_hash OR v_cached.actor_auth_user_id <> v_auth_uid THEN
            RAISE EXCEPTION 'Idempotency mismatch: Key reused with different action or payload';
        END IF;
        RETURN v_cached.response_payload;
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

    SELECT * INTO v_assign
    FROM public.production_assignments
    WHERE id = v_assign_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assignment % not found', v_assign_id;
    END IF;

    IF v_assign.version <> v_expected_ver THEN
        RAISE EXCEPTION 'Version conflict: Expected version % but found % (stale overwrite rejected)', v_expected_ver, v_assign.version;
    END IF;

    IF v_assign.cash_only THEN
        IF NOT public.fn_can_manage_cash(v_auth_uid) THEN
            RAISE EXCEPTION 'Unauthorized: Cash management permissions required for cash assignment';
        END IF;
        RAISE EXCEPTION 'Cannot split cash assignment directly; use core cash handover';
    END IF;

    -- Create child assignment
    INSERT INTO public.production_assignments (
        project_id,
        recipient_id,
        responsible_name,
        title,
        due_at,
        status,
        cash_only,
        version,
        created_by_auth_user_id
    ) VALUES (
        v_assign.project_id,
        v_target_rec_id,
        v_target_rec_name,
        coalesce(p_payload->>'title', 'งานแบ่งจาก ' || v_assign.responsible_name),
        v_assign.due_at,
        'in_progress',
        false,
        1,
        v_auth_uid
    ) RETURNING id INTO v_child_id;

    -- Deduct split quantity from parent and insert child lines
    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_payload->'line_quantities') LOOP
        v_line_id := (v_elem->>'line_id')::UUID;
        v_split_qty := (v_elem->>'quantity')::NUMERIC(12,2);

        IF v_split_qty <= 0 THEN
            RAISE EXCEPTION 'Split quantity must be strictly greater than 0';
        END IF;

        SELECT * INTO v_line
        FROM public.production_assignment_lines
        WHERE id = v_line_id AND assignment_id = v_assign_id
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
        UPDATE public.production_assignment_lines
        SET required_qty = required_qty - v_split_qty,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_line_id;

        -- Add to child
        INSERT INTO public.production_assignment_lines (
            assignment_id, description, required_qty, unit, is_active
        ) VALUES (
            v_child_id, v_line.description, v_split_qty, v_line.unit, true
        );
    END LOOP;

    UPDATE public.production_assignments
    SET version = version + 1,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_assign_id;

    INSERT INTO public.production_assignment_events (
        assignment_id, event_type, actor_auth_user_id, actor_name, reason, details
    ) VALUES (
        v_assign_id, 'split', v_auth_uid, v_actor_name, p_payload->>'reason',
        jsonb_build_object('child_assignment_id', v_child_id, 'to_person', v_target_rec_name)
    );

    v_result := jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'parent_assignment_id', v_assign_id,
            'child_assignment', jsonb_build_object('id', v_child_id, 'recipient_name', v_target_rec_name)
        )
    );

    INSERT INTO public.inventory_idempotency_records (
        idempotency_key, action_name, payload_hash, actor_auth_user_id, response_payload
    ) VALUES (
        p_idempotency_key, 'assignment_split', v_payload_hash, v_auth_uid, v_result
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 9.4 Submit Production Work
CREATE OR REPLACE FUNCTION public.warehouse_submit_work(
    p_payload JSONB,
    p_idempotency_key UUID
)
RETURNS JSONB AS $$
DECLARE
    v_auth_uid UUID;
    v_actor_name TEXT;
    v_payload_hash TEXT;
    v_cached RECORD;
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

    PERFORM pg_advisory_xact_lock(hashtext(p_idempotency_key::text));

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

    v_payload_hash := md5('work_submit:' || p_payload::text);

    SELECT * INTO v_cached
    FROM public.inventory_idempotency_records
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
        IF v_cached.action_name <> 'work_submit' OR v_cached.payload_hash <> v_payload_hash OR v_cached.actor_auth_user_id <> v_auth_uid THEN
            RAISE EXCEPTION 'Idempotency mismatch: Key reused with different action or payload';
        END IF;
        RETURN v_cached.response_payload;
    END IF;

    v_assign_id := (p_payload->>'assignment_id')::UUID;

    SELECT * INTO v_assign
    FROM public.production_assignments
    WHERE id = v_assign_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assignment % not found', v_assign_id;
    END IF;

    IF v_assign.cash_only THEN
        RAISE EXCEPTION 'Generic submit on cash assignment is prohibited; prepared banknotes flow through cash ledger';
    END IF;

    IF v_assign.status IN ('completed', 'cancelled') THEN
        RAISE EXCEPTION 'Cannot submit work for assignment in % status', v_assign.status;
    END IF;

    INSERT INTO public.production_submissions (
        assignment_id,
        submitted_by_auth_user_id,
        submitted_by_name,
        note,
        status
    ) VALUES (
        v_assign_id,
        v_auth_uid,
        v_actor_name,
        p_payload->>'note',
        'pending'
    ) RETURNING id INTO v_sub_id;

    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_payload->'lines') LOOP
        v_line_id := (v_elem->>'line_id')::UUID;
        v_sub_qty := (v_elem->>'quantity')::NUMERIC(12,2);

        IF v_sub_qty <= 0 THEN
            RAISE EXCEPTION 'Submission quantity must be strictly greater than 0';
        END IF;

        SELECT * INTO v_line
        FROM public.production_assignment_lines
        WHERE id = v_line_id AND assignment_id = v_assign_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Line % not found in assignment', v_line_id;
        END IF;

        IF (v_line.accepted_qty + v_line.pending_qty + v_sub_qty) > v_line.required_qty THEN
            RAISE EXCEPTION 'Cannot submit % units. Exceeds required quantity (%) for line %',
                v_sub_qty, v_line.required_qty, v_line_id;
        END IF;

        INSERT INTO public.production_submission_lines (
            submission_id, line_id, quantity, accepted_qty, rejected_qty
        ) VALUES (
            v_sub_id, v_line_id, v_sub_qty, 0, 0
        );

        UPDATE public.production_assignment_lines
        SET submitted_qty = submitted_qty + v_sub_qty,
            pending_qty = pending_qty + v_sub_qty,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_line_id;
    END LOOP;

    -- Update assignment status to submitted if it was in_progress
    IF v_assign.status = 'in_progress' THEN
        UPDATE public.production_assignments
        SET status = 'submitted',
            version = version + 1,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_assign_id;
    END IF;

    INSERT INTO public.production_assignment_events (
        assignment_id, event_type, actor_auth_user_id, actor_name, details
    ) VALUES (
        v_assign_id, 'submission_created', v_auth_uid, v_actor_name,
        jsonb_build_object('submission_id', v_sub_id, 'note', p_payload->>'note')
    );

    v_result := jsonb_build_object(
        'success', true,
        'data', jsonb_build_object('id', v_sub_id, 'assignment_id', v_assign_id)
    );

    INSERT INTO public.inventory_idempotency_records (
        idempotency_key, action_name, payload_hash, actor_auth_user_id, response_payload
    ) VALUES (
        p_idempotency_key, 'work_submit', v_payload_hash, v_auth_uid, v_result
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 9.5 Inspect Production Work
CREATE OR REPLACE FUNCTION public.warehouse_inspect_work(
    p_payload JSONB,
    p_idempotency_key UUID
)
RETURNS JSONB AS $$
DECLARE
    v_auth_uid UUID;
    v_actor_name TEXT;
    v_payload_hash TEXT;
    v_cached RECORD;
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

    PERFORM pg_advisory_xact_lock(hashtext(p_idempotency_key::text));

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

    v_payload_hash := md5('work_inspect:' || p_payload::text);

    SELECT * INTO v_cached
    FROM public.inventory_idempotency_records
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
        IF v_cached.action_name <> 'work_inspect' OR v_cached.payload_hash <> v_payload_hash OR v_cached.actor_auth_user_id <> v_auth_uid THEN
            RAISE EXCEPTION 'Idempotency mismatch: Key reused with different action or payload';
        END IF;
        RETURN v_cached.response_payload;
    END IF;

    v_sub_id := (p_payload->>'submission_id')::UUID;

    SELECT * INTO v_sub
    FROM public.production_submissions
    WHERE id = v_sub_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Submission % not found', v_sub_id;
    END IF;

    SELECT * INTO v_assign
    FROM public.production_assignments
    WHERE id = v_sub.assignment_id
    FOR UPDATE;

    IF v_assign.cash_only THEN
        RAISE EXCEPTION 'Generic inspect on cash assignment is prohibited; prepared banknotes flow through cash ledger';
    END IF;

    INSERT INTO public.production_inspections (
        submission_id,
        inspector_auth_user_id,
        inspector_name,
        notes
    ) VALUES (
        v_sub_id,
        v_auth_uid,
        v_actor_name,
        p_payload->>'note'
    ) RETURNING id INTO v_insp_id;

    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_payload->'lines') LOOP
        v_sub_line_id := (v_elem->>'submission_line_id')::UUID;
        v_acc_qty := coalesce((v_elem->>'accepted_qty')::NUMERIC(12,2), 0);
        v_rej_qty := coalesce((v_elem->>'rejected_qty')::NUMERIC(12,2), 0);

        IF v_acc_qty < 0 OR v_rej_qty < 0 THEN
            RAISE EXCEPTION 'Accepted and rejected quantities must be non-negative';
        END IF;

        SELECT * INTO v_sub_line
        FROM public.production_submission_lines
        WHERE id = v_sub_line_id AND submission_id = v_sub_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Submission line % not found', v_sub_line_id;
        END IF;

        IF (v_acc_qty + v_rej_qty) > v_sub_line.pending_qty THEN
            RAISE EXCEPTION 'Inspection total (% + %) cannot accept more than pending quantity (%) for line %',
                v_acc_qty, v_rej_qty, v_sub_line.pending_qty, v_sub_line_id;
        END IF;

        INSERT INTO public.production_inspection_lines (
            inspection_id, submission_line_id, accepted_qty, rejected_qty, notes
        ) VALUES (
            v_insp_id, v_sub_line_id, v_acc_qty, v_rej_qty, v_elem->>'notes'
        );

        -- Update submission line
        UPDATE public.production_submission_lines
        SET accepted_qty = accepted_qty + v_acc_qty,
            rejected_qty = rejected_qty + v_rej_qty
        WHERE id = v_sub_line_id;

        -- Update assignment line counters:
        -- accepted increases accepted_qty; rejected frees remaining work (rejected_qty increases, pending decreases)
        UPDATE public.production_assignment_lines
        SET accepted_qty = accepted_qty + v_acc_qty,
            rejected_qty = rejected_qty + v_rej_qty,
            pending_qty = pending_qty - (v_acc_qty + v_rej_qty),
            updated_at = timezone('utc'::text, now())
        WHERE id = v_sub_line.line_id;
    END LOOP;

    -- Update submission status
    SELECT EXISTS (
        SELECT 1 FROM public.production_submission_lines
        WHERE submission_id = v_sub_id AND pending_qty > 0
    ) INTO v_has_pending_sub_lines;

    UPDATE public.production_submissions
    SET status = CASE WHEN v_has_pending_sub_lines THEN 'partially_inspected' ELSE 'inspected' END,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_sub_id;

    -- Update assignment status: if pending work remains and no other pending submissions, status can revert to in_progress
    SELECT EXISTS (
        SELECT 1 FROM public.production_assignment_lines
        WHERE assignment_id = v_assign.id AND accepted_qty < required_qty
    ) INTO v_has_remaining_work;

    IF v_has_remaining_work THEN
        -- If no more uninspected submissions
        IF NOT EXISTS (
            SELECT 1 FROM public.production_submissions
            WHERE assignment_id = v_assign.id AND status = 'pending'
        ) THEN
            UPDATE public.production_assignments
            SET status = 'in_progress',
                updated_at = timezone('utc'::text, now())
            WHERE id = v_assign.id;
        END IF;
    END IF;

    INSERT INTO public.production_assignment_events (
        assignment_id, event_type, actor_auth_user_id, actor_name, details
    ) VALUES (
        v_assign.id, 'inspection_completed', v_auth_uid, v_actor_name,
        jsonb_build_object('inspection_id', v_insp_id, 'submission_id', v_sub_id)
    );

    v_result := jsonb_build_object(
        'success', true,
        'data', jsonb_build_object('id', v_insp_id, 'submission_id', v_sub_id)
    );

    INSERT INTO public.inventory_idempotency_records (
        idempotency_key, action_name, payload_hash, actor_auth_user_id, response_payload
    ) VALUES (
        p_idempotency_key, 'work_inspect', v_payload_hash, v_auth_uid, v_result
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 9.6 Set Production Assignment Status
CREATE OR REPLACE FUNCTION public.warehouse_set_assignment_status(
    p_payload JSONB,
    p_idempotency_key UUID
)
RETURNS JSONB AS $$
DECLARE
    v_auth_uid UUID;
    v_actor_name TEXT;
    v_payload_hash TEXT;
    v_cached RECORD;
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

    PERFORM pg_advisory_xact_lock(hashtext(p_idempotency_key::text));

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

    v_payload_hash := md5('assignment_set_status:' || p_payload::text);

    SELECT * INTO v_cached
    FROM public.inventory_idempotency_records
    WHERE idempotency_key = p_idempotency_key;

    IF FOUND THEN
        IF v_cached.action_name <> 'assignment_set_status' OR v_cached.payload_hash <> v_payload_hash OR v_cached.actor_auth_user_id <> v_auth_uid THEN
            RAISE EXCEPTION 'Idempotency mismatch: Key reused with different action or payload';
        END IF;
        RETURN v_cached.response_payload;
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

    SELECT * INTO v_assign
    FROM public.production_assignments
    WHERE id = v_assign_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Assignment % not found', v_assign_id;
    END IF;

    IF v_assign.version <> v_expected_ver THEN
        RAISE EXCEPTION 'Version conflict: Expected version % but found % (stale overwrite rejected)', v_expected_ver, v_assign.version;
    END IF;

    -- Cash assignment status modification requires cash permissions for any status
    IF v_assign.cash_only AND NOT public.fn_can_manage_cash(v_auth_uid) THEN
        RAISE EXCEPTION 'Unauthorized: Cash management permissions required for cash assignment';
    END IF;

    IF v_new_status = 'completed' THEN
        -- Verify all active lines are fully accepted and no pending inspection
        SELECT * INTO v_incomplete
        FROM public.production_assignment_lines
        WHERE assignment_id = v_assign_id
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

    UPDATE public.production_assignments
    SET status = v_new_status,
        version = version + 1,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_assign_id;

    INSERT INTO public.production_assignment_events (
        assignment_id, event_type, actor_auth_user_id, actor_name, from_status, to_status, reason
    ) VALUES (
        v_assign_id, 'status_changed', v_auth_uid, v_actor_name, v_assign.status, v_new_status, v_reason
    );

    v_result := jsonb_build_object(
        'success', true,
        'data', jsonb_build_object('id', v_assign_id, 'status', v_new_status, 'version', v_assign.version + 1)
    );

    INSERT INTO public.inventory_idempotency_records (
        idempotency_key, action_name, payload_hash, actor_auth_user_id, response_payload
    ) VALUES (
        p_idempotency_key, 'assignment_set_status', v_payload_hash, v_auth_uid, v_result
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ------------------------------------------------------------------------------
-- 10. PROJECT PRODUCTION BOARD RPC (warehouse_load_production_project)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.warehouse_load_production_project(
    p_project_id TEXT,
    p_limit INT DEFAULT 100,
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
    v_summary JSONB;
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
    v_clean_limit := LEAST(GREATEST(coalesce(p_limit, 100), 1), 200);
    v_clean_offset := GREATEST(coalesce(p_offset, 0), 0);

    SELECT id, name INTO v_project
    FROM public.projects
    WHERE id = p_project_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Project % not found', p_project_id;
    END IF;

    -- Check if restricted cash assignments exist in this project
    SELECT EXISTS (
        SELECT 1 FROM public.production_assignments
        WHERE project_id = p_project_id AND cash_only = TRUE
    ) INTO v_has_restricted;

    -- Compute project-wide summary counts
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
    FROM public.production_assignments
    WHERE project_id = p_project_id;

    -- Ready for next step is true ONLY when there is at least 1 completed task and all tasks are resolved (not when no tasks or all tasks cancelled)
    v_ready_for_next := (v_total_count > 0 AND v_completed_count > 0 AND (v_completed_count + v_cancelled_count) = v_total_count);

    -- Load assignments (Filtering out cash_only assignments if caller lacks cash permission)
    SELECT coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) INTO v_assignments
    FROM (
        SELECT 
            pa.id,
            pa.title,
            pa.status,
            pa.version,
            pa.recipient_id,
            pa.responsible_name,
            pa.team_members_snapshot,
            pa.due_at,
            pa.source_document_id,
            pa.source_cash_batch_id,
            pa.cash_only,
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
                FROM public.production_assignment_lines pal
                WHERE pal.assignment_id = pa.id AND pal.is_active = TRUE
            ), '[]'::jsonb) AS lines,
            coalesce((
                SELECT jsonb_agg(jsonb_build_object(
                    'id', ps.id,
                    'submitted_at', ps.submitted_at,
                    'submitted_by_name', ps.submitted_by_name,
                    'note', ps.note,
                    'status', ps.status,
                    'lines', coalesce((
                        SELECT jsonb_agg(jsonb_build_object(
                            'id', psl.id,
                            'line_id', psl.line_id,
                            'quantity', psl.quantity,
                            'accepted_qty', psl.accepted_qty,
                            'rejected_qty', psl.rejected_qty,
                            'pending_qty', psl.pending_qty
                        ))
                        FROM public.production_submission_lines psl
                        WHERE psl.submission_id = ps.id
                    ), '[]'::jsonb),
                    'inspections', coalesce((
                        SELECT jsonb_agg(jsonb_build_object(
                            'id', pi.id,
                            'inspector_name', pi.inspector_name,
                            'inspected_at', pi.inspected_at,
                            'notes', pi.notes,
                            'lines', coalesce((
                                SELECT jsonb_agg(jsonb_build_object(
                                    'id', pil.id,
                                    'submission_line_id', pil.submission_line_id,
                                    'accepted_qty', pil.accepted_qty,
                                    'rejected_qty', pil.rejected_qty,
                                    'notes', pil.notes
                                ))
                                FROM public.production_inspection_lines pil
                                WHERE pil.inspection_id = pi.id
                            ), '[]'::jsonb)
                        ) ORDER BY pi.inspected_at ASC)
                        FROM public.production_inspections pi
                        WHERE pi.submission_id = ps.id
                    ), '[]'::jsonb)
                ) ORDER BY ps.submitted_at DESC)
                FROM public.production_submissions ps
                WHERE ps.assignment_id = pa.id
            ), '[]'::jsonb) AS submissions
        FROM public.production_assignments pa
        WHERE pa.project_id = p_project_id
          AND (NOT pa.cash_only OR v_can_manage_cash)
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

-- ------------------------------------------------------------------------------
-- 11. GRANTS & REVOCATIONS
-- ------------------------------------------------------------------------------

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

COMMIT;
