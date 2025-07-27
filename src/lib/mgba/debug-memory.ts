#!/usr/bin/env node

/**
 * Debug memory contents to understand what's actually loaded
 */

import { MgbaWebSocketClient } from './websocket-client'

async function debugMemory() {
  console.log('🔍 Memory Debug Session')
  console.log('=====================\n')

  const client = new MgbaWebSocketClient()

  try {
    await client.connect()
    console.log('✅ Connected to mGBA\n')

    // Check ROM title to verify game is loaded
    console.log('🎮 Checking game title...')
    try {
      const titleLua = `
        local title = ""
        for i = 0, 11 do
          local byte = emu:read8(0x080000A0 + i)
          if byte == 0 then break end
          title = title .. string.char(byte)
        end
        return title
      `
      const titleResponse = await client.eval(titleLua)
      console.log(`   Game title: "${titleResponse.result}"`)
    } catch (error) {
      console.log(`   Could not read game title: ${error}`)
    }

    // Check for save state markers
    console.log('\n💾 Checking save state markers...')
    
    // Look for patterns that might indicate save data
    const patterns = [
      { name: 'SRAM area', start: 0x0E000000, size: 0x10000 },
      { name: 'EWRAM start', start: 0x02000000, size: 0x1000 },
      { name: 'EWRAM middle', start: 0x02020000, size: 0x1000 },
      { name: 'IWRAM', start: 0x03000000, size: 0x1000 }
    ]
    
    for (const pattern of patterns) {
      console.log(`\n   Checking ${pattern.name} (0x${pattern.start.toString(16)})...`)
      
      try {
        // Read first few bytes
        const bytes = []
        for (let i = 0; i < 16; i++) {
          bytes.push(await client.readByte(pattern.start + i))
        }
        
        console.log(`     First 16 bytes: ${bytes.map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ')}`)
        
        // Look for non-zero data
        let nonZeroCount = 0
        let firstNonZero = -1
        
        for (let i = 0; i < Math.min(pattern.size, 1024); i += 4) {
          const value = await client.readDWord(pattern.start + i)
          if (value !== 0) {
            nonZeroCount++
            if (firstNonZero === -1) {
              firstNonZero = i
            }
          }
          if (i % 256 === 0) {
            process.stdout.write('.')
          }
        }
        
        console.log(`\n     Non-zero DWORDs in first 1KB: ${nonZeroCount}`)
        if (firstNonZero !== -1) {
          console.log(`     First non-zero at offset: 0x${firstNonZero.toString(16)}`)
        }
        
      } catch (error) {
        console.log(`     Error reading: ${error}`)
      }
    }

    // Search for specific byte patterns that might be save data
    console.log('\n🔍 Searching for Pokemon-like patterns...')
    
    // Look for party count patterns (values 1-6 followed by Pokemon data)
    const ewramStart = 0x02000000
    const ewramEnd = 0x02040000
    
    console.log('   Scanning for party count values (1-6)...')
    let foundPatterns = 0
    
    for (let addr = ewramStart; addr < ewramEnd; addr += 16) {
      try {
        const value = await client.readDWord(addr)
        
        if (value >= 1 && value <= 6) {
          // Check if this could be a party count by looking at following data
          const nextValue = await client.readDWord(addr + 4)
          const afterValue = await client.readDWord(addr + 8)
          
          console.log(`     Found value ${value} at 0x${addr.toString(16)}, next: 0x${nextValue.toString(16)}, after: 0x${afterValue.toString(16)}`)
          foundPatterns++
          
          if (foundPatterns >= 10) break // Limit output
        }
      } catch (error) {
        continue
      }
      
      if ((addr - ewramStart) % 0x10000 === 0) {
        process.stdout.write('.')
      }
    }
    
    console.log(`\n   Found ${foundPatterns} potential party count patterns`)

    // Check if there's any data that looks like Pokemon character encoding
    console.log('\n📝 Searching for Pokemon character strings...')
    
    let stringPatterns = 0
    
    for (let addr = ewramStart; addr < ewramEnd; addr += 16) {
      try {
        const bytes = []
        for (let i = 0; i < 8; i++) {
          bytes.push(await client.readByte(addr + i))
        }
        
        // Check if this looks like a Pokemon character string
        let validChars = 0
        for (const byte of bytes) {
          if (byte === 0 || byte === 0xFF) break
          if ((byte >= 0xBB && byte <= 0xD4) || // A-Z
              (byte >= 0xD5 && byte <= 0xEE) || // a-z
              (byte >= 0xA1 && byte <= 0xAA)) { // 0-9
            validChars++
          }
        }
        
        if (validChars >= 3) {
          let decoded = ''
          for (const byte of bytes) {
            if (byte === 0 || byte === 0xFF) break
            if (byte >= 0xBB && byte <= 0xD4) {
              decoded += String.fromCharCode(byte - 0xBB + 65)
            } else if (byte >= 0xD5 && byte <= 0xEE) {
              decoded += String.fromCharCode(byte - 0xD5 + 97)
            } else if (byte >= 0xA1 && byte <= 0xAA) {
              decoded += String.fromCharCode(byte - 0xA1 + 48)
            } else {
              decoded += '?'
            }
          }
          
          console.log(`     Found string at 0x${addr.toString(16)}: "${decoded}"`)
          stringPatterns++
          
          if (stringPatterns >= 10) break // Limit output
        }
      } catch (error) {
        continue
      }
      
      if ((addr - ewramStart) % 0x10000 === 0) {
        process.stdout.write('.')
      }
    }
    
    console.log(`\n   Found ${stringPatterns} potential Pokemon strings`)

  } catch (error) {
    console.error('\n❌ Debug failed:', error)
  } finally {
    client.disconnect()
  }
}

debugMemory().catch(console.error)