import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';

const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  root: root + 'deployment/public-map',
  publicDir: root + 'public',
  resolve: { alias: {
    '@': root,
    ...Object.fromEntries(['layers.png','layers-2x.png','marker-icon.png'].map(name=>[
      'images/'+name, root+'node_modules/leaflet/dist/images/'+name,
    ])),
  } },
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [react()],
  build: {
    outDir: root + 'dist/public-map', emptyOutDir: true, copyPublicDir: false,
    target: ['chrome111', 'edge111', 'firefox128', 'safari16.4'],
    cssTarget: ['chrome111', 'firefox128', 'safari16.4'],
    rolldownOptions:{output:{codeSplitting:{groups:[{name:'react-runtime',test:/\/node_modules\/(?:react|react-dom|scheduler)\//}]}}},
  },
});
