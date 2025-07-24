/**
 * Quetzal-specific Pokemon data implementation
 * Handles Quetzal's unencrypted data format and unique features like radiant Pokemon
 */

import { BasePokemonData } from '../../core/BasePokemonData.js'
import type { RadiantPokemonDataInterface } from '../../core/PokemonDataInterface.js'
import type { GameConfig } from '../../configs/GameConfig.js'

export class QuetzalPokemonData extends BasePokemonData implements RadiantPokemonDataInterface {
  constructor (data: Uint8Array, config: GameConfig) {
    super(data, config)
  }

  /**
   * Quetzal-specific IV reading (unencrypted, packed format)
   * IVs are stored as 5 bits each in a 32-bit integer
   */
  get ivs (): readonly number[] {
    const ivData = this.view.getUint32(this.config.offsets.pokemonData.ivData)
    return Array.from({ length: 6 }, (_, i) => (ivData >>> (i * 5)) & 0x1F)
  }

  set ivs (values: readonly number[]) {
    if (values.length !== 6) throw new Error('IVs array must have 6 values')
    let packed = 0
    for (let i = 0; i < 6; i++) {
      packed |= (values[i]! & 0x1F) << (i * 5)
    }
    this.view.setUint32(this.config.offsets.pokemonData.ivData, packed)
  }

  /**
   * Quetzal-specific shiny calculation
   * Uses the 2nd byte of personality to determine shininess
   */
  get shinyNumber (): number {
    return (this.personality >> 8) & 0xFF
  }

  get isShiny (): boolean {
    return this.shinyNumber === 1
  }

  /**
   * Quetzal-specific feature: Radiant Pokemon
   * Radiant Pokemon are indicated by shinyNumber === 2
   */
  get isRadiant (): boolean {
    return this.shinyNumber === 2
  }
}