#!/usr/bin/env node
/**
 * Test script to validate the new memory parser against file parser
 * Compares results between memory-based and file-based parsing for accuracy verification
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { PokemonSaveParser } from '../parser/core/PokemonSaveParser.js'
import { VanillaConfig } from '../parser/games/vanilla/config.js'
import { MgbaWebSocketClient } from './websocket-client.js'
import { EmeraldMemoryParser } from './emerald-memory-parser.js'

// ES module compatibility
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function main() {
  console.log('🧪 Testing memory parser accuracy against file parser...\n')

  try {
    // 1. Load and parse the test save file
    console.log('📁 Loading test save file...')
    const savePath = resolve(__dirname, '../parser/__tests__/test_data/emerald.sav')
    const saveBuffer = readFileSync(savePath)
    const testSaveFile = saveBuffer.buffer.slice(saveBuffer.byteOffset, saveBuffer.byteOffset + saveBuffer.byteLength)

    const config = new VanillaConfig()
    const fileParser = new PokemonSaveParser(undefined, config)
    const fileSaveData = await fileParser.parseSaveFile(testSaveFile)

    console.log(`✅ File parser results:`)
    console.log(`   Player: ${fileSaveData.player_name}`)
    console.log(`   Play time: ${fileSaveData.play_time.hours}h ${fileSaveData.play_time.minutes}m ${fileSaveData.play_time.seconds}s`)
    console.log(`   Party Pokemon: ${fileSaveData.party_pokemon.length}`)

    if (fileSaveData.party_pokemon.length > 0) {
      const pokemon = fileSaveData.party_pokemon[0]
      console.log(`   First Pokemon: ${pokemon.nickname} (Species ${pokemon.speciesId}) Level ${pokemon.level}`)
      console.log(`   Stats: HP ${pokemon.currentHp}/${pokemon.maxHp}, ATK ${pokemon.attack}, DEF ${pokemon.defense}`)
      console.log(`   Personality: 0x${pokemon.personality.toString(16)}`)
      console.log(`   OT ID: ${pokemon.otId_str}`)
      console.log(`   Nature: ${pokemon.nature}`)
    }

    // 2. Connect to mGBA and test memory parser
    console.log('\n🔌 Connecting to mGBA WebSocket...')
    const mgbaClient = new MgbaWebSocketClient()
    await mgbaClient.connect()
    console.log('✅ Connected to mGBA')

    // Wait for save state to be fully loaded
    console.log('⏳ Waiting for save state to load...')
    await new Promise(resolve => setTimeout(resolve, 3000))

    const memoryParser = new EmeraldMemoryParser(mgbaClient)

    // Test basic connection
    const connectionTest = await memoryParser.testConnection()
    if (!connectionTest) {
      throw new Error('Memory parser connection test failed')
    }

    // 3. Parse Pokemon from memory
    console.log('\n💾 Reading Pokemon data from memory...')
    const memoryPokemon = await memoryParser.readPartyPokemon()

    console.log(`✅ Memory parser results:`)
    console.log(`   Party Pokemon: ${memoryPokemon.length}`)

    if (memoryPokemon.length > 0) {
      const pokemon = memoryPokemon[0]
      console.log(`   First Pokemon: ${pokemon.nickname} (Species ${pokemon.speciesId}) Level ${pokemon.level}`)
      console.log(`   Stats: HP ${pokemon.currentHp}/${pokemon.maxHp}, ATK ${pokemon.attack}, DEF ${pokemon.defense}`)
      console.log(`   Personality: 0x${pokemon.personality.toString(16)}`)
      console.log(`   OT ID: ${pokemon.otId_str}`)
      console.log(`   Nature: ${pokemon.nature}`)
      console.log(`   Debug: ${pokemon.getDebugSummary()}`)
    }

    // 4. Compare results
    console.log('\n🔍 Comparing file vs memory parsing results...')
    
    let allMatch = true
    const issues = []

    // Compare party size
    if (fileSaveData.party_pokemon.length !== memoryPokemon.length) {
      issues.push(`Party size mismatch: file=${fileSaveData.party_pokemon.length} vs memory=${memoryPokemon.length}`)
      allMatch = false
    }

    // Compare each Pokemon
    for (let i = 0; i < Math.min(fileSaveData.party_pokemon.length, memoryPokemon.length); i++) {
      const filePkm = fileSaveData.party_pokemon[i]
      const memPkm = memoryPokemon[i]

      console.log(`\n   Pokemon ${i + 1} comparison:`)

      // Key comparisons
      const comparisons = [
        { name: 'Species', file: filePkm.speciesId, memory: memPkm.speciesId },
        { name: 'Level', file: filePkm.level, memory: memPkm.level },
        { name: 'Personality', file: `0x${filePkm.personality.toString(16)}`, memory: `0x${memPkm.personality.toString(16)}` },
        { name: 'Current HP', file: filePkm.currentHp, memory: memPkm.currentHp },
        { name: 'Max HP', file: filePkm.maxHp, memory: memPkm.maxHp },
        { name: 'Attack', file: filePkm.attack, memory: memPkm.attack },
        { name: 'Defense', file: filePkm.defense, memory: memPkm.defense },
        { name: 'Speed', file: filePkm.speed, memory: memPkm.speed },
        { name: 'Sp. Attack', file: filePkm.spAttack, memory: memPkm.spAttack },
        { name: 'Sp. Defense', file: filePkm.spDefense, memory: memPkm.spDefense },
        { name: 'Nickname', file: filePkm.nickname, memory: memPkm.nickname },
        { name: 'OT Name', file: filePkm.otName, memory: memPkm.otName },
        { name: 'Nature', file: filePkm.nature, memory: memPkm.nature },
      ]

      for (const comp of comparisons) {
        const match = comp.file === comp.memory
        const status = match ? '✅' : '❌'
        console.log(`     ${comp.name}: ${comp.file} vs ${comp.memory} ${status}`)
        
        if (!match) {
          issues.push(`Pokemon ${i + 1} ${comp.name}: file=${comp.file} vs memory=${comp.memory}`)
          allMatch = false
        }
      }
    }

    // 5. Final results
    console.log('\n📊 Final Results:')
    if (allMatch) {
      console.log('🎉 SUCCESS: Memory parser matches file parser 100%!')
      console.log('   ✅ All Pokemon data fields match exactly')
      console.log('   ✅ Memory parsing is working correctly')
    } else {
      console.log(`❌ ISSUES FOUND: ${issues.length} mismatches detected`)
      console.log('Issues:')
      for (const issue of issues) {
        console.log(`   - ${issue}`)
      }
    }

    // 6. Test write functionality
    if (memoryPokemon.length > 0 && allMatch) {
      console.log('\n🔧 Testing write functionality...')
      const testPokemon = memoryPokemon[0]
      const originalHp = testPokemon.currentHp
      
      try {
        // Test updating HP
        const newHp = Math.max(1, originalHp - 1)
        await testPokemon.updateStatInMemory('currentHp', newHp)
        
        // Read back to verify
        const updatedParty = await memoryParser.readPartyPokemon()
        const updatedPokemon = updatedParty[0]
        
        if (updatedPokemon.currentHp === newHp) {
          console.log(`✅ Write test successful: HP updated from ${originalHp} to ${newHp}`)
          
          // Restore original value
          await testPokemon.updateStatInMemory('currentHp', originalHp)
          console.log(`✅ Restored original HP value: ${originalHp}`)
        } else {
          console.log(`❌ Write test failed: Expected HP ${newHp}, got ${updatedPokemon.currentHp}`)
        }
      } catch (error) {
        console.log(`❌ Write functionality error: ${error.message}`)
      }
    }

    mgbaClient.disconnect()
    console.log('\n✅ Test completed successfully!')

  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

// Run the test
main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})