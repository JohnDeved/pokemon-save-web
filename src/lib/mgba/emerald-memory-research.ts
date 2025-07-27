#!/usr/bin/env node

/**
 * Enhanced memory scanner based on pokeemerald source code analysis
 * 
 * Key findings from pokeemerald/src/load_save.c:
 * 1. Save data is stored in EWRAM using dynamically allocated offsets
 * 2. gSaveBlock1Ptr points to the actual SaveBlock1 structure in memory
 * 3. Party Pokemon are at gSaveBlock1Ptr + 0x238 (playerParty[PARTY_SIZE])
 * 4. Party count is at gSaveBlock1Ptr + 0x234 (playerPartyCount)
 * 5. The pointer locations change each time the game loads for ASLR
 */

import { MgbaWebSocketClient } from './websocket-client'
import { MEMORY_REGIONS } from './memory-mapping'

// From pokeemerald/include/global.h - struct SaveBlock1 offsets
const SAVEBLOCK1_LAYOUT = {
  PLAYER_PARTY_COUNT: 0x234,
  PLAYER_PARTY: 0x238,
  MONEY: 0x490,
  COINS: 0x494,
} as const

// From pokeemerald/include/global.h - struct SaveBlock2 offsets
const SAVEBLOCK2_LAYOUT = {
  PLAYER_NAME: 0x00,
  PLAYER_GENDER: 0x08, 
  PLAYER_TRAINER_ID: 0x0A,
  PLAY_TIME_HOURS: 0x0E,
  PLAY_TIME_MINUTES: 0x10,
  PLAY_TIME_SECONDS: 0x11,
} as const

// From pokeemerald/include/pokemon.h - struct Pokemon size
const POKEMON_SIZE = 100 // 0x64 bytes per Pokemon

