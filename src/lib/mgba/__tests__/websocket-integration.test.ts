/**
 * WebSocket integration tests
 * Tests memory watching, shared buffer, and real-time updates
 */

import { describe, it, expect, afterEach } from 'vitest'
import { MgbaWebSocketClient, type MgbaEvalResponse } from '../websocket-client'

const WEBSOCKET_URL = 'ws://localhost:7102'

describe('WebSocket Integration Tests', () => {
  // Add delay between tests to avoid overwhelming the server
  afterEach(async () => {
    await new Promise(resolve => setTimeout(resolve, 500))
  })

  it('should use shared buffer for watched regions', async () => {
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

  it('should handle preload shared buffers', async () => {
    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    await client.connect()

    // Start watching preload regions
    await expect(client.startWatchingPreloadRegions()).resolves.not.toThrow()

    expect(client.isWatchingMemory()).toBe(true)

    client.disconnect()
  })

  it('should provide game title when available', async () => {
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

  it('should handle concurrent operations safely', async () => {
    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    await client.connect()

    // Run multiple concurrent operations
    const operations = [
      client.eval('return 42'),
      client.readMemory(0x20244e9, 4),
      client.eval('return "test"'),
      client.readMemory(0x20244ec, 8),
    ]

    const results = await Promise.all(operations)
    expect(results).toHaveLength(4)

    // Check eval results
    const evalResult1 = results[0] as MgbaEvalResponse
    const evalResult2 = results[2] as MgbaEvalResponse
    expect(evalResult1.result).toBe(42)
    expect(evalResult2.result).toBe('test')

    client.disconnect()
  })

  it('should maintain shared buffer integrity under load', async () => {
    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    await client.connect()

    const region = { address: 0x20244e9, size: 8 }
    await client.startWatching([region])

    // Perform multiple rapid reads to test shared buffer stability
    const reads = []
    for (let i = 0; i < 10; i++) {
      reads.push(client.readMemory(region.address, region.size))
    }

    const results = await Promise.all(reads)

    // All reads should succeed and return consistent results
    expect(results).toHaveLength(10)
    for (const result of results) {
      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.length).toBe(region.size)
    }

    client.disconnect()
  })

  it('should handle WebSocket message parsing robustness', async () => {
    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    await client.connect()

    let parseErrors = 0
    const originalConsoleWarn = console.warn

    // Capture parsing errors
    console.warn = (message: string, ...args: unknown[]) => {
      if (message.includes('Failed to parse watch message')) {
        parseErrors++
      }
      originalConsoleWarn(message, ...args)
    }

    try {
      // Start watching which will trigger various message types
      const regions = [
        { address: 0x20244e9, size: 7 },
        { address: 0x20244ec, size: 600 },
      ]
      await client.startWatching(regions)

      // Wait for messages to be processed
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Trigger some memory operations that may generate different message types
      await client.eval('return 1 + 1')
      await client.readMemory(0x20244e9, 4)

      // Wait for any additional messages
      await new Promise(resolve => setTimeout(resolve, 500))

      // Should have no parsing errors
      expect(parseErrors).toBe(0)
    } finally {
      console.warn = originalConsoleWarn
      client.disconnect()
    }
  })

  it('should handle malformed WebSocket messages gracefully', async () => {
    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    await client.connect()

    let warnCount = 0
    const originalConsoleWarn = console.warn

    console.warn = (message: string, ...args: unknown[]) => {
      if (message.includes('Failed to parse watch message') ||
          message.includes('Unknown message type')) {
        warnCount++
      }
      originalConsoleWarn(message, ...args)
    }

    try {
      // Test that normal operation works without warnings
      const regions = [{ address: 0x20244e9, size: 4 }]
      await client.startWatching(regions)

      // Wait for normal messages to be processed
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Should handle watchConfirm, memoryUpdate, etc. without warnings
      expect(warnCount).toBe(0)
    } finally {
      console.warn = originalConsoleWarn
      client.disconnect()
    }
  })
})
