/**
 * Vanilla Pokemon Emerald configuration stub
 * Provides basic configuration for vanilla Pokemon Emerald saves
 * This is a minimal example implementation
 */

import type { GameConfig } from '../../core/types'
import { BasePokemonData } from '../../core/pokemonData'
import { natures } from '../../core/utils'

/**
 * Vanilla Pokemon Emerald data implementation
 * Handles encrypted Pokemon data and standard Gen 3 shiny calculation
 */
class VanillaPokemonData extends BasePokemonData {
  private get encryptionKey (): number {
    // Standard Pokemon encryption key: personality XOR OT ID
    return this.personality ^ this.otId
  }

  // Pokemon data substructure order based on personality
  private getSubstructOrder (): number[] {
    const orderTable = [
      [0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 1, 3], [0, 3, 1, 2], [0, 2, 3, 1], [0, 3, 2, 1],
      [1, 0, 2, 3], [1, 0, 3, 2], [2, 0, 1, 3], [3, 0, 1, 2], [2, 0, 3, 1], [3, 0, 2, 1],
      [1, 2, 0, 3], [1, 3, 0, 2], [2, 1, 0, 3], [3, 1, 0, 2], [2, 3, 0, 1], [3, 2, 0, 1],
      [1, 2, 3, 0], [1, 3, 2, 0], [2, 1, 3, 0], [3, 1, 2, 0], [2, 3, 1, 0], [3, 2, 1, 0],
    ]
    return orderTable[this.personality % 24]!
  }

  // Decrypt and get a specific substruct
  private getDecryptedSubstruct (substructIndex: number): Uint8Array {
    const order = this.getSubstructOrder()
    const actualIndex = order[substructIndex]!
    const substructOffset = 0x20 + actualIndex * 12 // Each substruct is 12 bytes
    const encryptedData = new Uint8Array(this.data.buffer, this.data.byteOffset + substructOffset, 12)
    const decryptedData = new Uint8Array(12)

    // Decrypt in 4-byte chunks
    const key = this.encryptionKey
    for (let i = 0; i < 12; i += 4) {
      const view = new DataView(encryptedData.buffer, encryptedData.byteOffset + i, 4)
      const encrypted = view.getUint32(0, true)
      const decrypted = encrypted ^ key

      const decryptedView = new DataView(decryptedData.buffer, i, 4)
      decryptedView.setUint32(0, decrypted, true)
    }

    return decryptedData
  }

  // Override species to decrypt from substruct 0
  get speciesId (): number {
    try {
      const substruct0 = this.getDecryptedSubstruct(0)
      const view = new DataView(substruct0.buffer, substruct0.byteOffset, substruct0.byteLength)
      const rawSpecies = view.getUint16(0, true) // species is first field in substruct 0

      // Apply species translation (internal species -> external species)
      const mappedSpecies = this.config.translations.translatePokemonId?.(rawSpecies) ?? rawSpecies
      return mappedSpecies
    } catch (error) {
      return 0
    }
  }

  // Override item to decrypt from substruct 0
  get item (): number {
    try {
      const substruct0 = this.getDecryptedSubstruct(0)
      const view = new DataView(substruct0.buffer, substruct0.byteOffset, substruct0.byteLength)
      return this.mapItemToPokeId(view.getUint16(2, true)) // item is at offset 2 in substruct 0
    } catch {
      return 0
    }
  }

  // Override moves to decrypt from substruct 1
  get move1 (): number {
    return this.getMove(0)
  }

  get move2 (): number {
    return this.getMove(1)
  }

  get move3 (): number {
    return this.getMove(2)
  }

  get move4 (): number {
    return this.getMove(3)
  }

  private getMove (index: number): number {
    try {
      const substruct1 = this.getDecryptedSubstruct(1)
      const view = new DataView(substruct1.buffer, substruct1.byteOffset, substruct1.byteLength)
      return this.mapMoveToPokeId(view.getUint16(index * 2, true))
    } catch {
      return 0
    }
  }

