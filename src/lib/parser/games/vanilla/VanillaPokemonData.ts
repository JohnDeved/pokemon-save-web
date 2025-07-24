/**
 * Vanilla Pokemon Emerald data implementation
 * Handles encrypted Pokemon data format and standard shiny calculation
 */

import { BasePokemonData } from '../../core/BasePokemonData.js'
import type { PokemonDataInterface } from '../../core/PokemonDataInterface.js'
import type { GameConfig } from '../../configs/GameConfig.js'

export class VanillaPokemonData extends BasePokemonData implements PokemonDataInterface {
  private encryptionKey: number

  constructor (data: Uint8Array, config: GameConfig) {
    super(data, config)
    // Calculate encryption key from personality and OT ID
    this.encryptionKey = this.personality ^ this.otId
  }

  /**
   * Decrypt a 32-bit value using the Pokemon's encryption key
   */
  private decrypt32 (value: number): number {
    return value ^ this.encryptionKey
  }

  /**
   * Encrypt a 32-bit value using the Pokemon's encryption key
   */
  private encrypt32 (value: number): number {
    return value ^ this.encryptionKey
  }

  /**
   * Vanilla Emerald IV reading (encrypted format)
   * IVs are stored encrypted in the same packed format but need decryption
   */
  get ivs (): readonly number[] {
    const encryptedIvData = this.view.getUint32(this.config.offsets.pokemonData.ivData)
    const ivData = this.decrypt32(encryptedIvData)
    return Array.from({ length: 6 }, (_, i) => (ivData >>> (i * 5)) & 0x1F)
  }

  set ivs (values: readonly number[]) {
    if (values.length !== 6) throw new Error('IVs array must have 6 values')
    let packed = 0
    for (let i = 0; i < 6; i++) {
      packed |= (values[i]! & 0x1F) << (i * 5)
    }
    const encrypted = this.encrypt32(packed)
    this.view.setUint32(this.config.offsets.pokemonData.ivData, encrypted)
  }

  /**
   * Vanilla Pokemon shiny calculation
   * Uses the standard algorithm: (trainerId ^ secretId ^ (personality & 0xFFFF) ^ (personality >> 16)) < 8
   * 
   * Note: This is a simplified implementation. In a real implementation, we would need access to
   * the trainer's secret ID from the save file, which is stored elsewhere in the save data.
   * For now, we'll use a placeholder implementation.
   */
  get isShiny (): boolean {
    // Placeholder implementation - in reality we'd need the trainer's secret ID
    // from the save file to properly calculate shininess
    const trainerId = this.otId & 0xFFFF
    const secretId = (this.otId >> 16) & 0xFFFF // This is a simplification
    const personalityLow = this.personality & 0xFFFF
    const personalityHigh = (this.personality >> 16) & 0xFFFF
    
    const shinyValue = trainerId ^ secretId ^ personalityLow ^ personalityHigh
    return shinyValue < 8
  }

  /**
   * Override encrypted field getters to handle decryption
   * In vanilla Emerald, certain fields are encrypted and need to be decrypted
   */
  
  // Override species ID getter to handle encryption (if needed in vanilla)
  get speciesId (): number {
    const rawSpeciesId = this.view.getUint16(this.config.offsets.pokemonData.speciesId)
    // In this simplified implementation, we assume species ID is not encrypted
    // In a full implementation, you might need to decrypt based on the data substructure
    return this.mapSpeciesToPokeId(rawSpeciesId)
  }

  // Override item getter to handle encryption (if needed in vanilla)
  get item (): number {
    const rawItemId = this.view.getUint16(this.config.offsets.pokemonData.item)
    // In this simplified implementation, we assume item ID is not encrypted
    // In a full implementation, you might need to decrypt based on the data substructure
    return this.mapItemToPokeId(rawItemId)
  }

  // Note: In a complete vanilla implementation, you would need to:
  // 1. Implement the full Pokemon data substructure system (growth, attacks, EVs/condition, misc)
  // 2. Handle data shuffling based on personality value
  // 3. Decrypt each substructure using the appropriate key
  // 4. Access the trainer's secret ID from the save file for proper shiny calculation
  // 
  // This is a simplified implementation focusing on the architecture rather than
  // complete vanilla compatibility.
}