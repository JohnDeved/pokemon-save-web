/**
 * Quetzal ROM hack configuration
 * Only overrides differences from vanilla Emerald baseline
 */

import { VANILLA_SAVE_LAYOUT, type GameConfig, type ItemMapping, type MoveMapping, type PokemonMapping, type PokemonOffsetsOverride, type SaveLayoutOverride } from '../../core/types'
import { createMapping, natures } from '../../core/utils'
import { GameConfigBase } from '../../core/GameConfigBase'
import itemMapData from './data/item_map.json'
import moveMapData from './data/move_map.json'
import pokemonMapData from './data/pokemon_map.json'

export class QuetzalConfig extends GameConfigBase implements GameConfig {
  readonly name = 'Pokemon Quetzal'

  // Override Pokemon size for Quetzal
  readonly pokemonSize = 104
  readonly maxPartySize = 6

  // Quetzal includes Mega Evolution feature
  readonly supportsMega = true

  // Override offsets for Quetzal's unencrypted structure
  readonly offsetOverrides: PokemonOffsetsOverride = {
    currentHp: 0x23,
    maxHp: 0x5a,
    attack: 0x5c,
    defense: 0x5e,
    speed: 0x60,
    spAttack: 0x62,
    spDefense: 0x64,
    status: 0x57,
    level: 0x58,
  }

