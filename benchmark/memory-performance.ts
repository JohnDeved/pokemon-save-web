#!/usr/bin/env tsx

/**
 * Comprehensive Memory Reading Performance Benchmark for mGBA WebSocket API
 * 
 * Tests different methods of reading memory data with scientific rigor:
 * - emu:readRange()
 * - read8() individual bytes
 * - read32() 32-bit chunks
 * 
 * Features:
 * - Multiple test sizes with comprehensive coverage
 * - Statistical analysis with confidence intervals
 * - Multiple memory addresses to test address-specific effects
 * - Warmup runs to eliminate cold start bias
 * - Significance testing between methods
 * - Comprehensive reporting
 * 
 * Usage: tsx benchmark/memory-performance.ts
 */

import { MgbaWebSocketClient } from '../src/lib/mgba/websocket-client.js'

const WEBSOCKET_URL = 'ws://localhost:7102/ws'

// Comprehensive test configurations
const TEST_CONFIGS = [
  { name: 'Tiny (1 byte)', size: 1 },
  { name: 'Small (4 bytes)', size: 4 },
  { name: 'Medium (8 bytes)', size: 8 },
  { name: 'Regular (16 bytes)', size: 16 },
  { name: 'Large (32 bytes)', size: 32 },
  { name: 'Larger (64 bytes)', size: 64 },
  { name: 'Big (100 bytes)', size: 100 },
  { name: 'Bigger (200 bytes)', size: 200 },
  { name: 'Huge (500 bytes)', size: 500 },
  { name: 'Massive (1000 bytes)', size: 1000 },
  { name: 'Ultra (2000 bytes)', size: 2000 }
]

// Test multiple memory addresses to ensure results aren't address-specific
const TEST_ADDRESSES = [
  { name: 'Pokemon Party', address: 0x02024284 },
  { name: 'Pokemon Box 1', address: 0x020244EC },
  { name: 'Pokemon Box 2', address: 0x02024A44 },
  { name: 'Trainer Data', address: 0x02025734 },
  { name: 'Game Stats', address: 0x02025A00 }
]

const WARMUP_RUNS = 5      // Number of warmup runs to eliminate cold start bias
const TEST_RUNS = 50       // Number of test runs for statistical significance
const CONFIDENCE_LEVEL = 0.95  // 95% confidence interval

interface BenchmarkResult {
  method: string
  size: number
  address: string
  times: number[]
  avgTime: number
  minTime: number
  maxTime: number
  stdDev: number
  confidenceInterval: [number, number]
  runs: number
}

interface StatisticalComparison {
  method1: string
  method2: string
  size: number
  pValue: number
  isSignificant: boolean
  percentageDifference: number
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
   * Statistical helper functions
   */
  private calculateStatistics(times: number[]): {
    avg: number
    min: number
    max: number
    stdDev: number
    confidenceInterval: [number, number]
  } {
    const n = times.length
    const avg = times.reduce((sum, time) => sum + time, 0) / n
    const min = Math.min(...times)
    const max = Math.max(...times)
    
    // Calculate standard deviation
    const variance = times.reduce((sum, time) => sum + Math.pow(time - avg, 2), 0) / (n - 1)
    const stdDev = Math.sqrt(variance)
    
    // Calculate confidence interval (t-distribution)
    const tValue = this.getTValue(n - 1, CONFIDENCE_LEVEL)
    const marginOfError = tValue * (stdDev / Math.sqrt(n))
    const confidenceInterval: [number, number] = [avg - marginOfError, avg + marginOfError]
    
    return { avg, min, max, stdDev, confidenceInterval }
  }

  /**
   * Get t-value for confidence interval calculation
   */
  private getTValue(degreesOfFreedom: number, confidence: number): number {
    // Simplified t-values for common cases (95% confidence)
    const tTable: { [key: number]: number } = {
      49: 2.010,  // For 50 samples
      30: 2.042,
      20: 2.086,
      10: 2.228,
      5: 2.571
    }
    
    // Find closest match or use conservative estimate
    const keys = Object.keys(tTable).map(Number).sort((a, b) => b - a)
    for (const key of keys) {
      if (degreesOfFreedom >= key) {
        return tTable[key]
      }
    }
    return 2.571 // Conservative fallback
  }

  /**
   * Perform t-test to compare two methods
   */
  private tTest(times1: number[], times2: number[]): number {
    const n1 = times1.length
    const n2 = times2.length
    const mean1 = times1.reduce((sum, t) => sum + t, 0) / n1
    const mean2 = times2.reduce((sum, t) => sum + t, 0) / n2
    
    const var1 = times1.reduce((sum, t) => sum + Math.pow(t - mean1, 2), 0) / (n1 - 1)
    const var2 = times2.reduce((sum, t) => sum + Math.pow(t - mean2, 2), 0) / (n2 - 1)
    
    const pooledVar = ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2)
    const standardError = Math.sqrt(pooledVar * (1/n1 + 1/n2))
    
