#!/usr/bin/env tsx
/**
 * Direct WebSocket Test with mGBA
 */

import { WebSocket } from 'ws'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'

async function directWebSocketTest() {
  console.log('🔗 Connecting to mGBA WebSocket...')
  
  const ws = new WebSocket(MGBA_WEBSOCKET_URL)
  
  ws.on('open', () => {
    console.log('✅ WebSocket connected')
    
    // Test 1: Simple expression
    console.log('📤 Test 1: Simple return')
    ws.send('return 42')
  })
  
  let step = 1
  
  ws.on('message', (data) => {
    const msg = data.toString()
    console.log(`📥 Step ${step}: ${msg}`)
    
    if (msg.startsWith('Welcome')) {
      // Skip welcome
      return
    }
    
    step++
    
    if (step === 2) {
      console.log('📤 Test 2: ROM info')
      ws.send(`
        return {
          title = emu:getGameTitle(),
          size = emu:romSize()
        }
      `)
    } else if (step === 3) {
      console.log('📤 Test 3: Simple byte read')
      ws.send(`
        return emu:read8(0x08000000)
      `)
    } else if (step === 4) {
      console.log('📤 Test 4: Pattern search')
      ws.send(`
        local count = 0
        for addr = 0x08000000, 0x08000000 + 10000 do
          if emu:read8(addr) == 0x48 then
            count = count + 1
            if count >= 3 then break end
          end
        end
        return count
      `)
    } else if (step === 5) {
      console.log('📤 Test 5: Complex pattern with address extraction')
      ws.send(`
        -- Find first 48 ?? 68 pattern
        for addr = 0x08000000, 0x08000000 + 100000 - 6 do
          local b1 = emu:read8(addr)
          local b2 = emu:read8(addr + 1)
          local b3 = emu:read8(addr + 2)
          local b4 = emu:read8(addr + 3)
          local b5 = emu:read8(addr + 4)
          local b6 = emu:read8(addr + 5)
          
          if b1 == 0x48 and b3 == 0x68 and b5 == 0x30 then
            -- Found the pattern, try address extraction
            local immediate = b2
            local pc = math.floor((addr + 4) / 4) * 4
            local literalAddr = pc + immediate * 4
            
            if literalAddr >= 0x08000000 and literalAddr < 0x08000000 + emu:romSize() then
              local ab1 = emu:read8(literalAddr)
              local ab2 = emu:read8(literalAddr + 1)
              local ab3 = emu:read8(literalAddr + 2)
              local ab4 = emu:read8(literalAddr + 3)
              
              local address = ab1 + ab2 * 256 + ab3 * 65536 + ab4 * 16777216
              
              return {
                pattern_addr = string.format("0x%08X", addr),
                pattern_bytes = string.format("%02X %02X %02X %02X %02X %02X", b1, b2, b3, b4, b5, b6),
                immediate = immediate,
                pc = string.format("0x%08X", pc),
                literal_addr = string.format("0x%08X", literalAddr),
                extracted_addr = string.format("0x%08X", address),
                is_quetzal_target = (address == 0x020235B8)
              }
            end
          end
        end
        
        return {error = "No pattern found"}
      `)
    } else {
      console.log('🏁 Test complete')
      ws.close()
      process.exit(0)
    }
  })
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error)
    process.exit(1)
  })
  
  setTimeout(() => {
    console.log('⏰ Timeout')
    ws.close()
    process.exit(0)
  }, 30000)
}

directWebSocketTest()