#!/usr/bin/env tsx
/**
 * Comprehensive memory scanner to find correct Quetzal RAM offsets
 * This script systematically searches through EWRAM to find matching patterns
 */

import { readFileSync } from 'node:fs'
import { MgbaWebSocketClient } from '../src/lib/mgba/websocket-client.js'
import { QuetzalConfig } from '../src/lib/parser/games/quetzal/config.js'

interface GroundTruth {
  player_name: string
  play_time: {
    hours: number
    minutes: number
    seconds: number
  }
  active_slot: number
  party_pokemon: Array<{
    species?: string
    nickname: string
    level: number
    currentHp: number
    maxHp?: number
    attack?: number
    defense?: number
    speed?: number
    spAttack?: number
    spDefense?: number
    nature?: string
    isShiny?: boolean
    moves?: string[]
    ivs?: number[]
    evs?: number[]
    item?: string
  }>
}

async function scanForQuetzalOffsets(): Promise<void> {
  console.log('🔍 Comprehensive scan for Quetzal RAM offsets')
  
  // Load ground truth data
  const groundTruthPath = 'src/lib/parser/__tests__/test_data/quetzal_ground_truth.json'
  const groundTruth = JSON.parse(readFileSync(groundTruthPath, 'utf8')) as GroundTruth
  
  console.log(`📖 Ground truth: ${groundTruth.party_pokemon.length} Pokemon in party`)
  console.log(`⏰ Play time: ${groundTruth.play_time.hours}h ${groundTruth.play_time.minutes}m ${groundTruth.play_time.seconds}s`)
  
  // Connect to mgba WebSocket
  const client = new MgbaWebSocketClient('ws://localhost:7102/ws')
  const config = new QuetzalConfig()
  
  try {
    console.log('🔗 Connecting to mgba WebSocket...')
    await client.connect()
    console.log('✅ Connected to mgba WebSocket')
    
    // Verify game title
    const gameTitle = await client.getGameTitle()
    console.log(`🎮 Game title: ${gameTitle}`)
    
    // EWRAM range for GBA: 0x2000000 to 0x2040000
    const EWRAM_START = 0x2000000
    const EWRAM_END = 0x2040000
    
    console.log('\n🧪 Scanning for party count (should be 6)...')
    const partyCountCandidates: number[] = []
    
    // Scan for party count (byte value 6)
    for (let addr = EWRAM_START; addr < EWRAM_END; addr += 4) {
      try {
        const value = await client.readByte(addr)
        if (value === 6) {
          partyCountCandidates.push(addr)
          console.log(`   🎯 Found value 6 at 0x${addr.toString(16)}`)
          
          if (partyCountCandidates.length > 20) {
            console.log('   ... (limiting output, too many candidates)')
            break
          }
        }
      } catch (e) {
        // Skip invalid addresses
      }
    }
    
    console.log(`\n📊 Found ${partyCountCandidates.length} candidates for party count`)
    
    // For each party count candidate, check if Pokemon data follows 4 bytes later
    console.log('\n🧪 Validating party count candidates with Pokemon data...')
    
    const validCandidates: Array<{ partyCountAddr: number, partyDataAddr: number }> = []
    
    for (const partyCountAddr of partyCountCandidates.slice(0, 10)) { // Limit to first 10 to avoid timeout
      const partyDataAddr = partyCountAddr + 4
      
      try {
        // Read first Pokemon data (104 bytes)
        const pokemonData = await client.readBytes(partyDataAddr, 104)
        const view = new DataView(pokemonData.buffer)
        
        // Check if level makes sense (1-100)
        const level = view.getUint8(0x58) // Level offset in Quetzal
        
        if (level >= 1 && level <= 100) {
          // Get species using QuetzalConfig method
          const speciesName = config.getPokemonName(pokemonData, view)
          
          console.log(`   ✨ Candidate 0x${partyCountAddr.toString(16)}: Level ${level}, Species: ${speciesName || 'Unknown'}`)
          
          validCandidates.push({
            partyCountAddr,
            partyDataAddr
          })
        }
      } catch (e) {
        // Skip invalid addresses
      }
    }
    
    console.log(`\n📊 Found ${validCandidates.length} valid party data candidates`)
    
    // Test the most promising candidates
    for (const candidate of validCandidates.slice(0, 3)) {
      console.log(`\n🧪 Testing candidate: Party Count 0x${candidate.partyCountAddr.toString(16)}, Party Data 0x${candidate.partyDataAddr.toString(16)}`)
      
      try {
        // Read full party data
        const fullPartyData = await client.readBytes(candidate.partyDataAddr, 624) // 6 * 104 bytes
        
        let matchingPokemon = 0
        for (let i = 0; i < 6; i++) {
          const pokemonOffset = i * 104
          const pokemonData = fullPartyData.slice(pokemonOffset, pokemonOffset + 104)
          const view = new DataView(pokemonData.buffer)
          
          const speciesName = config.getPokemonName(pokemonData, view)
          const level = view.getUint8(0x58)
          const currentHp = view.getUint16(0x23, true)
          
          console.log(`     Pokemon ${i + 1}: ${speciesName || 'Unknown'} Lv.${level} HP:${currentHp}`)
          
          // Check if level is reasonable and HP > 0 for party members
          if (i < groundTruth.party_pokemon.length) {
            if (level >= 1 && level <= 100 && currentHp > 0) {
              matchingPokemon++
            }
          }
        }
        
        console.log(`     ✅ ${matchingPokemon}/${groundTruth.party_pokemon.length} Pokemon look valid`)
        
        if (matchingPokemon >= 4) { // At least 4 out of 6 look reasonable
          console.log(`     🎯 STRONG CANDIDATE for party addresses!`)
        }
      } catch (e) {
        console.log(`     ❌ Error reading party data: ${e}`)
      }
    }
    
    // Now scan for play time
    console.log('\n🧪 Scanning for play time pattern...')
    console.log(`   Looking for: ${groundTruth.play_time.hours}h ${groundTruth.play_time.minutes}m ${groundTruth.play_time.seconds}s`)
    
    const playTimeCandidates: number[] = []
    
    // Scan in smaller steps since play time is more specific
    for (let addr = EWRAM_START; addr < EWRAM_END; addr += 2) {
      try {
        const data = await client.readBytes(addr, 8)
        const view = new DataView(data.buffer)
        
        // Try different interpretations of play time format
        const hours16 = view.getUint16(0, true)
        const minutes8 = view.getUint8(4)
        const seconds8 = view.getUint8(5)
        
        if (hours16 === groundTruth.play_time.hours && 
            minutes8 === groundTruth.play_time.minutes && 
            seconds8 === groundTruth.play_time.seconds) {
          playTimeCandidates.push(addr)
          console.log(`   🎯 Found play time at 0x${addr.toString(16)}`)
        }
        
        // Also try different byte arrangements
        const hours8 = view.getUint8(0)
        const minutes8_alt = view.getUint8(1)
        const seconds8_alt = view.getUint8(2)
        
        if (hours8 === groundTruth.play_time.hours && 
            minutes8_alt === groundTruth.play_time.minutes && 
            seconds8_alt === groundTruth.play_time.seconds) {
          playTimeCandidates.push(addr)
          console.log(`   🎯 Found play time (alt format) at 0x${addr.toString(16)}`)
        }
        
      } catch (e) {
        // Skip invalid addresses
      }
      
      // Limit scan to avoid timeout
      if (addr % 0x10000 === 0) {
        console.log(`   Scanned up to 0x${addr.toString(16)}...`)
      }
      if (playTimeCandidates.length > 0) {
        break // Found something, stop scanning
      }
    }
    
    console.log(`\n📊 Found ${playTimeCandidates.length} play time candidates`)
    
    if (playTimeCandidates.length > 0) {
      console.log('\n🎯 SUMMARY OF FINDINGS:')
      console.log('='.repeat(50))
      
      if (validCandidates.length > 0) {
        const bestCandidate = validCandidates[0]
        console.log(`✨ PARTY COUNT ADDRESS: 0x${bestCandidate.partyCountAddr.toString(16)}`)
        console.log(`✨ PARTY DATA ADDRESS:  0x${bestCandidate.partyDataAddr.toString(16)}`)
      }
      
      for (const addr of playTimeCandidates) {
        console.log(`✨ PLAY TIME ADDRESS:   0x${addr.toString(16)}`)
      }
      
      console.log('\n🔧 Updated config should be:')
      if (validCandidates.length > 0) {
        const bestCandidate = validCandidates[0]
        console.log(`readonly memoryAddresses = {`)
        console.log(`  partyCount: 0x${bestCandidate.partyCountAddr.toString(16)},`)
        console.log(`  partyData: 0x${bestCandidate.partyDataAddr.toString(16)},`)
        if (playTimeCandidates.length > 0) {
          console.log(`  playTime: 0x${playTimeCandidates[0].toString(16)},`)
        }
        console.log(`}`)
      }
    } else {
      console.log('\n❌ Could not find play time pattern in memory')
      console.log('   The save state might not match the save file, or the format is different')
    }
    
  } catch (error) {
    console.error(`❌ Failed to scan memory: ${error}`)
    process.exit(1)
  } finally {
    client.disconnect()
  }
}

// Handle command line usage
if (import.meta.url === `file://${process.argv[1]}`) {
  scanForQuetzalOffsets().catch(console.error)
}

export { scanForQuetzalOffsets }