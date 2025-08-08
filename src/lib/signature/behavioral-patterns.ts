/**
 * TRUE Behavioral Universal Patterns for Pokemon PartyData Detection
 * 
 * This system finds partyData addresses by identifying characteristic ARM/THUMB
 * instruction sequences that access party data, WITHOUT knowing target addresses.
 * 
 * Key insight: We look for CODE BEHAVIOR patterns that indicate party data manipulation.
 * These patterns find actual CPU instructions that work with party data structures.
 */

export interface BehavioralPattern {
  name: string;
  description: string;
  hexPattern: string;
  validateContext: (buffer: Uint8Array, matchOffset: number) => boolean;
  extractAddress: (buffer: Uint8Array, matchOffset: number) => number | null;
  confidence: 'high' | 'medium' | 'low';
  gameVariant?: 'emerald' | 'quetzal' | 'both';
}

/**
 * BEHAVIORAL PATTERN 1: Party Size Loop Detection
 * Detects loops that iterate exactly 6 times (party size)
 * Pattern: MOV r?, #6 - this is a clear indicator of party iteration
 */
export const PARTY_SIZE_LOOP: BehavioralPattern = {
  name: 'party_size_loop',
  description: 'Detects MOV r?, #6 instructions indicating party size loops',
  hexPattern: '06 20', // MOV r0, #6 (ARM) - clear party size indicator
  validateContext: (buffer: Uint8Array, matchOffset: number): boolean => {
    // Look for loop structure indicators nearby (within 50 bytes)
    for (let i = 1; i <= 50; i++) {
      if (matchOffset + i >= buffer.length) break;
      
      // Look for conditional branches (ARM: Bcc, THUMB: Bcc)
      const byte = buffer[matchOffset + i] ?? 0;
      const nextByte = buffer[matchOffset + i + 1] ?? 0;
      
      // ARM conditional branch: ?? ?? ?? ?? (where first nibble is condition)
      if (i % 4 === 0 && (nextByte & 0x0F) === 0x0A) {
        return true; // Found conditional branch
      }
      
      // THUMB conditional branch: D? ??
      if ((byte & 0xF0) === 0xD0 && (byte & 0x0F) !== 0x0F) {
        return true;
      }
      
      // Look for increment patterns: ADD r?, r?, #1
      if (byte === 0x01 && nextByte === 0x30) { // THUMB: ADDS r?, #1
        return true;
      }
    }
    return false;
  },
  extractAddress: (buffer: Uint8Array, matchOffset: number): number | null => {
    // Look for ARM LDR instructions within the next 100 bytes that load from literal pools
    for (let offset = 1; offset <= 100; offset += 4) {
      const pos = matchOffset + offset;
      if (pos + 3 >= buffer.length) break;
      
      // ARM LDR literal pattern: ?? ?? 9F E5
      if (buffer[pos + 2] === 0x9F && buffer[pos + 3] === 0xE5) {
        const immediate = (buffer[pos] ?? 0) | ((buffer[pos + 1] ?? 0) << 8);
        const pc = pos + 8; // ARM PC calculation
        const literalAddr = pc + immediate;
        
        if (literalAddr + 3 < buffer.length) {
          const address = new DataView(buffer.buffer, buffer.byteOffset + literalAddr, 4).getUint32(0, true);
          // Must be in GBA RAM range and word-aligned
          if (address >= 0x02000000 && address <= 0x02040000 && address % 4 === 0) {
            return address;
          }
        }
      }
    }
    return null;
  },
  confidence: 'high',
  gameVariant: 'both'
};

/**
 * BEHAVIORAL PATTERN 2: Pokemon Size Multiplication  
 * Detects calculations with Pokemon struct size (100 bytes for Emerald)
 * Pattern: Multiplication or addition with 0x64 (100 decimal)
 */
