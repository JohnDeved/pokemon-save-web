#!/usr/bin/env tsx
/**
 * Extract ground truth data for quetzal2 from memory dump
 * Uses the confirmed party address 0x02026354 to extract full Pokemon data
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Pokemon structure offsets (104 bytes each)
const OFFSETS = {
  personality: 0,        // uint32
  otId: 4,              // uint32  
  nickname: 8,          // 10 bytes
  unknown_12: 18,       // 2 bytes
  otName: 20,           // 7 bytes
  unknown_1B: 27,       // 8 bytes  
  currentHp: 86,        // uint16
  unknown_25: 88,       // 3 bytes
  speciesId: 40,        // uint16
  item: 42,             // uint16
  unknown_2C: 44,       // 8 bytes
  move1: 52,            // uint16
  move2: 54,            // uint16
  move3: 56,            // uint16
  move4: 58,            // uint16
  pp1: 60,              // uint8
  pp2: 61,              // uint8
  pp3: 62,              // uint8
  pp4: 63,              // uint8
  hpEV: 64,             // uint8
  atkEV: 65,            // uint8
  defEV: 66,            // uint8
  speEV: 67,            // uint8
  spaEV: 68,            // uint8
  spdEV: 69,            // uint8
  unknown_46: 70,       // 10 bytes
  ivData: 80,           // uint32
  unknown_54: 84,       // 4 bytes
  level: 88,            // uint8
  unknown_59: 89,       // uint8
  maxHp: 90,            // uint16
  attack: 92,           // uint16
  defense: 94,          // uint16
  speed: 96,            // uint16
  spAttack: 98,         // uint16
  spDefense: 100,       // uint16
  unknown_66: 102,      // 2 bytes
}

function readUint8(buffer: Uint8Array, offset: number): number {
  return buffer[offset]
}

function readUint16(buffer: Uint8Array, offset: number): number {
  return buffer[offset] | (buffer[offset + 1] << 8)
}

function readUint32(buffer: Uint8Array, offset: number): number {
  return (buffer[offset] | 
          (buffer[offset + 1] << 8) | 
          (buffer[offset + 2] << 16) | 
          (buffer[offset + 3] << 24)) >>> 0
}

function readBytes(buffer: Uint8Array, offset: number, length: number): number[] {
  return Array.from(buffer.slice(offset, offset + length))
}

function readString(buffer: Uint8Array, offset: number, length: number): string {
  const bytes = buffer.slice(offset, offset + length)
  const nullIndex = bytes.indexOf(0)
  const validBytes = nullIndex >= 0 ? bytes.slice(0, nullIndex) : bytes
  return String.fromCharCode(...validBytes.filter(b => b > 0 && b < 128))
}

function extractIVs(ivData: number): number[] {
  return [
    (ivData) & 0x1F,        // HP
    (ivData >> 5) & 0x1F,   // Attack
    (ivData >> 10) & 0x1F,  // Defense
    (ivData >> 15) & 0x1F,  // Speed
    (ivData >> 20) & 0x1F,  // Sp. Attack
    (ivData >> 25) & 0x1F,  // Sp. Defense
  ]
}

function calculateNature(personality: number): string {
  const natures = [
    'Hardy', 'Lonely', 'Brave', 'Adamant', 'Naughty',
    'Bold', 'Docile', 'Relaxed', 'Impish', 'Lax',
    'Timid', 'Hasty', 'Serious', 'Jolly', 'Naive',
    'Modest', 'Mild', 'Quiet', 'Bashful', 'Rash',
    'Calm', 'Gentle', 'Sassy', 'Careful', 'Quirky'
  ]
  return natures[personality % 25] || 'Unknown'
}

function parsePokemon(buffer: Uint8Array, baseOffset: number): any {
  const personality = readUint32(buffer, baseOffset + OFFSETS.personality)
  const otId = readUint32(buffer, baseOffset + OFFSETS.otId)
  const nickname = readString(buffer, baseOffset + OFFSETS.nickname, 10)
  const otName = readString(buffer, baseOffset + OFFSETS.otName, 7)
  const speciesId = readUint16(buffer, baseOffset + OFFSETS.speciesId)
  const level = readUint8(buffer, baseOffset + OFFSETS.level)
  const ivData = readUint32(buffer, baseOffset + OFFSETS.ivData)
  
  return {
    personality,
    otId,
    nickname,
    unknown_12: readBytes(buffer, baseOffset + OFFSETS.unknown_12, 2),
    otName,
    unknown_1B: readBytes(buffer, baseOffset + OFFSETS.unknown_1B, 8),
    currentHp: readUint16(buffer, baseOffset + OFFSETS.currentHp),
    unknown_25: readBytes(buffer, baseOffset + OFFSETS.unknown_25, 3),
    speciesId,
    item: readUint16(buffer, baseOffset + OFFSETS.item),
    unknown_2C: readBytes(buffer, baseOffset + OFFSETS.unknown_2C, 8),
    move1: readUint16(buffer, baseOffset + OFFSETS.move1),
    move2: readUint16(buffer, baseOffset + OFFSETS.move2),
    move3: readUint16(buffer, baseOffset + OFFSETS.move3),
    move4: readUint16(buffer, baseOffset + OFFSETS.move4),
    pp1: readUint8(buffer, baseOffset + OFFSETS.pp1),
    pp2: readUint8(buffer, baseOffset + OFFSETS.pp2),
    pp3: readUint8(buffer, baseOffset + OFFSETS.pp3),
    pp4: readUint8(buffer, baseOffset + OFFSETS.pp4),
    hpEV: readUint8(buffer, baseOffset + OFFSETS.hpEV),
    atkEV: readUint8(buffer, baseOffset + OFFSETS.atkEV),
    defEV: readUint8(buffer, baseOffset + OFFSETS.defEV),
    speEV: readUint8(buffer, baseOffset + OFFSETS.speEV),
    spaEV: readUint8(buffer, baseOffset + OFFSETS.spaEV),
    spdEV: readUint8(buffer, baseOffset + OFFSETS.spdEV),
    unknown_46: readBytes(buffer, baseOffset + OFFSETS.unknown_46, 10),
    ivData,
    unknown_54: readBytes(buffer, baseOffset + OFFSETS.unknown_54, 4),
    level,
    unknown_59: readUint8(buffer, baseOffset + OFFSETS.unknown_59),
    maxHp: readUint16(buffer, baseOffset + OFFSETS.maxHp),
    attack: readUint16(buffer, baseOffset + OFFSETS.attack),
    defense: readUint16(buffer, baseOffset + OFFSETS.defense),
    speed: readUint16(buffer, baseOffset + OFFSETS.speed),
    spAttack: readUint16(buffer, baseOffset + OFFSETS.spAttack),
    spDefense: readUint16(buffer, baseOffset + OFFSETS.spDefense),
    unknown_66: readBytes(buffer, baseOffset + OFFSETS.unknown_66, 2),
    displayOtId: (otId & 0xFFFF).toString().padStart(5, '0'),
    displayNature: calculateNature(personality),
    moves: {
      move1: { name: `Move ${readUint16(buffer, baseOffset + OFFSETS.move1)}`, id: readUint16(buffer, baseOffset + OFFSETS.move1), pp: readUint8(buffer, baseOffset + OFFSETS.pp1) },
      move2: { name: `Move ${readUint16(buffer, baseOffset + OFFSETS.move2)}`, id: readUint16(buffer, baseOffset + OFFSETS.move2), pp: readUint8(buffer, baseOffset + OFFSETS.pp2) },
      move3: { name: `Move ${readUint16(buffer, baseOffset + OFFSETS.move3)}`, id: readUint16(buffer, baseOffset + OFFSETS.move3), pp: readUint8(buffer, baseOffset + OFFSETS.pp3) },
      move4: { name: `Move ${readUint16(buffer, baseOffset + OFFSETS.move4)}`, id: readUint16(buffer, baseOffset + OFFSETS.move4), pp: readUint8(buffer, baseOffset + OFFSETS.pp4) }
    },
    evs: [
      readUint8(buffer, baseOffset + OFFSETS.hpEV),
      readUint8(buffer, baseOffset + OFFSETS.atkEV),
      readUint8(buffer, baseOffset + OFFSETS.defEV),
      readUint8(buffer, baseOffset + OFFSETS.speEV),
      readUint8(buffer, baseOffset + OFFSETS.spaEV),
      readUint8(buffer, baseOffset + OFFSETS.spdEV)
    ],
    ivs: extractIVs(ivData),
    totalEvs: readUint8(buffer, baseOffset + OFFSETS.hpEV) + readUint8(buffer, baseOffset + OFFSETS.atkEV) + readUint8(buffer, baseOffset + OFFSETS.defEV) + readUint8(buffer, baseOffset + OFFSETS.speEV) + readUint8(buffer, baseOffset + OFFSETS.spaEV) + readUint8(buffer, baseOffset + OFFSETS.spdEV),
    totalIvs: extractIVs(ivData).reduce((sum, iv) => sum + iv, 0)
  }
}

async function extractQuetzal2GroundTruth() {
  console.log('🔍 Extracting quetzal2 ground truth from memory dump...')
  
  const testDataDir = path.join(__dirname, '../src/lib/parser/__tests__/test_data')
  const dumpPath = path.join(testDataDir, 'quetzal2_ewram.bin')
  
  if (!fs.existsSync(dumpPath)) {
    throw new Error(`Memory dump not found: ${dumpPath}`)
  }
  
  const dumpBuffer = fs.readFileSync(dumpPath)
  const memoryData = new Uint8Array(dumpBuffer)
  
  // Party data is at 0x02026354, memory dump starts at 0x02000000
  const partyAddress = 0x02026354 - 0x02000000
  
  console.log(`📊 Reading party data from offset 0x${partyAddress.toString(16)}...`)
  
  // First, read the party count (should be 4 bytes before Pokemon data or embedded at start)
  let partyCount = 6 // Default to 6, will validate by checking actual Pokemon
  
  // Extract up to 6 Pokemon
  const partyPokemon = []
  for (let i = 0; i < 6; i++) {
    const pokemonOffset = partyAddress + (i * 104)
    if (pokemonOffset + 104 > memoryData.length) break
    
    const pokemon = parsePokemon(memoryData, pokemonOffset)
    
    // Validate Pokemon - must have valid species and level
    if (pokemon.speciesId > 0 && pokemon.speciesId <= 900 && pokemon.level > 0 && pokemon.level <= 100) {
      partyPokemon.push(pokemon)
      console.log(`   ${i + 1}. ${pokemon.nickname} (ID: ${pokemon.speciesId}, Lv: ${pokemon.level})`)
    } else if (partyPokemon.length === 0) {
      console.log(`   Invalid Pokemon at slot ${i + 1}, stopping`)
      break
    } else {
      console.log(`   Empty slot ${i + 1}, stopping`)
      break
    }
  }
  
  if (partyPokemon.length === 0) {
    throw new Error('No valid Pokemon found at the expected party address')
  }
  
  // Create ground truth structure
  const groundTruth = {
    player_name: "Unknown", // We'll need to extract this separately
    play_time: {
      hours: 0,
      minutes: 0,
      seconds: 0
    },
    active_slot: 14, // Default assumption
    sector_map: {}, // Would need save file analysis for this
    party_pokemon: partyPokemon
  }
  
  // Save to file
  const outputPath = path.join(testDataDir, 'quetzal2_ground_truth.json')
  fs.writeFileSync(outputPath, JSON.stringify(groundTruth, null, 2))
  
  console.log(`✅ Ground truth extracted successfully!`)
  console.log(`📁 Saved to: ${outputPath}`)
  console.log(`👥 Party size: ${partyPokemon.length} Pokemon`)
  
  return groundTruth
}

if (import.meta.url === `file://${process.argv[1]}`) {
  extractQuetzal2GroundTruth().catch(console.error)
}

export { extractQuetzal2GroundTruth }