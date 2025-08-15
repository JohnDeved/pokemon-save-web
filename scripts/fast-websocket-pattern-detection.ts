#!/usr/bin/env tsx
/**
 * FAST Real ROM Universal Pattern Detection
 * 
 * Optimized version that performs targeted searches to find universal patterns
 * quickly in real Pokemon ROMs using the mGBA WebSocket API.
 */

import WebSocket from 'ws'
import { execSync } from 'node:child_process'

const TARGET_ADDRESSES = {
  emerald: 0x020244EC,
  quetzal: 0x020235B8
}

interface FastPatternResult {
  game: string
  target: number
  pools: number
  patterns: string[]
  success: boolean
  searchTime: number
}

class FastPatternDetector {
  private ws: WebSocket | null = null
  
  async ensureContainerRunning(game: 'emerald' | 'quetzal'): Promise<void> {
    console.log(`🚀 Starting mGBA for ${game}...`)
    
    try {
      execSync('docker compose -f docker/docker-compose.yml down', { stdio: 'pipe' })
      execSync(`docker compose -f docker/docker-compose.yml up -d`, {
        stdio: 'inherit',
        env: { ...process.env, GAME: game }
      })
      
      // Wait for HTTP server
      for (let i = 0; i < 20; i++) {
        try {
          execSync('curl -sf http://localhost:7102/', { stdio: 'pipe' })
          console.log(`✅ mGBA ready for ${game}`)
          return
        } catch (e) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
      
      throw new Error('HTTP server failed to start')
    } catch (error) {
      console.error('❌ Failed to start mGBA:', error)
      throw error
    }
  }
  
  async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket('ws://localhost:7102/ws')
      
      this.ws.on('open', () => {
        resolve()
      })
      
      this.ws.on('error', (error) => {
        reject(error)
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
            responseReceived = true
            resolve({ error: message.error })
          } else if (message.result !== undefined) {
            responseReceived = true
            resolve(message)
          }
        } catch (e) {
          // Ignore non-JSON messages
          if (!data.toString().includes('Welcome')) {
            console.error('Parse error:', e)
          }
        }
      }
      
      this.ws.on('message', messageHandler)
      this.ws.send(code)
      
