-- Behavioral Universal Pattern Detection for Pokemon partyData
-- Uses behavioral analysis to find partyData addresses without knowing them beforehand
-- Scans for characteristic ARM/THUMB code patterns that access party data

local function log(message)
    console:log(message)
    io.stdout:write("[Behavioral Scanner] " .. message .. "\n")
    io.stdout:flush()
end

local function error_log(message)
    console:error(message)
    io.stderr:write("[Behavioral Scanner ERROR] " .. message .. "\n")
    io.stderr:flush()
end

-- Pattern definitions for behavioral analysis
local BEHAVIORAL_PATTERNS = {
    {
        name = "party_loop_counter",
        description = "Detects loops that iterate through 6 Pokemon in party",
        pattern = {0x06, 0x20}, -- MOV r0, #6
        mask = {0xFF, 0xFF},
        extractAddress = function(startAddr)
            -- Look around for ARM LDR literal instructions
            for offset = -32, 32, 4 do
                local checkAddr = startAddr + offset
                if checkAddr >= 0x08000000 and checkAddr + 3 < 0x08000000 + emu:romSize() then
                    local b3 = emu:read8(checkAddr + 2)
                    local b4 = emu:read8(checkAddr + 3)
                    
                    -- Look for ARM LDR literal: E5 9F ?? ??
                    if b3 == 0x9F and b4 == 0xE5 then
                        local b1 = emu:read8(checkAddr)
                        local b2 = emu:read8(checkAddr + 1)
                        local immediate = b1 | (b2 << 8)
                        local pc = checkAddr + 8 -- ARM PC calculation
                        local literalAddr = pc + immediate
                        
                        if literalAddr + 3 < 0x08000000 + emu:romSize() then
                            local addr1 = emu:read8(literalAddr)
                            local addr2 = emu:read8(literalAddr + 1)
                            local addr3 = emu:read8(literalAddr + 2)
                            local addr4 = emu:read8(literalAddr + 3)
                            local address = addr1 | (addr2 << 8) | (addr3 << 16) | (addr4 << 24)
                            
                            -- Validate this looks like party data address
                            if address >= 0x02020000 and address <= 0x02030000 then
                                return address
                            end
                        end
                    end
                end
            end
            return nil
        end,
        confidence = "high"
    },
    
    {
        name = "pokemon_size_calculation",
        description = "Detects multiplication by Pokemon struct size",
        pattern = {0xE0, nil, nil, nil, 0xE5, 0x9F}, -- ADD + LDR literal
        mask = {0xFF, 0x00, 0x00, 0xFC, 0xFF, 0xFF}, -- Match 64 or 68 for size
        extractAddress = function(startAddr)
            -- Check if this is a size calculation (0x64 = 100 or 0x68 = 104)
            local sizeByte = emu:read8(startAddr + 3)
            if sizeByte ~= 0x64 and sizeByte ~= 0x68 then
                return nil
            end
            
            -- The LDR should be right after
            local ldrAddr = startAddr + 4
            local b1 = emu:read8(ldrAddr)
            local b2 = emu:read8(ldrAddr + 1)
            local immediate = b1 | (b2 << 8)
            local pc = ldrAddr + 8
            local literalAddr = pc + immediate
            
            if literalAddr + 3 < 0x08000000 + emu:romSize() then
                local addr1 = emu:read8(literalAddr)
                local addr2 = emu:read8(literalAddr + 1)
                local addr3 = emu:read8(literalAddr + 2)
                local addr4 = emu:read8(literalAddr + 3)
                local address = addr1 | (addr2 << 8) | (addr3 << 16) | (addr4 << 24)
                
                if address >= 0x02020000 and address <= 0x02030000 then
                    return address
                end
            end
            return nil
        end,
        confidence = "high"
    },
    
    {
        name = "party_slot_access",
        description = "Detects individual Pokemon slot access patterns",
        pattern = {0x48, nil, 0x68, nil}, -- THUMB LDR + LDR
        mask = {0xFF, 0x00, 0xFF, 0x00},
        extractAddress = function(startAddr)
            -- Extract from THUMB LDR literal
            local immediate = emu:read8(startAddr + 1)
            local pc = ((startAddr + 4) & ~3) -- THUMB PC word-aligned
            local literalAddr = pc + (immediate * 4)
            
            if literalAddr + 3 < 0x08000000 + emu:romSize() then
                local addr1 = emu:read8(literalAddr)
                local addr2 = emu:read8(literalAddr + 1)
                local addr3 = emu:read8(literalAddr + 2)
                local addr4 = emu:read8(literalAddr + 3)
                local address = addr1 | (addr2 << 8) | (addr3 << 16) | (addr4 << 24)
                
                if address >= 0x02020000 and address <= 0x02030000 then
                    return address
                end
            end
            return nil
        end,
        confidence = "medium"
    },
    
    {
        name = "party_bounds_check",
        description = "Detects party slot bounds validation (0-5)",
        pattern = {0x05, 0x28}, -- CMP #5
        mask = {0xFF, 0xFF},
        extractAddress = function(startAddr)
            -- Look ahead for LDR instruction after bounds check
            for offset = 4, 16, 4 do
                local ldrAddr = startAddr + offset
                if ldrAddr + 3 < 0x08000000 + emu:romSize() then
                    local b3 = emu:read8(ldrAddr + 2)
                    local b4 = emu:read8(ldrAddr + 3)
                    
                    if b3 == 0x9F and b4 == 0xE5 then
                        local b1 = emu:read8(ldrAddr)
                        local b2 = emu:read8(ldrAddr + 1)
                        local immediate = b1 | (b2 << 8)
                        local pc = ldrAddr + 8
                        local literalAddr = pc + immediate
                        
                        if literalAddr + 3 < 0x08000000 + emu:romSize() then
                            local addr1 = emu:read8(literalAddr)
                            local addr2 = emu:read8(literalAddr + 1)
                            local addr3 = emu:read8(literalAddr + 2)
                            local addr4 = emu:read8(literalAddr + 3)
                            local address = addr1 | (addr2 << 8) | (addr3 << 16) | (addr4 << 24)
                            
                            if address >= 0x02020000 and address <= 0x02030000 then
                                return address
                            end
                        end
                    end
                end
            end
            return nil
        end,
        confidence = "medium"
    }
}

