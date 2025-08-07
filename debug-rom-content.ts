#!/usr/bin/env tsx
/**
 * Debug ROM content to understand what patterns exist
 */

import { execSync } from 'node:child_process'
import { WebSocket } from 'ws'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'
const DOCKER_COMPOSE_FILE = 'docker/docker-compose.yml'

class ROMDebugger {
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
            testWs.on('open', () => {
              testWs.close()
              resolve(true)
            })
            testWs.on('error', reject)
            setTimeout(() => reject(new Error('Timeout')), 3000)
          })
          
          console.log(`✅ mGBA ready for ${game} (attempt ${attempt})`)
          return true
        } catch {
          console.log(`   Waiting... (${attempt}/15)`)
          await new Promise(resolve => setTimeout(resolve, 3000))
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
      }, 15000)
    })
  }

  async executeLua(code: string, timeout = 45000): Promise<any> {
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

  async debugROM(game: 'emerald' | 'quetzal'): Promise<void> {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🔍 Debugging ROM Content for Pokemon ${game.toUpperCase()}`)
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
      // Get ROM info
      console.log('📋 Getting ROM information...')
      const romInfo = await this.executeLua(`
        return {
          rom_title = emu:getGameTitle(),
          rom_size = emu:romSize(),
          first_bytes = {
            emu:read8(0x08000000),
            emu:read8(0x08000001),
            emu:read8(0x08000002),
            emu:read8(0x08000003)
          }
        }
      `)
      
      console.log(`✅ ROM: ${romInfo.rom_title} (${romInfo.rom_size} bytes)`)
      console.log(`✅ First bytes: ${romInfo.first_bytes.map((b: number) => `0x${b.toString(16).padStart(2, '0')}`).join(' ')}`)
      
      // Search for any 48 bytes (THUMB LDR patterns)
      console.log('🔍 Searching for all 48 bytes (THUMB LDR patterns)...')
      const thumbResults = await this.executeLua(`
        local results = {}
        local count = 0
        
        -- Search first 500KB for any 48 bytes
        for addr = 0x08000000, 0x08000000 + 500000, 2 do
          local b1 = emu:read8(addr)
          if b1 == 0x48 then
            count = count + 1
            if count <= 20 then
              local b2 = emu:read8(addr + 1)
              local b3 = emu:read8(addr + 2)
              local b4 = emu:read8(addr + 3)
              local b5 = emu:read8(addr + 4)
              local b6 = emu:read8(addr + 5)
              
              results[count] = {
                address = string.format("0x%08X", addr),
                bytes = string.format("48 %02X %02X %02X %02X %02X", b2, b3, b4, b5, b6)
              }
            end
          end
        end
        
        return {
          total = count,
          samples = results
        }
      `, 60000)
      
      console.log(`✅ Found ${thumbResults.total} total 48 bytes in first 500KB`)
      console.log('📝 First 20 samples:')
      if (thumbResults.samples) {
        for (let i = 1; i <= Math.min(20, Object.keys(thumbResults.samples).length); i++) {
          const sample = thumbResults.samples[i]
          if (sample) {
            console.log(`   ${i}. ${sample.address}: ${sample.bytes}`)
          }
        }
      }
      
      // Search for any E0 bytes (ARM patterns)
      console.log('\n🔍 Searching for ARM E0 patterns...')
      const armResults = await this.executeLua(`
        local results = {}
        local count = 0
        
        -- Search first 500KB for any E0 bytes
        for addr = 0x08000000, 0x08000000 + 500000, 4 do
          local b1 = emu:read8(addr)
          if b1 == 0xE0 then
            count = count + 1
            if count <= 20 then
              local bytes = {}
              for i = 0, 11 do
                bytes[i+1] = string.format("%02X", emu:read8(addr + i))
              end
              
              results[count] = {
                address = string.format("0x%08X", addr),
                bytes = table.concat(bytes, " ")
              }
            end
          end
        end
        
        return {
          total = count,
          samples = results
        }
      `, 60000)
      
      console.log(`✅ Found ${armResults.total} total E0 bytes in first 500KB`)
      console.log('📝 First 20 samples:')
      if (armResults.samples) {
        for (let i = 1; i <= Math.min(20, Object.keys(armResults.samples).length); i++) {
          const sample = armResults.samples[i]
          if (sample) {
            console.log(`   ${i}. ${sample.address}: ${sample.bytes}`)
          }
        }
      }
      
      // Search for the specific pattern bytes we expect
      console.log('\n🔍 Searching for expected address patterns...')
      const expectedAddr = game === 'emerald' ? 0x020244EC : 0x020235B8
      const addressResults = await this.executeLua(`
        local expectedAddr = ${expectedAddr}
        local results = {}
        
        -- Convert expected address to little-endian bytes
        local targetBytes = {
          expectedAddr & 0xFF,
          (expectedAddr >> 8) & 0xFF,
          (expectedAddr >> 16) & 0xFF,
          (expectedAddr >> 24) & 0xFF
        }
        
        -- Search for the address bytes in ROM
        for addr = 0x08000000, 0x08000000 + 2000000 - 4 do
          local b1 = emu:read8(addr)
          local b2 = emu:read8(addr + 1)
          local b3 = emu:read8(addr + 2)
          local b4 = emu:read8(addr + 3)
          
          if b1 == targetBytes[1] and b2 == targetBytes[2] and 
             b3 == targetBytes[3] and b4 == targetBytes[4] then
            table.insert(results, {
              address = string.format("0x%08X", addr),
              bytes = string.format("%02X %02X %02X %02X", b1, b2, b3, b4)
            })
          end
        end
        
        return {
          expectedBytes = string.format("%02X %02X %02X %02X", 
            targetBytes[1], targetBytes[2], targetBytes[3], targetBytes[4]),
          matches = results
        }
      `, 60000)
      
      console.log(`✅ Searching for address bytes: ${addressResults.expectedBytes}`)
      console.log(`✅ Found ${addressResults.matches.length} exact matches`)
      for (let i = 0; i < Math.min(10, addressResults.matches.length); i++) {
        const match = addressResults.matches[i]
        console.log(`   ${i + 1}. ${match.address}: ${match.bytes}`)
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

  async cleanup(): Promise<void> {
    try {
      console.log('🧹 Cleaning up Docker containers...')
      execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
    } catch {}
  }
}

// Main execution
async function main() {
  const romDebugger = new ROMDebugger()
  
  try {
    await romDebugger.debugROM('emerald')
    await new Promise(resolve => setTimeout(resolve, 3000))
    await romDebugger.debugROM('quetzal')
  } catch (error) {
    console.error('💥 Debug failed:', error)
    process.exit(1)
  } finally {
    await romDebugger.cleanup()
  }
}

// Handle cleanup on exit
process.on('SIGINT', async () => {
  console.log('\n⏹️  Interrupted - cleaning up...')
  const romDebugger = new ROMDebugger()
  await romDebugger.cleanup()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n⏹️  Terminated - cleaning up...')
  const romDebugger = new ROMDebugger()
  await romDebugger.cleanup()
  process.exit(0)
})

// Run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}