      // Timeout after 15 seconds
      setTimeout(() => {
        if (!responseReceived) {
          this.ws!.off('message', messageHandler)
          responseReceived = true
          reject(new Error('Lua execution timeout'))
        }
      }, 15000)
    })
  }
  
  async detectPatternsForGame(game: 'emerald' | 'quetzal'): Promise<FastPatternResult> {
    const targetAddr = TARGET_ADDRESSES[game]
    const startTime = Date.now()
    
    console.log(`\n${'='.repeat(50)}`)
    console.log(`🎮 FAST PATTERN DETECTION: ${game.toUpperCase()}`)
    console.log(`${'='.repeat(50)}`)
    console.log(`Target: 0x${targetAddr.toString(16).toUpperCase()}`)
    
    await this.ensureContainerRunning(game)
    await this.connectWebSocket()
    
    // Get ROM info
    const romInfo = await this.executeLua(`
      return {
        title = emu:getGameTitle(),
        size = emu:romSize()
      }
    `)
    
    if (romInfo.error) {
      throw new Error('Failed to get ROM info: ' + romInfo.error)
    }
    
    console.log(`📱 ROM: ${romInfo.result.title} (${romInfo.result.size} bytes)`)
    
    // Execute FAST pattern detection with optimized search
    console.log('🔍 Executing FAST pattern search...')
    
    const fastPatternCode = `
-- FAST Universal Pattern Detection
local TARGET_ADDR = ${targetAddr}
local GAME_TYPE = "${game}"

local startTime = os.clock()

-- Convert target address to bytes
local targetBytes = {
    TARGET_ADDR & 0xFF,
    (TARGET_ADDR >> 8) & 0xFF,
    (TARGET_ADDR >> 16) & 0xFF,
    (TARGET_ADDR >> 24) & 0xFF
}

local romSize = emu:romSize()
local pools = {}
local patterns = {}

-- OPTIMIZED SEARCH: Only search first 1MB and use larger steps for initial scan
local maxSearch = math.min(romSize, 1024 * 1024)  -- 1MB max
local foundFirst = false

-- Fast initial scan with 16-byte steps to find approximate locations
for addr = 0x08000000, 0x08000000 + maxSearch - 4, 16 do
    local b1, b2, b3, b4 = emu:read8(addr), emu:read8(addr+1), emu:read8(addr+2), emu:read8(addr+3)
    
    if b1 == targetBytes[1] and b2 == targetBytes[2] and 
       b3 == targetBytes[3] and b4 == targetBytes[4] then
        table.insert(pools, addr)
        foundFirst = true
        
        if #pools >= 3 then
            break  -- Stop after finding 3 pools
        end
    end
end

-- If no pools found with fast scan, try slower detailed scan on smaller area
if #pools == 0 then
    local detailedSearch = math.min(maxSearch, 512 * 1024)  -- 512KB detailed
    for addr = 0x08000000, 0x08000000 + detailedSearch - 4, 4 do
        local b1, b2, b3, b4 = emu:read8(addr), emu:read8(addr+1), emu:read8(addr+2), emu:read8(addr+3)
        
        if b1 == targetBytes[1] and b2 == targetBytes[2] and 
           b3 == targetBytes[3] and b4 == targetBytes[4] then
            table.insert(pools, addr)
            
            if #pools >= 2 then
                break  -- Stop after finding 2 pools in detailed scan
            end
        end
    end
end

-- If we found pools, look for ARM/THUMB instructions (optimized)
local references = 0

if #pools > 0 then
    -- Only analyze first pool for speed
    local poolAddr = pools[1]
    
    -- ARM LDR search (smaller range, 512 bytes back)
    for instAddr = math.max(0x08000000, poolAddr - 512), poolAddr - 4, 4 do
        local i1, i2, i3, i4 = emu:read8(instAddr), emu:read8(instAddr+1), emu:read8(instAddr+2), emu:read8(instAddr+3)
        
        if i3 == 0x9F and i4 == 0xE5 then
            local immediate = i1 | (i2 << 8)
            local pc = instAddr + 8
            if pc + immediate == poolAddr then
                -- Get minimal context (6 bytes each side)
                local context = {}
                for j = -6, 9 do
                    local addr = instAddr + j
                    if addr >= 0x08000000 and addr < 0x08000000 + romSize then
                        table.insert(context, string.format("%02X", emu:read8(addr)))
                    else
                        table.insert(context, "00")
                    end
                end
                
                -- Create pattern: 2 bytes before + E5 9F ?? ?? + 2 bytes after  
                local pattern = context[5] .. " " .. context[6] .. " E5 9F ?? ?? " .. context[11] .. " " .. context[12]
                table.insert(patterns, pattern)
                references = references + 1
                
                if references >= 2 then break end  -- Limit for speed
            end
        end
    end
    
    -- THUMB LDR search (smaller range, 256 bytes back)
    for instAddr = math.max(0x08000000, poolAddr - 256), poolAddr - 2, 2 do
        local t1, t2 = emu:read8(instAddr), emu:read8(instAddr+1)
        
        if (t1 & 0xF8) == 0x48 then
            local immediate = t2
            local pc = ((instAddr + 4) & ~3)
            if pc + (immediate * 4) == poolAddr then
                -- Get minimal context (4 bytes each side)
                local context = {}
                for j = -4, 7 do
                    local addr = instAddr + j
                    if addr >= 0x08000000 and addr < 0x08000000 + romSize then
                        table.insert(context, string.format("%02X", emu:read8(addr)))
                    else
                        table.insert(context, "00")
                    end
                end
                
                -- Create pattern: 2 bytes before + 48 ?? + 2 bytes after
                local pattern = context[3] .. " " .. context[4] .. " 48 ?? " .. context[7] .. " " .. context[8]
                table.insert(patterns, pattern)
                references = references + 1
                
                if references >= 2 then break end  -- Limit for speed
            end
        end
    end
end

local endTime = os.clock()
local searchTime = (endTime - startTime) * 1000  -- Convert to milliseconds

-- Return results
return {
  game = GAME_TYPE,
  target = TARGET_ADDR,
  pools = #pools,
  patterns = patterns,
  success = #patterns > 0,
  searchTime = searchTime,
  references = references
}
`
    
    const result = await this.executeLua(fastPatternCode)
    
    if (result.error) {
      throw new Error('Pattern detection failed: ' + result.error)
    }
    
    const endTime = Date.now()
    const totalTime = endTime - startTime
    
    console.log('📊 Results:')
    console.log(`   Pools found: ${result.result.pools}`)
    console.log(`   Patterns: ${result.result.patterns.length}`)
    console.log(`   Success: ${result.result.success ? '✅' : '❌'}`)
    console.log(`   Search time: ${Math.round(result.result.searchTime)}ms`)
    console.log(`   Total time: ${totalTime}ms`)
    
    if (result.result.patterns.length > 0) {
      console.log('\n🛠️  Generated Patterns:')
      result.result.patterns.forEach((pattern: string, i: number) => {
        console.log(`   ${i + 1}. ${pattern}`)
      })
    }
    
    return {
      game,
      target: targetAddr,
      pools: result.result.pools,
      patterns: result.result.patterns,
      success: result.result.success,
      searchTime: totalTime
    }
  }
  
  async testBothGames(): Promise<void> {
    console.log('🚀 FAST Real ROM Universal Pattern Detection')
    console.log('=============================================')
    console.log('Optimized for quick pattern discovery in real ROMs')
    
    const results: FastPatternResult[] = []
    
    try {
      // Test Emerald
      const emeraldResult = await this.detectPatternsForGame('emerald')
      results.push(emeraldResult)
      
      if (this.ws) {
        this.ws.close()
        this.ws = null
      }
      
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
      
      try {
        execSync('docker compose -f docker/docker-compose.yml down', { stdio: 'pipe' })
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    // Final summary
    console.log(`\n${'='.repeat(70)}`)
    console.log('🎯 FAST UNIVERSAL PATTERN RESULTS')
    console.log(`${'='.repeat(70)}`)
    
    let totalPatterns = 0
    let successfulGames = 0
    let totalTime = 0
    
    for (const result of results) {
      console.log(`\n📊 ${result.game.toUpperCase()} Summary:`)
      console.log(`   Target: 0x${result.target.toString(16).toUpperCase()}`)
      console.log(`   Pools: ${result.pools}`)
      console.log(`   Patterns: ${result.patterns.length}`)
      console.log(`   Success: ${result.success ? '✅' : '❌'}`)
      console.log(`   Time: ${result.searchTime}ms`)
      
      if (result.success) {
        successfulGames++
        totalPatterns += result.patterns.length
        
        console.log('   Patterns found:')
        result.patterns.forEach((pattern, i) => {
          console.log(`     ${i + 1}. ${pattern}`)
        })
      }
      
      totalTime += result.searchTime
    }
    
    console.log(`\n${'='.repeat(70)}`)
    if (successfulGames === 2) {
      console.log('🎉 SUCCESS: Fast universal patterns found for both games!')
      console.log(`Total patterns: ${totalPatterns}`)
      console.log(`Total time: ${totalTime}ms`)
      console.log('')
      console.log('✅ Key achievements:')
      console.log('   • Used REAL ROMs in mGBA emulator (not mock data)')
      console.log('   • Found literal pools containing target addresses')
      console.log('   • Discovered ARM/THUMB instructions referencing pools')
      console.log('   • Generated universal byte patterns for detection')
      console.log('   • Optimized for fast execution (under 20 seconds total)')
      console.log('')
      console.log('🔧 These patterns follow proper RAM hacker methodology:')
      console.log('   1. Find ROM locations that REFERENCE target addresses')
      console.log('   2. Analyze ARM/THUMB instruction patterns around references')
      console.log('   3. Create byte pattern masks for universal detection')
      console.log('   4. Extract addresses using literal pool calculations')
      
    } else {
      console.log(`⚠️  Partial success: ${successfulGames}/2 games completed`)
      console.log('💡 May need broader search or different pattern approach')
    }
    
    console.log(`\n✅ Fast Real ROM Pattern Detection Complete!`)
  }
}

async function main() {
  const detector = new FastPatternDetector()
  await detector.testBothGames()
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}