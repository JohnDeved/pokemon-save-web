/**
 * Comprehensive tests for Pokemon Quetzal save parsing
 * Tests parsing, writing, and reconstruction functionality
 */

import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { beforeAll, describe, expect, it } from 'vitest'
import { PokemonSaveParser } from '../core/PokemonSaveParser'
import { QuetzalConfig } from '../games/quetzal/config'
import { VanillaConfig } from '../games/vanilla/config'
import type { SaveData } from '../core/types'
import { calculateTotalStats, natures } from '../core/utils'

// Hash function for comparing buffers
const hashBuffer = async (buf: ArrayBuffer | Uint8Array) => {
  const ab = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  const { createHash } = await import('crypto')
  return createHash('sha256').update(ab).digest('hex')
}

// Handle ES modules in Node.js
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('Pokemon Quetzal Tests', () => {
  let parser: PokemonSaveParser
  let testSaveData: ArrayBuffer
  let groundTruth: {
    player_name: string
    play_time: { hours: number; minutes: number; seconds: number }
    active_slot: number
    sector_map: Record<string, number>
    party_pokemon: Record<string, unknown>[]
  }

  beforeAll(async () => {
    // Create parser with Quetzal config
    const config = new QuetzalConfig()
    parser = new PokemonSaveParser(undefined, config)

    try {
      // Load Quetzal test save file
      const savePath = resolve(__dirname, 'test_data', 'quetzal.sav')
      const saveBuffer = readFileSync(savePath)
      testSaveData = saveBuffer.buffer.slice(saveBuffer.byteOffset, saveBuffer.byteOffset + saveBuffer.byteLength)

      // Load Quetzal ground truth data
      const groundTruthPath = resolve(__dirname, 'test_data', 'quetzal_ground_truth.json')
      const groundTruthContent = readFileSync(groundTruthPath, 'utf-8')
      groundTruth = JSON.parse(groundTruthContent)

      console.log('Quetzal test data loaded successfully')
      console.log(`Save file size: ${testSaveData.byteLength} bytes`)
      console.log(`Ground truth contains ${groundTruth.party_pokemon.length} Pokemon`)
    } catch (error) {
      console.warn('Could not load Quetzal test data files:', error)
    }
  })

  describe('Auto-Detection', () => {
    it('should correctly identify Quetzal saves', async () => {
      const config = new QuetzalConfig()
      const saveData = new Uint8Array(testSaveData)

      expect(config.canHandle(saveData)).toBe(true)

      // Auto-detection should work correctly
      const autoParser = new PokemonSaveParser()
      const autoResult = await autoParser.parse(testSaveData)
      expect(autoResult.party_pokemon.length).toBe(groundTruth.party_pokemon.length)
      expect(autoParser.gameConfig?.name).toBe('Pokemon Quetzal')
    })

    it('should distinguish Quetzal from vanilla saves', async () => {
      // Load vanilla test data for comparison
      const vanillaPath = resolve(__dirname, 'test_data', 'emerald.sav')
      const vanillaBuffer = readFileSync(vanillaPath)
      const vanillaData = new Uint8Array(vanillaBuffer.buffer.slice(vanillaBuffer.byteOffset, vanillaBuffer.byteOffset + vanillaBuffer.byteLength))

      const vanillaConfig = new VanillaConfig()
      const quetzalConfig = new QuetzalConfig()

      // Both configs should handle their respective saves
      expect(quetzalConfig.canHandle(new Uint8Array(testSaveData))).toBe(true)
      expect(vanillaConfig.canHandle(vanillaData)).toBe(true)

      // Auto-detection should pick the right config
      const quetzalParser = new PokemonSaveParser()
      const quetzalResult = await quetzalParser.parse(testSaveData)
      expect(quetzalParser.gameConfig?.name).toBe('Pokemon Quetzal')
      expect(quetzalResult.party_pokemon.length).toBeGreaterThan(1) // Quetzal has multiple Pokemon

      const vanillaParser = new PokemonSaveParser()
      const vanillaArrayBuffer = vanillaBuffer.buffer.slice(vanillaBuffer.byteOffset, vanillaBuffer.byteOffset + vanillaBuffer.byteLength)
      const vanillaResult = await vanillaParser.parse(vanillaArrayBuffer)
      expect(vanillaParser.gameConfig?.name).toBe('Pokemon Emerald (Vanilla)')
      expect(vanillaResult.party_pokemon.length).toBe(1) // Vanilla has one Pokemon
    })
  })

  describe('Save File Parsing', () => {
    let parsedData: SaveData

    beforeAll(async () => {
      parsedData = await parser.parse(testSaveData)
    })

    it('should parse player information correctly', () => {
      expect(parsedData.player_name).toBe(groundTruth.player_name)
      expect(parsedData.play_time).toEqual(groundTruth.play_time)
      expect(parsedData.active_slot).toBe(groundTruth.active_slot)
    })

    it('should parse correct number of party Pokemon', () => {
      expect(parsedData.party_pokemon).toHaveLength(groundTruth.party_pokemon.length)
    })

    it('should parse Pokemon data correctly (unencrypted structure)', () => {
      parsedData.party_pokemon.forEach((pokemon, i) => {
        const expected = groundTruth.party_pokemon[i]!

        // Basic Pokemon data
        expect(pokemon.speciesId).toBe(expected.speciesId)
        expect(pokemon.level).toBe(expected.level)
        expect(pokemon.personality).toBe(expected.personality)
        expect(pokemon.currentHp).toBe(expected.currentHp)
        expect(pokemon.maxHp).toBe(expected.maxHp)

        // Stats (should match ground truth exactly)
        expect(pokemon.attack).toBe(expected.attack)
        expect(pokemon.defense).toBe(expected.defense)
        expect(pokemon.speed).toBe(expected.speed)
        expect(pokemon.spAttack).toBe(expected.spAttack)
        expect(pokemon.spDefense).toBe(expected.spDefense)

        // OT ID
        expect(pokemon.otId).toBe(expected.otId)

        // Moves
        expect([pokemon.move1, pokemon.move2, pokemon.move3, pokemon.move4]).toEqual([expected.move1, expected.move2, expected.move3, expected.move4])

        // EVs
        expect([pokemon.hpEV, pokemon.atkEV, pokemon.defEV, pokemon.speEV, pokemon.spaEV, pokemon.spdEV]).toEqual([expected.hpEV, expected.atkEV, expected.defEV, expected.speEV, expected.spaEV, expected.spdEV])

        // IVs
        expect([...pokemon.ivs]).toEqual(expected.ivs)
      })
    })

    it('should have valid sector mapping', () => {
      expect(parsedData.sector_map).toBeDefined()
      expect(parsedData.sector_map!.size).toBeGreaterThan(0)
      const expectedSectorMap = new Map(Object.entries(groundTruth.sector_map).map(([k, v]) => [parseInt(k), v]))
      expect(parsedData.sector_map).toEqual(expectedSectorMap)
    })

    it('should calculate stats correctly using base stats from API', async () => {
      // Load base stats cache
      const fs = await import('fs')
      const path = await import('path')
      const cachePath = path.resolve(__dirname, 'test_data', 'base_stats_cache.json')
      let baseStatsCache: Record<string, number[] | undefined> = {}

      if (fs.existsSync(cachePath)) {
        baseStatsCache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'))
      }

      // Check if we need to fetch any missing base stats
      const speciesIds = [...new Set(parsedData.party_pokemon.map(p => p.speciesId))]
      const missing = speciesIds.filter(id => !baseStatsCache[id.toString()])

      if (missing.length > 0) {
        for (const speciesId of missing) {
          try {
            const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${speciesId}`)
            if (!response.ok) continue
            const speciesData = await response.json()
            const apiStats: Record<string, number> = speciesData.stats.reduce((acc: Record<string, number>, stat: { stat: { name: string }; base_stat: number }) => {
              acc[stat.stat.name] = stat.base_stat
              return acc
            }, {})
            baseStatsCache[speciesId.toString()] = [apiStats.hp!, apiStats.attack!, apiStats.defense!, apiStats.speed!, apiStats['special-attack']!, apiStats['special-defense']!]
          } catch (error) {
            console.warn(`Failed to fetch base stats for species ${speciesId}:`, error)
          }
        }
        fs.writeFileSync(cachePath, JSON.stringify(baseStatsCache, null, 2))
      }

      // Verify calculated stats match parsed stats
      for (const pokemon of parsedData.party_pokemon) {
        const baseStats = baseStatsCache[pokemon.speciesId.toString()]
        expect(baseStats).toBeDefined()
        if (baseStats) {
          const calculatedStats = calculateTotalStats(pokemon, baseStats)
          expect(calculatedStats).toEqual(pokemon.stats)
        }
      }
    })
  })

  describe('Nature Calculation', () => {
    it('should calculate natures correctly using Quetzal formula', async () => {
      const result = await parser.parse(testSaveData)

      for (const [i, pokemon] of result.party_pokemon.entries()) {
        const expectedPokemon = groundTruth.party_pokemon[i]

        if (pokemon && expectedPokemon) {
          expect(pokemon.nature).toBe(expectedPokemon.displayNature)

          // Verify the formula uses first byte only (Quetzal-specific)
          const firstByteNature = natures[(pokemon.personality & 0xff) % 25]
          expect(pokemon.nature).toBe(firstByteNature)
        }
      }
    })
  })

  describe('EV Writing and Persistence', () => {
    it('should allow writing and reading EVs back correctly', async () => {
      const parsedData = await parser.parse(testSaveData)

      if (parsedData.party_pokemon.length > 0) {
        const pokemon = parsedData.party_pokemon[0]!

        // Modify EVs
        const newEvs = [50, 100, 150, 200, 75, 125]
        pokemon.evs = newEvs

        // EVs should be updated immediately
        expect(pokemon.evs).toEqual(newEvs)

        // Reconstruct save file with modified Pokemon
        const reconstructed = parser.reconstructSaveFile(parsedData.party_pokemon)

        // Parse the reconstructed save file
        const reparsed = await parser.parse(reconstructed)

        // Verify EVs persisted correctly
        expect(reparsed.party_pokemon).toHaveLength(parsedData.party_pokemon.length)
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
        pokemon.hpEV = 85
        pokemon.atkEV = 170
        pokemon.defEV = 255

        expect(pokemon.hpEV).toBe(85)
        expect(pokemon.atkEV).toBe(170)
        expect(pokemon.defEV).toBe(255)

        // Verify through array access
        expect(pokemon.evs[0]).toBe(85)
        expect(pokemon.evs[1]).toBe(170)
        expect(pokemon.evs[2]).toBe(255)
      }
    })

    it('should test EV writing across multiple Pokemon', async () => {
      const parsedData = await parser.parse(testSaveData)

      // Modify EVs for all Pokemon in party
      parsedData.party_pokemon.forEach((pokemon, index) => {
        const baseValue = (index + 1) * 10
        pokemon.evs = [baseValue, baseValue + 1, baseValue + 2, baseValue + 3, baseValue + 4, baseValue + 5]
      })

      // Reconstruct and reparse
      const reconstructed = parser.reconstructSaveFile(parsedData.party_pokemon)
      const reparsed = await parser.parse(reconstructed)

      // Verify all Pokemon have correct EVs
      reparsed.party_pokemon.forEach((pokemon, index) => {
        const baseValue = (index + 1) * 10
        const expectedEvs = [baseValue, baseValue + 1, baseValue + 2, baseValue + 3, baseValue + 4, baseValue + 5]
        expect(pokemon.evs).toEqual(expectedEvs)
      })
    })
  })

  describe('IV Writing and Persistence', () => {
    it('should allow writing and reading IVs back correctly', async () => {
      const parsedData = await parser.parse(testSaveData)

      if (parsedData.party_pokemon.length > 0) {
        const pokemon = parsedData.party_pokemon[0]!

        // Modify IVs
        const newIvs = [25, 30, 20, 28, 31, 15]
        pokemon.ivs = newIvs

        // IVs should be updated immediately
        expect(pokemon.ivs).toEqual(newIvs)

        // Reconstruct save file with modified Pokemon
        const reconstructed = parser.reconstructSaveFile(parsedData.party_pokemon)

        // Parse the reconstructed save file
        const reparsed = await parser.parse(reconstructed)

        // Verify IVs persisted correctly
        expect(reparsed.party_pokemon).toHaveLength(parsedData.party_pokemon.length)
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
        pokemon.setIvByIndex(0, 20) // HP
        pokemon.setIvByIndex(1, 25) // Attack
        pokemon.setIvByIndex(2, 31) // Defense

        expect(pokemon.ivs[0]).toBe(20)
        expect(pokemon.ivs[1]).toBe(25)
        expect(pokemon.ivs[2]).toBe(31)
      }
    })

    it('should test IV writing across multiple Pokemon', async () => {
      const parsedData = await parser.parse(testSaveData)

      // Modify IVs for all Pokemon in party
      parsedData.party_pokemon.forEach((pokemon, index) => {
        const baseValue = Math.min(31, (index + 1) * 5)
        pokemon.ivs = [baseValue, baseValue, baseValue, baseValue, baseValue, baseValue]
      })

      // Reconstruct and reparse
      const reconstructed = parser.reconstructSaveFile(parsedData.party_pokemon)
      const reparsed = await parser.parse(reconstructed)

      // Verify all Pokemon have correct IVs
      reparsed.party_pokemon.forEach((pokemon, index) => {
        const baseValue = Math.min(31, (index + 1) * 5)
        const expectedIvs = [baseValue, baseValue, baseValue, baseValue, baseValue, baseValue]
        expect(pokemon.ivs).toEqual(expectedIvs)
      })
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

    it('should produce different hash when party order is changed', async () => {
      const parsed = await parser.parse(testSaveData)

      if (parsed.party_pokemon.length < 2) return

      const swapped = [...parsed.party_pokemon]
      const [temp] = swapped
      swapped[0] = swapped[swapped.length - 1]!
      swapped[swapped.length - 1] = temp!

      const reconstructed = parser.reconstructSaveFile(swapped)

      const originalHash = await hashBuffer(testSaveData)
      const swappedHash = await hashBuffer(reconstructed)
      expect(swappedHash).not.toBe(originalHash)
    })

    it('should reflect party changes when reparsing reconstructed data', async () => {
      const parsed = await parser.parse(testSaveData)

      if (parsed.party_pokemon.length < 2) return

      const swapped = [...parsed.party_pokemon]
      const [temp] = swapped
      swapped[0] = swapped[swapped.length - 1]!
      swapped[swapped.length - 1] = temp!

      const reconstructed = parser.reconstructSaveFile(swapped)
      const reparsed = await parser.parse(reconstructed)

      // Verify the swap was preserved
      expect(reparsed.party_pokemon[0]!.speciesId).toBe(parsed.party_pokemon[parsed.party_pokemon.length - 1]!.speciesId)
      expect(reparsed.party_pokemon[reparsed.party_pokemon.length - 1]!.speciesId).toBe(parsed.party_pokemon[0]!.speciesId)
    })

    it('should maintain data integrity when modifying Pokemon stats and EVs/IVs', async () => {
      const parsed = await parser.parse(testSaveData)

      if (parsed.party_pokemon.length > 0) {
        const pokemon = parsed.party_pokemon[0]!
        const originalSpeciesId = pokemon.speciesId
        const originalLevel = pokemon.level

        // Modify stats, EVs, and IVs
        pokemon.maxHp = 500
        pokemon.attack = 200
        pokemon.evs = [252, 252, 4, 0, 0, 0] // Competitive EV spread
        pokemon.ivs = [31, 31, 31, 31, 31, 31] // Perfect IVs

        // Reconstruct and reparse
        const reconstructed = parser.reconstructSaveFile(parsed.party_pokemon)
        const reparsed = await parser.parse(reconstructed)

        // Verify changes persisted
        const reparsedPokemon = reparsed.party_pokemon[0]!
        expect(reparsedPokemon.maxHp).toBe(500)
        expect(reparsedPokemon.attack).toBe(200)
        expect(reparsedPokemon.evs).toEqual([252, 252, 4, 0, 0, 0])
        expect(reparsedPokemon.ivs).toEqual([31, 31, 31, 31, 31, 31])

        // Verify core data unchanged
        expect(reparsedPokemon.speciesId).toBe(originalSpeciesId)
        expect(reparsedPokemon.level).toBe(originalLevel)
      }
    })

    it('should handle unencrypted data structure correctly during reconstruction', async () => {
      const parsed = await parser.parse(testSaveData)

      // Modify multiple Pokemon with various changes
      parsed.party_pokemon.forEach((pokemon, index) => {
        // Modify in a pattern to verify each Pokemon individually
        pokemon.evs = [(index + 1) * 40, (index + 1) * 40, 0, 0, 0, 0]
        pokemon.setIvByIndex(0, Math.min(31, (index + 1) * 10)) // HP IV
        pokemon.setIvByIndex(1, Math.min(31, (index + 1) * 10)) // Attack IV
      })

      // Reconstruct and reparse
      const reconstructed = parser.reconstructSaveFile(parsed.party_pokemon)
      const reparsed = await parser.parse(reconstructed)

      // Verify all changes persisted correctly
      reparsed.party_pokemon.forEach((pokemon, index) => {
        const expectedEvs = [(index + 1) * 40, (index + 1) * 40, 0, 0, 0, 0]
        const expectedHpIv = Math.min(31, (index + 1) * 10)
        const expectedAtkIv = Math.min(31, (index + 1) * 10)

        expect(pokemon.evs[0]).toBe(expectedEvs[0])
        expect(pokemon.evs[1]).toBe(expectedEvs[1])
        expect(pokemon.ivs[0]).toBe(expectedHpIv)
        expect(pokemon.ivs[1]).toBe(expectedAtkIv)
      })
    })
  })

  describe('Data Structure Validation', () => {
    it('should create properly structured Pokemon data', async () => {
      const result = await parser.parse(testSaveData)

      result.party_pokemon.forEach(pokemon => {
        // Verify required properties exist
        expect(pokemon.moves_data).toBeDefined()
        expect(pokemon.evs).toHaveLength(6)
        expect(pokemon.ivs).toHaveLength(6)
        expect(pokemon.otId_str).toMatch(/^[0-9]{5}$/)

        // Verify valid ranges
        pokemon.evs.forEach(ev => {
          expect(ev).toBeGreaterThanOrEqual(0)
          expect(ev).toBeLessThanOrEqual(255)
        })

        pokemon.ivs.forEach(iv => {
          expect(iv).toBeGreaterThanOrEqual(0)
          expect(iv).toBeLessThanOrEqual(31)
        })
      })
    })

    it('should handle Quetzal-specific features correctly', async () => {
      const result = await parser.parse(testSaveData)

      result.party_pokemon.forEach(pokemon => {
        // Test shiny calculation (Quetzal-specific)
        if (pokemon.isShiny) {
          expect(pokemon.shinyNumber).toBe(1)
        }

        // Test radiant Pokemon (Quetzal-specific feature)
        if (pokemon.isRadiant) {
          expect(pokemon.shinyNumber).toBe(2)
        }

        // Verify nature calculation uses first byte
        const expectedNature = natures[(pokemon.personality & 0xff) % 25]
        expect(pokemon.nature).toBe(expectedNature)
      })
    })

    it('should use correct Quetzal shiny logic distinct from vanilla', async () => {
      const result = await parser.parse(testSaveData)

      result.party_pokemon.forEach(pokemon => {
        // Verify shiny logic is different from vanilla
        // In Quetzal: shinyNumber = 1 means shiny, shinyNumber = 2 means radiant
        // In vanilla: shinyNumber < 8 means shiny (no radiant)

        const expectedIsShiny = pokemon.shinyNumber === 1
        const expectedIsRadiant = pokemon.shinyNumber === 2

        expect(pokemon.isShiny).toBe(expectedIsShiny)
        expect(pokemon.isRadiant).toBe(expectedIsRadiant)

        // Ensure isShiny and isRadiant are mutually exclusive
        if (pokemon.isRadiant) {
          expect(pokemon.isShiny).toBe(false)
        }

        // Based on test data, we know some Pokemon have shinyNumber = 2 (radiant)
        // and some have shinyNumber = 0 (normal)
        expect([0, 1, 2]).toContain(pokemon.shinyNumber)
      })
    })
  })
})
