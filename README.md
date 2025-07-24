# Pokemon Save Web

A modern web-based Pokemon save file editor and parser built with React, TypeScript, and Vite. Supports multiple Pokemon games and ROM hacks through a flexible dependency injection system.

## Features

- **Multi-Game Support**: Supports Pokemon Quetzal and vanilla Pokemon Emerald with auto-detection
- **Dependency Injection**: Extensible GameConfig system for adding new games/ROM hacks
- **Browser-Based**: Works entirely in the browser with no server required
- **Type-Safe**: Full TypeScript implementation with comprehensive type definitions
- **Modern UI**: Built with React 19 and modern web technologies

## Pokemon Save Parser

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

### CLI Tool

Parse save files from the command line:

```bash
npm run parse save.sav
npm run parse save.sav --debug
npm run parse save.sav --graph
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
