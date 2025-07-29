/**
 * Core WebSocket functionality tests
 * Tests basic connection, eval, and communication
 */

import { describe, it, expect, afterEach } from 'vitest'
import { MgbaWebSocketClient } from '../websocket-client'

const WEBSOCKET_URL = 'ws://localhost:7102'

describe('WebSocket Core Tests', () => {
  // Add delay between tests to avoid overwhelming the server
  afterEach(async () => {
    await new Promise(resolve => setTimeout(resolve, 500))
  })

  it('should handle connection state correctly', async () => {
    const client = new MgbaWebSocketClient(WEBSOCKET_URL)

    // Initial state
    expect(client.isConnected()).toBe(false)
    expect(client.isEvalConnected()).toBe(false)
    expect(client.isWatchConnected()).toBe(false)

    await client.connect()
    expect(client.isConnected()).toBe(true)
    expect(client.isEvalConnected()).toBe(true)
    expect(client.isWatchConnected()).toBe(true)

    client.disconnect()
    expect(client.isConnected()).toBe(false)
  })

  it('should execute basic eval commands', async () => {
    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    await client.connect()

    // Test simple math
    const result1 = await client.eval('return 1 + 1')
    expect(result1.result).toBe(2)
    expect(result1.error).toBeUndefined()

    // Test string operation
    const result2 = await client.eval('return "Hello" .. " World"')
    expect(result2.result).toBe('Hello World')

    client.disconnect()
  })

  it('should handle eval errors gracefully', async () => {
    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    await client.connect()

    // Test syntax error
    const result = await client.eval('invalid lua syntax!')
    expect(result.error).toBeDefined()
    expect(result.result).toBeUndefined()

    client.disconnect()
  })

  it('should read memory directly', async () => {
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

  it('should handle different WebSocket message types without errors', async () => {
    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    await client.connect()

    let messageReceived = false
    let errorOccurred = false

    // Capture console messages to check for errors
    const originalConsoleWarn = console.warn
    const originalConsoleError = console.error
    const originalConsoleLog = console.log

    console.warn = (message: string, ...args: unknown[]) => {
      if (message.includes('Failed to parse watch message')) {
        errorOccurred = true
      }
      originalConsoleWarn(message, ...args)
    }

    console.error = (message: string, ...args: unknown[]) => {
      originalConsoleError(message, ...args)
    }

    console.log = (message: string, ...args: unknown[]) => {
      if (message.includes('Watch confirmed')) {
        messageReceived = true
      }
      originalConsoleLog(message, ...args)
    }

    try {
      // Start watching to trigger watchConfirm message
      const regions = [{ address: 0x20244e9, size: 4 }]
      await client.startWatching(regions)

      // Wait for messages to be processed
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Should have received watchConfirm without parsing errors
      expect(messageReceived).toBe(true)
      expect(errorOccurred).toBe(false)
    } finally {
      // Restore console
      console.warn = originalConsoleWarn
      console.error = originalConsoleError
      console.log = originalConsoleLog

      client.disconnect()
    }
  })

  it('should handle structured WATCH message format correctly', async () => {
    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    await client.connect()

    // Test that we can start watching without errors
    const regions = [
      { address: 0x20244e9, size: 7 },
      { address: 0x20244ec, size: 600 },
    ]

    let startWatchingSucceeded = false
    try {
      await client.startWatching(regions)
      startWatchingSucceeded = true
    } catch (error) {
      console.error('Failed to start watching:', error)
    }

    expect(startWatchingSucceeded).toBe(true)
    expect(client.isWatchingMemory()).toBe(true)
    expect(client.getWatchedRegions()).toHaveLength(2)

    client.disconnect()
  })
})
