#!/usr/bin/env node

/**
 * Targeted memory scanner to find where sector 8 save data is loaded in mGBA
 */

import { MgbaWebSocketClient } from './websocket-client'
import { MEMORY_REGIONS } from './memory-mapping'

async function findSaveDataInMemory() {
  console.log('🎯 Targeted Memory Scanner for Save Data')
  console.log('==========================================\n')

  try {
    // Connect to mGBA
    console.log('🌐 Connecting to mGBA...')
    const client = new MgbaWebSocketClient()
    await client.connect()
    console.log('✅ Connected to mGBA\n')

    // Wait for save state to load
    console.log('⏳ Waiting for save state to load...')
    await new Promise(resolve => setTimeout(resolve, 3000))

    // We know from analysis:
    // - Pokemon personality: 0x6ccbfd84
    // - OT ID: 0xa18b1c9f  
    // - Party count: 1 (should be 4 bytes before Pokemon data)

    console.log('🔍 Searching for Pokemon personality 0x6ccbfd84...')
    
    // Search EWRAM for the personality value
    const personalityValue = 0x6ccbfd84
    const foundAddresses = []
    
    // Scan EWRAM in chunks to avoid timeouts
    const startAddr = MEMORY_REGIONS.EWRAM_BASE
    const endAddr = MEMORY_REGIONS.EWRAM_BASE + 0x40000
    const chunkSize = 0x4000 // 16KB chunks
    
    for (let addr = startAddr; addr < endAddr; addr += chunkSize) {
      const actualChunkSize = Math.min(chunkSize, endAddr - addr)
      console.log(`  Scanning 0x${addr.toString(16)} - 0x${(addr + actualChunkSize).toString(16)}...`)
      
      for (let offset = 0; offset < actualChunkSize; offset += 4) {
        try {
          const value = await client.readDWord(addr + offset)
          if (value === personalityValue) {
            foundAddresses.push(addr + offset)
            console.log(`  🎯 Found personality at 0x${(addr + offset).toString(16)}!`)
          }
        } catch (error) {
          // Skip unreadable addresses
          continue
        }
      }
    }

    if (foundAddresses.length > 0) {
      console.log(`\n✅ Found ${foundAddresses.length} potential Pokemon locations:`)
      
      for (const addr of foundAddresses) {
        console.log(`\n📍 Examining Pokemon at 0x${addr.toString(16)}:`)
        
        try {
          // Verify this is the right Pokemon by checking surrounding data
          const personality = await client.readDWord(addr)
          const otId = await client.readDWord(addr + 4)
          
          console.log(`  Personality: 0x${personality.toString(16)}`)
          console.log(`  OT ID: 0x${otId.toString(16)}`)
          
          if (otId === 0xa18b1c9f) {
            console.log(`  🎯 OT ID matches! This is our Pokemon!`)
            
            // Party count should be 4 bytes before this address
            const partyCountAddr = addr - 4
            const partyCount = await client.readDWord(partyCountAddr)
            console.log(`  Party count at 0x${partyCountAddr.toString(16)}: ${partyCount}`)
            
            if (partyCount === 1) {
              console.log(`  🎯🎯 PERFECT MATCH! Found save data location!`)
              
              // Calculate save data base address
              // Party count is at offset 0x234 from save base
              const saveBase = partyCountAddr - 0x234
              console.log(`  💎 Save data base address: 0x${saveBase.toString(16)}`)
              
              // Test reading player name (but it might be in a different sector)
              try {
                const nameBytes = []
                for (let i = 0; i < 8; i++) {
                  nameBytes.push(await client.readByte(saveBase + i))
                }
                
                let playerName = ''
                for (let i = 0; i < nameBytes.length && nameBytes[i] !== 0xFF && nameBytes[i] !== 0; i++) {
                  const char = nameBytes[i]
                  if (char >= 0xBB && char <= 0xD4) {
                    playerName += String.fromCharCode(char - 0xBB + 65) // A-Z
                  } else if (char >= 0xD5 && char <= 0xEE) {
                    playerName += String.fromCharCode(char - 0xD5 + 97) // a-z
                  } else if (char >= 0xA1 && char <= 0xAA) {
                    playerName += String.fromCharCode(char - 0xA1 + 48) // 0-9
                  }
                }
                
                console.log(`  Player name at save base: "${playerName}"`)
                
                if (playerName.length === 0) {
                  console.log(`  📝 Player name is empty - might be in different sector`)
                  
                  // Let's check a few KB before and after for the player name
                  console.log(`  🔍 Searching for EMERALD player name around this area...`)
                  
                  for (let searchOffset = -0x8000; searchOffset <= 0x8000; searchOffset += 0x1000) {
                    const searchAddr = saveBase + searchOffset
                    if (searchAddr < MEMORY_REGIONS.EWRAM_BASE || searchAddr >= MEMORY_REGIONS.EWRAM_BASE + 0x40000) {
                      continue
                    }
                    
                    try {
                      const testBytes = []
                      for (let i = 0; i < 8; i++) {
                        testBytes.push(await client.readByte(searchAddr + i))
                      }
                      
                      let testName = ''
                      for (let i = 0; i < testBytes.length && testBytes[i] !== 0xFF && testBytes[i] !== 0; i++) {
                        const char = testBytes[i]
                        if (char >= 0xBB && char <= 0xD4) {
                          testName += String.fromCharCode(char - 0xBB + 65)
                        } else if (char >= 0xD5 && char <= 0xEE) {
                          testName += String.fromCharCode(char - 0xD5 + 97)
                        } else if (char >= 0xA1 && char <= 0xAA) {
                          testName += String.fromCharCode(char - 0xA1 + 48)
                        }
                      }
                      
                      if (testName === 'EMERALD') {
                        console.log(`  🎯 Found EMERALD at 0x${searchAddr.toString(16)} (offset ${searchOffset > 0 ? '+' : ''}0x${searchOffset.toString(16)} from party base)`)
                      }
                    } catch (error) {
                      // Skip unreadable addresses
                    }
                  }
                }
                
              } catch (error) {
                console.log(`  Error reading player name: ${error}`)
              }
            }
          }
          
        } catch (error) {
          console.log(`  Error verifying Pokemon data: ${error}`)
        }
      }
    } else {
      console.log('\n❌ Pokemon personality not found in EWRAM')
      console.log('This might mean:')
      console.log('1. The save state is not loaded yet')
      console.log('2. The save data is in a different memory region')
      console.log('3. The personality value is stored differently in memory')
    }

    client.disconnect()

  } catch (error) {
    console.error('\n❌ Error:', error)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  findSaveDataInMemory().catch(console.error)
}

export { findSaveDataInMemory }