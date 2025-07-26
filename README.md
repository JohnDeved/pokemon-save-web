# Pokemon Save Web

A web-based Pokemon save file editor, CLI tool, and TypeScript parser core with PWA support.

## 🚀 Features

- **Progressive Web App (PWA)**: Install for offline use and app-like experience
- **Multi-Game Support**: Works with various Pokemon games and ROM hacks
- **Real-time Editing**: Interactive Pokemon data visualization and editing
- **File System Integration**: Modern browser file API support
- **Cross-Platform**: Web, CLI, and library usage

## Quick Start

### Web Application (PWA)
```bash
npm install
npm run dev
```
Open your browser and drag & drop a Pokemon save file to get started.

**PWA Features:**
- 📱 Install as native app on desktop and mobile
- 🔄 Works offline with previously loaded save files
- ⚡ Fast loading with optimized caching
- 🎨 Native app-like interface and theming

### Command Line
```bash
# Parse a save file
npx github:JohnDeved/pokemon-save-web save.sav

# With debug output
npx github:JohnDeved/pokemon-save-web save.sav --debug
```

### As a Library
```typescript
import { PokemonSaveParser } from './lib/parser'

const parser = new PokemonSaveParser()
const saveData = await parser.parseSaveFile(file)
console.log(`Player: ${saveData.player_name}`)
```

## Usage

### 1. Web Application

The main web application provides a user-friendly interface for uploading and analyzing save files.

```bash
npm install
npm run dev    # Start development server
npm run build  # Build for production (includes PWA)
npm run preview # Preview PWA build locally
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
npm run parse save.sav --debug

# NPX usage (direct from GitHub)  
npx github:JohnDeved/pokemon-save-web save.sav --graph
```

**CLI Options:**
- `--debug` - Show raw bytes for each party Pokemon after the summary table
- `--graph` - Show colored hex/field graph for each party Pokemon
- `--toBytes=STRING` - Convert a string to GBA byte encoding
- `--toString=HEX` - Convert space/comma-separated hex bytes to a decoded GBA string

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
