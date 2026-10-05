import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Keep authentication cookies same-origin in development. This prevents
      // cart requests from losing their session when the app is opened through
      // 127.0.0.1 instead of localhost (or vice versa).
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
});
