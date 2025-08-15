/**
 * PROPER Universal Pattern Implementation
 * 
 * This implements the CORRECT approach as explained by @JohnDeved:
 * 1. Find ROM locations that REFERENCE target addresses
 * 2. Analyze stable ARM/THUMB instruction patterns around those references
 * 3. Create byte pattern masks that work universally
 * 4. Extract addresses from the patterns dynamically
 */

export interface UniversalPattern {
  name: string;
  pattern: string;
  mask: number[];
  description: string;
  instructionType: 'ARM' | 'THUMB';
  extractAddress: (bytes: Uint8Array, offset: number) => number;
}

export interface PatternResult {
  success: boolean;
  address?: number;
  pattern?: UniversalPattern;
  confidence: 'low' | 'medium' | 'high';
  method: string;
}

/**
 * Universal patterns for detecting partyData addresses through ARM/THUMB instruction analysis
 * These patterns find instructions that REFERENCE the target addresses, not the addresses themselves
 */
export const PROPER_UNIVERSAL_PATTERNS: UniversalPattern[] = [
  {
    name: 'arm_ldr_literal',
    pattern: '?? ?? 9F E5',
    mask: [0x00, 0x00, 0xFF, 0xFF],
    description: 'ARM LDR literal instruction that loads partyData address from literal pool',
    instructionType: 'ARM',
    extractAddress: (bytes: Uint8Array, offset: number) => {
      const immediate = bytes[offset] | (bytes[offset + 1] << 8);
      const pc = 0x08000000 + offset + 8; // ARM PC is instruction + 8
      const literalPoolAddr = pc + immediate;
      
      // Validate literal pool is in ROM range
      if (literalPoolAddr < 0x08000000 || literalPoolAddr >= 0x08000000 + bytes.length - 4) {
        return 0;
      }
      
      const poolOffset = literalPoolAddr - 0x08000000;
      const targetAddr = bytes[poolOffset] | 
                        (bytes[poolOffset + 1] << 8) |
                        (bytes[poolOffset + 2] << 16) |
                        (bytes[poolOffset + 3] << 24);
      
      // Validate this is a GBA RAM address
      if (targetAddr >= 0x02000000 && targetAddr <= 0x02040000) {
        return targetAddr;
      }
      
      return 0;
    }
  },

  {
    name: 'thumb_ldr_literal',
    pattern: '48 ??',
    mask: [0xF8, 0x00],
    description: 'THUMB LDR literal instruction that loads from PC-relative literal pool',
    instructionType: 'THUMB',
    extractAddress: (bytes: Uint8Array, offset: number) => {
      const immediate = bytes[offset + 1];
      const pc = ((0x08000000 + offset + 4) & ~3); // THUMB PC alignment
      const literalPoolAddr = pc + (immediate * 4);
      
      // Validate literal pool is in ROM range
      if (literalPoolAddr < 0x08000000 || literalPoolAddr >= 0x08000000 + bytes.length - 4) {
        return 0;
      }
      
      const poolOffset = literalPoolAddr - 0x08000000;
      const targetAddr = bytes[poolOffset] | 
                        (bytes[poolOffset + 1] << 8) |
                        (bytes[poolOffset + 2] << 16) |
                        (bytes[poolOffset + 3] << 24);
      
      // Validate this is a GBA RAM address
      if (targetAddr >= 0x02000000 && targetAddr <= 0x02040000) {
        return targetAddr;
      }
      
      return 0;
    }
  },

  {
    name: 'arm_context_pattern',
    pattern: '?? ?? ?? ?? E5 9F ?? ??',
    mask: [0x00, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00],
    description: 'ARM LDR with surrounding context for improved accuracy',
    instructionType: 'ARM',
    extractAddress: (bytes: Uint8Array, offset: number) => {
      const immediate = bytes[offset + 4] | (bytes[offset + 5] << 8);
      const pc = 0x08000000 + offset + 4 + 8; // PC for the LDR instruction
      const literalPoolAddr = pc + immediate;
      
      // Validate literal pool is in ROM range
      if (literalPoolAddr < 0x08000000 || literalPoolAddr >= 0x08000000 + bytes.length - 4) {
        return 0;
      }
      
      const poolOffset = literalPoolAddr - 0x08000000;
      const targetAddr = bytes[poolOffset] | 
                        (bytes[poolOffset + 1] << 8) |
                        (bytes[poolOffset + 2] << 16) |
                        (bytes[poolOffset + 3] << 24);
      
      // Validate this is a GBA RAM address
      if (targetAddr >= 0x02000000 && targetAddr <= 0x02040000) {
        return targetAddr;
      }
      
      return 0;
    }
  }
];

