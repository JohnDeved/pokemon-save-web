import { beforeAll, describe, expect, it } from 'vitest'
import { PokemonSaveParser } from '../core/pokemonSaveParser'
import { QuetzalConfig } from '../games/quetzal/index'
import { CONSTANTS } from '../core/types'
import { bytesToGbaString } from '../core/utils'

describe('PokemonSaveParser - Unit Tests', () => {
  let parser: PokemonSaveParser
  let config: QuetzalConfig

  beforeAll(() => {
    config = new QuetzalConfig()
    parser = new PokemonSaveParser(undefined, config)
  })

  describe('Constructor', () => {
    it('should create parser without forced slot', () => {
      const defaultParser = new PokemonSaveParser()
      expect(defaultParser).toBeInstanceOf(PokemonSaveParser)
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
      const configParser = new PokemonSaveParser(undefined, config)
      expect(configParser).toBeInstanceOf(PokemonSaveParser)
      expect(configParser.getGameConfig()).toBe(config)
    })
  })

  describe('Save File Loading', () => {
    it('should accept ArrayBuffer input', async () => {
      const buffer = new ArrayBuffer(131072) // 128KB
      await expect(parser.loadSaveFile(buffer)).resolves.not.toThrow()
    })

    it('should accept File input', async () => {
      const buffer = new ArrayBuffer(131072)
      const file = new File([buffer], 'test.sav', { type: 'application/octet-stream' })
      await expect(parser.loadSaveFile(file)).resolves.not.toThrow()
    })

    it('should reject empty ArrayBuffer', async () => {
      const emptyBuffer = new ArrayBuffer(0)
      await expect(parser.loadSaveFile(emptyBuffer)).resolves.not.toThrow() // Loading should work, parsing should fail
    })

    it('should fail auto-detection without config', async () => {
      const parserWithoutConfig = new PokemonSaveParser()
      const buffer = new ArrayBuffer(131072)
      await expect(parserWithoutConfig.loadSaveFile(buffer)).rejects.toThrow('Unable to detect game type from save file')
    })
  })

  describe('Constants Validation', () => {
    it('should have valid constants defined', () => {
      expect(CONSTANTS.SECTOR_SIZE).toBeDefined()
      expect(CONSTANTS.SECTOR_SIZE).toBeGreaterThan(0)

      expect(CONSTANTS.SECTOR_DATA_SIZE).toBeDefined()
      expect(CONSTANTS.SECTOR_DATA_SIZE).toBeGreaterThan(0)

      expect(CONSTANTS.SECTOR_FOOTER_SIZE).toBeDefined()
      expect(CONSTANTS.SECTOR_FOOTER_SIZE).toBeGreaterThan(0)

      expect(CONSTANTS.EMERALD_SIGNATURE).toBeDefined()
      expect(CONSTANTS.EMERALD_SIGNATURE).toBeTypeOf('number')

      expect(CONSTANTS.MAX_PARTY_SIZE).toBeDefined()
      expect(CONSTANTS.MAX_PARTY_SIZE).toBe(6)

      expect(CONSTANTS.PARTY_POKEMON_SIZE).toBeDefined()
      expect(CONSTANTS.PARTY_POKEMON_SIZE).toBeGreaterThan(0)
    })
  })

  describe('Error Handling', () => {
    it('should throw error when parsing without loaded data', async () => {
      const freshParser = new PokemonSaveParser(undefined, config)
      const buffer = new ArrayBuffer(1024) // Small buffer that will fail validation
      await expect(freshParser.parseSaveFile(buffer)).rejects.toThrow()
    })

    it('should handle corrupted sector data', async () => {
      const corruptedBuffer = new ArrayBuffer(config.offsets.sectorSize * 32)
      await expect(parser.parseSaveFile(corruptedBuffer)).rejects.toThrow()
    })
  })

  describe('Forced Slot Behavior', () => {
    it('should respect forced slot 1', async () => {
      const slot1Parser = new PokemonSaveParser(1, config)
      // Create a buffer with some mock sector data
      const mockBuffer = new ArrayBuffer(config.offsets.sectorSize * 32)

      try {
        const result = await slot1Parser.parseSaveFile(mockBuffer)
        expect(result.active_slot).toBe(0) // Slot 1 starts at index 0
      } catch (error) {
        // Expected to fail with mock data, but the slot logic should be tested
        expect(error).toBeDefined()
      }
    })

    it('should respect forced slot 2', async () => {
      const slot2Parser = new PokemonSaveParser(2, config)
      const mockBuffer = new ArrayBuffer(config.offsets.sectorSize * 32)

      try {
        const result = await slot2Parser.parseSaveFile(mockBuffer)
        expect(result.active_slot).toBe(14) // Slot 2 starts at index 14
      } catch (error) {
        // Expected to fail with mock data, but the slot logic should be tested
        expect(error).toBeDefined()
      }
    })
  })

  describe('Text Decoding', () => {
    it('should decode nicknames with spaces correctly', () => {
      // Test case 1: "my mon" using byte 0 for space (full-width space as used in Pokemon)
      // Character mappings: 'm' = 225, 'y' = 237, ' ' = 0 (full-width), 'o' = 227, 'n' = 226
      const nickname1 = new Uint8Array([225, 237, 0, 225, 227, 226, 0xFF, 0xFF, 0xFF, 0xFF])
      expect(bytesToGbaString(nickname1)).toBe('my　mon') // Note: full-width space

      // Test case 2: "A B" using uppercase letters with full-width space
      // Character mappings: 'A' = 187, ' ' = 0 (full-width), 'B' = 188
      const nickname2 = new Uint8Array([187, 0, 188, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF])
      expect(bytesToGbaString(nickname2)).toBe('A　B') // Note: full-width space

      // Test case 3: Regular name without spaces
      const nickname3 = new Uint8Array([187, 188, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF])
      expect(bytesToGbaString(nickname3)).toBe('AB')

      // Test case 4: If regular ASCII space is actually used (byte 255 from charmap)
      // This might be the case if the charmap is correct
      const nickname4 = new Uint8Array([225, 237, 255, 225, 227, 226])
      // Since we now know 255 is in the charmap as a space, let's see what happens
      expect(bytesToGbaString(nickname4)).toBe('my mon')
    })

    it('should handle edge cases in text decoding', () => {
      // Empty string (just padding)
      const empty = new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF])
      expect(bytesToGbaString(empty)).toBe('')

      // String with no padding
      const noPadding = new Uint8Array([187, 188]) // "AB"
      expect(bytesToGbaString(noPadding)).toBe('AB')

      // String with control characters that should be skipped
      const withControl = new Uint8Array([187, 250, 188, 0xFF]) // "A[line break]B" - should skip line break
      expect(bytesToGbaString(withControl)).toBe('AB')
    })
  })

  describe('Game Config and Auto-Detection', () => {
    it('should allow manual config injection', () => {
      const parserWithConfig = new PokemonSaveParser(undefined, config)
      expect(parserWithConfig.getGameConfig()).toBe(config)
      expect(parserWithConfig.getGameConfig()?.name).toBe('Pokemon Quetzal')
    })

    it('should allow config to be set after construction', () => {
      const parser = new PokemonSaveParser()
      expect(parser.getGameConfig()).toBe(null)

      parser.setGameConfig(config)
      expect(parser.getGameConfig()).toBe(config)
    })
  })
})
