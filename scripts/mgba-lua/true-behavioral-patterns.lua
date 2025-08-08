-- TRUE Behavioral Universal Pattern Detection for Pokemon PartyData
-- This script implements behavioral analysis to discover partyData addresses
-- by analyzing ARM/THUMB instruction patterns WITHOUT knowing target addresses.

print("🔍 Starting TRUE Behavioral Universal Pattern Detection")

-- Get ROM information
local romSize = emu:romSize()
local romTitle = emu:read(0x08000000 + 0xA0, 12)
print(string.format("📱 ROM: %s (%d bytes)", romTitle, romSize))

-- Behavioral Pattern 1: Party Size Loop Detection (MOV r?, #6)
-- This detects code that loads the constant 6 (party size) into a register
function findPartySizeLoops()
    print("🔍 Searching for party size loops (MOV r?, #6)...")
    local matches = {}
    
    -- Search for MOV r0, #6 (ARM: 06 20 A0 E3)
    for addr = 0x08000000, 0x08000000 + math.min(romSize, 2000000) - 4, 4 do
        local b1 = emu:read8(addr)
        local b2 = emu:read8(addr + 1)
        local b3 = emu:read8(addr + 2)
        local b4 = emu:read8(addr + 3)
        
        -- MOV r0, #6 (ARM immediate): 06 20 A0 E3
        if b1 == 0x06 and b2 == 0x20 and b3 == 0xA0 and b4 == 0xE3 then
            print(string.format("   Found MOV r0, #6 at 0x%08X", addr))
            
            -- Look for loop structure nearby (conditional branches)
            for i = 1, 50 do
                local checkAddr = addr + i * 4
                if checkAddr + 3 >= 0x08000000 + romSize then break end
                
                local cb4 = emu:read8(checkAddr + 3)
                -- Look for conditional ARM instructions (condition != 0xE)
                if (cb4 & 0xF0) ~= 0xE0 then
                    print(string.format("   Found conditional instruction at +%d (0x%08X)", i*4, checkAddr))
                    
                    -- Look for LDR literal instructions nearby
                    for j = -10, 20 do
                        local ldrAddr = addr + j * 4
                        if ldrAddr < 0x08000000 or ldrAddr + 3 >= 0x08000000 + romSize then goto continue end
                        
                        local lb3 = emu:read8(ldrAddr + 2)
                        local lb4 = emu:read8(ldrAddr + 3)
                        
                        -- ARM LDR literal: ?? ?? 9F E5
                        if lb3 == 0x9F and lb4 == 0xE5 then
                            local immediate = emu:read8(ldrAddr) | (emu:read8(ldrAddr + 1) << 8)
                            local pc = ldrAddr + 8
                            local literalAddr = pc + immediate
                            
                            if literalAddr + 3 < 0x08000000 + romSize then
                                local targetAddr = emu:read8(literalAddr) | 
                                                 (emu:read8(literalAddr + 1) << 8) |
                                                 (emu:read8(literalAddr + 2) << 16) |
                                                 (emu:read8(literalAddr + 3) << 24)
                                
                                -- Check if this is in GBA RAM range
                                if targetAddr >= 0x02000000 and targetAddr <= 0x02040000 and targetAddr % 4 == 0 then
                                    print(string.format("   🎯 FOUND PARTY ADDRESS: 0x%08X", targetAddr))
                                    print(string.format("      Source: MOV #6 + loop at 0x%08X", addr))
                                    print(string.format("      LDR literal at 0x%08X -> 0x%08X", ldrAddr, literalAddr))
                                    table.insert(matches, {
                                        address = targetAddr,
                                        pattern = "party_size_loop",
                                        confidence = "high",
                                        sourceAddr = addr,
                                        ldrAddr = ldrAddr
                                    })
                                end
                            end
                        end
                        ::continue::
                    end
                    break
                end
            end
        end
        
        -- Also check THUMB MOV r?, #6 (06 20)
        if addr % 2 == 0 and b1 == 0x06 and b2 == 0x20 then
            print(string.format("   Found THUMB MOV r0, #6 at 0x%08X", addr))
            
            -- Look for THUMB LDR literal nearby
            for j = -10, 20 do
                local thumbAddr = addr + j * 2
                if thumbAddr < 0x08000000 or thumbAddr + 1 >= 0x08000000 + romSize then goto thumbcontinue end
                
                local tb1 = emu:read8(thumbAddr)
                
                -- THUMB LDR literal: 48 ?? (LDR r0-r7, [PC, #imm])
                if (tb1 & 0xF8) == 0x48 then
                    local immediate = emu:read8(thumbAddr + 1)
                    local pc = ((thumbAddr + 4) & ~3) -- THUMB PC alignment
                    local literalAddr = pc + (immediate * 4)
                    
                    if literalAddr + 3 < 0x08000000 + romSize then
                        local targetAddr = emu:read8(literalAddr) | 
                                         (emu:read8(literalAddr + 1) << 8) |
                                         (emu:read8(literalAddr + 2) << 16) |
                                         (emu:read8(literalAddr + 3) << 24)
                        
                        if targetAddr >= 0x02000000 and targetAddr <= 0x02040000 and targetAddr % 4 == 0 then
                            print(string.format("   🎯 FOUND PARTY ADDRESS: 0x%08X", targetAddr))
                            print(string.format("      Source: THUMB MOV #6 + LDR at 0x%08X", addr))
                            table.insert(matches, {
                                address = targetAddr,
                                pattern = "thumb_party_size_loop",
                                confidence = "high",
                                sourceAddr = addr,
                                ldrAddr = thumbAddr
                            })
                        end
                    end
                end
                ::thumbcontinue::
            end
        end
    end
    
    return matches
end

-- Behavioral Pattern 2: Pokemon Size Multiplication Detection
-- This detects multiplication by 100 (Emerald) or 104 (Quetzal) indicating Pokemon slot calculations
function findPokemonSizeCalculations()
    print("🔍 Searching for Pokemon size calculations...")
    local matches = {}
    
    -- Search for immediate values 100 (0x64) and 104 (0x68)
    for addr = 0x08000000, 0x08000000 + math.min(romSize, 2000000) - 4, 4 do
        local b1 = emu:read8(addr)
        local b2 = emu:read8(addr + 1)
        
        local isEmerald = (b1 == 0x64 and b2 == 0x00) -- 100 bytes
        local isQuetzal = (b1 == 0x68 and b2 == 0x00) -- 104 bytes
        
        if isEmerald or isQuetzal then
            local sizeType = isEmerald and "Emerald (100)" or "Quetzal (104)"
            print(string.format("   Found Pokemon size %s at 0x%08X", sizeType, addr))
            
            -- Look for multiplication or addition instructions nearby
            for i = -2, 2 do
                local instAddr = addr + i * 4
                if instAddr < 0x08000000 or instAddr + 3 >= 0x08000000 + romSize then goto sizecontinue end
                
                local ib3 = emu:read8(instAddr + 2)
                local ib4 = emu:read8(instAddr + 3)
                
                -- Look for ARM MUL or ADD instructions
                if (ib4 & 0x0F) == 0x0E and (ib3 & 0xF0) == 0x00 then -- MUL
                    print(string.format("   Found MUL instruction at 0x%08X", instAddr))
                elseif (ib4 & 0x0F) == 0xE2 and (ib3 & 0xF0) == 0x80 then -- ADD immediate
                    print(string.format("   Found ADD instruction at 0x%08X", instAddr))
                end
                
                -- Look for LDR literal instructions that load base address
                for j = -10, 10 do
                    local ldrAddr = instAddr + j * 4
                    if ldrAddr < 0x08000000 or ldrAddr + 3 >= 0x08000000 + romSize then goto ldrskip end
                    
                    local lb3 = emu:read8(ldrAddr + 2)
                    local lb4 = emu:read8(ldrAddr + 3)
                    
                    if lb3 == 0x9F and lb4 == 0xE5 then
                        local immediate = emu:read8(ldrAddr) | (emu:read8(ldrAddr + 1) << 8)
                        local pc = ldrAddr + 8
                        local literalAddr = pc + immediate
                        
                        if literalAddr + 3 < 0x08000000 + romSize then
                            local targetAddr = emu:read8(literalAddr) | 
                                             (emu:read8(literalAddr + 1) << 8) |
                                             (emu:read8(literalAddr + 2) << 16) |
                                             (emu:read8(literalAddr + 3) << 24)
                            
                            if targetAddr >= 0x02000000 and targetAddr <= 0x02040000 and targetAddr % 4 == 0 then
                                print(string.format("   🎯 FOUND PARTY ADDRESS: 0x%08X", targetAddr))
                                print(string.format("      Source: Pokemon size calc (%s) at 0x%08X", sizeType, addr))
                                table.insert(matches, {
                                    address = targetAddr,
                                    pattern = isEmerald and "pokemon_size_calc_emerald" or "pokemon_size_calc_quetzal",
                                    confidence = "high",
                                    sourceAddr = addr,
                                    ldrAddr = ldrAddr,
                                    sizeType = sizeType
                                })
                            end
                        end
                    end
                    ::ldrskip::
                end
                ::sizecontinue::
            end
        end
    end
    
    return matches
end

-- Behavioral Pattern 3: Party Bounds Checking
-- This detects CMP r?, #5 instructions that validate party slot indices
function findPartyBoundsChecking()
    print("🔍 Searching for party bounds checking (CMP r?, #5)...")
    local matches = {}
    
    -- Search for CMP r?, #5 patterns
    for addr = 0x08000000, 0x08000000 + math.min(romSize, 2000000) - 4, 4 do
        -- ARM CMP r0, #5: 05 00 50 E3
        local b1 = emu:read8(addr)
        local b2 = emu:read8(addr + 1)
        local b3 = emu:read8(addr + 2)
        local b4 = emu:read8(addr + 3)
        
        if b1 == 0x05 and b2 == 0x00 and b3 == 0x50 and b4 == 0xE3 then
            print(string.format("   Found ARM CMP r0, #5 at 0x%08X", addr))
            
            -- Look for conditional instructions after CMP
            for i = 1, 5 do
                local checkAddr = addr + i * 4
                if checkAddr + 3 >= 0x08000000 + romSize then break end
                
                local cb4 = emu:read8(checkAddr + 3)
                if (cb4 & 0xF0) ~= 0xE0 then -- Conditional instruction
                    print(string.format("   Found conditional after CMP at +%d", i*4))
                    
                    -- Look for LDR literal nearby
                    for j = -10, 10 do
                        local ldrAddr = addr + j * 4
                        if ldrAddr < 0x08000000 or ldrAddr + 3 >= 0x08000000 + romSize then goto boundscontinue end
                        
                        local lb3 = emu:read8(ldrAddr + 2)
                        local lb4 = emu:read8(ldrAddr + 3)
                        
                        if lb3 == 0x9F and lb4 == 0xE5 then
                            local immediate = emu:read8(ldrAddr) | (emu:read8(ldrAddr + 1) << 8)
                            local pc = ldrAddr + 8
                            local literalAddr = pc + immediate
                            
                            if literalAddr + 3 < 0x08000000 + romSize then
                                local targetAddr = emu:read8(literalAddr) | 
                                                 (emu:read8(literalAddr + 1) << 8) |
                                                 (emu:read8(literalAddr + 2) << 16) |
                                                 (emu:read8(literalAddr + 3) << 24)
                                
                                if targetAddr >= 0x02000000 and targetAddr <= 0x02040000 and targetAddr % 4 == 0 then
                                    print(string.format("   🎯 FOUND PARTY ADDRESS: 0x%08X", targetAddr))
                                    print(string.format("      Source: Party bounds check at 0x%08X", addr))
                                    table.insert(matches, {
                                        address = targetAddr,
                                        pattern = "party_bounds_check",
                                        confidence = "medium",
                                        sourceAddr = addr,
                                        ldrAddr = ldrAddr
                                    })
                                end
                            end
                        end
                        ::boundscontinue::
                    end
                    break
                end
            end
        end
        
        -- Also check THUMB CMP r?, #5 (05 28)
        if addr % 2 == 0 and b1 == 0x05 and b2 == 0x28 then
            print(string.format("   Found THUMB CMP r0, #5 at 0x%08X", addr))
            
            -- Look for THUMB conditional branches nearby
            for i = 1, 10 do
                local checkAddr = addr + i * 2
                if checkAddr >= 0x08000000 + romSize then break end
                
                local cb1 = emu:read8(checkAddr)
                if (cb1 & 0xF0) == 0xD0 and (cb1 & 0x0F) ~= 0x0F then -- Conditional branch
                    print(string.format("   Found THUMB conditional branch at +%d", i*2))
                    
                    -- Look for THUMB LDR literal nearby
                    for j = -10, 10 do
                        local thumbAddr = addr + j * 2
                        if thumbAddr < 0x08000000 or thumbAddr + 1 >= 0x08000000 + romSize then goto thumbboundscontinue end
                        
                        local tb1 = emu:read8(thumbAddr)
                        if (tb1 & 0xF8) == 0x48 then
                            local immediate = emu:read8(thumbAddr + 1)
                            local pc = ((thumbAddr + 4) & ~3)
                            local literalAddr = pc + (immediate * 4)
                            
                            if literalAddr + 3 < 0x08000000 + romSize then
                                local targetAddr = emu:read8(literalAddr) | 
                                                 (emu:read8(literalAddr + 1) << 8) |
                                                 (emu:read8(literalAddr + 2) << 16) |
                                                 (emu:read8(literalAddr + 3) << 24)
                                
                                if targetAddr >= 0x02000000 and targetAddr <= 0x02040000 and targetAddr % 4 == 0 then
                                    print(string.format("   🎯 FOUND PARTY ADDRESS: 0x%08X", targetAddr))
                                    print(string.format("      Source: THUMB party bounds check at 0x%08X", addr))
                                    table.insert(matches, {
                                        address = targetAddr,
                                        pattern = "thumb_party_bounds_check",
                                        confidence = "medium",
                                        sourceAddr = addr,
                                        ldrAddr = thumbAddr
                                    })
                                end
                            end
                        end
                        ::thumbboundscontinue::
                    end
                    break
                end
            end
        end
    end
    
    return matches
end

-- Main execution
print("🎯 Executing TRUE Behavioral Pattern Analysis...")

local allMatches = {}

-- Run all behavioral pattern searches
local partySizeMatches = findPartySizeLoops()
local pokemonSizeMatches = findPokemonSizeCalculations()
local boundsCheckMatches = findPartyBoundsChecking()

-- Combine all matches
for _, match in ipairs(partySizeMatches) do
    table.insert(allMatches, match)
end
for _, match in ipairs(pokemonSizeMatches) do
    table.insert(allMatches, match)
end
for _, match in ipairs(boundsCheckMatches) do
    table.insert(allMatches, match)
end

-- Analyze results
print(string.format("\n📊 BEHAVIORAL ANALYSIS RESULTS:"))
print(string.format("   Total matches found: %d", #allMatches))

if #allMatches > 0 then
    -- Group by address to find consensus
    local addressCounts = {}
    for _, match in ipairs(allMatches) do
        local addr = match.address
        if not addressCounts[addr] then
            addressCounts[addr] = {count = 0, patterns = {}, bestConfidence = "low"}
        end
        addressCounts[addr].count = addressCounts[addr].count + 1
        table.insert(addressCounts[addr].patterns, match.pattern)
        if match.confidence == "high" then
            addressCounts[addr].bestConfidence = "high"
        elseif match.confidence == "medium" and addressCounts[addr].bestConfidence == "low" then
            addressCounts[addr].bestConfidence = "medium"
        end
    end
    
    -- Find the best candidate
    local bestAddr = nil
    local bestScore = 0
    
    for addr, data in pairs(addressCounts) do
        local score = data.count * (data.bestConfidence == "high" and 3 or data.bestConfidence == "medium" and 2 or 1)
        print(string.format("   Candidate: 0x%08X (score: %d, patterns: %d, confidence: %s)", 
                          addr, score, data.count, data.bestConfidence))
        
        if score > bestScore then
            bestScore = score
            bestAddr = addr
        end
    end
    
    if bestAddr then
        print(string.format("\n🎯 BEST CANDIDATE: 0x%08X", bestAddr))
        print(string.format("   Score: %d", bestScore))
        print(string.format("   Supporting patterns: %d", addressCounts[bestAddr].count))
        print(string.format("   Confidence: %s", addressCounts[bestAddr].bestConfidence))
        
        -- Check against known addresses
        if bestAddr == 0x020244EC then
            print("   ✅ PERFECT MATCH: This is the known Emerald partyData address!")
        elseif bestAddr == 0x020235B8 then
            print("   ✅ PERFECT MATCH: This is the known Quetzal partyData address!")
        else
            print("   ⚠️  NEW DISCOVERY: This is a different address than expected")
        end
    end
else
    print("   ❌ No behavioral patterns found")
    print("   💡 This may indicate:")
    print("      - ROM region scanned doesn't contain party access code")
    print("      - Patterns need refinement for this ROM variant") 
    print("      - Code uses different instruction sequences")
end

print("\n✅ TRUE Behavioral Analysis Complete!")
return allMatches