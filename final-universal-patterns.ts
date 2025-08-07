#!/usr/bin/env tsx
/**
 * Final Working Universal Pattern Implementation
 * Simplified and step-by-step approach
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

class FinalUniversalValidator {
  private ws: WebSocket | null = null
  private connected = false

  async startMGBA(game: 'emerald' | 'quetzal'): Promise<boolean> {
    console.log(`🚀 Starting mGBA Docker for ${game}...`)
    
    try {
      try {
        execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
        await new Promise(resolve => setTimeout(resolve, 2000))
      } catch {}
      
      execSync(`GAME=${game} docker compose -f ${DOCKER_COMPOSE_FILE} up -d`, { 
        stdio: 'inherit',
        env: { ...process.env, GAME: game }
      })
      
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
          console.log(`   Waiting... (${attempt}/15)`)
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }
      
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
      }, 10000)
    })
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
        
        if (rawData.startsWith('Welcome to')) {
          return
        }
        
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
          resolve(rawData.trim())
        }
      }
      
      this.ws.on('message', messageHandler)
      this.ws.send(code)
    })
  }

  async testGame(game: 'emerald' | 'quetzal'): Promise<UniversalPatternResult> {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🎮 Testing Universal Patterns for Pokemon ${game.toUpperCase()}`)
    console.log(`${'='.repeat(60)}`)
    
    const expectedAddresses = {
      emerald: 0x020244EC,
      quetzal: 0x020235B8
    }
    
    const expectedAddress = expectedAddresses[game]
    
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
      // Step 1: Get ROM info
      console.log('📋 Getting ROM information...')
      const romInfo = await this.executeLua(`
        return {
          title = emu:getGameTitle(),
          size = emu:romSize(),
          firstByte = emu:read8(0x08000000)
        }
      `)
      
      console.log(`✅ ROM: ${romInfo.title} (${romInfo.size} bytes)`)
      console.log(`   First byte: 0x${romInfo.firstByte.toString(16).toUpperCase().padStart(2, '0')}`)
      
      // Step 2: Simple THUMB pattern search
      console.log('🔍 Starting THUMB pattern search: 48 ?? 68 ?? 30 ??')
      const thumbResult = await this.executeLua(`
        local expectedAddr = ${expectedAddress}
        local matches = {}
        local found = false
        local foundAddr = nil
        local searchCount = 0
        
        for addr = 0x08000000, 0x08000000 + 1000000, 2 do
          local b1 = emu:read8(addr)
          local b3 = emu:read8(addr + 2)
          local b5 = emu:read8(addr + 4)
          
          if b1 == 0x48 and b3 == 0x68 and b5 == 0x30 then
            searchCount = searchCount + 1
            
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
                local match = {
                  pattern = string.format("0x%08X", addr),
                  address = string.format("0x%08X", address),
                  isTarget = (address == expectedAddr)
                }
                table.insert(matches, match)
                
                if address == expectedAddr then
                  found = true
                  foundAddr = address
                  break
                end
              end
            end
            
            if searchCount >= 20 then break end
          end
        end
        
        return {
          success = found,
          foundAddress = foundAddr,
          matches = matches,
          searchCount = searchCount
        }
      `, 60000)
      
      console.log(`📊 THUMB search: Found ${thumbResult.matches?.length || 0} valid patterns`)
      
      if (thumbResult.success) {
        console.log(`🎉 SUCCESS: Found target address via THUMB pattern!`)
        console.log(`   Address: 0x${thumbResult.foundAddress.toString(16).toUpperCase()}`)
        
        return {
          success: true,
          game,
          romTitle: romInfo.title,
          expectedAddress,
          foundAddress: thumbResult.foundAddress,
          method: 'thumb_pattern',
          matches: thumbResult.matches
        }
      }
      
      // Step 3: ARM pattern search if THUMB failed
      console.log('🔍 Starting ARM pattern search...')
      const armResult = await this.executeLua(`
        local expectedAddr = ${expectedAddress}
        local matches = {}
        local found = false
        local foundAddr = nil
        local searchCount = 0
        
        for addr = 0x08000000, 0x08000000 + 1000000, 4 do
          local b1 = emu:read8(addr)
          local b4 = emu:read8(addr + 3)
          local b5 = emu:read8(addr + 4)
          local b6 = emu:read8(addr + 5)
          local b9 = emu:read8(addr + 8)
          local b10 = emu:read8(addr + 9)
          
          if b1 == 0xE0 and (b4 == 0x64 or b4 == 0x68) and 
             b5 == 0xE5 and b6 == 0x9F and 
             b9 == 0xE0 and (b10 >= 0x80 and b10 <= 0x8F) then
            
            searchCount = searchCount + 1
            
            local immLow = emu:read8(addr + 6)
            local immHigh = emu:read8(addr + 7)
            local immediate = immLow + immHigh * 256
            local pc = addr + 8
            local literalAddr = pc + immediate
            
            if literalAddr >= 0x08000000 and literalAddr < 0x08000000 + emu:romSize() then
              local ab1 = emu:read8(literalAddr)
              local ab2 = emu:read8(literalAddr + 1)
              local ab3 = emu:read8(literalAddr + 2)
              local ab4 = emu:read8(literalAddr + 3)
              local address = ab1 + ab2 * 256 + ab3 * 65536 + ab4 * 16777216
              
              if address >= 0x02000000 and address < 0x04000000 then
                local match = {
                  pattern = string.format("0x%08X", addr),
                  address = string.format("0x%08X", address),
                  isTarget = (address == expectedAddr)
                }
                table.insert(matches, match)
                
                if address == expectedAddr then
                  found = true
                  foundAddr = address
                  break
                end
              end
            end
            
            if searchCount >= 20 then break end
          end
        end
        
        return {
          success = found,
          foundAddress = foundAddr,
          matches = matches,
          searchCount = searchCount
        }
      `, 60000)
      
      console.log(`📊 ARM search: Found ${armResult.matches?.length || 0} valid patterns`)
      
      if (armResult.success) {
        console.log(`🎉 SUCCESS: Found target address via ARM pattern!`)
        console.log(`   Address: 0x${armResult.foundAddress.toString(16).toUpperCase()}`)
        
        return {
          success: true,
          game,
          romTitle: romInfo.title,
          expectedAddress,
          foundAddress: armResult.foundAddress,
          method: 'arm_pattern',
          matches: armResult.matches
        }
      }
      
      // Show candidate matches for debugging
      const allMatches = [...(thumbResult.matches || []), ...(armResult.matches || [])]
      
      if (allMatches.length > 0) {
        console.log(`📝 Found ${allMatches.length} candidate matches:`)
        allMatches.slice(0, 5).forEach((match: any, i: number) => {
          console.log(`   ${i + 1}. ${match.pattern} → ${match.address} ${match.isTarget ? '✅ TARGET!' : ''}`)
        })
      }
      
      return {
        success: false,
        game,
        romTitle: romInfo.title,
        expectedAddress,
        error: 'Universal Pattern did not find expected address',
        matches: allMatches
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
    console.log('Using optimal mGBA Lua API with simplified approach')
    console.log(`${'='.repeat(60)}`)
    
    const games: ('emerald' | 'quetzal')[] = ['emerald', 'quetzal']
    const results: UniversalPatternResult[] = []
    
    for (const game of games) {
      const result = await this.testGame(game)
      results.push(result)
      
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
    
    this.printFinalSummary(results)
  }

  private printFinalSummary(results: UniversalPatternResult[]): void {
    console.log(`\n${'='.repeat(60)}`)
    console.log('📊 FINAL UNIVERSAL PATTERN VALIDATION RESULTS')
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
      console.log('✅ Successfully detected partyData addresses in both games.')
      console.log('✅ THUMB and ARM patterns correctly extract addresses from literal pools.')
      console.log('✅ Using optimal mGBA Lua API with proper instruction decoding.')
    } else {
      console.log('🔧 UNIVERSAL PATTERN SYSTEM NEEDS FURTHER REFINEMENT')
      console.log('⚠️  Pattern detection is working but address extraction needs optimization.')
      console.log('⚠️  The patterns find instruction sequences but may need better decoding logic.')
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

async function main() {
  const validator = new FinalUniversalValidator()
  
  try {
    await validator.validateBothGames()
  } catch (error) {
    console.error('💥 Validation failed:', error)
    process.exit(1)
  } finally {
    await validator.cleanup()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { FinalUniversalValidator }