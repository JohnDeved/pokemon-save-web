-- Simple diagnostic script for pattern testing
-- Just searches for individual bytes to verify search functionality

local function simpleDiagnostic()
    local result = {
        romSize = emu:romSize(),
        romTitle = emu:getGameTitle(),
        firstBytes = {},
        bytePatterns = {},
        thumbComponents = {}
    }
    
    -- Read first 16 bytes for verification
    for i = 0, 15 do
        result.firstBytes[i+1] = emu:read8(0x08000000 + i)
    end
    
    -- Search for individual pattern components in first 100KB
    local searchLimit = 100000
    local counts = {
        byte48 = 0,
        byte68 = 0,
        byte30 = 0,
        byteE0 = 0,
        byteE5 = 0,
        byte9F = 0
    }
    
    for addr = 0x08000000, 0x08000000 + searchLimit do
        local byte = emu:read8(addr)
        
        if byte == 0x48 then
            counts.byte48 = counts.byte48 + 1
            if counts.byte48 <= 3 then
                table.insert(result.bytePatterns, string.format("0x48 at 0x%08X", addr))
            end
        elseif byte == 0x68 then
            counts.byte68 = counts.byte68 + 1
        elseif byte == 0x30 then
            counts.byte30 = counts.byte30 + 1
        elseif byte == 0xE0 then
            counts.byteE0 = counts.byteE0 + 1
        elseif byte == 0xE5 then
            counts.byteE5 = counts.byteE5 + 1
        elseif byte == 0x9F then
            counts.byte9F = counts.byte9F + 1
        end
    end
    
    result.counts = counts
    
    -- Look for THUMB pattern combinations in a small range
    local thumbPatterns = 0
    for addr = 0x08000000, 0x08000000 + 50000 - 6, 2 do
        local b1 = emu:read8(addr)
        local b3 = emu:read8(addr + 2)
        local b5 = emu:read8(addr + 4)
        
        if b1 == 0x48 and b3 == 0x68 and b5 == 0x30 then
            thumbPatterns = thumbPatterns + 1
            if thumbPatterns <= 5 then
                table.insert(result.thumbComponents, string.format("THUMB at 0x%08X", addr))
            end
        end
    end
    
    result.thumbPatterns = thumbPatterns
    result.searchLimit = searchLimit
    
    return result
end

-- Export the function
_G.simpleDiagnostic = simpleDiagnostic