/**
 * IDA-style byte pattern matcher for finding assembly instructions that
 * dynamically reference memory addresses (e.g., party data)
 */

import type { BytePattern, PatternMatch, MemoryRegion, ArmInstruction } from './types'

export class BytePatternMatcher {
  /**
   * Scan memory regions for instruction patterns and extract referenced addresses
   */
  scanForPartyDataReferences(regions: MemoryRegion[]): PatternMatch[] {
    const matches: PatternMatch[] = []
    
    // Create IDA-style patterns for common instructions that load addresses
    const patterns = this.createInstructionPatterns()
    
    for (const region of regions) {
      for (const pattern of patterns) {
        const regionMatches = this.findPatternInRegion(region, pattern)
        matches.push(...regionMatches)
      }
    }
    
    // Sort by confidence and filter for likely party data addresses
    return matches
      .sort((a, b) => b.confidence - a.confidence)
      .filter(match => this.isLikelyPartyDataAddress(match.context?.referencedAddress))
  }

  /**
   * Find all occurrences of patterns in memory regions (legacy method for tests)
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
   * Create IDA-style patterns for common ARM/Thumb instructions that load addresses
   */
  private createInstructionPatterns(): BytePattern[] {
    const patterns: BytePattern[] = []
    
    // Pattern 1: ARM LDR with immediate offset
    // LDR Rx, [PC, #imm] - loads address from PC+offset
    // Format: 0xE59F???? (where ???? is register and immediate)
    patterns.push({
      name: 'arm_ldr_pc_imm',
      description: 'ARM LDR PC-relative with immediate',
      pattern: new Uint8Array([0x9F, 0xFF, 0xFF, 0xE5]), // Little-endian: E59FFFFF
      mask: new Uint8Array([0xFF, 0x00, 0xF0, 0xFF])     // Ignore register and lower 4 bits of immediate
    })
    
    // Pattern 2: Thumb LDR PC-relative  
    // LDR Rx, [PC, #imm] in Thumb mode
    // Format: 0x48?? (where ?? is register and immediate)
    patterns.push({
      name: 'thumb_ldr_pc',
      description: 'Thumb LDR PC-relative',
      pattern: new Uint8Array([0x48, 0x00]),
      mask: new Uint8Array([0xF8, 0x00])  // Match opcode, ignore register and immediate
    })
    
    // Pattern 3: ARM MOV with immediate (for loading high addresses)
    // MOV Rx, #imm - often used to load high 16 bits
    // Format: 0xE3A0???? 
    patterns.push({
      name: 'arm_mov_imm',
      description: 'ARM MOV with immediate',
      pattern: new Uint8Array([0xA0, 0xFF, 0xFF, 0xE3]), // Little-endian: E3FFFFA0
      mask: new Uint8Array([0xF0, 0x00, 0x0F, 0xFF])     // Match opcode pattern
    })
    
    // Pattern 4: ARM MOVW (load 16-bit immediate into lower half)
    // MOVW Rx, #imm16
    // Format: 0xE30?????
    patterns.push({
      name: 'arm_movw',
      description: 'ARM MOVW load 16-bit immediate',
      pattern: new Uint8Array([0x00, 0xFF, 0x0F, 0xE3]), // Little-endian: E30FFF00
      mask: new Uint8Array([0x00, 0x00, 0xF0, 0xFF])     // Match opcode
    })
    
    // Pattern 5: ARM MOVT (load 16-bit immediate into upper half)
    // MOVT Rx, #imm16  
    // Format: 0xE34?????
    patterns.push({
      name: 'arm_movt',
      description: 'ARM MOVT load top 16-bit immediate', 
      pattern: new Uint8Array([0x00, 0xFF, 0x4F, 0xE3]), // Little-endian: E34FFF00
      mask: new Uint8Array([0x00, 0x00, 0xF0, 0xFF])     // Match opcode
    })
    
    // Pattern 6: Direct 32-bit address reference in data
    // This catches addresses stored as immediate data
    patterns.push({
      name: 'direct_address_data', 
      description: 'Direct 32-bit address in data section',
      pattern: new Uint8Array([0x00, 0x00, 0x02, 0x02]), // 0x02020000 pattern (EWRAM range)
      mask: new Uint8Array([0x00, 0x00, 0xFF, 0xFF])     // Match high 16 bits (0x0202xxxx)
    })
    
    return patterns
  }

