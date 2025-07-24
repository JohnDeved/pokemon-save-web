# Pokemon Save Parser

A modern TypeScript library for parsing and editing Pokemon save files with dependency injection for game-specific configurations.

## Features

- **Multi-game support** - Extensible architecture for Pokemon Emerald, ROM hacks like Quetzal, and more
- **Type-safe** - Full TypeScript implementation with comprehensive interfaces
- **Auto-detection** - Automatically detects game type from save file characteristics
- **Dependency injection** - Clean separation of game-specific logic and data
- **Real-time editing** - Parse, modify, and reconstruct save files

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
│   └── vanilla/            # Pokemon Emerald support
├── data/                   # Shared data files
└── __tests__/              # Comprehensive test suite
```

## Supported Games

- **Pokemon Quetzal** - Full support with unencrypted IVs and custom shiny logic
- **Pokemon Emerald (Vanilla)** - Basic support with encrypted data handling

## Adding Game Support

The parser uses a flexible GameConfig system. Here's how to add support for new Pokemon games:

### Step 1: Create Configuration Class

```typescript
export class MyGameConfig implements GameConfig {
  readonly name = 'My Pokemon Game'
  readonly signature = 0x12345678
  
  readonly offsets = {
    // Define all memory offsets for your game
    partyStartOffset: 0x500,
    partyPokemonSize: 104,
    maxPartySize: 6,
    // ... more offsets
  }
  
  readonly mappings = {
    // Define ID mappings for your game
    pokemon: this.createPokemonMap(),
    items: this.createItemMap(),
    moves: this.createMoveMap(),
  }
  
  determineActiveSlot(getCounterSum: (range: number[]) => number): number {
    // Implement slot detection logic for your game
    const slot1Range = Array.from({ length: 18 }, (_, i) => i)
    const slot2Range = Array.from({ length: 18 }, (_, i) => i + 14)
    const slot1Sum = getCounterSum(slot1Range)
    const slot2Sum = getCounterSum(slot2Range)
    return slot2Sum >= slot1Sum ? 14 : 0
  }
  
  canHandle(saveData: Uint8Array): boolean {
    // Implement detection logic for your game
    if (saveData.length < this.offsets.totalSectors * this.offsets.sectorSize) {
      return false
    }
    // Add game-specific signature checks here
    return this.hasGameSignature(saveData)
  }
  
  createPokemonData(data: Uint8Array): BasePokemonData {
    return new MyGamePokemonData(data, this)
  }
}
```

### Step 2: Create Pokemon Data Class

```typescript
class MyGamePokemonData extends BasePokemonData {
  get ivs(): readonly number[] {
    // Implement IV reading logic for your game
    const offset = 0x20 // Example offset
    return [
      this.data[offset],     // HP
      this.data[offset + 1], // Attack
      this.data[offset + 2], // Defense
      this.data[offset + 3], // Speed
      this.data[offset + 4], // Sp. Attack
      this.data[offset + 5], // Sp. Defense
    ]
  }
  
  get isShiny(): boolean {
    // Implement shiny detection for your game
    const shinyValue = this.shinyNumber
    return shinyValue < 8 // Standard shiny threshold
  }
  
  get shinyNumber(): number {
    // Standard shiny calculation
    const trainerId = this.otId
    const personalityHigh = (this.personality >>> 16) & 0xFFFF
    const personalityLow = this.personality & 0xFFFF
    const trainerIdHigh = (trainerId >>> 16) & 0xFFFF
    const trainerIdLow = trainerId & 0xFFFF
    return personalityHigh ^ personalityLow ^ trainerIdHigh ^ trainerIdLow
  }
}
```

### Step 3: Register Configuration

```typescript
// games/registry.ts
export const AVAILABLE_CONFIGS = [
  () => new MyGameConfig(),  // Add your config (before more generic ones)
  () => new QuetzalConfig(),
  () => new VanillaConfig(),
]
```

### Step 4: Add Tests

```typescript
describe('MyGameConfig', () => {
  it('should detect compatible save files', () => {
    const config = new MyGameConfig()
    const validSaveData = createMockSaveData()
    expect(config.canHandle(validSaveData)).toBe(true)
  })
  
  it('should parse real save file', async () => {
    const saveFile = await loadTestSaveFile('my-game-save.sav')
    const config = new MyGameConfig()
    const parser = new PokemonSaveParser(saveFile, config)
    
    const result = parser.parseSaveData()
    expect(result.player_name).toBe('EXPECTED_NAME')
    expect(result.party_pokemon).toHaveLength(6)
  })
})
```

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