-- Check if bytes match pattern with mask
local function matchesPattern(startAddr, pattern, mask)
    for i = 1, #pattern do
        if pattern[i] ~= nil then -- Skip nil entries (wildcards)
            local romByte = emu:read8(startAddr + i - 1)
            local patternByte = pattern[i]
            local maskByte = mask[i]
            
            if (romByte & maskByte) ~= (patternByte & maskByte) then
                return false
            end
        end
    end
    return true
end

-- Main behavioral pattern scanning function
function findPartyDataBehavioral()
    log("🔍 Starting behavioral pattern analysis...")
    log("Scanning for characteristic partyData access patterns...")
    
    local romSize = emu:romSize()
    local scanLimit = math.min(romSize, 2 * 1024 * 1024) -- 2MB limit for performance
    local startAddr = 0x08000000
    local endAddr = startAddr + scanLimit
    
    log(string.format("Scanning range: 0x%08X to 0x%08X (%.1f MB)", 
        startAddr, endAddr, scanLimit / 1024 / 1024))
    
    local foundAddresses = {}
    local addressCounts = {}
    local patternResults = {}
    
    -- Test each behavioral pattern
    for _, pattern in ipairs(BEHAVIORAL_PATTERNS) do
        log(string.format("\n📋 Testing pattern: %s", pattern.name))
        log(string.format("   Description: %s", pattern.description))
        
        local patternMatches = 0
        local uniqueAddresses = 0
        
        -- Scan through ROM looking for this pattern
        for addr = startAddr, endAddr - #pattern.pattern, 2 do -- Step by 2 for THUMB alignment
            if matchesPattern(addr, pattern.pattern, pattern.mask) then
                patternMatches = patternMatches + 1
                
                -- Try to extract address
                local extractedAddr = pattern.extractAddress(addr)
                if extractedAddr then
                    if not foundAddresses[extractedAddr] then
                        foundAddresses[extractedAddr] = true
                        uniqueAddresses = uniqueAddresses + 1
                        addressCounts[extractedAddr] = (addressCounts[extractedAddr] or 0) + 1
                        
                        table.insert(patternResults, {
                            address = extractedAddr,
                            pattern = pattern.name,
                            confidence = pattern.confidence,
                            offset = addr
                        })
                        
                        log(string.format("   ✅ Found address: 0x%08X at offset 0x%08X", 
                            extractedAddr, addr))
                    else
                        addressCounts[extractedAddr] = addressCounts[extractedAddr] + 1
                    end
                end
            end
        end
        
        log(string.format("   📊 Pattern matches: %d, unique addresses: %d", 
            patternMatches, uniqueAddresses))
    end
    
    -- Analyze results to find best candidate
    if #patternResults == 0 then
        log("❌ No behavioral patterns found")
        return nil, "no_patterns_found"
    end
    
    -- Find address with highest confidence and support
    local bestAddress = nil
    local bestScore = 0
    local bestSupport = 0
    
    for address, count in pairs(addressCounts) do
        local confidence_score = 0
        
        -- Calculate confidence score based on supporting patterns
        for _, result in ipairs(patternResults) do
            if result.address == address then
                if result.confidence == "high" then
                    confidence_score = confidence_score + 3
                elseif result.confidence == "medium" then
                    confidence_score = confidence_score + 2
                else
                    confidence_score = confidence_score + 1
                end
            end
        end
        
        local totalScore = count * confidence_score
        if totalScore > bestScore then
            bestScore = totalScore
            bestAddress = address
            bestSupport = count
        end
    end
    
    if bestAddress then
        log(string.format("\n🎯 Best candidate: 0x%08X", bestAddress))
        log(string.format("   Supporting patterns: %d", bestSupport))
        log(string.format("   Total score: %d", bestScore))
        
        -- List supporting pattern types
        local supportingPatterns = {}
        for _, result in ipairs(patternResults) do
            if result.address == bestAddress then
                table.insert(supportingPatterns, result.pattern)
            end
        end
        log(string.format("   Pattern types: %s", table.concat(supportingPatterns, ", ")))
        
        return bestAddress, "behavioral_analysis"
    else
        log("❌ No valid addresses found through behavioral analysis")
        return nil, "no_valid_addresses"
    end
