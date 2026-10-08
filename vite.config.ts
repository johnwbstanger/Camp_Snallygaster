import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: "dist/client",
    target: "es2020",
    minify: "esbuild",
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 700,
  },
  optimizeDeps: {
    include: ["three", "cannon-es"],
  },
});