  // Override save layout for Quetzal
  readonly saveLayoutOverrides: SaveLayoutOverride = {
    partyOffset: 0x6a8,
    partyCountOffset: 0x6a4,
    playTimeHours: 0x10,
    playTimeMinutes: 0x14,
    playTimeSeconds: 0x15,
    playTimeMilliseconds: 0x16,
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
  readonly memoryAddresses = {
    partyData: 0x20235b8,
    partyCount: 0x20235b5,
    enemyParty: 0x2023a98,
    get enemyPartyCount() {
      return this.partyCount + 0x8
    },
    // TODO: Add player name and play time addresses when implemented
  } as const

  /**
   * Preload regions for Quetzal memory parsing
   */
  get preloadRegions() {
    return [
      {
        address: this.memoryAddresses.partyData,
        size: this.pokemonSize * this.maxPartySize,
      },
      {
        address: this.memoryAddresses.partyCount,
        size: 7, // Party count + context
      },
    ]
  }

  // Quetzal-specific offsets for unencrypted data
  private readonly quetzalOffsets = {
    species: 0x28,
    item: 0x2a,
    move1: 0x34,
    move2: 0x36,
    move3: 0x38,
    move4: 0x3a,
    pp1: 0x3c,
    pp2: 0x3d,
    pp3: 0x3e,
    pp4: 0x3f,
    hpEV: 0x40,
    atkEV: 0x41,
    defEV: 0x42,
    speEV: 0x43,
    spaEV: 0x44,
    spdEV: 0x45,
    ivData: 0x50,
  } as const

  // Override data access methods for Quetzal's unencrypted structure
  getSpeciesId(_data: Uint8Array, view: DataView): number {
    const rawSpecies = view.getUint16(this.quetzalOffsets.species, true)
    // Apply ID mapping using the base mapping system
    return this.mappings.pokemon.get(rawSpecies)?.id ?? rawSpecies
  }

  getPokemonName(_data: Uint8Array, view: DataView): string | undefined {
    const rawSpecies = view.getUint16(this.quetzalOffsets.species, true)
    // Apply name mapping using the base mapping system - use id_name for sprite filenames
    return this.mappings.pokemon.get(rawSpecies)?.id_name
  }

  getItem(_data: Uint8Array, view: DataView): number {
    const rawItem = view.getUint16(this.quetzalOffsets.item, true)
    // Apply ID mapping using the base mapping system
    return this.mappings.items.get(rawItem)?.id ?? rawItem
  }

  getItemName(_data: Uint8Array, view: DataView): string | undefined {
    const rawItem = view.getUint16(this.quetzalOffsets.item, true)
    // Apply name mapping using the base mapping system
    return this.mappings.items.get(rawItem)?.id_name
  }

  setItem(_data: Uint8Array, view: DataView, value: number): void {
    // Convert mapped (external) ID back to internal raw ID if a mapping exists
    let raw = value
    for (const [rawKey, entry] of this.mappings.items.entries()) {
      if (entry.id === value) {
        raw = rawKey
        break
      }
    }
    view.setUint16(this.quetzalOffsets.item, raw, true)
  }

  getMove(_data: Uint8Array, view: DataView, index: number): number {
    const moveOffsets = [this.quetzalOffsets.move1, this.quetzalOffsets.move2, this.quetzalOffsets.move3, this.quetzalOffsets.move4]
    const rawMove = view.getUint16(moveOffsets[index]!, true)
    // Apply ID mapping using the base mapping system
    return this.mappings.moves.get(rawMove)?.id ?? rawMove
  }

  getPP(_data: Uint8Array, view: DataView, index: number): number {
    const ppOffsets = [this.quetzalOffsets.pp1, this.quetzalOffsets.pp2, this.quetzalOffsets.pp3, this.quetzalOffsets.pp4]
    return view.getUint8(ppOffsets[index]!)
  }

  getEV(_data: Uint8Array, view: DataView, index: number): number {
    const evOffsets = [this.quetzalOffsets.hpEV, this.quetzalOffsets.atkEV, this.quetzalOffsets.defEV, this.quetzalOffsets.speEV, this.quetzalOffsets.spaEV, this.quetzalOffsets.spdEV]
    return view.getUint8(evOffsets[index]!)
  }

  setEV(_data: Uint8Array, view: DataView, index: number, value: number): void {
    const evOffsets = [this.quetzalOffsets.hpEV, this.quetzalOffsets.atkEV, this.quetzalOffsets.defEV, this.quetzalOffsets.speEV, this.quetzalOffsets.spaEV, this.quetzalOffsets.spdEV]
    const clampedValue = Math.max(0, Math.min(255, value))
    view.setUint8(evOffsets[index]!, clampedValue)
  }

  getIVs(_data: Uint8Array, view: DataView): readonly number[] {
    const ivData = view.getUint32(this.quetzalOffsets.ivData, true)
    return Array.from({ length: 6 }, (_, i) => (ivData >>> (i * 5)) & 0x1f)
  }

  setIVs(_data: Uint8Array, view: DataView, values: readonly number[]): void {
    if (values.length !== 6) throw new Error('IVs array must have 6 values')
    let packed = 0
    for (let i = 0; i < 6; i++) {
      const clampedValue = Math.max(0, Math.min(31, values[i]!))
      packed |= (clampedValue & 0x1f) << (i * 5)
    }
    view.setUint32(this.quetzalOffsets.ivData, packed, true)
  }

  /**
   * Override nature calculation for Quetzal-specific formula
   */
  calculateNature(personality: number): string {
    // Quetzal uses only the first byte of personality modulo 25
    return natures[(personality & 0xff) % 25]!
  }

  /**
   * Override nature setting for Quetzal-specific implementation
   */
  setNature(_data: Uint8Array, view: DataView, value: number): void {
    // Quetzal uses (personality & 0xFF) % 25 for nature calculation
    const currentPersonality = view.getUint32(0x00, true)
    const currentFirstByte = currentPersonality & 0xff
    const currentNature = currentFirstByte % 25

    if (currentNature === value) return

    // Calculate new first byte: preserve quotient, set remainder to desired nature
    const newFirstByte = currentFirstByte - currentNature + value

    // Update personality with new first byte
    const newPersonality = (currentPersonality & 0xffffff00) | (newFirstByte & 0xff)
    view.setUint32(0x00, newPersonality >>> 0, true)
  }

  /**
   * Override active slot determination for Quetzal
   */
  determineActiveSlot(getCounterSum: (range: number[]) => number): number {
    const slot1Range = Array.from({ length: 18 }, (_, i) => i)
    const slot2Range = Array.from({ length: 18 }, (_, i) => i + 14)
    const slot1Sum = getCounterSum(slot1Range)
    const slot2Sum = getCounterSum(slot2Range)

    return slot2Sum >= slot1Sum ? 14 : 0
  }

  /**
   * Override shiny calculation for Quetzal-specific values
   */
  isShiny(personality: number, _otId: number): boolean {
    return this.getShinyValue(personality, _otId) === 1
  }

  getShinyValue(personality: number, _otId: number): number {
    return (personality >> 8) & 0xff
  }

  isRadiant(personality: number, _otId: number): boolean {
    return this.getShinyValue(personality, _otId) === 2
  }

  /**
   * Check if this config can handle the given save file
   * Use parsing success as detection criteria with base class helpers
   */
  canHandle(saveData: Uint8Array): boolean {
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
      const pokemonFound = this.parsePokemonForDetection(saveblock1Data, this.pokemonSize, (data, view) => this.getSpeciesId(data, view))

      // Return true if we found valid Pokemon data
      return pokemonFound > 0
    } catch {
      return false
    }
  }

  /**
   * Check if this config can handle memory parsing for the given game title
   * Currently not supported for Quetzal
   */
  canHandleMemory(gameTitle: string): boolean {
    // Return false for now until we implement Quetzal memory support
    return gameTitle.toLowerCase().includes('quetzal')
  }
}
