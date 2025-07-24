-- Focused test suite for the Lua HTTP server in scripts/mgba-lua/http-server.lua
-- Tests only HTTP route APIs and WebSocket functionality
-- Includes mocks for mGBA-specific APIs to run standalone

local busted = require('busted')

-- Mock mGBA APIs
_G.console = {
  log = function(msg) end,
  error = function(msg) end
}

_G.socket = {
  ERRORS = {
    AGAIN = "EAGAIN",
    ADDRESS_IN_USE = "EADDRINUSE"
  },
  bind = function(host, port)
    local server = {
      listen = function() return true, nil end,
      close = function() return true end,
      accept = function()
        return {
          receive = function(size) return nil, _G.socket.ERRORS.AGAIN end,
          send = function(data) return true, nil end,
          close = function() return true end,
          settimeout = function() end
        }, nil
      end,
      settimeout = function() end
    }
    return server, nil
  end
}

_G.emu = {
  framecount = function() return 1000 end
}

_G.callbacks = {}

-- Fixed timestamp for consistent tests
os.time = function() return 1609459200 end

-- Load the HTTP server module
local HttpServer = require('../http-server')

describe("HTTP Route APIs", function()
  
  it("should handle GET / route", function()
    local server = HttpServer:new()
    local sent_data = nil
    local mock_client = {
      send = function(client, data)
        sent_data = data
        return true, nil
      end
    }
    
    -- Register the default route like in the actual server
    server:get("/", function(req, res)
      res:send("200 OK", "Welcome to mGBA HTTP Server!")
    end)
    
    local res = server:_create_response(mock_client, 1)
    local req = {method = "GET", path = "/", headers = {}, body = ""}
    
    server:_handle_request("GET", "/", req, res)
    
    assert.is_true(res.finished)
    assert.is_not_nil(sent_data)
    assert.is_not_nil(sent_data:find("Welcome to mGBA HTTP Server!"))
  end)
  
  it("should handle GET /json route with CORS", function()
    local server = HttpServer:new()
    local sent_data = nil
    local mock_client = {
      send = function(client, data)
        sent_data = data
        return true, nil
      end
    }
    
    -- Register the JSON route with CORS like in the actual server
    server:get("/json", HttpServer.cors(), function(req, res)
      res:send("200 OK", {message = "Hello, JSON!", timestamp = os.time()})
    end)
    
    local res = server:_create_response(mock_client, 1)
    local req = {method = "GET", path = "/json", headers = {}, body = ""}
    
    server:_handle_request("GET", "/json", req, res)
    
    assert.is_true(res.finished)
    assert.is_not_nil(sent_data)
    assert.is_not_nil(sent_data:find("Access-Control-Allow-Origin: *"))
    assert.is_not_nil(sent_data:find("Content-Type: application/json"))
    assert.is_not_nil(sent_data:find('"message":"Hello, JSON!"'))
  end)
  
  it("should handle POST /echo route", function()
    local server = HttpServer:new()
    local sent_data = nil
    local mock_client = {
      send = function(client, data)
        sent_data = data
        return true, nil
      end
    }
    
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
    assert.is_not_nil(sent_data)
    assert.is_not_nil(sent_data:find('Content-Type: application/json'))
    assert.is_not_nil(sent_data:find('{"test": "data"}'))
  end)

end)

describe("WebSocket Functionality", function()
  
  it("should handle WebSocket handshake", function()
    local server = HttpServer:new()
    local sent_data = {}
    local mock_client = {
      send = function(client, data)
        table.insert(sent_data, data)
        return true, nil
      end
    }
    
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
    server:websocket("/ws", function(ws)
      ws_connected = true
      assert.are.equal("/ws", ws.path)
      assert.are.equal(mock_client, ws.client)
      assert.is_function(ws.send)
      assert.is_function(ws.close)
    end)
    
    server:_handle_websocket_upgrade(1, req)
    
    assert.is_true(ws_connected)
    assert.is_table(server.websockets[1])
    
    -- Check handshake response
    assert.are.equal(1, #sent_data)
    local handshake_response = sent_data[1]
    assert.is_not_nil(handshake_response:find("HTTP/1.1 101 Switching Protocols"))
    assert.is_not_nil(handshake_response:find("Upgrade: websocket"))
    assert.is_not_nil(handshake_response:find("Connection: Upgrade"))
  end)
  
  it("should handle WebSocket message sending", function()
    local server = HttpServer:new()
    local sent_data = {}
    local mock_client = {
      send = function(client, data)
        table.insert(sent_data, data)
        return true, nil
      end
    }
    
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
    
    assert.are.equal(2, #sent_data) -- Handshake + message
    
    -- Check that a WebSocket frame was sent
    local frame = sent_data[2]
    assert.is_not_nil(frame)
    assert.is_string(frame)
  end)

  it("should handle WebSocket eval functionality", function()
    local server = HttpServer:new()
    local sent_data = {}
    local mock_client = {
      send = function(client, data)
        table.insert(sent_data, data)
        return true, nil
      end
    }
    
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
      
      -- Set up onMessage handler for eval functionality
      ws.onMessage = function(data)
        -- Simulate eval of Lua code
        local success, result = pcall(function()
          return load(data)()
        end)
        
        if success then
          ws:send("Result: " .. tostring(result))
        else
          ws:send("Error: " .. tostring(result))
        end
      end
    end)
    
    server:_handle_websocket_upgrade(1, req)
    
    -- Ensure WebSocket was created
    assert.is_not_nil(received_ws)
    assert.is_function(received_ws.onMessage)
    
    -- Test eval functionality
    received_ws.onMessage("return 2 + 2")
    
    -- Should have handshake + eval result
    assert.are.equal(2, #sent_data)
    local eval_response = sent_data[2]
    assert.is_not_nil(eval_response)
    assert.is_string(eval_response)
  end)

end)