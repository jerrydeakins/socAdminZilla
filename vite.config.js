import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "firefox120",
    minify: false,
    sourcemap: true,
    rollupOptions: {
      input: "src/app.js",
      output: {
        entryFileNames: "vk.js",
        format: "iife"
      }
    },
    outDir: "content",
    emptyOutDir: false
  }
});