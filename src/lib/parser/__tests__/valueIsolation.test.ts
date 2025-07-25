/**
 * Tests to ensure that modifying one value doesn't affect other values
 * This prevents the twitching bug reported when changing EV values
 */

import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { beforeAll, describe, expect, it } from 'vitest'
import { PokemonSaveParser } from '../core/pokemonSaveParser'
import { QuetzalConfig } from '../games/quetzal/config'
import { VanillaConfig } from '../games/vanilla/config'

// Handle ES modules in Node.js
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

describe('Value Isolation Tests', () => {
  let quetzalParser: PokemonSaveParser
  let vanillaParser: PokemonSaveParser
  let quetzalSaveData: ArrayBuffer
  let vanillaSaveData: ArrayBuffer

  beforeAll(async () => {
    // Setup parsers
    quetzalParser = new PokemonSaveParser(undefined, new QuetzalConfig())
    vanillaParser = new PokemonSaveParser(undefined, new VanillaConfig())

    try {
      // Load test save files
      const quetzalPath = resolve(__dirname, 'test_data', 'quetzal.sav')
      const quetzalBuffer = readFileSync(quetzalPath)
      quetzalSaveData = quetzalBuffer.buffer.slice(quetzalBuffer.byteOffset, quetzalBuffer.byteOffset + quetzalBuffer.byteLength)

      const vanillaPath = resolve(__dirname, 'test_data', 'emerald.sav')
      const vanillaBuffer = readFileSync(vanillaPath)
      vanillaSaveData = vanillaBuffer.buffer.slice(vanillaBuffer.byteOffset, vanillaBuffer.byteOffset + vanillaBuffer.byteLength)
    } catch (error) {
      console.warn('Could not load test data files:', error)
    }
  })

  describe('Quetzal Value Isolation', () => {
    it('should modify only the target EV when writing individual EVs', async () => {
      const parsedData = await quetzalParser.parseSaveFile(quetzalSaveData)

      if (parsedData.party_pokemon.length > 0) {
        const pokemon = parsedData.party_pokemon[0]!

        // Capture initial state
        const initialEvs = [...pokemon.evs]
        const initialIvs = [...pokemon.ivs]
        const initialSpeciesId = pokemon.speciesId
        const initialLevel = pokemon.level
        const initialPersonality = pokemon.personality

        // Modify only HP EV
        const targetEvIndex = 0
        const newEvValue = 100
        pokemon.hpEV = newEvValue

        // Verify only HP EV changed
        expect(pokemon.evs[targetEvIndex]).toBe(newEvValue)

        // Verify all other EVs remained unchanged
        for (let i = 1; i < 6; i++) {
          expect(pokemon.evs[i]).toBe(initialEvs[i])
        }

        // Verify IVs are untouched
        expect(pokemon.ivs).toEqual(initialIvs)

        // Verify other important data is untouched
        expect(pokemon.speciesId).toBe(initialSpeciesId)
        expect(pokemon.level).toBe(initialLevel)
        expect(pokemon.personality).toBe(initialPersonality)
      }
    })

    it('should modify only the target IV when writing individual IVs', async () => {
      const parsedData = await quetzalParser.parseSaveFile(quetzalSaveData)

      if (parsedData.party_pokemon.length > 0) {
        const pokemon = parsedData.party_pokemon[0]!

        // Capture initial state
        const initialEvs = [...pokemon.evs]
        const initialIvs = [...pokemon.ivs]
        const initialSpeciesId = pokemon.speciesId
        const initialLevel = pokemon.level
        const initialPersonality = pokemon.personality

        // Modify only Attack IV using setIvByIndex
        const targetIvIndex = 1
        const newIvValue = 25
        pokemon.setIvByIndex(targetIvIndex, newIvValue)

        // Verify only Attack IV changed
        expect(pokemon.ivs[targetIvIndex]).toBe(newIvValue)

        // Verify all other IVs remained unchanged
        for (let i = 0; i < 6; i++) {
          if (i !== targetIvIndex) {
            expect(pokemon.ivs[i]).toBe(initialIvs[i])
          }
        }

        // Verify EVs are untouched
        expect(pokemon.evs).toEqual(initialEvs)

        // Verify other important data is untouched
        expect(pokemon.speciesId).toBe(initialSpeciesId)
        expect(pokemon.level).toBe(initialLevel)
        expect(pokemon.personality).toBe(initialPersonality)
      }
    })

    it('should modify only targeted stats when using array assignment', async () => {
      const parsedData = await quetzalParser.parseSaveFile(quetzalSaveData)

      if (parsedData.party_pokemon.length > 0) {
        const pokemon = parsedData.party_pokemon[0]!

        // Capture initial state
        const initialIvs = [...pokemon.ivs]
        const initialSpeciesId = pokemon.speciesId
        const initialLevel = pokemon.level
        const initialPersonality = pokemon.personality

        // Modify EVs array
        const newEvs = [50, 100, 75, 80, 90, 85]
        pokemon.evs = newEvs

        // Verify EVs changed correctly
        expect(pokemon.evs).toEqual(newEvs)

        // Verify IVs are untouched
        expect(pokemon.ivs).toEqual(initialIvs)

        // Verify other important data is untouched
        expect(pokemon.speciesId).toBe(initialSpeciesId)
        expect(pokemon.level).toBe(initialLevel)
        expect(pokemon.personality).toBe(initialPersonality)
      }
    })

    it('should persist changes correctly across save/reload cycles', async () => {
      const parsedData = await quetzalParser.parseSaveFile(quetzalSaveData)

      if (parsedData.party_pokemon.length > 0) {
        const pokemon = parsedData.party_pokemon[0]!

        // Make specific changes
        const targetHpEv = 120
        const targetDefenseIv = 28

        pokemon.hpEV = targetHpEv
        pokemon.setIvByIndex(2, targetDefenseIv) // Defense IV

        // Reconstruct save
        const reconstructed = quetzalParser.reconstructSaveFile(parsedData.party_pokemon)

        // Parse reconstructed save
        const reparsed = await quetzalParser.parseSaveFile(reconstructed)
        const reparsedPokemon = reparsed.party_pokemon[0]!

        // Verify only the intended changes persisted
        expect(reparsedPokemon.hpEV).toBe(targetHpEv)
        expect(reparsedPokemon.ivs[2]).toBe(targetDefenseIv)

        // Verify all other data matches original expectations
        expect(reparsedPokemon.speciesId).toBe(pokemon.speciesId)
        expect(reparsedPokemon.level).toBe(pokemon.level)
        expect(reparsedPokemon.personality).toBe(pokemon.personality)
      }
    })
  })

  describe('Vanilla Value Isolation', () => {
    it('should modify only the target EV when writing individual EVs (encrypted)', async () => {
      const parsedData = await vanillaParser.parseSaveFile(vanillaSaveData)

      if (parsedData.party_pokemon.length > 0) {
        const pokemon = parsedData.party_pokemon[0]!

        // Capture initial state
        const initialEvs = [...pokemon.evs]
        const initialIvs = [...pokemon.ivs]
        const initialSpeciesId = pokemon.speciesId
        const initialLevel = pokemon.level
        const initialPersonality = pokemon.personality

        // Modify only Defense EV
        const targetEvIndex = 2
        const newEvValue = 150
        pokemon.defEV = newEvValue

        // Verify only Defense EV changed
        expect(pokemon.evs[targetEvIndex]).toBe(newEvValue)

        // Verify all other EVs remained unchanged
        for (let i = 0; i < 6; i++) {
          if (i !== targetEvIndex) {
            expect(pokemon.evs[i]).toBe(initialEvs[i])
          }
        }

        // Verify IVs are untouched
        expect(pokemon.ivs).toEqual(initialIvs)

        // Verify other important data is untouched (encryption keys)
        expect(pokemon.speciesId).toBe(initialSpeciesId)
        expect(pokemon.level).toBe(initialLevel)
        expect(pokemon.personality).toBe(initialPersonality)
      }
    })

    it('should modify only the target IV when writing individual IVs (encrypted)', async () => {
      const parsedData = await vanillaParser.parseSaveFile(vanillaSaveData)

      if (parsedData.party_pokemon.length > 0) {
        const pokemon = parsedData.party_pokemon[0]!

        // Capture initial state
        const initialEvs = [...pokemon.evs]
        const initialIvs = [...pokemon.ivs]
        const initialSpeciesId = pokemon.speciesId
        const initialLevel = pokemon.level
        const initialPersonality = pokemon.personality

        // Modify only Speed IV using setIvByIndex
        const targetIvIndex = 3
        const newIvValue = 31
        pokemon.setIvByIndex(targetIvIndex, newIvValue)

        // Verify only Speed IV changed
        expect(pokemon.ivs[targetIvIndex]).toBe(newIvValue)

        // Verify all other IVs remained unchanged
        for (let i = 0; i < 6; i++) {
          if (i !== targetIvIndex) {
            expect(pokemon.ivs[i]).toBe(initialIvs[i])
          }
        }

        // Verify EVs are untouched
        expect(pokemon.evs).toEqual(initialEvs)

        // Verify other important data is untouched (encryption keys)
        expect(pokemon.speciesId).toBe(initialSpeciesId)
        expect(pokemon.level).toBe(initialLevel)
        expect(pokemon.personality).toBe(initialPersonality)
      }
    })

    it('should maintain encryption integrity during EV/IV modifications', async () => {
      const parsedData = await vanillaParser.parseSaveFile(vanillaSaveData)

      if (parsedData.party_pokemon.length > 0) {
        const pokemon = parsedData.party_pokemon[0]!

        // Make multiple changes
        pokemon.hpEV = 85
        pokemon.atkEV = 170
        pokemon.setIvByIndex(0, 20) // HP IV
        pokemon.setIvByIndex(1, 30) // Attack IV

        // Reconstruct save
        const reconstructed = vanillaParser.reconstructSaveFile(parsedData.party_pokemon)

        // Parse reconstructed save
        const reparsed = await vanillaParser.parseSaveFile(reconstructed)
        const reparsedPokemon = reparsed.party_pokemon[0]!

        // Verify changes persisted correctly
        expect(reparsedPokemon.hpEV).toBe(85)
        expect(reparsedPokemon.atkEV).toBe(170)
        expect(reparsedPokemon.ivs[0]).toBe(20)
        expect(reparsedPokemon.ivs[1]).toBe(30)

        // Verify encryption keys remained intact
        expect(reparsedPokemon.personality).toBe(pokemon.personality)
        expect(reparsedPokemon.otId).toBe(pokemon.otId)

        // Verify other data remained unchanged
        expect(reparsedPokemon.speciesId).toBe(pokemon.speciesId)
        expect(reparsedPokemon.level).toBe(pokemon.level)
      }
    })
  })

  describe('Cross-Pokemon Isolation', () => {
    it('should modify only the target Pokemon when multiple Pokemon exist', async () => {
      const parsedData = await quetzalParser.parseSaveFile(quetzalSaveData)

      if (parsedData.party_pokemon.length > 1) {
        // Capture initial states of all Pokemon
        const initialStates = parsedData.party_pokemon.map(p => ({
          evs: [...p.evs],
          ivs: [...p.ivs],
          speciesId: p.speciesId,
          level: p.level,
          personality: p.personality,
        }))

        // Modify only the second Pokemon
        const targetPokemon = parsedData.party_pokemon[1]!
        targetPokemon.hpEV = 200
        targetPokemon.setIvByIndex(0, 25)

        // Verify target Pokemon changed
        expect(targetPokemon.hpEV).toBe(200)
        expect(targetPokemon.ivs[0]).toBe(25)

        // Verify all other Pokemon remained unchanged
        parsedData.party_pokemon.forEach((pokemon, index) => {
          if (index === 1) return // Skip the target Pokemon

          const initial = initialStates[index]!
          expect(pokemon.evs).toEqual(initial.evs)
          expect(pokemon.ivs).toEqual(initial.ivs)
          expect(pokemon.speciesId).toBe(initial.speciesId)
          expect(pokemon.level).toBe(initial.level)
          expect(pokemon.personality).toBe(initial.personality)
        })
      }
    })
  })
})
