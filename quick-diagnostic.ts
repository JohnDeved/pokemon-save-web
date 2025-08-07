#!/usr/bin/env tsx
/**
 * Quick diagnostic to understand the pattern search issue
 */

import { execSync } from 'node:child_process'
import { WebSocket } from 'ws'
import { readFileSync } from 'node:fs'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'

async function quickDiagnostic() {
  console.log('🔬 Quick Diagnostic Test')
  console.log('Testing basic pattern detection capabilities')
  
  // Start mGBA with quetzal (since it's working better)
  try {
    execSync(`docker compose -f docker/docker-compose.yml down`, { stdio: 'pipe' })
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    execSync(`GAME=quetzal docker compose -f docker/docker-compose.yml up -d`, { 
      stdio: 'inherit',
      env: { ...process.env, GAME: 'quetzal' }
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
    
    // Connect WebSocket
    const ws = new WebSocket(MGBA_WEBSOCKET_URL)
    
    const executeScript = (code: string): Promise<any> => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout'))
        }, 30000)
        
        const handler = (data: any) => {
          const rawData = data.toString()
          if (rawData.startsWith('Welcome to')) return
          
          clearTimeout(timeout)
          ws.off('message', handler)
          
          try {
            const response = JSON.parse(rawData)
            resolve(response.result || response)
          } catch {
            resolve(rawData.trim())
          }
        }
        
        ws.on('message', handler)
        ws.send(code)
      })
    }
    
    await new Promise((resolve) => {
      ws.on('open', resolve)
      setTimeout(resolve, 5000)
    })
    
    console.log('📝 Loading diagnostic script...')
    const luaScript = readFileSync('./scripts/mgba-lua/simple-diagnostic.lua', 'utf-8')
    await executeScript(luaScript)
    
    console.log('🔍 Running diagnostic...')
    const result = await executeScript('return simpleDiagnostic()')
    
    console.log('\n📊 Diagnostic Results:')
    console.log(`ROM: ${result.romTitle} (${result.romSize} bytes)`)
    console.log(`Search limit: ${result.searchLimit} bytes`)
    
    console.log('\n🔢 First 16 ROM bytes:')
    const hexBytes = result.firstBytes.map((b: number) => `0x${b.toString(16).toUpperCase().padStart(2, '0')}`).join(' ')
    console.log(`   ${hexBytes}`)
    
    console.log('\n📈 Byte pattern counts:')
    console.log(`   0x48 bytes: ${result.counts.byte48}`)
    console.log(`   0x68 bytes: ${result.counts.byte68}`)
    console.log(`   0x30 bytes: ${result.counts.byte30}`)
    console.log(`   0xE0 bytes: ${result.counts.byteE0}`)
    console.log(`   0xE5 bytes: ${result.counts.byteE5}`)
    console.log(`   0x9F bytes: ${result.counts.byte9F}`)
    
    console.log(`\n🎯 THUMB patterns (48-68-30): ${result.thumbPatterns}`)
    
    if (result.bytePatterns.length > 0) {
      console.log('\n📍 Sample 0x48 locations:')
      result.bytePatterns.forEach((pattern: string) => {
        console.log(`   ${pattern}`)
      })
    }
    
    if (result.thumbComponents.length > 0) {
      console.log('\n🎯 THUMB pattern locations:')
      result.thumbComponents.forEach((pattern: string) => {
        console.log(`   ${pattern}`)
      })
    }
    
    ws.close()
    
    // Cleanup
    setTimeout(() => {
      try {
        execSync(`docker compose -f docker/docker-compose.yml down`, { stdio: 'pipe' })
      } catch {}
      process.exit(0)
    }, 2000)
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error)
  }
}

quickDiagnostic()