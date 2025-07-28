#!/usr/bin/env tsx
/**
 * Final targeted test of the most promising address
 */

import { MgbaWebSocketClient } from '../src/lib/mgba/websocket-client.js'

class FinalTest {
  private client: MgbaWebSocketClient

  constructor() {
    this.client = new MgbaWebSocketClient()
  }

  async connect(): Promise<void> {
    console.log('🔌 Connecting to mGBA WebSocket...')
    await this.client.connect()
    console.log('✅ Connected!')
    
    const title = await this.client.getGameTitle()
    console.log(`📜 Game: "${title}"`)
  }

  async testSpecificAddress(): Promise<void> {
    // Based on previous results, test this specific promising address
    const candidateAddr = 0x20078c2  // This showed species offset 0x28, level 45 at offset 0x58
    const speciesOffset = 0x28
    const levelOffset = 0x58
    const pokemonSize = 104
    
    console.log(`\n🎯 Testing candidate party address: 0x${candidateAddr.toString(16)}`)
    console.log(`Species offset: +0x${speciesOffset.toString(16)}, Level offset: +0x${levelOffset.toString(16)}`)
    
    const expectedParty = [
      { nickname: 'Steelix', speciesId: 208, level: 44 },
      { nickname: 'Breloom', speciesId: 286, level: 45 },
      { nickname: 'Snorlax', speciesId: 143, level: 47 },
      { nickname: 'Ludicolo', speciesId: 272, level: 45 },
      { nickname: 'Rayquaza', speciesId: 6, level: 41 },  
      { nickname: 'Sigilyph', speciesId: 561, level: 37 },
    ]
    
    let matches = 0
    
    console.log('\nTesting full party:')
    
    for (let slot = 0; slot < 6; slot++) {
      const pokemonAddr = candidateAddr + (slot * pokemonSize)
      const expected = expectedParty[slot]!
      
      try {
        const species = await this.client.readWord(pokemonAddr + speciesOffset)
        const level = await this.client.readByte(pokemonAddr + levelOffset)
        
        const isMatch = species === expected.speciesId && level === expected.level
        const status = isMatch ? '✅' : '❌'
        
        console.log(`${status} Slot ${slot}: Species ${species}, Level ${level} (Expected: ${expected.nickname} ${expected.speciesId} Lv${expected.level})`)
        
        if (isMatch) matches++
        
      } catch (error) {
        console.log(`❌ Slot ${slot}: Read error - ${error}`)
      }
    }
    
    console.log(`\nResult: ${matches}/6 perfect matches`)
    
    if (matches >= 4) {
      console.log('\n🏆 HIGH CONFIDENCE MATCH!')
      await this.findPartyCount(candidateAddr)
      await this.outputConfig(candidateAddr)
    } else if (matches > 0) {
      console.log('\n⚠️  Partial match - need to search more')
      await this.searchNearby(candidateAddr)
    } else {
      console.log('\n❌ No matches - searching for any species ID 6...')
      await this.findAllRayquaza()
    }
  }

  private async findPartyCount(partyAddr: number): Promise<number | null> {
    console.log(`\n🔍 Searching for party count near 0x${partyAddr.toString(16)}...`)
    
    const offsets = [-12, -8, -4, -1, 0, 1, 4, 8]
    let foundCountAddr: number | null = null
    
    for (const offset of offsets) {
      const testAddr = partyAddr + offset
      
      try {
        const value = await this.client.readByte(testAddr)
        const status = value === 6 ? '✅' : '  '
        console.log(`${status} Offset ${offset}: 0x${testAddr.toString(16)} = ${value}`)
        
        if (value === 6 && !foundCountAddr) {
          foundCountAddr = testAddr
        }
      } catch {
        console.log(`   Offset ${offset}: 0x${testAddr.toString(16)} = [unreadable]`)
      }
    }
    
    return foundCountAddr
  }

