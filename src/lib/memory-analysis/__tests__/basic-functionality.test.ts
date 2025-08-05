/**
 * Basic functionality test for memory analysis system
 */

import { describe, it, expect } from 'vitest'
import { BytePatternMatcher } from '../byte-pattern-matcher'
import type { MemoryRegion } from '../types'

describe('Memory Analysis - Basic Functionality', () => {
  const matcher = new BytePatternMatcher()

  // Test data representing memory with partyData address references
  const createMemoryWithAddressReference = (address: number): MemoryRegion => {
    const data = new Uint8Array(1024)
    
    // Add direct address reference at offset 0x100
    const addr = address >>> 0 // Ensure unsigned
    data[0x100] = addr & 0xFF
    data[0x101] = (addr >> 8) & 0xFF
    data[0x102] = (addr >> 16) & 0xFF
    data[0x103] = (addr >> 24) & 0xFF
    
    return {
      address: 0x2020000,
      size: data.length,
      data
    }
  }

  describe('Address Detection', () => {
    it('should detect vanilla emerald partyData address (0x20244EC)', () => {
      const vanillaAddress = 0x20244EC
      const region = createMemoryWithAddressReference(vanillaAddress)
      
      const matches = matcher.findAddressReferences([region], vanillaAddress, 0x10)
      
      expect(matches).toHaveLength(1)
      expect(matches[0].address).toBe(0x2020100) // Base + offset
      expect(matches[0].confidence).toBe(1.0) // Exact match
      expect(matches[0].context?.referencedAddress).toBe(vanillaAddress)
    })

    it('should detect quetzal partyData address (0x20235B8)', () => {
      const quetzalAddress = 0x20235B8
      const region = createMemoryWithAddressReference(quetzalAddress)
      
      const matches = matcher.findAddressReferences([region], quetzalAddress, 0x10)
      
      expect(matches).toHaveLength(1) 
      expect(matches[0].address).toBe(0x2020100) // Base + offset
      expect(matches[0].confidence).toBe(1.0) // Exact match
      expect(matches[0].context?.referencedAddress).toBe(quetzalAddress)
    })

    it('should distinguish between different ROM addresses', () => {
      const vanillaAddress = 0x20244EC
      const quetzalAddress = 0x20235B8
      
      // Create memory with vanilla address
      const vanillaRegion = createMemoryWithAddressReference(vanillaAddress)
      
      // Search for vanilla address - should find it
      const vanillaMatches = matcher.findAddressReferences([vanillaRegion], vanillaAddress, 0x10)
      expect(vanillaMatches).toHaveLength(1)
      
      // Search for quetzal address in vanilla memory - should not find it
      const quetzalMatches = matcher.findAddressReferences([vanillaRegion], quetzalAddress, 0x10)
      expect(quetzalMatches).toHaveLength(0)
    })
  })

  describe('Pattern Generation', () => {
    it('should generate different patterns for different addresses', () => {
      const vanillaPatterns = BytePatternMatcher.createPartyDataPatterns(0x20244EC)
      const quetzalPatterns = BytePatternMatcher.createPartyDataPatterns(0x20235B8)
      
      expect(vanillaPatterns.length).toBeGreaterThan(0)
      expect(quetzalPatterns.length).toBeGreaterThan(0)
      
      // Direct address patterns should be different
      const vanillaDirect = vanillaPatterns.find(p => p.name === 'direct_address')!
      const quetzalDirect = quetzalPatterns.find(p => p.name === 'direct_address')!
      
      expect(vanillaDirect.pattern).not.toEqual(quetzalDirect.pattern)
    })

    it('should create patterns with correct byte values', () => {
      const vanillaAddress = 0x20244EC
      const patterns = BytePatternMatcher.createPartyDataPatterns(vanillaAddress)
      
      const directPattern = patterns.find(p => p.name === 'direct_address')!
      
      // Verify little-endian byte order
      expect(Array.from(directPattern.pattern)).toEqual([0xEC, 0x44, 0x02, 0x02])
      expect(directPattern.expectedAddress).toBe(vanillaAddress)
    })
  })

  describe('Real-world Use Cases', () => {
    it('should find patterns that could exist in actual ROM assembly', () => {
      const partyDataAddr = 0x20244EC
      
      // Create memory region with realistic assembly patterns
      const data = new Uint8Array(0x1000)
      
      // Pattern 1: Direct address in a jump table or function pointer
      data[0x200] = 0xEC
      data[0x201] = 0x44
      data[0x202] = 0x02
      data[0x203] = 0x02
      
      // Pattern 2: Thumb LDR instruction + address
      data[0x300] = 0x01  // LDR r0, [PC, #4]
      data[0x301] = 0x48
      data[0x302] = 0x00  // NOP padding
      data[0x303] = 0x00
      data[0x304] = 0xEC  // Address referenced by LDR
      data[0x305] = 0x44
      data[0x306] = 0x02
      data[0x307] = 0x02
      
      const region: MemoryRegion = {
        address: 0x8000000, // ROM space
        size: data.length,
        data
      }
      
      const matches = matcher.findAddressReferences([region], partyDataAddr, 0x10)
      
      // Should find both direct references
      expect(matches.length).toBeGreaterThanOrEqual(2)
      
      // Verify we found the references at the right locations
      const addresses = matches.map(m => m.address).sort((a, b) => a - b)
      expect(addresses).toContain(0x8000200) // First direct reference
      expect(addresses).toContain(0x8000304) // Second direct reference (from LDR)
    })

    it('should handle multiple references to the same address', () => {
      const partyDataAddr = 0x20235B8 // Quetzal address
      const data = new Uint8Array(0x800)
      
      // Add multiple references throughout the memory
      const offsets = [0x100, 0x200, 0x300, 0x400, 0x500]
      
      for (const offset of offsets) {
        data[offset] = 0xB8      // Low byte
        data[offset + 1] = 0x35  // Second byte  
        data[offset + 2] = 0x02  // Third byte
        data[offset + 3] = 0x02  // High byte
      }
      
      const region: MemoryRegion = {
        address: 0x8000000,
        size: data.length,
        data
      }
      
      const matches = matcher.findAddressReferences([region], partyDataAddr, 0x10)
      
      expect(matches).toHaveLength(offsets.length)
      
      // All matches should have perfect confidence
      for (const match of matches) {
        expect(match.confidence).toBe(1.0)
        expect(match.context?.referencedAddress).toBe(partyDataAddr)
      }
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty memory regions gracefully', () => {
      const emptyRegion: MemoryRegion = {
        address: 0x2000000,
        size: 0,
        data: new Uint8Array(0)
      }
      
      const matches = matcher.findAddressReferences([emptyRegion], 0x20244EC, 0x10)
      expect(matches).toHaveLength(0)
    })

    it('should handle regions too small for 32-bit addresses', () => {
      const smallRegion: MemoryRegion = {
        address: 0x2000000,
        size: 2,
        data: new Uint8Array([0xEC, 0x44]) // Only 2 bytes
      }
      
      const matches = matcher.findAddressReferences([smallRegion], 0x20244EC, 0x10)
      expect(matches).toHaveLength(0)
    })

    it('should correctly handle address boundaries', () => {
      const data = new Uint8Array(8)
      // Put address at the very end
      data[4] = 0xEC
      data[5] = 0x44
      data[6] = 0x02
      data[7] = 0x02
      
      const region: MemoryRegion = {
        address: 0x2000000,
        size: data.length,
        data
      }
      
      const matches = matcher.findAddressReferences([region], 0x20244EC, 0x10)
      expect(matches).toHaveLength(1)
      expect(matches[0].address).toBe(0x2000004)
    })
  })
})