import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react'
            if (id.includes('motion') || id.includes('framer')) return 'vendor-motion'
            if (id.includes('@radix-ui')) return 'vendor-radix'
            if (id.includes('recharts')) return 'vendor-charts'
            if (id.includes('lucide')) return 'vendor-icons'
            if (id.includes('socket.io')) return 'vendor-socket'
            if (id.includes('@sentry')) return 'vendor-sentry'
          }
        },
      },
    },
  },
})
