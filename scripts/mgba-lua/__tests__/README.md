# mGBA Core Testing Approach

This directory contains a simplified approach for testing the mGBA Lua HTTP server using actual mGBA-compatible APIs instead of complex mocking.

## Approach

The `mgba-runner.lua` script provides a minimal mGBA API compatibility layer that:

1. **Runs the actual http-server.lua code** - No modifications needed to the original script
2. **Provides mGBA API compatibility** - Implements console, emu, callbacks, and socket APIs
3. **Uses real TCP sockets** - Leverages lua-socket for actual network functionality  
4. **Simulates ROM environment** - Triggers the necessary callbacks to start the server

## Benefits over Complex Mocking

- **Much simpler**: ~150 lines vs 400+ lines of complex mocking
- **Tests real code**: Runs the actual http-server.lua without modifications
- **Better maintainability**: Clear separation of concerns
- **Easier debugging**: Direct Lua execution with real networking

## Usage

```bash
# Start the mGBA-compatible runner on a test port
lua5.3 mgba-runner.lua 7400

# Run integration tests
npx vitest run mgba-runner.integration.test.ts
```

## Current Status

- ✅ Server initialization working
- ✅ ROM simulation implemented  
- ✅ Callback system functional
- ⚠️ Socket API needs refinement for HTTP request handling
- ⚠️ Full HTTP/WebSocket integration still in progress

This approach addresses the user feedback about complex mocking and provides a foundation for testing with actual mGBA-like APIs.