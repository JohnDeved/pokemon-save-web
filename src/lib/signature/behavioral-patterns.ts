/**
 * TRUE Behavioral Universal Patterns for Pokemon PartyData Detection
 * 
 * This system finds partyData addresses by identifying characteristic ARM/THUMB
 * instruction sequences that access party data, WITHOUT knowing target addresses.
 * 
 * Key insight: We look for CODE BEHAVIOR patterns, not address patterns.
 */

export interface BehavioralPattern {
  name: string;
  description: string;
  hexPattern: string;
  extractAddress: (buffer: Uint8Array, matchOffset: number) => number | null;
  confidence: 'high' | 'medium' | 'low';
  gameVariant?: 'emerald' | 'quetzal' | 'both';
}

/**
 * BEHAVIORAL PATTERN 1: Party Size Loop Detection
 * Detects loops that iterate exactly 6 times (party size)
 * Pattern: MOV r?, #6 followed by loop structure
 */
export const PARTY_SIZE_LOOP: BehavioralPattern = {
  name: 'party_size_loop',
  description: 'Detects code that loops through 6 Pokemon (party size)',
  hexPattern: '06 20 ?? ?? ?? ?? E5 9F', // MOV r0, #6 + padding + LDR literal
  extractAddress: (buffer: Uint8Array, matchOffset: number): number | null => {
    // LDR literal is at matchOffset + 6, immediate is at matchOffset + 8
    const ldrPos = matchOffset + 6;
    const immediate = (buffer[ldrPos + 2] ?? 0) | ((buffer[ldrPos + 3] ?? 0) << 8);
    const pc = ldrPos + 8; // ARM PC calculation
    const literalAddr = pc + immediate;
    
    if (literalAddr + 3 < buffer.length) {
      const address = new DataView(buffer.buffer, buffer.byteOffset + literalAddr, 4).getUint32(0, true);
      // Validate this is in GBA RAM range
      if (address >= 0x02000000 && address <= 0x02040000) {
        return address;
      }
    }
    return null;
  },
  confidence: 'high',
  gameVariant: 'both'
};

/**
 * BEHAVIORAL PATTERN 2: Pokemon Slot Calculation
 * Detects code that calculates individual Pokemon addresses
 * Pattern: Base address + (index * Pokemon_size)
 */
export const POKEMON_SLOT_CALC: BehavioralPattern = {
  name: 'pokemon_slot_calculation',
  description: 'Detects Pokemon slot address calculation (base + index * size)',
  hexPattern: '64 ?? ?? ?? E5 9F ?? ??', // Multiply by 100 (0x64) + LDR literal  
  extractAddress: (buffer: Uint8Array, matchOffset: number): number | null => {
    // The LDR should be right after the multiplication at matchOffset + 4
    const ldrPos = matchOffset + 4;
    if (ldrPos + 3 >= buffer.length) return null;
    
    // Extract immediate from E5 9F ?? ??
    const immediate = (buffer[ldrPos + 2] ?? 0) | ((buffer[ldrPos + 3] ?? 0) << 8);
    const pc = ldrPos + 8;
    const literalAddr = pc + immediate;
    
    if (literalAddr + 3 < buffer.length) {
      const address = new DataView(buffer.buffer, buffer.byteOffset + literalAddr, 4).getUint32(0, true);
      if (address >= 0x02000000 && address <= 0x02040000) {
        return address;
      }
    }
    return null;
  },
  confidence: 'high',
  gameVariant: 'emerald' // Emerald uses 100-byte Pokemon
};

/**
 * BEHAVIORAL PATTERN 3: Quetzal Pokemon Slot Calculation
 * Same as above but for 104-byte Pokemon (Quetzal)
 */
export const QUETZAL_SLOT_CALC: BehavioralPattern = {
  name: 'quetzal_slot_calculation',
  description: 'Detects Quetzal Pokemon slot calculation (104 bytes)',
  hexPattern: '68 ?? ?? ?? E5 9F ?? ??', // Multiply by 104 (0x68) + LDR literal
  extractAddress: (buffer: Uint8Array, matchOffset: number): number | null => {
    const ldrPos = matchOffset + 4;
    if (ldrPos + 3 >= buffer.length) return null;
    
    // Extract immediate from E5 9F ?? ??
    const immediate = (buffer[ldrPos + 2] ?? 0) | ((buffer[ldrPos + 3] ?? 0) << 8);
    const pc = ldrPos + 8;
    const literalAddr = pc + immediate;
    
    if (literalAddr + 3 < buffer.length) {
      const address = new DataView(buffer.buffer, buffer.byteOffset + literalAddr, 4).getUint32(0, true);
      if (address >= 0x02000000 && address <= 0x02040000) {
        return address;
      }
    }
    return null;
  },
  confidence: 'high',
  gameVariant: 'quetzal' // Quetzal uses 104-byte Pokemon
};

/**
 * BEHAVIORAL PATTERN 4: THUMB Party Base Loading
 * Detects THUMB code that loads party base address
 * Pattern: LDR r?, [PC, #offset] for party data access
 */
