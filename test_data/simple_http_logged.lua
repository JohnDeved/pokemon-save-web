-- Simple HTTP server script for mGBA with file logging
local log_file = io.open("/home/runner/work/pokemon-save-web/pokemon-save-web/test_data/server_log.txt", "w")

local function log(msg)
    if log_file then
        log_file:write(os.date() .. ": " .. msg .. "\n")
        log_file:flush()
    end
    if console then
        console:log(msg)
    end
end

log("🚀 Starting simple HTTP server...")

-- Test if socket API is working
if not socket then
    log("❌ Socket API not available!")
    return
end

log("✅ Socket API available")

-- Simple server setup
local port = 7102
local server, err = socket.bind(nil, port)

if not server then
    log("❌ Failed to bind to port " .. port .. ": " .. tostring(err))
    return
end

log("📡 Server bound to port " .. port)

-- Start listening
local ok, listen_err = server:listen()
if not ok then
    log("❌ Failed to listen: " .. tostring(listen_err))
    server:close()
    return
end

log("🎧 Server listening on port " .. port)
log("🚀 Simple HTTP server ready!")

-- Keep the script running
while true do
    -- Check for connections
    local client, err = server:accept()
    if client then
        log("✅ Client connected")
        client:send("HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\nHello from mGBA HTTP Server!")
        client:close()
        log("📤 Response sent and connection closed")
    elseif err ~= socket.ERRORS.AGAIN then
        log("❌ Accept error: " .. tostring(err))
        break
    end
end

if log_file then
    log_file:close()
end