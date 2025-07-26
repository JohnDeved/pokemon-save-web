-- Simple test to check basic functionality
local success, error_msg = pcall(function()
    local file = io.open("/home/runner/work/pokemon-save-web/pokemon-save-web/test_data/simple_test.txt", "w")
    if file then
        file:write("Basic Lua working\n")
        
        -- Test socket specifically
        if socket then
            file:write("Socket available: YES\n")
        else
            file:write("Socket available: NO\n")
        end
        
        file:close()
    end
end)

if not success then
    local error_file = io.open("/home/runner/work/pokemon-save-web/pokemon-save-web/test_data/error.txt", "w")
    if error_file then
        error_file:write("Error: " .. tostring(error_msg) .. "\n")
        error_file:close()
    end
end