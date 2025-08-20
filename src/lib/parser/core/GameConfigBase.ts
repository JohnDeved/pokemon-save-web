/**
 * Base class for game configurations with common functionality
 */

import { VANILLA_EMERALD_SIGNATURE } from './types'

/**
 * Abstract base class providing common functionality for all game configurations
 */
export abstract class GameConfigBase {
  /**
   * Check if the save data has valid Emerald signature in sector footers
   */
  protected hasValidEmeraldSignature(saveData: Uint8Array, expectedSignature: number = VANILLA_EMERALD_SIGNATURE): boolean {
    try {
      const size = saveData.length
      if (size < 131072 || size > 131200) {
        return false
      }

      // Look for valid Emerald signature in sector footers
      let validSectors = 0
      for (let i = 0; i < 32; i++) {
        const footerOffset = i * 4096 + 4096 - 12
        if (footerOffset + 12 <= saveData.length) {
          const view = new DataView(saveData.buffer, saveData.byteOffset + footerOffset, 12)
          const signature = view.getUint32(4, true)
          if (signature === expectedSignature) {
            validSectors++
          }
        }
      }

      // Need at least 8 valid sectors to be confident
      return validSectors >= 8
    } catch {
      return false
    }
  }

  /**
   * Build a map of sector IDs to their physical indices
   */
  protected buildSectorMap(saveData: Uint8Array, activeSlot: number, expectedSignature: number = VANILLA_EMERALD_SIGNATURE): Map<number, number> {
    const sectorMap = new Map<number, number>()
    const sectorRange = Array.from({ length: 18 }, (_, i) => i + activeSlot)

    for (const i of sectorRange) {
      const footerOffset = i * 4096 + 4096 - 12
      if (footerOffset + 12 <= saveData.length) {
        const view = new DataView(saveData.buffer, saveData.byteOffset + footerOffset, 12)
        const signature = view.getUint32(4, true)
        if (signature === expectedSignature) {
          const sectorId = view.getUint16(0, true)
          sectorMap.set(sectorId, i)
        }
      }
    }

    return sectorMap
  }

  /**
   * Extract SaveBlock1 data from sectors
   */
  protected extractSaveBlock1(saveData: Uint8Array, sectorMap: Map<number, number>): Uint8Array {
    const saveblock1Sectors = [1, 2, 3, 4].filter(id => sectorMap.has(id))
    if (saveblock1Sectors.length === 0) {
      throw new Error('No SaveBlock1 sectors found')
    }

    const saveblock1Data = new Uint8Array(3968 * 4)
    for (const sectorId of saveblock1Sectors) {
      const sectorIdx = sectorMap.get(sectorId)!
      const startOffset = sectorIdx * 4096
      const sectorData = saveData.slice(startOffset, startOffset + 3968)
      const chunkOffset = (sectorId - 1) * 3968
      saveblock1Data.set(sectorData.slice(0, 3968), chunkOffset)
    }

    return saveblock1Data
  }

  /**
   * Helper to determine active save slot by comparing sector counters
   */
  protected getActiveSlot(saveData: Uint8Array, expectedSignature: number = VANILLA_EMERALD_SIGNATURE): number {
    const getCounterSum = (sectorIndices: number[]): number => {
      let sum = 0
      for (const sectorIndex of sectorIndices) {
        const footerOffset = sectorIndex * 4096 + 4096 - 12
        if (footerOffset + 12 <= saveData.length) {
          const view = new DataView(saveData.buffer, saveData.byteOffset + footerOffset, 12)
          const signature = view.getUint32(4, true)
          if (signature === expectedSignature) {
            sum += view.getUint16(8, true) // counter
          }
        }
      }
      return sum
    }

    const slot1Range = Array.from({ length: 18 }, (_, i) => i)
    const slot2Range = Array.from({ length: 18 }, (_, i) => i + 14)
    const slot1Sum = getCounterSum(slot1Range)
    const slot2Sum = getCounterSum(slot2Range)

    return slot2Sum >= slot1Sum ? 14 : 0
  }

  /**
   * Common validation helper for Pokemon data parsing
   */
  protected validatePokemonData(data: Uint8Array, expectedSize: number): boolean {
    if (data.length < expectedSize) {
      return false
    }

    // Basic sanity check - ensure data is not all zeros or all 0xFF
    const isAllZeros = data.every(byte => byte === 0)
    const isAllOnes = data.every(byte => byte === 0xff)

    return !isAllZeros && !isAllOnes
  }

  /**
   * Common helper to parse Pokemon using config-specific detection
   */
  protected parsePokemonForDetection(saveblock1Data: Uint8Array, pokemonSize: number, getSpeciesId: (data: Uint8Array, view: DataView) => number): number {
    let pokemonFound = 0

    for (let slot = 0; slot < 6; slot++) {
      const offset = 0x6a8 + slot * pokemonSize
      const data = saveblock1Data.slice(offset, offset + pokemonSize)

      if (!this.validatePokemonData(data, pokemonSize)) {
        break
      }

      try {
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
        const speciesId = getSpeciesId(data, view)

        if (speciesId > 0 && speciesId < 1000) {
          // Reasonable species ID range
          pokemonFound++
        } else {
          break // Invalid or empty slot, stop looking
        }
      } catch {
        break // Parsing failed, stop looking
      }
    }

    return pokemonFound
  }
}
