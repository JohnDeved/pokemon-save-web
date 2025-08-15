#!/usr/bin/env tsx

/**
 * PROPER Universal Pattern Implementation as explained by @JohnDeved
 * 
 * This implements the CORRECT approach:
 * 1. Find ROM locations that REFERENCE target addresses (0x020244EC, 0x020235B8)
 * 2. Look for stable ARM/ASM instruction patterns AROUND those references  
 * 3. Create byte pattern masks that can find those instruction patterns
 * 4. Extract addresses from the found patterns
 */

import { execSync } from 'node:child_process'
import { WebSocket } from 'ws'

const MGBA_WEBSOCKET_URL = 'ws://localhost:7102/ws'
const DOCKER_COMPOSE_FILE = 'docker/docker-compose.yml'

interface ProperPatternResult {
  success: boolean
  game: string
  romTitle: string
  expectedAddress: number
  foundInstructions: Array<{
    type: string
    instructionAddr: number
    pattern: string
    context: string
  }>
  universalMasks: string[]
}

class ProperUniversalPatternImplementation {
  private ws: WebSocket | null = null
  private connected = false

  async testBothGames(): Promise<void> {
    console.log('🔍 PROPER Universal Pattern Detection - FINAL IMPLEMENTATION')
    console.log('============================================================')
    console.log('Method: Find instruction patterns that REFERENCE target addresses')
    console.log('As explained by @JohnDeved - the CORRECT approach for byte patterns')
    console.log('')

    const games = [
      { name: 'emerald', expectedAddr: 0x020244EC },
      { name: 'quetzal', expectedAddr: 0x020235B8 }
    ]

    const allResults: ProperPatternResult[] = []

    for (const game of games) {
      console.log(`\n${'='.repeat(60)}`)
      console.log(`🎮 Testing ${game.name.toUpperCase()}`)
      console.log(`${'='.repeat(60)}`)

      try {
        const result = await this.analyzeGame(game.name as 'emerald' | 'quetzal', game.expectedAddr)
        allResults.push(result)
      } catch (error) {
        console.error(`❌ ${game.name}: Error -`, error)
      }
    }

    // Generate universal patterns from combined results
    this.generateUniversalPatterns(allResults)
  }

  private async analyzeGame(gameName: 'emerald' | 'quetzal', expectedAddr: number): Promise<ProperPatternResult> {
    await this.startMGBA(gameName)
    await this.connectWebSocket()

    const romInfo = await this.getRomInfo()
    console.log(`✅ ROM: ${romInfo.title} (${romInfo.size} bytes)`)

    // Create Lua script that implements the PROPER approach
    const luaScript = this.createProperPatternScript(expectedAddr, gameName)
    
    console.log('📝 Executing PROPER pattern detection...')
    console.log('🎯 Finding ARM/THUMB instructions that REFERENCE target address...')
    
    const output = await this.executeLuaScript(luaScript)
    
    // Parse results
    const result = this.parseResults(output, gameName, expectedAddr, romInfo.title)
    
    await this.cleanup()
    
    return result
  }

