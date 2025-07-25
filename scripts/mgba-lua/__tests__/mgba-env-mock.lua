#!/usr/bin/env lua5.3

-- Simple mGBA environment mock that tests the actual http-server.lua
-- This version is designed for clarity and maintainability

local socket = require('socket')
local port = tonumber(arg[1]) or 7102

-- =============================================================================
-- Mock mGBA APIs
-- =============================================================================

-- Console API - Simple logging to stdout
_G.console = {
    log = function(_, message)
        print("[CONSOLE] " .. tostring(message))
        io.flush()
    end,
    error = function(_, message)
        print("[ERROR] " .. tostring(message))
        io.flush()
    end
}

-- Emulator API - Minimal mock for ROM detection
_G.emu = {
    romSize = function()
        return 1048576 -- Fake ROM size to indicate ROM is loaded
    end
}

-- Callbacks API - Simple callback registration
_G.callbacks = {
    add = function(_, event, callback)
        if event == "start" then
            callback() -- Execute immediately for testing
        end
        return 1 -- Return callback ID
    end,
    remove = function(_, id)
        -- No-op for testing
    end
}

-- =============================================================================
-- Socket API Mock - Maps mGBA socket API to lua-socket
-- =============================================================================

local server_socket = nil
local client_connections = {}
local is_running = false

_G.socket = {
    -- Error constants that match mGBA
    ERRORS = {
        AGAIN = "again",
        ADDRESS_IN_USE = "address already in use"
    },
    
    -- Main bind function - creates a server socket
    bind = function(host, bind_port)
        local tcp_socket = socket.tcp()
        if not tcp_socket then
            return nil, "Failed to create socket"
        end
        
        tcp_socket:setoption("reuseaddr", true)
        local success, err = tcp_socket:bind(host or "127.0.0.1", bind_port)
        
        if not success then
            tcp_socket:close()
            if err and err:find("already in use") then
                return nil, _G.socket.ERRORS.ADDRESS_IN_USE
            end
            return nil, err
        end
        
        -- Create server wrapper that mimics mGBA server API
        local server = {
            _socket = tcp_socket,
            _callbacks = {},
            
            -- Add event listeners
            add = function(self, event, callback)
                self._callbacks[event] = callback
            end,
            
            -- Start listening for connections
            listen = function(self)
                local success, listen_err = self._socket:listen(5)
                if not success then
                    return nil, listen_err
                end
                
                self._socket:settimeout(0) -- Non-blocking
                server_socket = self
                is_running = true
                return true
            end,
            
            -- Accept new client connections
            accept = function(self)
                if #client_connections > 0 then
                    local client = table.remove(client_connections, 1)
                    return client
                end
                return nil, _G.socket.ERRORS.AGAIN
            end,
            
            -- Close the server
            close = function(self)
                is_running = false
                return self._socket:close()
            end
        }
        
        return server
    end
}

-- =============================================================================
-- Load and Execute the actual mGBA HTTP Server
-- =============================================================================

print("Starting mGBA environment mock on port " .. port)

-- Load the actual http-server.lua file
local script_dir = arg[0]:match("(.+)/[^/]+$") or "."
local server_file = script_dir .. "/../http-server.lua"

local file = io.open(server_file, "r")
if not file then
    print("ERROR: Could not find http-server.lua at " .. server_file)
    os.exit(1)
end

-- Read and modify the port in the server code
local server_code = file:read("*all")
file:close()

-- Replace the hardcoded port with our test port
server_code = server_code:gsub("app:listen%(7102", "app:listen(" .. port)

-- Execute the server code
local chunk, load_err = load(server_code, "http-server.lua")
if not chunk then
    print("ERROR: Failed to load http-server.lua: " .. tostring(load_err))
    os.exit(1)
end

local success, exec_err = pcall(chunk)
if not success then
    print("ERROR: Failed to execute http-server.lua: " .. tostring(exec_err))
    os.exit(1)
end

print("HTTP server loaded successfully")

-- =============================================================================
-- Simple Event Loop - Handle incoming connections
-- =============================================================================

-- Main event loop that handles new connections
for i = 1, 50000 do -- Reasonable loop limit
    if not is_running then
        break
    end
    
    -- Check for new connections
    if server_socket then
        local client_socket = server_socket._socket:accept()
        if client_socket then
            client_socket:settimeout(1) -- Short timeout for testing
            
            -- Read the HTTP request data
            local request_data = ""
            repeat
                local char = client_socket:receive(1)
                if char then
                    request_data = request_data .. char
                    -- Stop when we have the full HTTP request
                    if request_data:find("\r\n\r\n") then
                        local content_length = request_data:match("content%-length:%s*(%d+)")
                        if not content_length or #request_data >= (request_data:find("\r\n\r\n") + 3 + tonumber(content_length)) then
                            break
                        end
                    end
                end
            until not char or #request_data > 2048
            
            -- Only create client wrapper if we received data
            if #request_data > 0 then
                -- Create client wrapper that mimics mGBA client API
                local client = {
                    _socket = client_socket,
                    _callbacks = {},
                    _buffer = request_data,
                    
                    add = function(self, event, callback)
                        self._callbacks[event] = callback
                        -- Trigger received event immediately if we have data
                        if event == "received" and #self._buffer > 0 then
                            callback()
                        end
                    end,
                    
                    receive = function(self, size)
                        if #self._buffer > 0 then
                            local data = self._buffer
                            self._buffer = ""
                            return data
                        end
                        return nil, _G.socket.ERRORS.AGAIN
                    end,
                    
                    send = function(self, data)
                        return self._socket:send(data)
                    end,
                    
                    close = function(self)
                        self._socket:close()
                    end
                }
                
                table.insert(client_connections, client)
                
                -- Trigger server's received callback
                if server_socket._callbacks.received then
                    server_socket._callbacks.received()
                end
            else
                client_socket:close()
            end
        end
    end
    
    socket.sleep(0.001) -- Small delay to prevent busy waiting
end

print("Event loop ended")