export const POKEMON_SIZE_CALC_EMERALD: BehavioralPattern = {
  name: 'pokemon_size_calc_emerald',
  description: 'Detects Pokemon size calculations with 100 bytes (Emerald)',
  hexPattern: '64 00', // Immediate value 100 (0x64)
  validateContext: (buffer: Uint8Array, matchOffset: number): boolean => {
    // Look for multiplication or add instructions around this immediate
    for (let i = -8; i <= 8; i++) {
      const pos = matchOffset + i;
      if (pos < 0 || pos + 3 >= buffer.length) continue;
      
      const bytes = [buffer[pos] ?? 0, buffer[pos + 1] ?? 0, buffer[pos + 2] ?? 0, buffer[pos + 3] ?? 0];
      
      // ARM MUL pattern: ?? ?? ?? ?? (bits 4-7 should be 9 for MUL)
      if (i % 4 === 0 && (bytes[3] & 0x0F) === 0x0E && (bytes[2] & 0xF0) === 0x00) {
        return true; // Found MUL instruction
      }
      
      // ARM ADD with immediate pattern
      if (i % 4 === 0 && (bytes[3] & 0x0F) === 0xE2 && (bytes[2] & 0xF0) === 0x80) {
        return true; // Found ADD immediate
      }
    }
    return false;
  },
  extractAddress: (buffer: Uint8Array, matchOffset: number): number | null => {
    // Look for LDR literal instructions that load the base address for this calculation
    for (let offset = -50; offset <= 50; offset += 4) {
      const pos = matchOffset + offset;
      if (pos < 0 || pos + 3 >= buffer.length) continue;
      
      // ARM LDR literal: ?? ?? 9F E5
      if (buffer[pos + 2] === 0x9F && buffer[pos + 3] === 0xE5) {
        const immediate = (buffer[pos] ?? 0) | ((buffer[pos + 1] ?? 0) << 8);
        const pc = pos + 8;
        const literalAddr = pc + immediate;
        
        if (literalAddr + 3 < buffer.length) {
          const address = new DataView(buffer.buffer, buffer.byteOffset + literalAddr, 4).getUint32(0, true);
          if (address >= 0x02000000 && address <= 0x02040000 && address % 4 === 0) {
            return address;
          }
        }
      }
    }
    return null;
  },
  confidence: 'high',
  gameVariant: 'emerald'
};

/**
 * BEHAVIORAL PATTERN 3: Pokemon Size Multiplication for Quetzal
 * Detects calculations with Pokemon struct size (104 bytes for Quetzal)
 * Pattern: Multiplication or addition with 0x68 (104 decimal)
 */
export const POKEMON_SIZE_CALC_QUETZAL: BehavioralPattern = {
  name: 'pokemon_size_calc_quetzal',
  description: 'Detects Pokemon size calculations with 104 bytes (Quetzal)',
  hexPattern: '68 00', // Immediate value 104 (0x68)
  validateContext: (buffer: Uint8Array, matchOffset: number): boolean => {
    // Similar validation as Emerald but for 104 bytes
    for (let i = -8; i <= 8; i++) {
      const pos = matchOffset + i;
      if (pos < 0 || pos + 3 >= buffer.length) continue;
      
      const bytes = [buffer[pos] ?? 0, buffer[pos + 1] ?? 0, buffer[pos + 2] ?? 0, buffer[pos + 3] ?? 0];
      
      // ARM MUL pattern
      if (i % 4 === 0 && (bytes[3] & 0x0F) === 0x0E && (bytes[2] & 0xF0) === 0x00) {
        return true;
      }
      
      // ARM ADD with immediate pattern
      if (i % 4 === 0 && (bytes[3] & 0x0F) === 0xE2 && (bytes[2] & 0xF0) === 0x80) {
        return true;
      }
    }
    return false;
  },
  extractAddress: (buffer: Uint8Array, matchOffset: number): number | null => {
    // Same address extraction logic as Emerald
    for (let offset = -50; offset <= 50; offset += 4) {
      const pos = matchOffset + offset;
      if (pos < 0 || pos + 3 >= buffer.length) continue;
      
      if (buffer[pos + 2] === 0x9F && buffer[pos + 3] === 0xE5) {
        const immediate = (buffer[pos] ?? 0) | ((buffer[pos + 1] ?? 0) << 8);
        const pc = pos + 8;
        const literalAddr = pc + immediate;
        
        if (literalAddr + 3 < buffer.length) {
          const address = new DataView(buffer.buffer, buffer.byteOffset + literalAddr, 4).getUint32(0, true);
          if (address >= 0x02000000 && address <= 0x02040000 && address % 4 === 0) {
            return address;
          }
        }
      }
    }
    return null;
  },
  confidence: 'high',
  gameVariant: 'quetzal'
};

/**
 * BEHAVIORAL PATTERN 4: THUMB Party Bounds Check
 * Detects THUMB code that validates party slot index (0-5)
 * Pattern: CMP r?, #5 (ensuring slot index is valid)
 */
