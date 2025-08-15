-- Simple test script
print("🔍 SIMPLE TEST SCRIPT RUNNING")
print("ROM Title: " .. (emu:getGameTitle() or "unknown"))
print("ROM Size: " .. emu:romSize())
print("✅ Lua script executed successfully!")