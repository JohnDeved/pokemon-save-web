# mGBA Prebuilt Binary Distribution Setup

This document explains how to set up automatic distribution of prebuilt mGBA binaries for the Docker environment.

## Overview

The Docker environment now supports automatic download of prebuilt mGBA binaries from GitHub releases, with fallback to source compilation. This dramatically improves setup speed and reduces complexity for users.

## Setting Up Prebuilt Binary Distribution

### 1. Build the mGBA Binary

First, build mGBA with the required configuration:

```bash
#!/bin/bash
# Build script for creating distributable mGBA binary

# Clone mGBA
git clone https://github.com/mgba-emu/mgba.git --depth 1 --branch master
cd mgba

# Install dependencies (Ubuntu/Debian)
apt-get update && apt-get install -y \
    build-essential cmake git pkg-config \
    qtbase5-dev qtmultimedia5-dev liblua5.4-dev lua5.4 \
    libpng-dev zlib1g-dev libzip-dev libedit-dev libepoxy-dev

# Configure with required flags for Docker compatibility
cmake -B build \
    -DBUILD_QT=ON \
    -DBUILD_SDL=OFF \
    -DUSE_LUA=ON \
    -DCMAKE_BUILD_TYPE=Release \
    -DUSE_FFMPEG=OFF \
    -DUSE_MINIZIP=OFF \
    -DUSE_LIBZIP=OFF \
    -DUSE_DISCORD_RPC=OFF \
    -DCMAKE_INSTALL_PREFIX=/usr/local

# Build with limited parallelism 
cmake --build build --parallel 2

# The resulting binary will be at: build/qt/mgba-qt
```

### 2. Create GitHub Release

Create a GitHub release to host the prebuilt binary:

```bash
# Example using GitHub CLI
gh release create mgba-prebuilt \
    --title "mGBA Prebuilt Binary for Docker Environment" \
    --notes "Prebuilt mGBA binary with Qt5, Lua support, and --script argument for Docker automation" \
    build/qt/mgba-qt#mgba-qt-linux-x64
```

### 3. Update Download URL

Update the download URL in `docker/scripts/download-mgba.sh`:

```bash
# Change this line to point to your release
MGBA_RELEASE_URL="https://github.com/YOUR_USERNAME/YOUR_REPO/releases/download/mgba-prebuilt/mgba-qt-linux-x64"
```

## How It Works

The Docker environment follows this process:

1. **Prebuilt Download**: Attempts to download from GitHub release
2. **Verification**: Checks if binary has required `--script` support  
3. **Fallback**: If download fails, builds from source automatically
4. **Final Verification**: Ensures working mGBA installation

## Benefits

- ⚡ **10-second builds** vs 4-5 minute source compilation
- 🌍 **Cross-platform**: Works on any system with Docker
- 🔄 **Automatic fallback**: Always works even if download fails
- ✅ **Verified compatibility**: Ensures --script support is available

## Current Status

The system is configured to:
- Try downloading from: `https://github.com/JohnDeved/pokemon-save-web/releases/download/mgba-prebuilt/mgba-qt-linux-x64`
- Fall back to source build if download unavailable
- Automatically verify all required features

## Testing the Setup

```bash
# Build and start the environment
npm run mgba:start

# Verify HTTP server is working
curl http://localhost:7102/
curl http://localhost:7102/json

# Check logs to see if prebuilt binary was used
docker logs mgba-test-environment

# Stop environment
npm run mgba:stop
```

## Creating Platform-Specific Binaries

For multi-platform support, build binaries for different architectures:

```bash
# Linux x64 (standard)
mgba-qt-linux-x64

# Linux ARM64 (for ARM-based systems)
mgba-qt-linux-arm64

# macOS (if needed)
mgba-qt-macos-x64
```

Update the download script to detect platform and download appropriate binary.

## Security Considerations

- Use official repository releases only
- Verify binary integrity with checksums if needed
- Keep source build fallback for security-conscious users
- Document the build process for transparency

## Maintenance

- Update prebuilt binary when mGBA releases new versions
- Test compatibility with latest mGBA master branch
- Monitor download statistics and fallback usage
- Keep build dependencies up to date