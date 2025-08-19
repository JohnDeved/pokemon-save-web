/**
 * TypeScript type definitions for Pokemon save file parsing
 * Redesigned with vanilla Emerald as baseline and clean override system
 */

import type { PokemonBase } from './PokemonBase'

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
  readonly party_pokemon: readonly PokemonBase[]
  readonly player_name: string
  readonly play_time: PlayTimeData
  readonly active_slot: number
  readonly sector_map?: ReadonlyMap<number, number> // Undefined for memory mode
  readonly rawSaveData?: Uint8Array | null // Undefined for memory mode
}

// Mapping interfaces for ID translation
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
 * Vanilla Pokemon Emerald configuration (baseline)
 * All offsets and layouts defined here represent the vanilla game structure
 */
export const VANILLA_POKEMON_OFFSETS = {
  // Basic Pokemon data (unencrypted section)
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

export const VANILLA_SAVE_LAYOUT = {
  sectorSize: 4096,
  sectorDataSize: 3968,
  sectorCount: 32,
  slotsPerSave: 18,
  saveBlockSize: 3968 * 4,
  partyOffset: 0x238,
  partyCountOffset: 0x234,
  playTimeHours: 0x0E,
  playTimeMinutes: 0x10,
  playTimeSeconds: 0x11,
  playTimeMilliseconds: 0x12,
}

/**
 * Vanilla Pokemon Emerald game signature
 */
export const VANILLA_EMERALD_SIGNATURE = 0x08012025

/**
 * Type definitions for overridable configurations
 */
export type PokemonOffsetsOverride = {
  readonly [K in keyof typeof VANILLA_POKEMON_OFFSETS]?: number
}

export type SaveLayoutOverride = {
  readonly [K in keyof typeof VANILLA_SAVE_LAYOUT]?: number
}

/**
 * Game configuration interface - minimal overrides only
 * Vanilla Emerald behavior is the default, games only override what's different
 */
export interface GameConfig {
  /** Human-readable name of the Pokemon game/ROM hack */
  readonly name: string

  /** Unique signature for game detection (defaults to vanilla Emerald) */
  readonly signature?: number

  /** Pokemon size in bytes (defaults to 100 for vanilla) */
  readonly pokemonSize: number

  /** Maximum party size (defaults to 6 for vanilla) */
  readonly maxPartySize: number

  /** Offset overrides for games with different data layouts */
  readonly offsetOverrides?: PokemonOffsetsOverride

  /** Save layout overrides for games with different save structures */
  readonly saveLayoutOverrides?: SaveLayoutOverride

  /** Final merged save layout for easy access */
  readonly saveLayout: typeof VANILLA_SAVE_LAYOUT & SaveLayoutOverride

  /** ID mapping data for translating internal IDs to external IDs */
  readonly mappings?: {
    readonly pokemon?: ReadonlyMap<number, PokemonMapping>
    readonly items?: ReadonlyMap<number, ItemMapping>
    readonly moves?: ReadonlyMap<number, MoveMapping>
  }

  /** Check if this config can handle the given save data */
  canHandle(saveData: Uint8Array): boolean

  /** Check if this config can handle memory parsing for the given game title */
  canHandleMemory?(gameTitle: string): boolean

  /** Memory addresses for emulator integration (optional) */
  readonly memoryAddresses?: {
    readonly partyData: number
    readonly partyCount: number
    readonly enemyParty: number
    readonly enemyPartyCount: number
    readonly playerName?: number
    readonly playTime?: number
  }

  readonly preloadRegions?: readonly { address: number; size: number }[]

  // Optional behavioral overrides for game-specific mechanics
  calculateNature?(personality: number): string
  setNature?(data: Uint8Array, view: DataView, value: number): void
  determineActiveSlot?(getCounterSum: (range: number[]) => number): number
  isShiny?(personality: number, otId: number): boolean
  getShinyValue?(personality: number, otId: number): number
  isRadiant?(personality: number, otId: number): boolean

  // Optional data structure overrides (for games with completely different layouts)
  getSpeciesId?(data: Uint8Array, view: DataView): number
  getPokemonName?(data: Uint8Array, view: DataView): string | undefined
  getItem?(data: Uint8Array, view: DataView): number
  getItemName?(data: Uint8Array, view: DataView): string | undefined
  getMove?(data: Uint8Array, view: DataView, index: number): number
  getPP?(data: Uint8Array, view: DataView, index: number): number
  getEV?(data: Uint8Array, view: DataView, index: number): number
  setEV?(data: Uint8Array, view: DataView, index: number, value: number): void
  getIVs?(data: Uint8Array, view: DataView): readonly number[]
  setIVs?(data: Uint8Array, view: DataView, values: readonly number[]): void
}
