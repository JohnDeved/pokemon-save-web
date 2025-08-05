/**
 * Tests for BytePatternMatcher
 */

import { describe, it, expect } from 'vitest'
import { BytePatternMatcher } from '../byte-pattern-matcher'
import type { MemoryRegion, BytePattern } from '../types'

describe('BytePatternMatcher', () => {
  const matcher = new BytePatternMatcher()

  // Create test memory region
  const createTestRegion = (address: number, data: number[]): MemoryRegion => ({
    address,
    size: data.length,
    data: new Uint8Array(data)
  })

  describe('Pattern Detection', () => {
    it('should find exact pattern matches', () => {
      const region = createTestRegion(0x2000000, [
        0x01, 0x02, 0x03, 0x04, // Pattern to find
        0x05, 0x06, 0x07, 0x08,
        0x01, 0x02, 0x03, 0x04  // Same pattern again
      ])

      const pattern: BytePattern = {
        name: 'test_pattern',
        description: 'Test pattern',
        pattern: new Uint8Array([0x01, 0x02, 0x03, 0x04])
      }

      const matches = matcher.findPatterns([region], [pattern])

      expect(matches).toHaveLength(2)
      expect(matches[0].address).toBe(0x2000000)
      expect(matches[1].address).toBe(0x2000008)
    })

    it('should find patterns with masks (wildcards)', () => {
      const region = createTestRegion(0x2000000, [
        0x01, 0xFF, 0x03, 0x04, // Should match with mask
        0x01, 0x00, 0x03, 0x04  // Should also match with mask
      ])

      const pattern: BytePattern = {
        name: 'masked_pattern',
        description: 'Pattern with mask',
        pattern: new Uint8Array([0x01, 0x00, 0x03, 0x04]),
        mask: new Uint8Array([0xFF, 0x00, 0xFF, 0xFF]) // Ignore second byte
      }

      const matches = matcher.findPatterns([region], [pattern])

      expect(matches).toHaveLength(2)
      expect(matches[0].address).toBe(0x2000000)
      expect(matches[1].address).toBe(0x2000004)
    })

    it('should find Thumb LDR PC-relative patterns', () => {
      // Thumb LDR r0, [PC, #8] -> 0x4802
      const region = createTestRegion(0x2000000, [
        0x02, 0x48, // Thumb LDR r0, [PC, #8]
        0x00, 0x00,
        0x00, 0x00,
        0x00, 0x00,
        0xEC, 0x44, 0x02, 0x02 // Target address 0x20244EC
      ])

      const patterns = BytePatternMatcher.createPartyDataPatterns(0x20244EC)
      const matches = matcher.findPatterns([region], patterns)

      // Should find the direct address reference
      const addressMatches = matches.filter(m => m.pattern.name === 'direct_address')
      expect(addressMatches).toHaveLength(1)
      expect(addressMatches[0].address).toBe(0x2000008)
    })
  })

  describe('Address Reference Detection', () => {
    it('should find direct address references', () => {
      const targetAddress = 0x20244EC
      const data = [
        0x00, 0x00, 0x00, 0x00,
        0xEC, 0x44, 0x02, 0x02, // Target address in little-endian
        0xFF, 0xFF, 0xFF, 0xFF
      ]

      const region = createTestRegion(0x2000000, data)
      const matches = matcher.findAddressReferences([region], targetAddress, 0x10)

      expect(matches).toHaveLength(1)
      expect(matches[0].address).toBe(0x2000004)
      expect(matches[0].confidence).toBeCloseTo(1.0, 2)
      expect(matches[0].context?.referencedAddress).toBe(targetAddress)
    })

    it('should find near-address references within tolerance', () => {
      const targetAddress = 0x20244EC
      const nearAddress = 0x20244F0 // 4 bytes off
      const data = [
        0xF0, 0x44, 0x02, 0x02 // Near address in little-endian
      ]

      const region = createTestRegion(0x2000000, data)
      const matches = matcher.findAddressReferences([region], targetAddress, 0x10)

      expect(matches).toHaveLength(1)
      expect(matches[0].address).toBe(0x2000000)
      expect(matches[0].confidence).toBeLessThan(1.0)
      expect(matches[0].context?.referencedAddress).toBe(nearAddress)
    })

    it('should ignore addresses outside tolerance', () => {
      const targetAddress = 0x20244EC
      const farAddress = 0x30000000
      const data = [
        0x00, 0x00, 0x00, 0x30 // Far address in little-endian
      ]

      const region = createTestRegion(0x2000000, data)
      const matches = matcher.findAddressReferences([region], targetAddress, 0x100)

      expect(matches).toHaveLength(0)
    })
  })

  describe('Pattern Creation', () => {
    it('should create patterns for known addresses', () => {
      const address = 0x20244EC
      const patterns = BytePatternMatcher.createPartyDataPatterns(address)

      expect(patterns.length).toBeGreaterThan(0)

      // Should include direct address pattern
      const directPattern = patterns.find(p => p.name === 'direct_address')
      expect(directPattern).toBeDefined()
      expect(directPattern!.pattern).toEqual(new Uint8Array([0xEC, 0x44, 0x02, 0x02]))
      expect(directPattern!.expectedAddress).toBe(address)

      // Should include Thumb LDR patterns
      const thumbPatterns = patterns.filter(p => p.name.startsWith('thumb_ldr_pc_rel'))
      expect(thumbPatterns.length).toBeGreaterThan(0)
    })

    it('should create different patterns for different addresses', () => {
      const vanilla = BytePatternMatcher.createPartyDataPatterns(0x20244EC)
      const quetzal = BytePatternMatcher.createPartyDataPatterns(0x20235B8)

      expect(vanilla.length).toBeGreaterThan(0)
      expect(quetzal.length).toBeGreaterThan(0)

      // Direct address patterns should be different
      const vanillaDirect = vanilla.find(p => p.name === 'direct_address')!
      const quetzalDirect = quetzal.find(p => p.name === 'direct_address')!

      expect(vanillaDirect.pattern).not.toEqual(quetzalDirect.pattern)
    })
  })

  describe('Instruction Context Analysis', () => {
    it('should identify Thumb LDR instructions', () => {
      // Test data with Thumb LDR r0, [PC, #4]
      const region = createTestRegion(0x2000000, [
        0x01, 0x48, // Thumb LDR r0, [PC, #4]
        0x00, 0x00,
        0xEC, 0x44, 0x02, 0x20 // Target data
      ])

      const pattern: BytePattern = {
        name: 'thumb_ldr',
        description: 'Thumb LDR pattern',
        pattern: new Uint8Array([0x01, 0x48])
      }

      const matches = matcher.findPatterns([region], [pattern])

      expect(matches).toHaveLength(1)
      expect(matches[0].context?.instructionType).toBe('thumb_ldr_imm')
      expect(matches[0].context?.referencedAddress).toBeDefined()
    })

    it('should calculate confidence based on context', () => {
      const region = createTestRegion(0x2000000, [
        0x01, 0x48, // Thumb LDR - should have higher confidence
        0x01, 0x20  // Thumb MOV - should have lower confidence
      ])

      const ldrPattern: BytePattern = {
        name: 'ldr_pattern',
        description: 'LDR pattern',
        pattern: new Uint8Array([0x01, 0x48])
      }

      const movPattern: BytePattern = {
        name: 'mov_pattern', 
        description: 'MOV pattern',
        pattern: new Uint8Array([0x01, 0x20])
      }

      const matches = matcher.findPatterns([region], [ldrPattern, movPattern])

      const ldrMatch = matches.find(m => m.pattern.name === 'ldr_pattern')!
      const movMatch = matches.find(m => m.pattern.name === 'mov_pattern')!

      // LDR should have higher confidence due to instruction context
      expect(ldrMatch.confidence).toBeGreaterThan(movMatch.confidence)
    })
  })
})