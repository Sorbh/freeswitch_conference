import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const clientRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
