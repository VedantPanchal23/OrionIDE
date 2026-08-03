import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    exclude: ['node_modules', 'e2e', 'dist'],
  },
  server: {
    port: 3010,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
        // Avoid buffering upgrades; required for terminal PTY
        configure: (proxy) => {
          proxy.on('proxyReqWs', (_proxyReq, _req, socket) => {
            socket.on('error', () => {});
          });
        },
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // React core — tiny, always needed first
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react-core';
          }
          // Monaco Editor — largest chunk (~400 kB); lazy-loaded on editor open
          if (id.includes('node_modules/@monaco-editor') || id.includes('node_modules/monaco-editor')) {
            return 'monaco-editor';
          }
          // xterm.js — only needed when terminal tab is opened
          if (id.includes('node_modules/@xterm') || id.includes('node_modules/xterm')) {
            return 'xterm';
          }
          // Lucide icons — tree-shaken but still non-trivial
          if (id.includes('node_modules/lucide-react')) {
            return 'lucide';
          }
          // All other node_modules go into a general vendor chunk
          if (id.includes('node_modules/')) {
            return 'vendor';
          }
        },
      },
    },
  },
})
