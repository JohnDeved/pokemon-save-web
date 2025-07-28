#!/usr/bin/env tsx
/**
 * Dump memory from mgba and analyze quetzal2 party data
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { MgbaWebSocketClient } from '../src/lib/mgba/websocket-client'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function dumpAndAnalyzeQuetzal2() {
  console.log('🔍 Dumping memory for quetzal2 analysis...')
  
  // Connect to mgba WebSocket
  const wsClient = new MgbaWebSocketClient('ws://localhost:7102/ws')
  await wsClient.connect()
  
  console.log('🎮 Connected to mgba, dumping EWRAM...')
  
  // Dump EWRAM (256KB starting at 0x02000000)
  const ewramBase = 0x02000000
  const ewramSize = 262144
  const chunkSize = 1024 // 1KB chunks
  
  let ewramData = new Uint8Array(ewramSize)
  
  for (let offset = 0; offset < ewramSize; offset += chunkSize) {
    const readSize = Math.min(chunkSize, ewramSize - offset)
    const chunk = await wsClient.readBytes(ewramBase + offset, readSize)
    ewramData.set(chunk, offset)
    
    if (offset % (64 * 1024) === 0) {
      console.log(`   Progress: ${(offset / ewramSize * 100).toFixed(1)}%`)
    }
  }
  
  console.log('💾 EWRAM dump complete, analyzing for Pokemon data...')
  
  // Look for Pokemon data patterns
  const possibleParties = []
  
  // Search for patterns that could be Pokemon data
  for (let i = 0; i < ewramData.length - 624; i += 4) { // Look every 4 bytes, need at least 6*104 bytes
    let validPokemonCount = 0
    let pokemonList = []
    
    for (let j = 0; j < 6; j++) {
      const pokemonOffset = i + (j * 104)
      if (pokemonOffset + 104 > ewramData.length) break
      
      // Read Pokemon data
      const speciesId = ewramData[pokemonOffset + 40] | (ewramData[pokemonOffset + 41] << 8)
      const level = ewramData[pokemonOffset + 88]
      const currentHp = ewramData[pokemonOffset + 86] | (ewramData[pokemonOffset + 87] << 8)
      const maxHp = ewramData[pokemonOffset + 90] | (ewramData[pokemonOffset + 91] << 8)
      
      // Check if this looks like valid Pokemon data
      if (speciesId > 0 && speciesId <= 900 && level > 0 && level <= 100 && maxHp > 0 && maxHp <= 999) {
        validPokemonCount++
        pokemonList.push({
          species: speciesId,
          level: level,
          hp: `${currentHp}/${maxHp}`,
          // Try to extract nickname (should be at offset 8, 10 bytes)
          nickname: String.fromCharCode(...Array.from(ewramData.slice(pokemonOffset + 8, pokemonOffset + 18)).filter(b => b > 0 && b < 128))
        })
      } else if (validPokemonCount === 0) {
        // If first Pokemon is invalid, skip this location entirely
        break
      } else {
        // Found some valid Pokemon but this one is invalid - end of party
        break
      }
    }
    
    // If we found 1 or more valid Pokemon, record this location
    if (validPokemonCount >= 1) {
      possibleParties.push({
        address: ewramBase + i,
        count: validPokemonCount,
        pokemon: pokemonList
      })
    }
  }
  
  console.log(`🎯 Found ${possibleParties.length} potential party locations:`)
  
  possibleParties.forEach((party, index) => {
    console.log(`\n${index + 1}. Address: 0x${party.address.toString(16).padStart(8, '0')}`)
    console.log(`   Count: ${party.count} Pokemon`)
    party.pokemon.forEach((p, i) => {
      console.log(`   ${i + 1}. Species ${p.species}, Level ${p.level}, HP ${p.hp}, Nickname: "${p.nickname}"`)
    })
  })
  
  // Save raw memory dump for further analysis
  const dumpPath = path.join(__dirname, '../src/lib/parser/__tests__/test_data/quetzal2_ewram_dump.bin')
  fs.writeFileSync(dumpPath, ewramData)
  console.log(`\n💾 Raw EWRAM dump saved to: ${dumpPath}`)
  
  await wsClient.disconnect()
}

if (import.meta.url === `file://${process.argv[1]}`) {
  dumpAndAnalyzeQuetzal2().catch(console.error)
}

export { dumpAndAnalyzeQuetzal2 }