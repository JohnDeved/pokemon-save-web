# mGBA Memory Integration Documentation

This document describes the integration between the Pokémon save parser and mGBA's WebSocket eval API for real-time memory reading and writing.

## Overview

The mGBA integration allows reading and writing Pokémon Emerald save data directly from emulator memory, mirroring the functionality of the existing file-based parser. This enables real-time monitoring and modification of game state while playing.

## Architecture

### Components

1. **MgbaWebSocketClient** (`src/lib/mgba/websocket-client.ts`)
   - WebSocket client for connecting to mGBA's Lua HTTP server
   - Provides basic memory read/write operations
   - Handles connection management and error recovery

2. **Memory Mapping** (`src/lib/mgba/memory-mapping.ts`)
   - Maps save file offsets to memory addresses in mGBA
   - Based on pokeemerald repository structure
   - Provides utilities for address calculation and data layout

3. **EmeraldMemoryParser** (`src/lib/mgba/memory-parser.ts`)
   - Memory-based parser that mirrors the file parser functionality
   - Reads save data structures directly from emulator memory
   - Handles Pokémon data encryption/decryption

4. **Integration Tests** (`src/lib/mgba/__tests__/memory-parser.test.ts`)
   - Compares memory parsing results with file parsing results
   - Validates data accuracy and integrity

## Memory Layout

### GBA Memory Regions

- **EWRAM**: 0x02000000-0x02040000 (256KB) - External Work RAM
- **IWRAM**: 0x03000000-0x03008000 (32KB) - Internal Work RAM  
- **SRAM**: 0x0E000000-0x0E010000 (64KB) - Save RAM

### Save Data Structure

The save data is loaded into EWRAM at runtime. Key addresses:

```typescript
EMERALD_SAVE_LAYOUT = {
  SAVE_DATA_BASE: 0x02025734,    // gSaveBlock1Ptr location
  PLAYER_NAME: 0x00,             // Player name (8 bytes)
  PLAY_TIME_HOURS: 0x0E,         // Play time hours (u16)
  PLAY_TIME_MINUTES: 0x10,       // Play time minutes (u8)
  PARTY_COUNT: 0x234,            // Number of party Pokémon (u32)
  PARTY_POKEMON: 0x238,          // Party Pokémon array
}
```

### Pokémon Data Structure

Each Pokémon is 100 bytes (0x64) with the following layout:

```typescript
POKEMON_STRUCT = {
  PERSONALITY: 0x00,    // u32 - Personality value
  OT_ID: 0x04,         // u32 - Original Trainer ID
  NICKNAME: 0x08,      // 10 bytes - Nickname
  OT_NAME: 0x14,       // 7 bytes - OT name
  DATA: 0x20,          // 48 bytes - Encrypted data
  LEVEL: 0x54,         // u8 - Current level
  CURRENT_HP: 0x56,    // u16 - Current HP
  MAX_HP: 0x58,        // u16 - Maximum HP
  // ... stats continue
}
```

## Data Encryption

Pokémon data is encrypted using XOR encryption with the key derived from:
```
key = personality_value ^ original_trainer_id
```

The encrypted data contains 4 substructures (12 bytes each) in an order determined by the personality value:
- Growth (species, item, experience, friendship)
- Attacks (moves and PP)
- EVs and Condition (effort values, contest stats)
- Miscellaneous (IVs, ribbons, met data)

## Usage

### Setting Up the Environment

1. Start the mGBA Docker container:
```bash
npm run mgba:start
```

2. Wait for the container to load Pokémon Emerald and the save state.

3. The HTTP server will be available on `http://localhost:7102`
4. The WebSocket eval API will be available at `ws://localhost:7102/ws`

### Using the Memory Parser

```typescript
import { MgbaWebSocketClient } from './lib/mgba/websocket-client'
import { EmeraldMemoryParser } from './lib/mgba/memory-parser'

// Connect to mGBA
const client = new MgbaWebSocketClient()
await client.connect()

// Parse save data from memory
const parser = new EmeraldMemoryParser(client)
const saveData = await parser.parseFromMemory()

console.log('Player name:', saveData.player_name)
console.log('Party Pokémon:', saveData.party_pokemon.length)

// Clean up
client.disconnect()
```

### Testing Memory vs File Parsing

Use the CLI tool to compare results:

```bash
npm run mgba:start  # Start mGBA container
npx tsx src/lib/mgba/test-cli.ts
```

Or run the integration tests:

```bash
npm run mgba:start  # Start mGBA container
npm test src/lib/mgba/__tests__/memory-parser.test.ts
```

## pokeemerald Reference

This implementation is based on the pokeemerald repository structure:
- https://github.com/pret/pokeemerald
- `include/global.h` - Save data structures
- `include/pokemon.h` - Pokémon data structures  
- `src/pokemon.c` - Pokémon data handling
- `src/load_save.c` - Save data loading

Key reference files:
- Save data layout: `include/global.h` (struct SaveBlock1)
- Pokémon structure: `include/pokemon.h` (struct Pokemon)
- Data encryption: `src/pokemon.c` (DecryptBoxPokemon, GetMonData)

## Memory Address Discovery

Memory addresses can be discovered by:

1. **Static Analysis**: Examining pokeemerald source code and symbol files
2. **Runtime Inspection**: Using mGBA's memory viewer and Lua scripts
3. **Pattern Matching**: Searching for known values in memory

Example Lua script for finding save data:
```lua
-- Search for player name in memory
local playerName = "BRENDAN" -- Known player name
for addr = 0x02000000, 0x02040000, 4 do
    local found = true
    for i = 1, #playerName do
        local char = emu:read8(addr + i - 1)
        if char ~= playerName:byte(i) then
            found = false
            break
        end
    end
    if found then
        console:log("Found player name at: " .. string.format("0x%08X", addr))
    end
end
```

## Error Handling

The memory parser includes several error handling mechanisms:

1. **Connection Recovery**: Automatic reconnection on WebSocket failures
2. **Validation**: Data integrity checks and range validation
3. **Fallback**: Graceful degradation when memory access fails
4. **Timeout Protection**: Request timeouts to prevent hanging

## Limitations

1. **Save State Dependency**: Requires specific save state to be loaded
2. **Address Hardcoding**: Memory addresses may vary between ROM versions
3. **Timing Sensitivity**: Memory content may change during active gameplay
4. **Encryption Complexity**: Requires understanding of Pokémon data encryption

## Future Enhancements

1. **Dynamic Address Discovery**: Runtime detection of save data locations
2. **Multi-Version Support**: Support for different Emerald ROM versions
3. **Real-time Monitoring**: Live updates as game state changes
4. **Write Operations**: Memory modification capabilities
5. **Box Pokémon**: Support for PC storage system
6. **Other Save Blocks**: Additional save data beyond party Pokémon

## Troubleshooting

### Connection Issues
- Ensure mGBA Docker container is running: `docker ps`
- Check HTTP server: `curl http://localhost:7102/`
- Verify WebSocket: Use browser dev tools to test `ws://localhost:7102/ws`

### Data Mismatches
- Verify save state matches save file
- Check memory addresses against pokeemerald source
- Enable debug logging for detailed comparison
- Test with known good save data

### Performance Issues
- Reduce parallel memory reads
- Use batch operations for large data
- Implement caching for frequently accessed data
- Optimize WebSocket message handling