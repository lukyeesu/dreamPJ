import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // ใช้ 'loadEnv' หรือเช็กผ่าน mode ก็ได้ แต่ถ้าเอาแบบเข้าใจง่ายและใช้ได้จริง:
  base: process.env.VERCEL || process.env.NODE_ENV !== 'production' 
    ? '/' 
    : '/dreamPJ/',
})