#!/usr/bin/env tsx
/**
 * Simple debug script to test Lua execution
 */

import { execSync } from 'node:child_process'
import { WebSocket } from 'ws'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'

async function testSimpleLua() {
  console.log('🔍 Testing simple Lua execution with mGBA')
  
  // Start mGBA with emerald
  try {
    execSync(`docker compose -f docker/docker-compose.yml down`, { stdio: 'pipe' })
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    execSync(`GAME=emerald docker compose -f docker/docker-compose.yml up -d`, { 
      stdio: 'inherit',
      env: { ...process.env, GAME: 'emerald' }
    })
    
    // Wait for readiness
    let connected = false
    for (let attempt = 1; attempt <= 10; attempt++) {
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
        
        connected = true
        console.log(`✅ mGBA ready (attempt ${attempt})`)
        break
      } catch {
        console.log(`   Waiting... (${attempt}/10)`)
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
    
    if (!connected) {
      console.log('❌ Failed to connect to mGBA')
      return
    }
    
    // Test simple Lua execution
    const ws = new WebSocket(MGBA_WEBSOCKET_URL)
    
    ws.on('open', () => {
      console.log('🔗 WebSocket connected')
      
      // Test 1: Simple return
      console.log('🧪 Test 1: Simple return')
      ws.send('return "hello"')
    })
    
    let testCount = 0
    ws.on('message', (data) => {
      const rawData = data.toString()
      console.log(`📨 Raw response: ${rawData}`)
      
      if (rawData.startsWith('Welcome to')) {
        console.log('👋 Received welcome message')
        return
      }
      
      testCount++
      
      if (testCount === 1) {
        console.log('🧪 Test 2: ROM info')
        ws.send(`
          return {
            title = emu:getGameTitle(),
            size = emu:romSize()
          }
        `)
      } else if (testCount === 2) {
        console.log('🧪 Test 3: Read first bytes')
        ws.send(`
          local bytes = {}
          for i = 0, 7 do
            bytes[i+1] = emu:read8(0x08000000 + i)
          end
          return bytes
        `)
      } else if (testCount === 3) {
        console.log('🧪 Test 4: Search for 0x48 byte')
        ws.send(`
          local count = 0
          for addr = 0x08000000, 0x08000000 + 10000 do
            if emu:read8(addr) == 0x48 then
              count = count + 1
            end
          end
          return count
        `)
      } else if (testCount === 4) {
        console.log('✅ All tests completed')
        ws.close()
        
        // Cleanup
        setTimeout(() => {
          try {
            execSync(`docker compose -f docker/docker-compose.yml down`, { stdio: 'pipe' })
          } catch {}
          process.exit(0)
        }, 1000)
      }
    })
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error)
    })
    
  } catch (error) {
    console.error('❌ Failed to start mGBA:', error)
  }
}

testSimpleLua()