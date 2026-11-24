-- ==============================================================================
-- FLOWER2U (F2U) - สคริปต์รวมอัปเดตฐานข้อมูลทั้งหมดในครั้งเดียว (All-in-One SQL)
-- ไฟล์: database_scripts/run_all_updates_once.sql
-- ==============================================================================
-- วิธีใช้งาน:
--   1. เปิด Supabase Dashboard -> SQL Editor -> New Query
--   2. คัดลอกโค้ดในไฟล์นี้ทั้งหมดไปวาง แล้วกดปุ่ม "Run" เพียงครั้งเดียวจบ
--      (ไม่ต้องไล่รันแยกหลายไฟล์ และสามารถกดรันซ้ำได้ปลอดภัย 100% / Idempotent)
--
-- สิ่งที่รวมอยู่ในไฟล์เดียวนี้:
--   [ส่วนที่ 1] Extensions (`pgcrypto`):
--     - เปิดใช้งาน `pgcrypto` สำหรับสร้าง Token สุ่มความมั่นคงสูง และเข้ารหัส SHA-256 / bcrypt
--   [ส่วนที่ 2] ตั้งค่าร้านค้าและสถานะระบบ (`public.shop_settings`):
--     - เพิ่มคอลัมน์ `payment_statuses`, `project_categories`, `expense_categories`,
--       `deal_statuses`, `transport_statuses`, `drive_folders` และคอลัมน์ตั้งค่าครบชุด
--     - ล้างแถวซ้ำใน `shop_settings` ให้เหลือแถวล่าสุดเพียง 1 แถว + ตั้งค่า RLS มาตรฐาน
--   [ส่วนที่ 3] บทบาทและสิทธิ์การใช้งาน (`public.roles`):
--     - เพิ่มคอลัมน์ `code`, `allowed_pages`, `can_edit_pricing`, `can_delete_project`,
--       `can_borrow_tools`, `can_manage_users`, `is_system_role` + บทบาทมาตรฐานเริ่มต้น
--   [ส่วนที่ 4] ข้อมูลพนักงาน ระบบล็อกอิน และระบบระงับผู้ใช้ (`public.staff_users`):
--     - เพิ่มคอลัมน์โปรไฟล์พนักงาน, `password` (โดยไม่เขียนทับรหัสผ่านเดิม), และคอลัมน์ระงับสิทธิ์
--       (`banned_until`, `ban_reason`, `is_banned_permanent`)
--     - อัปเกรด RPC `suspend_staff_user` (เฉพาะ Admin) และ `verify_staff_login` (ปลดแบนอัตโนมัติเมื่อครบกำหนด)
--     - เปิด Realtime บน `staff_users` และ `shop_settings`
--   [ส่วนที่ 5] ระบบลิงก์ตั้งรหัสผ่านครั้งเดียวแบบ Zero-Knowledge (`public.staff_password_resets`):
--     - สร้างตารางเก็บเฉพาะ SHA-256 `token_hash` + เปิด RLS ปิดการเข้าถึงตารางโดยตรง 100%
--     - สร้าง 3 SECURITY DEFINER RPCs:
--         1) `create_staff_reset_token(p_staff_id, p_ttl_minutes)` [เฉพาะ Admin ที่สถานะปกติ]
--         2) `validate_staff_reset_token(p_token)` [ตรวจสอบสถานะลิงก์ + บล็อกบัญชีที่ถูกระงับ]
--         3) `consume_staff_reset_token(p_token, p_new_password)` [ใช้ได้ครั้งเดียว + ซิงก์ `auth.users`]
--   [ส่วนที่ 6] ระบบวิเคราะห์ข้อมูลธุรกิจฝั่งเซิร์ฟเวอร์ (`public.get_complete_analytics`):
--     - ลบ Overload เดิมที่ซ้ำซ้อน และสร้าง 6-arg Zero-Egress Analytics RPC (กรองรายการ `is_voided = true` ออกอัตโนมัติ)
--   [ส่วนที่ 7] ระบบซิงก์การลบข้ามอุปกรณ์ (`public.deleted_records` & `public.record_generic_deletion`):
--     - สร้างตาราง Tombstone มาตรฐาน + ดัชนี + RLS เฉพาะ `authenticated` และผูก Trigger ลบอัตโนมัติครบทุกตารางหลัก
--   [ส่วนที่ 8] ระบบบันทึกสถานะยกเลิกรายการย่อย (`is_voided`) & `public.save_project_with_items`:
--     - เพิ่มคอลัมน์ `is_voided` ในรายการใบเสนอราคา/ค่าใช้จ่าย และคงค่า UUID เดิมของรายการย่อยเมื่อบันทึกโปรเจกต์
--   [ส่วนที่ 9] ระบบออกรหัสโปรเจกต์อัตโนมัติแบบป้องกันเลขชน (`public.allocate_next_project_code`):
--     - คำนวณรหัสถัดไปจากทั้ง `projects` และ `deleted_records` ภายใต้ `pg_advisory_xact_lock`
--   [ส่วนที่ 10] ความปลอดภัย RLS เพิ่มเติม, `REPLICA IDENTITY DEFAULT`, Supabase Realtime & Reload Schema Cache
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- ส่วนที่ 1: เปิดใช้งาน Extensions ที่จำเป็น (`pgcrypto`)
-- ==============================================================================
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO PUBLIC, anon, authenticated;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ==============================================================================
-- ส่วนที่ 2: ตารางตั้งค่าร้านค้าและตัวเลือกระบบ (`public.shop_settings`)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.shop_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_name TEXT DEFAULT 'Flower2you',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    address TEXT DEFAULT '',
    line_id TEXT DEFAULT '',
    facebook TEXT DEFAULT '',
    instagram TEXT DEFAULT '',
    tiktok TEXT DEFAULT '',
    twitter TEXT DEFAULT '',
    wechat TEXT DEFAULT '',
    telegram TEXT DEFAULT '',
    logo_url TEXT DEFAULT '',
    theme_color TEXT DEFAULT 'indigo',
    theme_mode TEXT DEFAULT 'gradient',
    custom_color_value TEXT DEFAULT '#000000',
    reference_folder_id TEXT DEFAULT '',
    slips_folder_id TEXT DEFAULT '',
    assets_folder_id TEXT DEFAULT '',
    line_bot_token TEXT DEFAULT '',
    telegram_bot_token TEXT DEFAULT '',
    telegram_chat_id TEXT DEFAULT '',
    project_categories JSONB DEFAULT '[]'::jsonb,
    expense_categories JSONB DEFAULT '[]'::jsonb,
    deal_statuses JSONB DEFAULT '[]'::jsonb,
    transport_statuses JSONB DEFAULT '[]'::jsonb,
    payment_statuses JSONB DEFAULT '[]'::jsonb,
    drive_folders JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.shop_settings
    ADD COLUMN IF NOT EXISTS shop_name TEXT DEFAULT 'Flower2you',
    ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS line_id TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS facebook TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS instagram TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS tiktok TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS twitter TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS wechat TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS telegram TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT 'indigo',
    ADD COLUMN IF NOT EXISTS theme_mode TEXT DEFAULT 'gradient',
    ADD COLUMN IF NOT EXISTS custom_color_value TEXT DEFAULT '#000000',
    ADD COLUMN IF NOT EXISTS reference_folder_id TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS slips_folder_id TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS assets_folder_id TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS line_bot_token TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS telegram_bot_token TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS project_categories JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS expense_categories JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS deal_statuses JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS transport_statuses JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS payment_statuses JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS drive_folders JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- คงไว้เฉพาะแถวตั้งค่าร้านล่าสุดเพียง 1 แถวเท่านั้น (ไม่ลบถ้ามีแถวเดียวอยู่แล้ว)
DELETE FROM public.shop_settings
WHERE id NOT IN (
    SELECT id FROM public.shop_settings ORDER BY updated_at DESC NULLS LAST LIMIT 1
);

ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow app full access" ON public.shop_settings;
DROP POLICY IF EXISTS "Allow public read shop branding" ON public.shop_settings;
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.shop_settings;

CREATE POLICY "Allow public read shop branding" ON public.shop_settings
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow authenticated full access" ON public.shop_settings
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT ON TABLE public.shop_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.shop_settings TO authenticated;

-- ==============================================================================
-- ส่วนที่ 3: ตารางบทบาทและสิทธิ์การใช้งาน (`public.roles`)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    code TEXT,
    label TEXT NOT NULL,
    description TEXT,
    allowed_pages TEXT[] NOT NULL DEFAULT '{"Calendar", "Plans"}',
    can_edit_pricing BOOLEAN DEFAULT false,
    can_delete_project BOOLEAN DEFAULT false,
    can_borrow_tools BOOLEAN DEFAULT true,
    can_manage_users BOOLEAN DEFAULT false,
    is_system_role BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.roles
    ADD COLUMN IF NOT EXISTS code TEXT,
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS allowed_pages TEXT[] NOT NULL DEFAULT '{"Calendar", "Plans"}',
    ADD COLUMN IF NOT EXISTS can_edit_pricing BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS can_delete_project BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS can_borrow_tools BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS can_manage_users BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_system_role BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- ลงทะเบียนบทบาทเริ่มต้น (รักษาการตั้งค่าที่เคยปรับแต่งเองไว้สำหรับตำแหน่งทั่วไป และรับประกันสิทธิ์เต็มให้ Admin)
