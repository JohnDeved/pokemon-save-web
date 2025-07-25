#!/usr/bin/env lua5.3

--[[
Ultra-simple mGBA HTTP server mock - Direct socket integration
]]

local socket = require('socket')
local test_port = tonumber(arg[1]) or 7102

print("Starting direct socket mGBA environment on port " .. test_port)

-- Console API
_G.console = {
    log = function(self, msg) print("[CONSOLE] " .. tostring(msg)); io.flush() end,
    error = function(self, msg) print("[ERROR] " .. tostring(msg)); io.flush() end
}

-- Direct socket integration - as close to real luasocket as possible
_G.socket = {
    ERRORS = {
        AGAIN = "again",
        ADDRESS_IN_USE = "address already in use"
    },
    
    bind = function(host, port)
        local server = socket.tcp()
        if not server then return nil, "Failed to create socket" end
        
        server:setoption("reuseaddr", true)
        local ok, err = server:bind(host or "*", port)
        if not ok then
            server:close()
            return nil, err:find("already in use") and _G.socket.ERRORS.ADDRESS_IN_USE or err
        end
        
        -- Store pending clients
        local pending_clients = {}
        
        -- Wrapper that tracks clients but uses real sockets
        local wrapper = {
            _real_server = server,
            _callbacks = {},
            _pending = pending_clients,
            
            add = function(self, event, callback)
                self._callbacks[event] = callback
            end,
            
            listen = function(self, backlog)
                local ok, err = self._real_server:listen(backlog or 5)
                if not ok then return nil, err end
                self._real_server:settimeout(0)
                
                -- Start background connection acceptor
                _G._server_wrapper = self
                return true
            end,
            
            accept = function(self)
                -- Return any pending client first
                if #self._pending > 0 then
                    local client = table.remove(self._pending, 1)
                    print("[DEBUG] Returning pending client")
                    return client
                end
                
                -- Try to accept new connection
                local real_client, err = self._real_server:accept()
                if not real_client then
                    return nil, err == "timeout" and _G.socket.ERRORS.AGAIN or err
                end
                
                print("[DEBUG] New client accepted directly")
                real_client:settimeout(0)
                
                -- Create client wrapper
                local client_wrapper = {
                    _real_client = real_client,
                    _callbacks = {},
                    
                    add = function(self, event, callback)
                        self._callbacks[event] = callback
                    end,
                    
                    receive = function(self, pattern)
                        local data, err = self._real_client:receive(pattern or "*l")
                        if data then
                            print("[DEBUG] Client received " .. #data .. " bytes: " .. data:sub(1, 50) .. (#data > 50 and "..." or ""))
                        else
                            print("[DEBUG] Client receive failed: " .. tostring(err))
                        end
                        return data, err
                    end,
                    
                    send = function(self, data)
                        return self._real_client:send(data)
                    end,
                    
                    close = function(self)
                        return self._real_client:close()
                    end
                }
                
                return client_wrapper
            end,
            
            close = function(self)
                _G._server_wrapper = nil
                return self._real_server:close()
            end
        }
        
        return wrapper
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

-- Load HTTP server
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

-- Global list of active clients  
_G._active_clients = {}

-- Minimal event loop - just trigger callbacks when connections arrive
while true do
    if _G._server_wrapper then
        local server = _G._server_wrapper
        local real_client, err = server._real_server:accept()
        if real_client then
            print("[DEBUG] Background connection detected")
            real_client:settimeout(0)
            
            -- Create client wrapper and add to pending
            local client_wrapper = {
                _real_client = real_client,
                _callbacks = {},
                
                add = function(self, event, callback)
                    self._callbacks[event] = callback
                    if event == "received" then
                        -- Add to monitoring list
                        table.insert(_G._active_clients, self)
                        print("[DEBUG] Client added to monitoring list")
                    end
                end,
                
                receive = function(self, pattern)
                    -- Use blocking read with timeout for HTTP requests
                    self._real_client:settimeout(2)  -- 2 second timeout
                    local data, err = self._real_client:receive(pattern or 1024)
                    self._real_client:settimeout(0)  -- Back to non-blocking
                    if data then
                        print("[DEBUG] Pending client received " .. #data .. " bytes: " .. data:sub(1, 100) .. (#data > 100 and "..." or ""))
                    else
                        print("[DEBUG] Pending client receive failed: " .. tostring(err))
                    end
                    if err == "timeout" then err = _G.socket.ERRORS.AGAIN end
                    return data, err
                end,
                
                send = function(self, data)
                    return self._real_client:send(data)
                end,
                
                close = function(self)
                    -- Remove from monitoring list
                    for i, client in ipairs(_G._active_clients) do
                        if client == self then
                            table.remove(_G._active_clients, i)
                            break
                        end
                    end
                    return self._real_client:close()
                end
            }
            
            table.insert(server._pending, client_wrapper)
            
            -- Trigger received callback
            if server._callbacks.received then
                server._callbacks.received()
            end
        end
    end
    
    -- Monitor active clients for data
    for i = #_G._active_clients, 1, -1 do
        local client = _G._active_clients[i]
        if client and client._real_client then
            -- Check if data is available
            local ready = socket.select({client._real_client}, {}, 0)
            if ready and #ready > 0 then
                print("[DEBUG] Data available for client, triggering callback")
                if client._callbacks.received then
                    client._callbacks.received()
                end
                -- Remove from list since data has been detected
                table.remove(_G._active_clients, i)
            end
        else
            table.remove(_G._active_clients, i)
        end
    end
    
    socket.sleep(0.001)
end