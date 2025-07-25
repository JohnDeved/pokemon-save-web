/**
 * Vanilla Pokemon Emerald configuration
 * Minimal config that uses vanilla defaults from PokemonData with ID mappings
 */

import type { GameConfig, ItemMapping, MoveMapping, PokemonMapping } from '../../core/types'
import itemMapData from './data/item_map.json'
import moveMapData from './data/move_map.json'
import pokemonMapData from './data/pokemon_map.json'

/**
 * Vanilla Pokemon Emerald configuration
 * Uses PokemonData vanilla defaults with mapping translations for Pokemon/item/move IDs
 */
export class VanillaConfig implements GameConfig {
  readonly name = 'Pokemon Emerald (Vanilla)'
  readonly signature = 0x08012025

  // Load mapping data for translating internal IDs to external IDs
  private readonly pokemonMap = new Map<number, PokemonMapping>(
    Object.entries(pokemonMapData as Record<string, unknown>)
      .filter(([_, v]) => typeof v === 'object' && v !== null && 'id' in v && v.id !== null)
      .map(([k, v]) => [parseInt(k, 10), v as PokemonMapping]),
  )

  private readonly moveMap = new Map<number, MoveMapping>(
    Object.entries(moveMapData as Record<string, unknown>)
      .filter(([_, v]) => typeof v === 'object' && v !== null && 'id' in v && v.id !== null)
      .map(([k, v]) => [parseInt(k, 10), v as MoveMapping]),
  )

  private readonly itemMap = new Map<number, ItemMapping>(
    Object.entries(itemMapData as Record<string, unknown>)
      .filter(([_, v]) => typeof v === 'object' && v !== null && 'id' in v && v.id !== null)
      .map(([k, v]) => [parseInt(k, 10), v as ItemMapping]),
  )

  // Override data access methods to apply mappings to vanilla encrypted data
  getSpeciesId (data: Uint8Array, _view: DataView): number {
    try {
      // Use vanilla decryption logic built into PokemonData
      const substruct0 = this.getDecryptedSubstruct(data, 0)
      const subView = new DataView(substruct0.buffer, substruct0.byteOffset, substruct0.byteLength)
      const rawSpecies = subView.getUint16(0, true)
      return this.pokemonMap.get(rawSpecies)?.id ?? rawSpecies
    } catch {
      return 0
    }
  }

  getPokemonName (data: Uint8Array, _view: DataView): string | undefined {
    try {
      const internalId = this.getInternalSpeciesId(data)
      return this.pokemonMap.get(internalId)?.name
    } catch {
      return undefined
    }
  }

  getItem (data: Uint8Array, _view: DataView): number {
    try {
      const internalId = this.getInternalItemId(data)
      return this.itemMap.get(internalId)?.id ?? internalId
    } catch {
      return 0
    }
  }

  getItemName (data: Uint8Array, _view: DataView): string | undefined {
    try {
      const internalId = this.getInternalItemId(data)
      return this.itemMap.get(internalId)?.name
    } catch {
      return undefined
    }
  }

  getMove (data: Uint8Array, _view: DataView, index: number): number {
    try {
      const internalId = this.getInternalMoveId(data, index)
      return this.moveMap.get(internalId)?.id ?? internalId
    } catch {
      return 0
    }
  }

  // Helper methods for vanilla encryption (simplified from PokemonData)
  private getEncryptionKey (data: Uint8Array): number {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    const personality = view.getUint32(0x00, true)
    const otId = view.getUint32(0x04, true)
    return personality ^ otId
  }

  private getSubstructOrder (personality: number): number[] {
    const orderTable = [
      [0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 1, 3], [0, 3, 1, 2], [0, 2, 3, 1], [0, 3, 2, 1],
      [1, 0, 2, 3], [1, 0, 3, 2], [2, 0, 1, 3], [3, 0, 1, 2], [2, 0, 3, 1], [3, 0, 2, 1],
      [1, 2, 0, 3], [1, 3, 0, 2], [2, 1, 0, 3], [3, 1, 0, 2], [2, 3, 0, 1], [3, 2, 0, 1],
      [1, 2, 3, 0], [1, 3, 2, 0], [2, 1, 3, 0], [3, 1, 2, 0], [2, 3, 1, 0], [3, 2, 1, 0],
    ]
    return orderTable[personality % 24]!
  }

