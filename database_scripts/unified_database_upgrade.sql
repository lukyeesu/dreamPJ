-- ==============================================================================
-- 🚀 FLOWER2U (F2U) - UNIFIED DATABASE UPGRADE & PERFORMANCE MIGRATION
-- รันสคริปต์นี้ใน Supabase SQL Editor:
-- https://supabase.com/dashboard/project/hvjjgkyitgdldrqnqzpy/sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HIGH-PERFORMANCE DATABASE INDEXES (B-Tree & Composite Indexes)
-- ------------------------------------------------------------------------------

-- Index บน raw_delivery_start สำหรับการสืบค้นรายเดือนที่รวดเร็ว
CREATE INDEX IF NOT EXISTS idx_projects_delivery_start 
ON public.projects (raw_delivery_start DESC);

-- Index บน project_datetime
CREATE INDEX IF NOT EXISTS idx_projects_datetime 
ON public.projects (project_datetime DESC);

-- Indexes บน foreign keys ในตารางลูก สำหรับ Batch Lookups
CREATE INDEX IF NOT EXISTS idx_pqi_project_id 
ON public.project_quotation_items (project_id);

CREATE INDEX IF NOT EXISTS idx_pcs_project_id 
ON public.project_customer_support (project_id);

CREATE INDEX IF NOT EXISTS idx_pe_project_id 
ON public.project_expenses (project_id);

-- Index บน deleted_records สำหรับ Zero-Egress Tombstone Sync
CREATE INDEX IF NOT EXISTS idx_deleted_records_deleted_at 
ON public.deleted_records (deleted_at DESC);

-- Indexes บนชื่อศิลปินและลูกค้า
CREATE INDEX IF NOT EXISTS idx_customers_name 
ON public.customers (name);

CREATE INDEX IF NOT EXISTS idx_artists_name 
ON public.artists (name);

-- ------------------------------------------------------------------------------
-- 2. CREATE INVENTORY & ASSET UNIT TABLES (Fixed Type: item_id UUID)
-- ------------------------------------------------------------------------------

