/**
 * Integration tests for mGBA Lua HTTP server using simplified mGBA-compatible runner
 * This approach runs the actual http-server.lua code in a minimal mGBA environment
 * without complex mocking, addressing the user's request for a simpler approach
 */

import { spawn, ChildProcess } from 'child_process'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import WebSocket from 'ws'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('mGBA Lua HTTP Server - Simplified Runner Tests', () => {
  let serverProcess: ChildProcess | null = null
  let serverPort: number = 7350 + Math.floor(Math.random() * 50)
  let baseUrl: string

  beforeAll(async () => {
    const runnerPath = resolve(__dirname, 'mgba-runner.lua')
    
    serverProcess = spawn('lua5.3', [runnerPath, serverPort.toString()], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('mGBA runner start timeout')), 10000)
      
      serverProcess!.stdout?.on('data', (data) => {
        const output = data.toString()
        console.log('[mGBA Runner]', output.trim())
        
        if (output.includes('mGBA HTTP Server ready for testing!')) {
          clearTimeout(timeout)
          baseUrl = `http://127.0.0.1:${serverPort}`
          setTimeout(resolve, 500) // Give server time to be ready
        }
      })
      
      serverProcess!.stderr?.on('data', (data) => {
        console.error('[Runner Error]', data.toString())
      })
      
      serverProcess!.on('exit', (code) => {
        if (code !== 0) {
          clearTimeout(timeout)
          reject(new Error(`mGBA runner exited with code ${code}`))
        }
      })
    })
  })

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM')
      await new Promise(resolve => setTimeout(resolve, 1000))
      if (!serverProcess.killed) {
        serverProcess.kill('SIGKILL')
      }
    }
  })

  describe('HTTP Endpoints', () => {
    it('should handle GET / and return welcome message', async () => {
      const response = await fetch(`${baseUrl}/`)
      expect(response.status).toBe(200)
      
      const text = await response.text()
      expect(text).toContain('Welcome to mGBA HTTP Server')
    })

    it('should handle GET /json and return JSON with CORS headers', async () => {
      const response = await fetch(`${baseUrl}/json`)
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('application/json')
      expect(response.headers.get('access-control-allow-origin')).toBe('*')
      
      const json = await response.json()
      expect(json).toHaveProperty('message')
      expect(json).toHaveProperty('server')
    })

    it('should handle POST /echo and echo the request body', async () => {
      const testData = { test: 'echo data' }
      const response = await fetch(`${baseUrl}/echo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    })
  })

  describe('WebSocket Functionality', () => {
    it('should handle WebSocket handshake and send welcome message', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/ws`)
        const timeout = setTimeout(() => reject(new Error('WebSocket test timeout')), 5000)
        
        ws.on('open', () => {
          console.log('[Test] WebSocket connected')
        })
        
        ws.on('message', (data) => {
          const message = data.toString()
          console.log('[Test] WebSocket message:', message)
          
          if (message.includes('Welcome to WebSocket Eval')) {
            clearTimeout(timeout)
            ws.close()
            resolve()
          }
        })
        
        ws.on('error', (err) => {
          clearTimeout(timeout)
          reject(err)
        })
      })
    }, 8000)

    it('should handle WebSocket eval functionality', async () => {
      return new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/ws`)
        const timeout = setTimeout(() => reject(new Error('WebSocket eval timeout')), 8000)
        let messageCount = 0
        
        ws.on('message', (data) => {
          messageCount++
          const message = data.toString()
          console.log(`[Test] WebSocket message ${messageCount}:`, message)
          
          if (messageCount === 1 && message.includes('Welcome to WebSocket Eval')) {
            // Send Lua eval request
            console.log('[Test] Sending eval request: 1+1')
            ws.send('1+1')
          } else if (messageCount === 2) {
            // Should receive eval result
            try {
              const result = JSON.parse(message)
              console.log('[Test] Eval result:', result)
              expect(result).toHaveProperty('result', 2)
              clearTimeout(timeout)
              ws.close()
              resolve()
            } catch (e) {
              clearTimeout(timeout)
              reject(new Error(`Invalid eval response: ${message}`))
            }
          }
        })
        
        ws.on('error', (err) => {
          clearTimeout(timeout)
          reject(err)
        })
      })
    }, 10000)
  })
})