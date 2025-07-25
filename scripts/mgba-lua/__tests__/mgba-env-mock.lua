local socket = require('socket')
local port = tonumber(arg[1]) or 7102

local Socket = {}
do
    local Client = {}
    Client.__index = Client
    function Client:add(event, cb)
        self._callbacks[event] = cb
        if event == "received" and #self._buffer > 0 and type(cb) == "function" then
            cb()
        end
    end
    function Client:receive(bytes)
        -- For WebSocket connections, always try to read fresh data
        self._socket:settimeout(0)
        local data, err = self._socket:receive(bytes or 1024)
        if data and #data > 0 then
            return data
        end
        
        -- Fallback to buffered data
        if #self._buffer > 0 then 
            local buffered_data = self._buffer
            self._buffer = ""
            return buffered_data
        end
        
        return nil, Socket.ERRORS.AGAIN
    end
    function Client:send(data) return self._socket:send(data) end
    function Client:close() return self._socket:close() end

    local Server = {}
    Server.__index = Server
    function Server:add(event, cb) self._callbacks[event] = cb end
    function Server:listen()
        local ok, err = self._socket:listen(5)
        if not ok then return nil, err end
        self._socket:settimeout(0); Socket._running = true; return true, nil
    end
    function Server:accept()
        if #Socket._clients > 0 then 
            local client = Socket._clients[1]
            table.remove(Socket._clients, 1)
            -- Keep track of this client for potential WebSocket monitoring
            Socket._websocket_clients = Socket._websocket_clients or {}
            table.insert(Socket._websocket_clients, client)
            return client
        end
        return nil, Socket.ERRORS.AGAIN
    end
    function Server:close() Socket._running = false; return self._socket:close() end

    Socket._clients, Socket._running, Socket._server = {}, false, nil
    Socket.ERRORS = { AGAIN = "again", ADDRESS_IN_USE = "address already in use" }
    Socket.new_client = function(sock, data)
        return setmetatable({_socket = sock, _callbacks = {}, _buffer = data or ""}, Client)
    end

    function Socket.bind(host, port)
        local s = socket.tcp()
        if not s then return nil, "Failed to create socket" end
        s:setoption("reuseaddr", true)
        local ok, bind_err = s:bind(host or "127.0.0.1", port)
        if not ok then
            s:close()
            return nil, (bind_err:find("already in use") and Socket.ERRORS.ADDRESS_IN_USE or bind_err)
        end
        Socket._server = setmetatable({_socket = s, _callbacks = {}}, Server)
        return Socket._server
    end
end

local function read_full_request(client_socket)
    client_socket:settimeout(1)
    
    -- Read HTTP headers line by line until empty line
    local headers = ""
    while true do
        local line = client_socket:receive("*l")
        if not line then return nil end
        headers = headers .. line .. "\r\n"
        if line == "" then break end -- Empty line indicates end of headers
    end
    
    -- Check for Content-Length
    local content_length = headers:match("[Cc]ontent%-[Ll]ength:%s*(%d+)")
    if not content_length then return headers end
    
    -- Read body if Content-Length is specified
    local body = client_socket:receive(tonumber(content_length))
    return body and (headers .. body) or headers
end

local function load_http_server(server_port)
    local script_dir = arg[0]:match("(.+)/[^/]+$") or "."
    local path = script_dir .. "/../http-server.lua"
    local file = io.open(path, "r")
    if not file then _G.console.fatal("http-server.lua not found at: " .. path) end

    local content = file:read("*a"); file:close()
    local patched = content:gsub("app:listen%(7102", "app:listen(" .. server_port)
    local chunk, load_err = load(patched, "http-server.lua")
    if not chunk then _G.console.fatal("Failed to load http-server.lua: " .. tostring(load_err)) end

    local ok, exec_err = pcall(chunk)
    if not ok then _G.console.fatal("Failed to execute http-server.lua: " .. tostring(exec_err)) end

    _G.console.log("HTTP server loaded successfully.")
end

local function main_event_loop(server)
    _G.console.log("Event loop started. Waiting for connections...")
    while Socket._running do
        -- Handle new connections
        local raw_client_socket = server._socket:accept()
        if raw_client_socket then
            local request_data = read_full_request(raw_client_socket)
            if request_data then
                table.insert(Socket._clients, Socket.new_client(raw_client_socket, request_data))
                if server._callbacks.received then server._callbacks.received() end
            else
                raw_client_socket:close()
            end
        end
        
        -- Check existing clients for new data (for WebSocket frames)
        for i, client in ipairs(Socket._clients) do
            if client._socket then
                -- Try to receive data without blocking
                client._socket:settimeout(0)
                local data, err = client._socket:receive(1024)
                if data and #data > 0 then
                    -- Buffer the data so client:receive() can get it
                    client._buffer = client._buffer .. data
                    -- Trigger the "received" callback if it exists
                    if client._callbacks.received then
                        client._callbacks.received()
                    end
                elseif err and err ~= "timeout" then
                    -- Client disconnected, remove from list
                    client._socket:close()
                    table.remove(Socket._clients, i)
                    break
                end
            end
        end
        
        -- Check WebSocket clients for ongoing frame data
        Socket._websocket_clients = Socket._websocket_clients or {}
        if #Socket._websocket_clients > 0 then
            _G.console:log("DEBUG: Monitoring " .. #Socket._websocket_clients .. " WebSocket clients")
        end
        for i = #Socket._websocket_clients, 1, -1 do
            local client = Socket._websocket_clients[i]
            if client._socket then
                -- Try to receive data without blocking
                client._socket:settimeout(0)
                local data, err = client._socket:receive(1024)
                if data and #data > 0 then
                    -- Buffer the data so client:receive() can get it
                    client._buffer = client._buffer .. data
                    -- Trigger the "received" callback if it exists
                    if client._callbacks.received then
                        client._callbacks.received()
                    end
                elseif err and err ~= "timeout" then
                    -- Client disconnected, remove from list
                    client._socket:close()
                    table.remove(Socket._websocket_clients, i)
                end
            end
        end
        
        socket.sleep(0.001)
    end
    _G.console.log("Event loop ended.")
end

local function main()
    _G.console = {
        log = function(self, msg) 
            -- Handle both console:log(msg) and console.log(msg) calls
            local message = msg or self
            print("[CONSOLE] " .. tostring(message)); io.flush() 
        end,
        error = function(self, msg) 
            -- Handle both console:error(msg) and console.error(msg) calls
            local message = msg or self
            print("[ERROR] " .. tostring(message)); io.flush() 
        end
    }
    _G.console.fatal = function(self, msg) 
        local message = msg or self
        _G.console:error(message); os.exit(1) 
    end
    _G.emu = {
        romSize = function(self) return 1024 * 1024 end
    }
    _G.callbacks = {
        add = function(self, event, cb)
            if event == "start" and type(cb) == "function" then cb() end
            return 1
        end,
        remove = function(self, id) end
    }
    _G.socket = Socket

    _G.console.log("Starting simplified mGBA environment on port " .. port)
    load_http_server(port)

    if Socket._server and Socket._running then
        main_event_loop(Socket._server)
    else
        _G.console.fatal("The http-server.lua script did not start the server correctly.")
    end
end

main()
