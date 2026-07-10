import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const clientRoot = path.dirname(fileURLToPath(import.meta.url));

function buildIdPlugin() {
  return {
    name: 'build-id',
    closeBundle() {
      const outDir = path.resolve(clientRoot, '../dist-client');
      fs.writeFileSync(path.join(outDir, 'build-id.json'), JSON.stringify({ id: Date.now() }));
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), buildIdPlugin()],
  base: '/',
  resolve: {
    alias: {
      react: path.resolve(clientRoot, 'node_modules/react'),
      'react-dom': path.resolve(clientRoot, 'node_modules/react-dom'),
      'react-router-dom': path.resolve(clientRoot, 'node_modules/react-router-dom'),
    },
    dedupe: ['react', 'react-dom', 'react-router-dom'],
  },
  build: {
    outDir: '../dist-client',
    emptyOutDir: true,
  },
  server: {
    port: 5176,
    proxy: {
      '/api': 'http://localhost:4070',
    },
  },
});
