
import path from "node:path"
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
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Map esm.sh imports for Vite resolution
      "clsx": "https://esm.sh/clsx@2.1.1",
      "tailwind-merge": "https://esm.sh/tailwind-merge@3.3.1",
      "class-variance-authority": "https://esm.sh/class-variance-authority@0.7.1",
      "zod": "https://esm.sh/zod@3.25.67",
      "zustand": "https://esm.sh/zustand@5.0.2",
      "sonner": "https://esm.sh/sonner@2.0.6",
      "framer-motion": "https://esm.sh/framer-motion@12.23.0",
      "lucide-react": "https://esm.sh/lucide-react@0.525.0",
      "file-saver": "https://esm.sh/file-saver@2.0.5",
      "file-selector": "https://esm.sh/file-selector@0.6.0",
      "react-dropzone": "https://esm.sh/react-dropzone@14.3.8",
      "react-icons/fa6": "https://esm.sh/react-icons@5.5.0/fa6",
      "react-icons/hi": "https://esm.sh/react-icons@5.5.0/hi", 
      "react-icons/io5": "https://esm.sh/react-icons@5.5.0/io5"
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          three: ['three', '@react-three/fiber']
        }
      }
    }
  }
})
