import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import compression from 'vite-plugin-compression'

export default defineConfig({
  plugins: [
    vue(),
    // Emit precompressed .gz + .br alongside built assets.
    // Most static hosts (nginx, Cloudflare, Vercel) serve these automatically.
    compression({ algorithm: 'gzip', ext: '.gz', threshold: 1024 }),
    compression({ algorithm: 'brotliCompress', ext: '.br', threshold: 1024 })
  ],
  server: {
    host: '0.0.0.0',  // 同时监听 IPv4 + IPv6, 浏览器用 localhost 访问以复用 IndexedDB 地形缓存
    port: 5173,
    open: true
  },
  worker: {
    // TerrainWorker.js uses ES-module imports, so emit workers as ES modules.
    format: 'es'
  },
  build: {
    rollupOptions: {
      output: {
        // Split Three.js into its own chunk → cached across page reloads,
        // and not invalidated by app-code changes. Rolldown needs a function.
        manualChunks(id) {
          if (id.includes('node_modules/three/')) return 'three';
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})
