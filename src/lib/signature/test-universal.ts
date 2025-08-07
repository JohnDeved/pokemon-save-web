#!/usr/bin/env tsx
/**
 * Simple CLI tool to test universal patterns for finding partyData addresses
 * Works with both Pokemon Emerald and Quetzal
 */

import { readFileSync, existsSync } from 'node:fs'
import { 
  findPartyDataAddressUniversal, 
  testUniversalPatterns,
  UNIVERSAL_THUMB_PATTERN,
  UNIVERSAL_ARM_SIZE_PATTERN,
  UNIVERSAL_DIRECT_REFERENCE,
  findHexPattern 
} from './universal-patterns'

function printHelp(): void {
  console.log(`
🔍 Universal PartyData Pattern Finder

USAGE:
    npx tsx test-universal.ts <memory-file> [options]

OPTIONS:
    --verbose    Show detailed pattern matching information
    --help       Show this help message

EXAMPLES:
    npx tsx test-universal.ts memory.bin
    npx tsx test-universal.ts rom.gba --verbose

SUPPORTED GAMES:
    - Pokemon Emerald (expects 0x020244EC)
    - Pokemon Quetzal (expects 0x020235B8)

This tool uses universal patterns that work in both games:
1. THUMB pattern: 48 ?? 68 ?? 30 ??
2. ARM Emerald pattern: E0 ?? ?? 64 E5 9F ?? ?? E0 8? ?? ??  
3. ARM Quetzal pattern: E0 ?? ?? 68 E5 9F ?? ?? E0 8? ?? ??
4. Direct address search: EC 44 02 02 / B8 35 02 02
`)
}

