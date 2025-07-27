#!/usr/bin/env node

/**
 * Research script to understand Pokemon Emerald memory layout from pokeemerald source
 * Focus: Find reliable way to locate save data without prior knowledge of content
 * 
 * Based on deep analysis of: https://github.com/pret/pokeemerald
 */

import { MgbaWebSocketClient } from './websocket-client'
import { MEMORY_REGIONS } from './memory-mapping'

/**
 * Key findings from pokeemerald source analysis:
 * 
 * 1. Global Pointers (src/load_save.c):
 *    - gSaveBlock1Ptr: Points to SaveBlock1 in EWRAM
 *    - gSaveBlock2Ptr: Points to SaveBlock2 in EWRAM  
 *    - These are set by LoadSaveblockToEwram() function
 * 
 * 2. Memory Layout (src/save.c, include/global.h):
 *    - SaveBlock1: Main game data (party, items, etc.)
 *    - SaveBlock2: Player profile, time, options
 *    - Allocated dynamically in EWRAM for ASLR security
 * 
 * 3. Initialization Process (src/load_save.c):
 *    - Game reads save from SRAM/Flash
 *    - Decompresses if needed
 *    - Allocates space in EWRAM
 *    - Sets global pointers
 * 
 * Strategy: Find the global pointer variables rather than scanning for data
 */

// Symbol table based on pokeemerald link map analysis
const EMERALD_SYMBOLS = {
  // These addresses are from a typical Emerald ROM build
  // May need adjustment based on specific ROM version
  gSaveBlock1Ptr: 0x02037830,  // From typical emerald.sym
  gSaveBlock2Ptr: 0x02037834,  // From typical emerald.sym
  gPokemonStoragePtr: 0x02037838, // Pokemon PC storage
  
  // Alternative symbol locations to try
  ALT_SYMBOLS: [
    { gSaveBlock1Ptr: 0x02037830, gSaveBlock2Ptr: 0x02037834 },
    { gSaveBlock1Ptr: 0x02030000, gSaveBlock2Ptr: 0x02030004 },
    { gSaveBlock1Ptr: 0x02025000, gSaveBlock2Ptr: 0x02025004 },
  ]
} as const

/**
 * Alternative approach: Scan for pointer patterns
 * Look for valid EWRAM addresses that point to structured data
 */
async function findSaveDataPointers(client: MgbaWebSocketClient): Promise<{ saveBlock1?: number, saveBlock2?: number }> {
  console.log('🔍 Searching for save data pointers using pokeemerald analysis...\n')

  // Strategy 1: Try known symbol addresses
  console.log('📍 Strategy 1: Checking known symbol addresses from pokeemerald builds')
  
  for (const symbols of [EMERALD_SYMBOLS, ...EMERALD_SYMBOLS.ALT_SYMBOLS]) {
    console.log(`\n  Testing symbol addresses: 0x${symbols.gSaveBlock1Ptr.toString(16)}, 0x${symbols.gSaveBlock2Ptr.toString(16)}`)
    
    try {
      // Read the pointer values
      const saveBlock1Ptr = await client.readDWord(symbols.gSaveBlock1Ptr)
      const saveBlock2Ptr = await client.readDWord(symbols.gSaveBlock2Ptr)
      
      console.log(`    gSaveBlock1Ptr value: 0x${saveBlock1Ptr.toString(16)}`)
      console.log(`    gSaveBlock2Ptr value: 0x${saveBlock2Ptr.toString(16)}`)
      
      // Validate that these point to EWRAM
      if (isValidEwramAddress(saveBlock1Ptr) && isValidEwramAddress(saveBlock2Ptr)) {
        console.log(`    🎯 Found valid EWRAM pointers!`)
        
        // Validate the pointed-to data has save structure
        const isValid = await validateSaveBlockStructure(client, saveBlock1Ptr, saveBlock2Ptr)
        if (isValid) {
          console.log(`    ✅ Save block structure validated!`)
          return { saveBlock1: saveBlock1Ptr, saveBlock2: saveBlock2Ptr }
        } else {
          console.log(`    ❌ Save block structure validation failed`)
        }
      } else {
        console.log(`    ❌ Pointers do not point to valid EWRAM addresses`)
      }
    } catch (error) {
      console.log(`    ❌ Error reading symbol addresses: ${error}`)
    }
  }

  // Strategy 2: Scan IWRAM for pointer variables
  console.log('\n📍 Strategy 2: Scanning IWRAM for save data pointers')
  
  const iwramPointers = await scanForSavePointers(client)
  if (iwramPointers.saveBlock1 && iwramPointers.saveBlock2) {
    console.log(`  🎯 Found pointers in IWRAM scan!`)
    return iwramPointers
  }

  // Strategy 3: Scan EWRAM for save data structures
  console.log('\n📍 Strategy 3: Direct EWRAM structure scan (fallback)')
  
  return await scanEwramForSaveStructures(client)
}

