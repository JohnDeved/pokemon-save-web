# Pokemon Save Web

A web-based Pokemon save file editor, CLI tool, and TypeScript parser core with PWA support. **Now powered by Deno!**

## 🚀 Features

- **Progressive Web App (PWA)**: Install for offline use and app-like experience
- **Multi-Game Support**: Works with various Pokemon games and ROM hacks
- **Real-time Editing**: Interactive Pokemon data visualization and editing
- **File System Integration**: Modern browser file API support
- **Cross-Platform**: Web, CLI, and library usage
- **Modern Runtime**: Built with Deno for better security and performance

## Quick Start

### Prerequisites

Install Deno:
```bash
curl -fsSL https://deno.land/install.sh | sh
# Add to PATH: export PATH="$HOME/.deno/bin:$PATH"
```

### Web Application (PWA)
```bash
deno task dev
```
Open your browser to http://localhost:5173 and drag & drop a Pokemon save file to get started.

**PWA Features:**
- 📱 Install as native app on desktop and mobile
- 🔄 Works offline with previously loaded save files
- ⚡ Fast loading with optimized caching using native ES modules
- 🎨 Native app-like interface and theming

### Command Line
```bash
# Parse a save file
deno task parse save.sav

# With debug output
deno task parse save.sav --debug

# String conversion utilities
deno task parse --toBytes=PIKACHU
deno task parse --toString="ca c3 c5 bb bd c2 cf"
```

### Production Build
```bash
deno task build    # Build for production
deno task preview  # Preview production build
```

### Cloudflare Pages Deployment

This project is configured for native Cloudflare Pages deployment with pure Deno runtime:

1. **Connect repository** to Cloudflare Pages
2. **Configure build settings** in the Pages dashboard:
   - **Build command**: `curl -fsSL https://deno.land/install.sh | sh -s v2.1.4 && export PATH=$HOME/.deno/bin:$PATH && deno run -A --node-modules-dir npm:vite build`
   - **Build output directory**: `dist`
   - **Root directory**: `/` (default)
3. **Deploy** - No additional configuration needed!

The `wrangler.toml` file ensures proper Pages configuration with `pages_build_output_dir = "dist"`.

### As a Library
```typescript
import { PokemonSaveParser } from './src/lib/parser/core/PokemonSaveParser.ts'

const parser = new PokemonSaveParser()
const saveData = await parser.parse(fileArrayBuffer)
console.log(`Player: ${saveData.player_name}`)
```

```typescript
import { MgbaWebSocketClient } from './src/lib/mgba/websocket-client.ts'

// Connect to mGBA emulator
const client = new MgbaWebSocketClient()
await client.connect()

// Parse save data from memory
const parser = new PokemonSaveParser()
const saveData = await parser.parse(client)

console.log(`Player: ${saveData.player_name}`)
console.log(`Party: ${saveData.party_pokemon.length} Pokémon`)
```

### Real-time Memory Synchronization

The WebSocket client supports **push-based memory updates** instead of constant polling:

- **Memory Watching**: Configure regions to watch and receive updates only when they change
- **Intelligent Caching**: Watched regions use cached data, dramatically reducing network calls
- **Real-time Notifications**: React to memory changes as they happen in the emulator
- **Backward Compatibility**: All existing eval-based functionality remains unchanged

For detailed documentation, see [src/lib/mgba/README.md](./src/lib/mgba/README.md).

## Usage

### 1. Web Application

The main web application provides a user-friendly interface for uploading and analyzing save files.

```bash
deno task dev      # Start development server
deno task build    # Build for production (includes PWA)
deno task preview  # Preview PWA build locally
```

**Features:**
- Drag-and-drop save file upload
- Interactive Pokemon data visualization  
- Real-time editing capabilities
- File System Access API support for modern browsers
- **PWA Support**: Install as native app with offline functionality
- **Optimized Performance**: Code splitting and smart caching

### 2. JavaScript/TypeScript Library

