/**
 * Address resolvers for different ARM/THUMB instruction patterns
 */

import type { AddressResolver, SignatureMatch } from './types'

/**
 * Resolves address from ARM LDR literal instruction: LDR Rt, [PC, #imm12]
 * Instruction format: 1110 0101 1001 1111 tttt iiii iiii iiii
 * Where PC-relative address = PC + 8 + imm12 (ARM mode PC+8 pipeline)
 */
export const armLdrLiteralResolver: AddressResolver = {
  description: 'ARM LDR literal: reads 32-bit address from PC+8+imm12',
  resolve: (match: SignatureMatch, buffer: Uint8Array) => {
    const matchOffset = match.offset

    // Find the LDR literal instruction in the matched pattern
    // Look for ARM LDR literal pattern: E59F (LDR Rt, [PC, #imm])
    let ldrOffset = -1
    for (let i = 0; i <= match.matchedBytes.length - 4; i += 4) {
      const word = new DataView(match.matchedBytes.buffer, match.matchedBytes.byteOffset + i, 4).getUint32(0, true)
      // Check for LDR literal: E59Fxxxx pattern (condition=always, LDR Rt,[PC,#+/-imm12])
      if (((word >>> 0) & 0xFFFF0000) === 0xE59F0000) {
        ldrOffset = i
        break
      }
    }

    if (ldrOffset === -1) {
      throw new Error('No ARM LDR literal instruction found in signature match')
    }

    const ldrInstruction = new DataView(match.matchedBytes.buffer, match.matchedBytes.byteOffset + ldrOffset, 4).getUint32(0, true)
    const imm12 = ldrInstruction & 0xFFF // Extract immediate offset

    // Calculate PC-relative address (ARM mode: PC = current + 8)
    const instructionAddress = matchOffset + ldrOffset
    const pcValue = instructionAddress + 8
    const literalAddress = pcValue + imm12

    // Read the 32-bit value at the literal address
    if (literalAddress + 4 > buffer.length) {
      throw new Error(`Literal address 0x${literalAddress.toString(16)} is outside buffer bounds`)
    }

    const targetAddress = new DataView(buffer.buffer, buffer.byteOffset + literalAddress, 4).getUint32(0, true)
    return targetAddress
  },
}

/**
 * Resolves address from THUMB LDR literal instruction: LDR Rt, [PC, #imm8*4]
 * Instruction format: 01001 ttt iiii iiii
 * Where PC-relative address = (PC & ~2) + 4 + imm8*4 (THUMB mode alignment)
 */
export const thumbLdrLiteralResolver: AddressResolver = {
  description: 'THUMB LDR literal: reads 32-bit address from (PC&~2)+4+imm8*4',
  resolve: (match: SignatureMatch, buffer: Uint8Array) => {
    const matchOffset = match.offset

    // Find THUMB LDR literal instruction: 01001xxx xxxxxxxx
    let ldrOffset = -1
    for (let i = 0; i <= match.matchedBytes.length - 2; i += 2) {
      const halfword = new DataView(match.matchedBytes.buffer, match.matchedBytes.byteOffset + i, 2).getUint16(0, true)
      // Check for THUMB LDR literal: bits [15:11] = 01001
      if ((halfword & 0xF800) === 0x4800) {
        ldrOffset = i
        break
      }
    }

    if (ldrOffset === -1) {
      throw new Error('No THUMB LDR literal instruction found in signature match')
    }

    const ldrInstruction = new DataView(match.matchedBytes.buffer, match.matchedBytes.byteOffset + ldrOffset, 2).getUint16(0, true)
    const imm8 = ldrInstruction & 0xFF // Extract immediate offset

    // Calculate PC-relative address (THUMB mode: PC = (current & ~1) + 4, word-aligned)
    const instructionAddress = matchOffset + ldrOffset
    const pcValue = (instructionAddress & ~1) + 4
    const literalAddress = (pcValue & ~3) + (imm8 * 4) // Word-aligned

    // Read the 32-bit value at the literal address
    if (literalAddress + 4 > buffer.length) {
      throw new Error(`Literal address 0x${literalAddress.toString(16)} is outside buffer bounds`)
    }

    const targetAddress = new DataView(buffer.buffer, buffer.byteOffset + literalAddress, 4).getUint32(0, true)
    return targetAddress
  },
}

/**
 * Resolves address by reading a 32-bit pointer at a fixed offset from the match
 */
export function createOffsetResolver (offset: number, description?: string): AddressResolver {
  return {
    description: description ?? `Read 32-bit address at match+${offset}`,
    resolve: (match: SignatureMatch, buffer: Uint8Array) => {
      const absoluteOffset = match.offset + offset

      if (absoluteOffset + 4 > buffer.length) {
        throw new Error(`Offset ${absoluteOffset} + 4 bytes exceeds buffer bounds`)
      }

      return new DataView(buffer.buffer, buffer.byteOffset + absoluteOffset, 4).getUint32(0, true)
    },
  }
}

/**
 * Resolves address by following a chain of pointers
 * Example: match -> read ptr1 -> read ptr2 -> final address
 */
export function createPointerChainResolver (offsets: readonly number[], description?: string): AddressResolver {
  return {
    description: description ?? `Follow pointer chain with offsets: [${offsets.join(', ')}]`,
    resolve: (match: SignatureMatch, buffer: Uint8Array) => {
      let currentAddress = match.offset

      for (let i = 0; i < offsets.length; i++) {
        const offset = offsets[i]!
        currentAddress += offset

        if (currentAddress + 4 > buffer.length) {
          throw new Error(`Chain step ${i}: address 0x${currentAddress.toString(16)} + 4 bytes exceeds buffer bounds`)
        }

        // Read next address in chain
        currentAddress = new DataView(buffer.buffer, buffer.byteOffset + currentAddress, 4).getUint32(0, true)

        // Convert from RAM address to buffer offset for intermediate steps
        if (i < offsets.length - 1) {
          // Assume IWRAM region starts at 0x03000000, EWRAM at 0x02000000
          if (currentAddress >= 0x02000000 && currentAddress < 0x04000000) {
            currentAddress = currentAddress - 0x02000000
            if (currentAddress >= buffer.length) {
              throw new Error(`Chain step ${i}: RAM address 0x${(currentAddress + 0x02000000).toString(16)} is outside dumped region`)
            }
          } else {
            throw new Error(`Chain step ${i}: address 0x${currentAddress.toString(16)} is not in expected RAM range`)
          }
        }
      }

      return currentAddress
    },
  }
}
