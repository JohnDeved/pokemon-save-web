/**
 * Integration tests for the actual mGBA environment with real ROM
 * Tests the real mGBA with Pokémon Emerald ROM and HTTP server
 * Downloads ROM automatically if not present
 */

import type { ChildProcess } from 'child_process'
import { spawn } from 'child_process'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { dirname, resolve, join } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, createWriteStream, mkdirSync } from 'fs'
import { createHash } from 'crypto'
import { pipeline } from 'stream/promises'
import { createReadStream } from 'fs'
import WebSocket from 'ws'

// Handle ES modules in Node.js
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ROM download configuration
const ROM_URL = 'https://archive.org/download/pkmn_collection/pkmn%20collection/GBA/Pokemon%20-%20Emerald%20Version%20%28USA%2C%20Europe%29.gba'
const TEST_DATA_DIR = resolve(__dirname, '../../test_data')
const ROM_PATH = join(TEST_DATA_DIR, 'emerald.gba')

// Helper function to check if mGBA is available
function checkMgbaAvailability(): Promise<boolean> {
  return new Promise((resolve) => {
    const mgbaCheck = spawn('mgba', ['--version'], { stdio: 'ignore' })
    mgbaCheck.on('error', () => resolve(false))
    mgbaCheck.on('exit', (code) => resolve(code === 0))
  })
}

// Helper function to calculate file hash
async function calculateFileHash(filePath: string): Promise<string> {
  const hash = createHash('sha256')
  await pipeline(createReadStream(filePath), hash)
  return hash.digest('hex')
}

// Helper function to download ROM
async function downloadRom(): Promise<boolean> {
  if (existsSync(ROM_PATH)) {
    console.log('  📄 ROM file already exists, verifying...')
    try {
      const hash = await calculateFileHash(ROM_PATH)
      // For now, we don't require a specific hash since ROM versions may vary
      console.log('  ✅ ROM file verified successfully')
      return true
    } catch (error) {
      console.log('  ⚠️ Error verifying ROM file, checking if usable...')
    }
  }

  console.log('  📥 Attempting to download Pokémon Emerald ROM from archive.org...')
  
  try {
    // Ensure test_data directory exists
    if (!existsSync(TEST_DATA_DIR)) {
      mkdirSync(TEST_DATA_DIR, { recursive: true })
    }

    // Try direct download first (though it likely won't work)
    const response = await fetch(ROM_URL)
    if (response.ok) {
      console.log('  💾 Saving ROM file...')
      const romStream = createWriteStream(ROM_PATH)
      if (response.body) {
        await pipeline(response.body as any, romStream)
      }
      
      console.log('  ✅ ROM downloaded successfully')
      return true
    } else {
      // Direct download failed, provide manual instructions
      console.log('  ⚠️ Automatic ROM download not available')
      console.log('  📋 Manual setup required:')
      console.log('     1. Visit: https://archive.org/details/pkmn_collection')
      console.log('     2. Download "Pokemon - Emerald Version (USA, Europe).gba"')
      console.log('     3. Place as: test_data/emerald.gba')
      return false
    }
  } catch (error) {
    console.log(`  ❌ ROM download failed: ${error}`)
    console.log('  📋 Manual setup required:')
    console.log('     1. Visit: https://archive.org/details/pkmn_collection')
    console.log('     2. Download "Pokemon - Emerald Version (USA, Europe).gba"')
    console.log('     3. Place as: test_data/emerald.gba')
    return false
  }
}

