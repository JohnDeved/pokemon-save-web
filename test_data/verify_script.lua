-- Script that writes to a file to verify it loaded
local file = io.open("/home/runner/work/pokemon-save-web/pokemon-save-web/test_data/script_test.txt", "w")
if file then
    file:write("Lua script loaded successfully at " .. os.date() .. "\n")
    file:close()
end

-- Also try console output
console:log("🎮 Lua script starting!")

-- Test if socket API is available
if socket then
    console:log("✅ Socket API is available")
else
    console:log("❌ Socket API is not available")
end

console:log("✅ Script execution completed")