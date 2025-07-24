/**
 * GameConfig interface for dependency injection
 * Uses type inference to reduce boilerplate and improve maintainability
 */

// Import types from core module for move data
import type { MoveData, PokemonMoves } from '../core/types.js'

// Infer mapping types from actual JSON data structures
interface JsonMapping { readonly name: string, readonly id_name: string, readonly id: number }
export interface PokemonMapping extends JsonMapping {}
export interface ItemMapping { readonly name: string, readonly id_name: string, readonly id: number | null } // Allow null for unmapped items
export interface MoveMapping { readonly name: string, readonly id_name: string, readonly id: number | null } // Allow null for unmapped moves

// Infer PokemonDataInterface from implementations - will be set by first concrete class
export interface PokemonDataInterface {
  // Core properties - inferred from actual usage patterns
  readonly personality: number
  readonly otId: number
  readonly otId_str: string
  readonly speciesId: number
  readonly nameId: string | undefined
  readonly level: number
  readonly nickname: string
  readonly otName: string
  readonly rawBytes: Uint8Array
  readonly currentHp: number
  readonly maxHp: number
  readonly status: number
  readonly item: number
  readonly itemIdName: string | undefined
  readonly moveIds: readonly number[]
  readonly ppValues: readonly number[]
  readonly moves: { readonly move1: MoveData, readonly move2: MoveData, readonly move3: MoveData, readonly move4: MoveData }
  readonly moves_data: PokemonMoves

  // Individual access for compatibility
  readonly move1: number
  readonly move2: number
  readonly move3: number
  readonly move4: number
  readonly pp1: number
  readonly pp2: number
  readonly pp3: number
  readonly pp4: number
  readonly stats: readonly number[]
  readonly attack: number
  readonly defense: number
  readonly speed: number
  readonly spAttack: number
  readonly spDefense: number
  readonly evs: readonly number[]
  readonly ivs: readonly number[]
  readonly totalEVs: number
  readonly totalIVs: number
  readonly hpEV: number
  readonly atkEV: number
  readonly defEV: number
  readonly speEV: number
  readonly spaEV: number
  readonly spdEV: number
  readonly nature: string
  readonly natureRaw: number
  readonly natureModifiers: { increased: number, decreased: number }
  readonly natureModifiersString: { increased: string, decreased: string }
  readonly natureModifiersArray: readonly number[]
  readonly abilityNumber: number
  readonly isShiny: boolean
  readonly shinyNumber: number
  readonly isRadiant: boolean

  // Mutation methods
  setStats(values: readonly number[]): void
  setEvs(values: readonly number[]): void
  setIvs(values: readonly number[]): void
  setEvByIndex(statIndex: number, value: number): void
  setIvByIndex(statIndex: number, value: number): void
  setNatureRaw(value: number): void
}

// Infer offset structure from concrete implementations - much more maintainable
interface GameOffsets {
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

// Simplified mappings interface
interface GameMappings {
  readonly pokemon: ReadonlyMap<number, PokemonMapping>
  readonly items: ReadonlyMap<number, ItemMapping>
  readonly moves: ReadonlyMap<number, MoveMapping>
}

/**
 * Streamlined GameConfig interface using type inference
 * Lets concrete implementations drive the types instead of defining everything upfront
 */
export interface GameConfig {
  readonly name: string
  readonly signature: number
  readonly offsets: GameOffsets
  readonly mappings: GameMappings

  // Essential game-specific methods
  determineActiveSlot(getCounterSum: (range: number[]) => number): number
  canHandle(saveData: Uint8Array): boolean
  createPokemonData(data: Uint8Array): PokemonDataInterface
}
