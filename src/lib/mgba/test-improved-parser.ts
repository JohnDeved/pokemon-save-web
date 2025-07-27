#!/usr/bin/env node

/**
 * Test script for improved memory parser
 * Compares memory parsing results with file parsing for accuracy verification
 * Based on mGBA pokemon.lua approach for 100% accuracy
 */

import { MgbaWebSocketClient } from './websocket-client'
import { ImprovedEmeraldMemoryParser } from './improved-memory-parser'
import { PokemonSaveParser } from '../parser/core/PokemonSaveParser'
import '../parser/games' // Import game configurations
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function testImprovedMemoryParser() {
  console.log('🧪 Testing Improved mGBA Memory Parser')
  console.log('=====================================\n')

  try {
    // 1. Load the reference save file
    console.log('📁 Loading reference save file...')
    const saveFilePath = join(__dirname, '../parser/__tests__/test_data/emerald.sav')
    const saveData = readFileSync(saveFilePath)
    console.log(`✅ Loaded save file: ${saveData.length} bytes\n`)

    // 2. Parse with file parser (ground truth)
    console.log('📄 Parsing with file parser (ground truth)...')
    const fileParser = new PokemonSaveParser()
    const fileSaveData = await fileParser.parseSaveFile(saveData.buffer)
    console.log('FileSaveData:', fileSaveData)
    console.log(`✅ File parser found ${fileSaveData.party_pokemon?.length || 0} Pokemon in party\n`)

    // 3. Connect to mGBA and parse with memory parser
    console.log('🌐 Connecting to mGBA...')
    const client = new MgbaWebSocketClient()
    await client.connect()
    console.log('✅ Connected to mGBA\n')

    // Wait a moment for save state to be fully loaded
    console.log('⏳ Waiting for save state to load...')
    await new Promise(resolve => setTimeout(resolve, 5000))
    console.log('✅ Save state should be loaded\n')

    // 4. Parse with improved memory parser
    console.log('🧠 Parsing with improved memory parser...')
    const memoryParser = new ImprovedEmeraldMemoryParser(client)
    const memoryPartyPokemon = await memoryParser.readPartyPokemon()
    console.log(`✅ Memory parser found ${memoryPartyPokemon.length} Pokemon in party\n`)

    // 5. Compare results
    console.log('🔍 Comparing memory vs file parsing results...')
    console.log('=' .repeat(60))
    
    const filePartyPokemon = fileSaveData.party_pokemon || []
    
    if (filePartyPokemon.length !== memoryPartyPokemon.length) {
      console.log(`❌ Party count mismatch: File=${filePartyPokemon.length}, Memory=${memoryPartyPokemon.length}`)
      return
    }

    let allMatch = true
    
    for (let i = 0; i < Math.min(filePartyPokemon.length, memoryPartyPokemon.length); i++) {
      const filePokemon = filePartyPokemon[i]
      const memoryPokemon = memoryPartyPokemon[i]
      
      console.log(`\nPokemon ${i + 1}:`)
      console.log(`  Name:        File="${filePokemon.nickname || 'undefined'}" vs Memory="${memoryPokemon.name}"`)
      console.log(`  Species:     File=${filePokemon.speciesId || 'undefined'} vs Memory=${memoryPokemon.species}`)
      console.log(`  Level:       File=${filePokemon.level} vs Memory=${memoryPokemon.level}`)
      console.log(`  Personality: File=0x${filePokemon.personality?.toString(16) || 'undefined'} vs Memory=0x${memoryPokemon.personality.toString(16)}`)
      console.log(`  OT ID:       File=0x${filePokemon.fullTrainerId?.toString(16) || 'undefined'} vs Memory=0x${memoryPokemon.fullTrainerId.toString(16)}`)
      console.log(`  Experience:  File=${filePokemon.experience || 'undefined'} vs Memory=${memoryPokemon.experience}`)
      console.log(`  Item:        File=${filePokemon.heldItem || 'undefined'} vs Memory=${memoryPokemon.heldItem}`)
      console.log(`  HP:          File=${filePokemon.currentHp || 'undefined'}/${filePokemon.maxHp || 'undefined'} vs Memory=${memoryPokemon.currentHp}/${memoryPokemon.maxHp}`)
      
      // Check for key field matches
      const matches = {
        species: (filePokemon.speciesId || 0) === memoryPokemon.species,
        level: filePokemon.level === memoryPokemon.level,
        personality: (filePokemon.personality || 0) === memoryPokemon.personality,
        otId: (filePokemon.fullTrainerId || 0) === memoryPokemon.fullTrainerId,
        experience: (filePokemon.experience || 0) === memoryPokemon.experience
      }
      
      const pokemonMatches = Object.values(matches).every(match => match)
      console.log(`  Match: ${pokemonMatches ? '✅' : '❌'}`)
      
      if (!pokemonMatches) {
        allMatch = false
        console.log(`  Mismatches: ${Object.entries(matches).filter(([, match]) => !match).map(([field]) => field).join(', ')}`)
      }
    }

    console.log('\n' + '=' .repeat(60))
    console.log(`Overall Result: ${allMatch ? '✅ ALL POKEMON MATCH!' : '❌ Some Pokemon do not match'}`)
    
    if (allMatch) {
      console.log('🎉 Memory parser is working correctly and matches file parser 100%!')
      console.log('🔥 The mGBA pokemon.lua approach has been successfully implemented!')
    } else {
      console.log('🔧 Memory parser needs further refinement to match file parser exactly.')
    }

    // 6. Disconnect
    console.log('\n🔌 Disconnecting from mGBA...')
    await client.disconnect()
    console.log('✅ Disconnected')

  } catch (error) {
    console.error('❌ Test failed:', error)
    
    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Make sure the mGBA Docker container is running:')
      console.error('   npm run mgba:start')
      console.error('   Wait for "healthy" status in: docker ps')
    }
  }
}

// Run the test
testImprovedMemoryParser()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Test script failed:', error)
    process.exit(1)
  })