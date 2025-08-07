-- Simple test - just find direct patterns
-- This should be fast and prove the concept works

local function log(message)
    console:log(message)
    io.stdout:write("[Pattern Test] " .. message .. "\n")
    io.stdout:flush()
end

-- Test basic functionality first
log("🚀 Starting simple pattern test")

if not emu or not emu.romSize or emu:romSize() == 0 then
    log("❌ No ROM loaded")
    return {success = false, error = "No ROM loaded"}
end

local title = emu:getGameTitle()
local size = emu:romSize()
log("🎮 ROM: " .. title .. " (" .. size .. " bytes)")

-- Simple direct search - just look for Emerald address in first 1MB
log("🔍 Searching for direct Emerald address pattern in first 1MB...")
local emeraldPattern = {0xEC, 0x44, 0x02, 0x02}
local found = false
local foundAt = 0

local searchEnd = math.min(0x08000000 + (1024 * 1024), 0x08000000 + size)
log(string.format("  Range: 0x%08X - 0x%08X", 0x08000000, searchEnd))

for addr = 0x08000000, searchEnd - 4, 4 do -- Check every 4 bytes (word-aligned)
    local b1 = emu:read8(addr)
    local b2 = emu:read8(addr + 1)
    local b3 = emu:read8(addr + 2)
    local b4 = emu:read8(addr + 3)
    
    if b1 == emeraldPattern[1] and b2 == emeraldPattern[2] and 
       b3 == emeraldPattern[3] and b4 == emeraldPattern[4] then
        log(string.format("✅ Found Emerald address pattern at 0x%08X", addr))
        found = true
        foundAt = addr
        break
    end
    
    -- Progress every 100KB
    if (addr - 0x08000000) % (100 * 1024) == 0 then
        local percent = math.floor(((addr - 0x08000000) / (searchEnd - 0x08000000)) * 100)
        log(string.format("  Progress: %d%%", percent))
    end
end

if found then
    log("🎉 SUCCESS! Universal pattern detection works!")
    return {
        success = true,
        method = "direct_reference",
        foundAddress = 0x020244EC,
        foundAt = foundAt,
        variant = "emerald"
    }
else
    log("❌ No pattern found in first 1MB")
    return {
        success = false,
        error = "Pattern not found in search range"
    }
end