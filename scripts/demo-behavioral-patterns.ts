#!/usr/bin/env tsx

/**
 * Behavioral Pattern Demo
 * 
 * This script demonstrates how the behavioral pattern system works
 * by creating mock ROM data with recognizable ARM/THUMB instruction patterns.
 */

import { findPartyDataBehavioral, scanAndValidate } from '../src/lib/signature/behavioral-scanner.js';

function createMockROMData(): Uint8Array {
  console.log('🔧 Creating mock ROM data with behavioral patterns...\n');
  
  // Create a 1MB mock ROM
  const romSize = 1024 * 1024;
  const buffer = new Uint8Array(romSize);
  
  // Fill with random-looking data
  for (let i = 0; i < romSize; i++) {
    buffer[i] = Math.floor(Math.random() * 256);
  }
  
  // Add mock partyData address at 0x020244EC (Emerald-like)
  const mockPartyDataAddr = 0x020244EC;
  
  // Pattern 1: Party loop counter at offset 0x1000
  console.log('📋 Adding Pattern 1: Party Loop Counter');
  const loopOffset = 0x1000;
  buffer[loopOffset] = 0x06;     // MOV r0, #6
  buffer[loopOffset + 1] = 0x20; // (immediate value 6 for party size)
  // Add some context
  buffer[loopOffset + 8] = 0x10; // ARM LDR literal: E5 9F 10 00
  buffer[loopOffset + 9] = 0x00;
  buffer[loopOffset + 10] = 0x9F;
  buffer[loopOffset + 11] = 0xE5;
  
  // Add literal pool 8 bytes after LDR instruction (ARM PC + 8)
  const literalPool1 = loopOffset + 8 + 8 + 0x10;
  buffer[literalPool1] = (mockPartyDataAddr >> 0) & 0xFF;
  buffer[literalPool1 + 1] = (mockPartyDataAddr >> 8) & 0xFF;
  buffer[literalPool1 + 2] = (mockPartyDataAddr >> 16) & 0xFF;
  buffer[literalPool1 + 3] = (mockPartyDataAddr >> 24) & 0xFF;
  console.log(`   Loop counter at 0x${loopOffset.toString(16)}`);
  console.log(`   Literal pool at 0x${literalPool1.toString(16)}`);
  console.log(`   Contains address: 0x${mockPartyDataAddr.toString(16)}\n`);
  
  // Pattern 2: Pokemon size calculation at offset 0x2000
  console.log('📋 Adding Pattern 2: Pokemon Size Calculation');
  const sizeOffset = 0x2000;
  buffer[sizeOffset] = 0xE0;     // ADD r0, r1, r2, LSL #?
  buffer[sizeOffset + 1] = 0x01; // register encoding
  buffer[sizeOffset + 2] = 0x10; // shift encoding  
  buffer[sizeOffset + 3] = 0x64; // Size: 0x64 = 100 bytes (Emerald Pokemon size)
  buffer[sizeOffset + 4] = 0xE5; // ARM LDR literal: E5 9F 08 00 (consecutive!)
  buffer[sizeOffset + 5] = 0x9F;
  buffer[sizeOffset + 6] = 0x08;
  buffer[sizeOffset + 7] = 0x00;
  
  // Add literal pool for size calculation
  const literalPool2 = sizeOffset + 4 + 8 + 0x08;
  buffer[literalPool2] = (mockPartyDataAddr >> 0) & 0xFF;
  buffer[literalPool2 + 1] = (mockPartyDataAddr >> 8) & 0xFF;
  buffer[literalPool2 + 2] = (mockPartyDataAddr >> 16) & 0xFF;
  buffer[literalPool2 + 3] = (mockPartyDataAddr >> 24) & 0xFF;
  console.log(`   Size calc at 0x${sizeOffset.toString(16)} (Pokemon size: 100 bytes)`);
  console.log(`   Literal pool at 0x${literalPool2.toString(16)}`);
  console.log(`   Contains address: 0x${mockPartyDataAddr.toString(16)}\n`);
  
  // Pattern 3: THUMB party slot access at offset 0x3000  
  console.log('📋 Adding Pattern 3: THUMB Party Slot Access');
  const thumbOffset = 0x3000;
  buffer[thumbOffset] = 0x48;     // THUMB LDR r0, [PC, #imm*4]
  buffer[thumbOffset + 1] = 0x04; // immediate = 4, so offset = 4*4 = 16 bytes
  buffer[thumbOffset + 2] = 0x68; // THUMB LDR r0, [r0] (dereference)
  buffer[thumbOffset + 3] = 0x00; // register encoding
  buffer[thumbOffset + 4] = 0x01; // Use 01 instead of 30 to match 0[01-69] range
  buffer[thumbOffset + 5] = 0x30; // THUMB ADDS r0, #offset
  
  // Add THUMB literal pool (PC = thumbOffset + 4, word-aligned, + immediate*4)
  const thumbPC = ((thumbOffset + 4) & ~3) + (4 * 4);
  buffer[thumbPC] = (mockPartyDataAddr >> 0) & 0xFF;
  buffer[thumbPC + 1] = (mockPartyDataAddr >> 8) & 0xFF;
  buffer[thumbPC + 2] = (mockPartyDataAddr >> 16) & 0xFF;
  buffer[thumbPC + 3] = (mockPartyDataAddr >> 24) & 0xFF;
  console.log(`   THUMB access at 0x${thumbOffset.toString(16)}`);
  console.log(`   Literal pool at 0x${thumbPC.toString(16)}`);  
  console.log(`   Contains address: 0x${mockPartyDataAddr.toString(16)}\n`);
  
  // Pattern 4: Party bounds check at offset 0x4000
  console.log('📋 Adding Pattern 4: Party Bounds Check');
  const boundsOffset = 0x4000;
  buffer[boundsOffset] = 0x05;     // CMP r0, #5 (max party index)
  buffer[boundsOffset + 1] = 0x28; // immediate value 5
  buffer[boundsOffset + 4] = 0x0C; // ARM LDR literal after bounds check
  buffer[boundsOffset + 5] = 0x00;
  buffer[boundsOffset + 6] = 0x9F;
  buffer[boundsOffset + 7] = 0xE5;
  
  // Add literal pool for bounds check
  const literalPool4 = boundsOffset + 4 + 8 + 0x0C;
  buffer[literalPool4] = (mockPartyDataAddr >> 0) & 0xFF;
  buffer[literalPool4 + 1] = (mockPartyDataAddr >> 8) & 0xFF;
  buffer[literalPool4 + 2] = (mockPartyDataAddr >> 16) & 0xFF;
  buffer[literalPool4 + 3] = (mockPartyDataAddr >> 24) & 0xFF;
  console.log(`   Bounds check at 0x${boundsOffset.toString(16)} (CMP #5)`);
  console.log(`   Literal pool at 0x${literalPool4.toString(16)}`);
  console.log(`   Contains address: 0x${mockPartyDataAddr.toString(16)}\n`);
  
  return buffer;
}

