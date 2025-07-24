#!/usr/bin/env lua5.3

--[[
Simplified mGBA Lua environment for testing http-server.lua
Creates minimal mocks for mGBA APIs using real TCP sockets.
]]

local socket = require('socket')

-- Get port from command line
local test_port = tonumber(arg[1]) or 7102

--------------------------------------------------------------------------------
-- Simple mGBA API Mocks
--------------------------------------------------------------------------------

-- Mock console API - fix the logging issue by supporting both : and . syntax
_G.console = {}
setmetatable(_G.console, {
    __index = {
        log = function(self, msg)
            print("[CONSOLE] " .. tostring(msg))
            io.flush()
        end,
        error = function(self, msg)
            print("[ERROR] " .. tostring(msg))
            io.flush()
        end
    }
})

-- Global state for simple server management
local SERVER_STATE = {
    server = nil,
    clients = {},
    running = false
}

-- Mock socket API with simpler implementation
_G.socket = {
    ERRORS = {
        AGAIN = "again",
        ADDRESS_IN_USE = "address already in use"
    },
    
    bind = function(host, port)
        local server = socket.tcp()
        if not server then return nil, "Failed to create socket" end
        
        server:setoption("reuseaddr", true)
        local ok, err = server:bind(host or "127.0.0.1", port)
        if not ok then
            server:close()
            return nil, err:find("already in use") and _G.socket.ERRORS.ADDRESS_IN_USE or err
        end
        
        -- Create simplified mock server
        local mock_server = {
            _socket = server,
            _callbacks = {},
            
            add = function(self, event, callback)
                self._callbacks[event] = callback
            end,
            
            listen = function(self, backlog)
                local ok, err = self._socket:listen(backlog or 5)
                if not ok then return nil, err end
                
                self._socket:settimeout(0)
                SERVER_STATE.running = true
                return true
            end,
            
            accept = function(self)
                local client = SERVER_STATE.clients[1]
                if client then
                    table.remove(SERVER_STATE.clients, 1)
                    return client
                end
                return nil, _G.socket.ERRORS.AGAIN
            end,
            
            close = function(self)
                SERVER_STATE.running = false
                return self._socket:close()
            end
        }
        
        SERVER_STATE.server = mock_server
        return mock_server
    end
}

-- Mock emu API
_G.emu = {
    romSize = function()
        return 1024 * 1024 -- 1MB ROM
    end
}

-- Mock callbacks API
_G.callbacks = {
    add = function(self, event, callback)
        if event == "start" then
            callback() -- Trigger immediately
        end
        return 1
    end,
    
    remove = function(self, id)
        -- No-op
    end
}

--------------------------------------------------------------------------------
-- Load and Execute HTTP Server
--------------------------------------------------------------------------------

print("Starting simplified mGBA environment on port " .. test_port)

-- Load the http-server.lua
local script_dir = arg[0]:match("(.+)/[^/]+$") or "."
local http_server_path = script_dir .. "/../http-server.lua"

local file = io.open(http_server_path, "r")
if not file then
    print("ERROR: http-server.lua not found at: " .. http_server_path)
    os.exit(1)
end

local code = file:read("*all")
file:close()

-- Replace port
local modified_code = code:gsub("app:listen%(7102", "app:listen(" .. test_port)

-- Execute the server
local chunk, err = load(modified_code, "http-server.lua")
if not chunk then
    print("ERROR: Failed to load http-server.lua: " .. tostring(err))
    os.exit(1)
end

local ok, exec_err = pcall(chunk)
if not ok then
    print("ERROR: Failed to execute http-server.lua: " .. tostring(exec_err))
    os.exit(1)
end

print("HTTP server loaded successfully")

-- Simple event loop for connection handling
local loop_count = 0
while SERVER_STATE.running and loop_count < 50000 do
    loop_count = loop_count + 1
    
    -- Check for new connections
    if SERVER_STATE.server and SERVER_STATE.server._socket then
        local client = SERVER_STATE.server._socket:accept()
        if client then
            -- Create simple mock client
            local mock_client = {
                _socket = client,
                _callbacks = {},
                _buffer = "",
                
                add = function(self, event, callback)
                    self._callbacks[event] = callback
                    -- If it's a received callback and we have data, trigger it
                    if event == "received" and #self._buffer > 0 then
                        callback()
                    end
                end,
                
                receive = function(self, count)
                    if #self._buffer > 0 then
                        local result = self._buffer
                        self._buffer = ""
                        return result
                    end
                    return nil, _G.socket.ERRORS.AGAIN
                end,
                
                send = function(self, data)
                    return self._socket:send(data)
                end,
                
                close = function(self)
                    self._socket:close()
                end
            }
            
            -- Read HTTP request data
            client:settimeout(1.0)
            local request_data = ""
            repeat
                local chunk = client:receive(1)
                if chunk then
                    request_data = request_data .. chunk
                    if request_data:find("\r\n\r\n") then
                        -- Check for Content-Length for POST requests
                        local content_length = request_data:match("content%-length:%s*(%d+)")
                        if content_length then
                            local header_end = request_data:find("\r\n\r\n")
                            local expected_total = header_end + 3 + tonumber(content_length)
                            if #request_data >= expected_total then
                                break
                            end
                        else
                            break
                        end
                    end
                end
            until not chunk or #request_data > 2048
            
            if #request_data > 0 then
                mock_client._buffer = request_data
                table.insert(SERVER_STATE.clients, mock_client)
                
                -- Trigger server callback
                if SERVER_STATE.server._callbacks.received then
                    SERVER_STATE.server._callbacks.received()
                end
            else
                client:close()
            end
        end
    end
    
    socket.sleep(0.001)
end

print("Event loop ended")