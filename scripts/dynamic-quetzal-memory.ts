#!/usr/bin/env tsx
/**
 * Dynamic Quetzal memory address discovery approach
 * Since addresses are volatile, implement real-time scanning
 */

import { MgbaWebSocketClient } from '../src/lib/mgba/websocket-client.js'
import { QuetzalConfig } from '../src/lib/parser/games/quetzal/config.js'

interface DynamicMemoryState {
  partyCountAddr: number | null
  partyDataAddr: number | null
  partyCount: number
  pokemon: Array<{
    species: string | undefined
    level: number
  }>
  scanTime: number
}

class DynamicQuetzalMemoryReader {
  private client: MgbaWebSocketClient
  private config: QuetzalConfig
  private lastKnownState: DynamicMemoryState | null = null

  constructor(client: MgbaWebSocketClient) {
    this.client = client
    this.config = new QuetzalConfig()
  }

  /**
   * Scan for Pokemon party data using pattern recognition
   * This addresses the volatile memory issue by finding data dynamically
   */
  async scanForPartyData(): Promise<DynamicMemoryState> {
    const startTime = Date.now()
    console.log('🔍 Dynamic scan for party data...')

    // Define scan regions - focus on areas where we've seen Pokemon data
    const scanRegions = [
      { start: 0x2024000, end: 0x2025000, name: 'Primary region' },
      { start: 0x2025000, end: 0x2026000, name: 'Secondary region' },
      { start: 0x2026000, end: 0x2027000, name: 'Tertiary region' },
    ]

    for (const region of scanRegions) {
      console.log(`   Scanning ${region.name} (0x${region.start.toString(16)} - 0x${region.end.toString(16)})`)
      
      for (let addr = region.start; addr < region.end; addr += 4) {
        try {
          const partyCount = await this.client.readByte(addr)
          
          if (partyCount >= 1 && partyCount <= 6) {
            // Potential party count found, verify with Pokemon data
            const partyDataAddr = addr + 4
            const result = await this.validatePartyData(addr, partyDataAddr, partyCount)
            
            if (result.valid) {
              const scanTime = Date.now() - startTime
              console.log(`   ✅ Found valid party data at 0x${addr.toString(16)} (${scanTime}ms)`)
              
              return {
                partyCountAddr: addr,
                partyDataAddr: partyDataAddr,
                partyCount: result.partyCount,
                pokemon: result.pokemon,
                scanTime
              }
            }
          }
        } catch (e) {
          // Skip invalid addresses
        }
      }
    }

    // No valid data found
    return {
      partyCountAddr: null,
      partyDataAddr: null,
      partyCount: 0,
      pokemon: [],
      scanTime: Date.now() - startTime
    }
  }

  private async validatePartyData(partyCountAddr: number, partyDataAddr: number, partyCount: number): Promise<{
    valid: boolean
    partyCount: number
    pokemon: Array<{species: string | undefined, level: number}>
  }> {
    try {
      const pokemonData = await this.client.readBytes(partyDataAddr, partyCount * 104)
      const pokemon: Array<{species: string | undefined, level: number}> = []
      let validCount = 0

      for (let i = 0; i < partyCount; i++) {
        const offset = i * 104
        const pokeData = pokemonData.slice(offset, offset + 104)
        const view = new DataView(pokeData.buffer)

        const species = this.config.getPokemonName(pokeData, view)
        const level = view.getUint8(0x58)
        const currentHp = view.getUint16(0x23, true)
        const maxHp = view.getUint16(0x5A, true)

        pokemon.push({ species, level })

        // Validate Pokemon data
        if (level >= 1 && level <= 100 && 
            currentHp >= 0 && maxHp > 0 && 
            species && species !== 'Unknown') {
          validCount++
        }
      }

      // Consider valid if at least 80% of Pokemon look reasonable
      const valid = validCount >= Math.ceil(partyCount * 0.8)

      return { valid, partyCount, pokemon }
    } catch (e) {
      return { valid: false, partyCount: 0, pokemon: [] }
    }
  }

