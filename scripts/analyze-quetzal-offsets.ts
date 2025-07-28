#!/usr/bin/env tsx
/**
 * Script to analyze Quetzal save data and find correct RAM offsets
 * This script compares the save file data with ground truth to identify
 * memory locations for party data, party count, player name, and play time.
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { PokemonSaveParser } from '../src/lib/parser/core/PokemonSaveParser'
import { QuetzalConfig } from '../src/lib/parser/games/quetzal/config'

// Handle ES modules in Node.js
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface GroundTruthData {
  player_name: string
  play_time: { hours: number, minutes: number, seconds: number }
  active_slot: number
  party_pokemon: Array<{
    personality: number
    speciesId: number
    level: number
    currentHp: number
    maxHp: number
    attack: number
    defense: number
    speed: number
    spAttack: number
    spDefense: number
    move1: number
    move2: number
    move3: number
    move4: number
    hpEV: number
    atkEV: number
    defEV: number
    speEV: number
    spaEV: number
    spdEV: number
  }>
}

/**
 * Extract known patterns from save data that can help identify memory locations
 */
function extractKnownPatterns(saveData: Uint8Array, groundTruth: GroundTruthData) {
  console.log('🔍 Extracting known patterns from save data...')
  
  const patterns = {
    partyCount: groundTruth.party_pokemon.length,
    playerName: groundTruth.player_name,
    playTime: groundTruth.play_time,
    firstPokemon: groundTruth.party_pokemon[0],
  }
  
  console.log(`📊 Known patterns:`)
  console.log(`  - Party count: ${patterns.partyCount}`)
  console.log(`  - Player name: "${patterns.playerName}"`)
  console.log(`  - Play time: ${patterns.playTime.hours}h ${patterns.playTime.minutes}m ${patterns.playTime.seconds}s`)
  console.log(`  - First Pokemon species: ${patterns.firstPokemon?.speciesId}`)
  
  return patterns
}

/**
 * Search for party count in save data
 * Look for a single byte that matches the known party count
 */
function findPartyCountCandidates(saveData: Uint8Array, expectedCount: number): number[] {
  console.log(`\n🔍 Searching for party count (${expectedCount}) in save data...`)
  
  const candidates: number[] = []
  
  for (let i = 0; i < saveData.length; i++) {
    if (saveData[i] === expectedCount) {
      candidates.push(i)
    }
  }
  
  console.log(`Found ${candidates.length} potential party count locations`)
  return candidates.slice(0, 10) // Limit to first 10 for analysis
}

/**
 * Search for Pokemon species patterns in save data
 */
function findPokemonDataCandidates(saveData: Uint8Array, groundTruth: GroundTruthData): number[] {
  console.log(`\n🔍 Searching for Pokemon data patterns...`)
  
  const candidates: number[] = []
  const firstPokemon = groundTruth.party_pokemon[0]
  const secondPokemon = groundTruth.party_pokemon[1]
  if (!firstPokemon) return candidates
  
  console.log(`Looking for first Pokemon: Species ${firstPokemon.speciesId}, Level ${firstPokemon.level}, Personality ${firstPokemon.personality}`)
  
  // Look for the species ID at offset 0x28 (based on Quetzal config)
  // So we're looking for the personality first, then species at +0x28
  const personalityBytes = new Uint8Array(4)
  new DataView(personalityBytes.buffer).setUint32(0, firstPokemon.personality, true)
  
  const speciesBytes = new Uint8Array(2)
  new DataView(speciesBytes.buffer).setUint16(0, firstPokemon.speciesId, true)
  
  console.log(`Searching for personality bytes: ${Array.from(personalityBytes).map(b => b.toString(16)).join(' ')}`)
  console.log(`Searching for species bytes at +0x28: ${speciesBytes[0]}, ${speciesBytes[1]}`)
  
  for (let i = 0; i < saveData.length - 104; i++) { // Ensure we have room for full Pokemon
    // Check if personality matches at offset i
    if (saveData[i] === personalityBytes[0] && 
        saveData[i + 1] === personalityBytes[1] && 
        saveData[i + 2] === personalityBytes[2] && 
        saveData[i + 3] === personalityBytes[3]) {
      
      // Check if species matches at offset i + 0x28
      if (i + 0x28 + 1 < saveData.length &&
          saveData[i + 0x28] === speciesBytes[0] && 
          saveData[i + 0x28 + 1] === speciesBytes[1]) {
        
        console.log(`\nFound Pokemon match at offset 0x${i.toString(16)} (${i})`)
        console.log(`  Personality: ${firstPokemon.personality} at offset ${i}`)
        console.log(`  Species: ${firstPokemon.speciesId} at offset ${i + 0x28}`)
        
        // Verify more fields to confirm this is the right structure
        const score = scoreQuetzalPokemonMatch(saveData, i, firstPokemon)
        console.log(`  Total score: ${score}`)
        
        if (score >= 3) { // Good match
          candidates.push(i)
          
          // If this looks promising, also check if the second Pokemon follows
          if (secondPokemon && saveData.length > i + 208) { // Room for 2 Pokemon
            const secondOffset = i + 104 // Assuming 104-byte Pokemon
            const secondPersonalityBytes = new Uint8Array(4)
            new DataView(secondPersonalityBytes.buffer).setUint32(0, secondPokemon.personality, true)
            
            const secondSpeciesBytes = new Uint8Array(2)
            new DataView(secondSpeciesBytes.buffer).setUint16(0, secondPokemon.speciesId, true)
            
            if (saveData[secondOffset] === secondPersonalityBytes[0] && 
                saveData[secondOffset + 1] === secondPersonalityBytes[1] && 
                saveData[secondOffset + 2] === secondPersonalityBytes[2] && 
                saveData[secondOffset + 3] === secondPersonalityBytes[3] &&
                saveData[secondOffset + 0x28] === secondSpeciesBytes[0] && 
                saveData[secondOffset + 0x28 + 1] === secondSpeciesBytes[1]) {
              console.log(`  Second Pokemon also matches at +104!`)
              const secondScore = scoreQuetzalPokemonMatch(saveData, secondOffset, secondPokemon)
              console.log(`  Second Pokemon score: ${secondScore}`)
            }
          }
        }
      }
    }
  }
  
  console.log(`Found ${candidates.length} potential Pokemon data locations`)
  return candidates.slice(0, 10) // Increase limit for analysis
}

