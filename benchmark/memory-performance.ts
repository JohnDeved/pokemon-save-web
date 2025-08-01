#!/usr/bin/env tsx

/**
 * Memory reading performance benchmark for mGBA WebSocket API
 * 
 * Tests different methods of reading memory data:
 * - emu:readRange()
 * - read8() individual bytes
 * - read32() 32-bit chunks
 * 
 * Usage: tsx benchmark/memory-performance.ts
 */

import { MgbaWebSocketClient } from '../src/lib/mgba/websocket-client.js'

const WEBSOCKET_URL = 'ws://localhost:7102/ws'

// Test configurations
const TEST_CONFIGS = [
  { name: 'Small (8 bytes)', size: 8 },
  { name: 'Medium (100 bytes)', size: 100 },
  { name: 'Large (1000 bytes)', size: 1000 },
]

// Memory address to test (Pokemon party start - should be safe)
const TEST_ADDRESS = 0x02024284

interface BenchmarkResult {
  method: string
  size: number
  avgTime: number
  minTime: number
  maxTime: number
  runs: number
}

class MemoryBenchmark {
  private client: MgbaWebSocketClient
  private connected = false

  constructor() {
    this.client = new MgbaWebSocketClient(WEBSOCKET_URL)
  }

  async connect(): Promise<void> {
    if (this.connected) return

    console.log('🔌 Connecting to mGBA WebSocket...')
    await this.client.connect()
    this.connected = true
    console.log('✅ Connected successfully!')
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return
    
    this.client.disconnect()
    this.connected = false
    console.log('🔌 Disconnected from mGBA WebSocket')
  }

  /**
   * Test emu:readRange method
   */
  async testReadRange(address: number, size: number): Promise<number> {
    const start = performance.now()
    
    // Use simpler single-line format to avoid server adding unwanted 'return'
    const code = `(function() local data = emu:readRange(${address}, ${size}); local bytes = {}; for i = 1, #data do bytes[i] = string.byte(data, i) end; return bytes end)()`
    
    const result = await this.client.eval(code)
    
    if (result.error) {
      throw new Error(`ReadRange failed: ${result.error}`)
    }
    
    const end = performance.now()
    return end - start
  }

  /**
   * Test read8 method (individual bytes)
   */
  async testRead8(address: number, size: number): Promise<number> {
    const start = performance.now()
    
    const code = `(function() local bytes = {}; for i = 0, ${size - 1} do bytes[i + 1] = emu:read8(${address} + i) end; return bytes end)()`
    
    const result = await this.client.eval(code)
    
    if (result.error) {
      throw new Error(`Read8 failed: ${result.error}`)
    }
    
    const end = performance.now()
    return end - start
  }

  /**
   * Test read32 method (32-bit chunks)
   */
  async testRead32(address: number, size: number): Promise<number> {
    const start = performance.now()
    
    // Read in 32-bit chunks, handle remainder with read8
    const chunks = Math.floor(size / 4)
    const remainder = size % 4
    
    const code = `(function() local bytes = {}; local pos = 1; for i = 0, ${chunks - 1} do local val = emu:read32(${address} + i * 4); bytes[pos] = val & 0xFF; bytes[pos + 1] = (val >> 8) & 0xFF; bytes[pos + 2] = (val >> 16) & 0xFF; bytes[pos + 3] = (val >> 24) & 0xFF; pos = pos + 4 end; for i = 0, ${remainder - 1} do bytes[pos + i] = emu:read8(${address + chunks * 4} + i) end; return bytes end)()`
    
    const result = await this.client.eval(code)
    
    if (result.error) {
      throw new Error(`Read32 failed: ${result.error}`)
    }
    
    const end = performance.now()
    return end - start
  }

  /**
   * Run benchmark for a specific method and size
   */
  async runBenchmark(
    method: string,
    testFn: (address: number, size: number) => Promise<number>,
    size: number,
    runs = 10
  ): Promise<BenchmarkResult> {
    console.log(`  Running ${method} for ${size} bytes (${runs} runs)...`)
    
    const times: number[] = []
    
    for (let i = 0; i < runs; i++) {
      try {
        const time = await testFn(TEST_ADDRESS, size)
        times.push(time)
        
        // Small delay between runs to avoid overwhelming the emulator
        await new Promise(resolve => setTimeout(resolve, 50))
      } catch (error) {
        console.warn(`    Run ${i + 1} failed: ${error}`)
      }
    }
    
    if (times.length === 0) {
      throw new Error(`All runs failed for ${method}`)
    }
    
    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length
    const minTime = Math.min(...times)
    const maxTime = Math.max(...times)
    
    return {
      method,
      size,
      avgTime,
      minTime,
      maxTime,
      runs: times.length
    }
  }

