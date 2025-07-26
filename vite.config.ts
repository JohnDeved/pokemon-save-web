
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
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/offline.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/sw\.js$/],
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
              cacheName: 'google-fonts-static-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          }
        ]
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'safari-pinned-tab.svg', 'offline.html'],
      manifest: {
        name: 'Pokemon Save Editor',
        short_name: 'PokeSave',
        description: 'A powerful web-based Pokemon save file editor for various Pokemon games and ROM hacks',
        theme_color: '#1e293b',
        background_color: '#000000',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait-primary',
        categories: ['games', 'utilities', 'productivity'],
        lang: 'en',
        shortcuts: [
          {
            name: 'Open Save File',
            short_name: 'Open',
            description: 'Upload and edit a Pokemon save file',
            url: '/?action=open',
            icons: [{ src: '/pwa-192x192.png', sizes: '192x192' }]
          }
        ],
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
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-menubar', '@radix-ui/react-select', '@radix-ui/react-slider', '@radix-ui/react-slot', '@radix-ui/react-tooltip'],
          three: ['three', '@react-three/fiber'],
          utils: ['clsx', 'tailwind-merge', 'class-variance-authority']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
})
