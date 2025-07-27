#!/bin/bash
set -e

echo "🔍 Setting up mGBA for Docker environment..."

# Configuration
MGBA_RELEASE_URL="https://github.com/JohnDeved/pokemon-save-web/releases/download/mgba-prebuilt/mgba-qt-linux-x64"
MGBA_INSTALL_PATH="/usr/local/bin/mgba-qt"
MGBA_BUILD_DIR="/tmp/mgba"

# Function to download prebuilt binary
download_prebuilt() {
    echo "📥 Attempting to download prebuilt mGBA binary..."
    
    if curl -L -f -o "$MGBA_INSTALL_PATH" "$MGBA_RELEASE_URL"; then
        chmod +x "$MGBA_INSTALL_PATH"
        echo "✅ Successfully downloaded prebuilt mGBA binary"
        
        # Verify the binary has required features (basic check)
        if "$MGBA_INSTALL_PATH" --help >/dev/null 2>&1; then
            echo "✅ Verified: mGBA binary is functional"
            return 0
        else
            echo "❌ Prebuilt binary failed basic functionality test"
            rm -f "$MGBA_INSTALL_PATH"
            return 1
        fi
    else
        echo "❌ Failed to download prebuilt binary from $MGBA_RELEASE_URL"
        return 1
    fi
}

# Function to build from source
build_from_source() {
    echo "🔨 Building mGBA from source..."
    
    # Clone mGBA repository
    git clone https://github.com/mgba-emu/mgba.git --depth 1 --branch master "$MGBA_BUILD_DIR"
    cd "$MGBA_BUILD_DIR"
    
    # Configure with required flags (same as working configuration)
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
    echo "🔨 Compiling mGBA (this may take several minutes)..."
    cmake --build build --parallel 2
    
    # Install the binary and shared library
    cp "build/qt/mgba-qt" "$MGBA_INSTALL_PATH"
    chmod +x "$MGBA_INSTALL_PATH"
    
    # Install the shared library
    if [ -f "build/libmgba.so" ]; then
        cp "build/libmgba.so" "/usr/local/lib/"
        cp "build/libmgba.so.0.11" "/usr/local/lib/" 2>/dev/null || true
        ldconfig
        echo "✅ Installed libmgba.so shared library"
    elif [ -f "build/src/libmgba.so" ]; then
        cp "build/src/libmgba.so" "/usr/local/lib/"
        cp "build/src/libmgba.so.0.11" "/usr/local/lib/" 2>/dev/null || true
        ldconfig
        echo "✅ Installed libmgba.so shared library"
    else
        echo "⚠️  libmgba.so not found, binary may need static linking"
    fi
    
    # Cleanup build directory
    cd /
    rm -rf "$MGBA_BUILD_DIR"
    
    echo "✅ Successfully built mGBA from source"
}

# Function to verify installation
verify_installation() {
    echo "🧪 Verifying mGBA installation..."
    
    if [ ! -f "$MGBA_INSTALL_PATH" ]; then
        echo "❌ mGBA binary not found at $MGBA_INSTALL_PATH"
        return 1
    fi
    
    # Check if binary is executable
    if ! [ -x "$MGBA_INSTALL_PATH" ]; then
        echo "❌ mGBA binary is not executable"
        return 1
    fi
    
    # Try to run binary with --help to see if it works
    echo "🔍 Testing mGBA binary execution..."
    if "$MGBA_INSTALL_PATH" --help >/tmp/mgba_help.log 2>&1; then
        echo "✅ mGBA binary executes successfully"
    else
        echo "❌ mGBA binary failed to execute"
        echo "📋 Error output:"
        cat /tmp/mgba_help.log || echo "No error log available"
        echo "🔍 Checking binary dependencies:"
        ldd "$MGBA_INSTALL_PATH" 2>/dev/null | head -20 || echo "ldd not available"
        return 1
    fi
    
    echo "✅ mGBA installation verified successfully"
    echo "📍 Binary location: $MGBA_INSTALL_PATH"
    
    # Show version info if available
    echo "🔍 mGBA version information:"
    "$MGBA_INSTALL_PATH" --version 2>/dev/null || echo "Version info not available"
    
    # Try to show help for script argument (informational only)
    echo "🔍 Checking for --script support:"
    if "$MGBA_INSTALL_PATH" --help 2>&1 | grep -i "script"; then
        echo "✅ --script argument found in help"
    else
        echo "⚠️  --script not explicitly shown in help (may still work)"
    fi
}

# Main execution logic
main() {
    echo "🚀 Starting mGBA setup process..."
    
    # Try prebuilt binary first
    if download_prebuilt; then
        echo "🎉 Using prebuilt mGBA binary"
    else
        echo "⚠️  Prebuilt binary unavailable, falling back to source build"
        if build_from_source; then
            echo "🎉 Using source-built mGBA binary"
        else
            echo "❌ Failed to build mGBA from source"
            exit 1
        fi
    fi
    
    # Final verification
    if verify_installation; then
        echo "🎯 mGBA setup completed successfully!"
    else
        echo "❌ mGBA setup failed verification"
        exit 1
    fi
}

# Execute main function
main "$@"