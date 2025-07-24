/**
 * GameConfig interface for dependency injection
 * Defines the contract for game-specific parsing configuration
 */

// Import types from core module
import type { MoveData, PokemonMoves } from '../core/types.js'

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

// Forward declaration for PokemonDataInterface
export interface PokemonDataInterface {
  // Core identification
  readonly personality: number
  readonly otId: number
  readonly otId_str: string
  readonly speciesId: number
  readonly nameId: string | undefined
  readonly level: number
  readonly nickname: string
  readonly otName: string
  readonly rawBytes: Uint8Array

  // Health and status
  readonly currentHp: number
  readonly maxHp: number
  readonly status: number

  // Items and moves
  readonly item: number
  readonly itemIdName: string | undefined
  readonly moveIds: readonly number[]
  readonly ppValues: readonly number[]
  readonly moves: {
    readonly move1: MoveData
    readonly move2: MoveData
    readonly move3: MoveData
    readonly move4: MoveData
  }
  readonly moves_data: PokemonMoves

  // Individual move access (for compatibility)
  readonly move1: number
  readonly move2: number
  readonly move3: number
  readonly move4: number
  readonly pp1: number
  readonly pp2: number
  readonly pp3: number
  readonly pp4: number

  // Combat stats
  readonly stats: readonly number[]
  readonly attack: number
  readonly defense: number
  readonly speed: number
  readonly spAttack: number
  readonly spDefense: number

  // Training values
  readonly evs: readonly number[]
  readonly ivs: readonly number[]
  readonly totalEVs: number
  readonly totalIVs: number

  // Individual EV access (for compatibility)
  readonly hpEV: number
  readonly atkEV: number
  readonly defEV: number
  readonly speEV: number
  readonly spaEV: number
  readonly spdEV: number

  // Nature and characteristics
  readonly nature: string
  readonly natureRaw: number
  readonly natureModifiers: { increased: number, decreased: number }
  readonly natureModifiersString: { increased: string, decreased: string }
  readonly natureModifiersArray: readonly number[]
  readonly abilityNumber: number

  // Special properties (game-specific)
  readonly isShiny: boolean
  readonly shinyNumber: number
  readonly isRadiant: boolean // Meaningful only in games like Quetzal

  // Mutation methods
  setStats(values: readonly number[]): void
  setEvs(values: readonly number[]): void
  setIvs(values: readonly number[]): void
  setEvByIndex(statIndex: number, value: number): void
  setIvByIndex(statIndex: number, value: number): void
  setNatureRaw(value: number): void
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
    readonly pokemonData: {
      readonly personality: number
      readonly otId: number
      readonly nickname: number
      readonly otName: number
      readonly currentHp: number
      readonly species: number
      readonly item: number
      readonly move1: number
      readonly move2: number
      readonly move3: number
      readonly move4: number
      readonly pp1: number
      readonly pp2: number
      readonly pp3: number
      readonly pp4: number
      readonly hpEV: number
      readonly atkEV: number
      readonly defEV: number
      readonly speEV: number
      readonly spaEV: number
      readonly spdEV: number
      readonly ivData: number
      readonly status: number
      readonly level: number
      readonly maxHp: number
      readonly attack: number
      readonly defense: number
      readonly speed: number
      readonly spAttack: number
      readonly spDefense: number
    }
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

  /**
   * Factory method to create game-specific Pokemon data instances
   * This allows each game to implement its own Pokemon data parsing logic
   */
  createPokemonData(data: Uint8Array): PokemonDataInterface
}
