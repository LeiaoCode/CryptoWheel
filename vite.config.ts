import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite configuration with a proxy to avoid CORS when calling
// https://api.multisynq.io from http://localhost:3000 during local development.
// Any request that starts with "/ms" will be forwarded to the Multisynq API.

export default defineConfig({
  plugins: [react()],

  /**
   * Local dev server
   */
  server: {
    host: '0.0.0.0',
    port: 3000,

    /**
     * Proxy configuration: Front‑end code should fetch("/ms/…") instead of
     * "https://api.multisynq.io/…". The proxy strips the "/ms" prefix and
     * forwards the request to the real backend, adding the proper
     * Access‑Control‑Allow‑Origin headers so the browser is satisfied.
     */
    proxy: {
      '/ms': {
        target: 'https://api.multisynq.io',
        changeOrigin: true,
        secure: false,
        rewrite: path => path.replace(/^\/ms/, ''),
      },
    },
  },

  /**
   * vite preview (npm run preview) – keep the same host/port so that the
   * proxy still works when you preview the production build locally.
   */
  preview: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/ms': {
        target: 'https://api.multisynq.io',
        changeOrigin: true,
        secure: false,
        rewrite: path => path.replace(/^\/ms/, ''),
      },
    },
  },
});
