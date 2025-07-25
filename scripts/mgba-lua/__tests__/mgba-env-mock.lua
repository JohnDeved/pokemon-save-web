#!/usr/bin/env lua5.3

local socket = require('socket')

-- Get port from command line
local test_port = tonumber(arg[1]) or 7102

--------------------------------------------------------------------------------
-- mGBA-accurate Socket API Implementation (based on lua.c source)
--------------------------------------------------------------------------------

-- Mock callbacks system with frame simulation
_G.callbacks = {
    _next_id = 1,
    _callbacks = {},
    
    add = function(self, event, callback)
        local id = self._next_id
        self._next_id = id + 1
        if not self._callbacks[event] then self._callbacks[event] = {} end
        self._callbacks[event][id] = callback
        return id
    end,
    
    remove = function(self, id)
        for event, cbs in pairs(self._callbacks) do
            if cbs[id] then cbs[id] = nil end
        end
    end,
    
    _dispatch = function(self, event, ...)
        if self._callbacks[event] then
            for id, cb in pairs(self._callbacks[event]) do
                if cb then
                    local ok, err = pcall(cb, ...)
                    if not ok then print("[CALLBACK ERROR]", err) end
                end
            end
        end
    end
}

-- Mock mGBA socket API using the exact structure from lua.c
_G.socket = {
    ERRORS = {
        [1] = "unknown error",
        [2] = "again", 
        [3] = "address already in use",
        [4] = "connection refused",
        [5] = "network unreachable",
        [6] = "timeout"
    },
    
    _clients = {},
    _server = nil,
    _running = false,
    
    -- Create socket wrapper with mGBA structure
    _create = function(sock, mt)
        return setmetatable({
            _s = sock,
            _callbacks = {},
            _nextCallback = 1,
            _onframecb = nil
        }, mt)
    end,
    
    _wrap = function(status)
        if status == 0 then return 1 end
        return nil, _G.socket.ERRORS[status] or ('error#' .. status)
    end,
    
    -- Base metatable for all sockets
    _mt = {
        __index = {
            close = function(self)
                if self._onframecb then
                    _G.callbacks:remove(self._onframecb)
                    self._onframecb = nil
                end
                self._callbacks = {}
                return self._s:close()
            end,
            
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
            
            _dispatch = function(self, event, ...)
                if not self._callbacks[event] then return end
                for k, cb in pairs(self._callbacks[event]) do
                    if cb then
                        local ok, ret = pcall(cb, self, ...)
                        if not ok then _G.console:error(ret) end
                    end
                end
            end,
        },
    },
    
    -- TCP socket metatable following mGBA structure
    _tcpMT = {
        __index = {
            _hook = function(self, status)
                if status == 0 then
                    self._onframecb = _G.callbacks:add('frame', function() self:poll() end)
                end
                return _G.socket._wrap(status)
            end,
            
            bind = function(self, address, port)
                self._s:setoption("reuseaddr", true)
                local ok, err = self._s:bind(address or "127.0.0.1", port)
                if not ok then
                    return nil, err:find("already in use") and _G.socket.ERRORS[3] or err
                end
                _G.socket._server = self
                return _G.socket._wrap(0)
            end,
            
            listen = function(self, backlog)
                local ok, err = self._s:listen(backlog or 5)
                if not ok then return nil, err end
                self._s:settimeout(0)
                _G.socket._running = true
                return self:_hook(0)
            end,
            
            accept = function(self)
                if #_G.socket._clients > 0 then
                    return table.remove(_G.socket._clients, 1)
                end
                return nil, _G.socket.ERRORS[2] -- "again"
            end,
            
            send = function(self, data, i, j)
                local result = self._s:send(string.sub(data, i or 1, j))
                if result then return result end
                return nil, "closed"
            end,
            
            receive = function(self, maxBytes)
                if self._buffer and #self._buffer > 0 then
                    local result
                    if maxBytes and maxBytes < #self._buffer then
                        result = self._buffer:sub(1, maxBytes)
                        self._buffer = self._buffer:sub(maxBytes + 1)
                    else
                        result = self._buffer
                        self._buffer = ""
                    end
                    return result
                end
                return nil, _G.socket.ERRORS[2] -- "again"
            end,
            
            hasdata = function(self)
                return self._buffer and #self._buffer > 0
            end,
            
            poll = function(self)
                local status, err = self:hasdata()
                if err then
                    self:_dispatch('error', err)
                elseif status then
                    self:_dispatch('received')
                end
            end,
        },
    },
    
    tcp = function()
        local s = socket.tcp()
        if not s then return nil, "Failed to create socket" end
        return _G.socket._create(s, _G.socket._tcpMT)
    end,
    
    bind = function(address, port)
        local s = _G.socket.tcp()
        local ok, err = s:bind(address, port)
        if ok then return s end
        return ok, err
    end
}

