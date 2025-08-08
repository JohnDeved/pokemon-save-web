# ASM Signature System for Dynamic Memory Address Resolution

The ASM Signature System replaces hardcoded memory addresses with dynamic pattern-based resolution, enabling Pokemon Save Web to work across different ROM variants without manual address updates.

## Overview

Instead of hardcoding addresses like `partyData: 0x020244EC`, the system:

1. **Scans memory** for ARM/THUMB instruction patterns that access party data
2. **Resolves addresses** dynamically by analyzing instruction operands
3. **Falls back** to known addresses if signature matching fails
4. **Caches results** to avoid repeated scanning

## Architecture

```
Memory Buffer → Signature Scanner → Address Resolver → Game Config
                      ↓
            Pattern Matching with Wildcards
                      ↓
          ARM/THUMB Instruction Decoding
                      ↓
         Dynamic Address Resolution + Fallback
```

## Core Components

### 1. Signature Scanner (`src/lib/signature/scanner.ts`)

Performs pattern matching with wildcard support:

```typescript
import { SignatureScanner } from './signature/scanner'

// Create pattern from IDA-style signature
const pattern = SignatureScanner.createPattern('E5 9F ? ? 01 C0')

// Scan memory buffer
const scanner = new SignatureScanner()
const results = scanner.scan(memoryBuffer, 'emerald')
```

### 2. Address Resolvers (`src/lib/signature/resolver.ts`)

Decode instruction operands to resolve target addresses:

```typescript
// ARM LDR literal: LDR r0, [PC, #offset]
armLdrLiteralResolver.resolve(match, buffer) // → target address

// THUMB LDR literal: LDR r0, [PC, #offset]  
thumbLdrLiteralResolver.resolve(match, buffer) // → target address
```

### 3. Pre-defined Patterns (`src/lib/signature/patterns.ts`)

Common patterns for party data access:

```typescript
import { PARTY_DATA_SIGNATURES, createPartyDataScanner } from './signature/patterns'

// Pre-loaded scanner with all party data signatures
const scanner = createPartyDataScanner()
const results = scanner.scan(buffer, variant)
```

### 4. Integration Layer (`src/lib/signature/address-resolver.ts`)

Provides signature-aware memory addresses:

```typescript
import { createSignatureMemoryAddresses } from './signature/address-resolver'

const memoryAddresses = createSignatureMemoryAddresses(
  0x020244EC, // fallback partyData
  0x020244E9, // fallback partyCount  
  0x258       // enemy party offset
)

// Enable signature resolution
memoryAddresses.enableSignatureResolution(memoryBuffer, 'emerald')

// Addresses now resolve dynamically
console.log(memoryAddresses.partyData) // → resolved or fallback address
```

## Usage

### Enhanced Game Configurations

Use signature-enhanced configs for automatic address resolution:

```typescript
import { VanillaConfigWithSignatures } from './games/vanilla/config-with-signatures'
import { QuetzalConfigWithSignatures } from './games/quetzal/config-with-signatures'

const config = new VanillaConfigWithSignatures()

// When memory data becomes available
config.enableSignatureResolution(memoryBuffer)

// Addresses now resolve dynamically
console.log(config.memoryAddresses.partyData)
```

### Memory Dump Analysis

Use the CLI tool for signature extraction and analysis:

```bash
# Dump memory from both ROM variants
npx tsx src/lib/signature/cli.ts dump-memory --output=./dumps

# Test signatures against memory dumps
npx tsx src/lib/signature/cli.ts test-signatures --variant=emerald --input=./dumps/emerald/memory.bin

# Validate signatures work across variants
npx tsx src/lib/signature/cli.ts validate --input=./dumps

# Scan individual dump files
npx tsx src/lib/signature/cli.ts scan-dump --input=memory.bin --variant=emerald
```

### Custom Signature Creation

Create your own signatures for specific patterns:

```typescript
import { SignatureScanner } from './signature/scanner'
import { armLdrLiteralResolver } from './signature/resolver'

const customSignature: AsmSignature = {
  name: 'custom_party_access',
  mode: 'ARM',
  pattern: SignatureScanner.createPattern('E5 9F ? ? E1 A0 ? ?'),
  resolver: armLdrLiteralResolver,
  supportedVariants: ['emerald', 'quetzal'],
}

const scanner = new SignatureScanner()
scanner.addSignature(customSignature)
```

## Signature Patterns

### ARM LDR Literal Pattern
```
E5 9F ? ?     LDR Rt, [PC, #imm12]
```
- Loads a 32-bit address from PC-relative literal pool
- Common in initialization and accessor functions
- Resolves to address at PC+8+imm12

