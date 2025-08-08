#!/usr/bin/env tsx
/**
 * Working Universal Pattern Test
 */

import { execSync } from 'node:child_process'
import { WebSocket } from 'ws'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'
const DOCKER_COMPOSE_FILE = 'docker/docker-compose.yml'

async function testWorkingPatterns() {
  console.log('🚀 Starting mGBA Docker for Quetzal...')
  
  try {
    // Stop and start container
    try {
      execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
      await new Promise(resolve => setTimeout(resolve, 2000))
    } catch {}
    
    execSync(`GAME=quetzal docker compose -f ${DOCKER_COMPOSE_FILE} up -d`, { 
      stdio: 'inherit',
      env: { ...process.env, GAME: 'quetzal' }
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
        
        console.log(`✅ mGBA ready (attempt ${attempt})`)
        break
      } catch {
        console.log(`   Waiting... (${attempt}/15)`)
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
    
    const ws = new WebSocket(MGBA_WEBSOCKET_URL)
    
    const execute = (code: string): Promise<any> => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout')), 30000)
        
        const handler = (data: any) => {
          const msg = data.toString()
          if (msg.startsWith('Welcome')) return
          
          ws.off('message', handler)
          clearTimeout(timeout)
          
          try {
            const response = JSON.parse(msg)
            resolve(response.result || response)
          } catch {
            resolve(msg.trim())
          }
        }
        
        ws.on('message', handler)
        ws.send(code)
      })
    }
    
    await new Promise((resolve) => {
      ws.on('open', resolve)
    })
    
    console.log('📋 Getting ROM info...')
    const romInfo = await execute(`
      return {
        title = emu:getGameTitle(),
        size = emu:romSize()
      }
    `)
    console.log('ROM:', romInfo)
    
    // Test a very basic pattern first
    console.log('🔍 Testing basic byte search...')
    const basicTest = await execute(`
      local found = {}
      local count = 0
      
      -- Look for 48 ?? 68 pattern in first 100k bytes
      for addr = 0x08000000, 0x08000000 + 100000 - 3 do
        local b1 = emu:read8(addr)
        local b3 = emu:read8(addr + 2)
        
        if b1 == 0x48 and b3 == 0x68 then
          count = count + 1
          table.insert(found, addr)
          if count >= 5 then break end
        end
      end
      
      return {
        count = count,
        addresses = found
      }
    `)
    
    console.log('🔍 Basic pattern results:', basicTest)
    
    if (basicTest.count > 0) {
      console.log('✅ Found basic patterns, testing address extraction...')
      
      // Test address extraction on first match
      const firstAddr = basicTest.addresses[0]
      const extractTest = await execute(`
        local addr = ${firstAddr}
        local b1 = emu:read8(addr)
        local b2 = emu:read8(addr + 1)
        local b3 = emu:read8(addr + 2)
        local b4 = emu:read8(addr + 4)
        local b5 = emu:read8(addr + 5)
        
        -- Check if it matches full pattern: 48 ?? 68 ?? 30 ??
        if b1 == 0x48 and b3 == 0x68 and (b4 == 0x30 or b4 == 0x31 or b4 == 0x32) then
          -- Try to extract address
          local immediate = b2
          local pc_aligned = math.floor((addr + 4) / 4) * 4
          local literal_addr = pc_aligned + (immediate * 4)
          
          if literal_addr >= 0x08000000 and literal_addr < 0x08000000 + emu:romSize() then
            local addr_b1 = emu:read8(literal_addr)
            local addr_b2 = emu:read8(literal_addr + 1)
            local addr_b3 = emu:read8(literal_addr + 2) 
            local addr_b4 = emu:read8(literal_addr + 3)
            
            -- Calculate address manually to avoid bitwise issues
            local address = addr_b1 + addr_b2 * 256 + addr_b3 * 65536 + addr_b4 * 16777216
            
            return {
              pattern_addr = addr,
              pattern_bytes = {b1, b2, b3, b4},
              immediate = immediate,
              pc_aligned = pc_aligned,
              literal_addr = literal_addr,
              address = address,
              is_target = (address == 0x020235B8)
            }
          else
            return {error = "literal_addr out of bounds"}
          end
        else
          return {error = "pattern mismatch", bytes = {b1, b2, b3, b4, b5}}
        end
      `)
      
      console.log('🔍 Address extraction result:', extractTest)
    }
    
    ws.close()
    
  } catch (error) {
    console.error('❌ Failed:', error)
  } finally {
    try {
      execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
    } catch {}
  }
}

testWorkingPatterns()