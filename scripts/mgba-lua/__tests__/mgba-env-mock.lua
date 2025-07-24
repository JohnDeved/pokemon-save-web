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
        io.flush() -- Ensure output is flushed immediately
    end,
    error = function(msg)
        print("[ERROR] " .. tostring(msg))
        io.flush()
    end
}

-- Create global variables to hold server state
local SERVER_STATE = {
    server = nil,
    clients = {},
    pending_clients = {},
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
                
                -- Just set up non-blocking accept, don't start any loops here
                self._socket:settimeout(0)
                
                return true -- Return immediately - this is key!
            end,
            
            accept = function(self)
                print("[MOCK] HTTP server calling accept()")
                -- First, check if we have any pending clients
                if SERVER_STATE.pending_clients and #SERVER_STATE.pending_clients > 0 then
                    local client = table.remove(SERVER_STATE.pending_clients, 1)
                    print("[MOCK] Returning pending client connection")
                    client:settimeout(0)
                    
                    local client_id = #SERVER_STATE.clients + 1
                    
                    local mock_client = {
                        _socket = client,
                        _id = client_id,
                        _callbacks = {},
                        _data_buffer = "",
                        _buffer_complete = false,
                        _callback_triggered = false,
                        
                        add = function(self, event, callback)
                            print("[MOCK] Adding " .. event .. " callback to client " .. self._id)
                            self._callbacks[event] = callback
                        end,
                        
                        receive = function(self, count)
                            -- Return data from buffer
                            if #self._data_buffer > 0 then
                                if count and count > 0 then
                                    if #self._data_buffer >= count then
                                        local result = self._data_buffer:sub(1, count)
                                        self._data_buffer = self._data_buffer:sub(count + 1)
                                        print("[MOCK] Client " .. self._id .. " returning " .. #result .. " bytes, " .. #self._data_buffer .. " remaining")
                                        return result
                                    else
                                        local result = self._data_buffer
                                        self._data_buffer = ""
                                        print("[MOCK] Client " .. self._id .. " returning all " .. #result .. " bytes")
                                        return result
                                    end
                                else
                                    local result = self._data_buffer
                                    self._data_buffer = ""
                                    print("[MOCK] Client " .. self._id .. " returning all " .. #result .. " bytes")
                                    return result
                                end
                            else
                                return nil, _G.socket.ERRORS.AGAIN
                            end
                        end,
                        
                        send = function(self, data)
                            print("[MOCK] Client " .. self._id .. " sending " .. #data .. " bytes")
                            return self._socket:send(data)
                        end,
                        
                        close = function(self)
                            print("[MOCK] Closing client " .. self._id)
                            if self._socket then
                                self._socket:close()
                                self._socket = nil
                            end
                        end
                    }
                    
                    SERVER_STATE.clients[client_id] = mock_client
                    return mock_client
                else
                    -- No pending clients
                    return nil, _G.socket.ERRORS.AGAIN
                end
            end,
            
            close = function(self)
                SERVER_STATE.running = false
                return self._socket:close()
            end
        }
        
        SERVER_STATE.server = mock_server
        
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

-- Add debugging for server startup path
local old_start_server = nil
if type(start_server) == "function" then
    print("[MOCK] start_server function found")
end

-- Execute the server code
local ok, exec_err = pcall(modified_chunk)
if not ok then
    console:error("Failed to execute http-server.lua: " .. tostring(exec_err))
    os.exit(1)
end

print("HTTP server code executed successfully")
print("HTTP server should now be running on port " .. test_port)

-- Start the event loop to handle connections
print("[MOCK] Starting event loop...")

-- Main event loop
local loop_count = 0
while SERVER_STATE.running do
    loop_count = loop_count + 1
    if loop_count % 1000 == 0 then
        print("[MOCK] Event loop iteration " .. loop_count)
    end
    
    -- Check for new connections on the server socket
    if SERVER_STATE.server and SERVER_STATE.server._socket then
        SERVER_STATE.server._socket:settimeout(0) -- Ensure non-blocking
        local client, err = SERVER_STATE.server._socket:accept()
        if client then
            print("[MOCK] New client connected, setting up pending connection")
            -- Store pending connections
            if not SERVER_STATE.pending_clients then
                SERVER_STATE.pending_clients = {}
            end
            table.insert(SERVER_STATE.pending_clients, client)
            
            print("[MOCK] Triggering server received callback")
            -- Trigger the server's "received" callback
            if SERVER_STATE.server._callbacks.received then
                SERVER_STATE.server._callbacks.received()
            end
        elseif err and err ~= "timeout" then
            print("[MOCK] Server accept error: " .. tostring(err))
        end
    else
        if loop_count % 1000 == 0 then
            print("[MOCK] No server socket available")
        end
    end
    
    -- Check for data on existing client connections and buffer it immediately
    for client_id, mock_client in pairs(SERVER_STATE.clients) do
        if mock_client._socket and not mock_client._buffer_complete then
            -- Continuously buffer data as it arrives
            mock_client._socket:settimeout(0)
            local data, err = mock_client._socket:receive("*a")
            if data and #data > 0 then
                mock_client._data_buffer = mock_client._data_buffer .. data
                print("[MOCK] Client " .. client_id .. " buffered " .. #data .. " bytes, total: " .. #mock_client._data_buffer)
                
                -- Check if we have a complete HTTP request
                if mock_client._data_buffer:find("\r\n\r\n") then
                    mock_client._buffer_complete = true
                    print("[MOCK] Client " .. client_id .. " has complete HTTP request, triggering callback if not already triggered")
                    if mock_client._callbacks.received and not mock_client._callback_triggered then
                        mock_client._callback_triggered = true
                        mock_client._callbacks.received()
                    end
                end
            elseif err and err ~= "timeout" then
                print("[MOCK] Client " .. client_id .. " disconnected while buffering: " .. tostring(err))
                if mock_client._callbacks.error then
                    mock_client._callbacks.error()
                end
            end
        end
    end
    
    -- Small delay to prevent busy waiting
    socket.sleep(0.01)
end

print("[MOCK] Event loop ended, server stopping...")