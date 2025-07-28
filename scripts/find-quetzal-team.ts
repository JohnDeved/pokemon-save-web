#!/usr/bin/env npx tsx
/**
 * Focused memory scanner for Quetzal team
 * Looks for the specific team we know should be in memory
 */

import { MgbaWebSocketClient } from '../src/lib/mgba/websocket-client'

// Expected Quetzal team from save file analysis
const QUETZAL_TEAM = [
  { species: 208, level: 44, name: 'Steelix' },
  { species: 286, level: 45, name: 'Breloom' },
  { species: 143, level: 47, name: 'Snorlax' },
  { species: 272, level: 45, name: 'Ludicolo' },
  { species: 6, level: 41, name: 'Rayquaza' },
  { species: 561, level: 37, name: 'Sigilyph' },
]

const POKEMON_SIZE = 104  // Quetzal Pokemon structure size
const SPECIES_OFFSET = 0x28  // Species at offset 40
const LEVEL_OFFSET = 0x58    // Level at offset 88

async function connectToMgba(): Promise<MgbaWebSocketClient> {
  const client = new MgbaWebSocketClient('ws://localhost:7102/ws')
  
  console.log('🔌 Connecting to mGBA WebSocket...')
  await client.connect()
  
  const gameTitle = await client.getGameTitle()
  console.log(`🎮 Connected to: "${gameTitle}"`)
  
  return client
}

async function scanMemoryChunk(client: MgbaWebSocketClient, startAddr: number, size: number): Promise<{ address: number, confidence: number }[]> {
  try {
    const data = await client.readBytes(startAddr, size)
    const matches: { address: number, confidence: number }[] = []
    
    // Scan for the specific team pattern
    for (let offset = 0; offset < data.length - (POKEMON_SIZE * 6); offset += 4) {
      let confidence = 0
      let foundPokemon = 0
      
      // Check each Pokemon in the expected team
      for (let i = 0; i < QUETZAL_TEAM.length; i++) {
        const pokemonOffset = offset + (i * POKEMON_SIZE)
        
        if (pokemonOffset + LEVEL_OFFSET + 1 > data.length) break
        
        const expectedSpecies = QUETZAL_TEAM[i].species
        const expectedLevel = QUETZAL_TEAM[i].level
        
        // Read species (16-bit little endian)
        const species = data[pokemonOffset + SPECIES_OFFSET] | (data[pokemonOffset + SPECIES_OFFSET + 1] << 8)
        // Read level (8-bit)
        const level = data[pokemonOffset + LEVEL_OFFSET]
        
        if (species === expectedSpecies && level === expectedLevel) {
          confidence += 100  // Perfect match
          foundPokemon++
        } else if (level === expectedLevel) {
          confidence += 25   // Level match only
        } else if (species === expectedSpecies) {
          confidence += 50   // Species match only
        }
      }
      
      // Only report if we found significant matches
      if (confidence >= 150 || foundPokemon >= 3) {
        matches.push({
          address: startAddr + offset,
          confidence: confidence
        })
      }
    }
    
    return matches
  } catch (error) {
    console.warn(`Failed to scan chunk at 0x${startAddr.toString(16)}: ${error}`)
    return []
  }
}

async function verifyTeamAtAddress(client: MgbaWebSocketClient, address: number): Promise<void> {
  console.log(`\n🔍 Verifying team at 0x${address.toString(16)}:`)
  
  try {
    const teamData = await client.readBytes(address, POKEMON_SIZE * 6)
    
    for (let i = 0; i < QUETZAL_TEAM.length; i++) {
      const pokemonOffset = i * POKEMON_SIZE
      
      if (pokemonOffset + LEVEL_OFFSET + 1 > teamData.length) {
        console.log(`  ${i + 1}. [insufficient data]`)
        continue
      }
      
      const species = teamData[pokemonOffset + SPECIES_OFFSET] | (teamData[pokemonOffset + SPECIES_OFFSET + 1] << 8)
      const level = teamData[pokemonOffset + LEVEL_OFFSET]
      
      const expected = QUETZAL_TEAM[i]
      const speciesMatch = species === expected.species ? '✅' : '❌'
      const levelMatch = level === expected.level ? '✅' : '❌'
      
      console.log(`  ${i + 1}. Species: ${species} ${speciesMatch} (expected ${expected.species}), Level: ${level} ${levelMatch} (expected ${expected.level}) - ${expected.name}`)
    }
  } catch (error) {
    console.error(`Failed to verify team: ${error}`)
  }
}

async function main() {
  try {
    const client = await connectToMgba()
    
    console.log('\n🔍 Scanning EWRAM for Quetzal team...')
    
    // Scan EWRAM in chunks
    const EWRAM_START = 0x02000000
    const EWRAM_SIZE = 0x40000  // 256KB
    const CHUNK_SIZE = 4096     // 4KB chunks
    
    const allMatches: { address: number, confidence: number }[] = []
    
    for (let addr = EWRAM_START; addr < EWRAM_START + EWRAM_SIZE; addr += CHUNK_SIZE) {
      const chunkSize = Math.min(CHUNK_SIZE, EWRAM_START + EWRAM_SIZE - addr)
      const matches = await scanMemoryChunk(client, addr, chunkSize)
      allMatches.push(...matches)
      
      if (matches.length > 0) {
        console.log(`  Found ${matches.length} potential matches in chunk 0x${addr.toString(16)}`)
      }
    }
    
    if (allMatches.length === 0) {
      console.log('❌ No matches found for Quetzal team')
    } else {
      // Sort by confidence
      const sortedMatches = allMatches.sort((a, b) => b.confidence - a.confidence)
      
      console.log(`\n📊 Found ${sortedMatches.length} potential team locations:`)
      
      for (let i = 0; i < Math.min(5, sortedMatches.length); i++) {
        const match = sortedMatches[i]
        console.log(`\n${i + 1}. Address: 0x${match.address.toString(16)} (confidence: ${match.confidence})`)
        await verifyTeamAtAddress(client, match.address)
      }
    }
    
    client.disconnect()
    console.log('\n✅ Scan complete')
    
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

main()