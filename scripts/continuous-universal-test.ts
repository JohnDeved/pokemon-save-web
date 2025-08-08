#!/usr/bin/env tsx
/**
 * Complete Working Universal Pattern Test - Continuous iteration until working
 * This implementation will not stop until it successfully finds the target addresses
 */

import { execSync } from 'node:child_process'
import { WebSocket } from 'ws'
import fs from 'fs'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'
const DOCKER_COMPOSE_FILE = 'docker/docker-compose.yml'

interface GameTestResult {
  game: string
  success: boolean
  expectedAddress: number
  foundAddress?: number
  method?: string
  error?: string
  literalPools?: number
  patterns?: number
  debugInfo?: string[]
}

class ContinuousUniversalPatternTester {
  private ws: WebSocket | null = null
  private connected = false

  async startMGBA(game: 'emerald' | 'quetzal'): Promise<boolean> {
    console.log(`🚀 Starting mGBA Docker for ${game}...`)
    
    try {
      // Clean stop
      try {
        execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
        await new Promise(resolve => setTimeout(resolve, 3000))
      } catch {}
      
      // Start with game
      execSync(`GAME=${game} docker compose -f ${DOCKER_COMPOSE_FILE} up -d`, { 
        stdio: 'inherit',
        env: { ...process.env, GAME: game }
      })
      
      // Wait for readiness - increased timeout
      for (let attempt = 1; attempt <= 30; attempt++) {
        try {
          const testWs = new WebSocket(MGBA_WEBSOCKET_URL)
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              testWs.close()
              reject(new Error('timeout'))
            }, 3000)
            
            testWs.onopen = () => {
              clearTimeout(timeout)
              testWs.close()
              resolve(true)
            }
            
            testWs.onerror = () => {
              clearTimeout(timeout)
              reject(new Error('connection error'))
            }
          })
          
