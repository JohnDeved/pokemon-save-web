-- Debug script to test if Lua is running at all
console:log("🚀 DEBUG: Lua script is starting...")

-- Test basic console output
console:log("✅ DEBUG: Console.log is working")

-- Test if socket is available
if socket then
    console:log("✅ DEBUG: Socket API is available!")
    
    -- Try to bind to port 7102
    local server, err = socket.bind(nil, 7102)
    if server then
        console:log("✅ DEBUG: Successfully bound to port 7102")
        
        local ok, listen_err = server:listen(5)
        if ok then
            console:log("✅ DEBUG: Server is listening on port 7102")
            
            -- Add a frame callback to handle incoming connections continuously
            callbacks:add("frame", function()
                local client = server:accept()
                if client then
                    console:log("📞 DEBUG: Client connected!")
                    local response = "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 21\r\nConnection: close\r\n\r\nDEBUG: Hello, World!"
                    local send_ok, send_err = client:send(response)
                    if send_ok then
                        console:log("✅ DEBUG: Response sent successfully")
                    else
                        console:log("❌ DEBUG: Failed to send response: " .. tostring(send_err))
                    end
                    client:close()
                    console:log("🔌 DEBUG: Connection closed")
                end
            end)
            
            console:log("🔄 DEBUG: Server loop started, waiting for connections...")
        else
            console:log("❌ DEBUG: Failed to listen: " .. tostring(listen_err))
        end
    else
        console:log("❌ DEBUG: Failed to bind to port 7102: " .. tostring(err))
    end
else
    console:log("❌ DEBUG: Socket API not available!")
end

console:log("🎯 DEBUG: Script completed initialization")