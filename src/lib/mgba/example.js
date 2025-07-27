#!/usr/bin/env node

/**
 * Example demonstrating mGBA integration with core parser
 * Shows both basic WebSocket usage and integrated memory parsing
 */

import { MgbaWebSocketClient } from './websocket-client.js'
// Note: In a real application, you would import PokemonSaveParser from the core module

async function main() {
  console.log('🔗 Connecting to mGBA WebSocket server...')
  
  const client = new MgbaWebSocketClient()
  
  try {
    await client.connect()
    console.log('✅ Connected successfully')
    
    // Test basic memory read
    console.log('\n🧪 Testing basic memory operations...')
    const testByte = await client.readByte(0x02000000)
    console.log(`Read byte from EWRAM base: 0x${testByte.toString(16).padStart(2, '0')}`)
    
    // Test game detection
    const gameTitle = await client.getGameTitle()
    console.log(`Game title: "${gameTitle}"`)
    
    // Test Pokemon party reading
    console.log('\n🎮 Testing Pokemon party access...')
    const partyCount = await client.readByte(0x20244e9)
    console.log(`Party count: ${partyCount}`)
    
    if (partyCount > 0) {
      const personalityBytes = await client.readBytes(0x20244ec, 4)
      const view = new DataView(personalityBytes.buffer)
      const personality = view.getUint32(0, true)
      console.log(`First Pokemon personality: 0x${personality.toString(16).padStart(8, '0')}`)
    }
    
    console.log('\n💡 Integration Example:')
    console.log('// Use with core parser for full functionality:')
    console.log('// const parser = new PokemonSaveParser()')
    console.log('// await parser.loadSaveFile(client)  // Switches to memory mode')
    console.log('// const saveData = await parser.parseSaveFile(client)')
    
    console.log('\n✅ mGBA integration is working correctly')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    client.disconnect()
  }
}

main().catch(console.error)