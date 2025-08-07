#!/usr/bin/env tsx
/**
 * Clean Universal Pattern Implementation using external Lua files
 */

import { execSync } from 'node:child_process'
import { WebSocket } from 'ws'
import { readFileSync } from 'node:fs'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'
const DOCKER_COMPOSE_FILE = 'docker/docker-compose.yml'

interface UniversalPatternResult {
  success: boolean
  game: string
  romTitle: string
  expectedAddress: number
  foundAddress?: number
  method?: string
  error?: string
  matches?: Array<{pattern: string, address: string, isTarget: boolean}>
}

class CleanUniversalValidator {
  private ws: WebSocket | null = null
  private connected = false

  async startMGBA(game: 'emerald' | 'quetzal'): Promise<boolean> {
    console.log(`🚀 Starting mGBA Docker for ${game}...`)
    
    try {
      try {
        execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
        await new Promise(resolve => setTimeout(resolve, 2000))
      } catch {}
      
      execSync(`GAME=${game} docker compose -f ${DOCKER_COMPOSE_FILE} up -d`, { 
        stdio: 'inherit',
        env: { ...process.env, GAME: game }
      })
      
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
          
          console.log(`✅ mGBA ready for ${game} (attempt ${attempt})`)
          return true
        } catch {
          console.log(`   Waiting... (${attempt}/15)`)
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }
      
      return false
    } catch (error) {
      console.error(`❌ Failed to start mGBA for ${game}:`, error)
      return false
    }
  }

  async connectWebSocket(): Promise<boolean> {
    return new Promise((resolve) => {
      this.ws = new WebSocket(MGBA_WEBSOCKET_URL)
      
      this.ws.on('open', () => {
        this.connected = true
        resolve(true)
      })
      
      this.ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error)
        this.connected = false
        resolve(false)
      })
      
      this.ws.on('close', () => {
        this.connected = false
      })
      
      setTimeout(() => {
        if (!this.connected) {
          resolve(false)
        }
      }, 10000)
    })
  }

  async executeLua(code: string, timeout = 45000): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || !this.connected) {
        reject(new Error('WebSocket not connected'))
        return
      }
      
      const timeoutId = setTimeout(() => {
        reject(new Error(`Execution timeout (${timeout}ms)`))
      }, timeout)
      
      const messageHandler = (data: any) => {
        const rawData = data.toString()
        
        if (rawData.startsWith('Welcome to')) {
          return
        }
        
        clearTimeout(timeoutId)
        this.ws?.off('message', messageHandler)
        
        try {
          const response = JSON.parse(rawData)
          if (response.error) {
            reject(new Error(response.error))
          } else {
            resolve(response.result || response)
          }
        } catch {
          resolve(rawData.trim())
        }
      }
      
      this.ws.on('message', messageHandler)
      this.ws.send(code)
    })
  }

  async testGame(game: 'emerald' | 'quetzal'): Promise<UniversalPatternResult> {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🎮 Testing Universal Patterns for Pokemon ${game.toUpperCase()}`)
    console.log(`${'='.repeat(60)}`)
    
    const expectedAddresses = {
      emerald: 0x020244EC,
      quetzal: 0x020235B8
    }
    
    const expectedAddress = expectedAddresses[game]
    
    const started = await this.startMGBA(game)
    if (!started) {
      return {
        success: false,
        game,
        romTitle: 'Unknown',
        expectedAddress,
        error: 'Failed to start mGBA container'
      }
    }
    
    const connected = await this.connectWebSocket()
    if (!connected) {
      return {
        success: false,
        game,
        romTitle: 'Unknown',
        expectedAddress,
        error: 'Failed to connect to WebSocket'
      }
    }
    
    try {
      // Step 1: Get ROM info
      console.log('📋 Getting ROM information...')
      const romInfo = await this.executeLua(`
        return {
          title = emu:getGameTitle(),
          size = emu:romSize(),
          firstByte = emu:read8(0x08000000)
        }
      `)
      
      console.log(`✅ ROM: ${romInfo.title} (${romInfo.size} bytes)`)
      console.log(`   First byte: 0x${romInfo.firstByte.toString(16).toUpperCase().padStart(2, '0')}`)
      
      // Step 2: Load Universal Pattern search script
      console.log('📝 Loading Universal Pattern search script...')
      const luaScript = readFileSync('./scripts/mgba-lua/universal-search.lua', 'utf-8')
      
      await this.executeLua(luaScript)
      console.log('✅ Universal Pattern script loaded')
      
      // Step 3: Execute pattern search
      console.log('🔍 Executing Universal Pattern search...')
      const result = await this.executeLua(`
        return universalPatternSearch(${expectedAddress})
      `, 120000) // 2 minute timeout for search
      
      console.log(`📊 Search result: Found ${result.matches?.length || 0} patterns`)
      console.log(`   Total searched: ${result.totalSearched || 0}`)
      
      if (result.success) {
        console.log(`🎉 SUCCESS: Universal Pattern found target address!`)
        console.log(`   Address: 0x${result.foundAddress.toString(16).toUpperCase()}`)
        console.log(`   Method: ${result.method}`)
        
        return {
          success: true,
          game,
          romTitle: romInfo.title,
          expectedAddress,
          foundAddress: result.foundAddress,
          method: result.method,
          matches: result.matches
        }
      } else {
        console.log(`❌ Universal Pattern did not find target address`)
        
        if (result.matches && result.matches.length > 0) {
          console.log(`📝 Found ${result.matches.length} candidate matches:`)
          result.matches.slice(0, 5).forEach((match: any, i: number) => {
            console.log(`   ${i + 1}. ${match.type?.toUpperCase()} ${match.pattern} → ${match.address} ${match.isTarget ? '✅ TARGET!' : ''}`)
          })
        }
        
        return {
          success: false,
          game,
          romTitle: romInfo.title,
          expectedAddress,
          error: 'Universal Pattern did not find expected address',
          matches: result.matches
        }
      }
      
    } catch (error) {
      console.error('❌ Test execution failed:', error)
      return {
        success: false,
        game,
        romTitle: 'Unknown',
        expectedAddress,
        error: error instanceof Error ? error.message : String(error)
      }
    } finally {
      if (this.ws) {
        this.ws.close()
        this.ws = null
        this.connected = false
      }
    }
  }

  async validateBothGames(): Promise<void> {
    console.log('🚀 Clean Universal Pattern System Validation')
    console.log('Using optimal mGBA Lua API with external script loading')
    console.log(`${'='.repeat(60)}`)
    
    const games: ('emerald' | 'quetzal')[] = ['emerald', 'quetzal']
    const results: UniversalPatternResult[] = []
    
    for (const game of games) {
      const result = await this.testGame(game)
      results.push(result)
      
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
    
    this.printFinalSummary(results)
  }

  private printFinalSummary(results: UniversalPatternResult[]): void {
    console.log(`\n${'='.repeat(60)}`)
    console.log('📊 FINAL UNIVERSAL PATTERN VALIDATION RESULTS')
    console.log(`${'='.repeat(60)}`)
    
    let overallSuccess = true
    
    for (const result of results) {
      console.log(`\n🎮 ${result.game.toUpperCase()}:`)
      console.log(`   📱 ROM: ${result.romTitle}`)
      console.log(`   🎯 Expected: 0x${result.expectedAddress.toString(16).toUpperCase()}`)
      
      if (result.success) {
        console.log(`   ✅ SUCCESS`)
        console.log(`   📍 Found: 0x${result.foundAddress?.toString(16).toUpperCase()}`)
        console.log(`   🔧 Method: ${result.method}`)
        console.log(`   📝 Total matches: ${result.matches?.length || 0}`)
      } else {
        console.log(`   ❌ FAILED`)
        if (result.error) {
          console.log(`   💥 Error: ${result.error}`)
        }
        console.log(`   📝 Found ${result.matches?.length || 0} addresses (but not target)`)
        overallSuccess = false
      }
    }
    
    console.log(`\n${'='.repeat(60)}`)
    if (overallSuccess) {
      console.log('🎉 UNIVERSAL PATTERN SYSTEM FULLY WORKING!')
      console.log('✅ Successfully detected partyData addresses in both games using optimal mGBA Lua API.')
      console.log('✅ THUMB and ARM patterns correctly extract addresses from literal pools.')
      console.log('✅ Universal Pattern approach confirmed working across Pokemon Emerald and Quetzal.')
    } else {
      console.log('🔧 UNIVERSAL PATTERN SYSTEM NEEDS FURTHER REFINEMENT')
      console.log('⚠️  Pattern detection finds instruction sequences but address extraction needs optimization.')
      console.log('⚠️  The literal pool resolution or instruction decoding may need adjustment.')
    }
    console.log(`${'='.repeat(60)}`)
  }

  async cleanup(): Promise<void> {
    try {
      console.log('🧹 Cleaning up Docker containers...')
      execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
    } catch {}
  }
}

async function main() {
  const validator = new CleanUniversalValidator()
  
  try {
    await validator.validateBothGames()
  } catch (error) {
    console.error('💥 Validation failed:', error)
    process.exit(1)
  } finally {
    await validator.cleanup()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { CleanUniversalValidator }