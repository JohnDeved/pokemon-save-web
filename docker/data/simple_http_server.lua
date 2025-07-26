-- Simple HTTP server test for validating Docker environment
-- This works with standalone Lua for testing

local socket = require("socket")

-- Simple HTTP server
local server = assert(socket.bind("*", 7102))
print("🚀 Simple HTTP Server started on port 7102")

while true do
    local client = server:accept()
    if client then
        client:settimeout(1)
        local request, err = client:receive("*l")
        
        if request then
            print("📥 Request: " .. request)
            
            -- Parse request
            local method, path = request:match("^(%S+)%s+(%S+)")
            
            -- Simple routing
            local response_body = ""
            local content_type = "text/plain"
            
            if path == "/" then
                response_body = "Welcome to mGBA HTTP Server!"
            elseif path == "/json" then
                response_body = '{"message":"Hello, JSON!","timestamp":' .. os.time() .. ',"server":"mGBA Docker Test"}'
                content_type = "application/json"
            elseif method == "POST" and path == "/echo" then
                response_body = "Echo: " .. (request:match("\r\n\r\n(.*)") or "No body")
            else
                response_body = "Not Found"
            end
            
            -- Send HTTP response
            local response = string.format(
                "HTTP/1.1 200 OK\r\n" ..
                "Content-Type: %s\r\n" ..
                "Content-Length: %d\r\n" ..
                "Access-Control-Allow-Origin: *\r\n" ..
                "Connection: close\r\n" ..
                "\r\n" ..
                "%s",
                content_type, #response_body, response_body
            )
            
            client:send(response)
            print("📤 Response sent: " .. path)
        end
        
        client:close()
    end
end