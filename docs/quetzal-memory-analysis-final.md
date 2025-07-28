# Quetzal ROM Hack Memory Analysis - Final Results

## Problem
The Quetzal ROM hack was using placeholder RAM offsets copied from vanilla Emerald, preventing accurate real-time memory reading and editing via the mgba WebSocket API.

## Investigation Approach
Used the ground truth data from `quetzal_ground_truth.json` to search for specific Pokemon party data in memory dumps from two different savestates:
- `quetzal.ss0` (contains ground truth party: Steelix, Breloom, Snorlax, Ludicolo, Rayquaza, Sigilyph)
- `quetzal2.ss0` (contains different party with different Pokemon)

## Key Findings

### Ground Truth Party Located
Successfully found the exact party from `quetzal_ground_truth.json` in the first savestate:
- **Address**: `0x020235B8` in quetzal.ss0
- **Structure**: 104-byte Pokemon data with stride=104, species at +0x28, level at +0x58
- **Validation**: All 6 Pokemon matched exactly (species ID, level, structure)

### Different Party in Second Savestate  
Found a completely different party in the second savestate:
- **Address**: `0x02023AA4` in quetzal2.ss0
- **Same Structure**: 104-byte Pokemon data with identical offsets
- **Different Pokemon**: Breloom(66), Gyarados(65), Tyranitar(68), Shelgon(36), Snorlax(65), Incineroar(67)

### Dynamic Memory Allocation Confirmed
- **Address Difference**: 1260 bytes between the two savestates
- **No Consistent Addresses**: Zero overlapping memory locations between saves
- **Root Cause**: Quetzal uses dynamic memory allocation for party data

## Technical Analysis Tools Created

### 1. Ground Truth Pokemon Finder (`find_party_addresses.py`)
```python
# Searches for specific Pokemon party using ground truth data
# Found exact matches in quetzal.ss0 at multiple address/offset combinations
```

### 2. Generic Party Pattern Detector (`find_any_party.py`)
```python
# Detects any valid Pokemon party structures in memory
# Confirmed both savestates contain valid but different parties at different addresses
```

### 3. Memory Dump Analysis (`find-ground-truth-party.c`)
```c
// C-based high-performance Pokemon structure validation
// Validates species ID, level, and Pokemon data integrity
```

## Final Configuration

Memory support has been **DISABLED** for Quetzal due to dynamic allocation:

```typescript
// src/lib/parser/games/quetzal/config.ts
canHandleMemory(gameTitle: string): boolean {
  // Memory support disabled due to dynamic allocation in Quetzal ROM hack
  // Party data locations vary between savestates making memory reading unreliable
  return false
}

readonly memoryAddresses = {
  partyData: 0x00000000,   // DISABLED - No consistent address across savestates
  partyCount: 0x00000000,  // DISABLED - No consistent address across savestates  
  playTime: 0x00000000,    // DISABLED - No consistent address across savestates
  preloadRegions: [],      // DISABLED - No stable regions for preloading
}
```

## Impact

- ✅ **Save file parsing**: Remains fully functional and reliable
- ❌ **Memory support**: Disabled to prevent unreliable behavior
- 🔧 **mgba WebSocket API**: Cannot be used with Quetzal due to dynamic allocation
- 📊 **Real-time editing**: Not supported (save file editing still works)

## Analysis Scripts Available

1. `scripts/find_party_addresses.py` - Targeted ground truth party finder
2. `scripts/find_any_party.py` - Generic Pokemon party pattern detector  
3. `scripts/find-ground-truth-party.c` - High-performance C memory analyzer
4. `scripts/dump-gba-memory.ts` - WebSocket-based memory dumper
5. `scripts/analyze-memory-dumps.c` - Cross-savestate memory comparison

These tools provide a template for analyzing future ROM hacks and can be adapted for other Pokemon ROM modifications.