#!/usr/bin/env tsx
/**
 * Comprehensive Universal Pattern Validation Script
 * 
 * This script validates the Universal Patterns step-by-step:
 * 1. Basic connectivity test
 * 2. Optimized Universal Pattern search
 * 3. Both Pokemon Emerald and Quetzal
 */

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { WebSocket } from 'ws'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'
const DOCKER_COMPOSE_FILE = 'docker/docker-compose.yml'

interface TestResult {
  success: boolean
  variant: string
  expectedAddress?: number
  foundAddress?: number
  method?: string
  confidence?: string
  error?: string
  basicInfo?: any
}

class ComprehensivePatternTester {
  private ws: WebSocket | null = null
  private connected = false

  /**
   * Wait for mGBA container to be ready
   */
  private async waitForContainer(game: string, maxAttempts = 20): Promise<boolean> {
    console.log(`⏳ Waiting for mGBA container to be ready for ${game}...`)
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        execSync('docker ps --filter "name=mgba-test-environment" --filter "status=running"', { 
          stdio: 'pipe' 
        })
        
        // Try to connect to WebSocket
        try {
          const testWs = new WebSocket(MGBA_WEBSOCKET_URL)
          await new Promise((resolve, reject) => {
            testWs.on('open', () => {
              testWs.close()
              resolve(true)
            })
            testWs.on('error', reject)
            setTimeout(() => reject(new Error('Timeout')), 3000)
          })
          
          console.log(`✅ mGBA container ready for ${game} (attempt ${attempt})`)
          return true
        } catch {
          // WebSocket not ready yet
        }
      } catch {
        // Container not ready yet
      }
      
      console.log(`   Attempt ${attempt}/${maxAttempts}...`)
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
    
