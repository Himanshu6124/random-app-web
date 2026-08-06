import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Backend URL priority:
//   1. VITE_BACKEND_URL env variable (set in .env.local)
//   2. localhost:8080 (default for running backend locally)
// To point at a device on LAN: add VITE_BACKEND_URL=http://192.168.x.x:8080 to .env.local
const BACKEND = process.env.VITE_BACKEND_URL || 'http://localhost:8080';
const WS_BACKEND = BACKEND.replace(/^http/, 'ws');

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
      },
      '/users': {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
      },
      '/friends': {
        target: BACKEND,
        changeOrigin: true,
        secure: false,
      },
      // WebSocket proxy for STOMP chat connections
      '/ws-chat': {
        target: WS_BACKEND,
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    }
  }
})

