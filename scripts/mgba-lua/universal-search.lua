-- Universal Pattern Search for mGBA Lua API
-- Detects partyData addresses using THUMB and ARM instruction patterns

local function universalPatternSearch(expectedAddr)
    local matches = {}
    local found = false
    local foundAddr = nil
    local searchCount = 0
    
    -- Helper function to read 32-bit little-endian address
    local function read32LE(addr)
        local b1 = emu:read8(addr)
        local b2 = emu:read8(addr + 1)
        local b3 = emu:read8(addr + 2)
        local b4 = emu:read8(addr + 3)
        return b1 + b2 * 256 + b3 * 65536 + b4 * 16777216
    end
    
    local romSize = emu:romSize()
    local searchLimit = math.min(romSize, 2000000) -- 2MB limit
    
    -- Method 1: THUMB Pattern - 48 ?? 68 ?? 30 ??
    for addr = 0x08000000, 0x08000000 + searchLimit - 6, 2 do
        local b1 = emu:read8(addr)
        local b3 = emu:read8(addr + 2)
        local b5 = emu:read8(addr + 4)
        
        if b1 == 0x48 and b3 == 0x68 and b5 == 0x30 then
            searchCount = searchCount + 1
            
            -- Extract immediate from THUMB LDR instruction
            local b2 = emu:read8(addr + 1)
            local immediate = b2
            
            -- THUMB PC calculation: PC = (current + 4) & ~3
            local pc = math.floor((addr + 4) / 4) * 4
            local literalAddr = pc + immediate * 4
            
            -- Validate literal address is within ROM
            if literalAddr >= 0x08000000 and literalAddr < 0x08000000 + romSize then
                local address = read32LE(literalAddr)
                
                -- Validate address is in RAM range
                if address >= 0x02000000 and address < 0x04000000 then
                    local match = {
                        type = "thumb",
                        pattern = string.format("0x%08X", addr),
                        address = string.format("0x%08X", address),
                        isTarget = (address == expectedAddr)
                    }
                    
                    table.insert(matches, match)
                    
                    if address == expectedAddr then
                        found = true
                        foundAddr = address
                        break
                    end
                end
            end
            
            -- Limit search to avoid timeout
            if searchCount >= 15 then
                break
            end
        end
    end
    
    -- Method 2: ARM Patterns (if THUMB didn't find target)
    if not found then
        searchCount = 0
        
        for addr = 0x08000000, 0x08000000 + searchLimit - 12, 4 do
            local b1 = emu:read8(addr)
            local b4 = emu:read8(addr + 3)
            local b5 = emu:read8(addr + 4)
            local b6 = emu:read8(addr + 5)
            local b9 = emu:read8(addr + 8)
            local b10 = emu:read8(addr + 9)
            
            -- ARM Pattern: E0 ?? ?? 64/68 E5 9F ?? ?? E0 8? ?? ??
            if b1 == 0xE0 and (b4 == 0x64 or b4 == 0x68) and 
               b5 == 0xE5 and b6 == 0x9F and 
               b9 == 0xE0 and (b10 >= 0x80 and b10 <= 0x8F) then
                
                searchCount = searchCount + 1
                
                -- Extract immediate from LDR instruction
                local immLow = emu:read8(addr + 6)
                local immHigh = emu:read8(addr + 7)
                local immediate = immLow + immHigh * 256
                
                -- ARM LDR PC-relative: PC = instruction + 8
                local pc = addr + 8
                local literalAddr = pc + immediate
                
                -- Validate literal address is within ROM
                if literalAddr >= 0x08000000 and literalAddr < 0x08000000 + romSize then
                    local address = read32LE(literalAddr)
                    
                    -- Validate address is in RAM range
                    if address >= 0x02000000 and address < 0x04000000 then
                        local match = {
                            type = "arm",
                            pattern = string.format("0x%08X", addr),
                            address = string.format("0x%08X", address),
                            isTarget = (address == expectedAddr)
                        }
                        
                        table.insert(matches, match)
                        
                        if address == expectedAddr then
                            found = true
                            foundAddr = address
                            break
                        end
                    end
                end
                
                -- Limit search to avoid timeout
                if searchCount >= 15 then
                    break
                end
            end
        end
    end
    
    return {
        success = found,
        foundAddress = foundAddr,
        method = found and (foundAddr and "universal_pattern" or "none") or "none",
        matches = matches,
        totalSearched = searchCount
    }
end

-- Export the function
_G.universalPatternSearch = universalPatternSearch