-- Real Universal Pattern Search Implementation
-- Actually searches for THUMB and ARM instructions that reference literal pools
-- containing the target partyData addresses

local function realUniversalPatternSearch(expectedAddr, gameVariant)
    local results = {
        success = false,
        foundAddress = nil,
        method = "real_universal_pattern",
        matches = {},
        debugInfo = {},
        searchStats = {
            romSizeBytes = 0,
            searchLimitBytes = 0,
            totalMatches = 0,
            thumbSearched = 0,
            armSearched = 0,
            literalPoolsFound = 0
        }
    }
    
    local function log(msg)
        table.insert(results.debugInfo, msg)
    end
    
    -- Helper function to read 32-bit little-endian value
    local function read32LE(addr)
        local b1 = emu:read8(addr)
        local b2 = emu:read8(addr + 1)
        local b3 = emu:read8(addr + 2)
        local b4 = emu:read8(addr + 3)
        return b1 + (b2 << 8) + (b3 << 16) + (b4 << 24)
    end
    
    log("🔍 Real Universal Pattern Search - Starting...")
    log("Expected Address: " .. string.format("0x%08X", expectedAddr))
    log("Game Variant: " .. gameVariant)
    
    local romSize = emu:romSize()
    local searchLimit = math.min(romSize, 2000000) -- 2MB search limit
    
    results.searchStats.romSizeBytes = romSize
    results.searchStats.searchLimitBytes = searchLimit
    
    log("ROM Size: " .. romSize .. " bytes")
    log("Search Limit: " .. searchLimit .. " bytes")
    
    -- Step 1: Find literal pools containing the target address
    log("\n📍 Step 1: Finding literal pools containing target address...")
    
    -- Convert target address to little-endian bytes for searching
    local targetBytes = {
        expectedAddr & 0xFF,
        (expectedAddr >> 8) & 0xFF,
        (expectedAddr >> 16) & 0xFF,
        (expectedAddr >> 24) & 0xFF
    }
    
    log(string.format("Target bytes: %02X %02X %02X %02X", 
        targetBytes[1], targetBytes[2], targetBytes[3], targetBytes[4]))
    
    local literalPools = {}
    
    -- Search for literal pools containing the target address
    for addr = 0x08000000, 0x08000000 + searchLimit - 4, 4 do
        local b1 = emu:read8(addr)
        local b2 = emu:read8(addr + 1)
        local b3 = emu:read8(addr + 2)
        local b4 = emu:read8(addr + 3)
        
        if b1 == targetBytes[1] and b2 == targetBytes[2] and 
           b3 == targetBytes[3] and b4 == targetBytes[4] then
            table.insert(literalPools, addr)
            log(string.format("  Found literal pool at 0x%08X", addr))
            
            -- Limit to first 10 literal pools for performance
            if #literalPools >= 10 then
                break
            end
        end
    end
    
    results.searchStats.literalPoolsFound = #literalPools
    log("Literal pools found: " .. #literalPools)
    
    if #literalPools == 0 then
        log("❌ No literal pools found containing target address")
        return results
    end
    
    -- Step 2: For each literal pool, work backwards to find referencing instructions
    log("\n🔍 Step 2: Finding instructions that reference literal pools...")
    
    for _, poolAddr in ipairs(literalPools) do
        log("Analyzing pool at 0x" .. string.format("%08X", poolAddr))
        
        -- Search backwards for THUMB instructions (LDR r?, [PC, #imm])
        local thumbSearchStart = math.max(0x08000000, poolAddr - 1000)
        
        for instAddr = thumbSearchStart, poolAddr - 2, 2 do
            local thumb1 = emu:read8(instAddr)
            local thumb2 = emu:read8(instAddr + 1)
            
            -- Check for THUMB LDR PC-relative: 01001xxx xxxxxxxx (0x48-0x4F)
            if thumb1 >= 0x48 and thumb1 <= 0x4F then
                results.searchStats.thumbSearched = results.searchStats.thumbSearched + 1
                
                -- Extract register and immediate
                local reg = (thumb1 & 0x07)
                local immediate = thumb2
                
                -- Calculate PC-relative address
                -- THUMB PC = (instruction + 4) aligned to 4-byte boundary
                local pc = ((instAddr + 4) // 4) * 4
                local calcPoolAddr = pc + (immediate * 4)
                
                if calcPoolAddr == poolAddr then
                    local match = {
                        type = "THUMB",
                        pattern = string.format("%02X %02X", thumb1, thumb2),
                        instruction = string.format("0x%08X: %02X %02X", instAddr, thumb1, thumb2),
                        literalPool = string.format("0x%08X", poolAddr),
                        address = string.format("0x%08X", expectedAddr),
                        isTarget = true,
                        details = {
                            register = "r" .. reg,
                            immediate = immediate,
                            pc = string.format("0x%08X", pc),
                            calculation = string.format("PC(0x%08X) + %d*4 = 0x%08X", pc, immediate, calcPoolAddr)
                        }
                    }
                    
                    table.insert(results.matches, match)
                    results.searchStats.totalMatches = results.searchStats.totalMatches + 1
                    
                    log(string.format("  ✅ THUMB: %s → pool 0x%08X", match.instruction, poolAddr))
                    log(string.format("      Pattern: %s", match.pattern))
                    log(string.format("      Calculation: %s", match.details.calculation))
                    
                    -- Found target!
                    results.success = true
                    results.foundAddress = expectedAddr
                    break
                end
            end
        end
        
        -- Search backwards for ARM instructions (LDR r?, [PC, #imm])  
        local armSearchStart = math.max(0x08000000, poolAddr - 1000)
        
        for instAddr = armSearchStart, poolAddr - 4, 4 do
            local arm1 = emu:read8(instAddr)
            local arm2 = emu:read8(instAddr + 1)  
            local arm3 = emu:read8(instAddr + 2)
            local arm4 = emu:read8(instAddr + 3)
            
            -- Check for ARM LDR PC-relative: 1110 0101 1001 1111 xxxx xxxx xxxx xxxx
            -- In little-endian: xx xx 9F E5
            if arm3 == 0x9F and arm4 == 0xE5 then
                results.searchStats.armSearched = results.searchStats.armSearched + 1
                
                -- Extract 12-bit immediate (little-endian)
                local immediate = arm1 + (arm2 << 8)
                
                -- Calculate PC-relative address
                -- ARM PC = instruction address + 8
                local pc = instAddr + 8
                local calcPoolAddr = pc + immediate
                
                if calcPoolAddr == poolAddr then
                    local match = {
                        type = "ARM",
                        pattern = string.format("E5 9F %02X %02X", arm1, arm2),
                        instruction = string.format("0x%08X: E5 9F %02X %02X", instAddr, arm1, arm2),
                        literalPool = string.format("0x%08X", poolAddr),
                        address = string.format("0x%08X", expectedAddr),
                        isTarget = true,
                        details = {
                            immediate = immediate,
                            pc = string.format("0x%08X", pc),
                            calculation = string.format("PC(0x%08X) + %d = 0x%08X", pc, immediate, calcPoolAddr)
                        }
                    }
                    
                    table.insert(results.matches, match)
                    results.searchStats.totalMatches = results.searchStats.totalMatches + 1
                    
                    log(string.format("  ✅ ARM: %s → pool 0x%08X", match.instruction, poolAddr))
                    log(string.format("      Pattern: %s", match.pattern))
                    log(string.format("      Calculation: %s", match.details.calculation))
                    
                    -- Found target!
                    results.success = true
                    results.foundAddress = expectedAddr
                    break
                end
            end
        end
        
        -- If we found the target, no need to continue with other pools
        if results.success then
            break
        end
    end
    
    log("\n📊 Search Summary:")
    log("Total matches found: " .. results.searchStats.totalMatches)
    log("THUMB instructions checked: " .. results.searchStats.thumbSearched)
    log("ARM instructions checked: " .. results.searchStats.armSearched)
    log("Success: " .. (results.success and "YES" or "NO"))
    
    if results.success then
        log("🎉 Real Universal Pattern Search SUCCESSFUL!")
        log("Target address found: " .. string.format("0x%08X", results.foundAddress))
    else
        log("❌ Real Universal Pattern Search failed to find target")
    end
    
    return results
end

-- Export the function
_G.realUniversalPatternSearch = realUniversalPatternSearch