/**
 * Abstract Pokemon data implementation with game-specific concrete classes
 * This addresses the issue where PokemonData was hardcoded for Quetzal-specific logic
 */

import type { PokemonDataInterface, GameConfig } from '../configs/GameConfig.js'
import type { MoveData, PokemonMoves } from './types.js'
import { createMoveData, createPokemonMoves } from './types.js'
import { bytesToGbaString, getPokemonNature, natureEffects, statStrings } from './utils.js'

/**
 * DataView wrapper for little-endian operations with bounds checking
 */
class SafeDataView {
  private readonly view: DataView

  constructor (buffer: ArrayBuffer, byteOffset = 0, byteLength?: number) {
    this.view = new DataView(buffer, byteOffset, byteLength)
  }

  getUint8 (byteOffset: number): number {
    if (byteOffset >= this.view.byteLength) {
      throw new RangeError(`Offset ${byteOffset} out of bounds`)
    }
    return this.view.getUint8(byteOffset)
  }

  getUint16 (byteOffset: number, littleEndian = true): number {
    if (byteOffset + 1 >= this.view.byteLength) {
      throw new RangeError(`Offset ${byteOffset} out of bounds`)
    }
    return this.view.getUint16(byteOffset, littleEndian)
  }

  getUint32 (byteOffset: number, littleEndian = true): number {
    if (byteOffset + 3 >= this.view.byteLength) {
      throw new RangeError(`Offset ${byteOffset} out of bounds`)
    }
    return this.view.getUint32(byteOffset, littleEndian)
  }

  setUint8 (byteOffset: number, value: number): void {
    if (byteOffset >= this.view.byteLength) {
      throw new RangeError(`Offset ${byteOffset} out of bounds`)
    }
    this.view.setUint8(byteOffset, value)
  }

  setUint16 (byteOffset: number, value: number, littleEndian = true): void {
    if (byteOffset + 1 >= this.view.byteLength) {
      throw new RangeError(`Offset ${byteOffset} out of bounds`)
    }
    this.view.setUint16(byteOffset, value, littleEndian)
  }

  setUint32 (byteOffset: number, value: number, littleEndian = true): void {
    if (byteOffset + 3 >= this.view.byteLength) {
      throw new RangeError(`Offset ${byteOffset} out of bounds`)
    }
    this.view.setUint32(byteOffset, value, littleEndian)
  }

  getBytes (byteOffset: number, length: number): Uint8Array {
    if (byteOffset + length > this.view.byteLength) {
      throw new RangeError(`Range ${byteOffset}-${byteOffset + length} out of bounds`)
    }
    return new Uint8Array(this.view.buffer, this.view.byteOffset + byteOffset, length)
  }
}

/**
 * Base Pokemon data class with common functionality
 * Contains shared logic for stats, EVs, mappings, etc.
 */
export abstract class BasePokemonData implements PokemonDataInterface {
  protected readonly view: SafeDataView
  protected readonly config: GameConfig

  constructor (protected readonly data: Uint8Array, config: GameConfig) {
    if (data.length < config.offsets.partyPokemonSize) {
      throw new Error(`Insufficient data for Pokemon: ${data.length} bytes`)
    }
    this.view = new SafeDataView(data.buffer, data.byteOffset, data.byteLength)
    this.config = config
  }