INSERT INTO public.roles (
    name, code, label, description, allowed_pages,
    can_edit_pricing, can_delete_project, can_borrow_tools, can_manage_users, is_system_role
)
VALUES
    (
        'admin',
        '11',
        'ผู้ดูแลระบบ (Admin)',
        'สิทธิ์สูงสุด เข้าถึงได้ทุกหน้าจอและจัดการระบบทั้งหมด',
        ARRAY['Calendar', 'Plans', 'Finance', 'Quotations', 'Inventory', 'Venues', 'Artists', 'Customers', 'Staff', 'Analytics', 'Settings'],
        true, true, true, true, true
    ),
    (
        'technician',
        '21',
        'ช่างจัดดอกไม้/หน้างาน (Technician)',
        'ดูคิวงาน แผนงานจัดฉาก ข้อมูลศิลปิน สถานที่จัดส่ง และยืม-คืนอุปกรณ์',
        ARRAY['Calendar', 'Plans', 'Inventory', 'Venues', 'Artists'],
        false, false, true, false, false
    ),
    (
        'driver',
        '31',
        'พนักงานจัดส่ง (Driver/Logistics)',
        'ดูแผนงาน แผนที่สถานที่จัดส่ง จุดโหลดของ (Loading Dock) และสถานะขนส่ง',
        ARRAY['Calendar', 'Plans', 'Venues'],
        false, false, false, false, false
    ),
    (
        'accountant',
        '41',
        'ฝ่ายบัญชีและการเงิน (Accountant)',
        'จัดการงบการเงิน ใบเสนอราคา ทะเบียนลูกค้า และดูสถิติวิเคราะห์',
        ARRAY['Calendar', 'Plans', 'Finance', 'Quotations', 'Customers', 'Analytics'],
        true, false, false, false, false
    )
ON CONFLICT (name) DO UPDATE SET
    code = COALESCE(NULLIF(public.roles.code, ''), EXCLUDED.code),
    allowed_pages = CASE
        WHEN public.roles.name = 'admin' THEN EXCLUDED.allowed_pages
        ELSE COALESCE(public.roles.allowed_pages, EXCLUDED.allowed_pages)
    END,
    can_manage_users = CASE
        WHEN public.roles.name = 'admin' THEN true
        ELSE COALESCE(public.roles.can_manage_users, EXCLUDED.can_manage_users)
    END,
    is_system_role = CASE
        WHEN public.roles.name = 'admin' THEN true
        ELSE COALESCE(public.roles.is_system_role, EXCLUDED.is_system_role)
    END;

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow app full access" ON public.roles;
DROP POLICY IF EXISTS "Allow insert roles for all" ON public.roles;
DROP POLICY IF EXISTS "Allow update roles for all" ON public.roles;
DROP POLICY IF EXISTS "Allow delete roles for all" ON public.roles;
DROP POLICY IF EXISTS "Allow select roles for all" ON public.roles;
DROP POLICY IF EXISTS "Allow public read roles" ON public.roles;
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.roles;

CREATE POLICY "Allow public read roles" ON public.roles
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow authenticated full access" ON public.roles
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

REVOKE INSERT, UPDATE, DELETE ON TABLE public.roles FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.roles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.roles TO authenticated;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_roles_updated_at ON public.roles;
CREATE TRIGGER trigger_roles_updated_at
    BEFORE UPDATE ON public.roles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- ==============================================================================
-- ส่วนที่ 4: ตารางพนักงาน ระบบระงับผู้ใช้ และตรวจสอบการล็อกอิน (`public.staff_users`)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.staff_users (
    id TEXT PRIMARY KEY,
    auth_user_id UUID UNIQUE,
    username TEXT NOT NULL UNIQUE,
    password TEXT,
    full_name TEXT NOT NULL,
    nickname TEXT,
    phone TEXT,
    email TEXT,
    citizen_id TEXT,
    birth_date DATE,
    address TEXT,
    emergency_contact TEXT,
    hire_date DATE,
    bank_account_no TEXT,
    bank_name TEXT,
    note TEXT,
    role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    banned_until TIMESTAMPTZ,
    ban_reason TEXT,
    is_banned_permanent BOOLEAN DEFAULT false,
    profile_image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.staff_users
    ADD COLUMN IF NOT EXISTS auth_user_id UUID,
    ADD COLUMN IF NOT EXISTS password TEXT,
    ADD COLUMN IF NOT EXISTS full_name TEXT,
    ADD COLUMN IF NOT EXISTS nickname TEXT,
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS citizen_id TEXT,
    ADD COLUMN IF NOT EXISTS birth_date DATE,
    ADD COLUMN IF NOT EXISTS address TEXT,
    ADD COLUMN IF NOT EXISTS emergency_contact TEXT,
    ADD COLUMN IF NOT EXISTS hire_date DATE,
    ADD COLUMN IF NOT EXISTS bank_account_no TEXT,
    ADD COLUMN IF NOT EXISTS bank_name TEXT,
    ADD COLUMN IF NOT EXISTS note TEXT,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS ban_reason TEXT,
    ADD COLUMN IF NOT EXISTS is_banned_permanent BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS profile_image_url TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ถอด DEFAULT รหัสผ่านอ่อน ('1') ออกหากเคยถูกตั้งไว้ในสคริปต์รุ่นเก่า (โดยไม่แตะต้องรหัสผ่านเดิมของพนักงาน)
ALTER TABLE public.staff_users ALTER COLUMN password DROP DEFAULT;

-- ปลด NOT NULL ของ role_id อย่างปลอดภัยเพื่อรองรับการบันทึกที่ยืดหยุ่น
ALTER TABLE public.staff_users ALTER COLUMN role_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_staff_users_role_id ON public.staff_users(role_id);
CREATE INDEX IF NOT EXISTS idx_staff_users_username ON public.staff_users(username);
CREATE INDEX IF NOT EXISTS idx_staff_users_banned_until ON public.staff_users(banned_until);

ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.staff_users FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.staff_users TO authenticated;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'staff_users'
    ) THEN
        CREATE POLICY "Allow authenticated full access" ON public.staff_users
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- ==============================================================================
-- ส่วนที่ 5: ระบบลิงก์ตั้งรหัสผ่านครั้งเดียวแบบ Zero-Knowledge (`public.staff_password_resets`)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.staff_password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ผูก Foreign Key เมื่อ staff_users.id เป็น TEXT และเพิ่ม Trigger ลบข้อมูลลูกอัตโนมัติรองรับทั้ง UUID และ TEXT
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'staff_users'
          AND column_name = 'id'
          AND data_type = 'text'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'staff_password_resets'
          AND constraint_name = 'staff_password_resets_staff_id_fkey'
    ) THEN
        ALTER TABLE public.staff_password_resets
            ADD CONSTRAINT staff_password_resets_staff_id_fkey
            FOREIGN KEY (staff_id) REFERENCES public.staff_users(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.cleanup_staff_password_resets_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.staff_password_resets
    WHERE staff_id = OLD.id::text;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_staff_password_resets ON public.staff_users;
CREATE TRIGGER trg_cleanup_staff_password_resets
    AFTER DELETE ON public.staff_users
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_staff_password_resets_on_delete();

CREATE INDEX IF NOT EXISTS idx_staff_password_resets_staff_id
    ON public.staff_password_resets(staff_id);

CREATE INDEX IF NOT EXISTS idx_staff_password_resets_token_hash
    ON public.staff_password_resets(token_hash);

ALTER TABLE public.staff_password_resets ENABLE ROW LEVEL SECURITY;

-- ปิดสิทธิ์การเข้าถึงตารางโดยตรงจาก anon และ authenticated (บังคับผ่าน SECURITY DEFINER RPCs เท่านั้น)
REVOKE ALL ON TABLE public.staff_password_resets FROM PUBLIC, anon, authenticated;

-- หากฐานข้อมูลมี Trigger `trg_guard_staff_users_escalation` จากระบบคลัง `inventory_compact`
-- ให้อัปเกรดเพื่ออนุญาตการตั้งรหัสผ่านผ่าน One-Time Token ที่เพิ่งถูกเคลมใน Transaction เดียวกัน
-- และการปลดแบนชั่วคราวที่หมดเวลาแล้ว โดยยังคงป้องกันการยกระดับสิทธิ์ (Anti-Escalation) 100%
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = 'trg_guard_staff_users_escalation'
    ) THEN
        EXECUTE $fn$
        CREATE OR REPLACE FUNCTION public.trg_guard_staff_users_escalation()
        RETURNS TRIGGER AS $body$
        DECLARE
            v_caller_uid UUID;
            v_caller_is_admin BOOLEAN;
            v_self_allowed_cols TEXT[] := ARRAY[
                'nickname', 'phone', 'profile_image_url', 'address',
                'emergency_contact', 'full_name', 'username', 'email',
                'citizen_id', 'birth_date', 'password', 'updated_at'
            ];
        BEGIN
            -- 1. อนุญาตการเปลี่ยนรหัสผ่านเมื่อมีหลักฐานเคลม One-Time Token ใน Transaction เดียวกัน
            IF (to_jsonb(NEW) - ARRAY['password', 'updated_at'])
               IS NOT DISTINCT FROM
               (to_jsonb(OLD) - ARRAY['password', 'updated_at'])
               AND EXISTS (
                   SELECT 1
                   FROM public.staff_password_resets r
                   WHERE r.staff_id = OLD.id::text
                     AND r.used_at = now()
               )
            THEN
                RETURN NEW;
            END IF;

            -- 2. อนุญาตการปลดแบนอัตโนมัติเฉพาะเมื่อพ้นเวลาแบนชั่วคราวแล้วเท่านั้น
            IF OLD.banned_until IS NOT NULL
               AND OLD.banned_until <= now()
               AND coalesce(OLD.is_banned_permanent, false) = false
               AND NEW.is_active = true
               AND NEW.banned_until IS NULL
               AND NEW.ban_reason IS NULL
               AND (to_jsonb(NEW) - ARRAY['is_active', 'banned_until', 'ban_reason', 'updated_at'])
                   IS NOT DISTINCT FROM
                   (to_jsonb(OLD) - ARRAY['is_active', 'banned_until', 'ban_reason', 'updated_at'])
            THEN
                RETURN NEW;
            END IF;

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

                IF (to_jsonb(NEW) - v_self_allowed_cols)
                   IS DISTINCT FROM
                   (to_jsonb(OLD) - v_self_allowed_cols)
                THEN
                    RAISE EXCEPTION 'Unauthorized: Non-admin staff cannot modify permissions or privileged fields';
                END IF;
            END IF;

            RETURN NEW;
        END;
        $body$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
        $fn$;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 5.1 RPC: suspend_staff_user (ระงับ / ปลดระงับพนักงาน เฉพาะ Admin ที่ล็อกอินเท่านั้น)
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
    v_caller UUID := auth.uid();
    v_jwt JSONB := coalesce(auth.jwt(), '{}'::jsonb);
    v_caller_email TEXT := lower(trim(coalesce(v_jwt ->> 'email', '')));
    v_caller_meta_username TEXT := lower(trim(coalesce(v_jwt -> 'user_metadata' ->> 'username', '')));
    v_caller_meta_code TEXT := trim(coalesce(v_jwt -> 'user_metadata' ->> 'staff_code', ''));
    v_caller_staff RECORD;
    v_is_admin_caller BOOLEAN := false;
    v_auth_id UUID;
    v_username TEXT;
    v_email TEXT;
    v_is_banned BOOLEAN := false;
