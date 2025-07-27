#!/usr/bin/env -S npx tsx
/**
 * Benchmark test for mGBA WebSocket API reading performance
 * Tests different approaches to optimize memory reading speed
 */

import { MgbaWebSocketClient } from './websocket-client'

// Memory addresses for testing
const EMERALD_MEMORY_ADDRESSES = {
  PARTY_DATA: 0x20244ec,
  PARTY_COUNT: 0x20244e9,
  POKEMON_SIZE: 100,
  MAX_PARTY_SIZE: 6,
} as const

/**
 * Performance measurement utility
 */
class PerformanceTimer {
  private startTime: number = 0
  
  start(): void {
    this.startTime = performance.now()
  }
  
  end(): number {
    return performance.now() - this.startTime
  }
}

/**
 * Benchmark different memory reading approaches
 */
export class MgbaBenchmark {
  constructor(private client: MgbaWebSocketClient) {}

  /**
   * Test 1: Current approach - individual byte reads (SLOW)
   */
  async testIndividualByteReads(address: number, length: number): Promise<{ data: Uint8Array, time: number }> {
    const timer = new PerformanceTimer()
    timer.start()

    const bytes: number[] = []
    for (let i = 0; i < length; i++) {
      const byte = await this.client.readByte(address + i)
      bytes.push(byte)
    }
    
    const time = timer.end()
    return { data: new Uint8Array(bytes), time }
  }

  /**
   * Test 2: Bulk read using Lua array operations (FAST)
   */
  async testBulkRead(address: number, length: number): Promise<{ data: Uint8Array, time: number }> {
    const timer = new PerformanceTimer()
    timer.start()

    const luaCode = `(function() local r = {} for i = 0, ${length - 1} do r[i+1] = emu:read8(${address} + i) end return r end)()`
    
    const response = await this.client.eval(luaCode)
    if (response.error) {
      throw new Error(`Bulk read failed: ${response.error}`)
    }
    
    const time = timer.end()
    const data = new Uint8Array(response.result as number[])
    return { data, time }
  }

  /**
   * Test 3: Optimized bulk read with chunk processing
   */
  async testChunkedBulkRead(address: number, length: number, chunkSize: number = 50): Promise<{ data: Uint8Array, time: number }> {
    const timer = new PerformanceTimer()
    timer.start()

    const result: number[] = []
    
    for (let offset = 0; offset < length; offset += chunkSize) {
      const currentChunkSize = Math.min(chunkSize, length - offset)
      const luaCode = `(function() local r = {} for i = 0, ${currentChunkSize - 1} do r[i+1] = emu:read8(${address + offset} + i) end return r end)()`
      
      const response = await this.client.eval(luaCode)
      if (response.error) {
        throw new Error(`Chunked bulk read failed: ${response.error}`)
      }
      
      result.push(...(response.result as number[]))
    }
    
    const time = timer.end()
    return { data: new Uint8Array(result), time }
  }

  /**
   * Test 4: Native readRange API (FASTEST POSSIBLE)
   */
  async testNativeReadRange(address: number, length: number): Promise<{ data: Uint8Array, time: number }> {
    const timer = new PerformanceTimer()
    timer.start()

    try {
      const data = await this.client.readBytesNative(address, length)
      const time = timer.end()
      return { data, time }
    } catch (error) {
      const time = timer.end()
      throw new Error(`Native readRange failed: ${error}`)
    }
  }

  /**
   * Test 4b: Native readRange API with Base64 encoding (SAFE + FAST)
   */
  async testNativeReadRangeBase64(address: number, length: number): Promise<{ data: Uint8Array, time: number }> {
    const timer = new PerformanceTimer()
    timer.start()

    try {
      const data = await this.client.readBytesNativeBase64(address, length)
      const time = timer.end()
      return { data, time }
    } catch (error) {
      const time = timer.end()
      throw new Error(`Native readRange Base64 failed: ${error}`)
    }
  }

  /**
   * Test 5: Shared buffer with caching
   */
  async testSharedBuffer(address: number, length: number): Promise<{ data: Uint8Array, time: number }> {
    const timer = new PerformanceTimer()
    timer.start()

    try {
      const data = await this.client.getSharedBuffer(address, length, true)
      const time = timer.end()
      return { data, time }
    } catch (error) {
      const time = timer.end()
      throw new Error(`Shared buffer failed: ${error}`)
    }
  }

