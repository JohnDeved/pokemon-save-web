#!/usr/bin/env node

/**
 * Check if save state is properly loaded and trigger save loading if needed
 */

import { MgbaWebSocketClient } from './websocket-client'

async function checkSaveState() {
  console.log('🎮 Save State Loading Check')
  console.log('===========================\n')

  const client = new MgbaWebSocketClient()

  try {
    await client.connect()
    console.log('✅ Connected to mGBA\n')

    // Check game state
    console.log('📊 Checking game state...')
    
    // Try to get game title from ROM header
    const romTitleLua = `
      local title = ""
      for i = 0, 11 do
        local byte = emu:read8(0x080000A0 + i)
        if byte == 0 then break end
        title = title .. string.char(byte)
      end
      return title
    `
    
    try {
      const titleResult = await client.eval(romTitleLua)
      console.log(`   ROM title: "${titleResult.result}"`)
    } catch (error) {
      console.log(`   Could not read ROM title: ${error}`)
    }

    // Check if we can access emulator state
    console.log('\n🎯 Checking emulator access...')
    
    try {
      const emuInfoLua = `
        local info = {}
        if emu then
          info.type = "mgba"
          if emu.getState then
            info.state = emu:getState()
          end
          if emu.getGameTitle then
            info.title = emu:getGameTitle()
          end
        end
        return info
      `
      
      const emuResult = await client.eval(emuInfoLua)
      console.log('   Emulator info:', JSON.stringify(emuResult.result, null, 2))
    } catch (error) {
      console.log(`   Could not get emulator info: ${error}`)
    }

    // Try to trigger save data loading
    console.log('\n💾 Attempting to trigger save loading...')
    
    const loadSaveLua = `
      -- Try to access save-related functions
      local result = {}
      
      -- Check if we can read SRAM
      result.sram_start = emu:read8(0x0E000000)
      
      -- Try to trigger any save loading
      if emu.loadState then
        result.load_attempt = "loadState available"
      end
      
      -- Check for save-related memory patterns
      local found_patterns = 0
      for addr = 0x02000000, 0x02040000, 16 do
        local val = emu:read32(addr)
        if val >= 1 and val <= 6 then
          found_patterns = found_patterns + 1
        end
        if found_patterns >= 5 then break end
      end
      result.found_patterns = found_patterns
      
      return result
    `
    
    const saveResult = await client.eval(loadSaveLua)
    console.log('   Save loading result:', JSON.stringify(saveResult.result, null, 2))

    // Look for specific known values in memory more carefully
    console.log('\n🔍 Detailed memory search for known values...')
    
    const knownValues = [
      { name: 'Party count (1)', value: 1 },
      { name: 'Pokemon personality', value: 0x6ccbfd84 },
      { name: 'OT ID', value: 0xa18b1c9f },
      { name: 'Species ID (252 = TREECKO)', value: 252 },
      { name: 'Level (5)', value: 5 },
      { name: 'Max HP (20)', value: 20 },
      { name: 'Current HP (18)', value: 18 }
    ]
    
    for (const known of knownValues) {
      console.log(`\n   Searching for ${known.name} (${known.value})...`)
      
      const searchLua = `
        local found = {}
        local count = 0
        
        -- Search EWRAM
        for addr = 0x02000000, 0x02040000, 4 do
          local val = emu:read32(addr)
          if val == ${known.value} then
            table.insert(found, string.format("0x%08X", addr))
            count = count + 1
            if count >= 5 then break end
          end
        end
        
        -- Also check as 16-bit values for smaller numbers
        if ${known.value} < 65536 then
          for addr = 0x02000000, 0x02040000, 2 do
            local val = emu:read16(addr)
            if val == ${known.value} then
              table.insert(found, string.format("0x%08X(16)", addr))
              count = count + 1
              if count >= 10 then break end
            end
          end
        end
        
        -- Check as 8-bit values for very small numbers  
        if ${known.value} < 256 then
          for addr = 0x02000000, 0x02040000, 1 do
            local val = emu:read8(addr)
            if val == ${known.value} then
              table.insert(found, string.format("0x%08X(8)", addr))
              count = count + 1
              if count >= 15 then break end
            end
          end
        end
        
        return found
      `
      
      try {
        const searchResult = await client.eval(searchLua)
        const addresses = searchResult.result as string[]
        
        if (addresses.length > 0) {
          console.log(`     Found at: ${addresses.slice(0, 5).join(', ')}${addresses.length > 5 ? '...' : ''}`)
        } else {
          console.log('     Not found in EWRAM')
        }
      } catch (error) {
        console.log(`     Search error: ${error}`)
      }
    }

  } catch (error) {
    console.error('\n❌ Check failed:', error)
  } finally {
    client.disconnect()
  }
}

checkSaveState().catch(console.error)