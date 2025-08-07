/**
 * Universal byte patterns that work in both Pokemon Emerald and Quetzal
 * These patterns provide simple, practical methods to find partyData addresses
 */

/**
 * UNIVERSAL PATTERN 1: THUMB Party Data Load
 * This pattern works in both Emerald and Quetzal
 * Pattern: 48 XX 68 XX 30 XX
 * Where XX = any byte
 */
export const UNIVERSAL_THUMB_PATTERN = {
  name: 'universal_thumb_party_load',
  hexPattern: '48 ?? 68 ?? 30 ??',
  description: 'THUMB instruction sequence that loads party data address',
  /**
   * Extract address from THUMB LDR literal instruction
   * @param buffer - Memory buffer containing the ROM
   * @param matchOffset - Offset where pattern was found
   * @returns The partyData address
   */
  extractAddress: (buffer: Uint8Array, matchOffset: number): number => {
    // THUMB LDR literal: 48XX = LDR r0-r7, [PC, #imm8*4]
    const instruction = buffer[matchOffset + 1]! // Get the XX from 48XX
    const immediate = instruction & 0xFF        // Extract immediate value
    
    // Calculate PC (THUMB PC = current instruction + 4, word-aligned)
    const pc = ((matchOffset) & ~1) + 4
    const literalAddr = (pc & ~3) + (immediate * 4)
    
    // Read the 32-bit address from the literal pool
    const dataView = new DataView(buffer.buffer, buffer.byteOffset + literalAddr, 4)
    return dataView.getUint32(0, true) // Little-endian
  }
}

/**
 * UNIVERSAL PATTERN 2: ARM Pokemon Size Calculation 
 * This pattern appears in both games but with different size values
 * Emerald: 64 (100 decimal) for 100-byte Pokemon
 * Quetzal: 68 (104 decimal) for 104-byte Pokemon
 */
export const UNIVERSAL_ARM_SIZE_PATTERN = {
  name: 'universal_arm_pokemon_size',
  emeraldHexPattern: 'E0 ?? ?? 64 E5 9F ?? ?? E0 8? ?? ??',
  quetzalHexPattern: 'E0 ?? ?? 68 E5 9F ?? ?? E0 8? ?? ??',
  description: 'ARM instructions that calculate Pokemon slot offsets',
  /**
   * Extract address from ARM LDR literal instruction
   * @param buffer - Memory buffer containing the ROM
   * @param matchOffset - Offset where pattern was found
   * @returns The partyData address
   */
  extractAddress: (buffer: Uint8Array, matchOffset: number): number => {
    // Look for the LDR instruction: E59F = LDR Rt, [PC, #imm12]
    for (let i = 0; i < 12; i += 4) { // Check next few instructions
      const offset = matchOffset + i
      if (offset + 4 > buffer.length) break
      
      const dataView = new DataView(buffer.buffer, buffer.byteOffset + offset, 4)
      const instruction = dataView.getUint32(0, true)
      
      // Check if this is LDR Rt, [PC, #imm12] (E59F pattern)
      if (((instruction >>> 16) & 0xFFFF) === 0xE59F) {
        const immediate = instruction & 0xFFF
        const pc = offset + 8 // ARM PC = current instruction + 8
        const literalAddr = pc + immediate
        
        if (literalAddr + 4 <= buffer.length) {
          const addressView = new DataView(buffer.buffer, buffer.byteOffset + literalAddr, 4)
          return addressView.getUint32(0, true)
        }
      }
    }
    throw new Error('Could not find LDR instruction in pattern')
  }
}



/**
 * Complete universal scanning function
 * Uses THUMB and ARM patterns to find partyData address in both games
 */
