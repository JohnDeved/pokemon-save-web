/**
 * Byte pattern matcher for finding assembly instructions and data patterns
 * that reference specific memory addresses
 */

import type { BytePattern, PatternMatch, MemoryRegion, ArmInstruction } from './types'

export class BytePatternMatcher {
  /**
   * Find all occurrences of patterns in memory regions
   */
  findPatterns(regions: MemoryRegion[], patterns: BytePattern[]): PatternMatch[] {
    const matches: PatternMatch[] = []
    
    for (const region of regions) {
      for (const pattern of patterns) {
        const regionMatches = this.findPatternInRegion(region, pattern)
        matches.push(...regionMatches)
      }
    }
    
    return matches.sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * Find pattern matches within a single memory region
   */
  private findPatternInRegion(region: MemoryRegion, pattern: BytePattern): PatternMatch[] {
    const matches: PatternMatch[] = []
    const { data } = region
    const { pattern: patternBytes, mask } = pattern
    
    // Search for pattern in the memory region
    for (let i = 0; i <= data.length - patternBytes.length; i++) {
      if (this.matchesAtOffset(data, i, patternBytes, mask)) {
        const matchedBytes = data.slice(i, i + patternBytes.length)
        const absoluteAddress = region.address + i
        
        // Try to parse as ARM/Thumb instruction for context
        const context = this.analyzeInstructionContext(data, i, absoluteAddress)
        
        // Calculate confidence based on context and pattern specificity
        const confidence = this.calculateConfidence(pattern, context, absoluteAddress)
        
        matches.push({
          pattern,
          address: absoluteAddress,
          matchedBytes,
          confidence,
          context
        })
      }
    }
    
    return matches
  }

  /**
   * Check if pattern matches at specific offset
   */
  private matchesAtOffset(
    data: Uint8Array, 
    offset: number, 
    pattern: Uint8Array, 
    mask?: Uint8Array
  ): boolean {
    for (let i = 0; i < pattern.length; i++) {
      const dataByte = data[offset + i]
      const patternByte = pattern[i]
      const maskByte = mask?.[i] ?? 0xFF
      
      if ((dataByte & maskByte) !== (patternByte & maskByte)) {
        return false
      }
    }
    return true
  }

  /**
   * Analyze instruction context around a match
   */
  private analyzeInstructionContext(
    data: Uint8Array, 
    offset: number, 
    address: number
  ): PatternMatch['context'] {
    // Try to parse as Thumb instruction (16-bit)
    if (offset + 1 < data.length) {
      const thumbInstr = data[offset] | (data[offset + 1] << 8)
      const thumbContext = this.parseThumbInstruction(thumbInstr, address)
      if (thumbContext) return thumbContext
    }
    
    // Try to parse as ARM instruction (32-bit)
    if (offset + 3 < data.length) {
      const armInstr = data[offset] | (data[offset + 1] << 8) | 
                      (data[offset + 2] << 16) | (data[offset + 3] << 24)
      const armContext = this.parseArmInstruction(armInstr, address)
      if (armContext) return armContext
    }
    
    return undefined
  }

  /**
   * Parse Thumb instruction and extract referenced addresses
   */
  private parseThumbInstruction(instruction: number, address: number): PatternMatch['context'] | undefined {
    // Thumb LDR immediate: 0b01001xxx xxxxxxxx
    if ((instruction & 0xF800) === 0x4800) {
      const imm8 = instruction & 0xFF
      const pc = (address + 4) & ~3 // Align to 4-byte boundary
      const referencedAddress = pc + (imm8 * 4)
      
      return {
        instructionType: 'thumb_ldr_imm',
        operands: [imm8],
        referencedAddress
      }
    }
    
    // Thumb MOV immediate: 0b00100xxx xxxxxxxx
    if ((instruction & 0xF800) === 0x2000) {
      const imm8 = instruction & 0xFF
      return {
        instructionType: 'thumb_mov_imm',
        operands: [imm8]
      }
    }
    
    return undefined
  }

  /**
   * Parse ARM instruction and extract referenced addresses
   */
  private parseArmInstruction(instruction: number, address: number): PatternMatch['context'] | undefined {
    // ARM LDR immediate: 0b1110 0101 1001 xxxx xxxx xxxxxxxxxxxx
    if ((instruction & 0xFFF00000) === 0xE5900000) {
      const imm12 = instruction & 0xFFF
      const rn = (instruction >> 16) & 0xF
      
      return {
        instructionType: 'arm_ldr_imm',
        operands: [rn, imm12]
      }
    }
    
    // ARM MOV immediate: 0b1110 0011 1010 0000 xxxx xxxxxxxxxxxx
    if ((instruction & 0xFFFF0000) === 0xE3A00000) {
      const imm12 = instruction & 0xFFF
      return {
        instructionType: 'arm_mov_imm',
        operands: [imm12]
      }
    }
    
    return undefined
  }

  /**
   * Calculate confidence score for a pattern match
   */
  private calculateConfidence(
    pattern: BytePattern, 
    context: PatternMatch['context'], 
    address: number
  ): number {
    let confidence = 0.5 // Base confidence
    
    // Increase confidence if we have instruction context
    if (context?.instructionType) {
      confidence += 0.2
    }
    
    // Increase confidence if referenced address matches expected
    if (pattern.expectedAddress && context?.referencedAddress) {
      const addressDiff = Math.abs(context.referencedAddress - pattern.expectedAddress)
      if (addressDiff === 0) {
        confidence += 0.3
      } else if (addressDiff < 0x1000) {
        confidence += 0.1
      }
    }
    
    // Increase confidence for specific instruction types that commonly access party data
    if (context?.instructionType?.includes('ldr')) {
      confidence += 0.1
    }
    
    return Math.min(1.0, confidence)
  }

  /**
   * Create common patterns for finding partyData references
   */
  static createPartyDataPatterns(expectedAddress: number): BytePattern[] {
    const patterns: BytePattern[] = []
    
    // Convert address to bytes (little-endian)
    const addrBytes = new Uint8Array(4)
    const addr = expectedAddress >>> 0 // Ensure unsigned 32-bit
    addrBytes[0] = addr & 0xFF
    addrBytes[1] = (addr >> 8) & 0xFF
    addrBytes[2] = (addr >> 16) & 0xFF
    addrBytes[3] = (addr >> 24) & 0xFF
    
    // Pattern 1: Direct address reference (32-bit immediate)
    patterns.push({
      name: 'direct_address',
      description: 'Direct 32-bit address reference',
      pattern: addrBytes,
      expectedAddress
    })
    
    // Pattern 2: Thumb LDR with PC-relative addressing
    // The pattern depends on the offset, so we'll create a few common variants
    for (let offset = 0; offset < 256; offset += 4) {
      const pcBase = expectedAddress - offset
      if ((pcBase & 3) === 0) { // Must be 4-byte aligned
        const thumbImm = offset / 4
        if (thumbImm <= 255) {
          const thumbPattern = new Uint8Array([
            0x48 | ((thumbImm >> 5) & 0x07), // Thumb LDR opcode with high bits of immediate
            thumbImm & 0x1F // Low bits of immediate
          ])
          
          patterns.push({
            name: `thumb_ldr_pc_rel_${offset}`,
            description: `Thumb LDR PC-relative with offset ${offset}`,
            pattern: thumbPattern,
            expectedAddress
          })
        }
      }
    }
    
    // Pattern 3: ARM MOV/MOVW/MOVT sequence for address loading
    const movwImm = expectedAddress & 0xFFFF
    const movtImm = (expectedAddress >> 16) & 0xFFFF
    
    // MOVW pattern: encode immediate in ARM format
    if (movwImm <= 0xFFFF) {
      const movwBytes = new Uint8Array(4)
      movwBytes[0] = movwImm & 0xFF
      movwBytes[1] = (movwImm >> 8) & 0xFF
      movwBytes[2] = 0x00 // Register field (R0)
      movwBytes[3] = 0xE3 // MOVW opcode
      
      patterns.push({
        name: 'arm_movw',
        description: 'ARM MOVW instruction loading low 16 bits',
        pattern: movwBytes,
        mask: new Uint8Array([0xFF, 0xFF, 0x00, 0xFF]), // Ignore register field
        expectedAddress
      })
    }
    
    return patterns
  }

  /**
   * Search for address references in immediate values
   */
  findAddressReferences(regions: MemoryRegion[], targetAddress: number, tolerance = 0x100): PatternMatch[] {
    const matches: PatternMatch[] = []
    
    for (const region of regions) {
      const data = region.data
      
      // Search for 32-bit immediate values that are close to target address
      for (let i = 0; i <= data.length - 4; i += 1) {
        const value = (data[i]) | (data[i + 1] << 8) | (data[i + 2] << 16) | (data[i + 3] << 24)
        
        // Use unsigned comparison to handle large addresses correctly
        const diff = Math.abs((value >>> 0) - (targetAddress >>> 0))
        
        if (diff <= tolerance) {
          const pattern: BytePattern = {
            name: 'address_reference',
            description: `Potential address reference to 0x${targetAddress.toString(16)}`,
            pattern: new Uint8Array([data[i], data[i + 1], data[i + 2], data[i + 3]]),
            expectedAddress: targetAddress
          }
          
          const match: PatternMatch = {
            pattern,
            address: region.address + i,
            matchedBytes: new Uint8Array([data[i], data[i + 1], data[i + 2], data[i + 3]]),
            confidence: Math.max(0, 1.0 - (diff / tolerance)),
            context: {
              referencedAddress: value >>> 0 // Ensure unsigned
            }
          }
          
          matches.push(match)
        }
      }
    }
    
    return matches
  }
}