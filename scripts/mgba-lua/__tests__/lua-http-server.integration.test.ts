/**
 * Integration tests for the actual mGBA Lua HTTP server using virtual mGBA environment
 * Tests the real http-server.lua code by running it in a mocked mGBA environment
 * and making real HTTP/WebSocket connections to it
 */

import { spawn, type ChildProcess } from 'child_process'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import WebSocket from 'ws'

// Handle ES modules in Node.js
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Helper function to check if Lua is available
function checkLuaAvailability(): Promise<boolean> {
  return new Promise(resolve => {
    const luaCheck = spawn('lua', ['-v'], { stdio: 'ignore' })
    luaCheck.on('error', () => resolve(false))
    luaCheck.on('exit', code => resolve(code === 0))
  })
}

describe('mGBA Lua HTTP Server - Virtual Environment Tests', () => {
  let serverProcess: ChildProcess | null = null
  const serverPort: number = 7300 + Math.floor(Math.random() * 100) // Random port to avoid conflicts
  let baseUrl: string
  let luaAvailable = false

  beforeAll(async () => {
    // Check if Lua is available
    luaAvailable = await checkLuaAvailability()

    if (!luaAvailable) {
      console.warn('⚠️ Lua not found - skipping Lua integration tests')
      return
    }

    // Start the actual mGBA HTTP server using our simplified virtual environment
    const mgbaEnvPath = resolve(__dirname, 'mgba-env-mock.lua')

    serverProcess = spawn('lua', [mgbaEnvPath, serverPort.toString()], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    // Wait for server to start
    await new Promise<void>((resolve, reject) => {
      let output = ''
      const timeout = setTimeout(() => reject(new Error('mGBA HTTP server start timeout')), 15000)

      serverProcess!.stdout?.on('data', (data: Buffer) => {
        output += data.toString()
        console.log('[mGBA Server]', data.toString().trim())
        // Look for the server startup message
        if (output.includes('🚀 mGBA HTTP Server started on port') || output.includes('HTTP server loaded successfully')) {
          clearTimeout(timeout)
          baseUrl = `http://127.0.0.1:${serverPort}`
          // Give the server time to be fully ready
          setTimeout(resolve, 1500)
        }
      })

      serverProcess!.stderr?.on('data', (data: Buffer) => {
        console.error('[Lua Server Error]', data.toString())
      })

      serverProcess!.on('error', reject)
      serverProcess!.on('exit', code => {
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
      await new Promise<void>(resolve => {
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
      if (!luaAvailable) {
        console.log('⏭️ Skipping test - Lua not available')
        return
      }

      const response = await fetch(`${baseUrl}/`)
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('text/plain')
      // Note: GET / route does not have CORS middleware in the server code

      const text = await response.text()
      expect(text).toContain('Welcome to mGBA HTTP Server!')
    })

    it('should handle GET /json and return JSON with CORS headers', async () => {
      if (!luaAvailable) {
        console.log('⏭️ Skipping test - Lua not available')
        return
      }

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
      if (!luaAvailable) {
        console.log('⏭️ Skipping test - Lua not available')
        return
      }

      const testData = { test: 'data', number: 42 }
      const response = await fetch(`${baseUrl}/echo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData),
      })

      expect(response.status).toBe(200)

      // The echo endpoint should return the request body with the same content-type
      expect(response.headers.get('content-type')).toBe('application/json')

      const echoed = await response.json()
      expect(echoed).toEqual(testData)
    })

    it('should return 404 for unknown routes', async () => {
      if (!luaAvailable) {
        console.log('⏭️ Skipping test - Lua not available')
        return
      }

      const response = await fetch(`${baseUrl}/unknown`)
      expect(response.status).toBe(404)

      const text = await response.text()
      expect(text).toBe('Not Found')
    })

    it('should include CORS headers in JSON API responses', async () => {
      if (!luaAvailable) {
        console.log('⏭️ Skipping test - Lua not available')
        return
      }

      // Only the /json endpoint has CORS middleware in the server code
      const response = await fetch(`${baseUrl}/json`)

      expect(response.headers.get('access-control-allow-origin')).toBe('*')
      expect(response.headers.get('access-control-allow-methods')).toBe('GET, POST, OPTIONS')
      expect(response.headers.get('access-control-allow-headers')).toBe('Content-Type')
    })
  })

  describe('WebSocket Functionality', () => {
    it('should handle WebSocket handshake and send welcome message', async () => {
      if (!luaAvailable) {
        console.log('⏭️ Skipping test - Lua not available')
        return
      }

      const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/ws`)

      // Wait for connection and welcome message
      const welcomeMessage = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Welcome message timeout')), 5000)

        ws.on('open', () => {
          console.log('[Test] WebSocket connected')
        })

        ws.on('message', data => {
          clearTimeout(timeout)
          resolve(data.toString())
        })

        ws.on('error', reject)
      })

      expect(welcomeMessage).toBe('Welcome to WebSocket Eval! Send Lua code to execute.')

      ws.close()
    })

    it('should handle WebSocket eval functionality', async () => {
      if (!luaAvailable) {
        console.log('⏭️ Skipping test - Lua not available')
        return
      }

      const ws = new WebSocket(`ws://127.0.0.1:${serverPort}/ws`)

      let welcomeReceived = false

      // Combined promise to handle both welcome and eval response
      const testResult = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Eval response timeout')), 5000)

        ws.on('open', () => {
          console.log('[Test] WebSocket eval test connected')
        })

        ws.on('message', data => {
          const message = data.toString()
          console.log('[Test] Received message:', message)

          if (message.includes('Welcome to WebSocket Eval') && !welcomeReceived) {
            welcomeReceived = true
            console.log('[Test] Sending 1+1 to WebSocket')
            // Send eval request immediately after welcome
            ws.send('1+2')
          } else if (welcomeReceived && !message.includes('Welcome to WebSocket Eval')) {
            // This should be our eval response
            clearTimeout(timeout)
            resolve(message)
          }
        })

        ws.on('error', (err: Error) => {
          console.log('[Test] WebSocket error:', err.message)
          reject(err)
        })
      })

      // Parse and verify the eval result
      const result = JSON.parse(testResult)
      expect(result).toHaveProperty('result', 3)

      ws.close()
    }, 8000) // 8 second test timeout
  })
})