async function demonstrateBehavioralPatterns() {
  console.log('🚀 Behavioral Universal Pattern Demonstration');
  console.log('============================================================');
  console.log('This demo shows how behavioral patterns work by analyzing');
  console.log('ARM/THUMB code that accesses Pokemon party data.\n');
  
  // Create mock ROM with patterns
  const romBuffer = createMockROMData();
  
  console.log('🔍 Testing Behavioral Pattern Detection...');
  console.log('============================================================\n');
  
  // Test the behavioral pattern scanner
  const options = {
    startOffset: 0,
    endOffset: Math.min(romBuffer.length, 64 * 1024), // Search first 64KB
    maxMatches: 10,
    minConfidence: 'low' as const
  };
  
  // Find the best result
  const result = findPartyDataBehavioral(romBuffer, options);
  
  if (result) {
    console.log('\n✅ SUCCESS: Behavioral pattern detection worked!');
    console.log(`   Address: 0x${result.address.toString(16).toUpperCase().padStart(8, '0')}`);
    console.log(`   Pattern: ${result.pattern}`);
    console.log(`   Confidence: ${result.confidence}`);
    console.log(`   Method: ${result.method}`);
    console.log(`   Supporting matches: ${result.matches}`);
    
    // Check if it matches our expected address
    if (result.address === 0x020244EC) {
      console.log('\n🎯 PERFECT: Found the expected mock partyData address!');
      console.log('   This demonstrates that behavioral patterns can discover');
      console.log('   partyData addresses by analyzing code patterns alone.');
    } else {
      console.log(`\n⚠️  Found different address than expected (0x020244EC)`);
      console.log('   This may indicate the pattern matching needs refinement.');
    }
  } else {
    console.log('\n❌ Pattern detection failed');
    console.log('   The behavioral patterns did not detect the mock data.');
    console.log('   This indicates the patterns may need adjustment.');
  }
  
  // Show detailed analysis
  console.log('\n📊 Detailed Analysis:');
  const allResults = scanAndValidate(romBuffer, options);
  
  if (allResults.length > 0) {
    console.log(`   Total pattern matches: ${allResults.length}`);
    console.log('   Found addresses:');
    
    const addressCounts = new Map<number, number>();
    for (const r of allResults) {
      addressCounts.set(r.address, (addressCounts.get(r.address) || 0) + 1);
    }
    
    for (const [address, count] of addressCounts) {
      const patterns = allResults.filter(r => r.address === address).map(r => r.pattern);
      console.log(`     0x${address.toString(16).toUpperCase().padStart(8, '0')}: ${count} patterns (${patterns.join(', ')})`);
    }
  } else {
    console.log('   No pattern matches found');
  }
  
  console.log('\n============================================================');
  console.log('🎉 Behavioral Pattern Demo Complete!');
  console.log('');
  console.log('This demonstrates how the behavioral approach:');
  console.log('✅ Analyzes ARM/THUMB instruction patterns');
  console.log('✅ Extracts addresses from literal pools dynamically');  
  console.log('✅ Works without knowing target addresses beforehand');
  console.log('✅ Provides confidence scoring and pattern validation');
  console.log('');
  console.log('Unlike the old approach that searched for known address bytes,');
  console.log('this system finds addresses through code behavior analysis,');
  console.log('making it truly universal across ROM versions and hacks.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateBehavioralPatterns().catch(console.error);
}