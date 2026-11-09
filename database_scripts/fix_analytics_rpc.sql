-- ==============================================================================
-- 📊 RPC Function: get_complete_analytics (Fixed & Hardened)
-- คำนวณผลสรุปการเงิน สถิติธนบัตร และมิติวิเคราะห์บน Supabase Server 100%
-- แก้ไขปัญหา: column reference "category" is ambiguous (ระบุ pe.category และ p.category ชัดเจน)
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
    v_status_counts JSON;
    v_banknotes JSON;
    v_expenses JSON;
    v_category_counts JSON;
    v_top_artists JSON;
    v_top_customers JSON;
    v_top_venues JSON;
    v_low_margin JSON;
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
    FROM public.projects p
    WHERE (p_start_date IS NULL OR p.project_datetime >= p_start_date)
      AND (p_end_date IS NULL OR p.project_datetime <= p_end_date)
      AND (p_category IS NULL OR p.category = p_category)
      AND (p_deal_status IS NULL OR p.deal_status = p_deal_status);

    -- 2. นับจำนวนงานแยกตามสถานะ (Status Counts)
    SELECT json_build_object(
        'total', COUNT(*),
        'completed', COUNT(*) FILTER (WHERE p.deal_status = 'confirmed' AND p.transport_status = 'delivered'),
        'active', COUNT(*) FILTER (WHERE p.deal_status = 'confirmed' AND p.transport_status NOT IN ('delivered', 'issue')),
        'pending', COUNT(*) FILTER (WHERE p.deal_status = 'pending'),
        'issue', COUNT(*) FILTER (WHERE p.deal_status = 'cancelled' OR p.transport_status = 'issue'),
        'declined', COUNT(*) FILTER (WHERE p.deal_status = 'declined')
    ) INTO v_status_counts
    FROM public.projects p
    WHERE (p_start_date IS NULL OR p.project_datetime >= p_start_date)
      AND (p_end_date IS NULL OR p.project_datetime <= p_end_date);

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
          AND (p_category IS NULL OR p.category = p_category)
          AND (p_deal_status IS NULL OR p.deal_status = p_deal_status)
        GROUP BY cs.denomination
    ) b;

    -- 4. สัดส่วนค่าใช้จ่ายจริงรายหมวด (Expenses Breakdown) - แก้ pe.category
    SELECT COALESCE(json_agg(row_to_json(e)), '[]'::json)
    INTO v_expenses
    FROM (
        SELECT pe.category, SUM(pe.price) AS amount
        FROM public.project_expenses pe
        JOIN public.projects p ON p.id = pe.project_id
        WHERE pe.category IS NOT NULL AND pe.category != ''
          AND (p_start_date IS NULL OR p.project_datetime >= p_start_date)
          AND (p_end_date IS NULL OR p.project_datetime <= p_end_date)
          AND (p_category IS NULL OR p.category = p_category)
          AND (p_deal_status IS NULL OR p.deal_status = p_deal_status)
        GROUP BY pe.category
        ORDER BY amount DESC
        LIMIT 10
    ) e;

    -- 5. สัดส่วนหมวดหมู่งาน (Category Distribution)
    SELECT COALESCE(json_agg(row_to_json(cat)), '[]'::json)
    INTO v_category_counts
    FROM (
        SELECT p.category AS name, COUNT(*) AS count
        FROM public.projects p
        WHERE p.category IS NOT NULL AND p.category != ''
          AND (p_start_date IS NULL OR p.project_datetime >= p_start_date)
          AND (p_end_date IS NULL OR p.project_datetime <= p_end_date)
        GROUP BY p.category
        ORDER BY count DESC
    ) cat;

    -- 6. อันดับศิลปินทำเงินสูงสุด (Top Artists)
    SELECT COALESCE(json_agg(row_to_json(a)), '[]'::json)
    INTO v_top_artists
    FROM (
        SELECT p.artist_name AS name, SUM(p.wage) AS amount
        FROM public.projects p
        WHERE p.artist_name IS NOT NULL AND p.artist_name != '' AND p.artist_name != '-'
          AND (p_start_date IS NULL OR p.project_datetime >= p_start_date)
          AND (p_end_date IS NULL OR p.project_datetime <= p_end_date)
        GROUP BY p.artist_name
        ORDER BY amount DESC
        LIMIT 10
    ) a;

    -- 7. อันดับลูกค้าทำเงินสูงสุด (Top Customers)
    SELECT COALESCE(json_agg(row_to_json(c)), '[]'::json)
    INTO v_top_customers
    FROM (
        SELECT p.customer_name AS name, SUM(p.wage) AS amount, COUNT(*) AS count
        FROM public.projects p
        WHERE p.customer_name IS NOT NULL AND p.customer_name != '' AND p.customer_name != '-'
          AND (p_start_date IS NULL OR p.project_datetime >= p_start_date)
          AND (p_end_date IS NULL OR p.project_datetime <= p_end_date)
        GROUP BY p.customer_name
        ORDER BY amount DESC
        LIMIT 10
    ) c;

    -- 8. อันดับทำเล & สถานที่จัดส่งยอดนิยม (Top Venues)
    SELECT COALESCE(json_agg(row_to_json(v)), '[]'::json)
    INTO v_top_venues
    FROM (
        SELECT p.location_name AS name, COUNT(*) AS count, SUM(p.wage) AS revenue
        FROM public.projects p
        WHERE p.location_name IS NOT NULL AND p.location_name != '' AND p.location_name != '-'
          AND (p_start_date IS NULL OR p.project_datetime >= p_start_date)
          AND (p_end_date IS NULL OR p.project_datetime <= p_end_date)
        GROUP BY p.location_name
        ORDER BY count DESC, revenue DESC
        LIMIT 10
    ) v;

    -- 9. ตรวจจับงานเสี่ยงต้นทุนสูง Margin < 40% (Low Margin Radar)
    SELECT COALESCE(json_agg(row_to_json(l)), '[]'::json)
    INTO v_low_margin
    FROM (
        SELECT p.id, p.name, p.artist_name AS artist, p.wage AS revenue, p.total_expenses AS cost,
               p.net_profit AS profit,
               ROUND(((p.net_profit / NULLIF(p.wage, 0)) * 100)::numeric, 1) AS margin_pct
        FROM public.projects p
        WHERE p.wage > 0 AND (p.net_profit / p.wage) < 0.4
          AND (p_start_date IS NULL OR p.project_datetime >= p_start_date)
          AND (p_end_date IS NULL OR p.project_datetime <= p_end_date)
        ORDER BY margin_pct ASC
        LIMIT 8
    ) l;

    -- รวมเป็นก้อน JSON สรุปเพียงก้อนเดียว (~1.5 KB)
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
