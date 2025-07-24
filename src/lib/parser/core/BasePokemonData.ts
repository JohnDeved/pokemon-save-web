/**
 * Base abstract class for Pokemon data parsing
 * Implements common functionality that all games share
 */

import type { PokemonDataInterface } from './PokemonDataInterface.js'
import type { MoveData } from './types.js'
import type { GameConfig } from '../configs/GameConfig.js'
import { createMoveData } from './types.js'
import { bytesToGbaString, getPokemonNature, natureEffects } from './utils.js'

/**
 * DataView wrapper for little-endian operations with bounds checking
 */
export class SafeDataView {
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

  setBytes (byteOffset: number, data: Uint8Array): void {
    if (byteOffset + data.length > this.view.byteLength) {
      throw new RangeError(`Range ${byteOffset}-${byteOffset + data.length} out of bounds`)
    }
    const target = new Uint8Array(this.view.buffer, this.view.byteOffset + byteOffset, data.length)
    target.set(data)
  }

  get byteLength (): number {
    return this.view.byteLength
  }
}

/**
 * Base abstract class implementing common Pokemon data functionality
 */
export abstract class BasePokemonData implements PokemonDataInterface {
  readonly view: SafeDataView

  constructor (protected readonly data: Uint8Array, protected readonly config: GameConfig) {
    if (data.length < config.offsets.partyPokemonSize) {
      throw new Error(`Insufficient data for Pokemon: ${data.length} bytes`)
    }
    this.view = new SafeDataView(data.buffer, data.byteOffset, data.byteLength)
  }

  // Basic properties that are common across games
  get personality () { return this.view.getUint32(this.config.offsets.pokemonData.personality) }
  get natureRaw () { return this.view.getUint8(this.config.offsets.pokemonData.personality) }
  set natureRaw (value: number) { this.view.setUint8(this.config.offsets.pokemonData.personality, value) }
  get otId () { return this.view.getUint32(this.config.offsets.pokemonData.otId) }
  get nicknameRaw () { return this.view.getBytes(this.config.offsets.pokemonData.nickname, this.config.offsets.pokemonNicknameLength) }
  get otNameRaw () { return this.view.getBytes(this.config.offsets.pokemonData.otName, this.config.offsets.pokemonTrainerNameLength) }
  get currentHp () { return this.view.getUint16(this.config.offsets.pokemonData.currentHp) }
  get speciesId () { return this.mapSpeciesToPokeId(this.view.getUint16(this.config.offsets.pokemonData.speciesId)) }
  get nameId () { return this.mapSpeciesToNameId(this.view.getUint16(this.config.offsets.pokemonData.speciesId)) }
  get item () { return this.mapItemToPokeId(this.view.getUint16(this.config.offsets.pokemonData.item)) }
  get itemIdName () { return this.mapItemToNameId(this.view.getUint16(this.config.offsets.pokemonData.item)) }
  get level () { return this.view.getUint8(this.config.offsets.pokemonData.level) }
  get status () { return this.view.getUint32(this.config.offsets.pokemonData.status) }

  // Move data
  get move1 () { return this.mapMoveToPokeId(this.view.getUint16(this.config.offsets.pokemonData.moves[0])) }
  get move2 () { return this.mapMoveToPokeId(this.view.getUint16(this.config.offsets.pokemonData.moves[1])) }
  get move3 () { return this.mapMoveToPokeId(this.view.getUint16(this.config.offsets.pokemonData.moves[2])) }
  get move4 () { return this.mapMoveToPokeId(this.view.getUint16(this.config.offsets.pokemonData.moves[3])) }
  get pp1 () { return this.view.getUint8(this.config.offsets.pokemonData.ppValues[0]) }
  get pp2 () { return this.view.getUint8(this.config.offsets.pokemonData.ppValues[1]) }
  get pp3 () { return this.view.getUint8(this.config.offsets.pokemonData.ppValues[2]) }
  get pp4 () { return this.view.getUint8(this.config.offsets.pokemonData.ppValues[3]) }

