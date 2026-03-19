import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, readdirSync } from 'fs';

// Plugin to copy the scripts/ folder into dist/ since they are non-module scripts
function copyScripts() {
  return {
    name: 'copy-scripts',
    closeBundle() {
      const srcDir = resolve(__dirname, 'scripts');
      const destDir = resolve(__dirname, 'dist/scripts');
      mkdirSync(destDir, { recursive: true });
      for (const f of readdirSync(srcDir)) {
        copyFileSync(resolve(srcDir, f), resolve(destDir, f));
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), copyScripts()],
  root: '.',
  base: '/overvakningsmyndigheten/',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        poi1: 'pages/poi-1.html',
        poi2: 'pages/poi-2.html',
        poi3: 'pages/poi-3.html',
        poi4: 'pages/poi-4.html',
        poi5: 'pages/poi-5.html',
        poi6: 'pages/poi-6.html',
        poiFinal: 'pages/poi-final.html',
        summary: 'pages/summary.html',
        terms: 'pages/terms.html',
      },
    },
  },
});