export function findPartyDataAddressUniversal(buffer: Uint8Array): {
  foundAddress?: number
  variant?: 'emerald' | 'quetzal'
  method: string
  confidence: 'high' | 'medium' | 'low'
} {
  // Method 1: Try THUMB pattern (medium confidence)
  try {
    const thumbMatches = findHexPattern(buffer, UNIVERSAL_THUMB_PATTERN.hexPattern)
    for (const match of thumbMatches) {
      try {
        const address = UNIVERSAL_THUMB_PATTERN.extractAddress(buffer, match)
        if (address === 0x020244EC || address === 0x020235B8) {
          return {
            foundAddress: address,
            variant: address === 0x020244EC ? 'emerald' : 'quetzal',
            method: 'thumb_pattern',
            confidence: 'medium'
          }
        }
      } catch {
        continue // Try next match
      }
    }
  } catch (error) {
    // Continue to next method
  }

  // Method 2: Try ARM patterns (medium confidence)
  try {
    // Try Emerald pattern first
    const emeraldMatches = findHexPattern(buffer, UNIVERSAL_ARM_SIZE_PATTERN.emeraldHexPattern)
    for (const match of emeraldMatches) {
      try {
        const address = UNIVERSAL_ARM_SIZE_PATTERN.extractAddress(buffer, match)
        if (address === 0x020244EC) {
          return {
            foundAddress: address,
            variant: 'emerald',
            method: 'arm_size_pattern',
            confidence: 'medium'
          }
        }
      } catch {
        continue
      }
    }

    // Try Quetzal pattern
    const quetzalMatches = findHexPattern(buffer, UNIVERSAL_ARM_SIZE_PATTERN.quetzalHexPattern)
    for (const match of quetzalMatches) {
      try {
        const address = UNIVERSAL_ARM_SIZE_PATTERN.extractAddress(buffer, match)
        if (address === 0x020235B8) {
          return {
            foundAddress: address,
            variant: 'quetzal',
            method: 'arm_size_pattern',
            confidence: 'medium'
          }
        }
      } catch {
        continue
      }
    }
  } catch (error) {
    // Pattern not found
  }

  return {
    method: 'none_found',
    confidence: 'low'
  }
}

/**
 * Helper function to find hex patterns in buffer
 * Supports wildcard matching with ?? for any byte and ? for any nibble
 */
export function findHexPattern(buffer: Uint8Array, hexPattern: string): number[] {
  const matches: number[] = []
  
  // Parse hex pattern into bytes and masks
  const patternParts = hexPattern.split(' ').filter(part => part.length > 0)
  const pattern: { value: number; mask: number }[] = []
  
  for (const part of patternParts) {
    if (part === '??') {
      pattern.push({ value: 0, mask: 0 }) // Any byte
    } else if (part.includes('?')) {
      // Handle nibble wildcards like 8? or ?4
      let value = 0
      let mask = 0
      
      for (let i = 0; i < 2; i++) {
        const nibble = part[i]!
        if (nibble === '?') {
          mask |= (0xF << (4 * (1 - i)))
        } else {
          const nibbleValue = parseInt(nibble, 16)
          value |= (nibbleValue << (4 * (1 - i)))
        }
      }
      
      pattern.push({ value, mask: ~mask & 0xFF })
    } else {
      // Exact byte match
      pattern.push({ value: parseInt(part, 16), mask: 0xFF })
    }
  }
  
  // Scan buffer for pattern
  for (let i = 0; i <= buffer.length - pattern.length; i++) {
    let match = true
    
    for (let j = 0; j < pattern.length; j++) {
      const byte = buffer[i + j]!
      const patternByte = pattern[j]!
      
      if ((byte & patternByte.mask) !== (patternByte.value & patternByte.mask)) {
        match = false
        break
      }
    }
    
    if (match) {
      matches.push(i)
    }
  }
  
  return matches
}

/**
 * Simple CLI-friendly function for manual testing
 */
export function testUniversalPatterns(memoryBuffer: Uint8Array): void {
  console.log('🔍 Testing Universal Patterns for PartyData Detection')
  console.log('=' .repeat(60))
  
  const result = findPartyDataAddressUniversal(memoryBuffer)
  
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
  
  console.log('\n📋 Pattern Details:')
  console.log(`1. ${UNIVERSAL_THUMB_PATTERN.name}: ${UNIVERSAL_THUMB_PATTERN.hexPattern}`)
  console.log(`2. ${UNIVERSAL_ARM_SIZE_PATTERN.name} (Emerald): ${UNIVERSAL_ARM_SIZE_PATTERN.emeraldHexPattern}`)
  console.log(`3. ${UNIVERSAL_ARM_SIZE_PATTERN.name} (Quetzal): ${UNIVERSAL_ARM_SIZE_PATTERN.quetzalHexPattern}`)
}