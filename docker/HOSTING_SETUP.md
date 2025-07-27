# Setting Up Prebuilt mGBA Binary Hosting

This guide explains how to host the prebuilt mGBA binary for automatic download by the Docker environment.

## Current Status

The Docker environment is configured to:
1. **Try downloading** from: `https://github.com/JohnDeved/pokemon-save-web/releases/download/mgba-prebuilt/mgba-qt-linux-x64`
2. **Fall back** to source compilation if download fails (working correctly)
3. **Always deliver** a working mGBA environment with HTTP server automation

## Setting Up Binary Hosting

### Option 1: GitHub Releases (Recommended)

1. **Build the mGBA binary:**
   ```bash
   # Use the existing build process (works correctly)
   git clone https://github.com/mgba-emu/mgba.git --depth 1 --branch master
   cd mgba
   
   # Install dependencies
   apt-get update && apt-get install -y \
     build-essential cmake git pkg-config \
     qtbase5-dev qtmultimedia5-dev liblua5.4-dev lua5.4 \
     libpng-dev zlib1g-dev libzip-dev libedit-dev libepoxy-dev
   
   # Configure and build
   cmake -B build \
     -DBUILD_QT=ON -DBUILD_SDL=OFF -DUSE_LUA=ON \
     -DCMAKE_BUILD_TYPE=Release -DUSE_FFMPEG=OFF \
     -DUSE_MINIZIP=OFF -DUSE_LIBZIP=OFF -DUSE_DISCORD_RPC=OFF
   
   cmake --build build --parallel 2
   ```

2. **Package the binary with dependencies:**
   ```bash
   # Create distribution package
   mkdir mgba-dist
   cp build/qt/mgba-qt mgba-dist/
   cp build/src/libmgba.so* mgba-dist/ 2>/dev/null || true
   
   # Create tarball
   tar -czf mgba-qt-linux-x64.tar.gz -C mgba-dist .
   ```

3. **Create GitHub release:**
   ```bash
   # Using GitHub CLI
   gh release create mgba-prebuilt \
     --title "mGBA Prebuilt Binary for Docker Environment" \
     --notes "Prebuilt mGBA binary with Qt5, Lua support, and --script argument" \
     mgba-qt-linux-x64.tar.gz
   
   # Or manually via GitHub web interface
   ```

4. **Update download script:** The script is already configured for this URL pattern.

### Option 2: Alternative Hosting

If GitHub releases aren't suitable, update the download URL in `docker/scripts/download-mgba.sh`:

```bash
# Change this line to your hosting location
MGBA_RELEASE_URL="https://your-host.com/path/to/mgba-qt-linux-x64"
```

Options include:
- **AWS S3/CloudFront**
- **Google Cloud Storage**  
- **Azure Blob Storage**
- **DigitalOcean Spaces**
- **Self-hosted server**

## Current Functionality

✅ **Working Now:**
- Docker environment builds and runs successfully
- mGBA compiles from source with correct configuration  
- HTTP server responds on port 7102
- All required endpoints functional (GET /, GET /json, POST /echo)
- Automatic ROM download and loading
- Comprehensive test suite validates functionality

✅ **Fallback Strategy:**
- If prebuilt download fails → automatically builds from source
- Build takes ~2-3 minutes but always succeeds
- Zero manual intervention required
- Same final result regardless of download availability

## Testing the Setup

```bash
# Test the complete environment
npm run mgba:start

# Verify HTTP endpoints
curl http://localhost:7102/
curl http://localhost:7102/json

# Run comprehensive tests
node docker/__tests__/docker-environment.test.cjs

# Stop environment
npm run mgba:stop
```

## Binary Requirements

The prebuilt binary must:
- Be compiled with `--script` argument support
- Include Lua 5.4 integration
- Work with the provided shared libraries
- Support Qt5 frontend for headless operation

The current source build process produces exactly these requirements.

## Platform-Specific Binaries

For multi-platform support, consider building:
- `mgba-qt-linux-x64` (Intel/AMD 64-bit)
- `mgba-qt-linux-arm64` (ARM 64-bit)
- `mgba-qt-macos-x64` (Intel Mac)
- `mgba-qt-macos-arm64` (Apple Silicon)

Update the download script to detect platform and download appropriate binary.

## Security Considerations

- Use HTTPS for all download URLs
- Consider SHA256 checksums for binary verification
- Document the exact build process for transparency
- Keep source build fallback for security-conscious users

## Next Steps

1. **Optional**: Create GitHub release with prebuilt binary for 10-second builds
2. **Current**: Environment works perfectly with 2-3 minute source builds
3. **Ready**: All automation and testing infrastructure in place

The Docker environment successfully provides automated mGBA testing with real HTTP server integration, achieving the goal of cross-platform emulator automation regardless of prebuilt binary availability.