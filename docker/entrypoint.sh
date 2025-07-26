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
echo "   Built mGBA version with Lua support"

# First try: Check what binaries we actually have
echo "📝 Available mGBA binaries:"
ls -la /usr/local/bin/mgba*

# Create a simple config file to auto-load the Lua script
CONFIG_DIR="/app/.config/mgba"
mkdir -p "$CONFIG_DIR"
cat > "$CONFIG_DIR/config.ini" << EOF
[gba]
autoload.script=$LUA_SCRIPT_PATH
EOF

# Launch mGBA with debugger which supports Lua scripting
echo "🔧 Launching mGBA with debugger interface..."
/usr/local/bin/mgba \
    -d \
    -t "$SAVESTATE_PATH" \
    "$ROM_PATH" &

MGBA_PID=$!

echo "✅ mGBA started with PID: $MGBA_PID"
echo "🌐 HTTP server starting on port 7102..."
echo "   Test with: curl http://localhost:7102/"

# Wait for mGBA process or signals
wait $MGBA_PID