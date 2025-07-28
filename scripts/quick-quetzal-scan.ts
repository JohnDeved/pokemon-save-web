#!/usr/bin/env tsx
/**
 * Quick targeted scan for Quetzal party data around known memory regions
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

// Quetzal Pokemon structure info
const QUETZAL_POKEMON_SIZE = 104
const SPECIES_OFFSET = 0x28  // 40 bytes into structure
const LEVEL_OFFSET = 0x58    // 88 bytes into structure

// Targeted memory regions to search (based on typical Pokemon game layouts)
const TARGET_REGIONS = [
  // Around vanilla addresses
  { start: 0x02020000, size: 0x10000, name: 'Near vanilla party region' },
  { start: 0x02030000, size: 0x10000, name: 'Extended party region' },
  // Common save data regions
  { start: 0x02000000, size: 0x8000, name: 'Early EWRAM' },
  { start: 0x02038000, size: 0x8000, name: 'Late EWRAM' },
]

class QuickQuetzalScanner {
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
    if (!title.toLowerCase().includes('quetzal')) {
      throw new Error('Not connected to Quetzal ROM!')
    }
  }

  async scanForPartyData(): Promise<void> {
    console.log('\n🔍 Quick scanning for party data...')
    
    const candidates: Array<{address: number, matches: number, details: string}> = []
    
    for (const region of TARGET_REGIONS) {
      console.log(`\n📍 Scanning ${region.name} (0x${region.start.toString(16)} - 0x${(region.start + region.size).toString(16)})`)
      
      // Scan in 4-byte aligned increments
      for (let addr = region.start; addr < region.start + region.size; addr += 4) {
        try {
          const matches = await this.checkAddress(addr)
          if (matches > 0) {
            const details = await this.getAddressDetails(addr)
            candidates.push({ address: addr, matches, details })
            
            console.log(`🎯 Found ${matches}/6 matches at 0x${addr.toString(16)}: ${details}`)
            
            // If we found a perfect match, validate it thoroughly
            if (matches >= 5) {
              console.log(`\n🏆 HIGH CONFIDENCE MATCH at 0x${addr.toString(16)}!`)
              await this.validateFullParty(addr)
            }
          }
        } catch {
          // Skip unreadable addresses
          continue
        }
      }
    }
    
    // Sort candidates by number of matches
    candidates.sort((a, b) => b.matches - a.matches)
    
    console.log('\n📊 SCAN RESULTS:')
    console.log('=' .repeat(80))
    
    for (let i = 0; i < Math.min(candidates.length, 10); i++) {
      const candidate = candidates[i]!
      console.log(`${i + 1}. 0x${candidate.address.toString(16)} - ${candidate.matches}/6 matches`)
      console.log(`   ${candidate.details}`)
    }
    
    if (candidates.length === 0) {
      console.log('❌ No party data found!')
    } else {
      const best = candidates[0]!
      console.log(`\n🎯 BEST CANDIDATE: 0x${best.address.toString(16)} (${best.matches}/6 matches)`)
      
      // Do final validation
      await this.finalValidation(best.address)
    }
  }

  private async checkAddress(addr: number): Promise<number> {
    let matches = 0
    
    try {
      // Check each expected Pokemon
      for (let slot = 0; slot < 6; slot++) {
        const pokemonAddr = addr + (slot * QUETZAL_POKEMON_SIZE)
        
        const speciesId = await this.client.readWord(pokemonAddr + SPECIES_OFFSET)
        const level = await this.client.readByte(pokemonAddr + LEVEL_OFFSET)
        
        const expected = EXPECTED_PARTY[slot]!
        
        // Count exact matches
        if (speciesId === expected.speciesId && level === expected.level) {
          matches++
        }
      }
    } catch {
      return 0
    }
    
    return matches
  }

  private async getAddressDetails(addr: number): Promise<string> {
    const details: string[] = []
    
    try {
      for (let slot = 0; slot < 6; slot++) {
        const pokemonAddr = addr + (slot * QUETZAL_POKEMON_SIZE)
        
        const speciesId = await this.client.readWord(pokemonAddr + SPECIES_OFFSET)
        const level = await this.client.readByte(pokemonAddr + LEVEL_OFFSET)
        
        const expected = EXPECTED_PARTY[slot]!
        
        if (speciesId === expected.speciesId && level === expected.level) {
          details.push(`✓ Slot${slot}(${expected.nickname})`)
        } else if (speciesId === expected.speciesId) {
          details.push(`~ Slot${slot}(species=${speciesId},lv=${level})`)
        }
      }
    } catch {
      details.push('Read error')
    }
    
    return details.join(', ')
  }

  private async validateFullParty(addr: number): Promise<void> {
    console.log(`\n🔍 Full validation of 0x${addr.toString(16)}:`)
    
    let perfectMatches = 0
    
    for (let slot = 0; slot < 6; slot++) {
      const pokemonAddr = addr + (slot * QUETZAL_POKEMON_SIZE)
      const expected = EXPECTED_PARTY[slot]!
      
      try {
        const speciesId = await this.client.readWord(pokemonAddr + SPECIES_OFFSET)
        const level = await this.client.readByte(pokemonAddr + LEVEL_OFFSET)
        
        console.log(`Slot ${slot}: Species ${speciesId}, Level ${level} (Expected: ${expected.nickname} ${expected.speciesId} Lv${expected.level})`)
        
        if (speciesId === expected.speciesId && level === expected.level) {
          console.log(`   ✅ PERFECT MATCH`)
          perfectMatches++
        } else {
          console.log(`   ❌ Mismatch`)
        }
        
      } catch (error) {
        console.log(`   ❌ Read error: ${error}`)
      }
    }
    
    if (perfectMatches === 6) {
      console.log('\n🎉 PERFECT PARTY MATCH - THIS IS THE CORRECT ADDRESS!')
      await this.findPartyCount(addr)
    } else {
      console.log(`\n⚠️  Only ${perfectMatches}/6 perfect matches`)
    }
  }

  private async findPartyCount(partyAddr: number): Promise<void> {
    console.log('\n🔍 Searching for party count near party data...')
    
    // Check common offsets before party data
    const offsets = [-8, -4, -1]
    
    for (const offset of offsets) {
      const testAddr = partyAddr + offset
      
      try {
        const value = await this.client.readByte(testAddr)
        console.log(`Offset ${offset}: 0x${testAddr.toString(16)} = ${value}`)
        
        if (value === 6) {
          console.log(`✅ Found party count (6) at 0x${testAddr.toString(16)}`)
        }
      } catch (error) {
        console.log(`Offset ${offset}: Read error`)
      }
    }
  }

  private async finalValidation(addr: number): Promise<void> {
    console.log('\n' + '='.repeat(80))
    console.log('🏁 FINAL VALIDATION')
    console.log('='.repeat(80))
    
    await this.validateFullParty(addr)
    
    console.log('\n📝 If validation successful, update QuetzalConfig:')
    console.log(`readonly memoryAddresses = {`)
    console.log(`  partyData: 0x${addr.toString(16)},`)
    console.log(`  partyCount: 0x${(addr - 4).toString(16)}, // Try different offsets`)  
    console.log(`}`)
  }

  disconnect(): void {
    this.client.disconnect()
  }
}

async function main(): Promise<void> {
  const scanner = new QuickQuetzalScanner()
  
  try {
    await scanner.connect()
    await scanner.scanForPartyData()
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    scanner.disconnect()
  }
}

// Run the scanner
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}