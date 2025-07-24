# Pokemon Save Web

A modern web-based Pokemon save file editor and parser built with React, TypeScript, and Vite. Supports multiple Pokemon games and ROM hacks through a flexible dependency injection system.

## Features

- **Multi-Game Support**: Supports Pokemon Quetzal and vanilla Pokemon Emerald with auto-detection
- **Dependency Injection**: Extensible GameConfig system for adding new games/ROM hacks
- **Browser-Based**: Works entirely in the browser with no server required
- **Type-Safe**: Full TypeScript implementation with comprehensive type definitions
- **Modern UI**: Built with React 19 and modern web technologies

## Usage

Pokemon Save Web provides three ways to work with Pokemon save files:

### 1. Browser Application (Web UI)

The main web application provides a user-friendly interface for uploading and analyzing save files:

```bash
npm run dev    # Start development server
npm run build  # Build for production
```

**Features:**
- Drag-and-drop save file upload
- Interactive Pokemon data visualization  
- Real-time editing capabilities
- Works entirely in the browser (no server required)
- File System Access API support for modern browsers

### 2. JavaScript/TypeScript Library

Use the parser as a library in your own projects:

```typescript
import { PokemonSaveParser } from './lib/parser'

// Auto-detect game type and parse
const parser = new PokemonSaveParser()
const saveData = await parser.parseSaveFile(file)
console.log(`Player: ${saveData.player_name}`)
console.log(`Party size: ${saveData.party_pokemon.length}`)
```

**Features:**
- Full TypeScript support with comprehensive types
- Dependency injection system for game configs
- Auto-detection of game types
- Extensible architecture for adding new games

### 3. Command Line Interface (CLI)

Parse save files from the command line with multiple output formats:

```bash
# Local usage
npm run parse save.sav --debug

# NPX usage (direct from GitHub)  
npx github:JohnDeved/pokemon-save-web save.sav --graph
```

**Features:**
- Multiple output formats (table, debug, graph)
- String encoding utilities
- Batch processing capabilities
- Works offline once installed

## CLI Tool

Parse Pokemon save files from the command line. The CLI supports multiple output formats and can be used locally or via npx.

#### Local Usage

```bash
# Install dependencies and run directly
npm install
npm run parse save.sav
npm run parse save.sav --debug
npm run parse save.sav --graph
```

#### NPX Usage (Direct from GitHub)

```bash
# Parse a save file directly from GitHub
npx github:JohnDeved/pokemon-save-web save.sav

# With various options
npx github:JohnDeved/pokemon-save-web save.sav --debug
npx github:JohnDeved/pokemon-save-web save.sav --graph
npx github:JohnDeved/pokemon-save-web --toBytes=PIKACHU
npx github:JohnDeved/pokemon-save-web --toString="50 49 4b 41 43 48 55 00"
```

#### CLI Options

- `--debug` - Show raw bytes for each party Pokémon after the summary table
- `--graph` - Show colored hex/field graph for each party Pokémon (instead of summary table)  
- `--toBytes=STRING` - Convert a string to GBA byte encoding and print the result
- `--toString=HEX` - Convert space/comma-separated hex bytes to a decoded GBA string

#### Output Formats

**Summary Table (Default)**
```bash
npx github:JohnDeved/pokemon-save-web save.sav
```
Shows a formatted table with Pokemon stats, HP bars, and trainer information.

**Debug Mode**
```bash
npx github:JohnDeved/pokemon-save-web save.sav --debug
```
Shows the summary table plus raw hex bytes for each Pokemon.

**Graph Mode**
```bash
npx github:JohnDeved/pokemon-save-web save.sav --graph
```
Shows a colored hex dump with field labels for detailed analysis.

**String Utilities**
```bash
# Convert text to GBA encoding
npx github:JohnDeved/pokemon-save-web --toBytes=RAYQUAZA

# Convert hex bytes to GBA string
npx github:JohnDeved/pokemon-save-web --toString="ca c3 c5 bb bd c2 cf"
```

#### Supported Save Files

The CLI auto-detects the game type and supports:
- Pokemon Quetzal (ROM hack)
- Pokemon Emerald (vanilla)
- Other games via the extensible GameConfig system

## Pokemon Save Parser Library

The core parser (`src/lib/parser/`) features a robust dependency injection system:

### Quick Start

```typescript
import { PokemonSaveParser } from './lib/parser'

// Auto-detect game type and parse
const parser = new PokemonSaveParser()
const saveData = await parser.parseSaveFile(file)
console.log(`Detected: ${parser.getGameConfig()?.name}`)
console.log(`Player: ${saveData.player_name}`)
console.log(`Party size: ${saveData.party_pokemon.length}`)
```

### Manual Game Config

```typescript
import { PokemonSaveParser, QuetzalConfig } from './lib/parser'

// Use specific game configuration
const config = new QuetzalConfig()
const parser = new PokemonSaveParser(undefined, config)
const saveData = await parser.parseSaveFile(file)
```

### Supported Games

- **Pokemon Quetzal**: Full support with complete mappings
- **Pokemon Emerald (Vanilla)**: Basic support (example implementation)

## Adding New Games

The parser uses a flexible GameConfig system. See [docs/GameConfig.md](./docs/GameConfig.md) for detailed instructions on adding support for new Pokemon games and ROM hacks.

### Example

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

## Development

### Setup

```bash
npm install
```

### Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run test         # Run tests
npm run test:ui      # Run tests with UI
npm run lint         # Lint code
npm run parse <file> # Parse save file via CLI
```

## Testing

Comprehensive test suite with both unit and integration tests:

- **Unit Tests**: Parser components, GameConfig implementations
- **Integration Tests**: Real save file parsing with ground truth validation
- **Auto-Detection Tests**: Verify correct game type detection

```bash
npm run test:run     # Run all tests
npm run test:ui      # Interactive test UI
```

## Architecture

### Core Components

- **GameConfig Interface**: Contract for game-specific configurations
- **PokemonSaveParser**: Main parser with dependency injection
- **Auto-Detection**: Automatic game type detection
- **QuetzalConfig/VanillaConfig**: Game-specific implementations

### Browser Compatibility

- Uses modern Web APIs (File System Access API when available)
- Fallback support for older browsers
- No server dependencies - runs entirely client-side

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

### Adding Game Support

To add support for a new Pokemon game:

1. Create a new GameConfig implementation
2. Add detection logic in `canHandle()`
3. Register in auto-detection system
4. Add tests with real save files
5. Update documentation

See [docs/GameConfig.md](./docs/GameConfig.md) for detailed instructions.

## License

[Add your license here]

---

Built with ❤️ for the Pokemon community
