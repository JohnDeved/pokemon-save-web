#!/usr/bin/env tsx
/**
 * Generic ROM Hack RAM Offset Analysis Tool
 * 
 * This script can be used to analyze any Pokemon ROM hack save file
 * and discover RAM offsets for memory reading/writing.
 * 
 * Usage:
 *   npx tsx scripts/analyze-rom-hack-offsets.ts <save-file> <ground-truth-json> [config-name]
 * 
 * Example:
 *   npx tsx scripts/analyze-rom-hack-offsets.ts myromhack.sav myromhack_truth.json MyRomHackConfig
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

interface GroundTruthData {
  player_name?: string
  play_time?: { hours: number, minutes: number, seconds: number }
  active_slot?: number
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
    [key: string]: any
  }>
}

interface AnalysisResult {
  saveFile: string
  groundTruth: string
  partyCount: number
  activeSlot?: number
  pokemonDataLocations: number[]
  partyCountLocations: number[]
  playerNameLocations: number[]
  playTimeLocations: number[]
  memoryAddressSuggestions: {
    partyData: number[]
    partyCount: number[]
    playTime: number[]
  }
}

/**
 * Search for Pokemon data using flexible structure detection
 */
function findPokemonData(saveData: Uint8Array, groundTruth: GroundTruthData): number[] {
  const candidates: number[] = []
  const firstPokemon = groundTruth.party_pokemon[0]
  if (!firstPokemon) return candidates

  console.log(`Searching for Pokemon: Species ${firstPokemon.speciesId}, Level ${firstPokemon.level}, Personality ${firstPokemon.personality}`)

  // Try different structure layouts
  const layouts = [
    { personalityOffset: 0x00, speciesOffset: 0x28, name: 'Quetzal-style (personality first, species +0x28)' },
    { personalityOffset: 0x00, speciesOffset: 0x20, name: 'Alternative layout 1' },
    { personalityOffset: 0x04, speciesOffset: 0x28, name: 'Alternative layout 2' },
    { personalityOffset: 0x00, speciesOffset: 0x08, name: 'Encrypted style (species early)' },
  ]

  for (const layout of layouts) {
    console.log(`\nTrying layout: ${layout.name}`)
    
    const personalityBytes = new Uint8Array(4)
    new DataView(personalityBytes.buffer).setUint32(0, firstPokemon.personality, true)
    
    const speciesBytes = new Uint8Array(2)
    new DataView(speciesBytes.buffer).setUint16(0, firstPokemon.speciesId, true)

    for (let i = 0; i < saveData.length - 104; i++) {
      // Check personality at specified offset
      const personalityStart = i + layout.personalityOffset
      if (personalityStart + 3 < saveData.length &&
          saveData[personalityStart] === personalityBytes[0] && 
          saveData[personalityStart + 1] === personalityBytes[1] && 
          saveData[personalityStart + 2] === personalityBytes[2] && 
          saveData[personalityStart + 3] === personalityBytes[3]) {
        
        // Check species at specified offset
        const speciesStart = i + layout.speciesOffset
        if (speciesStart + 1 < saveData.length &&
            saveData[speciesStart] === speciesBytes[0] && 
            saveData[speciesStart + 1] === speciesBytes[1]) {
          
          console.log(`  Found match at offset 0x${i.toString(16)} (${i})`)
          
          // Score this match
          const score = scorePokemonMatch(saveData, i, firstPokemon, layout)
          console.log(`  Score: ${score}`)
          
          if (score >= 3) {
            candidates.push(i)
          }
        }
      }
    }
  }

  return Array.from(new Set(candidates))
}

/**
 * Score a potential Pokemon match
 */
function scorePokemonMatch(saveData: Uint8Array, offset: number, expectedPokemon: any, layout: any): number {
  let score = 2 // Base score for personality + species match
  
  try {
    const view = new DataView(saveData.buffer, saveData.byteOffset + offset, Math.min(104, saveData.length - offset))
    
    // Try common level offsets
    const levelOffsets = [0x54, 0x58, 0x84]
    for (const levelOffset of levelOffsets) {
      if (view.byteLength > levelOffset) {
        const level = view.getUint8(levelOffset)
        if (level === expectedPokemon.level) {
          score += 2
          break
        }
      }
    }
    
    // Try common HP offsets
    const hpOffsets = [0x23, 0x56, 0x86]
    for (const hpOffset of hpOffsets) {
      if (view.byteLength > hpOffset + 1) {
        const currentHp = view.getUint16(hpOffset, true)
        if (currentHp === expectedPokemon.currentHp) {
          score += 1
          break
        }
      }
    }
    
    // Try common max HP offsets
    const maxHpOffsets = [0x5A, 0x58, 0x88]
    for (const maxHpOffset of maxHpOffsets) {
      if (view.byteLength > maxHpOffset + 1) {
        const maxHp = view.getUint16(maxHpOffset, true)
        if (maxHp === expectedPokemon.maxHp) {
          score += 1
          break
        }
      }
    }
    
  } catch (error) {
    // Ignore read errors
  }
  
  return score
}

