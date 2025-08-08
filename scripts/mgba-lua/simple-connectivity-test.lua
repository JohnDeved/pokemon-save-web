-- Simple connectivity test for mGBA WebSocket API
-- Tests basic functionality before running complex Universal Pattern search

local function log(message)
    console:log(message)
    io.stdout:write("[Simple Test] " .. message .. "\n")
    io.stdout:flush()
end

-- Simple test function to verify ROM is loaded and basic functionality works
local function runSimpleTest()
    log("🚀 Starting Simple Connectivity Test")
    
    -- Test 1: Check if emulator is available
    if not emu then
        return {success = false, error = "Emulator not available"}
    end
    
    -- Test 2: Check if ROM is loaded
    if not emu.romSize or emu:romSize() == 0 then
        return {success = false, error = "No ROM loaded"}
    end
    
    local romSize = emu:romSize()
    log(string.format("✅ ROM loaded: %d bytes", romSize))
    
    -- Test 3: Check ROM title
    local title = "Unknown"
    if emu.getGameTitle then
        title = emu:getGameTitle()
    end
    log("✅ ROM Title: " .. title)
    
    -- Test 4: Basic memory read test
    local testByte = emu:read8(0x08000000) -- Read first byte of ROM
    log(string.format("✅ Memory read test: First ROM byte = 0x%02X", testByte))
    
    -- Test 5: Determine game variant
    local variant = "unknown"
    if title:lower():find("emerald") then
        variant = "emerald"
    elseif title:lower():find("quetzal") then
        variant = "quetzal"
    end
    log("✅ Game variant: " .. variant)
    
    -- Test 6: Quick pattern search sample (just first 1KB)
    log("✅ Testing quick pattern search on first 1KB...")
    local sampleFound = false
    for addr = 0x08000000, 0x08000400 do
        local b1 = emu:read8(addr)
        if b1 == 0x48 then -- Look for any 0x48 byte (THUMB LDR pattern start)
            sampleFound = true
            break
        end
    end
    log(string.format("✅ Sample pattern search: %s", sampleFound and "Found 0x48 bytes" or "No 0x48 bytes in sample"))
    
    return {
        success = true,
        romSize = romSize,
        title = title,
        variant = variant,
        samplePatternFound = sampleFound,
        firstByte = testByte
    }
end

-- Export function for WebSocket use
runSimpleTest = runSimpleTest