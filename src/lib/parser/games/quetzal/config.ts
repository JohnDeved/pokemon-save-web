/**
 * Quetzal ROM hack configuration
 * Contains all Quetzal-specific offsets, mappings, and parsing logic
 */

import type { GameConfig, ItemMapping, MoveMapping, PokemonMapping } from '../../core/types'
import { BasePokemonData } from '../../core/pokemonData'
import { natures } from '../../core/utils'
import itemMapData from './data/item_map.json'
import moveMapData from './data/move_map.json'
import pokemonMapData from './data/pokemon_map.json'

/**
 * Quetzal-specific Pokemon data implementation
 * Handles Quetzal's unencrypted IVs and custom shiny system
 */
class QuetzalPokemonData extends BasePokemonData {
  get ivData () { return this.view.getUint32(this.config.offsets.pokemonData.ivData, true) }
  set ivData (value) { this.view.setUint32(this.config.offsets.pokemonData.ivData, value, true) }

  get ivs (): readonly number[] {
    // Quetzal uses unencrypted IV data
    return Array.from({ length: 6 }, (_, i) => (this.ivData >>> (i * 5)) & 0x1F)
  }

  set ivs (values: readonly number[]) {
    if (values.length !== 6) throw new Error('IVs array must have 6 values')
    let packed = 0
    for (let i = 0; i < 6; i++) {
      packed |= (values[i]! & 0x1F) << (i * 5)
    }
    this.ivData = packed
  }

  get shinyNumber (): number {
    // Quetzal-specific: the 2nd byte of personality determines shininess
    return (this.personality >> 8) & 0xFF
  }

  get isShiny (): boolean {
    return this.shinyNumber === 1
  }

  get isRadiant (): boolean {
    // Quetzal-specific feature: radiant Pokemon
    return this.shinyNumber === 2
  }
}

export class QuetzalConfig implements GameConfig {
  readonly name = 'Pokemon Quetzal'
  readonly signature = 0x08012025 // EMERALD_SIGNATURE

  readonly offsets = {
    sectorSize: 4096,
    sectorDataSize: 3968,
    sectorFooterSize: 12,
    saveblock1Size: 3968 * 4, // SECTOR_DATA_SIZE * 4
    sectorsPerSlot: 18,
    totalSectors: 32,
    partyStartOffset: 0x6A8,
    partyPokemonSize: 104,
    maxPartySize: 6,
    pokemonNicknameLength: 10,
    pokemonTrainerNameLength: 7,
    playTimeHours: 0x10,
    playTimeMinutes: 0x14,
    playTimeSeconds: 0x15,
    pokemonData: {
      personality: 0x00,
      otId: 0x04,
      nickname: 0x08,
      otName: 0x14,
      currentHp: 0x23,
      species: 0x28,
      item: 0x2A,
      move1: 0x34,
      move2: 0x36,
      move3: 0x38,
      move4: 0x3A,
      pp1: 0x3C,
      pp2: 0x3D,
      pp3: 0x3E,
      pp4: 0x3F,
      hpEV: 0x40,
      atkEV: 0x41,
      defEV: 0x42,
      speEV: 0x43,
      spaEV: 0x44,
      spdEV: 0x45,
      ivData: 0x50,
      status: 0x57,
      level: 0x58,
      maxHp: 0x5A,
      attack: 0x5C,
      defense: 0x5E,
      speed: 0x60,
      spAttack: 0x62,
      spDefense: 0x64,
    },
  } as const

  readonly mappings = {
    pokemon: this.createPokemonMap(),
    items: this.createItemMap(),
    moves: this.createMoveMap(),
  } as const

  private createPokemonMap (): ReadonlyMap<number, PokemonMapping> {
    const map = new Map<number, PokemonMapping>()
    const data = pokemonMapData as Record<string, PokemonMapping>

    for (const [key, value] of Object.entries(data)) {
      map.set(parseInt(key, 10), value)
    }
    return map
  }

  private createItemMap (): ReadonlyMap<number, ItemMapping> {
    const map = new Map<number, ItemMapping>()
    const data = itemMapData as Record<string, { name: string, id_name: string, id: number | null }>

    for (const [key, value] of Object.entries(data)) {
      map.set(parseInt(key, 10), value)
    }
    return map
  }

  private createMoveMap (): ReadonlyMap<number, MoveMapping> {
    const map = new Map<number, MoveMapping>()
    const data = moveMapData as Record<string, { name: string, id_name: string, id: number | null }>

    for (const [key, value] of Object.entries(data)) {
      map.set(parseInt(key, 10), value)
    }
    return map
  }

  /**
   * Create Quetzal-specific Pokemon data instance
   */
  createPokemonData (data: Uint8Array): BasePokemonData {
    return new QuetzalPokemonData(data, this)
  }

