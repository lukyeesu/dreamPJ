-- ==============================================================================
-- 📊 RPC Function: get_complete_analytics
-- คำนวณผลสรุปการเงิน สถิติธนบัตร และมิติวิเคราะห์บน Supabase Server 100%
-- ส่งเฉพาะผลลัพธ์สุดท้ายกลับมาที่ Client (Payload ขนาดเพียง ~1.5 KB)
-- Zero Egress, Zero Client Overhead (ไม่ต้องโหลดโปรเจกต์ทั้งก้อนมาวนลูปหน้าบ้าน)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_complete_analytics(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL,
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
    v_top_customers JSON;
    v_top_venues JSON;
    v_low_margin JSON;
    v_status_counts JSON;
    v_category_counts JSON;
BEGIN
    -- 1. ยอดรวมการเงินหลัก (Financial Totals)
    SELECT json_build_object(
        'total_orders', COUNT(*),
        'total_customer_support', COALESCE(SUM(customer_support_total), 0),
        'total_revenue', COALESCE(SUM(wage), 0),
        'total_expenses', COALESCE(SUM(total_expenses), 0),
        'total_net_profit', COALESCE(SUM(net_profit), 0),
        'avg_order_value', CASE WHEN COUNT(*) > 0 THEN ROUND(COALESCE(SUM(wage), 0) / COUNT(*)) ELSE 0 END,
        'avg_support_value', CASE WHEN COUNT(*) > 0 THEN ROUND(COALESCE(SUM(customer_support_total), 0) / COUNT(*)) ELSE 0 END,
        'net_margin_percent', CASE WHEN COALESCE(SUM(wage), 0) > 0 THEN ROUND(((COALESCE(SUM(net_profit), 0) / SUM(wage)) * 100)::numeric, 1) ELSE 0.0 END
    ) INTO v_totals
    FROM public.projects
    WHERE (p_start_date IS NULL OR project_datetime >= p_start_date)
      AND (p_end_date IS NULL OR project_datetime <= p_end_date)
      AND (p_category IS NULL OR category = p_category)
      AND (p_deal_status IS NULL OR deal_status = p_deal_status);

    -- 2. นับจำนวนงานแยกตามสถานะ (Status Counts)
    SELECT json_build_object(
        'total', COUNT(*),
        'completed', COUNT(*) FILTER (WHERE deal_status = 'confirmed' AND transport_status = 'delivered'),
        'active', COUNT(*) FILTER (WHERE deal_status = 'confirmed' AND transport_status NOT IN ('delivered', 'issue')),
        'pending', COUNT(*) FILTER (WHERE deal_status = 'pending'),
        'issue', COUNT(*) FILTER (WHERE deal_status = 'cancelled' OR transport_status = 'issue'),
        'declined', COUNT(*) FILTER (WHERE deal_status = 'declined')
    ) INTO v_status_counts
    FROM public.projects
    WHERE (p_start_date IS NULL OR project_datetime >= p_start_date)
      AND (p_end_date IS NULL OR project_datetime <= p_end_date);

    -- 3. แจกแจงธนบัตรเงินซัพพอร์ตศิลปิน (Banknote Float Breakdown)
    SELECT COALESCE(json_object_agg(denomination, json_build_object('count', total_qty, 'amount', total_amt)), '{}'::json)
    INTO v_banknotes
    FROM (
        SELECT 
            cs.denomination::TEXT AS denomination, 
            COALESCE(SUM(cs.quantity), 0) AS total_qty, 
            COALESCE(SUM(cs.price), 0) AS total_amt
        FROM public.project_customer_support cs
        JOIN public.projects p ON p.id = cs.project_id
        WHERE (p_start_date IS NULL OR p.project_datetime >= p_start_date)
          AND (p_end_date IS NULL OR p.project_datetime <= p_end_date)
        GROUP BY cs.denomination
    ) b;

    -- 4. สัดส่วนค่าใช้จ่ายจริงรายหมวด (Expenses Breakdown)
    SELECT COALESCE(json_agg(row_to_json(e)), '[]'::json)
    INTO v_expenses
    FROM (
        SELECT ex.category, SUM(ex.price) AS amount
        FROM public.project_expenses ex
        JOIN public.projects p ON p.id = ex.project_id
        WHERE ex.category IS NOT NULL AND ex.category != ''
          AND (p_start_date IS NULL OR p.project_datetime >= p_start_date)
          AND (p_end_date IS NULL OR p.project_datetime <= p_end_date)
        GROUP BY ex.category
        ORDER BY amount DESC
        LIMIT 10
    ) e;

    -- 5. สัดส่วนหมวดหมู่งาน (Category Distribution)
    SELECT COALESCE(json_agg(row_to_json(cat)), '[]'::json)
    INTO v_category_counts
    FROM (
        SELECT category AS name, COUNT(*) AS count
        FROM public.projects
        WHERE category IS NOT NULL AND category != ''
          AND (p_start_date IS NULL OR project_datetime >= p_start_date)
          AND (p_end_date IS NULL OR project_datetime <= p_end_date)
        GROUP BY category
        ORDER BY count DESC
    ) cat;

    -- 6. อันดับศิลปินทำเงินสูงสุด (Top Artists)
    SELECT COALESCE(json_agg(row_to_json(a)), '[]'::json)
    INTO v_top_artists
    FROM (
        SELECT artist_name AS name, SUM(wage) AS amount
        FROM public.projects
        WHERE artist_name IS NOT NULL AND artist_name != '' AND artist_name != '-'
          AND (p_start_date IS NULL OR project_datetime >= p_start_date)
          AND (p_end_date IS NULL OR project_datetime <= p_end_date)
        GROUP BY artist_name
        ORDER BY amount DESC
        LIMIT 10
    ) a;

    -- 7. อันดับลูกค้าทำเงินสูงสุด (Top Customers)
    SELECT COALESCE(json_agg(row_to_json(c)), '[]'::json)
    INTO v_top_customers
    FROM (
        SELECT customer_name AS name, SUM(wage) AS amount, COUNT(*) AS count
        FROM public.projects
        WHERE customer_name IS NOT NULL AND customer_name != '' AND customer_name != '-'
          AND (p_start_date IS NULL OR project_datetime >= p_start_date)
          AND (p_end_date IS NULL OR project_datetime <= p_end_date)
        GROUP BY customer_name
        ORDER BY amount DESC
        LIMIT 10
    ) c;

    -- 8. อันดับทำเล & สถานที่จัดส่งยอดนิยม (Top Venues)
    SELECT COALESCE(json_agg(row_to_json(v)), '[]'::json)
    INTO v_top_venues
    FROM (
        SELECT location_name AS name, COUNT(*) AS count, SUM(wage) AS revenue
        FROM public.projects
        WHERE location_name IS NOT NULL AND location_name != '' AND location_name != '-'
          AND (p_start_date IS NULL OR project_datetime >= p_start_date)
          AND (p_end_date IS NULL OR project_datetime <= p_end_date)
        GROUP BY location_name
        ORDER BY count DESC, revenue DESC
        LIMIT 10
    ) v;

    -- 9. ตรวจจับงานเสี่ยงต้นทุนสูง Margin < 40% (Low Margin Radar)
    SELECT COALESCE(json_agg(row_to_json(l)), '[]'::json)
    INTO v_low_margin
    FROM (
        SELECT id, name, artist_name AS artist, wage AS revenue, total_expenses AS cost,
               net_profit AS profit,
               ROUND(((net_profit / NULLIF(wage, 0)) * 100)::numeric, 1) AS margin_pct
        FROM public.projects
        WHERE wage > 0 AND (net_profit / wage) < 0.4
          AND (p_start_date IS NULL OR project_datetime >= p_start_date)
          AND (p_end_date IS NULL OR project_datetime <= p_end_date)
        ORDER BY margin_pct ASC
        LIMIT 8
    ) l;

    -- รวมเป็นก้อน JSON สรุปเพียงก้อนเดียว
    result := json_build_object(
        'totals', v_totals,
        'status_counts', v_status_counts,
        'banknotes', v_banknotes,
        'expenses', v_expenses,
        'categories', v_category_counts,
        'top_artists', v_top_artists,
        'top_customers', v_top_customers,
        'top_venues', v_top_venues,
        'low_margin', v_low_margin
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