async function scanForSaveBlocks() {
  console.log('🔬 Enhanced Memory Scanner - Based on pokeemerald Source Analysis')
  console.log('================================================================\n')

  try {
    // Connect to mGBA
    console.log('🌐 Connecting to mGBA...')
    const client = new MgbaWebSocketClient()
    await client.connect()
    console.log('✅ Connected to mGBA\n')

    // Wait for save state to load
    console.log('⏳ Waiting for save state to load...')
    await new Promise(resolve => setTimeout(resolve, 3000))

    // From our known save file data:
    // - Player name: "EMERALD" 
    // - Party count: 1
    // - Pokemon personality: 0x6ccbfd84
    // - OT ID: 0xa18b1c9f

    console.log('🔍 Scanning for SaveBlock1 structure...\n')
    
    const targetPartyCount = 1
    const targetPersonality = 0x6ccbfd84
    const targetOtId = 0xa18b1c9f
    
    // Scan EWRAM for potential SaveBlock1 locations
    const startAddr = MEMORY_REGIONS.EWRAM_BASE
    const endAddr = MEMORY_REGIONS.EWRAM_BASE + 0x40000 // 256KB EWRAM
    const stepSize = 4 // Align to 4-byte boundaries
    
    console.log(`📍 Scanning EWRAM range: 0x${startAddr.toString(16)} - 0x${endAddr.toString(16)}`)
    console.log(`   Looking for party count: ${targetPartyCount}`)
    console.log(`   Looking for Pokemon personality: 0x${targetPersonality.toString(16)}`)
    
    const potentialSaveBlock1Addresses = []
    
    // Strategy 1: Look for party count followed by Pokemon data
    for (let addr = startAddr; addr < endAddr - 0x300; addr += stepSize) {
      try {
        // Check if this could be the party count location (offset 0x234 in SaveBlock1)
        const partyCount = await client.readDWord(addr + SAVEBLOCK1_LAYOUT.PLAYER_PARTY_COUNT)
        
        if (partyCount === targetPartyCount) {
          // If party count matches, check for Pokemon data right after
          const pokemonAddr = addr + SAVEBLOCK1_LAYOUT.PLAYER_PARTY
          const personality = await client.readDWord(pokemonAddr)
          const otId = await client.readDWord(pokemonAddr + 4)
          
          if (personality === targetPersonality && otId === targetOtId) {
            console.log(`🎯 Found potential SaveBlock1 at 0x${addr.toString(16)}!`)
            console.log(`   Party count: ${partyCount}`)
            console.log(`   Pokemon personality: 0x${personality.toString(16)}`)
            console.log(`   OT ID: 0x${otId.toString(16)}`)
            
            potentialSaveBlock1Addresses.push(addr)
          }
        }
      } catch (error) {
        // Skip unreadable addresses
        continue
      }
    }

    if (potentialSaveBlock1Addresses.length === 0) {
      console.log('❌ No SaveBlock1 structure found with direct method')
      console.log('\n🔍 Trying alternative search for Pokemon data...')
      
      // Strategy 2: Search for Pokemon personality and calculate backwards
      for (let addr = startAddr; addr < endAddr - 0x100; addr += stepSize) {
        try {
          const personality = await client.readDWord(addr)
          
          if (personality === targetPersonality) {
            const otId = await client.readDWord(addr + 4)
            
            if (otId === targetOtId) {
              console.log(`🎯 Found Pokemon data at 0x${addr.toString(16)}`)
              
              // Calculate potential SaveBlock1 base (Pokemon is at offset 0x238)
              const potentialSaveBlock1 = addr - SAVEBLOCK1_LAYOUT.PLAYER_PARTY
              
              // Verify by checking party count
              try {
                const partyCount = await client.readDWord(potentialSaveBlock1 + SAVEBLOCK1_LAYOUT.PLAYER_PARTY_COUNT)
                
                if (partyCount === targetPartyCount) {
                  console.log(`✅ Confirmed SaveBlock1 at 0x${potentialSaveBlock1.toString(16)}`)
                  potentialSaveBlock1Addresses.push(potentialSaveBlock1)
                }
              } catch (error) {
                // Skip if can't verify
              }
            }
          }
        } catch (error) {
          // Skip unreadable addresses
          continue
        }
      }
    }

    // Analyze found SaveBlock1 structures
    for (const saveBlock1Addr of potentialSaveBlock1Addresses) {
      console.log(`\n📊 Analyzing SaveBlock1 at 0x${saveBlock1Addr.toString(16)}:`)
      
      try {
        // Read party count
        const partyCount = await client.readDWord(saveBlock1Addr + SAVEBLOCK1_LAYOUT.PLAYER_PARTY_COUNT)
        console.log(`   Party count: ${partyCount}`)
        
        // Read money
        const money = await client.readDWord(saveBlock1Addr + SAVEBLOCK1_LAYOUT.MONEY)
        console.log(`   Money: ${money}`)
        
        // Read first Pokemon data
        const pokemonAddr = saveBlock1Addr + SAVEBLOCK1_LAYOUT.PLAYER_PARTY
        const personality = await client.readDWord(pokemonAddr)
        const otId = await client.readDWord(pokemonAddr + 4)
        
        // Read nickname (10 bytes at offset 8)
        const nicknameBytes = []
        for (let i = 0; i < 10; i++) {
          nicknameBytes.push(await client.readByte(pokemonAddr + 8 + i))
        }
        
        console.log(`   Pokemon personality: 0x${personality.toString(16)}`)
        console.log(`   Pokemon OT ID: 0x${otId.toString(16)}`)
        console.log(`   Pokemon nickname bytes: [${nicknameBytes.map(b => `0x${b.toString(16)}`).join(', ')}]`)
        
        // Now scan for SaveBlock2 (contains player name)
        console.log('\n🔍 Searching for SaveBlock2 (player data)...')
        
        // SaveBlock2 is typically nearby in EWRAM, search around this area
        const searchRange = 0x10000 // Search 64KB around SaveBlock1
        const searchStart = Math.max(startAddr, saveBlock1Addr - searchRange)
        const searchEnd = Math.min(endAddr, saveBlock1Addr + searchRange)
        
        for (let addr = searchStart; addr < searchEnd; addr += stepSize) {
          try {
            // Look for "EMERALD" player name (encoded in Pokemon character set)
            const nameBytes = []
            for (let i = 0; i < 8; i++) {
              nameBytes.push(await client.readByte(addr + i))
            }
            
            // Check if this looks like "EMERALD" in Pokemon encoding
            // E=0xBE, M=0xC6, E=0xBE, R=0xCB, A=0xBB, L=0xC5, D=0xBD
            const emeraldPattern = [0xBE, 0xC6, 0xBE, 0xCB, 0xBB, 0xC5, 0xBD, 0xFF]
            
            let nameMatch = true
            for (let i = 0; i < 7; i++) { // Check first 7 chars (don't require exact terminator)
              if (nameBytes[i] !== emeraldPattern[i]) {
                nameMatch = false
                break
              }
            }
            
            if (nameMatch) {
              console.log(`🎯 Found "EMERALD" player name at 0x${addr.toString(16)}`)
              console.log(`   Potential SaveBlock2 at 0x${addr.toString(16)}`)
              
              // Read play time to verify
              const playTimeHours = await client.readWord(addr + SAVEBLOCK2_LAYOUT.PLAY_TIME_HOURS)
              const playTimeMinutes = await client.readByte(addr + SAVEBLOCK2_LAYOUT.PLAY_TIME_MINUTES)
              const playTimeSeconds = await client.readByte(addr + SAVEBLOCK2_LAYOUT.PLAY_TIME_SECONDS)
              
              console.log(`   Play time: ${playTimeHours}:${playTimeMinutes}:${playTimeSeconds}`)
              
              // This should match our ground truth: 0:26:xx
              if (playTimeMinutes === 26) {
                console.log(`✅ Play time matches ground truth! SaveBlock2 confirmed.`)
              }
              
              break
            }
          } catch (error) {
            // Skip unreadable addresses
            continue
          }
        }
        
      } catch (error) {
        console.error(`❌ Error analyzing SaveBlock1 at 0x${saveBlock1Addr.toString(16)}:`, error)
      }
    }

    if (potentialSaveBlock1Addresses.length === 0) {
      console.log('\n❌ No valid SaveBlock1 structures found!')
      console.log('This might indicate:')
      console.log('1. The save state is not loaded correctly')
      console.log('2. The memory layout is different than expected')
      console.log('3. The save data is in a different memory region')
    } else {
      console.log(`\n✅ Found ${potentialSaveBlock1Addresses.length} potential SaveBlock1 structure(s)`)
      console.log('Memory addresses for use in memory parser:')
      for (const addr of potentialSaveBlock1Addresses) {
        console.log(`   SaveBlock1 base: 0x${addr.toString(16)}`)
        console.log(`   Party count addr: 0x${(addr + SAVEBLOCK1_LAYOUT.PLAYER_PARTY_COUNT).toString(16)}`)
        console.log(`   Party Pokemon addr: 0x${(addr + SAVEBLOCK1_LAYOUT.PLAYER_PARTY).toString(16)}`)
      }
    }

    client.disconnect()

  } catch (error) {
    console.error('\n❌ Error:', error)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  scanForSaveBlocks().catch(console.error)
}

export { scanForSaveBlocks }