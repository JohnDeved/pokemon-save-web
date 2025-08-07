#!/usr/bin/env tsx
/**
 * Simple Universal Patterns Test
 * 
 * A lightweight alternative to the Docker validation system.
 * This script tests the Universal Patterns on ROM memory dumps
 * without requiring complex infrastructure.
 * 
 * Usage:
 *   npx tsx src/lib/signature/test-patterns-simple.ts <rom_file_path>
 *   npx tsx src/lib/signature/test-patterns-simple.ts /path/to/emerald.gba
 *   npx tsx src/lib/signature/test-patterns-simple.ts /path/to/quetzal.gba
 */

import { readFileSync } from 'node:fs'
import { findPartyDataAddressUniversal, UNIVERSAL_THUMB_PATTERN, UNIVERSAL_ARM_SIZE_PATTERN, findHexPattern } from './universal-patterns.js'

function testUniversalPatternsSimple(romPath: string): void {
  console.log('🔍 Simple Universal Patterns Test')
  console.log('='.repeat(60))
  console.log(`ROM: ${romPath}`)
  
  try {
    // Load ROM file
    console.log('📂 Loading ROM file...')
    const romBuffer = new Uint8Array(readFileSync(romPath))
    console.log(`   Size: ${romBuffer.length.toLocaleString()} bytes`)
    
    // Test universal pattern detection
    console.log('\n🧪 Testing Universal Pattern Detection...')
    const result = findPartyDataAddressUniversal(romBuffer)
    
    if (result.foundAddress) {
      console.log(`✅ SUCCESS: Found partyData address!`)
      console.log(`   Address: 0x${result.foundAddress.toString(16).toUpperCase()}`)
      console.log(`   Variant: ${result.variant}`)
      console.log(`   Method: ${result.method}`)
      console.log(`   Confidence: ${result.confidence}`)
    } else {
      console.log(`❌ FAILED: No partyData address found`)
      console.log(`   Last method tried: ${result.method}`)
    }
    
    // Detailed pattern analysis
    console.log('\n📊 Detailed Pattern Analysis:')
    
    // Test THUMB pattern
    console.log(`\n1. THUMB Pattern: ${UNIVERSAL_THUMB_PATTERN.hexPattern}`)
    const thumbMatches = findHexPattern(romBuffer, UNIVERSAL_THUMB_PATTERN.hexPattern)
    console.log(`   Found ${thumbMatches.length} matches`)
    
    if (thumbMatches.length > 0) {
      console.log(`   Testing first 5 matches:`)
      for (let i = 0; i < Math.min(5, thumbMatches.length); i++) {
        const match = thumbMatches[i]!
        try {
          const address = UNIVERSAL_THUMB_PATTERN.extractAddress(romBuffer, match)
          console.log(`     Match ${i + 1}: offset 0x${match.toString(16)} → 0x${address.toString(16)}`)
        } catch (error) {
          console.log(`     Match ${i + 1}: offset 0x${match.toString(16)} → extraction failed`)
        }
      }
    }
    
    // Test ARM Emerald pattern
    console.log(`\n2. ARM Emerald Pattern: ${UNIVERSAL_ARM_SIZE_PATTERN.emeraldHexPattern}`)
    const emeraldMatches = findHexPattern(romBuffer, UNIVERSAL_ARM_SIZE_PATTERN.emeraldHexPattern)
    console.log(`   Found ${emeraldMatches.length} matches`)
    
    if (emeraldMatches.length > 0) {
      console.log(`   Testing first 5 matches:`)
      for (let i = 0; i < Math.min(5, emeraldMatches.length); i++) {
        const match = emeraldMatches[i]!
        try {
          const address = UNIVERSAL_ARM_SIZE_PATTERN.extractAddress(romBuffer, match)
          console.log(`     Match ${i + 1}: offset 0x${match.toString(16)} → 0x${address.toString(16)}`)
        } catch (error) {
          console.log(`     Match ${i + 1}: offset 0x${match.toString(16)} → extraction failed`)
        }
      }
    }
    
    // Test ARM Quetzal pattern
    console.log(`\n3. ARM Quetzal Pattern: ${UNIVERSAL_ARM_SIZE_PATTERN.quetzalHexPattern}`)
    const quetzalMatches = findHexPattern(romBuffer, UNIVERSAL_ARM_SIZE_PATTERN.quetzalHexPattern)
    console.log(`   Found ${quetzalMatches.length} matches`)
    
    if (quetzalMatches.length > 0) {
      console.log(`   Testing first 5 matches:`)
      for (let i = 0; i < Math.min(5, quetzalMatches.length); i++) {
        const match = quetzalMatches[i]!
        try {
          const address = UNIVERSAL_ARM_SIZE_PATTERN.extractAddress(romBuffer, match)
          console.log(`     Match ${i + 1}: offset 0x${match.toString(16)} → 0x${address.toString(16)}`)
        } catch (error) {
          console.log(`     Match ${i + 1}: offset 0x${match.toString(16)} → extraction failed`)
        }
      }
    }
    
    console.log('\n' + '='.repeat(60))
    
  } catch (error) {
    console.error('❌ Error testing patterns:', error)
    process.exit(1)
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const romPath = process.argv[2]
  
  if (!romPath) {
    console.error('Usage: npx tsx test-patterns-simple.ts <rom_file_path>')
    console.error('Example: npx tsx test-patterns-simple.ts /path/to/emerald.gba')
    process.exit(1)
  }
  
  testUniversalPatternsSimple(romPath)
}

export { testUniversalPatternsSimple }