  private getDecryptedSubstruct (data: Uint8Array, substructIndex: number): Uint8Array {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    const personality = view.getUint32(0x00, true)
    const order = this.getSubstructOrder(personality)
    const actualIndex = order[substructIndex]!
    const substructOffset = 0x20 + actualIndex * 12
    const encryptedData = new Uint8Array(data.buffer, data.byteOffset + substructOffset, 12)
    const decryptedData = new Uint8Array(12)

    const key = this.getEncryptionKey(data)
    for (let i = 0; i < 12; i += 4) {
      const encView = new DataView(encryptedData.buffer, encryptedData.byteOffset + i, 4)
      const encrypted = encView.getUint32(0, true)
      const decrypted = encrypted ^ key

      const decView = new DataView(decryptedData.buffer, i, 4)
      decView.setUint32(0, decrypted, true)
    }

    return decryptedData
  }

  // Helper methods to get internal IDs without mapping
  private getInternalSpeciesId (data: Uint8Array): number {
    try {
      const substruct0 = this.getDecryptedSubstruct(data, 0)
      const subView = new DataView(substruct0.buffer, substruct0.byteOffset, substruct0.byteLength)
      return subView.getUint16(0, true)
    } catch {
      return 0
    }
  }

  private getInternalItemId (data: Uint8Array): number {
    try {
      const substruct0 = this.getDecryptedSubstruct(data, 0)
      const subView = new DataView(substruct0.buffer, substruct0.byteOffset, substruct0.byteLength)
      return subView.getUint16(2, true)
    } catch {
      return 0
    }
  }

  private getInternalMoveId (data: Uint8Array, index: number): number {
    try {
      const substruct1 = this.getDecryptedSubstruct(data, 1)
      const subView = new DataView(substruct1.buffer, substruct1.byteOffset, substruct1.byteLength)
      return subView.getUint16(index * 2, true)
    } catch {
      return 0
    }
  }

  /**
   * Check if this config can handle the given save file
   * Uses vanilla Emerald parsing logic as detection criteria
   */
  canHandle (saveData: Uint8Array): boolean {
    try {
      // Basic size check
      const size = saveData.length
      if (size < 131072 || size > 131200) {
        return false
      }

      // Use vanilla save layout defaults
      const saveLayout = {
        sectorSize: 4096,
        sectorDataSize: 3968,
        sectorCount: 32,
        slotsPerSave: 18,
        saveBlockSize: 3968 * 4,
        partyOffset: 0x238,
        partyCountOffset: 0x234,
        pokemonSize: 100,
        maxPartySize: 6,
      }

      // Try to parse Pokemon using the same logic as the main parser
      const activeSlot = this.getDefaultActiveSlot((sectors: number[]) => {
        let sum = 0
        for (const sectorIndex of sectors) {
          const footerOffset = (sectorIndex * saveLayout.sectorSize) + saveLayout.sectorSize - 12
          if (footerOffset + 12 <= saveData.length) {
            const view = new DataView(saveData.buffer, saveData.byteOffset + footerOffset, 12)
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
        const footerOffset = (i * saveLayout.sectorSize) + saveLayout.sectorSize - 12
        if (footerOffset + 12 <= saveData.length) {
          const view = new DataView(saveData.buffer, saveData.byteOffset + footerOffset, 12)
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

      const saveblock1Data = new Uint8Array(saveLayout.saveBlockSize)
      for (const sectorId of saveblock1Sectors) {
        const sectorIdx = sectorMap.get(sectorId)!
        const startOffset = sectorIdx * saveLayout.sectorSize
        const sectorData = saveData.slice(startOffset, startOffset + saveLayout.sectorDataSize)
        const chunkOffset = (sectorId - 1) * saveLayout.sectorDataSize
        saveblock1Data.set(sectorData.slice(0, saveLayout.sectorDataSize), chunkOffset)
      }

      // Try to parse Pokemon
      let pokemonFound = 0
      for (let slot = 0; slot < saveLayout.maxPartySize; slot++) {
        const offset = saveLayout.partyOffset + slot * saveLayout.pokemonSize
        const data = saveblock1Data.slice(offset, offset + saveLayout.pokemonSize)

        if (data.length < saveLayout.pokemonSize) {
          break
        }

        try {
          const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
          if (this.getSpeciesId(data, view) > 0) {
            pokemonFound++
          } else {
            break
          }
        } catch {
          break
        }
      }

      return pokemonFound > 0
    } catch {
      return false
    }
  }

  private getDefaultActiveSlot (getCounterSum: (range: number[]) => number): number {
    // Slot 1: sectors 0-13 (14 sectors)
    // Slot 2: sectors 14-31 (18 sectors)
    const slot1Range = Array.from({ length: 14 }, (_, i) => i)
    const slot2Range = Array.from({ length: 18 }, (_, i) => i + 14)
    const slot1Sum = getCounterSum(slot1Range)
    const slot2Sum = getCounterSum(slot2Range)

    return slot2Sum > slot1Sum ? 14 : 0
  }
}
