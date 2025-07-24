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

-- Mock console API - simplified version
_G.console = {
    log = function(self, msg) print("[CONSOLE] " .. tostring(msg)); io.flush() end,
    error = function(self, msg) print("[ERROR] " .. tostring(msg)); io.flush() end
}

-- Mock socket API with embedded state
_G.socket = {
    ERRORS = {
        AGAIN = "again",
        ADDRESS_IN_USE = "address already in use"
    },
    
    _server = nil,
    _clients = {},
    _running = false,
    
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
            _socket = server, _callbacks = {},
            
            add = function(self, event, callback) self._callbacks[event] = callback end,
            listen = function(self, backlog)
                local ok, err = self._socket:listen(backlog or 5)
                if not ok then return nil, err end
                self._socket:settimeout(0); _G.socket._running = true; return true
            end,
            accept = function(self)
                local client = _G.socket._clients[1]
                if client then table.remove(_G.socket._clients, 1); return client end
                return nil, _G.socket.ERRORS.AGAIN
            end,
            close = function(self) _G.socket._running = false; return self._socket:close() end
        }
        
        _G.socket._server = mock_server
        return mock_server
    end
}

-- Mock emu and callbacks APIs
_G.emu = { romSize = function() return 1024 * 1024 end }
_G.callbacks = { 
    add = function(self, event, callback) if event == "start" then callback() end; return 1 end,
    remove = function(self, id) end
}

-- Load and Execute HTTP Server
print("Starting simplified mGBA environment on port " .. test_port)

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

-- Simple event loop for connection handling
local loop_count = 0
while _G.socket._running and loop_count < 50000 do
    loop_count = loop_count + 1
    
    -- Handle new connections
    if _G.socket._server and _G.socket._server._socket then
        local client = _G.socket._server._socket:accept()
        if client then
            client:settimeout(1.0)
            local request_data = ""
            repeat
                local chunk = client:receive(1)
                if chunk then
                    request_data = request_data .. chunk
                    if request_data:find("\r\n\r\n") then
                        local content_length = request_data:match("content%-length:%s*(%d+)")
                        if content_length then
                            local header_end = request_data:find("\r\n\r\n")
                            if #request_data >= header_end + 3 + tonumber(content_length) then break end
                        else
                            break
                        end
                    end
                end
            until not chunk or #request_data > 2048
            
            if #request_data > 0 then
                local mock_client = {
                    _socket = client, _callbacks = {}, _buffer = request_data, _is_websocket = false,
                    add = function(self, event, callback)
                        self._callbacks[event] = callback
                        if event == "received" and #self._buffer > 0 then callback() end
                    end,
                    receive = function(self, count)
                        if #self._buffer > 0 then
                            local result = self._buffer; self._buffer = ""; return result
                        end
                        
                        -- For WebSocket connections, continue reading new data
                        if self._is_websocket then
                            local data = self._socket:receive(1024)
                            if data then return data end
                        end
                        
                        return nil, _G.socket.ERRORS.AGAIN
                    end,
                    send = function(self, data) 
                        -- Check if this is a WebSocket upgrade response
                        if data:match("Upgrade: websocket") then
                            self._is_websocket = true
                        end
                        return self._socket:send(data) 
                    end,
                    close = function(self) self._socket:close() end
                }
                
                table.insert(_G.socket._clients, mock_client)
                if _G.socket._server._callbacks.received then
                    _G.socket._server._callbacks.received()
                end
            else
                client:close()
            end
        end
    end
    
    -- Handle ongoing WebSocket data for existing connections
    for i = #_G.socket._clients, 1, -1 do
        local mock_client = _G.socket._clients[i]
        if mock_client._is_websocket then
            mock_client._socket:settimeout(0)  -- Non-blocking
            local data, err = mock_client._socket:receive(1024)
            if data then
                mock_client._buffer = data
                if mock_client._callbacks.received then
                    mock_client._callbacks.received()
                end
            elseif err ~= "timeout" then
                -- Remove disconnected client
                table.remove(_G.socket._clients, i)
            end
        end
    end
    
    socket.sleep(0.001)
end

print("Event loop ended")