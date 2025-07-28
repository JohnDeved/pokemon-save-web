#!/usr/bin/env tsx
/**
 * Advanced Quetzal memory analysis using mgba Lua API
 * Tests memory consistency by loading different savestates programmatically
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { MgbaWebSocketClient } from '../src/lib/mgba/websocket-client.js'
import { QuetzalConfig } from '../src/lib/parser/games/quetzal/config.js'

interface MemoryCandidate {
  partyCountAddr: number
  partyDataAddr: number
  playTimeAddr?: number
  confidence: number
  notes: string[]
}

interface SavestateAnalysis {
  savestateName: string
  gameTitle: string
  workingCandidates: MemoryCandidate[]
  pokemonFound: Array<{
    slot: number
    species: string | undefined
    level: number
    hp: number
    maxHp: number
  }>
}

async function executeLuaCommand(client: MgbaWebSocketClient, luaCode: string): Promise<string> {
  // For now, we'll work with the WebSocket API directly
  // The mgba WebSocket doesn't directly support Lua execution
  // We'll need to use the HTTP API or find another approach
  return 'OK'
}

async function scanMemoryRegion(client: MgbaWebSocketClient, startAddr: number, endAddr: number, pattern: Uint8Array): Promise<number[]> {
  const candidates: number[] = []
  const step = 4 // Align to 4-byte boundaries
  
  console.log(`   Scanning 0x${startAddr.toString(16)} to 0x${endAddr.toString(16)} for pattern...`)
  
  for (let addr = startAddr; addr < endAddr; addr += step) {
    try {
      const data = await client.readBytes(addr, pattern.length)
      let matches = true
      for (let i = 0; i < pattern.length; i++) {
        if (data[i] !== pattern[i]) {
          matches = false
          break
        }
      }
      if (matches) {
        candidates.push(addr)
        console.log(`     Found pattern at 0x${addr.toString(16)}`)
      }
    } catch (e) {
      // Skip invalid addresses
    }
    
    // Progress indicator
    if ((addr - startAddr) % 0x10000 === 0) {
      const progress = ((addr - startAddr) / (endAddr - startAddr) * 100).toFixed(1)
      console.log(`     Progress: ${progress}%`)
    }
  }
  
  return candidates
}

async function analyzeSavestate(savestateName: string): Promise<SavestateAnalysis | null> {
  const client = new MgbaWebSocketClient('ws://localhost:7102/ws')
  const config = new QuetzalConfig()
  
  try {
    console.log(`\n🔍 Analyzing ${savestateName}`)
    console.log('='.repeat(50))
    
    await client.connect()
    console.log('✅ Connected to mgba WebSocket')
    
    const gameTitle = await client.getGameTitle()
    console.log(`🎮 Game: ${gameTitle}`)
    
    const analysis: SavestateAnalysis = {
      savestateName,
      gameTitle,
      workingCandidates: [],
      pokemonFound: []
    }
    
    // Test current addresses first
    console.log('\n🧪 Testing current configured addresses...')
    const currentAddresses = config.memoryAddresses
    
    try {
      const partyCount = await client.readByte(currentAddresses.partyCount)
      console.log(`   Party count at 0x${currentAddresses.partyCount.toString(16)}: ${partyCount}`)
      
      if (partyCount >= 1 && partyCount <= 6) {
        console.log('   ✅ Party count looks reasonable')
        
        // Test Pokemon data
        const pokemonData = await client.readBytes(currentAddresses.partyData, partyCount * 104)
        let validPokemon = 0
        
        for (let i = 0; i < partyCount; i++) {
          const offset = i * 104
          const pokeData = pokemonData.slice(offset, offset + 104)
          const view = new DataView(pokeData.buffer)
          
          const species = config.getPokemonName(pokeData, view)
          const level = view.getUint8(0x58)
          const currentHp = view.getUint16(0x23, true)
          const maxHp = view.getUint16(0x5A, true)
          
          analysis.pokemonFound.push({
            slot: i + 1,
            species,
            level,
            hp: currentHp,
            maxHp
          })
          
          if (level >= 1 && level <= 100 && currentHp > 0 && maxHp > 0 && species) {
            validPokemon++
            console.log(`     ${i + 1}. ${species} Lv.${level} HP:${currentHp}/${maxHp} ✅`)
          } else {
            console.log(`     ${i + 1}. ${species || 'Unknown'} Lv.${level} HP:${currentHp}/${maxHp} ❌`)
          }
        }
        
        const confidence = (validPokemon / partyCount) * 100
        
        if (confidence >= 80) {
          analysis.workingCandidates.push({
            partyCountAddr: currentAddresses.partyCount,
            partyDataAddr: currentAddresses.partyData,
            playTimeAddr: currentAddresses.playTime,
            confidence,
            notes: [`Current config addresses work with ${confidence.toFixed(0)}% confidence`]
          })
        }
      } else {
        console.log('   ❌ Party count out of range, addresses may be wrong')
      }
    } catch (error) {
      console.log(`   ❌ Error testing current addresses: ${error}`)
    }
    
    // If current addresses don't work well, scan for alternatives
    if (analysis.workingCandidates.length === 0 || analysis.workingCandidates[0]!.confidence < 80) {
      console.log('\n🔍 Current addresses not reliable, scanning for alternatives...')
      
      // EWRAM range for GBA
      const EWRAM_START = 0x2000000
      const EWRAM_END = 0x2040000
      
      // Look for reasonable party counts (1-6)
      console.log('\n🧪 Scanning for party count candidates...')
      const partyCountCandidates: number[] = []
      
      for (const count of [1, 2, 3, 4, 5, 6]) {
        console.log(`   Looking for party count ${count}...`)
        for (let addr = EWRAM_START; addr < EWRAM_END; addr += 4) {
          try {
            const value = await client.readByte(addr)
            if (value === count) {
              partyCountCandidates.push(addr)
              console.log(`     Found value ${count} at 0x${addr.toString(16)}`)
            }
          } catch (e) {
            // Skip invalid addresses
          }
        }
        
        if (partyCountCandidates.length > 20) {
          console.log('     Found enough candidates, stopping scan')
          break
        }
      }
      
      console.log(`\n📊 Found ${partyCountCandidates.length} party count candidates`)
      
      // Test each candidate
      for (const partyCountAddr of partyCountCandidates.slice(0, 10)) {
        const partyDataAddr = partyCountAddr + 4
        
        try {
          const partyCount = await client.readByte(partyCountAddr)
          const pokemonData = await client.readBytes(partyDataAddr, partyCount * 104)
          
          let validPokemon = 0
          const notes: string[] = []
          
          for (let i = 0; i < partyCount; i++) {
            const offset = i * 104
            const pokeData = pokemonData.slice(offset, offset + 104)
            const view = new DataView(pokeData.buffer)
            
            const species = config.getPokemonName(pokeData, view)
            const level = view.getUint8(0x58)
            const currentHp = view.getUint16(0x23, true)
            const maxHp = view.getUint16(0x5A, true)
            
            if (level >= 1 && level <= 100 && currentHp > 0 && maxHp > 0 && species) {
              validPokemon++
              notes.push(`Slot ${i + 1}: ${species} Lv.${level}`)
            }
          }
          
          const confidence = (validPokemon / partyCount) * 100
          
          if (confidence >= 60) {
            console.log(`   🎯 Candidate 0x${partyCountAddr.toString(16)}: ${confidence.toFixed(0)}% confidence`)
            
            analysis.workingCandidates.push({
              partyCountAddr,
              partyDataAddr,
              confidence,
              notes
            })
          }
        } catch (e) {
          // Skip invalid candidates
        }
      }
    }
    
    // Sort candidates by confidence
    analysis.workingCandidates.sort((a, b) => b.confidence - a.confidence)
    
    return analysis
    
  } catch (error) {
    console.error(`❌ Failed to analyze ${savestateName}: ${error}`)
    return null
  } finally {
    client.disconnect()
  }
}

async function compareMemoryConsistency(): Promise<void> {
  console.log('🧪 Advanced Quetzal Memory Consistency Analysis')
  console.log('='.repeat(60))
  
  // Analyze both savestates
  console.log('📋 Step 1: Analyze quetzal.ss0 (original savestate)')
  console.log('💡 Make sure mgba is running with: npm run mgba -- start --game quetzal')
  
  const analysis1 = await analyzeSavestate('quetzal.ss0')
  if (!analysis1) {
    console.error('❌ Failed to analyze quetzal.ss0')
    process.exit(1)
  }
  
  console.log('\n🛑 MANUAL STEP: Switch to quetzal2.ss0')
  console.log('1. Stop mgba: npm run mgba -- stop')
  console.log('2. Backup current quetzal.ss0: mv quetzal.ss0 quetzal_backup.ss0')
  console.log('3. Copy quetzal2.ss0 to quetzal.ss0: cp quetzal2.ss0 quetzal.ss0')
  console.log('4. Start mgba: npm run mgba -- start --game quetzal')
  console.log('5. Press Enter when ready...')
  
  // Wait for manual savestate switch
  process.stdin.setRawMode(true)
  process.stdin.resume()
  await new Promise(resolve => process.stdin.once('data', resolve))
  process.stdin.setRawMode(false)
  process.stdin.pause()
  
  console.log('\n📋 Step 2: Analyze quetzal2.ss0')
  const analysis2 = await analyzeSavestate('quetzal2.ss0')
  if (!analysis2) {
    console.error('❌ Failed to analyze quetzal2.ss0')
    process.exit(1)
  }
  
  // Compare results
  console.log('\n' + '='.repeat(60))
  console.log('📊 COMPARISON ANALYSIS')
  console.log('='.repeat(60))
  
  console.log(`\n🎮 Game Titles:`)
  console.log(`   State 1: ${analysis1.gameTitle}`)
  console.log(`   State 2: ${analysis2.gameTitle}`)
  
  console.log(`\n👥 Pokemon Found:`)
  console.log(`   State 1: ${analysis1.pokemonFound.length} Pokemon`)
  analysis1.pokemonFound.forEach(p => {
    console.log(`     ${p.slot}. ${p.species || 'Unknown'} Lv.${p.level}`)
  })
  console.log(`   State 2: ${analysis2.pokemonFound.length} Pokemon`)
  analysis2.pokemonFound.forEach(p => {
    console.log(`     ${p.slot}. ${p.species || 'Unknown'} Lv.${p.level}`)
  })
  
  console.log(`\n🎯 Working Memory Candidates:`)
  console.log(`   State 1: ${analysis1.workingCandidates.length} candidates`)
  analysis1.workingCandidates.forEach((c, i) => {
    console.log(`     ${i + 1}. Party Count: 0x${c.partyCountAddr.toString(16)}, Data: 0x${c.partyDataAddr.toString(16)} (${c.confidence.toFixed(0)}%)`)
  })
  
  console.log(`   State 2: ${analysis2.workingCandidates.length} candidates`)
  analysis2.workingCandidates.forEach((c, i) => {
    console.log(`     ${i + 1}. Party Count: 0x${c.partyCountAddr.toString(16)}, Data: 0x${c.partyDataAddr.toString(16)} (${c.confidence.toFixed(0)}%)`)
  })
  
  // Find consistent addresses
  const consistentAddresses: Array<{addr1: MemoryCandidate, addr2: MemoryCandidate}> = []
  
  for (const addr1 of analysis1.workingCandidates) {
    for (const addr2 of analysis2.workingCandidates) {
      if (addr1.partyCountAddr === addr2.partyCountAddr && 
          addr1.partyDataAddr === addr2.partyDataAddr) {
        consistentAddresses.push({ addr1, addr2 })
      }
    }
  }
  
  console.log(`\n🔍 CONSISTENCY ANALYSIS:`)
  if (consistentAddresses.length > 0) {
    console.log(`✅ Found ${consistentAddresses.length} consistent address(es)!`)
    
    for (const { addr1, addr2 } of consistentAddresses) {
      console.log(`   🎯 STABLE ADDRESSES:`)
      console.log(`      Party Count: 0x${addr1.partyCountAddr.toString(16)}`)
      console.log(`      Party Data:  0x${addr1.partyDataAddr.toString(16)}`)
      console.log(`      Confidence:  ${addr1.confidence.toFixed(0)}% / ${addr2.confidence.toFixed(0)}%`)
      
      if (addr1.playTimeAddr && addr2.playTimeAddr && addr1.playTimeAddr === addr2.playTimeAddr) {
        console.log(`      Play Time:   0x${addr1.playTimeAddr.toString(16)}`)
      }
    }
    
    console.log('\n✨ RECOMMENDATION: Use these stable addresses in QuetzalConfig')
    
  } else {
    console.log(`❌ NO consistent addresses found between savestates`)
    console.log(`   This indicates the memory addresses are VOLATILE/DYNAMIC`)
    console.log(`   Current approach of using fixed addresses will NOT work reliably`)
    
    console.log('\n🔧 ALTERNATIVE APPROACHES:')
    console.log('   1. Use relative offsets from a known memory base')
    console.log('   2. Search for Pokemon data patterns in real-time')
    console.log('   3. Use save file offsets as reference points')
    console.log('   4. Implement dynamic address discovery')
  }
  
  // Write detailed report
  const report = {
    timestamp: new Date().toISOString(),
    analysis1,
    analysis2,
    consistentAddresses: consistentAddresses.map(c => ({
      partyCountAddr: c.addr1.partyCountAddr,
      partyDataAddr: c.addr1.partyDataAddr,
      playTimeAddr: c.addr1.playTimeAddr,
      confidence1: c.addr1.confidence,
      confidence2: c.addr2.confidence
    })),
    recommendation: consistentAddresses.length > 0 ? 'USE_STABLE_ADDRESSES' : 'IMPLEMENT_DYNAMIC_DISCOVERY'
  }
  
  writeFileSync('scripts/quetzal-memory-analysis-report.json', JSON.stringify(report, null, 2))
  console.log('\n📄 Detailed report saved to: scripts/quetzal-memory-analysis-report.json')
  
  console.log('\n📝 Don\'t forget to restore original savestate:')
  console.log('   mv quetzal_backup.ss0 quetzal.ss0')
}

// Handle command line usage
if (import.meta.url === `file://${process.argv[1]}`) {
  compareMemoryConsistency().catch(console.error)
}

export { compareMemoryConsistency }