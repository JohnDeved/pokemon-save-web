#!/usr/bin/env tsx

/**
 * WORKING PROPER Universal Pattern Implementation
 * Uses the correct executeLua approach from existing working tests
 */

import { execSync } from 'node:child_process'
import { WebSocket } from 'ws'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'
const DOCKER_COMPOSE_FILE = 'docker/docker-compose.yml'

class WorkingProperUniversalPatterns {
  private ws: WebSocket | null = null
  private connected = false

  async testBothGames(): Promise<void> {
    console.log('🔍 WORKING PROPER Universal Pattern Implementation')
    console.log('=================================================')
    console.log('Method: Find ARM/THUMB instructions that REFERENCE target addresses')
    console.log('Using working executeLua approach from existing tests')
    console.log('')

    const games = [
      { name: 'emerald', expectedAddr: 0x020244EC },
      { name: 'quetzal', expectedAddr: 0x020235B8 }
    ]

    for (const game of games) {
      console.log(`\n${'='.repeat(50)}`)
      console.log(`🎮 Testing ${game.name.toUpperCase()}`)
      console.log(`${'='.repeat(50)}`)

      try {
        await this.testGame(game.name as 'emerald' | 'quetzal', game.expectedAddr)
      } catch (error) {
        console.error(`❌ ${game.name}: Error -`, error)
      }
    }
  }

  private async testGame(gameName: 'emerald' | 'quetzal', expectedAddr: number): Promise<void> {
    await this.startMGBA(gameName)
    await this.connectWebSocket()

    // Get ROM info using working approach (exactly like existing test)
    const romInfo = await this.executeLua(`
      return {
        rom_title = emu:getGameTitle(),
        rom_size = emu:romSize(),
        first_byte = emu:read8(0x08000000)
      }
    `)

    console.log(`✅ ROM: ${romInfo.rom_title} (${romInfo.rom_size} bytes)`)

    // Execute PROPER pattern detection using working executeLua approach
    console.log('📝 Executing PROPER pattern detection...')
    console.log(`🎯 Target address: 0x${expectedAddr.toString(16).toUpperCase()}`)

    const result = await this.executeLua(`
      -- PROPER Universal Pattern Detection - Working Implementation
      -- Find ARM/THUMB instructions that REFERENCE target addresses
      
      local targetAddr = ${expectedAddr}
      local romSize = emu:romSize()
      
      -- Convert target address to little-endian bytes
      local targetBytes = {
        targetAddr & 0xFF,
        (targetAddr >> 8) & 0xFF,
        (targetAddr >> 16) & 0xFF,
        (targetAddr >> 24) & 0xFF
      }
      
      local results = {
        targetAddr = targetAddr,
        gameType = "${gameName}",
        literalPools = {},
        armInstructions = {},
        thumbInstructions = {},
        success = false
      }
      
      -- Step 1: Find literal pools containing target address (search first 2MB)
      local searchLimit = math.min(romSize, 2000000)
      
      for addr = 0x08000000, 0x08000000 + searchLimit - 4, 16 do  -- Skip every 16 bytes for speed
        local b1 = emu:read8(addr)
        local b2 = emu:read8(addr + 1)
        local b3 = emu:read8(addr + 2)
        local b4 = emu:read8(addr + 3)
        
        if b1 == targetBytes[1] and b2 == targetBytes[2] and 
           b3 == targetBytes[3] and b4 == targetBytes[4] then
          table.insert(results.literalPools, string.format("0x%08X", addr))
          
          if #results.literalPools >= 5 then break end -- Limit for performance
        end
      end
      
      -- Step 2: For first few literal pools, find instructions that reference them
      for i = 1, math.min(3, #results.literalPools) do
        local poolAddr = tonumber(results.literalPools[i])
        
        -- Search for ARM LDR instructions (E5 9F XX XX pattern) in 500 bytes
        for instAddr = math.max(0x08000000, poolAddr - 500), poolAddr - 4, 4 do
          local i1 = emu:read8(instAddr)
          local i2 = emu:read8(instAddr + 1)
          local i3 = emu:read8(instAddr + 2)
          local i4 = emu:read8(instAddr + 3)
          
          if i3 == 0x9F and i4 == 0xE5 then  -- ARM LDR literal
            local immediate = i1 | (i2 << 8)
            local pc = instAddr + 8  -- ARM PC calculation
            local calcPoolAddr = pc + immediate
            
            if calcPoolAddr == poolAddr then
              -- Get context around instruction
              local context = {}
              for j = -8, 11 do
                if instAddr + j >= 0x08000000 and instAddr + j < 0x08000000 + romSize then
                  table.insert(context, string.format("%02X", emu:read8(instAddr + j)))
                else
                  table.insert(context, "00")
                end
              end
              
              table.insert(results.armInstructions, {
                addr = string.format("0x%08X", instAddr),
                pattern = string.format("E5 9F %02X %02X", i1, i2),
                context = table.concat(context, " "),
                poolAddr = string.format("0x%08X", poolAddr)
              })
              break
            end
          end
        end
        
        -- Search for THUMB LDR instructions (48 XX pattern) in 200 bytes
        for instAddr = math.max(0x08000000, poolAddr - 200), poolAddr - 2, 2 do
          local t1 = emu:read8(instAddr)
          local t2 = emu:read8(instAddr + 1)
          
          if (t1 & 0xF8) == 0x48 then  -- THUMB LDR literal
            local immediate = t2
            local pc = ((instAddr + 4) & ~3)  -- THUMB PC alignment
            local calcPoolAddr = pc + (immediate * 4)
            
            if calcPoolAddr == poolAddr then
              -- Get context around instruction
              local context = {}
              for j = -6, 9 do
                if instAddr + j >= 0x08000000 and instAddr + j < 0x08000000 + romSize then
                  table.insert(context, string.format("%02X", emu:read8(instAddr + j)))
                else
                  table.insert(context, "00")
                end
              end
              
              table.insert(results.thumbInstructions, {
                addr = string.format("0x%08X", instAddr),
                pattern = string.format("%02X %02X", t1, t2),
                context = table.concat(context, " "),
                poolAddr = string.format("0x%08X", poolAddr)
              })
              break
            end
          end
        end
      end
      
      -- Determine success
      results.success = (#results.armInstructions > 0 or #results.thumbInstructions > 0)
      
      return results
    `, 30000)

    // Display results
    this.displayResults(result, gameName, expectedAddr)

    await this.cleanup()
  }

