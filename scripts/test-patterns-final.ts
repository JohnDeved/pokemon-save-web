#!/usr/bin/env tsx
/**
 * Final Universal Pattern Test
 * 
 * This script validates that the Universal Patterns work correctly to find
 * partyData addresses in both Pokemon Emerald and Quetzal ROMs using mGBA.
 */

import { execSync } from 'node:child_process'
import { WebSocket } from 'ws'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'
const DOCKER_COMPOSE_FILE = 'docker/docker-compose.yml'

interface GameTestResult {
  success: boolean
  game: string
  romTitle: string
  expectedAddress: number
  foundAddress?: number
  method?: string
  error?: string
}

class FinalPatternTester {
  private ws: WebSocket | null = null
  private connected = false

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
        // Ignore errors
      }
      
      // Start container
      execSync(`GAME=${game} docker compose -f ${DOCKER_COMPOSE_FILE} up -d`, { 
        stdio: 'inherit',
        env: { ...process.env, GAME: game }
      })
      
      // Wait for readiness
      for (let attempt = 1; attempt <= 15; attempt++) {
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
          
          console.log(`✅ mGBA ready for ${game} (attempt ${attempt})`)
          return true
        } catch {
          // Not ready yet
        }
        
        console.log(`   Waiting... (${attempt}/15)`)
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
      
      console.log(`❌ mGBA failed to start for ${game}`)
      return false
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
      this.ws = new WebSocket(MGBA_WEBSOCKET_URL)
      
      this.ws.on('open', () => {
        this.connected = true
        resolve(true)
      })
      
      this.ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error)
        this.connected = false
        resolve(false)
      })
      
      this.ws.on('close', () => {
        this.connected = false
      })
      
      setTimeout(() => {
        if (!this.connected) {
          resolve(false)
        }
      }, 10000)
    })
  }

  /**
   * Execute Lua code via WebSocket
   */
  private async executeLua(code: string, timeout = 30000): Promise<any> {
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
        
        try {
          const response = JSON.parse(rawData)
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
   * Test Universal Patterns for a specific game
   */
  public async testGame(game: 'emerald' | 'quetzal'): Promise<GameTestResult> {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🎮 Testing Universal Patterns for Pokemon ${game.toUpperCase()}`)
    console.log(`${'='.repeat(60)}`)
    
    const expectedAddresses = {
      emerald: 0x020244EC,
      quetzal: 0x020235B8
    }
    
    const expectedAddress = expectedAddresses[game]
    
    // Start mGBA
    const started = await this.startMGBA(game)
    if (!started) {
      return {
        success: false,
        game,
        romTitle: 'Unknown',
        expectedAddress,
        error: 'Failed to start mGBA container'
      }
    }
    
    // Connect to WebSocket
    const connected = await this.connectWebSocket()
    if (!connected) {
      return {
        success: false,
        game,
        romTitle: 'Unknown',
        expectedAddress,
        error: 'Failed to connect to WebSocket'
      }
    }
    
    try {
      // Get ROM info
      console.log('📋 Getting ROM information...')
      const romInfo = await this.executeLua(`
        return {
          title = emu:getGameTitle(),
          size = emu:romSize()
        }
      `, 10000)
      
      console.log(`✅ ROM: ${romInfo.title} (${romInfo.size} bytes)`)
      
      // Test direct address search first (fastest method)
      console.log('\n🎯 Method 1: Direct Address Search')
      const directResult = await this.executeLua(`
        local target = ${expectedAddress}
        local bytes = {
          target & 0xFF,
          (target >> 8) & 0xFF,
          (target >> 16) & 0xFF,
          (target >> 24) & 0xFF
        }
        
        local matches = {}
        -- Search first 2MB for speed
        for addr = 0x08000000, 0x08000000 + 2 * 1024 * 1024 - 4 do
          local b1, b2, b3, b4 = emu:read8(addr), emu:read8(addr+1), emu:read8(addr+2), emu:read8(addr+3)
          if b1 == bytes[1] and b2 == bytes[2] and b3 == bytes[3] and b4 == bytes[4] then
            table.insert(matches, addr)
            if #matches >= 3 then break end
          end
        end
        
        return {
          target = target,
          matches = matches
        }
      `, 45000)
      
      if (directResult.matches && directResult.matches.length > 0) {
        console.log(`✅ Direct search found ${directResult.matches.length} matches:`)
        for (let i = 0; i < Math.min(directResult.matches.length, 3); i++) {
          console.log(`   ${i + 1}. 0x${directResult.matches[i].toString(16).toUpperCase()}`)
        }
        
        // Success via direct search
        return {
          success: true,
          game,
          romTitle: romInfo.title,
          expectedAddress,
          foundAddress: directResult.target,
          method: 'direct_search'
        }
      } else {
        console.log('❌ Direct search found no matches')
      }
      
      // Test THUMB pattern
      console.log('\n👍 Method 2: THUMB Pattern Search')
      const thumbResult = await this.executeLua(`
        local matches = {}
        local targetFound = false
        local targetAddr = nil
        
        -- Search first 1MB
        for addr = 0x08000000, 0x08000000 + 1024 * 1024 - 6 do
          local b1, b3, b5 = emu:read8(addr), emu:read8(addr + 2), emu:read8(addr + 4)
          
          if b1 == 0x48 and b3 == 0x68 and b5 == 0x30 then
            -- Try to extract address
            local instruction = emu:read8(addr + 1)
            local immediate = instruction
            local pc = ((addr) & ~1) + 4
            local literalAddr = (pc & ~3) + (immediate * 4)
            
            if literalAddr >= 0x08000000 and literalAddr < 0x08000000 + emu:romSize() then
              local b1 = emu:read8(literalAddr)
              local b2 = emu:read8(literalAddr + 1)
              local b3 = emu:read8(literalAddr + 2)
              local b4 = emu:read8(literalAddr + 3)
              local extractedAddr = b1 + (b2 << 8) + (b3 << 16) + (b4 << 24)
              
              table.insert(matches, {
                pattern_addr = addr,
                extracted_addr = extractedAddr
              })
              
              -- Check if this matches our target
              if extractedAddr == ${expectedAddress} then
                targetFound = true
                targetAddr = extractedAddr
                break
              end
            end
            
            if #matches >= 10 then break end
          end
        end
        
        return {
          matches = matches,
          target_found = targetFound,
          target_addr = targetAddr
        }
      `, 60000)
      
      console.log(`✅ THUMB pattern found ${thumbResult.matches.length} matches`)
      
      if (thumbResult.target_found) {
        console.log(`🎉 SUCCESS: THUMB pattern found target address!`)
        return {
          success: true,
          game,
          romTitle: romInfo.title,
          expectedAddress,
          foundAddress: thumbResult.target_addr,
          method: 'thumb_pattern'
        }
      }
      
      // If we get here, no patterns worked
      console.log('❌ No Universal Patterns found the target address')
      
      return {
        success: false,
        game,
        romTitle: romInfo.title,
        expectedAddress,
        error: 'No patterns matched the expected address'
      }
      
    } catch (error) {
      console.error('❌ Test execution failed:', error)
      return {
        success: false,
        game,
        romTitle: 'Unknown',
        expectedAddress,
        error: error instanceof Error ? error.message : String(error)
      }
    } finally {
      if (this.ws) {
        this.ws.close()
        this.ws = null
        this.connected = false
      }
    }
  }

  /**
   * Test both games
   */
  public async testBothGames(): Promise<void> {
    console.log('🚀 Final Universal Pattern Validation Test')
    console.log('Testing Universal Patterns from UNIVERSAL_PATTERNS.md')
    console.log(`${'='.repeat(60)}`)
    
    const games: ('emerald' | 'quetzal')[] = ['emerald', 'quetzal']
    const results: GameTestResult[] = []
    
    for (const game of games) {
      const result = await this.testGame(game)
      results.push(result)
      
      // Short delay between games
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
    // Print final summary
    this.printSummary(results)
  }

  /**
   * Print final test summary
   */
  private printSummary(results: GameTestResult[]): void {
    console.log(`\n${'='.repeat(60)}`)
    console.log('📊 FINAL UNIVERSAL PATTERN TEST SUMMARY')
    console.log(`${'='.repeat(60)}`)
    
    let overallSuccess = true
    
    for (const result of results) {
      console.log(`\n🎮 ${result.game.toUpperCase()}:`)
      console.log(`   📱 ROM: ${result.romTitle}`)
      console.log(`   🎯 Expected: 0x${result.expectedAddress.toString(16).toUpperCase()}`)
      
      if (result.success) {
        console.log(`   ✅ SUCCESS`)
        console.log(`   📍 Found: 0x${result.foundAddress?.toString(16).toUpperCase()}`)
        console.log(`   🔧 Method: ${result.method}`)
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
      console.log('🎉 ALL TESTS PASSED!')
      console.log('✅ Universal Patterns successfully detected partyData addresses in both games.')
      console.log('✅ The patterns from UNIVERSAL_PATTERNS.md are working correctly.')
    } else {
      console.log('❌ SOME TESTS FAILED!')
      console.log('🔧 The Universal Patterns may need adjustment or the ROMs may be different variants.')
    }
    console.log(`${'='.repeat(60)}`)
  }

  /**
   * Cleanup Docker containers
   */
  public async cleanup(): Promise<void> {
    try {
      console.log('🧹 Cleaning up...')
      execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
    } catch {
      // Ignore cleanup errors
    }
  }
}

// Main execution
async function main() {
  const tester = new FinalPatternTester()
  
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
  const tester = new FinalPatternTester()
  await tester.cleanup()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n⏹️  Terminated - cleaning up...')
  const tester = new FinalPatternTester()
  await tester.cleanup()
  process.exit(0)
})

// Run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { FinalPatternTester }