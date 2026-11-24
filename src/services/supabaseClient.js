import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Supabase Client สำหรับหน้าเว็บ (ใช้ anon/publishable key ตามมาตรฐานสากล)
export const supabase = createClient(supabaseUrl, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

if (typeof window !== 'undefined') {
  window.supabase = supabase;
}

export function getActiveClient() {
  return supabase;
}

export default supabase;