    console.log(`❌ mGBA container failed to become ready for ${game}`)
    return false
  }

  /**
   * Start mGBA Docker container for a specific game
   */
  private async startMGBA(game: 'emerald' | 'quetzal'): Promise<boolean> {
    console.log(`🚀 Starting mGBA Docker for ${game}...`)
    
    try {
      // Stop any existing container
      try {
        execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
        await new Promise(resolve => setTimeout(resolve, 2000))
      } catch {
        // Ignore errors if container wasn't running
      }
      
      // Start container with specific game
      console.log(`   Building and starting container...`)
      execSync(`GAME=${game} docker compose -f ${DOCKER_COMPOSE_FILE} up -d --build`, { 
        stdio: 'inherit',
        env: { ...process.env, GAME: game }
      })
      
      // Wait for container to be ready
      return await this.waitForContainer(game)
    } catch (error) {
      console.error(`❌ Failed to start mGBA for ${game}:`, error)
      return false
    }
  }

  /**
   * Connect to mGBA WebSocket
   */
  private async connectWebSocket(): Promise<boolean> {
    return new Promise((resolve) => {
      console.log(`🔌 Connecting to mGBA WebSocket...`)
      
      this.ws = new WebSocket(MGBA_WEBSOCKET_URL)
      
      this.ws.on('open', () => {
        console.log('✅ WebSocket connected')
        this.connected = true
        resolve(true)
      })
      
      this.ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error)
        this.connected = false
        resolve(false)
      })
      
      this.ws.on('close', () => {
        console.log('🔌 WebSocket closed')
        this.connected = false
      })
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (!this.connected) {
          console.error('❌ WebSocket connection timeout')
          resolve(false)
        }
      }, 10000)
    })
  }

  /**
   * Execute Lua code via WebSocket and get result
   */
  private async executeLua(code: string, timeout = 30000): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || !this.connected) {
        reject(new Error('WebSocket not connected'))
        return
      }
      
      const timeoutId = setTimeout(() => {
        reject(new Error(`Lua execution timeout (${timeout}ms)`))
      }, timeout)
      
      const messageHandler = (data: any) => {
        try {
          const response = JSON.parse(data.toString())
          clearTimeout(timeoutId)
          this.ws?.off('message', messageHandler)
          
          if (response.error) {
            reject(new Error(response.error))
          } else {
            resolve(response.result)
          }
        } catch (error) {
          clearTimeout(timeoutId)
          this.ws?.off('message', messageHandler)
          reject(error)
        }
      }
      
      this.ws.on('message', messageHandler)
      this.ws.send(code)
    })
  }

  /**
   * Run simple connectivity test
   */
  private async runConnectivityTest(): Promise<any> {
    console.log('🧪 Running connectivity test...')
    
    const testScript = readFileSync('./scripts/mgba-lua/simple-connectivity-test.lua', 'utf-8')
    await this.executeLua(testScript, 10000)
    
    const result = await this.executeLua('return runSimpleTest()', 15000)
    return result
  }

  /**
   * Run Universal Pattern test
   */
  private async runUniversalPatternTest(): Promise<any> {
    console.log('🔍 Running Universal Pattern test...')
    
    const testScript = readFileSync('./scripts/mgba-lua/test-universal-patterns.lua', 'utf-8')
    await this.executeLua(testScript, 10000)
    
    const result = await this.executeLua('return runUniversalPatternTest()', 180000) // 3 minutes
    return result
  }

  /**
   * Test comprehensive patterns for a specific game
   */
  public async testGame(game: 'emerald' | 'quetzal'): Promise<TestResult> {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🎮 Testing Universal Patterns for Pokemon ${game.toUpperCase()}`)
    console.log(`${'='.repeat(60)}`)
    
    // Start mGBA for this game
    const started = await this.startMGBA(game)
    if (!started) {
      return {
        success: false,
        variant: game,
        error: 'Failed to start mGBA container'
      }
    }
    
    // Connect to WebSocket
    const connected = await this.connectWebSocket()
    if (!connected) {
      return {
        success: false,
        variant: game,
        error: 'Failed to connect to WebSocket'
      }
    }
    
    try {
      // Step 1: Basic connectivity test
      console.log('\n📡 Step 1: Basic Connectivity Test')
      const basicTest = await this.runConnectivityTest()
      
      if (!basicTest) {
        throw new Error('Basic connectivity test failed - no response')
      }
      
      console.log('✅ Connectivity test passed:')
      console.log(`   ROM Title: ${basicTest.title || 'Unknown'}`)
      console.log(`   ROM Size: ${basicTest.romSize || 0} bytes`)
      console.log(`   Variant: ${basicTest.variant || 'unknown'}`)
      console.log(`   First Byte: 0x${(basicTest.firstByte || 0).toString(16).toUpperCase()}`)
      
      // Step 2: Universal Pattern test
      console.log('\n🔍 Step 2: Universal Pattern Detection')
      const patternResult = await this.runUniversalPatternTest()
      
      if (!patternResult) {
        throw new Error('Universal Pattern test failed - no response')
      }
      
      // Combine results
      const result: TestResult = {
        success: patternResult.summary?.success || false,
        variant: patternResult.variant || basicTest.variant,
        expectedAddress: patternResult.expectedAddress,
        foundAddress: patternResult.summary?.foundAddress,
        method: patternResult.summary?.method,
        confidence: patternResult.summary?.confidence,
        basicInfo: basicTest
      }
      
      return result
      
    } catch (error) {
      console.error('❌ Test execution failed:', error)
      return {
        success: false,
        variant: game,
        error: error instanceof Error ? error.message : String(error)
      }
    } finally {
      // Disconnect
      if (this.ws) {
        this.ws.close()
        this.ws = null
        this.connected = false
      }
    }
  }

  /**
   * Test patterns for both games
   */
  public async testBothGames(): Promise<void> {
    console.log('🚀 Comprehensive Universal Pattern Validation Test')
    console.log('Testing both basic connectivity and Universal Patterns')
    console.log(`${'='.repeat(60)}`)
    
    const games: ('emerald' | 'quetzal')[] = ['emerald', 'quetzal']
    const results: Map<string, TestResult> = new Map()
    
    for (const game of games) {
      const result = await this.testGame(game)
      results.set(game, result)
      
      // Small delay between games
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
    
    // Print comprehensive summary
    this.printComprehensiveSummary(results)
  }

  /**
   * Print comprehensive test results summary
   */
  private printComprehensiveSummary(results: Map<string, TestResult>): void {
    console.log(`\n${'='.repeat(60)}`)
    console.log('📊 COMPREHENSIVE UNIVERSAL PATTERN TEST SUMMARY')
    console.log(`${'='.repeat(60)}`)
    
    let overallSuccess = true
    const expectedAddresses = {
      emerald: 0x020244EC,
      quetzal: 0x020235B8
    }
    
    for (const [game, result] of results) {
      console.log(`\n🎮 ${game.toUpperCase()}:`)
      
      if (result.basicInfo) {
        console.log(`   📱 ROM: ${result.basicInfo.title}`)
        console.log(`   📏 Size: ${result.basicInfo.romSize} bytes`)
        console.log(`   🎯 Variant: ${result.basicInfo.variant}`)
      }
      
      if (result.success) {
        const expected = expectedAddresses[game as keyof typeof expectedAddresses]
        const isCorrectAddress = result.foundAddress === expected
        
        console.log(`   ✅ SUCCESS ${isCorrectAddress ? '(CORRECT ADDRESS!)' : '(Unexpected address)'}`)
        console.log(`   📍 Found: 0x${result.foundAddress?.toString(16).toUpperCase()}`)
        console.log(`   🎯 Expected: 0x${expected.toString(16).toUpperCase()}`)
        console.log(`   🔧 Method: ${result.method}`)
        console.log(`   🎯 Confidence: ${result.confidence}`)
        
        if (!isCorrectAddress) {
          console.log(`   ⚠️  WARNING: Found address doesn't match expected!`)
          overallSuccess = false
        }
      } else {
        console.log(`   ❌ FAILED`)
        if (result.error) {
          console.log(`   💥 Error: ${result.error}`)
        }
        overallSuccess = false
      }
    }
    
    console.log(`\n${'='.repeat(60)}`)
    if (overallSuccess) {
      console.log('🎉 ALL TESTS PASSED: Universal Patterns work perfectly in both games!')
      console.log('✅ The patterns from UNIVERSAL_PATTERNS.md are confirmed working.')
      console.log('✅ Both games detected with correct partyData addresses.')
    } else {
      console.log('❌ SOME TESTS FAILED: Universal Patterns need adjustment.')
      console.log('🔧 Review the pattern detection logic and expected addresses.')
    }
    console.log(`${'='.repeat(60)}`)
  }

  /**
   * Cleanup Docker containers
   */
  public async cleanup(): Promise<void> {
    try {
      console.log('🧹 Cleaning up Docker containers...')
      execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
    } catch {
      // Ignore cleanup errors
    }
  }
}

// Main execution
async function main() {
  const tester = new ComprehensivePatternTester()
  
  try {
    await tester.testBothGames()
  } catch (error) {
    console.error('💥 Test execution failed:', error)
    process.exit(1)
  } finally {
    await tester.cleanup()
  }
}

// Handle cleanup on exit
process.on('SIGINT', async () => {
  console.log('\n⏹️  Interrupted - cleaning up...')
  const tester = new ComprehensivePatternTester()
  await tester.cleanup()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n⏹️  Terminated - cleaning up...')
  const tester = new ComprehensivePatternTester()
  await tester.cleanup()
  process.exit(0)
})

// Run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { ComprehensivePatternTester }