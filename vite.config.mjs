import { defineConfig } from 'vite';
import zipPack from 'vite-plugin-zip-pack';
import path from 'path';
import fs from 'fs';

function svgIconsPlugin() {
  const virtualModuleId = 'virtual:svg-icons';
  const resolvedVirtualModuleId = '\0' + virtualModuleId;

  return {
    name: 'svg-icons',

    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
    },

    load(id) {
      if (id !== resolvedVirtualModuleId) {
        return;
      }

      const iconsDir = path.resolve(__dirname, 'public/icons');
      const files = fs.readdirSync(iconsDir)
        .filter(file => file.toLowerCase().endsWith('.svg'));

      const entries = files.map(file => {
        const name = path.basename(file, '.svg');
        let svg = fs.readFileSync(
          path.join(iconsDir, file),
          'utf8'
        ).trim();

        // Иконки должны наследовать цвет от .sa-icon.
        svg = svg.replace(/\bstroke\s*=\s*["']black["']/gi, 'stroke="currentColor"');
        svg = svg.replace(/\bfill\s*=\s*["']black["']/gi, 'fill="currentColor"');

        // Экранируем содержимое для JS template literal.
        svg = svg
          .replace(/\\/g, '\\\\')
          .replace(/`/g, '\\`')
          .replace(/\$\{/g, '\\${');

        return `${JSON.stringify(name)}: \`${svg}\``;
      });

      return `export const SVG_ICONS = {
${entries.join(',\n')}
};`;
    }
  };
}

export default defineConfig({
  publicDir: 'public',

  build: {
    outDir: 'dist',
    emptyOutDir: true,

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
    svgIconsPlugin(),

    zipPack({
      inDir: 'dist',
      outDir: './',
      outFileName: 'socAdminZilla.zip'
    })
  ]
});