/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/**
 * Stress tests for mGBA WebSocket connection stability and performance
 * Tests connection resilience, rapid operations, and memory watching under load
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MgbaWebSocketClient } from '../websocket-client.js'

const WEBSOCKET_URL = 'ws://localhost:7102'
const STRESS_TEST_TIMEOUT = 120000 // 2 minutes for stress tests

describe('WebSocket Stress Tests', () => {
  let clients: MgbaWebSocketClient[] = []

  beforeEach(() => {
    clients = []
  })

  afterEach(async () => {
    // Clean up all clients
    await Promise.all(clients.map(async (client) => {
      try {
        client.disconnect()
      } catch (error) {
        console.log('Cleanup error (expected):', error)
      }
    }))
    clients = []
  })

  it('should handle rapid connection and disconnection cycles', async () => {
    const cycles = 10
    let successfulConnections = 0
    let successfulDisconnections = 0

    for (let i = 0; i < cycles; i++) {
      const client = new MgbaWebSocketClient(WEBSOCKET_URL)
      clients.push(client)

      try {
        await client.connect()
        successfulConnections++
        expect(client.isConnected()).toBe(true)

        // Brief operation to ensure connection is working
        const result = await client.eval('1')
        expect(result.result).toBe(1)

        client.disconnect()
        successfulDisconnections++
        expect(client.isConnected()).toBe(false)
      } catch (error) {
        console.error(`Connection cycle ${i + 1} failed:`, error)
      }

      // Small delay between cycles to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    expect(successfulConnections).toBeGreaterThanOrEqual(cycles * 0.9) // 90% success rate
    expect(successfulDisconnections).toBeGreaterThanOrEqual(cycles * 0.9)

    console.log(`✅ Completed ${successfulConnections}/${cycles} successful connections`)
    console.log(`✅ Completed ${successfulDisconnections}/${cycles} successful disconnections`)
  }, STRESS_TEST_TIMEOUT)

  it('should handle multiple concurrent connections', async () => {
    const connectionCount = 5
    const promises: Array<Promise<void>> = []

    for (let i = 0; i < connectionCount; i++) {
      const client = new MgbaWebSocketClient(WEBSOCKET_URL)
      clients.push(client)

      promises.push(
        client.connect().then(async () => {
          // Test each connection independently
          const result = await client.eval(`${i + 1}`)
          expect(result.result).toBe(i + 1)
        }),
      )
    }

    await Promise.all(promises)

    // Verify all connections are working
    for (let i = 0; i < connectionCount; i++) {
      expect(clients[i]?.isConnected()).toBe(true)
    }

    console.log(`✅ Successfully established ${connectionCount} concurrent connections`)
  }, STRESS_TEST_TIMEOUT)

  it('should handle rapid eval operations without errors', async () => {
    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    clients.push(client)
    await client.connect()

    const operationCount = 50
    const operations: Array<Promise<any>> = []

    for (let i = 0; i < operationCount; i++) {
      operations.push(
        client.eval(`${i}`).then(result => {
          expect(result.result).toBe(i)
          return i
        }),
      )

      // Small delay to avoid overwhelming the server
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    }

    const results = await Promise.all(operations)
    expect(results).toHaveLength(operationCount)

    console.log(`✅ Successfully completed ${operationCount} rapid eval operations`)
  }, STRESS_TEST_TIMEOUT)

  it('should handle memory operations under load', async () => {
    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    clients.push(client)
    await client.connect()

    const memoryOperations = 30
    const testAddress = 0x02000000

    for (let i = 0; i < memoryOperations; i++) {
      const testValue = i % 256

      // Write to memory
      await client.eval(`emu:write8(${testAddress}, ${testValue})`)

      // Read back and verify
      const readResult = await client.eval(`emu:read8(${testAddress})`)
      expect(readResult.result).toBe(testValue)

      // Test shared buffer access
      const bufferData = await client.getSharedBuffer(testAddress, 1)
      expect(bufferData[0]).toBe(testValue)

      if (i % 10 === 0) {
        console.log(`Memory operation ${i + 1}/${memoryOperations} completed`)
      }
    }

    console.log(`✅ Successfully completed ${memoryOperations} memory operations`)
  }, STRESS_TEST_TIMEOUT)

  it('should maintain memory watching stability under rapid changes', async () => {
    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    clients.push(client)
    await client.connect()

    // Configure memory watching
    const testAddress = 0x02000100
    client.configureSharedBuffer({
      preloadRegions: [{ address: testAddress, size: 4 }],
    })

    let changeCount = 0
    const expectedChanges = 20

    // Set up memory change listener
    const changePromise = new Promise<void>((resolve) => {
      client.addMemoryChangeListener((address, _size, data) => {
        if (address === testAddress) {
          changeCount++
          console.log(`Memory change ${changeCount}: ${data[0]}`)

          if (changeCount >= expectedChanges) {
            resolve()
          }
        }
      })
    })

    // Start watching
    await client.startWatchingPreloadRegions()

    // Rapidly change memory to trigger notifications
    for (let i = 0; i < expectedChanges; i++) {
      await client.eval(`emu:write8(${testAddress}, ${i % 256})`)
      await new Promise(resolve => setTimeout(resolve, 50)) // Small delay between changes
    }

    // Wait for all changes to be detected (with timeout)
    await Promise.race([
      changePromise,
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error('Memory watching timeout')), 10000),
      ),
    ])

    expect(changeCount).toBeGreaterThanOrEqual(expectedChanges * 0.8) // Allow for some missed changes
    console.log(`✅ Detected ${changeCount}/${expectedChanges} memory changes`)
  }, STRESS_TEST_TIMEOUT)

  it('should recover from connection failures', async () => {
    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    clients.push(client)

    // Initial connection
    await client.connect()
    expect(client.isConnected()).toBe(true)

    // Test normal operation
    let result = await client.eval('"before_disconnect"')
    expect(result.result).toBe('before_disconnect')

    // Force disconnect and reconnect
    client.disconnect()
    expect(client.isConnected()).toBe(false)

    // Reconnect
    await client.connect()
    expect(client.isConnected()).toBe(true)

    // Test operation after reconnection
    result = await client.eval('"after_reconnect"')
    expect(result.result).toBe('after_reconnect')

    console.log('✅ Successfully recovered from connection failure')
  }, STRESS_TEST_TIMEOUT)

  it('should handle malformed data gracefully', async () => {
    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    clients.push(client)
    await client.connect()

    // Test various edge cases
    const errorCases = [
      'nil', // Nil result
      'error("test error")', // Lua error
      '{}', // Empty table
      '{complex = {nested = "data"}}', // Complex data
    ]

    for (const testCase of errorCases) {
      try {
        const result = await client.eval(testCase)
        // Should either succeed or throw a proper error
        console.log(`Test case "${testCase}" result:`, result)
      } catch (error) {
        // Errors are acceptable for some test cases
        console.log(`Test case "${testCase}" error (expected):`, error)
      }
    }

    // Verify connection is still working after error cases
    const finalResult = await client.eval('"still_working"')
    expect(finalResult.result).toBe('still_working')

    console.log('✅ Successfully handled malformed data cases')
  }, STRESS_TEST_TIMEOUT)
})
