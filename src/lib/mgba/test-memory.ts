#!/usr/bin/env node

/**
 * Simple test to find what data is actually loaded in mGBA memory
 */

import { MgbaWebSocketClient } from './websocket-client'

async function testMemoryAccess() {
  console.log('🧪 Testing mGBA Memory Access')
  console.log('===============================\n')

  try {
    const client = new MgbaWebSocketClient()
    await client.connect()
    console.log('✅ Connected to mGBA\n')

    // Wait longer for save state to fully load
    console.log('⏳ Waiting for save state to fully load...')
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Let's check some known memory regions to see what data is actually available
    console.log('🔍 Checking various memory regions...\n')

    // Test basic EWRAM access
    const ewramBase = 0x02000000
    console.log(`EWRAM base (0x${ewramBase.toString(16)}):`)
    for (let i = 0; i < 16; i += 4) {
      try {
        const value = await client.readDWord(ewramBase + i)
        console.log(`  +0x${i.toString(16).padStart(2, '0')}: 0x${value.toString(16).padStart(8, '0')}`)
      } catch (error) {
        console.log(`  +0x${i.toString(16).padStart(2, '0')}: Error - ${error}`)
      }
    }

    // Let's try to find any non-zero data in EWRAM
    console.log('\n🔍 Scanning for first non-zero data in EWRAM...')
    let foundData = false
    for (let addr = ewramBase; addr < ewramBase + 0x10000 && !foundData; addr += 4) {
      try {
        const value = await client.readDWord(addr)
        if (value !== 0) {
          console.log(`First non-zero value: 0x${value.toString(16)} at 0x${addr.toString(16)}`)
          
          // Read some context around this address
          console.log('Context:')
          for (let i = -16; i <= 16; i += 4) {
            try {
              const contextValue = await client.readDWord(addr + i)
              const marker = (i === 0) ? ' <-- HERE' : ''
              console.log(`  0x${(addr + i).toString(16)}: 0x${contextValue.toString(16).padStart(8, '0')}${marker}`)
            } catch (error) {
              console.log(`  0x${(addr + i).toString(16)}: Error`)
            }
          }
          foundData = true
        }
      } catch (error) {
        // Skip unreadable addresses
        continue
      }
    }

    // Let's also try to check if there are any known GBA memory patterns
    console.log('\n🔍 Checking for GBA ROM signature...')
    const romBase = 0x08000000
    try {
      const romSignature = await client.readDWord(romBase)
      console.log(`ROM base signature: 0x${romSignature.toString(16)}`)
    } catch (error) {
      console.log(`ROM access error: ${error}`)
    }

    // Check if we can trigger a save operation
    console.log('\n💾 Attempting to trigger save operation...')
    try {
      // Try to call some mGBA functions to see what's available
      const response = await client.eval('return type(emu)')
      console.log(`emu type: ${response.result}`)
      
      const response2 = await client.eval('return emu:getGameTitle()')
      console.log(`Game title: ${response2.result}`)
      
      // See what methods are available on emu
      const response3 = await client.eval(`
        local methods = {}
        for k, v in pairs(getmetatable(emu).__index or {}) do
          if type(v) == "function" then
            table.insert(methods, k)
          end
        end
        table.sort(methods)
        return table.concat(methods, ", ")
      `)
      console.log(`Available emu methods: ${response3.result}`)

    } catch (error) {
      console.log(`Lua inspection error: ${error}`)
    }

    client.disconnect()

  } catch (error) {
    console.error('\n❌ Error:', error)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testMemoryAccess().catch(console.error)
}

export { testMemoryAccess }