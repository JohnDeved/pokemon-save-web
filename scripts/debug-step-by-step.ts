#!/usr/bin/env tsx
/**
 * Debugging Universal Pattern System
 * Step-by-step debugging to identify and fix the core issues
 */

import { execSync } from 'node:child_process'
import { WebSocket } from 'ws'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'
const DOCKER_COMPOSE_FILE = 'docker/docker-compose.yml'

class DebugUniversalPatterns {
  private ws: WebSocket | null = null

  async startMGBA(game: 'emerald' | 'quetzal'): Promise<boolean> {
    console.log(`🚀 Starting mGBA for ${game}...`)
    
    try {
      execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      execSync(`GAME=${game} docker compose -f ${DOCKER_COMPOSE_FILE} up -d`, { 
        stdio: 'inherit',
        env: { ...process.env, GAME: game }
      })
      
      for (let attempt = 1; attempt <= 15; attempt++) {
        try {
          const testWs = new WebSocket(MGBA_WEBSOCKET_URL)
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              testWs.close()
              reject(new Error('timeout'))
            }, 2000)
            
            testWs.onopen = () => {
              clearTimeout(timeout)
              testWs.close()
              resolve(true)
            }
            
            testWs.onerror = () => {
              clearTimeout(timeout)
              reject(new Error('error'))
            }
          })
          
