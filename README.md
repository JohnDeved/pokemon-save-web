# Pokemon Save Web

A modern web-based Pokemon save file editor and parser built with React, TypeScript, and Vite. Supports multiple Pokemon games and ROM hacks through a flexible dependency injection system.

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Usage](#usage)
  - [Web Application](#1-web-application)
  - [JavaScript/TypeScript Library](#2-javascripttypescript-library)
  - [Command Line Interface](#3-command-line-interface)
- [Installation](#installation)
- [Development](#development)
- [Testing](#testing)
- [Architecture](#architecture)
- [Adding Game Support](#adding-game-support)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Multi-Game Support** - Pokemon Quetzal and vanilla Pokemon Emerald with auto-detection
- **Dependency Injection** - Extensible GameConfig system for adding new games/ROM hacks
- **Browser-Based** - Works entirely in the browser with no server required
- **Type-Safe** - Full TypeScript implementation with comprehensive type definitions
- **Modern UI** - Built with React 19 and modern web technologies
- **CLI Tool** - Command line interface for batch processing and automation

## Quick Start

### Web Application
```bash
npm install
npm run dev
```
Open your browser and drag & drop a Pokemon save file to get started.

### Command Line
```bash
# Parse a save file
npx github:JohnDeved/pokemon-save-web save.sav

# With debug output
npx github:JohnDeved/pokemon-save-web save.sav --debug
```

### As a Library
```typescript
import { PokemonSaveParser } from 'pokemon-save-web'

const parser = new PokemonSaveParser()
const saveData = await parser.parseSaveFile(file)
console.log(`Player: ${saveData.player_name}`)
```

## Usage

Pokemon Save Web provides three ways to work with Pokemon save files:

### 1. Web Application

The main web application provides a user-friendly interface for uploading and analyzing save files.

**Getting Started:**
```bash
npm install
npm run dev    # Start development server
npm run build  # Build for production
```

**Features:**
- Drag-and-drop save file upload
- Interactive Pokemon data visualization  
- Real-time editing capabilities
- File System Access API support for modern browsers

### 2. JavaScript/TypeScript Library

Use the parser as a library in your own projects with full TypeScript support.

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

### 3. Command Line Interface

Parse save files from the command line with multiple output formats.

**Installation and Usage:**
```bash
# Local usage
npm install
npm run parse save.sav --debug

# NPX usage (direct from GitHub)  
npx github:JohnDeved/pokemon-save-web save.sav --graph
```

**CLI Options:**
- `--debug` - Show raw bytes for each party Pokemon after the summary table
- `--graph` - Show colored hex/field graph for each party Pokemon
- `--toBytes=STRING` - Convert a string to GBA byte encoding
- `--toString=HEX` - Convert space/comma-separated hex bytes to a decoded GBA string

**Output Formats:**

*Summary Table (Default):*
```bash
npx github:JohnDeved/pokemon-save-web save.sav
```
Shows a formatted table with Pokemon stats, HP bars, and trainer information.

*Debug Mode:*
```bash
npx github:JohnDeved/pokemon-save-web save.sav --debug
```
Shows the summary table plus raw hex bytes for each Pokemon.

*Graph Mode:*
```bash
npx github:JohnDeved/pokemon-save-web save.sav --graph
```
Shows a colored hex dump with field labels for detailed analysis.

*String Utilities:*
```bash
# Convert text to GBA encoding
npx github:JohnDeved/pokemon-save-web --toBytes=RAYQUAZA

# Convert hex bytes to GBA string
npx github:JohnDeved/pokemon-save-web --toString="ca c3 c5 bb bd c2 cf"
```

**Supported Games:**
- Pokemon Quetzal (ROM hack)
- Pokemon Emerald (vanilla)
- Other games via the extensible GameConfig system

## Installation

### For Development
```bash
git clone https://github.com/JohnDeved/pokemon-save-web
cd pokemon-save-web
npm install
```

### As NPM Package
```bash
npm install pokemon-save-web
```

### Direct from GitHub
```bash
npx github:JohnDeved/pokemon-save-web
```

## Development

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run test         # Run tests with watch mode
npm run test:run     # Run tests once
npm run test:ui      # Run tests with UI
npm run lint         # Lint code
npm run parse <file> # Parse save file via CLI
```

### Project Structure
```
src/
├── lib/parser/          # Core parser library
│   ├── core/           # Parser logic and types
│   ├── games/          # Game-specific configurations
│   └── __tests__/      # Comprehensive test suite
├── components/         # React components
└── App.tsx            # Main application
```

## Testing

Comprehensive test suite with both unit and integration tests:

```bash
npm run test         # Run tests with watch mode
npm run test:run     # Run all tests once
npm run test:ui      # Interactive test UI
```

**Test Coverage:**
- **Unit Tests** - Parser components, GameConfig implementations
- **Integration Tests** - Real save file parsing with ground truth validation
- **Auto-Detection Tests** - Verify correct game type detection
- **CLI Tests** - Command line interface functionality

## Architecture

### Core Components

- **GameConfig Interface** - Contract for game-specific configurations
- **PokemonSaveParser** - Main parser with dependency injection
- **Auto-Detection** - Automatic game type detection
- **QuetzalConfig/VanillaConfig** - Game-specific implementations

### Browser Compatibility

- Uses modern Web APIs (File System Access API when available)
- Fallback support for older browsers
- No server dependencies - runs entirely client-side

### Parser Library

The core parser library features:
- **Dependency Injection** - Clean separation of game-specific logic
- **Type Safety** - Full TypeScript implementation
- **Extensibility** - Easy to add support for new games
- **Auto-Detection** - Automatically identifies game types

For detailed parser documentation, see [src/lib/parser/README.md](./src/lib/parser/README.md).

## Adding Game Support

The parser uses a flexible GameConfig system that makes it easy to add support for new Pokemon games and ROM hacks.

### Quick Example

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

### Steps to Add Support

1. Create a new GameConfig implementation
2. Add detection logic in `canHandle()`
3. Register in auto-detection system
4. Add tests with real save files
5. Update documentation

For detailed instructions, see [docs/GameConfig.md](./docs/GameConfig.md).

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Add tests for new functionality
4. Ensure all tests pass (`npm run test:run`)
5. Lint your code (`npm run lint`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Development Guidelines

- **Add tests** for all new functionality
- **Follow TypeScript best practices** 
- **Maintain backward compatibility** when possible
- **Update documentation** for any API changes
- **Use the existing code style** and formatting

### Adding Game Support

To add support for a new Pokemon game:

1. Create a new GameConfig implementation following the interface
2. Add comprehensive detection logic to avoid false positives  
3. Include complete offset and mapping data
4. Add tests with real save files from the game
5. Register the config in the auto-detection system
6. Update documentation with game-specific details

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Built with ❤️ for the Pokemon community**

For questions, issues, or contributions, please visit our [GitHub repository](https://github.com/JohnDeved/pokemon-save-web).
