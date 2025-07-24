#!/usr/bin/env lua5.3

--[[
Virtual mGBA Lua environment for testing the actual http-server.lua
This script creates mocks for all mGBA APIs using real TCP sockets,
then loads and runs the actual http-server.lua code without modifications.
]]

local socket = require('socket')

-- Get port from command line argument
local test_port = tonumber(arg[1]) or 7102

--------------------------------------------------------------------------------
-- Mock mGBA APIs
--------------------------------------------------------------------------------

-- Mock console API
_G.console = {
    log = function(msg)
        local str_msg = tostring(msg)
        print("[CONSOLE] " .. str_msg)
    end,
    error = function(msg)
        print("[ERROR] " .. tostring(msg))
    end
}

-- Create global variables to hold server state
local SERVER_STATE = {
    server = nil,
    clients = {},
    running = false
}

-- Mock socket API with simplified implementation
_G.socket = {
    ERRORS = {
        AGAIN = "again",
        ADDRESS_IN_USE = "address already in use"
    },
    
    bind = function(host, port)
        print("[MOCK] Creating server socket on " .. (host or "127.0.0.1") .. ":" .. port)
        
        local server = socket.tcp()
        if not server then
            return nil, "Failed to create socket"
        end
        
        server:setoption("reuseaddr", true)
        
        local ok, err = server:bind(host or "127.0.0.1", port)
        if not ok then
            server:close()
            if err:find("Address already in use") or err:find("address already in use") then
                return nil, _G.socket.ERRORS.ADDRESS_IN_USE
            end
            return nil, err
        end
        
        SERVER_STATE.server = server
        
        -- Create mock server object
        local mock_server = {
            _socket = server,
            _callbacks = {},
            
            add = function(self, event, callback)
                print("[MOCK] Adding " .. event .. " callback to server (after creation)")
                self._callbacks[event] = callback
            end,
            
            listen = function(self, backlog)
                print("[MOCK] Starting server listen on port " .. port)
                local ok, err = self._socket:listen(backlog or 5)
                if not ok then
                    print("[MOCK] Listen failed: " .. tostring(err))
                    return nil, err
                end
                
                print("[MOCK] Listen successful, server should be ready")
                SERVER_STATE.running = true
                
                -- Simple accept loop
                coroutine.wrap(function()
                    while SERVER_STATE.running do
                        self._socket:settimeout(0.1) -- Short timeout
                        local client, err = self._socket:accept()
                        if client then
                            print("[MOCK] Client connected")
                            if self._callbacks.received then
                                self._callbacks.received()
                            end
                        end
                    end
                end)()
                
                -- Return success - this should trigger the callback
                return true
            end,
            
            accept = function(self)
                local client, err = self._socket:accept()
                if client then
                    client:settimeout(0)
                    
                    local client_id = #SERVER_STATE.clients + 1
                    
                    local mock_client = {
                        _socket = client,
                        _id = client_id,
                        _callbacks = {},
                        _data_buffer = "",
                        
                        add = function(self, event, callback)
                            self._callbacks[event] = callback
                        end,
                        
                        receive = function(self, count)
                            local data, err = self._socket:receive(count)
                            if data then
                                return data
                            else
                                if err == "timeout" then
                                    return nil, _G.socket.ERRORS.AGAIN
                                end
                                return nil, err
                            end
                        end,
                        
                        send = function(self, data)
                            return self._socket:send(data)
                        end,
                        
                        close = function(self)
                            if self._socket then
                                self._socket:close()
                                self._socket = nil
                            end
                        end
                    }
                    
                    SERVER_STATE.clients[client_id] = mock_client
                    return mock_client
                else
                    if err == "timeout" then
                        return nil, _G.socket.ERRORS.AGAIN
                    end
                    return nil, err
                end
            end,
            
            close = function(self)
                SERVER_STATE.running = false
                return self._socket:close()
            end
        }
        
        return mock_server
    end
}

-- Mock emu API
_G.emu = {
    romSize = function()
        print("[MOCK] emu.romSize called, returning 1MB")
        return 1024 * 1024 -- Mock 1MB ROM
    end
}

-- Mock callbacks API
_G.callbacks = {
    _callbacks = {},
    _next_id = 1,
    
    add = function(self, event, callback)
        print("[MOCK] Adding callback for event: " .. event)
        local id = self._next_id
        self._next_id = self._next_id + 1
        self._callbacks[id] = {event = event, callback = callback}
        
        -- For "start" event, trigger immediately since we're already "started"
        if event == "start" then
            print("[MOCK] Triggering start callback immediately")
            callback()
        end
        
        return id
    end,
    
    remove = function(self, id)
        print("[MOCK] Removing callback: " .. id)
        self._callbacks[id] = nil
    end
}

--------------------------------------------------------------------------------
-- Load and execute the actual http-server.lua
--------------------------------------------------------------------------------

print("Starting virtual mGBA environment on port " .. test_port)
print("Loading actual http-server.lua...")

-- Change the working directory to the parent to load the http-server.lua
local script_dir = arg[0]:match("(.+)/[^/]+$") or "."
local http_server_path = script_dir .. "/../http-server.lua"

print("Looking for http-server.lua at: " .. http_server_path)

-- Check if file exists
local file = io.open(http_server_path, "r")
if not file then
    console:error("http-server.lua not found at: " .. http_server_path)
    os.exit(1)
end

local original_http_server_code = file:read("*all")
file:close()

print("File loaded, size: " .. #original_http_server_code .. " bytes")

-- Replace the hardcoded port 7102 with our test port
local modified_code = original_http_server_code:gsub("app:listen%(7102", "app:listen(" .. test_port)

print("Code modified, starting execution...")

-- Load and execute the modified code
local modified_chunk, mod_err = load(modified_code, "http-server.lua")
if not modified_chunk then
    console:error("Failed to load modified http-server.lua: " .. tostring(mod_err))
    os.exit(1)
end

print("Code loaded, executing...")

-- Execute the server code
local ok, exec_err = pcall(modified_chunk)
if not ok then
    console:error("Failed to execute http-server.lua: " .. tostring(exec_err))
    os.exit(1)
end

print("HTTP server should now be running on port " .. test_port)

-- Keep the server running
while SERVER_STATE.running do
    socket.sleep(0.1)
end