function isValidEwramAddress(addr: number): boolean {
  return addr >= MEMORY_REGIONS.EWRAM_BASE && 
         addr < (MEMORY_REGIONS.EWRAM_BASE + 0x40000) &&
         (addr % 4 === 0) // Should be 4-byte aligned
}

async function validateSaveBlockStructure(client: MgbaWebSocketClient, saveBlock1Addr: number, saveBlock2Addr: number): Promise<boolean> {
  try {
    // SaveBlock1 validation: Check party count is reasonable (0-6)
    const partyCount = await client.readDWord(saveBlock1Addr + 0x234)
    if (partyCount > 6) {
      return false
    }

    // SaveBlock2 validation: Check player name is valid Pokemon charset
    const nameBytes = await client.readBytes(saveBlock2Addr, 8)
    if (!isValidPokemonCharset(nameBytes)) {
      return false
    }

    // Check play time is reasonable (hours < 999)
    const playTimeHours = await client.readWord(saveBlock2Addr + 0x0E)
    if (playTimeHours > 999) {
      return false
    }

    return true
  } catch (error) {
    return false
  }
}

function isValidPokemonCharset(bytes: Uint8Array): boolean {
  for (let i = 0; i < Math.min(bytes.length, 8); i++) {
    const byte = bytes[i]
    if (byte === 0xFF) break // String terminator
    if (byte === 0) break // Null terminator
    
    // Valid Pokemon character ranges
    const isValid = 
      (byte >= 0xBB && byte <= 0xD4) || // A-Z
      (byte >= 0xD5 && byte <= 0xEE) || // a-z  
      (byte >= 0xA1 && byte <= 0xAA) || // 0-9
      (byte >= 0x01 && byte <= 0x1F)    // Special chars
    
    if (!isValid) {
      return false
    }
  }
  return true
}

async function scanForSavePointers(client: MgbaWebSocketClient): Promise<{ saveBlock1?: number, saveBlock2?: number }> {
  console.log('  Scanning IWRAM for pointer patterns...')
  
  const iwramStart = MEMORY_REGIONS.IWRAM_BASE
  const iwramEnd = MEMORY_REGIONS.IWRAM_BASE + 0x8000
  
  for (let addr = iwramStart; addr < iwramEnd; addr += 4) {
    try {
      const ptr1 = await client.readDWord(addr)
      const ptr2 = await client.readDWord(addr + 4)
      
      if (isValidEwramAddress(ptr1) && isValidEwramAddress(ptr2)) {
        // Check if these could be SaveBlock pointers
        const isValid = await validateSaveBlockStructure(client, ptr1, ptr2)
        if (isValid) {
          console.log(`    🎯 Found pointer pair at 0x${addr.toString(16)}: 0x${ptr1.toString(16)}, 0x${ptr2.toString(16)}`)
          return { saveBlock1: ptr1, saveBlock2: ptr2 }
        }
      }
    } catch (error) {
      continue
    }
  }
  
  return {}
}

