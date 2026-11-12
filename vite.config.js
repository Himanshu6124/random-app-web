import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const rawBackend = env.VITE_BACKEND_URL || 'http://localhost:8080';
  const BACKEND = rawBackend.replace(/\/+$/, '');
  const WS_BACKEND = BACKEND.replace(/^http/, 'ws');

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/auth': {
          target: BACKEND,
          changeOrigin: true,
          secure: false,
        },
        '/users': {
          target: BACKEND,
          changeOrigin: true,
          secure: false,
        },
        '/userImages': {
          target: BACKEND,
          changeOrigin: true,
          secure: false,
        },
        '/friendships': {
          target: BACKEND,
          changeOrigin: true,
          secure: false,
        },
        '/conversations': {
          target: BACKEND,
          changeOrigin: true,
          secure: false,
        },
        '/messages': {
          target: BACKEND,
          changeOrigin: true,
          secure: false,
        },
        '/location': {
          target: BACKEND,
          changeOrigin: true,
          secure: false,
        },
        '/matches': {
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
  }
})
