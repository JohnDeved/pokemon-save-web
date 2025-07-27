# Native mGBA Test Environment

This environment builds mGBA from source with Qt frontend and Lua scripting support outside of Docker, providing a complete setup for automated testing against a real emulator.

## Overview

The native mGBA test environment addresses the requirements specified for building and testing a real mGBA emulator with HTTP server automation:

1. **Native Build**: Builds mGBA from source with exact cmake flags as specified
2. **--script Support**: Enables command-line script loading for automation
3. **xvfb-run**: Headless operation for CI/automated environments  
4. **Socket API**: Uses mGBA's socket API for HTTP server functionality
5. **ROM Loading**: Requires ROM to be loaded for Lua script execution
6. **CLI Integration**: Proper mgba-qt command line usage

## Requirements

### System Dependencies

```bash
sudo apt update && sudo apt install -y \
  build-essential \
  cmake \
  git \
  pkg-config \
  qtbase5-dev \
  qtmultimedia5-dev \
  liblua5.4-dev \
  libpng-dev \
  zlib1g-dev \
  libzip-dev \
  libedit-dev \
  libepoxy-dev \
  xvfb
```

### Node.js Dependencies

```bash
npm install ws  # Required for WebSocket testing
```

## Build Configuration

The mGBA build uses the exact cmake flags specified:

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

Key features enabled:
- **Qt Frontend**: Provides GUI and --script command line support
- **Lua Scripting**: Enables Lua script execution within emulator
- **Socket API**: Available for network communication (confirmed)
- **Release Build**: Optimized performance

## Usage

### Quick Start

```bash
# Run the complete test environment
npm run mgba:test-native
```

This will:
1. Check system dependencies
2. Clone and build mGBA from source  
3. Set up test environment with ROM and savestate
4. Launch mGBA with HTTP server script
5. Test all HTTP endpoints and WebSocket functionality
6. Clean up resources

### Manual Operation

```bash
# Build mGBA (one-time setup)
cd /tmp && git clone https://github.com/mgba-emu/mgba.git
cd mgba && cmake -B build [flags] && cmake --build build --parallel

# Run with HTTP server
cd /path/to/test/data
xvfb-run -a /tmp/mgba/build/qt/mgba-qt \
  --script http-server.lua \
  --savestate emerald.ss0 \
  emerald.gba
```

## HTTP API Endpoints

When the HTTP server is running, these endpoints are available at `http://localhost:7102`:

### REST API
- **GET /** - Welcome message and server status
- **GET /json** - JSON API with timestamp and CORS headers  
- **POST /echo** - Echo service for request testing

### WebSocket
- **WebSocket /ws** - Real-time Lua code evaluation
  - Send Lua code as text messages
  - Receive JSON responses with results or errors
  - Access to full mGBA emulator context

### CORS Support
All endpoints include proper CORS headers:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type`

## Key Technical Notes

### Lua Environment Limitations
- **console:log Output**: mGBA Lua console.log does not show in terminal (internal only)
- **Socket API**: Available and functional for network communication
- **ROM Requirement**: ROM must be loaded for Lua scripts to execute
- **I/O Operations**: Limited; socket API is primary interface

### Command Line Usage
```bash
# Basic syntax
mgba-qt [options] rom-file

# With script and savestate  
mgba-qt --script script.lua --savestate state.ss0 rom.gba

# Headless operation
xvfb-run -a mgba-qt --script script.lua rom.gba
```

### Build Artifacts
- **Executable**: `/tmp/mgba/build/qt/mgba-qt`
- **Size**: ~3.6MB optimized release build
- **Dependencies**: Links against Qt5, Lua 5.4, and system libraries

## Testing Results

The native environment provides comprehensive validation:

✅ **mGBA Compilation**: Builds successfully with --script support  
✅ **HTTP Server**: Runs within mGBA Lua environment  
✅ **Socket API**: Confirmed available and functional  
✅ **ROM Loading**: 16MB Pokémon Emerald ROM loads correctly  
✅ **Savestate**: Applies emerald.ss0 successfully  
✅ **Network Binding**: Binds to port 7102 and accepts connections  
✅ **CORS Headers**: Proper cross-origin support  
✅ **WebSocket**: Real-time Lua evaluation working  
✅ **Error Handling**: 404 responses for invalid endpoints  

## Comparison with Docker Environment

| Feature | Native Build | Docker Environment |
|---------|--------------|-------------------|
| Build Time | ~5-10 minutes | ~15-20 minutes |
| Dependencies | System packages | Self-contained |
| Performance | Native speed | Slight overhead |
| Portability | Linux-specific | Cross-platform |
| Setup Complexity | Manual deps | Automated |
| --script Support | ✅ Full support | ✅ Full support |
| Socket API | ✅ Available | ✅ Available |

## Use Cases

1. **Development Testing**: Quick iteration on HTTP server scripts
2. **CI Integration**: Automated testing in GitHub Actions
3. **Performance Testing**: Native speed for benchmarking
4. **Debugging**: Direct access to mGBA executable and logs
5. **Research**: Full access to emulator internals and APIs

## Future Enhancements

- **Automated ROM Download**: Currently requires manual ROM setup
- **Multi-ROM Support**: Test with different game ROMs
- **Performance Metrics**: Add timing and resource usage tracking
- **Error Recovery**: Better handling of mGBA startup failures
- **Test Coverage**: Expand HTTP endpoint and WebSocket test cases

## Troubleshooting

### Common Issues

**Build Fails**: Ensure all system dependencies are installed
```bash
sudo apt install qtbase5-dev qtmultimedia5-dev liblua5.4-dev
```

**--script Not Supported**: Verify Qt frontend is built
```bash
./mgba-qt --help | grep script
```

**HTTP Server Not Starting**: Check ROM is loaded and script path is correct
```bash
xvfb-run -a ./mgba-qt --script /full/path/to/script.lua rom.gba
```

**Port Already in Use**: Kill existing mGBA processes
```bash
pkill -f mgba-qt
```

The native mGBA environment provides a complete, high-performance solution for automated testing against real emulator functionality with confirmed HTTP server capabilities and socket API support.