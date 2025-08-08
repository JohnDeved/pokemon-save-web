#!/usr/bin/env tsx
/**
 * Efficient Universal Pattern finder - searches for target addresses in literal pools
 * then works backwards to find the instructions that reference them
 */

import { execSync } from 'node:child_process'
import { WebSocket } from 'ws'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'
const DOCKER_COMPOSE_FILE = 'docker/docker-compose.yml'

class EfficientPatternFinder {
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

  async findUniversalPatterns(game: 'emerald' | 'quetzal'): Promise<void> {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🎯 Universal Pattern Detection for Pokemon ${game.toUpperCase()}`)
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
      
      // Step 1: Find where the target address appears in ROM as little-endian bytes
      console.log('\n🔍 Step 1: Finding target address in ROM literal pools...')
      const literalSearch = await this.executeLua(`
        local targetAddr = ${expectedAddr}
        local targetBytes = {
          targetAddr & 0xFF,
          (targetAddr >> 8) & 0xFF,
          (targetAddr >> 16) & 0xFF,
          (targetAddr >> 24) & 0xFF
        }
        
        local literalPools = {}
        local romSize = emu:romSize()
        local searchLimit = math.min(romSize, 3000000) -- 3MB max for performance
        
        -- Search for the target address bytes in ROM
        for addr = 0x08000000, 0x08000000 + searchLimit - 4, 4 do
          local b1 = emu:read8(addr)
          local b2 = emu:read8(addr + 1)
          local b3 = emu:read8(addr + 2)
          local b4 = emu:read8(addr + 3)
          
          if b1 == targetBytes[1] and b2 == targetBytes[2] and 
             b3 == targetBytes[3] and b4 == targetBytes[4] then
            table.insert(literalPools, addr)
          end
        end
        
        return {
          targetBytes = string.format("%02X %02X %02X %02X", 
            targetBytes[1], targetBytes[2], targetBytes[3], targetBytes[4]),
          literalPools = literalPools
        }
      `, 60000)
      
      console.log(`📊 Target bytes: ${literalSearch.targetBytes}`)
      console.log(`📊 Found ${literalSearch.literalPools.length} literal pool locations`)
      
      if (literalSearch.literalPools.length === 0) {
        console.log('❌ Target address not found in ROM literal pools')
        return
      }
      
      // Step 2: Find instructions that reference these literal pools
      console.log('\n🔍 Step 2: Finding instructions that reference these literal pools...')
      const instructionSearch = await this.executeLua(`
        local literalPools = ${JSON.stringify(literalSearch.literalPools)}
        local foundInstructions = {}
        
        for _, literalAddr in ipairs(literalPools) do
          -- Search for THUMB LDR instructions that reference this literal
          local searchStart = math.max(0x08000000, literalAddr - 1020) -- THUMB max offset ~255*4
          local searchEnd = math.min(literalAddr, 0x08000000 + emu:romSize())
          
          for addr = searchStart, searchEnd - 2, 2 do
            local b1 = emu:read8(addr)
            if b1 == 0x48 then
              local b2 = emu:read8(addr + 1)
              local immediate = b2
              local pc = math.floor((addr + 4) / 4) * 4
              local calculatedLiteral = pc + immediate * 4
              
              if calculatedLiteral == literalAddr then
                table.insert(foundInstructions, {
                  type = "THUMB_LDR",
                  address = string.format("0x%08X", addr),
                  instruction = string.format("48 %02X", b2),
                  literalAddr = string.format("0x%08X", literalAddr),
                  immediate = immediate
                })
              end
            end
          end
          
          -- Search for ARM LDR instructions that reference this literal
          searchStart = math.max(0x08000000, literalAddr - 4092) -- ARM max offset ~4095
          for addr = searchStart, searchEnd - 4, 4 do
            local b1 = emu:read8(addr)
            local b2 = emu:read8(addr + 1)
            local b3 = emu:read8(addr + 2)
            local b4 = emu:read8(addr + 3)
            
            -- Look for ARM LDR PC-relative: ?? ?? 9F E5
            if b3 == 0x9F and b4 == 0xE5 then
              local immediate = b1 + (b2 * 256)
              local pc = addr + 8
              local calculatedLiteral = pc + immediate
              
              if calculatedLiteral == literalAddr then
                table.insert(foundInstructions, {
                  type = "ARM_LDR",
                  address = string.format("0x%08X", addr),
                  instruction = string.format("%02X %02X 9F E5", b1, b2),
                  literalAddr = string.format("0x%08X", literalAddr),
                  immediate = immediate
                })
              end
            end
          end
        end
        
        return foundInstructions
      `, 60000)
      
      console.log(`📊 Found ${instructionSearch.length} instructions referencing target address`)
      
      if (instructionSearch.length > 0) {
        console.log('\n🎉 SUCCESS: Universal Patterns found!')
        console.log('📝 Instructions that load the partyData address:')
        
        for (let i = 0; i < instructionSearch.length; i++) {
          const instr = instructionSearch[i]
          console.log(`   ${i + 1}. ${instr.type} @ ${instr.address}: ${instr.instruction}`)
          console.log(`      → Loads from literal @ ${instr.literalAddr} (immediate=${instr.immediate})`)
        }
        
        // Create Universal Patterns
        console.log('\n🔧 Universal Patterns:')
        const thumbPatterns = instructionSearch.filter((i: any) => i.type === 'THUMB_LDR')
        const armPatterns = instructionSearch.filter((i: any) => i.type === 'ARM_LDR')
        
        if (thumbPatterns.length > 0) {
          console.log('   THUMB LDR Pattern: 48 ?? (searches literal pools)')
          console.log(`   Found ${thumbPatterns.length} THUMB instances`)
        }
        
        if (armPatterns.length > 0) {
          console.log('   ARM LDR Pattern: ?? ?? 9F E5 (searches literal pools)')
          console.log(`   Found ${armPatterns.length} ARM instances`)
        }
        
      } else {
        console.log('❌ No instructions found that reference the target address')
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
  const finder = new EfficientPatternFinder()
  
  try {
    await finder.findUniversalPatterns('emerald')
    await new Promise(resolve => setTimeout(resolve, 3000))
    await finder.findUniversalPatterns('quetzal')
  } catch (error) {
    console.error('💥 Pattern detection failed:', error)
    process.exit(1)
  } finally {
    await finder.cleanup()
  }
}

// Handle cleanup on exit
process.on('SIGINT', async () => {
  console.log('\n⏹️  Interrupted - cleaning up...')
  const finder = new EfficientPatternFinder()
  await finder.cleanup()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n⏹️  Terminated - cleaning up...')
  const finder = new EfficientPatternFinder()
  await finder.cleanup()
  process.exit(0)
})

// Run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}