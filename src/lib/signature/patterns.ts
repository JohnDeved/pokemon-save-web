/**
 * Pre-defined ASM signatures for Pokemon Emerald partyData resolution
 */

import type { AsmSignature } from './types'
import { SignatureScanner } from './scanner'
import { armLdrLiteralResolver, thumbLdrLiteralResolver } from './resolver'

/**
 * Signature for party data access via ARM LDR literal pool
 * Matches pattern where partyData base address is loaded from literal pool
 * Common in initialization or accessor functions
 */
export const PARTY_DATA_ARM_LDR_SIGNATURE: AsmSignature = {
  name: 'partyData_arm_ldr_literal',
  mode: 'ARM',
  pattern: SignatureScanner.createPattern('E5 9F ? ? E1 A0 ? ? E5 8? ? ?'), // LDR Rx, [PC, #imm]; MOV; STR pattern
  resolver: armLdrLiteralResolver,
  supportedVariants: ['emerald', 'quetzal'],
}

/**
 * Signature for party data access via THUMB LDR literal
 * THUMB mode is common in newer/optimized code sections  
 */
export const PARTY_DATA_THUMB_LDR_SIGNATURE: AsmSignature = {
  name: 'partyData_thumb_ldr_literal',
  mode: 'THUMB',
  pattern: SignatureScanner.createPattern('48 ? 68 ? 60 ?'), // LDR r0, [PC, #imm]; LDR r0, [r0]; STR pattern
  resolver: thumbLdrLiteralResolver,
  supportedVariants: ['emerald', 'quetzal'],
}

/**
 * Signature for party count access (often near party data)
 * Party count is typically stored 3 bytes before party data
 */
export const PARTY_COUNT_ACCESS_SIGNATURE: AsmSignature = {
  name: 'partyCount_access',
  mode: 'THUMB',  
  pattern: SignatureScanner.createPattern('48 ? 78 ? 28 06'), // LDR r0, [PC, #imm]; LDRB r0, [r0]; CMP r0, #6
  resolver: {
    description: 'Party count access: resolve base, add 3 for party data',
    resolve: (match, buffer) => {
      const countAddress = thumbLdrLiteralResolver.resolve(match, buffer)
      return countAddress + 3 // Party data typically starts 3 bytes after count
    },
  },
  supportedVariants: ['emerald', 'quetzal'],
}

/**
 * Signature for Pokemon data structure access within party loop
 * Looks for patterns that iterate through party slots (100-byte or 104-byte structures)
 */
export const POKEMON_STRUCT_ACCESS_SIGNATURE: AsmSignature = {
  name: 'pokemon_struct_access', 
  mode: 'ARM',
  pattern: SignatureScanner.createPattern('E2 8? ? 64 E5 9F ? ? E0 8? ? ?'), // ADD r?, r?, #100; LDR; ADD pattern
  resolver: armLdrLiteralResolver,
  supportedVariants: ['emerald', 'quetzal'],
}

/**
 * Alternative Pokemon struct access for Quetzal (104-byte structures)
 */
export const QUETZAL_POKEMON_STRUCT_SIGNATURE: AsmSignature = {
  name: 'quetzal_pokemon_struct_access',
  mode: 'ARM', 
  pattern: SignatureScanner.createPattern('E2 8? ? 68 E5 9F ? ? E0 8? ? ?'), // ADD r?, r?, #104; LDR; ADD pattern  
  resolver: armLdrLiteralResolver,
  supportedVariants: ['quetzal'],
}

/**
 * Direct memory reference signature - fallback for when literal pools are not used
 * Looks for direct 32-bit address references in instruction immediate fields
 */
export const DIRECT_ADDRESS_SIGNATURE: AsmSignature = {
  name: 'partyData_direct_reference',
  mode: 'ARM',
  pattern: SignatureScanner.createPatternFromMask(
    [0xE3, 0xA0, -1, 0x02, 0xE3, 0x40, -1, -1], // MOV r?, #0x02000000; ORR r?, r?, #partyOffset
    'xx?xxx??'
  ),
  resolver: {
    description: 'Direct address assembly: reconstruct from MOV/ORR immediate values',
    resolve: (match, _buffer) => {
      // Parse ORR r, r, #offset instruction (MOV sets base 0x02000000)
      const orr = new DataView(match.matchedBytes.buffer, match.matchedBytes.byteOffset + 4, 4).getUint32(0, true)
      
      // Extract immediate from ORR instruction (bits 11:0)
      const offset = orr & 0xFFF
      return 0x02000000 + offset
    },
  },
  supportedVariants: ['emerald', 'quetzal'],
}

/**
 * All pre-defined signatures for party data resolution
 */
export const PARTY_DATA_SIGNATURES: readonly AsmSignature[] = [
  PARTY_DATA_ARM_LDR_SIGNATURE,
  PARTY_DATA_THUMB_LDR_SIGNATURE, 
  PARTY_COUNT_ACCESS_SIGNATURE,
  POKEMON_STRUCT_ACCESS_SIGNATURE,
  QUETZAL_POKEMON_STRUCT_SIGNATURE,
  DIRECT_ADDRESS_SIGNATURE,
] as const

/**
 * Create a scanner pre-loaded with all party data signatures
 */
export function createPartyDataScanner(): SignatureScanner {
  const scanner = new SignatureScanner()
  scanner.addSignatures(PARTY_DATA_SIGNATURES)
  return scanner
}