#!/usr/bin/env tsx
/**
 * Universal Pattern Validation Script
 * 
 * This script tests the Universal Patterns from UNIVERSAL_PATTERNS.md
 * by running them in mGBA Docker with both Pokemon Emerald and Quetzal.
 * It uses the WebSocket API to execute the Lua test script and validate results.
 */

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { WebSocket } from 'ws'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'
const TEST_SCRIPT_PATH = './scripts/mgba-lua/test-universal-patterns.lua'
const DOCKER_COMPOSE_FILE = 'docker/docker-compose.yml'

interface TestResult {
  success: boolean
  variant: string
  expectedAddress?: number
  foundAddress?: number
  method?: string
  confidence?: string
  error?: string
  methods?: any
}

class UniversalPatternTester {
  private ws: WebSocket | null = null
  private connected = false
  private results: Map<string, TestResult> = new Map()

  constructor() {}

  /**
   * Wait for mGBA container to be ready
   */
  private async waitForContainer(game: string, maxAttempts = 30): Promise<boolean> {
    console.log(`⏳ Waiting for mGBA container to be ready for ${game}...`)
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        execSync('docker ps --filter "name=mgba-test-environment" --filter "status=running"', { 
          stdio: 'pipe' 
        })
        
        // Additional check - try to connect to WebSocket
        try {
          const testWs = new WebSocket(MGBA_WEBSOCKET_URL)
          await new Promise((resolve, reject) => {
            testWs.on('open', () => {
              testWs.close()
              resolve(true)
            })
            testWs.on('error', reject)
            setTimeout(() => reject(new Error('Timeout')), 2000)
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
      await new Promise(resolve => setTimeout(resolve, 2000))
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
        await new Promise(resolve => setTimeout(resolve, 1000))
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
  private async executeLua(code: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || !this.connected) {
        reject(new Error('WebSocket not connected'))
        return
      }
      
      const timeout = setTimeout(() => {
        reject(new Error('Lua execution timeout'))
      }, 120000) // 120 second timeout for pattern search
      
      const messageHandler = (data: any) => {
        try {
          const response = JSON.parse(data.toString())
          clearTimeout(timeout)
          this.ws?.off('message', messageHandler)
          
          if (response.error) {
            reject(new Error(response.error))
          } else {
            resolve(response.result)
          }
        } catch (error) {
          clearTimeout(timeout)
          this.ws?.off('message', messageHandler)
          reject(error)
        }
      }
      
      this.ws.on('message', messageHandler)
      this.ws.send(code)
    })
  }

  /**
   * Load and run the universal pattern test
   */
  private async runPatternTest(): Promise<TestResult> {
    try {
      console.log('📝 Loading test script...')
      const testScript = readFileSync(TEST_SCRIPT_PATH, 'utf-8')
      
      console.log('🧪 Executing universal pattern test...')
      await this.executeLua(testScript)
      
      console.log('🔍 Running pattern detection...')
      const results = await this.executeLua('return runTest()')
      
      if (!results) {
        throw new Error('No results returned from test')
      }
      
      return {
        success: results.summary?.success || false,
        variant: results.variant || 'unknown',
        expectedAddress: results.expectedAddress,
        foundAddress: results.summary?.foundAddress,
        method: results.summary?.method,
        confidence: results.summary?.confidence,
        methods: results.methods
      }
    } catch (error) {
      console.error('❌ Pattern test failed:', error)
      return {
        success: false,
        variant: 'unknown',
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Test patterns for a specific game
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
    
    // Run pattern test
    const result = await this.runPatternTest()
    
    // Disconnect
    if (this.ws) {
      this.ws.close()
      this.ws = null
      this.connected = false
    }
    
    this.results.set(game, result)
    return result
  }

  /**
   * Test patterns for both games
   */
  public async testBothGames(): Promise<void> {
    console.log('🚀 Universal Pattern Validation Test')
    console.log('Testing patterns from UNIVERSAL_PATTERNS.md in both games')
    console.log(`${'='.repeat(60)}`)
    
    const games: ('emerald' | 'quetzal')[] = ['emerald', 'quetzal']
    
    for (const game of games) {
      await this.testGame(game)
      
      // Small delay between games
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
    // Print summary
    this.printSummary()
  }

  /**
   * Print test results summary
   */
  private printSummary(): void {
    console.log(`\n${'='.repeat(60)}`)
    console.log('📊 UNIVERSAL PATTERN TEST SUMMARY')
    console.log(`${'='.repeat(60)}`)
    
    let overallSuccess = true
    
    for (const [game, result] of this.results) {
      console.log(`\n🎮 ${game.toUpperCase()}:`)
      
      if (result.success) {
        console.log(`   ✅ SUCCESS`)
        console.log(`   📍 Address: 0x${result.foundAddress?.toString(16).toUpperCase()}`)
        console.log(`   🔧 Method: ${result.method}`)
        console.log(`   🎯 Confidence: ${result.confidence}`)
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
      console.log('🎉 ALL TESTS PASSED: Universal Patterns work in both games!')
      console.log('✅ The patterns from UNIVERSAL_PATTERNS.md are confirmed working.')
    } else {
      console.log('❌ SOME TESTS FAILED: Universal Patterns need adjustment.')
      console.log('🔧 Check the patterns and extraction logic in UNIVERSAL_PATTERNS.md.')
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
  const tester = new UniversalPatternTester()
  
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
  const tester = new UniversalPatternTester()
  await tester.cleanup()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n⏹️  Terminated - cleaning up...')
  const tester = new UniversalPatternTester()
  await tester.cleanup()
  process.exit(0)
})

// Run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { UniversalPatternTester }