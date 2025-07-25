/**
 * Vanilla Pokemon Emerald configuration
 * Serves as the baseline implementation with authentic Emerald structure
 */

import type { GameConfig, ItemMapping, MoveMapping, PokemonMapping } from '../../core/types'
import { natures } from '../../core/utils'
import itemMapData from './data/item_map.json'
import moveMapData from './data/move_map.json'
import pokemonMapData from './data/pokemon_map.json'

// Local interfaces for the new structure
interface PokemonOffsets {
  readonly personality: number
  readonly otId: number
  readonly nickname: number
  readonly nicknameLength: number
  readonly otName: number
  readonly otNameLength: number
  readonly currentHp: number
  readonly maxHp: number
  readonly attack: number
  readonly defense: number
  readonly speed: number
  readonly spAttack: number
  readonly spDefense: number
  readonly status: number
  readonly level: number
}

interface SaveLayout {
  readonly sectorSize: number
  readonly sectorDataSize: number
  readonly sectorCount: number
  readonly slotsPerSave: number
  readonly saveBlockSize: number
  readonly partyOffset: number
  readonly partyCountOffset: number
  readonly pokemonSize: number
  readonly maxPartySize: number
  readonly playTimeHours: number
  readonly playTimeMinutes: number
  readonly playTimeSeconds: number
}

/**
 * Vanilla Pokemon Emerald configuration
 * Implements the authentic Pokemon Emerald save structure with encryption
 */
export class VanillaConfig implements GameConfig {
  readonly name = 'Pokemon Emerald (Vanilla)'
  readonly signature = 0x08012025
  readonly pokemonSize = 100

  // Basic unencrypted offsets (vanilla Emerald structure)
  readonly offsets: PokemonOffsets = {
    personality: 0x00,
    otId: 0x04,
    nickname: 0x08,
    nicknameLength: 10,
    otName: 0x14,
    otNameLength: 7,
    currentHp: 0x56,
    maxHp: 0x58,
    attack: 0x5A,
    defense: 0x5C,
    speed: 0x5E,
    spAttack: 0x60,
    spDefense: 0x62,
    status: 0x50,
    level: 0x54,
  }

  // Save file layout (vanilla Emerald)
  readonly saveLayout: SaveLayout = {
    sectorSize: 4096,
    sectorDataSize: 3968,
    sectorCount: 32,
    slotsPerSave: 18,
    saveBlockSize: 3968 * 4,
    partyOffset: 0x238,
    partyCountOffset: 0x234,
    pokemonSize: 100,
    maxPartySize: 6,
    playTimeHours: 0x0E,
    playTimeMinutes: 0x10,
    playTimeSeconds: 0x11,
  }

  // Load mapping data
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

  // Vanilla Emerald encryption methods
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

  // Game-specific data access implementation
  getSpeciesId (data: Uint8Array, _view: DataView): number {
    try {
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
      const substruct0 = this.getDecryptedSubstruct(data, 0)
      const subView = new DataView(substruct0.buffer, substruct0.byteOffset, substruct0.byteLength)
      const rawSpecies = subView.getUint16(0, true)
      return this.pokemonMap.get(rawSpecies)?.name
    } catch {
      return undefined
    }
  }

  getItem (data: Uint8Array, _view: DataView): number {
    try {
      const substruct0 = this.getDecryptedSubstruct(data, 0)
      const subView = new DataView(substruct0.buffer, substruct0.byteOffset, substruct0.byteLength)
      const rawItem = subView.getUint16(2, true)
      return this.itemMap.get(rawItem)?.id ?? rawItem
    } catch {
      return 0
    }
  }

  getItemName (data: Uint8Array, _view: DataView): string | undefined {
    try {
      const substruct0 = this.getDecryptedSubstruct(data, 0)
      const subView = new DataView(substruct0.buffer, substruct0.byteOffset, substruct0.byteLength)
      const rawItem = subView.getUint16(2, true)
      return this.itemMap.get(rawItem)?.name
    } catch {
      return undefined
    }
  }

  getMove (data: Uint8Array, _view: DataView, index: number): number {
    try {
      const substruct1 = this.getDecryptedSubstruct(data, 1)
      const subView = new DataView(substruct1.buffer, substruct1.byteOffset, substruct1.byteLength)
      const rawMove = subView.getUint16(index * 2, true)
      return this.moveMap.get(rawMove)?.id ?? rawMove
    } catch {
      return 0
    }
  }

  getPP (data: Uint8Array, _view: DataView, index: number): number {
    try {
      const substruct1 = this.getDecryptedSubstruct(data, 1)
      return substruct1[8 + index]!
    } catch {
      return 0
    }
  }

