#!/usr/bin/env node

/**
 * Efficient memory scanner using batched reads
 * Find save data without prior knowledge using pokeemerald analysis
 */

import { MgbaWebSocketClient } from './websocket-client'
import { MEMORY_REGIONS } from './memory-mapping'

async function efficientSaveDataScan() {
  console.log('🚀 Efficient Save Data Scanner')
  console.log('==============================\n')

  const client = new MgbaWebSocketClient()

  try {
    console.log('🌐 Connecting to mGBA...')
    await client.connect()
    console.log('✅ Connected to mGBA\n')

    // Strategy: Use larger memory reads to efficiently scan for save data patterns
    console.log('🔍 Scanning EWRAM for save data patterns...')
    
    const ewramStart = MEMORY_REGIONS.EWRAM_BASE
    const ewramSize = 0x40000 // 256KB
    
    // Read large chunks and scan in memory
    const chunkSize = 0x1000 // 4KB chunks
    let saveBlock1Addr: number | null = null
    let saveBlock2Addr: number | null = null
    
    console.log('  Reading EWRAM in 4KB chunks...')
    
    for (let offset = 0; offset < ewramSize; offset += chunkSize) {
      const addr = ewramStart + offset
      const progress = (offset / ewramSize * 100).toFixed(1)
      process.stdout.write(`\r  Progress: ${progress}% (0x${addr.toString(16)})`)
      
      try {
        // Read chunk using Lua script that returns multiple values
        const luaCode = `
          local data = {}
          for i = 0, ${chunkSize - 1}, 4 do
            local addr = ${addr} + i
            local value = emu:read32(addr)
            table.insert(data, value)
          end
          return data
        `
        
        const response = await client.eval(luaCode)
        if (response.error) {
          continue // Skip unreadable regions
        }
        
        const chunkData = response.result as number[]
        
        // Scan for SaveBlock1 patterns in the chunk
        for (let i = 0; i < chunkData.length - 200; i++) { // Need at least 800 bytes for party data
          const currentAddr = addr + (i * 4)
          
          // Look for reasonable party count (0-6) at party count offset (0x234)
          const partyCountIndex = Math.floor(0x234 / 4)
          if (i + partyCountIndex < chunkData.length) {
            const partyCount = chunkData[i + partyCountIndex]
            
            if (partyCount >= 0 && partyCount <= 6) {
              // Check for valid Pokemon data pattern
              const pokemonStartIndex = Math.floor(0x238 / 4)
              if (i + pokemonStartIndex + 20 < chunkData.length) {
                const personality = chunkData[i + pokemonStartIndex]
                const otId = chunkData[i + pokemonStartIndex + 1]
                
                // Personality should be non-zero, OT ID should be reasonable
                if (personality !== 0 && personality !== 0xFFFFFFFF && 
                    otId !== 0 && otId !== 0xFFFFFFFF && otId < 0x10000000) {
                  
                  // Additional validation: check level byte
                  const levelAddr = currentAddr + 0x238 + 0x54
                  const level = await client.readByte(levelAddr)
                  
                  if (level > 0 && level <= 100) {
                    console.log(`\n  🎯 Found potential SaveBlock1 at 0x${currentAddr.toString(16)}`)
                    console.log(`     Party count: ${partyCount}, Pokemon level: ${level}`)
                    saveBlock1Addr = currentAddr
                    break
                  }
                }
              }
            }
          }
        }
        
        if (saveBlock1Addr) break
        
      } catch (error) {
        // Skip error chunks
        continue
      }
    }
    
    console.log() // New line after progress
    
    if (!saveBlock1Addr) {
      console.log('❌ Could not find SaveBlock1 structure')
      return
    }
    
    // Now search for SaveBlock2 around SaveBlock1
    console.log('\n🔍 Searching for SaveBlock2...')
    
    const searchRange = 0x20000 // 128KB around SaveBlock1
    const searchStart = Math.max(ewramStart, saveBlock1Addr - searchRange)
    const searchEnd = Math.min(ewramStart + ewramSize, saveBlock1Addr + searchRange)
    
    for (let addr = searchStart; addr < searchEnd; addr += 16) {
      try {
        // Read potential player name area
        const nameBytes = []
        for (let i = 0; i < 8; i++) {
          nameBytes.push(await client.readByte(addr + i))
        }
        
        // Check if this looks like a valid Pokemon character string
        let validName = true
        let nonZeroCount = 0
        
        for (let i = 0; i < 8; i++) {
          const byte = nameBytes[i]
          if (byte === 0xFF || byte === 0) break // String terminator
          
          nonZeroCount++
          // Check if byte is in valid Pokemon character ranges
          const isValid = 
            (byte >= 0xBB && byte <= 0xD4) || // A-Z
            (byte >= 0xD5 && byte <= 0xEE) || // a-z
            (byte >= 0xA1 && byte <= 0xAA) || // 0-9
            (byte >= 0x01 && byte <= 0x1F)    // Special chars
          
          if (!isValid) {
            validName = false
            break
          }
        }
        
        if (validName && nonZeroCount >= 3) {
          // Verify with play time
          const hours = await client.readWord(addr + 0x0E)
          const minutes = await client.readByte(addr + 0x10)
          const seconds = await client.readByte(addr + 0x11)
          
          if (hours <= 999 && minutes < 60 && seconds < 60) {
            console.log(`  🎯 Found potential SaveBlock2 at 0x${addr.toString(16)}`)
            console.log(`     Play time: ${hours}:${minutes}:${seconds}`)
            saveBlock2Addr = addr
            break
          }
        }
      } catch (error) {
        continue
      }
    }
    
    // Analyze results
    if (saveBlock1Addr && saveBlock2Addr) {
      console.log('\n✅ Save data successfully located!')
      console.log(`   SaveBlock1: 0x${saveBlock1Addr.toString(16)}`)
      console.log(`   SaveBlock2: 0x${saveBlock2Addr.toString(16)}`)
      
      // Test reading actual data
      console.log('\n📊 Testing data access...')
      
      const partyCount = await client.readDWord(saveBlock1Addr + 0x234)
      console.log(`   Party count: ${partyCount}`)
      
      if (partyCount > 0 && partyCount <= 6) {
        const pokemonAddr = saveBlock1Addr + 0x238
        const personality = await client.readDWord(pokemonAddr)
        const level = await client.readByte(pokemonAddr + 0x54)
        
        console.log(`   First Pokemon - Personality: 0x${personality.toString(16)}, Level: ${level}`)
      }
      
      const nameBytes = []
      for (let i = 0; i < 8; i++) {
        nameBytes.push(await client.readByte(saveBlock2Addr + i))
      }
      
      let playerName = ''
      for (const byte of nameBytes) {
        if (byte === 0xFF || byte === 0) break
        if (byte >= 0xBB && byte <= 0xD4) {
          playerName += String.fromCharCode(byte - 0xBB + 65) // A-Z
        } else if (byte >= 0xD5 && byte <= 0xEE) {
          playerName += String.fromCharCode(byte - 0xD5 + 97) // a-z
        } else {
          playerName += '?'
        }
      }
      
      console.log(`   Player name: "${playerName}"`)
      
      console.log('\n🎯 Memory parser addresses found:')
      console.log(`   export const DISCOVERED_ADDRESSES = {`)
      console.log(`     saveBlock1: 0x${saveBlock1Addr.toString(16)},`)
      console.log(`     saveBlock2: 0x${saveBlock2Addr.toString(16)},`)
      console.log(`     partyCount: 0x${(saveBlock1Addr + 0x234).toString(16)},`)
      console.log(`     partyPokemon: 0x${(saveBlock1Addr + 0x238).toString(16)},`)
      console.log(`     playerName: 0x${saveBlock2Addr.toString(16)}`)
      console.log(`   }`)
      
    } else {
      console.log('\n❌ Could not locate all save data structures')
      if (saveBlock1Addr) {
        console.log(`   SaveBlock1 found: 0x${saveBlock1Addr.toString(16)}`)
      }
      if (saveBlock2Addr) {
        console.log(`   SaveBlock2 found: 0x${saveBlock2Addr.toString(16)}`)
      }
    }

  } catch (error) {
    console.error('\n❌ Scan failed:', error)
  } finally {
    client.disconnect()
  }
}

efficientSaveDataScan().catch(console.error)