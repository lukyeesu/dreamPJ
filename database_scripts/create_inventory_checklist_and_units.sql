-- ==============================================================================
-- ระบบบริหารคลังวัสดุอุปกรณ์ เชื่อมโยงใบเสนอราคาและเช็กลิสต์ (Inventory & Quotation Spec)
-- สเปกตาม d:\WebappDreame\_Markdown_.md_.md
-- ==============================================================================

-- 1. ปรับปรุงข้อจำกัด item_type ใน inventory_items ให้รองรับ 5 ประเภทรายการ:
--    'asset' (อุปกรณ์ยืม-คืน), 'reusable' (วัสดุหมุนเวียน), 'consumable' (พัสดุสิ้นเปลือง),
--    'banknote' (ธนบัตร), 'task' (งานบริการ/ขั้นตอนงาน), 'reusable_material' (เพื่อความเข้ากันได้)
DO $$
BEGIN
    ALTER TABLE public.inventory_items DROP CONSTRAINT IF EXISTS inventory_items_item_type_check;
    ALTER TABLE public.inventory_items ADD CONSTRAINT inventory_items_item_type_check 
        CHECK (lower(item_type) IN ('asset', 'reusable', 'consumable', 'banknote', 'task', 'reusable_material'));
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Notice: inventory_items table alteration skipped or already updated: %', SQLERRM;
END $$;

