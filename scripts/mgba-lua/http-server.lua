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

--- A custom JSON stringify function to convert Lua tables to JSON strings.
---@param value any
---@return string
function HttpServer.jsonStringify(value)
    local serialize -- Forward declaration for recursion
    local type_handlers = {
        string = function(s) return '"' .. s:gsub('[\\"]', {['\\']='\\\\', ['"']='\\"' }) .. '"' end,
        number = tostring,
        boolean = tostring,
        ["nil"] = function() return "null" end,
        table = function(t)
            if next(t) == nil then return "{}" end -- Empty table as object
            
            local parts = {}
            if #t > 0 then
                for i = 1, #t do
                    parts[i] = serialize(t[i])
                end
                return "[" .. table.concat(parts, ",") .. "]"
            else
                for k, v in pairs(t) do
                    table.insert(parts, serialize(tostring(k)) .. ":" .. serialize(v))
                end
                return "{" .. table.concat(parts, ",") .. "}"
            end
        end
    }

    serialize = function(val)
        local handler = type_handlers[type(val)]
        if handler then
            return handler(val)
        end
        return '"' .. tostring(val) .. '"' -- Fallback
    end

    return serialize(value)
end

--- Middleware factory for creating a CORS middleware.
---@param options? table { origin?: string, methods?: string, headers?: string }
---@return fun(req: Request, res: Response)
function HttpServer.cors(options)
    options = options or {}
    local origin = options.origin or "*"

    return function(req, res)
        res:setHeader("Access-Control-Allow-Origin", origin)
    end
end

--------------------------------------------------------------------------------
-- "Private" Instance Methods for Connection Handling
--------------------------------------------------------------------------------

--- Closes a client connection.
--- @param self HttpServer
--- @param clientId number
---@private
function HttpServer:_close_client(clientId)
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

