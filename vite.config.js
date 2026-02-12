import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/', // แก้จาก '/dreamPJ/' เป็น '/' เท่านั้น
})