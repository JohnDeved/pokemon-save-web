-- Test suite for the Lua HTTP server in scripts/mgba-lua/http-server.lua
-- Tests all main functionality including HTTP endpoints and WebSocket handling
-- Includes mocks for mGBA-specific APIs to run standalone

local busted = require('busted')

-- Mock mGBA APIs
local mock_console = {
  log = function(msg)
    -- Safe logging that handles any type
    if type(msg) == "table" then
      msg = "table: " .. tostring(msg)
    end
    -- Silent in tests, or uncomment for debugging: print("[CONSOLE] " .. tostring(msg))
  end,
  error = function(msg)
    -- Safe error logging
    if type(msg) == "table" then
      msg = "table: " .. tostring(msg)
    end
    -- Silent in tests, or uncomment for debugging: print("[ERROR] " .. tostring(msg))
  end
}

local mock_socket = {
  ERRORS = {
    AGAIN = "EAGAIN",
    ADDRESS_IN_USE = "EADDRINUSE"
  },
  bind = function(host, port)
    -- Mock successful binding
    local server = {
      listen = function()
        return true, nil -- success
      end,
      close = function()
        return true
      end,
      accept = function()
        -- Return a mock client
        return {
          receive = function(size)
            return nil, mock_socket.ERRORS.AGAIN
          end,
          send = function(data)
            return true, nil
          end,
          close = function()
            return true
          end,
          add = function(event, callback)
            -- Mock event registration
          end
        }, nil
      end,
      add = function(event, callback)
        -- Mock event registration
      end
    }
    return server, nil
  end
}

local mock_emu = {
  romSize = function()
    return 1024 * 1024 -- Mock 1MB ROM
  end
}

local mock_callbacks = {
  add = function(event, callback)
    -- Mock callback registration, return a fake ID
    return 1
  end,
  remove = function(id)
    -- Mock callback removal
  end
}

-- Mock global time function
_G.os = _G.os or {}
_G.os.time = function()
  return 1609459200 -- Mock timestamp: 2021-01-01 00:00:00 UTC
end

-- Set up global mocks
_G.console = mock_console
_G.socket = mock_socket
_G.emu = mock_emu
_G.callbacks = mock_callbacks

-- Load the HTTP server code
package.path = package.path .. ";../?.lua"

-- Read the server code and extract just the HttpServer class (before example usage)
local file_content = io.open("../http-server.lua", "r"):read("*all")
local class_start, class_end = file_content:find("local HttpServer = {}.-%-%- Example Usage")

if not class_start then
  error("Could not find HttpServer class definition")
end

local class_definition = file_content:sub(class_start, class_end)
-- Modify to expose HttpServer globally and remove the example app creation
class_definition = class_definition:gsub("local HttpServer", "_G.HttpServer")
class_definition = class_definition:gsub("%-%- Example Usage", "-- HttpServer class loaded")

-- Execute the class definition
local chunk, err = load(class_definition, "http-server-class")
if not chunk then
  error("Failed to load HttpServer class: " .. tostring(err))
end

chunk()

-- Get HttpServer from global environment
local HttpServer = _G.HttpServer
if not HttpServer then
  error("HttpServer not found in global environment")
end

