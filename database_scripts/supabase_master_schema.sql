-- ==============================================================================
-- FLOWER2U (F2U) 100% NORMALIZED PURE-RELATIONAL MASTER PRODUCTION DDL
-- Version: 3.1 Enterprise (Zero-JSON, Auto Item Code, Disposals, RBAC, Finance, RPC)
-- ==============================================================================

-- 1. เปิดใช้ Extension สำหรับสร้าง UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- โดเมนที่ 1: ระบบจัดการบทบาทและสิทธิ์พนักงาน (RBAC & Staff Users)
-- ==============================================================================

-- 1.1 ตารางบทบาทและสิทธิ์การเข้าถึงเมนู
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,                 -- 'admin', 'technician', 'driver', 'accountant'
    label TEXT NOT NULL,                       -- 'ผู้ดูแลระบบ', 'ช่างหน้างาน', 'พนักงานส่งของ', 'ฝ่ายบัญชี'
    description TEXT,
    allowed_pages TEXT[] NOT NULL DEFAULT '{"Calendar", "Plans"}', -- แท็บที่เข้าถึงได้
    can_edit_pricing BOOLEAN DEFAULT false,    -- สิทธิ์แก้ไขราคา/ใบเสนอราคา
    can_delete_project BOOLEAN DEFAULT false,  -- สิทธิ์ลบงาน
    can_borrow_tools BOOLEAN DEFAULT true,     -- สิทธิ์เบิกยืมเครื่องมือในคลัง
    can_manage_users BOOLEAN DEFAULT false,    -- สิทธิ์จัดการพนักงาน
    is_system_role BOOLEAN DEFAULT false,      -- ป้องกันลบ role หลัก (admin)
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- ใส่ Role พื้นฐานเริ่มต้นทันที
INSERT INTO public.roles (name, label, description, allowed_pages, can_edit_pricing, can_delete_project, can_borrow_tools, can_manage_users, is_system_role)
VALUES 
    ('admin', 'ผู้ดูแลระบบ (Admin)', 'เข้าถึงได้ทุกหน้าและจัดการสิทธิ์ระบบ', '{"Calendar", "Plans", "Finance", "Analytics", "Inventory", "Staff", "Settings"}', true, true, true, true, true),
    ('technician', 'ช่างจัดดอกไม้/หน้างาน (Technician)', 'ดูแผนงานและเบิก-คืนอุปกรณ์คลังพัสดุ', '{"Calendar", "Plans", "Inventory"}', false, false, true, false, false),
    ('driver', 'พนักงานจัดส่ง (Driver/Logistics)', 'ดูพิกัดส่งของและอัปเดตสถานะขนส่ง', '{"Calendar", "Plans"}', false, false, false, false, false),
    ('accountant', 'ฝ่ายการเงิน/บัญชี (Accountant)', 'บันทึกรายรับ-รายจ่าย ใบเสนอราคา และวิเคราะห์กำไร', '{"Calendar", "Plans", "Finance", "Analytics"}', true, false, false, false, false)
ON CONFLICT (name) DO NOTHING;

-- 1.2 ตารางข้อมูลพนักงาน/ผู้ใช้งานระบบ
CREATE TABLE IF NOT EXISTS public.staff_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID UNIQUE,                  -- เชื่อมกับ auth.users ของ Supabase (เมื่อมีการใช้ Auth)
    username TEXT NOT NULL UNIQUE,             -- Username สำหรับล็อกอิน
    full_name TEXT NOT NULL,                   -- ชื่อ-นามสกุลพนักงาน
    nickname TEXT,                             -- ชื่อเล่น (เช่น ช่างบอล, พี่ก้อย)
    phone TEXT,                                -- เบอร์โทร
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
    is_active BOOLEAN DEFAULT true,            -- สถานะการทำงาน (ลาออก/พักงาน ให้ปิดใช้งาน)
    profile_image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_staff_users_role_id ON public.staff_users(role_id);
CREATE INDEX IF NOT EXISTS idx_staff_users_username ON public.staff_users(username);

-- ==============================================================================
-- โดเมนที่ 2: ไดเรกทอรีศิลปินและลูกค้าสัมพันธ์ (Artists & Customers CRM)
-- ==============================================================================

-- 2.1 ตารางศิลปิน
CREATE TABLE IF NOT EXISTS public.artists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,                 -- ชื่อศิลปิน
    agency TEXT,                               -- ค่ายต้นสังกัด
    fandom_name TEXT,                          -- ชื่อแฟนด้อม
    birth_date DATE,                           -- วันเกิด (สำหรับระบบ Birthday Radar เตือนล่วงหน้า 30 วัน)
    debut_date DATE,                           -- วันเดบิวต์/ครบรอบ
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_artists_name ON public.artists(name);
CREATE INDEX IF NOT EXISTS idx_artists_birth_date ON public.artists(birth_date);

