/**
 * Integration tests for signature-based address resolution
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { VanillaConfigWithSignatures } from '../games/vanilla/config-with-signatures'
import { QuetzalConfigWithSignatures } from '../games/quetzal/config-with-signatures'
import { testSignatureResolution, SignatureAddressResolver } from '../../signature/address-resolver'
import { createPartyDataScanner } from '../../signature/patterns'

describe('Signature Integration Tests', () => {
  beforeEach(() => {
    // Clear cache before each test
    SignatureAddressResolver.clearCache()
  })

  describe('VanillaConfigWithSignatures', () => {
    it('should use fallback addresses when no memory buffer is provided', () => {
      const config = new VanillaConfigWithSignatures()
      
      expect(config.memoryAddresses.partyData).toBe(0x020244ec)
      expect(config.memoryAddresses.partyCount).toBe(0x020244e9)
      expect(config.memoryAddresses.enemyParty).toBe(0x02024744) // partyData + 0x258
    })

    it('should track address resolution status', () => {
      const config = new VanillaConfigWithSignatures()
      const addresses = config.getResolvedAddresses()
      
      expect(addresses.usingSignatures).toBe(false)
      expect(addresses.partyData).toBe(addresses.fallbackPartyData)
      expect(addresses.partyCount).toBe(addresses.fallbackPartyCount)
    })

    it('should enable signature resolution with memory buffer', () => {
      const config = new VanillaConfigWithSignatures()
      
      // Create a mock memory buffer that won't match any signatures
      const mockMemory = new Uint8Array(0x10000)
      
      config.enableSignatureResolution(mockMemory)
      
      // Should still use fallback since no signatures match
      expect(config.memoryAddresses.partyData).toBe(0x020244ec)
      expect(config.memoryAddresses.partyCount).toBe(0x020244e9)
    })

    it('should maintain backward compatibility with original config interface', () => {
      const config = new VanillaConfigWithSignatures()
      
      // Should have all the same properties as the original config
      expect(config.name).toContain('Pokemon Emerald')
      expect(config.pokemonSize).toBe(100)
      expect(config.maxPartySize).toBe(6)
      expect(config.mappings).toBeDefined()
      expect(config.canHandle).toBeDefined()
      expect(config.canHandleMemory).toBeDefined()
    })
  })

  describe('QuetzalConfigWithSignatures', () => {
    it('should use fallback addresses when no memory buffer is provided', () => {
      const config = new QuetzalConfigWithSignatures()
      
      expect(config.memoryAddresses.partyData).toBe(0x020235b8)
      expect(config.memoryAddresses.partyCount).toBe(0x020235b5)
      expect(config.memoryAddresses.enemyParty).toBe(0x02023a98) // partyData + 0x4E0
    })

    it('should maintain all Quetzal-specific functionality', () => {
      const config = new QuetzalConfigWithSignatures()
      
      expect(config.name).toContain('Quetzal')
      expect(config.pokemonSize).toBe(104) // Quetzal uses 104-byte structures
      expect(config.offsetOverrides).toBeDefined()
      expect(config.saveLayoutOverrides).toBeDefined()
      
      // Should have Quetzal-specific methods
      expect(config.getSpeciesId).toBeDefined()
      expect(config.calculateNature).toBeDefined()
      expect(config.isRadiant).toBeDefined()
    })
  })

  describe('Signature Resolution Integration', () => {
    it('should handle signature resolution testing', async () => {
      // Create a mock memory buffer with a simple pattern
      const mockMemory = new Uint8Array(0x1000)
      
      // Test signature resolution without expecting real patterns to match
      const result = await testSignatureResolution(
        mockMemory,
        'emerald',
        { partyData: 0x020244ec }
      )
      
      // Since mockMemory has no real patterns, should use fallback address
      // which equals expected address, so success=true
      expect(result.success).toBe(true) // Falls back to correct address  
      expect(result.resolvedPartyData).toBe(0x020244ec) // Should fall back
      expect(result.matches).toBe(0) // No signature matches
      expect(result.errors).toBeInstanceOf(Array)
    })

    it('should create scanner with all required signatures', () => {
      const scanner = createPartyDataScanner()
      
      // Verify scanner is properly configured
      const mockBuffer = new Uint8Array(100)
      const results = scanner.scan(mockBuffer, 'emerald')
      
      expect(results.matches).toBeInstanceOf(Array)
      expect(results.resolvedAddresses).toBeInstanceOf(Map)
      expect(results.errors).toBeInstanceOf(Array)
    })

    it('should handle variant-specific signature filtering', () => {
      const scanner = createPartyDataScanner()
      
      const mockBuffer = new Uint8Array(100)
      
      // Test emerald variant
      const emeraldResults = scanner.scan(mockBuffer, 'emerald')
      expect(emeraldResults).toBeDefined()
      
      // Test quetzal variant
      const quetzalResults = scanner.scan(mockBuffer, 'quetzal')
      expect(quetzalResults).toBeDefined()
      
      // Test no variant (should include all signatures)
      const allResults = scanner.scan(mockBuffer)
      expect(allResults).toBeDefined()
    })
  })

  describe('Preload Regions', () => {
    it('should generate correct preload regions for Vanilla with signatures', () => {
      const config = new VanillaConfigWithSignatures()
      const regions = config.preloadRegions
      
      expect(regions).toHaveLength(2)
      
      const partyDataRegion = regions[0]!
      expect(partyDataRegion.address).toBe(config.memoryAddresses.partyData)
      expect(partyDataRegion.size).toBe(600) // 6 * 100 bytes
      
      const partyCountRegion = regions[1]!
      expect(partyCountRegion.address).toBe(config.memoryAddresses.partyCount)
      expect(partyCountRegion.size).toBe(7)
    })

    it('should generate correct preload regions for Quetzal with signatures', () => {
      const config = new QuetzalConfigWithSignatures()
      const regions = config.preloadRegions
      
      expect(regions).toHaveLength(2)
      
      const partyDataRegion = regions[0]!
      expect(partyDataRegion.address).toBe(config.memoryAddresses.partyData)
      expect(partyDataRegion.size).toBe(624) // 6 * 104 bytes
      
      const partyCountRegion = regions[1]!
      expect(partyCountRegion.address).toBe(config.memoryAddresses.partyCount)
      expect(partyCountRegion.size).toBe(7)
    })
  })

  describe('Configuration Detection', () => {
    it('should detect Vanilla Emerald games', () => {
      const config = new VanillaConfigWithSignatures()
      
      expect(config.canHandleMemory('POKEMON EMERALD')).toBe(true)
      expect(config.canHandleMemory('Pokemon Emerald (USA)')).toBe(true)
      expect(config.canHandleMemory('POKEMON RUBY')).toBe(false)
      expect(config.canHandleMemory('Pokemon Quetzal')).toBe(false)
    })

    it('should detect Quetzal games', () => {
      const config = new QuetzalConfigWithSignatures()
      
      expect(config.canHandleMemory('Pokemon Quetzal')).toBe(true)
      expect(config.canHandleMemory('QUETZAL')).toBe(true)
      expect(config.canHandleMemory('POKEMON EMERALD')).toBe(false)
      expect(config.canHandleMemory('Pokemon Ruby')).toBe(false)
    })
  })
})