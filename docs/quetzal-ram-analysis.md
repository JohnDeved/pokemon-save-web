# Quetzal RAM Offset Analysis Process

This document describes the process used to identify the correct RAM offsets for the Pokemon Quetzal ROM hack using the real mgba emulator.

## Problem Statement

The Quetzal ROM hack was using placeholder RAM offsets copied from vanilla Emerald. These were incorrect and prevented accurate real-time memory reading/editing via the mgba WebSocket API.

## Methodology

### 1. Theoretical Analysis (Initial Approach)
- Used save file analysis to calculate theoretical offsets
- Identified patterns in save data structure
- Calculated potential memory addresses based on vanilla relationships

### 2. Real Emulator Verification (Final Approach)
- Used mgba Docker container with actual Quetzal ROM
- Connected via WebSocket API to read live memory
- Systematically scanned EWRAM to find correct addresses

## Verification Process

### 1. Setup Real Environment
```bash
# Start mgba with Quetzal ROM and savestate
npm run mgba -- start --game quetzal

# Connect to WebSocket API at ws://localhost:7102/ws
```

### 2. Memory Scanning
Used targeted scanning script (`scripts/targeted-memory-test.ts`) to:
- Search EWRAM range (0x2000000 - 0x2040000) for party count value (6)
- Validate Pokemon data structure at candidate addresses
- Verify play time pattern matches ground truth

### 3. Address Discovery
Found correct addresses by matching with ground truth data:
- **Party Count**: 6 Pokemon ✅
- **Play Time**: 45h 36m 40s ✅
- **Pokemon Levels**: 44, 45, 47, 45, 41, 37 ✅
- **Pokemon HP**: 131, 126, 248, 135, 132, 114 ✅

## Final Verified Addresses

```typescript
readonly memoryAddresses = {
  partyData: 0x2024a18,   // Verified: Pokemon party data starts here
  partyCount: 0x2024a14,  // Verified: Party count (4 bytes before party data)  
  playTime: 0x2023e08,    // Verified: Play time location
}
```

## Key Findings

- **Theoretical vs Reality**: Initial calculated addresses were wrong
- **Party Data**: `0x2024a18` (not `0x20244ec`)
- **Party Count**: `0x2024a14` (not `0x20244e8`)  
- **Play Time**: `0x2023e08` (not `0x2022e54`)
- **Address Relationship**: Maintains 4-byte separation (party count → party data)

## Verification Results

All memory reads matched expected ground truth:
- ✅ Party count: 6
- ✅ Play time: 45h 36m 40s  
- ✅ First Pokemon: Level 44, HP 131
- ✅ Full party structure validated

## Tools Used

1. **`scripts/verify-quetzal-memory.ts`**: Initial verification with theoretical addresses
2. **`scripts/targeted-memory-test.ts`**: Systematic EWRAM scanning
3. **`scripts/final-verification.ts`**: Final confirmation of corrected addresses

## mgba WebSocket Integration

With verified addresses, the mgba WebSocket API can now:

```typescript
// Read party count
const partyCount = await client.readByte(0x2024a14)

// Read full party data  
const partyData = await client.readBytes(0x2024a18, 624)

// Read play time
const playTime = await client.readBytes(0x2023e08, 8)

// Write Pokemon data
await client.writeBytes(0x2024a18 + (pokemonIndex * 104), modifiedPokemonData)
```

# Quetzal RAM Offset Analysis Process

This document describes the process used to identify the correct RAM offsets for the Pokemon Quetzal ROM hack using the real mgba emulator.

## Problem Statement

The Quetzal ROM hack was using placeholder RAM offsets copied from vanilla Emerald. These were incorrect and prevented accurate real-time memory reading/editing via the mgba WebSocket API.

## Methodology

### 1. Theoretical Analysis (Initial Approach)
- Used save file analysis to calculate theoretical offsets
- Identified patterns in save data structure
- Calculated potential memory addresses based on vanilla relationships

