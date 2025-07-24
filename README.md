# Pokemon Save Web

A modern web-based Pokemon save file editor and parser built with React, TypeScript, and Vite. Supports multiple Pokemon games and ROM hacks through a flexible dependency injection system.

## Features

- **Multi-Game Support** - Pokemon Quetzal and vanilla Pokemon Emerald with auto-detection
- **Dependency Injection** - Extensible GameConfig system for adding new games/ROM hacks
- **Browser-Based** - Works entirely in the browser with no server required
- **Type-Safe** - Full TypeScript implementation with comprehensive type definitions
- **Modern UI** - Built with React 19 and modern web technologies
- **CLI Tool** - Command line interface for batch processing and automation

## Quick Start

### Web Application
```bash
npm install
npm run dev
```
Open your browser and drag & drop a Pokemon save file to get started.

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
npm run build  # Build for production
```

**Features:**
- Drag-and-drop save file upload
- Interactive Pokemon data visualization  
- Real-time editing capabilities
- File System Access API support for modern browsers

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

## Development

```bash
npm install
npm run dev          # Start development server
npm run build        # Build for production
npm run test         # Run tests with watch mode
npm run test:run     # Run tests once
npm run lint         # Lint code
npm run parse <file> # Parse save file via CLI
```

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

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Add tests for new functionality
4. Ensure all tests pass (`npm run test:run`)
5. Lint your code (`npm run lint`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Built with ❤️ for the Pokemon community**
