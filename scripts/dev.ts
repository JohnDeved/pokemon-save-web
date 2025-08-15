/**
 * Development server script for Deno
 * Replaces npm run dev
 */

import { serve } from '@std/http/server'
import { join } from '@std/path'
import { exists } from '@std/fs'

const PORT = 5173
const STATIC_ROOT = './public'
const SRC_ROOT = './src'

async function serveFile(pathname: string): Promise<Response> {
  // Handle root requests
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html'
  }

  // Try to serve from public directory first
  const publicPath = join(STATIC_ROOT, pathname)
  if (await exists(publicPath)) {
    const file = await Deno.readFile(publicPath)
    const contentType = getContentType(pathname)
    return new Response(file, {
      headers: { 'Content-Type': contentType },
    })
  }

  // For SPA, return index.html for non-API routes
  if (!pathname.startsWith('/api') && !pathname.includes('.')) {
    const indexPath = join(STATIC_ROOT, 'index.html')
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

  // Add CORS headers for development
  const headers = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers })
  }

  const response = await serveFile(pathname)

  // Add CORS headers to response
  for (const [key, value] of headers) {
    response.headers.set(key, value)
  }

  return response
}

console.log(`🚀 Development server starting on http://localhost:${PORT}`)
console.log(`📁 Serving static files from ${STATIC_ROOT}`)
console.log(`📦 Source files in ${SRC_ROOT}`)

await serve(handler, { port: PORT })