/**
 * Score how well a memory location matches expected Pokemon data using Quetzal structure
 */
function scoreQuetzalPokemonMatch(saveData: Uint8Array, offset: number, expectedPokemon: any): number {
  let score = 0
  
  try {
    const view = new DataView(saveData.buffer, saveData.byteOffset + offset, Math.min(104, saveData.length - offset))
    
    // Check personality (already matched, so +2)
    score += 2
    
    // Check species (already matched, so +2)
    score += 2
    
    // Check level at offset 0x58 (from Quetzal config)
    if (view.byteLength > 0x58) {
      const level = view.getUint8(0x58)
      if (level === expectedPokemon.level) {
        score += 2
        console.log(`  Found level match at +0x58: ${level}`)
      }
    }
    
    // Check current HP at offset 0x23 (from Quetzal config)
    if (view.byteLength > 0x24) {
      const currentHp = view.getUint16(0x23, true)
      if (currentHp === expectedPokemon.currentHp) {
        score += 1
        console.log(`  Found current HP match at +0x23: ${currentHp}`)
      }
    }
    
    // Check max HP at offset 0x5A (from Quetzal config)
    if (view.byteLength > 0x5B) {
      const maxHp = view.getUint16(0x5A, true)
      if (maxHp === expectedPokemon.maxHp) {
        score += 1
        console.log(`  Found max HP match at +0x5A: ${maxHp}`)
      }
    }
    
    // Check attack at offset 0x5C (from Quetzal config)
    if (view.byteLength > 0x5D) {
      const attack = view.getUint16(0x5C, true)
      if (attack === expectedPokemon.attack) {
        score += 1
        console.log(`  Found attack match at +0x5C: ${attack}`)
      }
    }
    
  } catch (error) {
    // Ignore errors from reading beyond buffer bounds
  }
  
  return score
}



/**
 * Search for player name in save data
 */
function findPlayerNameCandidates(saveData: Uint8Array, playerName: string): number[] {
  console.log(`\n🔍 Searching for player name "${playerName}"...`)
  
  const candidates: number[] = []
  
  // Convert player name to GBA text encoding (simple ASCII for now)
  const nameBytes = new TextEncoder().encode(playerName)
  
  for (let i = 0; i < saveData.length - nameBytes.length; i++) {
    let matches = true
    for (let j = 0; j < nameBytes.length; j++) {
      if (saveData[i + j] !== nameBytes[j]) {
        matches = false
        break
      }
    }
    if (matches) {
      candidates.push(i)
    }
  }
  
  console.log(`Found ${candidates.length} potential player name locations`)
  return candidates.slice(0, 5)
}

/**
 * Search for play time patterns in save data
 */
function findPlayTimeCandidates(saveData: Uint8Array, playTime: { hours: number, minutes: number, seconds: number }): number[] {
  console.log(`\n🔍 Searching for play time pattern (${playTime.hours}h ${playTime.minutes}m ${playTime.seconds}s)...`)
  
  const candidates: number[] = []
  
  // Look for the time values as consecutive bytes or 16-bit values
  for (let i = 0; i < saveData.length - 6; i++) {
    try {
      const view = new DataView(saveData.buffer, saveData.byteOffset + i, 6)
      
      // Try different layouts
      // Layout 1: hours(2), minutes(1), seconds(1)
      const hours1 = view.getUint16(0, true)
      const minutes1 = view.getUint8(2)
      const seconds1 = view.getUint8(3)
      
      if (hours1 === playTime.hours && minutes1 === playTime.minutes && seconds1 === playTime.seconds) {
        candidates.push(i)
        continue
      }
      
      // Layout 2: hours(4), minutes(1), seconds(1) 
      if (i + 6 < saveData.length) {
        const hours2 = view.getUint32(0, true)
        const minutes2 = view.getUint8(4)
        const seconds2 = view.getUint8(5)
        
        if (hours2 === playTime.hours && minutes2 === playTime.minutes && seconds2 === playTime.seconds) {
          candidates.push(i)
        }
      }
    } catch (error) {
      // Ignore errors from reading beyond buffer bounds
    }
  }
  
  console.log(`Found ${candidates.length} potential play time locations`)
  return candidates.slice(0, 5)
}

