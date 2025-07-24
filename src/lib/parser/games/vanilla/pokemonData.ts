/**
 * Vanilla Pokemon Emerald data implementation
 * Handles encrypted Pokemon data and standard Gen 3 shiny calculation
 */

import { BasePokemonData } from '../../core/pokemonData.js'

export class VanillaPokemonData extends BasePokemonData {
  private get encryptionKey (): number {
    // Standard Pokemon encryption key: personality XOR OT ID
    return this.personality ^ this.otId
  }

  get ivs (): readonly number[] {
    // Vanilla Pokemon Emerald uses encrypted IV data
    const encrypted = this.view.getUint32(this.config.offsets.pokemonData.ivData)
    const decrypted = encrypted ^ this.encryptionKey
    return Array.from({ length: 6 }, (_, i) => (decrypted >>> (i * 5)) & 0x1F)
  }

  set ivs (values: readonly number[]) {
    if (values.length !== 6) throw new Error('IVs array must have 6 values')
    let packed = 0
    for (let i = 0; i < 6; i++) {
      packed |= (values[i]! & 0x1F) << (i * 5)
    }
    // Encrypt the data before storing
    const encrypted = packed ^ this.encryptionKey
    this.view.setUint32(this.config.offsets.pokemonData.ivData, encrypted)
  }

  get shinyNumber (): number {
    // Standard Gen 3 shiny calculation
    const trainerId = this.otId & 0xFFFF
    const secretId = (this.otId >> 16) & 0xFFFF
    const personalityLow = this.personality & 0xFFFF
    const personalityHigh = (this.personality >> 16) & 0xFFFF
    return trainerId ^ secretId ^ personalityLow ^ personalityHigh
  }

  get isShiny (): boolean {
    // Standard Gen 3: Pokemon is shiny if shiny value < 8
    return this.shinyNumber < 8
  }

  // eslint-disable-next-line @typescript-eslint/class-literal-property-style
  get isRadiant (): boolean {
    // Vanilla Pokemon don't have radiant status
    return false
  }
}
