#!/usr/bin/env tsx
/**
 * Search for the actual savestate team mentioned in the comment
 */

import { MgbaWebSocketClient } from '../src/lib/mgba/websocket-client.js'

class SavestateTeamSearch {
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

  async searchForSavestateTeam(): Promise<void> {
    // Team from the comment: steelix Lv.44, breloom Lv.45, snorlax Lv.47, ludicolo Lv.45, charizard Lv.41, sigilyph Lv.37
    const savestateTeam = [
      { nickname: 'Steelix', speciesId: 208, level: 44 },     // Should match
      { nickname: 'Breloom', speciesId: 286, level: 45 },    // Should match
      { nickname: 'Snorlax', speciesId: 143, level: 47 },    // Should match  
      { nickname: 'Ludicolo', speciesId: 272, level: 45 },   // Should match
      { nickname: 'Charizard', speciesId: 6, level: 41 },    // Different from ground truth (was Rayquaza)
      { nickname: 'Sigilyph', speciesId: 561, level: 37 },   // Should match
    ]
    
    console.log('\n🎯 Searching for savestate team (with Charizard instead of Rayquaza):')
    console.log('Expected: Steelix(208)Lv44, Breloom(286)Lv45, Snorlax(143)Lv47, Ludicolo(272)Lv45, Charizard(6)Lv41, Sigilyph(561)Lv37')
    
    // Search for Charizard (species 6) first since that's the unique identifier
    console.log('\n🔍 Searching for Charizard (species ID 6)...')
    await this.findCharizardLocations()
  }

  private async findCharizardLocations(): Promise<void> {
    const searchStart = 0x02000000
    const searchSize = 0x40000  // Search larger area
    const charizardLocations: number[] = []
    
    console.log('Scanning memory for species ID 6 (Charizard)...')
    
    // Search in 1KB chunks to avoid timeouts
    for (let offset = 0; offset < searchSize; offset += 1024) {
      const addr = searchStart + offset
      const chunkSize = Math.min(1024, searchSize - offset)
      
      if (offset % (8 * 1024) === 0) {
        const progress = Math.floor((offset / searchSize) * 100)
        console.log(`📍 ${progress}% complete...`)
      }
      
      try {
        const chunk = await this.client.readBytes(addr, chunkSize)
        
        // Look for species ID 6 (16-bit little-endian)
        for (let i = 0; i <= chunk.length - 2; i += 2) {
          const species = chunk[i]! | (chunk[i + 1]! << 8)
          if (species === 6) {
            charizardLocations.push(addr + i)
          }
        }
      } catch {
        continue // Skip unreadable regions
      }
    }
    
    console.log(`\nFound ${charizardLocations.length} potential Charizard locations`)
    
    // Test each location to see if it's part of the expected party
    for (let i = 0; i < Math.min(charizardLocations.length, 20); i++) {
      const addr = charizardLocations[i]!
      console.log(`\n🎯 Testing location ${i + 1}: 0x${addr.toString(16)}`)
      
      await this.testCharizardLocation(addr)
    }
  }

  private async testCharizardLocation(charizardAddr: number): Promise<void> {
    // Test different assumptions about where species is in the Pokemon structure
    const speciesOffsets = [0x00, 0x28, 0x20, 0x08]
    
    for (const speciesOffset of speciesOffsets) {
      const pokemonStart = charizardAddr - speciesOffset
      
      console.log(`  Testing Pokemon structure at 0x${pokemonStart.toString(16)} (species at +0x${speciesOffset.toString(16)})`)
      
      // Test different level offsets
      const levelOffsets = [0x58, 0x54, 0x04, 0x08]
      
      for (const levelOffset of levelOffsets) {
        try {
          const level = await this.client.readByte(pokemonStart + levelOffset)
          console.log(`    Level at +0x${levelOffset.toString(16)}: ${level}`)
          
          if (level === 41) {
            console.log(`    🎯 Found level 41! Testing if this is the party...`)
            await this.testFullParty(pokemonStart, speciesOffset, levelOffset)
          }
        } catch {
          continue
        }
      }
    }
  }

