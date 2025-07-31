---@class Request
---@field method string
---@field path string
---@field headers table<string, string>
---@field body string

---@class Response
---@field finished boolean
---@field _headers table<string, string>
---@field setHeader fun(self: Response, key: string, value: any): nil
---@field send fun(self: Response, status: string, body: string|table, content_type?: string): nil

---@class WebSocket
---@field id number
---@field client table
---@field path string
---@field onMessage fun(data: string): nil
---@field onClose fun(): nil
---@field send fun(self: WebSocket, data: string): nil
---@field close fun(self: WebSocket): nil

---@class HttpServer
---@field routes table<string, table<string, function[]>>
---@field middlewares function[]
---@field clients table<number, table>
---@field websockets table<number, WebSocket>
---@field wsRoutes table<string, function>
---@field nextClientId number
---@field server table?
local HttpServer = {}
HttpServer.__index = HttpServer

--------------------------------------------------------------------------------
-- Simple JSON utilities
--------------------------------------------------------------------------------

local function jsonStringify(obj)
    if type(obj) == "table" then
        local parts = {}
        local isArray = true
        local maxIndex = 0
        
        for k, v in pairs(obj) do
            if type(k) ~= "number" then
                isArray = false
                break
            else
                maxIndex = math.max(maxIndex, k)
            end
        end
        
        if isArray then
            for i = 1, maxIndex do
                parts[i] = jsonStringify(obj[i])
            end
            return "[" .. table.concat(parts, ",") .. "]"
        else
            for k, v in pairs(obj) do
                table.insert(parts, '"' .. tostring(k) .. '":' .. jsonStringify(v))
            end
            return "{" .. table.concat(parts, ",") .. "}"
        end
    elseif type(obj) == "string" then
        return '"' .. obj:gsub('\\', '\\\\'):gsub('"', '\\"'):gsub('\n', '\\n') .. '"'
    elseif type(obj) == "number" or type(obj) == "boolean" then
        return tostring(obj)
    else
        return "null"
    end
end

HttpServer.jsonStringify = jsonStringify

--------------------------------------------------------------------------------
-- HTTP Server Implementation
--------------------------------------------------------------------------------

function HttpServer:new()
    local instance = {
        routes = {},
        middlewares = {},
        clients = {},
        websockets = {},
        wsRoutes = {},
        nextClientId = 1,
        server = nil
    }
    setmetatable(instance, self)
    return instance
end

function HttpServer:use(middleware)
    table.insert(self.middlewares, middleware)
end

function HttpServer:route(method, path, handler)
    if not self.routes[path] then
        self.routes[path] = {}
    end
    if not self.routes[path][method] then
        self.routes[path][method] = {}
    end
    table.insert(self.routes[path][method], handler)
end

function HttpServer:get(path, handler)
    self:route("GET", path, handler)
end

function HttpServer:post(path, handler)
    self:route("POST", path, handler)
end

function HttpServer:websocket(path, handler)
    self.wsRoutes[path] = handler
end

-- Simple WebSocket frame parsing
function HttpServer:parseWebSocketFrame(data)
    if #data < 2 then return nil end
    
    local byte1 = string.byte(data, 1)
    local byte2 = string.byte(data, 2)
    local fin = (byte1 & 0x80) ~= 0
    local opcode = byte1 & 0x0F
    local masked = (byte2 & 0x80) ~= 0
    local payloadLen = byte2 & 0x7F
    
    local offset = 3
    if payloadLen == 126 then
        if #data < 4 then return nil end
        payloadLen = (string.byte(data, 3) << 8) | string.byte(data, 4)
        offset = 5
    elseif payloadLen == 127 then
        return nil -- Large payloads not supported
    end
    
    local maskKey = {}
    if masked then
        if #data < offset + 3 then return nil end
        for i = 1, 4 do
            maskKey[i] = string.byte(data, offset + i - 1)
        end
        offset = offset + 4
    end
    
    if #data < offset + payloadLen - 1 then return nil end
    
    local payload = {}
    for i = 1, payloadLen do
        local byte = string.byte(data, offset + i - 1)
        if masked then
            byte = byte ~ maskKey[((i - 1) % 4) + 1]
        end
        table.insert(payload, string.char(byte))
    end
    
    return {
        fin = fin,
        opcode = opcode,
        payload = table.concat(payload),
        totalLength = offset + payloadLen - 1
    }
