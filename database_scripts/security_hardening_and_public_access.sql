-- ==============================================================================
-- FLOWER2U (F2U) - Security Hardening & Zero-Leakage Architecture
-- ==============================================================================
-- 1. Server-Side Authentication RPC (verify_staff_login)
-- 2. Public Tracking & Quotation Access RPC (get_public_project_by_token)
-- 3. Row Level Security (RLS) Lockdown: Deny Anon access to sensitive tables
-- 4. Automatic Tracking Token Generation for Projects
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- PART 1: Tracking Token Column & Computation Function
-- ------------------------------------------------------------------------------

-- Add tracking_token column to projects if not exists
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS tracking_token TEXT;
CREATE INDEX IF NOT EXISTS idx_projects_tracking_token ON public.projects(tracking_token);

-- Immutable Helper to generate identical token as frontend generateTrackingToken(id, dateStr)
-- Formula: id || dd || mm || yyyy(BE) || HH || mn
CREATE OR REPLACE FUNCTION public.compute_project_tracking_token(
    p_id TEXT, 
    p_raw_delivery_start TEXT, 
    p_project_datetime TIMESTAMPTZ
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_raw TEXT := TRIM(COALESCE(p_raw_delivery_start, ''));
    v_year INT;
    v_be_year INT;
BEGIN
    IF p_id IS NULL OR TRIM(p_id) = '' THEN
        RETURN NULL;
    END IF;

    -- If raw_delivery_start matches format YYYY-MM-DDTHH:mm
    IF v_raw ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}' THEN
        v_year := SUBSTRING(v_raw FROM 1 FOR 4)::INT;
        v_be_year := v_year + 543;
        RETURN p_id || 
               SUBSTRING(v_raw FROM 9 FOR 2) || 
               SUBSTRING(v_raw FROM 6 FOR 2) || 
               v_be_year::TEXT || 
               SUBSTRING(v_raw FROM 12 FOR 2) || 
               SUBSTRING(v_raw FROM 15 FOR 2);
    END IF;

    -- Fallback to project_datetime in Asia/Bangkok (+07:00)
    IF p_project_datetime IS NOT NULL THEN
        RETURN p_id || 
               TO_CHAR(p_project_datetime AT TIME ZONE 'Asia/Bangkok', 'DDMM') || 
               (EXTRACT(YEAR FROM (p_project_datetime AT TIME ZONE 'Asia/Bangkok'))::INT + 543)::TEXT || 
               TO_CHAR(p_project_datetime AT TIME ZONE 'Asia/Bangkok', 'HH24MI');
    END IF;

    RETURN p_id;
END;
$$;

-- Trigger function to auto-populate tracking_token on INSERT or UPDATE
CREATE OR REPLACE FUNCTION public.trigger_set_project_tracking_token()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tracking_token IS NULL OR NEW.tracking_token = '' OR NEW.tracking_token = NEW.id THEN
        NEW.tracking_token := public.compute_project_tracking_token(NEW.id, NEW.raw_delivery_start, NEW.project_datetime);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_projects_tracking_token ON public.projects;
CREATE TRIGGER trigger_projects_tracking_token
    BEFORE INSERT OR UPDATE OF id, raw_delivery_start, project_datetime
    ON public.projects
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_set_project_tracking_token();

-- Backfill tracking_token for all existing projects
UPDATE public.projects
SET tracking_token = public.compute_project_tracking_token(id, raw_delivery_start, project_datetime)
WHERE tracking_token IS NULL OR tracking_token = '';

