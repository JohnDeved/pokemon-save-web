#!/usr/bin/env tsx
/**
 * Debug mGBA WebSocket communication
 */

import { execSync } from 'node:child_process'
import { WebSocket } from 'ws'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'
const DOCKER_COMPOSE_FILE = 'docker/docker-compose.yml'

async function debugMGBA() {
  console.log('🚀 Starting mGBA Docker...')
  
  try {
    // Stop any existing container
    try {
      execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
      await new Promise(resolve => setTimeout(resolve, 2000))
    } catch {
      // Ignore errors
    }
    
    // Start container for Quetzal (32MB ROM)
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
    
    // Connect and test
    console.log('🔗 Connecting to WebSocket...')
    const ws = new WebSocket(MGBA_WEBSOCKET_URL)
    
    ws.on('open', () => {
      console.log('✅ WebSocket connected')
      
      // Test simple expression
      console.log('📤 Sending: return "hello"')
      ws.send('return "hello"')
    })
    
    ws.on('message', (data) => {
      const msg = data.toString()
      console.log('📥 Received:', msg)
      
      if (msg.startsWith('Welcome')) {
        console.log('📤 Sending ROM info request...')
        ws.send(`
          if emu and emu.getGameTitle and emu.romSize then
            return {
              title = emu:getGameTitle(),
              size = emu:romSize()
            }
          else
            return {error = "emu not available"}
          end
        `)
      } else if (msg.includes('title') || msg.includes('error')) {
        console.log('📤 Sending pattern test...')
        ws.send(`
          if not emu or not emu.romSize or emu:romSize() == 0 then
            return {error = "No ROM"}
          end
          
          local count = 0
          for addr = 0x08000000, 0x08000000 + 100000 do
            local b1 = emu:read8(addr)
            if b1 == 0x48 then
              count = count + 1
              if count >= 10 then break end
            end
          end
          
          return {patternCount = count}
        `)
      } else {
        console.log('🏁 Test complete')
        ws.close()
        process.exit(0)
      }
    })
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error)
      process.exit(1)
    })
    
    ws.on('close', () => {
      console.log('🔌 WebSocket closed')
    })
    
    // Timeout
    setTimeout(() => {
      console.log('⏰ Timeout - closing')
      ws.close()
      process.exit(0)
    }, 30000)
    
  } catch (error) {
    console.error('❌ Failed:', error)
    process.exit(1)
  }
}

debugMGBA()