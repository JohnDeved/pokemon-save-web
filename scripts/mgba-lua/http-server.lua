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
-- Logging Utilities
--------------------------------------------------------------------------------

--- Enhanced logging that outputs to both mGBA console and stdout for Docker visibility
---@param level string
---@param message string
local function log(level, message)
    local timestamp = os.date("%H:%M:%S")
    local logMessage = string.format("[%s] %s: %s", timestamp, level, message)
    
    -- Log to mGBA console (internal log window)
    if level == "ERROR" then
        console:error(logMessage)
    else
        console:log(logMessage)
    end
    
    -- Also log to stdout so it appears in Docker console
    io.stdout:write(logMessage .. "\n")
    io.stdout:flush()
end

--- Log info message
---@param message string
local function logInfo(message)
    log("INFO", message)
end

--- Log error message  
---@param message string
local function logError(message)
    log("ERROR", message)
end

--- Log debug message
---@param message string
local function logDebug(message)
    log("DEBUG", message)
end

--------------------------------------------------------------------------------
-- "Static" Methods
--------------------------------------------------------------------------------

--- Simple JSON stringify function.
---@param val any
---@return string
function HttpServer.jsonStringify(val)
    local function escape(s)
        return s:gsub('[\\"]', {['\\']='\\\\', ['"']='\\"'})
    end
    
    local function serialize(v)
        local t = type(v)
        if t == "string" then return '"' .. escape(v) .. '"'
        elseif t == "number" or t == "boolean" then return tostring(v)
        elseif t == "nil" then return "null"
        elseif t == "table" then
            if next(v) == nil then return "{}" end
            local parts = {}
            if #v > 0 then -- Array
                for i = 1, #v do parts[i] = serialize(v[i]) end
                return "[" .. table.concat(parts, ",") .. "]"
            else -- Object
                for k, val in pairs(v) do
                    table.insert(parts, serialize(tostring(k)) .. ":" .. serialize(val))
                end
                return "{" .. table.concat(parts, ",") .. "}"
            end
        end
        return '"' .. tostring(v) .. '"'
    end
    
    return serialize(val)
end

--- CORS middleware factory.
---@param origin? string
---@return fun(req: Request, res: Response)
function HttpServer.cors(origin)
    origin = origin or "*"
    return function(req, res)
        res:setHeader("Access-Control-Allow-Origin", origin)
        res:setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        res:setHeader("Access-Control-Allow-Headers", "Content-Type")
    end
end

