-- PROPER Universal Pattern Implementation - Working Version
-- Based on @JohnDeved's explanation: Find instruction patterns that REFERENCE target addresses

local function findInstructionsThatReferenceAddress(targetAddr)
    local results = {
        literalPools = {},
        armInstructions = {},
        thumbInstructions = {},
        debugInfo = {}
    }
    
    local function log(msg)
        table.insert(results.debugInfo, msg)
    end
    
    log("🎯 Finding instructions that reference address: " .. string.format("0x%08X", targetAddr))
    
    -- Convert target address to little-endian bytes
    local targetBytes = {
        targetAddr & 0xFF,
        (targetAddr >> 8) & 0xFF,
        (targetAddr >> 16) & 0xFF,
        (targetAddr >> 24) & 0xFF
    }
    
    log(string.format("Target bytes: %02X %02X %02X %02X", 
        targetBytes[1], targetBytes[2], targetBytes[3], targetBytes[4]))
    
    -- Step 1: Find literal pools containing target address (search first 2MB for performance)
    local searchLimit = math.min(emu:romSize(), 2000000)
    log("Searching " .. searchLimit .. " bytes for literal pools...")
    
    for addr = 0x08000000, 0x08000000 + searchLimit - 4, 4 do
        local b1 = emu:read8(addr)
        local b2 = emu:read8(addr + 1)
        local b3 = emu:read8(addr + 2)
        local b4 = emu:read8(addr + 3)
        
        if b1 == targetBytes[1] and b2 == targetBytes[2] and 
           b3 == targetBytes[3] and b4 == targetBytes[4] then
            table.insert(results.literalPools, addr)
            log(string.format("Found literal pool at 0x%08X", addr))
            
            if #results.literalPools >= 5 then break end -- Limit for performance
        end
    end
    
    log("Total literal pools found: " .. #results.literalPools)
    
    -- Step 2: For each literal pool, find ARM/THUMB instructions that reference it
    for i, poolAddr in ipairs(results.literalPools) do
        if i > 3 then break end -- Analyze first 3 pools only
        
        log("Analyzing pool " .. i .. " at " .. string.format("0x%08X", poolAddr))
        
        -- Search for ARM LDR instructions (E5 9F XX XX pattern)
        for instAddr = math.max(0x08000000, poolAddr - 2000), poolAddr - 4, 4 do
            local i1 = emu:read8(instAddr)
            local i2 = emu:read8(instAddr + 1)
            local i3 = emu:read8(instAddr + 2)
            local i4 = emu:read8(instAddr + 3)
            
            if i3 == 0x9F and i4 == 0xE5 then  -- ARM LDR literal pattern
                local immediate = i1 | (i2 << 8)
                local pc = instAddr + 8  -- ARM PC calculation
                local calcPoolAddr = pc + immediate
                
                if calcPoolAddr == poolAddr then
                    log(string.format("ARM LDR found: 0x%08X -> E5 9F %02X %02X", instAddr, i1, i2))
                    
                    -- Get surrounding bytes for pattern analysis
                    local context = {}
                    for j = -8, 11 do
                        if instAddr + j >= 0x08000000 and instAddr + j < 0x08000000 + emu:romSize() then
                            table.insert(context, emu:read8(instAddr + j))
                        else
                            table.insert(context, 0)
                        end
                    end
                    
                    table.insert(results.armInstructions, {
                        addr = instAddr,
                        immediate = immediate,
                        poolAddr = poolAddr,
                        context = context
                    })
                    break
                end
            end
        end
        
        -- Search for THUMB LDR instructions (48 XX pattern)
        for instAddr = math.max(0x08000000, poolAddr - 1000), poolAddr - 2, 2 do
            local t1 = emu:read8(instAddr)
            local t2 = emu:read8(instAddr + 1)
            
            if (t1 & 0xF8) == 0x48 then  -- THUMB LDR literal pattern
                local immediate = t2
                local pc = ((instAddr + 4) & ~3)  -- THUMB PC alignment
                local calcPoolAddr = pc + (immediate * 4)
                
                if calcPoolAddr == poolAddr then
                    log(string.format("THUMB LDR found: 0x%08X -> %02X %02X", instAddr, t1, t2))
                    
                    -- Get surrounding bytes for pattern analysis
                    local context = {}
                    for j = -6, 9 do
                        if instAddr + j >= 0x08000000 and instAddr + j < 0x08000000 + emu:romSize() then
                            table.insert(context, emu:read8(instAddr + j))
                        else
                            table.insert(context, 0)
                        end
                    end
                    
                    table.insert(results.thumbInstructions, {
                        addr = instAddr,
                        immediate = immediate,
                        poolAddr = poolAddr,
                        context = context
                    })
                    break
                end
            end
        end
    end
    
    log("ARM instructions found: " .. #results.armInstructions)
    log("THUMB instructions found: " .. #results.thumbInstructions)
    
    return results
end

-- Main execution function
local function runProperUniversalPatterns()
    local debugInfo = {}
    local function log(msg)
        table.insert(debugInfo, msg)
        print(msg)
    end
    
    log("🔍 PROPER Universal Pattern Detection - Working Implementation")
    log("Method: Find ARM/THUMB instructions that REFERENCE target addresses")
    
    local romSize = emu:romSize()
    local romTitle = emu:read(0x08000000 + 0xA0, 12)
    log("ROM: " .. romTitle .. " (" .. romSize .. " bytes)")
    
    -- Target addresses for both games
    local emeraldAddr = 0x020244EC
    local quetzalAddr = 0x020235B8
    
    -- Analyze patterns for the expected address based on ROM size/type
    local targetAddr = emeraldAddr  -- Default to Emerald
    if romSize > 20000000 then  -- Quetzal is larger
        targetAddr = quetzalAddr
        log("Detected Quetzal ROM, using target: " .. string.format("0x%08X", targetAddr))
    else
        log("Detected Emerald ROM, using target: " .. string.format("0x%08X", targetAddr))
    end
    
    -- Find instructions that reference the target address
    local results = findInstructionsThatReferenceAddress(targetAddr)
    
    -- Output results
    log("\\n📊 RESULTS:")
    log("==============")
    log("Literal pools: " .. #results.literalPools)
    log("ARM instructions: " .. #results.armInstructions)
    log("THUMB instructions: " .. #results.thumbInstructions)
    
    if #results.armInstructions > 0 or #results.thumbInstructions > 0 then
        log("\\n✅ SUCCESS: Found instruction patterns that reference target address!")
        
        -- Show first ARM pattern
        if #results.armInstructions > 0 then
            local arm = results.armInstructions[1]
            local contextStr = ""
            for _, byte in ipairs(arm.context) do
                contextStr = contextStr .. string.format("%02X ", byte)
            end
            log("\\nARM Pattern Example:")
            log("Address: " .. string.format("0x%08X", arm.addr))
            log("Context: " .. contextStr)
        end
        
        -- Show first THUMB pattern  
        if #results.thumbInstructions > 0 then
            local thumb = results.thumbInstructions[1]
            local contextStr = ""
            for _, byte in ipairs(thumb.context) do
                contextStr = contextStr .. string.format("%02X ", byte)
            end
            log("\\nTHUMB Pattern Example:")
            log("Address: " .. string.format("0x%08X", thumb.addr))
            log("Context: " .. contextStr)
        end
        
        log("\\n💡 NEXT STEPS:")
        log("1. Analyze the context patterns above")
        log("2. Create byte masks with ?? wildcards for variable parts")
        log("3. Use these masks to search ROM memory")
        log("4. Extract addresses from matching LDR instructions")
        
    else
        log("\\n❌ No instruction patterns found")
        log("This may indicate:")
        log("- Target address not present in searched ROM region")
        log("- Different instruction sequences used")
        log("- Need to expand search area")
    end
    
    -- Output debug info for external parsing
    log("\\nDEBUG_START")
    for _, msg in ipairs(results.debugInfo) do
        log("DEBUG: " .. msg)
    end
    log("DEBUG_END")
    
    log("\\n✅ PROPER pattern detection complete!")
    
    return results
end

-- Execute the proper pattern detection
runProperUniversalPatterns()