  /**
   * Test 6: Memory region read (if supported by mGBA)
   */
  async testMemoryRegionRead(address: number, length: number): Promise<{ data: Uint8Array, time: number }> {
    const timer = new PerformanceTimer()
    timer.start()

    try {
      // Try using mGBA's core memory reading if available
      const luaCode = `(function() local r = {} for i = 0, ${length - 1} do r[i+1] = emu:read8(${address} + i) end return r end)()`
      
      const response = await this.client.eval(luaCode)
      if (response.error) {
        throw new Error(`Memory region read failed: ${response.error}`)
      }
      
      const time = timer.end()
      const data = new Uint8Array(response.result as number[])
      return { data, time }
    } catch (error) {
      const time = timer.end()
      throw new Error(`Memory region read not supported: ${error}`)
    }
  }

  /**
   * Test 7: Parallel chunk reading
   */
  async testParallelChunkedRead(address: number, length: number, chunkSize: number = 25): Promise<{ data: Uint8Array, time: number }> {
    const timer = new PerformanceTimer()
    timer.start()

    const chunks: Promise<number[]>[] = []
    
    for (let offset = 0; offset < length; offset += chunkSize) {
      const currentChunkSize = Math.min(chunkSize, length - offset)
      const chunkPromise = this.readChunk(address + offset, currentChunkSize)
      chunks.push(chunkPromise)
    }
    
    const chunkResults = await Promise.all(chunks)
    const result = chunkResults.flat()
    
    const time = timer.end()
    return { data: new Uint8Array(result), time }
  }

  private async readChunk(address: number, length: number): Promise<number[]> {
    const luaCode = `(function() local r = {} for i = 0, ${length - 1} do r[i+1] = emu:read8(${address} + i) end return r end)()`
    
    const response = await this.client.eval(luaCode)
    if (response.error) {
      throw new Error(`Chunk read failed: ${response.error}`)
    }
    
    return response.result as number[]
  }

