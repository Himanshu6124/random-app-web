import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BACKEND = 'http://192.168.1.7:8080';
const WS_BACKEND = 'ws://192.168.1.7:8080';

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

