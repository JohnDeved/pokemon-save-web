# GameConfig Dependency Injection System

## Overview

The Pokemon Save Parser has been refactored to use dependency injection for game-specific configurations. This allows the parser to support multiple Pokemon games and ROM hacks without hardcoding specific offsets, mappings, or parsing logic.

## Architecture

### Core Components

1. **GameConfig Interface** (`GameConfig.ts`)
   - Defines the contract for game-specific configurations
   - Contains offsets, mappings, signatures, and game-specific logic
   - All game configs must implement this interface

2. **PokemonSaveParser** (`pokemonSaveParser.ts`)
   - Main parser class that accepts GameConfig via dependency injection
   - Can auto-detect game type if no config is provided
   - Uses injected config for all game-specific operations

3. **Auto-Detection** (`autoDetect.ts`)
   - Automatically detects the appropriate GameConfig for a save file
   - Tests configs in priority order (specific ROM hacks before vanilla)
   - Returns the first matching config or null if none match

### Available Configurations

1. **QuetzalConfig** (`QuetzalConfig.ts`)
   - Configuration for Pokemon Quetzal ROM hack
   - Contains all Quetzal-specific offsets and mappings
   - Includes the Pokemon, item, and move mappings from the original JSON files

2. **VanillaConfig** (`VanillaConfig.ts`)
   - Basic configuration for vanilla Pokemon Emerald
   - Minimal implementation with placeholder mappings
   - Serves as an example for creating new configs

## Usage

### Basic Usage with Auto-Detection

```typescript
import { PokemonSaveParser } from './parser'

// Parser will auto-detect the game type
const parser = new PokemonSaveParser()
const saveData = await parser.parseSaveFile(file)
console.log(`Detected game: ${parser.getGameConfig()?.name}`)
```

### Manual Config Injection

```typescript
import { PokemonSaveParser, QuetzalConfig } from './parser'

// Use specific config
const config = new QuetzalConfig()
const parser = new PokemonSaveParser(undefined, config)
const saveData = await parser.parseSaveFile(file)
```

### Available Functions

```typescript
import { 
  autoDetectGameConfig, 
  getAllGameConfigs, 
  createGameConfigByName 
} from './autoDetect'

// Auto-detect config from save data
const config = autoDetectGameConfig(saveData)

// Get all available configs
const allConfigs = getAllGameConfigs()

// Create config by name
const quetzalConfig = createGameConfigByName('Pokemon Quetzal')
```

## Adding Support for New Games

### Step 1: Create a New Config Class

Create a new file implementing the GameConfig interface:

```typescript
// NewGameConfig.ts
import type { GameConfig, PokemonMapping, ItemMapping, MoveMapping } from './GameConfig.js'

export class NewGameConfig implements GameConfig {
  readonly name = 'My New Pokemon Game'
  readonly signature = 0x12345678 // Game-specific signature
  
  readonly offsets = {
    sectorSize: 4096,
    sectorDataSize: 3968,
    sectorFooterSize: 12,
    saveblock1Size: 3968 * 4,
    sectorsPerSlot: 18,
    totalSectors: 32,
    partyStartOffset: 0x500, // Game-specific offset
    partyPokemonSize: 104,
    maxPartySize: 6,
    pokemonNicknameLength: 10,
    pokemonTrainerNameLength: 7,
    playTimeHours: 0x20,     // Game-specific offsets
    playTimeMinutes: 0x24,
    playTimeSeconds: 0x25,
  } as const

  readonly mappings = {
    pokemon: this.createPokemonMap(),
    items: this.createItemMap(),
    moves: this.createMoveMap(),
  } as const

  private createPokemonMap(): ReadonlyMap<number, PokemonMapping> {
    // Load your game's Pokemon mappings
    // This could be from JSON files, databases, or hardcoded
    const map = new Map<number, PokemonMapping>()
    // Add your mappings...
    return map
  }

  private createItemMap(): ReadonlyMap<number, ItemMapping> {
    // Load your game's item mappings
    const map = new Map<number, ItemMapping>()
    // Add your mappings...
    return map
  }

  private createMoveMap(): ReadonlyMap<number, MoveMapping> {
    // Load your game's move mappings
    const map = new Map<number, MoveMapping>()
    // Add your mappings...
    return map
  }

  determineActiveSlot(getCounterSum: (range: number[]) => number): number {
    // Implement game-specific slot selection logic
    // Most GBA Pokemon games use the same logic as Emerald:
    const slot1Range = Array.from({ length: 18 }, (_, i) => i)
    const slot2Range = Array.from({ length: 18 }, (_, i) => i + 14)
    const slot1Sum = getCounterSum(slot1Range)
    const slot2Sum = getCounterSum(slot2Range)
    
    return slot2Sum >= slot1Sum ? 14 : 0
  }

  canHandle(saveData: Uint8Array): boolean {
    // Implement detection logic for your game
    // Check file size, signatures, or other identifying characteristics
    
    if (saveData.length < this.offsets.totalSectors * this.offsets.sectorSize) {
      return false
    }

    // Check for your game's signature
    for (let i = 0; i < this.offsets.totalSectors; i++) {
      const footerOffset = (i * this.offsets.sectorSize) + 
                           this.offsets.sectorSize - this.offsets.sectorFooterSize
      
      if (footerOffset + this.offsets.sectorFooterSize > saveData.length) {
        continue
      }

      try {
        const view = new DataView(saveData.buffer, saveData.byteOffset + footerOffset, 
                                  this.offsets.sectorFooterSize)
        const signature = view.getUint32(4, true)
        
        if (signature === this.signature) {
          // Additional checks to differentiate from other games
          // with the same base signature
          return this.isSpecificGame(saveData)
        }
      } catch {
        continue
      }
    }

    return false
  }

  private isSpecificGame(saveData: Uint8Array): boolean {
    // Add additional detection logic specific to your game
    // For example, check for specific data patterns, version numbers, etc.
    return true
  }
}
```