  /**
   * Calculate nature from personality value using Quetzal-specific formula
   */
  calculateNature (personality: number): string {
    // Quetzal uses only the first byte of personality modulo 25
    return natures[(personality & 0xFF) % 25]!
  }

  /**
   * Quetzal-specific logic for determining active save slot
   * Uses the same logic as the original parser
   */
  determineActiveSlot (getCounterSum: (range: number[]) => number): number {
    const slot1Range = Array.from({ length: 18 }, (_, i) => i)
    const slot2Range = Array.from({ length: 18 }, (_, i) => i + 14)
    const slot1Sum = getCounterSum(slot1Range)
    const slot2Sum = getCounterSum(slot2Range)

    return slot2Sum >= slot1Sum ? 14 : 0
  }

  /**
   * Check if this config can handle the given save file
   * Look for Quetzal-specific patterns in the save structure
   */
  canHandle (saveData: Uint8Array): boolean {
    // Basic size check
    if (saveData.length < this.offsets.totalSectors * this.offsets.sectorSize) {
      return false
    }

    // Check for Emerald signature in any sector
    let hasValidSignature = false
    for (let i = 0; i < this.offsets.totalSectors; i++) {
      const footerOffset = (i * this.offsets.sectorSize) + this.offsets.sectorSize - this.offsets.sectorFooterSize

      if (footerOffset + this.offsets.sectorFooterSize > saveData.length) {
        continue
      }

      try {
        const view = new DataView(saveData.buffer, saveData.byteOffset + footerOffset, this.offsets.sectorFooterSize)
        const signature = view.getUint32(4, true)

        if (signature === this.signature) {
          hasValidSignature = true
          break
        }
      } catch {
        continue
      }
    }

    if (!hasValidSignature) {
      return false
    }

    // Check for Quetzal-specific patterns
    try {
      const activeSlot = this.determineActiveSlot((sectors: number[]) => {
        let sum = 0
        for (const sectorIndex of sectors) {
          const footerOffset = (sectorIndex * this.offsets.sectorSize) + this.offsets.sectorSize - this.offsets.sectorFooterSize
          if (footerOffset + this.offsets.sectorFooterSize <= saveData.length) {
            const view = new DataView(saveData.buffer, saveData.byteOffset + footerOffset, this.offsets.sectorFooterSize)
            const signature = view.getUint32(4, true)
            if (signature === this.signature) {
              sum += view.getUint16(8, true) // counter
            }
          }
        }
        return sum
      })

      const saveBlock1Offset = activeSlot * this.offsets.sectorSize
      const partyCountOffset = saveBlock1Offset + 0x234

      if (partyCountOffset + 4 <= saveData.length) {
        const partyCount = new DataView(saveData.buffer, saveData.byteOffset + partyCountOffset, 4).getUint32(0, true)

        // Check party count is reasonable
        if (partyCount < 0 || partyCount > 6) {
          return false
        }

        // Look for Quetzal-specific patterns in the save data
        // 1. Check if party area has non-zero data beyond the first 32 bytes (indicates Quetzal structure)
        const partyDataOffset = saveBlock1Offset + 0x238
        if (partyDataOffset + 64 <= saveData.length) {
          const partyAreaData = new Uint8Array(saveData.buffer, saveData.byteOffset + partyDataOffset + 32, 32)
          let hasQuetzalPattern = false

          // Check for non-zero data in the extended party area (bytes 32-64)
          for (let i = 0; i < 32; i++) {
            if (partyAreaData[i] !== 0) {
              hasQuetzalPattern = true
              break
            }
          }

          // If party is not empty, check for extended features
          if (partyCount > 0) {
            for (let slot = 0; slot < partyCount; slot++) {
              const pokemonOffset = partyDataOffset + (slot * this.offsets.partyPokemonSize)
              if (pokemonOffset + this.offsets.partyPokemonSize <= saveData.length) {
                const pokemonData = new Uint8Array(saveData.buffer, saveData.byteOffset + pokemonOffset, this.offsets.partyPokemonSize)
                const pokemon = this.createPokemonData(pokemonData)

                // Check for extended species, moves, or radiant Pokemon
                const rawSpeciesId = new DataView(pokemonData.buffer, pokemonData.byteOffset + this.offsets.pokemonData.species, 2).getUint16(0, true)
                if (rawSpeciesId > 493) {
                  return true // Extended species = Quetzal
                }

                if (pokemon.isRadiant) {
                  return true // Radiant Pokemon = Quetzal
                }

                const moves = [pokemon.move1, pokemon.move2, pokemon.move3, pokemon.move4]
                if (moves.some(moveId => moveId > 354)) {
                  return true // Extended moves = Quetzal
                }
              }
            }
          }

          // If we found the Quetzal pattern in the extended area, return true
          return hasQuetzalPattern
        }
      }
    } catch {
      // If parsing fails, this config can't handle the save
      return false
    }

    return false
  }
}
