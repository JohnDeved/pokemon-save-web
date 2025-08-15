/**
 * Tools for extracting ASM signatures from memory dumps and disassembly
 */

import type {
  MemoryAccessContext,
  MemoryDumpConfig,
  MemoryRegion,
  BytePattern,
} from './types'
import { SignatureScanner } from './scanner'

/**
 * Memory dump acquisition and analysis tools
 */
export class SignatureExtractor {
  /**
   * Analyze memory access contexts to identify candidate signature locations
   */
  static analyzeAccessContexts (contexts: readonly MemoryAccessContext[]): MemoryRegion[] {
    const regions: MemoryRegion[] = []
    const groupedByPC = new Map<number, MemoryAccessContext[]>()

    // Group contexts by program counter for frequency analysis
    for (const context of contexts) {
      const existing = groupedByPC.get(context.pc) ?? []
      existing.push(context)
      groupedByPC.set(context.pc, existing)
    }

    // Find frequently accessed instruction addresses
    const frequentPCs = [...groupedByPC.entries()]
      .filter(([_, ctxs]) => ctxs.length >= 2) // At least 2 accesses
      .sort(([_, a], [__, b]) => b.length - a.length) // Sort by frequency
      .slice(0, 10) // Top 10 most frequent

    // Create memory regions around frequent access points
    for (const [pc, ctxs] of frequentPCs) {
      const representativeContext = ctxs[0]!
      regions.push({
        address: pc - 32, // 32 bytes before instruction
        size: 64, // 64 bytes total context
        description: `Frequent ${representativeContext.mode} access to 0x${representativeContext.targetAddress.toString(16)} (${ctxs.length} hits)`,
      })
    }

    return regions
  }

  /**
   * Extract byte patterns from instruction contexts
   * Identifies common sequences that access target memory addresses
   */
  static extractPatternsFromContexts (contexts: readonly MemoryAccessContext[]): BytePattern[] {
    const patterns: BytePattern[] = []
    const seenPatterns = new Set<string>()

    for (const context of contexts) {
      try {
        const pattern = this.extractPatternFromContext(context)
        const key = pattern.idaSignature

        if (!seenPatterns.has(key)) {
          patterns.push(pattern)
          seenPatterns.add(key)
        }
      } catch {
        // Skip contexts that can't be converted to patterns
        continue
      }
    }

    return patterns
  }

  /**
   * Extract a byte pattern from a single memory access context
   */
  private static extractPatternFromContext (context: MemoryAccessContext): BytePattern {
    const bytes = context.instructionContext

    if (bytes.length < 4) {
      throw new Error('Instruction context too small for pattern extraction')
    }

    // For ARM/THUMB, focus on the specific instruction that accessed memory
    // Use heuristics to identify and preserve stable parts while wildcarding variable parts

    if (context.mode === 'ARM') {
      return this.extractArmPattern(bytes)
    } else {
      return this.extractThumbPattern(bytes)
    }
  }

  /**
   * Extract pattern from ARM instruction sequence
   */
  private static extractArmPattern (bytes: Uint8Array): BytePattern {
    // ARM instructions are 4 bytes, aligned
    const pattern: number[] = []
    let mask = ''
    const idaParts: string[] = []

    // Process in 4-byte chunks
    for (let i = 0; i < Math.min(bytes.length, 16); i += 4) {
      if (i + 4 > bytes.length) break

      const instruction = new DataView(bytes.buffer, bytes.byteOffset + i, 4).getUint32(0, true)

      // Analyze instruction to determine which bytes to wildcard
      const stabilized = this.stabilizeArmInstruction(instruction)

      for (let j = 0; j < 4; j++) {
        const byte = (stabilized >>> (j * 8)) & 0xFF
        const isWildcard = ((instruction ^ stabilized) >>> (j * 8)) & 0xFF

        if (isWildcard) {
          pattern.push(-1)
          mask += '?'
          idaParts.push('?')
        } else {
          pattern.push(byte)
          mask += 'x'
          idaParts.push(byte.toString(16).toUpperCase().padStart(2, '0'))
        }
      }
    }

    return {
      pattern,
      mask,
      idaSignature: idaParts.join(' '),
    }
  }

