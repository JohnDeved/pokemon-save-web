#!/usr/bin/env tsx
/**
 * Find party count (6) in memory, then look for party data nearby
 */

import { MgbaWebSocketClient } from '../src/lib/mgba/websocket-client.js'

// Expected party data from ground truth
const EXPECTED_PARTY = [
  { nickname: 'Steelix', speciesId: 208, level: 44 },
  { nickname: 'Breloom', speciesId: 286, level: 45 },
  { nickname: 'Snorlax', speciesId: 143, level: 47 },
  { nickname: 'Ludicolo', speciesId: 272, level: 45 },
  { nickname: 'Rayquaza', speciesId: 6, level: 41 },  
  { nickname: 'Sigilyph', speciesId: 561, level: 37 },
]

const QUETZAL_POKEMON_SIZE = 104
const SPECIES_OFFSET = 0x28
const LEVEL_OFFSET = 0x58

class PartyCountFinder {
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

  async findPartyCount(): Promise<void> {
    console.log('\n🔍 Searching for party count (6) in EWRAM...')
    
    const EWRAM_START = 0x02000000
    const EWRAM_SIZE = 0x40000  // 256KB
    const CHUNK_SIZE = 4096
    
    const countCandidates: number[] = []
    
    for (let offset = 0; offset < EWRAM_SIZE; offset += CHUNK_SIZE) {
      const addr = EWRAM_START + offset
      const chunkSize = Math.min(CHUNK_SIZE, EWRAM_SIZE - offset)
      
      if (offset % (16 * CHUNK_SIZE) === 0) {
        const progress = Math.floor((offset / EWRAM_SIZE) * 100)
        console.log(`📍 Scanning 0x${addr.toString(16)} (${progress}%)`)
      }
      
      try {
        const chunk = await this.client.readBytes(addr, chunkSize)
        
        // Look for bytes with value 6
        for (let i = 0; i < chunk.length; i++) {
          if (chunk[i] === 6) {
            const candidateAddr = addr + i
            countCandidates.push(candidateAddr)
          }
        }
      } catch {
        continue
      }
    }
    
    console.log(`\n📊 Found ${countCandidates.length} locations with value 6`)
    
    // Test each candidate
    for (let i = 0; i < Math.min(countCandidates.length, 50); i++) {
      const countAddr = countCandidates[i]!
      console.log(`\n🎯 Testing candidate ${i + 1}: 0x${countAddr.toString(16)}`)
      
      await this.testPartyCountCandidate(countAddr)
    }
  }

  private async testPartyCountCandidate(countAddr: number): Promise<void> {
    // Test common offsets where party data might be relative to count
    const possibleOffsets = [1, 2, 3, 4, 8, 12, 16, 104, 208]
    
    for (const offset of possibleOffsets) {
      const partyAddr = countAddr + offset
      
      try {
        const score = await this.testPartyDataAddress(partyAddr)
        
        if (score > 0) {
          console.log(`   🎯 Offset +${offset}: 0x${partyAddr.toString(16)} (Score: ${score}/100)`)
          
          if (score >= 60) {
            console.log(`   🏆 HIGH SCORE! Detailed validation:`)
            await this.validatePartyAddress(partyAddr)
          }
        }
      } catch {
        continue
      }
    }
  }

  private async testPartyDataAddress(addr: number): Promise<number> {
    let score = 0
    
    try {
      for (let slot = 0; slot < 6; slot++) {
        const pokemonAddr = addr + (slot * QUETZAL_POKEMON_SIZE)
        const expected = EXPECTED_PARTY[slot]!
        
        const speciesId = await this.client.readWord(pokemonAddr + SPECIES_OFFSET)
        const level = await this.client.readByte(pokemonAddr + LEVEL_OFFSET)
        
        if (speciesId === expected.speciesId && level === expected.level) {
          score += 15 // Perfect match
        } else if (speciesId === expected.speciesId) {
          score += 8  // Species match
        } else if (level === expected.level) {
          score += 3  // Level match
        }
        
        // Sanity check
        if (speciesId > 0 && speciesId <= 1000 && level > 0 && level <= 100) {
          score += 1 // Valid Pokemon data
        }
      }
    } catch {
      return 0
    }
    
    return score
  }

  private async validatePartyAddress(addr: number): Promise<void> {
    let matches = 0
    
    for (let slot = 0; slot < 6; slot++) {
      const pokemonAddr = addr + (slot * QUETZAL_POKEMON_SIZE)
      const expected = EXPECTED_PARTY[slot]!
      
      try {
        const speciesId = await this.client.readWord(pokemonAddr + SPECIES_OFFSET)
        const level = await this.client.readByte(pokemonAddr + LEVEL_OFFSET)
        
        const isMatch = speciesId === expected.speciesId && level === expected.level
        const status = isMatch ? '✅' : '❌'
        
        console.log(`      ${status} Slot ${slot}: ${speciesId} Lv${level} (Expected: ${expected.nickname} ${expected.speciesId} Lv${expected.level})`)
        
        if (isMatch) matches++
        
      } catch (error) {
        console.log(`      ❌ Slot ${slot}: Read error`)
      }
    }
    
    if (matches === 6) {
      console.log(`\n      🎉 PERFECT MATCH! Party data at 0x${addr.toString(16)}`)
      console.log(`      📝 Party Count: Search for value 6 near this address`)
    } else if (matches >= 4) {
      console.log(`\n      ⚠️  ${matches}/6 matches - potential candidate`)
    }
  }

  disconnect(): void {
    this.client.disconnect()
  }
}

async function main(): Promise<void> {
  const finder = new PartyCountFinder()
  
  try {
    await finder.connect()
    await finder.findPartyCount()
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    finder.disconnect()
  }
}

// Run the finder
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}