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
-- Logging wrappers that output to both mGBA console and stdout/stderr for Docker
--------------------------------------------------------------------------------

--- Log wrapper function that outputs to both console and stdout for Docker visibility
---@param message string
local function log(message)
    console:log(message)
    io.stdout:write("[mGBA] " .. message .. "\n")
    io.stdout:flush()
end

--- Error wrapper function that outputs to both console and stderr for Docker visibility  
---@param message string
local function error(message)
    console:error(message)
    io.stderr:write("[mGBA ERROR] " .. message .. "\n")
    io.stderr:flush()
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
                error("Send failed for client " .. clientId .. ": " .. tostring(err))
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
        error("WebSocket handshake failed for client " .. clientId .. ": " .. tostring(err))
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
                error("Error binding server: " .. tostring(err))
                return
            end
        until server

        -- Start listening
        local ok, listen_err = server:listen()
        if listen_err then
            server:close()
            error("Error listening: " .. tostring(listen_err))
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
        log("🕹️ mGBA HTTP Server is initializing. Waiting for ROM to be loaded in the emulator...")
        local cbid
        cbid = callbacks:add("start", function()
            if not emu or not emu.romSize or emu:romSize() == 0 then
                error("No ROM loaded. HTTP server will not start.")
                return
            end
            start_server()
            callbacks:remove(cbid)
        end)
    end
end

--------------------------------------------------------------------------------
-- Handlers
--------------------------------------------------------------------------------

-- WebSocket handler function
local function handleWebSocketConnection(ws)
    log("WebSocket connected: " .. ws.path)
    
    -- Memory watching state
    local watchedRegions = {}
    local lastData = {}
    local watchCallback = nil
    
    local function parseWatchMessage(message)
        local lines = {}
        for line in message:gmatch("[^\n]+") do
            table.insert(lines, line)
        end
        
        if #lines == 0 or lines[1] ~= "watch" then
            return nil
        end
        
        local regions = {}
        for i = 2, #lines do
            local parts = {}
            for part in lines[i]:gmatch("[^,]+") do
                table.insert(parts, part)
            end
            if #parts == 2 then
                local address = tonumber(parts[1])
                local size = tonumber(parts[2])
                if address and size then
                    table.insert(regions, {address = address, size = size})
                end
            end
        end
        
        return regions
    end
    
    local function checkMemoryChanges()
        for _, region in ipairs(watchedRegions) do
            local key = region.address .. "_" .. region.size
            local newData = {}
            
            -- Read memory data
            for i = 0, region.size - 1 do
                newData[i + 1] = emu:read8(region.address + i)
            end
            
            -- Check if data changed
            local changed = false
            local oldData = lastData[key]
            if not oldData then
                changed = true
            else
                for i = 1, #newData do
                    if newData[i] ~= oldData[i] then
                        changed = true
                        break
                    end
                end
            end
            
            if changed then
                lastData[key] = newData
                -- Send update to client
                local updateMessage = {
                    command = "watch",
                    status = "update",
                    updates = {{
                        address = region.address,
                        size = region.size,
                        data = newData
                    }}
                }
                ws:send(HttpServer.jsonStringify(updateMessage))
            end
        end
    end

    ws.onMessage = function(message)
        log("WebSocket message: " .. tostring(message))
        
        -- Check if this is a watch command
        local regions = parseWatchMessage(message)
        if regions then
            watchedRegions = regions
            lastData = {}
            
            if #regions > 0 then
                log("Starting memory watching for " .. #regions .. " regions")
                
                -- Set up memory watching callback
                if watchCallback then
                    callbacks:remove(watchCallback)
                end
                
                watchCallback = callbacks:add("frame", checkMemoryChanges)
                
                local response = {
                    command = "watch",
                    status = "success",
                    message = "Watching " .. #regions .. " memory regions"
                }
                ws:send(HttpServer.jsonStringify(response))
            else
                log("Stopping memory watching")
                if watchCallback then
                    callbacks:remove(watchCallback)
                    watchCallback = nil
                end
                
                local response = {
                    command = "watch", 
                    status = "success",
                    message = "Memory watching stopped"
                }
                ws:send(HttpServer.jsonStringify(response))
            end
            return
        end
        
        -- Handle eval requests
        local function safe_eval()
            log("WebSocket eval request: " .. tostring(message))
            local chunk = message
            
            -- Enhanced support for non-self-executing function inputs
            -- Check if it's already a complete statement or needs a return prefix
            local is_statement = message:match("^%s*return%s") or
                                message:match("^%s*local%s") or
                                message:match("^%s*function%s") or
                                message:match("^%s*for%s") or
                                message:match("^%s*while%s") or
                                message:match("^%s*if%s") or
                                message:match("^%s*do%s") or
                                message:match("^%s*repeat%s") or
                                message:match("^%s*goto%s") or
                                message:match("^%s*break%s") or
                                message:match("^%s*::") or
                                message:match("^%s*end%s") or
                                message:match("^%s*%(function") or
                                message:find("\n") -- If multiline, treat as statement
            
            if not is_statement then
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
                error("WebSocket Eval Error: " .. tostring(result))
            end
        end
        local ok, err = pcall(safe_eval)
        if not ok then
            ws:send(HttpServer.jsonStringify({error = "Internal server error: " .. tostring(err)}))
            error("WebSocket Handler Error: " .. tostring(err))
        end
    end

    ws.onClose = function()
        log("WebSocket disconnected: " .. ws.path)
        if watchCallback then
            callbacks:remove(watchCallback)
            watchCallback = nil
        end
        -- Clear watched regions and state on disconnect
        watchedRegions = {}
        lastData = {}
    end

    ws:send("Welcome to WebSocket Eval! Send Lua code to execute.")
end

--------------------------------------------------------------------------------
-- Routes
--------------------------------------------------------------------------------

local app = HttpServer:new()

-- Global middleware
app:use(function(req, res)
    log(req.method .. " " .. req.path .. " - Headers: " .. HttpServer.jsonStringify(req.headers))
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

-- WebSocket route
app:websocket("/ws", handleWebSocketConnection)

-- Start server
app:listen(7102, function(port)
    log("🚀 mGBA HTTP Server started on port " .. port)
end)
