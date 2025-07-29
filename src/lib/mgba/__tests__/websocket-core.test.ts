/**
 * Core WebSocket functionality tests
 * Tests basic connection, eval, and communication
 */

import { describe, it, expect } from 'vitest'
import { MgbaWebSocketClient } from '../websocket-client'

const WEBSOCKET_URL = 'ws://localhost:7102'

/**
 * Check if mGBA WebSocket server is available
 */
async function isServerAvailable(): Promise<boolean> {
  try {
    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    await client.connect()
    client.disconnect()
    return true
  } catch {
    return false
  }
}

describe('WebSocket Core Tests', () => {
  it('should handle connection state correctly', async () => {
    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    
    // Initial state
    expect(client.isConnected()).toBe(false)
    expect(client.isEvalConnected()).toBe(false)
    expect(client.isWatchConnected()).toBe(false)
    
    // Try to connect
    const serverAvailable = await isServerAvailable()
    if (!serverAvailable) {
      console.log('⏭️  Skipping connection tests - mGBA server not available')
      return
    }

    await client.connect()
    expect(client.isConnected()).toBe(true)
    expect(client.isEvalConnected()).toBe(true)
    expect(client.isWatchConnected()).toBe(true)

    client.disconnect()
    expect(client.isConnected()).toBe(false)
  })

  it('should execute basic eval commands', async () => {
    const serverAvailable = await isServerAvailable()
    if (!serverAvailable) {
      console.log('⏭️  Skipping eval tests - mGBA server not available')
      return
    }

    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    await client.connect()

    // Test simple math
    const result1 = await client.eval('return 1 + 1')
    expect(result1.result).toBe(2)
    expect(result1.error).toBeUndefined()

    // Test string operation
    const result2 = await client.eval('return "Hello" .. " World"')
    expect(result2.result).toBe("Hello World")

    client.disconnect()
  })

  it('should handle eval errors gracefully', async () => {
    const serverAvailable = await isServerAvailable()
    if (!serverAvailable) {
      console.log('⏭️  Skipping error handling tests - mGBA server not available')
      return
    }

    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    await client.connect()

    // Test syntax error
    const result = await client.eval('invalid lua syntax!')
    expect(result.error).toBeDefined()
    expect(result.result).toBeUndefined()

    client.disconnect()
  })

  it('should read memory directly', async () => {
    const serverAvailable = await isServerAvailable()
    if (!serverAvailable) {
      console.log('⏭️  Skipping memory read tests - mGBA server not available')
      return
    }

    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    await client.connect()

    // Read a small region of memory
    const data = await client.readMemory(0x20244e9, 4)
    expect(data).toBeInstanceOf(Uint8Array)
    expect(data.length).toBe(4)

    client.disconnect()
  })

  it('should handle memory watching state', async () => {
    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    
    expect(client.isWatchingMemory()).toBe(false)
    expect(client.getWatchedRegions()).toHaveLength(0)

    const serverAvailable = await isServerAvailable()
    if (!serverAvailable) {
      console.log('⏭️  Skipping memory watching tests - mGBA server not available')
      return
    }

    await client.connect()

    const regions = [{ address: 0x20244e9, size: 4 }]
    await client.startWatching(regions)
    
    expect(client.isWatchingMemory()).toBe(true)
    expect(client.getWatchedRegions()).toHaveLength(1)

    await client.stopWatching()
    expect(client.isWatchingMemory()).toBe(false)
    expect(client.getWatchedRegions()).toHaveLength(0)

    client.disconnect()
  })

  it('should provide compatibility methods', () => {
    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    
    // These should not throw
    expect(() => client.configureSharedBuffer({})).not.toThrow()
    expect(() => client.clearCache()).not.toThrow()
    expect(() => client.invalidateCache(0x20244e9, 4)).not.toThrow()
    
    const stats = client.getCacheStats()
    expect(typeof stats.hits).toBe('number')
    expect(typeof stats.misses).toBe('number')
    expect(typeof stats.size).toBe('number')
    expect(Array.isArray(stats.regions)).toBe(true)
  })
})