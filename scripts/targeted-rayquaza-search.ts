#!/usr/bin/env tsx
/**
 * Small targeted reads around the Rayquaza location to avoid timeouts
 */

import { MgbaWebSocketClient } from '../src/lib/mgba/websocket-client.js'

class TargetedRayquazaSearch {
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

  async searchAroundRayquaza(): Promise<void> {
    const rayquazaAddr = 0x20078ea
    console.log(`\n🐉 Searching around Rayquaza at 0x${rayquazaAddr.toString(16)}...`)
    
    // First, verify Rayquaza is still there
    try {
      const rayquazaValue = await this.client.readWord(rayquazaAddr)
      console.log(`Rayquaza species ID at 0x${rayquazaAddr.toString(16)}: ${rayquazaValue}`)
      
      if (rayquazaValue !== 6) {
        console.log('❌ Rayquaza not found at expected location - searching for it again...')
        await this.findRayquazaAgain()
        return
      }
    } catch (error) {
      console.error('❌ Error reading Rayquaza location:', error)
      return
    }
    
    // Check potential Pokemon structure starts by testing backwards from Rayquaza
    console.log('\n🔍 Testing potential Pokemon structure starts...')
    
    // Test different species offset assumptions
    const possibleSpeciesOffsets = [0x00, 0x08, 0x20, 0x28, 0x30]
    
    for (const speciesOffset of possibleSpeciesOffsets) {
      const pokemonStart = rayquazaAddr - speciesOffset
      console.log(`\n📍 Testing Pokemon at 0x${pokemonStart.toString(16)} (species at +0x${speciesOffset.toString(16)})`)
      
      await this.testPokemonStructure(pokemonStart, speciesOffset)
    }
  }

  private async testPokemonStructure(pokemonStart: number, speciesOffset: number): Promise<void> {
    try {
      // Read species to confirm it's Rayquaza (6)
      const species = await this.client.readWord(pokemonStart + speciesOffset)
      if (species !== 6) {
        console.log(`  ❌ Species is ${species}, not 6 (Rayquaza)`)
        return
      }
      
      console.log(`  ✅ Species matches Rayquaza (6)`)
      
      // Test different level offset possibilities
      const levelOffsets = [0x54, 0x58, 0x5C, 0x04, 0x08]
      
      for (const levelOffset of levelOffsets) {
        try {
          const level = await this.client.readByte(pokemonStart + levelOffset)
          console.log(`    Level at +0x${levelOffset.toString(16)}: ${level}`)
          
          if (level === 41) {
            console.log(`    🎯 MATCH! Level 41 found - this could be the correct structure`)
            await this.validateFullParty(pokemonStart, speciesOffset, levelOffset)
          }
        } catch (error) {
          console.log(`    ❌ Error reading level at +0x${levelOffset.toString(16)}`)
        }
      }
      
    } catch (error) {
      console.log(`  ❌ Error testing structure: ${error}`)
    }
  }

  private async validateFullParty(partyStart: number, speciesOffset: number, levelOffset: number): Promise<void> {
    console.log(`\n🎉 Validating full party starting at 0x${partyStart.toString(16)}`)
    console.log(`Species offset: +0x${speciesOffset.toString(16)}, Level offset: +0x${levelOffset.toString(16)}`)
    
    const expectedParty = [
      { nickname: 'Steelix', speciesId: 208, level: 44 },
      { nickname: 'Breloom', speciesId: 286, level: 45 },
      { nickname: 'Snorlax', speciesId: 143, level: 47 },
      { nickname: 'Ludicolo', speciesId: 272, level: 45 },
      { nickname: 'Rayquaza', speciesId: 6, level: 41 },  
      { nickname: 'Sigilyph', speciesId: 561, level: 37 },
    ]
    
    const pokemonSizes = [104, 100, 80, 64]
    
    for (const pokemonSize of pokemonSizes) {
      console.log(`\n📏 Testing ${pokemonSize}-byte Pokemon structures:`)
      
      let matches = 0
      
      for (let slot = 0; slot < 6; slot++) {
        const pokemonAddr = partyStart + (slot * pokemonSize)
        const expected = expectedParty[slot]!
        
        try {
          const species = await this.client.readWord(pokemonAddr + speciesOffset)
          const level = await this.client.readByte(pokemonAddr + levelOffset)
          
          const isMatch = species === expected.speciesId && level === expected.level
          const status = isMatch ? '✅' : '❌'
          
          console.log(`  ${status} Slot ${slot}: Species ${species}, Level ${level} (Expected: ${expected.nickname} ${expected.speciesId} Lv${expected.level})`)
          
          if (isMatch) matches++
          
        } catch (error) {
          console.log(`  ❌ Slot ${slot}: Read error - ${error}`)
          break
        }
      }
      
      console.log(`  Summary: ${matches}/6 perfect matches`)
      
      if (matches >= 4) {
        console.log(`\n  🏆 HIGH CONFIDENCE MATCH FOUND!`)
        console.log(`  📝 Party Data: 0x${partyStart.toString(16)}`)
        console.log(`  📝 Pokemon Size: ${pokemonSize} bytes`)
        console.log(`  📝 Species Offset: +0x${speciesOffset.toString(16)}`) 
        console.log(`  📝 Level Offset: +0x${levelOffset.toString(16)}`)
        
        await this.findPartyCount(partyStart)
        return true
      }
    }
    
    return false
  }

