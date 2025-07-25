#!/usr/bin/env lua5.3

--[[
mGBA-accurate socket API mock based on mgba/src/script/engines/lua.c
Implements the exact mGBA socket structure and behavior patterns.
]]

local socket = require('socket')
local test_port = tonumber(arg[1]) or 7102

-- Implement mGBA-accurate socket API following lua.c patterns
_G.socket = {
    ERRORS = { AGAIN = "temporary failure", ADDRESS_IN_USE = "address in use" },
    
    -- Internal state tracking
    _clients = {},
    _running = false,
    _server = nil,
    
    -- mGBA socket creation function
    _create = function(sock, mt) 
        return setmetatable({
            _s = sock,                -- Real socket (mGBA pattern)
            _callbacks = {},          -- Event callbacks by type
            _nextCallback = 1,        -- mGBA callback ID counter
        }, mt) 
    end,
    
    -- mGBA error wrapping
    _wrap = function(status)
        if status == 0 then return 1 end
        return nil, _G.socket.ERRORS[status] or ('error#' .. status)
    end,
    
    -- Base socket metatable (shared methods)
    _mt = {
        __index = {
            close = function(self)
                self._callbacks = {}
                if self._s then return self._s:close() end
            end,
            
            -- mGBA callback management (exact API from lua.c)
            add = function(self, event, callback)
                if not self._callbacks[event] then self._callbacks[event] = {} end
                local cbid = self._nextCallback
                self._nextCallback = cbid + 1
                self._callbacks[event][cbid] = callback
                return cbid
            end,
            
            remove = function(self, cbid)
                for _, group in pairs(self._callbacks) do
                    if group[cbid] then group[cbid] = nil end
                end
            end,
            
            -- mGBA event dispatch (exact pattern from lua.c)
            _dispatch = function(self, event, ...)
                if not self._callbacks[event] then return end
                for k, cb in pairs(self._callbacks[event]) do
                    if cb then
                        local ok, ret = pcall(cb, self, ...)
                        if not ok then print("[ERROR] " .. tostring(ret)) end
                    end
                end
            end,
        },
    },
    
    -- TCP socket metatable following mGBA lua.c structure
    _tcpMT = {
        __index = {
            bind = function(self, address, port)
                local ok, err = self._s:bind(address or '127.0.0.1', port)
                if ok then
                    return _G.socket._wrap(0)
                else
                    return nil, (err:find("already in use") and _G.socket.ERRORS.ADDRESS_IN_USE or err)
                end
            end,
            
            listen = function(self, backlog)
                local ok, err = self._s:listen(backlog or 1)
                if ok then 
                    self._s:settimeout(0)
                    _G.socket._running = true
                    return _G.socket._wrap(0)
                end
                return _G.socket._wrap(1)
            end,
            
            accept = function(self)
                if #_G.socket._clients > 0 then
                    local client = table.remove(_G.socket._clients, 1)
                    return client
                end
                return _G.socket._wrap(1)  -- mGBA AGAIN error
            end,
            
            send = function(self, data)
                return self._s:send(data)
            end,
            
            -- mGBA receive implementation matching lua.c
            receive = function(self, maxBytes)
                -- Special handling for mock buffer (first-time HTTP/WebSocket data)
                if self._buffer and #self._buffer > 0 then
                    local result = self._buffer
                    self._buffer = nil  
                    return result
                end
                
                -- Try to receive fresh data from socket
                self._s:settimeout(0)
                local result, err = self._s:receive(maxBytes or 1024)
                if result and #result > 0 then
                    return result
                end
                
                return nil, _G.socket.ERRORS.AGAIN
            end,
        }
    },
    
    -- Main socket creation functions
    tcp = function() 
        local s = socket.tcp()
        if not s then return nil end
        s:setoption("reuseaddr", true)
        return _G.socket._create(s, _G.socket._tcpMT) 
    end,
    
    bind = function(address, port)
        local s = _G.socket.tcp()
        local ok, err = s:bind(address, port)
        if ok then 
            _G.socket._server = s
            return s 
        end
        return ok, err
    end,
}

-- Set up mGBA metatable inheritance (from lua.c)
setmetatable(_G.socket._tcpMT.__index, _G.socket._mt)

-- Other mGBA API mocks
_G.console = {
    log = function(self, msg) print("[CONSOLE] " .. tostring(msg)); io.flush() end,
    error = function(self, msg) print("[ERROR] " .. tostring(msg)); io.flush() end
}

_G.emu = { romSize = function() return 1024 * 1024 end }
_G.callbacks = { 
    add = function(self, event, callback) if event == "start" then callback() end; return 1 end,
    remove = function(self, id) end
}

-- Load HTTP server
print("Starting mGBA-accurate environment on port " .. test_port)

local script_dir = arg[0]:match("(.+)/[^/]+$") or "."
local file = io.open(script_dir .. "/../http-server.lua", "r")
if not file then print("ERROR: http-server.lua not found"); os.exit(1) end

local code = file:read("*all"); file:close()
local modified_code = code:gsub("app:listen%(7102", "app:listen(" .. test_port)
local chunk, err = load(modified_code, "http-server.lua")
if not chunk then print("ERROR: Failed to load: " .. tostring(err)); os.exit(1) end

local ok, exec_err = pcall(chunk)
if not ok then print("ERROR: Failed to execute: " .. tostring(exec_err)); os.exit(1) end

-- mGBA-style event loop with proper frame monitoring
while _G.socket._running do
    -- Accept new connections
    if _G.socket._server and _G.socket._server._s then
        local raw_client = _G.socket._server._s:accept()
        if raw_client then
            raw_client:settimeout(1)
            
            -- Read complete HTTP request
            local request_data = ""
            repeat
                local chunk = raw_client:receive(1)
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
                -- Create mGBA-style client with buffer
                local mock_client = _G.socket._create(raw_client, _G.socket._tcpMT)
                mock_client._buffer = request_data  -- Store initial HTTP data
                
                table.insert(_G.socket._clients, mock_client)
                
                -- Trigger server received callback
                if _G.socket._server._callbacks.received then
                    for _, cb in pairs(_G.socket._server._callbacks.received) do
                        if cb then cb() end
                    end
                end
            else
                raw_client:close()
            end
        end
    end
    
    -- Monitor clients for ongoing WebSocket frame data
    for i = #_G.socket._clients, 1, -1 do
        local client = _G.socket._clients[i]
        if client._s then
            client._s:settimeout(0)
            local frame_data, err = client._s:receive(1024)
            if frame_data and #frame_data > 0 then
                -- Store frame data in buffer for client:receive() calls
                client._buffer = frame_data
                -- Dispatch received event using mGBA pattern
                client:_dispatch("received")
            elseif err and err ~= "timeout" then
                -- Client disconnected
                client._s:close()
                table.remove(_G.socket._clients, i)
            end
        end
    end
    
    socket.sleep(0.001)
end

print("Event loop ended")