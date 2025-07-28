#!/usr/bin/env tsx
/**
 * Verify Quetzal RAM offsets using real mgba emulator
 * This script connects to the running mgba Docker container and validates memory addresses
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

async function verifyQuetzalMemory(): Promise<void> {
  console.log('🔍 Verifying Quetzal RAM offsets using mgba WebSocket API')
  
  // Load ground truth data
  const groundTruthPath = 'src/lib/parser/__tests__/test_data/quetzal_ground_truth.json'
  const groundTruth = JSON.parse(readFileSync(groundTruthPath, 'utf8')) as GroundTruth
  
  console.log(`📖 Loaded ground truth: ${groundTruth.party_pokemon.length} Pokemon in party`)
  console.log(`⏰ Expected play time: ${groundTruth.play_time.hours}h ${groundTruth.play_time.minutes}m ${groundTruth.play_time.seconds}s`)
  
  // Connect to mgba WebSocket
  const client = new MgbaWebSocketClient('ws://localhost:7102/ws')
  
  try {
    console.log('🔗 Connecting to mgba WebSocket...')
    await client.connect()
    console.log('✅ Connected to mgba WebSocket')
    
    // Verify game title
    const gameTitle = await client.getGameTitle()
    console.log(`🎮 Game title: ${gameTitle}`)
    
    // Check if QuetzalConfig can handle this game
    const config = new QuetzalConfig()
    if (!config.canHandleMemory(gameTitle)) {
      console.error('❌ QuetzalConfig cannot handle this game title')
      process.exit(1)
    }
    console.log('✅ QuetzalConfig can handle this game')
    
    // Test memory addresses
    const memAddresses = config.memoryAddresses
    console.log('\n📍 Testing memory addresses:')
    console.log(`   Party Count: 0x${memAddresses.partyCount.toString(16)}`)
    console.log(`   Party Data:  0x${memAddresses.partyData.toString(16)}`)
    console.log(`   Play Time:   0x${memAddresses.playTime.toString(16)}`)
    
    // Test 1: Read party count
    console.log('\n🧪 Test 1: Party Count')
    try {
      const partyCount = await client.readByte(memAddresses.partyCount)
      console.log(`   Memory value: ${partyCount}`)
      console.log(`   Expected:     ${groundTruth.party_pokemon.length}`)
      
      if (partyCount === groundTruth.party_pokemon.length) {
        console.log('   ✅ Party count matches!')
      } else {
        console.log('   ❌ Party count mismatch!')
        
        // Try nearby addresses to find the correct one
        console.log('   🔍 Scanning nearby addresses...')
        for (let offset = -8; offset <= 8; offset++) {
          const testAddr = memAddresses.partyCount + offset
          try {
            const testValue = await client.readByte(testAddr)
            if (testValue === groundTruth.party_pokemon.length) {
              console.log(`   ✨ Found party count at 0x${testAddr.toString(16)} (offset ${offset >= 0 ? '+' : ''}${offset})`)
            }
          } catch (e) {
            // Skip invalid addresses
          }
        }
      }
    } catch (error) {
      console.log(`   ❌ Error reading party count: ${error}`)
    }
    
    // Test 2: Read first Pokemon species
    console.log('\n🧪 Test 2: First Pokemon Species')
    try {
      // Read first Pokemon data (104 bytes)
      const pokemonData = await client.readBytes(memAddresses.partyData, 104)
      const view = new DataView(pokemonData.buffer)
      
      // Get species using QuetzalConfig method
      const speciesId = config.getSpeciesId(pokemonData, view)
      const pokemonName = config.getPokemonName(pokemonData, view)
      
      console.log(`   Memory species ID: ${speciesId}`)
      console.log(`   Memory species name: ${pokemonName}`)
      console.log(`   Expected species: ${groundTruth.party_pokemon[0]?.species || 'Unknown'}`)
      
      if (pokemonName === groundTruth.party_pokemon[0]?.species) {
        console.log('   ✅ First Pokemon species matches!')
      } else {
        console.log('   ❌ First Pokemon species mismatch!')
        
        // Try to read raw species value for debugging
        const rawSpecies = view.getUint16(0x28, true) // species offset in Quetzal
        console.log(`   Raw species value: ${rawSpecies} (0x${rawSpecies.toString(16)})`)
      }
    } catch (error) {
      console.log(`   ❌ Error reading Pokemon data: ${error}`)
    }
    
    // Test 3: Read first Pokemon level
    console.log('\n🧪 Test 3: First Pokemon Level')
    try {
      const pokemonData = await client.readBytes(memAddresses.partyData, 104)
      const view = new DataView(pokemonData.buffer)
      
      // Level is at offset 0x58 in Quetzal
      const level = view.getUint8(0x58)
      console.log(`   Memory level: ${level}`)
      console.log(`   Expected:     ${groundTruth.party_pokemon[0]?.level}`)
      
      if (level === groundTruth.party_pokemon[0]?.level) {
        console.log('   ✅ First Pokemon level matches!')
      } else {
        console.log('   ❌ First Pokemon level mismatch!')
      }
    } catch (error) {
      console.log(`   ❌ Error reading Pokemon level: ${error}`)
    }
    
    // Test 4: Read play time
    console.log('\n🧪 Test 4: Play Time')
    try {
      const playTimeData = await client.readBytes(memAddresses.playTime, 8)
      const view = new DataView(playTimeData.buffer)
      
      // Play time format in memory might be different
      const hours = view.getUint16(0, true)
      const minutes = view.getUint8(4)
      const seconds = view.getUint8(5)
      
      console.log(`   Memory time: ${hours}h ${minutes}m ${seconds}s`)
      console.log(`   Expected:    ${groundTruth.play_time.hours}h ${groundTruth.play_time.minutes}m ${groundTruth.play_time.seconds}s`)
      
      if (hours === groundTruth.play_time.hours && 
          minutes === groundTruth.play_time.minutes && 
          seconds === groundTruth.play_time.seconds) {
        console.log('   ✅ Play time matches!')
      } else {
        console.log('   ❌ Play time mismatch!')
        
        // Try different offsets for play time
        console.log('   🔍 Scanning for play time pattern...')
        for (let offset = -32; offset <= 32; offset += 4) {
          const testAddr = memAddresses.playTime + offset
          try {
            const testData = await client.readBytes(testAddr, 8)
            const testView = new DataView(testData.buffer)
            const testHours = testView.getUint16(0, true)
            const testMinutes = testView.getUint8(4)
            const testSeconds = testView.getUint8(5)
            
            if (testHours === groundTruth.play_time.hours && 
                testMinutes === groundTruth.play_time.minutes && 
                testSeconds === groundTruth.play_time.seconds) {
              console.log(`   ✨ Found play time at 0x${testAddr.toString(16)} (offset ${offset >= 0 ? '+' : ''}${offset})`)
            }
          } catch (e) {
            // Skip invalid addresses
          }
        }
      }
    } catch (error) {
      console.log(`   ❌ Error reading play time: ${error}`)
    }
    
    // Test 5: Full party verification
    console.log('\n🧪 Test 5: Full Party Verification')
    try {
      const fullPartyData = await client.readBytes(memAddresses.partyData, 624) // 6 * 104 bytes
      
      for (let i = 0; i < groundTruth.party_pokemon.length; i++) {
        const pokemonOffset = i * 104
        const pokemonData = fullPartyData.slice(pokemonOffset, pokemonOffset + 104)
        const view = new DataView(pokemonData.buffer)
        
        const speciesName = config.getPokemonName(pokemonData, view)
        const level = view.getUint8(0x58)
        
        console.log(`   Pokemon ${i + 1}: ${speciesName} Lv.${level}`)
        
        const expected = groundTruth.party_pokemon[i]
        if (expected) {
          const matches = speciesName === expected.species && level === expected.level
          console.log(`     Expected: ${expected.species || 'Unknown'} Lv.${expected.level} ${matches ? '✅' : '❌'}`)
        }
      }
    } catch (error) {
      console.log(`   ❌ Error reading full party: ${error}`)
    }
    
    console.log('\n🎯 Memory verification complete!')
    
  } catch (error) {
    console.error(`❌ Failed to connect or test memory: ${error}`)
    console.log('\n💡 Make sure mgba Docker container is running with Quetzal:')
    console.log('   npm run mgba -- start --game quetzal')
    process.exit(1)
  } finally {
    client.disconnect()
  }
}

// Handle command line usage
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyQuetzalMemory().catch(console.error)
}

export { verifyQuetzalMemory }