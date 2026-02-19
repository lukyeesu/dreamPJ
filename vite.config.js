export default defineConfig({
  plugins: [react()],
  base: process.env.VERCEL || process.env.NODE_ENV !== 'production' ? '/' : '/dreamPJ/',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // แยก Library ที่ใหญ่มากๆ ออกมาเป็นไฟล์เฉพาะ
            if (id.includes('framer-motion')) {
              return 'framer-motion';
            }
            if (id.includes('lucide-react')) {
              return 'icons';
            }
            // แยกกลุ่ม React Core ออกมา (ช่วยเรื่อง Caching)
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor';
            }
            // ที่เหลือใน node_modules ให้รวมกันเป็น vendor
            return 'vendor';
          }
        },
      },
    },
    // (ทางเลือก) ปรับลิมิตคำเตือนให้เหมาะสมกับโปรเจกต์
    chunkSizeWarningLimit: 600, 
  },
})