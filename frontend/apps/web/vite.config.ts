import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// During `vite dev` the requests are proxied to docker host ports.
// In production the nginx config performs the same proxying.
const SERVICES: Record<string, string> = {
  '/api/admin':         'http://localhost:8084',
  '/api/inventory':     'http://localhost:8085',
  '/api/testing':       'http://localhost:8086',
  '/api/hm':            'http://localhost:8087',
  '/api/laser':         'http://localhost:8088',
  '/api/refinery':      'http://localhost:8089',
  '/api/exchange':      'http://localhost:8090',
  '/api/billing':       'http://localhost:8091',
  '/api/records':       'http://localhost:8092',
  '/api/notifications': 'http://localhost:8093',
};

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    port: 3010,
    host: true,
    proxy: Object.fromEntries(
      Object.entries(SERVICES).map(([prefix, target]) => [
        prefix,
        { target, changeOrigin: true, rewrite: (p) => p.replace(prefix, '') },
      ]),
    ),
  },
  build: { outDir: 'dist', sourcemap: false, target: 'es2022' },
});
