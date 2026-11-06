-- ==============================================================================
-- FLOWER2U (F2U) - Migration Script: Convert staff_users.id (UUID) to Staff Code (TEXT)
-- ปรับปรุงพิเศษ: ป้องกัน Error 42703 (column does not exist) และ 42804 (foreign key incompatible) 100%
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. ปลด Foreign Key ทุกตัวที่อ้างอิง staff_users(id) ออกแบบ Dynamic
-- พร้อมทั้งแปลงคอลัมน์ต้นทางทั้งหมดให้เป็น TEXT เพื่อป้องกัน Type Incompatibility (UUID vs TEXT)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT 
            tc.table_schema, 
            tc.table_name, 
            tc.constraint_name, 
            kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'staff_users'
          AND ccu.column_name = 'id'
    ) LOOP
        EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I;', r.table_schema, r.table_name, r.constraint_name);
        EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I TYPE TEXT USING %I::TEXT;', r.table_schema, r.table_name, r.column_name, r.column_name);
    END LOOP;
END $$;

-- ตรวจสอบและแปลงคอลัมน์ที่เกี่ยวข้องเป็น TEXT อย่างปลอดภัย (เฉพาะคอลัมน์ที่มีอยู่จริง)
DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN 
        SELECT table_schema, table_name, column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND (table_name, column_name) IN (
            ('inventory_items', 'decommissioned_by_user_id'),
            ('asset_loans', 'borrower_user_id'),
            ('inventory_disposals', 'disposed_by_user_id'),
            ('inventory_disposals', 'approved_by_user_id'),
            ('asset_disposals', 'disposed_by_user_id'),
            ('asset_disposals', 'approved_by_user_id'),
            ('expense_items', 'created_by_user_id'),
            ('expense_items', 'voided_by_user_id')
        )
    LOOP
        EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I TYPE TEXT USING %I::TEXT;', rec.table_schema, rec.table_name, rec.column_name, rec.column_name);
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 2. ปลด Default UUID และแปลง staff_users.id เป็น TEXT
-- ------------------------------------------------------------------------------
ALTER TABLE public.staff_users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE public.staff_users ALTER COLUMN id TYPE TEXT USING id::TEXT;

-- เพิ่มคอลัมน์ email, citizen_id, address, emergency_contact และปรับ role_id ให้เป็นทางเลือก (เพื่อความยืดหยุ่นในการบันทึก)
ALTER TABLE public.staff_users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.staff_users ADD COLUMN IF NOT EXISTS citizen_id TEXT;
ALTER TABLE public.staff_users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.staff_users ADD COLUMN IF NOT EXISTS emergency_contact TEXT;
ALTER TABLE public.staff_users ALTER COLUMN role_id DROP NOT NULL;

-- ------------------------------------------------------------------------------
-- 3. แมปปิ้งและอัปเดตรหัสพนักงานใน staff_users และตารางที่อ้างอิง
-- ------------------------------------------------------------------------------
CREATE TEMP TABLE staff_id_map AS
SELECT 
    id AS old_id,
    CASE 
        WHEN username = '1' THEN '2611001'
        WHEN username = 'AOM' THEN '2611002'
        WHEN username = 'DREAM' THEN '2611003'
        WHEN username = 'Chuti' THEN '2611004'
        ELSE id
    END AS new_id
FROM public.staff_users;