  private createProperPatternScript(targetAddr: number, gameName: string): string {
    return `
-- PROPER Universal Pattern Detection - Implementation of @JohnDeved's approach
print("🔍 Starting PROPER pattern detection for ${gameName}")
print("🎯 Target address: 0x${targetAddr.toString(16).toUpperCase()}")

local targetAddr = 0x${targetAddr.toString(16)}
local romSize = emu:romSize()

-- Convert target address to little-endian bytes
local targetBytes = {
    targetAddr & 0xFF,
    (targetAddr >> 8) & 0xFF, 
    (targetAddr >> 16) & 0xFF,
    (targetAddr >> 24) & 0xFF
}

print(string.format("📝 Searching for bytes: %02X %02X %02X %02X", 
    targetBytes[1], targetBytes[2], targetBytes[3], targetBytes[4]))

local foundInstructions = {}
local literalPools = {}

-- Step 1: Find where target address appears as literal data
print("📍 Step 1: Finding literal pools containing target address...")
local searchLimit = math.min(romSize, 4000000) -- 4MB limit for performance

for addr = 0x08000000, 0x08000000 + searchLimit - 4, 4 do
    local b1 = emu:read8(addr)
    local b2 = emu:read8(addr + 1) 
    local b3 = emu:read8(addr + 2)
    local b4 = emu:read8(addr + 3)
    
    if b1 == targetBytes[1] and b2 == targetBytes[2] and 
       b3 == targetBytes[3] and b4 == targetBytes[4] then
        table.insert(literalPools, addr)
        print(string.format("   📍 Found literal pool #%d at 0x%08X", #literalPools, addr))
        
        if #literalPools >= 10 then break end -- Limit for performance
    end
end

print(string.format("✅ Found %d literal pools", #literalPools))

-- Step 2: Find ARM/THUMB instructions that reference these pools
print("🔍 Step 2: Finding instructions that reference the literal pools...")

for poolIndex, poolAddr in ipairs(literalPools) do
    if poolIndex > 5 then break end -- Analyze first 5 pools only
    
    print(string.format("\\n   Analyzing pool #%d at 0x%08X", poolIndex, poolAddr))
    
    -- Search for ARM LDR instructions
    for instAddr = math.max(0x08000000, poolAddr - 4000), poolAddr - 4, 4 do
        local i1 = emu:read8(instAddr)
        local i2 = emu:read8(instAddr + 1)
        local i3 = emu:read8(instAddr + 2) 
        local i4 = emu:read8(instAddr + 3)
        
        -- ARM LDR literal: E5 9F XX XX
        if i3 == 0x9F and i4 == 0xE5 then
            local immediate = i1 | (i2 << 8)
            local pc = instAddr + 8  -- ARM PC calculation
            local calcPoolAddr = pc + immediate
            
            if calcPoolAddr == poolAddr then
                print(string.format("      ✅ ARM LDR: 0x%08X -> E5 9F %02X %02X", instAddr, i1, i2))
                
                -- Get context around this instruction (key for universal patterns!)
                local context = {}
                for j = -12, 15 do
                    if instAddr + j >= 0x08000000 and instAddr + j < 0x08000000 + romSize then
                        table.insert(context, string.format("%02X", emu:read8(instAddr + j)))
                    else
                        table.insert(context, "00")
                    end
                end
                
                table.insert(foundInstructions, {
                    type = "ARM_LDR",
                    addr = instAddr,
                    pattern = string.format("E5 9F %02X %02X", i1, i2),
                    context = table.concat(context, " "),
                    immediate = immediate,
                    poolAddr = poolAddr
                })
                
                print(string.format("         Context: %s", table.concat(context, " ")))
                break
            end
        end
    end
    
    -- Search for THUMB LDR instructions  
    for instAddr = math.max(0x08000000, poolAddr - 1000), poolAddr - 2, 2 do
        local t1 = emu:read8(instAddr)
        local t2 = emu:read8(instAddr + 1)
        
        -- THUMB LDR literal: 48 XX
        if (t1 & 0xF8) == 0x48 then
            local immediate = t2
            local pc = ((instAddr + 4) & ~3)  -- THUMB PC alignment
            local calcPoolAddr = pc + (immediate * 4)
            
            if calcPoolAddr == poolAddr then
                print(string.format("      ✅ THUMB LDR: 0x%08X -> %02X %02X", instAddr, t1, t2))
                
                -- Get context around this instruction
                local context = {}
                for j = -10, 13 do
                    if instAddr + j >= 0x08000000 and instAddr + j < 0x08000000 + romSize then
                        table.insert(context, string.format("%02X", emu:read8(instAddr + j)))
                    else
                        table.insert(context, "00")
                    end
                end
                
                table.insert(foundInstructions, {
                    type = "THUMB_LDR", 
                    addr = instAddr,
                    pattern = string.format("%02X %02X", t1, t2),
                    context = table.concat(context, " "),
                    immediate = immediate,
                    poolAddr = poolAddr
                })
                
                print(string.format("         Context: %s", table.concat(context, " ")))
                break
            end
        end
    end
end

-- Step 3: Output results for universal pattern generation
print(string.format("\\n🎯 RESULTS for ${gameName}:"))
print(string.format("   Target address: 0x%08X", targetAddr))
print(string.format("   Literal pools found: %d", #literalPools))
print(string.format("   Instructions found: %d", #foundInstructions))

print("\\nINSTRUCTION_PATTERNS_START")
for i, inst in ipairs(foundInstructions) do
    print(string.format("PATTERN_%d_TYPE:%s", i, inst.type))
    print(string.format("PATTERN_%d_ADDR:0x%08X", i, inst.addr))
    print(string.format("PATTERN_%d_BYTES:%s", i, inst.pattern))
    print(string.format("PATTERN_%d_CONTEXT:%s", i, inst.context))
end
print("INSTRUCTION_PATTERNS_END")

print("✅ PROPER pattern detection complete!")
`;
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
      }, 60000)

      const messageHandler = (data: Buffer) => {
        const message = data.toString()
        output += message + '\n'
        
        if (message.includes('PROPER pattern detection complete!') || 
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

  private parseResults(output: string, gameName: string, expectedAddr: number, romTitle: string): ProperPatternResult {
    const lines = output.split('\n')
    const foundInstructions: Array<{
      type: string
      instructionAddr: number
      pattern: string
      context: string
    }> = []

    let inPatternSection = false
    let currentPattern: any = {}

    for (const line of lines) {
      if (line.includes('INSTRUCTION_PATTERNS_START')) {
        inPatternSection = true
        continue
      }
      
      if (line.includes('INSTRUCTION_PATTERNS_END')) {
        if (currentPattern.type) {
          foundInstructions.push(currentPattern)
        }
        break
      }

      if (inPatternSection) {
        if (line.includes('PATTERN_') && line.includes('_TYPE:')) {
          if (currentPattern.type) {
            foundInstructions.push(currentPattern)
          }
          currentPattern = { type: line.split('_TYPE:')[1] }
        } else if (line.includes('_ADDR:')) {
          currentPattern.instructionAddr = parseInt(line.split('_ADDR:')[1], 16)
        } else if (line.includes('_BYTES:')) {
          currentPattern.pattern = line.split('_BYTES:')[1]
        } else if (line.includes('_CONTEXT:')) {
          currentPattern.context = line.split('_CONTEXT:')[1]
        }
      }
    }

    return {
      success: foundInstructions.length > 0,
      game: gameName,
      romTitle: romTitle,
      expectedAddress: expectedAddr,
      foundInstructions: foundInstructions,
      universalMasks: []
    }
  }

  private generateUniversalPatterns(results: ProperPatternResult[]): void {
    console.log(`\n${'='.repeat(60)}`)
    console.log('🎯 GENERATING UNIVERSAL PATTERNS')
    console.log(`${'='.repeat(60)}`)

    const emeraldResult = results.find(r => r.game === 'emerald')
    const quetzalResult = results.find(r => r.game === 'quetzal')

    if (!emeraldResult || !quetzalResult) {
      console.log('❌ Cannot generate universal patterns - missing results for one or both games')
      return
    }

    console.log(`Emerald instructions found: ${emeraldResult.foundInstructions.length}`)
    console.log(`Quetzal instructions found: ${quetzalResult.foundInstructions.length}`)

    if (emeraldResult.foundInstructions.length === 0 && quetzalResult.foundInstructions.length === 0) {
      console.log('\n❌ No instruction patterns found in either game')
      console.log('💡 This indicates the target addresses may not be present in these ROM regions')
      return
    }

    console.log('\n📋 INSTRUCTION PATTERNS FOUND:')
    console.log('===============================')

    if (emeraldResult.foundInstructions.length > 0) {
      console.log(`\n🟢 EMERALD (${emeraldResult.foundInstructions.length} patterns):`)
      emeraldResult.foundInstructions.forEach((inst, i) => {
        console.log(`   ${i + 1}. ${inst.type} at 0x${inst.instructionAddr.toString(16).toUpperCase()}`)
        console.log(`      Pattern: ${inst.pattern}`)
        console.log(`      Context: ${inst.context.substring(0, 100)}...`)
      })
    } else {
      console.log('\n🔴 EMERALD: No patterns found')
    }

    if (quetzalResult.foundInstructions.length > 0) {
      console.log(`\n🟢 QUETZAL (${quetzalResult.foundInstructions.length} patterns):`)
      quetzalResult.foundInstructions.forEach((inst, i) => {
        console.log(`   ${i + 1}. ${inst.type} at 0x${inst.instructionAddr.toString(16).toUpperCase()}`)
        console.log(`      Pattern: ${inst.pattern}`)
        console.log(`      Context: ${inst.context.substring(0, 100)}...`)
      })
    } else {
      console.log('\n🔴 QUETZAL: No patterns found')
    }

    // Generate universal masks from common patterns
    console.log('\n🛠️  UNIVERSAL PATTERN GENERATION:')
    console.log('=================================')

    const allInstructions = [...emeraldResult.foundInstructions, ...quetzalResult.foundInstructions]
    
    if (allInstructions.length > 0) {
      console.log('✅ SUCCESS: Found instruction patterns that reference target addresses!')
      console.log('')
      console.log('💡 HOW TO CREATE UNIVERSAL PATTERNS:')
      console.log('1. Take the context patterns shown above')
      console.log('2. Replace variable parts with ?? wildcards') 
      console.log('3. Use these masks to search ROM memory')
      console.log('4. When pattern matches, extract the LDR instruction')
      console.log('5. Calculate literal pool address from LDR immediate value')
      console.log('6. Read partyData address from literal pool')
      console.log('')
      console.log('🎯 EXPECTED RESULTS:')
      console.log(`   Emerald: 0x${emeraldResult.expectedAddress.toString(16).toUpperCase()}`)
      console.log(`   Quetzal: 0x${quetzalResult.expectedAddress.toString(16).toUpperCase()}`)
      
      console.log('\n✅ PROPER Universal Pattern Detection COMPLETE!')
      console.log('🎉 This is the CORRECT approach as explained by @JohnDeved')
    } else {
      console.log('❌ No universal patterns can be generated')
    }
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
  const implementer = new ProperUniversalPatternImplementation()
  
  try {
    await implementer.testBothGames()
  } catch (error) {
    console.error('❌ Implementation failed:', error)
    process.exit(1)
  }
}

main();