  /**
   * Get current party state using dynamic discovery
   */
  async getCurrentPartyState(): Promise<DynamicMemoryState> {
    // Try last known addresses first (cache optimization)
    if (this.lastKnownState?.partyCountAddr && this.lastKnownState?.partyDataAddr) {
      try {
        const partyCount = await this.client.readByte(this.lastKnownState.partyCountAddr)
        if (partyCount >= 1 && partyCount <= 6) {
          const result = await this.validatePartyData(
            this.lastKnownState.partyCountAddr, 
            this.lastKnownState.partyDataAddr, 
            partyCount
          )
          
          if (result.valid) {
            console.log('✅ Cache hit: Using last known addresses')
            return {
              ...this.lastKnownState,
              partyCount: result.partyCount,
              pokemon: result.pokemon,
              scanTime: 0 // Cache hit
            }
          }
        }
      } catch (e) {
        console.log('❌ Cache miss: Last known addresses invalid')
      }
    }

    // Cache miss or no cache - perform full scan
    const state = await this.scanForPartyData()
    this.lastKnownState = state
    return state
  }
}

async function testDynamicApproach(): Promise<void> {
  console.log('🧪 Testing Dynamic Memory Discovery Approach')
  console.log('='.repeat(50))

  const client = new MgbaWebSocketClient('ws://localhost:7102/ws')
  const dynamicReader = new DynamicQuetzalMemoryReader(client)

  try {
    await client.connect()
    const gameTitle = await client.getGameTitle()
    console.log(`🎮 Game: ${gameTitle}`)

    // Test 1: Get current state
    console.log('\n📋 Test 1: Dynamic discovery of current party')
    const state1 = await dynamicReader.getCurrentPartyState()
    
    if (state1.partyCountAddr) {
      console.log(`✅ Found party data dynamically:`)
      console.log(`   Party Count Address: 0x${state1.partyCountAddr.toString(16)}`)
      console.log(`   Party Data Address:  0x${state1.partyDataAddr!.toString(16)}`)
      console.log(`   Party Count: ${state1.partyCount}`)
      console.log(`   Scan Time: ${state1.scanTime}ms`)
      console.log(`   Pokemon:`)
      state1.pokemon.forEach((p, i) => {
        console.log(`     ${i + 1}. ${p.species || 'Unknown'} Lv.${p.level}`)
      })
    } else {
      console.log('❌ No party data found')
    }

    // Test 2: Test cache efficiency (should be faster)
    console.log('\n📋 Test 2: Cache efficiency test')
    const state2 = await dynamicReader.getCurrentPartyState()
    console.log(`⚡ Cache test scan time: ${state2.scanTime}ms`)

    // Test 3: Recommendation for implementation
    console.log('\n🔧 IMPLEMENTATION RECOMMENDATION:')
    if (state1.partyCountAddr) {
      console.log('✅ Dynamic discovery approach WORKS!')
      console.log('\n📋 Recommended changes for QuetzalConfig:')
      console.log('1. Remove fixed memoryAddresses')
      console.log('2. Implement dynamic scanForPartyData() method')
      console.log('3. Cache last known addresses for performance')
      console.log('4. Fall back to scan when cache fails')
      
      console.log('\n💡 Benefits:')
      console.log('   - Works across all savestates')
      console.log('   - Adapts to dynamic memory allocation')
      console.log('   - Fast cache-based reads after initial discovery')
      console.log('   - More robust than fixed addresses')
      
      console.log('\n⚠️  Trade-offs:')
      console.log('   - Initial scan takes ~100-500ms')
      console.log('   - Requires periodic cache validation')
      console.log('   - More complex implementation')
    } else {
      console.log('❌ Dynamic approach failed - need different strategy')
    }

  } catch (error) {
    console.error(`❌ Error: ${error}`)
  } finally {
    client.disconnect()
  }
}

// Handle command line usage
if (import.meta.url === `file://${process.argv[1]}`) {
  testDynamicApproach().catch(console.error)
}

export { DynamicQuetzalMemoryReader, testDynamicApproach }