  /**
   * Check if an address looks like it could be party data
   */
  private isLikelyPartyDataAddress(address?: number): boolean {
    if (!address) return false
    
    // Party data is typically in EWRAM (0x02000000 - 0x02040000)
    const isInEWRAM = address >= 0x02000000 && address < 0x02040000
    
    // Address should be reasonably aligned (at least 4-byte aligned for structures)
    const isAligned = (address & 0x3) === 0
    
    // Typical party data addresses are in the range we've seen
    const isInTypicalRange = address >= 0x02020000 && address < 0x02030000
    
    return isInEWRAM && isAligned && isInTypicalRange
  }
  /**
   * Find pattern matches within a single memory region and extract referenced addresses
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
        
        // Try to extract referenced address for IDA-style patterns
        let referencedAddress: number | undefined
        let context: PatternMatch['context']
        
        if (pattern.name.startsWith('ida_')) {
          // New IDA-style patterns - extract referenced address
          referencedAddress = this.extractReferencedAddress(
            data, i, absoluteAddress, pattern.name
          )
          
          if (referencedAddress !== undefined) {
            context = {
              instructionType: pattern.name,
              referencedAddress,
              operands: this.extractOperands(data, i, pattern.name)
            }
          }
        } else {
          // Legacy patterns - use old analysis method
          context = this.analyzeInstructionContext(data, i, absoluteAddress)
        }
        
        // Only include matches that have valid context (for IDA patterns) or any match (for legacy)
        if (!pattern.name.startsWith('ida_') || context) {
          const confidence = pattern.name.startsWith('ida_') && referencedAddress ?
            this.calculateInstructionConfidence(pattern, referencedAddress, absoluteAddress) :
            this.calculateConfidence(pattern, context, absoluteAddress)
          
          matches.push({
            pattern,
            address: absoluteAddress,
            matchedBytes,
            confidence,
            context
          })
        }
      }
    }
    
    return matches
  }

  /**
   * Extract the memory address being referenced by an instruction
   */
  private extractReferencedAddress(
    data: Uint8Array, 
    offset: number, 
    instructionAddress: number,
    patternName: string
  ): number | undefined {
    switch (patternName) {
      case 'arm_ldr_pc_imm': {
        // ARM LDR PC-relative: extract 12-bit immediate
        if (offset + 3 < data.length) {
          const instruction = data[offset] | (data[offset + 1] << 8) | 
                            (data[offset + 2] << 16) | (data[offset + 3] << 24)
          const immediate = instruction & 0xFFF
          const pc = instructionAddress + 8 // ARM PC is +8
          return pc + immediate
        }
        break
      }
      
      case 'thumb_ldr_pc': {
        // Thumb LDR PC-relative: extract 8-bit immediate (word-aligned)
        if (offset + 1 < data.length) {
          const instruction = data[offset] | (data[offset + 1] << 8)
          const immediate = (instruction & 0xFF) * 4 // Word-aligned
          const pc = (instructionAddress + 4) & ~3 // Thumb PC is +4, word-aligned
          return pc + immediate
        }
        break
      }
      
      case 'arm_movw': {
        // ARM MOVW: extract 16-bit immediate from instruction encoding
        if (offset + 3 < data.length) {
          const instruction = data[offset] | (data[offset + 1] << 8) | 
                            (data[offset + 2] << 16) | (data[offset + 3] << 24)
          // MOVW encoding: extract imm16 from bits [19:16,11:0]
          const imm4 = (instruction >> 16) & 0xF
          const imm12 = instruction & 0xFFF
          return (imm4 << 12) | imm12
        }
        break
      }
      
      case 'arm_movt': {
        // ARM MOVT: extract 16-bit immediate (would need to combine with previous MOVW)
        if (offset + 3 < data.length) {
          const instruction = data[offset] | (data[offset + 1] << 8) | 
                            (data[offset + 2] << 16) | (data[offset + 3] << 24)
          const imm4 = (instruction >> 16) & 0xF
          const imm12 = instruction & 0xFFF
          const upper16 = (imm4 << 12) | imm12
          return upper16 << 16 // Return upper 16 bits (need to combine with MOVW)
        }
        break
      }
      
      case 'direct_address_data': {
        // Direct 32-bit address in data
        if (offset + 3 < data.length) {
          return data[offset] | (data[offset + 1] << 8) | 
                (data[offset + 2] << 16) | (data[offset + 3] << 24)
        }
        break
      }
    }
    
    return undefined
  }

