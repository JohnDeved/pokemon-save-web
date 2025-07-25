/**
 * Quetzal ROM hack configuration
 * Only overrides differences from vanilla Emerald baseline
 */

import type { GameConfig, ItemMapping, MoveMapping, PokemonMapping } from '../../core/types'
import { natures } from '../../core/utils'
import itemMapData from './data/item_map.json'
import moveMapData from './data/move_map.json'
import pokemonMapData from './data/pokemon_map.json'

export class QuetzalConfig implements GameConfig {
  readonly name = 'Pokemon Quetzal'
  readonly signature = 0x08012025

  // Override Pokemon size for Quetzal
  readonly pokemonSize = 104

  // Override offsets for Quetzal's unencrypted structure
  readonly offsets = {
    personality: 0x00,
    otId: 0x04,
    nickname: 0x08,
    nicknameLength: 10,
    otName: 0x14,
    otNameLength: 7,
    currentHp: 0x23,
    maxHp: 0x5A,
    attack: 0x5C,
    defense: 0x5E,
    speed: 0x60,
    spAttack: 0x62,
    spDefense: 0x64,
    status: 0x57,
    level: 0x58,
  }

  // Override save layout for Quetzal
  readonly saveLayout = {
    sectorSize: 4096,
    sectorDataSize: 3968,
    sectorCount: 32,
    slotsPerSave: 18,
    saveBlockSize: 3968 * 4,
    partyOffset: 0x6A8,
    partyCountOffset: 0x6A4,
    pokemonSize: 104,
    maxPartySize: 6,
    playTimeHours: 0x10,
    playTimeMinutes: 0x14,
    playTimeSeconds: 0x15,
  }

  // Quetzal-specific offsets for unencrypted data
  private readonly quetzalOffsets = {
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
  }

  // Create mapping objects
  private readonly pokemonMap = this.createPokemonMap()
  private readonly itemMap = this.createItemMap()
  private readonly moveMap = this.createMoveMap()

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

  // Override data access methods for Quetzal's unencrypted structure
  getSpeciesId (_data: Uint8Array, view: DataView): number {
    const rawSpecies = view.getUint16(this.quetzalOffsets.species, true)
    return this.pokemonMap.get(rawSpecies)?.id ?? rawSpecies
  }

  getPokemonName (_data: Uint8Array, view: DataView): string | undefined {
    const rawSpecies = view.getUint16(this.quetzalOffsets.species, true)
    return this.pokemonMap.get(rawSpecies)?.name
  }

  getItem (_data: Uint8Array, view: DataView): number {
    const rawItem = view.getUint16(this.quetzalOffsets.item, true)
    return this.itemMap.get(rawItem)?.id ?? rawItem
  }

  getItemName (_data: Uint8Array, view: DataView): string | undefined {
    const rawItem = view.getUint16(this.quetzalOffsets.item, true)
    return this.itemMap.get(rawItem)?.name
  }

  getMove (_data: Uint8Array, view: DataView, index: number): number {
    const moveOffsets = [this.quetzalOffsets.move1, this.quetzalOffsets.move2, this.quetzalOffsets.move3, this.quetzalOffsets.move4]
    const rawMove = view.getUint16(moveOffsets[index]!, true)
    return this.moveMap.get(rawMove)?.id ?? rawMove
  }

  getPP (_data: Uint8Array, view: DataView, index: number): number {
    const ppOffsets = [this.quetzalOffsets.pp1, this.quetzalOffsets.pp2, this.quetzalOffsets.pp3, this.quetzalOffsets.pp4]
    return view.getUint8(ppOffsets[index]!)
  }

  getEV (_data: Uint8Array, view: DataView, index: number): number {
    const evOffsets = [this.quetzalOffsets.hpEV, this.quetzalOffsets.atkEV, this.quetzalOffsets.defEV, this.quetzalOffsets.speEV, this.quetzalOffsets.spaEV, this.quetzalOffsets.spdEV]
    return view.getUint8(evOffsets[index]!)
  }

