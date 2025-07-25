#!/usr/bin/env lua5.3
local socket = require('socket')
local test_port = tonumber(arg[1]) or 7102
_G.console = {log = function(self, msg) print("[CONSOLE] " .. tostring(msg)); io.flush() end, error = function(self, msg) print("[ERROR] " .. tostring(msg)); io.flush() end}
_G.socket = {
    ERRORS = { AGAIN = "again", ADDRESS_IN_USE = "address already in use" },
    _server = nil, _clients = {}, _running = false,
    bind = function(host, port)
        local server = socket.tcp()
        if not server then return nil, "Failed to create socket" end
        server:setoption("reuseaddr", true)
        local ok, err = server:bind(host or "127.0.0.1", port)
        if not ok then server:close(); return nil, err:find("already in use") and _G.socket.ERRORS.ADDRESS_IN_USE or err end
        _G.socket._server = {
            _socket = server, _callbacks = {},
            add = function(self, event, callback) self._callbacks[event] = callback end,
            listen = function(self, backlog) local ok, err = self._socket:listen(backlog or 5); if not ok then return nil, err end; self._socket:settimeout(0); _G.socket._running = true; return true end,
            accept = function(self) local client = _G.socket._clients[1]; if client then table.remove(_G.socket._clients, 1); return client end; return nil, _G.socket.ERRORS.AGAIN end,
            close = function(self) _G.socket._running = false; return self._socket:close() end
        }
        return _G.socket._server
    end
}
_G.emu = { romSize = function() return 1024 * 1024 end }
_G.callbacks = { add = function(self, event, callback) if event == "start" then callback() end; return 1 end, remove = function(self, id) end }
print("Starting simplified mGBA environment on port " .. test_port)
local file = io.open((arg[0]:match("(.+)/[^/]+$") or ".") .. "/../http-server.lua", "r")
if not file then print("ERROR: http-server.lua not found"); os.exit(1) end
local chunk, err = load(file:read("*all"):gsub("app:listen%(7102", "app:listen(" .. test_port), "http-server.lua")
file:close()
if not chunk then print("ERROR: Failed to load: " .. tostring(err)); os.exit(1) end
if not pcall(chunk) then print("ERROR: Failed to execute"); os.exit(1) end
print("HTTP server loaded successfully")
for i = 1, 50000 do
    if not _G.socket._running or not _G.socket._server then break end
    local client = _G.socket._server._socket:accept()
    if client then
        client:settimeout(1.0)
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
        until not chunk or #data > 2048
        if #data > 0 then
            table.insert(_G.socket._clients, {
                _socket = client, _callbacks = {}, _buffer = data,
                add = function(self, event, callback) self._callbacks[event] = callback; if event == "received" and #self._buffer > 0 then callback() end end,
                receive = function(self) if #self._buffer > 0 then local result = self._buffer; self._buffer = ""; return result end; return nil, _G.socket.ERRORS.AGAIN end,
                send = function(self, data) return self._socket:send(data) end,
                close = function(self) self._socket:close() end
            })
            if _G.socket._server._callbacks.received then _G.socket._server._callbacks.received() end
        else client:close() end
    end
    socket.sleep(0.001)
end
print("Event loop ended")