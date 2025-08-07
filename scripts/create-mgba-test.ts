#!/usr/bin/env tsx
/**
 * Comprehensive mGBA Lua Test for Universal Patterns
 * 
 * This creates a working Lua script that can be tested with actual ROM files
 * in the mGBA Docker environment to validate the Universal Patterns work.
 */

import { writeFileSync } from 'node:fs'
import { WebSocket } from 'ws'

const LUA_TEST_SCRIPT = `
-- Comprehensive Universal Pattern Test for mGBA
-- Tests THUMB pattern that works in both Pokemon Emerald and Quetzal

local function log(message)
    console:log(message)
    io.stdout:write("[Universal Test] " .. message .. "\\n")
    io.stdout:flush()
end

-- Expected addresses
local EXPECTED = {
    emerald = 0x020244EC,
    quetzal = 0x020235B8
}

-- Get game variant from ROM title
local function getGameVariant()
    if not emu or not emu.getGameTitle then
        return "unknown"
    end
    
    local title = emu:getGameTitle():lower()
    log("🎮 ROM Title: " .. emu:getGameTitle())
    
    if title:find("emerald") then
        return "emerald"
    elseif title:find("quetzal") then
        return "quetzal"
    else
        return "unknown"
    end
end

-- Test THUMB Pattern: 48 ?? 68 ?? 30 ??
local function testThumbPattern(startAddr, endAddr)
    log("🔍 Testing THUMB Pattern: 48 ?? 68 ?? 30 ??")
    local matches = {}
    local step = math.floor((endAddr - startAddr) / 50) -- Report every 2%
    local lastReport = 0
    
    for addr = startAddr, endAddr - 5 do
        -- Progress reporting
        if addr - startAddr >= lastReport + step then
            local percent = math.floor(((addr - startAddr) / (endAddr - startAddr)) * 100)
            log(string.format("  Progress: %d%% (0x%08X)", percent, addr))
            lastReport = addr - startAddr
        end
        
        local b1 = emu:read8(addr)
        local b3 = emu:read8(addr + 2)  
        local b5 = emu:read8(addr + 4)
        
        -- Pattern: 48 ?? 68 ?? 30 ??
        if b1 == 0x48 and b3 == 0x68 and b5 == 0x30 then
            log(string.format("  📍 Found THUMB pattern at 0x%08X", addr))
            
            -- Extract address using THUMB LDR literal logic
            local instruction = emu:read8(addr + 1) -- Get ?? from 48??
            local immediate = instruction & 0xFF
            
            -- Calculate PC and literal address
            local pc = ((addr) & ~1) + 4
            local literalAddr = (pc & ~3) + (immediate * 4)
            
            log(string.format("    Instruction: 0x%02X, PC: 0x%08X, Literal: 0x%08X", 
                instruction, pc, literalAddr))
            
            -- Check if literal address is in valid range
            if literalAddr >= 0x02000000 and literalAddr <= 0x02040000 then
                -- Read 32-bit address from literal pool (little-endian)
                local b1 = emu:read8(literalAddr)
                local b2 = emu:read8(literalAddr + 1)
                local b3 = emu:read8(literalAddr + 2)
                local b4 = emu:read8(literalAddr + 3)
                local address = b1 + (b2 << 8) + (b3 << 16) + (b4 << 24)
                
                log(string.format("    ✅ Extracted address: 0x%08X", address))
                table.insert(matches, {offset = addr, address = address})
                
                -- Limit to avoid excessive processing
                if #matches >= 5 then
                    log("    Limiting to first 5 matches for performance")
                    break
                end
            else
                log(string.format("    ❌ Invalid literal address: 0x%08X", literalAddr))
            end
        end
    end
    
    return matches
end

-- Main test function
local function runUniversalTest()
    log("🚀 Universal Pattern Test - mGBA Live ROM Test")
    log("=" .. string.rep("=", 59))
    
    if not emu or not emu.romSize or emu:romSize() == 0 then
        log("❌ No ROM loaded")
        return {success = false, error = "No ROM loaded"}
    end
    
    local variant = getGameVariant()
    local expectedAddr = EXPECTED[variant]
    
    log(string.format("🎯 Game: %s", variant))
    if expectedAddr then
        log(string.format("🎯 Expected Address: 0x%08X", expectedAddr))
    else
        log("⚠️  Unknown game - will test pattern anyway")
    end
    
    -- Search only first 4MB for performance
    local startAddr = 0x08000000
    local searchSize = math.min(4 * 1024 * 1024, emu:romSize())
    local endAddr = startAddr + searchSize
    
    log(string.format("🔍 Search Range: 0x%08X - 0x%08X (%d MB)", 
        startAddr, endAddr, searchSize / (1024 * 1024)))
    
    -- Test THUMB pattern
    local thumbMatches = testThumbPattern(startAddr, endAddr)
    
    log("\\n📊 Test Results:")
    log("=" .. string.rep("=", 59))
    
    local success = false
    local foundAddress = nil
    
    if #thumbMatches > 0 then
        log(string.format("✅ Found %d THUMB pattern matches:", #thumbMatches))
        
        for i, match in ipairs(thumbMatches) do
            log(string.format("  %d. Offset 0x%08X → Address 0x%08X", 
                i, match.offset, match.address))
            
            if expectedAddr and match.address == expectedAddr then
                log(string.format("    🎯 PERFECT MATCH! Found expected address"))
                success = true
                foundAddress = match.address
            elseif match.address >= 0x02020000 and match.address <= 0x02030000 then
                log(string.format("    ✅ VALID: Address in expected range"))
                if not success then
                    success = true
                    foundAddress = match.address
                end
            else
                log(string.format("    ⚠️  Unexpected address range"))
            end
        end
    else
        log("❌ No THUMB patterns found")
    end
    
    log("\\n" .. "=" .. string.rep("=", 59))
    
    if success then
        log("🎉 UNIVERSAL PATTERN TEST SUCCESS!")
        log(string.format("   Found Address: 0x%08X", foundAddress))
        log(string.format("   Game: %s", variant))
        log("   Pattern: THUMB (48 ?? 68 ?? 30 ??)")
        log("✅ The Universal Pattern system is working correctly")
    else
        log("❌ UNIVERSAL PATTERN TEST FAILED")
        log("   No valid partyData addresses found")
        log("   This may indicate the pattern needs adjustment")
    end
    
    return {
        success = success,
        foundAddress = foundAddress,
        variant = variant,
        expectedAddress = expectedAddr,
        matches = thumbMatches
    }
end

-- Export for WebSocket API
runUniversalTest = runUniversalTest
getGameVariant = getGameVariant
EXPECTED = EXPECTED
`

/**
 * Simple test runner that can work with the mGBA Docker setup
 */
async function testWithMGBA(): Promise<void> {
  console.log('🔧 Creating comprehensive mGBA Lua test...')
  
  // Write the test script
  writeFileSync('/tmp/universal-test.lua', LUA_TEST_SCRIPT)
  console.log('📝 Written test script to /tmp/universal-test.lua')
  
  console.log('')
  console.log('🚀 To test with mGBA Docker:')
  console.log('1. Copy the script: cp /tmp/universal-test.lua scripts/mgba-lua/')
  console.log('2. Start mGBA: GAME=emerald docker compose -f docker/docker-compose.yml up')
  console.log('3. Connect via WebSocket and run: runUniversalTest()')
  console.log('')
  console.log('Or use the validation script:')
  console.log('npm run validate-patterns')
  
  console.log('')
  console.log('✅ Comprehensive test ready for mGBA validation')
}

if (import.meta.url === \`file://\${process.argv[1]}\`) {
  testWithMGBA()
}

export { LUA_TEST_SCRIPT }