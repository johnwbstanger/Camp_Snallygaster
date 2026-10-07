import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true
      },
      '/api': {
        target: 'http://localhost:3001',
      }
    }
  },
  build: {
    outDir: 'dist/client',
    target: 'es2020',
    minify: 'terser'
  },
  optimizeDeps: {
    include: ['three']
  }
});
