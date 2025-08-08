#!/usr/bin/env tsx

/**
 * Debug specific pattern matching issues
 */

import { parseHexPattern, matchesPattern } from '../src/lib/signature/behavioral-patterns.js';

function debugSpecificPattern() {
  console.log('🔧 Debugging Pokemon Size Calculation Pattern\n');
  
  // Recreate the exact mock data for size calculation
  const mockData = new Uint8Array([
    0xE0, 0x01, 0x10, 0x64,  // E0 01 10 64 - ADD r0, r1, r2, LSL with size 0x64
    0xE5, 0x9F, 0x08, 0x00   // E5 9F 08 00 - ARM LDR literal
  ]);
  
  const pattern = 'E0 ?? ?? 6[48] E5 9F ?? ??';
  console.log(`Testing pattern: "${pattern}"`);
  console.log(`Mock data: [${Array.from(mockData).map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);
  
  const parsed = parseHexPattern(pattern);
  console.log(`Parsed bytes: [${parsed.bytes.map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);
  console.log(`Parsed mask:  [${parsed.mask.map(m => m.toString(16).padStart(2, '0')).join(' ')}]`);
  
  const matches = matchesPattern(mockData, 0, parsed);
  console.log(`Matches: ${matches}\n`);
  
  // Test each byte individually
  console.log('Byte-by-byte analysis:');
  for (let i = 0; i < parsed.bytes.length; i++) {
    const dataByte = mockData[i] ?? 0;
    const patternByte = parsed.bytes[i] ?? 0;
    const maskByte = parsed.mask[i] ?? 0;
    const match = (dataByte & maskByte) === (patternByte & maskByte);
    console.log(`  [${i}] data=0x${dataByte.toString(16)} & 0x${maskByte.toString(16)} = 0x${(dataByte & maskByte).toString(16)}`);
    console.log(`      pattern=0x${patternByte.toString(16)} & 0x${maskByte.toString(16)} = 0x${(patternByte & maskByte).toString(16)} → ${match ? '✅' : '❌'}`);
  }
  
  // Test THUMB pattern too
  console.log('\n🔧 Debugging THUMB Pattern\n');
  
  const thumbData = new Uint8Array([
    0x48, 0x04,  // LDR r0, [PC, #16]
    0x68, 0x00,  // LDR r0, [r0]
    0x30, 0x64   // ADDS r0, #100
  ]);
  
  const thumbPattern = '48 ?? 68 ?? 0[01-69] 30';
  console.log(`Testing pattern: "${thumbPattern}"`);
  console.log(`THUMB data: [${Array.from(thumbData).map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);
  
  const thumbParsed = parseHexPattern(thumbPattern);
  console.log(`Parsed bytes: [${thumbParsed.bytes.map(b => b.toString(16).padStart(2, '0')).join(' ')}]`);
  console.log(`Parsed mask:  [${thumbParsed.mask.map(m => m.toString(16).padStart(2, '0')).join(' ')}]`);
  
  const thumbMatches = matchesPattern(thumbData, 0, thumbParsed);
  console.log(`Matches: ${thumbMatches}\n`);
  
  // Test each byte
  console.log('THUMB byte-by-byte analysis:');
  for (let i = 0; i < thumbParsed.bytes.length; i++) {
    const dataByte = thumbData[i] ?? 0;
    const patternByte = thumbParsed.bytes[i] ?? 0;
    const maskByte = thumbParsed.mask[i] ?? 0;
    const match = (dataByte & maskByte) === (patternByte & maskByte);
    console.log(`  [${i}] data=0x${dataByte.toString(16)} & 0x${maskByte.toString(16)} = 0x${(dataByte & maskByte).toString(16)}`);
    console.log(`      pattern=0x${patternByte.toString(16)} & 0x${maskByte.toString(16)} = 0x${(patternByte & maskByte).toString(16)} → ${match ? '✅' : '❌'}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  debugSpecificPattern();
}