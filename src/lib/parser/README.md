# Pokemon Save Parser

A modular TypeScript parser for Pokemon Emerald save files with dependency injection support for different game configurations.

## File Structure

```
src/lib/parser/
├── core/                     # Core parsing logic
│   ├── pokemonSaveParser.ts  # Main parser class
│   ├── types.ts              # Type definitions
│   ├── utils.ts              # Utility functions
│   └── index.ts              # Core exports
├── configs/                  # Configuration system
│   ├── GameConfig.ts         # GameConfig interface
│   ├── autoDetect.ts         # Auto-detection logic
│   └── index.ts              # Config exports
├── games/                    # Game-specific configurations
│   ├── quetzal/              # Pokemon Quetzal ROM hack
│   │   ├── config.ts         # QuetzalConfig implementation
│   │   ├── data/            # Quetzal-specific data files
│   │   │   ├── item_map.json
│   │   │   ├── move_map.json
│   │   │   └── pokemon_map.json
│   │   └── index.ts
│   └── vanilla/              # Vanilla Pokemon Emerald
│       ├── config.ts         # VanillaConfig implementation
│       └── index.ts
├── data/                     # Shared data files
│   └── pokemon_charmap.json  # Character encoding map
├── __tests__/                # Test suite
│   ├── pokemonSaveParser.integration.test.ts
│   ├── pokemonSaveParser.unit.test.ts
│   └── test_data/           # Test fixtures
├── cli.ts                    # Command-line interface
├── index.ts                  # Main exports
└── README.md                 # This file
```

## Architecture

### Core Components

- **PokemonSaveParser**: Main parser class with dependency injection
- **GameConfig**: Interface for game-specific configurations  
- **PokemonData**: Class representing individual Pokemon data

### Game-Specific Configurations

Each game/ROM hack has its own configuration implementing the `GameConfig` interface:

- **QuetzalConfig**: Pokemon Quetzal ROM hack configuration
- **VanillaConfig**: Vanilla Pokemon Emerald configuration (minimal stub)

### Auto-Detection

The parser can automatically detect the game type based on save file characteristics and select the appropriate configuration.

## Usage

### Basic Auto-Detection
```typescript
import { PokemonSaveParser } from './parser'

const parser = new PokemonSaveParser()
const saveData = await parser.parseSaveFile(file)
console.log(`Detected: ${parser.getGameConfig()?.name}`)
```

### Manual Configuration
```typescript
import { PokemonSaveParser, QuetzalConfig } from './parser'

const config = new QuetzalConfig()
const parser = new PokemonSaveParser(undefined, config)
const saveData = await parser.parseSaveFile(file)
```

### Adding New Games

1. Create a new directory under `games/`
2. Implement the `GameConfig` interface
3. Add game-specific data files
4. Register in auto-detection system

## Benefits

- ✅ **Modular Structure**: Clean separation of concerns
- ✅ **Type-Safe**: Full TypeScript implementation
- ✅ **Testable**: Comprehensive test coverage (28/28 tests passing)
- ✅ **Extensible**: Easy to add new Pokemon games/ROM hacks
- ✅ **Backward Compatible**: Existing code continues to work

## Testing

Run the full test suite:
```bash
npm test
```

Tests include:
- Unit tests for core functionality
- Integration tests with real save files
- Auto-detection validation