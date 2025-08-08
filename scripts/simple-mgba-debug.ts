#!/usr/bin/env tsx
/**
 * Simple debugging test to understand what's happening with the mGBA Lua API
 */

import { execSync } from 'node:child_process'
import { WebSocket } from 'ws'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'
const DOCKER_COMPOSE_FILE = 'docker/docker-compose.yml'

class SimpleMGBATest {
  private ws: WebSocket | null = null
  private connected = false

  async startMGBA(game: 'emerald' | 'quetzal'): Promise<boolean> {
    console.log(`🚀 Starting mGBA Docker for ${game}...`)
    
    try {
      // Stop any existing container
      try {
        execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
        await new Promise(resolve => setTimeout(resolve, 2000))
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
      
      console.log(`❌ mGBA failed to start for ${game}`)
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

  async executeLua(code: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || !this.connected) {
        reject(new Error('WebSocket not connected'))
        return
      }
      
      const timeoutId = setTimeout(() => {
        reject(new Error('Execution timeout (15s)'))
      }, 15000)
      
      const messageHandler = (data: any) => {
        clearTimeout(timeoutId)
        this.ws?.off('message', messageHandler)
        
        const rawData = data.toString()
        
        // Skip welcome message
        if (rawData.startsWith('Welcome to')) {
          return
        }
        
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

  async simpleTest(game: 'emerald' | 'quetzal'): Promise<void> {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🧪 Simple mGBA Test for ${game.toUpperCase()}`)
    console.log(`${'='.repeat(60)}`)
    
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
      // Test 1: Basic ROM info
      console.log('🧪 Test 1: Basic ROM info')
      const romInfo = await this.executeLua(`
        return {
          title = emu:getGameTitle(),
          size = emu:romSize(),
          firstByte = emu:read8(0x08000000)
        }
      `)
      console.log(`   Title: ${romInfo.title}`)
      console.log(`   Size: ${romInfo.size} bytes`)
      console.log(`   First byte: 0x${romInfo.firstByte.toString(16).toUpperCase()}`)
      
      // Test 2: Simple pattern search
      console.log('🧪 Test 2: Search for pattern 48 in first 1000 bytes')
      const pattern48 = await this.executeLua(`
        local count = 0
        local matches = {}
        
        for addr = 0x08000000, 0x08000000 + 1000 do
          local byte = emu:read8(addr)
          if byte == 0x48 then
            count = count + 1
            if count <= 3 then
              local next = emu:read8(addr + 1)
              table.insert(matches, string.format("0x%08X: 48 %02X", addr, next))
            end
          end
        end
        
        return {
          count = count,
          samples = matches
        }
      `)
      console.log(`   Found ${pattern48.count} patterns of 48`)
      for (const sample of pattern48.samples) {
        console.log(`   ${sample}`)
      }
      
      // Test 3: Search for specific target address bytes
      const expectedAddr = game === 'emerald' ? 0x020244EC : 0x020235B8
      console.log(`🧪 Test 3: Search for target address bytes 0x${expectedAddr.toString(16).toUpperCase()}`)
      
      const targetSearch = await this.executeLua(`
        local target = ${expectedAddr}
        local b1 = target & 0xFF
        local b2 = (target >> 8) & 0xFF
        local b3 = (target >> 16) & 0xFF
        local b4 = (target >> 24) & 0xFF
        
        local found = 0
        local locations = {}
        
        for addr = 0x08000000, 0x08000000 + 2000000 - 4 do
          local rb1 = emu:read8(addr)
          local rb2 = emu:read8(addr + 1)
          local rb3 = emu:read8(addr + 2)
          local rb4 = emu:read8(addr + 3)
          
          if rb1 == b1 and rb2 == b2 and rb3 == b3 and rb4 == b4 then
            found = found + 1
            if found <= 5 then
              table.insert(locations, string.format("0x%08X", addr))
            end
          end
        end
        
        return {
          targetBytes = string.format("%02X %02X %02X %02X", b1, b2, b3, b4),
          found = found,
          locations = locations
        }
      `)
      
      console.log(`   Target bytes: ${targetSearch.targetBytes}`)
      console.log(`   Found ${targetSearch.found} occurrences`)
      for (const location of targetSearch.locations) {
        console.log(`   ${location}`)
      }
      
      if (targetSearch.found > 0) {
        console.log('✅ Found target address in ROM! Can now implement reverse lookup.')
      } else {
        console.log('❌ Target address not found in ROM. May need different approach.')
      }
      
    } catch (error) {
      console.error('❌ Test failed:', error)
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
      console.log('🧹 Cleaning up Docker containers...')
      execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
    } catch {}
  }
}

async function main() {
  const tester = new SimpleMGBATest()
  
  try {
    await tester.simpleTest('emerald')
    await new Promise(resolve => setTimeout(resolve, 3000))
    await tester.simpleTest('quetzal')
  } catch (error) {
    console.error('💥 Test failed:', error)
  } finally {
    await tester.cleanup()
  }
}

// Handle cleanup on exit
process.on('SIGINT', async () => {
  console.log('\n⏹️  Interrupted - cleaning up...')
  const tester = new SimpleMGBATest()
  await tester.cleanup()
  process.exit(0)
})

// Run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}