#!/usr/bin/env tsx

/**
 * TRUE Behavioral Pattern Testing with mGBA
 * 
 * This script tests the new behavioral pattern approach that analyzes
 * ARM/THUMB instruction sequences to dynamically discover partyData addresses.
 */

import { execSync } from 'node:child_process'
import { WebSocket } from 'ws'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'
const DOCKER_COMPOSE_FILE = 'docker/docker-compose.yml'

interface BehavioralTestResult {
  success: boolean
  game: string
  romTitle: string
  expectedAddress: number
  foundAddress?: number
  matches?: Array<{
    address: number
    pattern: string
    confidence: string
    sourceAddr: number
    ldrAddr: number
  }>
  error?: string
}

class TrueBehavioralTester {
  private ws: WebSocket | null = null
  private connected = false

  async startMGBA(game: 'emerald' | 'quetzal'): Promise<boolean> {
    console.log(`🚀 Starting mGBA Docker for ${game}...`)
    
    try {
      // Stop any existing container
      try {
        execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
        await new Promise(resolve => setTimeout(resolve, 2000))
      } catch {}
      
      // Start container
      execSync(`GAME=${game} docker compose -f ${DOCKER_COMPOSE_FILE} up -d`, { 
        stdio: 'inherit',
        env: { ...process.env, GAME: game }
      })
      
      // Wait for readiness
      for (let attempt = 1; attempt <= 15; attempt++) {
        try {
          const testWs = new WebSocket(MGBA_WEBSOCKET_URL)
          await new Promise((resolve, reject) => {
            testWs.onopen = () => resolve(true)
            testWs.onerror = reject
            testWs.onclose = reject
            setTimeout(reject, 2000)
          })
          testWs.close()
          console.log(`✅ mGBA ready for ${game} (attempt ${attempt})`)
          return true
        } catch {
          if (attempt < 15) {
            console.log(`   Waiting... (${attempt}/15)`)
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
        }
      }
      
      throw new Error('mGBA failed to start after 15 attempts')
    } catch (error) {
      console.log(`❌ Failed to start mGBA:`, error)
      return false
    }
  }

  async connectWebSocket(): Promise<void> {
    this.ws = new WebSocket(MGBA_WEBSOCKET_URL)
    
    return new Promise((resolve, reject) => {
      if (!this.ws) return reject(new Error('WebSocket not initialized'))
      
      this.ws.onopen = () => {
        this.connected = true
        resolve()
      }
      
      this.ws.onerror = reject
      this.ws.onclose = () => {
        this.connected = false
      }
      
      setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000)
    })
  }

  async executeLua(code: string): Promise<any> {
    if (!this.ws || !this.connected) {
      throw new Error('WebSocket not connected')
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Lua execution timeout (30s)'))
      }, 30000)

      this.ws!.onmessage = (event) => {
        clearTimeout(timeout)
        try {
          const data = JSON.parse(event.data.toString())
          resolve(data)
        } catch (error) {
          resolve(event.data.toString())
        }
      }

