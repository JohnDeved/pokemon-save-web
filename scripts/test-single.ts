#!/usr/bin/env tsx
/**
 * Test just one game to debug faster
 */

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { WebSocket } from 'ws'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'
const TEST_SCRIPT_PATH = './scripts/mgba-lua/test-universal-patterns.lua'
const DOCKER_COMPOSE_FILE = 'docker/docker-compose.yml'

async function testSingleGame() {
  console.log('🚀 Testing Universal Patterns for Emerald only...')
  
  // Start mGBA
  console.log('🚀 Starting mGBA Docker for emerald...')
  execSync(`GAME=emerald docker compose -f ${DOCKER_COMPOSE_FILE} up -d --build`, { 
    stdio: 'inherit',
    env: { ...process.env, GAME: 'emerald' }
  })
  
  // Wait for container to be ready
  console.log('⏳ Waiting for container to be ready...')
  let ready = false
  for (let i = 0; i < 30; i++) {
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
      ready = true
      break
    } catch {
      console.log(`  Attempt ${i + 1}/30...`)
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  
  if (!ready) {
    throw new Error('Container not ready')
  }
  
  // Connect to WebSocket
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
  
  // Load and run test
  console.log('📝 Loading test script...')
  const testScript = readFileSync(TEST_SCRIPT_PATH, 'utf-8')
  
  let scriptLoaded = false
  
  const result = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Test timeout'))
    }, 120000)
    
    ws.on('message', (data) => {
      const str = data.toString()
      if (str.startsWith('Welcome')) return // Skip welcome
      
      try {
        const response = JSON.parse(str)
        
        if (!scriptLoaded) {
          console.log('🧪 Script loaded, running test...')
          scriptLoaded = true
          ws.send('return runTest()')
        } else {
          clearTimeout(timeout)
          resolve(response.result)
        }
      } catch (error) {
        clearTimeout(timeout)
        reject(error)
      }
    })
    
    // Load the script
    ws.send(testScript)
  })
  
  ws.close()
  
  console.log('📊 Test Results:')
  console.log(JSON.stringify(result, null, 2))
  
  // Cleanup
  execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
}

testSingleGame().catch(console.error)