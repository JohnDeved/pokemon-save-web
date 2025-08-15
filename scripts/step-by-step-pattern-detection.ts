#!/usr/bin/env tsx
/**
 * Step-by-Step Real ROM Universal Pattern Detection
 * 
 * Uses multiple simple WebSocket calls instead of one complex script
 */

import WebSocket from 'ws'
import { execSync } from 'node:child_process'

const TARGET_ADDRESSES = {
  emerald: 0x020244EC,
  quetzal: 0x020235B8
}

class StepByStepPatternDetector {
  private ws: WebSocket | null = null
  
  async ensureContainerRunning(game: 'emerald' | 'quetzal'): Promise<void> {
    console.log(`🚀 Starting mGBA for ${game}...`)
    
    execSync('docker compose -f docker/docker-compose.yml down', { stdio: 'pipe' })
    execSync(`docker compose -f docker/docker-compose.yml up -d`, {
      stdio: 'inherit',
      env: { ...process.env, GAME: game }
    })
    
    // Wait for HTTP server
    for (let i = 0; i < 20; i++) {
      try {
        execSync('curl -sf http://localhost:7102/', { stdio: 'pipe' })
        console.log(`✅ mGBA ready for ${game}`)
        return
      } catch (e) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    throw new Error('HTTP server failed to start')
  }
  
  async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket('ws://localhost:7102/ws')
      
      this.ws.on('open', () => {
        console.log('🔗 WebSocket connected')
        resolve()
      })
      
      this.ws.on('error', reject)
    })
  }
  
  async executeLua(code: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('WebSocket not connected'))
        return
      }
      
      let responseReceived = false
      
      const messageHandler = (data: Buffer) => {
        if (responseReceived) return
        
        try {
          const message = JSON.parse(data.toString())
          
          if (message.error) {
            responseReceived = true
            resolve({ error: message.error })
          } else if (message.result !== undefined) {
            responseReceived = true
            resolve({ result: message.result })
          }
        } catch (e) {
          // Ignore non-JSON messages
        }
      }
      
      this.ws.on('message', messageHandler)
      this.ws.send(code)
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (!responseReceived) {
          this.ws!.off('message', messageHandler)
          responseReceived = true
          reject(new Error('Timeout'))
        }
      }, 10000)
    })
  }
  
  async findLiteralPools(targetAddr: number): Promise<number[]> {
    console.log(`🔍 Searching for literal pools containing 0x${targetAddr.toString(16).toUpperCase()}...`)
    
    // Step 1: Get target bytes
    const targetBytesResult = await this.executeLua(`
      local addr = ${targetAddr}
      return {
        addr & 0xFF,
        (addr >> 8) & 0xFF,
        (addr >> 16) & 0xFF,
        (addr >> 24) & 0xFF
      }
    `)
    
    if (targetBytesResult.error) {
      throw new Error('Failed to get target bytes: ' + targetBytesResult.error)
    }
    
    const targetBytes = targetBytesResult.result
    console.log(`   Target bytes: ${targetBytes.map((b: number) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')}`)
    
    // Step 2: Search for pools in chunks to avoid timeout
    const pools: number[] = []
    const chunkSize = 64 * 1024 // 64KB chunks
    let totalSearched = 0
    
    for (let startAddr = 0x08000000; startAddr < 0x08000000 + 1024 * 1024; startAddr += chunkSize) {
      const endAddr = Math.min(startAddr + chunkSize, 0x08000000 + 1024 * 1024)
      
      const chunkResult = await this.executeLua(`
        local pools = {}
        local startAddr = ${startAddr}
        local endAddr = ${endAddr}
        local targetBytes = {${targetBytes.join(', ')}}
        
        for addr = startAddr, endAddr - 4, 4 do
          local b1, b2, b3, b4 = emu:read8(addr), emu:read8(addr+1), emu:read8(addr+2), emu:read8(addr+3)
          
          if b1 == targetBytes[1] and b2 == targetBytes[2] and 
             b3 == targetBytes[3] and b4 == targetBytes[4] then
            table.insert(pools, addr)
            
            if #pools >= 3 then
              break
            end
          end
        end
        
        return pools
      `)
      
      if (chunkResult.error) {
        console.log(`   ⚠️  Error in chunk 0x${startAddr.toString(16)}: ${chunkResult.error}`)
        continue
      }
      
      if (chunkResult.result && chunkResult.result.length > 0) {
        pools.push(...chunkResult.result)
        console.log(`   📍 Found ${chunkResult.result.length} pools in chunk 0x${startAddr.toString(16)}`)
        
        for (const poolAddr of chunkResult.result) {
          console.log(`      Pool at 0x${poolAddr.toString(16).toUpperCase()}`)
        }
      }
      
      totalSearched += (endAddr - startAddr)
      
      if (pools.length >= 3) {
        console.log(`   ✅ Found enough pools, stopping search`)
        break
      }
    }
    
    console.log(`   📊 Searched ${totalSearched} bytes, found ${pools.length} pools`)
    return pools
  }
  
  async findInstructionReferences(poolAddr: number): Promise<string[]> {
    console.log(`🔍 Finding ARM/THUMB instructions that reference pool 0x${poolAddr.toString(16).toUpperCase()}...`)
    
    const patterns: string[] = []
    
    // Search for ARM LDR instructions
    const armResult = await this.executeLua(`
      local poolAddr = ${poolAddr}
      local patterns = {}
      local romSize = emu:romSize()
      
      -- ARM LDR search (512 bytes back)
      for instAddr = math.max(0x08000000, poolAddr - 512), poolAddr - 4, 4 do
        local i1, i2, i3, i4 = emu:read8(instAddr), emu:read8(instAddr+1), emu:read8(instAddr+2), emu:read8(instAddr+3)
        
        if i3 == 0x9F and i4 == 0xE5 then
          local immediate = i1 | (i2 << 8)
          local pc = instAddr + 8
          if pc + immediate == poolAddr then
            -- Get context (4 bytes before and after)
            local context = {}
            for j = -4, 7 do
              local addr = instAddr + j
              if addr >= 0x08000000 and addr < 0x08000000 + romSize then
                table.insert(context, string.format("%02X", emu:read8(addr)))
              else
                table.insert(context, "00")
              end
            end
            
            -- Pattern: 2 bytes before + E5 9F ?? ?? + 2 bytes after
            local pattern = context[3] .. " " .. context[4] .. " E5 9F ?? ?? " .. context[7] .. " " .. context[8]
            table.insert(patterns, pattern)
            
            if #patterns >= 2 then break end
          end
        end
      end
      
      return patterns
    `)
    
    if (armResult.result && armResult.result.length > 0) {
      patterns.push(...armResult.result)
      console.log(`   ✅ Found ${armResult.result.length} ARM patterns`)
      armResult.result.forEach((pattern: string, i: number) => {
        console.log(`      ARM ${i + 1}: ${pattern}`)
      })
    }
    
    // Search for THUMB LDR instructions
    const thumbResult = await this.executeLua(`
      local poolAddr = ${poolAddr}
      local patterns = {}
      local romSize = emu:romSize()
      
      -- THUMB LDR search (256 bytes back)
      for instAddr = math.max(0x08000000, poolAddr - 256), poolAddr - 2, 2 do
        local t1, t2 = emu:read8(instAddr), emu:read8(instAddr+1)
        
        if (t1 & 0xF8) == 0x48 then
          local immediate = t2
          local pc = ((instAddr + 4) & ~3)
          if pc + (immediate * 4) == poolAddr then
            -- Get context (3 bytes before and after)
            local context = {}
            for j = -3, 5 do
              local addr = instAddr + j
              if addr >= 0x08000000 and addr < 0x08000000 + romSize then
                table.insert(context, string.format("%02X", emu:read8(addr)))
              else
                table.insert(context, "00")
              end
            end
            
            -- Pattern: 1 byte before + 48 ?? + 1 byte after
            local pattern = context[3] .. " 48 ?? " .. context[5]
            table.insert(patterns, pattern)
            
            if #patterns >= 2 then break end
          end
        end
      end
      
      return patterns
    `)
    
    if (thumbResult.result && thumbResult.result.length > 0) {
      patterns.push(...thumbResult.result)
      console.log(`   ✅ Found ${thumbResult.result.length} THUMB patterns`)
      thumbResult.result.forEach((pattern: string, i: number) => {
        console.log(`      THUMB ${i + 1}: ${pattern}`)
      })
    }
    
    return patterns
  }
  
  async detectPatternsForGame(game: 'emerald' | 'quetzal'): Promise<{ game: string, target: number, pools: number, patterns: string[], success: boolean }> {
    const targetAddr = TARGET_ADDRESSES[game]
    
    console.log(`\n${'='.repeat(50)}`)
    console.log(`🎮 STEP-BY-STEP DETECTION: ${game.toUpperCase()}`)
    console.log(`${'='.repeat(50)}`)
    console.log(`Target: 0x${targetAddr.toString(16).toUpperCase()}`)
    
    await this.ensureContainerRunning(game)
    await this.connectWebSocket()
    
    // Get ROM info
    const romInfo = await this.executeLua('return {title = emu:getGameTitle(), size = emu:romSize()}')
    console.log(`📱 ROM: ${romInfo.result.title} (${romInfo.result.size} bytes)`)
    
    // Find literal pools
    const pools = await this.findLiteralPools(targetAddr)
    
    if (pools.length === 0) {
      console.log('❌ No literal pools found')
      return { game, target: targetAddr, pools: 0, patterns: [], success: false }
    }
    
    // Find instruction references for first pool
    const patterns = await this.findInstructionReferences(pools[0])
    
    console.log('\n📊 Final Results:')
    console.log(`   Pools: ${pools.length}`)
    console.log(`   Patterns: ${patterns.length}`)
    console.log(`   Success: ${patterns.length > 0 ? '✅' : '❌'}`)
    
    return {
      game,
      target: targetAddr,
      pools: pools.length,
      patterns,
      success: patterns.length > 0
    }
  }
  
  async testBothGames(): Promise<void> {
    console.log('🚀 Step-by-Step Real ROM Universal Pattern Detection')
    console.log('===================================================')
    
    const results = []
    
    try {
      // Test Emerald
      const emeraldResult = await this.detectPatternsForGame('emerald')
      results.push(emeraldResult)
      
      if (this.ws) {
        this.ws.close()
        this.ws = null
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Test Quetzal
      const quetzalResult = await this.detectPatternsForGame('quetzal')
      results.push(quetzalResult)
      
    } catch (error) {
      console.error('❌ Error:', error)
    } finally {
      if (this.ws) {
        this.ws.close()
      }
      
      try {
        execSync('docker compose -f docker/docker-compose.yml down', { stdio: 'pipe' })
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    // Final summary
    console.log(`\n${'='.repeat(70)}`)
    console.log('🎯 STEP-BY-STEP UNIVERSAL PATTERN RESULTS')
    console.log(`${'='.repeat(70)}`)
    
    let totalPatterns = 0
    let successfulGames = 0
    
    for (const result of results) {
      console.log(`\n📊 ${result.game.toUpperCase()} Summary:`)
      console.log(`   Target: 0x${result.target.toString(16).toUpperCase()}`)
      console.log(`   Pools: ${result.pools}`)
      console.log(`   Patterns: ${result.patterns.length}`)
      console.log(`   Success: ${result.success ? '✅' : '❌'}`)
      
      if (result.success) {
        successfulGames++
        totalPatterns += result.patterns.length
        
        console.log('   Generated patterns:')
        result.patterns.forEach((pattern, i) => {
          console.log(`     ${i + 1}. ${pattern}`)
        })
      }
    }
    
    console.log(`\n${'='.repeat(70)}`)
    if (successfulGames === 2) {
      console.log('🎉 SUCCESS: Universal patterns found for both games!')
      console.log(`Total patterns discovered: ${totalPatterns}`)
      console.log('')
      console.log('✅ These patterns can find partyData addresses dynamically:')
      console.log('   • Search ROM for the pattern bytes')
      console.log('   • Extract LDR immediate from ?? ?? positions')
      console.log('   • Calculate literal pool: PC + immediate')
      console.log('   • Read target address from literal pool')
      console.log('')
      console.log('🔧 This follows proper RAM hacker methodology!')
      
    } else {
      console.log(`⚠️  Partial success: ${successfulGames}/2 games completed`)
    }
    
    console.log(`\n✅ Step-by-Step Pattern Detection Complete!`)
  }
}

async function main() {
  const detector = new StepByStepPatternDetector()
  await detector.testBothGames()
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}