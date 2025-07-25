#!/usr/bin/env lua5.3

--[[
Working mGBA environment mock using proper socket API integration
]]

local socket = require('socket')
local test_port = tonumber(arg[1]) or 7102

-- Console API
_G.console = {
    log = function(self, msg) print("[CONSOLE] " .. tostring(msg)); io.flush() end,
    error = function(self, msg) print("[ERROR] " .. tostring(msg)); io.flush() end
}

-- Socket API that bridges between mGBA expectations and real luasocket
_G.socket = {
    ERRORS = {
        AGAIN = "again",
        ADDRESS_IN_USE = "address already in use"
    },
    
    bind = function(host, port)
        local tcp_server = socket.tcp()
        if not tcp_server then return nil, "Failed to create socket" end
        
        tcp_server:setoption("reuseaddr", true)
        local ok, err = tcp_server:bind(host or "*", port)
        if not ok then
            tcp_server:close()
            return nil, err:find("already in use") and _G.socket.ERRORS.ADDRESS_IN_USE or err
        end
        
        -- mGBA-compatible server wrapper
        local server_wrapper = {
            _tcp = tcp_server,
            _callbacks = {},
            
            add = function(self, event, callback)
                self._callbacks[event] = callback
            end,
            
            listen = function(self, backlog)
                local ok, err = self._tcp:listen(backlog or 5)
                if not ok then return nil, err end
                self._tcp:settimeout(0)
                -- Register this server globally for event processing
                _G._active_server = self
                return true
            end,
            
            accept = function(self)
                local client_tcp, err = self._tcp:accept()
                if not client_tcp then
                    return nil, err == "timeout" and _G.socket.ERRORS.AGAIN or err
                end
                
                -- mGBA-compatible client wrapper
                local client_wrapper = {
                    _tcp = client_tcp,
                    _callbacks = {},
                    
                    add = function(self, event, callback)
                        self._callbacks[event] = callback
                        if event == "received" then
                            -- Register this client for data monitoring
                            table.insert(_G._active_clients, self)
                        end
                    end,
                    
                    receive = function(self, pattern)
                        local data, err = self._tcp:receive(pattern or "*l")
                        if err == "timeout" then err = _G.socket.ERRORS.AGAIN end
                        return data, err
                    end,
                    
                    send = function(self, data)
                        return self._tcp:send(data)
                    end,
                    
                    close = function(self)
                        -- Remove from active clients
                        for i, client in ipairs(_G._active_clients) do
                            if client == self then
                                table.remove(_G._active_clients, i)
                                break
                            end
                        end
                        return self._tcp:close()
                    end
                }
                
                client_tcp:settimeout(0)
                return client_wrapper
            end,
            
            close = function(self)
                _G._active_server = nil
                return self._tcp:close()
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

-- Global state for event loop
_G._active_server = nil
_G._active_clients = {}

-- Load and execute the HTTP server
print("Starting mGBA environment on port " .. test_port)

local script_dir = arg[0]:match("(.+)/[^/]+$") or "."
local file = io.open(script_dir .. "/../http-server.lua", "r")
if not file then 
    print("ERROR: http-server.lua not found")
    os.exit(1) 
end

local code = file:read("*all")
file:close()

local modified_code = code:gsub("app:listen%(7102", "app:listen(" .. test_port)
local chunk, err = load(modified_code, "http-server.lua")
if not chunk then 
    print("ERROR: Failed to load: " .. tostring(err))
    os.exit(1) 
end

local ok, exec_err = pcall(chunk)
if not ok then 
    print("ERROR: Failed to execute: " .. tostring(exec_err))
    os.exit(1) 
end

print("HTTP server loaded successfully")

-- Event loop
local running = true
local last_status = os.time()

while running do
    -- Handle new connections
    if _G._active_server and _G._active_server._tcp then
        local client, err = _G._active_server._tcp:accept()
        if client then
            print("[DEBUG] New connection")
            if _G._active_server._callbacks.received then
                _G._active_server._callbacks.received()
            end
        end
    end
    
    -- Handle client data
    for i = #_G._active_clients, 1, -1 do
        local client = _G._active_clients[i]
        if client and client._tcp then
            local data, err = client._tcp:receive(1)  -- Check for any data
            if data then
                print("[DEBUG] Client data available")
                if client._callbacks.received then
                    client._callbacks.received()
                end
            elseif err and err ~= "timeout" then
                print("[DEBUG] Client error: " .. err)
                client:close()
            end
        else
            table.remove(_G._active_clients, i)
        end
    end
    
    -- Status
    local now = os.time()
    if now - last_status >= 10 then
        print("[DEBUG] Server running, clients: " .. #_G._active_clients)
        last_status = now
    end
    
    socket.sleep(0.001)
end