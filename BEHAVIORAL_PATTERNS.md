# Behavioral Universal Patterns for Pokemon PartyData Detection

**NEW APPROACH**: This system discovers partyData addresses dynamically through behavioral code analysis **WITHOUT** knowing target addresses beforehand.

## The Problem with Previous Approaches

Previous "universal" patterns were searching for known address bytes (like `EC 44 02 02` for `0x020244EC`), which defeats the purpose because:

1. ❌ **Not actually universal** - only works if you already know the target address
2. ❌ **Useless for ROM hacks** - different versions will have different addresses  
3. ❌ **Defeats the purpose** - we want to DISCOVER addresses, not search for known ones

## The Behavioral Approach

This new system finds partyData by identifying **characteristic code patterns** that manipulate party data:

### 🔍 What We Look For

1. **Party Loop Counters** - Code that iterates through exactly 6 Pokemon
2. **Pokemon Size Calculations** - Multiplication by Pokemon struct size (100/104 bytes)
3. **Party Slot Access** - Individual Pokemon slot address calculations
4. **Bounds Checking** - Validation that party indices are 0-5
5. **Battle System Access** - Battle code accessing party data

### 🎯 Why This Works

These patterns detect the **behavior** of party data access, not the addresses themselves:
- Party loops always use 6 (number of Pokemon in party)
- Size calculations always use 100 bytes (Emerald) or 104 bytes (Quetzal) 
- Slot access follows predictable ARM/THUMB instruction patterns
- These behaviors are consistent across ROM versions

## Implementation

### TypeScript/Node.js Usage

```typescript
import { findPartyDataBehavioral } from './src/lib/signature/behavioral-scanner.js';

// Load ROM file
const buffer = new Uint8Array(readFileSync('pokemon-rom.gba'));

// Find partyData address through behavioral analysis
const result = findPartyDataBehavioral(buffer);

if (result) {
  console.log(`Found partyData at: 0x${result.address.toString(16)}`);
  console.log(`Confidence: ${result.confidence}`);
  console.log(`Supporting patterns: ${result.pattern}`);
}
```

### mGBA Lua Usage

```lua
-- Load the behavioral pattern system
dofile('/lua/behavioral-universal-patterns.lua')

-- Find partyData address dynamically  
local address, method = findPartyDataBehavioral()

if address then
  print(string.format("Found partyData at: 0x%08X", address))
  print("Method: " .. method)
else
  print("No partyData address found")
end
```

## Testing & Validation

### Command Line Testing

Test any ROM file with behavioral patterns:

```bash
# Test a ROM file directly
npm run behavioral-cli pokemon-emerald.gba
npm run behavioral-cli pokemon-quetzal.gba  
npm run behavioral-cli unknown-rom-hack.gba
```

### Full mGBA Docker Testing

Test with real emulator environment:

```bash
# Test both Emerald and Quetzal with mGBA Docker
npm run test-behavioral
```

## Expected Results

### For Pokemon Emerald:
```
✅ SUCCESS: Found partyData address!
   Address: 0x020244EC
   Pattern: party_loop_counter  
   Confidence: high
   Method: behavioral_analysis
```

### For Pokemon Quetzal:
```
✅ SUCCESS: Found partyData address!
   Address: 0x020235B8
   Pattern: pokemon_size_calculation
   Confidence: high  
   Method: behavioral_analysis
```

### For Unknown ROM Hacks:
```
✅ SUCCESS: Found partyData address!
   Address: 0x02025678 (example)
   Pattern: party_slot_access
   Confidence: medium
   Method: behavioral_analysis
   🎮 Game: Unknown variant or ROM hack
```

## Behavioral Patterns Explained

### 1. Party Loop Counter Pattern
**Hex Pattern**: `06 20 ?? ?? ?? ?? ?? ?? ?? E5`
**Description**: Detects ARM code that sets a register to 6 (party size) for iteration

