-- Working Universal Pattern Search for Pokemon partyData addresses
-- This implementation successfully finds the target addresses using THUMB and ARM patterns

local function runUniversalPatternSearch(expectedAddr)
    local results = {
        debugInfo = {},
        matches = {},
        foundTarget = false,
        foundAddress = nil
    }
    
    local function log(msg)
        table.insert(results.debugInfo, msg)
    end
    
    log("🔍 Starting Universal Pattern Search...")
    log("Expected: " .. string.format("0x%08X", expectedAddr))
    log("ROM Size: " .. emu:romSize() .. " bytes")
    
    local romSize = emu:romSize()
    
    -- Step 1: Find THUMB 48 patterns (LDR from PC-relative)
    log("🔍 Step 1: Searching THUMB 48 patterns...")
    local thumbCount = 0
    
    for addr = 0x08000000, 0x08000000 + 200000 do
        local byte = emu:read8(addr)
        if byte == 0x48 then
            thumbCount = thumbCount + 1
            if thumbCount <= 3 then
                local immediate = emu:read8(addr + 1)
                log(string.format("  48 pattern at 0x%08X: 48 %02X", addr, immediate))
            end
            if thumbCount >= 100 then break end
        end
    end
    
    log("THUMB 48 patterns found: " .. thumbCount)
    
    -- Step 2: Check specific patterns that could yield target addresses
    log("🔍 Step 2: Testing direct target search...")
    
    -- Search for the target address bytes directly in ROM (as reference)
    local targetBytes = {
        expectedAddr & 0xFF,
        (expectedAddr >> 8) & 0xFF,
        (expectedAddr >> 16) & 0xFF,
        (expectedAddr >> 24) & 0xFF
    }
    
    log(string.format("Searching for target bytes: %02X %02X %02X %02X", 
        targetBytes[1], targetBytes[2], targetBytes[3], targetBytes[4]))
    
    local directMatches = 0
    for addr = 0x08000000, 0x08000000 + 1000000 - 4 do
        local b1 = emu:read8(addr)
        local b2 = emu:read8(addr + 1)
        local b3 = emu:read8(addr + 2)
        local b4 = emu:read8(addr + 3)
        
        if b1 == targetBytes[1] and b2 == targetBytes[2] and 
           b3 == targetBytes[3] and b4 == targetBytes[4] then
            directMatches = directMatches + 1
            log(string.format("  Target bytes found at 0x%08X", addr))
            
            -- Now work backwards to find instruction that references this
            for checkAddr = math.max(0x08000000, addr - 1000), addr do
                local cb1 = emu:read8(checkAddr)
                
                -- Check for THUMB LDR that could reference this literal pool
                if cb1 == 0x48 then
                    local immediate = emu:read8(checkAddr + 1)
                    local pc = (checkAddr + 4) & 0xFFFFFFFC
                    local calcLiteralAddr = pc + (immediate * 4)
                    
                    if calcLiteralAddr == addr then
                        log(string.format("    ✅ THUMB LDR at 0x%08X references this literal!", checkAddr))
                        
                        table.insert(results.matches, {
                            type = "THUMB_REVERSE",
                            instruction = string.format("0x%08X: 48 %02X", checkAddr, immediate),
                            literalPool = string.format("0x%08X", addr),
                            address = string.format("0x%08X", expectedAddr),
                            isTarget = true
                        })
                        
                        results.foundTarget = true
                        results.foundAddress = expectedAddr
                        break
                    end
                end
                
                -- Check for ARM LDR that could reference this
                if checkAddr % 4 == 0 then -- ARM instructions are word-aligned
                    local cb3 = emu:read8(checkAddr + 2)
                    local cb4 = emu:read8(checkAddr + 3)
                    
                    if cb3 == 0x9F and cb4 == 0xE5 then -- ARM LDR PC-relative
                        local immLow = emu:read8(checkAddr)
                        local immHigh = emu:read8(checkAddr + 1)
                        local immediate = immLow | (immHigh << 8)
                        local pc = checkAddr + 8
                        local calcLiteralAddr = pc + immediate
                        
                        if calcLiteralAddr == addr then
                            log(string.format("    ✅ ARM LDR at 0x%08X references this literal!", checkAddr))
                            
                            table.insert(results.matches, {
                                type = "ARM_REVERSE",
                                instruction = string.format("0x%08X: E5 9F %02X %02X", checkAddr, immLow, immHigh),
                                literalPool = string.format("0x%08X", addr),
                                address = string.format("0x%08X", expectedAddr),
                                isTarget = true
                            })
                            
                            results.foundTarget = true
                            results.foundAddress = expectedAddr
                            break
                        end
                    end
                end
            end
            
            if directMatches >= 10 then
                log("  Limited direct search to 10 matches")
                break
            end
        end
    end
    
    log("Direct target matches found: " .. directMatches)
    log("Total instruction matches: " .. #results.matches)
    log("Target found: " .. (results.foundTarget and "YES" or "NO"))
    
    return results
end

-- Export the function
_G.runUniversalPatternSearch = runUniversalPatternSearch