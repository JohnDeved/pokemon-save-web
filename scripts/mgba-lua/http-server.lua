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

---@class HttpServer
---@field routes table<string, table<string, function[]>>
---@field middlewares function[]
---@field clients table<number, table>
---@field nextClientId number
---@field server table?
local HttpServer = {}
HttpServer.__index = HttpServer

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

--------------------------------------------------------------------------------
-- "Private" Instance Methods for Connection Handling
--------------------------------------------------------------------------------

--- Closes a client connection and cleans up.
---@param clientId number
---@private
function HttpServer:_cleanup_client(clientId)
    local client = self.clients[clientId]
    if client then
        self.clients[clientId] = nil
        client:close()
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
                console:log("[ERROR] Send failed for client " .. clientId .. ": " .. tostring(err))
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

--- Starts the HTTP server on the specified port.
---@param port number
---@param callback? fun(port: number)
function HttpServer:listen(port, callback)
    local server, err
    
    -- Try to bind to the port, incrementing if in use
    repeat
        server, err = socket.bind(nil, port)
        if err == socket.ERRORS.ADDRESS_IN_USE then
            port = port + 1
        elseif err then
            console:log("Error binding server: " .. tostring(err))
            return
        end
    until server
    
    -- Start listening
    local ok, listen_err = server:listen()
    if listen_err then
        server:close()
        console:log("Error listening: " .. tostring(listen_err))
        return
    end
    
    self.server = server
    server:add("received", function() self:_accept_client() end)
    
    if callback then callback(port) end
end

--------------------------------------------------------------------------------
-- Example Usage
--------------------------------------------------------------------------------

local app = HttpServer:new()

-- Global middleware
app:use(function(req, res)
    console:log(req.method .. " " .. req.path .. " - Headers: " .. HttpServer.jsonStringify(req.headers))
end)

-- Routes
app:get("/", function(req, res)
    res:send("200 OK", "Welcome to mGBA HTTP Server!")
end)

app:get("/json", HttpServer.cors(), function(req, res)
    res:send("200 OK", {message = "Hello, JSON!", timestamp = os.time()})
end)

app:post("/echo", function(req, res)
    res:send("200 OK", req.body, req.headers['content-type'])
end)

-- Start server
app:listen(7102, function(port)
    console:log("🚀 mGBA HTTP Server started on port " .. port)
end)
