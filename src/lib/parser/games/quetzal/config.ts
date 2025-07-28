/**
 * Quetzal ROM hack configuration
 * Only overrides differences from vanilla Emerald baseline
 */

import type { GameConfig, ItemMapping, MoveMapping, PokemonMapping, PokemonOffsetsOverride, SaveLayoutOverride } from '../../core/types'
import { VANILLA_SAVE_LAYOUT } from '../../core/types'
import { createMapping, natures } from '../../core/utils'
import { GameConfigBase } from '../../core/GameConfigBase'
import itemMapData from './data/item_map.json'
import moveMapData from './data/move_map.json'
import pokemonMapData from './data/pokemon_map.json'

export class QuetzalConfig extends GameConfigBase implements GameConfig {
  readonly name = 'Pokemon Quetzal'

  // Override Pokemon size for Quetzal
  readonly pokemonSize = 104

  // Override offsets for Quetzal's unencrypted structure
  readonly offsetOverrides: PokemonOffsetsOverride = {
    currentHp: 0x23,
    maxHp: 0x5A,
    attack: 0x5C,
    defense: 0x5E,
    speed: 0x60,
    spAttack: 0x62,
    spDefense: 0x64,
    status: 0x57,
    level: 0x58,
  }

  // Override save layout for Quetzal
  readonly saveLayoutOverrides: SaveLayoutOverride = {
    partyOffset: 0x6A8,
    partyCountOffset: 0x6A4,
    pokemonSize: 104,
    playTimeHours: 0x10,
    playTimeMinutes: 0x14,
    playTimeSeconds: 0x15,
  }

  // Merged save layout for easy access
  readonly saveLayout = { ...VANILLA_SAVE_LAYOUT, ...this.saveLayoutOverrides }

  // ID mappings for Quetzal using utility functions
  readonly mappings = {
    pokemon: createMapping<PokemonMapping>(pokemonMapData as Record<string, unknown>),
    items: createMapping<ItemMapping>(itemMapData as Record<string, unknown>),
    moves: createMapping<MoveMapping>(moveMapData as Record<string, unknown>),
  } as const

  // Memory addresses for Quetzal ROM hack
  // These are found through dynamic discovery due to Quetzal's dynamic memory allocation
  readonly memoryAddresses = {
    partyData: 0x2024000, // Base search address - will be dynamically discovered
    partyCount: 0x2023ffc, // Base search address - will be dynamically discovered  
    // TODO: Add player name and play time addresses when implemented
  } as const

  // Quetzal-specific offsets for unencrypted data
  private readonly quetzalOffsets = {
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
  } as const

  // Override data access methods for Quetzal's unencrypted structure
  getSpeciesId (_data: Uint8Array, view: DataView): number {
    const rawSpecies = view.getUint16(this.quetzalOffsets.species, true)
    // Apply ID mapping using the base mapping system
    return this.mappings.pokemon.get(rawSpecies)?.id ?? rawSpecies
  }

  getPokemonName (_data: Uint8Array, view: DataView): string | undefined {
    const rawSpecies = view.getUint16(this.quetzalOffsets.species, true)
    // Apply name mapping using the base mapping system - use id_name for sprite filenames
    return this.mappings.pokemon.get(rawSpecies)?.id_name
  }

  getItem (_data: Uint8Array, view: DataView): number {
    const rawItem = view.getUint16(this.quetzalOffsets.item, true)
    // Apply ID mapping using the base mapping system
    return this.mappings.items.get(rawItem)?.id ?? rawItem
  }

  getItemName (_data: Uint8Array, view: DataView): string | undefined {
    const rawItem = view.getUint16(this.quetzalOffsets.item, true)
    // Apply name mapping using the base mapping system
    return this.mappings.items.get(rawItem)?.id_name
  }

  getMove (_data: Uint8Array, view: DataView, index: number): number {
    const moveOffsets = [this.quetzalOffsets.move1, this.quetzalOffsets.move2, this.quetzalOffsets.move3, this.quetzalOffsets.move4]
    const rawMove = view.getUint16(moveOffsets[index]!, true)
    // Apply ID mapping using the base mapping system
    return this.mappings.moves.get(rawMove)?.id ?? rawMove
  }

  getPP (_data: Uint8Array, view: DataView, index: number): number {
    const ppOffsets = [this.quetzalOffsets.pp1, this.quetzalOffsets.pp2, this.quetzalOffsets.pp3, this.quetzalOffsets.pp4]
    return view.getUint8(ppOffsets[index]!)
  }