-- ตาราง asset_units: จัดการรหัสพัสดุรายชิ้น (เช่น item0001, item0002)
CREATE TABLE IF NOT EXISTS public.asset_units (
    unit_code TEXT PRIMARY KEY,
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'available',
    borrowed_by TEXT,
    borrowed_at TIMESTAMPTZ,
    project_id TEXT REFERENCES public.projects(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ตาราง project_checklist_items: เช็กลิสต์จัดเตรียมของและเชื่อมคลัง
CREATE TABLE IF NOT EXISTS public.project_checklist_items (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
    category_name TEXT,
    item_name TEXT NOT NULL,
    item_type TEXT NOT NULL DEFAULT 'rental',
    required_qty NUMERIC(10, 2) NOT NULL DEFAULT 1,
    unit TEXT DEFAULT 'ชิ้น',
    picked_qty NUMERIC(10, 2) NOT NULL DEFAULT 0,
    returned_qty NUMERIC(10, 2) NOT NULL DEFAULT 0,
    damaged_qty NUMERIC(10, 2) NOT NULL DEFAULT 0,
    unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
    assigned_codes JSONB DEFAULT '[]'::jsonb,
    is_checked BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- สร้าง Indexes รองรับการเชื่อมโยง
CREATE INDEX IF NOT EXISTS idx_asset_units_item_id ON public.asset_units (item_id);
CREATE INDEX IF NOT EXISTS idx_asset_units_project_id ON public.asset_units (project_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_project_id ON public.project_checklist_items (project_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_item_id ON public.project_checklist_items (item_id);

-- เปิดใช้งาน RLS (Row Level Security)
ALTER TABLE public.asset_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_checklist_items ENABLE ROW LEVEL SECURITY;

-- ลบ Policy เดิมก่อนสร้างใหม่ (Idempotent ปลอดภัย รันซ้ำได้ไม่ error)
DROP POLICY IF EXISTS "Allow authenticated read and write on asset_units" ON public.asset_units;
CREATE POLICY "Allow authenticated read and write on asset_units" 
ON public.asset_units FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated read and write on project_checklist_items" ON public.project_checklist_items;
CREATE POLICY "Allow authenticated read and write on project_checklist_items" 
ON public.project_checklist_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 3. STORED PROCEDURE: get_complete_analytics
-- Zero-Egress Server-Side Financial & Analytics Aggregation
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_complete_analytics(
    p_start_date TEXT DEFAULT NULL,
    p_end_date TEXT DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_deal_status TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    result JSON;
    v_totals JSON;
    v_banknotes JSON;
    v_expenses JSON;
    v_top_artists JSON;
BEGIN
    -- 1. สรุปภาพรวมการเงิน (Totals KPI)
    SELECT json_build_object(
        'project_count', COUNT(*),
        'total_revenue', COALESCE(SUM(total_revenue), 0),
        'total_expenses', COALESCE(SUM(total_expenses), 0),
        'net_profit', COALESCE(SUM(net_profit), 0),
        'total_support', COALESCE(SUM(customer_support_total), 0)
    ) INTO v_totals
    FROM public.projects
    WHERE (p_start_date IS NULL OR raw_delivery_start >= p_start_date)
      AND (p_end_date IS NULL OR raw_delivery_start <= p_end_date)
      AND (p_category IS NULL OR category = p_category)
      AND (p_deal_status IS NULL OR deal_status = p_deal_status);

    -- 2. สรุปสถิติธนบัตร (Banknote Envelopes)
    SELECT COALESCE(json_agg(t), '[]'::json) INTO v_banknotes
    FROM (
        SELECT 
            pcs.denomination,
            SUM(pcs.quantity) AS total_quantity,
            SUM(pcs.price) AS total_amount
        FROM public.project_customer_support pcs
        JOIN public.projects p ON pcs.project_id = p.id
        WHERE (p_start_date IS NULL OR p.raw_delivery_start >= p_start_date)
          AND (p_end_date IS NULL OR p.raw_delivery_start <= p_end_date)
          AND (p_category IS NULL OR p.category = p_category)
          AND (p_deal_status IS NULL OR p.deal_status = p_deal_status)
        GROUP BY pcs.denomination
        ORDER BY pcs.denomination DESC
    ) t;

    -- 3. สรุปหมวดหมู่ค่าใช้จ่าย (Expense Categories)
    SELECT COALESCE(json_agg(t), '[]'::json) INTO v_expenses
    FROM (
        SELECT 
            pe.category,
            SUM(pe.price) AS total_amount,
            COUNT(*) AS item_count
        FROM public.project_expenses pe
        JOIN public.projects p ON pe.project_id = p.id
        WHERE (p_start_date IS NULL OR p.raw_delivery_start >= p_start_date)
          AND (p_end_date IS NULL OR p.raw_delivery_start <= p_end_date)
          AND (p_category IS NULL OR p.category = p_category)
          AND (p_deal_status IS NULL OR p.deal_status = p_deal_status)
        GROUP BY pe.category
        ORDER BY total_amount DESC
    ) t;

    -- 4. 10 อันดับศิลปินที่มียอดซัพพอร์ตสูงสุด (Top Artists)
    SELECT COALESCE(json_agg(t), '[]'::json) INTO v_top_artists
    FROM (
        SELECT 
            p.artist_name,
            COUNT(*) AS project_count,
            COALESCE(SUM(p.wage), 0) AS total_wage,
            COALESCE(SUM(p.customer_support_total), 0) AS total_support
        FROM public.projects p
        WHERE (p_start_date IS NULL OR p.raw_delivery_start >= p_start_date)
          AND (p_end_date IS NULL OR p.raw_delivery_start <= p_end_date)
          AND p.artist_name IS NOT NULL AND p.artist_name NOT IN ('', '-', 'Unknown')
        GROUP BY p.artist_name
        ORDER BY total_support DESC
        LIMIT 10
    ) t;

    -- รวมเป็นก้อน JSON ผลลัพธ์สุดท้าย (~1.5 KB)
    result := json_build_object(
        'totals', COALESCE(v_totals, '{}'::json),
        'banknotes', COALESCE(v_banknotes, '[]'::json),
        'expenses', COALESCE(v_expenses, '[]'::json),
        'top_artists', COALESCE(v_top_artists, '[]'::json)
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 4. STORED PROCEDURE: get_artists_summary_stats
-- สถิติสะสม All-Time ของศิลปินทุกคน (Zero-Egress)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_artists_summary_stats()
RETURNS TABLE (
    artist_name text,
    project_count bigint,
    total_revenue numeric,
    total_support numeric,
    last_active_date text
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT 
        artist_name,
        COUNT(*)::bigint AS project_count,
        COALESCE(SUM(wage), 0)::numeric AS total_revenue,
        COALESCE(SUM(customer_support_total), 0)::numeric AS total_support,
        COALESCE(MAX(raw_delivery_start), MAX(project_datetime)::text, '') AS last_active_date
    FROM public.projects
    WHERE artist_name IS NOT NULL AND artist_name NOT IN ('', '-', 'Unknown')
    GROUP BY artist_name
    ORDER BY total_support DESC;
$$;

-- ------------------------------------------------------------------------------
-- 5. STORED PROCEDURE: get_customers_summary_stats
-- สถิติสะสม All-Time ของลูกค้าทุกคน (Zero-Egress)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_customers_summary_stats()
RETURNS TABLE (
    customer_name text,
    project_count bigint,
    total_spend numeric,
    total_support numeric,
    last_order_date text
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT 
        customer_name,
        COUNT(*)::bigint AS project_count,
        COALESCE(SUM(wage + COALESCE(delivery_fee, 0)), 0)::numeric AS total_spend,
        COALESCE(SUM(customer_support_total), 0)::numeric AS total_support,
        COALESCE(MAX(raw_delivery_start), MAX(project_datetime)::text, '') AS last_order_date
    FROM public.projects
    WHERE customer_name IS NOT NULL AND customer_name NOT IN ('', '-', 'Unknown')
    GROUP BY customer_name
    ORDER BY total_spend DESC;
$$;
