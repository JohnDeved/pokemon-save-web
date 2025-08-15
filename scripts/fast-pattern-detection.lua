-- FAST Real ROM Universal Pattern Detection
-- Optimized for quick results with limited search scope

print("🚀 FAST Real ROM Pattern Detection")
print("==================================")

-- Target addresses
local TARGET_ADDRESSES = {
    emerald = 0x020244EC,
    quetzal = 0x020235B8
}

-- Get ROM info
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
    print("❌ Unknown ROM")
    return
end

print(string.format("🎯 Game: %s, Target: 0x%08X", gameType, targetAddr))

-- Convert address to bytes
local targetBytes = {
    targetAddr & 0xFF,
    (targetAddr >> 8) & 0xFF,
    (targetAddr >> 16) & 0xFF,
    (targetAddr >> 24) & 0xFF
}

print(string.format("🔍 Looking for bytes: %02X %02X %02X %02X", 
    targetBytes[1], targetBytes[2], targetBytes[3], targetBytes[4]))

-- FAST search - only first 2MB
local pools = {}
local maxSearch = math.min(romSize, 2 * 1024 * 1024)

print(string.format("📊 Searching %d bytes...", maxSearch))

for addr = 0x08000000, 0x08000000 + maxSearch - 4, 4 do
    local b1, b2, b3, b4 = emu:read8(addr), emu:read8(addr+1), emu:read8(addr+2), emu:read8(addr+3)
    
    if b1 == targetBytes[1] and b2 == targetBytes[2] and 
       b3 == targetBytes[3] and b4 == targetBytes[4] then
        table.insert(pools, addr)
        print(string.format("   📍 Pool #%d at 0x%08X", #pools, addr))
        
        if #pools >= 3 then
            print("   ... (limiting to first 3 pools)")
            break
        end
    end
end

print(string.format("📊 Found %d literal pools", #pools))

if #pools == 0 then
    print("❌ No pools found - may need larger search or different ROM")
    return
end

-- Find instruction references (FAST - limited scope)
print("\n🔍 Finding instruction references...")
local references = {}

for i, poolAddr in ipairs(pools) do
    print(string.format("   Checking pool %d at 0x%08X", i, poolAddr))
    
    -- ARM LDR search (limited to 1KB back)
    for instAddr = math.max(0x08000000, poolAddr - 1024), poolAddr - 4, 4 do
        local i1, i2, i3, i4 = emu:read8(instAddr), emu:read8(instAddr+1), emu:read8(instAddr+2), emu:read8(instAddr+3)
        
        if i3 == 0x9F and i4 == 0xE5 then
            local immediate = i1 | (i2 << 8)
            local pc = instAddr + 8
            if pc + immediate == poolAddr then
                print(string.format("      ✅ ARM LDR at 0x%08X", instAddr))
                
                -- Get minimal context (8 bytes each side)
                local context = {}
                for j = -8, 11 do
                    local addr = instAddr + j
                    if addr >= 0x08000000 and addr < 0x08000000 + romSize then
                        table.insert(context, emu:read8(addr))
                    else
                        table.insert(context, 0)
                    end
                end
                
                table.insert(references, {
                    type = "ARM_LDR",
                    addr = instAddr,
                    context = context
                })
                
                if #references >= 5 then break end
            end
        end
    end
    
    -- THUMB LDR search (limited to 500 bytes back)
    for instAddr = math.max(0x08000000, poolAddr - 500), poolAddr - 2, 2 do
        local t1, t2 = emu:read8(instAddr), emu:read8(instAddr+1)
        
        if (t1 & 0xF8) == 0x48 then
            local immediate = t2
            local pc = ((instAddr + 4) & ~3)
            if pc + (immediate * 4) == poolAddr then
                print(string.format("      ✅ THUMB LDR at 0x%08X", instAddr))
                
                -- Get minimal context
                local context = {}
                for j = -6, 9 do
                    local addr = instAddr + j
                    if addr >= 0x08000000 and addr < 0x08000000 + romSize then
                        table.insert(context, emu:read8(addr))
                    else
                        table.insert(context, 0)
                    end
                end
                
                table.insert(references, {
                    type = "THUMB_LDR",
                    addr = instAddr,
                    context = context
                })
                
                if #references >= 5 then break end
            end
        end
    end
    
    if #references >= 5 then break end
end

print(string.format("📊 Found %d instruction references", #references))

-- Generate patterns
if #references > 0 then
    print("\n🛠️  GENERATING PATTERNS")
    print("=======================")
    
    for i, ref in ipairs(references) do
        local context = ref.context
        local midpoint = math.floor(#context / 2) + 1
        
        print(string.format("\nPattern %d (%s at 0x%08X):", i, ref.type, ref.addr))
        
        local bytes = {}
        for j = 1, #context do
            table.insert(bytes, string.format("%02X", context[j]))
        end
        
        -- Show context around instruction
        if ref.type == "ARM_LDR" then
            -- Before ARM (4 bytes)
            local before = {}
            for j = midpoint - 4, midpoint - 1 do
                if j > 0 and j <= #context then
                    table.insert(before, bytes[j])
                end
            end
            
            -- After ARM (4 bytes)
            local after = {}
            for j = midpoint + 4, midpoint + 7 do
                if j > 0 and j <= #context then
                    table.insert(after, bytes[j])
                end
            end
            
            print(string.format("   Pattern: %s E5 9F ?? ?? %s", 
                table.concat(before, " "), table.concat(after, " ")))
            
        else -- THUMB_LDR
            -- Before THUMB (3 bytes)
            local before = {}
            for j = midpoint - 3, midpoint - 1 do
                if j > 0 and j <= #context then
                    table.insert(before, bytes[j])
                end
            end
            
            -- After THUMB (3 bytes)
            local after = {}
            for j = midpoint + 2, midpoint + 4 do
                if j > 0 and j <= #context then
                    table.insert(after, bytes[j])
                end
            end
            
            print(string.format("   Pattern: %s 48 ?? %s", 
                table.concat(before, " "), table.concat(after, " ")))
        end
    end
    
    print(string.format("\n🎯 SUCCESS: Found %d universal patterns for %s!", #references, gameType))
    print(string.format("Target address: 0x%08X", targetAddr))
    
else
    print("\n❌ No instruction references found")
end

print("\n✅ Fast pattern detection complete!")