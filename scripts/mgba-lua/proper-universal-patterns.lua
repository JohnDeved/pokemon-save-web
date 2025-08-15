-- PROPER Universal Pattern Detection for Pokemon PartyData
-- This script implements the CORRECT approach as explained by @JohnDeved:
-- 1. Find ROM locations that REFERENCE our target addresses (0x020244EC, 0x020235B8)
-- 2. Look for stable ARM/ASM instruction patterns AROUND those references
-- 3. Create byte pattern masks that can find those instruction patterns
-- 4. Extract addresses from the found patterns

print("🔍 Starting PROPER Universal Pattern Detection")
print("📝 Method: Find instruction patterns that REFERENCE target addresses")

-- Get ROM information
local romSize = emu:romSize()
local romTitle = emu:read(0x08000000 + 0xA0, 12)
print(string.format("📱 ROM: %s (%d bytes)", romTitle, romSize))

-- Target addresses we're looking for
local targetAddresses = {
    emerald = 0x020244EC,
    quetzal = 0x020235B8
}

-- Convert address to little-endian bytes
function addressToBytes(addr)
    return {
        addr & 0xFF,
        (addr >> 8) & 0xFF,
        (addr >> 16) & 0xFF,
        (addr >> 24) & 0xFF
    }
end

-- Find locations in ROM where target address appears as literal data
function findAddressReferences(targetAddr, gameName)
    print(string.format("\n🎯 Finding references to %s address: 0x%08X", gameName, targetAddr))
    
    local targetBytes = addressToBytes(targetAddr)
    local references = {}
    local literalPools = {}
    
    -- Search for the address bytes in ROM
    for addr = 0x08000000, 0x08000000 + math.min(romSize, 8000000) - 4, 4 do
        local b1 = emu:read8(addr)
        local b2 = emu:read8(addr + 1)
        local b3 = emu:read8(addr + 2)
        local b4 = emu:read8(addr + 3)
        
        if b1 == targetBytes[1] and b2 == targetBytes[2] and 
           b3 == targetBytes[3] and b4 == targetBytes[4] then
            print(string.format("   📍 Found literal pool at 0x%08X", addr))
            table.insert(literalPools, addr)
        end
    end
    
    print(string.format("   Total literal pools found: %d", #literalPools))
    
    -- For each literal pool, find instructions that reference it
    for _, poolAddr in ipairs(literalPools) do
        print(string.format("\n   🔍 Analyzing literal pool at 0x%08X", poolAddr))
        
        -- Search backwards for ARM LDR instructions that could reference this pool
        for instAddr = math.max(0x08000000, poolAddr - 4000), poolAddr - 4, 4 do
            local i1 = emu:read8(instAddr)
            local i2 = emu:read8(instAddr + 1)
            local i3 = emu:read8(instAddr + 2)
            local i4 = emu:read8(instAddr + 3)
            
            -- Check for ARM LDR literal: E5 9F XX XX
            if i3 == 0x9F and i4 == 0xE5 then
                local immediate = i1 | (i2 << 8)
                local pc = instAddr + 8  -- ARM PC is +8
                local calcPoolAddr = pc + immediate
                
                if calcPoolAddr == poolAddr then
                    print(string.format("      ✅ ARM LDR references this pool: 0x%08X", instAddr))
                    print(string.format("         Instruction: E5 9F %02X %02X", i1, i2))
                    
                    -- Get surrounding context (16 bytes before and after)
                    local context = {}
                    for j = -16, 19 do
                        if instAddr + j >= 0x08000000 and instAddr + j < 0x08000000 + romSize then
                            table.insert(context, emu:read8(instAddr + j))
                        else
                            table.insert(context, 0x00)
                        end
                    end
                    
                    table.insert(references, {
                        type = "ARM_LDR",
                        instructionAddr = instAddr,
                        poolAddr = poolAddr,
                        immediate = immediate,
                        pattern = string.format("E5 9F %02X %02X", i1, i2),
                        context = context,
                        targetAddr = targetAddr
                    })
                end
            end
        end
        
        -- Search backwards for THUMB LDR instructions that could reference this pool
        for instAddr = math.max(0x08000000, poolAddr - 1000), poolAddr - 2, 2 do
            local t1 = emu:read8(instAddr)
            local t2 = emu:read8(instAddr + 1)
            
            -- Check for THUMB LDR literal: 48 XX
            if (t1 & 0xF8) == 0x48 then
                local immediate = t2
                local pc = ((instAddr + 4) & ~3)  -- THUMB PC alignment
                local calcPoolAddr = pc + (immediate * 4)
                
                if calcPoolAddr == poolAddr then
                    print(string.format("      ✅ THUMB LDR references this pool: 0x%08X", instAddr))
                    print(string.format("         Instruction: %02X %02X", t1, t2))
                    
                    -- Get surrounding context (12 bytes before and after)
                    local context = {}
                    for j = -12, 15 do
                        if instAddr + j >= 0x08000000 and instAddr + j < 0x08000000 + romSize then
                            table.insert(context, emu:read8(instAddr + j))
                        else
                            table.insert(context, 0x00)
                        end
                    end
                    
                    table.insert(references, {
                        type = "THUMB_LDR",
                        instructionAddr = instAddr,
                        poolAddr = poolAddr,
                        immediate = immediate,
                        pattern = string.format("%02X %02X", t1, t2),
                        context = context,
                        targetAddr = targetAddr
                    })
                end
            end
        end
        
        -- Limit processing to first few pools to avoid excessive output
        if #references >= 10 then
            break
        end
    end
    
    return references
end

-- Analyze instruction patterns around references
function analyzeInstructionPatterns(references, gameName)
    print(string.format("\n📊 Analyzing instruction patterns for %s (%d references)", gameName, #references))
    
    local patterns = {}
    
    for i, ref in ipairs(references) do
        print(string.format("\n   Reference %d: %s at 0x%08X", i, ref.type, ref.instructionAddr))
        print(string.format("      Pattern: %s", ref.pattern))
        
        -- Analyze context around the instruction
        local context = ref.context
        local midpoint = math.floor(#context / 2)
        
        -- Look for stable patterns before and after the LDR instruction
        print("      Context analysis:")
        
        -- 8 bytes before LDR
        local beforePattern = {}
        for j = midpoint - 8, midpoint - 1 do
            if j > 0 and j <= #context then
                table.insert(beforePattern, string.format("%02X", context[j]))
            end
        end
        
        -- LDR instruction itself
        local ldrPattern = {}
        for j = midpoint, midpoint + (ref.type == "ARM_LDR" and 3 or 1) do
            if j > 0 and j <= #context then
                table.insert(ldrPattern, string.format("%02X", context[j]))
            end
        end
        
        -- 8 bytes after LDR
        local afterPattern = {}
        local startAfter = midpoint + (ref.type == "ARM_LDR" and 4 or 2)
        for j = startAfter, startAfter + 7 do
            if j > 0 and j <= #context then
                table.insert(afterPattern, string.format("%02X", context[j]))
            end
        end
        
        print(string.format("         Before: %s", table.concat(beforePattern, " ")))
        print(string.format("         LDR:    %s", table.concat(ldrPattern, " ")))
        print(string.format("         After:  %s", table.concat(afterPattern, " ")))
        
        -- Create pattern candidates
        local candidate = {
            type = ref.type,
            instructionAddr = ref.instructionAddr,
            beforeBytes = beforePattern,
            ldrBytes = ldrPattern,
            afterBytes = afterPattern,
            fullPattern = table.concat(beforePattern, " ") .. " " .. table.concat(ldrPattern, " ") .. " " .. table.concat(afterPattern, " "),
            targetAddr = ref.targetAddr
        }
        
        table.insert(patterns, candidate)
        
        -- Only analyze first 5 references to keep output manageable
        if i >= 5 then
            break
        end
    end
    
    return patterns
end

-- Generate universal patterns that work across games
function generateUniversalPatterns(emeraldPatterns, quetzalPatterns)
    print("\n🛠️  GENERATING UNIVERSAL PATTERNS")
    print("=============================================")
    
    local universalPatterns = {}
    
    -- Look for common instruction sequences
    for _, emeraldPattern in ipairs(emeraldPatterns) do
        for _, quetzalPattern in ipairs(quetzalPatterns) do
            if emeraldPattern.type == quetzalPattern.type then
                -- Compare patterns to find similarities
                print(string.format("\n🔍 Comparing %s patterns:", emeraldPattern.type))
                print(string.format("   Emerald:  %s", emeraldPattern.fullPattern))
                print(string.format("   Quetzal:  %s", quetzalPattern.fullPattern))
                
                -- Find common byte sequences
                local commonBefore = findCommonSequence(emeraldPattern.beforeBytes, quetzalPattern.beforeBytes)
                local commonAfter = findCommonSequence(emeraldPattern.afterBytes, quetzalPattern.afterBytes)
                
                if #commonBefore >= 4 or #commonAfter >= 4 then
                    local universal = {
                        type = emeraldPattern.type,
                        beforePattern = table.concat(commonBefore, " "),
                        afterPattern = table.concat(commonAfter, " "),
                        description = string.format("Universal %s pattern", emeraldPattern.type),
                        emeraldAddr = emeraldPattern.targetAddr,
                        quetzalAddr = quetzalPattern.targetAddr
                    }
                    
                    print(string.format("   ✅ UNIVERSAL PATTERN FOUND:"))
                    print(string.format("      Before LDR: %s", universal.beforePattern))
                    print(string.format("      After LDR:  %s", universal.afterPattern))
                    
                    table.insert(universalPatterns, universal)
                end
            end
        end
    end
    
    return universalPatterns
end

-- Find common byte sequence between two pattern arrays
function findCommonSequence(pattern1, pattern2)
    local common = {}
    local minLen = math.min(#pattern1, #pattern2)
    
    for i = 1, minLen do
        if pattern1[i] == pattern2[i] then
            table.insert(common, pattern1[i])
        else
            table.insert(common, "??")
        end
    end
    
    return common
end

-- Main execution
print("\n🚀 EXECUTING PROPER UNIVERSAL PATTERN DETECTION")
print("================================================")

-- Find references for both games
local emeraldRefs = findAddressReferences(targetAddresses.emerald, "Emerald")
local quetzalRefs = findAddressReferences(targetAddresses.quetzal, "Quetzal")

-- Analyze patterns
local emeraldPatterns = analyzeInstructionPatterns(emeraldRefs, "Emerald")
local quetzalPatterns = analyzeInstructionPatterns(quetzalRefs, "Quetzal")

-- Generate universal patterns
local universalPatterns = generateUniversalPatterns(emeraldPatterns, quetzalPatterns)

-- Final results
print("\n🎯 FINAL RESULTS")
print("================")
print(string.format("Emerald references found: %d", #emeraldRefs))
print(string.format("Quetzal references found: %d", #quetzalRefs))
print(string.format("Universal patterns generated: %d", #universalPatterns))

if #universalPatterns > 0 then
    print("\n✅ SUCCESS: Universal patterns discovered!")
    
    for i, pattern in ipairs(universalPatterns) do
        print(string.format("\nPattern %d (%s):", i, pattern.type))
        print(string.format("   Before LDR: %s", pattern.beforePattern))
        print(string.format("   After LDR:  %s", pattern.afterPattern))
        print(string.format("   Emerald target: 0x%08X", pattern.emeraldAddr))
        print(string.format("   Quetzal target: 0x%08X", pattern.quetzalAddr))
        
        -- Generate practical search pattern
        local searchPattern = pattern.beforePattern .. " ?? ?? ?? ?? " .. pattern.afterPattern
        searchPattern = searchPattern:gsub("%s+", " "):gsub("^%s+", ""):gsub("%s+$", "")
        print(string.format("   Search mask:   %s", searchPattern))
    end
    
    print("\n💡 HOW TO USE THESE PATTERNS:")
    print("1. Search ROM for the pattern mask")
    print("2. When found, extract the LDR instruction at the ?? ?? ?? ?? position")
    print("3. Calculate literal pool address from LDR immediate value")
    print("4. Read 4 bytes from literal pool to get partyData address")
    
else
    print("\n❌ No universal patterns found")
    print("💡 Try analyzing more reference points or adjusting pattern matching logic")
end

print("\n✅ Proper Universal Pattern Detection Complete!")
return universalPatterns