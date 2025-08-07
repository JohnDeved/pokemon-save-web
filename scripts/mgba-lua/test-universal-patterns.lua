-- Universal Pattern Testing Script for mGBA
-- Tests the Universal Patterns from UNIVERSAL_PATTERNS.md in both Pokemon Emerald and Quetzal
-- Run this script via WebSocket API to validate pattern detection

local function log(message)
    console:log(message)
    io.stdout:write("[Pattern Test] " .. message .. "\n")
    io.stdout:flush()
end

local function error_log(message)
    console:error(message)
    io.stderr:write("[Pattern Test ERROR] " .. message .. "\n")
    io.stderr:flush()
end

-- Expected addresses for validation
local EXPECTED_ADDRESSES = {
    emerald = 0x020244EC,
    quetzal = 0x020235B8
}

-- Direct address search patterns (little-endian)
local DIRECT_PATTERNS = {
    emerald = {0xEC, 0x44, 0x02, 0x02}, -- 0x020244EC
    quetzal = {0xB8, 0x35, 0x02, 0x02}  -- 0x020235B8
}

-- Universal Pattern 1: THUMB Party Load
-- Pattern: 48 ?? 68 ?? 30 ??
local function findThumbPattern(startAddr, endAddr)
    log("🔍 Searching for THUMB pattern: 48 ?? 68 ?? 30 ??")
    local matches = {}
    local progressStep = math.floor((endAddr - startAddr) / 100) -- Report every 1%
    local lastProgress = 0
    
    for addr = startAddr, endAddr - 5 do
        -- Progress reporting
        if addr - startAddr >= lastProgress + progressStep then
            local percent = math.floor(((addr - startAddr) / (endAddr - startAddr)) * 100)
            log(string.format("  Progress: %d%% (0x%08X)", percent, addr))
            lastProgress = addr - startAddr
        end
        
        local b1 = emu:read8(addr)
        local b3 = emu:read8(addr + 2)
        local b5 = emu:read8(addr + 4)
        
        -- Check pattern: 48 ?? 68 ?? 30 ??
        if b1 == 0x48 and b3 == 0x68 and b5 == 0x30 then
            log(string.format("  Found THUMB pattern at 0x%08X", addr))
            table.insert(matches, addr)
            
            -- Limit matches to avoid excessive processing
            if #matches >= 10 then
                log("  Limiting THUMB matches to first 10 found")
                break
            end
        end
    end
    
    return matches
end

-- Extract address from THUMB LDR literal instruction
local function extractThumbAddress(matchAddr)
    local instruction = emu:read8(matchAddr + 1) -- Get the ?? from 48??
    local immediate = instruction -- For THUMB LDR, the immediate is the full byte
    
    -- Calculate PC (THUMB PC = current instruction + 4, word-aligned)
    local pc = ((matchAddr) & ~1) + 4
    local literalAddr = (pc & ~3) + (immediate * 4)
    
    log(string.format("  THUMB extraction: instruction=0x%02X, PC=0x%08X, literalAddr=0x%08X", instruction, pc, literalAddr))
    
    -- Read the 32-bit address from the literal pool (little-endian)
    if literalAddr >= 0x02000000 and literalAddr <= 0x02040000 then
        local b1 = emu:read8(literalAddr)
        local b2 = emu:read8(literalAddr + 1)
        local b3 = emu:read8(literalAddr + 2)
        local b4 = emu:read8(literalAddr + 3)
        local address = b1 + (b2 << 8) + (b3 << 16) + (b4 << 24)
        log(string.format("  THUMB result: 0x%08X", address))
        return address
    end
    
    return nil
end

