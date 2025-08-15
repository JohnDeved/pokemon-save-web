/**
 * Pattern definitions for party data signature extraction
 */

export {
  PROPER_UNIVERSAL_PATTERNS as PARTY_DATA_SIGNATURES,
  findPartyDataAddressByInstructionPattern,
  validatePartyDataAddress,
  detectPartyDataAddress,
} from './proper-universal-patterns'

export type {
  UniversalPattern,
  PatternResult,
} from './proper-universal-patterns'

// Known addresses for fallback
export const KNOWN_ADDRESSES = {
  emerald: { partyData: 0x020244EC },
  quetzal: { partyData: 0x020235B8 },
}

// Scanner creator
export function createPartyDataScanner () {
  return {
    scan: (_buffer: Uint8Array, _variant?: string) => {
      return {
        matches: [],
        errors: [],
        resolvedAddresses: new Map<string, number>(),
      }
    },
  }
}
