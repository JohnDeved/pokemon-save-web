#!/usr/bin/env tsx
/**
 * Final verification of Quetzal RAM offsets
 */

import { readFileSync } from 'node:fs'
import { MgbaWebSocketClient } from '../src/lib/mgba/websocket-client.js'
import { QuetzalConfig } from '../src/lib/parser/games/quetzal/config.js'

async function finalVerification(): Promise<void> {
  console.log('✅ Final verification of corrected Quetzal RAM offsets')
  
  const groundTruthPath = 'src/lib/parser/__tests__/test_data/quetzal_ground_truth.json'
  const groundTruth = JSON.parse(readFileSync(groundTruthPath, 'utf8'))
  
  const client = new MgbaWebSocketClient('ws://localhost:7102/ws')
  const config = new QuetzalConfig()
  
  try {
    await client.connect()
    console.log(`🎮 Game: ${await client.getGameTitle()}`)
    
    const memAddresses = config.memoryAddresses
    
    // Test 1: Party Count
    const partyCount = await client.readByte(memAddresses.partyCount)
    console.log(`🧪 Party Count: ${partyCount} (expected: ${groundTruth.party_pokemon.length}) ${partyCount === groundTruth.party_pokemon.length ? '✅' : '❌'}`)
    
    // Test 2: Play Time  
    const playTimeData = await client.readBytes(memAddresses.playTime, 8)
    const view = new DataView(playTimeData.buffer)
    const hours = view.getUint16(0, true)
    const minutes = view.getUint8(4)
    const seconds = view.getUint8(5)
    
    const expectedTime = groundTruth.play_time
    const timeMatches = hours === expectedTime.hours && minutes === expectedTime.minutes && seconds === expectedTime.seconds
    console.log(`🧪 Play Time: ${hours}h ${minutes}m ${seconds}s (expected: ${expectedTime.hours}h ${expectedTime.minutes}m ${expectedTime.seconds}s) ${timeMatches ? '✅' : '❌'}`)
    
    // Test 3: First Pokemon level (quick test)
    const firstPokemonData = await client.readBytes(memAddresses.partyData, 104)
    const pokemonView = new DataView(firstPokemonData.buffer)
    const level = pokemonView.getUint8(0x58)
    const currentHp = pokemonView.getUint16(0x23, true)
    
    const firstPokemon = groundTruth.party_pokemon[0]
    const pokemonMatches = level === firstPokemon.level && currentHp === firstPokemon.currentHp
    console.log(`🧪 First Pokemon: Lv.${level} HP:${currentHp} (expected: Lv.${firstPokemon.level} HP:${firstPokemon.currentHp}) ${pokemonMatches ? '✅' : '❌'}`)
    
    if (partyCount === groundTruth.party_pokemon.length && timeMatches && pokemonMatches) {
      console.log('\n🎉 ALL TESTS PASSED! Quetzal RAM offsets are correct!')
      console.log('\n📋 Verified addresses:')
      console.log(`   Party Count: 0x${memAddresses.partyCount.toString(16)}`)
      console.log(`   Party Data:  0x${memAddresses.partyData.toString(16)}`)
      console.log(`   Play Time:   0x${memAddresses.playTime.toString(16)}`)
    } else {
      console.log('\n❌ Some tests failed. Check the addresses.')
    }
    
  } catch (error) {
    console.error(`❌ Error: ${error}`)
  } finally {
    client.disconnect()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  finalVerification().catch(console.error)
}