async function scanEwramForSaveStructures(client: MgbaWebSocketClient): Promise<{ saveBlock1?: number, saveBlock2?: number }> {
  console.log('  Scanning EWRAM for save data structures...')
  
  const ewramStart = MEMORY_REGIONS.EWRAM_BASE
  const ewramEnd = MEMORY_REGIONS.EWRAM_BASE + 0x40000
  let saveBlock1Addr: number | undefined
  let saveBlock2Addr: number | undefined
  
  // Look for SaveBlock1 pattern: reasonable party count followed by Pokemon data
  for (let addr = ewramStart; addr < ewramEnd - 0x500; addr += 16) {
    try {
      // Check party count at offset 0x234
      const partyCount = await client.readDWord(addr + 0x234)
      
      if (partyCount >= 0 && partyCount <= 6) {
        // Check for valid Pokemon data structure after party count
        const pokemonAddr = addr + 0x238
        const personality = await client.readDWord(pokemonAddr)
        
        // Personality should be non-zero for valid Pokemon
        if (personality !== 0) {
          // Additional validation: check if this looks like a Pokemon struct
          const otId = await client.readDWord(pokemonAddr + 4)
          const statusCondition = await client.readDWord(pokemonAddr + 0x50)
          const level = await client.readByte(pokemonAddr + 0x54)
          
          if (level > 0 && level <= 100 && statusCondition < 0x1000000) {
            console.log(`    🎯 Found potential SaveBlock1 at 0x${addr.toString(16)}`)
            console.log(`      Party count: ${partyCount}, Pokemon level: ${level}`)
            saveBlock1Addr = addr
            break
          }
        }
      }
    } catch (error) {
      continue
    }
    
    // Progress indicator
    if ((addr - ewramStart) % 0x10000 === 0) {
      const progress = ((addr - ewramStart) / 0x40000 * 100).toFixed(1)
      process.stdout.write(`\r    Progress: ${progress}%`)
    }
  }
  
  console.log() // New line after progress
  
  // Look for SaveBlock2 near SaveBlock1
  if (saveBlock1Addr) {
    console.log('  Searching for SaveBlock2 near SaveBlock1...')
    
    const searchRange = 0x20000 // 128KB search range
    const searchStart = Math.max(ewramStart, saveBlock1Addr - searchRange)
    const searchEnd = Math.min(ewramEnd, saveBlock1Addr + searchRange)
    
    for (let addr = searchStart; addr < searchEnd; addr += 16) {
      try {
        // Check for valid player name (first 8 bytes)
        const nameBytes = await client.readBytes(addr, 8)
        
        if (isValidPokemonCharset(nameBytes)) {
          // Check play time values are reasonable
          const hours = await client.readWord(addr + 0x0E)
          const minutes = await client.readByte(addr + 0x10)
          const seconds = await client.readByte(addr + 0x11)
          
          if (hours <= 999 && minutes < 60 && seconds < 60) {
            console.log(`    🎯 Found potential SaveBlock2 at 0x${addr.toString(16)}`)
            console.log(`      Play time: ${hours}:${minutes}:${seconds}`)
            saveBlock2Addr = addr
            break
          }
        }
      } catch (error) {
        continue
      }
    }
  }
  
  return { saveBlock1: saveBlock1Addr, saveBlock2: saveBlock2Addr }
}

