-- ==============================================================================
-- FLOWER2U (F2U) - Zero-Knowledge One-Time Staff Password Reset System
-- ==============================================================================
-- 1. เปิดใช้งาน pgcrypto ใน schema extensions สำหรับสร้าง Token สุ่มและ SHA-256 / bcrypt
-- 2. สร้างตาราง public.staff_password_resets (เก็บเฉพาะ SHA-256 hash เท่านั้น + เปิด RLS ปิดสิทธิ์ตรง)
-- 3. สร้าง 3 SECURITY DEFINER RPCs:
--    - create_staff_reset_token(p_staff_id, p_ttl_minutes) [authenticated Admin เท่านั้น]
--    - validate_staff_reset_token(p_token) [anon, authenticated + บล็อกผู้ใช้ที่ถูกแบน/ปิดใช้งาน]
--    - consume_staff_reset_token(p_token, p_new_password) [anon, authenticated + ซิงก์ auth.users ครบทุกรูปแบบ]
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Extensions & Required Columns
-- ------------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.staff_users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE public.staff_users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.staff_users ADD COLUMN IF NOT EXISTS auth_user_id UUID;
ALTER TABLE public.staff_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ------------------------------------------------------------------------------
-- 2. Table: public.staff_password_resets (Zero Direct Table Access)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id TEXT NOT NULL REFERENCES public.staff_users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_password_resets_staff_id
    ON public.staff_password_resets(staff_id);

CREATE INDEX IF NOT EXISTS idx_staff_password_resets_token_hash
    ON public.staff_password_resets(token_hash);

ALTER TABLE public.staff_password_resets ENABLE ROW LEVEL SECURITY;

