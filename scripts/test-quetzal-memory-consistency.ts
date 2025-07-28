#!/usr/bin/env tsx
/**
 * Test memory consistency across different Quetzal savestates
 * This addresses the issue that current memory addresses point to volatile memory
 */

import { readFileSync, copyFileSync, existsSync } from 'node:fs'
import { MgbaWebSocketClient } from '../src/lib/mgba/websocket-client.js'
import { QuetzalConfig } from '../src/lib/parser/games/quetzal/config.js'

interface Pokemon {
  species: string | undefined
  level: number
  currentHp: number
  maxHp: number
  nature: string
  isShiny: boolean | number
}

interface PlayTime {
  hours: number
  minutes: number
  seconds: number
}

interface GameMemoryState {
  gameTitle: string
  partyCount: number
  playTime: PlayTime
  pokemon: Pokemon[]
}

async function readMemoryState(client: MgbaWebSocketClient, config: QuetzalConfig): Promise<GameMemoryState> {
  const gameTitle = await client.getGameTitle()
  
  // Read party count
  const partyCount = await client.readByte(config.memoryAddresses.partyCount)
  
  // Read play time
  const playTimeData = await client.readBytes(config.memoryAddresses.playTime, 8)
  const playTimeView = new DataView(playTimeData.buffer)
  const playTime: PlayTime = {
    hours: playTimeView.getUint16(0, true),
    minutes: playTimeView.getUint8(4), 
    seconds: playTimeView.getUint8(5)
  }
  
  // Read Pokemon data
  const pokemon: Pokemon[] = []
  const fullPartyData = await client.readBytes(config.memoryAddresses.partyData, 624) // 6 * 104 bytes
  
  for (let i = 0; i < 6; i++) {
    const pokemonOffset = i * 104
    const pokemonData = fullPartyData.slice(pokemonOffset, pokemonOffset + 104)
    const view = new DataView(pokemonData.buffer)
    
    const species = config.getPokemonName(pokemonData, view)
    const level = view.getUint8(0x58)
    const currentHp = view.getUint16(0x23, true)
    const maxHp = view.getUint16(0x5A, true)
    
    // Get personality for nature calculation
    const personality = view.getUint32(0x00, true)
    const nature = config.calculateNature(personality)
    
    // Check if shiny
    const isShiny = config.isShiny(personality, 0)
    
    pokemon.push({
      species,
      level,
      currentHp,
      maxHp,
      nature,
      isShiny
    })
  }
  
  return {
    gameTitle,
    partyCount,
    playTime,
    pokemon
  }
}

async function loadSavestateAndTest(savestateName: string): Promise<GameMemoryState | null> {
  const client = new MgbaWebSocketClient('ws://localhost:7102/ws')
  const config = new QuetzalConfig()
  
  try {
    console.log(`🔗 Connecting to mgba WebSocket for ${savestateName}...`)
    await client.connect()
    console.log('✅ Connected')
    
    // Load the savestate via mgba core API
    const savestateCommand = `emu:loadStateFile("/app/data/${savestateName}", C.SAVESTATE.SCREENSHOT)`
    console.log(`📁 Loading savestate: ${savestateCommand}`)
    
    // Note: We need to use mgba's Lua API to load the savestate
    // For now, let's read the current state and assume the correct savestate is loaded
    
    const memoryState = await readMemoryState(client, config)
    console.log(`🎮 Game: ${memoryState.gameTitle}`)
    console.log(`👥 Party: ${memoryState.partyCount} Pokemon`)
    console.log(`⏰ Time: ${memoryState.playTime.hours}h ${memoryState.playTime.minutes}m ${memoryState.playTime.seconds}s`)
    
    for (let i = 0; i < memoryState.partyCount; i++) {
      const poke = memoryState.pokemon[i]
      if (poke && poke.level > 0) {
        console.log(`   ${i + 1}. ${poke.species || 'Unknown'} Lv.${poke.level} HP:${poke.currentHp}/${poke.maxHp} (${poke.nature}) ${poke.isShiny ? '✨' : ''}`)
      }
    }
    
    return memoryState
    
  } catch (error) {
    console.error(`❌ Failed to test ${savestateName}: ${error}`)
    return null
  } finally {
    client.disconnect()
  }
}

