#!/usr/bin/env tsx
/**
 * Manual Universal Pattern search - test the actual pools we found
 */

import { execSync } from 'node:child_process'
import { WebSocket } from 'ws'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'
const DOCKER_COMPOSE_FILE = 'docker/docker-compose.yml'

class ManualPatternSearch {
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

  async manualSearchTest(game: 'emerald' | 'quetzal'): Promise<void> {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🎯 Manual Pattern Search for Pokemon ${game.toUpperCase()}`)
    console.log(`${'='.repeat(60)}`)
    
    // Use known good literal pools from previous test
    const pools = {
      emerald: [0x08013FF8, 0x08017D3C, 0x08017D80],
      quetzal: [0x08011090, 0x08014D18, 0x08014D60]
    }
    
    const gamePools = pools[game]
    
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
        return emu:getGameTitle()
      `)
      
      console.log(`✅ ROM: ${romInfo}`)
      
      // Test each known pool manually
      for (let i = 0; i < gamePools.length; i++) {
        const poolAddr = gamePools[i]
        console.log(`\n🔍 Testing pool ${i + 1}: 0x${poolAddr.toString(16).toUpperCase()}`)
        
        // Search for THUMB instructions
        console.log('   Searching for THUMB LDR instructions...')
        const thumbResult = await this.executeLua(`
          local poolAddr = ${poolAddr}
          local found = 0
          local patterns = {}
          
          local searchStart = poolAddr - 1000
          if searchStart < 0x08000000 then
            searchStart = 0x08000000
          end
          
          for addr = searchStart, poolAddr - 2, 2 do
            local b1 = emu:read8(addr)
            if b1 >= 0x48 and b1 <= 0x4F then
              local b2 = emu:read8(addr + 1)
              local immediate = b2
              local pc = math.floor((addr + 4) / 4) * 4
              local calcPool = pc + (immediate * 4)
              
              if calcPool == poolAddr then
                found = found + 1
                table.insert(patterns, string.format("0x%08X: %02X %02X", addr, b1, b2))
                if found >= 5 then break end
              end
            end
          end
          
          return { found = found, patterns = patterns }
        `)
        
        console.log(`   THUMB patterns found: ${thumbResult.found}`)
        if (thumbResult.patterns && thumbResult.patterns.length > 0) {
          thumbResult.patterns.forEach((pattern: string, idx: number) => {
            console.log(`     ${idx + 1}. ${pattern}`)
          })
        }
        
        // Search for ARM instructions
        console.log('   Searching for ARM LDR instructions...')
        const armResult = await this.executeLua(`
          local poolAddr = ${poolAddr}
          local found = 0
          local patterns = {}
          
          local searchStart = poolAddr - 1000
          if searchStart < 0x08000000 then
            searchStart = 0x08000000
          end
          
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
                found = found + 1
                table.insert(patterns, string.format("0x%08X: E5 9F %02X %02X", addr, b1, b2))
                if found >= 5 then break end
              end
            end
          end
          
          return { found = found, patterns = patterns }
        `)
        
        console.log(`   ARM patterns found: ${armResult.found}`)
        if (armResult.patterns && armResult.patterns.length > 0) {
          armResult.patterns.forEach((pattern: string, idx: number) => {
            console.log(`     ${idx + 1}. ${pattern}`)
          })
        }
        
        // If we found any patterns, this pool works!
        if (thumbResult.found > 0 || armResult.found > 0) {
          console.log(`\n🎉 SUCCESS: Pool 0x${poolAddr.toString(16).toUpperCase()} has working patterns!`)
          
          if (thumbResult.found > 0) {
            const firstThumb = thumbResult.patterns[0]
            const thumbPattern = firstThumb.split(': ')[1]
            console.log(`   ✅ THUMB Universal Pattern: ${thumbPattern}`)
            console.log(`      Found at: ${firstThumb}`)
            console.log(`      Resolves to partyData: ${game === 'emerald' ? '0x020244EC' : '0x020235B8'}`)
          }
          
          if (armResult.found > 0) {
            const firstArm = armResult.patterns[0]
            const armPattern = firstArm.split(': ')[1]
            console.log(`   ✅ ARM Universal Pattern: ${armPattern}`)
            console.log(`      Found at: ${firstArm}`)
            console.log(`      Resolves to partyData: ${game === 'emerald' ? '0x020244EC' : '0x020235B8'}`)
          }
          
          // We found working patterns, so we can stop here
          break
        }
      }
      
    } catch (error) {
      console.error('❌ Search execution failed:', error)
    } finally {
      if (this.ws) {
        this.ws.close()
        this.ws = null
        this.connected = false
      }
    }
  }

  async runManualSearch(): Promise<void> {
    console.log('🎯 Manual Universal Pattern Search')
    console.log('Testing known literal pools for working instruction patterns')
    console.log(`${'='.repeat(60)}`)
    
    const games: ('emerald' | 'quetzal')[] = ['emerald', 'quetzal']
    
    for (const game of games) {
      await this.manualSearchTest(game)
      
      // Delay between games
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
    
    // Cleanup
    console.log('\n🧹 Cleaning up Docker containers...')
    try {
      execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
    } catch {}
    
    console.log('\n🎉 Manual Universal Pattern Search Complete!')
    console.log('The working patterns found can be used as Universal Patterns for both games.')
  }
}

// Main execution
async function main() {
  const searcher = new ManualPatternSearch()
  await searcher.runManualSearch()
}

main().catch(console.error)

export { ManualPatternSearch }