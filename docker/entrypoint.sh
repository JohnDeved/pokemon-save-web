#!/bin/bash

# Set up environment
export DISPLAY=:99
export QT_QPA_PLATFORM=xcb
export SDL_VIDEODRIVER=dummy
export XDG_RUNTIME_DIR=/tmp

# Clean up any existing X server locks
rm -f /tmp/.X99-lock

# Start Xvfb for headless operation
Xvfb :99 -screen 0 1024x768x24 -ac +extension GLX +render -noreset &
XVFB_PID=$!

# Wait for X server to start
sleep 3

# Function to clean up processes
cleanup() {
    echo "Cleaning up..."
    if [ ! -z "$MGBA_PID" ]; then
        kill $MGBA_PID 2>/dev/null
    fi
    if [ ! -z "$XVFB_PID" ]; then
        kill $XVFB_PID 2>/dev/null
    fi
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

# Download ROM if not present
ROM_PATH="/app/data/emerald.gba"
if [ ! -f "$ROM_PATH" ]; then
    echo "📥 Downloading Pokémon Emerald ROM..."
    cd /app/data
    curl -L -o emerald_temp.zip "https://archive.org/download/pkmn_collection/pkmn%20collection/GBA/Pokemon%20-%20Emerald%20Version%20%28USA%2C%20Europe%29.zip"
    unzip -o emerald_temp.zip
    mv "Pokemon - Emerald Version (USA, Europe).gba" emerald.gba
    rm -f emerald_temp.zip
    echo "✅ ROM downloaded successfully"
fi

# Verify ROM exists
if [ ! -f "$ROM_PATH" ]; then
    echo "❌ ROM file not found at $ROM_PATH"
    exit 1
fi

# Verify required files
SAVESTATE_PATH="/app/data/emerald.ss0"
LUA_SCRIPT_PATH="/app/data/http-server.lua"

if [ ! -f "$SAVESTATE_PATH" ]; then
    echo "❌ Savestate file not found at $SAVESTATE_PATH"
    exit 1
fi

if [ ! -f "$LUA_SCRIPT_PATH" ]; then
    echo "❌ Lua script not found at $LUA_SCRIPT_PATH"
    exit 1
fi

echo "🚀 Starting mGBA with Pokémon Emerald and Lua HTTP server..."
echo "   ROM: $ROM_PATH"
echo "   Savestate: $SAVESTATE_PATH" 
echo "   Lua Script: $LUA_SCRIPT_PATH"

# Start mGBA with the --script argument to load HTTP server within mGBA Lua API
echo "🎮 Starting mGBA with --script HTTP server..."
/usr/local/bin/mgba-qt \
    --script "$LUA_SCRIPT_PATH" \
    -t "$SAVESTATE_PATH" \
    "$ROM_PATH" 2>&1 &
MGBA_PID=$!

echo "✅ mGBA started with HTTP server script loaded (PID: $MGBA_PID)"
echo "🌐 HTTP server should be available on port 7102 within mGBA"
echo "   Test with: curl http://localhost:7102/"

# Wait for mGBA process
wait $MGBA_PID