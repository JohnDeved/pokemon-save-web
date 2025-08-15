-- WORKING Real ROM Universal Pattern Detection
-- This script finds literal pools containing target addresses and traces back
-- to find ARM/THUMB instructions that reference them

print("🚀 REAL ROM Universal Pattern Detection")
print("======================================")

-- Target addresses we need to find
local TARGET_ADDRESSES = {
    emerald = 0x020244EC,
    quetzal = 0x020235B8
}

-- Determine which game based on ROM title
local romTitle = emu:getGameTitle() or ""
local romSize = emu:romSize()
local gameType = ""
local targetAddr = 0

print(string.format("📱 ROM: %s (%d bytes)", romTitle, romSize))

if string.find(romTitle:upper(), "EMER") then
    gameType = "emerald"
    targetAddr = TARGET_ADDRESSES.emerald
elseif string.find(romTitle:upper(), "QUETZ") then
    gameType = "quetzal" 
    targetAddr = TARGET_ADDRESSES.quetzal
else
    print("❌ Unknown ROM - not Pokemon Emerald or Quetzal")
    return
end

print(string.format("🎯 Detected: %s (target: 0x%08X)", gameType, targetAddr))

-- Convert address to little-endian bytes
local function addressToBytes(addr)
    return {
        addr & 0xFF,
        (addr >> 8) & 0xFF,
        (addr >> 16) & 0xFF,
        (addr >> 24) & 0xFF
    }
end

