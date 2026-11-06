-- ==============================================================================
-- FLOWER2U (F2U) - Table: material_rates & quotations
-- ตามพิมพ์เขียว: d:\WebappDreame\Flower2U\หน้าเสนอราคา.md
-- Run this script in Supabase SQL Editor
-- ==============================================================================

-- 1. ตาราง material_rates (เก็บราคากลางวัสดุ ตร.ม.)
CREATE TABLE IF NOT EXISTS public.material_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    default_price_sqm NUMERIC(10, 2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Seed initial material rates
INSERT INTO public.material_rates (name, default_price_sqm, is_active)
VALUES
    ('ฟิวเจอร์บอร์ด 3 มม. พิมพ์สติ๊กเกอร์', 350.00, true),
    ('ฟิวเจอร์บอร์ด 5 มม. พร้อมไดคัท', 450.00, true),
    ('ป้ายไวนิลความละเอียดสูง', 180.00, true),
    ('โฟมบอร์ด 5 มม. เคลือบด้าน', 550.00, true),
    ('พลาสวูด 5 มม. แข็งพิเศษ + ไดคัท', 750.00, true)
ON CONFLICT DO NOTHING;

-- 2. ตาราง quotations (เก็บใบเสนอราคาและรายละเอียดการคำนวณ)
CREATE TABLE IF NOT EXISTS public.quotations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quote_no TEXT NOT NULL UNIQUE,                                -- เช่น 'QT-2026-001'
    title TEXT NOT NULL,                                          -- ชื่องาน / ศิลปิน
    client_name TEXT,                                             -- ชื่อลูกค้า / บ้านเบสแฟนคลับ
    project_code TEXT,                                            -- เก็บรหัสโปรเจกต์ เช่น 'P-0001' (Nullable สำหรับผูกทีหลัง)
    backdrop_items JSONB NOT NULL DEFAULT '[]'::jsonb,            -- รายการคำนวณเป็น ตร.ม.
    floral_items JSONB NOT NULL DEFAULT '[]'::jsonb,              -- รายการดอกไม้ กระดาษ อุปกรณ์
    backdrop_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
    floral_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
    markup_percent NUMERIC(5, 2) NOT NULL DEFAULT 30,
    final_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_quotations_quote_no ON public.quotations(quote_no);
CREATE INDEX IF NOT EXISTS idx_quotations_project_code ON public.quotations(project_code);

-- 3. อัปเกรดตาราง artists ให้รองรับ ประวัติ, สีแฟนด้อม, โซเชียล
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS fandom_color TEXT DEFAULT '';
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS favorite_flowers TEXT DEFAULT '';
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';

-- 4. Enable RLS and Realtime
ALTER TABLE public.material_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow app full access to material_rates" ON public.material_rates;
CREATE POLICY "Allow app full access to material_rates" ON public.material_rates FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow app full access to quotations" ON public.quotations;
CREATE POLICY "Allow app full access to quotations" ON public.quotations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow app full access to artists" ON public.artists;
CREATE POLICY "Allow app full access to artists" ON public.artists FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