end

function HttpServer:createWebSocketFrame(data)
    local dataLen = #data
    local frame = {}
    
    table.insert(frame, string.char(0x81)) -- FIN=1, opcode=1 (text)
    
    if dataLen < 126 then
        table.insert(frame, string.char(dataLen))
    elseif dataLen < 65536 then
        table.insert(frame, string.char(126))
        table.insert(frame, string.char((dataLen >> 8) & 0xFF))
        table.insert(frame, string.char(dataLen & 0xFF))
    else
        return nil -- Large frames not supported
    end
    
    table.insert(frame, data)
    return table.concat(frame)
end

function HttpServer:listen(port, callback)
    self.server = socket.bind(port, function(sock)
        local clientId = self.nextClientId
        self.nextClientId = self.nextClientId + 1
        
        self.clients[clientId] = {
            socket = sock,
            buffer = "",
            isWebSocket = false,
            websocket = nil
        }
        
        sock.onReceive = function(data)
            local client = self.clients[clientId]
            if not client then return end
            
            client.buffer = client.buffer .. data
            
            if client.isWebSocket then
                -- Handle WebSocket frames
                while #client.buffer > 0 do
                    local frame = self:parseWebSocketFrame(client.buffer)
                    if not frame then break end
                    
                    client.buffer = string.sub(client.buffer, frame.totalLength + 1)
                    
                    if frame.opcode == 1 and client.websocket and client.websocket.onMessage then
                        client.websocket.onMessage(frame.payload)
                    end
                end
            else
                -- Handle HTTP request
                local headerEnd = string.find(client.buffer, "\r\n\r\n")
                if headerEnd then
                    local headerData = string.sub(client.buffer, 1, headerEnd - 1)
                    local bodyData = string.sub(client.buffer, headerEnd + 4)
                    
                    local lines = {}
                    for line in headerData:gmatch("[^\r\n]+") do
                        table.insert(lines, line)
                    end
                    
                    if #lines > 0 then
                        local requestLine = lines[1]
                        local method, path = requestLine:match("([A-Z]+) ([^ ]+)")
                        
                        local headers = {}
                        for i = 2, #lines do
                            local key, value = lines[i]:match("([^:]+): (.+)")
                            if key and value then
                                headers[key:lower()] = value
                            end
                        end
                        
                        -- Check for WebSocket upgrade
                        if headers["upgrade"] and headers["upgrade"]:lower() == "websocket" and self.wsRoutes[path] then
                            self:handleWebSocketUpgrade(clientId, path, headers)
                        else
                            self:handleHttpRequest(clientId, method, path, headers, bodyData)
                        end
                    end
                    
                    client.buffer = ""
                end
            end
        end
        
        sock.onDisconnect = function()
            local client = self.clients[clientId]
            if client and client.websocket and client.websocket.onClose then
                client.websocket.onClose()
            end
            self.clients[clientId] = nil
        end
    end)
    
    if callback then
        callback(port)
    end
end

function HttpServer:handleWebSocketUpgrade(clientId, path, headers)
    local client = self.clients[clientId]
    if not client then return end
    
    local key = headers["sec-websocket-key"]
    if not key then return end
    
    -- Simple WebSocket handshake
    local responseKey = key .. "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
    local hash = sha1 and sha1(responseKey) or "dummy-hash" -- Simplified
    
    local response = "HTTP/1.1 101 Switching Protocols\r\n" ..
                    "Upgrade: websocket\r\n" ..
                    "Connection: Upgrade\r\n" ..
                    "Sec-WebSocket-Accept: " .. hash .. "\r\n\r\n"
    
    client.socket:send(response)
    client.isWebSocket = true
    
    local ws = {
        id = clientId,
        client = client,
        path = path,
        send = function(self, data)
            local frame = HttpServer:createWebSocketFrame(data)
            if frame and client.socket then
                client.socket:send(frame)
            end
        end,
        close = function(self)
            if client.socket then
                client.socket:close()
            end
        end
    }
    
    client.websocket = ws
    self.websockets[clientId] = ws
    
    if self.wsRoutes[path] then
        self.wsRoutes[path](ws)
    end
