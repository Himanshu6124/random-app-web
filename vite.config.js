import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BACKEND = 'http://192.168.1.7:8080';

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
    }
  }
})

