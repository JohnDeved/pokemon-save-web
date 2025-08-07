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
      expect(signatureNames).toContain('emerald_party_loop')
      expect(signatureNames).toContain('emerald_party_count_check')
      expect(signatureNames).toContain('emerald_pokemon_size_calc')
      expect(signatureNames).toContain('quetzal_party_access')
      expect(signatureNames).toContain('thumb_party_load')
      expect(signatureNames).toContain('party_vs_wild_comparison')
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
  describe('real pattern resolvers', () => {
    it('should resolve Emerald party loop pattern', () => {
      // Create a pattern that matches EMERALD_PARTY_LOOP_PATTERN: 'E5 9F ? ? E3 A0 ? 00 E1 A0 ? 00 E1 50 ? 06'
      const mockBytes = new Uint8Array([
        0x04, 0x00, 0x9F, 0xE5, // LDR r0, [PC, #4] - matches E5 9F ? ?
        0x00, 0x02, 0xA0, 0xE3, // MOV r2, #0x02000000 - matches E3 A0 ? 00  
        0x00, 0x10, 0xA0, 0xE1, // MOV r1, r0 - matches E1 A0 ? 00
        0x06, 0x00, 0x50, 0xE1, // CMP r0, #6 - matches E1 50 ? 06
        0xEC, 0x44, 0x02, 0x02, // target address 0x020244EC at PC+8+4=16
      ])
      
      const signature = PARTY_DATA_SIGNATURES.find(s => s.name === 'emerald_party_loop')!
      const match = {
        offset: 0,
        signature,
        matchedBytes: mockBytes.slice(0, 16),
      }
      
      const resolvedAddress = signature.resolver.resolve(match, mockBytes)
      expect(resolvedAddress).toBe(0x020244EC)
    })

    it('should resolve party count check with offset', () => {
      // Test the party count pattern that adds 3 to get partyData
      const mockBytes = new Uint8Array([
        0x04, 0x00, 0x9F, 0xE5, // LDR r0, [PC, #4] 
        0x00, 0x00, 0xD0, 0xE5, // LDRB r0, [r0]
        0x06, 0x00, 0x50, 0xE3, // CMP r0, #6
        0x00, 0x00, 0x00, 0x00, // padding
        0xE9, 0x44, 0x02, 0x02, // party count address 0x020244E9
      ])
      
      const signature = PARTY_DATA_SIGNATURES.find(s => s.name === 'emerald_party_count_check')!
      const match = {
        offset: 0,
        signature,
        matchedBytes: mockBytes.slice(0, 16),
      }
      
      const resolvedAddress = signature.resolver.resolve(match, mockBytes)
      expect(resolvedAddress).toBe(0x020244EC) // count + 3 = 0x020244E9 + 3 = 0x020244EC
    })

    it('should handle resolver errors gracefully', () => {
      const mockBytes = new Uint8Array([0x00, 0x00, 0x00, 0x00]) // Invalid data
      
      const signature = PARTY_DATA_SIGNATURES[0]!
      const match = {
        offset: 0,
        signature,
        matchedBytes: mockBytes,
      }
      
      expect(() => signature.resolver.resolve(match, mockBytes))
        .toThrow('Could not resolve ARM LDR literal')
    })
  })

  describe('legacy armLdrLiteralResolver', () => {
    it('should resolve ARM LDR literal instruction', () => {
      // Test the legacy resolver directly
      const mockBytes = new Uint8Array([
        0x04, 0x00, 0x9F, 0xE5, // LDR r0, [PC, #4] (little-endian)
        0x00, 0x00, 0x00, 0x00, // padding 
        0xEC, 0x44, 0x02, 0x02, // target address 0x020244EC (little-endian)
      ])
      
      const match = {
        offset: 0,
        signature: PARTY_DATA_SIGNATURES[0]!,
        matchedBytes: mockBytes.slice(0, 12),
      }
      
      const resolvedAddress = armLdrLiteralResolver.resolve(match, mockBytes)
      expect(resolvedAddress).toBe(0x020244EC)
    })

    it('should throw error when no LDR literal found', () => {
      const mockBytes = new Uint8Array([0x00, 0x00, 0x00, 0x00])
      
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
        0xFF, 0x0F, 0x9F, 0xE5, // LDR r0, [PC, #4095] - large offset  
      ])
      
      const match = {
        offset: 0,
        signature: PARTY_DATA_SIGNATURES[0]!,
        matchedBytes: mockBytes,
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