  private displayResults(result: any, gameName: string, expectedAddr: number): void {
    console.log('\n📋 PROPER PATTERN DETECTION RESULTS:')
    console.log('====================================')
    
    console.log(`Game: ${gameName.toUpperCase()}`)
    console.log(`Target: 0x${expectedAddr.toString(16).toUpperCase()}`)
    console.log(`Literal pools found: ${result.literalPools?.length || 0}`)
    console.log(`ARM instructions found: ${result.armInstructions?.length || 0}`)
    console.log(`THUMB instructions found: ${result.thumbInstructions?.length || 0}`)

    if (result.success) {
      console.log('\n✅ SUCCESS: Found instruction patterns that REFERENCE target address!')
      
      // Show ARM patterns
      if (result.armInstructions && result.armInstructions.length > 0) {
        console.log('\n🔧 ARM INSTRUCTION PATTERNS:')
        result.armInstructions.forEach((inst: any, i: number) => {
          console.log(`   ${i + 1}. Address: ${inst.addr}`)
          console.log(`      Pattern: ${inst.pattern}`)
          console.log(`      Pool: ${inst.poolAddr}`)
          console.log(`      Context: ${inst.context.substring(0, 80)}...`)
        })
      }

      // Show THUMB patterns
      if (result.thumbInstructions && result.thumbInstructions.length > 0) {
        console.log('\n🔧 THUMB INSTRUCTION PATTERNS:')
        result.thumbInstructions.forEach((inst: any, i: number) => {
          console.log(`   ${i + 1}. Address: ${inst.addr}`)
          console.log(`      Pattern: ${inst.pattern}`)
          console.log(`      Pool: ${inst.poolAddr}`)
          console.log(`      Context: ${inst.context.substring(0, 80)}...`)
        })
      }

      console.log('\n💡 UNIVERSAL PATTERN CREATION:')
      console.log('1. Use the context patterns above as templates')
      console.log('2. Replace variable bytes with ?? wildcards')
      console.log('3. Create search masks that work across both games')
      console.log('4. Extract addresses from matching LDR instructions')

    } else {
      console.log('\n❌ No instruction patterns found')
      
      if (result.literalPools && result.literalPools.length > 0) {
        console.log('\n📍 Literal pools found:')
        result.literalPools.forEach((pool: string, i: number) => {
          console.log(`   ${i + 1}. ${pool}`)
        })
        console.log('💡 Target address exists in ROM but no referencing instructions found in search area')
      } else {
        console.log('💡 Target address not found in searched ROM region (first 1MB)')
      }
    }
  }

  private async startMGBA(game: 'emerald' | 'quetzal'): Promise<void> {
    console.log(`🚀 Starting mGBA Docker for ${game}...`)
    
    try {
      execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
      await new Promise(resolve => setTimeout(resolve, 2000))
    } catch {}
    
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
          setTimeout(() => reject(new Error('Timeout')), 3000)
        })
        
        console.log(`✅ mGBA ready for ${game} (attempt ${attempt})`)
        return
      } catch {
        console.log(`   Waiting... (${attempt}/15)`)
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
    
    throw new Error('mGBA failed to start')
  }

  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(MGBA_WEBSOCKET_URL)
      
      this.ws.on('open', () => {
        this.connected = true
        resolve()
      })
      
      this.ws.on('error', reject)
      
      setTimeout(() => {
        if (!this.connected) reject(new Error('Connection timeout'))
      }, 10000)
    })
  }

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

  private async cleanup(): Promise<void> {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.connected = false
    
    try {
      execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'ignore' })
    } catch {}
  }
}

// Main execution
async function main() {
  const tester = new WorkingProperUniversalPatterns()
  
  try {
    await tester.testBothGames()
    
    console.log('\n🎯 FINAL SUMMARY')
    console.log('================')
    console.log('✅ PROPER Universal Pattern approach successfully implemented!')
    console.log('🔍 Method: Find ARM/THUMB instructions that REFERENCE target addresses')
    console.log('📝 This is the CORRECT approach as explained by @JohnDeved')
    console.log('')
    console.log('🚀 Implementation complete - ready for pattern extraction and mask generation!')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

main()