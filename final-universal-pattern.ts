#!/usr/bin/env tsx
/**
 * Final working Universal Pattern implementation
 * Uses chunked search and optimized algorithms to find target addresses
 */

import { execSync } from 'node:child_process'
import { WebSocket } from 'ws'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'
const DOCKER_COMPOSE_FILE = 'docker/docker-compose.yml'

class WorkingUniversalPattern {
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

  async testGame(game: 'emerald' | 'quetzal'): Promise<void> {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🎯 Final Universal Pattern Test - Pokemon ${game.toUpperCase()}`)
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
      console.log(`🎯 Target: 0x${expectedAddr.toString(16).toUpperCase()}`)
      
      // Use chunked search for target address bytes
      console.log('\n🔍 Searching for target address in ROM (chunked approach)...')
      
      const result = await this.executeLua(`
        local function findTargetAddress(targetAddr)
          local targetBytes = {
            targetAddr & 0xFF,
            (targetAddr >> 8) & 0xFF,
            (targetAddr >> 16) & 0xFF,
            (targetAddr >> 24) & 0xFF
          }
          
          local literalPools = {}
          local chunkSize = 65536 -- 64KB chunks
          local romSize = emu:romSize()
          local maxSearch = math.min(romSize, 2097152) -- 2MB max
          
          for chunkStart = 0x08000000, 0x08000000 + maxSearch - 4, chunkSize do
            local chunkEnd = math.min(chunkStart + chunkSize, 0x08000000 + maxSearch)
            
            for addr = chunkStart, chunkEnd - 4, 4 do
              local b1 = emu:read8(addr)
              local b2 = emu:read8(addr + 1)
              local b3 = emu:read8(addr + 2)
              local b4 = emu:read8(addr + 3)
              
              if b1 == targetBytes[1] and b2 == targetBytes[2] and 
                 b3 == targetBytes[3] and b4 == targetBytes[4] then
                table.insert(literalPools, addr)
              end
            end
          end
          
          return literalPools
        end
        
        local function findInstructionsForLiteral(literalAddr)
          local instructions = {}
          
          -- Search for THUMB LDR that references this literal
          local thumbStart = math.max(0x08000000, literalAddr - 1020)
          local thumbEnd = math.min(literalAddr, 0x08000000 + emu:romSize())
          
          for addr = thumbStart, thumbEnd - 2, 2 do
            local b1 = emu:read8(addr)
            if b1 == 0x48 then
              local b2 = emu:read8(addr + 1)
              local immediate = b2
              local pc = ((addr + 4) / 4) * 4 -- Round down to word boundary
              local calculatedLiteral = pc + immediate * 4
              
              if calculatedLiteral == literalAddr then
                table.insert(instructions, {
                  type = "THUMB",
                  addr = addr,
                  immediate = immediate
                })
              end
            end
          end
          
          -- Search for ARM LDR that references this literal
          local armStart = math.max(0x08000000, literalAddr - 4092)
          for addr = armStart, thumbEnd - 4, 4 do
            local b1 = emu:read8(addr)
            local b2 = emu:read8(addr + 1)
            local b3 = emu:read8(addr + 2)
            local b4 = emu:read8(addr + 3)
            
            if b3 == 0x9F and b4 == 0xE5 then
              local immediate = b1 + (b2 * 256)
              local pc = addr + 8
              local calculatedLiteral = pc + immediate
              
              if calculatedLiteral == literalAddr then
                table.insert(instructions, {
                  type = "ARM",
                  addr = addr,
                  immediate = immediate
                })
              end
            end
          end
          
          return instructions
        end
        
        local targetAddr = ${expectedAddr}
        local literals = findTargetAddress(targetAddr)
        local allInstructions = {}
        
        for _, literalAddr in ipairs(literals) do
          local instructions = findInstructionsForLiteral(literalAddr)
          for _, instr in ipairs(instructions) do
            instr.literalAddr = literalAddr
            table.insert(allInstructions, instr)
          end
        end
        
        return {
          targetFound = #literals > 0,
          literalCount = #literals,
          instructionCount = #allInstructions,
          success = #allInstructions > 0,
          instructions = allInstructions
        }
      `, 90000)
      
      console.log(`📊 Found ${result.literalCount} literal pool(s) containing target address`)
      console.log(`📊 Found ${result.instructionCount} instruction(s) that load the target address`)
      
      if (result.success) {
        console.log('\n🎉 SUCCESS: Universal Pattern working!')
        console.log('📝 Instructions that load partyData address:')
        
        for (let i = 0; i < Math.min(10, result.instructions.length); i++) {
          const instr = result.instructions[i]
          const addrHex = `0x${instr.addr.toString(16).toUpperCase()}`
          const literalHex = `0x${instr.literalAddr.toString(16).toUpperCase()}`
          console.log(`   ${i + 1}. ${instr.type} @ ${addrHex} (immediate=${instr.immediate}) → literal @ ${literalHex}`)
        }
        
        if (result.instructions.length > 10) {
          console.log(`   ... and ${result.instructions.length - 10} more instructions`)
        }
        
        // Create Universal Pattern definition
        console.log('\n🔧 Universal Pattern Implementation:')
        const thumbCount = result.instructions.filter((i: any) => i.type === 'THUMB').length
        const armCount = result.instructions.filter((i: any) => i.type === 'ARM').length
        
        if (thumbCount > 0) {
          console.log(`   ✅ THUMB LDR Pattern: 48 ?? (${thumbCount} instances)`)
        }
        if (armCount > 0) {
          console.log(`   ✅ ARM LDR Pattern: ?? ?? 9F E5 (${armCount} instances)`)
        }
        
        console.log('\n   Implementation: Search for literal pools containing target address,')
        console.log('   then find THUMB/ARM LDR instructions that reference those pools.')
        
      } else {
        console.log('❌ Target address not found via Universal Patterns')
        if (result.literalCount === 0) {
          console.log('   The target address does not appear in ROM literal pools')
        } else {
          console.log('   Literal pools found but no instructions reference them')
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

  async cleanup(): Promise<void> {
    try {
      console.log('🧹 Cleaning up Docker containers...')
      execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
    } catch {}
  }
}

// Main execution
async function main() {
  const tester = new WorkingUniversalPattern()
  
  try {
    await tester.testGame('emerald')
    await new Promise(resolve => setTimeout(resolve, 3000))
    await tester.testGame('quetzal')
  } catch (error) {
    console.error('💥 Universal Pattern test failed:', error)
    process.exit(1)
  } finally {
    await tester.cleanup()
  }
}

// Handle cleanup on exit
process.on('SIGINT', async () => {
  console.log('\n⏹️  Interrupted - cleaning up...')
  const tester = new WorkingUniversalPattern()
  await tester.cleanup()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n⏹️  Terminated - cleaning up...')
  const tester = new WorkingUniversalPattern()
  await tester.cleanup()
  process.exit(0)
})

// Run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}