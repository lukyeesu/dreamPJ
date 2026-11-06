-- ==============================================================================
-- FLOWER2U (F2U) - เปิดสิทธิ์การเข้าถึงข้อมูลสำหรับแอปพลิเคชัน (RLS Policies)
-- ช่วยให้หน้าบ้าน (Frontend) สามารถอ่านและอัปเดตข้อมูลแบบ Realtime ผ่าน anon key ได้
-- ==============================================================================

-- 1. ฟังก์ชันคำนวณปรับให้เป็น SECURITY DEFINER เพื่อให้หน้าบ้านดึงตัวเลขสรุปได้รวดเร็ว
ALTER FUNCTION public.get_financial_analytics(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) SECURITY DEFINER;
ALTER FUNCTION public.get_project_deltas(TIMESTAMPTZ, INT) SECURITY DEFINER;
ALTER FUNCTION public.get_inventory_analytics() SECURITY DEFINER;

-- 2. เปิดใช้งาน Row Level Security (RLS) และเพิ่ม Policy ให้อ่าน-เขียนได้ครบทุกตาราง
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
        -- เปิด RLS
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
        
        -- ลบ Policy เดิมถ้ามี
        EXECUTE format('DROP POLICY IF EXISTS "Allow app full access" ON public.%I;', t);
        
        -- สร้าง Policy ใหม่อนุญาตให้ anon และ authenticated อ่าน-เขียนได้
        EXECUTE format('CREATE POLICY "Allow app full access" ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);', t);
    END LOOP;
END $$;