Use the parser as a library in your own projects with full TypeScript support.

```typescript
import { PokemonSaveParser } from './lib/parser'

// Auto-detect game type and parse
const parser = new PokemonSaveParser()
const saveData = await parser.parseSaveFile(file)
console.log(`Player: ${saveData.player_name}`)
console.log(`Party size: ${saveData.party_pokemon.length}`)

// Manual configuration
const config = new QuetzalConfig()
const parser = new PokemonSaveParser(undefined, config)
```

### 3. Command Line Interface

Parse save files from the command line with multiple output formats.

```bash
# Local usage
deno task parse save.sav --debug

# NPX usage (direct from GitHub)  
npx github:JohnDeved/pokemon-save-web save.sav --graph
```

**CLI Options:**
- `--debug` - Show raw bytes for each party Pokemon after the summary table
- `--graph` - Show colored hex/field graph for each party Pokemon
- `--watch` - Continuously monitor for changes and update display
- `--websocket` - Connect to mGBA via WebSocket instead of reading a file
- `--ws-url=URL` - WebSocket URL (default: ws://localhost:7102/ws)
- `--interval=MS` - Update interval in milliseconds for file watch mode (default: 1000)
- `--toBytes=STRING` - Convert a string to GBA byte encoding
- `--toString=HEX` - Convert space/comma-separated hex bytes to a decoded GBA string

**Event-Driven Watch Mode:**

For real-time Pokemon data monitoring, use WebSocket mode with watch:

```bash
# Event-driven real-time monitoring (push-based)
npx github:JohnDeved/pokemon-save-web --websocket --watch

# Traditional file watching (polling-based) 
npx github:JohnDeved/pokemon-save-web save.sav --watch --interval=2000
```

**WebSocket Watch Mode Features:**
- **Push-based Updates**: Instant notifications when party data changes (no polling!)
- **Memory Region Watching**: Monitors specific memory addresses for Pokemon party data
- **Real-time Display**: Updates immediately when Pokemon HP, level, or party composition changes
- **Zero Network Overhead**: Only receives data when memory actually changes
- **Intelligent Caching**: Uses cached data for watched regions, reducing emulator load

The WebSocket watch mode automatically configures memory watching for:
- Party count and context data (address 0x20244e9, 7 bytes)
- Full party Pokemon data (address 0x20244ec, 600 bytes)

When connected to mGBA emulator, the CLI will display live updates as you play!

## Adding Game Support

The parser uses a flexible GameConfig system that makes it easy to add support for new Pokemon games and ROM hacks.

```typescript
export class MyGameConfig implements GameConfig {
  readonly name = 'My Pokemon Game'
  readonly signature = 0x12345678
  readonly offsets = { /* game-specific offsets */ }
  readonly mappings = { /* pokemon/item/move mappings */ }
  
  canHandle(saveData: Uint8Array): boolean {
    // Detection logic
  }
  
  determineActiveSlot(getCounterSum: (range: number[]) => number): number {
    // Slot selection logic
  }
}
```

For detailed instructions, see [src/lib/parser/README.md](./src/lib/parser/README.md#adding-game-support).

## PWA (Progressive Web App)

This application is built as a PWA with:

- **Offline Support**: Edit previously loaded save files without internet
- **Native Installation**: Install on desktop and mobile devices
- **Performance Optimized**: Smart caching and code splitting
- **SEO Optimized**: Complete meta tags and search engine support

See [PWA_IMPLEMENTATION.md](./PWA_IMPLEMENTATION.md) for detailed PWA features and technical implementation.

## Performance

The app uses advanced optimization techniques:

- **Code Splitting**: Vendor libraries, UI components, and 3D assets are loaded separately
- **Lazy Loading**: 3D shader background loads only when needed
- **Smart Caching**: Service worker caches assets and fonts for fast loading
- **Bundle Analysis**: Optimized chunk sizes for better caching strategies

## License

MIT License - see [LICENSE](LICENSE) file for details.
