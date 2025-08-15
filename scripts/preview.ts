/**
 * Preview server script for Deno
 * Replaces npm run preview
 */

import { serve } from '@std/http/server'
import { join } from '@std/path'
import { exists } from '@std/fs'

const PORT = 4173
const DIST_ROOT = './dist'

async function serveFile(pathname: string): Promise<Response> {
  // Handle root requests
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html'
  }

  // Try to serve from dist directory
  const filePath = join(DIST_ROOT, pathname)
  if (await exists(filePath)) {
    const file = await Deno.readFile(filePath)
    const contentType = getContentType(pathname)
    return new Response(file, {
      headers: { 'Content-Type': contentType },
    })
  }

  // For SPA, return index.html for non-API routes
  if (!pathname.startsWith('/api') && !pathname.includes('.')) {
    const indexPath = join(DIST_ROOT, 'index.html')
    if (await exists(indexPath)) {
      const file = await Deno.readFile(indexPath)
      return new Response(file, {
        headers: { 'Content-Type': 'text/html' },
      })
    }
  }

  return new Response('Not Found', { status: 404 })
}

function getContentType(pathname: string): string {
  const ext = pathname.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'html':
      return 'text/html'
    case 'css':
      return 'text/css'
    case 'js':
      return 'application/javascript'
    case 'json':
      return 'application/json'
    case 'png':
      return 'image/png'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'svg':
      return 'image/svg+xml'
    case 'ico':
      return 'image/x-icon'
    case 'woff':
    case 'woff2':
      return 'font/woff2'
    default:
      return 'text/plain'
  }
}

async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const pathname = url.pathname

  return await serveFile(pathname)
}

console.log(`🔍 Preview server starting on http://localhost:${PORT}`)
console.log(`📁 Serving build files from ${DIST_ROOT}`)

await serve(handler, { port: PORT })