  // Individual stats (common across games)
  get maxHp () { return this.view.getUint16(this.config.offsets.pokemonData.stats[0]) }
  set maxHp (value: number) { this.view.setUint16(this.config.offsets.pokemonData.stats[0], value) }
  get attack () { return this.view.getUint16(this.config.offsets.pokemonData.stats[1]) }
  set attack (value: number) { this.view.setUint16(this.config.offsets.pokemonData.stats[1], value) }
  get defense () { return this.view.getUint16(this.config.offsets.pokemonData.stats[2]) }
  set defense (value: number) { this.view.setUint16(this.config.offsets.pokemonData.stats[2], value) }
  get speed () { return this.view.getUint16(this.config.offsets.pokemonData.stats[3]) }
  set speed (value: number) { this.view.setUint16(this.config.offsets.pokemonData.stats[3], value) }
  get spAttack () { return this.view.getUint16(this.config.offsets.pokemonData.stats[4]) }
  set spAttack (value: number) { this.view.setUint16(this.config.offsets.pokemonData.stats[4], value) }
  get spDefense () { return this.view.getUint16(this.config.offsets.pokemonData.stats[5]) }
  set spDefense (value: number) { this.view.setUint16(this.config.offsets.pokemonData.stats[5], value) }

  // Individual EVs (common across games) 
  get hpEV () { return this.view.getUint8(this.config.offsets.pokemonData.evs[0]) }
  set hpEV (value: number) { this.view.setUint8(this.config.offsets.pokemonData.evs[0], value) }
  get atkEV () { return this.view.getUint8(this.config.offsets.pokemonData.evs[1]) }
  set atkEV (value: number) { this.view.setUint8(this.config.offsets.pokemonData.evs[1], value) }
  get defEV () { return this.view.getUint8(this.config.offsets.pokemonData.evs[2]) }
  set defEV (value: number) { this.view.setUint8(this.config.offsets.pokemonData.evs[2], value) }
  get speEV () { return this.view.getUint8(this.config.offsets.pokemonData.evs[3]) }
  set speEV (value: number) { this.view.setUint8(this.config.offsets.pokemonData.evs[3], value) }
  get spaEV () { return this.view.getUint8(this.config.offsets.pokemonData.evs[4]) }
  set spaEV (value: number) { this.view.setUint8(this.config.offsets.pokemonData.evs[4], value) }
  get spdEV () { return this.view.getUint8(this.config.offsets.pokemonData.evs[5]) }
  set spdEV (value: number) { this.view.setUint8(this.config.offsets.pokemonData.evs[5], value) }

  // Nature and ability (common logic)
  get natureId (): number {
    return this.personality % 25
  }

  get natureModifiers (): { readonly increased: number, readonly decreased: number } {
    const nature = getPokemonNature(this.natureId)
    return natureEffects[nature] ?? { increased: -1, decreased: -1 }
  }

  get natureModifiersArray (): readonly number[] {
    const { increased, decreased } = this.natureModifiers
    return this.stats.map((_, i) =>
      i === increased ? 1.1 : i === decreased ? 0.9 : 1,
    )
  }

  get abilityNumber (): number {
    // Common logic across games
    return (this.status & 16) ? 1 : (this.status & 32) ? 2 : 0
  }

  // Array getters (common logic)
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

  get moveIds (): readonly number[] {
    return [this.move1, this.move2, this.move3, this.move4]
  }

  get ppValues (): readonly number[] {
    return [this.pp1, this.pp2, this.pp3, this.pp4]
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

  get totalEVs (): number {
    return this.evs.reduce((sum, ev) => sum + ev, 0)
  }

  get totalIVs (): number {
    return this.ivs.reduce((sum, iv) => sum + iv, 0)
  }

  // Utility methods that depend on mappings
  setEvByIndex (statIndex: number, value: number): void {
    switch (statIndex) {
      case 0: this.hpEV = value; break
      case 1: this.atkEV = value; break
      case 2: this.defEV = value; break
      case 3: this.speEV = value; break
      case 4: this.spaEV = value; break
      case 5: this.spdEV = value; break
      default: throw new Error(`Invalid stat index: ${statIndex}`)
    }
  }

  mapSpeciesToPokeId (speciesId: number): number {
    return this.config.mappings.pokemon.get(speciesId)?.id ?? 0
  }

  mapSpeciesToNameId (speciesId: number): string {
    return this.config.mappings.pokemon.get(speciesId)?.id_name ?? 'unknown'
  }

  mapItemToPokeId (itemId: number): number {
    return this.config.mappings.items.get(itemId)?.id ?? 0
  }

  mapItemToNameId (itemId: number): string {
    return this.config.mappings.items.get(itemId)?.id_name ?? 'unknown'
  }

  mapMoveToPokeId (moveId: number): number {
    return this.config.mappings.moves.get(moveId)?.id ?? 0
  }

  mapMoveToNameId (moveId: number): string {
    return this.config.mappings.moves.get(moveId)?.id_name ?? 'unknown'
  }

  // Abstract methods that must be implemented by game-specific classes
  abstract get ivs (): readonly number[]
  abstract set ivs (values: readonly number[])
  abstract get isShiny (): boolean
}