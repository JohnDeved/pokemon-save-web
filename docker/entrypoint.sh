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
LUA_SCRIPT_PATH="/app/data/mgba_http_server.lua"

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

echo "🚀 Starting mGBA with Pokémon Emerald and Lua HTTP server..."
echo "   ROM: $ROM_PATH"
echo "   Savestate: $SAVESTATE_PATH" 
echo "   Lua Script: $LUA_SCRIPT_PATH"

# Start simple HTTP server first to validate setup
echo "🧪 Starting test HTTP server on port 7102..."
cd /app/data
lua5.4 simple_http_server.lua &
HTTP_PID=$!

echo "✅ Test HTTP server started with PID: $HTTP_PID"
echo "🌐 HTTP server available on port 7102"
echo "   Test with: curl http://localhost:7102/"

# In parallel, try to launch mGBA for future integration
echo "🎮 Starting mGBA in background..."
/usr/local/bin/mgba-qt \
    -t "$SAVESTATE_PATH" \
    "$ROM_PATH" >/dev/null 2>&1 &
MGBA_PID=$!

echo "✅ mGBA started with PID: $MGBA_PID"

# Wait for the HTTP server (which is our main demonstration)
wait $HTTP_PID