async function analyzeFoundSaveData(client: MgbaWebSocketClient, saveBlock1: number, saveBlock2: number) {
  console.log('\n📊 Analyzing found save data structures...')
  
  try {
    // Analyze SaveBlock1
    console.log(`\n🎮 SaveBlock1 Analysis (0x${saveBlock1.toString(16)}):`)
    
    const partyCount = await client.readDWord(saveBlock1 + 0x234)
    console.log(`  Party count: ${partyCount}`)
    
    if (partyCount > 0 && partyCount <= 6) {
      for (let i = 0; i < partyCount; i++) {
        const pokemonAddr = saveBlock1 + 0x238 + (i * 100)
        const personality = await client.readDWord(pokemonAddr)
        const otId = await client.readDWord(pokemonAddr + 4)
        const species = await client.readWord(pokemonAddr + 0x20) // Encrypted, but we can try
        const level = await client.readByte(pokemonAddr + 0x54)
        const currentHp = await client.readWord(pokemonAddr + 0x56)
        const maxHp = await client.readWord(pokemonAddr + 0x58)
        
        console.log(`  Pokemon ${i + 1}:`)
        console.log(`    Personality: 0x${personality.toString(16)}`)
        console.log(`    OT ID: 0x${otId.toString(16)}`)
        console.log(`    Level: ${level}`)
        console.log(`    HP: ${currentHp}/${maxHp}`)
      }
    }
    
    const money = await client.readDWord(saveBlock1 + 0x490)
    console.log(`  Money: ${money}`)
    
    // Analyze SaveBlock2
    console.log(`\n👤 SaveBlock2 Analysis (0x${saveBlock2.toString(16)}):`)
    
    const nameBytes = await client.readBytes(saveBlock2, 8)
    const playerName = decodePokemonString(nameBytes)
    console.log(`  Player name: "${playerName}"`)
    
    const trainerId = await client.readDWord(saveBlock2 + 0x0A)
    console.log(`  Trainer ID: ${trainerId & 0xFFFF}`)
    
    const hours = await client.readWord(saveBlock2 + 0x0E)
    const minutes = await client.readByte(saveBlock2 + 0x10)
    const seconds = await client.readByte(saveBlock2 + 0x11)
    console.log(`  Play time: ${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`)
    
  } catch (error) {
    console.error(`❌ Error analyzing save data: ${error}`)
  }
}

function decodePokemonString(bytes: Uint8Array): string {
  let result = ''
  for (let i = 0; i < bytes.length && bytes[i] !== 0xFF && bytes[i] !== 0; i++) {
    const char = bytes[i]
    
    if (char >= 0xBB && char <= 0xD4) {
      result += String.fromCharCode(char - 0xBB + 65) // A-Z
    } else if (char >= 0xD5 && char <= 0xEE) {
      result += String.fromCharCode(char - 0xD5 + 97) // a-z
    } else if (char >= 0xA1 && char <= 0xAA) {
      result += String.fromCharCode(char - 0xA1 + 48) // 0-9
    } else {
      result += '?'
    }
  }
  return result
}

async function runResearch() {
  console.log('🧬 Pokemon Emerald Memory Research - Based on pokeemerald Source')
  console.log('==================================================================\n')
  
  try {
    // Connect to mGBA
    console.log('🌐 Connecting to mGBA...')
    const client = new MgbaWebSocketClient()
    await client.connect()
    console.log('✅ Connected to mGBA\n')

    // Wait for emulator to be ready
    console.log('⏳ Waiting for emulator to load save state...')
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Find save data using pokeemerald analysis
    const result = await findSaveDataPointers(client)
    
    if (result.saveBlock1 && result.saveBlock2) {
      console.log('\n✅ Successfully found save data!')
      console.log(`   SaveBlock1: 0x${result.saveBlock1.toString(16)}`)
      console.log(`   SaveBlock2: 0x${result.saveBlock2.toString(16)}`)
      
      await analyzeFoundSaveData(client, result.saveBlock1, result.saveBlock2)
      
      console.log('\n🎯 Memory parser can now use these addresses:')
      console.log(`   - Party Pokemon: 0x${(result.saveBlock1 + 0x234).toString(16)} (count), 0x${(result.saveBlock1 + 0x238).toString(16)} (data)`)
      console.log(`   - Player name: 0x${result.saveBlock2.toString(16)}`)
      console.log(`   - Play time: 0x${(result.saveBlock2 + 0x0E).toString(16)}`)
      
    } else {
      console.log('\n❌ Could not find save data pointers')
      console.log('This might indicate:')
      console.log('1. Save state is not loaded')
      console.log('2. Different ROM version with different symbol addresses')
      console.log('3. Memory is not accessible or corrupted')
    }

    client.disconnect()

  } catch (error) {
    console.error('\n❌ Research failed:', error)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runResearch().catch(console.error)
}

export { findSaveDataPointers, analyzeFoundSaveData }