  /**
   * Extract operands from instruction for context
   */
  private extractOperands(data: Uint8Array, offset: number, patternName: string): number[] {
    const operands: number[] = []
    
    if (offset + 3 < data.length) {
      const instruction = data[offset] | (data[offset + 1] << 8) | 
                        (data[offset + 2] << 16) | (data[offset + 3] << 24)
      
      switch (patternName) {
        case 'arm_ldr_pc_imm':
          operands.push((instruction >> 12) & 0xF) // Destination register
          operands.push(instruction & 0xFFF)       // Immediate
          break
        case 'thumb_ldr_pc':
          operands.push((instruction >> 8) & 0x7)  // Destination register  
          operands.push(instruction & 0xFF)        // Immediate
          break
      }
    }
    
    return operands
  }

  /**
   * Calculate confidence for instruction-based matches
   */
  private calculateInstructionConfidence(
    pattern: BytePattern,
    referencedAddress: number,
    instructionAddress: number
  ): number {
    let confidence = 0.3 // Base confidence for instruction match
    
    // Higher confidence for addresses in likely party data range
    if (this.isLikelyPartyDataAddress(referencedAddress)) {
      confidence += 0.4
    }
    
    // Higher confidence for certain instruction types
    if (pattern.name.includes('ldr')) {
      confidence += 0.2 // LDR instructions commonly used for data access
    }
    
    // Higher confidence if instruction is in code regions (lower addresses)
    if (instructionAddress < 0x02000000) {
      confidence += 0.1 // Likely in ROM/code section
    }
    
    return Math.min(1.0, confidence)
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
   * Calculate confidence score for a pattern match (legacy method)
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
   * Create IDA-style patterns for finding partyData references dynamically
   * This is the new approach - instead of looking for specific addresses,
   * we look for instruction patterns that would load party data addresses
   */
  static createPartyDataPatterns(expectedAddress?: number): BytePattern[] {
    const patterns: BytePattern[] = []
    
    // IDA-style patterns for instructions that typically load party data addresses
    
    // Pattern 1: ARM LDR PC-relative (most common for loading data addresses)
    patterns.push({
      name: 'ida_arm_ldr_pc',
      description: 'IDA pattern: ARM LDR PC-relative instruction',
      pattern: new Uint8Array([0x9F, 0xFF, 0xFF, 0xE5]), // E59FFFFF in little-endian
      mask: new Uint8Array([0xFF, 0x00, 0xF0, 0xFF]),     // ??9?F?E5 in IDA style
      expectedAddress
    })
    
    // Pattern 2: Thumb LDR PC-relative  
    patterns.push({
      name: 'ida_thumb_ldr_pc',
      description: 'IDA pattern: Thumb LDR PC-relative instruction',
      pattern: new Uint8Array([0x48, 0x00]),
      mask: new Uint8Array([0xF8, 0x00]),                 // 48 ?? in IDA style
      expectedAddress
    })
    
    // Pattern 3: MOVW/MOVT sequence for 32-bit immediate loading
    patterns.push({
      name: 'ida_arm_movw',
      description: 'IDA pattern: ARM MOVW instruction',
      pattern: new Uint8Array([0x00, 0xFF, 0x0F, 0xE3]), // E30FFF00 in little-endian  
      mask: new Uint8Array([0x00, 0x00, 0xF0, 0xFF]),     // ?? ?? ?F E3 in IDA style
      expectedAddress
    })
    
    // Pattern 4: Direct address references in data/pool sections
    patterns.push({
      name: 'ida_direct_address',
      description: 'IDA pattern: Direct 32-bit address reference',
      pattern: new Uint8Array([0x00, 0x00, 0x02, 0x02]), // 0x0202???? range
      mask: new Uint8Array([0x00, 0x00, 0xFF, 0xFF]),     // ?? ?? 02 02 in IDA style  
      expectedAddress
    })

    // If we have an expected address, also create specific patterns for it
    if (expectedAddress) {
      const addrBytes = new Uint8Array(4)
      const addr = expectedAddress >>> 0 // Ensure unsigned 32-bit
      addrBytes[0] = addr & 0xFF
      addrBytes[1] = (addr >> 8) & 0xFF
      addrBytes[2] = (addr >> 16) & 0xFF
      addrBytes[3] = (addr >> 24) & 0xFF
      
      patterns.push({
        name: 'direct_address',
        description: 'Direct 32-bit address reference',
        pattern: addrBytes,
        expectedAddress
      })
      
      // Add some legacy Thumb LDR patterns for compatibility with tests
      // Generate a few common PC-relative patterns
      for (let offset = 0; offset < 64; offset += 4) {
        const pcBase = expectedAddress - offset
        if ((pcBase & 3) === 0) { // Must be 4-byte aligned
          const thumbImm = offset / 4
          if (thumbImm <= 7) { // Keep it simple for common cases
            const thumbPattern = new Uint8Array([
              0x48 | (thumbImm & 0x07), // Thumb LDR opcode with immediate
              0x00
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
    }
    
    return patterns
  }

  /**
   * Search for address references in immediate values (enhanced version)
   */
  findAddressReferences(regions: MemoryRegion[], targetAddress?: number, tolerance = 0x100): PatternMatch[] {
    const matches: PatternMatch[] = []
    
    for (const region of regions) {
      const data = region.data
      
      // Search for 32-bit immediate values
      for (let i = 0; i <= data.length - 4; i += 1) {
        const value = (data[i]) | (data[i + 1] << 8) | (data[i + 2] << 16) | (data[i + 3] << 24)
        const unsignedValue = value >>> 0
        
        let shouldInclude = false
        let confidence = 0.2
        
        if (targetAddress) {
          // When we have a target address, be strict about proximity
          const isNearTarget = Math.abs(unsignedValue - (targetAddress >>> 0)) <= tolerance
          if (isNearTarget) {
            shouldInclude = true
            const diff = Math.abs(unsignedValue - targetAddress)
            confidence = diff === 0 ? 1.0 : Math.max(0.2, 1.0 - (diff / tolerance))
          }
        } else {
          // When no target address, look for addresses that seem like party data
          if (this.isLikelyPartyDataAddress(unsignedValue)) {
            shouldInclude = true
            confidence = 0.6
          }
        }
        
        if (shouldInclude) {
          const pattern: BytePattern = {
            name: 'address_reference',
            description: targetAddress ? 
              `Address reference near 0x${targetAddress.toString(16)}` :
              `Potential party data address 0x${unsignedValue.toString(16)}`,
            pattern: new Uint8Array([data[i], data[i + 1], data[i + 2], data[i + 3]]),
            expectedAddress: targetAddress
          }
          
          const match: PatternMatch = {
            pattern,
            address: region.address + i,
            matchedBytes: new Uint8Array([data[i], data[i + 1], data[i + 2], data[i + 3]]),
            confidence,
            context: {
              referencedAddress: unsignedValue
            }
          }
          
          matches.push(match)
        }
      }
    }
    
    return matches
  }

  /**
   * Analyze instruction context around a match (legacy method)
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
   * Parse Thumb instruction and extract referenced addresses (legacy method)
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
   * Parse ARM instruction and extract referenced addresses (legacy method)
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
  private calculateAddressReferenceConfidence(
    foundAddress: number, 
    targetAddress?: number, 
    tolerance = 0x100
  ): number {
    let confidence = 0.2 // Base confidence for finding any address
    
    // Higher confidence if it looks like party data
    if (this.isLikelyPartyDataAddress(foundAddress)) {
      confidence += 0.4
    }
    
    // Higher confidence if close to target
    if (targetAddress) {
      const diff = Math.abs(foundAddress - targetAddress)
      if (diff === 0) {
        confidence += 0.4
      } else if (diff <= tolerance) {
        confidence += 0.2 * (1 - diff / tolerance)
      }
    }
    
    return Math.min(1.0, confidence)
  }
}