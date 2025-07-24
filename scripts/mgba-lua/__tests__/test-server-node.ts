/**
 * Node.js test server that mimics the Lua HTTP server behavior
 * Used for integration testing the HTTP endpoints and WebSocket functionality
 */

import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { URL } from 'url'

// Configuration
const PORT = parseInt(process.argv[2]) || 7109

// JSON response matching Lua server format
const jsonStringify = (obj: any): string => {
  return JSON.stringify(obj)
}

// HTTP request handler that mimics the Lua server routes
const httpHandler = (req: any, res: any) => {
  const url = new URL(req.url!, `http://${req.headers.host}`)
  const method = req.method
  const path = url.pathname

  console.log(`[LOG] ${method} ${path}`)

  // Add CORS headers for JSON endpoint
  const setCorsHeaders = () => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  }

  // Route handling matching the Lua server
  if (method === 'GET' && path === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('Welcome to mGBA HTTP Server!')
  } else if (method === 'GET' && path === '/json') {
    setCorsHeaders()
    res.writeHead(200, { 'Content-Type': 'application/json' })
    const jsonResponse = jsonStringify({
      message: 'Hello, JSON!',
      timestamp: Math.floor(Date.now() / 1000)
    })
    res.end(jsonResponse)
  } else if (method === 'POST' && path === '/echo') {
    let body = ''
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString()
    })
    
    req.on('end', () => {
      const contentType = req.headers['content-type'] || 'text/plain'
      
      // If it's JSON, parse and re-encode to match Lua behavior
      if (contentType.includes('application/json')) {
        try {
          const parsed = JSON.parse(body)
          const encoded = jsonStringify(parsed)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(encoded)
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'text/plain' })
          res.end('Invalid JSON')
        }
      } else {
        res.writeHead(200, { 'Content-Type': contentType })
        res.end(body)
      }
    })
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not Found')
  }
}

// Create HTTP server
const server = createServer(httpHandler)

// Create WebSocket server that mimics Lua server WebSocket behavior
const wss = new WebSocketServer({ 
  server,
  path: '/ws'
})

wss.on('connection', (ws) => {
  console.log('[LOG] WebSocket connected: /ws')
  
  // Send welcome message like the Lua server
  ws.send('Welcome to WebSocket Eval! Send Lua code to execute.')
  
  ws.on('message', (data) => {
    const code = data.toString()
    console.log('[LOG] WebSocket eval request: ' + code)
    
    try {
      // Simulate Lua evaluation by evaluating simple JavaScript expressions
      // This is a simplified version for testing purposes
      let chunk = code.trim()
      
      // Convert simple Lua-like expressions to JavaScript
      if (!chunk.match(/^(return|var|let|const|function)/)) {
        chunk = `return ${chunk}`
      }
      
      // Simple evaluation for basic expressions
      const result = new Function(chunk.replace(/^return /, 'return '))()
      
      const response = jsonStringify({ result })
      ws.send(response)
    } catch (error) {
      const response = jsonStringify({ 
        error: error instanceof Error ? error.message : String(error)
      })
      ws.send(response)
    }
  })
  
  ws.on('close', () => {
    console.log('[LOG] WebSocket disconnected: /ws')
  })
  
  ws.on('error', (error) => {
    console.log('[ERROR] WebSocket error:', error)
  })
})

// Start server
server.listen(PORT, '127.0.0.1', () => {
  console.log(`[LOG] 🚀 Test HTTP Server started on port ${PORT}`)
  console.log(`[LOG] Server started on port ${PORT}`)  // For test detection
}).on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`[LOG] Port ${PORT} in use, trying ${PORT + 1}`)
    // Try next port
    server.listen(PORT + 1, '127.0.0.1', () => {
      console.log(`[LOG] 🚀 Test HTTP Server started on port ${PORT + 1}`)
      console.log(`[LOG] Server started on port ${PORT + 1}`)  // For test detection
    })
  } else {
    throw err
  }
})

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  console.log('[LOG] Shutting down server...')
  server.close()
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('[LOG] Shutting down server...')
  server.close()
  process.exit(0)
})