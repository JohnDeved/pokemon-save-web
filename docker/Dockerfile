# Multi-stage Docker build for mGBA test environment
# Stage 1: Build mGBA from source with Lua support
FROM ubuntu:22.04 AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    pkg-config \
    qt6-base-dev \
    qt6-multimedia-dev \
    qt6-tools-dev \
    liblua5.4-dev \
    lua5.4 \
    libsdl2-dev \
    libedit-dev \
    libelf-dev \
    libpng-dev \
    libzip-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# Clone and build mGBA with Lua support
WORKDIR /build
RUN git clone --depth 1 --branch main https://github.com/mgba-emu/mgba.git
WORKDIR /build/mgba

# Configure mGBA build with Qt frontend and Lua scripting
RUN mkdir build && cd build && \
    cmake .. \
    -DCMAKE_BUILD_TYPE=Release \
    -DBUILD_QT=ON \
    -DBUILD_SDL=OFF \
    -DUSE_LUA=ON \
    -DUSE_DISCORD_RPC=OFF \
    -DCMAKE_INSTALL_PREFIX=/usr/local \
    && make -j$(nproc) && make install

# Stage 2: Runtime environment
FROM ubuntu:22.04

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    qt6-base-dev \
    qt6-multimedia-dev \
    liblua5.4-0 \
    lua5.4 \
    libsdl2-2.0-0 \
    libedit2 \
    libelf1 \
    libpng16-16 \
    libzip4 \
    zlib1g \
    xvfb \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Copy built mGBA from builder stage
COPY --from=builder /usr/local/bin/mgba-qt /usr/local/bin/mgba-qt
COPY --from=builder /usr/local/lib/libmgba.* /usr/local/lib/
COPY --from=builder /usr/local/include/mgba/ /usr/local/include/mgba/

# Update library cache
RUN ldconfig

# Create working directory
WORKDIR /app

# Copy test data and scripts
COPY test_data/ /app/test_data/
COPY scripts/ /app/scripts/

# Create entrypoint script
COPY <<EOF /app/entrypoint.sh
#!/bin/bash

# Set up environment
export DISPLAY=:99
export QT_QPA_PLATFORM=xcb

# Start Xvfb for headless operation
Xvfb :99 -screen 0 1024x768x24 -ac +extension GLX +render -noreset &
XVFB_PID=\$!

# Wait for X server to start
sleep 2

# Function to clean up processes
cleanup() {
    echo "Cleaning up..."
    if [ ! -z "\$MGBA_PID" ]; then
        kill \$MGBA_PID 2>/dev/null
    fi
    if [ ! -z "\$XVFB_PID" ]; then
        kill \$XVFB_PID 2>/dev/null
    fi
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

# Download ROM if not present
ROM_PATH="/app/test_data/emerald.gba"
if [ ! -f "\$ROM_PATH" ]; then
    echo "📥 Downloading Pokémon Emerald ROM..."
    cd /app/test_data
    curl -L -o emerald_temp.zip "https://archive.org/download/pkmn_collection/pkmn%20collection/GBA/Pokemon%20-%20Emerald%20Version%20%28USA%2C%20Europe%29.zip"
    unzip -o emerald_temp.zip
    mv "Pokemon - Emerald Version (USA, Europe).gba" emerald.gba
    rm -f emerald_temp.zip
    echo "✅ ROM downloaded successfully"
fi

# Verify ROM exists
if [ ! -f "\$ROM_PATH" ]; then
    echo "❌ ROM file not found at \$ROM_PATH"
    exit 1
fi

# Verify required files
SAVESTATE_PATH="/app/test_data/emerald.ss0"
LUA_SCRIPT_PATH="/app/test_data/mgba_http_server.lua"

if [ ! -f "\$SAVESTATE_PATH" ]; then
    echo "❌ Savestate file not found at \$SAVESTATE_PATH"
    exit 1
fi

if [ ! -f "\$LUA_SCRIPT_PATH" ]; then
    echo "❌ Lua script not found at \$LUA_SCRIPT_PATH"
    exit 1
fi

echo "🚀 Starting mGBA with Pokémon Emerald and HTTP server..."
echo "   ROM: \$ROM_PATH"
echo "   Savestate: \$SAVESTATE_PATH"
echo "   Lua Script: \$LUA_SCRIPT_PATH"

# Launch mGBA with the ROM, savestate, and Lua script
/usr/local/bin/mgba-qt \
    -t "\$SAVESTATE_PATH" \
    --script "\$LUA_SCRIPT_PATH" \
    "\$ROM_PATH" &

MGBA_PID=\$!

echo "✅ mGBA started with PID: \$MGBA_PID"
echo "🌐 HTTP server should be available at http://localhost:7102"

# Wait for mGBA process or signals
wait \$MGBA_PID
EOF

# Make entrypoint executable
RUN chmod +x /app/entrypoint.sh

# Expose HTTP server port
EXPOSE 7102

# Set entrypoint
ENTRYPOINT ["/app/entrypoint.sh"]