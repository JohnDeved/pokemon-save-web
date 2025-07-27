#!/bin/bash

# Entrypoint for mGBA Docker container
set -e

# Environment for headless operation
export QT_QPA_PLATFORM=xcb
export XDG_RUNTIME_DIR=/tmp

# Cleanup function for signals
cleanup() {
  echo "Cleaning up..."
  [[ -n "$MGBA_PID" ]] && kill $MGBA_PID 2>/dev/null
  exit 0
}
trap cleanup SIGTERM SIGINT

DATA_DIR="/app/data"
ROM="$DATA_DIR/emerald.gba"
SAVESTATE="$DATA_DIR/emerald.ss0"
LUA_SCRIPT="$DATA_DIR/mgba_http_server.lua"
MGBA_BIN="/usr/local/bin/mgba-qt"

# Download ROM if missing
if [[ ! -f "$ROM" ]]; then
  echo "📥 Downloading Pokémon Emerald ROM..."
  cd "$DATA_DIR"
  curl -L -o emerald_temp.zip "https://archive.org/download/pkmn_collection/pkmn%20collection/GBA/Pokemon%20-%20Emerald%20Version%20%28USA%2C%20Europe%29.zip"
  unzip -o emerald_temp.zip
  mv "Pokemon - Emerald Version (USA, Europe).gba" emerald.gba
  rm -f emerald_temp.zip
  echo "✅ ROM downloaded successfully"
fi

# Check required files
for f in "$ROM" "$SAVESTATE" "$LUA_SCRIPT"; do
  [[ -f "$f" ]] || { echo "❌ Required file not found: $f"; exit 1; }
done

echo "🚀 Starting mGBA with Pokémon Emerald and Lua HTTP server..."
echo "   ROM: $ROM"
echo "   Savestate: $SAVESTATE"
echo "   Lua Script: $LUA_SCRIPT"

# Check mgba-qt supports --script
if ! "$MGBA_BIN" --help | grep -q script; then
  echo "❌ mGBA does not support --script argument"
  exit 1
fi

# Start mGBA
echo "🎮 Starting mGBA with --script HTTP server..."
cd "$DATA_DIR"
xvfb-run -a "$MGBA_BIN" \
  --script "$(basename "$LUA_SCRIPT")" \
  --savestate "$(basename "$SAVESTATE")" \
  "$(basename "$ROM")" &
MGBA_PID=$!

echo "✅ mGBA started with HTTP server script loaded (PID: $MGBA_PID)"

# Self-test HTTP server
echo "🔎 Self-testing HTTP server on localhost:7102..."
for i in {1..5}; do
  if curl -sf http://localhost:7102/ > /dev/null; then
    echo "✅ HTTP server is responding on localhost:7102"
    break
  else
    echo "⏳ Waiting for HTTP server... ($i/5)"
    sleep 2
  fi
  if [[ $i -eq 5 ]]; then
    echo "❌ HTTP server did not respond on localhost:7102 after 5 attempts"
    cleanup
  fi
done

echo "🌐 HTTP server should be available on port 7102"
echo "   Test with: curl http://localhost:7102/"

# Wait for mGBA process
wait $MGBA_PID