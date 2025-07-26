# mGBA Docker Test Environment

A containerized environment for testing mGBA emulator with Pokémon Emerald ROM and Lua HTTP server automation.

## Quick Start

```bash
# Start the mGBA environment (builds automatically)
npm run mgba:start

# Stop the environment
npm run mgba:stop
```

## Implementation

- **File**: `Dockerfile`
- **Purpose**: Complete mGBA build with Lua HTTP server support
- **Build time**: ~5 minutes  
- **Features**: Built-from-source mGBA, Lua scripting, HTTP API endpoints, ROM auto-download

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
npm run mgba:start    # Start mGBA environment (builds automatically)
npm run mgba:stop     # Stop mGBA environment
```

The start command automatically handles:
- Building the Docker image if needed
- Downloading the ROM from archive.org  
- Starting the container with all services
- Setting up the HTTP server on port 7102

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
├── Dockerfile               # Complete mGBA environment
├── docker-compose.yml       # Container orchestration
├── docker-mgba.js          # Management script
├── mgba-docker-environment.test.ts  # Test suite
└── README.md               # This file

test_data/
├── emerald.ss0             # Memory savestate
└── mgba_http_server.lua    # HTTP server script
```

## Legal Notes

The ROM file is automatically downloaded from archive.org under fair use for educational/testing purposes. Users should own a legal copy of Pokémon Emerald.