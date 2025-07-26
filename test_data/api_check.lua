-- Script to check available APIs in mGBA Lua environment
local file = io.open("/home/runner/work/pokemon-save-web/pokemon-save-web/test_data/api_test.txt", "w")
if file then
    file:write("mGBA Lua Environment API Check\n")
    file:write("===============================\n")
    file:write("Time: " .. os.date() .. "\n\n")
    
    -- Check global APIs
    file:write("Global APIs:\n")
    file:write("- console: " .. tostring(console) .. "\n")
    file:write("- socket: " .. tostring(socket) .. "\n")
    file:write("- emu: " .. tostring(emu) .. "\n")
    file:write("- callbacks: " .. tostring(callbacks) .. "\n")
    file:write("- bit: " .. tostring(bit) .. "\n")
    file:write("- math: " .. tostring(math) .. "\n")
    file:write("- string: " .. tostring(string) .. "\n")
    file:write("- table: " .. tostring(table) .. "\n")
    file:write("- io: " .. tostring(io) .. "\n")
    file:write("- os: " .. tostring(os) .. "\n")
    
    file:write("\n")
    
    -- Check if socket exists and what methods it has
    if socket then
        file:write("Socket API available!\n")
        file:write("Socket methods:\n")
        for k, v in pairs(socket) do
            file:write("  " .. k .. ": " .. tostring(v) .. "\n")
        end
    else
        file:write("Socket API not available\n")
    end
    
    -- Check emu API
    if emu then
        file:write("\nEmu API available!\n")
        file:write("Emu methods:\n")
        for k, v in pairs(emu) do
            file:write("  " .. k .. ": " .. tostring(v) .. "\n")
        end
    else
        file:write("\nEmu API not available\n")
    end
    
    file:close()
end

-- Also try to use console
if console then
    console:log("✅ API check script completed - see api_test.txt")
else
    print("Console API not available")
end