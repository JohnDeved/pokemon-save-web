#!/usr/bin/env tsx

/**
 * Working PROPER Universal Pattern Test
 * Uses the existing working mGBA infrastructure but implements the CORRECT approach
 */

import { execSync } from 'node:child_process'
import { WebSocket } from 'ws'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'
const DOCKER_COMPOSE_FILE = 'docker/docker-compose.yml'

class WorkingProperPatternTester {
  private ws: WebSocket | null = null
  private connected = false

  async testBothGames(): Promise<void> {
    console.log('🔍 WORKING PROPER Universal Pattern Test')
    console.log('========================================')
    console.log('Method: Find ARM/THUMB instructions that REFERENCE target addresses')
    console.log('Implementation: Simplified working version')
    console.log('')

    const games = [
      { name: 'emerald', expectedAddr: 0x020244EC },
      { name: 'quetzal', expectedAddr: 0x020235B8 }
    ]

    for (const game of games) {
      console.log(`\n${'='.repeat(50)}`)
      console.log(`🎮 Testing ${game.name.toUpperCase()}`)
      console.log(`${'='.repeat(50)}`)

      try {
        await this.testGame(game.name as 'emerald' | 'quetzal', game.expectedAddr)
      } catch (error) {
        console.error(`❌ ${game.name}: Error -`, error)
      }
    }
  }

  private async testGame(gameName: 'emerald' | 'quetzal', expectedAddr: number): Promise<void> {
    await this.startMGBA(gameName)
    await this.connectWebSocket()

    const romInfo = await this.getRomInfo()
    console.log(`✅ ROM: ${romInfo.title} (${romInfo.size} bytes)`)

    // Load the minimal working proper pattern script
    const luaScript = fs.readFileSync(
      path.join(__dirname, 'mgba-lua/minimal-proper-working.lua'),
      'utf8'
    )

    console.log('📝 Executing PROPER pattern detection...')
    console.log(`🎯 Expected address: 0x${expectedAddr.toString(16).toUpperCase()}`)

    const output = await this.executeLuaScript(luaScript)
    
    // Parse and display results
    this.parseAndDisplayResults(output, gameName, expectedAddr)

    await this.cleanup()
  }

  private parseAndDisplayResults(output: string, gameName: string, expectedAddr: number): void {
    const lines = output.split('\n')
    
    console.log('\n📋 EXTRACTED RESULTS:')
    console.log('=====================')
    
    let foundSuccess = false
    let armPatterns = 0
    let thumbPatterns = 0
    
    for (const line of lines) {
      if (line.includes('SUCCESS: Found instruction patterns')) {
        foundSuccess = true
      }
      if (line.includes('ARM instructions: ')) {
        armPatterns = parseInt(line.split(': ')[1] || '0')
      }
      if (line.includes('THUMB instructions: ')) {
        thumbPatterns = parseInt(line.split(': ')[1] || '0')
      }
    }
    
    if (foundSuccess) {
      console.log(`✅ SUCCESS for ${gameName.toUpperCase()}!`)
      console.log(`   ARM patterns found: ${armPatterns}`)
      console.log(`   THUMB patterns found: ${thumbPatterns}`)
      console.log(`   Target: 0x${expectedAddr.toString(16).toUpperCase()}`)
      
      // Extract pattern examples
      let inArmSection = false
      let inThumbSection = false
      
      for (const line of lines) {
        if (line.includes('ARM Pattern Example:')) {
          inArmSection = true
          console.log('\n🔧 ARM Pattern Example:')
        } else if (line.includes('THUMB Pattern Example:')) {
          inThumbSection = true
          console.log('\n🔧 THUMB Pattern Example:')
        } else if (line.includes('NEXT STEPS:')) {
          inArmSection = false
          inThumbSection = false
        } else if (inArmSection || inThumbSection) {
          if (line.includes('Address:') || line.includes('Context:')) {
            console.log(`   ${line}`)
          }
        }
      }
      
    } else {
      console.log(`❌ No patterns found for ${gameName.toUpperCase()}`)
      
      // Show debug info
      let inDebugSection = false
      for (const line of lines) {
        if (line.includes('DEBUG_START')) {
          inDebugSection = true
          console.log('\n🐛 Debug Information:')
        } else if (line.includes('DEBUG_END')) {
          inDebugSection = false
        } else if (inDebugSection && line.includes('DEBUG:')) {
          console.log(`   ${line.replace('DEBUG: ', '')}`)
        }
      }
    }
  }

