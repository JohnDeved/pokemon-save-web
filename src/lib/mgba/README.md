# mGBA Integration Module

This module provides WebSocket-based memory access to the mGBA emulator with push-based real-time updates.

## Features

### 🚀 Push-based Memory Updates
Instead of constantly polling memory, the server watches specific regions and pushes updates only when they change.

### ⚡ Intelligent Caching
Watched regions use cached data with much longer timeouts, dramatically reducing network calls.

### 🔄 Real-time Notifications
React to memory changes as they happen in the emulator through event listeners.

### 🔧 Backward Compatibility
All existing eval-based functionality remains unchanged for existing code.

## Quick Start

### 1. Basic Connection and Memory Reading

```typescript
import { MgbaWebSocketClient } from './websocket-client'

// Client automatically connects to both /eval and /watch endpoints
const client = new MgbaWebSocketClient()
await client.connect()

// Read memory the traditional way (uses /eval endpoint)
const partyCount = await client.readByte(0x20244e9)
const partyData = await client.readBytes(0x20244ec, 600)
```

### 2. Push-based Memory Watching

```typescript
// Configure regions to watch
client.configureSharedBuffer({
  preloadRegions: [
    { address: 0x20244e9, size: 7 },   // Party count + context
    { address: 0x20244ec, size: 600 }  // Full party data
  ]
})

// Start watching for changes (uses /watch endpoint)
await client.startWatchingPreloadRegions()

// Add listener for real-time updates
client.addMemoryChangeListener((address, size, data) => {
  console.log(`Memory updated at 0x${address.toString(16)}`)
  // React to changes immediately
})

// Now getSharedBuffer will use cached data from push updates
const cachedData = await client.getSharedBuffer(0x20244e9, 7)
```

### 3. Custom Memory Regions

```typescript
// Watch custom regions
const customRegions = [
  { address: 0x2000000, size: 100 },
  { address: 0x3000000, size: 50 }
]

await client.startWatching(customRegions)
```

## API Reference

### Memory Watching

- `startWatching(regions)` - Start watching specific memory regions
- `startWatchingPreloadRegions()` - Start watching configured preload regions
- `stopWatching()` - Stop watching all regions
- `isWatchingMemory()` - Check if currently watching
- `getWatchedRegions()` - Get list of watched regions

### Memory Change Listeners

- `addMemoryChangeListener(listener)` - Add callback for memory changes
- `removeMemoryChangeListener(listener)` - Remove callback

### Configuration

- `configureSharedBuffer(config)` - Configure preload regions and cache settings

### Cache Management

- `getSharedBuffer(address, size)` - Get data with intelligent caching

## Server-side Setup

The Lua HTTP server (`scripts/mgba-lua/http-server.lua`) automatically supports memory watching when you load it in mGBA. It provides two separate WebSocket endpoints:

1. **`/eval`** - For Lua code execution and traditional memory operations
2. **`/watch`** - For memory region watching and push-based updates

The system will:
1. Accept WebSocket connections on both endpoints
2. Handle eval requests on `/eval` endpoint  
3. Listen for `watch` messages on `/watch` endpoint with memory region lists
4. Monitor those regions on each emulation frame
5. Send `memoryUpdate` messages when regions change

### Server Message Types

#### Watch Request (Client → Server)
```json
{
  "type": "watch",
  "regions": [
    {"address": 541057257, "size": 7},
    {"address": 541057260, "size": 600}
  ]
}
```

#### Memory Update (Server → Client)
```json
{
  "type": "memoryUpdate",
  "regions": [
    {
      "address": 541057257,
      "size": 7,
      "data": [6, 0, 0, 0, 0, 0, 0]
    }
  ],
  "timestamp": 1640995200
}
```

#### Watch Confirmation (Server → Client)
```json
{
  "type": "watchConfirm",
  "message": "Watching 2 memory regions"
}
```

## Performance Benefits

### Before (Polling-based)
- Constant network requests every ~100ms
- High CPU usage from frequent memory reads
- Potential for missed changes between polls
- Network overhead even when nothing changes

### After (Push-based)
- Network requests only when memory actually changes
- Minimal CPU overhead - frame callback does lightweight checks
- Immediate notification of changes
- Cached data for watched regions reduces redundant reads

## Error Handling

The system gracefully handles:
- WebSocket disconnections (stops watching automatically)
- Invalid memory regions (logs warnings)
- Parse errors in messages (ignored, maintains connection)
- Listener exceptions (logged, other listeners continue)

## Backward Compatibility

All existing functionality remains unchanged:
- `eval()` method for custom Lua execution
- Direct memory read/write methods
- Shared buffer caching system
- Connection management

The memory watching is an optional enhancement that can be enabled when needed.

## Example: Real-time Party Monitor

```typescript
import { MgbaWebSocketClient } from './websocket-client'

class PartyMonitor {
  private client: MgbaWebSocketClient

  constructor() {
    this.client = new MgbaWebSocketClient()
  }

  async start() {
    await this.client.connect()
    
    // Configure for Pokémon Emerald party data
    this.client.configureSharedBuffer({
      preloadRegions: [
        { address: 0x20244e9, size: 7 },   // Party count + context
        { address: 0x20244ec, size: 600 }  // Full party data (6 * 100 bytes)
      ]
    })

    // Start watching
    await this.client.startWatchingPreloadRegions()

    // Listen for changes
    this.client.addMemoryChangeListener((address, size, data) => {
      if (address === 0x20244e9) {
        const partyCount = data[0]
        console.log(`Party size changed: ${partyCount} Pokémon`)
      } else if (address === 0x20244ec) {
        console.log('Party data updated')
        this.parsePartyData(data)
      }
    })

    console.log('🔍 Party monitor started - watching for changes...')
  }

  private parsePartyData(data: Uint8Array) {
    // Parse party Pokémon data...
    console.log('Processing updated party data...')
  }
}

// Usage
const monitor = new PartyMonitor()
await monitor.start()
```

This provides real-time monitoring of party changes with minimal performance impact!