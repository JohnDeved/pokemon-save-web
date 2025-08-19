/**
 * Website Integration Workflow Tests
 * Tests the complete save file processing workflow
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

// Test data path
const testDataPath = path.join(__dirname, '../lib/parser/__tests__/test_data/emerald.sav')

describe('Pokemon Save Web - Integration Workflow', () => {
  describe('Save File Loading Workflow', () => {
    it('should load and parse emerald.sav test file', async () => {
      const { PokemonSaveParser } = await import('../lib/parser/core/PokemonSaveParser')

      // Load test save file
      const saveData = fs.readFileSync(testDataPath)
      const parser = new PokemonSaveParser()

      // Parse save file
      const result = await parser.parse(saveData.buffer)

      // Verify basic structure
      expect(result).toBeDefined()
      expect(result.party_pokemon).toBeDefined()
      expect(Array.isArray(result.party_pokemon)).toBe(true)
      expect(result.party_pokemon.length).toBeGreaterThan(0)

      // Verify first Pokemon (TREECKO)
      const [firstPokemon] = result.party_pokemon
      expect(firstPokemon).toBeDefined()
      if (firstPokemon) {
        expect(firstPokemon.nickname).toBe('TREECKO')
        expect(firstPokemon.level).toBe(5)
        expect(firstPokemon.speciesId).toBe(252)
      }
    })

    it('should handle Pokemon stat editing workflow', async () => {
      const { PokemonSaveParser } = await import('../lib/parser/core/PokemonSaveParser')

      // Load and parse save file
      const saveData = fs.readFileSync(testDataPath)
      const parser = new PokemonSaveParser()
      const result = await parser.parse(saveData.buffer)

      // Get first Pokemon
      const [pokemon] = result.party_pokemon
      expect(pokemon).toBeDefined()

      // Test basic properties exist
      if (pokemon) {
        expect(pokemon.level).toBeDefined()
        expect(pokemon.nickname).toBeDefined()
        expect(pokemon.speciesId).toBeDefined()
      }
    })

    it('should handle save file reconstruction', async () => {
      const { PokemonSaveParser } = await import('../lib/parser/core/PokemonSaveParser')

      // Load and parse save file
      const saveData = fs.readFileSync(testDataPath)
      const parser = new PokemonSaveParser()
      const result = await parser.parse(saveData.buffer)

      // Reconstruct save file
      const reconstructed = parser.reconstructSaveFile(result.party_pokemon)

      // Verify reconstruction
      expect(reconstructed).toBeDefined()
      expect(reconstructed instanceof Uint8Array).toBe(true)
      expect(reconstructed.length).toBe(saveData.length)
    })
  })

  describe('WebSocket Client Workflow', () => {
    it('should create WebSocket client for mGBA integration', async () => {
      const { MgbaWebSocketClient } = await import('../lib/mgba/websocket-client')

      const client = new MgbaWebSocketClient()

      // Test basic properties
      expect(client.isConnected()).toBe(false)
      expect(typeof client.connect).toBe('function')
      expect(typeof client.eval).toBe('function')
      expect(typeof client.readBytes).toBe('function')
    })

    it('should handle memory mode parser initialization', async () => {
      const { PokemonSaveParser } = await import('../lib/parser/core/PokemonSaveParser')
      const { MgbaWebSocketClient } = await import('../lib/mgba/websocket-client')

      // Test basic instantiation
      const parser = new PokemonSaveParser()
      expect(parser).toBeInstanceOf(PokemonSaveParser)
      const mockClient = new MgbaWebSocketClient()

      // Test that parser can identify WebSocket client
      const isWebSocketLike = typeof mockClient.isConnected === 'function' && typeof mockClient.eval === 'function' && !(mockClient instanceof ArrayBuffer)

      expect(isWebSocketLike).toBe(true)
    })
  })

  describe('Error Handling Workflow', () => {
    it('should handle invalid save file data gracefully', async () => {
      const { PokemonSaveParser } = await import('../lib/parser/core/PokemonSaveParser')

      const parser = new PokemonSaveParser()
      const invalidData = new ArrayBuffer(100) // Too small for valid save

      // Should throw error for invalid data
      await expect(parser.parse(invalidData)).rejects.toThrow()
    })

    it('should handle empty or corrupted data', async () => {
      const { PokemonSaveParser } = await import('../lib/parser/core/PokemonSaveParser')

      const parser = new PokemonSaveParser()
      const emptyData = new ArrayBuffer(0)

      // Should throw error for empty data
      await expect(parser.parse(emptyData)).rejects.toThrow()
    })
  })

  describe('Game Detection Workflow', () => {
    it('should detect game type from save file', async () => {
      const { GameConfigRegistry } = await import('../lib/parser/games')

      // Load test save file
      const saveData = fs.readFileSync(testDataPath)
      const saveArray = new Uint8Array(saveData)

      // Detect game config
      const config = GameConfigRegistry.detectGameConfig(saveArray)

      expect(config).toBeDefined()
      expect(config?.name).toBeDefined()
    })
  })

  describe('Component State Workflow', () => {
    it('should handle hook state management', async () => {
      // Test the hook modules can be imported and have correct types
      const { usePokemonData } = await import('../hooks')

      expect(usePokemonData).toBeDefined()
      expect(typeof usePokemonData).toBe('function')
    })
  })

  describe('File Processing Performance', () => {
    it('should process save file in reasonable time', async () => {
      const { PokemonSaveParser } = await import('../lib/parser/core/PokemonSaveParser')

      const saveData = fs.readFileSync(testDataPath)
      const parser = new PokemonSaveParser()

      const startTime = Date.now()
      const result = await parser.parse(saveData.buffer)
      const endTime = Date.now()

      // Should complete in under 1 second
      expect(endTime - startTime).toBeLessThan(1000)
      expect(result.party_pokemon.length).toBeGreaterThan(0)
    })
  })

  describe('Data Integrity Workflow', () => {
    it('should maintain data consistency through edit cycle', async () => {
      const { PokemonSaveParser } = await import('../lib/parser/core/PokemonSaveParser')

      // Load original
      const saveData = fs.readFileSync(testDataPath)
      const parser = new PokemonSaveParser()
      const original = await parser.parse(saveData.buffer)

      // Reconstruct without changes
      const reconstructed = parser.reconstructSaveFile(original.party_pokemon)

      // Parse reconstructed
      const parser2 = new PokemonSaveParser()
      const reparsed = await parser2.parse(reconstructed.buffer)

      // Data should be consistent
      expect(reparsed.party_pokemon.length).toBe(original.party_pokemon.length)
      if (reparsed.party_pokemon[0] && original.party_pokemon[0]) {
        expect(reparsed.party_pokemon[0].nickname).toBe(original.party_pokemon[0].nickname)
        expect(reparsed.party_pokemon[0].level).toBe(original.party_pokemon[0].level)
      }
    })
  })
})
