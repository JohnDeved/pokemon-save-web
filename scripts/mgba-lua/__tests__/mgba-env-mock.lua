#!/usr/bin/env lua5.3
-- Minimal mGBA mock for testing http-server.lua
local socket = require('socket')
local test_port = tonumber(arg[1]) or 7102

-- mGBA API mocks
_G.console = {
    log = function(self, msg) print("[CONSOLE] " .. tostring(msg)); io.flush() end,
    error = function(self, msg) print("[ERROR] " .. tostring(msg)); io.flush() end
}

_G.emu = {
    romSize = function() return 1024 * 1024 end
}

_G.callbacks = {
    add = function(self, event, cb) if event == "start" then cb() end; return 1 end,
    remove = function(self, id) end
}

-- Socket API mock that bridges mGBA API to lua-socket
local socket_server = nil
local active_clients = {}
local running = false

_G.socket = {
    ERRORS = { AGAIN = "again", ADDRESS_IN_USE = "address already in use" },
    
    bind = function(host, port)
        local server = socket.tcp()
        if not server then return nil, "Failed to create socket" end
        
        server:setoption("reuseaddr", true)
        local ok, err = server:bind(host or "127.0.0.1", port)
        if not ok then
            server:close()
            return nil, err:find("already in use") and _G.socket.ERRORS.ADDRESS_IN_USE or err
        end
        
        socket_server = server
        
        -- Return mGBA-compatible server object
        return {
            _socket = server,
            _callbacks = {},
            
            add = function(self, event, cb)
                self._callbacks[event] = cb
            end,
            
            listen = function(self, backlog)
                local ok, err = self._socket:listen(backlog or 5)
                if not ok then return nil, err end
                self._socket:settimeout(0)
                running = true
                
                -- Store reference for the event loop
                _G.socket._server = self
                return true
            end,
            
            accept = function(self)
                if #active_clients > 0 then
                    return table.remove(active_clients, 1)
                end
                return nil, _G.socket.ERRORS.AGAIN
            end,
            
            close = function(self)
                running = false
                return self._socket:close()
            end
        }
    end
}

-- Load HTTP Server
print("Starting mGBA environment on port " .. test_port)
local script_dir = arg[0]:match("(.+)/[^/]+$") or "."
local file = io.open(script_dir .. "/../http-server.lua", "r")
if not file then
    print("ERROR: http-server.lua not found")
    os.exit(1)
end

local code = file:read("*all")
file:close()

-- Modify the port to use our test port
local modified_code = code:gsub("app:listen%(7102", "app:listen(" .. test_port)
assert(pcall(assert(load(modified_code, "http-server.lua"))))
print("HTTP server loaded successfully")

-- Event loop - simple approach: just handle socket I/O and let server handle everything else
while running do
    if socket_server then
        local client = socket_server:accept()
        if client then
            -- Set a reasonable timeout
            client:settimeout(0.5)
            
            -- Read initial request
            local data = ""
            repeat
                local chunk = client:receive(1)
                if chunk then
                    data = data .. chunk
                    if data:find("\r\n\r\n") then
                        local content_length = data:match("content%-length:%s*(%d+)")
                        if not content_length or #data >= data:find("\r\n\r\n") + 3 + tonumber(content_length) then
                            break
                        end
                    end
                end
            until not chunk or #data > 4096
            
            if #data > 0 then
                -- Create simple client wrapper
                local client_wrapper = {
                    _socket = client,
                    _callbacks = {},
                    _buffer = data,
                    _ws_mode = false,
                    
                    add = function(self, event, cb)
                        self._callbacks[event] = cb
                        if event == "received" and #self._buffer > 0 then
                            cb()
                        end
                    end,
                    
                    receive = function(self, size)
                        if #self._buffer > 0 then
                            local result = self._buffer
                            self._buffer = ""
                            return result
                        end
                        
                        if self._ws_mode then
                            -- For WebSocket, try to read any available data
                            self._socket:settimeout(0)
                            local data, err = self._socket:receive(size or 1024)
                            if data then
                                return data
                            end
                        end
                        
                        return nil, _G.socket.ERRORS.AGAIN
                    end,
                    
                    send = function(self, data)
                        if data:find("HTTP/1.1 101") then
                            self._ws_mode = true
                        end
                        return self._socket:send(data)
                    end,
                    
                    close = function(self)
                        return self._socket:close()
                    end
                }
                
                table.insert(active_clients, client_wrapper)
                
                if _G.socket._server and _G.socket._server._callbacks.received then
                    _G.socket._server._callbacks.received()
                end
                
                -- For WebSocket connections, create a background thread to monitor for data
                if data:find("Upgrade: websocket") then
                    coroutine.wrap(function()
                        while client_wrapper._ws_mode and not client_wrapper._socket:getfd() do
                            socket.sleep(0.001) -- Wait for WebSocket handshake to complete
                        end
                        
                        -- Now monitor for WebSocket frames
                        while client_wrapper._ws_mode and client_wrapper._socket do
                            client_wrapper._socket:settimeout(0.1)
                            local frame_data = client_wrapper._socket:receive(1)
                            if frame_data then
                                -- Read the rest of the frame
                                local additional = ""
                                for i = 1, 100 do
                                    local byte = client_wrapper._socket:receive(1)
                                    if byte then
                                        additional = additional .. byte
                                    else
                                        break
                                    end
                                end
                                client_wrapper._buffer = frame_data .. additional
                                
                                -- Trigger the received callback
                                if client_wrapper._callbacks.received then
                                    client_wrapper._callbacks.received()
                                end
                            elseif frame_data == nil then
                                break -- Connection closed
                            end
                            socket.sleep(0.01)
                        end
                    end)()
                end
            else
                client:close()
            end
        end
    end
    socket.sleep(0.001)
end