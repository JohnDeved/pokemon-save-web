#!/usr/bin/env tsx

import { WebSocket } from 'ws'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function testSimpleROMAccess() {
  console.log('🔍 Testing simple ROM access via mGBA WebSocket...')
  
  const ws = new WebSocket('ws://localhost:7102/ws')
  
  try {
    await new Promise((resolve, reject) => {
      ws.onopen = resolve
      ws.onerror = reject
      setTimeout(() => reject(new Error('Connection timeout')), 5000)
    })
    
    console.log('✅ Connected to mGBA WebSocket')
    
    // Execute simple ROM test
    const scriptPath = resolve(__dirname, 'mgba-lua', 'simple-rom-test.lua')
    const luaScript = readFileSync(scriptPath, 'utf-8')
    
    const result = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Execution timeout')), 10000)
      
      ws.onmessage = (event) => {
        clearTimeout(timeout)
        try {
          const data = JSON.parse(event.data.toString())
          resolve(data)
        } catch {
          resolve(event.data.toString())
        }
      }
      
      ws.send(JSON.stringify({
        type: 'lua-eval',
        code: luaScript
      }))
    })
    
    console.log('🎯 Result:', result)
    
  } catch (error) {
    console.log('❌ Error:', error)
  } finally {
    ws.close()
  }
}

testSimpleROMAccess().catch(console.error)