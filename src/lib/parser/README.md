# Pokemon Save Parser - File Structure

This document describes the improved file structure of the Pokemon Save Parser library.

## Directory Structure

```
src/lib/parser/
├── core/                     # Core parser logic and utilities
│   ├── index.ts             # Core module exports
│   ├── pokemonSaveParser.ts # Main parser class
│   ├── types.ts             # Type definitions and constants
│   └── utils.ts             # Utility functions
├── configs/                  # Game-specific configurations
│   ├── index.ts             # Config module exports
│   ├── GameConfig.ts        # Configuration interface
│   ├── QuetzalConfig.ts     # Quetzal ROM hack configuration
│   ├── VanillaConfig.ts     # Vanilla Pokemon Emerald configuration
│   └── autoDetect.ts        # Auto-detection logic
├── data/                     # Static data files
│   ├── pokemon_charmap.json # Character mapping for GBA text
│   └── mappings/            # Game data mappings
│       ├── item_map.json    # Item ID mappings
│       ├── move_map.json    # Move ID mappings
│       └── pokemon_map.json # Pokemon species mappings
├── __tests__/               # Test files
│   ├── core/                # Tests for core functionality
│   │   ├── pokemonSaveParser.unit.test.ts
│   │   └── pokemonSaveParser.integration.test.ts
│   ├── configs/             # Tests for configuration system
│   │   └── gameConfig.test.ts
│   └── test_data/           # Test save files and ground truth data
├── cli.ts                   # Command-line interface
└── index.ts                 # Main library exports
```

## Module Organization

### Core Module (`core/`)
Contains the main parsing logic and utilities:
- **PokemonSaveParser**: Main parser class with dependency injection
- **Types & Constants**: Data structures and game constants  
- **Utilities**: Helper functions for text conversion, stat calculations, etc.

### Configuration Module (`configs/`)
Contains game-specific configurations and auto-detection:
- **GameConfig Interface**: Defines the contract for game configurations
- **Concrete Configs**: QuetzalConfig, VanillaConfig implementations
- **Auto-Detection**: Logic to automatically select appropriate config

### Data Module (`data/`)
Contains static JSON data files:
- **Character Mappings**: GBA text encoding/decoding
- **Game Mappings**: Pokemon, item, and move ID mappings

### Tests (`__tests__/`)
Organized by module with separate directories for core and config tests.

## Benefits

1. **Better Separation of Concerns**: Core parsing logic is separated from game-specific configurations
2. **Easier Navigation**: Related files are grouped together
3. **Improved Maintainability**: Clear structure makes it easier to add new games or modify existing functionality
4. **Scalability**: New game configurations can be added without touching core logic
5. **Testing Organization**: Tests are organized by module, making it easier to run specific test suites

## Imports

The main parser index (`index.ts`) provides clean exports for all functionality:

```typescript
// Core functionality
import { PokemonSaveParser, PokemonData } from '@/lib/parser'

// Game configurations  
import { QuetzalConfig, VanillaConfig, autoDetectGameConfig } from '@/lib/parser'

// Utilities
import { calculateTotalStats, natures, getItemSpriteUrl } from '@/lib/parser'

// Types
import type { GameConfig, SaveData, PokemonMapping } from '@/lib/parser'
```

## Adding New Games

To add support for a new Pokemon game:

1. Create a new config class in `configs/` implementing `GameConfig`
2. Add game-specific data files to `data/mappings/` if needed
3. Register the config in `autoDetect.ts`
4. Add tests in `__tests__/configs/`

The improved structure makes this process much cleaner and doesn't require modifying core parser logic.