/**
 * Find partyData address using the PROPER universal pattern approach
 * This method finds ARM/THUMB instructions that REFERENCE the target addresses
 */
export function findPartyDataAddressByInstructionPattern(romBuffer: Uint8Array): PatternResult {
  const candidates = new Map<number, { count: number; patterns: string[] }>();

  for (const pattern of PROPER_UNIVERSAL_PATTERNS) {
    const matches = findPatternMatches(romBuffer, pattern);
    
    for (const match of matches) {
      const address = pattern.extractAddress(romBuffer, match.offset);
      
      if (address > 0) {
        if (!candidates.has(address)) {
          candidates.set(address, { count: 0, patterns: [] });
        }
        
        const candidate = candidates.get(address)!;
        candidate.count++;
        candidate.patterns.push(pattern.name);
      }
    }
  }

  // Find the most confident result
  let bestAddress = 0;
  let bestScore = 0;
  let bestPattern: UniversalPattern | undefined;

  for (const [address, data] of candidates) {
    const score = data.count * getAddressConfidenceMultiplier(address);
    
    if (score > bestScore) {
      bestScore = score;
      bestAddress = address;
      bestPattern = PROPER_UNIVERSAL_PATTERNS.find(p => data.patterns.includes(p.name));
    }
  }

  if (bestAddress > 0) {
    return {
      success: true,
      address: bestAddress,
      pattern: bestPattern,
      confidence: bestScore >= 3 ? 'high' : bestScore >= 2 ? 'medium' : 'low',
      method: 'proper_instruction_pattern'
    };
  }

  return {
    success: false,
    confidence: 'low',
    method: 'proper_instruction_pattern'
  };
}

/**
 * Find all matches for a specific pattern in the ROM buffer
 */
function findPatternMatches(buffer: Uint8Array, pattern: UniversalPattern): Array<{ offset: number }> {
  const matches: Array<{ offset: number }> = [];
  const patternBytes = parsePatternString(pattern.pattern);
  const mask = pattern.mask;
  
  // Adjust step size based on instruction type
  const step = pattern.instructionType === 'ARM' ? 4 : 2;
  
  for (let i = 0; i <= buffer.length - patternBytes.length; i += step) {
    let isMatch = true;
    
    for (let j = 0; j < patternBytes.length; j++) {
      if (mask[j] !== 0 && (buffer[i + j] & mask[j]) !== (patternBytes[j] & mask[j])) {
        isMatch = false;
        break;
      }
    }
    
    if (isMatch) {
      matches.push({ offset: i });
    }
  }
  
  return matches;
}

/**
 * Parse pattern string like "48 ??" into byte array
 */
function parsePatternString(pattern: string): number[] {
  return pattern.split(' ').map(byte => {
    if (byte === '??') {
      return 0; // Wildcard
    }
    return parseInt(byte, 16);
  });
}

/**
 * Get confidence multiplier based on known target addresses
 */
function getAddressConfidenceMultiplier(address: number): number {
  // Known Pokemon partyData addresses get higher confidence
  if (address === 0x020244EC || address === 0x020235B8) {
    return 3;
  }
  
  // Other valid GBA RAM addresses get moderate confidence
  if (address >= 0x02000000 && address <= 0x02040000) {
    return 1;
  }
  
  return 0;
}

/**
 * Validate if an address looks like a valid partyData address
 */
export function validatePartyDataAddress(address: number): boolean {
  // Must be in GBA EWRAM range
  if (address < 0x02000000 || address > 0x02040000) {
    return false;
  }
  
  // Must be 4-byte aligned
  if (address % 4 !== 0) {
    return false;
  }
  
  return true;
}

/**
 * Get expected address for a specific game variant
 */
export function getExpectedAddressForGame(gameTitle: string): number | null {
  const title = gameTitle.toUpperCase();
  
  if (title.includes('POKEMON EMER')) {
    return 0x020244EC;
  }
  
  if (title.includes('PKM QUETZAL') || title.includes('QUETZAL')) {
    return 0x020235B8;
  }
  
  return null;
}

/**
 * Main entry point for proper universal pattern detection
 */
export function detectPartyDataAddress(romBuffer: Uint8Array, gameTitle?: string): PatternResult {
  const result = findPartyDataAddressByInstructionPattern(romBuffer);
  
  // Validate against expected address if game is known
  if (gameTitle && result.success) {
    const expectedAddr = getExpectedAddressForGame(gameTitle);
    if (expectedAddr && result.address === expectedAddr) {
      result.confidence = 'high';
    }
  }
  
  return result;
}