#!/usr/bin/env tsx
/**
 * Debug script to understand pattern searching issues
 */

import { execSync } from 'node:child_process'
import { WebSocket } from 'ws'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'
const DOCKER_COMPOSE_FILE = 'docker/docker-compose.yml'

class PatternDebugger {
  private ws: WebSocket | null = null
  private connected = false

  async startMGBA(game: 'emerald' | 'quetzal'): Promise<boolean> {
    console.log(`🚀 Starting mGBA Docker for ${game}...`)
    
    try {
      execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
      await new Promise(resolve => setTimeout(resolve, 2000))
      
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

  async debugPatterns(game: 'emerald' | 'quetzal'): Promise<void> {
    console.log(`\n🔍 Debugging patterns for ${game.toUpperCase()}`)
    console.log('='.repeat(50))
    
    const started = await this.startMGBA(game)
    if (!started) {
      console.log('❌ Failed to start mGBA')
      return
    }
    
    const connected = await this.connectWebSocket()
    if (!connected) {
      console.log('❌ Failed to connect to WebSocket')
      return
    }
    
    try {
      // Get basic ROM info
      console.log('📋 Getting ROM information...')
      const romInfo = await this.executeLua(`
        return {
          title = emu:getGameTitle(),
          size = emu:romSize(),
          platform = emu:platform()
        }
      `)
      
      console.log(`✅ ROM: ${romInfo.title} (${romInfo.size} bytes, platform: ${romInfo.platform})`)
      
      // Test basic memory access
      console.log('🧪 Testing basic memory access...')
      const memTest = await this.executeLua(`
        local firstBytes = {}
        for i = 0, 15 do
          firstBytes[i+1] = string.format("%02X", emu:read8(0x08000000 + i))
        end
        return {
          firstBytes = table.concat(firstBytes, " "),
          canRead = true
        }
      `)
      
      console.log(`✅ First 16 ROM bytes: ${memTest.firstBytes}`)
      
      // Search for basic THUMB pattern components
      console.log('🔍 Searching for THUMB pattern components...')
      const thumbSearch = await this.executeLua(`
        local results = {
          pattern_48 = 0,
          pattern_68 = 0,
          pattern_30 = 0,
          full_pattern = 0,
          sample_locations = {}
        }
        
        local searchLimit = 100000 -- Small search for debugging
        
        for addr = 0x08000000, 0x08000000 + searchLimit do
          local b1 = emu:read8(addr)
          
          if b1 == 0x48 then
            results.pattern_48 = results.pattern_48 + 1
            
            if addr < 0x08000000 + 1000 then
              table.insert(results.sample_locations, string.format("0x48 at 0x%08X", addr))
            end
          elseif b1 == 0x68 then
            results.pattern_68 = results.pattern_68 + 1
          elseif b1 == 0x30 then
            results.pattern_30 = results.pattern_30 + 1
          end
          
          -- Check for full pattern
          if addr <= 0x08000000 + searchLimit - 6 then
            local b3 = emu:read8(addr + 2)
            local b5 = emu:read8(addr + 4)
            
            if b1 == 0x48 and b3 == 0x68 and b5 == 0x30 then
              results.full_pattern = results.full_pattern + 1
              table.insert(results.sample_locations, string.format("FULL pattern at 0x%08X", addr))
            end
          end
        end
        
        return results
      `, 45000)
      
      console.log(`✅ THUMB pattern search results:`)
      console.log(`   0x48 patterns: ${thumbSearch.pattern_48}`)
      console.log(`   0x68 patterns: ${thumbSearch.pattern_68}`)
      console.log(`   0x30 patterns: ${thumbSearch.pattern_30}`)
      console.log(`   Full 48-68-30 patterns: ${thumbSearch.full_pattern}`)
      
      if (thumbSearch.sample_locations.length > 0) {
        console.log('   Sample locations:')
        thumbSearch.sample_locations.slice(0, 10).forEach((loc: string) => {
          console.log(`     ${loc}`)
        })
      }
      
      if (thumbSearch.full_pattern > 0) {
        console.log('🎯 Testing address extraction from first full pattern...')
        const extractTest = await this.executeLua(`
          local found = false
          local result = {}
          
          for addr = 0x08000000, 0x08000000 + 100000 - 6 do
            local b1 = emu:read8(addr)
            local b3 = emu:read8(addr + 2)
            local b5 = emu:read8(addr + 4)
            
            if b1 == 0x48 and b3 == 0x68 and b5 == 0x30 then
              -- Found pattern, extract address
              local b2 = emu:read8(addr + 1)
              local instr = b1 + b2 * 256
              local immediate = b2 -- Simple immediate extraction
              
              local pc = math.floor((addr + 4) / 4) * 4
              local literalAddr = pc + immediate * 4
              
              result.patternAddr = string.format("0x%08X", addr)
              result.instruction = string.format("0x%04X", instr)
              result.immediate = immediate
              result.pc = string.format("0x%08X", pc)
              result.literalAddr = string.format("0x%08X", literalAddr)
              
              if literalAddr >= 0x08000000 and literalAddr < 0x08000000 + emu:romSize() then
                local ab1 = emu:read8(literalAddr)
                local ab2 = emu:read8(literalAddr + 1)
                local ab3 = emu:read8(literalAddr + 2)
                local ab4 = emu:read8(literalAddr + 3)
                
                local address = ab1 + ab2 * 256 + ab3 * 65536 + ab4 * 16777216
                result.extractedAddr = string.format("0x%08X", address)
                result.validRange = (address >= 0x02000000 and address < 0x04000000)
              else
                result.extractedAddr = "INVALID_LITERAL"
                result.validRange = false
              end
              
              found = true
              break
            end
          end
          
          return found and result or {error = "No pattern found"}
        `, 30000)
        
        if (extractTest.error) {
          console.log(`❌ ${extractTest.error}`)
        } else {
          console.log(`✅ Address extraction test:`)
          console.log(`   Pattern location: ${extractTest.patternAddr}`)
          console.log(`   Instruction: ${extractTest.instruction}`)
          console.log(`   Immediate: ${extractTest.immediate}`)
          console.log(`   PC: ${extractTest.pc}`)
          console.log(`   Literal address: ${extractTest.literalAddr}`)
          console.log(`   Extracted address: ${extractTest.extractedAddr}`)
          console.log(`   Valid RAM range: ${extractTest.validRange}`)
        }
      }
      
    } catch (error) {
      console.error('❌ Debug failed:', error)
    } finally {
      if (this.ws) {
        this.ws.close()
        this.ws = null
        this.connected = false
      }
    }
  }

  async cleanup(): Promise<void> {
    try {
      execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
    } catch {}
  }
}

async function main() {
  const debug = new PatternDebugger()
  
  try {
    await debug.debugPatterns('emerald')
    await new Promise(resolve => setTimeout(resolve, 3000))
    await debug.debugPatterns('quetzal')
  } catch (error) {
    console.error('💥 Debug failed:', error)
  } finally {
    await debug.cleanup()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}