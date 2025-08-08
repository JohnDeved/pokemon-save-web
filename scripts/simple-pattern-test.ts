#!/usr/bin/env tsx
/**
 * Simple test to validate mGBA Lua API basic functionality
 */

import { execSync } from 'node:child_process'
import { WebSocket } from 'ws'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'
const DOCKER_COMPOSE_FILE = 'docker/docker-compose.yml'

class SimplePatternTest {
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

  async testBasicPatternSearch(game: 'emerald' | 'quetzal'): Promise<void> {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🧪 Simple Pattern Test for Pokemon ${game.toUpperCase()}`)
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
      
      // Test 1: Direct address search using hardcoded bytes
      console.log('🔍 Test 1: Direct address search...')
      
      let targetBytesStr = ''
      if (game === 'emerald') {
        targetBytesStr = 'EC 44 02 02' // 0x020244EC in little-endian
      } else {
        targetBytesStr = 'B8 35 02 02' // 0x020235B8 in little-endian
      }
      
      const directSearch = await this.executeLua(`
        local targetBytes = {0xEC, 0x44, 0x02, 0x02}
        if "${game}" == "quetzal" then
          targetBytes = {0xB8, 0x35, 0x02, 0x02}
        end
        
        local romSize = emu:romSize()
        local searchLimit = math.min(romSize, 1000000) -- 1MB limit
        local found = 0
        local locations = {}
        
        for addr = 0x08000000, 0x08000000 + searchLimit - 4, 4 do
            local b1 = emu:read8(addr)
            local b2 = emu:read8(addr + 1)
            local b3 = emu:read8(addr + 2)
            local b4 = emu:read8(addr + 3)
            
            if b1 == targetBytes[1] and b2 == targetBytes[2] and 
               b3 == targetBytes[3] and b4 == targetBytes[4] then
                found = found + 1
                table.insert(locations, string.format("0x%08X", addr))
                if found >= 10 then break end
            end
        end
        
        return {
          target = "${targetBytesStr}",
          found = found,
          locations = locations,
          searchLimit = searchLimit
        }
      `, 30000)
      
      console.log(`Target bytes: ${directSearch.target}`)
      console.log(`Search limit: ${directSearch.searchLimit} bytes`)
      console.log(`Literal pools found: ${directSearch.found}`)
      if (directSearch.locations && directSearch.locations.length > 0) {
        console.log('Literal pools at:')
        directSearch.locations.slice(0, 5).forEach((loc: string, i: number) => {
          console.log(`  ${i + 1}. ${loc}`)
        })
      }
      
      if (directSearch.found === 0) {
        console.log('❌ No literal pools found!')
        return
      }
      
      // Test 2: Search for THUMB LDR patterns (48 ??)
      console.log('\n🔍 Test 2: THUMB LDR pattern search...')
      const thumbSearch = await this.executeLua(`
        local found = 0
        local patterns = {}
        
        for addr = 0x08000000, 0x08000000 + 100000 - 2, 2 do
            local b1 = emu:read8(addr)
            
            if b1 >= 0x48 and b1 <= 0x4F then
                found = found + 1
                if found <= 10 then
                  local b2 = emu:read8(addr + 1)
                  table.insert(patterns, {
                    addr = string.format("0x%08X", addr),
                    pattern = string.format("%02X %02X", b1, b2)
                  })
                end
                if found >= 500 then break end
            end
        end
        
        return {
          found = found,
          patterns = patterns
        }
      `, 30000)
      
      console.log(`THUMB LDR patterns found: ${thumbSearch.found}`)
      if (thumbSearch.patterns && thumbSearch.patterns.length > 0) {
        console.log('First 10 THUMB patterns:')
        thumbSearch.patterns.forEach((pat: any, i: number) => {
          console.log(`  ${i + 1}. ${pat.addr}: ${pat.pattern}`)
        })
      }
      
      // Test 3: Search for ARM LDR patterns (E5 9F ?? ??)
      console.log('\n🔍 Test 3: ARM LDR pattern search...')
      const armSearch = await this.executeLua(`
        local found = 0
        local patterns = {}
        
        for addr = 0x08000000, 0x08000000 + 100000 - 4, 4 do
            local b3 = emu:read8(addr + 2)
            local b4 = emu:read8(addr + 3)
            
            if b3 == 0x9F and b4 == 0xE5 then
                found = found + 1
                if found <= 10 then
                  local b1 = emu:read8(addr)
                  local b2 = emu:read8(addr + 1)
                  table.insert(patterns, {
                    addr = string.format("0x%08X", addr),
                    pattern = string.format("E5 9F %02X %02X", b1, b2)
                  })
                end
                if found >= 500 then break end
            end
        end
        
        return {
          found = found,
          patterns = patterns
        }
      `, 30000)
      
      console.log(`ARM LDR patterns found: ${armSearch.found}`)
      if (armSearch.patterns && armSearch.patterns.length > 0) {
        console.log('First 10 ARM patterns:')
        armSearch.patterns.forEach((pat: any, i: number) => {
          console.log(`  ${i + 1}. ${pat.addr}: ${pat.pattern}`)
        })
      }
      
      // Summary
      console.log('\n📊 Test Summary:')
      console.log(`Game: ${game.toUpperCase()}`)
      console.log(`Expected address: 0x${expectedAddress.toString(16).toUpperCase()}`)
      console.log(`Literal pools: ${directSearch.found}`)
      console.log(`THUMB patterns: ${thumbSearch.found}`)
      console.log(`ARM patterns: ${armSearch.found}`)
      
      if (directSearch.found > 0 && (thumbSearch.found > 0 || armSearch.found > 0)) {
        console.log('🎉 SUCCESS: Found both literal pools and instruction patterns!')
        console.log('✅ Next step: Match instructions to literal pools')
      } else {
        console.log('❌ INCOMPLETE: Missing either literal pools or instruction patterns')
      }
      
    } catch (error) {
      console.error('❌ Test execution failed:', error)
    } finally {
      if (this.ws) {
        this.ws.close()
        this.ws = null
        this.connected = false
      }
    }
  }

  async runSimpleTests(): Promise<void> {
    console.log('🧪 Simple Pattern Search Tests')
    console.log('Testing basic functionality step by step')
    console.log(`${'='.repeat(60)}`)
    
    const games: ('emerald' | 'quetzal')[] = ['emerald', 'quetzal']
    
    for (const game of games) {
      await this.testBasicPatternSearch(game)
      
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
  const tester = new SimplePatternTest()
  await tester.runSimpleTests()
}

main().catch(console.error)

export { SimplePatternTest }