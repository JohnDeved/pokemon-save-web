# GameConfig Developer Guide

A comprehensive guide for adding support for new Pokemon games and ROM hacks using the dependency injection system.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Detailed Implementation](#detailed-implementation)
- [Configuration Reference](#configuration-reference)
- [Detection Best Practices](#detection-best-practices)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Examples](#examples)

## Overview

The Pokemon Save Parser uses a dependency injection system to support multiple Pokemon games and ROM hacks. This design separates game-specific logic from the core parser, making it easy to add support for new games without modifying existing code.

### Benefits

- **Clean Separation** - Game-specific logic is isolated in configuration classes
- **Easy Extension** - Add new games by implementing the GameConfig interface
- **Auto-Detection** - Automatically identifies compatible game configurations
- **Type Safety** - Full TypeScript support with comprehensive interfaces
- **Backward Compatibility** - Existing code continues to work unchanged

## Architecture

### Core Components

1. **GameConfig Interface** - Contract defining game-specific configurations
2. **PokemonSaveParser** - Main parser accepting GameConfig via dependency injection
3. **Auto-Detection System** - Automatically selects appropriate configurations
4. **BasePokemonData** - Abstract base class for game-specific Pokemon data

### Available Configurations

- **QuetzalConfig** - Pokemon Quetzal ROM hack with complete mappings
- **VanillaConfig** - Pokemon Emerald vanilla (basic implementation)

## Quick Start

### Basic Usage with Auto-Detection

```typescript
import { PokemonSaveParser } from './parser'

// Parser automatically detects game type
const parser = new PokemonSaveParser()
const saveData = await parser.parseSaveFile(file)
console.log(`Detected game: ${parser.getGameConfig()?.name}`)
```

### Manual Configuration

```typescript
import { PokemonSaveParser, QuetzalConfig } from './parser'

// Use specific configuration
const config = new QuetzalConfig()
const parser = new PokemonSaveParser(undefined, config)
const saveData = await parser.parseSaveFile(file)
```

### Auto-Detection Functions

```typescript
import { 
  autoDetectGameConfig, 
  getAllGameConfigs, 
  createGameConfigByName 
} from './autoDetect'

// Auto-detect from save data
const config = autoDetectGameConfig(saveData)

// Get all available configurations
const allConfigs = getAllGameConfigs()

// Create configuration by name
const quetzalConfig = createGameConfigByName('Pokemon Quetzal')
```

## Detailed Implementation

### Step 1: Create Configuration Class

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
    const map = new Map<number, PokemonMapping>()
    // Add mappings: map.set(id, { name, types, baseStats, ... })
    return map
  }

  private createItemMap(): ReadonlyMap<number, ItemMapping> {
    // Load your game's item mappings
    const map = new Map<number, ItemMapping>()
    // Add mappings: map.set(id, { name, description, category, ... })
    return map
  }

  private createMoveMap(): ReadonlyMap<number, MoveMapping> {
    // Load your game's move mappings
    const map = new Map<number, MoveMapping>()
    // Add mappings: map.set(id, { name, type, power, accuracy, ... })
    return map
  }

  determineActiveSlot(getCounterSum: (range: number[]) => number): number {
    // Most GBA Pokemon games use this logic:
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

    // Check for game signature in sector footers
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
          return this.isSpecificGame(saveData)
        }
      } catch {
        continue
      }
    }

    return false
  }

  private isSpecificGame(saveData: Uint8Array): boolean {
    // Additional checks to differentiate from other games
    // with the same base signature
    return true
  }

  createPokemonData(data: Uint8Array): BasePokemonData {
    return new NewGamePokemonData(data, this)
  }
}
```

### Step 2: Create Pokemon Data Class

```typescript
// NewGamePokemonData.ts
import { BasePokemonData } from '../core/pokemonData.js'

class NewGamePokemonData extends BasePokemonData {
  constructor(data: Uint8Array, config: NewGameConfig) {
    super(data, config)
  }

  get ivs(): readonly number[] {
    // Implement IV reading logic for your game
    // This varies by game (encrypted vs unencrypted, location, etc.)
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
    // Standard formula for most games:
    const trainerId = this.otId
    const personalityHigh = (this.personality >>> 16) & 0xFFFF
    const personalityLow = this.personality & 0xFFFF
    const trainerIdHigh = (trainerId >>> 16) & 0xFFFF
    const trainerIdLow = trainerId & 0xFFFF
    
    const shinyValue = personalityHigh ^ personalityLow ^ trainerIdHigh ^ trainerIdLow
    return shinyValue < 8 // Standard shiny threshold
  }

  get shinyNumber(): number {
    // Return the shiny value for analysis
    const trainerId = this.otId
    const personalityHigh = (this.personality >>> 16) & 0xFFFF
    const personalityLow = this.personality & 0xFFFF
    const trainerIdHigh = (trainerId >>> 16) & 0xFFFF
    const trainerIdLow = trainerId & 0xFFFF
    
    return personalityHigh ^ personalityLow ^ trainerIdHigh ^ trainerIdLow
  }

