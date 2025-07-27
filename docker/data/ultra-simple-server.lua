-- Ultra simple HTTP server test
console:log("🚀 Simple HTTP server starting...")

-- Test if socket is available
if socket then
    console:log("✅ Socket API is available!")
    
    -- Try to create a simple server
    local server, err = socket.bind(nil, 7102)
    if server then
        console:log("✅ Server bound to port 7102!")
        server:listen(1)
        console:log("✅ Server listening!")
        
        -- Accept connections
        callbacks:add("frame", function()
            local client = server:accept()
            if client then
                console:log("📞 Client connected!")
                local response = "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 13\r\nConnection: close\r\n\r\nHello, World!"
                client:send(response)
                console:log("✅ Response sent!")
                client:close()
                console:log("🔌 Connection closed!")
            end
        end)
    else
        console:error("❌ Failed to bind: " .. tostring(err))
    end
else
    console:error("❌ Socket API not available!")
end

console:log("🎯 Script initialization complete")