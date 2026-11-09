import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // จัดการ Path สำหรับการ Deploy (GitHub Pages ใช้ /dreamPJ/)
  base: process.env.VERCEL || process.env.NODE_ENV !== 'production' 
    ? '/' 
    : '/dreamPJ/',

  server: {
    host: '0.0.0.0',
    port: 5174,
    cors: true,
  },

  build: {
    // ปรับเพดานการเตือนขนาดไฟล์เป็น 1000 kB (1MB) เพื่อความสบายตา
    chunkSizeWarningLimit: 1000,
    
    rollupOptions: {
      output: {
        // ฟังก์ชันจัดการแยกไฟล์ (Manual Chunking) โดยไม่ทำให้เกิด Circular Chunk
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // แยกชุด Icons ออกมาเพื่อแคชแยก
            if (id.includes('lucide-react')) {
              return 'icons';
            }
            // แยกชุด Database / Backend API (Supabase & Dexie)
            if (id.includes('@supabase') || id.includes('dexie')) {
              return 'vendor-db';
            }
            // รวม React Core, React-DOM, Scheduler, Hook-Form และ Vendor อื่นๆ
            // ให้อยู่ใน Chunk เดียวกันเพื่อป้องกัน Circular Dependency / TDZ error (Cannot access before initialization)
            return 'vendor';
          }
        },
        // กำหนดรูปแบบชื่อไฟล์ให้ดูสะอาดตา (เลือกใช้ได้)
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
  },
})