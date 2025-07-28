#!/usr/bin/env tsx
/**
 * Quick test of Quetzal memory address stability using two savestates
 * This directly copies savestates and tests the same memory addresses
 */

import { copyFileSync, renameSync, existsSync } from 'node:fs'
import { MgbaWebSocketClient } from '../src/lib/mgba/websocket-client.js'
import { QuetzalConfig } from '../src/lib/parser/games/quetzal/config.js'

interface TestResult {
  savestate: string
  gameTitle: string
  partyCount: number
  playTime: { hours: number, minutes: number, seconds: number }
  pokemon: Array<{
    species: string | undefined
    level: number
    currentHp: number
    maxHp: number
  }>
  addressesWork: boolean
}

async function testMemoryAddresses(savestateName: string): Promise<TestResult | null> {
  const client = new MgbaWebSocketClient('ws://localhost:7102/ws')
  const config = new QuetzalConfig()
  
  try {
    console.log(`🔗 Testing ${savestateName}...`)
    await client.connect()
    
    const gameTitle = await client.getGameTitle()
    console.log(`🎮 Game: ${gameTitle}`)
    
    // Test the current configured addresses
    const addresses = config.memoryAddresses
    
    const partyCount = await client.readByte(addresses.partyCount)
    console.log(`👥 Party count: ${partyCount}`)
    
    // Test play time
    const playTimeData = await client.readBytes(addresses.playTime, 8)
    const playTimeView = new DataView(playTimeData.buffer)
    const playTime = {
      hours: playTimeView.getUint16(0, true),
      minutes: playTimeView.getUint8(4),
      seconds: playTimeView.getUint8(5)
    }
    console.log(`⏰ Play time: ${playTime.hours}h ${playTime.minutes}m ${playTime.seconds}s`)
    
    // Test Pokemon data
    const pokemon: Array<{species: string | undefined, level: number, currentHp: number, maxHp: number}> = []
    
    if (partyCount >= 1 && partyCount <= 6) {
      const pokemonData = await client.readBytes(addresses.partyData, partyCount * 104)
      
      for (let i = 0; i < partyCount; i++) {
        const offset = i * 104
        const pokeData = pokemonData.slice(offset, offset + 104)
        const view = new DataView(pokeData.buffer)
        
        const species = config.getPokemonName(pokeData, view)
        const level = view.getUint8(0x58)
        const currentHp = view.getUint16(0x23, true)
        const maxHp = view.getUint16(0x5A, true)
        
        pokemon.push({ species, level, currentHp, maxHp })
        console.log(`   ${i + 1}. ${species || 'Unknown'} Lv.${level} HP:${currentHp}/${maxHp}`)
      }
    }
    
    // Check if addresses work (reasonable values)
    const addressesWork = partyCount >= 1 && partyCount <= 6 &&
                         playTime.hours >= 0 && playTime.hours < 1000 &&
                         playTime.minutes >= 0 && playTime.minutes < 60 &&
                         playTime.seconds >= 0 && playTime.seconds < 60 &&
                         pokemon.length > 0 &&
                         pokemon.every(p => p.level >= 1 && p.level <= 100 && p.currentHp >= 0 && p.maxHp > 0)
    
    console.log(`✅ Addresses work: ${addressesWork}`)
    
    return {
      savestate: savestateName,
      gameTitle,
      partyCount,
      playTime,
      pokemon,
      addressesWork
    }
    
  } catch (error) {
    console.error(`❌ Error testing ${savestateName}: ${error}`)
    return null
  } finally {
    client.disconnect()
  }
}

