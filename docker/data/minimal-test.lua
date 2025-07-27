-- Minimal test script to see if Lua is executing at all
print("BASIC LUA TEST: Script is running!")

if console then
    console:log("CONSOLE TEST: Console API is available!")
else
    print("CONSOLE TEST: Console API not available")
end

if socket then
    print("SOCKET TEST: Socket API is available!")
else
    print("SOCKET TEST: Socket API not available")
end

print("BASIC LUA TEST: Script completed!")