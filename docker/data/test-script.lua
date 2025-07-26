-- Simple test script for mGBA
console:log("🧪 Test script loaded successfully!")

-- Test if socket is available
if socket then
    console:log("✅ Socket API is available")
else
    console:error("❌ Socket API is NOT available")
end

-- Test if emu is available
if emu then
    console:log("✅ Emulator API is available")
    if emu.romSize then
        local size = emu:romSize()
        console:log("📦 ROM size: " .. size .. " bytes")
    else
        console:log("⚠️  ROM size function not available")
    end
else
    console:error("❌ Emulator API is NOT available")
end

console:log("🏁 Test script completed")