  private async testFullParty(partyStart: number, speciesOffset: number, levelOffset: number): Promise<void> {
    const savestateTeam = [
      { nickname: 'Steelix', speciesId: 208, level: 44 },
      { nickname: 'Breloom', speciesId: 286, level: 45 },
      { nickname: 'Snorlax', speciesId: 143, level: 47 },
      { nickname: 'Ludicolo', speciesId: 272, level: 45 },
      { nickname: 'Charizard', speciesId: 6, level: 41 },  // Note: species 6 is actually Charizard's ID
      { nickname: 'Sigilyph', speciesId: 561, level: 37 },
    ]
    
    console.log(`\n    🔍 Testing full party at 0x${partyStart.toString(16)}:`)
    
    let matches = 0
    const pokemonSizes = [104, 100, 80]
    
    for (const pokemonSize of pokemonSizes) {
      console.log(`\n      📏 Testing ${pokemonSize}-byte Pokemon:`)
      let sizeMatches = 0
      
      for (let slot = 0; slot < 6; slot++) {
        const pokemonAddr = partyStart + (slot * pokemonSize)
        const expected = savestateTeam[slot]!
        
        try {
          const species = await this.client.readWord(pokemonAddr + speciesOffset)
          const level = await this.client.readByte(pokemonAddr + levelOffset)
          
          const isMatch = species === expected.speciesId && level === expected.level
          const status = isMatch ? '✅' : '❌'
          
          console.log(`        ${status} Slot ${slot}: Species ${species}, Level ${level} (Expected: ${expected.nickname} ${expected.speciesId} Lv${expected.level})`)
          
          if (isMatch) sizeMatches++
          
        } catch (error) {
          console.log(`        ❌ Slot ${slot}: Read error`)
          break
        }
      }
      
      console.log(`      Summary: ${sizeMatches}/6 matches`)
      
      if (sizeMatches >= 4) {
        console.log(`\n      🏆 HIGH CONFIDENCE MATCH!`)
        console.log(`      📝 Party Data: 0x${partyStart.toString(16)}`)
        console.log(`      📝 Pokemon Size: ${pokemonSize} bytes`)
        console.log(`      📝 Species Offset: +0x${speciesOffset.toString(16)}`)
        console.log(`      📝 Level Offset: +0x${levelOffset.toString(16)}`)
        
        await this.findPartyCount(partyStart)
        await this.outputFinalConfig(partyStart)
        return
      }
      
      matches = Math.max(matches, sizeMatches)
    }
    
    if (matches > 0) {
      console.log(`    ⚠️  Partial match (${matches}/6) - might be close`)
    }
  }

  private async findPartyCount(partyAddr: number): Promise<void> {
    console.log(`\n🔍 Searching for party count (6) near 0x${partyAddr.toString(16)}...`)
    
    const offsets = [-12, -8, -4, -1, 0, 1, 4]
    
    for (const offset of offsets) {
      const testAddr = partyAddr + offset
      
      try {
        const value = await this.client.readByte(testAddr)
        const status = value === 6 ? '✅' : '  '
        console.log(`${status} Offset ${offset}: 0x${testAddr.toString(16)} = ${value}`)
      } catch {
        console.log(`   Offset ${offset}: 0x${testAddr.toString(16)} = [unreadable]`)
      }
    }
  }

  private async outputFinalConfig(partyAddr: number): Promise<void> {
    console.log('\n' + '='.repeat(80))
    console.log('🎉 QUETZAL MEMORY ADDRESSES SUCCESSFULLY FOUND!')
    console.log('='.repeat(80))
    
    console.log('\nUpdate QuetzalConfig.memoryAddresses:')
    console.log('')
    console.log('readonly memoryAddresses = {')
    console.log(`  partyData: 0x${partyAddr.toString(16).toLowerCase()},`)
    console.log(`  partyCount: 0x${(partyAddr - 4).toString(16).toLowerCase()}, // Verify the exact offset`)
    console.log('} as const')
    console.log('')
    console.log('And enable memory support:')
    console.log('')
    console.log('canHandleMemory(gameTitle: string): boolean {')
    console.log('  return gameTitle.toLowerCase().includes("quetzal") ||')
    console.log('         gameTitle.includes("QUETZAL")')
    console.log('}')
    
    console.log('\n✅ SUCCESS! Memory addresses found for Quetzal ROM hack!')
    console.log('The savestate team has been located and validated.')
  }

  disconnect(): void {
    this.client.disconnect()
  }
}

async function main(): Promise<void> {
  const searcher = new SavestateTeamSearch()
  
  try {
    await searcher.connect()
    
    // Wait for emulator to stabilize
    console.log('⏳ Waiting for emulator to stabilize...')
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    await searcher.searchForSavestateTeam()
    
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