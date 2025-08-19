/**
 * Vanilla Emerald parsing tests
 * Tests specifically for vanilla Pokemon Emerald save parsing
 */

import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { beforeAll, describe, expect, it } from 'vitest'
import { PokemonSaveParser } from '../core/PokemonSaveParser'
import { VanillaConfig } from '../games/vanilla/config'
import { QuetzalConfig } from '../games/quetzal/config'
import type { SaveData } from '../core/types'

// Handle ES modules in Node.js
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('Vanilla Emerald Save Parser', () => {
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

      console.log('Emerald test data loaded successfully')
      console.log(`Save file size: ${testSaveData.byteLength} bytes`)
      console.log(`Ground truth contains ${groundTruth.party_pokemon.length} Pokemon`)
    } catch (error) {
      console.warn('Could not load emerald test data files:', error)
    }
  })

  describe('Vanilla Config Detection', () => {
    it('should handle emerald save file when auto-detected', async () => {
      const config = new VanillaConfig()
      const saveData = new Uint8Array(testSaveData)

      // Vanilla config should now handle the save file correctly
      expect(config.canHandle(saveData)).toBe(true)

      // Auto-detection should also work correctly
      const autoParser = new PokemonSaveParser()
      const autoResult = await autoParser.parse(testSaveData)
      expect(autoResult.party_pokemon.length).toBe(1)
      expect(autoResult.party_pokemon[0]?.speciesId).toBe(252)
      expect(autoResult.party_pokemon[0]?.nature).toBe('Hasty')
    })

    it('should not interfere with Quetzal detection', async () => {
      // Load Quetzal test data and verify it's detected as Quetzal, not Vanilla
      const quetzalPath = resolve(__dirname, 'test_data', 'quetzal.sav')
      const quetzalBuffer = readFileSync(quetzalPath)
      const quetzalData = new Uint8Array(quetzalBuffer.buffer.slice(quetzalBuffer.byteOffset, quetzalBuffer.byteOffset + quetzalBuffer.byteLength))

      const vanillaConfig = new VanillaConfig()
      const quetzalConfig = new QuetzalConfig()

      // Vanilla SHOULD handle Quetzal saves (it's the fallback)
      expect(vanillaConfig.canHandle(quetzalData)).toBe(true)
      // Quetzal SHOULD handle Quetzal saves
      expect(quetzalConfig.canHandle(quetzalData)).toBe(true)

      // Auto-detection should pick Quetzal for quetzal.sav
      const autoParser = new PokemonSaveParser()
      const quetzalArrayBuffer = quetzalBuffer.buffer.slice(quetzalBuffer.byteOffset, quetzalBuffer.byteOffset + quetzalBuffer.byteLength)
      const autoResult = await autoParser.parse(quetzalArrayBuffer)
      expect(autoParser.gameConfig?.name).toBe('Pokemon Quetzal')
      expect(autoResult.party_pokemon.length).toBeGreaterThan(1) // Quetzal has multiple Pokemon
    })
  })

  describe('Save File Parsing', () => {
    let parsedData: SaveData

    beforeAll(async () => {
      parsedData = await parser.parse(testSaveData)
    })

    it('should parse player name correctly', () => {
      expect(parsedData.player_name).toBe(groundTruth.player_name)
    })

    it('should parse play time correctly', () => {
      expect(parsedData.play_time.hours).toBe(groundTruth.play_time.hours)
      expect(parsedData.play_time.minutes).toBe(groundTruth.play_time.minutes)
    })

    it('should find the correct number of party Pokemon', () => {
      expect(parsedData.party_pokemon).toHaveLength(groundTruth.party_pokemon.length)
    })

    it('should parse first Pokemon correctly', () => {
      expect(parsedData.party_pokemon.length).toBeGreaterThan(0)

      if (parsedData.party_pokemon.length > 0) {
        const first = parsedData.party_pokemon[0]!
        const expected = groundTruth.party_pokemon[0]!

        // Basic checks
        expect(first.speciesId).toBe(expected.speciesId)
        expect(first.level).toBe(expected.level)
        expect(first.currentHp).toBe(expected.currentHp)
        expect(first.maxHp).toBe(expected.maxHp)
        expect(first.attack).toBe(expected.attack)
        expect(first.defense).toBe(expected.defense)
        expect(first.speed).toBe(expected.speed)
        expect(first.spAttack).toBe(expected.spAttack)
        expect(first.spDefense).toBe(expected.spDefense)

        // Move checks
        expect(first.move1).toBe(1) // Pound
        expect(first.move2).toBe(43) // Leer
        expect(first.pp1).toBe(32) // Pound PP
        expect(first.pp2).toBe(30) // Leer PP

        // Text and nature checks
        expect(first.nickname).toBe(expected.nickname)
        expect(first.otName).toBe(expected.otName)
        expect(first.otId_str).toBe(expected.displayOtId)
        expect(first.nature).toBe(expected.displayNature) // Should match ground truth
      }
    })
  })
})
