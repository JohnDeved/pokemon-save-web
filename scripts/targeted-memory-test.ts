#!/usr/bin/env tsx
/**
 * Targeted memory testing for Quetzal RAM offsets
 * Uses smaller, focused scans to avoid WebSocket timeouts
 */

import { readFileSync } from 'node:fs'
import { MgbaWebSocketClient } from '../src/lib/mgba/websocket-client.js'

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
  }>
}

async function targetedMemoryTest(): Promise<void> {
  console.log('🎯 Targeted Quetzal memory testing')
  
  // Load ground truth data
  const groundTruthPath = 'src/lib/parser/__tests__/test_data/quetzal_ground_truth.json'
  const groundTruth = JSON.parse(readFileSync(groundTruthPath, 'utf8')) as GroundTruth
  
  console.log(`📖 Expected: ${groundTruth.party_pokemon.length} Pokemon, ${groundTruth.play_time.hours}h ${groundTruth.play_time.minutes}m ${groundTruth.play_time.seconds}s`)
  
  // Connect to mgba WebSocket
  const client = new MgbaWebSocketClient('ws://localhost:7102/ws')
  
  try {
    await client.connect()
    const gameTitle = await client.getGameTitle()
    console.log(`🎮 Game: ${gameTitle}`)
    
    // Test specific memory ranges around vanilla addresses
    const vanillaBase = 0x2024000 // Base area for Emerald data
    
    console.log('\n🧪 Testing area around vanilla Emerald addresses...')
    
    // Scan a smaller range around the expected area
    for (let offset = -0x1000; offset <= 0x1000; offset += 4) {
      const testAddr = vanillaBase + offset
      
      try {
        const value = await client.readByte(testAddr)
        
        if (value === 6) { // Party count
          console.log(`🎯 Found value 6 at 0x${testAddr.toString(16)}`)
          
          // Check if Pokemon data follows 4 bytes later
          const partyDataAddr = testAddr + 4
          try {
            const pokemonData = await client.readBytes(partyDataAddr, 104)
            const view = new DataView(pokemonData.buffer)
            
            // Check level (offset 0x58 in Quetzal)
            const level = view.getUint8(0x58)
            const currentHp = view.getUint16(0x23, true)
            
            if (level >= 1 && level <= 100 && currentHp > 0) {
              console.log(`   ✨ Pokemon data looks valid: Lv.${level} HP:${currentHp}`)
              console.log(`   🎯 POTENTIAL PARTY COUNT: 0x${testAddr.toString(16)}`)
              console.log(`   🎯 POTENTIAL PARTY DATA:  0x${partyDataAddr.toString(16)}`)
              
              // Test more Pokemon in this party
              for (let i = 1; i < 6; i++) {
                try {
                  const nextPokemonData = await client.readBytes(partyDataAddr + (i * 104), 104)
                  const nextView = new DataView(nextPokemonData.buffer)
                  const nextLevel = nextView.getUint8(0x58)
                  const nextHp = nextView.getUint16(0x23, true)
                  
                  if (i < groundTruth.party_pokemon.length) {
                    console.log(`   Pokemon ${i + 1}: Lv.${nextLevel} HP:${nextHp}`)
                  }
                } catch (e) {
                  // Skip
                }
              }
              
              // This looks promising, let's test play time in the area
              console.log(`   🔍 Scanning for play time near this location...`)
              
              for (let playOffset = -0x2000; playOffset <= 0x2000; playOffset += 4) {
                const playAddr = testAddr + playOffset
                try {
                  const playData = await client.readBytes(playAddr, 8)
                  const playView = new DataView(playData.buffer)
                  
                  const hours = playView.getUint16(0, true)
                  const minutes = playView.getUint8(4)
                  const seconds = playView.getUint8(5)
                  
                  if (hours === groundTruth.play_time.hours && 
                      minutes === groundTruth.play_time.minutes && 
                      seconds === groundTruth.play_time.seconds) {
                    console.log(`   🎯 FOUND PLAY TIME: 0x${playAddr.toString(16)}`)
                    break
                  }
                } catch (e) {
                  // Skip
                }
              }
              
              break // Found a good candidate, stop searching
            }
          } catch (e) {
            // Skip invalid party data addresses
          }
        }
      } catch (e) {
        // Skip invalid addresses
      }
    }
    
    // Also test if the savestate actually corresponds to the save file
    console.log('\n🧪 Testing savestate correspondence...')
    
    // Check some unique patterns from the save file
    const firstPokemonExpected = groundTruth.party_pokemon[0]
    console.log(`   Expected first Pokemon: Level ${firstPokemonExpected.level}, HP ${firstPokemonExpected.currentHp}`)
    
    // Manually test our calculated addresses
    const ourPartyCount = 0x20244e8
    const ourPartyData = 0x20244ec
    
    try {
      const partyCount = await client.readByte(ourPartyCount)
      console.log(`   Our party count addr (0x${ourPartyCount.toString(16)}): ${partyCount}`)
      
      const pokemonData = await client.readBytes(ourPartyData, 104)
      const view = new DataView(pokemonData.buffer)
      const level = view.getUint8(0x58)
      const hp = view.getUint16(0x23, true)
      
      console.log(`   Our party data (0x${ourPartyData.toString(16)}): Lv.${level} HP:${hp}`)
      
      if (level === firstPokemonExpected.level && hp === firstPokemonExpected.currentHp) {
        console.log(`   ✅ Our addresses are correct!`)
      } else {
        console.log(`   ❌ Our addresses don't match savestate`)
        console.log(`   💡 The savestate may not match the save file being used`)
      }
    } catch (e) {
      console.log(`   ❌ Error testing our addresses: ${e}`)
    }
    
  } catch (error) {
    console.error(`❌ Failed: ${error}`)
  } finally {
    client.disconnect()
  }
}

// Handle command line usage
if (import.meta.url === `file://${process.argv[1]}`) {
  targetedMemoryTest().catch(console.error)
}

export { targetedMemoryTest }