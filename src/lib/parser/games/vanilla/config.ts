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

  // Pokemon data substructure order based on personality
  private getSubstructOrder (): number[] {
    const orderTable = [
      [0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 1, 3], [0, 3, 1, 2], [0, 2, 3, 1], [0, 3, 2, 1],
      [1, 0, 2, 3], [1, 0, 3, 2], [2, 0, 1, 3], [3, 0, 1, 2], [2, 0, 3, 1], [3, 0, 2, 1],
      [1, 2, 0, 3], [1, 3, 0, 2], [2, 1, 0, 3], [3, 1, 0, 2], [2, 3, 0, 1], [3, 2, 0, 1],
      [1, 2, 3, 0], [1, 3, 2, 0], [2, 1, 3, 0], [3, 1, 2, 0], [2, 3, 1, 0], [3, 2, 1, 0],
    ]
    return orderTable[this.personality % 24]!
  }

  // Decrypt and get a specific substruct 
  private getDecryptedSubstruct (substructIndex: number): Uint8Array {
    const order = this.getSubstructOrder()
    const actualIndex = order[substructIndex]!
    const substructOffset = 0x20 + actualIndex * 12 // Each substruct is 12 bytes
    const encryptedData = new Uint8Array(this.data.buffer, this.data.byteOffset + substructOffset, 12)
    const decryptedData = new Uint8Array(12)
    
    // Decrypt in 4-byte chunks
    const key = this.encryptionKey
    for (let i = 0; i < 12; i += 4) {
      const view = new DataView(encryptedData.buffer, encryptedData.byteOffset + i, 4)
      const encrypted = view.getUint32(0, true)
      const decrypted = encrypted ^ key
      
      const decryptedView = new DataView(decryptedData.buffer, i, 4)
      decryptedView.setUint32(0, decrypted, true)
    }
    
    return decryptedData
  }

  // Override species to decrypt from substruct 0
  get speciesId (): number {
    try {
      const substruct0 = this.getDecryptedSubstruct(0) 
      const view = new DataView(substruct0.buffer, substruct0.byteOffset, substruct0.byteLength)
      const rawSpecies = view.getUint16(0, true) // species is first field in substruct 0
      
      // Apply species mapping (internal species -> external species)
      const mappedSpecies = this.config.mappings.pokemon.get(rawSpecies)?.id ?? rawSpecies
      return mappedSpecies
    } catch (error) {
      return 0
    }
  }

  // Override item to decrypt from substruct 0  
  get item (): number {
    try {
      const substruct0 = this.getDecryptedSubstruct(0)
      const view = new DataView(substruct0.buffer, substruct0.byteOffset, substruct0.byteLength)
      return this.mapItemToPokeId(view.getUint16(2, true)) // item is at offset 2 in substruct 0
    } catch {
      return 0
    }
  }

  // Override moves to decrypt from substruct 1
  get move1 (): number {
    return this.getMove(0)
  }

  get move2 (): number {
    return this.getMove(1)
  }

  get move3 (): number {
    return this.getMove(2)
  }

  get move4 (): number {
    return this.getMove(3)
  }

  private getMove (index: number): number {
    try {
      const substruct1 = this.getDecryptedSubstruct(1)
      const view = new DataView(substruct1.buffer, substruct1.byteOffset, substruct1.byteLength)
      return this.mapMoveToPokeId(view.getUint16(index * 2, true))
    } catch {
      return 0
    }
  }

  // Override PP to decrypt from substruct 1
  get pp1 (): number { return this.getPP(0) }
  get pp2 (): number { return this.getPP(1) }
  get pp3 (): number { return this.getPP(2) }
  get pp4 (): number { return this.getPP(3) }

  private getPP (index: number): number {
    try {
      const substruct1 = this.getDecryptedSubstruct(1)
      const view = new DataView(substruct1.buffer, substruct1.byteOffset, substruct1.byteLength)
      return view.getUint8(8 + index) // PP starts at offset 8 in substruct 1
    } catch {
      return 0
    }
  }

  // Override EVs to decrypt from substruct 2
  get hpEV (): number { return this.getEV(0) }
  get atkEV (): number { return this.getEV(1) }
  get defEV (): number { return this.getEV(2) }
  get speEV (): number { return this.getEV(3) }
  get spaEV (): number { return this.getEV(4) }
  get spdEV (): number { return this.getEV(5) }

  private getEV (index: number): number {
    try {
      const substruct2 = this.getDecryptedSubstruct(2)
      return substruct2[index]!
    } catch {
      return 0
    }
  }

  get ivs (): readonly number[] {
    try {
      // IVs are in substruct 3 at offset 4 (after pokerus, metLocation, and metLevel/metGame/pokeball/otGender)
      const substruct3 = this.getDecryptedSubstruct(3)
      const view = new DataView(substruct3.buffer, substruct3.byteOffset, substruct3.byteLength)
      const ivData = view.getUint32(4, true)

      // Extract IVs (5 bits each, 6 IVs total)
      return [
        (ivData >> 0) & 0x1F,  // HP
        (ivData >> 5) & 0x1F,  // Attack
        (ivData >> 10) & 0x1F, // Defense
        (ivData >> 15) & 0x1F, // Speed
        (ivData >> 20) & 0x1F, // Sp. Attack
        (ivData >> 25) & 0x1F, // Sp. Defense
      ]
    } catch {
      return [0, 0, 0, 0, 0, 0]
    }
  }

  set ivs (values: readonly number[]) {
    try {
      if (values.length !== 6) throw new Error('IVs array must have 6 values')
      
      let packed = 0
      for (let i = 0; i < 6; i++) {
        packed |= (values[i]! & 0x1F) << (i * 5)
      }

      // This would require re-encrypting the substruct, which is complex
      // For now, we'll leave this as a placeholder
      console.warn('Setting IVs on vanilla Pokemon is not yet implemented')
    } catch (error) {
      console.warn('Failed to set IVs:', error)
    }
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

  // Helper function for mapping (inherited from base class)
  private mapItemToPokeId (itemId: number): number {
    const mapped = this.config.mappings.items.get(itemId)?.id
    return mapped ?? itemId
  }

  private mapMoveToPokeId (moveId: number): number {
    const mapped = this.config.mappings.moves.get(moveId)?.id
    return mapped ?? moveId
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
    partyStartOffset: 0x238, // Actual party data offset in SaveBlock1 (0x234 is party count)
    partyPokemonSize: 100, // sizeof(struct Pokemon) = 100 bytes in vanilla Emerald  
    maxPartySize: 6,
    pokemonNicknameLength: 10,
    pokemonTrainerNameLength: 7,
    playTimeHours: 0x0E, // u16 playTimeHours in SaveBlock2
    playTimeMinutes: 0x10, // u8 playTimeMinutes in SaveBlock2  
    playTimeSeconds: 0x11, // u8 playTimeSeconds in SaveBlock2
    pokemonData: {
      // BoxPokemon part (first 80 bytes)
      personality: 0x00,     // u32 personality
      otId: 0x04,           // u32 otId 
      nickname: 0x08,       // u8 nickname[10] 
      otName: 0x14,         // u8 otName[7] (offset 20 decimal)
      // Species and other data are encrypted in substructs - need different approach
      species: 0x20,        // In encrypted substruct - placeholder for now
      item: 0x22,           // In encrypted substruct - placeholder for now
      move1: 0x24,          // In encrypted substruct - placeholder for now
      move2: 0x26,          // In encrypted substruct - placeholder for now  
      move3: 0x28,          // In encrypted substruct - placeholder for now
      move4: 0x2A,          // In encrypted substruct - placeholder for now
      pp1: 0x2C,            // In encrypted substruct - placeholder for now
      pp2: 0x2D,            // In encrypted substruct - placeholder for now
      pp3: 0x2E,            // In encrypted substruct - placeholder for now
      pp4: 0x2F,            // In encrypted substruct - placeholder for now
      hpEV: 0x30,           // In encrypted substruct - placeholder for now
      atkEV: 0x31,          // In encrypted substruct - placeholder for now
      defEV: 0x32,          // In encrypted substruct - placeholder for now  
      speEV: 0x33,          // In encrypted substruct - placeholder for now
      spaEV: 0x34,          // In encrypted substruct - placeholder for now
      spdEV: 0x35,          // In encrypted substruct - placeholder for now
      ivData: 0x36,         // In encrypted substruct - placeholder for now
      // Pokemon struct part (last 20 bytes)
      status: 0x50,         // u32 status (offset 80)
      level: 0x54,          // u8 level (offset 84)
      currentHp: 0x56,      // u16 hp (offset 86)
      maxHp: 0x58,          // u16 maxHP (offset 88)
      attack: 0x5A,         // u16 attack (offset 90)
      defense: 0x5C,        // u16 defense (offset 92)
      speed: 0x5E,          // u16 speed (offset 94)
      spAttack: 0x60,       // u16 spAttack (offset 96)
      spDefense: 0x62,      // u16 spDefense (offset 98)
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
      [277, { name: 'Treecko', id_name: 'treecko', id: 252 }], // 277 maps to Treecko (252)
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

    // Add moves referenced in ground truth
    const basicMoves: Array<[number, MoveMapping]> = [
      [1, { name: 'Pound', id_name: 'pound', id: 1 }],
      [33, { name: 'Tackle', id_name: 'tackle', id: 33 }],
      [43, { name: 'Leer', id_name: 'leer', id: 43 }],
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
   * Corrected to use non-overlapping sector ranges
   */
  determineActiveSlot (getCounterSum: (range: number[]) => number): number {
    // Slot 1: sectors 0-13 (14 sectors)
    // Slot 2: sectors 14-31 (18 sectors) 
    const slot1Range = Array.from({ length: 14 }, (_, i) => i)
    const slot2Range = Array.from({ length: 18 }, (_, i) => i + 14)
    const slot1Sum = getCounterSum(slot1Range)
    const slot2Sum = getCounterSum(slot2Range)

    return slot2Sum > slot1Sum ? 14 : 0
  }

  /**
   * Check if this config can handle the given save file
   * For vanilla Emerald, we act as a fallback after ROM hack detection
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

    // Vanilla Emerald: Accept any valid Emerald save that doesn't have ROM hack features
    // Since this config comes after ROM hack configs in the registry, it acts as a fallback
    try {
      const activeSlot = this.determineActiveSlot((sectors: number[]) => {
        let sum = 0
        for (const sectorIndex of sectors) {
          const footerOffset = (sectorIndex * this.offsets.sectorSize) + this.offsets.sectorSize - this.offsets.sectorFooterSize
          if (footerOffset + this.offsets.sectorFooterSize <= saveData.length) {
            const view = new DataView(saveData.buffer, saveData.byteOffset + footerOffset, this.offsets.sectorFooterSize)
            const signature = view.getUint32(4, true)
            if (signature === this.signature) {
              sum += view.getUint16(8, true) // counter
            }
          }
        }
        return sum
      })

      // Basic validation: check if we can parse the save structure
      const saveBlock1Offset = activeSlot * this.offsets.sectorSize
      
      // Check if SaveBlock2 data looks reasonable
      const slot2Offset = activeSlot === 0 ? 14 * this.offsets.sectorSize : 0
      const playTimeOffset = slot2Offset + this.offsets.playTimeHours
      if (playTimeOffset + 4 <= saveData.length) {
        const view = new DataView(saveData.buffer, saveData.byteOffset + playTimeOffset, 4)
        const hours = view.getUint16(0, true)
        const minutes = view.getUint8(2)
        
        // Reasonable play time validation (not corrupted data)
        if (hours <= 9999 && minutes <= 59) {
          return true // Valid vanilla Emerald save
        }
      }
    } catch {
      // If any parsing error occurs, reject this save
      return false
    }

    return false
  }
}