BEGIN
    IF v_caller IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
    END IF;

    SELECT
        s.id::text AS id,
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
                        OR (v_caller_meta_code <> '' AND s.id::text = v_caller_meta_code)
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
        RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
    END IF;

    IF NOT (
        coalesce(v_caller_staff.is_active, true) = true
        AND coalesce((NULLIF(v_caller_staff.staff_json->>'is_banned_permanent', ''))::boolean, false) = false
        AND (
            (NULLIF(v_caller_staff.staff_json->>'banned_until', '')) IS NULL
            OR (NULLIF(v_caller_staff.staff_json->>'banned_until', ''))::timestamptz <= now()
        )
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
    END IF;

    v_is_admin_caller := (
        lower(coalesce(v_caller_staff.role_name, '')) IN ('admin', 'owner')
        OR coalesce((NULLIF(v_caller_staff.role_json->>'can_manage_users', ''))::boolean, false) = true
        OR 'Staff' = ANY(coalesce(v_caller_staff.allowed_pages, ARRAY[]::text[]))
    );

    IF NOT v_is_admin_caller THEN
        RETURN jsonb_build_object('success', false, 'error', 'FORBIDDEN');
    END IF;

    IF p_staff_id IS NULL OR TRIM(p_staff_id) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_STAFF_ID');
    END IF;

    IF p_is_permanent = true OR (p_banned_until IS NOT NULL AND p_banned_until > now()) THEN
        v_is_banned := true;
    END IF;

    UPDATE public.staff_users
    SET
        is_active = CASE WHEN v_is_banned THEN false ELSE true END,
        banned_until = CASE WHEN v_is_banned THEN p_banned_until ELSE NULL END,
        is_banned_permanent = CASE WHEN v_is_banned THEN COALESCE(p_is_permanent, false) ELSE false END,
        ban_reason = CASE WHEN v_is_banned THEN p_reason ELSE NULL END,
        updated_at = now()
    WHERE id::text = p_staff_id OR username = p_staff_id
    RETURNING auth_user_id, username, email INTO v_auth_id, v_username, v_email;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'STAFF_NOT_FOUND');
    END IF;

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

        IF v_email IS NOT NULL AND v_email <> '' THEN
            UPDATE auth.users
            SET banned_until = CASE
                WHEN p_is_permanent = true THEN '2099-12-31 23:59:59+00'::TIMESTAMPTZ
                WHEN v_is_banned = true THEN p_banned_until
                ELSE NULL
            END
            WHERE email = LOWER(TRIM(v_email));
        END IF;

        IF v_username IS NOT NULL AND v_username <> '' THEN
            UPDATE auth.users
            SET banned_until = CASE
                WHEN p_is_permanent = true THEN '2099-12-31 23:59:59+00'::TIMESTAMPTZ
                WHEN v_is_banned = true THEN p_banned_until
                ELSE NULL
            END
            WHERE email IN (
                LOWER(TRIM(v_username)) || '@flower2u.internal',
                LOWER(COALESCE(NULLIF(regexp_replace(v_username, '[^a-zA-Z0-9_-]', '', 'g'), ''), 'staff')) || '@flower2u.internal'
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        NULL;
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

REVOKE ALL ON FUNCTION public.suspend_staff_user(TEXT, TIMESTAMPTZ, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suspend_staff_user(TEXT, TIMESTAMPTZ, BOOLEAN, TEXT) TO authenticated;

-- ------------------------------------------------------------------------------
-- 5.2 RPC: verify_staff_login (ตรวจรหัสผ่านฝั่งเซิร์ฟเวอร์ + ปลดแบนอัตโนมัติเมื่อครบกำหนด)
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

    SELECT
        s.id::text AS staff_code,
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
    WHERE (LOWER(s.username) = v_clean_id OR LOWER(s.id::text) = v_clean_id)
    LIMIT 1;

    IF NOT FOUND OR v_user.password IS DISTINCT FROM v_clean_pass THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_CREDENTIALS');
    END IF;

    IF v_user.is_banned_permanent = true THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'ACCOUNT_SUSPENDED',
            'is_permanent', true,
            'banned_until', NULL,
            'reason', COALESCE(v_user.ban_reason, 'บัญชีถูกระงับการใช้งานถาวร โปรดติดต่อหัวหน้างานหรือผู้ดูแลระบบ')
        );
    END IF;

    IF v_user.banned_until IS NOT NULL AND v_user.banned_until > now() THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'ACCOUNT_SUSPENDED',
            'is_permanent', false,
            'banned_until', v_user.banned_until,
            'reason', COALESCE(v_user.ban_reason, 'บัญชีถูกระงับการใช้งานชั่วคราว โปรดติดต่อหัวหน้างานหรือผู้ดูแลระบบ')
        );
    END IF;

    IF v_user.banned_until IS NOT NULL AND v_user.banned_until <= now() THEN
        UPDATE public.staff_users
        SET is_active = true, banned_until = NULL, ban_reason = NULL, updated_at = now()
        WHERE id::text = v_user.staff_code;

        BEGIN
            IF v_user.auth_user_id IS NOT NULL THEN
                UPDATE auth.users SET banned_until = NULL WHERE id = v_user.auth_user_id;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    ELSIF v_user.is_active = false THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'ACCOUNT_SUSPENDED',
            'is_permanent', true,
            'banned_until', NULL,
            'reason', COALESCE(v_user.ban_reason, 'บัญชีถูกพักการทำงานชั่วคราว โปรดติดต่อผู้ดูแลระบบ')
        );
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

