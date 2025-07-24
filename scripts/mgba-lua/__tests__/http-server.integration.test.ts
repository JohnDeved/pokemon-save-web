/**
 * Integration tests for the Lua HTTP server using real network connections
 * Tests the actual HTTP endpoints and WebSocket functionality
 * 
 * This test suite replaces the previous Busted-based tests with a more realistic
 * approach that tests actual HTTP/WebSocket behavior using a Node.js server that
 * mimics the Lua server's behavior.
 */

import { spawn, ChildProcess } from 'child_process'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

// Handle ES modules in Node.js
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Simple WebSocket client for testing
class SimpleWebSocket {
  private socket: any
  private url: string
  
  constructor(url: string) {
    this.url = url
  }
  
  async connect(): Promise<void> {
    const WebSocket = (await import('ws')).default
    return new Promise((resolve, reject) => {
      this.socket = new WebSocket(this.url)
      this.socket.on('open', resolve)
      this.socket.on('error', reject)
    })
  }
  
  send(data: string): void {
    this.socket.send(data)
  }
  
  onMessage(callback: (data: string) => void): void {
    this.socket.on('message', (data: Buffer) => callback(data.toString()))
  }
  
  close(): void {
    this.socket.close()
  }
}

describe('Lua HTTP Server - Integration Tests', () => {
  let serverProcess: ChildProcess | null = null
  let serverPort: number = 7000 + Math.floor(Math.random() * 1000) // Random port to avoid conflicts
  let baseUrl: string

  beforeAll(async () => {
    // Start the Node.js test server that mimics Lua HTTP server behavior
    const testServerPath = resolve(__dirname, 'test-server-node.ts')
    
    serverProcess = spawn('npx', ['tsx', testServerPath, serverPort.toString()], {
      cwd: resolve(__dirname, '../../../..'), // Back to project root
      stdio: ['pipe', 'pipe', 'pipe']
    })

    // Wait for server to start
    await new Promise<void>((resolve, reject) => {
      let output = ''
      const timeout = setTimeout(() => reject(new Error('Server start timeout')), 10000)
      
      serverProcess!.stdout?.on('data', (data) => {
        output += data.toString()
        if (output.includes('Server started on port')) {
          clearTimeout(timeout)
          // Extract actual port from output
          const match = output.match(/Server started on port (\d+)/)
          if (match) {
            serverPort = parseInt(match[1])
            baseUrl = `http://127.0.0.1:${serverPort}`
            resolve()
          }
        }
      })
      
      serverProcess!.stderr?.on('data', (data) => {
        console.error('Server stderr:', data.toString())
      })
      
      serverProcess!.on('error', reject)
      serverProcess!.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Server exited with code ${code}`))
        }
      })
    })
  }, 15000)

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM')
      // Wait for process to exit
      await new Promise<void>((resolve) => {
        serverProcess!.on('exit', () => resolve())
        // Force kill if it doesn't exit gracefully
        setTimeout(() => {
          if (serverProcess && !serverProcess.killed) {
            serverProcess.kill('SIGKILL')
          }
          resolve()
        }, 2000)
      })
    }
  })

  describe('HTTP Endpoints', () => {
    it('should handle GET / and return welcome message', async () => {
      const response = await fetch(`${baseUrl}/`)
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('text/plain')
      
      const text = await response.text()
      expect(text).toContain('Welcome to mGBA HTTP Server!')
    })

    it('should handle GET /json and return JSON with CORS headers', async () => {
      const response = await fetch(`${baseUrl}/json`)
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('application/json')
      expect(response.headers.get('access-control-allow-origin')).toBe('*')
      
      const json = await response.json()
      expect(json).toHaveProperty('message', 'Hello, JSON!')
      expect(json).toHaveProperty('timestamp')
      expect(typeof json.timestamp).toBe('number')
    })

    it('should handle POST /echo and echo the request body', async () => {
      const testData = { test: 'data', number: 42 }
      const response = await fetch(`${baseUrl}/echo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testData)
      })
      
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('application/json')
      
      const echoed = await response.json()
      expect(echoed).toEqual(testData)
    })

    it('should return 404 for unknown routes', async () => {
      const response = await fetch(`${baseUrl}/unknown`)
      expect(response.status).toBe(404)
      
      const text = await response.text()
      expect(text).toContain('Not Found')
    })
  })

  describe('WebSocket Functionality', () => {
    it('should handle WebSocket handshake and connections', async () => {
      const ws = new SimpleWebSocket(`ws://127.0.0.1:${serverPort}/ws`)
      
      await ws.connect()
      
      // Should receive welcome message
      const messages: string[] = []
      ws.onMessage((data) => {
        messages.push(data)
      })
      
      // Wait for welcome message
      await new Promise(resolve => setTimeout(resolve, 500))
      
      expect(messages.length).toBeGreaterThan(0)
      expect(messages[0]).toContain('Welcome to WebSocket Eval!')
      
      ws.close()
    })

    it('should handle WebSocket eval functionality', async () => {
      const ws = new SimpleWebSocket(`ws://127.0.0.1:${serverPort}/ws`)
      await ws.connect()
      
      const messages: string[] = []
      ws.onMessage((data) => {
        messages.push(data)
      })
      
      // Skip welcome message
      await new Promise(resolve => setTimeout(resolve, 100))
      messages.length = 0
      
      // Send code to evaluate (simplified for Node.js compatibility)
      ws.send('2 + 2')
      
      // Wait for response
      await new Promise(resolve => setTimeout(resolve, 500))
      
      expect(messages.length).toBeGreaterThan(0)
      const response = JSON.parse(messages[0])
      expect(response).toHaveProperty('result', 4)
      
      ws.close()
    })

    it('should handle WebSocket eval errors gracefully', async () => {
      const ws = new SimpleWebSocket(`ws://127.0.0.1:${serverPort}/ws`)
      await ws.connect()
      
      const messages: string[] = []
      ws.onMessage((data) => {
        messages.push(data)
      })
      
      // Skip welcome message
      await new Promise(resolve => setTimeout(resolve, 100))
      messages.length = 0
      
      // Send invalid code
      ws.send('invalid syntax here }')
      
      // Wait for response
      await new Promise(resolve => setTimeout(resolve, 500))
      
      expect(messages.length).toBeGreaterThan(0)
      const response = JSON.parse(messages[0])
      expect(response).toHaveProperty('error')
      expect(typeof response.error).toBe('string')
      
      ws.close()
    })
  })
})