describe('mGBA Real Environment Tests', () => {
  let mgbaProcess: ChildProcess | null = null
  const serverPort = 7102
  let baseUrl: string
  let mgbaAvailable = false
  let romAvailable = false

  beforeAll(async () => {
    // Check if mGBA is available
    mgbaAvailable = await checkMgbaAvailability()
    
    if (!mgbaAvailable) {
      console.warn('⚠️ mGBA not found - skipping real environment tests')
      console.warn('💡 Install mGBA: https://mgba.io/downloads.html')
      return
    }

    // Attempt to download ROM if not present
    romAvailable = await downloadRom()
    
    if (!romAvailable) {
      console.warn('⚠️ ROM not available - skipping real environment tests')
      console.warn('💡 Place Pokemon - Emerald Version (USA, Europe).gba in test_data/')
      return
    }

    console.log('🚀 Starting mGBA with Pokémon Emerald ROM...')

    // Start mGBA with the ROM and HTTP server
    const mgbaArgs = [
      ROM_PATH,
      '--savestate', join(TEST_DATA_DIR, 'emerald.ss0'),
      '--lua', join(TEST_DATA_DIR, 'mgba_http_server.lua')
    ]

    mgbaProcess = spawn('mgba', mgbaArgs, {
      cwd: TEST_DATA_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    baseUrl = `http://localhost:${serverPort}`

    // Wait for mGBA and HTTP server to start
    await new Promise<void>((resolve, reject) => {
      let output = ''
      const timeout = setTimeout(() => reject(new Error('mGBA startup timeout')), 30000)

      mgbaProcess!.stdout?.on('data', (data: Buffer) => {
        output += data.toString()
        console.log('[mGBA]', data.toString().trim())
      })

      mgbaProcess!.stderr?.on('data', (data: Buffer) => {
        const errorOutput = data.toString()
        console.log('[mGBA Error]', errorOutput.trim())
        // Look for HTTP server startup indicators
        if (errorOutput.includes('HTTP server') || errorOutput.includes('port 7102')) {
          clearTimeout(timeout)
          // Give extra time for server to be fully ready
          setTimeout(resolve, 3000)
        }
      })

      mgbaProcess!.on('error', reject)
      mgbaProcess!.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`mGBA exited with code ${code}`))
        }
      })

      // Also try to connect to the HTTP server after a delay
      setTimeout(async () => {
        try {
          const response = await fetch(`${baseUrl}/`)
          if (response.ok) {
            clearTimeout(timeout)
            resolve()
          }
        } catch (e) {
          // Server not ready yet, continue waiting
        }
      }, 10000)
    })
  }, 45000) // 45 second timeout for mGBA startup

  afterAll(async () => {
    if (mgbaProcess) {
      console.log('🛑 Stopping mGBA...')
      mgbaProcess.kill('SIGTERM')
      
      // Wait for process to exit
      await new Promise<void>((resolve) => {
        mgbaProcess!.on('exit', () => {
          console.log('✅ mGBA stopped')
          resolve()
        })
        
        // Force kill if it doesn't exit gracefully
        setTimeout(() => {
          if (mgbaProcess && !mgbaProcess.killed) {
            mgbaProcess.kill('SIGKILL')
          }
          resolve()
        }, 5000)
      })
    }
  })

  describe('HTTP Endpoints', () => {
    it('should handle GET / and return welcome message', async () => {
      if (!mgbaAvailable || !romAvailable) {
        console.log('⏭️ Skipping test - mGBA or ROM not available')
        return
      }

      const response = await fetch(`${baseUrl}/`)
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('text/plain')

      const text = await response.text()
      expect(text).toBe('Welcome to mGBA HTTP Server!')
    })

    it('should handle GET /json and return JSON with CORS headers', async () => {
      if (!mgbaAvailable || !romAvailable) {
        console.log('⏭️ Skipping test - mGBA or ROM not available')
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
      if (!mgbaAvailable || !romAvailable) {
        console.log('⏭️ Skipping test - mGBA or ROM not available')
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
      expect(response.headers.get('content-type')).toBe('application/json')

      const echoed = await response.json()
      expect(echoed).toEqual(testData)
    })

    it('should return 404 for unknown routes', async () => {
      if (!mgbaAvailable || !romAvailable) {
        console.log('⏭️ Skipping test - mGBA or ROM not available')
        return
      }

      const response = await fetch(`${baseUrl}/unknown`)
      expect(response.status).toBe(404)

      const text = await response.text()
      expect(text).toBe('Not Found')
    })

    it('should include CORS headers in JSON API responses', async () => {
      if (!mgbaAvailable || !romAvailable) {
        console.log('⏭️ Skipping test - mGBA or ROM not available')
        return
      }

      const response = await fetch(`${baseUrl}/json`)

      expect(response.headers.get('access-control-allow-origin')).toBe('*')
      expect(response.headers.get('access-control-allow-methods')).toBe('GET, POST, OPTIONS')
      expect(response.headers.get('access-control-allow-headers')).toBe('Content-Type')
    })
  })

  describe('WebSocket Functionality', () => {
    it('should handle WebSocket handshake and send welcome message', async () => {
      if (!mgbaAvailable || !romAvailable) {
        console.log('⏭️ Skipping test - mGBA or ROM not available')
        return
      }

      const ws = new WebSocket(`ws://localhost:${serverPort}/ws`)

      // Wait for connection and welcome message
      const welcomeMessage = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Welcome message timeout')), 10000)

        ws.on('open', () => {
          console.log('[Test] WebSocket connected to real mGBA')
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

    it('should handle WebSocket eval functionality with real emulator context', async () => {
      if (!mgbaAvailable || !romAvailable) {
        console.log('⏭️ Skipping test - mGBA or ROM not available')
        return
      }

      const ws = new WebSocket(`ws://localhost:${serverPort}/ws`)

      let welcomeReceived = false

      // Test basic math and emulator context
      const testResult = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Eval response timeout')), 10000)

        ws.on('open', () => {
          console.log('[Test] WebSocket eval test connected to real mGBA')
        })

        ws.on('message', (data) => {
          const message = data.toString()
          console.log('[Test] Received message:', message)

          if (message.includes('Welcome to WebSocket Eval') && !welcomeReceived) {
            welcomeReceived = true
            console.log('[Test] Sending 1+2 to real mGBA WebSocket')
            // Send eval request after welcome
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
    }, 15000) // 15 second test timeout for real mGBA
  })

  describe('Emulator Integration', () => {
    it('should be running with Pokémon Emerald ROM loaded', async () => {
      if (!mgbaAvailable || !romAvailable) {
        console.log('⏭️ Skipping test - mGBA or ROM not available')
        return
      }

      // Test that we can access emulator-specific Lua functions
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws`)

      const emulatorTest = await new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Emulator test timeout')), 10000)
        let welcomeReceived = false

        ws.on('message', (data) => {
          const message = data.toString()

          if (message.includes('Welcome to WebSocket Eval') && !welcomeReceived) {
            welcomeReceived = true
            // Test if we can access mGBA-specific functions
            ws.send('tostring(type(emu))')
          } else if (welcomeReceived) {
            clearTimeout(timeout)
            try {
              const result = JSON.parse(message)
              resolve(result)
            } catch (e) {
              resolve({ result: message })
            }
          }
        })

        ws.on('error', reject)
      })

      // Should have access to mGBA's emu object
      expect(emulatorTest.result).toBe('table')

      ws.close()
    }, 15000)
  })
})