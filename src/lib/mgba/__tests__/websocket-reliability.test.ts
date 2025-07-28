/**
 * Reliability tests for mGBA WebSocket connection stability and memory watching
 * Focus on realistic usage scenarios and error recovery
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MgbaWebSocketClient } from '../websocket-client.js'

const WEBSOCKET_URL = 'ws://localhost:7102'
const RELIABILITY_TEST_TIMEOUT = 30000 // 30 seconds

describe('WebSocket Reliability Tests', () => {
  let client: MgbaWebSocketClient

  beforeEach(async () => {
    client = new MgbaWebSocketClient(WEBSOCKET_URL)
  })

  afterEach(async () => {
    try {
      await client.disconnect()
    } catch (error) {
      console.log('Cleanup error (expected):', error)
    }
  })

  it('should establish stable connection and perform basic operations', async () => {
    await client.connect()
    expect(client.isConnected()).toBe(true)

    // Test basic eval
    const result1 = await client.eval('42')
    expect(result1.result).toBe(42)

    // Test memory operations
    const testAddress = 0x02000100
    await client.eval(`emu:write8(${testAddress}, 123)`)
    
    const readResult = await client.eval(`emu:read8(${testAddress})`)
    expect(readResult.result).toBe(123)

    // Test shared buffer
    const bufferData = await client.getSharedBuffer(testAddress, 1)
    expect(bufferData[0]).toBe(123)

    console.log('✅ Basic operations completed successfully')
  }, RELIABILITY_TEST_TIMEOUT)

  it('should handle memory watching with real data changes', async () => {
    await client.connect()

    // Set up memory watching
    const testAddress = 0x02000200
    client.configureSharedBuffer({
      preloadRegions: [{ address: testAddress, size: 4 }]
    })

    let memoryChanges = 0
    let lastChangeData: Uint8Array | null = null

    client.addMemoryChangeListener((address, _size, data) => {
      if (address === testAddress) {
        memoryChanges++
        lastChangeData = new Uint8Array(data)
        console.log(`Memory change #${memoryChanges}: ${data[0]}`)
      }
    })

    await client.startWatchingPreloadRegions()

    // Make several memory changes
    const testValues = [0x11, 0x22, 0x33, 0x44]
    for (const value of testValues) {
      await client.eval(`emu:write8(${testAddress}, ${value})`)
      await new Promise(resolve => setTimeout(resolve, 200)) // Allow time for notification
    }

    // Wait for final change to propagate
    await new Promise(resolve => setTimeout(resolve, 500))

    // Verify changes were detected
    expect(memoryChanges).toBeGreaterThan(0)
    expect(lastChangeData).not.toBeNull()
    
    // Verify final value is correct
    const finalValue = lastChangeData![0]
    expect(testValues).toContain(finalValue)

    console.log(`✅ Detected ${memoryChanges} memory changes`)
  }, RELIABILITY_TEST_TIMEOUT)

  it('should maintain data consistency under moderate load', async () => {
    await client.connect()

    const testAddress = 0x02000300
    const operationCount = 10

    // Set up memory watching
    client.configureSharedBuffer({
      preloadRegions: [{ address: testAddress, size: 1 }]
    })

    let detectedChanges = 0
    client.addMemoryChangeListener((address) => {
      if (address === testAddress) {
        detectedChanges++
      }
    })

    await client.startWatchingPreloadRegions()

    // Perform sequential operations with verification
    for (let i = 0; i < operationCount; i++) {
      const testValue = i % 256

      // Write value
      await client.eval(`emu:write8(${testAddress}, ${testValue})`)

      // Verify with direct read
      const readResult = await client.eval(`emu:read8(${testAddress})`)
      expect(readResult.result).toBe(testValue)

      // Verify with shared buffer
      const bufferData = await client.getSharedBuffer(testAddress, 1)
      expect(bufferData[0]).toBe(testValue)

      // Small delay between operations
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Allow time for all notifications
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Should have detected most or all changes
    expect(detectedChanges).toBeGreaterThan(operationCount * 0.5)

    console.log(`✅ Completed ${operationCount} operations, detected ${detectedChanges} changes`)
  }, RELIABILITY_TEST_TIMEOUT)

  it('should handle connection recovery gracefully', async () => {
    await client.connect()
    expect(client.isConnected()).toBe(true)

    // Test operation before disconnect
    const result1 = await client.eval('100')
    expect(result1.result).toBe(100)

    // Disconnect
    client.disconnect()
    expect(client.isConnected()).toBe(false)

    // Reconnect
    await client.connect()
    expect(client.isConnected()).toBe(true)

    // Test operation after reconnect
    const result2 = await client.eval('200')
    expect(result2.result).toBe(200)

    console.log('✅ Connection recovery successful')
  }, RELIABILITY_TEST_TIMEOUT)

  it('should handle errors without breaking the connection', async () => {
    await client.connect()

    // Test successful operation
    const result1 = await client.eval('42')
    expect(result1.result).toBe(42)

    // Test error case
    try {
      await client.eval('error("test error")')
      // Should not reach here
      expect(false).toBe(true)
    } catch (error) {
      // Error expected
      console.log('Expected error caught:', error)
    }

    // Test that connection still works after error
    const result2 = await client.eval('84')
    expect(result2.result).toBe(84)

    console.log('✅ Error handling successful')
  }, RELIABILITY_TEST_TIMEOUT)

  it('should provide accurate Pokemon party simulation', async () => {
    await client.connect()

    // Simulate Pokemon Emerald addresses
    const partyCountAddr = 0x20244e9
    const partyDataAddr = 0x20244ec

    client.configureSharedBuffer({
      preloadRegions: [
        { address: partyCountAddr, size: 1 },
        { address: partyDataAddr, size: 200 } // Simplified Pokemon data
      ]
    })

    let partyChanges = 0
    let dataChanges = 0

    client.addMemoryChangeListener((address) => {
      if (address === partyCountAddr) partyChanges++
      if (address === partyDataAddr) dataChanges++
    })

    await client.startWatchingPreloadRegions()

    // Simulate adding Pokemon to party
    await client.eval(`emu:write8(${partyCountAddr}, 1)`) // Set party size to 1

    // Simulate Pokemon data (species, level, HP)
    await client.eval(`emu:write16(${partyDataAddr}, 252)`)     // Treecko species
    await client.eval(`emu:write8(${partyDataAddr + 10}, 5)`)   // Level 5
    await client.eval(`emu:write16(${partyDataAddr + 20}, 20)`) // 20 HP

    // Wait for changes
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Verify data through shared buffer
    const partyCount = await client.getSharedBuffer(partyCountAddr, 1)
    expect(partyCount[0]).toBe(1)

    const pokemonData = await client.getSharedBuffer(partyDataAddr, 25)
    
    // Check species (little-endian)
    const species = (pokemonData[0] || 0) + ((pokemonData[1] || 0) << 8)
    expect(species).toBe(252)

    // Check level
    expect(pokemonData[10]).toBe(5)

    // Check HP (little-endian)
    const hp = (pokemonData[20] || 0) + ((pokemonData[21] || 0) << 8)
    expect(hp).toBe(20)

    // Should have detected changes
    expect(partyChanges + dataChanges).toBeGreaterThan(0)

    console.log(`✅ Pokemon simulation successful (${partyChanges + dataChanges} changes detected)`)
  }, RELIABILITY_TEST_TIMEOUT)
})