function runDetailedAnalysis(buffer: Uint8Array, verbose: boolean): void {
  console.log('🔍 Detailed Universal Pattern Analysis')
  console.log('=' .repeat(60))
  console.log(`Memory buffer size: ${buffer.length} bytes (${(buffer.length / 1024).toFixed(1)} KB)`)
  console.log()

  // Test Method 1: Direct Reference
  console.log('📍 Method 1: Direct Address References')
  try {
    const directAddresses = UNIVERSAL_DIRECT_REFERENCE.findAddresses(buffer)
    if (directAddresses.length > 0) {
      console.log(`✅ Found ${directAddresses.length} direct reference(s):`)
      directAddresses.forEach(addr => {
        const variant = addr === 0x020244EC ? 'Emerald' : addr === 0x020235B8 ? 'Quetzal' : 'Unknown'
        console.log(`   - 0x${addr.toString(16).toUpperCase()} (${variant})`)
      })
    } else {
      console.log('❌ No direct references found')
    }
  } catch (error) {
    console.log(`❌ Error in direct reference search: ${error}`)
  }
  console.log()

  // Test Method 2: THUMB Pattern
  console.log('📍 Method 2: THUMB Pattern (Universal)')
  console.log(`   Pattern: ${UNIVERSAL_THUMB_PATTERN.hexPattern}`)
  try {
    const thumbMatches = findHexPattern(buffer, UNIVERSAL_THUMB_PATTERN.hexPattern)
    console.log(`   Found ${thumbMatches.length} THUMB pattern match(es)`)
    
    if (thumbMatches.length > 0 && verbose) {
      console.log('   Locations:')
      thumbMatches.slice(0, 5).forEach(offset => { // Limit to first 5 matches
        console.log(`     - 0x${offset.toString(16).toUpperCase()}`)
      })
      if (thumbMatches.length > 5) {
        console.log(`     ... and ${thumbMatches.length - 5} more`)
      }
    }

    let thumbSuccess = false
    for (const match of thumbMatches.slice(0, 10)) { // Try first 10 matches
      try {
        const address = UNIVERSAL_THUMB_PATTERN.extractAddress(buffer, match)
        if (address === 0x020244EC || address === 0x020235B8) {
          const variant = address === 0x020244EC ? 'Emerald' : 'Quetzal'
          console.log(`   ✅ Resolved to: 0x${address.toString(16).toUpperCase()} (${variant})`)
          thumbSuccess = true
          break
        } else if (verbose) {
          console.log(`   ⚠️  Resolved to: 0x${address.toString(16).toUpperCase()} (unexpected)`)
        }
      } catch (error) {
        if (verbose) {
          console.log(`   ❌ Resolution failed for match at 0x${match.toString(16)}: ${error}`)
        }
      }
    }
    
    if (!thumbSuccess && thumbMatches.length > 0) {
      console.log('   ❌ No matches resolved to expected addresses')
    }
  } catch (error) {
    console.log(`   ❌ Error in THUMB pattern search: ${error}`)
  }
  console.log()

  // Test Method 3: ARM Patterns
  console.log('📍 Method 3: ARM Patterns (Game-Specific)')
  
  // Emerald ARM pattern
  console.log(`   Emerald pattern: ${UNIVERSAL_ARM_SIZE_PATTERN.emeraldHexPattern}`)
  try {
    const emeraldMatches = findHexPattern(buffer, UNIVERSAL_ARM_SIZE_PATTERN.emeraldHexPattern)
    console.log(`   Found ${emeraldMatches.length} Emerald ARM match(es)`)
    
    let emeraldSuccess = false
    for (const match of emeraldMatches.slice(0, 5)) {
      try {
        const address = UNIVERSAL_ARM_SIZE_PATTERN.extractAddress(buffer, match)
        if (address === 0x020244EC) {
          console.log(`   ✅ Emerald resolved to: 0x${address.toString(16).toUpperCase()}`)
          emeraldSuccess = true
          break
        } else if (verbose) {
          console.log(`   ⚠️  Emerald resolved to: 0x${address.toString(16).toUpperCase()} (unexpected)`)
        }
      } catch (error) {
        if (verbose) {
          console.log(`   ❌ Emerald resolution failed: ${error}`)
        }
      }
    }
    
    if (!emeraldSuccess && emeraldMatches.length > 0) {
      console.log('   ❌ No Emerald matches resolved correctly')
    }
  } catch (error) {
    console.log(`   ❌ Error in Emerald ARM pattern: ${error}`)
  }

  // Quetzal ARM pattern
  console.log(`   Quetzal pattern: ${UNIVERSAL_ARM_SIZE_PATTERN.quetzalHexPattern}`)
  try {
    const quetzalMatches = findHexPattern(buffer, UNIVERSAL_ARM_SIZE_PATTERN.quetzalHexPattern)
    console.log(`   Found ${quetzalMatches.length} Quetzal ARM match(es)`)
    
    let quetzalSuccess = false
    for (const match of quetzalMatches.slice(0, 5)) {
      try {
        const address = UNIVERSAL_ARM_SIZE_PATTERN.extractAddress(buffer, match)
        if (address === 0x020235B8) {
          console.log(`   ✅ Quetzal resolved to: 0x${address.toString(16).toUpperCase()}`)
          quetzalSuccess = true
          break
        } else if (verbose) {
          console.log(`   ⚠️  Quetzal resolved to: 0x${address.toString(16).toUpperCase()} (unexpected)`)
        }
      } catch (error) {
        if (verbose) {
          console.log(`   ❌ Quetzal resolution failed: ${error}`)
        }
      }
    }
    
    if (!quetzalSuccess && quetzalMatches.length > 0) {
      console.log('   ❌ No Quetzal matches resolved correctly')
    }
  } catch (error) {
    console.log(`   ❌ Error in Quetzal ARM pattern: ${error}`)
  }
  console.log()
}

function main(): void {
  const args = process.argv.slice(2)
  
  if (args.length === 0 || args.includes('--help')) {
    printHelp()
    return
  }

  const inputFile = args[0]!
  const verbose = args.includes('--verbose')

  if (!existsSync(inputFile)) {
    console.error(`❌ File not found: ${inputFile}`)
    return
  }

  console.log(`Loading memory dump: ${inputFile}`)
  
  try {
    const fileData = readFileSync(inputFile)
    const buffer = new Uint8Array(fileData)
    
    console.log(`Loaded ${buffer.length} bytes\n`)

    // Run the universal scanner first
    testUniversalPatterns(buffer)
    
    console.log('\n')
    
    // Run detailed analysis if verbose
    if (verbose) {
      runDetailedAnalysis(buffer, verbose)
    }

    // Provide next steps
    console.log('📚 Next Steps:')
    console.log('- If successful, use the found address in your code')
    console.log('- If no matches, try a different memory dump or ROM variant')
    console.log('- For ROM hacks, you may need to find the address manually first')
    console.log('- See UNIVERSAL_PATTERNS.md for detailed usage instructions')
    
  } catch (error) {
    console.error(`❌ Error processing file: ${error}`)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}