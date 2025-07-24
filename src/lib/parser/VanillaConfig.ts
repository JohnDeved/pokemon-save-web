/**
 * Vanilla Pokemon Emerald configuration stub
 * Provides basic configuration for vanilla Pokemon Emerald saves
 * This is a minimal example implementation
 */

import type { GameConfig, ItemMapping, MoveMapping, PokemonMapping } from './GameConfig.js'

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
  private createPokemonMap(): ReadonlyMap<number, PokemonMapping> {
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
  private createItemMap(): ReadonlyMap<number, ItemMapping> {
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
  private createMoveMap(): ReadonlyMap<number, MoveMapping> {
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
   * Vanilla Emerald logic for determining active save slot
   * Uses the same logic as Quetzal since both are based on Emerald
   */
  determineActiveSlot(getCounterSum: (range: number[]) => number): number {
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
  canHandle(saveData: Uint8Array): boolean {
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