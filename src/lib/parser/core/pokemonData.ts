/**
 * Abstract Pokemon data implementation with game-specific concrete classes
 * This addresses the issue where PokemonData was hardcoded for Quetzal-specific logic
 */

import type { GameConfig } from '../core/types'
import type { MoveData, PokemonMoves } from './types'
import { bytesToGbaString, getPokemonNature, natureEffects, statStrings } from './utils'

/**
 * Base Pokemon data class with common functionality
 * Contains shared logic for stats, EVs, mappings, etc.
 * All offsets are now driven by the injected GameConfig
 */
export abstract class BasePokemonData {
  protected readonly view: DataView
  protected readonly config: GameConfig

  constructor (protected readonly data: Uint8Array, config: GameConfig) {
    if (data.length < config.offsets.partyPokemonSize) {
      throw new Error(`Insufficient data for Pokemon: ${data.length} bytes`)
    }
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    this.config = config
  }

  // Basic properties using config-driven offsets
  get personality () { return this.view.getUint32(this.config.offsets.pokemonData.personality, true) }
  get otId () { return this.view.getUint32(this.config.offsets.pokemonData.otId, true) }
  private get nicknameRaw () {
    const offset = this.config.offsets.pokemonData.nickname
    const length = this.config.offsets.pokemonNicknameLength
    return new Uint8Array(this.view.buffer, this.view.byteOffset + offset, length)
  }

  private get otNameRaw () {
    const offset = this.config.offsets.pokemonData.otName
    const length = this.config.offsets.pokemonTrainerNameLength
    return new Uint8Array(this.view.buffer, this.view.byteOffset + offset, length)
  }

  get currentHp () { return this.view.getUint16(this.config.offsets.pokemonData.currentHp, true) }
  get speciesId () { return this.mapSpeciesToPokeId(this.view.getUint16(this.config.offsets.pokemonData.species, true)) }
  get nameId () { return this.mapSpeciesToNameId(this.view.getUint16(this.config.offsets.pokemonData.species, true)) }
  get item () { return this.mapItemToPokeId(this.view.getUint16(this.config.offsets.pokemonData.item, true)) }
  get itemIdName () { return this.mapItemToNameId(this.view.getUint16(this.config.offsets.pokemonData.item, true)) }
  get move1 () { return this.mapMoveToPokeId(this.view.getUint16(this.config.offsets.pokemonData.move1, true)) }
  get move2 () { return this.mapMoveToPokeId(this.view.getUint16(this.config.offsets.pokemonData.move2, true)) }
  get move3 () { return this.mapMoveToPokeId(this.view.getUint16(this.config.offsets.pokemonData.move3, true)) }
  get move4 () { return this.mapMoveToPokeId(this.view.getUint16(this.config.offsets.pokemonData.move4, true)) }
  get pp1 () { return this.view.getUint8(this.config.offsets.pokemonData.pp1) }
  get pp2 () { return this.view.getUint8(this.config.offsets.pokemonData.pp2) }
  get pp3 () { return this.view.getUint8(this.config.offsets.pokemonData.pp3) }
  get pp4 () { return this.view.getUint8(this.config.offsets.pokemonData.pp4) }
  get hpEV () { return this.view.getUint8(this.config.offsets.pokemonData.hpEV) }
  set hpEV (value) { this.view.setUint8(this.config.offsets.pokemonData.hpEV, value) }
  get atkEV () { return this.view.getUint8(this.config.offsets.pokemonData.atkEV) }
  set atkEV (value) { this.view.setUint8(this.config.offsets.pokemonData.atkEV, value) }
  get defEV () { return this.view.getUint8(this.config.offsets.pokemonData.defEV) }
  set defEV (value) { this.view.setUint8(this.config.offsets.pokemonData.defEV, value) }
  get speEV () { return this.view.getUint8(this.config.offsets.pokemonData.speEV) }
  set speEV (value) { this.view.setUint8(this.config.offsets.pokemonData.speEV, value) }
  get spaEV () { return this.view.getUint8(this.config.offsets.pokemonData.spaEV) }
  set spaEV (value) { this.view.setUint8(this.config.offsets.pokemonData.spaEV, value) }
  get spdEV () { return this.view.getUint8(this.config.offsets.pokemonData.spdEV) }
  set spdEV (value) { this.view.setUint8(this.config.offsets.pokemonData.spdEV, value) }
  get status () { return this.view.getUint8(this.config.offsets.pokemonData.status) }
  get level () { return this.view.getUint8(this.config.offsets.pokemonData.level) }
  get maxHp () { return this.view.getUint16(this.config.offsets.pokemonData.maxHp, true) }
  set maxHp (value) { this.view.setUint16(this.config.offsets.pokemonData.maxHp, value, true) }
  get attack () { return this.view.getUint16(this.config.offsets.pokemonData.attack, true) }
  set attack (value) { this.view.setUint16(this.config.offsets.pokemonData.attack, value, true) }
  get defense () { return this.view.getUint16(this.config.offsets.pokemonData.defense, true) }
  set defense (value) { this.view.setUint16(this.config.offsets.pokemonData.defense, value, true) }
  get speed () { return this.view.getUint16(this.config.offsets.pokemonData.speed, true) }
  set speed (value) { this.view.setUint16(this.config.offsets.pokemonData.speed, value, true) }
  get spAttack () { return this.view.getUint16(this.config.offsets.pokemonData.spAttack, true) }
  set spAttack (value) { this.view.setUint16(this.config.offsets.pokemonData.spAttack, value, true) }
  get spDefense () { return this.view.getUint16(this.config.offsets.pokemonData.spDefense, true) }
  set spDefense (value) { this.view.setUint16(this.config.offsets.pokemonData.spDefense, value, true) }
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

  get natureRaw (): number {
    // Nature is calculated from personality, not stored separately
    return (this.personality & 0xFF) % 25
  }

  set natureRaw (value: number) {
    // Setting nature would require modifying the personality value
    // This is a complex operation that affects other properties
    throw new Error(`Setting nature to ${value} directly is not supported. Modify personality instead.`)
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
      move1: { id: this.move1, pp: this.pp1 },
      move2: { id: this.move2, pp: this.pp2 },
      move3: { id: this.move3, pp: this.pp3 },
      move4: { id: this.move4, pp: this.pp4 },
    }
  }

  get moves_data (): PokemonMoves {
    return {
      move1: { id: this.move1, pp: this.pp1 },
      move2: { id: this.move2, pp: this.pp2 },
      move3: { id: this.move3, pp: this.pp3 },
      move4: { id: this.move4, pp: this.pp4 },
    }
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
