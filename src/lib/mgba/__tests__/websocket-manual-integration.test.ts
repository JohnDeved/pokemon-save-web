/**
 * Manual integration test for memory watching functionality
 * Run this manually after starting mGBA Docker container:
 * npm run mgba -- run --game emerald
 */

import { describe, it, expect } from 'vitest'
import { MgbaWebSocketClient } from '../websocket-client.js'

// These tests require mGBA to be running manually
// Skip if no server is available
const WEBSOCKET_URL = 'ws://localhost:7102'
const TEST_TIMEOUT = 15000

let serverAvailable: boolean | undefined

async function checkServerAvailable(): Promise<boolean> {
  if (serverAvailable !== undefined) return serverAvailable
  
  try {
    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    await client.connect()
    await client.disconnect()
    serverAvailable = true
    return true
  } catch {
    serverAvailable = false
    return false
  }
}

describe('mGBA Memory Watching Integration (Manual)', () => {
  let client: MgbaWebSocketClient

  it('should connect to mGBA WebSocket server', async () => {
    const available = await checkServerAvailable()
    if (!available) {
      console.log('⏭️ Skipping test - mGBA server not running')
      return
    }
    
    client = new MgbaWebSocketClient(WEBSOCKET_URL)
    await expect(client.connect()).resolves.toBeUndefined()
    expect(client.isConnected()).toBe(true)
    console.log('✅ Successfully connected to mGBA server')
  }, TEST_TIMEOUT)

  it('should execute Lua eval commands', async () => {
    const available = await checkServerAvailable()
    if (!available) {
      console.log('⏭️ Skipping test - mGBA server not running')
      return
    }
    
    if (!client) {
      client = new MgbaWebSocketClient(WEBSOCKET_URL)
      await client.connect()
    }

    const result = await client.eval('return 42')
    expect(result.result).toBe(42)
    expect(result.error).toBeUndefined()
    
    console.log('✅ Lua eval functionality working')
  }, TEST_TIMEOUT)

  it('should start memory watching for Pokemon data', async () => {
    const available = await checkServerAvailable()
    if (!available) {
      console.log('⏭️ Skipping test - mGBA server not running')
      return
    }
    
    if (!client) {
      client = new MgbaWebSocketClient(WEBSOCKET_URL)
      await client.connect()
    }

    client.configureSharedBuffer({
      maxCacheSize: 50,
      cacheTimeout: 100,
      preloadRegions: [
        { address: 0x20244e9, size: 7 },   // Party count
        { address: 0x20244ec, size: 600 }  // Party data
      ]
    })

    await expect(client.startWatchingPreloadRegions()).resolves.toBeUndefined()
    console.log('✅ Memory watching started successfully')
  }, TEST_TIMEOUT)

  it('should detect memory changes when data is modified', async () => {
    const available = await checkServerAvailable()
    if (!available) {
      console.log('⏭️ Skipping test - mGBA server not running')
      return
    }
    
    if (!client) {
      client = new MgbaWebSocketClient(WEBSOCKET_URL)
      await client.connect()
      
      client.configureSharedBuffer({
        maxCacheSize: 50,
        cacheTimeout: 100,
        preloadRegions: [{ address: 0x20244e9, size: 7 }]
      })
      
      await client.startWatchingPreloadRegions()
    }

    // Track memory changes
    const changes: Array<{ address: number, size: number }> = []
    const listener = (address: number, size: number, data: Uint8Array) => {
      changes.push({ address, size })
      console.log(`🔔 Memory change detected: 0x${address.toString(16)}, size: ${size}`)
    }
    
    client.addMemoryChangeListener(listener)

    // Read initial state
    const initialData = await client.getSharedBuffer(0x20244e9, 7)
    console.log('Initial party data:', Array.from(initialData).map(b => b.toString()).join(','))

    // Make a memory change
    console.log('🧪 Making test memory change...')
    await client.eval('emu:write8(0x020244e9, 6)') // Change party count
    
    // Wait for notification
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Verify we got a notification
    expect(changes.length).toBeGreaterThan(0)
    expect(changes[0].address).toBe(0x20244e9)
    expect(changes[0].size).toBe(7)
    
    // Read new state to verify change
    const newData = await client.getSharedBuffer(0x20244e9, 7)
    console.log('New party data:', Array.from(newData).map(b => b.toString()).join(','))
    expect(newData[0]).toBe(6) // Should be the new value we wrote
    
    console.log(`✅ Memory watching detected ${changes.length} change(s)`)
    
    client.removeMemoryChangeListener(listener)
  }, TEST_TIMEOUT * 2)

  // Cleanup
  it('should disconnect cleanly', async () => {
    const available = await checkServerAvailable()
    if (!available) {
      console.log('⏭️ Skipping test - mGBA server not running')
      return
    }
    
    if (client) {
      await expect(client.disconnect()).resolves.toBeUndefined()
      expect(client.isConnected()).toBe(false)
      console.log('✅ Disconnected cleanly')
    }
  }, TEST_TIMEOUT)
})