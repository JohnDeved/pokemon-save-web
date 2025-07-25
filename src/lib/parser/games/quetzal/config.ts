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
  get ivData () { return this.view.getUint32(this.config.layout.pokemon.ivData, true) }
  set ivData (value) { this.view.setUint32(this.config.layout.pokemon.ivData, value, true) }

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

  readonly layout = {
    sectors: {
      size: 4096,
      dataSize: 3968,
      footerSize: 12,
      totalCount: 32,
      perSlot: 18,
    },
    saveBlocks: {
      block1Size: 3968 * 4, // SECTOR_DATA_SIZE * 4
    },
    party: {
      dataOffset: 0x6A8,
      pokemonSize: 104,
      maxSize: 6,
    },
    player: {
      playTimeHours: 0x10,
      playTimeMinutes: 0x14,
      playTimeSeconds: 0x15,
    },
    pokemon: {
      personality: 0x00,
      otId: 0x04,
      nickname: {
        offset: 0x08,
        length: 10,
      },
      otName: {
        offset: 0x14,
        length: 7,
      },
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

  // Create mapping objects for translations
  private readonly pokemonMap = this.createPokemonMap()
  private readonly itemMap = this.createItemMap()
  private readonly moveMap = this.createMoveMap()

  readonly translations = {
    translatePokemonId: (rawId: number): number => {
      return this.pokemonMap.get(rawId)?.id ?? rawId
    },
    translateItemId: (rawId: number): number | null => {
      return this.itemMap.get(rawId)?.id ?? rawId
    },
    translateMoveId: (rawId: number): number | null => {
      return this.moveMap.get(rawId)?.id ?? rawId
    },
    translatePokemonName: (rawId: number): string | undefined => {
      return this.pokemonMap.get(rawId)?.name
    },
    translateItemName: (rawId: number): string | undefined => {
      return this.itemMap.get(rawId)?.name
    },
    translateMoveName: (rawId: number): string | undefined => {
      return this.moveMap.get(rawId)?.name
    },
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
   * Use the full parsing approach: if we can successfully parse Pokemon, this is the right config
   */
  canHandle (saveData: Uint8Array): boolean {
    // Basic size check
    if (saveData.length < this.layout.sectors.totalCount * this.layout.sectors.size) {
      return false
    }

    // Check for Emerald signature in any sector
    let hasValidSignature = false
    for (let i = 0; i < this.layout.sectors.totalCount; i++) {
      const footerOffset = (i * this.layout.sectors.size) + this.layout.sectors.size - this.layout.sectors.footerSize

      if (footerOffset + this.layout.sectors.footerSize > saveData.length) {
        continue
      }

      try {
        const view = new DataView(saveData.buffer, saveData.byteOffset + footerOffset, this.layout.sectors.footerSize)
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

    // Try to actually parse Pokemon using the same logic as the main parser
    try {
      // Replicate the main parser logic to see if we can find Pokemon
      const activeSlot = this.determineActiveSlot((sectors: number[]) => {
        let sum = 0
        for (const sectorIndex of sectors) {
          const footerOffset = (sectorIndex * this.layout.sectors.size) + this.layout.sectors.size - this.layout.sectors.footerSize
          if (footerOffset + this.layout.sectors.footerSize <= saveData.length) {
            const view = new DataView(saveData.buffer, saveData.byteOffset + footerOffset, this.layout.sectors.footerSize)
            const signature = view.getUint32(4, true)
            if (signature === this.signature) {
              sum += view.getUint16(8, true) // counter
            }
          }
        }
        return sum
      })

      // Build sector map
      const sectorMap = new Map<number, number>()
      const sectorRange = Array.from({ length: 18 }, (_, i) => i + activeSlot)

      for (const i of sectorRange) {
        const footerOffset = (i * this.layout.sectors.size) + this.layout.sectors.size - this.layout.sectors.footerSize
        if (footerOffset + this.layout.sectors.footerSize <= saveData.length) {
          const view = new DataView(saveData.buffer, saveData.byteOffset + footerOffset, this.layout.sectors.footerSize)
          const signature = view.getUint32(4, true)
          if (signature === this.signature) {
            const sectorId = view.getUint16(0, true)
            sectorMap.set(sectorId, i)
          }
        }
      }

      // Extract SaveBlock1 data
      const saveblock1Sectors = [1, 2, 3, 4].filter(id => sectorMap.has(id))
      if (saveblock1Sectors.length === 0) {
        return false
      }

      const saveblock1Data = new Uint8Array(this.layout.saveBlocks.block1Size)
      for (const sectorId of saveblock1Sectors) {
        const sectorIdx = sectorMap.get(sectorId)!
        const startOffset = sectorIdx * this.layout.sectors.size
        const sectorData = saveData.slice(startOffset, startOffset + this.layout.sectors.dataSize)
        const chunkOffset = (sectorId - 1) * this.layout.sectors.dataSize
        saveblock1Data.set(sectorData.slice(0, this.layout.sectors.dataSize), chunkOffset)
      }

      // Try to parse Pokemon from the actual saveblock1 data
      let pokemonFound = 0
      for (let slot = 0; slot < this.layout.party.maxSize; slot++) {
        const offset = this.layout.party.dataOffset + slot * this.layout.party.pokemonSize
        const data = saveblock1Data.slice(offset, offset + this.layout.party.pokemonSize)

        if (data.length < this.layout.party.pokemonSize) {
          break
        }

        try {
          const pokemon = this.createPokemonData(data)
          if (pokemon.speciesId > 0) {
            pokemonFound++
          } else {
            break // Empty slot, stop looking
          }
        } catch {
          break // Parsing failed, stop looking
        }
      }

      // Return true if we found any Pokemon with this config
      return pokemonFound > 0
    } catch {
      return false
    }
  }
}
