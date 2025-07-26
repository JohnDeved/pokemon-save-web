#!/usr/bin/env lua5.3
-- Minimal mGBA mock for testing http-server.lua
local socket = require('socket'); local test_port = tonumber(arg[1]) or 7102

-- mGBA API mocks
_G.console = { log = function(self, msg) print("[CONSOLE] " .. tostring(msg)); io.flush() end, error = function(self, msg) print("[ERROR] " .. tostring(msg)); io.flush() end }
_G.socket = { ERRORS = { AGAIN = "again", ADDRESS_IN_USE = "address already in use" }, _server = nil, _clients = {}, _running = false, bind = function(host, port) local server = socket.tcp(); if not server then return nil, "Failed to create socket" end; server:setoption("reuseaddr", true); local ok, err = server:bind(host or "127.0.0.1", port); if not ok then server:close(); return nil, err:find("already in use") and _G.socket.ERRORS.ADDRESS_IN_USE or err end; _G.socket._server = { _socket = server, _callbacks = {}, add = function(self, event, cb) self._callbacks[event] = cb end, listen = function(self, backlog) local ok, err = self._socket:listen(backlog or 5); if not ok then return nil, err end; self._socket:settimeout(0); _G.socket._running = true; return true end, accept = function(self) local client = _G.socket._clients[1]; if client then table.remove(_G.socket._clients, 1); return client end; return nil, _G.socket.ERRORS.AGAIN end, close = function(self) _G.socket._running = false; return self._socket:close() end }; return _G.socket._server end }
_G.emu = { romSize = function() return 1024 * 1024 end }; _G.callbacks = { add = function(self, event, cb) if event == "start" then cb() end; return 1 end, remove = function(self, id) end }

-- Load HTTP Server
print("Starting simplified mGBA environment on port " .. test_port); local script_dir = arg[0]:match("(.+)/[^/]+$") or "."; local file = io.open(script_dir .. "/../http-server.lua", "r"); if not file then print("ERROR: http-server.lua not found"); os.exit(1) end; local code = file:read("*all"); file:close(); local modified_code = code:gsub("app:listen%(7102", "app:listen(" .. test_port); assert(pcall(assert(load(modified_code, "http-server.lua")))); print("HTTP server loaded successfully")

-- Event loop with WebSocket support
local websocket_connections = {}
while _G.socket._running do
    if _G.socket._server and _G.socket._server._socket then
        local client = _G.socket._server._socket:accept()
        if client then
            client:settimeout(1.0); local request_data = ""
            repeat local chunk = client:receive(1); if chunk then request_data = request_data .. chunk; if request_data:find("\r\n\r\n") then local content_length = request_data:match("content%-length:%s*(%d+)"); if not content_length or #request_data >= request_data:find("\r\n\r\n") + 3 + tonumber(content_length) then break end end end until not chunk or #request_data > 2048
            if #request_data > 0 then
                local is_websocket = request_data:find("Upgrade: websocket") and request_data:find("/ws")
                local mock_client = { _socket = client, _callbacks = {}, _buffer = request_data, _is_websocket = is_websocket, _handshake_complete = false, add = function(self, event, cb) self._callbacks[event] = cb; if event == "received" and #self._buffer > 0 then cb() end end, receive = function(self) if #self._buffer > 0 then local result = self._buffer; self._buffer = ""; return result end; return nil, _G.socket.ERRORS.AGAIN end, send = function(self, data) local result = self._socket:send(data); if self._is_websocket and data:find("HTTP/1.1 101") then self._handshake_complete = true; websocket_connections[self] = true end; return result end, close = function(self) websocket_connections[self] = nil; return self._socket:close() end }
                table.insert(_G.socket._clients, mock_client); if _G.socket._server._callbacks.received then _G.socket._server._callbacks.received() end
            else client:close() end
        end
    end
    
    -- Handle WebSocket eval
    for ws_client, _ in pairs(websocket_connections) do
        if ws_client._handshake_complete and ws_client._socket then
            ws_client._socket:settimeout(0); local frame_data = ws_client._socket:receive(1)
            if frame_data then
                local additional_bytes = ""; for i = 1, 50 do local byte = ws_client._socket:receive(1); if byte then additional_bytes = additional_bytes .. byte else break end end; local full_frame = frame_data .. additional_bytes
                if #full_frame >= 2 and (string.byte(full_frame, 1) & 0x0F) == 1 then local masked = (string.byte(full_frame, 2) & 0x80) ~= 0; local payload_len = string.byte(full_frame, 2) & 0x7F; if payload_len > 0 and #full_frame >= (masked and 6 or 2) + payload_len then local payload_start = masked and 7 or 3; local payload = full_frame:sub(payload_start, payload_start + payload_len - 1); if masked then local mask = full_frame:sub(3, 6); local unmasked = ""; for i = 1, #payload do unmasked = unmasked .. string.char(string.byte(payload, i) ~ string.byte(mask, ((i - 1) % 4) + 1)) end; payload = unmasked end; if payload and #payload > 0 then local function safe_eval() local chunk = payload; if not payload:match("^%s*(return|local|function|for|while|if|do|repeat|goto|break|::|end)") then chunk = "return " .. payload end; local fn, err = load(chunk, "websocket-eval"); if not fn then return '{"error":"' .. (err or "Invalid code"):gsub('"', '\\"') .. '"}' end; local ok, result = pcall(fn); if ok then return '{"result":' .. (type(result) == "string" and '"' .. result:gsub('"', '\\"') .. '"' or tostring(result)) .. '}' else return '{"error":"' .. tostring(result):gsub('"', '\\"') .. '"}' end end; local response = safe_eval(); ws_client._socket:send(string.char(0x81) .. string.char(#response) .. response) end end end
            elseif frame_data ~= nil then websocket_connections[ws_client] = nil end
        end
    end
    socket.sleep(0.001)
end