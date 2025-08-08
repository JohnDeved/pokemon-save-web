#!/usr/bin/env tsx
/**
 * Ultra-simple test to isolate the issue with mGBA Lua execution
 */

import { execSync } from 'node:child_process'
import { WebSocket } from 'ws'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'
const DOCKER_COMPOSE_FILE = 'docker/docker-compose.yml'

class UltraSimpleTest {
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

  async executeLua(code: string, timeout = 15000): Promise<any> {
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

  async basicTest(game: 'emerald' | 'quetzal'): Promise<void> {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🧪 Ultra-Simple Test for Pokemon ${game.toUpperCase()}`)
    console.log(`${'='.repeat(60)}`)
    
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
      // Test 1: Basic ROM info
      console.log('📋 Test 1: Basic ROM information...')
      const romInfo = await this.executeLua(`
        return {
          rom_title = emu:getGameTitle(),
          rom_size = emu:romSize(),
          first_byte = emu:read8(0x08000000)
        }
      `)
      
      console.log(`✅ ROM: ${romInfo.rom_title} (${romInfo.rom_size} bytes)`)
      
      // Test 2: Basic memory access
      console.log('📋 Test 2: Basic memory read test...')
      const memTest = await this.executeLua(`
        local bytes = {}
        for i = 0, 15 do
          table.insert(bytes, string.format("%02X", emu:read8(0x08000000 + i)))
        end
        return {
          first16bytes = table.concat(bytes, " "),
          rom_start = string.format("0x%08X", 0x08000000)
        }
      `)
      
      console.log(`✅ First 16 bytes: ${memTest.first16bytes}`)
      
      // Test 3: Simple pattern search (just first 1000 bytes)
      console.log('📋 Test 3: Simple pattern count (first 1KB)...')
      
      let searchCode = ''
      if (game === 'emerald') {
        searchCode = `
          local count = 0
          for addr = 0x08000000, 0x08000000 + 1000 - 4, 4 do
            local b1 = emu:read8(addr)
            local b2 = emu:read8(addr + 1)
            local b3 = emu:read8(addr + 2)
            local b4 = emu:read8(addr + 3)
            
            if b1 == 0xEC and b2 == 0x44 and b3 == 0x02 and b4 == 0x02 then
              count = count + 1
            end
          end
          return { game = "emerald", target = "EC 44 02 02", found = count, searchSize = 1000 }
        `
      } else {
        searchCode = `
          local count = 0
          for addr = 0x08000000, 0x08000000 + 1000 - 4, 4 do
            local b1 = emu:read8(addr)
            local b2 = emu:read8(addr + 1)
            local b3 = emu:read8(addr + 2)
            local b4 = emu:read8(addr + 3)
            
            if b1 == 0xB8 and b2 == 0x35 and b3 == 0x02 and b4 == 0x02 then
              count = count + 1
            end
          end
          return { game = "quetzal", target = "B8 35 02 02", found = count, searchSize = 1000 }
        `
      }
      
      const simpleSearch = await this.executeLua(searchCode)
      
      console.log(`✅ Simple search: ${simpleSearch.target} in first ${simpleSearch.searchSize} bytes`)
      console.log(`   Found: ${simpleSearch.found} matches`)
      
      // Test 4: Expand search if needed
      if (simpleSearch.found === 0) {
        console.log('📋 Test 4: Expanding search to first 100KB...')
        
        let expandedSearchCode = ''
        if (game === 'emerald') {
          expandedSearchCode = `
            local count = 0
            local locations = {}
            for addr = 0x08000000, 0x08000000 + 100000 - 4, 4 do
              local b1 = emu:read8(addr)
              local b2 = emu:read8(addr + 1)
              local b3 = emu:read8(addr + 2)
              local b4 = emu:read8(addr + 3)
              
              if b1 == 0xEC and b2 == 0x44 and b3 == 0x02 and b4 == 0x02 then
                count = count + 1
                table.insert(locations, string.format("0x%08X", addr))
                if count >= 10 then break end
              end
            end
            return { game = "emerald", target = "EC 44 02 02", found = count, locations = locations, searchSize = 100000 }
          `
        } else {
          expandedSearchCode = `
            local count = 0
            local locations = {}
            for addr = 0x08000000, 0x08000000 + 100000 - 4, 4 do
              local b1 = emu:read8(addr)
              local b2 = emu:read8(addr + 1)
              local b3 = emu:read8(addr + 2)
              local b4 = emu:read8(addr + 3)
              
              if b1 == 0xB8 and b2 == 0x35 and b3 == 0x02 and b4 == 0x02 then
                count = count + 1
                table.insert(locations, string.format("0x%08X", addr))
                if count >= 10 then break end
              end
            end
            return { game = "quetzal", target = "B8 35 02 02", found = count, locations = locations, searchSize = 100000 }
          `
        }
        
        const expandedSearch = await this.executeLua(expandedSearchCode)
        
        console.log(`✅ Expanded search: ${expandedSearch.target} in first ${expandedSearch.searchSize} bytes`)
        console.log(`   Found: ${expandedSearch.found} matches`)
        
        if (expandedSearch.locations && expandedSearch.locations.length > 0) {
          console.log('   Locations:')
          expandedSearch.locations.forEach((loc: string, i: number) => {
            console.log(`     ${i + 1}. ${loc}`)
          })
          
          // Test 5: If we found literal pools, search for referencing instructions
          if (expandedSearch.found > 0) {
            console.log('\n📋 Test 5: Search for instructions referencing first pool...')
            const firstPool = expandedSearch.locations[0]
            console.log(`   Analyzing pool: ${firstPool}`)
            const poolAddr = parseInt(firstPool, 16)
            
            const instSearch = await this.executeLua(`
              local poolAddr = ${poolAddr}
              local thumbCount = 0
              local armCount = 0
              local thumbPatterns = {}
              local armPatterns = {}
              
              -- Search backwards 500 bytes for THUMB LDR
              local searchStart = math.max(0x08000000, poolAddr - 500)
              for addr = searchStart, poolAddr - 2, 2 do
                local b1 = emu:read8(addr)
                if b1 >= 0x48 and b1 <= 0x4F then
                  local b2 = emu:read8(addr + 1)
                  local immediate = b2
                  local pc = math.floor((addr + 4) / 4) * 4
                  local calcPool = pc + (immediate * 4)
                  
                  if calcPool == poolAddr then
                    thumbCount = thumbCount + 1
                    table.insert(thumbPatterns, {
                      addr = string.format("0x%08X", addr),
                      pattern = string.format("%02X %02X", b1, b2)
                    })
                    if thumbCount >= 3 then break end
                  end
                end
              end
              
              -- Search backwards 500 bytes for ARM LDR
              for addr = searchStart, poolAddr - 4, 4 do
                local b3 = emu:read8(addr + 2)
                local b4 = emu:read8(addr + 3)
                if b3 == 0x9F and b4 == 0xE5 then
                  local b1 = emu:read8(addr)
                  local b2 = emu:read8(addr + 1)
                  local immediate = b1 + (b2 * 256)
                  local pc = addr + 8
                  local calcPool = pc + immediate
                  
                  if calcPool == poolAddr then
                    armCount = armCount + 1
                    table.insert(armPatterns, {
                      addr = string.format("0x%08X", addr),
                      pattern = string.format("E5 9F %02X %02X", b1, b2)
                    })
                    if armCount >= 3 then break end
                  end
                end
              end
              
              return {
                poolAddr = string.format("0x%08X", poolAddr),
                thumbFound = thumbCount,
                armFound = armCount,
                thumbPatterns = thumbPatterns,
                armPatterns = armPatterns
              }
            `)
            
            console.log(`   Pool: ${instSearch.poolAddr}`)
            console.log(`   THUMB patterns: ${instSearch.thumbFound}`)
            instSearch.thumbPatterns?.forEach((pattern: any, i: number) => {
              console.log(`     ${i + 1}. ${pattern.addr}: ${pattern.pattern}`)
            })
            
            console.log(`   ARM patterns: ${instSearch.armFound}`)
            instSearch.armPatterns?.forEach((pattern: any, i: number) => {
              console.log(`     ${i + 1}. ${pattern.addr}: ${pattern.pattern}`)
            })
            
            // Final result
            if (instSearch.thumbFound > 0 || instSearch.armFound > 0) {
              console.log(`\n🎉 SUCCESS: Found working Universal Patterns for ${game.toUpperCase()}!`)
              
              if (instSearch.thumbFound > 0) {
                const firstThumb = instSearch.thumbPatterns[0]
                console.log(`   ✅ THUMB Pattern: ${firstThumb.pattern}`)
                console.log(`      Instruction: ${firstThumb.addr}`)
                console.log(`      Resolves to: ${game === 'emerald' ? '0x020244EC' : '0x020235B8'}`)
              }
              
              if (instSearch.armFound > 0) {
                const firstArm = instSearch.armPatterns[0]
                console.log(`   ✅ ARM Pattern: ${firstArm.pattern}`)
                console.log(`      Instruction: ${firstArm.addr}`)
                console.log(`      Resolves to: ${game === 'emerald' ? '0x020244EC' : '0x020235B8'}`)
              }
            } else {
              console.log(`\n❌ No referencing instructions found for ${game.toUpperCase()}`)
            }
          }
        }
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

  async runUltraSimpleTests(): Promise<void> {
    console.log('🧪 Ultra-Simple Universal Pattern Tests')
    console.log('Step-by-step basic functionality validation')
    console.log(`${'='.repeat(60)}`)
    
    const games: ('emerald' | 'quetzal')[] = ['emerald', 'quetzal']
    
    for (const game of games) {
      await this.basicTest(game)
      
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
  const tester = new UltraSimpleTest()
  await tester.runUltraSimpleTests()
}

main().catch(console.error)

export { UltraSimpleTest }