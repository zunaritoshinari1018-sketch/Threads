import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { handleApi } from './server/api.mjs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'layer-api-gateway',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith('/api/')) return next();
          await handleApi(req, res);
        });
      },
    },
  ],
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    headers: { 'X-Content-Type-Options': 'nosniff' },
  },
});
