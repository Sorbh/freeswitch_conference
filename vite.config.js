import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'

function buildIdPlugin() {
  return {
    name: 'build-id',
    closeBundle() {
      const outDir = path.resolve(__dirname, 'dist');
      fs.writeFileSync(path.join(outDir, 'build-id.json'), JSON.stringify({ id: Date.now() }));
    },
  };
}

export default defineConfig({
  base: '/admin/',
  plugins: [react(), tailwindcss(), buildIdPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5175,
  },
})
