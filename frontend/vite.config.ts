import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const apiTarget = process.env.VITE_API_TARGET || 'http://127.0.0.1:8000'
const wsTarget = process.env.VITE_WS_TARGET || apiTarget.replace(/^http/, 'ws')

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('/axios/')) return 'http'
          if (id.includes('/lucide-react/')) return 'ui_icons'
          if (id.includes('react-syntax-highlighter')) return 'code'
          return 'vendor'
        },
      }
    }
  },
  server: {
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/ws': {
        target: wsTarget,
        ws: true,
      }
    }
  }
})
