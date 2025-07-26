#!/bin/bash

# Set up environment
export DISPLAY=:99
export QT_QPA_PLATFORM=xcb

# Start Xvfb for headless operation
Xvfb :99 -screen 0 1024x768x24 -ac +extension GLX +render -noreset &
XVFB_PID=$!

# Wait for X server to start
sleep 2

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
ROM_PATH="/app/test_data/emerald.gba"
if [ ! -f "$ROM_PATH" ]; then
    echo "📥 Downloading Pokémon Emerald ROM..."
    cd /app/test_data
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
SAVESTATE_PATH="/app/test_data/emerald.ss0"
LUA_SCRIPT_PATH="/app/test_data/mgba_http_server.lua"

if [ ! -f "$SAVESTATE_PATH" ]; then
    echo "❌ Savestate file not found at $SAVESTATE_PATH"
    exit 1
fi

if [ ! -f "$LUA_SCRIPT_PATH" ]; then
    echo "❌ Lua script not found at $LUA_SCRIPT_PATH"
    exit 1
fi

echo "🚀 Starting mGBA with Pokémon Emerald..."
echo "   ROM: $ROM_PATH"
echo "   Savestate: $SAVESTATE_PATH"
echo "   NOTE: mGBA version 0.9.3 does not support --script argument"
echo "   Lua HTTP server functionality is not available in this version"

# Launch mGBA with the ROM and savestate (without Lua script for now)
/usr/games/mgba-qt \
    -t "$SAVESTATE_PATH" \
    "$ROM_PATH" &

MGBA_PID=$!

echo "✅ mGBA started with PID: $MGBA_PID"
echo "⚠️  HTTP server not available (mGBA 0.9.3 lacks --script support)"
echo "   To enable HTTP server, upgrade to mGBA 0.10.0+ with Lua support"

# Wait for mGBA process or signals
wait $MGBA_PID