  /**
   * Run all benchmarks
   */
  async runAllBenchmarks(): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = []
    
    console.log('🚀 Starting memory reading performance benchmark...\n')
    
    for (const config of TEST_CONFIGS) {
      console.log(`📊 Testing ${config.name}:`)
      
      try {
        // Test readRange
        const readRangeResult = await this.runBenchmark(
          'readRange',
          (addr, size) => this.testReadRange(addr, size),
          config.size
        )
        results.push(readRangeResult)
        
        // Test read8
        const read8Result = await this.runBenchmark(
          'read8',
          (addr, size) => this.testRead8(addr, size),
          config.size
        )
        results.push(read8Result)
        
        // Test read32
        const read32Result = await this.runBenchmark(
          'read32',
          (addr, size) => this.testRead32(addr, size),
          config.size
        )
        results.push(read32Result)
        
        console.log()
      } catch (error) {
        console.error(`❌ Failed to benchmark ${config.name}: ${error}`)
      }
    }
    
    return results
  }

  /**
   * Display benchmark results
   */
  displayResults(results: BenchmarkResult[]): void {
    console.log('📈 BENCHMARK RESULTS')
    console.log('====================\n')
    
    // Group by size
    const resultsBySize = new Map<number, BenchmarkResult[]>()
    for (const result of results) {
      const sizeResults = resultsBySize.get(result.size) || []
      sizeResults.push(result)
      resultsBySize.set(result.size, sizeResults)
    }
    
    for (const [size, sizeResults] of resultsBySize.entries()) {
      const config = TEST_CONFIGS.find(c => c.size === size)
      console.log(`${config?.name} (${size} bytes):`)
      console.log('Method      | Avg (ms) | Min (ms) | Max (ms) | Runs')
      console.log('------------|----------|----------|----------|-----')
      
      for (const result of sizeResults) {
        const method = result.method.padEnd(11)
        const avg = result.avgTime.toFixed(2).padStart(8)
        const min = result.minTime.toFixed(2).padStart(8)
        const max = result.maxTime.toFixed(2).padStart(8)
        const runs = result.runs.toString().padStart(4)
        
        console.log(`${method}| ${avg} | ${min} | ${max} | ${runs}`)
      }
      
      // Find fastest method for this size
      const fastest = sizeResults.reduce((best, current) => 
        current.avgTime < best.avgTime ? current : best
      )
      console.log(`🏆 Fastest: ${fastest.method} (${fastest.avgTime.toFixed(2)}ms avg)\n`)
    }
    
    // Overall recommendations
    console.log('🎯 RECOMMENDATIONS')
    console.log('==================')
    
    const smallResults = resultsBySize.get(8) || []
    const mediumResults = resultsBySize.get(100) || []
    const largeResults = resultsBySize.get(1000) || []
    
    if (smallResults.length > 0) {
      const fastest = smallResults.reduce((best, current) => 
        current.avgTime < best.avgTime ? current : best
      )
      console.log(`Small reads (≤ 10 bytes): Use ${fastest.method}`)
    }
    
    if (mediumResults.length > 0) {
      const fastest = mediumResults.reduce((best, current) => 
        current.avgTime < best.avgTime ? current : best
      )
      console.log(`Medium reads (10-200 bytes): Use ${fastest.method}`)
    }
    
    if (largeResults.length > 0) {
      const fastest = largeResults.reduce((best, current) => 
        current.avgTime < best.avgTime ? current : best
      )
      console.log(`Large reads (>200 bytes): Use ${fastest.method}`)
    }
  }
}

async function main() {
  const benchmark = new MemoryBenchmark()
  
  try {
    await benchmark.connect()
    
    // Verify emulator is ready
    const gameCheck = await benchmark.client.eval('emu:getGameTitle()')
    if (gameCheck.error) {
      throw new Error('Emulator is not ready or no ROM loaded')
    }
    const gameTitle = JSON.parse(gameCheck.result ?? '""')
    console.log(`🎮 Testing with: ${gameTitle}\n`)
    
    const results = await benchmark.runAllBenchmarks()
    benchmark.displayResults(results)
    
  } catch (error) {
    console.error(`❌ Benchmark failed: ${error}`)
    process.exit(1)
  } finally {
    await benchmark.disconnect()
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { MemoryBenchmark }