# GameConfig System

## Overview

The Pokemon Save Parser uses dependency injection to support multiple Pokemon games and ROM hacks. This separates game-specific logic from the core parser.

## Architecture

- **GameConfig Interface** - Contract for game-specific configurations
- **PokemonSaveParser** - Main parser that accepts GameConfig via dependency injection
- **Auto-Detection** - Automatically selects appropriate configurations
- **BasePokemonData** - Abstract base class for game-specific Pokemon data

## Available Configurations

- **QuetzalConfig** - Pokemon Quetzal ROM hack with complete mappings
- **VanillaConfig** - Basic Pokemon Emerald implementation

## Basic Usage

```typescript
import { PokemonSaveParser } from './parser'

// Auto-detect game type
const parser = new PokemonSaveParser()
const saveData = await parser.parseSaveFile(file)
console.log(`Detected game: ${parser.getGameConfig()?.name}`)

// Manual config injection
const config = new QuetzalConfig()
const parser = new PokemonSaveParser(undefined, config)
```

## Adding New Games

For detailed instructions on creating new GameConfig implementations, see the [Parser README](../src/lib/parser/README.md#adding-game-support).

The process involves:
1. Creating a GameConfig implementation
2. Creating a Pokemon data class
3. Registering the configuration
4. Adding tests

## Key Interface

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