import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Only this test server substitutes database modules. Application builds use the real modules.
const fixture = name => fileURLToPath(new URL(name, import.meta.url));
export default defineConfig({
  plugins: [react()],
  resolve: { alias: [
    { find: /.*\/services\/supabaseClient(?:\.js)?$/, replacement: fixture('./inventory-offline-data.js') },
    { find: /^\.\/supabaseClient(?:\.js)?$/, replacement: fixture('./inventory-offline-data.js') },
    { find: /.*\/services\/db(?:\.js)?$/, replacement: fixture('./inventory-offline-db.js') },
    { find: /^\.\/db(?:\.js)?$/, replacement: fixture('./inventory-offline-db.js') }
  ] },
  optimizeDeps: { entries: ['tests/fixtures/inventory-full-preview.html'] },
  build: { outDir: 'dist-inventory-preview', rollupOptions: { input: fixture('./inventory-full-preview.html') } },
  server: { host: '127.0.0.1', port: 5175, strictPort: true },
  base: '/'
});
