# Pokemon Save Parser

A modern TypeScript library for parsing and editing Pokemon save files with dependency injection for game-specific configurations.

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Supported Games](#supported-games)
- [API Reference](#api-reference)
- [Adding Game Support](#adding-game-support)
- [Configuration System](#configuration-system)
- [Testing](#testing)
- [Legacy Support](#legacy-support)

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

## Supported Games

- **Pokemon Quetzal** - Full support with unencrypted IVs and custom shiny logic
- **Pokemon Emerald (Vanilla)** - Basic support with encrypted data handling

## Adding Game Support

### 1. Create Configuration Class

```typescript
export class MyGameConfig implements GameConfig {
  readonly name = 'My Pokemon Game'
  readonly signature = 0x12345678
  
  readonly offsets = {
    // Define all memory offsets...
    partyStartOffset: 0x500,
    partyPokemonSize: 104,
    maxPartySize: 6,
    // ... more offsets
  }
  
  readonly mappings = {
    // Define ID mappings...
    pokemon: this.createPokemonMap(),
    items: this.createItemMap(),
    moves: this.createMoveMap(),
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

### 2. Create Pokemon Data Class

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

### 3. Register Configuration

```typescript
// games/registry.ts
export const AVAILABLE_CONFIGS = [
  () => new MyGameConfig(),
  () => new QuetzalConfig(),
  () => new VanillaConfig(),
]
```

For detailed instructions, see [../../docs/GameConfig.md](../../docs/GameConfig.md).

## Configuration System

The `GameConfig` interface provides standardized access to:

- **Memory offsets** - All save file structure information
- **ID mappings** - Pokemon, item, and move ID translations  
- **Active slot detection** - Logic for determining current save
- **Game detection** - Signature-based save file recognition
- **Pokemon data factory** - Creates appropriate Pokemon data instances

### Auto-Detection

The auto-detection system:
1. Tests each registered config in priority order
2. Uses `canHandle()` method to identify compatible games
3. Returns the first matching config
4. Prioritizes specific ROM hacks over vanilla games

```typescript
import { autoDetectGameConfig } from './core/autoDetect'

const config = autoDetectGameConfig(saveData)
if (config) {
  console.log(`Detected: ${config.name}`)
}
```

## API Reference

### PokemonSaveParser

The main parser class with auto-detection and file handling capabilities.

```typescript
class PokemonSaveParser {
  constructor(saveData?: Uint8Array, config?: GameConfig)
  
  async parseSaveFile(file: File): Promise<SaveData>
  reconstructSaveFile(saveData: SaveData): Uint8Array
  getGameConfig(): GameConfig | null
}
```

**Example Usage:**
```typescript
// Auto-detection
const parser = new PokemonSaveParser()
const saveData = await parser.parseSaveFile(file)

// Manual config
const config = new QuetzalConfig()
const parser = new PokemonSaveParser(undefined, config)
```

### BasePokemonData

Abstract base class providing common Pokemon data functionality.

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

### GameConfig Interface

Contract for game-specific configurations.

```typescript
interface GameConfig {
  readonly name: string
  readonly signature: number
  readonly offsets: GameOffsets
  readonly mappings: GameMappings
  
  determineActiveSlot(getCounterSum: (range: number[]) => number): number
  canHandle(saveData: Uint8Array): boolean
  createPokemonData(data: Uint8Array): BasePokemonData
}
```

## Testing

Run the comprehensive test suite:

```bash
npm test                # Watch mode
npm run test:run        # Run once
npm run test:ui         # Interactive UI
```

**Test Coverage:**
- **Unit tests** - Core functionality and components
- **Integration tests** - Real save files with ground truth validation
- **Auto-detection** - Game type identification accuracy
- **Save reconstruction** - Round-trip parsing verification

**Test Files:**
- `pokemonSaveParser.unit.test.ts` - Parser unit tests
- `pokemonSaveParser.integration.test.ts` - Integration tests with real saves
- `cli.test.ts` - Command line interface tests

## Legacy Support

The library maintains backward compatibility:

```typescript
// Legacy constants still available
import { CONSTANTS } from './parser'

// Old parsing patterns continue to work
const parser = new PokemonSaveParser()
```

## Dependencies

- **TypeScript** - Type safety and modern JavaScript features
- **Vitest** - Fast testing framework
- **ESLint** - Code quality and consistency

## Troubleshooting

### Common Issues

**Config Not Detected:**
- Verify `canHandle()` method implementation
- Check config registration in `AVAILABLE_CONFIGS`
- Ensure config is placed before more generic ones

**Parsing Errors:**
- Verify all offsets are correct for your game
- Check save file format and structure
- Test with known good save files

**Type Errors:**
- Ensure all interface methods are implemented
- Check mapping types match the interface
- Verify readonly properties are properly defined

For more detailed troubleshooting, see the main documentation.