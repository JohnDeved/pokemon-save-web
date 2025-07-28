#!/usr/bin/env npx tsx
/**
 * Memory scanner to find Quetzal party data addresses
 * This script connects to mgba via WebSocket and searches for Pokemon party data
 */

import { MgbaWebSocketClient } from '../src/lib/mgba/websocket-client'

// Expected Quetzal team for verification
const EXPECTED_TEAMS = {
  quetzal1: [
    { species: 208, level: 44, name: 'Steelix' },   // matches what we saw in save file
    { species: 286, level: 45, name: 'Breloom' },
    { species: 143, level: 47, name: 'Snorlax' },
    { species: 272, level: 45, name: 'Ludicolo' },
    { species: 6, level: 41, name: 'Charizard/Rayquaza' }, // unclear species mapping
    { species: 561, level: 37, name: 'Sigilyph' },
  ],
  quetzal2: [
    { species: 286, level: 66, name: 'Breloom' },
    { species: 130, level: 65, name: 'Gyarados' },
    { species: 248, level: 68, name: 'Tyranitar' },
    { species: 372, level: 36, name: 'Shelgon' },
    { species: 143, level: 65, name: 'Snorlax' },
    { species: 745, level: 67, name: 'Incineroar' }, // may not exist in Quetzal
  ]
}

// Memory scanning parameters
const EWRAM_START = 0x02000000
const EWRAM_SIZE = 0x40000  // 256KB
const SCAN_CHUNK_SIZE = 1024

interface PotentialPokemonMatch {
  address: number
  species: number
  level: number
  confidence: number
}

async function connectToMgba(): Promise<MgbaWebSocketClient> {
  const client = new MgbaWebSocketClient('ws://localhost:7102/ws')
  
  console.log('🔌 Connecting to mGBA WebSocket...')
  await client.connect()
  
  const gameTitle = await client.getGameTitle()
  console.log(`🎮 Connected to: "${gameTitle}"`)
  
  return client
}

async function scanMemoryForPokemon(client: MgbaWebSocketClient, address: number, size: number): Promise<PotentialPokemonMatch[]> {
  console.log(`🔍 Scanning memory region 0x${address.toString(16)} - 0x${(address + size).toString(16)} (${size} bytes)`)
  
  const data = await client.readBytes(address, size)
  const matches: PotentialPokemonMatch[] = []
  
  // Scan for Pokemon-like patterns
  // Quetzal uses 104-byte unencrypted Pokemon structure
  // Species is at offset 0x28 (40), level at offset 0x58 (88)
  for (let offset = 0; offset < data.length - 104; offset += 4) { // 4-byte alignment
    try {
      // Check if this could be a Pokemon structure
      const speciesOffset = offset + 0x28
      const levelOffset = offset + 0x58
      
      if (speciesOffset + 2 <= data.length && levelOffset + 1 <= data.length) {
        // Read species (16-bit little endian) and level (8-bit)
        const species = data[speciesOffset] | (data[speciesOffset + 1] << 8)
        const level = data[levelOffset]
        
        // Basic validation: reasonable species and level ranges
        if (species > 0 && species <= 1000 && level > 0 && level <= 100) {
          // Additional validation: check for reasonable stat values
          const hp = levelOffset + 2 < data.length ? data[levelOffset + 2] | (data[levelOffset + 3] << 8) : 0
          const attack = levelOffset + 4 < data.length ? data[levelOffset + 4] | (data[levelOffset + 5] << 8) : 0
          
          if (hp > 0 && hp <= 999 && attack > 0 && attack <= 999) {
            matches.push({
              address: address + offset,
              species,
              level,
              confidence: calculateConfidence(species, level)
            })
          }
        }
      }
    } catch (error) {
      // Skip invalid offsets
    }
  }
  
  return matches
}

function calculateConfidence(species: number, level: number): number {
  let confidence = 0
  
  // Check against expected teams
  for (const team of Object.values(EXPECTED_TEAMS)) {
    for (const pokemon of team) {
      if (pokemon.species === species && pokemon.level === level) {
        confidence += 100 // Exact match is high confidence
      } else if (pokemon.species === species) {
        confidence += 50  // Species match is medium confidence
      } else if (pokemon.level === level) {
        confidence += 25  // Level match is low confidence
      }
    }
  }
  
  return confidence
}

