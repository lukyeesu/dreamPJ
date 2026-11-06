-- ==============================================================================
-- FLOWER2U (F2U) - Schema Extension for Settings & Staff Passwords
-- Run this in Supabase SQL Editor if you want Categories & Passwords synced in Supabase
-- ==============================================================================

ALTER TABLE public.shop_settings 
ADD COLUMN IF NOT EXISTS project_categories JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS expense_categories JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS deal_statuses JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS transport_statuses JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS drive_folders JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.staff_users 
ADD COLUMN IF NOT EXISTS password TEXT DEFAULT '1';

-- Update known staff passwords
UPDATE public.staff_users SET password = '1' WHERE username = '1';
UPDATE public.staff_users SET password = '1234' WHERE username = 'AOM';
UPDATE public.staff_users SET password = '1' WHERE username = 'DREAM';
UPDATE public.staff_users SET password = 'aom@2026' WHERE username = 'Chuti';

-- Ensure 1 row in shop_settings
DELETE FROM public.shop_settings WHERE id NOT IN (
    SELECT id FROM public.shop_settings ORDER BY updated_at DESC LIMIT 1
);
