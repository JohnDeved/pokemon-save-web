#!/usr/bin/env -S npx tsx
/**
 * Simple performance comparison test: Individual vs Bulk reading
 */

import { MgbaWebSocketClient } from './websocket-client'

// Memory addresses for testing
const EMERALD_MEMORY_ADDRESSES = {
  PARTY_DATA: 0x20244ec,
  PARTY_COUNT: 0x20244e9,
  POKEMON_SIZE: 100,
} as const

async function main() {
  console.log('🚀 Performance Comparison: Individual vs Bulk Reading\n')
  
  const client = new MgbaWebSocketClient()
  await client.connect()
  
  console.log('✅ Connected to mGBA')
  
  // Test sizes to compare
  const testSizes = [10, 50, 100] // bytes
  
  for (const size of testSizes) {
    console.log(`\n📊 Testing ${size} bytes:`)
    console.log('─'.repeat(40))
    
    // Method 1: Individual byte reads (SLOW)
    console.log('🐌 Individual byte reads...')
    const start1 = performance.now()
    const bytes1: number[] = []
    for (let i = 0; i < size; i++) {
      const byte = await client.readByte(EMERALD_MEMORY_ADDRESSES.PARTY_DATA + i)
      bytes1.push(byte)
    }
    const time1 = performance.now() - start1
    console.log(`   Time: ${time1.toFixed(2)}ms`)
    console.log(`   Rate: ${(size / time1 * 1000).toFixed(0)} bytes/sec`)
    
    // Method 2: Bulk read (FAST)
    console.log('🚀 Bulk read...')
    const start2 = performance.now()
    const bytes2 = await client.readBytesBulk(EMERALD_MEMORY_ADDRESSES.PARTY_DATA, size)
    const time2 = performance.now() - start2
    console.log(`   Time: ${time2.toFixed(2)}ms`)
    console.log(`   Rate: ${(size / time2 * 1000).toFixed(0)} bytes/sec`)
    
    // Performance comparison
    const speedup = time1 / time2
    console.log(`   💡 Speedup: ${speedup.toFixed(1)}x faster`)
    
    // Verify data matches
    const data1 = new Uint8Array(bytes1)
    const matches = data1.every((byte, i) => byte === bytes2[i])
    console.log(`   ✅ Data matches: ${matches}`)
  }
  
  client.disconnect()
  console.log('\n🎯 Performance test completed!')
}

main().catch(console.error)