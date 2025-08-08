#!/usr/bin/env tsx
/**
 * Debug Universal Pattern search to understand what's happening
 */

import { execSync } from 'node:child_process'
import { WebSocket } from 'ws'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'
const DOCKER_COMPOSE_FILE = 'docker/docker-compose.yml'

class DebugPatternValidator {
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
      
      // Wait for readiness
      for (let attempt = 1; attempt <= 15; attempt++) {
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
          if (attempt < 15) {
            console.log(`   Waiting... (${attempt}/15)`)
            await new Promise(resolve => setTimeout(resolve, 3000))
          }
        }
      }
      
      console.log('❌ mGBA failed to become ready')
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

  async debugPatternSearch(game: 'emerald' | 'quetzal'): Promise<void> {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🐛 Debugging Pattern Search for Pokemon ${game.toUpperCase()}`)
    console.log(`${'='.repeat(60)}`)
    
    const expectedAddresses = {
      emerald: 0x020244EC,
      quetzal: 0x020235B8
    }
    
    const expectedAddress = expectedAddresses[game]
    
    // Start mGBA
    const started = await this.startMGBA(game)
    if (!started) {
      console.log('❌ Failed to start mGBA')
      return
    }
    
    // Connect to WebSocket
    const connected = await this.connectWebSocket()
    if (!connected) {
      console.log('❌ Failed to connect to WebSocket')
      return
    }
    
    try {
      // Get ROM info
      console.log('📋 Getting ROM information...')
      const romInfo = await this.executeLua(`
        return {
          rom_title = emu:getGameTitle(),
          rom_size = emu:romSize(),
          first_byte = emu:read8(0x08000000)
        }
      `)
      
      console.log(`✅ ROM: ${romInfo.rom_title} (${romInfo.rom_size} bytes)`)
      
      // Step 1: Search for target address bytes directly in ROM
      console.log('🔍 Step 1: Searching for target address bytes in ROM...')
      const targetSearch = await this.executeLua(`
        local expectedAddr = ${expectedAddress}
        
        -- Use bit operations safe for Lua
        local function getByte(addr, byteNum)
          if byteNum == 0 then
            return expectedAddr % 256
          elseif byteNum == 1 then
            return math.floor(expectedAddr / 256) % 256
          elseif byteNum == 2 then
            return math.floor(expectedAddr / 65536) % 256
          else
            return math.floor(expectedAddr / 16777216) % 256
          end
        end
        
        local targetBytes = {
            getByte(expectedAddr, 0),
            getByte(expectedAddr, 1),
            getByte(expectedAddr, 2),
            getByte(expectedAddr, 3)
        }
        
        local romSize = emu:romSize()
        local searchLimit = math.min(romSize, 2000000) -- 2MB limit
        local found = 0
        local pools = {}
        
        for addr = 0x08000000, 0x08000000 + searchLimit - 4, 4 do
            local b1 = emu:read8(addr)
            local b2 = emu:read8(addr + 1)
            local b3 = emu:read8(addr + 2)
            local b4 = emu:read8(addr + 3)
            
            if b1 == targetBytes[1] and b2 == targetBytes[2] and 
               b3 == targetBytes[3] and b4 == targetBytes[4] then
                found = found + 1
                table.insert(pools, string.format("0x%08X", addr))
                if found >= 10 then break end
            end
        end
        
        return {
            expectedAddr = string.format("0x%08X", expectedAddr),
            targetBytes = string.format("%02X %02X %02X %02X", targetBytes[1], targetBytes[2], targetBytes[3], targetBytes[4]),
            searchLimit = searchLimit,
            found = found,
            pools = pools
        }
      `, 30000)
      
      console.log(`Target address: ${targetSearch.expectedAddr}`)
      console.log(`Target bytes: ${targetSearch.targetBytes}`)
      console.log(`Search limit: ${targetSearch.searchLimit} bytes`)
      console.log(`Literal pools found: ${targetSearch.found}`)
      if (targetSearch.pools.length > 0) {
        console.log('Pools found at:')
        targetSearch.pools.forEach((pool: string, i: number) => {
          console.log(`  ${i + 1}. ${pool}`)
        })
      }
      
      if (targetSearch.found === 0) {
        console.log('❌ No literal pools found! Target address does not exist in ROM.')
        return
      }
      
      // Step 2: For first pool, search for THUMB instructions
      console.log('\n🔍 Step 2: Searching for THUMB instructions referencing first pool...')
      const thumbSearch = await this.executeLua(`
        local poolAddr = ${targetSearch.pools[0]?.replace('0x', '0x')}
        local found = 0
        local instructions = {}
        
        local thumbSearchStart = math.max(0x08000000, poolAddr - 1000)
        
        for instAddr = thumbSearchStart, poolAddr - 2, 2 do
            local thumb1 = emu:read8(instAddr)
            local thumb2 = emu:read8(instAddr + 1)
            
            -- Check for THUMB LDR PC-relative: 01001xxx xxxxxxxx (0x48-0x4F)
            if thumb1 >= 0x48 and thumb1 <= 0x4F then
                local immediate = thumb2
                local pc = math.floor((instAddr + 4) / 4) * 4
                local calcPoolAddr = pc + (immediate * 4)
                
                if calcPoolAddr == poolAddr then
                    found = found + 1
                    table.insert(instructions, {
                        addr = string.format("0x%08X", instAddr),
                        bytes = string.format("%02X %02X", thumb1, thumb2),
                        immediate = immediate,
                        pc = string.format("0x%08X", pc),
                        calculation = string.format("PC(0x%08X) + %d*4 = 0x%08X", pc, immediate, calcPoolAddr)
                    })
                    if found >= 5 then break end
                end
            end
        end
        
        return {
            poolAddr = string.format("0x%08X", poolAddr),
            searchStart = string.format("0x%08X", thumbSearchStart),
            found = found,
            instructions = instructions
        }
      `, 30000)
      
      console.log(`Pool address: ${thumbSearch.poolAddr}`)
      console.log(`THUMB search start: ${thumbSearch.searchStart}`)
      console.log(`THUMB instructions found: ${thumbSearch.found}`)
      if (thumbSearch.instructions.length > 0) {
        console.log('THUMB instructions found:')
        thumbSearch.instructions.forEach((inst: any, i: number) => {
          console.log(`  ${i + 1}. ${inst.addr}: ${inst.bytes}`)
          console.log(`     Calculation: ${inst.calculation}`)
        })
      }
      
      // Step 3: Search for ARM instructions  
      console.log('\n🔍 Step 3: Searching for ARM instructions referencing first pool...')
      const armSearch = await this.executeLua(`
        local poolAddr = ${targetSearch.pools[0]?.replace('0x', '0x')}
        local found = 0
        local instructions = {}
        
        local armSearchStart = math.max(0x08000000, poolAddr - 1000)
        
        for instAddr = armSearchStart, poolAddr - 4, 4 do
            local arm1 = emu:read8(instAddr)
            local arm2 = emu:read8(instAddr + 1)  
            local arm3 = emu:read8(instAddr + 2)
            local arm4 = emu:read8(instAddr + 3)
            
            -- Check for ARM LDR PC-relative: xx xx 9F E5
            if arm3 == 0x9F and arm4 == 0xE5 then
                local immediate = arm1 + (arm2 * 256)
                local pc = instAddr + 8
                local calcPoolAddr = pc + immediate
                
                if calcPoolAddr == poolAddr then
                    found = found + 1
                    table.insert(instructions, {
                        addr = string.format("0x%08X", instAddr),
                        bytes = string.format("E5 9F %02X %02X", arm1, arm2),
                        immediate = immediate,
                        pc = string.format("0x%08X", pc),
                        calculation = string.format("PC(0x%08X) + %d = 0x%08X", pc, immediate, calcPoolAddr)
                    })
                    if found >= 5 then break end
                end
            end
        end
        
        return {
            poolAddr = string.format("0x%08X", poolAddr),
            searchStart = string.format("0x%08X", armSearchStart),
            found = found,
            instructions = instructions
        }
      `, 30000)
      
      console.log(`Pool address: ${armSearch.poolAddr}`)
      console.log(`ARM search start: ${armSearch.searchStart}`)
      console.log(`ARM instructions found: ${armSearch.found}`)
      if (armSearch.instructions.length > 0) {
        console.log('ARM instructions found:')
        armSearch.instructions.forEach((inst: any, i: number) => {
          console.log(`  ${i + 1}. ${inst.addr}: ${inst.bytes}`)
          console.log(`     Calculation: ${inst.calculation}`)
        })
      }
      
      // Summary
      console.log('\n📊 Debug Summary:')
      console.log(`Target address: ${expectedAddress.toString(16).toUpperCase()}`)
      console.log(`Literal pools found: ${targetSearch.found}`)
      console.log(`THUMB patterns found: ${thumbSearch.found}`)
      console.log(`ARM patterns found: ${armSearch.found}`)
      
      const totalPatterns = thumbSearch.found + armSearch.found
      if (totalPatterns > 0) {
        console.log(`🎉 SUCCESS: Found ${totalPatterns} working patterns!`)
        console.log('✅ Universal Patterns can be extracted from these results')
      } else {
        console.log('❌ FAILED: No working patterns found')
        console.log('🔧 Need to debug further or adjust search parameters')
      }
      
    } catch (error) {
      console.error('❌ Debug execution failed:', error)
    } finally {
      if (this.ws) {
        this.ws.close()
        this.ws = null
        this.connected = false
      }
    }
  }

  async runDebugBothGames(): Promise<void> {
    console.log('🐛 Debug Universal Pattern Search')
    console.log('Testing pattern detection step by step')
    console.log(`${'='.repeat(60)}`)
    
    const games: ('emerald' | 'quetzal')[] = ['emerald', 'quetzal']
    
    for (const game of games) {
      await this.debugPatternSearch(game)
      
      // Delay between games
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
    
    // Cleanup
    console.log('\n🧹 Cleaning up Docker containers...')
    try {
      execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
    } catch {}
  }
}

// Main execution
async function main() {
  const validator = new DebugPatternValidator()
  await validator.runDebugBothGames()
}

main().catch(console.error)

export { DebugPatternValidator }