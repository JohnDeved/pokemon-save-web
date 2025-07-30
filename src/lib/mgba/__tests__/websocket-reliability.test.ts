/**
 * WebSocket reliability tests
 * Tests for rapid connections, disconnections, and server robustness
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest'
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

describe('WebSocket Reliability Tests', () => {
  // Check server availability once before all tests
  beforeAll(async () => {
    await checkServerAvailable()
  }, 10000)

  // Add delay between tests to avoid overwhelming the server
  afterEach(async () => {
    await new Promise(resolve => setTimeout(resolve, 1000))
  })

  it('should handle rapid connect/disconnect cycles reliably', async () => {
    const clients: MgbaWebSocketClient[] = []

    try {
      // Test 5 rapid connect/disconnect cycles
      for (let i = 0; i < 5; i++) {
        const client = new MgbaWebSocketClient(WEBSOCKET_URL)
        await client.connect()
        
        // Add small delay to ensure connection is stable before checking
        await new Promise(resolve => setTimeout(resolve, 100))
        expect(client.isConnected()).toBe(true)

        clients.push(client)

        // Short delay between connections
        await new Promise(resolve => setTimeout(resolve, 100))

        client.disconnect()
        expect(client.isConnected()).toBe(false)

        // Ensure connection is fully closed before next iteration
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    } finally {
      // Cleanup any remaining connections
      clients.forEach(client => client.disconnect())
    }
  }, 30000)

  it('should handle multiple concurrent connections gracefully', async () => {
    const clients: MgbaWebSocketClient[] = []

    try {
      // Create 3 concurrent connections
      const connectPromises = []
      for (let i = 0; i < 3; i++) {
        const client = new MgbaWebSocketClient(WEBSOCKET_URL)
        clients.push(client)
        connectPromises.push(client.connect())
      }

      // All should connect successfully
      await Promise.all(connectPromises)
      
      // Add small delay to ensure connections are stable
      await new Promise(resolve => setTimeout(resolve, 200))

      // Verify all connections are active
      for (const client of clients) {
        expect(client.isConnected()).toBe(true)
      }

      // Test basic functionality on each connection
      const evalPromises = clients.map(client =>
        client.eval('return "test"'),
      )

      const results = await Promise.all(evalPromises)

      // All should return the expected result
      for (const result of results) {
        expect(result.result).toBe('test')
        expect(result.error).toBeUndefined()
      }
    } finally {
      // Cleanup all connections
      clients.forEach(client => client.disconnect())
    }
  }, 20000)

  it('should recover from connection errors and reconnect successfully', async () => {
    const client = new MgbaWebSocketClient(WEBSOCKET_URL)

    try {
      // Initial connection
      await client.connect()
      expect(client.isConnected()).toBe(true)

      // Test basic functionality
      const result1 = await client.eval('return "first"')
      expect(result1.result).toBe('first')

      // Force disconnect
      client.disconnect()
      expect(client.isConnected()).toBe(false)

      // Wait a bit to ensure server cleanup
      await new Promise(resolve => setTimeout(resolve, 500))

      // Reconnect should work
      await client.connect()
      expect(client.isConnected()).toBe(true)

      // Functionality should still work
      const result2 = await client.eval('return "second"')
      expect(result2.result).toBe('second')
    } finally {
      client.disconnect()
    }
  }, 15000)

  it('should handle memory watching across reconnections', async () => {
    const client = new MgbaWebSocketClient(WEBSOCKET_URL)

    try {
      // Initial connection and memory watching
      await client.connect()

      const regions = [
        { address: 0x2000000, size: 8 },
      ]

      await client.startWatching(regions)
      expect(client.getWatchedRegions()).toHaveLength(1)

      // Disconnect and reconnect
      client.disconnect()
      await new Promise(resolve => setTimeout(resolve, 500))

      await client.connect()

      // Should be able to start watching again
      await client.startWatching(regions)
      expect(client.getWatchedRegions()).toHaveLength(1)
    } finally {
      client.disconnect()
    }
  }, 15000)

  it('should handle server state cleanup properly', async () => {
    const client1 = new MgbaWebSocketClient(WEBSOCKET_URL)
    const client2 = new MgbaWebSocketClient(WEBSOCKET_URL)

    try {
      // Connect first client and set up watching
      await client1.connect()
      await client1.startWatching([{ address: 0x2000000, size: 8 }])

      // Connect second client
      await client2.connect()

      // Both should work independently
      const result1 = await client1.eval('return "client1"')
      const result2 = await client2.eval('return "client2"')

      expect(result1.result).toBe('client1')
      expect(result2.result).toBe('client2')

      // Disconnect first client
      client1.disconnect()

      // Second client should still work
      const result3 = await client2.eval('return "still_working"')
      expect(result3.result).toBe('still_working')
    } finally {
      client1.disconnect()
      client2.disconnect()
    }
  }, 15000)

  it('should handle malformed watch messages gracefully', async () => {
    const client = new MgbaWebSocketClient(WEBSOCKET_URL)

    try {
      await client.connect()

      // Test with invalid regions
      const invalidRegions = [
        { address: -1, size: 8 }, // Invalid address
        { address: 0x2000000, size: -5 }, // Invalid size
        { address: 0x2000000, size: 0x20000 }, // Too large size
      ]

      // Should handle invalid regions gracefully without crashing
      await expect(client.startWatching(invalidRegions)).rejects.toThrow()

      // Client should still be functional for valid operations
      const result = await client.eval('return "still_works"')
      expect(result.result).toBe('still_works')
    } finally {
      client.disconnect()
    }
  }, 10000)
})
