# Docker mGBA Test Environment

This document describes the Docker-based mGBA test environment that provides a cross-platform solution for automated testing against a real mGBA emulator.

## Overview

The Docker environment builds mGBA from source with full Lua support and Qt frontend, providing:

- **Cross-platform compatibility**: Works on Windows, macOS, and Linux
- **Consistent environment**: Same mGBA version and configuration across all platforms
- **Automated setup**: ROM download, mGBA compilation, and environment configuration
- **Real emulator testing**: Tests run against actual mGBA with Pokémon Emerald ROM
- **HTTP API validation**: Comprehensive emulator API testing with live data

## Quick Start

### Prerequisites

- Docker Desktop (Windows/macOS) or Docker Engine (Linux)
- Docker Compose

### Basic Usage

```bash
# Build the mGBA Docker environment
npm run mgba:docker:build

# Start the environment (downloads ROM automatically)
npm run mgba:docker:start

# Test the HTTP endpoints
npm run mgba:docker:test

# View logs
npm run mgba:docker:logs

# Stop the environment
npm run mgba:docker:stop
```

### Manual Docker Commands

```bash
# Build and start with Docker Compose
docker compose build
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f

# Stop and cleanup
docker compose down
```

## Architecture

### Multi-Stage Docker Build

The Dockerfile uses a multi-stage build:

1. **Builder stage**: Builds mGBA from source with Qt6 and Lua 5.4 support
2. **Runtime stage**: Minimal runtime environment with Xvfb for headless operation

### Container Features

- **mGBA Qt**: Built from source with `--script` command line support
- **Lua 5.4**: Full scripting environment with emulator API access
- **Xvfb**: Headless X11 server for GUI applications
- **HTTP Server**: Lua-based HTTP server with WebSocket support
- **ROM Management**: Automatic ROM download from archive.org
- **Health Checks**: Built-in health monitoring

## Configuration

### Docker Compose

```yaml
services:
  mgba-test:
    build: .
    ports:
      - "7102:7102"
    volumes:
      - ./test_data:/app/test_data
      - ./scripts:/app/scripts
    environment:
      - DISPLAY=:99
      - QT_QPA_PLATFORM=xcb
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:7102/"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### File Structure

```
/app/
├── test_data/
│   ├── emerald.gba           # ROM file (auto-downloaded)
│   ├── emerald.ss0           # Memory savestate
│   └── mgba_http_server_enhanced.lua  # HTTP server script
├── scripts/
│   └── docker-mgba.js        # Management script
└── entrypoint.sh            # Container startup script
```

## HTTP API Endpoints

The container exposes a comprehensive HTTP API on port 7102:

### Basic Endpoints

- **GET /** - Welcome message
- **GET /json** - JSON API with CORS headers
- **POST /echo** - Echo service for testing

### Emulator API Endpoints

- **GET /api/validate** - Comprehensive emulator API validation
- **GET /api/emulator** - Real-time emulator status

### WebSocket Interface

- **WebSocket /ws** - Real-time Lua code evaluation
  - Send `test:apis` for API validation
  - Send `test:emu` for emulator testing
  - Send Lua code for live evaluation

## Testing

### Running Tests

```bash
# Run all tests including Docker environment
npm test

# Run only Docker environment tests
npm test -- scripts/mgba-lua/__tests__/mgba-docker-environment.test.ts

# Run with verbose output
npm test -- --reporter=verbose
```

### Test Coverage

The Docker environment tests validate:

- ✅ Container lifecycle management
- ✅ HTTP endpoint functionality
- ✅ Emulator API availability
- ✅ ROM loading and validation
- ✅ Health check functionality
- ✅ WebSocket communication

### Expected Test Output

```
✅ Docker container is running
✅ GET / endpoint working  
✅ GET /json endpoint with CORS working
✅ POST /echo endpoint working
✅ Docker emulator API validation successful
   - Console API: ✅
   - Emu API: ✅ (ROM loaded: true)
   - Callbacks API: ✅
   - Socket API: ✅
   - ROM size: 16777216 bytes
```

## Management Commands

### NPM Scripts

```bash
npm run mgba:docker:build     # Build Docker image
npm run mgba:docker:start     # Start container
npm run mgba:docker:stop      # Stop container
npm run mgba:docker:restart   # Restart container
npm run mgba:docker:logs      # View logs
npm run mgba:docker:test      # Test HTTP endpoints
npm run mgba:docker:status    # Show container status
npm run mgba:docker:clean     # Remove container and image
npm run mgba:docker:help      # Show help
```

### Advanced Usage

```bash
# Follow logs in real-time
npm run mgba:docker:logs -- -f

# Open shell in running container
docker exec -it mgba-test-environment /bin/bash

# Check container health
docker inspect mgba-test-environment --format='{{.State.Health.Status}}'
```

## Troubleshooting

### Common Issues

**Container fails to start:**
```bash
# Check Docker logs
npm run mgba:docker:logs

# Verify Docker is running
docker --version
docker compose version
```

**HTTP server not responding:**
```bash
# Check if container is healthy
npm run mgba:docker:status

# Restart container
npm run mgba:docker:restart

# Check port binding
docker port mgba-test-environment
```

**ROM download fails:**
```bash
# Check internet connection
# Place emerald.gba manually in test_data/
curl -L -o test_data/emerald.gba "https://archive.org/download/pkmn_collection/pkmn%20collection/GBA/Pokemon%20-%20Emerald%20Version%20%28USA%2C%20Europe%29.zip"
```

### Debug Mode

Enable debug output in container:

```bash
# View detailed logs
docker compose logs -f mgba-test

# Check mGBA output
docker exec mgba-test-environment ps aux | grep mgba

# Test HTTP connectivity
curl -v http://localhost:7102/api/validate
```

## Performance

### Resource Usage

- **CPU**: ~1-2 cores (during ROM emulation)
- **Memory**: ~500MB-1GB
- **Disk**: ~2GB (image) + 16MB (ROM)
- **Network**: Port 7102 for HTTP/WebSocket

### Optimization

- Container uses multi-stage build for smaller image size
- Runtime dependencies are minimal
- Xvfb runs in minimal 1024x768 resolution
- Build cache is preserved between runs

## Integration

### CI/CD Integration

```yaml
# GitHub Actions example
- name: Test mGBA Docker Environment
  run: |
    npm run mgba:docker:build
    npm run mgba:docker:start
    sleep 30  # Wait for initialization
    npm test -- scripts/mgba-lua/__tests__/mgba-docker-environment.test.ts
    npm run mgba:docker:stop
```

### Development Workflow

1. **Local Development**: Use Docker environment for consistent testing
2. **Feature Testing**: Validate changes against real emulator
3. **Integration Testing**: Run full test suite including Docker tests
4. **Deployment**: Package Docker environment for production use

## Legal Notes

- ROM file (`emerald.gba`) is automatically downloaded from archive.org
- Users must ensure they have legal rights to use the ROM
- The container does not include any copyrighted ROM content
- ROM download is performed at runtime, not during image build

---

For more information, see the main [README.md](../README.md) or run:

```bash
npm run mgba:docker:help
```