  getEV (data: Uint8Array, _view: DataView, index: number): number {
    try {
      const substruct2 = this.getDecryptedSubstruct(data, 2)
      return substruct2[index]!
    } catch {
      return 0
    }
  }

  setEV (_data: Uint8Array, _view: DataView, _index: number, _value: number): void {
    // EV setting requires re-encryption, which is complex
    // For now, just validate input
    console.warn('Setting EVs on vanilla Pokemon is not yet implemented')
  }

  getIVs (data: Uint8Array, _view: DataView): readonly number[] {
    try {
      const substruct3 = this.getDecryptedSubstruct(data, 3)
      const subView = new DataView(substruct3.buffer, substruct3.byteOffset, substruct3.byteLength)
      const ivData = subView.getUint32(4, true)

      return [
        (ivData >> 0) & 0x1F, // HP
        (ivData >> 5) & 0x1F, // Attack
        (ivData >> 10) & 0x1F, // Defense
        (ivData >> 15) & 0x1F, // Speed
        (ivData >> 20) & 0x1F, // Sp. Attack
        (ivData >> 25) & 0x1F, // Sp. Defense
      ]
    } catch {
      return [0, 0, 0, 0, 0, 0]
    }
  }

  setIVs (_data: Uint8Array, _view: DataView, _values: readonly number[]): void {
    console.warn('Setting IVs on vanilla Pokemon is not yet implemented')
  }

  getIsShiny (data: Uint8Array, view: DataView): boolean {
    return this.getShinyNumber(data, view) < 8
  }

  getShinyNumber (_data: Uint8Array, view: DataView): number {
    const personality = view.getUint32(0x00, true)
    const otId = view.getUint32(0x04, true)
    const trainerId = otId & 0xFFFF
    const secretId = (otId >> 16) & 0xFFFF
    const personalityLow = personality & 0xFFFF
    const personalityHigh = (personality >> 16) & 0xFFFF
    return trainerId ^ secretId ^ personalityLow ^ personalityHigh
  }

  getIsRadiant (_data: Uint8Array, _view: DataView): boolean {
    return false // Vanilla Pokemon don't have radiant status
  }

  /**
   * Calculate nature from personality value using Gen 3 standard formula
   */
  calculateNature (personality: number): string {
    return natures[personality % 25]!
  }

  /**
   * Vanilla Emerald logic for determining active save slot
   */
  determineActiveSlot (getCounterSum: (range: number[]) => number): number {
    // Slot 1: sectors 0-13 (14 sectors)
    // Slot 2: sectors 14-31 (18 sectors)
    const slot1Range = Array.from({ length: 14 }, (_, i) => i)
    const slot2Range = Array.from({ length: 18 }, (_, i) => i + 14)
    const slot1Sum = getCounterSum(slot1Range)
    const slot2Sum = getCounterSum(slot2Range)

    return slot2Sum > slot1Sum ? 14 : 0
  }

  /**
   * Check if this config can handle the given save file
   * Acts as fallback after checking for ROM hack features
   */
  canHandle (saveData: Uint8Array): boolean {
    try {
      // Basic size check
      const size = saveData.length
      if (size < 131072 || size > 131200) {
        return false
      }

      // Try to parse Pokemon using the same logic as the main parser
      const activeSlot = this.determineActiveSlot((sectors: number[]) => {
        let sum = 0
        for (const sectorIndex of sectors) {
          const footerOffset = (sectorIndex * this.saveLayout.sectorSize) + this.saveLayout.sectorSize - 12
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
        const footerOffset = (i * this.saveLayout.sectorSize) + this.saveLayout.sectorSize - 12
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

      const saveblock1Data = new Uint8Array(this.saveLayout.saveBlockSize)
      for (const sectorId of saveblock1Sectors) {
        const sectorIdx = sectorMap.get(sectorId)!
        const startOffset = sectorIdx * this.saveLayout.sectorSize
        const sectorData = saveData.slice(startOffset, startOffset + this.saveLayout.sectorDataSize)
        const chunkOffset = (sectorId - 1) * this.saveLayout.sectorDataSize
        saveblock1Data.set(sectorData.slice(0, this.saveLayout.sectorDataSize), chunkOffset)
      }

      // Try to parse Pokemon
      let pokemonFound = 0
      for (let slot = 0; slot < this.saveLayout.maxPartySize; slot++) {
        const offset = this.saveLayout.partyOffset + slot * this.pokemonSize
        const data = saveblock1Data.slice(offset, offset + this.pokemonSize)

        if (data.length < this.pokemonSize) {
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
}
