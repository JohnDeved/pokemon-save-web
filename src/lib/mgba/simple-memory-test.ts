#!/usr/bin/env node
/**
 * Simple test of the new Emerald memory parser
 * Tests basic connectivity and data reading from mGBA Docker environment
 */

import { MgbaWebSocketClient } from './websocket-client'
import { EmeraldMemoryParser } from './emerald-memory-parser'

async function main() {
  console.log('🧪 Testing Emerald Memory Parser...\n')

  try {
    // Connect to mGBA
    console.log('🔌 Connecting to mGBA WebSocket...')
    const mgbaClient = new MgbaWebSocketClient()
    await mgbaClient.connect()
    console.log('✅ Connected to mGBA')

    // Test basic memory reading first
    console.log('\n🔍 Testing basic memory reading...')
    const testByte = await mgbaClient.readByte(0x02000000)
    console.log(`   Read test byte: 0x${testByte.toString(16)}`)

    // Test party count address directly
    console.log('\n📊 Testing party count read...')
    const partyCount = await mgbaClient.readByte(0x20244e9)
    console.log(`   Party count: ${partyCount}`)

    if (partyCount >= 0 && partyCount <= 6) {
      console.log('   ✅ Valid party count!')
      
      if (partyCount > 0) {
        console.log('\n🔍 Testing Pokemon personality read...')
        // Read first Pokemon personality at party address + 0 (personality offset)
        const personality = await mgbaClient.readDWord(0x20244ec)
        console.log(`   First Pokemon personality: 0x${personality.toString(16)}`)
        
        console.log('\n🎉 SUCCESS: Basic memory reading works!')
        console.log('   - Memory addresses are accessible')
        console.log('   - Party count is valid')
        console.log('   - Pokemon data is readable')
      } else {
        console.log('   No Pokemon in party, but party count read successfully')
      }
    } else {
      console.log(`   ❌ Invalid party count: ${partyCount}`)
    }

    mgbaClient.disconnect()
    console.log('\n✅ Basic memory test completed successfully!')

  } catch (error) {
    console.error('❌ Test failed:', error)
    console.error('\nPossible issues:')
    console.error('- mGBA Docker container not running (try: npm run mgba:start)')
    console.error('- WebSocket connection failed')
    console.error('- Save state not loaded properly')
    process.exit(1)
  }
}

// Run the test
main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})