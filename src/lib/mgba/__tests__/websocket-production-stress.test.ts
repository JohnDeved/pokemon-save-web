/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/**
 * Production-ready stress tests for mGBA WebSocket system
 * These tests are designed to find real connection issues and edge cases
 * that would occur in production use
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MgbaWebSocketClient } from '../websocket-client.js'

const WEBSOCKET_URL = 'ws://localhost:7102'
const PRODUCTION_STRESS_TIMEOUT = 300000 // 5 minutes for thorough testing

describe('Production WebSocket Stress Tests', () => {
  let clients: MgbaWebSocketClient[] = []

  beforeEach(() => {
    clients = []
  })

  afterEach(async () => {
    // Aggressive cleanup
    const cleanupPromises = clients.map(async (client) => {
      try {
        client.disconnect()
      } catch (error) {
        console.log('Cleanup error (expected):', error)
      }
    })
    await Promise.allSettled(cleanupPromises)
    clients = []

    // Wait for cleanup to complete
    await new Promise(resolve => setTimeout(resolve, 1000))
  })

  it('should handle extreme connection load without failures', async () => {
    const connectionCount = 20
    const connectPromises: Array<Promise<void>> = []
    let successfulConnections = 0
    let connectionErrors = 0

    // Create many connections simultaneously
    for (let i = 0; i < connectionCount; i++) {
      const client = new MgbaWebSocketClient(WEBSOCKET_URL)
      clients.push(client)

      connectPromises.push(
        client.connect()
          .then(() => {
            successfulConnections++
            console.log(`Connection ${i + 1}/${connectionCount} successful`)
          })
          .catch((error) => {
            connectionErrors++
            console.error(`Connection ${i + 1}/${connectionCount} failed:`, error)
            throw error // Fail the test if connections fail
          }),
      )

      // Small stagger to avoid overwhelming the server
      if (i % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    // All connections must succeed for production readiness
    await Promise.all(connectPromises)

    expect(successfulConnections).toBe(connectionCount)
    expect(connectionErrors).toBe(0)

    // Verify all connections are actually working
    const testPromises = clients.map(async (client, index) => {
      const result = await client.eval(`${index + 1000}`)
      expect(result.result).toBe(index + 1000)
    })

    await Promise.all(testPromises)
    console.log(`✅ All ${connectionCount} connections working correctly`)
  }, PRODUCTION_STRESS_TIMEOUT)

  it('should handle sustained high-frequency operations without drops', async () => {
    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    clients.push(client)
    await client.connect()

    const operationCount = 1000
    const batchSize = 10
    let completedOperations = 0
    let operationErrors = 0

    console.log(`Starting ${operationCount} operations in batches of ${batchSize}`)

    // Process operations in batches to test sustained load
    for (let batch = 0; batch < operationCount; batch += batchSize) {
      const batchPromises: Array<Promise<any>> = []

      for (let i = 0; i < batchSize && (batch + i) < operationCount; i++) {
        const operationId = batch + i

        batchPromises.push(
          client.eval(`${operationId}`)
            .then(result => {
              if (result.result !== operationId) {
                throw new Error(`Expected ${operationId}, got ${String(result.result)}`)
              }
              completedOperations++
              return result
            })
            .catch(error => {
              operationErrors++
              console.error(`Operation ${operationId} failed:`, error)
              throw error // Fail test on any operation failure
            }),
        )
      }

      // Wait for batch completion
      await Promise.all(batchPromises)

      // Brief pause between batches
      await new Promise(resolve => setTimeout(resolve, 10))

      if (batch % 100 === 0) {
        console.log(`Completed ${batch}/${operationCount} operations`)
      }
    }

    expect(completedOperations).toBe(operationCount)
    expect(operationErrors).toBe(0)
    expect(client.isConnected()).toBe(true)

    console.log(`✅ Successfully completed ${operationCount} operations without errors`)
  }, PRODUCTION_STRESS_TIMEOUT)

  it('should handle large memory operations without connection issues', async () => {
    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    clients.push(client)
    await client.connect()

    const testAddress = 0x02000000
    const largeSizes = [1024, 2048, 4096, 8192, 16384] // Test increasingly large reads

    for (const size of largeSizes) {
      console.log(`Testing memory operation with size ${size} bytes`)

      // Write test pattern
      const writePromises: Array<Promise<any>> = []
      for (let i = 0; i < size; i += 100) {
        const chunkSize = Math.min(100, size - i)
        const testPattern = Array.from({ length: chunkSize }, (_, j) => (i + j) % 256)

        writePromises.push(
          client.eval(`
            (function()
              local data = {${testPattern.join(',')}}
              for i = 1, #data do
                emu:write8(${testAddress + i}, data[i])
              end
            end)()
          `),
        )
      }

      await Promise.all(writePromises)

      // Read back and verify
      const readData = await client.getSharedBuffer(testAddress, size)
      expect(readData.length).toBe(size)

      // Verify pattern
      for (let i = 0; i < size; i++) {
        const expected = i % 256
        if (readData[i] !== expected) {
          throw new Error(`Data mismatch at offset ${i}: expected ${expected}, got ${readData[i]}`)
        }
      }

      console.log(`✅ Large memory operation (${size} bytes) successful`)
    }

    expect(client.isConnected()).toBe(true)
  }, PRODUCTION_STRESS_TIMEOUT)

  it('should handle complex memory watching scenarios without drops', async () => {
    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    clients.push(client)
    await client.connect()

    // Set up watching for multiple regions
    const baseAddress = 0x02001000
    const regions = Array.from({ length: 10 }, (_, i) => ({
      address: baseAddress + (i * 100),
      size: 50,
    }))

    client.configureSharedBuffer({ preloadRegions: regions })

    let totalChanges = 0
    const expectedChanges = regions.length * 20 // 20 changes per region

    // Set up change tracking
    const changePromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Memory watching timeout - only detected ${totalChanges}/${expectedChanges} changes`))
      }, 60000) // 1 minute timeout

      client.addMemoryChangeListener((address, size, _data) => {
        totalChanges++
        console.log(`Memory change ${totalChanges}: 0x${address.toString(16)} (${size} bytes)`)

        if (totalChanges >= expectedChanges) {
          clearTimeout(timeout)
          resolve()
        }
      })
    })

    await client.startWatchingPreloadRegions()

    // Generate complex memory change patterns
    const changePromises: Array<Promise<any>> = []

    for (let round = 0; round < 20; round++) {
      for (let regionIndex = 0; regionIndex < regions.length; regionIndex++) {
        const region = regions[regionIndex]
        if (!region) continue

        const testValue = (round * 10 + regionIndex) % 256

        changePromises.push(
          client.eval(`emu:write8(${region.address}, ${testValue})`)
            .then(() => new Promise(resolve => setTimeout(resolve, 50))), // Small delay
        )
      }

      // Process in waves
      if (round % 5 === 4) {
        await Promise.allSettled(changePromises.splice(0, changePromises.length))
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    await Promise.allSettled(changePromises)
    await changePromise

    expect(totalChanges).toBeGreaterThanOrEqual(expectedChanges * 0.9) // Allow for 10% missed changes
    expect(client.isConnected()).toBe(true)
    expect(client.isWatchingMemory()).toBe(true)

    console.log(`✅ Complex memory watching completed: ${totalChanges} changes detected`)
  }, PRODUCTION_STRESS_TIMEOUT)

  it('should handle error conditions gracefully without connection loss', async () => {
    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    clients.push(client)
    await client.connect()

    const errorTestCases = [
      'error("test error")',
      'nil.field', // Attempt to index nil
      'function() while true do end end()', // Infinite loop (should timeout)
      'string.rep("x", 1000000)', // Large string
      'emu:read8(0xFFFFFFFF)', // Invalid memory address
      '{[{}] = {}}', // Complex nested table
    ]

    let successfulRecoveries = 0

    for (let i = 0; i < errorTestCases.length; i++) {
      const errorCase = errorTestCases[i]
      if (!errorCase) continue

      console.log(`Testing error case ${i + 1}/${errorTestCases.length}: ${errorCase.substring(0, 50)}...`)

      try {
        await client.eval(errorCase)
        console.log(`Error case ${i + 1} unexpectedly succeeded`)
      } catch (error) {
        console.log(`Error case ${i + 1} failed as expected:`, error)
      }

      // Verify connection is still working after error
      try {
        const recoveryResult = await client.eval(`"recovery_test_${i}"`)
        expect(recoveryResult.result).toBe(`recovery_test_${i}`)
        successfulRecoveries++
        console.log(`✅ Recovery ${i + 1} successful`)
      } catch (error) {
        throw new Error(`Connection lost after error case ${i + 1}: ${String(error)}`)
      }

      // Brief pause between error tests
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    expect(successfulRecoveries).toBe(errorTestCases.length)
    expect(client.isConnected()).toBe(true)

    console.log(`✅ All ${errorTestCases.length} error conditions handled gracefully`)
  }, PRODUCTION_STRESS_TIMEOUT)

  it('should maintain performance under realistic Pokemon game simulation', async () => {
    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    clients.push(client)
    await client.connect()

    // Simulate Pokemon Emerald memory layout
    const gameAddresses = {
      partyCount: 0x20244e9,
      partyData: 0x20244ec,
      playerName: 0x2000000,
      gameStats: 0x2001000,
      bagData: 0x2002000,
    }

    client.configureSharedBuffer({
      preloadRegions: [
        { address: gameAddresses.partyCount, size: 1 },
        { address: gameAddresses.partyData, size: 600 },
        { address: gameAddresses.playerName, size: 32 },
        { address: gameAddresses.gameStats, size: 100 },
        { address: gameAddresses.bagData, size: 400 },
      ],
    })

    let memoryUpdates = 0
    client.addMemoryChangeListener(() => {
      memoryUpdates++
    })

    await client.startWatchingPreloadRegions()

    // Simulate realistic Pokemon gameplay scenarios
    const gameplayScenarios = [
      // Catch a Pokemon (party size changes)
      async () => {
        console.log('Simulating Pokemon catch...')
        await client.eval(`emu:write8(${gameAddresses.partyCount}, 1)`)
        await client.eval(`emu:write16(${gameAddresses.partyData}, 252)`) // Treecko
        await client.eval(`emu:write8(${gameAddresses.partyData + 10}, 5)`) // Level 5
      },

      // Level up Pokemon
      async () => {
        console.log('Simulating level up...')
        await client.eval(`emu:write8(${gameAddresses.partyData + 10}, 6)`) // Level 6
        await client.eval(`emu:write16(${gameAddresses.partyData + 20}, 25)`) // New HP
      },

      // Use item from bag
      async () => {
        console.log('Simulating item use...')
        await client.eval(`emu:write8(${gameAddresses.bagData + 5}, 10)`) // Item count change
      },

      // Pokemon faints and heals
      async () => {
        console.log('Simulating Pokemon faint/heal...')
        await client.eval(`emu:write16(${gameAddresses.partyData + 22}, 0)`) // Current HP = 0
        await new Promise(resolve => setTimeout(resolve, 100))
        await client.eval(`emu:write16(${gameAddresses.partyData + 22}, 25)`) // Heal to full HP
      },
    ]

    // Run multiple gameplay cycles
    const cycles = 20
    for (let cycle = 0; cycle < cycles; cycle++) {
      console.log(`Gameplay cycle ${cycle + 1}/${cycles}`)

      for (const scenario of gameplayScenarios) {
        await scenario()
        await new Promise(resolve => setTimeout(resolve, 150)) // Realistic timing

        // Verify we can still read data
        const partyData = await client.getSharedBuffer(gameAddresses.partyData, 50)
        expect(partyData.length).toBe(50)
      }

      // Periodic connectivity check
      const connectivityCheck = await client.eval('"connectivity_ok"')
      expect(connectivityCheck.result).toBe('connectivity_ok')
    }

    // Allow time for all memory updates to propagate
    await new Promise(resolve => setTimeout(resolve, 2000))

    expect(memoryUpdates).toBeGreaterThan(cycles * gameplayScenarios.length * 0.8)
    expect(client.isConnected()).toBe(true)
    expect(client.isWatchingMemory()).toBe(true)

    console.log(`✅ Realistic Pokemon simulation completed: ${memoryUpdates} memory updates detected`)
  }, PRODUCTION_STRESS_TIMEOUT)

  it('should handle rapid connection state changes without corruption', async () => {
    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    clients.push(client)

    const stateChangeCount = 50
    let successfulStateChanges = 0

    for (let i = 0; i < stateChangeCount; i++) {
      console.log(`State change ${i + 1}/${stateChangeCount}`)

      // Connect
      await client.connect()
      expect(client.isConnected()).toBe(true)

      // Brief operation to verify connection
      const result = await client.eval(`${i}`)
      expect(result.result).toBe(i)

      // Disconnect
      client.disconnect()
      expect(client.isConnected()).toBe(false)

      successfulStateChanges++

      // Small delay between state changes
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    expect(successfulStateChanges).toBe(stateChangeCount)
    console.log(`✅ Successfully completed ${stateChangeCount} connection state changes`)
  }, PRODUCTION_STRESS_TIMEOUT)
})
