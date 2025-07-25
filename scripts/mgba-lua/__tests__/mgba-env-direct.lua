#!/usr/bin/env lua5.3

--[[
Direct integration approach - Run the HTTP server in a subprocess 
and use Node.js to test it
]]

local socket = require('socket')
local test_port = tonumber(arg[1]) or 7102

-- Simple mGBA API mocks
_G.console = {
    log = function(self, msg) print("[CONSOLE] " .. tostring(msg)); io.flush() end,
    error = function(self, msg) print("[ERROR] " .. tostring(msg)); io.flush() end
}

-- Real socket API with proper wrappers for mGBA compatibility
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
        
        -- Wrap the TCP server to match mGBA API expectations
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
                return true
            end,
            
            accept = function(self)
                local client_tcp, err = self._tcp:accept()
                if not client_tcp then
                    return nil, err == "timeout" and _G.socket.ERRORS.AGAIN or err
                end
                
                -- Wrap client to match mGBA API
                local client_wrapper = {
                    _tcp = client_tcp,
                    _callbacks = {},
                    
                    add = function(self, event, callback)
                        self._callbacks[event] = callback
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
                        return self._tcp:close()
                    end
                }
                
                client_tcp:settimeout(0)
                return client_wrapper
            end,
            
            close = function(self)
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

-- Load and execute the HTTP server
print("Starting direct mGBA environment on port " .. test_port)

local script_dir = arg[0]:match("(.+)/[^/]+$") or "."
local file = io.open(script_dir .. "/../http-server.lua", "r")
if not file then 
    print("ERROR: http-server.lua not found")
    os.exit(1) 
end

local code = file:read("*all")
file:close()

-- Replace the port in the code
local modified_code = code:gsub("app:listen%(7102", "app:listen(" .. test_port)

-- Load and execute
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

-- Keep the server running and process events
print("HTTP server loaded successfully")

-- Simple event loop to handle mGBA-style events
local running = true
local server_obj = nil

-- Hook into the server instance when it's created
local original_listen = _G.socket.bind
local server_instances = {}

_G.socket.bind = function(host, port)
    local server = original_listen(host, port)
    if server then
        table.insert(server_instances, server)
    end
    return server
end

while running do
    -- Check all server instances for new connections
    for _, server in ipairs(server_instances) do
        if server._tcp then
            local client, err = server._tcp:accept()
            if client then
                print("[DEBUG] New connection accepted")
                -- Trigger the received callback if registered
                if server._callbacks.received then
                    server._callbacks.received()
                end
            end
        end
    end
    
    socket.sleep(0.01)
end