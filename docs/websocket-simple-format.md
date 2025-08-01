# Simple WebSocket Message Format

This document describes the new simple message format for WebSocket communication with the mGBA Lua HTTP server.

## Overview

The simple message format uses newlines to separate commands and data, making it easier to parse and construct messages compared to JSON.

## Message Format

```
command
data_line_1
data_line_2
...
```

Where:
- `command` is either `watch` or `eval`
- Data lines contain command-specific information

## Watch Command

### Client to Server

```
watch
address1,size1
address2,size2
...
```

**Example:**
```
watch
132145,8
154311,600
```

This tells the server to watch memory regions at:
- Address 132145, size 8 bytes
- Address 154311, size 600 bytes

### Server Response

The server responds with a simple text confirmation:
```
Memory watching started for N regions
```

## Eval Command

### Client to Server

```
eval
lua_code_line_1
lua_code_line_2
...
```

**Examples:**

Simple expression:
```
eval
1+1
```

Multi-line code:
```
eval
local test = 1
return test
```

Complex code:
```
eval
local party_count = emu:read8(0x20244e9)
return party_count
```

### Server Response

The server responds with JSON format for compatibility:
```json
{"result": 2}
```

Or for errors:
```json
{"error": "error message"}
```

## Backward Compatibility

The implementation maintains full backward compatibility:

1. **JSON format still supported**: Existing JSON messages continue to work
2. **Legacy eval**: Raw Lua code (without `eval` prefix) still works
3. **Existing APIs unchanged**: All existing client methods work as before

## Implementation Examples

### TypeScript Client

```typescript
import { MgbaWebSocketClient } from './mgba'

const client = new MgbaWebSocketClient()
await client.connect()

// Watch memory regions using simple format
await client.startWatching([
  { address: 132145, size: 8 },
  { address: 154311, size: 600 }
])

// Eval using simple format (default)
const result = await client.eval('1+1')

// Eval using legacy format
const result2 = await client.eval('1+1', false)
```

### CLI Usage

The CLI automatically uses the new format when connecting via WebSocket:

```bash
# Connect and watch memory in real-time
npx tsx src/lib/parser/cli.ts --websocket --watch

# Connect and run a single evaluation
npx tsx src/lib/parser/cli.ts --websocket
```

## Message Parsing

### Client Side

The client can parse both formats:

```typescript
// Simple format
const message = 'watch\n132145,8\n154311,600'
const parsed = parseSimpleMessage(message)
// Result: { command: 'watch', data: ['132145,8', '154311,600'] }

// JSON format (backward compatibility)
const jsonMessage = '{"type": "memoryUpdate", "regions": [...], "timestamp": 123}'
// Handled by existing JSON parser
```

### Server Side (Lua)

The Lua server handles both formats automatically:

```lua
-- Simple format detection
local simpleMessage = parseSimpleMessage(message)
if simpleMessage then
    if simpleMessage.command == "watch" then
        local regions = parseWatchRegions(simpleMessage.data)
        -- Set up memory watching
    elseif simpleMessage.command == "eval" then
        local code = table.concat(simpleMessage.data, "\n")
        -- Execute Lua code
    end
else
    -- Fall back to JSON/legacy format
end
```

## Benefits

1. **Simpler parsing**: No need for JSON parsing libraries
2. **Easier debugging**: Human-readable message format
3. **Reduced conflicts**: Clear command separation prevents eval/watch confusion
4. **Bandwidth efficient**: Smaller message size compared to JSON
5. **Backward compatible**: Existing code continues to work

## Migration Guide

### For New Code

Use the simple format by default:

```typescript
// Preferred - uses simple format
await client.eval('emu:read8(0x20244e9)')
await client.startWatching(regions)
```

### For Existing Code

No changes needed - existing code continues to work:

```typescript
// Still works - uses legacy format
await client.eval('emu:read8(0x20244e9)', false)
```

### Server-Side

The Lua server automatically detects and handles both formats, no changes required.