### Step 2: Register Your Config

Add your config to the auto-detection system in `autoDetect.ts`:

```typescript
// autoDetect.ts
import { NewGameConfig } from './NewGameConfig.js'

const AVAILABLE_CONFIGS: readonly (() => GameConfig)[] = [
  () => new NewGameConfig(),  // Add your config here
  () => new QuetzalConfig(),
  () => new VanillaConfig(),  // Keep vanilla as fallback
] as const
```

**Important**: Place specific ROM hacks before more generic configs. The auto-detection tests configs in order and returns the first match.

### Step 3: Export Your Config

Add your config to the main exports in `index.ts`:

```typescript
// index.ts
export { NewGameConfig } from './NewGameConfig.js'
```

### Step 4: Create Tests

Create tests for your new config:

```typescript
// __tests__/newGameConfig.test.ts
import { describe, expect, it } from 'vitest'
import { NewGameConfig } from '../NewGameConfig'
import { PokemonSaveParser } from '../pokemonSaveParser'

describe('NewGameConfig', () => {
  it('should create config with correct properties', () => {
    const config = new NewGameConfig()
    expect(config.name).toBe('My New Pokemon Game')
    expect(config.signature).toBe(0x12345678)
  })

  it('should work with parser', () => {
    const config = new NewGameConfig()
    const parser = new PokemonSaveParser(undefined, config)
    expect(parser.getGameConfig()).toBe(config)
  })

  // Add tests for your specific game's save files
})
```

## Key Considerations

### Offset Discovery

To find the correct offsets for your game:

1. **Party Start Offset**: Look for the Pokemon data structure in a hex editor
2. **Play Time Offsets**: Find where hours/minutes/seconds are stored
3. **Signature**: Check sector footers for the game's signature
4. **Sector Layout**: Most GBA Pokemon games use the same sector structure

### Mappings

Your mappings should convert between:
- Internal game IDs → Standard Pokemon API IDs
- Internal item IDs → Standard item names/IDs  
- Internal move IDs → Standard move names/IDs

### Detection Logic

Make your `canHandle()` method as specific as possible to avoid false positives:
- Check file signatures
- Verify expected data patterns
- Look for version-specific identifiers
- Validate sector structures

### Backward Compatibility

The system maintains backward compatibility:
- `CONSTANTS` object still exists for legacy code
- Old function signatures are deprecated but still work
- Existing tests continue to pass

## Troubleshooting

### Config Not Detected

If auto-detection isn't working:
1. Check that your `canHandle()` method is correctly implemented
2. Verify your config is registered in `AVAILABLE_CONFIGS`
3. Ensure your config is placed before more generic ones
4. Add debug logging to see what's being checked

### Incorrect Parsing

If parsing fails with your config:
1. Verify all offsets are correct for your game
2. Check that sector structure matches expectations
3. Ensure mappings are properly loaded
4. Test with known good save files

### Type Errors

If you encounter TypeScript errors:
1. Ensure all interface methods are implemented
2. Check that mapping types match the interface
3. Verify readonly properties are properly defined
4. Make sure all required fields are present

## Future Enhancements

The system is designed to be extensible:

- **Dynamic Config Loading**: Configs could be loaded from external files
- **Plugin System**: Third-party configs could be dynamically registered
- **Config Validation**: Runtime validation of config properties
- **Multiple Game Support**: Single parser instance handling multiple game types
- **Save Conversion**: Converting saves between different game formats