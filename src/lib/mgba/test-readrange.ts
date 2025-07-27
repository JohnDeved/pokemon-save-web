#!/usr/bin/env -S npx tsx
/**
 * Test script to verify readRange API and shared buffer performance improvements
 */

import { MgbaWebSocketClient } from './websocket-client'

const EMERALD_MEMORY_ADDRESSES = {
  PARTY_DATA: 0x20244ec,
  PARTY_COUNT: 0x20244e9,
  POKEMON_SIZE: 100,
} as const

async function testReadRangeAPI() {
  const client = new MgbaWebSocketClient()
  
  try {
    console.log('🔌 Connecting to mGBA WebSocket...')
    await client.connect()
    
    const gameTitle = await client.getGameTitle()
    console.log(`🎮 Connected to: ${gameTitle}`)
    
    console.log('\n🧪 Testing readRange API vs traditional methods...\n')
    
    const testAddress = EMERALD_MEMORY_ADDRESSES.PARTY_COUNT
    const testSize = 10
    
    // Test 1: Traditional byte-by-byte reading
    console.log('🐌 Traditional byte-by-byte reading...')
    const start1 = performance.now()
    const data1 = await client.readBytesIndividual(testAddress, testSize)
    const time1 = performance.now() - start1
    console.log(`   Time: ${time1.toFixed(2)}ms`)
    console.log(`   Data: [${Array.from(data1).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(', ')}]`)
    
    // Test 2: Bulk Lua reading
    console.log('\n🚀 Bulk Lua reading...')
    const start2 = performance.now()
    const data2 = await client.readBytesBulk(testAddress, testSize)
    const time2 = performance.now() - start2
    console.log(`   Time: ${time2.toFixed(2)}ms`)
    console.log(`   Data: [${Array.from(data2).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(', ')}]`)
    
    // Test 3: Native readRange API
    console.log('\n⚡ Native readRange API...')
    const start3 = performance.now()
    const data3 = await client.readBytesNative(testAddress, testSize)
    const time3 = performance.now() - start3
    console.log(`   Time: ${time3.toFixed(2)}ms`)
    console.log(`   Data: [${Array.from(data3).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(', ')}]`)
    
    // Test 4: Shared buffer (first time)
    console.log('\n💾 Shared buffer (no cache)...')
    client.clearCache()
    const start4 = performance.now()
    const data4 = await client.getSharedBuffer(testAddress, testSize)
    const time4 = performance.now() - start4
    console.log(`   Time: ${time4.toFixed(2)}ms`)
    console.log(`   Data: [${Array.from(data4).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(', ')}]`)
    
    // Test 5: Shared buffer (cached)
    console.log('\n🚀 Shared buffer (cached)...')
    const start5 = performance.now()
    const data5 = await client.getSharedBuffer(testAddress, testSize)
    const time5 = performance.now() - start5
    console.log(`   Time: ${time5.toFixed(2)}ms`)
    console.log(`   Data: [${Array.from(data5).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(', ')}]`)
    
    // Verify all data is identical
    console.log('\n🔍 Data verification:')
    const dataMatches = (
      JSON.stringify(Array.from(data1)) === JSON.stringify(Array.from(data2)) &&
      JSON.stringify(Array.from(data2)) === JSON.stringify(Array.from(data3)) &&
      JSON.stringify(Array.from(data3)) === JSON.stringify(Array.from(data4)) &&
      JSON.stringify(Array.from(data4)) === JSON.stringify(Array.from(data5))
    )
    
    if (dataMatches) {
      console.log('✅ All methods return identical data!')
    } else {
      console.log('❌ Data mismatch detected!')
      console.log('   Individual:', Array.from(data1))
      console.log('   Bulk:      ', Array.from(data2))
      console.log('   Native:    ', Array.from(data3))
      console.log('   Shared:    ', Array.from(data4))
      console.log('   Cached:    ', Array.from(data5))
    }
    
    // Performance comparison
    console.log('\n📊 Performance comparison:')
    console.log(`   Individual bytes: ${time1.toFixed(2)}ms (baseline)`)
    console.log(`   Bulk Lua:        ${time2.toFixed(2)}ms (${(time1/time2).toFixed(1)}x faster)`)
    console.log(`   Native readRange: ${time3.toFixed(2)}ms (${(time1/time3).toFixed(1)}x faster)`)
    console.log(`   Shared buffer:    ${time4.toFixed(2)}ms (${(time1/time4).toFixed(1)}x faster)`)
    console.log(`   Cached buffer:    ${time5.toFixed(2)}ms (${(time1/time5).toFixed(1)}x faster)`)
    
    // Cache stats
    const cacheStats = client.getCacheStats()
    console.log('\n📈 Cache statistics:')
    console.log(`   Cached regions: ${cacheStats.size}`)
    cacheStats.regions.forEach(region => {
      console.log(`   - ${region.address}: ${region.size} bytes, age: ${region.age}ms, dirty: ${region.dirty}`)
    })
    
    console.log('\n✅ readRange API test completed successfully!')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  } finally {
    client.disconnect()
  }
}

// Run test when script is executed directly
testReadRangeAPI().catch(console.error)

export { testReadRangeAPI }