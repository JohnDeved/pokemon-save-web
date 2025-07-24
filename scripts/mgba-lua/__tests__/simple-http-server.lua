#!/usr/bin/env lua5.3

--[[
Simple HTTP server for testing that mimics the behavior of the mGBA HTTP server
This tests the core functionality by implementing the same routes and WebSocket logic
]]

local socket = require('socket')

-- JSON stringify function (copied from the original server)
local function jsonStringify(val)
    local function escape(s)
        return s:gsub('[\\"]', {['\\']='\\\\', ['"']='\\"'})
    end
    
    local function serialize(v)
        local t = type(v)
        if t == "string" then return '"' .. escape(v) .. '"'
        elseif t == "number" or t == "boolean" then return tostring(v)
        elseif t == "nil" then return "null"
        elseif t == "table" then
            local is_array = true
            local max_i = 0
            for k, _ in pairs(v) do
                if type(k) ~= "number" or k <= 0 or k ~= math.floor(k) then
                    is_array = false
                    break
                end
                max_i = math.max(max_i, k)
            end
            
            if is_array then
                local result = {}
                for i = 1, max_i do
                    result[i] = serialize(v[i])
                end
                return "[" .. table.concat(result, ",") .. "]"
            else
                local result = {}
                for k, v in pairs(v) do
                    table.insert(result, '"' .. escape(tostring(k)) .. '":' .. serialize(v))
                end
                return "{" .. table.concat(result, ",") .. "}"
            end
        else
            return "null"
        end
    end
    
    return serialize(val)
end

-- WebSocket accept key generation following RFC6455
local function generateWebSocketAccept(key)
    local magic = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
    local combined = key .. magic
    
    -- Use openssl command to generate proper SHA1 hash
    local handle = io.popen("echo -n '" .. combined .. "' | openssl dgst -sha1 -binary | openssl base64")
    local result = handle:read("*a")
    handle:close()
    
    return result:gsub("%s+", "") -- Remove any whitespace
end

-- Simple HTTP request parser
local function parseRequest(data)
    local header_end = data:find("\r\n\r\n")
    if not header_end then return nil end

    local header_part = data:sub(1, header_end - 1)
    local body = data:sub(header_end + 4)

    local method, path = header_part:match("^(%w+)%s+([^%s]+)")
    if not method or not path then return nil end

    local headers = {}
    for k, v in string.gmatch(header_part, "([%w-]+):%s*([^\r\n]+)") do
        headers[k:lower()] = v
    end

    return {
        method = method,
        path = path,
        headers = headers,
        body = body
    }
end

-- HTTP response helper
local function sendResponse(client, status, body, content_type)
    content_type = content_type or "text/plain"
    local response = "HTTP/1.1 " .. status .. "\r\n" ..
                    "Content-Type: " .. content_type .. "\r\n" ..
                    "Access-Control-Allow-Origin: *\r\n" ..
                    "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n" ..
                    "Access-Control-Allow-Headers: Content-Type\r\n" ..
                    "Content-Length: " .. #body .. "\r\n\r\n" .. body
    client:send(response)
end

-- WebSocket handshake
local function handleWebSocketUpgrade(client, req)
    local wsKey = req.headers["sec-websocket-key"]
    if not wsKey then
        sendResponse(client, "400 Bad Request", "Missing WebSocket key")
        return false
    end
    
    local accept = generateWebSocketAccept(wsKey)
    local response = "HTTP/1.1 101 Switching Protocols\r\n" ..
                    "Upgrade: websocket\r\n" ..
                    "Connection: Upgrade\r\n" ..
                    "Sec-WebSocket-Accept: " .. accept .. "\r\n\r\n"
    
    client:send(response)
    return true
end

-- Simple WebSocket frame parser
local function parseWebSocketFrame(data)
    if #data < 2 then return nil, 0 end
    
    local byte1 = data:byte(1)
    local byte2 = data:byte(2)
    
    local fin = (byte1 >= 128) -- bit 7 set
    local opcode = byte1 % 16  -- lower 4 bits
    local masked = (byte2 >= 128) -- bit 7 set
    local len = byte2 % 128    -- lower 7 bits
    
    local offset = 2
    
    if len == 126 then
        if #data < offset + 2 then return nil, 0 end
        len = data:byte(offset + 1) * 256 + data:byte(offset + 2)
        offset = offset + 2
    elseif len == 127 then
        -- For simplicity, we don't handle very large frames in tests
        return nil, 0
    end
    
    local mask_start = offset + 1
    if masked then
        if #data < mask_start + 3 then return nil, 0 end
        offset = offset + 4
    end
    
    if #data < offset + len then return nil, 0 end
    
    local payload = data:sub(offset + 1, offset + len)
    
    if masked then
        local mask = {data:byte(mask_start), data:byte(mask_start + 1), data:byte(mask_start + 2), data:byte(mask_start + 3)}
        local unmasked = {}
        for i = 1, #payload do
            local masked_byte = payload:byte(i)
            local mask_byte = mask[((i-1) % 4) + 1]
            unmasked[i] = string.char(masked_byte ~ mask_byte)
        end
        payload = table.concat(unmasked)
    end
    
    return payload, offset + len