-- หากมีคอลัมน์ staff_code อยู่เดิม ให้นำค่ามาใช้
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'staff_users' AND column_name = 'staff_code'
    ) THEN
        EXECUTE 'UPDATE staff_id_map m 
                 SET new_id = s.staff_code 
                 FROM public.staff_users s 
                 WHERE s.id = m.old_id 
                   AND s.staff_code IS NOT NULL 
                   AND s.staff_code != '''';';
    END IF;
END $$;

-- จัดการ UUID ที่ยังเหลืออยู่ให้เป็นรหัสพนักงานมาตรฐาน (2621005, ...)
DO $$
DECLARE
    u RECORD;
    v_seq INT := 5;
    v_code TEXT;
BEGIN
    FOR u IN SELECT old_id FROM staff_id_map WHERE length(new_id) > 10 LOOP
        v_code := '2621' || lpad(v_seq::TEXT, 3, '0');
        UPDATE staff_id_map SET new_id = v_code WHERE old_id = u.old_id;
        v_seq := v_seq + 1;
    END LOOP;
END $$;

-- อัปเดตตารางที่เกี่ยวข้องให้ชี้ไปยังรหัสพนักงานใหม่ (รันเฉพาะตารางที่มีอยู่จริง)
DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN 
        SELECT table_schema, table_name, column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND (table_name, column_name) IN (
            ('inventory_items', 'decommissioned_by_user_id'),
            ('asset_loans', 'borrower_user_id'),
            ('inventory_disposals', 'disposed_by_user_id'),
            ('inventory_disposals', 'approved_by_user_id'),
            ('asset_disposals', 'disposed_by_user_id'),
            ('asset_disposals', 'approved_by_user_id'),
            ('expense_items', 'created_by_user_id'),
            ('expense_items', 'voided_by_user_id')
        )
    LOOP
        EXECUTE format('UPDATE %I.%I t SET %I = m.new_id FROM staff_id_map m WHERE t.%I = m.old_id;', 
            rec.table_schema, rec.table_name, rec.column_name, rec.column_name);
    END LOOP;
END $$;

-- อัปเดต id ใน staff_users เป็นรหัสพนักงาน
UPDATE public.staff_users t
SET id = m.new_id
FROM staff_id_map m
WHERE t.id = m.old_id;

DROP TABLE staff_id_map;

-- ------------------------------------------------------------------------------
-- 4. ลบคอลัมน์ staff_code ออก (หากมีอยู่ในระบบ)
-- ------------------------------------------------------------------------------
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'staff_users' AND column_name = 'staff_code'
    ) THEN
        DROP TRIGGER IF EXISTS trg_set_staff_code ON public.staff_users;
        DROP FUNCTION IF EXISTS generate_staff_code();
        DROP INDEX IF EXISTS public.idx_staff_users_staff_code;
        ALTER TABLE public.staff_users DROP COLUMN staff_code;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 5. สร้าง Trigger สำหรับ Auto-generate รหัสพนักงานลงใน id อัตโนมัติ (YY + PP + NNN)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_staff_user_id()
RETURNS TRIGGER AS $$
DECLARE
    v_year TEXT;
    v_role_code TEXT;
    v_seq INT;
    v_seq_str TEXT;
    v_role_name TEXT;
BEGIN
    -- ถ้ามี id ระบุมาแล้ว (ไม่ใช่ค่าว่าง หรือไม่ใช่ uuid เดิม) ให้ใช้ค่านั้นเลย
    IF NEW.id IS NOT NULL AND NEW.id != '' AND NEW.id NOT LIKE 'staff-%' AND length(NEW.id) <= 10 THEN
        RETURN NEW;
    END IF;

    v_year := to_char(COALESCE(NEW.created_at, now()), 'YY');

    -- ดึงชื่อ role จาก roles table
    IF NEW.role_id IS NOT NULL THEN
        SELECT name INTO v_role_name
        FROM public.roles
        WHERE id = NEW.role_id;
    END IF;

    v_role_code := CASE 
        WHEN v_role_name = 'admin' THEN '11'
        WHEN v_role_name = 'technician' THEN '21'
        WHEN v_role_name = 'driver' THEN '31'
        WHEN v_role_name = 'accountant' THEN '41'
        ELSE '21'
    END;

    SELECT COALESCE(MAX(
        CASE 
            WHEN length(id) >= 7 AND substr(id, 1, 2) = v_year 
            THEN substring(id from 5)::INT 
            ELSE 0 
        END
    ), 0) + 1
    INTO v_seq
    FROM public.staff_users;

    IF v_seq < 1000 THEN
        v_seq_str := lpad(v_seq::TEXT, 3, '0');
    ELSE
        v_seq_str := v_seq::TEXT;
    END IF;

    NEW.id := v_year || v_role_code || v_seq_str;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_staff_user_id ON public.staff_users;
CREATE TRIGGER trg_set_staff_user_id
BEFORE INSERT ON public.staff_users
FOR EACH ROW
EXECUTE FUNCTION generate_staff_user_id();

-- ------------------------------------------------------------------------------
-- 6. ป้องกัน Foreign Key ตกค้าง และผูก Foreign Key Constraints กลับเข้าไปใหม่
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN 
        SELECT table_schema, table_name, column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND (table_name, column_name) IN (
            ('inventory_items', 'decommissioned_by_user_id'),
            ('asset_loans', 'borrower_user_id'),
            ('inventory_disposals', 'disposed_by_user_id'),
            ('inventory_disposals', 'approved_by_user_id'),
            ('asset_disposals', 'disposed_by_user_id'),
            ('asset_disposals', 'approved_by_user_id'),
            ('expense_items', 'created_by_user_id'),
            ('expense_items', 'voided_by_user_id')
        )
    LOOP
        -- เคลียร์ reference ที่ไม่มีอยู่ใน staff_users ป้องกัน FK violation
        EXECUTE format('UPDATE %I.%I SET %I = NULL WHERE %I IS NOT NULL AND %I NOT IN (SELECT id FROM public.staff_users);', 
            rec.table_schema, rec.table_name, rec.column_name, rec.column_name, rec.column_name);
            
        -- ใส่ Foreign Key Constraint กลับคืน
        EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I;', 
            rec.table_schema, rec.table_name, rec.table_name || '_' || rec.column_name || '_fkey');
        EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.staff_users(id) ON DELETE SET NULL;', 
            rec.table_schema, rec.table_name, rec.table_name || '_' || rec.column_name || '_fkey', rec.column_name);
    END LOOP;
END $$;

COMMIT;

-- ตรวจสอบผลลัพธ์
SELECT id AS staff_code_id, username, full_name, email, is_active FROM public.staff_users ORDER BY id;
