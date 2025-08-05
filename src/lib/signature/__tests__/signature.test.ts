/**
 * Tests for ASM signature scanning system
 */

import { describe, it, expect } from 'vitest'
import { SignatureScanner } from '../scanner'
import { PARTY_DATA_SIGNATURES } from '../patterns'
import { armLdrLiteralResolver, thumbLdrLiteralResolver } from '../resolver'
import type { AsmSignature } from '../types'

describe('SignatureScanner', () => {
  describe('pattern creation', () => {
    it('should create pattern from IDA signature string', () => {
      const pattern = SignatureScanner.createPattern('E5 9F ? ? 01 C0')
      
      expect(pattern.pattern).toEqual([0xE5, 0x9F, -1, -1, 0x01, 0xC0])
      expect(pattern.mask).toBe('xx??xx')
      expect(pattern.idaSignature).toBe('E5 9F ? ? 01 C0')
    })

    it('should create pattern from bytes and mask', () => {
      const pattern = SignatureScanner.createPatternFromMask([0xE5, 0x9F, 0x12, 0x34], 'xx??')
      
      expect(pattern.pattern).toEqual([0xE5, 0x9F, -1, -1])
      expect(pattern.mask).toBe('xx??')
      expect(pattern.idaSignature).toBe('E5 9F ? ?')
    })

    it('should throw error for invalid bytes in signature', () => {
      expect(() => SignatureScanner.createPattern('E5 XX ? ?')).toThrow('Invalid byte in signature: XX')
    })

    it('should throw error for mismatched bytes and mask lengths', () => {
      expect(() => SignatureScanner.createPatternFromMask([0xE5, 0x9F], 'xxx')).toThrow('Bytes array and mask string must have same length')
    })
  })

  describe('pattern matching', () => {
    it('should find exact pattern matches', () => {
      const scanner = new SignatureScanner()
      const buffer = new Uint8Array([0x00, 0xE5, 0x9F, 0x12, 0x34, 0x01, 0xC0, 0xFF])
      const pattern = SignatureScanner.createPattern('E5 9F 12 34 01 C0')
      
      const matches = scanner.findPattern(buffer, pattern)
      expect(matches).toEqual([1])
    })

    it('should find pattern matches with wildcards', () => {
      const scanner = new SignatureScanner()
      const buffer = new Uint8Array([0x00, 0xE5, 0x9F, 0x12, 0x34, 0x01, 0xC0, 0xFF])
      const pattern = SignatureScanner.createPattern('E5 9F ? ? 01 C0')
      
      const matches = scanner.findPattern(buffer, pattern)
      expect(matches).toEqual([1])
    })

    it('should find multiple matches', () => {
      const scanner = new SignatureScanner()
      const buffer = new Uint8Array([0xE5, 0x9F, 0x12, 0x34, 0x00, 0xE5, 0x9F, 0x56, 0x78])
      const pattern = SignatureScanner.createPattern('E5 9F ? ?')
      
      const matches = scanner.findPattern(buffer, pattern)
      expect(matches).toEqual([0, 5])
    })

    it('should handle patterns longer than buffer', () => {
      const scanner = new SignatureScanner()
      const buffer = new Uint8Array([0xE5, 0x9F])
      const pattern = SignatureScanner.createPattern('E5 9F 12 34 56 78')
      
      const matches = scanner.findPattern(buffer, pattern)
      expect(matches).toEqual([])
    })

    it('should handle empty patterns', () => {
      const scanner = new SignatureScanner()
      const buffer = new Uint8Array([0xE5, 0x9F])
      const pattern = { pattern: [], mask: '', idaSignature: '' }
      
      const matches = scanner.findPattern(buffer, pattern)
      expect(matches).toEqual([])
    })
  })

  describe('signature scanning', () => {
    const mockSignature: AsmSignature = {
      name: 'test_signature',
      mode: 'ARM',
      pattern: SignatureScanner.createPattern('E5 9F ? ?'),
      resolver: {
        description: 'Test resolver',
        resolve: (match) => match.offset + 0x02000000,
      },
      supportedVariants: ['emerald', 'quetzal'],
    }

    it('should scan buffer for registered signatures', () => {
      const scanner = new SignatureScanner()
      scanner.addSignature(mockSignature)
      
      const buffer = new Uint8Array([0x00, 0xE5, 0x9F, 0x12, 0x34, 0xFF])
      const results = scanner.scan(buffer)
      
      expect(results.matches).toHaveLength(1)
      expect(results.matches[0]!.offset).toBe(1)
      expect(results.matches[0]!.signature.name).toBe('test_signature')
      expect(results.resolvedAddresses.get('test_signature')).toBe(0x02000001)
      expect(results.errors).toHaveLength(0)
    })

    it('should filter signatures by variant', () => {
      const scanner = new SignatureScanner()
      scanner.addSignature(mockSignature)
      
      const emeraldOnlySignature: AsmSignature = {
        ...mockSignature,
        name: 'emerald_only',
        supportedVariants: ['emerald'],
      }
      scanner.addSignature(emeraldOnlySignature)
      
      const buffer = new Uint8Array([0xE5, 0x9F, 0x12, 0x34])
      
      // Scan for quetzal - should only find the generic signature
      const quetzalResults = scanner.scan(buffer, 'quetzal')
      const foundNames = quetzalResults.matches.map(m => m.signature.name)
      expect(foundNames).toContain('test_signature')
      expect(foundNames).not.toContain('emerald_only')
      
      // Scan for emerald - should find both signatures
      const emeraldResults = scanner.scan(buffer, 'emerald')
      const emeraldNames = emeraldResults.matches.map(m => m.signature.name)
      expect(emeraldNames).toContain('test_signature')
      expect(emeraldNames).toContain('emerald_only')
    })

    it('should handle resolver errors gracefully', () => {
      const failingSignature: AsmSignature = {
        ...mockSignature,
        name: 'failing_signature',
        resolver: {
          description: 'Failing resolver',
          resolve: () => { throw new Error('Resolution failed') },
        },
      }
      
      const scanner = new SignatureScanner()
      scanner.addSignature(failingSignature)
      
      const buffer = new Uint8Array([0xE5, 0x9F, 0x12, 0x34])
      const results = scanner.scan(buffer)
      
      expect(results.matches).toHaveLength(1)
      expect(results.resolvedAddresses.has('failing_signature')).toBe(false)
      expect(results.errors).toHaveLength(1)
      expect(results.errors[0]).toContain('Failed to resolve address for failing_signature')
    })
  })

  describe('pre-defined signatures', () => {
    it('should load all party data signatures', () => {
      expect(PARTY_DATA_SIGNATURES).toHaveLength(6)
      
      const signatureNames = PARTY_DATA_SIGNATURES.map(s => s.name)
      expect(signatureNames).toContain('partyData_arm_ldr_literal')
      expect(signatureNames).toContain('partyData_thumb_ldr_literal')
      expect(signatureNames).toContain('partyCount_access')
      expect(signatureNames).toContain('pokemon_struct_access')
      expect(signatureNames).toContain('quetzal_pokemon_struct_access')
      expect(signatureNames).toContain('partyData_direct_reference')
    })

    it('should have valid patterns for all signatures', () => {
      for (const signature of PARTY_DATA_SIGNATURES) {
        expect(signature.pattern.pattern.length).toBeGreaterThan(0)
        expect(signature.pattern.mask).toBeTruthy()
        expect(signature.pattern.idaSignature).toBeTruthy()
        expect(signature.resolver.description).toBeTruthy()
        expect(signature.supportedVariants.length).toBeGreaterThan(0)
      }
    })
  })
})

