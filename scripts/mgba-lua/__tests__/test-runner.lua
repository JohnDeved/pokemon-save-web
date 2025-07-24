#!/usr/bin/env lua5.3

--[[
Standalone test runner for the Lua HTTP server
This creates a compatibility layer for mGBA APIs using real Lua socket library
]]

-- Import required modules
local socket = require('socket')
local ltn12 = require('ltn12')

-- Mock console for logging
local console = {
    log = function(self, msg)
        print("[LOG] " .. tostring(msg))
    end,
    error = function(self, msg)
        print("[ERROR] " .. tostring(msg))
    end
}

-- Mock socket wrapper that adapts luasocket to mGBA socket API
local socket_wrapper = {
    ERRORS = {
        AGAIN = 'timeout',
        ADDRESS_IN_USE = 'address already in use'
    }
}

function socket_wrapper.bind(host, port)
    local server = socket.tcp()
    if not server then
        return nil, "Failed to create socket"
    end
    
    server:setoption('reuseaddr', true)
    local ok, err = server:bind(host or '*', port)
    if not ok then
        server:close()
        if err == 'address already in use' then
            return nil, socket_wrapper.ERRORS.ADDRESS_IN_USE
        end
        return nil, err
    end
    
    local listen_ok, listen_err = server:listen(32)
    if not listen_ok then
        server:close()
        return nil, listen_err
    end
    
    -- Wrap server with mGBA-like API
    local wrapped_server = {
        _socket = server,
        _events = {},
        
        accept = function(self)
            local client, err = self._socket:accept()
            if not client then
                return nil, err
            end
            
            -- Set non-blocking mode
            client:settimeout(0)
            
            -- Wrap client with mGBA-like API
            local wrapped_client = {
                _socket = client,
                
                receive = function(self, bytes)
                    local data, err = self._socket:receive(bytes or '*l')
                    if err == 'timeout' then
                        return nil, socket_wrapper.ERRORS.AGAIN
                    end
                    return data, err
                end,
                
                send = function(self, data)
                    return self._socket:send(data)
                end,
                
                close = function(self)
                    return self._socket:close()
                end
            }
            
            return wrapped_client, nil
        end,
        
        listen = function(self)
            -- Already listening from socket.bind, just return success
            return true, nil
        end,
        
        add = function(self, event, callback)
            if not self._events[event] then
                self._events[event] = {}
            end
            table.insert(self._events[event], callback)
            
            -- Start polling for "received" events (new connections)
            if event == "received" then
                self:_start_polling()
            end
        end,
        
        _start_polling = function(self)
            -- Start a simple polling loop for accepting clients
            local function poll()
                -- Set a small timeout to check for new connections
                self._socket:settimeout(0.1)
                local client = self._socket:accept()
                if client then
                    -- Trigger "received" event
                    if self._events["received"] then
                        for _, callback in ipairs(self._events["received"]) do
                            callback()
                        end
                    end
                end
                
                -- Continue polling (in a real implementation, this would be event-driven)
                -- For testing, we'll use a simple timer
                if _G._server_running then
                    socket.sleep(0.01) -- Small delay to prevent tight loop
                    poll()
                end
            end
            
            -- Mark server as running and start polling in background
            _G._server_running = true
            
            -- Start polling in a coroutine-like manner
            local co = coroutine.create(poll)
            coroutine.resume(co)
        end,
        
        close = function(self)
            _G._server_running = false
            return self._socket:close()
        end
    }
    
    return wrapped_server, nil
end

-- Mock emu (emulator) - minimal implementation
local emu = {
    romSize = function()
        return 1024 * 1024 -- Fake ROM size to indicate ROM is loaded
    end
}

-- Mock callbacks system
local callbacks = {
    _callbacks = {},
    _next_id = 1,
    
    add = function(self, event, callback)
        local id = self._next_id
        self._next_id = self._next_id + 1
        self._callbacks[id] = {event = event, callback = callback}
        
        -- For 'start' event, call immediately since we're already "started"
        if event == 'start' then
            callback()
        end
        
        return id
    end,
    
    remove = function(self, id)
        self._callbacks[id] = nil
    end
}

-- Set up global mGBA API mocks
_G.console = console
_G.socket = socket_wrapper
_G.emu = emu
_G.callbacks = callbacks

-- Get command line arguments
local port = tonumber(arg and arg[1]) or 7102

print("[TEST-RUNNER] Starting Lua HTTP server test runner on port " .. port)

-- Load and run the HTTP server
local server_path = '../http-server.lua'
local file = io.open(server_path, 'r')
if not file then
    error("Cannot find http-server.lua at " .. server_path)
end

local content = file:read('*all')
file:close()

-- Execute the server code
local chunk, err = load(content, server_path)
if not chunk then
    error("Failed to load server code: " .. tostring(err))
end

local ok, result = pcall(chunk)
if not ok then
    error("Failed to execute server code: " .. tostring(result))
end

print("[TEST-RUNNER] Server should be running. Press Ctrl+C to stop.")

-- Keep the script running
while true do
    socket.sleep(1)
end