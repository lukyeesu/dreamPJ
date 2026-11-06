import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hvjjgkyitgdldrqnqzpy.supabase.co';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_l_RKf9B8gaWZK4QldnJcsA__pJclbBG';

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

export function getActiveClient() {
  return supabase;
}

export default supabase;
