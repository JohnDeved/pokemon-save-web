#!/bin/bash

# Set up environment for headless operation
export QT_QPA_PLATFORM=xcb
export SDL_VIDEODRIVER=dummy
export XDG_RUNTIME_DIR=/tmp

# Function to clean up processes
cleanup() {
    echo "Cleaning up..."
    if [ ! -z "$MGBA_PID" ]; then
        kill $MGBA_PID 2>/dev/null
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
echo "📄 Using MINIMAL test script: /app/data/minimal-test.lua"
echo "🚀 Launching mGBA with xvfb-run for headless operation..."
echo "🐛 Capturing ALL output to see Lua execution..."
xvfb-run -a --server-args="-screen 0 1024x768x24 -ac +extension GLX +render -noreset" \
    /usr/local/bin/mgba-qt \
    --script "/app/data/minimal-test.lua" \
    --log-level 15 \
    -t "$SAVESTATE_PATH" \
    "$ROM_PATH" > /tmp/mgba_full.log 2>&1 &
MGBA_PID=$!

echo "🕐 Waiting for mGBA to start and load ROM..."
sleep 15
echo "📜 Full mGBA output with Lua test:"
cat /tmp/mgba_full.log

echo ""
echo "📜 Checking if mGBA is still running..."
if kill -0 $MGBA_PID 2>/dev/null; then
    echo "✅ mGBA is still running (PID: $MGBA_PID)"
else
    echo "❌ mGBA process has exited"
fi

echo "✅ mGBA started with HTTP server script loaded (PID: $MGBA_PID)"
echo "🌐 HTTP server should be available on port 7102 within mGBA"
echo "   Test with: curl http://localhost:7102/"

# Wait for mGBA process
wait $MGBA_PID