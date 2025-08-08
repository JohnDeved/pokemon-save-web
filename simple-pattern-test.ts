#!/usr/bin/env tsx
/**
 * Simple Universal Pattern Test
 */

import { execSync } from 'node:child_process'
import { WebSocket } from 'ws'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'
const DOCKER_COMPOSE_FILE = 'docker/docker-compose.yml'

async function testPatterns() {
  console.log('🚀 Starting mGBA Docker for Quetzal...')
  
  try {
    // Stop any existing container
    try {
      execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
      await new Promise(resolve => setTimeout(resolve, 2000))
    } catch {}
    
    // Start container for Quetzal
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
    
    // Connect and test patterns
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
    
    console.log('🔍 Testing simple THUMB pattern...')
    const thumbTest = await execute(`
      local matches = {}
      local count = 0
      
      for addr = 0x08000000, 0x08000000 + 500000 - 6 do
        local b1 = emu:read8(addr)
        local b3 = emu:read8(addr + 2) 
        local b5 = emu:read8(addr + 4)
        
        if b1 == 0x48 and b3 == 0x68 and b5 == 0x30 then
          count = count + 1
          
          -- Try to extract address
          local b2 = emu:read8(addr + 1)
          local immediate = b2
          local pc = (addr + 4) & 0xFFFFFFFC
          local literalAddr = pc + (immediate * 4)
          
          if literalAddr >= 0x08000000 and literalAddr < (0x08000000 + emu:romSize()) then
            local b1 = emu:read8(literalAddr)
            local b2 = emu:read8(literalAddr + 1) 
            local b3 = emu:read8(literalAddr + 2)
            local b4 = emu:read8(literalAddr + 3)
            local address = b1 | (b2 << 8) | (b3 << 16) | (b4 << 24)
            
            if address >= 0x02000000 and address < 0x04000000 then
              table.insert(matches, {
                pattern = addr,
                address = address,
                expected = address == 0x020235B8
              })
            end
          end
          
          if count >= 10 then break end
        end
      end
      
      return {
        totalCount = count,
        validMatches = #matches,
        matches = matches
      }
    `)
    
    console.log('🔍 THUMB Results:', JSON.stringify(thumbTest, null, 2))
    
    // Check if we found the expected address
    if (thumbTest.matches) {
      for (const match of thumbTest.matches) {
        if (match.expected) {
          console.log(`🎉 SUCCESS: Found Quetzal partyData at 0x${match.address.toString(16)} via THUMB pattern!`)
          ws.close()
          return
        }
      }
    }
    
    console.log('🔍 Testing ARM patterns...')
    const armTest = await execute(`
      local matches = {}
      
      -- Test Quetzal pattern (0x68 = 104 bytes)
      for addr = 0x08000000, 0x08000000 + 500000 - 12 do
        local b1 = emu:read8(addr)
        local b4 = emu:read8(addr + 3)
        local b5 = emu:read8(addr + 4)
        local b6 = emu:read8(addr + 5)
        local b9 = emu:read8(addr + 8)
        local b10 = emu:read8(addr + 9)
        
        if b1 == 0xE0 and b4 == 0x68 and b5 == 0xE5 and b6 == 0x9F and b9 == 0xE0 and (b10 & 0xF0) == 0x80 then
          -- Found ARM pattern, try to extract address
          for i = 0, 8, 4 do
            local offset = addr + i
            local b3 = emu:read8(offset + 2)
            local b4 = emu:read8(offset + 3)
            
            if b3 == 0x9F and b4 == 0xE5 then
              local b1 = emu:read8(offset)
              local b2 = emu:read8(offset + 1)
              local immediate = b1 | (b2 << 8)
              local pc = offset + 8
              local literalAddr = pc + immediate
              
              if literalAddr >= 0x08000000 and literalAddr < (0x08000000 + emu:romSize()) then
                local b1 = emu:read8(literalAddr)
                local b2 = emu:read8(literalAddr + 1)
                local b3 = emu:read8(literalAddr + 2)
                local b4 = emu:read8(literalAddr + 3)
                local address = b1 | (b2 << 8) | (b3 << 16) | (b4 << 24)
                
                if address >= 0x02000000 and address < 0x04000000 then
                  table.insert(matches, {
                    pattern = addr,
                    address = address,
                    expected = address == 0x020235B8
                  })
                  break
                end
              end
            end
          end
          
          if #matches >= 5 then break end
        end
      end
      
      return {
        validMatches = #matches,
        matches = matches
      }
    `)
    
    console.log('🔍 ARM Results:', JSON.stringify(armTest, null, 2))
    
    if (armTest.matches) {
      for (const match of armTest.matches) {
        if (match.expected) {
          console.log(`🎉 SUCCESS: Found Quetzal partyData at 0x${match.address.toString(16)} via ARM pattern!`)
          ws.close()
          return
        }
      }
    }
    
    console.log('❌ No patterns found expected address 0x020235B8')
    ws.close()
    
  } catch (error) {
    console.error('❌ Failed:', error)
  } finally {
    try {
      execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
    } catch {}
  }
}

testPatterns()