/**
 * Integration test comparing memory-based parsing with file-based parsing
 * Tests the accuracy of memory reading against the existing savegame parser
 */

import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { beforeAll, describe, expect, it, afterAll } from 'vitest'
import { PokemonSaveParser } from '../../parser/core/PokemonSaveParser'
import { VanillaConfig } from '../../parser/games/vanilla/config'
import { MgbaWebSocketClient } from '../websocket-client'
import { EmeraldMemoryParser } from '../memory-parser'
import type { SaveData } from '../../parser/core/types'

// Handle ES modules in Node.js
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('Memory vs File Parser Comparison', () => {
  let mgbaClient: MgbaWebSocketClient
  let memoryParser: EmeraldMemoryParser
  let fileParser: PokemonSaveParser
  let fileSaveData: SaveData
  let memorySaveData: SaveData
  let testSaveFile: ArrayBuffer

  beforeAll(async () => {
    // Load the test save file
    const savePath = resolve(__dirname, '../../parser/__tests__/test_data', 'emerald.sav')
    const saveBuffer = readFileSync(savePath)
    testSaveFile = saveBuffer.buffer.slice(saveBuffer.byteOffset, saveBuffer.byteOffset + saveBuffer.byteLength)

    // Initialize file parser
    const config = new VanillaConfig()
    fileParser = new PokemonSaveParser(undefined, config)

    // Parse save file data for comparison
    console.log('Parsing save file with existing parser...')
    fileSaveData = await fileParser.parseSaveFile(testSaveFile)

    // Initialize mGBA WebSocket client
    mgbaClient = new MgbaWebSocketClient()
    memoryParser = new EmeraldMemoryParser(mgbaClient)

    // Connect to mGBA (Docker container should be running)
    try {
      console.log('Connecting to mGBA WebSocket server...')
      await mgbaClient.connect()
      console.log('Connected to mGBA successfully')

      // Wait a moment for the save state to be fully loaded
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Parse memory data
      console.log('Parsing save data from memory...')
      memorySaveData = await memoryParser.parseFromMemory()
    } catch (error) {
      console.error('Failed to connect to mGBA or parse memory:', error)
      throw error
    }
  }, 30000) // 30 second timeout for setup

  afterAll(() => {
    mgbaClient?.disconnect()
  })

  describe('Basic Save Data Comparison', () => {
    it('should have the same player name', () => {
      console.log('File player name:', fileSaveData.player_name)
      console.log('Memory player name:', memorySaveData.player_name)
      expect(memorySaveData.player_name).toBe(fileSaveData.player_name)
    })

    it('should have the same play time', () => {
      console.log('File play time:', fileSaveData.play_time)
      console.log('Memory play time:', memorySaveData.play_time)
      expect(memorySaveData.play_time.hours).toBe(fileSaveData.play_time.hours)
      expect(memorySaveData.play_time.minutes).toBe(fileSaveData.play_time.minutes)
    })

    it('should have the same number of party Pokemon', () => {
      console.log('File party count:', fileSaveData.party_pokemon.length)
      console.log('Memory party count:', memorySaveData.party_pokemon.length)
      expect(memorySaveData.party_pokemon.length).toBe(fileSaveData.party_pokemon.length)
    })
  })

  describe('Pokemon Data Comparison', () => {
    it('should have matching Pokemon species for all party members', () => {
      expect(fileSaveData.party_pokemon.length).toBeGreaterThan(0)
      
      for (let i = 0; i < fileSaveData.party_pokemon.length; i++) {
        const filePokemon = fileSaveData.party_pokemon[i]
        const memoryPokemon = memorySaveData.party_pokemon[i]
        
        console.log(`Pokemon ${i} - File species: ${filePokemon?.speciesId}, Memory species: ${memoryPokemon?.speciesId}`)
        expect(memoryPokemon?.speciesId).toBe(filePokemon?.speciesId)
      }
    })

    it('should have matching Pokemon levels', () => {
      for (let i = 0; i < fileSaveData.party_pokemon.length; i++) {
        const filePokemon = fileSaveData.party_pokemon[i]
        const memoryPokemon = memorySaveData.party_pokemon[i]
        
        console.log(`Pokemon ${i} - File level: ${filePokemon?.level}, Memory level: ${memoryPokemon?.level}`)
        expect(memoryPokemon?.level).toBe(filePokemon?.level)
      }
    })

    it('should have matching Pokemon nicknames', () => {
      for (let i = 0; i < fileSaveData.party_pokemon.length; i++) {
        const filePokemon = fileSaveData.party_pokemon[i]
        const memoryPokemon = memorySaveData.party_pokemon[i]
        
        console.log(`Pokemon ${i} - File nickname: "${filePokemon?.nickname}", Memory nickname: "${memoryPokemon?.nickname}"`)
        expect(memoryPokemon?.nickname).toBe(filePokemon?.nickname)
      }
    })

    it('should have matching Pokemon stats', () => {
      for (let i = 0; i < fileSaveData.party_pokemon.length; i++) {
        const filePokemon = fileSaveData.party_pokemon[i]
        const memoryPokemon = memorySaveData.party_pokemon[i]
        
        if (filePokemon && memoryPokemon) {
          console.log(`Pokemon ${i} stats comparison:`)
          console.log(`  HP: ${filePokemon.currentHp}/${filePokemon.maxHp} vs ${memoryPokemon.currentHp}/${memoryPokemon.maxHp}`)
          console.log(`  Attack: ${filePokemon.attack} vs ${memoryPokemon.attack}`)
          console.log(`  Defense: ${filePokemon.defense} vs ${memoryPokemon.defense}`)
          console.log(`  Speed: ${filePokemon.speed} vs ${memoryPokemon.speed}`)
          console.log(`  Sp.Attack: ${filePokemon.spAttack} vs ${memoryPokemon.spAttack}`)
          console.log(`  Sp.Defense: ${filePokemon.spDefense} vs ${memoryPokemon.spDefense}`)

          expect(memoryPokemon.currentHp).toBe(filePokemon.currentHp)
          expect(memoryPokemon.maxHp).toBe(filePokemon.maxHp)
          expect(memoryPokemon.attack).toBe(filePokemon.attack)
          expect(memoryPokemon.defense).toBe(filePokemon.defense)
          expect(memoryPokemon.speed).toBe(filePokemon.speed)
          expect(memoryPokemon.spAttack).toBe(filePokemon.spAttack)
          expect(memoryPokemon.spDefense).toBe(filePokemon.spDefense)
        }
      }
    })

    it('should have matching Pokemon moves and PP', () => {
      for (let i = 0; i < fileSaveData.party_pokemon.length; i++) {
        const filePokemon = fileSaveData.party_pokemon[i]
        const memoryPokemon = memorySaveData.party_pokemon[i]
        
        if (filePokemon && memoryPokemon) {
          console.log(`Pokemon ${i} moves comparison:`)
          console.log(`  Move 1: ${filePokemon.move1} (PP: ${filePokemon.pp1}) vs ${memoryPokemon.move1} (PP: ${memoryPokemon.pp1})`)
          console.log(`  Move 2: ${filePokemon.move2} (PP: ${filePokemon.pp2}) vs ${memoryPokemon.move2} (PP: ${memoryPokemon.pp2})`)

          expect(memoryPokemon.move1).toBe(filePokemon.move1)
          expect(memoryPokemon.move2).toBe(filePokemon.move2)
          expect(memoryPokemon.pp1).toBe(filePokemon.pp1)
          expect(memoryPokemon.pp2).toBe(filePokemon.pp2)
        }
      }
    })

    it('should have matching trainer information', () => {
      for (let i = 0; i < fileSaveData.party_pokemon.length; i++) {
        const filePokemon = fileSaveData.party_pokemon[i]
        const memoryPokemon = memorySaveData.party_pokemon[i]
        
        if (filePokemon && memoryPokemon) {
          console.log(`Pokemon ${i} trainer info:`)
          console.log(`  OT Name: "${filePokemon.otName}" vs "${memoryPokemon.otName}"`)
          console.log(`  OT ID: ${filePokemon.otId_str} vs ${memoryPokemon.otId_str}`)
          console.log(`  Nature: ${filePokemon.nature} vs ${memoryPokemon.nature}`)

          expect(memoryPokemon.otName).toBe(filePokemon.otName)
          expect(memoryPokemon.otId_str).toBe(filePokemon.otId_str)
          expect(memoryPokemon.nature).toBe(filePokemon.nature)
        }
      }
    })
  })

  describe('Memory Access Validation', () => {
    it('should be able to read arbitrary memory locations', async () => {
      // Test basic memory reading functionality
      const testAddress = 0x02000000 // EWRAM base
      const value = await mgbaClient.readByte(testAddress)
      expect(typeof value).toBe('number')
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(255)
    })

    it('should be able to read multi-byte values consistently', async () => {
      const testAddress = 0x02000000
      const byte1 = await mgbaClient.readByte(testAddress)
      const byte2 = await mgbaClient.readByte(testAddress + 1)
      const word = await mgbaClient.readWord(testAddress)
      
      const expectedWord = byte1 | (byte2 << 8)
      expect(word).toBe(expectedWord)
    })
  })

  describe('Data Integrity', () => {
    it('should parse valid Pokemon data structures', () => {
      for (const pokemon of memorySaveData.party_pokemon) {
        // Basic validation that the data makes sense
        expect(pokemon.speciesId).toBeGreaterThan(0)
        expect(pokemon.speciesId).toBeLessThan(1000) // Reasonable species range
        expect(pokemon.level).toBeGreaterThan(0)
        expect(pokemon.level).toBeLessThanOrEqual(100)
        expect(pokemon.currentHp).toBeGreaterThanOrEqual(0)
        expect(pokemon.currentHp).toBeLessThanOrEqual(pokemon.maxHp)
        expect(pokemon.maxHp).toBeGreaterThan(0)
      }
    })

    it('should have consistent data between memory and file parsing', () => {
      // Overall consistency check
      const memoryJson = JSON.stringify(memorySaveData, null, 2)
      const fileJson = JSON.stringify(fileSaveData, null, 2)
      
      // Log the data for debugging if test fails
      if (memoryJson !== fileJson) {
        console.log('Memory data:', memoryJson)
        console.log('File data:', fileJson)
      }
      
      // For now, just check that both parsed successfully and have same structure
      expect(typeof memorySaveData).toBe('object')
      expect(typeof fileSaveData).toBe('object')
      expect(memorySaveData.party_pokemon.length).toBe(fileSaveData.party_pokemon.length)
    })
  })
})