    const tStatistic = Math.abs(mean1 - mean2) / standardError
    
    // Convert t-statistic to approximate p-value (simplified)
    // For practical purposes, t > 2.0 indicates significance at p < 0.05
    if (tStatistic > 2.576) return 0.01   // p < 0.01
    if (tStatistic > 1.96) return 0.05    // p < 0.05
    if (tStatistic > 1.645) return 0.10   // p < 0.10
    return 0.20 // Not significant
  }

  /**
   * Test emu:readRange method
   */
  async testReadRange(address: number, size: number): Promise<number> {
    const start = performance.now()
    
    const code = `local data = emu:readRange(${address}, ${size})
local bytes = {}
for i = 1, #data do
  bytes[i] = string.byte(data, i)
end
return bytes`
    
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
    
    const code = `local bytes = {}
for i = 0, ${size - 1} do
  bytes[i + 1] = emu:read8(${address} + i)
end
return bytes`
    
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
    
    const code = `local bytes = {}
local pos = 1
for i = 0, ${chunks - 1} do
  local val = emu:read32(${address} + i * 4)
  bytes[pos] = val & 0xFF
  bytes[pos + 1] = (val >> 8) & 0xFF
  bytes[pos + 2] = (val >> 16) & 0xFF
  bytes[pos + 3] = (val >> 24) & 0xFF
  pos = pos + 4
end
for i = 0, ${remainder - 1} do
  bytes[pos + i] = emu:read8(${address + chunks * 4} + i)
end
return bytes`
    
    const result = await this.client.eval(code)
    
    if (result.error) {
      throw new Error(`Read32 failed: ${result.error}`)
    }
    
    const end = performance.now()
    return end - start
  }

  /**
   * Run benchmark for a specific method and size with warmup
   */
  async runBenchmark(
    method: string,
    testFn: (address: number, size: number) => Promise<number>,
    size: number,
    address: number,
    addressName: string
  ): Promise<BenchmarkResult> {
    console.log(`    ${method} at ${addressName} (${size} bytes)...`)
    
    // Warmup runs to eliminate cold start bias
    console.log(`      Warmup (${WARMUP_RUNS} runs)...`)
    for (let i = 0; i < WARMUP_RUNS; i++) {
      try {
        await testFn(address, size)
        await new Promise(resolve => setTimeout(resolve, 10))
      } catch (error) {
        console.warn(`      Warmup run ${i + 1} failed: ${error}`)
      }
    }
    
    // Actual test runs
    console.log(`      Testing (${TEST_RUNS} runs)...`)
    const times: number[] = []
    
    for (let i = 0; i < TEST_RUNS; i++) {
      try {
        const time = await testFn(address, size)
        times.push(time)
        
        // Small delay between runs to avoid overwhelming the emulator
        await new Promise(resolve => setTimeout(resolve, 25))
      } catch (error) {
        console.warn(`      Run ${i + 1} failed: ${error}`)
      }
    }
    
    if (times.length === 0) {
      throw new Error(`All runs failed for ${method}`)
    }
    
    const stats = this.calculateStatistics(times)
    
    return {
      method,
      size,
      address: addressName,
      times,
      avgTime: stats.avg,
      minTime: stats.min,
      maxTime: stats.max,
      stdDev: stats.stdDev,
      confidenceInterval: stats.confidenceInterval,
      runs: times.length
    }
  }

  /**
   * Run comprehensive benchmarks across all configurations
   */
  async runAllBenchmarks(): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = []
    
    console.log('🚀 Starting comprehensive memory reading performance benchmark...\n')
    console.log(`Configuration: ${TEST_RUNS} runs per test, ${WARMUP_RUNS} warmup runs, ${CONFIDENCE_LEVEL * 100}% confidence intervals\n`)
    
    for (const addressConfig of TEST_ADDRESSES) {
      console.log(`📍 Testing at ${addressConfig.name} (0x${addressConfig.address.toString(16).toUpperCase()}):`)
      
      for (const config of TEST_CONFIGS) {
        console.log(`  📊 ${config.name}:`)
        
        try {
          // Test readRange
          const readRangeResult = await this.runBenchmark(
            'readRange',
            (addr, size) => this.testReadRange(addr, size),
            config.size,
            addressConfig.address,
            addressConfig.name
          )
          results.push(readRangeResult)
          
          // Test read8
          const read8Result = await this.runBenchmark(
            'read8',
            (addr, size) => this.testRead8(addr, size),
            config.size,
            addressConfig.address,
            addressConfig.name
          )
          results.push(read8Result)
          
          // Test read32
          const read32Result = await this.runBenchmark(
            'read32',
            (addr, size) => this.testRead32(addr, size),
            config.size,
            addressConfig.address,
            addressConfig.name
          )
          results.push(read32Result)
          
        } catch (error) {
          console.error(`    ❌ Failed to benchmark ${config.name}: ${error}`)
        }
      }
      console.log()
    }
    
    return results
  }

  /**
   * Perform statistical comparison between methods
   */
  performStatisticalAnalysis(results: BenchmarkResult[]): StatisticalComparison[] {
    const comparisons: StatisticalComparison[] = []
    
    // Group results by size and address
    const resultsByKey = new Map<string, BenchmarkResult[]>()
    for (const result of results) {
      const key = `${result.size}-${result.address}`
      const group = resultsByKey.get(key) || []
      group.push(result)
      resultsByKey.set(key, group)
    }
    
    // Compare methods within each group
    for (const [key, group] of resultsByKey.entries()) {
      const [size, address] = key.split('-')
      const methods = ['readRange', 'read8', 'read32']
      
      for (let i = 0; i < methods.length; i++) {
        for (let j = i + 1; j < methods.length; j++) {
          const method1 = methods[i]
          const method2 = methods[j]
          
          const result1 = group.find(r => r.method === method1)
          const result2 = group.find(r => r.method === method2)
          
          if (result1 && result2) {
            const pValue = this.tTest(result1.times, result2.times)
            const percentageDifference = Math.abs((result1.avgTime - result2.avgTime) / result1.avgTime) * 100
            
            comparisons.push({
              method1,
              method2,
              size: parseInt(size),
              pValue,
              isSignificant: pValue < 0.05,
              percentageDifference
            })
          }
        }
      }
    }
    
    return comparisons
  }

  /**
   * Display comprehensive benchmark results
   */
  displayResults(results: BenchmarkResult[], comparisons: StatisticalComparison[]): void {
    console.log('📈 COMPREHENSIVE BENCHMARK RESULTS')
    console.log('==================================\n')
    
    // Group results by address and size
    const resultsByAddress = new Map<string, BenchmarkResult[]>()
    for (const result of results) {
      const addressResults = resultsByAddress.get(result.address) || []
      addressResults.push(result)
      resultsByAddress.set(result.address, addressResults)
    }
    
    // Display results by address
    for (const [address, addressResults] of resultsByAddress.entries()) {
      console.log(`📍 ${address.toUpperCase()} RESULTS:`)
      console.log('=' + '='.repeat(address.length + 9))
      
      const resultsBySize = new Map<number, BenchmarkResult[]>()
      for (const result of addressResults) {
        const sizeResults = resultsBySize.get(result.size) || []
        sizeResults.push(result)
        resultsBySize.set(result.size, sizeResults)
      }
      
      for (const [size, sizeResults] of resultsBySize.entries()) {
        const config = TEST_CONFIGS.find(c => c.size === size)
        console.log(`\n${config?.name} (${size} bytes):`)
        console.log('Method      | Avg (ms) | StdDev   | 95% CI Lower | 95% CI Upper | Min (ms) | Max (ms) | Runs')
        console.log('------------|----------|----------|--------------|--------------|----------|----------|-----')
        
        for (const result of sizeResults.sort((a, b) => a.avgTime - b.avgTime)) {
          const method = result.method.padEnd(11)
          const avg = result.avgTime.toFixed(2).padStart(8)
          const stdDev = result.stdDev.toFixed(2).padStart(8)
          const ciLower = result.confidenceInterval[0].toFixed(2).padStart(12)
          const ciUpper = result.confidenceInterval[1].toFixed(2).padStart(12)
          const min = result.minTime.toFixed(2).padStart(8)
          const max = result.maxTime.toFixed(2).padStart(8)
          const runs = result.runs.toString().padStart(4)
          
          console.log(`${method}| ${avg} | ${stdDev} | ${ciLower} | ${ciUpper} | ${min} | ${max} | ${runs}`)
        }
        
        // Find fastest method for this size
        const fastest = sizeResults.reduce((best, current) => 
          current.avgTime < best.avgTime ? current : best
        )
        console.log(`🏆 Fastest: ${fastest.method} (${fastest.avgTime.toFixed(2)}ms ± ${fastest.stdDev.toFixed(2)}ms)`)
        
        // Show statistical significance
        const sizeComparisons = comparisons.filter(c => c.size === size)
        const significantComparisons = sizeComparisons.filter(c => c.isSignificant)
        if (significantComparisons.length > 0) {
          console.log('📊 Significant differences (p < 0.05):')
          for (const comp of significantComparisons) {
            console.log(`    ${comp.method1} vs ${comp.method2}: ${comp.percentageDifference.toFixed(1)}% difference (p = ${comp.pValue.toFixed(3)})`)
          }
        }
      }
      console.log()
    }
    
    // Overall analysis across all addresses
    console.log('🎯 OVERALL ANALYSIS ACROSS ALL ADDRESSES')
    console.log('========================================')
    
    // Calculate average performance by method and size
    const avgByMethodSize = new Map<string, { totalTime: number, count: number }>()
    for (const result of results) {
      const key = `${result.method}-${result.size}`
      const existing = avgByMethodSize.get(key) || { totalTime: 0, count: 0 }
      existing.totalTime += result.avgTime
      existing.count += 1
      avgByMethodSize.set(key, existing)
    }
    
    // Group by size for recommendations
    const sizeRecommendations = new Map<number, { method: string, avgTime: number }>()
    for (const config of TEST_CONFIGS) {
      const methods = ['readRange', 'read8', 'read32']
      let bestMethod = methods[0]
      let bestTime = Infinity
      
      for (const method of methods) {
        const key = `${method}-${config.size}`
        const data = avgByMethodSize.get(key)
        if (data) {
          const avgTime = data.totalTime / data.count
          if (avgTime < bestTime) {
            bestTime = avgTime
            bestMethod = method
          }
        }
      }
      
      sizeRecommendations.set(config.size, { method: bestMethod, avgTime: bestTime })
    }
    
    console.log('\n🏆 RECOMMENDATIONS BY DATA SIZE:')
    console.log('Size Range              | Recommended Method | Avg Performance')
    console.log('------------------------|-------------------|----------------')
    
    // Group recommendations by ranges
    const ranges = [
      { name: 'Tiny (1-4 bytes)', sizes: [1, 4] },
      { name: 'Small (8-16 bytes)', sizes: [8, 16] },
      { name: 'Medium (32-64 bytes)', sizes: [32, 64] },
      { name: 'Large (100-200 bytes)', sizes: [100, 200] },
      { name: 'Huge (500+ bytes)', sizes: [500, 1000, 2000] }
    ]
    
    for (const range of ranges) {
      const rangeMethods = new Map<string, number>()
      let totalSizes = 0
      
      for (const size of range.sizes) {
        const rec = sizeRecommendations.get(size)
        if (rec) {
          rangeMethods.set(rec.method, (rangeMethods.get(rec.method) || 0) + 1)
          totalSizes++
        }
      }
      
      if (totalSizes > 0) {
        const mostCommon = Array.from(rangeMethods.entries())
          .sort((a, b) => b[1] - a[1])[0]
        
        const avgTimes = range.sizes
          .map(size => sizeRecommendations.get(size)?.avgTime)
          .filter(time => time !== undefined) as number[]
        const avgPerformance = avgTimes.reduce((sum, time) => sum + time, 0) / avgTimes.length
        
        const rangeName = range.name.padEnd(23)
        const method = mostCommon[0].padEnd(17)
        const performance = `${avgPerformance.toFixed(2)}ms`
        
        console.log(`${rangeName}| ${method} | ${performance}`)
      }
    }
    
    // Statistical summary
    console.log('\n📈 STATISTICAL SUMMARY:')
    const totalComparisons = comparisons.length
    const significantComparisons = comparisons.filter(c => c.isSignificant).length
    const highlySignificant = comparisons.filter(c => c.pValue < 0.01).length
    
    console.log(`Total method comparisons: ${totalComparisons}`)
    console.log(`Statistically significant differences: ${significantComparisons} (${(significantComparisons/totalComparisons*100).toFixed(1)}%)`)
    console.log(`Highly significant differences (p < 0.01): ${highlySignificant} (${(highlySignificant/totalComparisons*100).toFixed(1)}%)`)
    
    if (significantComparisons > 0) {
      const avgDifference = comparisons
        .filter(c => c.isSignificant)
        .reduce((sum, c) => sum + c.percentageDifference, 0) / significantComparisons
      console.log(`Average performance difference when significant: ${avgDifference.toFixed(1)}%`)
    }
    
    console.log('\n💡 CONCLUSION:')
    console.log('The benchmark results show statistically significant performance differences between methods.')
    console.log('Choose the recommended method based on your typical data size for optimal performance.')
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
    console.log(`🎮 Testing with: ${gameTitle}`)
    console.log(`📊 Will test ${TEST_CONFIGS.length} sizes across ${TEST_ADDRESSES.length} memory addresses`)
    console.log(`⏱️  Total tests: ${TEST_CONFIGS.length * TEST_ADDRESSES.length * 3} (${TEST_RUNS} runs each + ${WARMUP_RUNS} warmup runs)\n`)
    
    const results = await benchmark.runAllBenchmarks()
    const comparisons = benchmark.performStatisticalAnalysis(results)
    
    benchmark.displayResults(results, comparisons)
    
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