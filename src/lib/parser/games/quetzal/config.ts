/**
 * Quetzal ROM hack configuration
 * Contains all Quetzal-specific offsets, mappings, and parsing logic
 */

import type { GameConfig, ItemMapping, MoveMapping, PokemonMapping } from '../../configs/GameConfig.js'
import itemMapData from './data/item_map.json'
import moveMapData from './data/move_map.json'
import pokemonMapData from './data/pokemon_map.json'

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
    // Quetzal-specific Pokemon data structure offsets
    pokemonData: {
      personality: 0x00,
      otId: 0x04,
      nickname: 0x08,
      otName: 0x14,
      currentHp: 0x23,
      speciesId: 0x28,
      item: 0x2A,
      moves: [0x34, 0x36, 0x38, 0x3A] as const,
      ppValues: [0x3C, 0x3D, 0x3E, 0x3F] as const,
      evs: [0x40, 0x41, 0x42, 0x43, 0x44, 0x45] as const, // hp, atk, def, spe, spa, spd
      ivData: 0x50,
      status: 0x57,
      level: 0x58,
      stats: [0x5A, 0x5C, 0x5E, 0x60, 0x62, 0x64] as const, // maxHp, atk, def, spe, spa, spd
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
    const data = itemMapData as Record<string, ItemMapping>

    for (const [key, value] of Object.entries(data)) {
      // Skip entries with null IDs
      if (value.id !== null) {
        map.set(parseInt(key, 10), value)
      }
    }
    return map
  }

  private createMoveMap (): ReadonlyMap<number, MoveMapping> {
    const map = new Map<number, MoveMapping>()
    const data = moveMapData as Record<string, MoveMapping>

    for (const [key, value] of Object.entries(data)) {
      // Skip entries with null IDs
      if (value.id !== null) {
        map.set(parseInt(key, 10), value)
      }
    }
    return map
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
   * For Quetzal, we check for the Emerald signature and specific characteristics
   */
  canHandle (saveData: Uint8Array): boolean {
    // Basic size check
    if (saveData.length < this.offsets.totalSectors * this.offsets.sectorSize) {
      return false
    }

    // Check for at least one valid sector with Emerald signature
    for (let i = 0; i < this.offsets.totalSectors; i++) {
      const footerOffset = (i * this.offsets.sectorSize) + this.offsets.sectorSize - this.offsets.sectorFooterSize

      if (footerOffset + this.offsets.sectorFooterSize > saveData.length) {
        continue
      }

      try {
        const view = new DataView(saveData.buffer, saveData.byteOffset + footerOffset, this.offsets.sectorFooterSize)
        const signature = view.getUint32(4, true)

        if (signature === this.signature) {
          return true
        }
      } catch {
        continue
      }
    }

    return false
  }
}
