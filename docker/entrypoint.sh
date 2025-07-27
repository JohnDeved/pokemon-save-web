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




echo "[entrypoint] GAME env: $GAME"

# Set default GAME if not set
GAME="${GAME:-emerald}"
echo "[entrypoint] GAME env: $GAME"
ROM="/app/data/${GAME}.gba"
SAVESTATE="/app/data/${GAME}.ss0"
ROM_SRC="/app/data"
SAVESTATE_SRC="/app/data"
if [[ ! -f "$ROM" ]]; then
  ROM="/app/roms/${GAME}.gba"
  ROM_SRC="/app/roms"
fi
if [[ ! -f "$SAVESTATE" ]]; then
  SAVESTATE="/app/roms/${GAME}.ss0"
  SAVESTATE_SRC="/app/roms"
fi
LUA_SCRIPT="/app/data/mgba_http_server.lua"
MGBA_BIN="/usr/local/bin/mgba-qt"

echo "[entrypoint] === FILE CHECK SUMMARY ==="
echo "[entrypoint] Required:"
echo "  ROM:        $ROM (source: $ROM_SRC)"
echo "  Savestate:  $SAVESTATE (source: $SAVESTATE_SRC)"
echo "  Lua script: $LUA_SCRIPT"
echo "  mGBA bin:   $MGBA_BIN"
echo "[entrypoint] ============================"

# Check all required files before proceeding
missing=0
if [[ ! -f "$ROM" ]]; then
  echo "❌ Required ROM not found: $ROM"
  missing=1
fi
if [[ ! -f "$SAVESTATE" ]]; then
  echo "❌ Required savestate not found: $SAVESTATE"
  missing=1
fi
if [[ ! -f "$LUA_SCRIPT" ]]; then
  echo "❌ Lua script not found: $LUA_SCRIPT (should be mounted by docker-compose)"
  missing=1
fi
if [[ ! -x "$MGBA_BIN" ]]; then
  echo "❌ mGBA binary not found or not executable: $MGBA_BIN"
  missing=1
fi
if [[ $missing -eq 1 ]]; then
  echo "[entrypoint] Directory listing for /app/data:"
  ls -l /app/data || echo "[entrypoint] Could not list /app/data"
  echo "[entrypoint] Directory listing for /app/roms:"
  ls -l /app/roms || echo "[entrypoint] Could not list /app/roms"
  exit 1
fi


echo "🚀 Starting mGBA with Pokémon $GAME and Lua HTTP server..."
echo "   ROM: $ROM"
echo "   Savestate: $SAVESTATE"
echo "   Lua Script: $LUA_SCRIPT"


# Check mgba-qt supports --script
if ! "$MGBA_BIN" --help | grep -q script; then
  echo "❌ mGBA does not support --script argument"
  "$MGBA_BIN" --help || true
  exit 1
fi


# Start mGBA
echo "🎮 Starting mGBA with --script HTTP server..."

# Use full paths for all files
set -x
xvfb-run -a "$MGBA_BIN" \
  --script "$LUA_SCRIPT" \
  --savestate "$SAVESTATE" \
  "$ROM" &
MGBA_PID=$!
set +x

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