end

-- Test function for validation
function testBehavioralPatterns()
    log("🧪 Testing behavioral universal patterns...")
    
    -- Get ROM info
    local romSize = emu:romSize()
    log(string.format("ROM size: %.1f MB", romSize / 1024 / 1024))
    
    -- Test the behavioral pattern detection
    local address, method = findPartyDataBehavioral()
    
    if address then
        log(string.format("\n✅ SUCCESS: Found partyData address!"))
        log(string.format("   Address: 0x%08X", address))
        log(string.format("   Method: %s", method))
        
        -- Try to determine game variant based on common addresses
        if address == 0x020244EC then
            log("   Game: Pokemon Emerald (confirmed)")
        elseif address == 0x020235B8 then
            log("   Game: Pokemon Quetzal (confirmed)")
        else
            log("   Game: Unknown variant or ROM hack")
        end
        
        return address
    else
        log(string.format("❌ FAILURE: %s", method or "unknown error"))
        return nil
    end
end

-- Export functions for external use
_G.findPartyDataBehavioral = findPartyDataBehavioral
_G.testBehavioralPatterns = testBehavioralPatterns

-- Auto-run test if this script is executed directly
log("🚀 Behavioral Universal Pattern System loaded")
log("Available functions: findPartyDataBehavioral(), testBehavioralPatterns()")
log("Starting automatic test...")

return testBehavioralPatterns()