  // Override PP to decrypt from substruct 1
  get pp1 (): number { return this.getPP(0) }
  get pp2 (): number { return this.getPP(1) }
  get pp3 (): number { return this.getPP(2) }
  get pp4 (): number { return this.getPP(3) }

  private getPP (index: number): number {
    try {
      const substruct1 = this.getDecryptedSubstruct(1)
      const view = new DataView(substruct1.buffer, substruct1.byteOffset, substruct1.byteLength)
      return view.getUint8(8 + index) // PP starts at offset 8 in substruct 1
    } catch {
      return 0
    }
  }

  // Override EVs to decrypt from substruct 2
  get hpEV (): number { return this.getEV(0) }
  get atkEV (): number { return this.getEV(1) }
  get defEV (): number { return this.getEV(2) }
  get speEV (): number { return this.getEV(3) }
  get spaEV (): number { return this.getEV(4) }
  get spdEV (): number { return this.getEV(5) }

  private getEV (index: number): number {
    try {
      const substruct2 = this.getDecryptedSubstruct(2)
      return substruct2[index]!
    } catch {
      return 0
    }
  }

  get ivs (): readonly number[] {
    try {
      // IVs are in substruct 3 at offset 4 (after pokerus, metLocation, and metLevel/metGame/pokeball/otGender)
      const substruct3 = this.getDecryptedSubstruct(3)
      const view = new DataView(substruct3.buffer, substruct3.byteOffset, substruct3.byteLength)
      const ivData = view.getUint32(4, true)

      // Extract IVs (5 bits each, 6 IVs total)
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

  set ivs (values: readonly number[]) {
    try {
      if (values.length !== 6) throw new Error('IVs array must have 6 values')

      let packed = 0
      for (let i = 0; i < 6; i++) {
        packed |= (values[i]! & 0x1F) << (i * 5)
      }

      // This would require re-encrypting the substruct, which is complex
      // For now, just validate the input
      // For now, we'll leave this as a placeholder
      console.warn('Setting IVs on vanilla Pokemon is not yet implemented', packed)
    } catch (error) {
      console.warn('Failed to set IVs:', error)
    }
  }

  get shinyNumber (): number {
    // Standard Gen 3 shiny calculation
    const trainerId = this.otId & 0xFFFF
    const secretId = (this.otId >> 16) & 0xFFFF
    const personalityLow = this.personality & 0xFFFF
    const personalityHigh = (this.personality >> 16) & 0xFFFF
    return trainerId ^ secretId ^ personalityLow ^ personalityHigh
  }

  get isShiny (): boolean {
    // Standard Gen 3: Pokemon is shiny if shiny value < 8
    return this.shinyNumber < 8
  }

  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  get isRadiant (): boolean {
    // Vanilla Pokemon don't have radiant status
    return false
  }
}

export class VanillaConfig implements GameConfig {
  readonly name = 'Pokemon Emerald (Vanilla)'
  readonly signature = 0x08012025 // Same as Quetzal for Emerald base

  readonly layout = {
    // Sector configuration
    sectors: {
      size: 4096,
      dataSize: 3968,
      footerSize: 12,
      totalCount: 32,
      perSlot: 18,
    },

    // SaveBlock configuration
    saveBlocks: {
      block1Size: 3968 * 4, // SECTOR_DATA_SIZE * 4
    },

    // Party data layout
    party: {
      countOffset: 0x234, // Party count at SaveBlock1 + 0x234
      dataOffset: 0x238, // Party Pokemon data starts at SaveBlock1 + 0x238
      pokemonSize: 100, // Each Pokemon is 100 bytes
      maxSize: 6, // Maximum 6 Pokemon in party
    },

    // Player data layout (SaveBlock2)
    player: {
      playTimeHours: 0x0E, // u16 playTimeHours
      playTimeMinutes: 0x10, // u8 playTimeMinutes
      playTimeSeconds: 0x11, // u8 playTimeSeconds
    },

    // Pokemon data layout - only unencrypted field offsets
    pokemon: {
      // BoxPokemon part (first 80 bytes) - only unencrypted fields
      personality: 0x00, // u32 personality
      otId: 0x04, // u32 otId
      nickname: {
        offset: 0x08,
        length: 10,
      },
      otName: {
        offset: 0x14, // offset 20 decimal
        length: 7,
      },

      // Pokemon struct part (last 20 bytes) - unencrypted
      status: 0x50, // u32 status (offset 80)
      level: 0x54, // u8 level (offset 84)
      currentHp: 0x56, // u16 hp (offset 86)
      maxHp: 0x58, // u16 maxHP (offset 88)
      attack: 0x5A, // u16 attack (offset 90)
      defense: 0x5C, // u16 defense (offset 92)
      speed: 0x5E, // u16 speed (offset 94)
      spAttack: 0x60, // u16 spAttack (offset 96)
      spDefense: 0x62, // u16 spDefense (offset 98)

      // Encrypted fields - accessed via decryption methods in VanillaPokemonData
      // species, item, moves, EVs, IVs are in encrypted substructs 0x20-0x4F
      species: 0x20, // Raw encrypted location (for compatibility)
      item: 0x20, // Raw encrypted location (for compatibility)
      move1: 0x20, // Raw encrypted location (for compatibility)
      move2: 0x20, // Raw encrypted location (for compatibility)
      move3: 0x20, // Raw encrypted location (for compatibility)
      move4: 0x20, // Raw encrypted location (for compatibility)
      pp1: 0x20, // Raw encrypted location (for compatibility)
      pp2: 0x20, // Raw encrypted location (for compatibility)
      pp3: 0x20, // Raw encrypted location (for compatibility)
      pp4: 0x20, // Raw encrypted location (for compatibility)
      hpEV: 0x20, // Raw encrypted location (for compatibility)
      atkEV: 0x20, // Raw encrypted location (for compatibility)
      defEV: 0x20, // Raw encrypted location (for compatibility)
      speEV: 0x20, // Raw encrypted location (for compatibility)
      spaEV: 0x20, // Raw encrypted location (for compatibility)
      spdEV: 0x20, // Raw encrypted location (for compatibility)
      ivData: 0x20, // Raw encrypted location (for compatibility)
    },
  } as const

  // Vanilla Emerald translations - minimal, only for cases where internal IDs differ from expected IDs
  readonly translations = {
    translatePokemonId: (rawId: number): number => {
      // Only Treecko needs translation: 277 → 252
      return rawId === 277 ? 252 : rawId
    },
    // No item or move translations needed for vanilla
  } as const

  /**
   * Create vanilla Emerald-specific Pokemon data instance
   */
  createPokemonData (data: Uint8Array): BasePokemonData {
    return new VanillaPokemonData(data, this)
  }

  /**
   * Vanilla Emerald logic for determining active save slot
   * Corrected to use non-overlapping sector ranges
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
   * For vanilla Emerald, we act as a fallback after ROM hack detection
   */
  /**
   * Calculate nature from personality value using Gen 3 standard formula
   */
  calculateNature (personality: number): string {
    // Gen 3 standard formula: full personality value modulo 25
    return natures[personality % 25]!
  }

  /**
   * Check if this config can handle the given save file
   * Acts as fallback - only accepts vanilla saves, rejects ROM hacks
   */
  canHandle (saveData: Uint8Array): boolean {
    // Basic size check
    if (saveData.length < this.layout.sectors.totalCount * this.layout.sectors.size) {
      return false
    }

    // Check for Emerald signature
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

    // Try to parse Pokemon using the same logic as the main parser
    try {
      const activeSlot = this.determineActiveSlot((sectors: number[]) => {
        let sum = 0
        for (const sectorIndex of sectors) {
          const footerOffset = (sectorIndex * this.layout.sectors.size) + this.layout.sectors.size - this.layout.sectors.footerSize
          if (footerOffset + this.layout.sectors.footerSize <= saveData.length) {
            const view = new DataView(saveData.buffer, saveData.byteOffset + footerOffset, this.layout.sectors.footerSize)
            const signature = view.getUint32(4, true)
            if (signature === this.signature) {
              sum += view.getUint16(8, true)
            }
          }
        }
        return sum
      })

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