### 2. Real Emulator Verification (Final Approach)
- Used mgba Docker container with actual Quetzal ROM
- Connected via WebSocket API to read live memory
- Systematically scanned EWRAM to find correct addresses

## Verification Process

### 1. Setup Real Environment
```bash
# Start mgba with Quetzal ROM and savestate
npm run mgba -- start --game quetzal

# Connect to WebSocket API at ws://localhost:7102/ws
```

### 2. Memory Scanning
Used targeted scanning script (`scripts/targeted-memory-test.ts`) to:
- Search EWRAM range (0x2000000 - 0x2040000) for party count value (6)
- Validate Pokemon data structure at candidate addresses
- Verify play time pattern matches ground truth

### 3. Address Discovery
Found correct addresses by matching with ground truth data:
- **Party Count**: 6 Pokemon ✅
- **Play Time**: 45h 36m 40s ✅
- **Pokemon Levels**: 44, 45, 47, 45, 41, 37 ✅
- **Pokemon HP**: 131, 126, 248, 135, 132, 114 ✅

## Final Verified Addresses

```typescript
readonly memoryAddresses = {
  partyData: 0x2024a18,   // Verified: Pokemon party data starts here
  partyCount: 0x2024a14,  // Verified: Party count (4 bytes before party data)  
  playTime: 0x2023e08,    // Verified: Play time location
}
```

## Key Findings

- **Theoretical vs Reality**: Initial calculated addresses were wrong
- **Party Data**: `0x2024a18` (not `0x20244ec`)
- **Party Count**: `0x2024a14` (not `0x20244e8`)  
- **Play Time**: `0x2023e08` (not `0x2022e54`)
- **Address Relationship**: Maintains 4-byte separation (party count → party data)

## Verification Results

All memory reads matched expected ground truth:
- ✅ Party count: 6
- ✅ Play time: 45h 36m 40s  
- ✅ First Pokemon: Level 44, HP 131
- ✅ Full party structure validated

## Tools Used

1. **`scripts/verify-quetzal-memory.ts`**: Initial verification with theoretical addresses
2. **`scripts/targeted-memory-test.ts`**: Systematic EWRAM scanning
3. **`scripts/final-verification.ts`**: Final confirmation of corrected addresses

## mgba WebSocket Integration

With verified addresses, the mgba WebSocket API can now:

```typescript
// Read party count
const partyCount = await client.readByte(0x2024a14)

// Read full party data  
const partyData = await client.readBytes(0x2024a18, 624)

// Read play time
const playTime = await client.readBytes(0x2023e08, 8)

// Write Pokemon data
await client.writeBytes(0x2024a18 + (pokemonIndex * 104), modifiedPokemonData)
```

## Testing and Validation

### Test Suite Results
- ✅ All existing tests pass (139/139)
- ✅ Memory addresses validated with real emulator
- ✅ Address offsets maintain expected relationships
- ✅ Game title recognition works correctly
- ✅ Save file parsing remains functional

### Real-time Verification
```bash
# Run verification against live mgba instance
npx tsx scripts/final-verification.ts
```

## Future ROM Hack Analysis

For analyzing other ROM hacks:

1. **Setup Environment**:
   - Ensure ROM and savestate are available in mgba Docker
   - Load ground truth data from save file parsing

2. **Run Memory Scanning**:
   ```bash
   npx tsx scripts/targeted-memory-test.ts
   ```

3. **Update Configuration**:
   - Modify `memoryAddresses` in game config
   - Update `canHandleMemory()` method
   - Add appropriate preload regions

4. **Validate Results**:
   - Test with real emulator
   - Verify all existing functionality remains intact

## Conclusion

This process successfully identified the correct RAM offsets for Pokemon Quetzal through systematic analysis using the real mgba emulator. The verified addresses enable full real-time memory editing capabilities and bring Quetzal to feature parity with vanilla Emerald for memory hacking workflows.