REVOKE ALL ON FUNCTION public.verify_staff_login(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_staff_login(TEXT, TEXT) TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 5.3 RPC: create_staff_reset_token (เฉพาะผู้ดูแลระบบ Admin ที่ล็อกอินและสถานะปกติเท่านั้น)
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

    SELECT
        s.id::text AS id,
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
                        OR (v_caller_meta_code <> '' AND s.id::text = v_caller_meta_code)
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

    SELECT s.id::text AS id, s.username, s.full_name, s.nickname
    INTO v_staff
    FROM public.staff_users s
    WHERE s.id::text = v_clean_staff_id
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
    v_raw_token := 'rst_' || encode(gen_random_bytes(24), 'hex');
    v_token_hash := encode(digest(v_raw_token::text, 'sha256'::text), 'hex');
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
-- 5.4 RPC: validate_staff_reset_token (ตรวจสอบสถานะลิงก์ก่อนแสดงฟอร์ม)
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

    v_hash := encode(digest(v_clean_token::text, 'sha256'::text), 'hex');

    SELECT
        r.used_at,
        r.expires_at,
        s.id::text AS staff_id,
        s.username,
        s.full_name,
        s.nickname,
        s.is_active,
        to_jsonb(s) AS staff_json
    INTO v_row
    FROM public.staff_password_resets r
    JOIN public.staff_users s ON s.id::text = r.staff_id
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
-- 5.5 RPC: consume_staff_reset_token (ใช้สิทธิ์ตั้งรหัสผ่านใหม่แบบครั้งเดียวจบ)
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

    v_hash := encode(digest(v_clean_token::text, 'sha256'::text), 'hex');

    SELECT
        r.staff_id,
        r.used_at,
        r.expires_at,
        s.is_active,
        to_jsonb(s) AS staff_json
    INTO v_existing
    FROM public.staff_password_resets r
    JOIN public.staff_users s ON s.id::text = r.staff_id
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
    WHERE s.id::text = v_staff_id
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
        SET encrypted_password = crypt(v_auth_pass, gen_salt('bf')),
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

-- ==============================================================================
-- ส่วนที่ 6: ระบบวิเคราะห์ข้อมูลธุรกิจฝั่งเซิร์ฟเวอร์ (`public.get_complete_analytics`)
-- ==============================================================================
DROP FUNCTION IF EXISTS public.get_complete_analytics(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_complete_analytics(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_complete_analytics(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.get_complete_analytics(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_deal_status TEXT DEFAULT NULL,
    p_transport_status TEXT DEFAULT NULL,
    p_search TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_start_date DATE := CASE WHEN p_start_date IS NOT NULL THEN (p_start_date AT TIME ZONE 'Asia/Bangkok')::date ELSE NULL END;
    v_end_date DATE := CASE WHEN p_end_date IS NOT NULL THEN (p_end_date AT TIME ZONE 'Asia/Bangkok')::date ELSE NULL END;
    v_category TEXT := CASE WHEN p_category IS NOT NULL AND btrim(p_category) <> '' AND p_category <> 'all' THEN p_category ELSE NULL END;
    v_deal_status TEXT := CASE WHEN p_deal_status IS NOT NULL AND btrim(p_deal_status) <> '' AND p_deal_status <> 'all' THEN p_deal_status ELSE NULL END;
    v_transport_status TEXT := CASE WHEN p_transport_status IS NOT NULL AND btrim(p_transport_status) <> '' AND p_transport_status <> 'all' THEN p_transport_status ELSE NULL END;
    v_search TEXT := NULLIF(btrim(COALESCE(p_search, '')), '');
    v_pattern TEXT := CASE
        WHEN NULLIF(btrim(COALESCE(p_search, '')), '') IS NOT NULL
            THEN '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%'
        ELSE NULL
    END;
    v_result JSONB;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Authentication required' USING ERRCODE = '42501';
    END IF;

    WITH status_defs AS (
        SELECT
            CASE WHEN jsonb_typeof(s.deal_statuses) = 'array' THEN s.deal_statuses ELSE '[]'::jsonb END AS deal_arr,
            CASE WHEN jsonb_typeof(s.transport_statuses) = 'array' THEN s.transport_statuses ELSE '[]'::jsonb END AS transport_arr
        FROM (SELECT 1) one
        LEFT JOIN LATERAL (
            SELECT deal_statuses, transport_statuses
            FROM public.shop_settings
            ORDER BY updated_at DESC NULLS LAST
            LIMIT 1
        ) s ON true
    ),
    deal_type_map AS (
        SELECT DISTINCT ON (elem->>'value')
            elem->>'value' AS val,
            elem->>'type' AS typ
        FROM status_defs sd,
        LATERAL jsonb_array_elements(sd.deal_arr) AS elem
        WHERE NULLIF(elem->>'value', '') IS NOT NULL
    ),
    transport_type_map AS (
        SELECT DISTINCT ON (elem->>'value')
            elem->>'value' AS val,
            elem->>'type' AS typ
        FROM status_defs sd,
        LATERAL jsonb_array_elements(sd.transport_arr) AS elem
        WHERE NULLIF(elem->>'value', '') IS NOT NULL
    ),
    scoped_projects AS (
        SELECT
            p.id,
            p.name,
            p.category,
            p.artist_name,
            p.customer_name,
            p.location_name,
            p.deal_status,
            p.transport_status,
            p.wage,
            p.total_revenue,
            p.total_expenses,
            p.customer_support_total,
            to_jsonb(p) AS row_json,
            COALESCE(
                dtm.typ,
                CASE
                    WHEN p.deal_status = 'completed' THEN 'completed'
                    WHEN p.deal_status IN ('confirmed', 'operating', 'active') THEN 'active'
                    WHEN p.deal_status IN ('cancelled', 'issue') THEN 'cancelled'
                    WHEN p.deal_status = 'declined' THEN 'declined'
                    ELSE 'pending'
                END
            ) AS deal_type,
            COALESCE(
                ttm.typ,
                CASE
                    WHEN p.transport_status IN ('delivered', 'completed') THEN 'completed'
                    WHEN p.transport_status IN ('shipping', 'preparing', 'active') THEN 'active'
                    WHEN p.transport_status IN ('issue', 'cancelled') THEN 'cancelled'
                    ELSE 'pending'
                END
            ) AS transport_type
        FROM public.projects p
        LEFT JOIN deal_type_map dtm ON dtm.val = p.deal_status
        LEFT JOIN transport_type_map ttm ON ttm.val = p.transport_status
        WHERE (
            v_start_date IS NULL
            OR COALESCE(
                CASE
                    WHEN NULLIF(substring(p.raw_delivery_start from 1 for 10), '') ~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$'
                        THEN substring(p.raw_delivery_start from 1 for 10)::date
                    ELSE NULL
                END,
                (p.project_datetime AT TIME ZONE 'Asia/Bangkok')::date,
                p.payment_date
            ) >= v_start_date
        )
        AND (
            v_end_date IS NULL
            OR COALESCE(
                CASE
                    WHEN NULLIF(substring(p.raw_delivery_start from 1 for 10), '') ~ '^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$'
                        THEN substring(p.raw_delivery_start from 1 for 10)::date
                    ELSE NULL
                END,
                (p.project_datetime AT TIME ZONE 'Asia/Bangkok')::date,
                p.payment_date
            ) <= v_end_date
        )
        AND (v_category IS NULL OR p.category = v_category)
        AND (
            v_pattern IS NULL
            OR COALESCE(p.id, '') ILIKE v_pattern ESCAPE '\'
            OR COALESCE(p.name, '') ILIKE v_pattern ESCAPE '\'
            OR COALESCE(p.artist_name, '') ILIKE v_pattern ESCAPE '\'
            OR COALESCE(p.customer_name, '') ILIKE v_pattern ESCAPE '\'
            OR COALESCE(p.location_name, '') ILIKE v_pattern ESCAPE '\'
        )
    ),
    status_summary AS (
        SELECT jsonb_build_object(
            'total', COUNT(*)::int,
            'completed', COUNT(*) FILTER (
                WHERE (sp.deal_type IN ('active', 'completed') AND sp.transport_type = 'completed')
                   OR (sp.deal_status = 'completed' AND sp.transport_type <> 'cancelled')
            )::int,
            'active', COUNT(*) FILTER (
                WHERE sp.deal_type IN ('active', 'completed')
                  AND sp.transport_type NOT IN ('completed', 'cancelled')
                  AND COALESCE(sp.deal_status, '') <> 'completed'
            )::int,
            'pending', COUNT(*) FILTER (
                WHERE sp.deal_type = 'pending'
                  AND sp.transport_type <> 'cancelled'
            )::int,
            'cancelled', COUNT(*) FILTER (
                WHERE sp.deal_type = 'cancelled'
                   OR sp.transport_type = 'cancelled'
            )::int,
            'issue', COUNT(*) FILTER (
                WHERE sp.deal_type = 'cancelled'
                   OR sp.transport_type = 'cancelled'
            )::int,
            'declined', COUNT(*) FILTER (
                WHERE sp.deal_type = 'declined'
                  AND sp.transport_type <> 'cancelled'
            )::int
        ) AS obj
        FROM scoped_projects sp
    ),
    filtered_base AS (
        SELECT sp.*
        FROM scoped_projects sp
        WHERE (
            v_deal_status IS NULL
            OR CASE
                WHEN v_deal_status = '__kpi_completed__' THEN
                    (sp.deal_type IN ('active', 'completed') AND sp.transport_type = 'completed')
                    OR (sp.deal_status = 'completed' AND sp.transport_type <> 'cancelled')
                WHEN v_deal_status = '__kpi_active__' THEN
                    sp.deal_type IN ('active', 'completed')
                    AND sp.transport_type NOT IN ('completed', 'cancelled')
                    AND COALESCE(sp.deal_status, '') <> 'completed'
                WHEN v_deal_status = '__kpi_issues__' THEN
                    sp.deal_type = 'cancelled' OR sp.transport_type = 'cancelled'
                ELSE
                    sp.deal_status = v_deal_status
            END
        )
        AND (
            v_transport_status IS NULL
            OR CASE
                WHEN v_transport_status = 'active_only' THEN
                    sp.transport_type NOT IN ('completed', 'cancelled')
                    AND COALESCE(sp.transport_status, '') NOT IN ('delivered', 'completed', 'issue', 'cancelled')
                ELSE
                    sp.transport_status = v_transport_status
            END
        )
    ),
    q_agg AS (
        SELECT
            qi.project_id,
            COUNT(*)::int AS item_count,
            COALESCE(SUM(COALESCE(NULLIF(qi.price, 0), COALESCE(qi.unit_price, 0) * COALESCE(qi.quantity, 1), 0)), 0)::numeric AS q_sum
        FROM public.project_quotation_items qi
        JOIN filtered_base fb ON fb.id = qi.project_id
        WHERE COALESCE((to_jsonb(qi)->>'is_voided')::boolean, false) = false
        GROUP BY qi.project_id
    ),
    cs_agg AS (
        SELECT
            cs.project_id,
            COUNT(*)::int AS item_count,
            COALESCE(SUM(COALESCE(NULLIF(cs.price, 0), COALESCE(cs.denomination, 0)::numeric * COALESCE(cs.quantity, 0)::numeric, 0)), 0)::numeric AS cs_sum
        FROM public.project_customer_support cs
        JOIN filtered_base fb ON fb.id = cs.project_id
        GROUP BY cs.project_id
    ),
    ex_agg AS (
        SELECT
            pe.project_id,
            COUNT(*)::int AS item_count,
            COALESCE(SUM(COALESCE(NULLIF(pe.price, 0), COALESCE(pe.unit_price, 0) * COALESCE(pe.quantity, 1), 0)), 0)::numeric AS ex_sum
        FROM public.project_expenses pe
        JOIN filtered_base fb ON fb.id = pe.project_id
        WHERE COALESCE((to_jsonb(pe)->>'is_voided')::boolean, false) = false
        GROUP BY pe.project_id
    ),
    enriched AS (
        SELECT
            fb.id,
            fb.name,
            fb.category,
            fb.artist_name,
            fb.customer_name,
            fb.location_name,
            fb.total_expenses,
            COALESCE(ex.item_count, 0) AS ex_item_count,
            EXISTS (
                SELECT 1
                FROM public.project_expenses pe0
                WHERE pe0.project_id = fb.id
            ) AS has_any_ex_rows,
            CASE
                WHEN COALESCE(q.item_count, 0) > 0 AND COALESCE(q.q_sum, 0) > 0 THEN q.q_sum
                WHEN COALESCE(q.item_count, 0) = 0
                     AND EXISTS (
                         SELECT 1
                         FROM public.project_quotation_items qi0
                         WHERE qi0.project_id = fb.id
                           AND COALESCE((to_jsonb(qi0)->>'is_voided')::boolean, false) = true
                     )
                THEN 0::numeric
                ELSE COALESCE(
                    NULLIF((NULLIF(fb.row_json->>'quotation_total', ''))::numeric, 0),
                    NULLIF(fb.wage, 0),
                    fb.total_revenue,
                    0
                )
            END AS eff_revenue,
            CASE
                WHEN COALESCE(cs.item_count, 0) > 0 AND COALESCE(cs.cs_sum, 0) > 0 THEN cs.cs_sum
                ELSE COALESCE(fb.customer_support_total, 0)
            END AS eff_support,
            CASE
                WHEN COALESCE(ex.item_count, 0) > 0 THEN COALESCE(ex.ex_sum, 0)
                WHEN EXISTS (
                    SELECT 1
                    FROM public.project_expenses pe0
                    WHERE pe0.project_id = fb.id
                ) THEN 0::numeric
                ELSE COALESCE(fb.total_expenses, 0)
            END AS eff_cost
        FROM filtered_base fb
        LEFT JOIN q_agg q ON q.project_id = fb.id
        LEFT JOIN cs_agg cs ON cs.project_id = fb.id
        LEFT JOIN ex_agg ex ON ex.project_id = fb.id
    ),
    totals_agg AS (
        SELECT
            COUNT(*)::int AS total_projects,
            COALESCE(SUM(e.eff_revenue), 0)::numeric AS revenue,
            COALESCE(SUM(e.eff_support), 0)::numeric AS support,
            COALESCE(SUM(e.eff_cost), 0)::numeric AS cost,
            (COALESCE(SUM(e.eff_revenue), 0) - COALESCE(SUM(e.eff_cost), 0))::numeric AS profit
        FROM enriched e
    ),
    totals_json AS (
        SELECT jsonb_build_object(
            'total_projects', t.total_projects,
            'revenue', t.revenue,
            'support', t.support,
            'cost', t.cost,
            'profit', t.profit,
            'avg_order_value', CASE WHEN t.total_projects > 0 THEN ROUND(t.revenue / t.total_projects) ELSE 0 END,
            'avg_support_value', CASE WHEN t.total_projects > 0 THEN ROUND(t.support / t.total_projects) ELSE 0 END,
            'net_margin_pct', CASE WHEN t.revenue > 0 THEN ROUND(((t.profit / t.revenue) * 100)::numeric, 1) ELSE 0.0 END,
            'total_orders', t.total_projects,
            'total_revenue', t.revenue,
            'total_customer_support', t.support,
            'total_expenses', t.cost,
            'total_net_profit', t.profit,
            'net_margin_percent', CASE WHEN t.revenue > 0 THEN ROUND(((t.profit / t.revenue) * 100)::numeric, 1) ELSE 0.0 END
        ) AS obj
        FROM totals_agg t
    ),
    banknotes_json AS (
        SELECT jsonb_object_agg(
            d.denom::text,
            jsonb_build_object('count', COALESCE(b.total_qty, 0), 'amount', COALESCE(b.total_amt, 0))
        ) AS obj
        FROM (VALUES (1000), (500), (100), (50), (20)) AS d(denom)
        LEFT JOIN (
            SELECT
                cs.denomination,
                COALESCE(SUM(cs.quantity), 0)::bigint AS total_qty,
                COALESCE(SUM(COALESCE(NULLIF(cs.price, 0), cs.denomination::numeric * COALESCE(cs.quantity, 0)::numeric, 0)), 0)::numeric AS total_amt
            FROM public.project_customer_support cs
            JOIN filtered_base fb ON fb.id = cs.project_id
            GROUP BY cs.denomination
        ) b ON b.denomination = d.denom
    ),
    expenses_json AS (
        SELECT COALESCE(
            jsonb_agg(jsonb_build_object('category', ex_row.category, 'amount', ex_row.amount) ORDER BY ex_row.amount DESC, ex_row.category ASC),
            '[]'::jsonb
        ) AS arr
        FROM (
            SELECT
                raw_ex.category,
                SUM(raw_ex.amount)::numeric AS amount
            FROM (
                SELECT
                    COALESCE(NULLIF(btrim(pe.category), ''), 'ไม่ระบุหมวดหมู่') AS category,
                    COALESCE(NULLIF(pe.price, 0), COALESCE(pe.unit_price, 0) * COALESCE(pe.quantity, 1), 0)::numeric AS amount
                FROM public.project_expenses pe
                JOIN filtered_base fb ON fb.id = pe.project_id
                WHERE COALESCE((to_jsonb(pe)->>'is_voided')::boolean, false) = false
                UNION ALL
                SELECT
                    'ไม่ระบุหมวดหมู่'::text AS category,
                    e.total_expenses::numeric AS amount
                FROM enriched e
                WHERE e.ex_item_count = 0
                  AND NOT e.has_any_ex_rows
                  AND COALESCE(e.total_expenses, 0) > 0
            ) raw_ex
            WHERE raw_ex.amount > 0
            GROUP BY raw_ex.category
            ORDER BY SUM(raw_ex.amount) DESC, raw_ex.category ASC
            LIMIT 15
        ) ex_row
    ),
    categories_json AS (
        SELECT COALESCE(
            jsonb_agg(jsonb_build_object('name', cat_row.name, 'count', cat_row.cnt) ORDER BY cat_row.cnt DESC, cat_row.name ASC),
            '[]'::jsonb
        ) AS arr
        FROM (
            SELECT
                btrim(e.category) AS name,
                COUNT(*)::int AS cnt
            FROM enriched e
            WHERE e.category IS NOT NULL
                AND btrim(e.category) <> ''
            GROUP BY btrim(e.category)
            ORDER BY COUNT(*) DESC, btrim(e.category) ASC
        ) cat_row
    ),
    artists_json AS (
        SELECT COALESCE(
            jsonb_agg(jsonb_build_object('name', a_row.name, 'amount', a_row.amount, 'count', a_row.cnt) ORDER BY a_row.amount DESC, a_row.cnt DESC, a_row.name ASC),
            '[]'::jsonb
        ) AS arr
        FROM (
            SELECT
                btrim(e.artist_name) AS name,
                COALESCE(SUM(e.eff_revenue), 0)::numeric AS amount,
                COUNT(*)::int AS cnt
            FROM enriched e
            WHERE e.artist_name IS NOT NULL
              AND btrim(e.artist_name) <> ''
              AND btrim(e.artist_name) <> '-'
            GROUP BY btrim(e.artist_name)
            ORDER BY COALESCE(SUM(e.eff_revenue), 0) DESC, COUNT(*) DESC, btrim(e.artist_name) ASC
            LIMIT 10
        ) a_row
    ),
    customers_rev_json AS (
        SELECT COALESCE(
            jsonb_agg(jsonb_build_object('name', c_row.name, 'amount', c_row.amount, 'count', c_row.cnt) ORDER BY c_row.amount DESC, c_row.cnt DESC, c_row.name ASC),
            '[]'::jsonb
        ) AS arr
        FROM (
            SELECT
                btrim(e.customer_name) AS name,
                COALESCE(SUM(e.eff_revenue), 0)::numeric AS amount,
                COUNT(*)::int AS cnt
            FROM enriched e
            WHERE e.customer_name IS NOT NULL
              AND btrim(e.customer_name) <> ''
              AND btrim(e.customer_name) <> '-'
            GROUP BY btrim(e.customer_name)
            ORDER BY COALESCE(SUM(e.eff_revenue), 0) DESC, COUNT(*) DESC, btrim(e.customer_name) ASC
            LIMIT 10
        ) c_row
    ),
    customers_cnt_json AS (
        SELECT COALESCE(
            jsonb_agg(jsonb_build_object('name', cp_row.name, 'count', cp_row.cnt, 'amount', cp_row.amount) ORDER BY cp_row.cnt DESC, cp_row.amount DESC, cp_row.name ASC),
            '[]'::jsonb
        ) AS arr
        FROM (
            SELECT
                btrim(e.customer_name) AS name,
                COUNT(*)::int AS cnt,
                COALESCE(SUM(e.eff_revenue), 0)::numeric AS amount
            FROM enriched e
            WHERE e.customer_name IS NOT NULL
              AND btrim(e.customer_name) <> ''
              AND btrim(e.customer_name) <> '-'
            GROUP BY btrim(e.customer_name)
            ORDER BY COUNT(*) DESC, COALESCE(SUM(e.eff_revenue), 0) DESC, btrim(e.customer_name) ASC
            LIMIT 10
        ) cp_row
    ),
    venues_json AS (
        SELECT COALESCE(
            jsonb_agg(jsonb_build_object('name', v_row.name, 'count', v_row.cnt, 'revenue', v_row.revenue) ORDER BY v_row.cnt DESC, v_row.revenue DESC, v_row.name ASC),
            '[]'::jsonb
        ) AS arr
        FROM (
            SELECT
                btrim(e.location_name) AS name,
                COUNT(*)::int AS cnt,
                COALESCE(SUM(e.eff_revenue), 0)::numeric AS revenue
            FROM enriched e
            WHERE e.location_name IS NOT NULL
              AND btrim(e.location_name) <> ''
              AND btrim(e.location_name) <> '-'
            GROUP BY btrim(e.location_name)
            ORDER BY COUNT(*) DESC, COALESCE(SUM(e.eff_revenue), 0) DESC, btrim(e.location_name) ASC
            LIMIT 10
        ) v_row
    ),
    low_margin_json AS (
        SELECT COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', lm.id,
                    'name', COALESCE(lm.name, ''),
                    'artist', COALESCE(NULLIF(btrim(lm.artist_name), ''), '-'),
                    'revenue', lm.eff_revenue,
                    'cost', lm.eff_cost,
                    'profit', lm.profit,
                    'marginPct', lm.margin_pct,
                    'margin_pct', lm.margin_pct
                )
                ORDER BY lm.raw_margin ASC, lm.id DESC
            ),
            '[]'::jsonb
        ) AS arr
        FROM (
            SELECT
                e.id,
                e.name,
                e.artist_name,
                e.eff_revenue,
                e.eff_cost,
                (e.eff_revenue - e.eff_cost)::numeric AS profit,
                (((e.eff_revenue - e.eff_cost) / e.eff_revenue) * 100)::numeric AS raw_margin,
                ROUND((((e.eff_revenue - e.eff_cost) / e.eff_revenue) * 100)::numeric, 1) AS margin_pct
            FROM enriched e
            WHERE e.eff_revenue > 0
              AND (((e.eff_revenue - e.eff_cost) / e.eff_revenue) * 100) < 40
            ORDER BY (((e.eff_revenue - e.eff_cost) / e.eff_revenue) * 100) ASC, e.id DESC
            LIMIT 8
        ) lm
    )
    SELECT jsonb_build_object(
        'totals', tj.obj,
        'status_counts', ss.obj,
        'banknotes', bj.obj,
        'expenses', ej.arr,
        'categories', cj.arr,
        'top_artists', aj.arr,
        'top_customers', crj.arr,
        'top_customers_by_projects', ccj.arr,
        'top_venues', vj.arr,
        'low_margin', lmj.arr
    )
    INTO v_result
    FROM totals_json tj
    CROSS JOIN status_summary ss
    CROSS JOIN banknotes_json bj
    CROSS JOIN expenses_json ej
    CROSS JOIN categories_json cj
    CROSS JOIN artists_json aj
    CROSS JOIN customers_rev_json crj
    CROSS JOIN customers_cnt_json ccj
    CROSS JOIN venues_json vj
    CROSS JOIN low_margin_json lmj;

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_complete_analytics(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_complete_analytics(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ==============================================================================
-- ส่วนที่ 7: ตาราง Tombstone ซิงก์การลบข้ามอุปกรณ์ (`public.deleted_records`) & Triggers
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.deleted_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deleted_records
    ADD COLUMN IF NOT EXISTS table_name TEXT NOT NULL DEFAULT 'projects',
    ADD COLUMN IF NOT EXISTS record_id TEXT,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_deleted_records_deleted_at
    ON public.deleted_records(deleted_at);

CREATE INDEX IF NOT EXISTS idx_deleted_records_table_record
    ON public.deleted_records(table_name, record_id);

ALTER TABLE public.deleted_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow app full access" ON public.deleted_records;
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.deleted_records;
DROP POLICY IF EXISTS "Allow authenticated select tombstones" ON public.deleted_records;
DROP POLICY IF EXISTS "Allow authenticated insert tombstones" ON public.deleted_records;

CREATE POLICY "Allow authenticated select tombstones" ON public.deleted_records
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert tombstones" ON public.deleted_records
    FOR INSERT TO authenticated WITH CHECK (true);

REVOKE ALL ON public.deleted_records FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.deleted_records TO authenticated;
REVOKE ALL ON public.deleted_records FROM anon;

CREATE OR REPLACE FUNCTION public.record_generic_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_record_id TEXT := NULLIF(btrim(COALESCE(to_jsonb(OLD)->>'id', '')), '');
BEGIN
    IF v_record_id IS NOT NULL THEN
        INSERT INTO public.deleted_records (table_name, record_id, deleted_at)
        VALUES (TG_TABLE_NAME, v_record_id, now());
    END IF;
    RETURN OLD;
END;
$$;

DO $$
DECLARE
    tbl TEXT;
BEGIN
    -- ลบ Trigger รุ่นเก่าบน projects ออกก่อนเพื่อป้องกันการบันทึก Tombstone ซ้ำซ้อน
    IF to_regclass('public.projects') IS NOT NULL THEN
        DROP TRIGGER IF EXISTS trigger_record_project_deletion ON public.projects;
    END IF;

    FOREACH tbl IN ARRAY ARRAY[
        'projects',
        'quotations',
        'material_rates',
        'delivery_locations',
        'artists',
        'customers',
        'staff_users'
    ] LOOP
        IF to_regclass('public.' || tbl) IS NOT NULL THEN
            EXECUTE format('DROP TRIGGER IF EXISTS trg_record_generic_deletion ON public.%I;', tbl);
            EXECUTE format(
                'CREATE TRIGGER trg_record_generic_deletion AFTER DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.record_generic_deletion();',
                tbl
            );
        END IF;
    END LOOP;
END $$;

-- ==============================================================================
-- ส่วนที่ 8: สถานะยกเลิกรายการย่อย (`is_voided`) & `public.save_project_with_items`
-- ==============================================================================
DO $$
BEGIN
    IF to_regclass('public.projects') IS NOT NULL THEN
        ALTER TABLE public.projects
            ADD COLUMN IF NOT EXISTS customer_phone TEXT,
            ADD COLUMN IF NOT EXISTS customer_line TEXT,
            ADD COLUMN IF NOT EXISTS customer_social TEXT,
            ADD COLUMN IF NOT EXISTS customer_email TEXT,
            ADD COLUMN IF NOT EXISTS customer_tax_id TEXT,
            ADD COLUMN IF NOT EXISTS customer_address TEXT,
            ADD COLUMN IF NOT EXISTS recipient_name TEXT,
            ADD COLUMN IF NOT EXISTS recipient_phone TEXT,
            ADD COLUMN IF NOT EXISTS location_id UUID,
            ADD COLUMN IF NOT EXISTS map_link TEXT,
            ADD COLUMN IF NOT EXISTS raw_delivery_end TEXT,
            ADD COLUMN IF NOT EXISTS delivery_date_display TEXT,
            ADD COLUMN IF NOT EXISTS note TEXT,
            ADD COLUMN IF NOT EXISTS primary_image_url TEXT,
            ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}',
            ADD COLUMN IF NOT EXISTS slips TEXT[] DEFAULT '{}';

        ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow app full access" ON public.projects;
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = 'Allow authenticated full access'
        ) THEN
            CREATE POLICY "Allow authenticated full access" ON public.projects
                FOR ALL TO authenticated USING (true) WITH CHECK (true);
        END IF;
        REVOKE ALL ON TABLE public.projects FROM PUBLIC, anon;
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.projects TO authenticated;
    END IF;

    IF to_regclass('public.project_quotation_items') IS NOT NULL THEN
        ALTER TABLE public.project_quotation_items
            ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS is_voided BOOLEAN NOT NULL DEFAULT false;

        ALTER TABLE public.project_quotation_items ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow app full access" ON public.project_quotation_items;
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public' AND tablename = 'project_quotation_items' AND policyname = 'Allow authenticated full access'
        ) THEN
            CREATE POLICY "Allow authenticated full access" ON public.project_quotation_items
                FOR ALL TO authenticated USING (true) WITH CHECK (true);
        END IF;
        REVOKE ALL ON TABLE public.project_quotation_items FROM PUBLIC, anon;
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.project_quotation_items TO authenticated;
    END IF;

    IF to_regclass('public.project_customer_support') IS NOT NULL THEN
        ALTER TABLE public.project_customer_support
            ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;

        ALTER TABLE public.project_customer_support ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow app full access" ON public.project_customer_support;
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public' AND tablename = 'project_customer_support' AND policyname = 'Allow authenticated full access'
        ) THEN
            CREATE POLICY "Allow authenticated full access" ON public.project_customer_support
                FOR ALL TO authenticated USING (true) WITH CHECK (true);
        END IF;
        REVOKE ALL ON TABLE public.project_customer_support FROM PUBLIC, anon;
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.project_customer_support TO authenticated;
    END IF;

    IF to_regclass('public.project_expenses') IS NOT NULL THEN
        ALTER TABLE public.project_expenses
            ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS is_voided BOOLEAN NOT NULL DEFAULT false;

        ALTER TABLE public.project_expenses ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Allow app full access" ON public.project_expenses;
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public' AND tablename = 'project_expenses' AND policyname = 'Allow authenticated full access'
        ) THEN
            CREATE POLICY "Allow authenticated full access" ON public.project_expenses
                FOR ALL TO authenticated USING (true) WITH CHECK (true);
        END IF;
        REVOKE ALL ON TABLE public.project_expenses FROM PUBLIC, anon;
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.project_expenses TO authenticated;
    END IF;

    IF to_regclass('public.projects') IS NOT NULL THEN
        EXECUTE $fn$
        CREATE OR REPLACE FUNCTION public.save_project_with_items(
            p_project JSONB,
            p_quotation_items JSONB DEFAULT '[]'::JSONB,
            p_customer_support JSONB DEFAULT '[]'::JSONB,
            p_expenses JSONB DEFAULT '[]'::JSONB
        )
        RETURNS VOID
        LANGUAGE plpgsql
        SECURITY INVOKER
        SET search_path = public
        AS $body$
        DECLARE
            project_data public.projects;
        BEGIN
            IF auth.uid() IS NULL THEN
                RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
            END IF;
            IF jsonb_typeof(p_project) IS DISTINCT FROM 'object'
               OR jsonb_typeof(p_quotation_items) IS DISTINCT FROM 'array'
               OR jsonb_typeof(p_customer_support) IS DISTINCT FROM 'array'
               OR jsonb_typeof(p_expenses) IS DISTINCT FROM 'array' THEN
                RAISE EXCEPTION 'Invalid project payload' USING ERRCODE = '22023';
            END IF;
            project_data := jsonb_populate_record(NULL::public.projects, p_project);
            IF project_data.id IS NULL OR btrim(project_data.id) = '' THEN
                RAISE EXCEPTION 'Project ID required' USING ERRCODE = '22023';
            END IF;

            INSERT INTO public.projects (
                id, name, category, project_datetime, payment_date,
                artist_name, customer_name, customer_phone, customer_line,
                customer_social, customer_email, customer_tax_id, customer_address,
                recipient_name, recipient_phone, location_name, location_id, map_link,
                raw_delivery_start, raw_delivery_end, delivery_date_display,
                deal_status, transport_status, payment_status,
                wage, delivery_fee, deposit_amount, total_revenue, total_expenses,
                net_profit, customer_support_total, note, primary_image_url, images, slips
            ) VALUES (
                project_data.id, project_data.name, project_data.category,
                project_data.project_datetime, project_data.payment_date,
                project_data.artist_name, project_data.customer_name,
                project_data.customer_phone, project_data.customer_line,
                project_data.customer_social, project_data.customer_email,
                project_data.customer_tax_id, project_data.customer_address,
                project_data.recipient_name, project_data.recipient_phone,
                project_data.location_name, project_data.location_id, project_data.map_link,
                project_data.raw_delivery_start, project_data.raw_delivery_end,
                project_data.delivery_date_display,
                COALESCE(project_data.deal_status, 'confirmed'),
                COALESCE(project_data.transport_status, 'preparing'),
                COALESCE(project_data.payment_status, 'unpaid'),
                project_data.wage, project_data.delivery_fee, project_data.deposit_amount,
                project_data.total_revenue, project_data.total_expenses,
                project_data.net_profit, project_data.customer_support_total,
                project_data.note, project_data.primary_image_url, project_data.images, project_data.slips
            ) ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name, category = EXCLUDED.category,
                project_datetime = EXCLUDED.project_datetime, payment_date = EXCLUDED.payment_date,
                artist_name = EXCLUDED.artist_name, customer_name = EXCLUDED.customer_name,
                customer_phone = EXCLUDED.customer_phone, customer_line = EXCLUDED.customer_line,
                customer_social = EXCLUDED.customer_social, customer_email = EXCLUDED.customer_email,
                customer_tax_id = EXCLUDED.customer_tax_id, customer_address = EXCLUDED.customer_address,
                recipient_name = EXCLUDED.recipient_name, recipient_phone = EXCLUDED.recipient_phone,
                location_name = EXCLUDED.location_name, location_id = EXCLUDED.location_id,
                map_link = EXCLUDED.map_link, raw_delivery_start = EXCLUDED.raw_delivery_start,
                raw_delivery_end = EXCLUDED.raw_delivery_end, delivery_date_display = EXCLUDED.delivery_date_display,
                deal_status = EXCLUDED.deal_status, transport_status = EXCLUDED.transport_status,
                payment_status = EXCLUDED.payment_status, wage = EXCLUDED.wage,
                delivery_fee = EXCLUDED.delivery_fee, deposit_amount = EXCLUDED.deposit_amount,
                total_revenue = EXCLUDED.total_revenue, total_expenses = EXCLUDED.total_expenses,
                net_profit = EXCLUDED.net_profit, customer_support_total = EXCLUDED.customer_support_total,
                note = EXCLUDED.note, primary_image_url = EXCLUDED.primary_image_url,
                images = EXCLUDED.images, slips = EXCLUDED.slips;

            IF to_regclass('public.project_quotation_items') IS NOT NULL THEN
                DELETE FROM public.project_quotation_items WHERE project_id = project_data.id;

                INSERT INTO public.project_quotation_items
                    (id, project_id, category, detail, quantity, unit_price, price, item_date, sort_order, is_voided)
                SELECT
                    CASE
                        WHEN (item->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
                            CASE
                                WHEN ROW_NUMBER() OVER (PARTITION BY lower(item->>'id') ORDER BY ord) = 1
                                     AND NOT EXISTS (
                                         SELECT 1 FROM public.project_quotation_items q0
                                         WHERE q0.id::text = lower(item->>'id')
                                     )
                                    THEN (item->>'id')::uuid
                                ELSE gen_random_uuid()
                            END
                        ELSE gen_random_uuid()
                    END,
                    project_data.id,
                    COALESCE(x.category, 'รายการทั่วไป'),
                    COALESCE(x.detail, ''),
                    COALESCE(x.quantity, 1),
                    COALESCE(x.unit_price, 0),
                    COALESCE(x.price, 0),
                    NULLIF(btrim(x.item_date), '')::date,
                    COALESCE(x.sort_order, (ord - 1)::int),
                    CASE
                        WHEN NULLIF(btrim(item->>'is_voided'), '') IS NULL THEN false
                        ELSE COALESCE((item->>'is_voided')::boolean, false)
                    END
                FROM jsonb_array_elements(p_quotation_items) WITH ORDINALITY AS elem(item, ord)
                CROSS JOIN LATERAL jsonb_to_record(elem.item) AS x(
                    category TEXT, detail TEXT, quantity NUMERIC, unit_price NUMERIC,
                    price NUMERIC, item_date TEXT, sort_order INT
                );
            END IF;

            IF to_regclass('public.project_customer_support') IS NOT NULL THEN
                DELETE FROM public.project_customer_support WHERE project_id = project_data.id;

                INSERT INTO public.project_customer_support
                    (id, project_id, denomination, quantity, price, item_date, sort_order)
                SELECT
                    CASE
                        WHEN (item->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
                            CASE
                                WHEN ROW_NUMBER() OVER (PARTITION BY lower(item->>'id') ORDER BY ord) = 1
                                     AND NOT EXISTS (
                                         SELECT 1 FROM public.project_customer_support cs0
                                         WHERE cs0.id::text = lower(item->>'id')
                                     )
                                    THEN (item->>'id')::uuid
                                ELSE gen_random_uuid()
                            END
                        ELSE gen_random_uuid()
                    END,
                    project_data.id,
                    COALESCE(x.denomination, 0),
                    COALESCE(x.quantity, 0),
                    COALESCE(x.price, 0),
                    NULLIF(btrim(x.item_date), '')::date,
                    COALESCE(x.sort_order, (ord - 1)::int)
                FROM jsonb_array_elements(p_customer_support) WITH ORDINALITY AS elem(item, ord)
                CROSS JOIN LATERAL jsonb_to_record(elem.item) AS x(
                    denomination INT, quantity INT, price NUMERIC, item_date TEXT, sort_order INT
                );
            END IF;

            IF to_regclass('public.project_expenses') IS NOT NULL THEN
                DELETE FROM public.project_expenses WHERE project_id = project_data.id;

                INSERT INTO public.project_expenses
                    (id, project_id, category, detail, quantity, unit_price, price, item_date, sort_order, is_voided)
                SELECT
                    CASE
                        WHEN (item->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
                            CASE
                                WHEN ROW_NUMBER() OVER (PARTITION BY lower(item->>'id') ORDER BY ord) = 1
                                     AND NOT EXISTS (
                                         SELECT 1 FROM public.project_expenses pe0
                                         WHERE pe0.id::text = lower(item->>'id')
                                     )
                                    THEN (item->>'id')::uuid
                                ELSE gen_random_uuid()
                            END
                        ELSE gen_random_uuid()
                    END,
                    project_data.id,
                    COALESCE(x.category, 'ค่าใช้จ่ายทั่วไป'),
                    COALESCE(x.detail, ''),
                    COALESCE(x.quantity, 1),
                    COALESCE(x.unit_price, 0),
                    COALESCE(x.price, 0),
                    NULLIF(btrim(x.item_date), '')::date,
                    COALESCE(x.sort_order, (ord - 1)::int),
                    CASE
                        WHEN NULLIF(btrim(item->>'is_voided'), '') IS NULL THEN false
                        ELSE COALESCE((item->>'is_voided')::boolean, false)
                    END
                FROM jsonb_array_elements(p_expenses) WITH ORDINALITY AS elem(item, ord)
                CROSS JOIN LATERAL jsonb_to_record(elem.item) AS x(
                    category TEXT, detail TEXT, quantity NUMERIC, unit_price NUMERIC,
                    price NUMERIC, item_date TEXT, sort_order INT
                );
            END IF;
        END;
        $body$;
        $fn$;

        REVOKE ALL ON FUNCTION public.save_project_with_items(JSONB, JSONB, JSONB, JSONB) FROM PUBLIC, anon;
        GRANT EXECUTE ON FUNCTION public.save_project_with_items(JSONB, JSONB, JSONB, JSONB) TO authenticated;
    END IF;
END $$;

-- ==============================================================================
-- ส่วนที่ 9: ระบบออกรหัสโปรเจกต์อัตโนมัติฝั่งเซิร์ฟเวอร์แบบ Atomic Sequence (`public.allocate_next_project_code`)
-- ==============================================================================
CREATE SEQUENCE IF NOT EXISTS public.project_code_seq
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1;

CREATE OR REPLACE FUNCTION public.allocate_next_project_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_max_projects BIGINT := 0;
    v_max_deleted BIGINT := 0;
    v_max BIGINT := 0;
    v_seq_val BIGINT;
    v_next_text TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Authentication required' USING ERRCODE = '42501';
    END IF;

    PERFORM pg_advisory_xact_lock(2026042401);

    IF to_regclass('public.projects') IS NOT NULL THEN
        SELECT COALESCE(MAX(substring(id FROM 3)::bigint), 0)
        INTO v_max_projects
        FROM public.projects
        WHERE id ~ '^P-[0-9]+$';
    END IF;

    IF to_regclass('public.deleted_records') IS NOT NULL THEN
        SELECT COALESCE(MAX(substring(record_id FROM 3)::bigint), 0)
        INTO v_max_deleted
        FROM public.deleted_records
        WHERE table_name = 'projects'
          AND record_id ~ '^P-[0-9]+$';
    END IF;

    v_max := GREATEST(COALESCE(v_max_projects, 0), COALESCE(v_max_deleted, 0));

    -- Atomic PostgreSQL Sequence: guarantees unique strictly increasing IDs even when multiple users save simultaneously before INSERT commits
    v_seq_val := nextval('public.project_code_seq');
    IF v_seq_val <= v_max THEN
        v_seq_val := setval('public.project_code_seq', v_max + 1, true);
    END IF;

    v_next_text := v_seq_val::text;

    IF length(v_next_text) < 4 THEN
        RETURN 'P-' || lpad(v_next_text, 4, '0');
    END IF;

    RETURN 'P-' || v_next_text;
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_next_project_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.allocate_next_project_code() TO authenticated;

-- ==============================================================================
-- ส่วนที่ 10: REPLICA IDENTITY DEFAULT, ล็อกดาวน์ RLS เพิ่มเติม & เปิดใช้งาน Realtime
-- ==============================================================================
DO $$
DECLARE
    tbl TEXT;
    pol RECORD;
BEGIN
    -- ป้องกัน WAL payload เกิน 1MB ตอนลบโปรเจกต์ที่มี images / slips ขนาดใหญ่
    IF to_regclass('public.projects') IS NOT NULL THEN
        ALTER TABLE public.projects REPLICA IDENTITY DEFAULT;
    END IF;

    -- ล็อกดาวน์ RLS บน quotations, material_rates และ delivery_locations เฉพาะ authenticated
    FOREACH tbl IN ARRAY ARRAY['quotations', 'material_rates', 'delivery_locations'] LOOP
        IF to_regclass('public.' || tbl) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
            FOR pol IN
                SELECT policyname
                FROM pg_policies
                WHERE schemaname = 'public' AND tablename = tbl
            LOOP
                EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, tbl);
            END LOOP;
            EXECUTE format(
                'CREATE POLICY "Allow authenticated full access" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true);',
                tbl
            );
            EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon;', tbl);
            EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated;', tbl);
        END IF;
    END LOOP;

    -- ผูกตารางที่มีอยู่จริงเข้ากับ Supabase Realtime Publication อย่างปลอดภัย
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        FOREACH tbl IN ARRAY ARRAY[
            'projects',
            'deleted_records',
            'quotations',
            'material_rates',
            'delivery_locations',
            'artists',
            'customers',
            'staff_users',
            'shop_settings',
            'roles'
        ] LOOP
            IF to_regclass('public.' || tbl) IS NOT NULL
               AND NOT EXISTS (
                   SELECT 1
                   FROM pg_publication_tables
                   WHERE pubname = 'supabase_realtime'
                     AND schemaname = 'public'
                     AND tablename = tbl
               )
            THEN
                EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
            END IF;
        END LOOP;
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
