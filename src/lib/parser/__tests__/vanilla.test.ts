/**
 * Comprehensive tests for vanilla Pokemon Emerald save parsing
 * Tests parsing, writing, and reconstruction functionality
 */

import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { beforeAll, describe, expect, it } from 'vitest'
import { PokemonSaveParser } from '../core/PokemonSaveParser'
import { VanillaConfig } from '../games/vanilla/config'
import { QuetzalConfig } from '../games/quetzal/config'
import { PokemonBase } from '../core/PokemonBase'
import type { SaveData } from '../core/types'

// Hash function for comparing buffers
const hashBuffer = async (buf: ArrayBuffer | Uint8Array) => {
  const ab = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  const { createHash } = await import('crypto')
  return createHash('sha256').update(ab).digest('hex')
}

// Handle ES modules in Node.js
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('Vanilla Pokemon Emerald Tests', () => {
  let parser: PokemonSaveParser
  let testSaveData: ArrayBuffer
  let groundTruth: {
    player_name: string
    play_time: { hours: number; minutes: number }
    party_pokemon: {
      nickname: string
      otName: string
      currentHp: number
      speciesId: number
      level: number
      maxHp: number
      attack: number
      defense: number
      speed: number
      spAttack: number
      spDefense: number
      displayOtId: string
      displayNature: string
      moves: {
        move1: { name: string; pp: number }
        move2: { name: string; pp: number }
      }
    }[]
  }

  beforeAll(async () => {
    // Create parser with vanilla config
    const config = new VanillaConfig()
    parser = new PokemonSaveParser(undefined, config)

    try {
      // Load emerald test save file
      const savePath = resolve(__dirname, 'test_data', 'emerald.sav')
      const saveBuffer = readFileSync(savePath)
      testSaveData = saveBuffer.buffer.slice(saveBuffer.byteOffset, saveBuffer.byteOffset + saveBuffer.byteLength)

      // Load emerald ground truth data
      const groundTruthPath = resolve(__dirname, 'test_data', 'emerald_ground_truth.json')
      const groundTruthContent = readFileSync(groundTruthPath, 'utf-8')
      groundTruth = JSON.parse(groundTruthContent)

      console.log('Vanilla Emerald test data loaded successfully')
      console.log(`Save file size: ${testSaveData.byteLength} bytes`)
      console.log(`Ground truth contains ${groundTruth.party_pokemon.length} Pokemon`)
    } catch (error) {
      console.warn('Could not load vanilla emerald test data files:', error)
    }
  })

  describe('Auto-Detection', () => {
    it('should correctly identify vanilla emerald saves', async () => {
      const config = new VanillaConfig()
      const saveData = new Uint8Array(testSaveData)

      expect(config.canHandle(saveData)).toBe(true)

      // Auto-detection should work correctly
      const autoParser = new PokemonSaveParser()
      const autoResult = await autoParser.parse(testSaveData)
      expect(autoResult.party_pokemon.length).toBe(1)
      expect(autoResult.party_pokemon[0]?.speciesId).toBe(252) // Treecko
      expect(autoResult.party_pokemon[0]?.nature).toBe('Hasty')
      expect(autoParser.gameConfig?.name).toBe('Pokemon Emerald (Vanilla)')
    })

    it('should distinguish vanilla from ROM hack saves', async () => {
      // Load Quetzal test data and verify detection priority
      const quetzalPath = resolve(__dirname, 'test_data', 'quetzal.sav')
      const quetzalBuffer = readFileSync(quetzalPath)
      const quetzalData = new Uint8Array(quetzalBuffer.buffer.slice(quetzalBuffer.byteOffset, quetzalBuffer.byteOffset + quetzalBuffer.byteLength))

      const vanillaConfig = new VanillaConfig()
      const quetzalConfig = new QuetzalConfig()

      // Both configs should be able to handle their respective saves
      expect(vanillaConfig.canHandle(new Uint8Array(testSaveData))).toBe(true)
      expect(quetzalConfig.canHandle(quetzalData)).toBe(true)

      // Auto-detection should pick the right config for each save type
      const vanillaParser = new PokemonSaveParser()
      await vanillaParser.parse(testSaveData)
      expect(vanillaParser.gameConfig?.name).toBe('Pokemon Emerald (Vanilla)')

      const quetzalParser = new PokemonSaveParser()
      const quetzalArrayBuffer = quetzalBuffer.buffer.slice(quetzalBuffer.byteOffset, quetzalBuffer.byteOffset + quetzalBuffer.byteLength)
      const quetzalResult = await quetzalParser.parse(quetzalArrayBuffer)
      expect(quetzalParser.gameConfig?.name).toBe('Pokemon Quetzal')
      expect(quetzalResult.party_pokemon.length).toBeGreaterThan(1) // Quetzal has multiple Pokemon
    })
  })

  describe('Save File Parsing', () => {
    let parsedData: SaveData

    beforeAll(async () => {
      parsedData = await parser.parse(testSaveData)
    })

    it('should parse player information correctly', () => {
      expect(parsedData.player_name).toBe(groundTruth.player_name)
      expect(parsedData.play_time.hours).toBe(groundTruth.play_time.hours)
      expect(parsedData.play_time.minutes).toBe(groundTruth.play_time.minutes)
    })

    it('should parse correct number of party Pokemon', () => {
      expect(parsedData.party_pokemon).toHaveLength(groundTruth.party_pokemon.length)
    })

    it('should parse Pokemon data with correct decryption', () => {
      expect(parsedData.party_pokemon.length).toBeGreaterThan(0)

      if (parsedData.party_pokemon.length > 0) {
        const pokemon = parsedData.party_pokemon[0]!
        const expected = groundTruth.party_pokemon[0]!

        // Basic Pokemon data
        expect(pokemon.speciesId).toBe(expected.speciesId)
        expect(pokemon.level).toBe(expected.level)
        expect(pokemon.currentHp).toBe(expected.currentHp)
        expect(pokemon.maxHp).toBe(expected.maxHp)

        // Stats (should match ground truth exactly)
        expect(pokemon.attack).toBe(expected.attack)
        expect(pokemon.defense).toBe(expected.defense)
        expect(pokemon.speed).toBe(expected.speed)
        expect(pokemon.spAttack).toBe(expected.spAttack)
        expect(pokemon.spDefense).toBe(expected.spDefense)

        // Text data
        expect(pokemon.nickname).toBe(expected.nickname)
        expect(pokemon.otName).toBe(expected.otName)
        expect(pokemon.otId_str).toBe(expected.displayOtId)

        // Nature should match ground truth
        expect(pokemon.nature).toBe(expected.displayNature)

        // Move data
        expect(pokemon.move1).toBe(1) // Pound
        expect(pokemon.move2).toBe(43) // Leer
        expect(pokemon.pp1).toBe(32) // Pound PP
        expect(pokemon.pp2).toBe(30) // Leer PP
      }
    })

    it('should parse EVs and IVs correctly', () => {
      if (parsedData.party_pokemon.length > 0) {
        const pokemon = parsedData.party_pokemon[0]!

        // EVs should be valid (0-255 range)
        expect(pokemon.evs).toHaveLength(6)
        pokemon.evs.forEach(ev => {
          expect(ev).toBeGreaterThanOrEqual(0)
          expect(ev).toBeLessThanOrEqual(255)
        })

        // IVs should be valid (0-31 range)
        expect(pokemon.ivs).toHaveLength(6)
        pokemon.ivs.forEach(iv => {
          expect(iv).toBeGreaterThanOrEqual(0)
          expect(iv).toBeLessThanOrEqual(31)
        })

        // Total IV check (should be reasonable for a starter)
        const totalIvs = pokemon.ivs.reduce((sum, iv) => sum + iv, 0)
        expect(totalIvs).toBeGreaterThan(0)
        expect(totalIvs).toBeLessThanOrEqual(186) // 31 * 6
      }
    })
  })

  describe('EV Writing and Persistence', () => {
    it('should allow writing and reading EVs back correctly', async () => {
      const parsedData = await parser.parse(testSaveData)

      if (parsedData.party_pokemon.length > 0) {
        const pokemon = parsedData.party_pokemon[0]!

        // Modify EVs
        const newEvs = [10, 20, 30, 40, 50, 60]
        pokemon.evs = newEvs

        // EVs should be updated immediately
        expect(pokemon.evs).toEqual(newEvs)

        // Reconstruct save file with modified Pokemon
        const reconstructed = parser.reconstructSaveFile(parsedData.party_pokemon)

        // Parse the reconstructed save file
        const reparsed = await parser.parse(reconstructed)

        // Verify EVs persisted correctly
        expect(reparsed.party_pokemon).toHaveLength(1)
        const reparsedPokemon = reparsed.party_pokemon[0]!
        expect(reparsedPokemon.evs).toEqual(newEvs)

        // Verify other data remained unchanged
        expect(reparsedPokemon.speciesId).toBe(pokemon.speciesId)
        expect(reparsedPokemon.level).toBe(pokemon.level)
        expect(reparsedPokemon.personality).toBe(pokemon.personality)
      }
    })

    it('should handle individual EV modifications', async () => {
      const parsedData = await parser.parse(testSaveData)

      if (parsedData.party_pokemon.length > 0) {
        const pokemon = parsedData.party_pokemon[0]!

        // Test individual EV setters
        pokemon.hpEV = 100
        pokemon.atkEV = 150
        pokemon.defEV = 200

        expect(pokemon.hpEV).toBe(100)
        expect(pokemon.atkEV).toBe(150)
        expect(pokemon.defEV).toBe(200)

        // Verify through array access
        expect(pokemon.evs[0]).toBe(100)
        expect(pokemon.evs[1]).toBe(150)
        expect(pokemon.evs[2]).toBe(200)
      }
    })
  })

  describe('IV Writing and Persistence', () => {
    it('should allow writing and reading IVs back correctly', async () => {
      const parsedData = await parser.parse(testSaveData)

      if (parsedData.party_pokemon.length > 0) {
        const pokemon = parsedData.party_pokemon[0]!

        // Modify IVs (perfect IVs)
        const newIvs = [31, 31, 31, 31, 31, 31]
        pokemon.ivs = newIvs

        // IVs should be updated immediately
        expect(pokemon.ivs).toEqual(newIvs)

        // Reconstruct save file with modified Pokemon
        const reconstructed = parser.reconstructSaveFile(parsedData.party_pokemon)

        // Parse the reconstructed save file
        const reparsed = await parser.parse(reconstructed)

        // Verify IVs persisted correctly
        expect(reparsed.party_pokemon).toHaveLength(1)
        const reparsedPokemon = reparsed.party_pokemon[0]!
        expect(reparsedPokemon.ivs).toEqual(newIvs)

        // Verify other data remained unchanged
        expect(reparsedPokemon.speciesId).toBe(pokemon.speciesId)
        expect(reparsedPokemon.level).toBe(pokemon.level)
        expect(reparsedPokemon.personality).toBe(pokemon.personality)
      }
    })

    it('should handle individual IV modifications', async () => {
      const parsedData = await parser.parse(testSaveData)

      if (parsedData.party_pokemon.length > 0) {
        const pokemon = parsedData.party_pokemon[0]!

        // Test individual IV setters
        pokemon.setIvByIndex(0, 25) // HP
        pokemon.setIvByIndex(1, 30) // Attack
        pokemon.setIvByIndex(2, 15) // Defense

        expect(pokemon.ivs[0]).toBe(25)
        expect(pokemon.ivs[1]).toBe(30)
        expect(pokemon.ivs[2]).toBe(15)
      }
    })
  })

  describe('Nature Calculation', () => {
    it('should calculate nature correctly using vanilla Gen 3 formula', async () => {
      const parsedData = await parser.parse(testSaveData)

      if (parsedData.party_pokemon.length > 0) {
        const pokemon = parsedData.party_pokemon[0]!
        const expected = groundTruth.party_pokemon[0]!

        // Nature should match ground truth
        expect(pokemon.nature).toBe(expected.displayNature)

        // Verify using Gen 3 formula: personality % 25
        const expectedNatureIndex = pokemon.personality % 25
        const natures = ['Hardy', 'Lonely', 'Brave', 'Adamant', 'Naughty', 'Bold', 'Docile', 'Relaxed', 'Impish', 'Lax', 'Timid', 'Hasty', 'Serious', 'Jolly', 'Naive', 'Modest', 'Mild', 'Quiet', 'Bashful', 'Rash', 'Calm', 'Gentle', 'Sassy', 'Careful', 'Quirky']
        expect(pokemon.nature).toBe(natures[expectedNatureIndex])
      }
    })

    it('should not modify stats for neutral natures', () => {
      const config = new VanillaConfig()
      const data = new Uint8Array(config.pokemonSize)
      const view = new DataView(data.buffer)
      // Personality 0 corresponds to Hardy, a neutral nature
      view.setUint32(0x00, 0, true)
      const pokemon = new PokemonBase(data, config)
      expect(pokemon.nature).toBe('Hardy')
      expect(pokemon.natureModifiersArray).toEqual([1, 1, 1, 1, 1, 1])
    })
  })

  describe('Shiny Detection', () => {
    it('should correctly identify non-shiny Pokémon in vanilla saves', async () => {
      const parsedData = await parser.parse(testSaveData)

      if (parsedData.party_pokemon.length > 0) {
        const pokemon = parsedData.party_pokemon[0]! // Treecko from test data

        // Treecko in test data has shinyNumber = 11355, which is > 8, so it should NOT be shiny
        expect(pokemon.shinyNumber).toBeGreaterThan(8)
        expect(pokemon.isShiny).toBe(false)

        // Verify vanilla shiny logic: shinyNumber < 8 means shiny
        const shouldBeShiny = pokemon.shinyNumber < 8
        expect(pokemon.isShiny).toBe(shouldBeShiny)
      }
    })

    it('should use correct vanilla shiny logic (shinyNumber < 8)', async () => {
      const parsedData = await parser.parse(testSaveData)

      if (parsedData.party_pokemon.length > 0) {
        const pokemon = parsedData.party_pokemon[0]!

        // Validate shiny calculation matches vanilla Gen 3 formula
        const { personality, otId } = pokemon
        const trainerId = otId & 0xffff
        const secretId = (otId >> 16) & 0xffff
        const personalityLow = personality & 0xffff
        const personalityHigh = (personality >> 16) & 0xffff
        const expectedShinyNumber = trainerId ^ secretId ^ personalityLow ^ personalityHigh

        expect(pokemon.shinyNumber).toBe(expectedShinyNumber)

        // Vanilla logic: shiny if shinyNumber < 8
        const expectedIsShiny = expectedShinyNumber < 8
        expect(pokemon.isShiny).toBe(expectedIsShiny)
      }
    })

    it('should handle isRadiant property for vanilla saves', async () => {
      const parsedData = await parser.parse(testSaveData)

      if (parsedData.party_pokemon.length > 0) {
        const pokemon = parsedData.party_pokemon[0]!

        // Vanilla saves don't have radiant Pokémon
        expect(pokemon.isRadiant).toBe(false)
      }
    })
  })

  describe('Save File Reconstruction', () => {
    it('should produce identical save file when reconstructing with unchanged party', async () => {
      const parsed = await parser.parse(testSaveData)
      const reconstructed = parser.reconstructSaveFile([...parsed.party_pokemon])

      const originalHash = await hashBuffer(testSaveData)
      const reconstructedHash = await hashBuffer(reconstructed)
      expect(reconstructedHash).toBe(originalHash)
    })

    it('should maintain data integrity when modifying Pokemon stats', async () => {
      const parsed = await parser.parse(testSaveData)

      if (parsed.party_pokemon.length > 0) {
        const pokemon = parsed.party_pokemon[0]!
        const originalSpeciesId = pokemon.speciesId
        const originalLevel = pokemon.level

        // Modify some stats
        pokemon.maxHp = 999
        pokemon.attack = 150
        pokemon.evs = [100, 100, 100, 100, 100, 100]

        // Reconstruct and reparse
        const reconstructed = parser.reconstructSaveFile(parsed.party_pokemon)
        const reparsed = await parser.parse(reconstructed)

        // Verify changes persisted
        const reparsedPokemon = reparsed.party_pokemon[0]!
        expect(reparsedPokemon.maxHp).toBe(999)
        expect(reparsedPokemon.attack).toBe(150)
        expect(reparsedPokemon.evs).toEqual([100, 100, 100, 100, 100, 100])

        // Verify core data unchanged
        expect(reparsedPokemon.speciesId).toBe(originalSpeciesId)
        expect(reparsedPokemon.level).toBe(originalLevel)
      }
    })

    it('should handle encrypted data correctly during reconstruction', async () => {
      const parsed = await parser.parse(testSaveData)

      if (parsed.party_pokemon.length > 0) {
        const pokemon = parsed.party_pokemon[0]!
        const originalPersonality = pokemon.personality
        const originalOtId = pokemon.otId

        // Modify encrypted data (IVs)
        const newIvs = [20, 25, 30, 15, 28, 22]
        pokemon.ivs = newIvs

        // Reconstruct and reparse
        const reconstructed = parser.reconstructSaveFile(parsed.party_pokemon)
        const reparsed = await parser.parse(reconstructed)

        // Verify encrypted data persisted correctly
        const reparsedPokemon = reparsed.party_pokemon[0]!
        expect(reparsedPokemon.ivs).toEqual(newIvs)

        // Verify encryption keys unchanged
        expect(reparsedPokemon.personality).toBe(originalPersonality)
        expect(reparsedPokemon.otId).toBe(originalOtId)
      }
    })
  })
})
