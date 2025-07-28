#!/usr/bin/env node

/**
 * Quick script to debug the memory reading issue
 */

const { MgbaWebSocketClient } = require('./src/lib/mgba/websocket-client.ts')

async function main() {
  const client = new MgbaWebSocketClient()
  
  try {
    console.log('🔌 Connecting to mGBA WebSocket...')
    await client.connect()
    console.log('✅ Connected successfully!')
    
    // Check the user confirmed addresses
    const userCountAddr = 0x2024a10
    const userDataAddr = 0x2024a14
    const myCountAddr = 0x2024a14
    const myDataAddr = 0x2024a18
    
    console.log('\n=== MEMORY INSPECTION ===')
    
    // Read values at different addresses
    const valueAt10 = await client.readByte(userCountAddr)
    const valueAt14 = await client.readByte(userDataAddr)
    const valueAt18 = await client.readByte(myDataAddr)
    
    console.log(`Value at 0x${userCountAddr.toString(16)} (user count):  ${valueAt10}`)
    console.log(`Value at 0x${userDataAddr.toString(16)} (user data):   ${valueAt14}`)
    console.log(`Value at 0x${myDataAddr.toString(16)} (my data):     ${valueAt18}`)
    
    // Read a larger context to see the pattern
    console.log('\n=== MEMORY CONTEXT ===')
    const contextData = await client.readBytes(0x2024a00, 32)
    
    for (let i = 0; i < contextData.length; i++) {
      const addr = 0x2024a00 + i
      const value = contextData[i]
      let marker = ''
      
      if (addr === userCountAddr) marker = ' <-- USER COUNT'
      else if (addr === userDataAddr) marker = ' <-- USER DATA'
      else if (addr === myCountAddr) marker = ' <-- MY COUNT'
      else if (addr === myDataAddr) marker = ' <-- MY DATA'
      
      console.log(`0x${addr.toString(16)}: ${value.toString().padStart(3)} (0x${value.toString(16).padStart(2, '0')})${marker}`)
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    client.disconnect()
  }
}

if (require.main === module) {
  main().catch(console.error)
}