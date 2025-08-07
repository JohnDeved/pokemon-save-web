#!/usr/bin/env tsx
/**
 * Working Universal Pattern Test 
 * Tests the patterns step by step with proper debugging
 */

import { WebSocket } from 'ws'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'

async function testUniversalPatterns() {
  console.log('🔌 Connecting to mGBA WebSocket...')
  
  const ws = new WebSocket(MGBA_WEBSOCKET_URL)
  
  return new Promise((resolve, reject) => {
    let testStep = 0
    let connected = false
    
    ws.on('open', () => {
      console.log('✅ WebSocket connected')
      connected = true
      
      // Start first test
      console.log('🧪 Step 1: Testing basic connectivity...')
      ws.send('return { rom_title = emu:getGameTitle(), rom_size = emu:romSize(), first_byte = emu:read8(0x08000000) }')
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
        
        if (testStep === 0) {
          // Basic connectivity test result
          const info = response.result
          console.log('✅ Basic info:', info)
          console.log(`   ROM: ${info.rom_title}`)
          console.log(`   Size: ${info.rom_size} bytes`)
          console.log(`   First byte: 0x${info.first_byte.toString(16).toUpperCase()}`)
          
          // Determine game variant
          const title = info.rom_title.toLowerCase()
          const variant = title.includes('emer') ? 'emerald' : 
                         title.includes('quetzal') ? 'quetzal' : 'unknown'
          console.log(`   Variant: ${variant}`)
          
          testStep = 1
          console.log('\n🔍 Step 2: Testing THUMB pattern (48 ?? 68 ?? 30 ??)...')
          ws.send(`
local function findThumbPattern()
  local matches = {}
  local startAddr = 0x08000000
  local endAddr = startAddr + 1024 * 1024 -- Search first 1MB for speed
  
  for addr = startAddr, endAddr - 5 do
    local b1 = emu:read8(addr)
    local b3 = emu:read8(addr + 2)
    local b5 = emu:read8(addr + 4)
    
    if b1 == 0x48 and b3 == 0x68 and b5 == 0x30 then
      table.insert(matches, addr)
      if #matches >= 5 then break end -- Limit to 5 matches for speed
    end
  end
  
  return matches
end

return findThumbPattern()
          `)
        } else if (testStep === 1) {
          // THUMB pattern results
          const thumbMatches = response.result
          console.log(`✅ THUMB pattern found ${thumbMatches.length} matches:`)
          for (let i = 0; i < Math.min(thumbMatches.length, 5); i++) {
            console.log(`   Match ${i + 1}: 0x${thumbMatches[i].toString(16).toUpperCase()}`)
          }
          
          if (thumbMatches.length > 0) {
            testStep = 2
            console.log('\n🧮 Step 3: Extracting addresses from all THUMB matches...')
            ws.send(`
local function extractAllThumbAddresses(matches)
  local results = {}
  for i, matchAddr in ipairs(matches) do
    local instruction = emu:read8(matchAddr + 1)
    local immediate = instruction
    local pc = ((matchAddr) & ~1) + 4
    local literalAddr = (pc & ~3) + (immediate * 4)
    
    local address = nil
    if literalAddr >= 0x08000000 and literalAddr < 0x08000000 + emu:romSize() then
      local b1 = emu:read8(literalAddr)
      local b2 = emu:read8(literalAddr + 1)
      local b3 = emu:read8(literalAddr + 2)
      local b4 = emu:read8(literalAddr + 3)
      address = b1 + (b2 << 8) + (b3 << 16) + (b4 << 24)
    end
    
    table.insert(results, {
      match_addr = matchAddr,
      instruction = instruction,
      literal_addr = literalAddr,
      extracted_addr = address
    })
  end
  return results
end

return extractAllThumbAddresses({${thumbMatches.join(', ')}})
            `)
          } else {
            testStep = 3
            console.log('\n💪 No THUMB matches, testing ARM pattern...')
            testARMPattern(ws)
          }
        } else if (testStep === 2) {
          // THUMB extraction results for all matches
          const extractions = response.result
          console.log('✅ THUMB address extraction results:')
          
          const expectedEmerald = 0x020244EC
          const expectedQuetzal = 0x020235B8
          let foundTarget = false
          
          for (let i = 0; i < extractions.length; i++) {
            const extraction = extractions[i]
            console.log(`\n   Match ${i + 1}:`)
            console.log(`     Address: 0x${extraction.match_addr.toString(16).toUpperCase()}`)
            console.log(`     Instruction: 0x${extraction.instruction.toString(16).toUpperCase()}`)
            console.log(`     Literal addr: 0x${extraction.literal_addr.toString(16).toUpperCase()}`)
            
            if (extraction.extracted_addr) {
              console.log(`     Extracted: 0x${extraction.extracted_addr.toString(16).toUpperCase()}`)
              
              if (extraction.extracted_addr === expectedEmerald) {
                console.log('     🎉 SUCCESS: Found Emerald partyData address!')
                foundTarget = true
              } else if (extraction.extracted_addr === expectedQuetzal) {
                console.log('     🎉 SUCCESS: Found Quetzal partyData address!')
                foundTarget = true
              }
            } else {
              console.log('     ❌ No address extracted')
            }
          }
          
          if (!foundTarget) {
            console.log(`\n⚠️  No matches found for expected addresses:`)
            console.log(`   Expected Emerald: 0x${expectedEmerald.toString(16).toUpperCase()}`)
            console.log(`   Expected Quetzal: 0x${expectedQuetzal.toString(16).toUpperCase()}`)
          }
          
          testStep = 3
          console.log('\n💪 Step 4: Testing ARM patterns...')
          testARMPattern(ws)
        } else if (testStep === 3) {
          // ARM pattern results
          const armResults = response.result
          console.log('✅ ARM pattern test completed:')
          console.log(`   Emerald pattern matches: ${armResults.emerald_matches}`)
          console.log(`   Quetzal pattern matches: ${armResults.quetzal_matches}`)
          
          console.log('\n🎉 Universal Pattern test completed!')
          ws.close()
          resolve(true)
        }
      } catch (error) {
        console.error('❌ Failed to parse response:', error)
        console.log('Raw data:', rawData)
        ws.close()
        reject(error)
      }
    })
    
    function testARMPattern(ws: WebSocket) {
      ws.send(`
local function findARMPatterns()
  local emeraldMatches = 0
  local quetzalMatches = 0
  local startAddr = 0x08000000
  local endAddr = startAddr + 1024 * 1024 -- Search first 1MB
  
  for addr = startAddr, endAddr - 11 do
    local b1 = emu:read8(addr)
    local b4 = emu:read8(addr + 3)
    local b5 = emu:read8(addr + 4)
    local b6 = emu:read8(addr + 5)
    local b9 = emu:read8(addr + 8)
    local b10 = emu:read8(addr + 9)
    
    -- Emerald pattern: E0 ?? ?? 64 E5 9F ?? ?? E0 8? ?? ??
    if b1 == 0xE0 and b4 == 0x64 and b5 == 0xE5 and b6 == 0x9F and b9 == 0xE0 and (b10 & 0xF0) == 0x80 then
      emeraldMatches = emeraldMatches + 1
    end
    
    -- Quetzal pattern: E0 ?? ?? 68 E5 9F ?? ?? E0 8? ?? ??
    if b1 == 0xE0 and b4 == 0x68 and b5 == 0xE5 and b6 == 0x9F and b9 == 0xE0 and (b10 & 0xF0) == 0x80 then
      quetzalMatches = quetzalMatches + 1
    end
  end
  
  return {
    emerald_matches = emeraldMatches,
    quetzal_matches = quetzalMatches
  }
end

return findARMPatterns()
      `)
    }
    
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
    }, 60000) // 60 second timeout
  })
}

async function main() {
  try {
    await testUniversalPatterns()
    console.log('✅ Universal Pattern test completed successfully')
  } catch (error) {
    console.error('❌ Universal Pattern test failed:', error)
    process.exit(1)
  }
}

main()