-- 2.2 ตารางลูกค้า
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,                        -- ชื่อลูกค้า หรือชื่อบ้านเบส (เช่น BabyBright_FC)
    phone TEXT,                                -- เบอร์โทร
    line_id TEXT,                              -- Line ID
    social_account TEXT,                       -- บัญชี X / IG / Facebook
    email TEXT,
    tax_id TEXT,                               -- เลขผู้เสียภาษี
    billing_address TEXT,                      -- ที่อยู่ออกใบกำกับภาษี
    vip_tier TEXT DEFAULT 'general',           -- ระดับ VIP เช่น 'general', 'silver', 'gold', 'vip_fandom'
    primary_artist_id UUID REFERENCES public.artists(id) ON DELETE SET NULL, -- ศิลปินที่ซัพพอร์ตเป็นหลัก
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_primary_artist ON public.customers(primary_artist_id);

-- ==============================================================================
-- โดเมนที่ 3: โครงสร้างโปรเจกต์งานและ Tombstone (Projects Master & Deletions)
-- ==============================================================================

-- 3.1 ตารางหลักสำหรับเก็บข้อมูลงาน
CREATE TABLE IF NOT EXISTS public.projects (
    id TEXT PRIMARY KEY,                       -- รหัสงาน เช่น 'P-0309'
    name TEXT NOT NULL,                        -- ชื่องาน
    category TEXT DEFAULT 'งานจัดดอกไม้',     -- หมวดหมู่งาน
    project_datetime TIMESTAMPTZ,              -- วันเวลางาน
    payment_date DATE,                         -- วันที่ชำระเงิน
    
    -- ข้อมูลศิลปิน
    artist_name TEXT,                          -- ชื่อศิลปิน (String สำหรับ Backward Compatibility)
    artist_id UUID REFERENCES public.artists(id) ON DELETE SET NULL,
    
    -- ข้อมูลลูกค้า (แยกคอลัมน์อิสระ 100% ไม่เก็บเป็น JSON)
    customer_name TEXT,                        -- ชื่อลูกค้า
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_phone TEXT,                       -- เบอร์โทรลูกค้า
    customer_line TEXT,                        -- LINE ID ลูกค้า
    customer_social TEXT,                      -- IG / X / FB ลูกค้า
    customer_email TEXT,                       -- อีเมลลูกค้า
    customer_tax_id TEXT,                      -- เลขประจำตัวผู้เสียภาษี
    customer_address TEXT,                     -- ที่อยู่ลูกค้าสำหรับออกใบเสร็จ
    
    -- ข้อมูลการจัดส่งและสถานที่
    recipient_name TEXT,                       -- ชื่อผู้รับมอบงาน
    recipient_phone TEXT,                      -- เบอร์โทรผู้รับ
    location_name TEXT,                        -- สถานที่จัดส่ง (เช่น Impact Arena)
    map_link TEXT,                             -- ลิงก์แผนที่ Google Maps
    raw_delivery_start TEXT,                   -- วันเวลาเริ่มส่ง
    raw_delivery_end TEXT,                     -- วันเวลาสิ้นสุดส่ง
    delivery_date_display TEXT,                -- ข้อความแสดงช่วงเวลาจัดส่ง
    
    -- สถานะงาน
    deal_status TEXT NOT NULL DEFAULT 'operating',      -- สถานะการปิดดีล
    transport_status TEXT NOT NULL DEFAULT 'preparing', -- สถานะการขนส่ง
    payment_status TEXT NOT NULL DEFAULT 'unpaid',      -- สถานะการชำระเงิน (unpaid / paid / deposit)
    
    -- ข้อมูลสรุปตัวเลขการเงิน (Computed / Flat Columns)
    wage NUMERIC(12,2) DEFAULT 0,              -- ยอดเสนอราคา/ค่าจ้าง
    delivery_fee NUMERIC(12,2) DEFAULT 0,      -- ค่าจัดส่ง
    deposit_amount NUMERIC(12,2) DEFAULT 0,    -- ยอดมัดจำ
    total_revenue NUMERIC(12,2) DEFAULT 0,     -- ยอดรวมรายรับ (wage + delivery_fee)
    total_expenses NUMERIC(12,2) DEFAULT 0,    -- ยอดรวมค่าใช้จ่ายจริง
    net_profit NUMERIC(12,2) DEFAULT 0,        -- กำไรสุทธิ
    customer_support_total NUMERIC(12,2) DEFAULT 0, -- ยอดรวมเงินสนับสนุนศิลปิน
    
    -- ข้อความหมายเหตุและรูปภาพ
    note TEXT,                                 -- หมายเหตุ/คำสั่งพิเศษ
    primary_image_url TEXT,                    -- รูปหน้าปกงาน
    images TEXT[] DEFAULT '{}',                -- รายการลิงก์รูปภาพอ้างอิงบน Google Drive
    slips TEXT[] DEFAULT '{}',                 -- รายการลิงก์สลิปโอนเงินบน Google Drive
    
    -- การควบคุม Concurrency และการซิงก์
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON public.projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_deal_status ON public.projects(deal_status);
CREATE INDEX IF NOT EXISTS idx_projects_payment_status ON public.projects(payment_status);
CREATE INDEX IF NOT EXISTS idx_projects_project_datetime ON public.projects(project_datetime DESC);
CREATE INDEX IF NOT EXISTS idx_projects_artist_id ON public.projects(artist_id);
CREATE INDEX IF NOT EXISTS idx_projects_customer_id ON public.projects(customer_id);

-- Trigger อัปเดต updated_at และเพิ่ม version อัตโนมัติ
CREATE OR REPLACE FUNCTION update_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_projects_updated_at ON public.projects;
CREATE TRIGGER trigger_update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION update_projects_updated_at();

-- 3.2 ตาราง Tombstone บันทึกประวัติแถวที่ถูกลบ
CREATE TABLE IF NOT EXISTS public.deleted_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    record_id TEXT NOT NULL,
    table_name TEXT NOT NULL DEFAULT 'projects',
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_deleted_records_deleted_at ON public.deleted_records(deleted_at DESC);

-- Trigger บันทึกลง deleted_records เมื่อมีการลบข้อมูล
CREATE OR REPLACE FUNCTION record_project_deletion()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.deleted_records (record_id, table_name, deleted_at)
    VALUES (OLD.id, 'projects', timezone('utc'::text, now()));
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_record_project_deletion ON public.projects;
CREATE TRIGGER trigger_record_project_deletion
AFTER DELETE ON public.projects
FOR EACH ROW EXECUTE FUNCTION record_project_deletion();

-- ==============================================================================
-- โดเมนที่ 4: ตารางลูกสำหรับรายการปลีกย่อย (Normalized Child Tables - Zero JSON)
-- ==============================================================================

-- 4.1 รายการใบเสนอราคา (Quotation Items)
CREATE TABLE IF NOT EXISTS public.project_quotation_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    category TEXT NOT NULL,                    -- เช่น 'แบคดรอปขนาด 200x200 cm', 'ค่าบริการ/อุปกรณ์'
    detail TEXT DEFAULT '',                    -- รายละเอียดเพิ่มเติม
    quantity NUMERIC(10,2) NOT NULL DEFAULT 1, -- จำนวน
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0, -- ราคาต่อหน่วย
    price NUMERIC(12,2) NOT NULL DEFAULT 0,    -- ราคารวม (quantity * unit_price)
    item_date DATE,                            -- วันที่ของรายการ
    sort_order INT DEFAULT 0,                  -- ลำดับการแสดงผล
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_quotation_items_project ON public.project_quotation_items(project_id);

-- 4.2 รายการเงินสนับสนุนศิลปิน / Money Order (แยกแถวตามชนิดธนบัตร)
CREATE TABLE IF NOT EXISTS public.project_customer_support (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    denomination INT NOT NULL,                 -- ชนิดธนบัตร (20, 50, 100, 500, 1000)
    quantity INT NOT NULL DEFAULT 0,           -- จำนวนใบ
    price NUMERIC(14,2) NOT NULL DEFAULT 0,    -- มูลค่ารวม (denomination * quantity)
    item_date DATE,                            -- วันที่รับเงิน
    sort_order INT DEFAULT 0,                  -- ลำดับการแสดงผล
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_customer_support_project ON public.project_customer_support(project_id);

-- 4.3 รายการค่าใช้จ่ายจริงเฉพาะงาน (Project Expenses)
CREATE TABLE IF NOT EXISTS public.project_expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    category TEXT NOT NULL,                    -- หมวดหมู่ เช่น 'ค่าจ้าง', 'ค่าอุปกรณ์', 'ค่าเดินทาง', 'ค่าปริ้น'
    detail TEXT DEFAULT '',                    -- รายละเอียดของที่ซื้อ
    quantity NUMERIC(10,2) NOT NULL DEFAULT 1, -- จำนวน
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0, -- ราคาต่อหน่วย
    price NUMERIC(12,2) NOT NULL DEFAULT 0,    -- ราคารวม (quantity * unit_price)
    item_date DATE,                            -- วันที่จ่ายเงิน
    sort_order INT DEFAULT 0,                  -- ลำดับการแสดงผล
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_project_expenses_project ON public.project_expenses(project_id);

-- ==============================================================================
-- โดเมนที่ 5: ทะเบียนคู่ค้าจัดซื้อ (Vendors & Suppliers)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,                 -- ชื่อร้านค้า
    contact_person TEXT,                       -- ผู้ติดต่อ
    phone TEXT,                                -- เบอร์โทร
    line_id TEXT,                              -- Line ID
    address TEXT,                              -- ที่อยู่ร้าน
    shop_link TEXT,                            -- ลิงก์ร้านค้า
    categories_supplied TEXT[] DEFAULT '{}',   -- หมวดสินค้าที่ขาย (ดอกไม้, โฟม, ริบบิ้น)
    quality_rating INT DEFAULT 5 CHECK (quality_rating BETWEEN 1 AND 5),
    defect_warning_notes TEXT,                 -- หมายเหตุเตือนสินค้ามีตำหนิ
    is_blacklisted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_vendors_name ON public.vendors(name);

-- ==============================================================================
-- โดเมนที่ 6: คลังพัสดุ สต็อก อุปกรณ์ยืม-คืน และตัดจำหน่าย (Inventory Management)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,                 -- 'เครื่องมือ/อุปกรณ์', 'กระดาษห่อ', 'ดอกไม้ประดิษฐ์'
    type TEXT NOT NULL CHECK (type IN ('asset', 'consumable', 'reusable_material')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE,                          -- รหัสสินค้าอัตโนมัติ เช่น 'item0001', 'item0002'
    name TEXT NOT NULL,                        -- ชื่อพัสดุ
    category_id UUID REFERENCES public.inventory_categories(id) ON DELETE SET NULL,
    item_type TEXT NOT NULL CHECK (item_type IN ('asset', 'consumable', 'reusable_material')),
    unit TEXT NOT NULL DEFAULT 'ชิ้น',         -- หน่วยนับ เช่น 'ชิ้น', 'ม้วน', 'แผ่น', 'ดอก'
    current_stock NUMERIC(10,2) NOT NULL DEFAULT 0,
    min_alert_threshold NUMERIC(10,2) DEFAULT 5, -- เกณฑ์เตือนใกล้หมด
    average_cost NUMERIC(10,2) DEFAULT 0,      -- ราคาต้นทุนเฉลี่ย
    storage_location TEXT,                     -- ตำแหน่งจัดเก็บ เช่น 'ชั้นวาง A2', 'กล่องเครื่องมือช่าง'
    
    -- สเปกสินค้าแบบแยกคอลัมน์ชัดเจน
    color TEXT,                                -- สี (เช่น 'ส้ม (Orange)', 'ชมพูพาสเทล', 'ขาว')
    size TEXT,                                 -- ขนาด (เช่น '50x70 cm', '200x200 cm', 'L', 'M')
    texture_type TEXT,                         -- พื้นผิว (เช่น 'ด้าน (Matte)', 'ฟิล์มใส', 'ผ้าไหมพลาสติก')
    material_grade TEXT,                       -- เกรดวัสดุ (เช่น 'เกรดนำเข้า', 'พรีเมียม')
    barcode_or_sku TEXT,                       -- บาร์โค้ด
    
    -- สถานะพัสดุและการตัดจำหน่าย/หมดสภาพ (Asset Status & Decommissioning)
    -- 'in_service' = พร้อมใช้งาน, 'low_stock' = ใกล้หมด, 'out_of_stock' = หมดชั่วคราว,
    -- 'maintenance' = ส่งซ่อม/ลับคม, 'written_off' = ตัดจ่าย/ปลดระวางถาวร, 'lost' = สูญหาย
    status TEXT NOT NULL DEFAULT 'in_service' CHECK (status IN ('in_service', 'low_stock', 'out_of_stock', 'maintenance', 'written_off', 'lost')),
    decommission_reason TEXT,                  -- สาเหตุตัดจำหน่าย เช่น 'พังแตกหัก', 'หมดคม ลับไม่ได้แล้ว'
    decommissioned_at TIMESTAMPTZ,             -- วันเวลาที่ตัดจำหน่าย
    decommissioned_by_user_id UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
    total_disposed_qty NUMERIC(10,2) DEFAULT 0,-- ยอดสะสมที่ตัดทิ้งไปแล้วทั้งหมด
    is_active BOOLEAN DEFAULT true,            -- ถ้าปลดระวางถาวรจะตั้งเป็น false เพื่อซ่อนจาก Dropdown
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_type ON public.inventory_items(item_type);
CREATE INDEX IF NOT EXISTS idx_inventory_items_code ON public.inventory_items(code);
CREATE INDEX IF NOT EXISTS idx_inventory_items_status ON public.inventory_items(status);
CREATE INDEX IF NOT EXISTS idx_inventory_items_is_active ON public.inventory_items(is_active);

-- Sequence และ Trigger สร้างรหัสอัตโนมัติ item0001, item0002... โดยไม่ต้องกรอกเอง
CREATE SEQUENCE IF NOT EXISTS public.inventory_item_code_seq START 1;

CREATE OR REPLACE FUNCTION set_inventory_item_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.code IS NULL OR TRIM(NEW.code) = '' THEN
        NEW.code := 'item' || LPAD(nextval('public.inventory_item_code_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_inventory_item_code ON public.inventory_items;
CREATE TRIGGER trigger_set_inventory_item_code
BEFORE INSERT ON public.inventory_items
FOR EACH ROW EXECUTE FUNCTION set_inventory_item_code();

-- 6.2 ประวัติการจัดซื้อและราคา (Price Radar)
CREATE TABLE IF NOT EXISTS public.inventory_procurements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    quantity NUMERIC(10,2) NOT NULL,
    unit_price NUMERIC(10,2) NOT NULL,
    total_cost NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    receipt_url TEXT,
    quality_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_procurements_item ON public.inventory_procurements(item_id);
CREATE INDEX IF NOT EXISTS idx_procurements_vendor ON public.inventory_procurements(vendor_id);
CREATE INDEX IF NOT EXISTS idx_procurements_date ON public.inventory_procurements(purchase_date DESC);

-- 6.3 ทะเบียนยืม-คืนเครื่องมือและอุปกรณ์ออกนอกสถานที่ (Asset Loans)
CREATE TABLE IF NOT EXISTS public.asset_loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    project_id TEXT REFERENCES public.projects(id) ON DELETE SET NULL,
    borrower_name TEXT NOT NULL,               -- ชื่อช่างที่ยืม
    borrower_user_id UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
    borrowed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expected_return_at TIMESTAMPTZ,
    actual_returned_at TIMESTAMPTZ,
    condition_out TEXT DEFAULT 'good',
    condition_in TEXT,
    status TEXT NOT NULL DEFAULT 'borrowed' CHECK (status IN ('borrowed', 'returned', 'overdue', 'damaged', 'lost')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_asset_loans_status ON public.asset_loans(status);
CREATE INDEX IF NOT EXISTS idx_asset_loans_item ON public.asset_loans(item_id);

-- 6.4 ทะเบียนตัดจำหน่ายพัสดุชำรุด-สูญหาย-หมดคม (Inventory Disposals / Asset Write-Offs)
CREATE TABLE IF NOT EXISTS public.inventory_disposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    disposal_code TEXT NOT NULL UNIQUE,        -- รหัสใบตัดจำหน่าย เช่น 'DSP-261104-0001'
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    quantity NUMERIC(10,2) NOT NULL DEFAULT 1, -- จำนวนที่ตัดจ่าย
    reason_type TEXT NOT NULL CHECK (reason_type IN ('damaged', 'worn_out_dull', 'lost', 'broken_on_site', 'expired', 'obsolete')),
    reason_notes TEXT,                         -- รายละเอียด เช่น 'ใบมีดหมดคม ลับไม่ได้แล้ว'
    proof_image_url TEXT,                      -- รูปถ่ายหลักฐานของพังเก็บบน Google Drive
    project_id TEXT REFERENCES public.projects(id) ON DELETE SET NULL, -- ผูกกับงานอีเวนต์ที่เกิดเหตุ
    disposed_by_user_id UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
    approved_by_user_id UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
    salvage_value NUMERIC(10,2) DEFAULT 0,     -- มูลค่าขายซากที่ได้คืนมา
    financial_loss NUMERIC(12,2) DEFAULT 0,    -- มูลค่าความเสียหายทางบัญชี (quantity * average_cost)
    disposal_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_inventory_disposals_item ON public.inventory_disposals(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_disposals_reason ON public.inventory_disposals(reason_type);
CREATE INDEX IF NOT EXISTS idx_inventory_disposals_date ON public.inventory_disposals(disposal_date DESC);

-- Sequence และ Trigger สร้างรหัสใบตัดจำหน่าย DSP-YYMMDD-0001 อัตโนมัติ
CREATE SEQUENCE IF NOT EXISTS public.inventory_disposal_code_seq START 1;

CREATE OR REPLACE FUNCTION set_inventory_disposal_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.disposal_code IS NULL OR TRIM(NEW.disposal_code) = '' THEN
        NEW.disposal_code := 'DSP-' || to_char(CURRENT_DATE, 'YYMMDD') || '-' || LPAD(nextval('public.inventory_disposal_code_seq')::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_inventory_disposal_code ON public.inventory_disposals;
CREATE TRIGGER trigger_set_inventory_disposal_code
BEFORE INSERT ON public.inventory_disposals
FOR EACH ROW EXECUTE FUNCTION set_inventory_disposal_code();

-- Trigger ตัดสต็อกอัตโนมัติเมื่อมีการบันทึกตัดจำหน่าย
CREATE OR REPLACE FUNCTION process_inventory_disposal()
RETURNS TRIGGER AS $$
DECLARE
    v_item_cost NUMERIC(10,2);
    v_item_type TEXT;
BEGIN
    -- ดึงข้อมูลต้นทุนและชนิดพัสดุ
    SELECT average_cost, item_type
    INTO v_item_cost, v_item_type
    FROM public.inventory_items
    WHERE id = NEW.item_id;

    -- คำนวณความเสียหายทางบัญชี
    NEW.financial_loss := (NEW.quantity * COALESCE(v_item_cost, 0)) - COALESCE(NEW.salvage_value, 0);

    -- ลดจำนวนสต็อกคงเหลือ และเพิ่มยอดตัดจ่ายสะสม
    UPDATE public.inventory_items
    SET current_stock = GREATEST(0, current_stock - NEW.quantity),
        total_disposed_qty = COALESCE(total_disposed_qty, 0) + NEW.quantity,
        status = CASE 
            WHEN (current_stock - NEW.quantity) <= 0 AND v_item_type = 'asset' THEN 'written_off'
            WHEN (current_stock - NEW.quantity) <= 0 THEN 'out_of_stock'
            ELSE status 
        END,
        decommission_reason = NEW.reason_notes,
        decommissioned_at = timezone('utc'::text, now()),
        decommissioned_by_user_id = NEW.disposed_by_user_id,
        is_active = CASE 
            WHEN (current_stock - NEW.quantity) <= 0 AND v_item_type = 'asset' THEN false 
            ELSE is_active 
        END,
        updated_at = timezone('utc'::text, now())
    WHERE id = NEW.item_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_process_inventory_disposal ON public.inventory_disposals;
CREATE TRIGGER trigger_process_inventory_disposal
BEFORE INSERT ON public.inventory_disposals
FOR EACH ROW EXECUTE FUNCTION process_inventory_disposal();

-- ==============================================================================
-- โดเมนที่ 7: การเงินและรายรับ-รายจ่ายอิสระ (Financial Transactions)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.financial_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_code TEXT NOT NULL UNIQUE,     -- รหัสบิลรูปแบบ YYMMDD + 4 หลัก เช่น '2611040001'
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    category TEXT NOT NULL,                    -- 'ซื้ออุปกรณ์', 'ค่าเช่าร้าน', 'ค่าน้ำไฟ', 'รายรับเสริม'
    amount NUMERIC(12,2) NOT NULL,             -- ยอดเงิน
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT DEFAULT 'transfer',    -- 'cash', 'transfer', 'credit_card'
    project_id TEXT REFERENCES public.projects(id) ON DELETE SET NULL, -- ผูกกับงาน
    vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,   -- ผูกกับร้านค้า
    is_inventory_purchase BOOLEAN DEFAULT false, -- ถ้าเป็นจริง จะบวกสต็อกเข้าคลังสินค้าอัตโนมัติ
    slip_url TEXT,                             -- รูปภาพหลักฐานการจ่ายเงินบน Google Drive
    notes TEXT,                                -- หมายเหตุ
    created_by_user_id UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
    
    -- กฎเหล็กทางบัญชีสากล: ห้าม Hard Delete เอกสารเด็ดขาด แต่ใช้สถานะ VOID เพื่อตรวจสอบภาษีได้ 100%
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'void')),
    void_reason TEXT,                          -- สาเหตุที่ยกเลิกบิล เช่น 'พิมพ์ยอดผิด', 'ลูกค้ายกเลิก'
    voided_at TIMESTAMPTZ,                     -- วันเวลาที่กดยกเลิก
    voided_by_user_id UUID REFERENCES public.staff_users(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- ฟังก์ชันสร้าง Running Number อัตโนมัติ (เช่น 2611040001, 2611040002) ตามวันแบบอัตโนมัติ
CREATE OR REPLACE FUNCTION generate_transaction_code()
RETURNS TRIGGER AS $$
DECLARE
    date_prefix TEXT;
    next_seq INT;
BEGIN
    date_prefix := to_char(COALESCE(NEW.transaction_date, CURRENT_DATE), 'YYMMDD');
    
    SELECT COALESCE(MAX(SUBSTRING(transaction_code FROM 7)::INT), 0) + 1
    INTO next_seq
    FROM public.financial_transactions
    WHERE transaction_code LIKE date_prefix || '%';
    
    NEW.transaction_code := date_prefix || LPAD(next_seq::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_transaction_code ON public.financial_transactions;
CREATE TRIGGER trigger_set_transaction_code
BEFORE INSERT ON public.financial_transactions
FOR EACH ROW
WHEN (NEW.transaction_code IS NULL OR NEW.transaction_code = '')
EXECUTE FUNCTION generate_transaction_code();

CREATE INDEX IF NOT EXISTS idx_transactions_code ON public.financial_transactions(transaction_code);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.financial_transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_project ON public.financial_transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.financial_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.financial_transactions(type);

-- Trigger ซื้อของเข้าคลังแล้วบวกสต็อกอัตโนมัติ
CREATE OR REPLACE FUNCTION auto_update_stock_on_procurement()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.inventory_items
    SET current_stock = current_stock + NEW.quantity,
        average_cost = ((average_cost * current_stock) + (NEW.unit_price * NEW.quantity)) / NULLIF(current_stock + NEW.quantity, 0),
        updated_at = timezone('utc'::text, now())
    WHERE id = NEW.item_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_procurement_stock_add ON public.inventory_procurements;
CREATE TRIGGER trigger_procurement_stock_add
AFTER INSERT ON public.inventory_procurements
FOR EACH ROW EXECUTE FUNCTION auto_update_stock_on_procurement();

-- ==============================================================================
-- โดเมนที่ 8: ตั้งค่าร้านค้าและระบบ (Shop Settings)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.shop_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    
    -- Google Drive Folders
    reference_folder_id TEXT DEFAULT '',
    slips_folder_id TEXT DEFAULT '',
    assets_folder_id TEXT DEFAULT '',
    
    -- Chatbot Tokens
    line_bot_token TEXT DEFAULT '',
    telegram_bot_token TEXT DEFAULT '',
    telegram_chat_id TEXT DEFAULT '',
    
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- โดเมนที่ 9: ฟังก์ชันเซิร์ฟเวอร์ความเร็วสูง (RPC Functions - Zero-Egress Engine)
-- ==============================================================================

-- 9.1 ฟังก์ชันคำนวณผลสรุปการเงินบนเซิร์ฟเวอร์ (Push-Down Aggregations)
CREATE OR REPLACE FUNCTION get_financial_analytics(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_deal_status TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_orders', COUNT(*),
        'total_customer_support', COALESCE(SUM(customer_support_total), 0),
        'total_revenue', COALESCE(SUM(wage + delivery_fee), 0),
        'total_expenses', COALESCE(SUM(total_expenses), 0),
        'total_net_profit', COALESCE(SUM(net_profit), 0),
        'paid_orders_count', COUNT(*) FILTER (WHERE payment_status = 'paid'),
        'unpaid_orders_count', COUNT(*) FILTER (WHERE payment_status = 'unpaid'),
        'total_unpaid_amount', COALESCE(SUM(wage + delivery_fee - deposit_amount) FILTER (WHERE payment_status = 'unpaid'), 0)
    ) INTO result
    FROM public.projects
    WHERE (p_start_date IS NULL OR project_datetime >= p_start_date)
      AND (p_end_date IS NULL OR project_datetime <= p_end_date)
      AND (p_category IS NULL OR category = p_category)
      AND (p_deal_status IS NULL OR deal_status = p_deal_status);

    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- 9.2 ฟังก์ชันดึงการเปลี่ยนแปลงเฉพาะส่วนต่าง (Incremental Delta Fetch)
CREATE OR REPLACE FUNCTION get_project_deltas(
    p_last_synced_at TIMESTAMPTZ,
    p_limit INT DEFAULT 200
)
RETURNS JSON AS $$
DECLARE
    updated_rows JSON;
    deleted_ids JSON;
    new_watermark TIMESTAMPTZ;
    rows_count INT := 0;
    has_more BOOLEAN := false;
    max_updated TIMESTAMPTZ;
    requires_full_resync BOOLEAN := false;
BEGIN
    IF p_last_synced_at < (NOW() - INTERVAL '30 days') THEN
        requires_full_resync := true;
    END IF;

    WITH delta_projects AS (
        SELECT 
            p.id, p.name, p.category, p.project_datetime, p.payment_date,
            p.artist_name, p.artist_id,
            p.customer_name, p.customer_id, p.customer_phone, p.customer_line,
            p.customer_social, p.customer_email, p.customer_tax_id, p.customer_address,
            p.recipient_name, p.recipient_phone, p.location_name, p.map_link,
            p.raw_delivery_start, p.raw_delivery_end, p.delivery_date_display,
            p.deal_status, p.transport_status, p.payment_status,
            p.wage, p.delivery_fee, p.deposit_amount,
            p.total_revenue, p.total_expenses, p.net_profit, p.customer_support_total,
            p.note, p.primary_image_url, p.images, p.slips,
            p.version, p.updated_at
        FROM public.projects p
        WHERE p.updated_at > p_last_synced_at
        ORDER BY p.updated_at ASC
        LIMIT p_limit
    )
    SELECT 
        COALESCE(json_agg(t), '[]'::jsonb),
        COUNT(*),
        MAX(t.updated_at)
    INTO updated_rows, rows_count, max_updated
    FROM delta_projects t;

    SELECT COALESCE(json_agg(record_id), '[]'::jsonb) INTO deleted_ids
    FROM (
        SELECT record_id
        FROM public.deleted_records
        WHERE deleted_at > p_last_synced_at
        ORDER BY deleted_at ASC
        LIMIT p_limit
    ) d;

    IF rows_count = p_limit THEN
        has_more := true;
        new_watermark := max_updated;
    ELSE
        has_more := false;
        new_watermark := timezone('utc'::text, now());
    END IF;

    RETURN json_build_object(
        'requires_full_resync', requires_full_resync,
        'has_more', has_more,
        'new_watermark', new_watermark,
        'records', updated_rows,
        'deleted_ids', deleted_ids
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- 9.3 ฟังก์ชันคำนวณสรุปยอดคลังพัสดุบนเซิร์ฟเวอร์ (Zero-Egress Inventory KPI)
CREATE OR REPLACE FUNCTION get_inventory_analytics()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_items_count', COUNT(*),
        'total_asset_value', COALESCE(SUM(current_stock * average_cost), 0),
        'low_stock_count', COUNT(*) FILTER (WHERE current_stock <= min_alert_threshold AND item_type = 'consumable'),
        'active_loans_count', (SELECT COUNT(*) FROM public.asset_loans WHERE status = 'borrowed'),
        'overdue_loans_count', (SELECT COUNT(*) FROM public.asset_loans WHERE status = 'borrowed' AND expected_return_at < NOW())
    ) INTO result
    FROM public.inventory_items
    WHERE is_active = true;

    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- ==============================================================================
-- โดเมนที่ 10: เปิดใช้งาน Supabase Realtime ครบ 100% ทุกตาราง (17 ตารางในระบบ)
-- เมื่อหน้าจอใดมีการแก้ไขข้อมูล หน้าจออื่นที่เปิดอยู่จะอัปเดตแบบเรียลไทม์ทันทีในเสี้ยววินาที!
-- ==============================================================================

-- 10.1 ตั้งค่า REPLICA IDENTITY FULL ครบทั้ง 17 ตารางในระบบ
ALTER TABLE public.roles REPLICA IDENTITY FULL;
ALTER TABLE public.staff_users REPLICA IDENTITY FULL;
ALTER TABLE public.artists REPLICA IDENTITY FULL;
ALTER TABLE public.customers REPLICA IDENTITY FULL;
ALTER TABLE public.projects REPLICA IDENTITY FULL;
ALTER TABLE public.deleted_records REPLICA IDENTITY FULL;
ALTER TABLE public.project_quotation_items REPLICA IDENTITY FULL;
ALTER TABLE public.project_customer_support REPLICA IDENTITY FULL;
ALTER TABLE public.project_expenses REPLICA IDENTITY FULL;
ALTER TABLE public.vendors REPLICA IDENTITY FULL;
ALTER TABLE public.inventory_categories REPLICA IDENTITY FULL;
ALTER TABLE public.inventory_items REPLICA IDENTITY FULL;
ALTER TABLE public.inventory_procurements REPLICA IDENTITY FULL;
ALTER TABLE public.asset_loans REPLICA IDENTITY FULL;
ALTER TABLE public.inventory_disposals REPLICA IDENTITY FULL;
ALTER TABLE public.financial_transactions REPLICA IDENTITY FULL;
ALTER TABLE public.shop_settings REPLICA IDENTITY FULL;

-- 10.2 ผูกครบทั้ง 17 ตารางเข้ากับ Supabase Realtime Publication อัตโนมัติ
DO $$
DECLARE
    t TEXT;
    all_tables TEXT[] := ARRAY[
        'roles',
        'staff_users',
        'artists',
        'customers',
        'projects',
        'deleted_records',
        'project_quotation_items',
        'project_customer_support',
        'project_expenses',
        'vendors',
        'inventory_categories',
        'inventory_items',
        'inventory_procurements',
        'asset_loans',
        'inventory_disposals',
        'financial_transactions',
        'shop_settings'
    ];
BEGIN
    FOREACH t IN ARRAY all_tables LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND tablename = t
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
        END IF;
    END LOOP;
END $$;

-- ==============================================================================
-- โดเมนที่ 11: นโยบายความปลอดภัยและการเข้าถึงข้อมูล (Row Level Security - RLS Policies)
-- ช่วยให้หน้าบ้าน (Frontend) สามารถอ่านและอัปเดตข้อมูลแบบ Realtime ผ่าน anon key ได้
-- ==============================================================================

-- 11.1 ปรับให้ RPC Functions เป็น SECURITY DEFINER เพื่อให้หน้าบ้านดึงตัวเลขสรุปได้รวดเร็ว
ALTER FUNCTION public.get_financial_analytics(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) SECURITY DEFINER;
ALTER FUNCTION public.get_project_deltas(TIMESTAMPTZ, INT) SECURITY DEFINER;
ALTER FUNCTION public.get_inventory_analytics() SECURITY DEFINER;

-- 11.2 เปิดใช้งาน RLS และเพิ่ม Policy ให้อ่าน-เขียนได้ครบทุกตาราง
DO $$
DECLARE
    t TEXT;
    all_tables TEXT[] := ARRAY[
        'roles',
        'staff_users',
        'artists',
        'customers',
        'projects',
        'deleted_records',
        'project_quotation_items',
        'project_customer_support',
        'project_expenses',
        'vendors',
        'inventory_categories',
        'inventory_items',
        'inventory_procurements',
        'asset_loans',
        'inventory_disposals',
        'financial_transactions',
        'shop_settings'
    ];
BEGIN
    FOREACH t IN ARRAY all_tables LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
        EXECUTE format('DROP POLICY IF EXISTS "Allow app full access" ON public.%I;', t);
        EXECUTE format('CREATE POLICY "Allow app full access" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);', t);
    END LOOP;
END $$;