  getEV (_data: Uint8Array, view: DataView, index: number): number {
    const evOffsets = [this.quetzalOffsets.hpEV, this.quetzalOffsets.atkEV, this.quetzalOffsets.defEV, this.quetzalOffsets.speEV, this.quetzalOffsets.spaEV, this.quetzalOffsets.spdEV]
    return view.getUint8(evOffsets[index]!)
  }

  setEV (_data: Uint8Array, view: DataView, index: number, value: number): void {
    const evOffsets = [this.quetzalOffsets.hpEV, this.quetzalOffsets.atkEV, this.quetzalOffsets.defEV, this.quetzalOffsets.speEV, this.quetzalOffsets.spaEV, this.quetzalOffsets.spdEV]
    const clampedValue = Math.max(0, Math.min(255, value))
    view.setUint8(evOffsets[index]!, clampedValue)
  }

  getIVs (_data: Uint8Array, view: DataView): readonly number[] {
    const ivData = view.getUint32(this.quetzalOffsets.ivData, true)
    return Array.from({ length: 6 }, (_, i) => (ivData >>> (i * 5)) & 0x1F)
  }

  setIVs (_data: Uint8Array, view: DataView, values: readonly number[]): void {
    if (values.length !== 6) throw new Error('IVs array must have 6 values')
    let packed = 0
    for (let i = 0; i < 6; i++) {
      const clampedValue = Math.max(0, Math.min(31, values[i]!))
      packed |= (clampedValue & 0x1F) << (i * 5)
    }
    view.setUint32(this.quetzalOffsets.ivData, packed, true)
  }

  /**
   * Override nature calculation for Quetzal-specific formula
   */
  calculateNature (personality: number): string {
    // Quetzal uses only the first byte of personality modulo 25
    return natures[(personality & 0xFF) % 25]!
  }

  /**
   * Override nature setting for Quetzal-specific implementation
   */
  setNature (_data: Uint8Array, view: DataView, value: number): void {
    // Quetzal uses (personality & 0xFF) % 25 for nature calculation
    const currentPersonality = view.getUint32(0x00, true)
    const currentFirstByte = currentPersonality & 0xFF
    const currentNature = currentFirstByte % 25

    if (currentNature === value) return

    // Calculate new first byte: preserve quotient, set remainder to desired nature
    const newFirstByte = (currentFirstByte - currentNature) + value

    // Update personality with new first byte
    const newPersonality = (currentPersonality & 0xFFFFFF00) | (newFirstByte & 0xFF)
    view.setUint32(0x00, newPersonality >>> 0, true)
  }

  /**
   * Override active slot determination for Quetzal
   */
  determineActiveSlot (getCounterSum: (range: number[]) => number): number {
    const slot1Range = Array.from({ length: 18 }, (_, i) => i)
    const slot2Range = Array.from({ length: 18 }, (_, i) => i + 14)
    const slot1Sum = getCounterSum(slot1Range)
    const slot2Sum = getCounterSum(slot2Range)

    return slot2Sum >= slot1Sum ? 14 : 0
  }

  /**
   * Override shiny calculation for Quetzal-specific values
   */
  isShiny (personality: number, _otId: number): boolean {
    return this.getShinyValue(personality, _otId) === 1
  }

  getShinyValue (personality: number, _otId: number): number {
    return (personality >> 8) & 0xFF
  }

  isRadiant (personality: number, _otId: number): boolean {
    return this.getShinyValue(personality, _otId) === 2
  }

  /**
   * Check if this config can handle the given save file
   * Use parsing success as detection criteria with base class helpers
   */
  canHandle (saveData: Uint8Array): boolean {
    // Use base class to check for valid Emerald signature
    if (!this.hasValidEmeraldSignature(saveData)) {
      return false
    }

    // Try to actually parse Pokemon using Quetzal-specific structure with base class helpers
    try {
      const activeSlot = this.getActiveSlot(saveData)
      const sectorMap = this.buildSectorMap(saveData, activeSlot)
      const saveblock1Data = this.extractSaveBlock1(saveData, sectorMap)

      // Use base class helper for Pokemon detection
      const pokemonFound = this.parsePokemonForDetection(
        saveblock1Data,
        this.pokemonSize,
        (data, view) => this.getSpeciesId(data, view),
      )

      // Return true if we found valid Pokemon data
      return pokemonFound > 0
    } catch {
      return false
    }
  }

  /**
   * Check if this config can handle memory parsing for the given game title
   * Enable memory support for Quetzal ROM hack
   */
  canHandleMemory(gameTitle: string): boolean {
    return gameTitle.toLowerCase().includes('quetzal') || 
           gameTitle.includes('QUETZAL') || 
           gameTitle.includes('QUET') ||
           gameTitle.toLowerCase().includes('emerald') || 
           gameTitle.includes('EMERALD') || 
           gameTitle.includes('EMER')
  }

