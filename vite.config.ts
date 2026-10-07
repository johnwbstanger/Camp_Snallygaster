import { defineConfig } from 'vite';

export default defineConfig({
  // Use relative production asset paths so the client works under repository subpaths.
  base: './',
  server: {
    port: 5173,
    proxy: {
      '/matchmake': {
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
    minify: 'esbuild'
  },
  optimizeDeps: {
    include: ['three']
  }
});
