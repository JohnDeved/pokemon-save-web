# mGBA Docker Test Environment

A containerized environment for testing mGBA emulator with Pokémon Emerald ROM and Lua HTTP server automation.

## Quick Start

```bash
# Build and start environment
npm run mgba:docker:build
npm run mgba:docker:start

# Check status
npm run mgba:docker:logs
npm run mgba:docker:status

# Stop environment
npm run mgba:docker:stop
```

## Implementation Options

### 1. Simplified Version (Current - Fast Setup)
- **File**: `Dockerfile` 
- **Purpose**: Demonstrates concept with ROM download and file validation
- **Build time**: ~8 seconds
- **Features**: ROM auto-download, file verification, setup documentation

### 2. Full Implementation (Advanced)
- **File**: `Dockerfile.complex`
- **Purpose**: Complete mGBA build with Lua HTTP server support
- **Build time**: ~5 minutes  
- **Features**: Built-from-source mGBA, Lua scripting, HTTP API endpoints

## Environment Details

**Container**: `mgba-test-environment`  
**Port**: `7102` (HTTP server when using complex version)  
**ROM**: Downloads Pokémon Emerald (16MB) from archive.org automatically  
**Files**: 
- `test_data/emerald.gba` - ROM file (auto-downloaded)
- `test_data/emerald.ss0` - Memory savestate 
- `test_data/mgba_http_server.lua` - HTTP server script

## Management Commands

```bash
npm run mgba:docker:build   # Build container image
npm run mgba:docker:start   # Start container
npm run mgba:docker:stop    # Stop container  
npm run mgba:docker:logs    # View container logs
npm run mgba:docker:status  # Check container status
npm run mgba:docker:clean   # Remove container and image
```

## Testing

Run Docker environment tests:
```bash
npm test docker/mgba-docker-environment.test.ts
```

The test suite validates:
- Container lifecycle management
- ROM download and verification
- File structure setup
- Environment readiness

## Architecture

```
docker/
├── Dockerfile              # Simplified version (current)
├── Dockerfile.complex      # Full mGBA build
├── docker-compose.yml      # Container orchestration
├── docker-mgba.js         # Management script
├── mgba-docker-environment.test.ts  # Test suite
└── README.md              # This file

test_data/
├── emerald.ss0            # Memory savestate
└── mgba_http_server.lua   # HTTP server script
```

## Legal Notes

The ROM file is automatically downloaded from archive.org under fair use for educational/testing purposes. Users should own a legal copy of Pokémon Emerald.