describe('Address Resolvers', () => {
  describe('armLdrLiteralResolver', () => {
    it('should resolve ARM LDR literal instruction', () => {
      // Create a mock ARM LDR literal: E59F0004 (LDR r0, [PC, #4])  
      // Followed by the target address at PC+8+4 = PC+12
      const mockBytes = new Uint8Array([
        0x04, 0x00, 0x9F, 0xE5, // LDR r0, [PC, #4] (little-endian) - THIS is the LDR literal
        0x00, 0x00, 0x00, 0x00, // padding 
        0xEC, 0x44, 0x02, 0x02, // target address 0x020244EC (little-endian)
      ])
      
      const match = {
        offset: 0,
        signature: PARTY_DATA_SIGNATURES[0]!, // ARM LDR signature
        matchedBytes: mockBytes.slice(0, 12), // Include the whole context
      }
      
      const resolvedAddress = armLdrLiteralResolver.resolve(match, mockBytes)
      expect(resolvedAddress).toBe(0x020244EC)
    })

    it('should throw error when no LDR literal found', () => {
      const mockBytes = new Uint8Array([0x00, 0x00, 0x00, 0x00]) // Not an LDR literal
      
      const match = {
        offset: 0,
        signature: PARTY_DATA_SIGNATURES[0]!,
        matchedBytes: mockBytes,
      }
      
      expect(() => armLdrLiteralResolver.resolve(match, mockBytes))
        .toThrow('No ARM LDR literal instruction found')
    })

    it('should throw error when literal address is out of bounds', () => {
      const mockBytes = new Uint8Array([
        0x04, 0x00, 0x9F, 0xE5, // LDR r0, [PC, #4] - valid LDR literal
      ])
      
      const match = {
        offset: 0,
        signature: PARTY_DATA_SIGNATURES[0]!,
        matchedBytes: mockBytes, // But buffer is too small for the literal read
      }
      
      expect(() => armLdrLiteralResolver.resolve(match, mockBytes))
        .toThrow('is outside buffer bounds')
    })
  })

  describe('thumbLdrLiteralResolver', () => {
    it('should resolve THUMB LDR literal instruction', () => {
      // Create a mock THUMB LDR literal: 4801 (LDR r0, [PC, #4])
      // THUMB PC calculation: (PC & ~1) + 4 = (0 & ~1) + 4 = 4  
      // Word aligned: (4 & ~3) + (1 * 4) = 4 + 4 = 8
      const mockBytes = new Uint8Array([
        0x01, 0x48, // LDR r0, [PC, #4] (little-endian) - offset 0
        0x00, 0x00, // padding - offset 2
        0x00, 0x00, 0x00, 0x00, // padding - offset 4
        0xB8, 0x35, 0x02, 0x02, // target address 0x020235B8 (little-endian) - offset 8
      ])
      
      const match = {
        offset: 0,
        signature: PARTY_DATA_SIGNATURES[1]!, // THUMB LDR signature
        matchedBytes: mockBytes.slice(0, 8), // Include enough context
      }
      
      const resolvedAddress = thumbLdrLiteralResolver.resolve(match, mockBytes)
      expect(resolvedAddress).toBe(0x020235B8)
    })

    it('should throw error when no THUMB LDR literal found', () => {
      const mockBytes = new Uint8Array([0x00, 0x00]) // Not a THUMB LDR literal
      
      const match = {
        offset: 0,
        signature: PARTY_DATA_SIGNATURES[1]!,
        matchedBytes: mockBytes,
      }
      
      expect(() => thumbLdrLiteralResolver.resolve(match, mockBytes))
        .toThrow('No THUMB LDR literal instruction found')
    })
  })
})