  /**
   * Discover party data addresses dynamically for Quetzal ROM hack
   * Quetzal uses dynamic memory allocation, so addresses need to be found at runtime
   */
  async discoverPartyAddresses(memoryReader: {
    readBytes: (address: number, length: number) => Promise<Uint8Array>
    readByte: (address: number) => Promise<number>
    readWord: (address: number) => Promise<number>
  }): Promise<{ partyData: number, partyCount?: number } | null> {
    // Search in common memory regions for party data patterns
    const searchRegions = [
      { start: 0x02020000, size: 0x10000 }, // Common party data region
      { start: 0x02024000, size: 0x8000 },  // Near vanilla addresses
      { start: 0x02025000, size: 0x8000 },  // Extended search area
    ]

    console.log('🔍 Dynamically discovering Quetzal party addresses...')

    for (const region of searchRegions) {
      try {
        const result = await this.scanRegionForParty(memoryReader, region.start, region.size)
        if (result) {
          console.log(`✅ Found party data at 0x${result.partyData.toString(16)}`)
          return result
        }
      } catch (error) {
        console.warn(`⚠️  Error scanning region 0x${region.start.toString(16)}: ${error}`)
        continue
      }
    }

    console.warn('❌ Could not discover party addresses dynamically')
    return null
  }

  private async scanRegionForParty(
    memoryReader: {
      readBytes: (address: number, length: number) => Promise<Uint8Array>
      readByte: (address: number) => Promise<number>
      readWord: (address: number) => Promise<number>
    },
    startAddr: number,
    size: number
  ): Promise<{ partyData: number, partyCount?: number } | null> {
    const chunkSize = 1024
    
    for (let offset = 0; offset < size; offset += chunkSize) {
      const addr = startAddr + offset
      const readSize = Math.min(chunkSize, size - offset)
      
      try {
        // Check if this region contains valid Pokemon data patterns
        const candidateAddr = await this.findPokemonDataPattern(memoryReader, addr, readSize)
        if (candidateAddr) {
          // Verify it's actually party data by checking structure
          const isValid = await this.validatePartyStructure(memoryReader, candidateAddr)
          if (isValid) {
            const partyCount = await this.findPartyCountNear(memoryReader, candidateAddr)
            return { partyData: candidateAddr, partyCount }
          }
        }
      } catch {
        continue // Skip unreadable regions
      }
    }

    return null
  }

  private async findPokemonDataPattern(
    memoryReader: {
      readBytes: (address: number, length: number) => Promise<Uint8Array>
      readWord: (address: number) => Promise<number>
    },
    startAddr: number,
    size: number
  ): Promise<number | null> {
    // Look for patterns that suggest Pokemon data (non-zero species, reasonable levels)
    for (let offset = 0; offset < size - this.pokemonSize; offset += 4) {
      const addr = startAddr + offset
      
      try {
        // Check if this looks like a Pokemon (species at offset 0x28, level at 0x58)
        const species = await memoryReader.readWord(addr + 0x28)
        if (species > 0 && species <= 1000) { // Valid species range
          return addr
        }
      } catch {
        continue
      }
    }

    return null
  }

  private async validatePartyStructure(
    memoryReader: {
      readByte: (address: number) => Promise<number>
      readWord: (address: number) => Promise<number>
    },
    partyAddr: number
  ): Promise<boolean> {
    try {
      let validPokemon = 0

      // Check up to 6 Pokemon slots
      for (let slot = 0; slot < 6; slot++) {
        const pokemonAddr = partyAddr + (slot * this.pokemonSize)
        
        const species = await memoryReader.readWord(pokemonAddr + 0x28)
        const level = await memoryReader.readByte(pokemonAddr + 0x58)
        
        // Count valid Pokemon (non-zero species, reasonable level)
        if (species > 0 && species <= 1000 && level > 0 && level <= 100) {
          validPokemon++
        }
      }

      // Consider valid if we have at least 1-6 valid Pokemon
      return validPokemon >= 1 && validPokemon <= 6
    } catch {
      return false
    }
  }

  private async findPartyCountNear(
    memoryReader: {
      readByte: (address: number) => Promise<number>
    },
    partyAddr: number
  ): Promise<number | undefined> {
    // Check common offsets for party count
    const offsets = [-8, -4, -1, 0, 1, 4, 8]
    
    for (const offset of offsets) {
      try {
        const value = await memoryReader.readByte(partyAddr + offset)
        if (value >= 1 && value <= 6) { // Valid party count range
          return partyAddr + offset
        }
      } catch {
        continue
      }
    }

    return undefined
  }
}
