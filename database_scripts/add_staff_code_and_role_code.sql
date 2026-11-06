-- ==============================================================================
-- FLOWER2U (F2U) - Schema Extension: Staff Code (7-8 Digits) & Role Code
-- Format: YY (Year 2 digits) + PP (Role Code 2 digits) + NNN (Yearly Sequence 3+ digits)
-- Example: 2611001 (Year 26, Admin 11, Employee #1 of 2026)
-- Automatically expands to 8 digits (26111000) if > 999 employees in a year
-- ==============================================================================

-- 1. เพิ่มฟิลด์ role_code (2 หลัก) ในตาราง roles
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS role_code VARCHAR(2);
CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_role_code ON public.roles(role_code) WHERE role_code IS NOT NULL;

-- กำหนดรหัสตำแหน่งมาตรฐาน 2 หลัก
UPDATE public.roles SET role_code = '11' WHERE name = 'admin';       -- 11 = ผู้ดูแลระบบ / เจ้าของร้าน
UPDATE public.roles SET role_code = '21' WHERE name = 'technician';  -- 21 = ช่างจัดดอกไม้ / หน้างาน
UPDATE public.roles SET role_code = '31' WHERE name = 'driver';      -- 31 = พนักงานจัดส่ง / ขนส่ง
UPDATE public.roles SET role_code = '41' WHERE name = 'accountant';  -- 41 = ฝ่ายบัญชีและการเงิน

-- 2. เพิ่มฟิลด์ staff_code ในตาราง staff_users
ALTER TABLE public.staff_users ADD COLUMN IF NOT EXISTS staff_code VARCHAR(10);
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_users_staff_code ON public.staff_users(staff_code) WHERE staff_code IS NOT NULL;

-- 3. ฟังก์ชันและ Trigger สร้างรหัสพนักงานอัตโนมัติ (Auto-generate staff_code)
CREATE OR REPLACE FUNCTION generate_staff_code()
RETURNS TRIGGER AS $$
DECLARE
    v_year TEXT;
    v_role_code TEXT;
    v_seq INT;
    v_seq_str TEXT;
BEGIN
    -- ถ้ามี staff_code ระบุมาแล้ว ไม่ต้องเจนใหม่
    IF NEW.staff_code IS NOT NULL AND NEW.staff_code != '' THEN
        RETURN NEW;
    END IF;

    -- ดึงปี 2 หลักจาก created_at หรือเวลาปัจจุบัน เช่น '26'
    v_year := to_char(COALESCE(NEW.created_at, now()), 'YY');

    -- ดึง role_code จากตาราง roles (ถ้าไม่มีตั้งต้นเป็น 99)
    SELECT COALESCE(role_code, '99') INTO v_role_code
    FROM public.roles
    WHERE id = NEW.role_id;

    IF v_role_code IS NULL THEN
        v_role_code := '99';
    END IF;

    -- ค้นหาลำดับพนักงานสูงสุดของปีนั้น
    SELECT COALESCE(MAX(
        CASE 
            WHEN length(staff_code) >= 7 AND substr(staff_code, 1, 2) = v_year 
            THEN substring(staff_code from 5)::INT 
            ELSE 0 
        END
    ), 0) + 1
    INTO v_seq
    FROM public.staff_users
    WHERE staff_code IS NOT NULL;

    -- ฟอร์แมตเลขลำดับ (ต่ำกว่า 1000 เติม 0 เป็น 3 หลัก เช่น 001..999, ถ้า 1000 ขึ้นไปเป็น 4 หลักอัตโนมัติ)
    IF v_seq < 1000 THEN
        v_seq_str := lpad(v_seq::TEXT, 3, '0');
    ELSE
        v_seq_str := v_seq::TEXT;
    END IF;

    -- รวมร่างเป็นรหัส 7-8 หลัก: YY + PP + NNN
    NEW.staff_code := v_year || v_role_code || v_seq_str;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ผูก Trigger เข้ากับตาราง staff_users
DROP TRIGGER IF EXISTS trg_set_staff_code ON public.staff_users;
CREATE TRIGGER trg_set_staff_code
BEFORE INSERT ON public.staff_users
FOR EACH ROW
EXECUTE FUNCTION generate_staff_code();

-- 4. อัปเดตรหัส staff_code ให้กับพนักงาน 4 คนแรกของร้านที่มีอยู่แล้ว
UPDATE public.staff_users SET staff_code = '2611001' WHERE username = '1';
UPDATE public.staff_users SET staff_code = '2611002' WHERE username = 'AOM';
UPDATE public.staff_users SET staff_code = '2611003' WHERE username = 'DREAM';
UPDATE public.staff_users SET staff_code = '2611004' WHERE username = 'Chuti';
