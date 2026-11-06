-- ==============================================================================
-- FLOWER2U (F2U) - Database Migration: Staff Profile Details & Custom Roles Management
-- วัตถุประสงค์:
-- 1. เพิ่มคอลัมน์ในตาราง staff_users (เลขบัตรประชาชน, วันเกิด, ที่อยู่, ผู้ติดต่อฉุกเฉิน ฯลฯ)
-- 2. สร้าง/อัปเดตตาราง roles รองรับการเพิ่ม Role ใหม่ได้ไม่จำกัด พร้อมกำหนดสิทธิ์เข้าถึงรายหน้า (allowed_pages)
-- 3. กำหนด RLS Policies ให้สามารถอ่าน/เขียนบันทึกบทบาทและพนักงานได้ราบรื่น 100%
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. เพิ่มคอลัมน์ใหม่ในตาราง staff_users (ข้อมูลส่วนตัวพนักงาน)
-- ------------------------------------------------------------------------------
ALTER TABLE public.staff_users ADD COLUMN IF NOT EXISTS citizen_id TEXT;
ALTER TABLE public.staff_users ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE public.staff_users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.staff_users ADD COLUMN IF NOT EXISTS emergency_contact TEXT;
ALTER TABLE public.staff_users ADD COLUMN IF NOT EXISTS hire_date DATE;
ALTER TABLE public.staff_users ADD COLUMN IF NOT EXISTS bank_account_no TEXT;
ALTER TABLE public.staff_users ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE public.staff_users ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE public.staff_users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.staff_users ADD COLUMN IF NOT EXISTS phone TEXT;

-- ปลด NOT NULL ของ role_id เพื่อความยืดหยุ่นในการลงทะเบียน
ALTER TABLE public.staff_users ALTER COLUMN role_id DROP NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. สร้างหรือปรับปรุงตาราง roles (บทบาทและสิทธิ์การใช้งานของระบบ)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,                                               -- รหัสระบบภาษาอังกฤษ เช่น 'admin', 'technician', 'driver', 'accountant', 'manager'
    code TEXT,                                                               -- รหัสตัวเลข 2 หลัก เช่น '11', '21', '31', '41', '51'
    label TEXT NOT NULL,                                                     -- ชื่อตำแหน่งภาษาไทย เช่น 'ผู้ดูแลระบบ', 'ผู้จัดการร้าน'
    description TEXT,                                                        -- รายละเอียดหน้าที่
    allowed_pages TEXT[] NOT NULL DEFAULT '{"Calendar", "Plans"}',           -- รายชื่อแท็บหน้าจอที่เข้าถึงได้
    can_edit_pricing BOOLEAN DEFAULT false,                                  -- สิทธิ์แก้ไขราคา/ใบเสนอราคา
    can_delete_project BOOLEAN DEFAULT false,                                -- สิทธิ์ลบโปรเจกต์งาน
    can_borrow_tools BOOLEAN DEFAULT true,                                   -- สิทธิ์เบิก-ยืมอุปกรณ์ในคลัง
    can_manage_users BOOLEAN DEFAULT false,                                  -- สิทธิ์จัดการพนักงานและสิทธิ์
    is_system_role BOOLEAN DEFAULT false,                                    -- ป้องกันลบบทบาทหลัก (Admin)
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- เพิ่มคอลัมน์เพิ่มเติมหากมีตาราง roles อยู่แล้ว
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS allowed_pages TEXT[] NOT NULL DEFAULT '{"Calendar", "Plans"}';
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS can_edit_pricing BOOLEAN DEFAULT false;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS can_delete_project BOOLEAN DEFAULT false;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS can_borrow_tools BOOLEAN DEFAULT true;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS can_manage_users BOOLEAN DEFAULT false;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS is_system_role BOOLEAN DEFAULT false;

-- ------------------------------------------------------------------------------
-- 3. ลงทะเบียนบทบาทเริ่มต้น (Default System Roles)
-- ------------------------------------------------------------------------------
INSERT INTO public.roles (name, code, label, description, allowed_pages, can_edit_pricing, can_delete_project, can_borrow_tools, can_manage_users, is_system_role)
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
    code = EXCLUDED.code,
    label = EXCLUDED.label,
    description = EXCLUDED.description,
    allowed_pages = EXCLUDED.allowed_pages,
    can_edit_pricing = EXCLUDED.can_edit_pricing,
    can_delete_project = EXCLUDED.can_delete_project,
    can_borrow_tools = EXCLUDED.can_borrow_tools,
    can_manage_users = EXCLUDED.can_manage_users,
    is_system_role = EXCLUDED.is_system_role;

-- ------------------------------------------------------------------------------
-- 4. ตั้งค่า RLS (Row Level Security) สำหรับตาราง roles
-- ------------------------------------------------------------------------------
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select roles for all" ON public.roles;
CREATE POLICY "Allow select roles for all" ON public.roles
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert roles for all" ON public.roles;
CREATE POLICY "Allow insert roles for all" ON public.roles
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update roles for all" ON public.roles;
CREATE POLICY "Allow update roles for all" ON public.roles
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow delete roles for all" ON public.roles;
CREATE POLICY "Allow delete roles for all" ON public.roles
    FOR DELETE USING (is_system_role = false);

-- ------------------------------------------------------------------------------
-- 5. ตั้งค่า Trigger Auto-update timestamp
-- ------------------------------------------------------------------------------
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

COMMIT;
