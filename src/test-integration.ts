#!/usr/bin/env tsx
/**
 * Simple test for integrated memory parser functionality
 * Tests the core parser with WebSocket connection
 */

import { PokemonSaveParser } from '../lib/parser/core/PokemonSaveParser'
import { WebSocketClient } from '../lib/parser/core/WebSocketClient'

async function testMemoryIntegration() {
  console.log('🧪 Testing integrated memory parser...')

  try {
    // Create WebSocket client
    const client = new WebSocketClient('ws://localhost:7102/ws')
    await client.connect()
    console.log('✅ Connected to mGBA WebSocket server')

    // Create parser with WebSocket
    const parser = new PokemonSaveParser()
    
    // Load via WebSocket (this will switch to memory mode)
    await parser.loadSaveFile(client)
    console.log('✅ Parser initialized in memory mode')

    // Parse save data from memory
    const saveData = await parser.parseSaveFile(client)
    console.log('✅ Successfully parsed data from memory')

    console.log(`\n📊 Memory Parse Results:`)
    console.log(`Player Name: ${saveData.player_name}`)
    console.log(`Party Size: ${saveData.party_pokemon.length}`)
    
    for (let i = 0; i < saveData.party_pokemon.length; i++) {
      const pokemon = saveData.party_pokemon[i]
      console.log(`  Pokemon ${i + 1}: Species ${pokemon.speciesId}, Level ${pokemon.level}, HP: ${pokemon.currentHp}/${pokemon.maxHp}`)
    }

    // Test memory mode detection
    console.log(`\nMemory Mode: ${parser.isInMemoryMode()}`)

    // Clean up
    client.disconnect()
    console.log('\n✅ Memory integration test completed successfully!')

  } catch (error) {
    console.error('❌ Memory integration test failed:', error)
    process.exit(1)
  }
}

// Run the test
testMemoryIntegration()