--- Creates a response object for a given request.
--- @param client SocketInstance
--- @param clientId number
--- @return Response
--- @private
function HttpServer:_create_response(client, clientId)
    return {
        finished = false,
        _headers = { ["Connection"] = "close" },
        setHeader = function(res_self, key, value)
            res_self._headers[key] = value
        end,
        send = function(res_self, status, response_body, content_type)
            if res_self.finished then
                console:log("[DEBUG] Response already finished for client " .. tostring(clientId))
                return
            end

            if type(response_body) == "table" then
                response_body = HttpServer.jsonStringify(response_body)
                content_type = content_type or "application/json"
            else
                response_body = response_body or ""
                content_type = content_type or "text/plain"
            end
            
            res_self:setHeader("Content-Type", content_type)
            res_self:setHeader("Content-Length", #response_body)

            local header_lines = { "HTTP/1.1 " .. status }
            for k, v in pairs(res_self._headers) do
                table.insert(header_lines, k .. ": " .. v)
            end
            
            local response = table.concat(header_lines, "\r\n") .. "\r\n\r\n" .. response_body
            local ok, err = client:send(response)

            if not ok then
                console:log("[ERROR] Failed to send response to client " .. tostring(clientId) .. ": " .. tostring(err))
            end

            res_self.finished = true
            self:_close_client(clientId)
        end
    }
end

--- Reads and handles data from a client.
--- @param self HttpServer
--- @param clientId number
--- @private
function HttpServer:_handle_client_data(clientId)
    local client = self.clients[clientId]
    if not client then return end

    local request_str = ""
    while true do
        local chunk, err = client:receive(1024)
        if chunk then
            request_str = request_str .. chunk
            if request_str:find("\r\n\r\n") then break end
        else
            if err ~= socket.ERRORS.AGAIN then
                self:_close_client(clientId)
                return
            else
                break
            end
        end
    end

    if request_str == "" then return end

    local req = self:_parse_request(request_str)
    if not req then
        console:log("[ERROR] Failed to parse request from client " .. tostring(clientId))
        self:_close_client(clientId)
        return
    end

    local res = self:_create_response(client, clientId)
    self:_handle_request(req.method, req.path, req, res)

    if not res.finished then
        console:log("[DEBUG] No response sent by route/middleware, sending 404 to client " .. tostring(clientId))
        res:send("404 Not Found", "Not Found")
    end
    -- Do not close the socket here; let the client disconnect, or close only on error
end

--- Runs the request through global and route-specific middlewares.
--- @param method string
--- @param path string
--- @param req Request
--- @param res Response
--- @private
function HttpServer:_handle_request(method, path, req, res)
    -- Run all global middlewares first
    for _, mw in ipairs(self.middlewares) do
        mw(req, res)
        if res.finished then return end
    end
    
    -- Find and execute route-specific handlers (middleware + final handler)
    local route_handlers = self.routes[method] and self.routes[method][path]
    if route_handlers then
        for _, handler_func in ipairs(route_handlers) do
            handler_func(req, res)
            if res.finished then return end
        end
    end
end

--- Accepts a new client connection.
--- @param self HttpServer
--- @private
function HttpServer:_accept_client()
    if not self.server then return end
    
    local client_socket, err = self.server:accept()
    if err or not client_socket then return end
    
    local clientId = self.nextClientId
    self.nextClientId = self.nextClientId + 1
    self.clients[clientId] = client_socket
    
    client_socket:add("received", function() self:_handle_client_data(clientId) end)
    client_socket:add("error", function() self:_close_client(clientId) end)
end

--------------------------------------------------------------------------------
-- Public Instance Methods
--------------------------------------------------------------------------------

--- Creates a new HttpServer instance.
--- @return HttpServer
function HttpServer:new()
    local self = setmetatable({}, HttpServer)
    self.routes = { GET = {}, POST = {} }
    self.middlewares = {}
    self.clients = {}
    self.nextClientId = 1
    self.server = nil
    return self
end

--- Registers a global middleware function.
---@param self HttpServer
---@param middleware fun(req: Request, res: Response)
function HttpServer:use(middleware)
    table.insert(self.middlewares, middleware)
end

--- Registers a GET route with optional middleware.
---@param self HttpServer
---@param path string
---@vararg fun(req: Request, res: Response)
function HttpServer:get(path, ...)
    self.routes.GET[path] = {...}
end

--- Registers a POST route with optional middleware.
---@param self HttpServer
---@param path string
---@vararg fun(req: Request, res: Response)
function HttpServer:post(path, ...)
    self.routes.POST[path] = {...}
end

--- Starts the HTTP server.
--- @param self HttpServer
--- @param port number
--- @param callback? fun(port: number): nil
function HttpServer:listen(port, callback)
    while not self.server do
        local err
        self.server, err = socket.bind(nil, port)
        if err then
            if err == socket.ERRORS.ADDRESS_IN_USE then
                port = port + 1
            else
                console:log("Error binding server: " .. tostring(err))
                break
            end
        else
            local ok
            ok, err = self.server:listen()
            if err then
                self.server:close()
                self.server = nil
                console:log("Error listening on socket: " .. tostring(err))
            else
                self.server:add("received", function() self:_accept_client() end)
                if callback then
                    callback(port)
                end
            end
        end
    end
end

--------------------------------------------------------------------------------
-- Example Usage
--------------------------------------------------------------------------------

local app = HttpServer:new()

-- Add a global logging middleware
app:use(function(req, res)
    console:log(req.method .. " " .. req.path)
    console:log("Headers: " .. HttpServer.jsonStringify(req.headers))
end)

-- Define a simple GET route
app:get("/", function(req, res)
    res:send("200 OK", "Welcome to mGBA Express!")
end)

-- Define a GET route that returns JSON
app:get("/json", HttpServer.cors(), function(req, res)
    local data = { message = "Hello, JSON!", timestamp = os.time() }
    res:send("200 OK", data)
end)

-- Define a POST route that echoes the request body
app:post("/echo", function(req, res)
    local content_type = req.headers['content-type'] or 'text/plain'
    res:send("200 OK", req.body, content_type)
end)

-- Start the server
app:listen(7102, function(port)
    console:log("🚀 mGBA HTTP Server started on port " .. port)
end)
