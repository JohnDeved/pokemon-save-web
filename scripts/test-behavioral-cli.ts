#!/usr/bin/env tsx

/**
 * Simple CLI tool to test behavioral patterns on ROM files
 * This demonstrates the behavioral pattern approach without needing mGBA
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { 
  findPartyDataBehavioral, 
  scanAndValidate 
} from '../src/lib/signature/behavioral-scanner.js';

function printUsage() {
  console.log(`
🔍 Behavioral Pattern Scanner

Usage:
  npx tsx scripts/test-behavioral-cli.ts <rom-file>

This tool tests the new behavioral pattern approach that finds partyData addresses
through ARM/THUMB code analysis WITHOUT knowing target addresses beforehand.

Examples:
  npx tsx scripts/test-behavioral-cli.ts emerald.gba
  npx tsx scripts/test-behavioral-cli.ts quetzal.gba
  npx tsx scripts/test-behavioral-cli.ts rom-hack.gba
`);
}

async function testROM(romPath: string) {
  console.log(`🔍 Behavioral Pattern Analysis`);
  console.log(`============================================================`);
  console.log(`ROM: ${romPath}`);
  
  try {
    // Load ROM file
    console.log(`📂 Loading ROM file...`);
    const buffer = new Uint8Array(readFileSync(romPath));
    console.log(`   Size: ${(buffer.length / 1024 / 1024).toFixed(1)} MB (${buffer.length.toLocaleString()} bytes)`);
    
    // Test behavioral pattern detection
    console.log(`\n🧪 Testing Behavioral Pattern Detection...`);
    
    const options = {
      startOffset: 0,
      endOffset: Math.min(buffer.length, 2 * 1024 * 1024), // 2MB limit for speed
      maxMatches: 5,
      minConfidence: 'low' as const
    };
    
    // Find the best candidate
    const bestResult = findPartyDataBehavioral(buffer, options);
    
    if (bestResult) {
      console.log(`\n✅ SUCCESS: Found partyData address!`);
      console.log(`   Address: 0x${bestResult.address.toString(16).toUpperCase().padStart(8, '0')}`);
      console.log(`   Pattern: ${bestResult.pattern}`);
      console.log(`   Confidence: ${bestResult.confidence}`);
      console.log(`   Method: ${bestResult.method}`);
      console.log(`   Supporting matches: ${bestResult.matches}`);
      
      // Try to identify game variant
      if (bestResult.address === 0x020244EC) {
        console.log(`   🎮 Game: Pokemon Emerald (confirmed)`);
      } else if (bestResult.address === 0x020235B8) {
        console.log(`   🎮 Game: Pokemon Quetzal (confirmed)`);
      } else {
        console.log(`   🎮 Game: Unknown variant or ROM hack`);
        console.log(`   📝 Note: This demonstrates the behavioral approach working on unknown ROMs!`);
      }
    } else {
      console.log(`\n❌ FAILURE: No partyData address found`);
      console.log(`   The behavioral patterns did not detect any valid partyData access code.`);
      console.log(`   This ROM may not be a Pokemon GBA game or may use different code patterns.`);
    }
    
    // Show detailed analysis
    console.log(`\n📊 Detailed Pattern Analysis:`);
    const allResults = scanAndValidate(buffer, options);
    
    if (allResults.length > 0) {
      const patternTypes = new Set(allResults.map(r => r.pattern));
      const addressCounts = new Map<number, number>();
      
      for (const result of allResults) {
        addressCounts.set(result.address, (addressCounts.get(result.address) || 0) + 1);
      }
      
      console.log(`   Pattern types found: ${Array.from(patternTypes).join(', ')}`);
      console.log(`   Unique addresses found: ${addressCounts.size}`);
      console.log(`   Total pattern matches: ${allResults.length}`);
      
      console.log(`\n   Address candidates:`);
      for (const [address, count] of addressCounts) {
        const confidence = allResults.find(r => r.address === address)?.confidence || 'unknown';
        console.log(`     0x${address.toString(16).toUpperCase().padStart(8, '0')} (${count} patterns, ${confidence} confidence)`);
      }
    } else {
      console.log(`   No valid pattern matches found.`);
    }
    
  } catch (error) {
    console.error(`\n❌ Error analyzing ROM:`, error);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }
  
  const romPath = resolve(args[0]);
  
  try {
    // Check if file exists
    readFileSync(romPath, { encoding: null });
  } catch (error) {
    console.error(`❌ Cannot read ROM file: ${romPath}`);
    console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
  
  await testROM(romPath);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}