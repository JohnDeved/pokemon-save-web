#!/usr/bin/env tsx
/**
 * Simple Real ROM Universal Pattern Test
 * 
 * Tests the mGBA Docker environment and searches for literal pools in real ROMs
 * that contain the target partyData addresses.
 */

import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const TARGET_ADDRESSES = {
  emerald: 0x020244EC,
  quetzal: 0x020235B8
}

async function testROMAccess(game: 'emerald' | 'quetzal'): Promise<void> {
  const targetAddr = TARGET_ADDRESSES[game]
  
  console.log(`\n${'='.repeat(60)}`)
  console.log(`🎮 TESTING REAL ROM ACCESS FOR ${game.toUpperCase()}`)
  console.log(`${'='.repeat(60)}`)
  console.log(`Target address: 0x${targetAddr.toString(16).toUpperCase()}`)
  
  try {
    // Start mGBA
    console.log('🚀 Starting mGBA Docker...')
    execSync('docker compose -f docker/docker-compose.yml down', { stdio: 'pipe' })
    execSync(`docker compose -f docker/docker-compose.yml up -d`, {
      stdio: 'inherit',
      env: { ...process.env, GAME: game }
    })
    
    // Wait for startup
    console.log('   Waiting for mGBA...')
    let ready = false
    for (let i = 0; i < 15; i++) {
      try {
        execSync('docker exec mgba-test-environment echo "ready"', { stdio: 'pipe' })
        ready = true
        break
      } catch (e) {
        console.log(`   Waiting... (${i + 1}/15)`)
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    if (!ready) {
      throw new Error('mGBA failed to start')
    }
    
    console.log(`✅ mGBA ready for ${game} (attempt ${ready ? 'successful' : 'failed'})`)
    
    // Test ROM access with a simple Lua script
    console.log('📋 Getting ROM information...')
    
    const simpleTestScript = `
print("🔍 Simple ROM Access Test")
print("========================")

-- Get ROM info
local romSize = emu:romSize()
local romTitle = emu:getGameTitle()

print(string.format("📱 ROM: %s (%d bytes)", romTitle, romSize))

-- Test reading first few bytes
print("📊 First 16 bytes of ROM:")
local firstBytes = {}
for i = 0, 15 do
    table.insert(firstBytes, string.format("%02X", emu:read8(0x08000000 + i)))
end
print("   " .. table.concat(firstBytes, " "))

-- Search for target address in ROM
local targetAddr = ${targetAddr}
local targetBytes = {
    targetAddr & 0xFF,
    (targetAddr >> 8) & 0xFF,
    (targetAddr >> 16) & 0xFF,
    (targetAddr >> 24) & 0xFF
}

print(string.format("\\n🎯 Searching for target: 0x%08X", targetAddr))
print(string.format("   Target bytes: %02X %02X %02X %02X", targetBytes[1], targetBytes[2], targetBytes[3], targetBytes[4]))

local foundCount = 0
local searchEnd = math.min(romSize, 2000000) -- Search first 2MB for speed

for addr = 0x08000000, 0x08000000 + searchEnd - 4, 4 do
    local b1 = emu:read8(addr)
    local b2 = emu:read8(addr + 1)
    local b3 = emu:read8(addr + 2)
    local b4 = emu:read8(addr + 3)
    
    if b1 == targetBytes[1] and b2 == targetBytes[2] and 
       b3 == targetBytes[3] and b4 == targetBytes[4] then
        foundCount = foundCount + 1
        print(string.format("   📍 Found at 0x%08X (match %d)", addr, foundCount))
        
        if foundCount >= 5 then
            print("   ... (limiting output to first 5 matches)")
            break
        end
    end
end

print(string.format("\\n📊 Total literal pools found: %d", foundCount))

if foundCount > 0 then
    print("✅ SUCCESS: Target address found in ROM literal pools!")
    print("💡 Ready for ARM/THUMB instruction pattern analysis")
else
    print("❌ Target address not found in ROM")
    print("💡 Check if correct ROM is loaded")
end

print("\\n✅ Simple ROM test complete")
`
    
    // Write the test script to a temp file and execute it
    const scriptPath = '/tmp/simple-test.lua'
    writeFileSync(scriptPath, simpleTestScript)
    
    try {
      const luaOutput = execSync(
        `docker exec mgba-test-environment mgba --script ${scriptPath} /app/data/roms/${game}.gba`,
        { encoding: 'utf-8', stdio: 'pipe', timeout: 20000 }
      )
      
      console.log('📊 mGBA Lua output:')
      console.log(luaOutput)
      
    } catch (error: any) {
      if (error.stdout) {
        console.log('📊 mGBA output (with errors):')
        console.log(error.stdout)
      }
      console.error('⚠️ mGBA error:', error.message)
    }
    
  } catch (error) {
    console.error(`❌ Error testing ${game}:`, error)
  } finally {
    try {
      execSync('docker compose -f docker/docker-compose.yml down', { stdio: 'pipe' })
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

async function main() {
  console.log('🚀 Simple Real ROM Universal Pattern Test')
  console.log('==========================================')
  console.log('Testing mGBA Docker access to real ROMs and searching for literal pools')
  
  await testROMAccess('emerald')
  await testROMAccess('quetzal')
  
  console.log('\n🎯 Test Complete!')
  console.log('If literal pools were found, we can proceed with ARM/THUMB instruction analysis')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}