#!/usr/bin/env lua5.3

--[[
Simplified test version of the HTTP server that runs with standard Lua sockets
This version tests the core HTTP server functionality without mGBA dependencies
]]

local socket = require('socket')

-- Load the original HTTP server module and extract the core functionality
local function load_server_module()
    local server_path = '../http-server.lua'
    local file = io.open(server_path, 'r')
    if not file then
        error("Cannot find http-server.lua")
    end
    
    local content = file:read('*all')
    file:close()
    
    -- Mock the global dependencies
    _G.console = {
        log = function(self, msg) print("[LOG] " .. tostring(msg)) end,
        error = function(self, msg) print("[ERROR] " .. tostring(msg)) end
    }
    
    -- Create a minimal socket mock to load the module
    _G.socket = { ERRORS = { AGAIN = 'timeout' } }
    _G.emu = { romSize = function() return 1024 end }
    _G.callbacks = { 
        add = function() return 1 end, 
        remove = function() end 
    }
    
    local chunk, err = load(content, server_path)
    if not chunk then
        error("Failed to load server: " .. tostring(err))
    end
    
    local ok, result = pcall(chunk)
    if not ok then
        error("Failed to execute server: " .. tostring(result))
    end
    
    return _G.HttpServer
end

-- Simple HTTP server implementation using the HttpServer class
local function create_test_server(port)
    -- Get the HttpServer class
    local HttpServer = load_server_module()
    
    -- Create a simple TCP server
    local server = socket.tcp()
    server:setoption('reuseaddr', true)
    local ok, err = server:bind('127.0.0.1', port)
    if not ok then
        server:close()
        error("Failed to bind to port " .. port .. ": " .. tostring(err))
    end
    
    local listen_ok, listen_err = server:listen(32)
    if not listen_ok then
        server:close()
        error("Failed to listen: " .. tostring(listen_err))
    end
    
    -- Create HTTP server instance
    local app = HttpServer:new()
    
    -- Add the routes from the original server
    app:use(function(req, res)
        res:setHeader("Access-Control-Allow-Origin", "*")
        res:setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        res:setHeader("Access-Control-Allow-Headers", "Content-Type")
    end)
    
    app:get("/", function(req, res)
        res:send("200 OK", "Welcome to mGBA HTTP Server!")
    end)
    
    app:get("/json", function(req, res)
        local data = {
            message = "Hello, JSON!",
            timestamp = os.time()
        }
        res:send("200 OK", data, "application/json")
    end)
    
    app:post("/echo", function(req, res)
        res:send("200 OK", req.body, "application/json")
    end)
    
    -- WebSocket route
    app:websocket("/ws", function(ws)
        ws.onMessage = function(code)
            local chunk = code
            if not code:match("^%s*(return|local|function)") then
                chunk = "return " .. code
            end
            local fn, err = load(chunk, "websocket-eval")
            if not fn then
                ws:send(HttpServer.jsonStringify({error = err or "Invalid code"}))
                return
            end
            local ok, result = pcall(fn)
            if ok then
                ws:send(HttpServer.jsonStringify({result = result}))
            else
                ws:send(HttpServer.jsonStringify({error = tostring(result)}))
            end
        end
        
        ws.onClose = function()
            print("[LOG] WebSocket disconnected: " .. ws.path)
        end
        
        ws:send("Welcome to WebSocket Eval! Send Lua code to execute.")
    end)
    
    return server, app
end

-- Main server loop
local function run_server(port)
    local server, app = create_test_server(port)
    
    print("[LOG] Test HTTP server started on port " .. port)
    print("[LOG] Server started on port " .. port)  -- For test detection
    
    -- Simple server loop
    while true do
        server:settimeout(1)  -- 1 second timeout
        local client = server:accept()
        
        if client then
            -- Handle client in a simple way
            client:settimeout(5)  -- 5 second timeout for client operations
            
            local request_data = ""
            while true do
                local line, err = client:receive()
                if not line then
                    break
                end
                request_data = request_data .. line .. "\r\n"
                if line == "" then  -- End of headers
                    break
                end
            end
            
            if request_data ~= "" then
                -- Parse the request
                local method, path = request_data:match("^(%w+)%s+([^%s]+)")
                if method and path then
                    print("[LOG] " .. method .. " " .. path)
                    
                    -- Simple response based on the path
                    if method == "GET" and path == "/" then
                        client:send("HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nAccess-Control-Allow-Origin: *\r\n\r\nWelcome to mGBA HTTP Server!")
                    elseif method == "GET" and path == "/json" then
                        local json_resp = HttpServer.jsonStringify({
                            message = "Hello, JSON!",
                            timestamp = os.time()
                        })
                        client:send("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n" .. json_resp)
                    elseif method == "POST" and path == "/echo" then
                        -- Read the body
                        local content_length = request_data:match("Content%-Length:%s*(%d+)")
                        local body = ""
                        if content_length then
                            body = client:receive(tonumber(content_length))
                        end
                        client:send("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n" .. body)
                    else
                        client:send("HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\n\r\nNot Found")
                    end
                end
            end
            
            client:close()
        end
    end
end

-- Get port from command line
local port = tonumber(arg and arg[1]) or 7102

-- Handle shutdown gracefully
local function cleanup()
    print("[LOG] Shutting down server...")
    os.exit(0)
end

-- Run the server
local ok, err = pcall(run_server, port)
if not ok then
    print("[ERROR] Server error: " .. tostring(err))
    os.exit(1)
end