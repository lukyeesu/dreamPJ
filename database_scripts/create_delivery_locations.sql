-- ==============================================================================
-- FLOWER2U (F2U) - Table: delivery_locations (สถานที่จัดส่ง / Event Venues)
-- Run this in Supabase SQL Editor
-- ==============================================================================

-- 1. สร้างตาราง delivery_locations (Venue Intelligence & Logistics Dossier)
CREATE TABLE IF NOT EXISTS public.delivery_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,                       -- ชื่อสถานที่ทางการ เช่น 'อิมแพ็ค เมืองทองธานี (Impact Arena)'
    aliases TEXT[] DEFAULT '{}',                     -- คำช่วยค้นหา เช่น ['อิมแพค', 'impact', 'ชาเลนเจอร์', 'เมืองทอง']
    default_map_link TEXT DEFAULT '',                -- พิกัดหน้าห้าง / นัดลูกค้า (Google Maps)
    loading_dock_map_link TEXT DEFAULT '',           -- พิกัดจุดโหลดของจริง (Loading Dock Pin)
    gate_info TEXT DEFAULT '',                       -- ประตู / ทางเข้าเทียบรถ / ลิฟต์ขนของ
    parking_height_limit TEXT DEFAULT '',            -- ความสูงรถ เช่น 'ไม่เกิน 2.10 เมตร'
    dock_contact_phone TEXT DEFAULT '',              -- เบอร์โทรด่วนจุดโหลดของ / รปภ.
    zone TEXT DEFAULT 'ทั่วไป',                      -- โซนพื้นที่ เช่น 'นนทบุรี-เมืองทอง', 'สยาม-ปทุมวัน', 'บางนา'
    delivery_tips TEXT DEFAULT '',                   -- กฎแลกบัตร / ข้อควรระวังหน้างาน
    image_url TEXT DEFAULT '',                       -- ภาพถ่ายจุดเทียบรถ / ประตูขนของ
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- เพิ่มคอลัมน์ใหม่หากตารางถูกสร้างไปก่อนหน้าแล้ว (Idempotent schema updates)
ALTER TABLE public.delivery_locations ADD COLUMN IF NOT EXISTS loading_dock_map_link TEXT DEFAULT '';
ALTER TABLE public.delivery_locations ADD COLUMN IF NOT EXISTS gate_info TEXT DEFAULT '';
ALTER TABLE public.delivery_locations ADD COLUMN IF NOT EXISTS parking_height_limit TEXT DEFAULT '';
ALTER TABLE public.delivery_locations ADD COLUMN IF NOT EXISTS dock_contact_phone TEXT DEFAULT '';
ALTER TABLE public.delivery_locations ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_delivery_locations_name ON public.delivery_locations(name);

-- 2. เพิ่มคอลัมน์ location_id ในตาราง projects และผูกความสัมพันธ์
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.delivery_locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_location_id ON public.projects(location_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_name ON public.customers(name);

-- 3. เปิดใช้ RLS และสิทธิ์การเข้าถึงสำหรับหน้าบ้าน
ALTER TABLE public.delivery_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow app full access" ON public.delivery_locations;
CREATE POLICY "Allow app full access" ON public.delivery_locations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 4. เปิด Realtime สำหรับตาราง delivery_locations
ALTER TABLE public.delivery_locations REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'delivery_locations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_locations;
    END IF;
END $$;
