#!/usr/bin/env tsx
/**
 * Test specific THUMB LDR patterns to find party data addresses
 */

import { execSync } from 'node:child_process'
import { WebSocket } from 'ws'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'
const DOCKER_COMPOSE_FILE = 'docker/docker-compose.yml'

class ThumbPatternTester {
  private ws: WebSocket | null = null
  private connected = false

  async startMGBA(game: 'emerald' | 'quetzal'): Promise<boolean> {
    console.log(`🚀 Starting mGBA Docker for ${game}...`)
    
    try {
      try {
        execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
        await new Promise(resolve => setTimeout(resolve, 3000))
      } catch {}
      
      execSync(`GAME=${game} docker compose -f ${DOCKER_COMPOSE_FILE} up -d`, { 
        stdio: 'inherit',
        env: { ...process.env, GAME: game }
      })
      
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

  async testThumbPatterns(game: 'emerald' | 'quetzal'): Promise<void> {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🔍 Testing THUMB LDR Patterns for Pokemon ${game.toUpperCase()}`)
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
      const romInfo = await this.executeLua(`
        return {
          rom_title = emu:getGameTitle(),
          rom_size = emu:romSize()
        }
      `)
      
      console.log(`✅ ROM: ${romInfo.rom_title} (${romInfo.rom_size} bytes)`)
      console.log(`🎯 Target address: 0x${expectedAddr.toString(16).toUpperCase()}`)
      
      const result = await this.executeLua(`
        local expectedAddr = ${expectedAddr}
        local ramCandidates = {}
        local totalThumbLdr = 0
        
        -- Search for THUMB LDR immediate patterns in first 1MB
        for addr = 0x08000000, 0x08000000 + 1000000 - 2, 2 do
          local b1 = emu:read8(addr)
          if b1 == 0x48 then
            totalThumbLdr = totalThumbLdr + 1
            local b2 = emu:read8(addr + 1)
            
            -- Calculate literal pool address
            local immediate = b2
            local pc = math.floor((addr + 4) / 4) * 4
            local literalAddr = pc + immediate * 4
            
            -- Check if literal is in ROM
            if literalAddr >= 0x08000000 and literalAddr < 0x08000000 + emu:romSize() then
              -- Read address from literal pool
              local ab1 = emu:read8(literalAddr)
              local ab2 = emu:read8(literalAddr + 1)
              local ab3 = emu:read8(literalAddr + 2)
              local ab4 = emu:read8(literalAddr + 3)
              
              local address = ab1 + ab2 * 256 + ab3 * 65536 + ab4 * 16777216
              
              -- Only care about RAM addresses
              if address >= 0x02000000 and address < 0x04000000 then
                table.insert(ramCandidates, {
                  thumbAddr = string.format("0x%08X", addr),
                  immediate = immediate,
                  literalAddr = string.format("0x%08X", literalAddr),
                  address = string.format("0x%08X", address),
                  isTarget = (address == expectedAddr)
                })
                
                -- Stop at 50 RAM candidates for now
                if #ramCandidates >= 50 then
                  break
                end
              end
            end
          end
        end
        
        return {
          totalThumbLdr = totalThumbLdr,
          ramCandidates = ramCandidates,
          targetFound = false
        }
      `, 90000)
      
      console.log(`📊 Found ${result.totalThumbLdr} total THUMB LDR instructions`)
      console.log(`📊 Found ${result.ramCandidates.length} RAM address candidates`)
      
      if (result.ramCandidates.length > 0) {
        console.log('\n🎯 RAM Address Candidates:')
        for (let i = 0; i < Math.min(20, result.ramCandidates.length); i++) {
          const candidate = result.ramCandidates[i]
          const targetMark = candidate.isTarget ? ' ⭐ TARGET!' : ''
          console.log(`   ${i + 1}. THUMB@${candidate.thumbAddr} imm=${candidate.immediate} → ${candidate.address}${targetMark}`)
        }
        
        if (result.ramCandidates.length > 20) {
          console.log(`   ... and ${result.ramCandidates.length - 20} more candidates`)
        }
        
        // Check if we found the target
        const targetFound = result.ramCandidates.some((c: any) => c.isTarget)
        if (targetFound) {
          console.log('\n🎉 SUCCESS: Found the target partyData address!')
        } else {
          console.log('\n⚠️  Target address not found in THUMB LDR candidates')
        }
      } else {
        console.log('\n❌ No RAM address candidates found via THUMB LDR patterns')
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

  async cleanup(): Promise<void> {
    try {
      console.log('🧹 Cleaning up Docker containers...')
      execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
    } catch {}
  }
}

// Main execution
async function main() {
  const tester = new ThumbPatternTester()
  
  try {
    await tester.testThumbPatterns('emerald')
    await new Promise(resolve => setTimeout(resolve, 3000))
    await tester.testThumbPatterns('quetzal')
  } catch (error) {
    console.error('💥 Test failed:', error)
    process.exit(1)
  } finally {
    await tester.cleanup()
  }
}

// Handle cleanup on exit
process.on('SIGINT', async () => {
  console.log('\n⏹️  Interrupted - cleaning up...')
  const tester = new ThumbPatternTester()
  await tester.cleanup()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n⏹️  Terminated - cleaning up...')
  const tester = new ThumbPatternTester()
  await tester.cleanup()
  process.exit(0)
})

// Run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}