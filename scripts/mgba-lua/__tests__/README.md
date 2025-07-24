# mGBA Lua HTTP Server Tests

This directory contains integration tests for the mGBA Lua HTTP server located at `../http-server.lua`.

## 🎯 Overview

The test suite uses a **simplified virtual mGBA environment** approach that:
- Tests the actual `http-server.lua` code without modifications
- Uses lightweight mocks for mGBA APIs (233 lines vs previous 436 lines)
- Provides real TCP socket connections for realistic HTTP/WebSocket testing
- Shows actual console output: `🚀 mGBA HTTP Server started on port ...`

## 📁 Files

- **`lua-http-server.integration.test.ts`** - Vitest integration tests that make real HTTP/WebSocket connections
- **`mgba-env-mock.lua`** - Simplified mGBA API mock environment (233 lines)
- **`MGBA_CORE_SPECULATION.md`** - Analysis of using actual mGBA core vs mocks

## 🧪 Test Coverage

**HTTP Endpoints:**
- ✅ `GET /` - Welcome message  
- ✅ `GET /json` - JSON response with CORS headers
- ✅ `POST /echo` - Echo request body
- ✅ `GET /unknown` - 404 handling
- ✅ CORS header validation

**WebSocket:**
- ✅ Handshake protocol
- ✅ Welcome message handling
- ✅ Connection lifecycle

## 🚀 Usage

Run the test suite:
```bash
npm test scripts/mgba-lua/__tests__/lua-http-server.integration.test.ts
```

Test manually with the mock environment:
```bash
cd scripts/mgba-lua/__tests__
lua5.3 mgba-env-mock.lua 7999
```

## 📊 Benefits of Simplified Approach

- **47% code reduction** - From 436 to 233 lines  
- **Proper console logging** - Shows actual server startup messages
- **Faster execution** - Tests run in ~2 seconds
- **Better reliability** - Simplified event loop with better HTTP request handling
- **Easy maintenance** - Clean, focused mock implementation

## 🔄 GitHub Action

Automated tests run via `.github/workflows/lua-tests.yml`:
- Manual trigger capability
- Auto-trigger on Lua file changes in PRs
- Cached dependencies for faster execution  
- Smoke tests + full integration test suite