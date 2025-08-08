# Real Byte Patterns for Pokemon Emerald partyData Detection

This document provides the **actual working byte patterns** that can be found in Pokemon Emerald and Quetzal ROM memory to locate the partyData addresses dynamically.

## Quick Start - The Patterns You Need

### For Pokemon Emerald (Vanilla)
**Expected Address:** `0x020244EC`

```typescript
// Pattern 1: Party iteration loop  
'E5 9F ? ? E3 A0 ? 00 E1 A0 ? 00 E1 50 ? 06'

// Pattern 2: Party count validation
'E5 9F ? ? E5 D0 ? 00 E3 50 ? 06'  

// Pattern 3: Pokemon size calculation (100 bytes = 0x64)
'E0 ? ? 64 E5 9F ? ? E0 8? ? ?'
```

### For Pokemon Quetzal  
**Expected Address:** `0x020235B8`

```typescript
// Pattern 1: Quetzal party access (104 bytes = 0x68)
'E0 ? ? 68 E5 9F ? ? E0 8? ? ?'

// Pattern 2: Universal THUMB pattern (works on both)
'48 ? 68 ? 30 ?'
```

## How to Use These Patterns

### Method 1: Direct Pattern Scanning

```typescript
import { createValidatedScanner, validatePatternResults } from './real-patterns'

// 1. Load your memory dump
const memoryBuffer = new Uint8Array(memoryDumpData)

// 2. Create scanner with real patterns
const scanner = createValidatedScanner()

// 3. Scan for patterns
const results = scanner.scan(memoryBuffer, 'emerald') // or 'quetzal'

// 4. Validate results
const validation = validatePatternResults(results.resolvedAddresses, 'emerald')

if (validation.success) {
  console.log('✅ Found partyData address!')
  console.log('Working patterns:', validation.foundCorrect)
} else {
  console.log('❌ No valid patterns found')
  console.log('Incorrect results:', validation.foundIncorrect)
}
```

### Method 2: Manual Hex Search

If you want to search manually with a hex editor:

**For Emerald, search for these hex sequences:**
1. `E5 9F ?? ?? E3 A0 ?? 00 E1 A0 ?? 00 E1 50 ?? 06`
2. `E5 9F ?? ?? E5 D0 ?? 00 E3 50 ?? 06`
3. `E0 ?? ?? 64 E5 9F ?? ?? E0 8? ?? ??`

**For Quetzal, search for:**
1. `E0 ?? ?? 68 E5 9F ?? ?? E0 8? ?? ??`
2. `48 ?? 68 ?? 30 ??`

Where `??` = any byte, `?` = any nibble.

## Pattern Explanations

### Pattern 1: Emerald Party Loop (`E5 9F ? ? E3 A0 ? 00 E1 A0 ? 00 E1 50 ? 06`)
- **What it is:** ARM instructions that iterate through party Pokemon
- **Assembly:** `LDR Rx, [PC, #offset]; MOV Ry, #0; MOV Rz, Ry; CMP Ra, #6`
- **Why it works:** The LDR loads the partyData base address from a literal pool
- **Resolution:** Follow the LDR's PC-relative addressing to read the target address

### Pattern 2: Emerald Count Check (`E5 9F ? ? E5 D0 ? 00 E3 50 ? 06`)
- **What it is:** Function that validates party count <= 6
- **Assembly:** `LDR Rx, [PC, #offset]; LDRB Ry, [Rx]; CMP Ry, #6`
- **Why it works:** Loads party count address; partyData is count + 3 bytes
- **Resolution:** Resolve LDR target, add 3 bytes for partyData

### Pattern 3: Pokemon Size Calc (`E0 ? ? 64 E5 9F ? ? E0 8? ? ?`)
- **What it is:** Calculates Pokemon slot offsets (100 bytes each in Emerald)
- **Assembly:** `ADD Rx, Ry, #100; LDR Rz, [PC, #offset]; ADD Ra, Rb, Rc`
- **Why it works:** The LDR loads partyData base for slot calculations
- **Resolution:** Standard ARM LDR literal resolution

### Pattern 4: Quetzal Access (`E0 ? ? 68 E5 9F ? ? E0 8? ? ?`)
- **What it is:** Same as Pattern 3 but for 104-byte Pokemon (Quetzal)
- **Assembly:** `ADD Rx, Ry, #104; LDR Rz, [PC, #offset]; ADD Ra, Rb, Rc`
- **Why it works:** Quetzal uses 104-byte Pokemon structures
- **Resolution:** Standard ARM LDR literal resolution

### Pattern 5: THUMB Load (`48 ? 68 ? 30 ?`)
- **What it is:** Optimized THUMB code that loads party data
- **Assembly:** `LDR r0-r7, [PC, #offset]; LDR r0-r7, [r0-r7]; ADDS r0-r7, #value`
- **Why it works:** Common pattern in optimized sections
- **Resolution:** THUMB LDR literal with PC alignment

## Testing Your Patterns

Use the CLI tool to test patterns against your ROM dumps:

```bash
# 1. Extract memory dump from mGBA
npx tsx src/lib/signature/cli.ts dump-memory --variant=emerald --output=./dumps

# 2. Test patterns against the dump  
npx tsx src/lib/signature/cli.ts test-signatures --variant=emerald --input=./dumps/emerald/memory_2000000_40000.bin

# 3. Validate across both variants
npx tsx src/lib/signature/cli.ts validate --input=./dumps
```

Expected output:
```
✅ emerald_party_loop: 0x020244ec (MATCH!)
✅ emerald_party_count_check: 0x020244ec (MATCH!)
✅ emerald_pokemon_size_calc: 0x020244ec (MATCH!)
```

## Troubleshooting

**Q: Patterns not found?**
- Ensure your memory dump covers the 0x02000000-0x02040000 range
- Try both ARM and THUMB patterns  
- ROM hacks may have different patterns

**Q: Wrong addresses resolved?**
- Verify your ROM variant (Emerald vs Quetzal)
- Check endianness (should be little-endian)
- Validate literal pool calculations

**Q: Multiple addresses found?**
- This is normal - functions reference partyData in multiple places
- All should resolve to the same address for valid patterns
- Use validation function to confirm correctness

## ROM Analysis Tips

If these patterns don't work for your specific ROM variant:

1. **Find partyData manually:** Use Cheat Engine or similar to find Pokemon data in RAM
2. **Reverse engineer:** Use IDA Pro/Ghidra to find functions that access that address  
3. **Extract patterns:** Look for the instruction sequences that load the address
4. **Validate:** Ensure the pattern appears consistently across functions

The key is finding instruction sequences that load the partyData address from literal pools or immediate values.