/**
 * Integration tests for the actual mGBA Lua HTTP server using virtual mGBA environment
 * Tests the real http-server.lua code by running it in a mocked mGBA environment
 * and making real HTTP/WebSocket connections to it
 */

import { spawn, ChildProcess } from 'child_process'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import WebSocket from 'ws'

// Handle ES modules in Node.js
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('mGBA Lua HTTP Server - Virtual Environment Tests', () => {
  let serverProcess: ChildProcess | null = null
  let serverPort: number = 7300 + Math.floor(Math.random() * 100) // Random port to avoid conflicts
  let baseUrl: string

  beforeAll(async () => {
    // Start the actual mGBA HTTP server using our virtual environment
    const mgbaEnvPath = resolve(__dirname, 'mgba-env-mock.lua')
    
    serverProcess = spawn('lua5.3', [mgbaEnvPath, serverPort.toString()], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    // Wait for server to start
    await new Promise<void>((resolve, reject) => {
      let output = ''
      const timeout = setTimeout(() => reject(new Error('mGBA HTTP server start timeout')), 15000)
      
      serverProcess!.stdout?.on('data', (data) => {
        output += data.toString()
        console.log('[mGBA Server]', data.toString().trim())
        // Look for any of the startup indicators
        if (output.includes('mGBA HTTP Server started on port') || 
            output.includes('HTTP server should now be running') ||
            output.includes('Listen successful, server should be ready')) {
          clearTimeout(timeout)
          baseUrl = `http://127.0.0.1:${serverPort}`
          resolve()
        }
      })
      
      serverProcess!.stderr?.on('data', (data) => {
        console.error('[Lua Server Error]', data.toString())
      })
      
      serverProcess!.on('error', reject)
      serverProcess!.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Lua server exited with code ${code}`))
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
      expect(response.headers.get('access-control-allow-origin')).toBe('*')
      
      const text = await response.text()
      expect(text).toBe('Welcome to mGBA HTTP Server!')
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
      expect(text).toBe('Not Found')
    })

    it('should include CORS headers in all responses', async () => {
      const responses = await Promise.all([
        fetch(`${baseUrl}/`),
        fetch(`${baseUrl}/json`),
        fetch(`${baseUrl}/echo`, { method: 'POST', body: '{}' })
      ])

      responses.forEach(response => {
        expect(response.headers.get('access-control-allow-origin')).toBe('*')
        expect(response.headers.get('access-control-allow-methods')).toBe('GET, POST, OPTIONS')
        expect(response.headers.get('access-control-allow-headers')).toBe('Content-Type')
      })
    })
  })

  describe('WebSocket Functionality', () => {
    it('should handle WebSocket handshake and send welcome message', async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/ws`)
      
      // Wait for connection and welcome message
      const welcomeMessage = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Welcome message timeout')), 5000)
        
        ws.on('open', () => {
          console.log('[Test] WebSocket connected')
        })
        
        ws.on('message', (data) => {
          clearTimeout(timeout)
          resolve(data.toString())
        })
        
        ws.on('error', reject)
      })
      
      expect(welcomeMessage).toBe('Welcome to WebSocket Eval! Send Lua code to execute.')
      
      ws.close()
    })
  })
})