  // Basic properties (same for all games)
  get personality () { return this.view.getUint32(0x00) }
  get natureRaw () { return this.view.getUint8(0x00) }
  set natureRaw (value: number) { this.view.setUint8(0x00, value) }
  get otId () { return this.view.getUint32(0x04) }
  get nicknameRaw () { return this.view.getBytes(0x08, this.config.offsets.pokemonNicknameLength) }
  get otNameRaw () { return this.view.getBytes(0x14, this.config.offsets.pokemonTrainerNameLength) }
  get currentHp () { return this.view.getUint16(0x23) }
  get speciesId () { return this.mapSpeciesToPokeId(this.view.getUint16(0x28)) }
  get nameId () { return this.mapSpeciesToNameId(this.view.getUint16(0x28)) }
  get item () { return this.mapItemToPokeId(this.view.getUint16(0x2A)) }
  get itemIdName () { return this.mapItemToNameId(this.view.getUint16(0x2A)) }
  get move1 () { return this.mapMoveToPokeId(this.view.getUint16(0x34)) }
  get move2 () { return this.mapMoveToPokeId(this.view.getUint16(0x36)) }
  get move3 () { return this.mapMoveToPokeId(this.view.getUint16(0x38)) }
  get move4 () { return this.mapMoveToPokeId(this.view.getUint16(0x3A)) }
  get pp1 () { return this.view.getUint8(0x3C) }
  get pp2 () { return this.view.getUint8(0x3D) }
  get pp3 () { return this.view.getUint8(0x3E) }
  get pp4 () { return this.view.getUint8(0x3F) }
  get hpEV () { return this.view.getUint8(0x40) }
  set hpEV (value) { this.view.setUint8(0x40, value) }
  get atkEV () { return this.view.getUint8(0x41) }
  set atkEV (value) { this.view.setUint8(0x41, value) }
  get defEV () { return this.view.getUint8(0x42) }
  set defEV (value) { this.view.setUint8(0x42, value) }
  get speEV () { return this.view.getUint8(0x43) }
  set speEV (value) { this.view.setUint8(0x43, value) }
  get spaEV () { return this.view.getUint8(0x44) }
  set spaEV (value) { this.view.setUint8(0x44, value) }
  get spdEV () { return this.view.getUint8(0x45) }
  set spdEV (value) { this.view.setUint8(0x45, value) }
  get status () { return this.view.getUint8(0x57) }
  get level () { return this.view.getUint8(0x58) }
  get maxHp () { return this.view.getUint16(0x5A) }
  set maxHp (value) { this.view.setUint16(0x5A, value) }
  get attack () { return this.view.getUint16(0x5C) }
  set attack (value) { this.view.setUint16(0x5C, value) }
  get defense () { return this.view.getUint16(0x5E) }
  set defense (value) { this.view.setUint16(0x5E, value) }
  get speed () { return this.view.getUint16(0x60) }
  set speed (value) { this.view.setUint16(0x60, value) }
  get spAttack () { return this.view.getUint16(0x62) }
  set spAttack (value) { this.view.setUint16(0x62, value) }
  get spDefense () { return this.view.getUint16(0x64) }
  set spDefense (value) { this.view.setUint16(0x64, value) }
  get rawBytes () { return new Uint8Array(this.data) }

  // Mapping functions that use the injected config
  private mapSpeciesToPokeId (speciesId: number): number {
    return this.config.mappings.pokemon.get(speciesId)?.id ?? speciesId
  }

  private mapSpeciesToNameId (speciesId: number): string | undefined {
    return this.config.mappings.pokemon.get(speciesId)?.id_name
  }

  private mapMoveToPokeId (moveId: number): number {
    const mapped = this.config.mappings.moves.get(moveId)?.id
    return mapped ?? moveId
  }

  private mapItemToPokeId (itemId: number): number {
    const mapped = this.config.mappings.items.get(itemId)?.id
    return mapped ?? itemId
  }

  private mapItemToNameId (itemId: number): string | undefined {
    return this.config.mappings.items.get(itemId)?.id_name
  }

  // Computed properties
  get otId_str (): string {
    return (this.otId & 0xFFFF).toString().padStart(5, '0')
  }

  get nickname (): string {
    return bytesToGbaString(this.nicknameRaw)
  }

  get otName (): string {
    return bytesToGbaString(this.otNameRaw)
  }

  get nature (): string {
    return getPokemonNature(this.personality)
  }

  get natureModifiers (): { increased: number, decreased: number } {
    // Fallback to {0,0} if nature is not found
    return natureEffects[this.nature] ?? { increased: 0, decreased: 0 }
  }

  get natureModifiersString (): { increased: string, decreased: string } {
    const { increased, decreased } = this.natureModifiers
    return {
      increased: statStrings[increased] ?? 'Unknown',
      decreased: statStrings[decreased] ?? 'Unknown',
    }
  }

  get natureModifiersArray (): readonly number[] { // usage for statsArray
    // Nature modifiers: [hp, atk, def, spe, spa, spd]
    const { increased, decreased } = this.natureModifiers
    return this.stats.map((_, i) =>
      i === increased ? 1.1 : i === decreased ? 0.9 : 1,
    )
  }

  get abilityNumber (): number {
    // if 2nd bit of status is set, ability is 1
    // if 3rd bit is set, ability is 2
    // otherwise ability is 0
    return (this.status & 16) ? 1 : (this.status & 32) ? 2 : 0
  }

