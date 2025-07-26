-- Simple HTTP server script for mGBA
console:log("🚀 Starting simple HTTP server...")

-- Test if socket API is working
if not socket then
    console:error("❌ Socket API not available!")
    return
end

console:log("✅ Socket API available")

-- Simple server setup
local port = 7102
local server, err = socket.bind(nil, port)

if not server then
    console:error("❌ Failed to bind to port " .. port .. ": " .. tostring(err))
    return
end

console:log("📡 Server bound to port " .. port)

-- Start listening
local ok, listen_err = server:listen()
if not ok then
    console:error("❌ Failed to listen: " .. tostring(listen_err))
    server:close()
    return
end

console:log("🎧 Server listening on port " .. port)

-- Simple accept loop
server:add("received", function()
    console:log("📨 New connection received")
    local client, err = server:accept()
    if client then
        console:log("✅ Client connected")
        client:send("HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\nHello from mGBA HTTP Server!")
        client:close()
        console:log("📤 Response sent and connection closed")
    else
        console:log("❌ Failed to accept client: " .. tostring(err))
    end
end)

console:log("🚀 Simple HTTP server started on port " .. port)
console:log("Test with: curl http://localhost:" .. port .. "/")