  setEV (_data: Uint8Array, view: DataView, index: number, value: number): void {
    const evOffsets = [this.quetzalOffsets.hpEV, this.quetzalOffsets.atkEV, this.quetzalOffsets.defEV, this.quetzalOffsets.speEV, this.quetzalOffsets.spaEV, this.quetzalOffsets.spdEV]
    view.setUint8(evOffsets[index]!, value)
  }

  getIVs (_data: Uint8Array, view: DataView): readonly number[] {
    const ivData = view.getUint32(this.quetzalOffsets.ivData, true)
    return Array.from({ length: 6 }, (_, i) => (ivData >>> (i * 5)) & 0x1F)
  }

  setIVs (_data: Uint8Array, view: DataView, values: readonly number[]): void {
    if (values.length !== 6) throw new Error('IVs array must have 6 values')
    let packed = 0
    for (let i = 0; i < 6; i++) {
      packed |= (values[i]! & 0x1F) << (i * 5)
    }
    view.setUint32(this.quetzalOffsets.ivData, packed, true)
  }

  getIsShiny (data: Uint8Array, view: DataView): boolean {
    return this.getShinyNumber(data, view) === 1
  }

  getShinyNumber (_data: Uint8Array, view: DataView): number {
    const personality = view.getUint32(0x00, true)
    return (personality >> 8) & 0xFF
  }

  getIsRadiant (data: Uint8Array, view: DataView): boolean {
    return this.getShinyNumber(data, view) === 2
  }

  /**
   * Override nature calculation for Quetzal-specific formula
   */
  calculateNature (personality: number): string {
    // Quetzal uses only the first byte of personality modulo 25
    return natures[(personality & 0xFF) % 25]!
  }

  /**
   * Override active slot determination for Quetzal
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
   * Use parsing success as detection criteria
   */
  canHandle (saveData: Uint8Array): boolean {
    // Basic size check
    if (saveData.length < 32 * 4096) { // 32 sectors * 4096 bytes each
      return false
    }

    // Check for Emerald signature in any sector
    let hasValidSignature = false
    for (let i = 0; i < 32; i++) {
      const footerOffset = (i * 4096) + 4096 - 12

      if (footerOffset + 12 > saveData.length) {
        continue
      }

      try {
        const view = new DataView(saveData.buffer, saveData.byteOffset + footerOffset, 12)
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
      const activeSlot = this.determineActiveSlot((sectors: number[]) => {
        let sum = 0
        for (const sectorIndex of sectors) {
          const footerOffset = (sectorIndex * 4096) + 4096 - 12
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
        const footerOffset = (i * 4096) + 4096 - 12
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

      const saveblock1Data = new Uint8Array(3968 * 4)
      for (const sectorId of saveblock1Sectors) {
        const sectorIdx = sectorMap.get(sectorId)!
        const startOffset = sectorIdx * 4096
        const sectorData = saveData.slice(startOffset, startOffset + 3968)
        const chunkOffset = (sectorId - 1) * 3968
        saveblock1Data.set(sectorData.slice(0, 3968), chunkOffset)
      }

      // Try to parse Pokemon from the actual saveblock1 data
      let pokemonFound = 0
      for (let slot = 0; slot < 6; slot++) {
        const offset = 0x6A8 + slot * this.pokemonSize
        const data = saveblock1Data.slice(offset, offset + this.pokemonSize)

        if (data.length < this.pokemonSize) {
          break
        }

        try {
          const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
          if (this.getSpeciesId(data, view) > 0) {
            pokemonFound++
          } else {
            break // Empty slot, stop looking
          }
        } catch {
          break // Parsing failed, stop looking
        }
      }

      // Return false if no Pokemon found
      return pokemonFound !== 0
    } catch {
      return false
    }
  }
}
