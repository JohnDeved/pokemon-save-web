-- Simple Lua test script to check if mGBA Lua is working
console:log("🚀 Lua script loaded successfully!")
console:log("✅ Console API is working!")

if socket then
    console:log("🌐 Socket API is available!")
else
    console:log("❌ Socket API is NOT available!")
    console:error("ERROR: Socket API not found - Lua networking not supported")
end

if emu then
    console:log("🎮 Emulator API is available!")
    if emu.romSize then
        console:log("📁 ROM size: " .. tostring(emu:romSize()) .. " bytes")
    end
else
    console:log("❌ Emulator API is NOT available!")
end

console:log("✨ Test script completed")