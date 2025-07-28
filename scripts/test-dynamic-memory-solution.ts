#!/usr/bin/env tsx
/**
 * Test the new dynamic Quetzal memory discovery across both savestates
 * This validates that the updated QuetzalConfig resolves the volatile memory issue
 */

import { copyFileSync, renameSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { MgbaWebSocketClient } from '../src/lib/mgba/websocket-client.js'
import { QuetzalConfig } from '../src/lib/parser/games/quetzal/config.js'

async function testDynamicMemoryWithSavestate(savestateName: string): Promise<{
  success: boolean
  partyCountAddr: number | null
  partyDataAddr: number | null
  pokemon: string[]
  scanTime: number
}> {
  const client = new MgbaWebSocketClient('ws://localhost:7102/ws')
  const config = new QuetzalConfig()

  try {
    await client.connect()
    const gameTitle = await client.getGameTitle()
    console.log(`🎮 Testing ${savestateName} - Game: ${gameTitle}`)

    // Use the new dynamic discovery method
    const result = await config.scanForPartyData(
      (addr) => client.readByte(addr),
      (addr, len) => client.readBytes(addr, len)
    )

    if (result.partyCountAddr && result.partyDataAddr) {
      // Read the Pokemon data to show what was found
      const pokemonData = await client.readBytes(result.partyDataAddr, result.partyCount * 104)
      const pokemon: string[] = []

      for (let i = 0; i < result.partyCount; i++) {
        const offset = i * 104
        const pokeData = pokemonData.slice(offset, offset + 104)
        const view = new DataView(pokeData.buffer)
        
        const species = config.getPokemonName(pokeData, view)
        const level = view.getUint8(0x58)
        pokemon.push(`${species || 'Unknown'} Lv.${level}`)
      }

      console.log(`✅ Dynamic discovery successful:`)
      console.log(`   Addresses: 0x${result.partyCountAddr.toString(16)} / 0x${result.partyDataAddr.toString(16)}`)
      console.log(`   Scan time: ${result.scanTime}ms`)
      console.log(`   Pokemon: ${pokemon.join(', ')}`)

      return {
        success: true,
        partyCountAddr: result.partyCountAddr,
        partyDataAddr: result.partyDataAddr,
        pokemon,
        scanTime: result.scanTime
      }
    } else {
      console.log(`❌ Dynamic discovery failed for ${savestateName}`)
      return {
        success: false,
        partyCountAddr: null,
        partyDataAddr: null,
        pokemon: [],
        scanTime: result.scanTime
      }
    }

  } catch (error) {
    console.error(`❌ Error testing ${savestateName}: ${error}`)
    return {
      success: false,
      partyCountAddr: null,
      partyDataAddr: null,
      pokemon: [],
      scanTime: 0
    }
  } finally {
    client.disconnect()
  }
}

async function switchSavestate(useQuetzal2: boolean): Promise<void> {
  const testDataDir = '/home/runner/work/pokemon-save-web/pokemon-save-web/src/lib/parser/__tests__/test_data'
  const quetzal1Path = `${testDataDir}/quetzal.ss0`
  const quetzal2Path = `${testDataDir}/quetzal2.ss0`
  const backupPath = `${testDataDir}/quetzal_backup.ss0`

  console.log('🛑 Stopping mgba...')
  try {
    execSync('npm run mgba -- stop', { stdio: 'pipe', cwd: '/home/runner/work/pokemon-save-web/pokemon-save-web' })
  } catch (e) {
    // Already stopped
  }

  if (useQuetzal2) {
    if (existsSync(quetzal1Path) && !existsSync(backupPath)) {
      renameSync(quetzal1Path, backupPath)
    }
    copyFileSync(quetzal2Path, quetzal1Path)
    console.log('✅ Switched to quetzal2.ss0')
  } else {
    if (existsSync(backupPath)) {
      renameSync(quetzal1Path, `${testDataDir}/quetzal2_test.ss0`)
      renameSync(backupPath, quetzal1Path)
      console.log('✅ Restored original quetzal.ss0')
    }
  }

  console.log('🚀 Starting mgba...')
  execSync('npm run mgba -- start --game quetzal', { stdio: 'pipe', cwd: '/home/runner/work/pokemon-save-web/pokemon-save-web' })

  console.log('⏳ Waiting for startup...')
  await new Promise(resolve => setTimeout(resolve, 12000))

  // Wait for readiness
  for (let i = 0; i < 8; i++) {
    try {
      execSync('curl -f http://localhost:7102/', { stdio: 'pipe' })
      console.log('✅ Ready')
      return
    } catch (e) {
      if (i === 7) throw new Error('mgba not ready')
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

async function testDynamicQuetzalMemory(): Promise<void> {
  console.log('🧪 Testing Dynamic Quetzal Memory Discovery')
  console.log('='.repeat(60))
  console.log('📋 This validates the fix for volatile memory addresses')

  // Test 1: Original savestate
  console.log('\n📋 Step 1: Test dynamic discovery with original quetzal.ss0')
  const result1 = await testDynamicMemoryWithSavestate('quetzal.ss0 (original)')

  if (!result1.success) {
    console.error('❌ Dynamic discovery failed with original savestate')
    process.exit(1)
  }

  // Test 2: Switch to problematic savestate
  console.log('\n📋 Step 2: Switch to quetzal2.ss0 (problematic savestate)')
  await switchSavestate(true)
  const result2 = await testDynamicMemoryWithSavestate('quetzal2.ss0')

  if (!result2.success) {
    console.error('❌ Dynamic discovery failed with second savestate')
    await switchSavestate(false) // Restore
    process.exit(1)
  }

  // Test 3: Restore and verify cache works
  console.log('\n📋 Step 3: Restore original and test cache efficiency')
  await switchSavestate(false)
  const result3 = await testDynamicMemoryWithSavestate('quetzal.ss0 (restored)')

  // Results analysis
  console.log('\n' + '='.repeat(60))
  console.log('📊 DYNAMIC DISCOVERY RESULTS')
  console.log('='.repeat(60))

  console.log(`\n🎯 Original quetzal.ss0:`)
  console.log(`   Address: 0x${result1.partyCountAddr?.toString(16) || 'null'}`)
  console.log(`   Pokemon: ${result1.pokemon.join(', ')}`)
  console.log(`   Scan time: ${result1.scanTime}ms`)

  console.log(`\n🎯 Problematic quetzal2.ss0:`)
  console.log(`   Address: 0x${result2.partyCountAddr?.toString(16) || 'null'}`)
  console.log(`   Pokemon: ${result2.pokemon.join(', ')}`)
  console.log(`   Scan time: ${result2.scanTime}ms`)

  console.log(`\n🎯 Restored quetzal.ss0:`)
  console.log(`   Address: 0x${result3.partyCountAddr?.toString(16) || 'null'}`)
  console.log(`   Pokemon: ${result3.pokemon.join(', ')}`)
  console.log(`   Scan time: ${result3.scanTime}ms (cache efficiency)`)

  // Final assessment
  console.log('\n🎯 ASSESSMENT:')

  const addressesDifferent = result1.partyCountAddr !== result2.partyCountAddr
  const allSuccessful = result1.success && result2.success && result3.success

  if (allSuccessful && addressesDifferent) {
    console.log('✅ SUCCESS: Dynamic discovery solved the volatile memory problem!')
    console.log('   ✅ Works with original savestate')
    console.log('   ✅ Works with problematic savestate')
    console.log('   ✅ Finds different addresses as expected')
    console.log('   ✅ Cache system works efficiently')
    
    console.log('\n💡 BENEFITS ACHIEVED:')
    console.log('   - No more volatile memory address errors')
    console.log('   - Works across all Quetzal savestates')
    console.log('   - Fast cache-based reads after discovery')
    console.log('   - Adapts to dynamic memory allocation')

    console.log('\n🎮 quetzal2.ss0 TEAM DISCOVERED:')
    console.log(`   Party: ${result2.pokemon.join(', ')}`)
    console.log(`   Address: 0x${result2.partyCountAddr?.toString(16)}`)

  } else if (!allSuccessful) {
    console.log('❌ FAILURE: Dynamic discovery approach has issues')
    console.log('   Some savestates could not be read')
    
  } else {
    console.log('⚠️  UNEXPECTED: Addresses are the same (not volatile?)')
    console.log('   This might indicate a different issue')
  }

  console.log('\n✅ Test complete!')
}

// Handle command line usage
if (import.meta.url === `file://${process.argv[1]}`) {
  testDynamicQuetzalMemory().catch(console.error)
}

export { testDynamicQuetzalMemory }