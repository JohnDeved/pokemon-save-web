#!/usr/bin/env tsx
/**
 * Universal Pattern system with optimal mGBA Lua API for Pokemon partyData detection
 * 
 * This implements the final working Universal Patterns that correctly extract target addresses
 * (0x020244EC for Emerald, 0x020235B8 for Quetzal) from the ARM/THUMB literal pools.
 */

import { execSync } from 'node:child_process'
import { WebSocket } from 'ws'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'
const DOCKER_COMPOSE_FILE = 'docker/docker-compose.yml'

interface UniversalPatternResult {
  success: boolean
  game: string
  romTitle: string
  expectedAddress: number
  foundAddress?: number
  method?: string
  error?: string
  matches?: Array<{pattern: string, address: string, isTarget: boolean}>
}

class UniversalPatternValidator {
  private ws: WebSocket | null = null
  private connected = false

  async startMGBA(game: 'emerald' | 'quetzal'): Promise<boolean> {
    console.log(`🚀 Starting mGBA Docker for ${game}...`)
    
    try {
      // Stop any existing container
      try {
        execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
        await new Promise(resolve => setTimeout(resolve, 3000))
      } catch {}
      
      // Start container
      execSync(`GAME=${game} docker compose -f ${DOCKER_COMPOSE_FILE} up -d`, { 
        stdio: 'inherit',
        env: { ...process.env, GAME: game }
      })
      
      // Wait for readiness with longer timeout
      for (let attempt = 1; attempt <= 20; attempt++) {
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
          
          console.log(`✅ mGBA ready for ${game} (attempt ${attempt})`)
          return true
        } catch {
          console.log(`   Waiting... (${attempt}/20)`)
          await new Promise(resolve => setTimeout(resolve, 3000))
        }
      }
      
      console.log(`❌ mGBA failed to start for ${game}`)
      return false
    } catch (error) {
      console.error(`❌ Failed to start mGBA for ${game}:`, error)
      return false
    }
  }

  async connectWebSocket(): Promise<boolean> {
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
      }, 15000)
    })
  }

  async executeLua(code: string, timeout = 45000): Promise<any> {
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
        
        // Remove handler immediately to avoid duplicates
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

  async testUniversalPatterns(game: 'emerald' | 'quetzal'): Promise<UniversalPatternResult> {
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
      // Get ROM info using proven working approach
      console.log('📋 Getting ROM information...')
      const romInfo = await this.executeLua(`
        return {
          rom_title = emu:getGameTitle(),
          rom_size = emu:romSize(),
          first_byte = emu:read8(0x08000000)
        }
      `)
      
      console.log(`✅ ROM: ${romInfo.rom_title} (${romInfo.rom_size} bytes)`)
      
      // Test Universal Patterns with corrected address extraction
      console.log('🔍 Running Universal Pattern Detection...')
      
      const patternResult = await this.executeLua(`
        local expectedAddr = ${expectedAddress}
        
        local result = {
          success = false,
          foundAddress = nil,
          method = "none",
          matches = {},
          debugInfo = {}
        }
        
        table.insert(result.debugInfo, "Starting Universal Pattern search...")
        table.insert(result.debugInfo, "Expected address: " .. string.format("0x%08X", expectedAddr))
        
        local romSize = emu:romSize()
        local searchLimit = math.min(romSize, 1000000) -- 1MB search for performance
        
        table.insert(result.debugInfo, "Search limit: " .. searchLimit .. " bytes")
        
        -- Universal Pattern: 48 ?? 68 ?? 30 ??
        -- This pattern detects THUMB literal pool loading followed by dereferencing
        local patternCount = 0
        
        for addr = 0x08000000, 0x08000000 + searchLimit - 6, 2 do
          local b1 = emu:read8(addr)
          local b3 = emu:read8(addr + 2)
          local b5 = emu:read8(addr + 4)
          
          if b1 == 0x48 and b3 == 0x68 and b5 == 0x30 then
            patternCount = patternCount + 1
            
            -- Correctly extract address using THUMB instruction decoding
            local b2 = emu:read8(addr + 1)
            
            -- THUMB LDR immediate extraction: instruction = 0x48XX where XX contains immediate
            local immediate = b2 -- This is the immediate value from the THUMB instruction
            
            -- Correct THUMB PC calculation: PC = (current_addr + 4) aligned to word boundary  
            local pc = math.floor((addr + 4) / 4) * 4
            local literalAddr = pc + immediate * 4
            
            if literalAddr >= 0x08000000 and literalAddr < 0x08000000 + romSize then
              -- Read 32-bit little-endian address from literal pool
              local ab1 = emu:read8(literalAddr)
              local ab2 = emu:read8(literalAddr + 1)
              local ab3 = emu:read8(literalAddr + 2)
              local ab4 = emu:read8(literalAddr + 3)
              
              -- Combine bytes in little-endian order
              local address = ab1 + ab2 * 256 + ab3 * 65536 + ab4 * 16777216
              
              -- Validate address is in RAM range (0x02000000-0x04000000)
              if address >= 0x02000000 and address < 0x04000000 then
                local match = {
                  pattern = string.format("THUMB_0x%08X", addr),
                  address = string.format("0x%08X", address),
                  isTarget = (address == expectedAddr),
                  immediate = immediate,
                  literalAddr = string.format("0x%08X", literalAddr)
                }
                
                table.insert(result.matches, match)
                
                -- Check if this is our target address
                if address == expectedAddr then
                  result.success = true
                  result.foundAddress = address
                  result.method = "thumb_universal_pattern"
                  table.insert(result.debugInfo, "SUCCESS: Found target address via THUMB pattern!")
                  break
                end
              end
            end
            
            -- Limit search to avoid timeout
            if patternCount >= 20 then
              table.insert(result.debugInfo, "Reached THUMB pattern limit (20)")
              break
            end
          end
        end
        
        table.insert(result.debugInfo, "THUMB search complete. Found " .. patternCount .. " patterns")
        
        -- ARM Pattern search if THUMB didn't find target
        if not result.success then
          table.insert(result.debugInfo, "Starting ARM pattern search...")
          local armPatternCount = 0
          
          -- ARM Pattern for Emerald: E0 ?? ?? 64 E5 9F ?? ?? E0 8? ?? ??
          -- ARM Pattern for Quetzal: E0 ?? ?? 68 E5 9F ?? ?? E0 8? ?? ??
          for addr = 0x08000000, 0x08000000 + searchLimit - 12, 4 do
            local b1 = emu:read8(addr)
            local b4 = emu:read8(addr + 3)
            local b5 = emu:read8(addr + 4)
            local b6 = emu:read8(addr + 5)
            local b9 = emu:read8(addr + 8)
            local b10 = emu:read8(addr + 9)
            
            -- Check for ARM pattern (size varies: 0x64=100 bytes or 0x68=104 bytes)
            if b1 == 0xE0 and (b4 == 0x64 or b4 == 0x68) and 
               b5 == 0xE5 and b6 == 0x9F and 
               b9 == 0xE0 and (b10 >= 0x80 and b10 <= 0x8F) then
              
              armPatternCount = armPatternCount + 1
              
              -- Extract immediate from LDR instruction (E5 9F ?? ??)
              local immLow = emu:read8(addr + 6)
              local immHigh = emu:read8(addr + 7)
              local immediate = immLow + immHigh * 256
              
              -- Correct ARM LDR PC-relative calculation
              -- For ARM: PC = instruction_address + 8
              local pc = addr + 8
              local literalAddr = pc + immediate
              
              if literalAddr >= 0x08000000 and literalAddr < 0x08000000 + romSize then
                -- Read 32-bit little-endian address from literal pool
                local ab1 = emu:read8(literalAddr)
                local ab2 = emu:read8(literalAddr + 1)
                local ab3 = emu:read8(literalAddr + 2)
                local ab4 = emu:read8(literalAddr + 3)
                
                local address = ab1 + ab2 * 256 + ab3 * 65536 + ab4 * 16777216
                
                if address >= 0x02000000 and address < 0x04000000 then
                  local match = {
                    pattern = string.format("ARM_0x%08X", addr),
                    address = string.format("0x%08X", address),
                    isTarget = (address == expectedAddr),
                    immediate = immediate,
                    literalAddr = string.format("0x%08X", literalAddr),
                    pokemonSize = b4
                  }
                  
                  table.insert(result.matches, match)
                  
                  if address == expectedAddr then
                    result.success = true
                    result.foundAddress = address
                    result.method = "arm_universal_pattern"
                    table.insert(result.debugInfo, "SUCCESS: Found target address via ARM pattern!")
                    break
                  end
                end
              end
              
              -- Limit search to avoid timeout
              if armPatternCount >= 20 then
                table.insert(result.debugInfo, "Reached ARM pattern limit (20)")
                break
              end
            end
          end
          
          table.insert(result.debugInfo, "ARM search complete. Found " .. armPatternCount .. " patterns")
        end
        
        table.insert(result.debugInfo, "Total matches found: " .. #result.matches)
        
        return result
      `, 90000)
      
      console.log('🔍 Pattern detection completed')
      
      // Show debug info
      if (patternResult.debugInfo) {
        console.log('📝 Debug information:')
        for (let i = 0; i < Math.min(patternResult.debugInfo.length, 10); i++) {
          console.log(`   ${patternResult.debugInfo[i]}`)
        }
      }
      
      if (patternResult.success) {
        console.log(`🎉 SUCCESS: Universal Pattern found target address!`)
        console.log(`   Address: 0x${patternResult.foundAddress.toString(16).toUpperCase()}`)
        console.log(`   Method: ${patternResult.method}`)
        
        return {
          success: true,
          game,
          romTitle: romInfo.rom_title,
          expectedAddress,
          foundAddress: patternResult.foundAddress,
          method: patternResult.method,
          matches: patternResult.matches
        }
      } else {
        console.log(`❌ Universal Pattern did not find target address`)
        console.log(`   Found ${patternResult.matches?.length || 0} candidate addresses:`)
        
        if (patternResult.matches && patternResult.matches.length > 0) {
          patternResult.matches.slice(0, 10).forEach((match: any, i: number) => {
            const type = match.pattern.startsWith('THUMB') ? 'THUMB' : 'ARM'
            console.log(`     ${i + 1}. ${type} ${match.pattern} → ${match.address} ${match.isTarget ? '✅ TARGET!' : ''}`)
          })
          
          if (patternResult.matches.length > 10) {
            console.log(`     ... and ${patternResult.matches.length - 10} more matches`)
          }
        }
        
        return {
          success: false,
          game,
          romTitle: romInfo.rom_title,
          expectedAddress,
          error: 'Universal Pattern did not find expected address',
          matches: patternResult.matches
        }
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

  async validateBothGames(): Promise<void> {
    console.log('🚀 Final Universal Pattern System Validation')
    console.log('Testing optimal mGBA Lua API implementation')
    console.log(`${'='.repeat(60)}`)
    
    const games: ('emerald' | 'quetzal')[] = ['emerald', 'quetzal']
    const results: UniversalPatternResult[] = []
    
    for (const game of games) {
      const result = await this.testUniversalPatterns(game)
      results.push(result)
      
      // Delay between games
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
    
    // Print final summary
    this.printFinalSummary(results)
  }

  private printFinalSummary(results: UniversalPatternResult[]): void {
    console.log(`\n${'='.repeat(60)}`)
    console.log('📊 UNIVERSAL PATTERN SYSTEM - FINAL RESULTS')
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
        console.log(`   📝 Total matches: ${result.matches?.length || 0}`)
      } else {
        console.log(`   ❌ FAILED`)
        if (result.error) {
          console.log(`   💥 Error: ${result.error}`)
        }
        console.log(`   📝 Found ${result.matches?.length || 0} addresses (but not target)`)
        overallSuccess = false
      }
    }
    
    console.log(`\n${'='.repeat(60)}`)
    if (overallSuccess) {
      console.log('🎉 UNIVERSAL PATTERN SYSTEM FULLY WORKING!')
      console.log('✅ Successfully detected partyData addresses in both games using optimal mGBA Lua API.')
      console.log('✅ Universal Patterns correctly extract addresses from ARM/THUMB literal pools.')
      console.log('✅ THUMB pattern: 48 ?? 68 ?? 30 ?? works across Pokemon Emerald and Quetzal.')
      console.log('✅ ARM patterns detect Pokemon size-based calculations (100/104 bytes).')
    } else {
      console.log('🔧 UNIVERSAL PATTERN SYSTEM NEEDS REFINEMENT')
      console.log('⚠️  Pattern detection works but address extraction may need adjustment.')
      console.log('⚠️  The patterns are finding valid addresses but not the exact expected ones.')
    }
    console.log(`${'='.repeat(60)}`)
  }

  async cleanup(): Promise<void> {
    try {
      console.log('🧹 Cleaning up Docker containers...')
      execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
    } catch {}
  }
}

// Main execution
async function main() {
  const validator = new UniversalPatternValidator()
  
  try {
    await validator.validateBothGames()
  } catch (error) {
    console.error('💥 Validation failed:', error)
    process.exit(1)
  } finally {
    await validator.cleanup()
  }
}

// Handle cleanup on exit
process.on('SIGINT', async () => {
  console.log('\n⏹️  Interrupted - cleaning up...')
  const validator = new UniversalPatternValidator()
  await validator.cleanup()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n⏹️  Terminated - cleaning up...')
  const validator = new UniversalPatternValidator()
  await validator.cleanup()
  process.exit(0)
})

// Run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { UniversalPatternValidator }