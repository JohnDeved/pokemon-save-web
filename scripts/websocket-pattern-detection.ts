#!/usr/bin/env tsx
/**
 * Universal Pattern Detection via mGBA WebSocket API
 * 
 * This script connects to the running mGBA HTTP server and executes Lua code
 * to perform the REAL ROM universal pattern detection as requested by @JohnDeved.
 */

import WebSocket from 'ws'
import { execSync } from 'node:child_process'

const TARGET_ADDRESSES = {
  emerald: 0x020244EC,
  quetzal: 0x020235B8
}

interface PatternResult {
  game: string
  target: number
  pools: number
  references: number
  patterns: string[]
  success: boolean
}

class UniversalPatternDetector {
  private ws: WebSocket | null = null
  
  async ensureContainerRunning(game: 'emerald' | 'quetzal'): Promise<void> {
    console.log(`🚀 Ensuring mGBA container is running for ${game}...`)
    
    try {
      // Stop existing container
      execSync('docker compose -f docker/docker-compose.yml down', { stdio: 'pipe' })
      
      // Start with specific game
      execSync(`docker compose -f docker/docker-compose.yml up -d`, {
        stdio: 'inherit',
        env: { ...process.env, GAME: game }
      })
      
      // Wait for HTTP server
      let ready = false
      for (let i = 0; i < 30; i++) {
        try {
          execSync('curl -sf http://localhost:7102/', { stdio: 'pipe' })
          ready = true
          break
        } catch (e) {
          console.log(`   Waiting for HTTP server... (${i + 1}/30)`)
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
      
      if (!ready) {
        throw new Error('HTTP server failed to start')
      }
      
      console.log(`✅ mGBA HTTP server ready for ${game}`)
      
    } catch (error) {
      console.error('❌ Failed to start mGBA:', error)
      throw error
    }
  }
  
  async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket('ws://localhost:7102/ws')
      
      this.ws.on('open', () => {
        console.log('🔗 Connected to mGBA WebSocket')
        resolve()
      })
      
      this.ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error)
        reject(error)
      })
      
      this.ws.on('close', () => {
        console.log('🔌 WebSocket disconnected')
      })
    })
  }
  
  async executeLua(code: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('WebSocket not connected'))
        return
      }
      
      let responseReceived = false
      
      const messageHandler = (data: Buffer) => {
        if (responseReceived) return
        
        try {
          const message = JSON.parse(data.toString())
          
          if (message.error) {
            console.error('💥 Lua Error:', message.error)
            responseReceived = true
            resolve({ error: message.error })
          } else if (message.result !== undefined) {
            responseReceived = true
            resolve(message)
          }
        } catch (e) {
          // Ignore non-JSON messages (like welcome message)
          if (data.toString().includes('Welcome')) {
            return
          }
          console.error('Failed to parse message:', e)
          responseReceived = true
          reject(e)
        }
      }
      
      this.ws.on('message', messageHandler)
      
      // Send Lua code
      this.ws.send(code)
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (!responseReceived) {
          this.ws!.off('message', messageHandler)
          responseReceived = true
          reject(new Error('Lua execution timeout'))
        }
      }, 30000)
    })
  }
  
  async detectPatternsForGame(game: 'emerald' | 'quetzal'): Promise<PatternResult> {
    const targetAddr = TARGET_ADDRESSES[game]
    
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🎮 DETECTING PATTERNS FOR ${game.toUpperCase()}`)
    console.log(`${'='.repeat(60)}`)
    console.log(`Target address: 0x${targetAddr.toString(16).toUpperCase()}`)
    
    await this.ensureContainerRunning(game)
    await this.connectWebSocket()
    
    // First, get ROM info
    console.log('📋 Getting ROM information...')
    const romInfo = await this.executeLua(`
      return {
        title = emu:getGameTitle(),
        size = emu:romSize()
      }
    `)
    
    if (romInfo.error) {
      throw new Error('Failed to get ROM info: ' + romInfo.error)
    }
    
    console.log(`✅ ROM: ${romInfo.result.title} (${romInfo.result.size} bytes)`)
    
    // Execute the pattern detection
    console.log('\n🔍 Executing pattern detection...')
    
    const patternDetectionCode = `
-- Universal Pattern Detection for ${game}
local TARGET_ADDR = ${targetAddr}
local GAME_TYPE = "${game}"

local targetBytes = {
    TARGET_ADDR & 0xFF,
    (TARGET_ADDR >> 8) & 0xFF,
    (TARGET_ADDR >> 16) & 0xFF,
    (TARGET_ADDR >> 24) & 0xFF
}

-- Find literal pools (search 2MB for speed)
local pools = {}
local romSize = emu:romSize()
local maxSearch = math.min(romSize, 2 * 1024 * 1024)

for addr = 0x08000000, 0x08000000 + maxSearch - 4, 4 do
    local b1, b2, b3, b4 = emu:read8(addr), emu:read8(addr+1), emu:read8(addr+2), emu:read8(addr+3)
    
    if b1 == targetBytes[1] and b2 == targetBytes[2] and 
       b3 == targetBytes[3] and b4 == targetBytes[4] then
        table.insert(pools, addr)
        
        if #pools >= 5 then
            break
        end
    end
end

-- Find instruction references
local references = {}
local patterns = {}

if #pools > 0 then
    for i, poolAddr in ipairs(pools) do
        -- ARM LDR search (1KB back)
        for instAddr = math.max(0x08000000, poolAddr - 1024), poolAddr - 4, 4 do
            local i1, i2, i3, i4 = emu:read8(instAddr), emu:read8(instAddr+1), emu:read8(instAddr+2), emu:read8(instAddr+3)
            
            if i3 == 0x9F and i4 == 0xE5 then
                local immediate = i1 | (i2 << 8)
                local pc = instAddr + 8
                if pc + immediate == poolAddr then
                    -- Get context
                    local context = {}
                    for j = -8, 11 do
                        local addr = instAddr + j
                        if addr >= 0x08000000 and addr < 0x08000000 + romSize then
                            table.insert(context, string.format("%02X", emu:read8(addr)))
                        else
                            table.insert(context, "00")
                        end
                    end
                    
                    -- Pattern: 4 bytes before + E5 9F ?? ?? + 4 bytes after
                    local beforeBytes = {}
                    local afterBytes = {}
                    for j = 1, 8 do beforeBytes[j] = context[j] end
                    for j = 13, 16 do afterBytes[j-12] = context[j] end
                    
                    local pattern = table.concat(beforeBytes, " ") .. " E5 9F ?? ?? " .. table.concat(afterBytes, " ")
                    table.insert(patterns, pattern)
                    
                    table.insert(references, {
                        type = "ARM_LDR",
                        addr = instAddr,
                        pattern = pattern
                    })
                    
                    if #references >= 3 then break end
                end
            end
        end
        
        -- THUMB LDR search (500 bytes back)
        for instAddr = math.max(0x08000000, poolAddr - 500), poolAddr - 2, 2 do
            local t1, t2 = emu:read8(instAddr), emu:read8(instAddr+1)
            
            if (t1 & 0xF8) == 0x48 then
                local immediate = t2
                local pc = ((instAddr + 4) & ~3)
                if pc + (immediate * 4) == poolAddr then
                    -- Get context
                    local context = {}
                    for j = -6, 9 do
                        local addr = instAddr + j
                        if addr >= 0x08000000 and addr < 0x08000000 + romSize then
                            table.insert(context, string.format("%02X", emu:read8(addr)))
                        else
                            table.insert(context, "00")
                        end
                    end
                    
                    -- Pattern: 3 bytes before + 48 ?? + 3 bytes after
                    local beforeBytes = {}
                    local afterBytes = {}
                    for j = 1, 6 do beforeBytes[j] = context[j] end
                    for j = 9, 11 do afterBytes[j-8] = context[j] end
                    
                    local pattern = table.concat(beforeBytes, " ") .. " 48 ?? " .. table.concat(afterBytes, " ")
                    table.insert(patterns, pattern)
                    
                    table.insert(references, {
                        type = "THUMB_LDR", 
                        addr = instAddr,
                        pattern = pattern
                    })
                    
                    if #references >= 3 then break end
                end
            end
        end
        
        if #references >= 3 then break end
    end
end

-- Return results
return {
  game = GAME_TYPE,
  target = TARGET_ADDR,
  pools = #pools,
  references = #references,
  patterns = patterns,
  success = #patterns > 0
}
`
    
    const result = await this.executeLua(patternDetectionCode)
    
    if (result.error) {
      throw new Error('Pattern detection failed: ' + result.error)
    }
    
    console.log('\n📊 Pattern Detection Results:')
    console.log(`   Literal pools: ${result.result.pools}`)
    console.log(`   References: ${result.result.references}`)
    console.log(`   Patterns: ${result.result.patterns.length}`)
    console.log(`   Success: ${result.result.success ? '✅' : '❌'}`)
    
    if (result.result.patterns.length > 0) {
      console.log('\n🛠️  Generated Patterns:')
      result.result.patterns.forEach((pattern: string, i: number) => {
        console.log(`   ${i + 1}. ${pattern}`)
      })
    }
    
    return result.result
  }
  
  async testBothGames(): Promise<void> {
    console.log('🚀 REAL ROM Universal Pattern Detection')
    console.log('======================================')
    console.log('Using mGBA WebSocket API to analyze REAL ROMs')
    
    const results: PatternResult[] = []
    
    try {
      // Test Emerald
      const emeraldResult = await this.detectPatternsForGame('emerald')
      results.push(emeraldResult)
      
      if (this.ws) {
        this.ws.close()
        this.ws = null
      }
      
      // Wait a bit between games
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Test Quetzal
      const quetzalResult = await this.detectPatternsForGame('quetzal')
      results.push(quetzalResult)
      
    } catch (error) {
      console.error('❌ Error during testing:', error)
    } finally {
      if (this.ws) {
        this.ws.close()
      }
      
      // Cleanup
      try {
        execSync('docker compose -f docker/docker-compose.yml down', { stdio: 'pipe' })
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    // Final summary
    console.log(`\n${'='.repeat(80)}`)
    console.log('🎯 FINAL UNIVERSAL PATTERN RESULTS')
    console.log(`${'='.repeat(80)}`)
    
    let totalPatterns = 0
    let successfulGames = 0
    
    for (const result of results) {
      console.log(`\n📊 ${result.game.toUpperCase()} Summary:`)
      console.log(`   Target: 0x${result.target.toString(16).toUpperCase()}`)
      console.log(`   Pools: ${result.pools}`)
      console.log(`   References: ${result.references}`)
      console.log(`   Patterns: ${result.patterns.length}`)
      console.log(`   Success: ${result.success ? '✅' : '❌'}`)
      
      if (result.success) {
        successfulGames++
        totalPatterns += result.patterns.length
        
        console.log('   Generated patterns:')
        result.patterns.forEach((pattern, i) => {
          console.log(`     ${i + 1}. ${pattern}`)
        })
      }
    }
    
    console.log(`\n${'='.repeat(80)}`)
    if (successfulGames === 2) {
      console.log('🎉 SUCCESS: Universal patterns found for both games!')
      console.log(`Total patterns discovered: ${totalPatterns}`)
      console.log('')
      console.log('✅ Key achievements:')
      console.log('   • Used REAL ROMs in mGBA emulator')
      console.log('   • Found literal pools containing target addresses')
      console.log('   • Discovered ARM/THUMB instructions that reference pools')
      console.log('   • Generated universal byte patterns for detection')
      console.log('   • Followed proper RAM hacker methodology')
      console.log('')
      console.log('🔧 These patterns can be used to find partyData addresses')
      console.log('   in unknown ROM variants through instruction analysis')
      
    } else {
      console.log(`⚠️  Partial success: ${successfulGames}/2 games completed`)
      console.log('💡 Some patterns may still be usable for detection')
    }
    
    console.log(`\n✅ Real ROM Universal Pattern Detection Complete!`)
  }
}

async function main() {
  const detector = new UniversalPatternDetector()
  await detector.testBothGames()
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}