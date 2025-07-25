/**
 * TypeScript type definitions for Pokemon save file parsing
 * Port of poke_types.py with modern TypeScript features
 */

import type { BasePokemonData } from './pokemonData'

// Core data structures
export interface PlayTimeData {
  hours: number
  minutes: number
  seconds: number
}

export interface PokemonStats {
  readonly hp: number
  readonly attack: number
  readonly defense: number
  readonly speed: number
  readonly sp_attack: number
  readonly sp_defense: number
}

export interface MoveData {
  readonly id: number
  readonly pp: number
}

export interface PokemonMoves {
  readonly move1: MoveData
  readonly move2: MoveData
  readonly move3: MoveData
  readonly move4: MoveData
}

export interface PokemonEVs {
  readonly hp: number
  readonly attack: number
  readonly defense: number
  readonly speed: number
  readonly sp_attack: number
  readonly sp_defense: number
}

export interface PokemonIVs {
  readonly hp: number
  readonly attack: number
  readonly defense: number
  readonly speed: number
  readonly sp_attack: number
  readonly sp_defense: number
}

// Sector information
export interface SectorInfo {
  readonly id: number
  readonly checksum: number
  readonly counter: number
  readonly valid: boolean
}

// Complete save data structure
export interface SaveData {
  readonly party_pokemon: readonly BasePokemonData[]
  readonly player_name: string
  readonly play_time: PlayTimeData
  readonly active_slot: number
  readonly sector_map: ReadonlyMap<number, number>
  readonly rawSaveData: Uint8Array // Add raw save data for rehydration
}

// GameConfig interfaces for dependency injection

// Simplified mapping interfaces using inheritance
interface BaseMapping {
  readonly name: string
  readonly id_name: string
}

export interface PokemonMapping extends BaseMapping {
  readonly id: number
}

export interface ItemMapping extends BaseMapping {
  readonly id: number | null // Allow null for unmapped items
}

export interface MoveMapping extends BaseMapping {
  readonly id: number | null // Allow null for unmapped moves
}

// Modern layout structure with logical groupings
interface GameLayout {
  // Save file structure
  readonly sectors: {
    readonly size: number
    readonly dataSize: number
    readonly footerSize: number
    readonly totalCount: number
    readonly perSlot: number
  }

  // Save blocks
  readonly saveBlocks: {
    readonly block1Size: number
  }

  // Party configuration
  readonly party: {
    readonly dataOffset: number
    readonly pokemonSize: number
    readonly maxSize: number
  }

  // Player data
  readonly player: {
    readonly playTimeHours: number
    readonly playTimeMinutes: number
    readonly playTimeSeconds: number
  }

  // Pokemon data field layout
  readonly pokemon: {
    readonly personality: number
    readonly otId: number
    readonly species: number
    readonly item: number
    readonly nickname: {
      readonly offset: number
      readonly length: number
    }
    readonly otName: {
      readonly offset: number
      readonly length: number
    }
    readonly currentHp: number
    readonly maxHp: number
    readonly attack: number
    readonly defense: number
    readonly speed: number
    readonly spAttack: number
    readonly spDefense: number
    readonly status: number
    readonly level: number
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
  }
}

// Translation functions for ID mapping
interface GameTranslations {
  readonly translatePokemonId?: (rawId: number) => number
  readonly translateItemId?: (rawId: number) => number | null
  readonly translateMoveId?: (rawId: number) => number | null
  readonly translatePokemonName?: (rawId: number) => string | undefined
  readonly translateItemName?: (rawId: number) => string | undefined
  readonly translateMoveName?: (rawId: number) => string | undefined
}

/**
 * Modern GameConfig interface with improved type safety and organization
 * Provides game-specific configurations through dependency injection
 */
export interface GameConfig {
  /** Human-readable name of the Pokemon game/ROM hack */
  readonly name: string

  /** Unique signature for game detection */
  readonly signature: number

  /** Memory layout for save file parsing */
  readonly layout: GameLayout

  /** Translation functions for ID mapping (optional) */
  readonly translations: GameTranslations

  /** Determine which save slot is currently active */
  determineActiveSlot(getCounterSum: (range: number[]) => number): number

  /** Check if this config can handle the given save data */
  canHandle(saveData: Uint8Array): boolean

  /** Create game-specific Pokemon data instance */
  createPokemonData(data: Uint8Array): BasePokemonData

  /** Calculate nature from personality value (varies by game) */
  calculateNature(personality: number): string
}