/**
 * Generate memory address suggestions based on save file offsets
 */
function generateMemoryAddressSuggestions(saveOffsets: { 
  partyCount: number[]
  pokemonData: number[]
  playerName: number[]
  playTime: number[]
}) {
  console.log(`\n💡 Generating memory address suggestions...`)
  
  // For GBA games, save data is typically mapped to EWRAM or other regions
  // Common RAM base addresses for Pokemon Emerald:
  // - EWRAM: 0x02000000 - 0x02040000
  // - IWRAM: 0x03000000 - 0x03008000
  // - Save data might be loaded at predictable offsets
  
  const suggestions = {
    partyCount: [] as number[],
    partyData: [] as number[],
    playerName: [] as number[],
    playTime: [] as number[],
  }
  
  // Generate suggestions based on common base addresses
  const commonBases = [
    0x02000000, // EWRAM base
    0x02020000, // EWRAM + 128KB
    0x02030000, // EWRAM + 192KB
    0x03000000, // IWRAM base
  ]
  
  for (const base of commonBases) {
    saveOffsets.partyCount.forEach(offset => {
      suggestions.partyCount.push(base + offset)
    })
    saveOffsets.pokemonData.forEach(offset => {
      suggestions.partyData.push(base + offset)
    })
    saveOffsets.playerName.forEach(offset => {
      suggestions.playerName.push(base + offset)
    })
    saveOffsets.playTime.forEach(offset => {
      suggestions.playTime.push(base + offset)
    })
  }
  
  // Also check if offsets are reasonable relative to vanilla addresses
  const vanillaPartyData = 0x20244ec
  const vanillaPartyCount = 0x20244e9
  
  console.log(`\n📍 Memory address suggestions:`)
  console.log(`\nParty Count candidates:`)
  suggestions.partyCount.slice(0, 5).forEach(addr => {
    console.log(`  0x${addr.toString(16).padStart(8, '0')}`)
  })
  
  console.log(`\nParty Data candidates:`)
  suggestions.partyData.slice(0, 5).forEach(addr => {
    console.log(`  0x${addr.toString(16).padStart(8, '0')}`)
  })
  
  console.log(`\nPlayer Name candidates:`)
  suggestions.playerName.slice(0, 3).forEach(addr => {
    console.log(`  0x${addr.toString(16).padStart(8, '0')}`)
  })
  
  console.log(`\nPlay Time candidates:`)
  suggestions.playTime.slice(0, 3).forEach(addr => {
    console.log(`  0x${addr.toString(16).padStart(8, '0')}`)
  })
  
  return suggestions
}

async function main() {
  console.log('🚀 Quetzal RAM Offset Analysis Tool')
  console.log('=====================================\n')
  
  try {
    // Load Quetzal save file
    const savePath = resolve(__dirname, '../src/lib/parser/__tests__/test_data/quetzal.sav')
    const saveBuffer = readFileSync(savePath)
    const saveData = new Uint8Array(saveBuffer.buffer.slice(saveBuffer.byteOffset, saveBuffer.byteOffset + saveBuffer.byteLength))
    
    // Load ground truth data
    const groundTruthPath = resolve(__dirname, '../src/lib/parser/__tests__/test_data/quetzal_ground_truth.json')
    const groundTruthContent = readFileSync(groundTruthPath, 'utf-8')
    const groundTruth: GroundTruthData = JSON.parse(groundTruthContent)
    
    console.log(`📁 Loaded save file: ${saveData.length} bytes`)
    console.log(`📋 Loaded ground truth with ${groundTruth.party_pokemon.length} Pokemon\n`)
    
    // Extract known patterns
    const patterns = extractKnownPatterns(saveData, groundTruth)
    
    // Search for patterns in save data
    const partyCountCandidates = findPartyCountCandidates(saveData, patterns.partyCount)
    const pokemonDataCandidates = findPokemonDataCandidates(saveData, groundTruth)
    const playerNameCandidates = findPlayerNameCandidates(saveData, patterns.playerName)
    const playTimeCandidates = findPlayTimeCandidates(saveData, patterns.playTime)
    
    // Generate memory address suggestions
    const suggestions = generateMemoryAddressSuggestions({
      partyCount: partyCountCandidates,
      pokemonData: pokemonDataCandidates,
      playerName: playerNameCandidates,
      playTime: playTimeCandidates,
    })
    
    console.log(`\n✅ Analysis complete!`)
    console.log(`\n📝 Next steps:`)
    console.log(`1. Test these memory addresses with mGBA and the WebSocket API`)
    console.log(`2. Update src/lib/parser/games/quetzal/config.ts with correct addresses`)
    console.log(`3. Enable memory support by updating canHandleMemory() method`)
    
  } catch (error) {
    console.error('❌ Error during analysis:', error)
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}