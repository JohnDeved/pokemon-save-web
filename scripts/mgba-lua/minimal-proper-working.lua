-- MINIMAL Working Proper Pattern Implementation
-- Based on existing working scripts but implements the CORRECT approach

print("PROPER_PATTERN_START")

local romSize = emu:romSize()
local romTitle = emu:read(0x08000000 + 0xA0, 12)
print("ROM:" .. romTitle .. ":" .. romSize)

-- Determine game type and target address
local targetAddr = 0x020244EC  -- Default Emerald
local gameType = "EMERALD"

if romSize > 20000000 then
    targetAddr = 0x020235B8  -- Quetzal
    gameType = "QUETZAL"
end

print("GAME:" .. gameType)
print("TARGET:" .. string.format("0x%08X", targetAddr))

-- Convert target to bytes
local b1 = targetAddr & 0xFF
local b2 = (targetAddr >> 8) & 0xFF  
local b3 = (targetAddr >> 16) & 0xFF
local b4 = (targetAddr >> 24) & 0xFF

print("TARGET_BYTES:" .. string.format("%02X %02X %02X %02X", b1, b2, b3, b4))

-- Search for literal pools (limit to 1MB for speed)
local literalCount = 0
local foundPools = {}

for addr = 0x08000000, 0x08000000 + 1000000 - 4, 4 do
    local rb1 = emu:read8(addr)
    local rb2 = emu:read8(addr + 1)
    local rb3 = emu:read8(addr + 2)
    local rb4 = emu:read8(addr + 3)
    
    if rb1 == b1 and rb2 == b2 and rb3 == b3 and rb4 == b4 then
        literalCount = literalCount + 1
        if literalCount <= 3 then
            print("POOL:" .. string.format("0x%08X", addr))
            table.insert(foundPools, addr)
        end
    end
end

print("LITERAL_POOLS:" .. literalCount)

-- For each pool, look for ARM/THUMB instructions that reference it
local armCount = 0
local thumbCount = 0

for _, poolAddr in ipairs(foundPools) do
    print("ANALYZING_POOL:" .. string.format("0x%08X", poolAddr))
    
    -- Search for ARM LDR (E5 9F pattern) in 400 bytes before pool
    for instAddr = math.max(0x08000000, poolAddr - 400), poolAddr - 4, 4 do
        local i3 = emu:read8(instAddr + 2)
        local i4 = emu:read8(instAddr + 3)
        
        if i3 == 0x9F and i4 == 0xE5 then
            local i1 = emu:read8(instAddr)
            local i2 = emu:read8(instAddr + 1)
            local immediate = i1 | (i2 << 8)
            local pc = instAddr + 8
            
            if pc + immediate == poolAddr then
                armCount = armCount + 1
                print("ARM_LDR:" .. string.format("0x%08X:E5 9F %02X %02X", instAddr, i1, i2))
                
                -- Get context bytes around instruction
                local context = ""
                for j = -6, 9 do
                    if instAddr + j >= 0x08000000 and instAddr + j < 0x08000000 + romSize then
                        context = context .. string.format("%02X ", emu:read8(instAddr + j))
                    end
                end
                print("ARM_CONTEXT:" .. context)
                break
            end
        end
    end
    
    -- Search for THUMB LDR (48 pattern) in 200 bytes before pool
    for instAddr = math.max(0x08000000, poolAddr - 200), poolAddr - 2, 2 do
        local t1 = emu:read8(instAddr)
        local t2 = emu:read8(instAddr + 1)
        
        if (t1 & 0xF8) == 0x48 then
            local immediate = t2
            local pc = ((instAddr + 4) & ~3)
            
            if pc + (immediate * 4) == poolAddr then
                thumbCount = thumbCount + 1
                print("THUMB_LDR:" .. string.format("0x%08X:%02X %02X", instAddr, t1, t2))
                
                -- Get context bytes around instruction
                local context = ""
                for j = -4, 7 do
                    if instAddr + j >= 0x08000000 and instAddr + j < 0x08000000 + romSize then
                        context = context .. string.format("%02X ", emu:read8(instAddr + j))
                    end
                end
                print("THUMB_CONTEXT:" .. context)
                break
            end
        end
    end
end

print("ARM_INSTRUCTIONS:" .. armCount)
print("THUMB_INSTRUCTIONS:" .. thumbCount)

if armCount > 0 or thumbCount > 0 then
    print("SUCCESS:Found instruction patterns that reference target address")
else
    print("FAILED:No instruction patterns found")
end

print("PROPER_PATTERN_COMPLETE")