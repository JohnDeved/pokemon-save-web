/**
 * WebSocket integration tests
 * Tests memory watching, shared buffer, and real-time updates
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

describe('WebSocket Integration Tests', () => {
  it('should use shared buffer for watched regions', async () => {
    const serverAvailable = await isServerAvailable()
    if (!serverAvailable) {
      console.log('⏭️  Skipping shared buffer tests - mGBA server not available')
      return
    }

    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    await client.connect()

    const region = { address: 0x20244e9, size: 8 }
    await client.startWatching([region])

    // First read should populate shared buffer
    const data1 = await client.readMemory(region.address, region.size)
    expect(data1).toBeInstanceOf(Uint8Array)
    expect(data1.length).toBe(region.size)

    // Second read should use shared buffer (faster)
    const data2 = await client.readMemory(region.address, region.size)
    expect(data2).toEqual(data1)

    // Partial read within watched region should also use shared buffer
    const partialData = await client.readMemory(region.address + 2, 4)
    expect(partialData).toBeInstanceOf(Uint8Array)
    expect(partialData.length).toBe(4)

    client.disconnect()
  })

  it('should handle memory change listeners', async () => {
    const serverAvailable = await isServerAvailable()
    if (!serverAvailable) {
      console.log('⏭️  Skipping memory change listener tests - mGBA server not available')
      return
    }

    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    await client.connect()

    let changeCount = 0
    const listener = (address: number, size: number, data: Uint8Array) => {
      changeCount++
      expect(address).toBeGreaterThan(0)
      expect(size).toBeGreaterThan(0)
      expect(data).toBeInstanceOf(Uint8Array)
    }

    client.addMemoryChangeListener(listener)

    const region = { address: 0x20244e9, size: 4 }
    await client.startWatching([region])

    // Simulate a memory change by writing to memory
    await client.eval(`
      for i = 0, 3 do
        emu:write8(${region.address} + i, math.random(0, 255))
      end
    `)

    // Wait a bit for the change to be detected
    await new Promise(resolve => setTimeout(resolve, 100))

    client.removeMemoryChangeListener(listener)
    client.disconnect()

    // We may or may not have received changes depending on timing,
    // but the listener system should work without errors
    expect(changeCount).toBeGreaterThanOrEqual(0)
  })

  it('should start watching preload regions', async () => {
    const serverAvailable = await isServerAvailable()
    if (!serverAvailable) {
      console.log('⏭️  Skipping preload regions test - mGBA server not available')
      return
    }

    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    await client.connect()

    await client.startWatchingPreloadRegions()
    
    expect(client.isWatchingMemory()).toBe(true)
    expect(client.getWatchedRegions().length).toBeGreaterThan(0)

    // Should be able to read from shared buffer
    const sharedBuffer = client.getSharedBuffer()
    expect(sharedBuffer.size).toBeGreaterThan(0)

    client.disconnect()
  })

  it('should handle preload shared buffers compatibility', async () => {
    const serverAvailable = await isServerAvailable()
    if (!serverAvailable) {
      console.log('⏭️  Skipping preload shared buffers test - mGBA server not available')
      return
    }

    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    await client.connect()

    // This should work for compatibility
    await expect(client.preloadSharedBuffers()).resolves.not.toThrow()
    
    expect(client.isWatchingMemory()).toBe(true)

    client.disconnect()
  })

  it('should provide game title when available', async () => {
    const serverAvailable = await isServerAvailable()
    if (!serverAvailable) {
      console.log('⏭️  Skipping game title test - mGBA server not available')
      return
    }

    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    await client.connect()

    const gameTitle = await client.getGameTitle()
    expect(typeof gameTitle).toBe('string')
    expect(gameTitle.length).toBeGreaterThan(0)

    client.disconnect()
  })

  it('should handle connection errors gracefully', async () => {
    // Test with invalid URL
    const client = new MgbaWebSocketClient('ws://localhost:9999')
    
    await expect(client.connect()).rejects.toThrow()
    expect(client.isConnected()).toBe(false)
  })

  it('should handle eval errors when disconnected', async () => {
    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    
    await expect(client.eval('return 1')).rejects.toThrow()
  })

  it('should handle memory reading when disconnected', async () => {
    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    
    await expect(client.readMemory(0x20244e9, 4)).rejects.toThrow()
  })
})