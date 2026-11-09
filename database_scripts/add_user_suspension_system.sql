-- ==============================================================================
-- FLOWER2U (F2U) - User Suspension & Real-Time Kick System (RPC & Schema)
-- ==============================================================================
-- 1. เพิ่มคอลัมน์ banned_until, ban_reason, is_banned_permanent ในตาราง staff_users
-- 2. สร้าง RPC suspend_staff_user เพื่อระงับ/ปลดระงับผู้ใช้ทั้งใน staff_users และ auth.users
-- 3. อัปเกรด verify_staff_login เพื่อตรวจเช็คสถานะการระงับผู้ใช้และปลดแบนอัตโนมัติเมื่อครบกำหนด
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. เพิ่มคอลัมน์ในตาราง public.staff_users
-- ------------------------------------------------------------------------------
ALTER TABLE public.staff_users ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ;
ALTER TABLE public.staff_users ADD COLUMN IF NOT EXISTS ban_reason TEXT;
ALTER TABLE public.staff_users ADD COLUMN IF NOT EXISTS is_banned_permanent BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_staff_users_banned_until ON public.staff_users(banned_until);

-- ------------------------------------------------------------------------------
-- 2. RPC สำหรับระงับ / ปลดระงับพนักงาน (suspend_staff_user)
-- มี SECURITY DEFINER เพื่อให้อัปเดตทั้ง staff_users และ auth.users ของ Supabase ได้ทันที
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.suspend_staff_user(
    p_staff_id TEXT,
    p_banned_until TIMESTAMPTZ,
    p_is_permanent BOOLEAN,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_auth_id UUID;
    v_username TEXT;
    v_email TEXT;
    v_is_banned BOOLEAN := false;
BEGIN
    IF p_staff_id IS NULL OR TRIM(p_staff_id) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_STAFF_ID');
    END IF;

    -- ตรวจสอบว่าเป็นการแบนหรือปลดแบน
    IF p_is_permanent = true OR (p_banned_until IS NOT NULL AND p_banned_until > now()) THEN
        v_is_banned := true;
    END IF;

    -- 1. อัปเดตตาราง public.staff_users
    UPDATE public.staff_users
    SET 
        is_active = CASE WHEN v_is_banned THEN false ELSE true END,
        banned_until = CASE WHEN v_is_banned THEN p_banned_until ELSE NULL END,
        is_banned_permanent = CASE WHEN v_is_banned THEN COALESCE(p_is_permanent, false) ELSE false END,
        ban_reason = CASE WHEN v_is_banned THEN p_reason ELSE NULL END,
        updated_at = now()
    WHERE id = p_staff_id OR username = p_staff_id
    RETURNING auth_user_id, username, email INTO v_auth_id, v_username, v_email;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'STAFF_NOT_FOUND');
    END IF;

    -- 2. ซิงก์ไปยัง Supabase auth.users เพื่อบล็อก signInWithPassword ทันที
    BEGIN
        IF v_auth_id IS NOT NULL THEN
            UPDATE auth.users
            SET banned_until = CASE 
                WHEN p_is_permanent = true THEN '2099-12-31 23:59:59+00'::TIMESTAMPTZ
                WHEN v_is_banned = true THEN p_banned_until
                ELSE NULL
            END
            WHERE id = v_auth_id;
        END IF;

        -- ซิงก์ตาม email ใน auth.users เพิ่มเติมเพื่อความครอบคลุม
        IF v_email IS NOT NULL AND v_email != '' THEN
            UPDATE auth.users
            SET banned_until = CASE 
                WHEN p_is_permanent = true THEN '2099-12-31 23:59:59+00'::TIMESTAMPTZ
                WHEN v_is_banned = true THEN p_banned_until
                ELSE NULL
            END
            WHERE email = LOWER(TRIM(v_email));
        END IF;

        IF v_username IS NOT NULL AND v_username != '' THEN
            UPDATE auth.users
            SET banned_until = CASE 
                WHEN p_is_permanent = true THEN '2099-12-31 23:59:59+00'::TIMESTAMPTZ
                WHEN v_is_banned = true THEN p_banned_until
                ELSE NULL
            END
            WHERE email = LOWER(TRIM(v_username)) || '@flower2u.internal';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- หากติดสิทธิ์ auth.users ให้ทำงานใน staff_users ต่อไปได้
    END;

    RETURN jsonb_build_object(
        'success', true,
        'staff_id', p_staff_id,
        'is_active', NOT v_is_banned,
        'banned_until', p_banned_until,
        'is_permanent', p_is_permanent
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.suspend_staff_user(TEXT, TIMESTAMPTZ, BOOLEAN, TEXT) TO authenticated, anon;

-- ------------------------------------------------------------------------------
-- 3. อัปเกรด verify_staff_login: ตรวจสอบสถานะการแบน พร้อมปลดแบนอัตโนมัติเมื่อครบกำหนด
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_staff_login(
    p_identifier TEXT,
    p_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user RECORD;
    v_clean_id TEXT := LOWER(TRIM(COALESCE(p_identifier, '')));
    v_clean_pass TEXT := COALESCE(p_password, '');
BEGIN
    IF v_clean_id = '' OR v_clean_pass = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'EMPTY_CREDENTIALS');
    END IF;

    -- ค้นหาผู้ใช้จาก username หรือรหัสพนักงาน
    SELECT 
        s.id AS staff_code,
        s.username,
        s.password,
        s.full_name,
        s.nickname,
        s.phone,
        s.email,
        s.profile_image_url,
        s.is_active,
        s.banned_until,
        s.is_banned_permanent,
        s.ban_reason,
        s.auth_user_id,
        r.name AS role_name,
        r.code AS role_code,
        r.label AS role_label,
        r.allowed_pages
    INTO v_user
    FROM public.staff_users s
    LEFT JOIN public.roles r ON s.role_id = r.id
    WHERE (LOWER(s.username) = v_clean_id OR LOWER(s.id) = v_clean_id)
    LIMIT 1;

    -- ไม่พบผู้ใช้ หรือรหัสผ่านไม่ตรง
    IF NOT FOUND OR v_user.password != v_clean_pass THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_CREDENTIALS');
    END IF;

    -- 🛡️ ตรวจสอบการระงับผู้ใช้ (User Suspension & Ban Verification)
    -- กรณีที่ 1: แบนถาวร
    IF v_user.is_banned_permanent = true THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'ACCOUNT_SUSPENDED',
            'is_permanent', true,
            'banned_until', NULL,
            'reason', COALESCE(v_user.ban_reason, 'บัญชีถูกระงับการใช้งานถาวร โปรดติดต่อหัวหน้างานหรือผู้ดูแลระบบ')
        );
    END IF;

    -- กรณีที่ 2: แบนชั่วคราวและยังไม่ครบกำหนด
    IF v_user.banned_until IS NOT NULL AND v_user.banned_until > now() THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'ACCOUNT_SUSPENDED',
            'is_permanent', false,
            'banned_until', v_user.banned_until,
            'reason', COALESCE(v_user.ban_reason, 'บัญชีถูกระงับการใช้งานชั่วคราว โปรดติดต่อหัวหน้างานหรือผู้ดูแลระบบ')
        );
    END IF;

    -- กรณีที่ 3: เคยถูกแบนชั่วคราวแต่ครบกำหนดเวลาแล้ว -> ปลดแบนอัตโนมัติ 100%!
    IF v_user.banned_until IS NOT NULL AND v_user.banned_until <= now() THEN
        UPDATE public.staff_users
        SET is_active = true, banned_until = NULL, ban_reason = NULL, updated_at = now()
        WHERE id = v_user.staff_code;

        -- ปลดแบนใน auth.users ด้วย
        BEGIN
            IF v_user.auth_user_id IS NOT NULL THEN
                UPDATE auth.users SET banned_until = NULL WHERE id = v_user.auth_user_id;
            END IF;
        EXCEPTION WHEN OTHERS THEN
        END;
    END IF;

    -- กรณีที่ 4: สถานะปิดการใช้งาน (is_active = false) ทั่วไป
    IF v_user.is_active = false THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'ACCOUNT_SUSPENDED',
            'is_permanent', true,
            'banned_until', NULL,
            'reason', COALESCE(v_user.ban_reason, 'บัญชีถูกพักการทำงานชั่วคราว โปรดติดต่อผู้ดูแลระบบ')
        );
    END IF;

    -- เข้าสู่ระบบสำเร็จ
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
-- 4. เปิด Realtime สำหรับตาราง staff_users (เพื่อให้เตะผู้ใช้ออกจากจอสดทันทีแบบ Real-Time)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'staff_users'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_users;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- กรณี publication มีอยู่แล้ว
END $$;

COMMIT;