export const THUMB_PARTY_BASE: BehavioralPattern = {
  name: 'thumb_party_base',
  description: 'Detects THUMB code loading party base address',
  hexPattern: '4? ?? 68 ?? ?? 30', // LDR + LDR + ADDS (party access sequence)
  extractAddress: (buffer: Uint8Array, matchOffset: number): number | null => {
    // Check if first instruction is THUMB LDR literal (4x ??)
    const firstInst = buffer[matchOffset] ?? 0;
    if ((firstInst & 0xF8) !== 0x48) return null; // Must be LDR rX, [PC, #imm]
    
    const immediate = buffer[matchOffset + 1] ?? 0;
    const pc = ((matchOffset + 4) & ~3); // THUMB PC alignment
    const literalAddr = pc + (immediate * 4);
    
    if (literalAddr + 3 < buffer.length) {
      const address = new DataView(buffer.buffer, buffer.byteOffset + literalAddr, 4).getUint32(0, true);
      if (address >= 0x02000000 && address <= 0x02040000) {
        return address;
      }
    }
    return null;
  },
  confidence: 'medium',
  gameVariant: 'both'
};

/**
 * BEHAVIORAL PATTERN 5: Party Bounds Validation
 * Detects code that validates party slot index (0-5)
 * Pattern: CMP rX, #5 followed by conditional branch
 */
export const PARTY_BOUNDS_VALIDATION: BehavioralPattern = {
  name: 'party_bounds_validation',
  description: 'Detects party slot bounds checking (index <= 5)',
  hexPattern: '05 28 ?? ?? E5 9F', // CMP #5 + instructions + LDR
  extractAddress: (buffer: Uint8Array, matchOffset: number): number | null => {
    // LDR literal is at matchOffset + 4
    const ldrPos = matchOffset + 4;
    if (ldrPos + 3 >= buffer.length) return null;
    
    // Extract immediate from E5 9F ?? ??
    const immediate = (buffer[ldrPos + 2] ?? 0) | ((buffer[ldrPos + 3] ?? 0) << 8);
    const pc = ldrPos + 8;
    const literalAddr = pc + immediate;
    
    if (literalAddr + 3 < buffer.length) {
      const address = new DataView(buffer.buffer, buffer.byteOffset + literalAddr, 4).getUint32(0, true);
      if (address >= 0x02000000 && address <= 0x02040000) {
        return address;
      }
    }
    return null;
  },
  confidence: 'medium',
  gameVariant: 'both'
};

/**
 * BEHAVIORAL PATTERN 6: Battle Party Access
 * Detects battle system code accessing party Pokemon data
 * Common pattern when battle system reads Pokemon stats
 */
export const BATTLE_PARTY_ACCESS: BehavioralPattern = {
  name: 'battle_party_access',
  description: 'Detects battle system accessing party Pokemon data',
  hexPattern: '?? ?? 79 ?? 29 ?? D? ?? E5 9F', // Pattern: LDRB + CMP + branch + LDR
  extractAddress: (buffer: Uint8Array, matchOffset: number): number | null => {
    // Find the LDR literal in this sequence
    for (let offset = 6; offset <= 12; offset += 2) {
      const pos = matchOffset + offset;
      if (pos + 3 >= buffer.length) break;
      
      if (buffer[pos + 2] === 0x9F && buffer[pos + 3] === 0xE5) {
        const immediate = (buffer[pos] ?? 0) | ((buffer[pos + 1] ?? 0) << 8);
        const pc = pos + 8;
        const literalAddr = pc + immediate;
        
        if (literalAddr + 3 < buffer.length) {
          const address = new DataView(buffer.buffer, buffer.byteOffset + literalAddr, 4).getUint32(0, true);
          if (address >= 0x02000000 && address <= 0x02040000) {
            return address;
          }
        }
      }
    }
    return null;
  },
  confidence: 'low',
  gameVariant: 'both'
};

/**
 * All TRUE behavioral patterns for scanning
 */
export const BEHAVIORAL_PATTERNS: BehavioralPattern[] = [
  PARTY_SIZE_LOOP,
  POKEMON_SLOT_CALC,
  QUETZAL_SLOT_CALC,
  THUMB_PARTY_BASE,
  PARTY_BOUNDS_VALIDATION,
  BATTLE_PARTY_ACCESS
];

/**
 * Convert hex pattern to byte array for matching with wildcards
 */
export function parseHexPattern(hexPattern: string): { bytes: number[], mask: number[] } {
  const parts = hexPattern.split(' ');
  const bytes: number[] = [];
  const mask: number[] = [];
  
  for (const part of parts) {
    if (part === '??') {
      bytes.push(0);
      mask.push(0); // Match anything
    } else if (part.includes('?')) {
      // Single wildcard like 4? or ?5
      if (part.charAt(0) === '?') {
        // ?X pattern - match specific lower nibble
        const value = parseInt(part.charAt(1), 16);
        bytes.push(value);
        mask.push(0x0F);
      } else {
        // X? pattern - match specific upper nibble
        const value = parseInt(part.charAt(0), 16) << 4;
        bytes.push(value);
        mask.push(0xF0);
      }
    } else {
      // Exact match
      bytes.push(parseInt(part, 16));
      mask.push(0xFF);
    }
  }
  
  return { bytes, mask };
}

/**
 * Check if bytes match pattern with mask
 */
export function matchesPattern(buffer: Uint8Array, offset: number, pattern: { bytes: number[], mask: number[] }): boolean {
  if (offset + pattern.bytes.length > buffer.length) return false;
  
  for (let i = 0; i < pattern.bytes.length; i++) {
    const bufferByte = buffer[offset + i] ?? 0;
    const patternByte = pattern.bytes[i] ?? 0;
    const maskByte = pattern.mask[i] ?? 0;
    
    if ((bufferByte & maskByte) !== (patternByte & maskByte)) {
      return false;
    }
  }
  
  return true;
}