  get stats (): readonly number[] {
    return [this.maxHp, this.attack, this.defense, this.speed, this.spAttack, this.spDefense]
  }

  set stats (values: readonly number[]) {
    if (values.length !== 6) throw new Error('Stats array must have 6 values')
    this.maxHp = values[0]!
    this.attack = values[1]!
    this.defense = values[2]!
    this.speed = values[3]!
    this.spAttack = values[4]!
    this.spDefense = values[5]!
  }

  setStats (values: readonly number[]): void {
    this.stats = values
  }

  setEvs (values: readonly number[]): void {
    this.evs = values
  }

  setIvs (values: readonly number[]): void {
    this.ivs = values
  }

  setNatureRaw (value: number): void {
    this.natureRaw = value
  }

  get moves (): {
    readonly move1: MoveData
    readonly move2: MoveData
    readonly move3: MoveData
    readonly move4: MoveData
  } {
    return {
      move1: createMoveData(this.move1, this.pp1),
      move2: createMoveData(this.move2, this.pp2),
      move3: createMoveData(this.move3, this.pp3),
      move4: createMoveData(this.move4, this.pp4),
    }
  }

  get moves_data (): PokemonMoves {
    return createPokemonMoves(
      this.move1, this.move2, this.move3, this.move4,
      this.pp1, this.pp2, this.pp3, this.pp4,
    )
  }

  get evs (): readonly number[] {
    return [this.hpEV, this.atkEV, this.defEV, this.speEV, this.spaEV, this.spdEV]
  }

  set evs (values: readonly number[]) {
    if (values.length !== 6) throw new Error('EVs array must have 6 values')
    this.hpEV = values[0]!
    this.atkEV = values[1]!
    this.defEV = values[2]!
    this.speEV = values[3]!
    this.spaEV = values[4]!
    this.spdEV = values[5]!
  }

  get totalEVs (): number {
    return this.evs.reduce((sum, ev) => sum + ev, 0)
  }

  get totalIVs (): number {
    return this.ivs.reduce((sum, iv) => sum + iv, 0)
  }

  get moveIds (): readonly number[] {
    return [this.move1, this.move2, this.move3, this.move4]
  }

  get ppValues (): readonly number[] {
    return [this.pp1, this.pp2, this.pp3, this.pp4]
  }

  setEvByIndex (statIndex: number, value: number): void {
    switch (statIndex) {
      case 0: this.hpEV = value; break
      case 1: this.atkEV = value; break
      case 2: this.defEV = value; break
      case 3: this.speEV = value; break
      case 4: this.spaEV = value; break
      case 5: this.spdEV = value; break
      default:
        throw new Error(`Invalid EV index: ${statIndex}`)
    }
  }

  setIvByIndex (statIndex: number, value: number): void {
    if (statIndex < 0 || statIndex > 5) {
      throw new Error(`Invalid IV index: ${statIndex}`)
    }
    const clampedValue = Math.max(0, Math.min(31, value))
    const currentIvs = [...this.ivs]
    currentIvs[statIndex] = clampedValue
    this.ivs = currentIvs
  }

  // Abstract methods that must be implemented by game-specific classes
  abstract get ivs (): readonly number[]
  abstract set ivs (values: readonly number[])
  abstract get isShiny (): boolean
  abstract get shinyNumber (): number
  abstract get isRadiant (): boolean
}

/**
 * Quetzal-specific Pokemon data implementation
 * Handles Quetzal's unencrypted IVs and custom shiny system
 */
export class QuetzalPokemonData extends BasePokemonData {
  get ivData () { return this.view.getUint32(0x50) }
  set ivData (value) { this.view.setUint32(0x50, value) }

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

/**
 * Vanilla Pokemon Emerald data implementation
 * Handles encrypted Pokemon data and standard Gen 3 shiny calculation
 */
export class VanillaPokemonData extends BasePokemonData {
  private get encryptionKey (): number {
    // Standard Pokemon encryption key: personality XOR OT ID
    return this.personality ^ this.otId
  }

  get ivs (): readonly number[] {
    // Vanilla Pokemon Emerald uses encrypted IV data
    const encrypted = this.view.getUint32(0x50)
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
    this.view.setUint32(0x50, encrypted)
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