end

-- Create WebSocket frame
local function createWebSocketFrame(data)
    local len = #data
    local frame = {}
    
    -- FIN bit set, text frame (0x81 = 10000001)
    frame[1] = string.char(0x81)
    
    if len < 126 then
        frame[2] = string.char(len)
    elseif len < 65536 then
        frame[2] = string.char(126)
        frame[3] = string.char(math.floor(len / 256))
        frame[4] = string.char(len % 256)
    else
        error("Frame too large for test implementation")
    end
    
    frame[#frame + 1] = data
    return table.concat(frame)
end

-- Main server function
local function runServer(port)
    local server = socket.tcp()
    server:setoption('reuseaddr', true)
    
    local ok, err = server:bind('127.0.0.1', port)
    if not ok then
        server:close()
        error("Failed to bind to port " .. port .. ": " .. tostring(err))
    end
    
    local listen_ok, listen_err = server:listen(32)
    if not listen_ok then
        server:close()
        error("Failed to listen: " .. tostring(listen_err))
    end
    
    print("[LOG] 🚀 Test HTTP Server started on port " .. port)
    print("[LOG] Server started on port " .. port)  -- For test detection
    
    while true do
        server:settimeout(1)
        local client = server:accept()
        
        if client then
            client:settimeout(10)
            
            -- Read the request
            local request_data = ""
            while true do
                local line, err = client:receive()
                if not line then break end
                request_data = request_data .. line .. "\r\n"
                if line == "" then break end
            end
            
            if request_data ~= "" then
                local req = parseRequest(request_data)
                if req then
                    print("[LOG] " .. req.method .. " " .. req.path)
                    
                    -- Check for WebSocket upgrade
                    if req.headers.upgrade == "websocket" and 
                       req.headers.connection and req.headers.connection:lower():find("upgrade") and
                       req.headers["sec-websocket-key"] then
                        
                        if handleWebSocketUpgrade(client, req) then
                            print("[LOG] WebSocket connected: " .. req.path)
                            
                            -- Send welcome message
                            local welcome = createWebSocketFrame("Welcome to WebSocket Eval! Send Lua code to execute.")
                            client:send(welcome)
                            
                            -- Handle WebSocket messages
                            local buffer = ""
                            while true do
                                client:settimeout(0.1)
                                local data, err = client:receive(1024)
                                if data then
                                    buffer = buffer .. data
                                    print("[DEBUG] Received WebSocket data: " .. #data .. " bytes, buffer size: " .. #buffer)
                                    
                                    local payload, consumed = parseWebSocketFrame(buffer)
                                    if payload then
                                        buffer = buffer:sub(consumed + 1)
                                        print("[LOG] WebSocket eval request: " .. payload)
                                        
                                        -- Evaluate the code
                                        local chunk = payload
                                        if not payload:match("^%s*(return|local|function)") then
                                            chunk = "return " .. payload
                                        end
                                        
                                        local fn, load_err = load(chunk, "websocket-eval")
                                        local response
                                        if not fn then
                                            response = jsonStringify({error = load_err or "Invalid code"})
                                        else
                                            local ok, result = pcall(fn)
                                            if ok then
                                                response = jsonStringify({result = result})
                                            else
                                                response = jsonStringify({error = tostring(result)})
                                            end
                                        end
                                        
                                        print("[DEBUG] Sending WebSocket response: " .. response)
                                        local frame = createWebSocketFrame(response)
                                        local sent, send_err = client:send(frame)
                                        if not sent then
                                            print("[ERROR] Failed to send WebSocket frame: " .. tostring(send_err))
                                        end
                                    else
                                        print("[DEBUG] Incomplete WebSocket frame, waiting for more data")
                                    end
                                elseif err ~= "timeout" then
                                    print("[DEBUG] WebSocket receive error: " .. tostring(err))
                                    break
                                end
                            end
                            
                            print("[LOG] WebSocket disconnected: " .. req.path)
                        end
                    else
                        -- Regular HTTP request
                        if req.method == "GET" and req.path == "/" then
                            sendResponse(client, "200 OK", "Welcome to mGBA HTTP Server!")
                        elseif req.method == "GET" and req.path == "/json" then
                            local data = {
                                message = "Hello, JSON!",
                                timestamp = os.time()
                            }
                            sendResponse(client, "200 OK", jsonStringify(data), "application/json")
                        elseif req.method == "POST" and req.path == "/echo" then
                            -- Read the body if we have content-length
                            local content_length = req.headers["content-length"]
                            local body = req.body
                            if content_length and tonumber(content_length) > #body then
                                local remaining = tonumber(content_length) - #body
                                local extra_body = client:receive(remaining)
                                if extra_body then
                                    body = body .. extra_body
                                end
                            end
                            sendResponse(client, "200 OK", body, "application/json")
                        else
                            sendResponse(client, "404 Not Found", "Not Found")
                        end
                    end
                end
            end
            
            client:close()
        end
    end
end

-- Get port from command line
local port = tonumber(arg and arg[1]) or 7102

-- Run the server
local ok, err = pcall(runServer, port)
if not ok then
    print("[ERROR] Server error: " .. tostring(err))
    os.exit(1)
end