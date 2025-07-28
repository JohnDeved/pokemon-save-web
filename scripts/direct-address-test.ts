#!/usr/bin/env tsx
/**
 * Direct test of specific addresses that are most likely to contain party data
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

// Most likely addresses to check (based on typical memory layouts and patterns)
const PRIORITY_ADDRESSES = [
  // Vanilla Emerald-based addresses (shifted)
  0x020244ec, // vanilla party data
  0x020244e8, // 4 bytes before
  0x020244f0, // 4 bytes after
  0x020244e0, // 12 bytes before
  0x02024500, // 20 bytes after
  
  // Common party data patterns in Pokemon games
  0x02020000, 0x02020100, 0x02020200, 0x02020300, 0x02020400, 0x02020500,
  0x02021000, 0x02021100, 0x02021200, 0x02021300, 0x02021400, 0x02021500,
  0x02022000, 0x02022100, 0x02022200, 0x02022300, 0x02022400, 0x02022500,
  0x02023000, 0x02023100, 0x02023200, 0x02023300, 0x02023400, 0x02023500,
  0x02024000, 0x02024100, 0x02024200, 0x02024300, 0x02024400, 0x02024500,
  0x02025000, 0x02025100, 0x02025200, 0x02025300, 0x02025400, 0x02025500,
  0x02026000, 0x02026100, 0x02026200, 0x02026300, 0x02026400, 0x02026500,
  0x02027000, 0x02027100, 0x02027200, 0x02027300, 0x02027400, 0x02027500,
  0x02028000, 0x02028100, 0x02028200, 0x02028300, 0x02028400, 0x02028500,
  0x02029000, 0x02029100, 0x02029200, 0x02029300, 0x02029400, 0x02029500,
  0x0202a000, 0x0202a100, 0x0202a200, 0x0202a300, 0x0202a400, 0x0202a500,
  
  // Additional common save data regions
  0x02030000, 0x02030100, 0x02030200, 0x02030300, 0x02030400, 0x02030500,
  0x02031000, 0x02031100, 0x02031200, 0x02031300, 0x02031400, 0x02031500,
  0x02032000, 0x02032100, 0x02032200, 0x02032300, 0x02032400, 0x02032500,
  0x02033000, 0x02033100, 0x02033200, 0x02033300, 0x02033400, 0x02033500,
  0x02034000, 0x02034100, 0x02034200, 0x02034300, 0x02034400, 0x02034500,
  0x02035000, 0x02035100, 0x02035200, 0x02035300, 0x02035400, 0x02035500,
]

class DirectAddressTester {
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

  async testAllAddresses(): Promise<void> {
    console.log(`\n🎯 Testing ${PRIORITY_ADDRESSES.length} priority addresses...`)
    console.log(`Looking for: ${EXPECTED_PARTY.map(p => `${p.nickname}(${p.speciesId})Lv${p.level}`).join(', ')}`)
    
    const results: Array<{address: number, score: number, details: string}> = []
    
    for (let i = 0; i < PRIORITY_ADDRESSES.length; i++) {
      const addr = PRIORITY_ADDRESSES[i]!
      
      if (i % 10 === 0) {
        console.log(`\n📍 Testing addresses ${i + 1}-${Math.min(i + 10, PRIORITY_ADDRESSES.length)}/${PRIORITY_ADDRESSES.length}`)
      }
      
      try {
        const result = await this.testAddress(addr)
        if (result.score > 0) {
          results.push(result)
          console.log(`🎯 0x${addr.toString(16)}: Score ${result.score}/100 - ${result.details}`)
          
          // If we found a very high score, do detailed validation immediately
          if (result.score >= 80) {
            console.log(`\n🏆 HIGH SCORE FOUND! Validating 0x${addr.toString(16)}...`)
            await this.detailedValidation(addr)
          }
        }
      } catch (error) {
        // Skip unreadable addresses
        continue
      }
    }
    
    // Sort results by score
    results.sort((a, b) => b.score - a.score)
    
    console.log('\n' + '='.repeat(80))
    console.log('📊 FINAL RESULTS')
    console.log('='.repeat(80))
    
    if (results.length === 0) {
      console.log('❌ No matching addresses found!')
      return
    }
    
    console.log(`Found ${results.length} candidate addresses:`)
    
    for (let i = 0; i < Math.min(results.length, 10); i++) {
      const result = results[i]!
      console.log(`${i + 1}. 0x${result.address.toString(16)} - Score: ${result.score}/100`)
      console.log(`   ${result.details}`)
    }
    
    // Validate the top candidates
    console.log('\n🔍 DETAILED VALIDATION OF TOP CANDIDATES:')
    for (let i = 0; i < Math.min(results.length, 3); i++) {
      const result = results[i]!
      console.log(`\n--- Candidate ${i + 1}: 0x${result.address.toString(16)} (Score: ${result.score}) ---`)
      await this.detailedValidation(result.address)
    }
  }

  private async testAddress(addr: number): Promise<{address: number, score: number, details: string}> {
    let score = 0
    const details: string[] = []
    
    try {
      let perfectMatches = 0
      let speciesMatches = 0
      let levelMatches = 0
      const pokemonData: Array<{species: number, level: number}> = []
      
      // Test all 6 Pokemon slots
      for (let slot = 0; slot < 6; slot++) {
        const pokemonAddr = addr + (slot * QUETZAL_POKEMON_SIZE)
        const expected = EXPECTED_PARTY[slot]!
        
        const speciesId = await this.client.readWord(pokemonAddr + SPECIES_OFFSET)
        const level = await this.client.readByte(pokemonAddr + LEVEL_OFFSET)
        
        pokemonData.push({species: speciesId, level})
        
        // Check for perfect matches
        if (speciesId === expected.speciesId && level === expected.level) {
          perfectMatches++
          score += 15 // 15 points per perfect match
        } else {
          // Check for partial matches
          if (speciesId === expected.speciesId) {
            speciesMatches++
            score += 8 // 8 points for species match
          }
          if (level === expected.level) {
            levelMatches++
            score += 3 // 3 points for level match
          }
        }
      }
      
      // Bonus points for data structure validity
      const validPokemon = pokemonData.filter(p => 
        p.species > 0 && p.species <= 1000 && 
        p.level > 0 && p.level <= 100
      )
      
      if (validPokemon.length === 6) {
        score += 10 // All Pokemon have valid stats
      }
      
      if (perfectMatches > 0) {
        details.push(`${perfectMatches} perfect matches`)
      }
      if (speciesMatches > 0) {
        details.push(`${speciesMatches} species matches`)
      }
      if (levelMatches > 0) {
        details.push(`${levelMatches} level matches`)
      }
      
      details.push(`Pokemon: ${pokemonData.map(p => `${p.species}(${p.level})`).join(', ')}`)
      
    } catch (error) {
      score = 0
      details.push(`Read error: ${error}`)
    }
    
    return {
      address: addr,
      score,
      details: details.join('; ')
    }
  }

  private async detailedValidation(addr: number): Promise<void> {
    console.log(`🔍 Detailed validation of 0x${addr.toString(16)}:`)
    
    let perfectCount = 0
    
    for (let slot = 0; slot < 6; slot++) {
      const pokemonAddr = addr + (slot * QUETZAL_POKEMON_SIZE)
      const expected = EXPECTED_PARTY[slot]!
      
      try {
        const speciesId = await this.client.readWord(pokemonAddr + SPECIES_OFFSET)
        const level = await this.client.readByte(pokemonAddr + LEVEL_OFFSET)
        
        const match = speciesId === expected.speciesId && level === expected.level
        const status = match ? '✅' : '❌'
        
        console.log(`${status} Slot ${slot}: Species ${speciesId}, Level ${level} (Expected: ${expected.nickname} ${expected.speciesId} Lv${expected.level})`)
        
        if (match) perfectCount++
        
      } catch (error) {
        console.log(`❌ Slot ${slot}: Read error - ${error}`)
      }
    }
    
    console.log(`Summary: ${perfectCount}/6 perfect matches`)
    
    if (perfectCount === 6) {
      console.log('\n🎉 PERFECT MATCH FOUND! This is the correct party data address!')
      await this.findPartyCountAddress(addr)
      await this.generateConfigUpdate(addr)
    } else if (perfectCount >= 4) {
      console.log('\n⚠️  High confidence match - might be correct with minor issues')
    } else {
      console.log('\n❌ Low confidence - likely not the correct address')
    }
  }

  private async findPartyCountAddress(partyAddr: number): Promise<number | null> {
    console.log('\n🔍 Searching for party count address...')
    
    // Check common offsets relative to party data
    const offsetsToCheck = [-12, -8, -4, -1, 0, 1, 4, 8]
    
    for (const offset of offsetsToCheck) {
      const testAddr = partyAddr + offset
      
      try {
        const value = await this.client.readByte(testAddr)
        const status = value === 6 ? '✅' : '  '
        console.log(`${status} Offset ${offset}: 0x${testAddr.toString(16)} = ${value}`)
        
        if (value === 6) {
          console.log(`✅ Found party count (6) at 0x${testAddr.toString(16)}`)
          return testAddr
        }
      } catch {
        console.log(`   Offset ${offset}: 0x${testAddr.toString(16)} = [unreadable]`)
      }
    }
    
    console.log('❌ Could not find party count address')
    return null
  }

  private async generateConfigUpdate(partyAddr: number): Promise<void> {
    console.log('\n' + '='.repeat(80))
    console.log('📝 CONFIGURATION UPDATE')
    console.log('='.repeat(80))
    
    const partyCountAddr = await this.findPartyCountAddress(partyAddr)
    
    console.log('\nUpdate QuetzalConfig with these addresses:')
    console.log('')
    console.log('readonly memoryAddresses = {')
    console.log(`  partyData: 0x${partyAddr.toString(16).toLowerCase()},`)
    if (partyCountAddr) {
      console.log(`  partyCount: 0x${partyCountAddr.toString(16).toLowerCase()},`)
    } else {
      console.log(`  partyCount: 0x${(partyAddr - 4).toString(16).toLowerCase()}, // Estimate - verify manually`)
    }
    console.log('} as const')
    console.log('')
    console.log('And enable memory support:')
    console.log('')
    console.log('canHandleMemory(gameTitle: string): boolean {')
    console.log('  return gameTitle.toLowerCase().includes("quetzal") ||')
    console.log('         gameTitle.includes("QUETZAL") ||')
    console.log('         gameTitle.includes("EMER")')
    console.log('}')
    
    console.log('\n🎉 QUETZAL MEMORY ADDRESSES SUCCESSFULLY DISCOVERED!')
  }

  disconnect(): void {
    this.client.disconnect()
  }
}

async function main(): Promise<void> {
  const tester = new DirectAddressTester()
  
  try {
    await tester.connect()
    await tester.testAllAddresses()
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    tester.disconnect()
  }
}

// Run the tester
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}