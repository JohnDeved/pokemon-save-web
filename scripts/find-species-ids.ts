#!/usr/bin/env tsx
/**
 * Search for the specific species IDs from our expected party
 */

import { MgbaWebSocketClient } from '../src/lib/mgba/websocket-client.js'

// Expected party data from ground truth
const EXPECTED_SPECIES = [208, 286, 143, 272, 6, 561] // Steelix, Breloom, Snorlax, Ludicolo, Rayquaza, Sigilyph
const EXPECTED_LEVELS = [44, 45, 47, 45, 41, 37]

class SpeciesIdFinder {
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

  async findSpeciesIds(): Promise<void> {
    console.log(`\n🔍 Searching for species IDs: ${EXPECTED_SPECIES.join(', ')}`)
    
    const EWRAM_START = 0x02000000
    const EWRAM_SIZE = 0x40000  // 256KB
    const CHUNK_SIZE = 4096
    
    const foundLocations = new Map<number, number[]>() // species -> addresses
    
    for (let offset = 0; offset < EWRAM_SIZE; offset += CHUNK_SIZE) {
      const addr = EWRAM_START + offset
      const chunkSize = Math.min(CHUNK_SIZE, EWRAM_SIZE - offset)
      
      if (offset % (16 * CHUNK_SIZE) === 0) {
        const progress = Math.floor((offset / EWRAM_SIZE) * 100)
        console.log(`📍 Scanning 0x${addr.toString(16)} (${progress}%)`)
      }
      
      try {
        const chunk = await this.client.readBytes(addr, chunkSize)
        
        // Look for 16-bit species IDs (little-endian)
        for (let i = 0; i <= chunk.length - 2; i += 2) {
          const speciesId = chunk[i]! | (chunk[i + 1]! << 8)
          
          if (EXPECTED_SPECIES.includes(speciesId)) {
            const foundAddr = addr + i
            
            if (!foundLocations.has(speciesId)) {
              foundLocations.set(speciesId, [])
            }
            foundLocations.get(speciesId)!.push(foundAddr)
          }
        }
      } catch {
        continue
      }
    }
    
    console.log('\n📊 SPECIES ID SEARCH RESULTS:')
    console.log('='.repeat(60))
    
    for (const [speciesId, addresses] of foundLocations.entries()) {
      console.log(`Species ${speciesId}: Found at ${addresses.length} locations`)
      
      // Show first 20 addresses for each species
      for (let i = 0; i < Math.min(addresses.length, 20); i++) {
        const addr = addresses[i]!
        console.log(`  0x${addr.toString(16)}`)
      }
      
      if (addresses.length > 20) {
        console.log(`  ... and ${addresses.length - 20} more`)
      }
    }
    
    // Now look for sequential patterns
    console.log('\n🎯 Looking for sequential patterns...')
    await this.findSequentialPatterns(foundLocations)
  }

  private async findSequentialPatterns(foundLocations: Map<number, number[]>): Promise<void> {
    // Get all addresses where we found any species
    const allAddresses = new Set<number>()
    for (const addresses of foundLocations.values()) {
      addresses.forEach(addr => allAddresses.add(addr))
    }
    
    const sortedAddresses = Array.from(allAddresses).sort((a, b) => a - b)
    
    console.log(`Checking ${sortedAddresses.length} total addresses for patterns...`)
    
    for (const addr of sortedAddresses) {
      try {
        const score = await this.testSequentialPattern(addr)
        if (score > 0) {
          console.log(`\n🎯 Pattern at 0x${addr.toString(16)} (Score: ${score}/100)`)
          await this.analyzePattern(addr)
        }
      } catch {
        continue
      }
    }
  }

  private async testSequentialPattern(startAddr: number): Promise<number> {
    let score = 0
    
    try {
      // Test if this could be the start of party data by checking multiple possible structures
      const possibleStrides = [104, 100, 80, 48] // Common Pokemon data sizes
      
      for (const stride of possibleStrides) {
        let patternScore = 0
        
        for (let slot = 0; slot < 6; slot++) {
          // Try different offsets within the structure for species ID
          const possibleOffsets = [0x28, 0x20, 0x00, 0x08, 0x10] 
          
          for (const offset of possibleOffsets) {
            try {
              const pokemonAddr = startAddr + (slot * stride)
              const speciesId = await this.client.readWord(pokemonAddr + offset)
              
              if (EXPECTED_SPECIES.includes(speciesId)) {
                patternScore += 10
              }
            } catch {
              continue
            }
          }
        }
        
        score = Math.max(score, patternScore)
      }
    } catch {
      return 0
    }
    
    return score
  }

  private async analyzePattern(addr: number): Promise<void> {
    console.log(`🔍 Analyzing pattern at 0x${addr.toString(16)}:`)
    
    const structures = [
      { stride: 104, speciesOffset: 0x28, levelOffset: 0x58, name: 'Quetzal (104-byte)' },
      { stride: 100, speciesOffset: 0x20, levelOffset: 0x50, name: 'Standard (100-byte)' },
      { stride: 80, speciesOffset: 0x00, levelOffset: 0x08, name: 'Compact (80-byte)' },
      { stride: 48, speciesOffset: 0x00, levelOffset: 0x04, name: 'Simple (48-byte)' },
    ]
    
    for (const struct of structures) {
      console.log(`\n  Testing ${struct.name} structure:`)
      
      let matches = 0
      const found: Array<{species: number, level: number}> = []
      
      for (let slot = 0; slot < 6; slot++) {
        try {
          const pokemonAddr = addr + (slot * struct.stride)
          const speciesId = await this.client.readWord(pokemonAddr + struct.speciesOffset)
          const level = await this.client.readByte(pokemonAddr + struct.levelOffset)
          
          found.push({species: speciesId, level})
          
          if (speciesId === EXPECTED_SPECIES[slot] && level === EXPECTED_LEVELS[slot]) {
            matches++
            console.log(`    ✅ Slot ${slot}: ${speciesId} Lv${level} (Perfect match)`)
          } else if (EXPECTED_SPECIES.includes(speciesId)) {
            console.log(`    🔸 Slot ${slot}: ${speciesId} Lv${level} (Species match only)`)
          } else {
            console.log(`    ❌ Slot ${slot}: ${speciesId} Lv${level}`)
          }
        } catch {
          console.log(`    ❌ Slot ${slot}: Read error`)
          break
        }
      }
      
      if (matches >= 4) {
        console.log(`\n    🏆 HIGH CONFIDENCE: ${matches}/6 perfect matches with ${struct.name}!`)
        console.log(`    📝 Party Data Address: 0x${addr.toString(16)}`)
        console.log(`    📝 Structure: ${struct.stride}-byte stride, species at +0x${struct.speciesOffset.toString(16)}, level at +0x${struct.levelOffset.toString(16)}`)
      } else if (matches >= 2) {
        console.log(`\n    ⚠️  Partial match: ${matches}/6 with ${struct.name}`)
      }
    }
  }

  disconnect(): void {
    this.client.disconnect()
  }
}

async function main(): Promise<void> {
  const finder = new SpeciesIdFinder()
  
  try {
    await finder.connect()
    await finder.findSpeciesIds()
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