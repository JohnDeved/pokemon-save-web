#!/usr/bin/env lua5.3

--[[
Simple mGBA compatibility runner that provides enough mGBA APIs 
to run the http-server.lua script for testing purposes.
This approach is much simpler than complex mocking or C++ bindings.
]]

local socket = require('socket')

-- Get port from command line
local test_port = tonumber(arg and arg[1]) or 7102

print("Starting simple mGBA compatibility runner on port " .. test_port)

--------------------------------------------------------------------------------
-- Simple mGBA API Compatibility Layer
--------------------------------------------------------------------------------

-- Mock console API
_G.console = {
    log = function(self, msg) 
        print("[CONSOLE] " .. tostring(msg)) 
        io.flush() 
    end,
    error = function(self, msg) 
        print("[ERROR] " .. tostring(msg)) 
        io.flush() 
    end
}

-- Mock emu API with basic functionality
_G.emu = {
    getGameTitle = function() return "TEST_ROM" end,
    getGameCode = function() return "TEST" end,
    pause = function() end,
    unpause = function() end,
    reset = function() end,
    romSize = function() return 1024 * 1024 end -- 1MB ROM size
}

-- Mock callbacks API
local callback_handlers = {}
_G.callbacks = {
    add = function(self, event, handler)
        if not callback_handlers[event] then 
            callback_handlers[event] = {} 
        end
        table.insert(callback_handlers[event], handler)
    end,
    remove = function(self, event, handler)
        if callback_handlers[event] then
            for i, h in ipairs(callback_handlers[event]) do
                if h == handler then
                    table.remove(callback_handlers[event], i)
                    break
                end
            end
        end
    end
}

-- Simplified socket API using real lua-socket
_G.socket = {
    ERRORS = {
        AGAIN = "timeout",
        ADDRESS_IN_USE = "address already in use"
    },
    
    bind = function(host, port)
        local server = socket.tcp()
        if not server then 
            return nil, "Failed to create socket" 
        end
        
        server:setoption("reuseaddr", true)
        server:settimeout(0) -- Non-blocking
        local ok, err = server:bind(host or "127.0.0.1", port)
        if not ok then
            server:close()
            return nil, err:find("already in use") and _G.socket.ERRORS.ADDRESS_IN_USE or err
        end
        
        -- Wrap with mGBA-compatible interface
        local mgba_server = {
            _socket = server,
            _callbacks = {},
            
            listen = function(self)
                local ok, err = self._socket:listen()
                if not ok then return nil, err end
                return true
            end,
            
            add = function(self, event, callback)
                self._callbacks[event] = callback
            end,
            
            accept = function(self)
                local client, err = self._socket:accept()
                if not client then 
                    return nil, err == "timeout" and _G.socket.ERRORS.AGAIN or err
                end
                
                client:settimeout(0) -- Non-blocking
                
                -- Return mGBA-compatible client
                return {
                    _socket = client,
                    _callbacks = {},
                    
                    add = function(self, event, callback)
                        self._callbacks[event] = callback
                    end,
                    
                    receive = function(self, count)
                        local data, err = self._socket:receive(count or "*l")
                        if not data then
                            return nil, err == "timeout" and _G.socket.ERRORS.AGAIN or err
                        end
                        return data
                    end,
                    
                    send = function(self, data)
                        return self._socket:send(data)
                    end,
                    
                    close = function(self)
                        return self._socket:close()
                    end
                }
            end,
            
            close = function(self)
                return self._socket:close()
            end
        }
        
        return mgba_server
    end,
    
    tcp = function()
        local client = socket.tcp()
        if not client then return nil end
        
        client:settimeout(0)
        return {
            _socket = client,
            _callbacks = {},
            
            add = function(self, event, callback)
                self._callbacks[event] = callback
            end,
            
            connect = function(self, host, port)
                local ok, err = self._socket:connect(host, port)
                return ok ~= nil, err
            end,
            
            receive = function(self, count)
                local data, err = self._socket:receive(count or "*l")
                if not data then
                    return nil, err == "timeout" and _G.socket.ERRORS.AGAIN or err
                end
                return data
            end,
            
            send = function(self, data)
                return self._socket:send(data)
            end,
            
            close = function(self)
                return self._socket:close()
            end
        }
    end
}

--------------------------------------------------------------------------------
-- Load and Run the HTTP Server
--------------------------------------------------------------------------------

-- Load the actual HTTP server code
local script_path = '/home/runner/work/pokemon-save-web/pokemon-save-web/scripts/mgba-lua/http-server.lua'
local script_content = io.open(script_path, 'r'):read('*all')

-- Replace the default port with our test port
script_content = script_content:gsub('app:listen%(7102,', 'app:listen(' .. test_port .. ',')

print("Loading http-server.lua with port " .. test_port .. "...")

-- Load and execute the modified script
local script_func, err = load(script_content, script_path)
if not script_func then
    print("Failed to load http-server.lua: " .. tostring(err))
    return 1
end

-- Execute the script
print("Executing http-server.lua...")
local ok, result = pcall(script_func)
if not ok then
    print("Error executing http-server.lua: " .. tostring(result))
    return 1
end

print("HTTP server script loaded successfully!")

-- Start the server immediately since we have a simulated ROM environment

-- Simple event loop to trigger callbacks and keep server running
print("Starting event loop...")

-- Simulate ROM loading by triggering the "start" callback after a short delay
local startup_delay = 50 -- loops before triggering start
local loop_count = 0
local rom_loaded = false

while true do
    loop_count = loop_count + 1
    
    -- Trigger ROM start callback after delay
    if not rom_loaded and loop_count > startup_delay then
        print("Simulating ROM load - triggering start callback...")
        if callback_handlers["start"] then
            for _, handler in ipairs(callback_handlers["start"]) do
                pcall(handler)
            end
        end
        rom_loaded = true
    end
    
    -- Simple heartbeat
    if loop_count % 1000 == 0 then
        print("Event loop running... (count: " .. loop_count .. ")")
    end
    
    -- Small delay to prevent busy loop
    socket.sleep(0.001) -- 1ms
end