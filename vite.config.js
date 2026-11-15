import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { seo } from './vite-plugin-seo.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Where the dev-server proxy forwards API/WebSocket calls. DEV_PROXY_TARGET is dev-only (no VITE_
  // prefix, so it never reaches the browser bundle): point it at the Oracle backend to test the local
  // frontend against production while the browser stays same-origin (no CORS, no mixed content).
  const rawBackend = env.DEV_PROXY_TARGET || env.VITE_BACKEND_URL || 'http://localhost:8080';
  const BACKEND = rawBackend.replace(/\/+$/, '');
  const WS_BACKEND = BACKEND.replace(/^http/, 'ws');

  return {
    // VITE_SITE_URL: the production address, e.g. https://randomeet.app (see vite-plugin-seo.js)
    plugins: [react(), basicSsl(), seo({ siteUrl: env.VITE_SITE_URL })],
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
