#!/usr/bin/env lua5.3

--[[
Ultra-simplified mGBA environment that directly integrates with the HTTP server code
Uses real TCP sockets and proper event handling
]]

local socket = require('socket')

-- Get port from command line
local test_port = tonumber(arg[1]) or 7102

--------------------------------------------------------------------------------
-- mGBA API Mocks using real sockets
--------------------------------------------------------------------------------

-- Console API
_G.console = {
    log = function(self, msg) print("[CONSOLE] " .. tostring(msg)); io.flush() end,
    error = function(self, msg) print("[ERROR] " .. tostring(msg)); io.flush() end
}

-- Real socket integration
_G.socket = {
    ERRORS = {
        AGAIN = "again",
        ADDRESS_IN_USE = "address already in use"
    },
    
    bind = function(host, port)
        local real_server = socket.tcp()
        if not real_server then return nil, "Failed to create socket" end
        
        real_server:setoption("reuseaddr", true)
        local ok, err = real_server:bind(host or "127.0.0.1", port)
        if not ok then
            real_server:close()
            return nil, err:find("already in use") and _G.socket.ERRORS.ADDRESS_IN_USE or err
        end
        
        -- Store reference for the event loop
        local server_wrapper = {
            _socket = real_server,
            _callbacks = {},
            
            add = function(self, event, callback) 
                self._callbacks[event] = callback 
            end,
            
            listen = function(self, backlog)
                local ok, err = self._socket:listen(backlog or 5)
                if not ok then return nil, err end
                self._socket:settimeout(0)
                -- Store this server for the event loop
                _G._server_instance = self
                return true
            end,
            
            accept = function(self)
                local client_socket, err = self._socket:accept()
                if not client_socket then
                    return nil, err == "timeout" and _G.socket.ERRORS.AGAIN or err
                end
                
                -- Create wrapped client
                local client_wrapper = {
                    _socket = client_socket,
                    _callbacks = {},
                    
                    add = function(self, event, callback) 
                        self._callbacks[event] = callback 
                        -- Store client for data monitoring
                        if event == "received" then
                            _G._monitor_client = self
                        end
                    end,
                    
                    receive = function(self, pattern)
                        local data, err = self._socket:receive(pattern or "*l")
                        if err == "timeout" then err = _G.socket.ERRORS.AGAIN end
                        return data, err
                    end,
                    
                    send = function(self, data)
                        return self._socket:send(data)
                    end,
                    
                    close = function(self)
                        self._socket:close()
                        if _G._monitor_client == self then
                            _G._monitor_client = nil
                        end
                    end
                }
                
                client_socket:settimeout(0)
                return client_wrapper
            end,
            
            close = function(self) 
                _G._server_instance = nil
                return self._socket:close() 
            end
        }
        
        return server_wrapper
    end
}

-- Mock emu and callbacks
_G.emu = { romSize = function() return 1024 * 1024 end }
_G.callbacks = { 
    add = function(self, event, callback) 
        if event == "start" then callback() end
        return 1 
    end,
    remove = function(self, id) end
}

-- Global state
_G._server_instance = nil
_G._monitor_client = nil

-- Load and Execute HTTP Server
print("Starting mGBA environment on port " .. test_port)

local script_dir = arg[0]:match("(.+)/[^/]+$") or "."
local file = io.open(script_dir .. "/../http-server.lua", "r")
if not file then print("ERROR: http-server.lua not found"); os.exit(1) end

local code = file:read("*all"); file:close()
local modified_code = code:gsub("app:listen%(7102", "app:listen(" .. test_port)
local chunk, err = load(modified_code, "http-server.lua")
if not chunk then print("ERROR: Failed to load: " .. tostring(err)); os.exit(1) end

local ok, exec_err = pcall(chunk)
if not ok then print("ERROR: Failed to execute: " .. tostring(exec_err)); os.exit(1) end
print("HTTP server loaded successfully")

-- Event loop
local running = true
local last_status = os.time()

while running do
    -- Handle server connections
    if _G._server_instance then
        local server = _G._server_instance
        local client, err = server._socket:accept()
        if client then
            print("[DEBUG] New connection")
            if server._callbacks.received then
                server._callbacks.received()
            end
        end
    end
    
    -- Handle client data
    if _G._monitor_client then
        local client = _G._monitor_client
        client._socket:settimeout(0)
        local data, err = client._socket:receive(1)
        if data then
            print("[DEBUG] Client data available")
            if client._callbacks.received then
                client._callbacks.received()
            end
        end
    end
    
    -- Status update
    local now = os.time()
    if now - last_status >= 10 then
        print("[DEBUG] Server running...")
        last_status = now
    end
    
    socket.sleep(0.01)
end