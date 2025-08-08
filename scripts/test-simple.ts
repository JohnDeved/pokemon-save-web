#!/usr/bin/env tsx
/**
 * Simple test using the basic pattern script
 */

import { WebSocket } from 'ws'
import { readFileSync } from 'node:fs'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'

async function simpleTest() {
  console.log('🔌 Connecting to WebSocket...')
  const ws = new WebSocket(MGBA_WEBSOCKET_URL)
  
  await new Promise((resolve, reject) => {
    ws.on('open', () => {
      console.log('✅ Connected')
      resolve(true)
    })
    ws.on('error', reject)
    setTimeout(() => reject(new Error('Connection timeout')), 10000)
  })
  
  console.log('📝 Loading simple test script...')
  const testScript = readFileSync('./scripts/mgba-lua/simple-test.lua', 'utf-8')
  
  const result = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Test timeout'))
    }, 60000) // 60 second timeout
    
    let scriptLoaded = false
    
    ws.on('message', (data) => {
      const str = data.toString()
      if (str.startsWith('Welcome')) return // Skip welcome
      
      try {
        const response = JSON.parse(str)
        console.log('📥 Response:', response)
        
        clearTimeout(timeout)
        resolve(response.result)
      } catch (error) {
        // If it's not JSON, it might be a log message
        console.log('📄 Log:', str)
      }
    })
    
    // Send the script
    ws.send(testScript)
  })
  
  ws.close()
  
  console.log('📊 Final Result:')
  console.log(JSON.stringify(result, null, 2))
}

simpleTest().catch(console.error)