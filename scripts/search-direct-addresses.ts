#!/usr/bin/env tsx
/**
 * Direct Address Search Test
 * Search for the expected addresses directly in the ROM to verify they exist
 */

import { WebSocket } from 'ws'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'

async function searchDirectAddresses() {
  console.log('🔌 Connecting to mGBA WebSocket...')
  
  const ws = new WebSocket(MGBA_WEBSOCKET_URL)
  
  return new Promise((resolve, reject) => {
    let connected = false
    
    ws.on('open', () => {
      console.log('✅ WebSocket connected')
      connected = true
      
      console.log('🔍 Searching for target addresses directly in ROM...')
      ws.send(`
local function searchDirectAddresses()
  local emeraldTarget = 0x020244EC
  local quetzalTarget = 0x020235B8
  local emeraldBytes = {
    emeraldTarget & 0xFF,
    (emeraldTarget >> 8) & 0xFF,
    (emeraldTarget >> 16) & 0xFF,
    (emeraldTarget >> 24) & 0xFF
  }
  local quetzalBytes = {
    quetzalTarget & 0xFF,
    (quetzalTarget >> 8) & 0xFF,
    (quetzalTarget >> 16) & 0xFF,
    (quetzalTarget >> 24) & 0xFF
  }
  
  local emeraldMatches = {}
  local quetzalMatches = {}
  
  -- Search first 4MB of ROM
  for addr = 0x08000000, 0x08000000 + 4 * 1024 * 1024 - 4 do
    local b1 = emu:read8(addr)
    local b2 = emu:read8(addr + 1)
    local b3 = emu:read8(addr + 2)
    local b4 = emu:read8(addr + 3)
    
    -- Check for Emerald address
    if b1 == emeraldBytes[1] and b2 == emeraldBytes[2] and 
       b3 == emeraldBytes[3] and b4 == emeraldBytes[4] then
      table.insert(emeraldMatches, addr)
    end
    
    -- Check for Quetzal address
    if b1 == quetzalBytes[1] and b2 == quetzalBytes[2] and 
       b3 == quetzalBytes[3] and b4 == quetzalBytes[4] then
      table.insert(quetzalMatches, addr)
    end
    
    -- Limit matches
    if #emeraldMatches >= 10 and #quetzalMatches >= 10 then
      break
    end
  end
  
  return {
    emerald_target = string.format("0x%08X", emeraldTarget),
    quetzal_target = string.format("0x%08X", quetzalTarget),
    emerald_matches = emeraldMatches,
    quetzal_matches = quetzalMatches,
    rom_title = emu:getGameTitle()
  }
end

return searchDirectAddresses()
      `)
    })
    
    ws.on('message', (data) => {
      const rawData = data.toString()
      
      // Skip welcome message
      if (rawData.startsWith('Welcome to')) {
        return
      }
      
      try {
        const response = JSON.parse(rawData)
        
        if (response.error) {
          console.error('❌ Lua error:', response.error)
          ws.close()
          reject(new Error(response.error))
          return
        }
        
        const result = response.result
        console.log('✅ Direct address search completed:')
        console.log(`   ROM: ${result.rom_title}`)
        console.log(`   Emerald target: ${result.emerald_target}`)
        console.log(`   Quetzal target: ${result.quetzal_target}`)
        console.log(`   Emerald matches found: ${result.emerald_matches.length}`)
        console.log(`   Quetzal matches found: ${result.quetzal_matches.length}`)
        
        if (result.emerald_matches.length > 0) {
          console.log('\n🎯 Emerald address locations:')
          for (let i = 0; i < Math.min(result.emerald_matches.length, 5); i++) {
            console.log(`   ${i + 1}. 0x${result.emerald_matches[i].toString(16).toUpperCase()}`)
          }
        }
        
        if (result.quetzal_matches.length > 0) {
          console.log('\n🎯 Quetzal address locations:')
          for (let i = 0; i < Math.min(result.quetzal_matches.length, 5); i++) {
            console.log(`   ${i + 1}. 0x${result.quetzal_matches[i].toString(16).toUpperCase()}`)
          }
        }
        
        if (result.emerald_matches.length === 0 && result.quetzal_matches.length === 0) {
          console.log('\n❌ No direct address matches found!')
          console.log('   This means the expected addresses are not stored as literal values in the ROM.')
          console.log('   The Universal Patterns may need to be revised.')
        } else {
          console.log('\n✅ Direct addresses found! Now we can analyze the code around them.')
        }
        
        ws.close()
        resolve(result)
      } catch (error) {
        console.error('❌ Failed to parse response:', error)
        console.log('Raw data:', rawData)
        ws.close()
        reject(error)
      }
    })
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error)
      if (!connected) {
        reject(error)
      }
    })
    
    ws.on('close', () => {
      console.log('🔌 WebSocket closed')
      if (!connected) {
        reject(new Error('Connection closed before opening'))
      }
    })
    
    setTimeout(() => {
      if (!connected) {
        console.error('❌ Connection timeout')
        reject(new Error('Connection timeout'))
      } else {
        console.error('❌ Test timeout')
        ws.close()
        reject(new Error('Test timeout'))
      }
    }, 60000)
  })
}

async function main() {
  try {
    await searchDirectAddresses()
    console.log('✅ Direct address search completed')
  } catch (error) {
    console.error('❌ Direct address search failed:', error)
    process.exit(1)
  }
}

main()