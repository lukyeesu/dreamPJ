-- Run once in Supabase SQL Editor BEFORE deploying the updated frontend.
-- All four writes share one transaction; any error rolls back the whole save.
BEGIN;

CREATE OR REPLACE FUNCTION public.save_project_with_items(
    p_project JSONB,
    p_quotation_items JSONB DEFAULT '[]'::JSONB,
    p_customer_support JSONB DEFAULT '[]'::JSONB,
    p_expenses JSONB DEFAULT '[]'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    project_data public.projects;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;
    IF jsonb_typeof(p_project) IS DISTINCT FROM 'object'
       OR jsonb_typeof(p_quotation_items) IS DISTINCT FROM 'array'
       OR jsonb_typeof(p_customer_support) IS DISTINCT FROM 'array'
       OR jsonb_typeof(p_expenses) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Invalid project payload' USING ERRCODE = '22023';
    END IF;
    project_data := jsonb_populate_record(NULL::public.projects, p_project);
    IF project_data.id IS NULL OR btrim(project_data.id) = '' THEN
        RAISE EXCEPTION 'Project ID required' USING ERRCODE = '22023';
    END IF;

    -- The upsert locks this project until every child write finishes.
    INSERT INTO public.projects (
        id, name, category, project_datetime, payment_date,
        artist_name, customer_name, customer_phone, customer_line,
        customer_social, customer_email, customer_tax_id, customer_address,
        recipient_name, recipient_phone, location_name, location_id, map_link,
        raw_delivery_start, raw_delivery_end, delivery_date_display,
        deal_status, transport_status, payment_status,
        wage, delivery_fee, deposit_amount, total_revenue, total_expenses,
        net_profit, customer_support_total, note, primary_image_url, images, slips
    ) VALUES (
        project_data.id, project_data.name, project_data.category,
        project_data.project_datetime, project_data.payment_date,
        project_data.artist_name, project_data.customer_name,
        project_data.customer_phone, project_data.customer_line,
        project_data.customer_social, project_data.customer_email,
        project_data.customer_tax_id, project_data.customer_address,
        project_data.recipient_name, project_data.recipient_phone,
        project_data.location_name, project_data.location_id, project_data.map_link,
        project_data.raw_delivery_start, project_data.raw_delivery_end,
        project_data.delivery_date_display, project_data.deal_status,
        project_data.transport_status, project_data.payment_status,
        project_data.wage, project_data.delivery_fee, project_data.deposit_amount,
        project_data.total_revenue, project_data.total_expenses,
        project_data.net_profit, project_data.customer_support_total,
        project_data.note, project_data.primary_image_url, project_data.images, project_data.slips
    ) ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, category = EXCLUDED.category,
        project_datetime = EXCLUDED.project_datetime, payment_date = EXCLUDED.payment_date,
        artist_name = EXCLUDED.artist_name, customer_name = EXCLUDED.customer_name,
        customer_phone = EXCLUDED.customer_phone, customer_line = EXCLUDED.customer_line,
        customer_social = EXCLUDED.customer_social, customer_email = EXCLUDED.customer_email,
        customer_tax_id = EXCLUDED.customer_tax_id, customer_address = EXCLUDED.customer_address,
        recipient_name = EXCLUDED.recipient_name, recipient_phone = EXCLUDED.recipient_phone,
        location_name = EXCLUDED.location_name, location_id = EXCLUDED.location_id,
        map_link = EXCLUDED.map_link, raw_delivery_start = EXCLUDED.raw_delivery_start,
        raw_delivery_end = EXCLUDED.raw_delivery_end, delivery_date_display = EXCLUDED.delivery_date_display,
        deal_status = EXCLUDED.deal_status, transport_status = EXCLUDED.transport_status,
        payment_status = EXCLUDED.payment_status, wage = EXCLUDED.wage,
        delivery_fee = EXCLUDED.delivery_fee, deposit_amount = EXCLUDED.deposit_amount,
        total_revenue = EXCLUDED.total_revenue, total_expenses = EXCLUDED.total_expenses,
        net_profit = EXCLUDED.net_profit, customer_support_total = EXCLUDED.customer_support_total,
        note = EXCLUDED.note, primary_image_url = EXCLUDED.primary_image_url,
        images = EXCLUDED.images, slips = EXCLUDED.slips;

    DELETE FROM public.project_quotation_items WHERE project_id = project_data.id;
    DELETE FROM public.project_customer_support WHERE project_id = project_data.id;
    DELETE FROM public.project_expenses WHERE project_id = project_data.id;

    INSERT INTO public.project_quotation_items
        (project_id, category, detail, quantity, unit_price, price, item_date, sort_order)
    SELECT project_data.id, x.category, x.detail, x.quantity, x.unit_price, x.price, x.item_date, x.sort_order
    FROM jsonb_to_recordset(p_quotation_items) AS x(
        category TEXT, detail TEXT, quantity NUMERIC, unit_price NUMERIC,
        price NUMERIC, item_date DATE, sort_order INT
    );
    INSERT INTO public.project_customer_support
        (project_id, denomination, quantity, price, item_date, sort_order)
    SELECT project_data.id, x.denomination, x.quantity, x.price, x.item_date, x.sort_order
    FROM jsonb_to_recordset(p_customer_support) AS x(
        denomination INT, quantity INT, price NUMERIC, item_date DATE, sort_order INT
    );
    INSERT INTO public.project_expenses
        (project_id, category, detail, quantity, unit_price, price, item_date, sort_order)
    SELECT project_data.id, x.category, x.detail, x.quantity, x.unit_price, x.price, x.item_date, x.sort_order
    FROM jsonb_to_recordset(p_expenses) AS x(
        category TEXT, detail TEXT, quantity NUMERIC, unit_price NUMERIC,
        price NUMERIC, item_date DATE, sort_order INT
    );
END;
$$;

REVOKE ALL ON FUNCTION public.save_project_with_items(JSONB, JSONB, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_project_with_items(JSONB, JSONB, JSONB, JSONB) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
