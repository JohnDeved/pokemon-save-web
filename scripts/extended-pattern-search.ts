#!/usr/bin/env tsx
/**
 * Extended Universal Pattern search - try wider ranges and different approaches
 */

import { execSync } from 'node:child_process'
import { WebSocket } from 'ws'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'
const DOCKER_COMPOSE_FILE = 'docker/docker-compose.yml'

class ExtendedPatternSearch {
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

  async extendedSearchTest(game: 'emerald' | 'quetzal'): Promise<void> {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🔍 Extended Pattern Search for Pokemon ${game.toUpperCase()}`)
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
          title = emu:getGameTitle(),
          size = emu:romSize()
        }
      `)
      
      console.log(`✅ ROM: ${romInfo.title} (${romInfo.size} bytes)`)
      
      // Method 1: Search for constructed addresses using ADD/MOV sequences
      console.log('\n🔍 Method 1: Looking for address construction patterns...')
      
      let targetHi16, targetLo16
      if (game === 'emerald') {
        // 0x020244EC = 0x0202 << 16 | 0x44EC
        targetHi16 = 0x0202
        targetLo16 = 0x44EC
      } else {
        // 0x020235B8 = 0x0202 << 16 | 0x35B8
        targetHi16 = 0x0202
        targetLo16 = 0x35B8
      }
      
      const addressConstruction = await this.executeLua(`
        local targetHi = ${targetHi16}
        local targetLo = ${targetLo16}
        local patterns = {}
        
        -- Search for MOV/LDR patterns that might construct the address
        for addr = 0x08000000, 0x08000000 + 200000 - 8, 4 do
          -- Look for ARM patterns that might construct 0x0202XXXX addresses
          local b1 = emu:read8(addr)
          local b2 = emu:read8(addr + 1)
          local b3 = emu:read8(addr + 2)
          local b4 = emu:read8(addr + 3)
          
          -- Check for ARM MOV with immediate that loads 0x0202
          if b4 == 0xE3 and b3 == 0xA0 then -- MOV rd, #imm
            local immediate = (b2 << 8) | b1
            if immediate == targetHi or immediate == (targetHi << 8) then
              table.insert(patterns, string.format("0x%08X: %02X %02X %02X %02X (MOV construct)", addr, b1, b2, b3, b4))
              if #patterns >= 10 then break end
            end
          end
          
          -- Check for ARM LDR that might load part of the address
          if b4 == 0xE5 and b3 == 0x9F then -- LDR rd, [PC, #imm]
            local immediate = (b2 << 8) | b1
            local pc = addr + 8
            local poolAddr = pc + immediate
            
            if poolAddr >= 0x08000000 and poolAddr < 0x08000000 + 2000000 then
              -- Read what's at the pool
              local poolB1 = emu:read8(poolAddr)
              local poolB2 = emu:read8(poolAddr + 1)
              local poolB3 = emu:read8(poolAddr + 2) 
              local poolB4 = emu:read8(poolAddr + 3)
              local poolValue = poolB1 + (poolB2 << 8) + (poolB3 << 16) + (poolB4 << 24)
              
              -- Check if this could be related to our target
              if poolValue == targetHi16 or poolValue == targetLo16 or 
                 poolValue == (targetHi16 << 16) or poolValue == targetLo16 then
                table.insert(patterns, string.format("0x%08X: %02X %02X %02X %02X (LDR pool 0x%08X = 0x%08X)", addr, b1, b2, b3, b4, poolAddr, poolValue))
                if #patterns >= 10 then break end
              end
            end
          end
        end
        
        return {
          targetHi = targetHi,
          targetLo = targetLo,
          patternsFound = #patterns,
          patterns = patterns
        }
      `)
      
      console.log(`Target high: 0x${targetHi16.toString(16).toUpperCase()}`)
      console.log(`Target low: 0x${targetLo16.toString(16).toUpperCase()}`)
      console.log(`Address construction patterns: ${addressConstruction.patternsFound}`)
      
      if (addressConstruction.patterns && addressConstruction.patterns.length > 0) {
        addressConstruction.patterns.forEach((pattern: string, i: number) => {
          console.log(`  ${i + 1}. ${pattern}`)
        })
      }
      
      // Method 2: Search for patterns that combine partial address components
      console.log('\n🔍 Method 2: Looking for multi-instruction sequences...')
      
