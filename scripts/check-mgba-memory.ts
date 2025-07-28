#!/usr/bin/env npx tsx
/**
 * Simple tool to check what's actually running in the emulator
 * and manually scan specific addresses
 */

import { MgbaWebSocketClient } from '../src/lib/mgba/websocket-client'

async function main() {
  const client = new MgbaWebSocketClient('ws://localhost:7102/ws')
  
  console.log('🔌 Connecting to mGBA WebSocket...')
  await client.connect()
  
  const gameTitle = await client.getGameTitle()
  console.log(`🎮 Connected to: "${gameTitle}"`)
  
  // Check if save file is actually loaded
  console.log('\n🔍 Checking various memory locations...')
  
  // Check vanilla Emerald party addresses first
  const vanillaPartyCountAddr = 0x20244e9
  const vanillaPartyDataAddr = 0x20244ec
  
  try {
    const partyCount = await client.readByte(vanillaPartyCountAddr)
    console.log(`Vanilla party count at 0x${vanillaPartyCountAddr.toString(16)}: ${partyCount}`)
    
    if (partyCount > 0 && partyCount <= 6) {
      console.log('Reading first Pokemon from vanilla address...')
      const firstPokemonData = await client.readBytes(vanillaPartyDataAddr, 100)
      
      // For vanilla Emerald, species is at offset 32 (0x20) after decryption
      // For now, let's check some basic patterns
      console.log(`First 32 bytes: ${Array.from(firstPokemonData.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`)
    }
  } catch (error) {
    console.log(`Error reading vanilla addresses: ${error}`)
  }
  
  // Check if we can find patterns matching our expected Quetzal team
  console.log('\n🔍 Looking for Quetzal team signatures...')
  
  // Expected levels: 44, 45, 47, 45, 41, 37
  const expectedLevels = [44, 45, 47, 45, 41, 37]
  
  // Scan a specific region where party data might be
  const scanStart = 0x2020000
  const scanSize = 0x20000  // 128KB region
  
  try {
    console.log(`Scanning 0x${scanStart.toString(16)} - 0x${(scanStart + scanSize).toString(16)}...`)
    const scanData = await client.readBytes(scanStart, scanSize)
    
    // Look for sequences of our expected levels
    for (let i = 0; i < scanData.length - 600; i += 4) {
      // Check if we find level 44 at offset i+88 (Quetzal level offset in 104-byte structure)
      if (i + 88 < scanData.length && scanData[i + 88] === 44) {
        // Check if subsequent Pokemon match expected levels
        let matches = 1
        const pokemonSize = 104
        
        for (let j = 1; j < expectedLevels.length && i + j * pokemonSize + 88 < scanData.length; j++) {
          if (scanData[i + j * pokemonSize + 88] === expectedLevels[j]) {
            matches++
          } else {
            break
          }
        }
        
        if (matches >= 3) {
          const address = scanStart + i
          console.log(`🎯 Found ${matches} level matches at 0x${address.toString(16)}`)
          
          // Show the levels we found
          const foundLevels = []
          for (let j = 0; j < 6 && i + j * pokemonSize + 88 < scanData.length; j++) {
            foundLevels.push(scanData[i + j * pokemonSize + 88])
          }
          console.log(`  Levels: ${foundLevels.join(', ')}`)
          
          // Also check species at offset 40 (0x28)
          const foundSpecies = []
          for (let j = 0; j < 6 && i + j * pokemonSize + 40 + 1 < scanData.length; j++) {
            const species = scanData[i + j * pokemonSize + 40] | (scanData[i + j * pokemonSize + 41] << 8)
            foundSpecies.push(species)
          }
          console.log(`  Species: ${foundSpecies.join(', ')}`)
        }
      }
    }
  } catch (error) {
    console.log(`Error scanning memory: ${error}`)
  }
  
  client.disconnect()
  console.log('\n✅ Done')
}

main().catch(console.error)