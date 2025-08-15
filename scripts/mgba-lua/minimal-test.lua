-- MINIMAL test for proper approach
print("MINIMAL_TEST_START")

local romSize = emu:romSize()
print(string.format("ROM_SIZE:%d", romSize))

-- Just test if we can find the target address bytes in ROM
local emeraldAddr = 0x020244EC
local b1, b2, b3, b4 = emeraldAddr & 0xFF, (emeraldAddr >> 8) & 0xFF, (emeraldAddr >> 16) & 0xFF, (emeraldAddr >> 24) & 0xFF

local found = 0
for addr = 0x08000000, 0x08000000 + 500000 - 4, 100 do
    local rb1, rb2, rb3, rb4 = emu:read8(addr), emu:read8(addr+1), emu:read8(addr+2), emu:read8(addr+3)
    if rb1 == b1 and rb2 == b2 and rb3 == b3 and rb4 == b4 then
        found = found + 1
        print(string.format("FOUND_EMERALD_AT:0x%08X", addr))
        if found >= 3 then break end
    end
end

print(string.format("EMERALD_COUNT:%d", found))
print("MINIMAL_TEST_COMPLETE")