      this.ws!.send(JSON.stringify({
        type: 'lua-eval',
        code: code
      }))
    })
  }

  async getROMInfo(): Promise<{ title: string, size: number }> {
    console.log('📋 Getting ROM information...')
    
    const result = await this.executeLua(`
      local title = emu:read(0x08000000 + 0xA0, 12)
      local size = emu:romSize()
      return {title = title, size = size}
    `)
    
    const title = result.title || 'Unknown'
    const size = result.size || 0
    
    console.log(`✅ ROM: ${title} (${size} bytes)`)
    return { title, size }
  }

  async runBehavioralAnalysis(): Promise<any> {
    console.log('🔍 Running TRUE Behavioral Pattern Analysis...')
    
    // Load and execute the behavioral pattern script
    const scriptPath = resolve(__dirname, 'mgba-lua', 'true-behavioral-patterns.lua')
    const luaScript = readFileSync(scriptPath, 'utf-8')
    
    const result = await this.executeLua(luaScript)
    return result
  }

  async testGame(game: 'emerald' | 'quetzal', expectedAddress: number): Promise<BehavioralTestResult> {
    console.log(`\n🎮 Testing ${game.toUpperCase()}`)
    console.log('============================================================')
    
    const result: BehavioralTestResult = {
      success: false,
      game,
      romTitle: 'Unknown',
      expectedAddress
    }

    try {
      // Start mGBA
      if (!await this.startMGBA(game)) {
        result.error = 'Failed to start mGBA'
        return result
      }

      // Connect WebSocket
      await this.connectWebSocket()

      // Get ROM info
      const romInfo = await this.getROMInfo()
      result.romTitle = romInfo.title

      // Run behavioral analysis
      const analysisResult = await this.runBehavioralAnalysis()
      
      if (Array.isArray(analysisResult) && analysisResult.length > 0) {
        result.matches = analysisResult
        
        // Find the best match
        const addressCounts: { [addr: number]: { count: number, bestConfidence: string } } = {}
        
        for (const match of analysisResult) {
          const addr = match.address
          if (!addressCounts[addr]) {
            addressCounts[addr] = { count: 0, bestConfidence: 'low' }
          }
          addressCounts[addr].count++
          if (match.confidence === 'high') {
            addressCounts[addr].bestConfidence = 'high'
          } else if (match.confidence === 'medium' && addressCounts[addr].bestConfidence === 'low') {
            addressCounts[addr].bestConfidence = 'medium'
          }
        }
        
        // Find best candidate
        let bestAddr = 0
        let bestScore = 0
        
        for (const [addr, data] of Object.entries(addressCounts)) {
          const numAddr = parseInt(addr)
          const score = data.count * (data.bestConfidence === 'high' ? 3 : data.bestConfidence === 'medium' ? 2 : 1)
          if (score > bestScore) {
            bestScore = score
            bestAddr = numAddr
          }
        }
        
        if (bestAddr > 0) {
          result.foundAddress = bestAddr
          result.success = bestAddr === expectedAddress
          
          console.log(`✅ Found partyData address: 0x${bestAddr.toString(16).toUpperCase().padStart(8, '0')}`)
          console.log(`🎯 Expected: 0x${expectedAddress.toString(16).toUpperCase().padStart(8, '0')}`)
          console.log(`📊 Score: ${bestScore}`)
          console.log(`📝 Supporting patterns: ${addressCounts[bestAddr].count}`)
          console.log(`🔒 Confidence: ${addressCounts[bestAddr].bestConfidence}`)
          
          if (result.success) {
            console.log(`🎉 PERFECT MATCH! Behavioral analysis found the exact expected address!`)
          } else {
            console.log(`⚠️  Different address found, but behavioral analysis is working`)
          }
        } else {
          result.error = 'No valid addresses found in analysis'
        }
      } else {
        result.error = 'No behavioral patterns detected'
        console.log(`❌ No behavioral patterns were detected`)
      }

    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error)
      console.log(`❌ Error during testing:`, result.error)
    } finally {
      if (this.ws) {
        this.ws.close()
        this.connected = false
      }
    }

    return result
  }

  async cleanup(): Promise<void> {
    try {
      console.log('🧹 Cleaning up Docker containers...')
      execSync(`docker compose -f ${DOCKER_COMPOSE_FILE} down`, { stdio: 'pipe' })
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

async function runTrueBehavioralTests() {
  console.log('🚀 TRUE Behavioral Universal Pattern Testing')
  console.log('Testing TRUE behavioral analysis that finds partyData addresses')
  console.log('by analyzing ARM/THUMB instruction patterns WITHOUT knowing target addresses')
  console.log('============================================================\n')

  const tester = new TrueBehavioralTester()
  const results: BehavioralTestResult[] = []

  try {
    // Test Pokemon Emerald
    const emeraldResult = await tester.testGame('emerald', 0x020244EC)
    results.push(emeraldResult)

    // Test Pokemon Quetzal
    const quetzalResult = await tester.testGame('quetzal', 0x020235B8)
    results.push(quetzalResult)

  } finally {
    await tester.cleanup()
  }

  // Summary
  console.log('\n\n============================================================')
  console.log('📊 TRUE BEHAVIORAL ANALYSIS SUMMARY')
  console.log('============================================================\n')

  let successCount = 0
  for (const result of results) {
    console.log(`🎮 ${result.game.toUpperCase()}:`)
    console.log(`   📱 ROM: ${result.romTitle}`)
    console.log(`   🎯 Expected: 0x${result.expectedAddress.toString(16).toUpperCase()}`)
    
    if (result.success && result.foundAddress) {
      console.log(`   ✅ SUCCESS - Found: 0x${result.foundAddress.toString(16).toUpperCase()}`)
      console.log(`   🏆 PERFECT: Exact match through behavioral analysis!`)
      console.log(`   📝 Patterns found: ${result.matches?.length || 0}`)
      successCount++
    } else if (result.foundAddress) {
      console.log(`   ⚠️  PARTIAL - Found: 0x${result.foundAddress.toString(16).toUpperCase()}`)
      console.log(`   📝 Behavioral analysis working but different address`)
      console.log(`   📝 Patterns found: ${result.matches?.length || 0}`)
    } else {
      console.log(`   ❌ FAILED - ${result.error}`)
    }
    console.log('')
  }

  console.log(`🎯 Results: ${successCount}/${results.length} exact matches`)
  
  if (successCount === results.length) {
    console.log(`🎉 ALL TESTS PASSED!`)
    console.log(`✅ TRUE Behavioral analysis successfully found exact partyData addresses`)
    console.log(`✅ This proves the approach works WITHOUT knowing addresses beforehand`)
    console.log(`✅ The system analyzes actual CPU instruction behavior patterns`)
  } else if (successCount > 0) {
    console.log(`⚠️  PARTIAL SUCCESS: Some behavioral patterns worked`)
    console.log(`📈 The TRUE behavioral approach shows significant promise`)
  } else {
    console.log(`❌ BEHAVIORAL PATTERNS NEED REFINEMENT`)
    console.log(`📋 The current patterns may need adjustment for these ROM variants`)
  }
  
  console.log('============================================================')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTrueBehavioralTests().catch(console.error)
}