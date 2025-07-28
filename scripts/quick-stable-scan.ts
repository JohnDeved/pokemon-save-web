#!/usr/bin/env tsx
/**
 * Quick focused scan for stable Quetzal addresses
 * Focus on areas around the current addresses to find stable alternatives
 */

import { copyFileSync, renameSync, existsSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { MgbaWebSocketClient } from '../src/lib/mgba/websocket-client.js'
import { QuetzalConfig } from '../src/lib/parser/games/quetzal/config.js'

interface AddressCandidate {
  partyCountAddr: number
  pokemon: string[]
  partyCount: number
  valid: boolean
}

async function quickScanAroundAddress(client: MgbaWebSocketClient, config: QuetzalConfig, centerAddr: number, range: number = 0x1000): Promise<AddressCandidate[]> {
  const candidates: AddressCandidate[] = []
  const startAddr = centerAddr - range
  const endAddr = centerAddr + range
  
  console.log(`   Scanning around 0x${centerAddr.toString(16)} (±0x${range.toString(16)})`)
  
  for (let addr = startAddr; addr < endAddr; addr += 4) {
    try {
      const partyCount = await client.readByte(addr)
      if (partyCount >= 1 && partyCount <= 6) {
        
        // Try to read Pokemon data
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
          
          pokemon.push(`${species || 'Unknown'} Lv.${level}`)
          
          if (level >= 1 && level <= 100 && species) {
            validCount++
          }
        }
        
        const valid = validCount >= Math.ceil(partyCount * 0.8)
        
        if (valid) {
          candidates.push({
            partyCountAddr: addr,
            pokemon,
            partyCount,
            valid
          })
          console.log(`     ✨ 0x${addr.toString(16)}: ${pokemon.join(', ')}`)
        }
      }
    } catch (e) {
      // Skip invalid addresses
    }
  }
  
  return candidates
}

async function switchToSavestate(useQuetzal2: boolean): Promise<void> {
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
    // Switch to quetzal2
    if (existsSync(quetzal1Path) && !existsSync(backupPath)) {
      renameSync(quetzal1Path, backupPath)
    }
    copyFileSync(quetzal2Path, quetzal1Path)
    console.log('✅ Switched to quetzal2.ss0')
  } else {
    // Switch back to original
    if (existsSync(backupPath)) {
      renameSync(quetzal1Path, `${testDataDir}/quetzal2_test.ss0`)
      renameSync(backupPath, quetzal1Path)
      console.log('✅ Switched back to original quetzal.ss0')
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
      break
    } catch (e) {
      if (i === 7) throw new Error('Not ready')
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
}

async function findQuetzalStableAddresses(): Promise<void> {
  console.log('🔍 Quick Scan for Stable Quetzal Addresses')
  console.log('='.repeat(50))
  
  const config = new QuetzalConfig()
  const currentAddr = config.memoryAddresses.partyCount
  
  console.log(`📋 Current problematic address: 0x${currentAddr.toString(16)}`)
  console.log('📋 Will scan around this area in both savestates')
  
  // Test with quetzal2.ss0 first (the one where current addresses fail)
  console.log('\n📋 Step 1: Test with quetzal2.ss0')
  await switchToSavestate(true)
  
  const client = new MgbaWebSocketClient('ws://localhost:7102/ws')
  
  try {
    await client.connect()
    console.log('✅ Connected to quetzal2.ss0')
    
    const candidates2 = await quickScanAroundAddress(client, config, currentAddr, 0x2000)
    console.log(`📊 Found ${candidates2.length} candidates in quetzal2.ss0`)
    
    client.disconnect()
    
    // Test with original
    console.log('\n📋 Step 2: Test with original quetzal.ss0')
    await switchToSavestate(false)
    
    await client.connect()
    console.log('✅ Connected to original quetzal.ss0')
    
    const candidates1 = await quickScanAroundAddress(client, config, currentAddr, 0x2000)
    console.log(`📊 Found ${candidates1.length} candidates in original quetzal.ss0`)
    
    // Find matching addresses
    console.log('\n📊 COMPARING CANDIDATES')
    console.log('='.repeat(30))
    
    const stableAddresses: Array<{
      addr: number
      pokemon1: string[]
      pokemon2: string[]
    }> = []
    
    for (const c1 of candidates1) {
      for (const c2 of candidates2) {
        if (c1.partyCountAddr === c2.partyCountAddr) {
          stableAddresses.push({
            addr: c1.partyCountAddr,
            pokemon1: c1.pokemon,
            pokemon2: c2.pokemon
          })
          console.log(`✅ Stable address found: 0x${c1.partyCountAddr.toString(16)}`)
          console.log(`   quetzal.ss0:  ${c1.pokemon.join(', ')}`)
          console.log(`   quetzal2.ss0: ${c2.pokemon.join(', ')}`)
        }
      }
    }
    
    if (stableAddresses.length > 0) {
      const bestAddr = stableAddresses[0]!
      console.log('\n🎯 SOLUTION FOUND!')
      console.log(`✅ Stable party count address: 0x${bestAddr.addr.toString(16)}`)
      console.log(`✅ Stable party data address:  0x${(bestAddr.addr + 4).toString(16)}`)
      console.log('\n🔧 Update QuetzalConfig with:')
      console.log(`partyCount: 0x${bestAddr.addr.toString(16)},`)
      console.log(`partyData: 0x${(bestAddr.addr + 4).toString(16)},`)
      
      // Save the update
      const report = {
        problem: 'Volatile memory addresses',
        solution: `Found stable addresses at 0x${bestAddr.addr.toString(16)}`,
        stableAddresses: stableAddresses,
        recommendation: {
          partyCount: `0x${bestAddr.addr.toString(16)}`,
          partyData: `0x${(bestAddr.addr + 4).toString(16)}`
        }
      }
      writeFileSync('scripts/quetzal-stable-solution.json', JSON.stringify(report, null, 2))
      
    } else {
      console.log('\n❌ No stable addresses found in scanned range')
      console.log('📋 Individual candidates:')
      console.log('   quetzal.ss0:')
      candidates1.forEach(c => console.log(`     0x${c.partyCountAddr.toString(16)}: ${c.pokemon.join(', ')}`))
      console.log('   quetzal2.ss0:')
      candidates2.forEach(c => console.log(`     0x${c.partyCountAddr.toString(16)}: ${c.pokemon.join(', ')}`))
      
      console.log('\n🔧 Try expanding search range or different approach')
    }
    
  } catch (error) {
    console.error(`❌ Error: ${error}`)
  } finally {
    client.disconnect()
  }
  
  console.log('\n✅ Scan complete!')
}

// Handle command line usage
if (import.meta.url === `file://${process.argv[1]}`) {
  findQuetzalStableAddresses().catch(console.error)
}

export { findQuetzalStableAddresses }