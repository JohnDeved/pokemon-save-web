# Simplified mGBA Docker Environment for Testing
# This demonstrates the concept - for full Lua HTTP support, see Dockerfile.complex
FROM ubuntu:22.04

# Install minimal dependencies  
RUN apt-get update && apt-get install -y \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Create working directory
WORKDIR /app

# Copy test data and scripts
COPY test_data/ /app/test_data/
COPY scripts/ /app/scripts/

# Create simple demonstration script
COPY <<EOF /app/entrypoint.sh
#!/bin/bash

echo "🚀 mGBA Docker Test Environment"
echo "================================"

# Download ROM if not present
ROM_PATH="/app/test_data/emerald.gba"
if [ ! -f "\$ROM_PATH" ]; then
    echo "📥 Downloading Pokémon Emerald ROM..."
    cd /app/test_data
    curl -L -o emerald_temp.zip "https://archive.org/download/pkmn_collection/pkmn%20collection/GBA/Pokemon%20-%20Emerald%20Version%20%28USA%2C%20Europe%29.zip"
    unzip -o emerald_temp.zip
    mv "Pokemon - Emerald Version (USA, Europe).gba" emerald.gba
    rm -f emerald_temp.zip
    echo "✅ ROM downloaded successfully (\$(wc -c < "\$ROM_PATH") bytes)"
fi

# Verify required files
SAVESTATE_PATH="/app/test_data/emerald.ss0"
LUA_SCRIPT_PATH="/app/test_data/mgba_http_server.lua"

echo "📁 Checking required files:"
echo "   ROM:       \$ROM_PATH (\$(if [ -f "\$ROM_PATH" ]; then echo "✅"; else echo "❌"; fi))"
echo "   Savestate: \$SAVESTATE_PATH (\$(if [ -f "\$SAVESTATE_PATH" ]; then echo "✅"; else echo "❌"; fi))"
echo "   Lua Script: \$LUA_SCRIPT_PATH (\$(if [ -f "\$LUA_SCRIPT_PATH" ]; then echo "✅"; else echo "❌"; fi))"

echo ""
echo "📋 Environment Summary:"
echo "   - ROM size: \$(wc -c < "\$ROM_PATH") bytes"
echo "   - Container ready for mGBA installation"
echo "   - Use Dockerfile.complex for full mGBA + Lua HTTP support"

echo ""
echo "💡 Next Steps for Full Implementation:"
echo "   1. Install mGBA with Lua support (see Dockerfile.complex)"
echo "   2. Set up X11 forwarding for headless operation"  
echo "   3. Launch mGBA with --script argument"
echo "   4. Test HTTP endpoints at http://localhost:7102"

echo ""
echo "🌐 This simplified version demonstrates ROM download and file setup."
echo "   For working mGBA emulator, use the complex Dockerfile."

# Keep container running for inspection
tail -f /dev/null
EOF

# Make entrypoint executable
RUN chmod +x /app/entrypoint.sh

# Expose HTTP server port for future use
EXPOSE 7102

# Set entrypoint
ENTRYPOINT ["/app/entrypoint.sh"]