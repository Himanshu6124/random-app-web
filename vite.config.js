import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const BACKEND = env.VITE_BACKEND_URL || 'http://127.0.0.1:8080';
  const WS_BACKEND = BACKEND.replace(/^http/, 'ws');

  return {
    plugins: [react()],
    server: {
      host: true,
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


