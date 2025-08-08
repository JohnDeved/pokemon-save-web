#!/usr/bin/env tsx

/**
 * Debug behavioral pattern parsing
 */

import { parseHexPattern, matchesPattern } from '../src/lib/signature/behavioral-patterns.js';

function debugPatternParsing() {
  console.log('🔧 Debugging Behavioral Pattern Parsing\n');
  
  // Test the hex pattern parsing
  const testPatterns = [
    '06 20 ?? ?? ?? ?? ?? ?? ?? E5',
    'E0 ?? ?? 6[48] E5 9F ?? ??',
    '48 ?? 68 ?? 0[01-69] 30',
    '05 28 ?? D[2-9] E5 9F ?? ??'
  ];
  
  for (const pattern of testPatterns) {
    console.log(`\n📋 Testing pattern: "${pattern}"`);
    try {
      const parsed = parseHexPattern(pattern);
      console.log(`   Parsed bytes: [${parsed.bytes.map(b => b.toString(16).padStart(2, '0')).join(', ')}]`);
      console.log(`   Parsed mask:  [${parsed.mask.map(m => m.toString(16).padStart(2, '0')).join(', ')}]`);
    } catch (error) {
      console.log(`   ❌ Error parsing: ${error}`);
    }
  }
  
  // Test specific mock data matching
  console.log('\n🧪 Testing Mock Data Matching\n');
  
  // Create mock data that should match pattern 2
  const mockData = new Uint8Array([
    0xE0, 0x01, 0x10, 0x64,  // E0 ?? ?? 64 (size calculation)
    0xE5, 0x9F, 0x08, 0x00   // E5 9F ?? ?? (LDR literal)
  ]);
  
  const pattern2 = 'E0 ?? ?? 6[48] E5 9F ?? ??';
  console.log(`Testing pattern: "${pattern2}"`);
  console.log(`Mock data: [${Array.from(mockData).map(b => b.toString(16).padStart(2, '0')).join(', ')}]`);
  
  try {
    const parsed = parseHexPattern(pattern2);
    console.log(`Parsed bytes: [${parsed.bytes.map(b => b.toString(16).padStart(2, '0')).join(', ')}]`);
    console.log(`Parsed mask:  [${parsed.mask.map(m => m.toString(16).padStart(2, '0')).join(', ')}]`);
    
    const matches = matchesPattern(mockData, 0, parsed);
    console.log(`Matches: ${matches}`);
    
    // Manual check
    console.log('\nManual verification:');
    for (let i = 0; i < parsed.bytes.length; i++) {
      const dataByte = mockData[i] ?? 0;
      const patternByte = parsed.bytes[i] ?? 0;
      const maskByte = parsed.mask[i] ?? 0;
      const match = (dataByte & maskByte) === (patternByte & maskByte);
      console.log(`  [${i}] data=0x${dataByte.toString(16)} pattern=0x${patternByte.toString(16)} mask=0x${maskByte.toString(16)} → ${match ? '✅' : '❌'}`);
    }
    
  } catch (error) {
    console.log(`❌ Error: ${error}`);
  }
  
  // Test a simple THUMB pattern
  console.log('\n🧪 Testing THUMB Pattern\n');
  
  const thumbData = new Uint8Array([
    0x48, 0x04,  // LDR r0, [PC, #16]
    0x68, 0x00,  // LDR r0, [r0]
    0x30, 0x64   // ADDS r0, #100
  ]);
  
  const thumbPattern = '48 ?? 68 ?? 30 ??';
  console.log(`Testing pattern: "${thumbPattern}"`);
  console.log(`THUMB data: [${Array.from(thumbData).map(b => b.toString(16).padStart(2, '0')).join(', ')}]`);
  
  try {
    const parsed = parseHexPattern(thumbPattern);
    console.log(`Parsed bytes: [${parsed.bytes.map(b => b.toString(16).padStart(2, '0')).join(', ')}]`);
    console.log(`Parsed mask:  [${parsed.mask.map(m => m.toString(16).padStart(2, '0')).join(', ')}]`);
    
    const matches = matchesPattern(thumbData, 0, parsed);
    console.log(`Matches: ${matches}`);
    
  } catch (error) {
    console.log(`❌ Error: ${error}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  debugPatternParsing();
}