-- Find literal pools containing the target address
local function findLiteralPools()
    print(string.format("\n🔍 Searching for literal pools containing 0x%08X", targetAddr))
    
    local targetBytes = addressToBytes(targetAddr)
    local pools = {}
    
    -- Search ROM for the target address (limit to 4MB for performance)
    local maxSearch = math.min(romSize, 4 * 1024 * 1024)
    
    for addr = 0x08000000, 0x08000000 + maxSearch - 4, 4 do
        local b1 = emu:read8(addr)
        local b2 = emu:read8(addr + 1)
        local b3 = emu:read8(addr + 2)
        local b4 = emu:read8(addr + 3)
        
        if b1 == targetBytes[1] and b2 == targetBytes[2] and 
           b3 == targetBytes[3] and b4 == targetBytes[4] then
            table.insert(pools, addr)
            print(string.format("   📍 Pool found at 0x%08X", addr))
            
            if #pools >= 10 then
                print("   ... (limiting to first 10 pools)")
                break
            end
        end
    end
    
    print(string.format("   Total pools found: %d", #pools))
    return pools
end

-- Find ARM/THUMB instructions that reference a literal pool
local function findInstructionReferences(pools)
    print(string.format("\n🔍 Finding ARM/THUMB instructions that reference literal pools"))
    
    local references = {}
    
    for i, poolAddr in ipairs(pools) do
        print(string.format("\n   Analyzing pool %d at 0x%08X", i, poolAddr))
        
        -- Search backwards for ARM LDR instructions (up to 4KB back)
        for instAddr = math.max(0x08000000, poolAddr - 4096), poolAddr - 4, 4 do
            local i1 = emu:read8(instAddr)
            local i2 = emu:read8(instAddr + 1)
            local i3 = emu:read8(instAddr + 2)
            local i4 = emu:read8(instAddr + 3)
            
            -- ARM LDR literal pattern: E5 9F XX XX
            if i3 == 0x9F and i4 == 0xE5 then
                local immediate = i1 | (i2 << 8)
                local pc = instAddr + 8  -- ARM PC is instruction + 8
                local calcPoolAddr = pc + immediate
                
                if calcPoolAddr == poolAddr then
                    print(string.format("      ✅ ARM LDR at 0x%08X → pool", instAddr))
                    
                    -- Get context (16 bytes before and after)
                    local context = {}
                    for j = -16, 19 do
                        local addr = instAddr + j
                        if addr >= 0x08000000 and addr < 0x08000000 + romSize then
                            table.insert(context, emu:read8(addr))
                        else
                            table.insert(context, 0)
                        end
                    end
                    
                    table.insert(references, {
                        type = "ARM_LDR",
                        instructionAddr = instAddr,
                        poolAddr = poolAddr,
                        immediate = immediate,
                        instruction = {i1, i2, i3, i4},
                        context = context
                    })
                end
            end
        end
        
        -- Search backwards for THUMB LDR instructions (up to 1KB back)
        for instAddr = math.max(0x08000000, poolAddr - 1024), poolAddr - 2, 2 do
            local t1 = emu:read8(instAddr)
            local t2 = emu:read8(instAddr + 1)
            
            -- THUMB LDR literal pattern: 48 XX
            if (t1 & 0xF8) == 0x48 then
                local immediate = t2
                local pc = ((instAddr + 4) & ~3)  -- THUMB PC alignment
                local calcPoolAddr = pc + (immediate * 4)
                
                if calcPoolAddr == poolAddr then
                    print(string.format("      ✅ THUMB LDR at 0x%08X → pool", instAddr))
                    
                    -- Get context (12 bytes before and after)
                    local context = {}
                    for j = -12, 15 do
                        local addr = instAddr + j
                        if addr >= 0x08000000 and addr < 0x08000000 + romSize then
                            table.insert(context, emu:read8(addr))
                        else
                            table.insert(context, 0)
                        end
                    end
                    
                    table.insert(references, {
                        type = "THUMB_LDR",
                        instructionAddr = instAddr,
                        poolAddr = poolAddr,
                        immediate = immediate,
                        instruction = {t1, t2},
                        context = context
                    })
                end
            end
        end
        
        -- Limit output to keep it manageable
        if #references >= 15 then
            print("   ... (limiting output to first 15 references)")
            break
        end
    end
    
    return references
end

-- Analyze patterns from instruction references
local function analyzePatterns(references)
    print(string.format("\n📊 PATTERN ANALYSIS (%d references)", #references))
    print("=====================================")
    
    local armPatterns = {}
    local thumbPatterns = {}
    
    for i, ref in ipairs(references) do
        print(string.format("\nReference %d: %s at 0x%08X", i, ref.type, ref.instructionAddr))
        
        local context = ref.context
        local midpoint = math.floor(#context / 2) + 1
        
        -- Extract stable patterns before and after the instruction
        local beforeBytes = {}
        local afterBytes = {}
        local instrBytes = {}
        
        if ref.type == "ARM_LDR" then
            -- 8 bytes before ARM instruction
            for j = midpoint - 8, midpoint - 1 do
                if j > 0 and j <= #context then
                    table.insert(beforeBytes, string.format("%02X", context[j]))
                end
            end
            
            -- ARM instruction (4 bytes)
            for j = midpoint, midpoint + 3 do
                if j > 0 and j <= #context then
                    table.insert(instrBytes, string.format("%02X", context[j]))
                end
            end
            
            -- 8 bytes after ARM instruction
            for j = midpoint + 4, midpoint + 11 do
                if j > 0 and j <= #context then
                    table.insert(afterBytes, string.format("%02X", context[j]))
                end
            end
            
            table.insert(armPatterns, {
                before = table.concat(beforeBytes, " "),
                instruction = table.concat(instrBytes, " "),
                after = table.concat(afterBytes, " "),
                addr = ref.instructionAddr
            })
            
        else -- THUMB_LDR
            -- 6 bytes before THUMB instruction
            for j = midpoint - 6, midpoint - 1 do
                if j > 0 and j <= #context then
                    table.insert(beforeBytes, string.format("%02X", context[j]))
                end
            end
            
            -- THUMB instruction (2 bytes)
            for j = midpoint, midpoint + 1 do
                if j > 0 and j <= #context then
                    table.insert(instrBytes, string.format("%02X", context[j]))
                end
            end
            
            -- 6 bytes after THUMB instruction
            for j = midpoint + 2, midpoint + 7 do
                if j > 0 and j <= #context then
                    table.insert(afterBytes, string.format("%02X", context[j]))
                end
            end
            
            table.insert(thumbPatterns, {
                before = table.concat(beforeBytes, " "),
                instruction = table.concat(instrBytes, " "),
                after = table.concat(afterBytes, " "),
                addr = ref.instructionAddr
            })
        end
        
        print(string.format("   Before:  %s", table.concat(beforeBytes, " ")))
        print(string.format("   Instr:   %s", table.concat(instrBytes, " ")))
        print(string.format("   After:   %s", table.concat(afterBytes, " ")))
        
        -- Only show first 5 patterns to keep output manageable
        if i >= 5 then
            print("   ... (showing first 5 patterns only)")
            break
        end
    end
    
    return armPatterns, thumbPatterns
end

-- Generate universal patterns that could work across games
local function generateUniversalPatterns(armPatterns, thumbPatterns)
    print(string.format("\n🛠️  UNIVERSAL PATTERN GENERATION"))
    print("===================================")
    
    local patterns = {}
    
    -- ARM patterns
    if #armPatterns > 0 then
        print(string.format("\n🔧 ARM LDR Patterns Found: %d", #armPatterns))
        for i, pattern in ipairs(armPatterns) do
            print(string.format("   Pattern %d: %s E5 9F ?? ?? %s", i, pattern.before, pattern.after))
            
            local universalPattern = pattern.before .. " E5 9F ?? ?? " .. pattern.after
            universalPattern = universalPattern:gsub("%s+", " "):gsub("^%s+", ""):gsub("%s+$", "")
            
            table.insert(patterns, {
                type = "ARM_LDR",
                pattern = universalPattern,
                address = pattern.addr,
                description = "ARM LDR literal instruction that loads partyData address"
            })
        end
    end
    
    -- THUMB patterns
    if #thumbPatterns > 0 then
        print(string.format("\n🔧 THUMB LDR Patterns Found: %d", #thumbPatterns))
        for i, pattern in ipairs(thumbPatterns) do
            print(string.format("   Pattern %d: %s 48 ?? %s", i, pattern.before, pattern.after))
            
            local universalPattern = pattern.before .. " 48 ?? " .. pattern.after
            universalPattern = universalPattern:gsub("%s+", " "):gsub("^%s+", ""):gsub("%s+$", "")
            
            table.insert(patterns, {
                type = "THUMB_LDR",
                pattern = universalPattern,
                address = pattern.addr,
                description = "THUMB LDR literal instruction that loads partyData address"
            })
        end
    end
    
    return patterns
end

-- Main execution
print(string.format("\n🔍 EXECUTING REAL ROM PATTERN DETECTION FOR %s", gameType:upper()))
print("================================================================")

-- Step 1: Find literal pools
local pools = findLiteralPools()

if #pools == 0 then
    print("\n❌ No literal pools found containing target address")
    print("💡 This could mean:")
    print("   - Wrong ROM loaded")
    print("   - Address not stored as literal data")
    print("   - Search range too small")
    return
end

-- Step 2: Find instruction references
local references = findInstructionReferences(pools)

if #references == 0 then
    print("\n❌ No ARM/THUMB instructions found that reference the literal pools")
    print("💡 This could mean:")
    print("   - Instructions are outside search range")
    print("   - Different instruction patterns used")
    print("   - Need to expand search parameters")
    return
end

-- Step 3: Analyze patterns
local armPatterns, thumbPatterns = analyzePatterns(references)

-- Step 4: Generate universal patterns
local universalPatterns = generateUniversalPatterns(armPatterns, thumbPatterns)

-- Final results
print(string.format("\n🎯 FINAL RESULTS FOR %s", gameType:upper()))
print("=====================================")
print(string.format("✅ Literal pools found: %d", #pools))
print(string.format("✅ Instruction references: %d", #references))
print(string.format("✅ ARM patterns: %d", #armPatterns))
print(string.format("✅ THUMB patterns: %d", #thumbPatterns))
print(string.format("✅ Universal patterns: %d", #universalPatterns))

if #universalPatterns > 0 then
    print("\n🎉 SUCCESS: Universal patterns discovered!")
    print("\n💡 USAGE INSTRUCTIONS:")
    print("To find partyData address in any ROM:")
    
    for i, pattern in ipairs(universalPatterns) do
        print(string.format("\nPattern %d (%s):", i, pattern.type))
        print(string.format("   Search:  %s", pattern.pattern))
        print(string.format("   Method:  Find this pattern, extract LDR immediate"))
        print(string.format("   Calc:    PC + immediate = literal pool address"))
        print(string.format("   Result:  Read 4 bytes from pool = partyData address"))
    end
    
    print(string.format("\n🎯 These patterns should find 0x%08X when used properly!", targetAddr))
    
else
    print("\n⚠️  No universal patterns generated")
    print("💡 Try analyzing more references or different pattern matching")
end

print("\n✅ Real ROM Universal Pattern Detection Complete!")