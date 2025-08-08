#!/usr/bin/env tsx

/**
 * Real Behavioral Pattern Test
 * 
 * Tests behavioral patterns against actual ROM data to prove they work
 * without knowing target addresses beforehand.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { scanAndValidate, findPartyDataBehavioral } from '../src/lib/signature/behavioral-scanner.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface TestGame {
  name: string;
  romPath: string;
  expectedAddress: number;
}

const TEST_GAMES: TestGame[] = [
  {
    name: 'Pokemon Emerald',
    romPath: resolve(__dirname, '..', 'docker', 'test_data', 'emerald.gba'),
    expectedAddress: 0x020244EC
  },
  {
    name: 'Pokemon Quetzal', 
    romPath: resolve(__dirname, '..', 'docker', 'test_data', 'quetzal.gba'),
    expectedAddress: 0x020235B8
  }
];

async function testBehavioralPatternsReal() {
  console.log('🚀 Real Behavioral Pattern Testing');
  console.log('Testing against actual ROM files using behavioral analysis');
  console.log('============================================================\n');

  const results: Array<{
    game: string;
    success: boolean;
    foundAddress?: number;
    expectedAddress: number;
    pattern?: string;
    confidence?: string;
  }> = [];

  for (const game of TEST_GAMES) {
    console.log(`\n🎮 Testing ${game.name}`);
    console.log('============================================================');
    
    if (!existsSync(game.romPath)) {
      console.log(`❌ ROM file not found: ${game.romPath}`);
      console.log('   Place ROM files in docker/test_data/ directory');
      results.push({
        game: game.name,
        success: false,
        expectedAddress: game.expectedAddress
      });
      continue;
    }

    try {
      console.log(`📂 Loading ROM: ${game.romPath}`);
      const romBuffer = new Uint8Array(readFileSync(game.romPath));
      console.log(`   Size: ${(romBuffer.length / 1024 / 1024).toFixed(1)}MB`);

      console.log('\n🔍 Scanning for behavioral patterns...');
      
      // Test with different confidence levels
      const options = {
        startOffset: 0,
        endOffset: Math.min(romBuffer.length, 2 * 1024 * 1024), // First 2MB
        maxMatches: 20,
        minConfidence: 'low' as const
      };

      console.log(`   Scanning range: 0x0 - 0x${options.endOffset.toString(16)} (${(options.endOffset / 1024 / 1024).toFixed(1)}MB)`);

      const result = findPartyDataBehavioral(romBuffer, options);

      if (result) {
        console.log(`\n✅ SUCCESS: Found partyData address!`);
        console.log(`   Address: 0x${result.address.toString(16).toUpperCase().padStart(8, '0')}`);
        console.log(`   Expected: 0x${game.expectedAddress.toString(16).toUpperCase().padStart(8, '0')}`);
        console.log(`   Pattern: ${result.pattern}`);
        console.log(`   Confidence: ${result.confidence}`);
        console.log(`   Method: ${result.method}`);

        const isCorrect = result.address === game.expectedAddress;
        if (isCorrect) {
          console.log(`🎯 PERFECT MATCH: Found the exact expected address!`);
        } else {
          console.log(`⚠️  Different address found (expected 0x${game.expectedAddress.toString(16)})`);
        }

        results.push({
          game: game.name,
          success: true,
          foundAddress: result.address,
          expectedAddress: game.expectedAddress,
          pattern: result.pattern,
          confidence: result.confidence
        });
      } else {
        console.log(`\n❌ FAILED: No behavioral patterns detected`);
        console.log('   The patterns did not find any valid partyData addresses');
        
        // Try with more detailed analysis
        console.log('\n🔬 Detailed pattern analysis:');
        const allResults = scanAndValidate(romBuffer, options);
        
        if (allResults.length > 0) {
          console.log(`   Found ${allResults.length} pattern matches:`);
          for (const r of allResults.slice(0, 5)) {
            console.log(`     0x${r.address.toString(16).padStart(8, '0')} - ${r.pattern} (${r.confidence})`);
          }
        } else {
          console.log('   No patterns matched at all - may need pattern refinement');
        }

        results.push({
          game: game.name,
          success: false,
          expectedAddress: game.expectedAddress
        });
      }

    } catch (error) {
      console.log(`❌ Error testing ${game.name}:`, error);
      results.push({
        game: game.name,
        success: false,
        expectedAddress: game.expectedAddress
      });
    }
  }

  // Summary
  console.log('\n\n============================================================');
  console.log('📊 BEHAVIORAL PATTERN TEST SUMMARY');
  console.log('============================================================\n');

  let successCount = 0;
  for (const result of results) {
    console.log(`🎮 ${result.game}:`);
    if (result.success && result.foundAddress) {
      console.log(`   ✅ SUCCESS - Found: 0x${result.foundAddress.toString(16).toUpperCase()}`);
      console.log(`   🎯 Expected: 0x${result.expectedAddress.toString(16).toUpperCase()}`);
      console.log(`   📝 Pattern: ${result.pattern}`);
      console.log(`   📊 Confidence: ${result.confidence}`);
      
      if (result.foundAddress === result.expectedAddress) {
        console.log(`   🏆 PERFECT: Exact match!`);
        successCount++;
      } else {
        console.log(`   ⚠️  PARTIAL: Different address found`);
      }
    } else {
      console.log(`   ❌ FAILED - No patterns found`);
    }
    console.log('');
  }

  console.log(`🎯 Results: ${successCount}/${results.length} exact matches`);
  
  if (successCount === results.length) {
    console.log(`🎉 ALL TESTS PASSED!`);
    console.log(`✅ Behavioral patterns successfully found exact partyData addresses`);
    console.log(`✅ This proves the behavioral approach works without knowing addresses beforehand`);
  } else if (successCount > 0) {
    console.log(`⚠️  PARTIAL SUCCESS: Some patterns worked`);
    console.log(`📈 The behavioral approach shows promise but needs refinement`);
  } else {
    console.log(`❌ ALL TESTS FAILED`);
    console.log(`📋 The behavioral patterns need significant improvement`);
    console.log(`💡 Suggestions:`);
    console.log(`   - Analyze real ROM code to find actual instruction patterns`);
    console.log(`   - Refine pattern matching for ARM/THUMB sequences`);
    console.log(`   - Increase scan range or adjust confidence thresholds`);
  }
  
  console.log('============================================================');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  testBehavioralPatternsReal().catch(console.error);
}