# Go/WASM Parser Implementation

## Overview

This project now includes a Go-based Pokemon save file parser that compiles to WebAssembly (WASM) for use in both browser and Node.js environments. The implementation provides better performance and is designed to run alongside the existing TypeScript parser with automatic fallback support.

## Architecture

### Core Components

1. **Go Parser Core** (`parser/core/`)
   - `types.go` - Data structures and interfaces
   - `pokemon.go` - Pokemon data handling
   - `parser.go` - Main save file parsing logic  
   - `charmap.go` - Character encoding/decoding

2. **WASM Interface** (`parser/wasm.go`)
   - WebAssembly bindings for browser/Node.js
   - JavaScript-callable functions
   - Promise-based async API

3. **Unified Interface** (`src/lib/`)
   - `unified-parser.ts` - Common interface definition
   - `adapters/` - Parser adapters and factory pattern
   - Automatic engine selection with fallback

## Features

### Go Parser Capabilities
- ✅ Save file parsing (basic Vanilla Emerald support)
- ✅ Pokemon data extraction and manipulation
- ✅ Character encoding/decoding with GBA character map
- ✅ Game configuration system  
- ✅ CLI and WASM compilation targets
- ✅ JSON serialization for web integration

### WASM Integration
- ✅ Browser WebAssembly support
- ✅ Node.js WASM execution (limited)
- ✅ Promise-based JavaScript API
- ✅ Automatic initialization and error handling
- ✅ Data marshaling between JavaScript and Go

### Unified Interface
- ✅ Automatic parser selection (Go WASM → TypeScript fallback)
- ✅ Consistent API across parser engines
- ✅ React component integration (via hooks)
- ✅ CLI tool with engine selection
- ✅ Comprehensive test coverage

## Usage

### Browser Usage (React)

The parser automatically selects the best available engine:

```typescript
import { usePokemonData } from './hooks'

export const App: React.FC = () => {
  const { partyList, saveFileParser } = usePokemonData()
  // Parser automatically uses Go WASM if available, falls back to TypeScript
}
```

### Direct API Usage

```typescript
import { createParser, ParserType } from './lib/adapters/parser-factory'

// Automatic engine selection
const parser = await createParser()
const saveData = await parser.parse(file)

// Force specific engine
const goParser = await createParser({ type: ParserType.GO_WASM })
const tsParser = await createParser({ type: ParserType.TYPESCRIPT })
```

### CLI Usage

Multiple CLI options are available:

```bash
# Original TypeScript CLI
npm run parse save.sav

# Pure Go CLI (fastest)
npm run parse:go save.sav --debug

# Hybrid CLI with engine selection
npm run parse:hybrid save.sav --engine=auto
npm run parse:hybrid save.sav --engine=typescript
npm run parse:hybrid save.sav --engine=go-wasm
```

### Text Encoding/Decoding

Go WASM parser supports Pokemon GBA text encoding:

```bash
# Encode text to GBA bytes
npm run parse:hybrid -- --engine=auto --toBytes=PIKACHU

# Decode GBA bytes to text  
npm run parse:hybrid -- --engine=auto --toString="CA C9 C7 C1 C3 C8 D3"
```

## Build Process

### WASM Build

```bash
# Build Go WASM module and CLI
npm run build:wasm

# Manual build
GOOS=js GOARCH=wasm go build -o public/parser.wasm ./parser
```

### Development Build

```bash
# Full development build with WASM
npm run build:wasm && npm run build
```

## File Structure

```
pokemon-save-web/
├── parser/                    # Go source code
│   ├── core/                 # Core parsing logic
│   │   ├── types.go         # Data structures
│   │   ├── pokemon.go       # Pokemon data handling
│   │   ├── parser.go        # Main parser logic
│   │   └── charmap.go       # Character encoding
│   ├── main.go              # CLI entry point
│   └── wasm.go              # WASM bindings
├── public/
│   ├── parser.wasm          # Compiled WASM module (2.9MB)
│   └── wasm_exec.js         # Go WASM runtime
├── src/lib/
│   ├── adapters/            # Parser adapters
│   │   ├── go-wasm-adapter.ts
│   │   ├── typescript-adapter.ts
│   │   └── parser-factory.ts
│   ├── parser/              # TypeScript parser
│   └── unified-parser.ts    # Common interfaces
└── bin/
    └── parser-go           # Compiled Go CLI
```

## Performance

### WASM Module Size
- **parser.wasm**: 2.9MB (includes Go runtime)
- **wasm_exec.js**: ~20KB (Go WASM support)

### Performance Characteristics
- **Go CLI**: Fastest, direct binary execution
- **Go WASM**: Good performance, some WASM overhead
- **TypeScript**: Compatible baseline, slower for large files

## Testing

### Test Coverage
- Unit tests for WASM wrapper functionality
- Integration tests for parser factory and adapters
- Existing parser tests continue to pass (26/26)
- Engine selection and fallback testing

```bash
# Run all tests
npm test

# Test specific components
npm run test src/lib/__tests__/parser-factory.test.ts
npm run test src/lib/parser/__tests__/wasm-parser.test.js
```

## Browser Compatibility

### WebAssembly Support
- ✅ Chrome 57+
- ✅ Firefox 52+
- ✅ Safari 11+
- ✅ Edge 16+

### Fallback Support
- Automatic fallback to TypeScript parser on unsupported browsers
- No functionality loss, transparent to user

## Development Notes

### Current Limitations
- Go parser currently supports basic Vanilla Emerald only
- Save file reconstruction uses original raw data (not reconstructed in Go yet)
- Memory mode (mGBA integration) not yet ported to Go
- Advanced game configs (Quetzal, etc.) need porting from TypeScript

### Future Enhancements
- Port all game configurations to Go
- Implement save file reconstruction in Go
- Add mGBA memory mode support
- Optimize WASM module size
- Add more comprehensive error handling

### Adding New Game Support

To add a new game to the Go parser:

1. Create new config in `parser/games/`
2. Implement `GameConfig` interface
3. Add game detection logic
4. Update parser registry
5. Test with save files

## Migration Guide

### For Existing Users
No changes required - the parser automatically selects the best engine and maintains full API compatibility.

### For Developers
- Import from `./lib/adapters/parser-factory` instead of direct parser imports
- Use `createParser()` for automatic engine selection
- Existing TypeScript parser remains fully functional
- All existing tests and functionality preserved

## Troubleshooting

### WASM Not Loading
- Check browser console for WASM errors
- Ensure `parser.wasm` and `wasm_exec.js` are served correctly
- Verify WebAssembly support in browser
- Parser will automatically fallback to TypeScript

### Node.js WASM Issues
- Node.js WASM support is limited compared to browsers
- CLI automatically falls back to TypeScript parser
- Use `--engine=typescript` to force TypeScript engine
- Use `./bin/parser-go` for pure Go performance

### Build Issues
- Ensure Go 1.24+ is installed
- Run `go mod tidy` if dependency issues
- Check that WASM build script has execute permissions
- Verify all file paths in build scripts