  private async findPartyCount(partyAddr: number): Promise<void> {
    console.log(`\n🔍 Searching for party count near 0x${partyAddr.toString(16)}...`)
    
    const offsets = [-8, -4, -1, 0, 1, 4]
    
    for (const offset of offsets) {
      const testAddr = partyAddr + offset
      
      try {
        const value = await this.client.readByte(testAddr)
        const status = value === 6 ? '✅' : '  '
        console.log(`${status} Offset ${offset}: 0x${testAddr.toString(16)} = ${value}`)
        
        if (value === 6) {
          console.log(`\n🎯 FINAL ADDRESSES FOUND:`)
          console.log(`Party Data: 0x${partyAddr.toString(16)}`)
          console.log(`Party Count: 0x${testAddr.toString(16)}`)
          
          console.log(`\n📝 UPDATE QUETZAL CONFIG:`)
          console.log(`readonly memoryAddresses = {`)
          console.log(`  partyData: 0x${partyAddr.toString(16).toLowerCase()},`)
          console.log(`  partyCount: 0x${testAddr.toString(16).toLowerCase()},`)
          console.log(`} as const`)
          
          console.log(`\ncanHandleMemory(gameTitle: string): boolean {`)
          console.log(`  return gameTitle.toLowerCase().includes('quetzal')`)
          console.log(`}`)
          
          return
        }
      } catch {
        console.log(`   Offset ${offset}: 0x${testAddr.toString(16)} = [unreadable]`)
      }
    }
  }

  private async findRayquazaAgain(): Promise<void> {
    console.log('\n🔍 Re-searching for Rayquaza (species ID 6)...')
    
    // Search smaller region for species ID 6
    const searchStart = 0x02000000
    const searchSize = 0x10000  // 64KB
    
    for (let addr = searchStart; addr < searchStart + searchSize; addr += 2) {
      try {
        const value = await this.client.readWord(addr)
        if (value === 6) {
          console.log(`Found species ID 6 at 0x${addr.toString(16)}`)
          // Test if this could be Rayquaza by checking nearby for level 41
          await this.checkForLevel41(addr)
        }
      } catch {
        continue
      }
    }
  }

  private async checkForLevel41(speciesAddr: number): Promise<void> {
    const offsets = [0x30, 0x34, 0x38, 0x50, 0x54, 0x58, 0x5C]
    
    for (const offset of offsets) {
      try {
        const level = await this.client.readByte(speciesAddr + offset)
        if (level === 41) {
          console.log(`  🎯 Found level 41 at offset +0x${offset.toString(16)} - possible Rayquaza!`)
          await this.testPokemonStructure(speciesAddr, 0)
        }
      } catch {
        continue
      }
    }
  }

  disconnect(): void {
    this.client.disconnect()
  }
}

async function main(): Promise<void> {
  const searcher = new TargetedRayquazaSearch()
  
  try {
    await searcher.connect()
    
    // Wait a moment for emulator to stabilize
    console.log('⏳ Waiting for emulator to stabilize...')
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    await searcher.searchAroundRayquaza()
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    searcher.disconnect()
  }
}

// Run the searcher
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}