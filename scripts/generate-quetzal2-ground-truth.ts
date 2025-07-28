#!/usr/bin/env tsx
/**
 * Generate ground truth JSON for quetzal2.ss0 savestate
 * This script temporarily replaces quetzal.ss0 with quetzal2.ss0, starts mgba, and extracts save data
 */

import fs from 'fs'
import path from 'path'
import { execSync, spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { MgbaWebSocketClient } from '../src/lib/mgba/websocket-client'
import { PokemonSaveParser } from '../src/lib/parser/core/PokemonSaveParser'
import { QuetzalConfig } from '../src/lib/parser/games/quetzal/config'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function generateQuetzal2GroundTruth() {
  console.log('🔄 Generating ground truth for quetzal2.ss0...')
  
  const testDataDir = path.join(__dirname, '../src/lib/parser/__tests__/test_data')
  const quetzal2Path = path.join(testDataDir, 'quetzal2.ss0')
  const quetzalPath = path.join(testDataDir, 'quetzal.ss0')
  const backupPath = path.join(testDataDir, 'quetzal.ss0.backup')
  
  if (!fs.existsSync(quetzal2Path)) {
    throw new Error(`quetzal2.ss0 not found at ${quetzal2Path}`)
  }
  
  // Backup original quetzal.ss0
  if (fs.existsSync(quetzalPath)) {
    fs.copyFileSync(quetzalPath, backupPath)
  }
  
  // Copy quetzal2.ss0 to quetzal.ss0 temporarily
  fs.copyFileSync(quetzal2Path, quetzalPath)
  
  let dockerStarted = false
  
  try {
    // Stop any running mgba docker containers
    try {
      console.log('🛑 Stopping any existing mgba containers...')
      execSync('npx tsx docker/mgba-docker.ts stop', { cwd: path.join(__dirname, '..') })
    } catch (e) {
      // Ignore if no container was running
    }
    
    // Start mgba docker with quetzal
    console.log('📦 Starting mgba docker with quetzal (actually quetzal2)...')
    const dockerProcess = spawn('npx', ['tsx', 'docker/mgba-docker.ts', 'start', '--game', 'quetzal'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    })
    
    dockerStarted = true
    
    // Wait for container to start
    console.log('⏳ Waiting for mgba to start...')
    await new Promise(resolve => setTimeout(resolve, 10000))
    
    // Try to connect to WebSocket
    console.log('🔌 Connecting to mgba WebSocket...')
    const wsClient = new MgbaWebSocketClient('ws://localhost:7102/ws')
    await wsClient.connect()
    
    // Create parser with Quetzal config  
    const config = new QuetzalConfig()
    const parser = new PokemonSaveParser(undefined, config)
    
    // Parse save data from memory
    console.log('📊 Parsing save data from memory...')
    const saveData = await parser.parseSaveFile(wsClient)
    
    // Create ground truth JSON structure
    const groundTruth = {
      player_name: saveData.player_name,
      play_time: saveData.play_time,
      active_slot: saveData.active_slot,
      sector_map: Object.fromEntries(saveData.sector_map || new Map()),
      party_pokemon: saveData.party_pokemon.map(p => ({
        personality: p.personality,
        otId: p.otId,
        nickname: p.nickname,
        unknown_12: Array.from(p.unknown_12 || []),
        otName: p.otName,
        unknown_1B: Array.from(p.unknown_1B || []),
        currentHp: p.currentHp,
        unknown_25: Array.from(p.unknown_25 || []),
        speciesId: p.speciesId,
        item: p.item,
        unknown_2C: Array.from(p.unknown_2C || []),
        move1: p.move1,
        move2: p.move2,
        move3: p.move3,
        move4: p.move4,
        pp1: p.pp1,
        pp2: p.pp2,
        pp3: p.pp3,
        pp4: p.pp4,
        hpEV: p.hpEV,
        atkEV: p.atkEV,
        defEV: p.defEV,
        speEV: p.speEV,
        spaEV: p.spaEV,
        spdEV: p.spdEV,
        unknown_46: Array.from(p.unknown_46 || []),
        ivData: p.ivData,
        unknown_54: Array.from(p.unknown_54 || []),
        level: p.level,
        unknown_59: p.unknown_59,
        maxHp: p.maxHp,
        attack: p.attack,
        defense: p.defense,
        speed: p.speed,
        spAttack: p.spAttack,
        spDefense: p.spDefense,
        unknown_66: Array.from(p.unknown_66 || []),
        displayOtId: p.displayOtId,
        displayNature: p.displayNature,
        moves: p.moves,
        evs: p.evs,
        ivs: p.ivs,
        totalEvs: p.totalEvs,
        totalIvs: p.totalIvs
      }))
    }
    
    // Write ground truth to file
    const outputPath = path.join(testDataDir, 'quetzal2_ground_truth.json')
    fs.writeFileSync(outputPath, JSON.stringify(groundTruth, null, 2))
    
    console.log('✅ Ground truth generated successfully!')
    console.log(`📁 Saved to: ${outputPath}`)
    console.log(`🎮 Player: ${groundTruth.player_name}`)
    console.log(`⏰ Play time: ${groundTruth.play_time.hours}h ${groundTruth.play_time.minutes}m ${groundTruth.play_time.seconds}s`)
    console.log(`👥 Party size: ${groundTruth.party_pokemon.length} Pokemon`)
    
    if (groundTruth.party_pokemon.length > 0) {
      console.log('🌟 Party Pokemon:')
      groundTruth.party_pokemon.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.nickname} (ID: ${p.speciesId}, Lv: ${p.level})`)
      })
    }
    
    await wsClient.disconnect()
    
  } catch (error) {
    console.error('❌ Error generating ground truth:', error)
    throw error
  } finally {
    // Stop docker container
    if (dockerStarted) {
      try {
        console.log('🛑 Stopping mgba docker...')
        execSync('npx tsx docker/mgba-docker.ts stop', { cwd: path.join(__dirname, '..') })
      } catch (e) {
        console.warn('Warning: Could not stop docker container:', e)
      }
    }
    
    // Restore original quetzal.ss0
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, quetzalPath)
      fs.unlinkSync(backupPath)
      console.log('🔄 Restored original quetzal.ss0')
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateQuetzal2GroundTruth().catch(console.error)
}

export { generateQuetzal2GroundTruth }