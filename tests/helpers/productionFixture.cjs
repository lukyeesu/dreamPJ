const fs = require('node:fs');
const path = require('node:path');

const { PGlite } = require('@electric-sql/pglite');

const ADMIN_AUTH_ID = '11111111-1111-4111-8111-111111111111';
const ACCOUNTANT_AUTH_ID = '22222222-2222-4222-8222-222222222222';
const TECH_AUTH_ID = '33333333-3333-4333-8333-333333333333';
const DRIVER_AUTH_ID = '44444444-4444-4444-8444-444444444444';
const UNMAPPED_AUTH_ID = '55555555-5555-4555-8555-555555555555';

const BASE_FIXTURE_SQL = `
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.uuid_generate_v4() RETURNS uuid AS $$
BEGIN
    RETURN gen_random_uuid();
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.uuid_generate_v4() TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    description TEXT,
    allowed_pages TEXT[] NOT NULL DEFAULT '{"Calendar", "Plans"}',
    can_edit_pricing BOOLEAN DEFAULT false,
    can_delete_project BOOLEAN DEFAULT false,
    can_borrow_tools BOOLEAN DEFAULT true,
    can_manage_users BOOLEAN DEFAULT false,
    is_system_role BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.roles (name, label, description, allowed_pages, can_edit_pricing, can_delete_project, can_borrow_tools, can_manage_users, is_system_role)
VALUES 
    ('admin', 'Admin', 'Admin', '{"Calendar", "Plans", "Finance", "Analytics", "Inventory", "Staff", "Settings"}', true, true, true, true, true),
    ('accountant', 'Accountant', 'Accountant', '{"Calendar", "Plans", "Finance", "Analytics"}', true, false, false, false, false),
    ('technician', 'Technician', 'Technician', '{"Calendar", "Plans", "Inventory"}', false, false, true, false, false),
    ('driver', 'Driver', 'Driver', '{"Calendar", "Plans"}', false, false, false, false, false)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.staff_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE,
    username TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    nickname TEXT,
    phone TEXT,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
    is_active BOOLEAN DEFAULT true,
    profile_image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.projects (
    id TEXT PRIMARY KEY,
    name TEXT,
    project_datetime TIMESTAMPTZ,
    deal_status TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.inventory_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('asset', 'consumable', 'reusable_material')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE,
    name TEXT NOT NULL,
    category_id UUID REFERENCES public.inventory_categories(id) ON DELETE SET NULL,
    item_type TEXT NOT NULL CHECK (lower(item_type) IN ('asset', 'reusable', 'consumable', 'banknote', 'task', 'reusable_material')),
    unit TEXT NOT NULL DEFAULT 'ชิ้น',
    current_stock NUMERIC(10,2) NOT NULL DEFAULT 0,
    min_alert_threshold NUMERIC(10,2) DEFAULT 5,
    average_cost NUMERIC(10,2) DEFAULT 0,
    storage_location TEXT,
    color TEXT,
    size TEXT,
    status TEXT NOT NULL DEFAULT 'in_service',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

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

CREATE TABLE IF NOT EXISTS public.inventory_procurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    procurement_code TEXT UNIQUE,
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    quantity NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.inventory_disposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disposal_code TEXT UNIQUE,
    item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    quantity NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
    salvage_value NUMERIC(10,2) DEFAULT 0,
    financial_loss NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

GRANT SELECT, INSERT, UPDATE ON public.roles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.staff_users TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.projects TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.inventory_categories TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.inventory_items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.asset_units TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.inventory_procurements TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.inventory_disposals TO anon, authenticated;
`;

async function createProductionPgHarness({ staffIdType = 'uuid' } = {}) {
  const pg = new PGlite();
  await pg.exec(BASE_FIXTURE_SQL);

  // Seed baseline staff & project
  await pg.exec(`
    INSERT INTO public.staff_users (auth_user_id, username, full_name, role_id)
    VALUES 
      ('${ADMIN_AUTH_ID}', 'admin_user', 'Admin Person', (SELECT id FROM public.roles WHERE name = 'admin')),
      ('${ACCOUNTANT_AUTH_ID}', 'acc_user', 'Accountant Person', (SELECT id FROM public.roles WHERE name = 'accountant')),
      ('${TECH_AUTH_ID}', 'tech_user', 'Technician Person', (SELECT id FROM public.roles WHERE name = 'technician')),
      ('${DRIVER_AUTH_ID}', 'driver_user', 'Driver Person', (SELECT id FROM public.roles WHERE name = 'driver'))
    ON CONFLICT DO NOTHING;

    INSERT INTO public.projects (id, name)
    VALUES ('P-0001', 'Grand Floral Gala P-0001')
    ON CONFLICT DO NOTHING;
  `);

  if (staffIdType === 'text') {
    // Run migration migrate_staff_id_to_staff_code.sql
    const migSql = fs.readFileSync(path.resolve(__dirname, '../../database_scripts/migrate_staff_id_to_staff_code.sql'), 'utf8');
    await pg.exec(migSql);
  }

  // Run Plan C Core migration
  const planCSql = fs.readFileSync(path.resolve(__dirname, '../../database_scripts/inventory_plan_c.sql'), 'utf8');
  await pg.exec(planCSql);

  // Run Production Hub migration
  const hubSqlPath = path.resolve(__dirname, '../../database_scripts/inventory_production_hub.sql');
  if (fs.existsSync(hubSqlPath)) {
    const hubSql = fs.readFileSync(hubSqlPath, 'utf8');
    await pg.exec(hubSql);
  }

  return pg;
}

async function setAuthUser(pg, authId, role = 'authenticated') {
  if (role) {
    await pg.exec(`SET ROLE ${role}`);
  } else {
    await pg.exec(`RESET ROLE`);
  }
  if (authId) {
    await pg.exec(`SET request.jwt.claim.sub = '${authId}'`);
  } else {
    await pg.exec(`SET request.jwt.claim.sub = ''`);
  }
}

module.exports = {
  PGlite,
  ADMIN_AUTH_ID,
  ACCOUNTANT_AUTH_ID,
  TECH_AUTH_ID,
  DRIVER_AUTH_ID,
  UNMAPPED_AUTH_ID,
  BASE_FIXTURE_SQL,
  createProductionPgHarness,
  setAuthUser
};
