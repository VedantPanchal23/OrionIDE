import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // y-monaco imports this deep path; pin it for Rolldown
      'monaco-editor/esm/vs/editor/editor.api.js': path.resolve(
        __dirname,
        'node_modules/monaco-editor/esm/vs/editor/editor.api.js',
      ),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3010,
    proxy: {
      // Prefer dedicated WS proxy first so Vite does not corrupt terminal frames.
      '/api/terminal/ws': {
        target: process.env.API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path,
      },
      '/api/lsp/ws': {
        target: process.env.API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path,
      },
      '/api': {
        // Docker: API_PROXY_TARGET=http://api-gateway:3000
        target: process.env.API_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    target: ['es2020', 'chrome90', 'firefox90', 'safari15', 'edge90'],
    chunkSizeWarningLimit: 1600,
    cssTarget: ['chrome90', 'firefox90', 'safari15', 'edge90'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: false,
    exclude: ['**/node_modules/**', '**/e2e/**', '**/dist/**'],
  },
});
