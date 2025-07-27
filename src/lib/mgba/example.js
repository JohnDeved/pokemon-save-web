#!/usr/bin/env node

/**
 * Simple usage example for mGBA WebSocket client
 * Demonstrates basic memory reading capabilities
 */

import { MgbaWebSocketClient } from './websocket-client.js'

async function main() {
  console.log('🔗 Connecting to mGBA WebSocket server...')
  
  const client = new MgbaWebSocketClient()
  
  try {
    await client.connect()
    console.log('✅ Connected successfully')
    
    // Test basic memory read
    console.log('🧪 Testing memory read...')
    const testByte = await client.readByte(0x02000000)
    console.log(`Read byte from EWRAM base: 0x${testByte.toString(16).padStart(2, '0')}`)
    
    // Test eval functionality
    console.log('🧪 Testing eval functionality...')
    const result = await client.eval('return emu:getGameTitle()')
    console.log('Game title:', result.result)
    
    console.log('✅ mGBA WebSocket client is working correctly')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    client.disconnect()
  }
}

main().catch(console.error)