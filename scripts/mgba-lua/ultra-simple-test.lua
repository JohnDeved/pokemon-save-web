-- ULTRA SIMPLE test to verify approach
print("🔍 Ultra Simple Pattern Test")

local romSize = emu:romSize()
local romTitle = emu:read(0x08000000 + 0xA0, 12)
print(string.format("📱 ROM: %s (%d bytes)", romTitle, romSize))

-- Target addresses
local emeraldAddr = 0x020244EC
local quetzalAddr = 0x020235B8

-- Convert address to bytes
function addrToBytes(addr)
    return addr & 0xFF, (addr >> 8) & 0xFF, (addr >> 16) & 0xFF, (addr >> 24) & 0xFF
end

-- Simple search in first 1MB only
print("\n🎯 Searching for target addresses in first 1MB...")

local emeraldBytes = {addrToBytes(emeraldAddr)}
local quetzalBytes = {addrToBytes(quetzalAddr)}

local emeraldFound = 0
local quetzalFound = 0

for addr = 0x08000000, 0x08000000 + 1000000 - 4, 4 do
    local b1, b2, b3, b4 = emu:read8(addr), emu:read8(addr+1), emu:read8(addr+2), emu:read8(addr+3)
    
    -- Check for Emerald address
    if b1 == emeraldBytes[1] and b2 == emeraldBytes[2] and b3 == emeraldBytes[3] and b4 == emeraldBytes[4] then
        emeraldFound = emeraldFound + 1
        if emeraldFound <= 3 then
            print(string.format("   ✅ Emerald address found at 0x%08X", addr))
            
            -- Look for ARM LDR pattern nearby
            for i = math.max(0x08000000, addr - 200), addr - 4, 4 do
                local i3, i4 = emu:read8(i + 2), emu:read8(i + 3)
                if i3 == 0x9F and i4 == 0xE5 then
                    local imm = emu:read8(i) | (emu:read8(i + 1) << 8)
                    local pc = i + 8
                    if pc + imm == addr then
                        print(string.format("      🎯 ARM LDR references this: 0x%08X", i))
                        break
                    end
                end
            end
        end
    end
    
    -- Check for Quetzal address
    if b1 == quetzalBytes[1] and b2 == quetzalBytes[2] and b3 == quetzalBytes[3] and b4 == quetzalBytes[4] then
        quetzalFound = quetzalFound + 1
        if quetzalFound <= 3 then
            print(string.format("   ✅ Quetzal address found at 0x%08X", addr))
            
            -- Look for ARM LDR pattern nearby
            for i = math.max(0x08000000, addr - 200), addr - 4, 4 do
                local i3, i4 = emu:read8(i + 2), emu:read8(i + 3)
                if i3 == 0x9F and i4 == 0xE5 then
                    local imm = emu:read8(i) | (emu:read8(i + 1) << 8)
                    local pc = i + 8
                    if pc + imm == addr then
                        print(string.format("      🎯 ARM LDR references this: 0x%08X", i))
                        break
                    end
                end
            end
        end
    end
end

print(string.format("\n📊 RESULTS:"))
print(string.format("   Emerald references: %d", emeraldFound))
print(string.format("   Quetzal references: %d", quetzalFound))

if emeraldFound > 0 or quetzalFound > 0 then
    print("✅ SUCCESS: Found instruction patterns that reference target addresses!")
else
    print("❌ No patterns found in first 1MB")
end

print("✅ Ultra Simple Pattern Test Complete!")