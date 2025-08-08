#!/usr/bin/env tsx
/**
 * Quick test to see ROM info
 */

import { WebSocket } from 'ws'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'

async function getRomInfo() {
  console.log('🔌 Connecting to get ROM info...')
  
  const ws = new WebSocket(MGBA_WEBSOCKET_URL)
  
  ws.on('open', () => {
    console.log('✅ Connected')
    ws.send('return { title = emu:getGameTitle(), size = emu:romSize() }')
  })
  
  ws.on('message', (data) => {
    const str = data.toString()
    if (str.startsWith('Welcome')) return // Skip welcome message
    
    try {
      const response = JSON.parse(str)
      console.log('📊 ROM Info:', response.result)
      ws.close()
    } catch (error) {
      console.error('❌ Parse error:', error)
      console.log('Raw:', str)
      ws.close()
    }
  })
  
  ws.on('error', (error) => {
    console.error('❌ Error:', error)
  })
}

getRomInfo().catch(console.error)