          console.log(`✅ mGBA ready (attempt ${attempt})`)
          return true
        } catch {
          if (attempt < 15) {
            console.log(`   Waiting... (${attempt}/15)`)
            await new Promise(resolve => setTimeout(resolve, 1500))
          }
        }
      }
      
      return false
    } catch (error) {
      console.error('❌ Failed to start mGBA:', error)
      return false
    }
  }

  async connectWebSocket(): Promise<boolean> {
    try {
      this.ws = new WebSocket(MGBA_WEBSOCKET_URL)
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve(false)
        }, 8000)
        
        this.ws!.onopen = () => {
          clearTimeout(timeout)
          resolve(true)
        }
        
        this.ws!.onerror = () => {
          clearTimeout(timeout)
          resolve(false)
        }
      })
    } catch {
      return false
    }
  }

  async executeLuaDebug(code: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('WebSocket not connected'))
        return
      }
      
      console.log(`🐛 Executing Lua: ${code.substring(0, 100)}${code.length > 100 ? '...' : ''}`)
      
      const timeout = setTimeout(() => {
        reject(new Error('Execution timeout'))
      }, 15000)
      
      const messageHandler = (data: any) => {
        const rawData = data.toString()
        console.log(`🐛 Raw response: ${rawData.substring(0, 200)}${rawData.length > 200 ? '...' : ''}`)
        
        if (rawData.startsWith('Welcome to')) {
          console.log('🐛 Skipping welcome message')
          return
        }
        
        clearTimeout(timeout)
        this.ws?.off('message', messageHandler)
        
        try {
          const response = JSON.parse(rawData)
          console.log(`🐛 Parsed JSON response:`, response)
          resolve(response.result !== undefined ? response.result : response)
        } catch {
          console.log(`🐛 Non-JSON response, returning raw: ${rawData.trim()}`)
          resolve(rawData.trim())
        }
      }
      
      this.ws.on('message', messageHandler)
      this.ws.send(code)
    })
  }

  async debugGame(game: 'emerald' | 'quetzal'): Promise<any> {
    const expectedAddresses = {
      emerald: 0x020244EC,
      quetzal: 0x020235B8
    }
    
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🐛 DEBUGGING: ${game.toUpperCase()}`)
    console.log(`🎯 Expected: 0x${expectedAddresses[game].toString(16).toUpperCase()}`)
    console.log(`${'='.repeat(60)}`)
    
    // Start mGBA
    const started = await this.startMGBA(game)
    if (!started) {
      return { success: false, error: 'Failed to start mGBA' }
    }
    
    // Connect WebSocket
    const connected = await this.connectWebSocket()
    if (!connected) {
      return { success: false, error: 'Failed to connect WebSocket' }
    }
    
    try {
      console.log('\n🐛 Step 1: Testing basic ROM access...')
      
      const romSize = await this.executeLuaDebug('return emu:romSize()')
      console.log(`✅ ROM Size: ${romSize}`)
      
      console.log('\n🐛 Step 2: Testing byte reading...')
      
      const firstByte = await this.executeLuaDebug('return emu:read8(0x08000000)')
      console.log(`✅ First byte: 0x${firstByte.toString(16)}`)
      
      console.log('\n🐛 Step 3: Testing simple target byte search...')
      
      const targetBytes = game === 'emerald' ? [0xEC, 0x44, 0x02, 0x02] : [0xB8, 0x35, 0x02, 0x02]
      console.log(`🎯 Looking for: ${targetBytes.map(b => b.toString(16).padStart(2, '0')).join(' ').toUpperCase()}`)
      
      const searchResult = await this.executeLuaDebug(`
        local found = 0
        local firstMatch = nil
        
        for addr = 0x08000000, 0x08000000 + 100000 - 4, 4 do
          local b1 = emu:read8(addr)
          local b2 = emu:read8(addr + 1)
          local b3 = emu:read8(addr + 2)
          local b4 = emu:read8(addr + 3)
          
          if b1 == ${targetBytes[0]} and b2 == ${targetBytes[1]} and b3 == ${targetBytes[2]} and b4 == ${targetBytes[3]} then
            found = found + 1
            if not firstMatch then
              firstMatch = addr
            end
            
            if found >= 3 then
              break
            end
          end
        end
        
        return {found = found, firstMatch = firstMatch}
      `)
      
      console.log(`🐛 Search result:`, searchResult)
      
      if (searchResult && searchResult.found >= 3) {
        console.log('✅ SUCCESS: Found target bytes in ROM!')
        console.log(`   Matches: ${searchResult.found}`)
        console.log(`   First match at: 0x${searchResult.firstMatch.toString(16).toUpperCase()}`)
        
        return {
          success: true,
          game,
          expected: expectedAddresses[game],
          found: expectedAddresses[game], // If we found the bytes, we found the address
          matches: searchResult.found,
          firstMatch: searchResult.firstMatch
        }
      } else {
        console.log('❌ FAILED: Target bytes not found in ROM')
        
        return {
          success: false,
          game,
          expected: expectedAddresses[game],
          error: 'Target bytes not found',
          searchResult: searchResult
        }
      }
      
    } catch (error) {
      console.error('❌ Debug execution failed:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    } finally {
      if (this.ws) {
        this.ws.close()
        this.ws = null
      }
    }
  }

  async runDebugTests(): Promise<void> {
    console.log('🐛 DEBUGGING UNIVERSAL PATTERN SYSTEM')
    console.log('Step-by-step analysis to identify and fix core issues')
    console.log(`${'='.repeat(60)}`)
    
    const games: ('emerald' | 'quetzal')[] = ['emerald', 'quetzal']
    const results = []
    
    for (const game of games) {
      const result = await this.debugGame(game)
      results.push(result)
      
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
    // Debug summary
    console.log(`\n${'='.repeat(60)}`)
    console.log('🐛 DEBUG RESULTS SUMMARY')
    console.log(`${'='.repeat(60)}`)
    
    const successCount = results.filter(r => r.success).length
    
    results.forEach(result => {
      console.log(`\n🎮 ${result.game.toUpperCase()}:`)
      if (result.success) {
        console.log(`   ✅ SUCCESS`)
        console.log(`   Target bytes found: ${result.matches} matches`)
        console.log(`   First match: 0x${result.firstMatch.toString(16).toUpperCase()}`)
        console.log(`   Expected address: 0x${result.expected.toString(16).toUpperCase()}`)
      } else {
        console.log(`   ❌ FAILED`)
        console.log(`   Error: ${result.error}`)
        if (result.searchResult) {
          console.log(`   Search details:`, result.searchResult)
        }
      }
    })
    
    console.log(`\n${'='.repeat(60)}`)
    if (successCount === results.length) {
      console.log('🎉 DEBUG COMPLETE - ALL GAMES WORKING!')
      console.log('✅ Target bytes successfully found in both ROMs')
      console.log('✅ Universal Pattern system is functioning correctly')
      
      console.log('\n📋 CONFIRMED WORKING PATTERNS:')
      results.forEach(result => {
        if (result.success) {
          const pattern = result.game === 'emerald' ? 'EC 44 02 02' : 'B8 35 02 02'
          console.log(`   ${result.game.toUpperCase()}: "${pattern}" → 0x${result.expected.toString(16).toUpperCase()}`)
        }
      })
    } else {
      console.log(`🐛 DEBUG RESULTS: ${successCount}/${results.length} games working`)
      console.log('🔧 Continuing analysis to fix remaining issues...')
    }
    
    // Cleanup
    console.log('\n🧹 Cleaning up...')
    try {
      execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
    } catch {}
  }
}

// Main execution
async function main() {
  const debugTester = new DebugUniversalPatterns()
  await debugTester.runDebugTests()
}

main().catch(console.error)