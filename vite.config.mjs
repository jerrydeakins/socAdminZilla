import { defineConfig } from 'vite';
import zipPack from 'vite-plugin-zip-pack';
import path from 'path';

export default defineConfig({
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Content script должен быть монолитным бандлом без разделения на чанки
    rollupOptions: {
      input: {
        content: path.resolve(__dirname, 'src/content.js')
      },
      output: {
        format: 'iife',
        entryFileNames: '[name].js',
        extend: true
      }
    }
  },
  plugins: [
    zipPack({
      inDir: 'dist',
      outDir: './',
      outFileName: 'socAdminZilla.zip'
    })
  ]
});