describe("HttpServer", function()
  
  describe("Static utility functions", function()
    
    it("should stringify JSON correctly", function()
      -- Test basic types
      assert.are.equal('"hello"', HttpServer.jsonStringify("hello"))
      assert.are.equal("42", HttpServer.jsonStringify(42))
      assert.are.equal("true", HttpServer.jsonStringify(true))
      assert.are.equal("false", HttpServer.jsonStringify(false))
      assert.are.equal("null", HttpServer.jsonStringify(nil))
      
      -- Test arrays
      assert.are.equal("[1,2,3]", HttpServer.jsonStringify({1, 2, 3}))
      
      -- Test objects
      assert.are.equal('{"key":"value"}', HttpServer.jsonStringify({key = "value"}))
      
      -- Test empty table
      assert.are.equal("{}", HttpServer.jsonStringify({}))
      
      -- Test string escaping
      assert.are.equal('"quote:\\"test\\""', HttpServer.jsonStringify('quote:"test"'))
      assert.are.equal('"backslash:\\\\test"', HttpServer.jsonStringify('backslash:\\test'))
    end)
    
    it("should create CORS middleware", function()
      local cors_middleware = HttpServer.cors("*")
      assert.is_function(cors_middleware)
      
      -- Test default origin
      local default_cors = HttpServer.cors()
      assert.is_function(default_cors)
      
      -- Mock request and response for middleware test
      local req = {}
      local res = {
        _headers = {},
        setHeader = function(self, key, value)
          self._headers[key] = value
        end
      }
      
      cors_middleware(req, res)
      
      assert.are.equal("*", res._headers["Access-Control-Allow-Origin"])
      assert.are.equal("GET, POST, OPTIONS", res._headers["Access-Control-Allow-Methods"])
      assert.are.equal("Content-Type", res._headers["Access-Control-Allow-Headers"])
    end)
    
    it("should generate WebSocket accept key correctly", function()
      local test_key = "dGhlIHNhbXBsZSBub25jZQ=="
      local expected = "s3pPLMBiTxaQ9kYGzzhZRbK+xOo="
      local result = HttpServer.generateWebSocketAccept(test_key)
      assert.are.equal(expected, result)
    end)
    
    it("should create WebSocket frames", function()
      local data = "Hello"
      local frame = HttpServer.createWebSocketFrame(data)
      
      -- Check frame structure
      assert.is_string(frame)
      assert.is_true(#frame > #data) -- Frame should be longer than data due to headers
      
      -- First byte should be 0x81 (FIN + text frame)
      assert.are.equal(0x81, string.byte(frame, 1))
      
      -- Second byte should be length (5 for "Hello")
      assert.are.equal(5, string.byte(frame, 2))
      
      -- Data should be at the end
      assert.are.equal("Hello", frame:sub(3))
    end)
    
    it("should parse WebSocket frames", function()
      local test_data = "Hello"
      local frame = HttpServer.createWebSocketFrame(test_data)
      local parsed_data, consumed = HttpServer.parseWebSocketFrame(frame)
      
      assert.are.equal(test_data, parsed_data)
      assert.are.equal(#frame, consumed)
      
      -- Test incomplete frame
      local incomplete = frame:sub(1, 3)
      local parsed_incomplete, consumed_incomplete = HttpServer.parseWebSocketFrame(incomplete)
      assert.is_nil(parsed_incomplete)
      assert.are.equal(0, consumed_incomplete)
    end)
    
  end)
  
  describe("HttpServer instance", function()
    local server
    
    before_each(function()
      server = HttpServer:new()
    end)
    
    it("should create new instance", function()
      assert.is_table(server)
      assert.is_table(server.routes)
      assert.is_table(server.routes.GET)
      assert.is_table(server.routes.POST)
      assert.is_table(server.middlewares)
      assert.is_table(server.clients)
      assert.is_table(server.websockets)
      assert.is_table(server.wsRoutes)
      assert.are.equal(1, server.nextClientId)
    end)
    
    it("should register middleware", function()
      local middleware_called = false
      local middleware = function(req, res)
        middleware_called = true
      end
      
      server:use(middleware)
      assert.are.equal(1, #server.middlewares)
      assert.are.equal(middleware, server.middlewares[1])
    end)
    
    it("should register GET routes", function()
      local handler_called = false
      local handler = function(req, res)
        handler_called = true
        res:send("200 OK", "test")
      end
      
      server:get("/test", handler)
      assert.is_table(server.routes.GET["/test"])
      assert.are.equal(1, #server.routes.GET["/test"])
      assert.are.equal(handler, server.routes.GET["/test"][1])
    end)
    
    it("should register POST routes", function()
      local handler = function(req, res)
        res:send("200 OK", "test")
      end
      
      server:post("/test", handler)
      assert.is_table(server.routes.POST["/test"])
      assert.are.equal(1, #server.routes.POST["/test"])
      assert.are.equal(handler, server.routes.POST["/test"][1])
    end)
    
    it("should register WebSocket routes", function()
      local ws_handler = function(ws)
        -- WebSocket handler
      end
      
      server:websocket("/ws", ws_handler)
      assert.are.equal(ws_handler, server.wsRoutes["/ws"])
    end)
    
  end)
  
  describe("HTTP request parsing", function()
    local server
    
    before_each(function()
      server = HttpServer:new()
    end)
    
    it("should parse valid HTTP request", function()
      local request_str = "GET /test HTTP/1.1\r\nHost: localhost\r\nContent-Type: text/plain\r\n\r\ntest body"
      local req = server:_parse_request(request_str)
      
      assert.is_table(req)
      assert.are.equal("GET", req.method)
      assert.are.equal("/test", req.path)
      assert.are.equal("localhost", req.headers.host)
      assert.are.equal("text/plain", req.headers["content-type"])
      assert.are.equal("test body", req.body)
    end)
    
    it("should handle requests without body", function()
      local request_str = "GET / HTTP/1.1\r\nHost: localhost\r\n\r\n"
      local req = server:_parse_request(request_str)
      
      assert.is_table(req)
      assert.are.equal("GET", req.method)
      assert.are.equal("/", req.path)
      assert.are.equal("", req.body)
    end)
    
    it("should return nil for invalid requests", function()
      local invalid_request = "INVALID REQUEST"
      local req = server:_parse_request(invalid_request)
      assert.is_nil(req)
      
      local incomplete_request = "GET / HTTP/1.1\r\nHost: localhost"
      local req2 = server:_parse_request(incomplete_request)
      assert.is_nil(req2)
    end)
    
  end)
  
  describe("HTTP response generation", function()
    local server
    local mock_client
    local test_state
    
    before_each(function()
      server = HttpServer:new()
      test_state = { sent_data = nil }
      mock_client = {
        send = function(self, data)
          test_state.sent_data = data
          return true, nil
        end
      }
    end)
    
    it("should create valid response object", function()
      local res = server:_create_response(mock_client, 1)
      
      assert.is_table(res)
      assert.is_false(res.finished)
      assert.is_function(res.setHeader)
      assert.is_function(res.send)
      assert.are.equal("close", res._headers.Connection)
    end)
    
    it("should send text response", function()
      local res = server:_create_response(mock_client, 1)
      
      -- Add debugging
      local send_called = false
      local original_send = mock_client.send
      mock_client.send = function(self, data)
        send_called = true
        return original_send(self, data)
      end
      
      res:send("200 OK", "Hello World", "text/plain")
      
      assert.is_true(res.finished)
      assert.is_true(send_called, "Mock client send was not called")
      assert.is_string(test_state.sent_data)
      assert.is_not_nil(test_state.sent_data:find("HTTP/1.1 200 OK"))
      assert.is_not_nil(test_state.sent_data:find("Content-Type: text/plain"))
      assert.is_not_nil(test_state.sent_data:find("Content-Length: 11"))
      assert.is_not_nil(test_state.sent_data:find("Hello World"))
    end)
    
    it("should send JSON response", function()
      local res = server:_create_response(mock_client, 1)
      local data = {message = "test", value = 42}
      res:send("200 OK", data)
      
      assert.is_true(res.finished)
      assert.is_string(test_state.sent_data)
      assert.is_not_nil(test_state.sent_data:find("Content-Type: application/json"))
      -- JSON order might vary, so check for both possible orders
      assert.is_true(test_state.sent_data:find('{"message":"test","value":42}') ~= nil or
                    test_state.sent_data:find('{"value":42,"message":"test"}') ~= nil)
    end)
    
    it("should handle custom headers", function()
      local res = server:_create_response(mock_client, 1)
      res:setHeader("X-Custom", "test-value")
      res:send("200 OK", "test")
      
      assert.is_not_nil(test_state.sent_data:find("X-Custom: test-value"))
    end)
    
  end)
  
  describe("WebSocket detection", function()
    local server
    
    before_each(function()
      server = HttpServer:new()
    end)
    
    it("should detect valid WebSocket upgrade request", function()
      local req = {
        headers = {
          upgrade = "websocket",
          connection = "Upgrade",
          ["sec-websocket-key"] = "dGhlIHNhbXBsZSBub25jZQ=="
        }
      }
      
      assert.is_true(server:_is_websocket_request(req))
    end)
    
    it("should reject non-WebSocket requests", function()
      local req = {
        headers = {
          ["content-type"] = "text/plain"
        }
      }
      
      assert.is_false(server:_is_websocket_request(req))
    end)
    
    it("should reject incomplete WebSocket requests", function()
      local req = {
        headers = {
          upgrade = "websocket",
          connection = "Upgrade"
          -- Missing sec-websocket-key
        }
      }
      
      assert.is_false(server:_is_websocket_request(req))
    end)
    
  end)
  
  describe("Route handling simulation", function()
    local server
    local mock_client
    local test_state
    
    before_each(function()
      server = HttpServer:new()
      test_state = { sent_data = nil }
      mock_client = {
        send = function(self, data)
          test_state.sent_data = data
          return true, nil
        end
      }
    end)
    
    it("should handle GET / route", function()
      -- Register the default route like in the actual server
      server:get("/", function(req, res)
        res:send("200 OK", "Welcome to mGBA HTTP Server!")
      end)
      
      local res = server:_create_response(mock_client, 1)
      local req = {method = "GET", path = "/", headers = {}, body = ""}
      
      server:_handle_request("GET", "/", req, res)
      
      assert.is_true(res.finished)
      assert.is_not_nil(test_state.sent_data:find("Welcome to mGBA HTTP Server!"))
    end)
    
    it("should handle GET /json route with CORS", function()
      -- Register the JSON route with CORS like in the actual server
      server:get("/json", HttpServer.cors(), function(req, res)
        res:send("200 OK", {message = "Hello, JSON!", timestamp = os.time()})
      end)
      
      local res = server:_create_response(mock_client, 1)
      local req = {method = "GET", path = "/json", headers = {}, body = ""}
      
      server:_handle_request("GET", "/json", req, res)
      
      assert.is_true(res.finished)
      assert.is_not_nil(test_state.sent_data:find("Access-Control-Allow-Origin: *"))
      assert.is_not_nil(test_state.sent_data:find("Content-Type: application/json"))
      assert.is_not_nil(test_state.sent_data:find('"message":"Hello, JSON!"'))
      assert.is_not_nil(test_state.sent_data:find('"timestamp":1609459200'))
    end)
    
    it("should handle POST /echo route", function()
      -- Register the echo route like in the actual server
      server:post("/echo", function(req, res)
        res:send("200 OK", req.body, req.headers['content-type'])
      end)
      
      local res = server:_create_response(mock_client, 1)
      local req = {
        method = "POST", 
        path = "/echo", 
        headers = {['content-type'] = "application/json"}, 
        body = '{"test": "data"}'
      }
      
      server:_handle_request("POST", "/echo", req, res)
      
      assert.is_true(res.finished)
      assert.is_not_nil(test_state.sent_data:find('Content-Type: application/json'))
      assert.is_not_nil(test_state.sent_data:find('{"test": "data"}'))
    end)
    
    it("should execute middleware before routes", function()
      local middleware_executed = false
      local route_executed = false
      
      server:use(function(req, res)
        middleware_executed = true
        -- Add a header to verify middleware ran
        res:setHeader("X-Middleware", "executed")
      end)
      
      server:get("/test", function(req, res)
        route_executed = true
        res:send("200 OK", "test")
      end)
      
      local res = server:_create_response(mock_client, 1)
      local req = {method = "GET", path = "/test", headers = {}, body = ""}
      
      server:_handle_request("GET", "/test", req, res)
      
      assert.is_true(middleware_executed)
      assert.is_true(route_executed)
      assert.is_not_nil(test_state.sent_data:find("X-Middleware: executed"))
    end)
    
  end)
  
  describe("WebSocket handling simulation", function()
    local server
    local mock_client
    local test_state
    
    before_each(function()
      server = HttpServer:new()
      test_state = { sent_data = {} }
      mock_client = {
        send = function(self, data)
          table.insert(test_state.sent_data, data)
          return true, nil
        end
      }
    end)
    
    it("should handle WebSocket upgrade", function()
      local req = {
        path = "/ws",
        headers = {
          upgrade = "websocket",
          connection = "Upgrade",
          ["sec-websocket-key"] = "dGhlIHNhbXBsZSBub25jZQ=="
        }
      }
      
      -- Register WebSocket route
      local ws_connected = false
      local captured_ws = nil
      server:websocket("/ws", function(ws)
        ws_connected = true
        captured_ws = ws
        assert.are.equal("/ws", ws.path)
        assert.are.equal(mock_client, ws.client)
        assert.is_function(ws.send)
        assert.is_function(ws.close)
      end)
      
      server:_handle_websocket_upgrade(1, req)
      
      assert.is_true(ws_connected)
      assert.is_table(server.websockets[1])
      
      -- Check handshake response
      assert.are.equal(1, #test_state.sent_data)
      local handshake_response = test_state.sent_data[1]
      assert.is_not_nil(handshake_response:find("HTTP/1.1 101 Switching Protocols"))
      assert.is_not_nil(handshake_response:find("Upgrade: websocket"))
      assert.is_not_nil(handshake_response:find("Connection: Upgrade"))
      assert.is_not_nil(handshake_response:find("Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo="))
    end)
    
    it("should handle WebSocket message sending", function()
      local req = {
        path = "/ws",
        headers = {
          upgrade = "websocket",
          connection = "Upgrade", 
          ["sec-websocket-key"] = "dGhlIHNhbXBsZSBub25jZQ=="
        }
      }
      
      local received_ws = nil
      server:websocket("/ws", function(ws)
        received_ws = ws
      end)
      
      server:_handle_websocket_upgrade(1, req)
      
      -- Ensure WebSocket was created
      assert.is_not_nil(received_ws)
      
      -- Send a message through the WebSocket
      received_ws:send("Hello WebSocket!")
      
      assert.are.equal(2, #test_state.sent_data) -- Handshake + message
      
      -- Check the WebSocket frame
      local frame = test_state.sent_data[2]
      local message, consumed = HttpServer.parseWebSocketFrame(frame)
      assert.are.equal("Hello WebSocket!", message)
    end)
    
    it("should handle WebSocket close", function()
      local req = {
        path = "/ws",
        headers = {
          upgrade = "websocket",
          connection = "Upgrade",
          ["sec-websocket-key"] = "dGhlIHNhbXBsZSBub25jZQ=="
        }
      }
      
      local received_ws = nil
      server:websocket("/ws", function(ws)
        received_ws = ws
      end)
      
      server:_handle_websocket_upgrade(1, req)
      
      -- Ensure WebSocket was created
      assert.is_not_nil(received_ws)
      
      -- Close the WebSocket
      received_ws:close()
      
      assert.are.equal(2, #test_state.sent_data) -- Handshake + close frame
      
      -- Check close frame (0x88, 0x00)
      local close_frame = test_state.sent_data[2]
      assert.are.equal(string.char(0x88, 0x00), close_frame)
    end)
    
  end)
  
  describe("WebSocket eval functionality simulation", function()
    local server
    local mock_client
    local test_state
    
    before_each(function()
      server = HttpServer:new()
      test_state = { sent_data = {} }
      mock_client = {
        send = function(self, data)
          table.insert(test_state.sent_data, data)
          return true, nil
        end
      }
    end)
    
    it("should simulate WebSocket eval with valid Lua code", function()
      local req = {
        path = "/ws",
        headers = {
          upgrade = "websocket",
          connection = "Upgrade",
          ["sec-websocket-key"] = "dGhlIHNhbXBsZSBub25jZQ=="
        }
      }
      
      local received_ws = nil
      -- Register WebSocket route similar to the actual server
      server:websocket("/ws", function(ws)
        received_ws = ws
        
        -- Send welcome message
        ws:send("Welcome to WebSocket Eval! Send Lua code to execute.")
        
        -- Set up message handler like in the actual server
        ws.onMessage = function(code)
          local function safe_eval()
            local chunk = code
            if not code:match("^%s*(return|local|function|for|while|if|do|repeat|goto|break|::|end)") then
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
          local ok, err = pcall(safe_eval)
          if not ok then
            ws:send(HttpServer.jsonStringify({error = "Internal server error: " .. tostring(err)}))
          end
        end
      end)
      
      server:_handle_websocket_upgrade(1, req)
      
      -- Ensure WebSocket was created
      assert.is_not_nil(received_ws)
      
      -- Simulate receiving a message with Lua code
      received_ws.onMessage("1 + 1")
      
      assert.are.equal(3, #test_state.sent_data) -- Handshake + welcome + result
      
      -- Parse the result message
      local result_frame = test_state.sent_data[3]
      local result_message, _ = HttpServer.parseWebSocketFrame(result_frame)
      assert.is_true(result_message:find('"result":2') ~= nil)
    end)
    
    it("should handle WebSocket eval errors", function()
      local req = {
        path = "/ws",
        headers = {
          upgrade = "websocket",
          connection = "Upgrade",
          ["sec-websocket-key"] = "dGhlIHNhbXBsZSBub25jZQ=="
        }
      }
      
      local received_ws = nil
      server:websocket("/ws", function(ws)
        received_ws = ws
        ws.onMessage = function(code)
          local chunk = code
          if not code:match("^%s*(return|local|function|for|while|if|do|repeat|goto|break|::|end)") then
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
      end)
      
      server:_handle_websocket_upgrade(1, req)
      
      -- Ensure WebSocket was created
      assert.is_not_nil(received_ws)
      
      -- Simulate receiving invalid Lua code
      received_ws.onMessage("invalid syntax here @@#!")
      
      assert.are.equal(2, #test_state.sent_data) -- Handshake + error
      
      -- Parse the error message
      local error_frame = test_state.sent_data[2]
      local error_message, _ = HttpServer.parseWebSocketFrame(error_frame)
      assert.is_true(error_message:find('"error"') ~= nil)
    end)
    
  end)
  
end)