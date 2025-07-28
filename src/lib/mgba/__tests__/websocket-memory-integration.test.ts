/**
 * Comprehensive integration tests for memory watching functionality
 * Tests end-to-end memory watching: write data -> verify watch fires -> validate data
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MgbaWebSocketClient } from '../websocket-client.js'

const WEBSOCKET_URL = 'ws://localhost:7102'
const INTEGRATION_TEST_TIMEOUT = 60000 // 1 minute

interface MemoryChangeEvent {
  address: number
  size: number
  data: Uint8Array
  timestamp: number
}

describe('Memory Watching Integration Tests', () => {
  let client: MgbaWebSocketClient
  let memoryChanges: MemoryChangeEvent[] = []

  beforeEach(async () => {
    client = new MgbaWebSocketClient(WEBSOCKET_URL)
    memoryChanges = []
    
    // Connect and set up memory change tracking
    await client.connect()
    
    client.addMemoryChangeListener((address, size, data) => {
      memoryChanges.push({
        address,
        size, 
        data: new Uint8Array(data),
        timestamp: Date.now()
      })
      console.log(`📝 Memory change detected: 0x${address.toString(16)} (${size} bytes)`)
    })
  })

  afterEach(async () => {
    try {
      await client.stopWatching()
      await client.disconnect()
    } catch (error) {
      console.log('Cleanup error (expected):', error)
    }
  })

  it('should detect single memory region changes', async () => {
    const testAddress = 0x02000200
    const testSize = 4
    
    // Configure watching for test region
    client.configureSharedBuffer({
      preloadRegions: [{ address: testAddress, size: testSize }]
    })
    
    await client.startWatchingPreloadRegions()
    
    // Clear any existing changes
    memoryChanges = []
    
    // Write test data
    const testValues = [0x12, 0x34, 0x56, 0x78]
    for (let i = 0; i < testValues.length; i++) {
      await client.eval(`emu:write8(${testAddress + i}, ${testValues[i]})`)
    }
    
    // Wait for change notifications
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Verify changes were detected
    expect(memoryChanges.length).toBeGreaterThan(0)
    
    const relevantChanges = memoryChanges.filter(change => change.address === testAddress)
    expect(relevantChanges.length).toBeGreaterThan(0)
    
    // Verify data integrity
    const latestChange = relevantChanges[relevantChanges.length - 1]
    for (let i = 0; i < testValues.length; i++) {
      expect(latestChange?.data[i]).toBe(testValues[i])
    }
    
    console.log(`✅ Detected ${relevantChanges.length} changes for single region`)
  }, INTEGRATION_TEST_TIMEOUT)

  it('should detect changes in multiple memory regions simultaneously', async () => {
    const regions = [
      { address: 0x02000300, size: 2 },
      { address: 0x02000400, size: 4 },
      { address: 0x02000500, size: 1 }
    ]
    
    // Configure watching for multiple regions
    client.configureSharedBuffer({
      preloadRegions: regions
    })
    
    await client.startWatchingPreloadRegions()
    
    // Clear any existing changes
    memoryChanges = []
    
    // Write different data to each region
    const testData = [
      [0xAA, 0xBB],
      [0x11, 0x22, 0x33, 0x44],
      [0xFF]
    ]
    
    for (let regionIndex = 0; regionIndex < regions.length; regionIndex++) {
      const region = regions[regionIndex]
      const data = testData[regionIndex]
      
      if (!region || !data) continue
      
      for (let i = 0; i < data.length; i++) {
        await client.eval(`emu:write8(${region.address + i}, ${data[i]})`)
      }
    }
    
    // Wait for all change notifications
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Verify changes were detected for all regions
    for (let regionIndex = 0; regionIndex < regions.length; regionIndex++) {
      const region = regions[regionIndex]
      const expectedData = testData[regionIndex]
      
      if (!region || !expectedData) continue
      
      const regionChanges = memoryChanges.filter(change => change.address === region.address)
      
      expect(regionChanges.length).toBeGreaterThan(0)
      
      // Verify latest data matches what we wrote
      const latestChange = regionChanges[regionChanges.length - 1]
      
      if (!latestChange) continue
      
      for (let i = 0; i < expectedData.length; i++) {
        expect(latestChange.data[i]).toBe(expectedData[i])
      }
    }
    
    console.log(`✅ Detected changes in all ${regions.length} regions`)
  }, INTEGRATION_TEST_TIMEOUT)

  it('should provide accurate data through getSharedBuffer for watched regions', async () => {
    const testAddress = 0x02000600
    const testSize = 8
    
    // Configure watching
    client.configureSharedBuffer({
      preloadRegions: [{ address: testAddress, size: testSize }]
    })
    
    await client.startWatchingPreloadRegions()
    
    // Write test pattern
    const testPattern = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80]
    for (let i = 0; i < testPattern.length; i++) {
      await client.eval(`emu:write8(${testAddress + i}, ${testPattern[i]})`)
    }
    
    // Wait for changes to propagate
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Read back through getSharedBuffer
    const bufferData = await client.getSharedBuffer(testAddress, testSize)
    
    // Verify data matches
    for (let i = 0; i < testPattern.length; i++) {
      expect(bufferData[i]).toBe(testPattern[i])
    }
    
    console.log('✅ getSharedBuffer returns accurate data for watched regions')
  }, INTEGRATION_TEST_TIMEOUT)

  it('should handle rapid memory changes without losing data', async () => {
    const testAddress = 0x02000700
    const testSize = 1
    const changeCount = 20
    
    client.configureSharedBuffer({
      preloadRegions: [{ address: testAddress, size: testSize }]
    })
    
    await client.startWatchingPreloadRegions()
    
    // Clear existing changes
    memoryChanges = []
    
    // Make rapid changes
    const expectedValues: number[] = []
    for (let i = 0; i < changeCount; i++) {
      const value = i % 256
      expectedValues.push(value)
      await client.eval(`emu:write8(${testAddress}, ${value})`)
      
      // Small delay to allow processing
      await new Promise(resolve => setTimeout(resolve, 25))
    }
    
    // Wait for all changes to be processed
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Get final value
    const finalBuffer = await client.getSharedBuffer(testAddress, testSize)
    const finalValue = finalBuffer[0]
    
    // Should match the last value we wrote
    expect(finalValue).toBe(expectedValues[expectedValues.length - 1])
    
    // Should have detected multiple changes
    const addressChanges = memoryChanges.filter(change => change.address === testAddress)
    expect(addressChanges.length).toBeGreaterThan(changeCount * 0.5) // Allow for some coalescing
    
    console.log(`✅ Handled ${changeCount} rapid changes, detected ${addressChanges.length} notifications`)
  }, INTEGRATION_TEST_TIMEOUT)

  it('should maintain accuracy during Pokemon party data simulation', async () => {
    // Simulate Pokemon Emerald party data addresses
    const partyCountAddress = 0x20244e9
    const partyDataAddress = 0x20244ec
    const pokemonSize = 100 // Simplified Pokemon data size
    
    client.configureSharedBuffer({
      preloadRegions: [
        { address: partyCountAddress, size: 7 },
        { address: partyDataAddress, size: pokemonSize * 6 } // Up to 6 Pokemon
      ]
    })
    
    await client.startWatchingPreloadRegions()
    
    // Clear existing changes
    memoryChanges = []
    
    // Simulate adding Pokemon to party
    const partySize = 3
    
    // Set party count
    await client.eval(`emu:write8(${partyCountAddress}, ${partySize})`)
    
    // Add Pokemon data
    for (let pokemonIndex = 0; pokemonIndex < partySize; pokemonIndex++) {
      const pokemonBaseAddress = partyDataAddress + (pokemonIndex * pokemonSize)
      
      // Write Pokemon species (simplified - just first 2 bytes)
      const species = 252 + pokemonIndex // Treecko, Grovyle, Sceptile
      await client.eval(`emu:write16(${pokemonBaseAddress}, ${species})`)
      
      // Write level
      const level = 5 + pokemonIndex * 10
      await client.eval(`emu:write8(${pokemonBaseAddress + 10}, ${level})`)
      
      // Write HP
      const hp = 20 + pokemonIndex * 5
      await client.eval(`emu:write16(${pokemonBaseAddress + 20}, ${hp})`)
    }
    
    // Wait for all changes
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Verify party count
    const partyCountBuffer = await client.getSharedBuffer(partyCountAddress, 7)
    expect(partyCountBuffer[0]).toBe(partySize)
    
    // Verify Pokemon data
    for (let pokemonIndex = 0; pokemonIndex < partySize; pokemonIndex++) {
      const pokemonBaseAddress = partyDataAddress + (pokemonIndex * pokemonSize)
      const pokemonData = await client.getSharedBuffer(pokemonBaseAddress, 25) // Read first 25 bytes
      
      // Check species (little-endian 16-bit)
      const species = (pokemonData[0] || 0) + ((pokemonData[1] || 0) << 8)
      expect(species).toBe(252 + pokemonIndex)
      
      // Check level
      expect(pokemonData[10]).toBe(5 + pokemonIndex * 10)
      
      // Check HP (little-endian 16-bit)
      const hp = (pokemonData[20] || 0) + ((pokemonData[21] || 0) << 8)
      expect(hp).toBe(20 + pokemonIndex * 5)
    }
    
    // Verify change notifications were received
    const partyCountChanges = memoryChanges.filter(change => change.address === partyCountAddress)
    const partyDataChanges = memoryChanges.filter(change => change.address === partyDataAddress)
    
    expect(partyCountChanges.length).toBeGreaterThan(0)
    expect(partyDataChanges.length).toBeGreaterThan(0)
    
    console.log('✅ Pokemon party data simulation completed successfully')
    console.log(`   Party count changes: ${partyCountChanges.length}`)
    console.log(`   Party data changes: ${partyDataChanges.length}`)
  }, INTEGRATION_TEST_TIMEOUT)

  it('should handle memory watching with concurrent eval operations', async () => {
    const testAddress = 0x02000800
    
    client.configureSharedBuffer({
      preloadRegions: [{ address: testAddress, size: 4 }]
    })
    
    await client.startWatchingPreloadRegions()
    
    // Clear existing changes
    memoryChanges = []
    
    // Start concurrent operations
    const promises = []
    
    // Memory writing operations
    for (let i = 0; i < 10; i++) {
      promises.push(
        client.eval(`emu:write8(${testAddress}, ${i})`).then(() => i)
      )
    }
    
    // Concurrent eval operations
    for (let i = 0; i < 5; i++) {
      promises.push(
        client.eval(`${i * 10}`).then(result => {
          expect(result.result).toBe(i * 10)
          return result.result
        })
      )
    }
    
    // Memory reading operations  
    for (let i = 0; i < 5; i++) {
      promises.push(
        client.getSharedBuffer(testAddress, 1).then(data => data[0])
      )
    }
    
    // Wait for all operations
    const results = await Promise.all(promises)
    expect(results).toHaveLength(20)
    
    // Wait for memory changes to be processed
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Verify some memory changes were detected
    const addressChanges = memoryChanges.filter(change => change.address === testAddress)
    expect(addressChanges.length).toBeGreaterThan(0)
    
    console.log(`✅ Concurrent operations completed successfully`)
    console.log(`   Detected ${addressChanges.length} memory changes during concurrent operations`)
  }, INTEGRATION_TEST_TIMEOUT)

  it('should provide consistent timestamps for memory changes', async () => {
    const testAddress = 0x02000900
    
    client.configureSharedBuffer({
      preloadRegions: [{ address: testAddress, size: 1 }]
    })
    
    await client.startWatchingPreloadRegions()
    
    // Clear existing changes
    memoryChanges = []
    
    const startTime = Date.now()
    
    // Make several changes with known timing
    for (let i = 0; i < 5; i++) {
      await client.eval(`emu:write8(${testAddress}, ${i})`)
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    const endTime = Date.now()
    
    // Wait for changes to be processed
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const addressChanges = memoryChanges.filter(change => change.address === testAddress)
    expect(addressChanges.length).toBeGreaterThan(0)
    
    // Verify timestamps are reasonable
    for (const change of addressChanges) {
      expect(change.timestamp).toBeGreaterThanOrEqual(startTime)
      expect(change.timestamp).toBeLessThanOrEqual(endTime + 1000) // Allow for processing delay
    }
    
    // Verify timestamps are in order (may have some variance due to async processing)
    for (let i = 1; i < addressChanges.length; i++) {
      const current = addressChanges[i]
      const previous = addressChanges[i-1]
      
      if (!current || !previous) continue
      
      const timeDiff = current.timestamp - previous.timestamp
      expect(timeDiff).toBeGreaterThanOrEqual(-100) // Allow small negative variance
    }
    
    console.log(`✅ Timestamp consistency verified for ${addressChanges.length} changes`)
  }, INTEGRATION_TEST_TIMEOUT)
})