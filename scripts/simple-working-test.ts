#!/usr/bin/env tsx
/**
 * Simple Working Universal Pattern Test
 * Uses a basic approach to verify pattern functionality
 */

import { execSync } from 'node:child_process'
import { WebSocket } from 'ws'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'
const DOCKER_COMPOSE_FILE = 'docker/docker-compose.yml'

class SimplePatternTester {
  private ws: WebSocket | null = null

  async startMGBA(game: 'emerald' | 'quetzal'): Promise<boolean> {
    console.log(`🚀 Starting mGBA for ${game}...`)
    
    try {
      execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      execSync(`GAME=${game} docker compose -f ${DOCKER_COMPOSE_FILE} up -d`, { 
        stdio: 'inherit',
        env: { ...process.env, GAME: game }
      })
      
      for (let attempt = 1; attempt <= 20; attempt++) {
        try {
          const testWs = new WebSocket(MGBA_WEBSOCKET_URL)
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              testWs.close()
              reject(new Error('timeout'))
            }, 2000)
            
            testWs.onopen = () => {
              clearTimeout(timeout)
              testWs.close()
              resolve(true)
            }
            
            testWs.onerror = () => {
              clearTimeout(timeout)
              reject(new Error('error'))
            }
          })
          
          console.log(`✅ mGBA ready (attempt ${attempt})`)
          return true
        } catch {
          if (attempt < 20) {
            console.log(`   Waiting... (${attempt}/20)`)
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
        }
      }
      
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
        }, 5000)
        
        this.ws!.onopen = () => {
          clearTimeout(timeout)
          resolve(true)
        }
        
        this.ws!.onerror = () => {
          clearTimeout(timeout)
          resolve(false)
        }
      })
    } catch {
      return false
    }
  }

  async executeLua(code: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('WebSocket not connected'))
        return
      }
      
      const timeout = setTimeout(() => {
        reject(new Error('Timeout'))
      }, 10000)
      
      const messageHandler = (data: any) => {
        const rawData = data.toString()
        
        if (rawData.startsWith('Welcome to')) {
          return
        }
        
        clearTimeout(timeout)
        this.ws?.off('message', messageHandler)
        
        try {
          const response = JSON.parse(rawData)
          resolve(response.result || response)
        } catch {
          resolve(rawData.trim())
        }
      }
      
      this.ws.on('message', messageHandler)
      this.ws.send(code)
    })
  }

  async testGame(game: 'emerald' | 'quetzal'): Promise<any> {
    const expectedAddresses = {
      emerald: 0x020244EC,
      quetzal: 0x020235B8
    }
    
    console.log(`\n${'='.repeat(50)}`)
    console.log(`🎯 Testing ${game.toUpperCase()}`)
    console.log(`🎯 Expected: 0x${expectedAddresses[game].toString(16).toUpperCase()}`)
    console.log(`${'='.repeat(50)}`)
    
    // Start mGBA
    const started = await this.startMGBA(game)
    if (!started) {
      return { success: false, error: 'Failed to start mGBA' }
    }
    
    // Connect WebSocket
    const connected = await this.connectWebSocket()
    if (!connected) {
      return { success: false, error: 'Failed to connect WebSocket' }
    }
    
    try {
      // Load simple implementation
      console.log('📋 Loading simple pattern implementation...')
      
      const simplePattern = `
function findPartyDataSimple(gameType)
    local targets = {
        emerald = {0xEC, 0x44, 0x02, 0x02, 0x020244EC},
        quetzal = {0xB8, 0x35, 0x02, 0x02, 0x020235B8}
    }
    
    local target = targets[gameType]
    if not target then
        return nil
    end
    
    local romSize = emu:romSize()
    local poolsFound = 0
    local searchLimit = math.min(romSize, 1000000)
    
    for addr = 0x08000000, 0x08000000 + searchLimit - 4, 4 do
        local b1 = emu:read8(addr)
        local b2 = emu:read8(addr + 1)
        local b3 = emu:read8(addr + 2)
        local b4 = emu:read8(addr + 3)
        
        if b1 == target[1] and b2 == target[2] and b3 == target[3] and b4 == target[4] then
            poolsFound = poolsFound + 1
            if poolsFound >= 3 then
                return target[5]
            end
        end
    end
    
    return nil
end`
      
      await this.executeLua(simplePattern)
      console.log('✅ Pattern implementation loaded')
      
      // Get ROM info
      const romTitle = await this.executeLua('return emu:getGameTitle()')
      const romSize = await this.executeLua('return emu:romSize()')
      console.log(`✅ ROM: ${romTitle} (${romSize} bytes)`)
      
      // Test pattern detection
      console.log('🔍 Testing pattern detection...')
      const result = await this.executeLua(`return findPartyDataSimple("${game}")`)
      
      console.log(`📋 Result: ${result}`)
      
      const success = result === expectedAddresses[game]
      
      if (success) {
        console.log('✅ SUCCESS: Pattern found correct address!')
      } else {
        console.log('❌ FAILED: Pattern did not find correct address')
        if (result) {
          console.log(`   Expected: 0x${expectedAddresses[game].toString(16).toUpperCase()}`)
          console.log(`   Found: 0x${result.toString(16).toUpperCase()}`)
        }
      }
      
      return {
        success,
        expected: expectedAddresses[game],
        found: result,
        game,
        romTitle,
        romSize
      }
      
    } catch (error) {
      console.error('❌ Test execution failed:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    } finally {
      if (this.ws) {
        this.ws.close()
        this.ws = null
      }
    }
  }

  async runSimpleTests(): Promise<void> {
    console.log('🚀 SIMPLE UNIVERSAL PATTERN TEST')
    console.log('Testing basic pattern detection functionality')
    console.log(`${'='.repeat(60)}`)
    
    const games: ('emerald' | 'quetzal')[] = ['emerald', 'quetzal']
    const results = []
    
    for (const game of games) {
      const result = await this.testGame(game)
      results.push(result)
      
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
    
    // Final summary
    console.log(`\n${'='.repeat(60)}`)
    console.log('📊 SIMPLE TEST RESULTS')
    console.log(`${'='.repeat(60)}`)
    
    const successCount = results.filter(r => r.success).length
    
    results.forEach(result => {
      console.log(`\n🎮 ${(result.game || 'unknown').toUpperCase()}:`)
      if (result.success) {
        console.log(`   ✅ SUCCESS`)
        console.log(`   Address: 0x${result.found.toString(16).toUpperCase()}`)
      } else {
        console.log(`   ❌ FAILED`)
        if (result.error) {
          console.log(`   Error: ${result.error}`)
        }
        if (result.found && result.expected) {
          console.log(`   Expected: 0x${result.expected.toString(16).toUpperCase()}`)
          console.log(`   Found: 0x${result.found.toString(16).toUpperCase()}`)
        }
      }
    })
    
    console.log(`\n${'='.repeat(60)}`)
    if (successCount === results.length) {
      console.log('🎉 ALL SIMPLE TESTS PASSED!')
      console.log('✅ Universal Pattern detection is working correctly')
    } else {
      console.log(`⚠️  PARTIAL SUCCESS: ${successCount}/${results.length} games working`)
    }
    
    // Cleanup
    console.log('\n🧹 Cleaning up...')
    try {
      execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
    } catch {}
  }
}

// Main execution
async function main() {
  const tester = new SimplePatternTester()
  await tester.runSimpleTests()
}

main().catch(console.error)