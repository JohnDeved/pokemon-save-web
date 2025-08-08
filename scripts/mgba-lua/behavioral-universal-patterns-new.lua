-- TRUE Behavioral Universal Pattern Detection for mGBA
-- This script finds partyData addresses by analyzing ARM/THUMB code behavior
-- WITHOUT knowing target addresses beforehand

local BehavioralPatterns = {}

-- Utility function to read a 32-bit little-endian value from ROM
function readUint32LE(addr)
    local b1 = emu:read8(addr)
    local b2 = emu:read8(addr + 1) 
    local b3 = emu:read8(addr + 2)
    local b4 = emu:read8(addr + 3)
    return b1 + (b2 << 8) + (b3 << 16) + (b4 << 24)
end

-- Check if pattern matches at given offset
function matchesPattern(offset, pattern, mask)
    for i = 1, #pattern do
        local romByte = emu:read8(offset + i - 1)
        local patternByte = pattern[i]
        local maskByte = mask[i]
        
        if (romByte & maskByte) ~= (patternByte & maskByte) then
            return false
        end
    end
    return true
end

-- BEHAVIORAL PATTERN 1: Party Size Loop Detection
function findPartySizeLoops()
    print("🔍 Scanning for party size loops (MOV r?, #6)...")
    local matches = {}
    local romSize = emu:romSize()
    local scanEnd = math.min(romSize, 2 * 1024 * 1024) -- First 2MB
    
    -- Pattern: 06 ?? ?? ?? ?? ?? E5 9F (MOV r?, #6 + instructions + LDR literal)
    local pattern = {0x06, 0, 0, 0, 0, 0, 0xE5, 0x9F}
    local mask = {0xFF, 0, 0, 0, 0, 0, 0xFF, 0xFF}
    
    for offset = 0x08000000, 0x08000000 + scanEnd - 8, 2 do
        if matchesPattern(offset, pattern, mask) then
            -- Found pattern, now extract address from LDR literal
            local ldrPos = offset + 6
            local immediate = emu:read8(ldrPos) + (emu:read8(ldrPos + 1) << 8)
            local pc = ldrPos + 8 -- ARM PC calculation  
            local literalAddr = pc + immediate
            
            if literalAddr >= 0x08000000 and literalAddr + 3 < 0x08000000 + romSize then
                local address = readUint32LE(literalAddr)
                
                -- Validate this is in GBA RAM range
                if address >= 0x02000000 and address <= 0x02040000 then
                    table.insert(matches, {
                        offset = offset,
                        address = address,
                        pattern = "party_size_loop",
                        confidence = "high"
                    })
                    print(string.format("   Found: 0x%08X -> 0x%08X (offset 0x%08X)", address, literalAddr, offset))
                end
            end
        end
    end
    
    print(string.format("   Pattern matches: %d", #matches))
    return matches
end

-- BEHAVIORAL PATTERN 2: Pokemon Slot Calculation (Emerald - 100 bytes)
function findEmeraldSlotCalc()
    print("🔍 Scanning for Emerald Pokemon slot calculation (100 bytes)...")
    local matches = {}
    local romSize = emu:romSize()
    local scanEnd = math.min(romSize, 2 * 1024 * 1024)
    
    -- Pattern: 64 ?? ?? ?? E5 9F ?? ?? (multiply by 0x64 + LDR literal)
    local pattern = {0x64, 0, 0, 0, 0xE5, 0x9F, 0, 0}
    local mask = {0xFF, 0, 0, 0, 0xFF, 0xFF, 0, 0}
    
    for offset = 0x08000000, 0x08000000 + scanEnd - 8, 2 do
        if matchesPattern(offset, pattern, mask) then
            local ldrPos = offset + 4
            local immediate = emu:read8(ldrPos + 2) + (emu:read8(ldrPos + 3) << 8)
            local pc = ldrPos + 8
            local literalAddr = pc + immediate
            
            if literalAddr >= 0x08000000 and literalAddr + 3 < 0x08000000 + romSize then
                local address = readUint32LE(literalAddr)
                
                if address >= 0x02000000 and address <= 0x02040000 then
                    table.insert(matches, {
                        offset = offset,
                        address = address,
                        pattern = "emerald_slot_calc",
                        confidence = "high"
                    })
                    print(string.format("   Found: 0x%08X -> 0x%08X (offset 0x%08X)", address, literalAddr, offset))
                end
            end
        end
    end
    
    print(string.format("   Pattern matches: %d", #matches))
    return matches
end

-- BEHAVIORAL PATTERN 3: Pokemon Slot Calculation (Quetzal - 104 bytes)
function findQuetzalSlotCalc()
    print("🔍 Scanning for Quetzal Pokemon slot calculation (104 bytes)...")
    local matches = {}
    local romSize = emu:romSize()
    local scanEnd = math.min(romSize, 2 * 1024 * 1024)
    
    -- Pattern: 68 ?? ?? ?? E5 9F ?? ?? (multiply by 0x68 + LDR literal)
    local pattern = {0x68, 0, 0, 0, 0xE5, 0x9F, 0, 0}
    local mask = {0xFF, 0, 0, 0, 0xFF, 0xFF, 0, 0}
    
    for offset = 0x08000000, 0x08000000 + scanEnd - 8, 2 do
        if matchesPattern(offset, pattern, mask) then
            local ldrPos = offset + 4
            local immediate = emu:read8(ldrPos + 2) + (emu:read8(ldrPos + 3) << 8)
            local pc = ldrPos + 8
            local literalAddr = pc + immediate
            
            if literalAddr >= 0x08000000 and literalAddr + 3 < 0x08000000 + romSize then
                local address = readUint32LE(literalAddr)
                
                if address >= 0x02000000 and address <= 0x02040000 then
                    table.insert(matches, {
                        offset = offset,
                        address = address,
                        pattern = "quetzal_slot_calc",
                        confidence = "high"
                    })
                    print(string.format("   Found: 0x%08X -> 0x%08X (offset 0x%08X)", address, literalAddr, offset))
                end
            end
        end
    end
    
    print(string.format("   Pattern matches: %d", #matches))
    return matches
end

-- BEHAVIORAL PATTERN 4: THUMB Party Base Loading
function findThumbPartyBase()
    print("🔍 Scanning for THUMB party base loading...")
    local matches = {}
    local romSize = emu:romSize()
    local scanEnd = math.min(romSize, 2 * 1024 * 1024)
    
    for offset = 0x08000000, 0x08000000 + scanEnd - 6, 2 do
        local inst1 = emu:read8(offset)
        
        -- Check for THUMB LDR literal: 4X XX
        if (inst1 & 0xF8) == 0x48 then
            local immediate = emu:read8(offset + 1)
            local inst2 = emu:read8(offset + 2)
            local inst3 = emu:read8(offset + 4)
            
            -- Check for LDR + ADDS pattern: 68 XX ?? 30
            if (inst2 & 0xF8) == 0x68 and (inst3 & 0xF8) == 0x30 then
                -- Calculate THUMB literal address
                local pc = ((offset + 4) & 0xFFFFFFFC) -- Word align
                local literalAddr = pc + (immediate * 4)
                
                if literalAddr >= 0x08000000 and literalAddr + 3 < 0x08000000 + romSize then
                    local address = readUint32LE(literalAddr)
                    
                    if address >= 0x02000000 and address <= 0x02040000 then
                        table.insert(matches, {
                            offset = offset,
                            address = address,
                            pattern = "thumb_party_base",
                            confidence = "medium"
                        })
                        print(string.format("   Found: 0x%08X -> 0x%08X (offset 0x%08X)", address, literalAddr, offset))
                    end
                end
            end
        end
    end
    
    print(string.format("   Pattern matches: %d", #matches))
    return matches
end

-- BEHAVIORAL PATTERN 5: Party Bounds Validation
function findPartyBoundsValidation()
    print("🔍 Scanning for party bounds validation (CMP #5)...")
    local matches = {}
    local romSize = emu:romSize()
    local scanEnd = math.min(romSize, 2 * 1024 * 1024)
    
    for offset = 0x08000000, 0x08000000 + scanEnd - 8, 2 do
        local byte1 = emu:read8(offset)
        
        -- Look for CMP #5: 05 XX
        if byte1 == 0x05 then
            -- Scan forward for LDR literal within 16 bytes
            for ldrOffset = offset + 4, offset + 16, 2 do
                if ldrOffset + 3 < 0x08000000 + scanEnd then
                    local b3 = emu:read8(ldrOffset + 2)
                    local b4 = emu:read8(ldrOffset + 3)
                    
                    if b3 == 0x9F and b4 == 0xE5 then -- ARM LDR literal
                        local immediate = emu:read8(ldrOffset) + (emu:read8(ldrOffset + 1) << 8)
                        local pc = ldrOffset + 8
                        local literalAddr = pc + immediate
                        
                        if literalAddr >= 0x08000000 and literalAddr + 3 < 0x08000000 + romSize then
                            local address = readUint32LE(literalAddr)
                            
                            if address >= 0x02000000 and address <= 0x02040000 then
                                table.insert(matches, {
                                    offset = offset,
                                    address = address,
                                    pattern = "party_bounds_validation",
                                    confidence = "medium"
                                })
                                print(string.format("   Found: 0x%08X -> 0x%08X (offset 0x%08X)", address, literalAddr, offset))
                                break
                            end
                        end
                    end
                end
            end
        end
    end
    
    print(string.format("   Pattern matches: %d", #matches))
    return matches
end

-- Main behavioral pattern analysis function
function findPartyDataBehavioral()
    print("🚀 TRUE Behavioral Universal Pattern Analysis")
    print("Finding partyData addresses through code behavior analysis...")
    print("WITHOUT knowing target addresses beforehand!")
    print("============================================================")
    
    local romInfo = emu:getGameTitle()
    local romSize = emu:romSize()
    print(string.format("ROM: %s (%d bytes)", romInfo, romSize))
    print("")
    
    local allMatches = {}
    
    -- Run all behavioral pattern scans
    local partySizeMatches = findPartySizeLoops()
    local emeraldSlotMatches = findEmeraldSlotCalc()
    local quetzalSlotMatches = findQuetzalSlotCalc()
    local thumbMatches = findThumbPartyBase()
    local boundsMatches = findPartyBoundsValidation()
    
    -- Combine all matches
    for _, match in ipairs(partySizeMatches) do table.insert(allMatches, match) end
    for _, match in ipairs(emeraldSlotMatches) do table.insert(allMatches, match) end
    for _, match in ipairs(quetzalSlotMatches) do table.insert(allMatches, match) end
    for _, match in ipairs(thumbMatches) do table.insert(allMatches, match) end
    for _, match in ipairs(boundsMatches) do table.insert(allMatches, match) end
    
    print("\n📊 Behavioral Pattern Analysis Results:")
    print("============================================================")
    
    if #allMatches == 0 then
        print("❌ No behavioral patterns detected")
        print("   The ARM/THUMB code analysis found no recognizable party access patterns")
        return nil, "no_patterns_found"
    end
    
    -- Count addresses and calculate consensus
    local addressCounts = {}
    for _, match in ipairs(allMatches) do
        local addr = match.address
        if not addressCounts[addr] then
            addressCounts[addr] = {count = 0, patterns = {}, confidence = 0}
        end
        addressCounts[addr].count = addressCounts[addr].count + 1
        table.insert(addressCounts[addr].patterns, match.pattern)
        
        -- Add confidence score
        if match.confidence == "high" then
            addressCounts[addr].confidence = addressCounts[addr].confidence + 3
        elseif match.confidence == "medium" then
            addressCounts[addr].confidence = addressCounts[addr].confidence + 2
        else
            addressCounts[addr].confidence = addressCounts[addr].confidence + 1
        end
    end
    
    -- Find best candidate
    local bestAddr = nil
    local bestScore = 0
    
    for addr, data in pairs(addressCounts) do
        local score = data.count * data.confidence
        print(string.format("🎯 Address: 0x%08X", addr))
        print(string.format("   Patterns: %d (%s)", data.count, table.concat(data.patterns, ", ")))
        print(string.format("   Confidence score: %d", data.confidence))
        print(string.format("   Total score: %d", score))
        print("")
        
        if score > bestScore then
            bestScore = score
            bestAddr = addr
        end
    end
    
    if bestAddr then
        print(string.format("✅ BEST CANDIDATE: 0x%08X", bestAddr))
        print(string.format("   Score: %d", bestScore))
        print(string.format("   Supporting patterns: %d", addressCounts[bestAddr].count))
        print("   🎯 Found through BEHAVIORAL ANALYSIS!")
        print("   ✅ This demonstrates dynamic address discovery")
        return bestAddr, "behavioral_analysis"
    else
        print("❌ No consensus found among behavioral patterns")
        return nil, "no_consensus"
    end
end

-- Export the main function
_G.findPartyDataBehavioral = findPartyDataBehavioral

-- Auto-run when loaded
print("🔧 Behavioral Universal Pattern system loaded")
print("Run: findPartyDataBehavioral() to discover partyData address")