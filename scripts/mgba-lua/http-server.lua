---@class Request
---@field method string
---@field path string
---@field headers table<string, string>
---@field body string

---@class Response
---@field finished boolean
---@field send fun(self: Response, status: string, body: string|table, content_type?: string): nil

---@class HttpServer
---@field routes table<string, table<string, function>>
---@field middlewares function[]
---@field clients table<number, table>
---@field nextClientId number
---@field server table?
local HttpServer = {}
HttpServer.__index = HttpServer

--------------------------------------------------------------------------------
-- "Static" Methods
--------------------------------------------------------------------------------

--- Parses the raw HTTP request string into a Request object.
---@param request_str string
---@return Request?
function HttpServer.parse_request(request_str)
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

--- A custom JSON stringify function to convert Lua tables to JSON strings.
--- Handles strings, numbers, booleans, nil, and tables (arrays/objects).
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
            -- Heuristic: if #t > 0 and keys are sequential, it's an array.
            if #t > 0 then
                for i = 1, #t do
                    parts[i] = serialize(t[i])
                end
                return "[" .. table.concat(parts, ",") .. "]"
            else -- Otherwise, treat as an object
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
        return '"' .. tostring(val) .. '"' -- Fallback for unknown types
    end

    return serialize(value)
end

--------------------------------------------------------------------------------
-- "Private" Instance Methods for Connection Handling
--------------------------------------------------------------------------------

--- Closes a client connection and removes it from the active clients table.
---@param self HttpServer
---@param clientId number
function HttpServer:_close_client(clientId)
    local client = self.clients[clientId]
    if client then
        self.clients[clientId] = nil
        client:close()
    end
end

--- Reads data from a client, parses it, and passes it to the request handler.
---@param self HttpServer
---@param clientId number
function HttpServer:_handle_client_data(clientId)
    local client = self.clients[clientId]
    if not client then return end

    -- Read the full request from the client socket
    local request_str = ""
    while true do
        local chunk, err = client:receive(1024)
        if chunk then
            request_str = request_str .. chunk
            -- A simple check for the end of headers. Might need improvement for large bodies.
            if request_str:find("\r\n\r\n") then break end
        else
            if err ~= socket.ERRORS.AGAIN then
                self:_close_client(clientId)
                return
            else
                break -- No more data to read right now
            end
        end
    end

    if request_str == "" then return end

    local req = HttpServer.parse_request(request_str)
    if not req then
        self:_close_client(clientId)
        return
    end

    local res = self:create_response(client, clientId)
    self:handle_request(req.method, req.path, req, res)

    -- If the handler didn't send a response, assume not found.
    if not res.finished then
        res:send("404 Not Found", "Not Found")
    end
end

--- Accepts a new client connection from the server socket.
---@param self HttpServer
function HttpServer:_accept_client()
    if not self.server then return end
    
    local client_socket, err = self.server:accept()
    if err or not client_socket then return end
    
    local clientId = self.nextClientId
    self.nextClientId = self.nextClientId + 1
    self.clients[clientId] = client_socket
    
    -- Add event listeners, wrapping method calls in anonymous functions
    -- to ensure `self` is passed correctly.
    client_socket:add("received", function() self:_handle_client_data(clientId) end)
    client_socket:add("error", function() self:_close_client(clientId) end)
end

--------------------------------------------------------------------------------
-- Public Instance Methods
--------------------------------------------------------------------------------

--- Creates a new HttpServer instance.
---@return HttpServer
function HttpServer:new()
    local self = setmetatable({}, HttpServer)
    self.routes = { GET = {}, POST = {} }
    self.middlewares = {}
    self.clients = {}
    self.nextClientId = 1
    self.server = nil
    return self
end

--- Creates a response object for a given request.
---@param self HttpServer
---@param client table The client socket.
---@param clientId number The ID of the client.
---@return Response
function HttpServer:create_response(client, clientId)
    local server_instance = self -- Capture the HttpServer instance for the closure.
    return {
        finished = false,
        send = function(res_self, status, response_body, content_type)
            if res_self.finished then return end

            -- Auto-stringify tables and set JSON content type
            if type(response_body) == "table" then
                response_body = HttpServer.jsonStringify(response_body)
                content_type = content_type or "application/json"
            else
                content_type = content_type or "text/plain"
            end
            local response_headers = {
                "HTTP/1.1 " .. status,
                "Content-Type: " .. content_type,
                "Content-Length: " .. #response_body,
                "Connection: close" -- We close after each response for simplicity
            }
            local response = table.concat(response_headers, "\r\n") .. "\r\n\r\n" .. response_body
            
            client:send(response)
            res_self.finished = true
            server_instance:_close_client(clientId) -- Use the captured instance
        end
    }
end

--- Runs the request through middlewares and then finds the appropriate route handler.
---@param self HttpServer
---@param method string
---@param path string
---@param req Request
---@param res Response
function HttpServer:handle_request(method, path, req, res)
    -- Run all middlewares first
    for _, mw in ipairs(self.middlewares) do
        mw(req, res)
        if res.finished then return end
    end
    
    -- Find and execute the route handler
    local handler = self.routes[method] and self.routes[method][path]
    if handler then
        handler(req, res)
    end
end

--- Registers a middleware function.
---@param self HttpServer
---@param middleware fun(req: Request, res: Response)
function HttpServer:use(middleware)
    table.insert(self.middlewares, middleware)
end

--- Registers a GET route handler.
---@param self HttpServer
---@param path string
---@param handler fun(req: Request, res: Response)
function HttpServer:get(path, handler)
    self.routes.GET[path] = handler
end

--- Registers a POST route handler.
---@param self HttpServer
---@param path string
---@param handler fun(req: Request, res: Response)
function HttpServer:post(path, handler)
    self.routes.POST[path] = handler
end

--- Starts the HTTP server, listening for connections on the given port.
--- If the port is in use, it will try the next available port.
---@param self HttpServer
---@param port number
---@param callback? fun(port: number)
function HttpServer:listen(port, callback)
    -- This loop attempts to bind the server, incrementing the port on failure.
    while not self.server do
        local err
        self.server, err = socket.bind(nil, port)
        if err then
            if err == socket.ERRORS.ADDRESS_IN_USE then
                port = port + 1 -- Try the next port
            else
                console:log("Error binding server: " .. tostring(err))
                break -- Unrecoverable error
            end
        else
            local ok
            ok, err = self.server:listen()
            if err then
                self.server:close()
                self.server = nil -- Reset server to allow retry
                console:log("Error listening on socket: " .. tostring(err))
            else
                -- On success, set up the accept handler and call the callback
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

-- Create a new server instance
local app = HttpServer:new()

-- Add a logging middleware
app:use(function(req, res)
    console:log(req.method .. " " .. req.path)
    console:log("Headers: " .. HttpServer.jsonStringify(req.headers))
end)

-- Define a simple GET route for the root path
app:get("/", function(req, res)
    res:send("200 OK", "Welcome to mGBA Express!")
end)

-- Define a GET route that returns JSON
app:get("/json", function(req, res)
    local data = { message = "Hello, JSON!", timestamp = os.time() }
    res:send("200 OK", data)
end)

-- Define a POST route that echoes the request body
app:post("/echo", function(req, res)
    -- Set content type explicitly if you want to be formal
    local content_type = req.headers['content-type'] or 'text/plain'
    res:send("200 OK", req.body, content_type)
end)

-- Start the server
app:listen(7102, function(port)
    console:log("🚀 mGBA HTTP Server started on port " .. port)
end)
