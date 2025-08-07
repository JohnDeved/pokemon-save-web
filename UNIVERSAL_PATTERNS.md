# Universal Byte Patterns for Pokemon PartyData Detection

This document provides **universal byte patterns** that work in **both Pokemon Emerald and Quetzal** to find the partyData addresses, along with step-by-step instructions on how to extract the addresses.

## Quick Answer - The Universal Patterns

### Pattern 1: THUMB Party Load (Works in Both Games)
```
Hex Pattern: 48 ?? 68 ?? 30 ??
Expected addresses: 
- Emerald: 0x020244EC
- Quetzal: 0x020235B8
```

### Pattern 2: ARM Pokemon Size Calculation
```
Emerald: E0 ?? ?? 64 E5 9F ?? ?? E0 8? ?? ??
Quetzal: E0 ?? ?? 68 E5 9F ?? ?? E0 8? ?? ??
```
*Note: The only difference is `64` (100 bytes) vs `68` (104 bytes)*

## How to Use These Patterns

### Method 1: Simple Programming Approach

```typescript
import { findPartyDataAddressUniversal } from './universal-patterns'

// Load your ROM memory dump
const memoryBuffer = new Uint8Array(romFileData)

// Find the address automatically
const result = findPartyDataAddressUniversal(memoryBuffer)

if (result.foundAddress) {
  console.log(`Found partyData at: 0x${result.foundAddress.toString(16)}`)
  console.log(`Game variant: ${result.variant}`)
  console.log(`Detection method: ${result.method}`)
} else {
  console.log('PartyData address not found')
}
```

### Method 2: Manual Hex Editor Search

**Step 1: Search for THUMB Pattern (Universal)**
1. Search for: `48 ?? 68 ?? 30 ??` (where ?? = any byte)
2. When you find a match, extract the address:
   - Look at the 2nd byte of the pattern (the ?? after 48)
   - This byte contains: `RRRIIIIII` where RRR=register, IIIII=immediate
   - Calculate: PC = (match_offset + 4) & 0xFFFFFFFC
   - Literal address = PC + (immediate * 4)
   - Read 4 bytes from literal address (little-endian)

**Step 2: Search for ARM Pattern**
1. For Emerald, search: `E0 ?? ?? 64 E5 9F ?? ?? E0 8? ?? ??`
2. For Quetzal, search: `E0 ?? ?? 68 E5 9F ?? ?? E0 8? ?? ??`
3. When found, look for the `E5 9F` instruction:
   - This is an ARM LDR instruction: `E5 9F IIII`
   - Extract immediate: IIII (12-bit value)
   - Calculate: PC = match_offset + 8
   - Literal address = PC + immediate
   - Read 4 bytes from literal address (little-endian)

## Step-by-Step Address Extraction Examples

### Example 1: THUMB Pattern Address Extraction

```
Found pattern: 48 1A 68 02 30 04
Position: 0x12340

Step 1: Extract immediate from 48 1A
- Instruction: 0x481A
- Register: (0x1A >> 3) & 0x7 = 3 (r3)  
- Immediate: 0x1A = 26

Step 2: Calculate PC
- PC = (0x12340 + 4) & 0xFFFFFFFC = 0x12344

Step 3: Calculate literal address  
- Literal = 0x12344 + (26 * 4) = 0x12344 + 104 = 0x123AC

Step 4: Read address from literal pool
- Read 4 bytes at 0x123AC: EC 44 02 02
- Address = 0x020244EC (Emerald partyData!)
```

### Example 2: ARM Pattern Address Extraction

```
Found pattern: E0 01 10 64 E5 9F 20 08 E0 82 20 00
Position: 0x8000

Step 1: Find LDR instruction (E5 9F)
- Found at offset +4: E5 9F 20 08
- Immediate = 0x008 = 8

Step 2: Calculate PC  
- PC = 0x8000 + 4 + 8 = 0x800C

Step 3: Calculate literal address
- Literal = 0x800C + 8 = 0x8014

Step 4: Read address
- Read 4 bytes at 0x8014: EC 44 02 02  
- Address = 0x020244EC (Emerald partyData!)
```

## CLI Tool Usage

```bash
# Test universal patterns on your ROM dump
npx tsx src/lib/signature/test-universal.ts /path/to/memory.bin

# Or use the main CLI tool
npx tsx src/lib/signature/cli.ts scan-universal --input=/path/to/memory.bin
```

## Expected Results

When patterns work correctly, you should see:

**For Pokemon Emerald:**
```
✅ SUCCESS: Found partyData address!
   Address: 0x020244EC
   Variant: emerald
   Method: direct_reference
   Confidence: high
```

**For Pokemon Quetzal:**
```
✅ SUCCESS: Found partyData address!
   Address: 0x020235B8  
   Variant: quetzal
   Method: thumb_pattern
   Confidence: medium
```

## Why These Patterns Work

1. **THUMB Pattern (48 ?? 68 ?? 30 ??):** 
   - `48 ??` = LDR r0-r7, [PC, #imm] (load from literal pool)
   - `68 ??` = LDR r0-r7, [r0-r7] (dereference pointer)
   - `30 ??` = ADDS r0-r7, #imm (add offset)
   - This sequence loads partyData base, dereferences it, then adds an offset

2. **ARM Size Pattern:**
   - `E0 ?? ?? 64/68` = ADD with Pokemon size (100 or 104 bytes)
   - `E5 9F ?? ??` = LDR from literal pool (loads partyData base)
   - `E0 8? ?? ??` = ADD to calculate final address
   - This calculates individual Pokemon slot addresses

## Troubleshooting

**Q: No patterns found?**
- Ensure your memory dump covers 0x02000000-0x02040000 range
- Try multiple ROM variants (US, EU, JP)
- ROM hacks may have relocated addresses

**Q: Found wrong addresses?**
- Verify little-endian byte order
- Check if you're using the right game variant
- Validate against known addresses: 0x020244EC (Emerald) or 0x020235B8 (Quetzal)

**Q: Multiple matches found?**
- This is normal - partyData is referenced in many places
- All valid matches should resolve to the same address
- Use the first match that gives the correct address

## ROM Hacking Notes

If you're working with ROM hacks that don't match these addresses:

1. Use Cheat Engine to find actual partyData location in RAM
2. Search for that address in your ROM dump using direct reference method
3. Look around found references for the ARM/THUMB instruction patterns
4. Extract new patterns following the same methodology

The key principle: Find instruction sequences that load the partyData address from memory or immediate values.