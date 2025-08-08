#!/usr/bin/env tsx

/**
 * Debug ROM Patterns
 * Check what's actually in the mock ROM and test simple pattern matching
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function hexDump(buffer: Uint8Array, offset: number, length: number = 32): void {
  console.log(`Hex dump at offset 0x${offset.toString(16).padStart(4, '0')}:`);
  
  for (let i = 0; i < length; i += 16) {
    const lineOffset = offset + i;
    const hex = Array.from(buffer.slice(lineOffset, lineOffset + 16))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ');
    
    const ascii = Array.from(buffer.slice(lineOffset, lineOffset + 16))
      .map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.')
      .join('');
    
    console.log(`  ${lineOffset.toString(16).padStart(6, '0')}: ${hex.padEnd(47)} |${ascii}|`);
  }
  console.log('');
}

function findSimplePattern(buffer: Uint8Array, pattern: number[]): number[] {
  const matches: number[] = [];
  
  for (let i = 0; i <= buffer.length - pattern.length; i++) {
    let match = true;
    for (let j = 0; j < pattern.length; j++) {
      if (buffer[i + j] !== pattern[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      matches.push(i);
    }
  }
  
  return matches;
}

async function debugROMPatterns() {
  console.log('🔍 ROM Pattern Debug Analysis');
  console.log('============================================================\n');
  
  const emeraldPath = resolve(__dirname, '..', 'docker', 'test_data', 'emerald.gba');
  const buffer = new Uint8Array(readFileSync(emeraldPath));
  
  console.log(`ROM size: ${buffer.length} bytes`);
  console.log(`First 4 bytes: ${Array.from(buffer.slice(0, 4)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ')}`);
  
  // Check the known pattern locations
  console.log('\n📋 Checking Known Pattern Locations:');
  
  // Pattern 1: Party size loop at 0x1000
  console.log('\n1. Party Size Loop (expected at 0x1000):');
  hexDump(buffer, 0x1000, 32);
  
  // Look for 06 20 pattern
  const pattern1 = [0x06, 0x20];
  const matches1 = findSimplePattern(buffer, pattern1);
  console.log(`Found "06 20" pattern at: ${matches1.map(m => '0x' + m.toString(16)).join(', ')}`);
  
  // Pattern 2: Pokemon size at 0x2000  
  console.log('\n2. Pokemon Size Calculation (expected at 0x2000):');
  hexDump(buffer, 0x2000, 32);
  
  // Look for 64 pattern (0x64 = 100 bytes)
  const pattern2 = [0x64];
  const matches2 = findSimplePattern(buffer, pattern2);
  console.log(`Found "64" byte at: ${matches2.slice(0, 10).map(m => '0x' + m.toString(16)).join(', ')} (showing first 10)`);
  
  // Pattern 3: THUMB at 0x3000
  console.log('\n3. THUMB Party Base (expected at 0x3000):');
  hexDump(buffer, 0x3000, 32);
  
  // Look for 48 pattern
  const pattern3 = [0x48];
  const matches3 = findSimplePattern(buffer, pattern3);
  console.log(`Found "48" byte at: ${matches3.slice(0, 10).map(m => '0x' + m.toString(16)).join(', ')} (showing first 10)`);
  
  // Pattern 4: Bounds check at 0x4000
  console.log('\n4. Party Bounds Check (expected at 0x4000):');
  hexDump(buffer, 0x4000, 32);
  
  // Look for 05 28 pattern
  const pattern4 = [0x05, 0x28];
  const matches4 = findSimplePattern(buffer, pattern4);
  console.log(`Found "05 28" pattern at: ${matches4.map(m => '0x' + m.toString(16)).join(', ')}`);
  
  // Test individual behavioral patterns
  console.log('\n📋 Testing Individual Behavioral Patterns:');
  
  // Test the party size loop pattern: 06 ?? ?? ?? ?? ?? E5 9F
  console.log('\n🔍 Testing: 06 ?? ?? ?? ?? ?? E5 9F');
  for (let i = 0; i <= buffer.length - 8; i++) {
    if (buffer[i] === 0x06 && 
        buffer[i + 6] === 0xE5 && 
        buffer[i + 7] === 0x9F) {
      console.log(`   Match at 0x${i.toString(16)}: ${Array.from(buffer.slice(i, i + 8)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
    }
  }
  
  // Test the pokemon size pattern: 64 ?? ?? ?? E5 9F ?? ??
  console.log('\n🔍 Testing: 64 ?? ?? ?? E5 9F ?? ??');
  for (let i = 0; i <= buffer.length - 8; i++) {
    if (buffer[i] === 0x64 && 
        buffer[i + 4] === 0xE5 && 
        buffer[i + 5] === 0x9F) {
      console.log(`   Match at 0x${i.toString(16)}: ${Array.from(buffer.slice(i, i + 8)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
    }
  }
  
  // Test THUMB pattern: 48 ?? 68 ?? ?? 30
  console.log('\n🔍 Testing: 48 ?? 68 ?? ?? 30');
  for (let i = 0; i <= buffer.length - 6; i++) {
    if (buffer[i] === 0x48 && 
        buffer[i + 2] === 0x68 && 
        buffer[i + 5] === 0x30) {
      console.log(`   Match at 0x${i.toString(16)}: ${Array.from(buffer.slice(i, i + 6)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
    }
  }
  
  // Test bounds check: 05 ?? ?? D? E5 9F
  console.log('\n🔍 Testing: 05 ?? ?? ?? E5 9F');
  for (let i = 0; i <= buffer.length - 6; i++) {
    if (buffer[i] === 0x05 && 
        buffer[i + 4] === 0xE5 && 
        buffer[i + 5] === 0x9F) {
      console.log(`   Match at 0x${i.toString(16)}: ${Array.from(buffer.slice(i, i + 6)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
    }
  }
  
  console.log('\n============================================================');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  debugROMPatterns().catch(console.error);
}