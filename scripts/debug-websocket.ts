#!/usr/bin/env tsx
/**
 * Simple WebSocket test to debug the Universal Pattern validation
 */

import { WebSocket } from 'ws'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'

async function testWebSocket() {
  console.log('🔌 Connecting to mGBA WebSocket...')
  
  const ws = new WebSocket(MGBA_WEBSOCKET_URL)
  
  ws.on('open', () => {
    console.log('✅ WebSocket connected')
    
    // Test simple lua execution
    console.log('🧪 Testing simple Lua execution...')
    ws.send('return "Hello from Lua!"')
  })
  
  ws.on('message', (data) => {
    const rawData = data.toString()
    console.log('📨 Raw data received:', rawData)
    
    // Skip welcome message
    if (rawData.startsWith('Welcome to')) {
      console.log('👋 Welcome message received, waiting for next message...')
      return
    }
    
    try {
      const response = JSON.parse(rawData)
      console.log('📥 Parsed response:', response)
      
      if (response.result === "Hello from Lua!") {
        console.log('✅ Basic Lua execution working')
        
        // Test emulator availability
        console.log('🧪 Testing emulator availability...')
        ws.send('return emu and "available" or "not available"')
      } else if (response.result === "available") {
        console.log('✅ Emulator available')
        
        // Test game title detection
        console.log('🎮 Testing game title detection...')
        ws.send('return emu:getGameTitle()')
      } else if (typeof response.result === 'string' && response.result.includes('EMER')) {
        console.log('✅ Game title detected:', response.result)
        
        // Test ROM size
        console.log('📏 Testing ROM size...')
        ws.send('return emu:romSize()')
      } else if (typeof response.result === 'number' && response.result > 0) {
        console.log('✅ ROM size:', response.result, 'bytes')
        
        // Test simple memory read
        console.log('🧪 Testing memory read...')
        ws.send('return emu:read8(0x08000000)')
      } else if (typeof response.result === 'number' && response.result >= 0) {
        console.log('✅ Memory read working, first byte:', `0x${response.result.toString(16).toUpperCase()}`)
        
        // Now test a simple pattern search
        console.log('🔍 Testing simple pattern search...')
        ws.send(`
local count = 0
for addr = 0x08000000, 0x08001000 do
  if emu:read8(addr) == 0x48 then
    count = count + 1
  end
end
return count
        `)
      } else {
        console.log('📊 Final result - 0x48 pattern count:', response.result)
        console.log('✅ All basic tests passed!')
        ws.close()
      }
      
      if (response.error) {
        console.error('❌ Lua error:', response.error)
        ws.close()
      }
    } catch (error) {
      console.error('❌ Failed to parse response:', error)
      console.log('Raw data:', rawData)
      ws.close()
    }
  })
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error)
  })
  
  ws.on('close', () => {
    console.log('🔌 WebSocket closed')
    process.exit(0)
  })
  
  // Timeout after 10 seconds
  setTimeout(() => {
    console.error('❌ Test timeout')
    ws.close()
  }, 10000)
}

testWebSocket().catch(console.error)