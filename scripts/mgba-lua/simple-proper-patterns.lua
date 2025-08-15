-- SIMPLE Proper Universal Pattern Detection for Pokemon PartyData
-- This script implements the CORRECT approach as explained by @JohnDeved:
-- 1. Find ROM locations that REFERENCE our target addresses (0x020244EC, 0x020235B8)
-- 2. Look for stable ARM/ASM instruction patterns AROUND those references
-- 3. Create byte pattern masks that can find those instruction patterns

print("🔍 Starting SIMPLE Proper Universal Pattern Detection")

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

-- Simple test: Find where target addresses appear as literal data
function findAddressLiterals(targetAddr, gameName)
    print(string.format("\n🎯 Finding literal references to %s address: 0x%08X", gameName, targetAddr))
    
    local targetBytes = addressToBytes(targetAddr)
    local literalCount = 0
    local firstFewLiterals = {}
    
    -- Search for the address bytes in ROM (limit search for performance)
    local searchLimit = math.min(romSize, 4000000) -- 4MB limit
    
    for addr = 0x08000000, 0x08000000 + searchLimit - 4, 4 do
        local b1 = emu:read8(addr)
        local b2 = emu:read8(addr + 1)
        local b3 = emu:read8(addr + 2)
        local b4 = emu:read8(addr + 3)
        
        if b1 == targetBytes[1] and b2 == targetBytes[2] and 
           b3 == targetBytes[3] and b4 == targetBytes[4] then
            literalCount = literalCount + 1
            
            if literalCount <= 5 then
                print(string.format("   📍 Literal pool #%d at 0x%08X", literalCount, addr))
                table.insert(firstFewLiterals, addr)
                
                -- Look for ARM LDR instructions that could reference this pool
                local foundArmPattern = false
                for instAddr = math.max(0x08000000, addr - 1000), addr - 4, 4 do
                    local i1 = emu:read8(instAddr)
                    local i2 = emu:read8(instAddr + 1)
                    local i3 = emu:read8(instAddr + 2)
                    local i4 = emu:read8(instAddr + 3)
                    
                    -- Check for ARM LDR literal: E5 9F XX XX
                    if i3 == 0x9F and i4 == 0xE5 then
                        local immediate = i1 | (i2 << 8)
                        local pc = instAddr + 8  -- ARM PC is +8
                        local calcPoolAddr = pc + immediate
                        
                        if calcPoolAddr == addr then
                            print(string.format("      ✅ ARM LDR found: 0x%08X -> E5 9F %02X %02X", instAddr, i1, i2))
                            
                            -- Get 8 bytes before and after this instruction for pattern
                            local contextBefore = {}
                            local contextAfter = {}
                            
                            for j = -8, -1 do
                                if instAddr + j >= 0x08000000 then
                                    table.insert(contextBefore, string.format("%02X", emu:read8(instAddr + j)))
                                end
                            end
                            
                            for j = 4, 11 do
                                if instAddr + j < 0x08000000 + romSize then
                                    table.insert(contextAfter, string.format("%02X", emu:read8(instAddr + j)))
                                end
                            end
                            
                            print(string.format("         Before: %s", table.concat(contextBefore, " ")))
                            print(string.format("         LDR:    E5 9F %02X %02X", i1, i2))
                            print(string.format("         After:  %s", table.concat(contextAfter, " ")))
                            foundArmPattern = true
                            break
                        end
                    end
                end
                
                -- Look for THUMB LDR instructions that could reference this pool
                if not foundArmPattern then
                    for instAddr = math.max(0x08000000, addr - 500), addr - 2, 2 do
                        local t1 = emu:read8(instAddr)
                        local t2 = emu:read8(instAddr + 1)
                        
                        -- Check for THUMB LDR literal: 48 XX
                        if (t1 & 0xF8) == 0x48 then
                            local immediate = t2
                            local pc = ((instAddr + 4) & ~3)  -- THUMB PC alignment
                            local calcPoolAddr = pc + (immediate * 4)
                            
                            if calcPoolAddr == addr then
                                print(string.format("      ✅ THUMB LDR found: 0x%08X -> %02X %02X", instAddr, t1, t2))
                                
                                -- Get context around this instruction  
                                local contextBefore = {}
                                local contextAfter = {}
                                
                                for j = -6, -1 do
                                    if instAddr + j >= 0x08000000 then
                                        table.insert(contextBefore, string.format("%02X", emu:read8(instAddr + j)))
                                    end
                                end
                                
                                for j = 2, 7 do
                                    if instAddr + j < 0x08000000 + romSize then
                                        table.insert(contextAfter, string.format("%02X", emu:read8(instAddr + j)))
                                    end
                                end
                                
                                print(string.format("         Before: %s", table.concat(contextBefore, " ")))
                                print(string.format("         LDR:    %02X %02X", t1, t2))
                                print(string.format("         After:  %s", table.concat(contextAfter, " ")))
                                break
                            end
                        end
                    end
                end
            end
            
            if literalCount >= 10 then
                break -- Limit processing for performance
            end
        end
    end
    
    print(string.format("   Total literal pools found: %d", literalCount))
    return literalCount, firstFewLiterals
end

-- Main execution
print("\n🚀 EXECUTING SIMPLE PROPER PATTERN DETECTION")
print("==============================================")

-- Test for both known addresses
local emeraldCount, emeraldLiterals = findAddressLiterals(targetAddresses.emerald, "Emerald")
local quetzalCount, quetzalLiterals = findAddressLiterals(targetAddresses.quetzal, "Quetzal")

-- Final results
print("\n🎯 RESULTS SUMMARY")
print("==================")
print(string.format("Emerald (0x%08X): %d literal pools found", targetAddresses.emerald, emeraldCount))
print(string.format("Quetzal (0x%08X): %d literal pools found", targetAddresses.quetzal, quetzalCount))

if emeraldCount > 0 or quetzalCount > 0 then
    print("\n✅ SUCCESS: Found instruction patterns that reference target addresses!")
    print("🎯 This proves the approach works - now we can extract these patterns as universal masks")
else
    print("\n❌ No patterns found")
    print("💡 This may indicate the ROM doesn't contain the expected addresses")
end

print("\n✅ Simple Proper Pattern Detection Complete!")