#!/bin/bash

# Set up environment for headless operation
export QT_QPA_PLATFORM=xcb
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

# Verify required files
SAVESTATE_PATH="/app/data/emerald.ss0"
LUA_SCRIPT_PATH="/app/data/mgba_http_server.lua"

if [ ! -f "$ROM_PATH" ]; then
    echo "❌ ROM file not found at $ROM_PATH"
    exit 1
fi

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

# Verify mgba-qt supports --script
if ! /usr/local/bin/mgba-qt --help | grep -q script; then
    echo "❌ mGBA does not support --script argument"
    exit 1
fi

echo "✅ mGBA supports --script argument"

# Start mGBA with the same approach that works in native environment
echo "🎮 Starting mGBA with --script HTTP server..."
cd /app/data
xvfb-run -a /usr/local/bin/mgba-qt \
    --script mgba_http_server.lua \
    --savestate emerald.ss0 \
    emerald.gba &
MGBA_PID=$!

echo "🕐 Waiting for mGBA to start and HTTP server to be ready..."
# Wait longer for startup
sleep 10

echo "✅ mGBA started with HTTP server script loaded (PID: $MGBA_PID)"
echo "🌐 HTTP server should be available on port 7102"
echo "   Test with: curl http://localhost:7102/"

# Check if mGBA is still running
if kill -0 $MGBA_PID 2>/dev/null; then
    echo "✅ mGBA process is still running"
else
    echo "❌ mGBA process has exited"
    exit 1
fi

# Wait for mGBA process
wait $MGBA_PID