/**
 * Integration tests for PokemonSaveParser using real test data
 * These tests require Node.js environment to read files
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PokemonSaveParser } from '../pokemonSaveParser';
import type { SaveData } from '../types';

// Handle ES modules in Node.js
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('PokemonSaveParser - Integration Tests', () => {
  let parser: PokemonSaveParser;
  let testSaveData: ArrayBuffer;
  let groundTruth: {
    player_name: string;
    play_time: { hours: number; minutes: number; seconds: number };
    active_slot: number;
    sector_map: Record<string, number>;
    party_pokemon: Array<Record<string, unknown>>;
  };

  beforeAll(async () => {
    parser = new PokemonSaveParser();
    
    try {
      // Load test save file
      const savePath = resolve(__dirname, 'test_data', 'player1.sav');
      const saveBuffer = readFileSync(savePath);
      testSaveData = saveBuffer.buffer.slice(saveBuffer.byteOffset, saveBuffer.byteOffset + saveBuffer.byteLength);
      
      // Load ground truth data
      const groundTruthPath = resolve(__dirname, 'test_data', 'ground_truth.json');
      const groundTruthContent = readFileSync(groundTruthPath, 'utf-8');
      groundTruth = JSON.parse(groundTruthContent);
      
      console.log('Test data loaded successfully');
      console.log(`Save file size: ${testSaveData.byteLength} bytes`);
      console.log(`Ground truth contains ${groundTruth.party_pokemon.length} Pokemon`);
    } catch (error) {
      console.warn('Could not load test data files:', error);
      // Skip these tests if files are not available
      return;
    }
  });

  describe('Real Save File Parsing', () => {
    let parsedData: SaveData;

    beforeAll(async () => {
      if (!testSaveData) {
        console.warn('Skipping integration tests - test data not available');
        return;
      }
      
      try {
        parsedData = await parser.parseSaveFile(testSaveData);
        console.log('Save file parsed successfully');
      } catch (error) {
        console.error('Failed to parse save file:', error);
        throw error;
      }
    });

    it('should parse player information correctly', () => {
      if (!parsedData || !groundTruth) {
        console.warn('Skipping test - no data available');
        return;
      }
      
      expect(parsedData.player_name).toBe(groundTruth.player_name);
      expect(parsedData.play_time.hours).toBe(groundTruth.play_time.hours);
      expect(parsedData.play_time.minutes).toBe(groundTruth.play_time.minutes);
      expect(parsedData.play_time.seconds).toBe(groundTruth.play_time.seconds);
      expect(parsedData.active_slot).toBe(groundTruth.active_slot);
    });

    it('should parse Pokemon party correctly', () => {
      if (!parsedData || !groundTruth) {
        console.warn('Skipping test - no data available');
        return;
      }
      
      expect(parsedData.party_pokemon).toHaveLength(groundTruth.party_pokemon.length);
      
      // Test first Pokemon in detail
      if (parsedData.party_pokemon.length > 0) {
        const firstPokemon = parsedData.party_pokemon[0];
        const expectedPokemon = groundTruth.party_pokemon[0];
        
        expect(firstPokemon.speciesId).toBe(expectedPokemon.speciesId);
        expect(firstPokemon.level).toBe(expectedPokemon.level);
        expect(firstPokemon.personality).toBe(expectedPokemon.personality);
        expect(firstPokemon.currentHp).toBe(expectedPokemon.currentHp);
        expect(firstPokemon.maxHp).toBe(expectedPokemon.maxHp);
        
        // Test moves
        expect(firstPokemon.move1).toBe(expectedPokemon.move1);
        expect(firstPokemon.move2).toBe(expectedPokemon.move2);
        expect(firstPokemon.move3).toBe(expectedPokemon.move3);
        expect(firstPokemon.move4).toBe(expectedPokemon.move4);
        
        // Test EVs
        expect(firstPokemon.hpEV).toBe(expectedPokemon.hpEV);
        expect(firstPokemon.atkEV).toBe(expectedPokemon.atkEV);
        expect(firstPokemon.defEV).toBe(expectedPokemon.defEV);
        expect(firstPokemon.speEV).toBe(expectedPokemon.speEV);
        expect(firstPokemon.spaEV).toBe(expectedPokemon.spaEV);
        expect(firstPokemon.spdEV).toBe(expectedPokemon.spdEV);
        
        // Test IVs
        expect([...firstPokemon.ivs]).toEqual(expectedPokemon.ivs);
        
        console.log('First Pokemon validation passed:', {
          species: firstPokemon.speciesId,
          level: firstPokemon.level,
          hp: `${firstPokemon.currentHp}/${firstPokemon.maxHp}`
        });
      }
    });

    it('should parse all Pokemon consistently', () => {
      if (!parsedData || !groundTruth) {
        console.warn('Skipping test - no data available');
        return;
      }
      
      parsedData.party_pokemon.forEach((pokemon, index) => {
        const expected = groundTruth.party_pokemon[index];
        
        // Core data should match exactly
        expect(pokemon.speciesId).toBe(expected.speciesId);
        expect(pokemon.level).toBe(expected.level);
        expect(pokemon.personality).toBe(expected.personality);
        expect(pokemon.otId).toBe(expected.otId);
        
        // Stats should match
        expect(pokemon.maxHp).toBe(expected.maxHp);
        expect(pokemon.attack).toBe(expected.attack);
        expect(pokemon.defense).toBe(expected.defense);
        expect(pokemon.speed).toBe(expected.speed);
        expect(pokemon.spAttack).toBe(expected.spAttack);
        expect(pokemon.spDefense).toBe(expected.spDefense);
        
        console.log(`Pokemon ${index + 1} validation passed`);
      });
    });

    it('should have valid sector mapping', () => {
      if (!parsedData || !groundTruth) {
        console.warn('Skipping test - no data available');
        return;
      }
      
      // Check that we have the expected sectors
      expect(parsedData.sector_map.size).toBeGreaterThan(0);
      
      // Convert ground truth sector map (string keys) to number keys for comparison
      const expectedSectorMap = new Map();
      Object.entries(groundTruth.sector_map).forEach(([key, value]) => {
        expectedSectorMap.set(parseInt(key), value);
      });
      
      expect(parsedData.sector_map).toEqual(expectedSectorMap);
      
      console.log('Sector map validation passed:', {
        sectors: parsedData.sector_map.size,
        activeSlot: parsedData.active_slot
      });
    });
  });

  describe('Data Structure Validation', () => {
    it('should create properly structured Pokemon data', async () => {
      if (!testSaveData) {
        console.warn('Skipping test - no test data available');
        return;
      }
      
      const result = await parser.parseSaveFile(testSaveData);
      
      result.party_pokemon.forEach((pokemon, index) => {
        // Check that structured data is present
        expect(pokemon.moves_data).toBeDefined();
        expect(pokemon.evs_structured).toBeDefined();
        expect(pokemon.ivs_structured).toBeDefined();
        expect(pokemon.stats_structured).toBeDefined();
        
        // Check that arrays have correct length
        expect(pokemon.evs).toHaveLength(6);
        expect(pokemon.ivs).toHaveLength(6);
        
        // Check that OT ID is formatted correctly
        expect(pokemon.otId_str).toMatch(/^\d{5}$/);
        
        console.log(`Pokemon ${index + 1} structure validation passed`);
      });
    });
  });
});
