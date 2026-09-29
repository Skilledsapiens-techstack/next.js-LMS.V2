import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const appDir = dirname(fileURLToPath(import.meta.url));
const workspaceDir = resolve(appDir, '../..');

export default defineConfig({
  envDir: workspaceDir,
  root: appDir,
  plugins: [react()],
  publicDir: resolve(workspaceDir, 'public'),
  build: {
    outDir: resolve(workspaceDir, 'dist-pulse'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          icons: ['lucide-react'],
          query: ['@tanstack/react-query'],
          router: ['react-router-dom'],
          supabase: ['@supabase/supabase-js']
        }
      }
    }
  },
  server: {
    port: 5174,
    strictPort: false
  },
  preview: {
    port: 4174,
    strictPort: false
  }
});