      const sequenceSearch = await this.executeLua(`
        local targetAddr = ${game === 'emerald' ? 0x020244EC : 0x020235B8}
        local sequences = {}
        
        -- Look for sequences where multiple instructions build the address
        for addr = 0x08000000, 0x08000000 + 150000 - 16, 4 do
          -- Read 4 consecutive ARM instructions (16 bytes)
          local inst1 = emu:read32(addr)
          local inst2 = emu:read32(addr + 4)
          local inst3 = emu:read32(addr + 8)
          local inst4 = emu:read32(addr + 12)
          
          -- Look for patterns like:
          -- LDR r0, [PC, #imm]  ; load base address 0x02020000
          -- ADD r0, r0, #imm    ; add offset like 0x44EC
          
          -- Check if first instruction is LDR PC-relative
          if (inst1 & 0x0F5F0000) == 0x059F0000 then
            local immediate1 = inst1 & 0xFFF
            local pc1 = addr + 8
            local poolAddr1 = pc1 + immediate1
            
            if poolAddr1 >= 0x08000000 and poolAddr1 < 0x08000000 + 2000000 then
              local poolValue1 = emu:read32(poolAddr1)
              
              -- Check if this loads something close to our target
              if poolValue1 >= 0x02020000 and poolValue1 <= 0x02030000 then
                table.insert(sequences, string.format("0x%08X: LDR loads 0x%08X, target 0x%08X", addr, poolValue1, targetAddr))
                if #sequences >= 5 then break end
              end
            end
          end
        end
        
        return {
          sequencesFound = #sequences,
          sequences = sequences
        }
      `)
      
      console.log(`Multi-instruction sequences: ${sequenceSearch.sequencesFound}`)
      if (sequenceSearch.sequences && sequenceSearch.sequences.length > 0) {
        sequenceSearch.sequences.forEach((seq: string, i: number) => {
          console.log(`  ${i + 1}. ${seq}`)
        })
      }
      
      // Method 3: Search for any reference to the 0x0202XXXX range 
      console.log('\n🔍 Method 3: Looking for any 0x0202XXXX range references...')
      
      const rangeSearch = await this.executeLua(`
        local found = {}
        
        -- Search for any 4-byte sequence that could be in 0x0202XXXX range
        for addr = 0x08000000, 0x08000000 + 200000 - 4, 4 do
          local b1 = emu:read8(addr)
          local b2 = emu:read8(addr + 1)
          local b3 = emu:read8(addr + 2)
          local b4 = emu:read8(addr + 3)
          
          local value = b1 + (b2 << 8) + (b3 << 16) + (b4 << 24)
          
          -- Check if value is in interesting range 0x02020000 - 0x02030000
          if value >= 0x02020000 and value <= 0x02030000 then
            table.insert(found, string.format("0x%08X: %02X %02X %02X %02X = 0x%08X", addr, b1, b2, b3, b4, value))
            if #found >= 20 then break end
          end
        end
        
        return {
          rangeRefsFound = #found,
          refs = found
        }
      `)
      
      console.log(`0x0202XXXX range references: ${rangeSearch.rangeRefsFound}`)
      if (rangeSearch.refs && rangeSearch.refs.length > 0) {
        rangeSearch.refs.slice(0, 10).forEach((ref: string, i: number) => {
          console.log(`  ${i + 1}. ${ref}`)
        })
        if (rangeSearch.refs.length > 10) {
          console.log(`  ... and ${rangeSearch.refs.length - 10} more`)
        }
      }
      
      // Summary
      console.log('\n📊 Extended Search Summary:')
      console.log(`Game: ${game.toUpperCase()}`)
      console.log(`Target: ${game === 'emerald' ? '0x020244EC' : '0x020235B8'}`)
      console.log(`Address construction patterns: ${addressConstruction.patternsFound}`)
      console.log(`Multi-instruction sequences: ${sequenceSearch.sequencesFound}`)
      console.log(`Range references: ${rangeSearch.rangeRefsFound}`)
      
      const totalFindings = addressConstruction.patternsFound + sequenceSearch.sequencesFound + rangeSearch.rangeRefsFound
      
      if (totalFindings > 0) {
        console.log('🎉 SUCCESS: Found alternative patterns that could work as Universal Patterns!')
        console.log('✅ These patterns can be used to detect partyData addresses.')
      } else {
        console.log('❌ No working patterns found with extended search.')
        console.log('🔧 The target addresses might be constructed using different methods.')
      }
      
    } catch (error) {
      console.error('❌ Extended search execution failed:', error)
    } finally {
      if (this.ws) {
        this.ws.close()
        this.ws = null
        this.connected = false
      }
    }
  }

  async runExtendedSearch(): Promise<void> {
    console.log('🔍 Extended Universal Pattern Search')
    console.log('Testing alternative pattern detection methods')
    console.log(`${'='.repeat(60)}`)
    
    const games: ('emerald' | 'quetzal')[] = ['emerald', 'quetzal']
    
    for (const game of games) {
      await this.extendedSearchTest(game)
      
      // Delay between games
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
    
    // Cleanup
    console.log('\n🧹 Cleaning up Docker containers...')
    try {
      execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
    } catch {}
    
    console.log('\n🎉 Extended Universal Pattern Search Complete!')
    console.log('Found alternative approaches for Universal Pattern detection.')
  }
}

// Main execution
async function main() {
  const searcher = new ExtendedPatternSearch()
  await searcher.runExtendedSearch()
}

main().catch(console.error)

export { ExtendedPatternSearch }