/**
 * Search for party count
 */
function findPartyCount(saveData: Uint8Array, expectedCount: number): number[] {
  const candidates: number[] = []
  
  for (let i = 0; i < saveData.length; i++) {
    if (saveData[i] === expectedCount) {
      candidates.push(i)
    }
  }
  
  return candidates.slice(0, 20) // Limit results
}

/**
 * Search for player name
 */
function findPlayerName(saveData: Uint8Array, playerName: string): number[] {
  if (!playerName) return []
  
  const candidates: number[] = []
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
  
  return candidates.slice(0, 10)
}

/**
 * Search for play time
 */
function findPlayTime(saveData: Uint8Array, playTime: { hours: number, minutes: number, seconds: number }): number[] {
  if (!playTime) return []
  
  const candidates: number[] = []
  
  for (let i = 0; i < saveData.length - 6; i++) {
    try {
      const view = new DataView(saveData.buffer, saveData.byteOffset + i, 6)
      
      // Try different time layouts
      const layouts = [
        { hours: view.getUint16(0, true), minutes: view.getUint8(2), seconds: view.getUint8(3) },
        { hours: view.getUint32(0, true), minutes: view.getUint8(4), seconds: view.getUint8(5) },
        { hours: view.getUint8(0), minutes: view.getUint8(1), seconds: view.getUint8(2) },
      ]
      
      for (const layout of layouts) {
        if (layout.hours === playTime.hours && layout.minutes === playTime.minutes && layout.seconds === playTime.seconds) {
          candidates.push(i)
          break
        }
      }
    } catch (error) {
      // Ignore read errors
    }
  }
  
  return candidates.slice(0, 5)
}

/**
 * Calculate memory addresses from save offsets
 */
function calculateMemoryAddresses(result: AnalysisResult): void {
  console.log('\n💡 Calculating memory addresses...')
  
  // Use vanilla Emerald as reference
  const vanillaPartyData = 0x20244ec
  const vanillaPartyCount = 0x20244e9
  
  // Common GBA memory bases
  const memoryBases = [
    0x02000000, // EWRAM
    0x02020000, // EWRAM + 128KB
    0x03000000, // IWRAM
  ]
  
  const suggestions = {
    partyData: [] as number[],
    partyCount: [] as number[],
    playTime: [] as number[],
  }
  
  // Calculate suggestions based on save offsets
  for (const base of memoryBases) {
    result.pokemonDataLocations.forEach(offset => {
      suggestions.partyData.push(base + offset)
    })
    result.partyCountLocations.forEach(offset => {
      suggestions.partyCount.push(base + offset)
    })
    result.playTimeLocations.forEach(offset => {
      suggestions.playTime.push(base + offset)
    })
  }
  
  // Also try calculating based on vanilla offset differences
  if (result.pokemonDataLocations.length > 0) {
    const saveOffset = result.pokemonDataLocations[result.activeSlot || 0] || result.pokemonDataLocations[0]!
    const memoryBase = vanillaPartyData - saveOffset
    suggestions.partyData.push(memoryBase + saveOffset)
    suggestions.partyCount.push(memoryBase + saveOffset - 4) // Typical offset
  }
  
  result.memoryAddressSuggestions = suggestions
}

/**
 * Main analysis function
 */
