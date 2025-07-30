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
-- Simplified Logging Utilities
--------------------------------------------------------------------------------

--- Streamlined logging to mGBA console and stdout
---@param level string
---@param message string
local function log(level, message)
    local msg = string.format("[%s] %s: %s", os.date("%H:%M:%S"), level, message)
    console:log(msg)
    io.stdout:write(msg .. "\n")
    io.stdout:flush()
end

local function logInfo(message) log("INFO", message) end
local function logError(message) log("ERROR", message) end

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
                    parts[#parts + 1] = serialize(tostring(k)) .. ":" .. serialize(val)
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

--- Optimized WebSocket frame parsing with essential frame type handling
---@param data string
---@return string?, number, string?
function HttpServer.parseWebSocketFrame(data)
    if #data < 2 then return nil, 0, "incomplete_frame" end
    
    local b1, b2 = string.byte(data, 1, 2)
    local opcode = b1 & 0x0F
    local masked = (b2 & 0x80) ~= 0
    local len = b2 & 0x7F
    local offset = 2
    
    -- Handle extended payload length
    if len == 126 then
        if #data < 4 then return nil, 0, "incomplete_frame" end
        len = (string.byte(data, 3) << 8) + string.byte(data, 4)
        offset = 4
    elseif len == 127 then
        if #data < 10 then return nil, 0, "incomplete_frame" end
        len = (string.byte(data, 9) << 8) + string.byte(data, 10)
        offset = 10
    end
    
    -- Handle masking
    if masked then
        if #data < offset + 4 then return nil, 0, "incomplete_frame" end
        local mask = {data:byte(offset+1, offset+4)}
        offset = offset + 4
        
        if #data < offset + len then return nil, 0, "incomplete_frame" end
        
        -- Extract and unmask payload
        local payload = data:sub(offset + 1, offset + len)
        local unmasked = {}
        for i = 1, #payload do
            unmasked[i] = string.char(payload:byte(i) ~ mask[((i-1)%4)+1])
        end
        payload = table.concat(unmasked)
        
        -- Handle frame types
        if opcode == 0x1 then return payload, offset + len, "text"
        elseif opcode == 0x8 then return nil, -1, "close"
        elseif opcode == 0x9 then return nil, offset + len, "ping"
        else return nil, offset + len, "unknown" end
    else
        if #data < offset + len then return nil, 0, "incomplete_frame" end
        local payload = data:sub(offset + 1, offset + len)
        
        if opcode == 0x1 then return payload, offset + len, "text"
        elseif opcode == 0x8 then return nil, -1, "close"
        elseif opcode == 0x9 then return nil, offset + len, "ping"
        else return nil, offset + len, "unknown" end
    end
end

--------------------------------------------------------------------------------
-- "Private" Instance Methods for Connection Handling
--------------------------------------------------------------------------------

--- Closes a client connection and cleans up with enhanced state management.
---@param clientId number
---@private
function HttpServer:_cleanup_client(clientId)
    local client = self.clients[clientId]
    if client then
        pcall(client.close, client)  -- Protect against close errors
        self.clients[clientId] = nil
    end
    
    -- Clean up WebSocket if exists
    local ws = self.websockets[clientId]
    if ws then
        -- Call onClose handler safely
        if ws.onClose then 
            local ok, err = pcall(ws.onClose)
            if not ok then
                logError("WebSocket onClose handler failed for " .. clientId .. ": " .. tostring(err))
            end
        end
        self.websockets[clientId] = nil
    end
end


--- Parses the raw HTTP request string into a Request object.
---@param request_str string
---@return Request?
---@private
function HttpServer:_parse_request(request_str)
    local header_end = request_str:find("\r\n\r\n")
    if not header_end then 
        logInfo("Failed to find request header end")
        return nil 
    end

    local header_part = request_str:sub(1, header_end - 1)
    local body = request_str:sub(header_end + 4)

    local method, path = header_part:match("^(%w+)%s+([^%s]+)")
    if not method or not path then 
        logInfo("Failed to parse method and path from: " .. header_part:sub(1, 50))
        return nil 
    end

    local headers = {}
    for k, v in string.gmatch(header_part, "([%w-]+):%s*([^\r\n]+)") do
        headers[string.lower(k)] = v
    end

    -- Debug log for WebSocket requests
    if headers.upgrade or headers.connection then
        logInfo("Parsed request: " .. method .. " " .. path .. " (upgrade=" .. tostring(headers.upgrade) .. ", connection=" .. tostring(headers.connection) .. ")")
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

--- Handles client data and HTTP requests with improved robustness.
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

    -- Read request data with better error handling and increased buffer
    local data = ""
    local maxChunks = 50  -- Reduced to prevent excessive loops
    local chunks = 0
    local maxDataSize = 8192  -- Limit to prevent memory issues
    
    repeat
        chunks = chunks + 1
        local chunk, err = client:receive(2048)  -- Increased chunk size
        if chunk then
            data = data .. chunk
            -- Prevent excessive data accumulation
            if #data > maxDataSize then
                logError("Request too large for client " .. clientId)
                self:_cleanup_client(clientId)
                return
            end
        elseif err == socket.ERRORS.AGAIN then
            -- Non-blocking mode - data not ready yet
            if #data > 0 and data:find("\r\n\r\n") then
                -- We have a complete request even though more data might be coming
                break
            end
            -- Wait a bit for more data if we don't have complete headers
            break
        elseif err then
            -- Connection error
            logInfo("Client " .. clientId .. " connection error: " .. tostring(err))
            self:_cleanup_client(clientId)
            return
        else
            -- No chunk and no error - connection closed
            break
        end
    until data:find("\r\n\r\n") or chunks >= maxChunks

    if data == "" then return end
    
    -- Check if we have complete headers
    if not data:find("\r\n\r\n") then
        logInfo("Incomplete request from client " .. clientId .. " (size: " .. #data .. ")")
        -- Don't cleanup immediately, might get more data later
        return
    end

    -- Parse and handle request with better error handling
    local req = self:_parse_request(data)
    if not req then
        logError("Failed to parse HTTP request for client " .. clientId)
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
    
    -- Clean up after handling HTTP request (not WebSocket)
    self:_cleanup_client(clientId)
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
    -- Headers are already lowercase from parsing
    local upgrade = req.headers.upgrade
    local connection = req.headers.connection
    local wsKey = req.headers["sec-websocket-key"]
    
    -- Debug logging for failed WebSocket detection
    if not upgrade or upgrade ~= "websocket" then
        logInfo("WebSocket detection failed: upgrade=" .. tostring(upgrade))
        return false
    end
    
    if not connection or not connection:lower():find("upgrade") then
        logInfo("WebSocket detection failed: connection=" .. tostring(connection))
        return false
    end
    
    if not wsKey then
        logInfo("WebSocket detection failed: missing sec-websocket-key")
        return false
    end
    
    logInfo("WebSocket upgrade detected for " .. req.path)
    return true
end

--- Handles WebSocket upgrade handshake with enhanced reliability.
---@param clientId number
---@param req Request
---@private
function HttpServer:_handle_websocket_upgrade(clientId, req)
    local client = self.clients[clientId]
    if not client then 
        logError("WebSocket upgrade failed: client " .. clientId .. " not found")
        return 
    end
    
    logInfo("Starting WebSocket handshake for client " .. clientId .. " on path " .. req.path)
    
    local wsKey = req.headers["sec-websocket-key"]
    if not wsKey then
        logError("WebSocket upgrade failed: missing sec-websocket-key")
        self:_cleanup_client(clientId)
        return
    end
    
    local accept = HttpServer.generateWebSocketAccept(wsKey)
    local response = "HTTP/1.1 101 Switching Protocols\r\n" ..
                    "Upgrade: websocket\r\n" ..
                    "Connection: Upgrade\r\n" ..
                    "Sec-WebSocket-Accept: " .. accept .. "\r\n\r\n"
    
    logInfo("Sending WebSocket handshake response for client " .. clientId)
    local ok, err = client:send(response)
    if not ok then
        logError("WebSocket handshake failed for client " .. clientId .. ": " .. tostring(err))
        self:_cleanup_client(clientId)
        return
    end
    
    logInfo("WebSocket handshake sent successfully for client " .. clientId)
    
    -- Create WebSocket instance with enhanced error handling
    local ws = {
        id = clientId,
        client = client,
        path = req.path,
        send = function(self, data)
            if not self.client then return false end
            local frame = HttpServer.createWebSocketFrame(data)
            return pcall(self.client.send, self.client, frame)
        end,
        close = function(self)
            if not self.client then return end
            local closeFrame = string.char(0x88, 0x00) -- Close frame
            pcall(self.client.send, self.client, closeFrame)
        end
    }
    
    self.websockets[clientId] = ws
    logInfo("WebSocket instance created for client " .. clientId)
    
    -- Call WebSocket route handler with error protection
    local handler = self.wsRoutes[req.path]
    if handler then
        logInfo("Calling WebSocket handler for path " .. req.path)
        local ok, err = pcall(handler, ws)
        if not ok then
            logError("WebSocket handler failed for " .. req.path .. ": " .. tostring(err))
            self:_cleanup_client(clientId)
        else
            logInfo("WebSocket handler completed successfully for " .. req.path)
        end
    else
        logError("No WebSocket handler found for path: " .. req.path)
        self:_cleanup_client(clientId)
    end
end

--- Streamlined WebSocket frame handling
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
    
    local message, consumed, frameType = HttpServer.parseWebSocketFrame(chunk)
    if consumed == -1 then -- Close frame
        self:_cleanup_client(clientId)
    elseif frameType == "ping" then
        client:send(string.char(0x8A, 0x00)) -- Pong response
    elseif (frameType == "text" or frameType == "binary") and message and #message > 0 and ws.onMessage then
        ws.onMessage(message)
    end
end

--- Accepts and configures new client connections with enhanced error handling.
---@private
function HttpServer:_accept_client()
    if not self.server then return end
    
    local client, err = self.server:accept()
    if not client then 
        if err and err ~= socket.ERRORS.AGAIN then
            logError("Failed to accept client: " .. tostring(err))
        end
        return 
    end
    
    local id = self.nextClientId
    self.nextClientId = id + 1
    self.clients[id] = client
    
    -- Add error handling to client event listeners
    local ok1, err1 = pcall(client.add, client, "received", function() 
        local success, error = pcall(self._handle_client_data, self, id)
        if not success then
            logError("Client data handler failed for " .. id .. ": " .. tostring(error))
            self:_cleanup_client(id)
        end
    end)
    
    local ok2, err2 = pcall(client.add, client, "error", function() 
        logError("Client " .. id .. " error event triggered")
        self:_cleanup_client(id) 
    end)
    
    if not ok1 then
        logError("Failed to add received handler: " .. tostring(err1))
        self:_cleanup_client(id)
    end
    
    if not ok2 then
        logError("Failed to add error handler: " .. tostring(err2))
        self:_cleanup_client(id)
    end
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

-- Simplified middleware for essential logging only
app:use(function(req, res)
    -- Only log non-favicon requests to reduce noise
    if not req.path:find("favicon") then
        logInfo(req.method .. " " .. req.path)
    end
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

-- Optimized message parser for WebSocket messages
local function parseWebSocketMessage(str)
    if not str or str == "" then return nil, "Empty message" end
    
    str = str:gsub("^%s*(.-)%s*$", "%1") -- trim whitespace
    local lines = {}
    for line in str:gmatch("([^\r\n]+)") do
        lines[#lines + 1] = line:gsub("^%s*(.-)%s*$", "%1")
    end
    
    if #lines > 0 and lines[1]:upper() == "WATCH" then
        local regions = {}
        for i = 2, #lines do
            local address, size = lines[i]:match("^(%d+),(%d+)$")
            if address and size then
                local addr, sz = tonumber(address), tonumber(size)
                if addr and sz and addr >= 0 and sz > 0 and sz <= 0x10000 then
                    regions[#regions + 1] = { address = addr, size = sz }
                end
            end
        end
        return { type = "watch", regions = regions }
    end
    
    return nil, "Unsupported format"
end

-- Enhanced connection tracking with rate limiting
local activeEvalConnections = 0
local activeWatchConnections = 0
local maxConcurrentEvals = 200  -- Increased capacity
local maxConcurrentWatchers = 100 -- Increased capacity

-- Rate limiting per connection
local connectionRateLimits = {}
local RATE_LIMIT_WINDOW = 1000 -- 1 second
local MAX_REQUESTS_PER_WINDOW = 10

-- Enhanced WebSocket route for Lua code evaluation with improved connection reliability
app:websocket("/eval", function(ws)
    if activeEvalConnections >= maxConcurrentEvals then
        local ok = pcall(ws.send, ws, HttpServer.jsonStringify({ error = "Server at capacity" }))
        if ok then pcall(ws.close, ws) end
        return
    end

    activeEvalConnections = activeEvalConnections + 1
    logInfo("Eval WebSocket connected: " .. ws.id .. " (active: " .. activeEvalConnections .. ")")
    
    -- Initialize rate limiting for this connection
    connectionRateLimits[ws.id] = {
        lastReset = os.time() * 1000,
        requestCount = 0
    }

    ws.onMessage = function(message)
        if not message or type(message) ~= "string" then return end
        
        -- Check rate limit
        local now = os.time() * 1000
        local limit = connectionRateLimits[ws.id]
        if not limit then
            limit = { lastReset = now, requestCount = 0 }
            connectionRateLimits[ws.id] = limit
        end
        
        if now - limit.lastReset > RATE_LIMIT_WINDOW then
            limit.lastReset = now
            limit.requestCount = 0
        end
        
        limit.requestCount = limit.requestCount + 1
        if limit.requestCount > MAX_REQUESTS_PER_WINDOW then
            ws:send(HttpServer.jsonStringify({error = "Rate limit exceeded"}))
            return
        end
        
        local code = message:gsub("^%s*(.-)%s*$", "%1")
        if #code == 0 then return end
        
        -- Smart code completion - improved detection
        if not code:match("^%s*return%s") and 
           not code:match("^%s*local%s") and 
           not code:match("^%s*function%s") and 
           not code:match("^%s*for%s") and
           not code:match("^%s*while%s") and 
           not code:match("^%s*if%s") and
           not code:match("^%s*do%s") and 
           not code:match("^%s*repeat%s") and
           not code:match("^%s*[%a_][%w_]*%s*[=%(]") then
            code = "return " .. code
        end
        
        local fn, err = load(code, "websocket-eval")
        if fn then
            local ok, result = pcall(fn)
            ws:send(HttpServer.jsonStringify(ok and {result = result} or {error = tostring(result)}))
        else
            ws:send(HttpServer.jsonStringify({error = err or "Invalid code"}))
        end
    end

    ws.onClose = function()
        logInfo("Eval WebSocket disconnected: " .. ws.id)
        activeEvalConnections = math.max(0, activeEvalConnections - 1)
        if connectionRateLimits[ws.id] then
            connectionRateLimits[ws.id] = nil
        end
    end

    -- Delay welcome message slightly to ensure WebSocket is fully established
    -- This prevents immediate disconnection if the client isn't ready
    local welcome_callback_id = callbacks:add("frame", function()
        if ws and ws.client then
            -- Send JSON welcome message like watch endpoint
            local ok, err = pcall(ws.send, ws, HttpServer.jsonStringify({
                type = "welcome",
                message = "WebSocket Eval Ready! Send Lua code to execute.",
                limits = { rateLimit = MAX_REQUESTS_PER_WINDOW .. " per " .. RATE_LIMIT_WINDOW .. "ms" }
            }))
            if not ok then
                logError("Failed to send eval welcome message: " .. tostring(err))
                -- Don't force cleanup here, let the connection stabilize
            else
                logInfo("Eval welcome message sent to " .. ws.id)
            end
        end
        -- Remove this callback after one execution
        callbacks:remove(welcome_callback_id)
    end)
end)

-- Memory watching state
local memoryWatchers = {}

-- Enhanced WebSocket route for memory watching with improved reliability
app:websocket("/watch", function(ws)
    -- Connection limit check
    if activeWatchConnections >= maxConcurrentWatchers then
        local ok = pcall(ws.send, ws, HttpServer.jsonStringify({
            type = "error",
            error = "Server at capacity"
        }))
        if ok then pcall(ws.close, ws) end
        return
    end

    -- Initialize memory watcher state
    memoryWatchers[ws.id] = {
        regions = {},
        lastData = {},
        errorCount = 0
    }
    activeWatchConnections = activeWatchConnections + 1
    logInfo("Watch WebSocket connected: " .. ws.id .. " (active: " .. activeWatchConnections .. ")")

    ws.onMessage = function(message)
        if not message or type(message) ~= "string" then return end
        
        local parsed = parseWebSocketMessage(message:gsub("^%s*(.-)%s*$", "%1"))
        if not parsed or parsed.type ~= "watch" then
            ws:send(HttpServer.jsonStringify({
                type = "error",
                error = "Invalid message format"
            }))
            return
        end
        
        if not parsed.regions or #parsed.regions == 0 or #parsed.regions > 50 then
            ws:send(HttpServer.jsonStringify({
                type = "error",
                error = "Invalid regions"
            }))
            return
        end
        
        local watcher = memoryWatchers[ws.id]
        if not watcher then
            memoryWatchers[ws.id] = { regions = {}, lastData = {}, errorCount = 0 }
            watcher = memoryWatchers[ws.id]
        end
        
        watcher.regions = parsed.regions
        watcher.lastData = {}
        watcher.errorCount = 0
        
        -- Initialize baseline data efficiently
        for i, region in ipairs(parsed.regions) do
            local ok, data = pcall(emu.readRange, emu, region.address, region.size)
            watcher.lastData[i] = ok and data or ""
        end
        
        ws:send(HttpServer.jsonStringify({
            type = "watchConfirm",
            message = "Watching " .. #parsed.regions .. " memory regions"
        }))
    end

    ws.onClose = function()
        logInfo("Watch WebSocket disconnected: " .. ws.id)
        if memoryWatchers[ws.id] then
            memoryWatchers[ws.id] = nil
            activeWatchConnections = math.max(0, activeWatchConnections - 1)
        end
    end

    -- Delay welcome message slightly to ensure WebSocket is fully established
    local welcome_callback_id = callbacks:add("frame", function()
        if ws and ws.client then
            local ok, err = pcall(ws.send, ws, HttpServer.jsonStringify({
                type = "welcome",
                message = "Memory Watching Ready! Send WATCH messages with regions.",
                limits = { maxRegions = 50, maxRegionSize = 65536 }
            }))
            
            if not ok then
                logError("Failed to send watch welcome message: " .. tostring(err))
                -- Don't force cleanup here, let the connection stabilize
            else
                logInfo("Watch welcome message sent to " .. ws.id)
            end
        end
        -- Remove this callback after one execution
        callbacks:remove(welcome_callback_id)
    end)
end)

-- Optimized memory change detection callback
local frameCount = 0

local function checkMemoryChanges()
    frameCount = frameCount + 1
    
    -- Check every 8 frames (improved from 10 frames for better responsiveness)
    if frameCount % 8 ~= 0 then return end
    
    for wsId, watcher in pairs(memoryWatchers) do
        local ws = app.websockets[wsId]
        if not ws then
            memoryWatchers[wsId] = nil
            activeWatchConnections = math.max(0, activeWatchConnections - 1)
            goto continue
        end
        
        if #watcher.regions == 0 or watcher.errorCount > 5 then
            goto continue
        end
        
        local changedRegions = {}
        
        for i, region in ipairs(watcher.regions) do
            local ok, currentData = pcall(emu.readRange, emu, region.address, region.size)
            
            if not ok then
                watcher.errorCount = watcher.errorCount + 1
                goto continue_region
            end
            
            if currentData ~= watcher.lastData[i] then
                local bytes = {}
                for j = 1, math.min(#currentData, region.size) do
                    bytes[j] = string.byte(currentData, j) or 0
                end
                
                changedRegions[#changedRegions + 1] = {
                    address = region.address,
                    size = region.size,
                    data = bytes
                }
                
                watcher.lastData[i] = currentData
            end
            
            ::continue_region::
        end
        
        -- Send memory update if any regions changed
        if #changedRegions > 0 then
            local ok = pcall(ws.send, ws, HttpServer.jsonStringify({
                type = "memoryUpdate",
                regions = changedRegions,
                timestamp = os.time()
            }))
            
            if not ok then
                watcher.errorCount = watcher.errorCount + 1
                if watcher.errorCount > 3 then
                    memoryWatchers[wsId] = nil
                    activeWatchConnections = math.max(0, activeWatchConnections - 1)
                end
            end
        end
        
        ::continue::
    end
end

-- Streamlined setup and monitoring initialization
local function setupMemoryMonitoring()
    callbacks:add("frame", checkMemoryChanges)
    logInfo("🔍 Memory monitoring callback registered")
end

-- Initialize monitoring based on ROM availability
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
