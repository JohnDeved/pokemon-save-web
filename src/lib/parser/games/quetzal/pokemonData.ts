/**
 * Quetzal-specific Pokemon data implementation
 * Handles Quetzal's unencrypted IVs and custom shiny system
 */

import { BasePokemonData } from '../../core/pokemonData.js'

export class QuetzalPokemonData extends BasePokemonData {
  get ivData () { return this.view.getUint32(this.config.offsets.pokemonData.ivData) }
  set ivData (value) { this.view.setUint32(this.config.offsets.pokemonData.ivData, value) }

  get ivs (): readonly number[] {
    // Quetzal uses unencrypted IV data
    return Array.from({ length: 6 }, (_, i) => (this.ivData >>> (i * 5)) & 0x1F)
  }

  set ivs (values: readonly number[]) {
    if (values.length !== 6) throw new Error('IVs array must have 6 values')
    let packed = 0
    for (let i = 0; i < 6; i++) {
      packed |= (values[i]! & 0x1F) << (i * 5)
    }
    this.ivData = packed
  }

  get shinyNumber (): number {
    // Quetzal-specific: the 2nd byte of personality determines shininess
    return (this.personality >> 8) & 0xFF
  }

  get isShiny (): boolean {
    return this.shinyNumber === 1
  }

  get isRadiant (): boolean {
    // Quetzal-specific feature: radiant Pokemon
    return this.shinyNumber === 2
  }
}
