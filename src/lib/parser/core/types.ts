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

// Modern offset structure with logical groupings
interface GameOffsets {
  // Save file structure
  readonly sectorSize: number
  readonly sectorDataSize: number
  readonly sectorFooterSize: number
  readonly saveblock1Size: number
  readonly sectorsPerSlot: number
  readonly totalSectors: number

  // Party configuration
  readonly partyStartOffset: number
  readonly partyPokemonSize: number
  readonly maxPartySize: number

  // String lengths
  readonly pokemonNicknameLength: number
  readonly pokemonTrainerNameLength: number

  // Play time offsets
  readonly playTimeHours: number
  readonly playTimeMinutes: number
  readonly playTimeSeconds: number

  // Pokemon data field offsets
  readonly pokemonData: {
    // Core identification
    readonly personality: number
    readonly otId: number
    readonly species: number
    readonly nickname: number
    readonly otName: number

    // Stats and battle data
    readonly currentHp: number
    readonly maxHp: number
    readonly attack: number
    readonly defense: number
    readonly speed: number
    readonly spAttack: number
    readonly spDefense: number
    readonly status: number
    readonly level: number
    readonly item: number

    // Moves and PP
    readonly move1: number
    readonly move2: number
    readonly move3: number
    readonly move4: number
    readonly pp1: number
    readonly pp2: number
    readonly pp3: number
    readonly pp4: number

    // Training data
    readonly hpEV: number
    readonly atkEV: number
    readonly defEV: number
    readonly speEV: number
    readonly spaEV: number
    readonly spdEV: number
    readonly ivData: number
  }
}

// Simplified mappings interface
interface GameMappings {
  readonly pokemon: ReadonlyMap<number, PokemonMapping>
  readonly items: ReadonlyMap<number, ItemMapping>
  readonly moves: ReadonlyMap<number, MoveMapping>
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

  /** Memory offsets for save file parsing */
  readonly offsets: GameOffsets

  /** ID mappings for Pokemon, items, and moves */
  readonly mappings: GameMappings

  /** Determine which save slot is currently active */
  determineActiveSlot(getCounterSum: (range: number[]) => number): number

  /** Check if this config can handle the given save data */
  canHandle(saveData: Uint8Array): boolean

  /** Create game-specific Pokemon data instance */
  createPokemonData(data: Uint8Array): BasePokemonData
}

// Legacy constants for backward compatibility
// These are now provided via GameConfig dependency injection
export const CONSTANTS = {
  SECTOR_SIZE: 4096,
  SECTOR_DATA_SIZE: 3968,
  SECTOR_FOOTER_SIZE: 12,
  SAVEBLOCK1_SIZE: 3968 * 4, // SECTOR_DATA_SIZE * 4
  EMERALD_SIGNATURE: 0x08012025,
  SECTORS_PER_SLOT: 18,
  TOTAL_SECTORS: 32,
  PARTY_START_OFFSET: 0x6A8,
  PARTY_POKEMON_SIZE: 104,
  MAX_PARTY_SIZE: 6,
  POKEMON_NICKNAME_LENGTH: 10,
  POKEMON_TRAINER_NAME_LENGTH: 7,
} as const

// Helper functions for data creation
export const createMoveData = (id: number, pp: number): MoveData => ({ id, pp })

export const createPokemonMoves = (
  move1_id: number, move2_id: number, move3_id: number, move4_id: number,
  pp1: number, pp2: number, pp3: number, pp4: number,
): PokemonMoves => ({
  move1: createMoveData(move1_id, pp1),
  move2: createMoveData(move2_id, pp2),
  move3: createMoveData(move3_id, pp3),
  move4: createMoveData(move4_id, pp4),
})
