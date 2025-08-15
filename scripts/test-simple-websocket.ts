#!/usr/bin/env tsx
/**
 * Simple WebSocket test to debug the Lua execution
 */

import WebSocket from 'ws'
import { execSync } from 'node:child_process'

async function testSimpleWebSocket() {
  console.log('🚀 Testing simple WebSocket connection...')
  
  try {
    // Start container
    execSync('docker compose -f docker/docker-compose.yml down', { stdio: 'pipe' })
    execSync(`docker compose -f docker/docker-compose.yml up -d`, {
      stdio: 'inherit',
      env: { ...process.env, GAME: 'emerald' }
    })
    
    // Wait for HTTP server
    for (let i = 0; i < 20; i++) {
      try {
        execSync('curl -sf http://localhost:7102/', { stdio: 'pipe' })
        console.log(`✅ mGBA ready`)
        break
      } catch (e) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    // Connect WebSocket
    const ws = new WebSocket('ws://localhost:7102/ws')
    
    ws.on('open', () => {
      console.log('🔗 WebSocket connected')
      
      // Test simple Lua code
      console.log('Testing simple Lua...')
      ws.send('return 42')
      
      setTimeout(() => {
        console.log('Testing ROM info...')
        ws.send('return emu:getGameTitle()')
      }, 2000)
      
      setTimeout(() => {
        console.log('Testing target address...')
        ws.send('return 0x020244EC')
      }, 4000)
      
      setTimeout(() => {
        ws.close()
        execSync('docker compose -f docker/docker-compose.yml down', { stdio: 'pipe' })
        process.exit(0)
      }, 6000)
    })
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString())
        if (message.error) {
          console.log('💥 Error:', message.error)
        } else if (message.result !== undefined) {
          console.log('✅ Result:', message.result)
        }
      } catch (e) {
        console.log('📨 Message:', data.toString())
      }
    })
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error)
    })
    
  } catch (error) {
    console.error('❌ Setup error:', error)
  }
}

testSimpleWebSocket().catch(console.error)