import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/dreamPJ/', // ใส่ชื่อ Repository ที่คุณตั้งไว้ใน GitHub
})