-- ปิดสิทธิ์การเข้าถึงตารางโดยตรงจาก anon และ authenticated (บังคับผ่าน SECURITY DEFINER RPCs เท่านั้น)
REVOKE ALL ON TABLE public.staff_password_resets FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 3.1 RPC: create_staff_reset_token (เฉพาะผู้ดูแลระบบ Admin ที่ล็อกอินและสถานะปกติเท่านั้น)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_staff_reset_token(
    p_staff_id TEXT,
    p_ttl_minutes INT DEFAULT 15
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_caller UUID := auth.uid();
    v_jwt JSONB := coalesce(auth.jwt(), '{}'::jsonb);
    v_caller_email TEXT := lower(trim(coalesce(v_jwt ->> 'email', '')));
    v_caller_meta_username TEXT := lower(trim(coalesce(v_jwt -> 'user_metadata' ->> 'username', '')));
    v_caller_meta_code TEXT := trim(coalesce(v_jwt -> 'user_metadata' ->> 'staff_code', ''));
    v_caller_staff RECORD;
    v_is_admin_caller BOOLEAN := false;
    v_clean_staff_id TEXT := trim(coalesce(p_staff_id, ''));
    v_ttl INT := GREATEST(5, LEAST(1440, coalesce(p_ttl_minutes, 15)));
    v_staff RECORD;
    v_raw_token TEXT;
    v_token_hash TEXT;
    v_expires_at TIMESTAMPTZ;
BEGIN
    IF v_caller IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: กรุณาเข้าสู่ระบบก่อนสร้างลิงก์ตั้งรหัสผ่าน';
    END IF;

    -- ตรวจสอบตัวตนและสิทธิ์ของผู้เรียก (ต้องเป็น Admin ที่ยังปฏิบัติงานและไม่ถูกระงับ)
    SELECT
        s.id,
        s.username,
        s.is_active,
        to_jsonb(s) AS staff_json,
        r.name AS role_name,
        to_jsonb(r) AS role_json,
        r.allowed_pages
    INTO v_caller_staff
    FROM public.staff_users s
    LEFT JOIN public.roles r ON s.role_id = r.id
    WHERE (
        s.auth_user_id = v_caller
        OR (NULLIF(to_jsonb(s)->>'auth_user_id', ''))::uuid = v_caller
        OR (
            v_caller_email <> ''
            AND (
                lower(s.email) = v_caller_email
                OR (
                    nullif(regexp_replace(s.username, '[^a-zA-Z0-9_-]', '', 'g'), '') IS NOT NULL
                    AND lower(regexp_replace(s.username, '[^a-zA-Z0-9_-]', '', 'g')) || '@flower2u.internal' = v_caller_email
                )
                OR (
                    nullif(regexp_replace(s.username, '[^a-zA-Z0-9_-]', '', 'g'), '') IS NULL
                    AND v_caller_email = 'staff@flower2u.internal'
                    AND (
                        (v_caller_meta_username <> '' AND lower(trim(s.username)) = v_caller_meta_username)
                        OR (v_caller_meta_code <> '' AND s.id = v_caller_meta_code)
                    )
                )
                OR lower(trim(s.username)) || '@flower2u.internal' = v_caller_email
            )
        )
    )
    ORDER BY
        CASE
            WHEN s.auth_user_id = v_caller THEN 0
            WHEN v_caller_email <> '' AND lower(s.email) = v_caller_email THEN 1
            ELSE 2
        END
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'FORBIDDEN: ไม่มีสิทธิ์สร้างลิงก์เปลี่ยนรหัสผ่าน';
    END IF;

    IF NOT (
        coalesce(v_caller_staff.is_active, true) = true
        AND coalesce((NULLIF(v_caller_staff.staff_json->>'is_banned_permanent', ''))::boolean, false) = false
        AND (
            (NULLIF(v_caller_staff.staff_json->>'banned_until', '')) IS NULL
            OR (NULLIF(v_caller_staff.staff_json->>'banned_until', ''))::timestamptz <= now()
        )
    ) THEN
        RAISE EXCEPTION 'FORBIDDEN: ไม่มีสิทธิ์สร้างลิงก์เปลี่ยนรหัสผ่าน';
    END IF;

    v_is_admin_caller := (
        lower(coalesce(v_caller_staff.role_name, '')) IN ('admin', 'owner')
        OR coalesce((NULLIF(v_caller_staff.role_json->>'can_manage_users', ''))::boolean, false) = true
        OR 'Staff' = ANY(coalesce(v_caller_staff.allowed_pages, ARRAY[]::text[]))
    );

    IF NOT v_is_admin_caller THEN
        RAISE EXCEPTION 'FORBIDDEN: ไม่มีสิทธิ์สร้างลิงก์เปลี่ยนรหัสผ่าน';
    END IF;

    IF v_clean_staff_id = '' THEN
        RAISE EXCEPTION 'INVALID_STAFF_ID: กรุณาระบุรหัสพนักงาน';
    END IF;

    SELECT s.id, s.username, s.full_name, s.nickname
    INTO v_staff
    FROM public.staff_users s
    WHERE s.id = v_clean_staff_id
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'STAFF_NOT_FOUND: ไม่พบข้อมูลพนักงานรหัส %', v_clean_staff_id;
    END IF;

    -- ยกเลิก Token เดิมที่ยังไม่ถูกใช้งานของพนักงานคนนี้ทันที
    UPDATE public.staff_password_resets
    SET used_at = now()
    WHERE staff_id = v_staff.id
      AND used_at IS NULL;

    -- สร้าง One-Time Token ความปลอดภัยสูง (24 random bytes = 48 hex chars) และเก็บเฉพาะ SHA-256 hash
    v_raw_token := 'rst_' || encode(extensions.gen_random_bytes(24), 'hex');
    v_token_hash := encode(extensions.digest(v_raw_token::text, 'sha256'::text), 'hex');
    v_expires_at := now() + make_interval(mins => v_ttl);

    INSERT INTO public.staff_password_resets (
        staff_id,
        token_hash,
        expires_at,
        created_by
    ) VALUES (
        v_staff.id,
        v_token_hash,
        v_expires_at,
        v_caller
    );

    RETURN jsonb_build_object(
        'token', v_raw_token,
        'expires_at', v_expires_at,
        'ttl_minutes', v_ttl,
        'staff_id', v_staff.id,
        'username', v_staff.username,
        'full_name', v_staff.full_name,
        'nickname', v_staff.nickname
    );
END;
$$;

REVOKE ALL ON FUNCTION public.create_staff_reset_token(TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_staff_reset_token(TEXT, INT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 3.2 RPC: validate_staff_reset_token (ตรวจสอบสถานะลิงก์ก่อนแสดงฟอร์ม)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_staff_reset_token(
    p_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_clean_token TEXT := trim(coalesce(p_token, ''));
    v_hash TEXT;
    v_row RECORD;
BEGIN
    IF v_clean_token = '' OR left(v_clean_token, 4) <> 'rst_' THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'INVALID');
    END IF;

    v_hash := encode(extensions.digest(v_clean_token::text, 'sha256'::text), 'hex');

    SELECT
        r.used_at,
        r.expires_at,
        s.id AS staff_id,
        s.username,
        s.full_name,
        s.nickname,
        s.is_active,
        to_jsonb(s) AS staff_json
    INTO v_row
    FROM public.staff_password_resets r
    JOIN public.staff_users s ON s.id = r.staff_id
    WHERE r.token_hash = v_hash
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'INVALID');
    END IF;

    IF v_row.used_at IS NOT NULL THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'USED');
    END IF;

    IF v_row.expires_at <= now() THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'EXPIRED');
    END IF;

    IF NOT (
        coalesce(v_row.is_active, true) = true
        AND coalesce((NULLIF(v_row.staff_json->>'is_banned_permanent', ''))::boolean, false) = false
        AND (
            (NULLIF(v_row.staff_json->>'banned_until', '')) IS NULL
            OR (NULLIF(v_row.staff_json->>'banned_until', ''))::timestamptz <= now()
        )
    ) THEN
        RETURN jsonb_build_object('valid', false, 'reason', 'SUSPENDED');
    END IF;

    RETURN jsonb_build_object(
        'valid', true,
        'staff_id', v_row.staff_id,
        'username', v_row.username,
        'full_name', v_row.full_name,
        'nickname', v_row.nickname,
        'expires_at', v_row.expires_at
    );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_staff_reset_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_staff_reset_token(TEXT) TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 3.3 RPC: consume_staff_reset_token (ใช้สิทธิ์ตั้งรหัสผ่านใหม่แบบครั้งเดียวจบ)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_staff_reset_token(
    p_token TEXT,
    p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_clean_token TEXT := trim(coalesce(p_token, ''));
    v_clean_pass TEXT := trim(coalesce(p_new_password, ''));
    v_auth_pass TEXT;
    v_hash TEXT;
    v_staff_id TEXT;
    v_existing RECORD;
    v_staff RECORD;
    v_username TEXT;
    v_email TEXT;
BEGIN
    IF length(v_clean_pass) < 6 THEN
        RETURN jsonb_build_object(
            'success', false,
            'reason', 'WEAK_PASSWORD',
            'message', 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร'
        );
    END IF;

    IF v_clean_token = '' OR left(v_clean_token, 4) <> 'rst_' THEN
        RETURN jsonb_build_object('success', false, 'reason', 'INVALID');
    END IF;

    v_hash := encode(extensions.digest(v_clean_token::text, 'sha256'::text), 'hex');

    SELECT
        r.staff_id,
        r.used_at,
        r.expires_at,
        s.is_active,
        to_jsonb(s) AS staff_json
    INTO v_existing
    FROM public.staff_password_resets r
    JOIN public.staff_users s ON s.id = r.staff_id
    WHERE r.token_hash = v_hash
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'reason', 'INVALID');
    END IF;

    IF v_existing.used_at IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', 'USED');
    END IF;

    IF v_existing.expires_at <= now() THEN
        RETURN jsonb_build_object('success', false, 'reason', 'EXPIRED');
    END IF;

    IF NOT (
        coalesce(v_existing.is_active, true) = true
        AND coalesce((NULLIF(v_existing.staff_json->>'is_banned_permanent', ''))::boolean, false) = false
        AND (
            (NULLIF(v_existing.staff_json->>'banned_until', '')) IS NULL
            OR (NULLIF(v_existing.staff_json->>'banned_until', ''))::timestamptz <= now()
        )
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'reason', 'SUSPENDED',
            'message', 'บัญชีผู้ใช้นี้ถูกระงับการใช้งาน ไม่สามารถตั้งรหัสผ่านใหม่ได้'
        );
    END IF;

    -- Atomically claim one-time token (ป้องกัน Race Condition ใช้ซ้ำพร้อมกัน)
    UPDATE public.staff_password_resets
    SET used_at = now()
    WHERE token_hash = v_hash
      AND used_at IS NULL
      AND expires_at > now()
    RETURNING staff_id INTO v_staff_id;

    IF NOT FOUND OR v_staff_id IS NULL THEN
        SELECT r.used_at, r.expires_at
        INTO v_existing
        FROM public.staff_password_resets r
        WHERE r.token_hash = v_hash
        LIMIT 1;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'reason', 'INVALID');
        ELSIF v_existing.used_at IS NOT NULL THEN
            RETURN jsonb_build_object('success', false, 'reason', 'USED');
        ELSE
            RETURN jsonb_build_object('success', false, 'reason', 'EXPIRED');
        END IF;
    END IF;

    UPDATE public.staff_users s
    SET password = v_clean_pass,
        updated_at = now()
    WHERE s.id = v_staff_id
      AND coalesce(s.is_active, true) = true
      AND coalesce((NULLIF(to_jsonb(s)->>'is_banned_permanent', ''))::boolean, false) = false
      AND (
          (NULLIF(to_jsonb(s)->>'banned_until', '')) IS NULL
          OR (NULLIF(to_jsonb(s)->>'banned_until', ''))::timestamptz <= now()
      )
    RETURNING s.* INTO v_staff;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'reason', 'SUSPENDED',
            'message', 'บัญชีผู้ใช้นี้ถูกระงับการใช้งาน ไม่สามารถตั้งรหัสผ่านใหม่ได้'
        );
    END IF;

    v_username := coalesce(trim(v_staff.username), '');
    v_email := coalesce(to_jsonb(v_staff)->>'email', '');

    -- Best-effort sync รหัสผ่านไปยัง auth.users ของ Supabase เพื่อให้ JWT Auth ตรงกันเสมอ
    v_auth_pass := v_clean_pass;
    BEGIN
        UPDATE auth.users
        SET encrypted_password = extensions.crypt(v_auth_pass, extensions.gen_salt('bf')),
            updated_at = now()
        WHERE (
            id = (NULLIF(to_jsonb(v_staff)->>'auth_user_id', ''))::uuid
            OR (
                email IS NOT NULL
                AND trim(email) <> ''
                AND lower(email) IN (
                    lower(nullif(trim(v_email), '')),
                    lower(v_username) || '@flower2u.internal',
                    lower(coalesce(nullif(regexp_replace(v_username, '[^a-zA-Z0-9_-]', '', 'g'), ''), 'staff')) || '@flower2u.internal'
                )
            )
        );
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    RETURN jsonb_build_object(
        'success', true,
        'staff_id', v_staff_id,
        'username', v_username
    );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_staff_reset_token(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_staff_reset_token(TEXT, TEXT) TO anon, authenticated;

COMMIT;
