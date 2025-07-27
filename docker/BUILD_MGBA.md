# Building mGBA for Docker Environment

This guide explains how to build the prebuilt mGBA binary required for the Docker environment.

## Quick Build Script

```bash
#!/bin/bash
# Build mGBA with required configuration for Docker environment

# Clone mGBA
git clone https://github.com/mgba-emu/mgba.git --depth 1 --branch master
cd mgba

# Install dependencies (Ubuntu/Debian)
sudo apt-get update && sudo apt-get install -y \
    build-essential \
    cmake \
    git \
    pkg-config \
    qtbase5-dev \
    qtmultimedia5-dev \
    liblua5.4-dev \
    lua5.4 \
    libpng-dev \
    zlib1g-dev \
    libzip-dev \
    libedit-dev \
    libepoxy-dev

# Configure with required flags
cmake -B build \
    -DBUILD_QT=ON \
    -DBUILD_SDL=OFF \
    -DUSE_LUA=ON \
    -DCMAKE_BUILD_TYPE=Release \
    -DUSE_FFMPEG=OFF \
    -DUSE_MINIZIP=OFF \
    -DUSE_LIBZIP=OFF \
    -DUSE_DISCORD_RPC=OFF

# Build with limited parallelism to avoid memory issues
cmake --build build --parallel 2

# Copy binary to Docker data directory
cp build/qt/mgba-qt ../docker/data/mgba-qt
chmod +x ../docker/data/mgba-qt

echo "✅ mGBA binary ready at docker/data/mgba-qt"
```

## Verification

Test that the binary has Lua support:

```bash
# Check if --script argument is available
./docker/data/mgba-qt --help | grep script

# Should show something like:
# --script FILE     Run a Lua script
```

## Required Features

The prebuilt binary must have:
- ✅ Qt frontend (`-DBUILD_QT=ON`)
- ✅ Lua support (`-DUSE_LUA=ON`)
- ✅ `--script` command line argument
- ✅ Socket API for HTTP server

## Alternative Platforms

### macOS
```bash
# Install dependencies via Homebrew
brew install cmake qt@5 lua pkg-config libpng libzip

# Use the same cmake configuration as above
```

### Windows (MSYS2)
```bash
# Install dependencies via MSYS2
pacman -S mingw-w64-x86_64-toolchain mingw-w64-x86_64-cmake mingw-w64-x86_64-qt5 mingw-w64-x86_64-lua

# Use the same cmake configuration as above
```

## Testing the Build

Once built, test the binary:

```bash
# Start Docker environment
npm run mgba:start

# Test HTTP endpoints
curl http://localhost:7102/
curl http://localhost:7102/json

# Stop environment
npm run mgba:stop
```

If the HTTP server responds correctly, the binary is working properly.