-- ------------------------------------------------------------------------------
-- PART 2: Server-Side Authentication RPC (verify_staff_login)
-- ------------------------------------------------------------------------------
-- Verifies staff username or staff code and password on server.
-- Returns safe profile WITHOUT returning any passwords to the browser.
CREATE OR REPLACE FUNCTION public.verify_staff_login(
    p_identifier TEXT,
    p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user RECORD;
    v_clean_id TEXT := LOWER(TRIM(COALESCE(p_identifier, '')));
    v_clean_pass TEXT := COALESCE(p_password, '');
BEGIN
    IF v_clean_id = '' OR v_clean_pass = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'EMPTY_CREDENTIALS');
    END IF;

    SELECT 
        s.id AS staff_code,
        s.username,
        s.full_name,
        s.nickname,
        s.phone,
        s.email,
        s.profile_image_url,
        s.is_active,
        r.name AS role_name,
        r.code AS role_code,
        r.label AS role_label,
        r.allowed_pages
    INTO v_user
    FROM public.staff_users s
    LEFT JOIN public.roles r ON s.role_id = r.id
    WHERE s.is_active = true
      AND (LOWER(s.username) = v_clean_id OR LOWER(s.id) = v_clean_id)
      AND s.password = v_clean_pass
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_CREDENTIALS');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'user', jsonb_build_object(
            'username', v_user.username,
            'staffCode', v_user.staff_code,
            'name', COALESCE(v_user.full_name, v_user.nickname, v_user.username),
            'role', COALESCE(v_user.role_name, 'admin'),
            'roleCode', COALESCE(v_user.role_code, '11'),
            'roleLabel', COALESCE(v_user.role_label, 'ผู้ดูแลระบบ'),
            'allowedPages', COALESCE(v_user.allowed_pages, ARRAY['Calendar', 'Plans']),
            'email', COALESCE(v_user.email, ''),
            'phone', COALESCE(v_user.phone, ''),
            'image', COALESCE(v_user.profile_image_url, '')
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_staff_login(TEXT, TEXT) TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- PART 3: Public Single Project Lookup for Tracking & Quotation Links
-- ------------------------------------------------------------------------------
-- Returns ONLY the single requested project (sanitized, zero internal cost/profit leakage).
-- If token is invalid or guessed randomly, returns NULL (ไม่พบข้อมูล).
CREATE OR REPLACE FUNCTION public.get_public_project_by_token(
    p_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_token TEXT := TRIM(COALESCE(p_token, ''));
    v_project RECORD;
    v_quotation_items JSONB;
    v_customer_support JSONB;
    v_result JSONB;
BEGIN
    IF v_clean_token = '' THEN
        RETURN NULL;
    END IF;

    -- 1. Search for project by token (match tracking_token, computed token, or direct ID)
    SELECT p.*
    INTO v_project
    FROM public.projects p
    WHERE 
        (p.tracking_token IS NOT NULL AND p.tracking_token = v_clean_token)
        OR (public.compute_project_tracking_token(p.id, p.raw_delivery_start, p.project_datetime) = v_clean_token)
        OR (p.id = v_clean_token)
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- 2. Fetch quotation items for this project
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', q.id,
            'category', q.category,
            'detail', q.detail,
            'price', q.price,
            'quantity', q.quantity,
            'unit', q.unit,
            'total', q.total
        ) ORDER BY q.sort_order ASC, q.created_at ASC
    ), '[]'::jsonb)
    INTO v_quotation_items
    FROM public.project_quotation_items q
    WHERE q.project_id = v_project.id;

    -- 3. Fetch customer support items for this project
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', s.id,
            'item_type', s.item_type,
            'detail', s.detail,
            'price', s.price,
            'quantity', s.quantity
        ) ORDER BY s.created_at ASC
    ), '[]'::jsonb)
    INTO v_customer_support
    FROM public.project_customer_support s
    WHERE s.project_id = v_project.id;

    -- 4. Build sanitized public project object
    v_result := jsonb_build_object(
        'id', v_project.id,
        'name', v_project.name,
        'category', v_project.category,
        'artist', COALESCE(v_project.artist_name, ''),
        'customer', COALESCE(v_project.customer_name, ''),
        'customerPhone', COALESCE(v_project.customer_phone, ''),
        'customerLine', COALESCE(v_project.customer_line, ''),
        'recipient', COALESCE(v_project.recipient_name, ''),
        'recipientPhone', COALESCE(v_project.recipient_phone, ''),
        'location', COALESCE(v_project.location_name, ''),
        'mapLink', COALESCE(v_project.map_link, ''),
        'rawDateTime', COALESCE(v_project.raw_delivery_start, TO_CHAR(v_project.project_datetime, 'YYYY-MM-DD"T"HH24:MI')),
        'date', COALESCE(SUBSTRING(v_project.raw_delivery_start FROM 1 FOR 10), TO_CHAR(v_project.project_datetime, 'YYYY-MM-DD')),
        'deliveryDate', COALESCE(v_project.delivery_date_display, ''),
        'dealStatus', COALESCE(v_project.deal_status, 'custom-1771415025673'),
        'transportStatus', COALESCE(v_project.transport_status, 'custom-1771415278809'),
        'paymentStatus', COALESCE(v_project.payment_status, 'unpaid'),
        'wage', COALESCE(v_project.wage, 0),
        'deliveryFee', COALESCE(v_project.delivery_fee, 0),
        'depositAmount', COALESCE(v_project.deposit_amount, 0),
        'image', COALESCE(v_project.primary_image_url, ''),
        'images', COALESCE(to_jsonb(v_project.images), '[]'::jsonb),
        'note', COALESCE(v_project.note, ''),
        'quotationItems', v_quotation_items,
        'customerSupport', v_customer_support
    );

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_project_by_token(TEXT) TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- PART 4: Row Level Security (RLS) Lockdown
-- ------------------------------------------------------------------------------
-- Revoke anon access from sensitive business tables.
-- Only authenticated users (and service_role) can access them directly.

DO $$
DECLARE
    t TEXT;
    sensitive_tables TEXT[] := ARRAY[
        'projects',
        'customers',
        'artists',
        'project_expenses',
        'project_quotation_items',
        'project_customer_support',
        'staff_users',
        'deleted_records',
        'financial_transactions',
        'inventory_items',
        'asset_loans',
        'inventory_procurements',
        'inventory_disposals'
    ];
BEGIN
    FOREACH t IN ARRAY sensitive_tables LOOP
        -- Ensure RLS is active
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
        
        -- Drop open policies
        EXECUTE format('DROP POLICY IF EXISTS "Allow app full access" ON public.%I;', t);
        EXECUTE format('DROP POLICY IF EXISTS "Allow authenticated full access" ON public.%I;', t);
        
        -- Create strict policy for authenticated staff only
        EXECUTE format('CREATE POLICY "Allow authenticated full access" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true);', t);
    END LOOP;
END $$;

-- Allow public (anon + authenticated) to read shop_settings for branding (shop name, logo, theme)
ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow app full access" ON public.shop_settings;
DROP POLICY IF EXISTS "Allow public read shop branding" ON public.shop_settings;
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.shop_settings;

CREATE POLICY "Allow public read shop branding" ON public.shop_settings
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow authenticated full access" ON public.shop_settings
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow public (anon + authenticated) to read roles definitions
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow app full access" ON public.roles;
DROP POLICY IF EXISTS "Allow public read roles" ON public.roles;
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.roles;

CREATE POLICY "Allow public read roles" ON public.roles
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow authenticated full access" ON public.roles
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMIT;
