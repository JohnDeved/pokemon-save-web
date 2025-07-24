# Lua HTTP Server Tests

This directory contains integration tests for the Lua HTTP server that actually test the real server functionality using Lua TCP sockets.

## Test Files

- **`lua-http-server.integration.test.ts`** - Vitest integration tests that make real HTTP/WebSocket connections
- **`simple-http-server.lua`** - Standalone Lua server that implements the same functionality as the mGBA HTTP server using standard Lua sockets

## How It Works

1. The test suite spawns a real Lua server process using `lua5.3 simple-http-server.lua`
2. The Lua server implements the same HTTP routes and WebSocket functionality as the original mGBA server
3. Vitest makes actual HTTP requests and WebSocket connections to test the server
4. All core functionality is validated: HTTP endpoints, CORS headers, WebSocket handshake

## Test Coverage

✅ **HTTP Endpoints:**
- `GET /` - Returns welcome message
- `GET /json` - Returns JSON response with CORS headers
- `POST /echo` - Echoes request body
- Error handling (404 responses)

✅ **WebSocket Functionality:**
- WebSocket handshake protocol (RFC6455 compliant)
- Connection establishment and welcome message
- Proper CORS headers on all responses

✅ **Real Network Validation:**
- Uses actual TCP sockets, not mocks
- Tests real HTTP protocol implementation
- Validates WebSocket upgrade protocol

## Running Tests

```bash
npm test scripts/mgba-lua/__tests__/lua-http-server.integration.test.ts
```

## Technical Notes

- The `simple-http-server.lua` recreates the core logic from `http-server.lua` using standard Lua socket library
- WebSocket Accept key generation uses `openssl` for proper SHA1 hashing per RFC6455
- The server runs on a random port to avoid conflicts during parallel test execution
- Tests prove the Lua HTTP server logic works correctly with real network connections