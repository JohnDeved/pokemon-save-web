#!/usr/bin/env node

/**
 * Simple memory test with basic operations
 */

import { MgbaWebSocketClient } from './websocket-client'

async function simpleMemoryTest() {
  console.log('🧪 Simple Memory Test')
  console.log('====================\n')

  const client = new MgbaWebSocketClient()

  try {
    await client.connect()
    console.log('✅ Connected\n')

    // Test 1: Basic memory reads
    console.log('📖 Testing basic memory reads...')
    
    const addresses = [
      0x02000000, // EWRAM start
      0x02010000, // EWRAM middle
      0x02020000, // EWRAM later
      0x03000000, // IWRAM
      0x08000000  // ROM
    ]
    
    for (const addr of addresses) {
      try {
        const value = await client.readDWord(addr)
        console.log(`   0x${addr.toString(16)}: 0x${value.toString(16)}`)
      } catch (error) {
        console.log(`   0x${addr.toString(16)}: Error - ${error}`)
      }
    }

    // Test 2: Search for our known Pokemon personality
    console.log('\n🔍 Searching for Pokemon personality 0x6ccbfd84...')
    
    const targetPersonality = 0x6ccbfd84
    let found = false
    
    // Search EWRAM in 1KB chunks
    for (let baseAddr = 0x02000000; baseAddr < 0x02040000; baseAddr += 0x400) {
      for (let offset = 0; offset < 0x400; offset += 4) {
        const addr = baseAddr + offset
        try {
          const value = await client.readDWord(addr)
          if (value === targetPersonality) {
            console.log(`   🎯 Found personality at 0x${addr.toString(16)}!`)
            
            // Check surrounding data
            console.log('   Context:')
            for (let i = -16; i <= 16; i += 4) {
              const contextAddr = addr + i
              try {
                const contextValue = await client.readDWord(contextAddr)
                const marker = i === 0 ? ' <-- TARGET' : ''
                console.log(`     0x${contextAddr.toString(16)}: 0x${contextValue.toString(16)}${marker}`)
              } catch (error) {
                console.log(`     0x${contextAddr.toString(16)}: Error`)
              }
            }
            
            found = true
            break
          }
        } catch (error) {
          // Skip unreadable addresses
          continue
        }
      }
      
      if (found) break
      
      // Progress indicator
      const progress = ((baseAddr - 0x02000000) / 0x40000 * 100).toFixed(1)
      process.stdout.write(`\r   Progress: ${progress}%`)
    }
    
    if (!found) {
      console.log('\n   ❌ Pokemon personality not found in EWRAM')
      
      // Try searching for party count of 1
      console.log('\n🔍 Searching for party count (1)...')
      
      let partyCountFound = false
      for (let baseAddr = 0x02000000; baseAddr < 0x02040000; baseAddr += 0x400) {
        for (let offset = 0; offset < 0x400; offset += 4) {
          const addr = baseAddr + offset
          try {
            const value = await client.readDWord(addr)
            if (value === 1) {
              // Check if this could be followed by Pokemon data
              try {
                const nextValue = await client.readDWord(addr + 4)
                if (nextValue !== 0 && nextValue !== 0xFFFFFFFF) {
                  console.log(`\n   Found party count 1 at 0x${addr.toString(16)}, next value: 0x${nextValue.toString(16)}`)
                  partyCountFound = true
                  
                  if (partyCountFound) break
                }
              } catch (error) {
                // Skip
              }
            }
          } catch (error) {
            continue
          }
        }
        
        if (partyCountFound) break
        
        const progress = ((baseAddr - 0x02000000) / 0x40000 * 100).toFixed(1)
        process.stdout.write(`\r   Progress: ${progress}%`)
      }
      
      if (!partyCountFound) {
        console.log('\n   ❌ Party count also not found')
      }
    }
    
    console.log()

  } catch (error) {
    console.error('\n❌ Test failed:', error)
  } finally {
    client.disconnect()
  }
}

simpleMemoryTest().catch(console.error)