async function testMemoryStability(): Promise<void> {
  console.log('🧪 Testing Quetzal Memory Address Stability')
  console.log('='.repeat(50))
  
  const testDataDir = '/home/runner/work/pokemon-save-web/pokemon-save-web/src/lib/parser/__tests__/test_data'
  const quetzal1Path = `${testDataDir}/quetzal.ss0`
  const quetzal2Path = `${testDataDir}/quetzal2.ss0`
  const backupPath = `${testDataDir}/quetzal_backup.ss0`
  
  // Verify files exist
  if (!existsSync(quetzal1Path)) {
    console.error('❌ quetzal.ss0 not found')
    process.exit(1)
  }
  if (!existsSync(quetzal2Path)) {
    console.error('❌ quetzal2.ss0 not found')
    process.exit(1)
  }
  
  console.log('📋 Step 1: Test with original quetzal.ss0')
  console.log('💡 Current mgba should be running with quetzal.ss0')
  
  const result1 = await testMemoryAddresses('quetzal.ss0 (original)')
  if (!result1) {
    console.error('❌ Failed to test original savestate')
    process.exit(1)
  }
  
  console.log('\n📋 Step 2: Switch to quetzal2.ss0')
  console.log('🔄 Backing up original and switching savestates...')
  
  // Stop mgba
  console.log('🛑 Stopping mgba...')
  const { execSync } = await import('node:child_process')
  execSync('npm run mgba -- stop', { stdio: 'inherit', cwd: '/home/runner/work/pokemon-save-web/pokemon-save-web' })
  
  // Backup and switch
  renameSync(quetzal1Path, backupPath)
  copyFileSync(quetzal2Path, quetzal1Path)
  console.log('✅ Switched to quetzal2.ss0')
  
  // Start mgba again
  console.log('🚀 Starting mgba with quetzal2.ss0...')
  execSync('npm run mgba -- start --game quetzal', { stdio: 'inherit', cwd: '/home/runner/work/pokemon-save-web/pokemon-save-web' })
  
  // Wait for startup
  console.log('⏳ Waiting for mgba to start...')
  await new Promise(resolve => setTimeout(resolve, 15000))
  
  // Test for server readiness
  for (let i = 0; i < 10; i++) {
    try {
      const { execSync } = await import('node:child_process')
      execSync('curl -f http://localhost:7102/', { stdio: 'pipe' })
      break
    } catch (e) {
      if (i === 9) {
        console.error('❌ mgba server not ready after 10 attempts')
        process.exit(1)
      }
      console.log(`⏳ Waiting for server... (${i + 1}/10)`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  
  console.log('\n📋 Step 3: Test with quetzal2.ss0')
  const result2 = await testMemoryAddresses('quetzal2.ss0')
  if (!result2) {
    console.error('❌ Failed to test second savestate')
    process.exit(1)
  }
  
  console.log('\n📋 Step 4: Restore original savestate')
  console.log('🛑 Stopping mgba...')
  execSync('npm run mgba -- stop', { stdio: 'inherit', cwd: '/home/runner/work/pokemon-save-web/pokemon-save-web' })
  
  // Restore original
  renameSync(quetzal1Path, `${testDataDir}/quetzal2_test.ss0`) // Keep the test copy
  renameSync(backupPath, quetzal1Path)
  console.log('✅ Restored original quetzal.ss0')
  
  // Compare results
  console.log('\n' + '='.repeat(50))
  console.log('📊 COMPARISON RESULTS')
  console.log('='.repeat(50))
  
  console.log(`🎮 Game Titles:`)
  console.log(`   ${result1.savestate}: ${result1.gameTitle}`)
  console.log(`   ${result2.savestate}: ${result2.gameTitle}`)
  
  console.log(`\n👥 Party Counts:`)
  console.log(`   ${result1.savestate}: ${result1.partyCount}`)
  console.log(`   ${result2.savestate}: ${result2.partyCount}`)
  
  console.log(`\n⏰ Play Times:`)
  console.log(`   ${result1.savestate}: ${result1.playTime.hours}h ${result1.playTime.minutes}m ${result1.playTime.seconds}s`)
  console.log(`   ${result2.savestate}: ${result2.playTime.hours}h ${result2.playTime.minutes}m ${result2.playTime.seconds}s`)
  
  console.log(`\n🎯 Address Functionality:`)
  console.log(`   ${result1.savestate}: ${result1.addressesWork ? '✅ WORKING' : '❌ BROKEN'}`)
  console.log(`   ${result2.savestate}: ${result2.addressesWork ? '✅ WORKING' : '❌ BROKEN'}`)
  
  console.log(`\n👾 Pokemon Teams:`)
  console.log(`   ${result1.savestate}:`)
  result1.pokemon.forEach((p, i) => {
    console.log(`     ${i + 1}. ${p.species || 'Unknown'} Lv.${p.level}`)
  })
  console.log(`   ${result2.savestate}:`)
  result2.pokemon.forEach((p, i) => {
    console.log(`     ${i + 1}. ${p.species || 'Unknown'} Lv.${p.level}`)
  })
  
  // Final assessment
  console.log('\n🎯 FINAL ASSESSMENT:')
  if (result1.addressesWork && result2.addressesWork) {
    console.log('✅ SUCCESS: Memory addresses are STABLE across savestates!')
    console.log('   The current QuetzalConfig memory addresses work reliably')
    console.log('   Both savestates show valid Pokemon data at the same addresses')
    
    // Show the team in quetzal2.ss0 that we discovered
    console.log('\n📋 DISCOVERED: quetzal2.ss0 contains a different team:')
    result2.pokemon.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.species || 'Unknown'} Lv.${p.level} HP:${p.currentHp}/${p.maxHp}`)
    })
    console.log(`   Play time: ${result2.playTime.hours}h ${result2.playTime.minutes}m ${result2.playTime.seconds}s`)
    
  } else {
    console.log('❌ FAILURE: Memory addresses are VOLATILE or INCORRECT!')
    console.log('   The addresses do not work consistently across savestates')
    console.log('   Memory locations may be dynamically allocated or unstable')
    
    console.log('\n🔧 Recommended Actions:')
    console.log('   1. Implement dynamic address discovery')
    console.log('   2. Use patterns to locate Pokemon data in real-time')
    console.log('   3. Consider using save file offsets as reference points')
  }
  
  console.log('\n✅ Test complete! Original savestate restored.')
}

// Handle command line usage
if (import.meta.url === `file://${process.argv[1]}`) {
  testMemoryStability().catch(console.error)
}

export { testMemoryStability }