async function findPartyData(client: MgbaWebSocketClient): Promise<void> {
  console.log('🔍 Scanning EWRAM for Pokemon party data...')
  
  const allMatches: PotentialPokemonMatch[] = []
  
  // Scan EWRAM in chunks
  for (let addr = EWRAM_START; addr < EWRAM_START + EWRAM_SIZE; addr += SCAN_CHUNK_SIZE) {
    const chunkSize = Math.min(SCAN_CHUNK_SIZE, EWRAM_START + EWRAM_SIZE - addr)
    
    try {
      const matches = await scanMemoryForPokemon(client, addr, chunkSize)
      allMatches.push(...matches)
      
      if (matches.length > 0) {
        console.log(`  Found ${matches.length} potential Pokemon at 0x${addr.toString(16)}`)
      }
    } catch (error) {
      console.warn(`  Failed to scan 0x${addr.toString(16)}: ${error}`)
    }
  }
  
  // Sort by confidence and group by potential party locations
  const sortedMatches = allMatches.sort((a, b) => b.confidence - a.confidence)
  
  console.log('\n📊 Analysis Results:')
  console.log(`Total potential Pokemon found: ${sortedMatches.length}`)
  
  if (sortedMatches.length === 0) {
    console.log('❌ No Pokemon-like data found in memory')
    return
  }
  
  // Look for clusters that could be party data
  const partyCandidates = findPartyCandidates(sortedMatches)
  
  console.log('\n🎯 Potential Party Locations:')
  for (const candidate of partyCandidates) {
    console.log(`\nAddress: 0x${candidate.address.toString(16)}`)
    console.log(`Pokemon found: ${candidate.pokemon.length}`)
    console.log(`Total confidence: ${candidate.totalConfidence}`)
    for (let i = 0; i < candidate.pokemon.length; i++) {
      const p = candidate.pokemon[i]
      console.log(`  ${i + 1}. Species ${p.species} Lv.${p.level} (confidence: ${p.confidence})`)
    }
  }
}

interface PartyCandidate {
  address: number
  pokemon: PotentialPokemonMatch[]
  totalConfidence: number
}

function findPartyCandidates(matches: PotentialPokemonMatch[]): PartyCandidate[] {
  const candidates: PartyCandidate[] = []
  const POKEMON_SIZE = 104
  const MAX_PARTY_SIZE = 6
  
  // Group matches by potential party start addresses
  for (const match of matches) {
    // Check if this could be the start of a party (look for up to 6 consecutive Pokemon)
    const partyPokemon: PotentialPokemonMatch[] = [match]
    let totalConfidence = match.confidence
    
    // Look for consecutive Pokemon
    for (let i = 1; i < MAX_PARTY_SIZE; i++) {
      const nextAddress = match.address + (i * POKEMON_SIZE)
      const nextPokemon = matches.find(m => m.address === nextAddress)
      
      if (nextPokemon) {
        partyPokemon.push(nextPokemon)
        totalConfidence += nextPokemon.confidence
      } else {
        break // No more consecutive Pokemon
      }
    }
    
    // Only consider candidates with at least 2 Pokemon
    if (partyPokemon.length >= 2) {
      candidates.push({
        address: match.address,
        pokemon: partyPokemon,
        totalConfidence
      })
    }
  }
  
  // Remove duplicates and sort by confidence
  const uniqueCandidates = candidates
    .filter((candidate, index, array) => 
      array.findIndex(c => c.address === candidate.address) === index
    )
    .sort((a, b) => b.totalConfidence - a.totalConfidence)
  
  return uniqueCandidates.slice(0, 10) // Top 10 candidates
}

async function main() {
  try {
    const client = await connectToMgba()
    
    await findPartyData(client)
    
    client.disconnect()
    console.log('\n✅ Memory scan complete')
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

// Run if this is the main module
main()