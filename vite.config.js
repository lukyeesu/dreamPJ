import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // จัดการ Path สำหรับการ Deploy (GitHub Pages ใช้ /dreamPJ/)
  base: process.env.VERCEL || process.env.NODE_ENV !== 'production' 
    ? '/' 
    : '/dreamPJ/',

  build: {
    // ปรับเพดานการเตือนขนาดไฟล์เป็น 1000 kB (1MB) เพื่อความสบายตา
    chunkSizeWarningLimit: 1000,
    
    rollupOptions: {
      output: {
        // ฟังก์ชันจัดการแยกไฟล์ (Manual Chunking)
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // แยก Library ตัวใหญ่ๆ ออกมาเป็นไฟล์เฉพาะ
            if (id.includes('framer-motion')) {
              return 'framer-motion';
            }
            if (id.includes('lucide-react')) {
              return 'icons';
            }
            // แยกกลุ่ม React Core (ช่วยเรื่องความเร็วในการโหลดซ้ำ/Caching)
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react';
            }
            // Library อื่นๆ ใน node_modules ให้รวมกันในชื่อ vendor
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