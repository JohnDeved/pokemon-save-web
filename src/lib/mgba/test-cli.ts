#!/usr/bin/env node

/**
 * CLI tool for testing mGBA memory parser
 * Compares memory parsing results with file parsing results
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { PokemonSaveParser } from '../parser/core/PokemonSaveParser'
import { VanillaConfig } from '../parser/games/vanilla/config'
import { MgbaWebSocketClient } from './websocket-client'
import { EmeraldMemoryParser } from './memory-parser'

async function main () {
  console.log('🔍 mGBA Memory Parser Test Tool')
  console.log('=====================================\n')

  try {
    // Load the test save file
    console.log('📁 Loading test save file...')
    const savePath = resolve(process.cwd(), 'src/lib/parser/__tests__/test_data', 'emerald.sav')
    const saveBuffer = readFileSync(savePath)
    const testSaveFile = saveBuffer.buffer.slice(saveBuffer.byteOffset, saveBuffer.byteOffset + saveBuffer.byteLength)
    console.log(`✅ Loaded save file: ${savePath} (${testSaveFile.byteLength} bytes)\n`)

    // Parse with file parser
    console.log('🗂️  Parsing with file parser...')
    const config = new VanillaConfig()
    const fileParser = new PokemonSaveParser(undefined, config)
    const fileSaveData = await fileParser.parseSaveFile(testSaveFile)
    console.log('✅ File parsing complete\n')

    // Connect to mGBA
    console.log('🌐 Connecting to mGBA WebSocket server...')
    const mgbaClient = new MgbaWebSocketClient()
    const memoryParser = new EmeraldMemoryParser(mgbaClient)

    await mgbaClient.connect()
    console.log('✅ Connected to mGBA\n')

    // Wait for save state to load
    console.log('⏳ Waiting for save state to load...')
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Test basic memory access
    console.log('🧪 Testing basic memory access...')
    const testValue = await mgbaClient.readByte(0x02000000)
    console.log(`✅ Read test byte from EWRAM: 0x${testValue.toString(16)}\n`)

    // Parse from memory
    console.log('🧠 Parsing save data from memory...')
    const memorySaveData = await memoryParser.parseFromMemory()
    console.log('✅ Memory parsing complete\n')

    // Compare results
    console.log('📊 COMPARISON RESULTS')
    console.log('=====================================')
    
    console.log('\n🎮 Player Information:')
    console.log(`  Name:      File="${fileSaveData.player_name}" | Memory="${memorySaveData.player_name}" | ${fileSaveData.player_name === memorySaveData.player_name ? '✅' : '❌'}`)
    console.log(`  Play Time: File=${fileSaveData.play_time.hours}h ${fileSaveData.play_time.minutes}m ${fileSaveData.play_time.seconds}s | Memory=${memorySaveData.play_time.hours}h ${memorySaveData.play_time.minutes}m ${memorySaveData.play_time.seconds}s | ${fileSaveData.play_time.hours === memorySaveData.play_time.hours && fileSaveData.play_time.minutes === memorySaveData.play_time.minutes && fileSaveData.play_time.seconds === memorySaveData.play_time.seconds ? '✅' : '❌'}`)

    console.log('\n🐾 Party Pokémon:')
    console.log(`  Count: File=${fileSaveData.party_pokemon.length} | Memory=${memorySaveData.party_pokemon.length} | ${fileSaveData.party_pokemon.length === memorySaveData.party_pokemon.length ? '✅' : '❌'}`)

    const maxPokemon = Math.min(fileSaveData.party_pokemon.length, memorySaveData.party_pokemon.length)
    for (let i = 0; i < maxPokemon; i++) {
      const filePokemon = fileSaveData.party_pokemon[i]!
      const memoryPokemon = memorySaveData.party_pokemon[i]!

      console.log(`\n  Pokemon ${i + 1}:`)
      console.log(`    Species:    File=${filePokemon.speciesId} | Memory=${memoryPokemon.speciesId} | ${filePokemon.speciesId === memoryPokemon.speciesId ? '✅' : '❌'}`)
      console.log(`    Nickname:   File="${filePokemon.nickname}" | Memory="${memoryPokemon.nickname}" | ${filePokemon.nickname === memoryPokemon.nickname ? '✅' : '❌'}`)
      console.log(`    Level:      File=${filePokemon.level} | Memory=${memoryPokemon.level} | ${filePokemon.level === memoryPokemon.level ? '✅' : '❌'}`)
      console.log(`    HP:         File=${filePokemon.currentHp}/${filePokemon.maxHp} | Memory=${memoryPokemon.currentHp}/${memoryPokemon.maxHp} | ${filePokemon.currentHp === memoryPokemon.currentHp && filePokemon.maxHp === memoryPokemon.maxHp ? '✅' : '❌'}`)
      console.log(`    Attack:     File=${filePokemon.attack} | Memory=${memoryPokemon.attack} | ${filePokemon.attack === memoryPokemon.attack ? '✅' : '❌'}`)
      console.log(`    Defense:    File=${filePokemon.defense} | Memory=${memoryPokemon.defense} | ${filePokemon.defense === memoryPokemon.defense ? '✅' : '❌'}`)
      console.log(`    Speed:      File=${filePokemon.speed} | Memory=${memoryPokemon.speed} | ${filePokemon.speed === memoryPokemon.speed ? '✅' : '❌'}`)
      console.log(`    Sp.Attack:  File=${filePokemon.spAttack} | Memory=${memoryPokemon.spAttack} | ${filePokemon.spAttack === memoryPokemon.spAttack ? '✅' : '❌'}`)
      console.log(`    Sp.Defense: File=${filePokemon.spDefense} | Memory=${memoryPokemon.spDefense} | ${filePokemon.spDefense === memoryPokemon.spDefense ? '✅' : '❌'}`)
      console.log(`    Move 1:     File=${filePokemon.move1} (PP:${filePokemon.pp1}) | Memory=${memoryPokemon.move1} (PP:${memoryPokemon.pp1}) | ${filePokemon.move1 === memoryPokemon.move1 && filePokemon.pp1 === memoryPokemon.pp1 ? '✅' : '❌'}`)
      console.log(`    Move 2:     File=${filePokemon.move2} (PP:${filePokemon.pp2}) | Memory=${memoryPokemon.move2} (PP:${memoryPokemon.pp2}) | ${filePokemon.move2 === memoryPokemon.move2 && filePokemon.pp2 === memoryPokemon.pp2 ? '✅' : '❌'}`)
      console.log(`    OT Name:    File="${filePokemon.otName}" | Memory="${memoryPokemon.otName}" | ${filePokemon.otName === memoryPokemon.otName ? '✅' : '❌'}`)
      console.log(`    OT ID:      File=${filePokemon.otId_str} | Memory=${memoryPokemon.otId_str} | ${filePokemon.otId_str === memoryPokemon.otId_str ? '✅' : '❌'}`)
      console.log(`    Nature:     File=${filePokemon.nature} | Memory=${memoryPokemon.nature} | ${filePokemon.nature === memoryPokemon.nature ? '✅' : '❌'}`)
    }

    // Calculate accuracy
    let totalChecks = 0
    let passedChecks = 0

    // Basic checks
    totalChecks += 4 // player name, play time hours, play time minutes, play time seconds
    if (fileSaveData.player_name === memorySaveData.player_name) passedChecks++
    if (fileSaveData.play_time.hours === memorySaveData.play_time.hours) passedChecks++
    if (fileSaveData.play_time.minutes === memorySaveData.play_time.minutes) passedChecks++
    if (fileSaveData.play_time.seconds === memorySaveData.play_time.seconds) passedChecks++

    // Pokemon checks
    for (let i = 0; i < maxPokemon; i++) {
      const filePokemon = fileSaveData.party_pokemon[i]!
      const memoryPokemon = memorySaveData.party_pokemon[i]!

      const checks = [
        filePokemon.speciesId === memoryPokemon.speciesId,
        filePokemon.nickname === memoryPokemon.nickname,
        filePokemon.level === memoryPokemon.level,
        filePokemon.currentHp === memoryPokemon.currentHp,
        filePokemon.maxHp === memoryPokemon.maxHp,
        filePokemon.attack === memoryPokemon.attack,
        filePokemon.defense === memoryPokemon.defense,
        filePokemon.speed === memoryPokemon.speed,
        filePokemon.spAttack === memoryPokemon.spAttack,
        filePokemon.spDefense === memoryPokemon.spDefense,
        filePokemon.move1 === memoryPokemon.move1,
        filePokemon.move2 === memoryPokemon.move2,
        filePokemon.pp1 === memoryPokemon.pp1,
        filePokemon.pp2 === memoryPokemon.pp2,
        filePokemon.otName === memoryPokemon.otName,
        filePokemon.otId_str === memoryPokemon.otId_str,
        filePokemon.nature === memoryPokemon.nature
      ]

      totalChecks += checks.length
      passedChecks += checks.filter(Boolean).length
    }

    console.log('\n📈 ACCURACY SUMMARY')
    console.log('=====================================')
    console.log(`Total checks: ${totalChecks}`)
    console.log(`Passed: ${passedChecks}`)
    console.log(`Failed: ${totalChecks - passedChecks}`)
    console.log(`Accuracy: ${((passedChecks / totalChecks) * 100).toFixed(1)}%`)

    if (passedChecks === totalChecks) {
      console.log('\n🎉 Perfect match! Memory parser is working correctly.')
    } else {
      console.log('\n⚠️  Some mismatches found. Memory mapping may need adjustment.')
    }

    mgbaClient.disconnect()

  } catch (error) {
    console.error('\n❌ Error:', error)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { main }