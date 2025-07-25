/**
 * Common interfaces for game configuration mappings
 */

import type { ItemMapping, MoveMapping, PokemonMapping } from './types'

/**
 * Interface for configs that provide ID mappings
 */
export interface MappingProvider {
  readonly mappings: {
    readonly pokemon: Map<number, PokemonMapping>
    readonly moves: Map<number, MoveMapping>
    readonly items: Map<number, ItemMapping>
  }
}

/**
 * Interface for configs that can detect save files
 */
export interface SaveDetector {
  canHandle (saveData: Uint8Array): boolean
}

/**
 * Interface for configs that provide custom data access
 */
export interface DataAccessProvider {
  getSpeciesId? (data: Uint8Array, view: DataView): number
  getPokemonName? (data: Uint8Array, view: DataView): string | undefined
  getItem? (data: Uint8Array, view: DataView): number
  getItemName? (data: Uint8Array, view: DataView): string | undefined
  getMove? (data: Uint8Array, view: DataView, index: number): number
  getPP? (data: Uint8Array, view: DataView, index: number): number
  getEV? (data: Uint8Array, view: DataView, index: number): number
  setEV? (data: Uint8Array, view: DataView, index: number, value: number): void
  getIVs? (data: Uint8Array, view: DataView): readonly number[]
  setIVs? (data: Uint8Array, view: DataView, values: readonly number[]): void
}
