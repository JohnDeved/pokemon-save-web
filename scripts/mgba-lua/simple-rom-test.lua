-- Simple ROM test to verify mGBA access is working
print("🔍 Testing basic ROM access...")

local romSize = emu:romSize() or 0
print(string.format("ROM size: %d bytes", romSize))

if romSize > 0 then
    -- Read ROM header
    local header = {}
    for i = 0, 15 do
        table.insert(header, string.format("%02X", emu:read8(0x08000000 + i)))
    end
    print("First 16 bytes: " .. table.concat(header, " "))
    
    -- Read game title
    local title = ""
    for i = 0, 11 do
        local byte = emu:read8(0x08000000 + 0xA0 + i)
        if byte > 0 then
            title = title .. string.char(byte)
        end
    end
    print("Game title: " .. title)
    
    -- Quick pattern search test (just look for a few MOV #6 instructions)
    print("🔍 Quick pattern search test...")
    local movCount = 0
    
    -- Search first 1MB only for performance
    for addr = 0x08000000, 0x08000000 + 1024*1024 - 4, 4 do
        local b1 = emu:read8(addr)
        local b2 = emu:read8(addr + 1)
        local b3 = emu:read8(addr + 2)
        local b4 = emu:read8(addr + 3)
        
        -- MOV r0, #6 (ARM): 06 20 A0 E3
        if b1 == 0x06 and b2 == 0x20 and b3 == 0xA0 and b4 == 0xE3 then
            print(string.format("Found MOV r0, #6 at 0x%08X", addr))
            movCount = movCount + 1
            if movCount >= 3 then break end -- Limit output
        end
    end
    
    print(string.format("Found %d MOV r0, #6 instructions in first 1MB", movCount))
    
    if movCount > 0 then
        print("✅ Basic pattern search is working!")
        return {success = true, message = "ROM access and pattern search working"}
    else
        print("⚠️  No MOV #6 patterns found in first 1MB")
        return {success = false, message = "No patterns found but ROM access working"}
    end
else
    print("❌ ROM size is 0 - ROM not loaded properly")
    return {success = false, message = "ROM not loaded"}
end