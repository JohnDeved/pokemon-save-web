#!/usr/bin/env lua5.3

-- Ultra-simplified mGBA mock that only does what's needed for tests
local socket = require('socket')
local port = tonumber(arg[1]) or 7102

print("Starting ultra-simple mGBA environment on port " .. port)

-- Minimal mGBA API mocks - just enough for the HTTP server to work
_G.console = {
    log = function(self, msg) 
        print("[CONSOLE] " .. tostring(msg))
        io.flush()
    end,
    error = function(self, msg) 
        print("[ERROR] " .. tostring(msg))
        io.flush()
    end
}

_G.emu = { 
    romSize = function() return 1024 * 1024 end,
    getGameTitle = function() return "Test Game" end
}

_G.callbacks = {
    _next_id = 1,
    add = function(self, event, callback)
        local id = self._next_id
        self._next_id = id + 1
        return id
    end,
    remove = function(self, id) end
}

-- Simple socket wrapper that maps to real lua socket
local server_instance = nil

local function createSocketWrapper(real_socket)
    return {
        _socket = real_socket,
        _callbacks = {},
        
        add = function(self, event, callback)
            self._callbacks[event] = callback
            
            -- If this is the server socket and we're adding a "received" callback,
            -- start a background thread to monitor for connections
            if event == "received" and not server_instance then
                server_instance = self
                
                -- Start a coroutine to handle incoming connections
                local co = coroutine.create(function()
                    while true do
                        self._socket:settimeout(0.1) -- Non-blocking with timeout
                        local client = self._socket:accept()
                        if client then
                            -- We got a connection, trigger the received event
                            if callback then
                                callback()
                            end
                        end
                        coroutine.yield()
                    end
                end)
                
                -- Start the coroutine monitoring
                local function monitor()
                    local ok, err = coroutine.resume(co)
                    if ok and coroutine.status(co) ~= "dead" then
                        -- Schedule next monitoring cycle
                        -- This is a simple way to keep the coroutine running
                        local timer = socket.gettime() + 0.01
                        while socket.gettime() < timer do
                            -- busy wait for a very short time
                        end
                        monitor() -- Recursively call to continue monitoring
                    end
                end
                
                -- Start monitoring in a separate "thread" (using coroutines)
                monitor()
            end
        end,
        
        bind = function(self, addr, port)
            self._socket:setoption("reuseaddr", true)
            return self._socket:bind(addr or "127.0.0.1", port)
        end,
        
        listen = function(self, backlog)
            self._socket:settimeout(0) -- Make non-blocking
            return self._socket:listen(backlog or 1)
        end,
        
        accept = function(self)
            local client = self._socket:accept()
            if client then
                client:settimeout(0)
                return createSocketWrapper(client)
            end
            return nil, "again"
        end,
        
        receive = function(self, bytes)
            return self._socket:receive(bytes)
        end,
        
        send = function(self, data)
            return self._socket:send(data)
        end,
        
        close = function(self)
            return self._socket:close()
        end,
        
        hasdata = function(self)
            -- Always return false to keep things simple
            return false
        end
    }
end

-- Override the socket API
_G.socket = {
    ERRORS = { AGAIN = "again", ADDRESS_IN_USE = "address already in use" },
    tcp = function()
        local s = socket.tcp()
        if s then
            return createSocketWrapper(s)
        end
        return nil
    end,
    bind = function(addr, port)
        local s = _G.socket.tcp()
        if s then
            local ok, err = s:bind(addr, port)
            if ok then return s end
            return nil, err
        end
        return nil, "Failed to create socket"
    end
}

-- Load and run the HTTP server
local script_dir = arg[0]:match("(.+)/[^/]+$") or "."
local file = io.open(script_dir .. "/../http-server.lua", "r")
if not file then 
    print("ERROR: http-server.lua not found")
    os.exit(1)
end

local code = file:read("*all")
file:close()

-- Replace the default port with our test port
local modified_code = code:gsub("app:listen%(7102", "app:listen(" .. port)

-- Load and execute the server
local chunk, err = load(modified_code, "http-server.lua")
if not chunk then 
    print("ERROR: Failed to load: " .. tostring(err))
    os.exit(1) 
end

local ok, exec_err = pcall(chunk)
if not ok then 
    print("ERROR: Failed to execute: " .. tostring(exec_err))
    os.exit(1) 
end

print("HTTP server loaded successfully")

-- Keep the process alive
while true do
    socket.sleep(1)
end