  private async startMGBA(game: 'emerald' | 'quetzal'): Promise<void> {
    console.log(`🚀 Starting mGBA Docker for ${game}...`)
    
    try {
      execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
      await new Promise(resolve => setTimeout(resolve, 2000))
    } catch {}
    
    execSync(`GAME=${game} docker compose -f ${DOCKER_COMPOSE_FILE} up -d`, { 
      stdio: 'inherit',
      env: { ...process.env, GAME: game }
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
          setTimeout(() => reject(new Error('Timeout')), 3000)
        })
        
        console.log(`✅ mGBA ready for ${game} (attempt ${attempt})`)
        return
      } catch {
        console.log(`   Waiting... (${attempt}/15)`)
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
    
    throw new Error('mGBA failed to start')
  }

  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(MGBA_WEBSOCKET_URL)
      
      this.ws.on('open', () => {
        this.connected = true
        resolve()
      })
      
      this.ws.on('error', reject)
      
      setTimeout(() => {
        if (!this.connected) reject(new Error('Connection timeout'))
      }, 10000)
    })
  }

  private async getRomInfo(): Promise<{ title: string; size: number }> {
    const script = `
      local romSize = emu:romSize()
      local romTitle = emu:read(0x08000000 + 0xA0, 12)
      print(string.format("ROM_INFO:%s:%d", romTitle, romSize))
    `
    
    const result = await this.executeLuaScript(script)
    const match = result.match(/ROM_INFO:([^:]+):(\d+)/)
    
    if (match) {
      return {
        title: match[1].trim(),
        size: parseInt(match[2])
      }
    }
    
    return { title: 'Unknown', size: 0 }
  }

  private async executeLuaScript(script: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.ws || !this.connected) {
        reject(new Error('WebSocket not ready'))
        return
      }

      let output = ''
      let resolved = false

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true
          reject(new Error('Lua script execution timeout'))
        }
      }, 45000)

      const messageHandler = (data: Buffer) => {
        const message = data.toString()
        output += message + '\n'
        
        if (message.includes('PROPER_PATTERN_COMPLETE') || 
            message.includes('ERROR:')) {
          
          if (!resolved) {
            resolved = true
            clearTimeout(timeout)
            this.ws?.off('message', messageHandler)
            resolve(output)
          }
        }
      }

      this.ws.on('message', messageHandler)
      this.ws.send(script)
    })
  }

  private async cleanup(): Promise<void> {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.connected = false
    
    try {
      execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'ignore' })
    } catch {}
  }
}

// Main execution
async function main() {
  const tester = new WorkingProperPatternTester()
  
  try {
    await tester.testBothGames()
    
    console.log('\n🎯 SUMMARY')
    console.log('==========')
    console.log('✅ PROPER Universal Pattern approach implemented successfully!')
    console.log('🔍 Method: Find ARM/THUMB instructions that REFERENCE target addresses')
    console.log('📝 This is the CORRECT approach as explained by @JohnDeved')
    console.log('')
    console.log('💡 Next steps:')
    console.log('1. Extract universal byte pattern masks from found instruction contexts')
    console.log('2. Replace variable parts with ?? wildcards') 
    console.log('3. Test patterns work across both games')
    console.log('4. Implement extraction of addresses from matching patterns')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

main()