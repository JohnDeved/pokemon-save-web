#!/usr/bin/env tsx
/**
 * Working Universal Pattern Implementation - FINAL VERSION
 * This implementation successfully finds the THUMB and ARM patterns that extract partyData addresses
 */

import { execSync } from 'node:child_process'
import { WebSocket } from 'ws'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'
const DOCKER_COMPOSE_FILE = 'docker/docker-compose.yml'

class WorkingUniversalPatterns {
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
        reject(new Error('Execution timeout (20s)'))
      }, 20000)
      
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

  async findUniversalPatterns(game: 'emerald' | 'quetzal'): Promise<void> {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🎯 Working Universal Pattern Search for ${game.toUpperCase()}`)
    console.log(`${'='.repeat(60)}`)
    
    const expectedAddr = game === 'emerald' ? 0x020244EC : 0x020235B8
    
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
      // Get ROM info
      const romInfo = await this.executeLua(`
        return {
          title = emu:getGameTitle(),
          size = emu:romSize()
        }
      `)
      console.log(`📋 ROM: ${romInfo.title} (${romInfo.size} bytes)`)
      
      // Universal Pattern Search
      console.log('🔍 Searching for Universal Patterns...')
      const result = await this.executeLua(`
        local target = ${expectedAddr}
        local b1 = target & 0xFF
        local b2 = (target >> 8) & 0xFF
        local b3 = (target >> 16) & 0xFF
        local b4 = (target >> 24) & 0xFF
        
        local patterns = {}
        local pools = 0
        
        -- Find literal pools containing target address
        for addr = 0x08000000, 0x08000000 + 1500000 - 4 do
          local rb1 = emu:read8(addr)
          local rb2 = emu:read8(addr + 1)
          local rb3 = emu:read8(addr + 2)
          local rb4 = emu:read8(addr + 3)
          
          if rb1 == b1 and rb2 == b2 and rb3 == b3 and rb4 == b4 then
            pools = pools + 1
            
            -- Look for THUMB instructions that reference this pool
            for inst = math.max(0x08000000, addr - 1000), addr - 1 do
              local thumb = emu:read8(inst)
              if thumb == 0x48 then
                local imm = emu:read8(inst + 1)
                local pc = (inst + 4) & 0xFFFFFFFC
                local calc = pc + (imm * 4)
                
                if calc == addr then
                  table.insert(patterns, {
                    type = "THUMB",
                    pattern = string.format("48 %02X", imm),
                    instruction = string.format("0x%08X: 48 %02X", inst, imm),
                    pool = string.format("0x%08X", addr),
                    target = string.format("0x%08X", target)
                  })
                  break
                end
              end
            end
            
            -- Look for ARM instructions that reference this pool  
            for inst = math.max(0x08000000, addr - 1000), addr - 4, 4 do
              local ab1 = emu:read8(inst)
              local ab2 = emu:read8(inst + 1)
              local ab3 = emu:read8(inst + 2)
              local ab4 = emu:read8(inst + 3)
              
              if ab3 == 0x9F and ab4 == 0xE5 then
                local imm = ab1 | (ab2 << 8)
                local pc = inst + 8
                local calc = pc + imm
                
                if calc == addr then
                  table.insert(patterns, {
                    type = "ARM",
                    pattern = string.format("E5 9F %02X %02X", ab1, ab2),
                    instruction = string.format("0x%08X: E5 9F %02X %02X", inst, ab1, ab2),
                    pool = string.format("0x%08X", addr),
                    target = string.format("0x%08X", target)
                  })
                  break
                end
              end
            end
            
            if pools >= 10 then break end
          end
        end
        
        return {
          success = #patterns > 0,
          pools = pools,
          patterns = patterns,
          target = string.format("0x%08X", target)
        }
      `)
      
      console.log(`📊 Results:`)
      console.log(`   Target: ${result.target}`)
      console.log(`   Literal pools found: ${result.pools}`)
      console.log(`   Working patterns found: ${result.patterns.length}`)
      
      if (result.success) {
        console.log(`\n✅ SUCCESS: Universal Patterns found for ${game.toUpperCase()}!`)
        console.log(`\n📋 Working Universal Patterns:`)
        
        result.patterns.forEach((pattern: any, i: number) => {
          console.log(`\n${i + 1}. ${pattern.type} Pattern:`)
          console.log(`   Pattern: ${pattern.pattern}`)
          console.log(`   Instruction: ${pattern.instruction}`)
          console.log(`   Literal Pool: ${pattern.pool}`)
          console.log(`   Target Address: ${pattern.target}`)
        })
        
        console.log(`\n🎉 These patterns can be used to find address ${result.target} in ${game.toUpperCase()}!`)
      } else {
        console.log(`\n❌ No working patterns found for ${game.toUpperCase()}`)
      }
      
    } catch (error) {
      console.error('❌ Pattern search failed:', error)
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
      console.log('\n🧹 Cleaning up Docker containers...')
      execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
    } catch {}
  }
}

async function main() {
  const pattern = new WorkingUniversalPatterns()
  
  try {
    console.log('🚀 Working Universal Pattern System - Final Implementation')
    console.log('=' + '='.repeat(60))
    
    await pattern.findUniversalPatterns('quetzal')
    await new Promise(resolve => setTimeout(resolve, 3000))
    await pattern.findUniversalPatterns('emerald')
    
  } catch (error) {
    console.error('💥 Implementation failed:', error)
  } finally {
    await pattern.cleanup()
  }
}

// Handle cleanup on exit
process.on('SIGINT', async () => {
  console.log('\n⏹️  Interrupted - cleaning up...')
  const pattern = new WorkingUniversalPatterns()
  await pattern.cleanup()
  process.exit(0)
})

// Run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}