-- Universal Pattern 2: ARM Pokemon Size Calculation
-- Emerald: E0 ?? ?? 64 E5 9F ?? ?? E0 8? ?? ??
-- Quetzal: E0 ?? ?? 68 E5 9F ?? ?? E0 8? ?? ??
local function findARMSizePattern(startAddr, endAddr, pokemonSize)
    local sizeStr = pokemonSize == 0x64 and "Emerald (100 bytes)" or "Quetzal (104 bytes)"
    log(string.format("🔍 Searching for ARM size pattern: %s", sizeStr))
    local matches = {}
    local progressStep = math.floor((endAddr - startAddr) / 100) -- Report every 1%
    local lastProgress = 0
    
    for addr = startAddr, endAddr - 11 do
        -- Progress reporting
        if addr - startAddr >= lastProgress + progressStep then
            local percent = math.floor(((addr - startAddr) / (endAddr - startAddr)) * 100)
            log(string.format("  Progress: %d%% (0x%08X)", percent, addr))
            lastProgress = addr - startAddr
        end
        
        local b1 = emu:read8(addr)
        local b4 = emu:read8(addr + 3)
        local b5 = emu:read8(addr + 4)
        local b6 = emu:read8(addr + 5)
        local b9 = emu:read8(addr + 8)
        local b10 = emu:read8(addr + 9)
        
        -- Check pattern: E0 ?? ?? 64/68 E5 9F ?? ?? E0 8? ?? ??
        if b1 == 0xE0 and b4 == pokemonSize and b5 == 0xE5 and b6 == 0x9F and b9 == 0xE0 and (b10 & 0xF0) == 0x80 then
            log(string.format("  Found ARM size pattern at 0x%08X", addr))
            table.insert(matches, addr)
            
            -- Limit matches to avoid excessive processing
            if #matches >= 10 then
                log("  Limiting ARM matches to first 10 found")
                break
            end
        end
    end
    
    return matches
end

