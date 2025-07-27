# mGBA Docker Environment

A complete Docker environment for running mGBA emulator with Lua HTTP server automation, enabling cross-platform testing against a real emulator.

## Overview

This Docker environment provides:
- **Real mGBA Emulator**: Automatically downloads or builds mGBA with Qt frontend and Lua 5.4 support
- **HTTP Server Automation**: Lua script runs within mGBA providing REST API
- **Cross-Platform**: Works on Windows, macOS, Linux via Docker
- **Automatic ROM Setup**: Downloads Pokémon Emerald ROM automatically
- **Headless Operation**: Uses xvfb for display-less operation
- **Smart Binary Management**: Downloads prebuilt binary or falls back to source compilation
- **Zero Setup**: No manual binary preparation required

## Quick Start

**No prerequisites needed** - the environment automatically handles everything:

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

### Automatic Binary Management

The Docker environment intelligently handles mGBA binary setup:

1. **Prebuilt Download**: First attempts to download from GitHub releases
2. **Verification**: Checks if binary has required `--script` support  
3. **Source Fallback**: If download fails, automatically builds from source
4. **Always Works**: Guarantees working mGBA installation regardless of network/availability

**Download Configuration:**
- Primary source: `https://github.com/JohnDeved/pokemon-save-web/releases/download/mgba-prebuilt/mgba-qt-linux-x64`
- Fallback: Source compilation with verified cmake configuration
- Zero manual setup required

### Build Configuration

When building from source (fallback scenario), uses these configuration flags:

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

**Binary Management Process:**
1. Attempts download from GitHub releases (10-second setup)
2. Verifies `--script` argument support and Lua functionality
3. Falls back to source compilation if download unavailable (4-5 minutes)
4. Ensures working mGBA installation with HTTP server capabilities

> **✅ Zero Setup Required**: The environment automatically handles binary management, downloads, compilation, and verification. No manual preparation needed.

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
├── Dockerfile                # Legacy source build approach  
├── Dockerfile.auto           # Smart auto-download with fallback (ACTIVE)
├── Dockerfile.prebuilt       # Manual prebuilt binary approach
├── docker-compose.yml        # Service configuration (uses auto-download)
├── entrypoint.sh             # Container startup script
├── scripts/
│   └── download-mgba.sh      # Smart binary download/build script
├── data/
│   ├── emerald.ss0           # Pokémon Emerald savestate
│   └── emerald.sav           # Save file
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

| Feature | Docker (Auto-Download) | Docker (Prebuilt) | Docker (Source Build) | Native |
|---------|-------|-------|------------|--------|
| Build Time | ~10 seconds (download) / ~4-5 minutes (fallback) | ~10 seconds | ~4-5 minutes | ~3-4 minutes |
| Dependencies | None required | Prebuilt binary needed | Full build chain | Manual setup |
| Performance | Near-native | Near-native | Near-native | Native |
| Portability | Cross-platform | Cross-platform | Cross-platform | Linux only |
| Isolation | Complete | Complete | Complete | Shared system |
| Setup | Fully automated | Manual binary | Automated | Manual |
| Memory Usage | Low / Medium (fallback) | Low | High (build) | Medium |
| Binary Maintenance | Automated | Manual | Automated | Manual |
| Reliability | High (always works) | Medium (binary dependency) | High | Medium |
| **Current Default** | **✅ YES** | No | No | No |

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