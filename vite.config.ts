import { defineConfig } from 'vite';

export default defineConfig({
  // Keep production assets relative so GitHub Pages and other subpath hosts can serve them correctly.
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