--- Converts binary data to Base64.
---@param data string
---@return string
local function bin2base64(data)
    local b='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    local s, i, len = '', 1, #data
    while i <= len do
        local c1, c2, c3 = data:byte(i) or 0, data:byte(i+1) or 0, data:byte(i+2) or 0
        local n = c1 * 65536 + c2 * 256 + c3
        local shifts = {18, 12, 6, 0}
        for j = 1, 4 do
            s = s .. b:sub(((n >> shifts[j]) & 63) + 1, ((n >> shifts[j]) & 63) + 1)
        end
        i = i + 3
    end
    local pad = len % 3
    if pad == 1 then s = s:sub(1, #s-2) .. '=='
    elseif pad == 2 then s = s:sub(1, #s-1) .. '=' end
    return s
end

--- Converts hexadecimal string to binary.
---@param hex string
---@return string
local function hex2bin(hex)
    return (hex:gsub('..', function(cc) return string.char(tonumber(cc, 16)) end))
end

--- Computes SHA-1 hash of a string.
--- @param msg string
--- @return string
local function sha1(msg)
    local H = {0x67452301,0xEFCDAB89,0x98BADCFE,0x10325476,0xC3D2E1F0}
    local bytes, ml = {}, #msg * 8
    for i = 1, #msg do bytes[i] = msg:byte(i) end
    table.insert(bytes, 0x80)
    while (#bytes % 64) ~= 56 do table.insert(bytes, 0) end
    for i = 1, 8 do table.insert(bytes, (ml >> (8 * (8 - i))) & 0xFF) end
    for i = 1, #bytes, 64 do
        local w = {}
        for j = 0, 15 do w[j+1] = (bytes[i+4*j] << 24 | bytes[i+4*j+1] << 16 | bytes[i+4*j+2] << 8 | bytes[i+4*j+3]) & 0xFFFFFFFF end
        for j = 17, 80 do w[j] = ((w[j-3] ~ w[j-8] ~ w[j-14] ~ w[j-16]) << 1 | (w[j-3] ~ w[j-8] ~ w[j-14] ~ w[j-16]) >> 31) & 0xFFFFFFFF end
        local a, b, c, d, e = H[1], H[2], H[3], H[4], H[5]
        for j = 1, 80 do
            local f, k = 0, 0
            if j <= 20 then f, k = (b & c) | (~b & d), 0x5A827999
            elseif j <= 40 then f, k = b ~ c ~ d, 0x6ED9EBA1
            elseif j <= 60 then f, k = (b & c) | (b & d) | (c & d), 0x8F1BBCDC
            else f, k = b ~ c ~ d, 0xCA62C1D6 end
            local temp = (((a << 5) | (a >> 27)) + f + e + k + w[j]) & 0xFFFFFFFF
            e, d, c, b, a = d, c, (b << 30 | b >> 2) & 0xFFFFFFFF, a, temp
        end
        H[1] = (H[1] + a) & 0xFFFFFFFF
        H[2] = (H[2] + b) & 0xFFFFFFFF
        H[3] = (H[3] + c) & 0xFFFFFFFF
        H[4] = (H[4] + d) & 0xFFFFFFFF
        H[5] = (H[5] + e) & 0xFFFFFFFF
    end
    return string.format('%08x%08x%08x%08x%08x',H[1],H[2],H[3],H[4],H[5])
end

--- Generates WebSocket accept key.
--- @param key string
--- @return string
function HttpServer.generateWebSocketAccept(key)
    local magic = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
    -- Per RFC6455, concatenate the original base64 key (not decoded) with the magic string
    return bin2base64(hex2bin(sha1(key .. magic)))
end

--- Creates WebSocket frame.
---@param data string
---@return string
function HttpServer.createWebSocketFrame(data)
    local len = #data
    local frame = string.char(0x81) -- FIN + text frame
    
    if len < 126 then
        frame = frame .. string.char(len)
    elseif len < 65536 then
        frame = frame .. string.char(126) .. string.char(len >> 8) .. string.char(len & 0xFF)
    else
        frame = frame .. string.char(127) .. string.rep("\0", 6) .. string.char(len >> 8) .. string.char(len & 0xFF)
    end
    
    return frame .. data
end

--- Parses WebSocket frame.
---@param data string
---@return string?, number
function HttpServer.parseWebSocketFrame(data)
    if #data < 2 then return nil, 0 end
    local b1, b2 = string.byte(data, 1, 2)
    local fin = (b1 & 0x80) ~= 0
    local opcode = b1 & 0x0F
    local masked = (b2 & 0x80) ~= 0
    local len = b2 & 0x7F
    local offset = 2
    local mask = nil
    if len == 126 then
        if #data < 4 then return nil, 0 end
        len = (string.byte(data, 3) << 8) + string.byte(data, 4)
        offset = 4
    elseif len == 127 then
        if #data < 10 then return nil, 0 end
        len = (string.byte(data, 9) << 8) + string.byte(data, 10)
        offset = 10
    end
    if masked then
        if #data < offset + 4 then return nil, 0 end
        mask = {data:byte(offset+1, offset+4)}
        offset = offset + 4
    end
    if #data < offset + len then return nil, 0 end
    if opcode == 0x8 then -- Close frame
        return nil, -1
    elseif opcode == 0x1 or opcode == 0x2 then -- Text or binary
        local payload = data:sub(offset + 1, offset + len)
        if masked and mask then
            local unmasked = {}
            for i = 1, #payload do
                unmasked[i] = string.char(payload:byte(i) ~ mask[((i-1)%4)+1])
            end
            payload = table.concat(unmasked)
        end
        return payload, offset + len
    end
    return "", offset + len
end

--------------------------------------------------------------------------------
-- "Private" Instance Methods for Connection Handling
--------------------------------------------------------------------------------

--- Closes a client connection and cleans up.
---@param clientId number
---@private
function HttpServer:_cleanup_client(clientId)
    local client = self.clients[clientId]
    if client then
        client:close()
        self.clients[clientId] = nil
    end
    
    -- Clean up WebSocket if exists
    local ws = self.websockets[clientId]
    if ws then
        if ws.onClose then ws.onClose() end
        self.websockets[clientId] = nil
    end
end


--- Parses the raw HTTP request string into a Request object.
---@param request_str string
---@return Request?
---@private
function HttpServer:_parse_request(request_str)
    local header_end = request_str:find("\r\n\r\n")
    if not header_end then return nil end

    local header_part = request_str:sub(1, header_end - 1)
    local body = request_str:sub(header_end + 4)

    local method, path = header_part:match("^(%w+)%s+([^%s]+)")
    if not method or not path then return nil end

    local headers = {}
    for k, v in string.gmatch(header_part, "([%w-]+):%s*([^\r\n]+)") do
        headers[string.lower(k)] = v
    end

    return { method = method, path = path, headers = headers, body = body }
end

--- Creates a response object.
---@param client SocketInstance
---@param clientId number
---@return Response
---@private
function HttpServer:_create_response(client, clientId)
    local server = self
    return {
        finished = false,
        _headers = {["Connection"] = "close"},
        setHeader = function(self, key, value)
            self._headers[key] = value
        end,
        send = function(self, status, body, content_type)
            if self.finished then return end
            
            -- Handle table bodies as JSON
            if type(body) == "table" then
                body = HttpServer.jsonStringify(body)
                content_type = content_type or "application/json"
            else
                body = body or ""
                content_type = content_type or "text/plain"
            end
            
            self:setHeader("Content-Type", content_type)
            self:setHeader("Content-Length", #body)
            
            -- Build response
            local lines = {"HTTP/1.1 " .. status}
            for k, v in pairs(self._headers) do
                table.insert(lines, k .. ": " .. v)
            end
            
            local response_str = table.concat(lines, "\r\n") .. "\r\n\r\n" .. body
            local ok, err = client:send(response_str)
            
            if not ok then
                logError("Send failed for client " .. clientId .. ": " .. tostring(err))
            end
            
            self.finished = true
            -- Cleanup will be handled by the server after response is sent
        end
    }
end

--- Handles client data and HTTP requests.
---@param clientId number
---@private
function HttpServer:_handle_client_data(clientId)
    local client = self.clients[clientId]
    if not client then return end

    -- Check if this is a WebSocket connection
    local ws = self.websockets[clientId]
    if ws then
        self:_handle_websocket_data(clientId)
        return
    end

    -- Read request data
    local data = ""
    repeat
        local chunk, err = client:receive(1024)
        if chunk then
            data = data .. chunk
        elseif err ~= socket.ERRORS.AGAIN then
            self:_cleanup_client(clientId)
            return
        end
    until data:find("\r\n\r\n") or not chunk

    if data == "" then return end

    -- Parse and handle request
    local req = self:_parse_request(data)
    if not req then
        self:_cleanup_client(clientId)
        return
    end

    -- Check for WebSocket upgrade
    if self:_is_websocket_request(req) then
        self:_handle_websocket_upgrade(clientId, req)
        return
    end

    local res = self:_create_response(client, clientId)
    self:_handle_request(req.method, req.path, req, res)

    -- Send 404 if no handler responded
    if not res.finished then
        res:send("404 Not Found", "Not Found")
    end
end

--- Handles HTTP requests through middleware and routes.
---@param method string
---@param path string
---@param req Request
---@param res Response
---@private
function HttpServer:_handle_request(method, path, req, res)
    -- Execute global middlewares
    for _, middleware in ipairs(self.middlewares) do
        middleware(req, res)
        if res.finished then return end
    end
    
    -- Execute route handlers
    local handlers = self.routes[method] and self.routes[method][path]
    if handlers then
        for _, handler in ipairs(handlers) do
            handler(req, res)
            if res.finished then return end
        end
    end
end

--- Checks if request is a WebSocket upgrade.
---@param req Request
---@return boolean
---@private
function HttpServer:_is_websocket_request(req)
    return req.headers.upgrade == "websocket" and 
           req.headers.connection and req.headers.connection:lower():find("upgrade") ~= nil and
           req.headers["sec-websocket-key"] ~= nil
end

--- Handles WebSocket upgrade handshake.
---@param clientId number
---@param req Request
---@private
function HttpServer:_handle_websocket_upgrade(clientId, req)
    local client = self.clients[clientId]
    if not client then return end
    
    local wsKey = req.headers["sec-websocket-key"]
    local accept = HttpServer.generateWebSocketAccept(wsKey)
    local response = "HTTP/1.1 101 Switching Protocols\r\n" ..
                    "Upgrade: websocket\r\n" ..
                    "Connection: Upgrade\r\n" ..
                    "Sec-WebSocket-Accept: " .. accept .. "\r\n\r\n"
    
    local ok, err = client:send(response)
    if not ok then
        logError("WebSocket handshake failed for client " .. clientId .. ": " .. tostring(err))
        self:_cleanup_client(clientId)
        return
    end
    -- Create WebSocket instance
    local ws = {
        id = clientId,
        client = client,
        path = req.path,
        send = function(self, data)
            local frame = HttpServer.createWebSocketFrame(data)
            self.client:send(frame)
        end,
        close = function(self)
            local closeFrame = string.char(0x88, 0x00) -- Close frame
            self.client:send(closeFrame)
        end
    }
    self.websockets[clientId] = ws
    -- Call WebSocket route handler
    local handler = self.wsRoutes[req.path]
    if handler then
        handler(ws)
    end
end

--- Handles WebSocket frame data.
---@param clientId number
---@private
function HttpServer:_handle_websocket_data(clientId)
    local client = self.clients[clientId]
    local ws = self.websockets[clientId]
    if not client or not ws then return end
    
    local chunk, err = client:receive(1024)
    if not chunk then
        if err ~= socket.ERRORS.AGAIN then
            self:_cleanup_client(clientId)
        end
        return
    end
    
    local message, consumed = HttpServer.parseWebSocketFrame(chunk)
    if consumed == -1 then -- Close frame
        self:_cleanup_client(clientId)
        return
    elseif message and ws.onMessage then
        ws.onMessage(message)
    end
end

--- Accepts and configures new client connections.
---@private
function HttpServer:_accept_client()
    if not self.server then return end
    
    local client, err = self.server:accept()
    if not client or err then return end
    
    local id = self.nextClientId
    self.nextClientId = id + 1
    self.clients[id] = client
    
    client:add("received", function() self:_handle_client_data(id) end)
    client:add("error", function() self:_cleanup_client(id) end)
end

--------------------------------------------------------------------------------
-- Public Instance Methods
--------------------------------------------------------------------------------

--- Creates a new HttpServer instance.
---@return HttpServer
function HttpServer:new()
    return setmetatable({
        routes = {GET = {}, POST = {}, PUT = {}, DELETE = {}, OPTIONS = {}},
        middlewares = {},
        clients = {},
        websockets = {},
        wsRoutes = {},
        nextClientId = 1,
        server = nil
    }, HttpServer)
end

--- Registers global middleware.
---@param middleware fun(req: Request, res: Response)
function HttpServer:use(middleware)
    table.insert(self.middlewares, middleware)
end

--- Registers route handlers for any HTTP method.
---@param method string
---@param path string
---@vararg fun(req: Request, res: Response)
function HttpServer:route(method, path, ...)
    if not self.routes[method] then
        self.routes[method] = {}
    end
    self.routes[method][path] = {...}
end

--- Registers GET route handlers.
---@param path string
---@vararg fun(req: Request, res: Response)
function HttpServer:get(path, ...)
    self:route("GET", path, ...)
end

--- Registers POST route handlers.
---@param path string
---@vararg fun(req: Request, res: Response)
function HttpServer:post(path, ...)
    self:route("POST", path, ...)
end

--- Registers WebSocket route handlers.
---@param path string
---@param handler fun(ws: WebSocket)
function HttpServer:websocket(path, handler)
    self.wsRoutes[path] = handler
end

--- Starts the HTTP server on the specified port.
---@param port number
---@param callback? fun(port: number)
function HttpServer:listen(port, callback)
    local function start_server()
        local server, err

        -- Try to bind to the port, incrementing if in use
        repeat
            server, err = socket.bind(nil, port)
            if err == socket.ERRORS.ADDRESS_IN_USE then
                port = port + 1
            elseif err then
                logError("Error binding server: " .. tostring(err))
                return
            end
        until server

        -- Start listening
        local ok, listen_err = server:listen()
        if listen_err then
            server:close()
            logError("Error listening: " .. tostring(listen_err))
            return
        end

        self.server = server
        server:add("received", function() self:_accept_client() end)

        if callback then callback(port) end
    end

    if emu and emu.romSize and emu:romSize() > 0 then
        -- ROM is already loaded, start server immediately
        start_server()
    else
        -- ROM not loaded, register callback to start server later
        logInfo("🕹️ mGBA HTTP Server is initializing. Waiting for ROM to be loaded in the emulator...")
        local cbid
        cbid = callbacks:add("start", function()
            if not emu or not emu.romSize or emu:romSize() == 0 then
                logError("No ROM loaded. HTTP server will not start.")
                return
            end
            start_server()
            callbacks:remove(cbid)
        end)
    end
end

--------------------------------------------------------------------------------
-- Example Usage
--------------------------------------------------------------------------------

local app = HttpServer:new()

-- Global middleware
app:use(function(req, res)
    logInfo(req.method .. " " .. req.path .. " - Headers: " .. HttpServer.jsonStringify(req.headers))
end)

-- Routes
app:get("/", function(req, res)
    res:send("200 OK", "Welcome to mGBA HTTP Server! Playing " .. emu:getGameTitle())
end)

app:get("/json", HttpServer.cors(), function(req, res)
    res:send("200 OK", {message = "Hello, JSON!", timestamp = os.time()})
end)

app:post("/echo", function(req, res)
    res:send("200 OK", req.body, req.headers['content-type'])
end)

-- Memory watching state for WebSocket connections
local memoryWatchers = {}

-- Simple JSON parser for WebSocket messages - handles specific patterns we expect
local function parseJSON(str)
    if not str or str == "" then
        return nil, "Empty JSON string"
    end
    
    str = str:gsub("^%s*(.-)%s*$", "%1") -- trim whitespace
    
    -- Handle the simple case we expect: {"type":"watch","regions":[...]}
    if str:match('^%s*{%s*"type"%s*:%s*"watch"') then
        local result = { type = "watch" }
        
        -- Extract regions array
        local regionsMatch = str:match('"regions"%s*:%s*%[(.-)%]')
        if regionsMatch then
            result.regions = {}
            
            -- Simple parser for objects like {"address":123,"size":7}
            for objMatch in regionsMatch:gmatch('{[^}]*}') do
                local obj = {}
                
                -- Extract address
                local address = objMatch:match('"address"%s*:%s*(%d+)')
                if address then
                    obj.address = tonumber(address)
                end
                
                -- Extract size
                local size = objMatch:match('"size"%s*:%s*(%d+)')
                if size then
                    obj.size = tonumber(size)
                end
                
                if obj.address and obj.size then
                    table.insert(result.regions, obj)
                end
            end
        end
        
        return result
    end
    
    return nil, "Unsupported JSON format"
end

-- WebSocket route for Lua code evaluation
app:websocket("/eval", function(ws)
    logInfo("WebSocket connected to eval endpoint: " .. ws.path)

    ws.onMessage = function(message)
        local function safe_handler()
            logDebug("WebSocket eval message: " .. tostring(message))
            
            local chunk = message
            
            -- Enhanced support for non-self-executing function inputs
            -- Check if it's already a complete statement or needs a return prefix
            if not message:match("^%s*(return|local|function|for|while|if|do|repeat|goto|break|::|end|%(function)") then
                chunk = "return " .. message
            end
            
            local fn, err = load(chunk, "websocket-eval")
            if not fn then
                ws:send(HttpServer.jsonStringify({error = err or "Invalid code"}))
                return
            end
            local ok, result = pcall(fn)
            if ok then
                ws:send(HttpServer.jsonStringify({result = result}))
            else
                ws:send(HttpServer.jsonStringify({error = tostring(result)}))
                logError("WebSocket Eval Error: " .. tostring(result))
            end
        end
        local ok, err = pcall(safe_handler)
        if not ok then
            ws:send(HttpServer.jsonStringify({error = "Internal server error: " .. tostring(err)}))
            logError("WebSocket Handler Error: " .. tostring(err))
        end
    end

    ws.onClose = function()
        logInfo("WebSocket disconnected from eval endpoint: " .. ws.path)
    end

    ws:send("Welcome to WebSocket Eval! Send Lua code to execute.")
end)

-- WebSocket route for memory watching
app:websocket("/watch", function(ws)
    logInfo("WebSocket connected to watch endpoint: " .. ws.path)

    -- Initialize memory watcher for this connection
    memoryWatchers[ws.id] = {
        regions = {},
        lastData = {}
    }

    ws.onMessage = function(message)
        local function safe_handler()
            logDebug("WebSocket watch message: " .. tostring(message))
            
            -- Parse JSON message for memory watching
            local parsed, parseErr = parseJSON(message)
            if not parsed or type(parsed) ~= "table" or not parsed.type then
                ws:send(HttpServer.jsonStringify({
                    type = "error",
                    error = "Invalid message format - JSON object with 'type' field required"
                }))
                return
            end
                
            if parsed.type == "watch" then
                -- Handle memory region watching request
                if parsed.regions and type(parsed.regions) == "table" then
                    logInfo("Setting up memory watch for " .. #parsed.regions .. " regions")
                    local watcher = memoryWatchers[ws.id]
                    watcher.regions = parsed.regions
                    watcher.lastData = {}
                    
                    -- Initialize baseline data for each region
                    for i, region in ipairs(parsed.regions) do
                        if region.address and region.size then
                            local data = emu:readRange(region.address, region.size)
                            watcher.lastData[i] = data
                        end
                    end
                    
                    ws:send(HttpServer.jsonStringify({
                        type = "watchConfirm",
                        message = "Watching " .. #parsed.regions .. " memory regions"
                    }))
                else
                    ws:send(HttpServer.jsonStringify({
                        type = "error",
                        error = "Invalid watch request - regions array required"
                    }))
                end
            else
                ws:send(HttpServer.jsonStringify({
                    type = "error",
                    error = "Unknown message type: " .. tostring(parsed.type)
                }))
            end
        end
        local ok, err = pcall(safe_handler)
        if not ok then
            ws:send(HttpServer.jsonStringify({type = "error", error = "Internal server error: " .. tostring(err)}))
            logError("WebSocket Watch Handler Error: " .. tostring(err))
        end
    end

    ws.onClose = function()
        logInfo("WebSocket disconnected from watch endpoint: " .. ws.path)
        -- Cleanup memory watcher
        memoryWatchers[ws.id] = nil
    end

    ws:send(HttpServer.jsonStringify({
        type = "welcome",
        message = "Welcome to WebSocket Memory Watching! Send JSON messages with 'type': 'watch' to monitor memory regions."
    }))
end)

-- Frame callback for memory change detection
local frameCallbackId = nil

local function checkMemoryChanges()
    for wsId, watcher in pairs(memoryWatchers) do
        local ws = app.websockets[wsId]
        -- Only process watchers for connections on the /watch endpoint
        if ws and ws.path == "/watch" and #watcher.regions > 0 then
            local changedRegions = {}
            
            for i, region in ipairs(watcher.regions) do
                if region.address and region.size then
                    local currentData = emu:readRange(region.address, region.size)
                    if currentData ~= watcher.lastData[i] then
                        -- Memory changed, prepare update
                        local bytes = {}
                        for j = 1, #currentData do
                            bytes[j] = string.byte(currentData, j)
                        end
                        
                        table.insert(changedRegions, {
                            address = region.address,
                            size = region.size,
                            data = bytes
                        })
                        
                        -- Update stored data
                        watcher.lastData[i] = currentData
                    end
                end
            end
            
            -- Send memory update if any regions changed
            if #changedRegions > 0 then
                ws:send(HttpServer.jsonStringify({
                    type = "memoryUpdate",
                    regions = changedRegions,
                    timestamp = os.time()
                }))
            end
        end
    end
end

-- Register frame callback to monitor memory changes
local function setupMemoryMonitoring()
    if frameCallbackId then
        callbacks:remove(frameCallbackId)
    end
    frameCallbackId = callbacks:add("frame", checkMemoryChanges)
    logInfo("🔍 Memory monitoring callback registered")
end

-- Setup monitoring when ROM is loaded
if emu and emu.romSize and emu:romSize() > 0 then
    setupMemoryMonitoring()
else
    local cbid
    cbid = callbacks:add("start", function()
        setupMemoryMonitoring()
        callbacks:remove(cbid)
    end)
end

-- Start server
app:listen(7102, function(port)
    logInfo("🚀 mGBA HTTP Server started on port " .. port)
end)