  /**
   * Extract pattern from THUMB instruction sequence
   */
  private static extractThumbPattern (bytes: Uint8Array): BytePattern {
    // THUMB instructions are 2 bytes, some are 4 bytes (THUMB-2)
    const pattern: number[] = []
    let mask = ''
    const idaParts: string[] = []

    // Process in 2-byte chunks for THUMB
    for (let i = 0; i < Math.min(bytes.length, 12); i += 2) {
      if (i + 2 > bytes.length) break

      const instruction = new DataView(bytes.buffer, bytes.byteOffset + i, 2).getUint16(0, true)

      // Analyze instruction to determine which bytes to wildcard
      const stabilized = this.stabilizeThumbInstruction(instruction)

      for (let j = 0; j < 2; j++) {
        const byte = (stabilized >>> (j * 8)) & 0xFF
        const isWildcard = ((instruction ^ stabilized) >>> (j * 8)) & 0xFF

        if (isWildcard) {
          pattern.push(-1)
          mask += '?'
          idaParts.push('?')
        } else {
          pattern.push(byte)
          mask += 'x'
          idaParts.push(byte.toString(16).toUpperCase().padStart(2, '0'))
        }
      }
    }

    return {
      pattern,
      mask,
      idaSignature: idaParts.join(' '),
    }
  }

  /**
   * Stabilize ARM instruction by wildcarding variable fields while preserving structure
   * Returns instruction with variable fields zeroed for wildcard detection
   */
  private static stabilizeArmInstruction (instruction: number): number {
    let stabilized = instruction

    // Common ARM instruction patterns to stabilize:

    // LDR/STR immediate: preserve opcode, wildcard immediate and register fields
    if ((instruction & 0x0C000000) === 0x04000000) { // Load/Store immediate
      stabilized &= 0xFFF00000 // Keep condition, opcode, addressing mode
      // Zero out register and immediate fields for wildcarding
    }

    // LDR literal: preserve opcode pattern, wildcard immediate
    if ((instruction & 0x0F7F0000) === 0x059F0000) { // LDR Rt, [PC, #imm]
      stabilized &= 0xFFFF0000 // Keep opcode, wildcard immediate
    }

    // Data processing immediate: preserve opcode, wildcard register/immediate
    if ((instruction & 0x0C000000) === 0x00000000) { // Data processing
      stabilized &= 0xFFF00000 // Keep condition and opcode
    }

    return stabilized
  }

  /**
   * Stabilize THUMB instruction by wildcarding variable fields
   */
  private static stabilizeThumbInstruction (instruction: number): number {
    let stabilized = instruction

    // THUMB LDR literal: 01001ttt iiiiiiii
    if ((instruction & 0xF800) === 0x4800) {
      stabilized &= 0xF800 // Keep opcode, wildcard register and immediate
    }

    // THUMB LDR/STR immediate: preserve opcode pattern
    if ((instruction & 0xE000) === 0x6000) { // Load/store immediate
      stabilized &= 0xF800 // Keep opcode pattern
    }

    // THUMB data processing
    if ((instruction & 0xFC00) === 0x4000) {
      stabilized &= 0xFFC0 // Keep opcode, some register fields
    }

    return stabilized
  }

  /**
   * Validate that extracted patterns are unique and stable across contexts
   */
  static validatePatterns (patterns: readonly BytePattern[], contexts: readonly MemoryAccessContext[]): BytePattern[] {
    const validPatterns: BytePattern[] = []

    for (const pattern of patterns) {
      // Create temporary scanner to test pattern
      const scanner = new SignatureScanner()
      let matchCount = 0

      // Test pattern against all contexts to ensure reasonable uniqueness
      for (const context of contexts) {
        const matches = scanner.findPattern(context.instructionContext, pattern)
        matchCount += matches.length
      }

      // Pattern should match multiple contexts but not be too generic
      if (matchCount >= 2 && matchCount <= contexts.length * 0.5) {
        validPatterns.push(pattern)
      }
    }

    return validPatterns
  }

  /**
   * Generate memory dump configuration for comprehensive signature analysis
   */
  static createDumpConfig (baseAddress: number, context: 'initialization' | 'runtime' | 'full'): MemoryDumpConfig {
    const regions: MemoryRegion[] = []

    switch (context) {
      case 'initialization':
        regions.push(
          { address: 0x08000000, size: 0x1000000, description: 'ROM code section' },
          { address: 0x02000000, size: 0x40000, description: 'EWRAM data' },
        )
        break

      case 'runtime':
        regions.push(
          { address: baseAddress - 0x1000, size: 0x2000, description: 'Runtime context around target' },
          { address: 0x03000000, size: 0x8000, description: 'IWRAM' },
        )
        break

      case 'full':
        regions.push(
          { address: 0x08000000, size: 0x1000000, description: 'Full ROM' },
          { address: 0x02000000, size: 0x40000, description: 'Full EWRAM' },
          { address: 0x03000000, size: 0x8000, description: 'Full IWRAM' },
        )
        break
    }

    return {
      regions,
      gameState: 'menu_loaded', // Consistent state for comparison
      format: 'raw',
    }
  }
}
