/**
 * Vanilla Pokemon Emerald configuration stub
 * Provides basic configuration for vanilla Pokemon Emerald saves
 * This is a minimal example implementation
 */

import type { GameConfig, ItemMapping, MoveMapping, PokemonMapping } from '../../core/types'
import { BasePokemonData } from '../../core/pokemonData'

/**
 * Vanilla Pokemon Emerald data implementation
 * Handles encrypted Pokemon data and standard Gen 3 shiny calculation
 */
class VanillaPokemonData extends BasePokemonData {
  private get encryptionKey (): number {
    // Standard Pokemon encryption key: personality XOR OT ID
    return this.personality ^ this.otId
  }

  get ivs (): readonly number[] {
    // Vanilla Pokemon Emerald uses encrypted IV data
    const encrypted = this.view.getUint32(this.config.offsets.pokemonData.ivData, true)
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
    this.view.setUint32(this.config.offsets.pokemonData.ivData, encrypted, true)
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

export class VanillaConfig implements GameConfig {
  readonly name = 'Pokemon Emerald (Vanilla)'
  readonly signature = 0x08012025 // Same as Quetzal for Emerald base

  readonly offsets = {
    sectorSize: 4096,
    sectorDataSize: 3968,
    sectorFooterSize: 12,
    saveblock1Size: 3968 * 4, // SECTOR_DATA_SIZE * 4
    sectorsPerSlot: 18,
    totalSectors: 32,
    partyStartOffset: 0x234, // Different from Quetzal - vanilla Emerald offset
    partyPokemonSize: 104,
    maxPartySize: 6,
    pokemonNicknameLength: 10,
    pokemonTrainerNameLength: 7,
    playTimeHours: 0x0E, // Different from Quetzal
    playTimeMinutes: 0x0F, // Different from Quetzal
    playTimeSeconds: 0x10, // Different from Quetzal
    pokemonData: {
      personality: 0x00,
      otId: 0x04,
      nickname: 0x08,
      otName: 0x14,
      currentHp: 0x23,
      species: 0x28,
      item: 0x2A,
      move1: 0x34,
      move2: 0x36,
      move3: 0x38,
      move4: 0x3A,
      pp1: 0x3C,
      pp2: 0x3D,
      pp3: 0x3E,
      pp4: 0x3F,
      hpEV: 0x40,
      atkEV: 0x41,
      defEV: 0x42,
      speEV: 0x43,
      spaEV: 0x44,
      spdEV: 0x45,
      ivData: 0x50,
      status: 0x57,
      level: 0x58,
      maxHp: 0x5A,
      attack: 0x5C,
      defense: 0x5E,
      speed: 0x60,
      spAttack: 0x62,
      spDefense: 0x64,
    },
  } as const

  readonly mappings = {
    pokemon: this.createPokemonMap(),
    items: this.createItemMap(),
    moves: this.createMoveMap(),
  } as const

  /**
   * Create minimal Pokemon mapping for vanilla Emerald
   * In a real implementation, this would contain the full Gen 3 Pokedex
   */
  private createPokemonMap (): ReadonlyMap<number, PokemonMapping> {
    const map = new Map<number, PokemonMapping>()

    // Add some basic Gen 3 Pokemon as examples
    // In a real implementation, this would be loaded from a separate mapping file
    const basicPokemon: Array<[number, PokemonMapping]> = [
      [1, { name: 'Bulbasaur', id_name: 'bulbasaur', id: 1 }],
      [4, { name: 'Charmander', id_name: 'charmander', id: 4 }],
      [7, { name: 'Squirtle', id_name: 'squirtle', id: 7 }],
      [25, { name: 'Pikachu', id_name: 'pikachu', id: 25 }],
      [252, { name: 'Treecko', id_name: 'treecko', id: 252 }],
      [255, { name: 'Torchic', id_name: 'torchic', id: 255 }],
      [258, { name: 'Mudkip', id_name: 'mudkip', id: 258 }],
    ]

    for (const [id, mapping] of basicPokemon) {
      map.set(id, mapping)
    }

    return map
  }

  /**
   * Create minimal item mapping for vanilla Emerald
   */
  private createItemMap (): ReadonlyMap<number, ItemMapping> {
    const map = new Map<number, ItemMapping>()

    // Add some basic items as examples
    const basicItems: Array<[number, ItemMapping]> = [
      [1, { name: 'Master Ball', id_name: 'master-ball', id: 1 }],
      [2, { name: 'Ultra Ball', id_name: 'ultra-ball', id: 2 }],
      [3, { name: 'Great Ball', id_name: 'great-ball', id: 3 }],
      [4, { name: 'Poke Ball', id_name: 'poke-ball', id: 4 }],
    ]

    for (const [id, mapping] of basicItems) {
      map.set(id, mapping)
    }

    return map
  }

  /**
   * Create minimal move mapping for vanilla Emerald
   */
  private createMoveMap (): ReadonlyMap<number, MoveMapping> {
    const map = new Map<number, MoveMapping>()

    // Add some basic moves as examples
    const basicMoves: Array<[number, MoveMapping]> = [
      [1, { name: 'Pound', id_name: 'pound', id: 1 }],
      [33, { name: 'Tackle', id_name: 'tackle', id: 33 }],
      [45, { name: 'Growl', id_name: 'growl', id: 45 }],
      [52, { name: 'Ember', id_name: 'ember', id: 52 }],
    ]

    for (const [id, mapping] of basicMoves) {
      map.set(id, mapping)
    }

    return map
  }

  /**
   * Create vanilla Emerald-specific Pokemon data instance
   */
  createPokemonData (data: Uint8Array): BasePokemonData {
    return new VanillaPokemonData(data, this)
  }

  /**
   * Vanilla Emerald logic for determining active save slot
   * Uses the same logic as Quetzal since both are based on Emerald
   */
  determineActiveSlot (getCounterSum: (range: number[]) => number): number {
    const slot1Range = Array.from({ length: 18 }, (_, i) => i)
    const slot2Range = Array.from({ length: 18 }, (_, i) => i + 14)
    const slot1Sum = getCounterSum(slot1Range)
    const slot2Sum = getCounterSum(slot2Range)

    return slot2Sum >= slot1Sum ? 14 : 0
  }

  /**
   * Check if this config can handle the given save file
   * For vanilla Emerald, we use heuristics to differentiate from ROM hacks
   */
  canHandle (saveData: Uint8Array): boolean {
    // Basic size check
    if (saveData.length < this.offsets.totalSectors * this.offsets.sectorSize) {
      return false
    }

    // Check for Emerald signature
    let hasValidSignature = false
    for (let i = 0; i < this.offsets.totalSectors; i++) {
      const footerOffset = (i * this.offsets.sectorSize) + this.offsets.sectorSize - this.offsets.sectorFooterSize

      if (footerOffset + this.offsets.sectorFooterSize > saveData.length) {
        continue
      }

      try {
        const view = new DataView(saveData.buffer, saveData.byteOffset + footerOffset, this.offsets.sectorFooterSize)
        const signature = view.getUint32(4, true)

        if (signature === this.signature) {
          hasValidSignature = true
          break
        }
      } catch {
        continue
      }
    }

    if (!hasValidSignature) {
      return false
    }

    // Additional heuristics could be added here to differentiate vanilla from ROM hacks
    // For now, this is a fallback that accepts any Emerald-signature save
    // In practice, this should be the last config tried after specific ROM hacks
    return true
  }
}
