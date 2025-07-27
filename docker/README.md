# mGBA Docker Environment

A complete Docker environment for running mGBA emulator with Lua HTTP server automation, enabling cross-platform testing against a real emulator.

## Overview

This Docker environment provides:
- **Real mGBA Emulator**: Uses prebuilt mGBA binary with Qt frontend and Lua 5.4 support
- **HTTP Server Automation**: Lua script runs within mGBA providing REST API
- **Cross-Platform**: Works on Windows, macOS, Linux via Docker
- **Automatic ROM Setup**: Downloads Pokémon Emerald ROM automatically
- **Headless Operation**: Uses xvfb for display-less operation
- **Fast Deployment**: No compilation required, uses prebuilt binaries for speed

## Quick Start

**Prerequisites:**
- Place a prebuilt `mgba-qt` binary in `docker/data/mgba-qt`
- The binary should be built with `--script` support and Lua enabled
- See `docker/BUILD_MGBA.md` for build instructions

```bash
# Start the mGBA environment (builds automatically)
npm run mgba:start

# Test HTTP endpoints
curl http://localhost:7102/
curl http://localhost:7102/json

# Stop the environment
npm run mgba:stop
```

## Features

### HTTP API Endpoints

The mGBA Lua HTTP server provides these endpoints at `http://localhost:7102`:

- **GET /** - Welcome message
- **GET /json** - JSON API with timestamp and CORS headers
- **POST /echo** - Echo service for testing
- **WebSocket /ws** - Real-time Lua code evaluation (with emulator context)

### CORS Support

All endpoints include proper CORS headers for web integration:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type`

## Technical Implementation

### Build Configuration

The Docker environment uses a prebuilt mGBA binary for fast deployment. The binary should be built with these configuration flags:

```bash
cmake -B build \
    -DBUILD_QT=ON \
    -DBUILD_SDL=OFF \
    -DUSE_LUA=ON \
    -DCMAKE_BUILD_TYPE=Release \
    -DUSE_FFMPEG=OFF \
    -DUSE_MINIZIP=OFF \
    -DUSE_LIBZIP=OFF \
    -DUSE_DISCORD_RPC=OFF
```

**Prebuilt Binary Setup:**
1. Place the prebuilt `mgba-qt` binary in `docker/data/mgba-qt`
2. Ensure the binary has `--script` argument support for Lua automation
3. Include any required shared libraries in `docker/data/` if needed

> **⚠️ Important**: The Docker environment now uses prebuilt binaries for speed and reliability. You must provide a compatible `mgba-qt` binary built with the configuration flags shown above.

### Runtime Environment

- **Base Image**: Ubuntu 22.04
- **mGBA Version**: Prebuilt binary with Qt + Lua support  
- **Lua Version**: 5.4.6
- **ROM**: Pokémon Emerald (USA, Europe) - 16MB
- **Savestate**: Pre-configured game state
- **Display**: Headless via xvfb-run
- **Deployment**: Fast startup using prebuilt binaries

### File Structure

```
docker/
├── Dockerfile               # Source build approach (for reference)
├── Dockerfile.prebuilt      # Fast deployment using prebuilt mGBA binary (ACTIVE)
├── docker-compose.yml       # Service configuration (uses prebuilt)
├── entrypoint.sh            # Container startup script
├── data/
│   ├── mgba-qt              # Prebuilt mGBA binary (user provided)
│   ├── emerald.ss0          # Pokémon Emerald savestate
│   └── emerald.sav          # Save file
└── __tests__/
    └── docker-environment.test.cjs  # Test suite
```

## Testing

The environment includes automated tests to verify functionality:

```bash
# Run comprehensive test suite
node docker/__tests__/docker-environment.test.cjs
```

Tests verify:
- HTTP server responsiveness
- Endpoint functionality (GET, POST, 404 handling)
- CORS headers
- JSON API responses
- Echo service

## Development

### Building Manually

```bash
# Build the Docker image
docker compose -f docker/docker-compose.yml build

# Start container
docker compose -f docker/docker-compose.yml up -d

# Check logs
docker compose -f docker/docker-compose.yml logs -f
```

### Debugging

```bash
# Access container shell
docker exec -it mgba-test-environment bash

# Check mGBA process
ps aux | grep mgba

# Test HTTP server manually
curl http://localhost:7102/
```

## Comparison with Native Environment

| Feature | Docker (Prebuilt) | Docker (Source Build) | Native |
|---------|-------|------------|--------|
| Build Time | ~10 seconds | ~4-5 minutes | ~3-4 minutes |
| Dependencies | Runtime only | Full build chain | Manual setup |
| Performance | Near-native | Near-native | Native |
| Portability | Cross-platform | Cross-platform | Linux only |
| Isolation | Complete | Complete | Shared system |
| Setup | Automated | Automated | Manual |
| Memory Usage | Low | High (build) | Medium |
| Binary Maintenance | Manual | Automated | Manual |
| **Current Default** | **✅ YES** | No | No |

## Use Cases

1. **Cross-Platform Development**: Same environment on Windows/macOS/Linux
2. **CI/CD Integration**: Automated testing in GitHub Actions
3. **Team Collaboration**: Consistent development environment
4. **Production Deployment**: Containerized emulator services
5. **Testing Automation**: Reliable, reproducible test environment

## System Requirements

- Docker and Docker Compose
- 4GB+ RAM (for compilation)
- 2GB+ disk space
- Internet connection (for ROM download)

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Host System   │    │  Docker Container │    │  mGBA Process   │
│                 │    │                   │    │                 │
│  npm run        │───▶│  entrypoint.sh    │───▶│  mgba-qt        │
│  mgba:start     │    │                   │    │  --script       │
│                 │    │  Port 7102        │    │  http-server.lua│
│                 │    │                   │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                │                        ▼
                                │                ┌─────────────────┐
                                │                │ HTTP Server API │
                                │                │ Socket API      │
                                │                │ Lua Environment │
                                │                └─────────────────┘
                                │
                                ▼
                        ┌──────────────────┐
                        │ Host Port 7102   │
                        │ curl/browser     │
                        │ access           │
                        └──────────────────┘
```

## Success Criteria

✅ **mGBA builds successfully** with Qt frontend and Lua support  
✅ **HTTP server responds** on port 7102  
✅ **ROM loads automatically** from archive.org  
✅ **Lua script executes** within mGBA environment  
✅ **API endpoints work** (GET, POST, WebSocket)  
✅ **CORS headers present** for web integration  
✅ **Cross-platform compatibility** via Docker  
✅ **Automated testing** validates functionality  

The Docker environment successfully replicates the working native mGBA setup, providing a reliable, cross-platform solution for automated testing against real emulator functionality.