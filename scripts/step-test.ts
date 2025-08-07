#!/usr/bin/env tsx
/**
 * Test basic Lua functionality step by step
 */

import { WebSocket } from 'ws'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'

async function stepByStepTest() {
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
  
  const tests = [
    'return "hello"',
    'return emu:getGameTitle()',
    'return emu:romSize()',
    'return emu:read8(0x08000000)',
    'return string.format("%02X %02X %02X %02X", emu:read8(0x08000000), emu:read8(0x08000001), emu:read8(0x08000002), emu:read8(0x08000003))'
  ]
  
  let testIndex = 0
  
  const runNextTest = () => {
    if (testIndex >= tests.length) {
      console.log('✅ All tests completed')
      ws.close()
      return
    }
    
    const test = tests[testIndex]!
    console.log(`🧪 Test ${testIndex + 1}: ${test}`)
    ws.send(test)
    testIndex++
  }
  
  ws.on('message', (data) => {
    const str = data.toString()
    if (str.startsWith('Welcome')) {
      console.log('📄 Welcome message received')
      runNextTest()
      return
    }
    
    try {
      const response = JSON.parse(str)
      console.log('📥 Response:', response)
      
      setTimeout(runNextTest, 1000) // Wait a bit between tests
    } catch (error) {
      console.log('📄 Non-JSON response:', str)
      setTimeout(runNextTest, 1000)
    }
  })
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error)
  })
  
  ws.on('close', () => {
    console.log('🔌 WebSocket closed')
  })
}

stepByStepTest().catch(console.error)