```asm
MOV r0, #6          ; 06 20 (set counter to 6 Pokemon)
; ... loop setup code
LDR r1, [pc, #imm]  ; E5 9F (load party base address)
```

### 2. Pokemon Size Calculation Pattern  
**Hex Pattern**: `E0 ?? ?? 6[48] E5 9F ?? ??`
**Description**: Detects size multiplication (0x64=100 bytes or 0x68=104 bytes)

```asm
ADD r0, r1, r2, LSL #6  ; Multiply by 100 (0x64) or 104 (0x68)
LDR r1, [pc, #imm]      ; Load party base address
```

### 3. Party Slot Access Pattern
**Hex Pattern**: `48 ?? 68 ?? 0[01-69] 30`
**Description**: THUMB sequence for individual Pokemon slot access

```asm
LDR r0, [pc, #imm]  ; 48 ?? (load party base from literal pool)
LDR r0, [r0]        ; 68 ?? (dereference pointer)  
ADDS r0, #offset    ; 30 ?? (add Pokemon slot offset)
```

### 4. Party Bounds Check Pattern
**Hex Pattern**: `05 28 ?? D[2-9] E5 9F ?? ??`
**Description**: Validates party slot index is 0-5

```asm
CMP r0, #5          ; 05 28 (compare with max party index)
BLE valid_slot      ; D? ?? (conditional branch)
LDR r1, [pc, #imm]  ; E5 9F (load party address)
```

## Advantages of Behavioral Patterns

✅ **Truly Universal** - Works on ROM hacks and unknown versions  
✅ **Dynamic Discovery** - Finds addresses without knowing them beforehand  
✅ **Robust Detection** - Multiple supporting patterns increase confidence  
✅ **Game Agnostic** - Same patterns work across different Pokemon games  
✅ **Future Proof** - Works even when addresses change in new ROM versions

## Technical Details

### Address Extraction Process

1. **Pattern Matching**: Scan ROM for characteristic instruction sequences
2. **Context Analysis**: Look for ARM/THUMB LDR instructions near pattern matches
3. **Literal Pool Resolution**: Calculate PC-relative addresses and read literal pools
4. **Address Validation**: Verify discovered addresses are in valid RAM ranges
5. **Confidence Scoring**: Multiple patterns supporting same address = higher confidence

### Performance Optimization

- Scans first 2MB of ROM for speed (covers all code sections)
- Uses efficient byte-level scanning with mask patterns
- Early termination when high-confidence result found
- Memory-efficient chunked processing for large ROMs

## Debugging & Troubleshooting

### If No Patterns Found:
1. Verify the ROM is a Pokemon GBA game
2. Check if it's a heavily modified ROM hack
3. Try reducing confidence requirements (`minConfidence: 'low'`)
4. Increase scan range if needed

### If Wrong Address Found:
1. Check if multiple addresses were found (shows consensus)
2. Verify the ROM isn't corrupted
3. Cross-reference with known addresses if available
4. Use higher confidence requirements (`minConfidence: 'high'`)

### For ROM Hackers:
This system should discover your custom partyData addresses automatically, as long as you use standard ARM/THUMB code patterns for party access. If it fails, examine your party access code to ensure it follows recognizable patterns.

## Comparison: Old vs New Approach

| Aspect | Old Direct Search | New Behavioral Analysis |
|--------|------------------|-------------------------|
| **Universality** | ❌ ROM-specific | ✅ Truly universal |
| **Discovery** | ❌ Needs known addresses | ✅ Dynamic discovery |
| **ROM Hacks** | ❌ Fails on modified ROMs | ✅ Works on ROM hacks |
| **Maintenance** | ❌ Requires address database | ✅ Self-discovering |
| **Reliability** | ❌ Brittle | ✅ Multiple pattern validation |

The behavioral approach represents a fundamental shift from searching for known data to analyzing code behavior, making it truly universal and future-proof.