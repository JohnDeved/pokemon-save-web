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
    try {
      const response = JSON.parse(data.toString())
      console.log('📥 Response:', response)
      
      if (response.result === "Hello from Lua!") {
        console.log('✅ Basic Lua execution working')
        
        // Test game title detection
        console.log('🎮 Testing game title detection...')
        ws.send('return emu:getGameTitle()')
      } else if (typeof response.result === 'string' && response.result.includes('EMER')) {
        console.log('✅ Game title detection working:', response.result)
        
        // Test ROM size
        console.log('📏 Testing ROM size...')
        ws.send('return emu:romSize()')
      } else if (typeof response.result === 'number' && response.result > 0) {
        console.log('✅ ROM size working:', response.result, 'bytes')
        
        // Test simple memory read
        console.log('🧪 Testing memory read...')
        ws.send('return emu:read8(0x08000000)')
      } else {
        console.log('📊 Other response:', response)
        ws.close()
      }
    } catch (error) {
      console.error('❌ Failed to parse response:', error)
      console.log('Raw data:', data.toString())
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