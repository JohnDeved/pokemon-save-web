#!/usr/bin/env tsx
/**
 * Comprehensive script to find correct memory addresses for Quetzal ROM hack
 * This script systematically scans memory to find party Pokemon data
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
const SPECIES_OFFSET = 0x28
const LEVEL_OFFSET = 0x58
const NICKNAME_OFFSET = 0x0A // 10 bytes for nickname
const NICKNAME_LENGTH = 10

// Memory scanning ranges (EWRAM)
const EWRAM_START = 0x02000000
const EWRAM_SIZE = 0x40000  // 256KB
const EWRAM_END = EWRAM_START + EWRAM_SIZE

// IWRAM range
const IWRAM_START = 0x03000000  
const IWRAM_SIZE = 0x8000     // 32KB
const IWRAM_END = IWRAM_START + IWRAM_SIZE

interface MemoryMatch {
  address: number
  confidence: number
  details: string
  pokemonFound: Array<{ speciesId: number, level: number, nickname: string }>
}

class QuetzalMemoryScanner {
  private client: MgbaWebSocketClient

  constructor() {
    this.client = new MgbaWebSocketClient()
  }

  async connect(): Promise<void> {
    console.log('🔌 Connecting to mGBA WebSocket...')
    await this.client.connect()
    console.log('✅ Connected to mGBA WebSocket!')
  }

  async verifyGameTitle(): Promise<boolean> {
    console.log('🎮 Verifying game title...')
    const title = await this.client.getGameTitle()
    console.log(`📜 Game title: "${title}"`)
    
    const isQuetzal = title.toLowerCase().includes('quetzal') || title.includes('QUETZAL')
    if (isQuetzal) {
      console.log('✅ Confirmed: Game is Quetzal ROM hack')
      return true
    } else {
      console.log('❌ ERROR: Game title does not contain "Quetzal"')
      return false
    }
  }

  async scanMemoryForParty(): Promise<MemoryMatch[]> {
    console.log('🔍 Starting comprehensive memory scan for party data...')
    console.log(`📊 Expected party: ${EXPECTED_PARTY.map(p => `${p.nickname}(${p.speciesId})Lv${p.level}`).join(', ')}`)
    
    const matches: MemoryMatch[] = []
    
    // Scan EWRAM first (most likely location)
    console.log(`\n🔎 Scanning EWRAM (0x${EWRAM_START.toString(16)} - 0x${EWRAM_END.toString(16)})...`)
    await this.scanMemoryRange(EWRAM_START, EWRAM_SIZE, matches)
    
    // Also scan IWRAM in case party data is there
    console.log(`\n🔎 Scanning IWRAM (0x${IWRAM_START.toString(16)} - 0x${IWRAM_END.toString(16)})...`)
    await this.scanMemoryRange(IWRAM_START, IWRAM_SIZE, matches)
    
    return matches
  }

  private async scanMemoryRange(startAddr: number, size: number, matches: MemoryMatch[]): Promise<void> {
    const SCAN_CHUNK_SIZE = 4096  // Scan in 4KB chunks for efficiency
    const progressInterval = Math.floor(size / (20 * SCAN_CHUNK_SIZE)) || 1 // Show progress 20 times
    
    for (let offset = 0; offset < size; offset += SCAN_CHUNK_SIZE) {
      const currentAddr = startAddr + offset
      const chunkSize = Math.min(SCAN_CHUNK_SIZE, size - offset)
      
      // Show progress
      if (offset % (progressInterval * SCAN_CHUNK_SIZE) === 0) {
        const progressPercent = Math.floor((offset / size) * 100)
        console.log(`   📍 Scanning 0x${currentAddr.toString(16)} (${progressPercent}%)`)
      }
      
      try {
        // Read memory chunk
        const chunk = await this.client.readBytes(currentAddr, chunkSize)
        
        // Scan for potential party data starting points
        for (let i = 0; i <= chunk.length - (6 * QUETZAL_POKEMON_SIZE); i += 4) { // Align to 4-byte boundaries
          const address = currentAddr + i
          
          if (await this.checkPotentialPartyLocation(address)) {
            const match = await this.analyzePartyLocation(address)
            if (match.confidence > 0) {
              matches.push(match)
              console.log(`\n🎯 POTENTIAL MATCH at 0x${address.toString(16)}:`)
              console.log(`   Confidence: ${match.confidence}/100`)
              console.log(`   Details: ${match.details}`)
              console.log(`   Pokemon found: ${match.pokemonFound.map(p => `${p.nickname}(${p.speciesId})Lv${p.level}`).join(', ')}`)
            }
          }
        }
        
      } catch (error) {
        // Skip unreadable memory regions
        continue
      }
    }
  }

  private async checkPotentialPartyLocation(address: number): Promise<boolean> {
    try {
      // Quick check: read first pokemon's species and level to see if it looks valid
      const speciesId = await this.client.readWord(address + SPECIES_OFFSET)
      const level = await this.client.readByte(address + LEVEL_OFFSET)
      
      // Basic sanity checks
      return speciesId > 0 && speciesId <= 1000 && level > 0 && level <= 100
    } catch {
      return false
    }
  }

  private async analyzePartyLocation(address: number): Promise<MemoryMatch> {
    const pokemonFound: Array<{ speciesId: number, level: number, nickname: string }> = []
    let confidence = 0
    const details: string[] = []
    
    try {
      // Check up to 6 Pokemon slots
      for (let slot = 0; slot < 6; slot++) {
        const pokemonAddr = address + (slot * QUETZAL_POKEMON_SIZE)
        
        try {
          const speciesId = await this.client.readWord(pokemonAddr + SPECIES_OFFSET)
          const level = await this.client.readByte(pokemonAddr + LEVEL_OFFSET)
          
          // Read nickname (10 bytes)
          const nicknameBytes = await this.client.readBytes(pokemonAddr + NICKNAME_OFFSET, NICKNAME_LENGTH)
          const nickname = this.parseNickname(nicknameBytes)
          
          // Skip empty slots (species 0)
          if (speciesId === 0) break
          
          pokemonFound.push({ speciesId, level, nickname })
          
          // Check if this matches expected party
          const expectedPokemon = EXPECTED_PARTY[slot]
          if (expectedPokemon) {
            if (speciesId === expectedPokemon.speciesId) {
              confidence += 30 // Species match
              details.push(`✓ Slot ${slot}: Species ${speciesId} matches expected`)
            }
            if (level === expectedPokemon.level) {
              confidence += 20 // Level match  
              details.push(`✓ Slot ${slot}: Level ${level} matches expected`)
            }
            if (nickname === expectedPokemon.nickname) {
              confidence += 40 // Nickname match (most reliable)
              details.push(`✓ Slot ${slot}: Nickname "${nickname}" matches expected`)
            }
          }
          
        } catch (error) {
          // Couldn't read this Pokemon slot
          break
        }
      }
      
      // Bonus points for finding exactly 6 Pokemon
      if (pokemonFound.length === 6) {
        confidence += 10
        details.push('✓ Found exactly 6 Pokemon (full party)')
      }
      
      // Bonus for reasonable species/level values
      const validPokemon = pokemonFound.filter(p => p.speciesId > 0 && p.speciesId <= 1000 && p.level > 0 && p.level <= 100)
      if (validPokemon.length === pokemonFound.length && pokemonFound.length > 0) {
        confidence += 5
        details.push('✓ All Pokemon have valid species/level values')
      }
      
    } catch (error) {
      details.push(`❌ Analysis error: ${error}`)
    }
    
    return {
      address,
      confidence: Math.min(confidence, 100),
      details: details.join(', '),
      pokemonFound
    }
  }

  private parseNickname(bytes: Uint8Array): string {
    // Convert bytes to string, stop at first null byte
    let nickname = ''
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i]!
      if (byte === 0) break
      // Convert from game encoding to ASCII (simple approach)
      if (byte >= 0x20 && byte <= 0x7E) {
        nickname += String.fromCharCode(byte)
      } else if (byte >= 0xA1 && byte <= 0xFE) {
        // Pokemon character encoding approximation
        nickname += String.fromCharCode(byte - 0x81)
      }
    }
    return nickname || '[Unknown]'
  }

  async findBestMatch(matches: MemoryMatch[]): Promise<MemoryMatch | null> {
    if (matches.length === 0) return null
    
    // Sort by confidence, then by number of Pokemon found
    matches.sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence
      return b.pokemonFound.length - a.pokemonFound.length
    })
    
    console.log('\n📊 SCAN RESULTS SUMMARY:')
    console.log(`Found ${matches.length} potential party locations`)
    
    for (let i = 0; i < Math.min(matches.length, 10); i++) {
      const match = matches[i]!
      console.log(`${i + 1}. 0x${match.address.toString(16)} (confidence: ${match.confidence}/100)`)
      console.log(`   Pokemon: ${match.pokemonFound.map(p => `${p.nickname}(${p.speciesId})Lv${p.level}`).join(', ')}`)
    }
    
    const best = matches[0]!
    if (best.confidence >= 80) {
      console.log(`\n🏆 BEST MATCH: 0x${best.address.toString(16)} (confidence: ${best.confidence}/100)`)
      return best
    } else {
      console.log(`\n⚠️  No high-confidence matches found. Best confidence: ${best.confidence}/100`)
      return best
    }
  }

  async validatePartyAddress(address: number): Promise<boolean> {
    console.log(`\n🔍 Validating party address 0x${address.toString(16)}...`)
    
    try {
      // Read all 6 Pokemon slots  
      for (let slot = 0; slot < 6; slot++) {
        const pokemonAddr = address + (slot * QUETZAL_POKEMON_SIZE)
        const expected = EXPECTED_PARTY[slot]!
        
        const speciesId = await this.client.readWord(pokemonAddr + SPECIES_OFFSET)
        const level = await this.client.readByte(pokemonAddr + LEVEL_OFFSET)
        const nicknameBytes = await this.client.readBytes(pokemonAddr + NICKNAME_OFFSET, NICKNAME_LENGTH)
        const nickname = this.parseNickname(nicknameBytes)
        
        console.log(`Slot ${slot}: ${nickname} (Species ${speciesId}, Level ${level})`)
        console.log(`Expected: ${expected.nickname} (Species ${expected.speciesId}, Level ${expected.level})`)
        
        if (speciesId !== expected.speciesId || level !== expected.level) {
          console.log(`❌ Mismatch in slot ${slot}`)
          return false
        }
        
        console.log(`✅ Slot ${slot} matches perfectly`)
      }
      
      console.log('🎉 ALL SLOTS MATCH PERFECTLY!')
      return true
      
    } catch (error) {
      console.error(`❌ Validation failed: ${error}`)
      return false
    }
  }

  async findPartyCountAddress(partyDataAddress: number): Promise<number | null> {
    console.log('\n🔍 Searching for party count address near party data...')
    
    // Party count is typically 1-8 bytes before party data
    const searchRange = 16
    
    for (let offset = -searchRange; offset <= 0; offset += 4) {
      const testAddr = partyDataAddress + offset
      
      try {
        const value = await this.client.readByte(testAddr)
        if (value === 6) { // Expected party count
          console.log(`✅ Found party count (6) at 0x${testAddr.toString(16)} (offset ${offset} from party data)`)
          return testAddr
        }
      } catch {
        continue
      }
    }
    
    console.log('❌ Could not find party count address')
    return null
  }

  disconnect(): void {
    this.client.disconnect()
  }
}

async function main(): Promise<void> {
  const scanner = new QuetzalMemoryScanner()
  
  try {
    await scanner.connect()
    
    // Verify we're connected to Quetzal
    if (!await scanner.verifyGameTitle()) {
      console.error('❌ Not connected to Quetzal ROM! Exiting.')
      process.exit(1)
    }
    
    // Scan memory for party data
    const matches = await scanner.scanMemoryForParty()
    const bestMatch = await scanner.findBestMatch(matches)
    
    if (!bestMatch) {
      console.error('❌ No party data found in memory!')
      process.exit(1)
    }
    
    // Validate the best match
    const isValid = await scanner.validatePartyAddress(bestMatch.address)
    
    if (isValid) {
      console.log('\n🎯 MEMORY ADDRESSES FOUND:')
      console.log(`Party Data: 0x${bestMatch.address.toString(16)}`)
      
      // Try to find party count
      const partyCountAddr = await scanner.findPartyCountAddress(bestMatch.address)
      if (partyCountAddr) {
        console.log(`Party Count: 0x${partyCountAddr.toString(16)}`)
      }
      
      console.log('\n📝 Update QuetzalConfig with these addresses:')
      console.log(`readonly memoryAddresses = {`)
      console.log(`  partyData: 0x${bestMatch.address.toString(16)},`)
      if (partyCountAddr) {
        console.log(`  partyCount: 0x${partyCountAddr.toString(16)},`)
      }
      console.log(`}`)
      
      console.log('\n✅ ANALYSIS COMPLETE - ADDRESSES FOUND AND VALIDATED!')
      
    } else {
      console.log('\n❌ Best match failed validation. Need manual analysis.')
      process.exit(1)
    }
    
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