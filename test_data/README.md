# mGBA Test Environment Setup

This directory contains the necessary files for setting up an automated test environment with mGBA emulator and Pokémon Emerald.

## Files in this directory

- `emerald.ss0` - Pokémon Emerald memory savestate for testing
- `mgba_http_server.lua` - Lua HTTP server script for emulator automation
- `README.md` - This file with setup instructions

## Required: Pokémon Emerald ROM

**You need to provide your own legally obtained Pokémon Emerald ROM file.**

### Legal ROM Acquisition

To use this test environment, you must:

1. **Own a physical copy** of Pokémon Emerald for Game Boy Advance
2. **Create a ROM backup** from your own cartridge using legal dumping methods:
   - Use a flash cart reader/writer (e.g., GBxCart RW, Joey JR)
   - Use homebrew software on a GBA flash cart
   - Use dedicated ROM dumping hardware

### ROM File Requirements

- **File name**: `emerald.gba` (place it in this directory)
- **File type**: Game Boy Advance ROM (.gba extension)
- **Region**: Any region (USA, Europe, Japan) should work
- **File size**: Typically ~16-32 MB

### Important Legal Notice

⚠️ **This project does not provide ROM files.** Downloading ROM files from the internet without owning the physical game is copyright infringement in most jurisdictions. Only use ROM files that you have legally created from your own cartridges.

## Usage

Once you have placed your `emerald.gba` ROM file in this directory, you can use the npm scripts to launch the test environment:

```bash
# Launch mGBA with ROM, savestate, and HTTP server
npm run mgba:test

# Launch mGBA without the HTTP server (manual testing)
npm run mgba:manual
```

The HTTP server will be available at `http://localhost:7102` for automated testing.

## Testing the HTTP Interface

You can test the HTTP interface manually:

```bash
# Test basic connectivity
curl http://localhost:7102/

# Test JSON API
curl http://localhost:7102/json

# Test WebSocket eval (using a WebSocket client)
# Connect to: ws://localhost:7102/ws
```

Or use the provided test script:

```bash
npm run mgba:test-http
```