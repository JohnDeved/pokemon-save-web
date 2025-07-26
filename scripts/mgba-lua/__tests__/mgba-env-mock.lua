---@diagnostic disable: unused-local, redundant-return-value, missing-fields
#!/usr/bin/env lua5.3
-- Minimal mGBA mock for testing http-server.lua
local socket = require('socket')
local test_port = tonumber(arg[1]) or 7102

-- mGBA API mocks
_G.console = {
    log = function(self, msg) print("[CONSOLE] " .. tostring(msg)); io.flush() end,
    error = function(self, msg) print("[ERROR] " .. tostring(msg)); io.flush() end
}
_G.emu = { romSize = function() return 1024 * 1024 end }
_G.callbacks = {
    add = function(self, event, cb) if event == "start" then cb() end; return 1 end,
    remove = function(self, id) end
}

-- Socket mock using lua-socket
local server, clients, running = nil, {}, false

_G.socket = {
    ERRORS = { AGAIN = "again", ADDRESS_IN_USE = "address already in use" },
    
    bind = function(host, port)
        local tcp = socket.tcp()
        if not tcp then return nil, "Failed to create socket" end
        
        tcp:setoption("reuseaddr", true)
        local ok, err = tcp:bind(host or "127.0.0.1", port)
        if not ok then
            tcp:close()
            return nil, err:find("already in use") and _G.socket.ERRORS.ADDRESS_IN_USE or err
        end
        
        server = tcp
        return {
            _callbacks = {},
            add = function(self, event, cb) self._callbacks[event] = cb end,
            listen = function(self, backlog)
                local ok, err = server:listen(backlog or 5)
                if not ok then return nil, err end
                server:settimeout(0)
                running = true
                _G.socket._server = self
                return true
            end,
            accept = function(self) 
                if #clients > 0 then
                    return table.remove(clients, 1)
                end
                return nil, _G.socket.ERRORS.AGAIN 
            end,
            close = function(self) running = false; return server:close() end
        }
    end
}

-- Load and start HTTP server
print("Starting mGBA environment on port " .. test_port)
local code = assert(io.open((arg[0]:match("(.+)/[^/]+$") or ".") .. "/../http-server.lua", "r")):read("*all")
assert(pcall(assert(load(code:gsub("app:listen%(7102", "app:listen(" .. test_port), "http-server.lua"))))
print("HTTP server loaded successfully")

-- Event loop
while running do
    local client = server:accept()
    if client then
        client:settimeout(0.5)
        
        -- Read request
        local data = ""
        repeat
            local chunk = client:receive(1)
            if chunk then
                data = data .. chunk
                if data:find("\r\n\r\n") then
                    local len = data:match("content%-length:%s*(%d+)")
                    if not len or #data >= data:find("\r\n\r\n") + 3 + tonumber(len) then break end
                end
            end
        until not chunk or #data > 4096
        
        if #data > 0 then
            local wrapper = {
                _socket = client, _callbacks = {}, _buffer = data, _ws = false,
                add = function(self, event, cb)
                    self._callbacks[event] = cb
                    if event == "received" and #self._buffer > 0 then cb() end
                end,
                receive = function(self, size)
                    if #self._buffer > 0 then
                        local result = self._buffer
                        self._buffer = ""
                        return result
                    end
                    if self._ws then
                        self._socket:settimeout(0)
                        return self._socket:receive(size or 1024)
                    end
                    return nil, _G.socket.ERRORS.AGAIN
                end,
                send = function(self, data)
                    if data:find("HTTP/1.1 101") then self._ws = true end
                    return self._socket:send(data)
                end,
                close = function(self) return self._socket:close() end
            }
            
            table.insert(clients, wrapper)
            if _G.socket._server._callbacks.received then _G.socket._server._callbacks.received() end
            
            -- WebSocket monitoring
            if data:find("Upgrade: websocket") then
                coroutine.wrap(function()
                    while wrapper._ws and wrapper._socket do
                        wrapper._socket:settimeout(0.1)
                        local frame = wrapper._socket:receive(1)
                        if frame then
                            -- Read frame data
                            local more = ""
                            for i = 1, 100 do
                                local byte = wrapper._socket:receive(1)
                                if not byte then break end
                                more = more .. byte
                            end
                            wrapper._buffer = frame .. more
                            if wrapper._callbacks.received then wrapper._callbacks.received() end
                        elseif not frame then break end
                        socket.sleep(0.01)
                    end
                end)()
            end
        else
            client:close()
        end
    end
    socket.sleep(0.001)
end