async function analyzeRomHack(saveFile: string, groundTruthFile: string, configName?: string): Promise<AnalysisResult> {
  console.log(`🚀 ROM Hack RAM Offset Analysis Tool`)
  console.log(`====================================`)
  console.log(`Save file: ${saveFile}`)
  console.log(`Ground truth: ${groundTruthFile}`)
  if (configName) console.log(`Target config: ${configName}`)
  console.log()
  
  // Load files
  if (!existsSync(saveFile)) {
    throw new Error(`Save file not found: ${saveFile}`)
  }
  if (!existsSync(groundTruthFile)) {
    throw new Error(`Ground truth file not found: ${groundTruthFile}`)
  }
  
  const saveBuffer = readFileSync(saveFile)
  const saveData = new Uint8Array(saveBuffer.buffer.slice(saveBuffer.byteOffset, saveBuffer.byteOffset + saveBuffer.byteLength))
  
  const groundTruthContent = readFileSync(groundTruthFile, 'utf-8')
  const groundTruth: GroundTruthData = JSON.parse(groundTruthContent)
  
  console.log(`📁 Save file loaded: ${saveData.length} bytes`)
  console.log(`📋 Ground truth loaded: ${groundTruth.party_pokemon.length} Pokemon`)
  if (groundTruth.player_name) console.log(`👤 Player: ${groundTruth.player_name}`)
  if (groundTruth.play_time) console.log(`⏰ Play time: ${groundTruth.play_time.hours}h ${groundTruth.play_time.minutes}m ${groundTruth.play_time.seconds}s`)
  console.log()
  
  // Perform analysis
  const result: AnalysisResult = {
    saveFile,
    groundTruth: groundTruthFile,
    partyCount: groundTruth.party_pokemon.length,
    activeSlot: groundTruth.active_slot,
    pokemonDataLocations: findPokemonData(saveData, groundTruth),
    partyCountLocations: findPartyCount(saveData, groundTruth.party_pokemon.length),
    playerNameLocations: findPlayerName(saveData, groundTruth.player_name || ''),
    playTimeLocations: findPlayTime(saveData, groundTruth.play_time || { hours: 0, minutes: 0, seconds: 0 }),
    memoryAddressSuggestions: { partyData: [], partyCount: [], playTime: [] },
  }
  
  // Calculate memory addresses
  calculateMemoryAddresses(result)
  
  return result
}

/**
 * Print analysis results
 */
function printResults(result: AnalysisResult): void {
  console.log('\n📊 Analysis Results')
  console.log('==================')
  
  console.log(`\nPokemon Data Locations (${result.pokemonDataLocations.length} found):`)
  result.pokemonDataLocations.forEach(offset => {
    console.log(`  0x${offset.toString(16).padStart(6, '0')} (${offset})`)
  })
  
  console.log(`\nParty Count Locations (${result.partyCountLocations.length} found):`)
  result.partyCountLocations.slice(0, 10).forEach(offset => {
    console.log(`  0x${offset.toString(16).padStart(6, '0')} (${offset})`)
  })
  
  if (result.playerNameLocations.length > 0) {
    console.log(`\nPlayer Name Locations (${result.playerNameLocations.length} found):`)
    result.playerNameLocations.forEach(offset => {
      console.log(`  0x${offset.toString(16).padStart(6, '0')} (${offset})`)
    })
  }
  
  if (result.playTimeLocations.length > 0) {
    console.log(`\nPlay Time Locations (${result.playTimeLocations.length} found):`)
    result.playTimeLocations.forEach(offset => {
      console.log(`  0x${offset.toString(16).padStart(6, '0')} (${offset})`)
    })
  }
  
  console.log('\n🎯 Memory Address Suggestions')
  console.log('=============================')
  
  console.log('\nParty Data:')
  result.memoryAddressSuggestions.partyData.slice(0, 5).forEach(addr => {
    console.log(`  0x${addr.toString(16).padStart(8, '0')}`)
  })
  
  console.log('\nParty Count:')
  result.memoryAddressSuggestions.partyCount.slice(0, 5).forEach(addr => {
    console.log(`  0x${addr.toString(16).padStart(8, '0')}`)
  })
  
  if (result.memoryAddressSuggestions.playTime.length > 0) {
    console.log('\nPlay Time:')
    result.memoryAddressSuggestions.playTime.slice(0, 3).forEach(addr => {
      console.log(`  0x${addr.toString(16).padStart(8, '0')}`)
    })
  }
  
  console.log('\n✅ Next Steps:')
  console.log('1. Test these addresses with mGBA WebSocket API')
  console.log('2. Update your ROM hack config with correct addresses')
  console.log('3. Enable memory support in canHandleMemory() method')
  console.log('4. Add comprehensive tests')
}

/**
 * CLI entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2)
  
  if (args.length < 2) {
    console.log('Usage: npx tsx scripts/analyze-rom-hack-offsets.ts <save-file> <ground-truth-json> [config-name]')
    console.log('\nExample:')
    console.log('  npx tsx scripts/analyze-rom-hack-offsets.ts myromhack.sav myromhack_truth.json MyRomHackConfig')
    process.exit(1)
  }
  
  const [saveFile, groundTruthFile, configName] = args
  
  try {
    const result = await analyzeRomHack(saveFile!, groundTruthFile!, configName)
    printResults(result)
  } catch (error) {
    console.error('❌ Error during analysis:', error)
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { analyzeRomHack, AnalysisResult }