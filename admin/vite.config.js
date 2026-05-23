import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  base: '/admin/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5175,
    proxy: {
      '/api': {
        target: process.env.BACKEND_URL || 'http://localhost:4007',
        changeOrigin: true,
      },
      '/ws': {
        target: (process.env.BACKEND_URL || 'http://localhost:4007').replace('http', 'ws'),
        ws: true,
      },
    },
  },
})