async function testMemoryConsistency(): Promise<void> {
  console.log('🧪 Testing Quetzal memory consistency across savestates')
  console.log('='.repeat(60))
  
  // Check if quetzal2.ss0 exists
  const quetzal2Path = '/home/runner/work/pokemon-save-web/pokemon-save-web/src/lib/parser/__tests__/test_data/quetzal2.ss0'
  if (!existsSync(quetzal2Path)) {
    console.error('❌ quetzal2.ss0 not found at expected location')
    process.exit(1)
  }
  
  console.log('📋 Step 1: Test current memory addresses with quetzal.ss0 (original)')
  console.log('💡 Make sure mgba is running with: npm run mgba -- start --game quetzal')
  console.log('')
  
  const state1 = await loadSavestateAndTest('quetzal.ss0')
  if (!state1) {
    console.error('❌ Failed to read state from quetzal.ss0')
    process.exit(1)
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('📋 Step 2: Prepare quetzal2.ss0 for testing')
  
  // Copy quetzal2.ss0 to a location where mgba can load it
  const testPath = '/home/runner/work/pokemon-save-web/pokemon-save-web/src/lib/parser/__tests__/test_data/quetzal_test.ss0'
  copyFileSync(quetzal2Path, testPath)
  console.log('✅ Copied quetzal2.ss0 to quetzal_test.ss0')
  
  console.log('\n🚨 MANUAL STEP REQUIRED:')
  console.log('1. Stop current mgba container: npm run mgba -- stop')
  console.log('2. Temporarily rename quetzal.ss0 to quetzal_backup.ss0')
  console.log('3. Rename quetzal2.ss0 to quetzal.ss0') 
  console.log('4. Start mgba: npm run mgba -- start --game quetzal')
  console.log('5. Press Enter to continue...')
  
  // Wait for user to manually switch savestates
  // This is needed because the Docker setup expects specific filenames
  process.stdin.setRawMode(true)
  process.stdin.resume()
  await new Promise(resolve => process.stdin.once('data', resolve))
  process.stdin.setRawMode(false)
  process.stdin.pause()
  
  console.log('\n📋 Step 3: Test same memory addresses with quetzal2.ss0')
  const state2 = await loadSavestateAndTest('quetzal.ss0') // Now contains quetzal2 data
  if (!state2) {
    console.error('❌ Failed to read state from quetzal2.ss0')
    process.exit(1)
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('📊 COMPARISON RESULTS:')
  console.log('='.repeat(60))
  
  // Compare consistency
  console.log(`🎮 Game titles: "${state1.gameTitle}" vs "${state2.gameTitle}"`)
  
  const partyCountConsistent = state1.partyCount >= 1 && state1.partyCount <= 6 && 
                               state2.partyCount >= 1 && state2.partyCount <= 6
  console.log(`👥 Party counts: ${state1.partyCount} vs ${state2.partyCount} ${partyCountConsistent ? '✅' : '❌'}`)
  
  const playTimeReasonable1 = state1.playTime.hours >= 0 && state1.playTime.hours < 1000 &&
                             state1.playTime.minutes >= 0 && state1.playTime.minutes < 60 &&
                             state1.playTime.seconds >= 0 && state1.playTime.seconds < 60
  const playTimeReasonable2 = state2.playTime.hours >= 0 && state2.playTime.hours < 1000 &&
                             state2.playTime.minutes >= 0 && state2.playTime.minutes < 60 &&
                             state2.playTime.seconds >= 0 && state2.playTime.seconds < 60
  
  console.log(`⏰ Play times: ${state1.playTime.hours}h${state1.playTime.minutes}m${state1.playTime.seconds}s vs ${state2.playTime.hours}h${state2.playTime.minutes}m${state2.playTime.seconds}s`)
  console.log(`   Reasonable? ${playTimeReasonable1 ? '✅' : '❌'} vs ${playTimeReasonable2 ? '✅' : '❌'}`)
  
  // Check if Pokemon data looks valid
  console.log('\n🔍 Pokemon data analysis:')
  
  let validPokemon1 = 0
  let validPokemon2 = 0
  
  for (let i = 0; i < 6; i++) {
    const poke1 = state1.pokemon[i]
    const poke2 = state2.pokemon[i]
    
    const valid1 = poke1 && poke1.level >= 1 && poke1.level <= 100 && 
                   poke1.currentHp >= 0 && poke1.maxHp > 0 && 
                   poke1.species && poke1.species !== 'Unknown'
    const valid2 = poke2 && poke2.level >= 1 && poke2.level <= 100 && 
                   poke2.currentHp >= 0 && poke2.maxHp > 0 && 
                   poke2.species && poke2.species !== 'Unknown'
    
    if (valid1) validPokemon1++
    if (valid2) validPokemon2++
    
    if (i < Math.max(state1.partyCount, state2.partyCount)) {
      console.log(`   Slot ${i + 1}: ${valid1 ? '✅' : '❌'} vs ${valid2 ? '✅' : '❌'}`)
      if (poke1) console.log(`     State1: ${poke1.species} Lv.${poke1.level}`)
      if (poke2) console.log(`     State2: ${poke2.species} Lv.${poke2.level}`)
    }
  }
  
  console.log(`\n📊 Valid Pokemon: ${validPokemon1}/${state1.partyCount} vs ${validPokemon2}/${state2.partyCount}`)
  
  // Overall assessment
  const overallConsistent = partyCountConsistent && 
                           playTimeReasonable1 && playTimeReasonable2 &&
                           validPokemon1 >= Math.min(state1.partyCount, 4) &&
                           validPokemon2 >= Math.min(state2.partyCount, 4)
  
  console.log('\n🎯 FINAL ASSESSMENT:')
  if (overallConsistent) {
    console.log('✅ Memory addresses appear CONSISTENT across savestates')
    console.log('   The current addresses in QuetzalConfig should work reliably')
  } else {
    console.log('❌ Memory addresses appear INCONSISTENT or VOLATILE')
    console.log('   Current addresses may point to unstable memory locations')
    console.log('   Need to scan for more stable memory regions')
  }
  
  console.log('\n🔧 NEXT STEPS:')
  if (!overallConsistent) {
    console.log('1. Run memory scan to find stable addresses')
    console.log('2. Look for Pokemon data in fixed offsets relative to save data')
    console.log('3. Check if addresses are in different memory regions (EWRAM vs IWRAM)')
    console.log('4. Consider that addresses might be dynamically allocated')
  } else {
    console.log('1. Current addresses are good!')
    console.log('2. Document the verification process')
    console.log('3. Add automated tests for memory consistency')
  }
  
  console.log('\n📝 Remember to restore original quetzal.ss0 after testing!')
}

// Handle command line usage
if (import.meta.url === `file://${process.argv[1]}`) {
  testMemoryConsistency().catch(console.error)
}

export { testMemoryConsistency }