-- 2. สร้างตาราง asset_units: เก็บรหัสรายชิ้น (เช่น item0001, item0002) และสถานะการยืม-คืน
CREATE TABLE IF NOT EXISTS public.asset_units (
    unit_code TEXT PRIMARY KEY,
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'BORROWED', 'LOST', 'BROKEN', 'available', 'borrowed', 'lost', 'broken')),
    borrowed_by TEXT,
    borrowed_at TIMESTAMPTZ,
    project_id TEXT REFERENCES public.projects(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_asset_units_item_id ON public.asset_units(item_id);
CREATE INDEX IF NOT EXISTS idx_asset_units_status ON public.asset_units(status);
CREATE INDEX IF NOT EXISTS idx_asset_units_project_id ON public.asset_units(project_id);

-- 3. สร้างตาราง project_checklist_items: ตารางเชื่อมกลางระหว่างใบเสนอราคา คลังพัสดุ และเช็กลิสต์เตรียมของ
CREATE TABLE IF NOT EXISTS public.project_checklist_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
    category_name TEXT,
    item_name TEXT NOT NULL,
    item_type TEXT NOT NULL CHECK (lower(item_type) IN ('asset', 'reusable', 'consumable', 'banknote', 'task', 'reusable_material')),
    required_qty NUMERIC(10,2) NOT NULL DEFAULT 1,
    unit TEXT DEFAULT 'ชิ้น',
    picked_qty NUMERIC(10,2) DEFAULT 0,
    returned_qty NUMERIC(10,2) DEFAULT 0,
    damaged_qty NUMERIC(10,2) DEFAULT 0,
    unit_cost NUMERIC(10,2) DEFAULT 0,
    assigned_codes JSONB DEFAULT '[]'::jsonb,
    is_checked BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_project_checklist_project_id ON public.project_checklist_items(project_id);
CREATE INDEX IF NOT EXISTS idx_project_checklist_item_id ON public.project_checklist_items(item_id);
CREATE INDEX IF NOT EXISTS idx_project_checklist_is_checked ON public.project_checklist_items(is_checked);

-- 4. ตั้งค่า RLS (Row Level Security) สำหรับ asset_units และ project_checklist_items
ALTER TABLE public.asset_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_checklist_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow all access to asset_units" ON public.asset_units;
    CREATE POLICY "Allow all access to asset_units" ON public.asset_units
        FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Allow all access to project_checklist_items" ON public.project_checklist_items;
    CREATE POLICY "Allow all access to project_checklist_items" ON public.project_checklist_items
        FOR ALL USING (true) WITH CHECK (true);
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 5. ข้อมูลเริ่มต้นตามสเปก _Markdown_.md_.md (Seed Items)
DO $$
DECLARE
    v_scissor_id UUID := 'a808caa3-43b8-4bdf-b652-b775b4bf6d9c';
    v_tape_dispenser_id UUID := 'b1111111-1111-1111-1111-111111111111';
    v_tulip_id UUID := 'b2222222-2222-2222-2222-222222222222';
    v_banknote_100_id UUID := 'b3333333-3333-3333-3333-333333333333';
    v_tape_id UUID := 'b4444444-4444-4444-4444-444444444444';
    v_design_task_id UUID := 'b5555555-5555-5555-5555-555555555555';
BEGIN
    -- 1. อุปกรณ์ยืม-คืน (Asset)
    INSERT INTO public.inventory_items (id, code, name, item_type, unit, current_stock, min_alert_threshold, average_cost, storage_location, status, is_active)
    VALUES 
        (v_scissor_id, 'item0001', 'กรรไกรตัดกระดาษ (สีน้ำเงิน)', 'asset', 'อัน', 5, 2, 0, 'กล่องเครื่องมือ 1', 'in_service', true),
        (v_tape_dispenser_id, 'item0002', 'แท่นตัดเทปกาวตั้งโต๊ะ', 'asset', 'อัน', 3, 1, 0, 'โต๊ะจัดดอกไม้ A', 'in_service', true)
    ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name,
        item_type = EXCLUDED.item_type,
        average_cost = EXCLUDED.average_cost;

    -- สร้างรหัสรายชิ้นใน asset_units
    INSERT INTO public.asset_units (unit_code, item_id, status, borrowed_by)
    VALUES 
        ('item0001', v_scissor_id, 'AVAILABLE', NULL),
        ('item0002', v_tape_dispenser_id, 'AVAILABLE', NULL)
    ON CONFLICT (unit_code) DO NOTHING;

    -- 2. วัสดุหมุนเวียน (Reusable)
    INSERT INTO public.inventory_items (id, code, name, item_type, unit, current_stock, min_alert_threshold, average_cost, storage_location, status, is_active)
    VALUES (v_tulip_id, 'ITM-TLP-WHT', 'ดอกทิวลิปพลาสติก (สีขาว)', 'reusable', 'ชิ้น', 500, 50, 25.00, 'ชั้นวางดอกไม้ C2', 'in_service', true)
    ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name,
        item_type = EXCLUDED.item_type,
        average_cost = EXCLUDED.average_cost;

    -- 3. พัสดุสิ้นเปลือง (Consumable)
    INSERT INTO public.inventory_items (id, code, name, item_type, unit, current_stock, min_alert_threshold, average_cost, storage_location, status, is_active)
    VALUES (v_tape_id, 'ITM-TAPE-CLR', 'เทปกาวใสสำหรับจัดดอกไม้', 'consumable', 'ม้วน', 40, 10, 35.00, 'ตู้เก็บพัสดุสิ้นเปลือง', 'in_service', true)
    ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name,
        item_type = EXCLUDED.item_type,
        average_cost = EXCLUDED.average_cost;

    -- 4. ธนบัตร (Banknote)
    INSERT INTO public.inventory_items (id, code, name, item_type, unit, current_stock, min_alert_threshold, average_cost, storage_location, status, is_active)
    VALUES (v_banknote_100_id, 'BNK-100', 'ธนบัตร 100 บาท', 'banknote', 'ใบ', 1000, 100, 100.00, 'ตู้เซฟประจำร้าน', 'in_service', true)
    ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name,
        item_type = EXCLUDED.item_type,
        average_cost = EXCLUDED.average_cost;

    -- 5. งานบริการ/ขั้นตอนงาน (Task)
    INSERT INTO public.inventory_items (id, code, name, item_type, unit, current_stock, min_alert_threshold, average_cost, storage_location, status, is_active)
    VALUES (v_design_task_id, 'TSK-DSGN', 'งานออกแบบช่อดอกไม้ & จัดวางธีม', 'task', 'งาน', 9999, 0, 500.00, 'บริการในร้าน', 'in_service', true)
    ON CONFLICT (id) DO UPDATE SET 
        name = EXCLUDED.name,
        item_type = EXCLUDED.item_type,
        average_cost = EXCLUDED.average_cost;
END $$;
