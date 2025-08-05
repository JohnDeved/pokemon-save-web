# Memory Pattern Analysis

This module provides tools for analyzing Pokemon ROM memory to find byte patterns that can identify the partyData address across different ROM variants.

## Problem Statement

Different Pokemon ROM variants use different memory addresses for partyData:
- **Vanilla Emerald**: `0x20244EC`
- **Quetzal (1uetzal)**: `0x20235B8`

Rather than hardcoding these addresses, we want to find byte patterns in the ROM's assembly code that reference these addresses, allowing us to detect the correct address dynamically.

## Solution

The memory analysis system:

1. **Memory Dumping**: Connects to mGBA emulator via Docker to dump memory regions to disk
2. **Pattern Detection**: Searches for assembly instructions that reference the partyData addresses
3. **Byte Pattern Analysis**: Identifies common patterns that can be used for future detection

## Usage

### CLI Tool

The memory pattern analyzer CLI provides several commands:

```bash
# Full analysis with memory dumps and pattern detection
npm run memory-analyze analyze

# Quick analysis around a specific address
npm run memory-analyze quick 20244ec

# Just dump memory regions for manual analysis
npm run memory-analyze dump --output-dir ./analysis

# Get help
npm run memory-analyze help
```

### Prerequisites

You need to have mGBA running with a Pokemon ROM loaded:

```bash
# Start mGBA Docker with Vanilla Emerald
npm run mgba -- start --game emerald

# Or start with Quetzal
npm run mgba -- start --game quetzal
```

### Example Analysis

```bash
# 1. Start mGBA with your ROM
npm run mgba -- start --game emerald

# 2. Run full analysis
npm run memory-analyze analyze --output-dir ./my-analysis

# 3. Check results
cat ./my-analysis/analysis_report.txt
```

## How It Works

### Pattern Types

The system looks for several types of patterns:

1. **Direct Address References**: 32-bit immediate values containing the exact address
2. **Thumb LDR Instructions**: `LDR Rx, [PC, #offset]` instructions that load the address
3. **ARM Instructions**: Various ARM instructions that reference the address
4. **Near References**: Addresses within a small tolerance of the target

### Assembly Pattern Examples

For vanilla Emerald (`0x20244EC`):

```assembly
; Direct 32-bit reference
.word 0x020244EC

; Thumb LDR PC-relative
ldr r0, [pc, #8]    ; 0x4802
; ... (8 bytes later)
.word 0x020244EC

; ARM MOV immediate (split into MOVW/MOVT)
movw r0, #0x44EC    ; Load low 16 bits
movt r0, #0x0202    ; Load high 16 bits
```

### Confidence Scoring

Each pattern match gets a confidence score (0.0-1.0) based on:
- Exact vs. near address match
- Instruction type (LDR instructions get higher scores)
- Context analysis (valid instruction encoding)

## Output Files

The analysis generates several files:

- `analysis_report.json` - Detailed machine-readable results
- `analysis_report.txt` - Human-readable summary
- `ewram_dump.bin` - Complete EWRAM memory dump (256KB)
- `iwram_dump.bin` - Complete IWRAM memory dump (32KB)

## Integration with Game Configs

Future enhancement: The discovered patterns can be integrated into the game configuration system to automatically detect the correct partyData address:

```typescript
// Proposed enhancement
export class DynamicGameConfig extends GameConfigBase {
  async detectPartyDataAddress(client: MgbaWebSocketClient): Promise<number> {
    const analyzer = new MemoryAnalyzer(client)
    const result = await analyzer.analyzePartyDataPatterns(KNOWN_ADDRESSES)
    return result.detectedPartyDataAddress ?? FALLBACK_ADDRESS
  }
}
```

## Implementation Details

### Memory Regions Analyzed

- **EWRAM**: `0x02000000 - 0x02040000` (256KB) - Main game data
- **IWRAM**: `0x03000000 - 0x03008000` (32KB) - Fast access memory
- **Context Regions**: 8KB around known addresses for focused analysis

### Pattern Matching Algorithm

1. Read memory regions from mGBA emulator
2. Generate expected byte patterns for target addresses
3. Search for exact and fuzzy matches
4. Analyze instruction context (ARM/Thumb decoding)
5. Score matches based on multiple factors
6. Generate suggested patterns for future use

### ARM/Thumb Instruction Analysis

The system can decode common instruction patterns:

- **Thumb LDR**: `0b01001xxx xxxxxxxx` - PC-relative loads
- **ARM LDR**: `0b1110 0101 1001 xxxx` - Immediate addressing
- **ARM MOV**: `0b1110 0011 1010 0000` - Immediate moves

## Testing

Run the pattern analysis tests:

```bash
npm run test src/lib/memory-analysis
```

The tests verify:
- Pattern creation for different addresses
- Instruction decoding accuracy
- Memory region analysis
- Report generation

## Future Enhancements

1. **More Instruction Types**: Add support for more ARM/Thumb instructions
2. **Function Analysis**: Identify functions that access party data
3. **Cross-References**: Find all code locations that reference party data
4. **Automatic Integration**: Auto-configure game configs based on analysis
5. **Pattern Library**: Build a database of patterns for different ROM hacks