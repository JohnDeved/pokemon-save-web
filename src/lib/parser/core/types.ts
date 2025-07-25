/**
 * TypeScript type definitions for Pokemon save file parsing
 * Port of poke_types.py with modern TypeScript features
 */

import type { PokemonData } from './pokemonData'

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
  readonly party_pokemon: readonly PokemonData[]
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

/**
 * Simplified Pokemon offsets structure
 * Based on vanilla Emerald memory layout
 */
export interface PokemonOffsets {
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

/**
 * Save file layout structure
 */
export interface SaveLayout {
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
 * Modern GameConfig interface with improved type safety and organization
 * Provides game-specific configurations through dependency injection
 */
export interface GameConfig {
  /** Human-readable name of the Pokemon game/ROM hack */
  readonly name: string

  /** Unique signature for game detection */
  readonly signature: number

  /** Pokemon size in bytes */
  readonly pokemonSize: number

  /** Basic offsets for unencrypted data */
  readonly offsets: PokemonOffsets

  /** Save file layout configuration */
  readonly saveLayout: SaveLayout

  /** Determine which save slot is currently active */
  determineActiveSlot(getCounterSum: (range: number[]) => number): number

  /** Check if this config can handle the given save data */
  canHandle(saveData: Uint8Array): boolean

  /** Calculate nature from personality value (varies by game) */
  calculateNature(personality: number): string

  // Game-specific data access methods
  getSpeciesId(data: Uint8Array, view: DataView): number
  getPokemonName(data: Uint8Array, view: DataView): string | undefined
  getItem(data: Uint8Array, view: DataView): number
  getItemName(data: Uint8Array, view: DataView): string | undefined
  getMove(data: Uint8Array, view: DataView, index: number): number
  getPP(data: Uint8Array, view: DataView, index: number): number
  getEV(data: Uint8Array, view: DataView, index: number): number
  setEV(data: Uint8Array, view: DataView, index: number, value: number): void
  getIVs(data: Uint8Array, view: DataView): readonly number[]
  setIVs(data: Uint8Array, view: DataView, values: readonly number[]): void
  getIsShiny(data: Uint8Array, view: DataView): boolean
  getShinyNumber(data: Uint8Array, view: DataView): number
  getIsRadiant(data: Uint8Array, view: DataView): boolean
}
