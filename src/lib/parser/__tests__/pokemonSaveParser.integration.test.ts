/**
 * Integration tests for PokemonSaveParser using real test data
 * These tests require Node.js environment to read files
 */

import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { beforeAll, describe, expect, it } from 'vitest'
import { autoDetectGameConfig } from '../configs/autoDetect'
import { PokemonSaveParser } from '../core/pokemonSaveParser'
import { QuetzalConfig } from '../games/quetzal/index'
import type { SaveData } from '../core/types'
import { calculateTotalStats } from '../core/utils'

// Handle ES modules in Node.js
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('PokemonSaveParser - Integration Tests', () => {
  let parser: PokemonSaveParser
  let testSaveData: ArrayBuffer
  let groundTruth: {
    player_name: string
    play_time: { hours: number, minutes: number, seconds: number }
    active_slot: number
    sector_map: Record<string, number>
    party_pokemon: Array<Record<string, unknown>>
  }

  beforeAll(async () => {
    // Start with auto-detection parser
    parser = new PokemonSaveParser()

    try {
      // Load test save file
      const savePath = resolve(__dirname, 'test_data', 'player1.sav')
      const saveBuffer = readFileSync(savePath)
      testSaveData = saveBuffer.buffer.slice(saveBuffer.byteOffset, saveBuffer.byteOffset + saveBuffer.byteLength)

      // Load ground truth data
      const groundTruthPath = resolve(__dirname, 'test_data', 'ground_truth.json')
      const groundTruthContent = readFileSync(groundTruthPath, 'utf-8')
      groundTruth = JSON.parse(groundTruthContent)

      console.log('Test data loaded successfully')
      console.log(`Save file size: ${testSaveData.byteLength} bytes`)
      console.log(`Ground truth contains ${groundTruth.party_pokemon.length} Pokemon`)
    } catch (error) {
      console.warn('Could not load test data files:', error)
      // Skip these tests if files are not available
    }
  })

  describe('Auto-Detection', () => {
    it('should auto-detect Quetzal config from save file', () => {
      const saveData = new Uint8Array(testSaveData)
      const detectedConfig = autoDetectGameConfig(saveData)

      expect(detectedConfig).not.toBeNull()
      expect(detectedConfig).toBeInstanceOf(QuetzalConfig)
      expect(detectedConfig!.name).toBe('Pokemon Quetzal')
    })

    it('should use auto-detected config in parser', async () => {
      const autoDetectParser = new PokemonSaveParser()
      const result = await autoDetectParser.parseSaveFile(testSaveData)

      expect(autoDetectParser.getGameConfig()).toBeInstanceOf(QuetzalConfig)
      expect(autoDetectParser.getGameConfig()!.name).toBe('Pokemon Quetzal')
      expect(result.party_pokemon).toHaveLength(groundTruth.party_pokemon.length)
    })
  })

  describe('Real Save File Parsing', () => {
    let parsedData: SaveData

    beforeAll(async () => {
      parsedData = await parser.parseSaveFile(testSaveData)
    })

    it('should calculate stats correctly for all party pokemon', async () => {
      const fs = await import('fs')
      const path = await import('path')
      const cachePath = path.resolve(__dirname, 'test_data', 'base_stats_cache.json')
      let baseStatsCache: Record<string, number[] | undefined> = {}
      if (fs.existsSync(cachePath)) {
        baseStatsCache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'))
      }
      const speciesIds = Array.from(new Set(parsedData.party_pokemon.map(p => p.speciesId)))
      const missing = speciesIds.filter(id => !baseStatsCache[id.toString()])
      if (missing.length > 0) {
        for (const speciesId of missing) {
          const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${speciesId}`)
          if (!response.ok) continue
          const speciesData = await response.json()
          const apiStats: Record<string, number> = speciesData.stats.reduce((acc: Record<string, number>, stat: { stat: { name: string }, base_stat: number }) => {
            acc[stat.stat.name] = stat.base_stat
            return acc
          }, {})
          baseStatsCache[speciesId.toString()] = [
            apiStats.hp!,
            apiStats.attack!,
            apiStats.defense!,
            apiStats.speed!,
            apiStats['special-attack']!,
            apiStats['special-defense']!,
          ]
        }
        fs.writeFileSync(cachePath, JSON.stringify(baseStatsCache, null, 2))
      }
      for (const pokemon of parsedData.party_pokemon) {
        const baseStats = baseStatsCache[pokemon.speciesId.toString()]
        expect(baseStats).toBeDefined()
        if (baseStats) {
          expect(calculateTotalStats(pokemon, baseStats)).toEqual(pokemon.stats)
        }
      }
    })

    it('should parse player information correctly', () => {
      expect(parsedData.player_name).toBe(groundTruth.player_name)
      expect(parsedData.play_time).toEqual(groundTruth.play_time)
      expect(parsedData.active_slot).toBe(groundTruth.active_slot)
    })

    it('should parse Pokemon party correctly', () => {
      expect(parsedData.party_pokemon).toHaveLength(groundTruth.party_pokemon.length)
      if (parsedData.party_pokemon.length > 0) {
        const first = parsedData.party_pokemon[0]
        const expected = groundTruth.party_pokemon[0]
        expect(first!.speciesId).toBe(expected!.speciesId)
        expect(first!.level).toBe(expected!.level)
        expect(first!.personality).toBe(expected!.personality)
        expect(first!.currentHp).toBe(expected!.currentHp)
        expect(first!.maxHp).toBe(expected!.maxHp)
        expect([first!.move1, first!.move2, first!.move3, first!.move4]).toEqual([
          expected!.move1, expected!.move2, expected!.move3, expected!.move4,
        ])
        expect([
          first!.hpEV, first!.atkEV, first!.defEV, first!.speEV, first!.spaEV, first!.spdEV,
        ]).toEqual([
          expected!.hpEV, expected!.atkEV, expected!.defEV, expected!.speEV, expected!.spaEV, expected!.spdEV,
        ])
        expect([...first!.ivs]).toEqual(expected!.ivs)
      }
    })

    it('should parse all Pokemon consistently', () => {
      parsedData.party_pokemon.forEach((p, i) => {
        const e = groundTruth.party_pokemon[i]
        expect(p.speciesId).toBe(e!.speciesId)
        expect(p.level).toBe(e!.level)
        expect(p.personality).toBe(e!.personality)
        expect(p.otId).toBe(e!.otId)
        expect([
          p.maxHp, p.attack, p.defense, p.speed, p.spAttack, p.spDefense,
        ]).toEqual([
          e!.maxHp, e!.attack, e!.defense, e!.speed, e!.spAttack, e!.spDefense,
        ])
      })
    })

    it('should have valid sector mapping', () => {
      expect(parsedData.sector_map.size).toBeGreaterThan(0)
      const expectedSectorMap = new Map(
        Object.entries(groundTruth.sector_map).map(([k, v]) => [parseInt(k), v]),
      )
      expect(parsedData.sector_map).toEqual(expectedSectorMap)
    })
  })

  describe('Data Structure Validation', () => {
    it('should create properly structured Pokemon data', async () => {
      const result = await parser.parseSaveFile(testSaveData)
      result.party_pokemon.forEach((p) => {
        expect(p.moves_data).toBeDefined()
        expect(p.evs).toHaveLength(6)
        expect(p.ivs).toHaveLength(6)
        expect(p.otId_str).toMatch(/^[0-9]{5}$/)
      })
    })
  })

  describe('Save file reconstruction', () => {
    it('should produce identical save file data after reconstructing with the same party', async () => {
      const parsed = await parser.parseSaveFile(testSaveData)
      const reconstructed = parser.reconstructSaveFile(parsed.party_pokemon.slice())
      const hashBuffer = async (buf: ArrayBuffer | Uint8Array) => {
        const ab = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
        const { createHash } = await import('crypto')
        return createHash('sha256').update(ab).digest('hex')
      }
      const originalHash = await hashBuffer(testSaveData)
      const reconstructedHash = await hashBuffer(reconstructed)
      expect(reconstructedHash).toBe(originalHash)
    })

    it('should produce a different hash if the party order is changed', async () => {
      const parsed = await parser.parseSaveFile(testSaveData)
      if (parsed.party_pokemon.length < 2) return
      const swapped = parsed.party_pokemon.slice()
      const temp = swapped[0]
      swapped[0] = swapped[swapped.length - 1]!
      swapped[swapped.length - 1] = temp!
      const reconstructed = parser.reconstructSaveFile(swapped)
      const hashBuffer = async (buf: ArrayBuffer | Uint8Array) => {
        const ab = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
        const { createHash } = await import('crypto')
        return createHash('sha256').update(ab).digest('hex')
      }
      const originalHash = await hashBuffer(testSaveData)
      const swappedHash = await hashBuffer(reconstructed)
      expect(swappedHash).not.toBe(originalHash)
    })

    it('should produce a different hash if the party order is changed and reflect the change after parsing', async () => {
      const parsed = await parser.parseSaveFile(testSaveData)
      if (parsed.party_pokemon.length < 2) return
      const swapped = parsed.party_pokemon.slice()
      const temp = swapped[0]
      swapped[0] = swapped[swapped.length - 1]!
      swapped[swapped.length - 1] = temp!
      const reconstructed = parser.reconstructSaveFile(swapped)
      const hashBuffer = async (buf: ArrayBuffer | Uint8Array) => {
        const ab = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
        const { createHash } = await import('crypto')
        return createHash('sha256').update(ab).digest('hex')
      }
      const originalHash = await hashBuffer(testSaveData)
      const swappedHash = await hashBuffer(reconstructed)
      expect(swappedHash).not.toBe(originalHash)
      const reparsed = await parser.parseSaveFile(reconstructed)
      expect(reparsed.party_pokemon[0]!.speciesId).toBe(parsed.party_pokemon[parsed.party_pokemon.length - 1]!.speciesId)
      expect(reparsed.party_pokemon[reparsed.party_pokemon.length - 1]!.speciesId).toBe(parsed.party_pokemon[0]!.speciesId)
    })
  })
})
