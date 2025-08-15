/**
 * Runtime pattern scanner for finding ASM signatures in memory dumps
 */

import type { AsmSignature, BytePattern, SignatureMatch, ScanResults } from './types'

/**
 * Scans a buffer for ASM signatures and resolves target addresses
 */
export class SignatureScanner {
  private readonly signatures = new Map<string, AsmSignature>()

  /**
   * Register a signature for scanning
   */
  addSignature (signature: AsmSignature): void {
    this.signatures.set(signature.name, signature)
  }

  /**
   * Register multiple signatures
   */
  addSignatures (signatures: readonly AsmSignature[]): void {
    for (const sig of signatures) {
      this.addSignature(sig)
    }
  }

  /**
   * Scan a memory buffer for all registered signatures
   */
  scan (buffer: Uint8Array, variant?: string): ScanResults {
    const matches: SignatureMatch[] = []
    const resolvedAddresses = new Map<string, number>()
    const errors: string[] = []

    for (const signature of this.signatures.values()) {
      // Skip signatures that don't support this variant
      if (variant && !signature.supportedVariants.includes(variant)) {
        continue
      }

      try {
        const sigMatches = this.findPattern(buffer, signature.pattern)

        for (const offset of sigMatches) {
          const matchedBytes = buffer.slice(offset, offset + signature.pattern.pattern.length)
          const match: SignatureMatch = {
            offset,
            signature,
            matchedBytes,
          }

          matches.push(match)

          // Resolve the target address
          try {
            const address = signature.resolver.resolve(match, buffer)
            resolvedAddresses.set(signature.name, address)
          } catch (resolveError) {
            errors.push(`Failed to resolve address for ${signature.name}: ${resolveError}`)
          }
        }
      } catch (scanError) {
        errors.push(`Failed to scan for ${signature.name}: ${scanError}`)
      }
    }

    return {
      matches,
      resolvedAddresses,
      errors,
    }
  }

  /**
   * Find all occurrences of a byte pattern in a buffer
   */
  findPattern (buffer: Uint8Array, pattern: BytePattern): number[] {
    const matches: number[] = []
    const patternLength = pattern.pattern.length

    if (patternLength === 0 || patternLength > buffer.length) {
      return matches
    }

    for (let i = 0; i <= buffer.length - patternLength; i++) {
      if (this.matchesAtOffset(buffer, i, pattern)) {
        matches.push(i)
      }
    }

    return matches
  }

  /**
   * Check if pattern matches at a specific offset in the buffer
   */
  private matchesAtOffset (buffer: Uint8Array, offset: number, pattern: BytePattern): boolean {
    const patternBytes = pattern.pattern

    for (let i = 0; i < patternBytes.length; i++) {
      const patternByte = patternBytes[i]!

      // -1 is wildcard, always matches
      if (patternByte === -1) {
        continue
      }

      // Check if buffer byte matches pattern byte
      if (buffer[offset + i] !== patternByte) {
        return false
      }
    }

    return true
  }

  /**
   * Create a byte pattern from IDA-style signature string
   * Example: "E5 9F ? ? 01 C0" -> pattern with wildcards
   */
  static createPattern (idaSignature: string): BytePattern {
    const parts = idaSignature.trim().split(/\s+/)
    const pattern: number[] = []
    let mask = ''

    for (const part of parts) {
      if (part === '?') {
        pattern.push(-1) // Wildcard
        mask += '?'
      } else {
        const byte = parseInt(part, 16)
        if (isNaN(byte) || byte < 0 || byte > 255) {
          throw new Error(`Invalid byte in signature: ${part}`)
        }
        pattern.push(byte)
        mask += 'x'
      }
    }

    return {
      pattern,
      mask,
      idaSignature,
    }
  }

  /**
   * Create a pattern from bytes and mask strings
   * Example: bytes=[0xE5, 0x9F, 0x12, 0x34], mask="xx??"
   */
  static createPatternFromMask (bytes: number[], mask: string): BytePattern {
    if (bytes.length !== mask.length) {
      throw new Error('Bytes array and mask string must have same length')
    }

    const pattern: number[] = []
    const idaParts: string[] = []

    for (let i = 0; i < bytes.length; i++) {
      if (mask[i] === '?') {
        pattern.push(-1)
        idaParts.push('?')
      } else {
        pattern.push(bytes[i]!)
        idaParts.push(bytes[i]!.toString(16).toUpperCase().padStart(2, '0'))
      }
    }

    return {
      pattern,
      mask,
      idaSignature: idaParts.join(' '),
    }
  }
}
