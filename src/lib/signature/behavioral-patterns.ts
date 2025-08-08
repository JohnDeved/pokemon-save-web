/**
 * Behavioral Universal Patterns for Pokemon PartyData Detection
 * 
 * This system finds partyData addresses by identifying characteristic code patterns
 * that manipulate party data, without knowing the target addresses beforehand.
 * 
 * These patterns work by detecting:
 * 1. Party iteration loops (6 Pokemon)
 * 2. Pokemon size calculations (100/104 bytes)
 * 3. Party data access sequences
 * 4. Characteristic memory layout patterns
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
 * BEHAVIORAL PATTERN 1: Party Loop Counter
 * Detects code that loops through exactly 6 Pokemon (party size)
 * Pattern looks for: MOV r?, #6 followed by party access code
 */
export const PARTY_LOOP_PATTERN: BehavioralPattern = {
  name: 'party_loop_counter',
  description: 'Detects loops that iterate through 6 Pokemon in party',
  hexPattern: '06 20', // Just MOV r0, #6 - simpler pattern
  extractAddress: (buffer: Uint8Array, matchOffset: number): number | null => {
    // Look for ARM LDR instructions within 32 bytes of the loop counter
    for (let offset = -32; offset <= 32; offset += 4) {
      const checkOffset = matchOffset + offset;
      if (checkOffset < 0 || checkOffset + 3 >= buffer.length) continue;
      
      // Look for ARM LDR literal: E5 9F ?? ??
      if (buffer[checkOffset + 2] === 0x9F && buffer[checkOffset + 3] === 0xE5) {
        const immediate = (buffer[checkOffset] ?? 0) | ((buffer[checkOffset + 1] ?? 0) << 8);
        const pc = checkOffset + 8; // ARM PC calculation
        const literalAddr = pc + immediate;
        
        if (literalAddr + 3 < buffer.length) {
          const dataView = new DataView(buffer.buffer, buffer.byteOffset + literalAddr, 4);
          const address = dataView.getUint32(0, true);
          
          // Validate this looks like a party data address (in RAM range)
          if (address >= 0x02020000 && address <= 0x02030000) {
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
 * Detects code that multiplies by Pokemon struct size
 * Emerald: 100 bytes (0x64), Quetzal: 104 bytes (0x68)
 */
export const POKEMON_SIZE_PATTERN: BehavioralPattern = {
  name: 'pokemon_size_calculation',
  description: 'Detects multiplication by Pokemon struct size',
  hexPattern: 'E0 ?? ?? 6[48] E5 9F ?? ??', // ADD with size 0x64 or 0x68 + LDR
  extractAddress: (buffer: Uint8Array, matchOffset: number): number | null => {
    // The LDR instruction should be right after the size calculation
    const ldrOffset = matchOffset + 4;
    if (ldrOffset + 3 >= buffer.length) return null;
    
    // Check for LDR literal: E5 9F ?? ??
    if (buffer[ldrOffset + 2] === 0x9F && buffer[ldrOffset + 3] === 0xE5) {
      const immediate = (buffer[ldrOffset] ?? 0) | ((buffer[ldrOffset + 1] ?? 0) << 8);
      const pc = ldrOffset + 8;
      const literalAddr = pc + immediate;
      
      if (literalAddr + 3 < buffer.length) {
        const dataView = new DataView(buffer.buffer, buffer.byteOffset + literalAddr, 4);
        const address = dataView.getUint32(0, true);
        
        // Validate address range
        if (address >= 0x02020000 && address <= 0x02030000) {
          return address;
        }
      }
    }
    return null;
  },
  confidence: 'high',
  gameVariant: 'both'
};

/**
 * BEHAVIORAL PATTERN 3: Party Slot Access
 * Detects code that accesses individual Pokemon slots
 * Uses characteristic THUMB sequence for slot calculation
 */
export const PARTY_SLOT_ACCESS_PATTERN: BehavioralPattern = {
  name: 'party_slot_access',
  description: 'Detects individual Pokemon slot access patterns',
  hexPattern: '48 ?? 68 ?? 0[01-69] 30', // LDR + LDR + ADD with valid slot multiplier
  extractAddress: (buffer: Uint8Array, matchOffset: number): number | null => {
    // Extract from THUMB LDR literal
    const immediate = buffer[matchOffset + 1] ?? 0;
    
    // Calculate THUMB PC and literal address
    const pc = ((matchOffset + 4) & ~3);
    const literalAddr = pc + (immediate * 4);
    
    if (literalAddr + 3 < buffer.length) {
      const dataView = new DataView(buffer.buffer, buffer.byteOffset + literalAddr, 4);
      const address = dataView.getUint32(0, true);
      
      // Validate this is a party data address
      if (address >= 0x02020000 && address <= 0x02030000) {
        return address;
      }
    }
    return null;
  },
  confidence: 'medium',
  gameVariant: 'both'
};

/**
 * BEHAVIORAL PATTERN 4: Party Data Bounds Check
 * Detects code that validates party slot indices (0-5)
 * Common in party manipulation functions
 */
export const PARTY_BOUNDS_CHECK_PATTERN: BehavioralPattern = {
  name: 'party_bounds_check',
  description: 'Detects party slot bounds validation (0-5)',
  hexPattern: '05 28', // Just CMP #5 - simpler pattern
  extractAddress: (buffer: Uint8Array, matchOffset: number): number | null => {
    // Look for the LDR instruction within 32 bytes after the bounds check
    for (let offset = 4; offset <= 32; offset += 4) {
      const ldrOffset = matchOffset + offset;
      if (ldrOffset + 3 >= buffer.length) continue;
      
      if (buffer[ldrOffset + 2] === 0x9F && buffer[ldrOffset + 3] === 0xE5) {
        const immediate = (buffer[ldrOffset] ?? 0) | ((buffer[ldrOffset + 1] ?? 0) << 8);
        const pc = ldrOffset + 8;
        const literalAddr = pc + immediate;
        
        if (literalAddr + 3 < buffer.length) {
          const dataView = new DataView(buffer.buffer, buffer.byteOffset + literalAddr, 4);
          const address = dataView.getUint32(0, true);
          
          if (address >= 0x02020000 && address <= 0x02030000) {
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
 * BEHAVIORAL PATTERN 5: Pokemon Battle Data Access
 * Detects patterns specific to battle system accessing party data
 * Often involves HP, status, or move data access
 */
export const BATTLE_PARTY_ACCESS_PATTERN: BehavioralPattern = {
  name: 'battle_party_access',
  description: 'Detects battle system party data access patterns',
  hexPattern: '48 ?? 79 ?? 29 00 D1 ?? E5 9F', // LDR + LDRB + CMP + branch + LDR
  extractAddress: (buffer: Uint8Array, matchOffset: number): number | null => {
    // The initial LDR loads the party base address
    const immediate = buffer[matchOffset + 1] ?? 0;
    const pc = ((matchOffset + 4) & ~3);
    const literalAddr = pc + (immediate * 4);
    
    if (literalAddr + 3 < buffer.length) {
      const dataView = new DataView(buffer.buffer, buffer.byteOffset + literalAddr, 4);
      const address = dataView.getUint32(0, true);
      
      if (address >= 0x02020000 && address <= 0x02030000) {
        return address;
      }
    }
    return null;
  },
  confidence: 'low',
  gameVariant: 'both'
};

/**
 * All behavioral patterns for scanning
 */
export const BEHAVIORAL_PATTERNS: BehavioralPattern[] = [
  PARTY_LOOP_PATTERN,
  POKEMON_SIZE_PATTERN,
  PARTY_SLOT_ACCESS_PATTERN,
  PARTY_BOUNDS_CHECK_PATTERN,
  BATTLE_PARTY_ACCESS_PATTERN
];

/**
 * Convert hex pattern to byte array for matching
 */
export function parseHexPattern(hexPattern: string): { bytes: number[], mask: number[] } {
  const parts = hexPattern.split(' ');
  const bytes: number[] = [];
  const mask: number[] = [];
  
  for (const part of parts) {
    if (part === '??') {
      bytes.push(0);
      mask.push(0);
    } else if (part.includes('[') && part.includes(']')) {
      // Range pattern like 6[48] or 0[01-69]
      const baseChar = part.charAt(0);
      const rangeContent = part.slice(part.indexOf('[') + 1, part.indexOf(']'));
      
      if (rangeContent.includes('-')) {
        // Range like 0[01-69] - for now, just match the base character
        const base = parseInt(baseChar, 16);
        bytes.push(base);
        mask.push(0xF0); // Match only upper nibble
      } else {
        // Specific values like 6[48] means match 64 or 68
        // We'll match the base character (6) in upper nibble
        const base = parseInt(baseChar, 16);
        bytes.push(base << 4); // Shift to upper nibble  
        mask.push(0xF0); // Match only upper nibble
      }
    } else if (part.includes('?')) {
      // Single wildcard like E? or ?5
      const value = parseInt(part.replace('?', '0'), 16);
      bytes.push(value);
      mask.push(part.charAt(0) === '?' ? 0x0F : 0xF0);
    } else {
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