#!/usr/bin/env lua5.3

--[[
Simplified mGBA-compatible runner for testing http-server.lua
This provides a minimal mGBA API environment to run the actual HTTP server code.
Much simpler than complex mocking while still testing the real implementation.
]]

local socket = require('socket')

-- Get port from command line
local test_port = tonumber(arg and arg[1]) or 7102

print("Starting mGBA-compatible runner on port " .. test_port)

--------------------------------------------------------------------------------
-- mGBA API Compatibility Layer
--------------------------------------------------------------------------------

-- Console API
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

-- Emulator API  
_G.emu = {
    getGameTitle = function() return "TEST_ROM" end,
    getGameCode = function() return "TEST" end,
    romSize = function() return 1024 * 1024 end -- 1MB ROM
}

-- Callbacks API
local callback_handlers = {}
_G.callbacks = {
    add = function(self, event, handler)
        if not callback_handlers[event] then 
            callback_handlers[event] = {} 
        end
        table.insert(callback_handlers[event], handler)
        return #callback_handlers[event] -- Return ID for removal
    end,
    remove = function(self, id) end -- Simplified removal
}

-- Socket API using lua-socket with mGBA compatibility
_G.socket = {
    ERRORS = {
        AGAIN = "timeout",
        ADDRESS_IN_USE = "address already in use"
    },
    
    bind = function(host, port)
        local server = socket.tcp()
        if not server then return nil, "Failed to create socket" end
        
        server:setoption("reuseaddr", true)
        server:settimeout(0)
        local ok, err = server:bind(host or "127.0.0.1", port)
        if not ok then
            server:close()
            return nil, err:find("already in use") and _G.socket.ERRORS.ADDRESS_IN_USE or err
        end
        
        return {
            _socket = server,
            _callbacks = {},
            
            listen = function(self)
                local ok, err = self._socket:listen()
                return ok, err
            end,
            
            add = function(self, event, callback)
                self._callbacks[event] = callback
            end,
            
            accept = function(self)
                local client, err = self._socket:accept()
                if not client then 
                    return nil, err == "timeout" and _G.socket.ERRORS.AGAIN or err
                end
                
                client:settimeout(0)
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
    end
}

--------------------------------------------------------------------------------
-- Load and Run HTTP Server
--------------------------------------------------------------------------------

-- Load the actual HTTP server code with port override
local script_path = '/home/runner/work/pokemon-save-web/pokemon-save-web/scripts/mgba-lua/http-server.lua'
local script_content = io.open(script_path, 'r'):read('*all')
script_content = script_content:gsub('app:listen%(7102,', 'app:listen(' .. test_port .. ',')

local script_func, err = load(script_content, script_path)
if not script_func then
    print("Failed to load http-server.lua: " .. tostring(err))
    os.exit(1)
end

-- Execute the script
local ok, result = pcall(script_func)
if not ok then
    print("Error executing http-server.lua: " .. tostring(result))
    os.exit(1)
end

-- Trigger start callback to initialize server
print("Triggering ROM start callback...")
if callback_handlers["start"] then
    for _, handler in ipairs(callback_handlers["start"]) do
        pcall(handler)
    end
end

print("mGBA HTTP Server ready for testing!")

-- Keep the script running
while true do
    socket.sleep(0.1)
end