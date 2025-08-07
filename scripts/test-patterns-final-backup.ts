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
        
        // Remove the message handler first to avoid duplicate responses
        clearTimeout(timeoutId)
        this.ws?.off('message', messageHandler)
        
        // Handle direct responses (might not be JSON)
        if (!rawData.startsWith('{') && !rawData.startsWith('[')) {
          resolve(rawData.trim())
          return
        }
        
        try {
          const response = JSON.parse(rawData)
          
          if (response.error) {
            reject(new Error(response.error))
          } else {
            resolve(response.result || response)
          }
        } catch (error) {
          // If JSON parsing fails, treat as string response
          resolve(rawData.trim())
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
      // Get ROM info with simpler test first
      console.log('📋 Getting ROM information...')
      
      // First try a simple test
      const simpleTest = await this.executeLua(`return "test"`, 10000)
      console.log('✅ Simple Lua test result:', simpleTest)
      
      const romInfo = await this.executeLua(`
        if not emu then
          return {error = "emu not available"}
        end
        if not emu.getGameTitle then
          return {error = "getGameTitle not available"}
        end
        if not emu.romSize then
          return {error = "romSize not available"}
        end
        
        return {
          title = emu:getGameTitle(),
          size = emu:romSize()
        }
      `, 30000)
      
      if (romInfo.error) {
        console.log(`❌ ROM info error: ${romInfo.error}`)
        return {
          success: false,
          game,
          romTitle: 'Error',
          expectedAddress,
          error: `ROM info error: ${romInfo.error}`
        }
      }
      
      console.log(`✅ ROM: ${romInfo.title} (${romInfo.size} bytes)`)
      
      // Test Universal Patterns using embedded Lua script
      console.log('\n🔍 Running Universal Pattern Test...')
      
      // First test a simple pattern search
      const simplePatternTest = await this.executeLua(`
        if not emu or not emu.romSize or emu:romSize() == 0 then
          return {error = "No ROM loaded"}
        end
        
        local romSize = emu:romSize()
        local searchSize = math.min(1024 * 1024, romSize) -- 1MB max
        local matches = 0
        
        -- Count THUMB pattern matches: 48 ?? 68 ?? 30 ??
        for addr = 0x08000000, 0x08000000 + searchSize - 6 do
          local b1 = emu:read8(addr)
          local b3 = emu:read8(addr + 2)
          local b5 = emu:read8(addr + 4)
          
          if b1 == 0x48 and b3 == 0x68 and b5 == 0x30 then
            matches = matches + 1
            if matches >= 5 then break end -- Stop early for test
          end
        end
        
        return {
          searchSize = searchSize,
          thumbMatches = matches
        }
      `, 60000)
      
      console.log('🔍 Simple pattern test result:', simplePatternTest)
      
      if (simplePatternTest.error) {
        console.log(`❌ Simple pattern test failed: ${simplePatternTest.error}`)
        return {
          success: false,
          game,
          romTitle: romInfo.title,
          expectedAddress,
          error: `Simple pattern test failed: ${simplePatternTest.error}`
        }
      }
      
      console.log(`✅ Found ${simplePatternTest.thumbMatches} THUMB pattern matches in first ${simplePatternTest.searchSize} bytes`)
      
      // If we get matches, run the full test
      if (simplePatternTest.thumbMatches > 0) {
        console.log('🔍 Running full pattern analysis...')
        
        const fullPatternResult = await this.executeLua(`
          local expectedAddr = ${expectedAddress}
          
          local results = {
            success = false,
            foundAddress = nil,
            method = "none",
            thumbMatches = {},
            armMatches = {},
            debug = {},
            errors = {}
          }
          
          -- Search for THUMB patterns: 48 ?? 68 ?? 30 ??
          local thumbCount = 0
          for addr = 0x08000000, 0x08000000 + 1000000 - 6 do
            local b1 = emu:read8(addr)
            local b3 = emu:read8(addr + 2)
            local b5 = emu:read8(addr + 4)
            
            if b1 == 0x48 and b3 == 0x68 and b5 == 0x30 then
              thumbCount = thumbCount + 1
              
              local b2 = emu:read8(addr + 1)
              local immediate = b2
              local pc = math.floor((addr + 4) / 4) * 4
              local literalAddr = pc + immediate * 4
              
              if literalAddr >= 0x08000000 and literalAddr < 0x08000000 + emu:romSize() then
                local ab1 = emu:read8(literalAddr)
                local ab2 = emu:read8(literalAddr + 1)
                local ab3 = emu:read8(literalAddr + 2)
                local ab4 = emu:read8(literalAddr + 3)
                
                local address = ab1 + ab2 * 256 + ab3 * 65536 + ab4 * 16777216
                
                if address >= 0x02000000 and address < 0x04000000 then
                  table.insert(results.thumbMatches, {
                    patternAddr = addr,
                    extractedAddr = address
                  })
                  
                  if address == expectedAddr then
                    results.success = true
                    results.foundAddress = address
                    results.method = "thumb_pattern"
                    break
                  end
                end
              end
              
              if thumbCount >= 10 then break end
            end
          end
          
          -- ARM pattern search if THUMB didn't find it
          if not results.success then
            local armSizes = {0x64, 0x68}
            for _, pokemonSize in ipairs(armSizes) do
              local armCount = 0
              for addr = 0x08000000, 0x08000000 + 1000000 - 12 do
                local b1 = emu:read8(addr)
                local b4 = emu:read8(addr + 3)
                local b5 = emu:read8(addr + 4)
                local b6 = emu:read8(addr + 5)
                local b9 = emu:read8(addr + 8)
                local b10 = emu:read8(addr + 9)
                
                if b1 == 0xE0 and b4 == pokemonSize and b5 == 0xE5 and b6 == 0x9F and b9 == 0xE0 and math.floor(b10 / 16) * 16 == 0x80 then
                  armCount = armCount + 1
                  
                  -- Find LDR instruction
                  for i = 0, 8, 4 do
                    local offset = addr + i
                    local b3 = emu:read8(offset + 2)
                    local b4 = emu:read8(offset + 3)
                    
                    if b3 == 0x9F and b4 == 0xE5 then
                      local b1 = emu:read8(offset)
                      local b2 = emu:read8(offset + 1)
                      local immediate = b1 + b2 * 256
                      local pc = offset + 8
                      local literalAddr = pc + immediate
                      
                      if literalAddr >= 0x08000000 and literalAddr < 0x08000000 + emu:romSize() then
                        local ab1 = emu:read8(literalAddr)
                        local ab2 = emu:read8(literalAddr + 1)
                        local ab3 = emu:read8(literalAddr + 2)
                        local ab4 = emu:read8(literalAddr + 3)
                        
                        local address = ab1 + ab2 * 256 + ab3 * 65536 + ab4 * 16777216
                        
                        if address >= 0x02000000 and address < 0x04000000 then
                          table.insert(results.armMatches, {
                            patternAddr = addr,
                            extractedAddr = address,
                            pokemonSize = pokemonSize
                          })
                          
                          if address == expectedAddr then
                            results.success = true
                            results.foundAddress = address
                            results.method = "arm_pattern"
                            break
                          end
                        end
                      end
                      break
                    end
                  end
                  
                  if armCount >= 5 then break end
                end
              end
              
              if results.success then break end
            end
          end
          
          results.totalThumbMatches = #results.thumbMatches
          results.totalArmMatches = #results.armMatches
          
          return results
        `, 90000)
        
        console.log('🔍 Full pattern result:', fullPatternResult)
        
        if (fullPatternResult && fullPatternResult.success) {
          console.log(`🎉 SUCCESS: Universal Patterns found target address!`)
          console.log(`   Address: 0x${fullPatternResult.foundAddress.toString(16).toUpperCase()}`)
          console.log(`   Method: ${fullPatternResult.method}`)
          
          return {
            success: true,
            game,
            romTitle: romInfo.title,
            expectedAddress,
            foundAddress: fullPatternResult.foundAddress,
            method: fullPatternResult.method
          }
        } else {
          console.log(`❌ Pattern analysis completed:`)
          console.log(`   THUMB matches: ${fullPatternResult?.totalThumbMatches || 0}`)
          console.log(`   ARM matches: ${fullPatternResult?.totalArmMatches || 0}`)
          
          if (fullPatternResult?.thumbMatches && fullPatternResult.thumbMatches.length > 0) {
            console.log(`   First few THUMB extracted addresses:`)
            for (let i = 0; i < Math.min(3, fullPatternResult.thumbMatches.length); i++) {
              const match = fullPatternResult.thumbMatches[i]
              console.log(`     THUMB at 0x${match.patternAddr.toString(16)} → 0x${match.extractedAddr.toString(16)}`)
            }
          }
          
          if (fullPatternResult?.armMatches && fullPatternResult.armMatches.length > 0) {
            console.log(`   First few ARM extracted addresses:`)
            for (let i = 0; i < Math.min(3, fullPatternResult.armMatches.length); i++) {
              const match = fullPatternResult.armMatches[i]
              console.log(`     ARM at 0x${match.patternAddr.toString(16)} → 0x${match.extractedAddr.toString(16)} (size=${match.pokemonSize})`)
            }
          }
        }
      } else {
        console.log('❌ No THUMB patterns found in ROM - patterns may not be suitable for this ROM variant')
      }
      
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