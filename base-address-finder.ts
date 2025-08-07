#!/usr/bin/env tsx
/**
 * Search for base addresses and potential calculations that lead to partyData addresses
 */

import { execSync } from 'node:child_process'
import { WebSocket } from 'ws'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'
const DOCKER_COMPOSE_FILE = 'docker/docker-compose.yml'

class BaseAddressFinder {
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

  async searchBaseAddresses(game: 'emerald' | 'quetzal'): Promise<void> {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🔍 Base Address Analysis - Pokemon ${game.toUpperCase()}`)
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
      
      // Search for potential base addresses that could lead to the target
      console.log('\n🔍 Searching for potential base addresses and offsets...')
      
      const result = await this.executeLua(`
        local targetAddr = ${expectedAddr}
        local results = {}
        
        -- Common base addresses in GBA games
        local commonBases = {
          0x02000000, -- EWRAM start
          0x02020000, -- Common save data area
          0x03000000, -- IWRAM start
          0x08000000, -- ROM start
        }
        
        -- Search for addresses that could be base + offset = target
        local baseMatches = {}
        for _, base in ipairs(commonBases) do
          local offset = targetAddr - base
          if offset > 0 and offset < 0x100000 then -- Reasonable offset range
            table.insert(baseMatches, {
              base = base,
              offset = offset,
              baseHex = string.format("0x%08X", base),
              offsetHex = string.format("0x%X", offset)
            })
          end
        end
        
        -- Search for the base addresses and offsets in ROM
        local foundPatterns = {}
        for _, match in ipairs(baseMatches) do
          -- Search for base address
          local baseBytes = {
            match.base & 0xFF,
            (match.base >> 8) & 0xFF,
            (match.base >> 16) & 0xFF,
            (match.base >> 24) & 0xFF
          }
          
          -- Search for offset
          local offsetBytes = {
            match.offset & 0xFF,
            (match.offset >> 8) & 0xFF,
            (match.offset >> 16) & 0xFF,
            (match.offset >> 24) & 0xFF
          }
          
          local baseCount = 0
          local offsetCount = 0
          
          -- Search first 1MB for performance
          for addr = 0x08000000, 0x08000000 + 1048576 - 4, 4 do
            local b1 = emu:read8(addr)
            local b2 = emu:read8(addr + 1)
            local b3 = emu:read8(addr + 2)
            local b4 = emu:read8(addr + 3)
            
            -- Check for base address
            if b1 == baseBytes[1] and b2 == baseBytes[2] and 
               b3 == baseBytes[3] and b4 == baseBytes[4] then
              baseCount = baseCount + 1
            end
            
            -- Check for offset (if it's large enough to be meaningful)
            if match.offset > 0xFF and 
               b1 == offsetBytes[1] and b2 == offsetBytes[2] and 
               b3 == offsetBytes[3] and b4 == offsetBytes[4] then
              offsetCount = offsetCount + 1
            end
          end
          
          if baseCount > 0 or offsetCount > 0 then
            table.insert(foundPatterns, {
              base = match.baseHex,
              offset = match.offsetHex,
              baseFound = baseCount,
              offsetFound = offsetCount,
              calculation = match.baseHex .. " + " .. match.offsetHex .. " = " .. string.format("0x%08X", targetAddr)
            })
          end
        end
        
        -- Also search for any RAM addresses in the target's neighborhood
        local neighborAddresses = {}
        for offset = -1024, 1024, 4 do
          local testAddr = targetAddr + offset
          if testAddr >= 0x02000000 and testAddr < 0x04000000 then
            local testBytes = {
              testAddr & 0xFF,
              (testAddr >> 8) & 0xFF,
              (testAddr >> 16) & 0xFF,
              (testAddr >> 24) & 0xFF
            }
            
            local count = 0
            for addr = 0x08000000, 0x08000000 + 1048576 - 4, 4 do
              local b1 = emu:read8(addr)
              local b2 = emu:read8(addr + 1)
              local b3 = emu:read8(addr + 2)
              local b4 = emu:read8(addr + 3)
              
              if b1 == testBytes[1] and b2 == testBytes[2] and 
                 b3 == testBytes[3] and b4 == testBytes[4] then
                count = count + 1
              end
            end
            
            if count > 0 then
              table.insert(neighborAddresses, {
                address = string.format("0x%08X", testAddr),
                offset = offset,
                count = count
              })
            end
          end
        end
        
        return {
          basePatterns = foundPatterns,
          neighborAddresses = neighborAddresses
        }
      `, 120000)
      
      console.log('\n📊 Base Address Analysis Results:')
      
      if (result.basePatterns && result.basePatterns.length > 0) {
        console.log(`✅ Found ${result.basePatterns.length} potential base + offset calculations:`)
        for (let i = 0; i < result.basePatterns.length; i++) {
          const pattern = result.basePatterns[i]
          console.log(`   ${i + 1}. ${pattern.calculation}`)
          console.log(`      Base ${pattern.base} found ${pattern.baseFound} times`)
          console.log(`      Offset ${pattern.offset} found ${pattern.offsetFound} times`)
        }
      } else {
        console.log('❌ No base + offset patterns found')
      }
      
      if (result.neighborAddresses && result.neighborAddresses.length > 0) {
        console.log(`\n✅ Found ${result.neighborAddresses.length} nearby addresses in ROM:`)
        for (let i = 0; i < Math.min(10, result.neighborAddresses.length); i++) {
          const neighbor = result.neighborAddresses[i]
          const offsetStr = neighbor.offset >= 0 ? `+${neighbor.offset}` : `${neighbor.offset}`
          console.log(`   ${i + 1}. ${neighbor.address} (target${offsetStr}) - found ${neighbor.count} times`)
        }
        if (result.neighborAddresses.length > 10) {
          console.log(`   ... and ${result.neighborAddresses.length - 10} more`)
        }
      } else {
        console.log('\n❌ No nearby addresses found in ROM')
      }
      
    } catch (error) {
      console.error('❌ Analysis failed:', error)
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
  const finder = new BaseAddressFinder()
  
  try {
    await finder.searchBaseAddresses('emerald')
    await new Promise(resolve => setTimeout(resolve, 3000))
    await finder.searchBaseAddresses('quetzal')
  } catch (error) {
    console.error('💥 Base address analysis failed:', error)
    process.exit(1)
  } finally {
    await finder.cleanup()
  }
}

// Handle cleanup on exit
process.on('SIGINT', async () => {
  console.log('\n⏹️  Interrupted - cleaning up...')
  const finder = new BaseAddressFinder()
  await finder.cleanup()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n⏹️  Terminated - cleaning up...')
  const finder = new BaseAddressFinder()
  await finder.cleanup()
  process.exit(0)
})

// Run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}