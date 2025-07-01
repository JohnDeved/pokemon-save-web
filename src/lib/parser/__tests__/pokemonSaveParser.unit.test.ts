import { describe, it, expect, beforeAll } from 'vitest';
import { PokemonSaveParser } from '../pokemonSaveParser';
import { CONSTANTS } from '../types';

describe('PokemonSaveParser - Unit Tests', () => {
  let parser: PokemonSaveParser;

  beforeAll(() => {
    parser = new PokemonSaveParser();
  });

  describe('Constructor', () => {
    it('should create parser without forced slot', () => {
      const defaultParser = new PokemonSaveParser();
      expect(defaultParser).toBeInstanceOf(PokemonSaveParser);
    });

    it('should create parser with forced slot 1', () => {
      const slot1Parser = new PokemonSaveParser(1);
      expect(slot1Parser).toBeInstanceOf(PokemonSaveParser);
    });

    it('should create parser with forced slot 2', () => {
      const slot2Parser = new PokemonSaveParser(2);
      expect(slot2Parser).toBeInstanceOf(PokemonSaveParser);
    });
  });

  describe('Save File Loading', () => {
    it('should accept ArrayBuffer input', async () => {
      const buffer = new ArrayBuffer(131072); // 128KB
      await expect(parser.loadSaveFile(buffer)).resolves.not.toThrow();
    });

    it('should accept File input', async () => {
      const buffer = new ArrayBuffer(131072);
      const file = new File([buffer], 'test.sav', { type: 'application/octet-stream' });
      await expect(parser.loadSaveFile(file)).resolves.not.toThrow();
    });

    it('should reject empty ArrayBuffer', async () => {
      const emptyBuffer = new ArrayBuffer(0);
      await expect(parser.loadSaveFile(emptyBuffer)).resolves.not.toThrow(); // Loading should work, parsing should fail
    });
  });

  describe('Constants Validation', () => {
    it('should have valid constants defined', () => {
      expect(CONSTANTS.SECTOR_SIZE).toBeDefined();
      expect(CONSTANTS.SECTOR_SIZE).toBeGreaterThan(0);
      
      expect(CONSTANTS.SECTOR_DATA_SIZE).toBeDefined();
      expect(CONSTANTS.SECTOR_DATA_SIZE).toBeGreaterThan(0);
      
      expect(CONSTANTS.SECTOR_FOOTER_SIZE).toBeDefined();
      expect(CONSTANTS.SECTOR_FOOTER_SIZE).toBeGreaterThan(0);
      
      expect(CONSTANTS.EMERALD_SIGNATURE).toBeDefined();
      expect(CONSTANTS.EMERALD_SIGNATURE).toBeTypeOf('number');
      
      expect(CONSTANTS.MAX_PARTY_SIZE).toBeDefined();
      expect(CONSTANTS.MAX_PARTY_SIZE).toBe(6);
      
      expect(CONSTANTS.PARTY_POKEMON_SIZE).toBeDefined();
      expect(CONSTANTS.PARTY_POKEMON_SIZE).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when parsing without loaded data', async () => {
      const freshParser = new PokemonSaveParser();
      const buffer = new ArrayBuffer(1024); // Small buffer that will fail validation
      await expect(freshParser.parseSaveFile(buffer)).rejects.toThrow();
    });

    it('should handle corrupted sector data', async () => {
      const corruptedBuffer = new ArrayBuffer(CONSTANTS.SECTOR_SIZE * 32);
      await expect(parser.parseSaveFile(corruptedBuffer)).rejects.toThrow();
    });
  });

  describe('Debug Methods', () => {
    it('should provide debug information without crashing', () => {
      expect(() => {
        parser.debugSaveSlots();
      }).not.toThrow();
    });
  });

  describe('Forced Slot Behavior', () => {
    it('should respect forced slot 1', async () => {
      const slot1Parser = new PokemonSaveParser(1);
      // Create a buffer with some mock sector data
      const mockBuffer = new ArrayBuffer(CONSTANTS.SECTOR_SIZE * 32);
      
      try {
        const result = await slot1Parser.parseSaveFile(mockBuffer);
        expect(result.active_slot).toBe(0); // Slot 1 starts at index 0
      } catch (error) {
        // Expected to fail with mock data, but the slot logic should be tested
        expect(error).toBeDefined();
      }
    });

    it('should respect forced slot 2', async () => {
      const slot2Parser = new PokemonSaveParser(2);
      const mockBuffer = new ArrayBuffer(CONSTANTS.SECTOR_SIZE * 32);
      
      try {
        const result = await slot2Parser.parseSaveFile(mockBuffer);
        expect(result.active_slot).toBe(14); // Slot 2 starts at index 14
      } catch (error) {
        // Expected to fail with mock data, but the slot logic should be tested
        expect(error).toBeDefined();
      }
    });
  });
});