  // Add game-specific properties as needed
  get customProperty(): any {
    // Example of game-specific data
    return this.data[0x50] // Example offset
  }
}
```

### Step 3: Register Configuration

Add your configuration to the auto-detection system:

```typescript
// games/registry.ts
import { NewGameConfig } from './NewGameConfig.js'

const AVAILABLE_CONFIGS: readonly (() => GameConfig)[] = [
  () => new NewGameConfig(),  // Add your config here (before more generic ones)
  () => new QuetzalConfig(),
  () => new VanillaConfig(),  // Keep vanilla as fallback
] as const
```

**Important:** Place specific ROM hacks before more generic configurations. Auto-detection tests configurations in order and returns the first match.

### Step 4: Export Configuration

Add your configuration to the main exports:

```typescript
// index.ts
export { NewGameConfig } from './NewGameConfig.js'
```

### Step 5: Create Tests

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

  // Add tests with real save files
  it('should parse real save file', async () => {
    // Test with actual save file data
  })
})
```

## Configuration Reference

### GameConfig Interface

```typescript
interface GameConfig {
  readonly name: string                           // Display name
  readonly signature: number                      // Game signature for detection
  readonly offsets: GameOffsets                   // Memory layout offsets
  readonly mappings: GameMappings                 // ID to data mappings
  
  determineActiveSlot(getCounterSum: (range: number[]) => number): number
  canHandle(saveData: Uint8Array): boolean
  createPokemonData(data: Uint8Array): BasePokemonData
}
```

### Required Offsets

```typescript
interface GameOffsets {
  // Sector structure
  sectorSize: number              // Usually 4096 for GBA games
  sectorDataSize: number          // Usually 3968
  sectorFooterSize: number        // Usually 12
  saveblock1Size: number          // Usually sectorDataSize * 4
  sectorsPerSlot: number          // Usually 18
  totalSectors: number            // Usually 32
  
  // Pokemon party data
  partyStartOffset: number        // Where party data begins
  partyPokemonSize: number        // Size of each Pokemon structure (100 or 104)
  maxPartySize: number            // Usually 6
  
  // String lengths
  pokemonNicknameLength: number   // Usually 10
  pokemonTrainerNameLength: number // Usually 7
  
  // Play time (optional)
  playTimeHours?: number
  playTimeMinutes?: number
  playTimeSeconds?: number
}
```

### Required Mappings

```typescript
interface GameMappings {
  pokemon: ReadonlyMap<number, PokemonMapping>
  items: ReadonlyMap<number, ItemMapping>
  moves: ReadonlyMap<number, MoveMapping>
}

interface PokemonMapping {
  name: string
  types: readonly [string, string?]
  baseStats: readonly number[]   // [HP, Atk, Def, SpAtk, SpDef, Speed]
  abilities: readonly string[]
  // ... other properties
}
```

## Detection Best Practices

### Signature-Based Detection

Most GBA Pokemon games use the same base signature (`0x08012025`), so additional checks are needed:

```typescript
canHandle(saveData: Uint8Array): boolean {
  // 1. Check file size
  if (saveData.length < this.offsets.totalSectors * this.offsets.sectorSize) {
    return false
  }

  // 2. Find sectors with correct signature
  const validSectors = this.findValidSectors(saveData)
  if (validSectors.length === 0) return false

  // 3. Add game-specific checks
  return this.isSpecificGame(saveData)
}

private isSpecificGame(saveData: Uint8Array): boolean {
  // Check for unique patterns, version strings, or data structures
  // that identify your specific game
  
  // Example: Check for specific Pokemon species in expected ranges
  // Example: Verify trainer name encoding format
  // Example: Check for ROM hack-specific data structures
  
  return true
}
```

### Common Detection Patterns

```typescript
// Check for specific version signature
private checkVersionSignature(saveData: Uint8Array): boolean {
  const versionOffset = 0xAC  // Example offset
  const expectedBytes = [0x12, 0x34, 0x56, 0x78]
  
  for (let i = 0; i < expectedBytes.length; i++) {
    if (saveData[versionOffset + i] !== expectedBytes[i]) {
      return false
    }
  }
  return true
}

// Check Pokemon species ID ranges
private checkPokemonRanges(saveData: Uint8Array): boolean {
  const partyOffset = this.offsets.partyStartOffset
  
  for (let i = 0; i < this.offsets.maxPartySize; i++) {
    const pokemonOffset = partyOffset + (i * this.offsets.partyPokemonSize)
    const speciesId = new DataView(saveData.buffer).getUint16(pokemonOffset, true)
    
    // Check if species ID is in expected range for your game
    if (speciesId > 0 && !this.mappings.pokemon.has(speciesId)) {
      return false
    }
  }
  return true
}
```

## Testing

### Unit Tests

