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

  // Bundle main application
  console.log('📦 Bundling application...')

  const entryPoint = join(SRC_DIR, 'main.tsx')
  if (await exists(entryPoint)) {
    try {
      // Use Deno's built-in bundler
      const bundleResult = await new Deno.Command('deno', {
        args: [
          'bundle',
          entryPoint,
          join(DIST_DIR, 'assets', 'index.js'),
        ],
      }).output()

      if (!bundleResult.success) {
        console.error('❌ Bundle failed:')
        console.error(new TextDecoder().decode(bundleResult.stderr))
        Deno.exit(1)
      }
    } catch (error) {
      console.error('❌ Bundle error:', error)
      Deno.exit(1)
    }
  }

  // Create basic index.html if it doesn't exist
  const indexPath = join(DIST_DIR, 'index.html')
  if (!await exists(indexPath)) {
    console.log('📝 Creating index.html...')
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pokemon Save Editor</title>
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
</head>
<body>
    <div id="root"></div>
    <script type="module" src="/assets/index.js"></script>
</body>
</html>`
    await Deno.writeTextFile(indexPath, html)
  }

  console.log('✅ Build complete!')
  console.log(`📁 Output directory: ${DIST_DIR}`)
}

if (import.meta.main) {
  await build()
}
