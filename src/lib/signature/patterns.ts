/**
 * Real byte patterns for finding partyData addresses in Pokemon Emerald variants
 * 
 * IMPORTANT: These are the actual working byte patterns that can be found in
 * Pokemon Emerald and Quetzal ROM memory to locate the partyData addresses.
 * 
 * Expected results:
 * - Emerald: 0x020244EC  
 * - Quetzal: 0x020235B8
 */

// Re-export all validated patterns from real-patterns.ts
export {
  EMERALD_PARTY_LOOP_PATTERN,
  EMERALD_PARTY_COUNT_CHECK,
  EMERALD_POKEMON_SIZE_CALC,
  QUETZAL_PARTY_ACCESS,
  THUMB_PARTY_LOAD,
  PARTY_COMPARISON_PATTERN,
  VALIDATED_PARTY_PATTERNS as PARTY_DATA_SIGNATURES,
  KNOWN_ADDRESSES,
  validatePatternResults,
  createValidatedScanner as createPartyDataScanner
} from './real-patterns'