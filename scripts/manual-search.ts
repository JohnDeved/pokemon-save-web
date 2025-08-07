#!/usr/bin/env tsx
/**
 * Manual pattern search to find the Emerald address
 */

import { WebSocket } from 'ws'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'

async function manualSearch() {
  console.log('🔌 Connecting to WebSocket...')
  const ws = new WebSocket(MGBA_WEBSOCKET_URL)
  
  await new Promise((resolve, reject) => {
    ws.on('open', () => {
      console.log('✅ Connected')
      resolve(true)
    })
    ws.on('error', reject)
    setTimeout(() => reject(new Error('Connection timeout')), 10000)
  })
  
  // Search for the Emerald partyData address pattern: EC 44 02 02
  const searchScript = `
local log = function(msg) 
    console:log(msg)
    io.stdout:write("[Search] " .. msg .. "\\n")
    io.stdout:flush()
end

log("Searching for Emerald pattern: EC 44 02 02")
log("ROM: " .. emu:getGameTitle() .. " (" .. emu:romSize() .. " bytes)")

local found = {}
local searchSize = 1024 * 1024
local endAddr = 0x08000000 + searchSize

for addr = 0x08000000, endAddr - 4, 4 do
    local b1 = emu:read8(addr)
    local b2 = emu:read8(addr + 1) 
    local b3 = emu:read8(addr + 2)
    local b4 = emu:read8(addr + 3)
    
    if b1 == 0xEC and b2 == 0x44 and b3 == 0x02 and b4 == 0x02 then
        log(string.format("Found pattern at 0x%08X", addr))
        table.insert(found, addr)
        
        if #found >= 5 then
            log("Found 5 matches, stopping search")
            break
        end
    end
    
    if (addr - 0x08000000) % (100 * 1024) == 0 then
        local percent = math.floor(((addr - 0x08000000) / searchSize) * 100)
        log(string.format("Progress: %d%% (0x%08X)", percent, addr))
    end
end

log("Search complete")
return { 
    success = #found > 0,
    matches = found,
    count = #found,
    message = #found > 0 and "Found " .. #found .. " matches" or "No matches found"
}
`
  
  let messageCount = 0
  const result = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Search timeout'))
    }, 60000)
    
    ws.on('message', (data) => {
      const str = data.toString()
      if (str.startsWith('Welcome')) return
      
      try {
        const response = JSON.parse(str)
        console.log('📥 Final Result:', response)
        clearTimeout(timeout)
        resolve(response.result)
      } catch (error) {
        // Progress/log messages
        console.log('📄', str)
        messageCount++
      }
    })
    
    ws.send(searchScript)
  })
  
  ws.close()
  
  console.log('\n📊 Search Results:')
  console.log(JSON.stringify(result, null, 2))
}

manualSearch().catch(console.error)