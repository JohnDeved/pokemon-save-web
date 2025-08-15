/**
 * Build script for Deno
 * Replaces npm run build
 */

import { join } from '@std/path'
import { copy, ensureDir, exists } from '@std/fs'

const DIST_DIR = './dist'
const PUBLIC_DIR = './public'
const SRC_DIR = './src'

async function build() {
  console.log('🏗️  Building for production...')

  // Clean and create dist directory
  try {
    await Deno.remove(DIST_DIR, { recursive: true })
  } catch {
    // Directory doesn't exist, that's fine
  }
  await ensureDir(DIST_DIR)

  // Copy public files to dist
  console.log('📁 Copying public files...')
  if (await exists(PUBLIC_DIR)) {
    await copy(PUBLIC_DIR, DIST_DIR, { overwrite: true })
  }

  // For development: copy source files and create import map
  console.log("📦 Setting up development build...")
  
  // Copy source files to dist
  await copy(SRC_DIR, join(DIST_DIR, "src"), { overwrite: true })
  
  // Create import map for the browser
  const importMap = {
    "imports": {
      "react": "https://esm.sh/react@19.1.0",
      "react-dom/client": "https://esm.sh/react-dom@19.1.0/client",
      "@tanstack/react-query": "https://esm.sh/@tanstack/react-query@5.81.5",
      "@radix-ui/react-menubar": "https://esm.sh/@radix-ui/react-menubar@1.1.15",
      "@radix-ui/react-select": "https://esm.sh/@radix-ui/react-select@2.2.5",
      "@radix-ui/react-slider": "https://esm.sh/@radix-ui/react-slider@1.3.5",
      "@radix-ui/react-slot": "https://esm.sh/@radix-ui/react-slot@1.2.3",
      "@radix-ui/react-tooltip": "https://esm.sh/@radix-ui/react-tooltip@1.2.7",
      "lucide-react": "https://esm.sh/lucide-react@0.525.0",
      "react-dropzone": "https://esm.sh/react-dropzone@14.3.8",
      "sonner": "https://esm.sh/sonner@2.0.6",
      "next-themes": "https://esm.sh/next-themes@0.4.6",
      "clsx": "https://esm.sh/clsx@2.1.1",
      "class-variance-authority": "https://esm.sh/class-variance-authority@0.7.1",
      "tailwind-merge": "https://esm.sh/tailwind-merge@3.3.1"
    }
  }
  
  await Deno.writeTextFile(join(DIST_DIR, "importmap.json"), JSON.stringify(importMap, null, 2))

  // Create index.html with import map
  const indexPath = join(DIST_DIR, 'index.html')
  console.log('📝 Creating index.html...')
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pokemon Save Editor</title>
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <script type="importmap" src="/importmap.json"></script>
    <style>
      /* Basic reset and loading styles */
      *, *::before, *::after { box-sizing: border-box; }
      body { margin: 0; font-family: system-ui, sans-serif; background: #0f172a; color: white; }
      #root { min-height: 100vh; }
      .loading { display: flex; align-items: center; justify-content: center; height: 100vh; font-size: 1.2em; }
    </style>
</head>
<body>
    <div id="root">
      <div class="loading">Loading Pokemon Save Editor...</div>
    </div>
    <script type="module" src="/src/main.tsx"></script>
</body>
</html>`
  await Deno.writeTextFile(indexPath, html)

  console.log('✅ Build complete!')
  console.log(`📁 Output directory: ${DIST_DIR}`)
}

if (import.meta.main) {
  await build()
}
