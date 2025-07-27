#!/usr/bin/env node

/**
 * Analyze the test save file to understand what should be in memory
 */

import { readFileSync } from 'fs'
import { PokemonSaveParser } from '../parser/core/PokemonSaveParser.js'
import { VanillaConfig } from '../parser/games/vanilla/config.js'

async function analyzeSaveFile() {
  console.log('📊 Analyzing test save file...')
  
  const savePath = './src/lib/parser/__tests__/test_data/emerald.sav'
  const saveBuffer = readFileSync(savePath)
  const testSaveFile = saveBuffer.buffer.slice(saveBuffer.byteOffset, saveBuffer.byteOffset + saveBuffer.byteLength)

  const config = new VanillaConfig()
  const fileParser = new PokemonSaveParser(undefined, config)

  const saveData = await fileParser.parseSaveFile(testSaveFile)

  console.log('Player name:', saveData.player_name)
  console.log('Play time:', saveData.play_time)
  console.log('Party Pokemon count:', saveData.party_pokemon.length)

  if (saveData.party_pokemon.length > 0) {
    const pokemon = saveData.party_pokemon[0]
    console.log('First Pokemon:')
    console.log('  Species ID:', pokemon.speciesId)
    console.log('  Level:', pokemon.level)
    console.log('  Nickname:', pokemon.nickname)
    console.log('  Personality:', '0x' + pokemon.personality.toString(16))
    console.log('  OT ID:', '0x' + pokemon.otId.toString(16))
    console.log('  Current HP:', pokemon.currentHp)
    console.log('  Max HP:', pokemon.maxHp)
  }
  
  // Look at raw save file data
  console.log('\nRaw save file analysis:')
  console.log('Save file size:', testSaveFile.byteLength)
  
  // Check both save slots
  const view = new DataView(testSaveFile)
  
  console.log('\nSave slot 1 (0x0000):')
  for (let i = 0; i < 16; i++) {
    process.stdout.write(`0x${view.getUint8(i).toString(16).padStart(2, '0')} `)
  }
  console.log()
  
  console.log('Save slot 2 (0x8000):')
  for (let i = 0; i < 16; i++) {
    process.stdout.write(`0x${view.getUint8(0x8000 + i).toString(16).padStart(2, '0')} `)
  }
  console.log()
  
  console.log('Save slot 3 (0x17000):')
  for (let i = 0; i < 16; i++) {
    process.stdout.write(`0x${view.getUint8(0x17000 + i).toString(16).padStart(2, '0')} `)
  }
  console.log()
  
  // Search for player name in raw data
  console.log('\nSearching for player name "EMERALD" in raw save data...')
  const emeraldBytes = [0xBE, 0xC6, 0xBE, 0xCB, 0xBB, 0xC5, 0xBD] // EMERALD in Pokemon encoding
  
  for (let offset = 0; offset < testSaveFile.byteLength - 7; offset++) {
    let matches = 0
    for (let i = 0; i < emeraldBytes.length; i++) {
      if (view.getUint8(offset + i) === emeraldBytes[i]) {
        matches++
      } else {
        break
      }
    }
    
    if (matches === emeraldBytes.length) {
      console.log(`Found "EMERALD" at offset 0x${offset.toString(16)}`)
    }
  }
}

analyzeSaveFile().catch(console.error)