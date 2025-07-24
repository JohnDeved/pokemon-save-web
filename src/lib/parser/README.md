# Pokemon Save Parser

A modern TypeScript library for parsing and editing Pokemon save files with dependency injection for game-specific configurations.

## Features

- **Multi-game support** - Extensible architecture for Pokemon Emerald, ROM hacks like Quetzal, and more
- **Type-safe** - Full TypeScript implementation with comprehensive interfaces
- **Auto-detection** - Automatically detects game type from save file characteristics
- **Dependency injection** - Clean separation of game-specific logic and data
- **Real-time editing** - Parse, modify, and reconstruct save files
- **Comprehensive tests** - 28 tests ensuring reliability and accuracy

## Quick Start

```typescript
import { PokemonSaveParser } from './parser'

// Auto-detect game and parse save file
const parser = new PokemonSaveParser()
const saveData = await parser.parseSaveFile(file)

console.log(`Game: ${parser.getGameConfig()?.name}`) // "Pokemon Quetzal"
console.log(`Player: ${saveData.player_name}`)
console.log(`Party size: ${saveData.party_pokemon.length}`)

// Access Pokemon data
const firstPokemon = saveData.party_pokemon[0]
console.log(`${firstPokemon.nickname} - Level ${firstPokemon.level}`)
console.log(`Stats: ${firstPokemon.stats}`)
console.log(`IVs: ${firstPokemon.ivs}`)
```

## Architecture

### Core Components

- **`PokemonSaveParser`** - Main parser with auto-detection and file handling
- **`GameConfig`** - Interface for game-specific configurations and mappings
- **`BasePokemonData`** - Abstract base class for Pokemon data with common functionality
- **Auto-detection** - Automatically selects appropriate game configuration

### Supported Games

- **Pokemon Quetzal** - Full support with unencrypted IVs and custom shiny logic
- **Pokemon Emerald (Vanilla)** - Basic support with encrypted data handling

### File Structure

```
src/lib/parser/
├── core/                    # Core parser logic
│   ├── pokemonSaveParser.ts # Main parser class
│   ├── pokemonData.ts       # Abstract Pokemon data class
│   ├── types.ts             # TypeScript interfaces and GameConfig
│   ├── utils.ts             # Utility functions
│   └── autoDetect.ts        # Game auto-detection
├── games/                   # Game-specific configurations
│   ├── registry.ts          # Available game configurations
│   ├── quetzal/            # Pokemon Quetzal support
│   │   ├── config.ts       # Quetzal configuration and Pokemon data
│   │   └── data/           # Quetzal mappings (pokemon, items, moves)
│   └── vanilla/            # Pokemon Emerald support
│       └── config.ts       # Vanilla configuration and Pokemon data
├── data/                   # Shared data files
│   └── pokemon_charmap.json
└── __tests__/              # Comprehensive test suite
```

## Adding New Game Support

1. **Create a new game configuration:**

```typescript
export class MyGameConfig implements GameConfig {
  readonly name = 'My Pokemon Game'
  readonly signature = 0x12345678
  
  readonly offsets = {
    // Define all memory offsets...
  }
  
  readonly mappings = {
    // Define ID mappings...
  }
  
  determineActiveSlot(getCounterSum) {
    // Implement slot detection logic
  }
  
  canHandle(saveData) {
    // Implement detection logic
  }
  
  createPokemonData(data) {
    return new MyGamePokemonData(data, this)
  }
}
```

2. **Create game-specific Pokemon data class:**

```typescript
class MyGamePokemonData extends BasePokemonData {
  get ivs() {
    // Implement IV reading logic
  }
  
  get isShiny() {
    // Implement shiny detection
  }
  
  // Add game-specific properties...
}
```

3. **Register in games registry:**

```typescript
// games/registry.ts
export const AVAILABLE_CONFIGS = [
  () => new MyGameConfig(),
  () => new QuetzalConfig(),
  () => new VanillaConfig(),
]
```

## Configuration System

The `GameConfig` interface provides:

- **Memory offsets** - All save file structure information
- **ID mappings** - Pokemon, item, and move ID translations  
- **Active slot detection** - Logic for determining current save
- **Game detection** - Signature-based save file recognition
- **Pokemon data factory** - Creates appropriate Pokemon data instances

## API Reference

### PokemonSaveParser

```typescript
class PokemonSaveParser {
  constructor(saveData?: Uint8Array, config?: GameConfig)
  
  async parseSaveFile(file: File): Promise<SaveData>
  reconstructSaveFile(saveData: SaveData): Uint8Array
  getGameConfig(): GameConfig | null
}
```

### BasePokemonData

```typescript
abstract class BasePokemonData {
  // Core properties
  readonly personality: number
  readonly otId: number
  readonly speciesId: number
  readonly level: number
  readonly stats: readonly number[]
  readonly evs: readonly number[]
  readonly moves: PokemonMoves
  
  // Abstract methods (game-specific)
  abstract get ivs(): readonly number[]
  abstract get isShiny(): boolean
  abstract get shinyNumber(): number
}
```

## Testing

Run the test suite:

```bash
npm test
```

Tests include:
- Unit tests for core functionality
- Integration tests with real save files
- Auto-detection validation
- Save file reconstruction verification

## Dependencies

- **TypeScript** - Type safety and modern JavaScript features
- **Vitest** - Fast testing framework
- **ESLint** - Code quality and consistency

## Legacy Support

The library maintains backward compatibility with existing code:

```typescript
// Legacy constants still available
import { CONSTANTS } from './parser'

// Old parsing patterns continue to work
const parser = new PokemonSaveParser()
```