import MillionLint from '@million/lint';
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [MillionLint.vite({
    enabled: true
  }), react(), tailwindcss()],
})