  /**
   * Run comprehensive benchmark comparing all approaches
   */
  async runBenchmark(): Promise<void> {
    console.log('🚀 Starting mGBA WebSocket Performance Benchmark\n')
    
    if (!this.client.isConnected()) {
      console.log('⚠️  Not connected to mGBA. Attempting to connect...')
      await this.client.connect()
    }

    // Set up shared buffer for testing
    console.log('🔄 Setting up shared buffer system...')
    await this.client.preloadSharedBuffers()
    console.log('✅ Shared buffer system ready\n')

    // Test different data sizes
    const testSizes = [
      { name: 'Single Pokemon', address: EMERALD_MEMORY_ADDRESSES.PARTY_DATA, length: EMERALD_MEMORY_ADDRESSES.POKEMON_SIZE },
      { name: 'Full Party (6 Pokemon)', address: EMERALD_MEMORY_ADDRESSES.PARTY_DATA, length: EMERALD_MEMORY_ADDRESSES.POKEMON_SIZE * 6 },
      { name: 'Small read (10 bytes)', address: EMERALD_MEMORY_ADDRESSES.PARTY_COUNT, length: 10 },
    ]

    for (const testSize of testSizes) {
      console.log(`\n📊 Testing: ${testSize.name} (${testSize.length} bytes)`)
      console.log('─'.repeat(60))

      // Test 1: Individual byte reads (current slow method)
      try {
        console.log('🐌 Individual byte reads...')
        const result1 = await this.testIndividualByteReads(testSize.address, Math.min(testSize.length, 50)) // Limit to avoid too much slowness
        console.log(`   Time: ${result1.time.toFixed(2)}ms`)
        console.log(`   Rate: ${(Math.min(testSize.length, 50) / result1.time * 1000).toFixed(0)} bytes/sec`)
      } catch (error) {
        console.log(`   ❌ Failed: ${error}`)
      }

      // Test 2: Bulk read
      try {
        console.log('🚀 Bulk read...')
        const result2 = await this.testBulkRead(testSize.address, testSize.length)
        console.log(`   Time: ${result2.time.toFixed(2)}ms`)
        console.log(`   Rate: ${(testSize.length / result2.time * 1000).toFixed(0)} bytes/sec`)
      } catch (error) {
        console.log(`   ❌ Failed: ${error}`)
      }

      // Test 3: Chunked bulk read
      try {
        console.log('🔄 Chunked bulk read...')
        const result3 = await this.testChunkedBulkRead(testSize.address, testSize.length, 50)
        console.log(`   Time: ${result3.time.toFixed(2)}ms`)
        console.log(`   Rate: ${(testSize.length / result3.time * 1000).toFixed(0)} bytes/sec`)
      } catch (error) {
        console.log(`   ❌ Failed: ${error}`)
      }

      // Test 4: Native readRange API
      try {
        console.log('⚡ Native readRange API...')
        const result4 = await this.testNativeReadRange(testSize.address, testSize.length)
        console.log(`   Time: ${result4.time.toFixed(2)}ms`)
        console.log(`   Rate: ${(testSize.length / result4.time * 1000).toFixed(0)} bytes/sec`)
      } catch (error) {
        console.log(`   ❌ Failed: ${error}`)
      }

      // Test 4b: Native readRange API with hex encoding
      try {
        console.log('🔐 Native readRange API (Hex encoding)...')
        const result4b = await this.testNativeReadRangeBase64(testSize.address, testSize.length)
        console.log(`   Time: ${result4b.time.toFixed(2)}ms`)
        console.log(`   Rate: ${(testSize.length / result4b.time * 1000).toFixed(0)} bytes/sec`)
      } catch (error) {
        console.log(`   ❌ Failed: ${error}`)
      }

      // Test 5: Shared buffer (first time - no cache)
      try {
        console.log('💾 Shared buffer (no cache)...')
        this.client.clearCache() // Clear cache for fair test
        const result5 = await this.testSharedBuffer(testSize.address, testSize.length)
        console.log(`   Time: ${result5.time.toFixed(2)}ms`)
        console.log(`   Rate: ${(testSize.length / result5.time * 1000).toFixed(0)} bytes/sec`)
      } catch (error) {
        console.log(`   ❌ Failed: ${error}`)
      }

      // Test 6: Shared buffer (cached)
      try {
        console.log('🚀 Shared buffer (cached)...')
        const result6 = await this.testSharedBuffer(testSize.address, testSize.length)
        console.log(`   Time: ${result6.time.toFixed(2)}ms`)
        console.log(`   Rate: ${(testSize.length / result6.time * 1000).toFixed(0)} bytes/sec`)
      } catch (error) {
        console.log(`   ❌ Failed: ${error}`)
      }

      // Test 7: Memory region read
      try {
        console.log('🧠 Memory region read...')
        const result7 = await this.testMemoryRegionRead(testSize.address, testSize.length)
        console.log(`   Time: ${result7.time.toFixed(2)}ms`)
        console.log(`   Rate: ${(testSize.length / result7.time * 1000).toFixed(0)} bytes/sec`)
      } catch (error) {
        console.log(`   ❌ Failed: ${error}`)
      }

      // Test 8: Parallel chunked read
      try {
        console.log('⚡ Parallel chunked read...')
        const result8 = await this.testParallelChunkedRead(testSize.address, testSize.length, 25)
        console.log(`   Time: ${result8.time.toFixed(2)}ms`)
        console.log(`   Rate: ${(testSize.length / result8.time * 1000).toFixed(0)} bytes/sec`)
      } catch (error) {
        console.log(`   ❌ Failed: ${error}`)
      }

      // Show cache statistics
      const cacheStats = this.client.getCacheStats()
      console.log(`📊 Cache: ${cacheStats.size} regions cached`)
    }

    console.log('\n✅ Benchmark completed!')
    console.log('\n📈 Performance Summary:')
    console.log('   ⚡ Native readRange API should be fastest')
    console.log('   💾 Shared buffer provides excellent caching')
    console.log('   🚀 Bulk read is good fallback option')
    console.log('   🐌 Individual bytes should be slowest')
  }
}

/**
 * Main benchmark execution
 */
async function main() {
  const client = new MgbaWebSocketClient()
  
  try {
    console.log('🔌 Connecting to mGBA WebSocket...')
    await client.connect()
    
    const gameTitle = await client.getGameTitle()
    console.log(`🎮 Connected to: ${gameTitle}`)
    
    const benchmark = new MgbaBenchmark(client)
    await benchmark.runBenchmark()
    
  } catch (error) {
    console.error('❌ Benchmark failed:', error)
    process.exit(1)
  } finally {
    client.disconnect()
  }
}

// Run benchmark when script is executed directly
main().catch(console.error)