  private async outputConfig(partyAddr: number): Promise<void> {
    const countAddr = await this.findPartyCount(partyAddr)
    
    console.log('\n' + '='.repeat(80))
    console.log('🎉 QUETZAL MEMORY ADDRESSES FOUND!')
    console.log('='.repeat(80))
    
    console.log('\nUpdate src/lib/parser/games/quetzal/config.ts:')
    console.log('')
    console.log('readonly memoryAddresses = {')
    console.log(`  partyData: 0x${partyAddr.toString(16).toLowerCase()},`)
    if (countAddr) {
      console.log(`  partyCount: 0x${countAddr.toString(16).toLowerCase()},`)
    } else {
      console.log(`  partyCount: 0x${(partyAddr - 4).toString(16).toLowerCase()}, // Estimate`)
    }
    console.log('} as const')
    console.log('')
    console.log('And change canHandleMemory() to return true:')
    console.log('')
    console.log('canHandleMemory(gameTitle: string): boolean {')
    console.log('  return gameTitle.toLowerCase().includes("quetzal") ||')
    console.log('         gameTitle.includes("QUETZAL")')
    console.log('}')
    
    console.log('\n✅ TASK COMPLETE! Memory addresses discovered and validated.')
  }

  private async searchNearby(baseAddr: number): Promise<void> {
    console.log('\n🔍 Searching nearby addresses...')
    
    const searchRange = 0x1000  // Search 4KB around the base address
    const step = 4  // 4-byte alignment
    
    for (let offset = -searchRange; offset <= searchRange; offset += step) {
      const testAddr = baseAddr + offset
      
      try {
        const result = await this.quickTestAddress(testAddr)
        if (result.matches > 0) {
          console.log(`🎯 0x${testAddr.toString(16)}: ${result.matches}/6 matches`)
          
          if (result.matches >= 4) {
            console.log(`🏆 High confidence match found at 0x${testAddr.toString(16)}!`)
            await this.outputConfig(testAddr)
            return
          }
        }
      } catch {
        continue
      }
    }
  }

  private async quickTestAddress(addr: number): Promise<{matches: number}> {
    const expectedParty = [
      { speciesId: 208, level: 44 }, // Steelix
      { speciesId: 286, level: 45 }, // Breloom  
      { speciesId: 143, level: 47 }, // Snorlax
      { speciesId: 272, level: 45 }, // Ludicolo
      { speciesId: 6, level: 41 },   // Rayquaza
      { speciesId: 561, level: 37 }, // Sigilyph
    ]
    
    let matches = 0
    
    for (let slot = 0; slot < 6; slot++) {
      const pokemonAddr = addr + (slot * 104)
      const expected = expectedParty[slot]!
      
      try {
        const species = await this.client.readWord(pokemonAddr + 0x28)
        const level = await this.client.readByte(pokemonAddr + 0x58)
        
        if (species === expected.speciesId && level === expected.level) {
          matches++
        }
      } catch {
        break
      }
    }
    
    return { matches }
  }

  private async findAllRayquaza(): Promise<void> {
    console.log('\n🐉 Searching for all Rayquaza (species ID 6) in memory...')
    
    const searchStart = 0x02000000
    const searchSize = 0x20000  // 128KB
    
    const rayquazaLocations: number[] = []
    
    for (let addr = searchStart; addr < searchStart + searchSize; addr += 2) {
      try {
        const value = await this.client.readWord(addr)
        if (value === 6) {
          rayquazaLocations.push(addr)
          console.log(`Found species 6 at 0x${addr.toString(16)}`)
        }
      } catch {
        continue
      }
    }
    
    console.log(`\nFound ${rayquazaLocations.length} potential Rayquaza locations`)
    
    // Test each location
    for (const addr of rayquazaLocations) {
      console.log(`\nTesting 0x${addr.toString(16)}...`)
      
      // Try as start of Pokemon with species at beginning
      const testAddr1 = addr
      const result1 = await this.quickTestAddress(testAddr1)
      if (result1.matches > 0) {
        console.log(`  As Pokemon start: ${result1.matches}/6 matches`)
      }
      
      // Try as Pokemon with species at offset 0x28
      const testAddr2 = addr - 0x28
      const result2 = await this.quickTestAddress(testAddr2)
      if (result2.matches > 0) {
        console.log(`  As Pokemon with species at +0x28: ${result2.matches}/6 matches`)
        
        if (result2.matches >= 4) {
          console.log(`🏆 HIGH CONFIDENCE! Party at 0x${testAddr2.toString(16)}`)
          await this.outputConfig(testAddr2)
          return
        }
      }
    }
  }

  disconnect(): void {
    this.client.disconnect()
  }
}

async function main(): Promise<void> {
  const tester = new FinalTest()
  
  try {
    await tester.connect()
    
    // Wait for emulator to stabilize
    console.log('⏳ Waiting for emulator to stabilize...')
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    await tester.testSpecificAddress()
    
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    tester.disconnect()
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}