### THUMB LDR Literal Pattern  
```
48 ?          LDR r0, [PC, #imm8*4]
```
- Loads a 32-bit address from word-aligned literal pool
- Common in optimized/newer code sections
- Resolves to address at (PC&~3)+4+imm8*4

### Party Count Access Pattern
```
48 ? 78 ? 28 06    LDR r0, [PC, #imm]; LDRB r0, [r0]; CMP r0, #6
```
- Accesses party count (max 6 Pokemon)
- Party data typically starts 3 bytes after count
- Resolves to count address + 3

### Pokemon Structure Iteration
```
E2 8? ? 64         ADD r?, r?, #100    (Vanilla)
E2 8? ? 68         ADD r?, r?, #104    (Quetzal)
```
- Iterates through Pokemon structures
- 100 bytes per Pokemon (Vanilla) or 104 bytes (Quetzal)
- Indicates partyData base address usage

## Memory Dump Acquisition

### Using mGBA Docker

The system includes Docker integration for memory acquisition:

```typescript
import { MemoryAnalysisOrchestrator } from './signature/memory-dumper'

const orchestrator = new MemoryAnalysisOrchestrator()

// Analyze both variants
const results = await orchestrator.analyzePartyDataMemory('./output')

// Quick dump for testing
const dumps = await orchestrator.quickMemoryDump('emerald', './output')
```

### GDB Integration

Capture memory access contexts for signature extraction:

```typescript
import { GdbMemoryAnalyzer } from './signature/memory-dumper'

const analyzer = new GdbMemoryAnalyzer()
await analyzer.connect()

// Set watchpoints and capture access patterns
const contexts = await analyzer.capturePartyDataAccesses([0x020244EC])
```

## Testing and Validation

### Signature Resolution Testing

```typescript
import { testSignatureResolution } from './signature/address-resolver'

const result = await testSignatureResolution(
  memoryBuffer,
  'emerald',
  { partyData: 0x020244EC }
)

console.log(result.success)           // → resolution succeeded
console.log(result.resolvedPartyData) // → resolved address
console.log(result.matches)          // → number of signatures matched
```

### Integration Testing

```typescript
import { VanillaConfigWithSignatures } from './games/vanilla/config-with-signatures'

const config = new VanillaConfigWithSignatures()
config.enableSignatureResolution(memoryBuffer)

const addresses = config.getResolvedAddresses()
console.log(addresses.usingSignatures) // → true if signatures resolved
console.log(addresses.partyData)       // → resolved address
console.log(addresses.fallbackPartyData) // → fallback address
```

## Error Handling and Fallbacks

The system is designed to be robust:

1. **Signature Resolution Fails**: Falls back to known hardcoded addresses
2. **Multiple Matches**: Uses preferred signature priority order
3. **No Matches**: Gracefully degrades to fallback mode
4. **Invalid Memory**: Handles boundary checks and invalid instruction patterns

```typescript
// Always safe - falls back to known addresses
const partyData = config.memoryAddresses.partyData

// Check if signatures were used
const resolved = config.getResolvedAddresses()
if (resolved.usingSignatures) {
  console.log('✅ Using signature-resolved addresses')
} else {
  console.log('⏪ Using fallback addresses')
}
```

## Performance Considerations

- **Caching**: Resolved addresses are cached to avoid repeated scanning
- **Lazy Scanning**: Signatures are only scanned when memory buffer is provided
- **Efficient Patterns**: Signatures use wildcards to minimize false matches
- **Variant Filtering**: Only relevant signatures are scanned per ROM variant

## Future Extensions

The signature system is designed for extensibility:

1. **New ROM Variants**: Add signatures for additional Pokemon games
2. **New Memory Regions**: Extend beyond party data (items, PC boxes, etc.)
3. **Dynamic Pattern Learning**: Extract patterns from runtime memory analysis
4. **Cross-Architecture Support**: Extend beyond ARM7TDMI (GBA) to other processors

## Troubleshooting

Common issues and solutions:

### Signatures Not Matching
```bash
# Test signatures against your memory dump
npx tsx src/lib/signature/cli.ts test-signatures --input=memory.bin --variant=emerald --verbose
```

### Address Resolution Failing
```typescript
// Check resolver errors
const results = scanner.scan(buffer, variant)
console.log(results.errors) // → resolution error details
```

### Memory Dump Issues
```bash
# Verify mGBA Docker setup
npm run mgba -- run:build --game emerald

# Check container logs
npm run mgba -- logs
```

For detailed examples and advanced usage, see the integration tests in `src/lib/parser/__tests__/signature-integration.test.ts`.