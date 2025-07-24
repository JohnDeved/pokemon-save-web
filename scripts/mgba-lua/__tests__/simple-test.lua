-- Simple isolated test
local busted = require('busted')

-- Minimal setup
local mock_console = {
  log = function(msg) end,
  error = function(msg) end
}
_G.console = mock_console

-- Load HttpServer
local file_content = io.open("../http-server.lua", "r"):read("*all")
local class_start, class_end = file_content:find("local HttpServer = {}.-%-%- Example Usage")
local class_definition = file_content:sub(class_start, class_end)
class_definition = class_definition:gsub("local HttpServer", "_G.HttpServer")
load(class_definition)()

local HttpServer = _G.HttpServer

describe("Simple HttpServer test", function()
  
  it("should send text response correctly", function()
    local test_state = { sent_data = nil }
    local mock_client = {
      send = function(self, data)
        test_state.sent_data = data
        return true, nil
      end
    }
    
    local server = HttpServer:new()
    local res = server:_create_response(mock_client, 1)
    res:send("200 OK", "Hello World", "text/plain")
    
    assert.is_true(res.finished)
    assert.is_string(test_state.sent_data)
    
    local find_result = test_state.sent_data:find("HTTP/1.1 200 OK")
    assert.is_not_nil(find_result)
    assert.are.equal(1, find_result)
  end)
  
end)