#!/usr/bin/env tsx
/**
 * Optimized Universal Pattern search that works efficiently in mGBA
 */

import { execSync } from 'node:child_process'
import { WebSocket } from 'ws'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'
const DOCKER_COMPOSE_FILE = 'docker/docker-compose.yml'

class OptimizedPatternSearch {
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

  async executeLua(code: string, timeout = 60000): Promise<any> {
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

  async findWorkingPatterns(game: 'emerald' | 'quetzal'): Promise<void> {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🎯 Optimized Pattern Search for Pokemon ${game.toUpperCase()}`)
    console.log(`${'='.repeat(60)}`)
    
    const expectedAddresses = {
      emerald: 0x020244EC,
      quetzal: 0x020235B8
    }
    
    const expectedAddress = expectedAddresses[game]
    
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
          first_byte = emu:read8(0x08000000)
        }
      `)
      
      console.log(`✅ ROM: ${romInfo.rom_title} (${romInfo.rom_size} bytes)`)
      
      // Optimized search: Find literal pools efficiently using readRange
      console.log('🔍 Step 1: Efficient literal pool search using readRange...')
      
      const literalPoolSearch = await this.executeLua(`
        local game = "${game}"
        local expectedAddr = ${expectedAddress}
        
        -- Target bytes in little-endian format
        local targetBytes
        if game == "emerald" then
          targetBytes = "\\xEC\\x44\\x02\\x02"  -- 0x020244EC
        else
          targetBytes = "\\xB8\\x35\\x02\\x02"  -- 0x020235B8  
        end
        
        local pools = {}
        local romSize = emu:romSize()
        local chunkSize = 65536  -- 64KB chunks for efficiency
        
        -- Search in chunks
        for chunkStart = 0x08000000, 0x08000000 + math.min(romSize, 1500000), chunkSize do
          local chunkEnd = math.min(chunkStart + chunkSize, 0x08000000 + romSize)
          local actualSize = chunkEnd - chunkStart
          
          if actualSize > 4 then
            local chunk = emu:readRange(chunkStart, actualSize)
            
            -- Look for target bytes in chunk
            local pos = 1
            while true do
              local found = chunk:find(targetBytes, pos, true)
              if not found then break end
              
              -- Calculate actual ROM address
              local romAddr = chunkStart + found - 1
              table.insert(pools, string.format("0x%08X", romAddr))
              
              -- Limit to first 10 pools
              if #pools >= 10 then break end
              
              pos = found + 4
            end
            
            if #pools >= 10 then break end
          end
        end
        
        return {
          expectedAddr = string.format("0x%08X", expectedAddr),
          game = game,
          poolsFound = #pools,
          pools = pools,
          targetBytes = targetBytes
        }
      `, 45000)
      
      console.log(`Target address: ${literalPoolSearch.expectedAddr}`)
      console.log(`Literal pools found: ${literalPoolSearch.poolsFound}`)
      
      if (literalPoolSearch.pools && literalPoolSearch.pools.length > 0) {
        console.log('Literal pool locations:')
        literalPoolSearch.pools.forEach((pool: string, i: number) => {
          console.log(`  ${i + 1}. ${pool}`)
        })
      } else {
        console.log('❌ No literal pools found!')
        return
      }
      
      // Step 2: For each pool, find referencing instructions efficiently  
      console.log('\n🔍 Step 2: Finding THUMB and ARM instructions referencing pools...')
      
      for (const poolStr of literalPoolSearch.pools.slice(0, 3)) {
        const poolAddr = parseInt(poolStr, 16)
        console.log(`\nAnalyzing pool at ${poolStr}:`)
        
        const instructionSearch = await this.executeLua(`
          local poolAddr = ${poolAddr}
          local results = {
            thumb = {},
            arm = {}
          }
          
          -- Search backwards for instructions (efficient range)
          local searchStart = math.max(0x08000000, poolAddr - 2000)
          local searchSize = poolAddr - searchStart
          
          if searchSize > 0 then
            local chunk = emu:readRange(searchStart, searchSize)
            
            -- Look for THUMB LDR patterns (48-4F)
            for i = 1, #chunk - 1, 2 do
              local b1 = chunk:byte(i)
              local b2 = chunk:byte(i + 1)
              
              if b1 >= 0x48 and b1 <= 0x4F then
                local instAddr = searchStart + i - 1
                local immediate = b2
                local pc = math.floor((instAddr + 4) / 4) * 4
                local calcPoolAddr = pc + (immediate * 4)
                
                if calcPoolAddr == poolAddr then
                  table.insert(results.thumb, {
                    addr = string.format("0x%08X", instAddr),
                    pattern = string.format("%02X %02X", b1, b2),
                    calculation = string.format("PC(0x%08X) + %d*4 = 0x%08X", pc, immediate, calcPoolAddr)
                  })
                  if #results.thumb >= 3 then break end
                end
              end
            end
            
            -- Look for ARM LDR patterns (E5 9F)  
            for i = 1, #chunk - 3, 4 do
              local b1 = chunk:byte(i)
              local b2 = chunk:byte(i + 1)
              local b3 = chunk:byte(i + 2)
              local b4 = chunk:byte(i + 3)
              
              if b3 == 0x9F and b4 == 0xE5 then
                local instAddr = searchStart + i - 1
                local immediate = b1 + (b2 * 256)
                local pc = instAddr + 8
                local calcPoolAddr = pc + immediate
                
                if calcPoolAddr == poolAddr then
                  table.insert(results.arm, {
                    addr = string.format("0x%08X", instAddr),
                    pattern = string.format("E5 9F %02X %02X", b1, b2),
                    calculation = string.format("PC(0x%08X) + %d = 0x%08X", pc, immediate, calcPoolAddr)
                  })
                  if #results.arm >= 3 then break end
                end
              end
            end
          end
          
          return {
            poolAddr = string.format("0x%08X", poolAddr),
            thumbFound = #results.thumb,
            armFound = #results.arm,
            thumb = results.thumb,
            arm = results.arm
          }
        `, 30000)
        
        console.log(`  THUMB patterns: ${instructionSearch.thumbFound}`)
        instructionSearch.thumb?.forEach((inst: any, i: number) => {
          console.log(`    ${i + 1}. ${inst.addr}: ${inst.pattern}`)
          console.log(`       ${inst.calculation}`)
        })
        
        console.log(`  ARM patterns: ${instructionSearch.armFound}`)
        instructionSearch.arm?.forEach((inst: any, i: number) => {
          console.log(`    ${i + 1}. ${inst.addr}: ${inst.pattern}`)
          console.log(`       ${inst.calculation}`)
        })
        
        // If we found working patterns, we can stop
        if (instructionSearch.thumbFound > 0 || instructionSearch.armFound > 0) {
          console.log(`\n🎉 SUCCESS: Found working patterns for ${game.toUpperCase()}!`)
          
          // Extract Universal Patterns
          if (instructionSearch.thumbFound > 0) {
            const thumbPattern = instructionSearch.thumb[0]
            console.log(`✅ THUMB Universal Pattern: ${thumbPattern.pattern}`)
            console.log(`   Instruction: ${thumbPattern.addr}: ${thumbPattern.pattern}`)
            console.log(`   Resolves to: ${expectedAddress.toString(16).toUpperCase()}`)
          }
          
          if (instructionSearch.armFound > 0) {
            const armPattern = instructionSearch.arm[0]
            console.log(`✅ ARM Universal Pattern: ${armPattern.pattern}`)
            console.log(`   Instruction: ${armPattern.addr}: ${armPattern.pattern}`)
            console.log(`   Resolves to: ${expectedAddress.toString(16).toUpperCase()}`)
          }
          
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

  async runOptimizedSearch(): Promise<void> {
    console.log('🎯 Optimized Universal Pattern Search')
    console.log('Using efficient readRange API to find working patterns')
    console.log(`${'='.repeat(60)}`)
    
    const games: ('emerald' | 'quetzal')[] = ['emerald', 'quetzal']
    
    for (const game of games) {
      await this.findWorkingPatterns(game)
      
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
  const searcher = new OptimizedPatternSearch()
  await searcher.runOptimizedSearch()
}

main().catch(console.error)

export { OptimizedPatternSearch }