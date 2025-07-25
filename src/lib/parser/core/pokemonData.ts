/**
 * Pokemon data implementation based on vanilla Pokemon Emerald structure
 * Serves as the baseline with game-specific behavior controlled via GameConfig
 */

import type { GameConfig } from '../core/types'
import type { MoveData, PokemonMoves } from './types'
import { bytesToGbaString, natureEffects, natures, statStrings } from './utils'

/**
 * Pokemon data class based on vanilla Pokemon Emerald
 * Uses GameConfig to handle game-specific differences like encryption
 */
export class PokemonData {
  protected readonly view: DataView
  protected readonly config: GameConfig

  constructor (protected readonly data: Uint8Array, config: GameConfig) {
    if (data.length < config.pokemonSize) {
      throw new Error(`Insufficient data for Pokemon: ${data.length} bytes`)
    }
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    this.config = config
  }

  // Basic unencrypted properties (common to all games)
  get personality () { return this.view.getUint32(this.config.offsets.personality, true) }
  get otId () { return this.view.getUint32(this.config.offsets.otId, true) }
  get currentHp () { return this.view.getUint16(this.config.offsets.currentHp, true) }
  get status () { return this.view.getUint8(this.config.offsets.status) }
  get level () { return this.view.getUint8(this.config.offsets.level) }
  get maxHp () { return this.view.getUint16(this.config.offsets.maxHp, true) }
  set maxHp (value) { this.view.setUint16(this.config.offsets.maxHp, value, true) }
  get attack () { return this.view.getUint16(this.config.offsets.attack, true) }
  set attack (value) { this.view.setUint16(this.config.offsets.attack, value, true) }
  get defense () { return this.view.getUint16(this.config.offsets.defense, true) }
  set defense (value) { this.view.setUint16(this.config.offsets.defense, value, true) }
  get speed () { return this.view.getUint16(this.config.offsets.speed, true) }
  set speed (value) { this.view.setUint16(this.config.offsets.speed, value, true) }
  get spAttack () { return this.view.getUint16(this.config.offsets.spAttack, true) }
  set spAttack (value) { this.view.setUint16(this.config.offsets.spAttack, value, true) }
  get spDefense () { return this.view.getUint16(this.config.offsets.spDefense, true) }
  set spDefense (value) { this.view.setUint16(this.config.offsets.spDefense, value, true) }

  private get nicknameRaw () {
    return new Uint8Array(this.view.buffer, this.view.byteOffset + this.config.offsets.nickname, this.config.offsets.nicknameLength)
  }

  private get otNameRaw () {
    return new Uint8Array(this.view.buffer, this.view.byteOffset + this.config.offsets.otName, this.config.offsets.otNameLength)
  }

  // Game-specific data access (vanilla Emerald uses encryption, some ROM hacks don't)
  get speciesId () { return this.config.getSpeciesId(this.data, this.view) }
  get nameId () { return this.config.getPokemonName(this.data, this.view) }
  get item () { return this.config.getItem(this.data, this.view) }
  get itemIdName () { return this.config.getItemName(this.data, this.view) }
  get move1 () { return this.config.getMove(this.data, this.view, 0) }
  get move2 () { return this.config.getMove(this.data, this.view, 1) }
  get move3 () { return this.config.getMove(this.data, this.view, 2) }
  get move4 () { return this.config.getMove(this.data, this.view, 3) }
  get pp1 () { return this.config.getPP(this.data, this.view, 0) }
  get pp2 () { return this.config.getPP(this.data, this.view, 1) }
  get pp3 () { return this.config.getPP(this.data, this.view, 2) }
  get pp4 () { return this.config.getPP(this.data, this.view, 3) }
  get hpEV () { return this.config.getEV(this.data, this.view, 0) }
  set hpEV (value) { this.config.setEV(this.data, this.view, 0, value) }
  get atkEV () { return this.config.getEV(this.data, this.view, 1) }
  set atkEV (value) { this.config.setEV(this.data, this.view, 1, value) }
  get defEV () { return this.config.getEV(this.data, this.view, 2) }
  set defEV (value) { this.config.setEV(this.data, this.view, 2, value) }
  get speEV () { return this.config.getEV(this.data, this.view, 3) }
  set speEV (value) { this.config.setEV(this.data, this.view, 3, value) }
  get spaEV () { return this.config.getEV(this.data, this.view, 4) }
  set spaEV (value) { this.config.setEV(this.data, this.view, 4, value) }
  get spdEV () { return this.config.getEV(this.data, this.view, 5) }
  set spdEV (value) { this.config.setEV(this.data, this.view, 5, value) }
  get ivs (): readonly number[] { return this.config.getIVs(this.data, this.view) }
  set ivs (values: readonly number[]) { this.config.setIVs(this.data, this.view, values) }
  get isShiny (): boolean { return this.config.getIsShiny(this.data, this.view) }
  get shinyNumber (): number { return this.config.getShinyNumber(this.data, this.view) }
  get isRadiant (): boolean { return this.config.getIsRadiant(this.data, this.view) }

  get rawBytes () { return new Uint8Array(this.data) }

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
    return this.config.calculateNature(this.personality)
  }

  get natureRaw (): number {
    const nature = this.config.calculateNature(this.personality)
    return natures.indexOf(nature)
  }

  set natureRaw (value: number) {
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
}
