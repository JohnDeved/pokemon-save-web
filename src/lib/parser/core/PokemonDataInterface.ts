/**
 * Base interface for Pokemon data across different games
 * Defines common properties that all Pokemon games should support
 */

import type { MoveData } from './types.js'

export interface PokemonDataInterface {
  // Basic Pokemon information
  readonly personality: number
  readonly otId: number
  readonly nicknameRaw: Uint8Array
  readonly otNameRaw: Uint8Array
  readonly speciesId: number
  readonly nameId: string
  readonly level: number
  readonly currentHp: number

  // Items and moves
  readonly item: number
  readonly itemIdName: string
  readonly moveIds: readonly number[]
  readonly ppValues: readonly number[]
  readonly moves: {
    readonly move1: MoveData
    readonly move2: MoveData
    readonly move3: MoveData
    readonly move4: MoveData
  }

  // Stats and nature (writable for modification)
  stats: readonly number[]
  evs: readonly number[]
  ivs: readonly number[]
  natureRaw: number
  readonly totalEVs: number
  readonly totalIVs: number
  readonly natureId: number
  readonly natureModifiers: { readonly increased: number, readonly decreased: number }
  readonly natureModifiersArray: readonly number[]

  // Status and abilities
  readonly status: number
  readonly abilityNumber: number

  // Shiny status (base implementation - games may extend)
  readonly isShiny: boolean

  // Utility methods
  setEvByIndex(statIndex: number, value: number): void
  mapSpeciesToPokeId(speciesId: number): number
  mapSpeciesToNameId(speciesId: number): string
  mapItemToPokeId(itemId: number): number
  mapItemToNameId(itemId: number): string
  mapMoveToPokeId(moveId: number): number
  mapMoveToNameId(moveId: number): string

  // Individual stats (writable for modification)
  maxHp: number
  attack: number
  defense: number
  speed: number
  spAttack: number
  spDefense: number

  // Individual EVs (writable for modification)
  hpEV: number
  atkEV: number
  defEV: number
  speEV: number
  spaEV: number
  spdEV: number

  // Individual moves and PP (readonly)
  readonly move1: number
  readonly move2: number
  readonly move3: number
  readonly move4: number
  readonly pp1: number
  readonly pp2: number
  readonly pp3: number
  readonly pp4: number
}

/**
 * Extended interface for Pokemon games that support radiant Pokemon (like Quetzal)
 */
export interface RadiantPokemonDataInterface extends PokemonDataInterface {
  readonly isRadiant: boolean
  readonly shinyNumber: number
}