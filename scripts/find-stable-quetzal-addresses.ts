#!/usr/bin/env tsx
/**
 * Find stable Quetzal memory addresses that work across multiple savestates
 * This addresses the volatile memory issue identified in testing
 */

import { copyFileSync, renameSync, existsSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { MgbaWebSocketClient } from '../src/lib/mgba/websocket-client.js'
import { QuetzalConfig } from '../src/lib/parser/games/quetzal/config.js'

interface MemoryCandidate {
  partyCountAddr: number
  partyDataAddr: number
  confidence1: number
  confidence2: number
  pokemon1: string[]
  pokemon2: string[]
  playTime1?: string
  playTime2?: string
}

async function scanForValidPokemon(client: MgbaWebSocketClient, config: QuetzalConfig, startAddr: number, endAddr: number): Promise<Array<{addr: number, partyCount: number, pokemon: string[], confidence: number}>> {
  const candidates: Array<{addr: number, partyCount: number, pokemon: string[], confidence: number}> = []
  
  console.log(`   Scanning 0x${startAddr.toString(16)} to 0x${endAddr.toString(16)}...`)
  
  for (let addr = startAddr; addr < endAddr; addr += 4) {
    try {
      // Check if this could be a party count (1-6)
      const partyCount = await client.readByte(addr)
      if (partyCount >= 1 && partyCount <= 6) {
        
        // Check if Pokemon data follows 4 bytes later
        const pokemonDataAddr = addr + 4
        const pokemonData = await client.readBytes(pokemonDataAddr, partyCount * 104)
        
        const pokemon: string[] = []
        let validCount = 0
        
        for (let i = 0; i < partyCount; i++) {
          const offset = i * 104
          const pokeData = pokemonData.slice(offset, offset + 104)
          const view = new DataView(pokeData.buffer)
          
          const species = config.getPokemonName(pokeData, view)
          const level = view.getUint8(0x58)
          const currentHp = view.getUint16(0x23, true)
          const maxHp = view.getUint16(0x5A, true)
          
          pokemon.push(`${species || 'Unknown'} Lv.${level}`)
          
          // Check if this looks like valid Pokemon data
          if (level >= 1 && level <= 100 && currentHp > 0 && maxHp > 0 && species) {
            validCount++
          }
        }
        
        const confidence = (validCount / partyCount) * 100
        
        if (confidence >= 80) {
          candidates.push({
            addr,
            partyCount,
            pokemon,
            confidence
          })
          console.log(`     🎯 Found candidate at 0x${addr.toString(16)}: ${partyCount} Pokemon, ${confidence.toFixed(0)}% confidence`)
        }
      }
    } catch (e) {
      // Skip invalid addresses
    }
    
    // Progress indicator
    if ((addr - startAddr) % 0x8000 === 0) {
      const progress = ((addr - startAddr) / (endAddr - startAddr) * 100).toFixed(1)
      console.log(`     Progress: ${progress}%`)
    }
  }
  
  return candidates
}

async function testSavestate(savestateName: string): Promise<Array<{addr: number, partyCount: number, pokemon: string[], confidence: number}> | null> {
  console.log(`\n🔍 Testing ${savestateName}`)
  console.log('='.repeat(40))
  
  const client = new MgbaWebSocketClient('ws://localhost:7102/ws')
  const config = new QuetzalConfig()
  
  try {
    await client.connect()
    const gameTitle = await client.getGameTitle()
    console.log(`🎮 Game: ${gameTitle}`)
    
    // First, try the current addresses to confirm they don't work
    console.log('\n🧪 Testing current addresses...')
    try {
      const partyCount = await client.readByte(config.memoryAddresses.partyCount)
      console.log(`   Current party count: ${partyCount}`)
      
      if (partyCount >= 1 && partyCount <= 6) {
        console.log('   ✅ Current addresses seem to work for this savestate')
        
        // Read Pokemon for reference
        const pokemonData = await client.readBytes(config.memoryAddresses.partyData, partyCount * 104)
        const pokemon: string[] = []
        
        for (let i = 0; i < partyCount; i++) {
          const offset = i * 104
          const pokeData = pokemonData.slice(offset, offset + 104)
          const view = new DataView(pokeData.buffer)
          const species = config.getPokemonName(pokeData, view)
          const level = view.getUint8(0x58)
          pokemon.push(`${species || 'Unknown'} Lv.${level}`)
        }
        
        return [{
          addr: config.memoryAddresses.partyCount,
          partyCount,
          pokemon,
          confidence: 100
        }]
      } else {
        console.log('   ❌ Current addresses not working, need to scan')
      }
    } catch (e) {
      console.log(`   ❌ Error with current addresses: ${e}`)
    }
    
    // If current addresses don't work, scan for alternatives
    console.log('\n🔍 Scanning for valid Pokemon data...')
    
    // EWRAM scanning ranges - focus on more likely areas first
    const scanRanges = [
      { start: 0x2020000, end: 0x2030000, name: 'High EWRAM' },
      { start: 0x2010000, end: 0x2020000, name: 'Mid EWRAM' },
      { start: 0x2000000, end: 0x2010000, name: 'Low EWRAM' },
    ]
    
    let allCandidates: Array<{addr: number, partyCount: number, pokemon: string[], confidence: number}> = []
    
    for (const range of scanRanges) {
      console.log(`\n🔍 Scanning ${range.name} (0x${range.start.toString(16)} - 0x${range.end.toString(16)})`)
      const candidates = await scanForValidPokemon(client, config, range.start, range.end)
      allCandidates = allCandidates.concat(candidates)
      
      if (allCandidates.length >= 5) {
        console.log('   Found enough candidates, stopping scan')
        break
      }
    }
    
    console.log(`\n📊 Found ${allCandidates.length} total candidates`)
    allCandidates.forEach((c, i) => {
      console.log(`   ${i + 1}. 0x${c.addr.toString(16)}: ${c.pokemon.join(', ')}`)
    })
    
    return allCandidates
    
  } catch (error) {
    console.error(`❌ Error testing ${savestateName}: ${error}`)
    return null
  } finally {
    client.disconnect()
  }
}

async function switchSavestate(fromQuetzal2ToQuetzal1: boolean): Promise<void> {
  const testDataDir = '/home/runner/work/pokemon-save-web/pokemon-save-web/src/lib/parser/__tests__/test_data'
  const quetzal1Path = `${testDataDir}/quetzal.ss0`
  const quetzal2Path = `${testDataDir}/quetzal2.ss0`
  const backupPath = `${testDataDir}/quetzal_backup.ss0`
  
  console.log('🛑 Stopping mgba...')
  try {
    execSync('npm run mgba -- stop', { stdio: 'pipe', cwd: '/home/runner/work/pokemon-save-web/pokemon-save-web' })
  } catch (e) {
    // Might already be stopped
  }
  
  if (fromQuetzal2ToQuetzal1) {
    // Switch back to quetzal1
    if (existsSync(backupPath)) {
      renameSync(quetzal1Path, `${testDataDir}/quetzal2_test.ss0`)
      renameSync(backupPath, quetzal1Path)
      console.log('✅ Switched back to original quetzal.ss0')
    }
  } else {
    // Switch to quetzal2
    if (existsSync(quetzal1Path) && !existsSync(backupPath)) {
      renameSync(quetzal1Path, backupPath)
    }
    copyFileSync(quetzal2Path, quetzal1Path)
    console.log('✅ Switched to quetzal2.ss0')
  }
  
  console.log('🚀 Starting mgba...')
  execSync('npm run mgba -- start --game quetzal', { stdio: 'pipe', cwd: '/home/runner/work/pokemon-save-web/pokemon-save-web' })
  
  console.log('⏳ Waiting for mgba to start...')
  await new Promise(resolve => setTimeout(resolve, 15000))
  
  // Wait for server
  for (let i = 0; i < 10; i++) {
    try {
      execSync('curl -f http://localhost:7102/', { stdio: 'pipe' })
      console.log('✅ mgba server ready')
      break
    } catch (e) {
      if (i === 9) throw new Error('mgba server not ready')
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

async function findStableAddresses(): Promise<void> {
  console.log('🔍 Finding Stable Quetzal Memory Addresses')
  console.log('='.repeat(60))
  
  console.log('📋 This will test memory addresses across two different savestates to find stable locations')
  console.log('📋 Current addresses are known to be volatile - we need to find better ones')
  
  // Test with quetzal2.ss0 first (the problematic one)
  console.log('\n📋 Step 1: Switch to quetzal2.ss0 and scan')
  await switchSavestate(false)
  const candidates2 = await testSavestate('quetzal2.ss0')
  
  if (!candidates2 || candidates2.length === 0) {
    console.error('❌ No valid candidates found in quetzal2.ss0')
    await switchSavestate(true) // Restore
    process.exit(1)
  }
  
  // Test with original quetzal.ss0
  console.log('\n📋 Step 2: Switch to original quetzal.ss0 and test same addresses')
  await switchSavestate(true)
  const candidates1 = await testSavestate('quetzal.ss0')
  
  if (!candidates1 || candidates1.length === 0) {
    console.error('❌ No valid candidates found in quetzal.ss0')
    process.exit(1)
  }
  
  // Find consistent addresses
  console.log('\n' + '='.repeat(60))
  console.log('📊 FINDING CONSISTENT ADDRESSES')
  console.log('='.repeat(60))
  
  const stableAddresses: MemoryCandidate[] = []
  
  for (const c1 of candidates1) {
    for (const c2 of candidates2) {
      if (c1.addr === c2.addr) {
        stableAddresses.push({
          partyCountAddr: c1.addr,
          partyDataAddr: c1.addr + 4,
          confidence1: c1.confidence,
          confidence2: c2.confidence,
          pokemon1: c1.pokemon,
          pokemon2: c2.pokemon
        })
      }
    }
  }
  
  console.log(`\n🎯 Found ${stableAddresses.length} stable address(es)!`)
  
  if (stableAddresses.length > 0) {
    console.log('\n✅ SUCCESS: Found stable memory addresses!')
    
    for (const addr of stableAddresses) {
      console.log(`\n🎯 STABLE ADDRESS SET:`)
      console.log(`   Party Count: 0x${addr.partyCountAddr.toString(16)}`)
      console.log(`   Party Data:  0x${addr.partyDataAddr.toString(16)}`)
      console.log(`   Confidence:  ${addr.confidence1.toFixed(0)}% / ${addr.confidence2.toFixed(0)}%`)
      console.log(`   quetzal.ss0 team:  ${addr.pokemon1.join(', ')}`)
      console.log(`   quetzal2.ss0 team: ${addr.pokemon2.join(', ')}`)
    }
    
    // Generate updated config
    const bestAddr = stableAddresses[0]!
    console.log('\n🔧 UPDATED CONFIG:')
    console.log('Replace in src/lib/parser/games/quetzal/config.ts:')
    console.log('```typescript')
    console.log('readonly memoryAddresses = {')
    console.log(`  partyCount: 0x${bestAddr.partyCountAddr.toString(16)}, // Stable across savestates`)
    console.log(`  partyData: 0x${bestAddr.partyDataAddr.toString(16)},  // Stable across savestates`)
    console.log('  playTime: 0x2023e08, // TODO: Find stable play time address')
    console.log('  preloadRegions: [')
    console.log(`    { address: 0x${bestAddr.partyCountAddr.toString(16)}, size: 8 },`)
    console.log(`    { address: 0x${bestAddr.partyDataAddr.toString(16)}, size: 624 },`)
    console.log('  ],')
    console.log('}')
    console.log('```')
    
    // Save report
    const report = {
      timestamp: new Date().toISOString(),
      problem: 'Memory addresses were volatile across savestates',
      solution: 'Found stable addresses through systematic scanning',
      stableAddresses,
      recommendedConfig: {
        partyCount: `0x${bestAddr.partyCountAddr.toString(16)}`,
        partyData: `0x${bestAddr.partyDataAddr.toString(16)}`,
        note: 'These addresses work consistently across both test savestates'
      }
    }
    
    writeFileSync('scripts/stable-addresses-report.json', JSON.stringify(report, null, 2))
    console.log('\n📄 Detailed report saved to: scripts/stable-addresses-report.json')
    
  } else {
    console.log('\n❌ FAILURE: No consistent addresses found!')
    console.log('   The memory layout appears to be completely dynamic')
    console.log('   This indicates that fixed memory addresses will not work reliably')
    
    console.log('\n🔧 ALTERNATIVE APPROACHES NEEDED:')
    console.log('   1. Implement real-time pattern scanning')
    console.log('   2. Use relative offsets from known structures')
    console.log('   3. Search for Pokemon data signatures')
    console.log('   4. Consider save file synchronization approach')
    
    // Show what we found for analysis
    console.log('\n📊 ANALYSIS DATA:')
    console.log('   quetzal.ss0 candidates:')
    candidates1.forEach(c => {
      console.log(`     0x${c.addr.toString(16)}: ${c.pokemon.join(', ')}`)
    })
    console.log('   quetzal2.ss0 candidates:')
    candidates2.forEach(c => {
      console.log(`     0x${c.addr.toString(16)}: ${c.pokemon.join(', ')}`)
    })
  }
  
  console.log('\n✅ Analysis complete!')
}

// Handle command line usage
if (import.meta.url === `file://${process.argv[1]}`) {
  findStableAddresses().catch(console.error)
}

export { findStableAddresses }