```typescript
describe('MyGameConfig', () => {
  let config: MyGameConfig

  beforeEach(() => {
    config = new MyGameConfig()
  })

  it('should have correct name and signature', () => {
    expect(config.name).toBe('My New Pokemon Game')
    expect(config.signature).toBe(0x12345678)
  })

  it('should determine active slot correctly', () => {
    const mockGetCounterSum = vi.fn()
      .mockReturnValueOnce(100)  // slot 1
      .mockReturnValueOnce(150)  // slot 2
    
    const result = config.determineActiveSlot(mockGetCounterSum)
    expect(result).toBe(14) // slot 2 is newer
  })

  it('should detect compatible save files', () => {
    const validSaveData = createMockSaveData()
    expect(config.canHandle(validSaveData)).toBe(true)
  })

  it('should reject incompatible save files', () => {
    const invalidSaveData = new Uint8Array(1000) // Too small
    expect(config.canHandle(invalidSaveData)).toBe(false)
  })
})
```

### Integration Tests

```typescript
describe('MyGameConfig Integration', () => {
  it('should parse real save file', async () => {
    const saveFile = await loadTestSaveFile('my-game-save.sav')
    const config = new MyGameConfig()
    const parser = new PokemonSaveParser(saveFile, config)
    
    const result = parser.parseSaveData()
    
    expect(result.player_name).toBe('EXPECTED_NAME')
    expect(result.party_pokemon).toHaveLength(6)
    expect(result.party_pokemon[0].species).toBe('Expected Species')
  })
})
```

## Troubleshooting

### Common Issues and Solutions

#### Config Not Detected

**Problem:** Auto-detection doesn't select your configuration.

**Solutions:**
- Verify `canHandle()` returns `true` for your save files
- Check that your config is registered in `AVAILABLE_CONFIGS`
- Ensure your config appears before more generic ones in the array
- Add debug logging to see what's being checked:

```typescript
canHandle(saveData: Uint8Array): boolean {
  console.log(`Checking ${this.name} with file size: ${saveData.length}`)
  
  if (saveData.length < this.offsets.totalSectors * this.offsets.sectorSize) {
    console.log('File too small')
    return false
  }
  
  // ... rest of detection logic with logging
}
```

#### Incorrect Parsing

**Problem:** Parser fails or returns incorrect data.

**Solutions:**
- Verify all offsets match your game's memory layout
- Use a hex editor to confirm sector structure
- Check that Pokemon data structure matches expectations
- Test with multiple save files to ensure consistency:

```typescript
// Add validation to your Pokemon data class
get ivs(): readonly number[] {
  const ivs = this.readIVsFromData()
  
  // Validate IVs are in expected range (0-31)
  for (const iv of ivs) {
    if (iv < 0 || iv > 31) {
      console.warn(`Invalid IV value: ${iv}`)
    }
  }
  
  return ivs
}
```

#### Type Errors

**Problem:** TypeScript compilation errors.

**Solutions:**
- Ensure all interface methods are implemented
- Check that mapping types match the interface
- Verify readonly properties are properly defined
- Use `as const` for literal types:

```typescript
readonly offsets = {
  sectorSize: 4096,
  // ...
} as const  // Important for type inference
```

#### False Positives

**Problem:** Your config is selected for incompatible save files.

**Solutions:**
- Make detection logic more specific
- Add additional validation checks
- Test with save files from other games
- Use checksums or unique identifiers when possible

### Debugging Tools

```typescript
// Add debug methods to your config
export class MyGameConfig implements GameConfig {
  // ... implementation
  
  debugSaveFile(saveData: Uint8Array): void {
    console.log('=== Save File Debug ===')
    console.log(`File size: ${saveData.length}`)
    console.log(`Expected size: ${this.offsets.totalSectors * this.offsets.sectorSize}`)
    
    // Debug sector signatures
    for (let i = 0; i < this.offsets.totalSectors; i++) {
      const footerOffset = (i * this.offsets.sectorSize) + 
                           this.offsets.sectorSize - this.offsets.sectorFooterSize
      
      if (footerOffset < saveData.length) {
        const view = new DataView(saveData.buffer, saveData.byteOffset + footerOffset)
        const signature = view.getUint32(4, true)
        console.log(`Sector ${i}: signature 0x${signature.toString(16)}`)
      }
    }
  }
}
```

## Examples

### Complete Working Example

See the QuetzalConfig implementation for a complete working example:

```typescript
// Simplified version of QuetzalConfig
export class QuetzalConfig implements GameConfig {
  readonly name = 'Pokemon Quetzal'
  readonly signature = 0x08012025
  
  readonly offsets = {
    sectorSize: 4096,
    sectorDataSize: 3968,
    // ... all required offsets
  } as const
  
  readonly mappings = {
    pokemon: loadPokemonMappings(),
    items: loadItemMappings(), 
    moves: loadMoveMappings(),
  } as const
  
  canHandle(saveData: Uint8Array): boolean {
    // Multi-step detection with fallbacks
    return this.hasCorrectSignature(saveData) &&
           this.hasValidPokemonData(saveData) &&
           this.hasQuetzalSpecificMarkers(saveData)
  }
  
  // ... rest of implementation
}
```

This example demonstrates the complete pattern for implementing a game configuration with proper detection, validation, and error handling.