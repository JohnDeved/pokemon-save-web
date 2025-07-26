
import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ['babel-plugin-react-compiler'], // must run first!
      },
    }),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'safari-pinned-tab.svg'],
      manifest: {
        name: 'Pokemon Save Editor',
        short_name: 'PokeSave',
        description: 'A powerful web-based Pokemon save file editor for various Pokemon games and ROM hacks',
        theme_color: '#1e293b',
        background_color: '#000000',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 3000000,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log'],
        passes: 2
      },
      mangle: {
        safari10: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Keep React core small and fast
          vendor: ['react', 'react-dom'],
          // UI components in separate chunk
          ui: ['@radix-ui/react-menubar', '@radix-ui/react-select', '@radix-ui/react-slider', '@radix-ui/react-slot', '@radix-ui/react-tooltip'],
          // Heavy 3D graphics - lazy loaded
          three: ['three', '@react-three/fiber'],
          // Utility libraries
          utils: ['clsx', 'tailwind-merge', 'class-variance-authority'],
          // Animation library separate for conditional loading
          motion: ['framer-motion'],
          // File handling utilities
          fileHandling: ['file-saver', 'react-dropzone', 'file-selector']
        }
      }
    },
    sourcemap: false, // Disable source maps in production for smaller bundle
    chunkSizeWarningLimit: 800, // Lower threshold to catch large chunks
    cssCodeSplit: true, // Enable CSS code splitting
    reportCompressedSize: true,
    // Optimize chunk loading
    assetsInlineLimit: 4096 // Inline small assets as base64
  }
})
