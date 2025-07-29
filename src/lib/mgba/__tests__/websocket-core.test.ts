/**
 * Core WebSocket functionality tests
 * Tests basic connection, eval, and communication
 */

import { describe, it, expect } from 'vitest'
import { MgbaWebSocketClient } from '../websocket-client'

const WEBSOCKET_URL = 'ws://localhost:7102'

/**
 * Check if mGBA WebSocket server is available and throw error with installation instructions if not
 */
async function checkServerAvailable (): Promise<void> {
  try {
    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    await client.connect()
    client.disconnect()
  } catch (error) {
    throw new Error(
      `mGBA WebSocket server not available at ${WEBSOCKET_URL}.\n\n` +
      'To run mGBA WebSocket tests:\n' +
      '1. Install Docker: https://docs.docker.com/get-docker/\n' +
      '2. Run: npm run mgba\n' +
      '3. Wait for "HTTP server running on port 7102" message\n' +
      '4. Run: npm run test:mgba\n\n' +
      `Original error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

describe('WebSocket Core Tests', () => {
  it('should handle connection state correctly', async () => {
    await checkServerAvailable()

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
    await checkServerAvailable()

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
    await checkServerAvailable()

    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    await client.connect()

    // Test syntax error
    const result = await client.eval('invalid lua syntax!')
    expect(result.error).toBeDefined()
    expect(result.result).toBeUndefined()

    client.disconnect()
  })

  it('should read memory directly', async () => {
    await checkServerAvailable()

    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    await client.connect()

    // Read a small region of memory
    const data = await client.readMemory(0x20244e9, 4)
    expect(data).toBeInstanceOf(Uint8Array)
    expect(data.length).toBe(4)

    client.disconnect()
  })

  it('should handle memory watching state', async () => {
    await checkServerAvailable()

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
})
