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

-- Mock console API
_G.console = {
    log = function(self, msg) print("[CONSOLE] " .. tostring(msg)); io.flush() end,
    error = function(self, msg) print("[ERROR] " .. tostring(msg)); io.flush() end
}

-- Global list to track WebSocket coroutines
local websocket_threads = {}

-- Mock socket API with better WebSocket support
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

-- Connection handling function
local function handle_connection()
    if _G.socket._server and _G.socket._server._socket then
        local client = _G.socket._server._socket:accept()
        if client then
            -- Read HTTP request data
            client:settimeout(2.0)
            local request_data = ""
            repeat
                local chunk = client:receive(1)
                if chunk then
                    request_data = request_data .. chunk
                    if request_data:find("\r\n\r\n") then
                        local content_length = request_data:match("content%-length:%s*(%d+)")
                        if content_length then
                            local header_end = request_data:find("\r\n\r\n")
                            local body_length = #request_data - (header_end + 3)
                            if body_length >= tonumber(content_length) then break end
                        else
                            break
                        end
                    end
                end
            until not chunk or #request_data > 4096
            
            if #request_data > 0 then
                local mock_client = {
                    _socket = client, _callbacks = {}, _buffer = request_data, _is_websocket = false,
                    _ws_thread = nil,
                    add = function(self, event, callback) 
                        self._callbacks[event] = callback
                        if event == "received" and #self._buffer > 0 then callback() end
                    end,
                    receive = function(self, count)
                        if #self._buffer > 0 then
                            local result = self._buffer; self._buffer = ""
                            print("[DEBUG] Mock client returning buffered data, length:", #result)
                            return result
                        end
                        if self._is_websocket then
                            local data = self._socket:receive(count or 1024)
                            if data then
                                print("[DEBUG] WebSocket receive got data, length:", #data)
                                return data
                            else
                                return nil, _G.socket.ERRORS.AGAIN
                            end
                        end
                        return nil, _G.socket.ERRORS.AGAIN
                    end,
                    send = function(self, data) 
                        if data:match("Upgrade: websocket") then 
                            self._is_websocket = true 
                            print("[DEBUG] Client marked as WebSocket - starting monitor thread")
                            -- Start a background thread to monitor WebSocket data
                            if not self._ws_thread then
                                self._ws_thread = coroutine.create(function()
                                    while self._is_websocket and self._socket do
                                        self._socket:settimeout(0.001)
                                        local ws_data, err = self._socket:receive(1024)
                                        if ws_data then
                                            print("[DEBUG] WebSocket thread received data, length:", #ws_data)
                                            self._buffer = ws_data
                                            if self._callbacks.received then
                                                self._callbacks.received()
                                            end
                                        elseif err ~= "timeout" then
                                            print("[DEBUG] WebSocket thread error:", err)
                                            break
                                        end
                                        coroutine.yield()
                                    end
                                    print("[DEBUG] WebSocket monitor thread ended")
                                end)
                                -- Add to global list for event loop processing
                                table.insert(websocket_threads, self._ws_thread)
                            end
                        end
                        return self._socket:send(data) 
                    end,
                    close = function(self) 
                        print("[DEBUG] Mock client close() called for WebSocket:", self._is_websocket)
                        self._socket:close() 
                    end
                }
                table.insert(_G.socket._clients, mock_client)
                print("[DEBUG] Added client to clients list, total:", #_G.socket._clients)
                if _G.socket._server._callbacks.received then _G.socket._server._callbacks.received() end
            else
                client:close()
            end
        end
    end
end

-- Event loop
local loop_count = 0
local last_client_count = 0
while _G.socket._running and loop_count < 10000 do
    loop_count = loop_count + 1
    handle_connection()
    
    -- Track client count changes
    if #_G.socket._clients ~= last_client_count then
        print("[DEBUG] Client count changed from", last_client_count, "to", #_G.socket._clients, "at loop", loop_count)
        last_client_count = #_G.socket._clients
    end
    
    -- Handle WebSocket data for connected clients
    for i = #_G.socket._clients, 1, -1 do
        local mock_client = _G.socket._clients[i]
        if mock_client._is_websocket then
            mock_client._socket:settimeout(0)
            local data, err = mock_client._socket:receive(1024)
            if data then
                print("[DEBUG] Event loop received WebSocket data, length:", #data)
                mock_client._buffer = data
                if mock_client._callbacks.received then
                    print("[DEBUG] Triggering WebSocket received callback")
                    mock_client._callbacks.received()
                else
                    print("[DEBUG] No received callback for WebSocket client")
                end
            elseif err ~= "timeout" then
                print("[DEBUG] WebSocket client error:", err)
                if not mock_client._is_websocket then
                    print("[DEBUG] Removing non-WebSocket client")
                    table.remove(_G.socket._clients, i)
                else
                    print("[DEBUG] Preserving WebSocket client despite error")
                end
            end
        end
    end
    
    -- Run WebSocket monitoring threads
    for i = #websocket_threads, 1, -1 do
        local thread = websocket_threads[i]
        if thread and coroutine.status(thread) ~= "dead" then
            local ok, err = coroutine.resume(thread)
            if not ok then
                print("[DEBUG] WebSocket thread error:", err)
                table.remove(websocket_threads, i)
            end
        else
            table.remove(websocket_threads, i)
        end
    end
    
    -- Show status every 1000 loops
    if loop_count % 1000 == 0 then
        local ws_count = 0
        for _, c in ipairs(_G.socket._clients) do
            if c._is_websocket then ws_count = ws_count + 1 end
        end
        print("[DEBUG] Loop", loop_count, "total clients:", #_G.socket._clients, "websocket clients:", ws_count, "ws threads:", #websocket_threads)
    end
    
    socket.sleep(0.001)
end

print("Event loop ended")