export const THUMB_PARTY_BOUNDS: BehavioralPattern = {
  name: 'thumb_party_bounds',
  description: 'Detects THUMB party slot bounds checking (CMP r?, #5)',
  hexPattern: '05 28', // CMP r0, #5 (THUMB immediate)
  validateContext: (buffer: Uint8Array, matchOffset: number): boolean => {
    // Look for conditional branch after the CMP
    for (let i = 1; i <= 10; i++) {
      if (matchOffset + i >= buffer.length) break;
      
      const byte = buffer[matchOffset + i] ?? 0;
      
      // THUMB conditional branch: D? ?? (but not unconditional DF ??)
      if ((byte & 0xF0) === 0xD0 && (byte & 0x0F) !== 0x0F) {
        return true; // Found conditional branch after CMP
      }
    }
    return false;
  },
  extractAddress: (buffer: Uint8Array, matchOffset: number): number | null => {
    // Look for THUMB LDR PC-relative instructions nearby
    for (let offset = -20; offset <= 20; offset += 2) {
      const pos = matchOffset + offset;
      if (pos < 0 || pos + 1 >= buffer.length) continue;
      
      // THUMB LDR literal: 48 ?? (LDR r0-r7, [PC, #imm])
      const firstByte = buffer[pos] ?? 0;
      if ((firstByte & 0xF8) === 0x48) {
        const immediate = buffer[pos + 1] ?? 0;
        const pc = ((pos + 4) & ~3); // THUMB PC alignment
        const literalAddr = pc + (immediate * 4);
        
        if (literalAddr + 3 < buffer.length) {
          const address = new DataView(buffer.buffer, buffer.byteOffset + literalAddr, 4).getUint32(0, true);
          if (address >= 0x02000000 && address <= 0x02040000 && address % 4 === 0) {
            return address;
          }
        }
      }
    }
    return null;
  },
  confidence: 'medium',
  gameVariant: 'both'
};

/**
 * BEHAVIORAL PATTERN 5: ARM Party Bounds Check
 * Detects ARM code that validates party slot index (0-5)
 * Pattern: CMP r?, #5 (ARM immediate comparison)
 */
export const ARM_PARTY_BOUNDS: BehavioralPattern = {
  name: 'arm_party_bounds',
  description: 'Detects ARM party slot bounds checking (CMP r?, #5)',
  hexPattern: '05 00 50 E3', // CMP r0, #5 (ARM immediate)
  validateContext: (buffer: Uint8Array, matchOffset: number): boolean => {
    // Look for conditional ARM instructions after the CMP
    for (let i = 4; i <= 20; i += 4) {
      if (matchOffset + i + 3 >= buffer.length) break;
      
      const conditionByte = buffer[matchOffset + i + 3] ?? 0;
      
      // ARM conditional instruction (condition != 0xE for always)
      if ((conditionByte & 0xF0) !== 0xE0) {
        return true; // Found conditional instruction after CMP
      }
    }
    return false;
  },
  extractAddress: (buffer: Uint8Array, matchOffset: number): number | null => {
    // Look for ARM LDR literal instructions nearby
    for (let offset = -50; offset <= 50; offset += 4) {
      const pos = matchOffset + offset;
      if (pos < 0 || pos + 3 >= buffer.length) continue;
      
      // ARM LDR literal: ?? ?? 9F E5
      if (buffer[pos + 2] === 0x9F && buffer[pos + 3] === 0xE5) {
        const immediate = (buffer[pos] ?? 0) | ((buffer[pos + 1] ?? 0) << 8);
        const pc = pos + 8;
        const literalAddr = pc + immediate;
        
        if (literalAddr + 3 < buffer.length) {
          const address = new DataView(buffer.buffer, buffer.byteOffset + literalAddr, 4).getUint32(0, true);
          if (address >= 0x02000000 && address <= 0x02040000 && address % 4 === 0) {
            return address;
          }
        }
      }
    }
    return null;
  },
  confidence: 'medium',
  gameVariant: 'both'
};

/**
 * All TRUE behavioral patterns for scanning
 */
export const BEHAVIORAL_PATTERNS: BehavioralPattern[] = [
  PARTY_SIZE_LOOP,
  POKEMON_SIZE_CALC_EMERALD,
  POKEMON_SIZE_CALC_QUETZAL,
  THUMB_PARTY_BOUNDS,
  ARM_PARTY_BOUNDS
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