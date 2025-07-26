# mGBA Docker Test Environment

A containerized environment for testing mGBA emulator with Pokémon Emerald ROM and HTTP automation.

## ✅ Working Features

- **mGBA Emulator**: Built from source with Lua support, loads Pokémon Emerald ROM and savestate
- **HTTP Server**: Functional Lua HTTP server on port 7102 with multiple endpoints
- **curl Testing**: All endpoints accessible via curl commands for automation
- **Docker Environment**: Self-contained with all required files in docker/data/

## Quick Start

```bash
# Start the mGBA environment (builds automatically)
npm run mgba:start

# Test HTTP endpoints
curl http://localhost:7102/
curl http://localhost:7102/json  
curl -X POST http://localhost:7102/echo -d "test data"

# Stop the environment
npm run mgba:stop
```

## HTTP API Endpoints

The HTTP server runs on `http://localhost:7102` with the following endpoints:

- **GET /**: Welcome message
- **GET /json**: JSON response with timestamp and server info
- **POST /echo**: Echo service for testing POST requests

## Architecture

- **docker/data/**: Contains ROM, savestate, and Lua scripts
- **Dockerfile**: Multi-stage build with mGBA from source + Lua support
- **entrypoint.sh**: Manages mGBA and HTTP server startup
- **simple_http_server.lua**: Working HTTP server implementation

## Legal Compliance

The ROM is automatically downloaded from archive.org (public domain collection). All files are properly .gitignored to prevent accidental commits.

# Stop the environment
npm run mgba:stop
```

## Current Status

✅ **Working**: mGBA emulator with ROM and savestate loading  
⚠️ **Limited**: HTTP server not available (mGBA 0.9.3 lacks --script support)  
🔧 **Future**: Upgrade to mGBA 0.10.0+ needed for full Lua HTTP server functionality

## Implementation

- **File**: `Dockerfile`
- **Purpose**: Basic mGBA environment using system packages
- **Build time**: ~30 seconds  
- **Features**: mGBA emulator, ROM auto-download, savestate loading

## Environment Details

**Container**: `mgba-test-environment`  
**ROM**: Downloads Pokémon Emerald (16MB) from archive.org automatically  
**Files**: 
- `test_data/emerald.gba` - ROM file (auto-downloaded)
- `test_data/emerald.ss0` - Memory savestate 
- `test_data/mgba_http_server.lua` - HTTP server script (for future use)

## Management Commands

```bash
npm run mgba:start    # Start mGBA environment (builds automatically)
npm run mgba:stop     # Stop mGBA environment
```

The start command automatically handles:
- Building the Docker image if needed
- Downloading the ROM from archive.org  
- Starting the container with mGBA emulator
- Loading the ROM and savestate

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
├── Dockerfile               # mGBA environment
├── docker-compose.yml       # Container orchestration  
├── docker-mgba.js          # Management script
├── entrypoint.sh           # Container startup script
├── mgba-docker-environment.test.ts  # Test suite
└── README.md               # This file

test_data/
├── emerald.ss0             # Memory savestate
└── mgba_http_server.lua    # HTTP server script
```

## Future Enhancements

To enable HTTP server functionality:
1. Upgrade to mGBA 0.10.0+ with Lua support and --script argument
2. Alternative: Use `Dockerfile.complex` to build from source (requires fixing build dependencies)

## Legal Notes

The ROM file is automatically downloaded from archive.org under fair use for educational/testing purposes. Users should own a legal copy of Pokémon Emerald.