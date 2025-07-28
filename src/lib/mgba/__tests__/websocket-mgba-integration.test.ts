/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/**
 * Integration tests for mGBA WebSocket connectivity and memory watching
 * These tests start the actual mGBA Docker container and test real functionality
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { ChildProcess } from 'child_process'
import { spawn } from 'child_process'
import { MgbaWebSocketClient } from '../websocket-client.js'

// Test configuration
const MGBA_STARTUP_TIMEOUT = 30000 // 30 seconds
const TEST_TIMEOUT = 60000 // 60 seconds per test
const WEBSOCKET_URL = 'ws://localhost:7102'

describe('mGBA WebSocket Integration Tests', () => {
  let mgbaProcess: ChildProcess | null = null
  let client: MgbaWebSocketClient

  beforeAll(async () => {
    console.log('🚀 Starting mGBA Docker container for integration tests...')

    // Start mGBA Docker container
    mgbaProcess = spawn('npm', ['run', 'mgba', '--', 'run', '--game', 'emerald'], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true,
    })

    // Wait for mGBA to start up
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('mGBA startup timeout'))
      }, MGBA_STARTUP_TIMEOUT)

      let output = ''

      if (mgbaProcess?.stdout) {
        mgbaProcess.stdout.on('data', (data) => {
          output += data.toString()
          console.log('mGBA stdout:', data.toString().trim())

          // Check for server ready indicators
          if (output.includes('Server started') || output.includes('listening on port 7102')) {
            clearTimeout(timeout)
            console.log('✅ mGBA Docker container ready')
            resolve()
          }
        })
      }

      if (mgbaProcess?.stderr) {
        mgbaProcess.stderr.on('data', (data) => {
          console.log('mGBA stderr:', data.toString().trim())
        })
      }

      mgbaProcess?.on('error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })

      mgbaProcess?.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          clearTimeout(timeout)
          reject(new Error(`mGBA process exited with code ${code}`))
        }
      })

      // Give it some time to start, then try connecting
      setTimeout(() => {
        console.log('⏳ Attempting early connection test...')
        const testClient = new MgbaWebSocketClient(WEBSOCKET_URL)

        testClient.connect()
          .then(() => {
            console.log('🎯 Early connection successful!')
            clearTimeout(timeout)
            resolve()
          })
          .catch((error) => {
            console.log('⏳ Early connection failed, waiting longer...', error.message)
            // Continue waiting for the timeout
          })
      }, 10000) // Try after 10 seconds
    })

    // Add extra delay to ensure stability
    await new Promise(resolve => setTimeout(resolve, 5000))
  }, MGBA_STARTUP_TIMEOUT + 10000)

  afterAll(async () => {
    console.log('🧹 Cleaning up mGBA Docker container...')

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (client) {
      try {
        client.disconnect()
      } catch (error) {
        console.log('Client disconnect error (expected):', error)
      }
    }

    if (mgbaProcess) {
      // Try graceful shutdown first
      mgbaProcess.kill('SIGTERM')

      // Wait a bit, then force kill if needed
      await new Promise(resolve => setTimeout(resolve, 3000))

      if (!mgbaProcess.killed) {
        mgbaProcess.kill('SIGKILL')
      }

      // Kill the entire process group to ensure Docker container stops
      try {
        if (mgbaProcess.pid) {
          process.kill(-mgbaProcess.pid, 'SIGKILL')
        }
      } catch (error) {
        console.log('Process cleanup error (expected):', error)
      }
    }

    console.log('✅ Cleanup completed')
  })

  it('should connect to both /eval and /watch WebSocket endpoints', async () => {
    client = new MgbaWebSocketClient(WEBSOCKET_URL)

    // Test connection
    await expect(client.connect()).resolves.toBeUndefined()

    // Verify both endpoints are connected
    expect(client.isConnected()).toBe(true)

    console.log('✅ Successfully connected to both WebSocket endpoints')
  }, TEST_TIMEOUT)

  it('should execute Lua code via eval endpoint', async () => {
    if (!client) {
      client = new MgbaWebSocketClient(WEBSOCKET_URL)
      await client.connect()
    }

    // Test basic Lua evaluation
    const result = await client.eval('return 42')
    expect(result.result).toBe(42)

    // Test memory reading
    const memoryResult = await client.eval('return emu:read8(0x02000000)')
    expect(typeof memoryResult.result).toBe('number')

    console.log('✅ Lua code execution working correctly')
  }, TEST_TIMEOUT)

  it('should start memory watching and receive confirmations', async () => {
    if (!client) {
      client = new MgbaWebSocketClient(WEBSOCKET_URL)
      await client.connect()
    }

    // Configure shared buffer with test regions
    client.configureSharedBuffer({
      maxCacheSize: 50,
      cacheTimeout: 100,
      preloadRegions: [
        { address: 0x20244e9, size: 7 }, // Party count + context
        { address: 0x20244ec, size: 600 }, // Party data
      ],
    })

    // Start watching and verify confirmation
    await expect(client.startWatchingPreloadRegions()).resolves.toBeUndefined()

    console.log('✅ Memory watching started successfully')
  }, TEST_TIMEOUT)

  it('should detect memory changes and trigger notifications', async () => {
    if (!client) {
      client = new MgbaWebSocketClient(WEBSOCKET_URL)
      await client.connect()

      client.configureSharedBuffer({
        maxCacheSize: 50,
        cacheTimeout: 100,
        preloadRegions: [
          { address: 0x20244e9, size: 7 },
        ],
      })

      await client.startWatchingPreloadRegions()
    }

    // Set up memory change listener
    const memoryChanges: Array<{ address: number, size: number, data: Uint8Array }> = []

    const listener = (address: number, size: number, data: Uint8Array) => {
      console.log(`🔔 Memory change detected: 0x${address.toString(16)}, size: ${size}`)
      memoryChanges.push({ address, size, data })
    }

    client.addMemoryChangeListener(listener)

    // Make some memory changes
    console.log('🧪 Making test memory changes...')

    // Change 1: Write to party count area
    await client.eval('emu:write8(0x020244e9, 3)')

    // Wait a bit for notification
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Change 2: Write to another part of the region
    await client.eval('emu:write8(0x020244ea, 42)')

    // Wait a bit more
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Change 3: Write outside the watched region (should not trigger)
    await client.eval('emu:write8(0x02000000, 99)')

    // Final wait
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Verify we got memory change notifications
    expect(memoryChanges.length).toBeGreaterThan(0)

    // All changes should be for the watched region
    for (const change of memoryChanges) {
      expect(change.address).toBe(0x20244e9)
      expect(change.size).toBe(7)
      expect(change.data).toBeInstanceOf(Uint8Array)
    }

    console.log(`✅ Detected ${memoryChanges.length} memory change(s) as expected`)

    // Cleanup listener
    client.removeMemoryChangeListener(listener)
  }, TEST_TIMEOUT)

  it('should handle CLI --websocket --watch mode without errors', async () => {
    // Test that the CLI can connect and start watching
    const { spawn } = await import('child_process')

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('CLI test timeout'))
      }, 20000)

      const cliProcess = spawn('npx', ['tsx', 'src/lib/parser/cli.ts', '--websocket', '--watch'], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      let output = ''
      let errorOutput = ''

      if (cliProcess.stdout) {
        cliProcess.stdout.on('data', (data) => {
          const text = data.toString()
          output += text
          console.log('CLI stdout:', text.trim())

          // Check for success indicators
          if (text.includes('✅ Connected successfully') &&
              text.includes('Memory watching started')) {
            clearTimeout(timeout)
            cliProcess.kill('SIGTERM')
            console.log('✅ CLI WebSocket watch mode working correctly')
            resolve()
          }
        })
      }

      if (cliProcess.stderr) {
        cliProcess.stderr.on('data', (data) => {
          errorOutput += data.toString()
          console.log('CLI stderr:', data.toString().trim())
        })
      }

      cliProcess.on('error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })

      cliProcess.on('exit', (code) => {
        clearTimeout(timeout)
        if (code !== 0 && code !== null && !output.includes('✅ Connected successfully')) {
          reject(new Error(`CLI process exited with code ${code}. Output: ${output}. Error: ${errorOutput}`))
        } else {
          resolve()
        }
      })
    })
  }, 30000)

  it('should prefer cached data for watched regions', async () => {
    if (!client) {
      client = new MgbaWebSocketClient(WEBSOCKET_URL)
      await client.connect()

      client.configureSharedBuffer({
        maxCacheSize: 50,
        cacheTimeout: 10000, // Long timeout for this test
        preloadRegions: [
          { address: 0x20244e9, size: 7 },
        ],
      })

      await client.startWatchingPreloadRegions()
    }

    // First read to populate cache
    const start1 = Date.now()
    const data1 = await client.getSharedBuffer(0x20244e9, 7)
    const time1 = Date.now() - start1

    // Second read should be from cache (much faster)
    const start2 = Date.now()
    const data2 = await client.getSharedBuffer(0x20244e9, 7)
    const time2 = Date.now() - start2

    // Verify data is the same
    expect(data1).toEqual(data2)

    // Cache read should be significantly faster (less than 10ms vs potentially 100ms+ for network)
    expect(time2).toBeLessThan(Math.max(10, time1 / 5))

    console.log(`✅ Cache optimization working: first read ${time1}ms, cached read ${time2}ms`)
  }, TEST_TIMEOUT)
})