end

function HttpServer:handleHttpRequest(clientId, method, path, headers, body)
    local client = self.clients[clientId]
    if not client then return end
    
    local response = {
        finished = false,
        _headers = {},
        setHeader = function(self, key, value)
            self._headers[key] = value
        end,
        send = function(self, status, body, contentType)
            if self.finished then return end
            self.finished = true
            
            local responseBody = body
            if type(body) == "table" then
                responseBody = jsonStringify(body)
                contentType = contentType or "application/json"
            end
            contentType = contentType or "text/plain"
            
            local responseHeaders = "HTTP/1.1 " .. status .. "\r\n" ..
                                  "Content-Type: " .. contentType .. "\r\n" ..
                                  "Content-Length: " .. #responseBody .. "\r\n"
            
            for key, value in pairs(self._headers) do
                responseHeaders = responseHeaders .. key .. ": " .. value .. "\r\n"
            end
            responseHeaders = responseHeaders .. "\r\n"
            
            if client.socket then
                client.socket:send(responseHeaders .. responseBody)
                client.socket:close()
            end
        end
    }
    
    local request = {
        method = method,
        path = path,
        headers = headers,
        body = body
    }
    
    if self.routes[path] and self.routes[path][method] then
        for _, handler in ipairs(self.routes[path][method]) do
            handler(request, response)
            if response.finished then break end
        end
    end
    
    if not response.finished then
        response:send("404 Not Found", "Not Found")
    end
end

--------------------------------------------------------------------------------
-- Application Setup
--------------------------------------------------------------------------------

local app = HttpServer:new()

-- Memory watching state
local watchedRegions = {}
local lastMemoryState = {}

-- Simple memory watching callback
local function checkMemoryChanges()
    for _, region in ipairs(watchedRegions) do
        local currentData = {}
        for i = 0, region.size - 1 do
            currentData[i] = memory.read8(region.address + i)
        end
        
        local changed = false
        if not lastMemoryState[region.address] then
            changed = true
        else
            for i = 0, region.size - 1 do
                if currentData[i] ~= lastMemoryState[region.address][i] then
                    changed = true
                    break
                end
            end
        end
        
        if changed then
            lastMemoryState[region.address] = currentData
            
            -- Send update to all WebSocket clients
            local update = {
                type = "memoryUpdate",
                regions = {{
                    address = region.address,
                    size = region.size,
                    data = {}
                }},
                timestamp = os.time()
            }
            
            for i = 0, region.size - 1 do
                table.insert(update.regions[1].data, currentData[i])
            end
            
            for _, ws in pairs(app.websockets) do
                ws:send(jsonStringify(update))
            end
        end
    end
end

-- Register memory callback
callbacks:add("frame", checkMemoryChanges)

-- WebSocket route
app:websocket("/ws", function(ws)
    console:log("WebSocket connected")
    
    ws:send(jsonStringify({
        type = "welcome",
        message = "WebSocket Ready! Send Lua code or watch messages."
    }))
    
    ws.onMessage = function(data)
        -- Try to parse as JSON first (for watch messages)
        local success, parsed = pcall(function() return json and json.decode(data) or nil end)
        
        if success and parsed and parsed.type == "watch" then
            -- Handle watch message
            watchedRegions = parsed.regions or {}
            ws:send(jsonStringify({
                type = "watchConfirm",
                message = "Watching " .. #watchedRegions .. " regions"
            }))
        else
            -- Handle as Lua eval
            local chunk = data
            if not data:match("^%s*(return|local|function|for|while|if|do|repeat)") then
                chunk = "return " .. data
            end
            
            local fn, err = load(chunk, "websocket-eval")
            if not fn then
                ws:send(jsonStringify({error = err or "Invalid code"}))
                return
            end
            
            local ok, result = pcall(fn)
            if ok then
                ws:send(jsonStringify({result = result}))
            else
                ws:send(jsonStringify({error = tostring(result)}))
            end
        end
    end
    
    ws.onClose = function()
        console:log("WebSocket disconnected")
    end
end)

-- Start server
app:listen(7102, function(port)
    console:log("🚀 Simple mGBA HTTP Server started on port " .. port)
end)