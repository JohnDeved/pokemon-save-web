#!/usr/bin/env node

/**
 * Memory scanner tool to find correct save data addresses in mGBA
 * This will help us locate where Emerald actually loads save data in memory
 */

import { MgbaWebSocketClient } from './websocket-client'
import { MEMORY_REGIONS } from './memory-mapping'

async function scanForSaveData() {
  console.log('🔍 mGBA Memory Scanner')
  console.log('=====================================\n')

  try {
    // Connect to mGBA
    console.log('🌐 Connecting to mGBA...')
    const client = new MgbaWebSocketClient()
    await client.connect()
    console.log('✅ Connected to mGBA\n')

    // Wait for save state to load
    console.log('⏳ Waiting for save state to load...')
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Known values from the save file:
    // - Player name: "EMERALD" (in Pokemon encoding)
    // - Party count: 1 (as 32-bit value)
    // - Pokemon personality: 0x6CCBFD84 (from test data)

    console.log('🔍 Scanning EWRAM for save data patterns...\n')

    // Scan for party count of 1 (0x00000001)
    console.log('Looking for party count (0x00000001)...')
    const partyCountAddresses = await scanForDWord(client, MEMORY_REGIONS.EWRAM_BASE, 0x40000, 0x00000001)
    console.log(`Found ${partyCountAddresses.length} potential party count addresses:`)
    for (const addr of partyCountAddresses.slice(0, 10)) {
      console.log(`  0x${addr.toString(16).padStart(8, '0')}`)
    }

    // Look around those addresses for other save data
    if (partyCountAddresses.length > 0) {
      console.log('\n🔍 Examining memory around potential party count addresses...')
      for (const addr of partyCountAddresses.slice(0, 3)) {
        console.log(`\nChecking around 0x${addr.toString(16)}:`)
        
        // Check for player name around this area
        const nameCheckAddr = addr - 0x234 // PARTY_COUNT offset from our layout
        console.log(`  Checking player name at 0x${nameCheckAddr.toString(16)}:`)
        try {
          const nameBytes = await client.readBytes(nameCheckAddr, 8)
          const decodedName = decodePokemonName(nameBytes)
          console.log(`    Raw bytes: ${Array.from(nameBytes).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ')}`)
          console.log(`    Decoded: "${decodedName}"`)
          
          if (decodedName.includes('EMERALD') || decodedName.includes('emerald')) {
            console.log(`    🎯 FOUND PLAYER NAME! Base address might be: 0x${nameCheckAddr.toString(16)}`)
          }
        } catch (error) {
          console.log(`    Error reading name: ${error}`)
        }

        // Check for Pokemon data at party offset
        const partyAddr = addr + 4 // Just after party count
        console.log(`  Checking Pokemon data at 0x${partyAddr.toString(16)}:`)
        try {
          const pokemonBytes = await client.readBytes(partyAddr, 16)
          console.log(`    First 16 bytes: ${Array.from(pokemonBytes).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ')}`)
          
          // Check if this looks like a Pokemon personality value
          const personality = pokemonBytes[0] | (pokemonBytes[1] << 8) | (pokemonBytes[2] << 16) | (pokemonBytes[3] << 24)
          console.log(`    Potential personality: 0x${personality.toString(16)}`)
        } catch (error) {
          console.log(`    Error reading Pokemon data: ${error}`)
        }
      }
    }

    // Try scanning for the expected Pokemon personality value from our test data
    console.log('\n🔍 Scanning for known Pokemon personality value...')
    // From the test, TREECKO has personality 0x6CCBFD84 (little-endian: 84 FD CB 6C)
    const personalityAddresses = await scanForDWord(client, MEMORY_REGIONS.EWRAM_BASE, 0x40000, 0x6CCBFD84)
    console.log(`Found ${personalityAddresses.length} potential Pokemon personality addresses:`)
    for (const addr of personalityAddresses.slice(0, 5)) {
      console.log(`  0x${addr.toString(16).padStart(8, '0')}`)
      
      // This should be the start of Pokemon data, so party data starts here
      const partyStartAddr = addr
      const partyCountAddr = partyStartAddr - 4 // Party count is just before party data
      
      try {
        const partyCount = await client.readDWord(partyCountAddr)
        console.log(`    Party count at 0x${partyCountAddr.toString(16)}: ${partyCount}`)
        
        if (partyCount === 1) {
          console.log(`    🎯 POTENTIAL MATCH! Party starts at 0x${partyStartAddr.toString(16)}`)
          
          // Calculate potential save data base
          const saveBase = partyStartAddr - 0x238 // PARTY_POKEMON offset
          console.log(`    🎯 POTENTIAL SAVE BASE: 0x${saveBase.toString(16)}`)
          
          // Test player name at this base
          try {
            const nameBytes = await client.readBytes(saveBase, 8)
            const decodedName = decodePokemonName(nameBytes)
            console.log(`    Player name at base: "${decodedName}"`)
          } catch (error) {
            console.log(`    Error reading player name: ${error}`)
          }
        }
      } catch (error) {
        console.log(`    Error reading party count: ${error}`)
      }
    }

    client.disconnect()

  } catch (error) {
    console.error('\n❌ Error:', error)
    process.exit(1)
  }
}

async function scanForDWord(client: MgbaWebSocketClient, startAddr: number, size: number, targetValue: number): Promise<number[]> {
  const foundAddresses: number[] = []
  const stepSize = 4 // Scan 4-byte aligned addresses
  
  for (let addr = startAddr; addr < startAddr + size; addr += stepSize) {
    try {
      const value = await client.readDWord(addr)
      if (value === targetValue) {
        foundAddresses.push(addr)
      }
    } catch (error) {
      // Skip addresses that can't be read
      continue
    }
    
    // Progress indicator
    if ((addr - startAddr) % 0x10000 === 0) {
      const progress = ((addr - startAddr) / size * 100).toFixed(1)
      process.stdout.write(`\r  Progress: ${progress}%`)
    }
  }
  
  console.log() // New line after progress
  return foundAddresses
}

function decodePokemonName(bytes: Uint8Array): string {
  let name = ''
  for (let i = 0; i < bytes.length && bytes[i] !== 0xFF; i++) {
    const char = bytes[i]
    if (char === 0) break
    
    // Simplified character mapping (A-Z, a-z range)
    if (char >= 0xBB && char <= 0xD4) {
      name += String.fromCharCode(char - 0xBB + 65) // A-Z
    } else if (char >= 0xD5 && char <= 0xEE) {
      name += String.fromCharCode(char - 0xD5 + 97) // a-z
    } else if (char >= 0xA1 && char <= 0xAA) {
      name += String.fromCharCode(char - 0xA1 + 48) // 0-9
    } else {
      name += '?'
    }
  }
  return name
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  scanForSaveData().catch(console.error)
}

export { scanForSaveData }