-- Extract address from ARM LDR literal instruction
local function extractARMAddress(matchAddr)
    -- Look for the LDR instruction: E5 9F = LDR Rt, [PC, #imm12]
    for i = 0, 8, 4 do -- Check next few instructions (word-aligned)
        local offset = matchAddr + i
        local b1 = emu:read8(offset)
        local b2 = emu:read8(offset + 1)
        local b3 = emu:read8(offset + 2)
        local b4 = emu:read8(offset + 3)
        
        -- Check if this is LDR Rt, [PC, #imm12] (E5 9F pattern)
        if b3 == 0x9F and b4 == 0xE5 then
            local immediate = b1 + (b2 << 8) -- 12-bit immediate (little-endian)
            local pc = offset + 8 -- ARM PC = current instruction + 8
            local literalAddr = pc + immediate
            
            log(string.format("  ARM extraction: offset=0x%08X, immediate=0x%03X, PC=0x%08X, literalAddr=0x%08X", offset, immediate, pc, literalAddr))
            
            if literalAddr >= 0x02000000 and literalAddr <= 0x02040000 then
                local b1 = emu:read8(literalAddr)
                local b2 = emu:read8(literalAddr + 1)
                local b3 = emu:read8(literalAddr + 2)
                local b4 = emu:read8(literalAddr + 3)
                local address = b1 + (b2 << 8) + (b3 << 16) + (b4 << 24)
                log(string.format("  ARM result: 0x%08X", address))
                return address
            end
        end
    end
    
    return nil
end

-- Universal Pattern 3: Direct Address Search
local function findDirectReferences(startAddr, endAddr)
    log("🔍 Searching for direct address references")
    local results = {}
    local progressStep = math.floor((endAddr - startAddr) / 100) -- Report every 1%
    local lastProgress = 0
    
    for variant, pattern in pairs(DIRECT_PATTERNS) do
        log(string.format("  Searching for %s pattern: %02X %02X %02X %02X", variant, pattern[1], pattern[2], pattern[3], pattern[4]))
        local matches = {}
        
        for addr = startAddr, endAddr - 3 do
            -- Progress reporting
            if addr - startAddr >= lastProgress + progressStep then
                local percent = math.floor(((addr - startAddr) / (endAddr - startAddr)) * 100)
                log(string.format("  Progress: %d%% (0x%08X)", percent, addr))
                lastProgress = addr - startAddr
            end
            
            local b1 = emu:read8(addr)
            local b2 = emu:read8(addr + 1)
            local b3 = emu:read8(addr + 2)
            local b4 = emu:read8(addr + 3)
            
            if b1 == pattern[1] and b2 == pattern[2] and b3 == pattern[3] and b4 == pattern[4] then
                local address = EXPECTED_ADDRESSES[variant]
                log(string.format("  Found %s direct reference at 0x%08X -> 0x%08X", variant, addr, address))
                table.insert(matches, {addr = addr, target = address})
                
                -- Limit matches to avoid excessive processing
                if #matches >= 10 then
                    log("  Limiting direct matches to first 10 found")
                    break
                end
            end
        end
        
        results[variant] = matches
    end
    
    return results
end

-- Determine game variant based on ROM title
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

-- Main testing function
local function runUniversalPatternTest()
    log("🚀 Starting Universal Pattern Test")
    log("=" .. string.rep("=", 59))
    
    if not emu or not emu.romSize or emu:romSize() == 0 then
        error_log("❌ No ROM loaded in emulator")
        return {success = false, error = "No ROM loaded"}
    end
    
    local variant = getGameVariant()
    local expectedAddr = EXPECTED_ADDRESSES[variant]
    
    log(string.format("🎯 Game Variant: %s", variant))
    if expectedAddr then
        log(string.format("🎯 Expected Address: 0x%08X", expectedAddr))
    else
        log("⚠️  Unknown game variant - will test all patterns")
    end
    
    -- Define search range (optimize for faster execution)
    -- Search only first 8MB of ROM where code is most likely to be
    local startAddr = 0x08000000
    local maxSearchSize = math.min(8 * 1024 * 1024, emu:romSize()) -- Limit to 8MB or ROM size
    local endAddr = startAddr + maxSearchSize
    log(string.format("🔍 Search Range: 0x%08X - 0x%08X (%d bytes)", startAddr, endAddr, maxSearchSize))
    
    local results = {
        variant = variant,
        expectedAddress = expectedAddr,
        methods = {}
    }
    
    -- Test Method 1: Direct References (highest confidence)
    log("\n📍 Method 1: Direct Address References")
    local directResults = findDirectReferences(startAddr, endAddr)
    results.methods.direct = directResults
    
    local foundDirect = false
    for v, matches in pairs(directResults) do
        if #matches > 0 then
            foundDirect = true
            log(string.format("✅ Direct reference success for %s: %d matches", v, #matches))
        end
    end
    
    if not foundDirect then
        log("❌ No direct references found")
    end
    
    -- Test Method 2: THUMB Pattern (medium confidence)  
    log("\n👍 Method 2: THUMB Pattern")
    local thumbMatches = findThumbPattern(startAddr, endAddr)
    results.methods.thumb = {matches = thumbMatches, addresses = {}}
    
    if #thumbMatches > 0 then
        log(string.format("Found %d THUMB pattern matches", #thumbMatches))
        for _, matchAddr in ipairs(thumbMatches) do
            local address = extractThumbAddress(matchAddr)
            if address then
                table.insert(results.methods.thumb.addresses, address)
                if address == expectedAddr then
                    log(string.format("✅ THUMB pattern success: 0x%08X (match!)", address))
                else
                    log(string.format("⚠️  THUMB pattern result: 0x%08X (unexpected)", address))
                end
            end
        end
    else
        log("❌ No THUMB patterns found")
    end
    
    -- Test Method 3: ARM Size Patterns (medium confidence)
    log("\n💪 Method 3: ARM Size Patterns")
    results.methods.arm = {}
    
    -- Test Emerald pattern (100-byte Pokemon)
    local emeraldMatches = findARMSizePattern(startAddr, endAddr, 0x64)
    results.methods.arm.emerald = {matches = emeraldMatches, addresses = {}}
    
    if #emeraldMatches > 0 then
        log(string.format("Found %d Emerald ARM pattern matches", #emeraldMatches))
        for _, matchAddr in ipairs(emeraldMatches) do
            local address = extractARMAddress(matchAddr)
            if address then
                table.insert(results.methods.arm.emerald.addresses, address)
                if address == EXPECTED_ADDRESSES.emerald then
                    log(string.format("✅ ARM Emerald pattern success: 0x%08X (match!)", address))
                else
                    log(string.format("⚠️  ARM Emerald pattern result: 0x%08X (unexpected)", address))
                end
            end
        end
    else
        log("❌ No Emerald ARM patterns found")
    end
    
    -- Test Quetzal pattern (104-byte Pokemon)
    local quetzalMatches = findARMSizePattern(startAddr, endAddr, 0x68)
    results.methods.arm.quetzal = {matches = quetzalMatches, addresses = {}}
    
    if #quetzalMatches > 0 then
        log(string.format("Found %d Quetzal ARM pattern matches", #quetzalMatches))
        for _, matchAddr in ipairs(quetzalMatches) do
            local address = extractARMAddress(matchAddr)
            if address then
                table.insert(results.methods.arm.quetzal.addresses, address)
                if address == EXPECTED_ADDRESSES.quetzal then
                    log(string.format("✅ ARM Quetzal pattern success: 0x%08X (match!)", address))
                else
                    log(string.format("⚠️  ARM Quetzal pattern result: 0x%08X (unexpected)", address))
                end
            end
        end
    else
        log("❌ No Quetzal ARM patterns found")
    end
    
    -- Summary
    log("\n📊 Test Summary")
    log("=" .. string.rep("=", 59))
    
    local success = false
    local confidence = "low"
    local method = "none"
    local foundAddress = nil
    
    -- Check direct references first (highest confidence)
    if variant ~= "unknown" and directResults[variant] and #directResults[variant] > 0 then
        success = true
        confidence = "high"
        method = "direct_reference"
        foundAddress = expectedAddr
        log("✅ SUCCESS: Direct reference found (highest confidence)")
    else
        -- Check THUMB pattern
        for _, addr in ipairs(results.methods.thumb.addresses) do
            if addr == expectedAddr then
                success = true
                confidence = "medium"
                method = "thumb_pattern"
                foundAddress = addr
                log("✅ SUCCESS: THUMB pattern found correct address (medium confidence)")
                break
            end
        end
        
        -- Check ARM patterns if not found yet
        if not success then
            if variant == "emerald" then
                for _, addr in ipairs(results.methods.arm.emerald.addresses) do
                    if addr == EXPECTED_ADDRESSES.emerald then
                        success = true
                        confidence = "medium"
                        method = "arm_size_pattern"
                        foundAddress = addr
                        log("✅ SUCCESS: ARM Emerald pattern found correct address (medium confidence)")
                        break
                    end
                end
            elseif variant == "quetzal" then
                for _, addr in ipairs(results.methods.arm.quetzal.addresses) do
                    if addr == EXPECTED_ADDRESSES.quetzal then
                        success = true
                        confidence = "medium"
                        method = "arm_size_pattern"
                        foundAddress = addr
                        log("✅ SUCCESS: ARM Quetzal pattern found correct address (medium confidence)")
                        break
                    end
                end
            end
        end
    end
    
    if success then
        log(string.format("🎉 OVERALL SUCCESS: Found partyData at 0x%08X", foundAddress))
        log(string.format("   Method: %s", method))
        log(string.format("   Confidence: %s", confidence))
        log(string.format("   Game: %s", variant))
    else
        log("❌ OVERALL FAILURE: Could not locate partyData address")
        log("   This may indicate the patterns need adjustment or the ROM is not supported")
    end
    
    results.summary = {
        success = success,
        foundAddress = foundAddress,
        method = method,
        confidence = confidence
    }
    
    return results
end

-- Return the test function for external use
runTest = runUniversalPatternTest
getGameVariant = getGameVariant
expectedAddresses = EXPECTED_ADDRESSES