-- Set up inheritance for TCP sockets
setmetatable(_G.socket._tcpMT.__index, _G.socket._mt)

-- Mock console API with proper colon method handling
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

-- Mock emu API
_G.emu = { 
    romSize = function() return 1024 * 1024 end,
    getGameTitle = function() return "Test Game" end
}

--------------------------------------------------------------------------------
-- Server Execution and Event Loop
--------------------------------------------------------------------------------

print("Starting mGBA-accurate environment on port " .. test_port)

-- Load the HTTP server
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

-- Enhanced event loop with accurate frame simulation
local loop_count = 0
while _G.socket._running and loop_count < 50000 do
    loop_count = loop_count + 1
    
    -- Simulate frame callbacks (like mGBA does)
    _G.callbacks:_dispatch('frame')
    
    -- Accept new connections
    if _G.socket._server and _G.socket._server._s then
        local client = _G.socket._server._s:accept()
        if client then
            client:settimeout(1.0)
            
            -- Read complete HTTP request with proper buffering
            local request_data = ""
            local content_length = nil
            local headers_complete = false
            
            repeat
                local chunk = client:receive(1)
                if chunk then
                    request_data = request_data .. chunk
                    
                    -- Check for complete headers
                    if not headers_complete and request_data:find("\r\n\r\n") then
                        headers_complete = true
                        content_length = request_data:match("[Cc]ontent%-[Ll]ength:%s*(%d+)")
                        if content_length then content_length = tonumber(content_length) end
                        
                        -- If no content-length, request is complete
                        if not content_length then break end
                    end
                    
                    -- Check for complete body if we have content-length
                    if headers_complete and content_length then
                        local header_end = request_data:find("\r\n\r\n")
                        if #request_data >= header_end + 3 + content_length then
                            break
                        end
                    end
                end
            until not chunk or #request_data > 8192 -- Safety limit
            
            if #request_data > 0 then
                -- Create accurate mGBA socket wrapper for client
                local mock_client = _G.socket._create(client, _G.socket._tcpMT)
                mock_client._buffer = request_data
                mock_client:_hook(0) -- Enable frame callbacks
                
                table.insert(_G.socket._clients, mock_client)
                
                -- Trigger server received callback
                if _G.socket._server._callbacks.received then
                    for _, cb in pairs(_G.socket._server._callbacks.received) do
                        if cb then cb(_G.socket._server) end
                    end
                end
            else
                client:close()
            end
        end
    end
    
    -- Monitor existing clients for additional data (WebSocket frames)
    for i = #_G.socket._clients, 1, -1 do
        local client = _G.socket._clients[i]
        if client._s then
            client._s:settimeout(0)
            local frame_data = ""
            
            -- Try to read WebSocket frame data
            for j = 1, 30 do -- Increase read attempts for WebSocket frames
                local chunk, err = client._s:receive(1)
                if chunk then
                    frame_data = frame_data .. chunk
                elseif err ~= "timeout" then
                    -- Client disconnected
                    if #frame_data == 0 then
                        client._s:close()
                        table.remove(_G.socket._clients, i)
                        break
                    else
                        break
                    end
                else
                    break -- No more data available
                end
            end
            
            -- If we got new WebSocket frame data, buffer it and trigger callbacks
            if #frame_data > 0 then
                if client._buffer then
                    client._buffer = client._buffer .. frame_data
                else
                    client._buffer = frame_data
                end
                
                -- Trigger received callbacks for this client
                client:_dispatch('received')
            end
        end
    end
    
    socket.sleep(0.001) -- Small delay to prevent CPU spinning
end

print("mGBA environment shutting down")