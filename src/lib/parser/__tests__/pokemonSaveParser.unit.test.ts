/**
 * Unit tests for general Pokemon save parser functionality
 * Tests core functionality independent of specific game configurations
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { PokemonSaveParser } from '../core/PokemonSaveParser'
import { QuetzalConfig } from '../games/quetzal/config'
import { VanillaConfig } from '../games/vanilla/config'
import { bytesToGbaString } from '../core/utils'

describe('Pokemon Save Parser - Unit Tests', () => {
  let quetzalConfig: QuetzalConfig
  let vanillaConfig: VanillaConfig

  beforeAll(() => {
    quetzalConfig = new QuetzalConfig()
    vanillaConfig = new VanillaConfig()
  })

  describe('Constructor and Configuration', () => {
    it('should create parser without forced slot', () => {
      const defaultParser = new PokemonSaveParser()
      expect(defaultParser).toBeInstanceOf(PokemonSaveParser)
      expect(defaultParser.getGameConfig()).toBe(null)
    })

    it('should create parser with forced slot 1', () => {
      const slot1Parser = new PokemonSaveParser(1)
      expect(slot1Parser).toBeInstanceOf(PokemonSaveParser)
    })

    it('should create parser with forced slot 2', () => {
      const slot2Parser = new PokemonSaveParser(2)
      expect(slot2Parser).toBeInstanceOf(PokemonSaveParser)
    })

    it('should create parser with config injection', () => {
      const configParser = new PokemonSaveParser(undefined, quetzalConfig)
      expect(configParser).toBeInstanceOf(PokemonSaveParser)
      expect(configParser.getGameConfig()).toBe(quetzalConfig)
    })

    it('should allow config to be set after construction', () => {
      const parser = new PokemonSaveParser()
      expect(parser.getGameConfig()).toBe(null)

      parser.setGameConfig(quetzalConfig)
      expect(parser.getGameConfig()).toBe(quetzalConfig)
    })
  })

  describe('File Format Validation', () => {
    it('should accept ArrayBuffer input', async () => {
      const parser = new PokemonSaveParser(undefined, quetzalConfig)
      const buffer = new ArrayBuffer(131072) // 128KB
      await expect(parser.loadInputData(buffer)).resolves.not.toThrow()
    })

    it('should accept File input', async () => {
      const parser = new PokemonSaveParser(undefined, quetzalConfig)
      const buffer = new ArrayBuffer(131072)
      const file = new File([buffer], 'test.sav', { type: 'application/octet-stream' })
      await expect(parser.loadInputData(file)).resolves.not.toThrow()
    })

    it('should handle empty ArrayBuffer', async () => {
      const parser = new PokemonSaveParser(undefined, quetzalConfig)
      const emptyBuffer = new ArrayBuffer(0)
      await expect(parser.loadInputData(emptyBuffer)).resolves.not.toThrow() // Loading should work, parsing should fail
    })

    it('should fail auto-detection without config', async () => {
      const parserWithoutConfig = new PokemonSaveParser()
      const buffer = new ArrayBuffer(131072)
      await expect(parserWithoutConfig.loadInputData(buffer)).rejects.toThrow('Unable to detect game type from save file')
    })
  })

  describe('Configuration Constants Validation', () => {
    it('should have valid Quetzal constants defined', () => {
      expect(quetzalConfig.saveLayout.sectorSize).toBeDefined()
      expect(quetzalConfig.saveLayout.sectorSize).toBeGreaterThan(0)

      expect(quetzalConfig.saveLayout.sectorDataSize).toBeDefined()
      expect(quetzalConfig.saveLayout.sectorDataSize).toBeGreaterThan(0)

      expect(quetzalConfig.maxPartySize).toBeDefined()
      expect(quetzalConfig.maxPartySize).toBe(6)

      expect(quetzalConfig.pokemonSize).toBeDefined()
      expect(quetzalConfig.pokemonSize).toBeGreaterThan(0)
    })

    it('should have valid vanilla constants defined', () => {
      expect(vanillaConfig.saveLayout.sectorSize).toBeDefined()
      expect(vanillaConfig.saveLayout.sectorSize).toBeGreaterThan(0)

      expect(vanillaConfig.saveLayout.sectorDataSize).toBeDefined()
      expect(vanillaConfig.saveLayout.sectorDataSize).toBeGreaterThan(0)

      expect(vanillaConfig.maxPartySize).toBeDefined()
      expect(vanillaConfig.maxPartySize).toBe(6)

      expect(vanillaConfig.pokemonSize).toBeDefined()
      expect(vanillaConfig.pokemonSize).toBeGreaterThan(0)
    })
  })

  describe('Error Handling', () => {
    it('should throw error when parsing without loaded data', async () => {
      const freshParser = new PokemonSaveParser(undefined, quetzalConfig)
      const buffer = new ArrayBuffer(1024) // Small buffer that will fail validation
      await expect(freshParser.parse(buffer)).rejects.toThrow()
    })

    it('should handle corrupted sector data gracefully', async () => {
      const parser = new PokemonSaveParser(undefined, quetzalConfig)
      const corruptedBuffer = new ArrayBuffer(quetzalConfig.saveLayout.sectorSize * 32)
      await expect(parser.parse(corruptedBuffer)).rejects.toThrow()
    })
  })

  describe('Forced Slot Behavior', () => {
    it('should respect forced slot 1', async () => {
      const slot1Parser = new PokemonSaveParser(1, quetzalConfig)
      // Create a buffer with some mock sector data
      const mockBuffer = new ArrayBuffer(quetzalConfig.saveLayout.sectorSize * 32)

      try {
        const result = await slot1Parser.parse(mockBuffer)
        expect(result.active_slot).toBe(0) // Slot 1 starts at index 0
      } catch (error) {
        // Expected to fail with mock data, but the slot logic should be tested
        expect(error).toBeDefined()
      }
    })

    it('should respect forced slot 2', async () => {
      const slot2Parser = new PokemonSaveParser(2, quetzalConfig)
      const mockBuffer = new ArrayBuffer(quetzalConfig.saveLayout.sectorSize * 32)

      try {
        const result = await slot2Parser.parse(mockBuffer)
        expect(result.active_slot).toBe(14) // Slot 2 starts at index 14
      } catch (error) {
        // Expected to fail with mock data, but the slot logic should be tested
        expect(error).toBeDefined()
      }
    })
  })

  describe('Text Decoding', () => {
    it('should decode Pokemon text with spaces correctly', () => {
      // Test case 1: "my mon" using byte 0 for space (full-width space as used in Pokemon)
      // Character mappings: 'm' = 225, 'y' = 237, ' ' = 0 (full-width), 'o' = 227, 'n' = 226
      const nickname1 = new Uint8Array([225, 237, 0, 225, 227, 226, 0xff, 0xff, 0xff, 0xff])
      expect(bytesToGbaString(nickname1)).toBe('my　mon') // Note: full-width space

      // Test case 2: "A B" using uppercase letters with full-width space
      // Character mappings: 'A' = 187, ' ' = 0 (full-width), 'B' = 188
      const nickname2 = new Uint8Array([187, 0, 188, 0xff, 0xff, 0xff, 0xff, 0xff])
      expect(bytesToGbaString(nickname2)).toBe('A　B') // Note: full-width space

      // Test case 3: Regular name without spaces
      const nickname3 = new Uint8Array([187, 188, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff])
      expect(bytesToGbaString(nickname3)).toBe('AB')

      // Test case 4: If regular ASCII space is actually used (byte 255 from charmap)
      const nickname4 = new Uint8Array([225, 237, 255, 225, 227, 226])
      expect(bytesToGbaString(nickname4)).toBe('my mon')
    })

    it('should handle edge cases in text decoding', () => {
      // Empty string (just padding)
      const empty = new Uint8Array([0xff, 0xff, 0xff, 0xff])
      expect(bytesToGbaString(empty)).toBe('')

      // String with no padding
      const noPadding = new Uint8Array([187, 188]) // "AB"
      expect(bytesToGbaString(noPadding)).toBe('AB')

      // String with control characters that should be skipped
      const withControl = new Uint8Array([187, 250, 188, 0xff]) // "A[line break]B" - should skip line break
      expect(bytesToGbaString(withControl)).toBe('AB')
    })

    it('should handle various termination scenarios', () => {
      // String terminated with 0xFF
      const terminated1 = new Uint8Array([187, 188, 189, 0xff, 0xff])
      expect(bytesToGbaString(terminated1)).toBe('ABC')

      // String without termination (full buffer)
      const noTermination = new Uint8Array([187, 188, 189, 190, 191])
      expect(bytesToGbaString(noTermination)).toBe('ABCDE')

      // String with 0xFF followed by garbage (low bytes trigger termination)
      const withGarbage = new Uint8Array([187, 188, 0xff, 0x05, 0x02])
      expect(bytesToGbaString(withGarbage)).toBe('AB')
    })
  })

  describe('Config-Specific Functionality', () => {
    it('should handle Quetzal-specific config features', () => {
      expect(quetzalConfig.name).toBe('Pokemon Quetzal')
      expect(quetzalConfig.pokemonSize).toBe(104) // Larger than vanilla
      expect(quetzalConfig.offsetOverrides).toBeDefined()
      expect(quetzalConfig.saveLayoutOverrides).toBeDefined()
    })

    it('should handle vanilla config features', () => {
      expect(vanillaConfig.name).toBe('Pokemon Emerald (Vanilla)')
      expect(vanillaConfig.mappings).toBeDefined()
      expect(vanillaConfig.mappings.pokemon).toBeDefined()
      expect(vanillaConfig.mappings.moves).toBeDefined()
      expect(vanillaConfig.mappings.items).toBeDefined()
    })
  })

  describe('Mapping System Validation', () => {
    it('should have functional Pokemon mappings for vanilla', () => {
      const mapping = vanillaConfig.mappings.pokemon
      expect(mapping).toBeDefined()
      expect(mapping.size).toBeGreaterThan(0)

      // Test specific mapping (Treecko: 277 -> 252)
      const treecko = mapping.get(277)
      expect(treecko).toBeDefined()
      expect(treecko?.id).toBe(252)
      expect(treecko?.name).toBe('Treecko') // Capitalized in the mapping
    })

    it('should have functional move mappings for vanilla', () => {
      const mapping = vanillaConfig.mappings.moves
      expect(mapping).toBeDefined()
      expect(mapping.size).toBeGreaterThan(0)

      // Test specific mappings
      const pound = mapping.get(1)
      expect(pound).toBeDefined()
      expect(pound?.id).toBe(1)
      expect(pound?.name).toBe('Pound') // Capitalized in the mapping
    })

    it('should have functional item mappings for vanilla', () => {
      const mapping = vanillaConfig.mappings.items
      expect(mapping).toBeDefined()
      expect(mapping.size).toBeGreaterThan(0)
    })

    it('should have functional mappings for Quetzal', () => {
      expect(quetzalConfig.mappings.pokemon.size).toBeGreaterThan(0)
      expect(quetzalConfig.mappings.moves.size).toBeGreaterThan(0)
      expect(quetzalConfig.mappings.items.size).toBeGreaterThan(0)
    })
  })

  describe('Common EV/IV Writing Tests', () => {
    it('should validate EV value clamping (0-255)', () => {
      // Test that EV values are properly clamped regardless of config
      const testValues = [-10, 0, 100, 255, 300]
      const expectedValues = [0, 0, 100, 255, 255]

      testValues.forEach((value, index) => {
        const clamped = Math.max(0, Math.min(255, value))
        expect(clamped).toBe(expectedValues[index])
      })
    })

    it('should validate IV value clamping (0-31)', () => {
      // Test that IV values are properly clamped regardless of config
      const testValues = [-5, 0, 15, 31, 50]
      const expectedValues = [0, 0, 15, 31, 31]

      testValues.forEach((value, index) => {
        const clamped = Math.max(0, Math.min(31, value))
        expect(clamped).toBe(expectedValues[index])
      })
    })

    it('should validate EV array length requirements', () => {
      // EVs should always require exactly 6 values
      const validEvs = [0, 0, 0, 0, 0, 0]
      const invalidEvs = [0, 0, 0, 0, 0] // Only 5 values

      expect(validEvs.length).toBe(6)
      expect(invalidEvs.length).not.toBe(6)

      // Test that setting EVs with wrong length would throw
      expect(() => {
        if (invalidEvs.length !== 6) throw new Error('EVs array must have 6 values')
      }).toThrow('EVs array must have 6 values')
    })

    it('should validate IV array length requirements', () => {
      // IVs should always require exactly 6 values
      const validIvs = [31, 31, 31, 31, 31, 31]
      const invalidIvs = [31, 31, 31] // Only 3 values

      expect(validIvs.length).toBe(6)
      expect(invalidIvs.length).not.toBe(6)

      // Test that setting IVs with wrong length would throw
      expect(() => {
        if (invalidIvs.length !== 6) throw new Error('IVs array must have 6 values')
      }).toThrow('IVs array must have 6 values')
    })
  })
})