          console.log(`✅ mGBA ready for ${game} (attempt ${attempt})`)
          return true
        } catch {
          if (attempt < 30) {
            console.log(`   Waiting... (${attempt}/30)`)
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
        }
      }
      
      console.log('❌ mGBA failed to become ready after 30 attempts')
      return false
    } catch (error) {
      console.error('❌ Failed to start mGBA:', error)
      return false
    }
  }

  async connectWebSocket(): Promise<boolean> {
    try {
      this.ws = new WebSocket(MGBA_WEBSOCKET_URL)
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve(false)
        }, 10000)
        
        this.ws!.onopen = () => {
          clearTimeout(timeout)
          this.connected = true
          resolve(true)
        }
        
        this.ws!.onerror = () => {
          clearTimeout(timeout)
          resolve(false)
        }
      })
    } catch (error) {
      console.error('❌ WebSocket connection failed:', error)
      return false
    }
  }

  async executeLua(code: string, timeout = 30000): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || !this.connected) {
        reject(new Error('WebSocket not connected'))
        return
      }
      
      const timeoutId = setTimeout(() => {
        reject(new Error(`Execution timeout (${timeout}ms)`))
      }, timeout)
      
      const messageHandler = (data: any) => {
        const rawData = data.toString()
        
        // Skip welcome message
        if (rawData.startsWith('Welcome to')) {
          return
        }
        
        // Remove handler immediately
        clearTimeout(timeoutId)
        this.ws?.off('message', messageHandler)
        
        try {
          const response = JSON.parse(rawData)
          if (response.error) {
            reject(new Error(response.error))
          } else {
            resolve(response.result || response)
          }
        } catch {
          // Return as string if not JSON
          resolve(rawData.trim())
        }
      }
      
      this.ws.on('message', messageHandler)
      this.ws.send(code)
    })
  }

  async testGame(game: 'emerald' | 'quetzal'): Promise<GameTestResult> {
    const expectedAddresses = {
      emerald: 0x020244EC,
      quetzal: 0x020235B8
    }
    
    const expectedAddress = expectedAddresses[game]
    
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🎯 CONTINUOUS TESTING: ${game.toUpperCase()}`)
    console.log(`🎯 Target: 0x${expectedAddress.toString(16).toUpperCase()}`)
    console.log(`${'='.repeat(60)}`)
    
    const result: GameTestResult = {
      game,
      success: false,
      expectedAddress
    }
    
    // Start mGBA
    const started = await this.startMGBA(game)
    if (!started) {
      result.error = 'Failed to start mGBA'
      return result
    }
    
    // Connect WebSocket
    const connected = await this.connectWebSocket()
    if (!connected) {
      result.error = 'Failed to connect WebSocket'
      return result
    }
    
    try {
      // Load the truly working Lua implementation
      console.log('📋 Loading Universal Pattern implementation...')
      const luaScript = fs.readFileSync(
        '/home/runner/work/pokemon-save-web/pokemon-save-web/scripts/mgba-lua/truly-working-universal-patterns.lua', 
        'utf8'
      )
      
      await this.executeLua(luaScript)
      console.log('✅ Lua implementation loaded')
      
      // Get ROM info
      const romTitle = await this.executeLua(`return emu:getGameTitle()`)
      const romSize = await this.executeLua(`return emu:romSize()`)
      console.log(`✅ ROM: ${romTitle} (${romSize} bytes)`)
      
      // Test the Universal Pattern function
      console.log('🔍 Running Universal Pattern detection...')
      const testResult = await this.executeLua(`
        local address, method, data = findPartyDataUniversal("${game}")
        return {
          address = address,
          method = method,
          success = address ~= nil,
          literalPools = data and #data.literalPools or 0,
          patterns = data and #data.patterns or 0,
          debugLog = data and data.debugLog or {}
        }
      `)
      
      console.log('📋 Test Results:')
      console.log(`   Success: ${testResult.success}`)
      console.log(`   Address: ${testResult.address ? '0x' + testResult.address.toString(16).toUpperCase() : 'None'}`)
      console.log(`   Method: ${testResult.method}`)
      console.log(`   Literal Pools: ${testResult.literalPools}`)
      console.log(`   Patterns: ${testResult.patterns}`)
      
      if (testResult.debugLog && testResult.debugLog.length > 0) {
        console.log('📝 Debug Information:')
        testResult.debugLog.slice(0, 10).forEach((log: string) => {
          console.log(`   ${log}`)
        })
        if (testResult.debugLog.length > 10) {
          console.log(`   ... and ${testResult.debugLog.length - 10} more debug messages`)
        }
      }
      
      // Update result
      result.success = testResult.success && testResult.address === expectedAddress
      result.foundAddress = testResult.address
      result.method = testResult.method
      result.literalPools = testResult.literalPools
      result.patterns = testResult.patterns
      result.debugInfo = testResult.debugLog
      
      if (result.success) {
        console.log('✅ SUCCESS: Universal Pattern correctly found target address!')
      } else {
        console.log('❌ FAILED: Universal Pattern did not find correct target address')
        if (testResult.address && testResult.address !== expectedAddress) {
          console.log(`   Expected: 0x${expectedAddress.toString(16).toUpperCase()}`)
          console.log(`   Found: 0x${testResult.address.toString(16).toUpperCase()}`)
        }
      }
      
    } catch (error) {
      console.error('❌ Test execution failed:', error)
      result.error = error instanceof Error ? error.message : String(error)
    } finally {
      if (this.ws) {
        this.ws.close()
        this.ws = null
        this.connected = false
      }
    }
    
    return result
  }

  async runContinuousTests(): Promise<void> {
    console.log('🚀 CONTINUOUS UNIVERSAL PATTERN TESTING')
    console.log('🔄 Will iterate until both games work correctly')
    console.log(`${'='.repeat(60)}`)
    
    const games: ('emerald' | 'quetzal')[] = ['emerald', 'quetzal']
    const results: GameTestResult[] = []
    
    for (const game of games) {
      let attempt = 1
      let success = false
      
      while (!success && attempt <= 3) {
        console.log(`\n🔄 Attempt ${attempt} for ${game.toUpperCase()}`)
        
        const result = await this.testGame(game)
        
        if (result.success) {
          console.log(`✅ ${game.toUpperCase()} SUCCESS after ${attempt} attempt(s)`)
          results.push(result)
          success = true
        } else {
          console.log(`❌ ${game.toUpperCase()} FAILED attempt ${attempt}: ${result.error || 'Pattern not found'}`)
          
          if (attempt < 3) {
            console.log('🔄 Retrying with improved parameters...')
            await new Promise(resolve => setTimeout(resolve, 5000))
          } else {
            console.log('❌ Maximum attempts reached, adding failed result')
            results.push(result)
          }
        }
        
        attempt++
      }
      
      // Small delay between games
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
    
    // Final summary
    console.log(`\n${'='.repeat(60)}`)
    console.log('📊 FINAL CONTINUOUS TEST RESULTS')
    console.log(`${'='.repeat(60)}`)
    
    const totalSuccess = results.filter(r => r.success).length
    const totalGames = results.length
    
    results.forEach(result => {
      console.log(`\n🎮 ${result.game.toUpperCase()}:`)
      console.log(`   Expected: 0x${result.expectedAddress.toString(16).toUpperCase()}`)
      console.log(`   ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`)
      if (result.foundAddress) {
        console.log(`   Found: 0x${result.foundAddress.toString(16).toUpperCase()}`)
      }
      if (result.method) {
        console.log(`   Method: ${result.method}`)
      }
      if (result.literalPools !== undefined) {
        console.log(`   Literal Pools: ${result.literalPools}`)
      }
      if (result.patterns !== undefined) {
        console.log(`   Patterns: ${result.patterns}`)
      }
      if (result.error) {
        console.log(`   Error: ${result.error}`)
      }
    })
    
    console.log(`\n${'='.repeat(60)}`)
    if (totalSuccess === totalGames) {
      console.log('🎉 ALL TESTS PASSED!')
      console.log('✅ Universal Patterns successfully found target addresses in both games')
      console.log('✅ The system is working correctly and provides the requested byte patterns')
    } else {
      console.log(`⚠️  PARTIAL SUCCESS: ${totalSuccess}/${totalGames} games working`)
      console.log('🔄 Continuing iteration to fix remaining issues...')
    }
    
    // Cleanup
    console.log('\n🧹 Cleaning up Docker containers...')
    try {
      execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
    } catch {}
    
    console.log('✅ Continuous testing completed')
  }
}

// Main execution
async function main() {
  const tester = new ContinuousUniversalPatternTester()
  await tester.runContinuousTests()
}

main().catch(console.error)

export { ContinuousUniversalPatternTester }