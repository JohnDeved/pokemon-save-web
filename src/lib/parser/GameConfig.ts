/**
 * GameConfig interface for dependency injection
 * Defines the contract for game-specific parsing configuration
 */

// Type definitions for mapping objects
export interface PokemonMapping {
  readonly name: string
  readonly id_name: string
  readonly id: number
}

export interface ItemMapping {
  readonly name: string
  readonly id_name: string
  readonly id: number | null // Allow null for unmapped items
}

export interface MoveMapping {
  readonly name: string
  readonly id_name: string
  readonly id: number | null // Allow null for unmapped moves
}

/**
 * Game-specific configuration interface
 * Contains all offsets, signatures, mappings, and other game-specific data
 */
export interface GameConfig {
  readonly name: string
  readonly signature: number
  readonly offsets: {
    readonly sectorSize: number
    readonly sectorDataSize: number
    readonly sectorFooterSize: number
    readonly saveblock1Size: number
    readonly sectorsPerSlot: number
    readonly totalSectors: number
    readonly partyStartOffset: number
    readonly partyPokemonSize: number
    readonly maxPartySize: number
    readonly pokemonNicknameLength: number
    readonly pokemonTrainerNameLength: number
    readonly playTimeHours: number
    readonly playTimeMinutes: number
    readonly playTimeSeconds: number
  }
  readonly mappings: {
    readonly pokemon: ReadonlyMap<number, PokemonMapping>
    readonly items: ReadonlyMap<number, ItemMapping>
    readonly moves: ReadonlyMap<number, MoveMapping>
  }

  /**
   * Game-specific logic for determining save slot based on counters
   * Returns the starting sector index for the active slot
   */
  determineActiveSlot(getCounterSum: (range: number[]) => number): number

  /**
   * Game-specific validation of save file format
   * Returns true if this config can handle the given save data
   */
  canHandle(saveData: Uint8Array): boolean
}
