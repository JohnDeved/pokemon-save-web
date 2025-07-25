/**
 * Pokemon data implementation with vanilla Pokemon Emerald as the baseline
 * All vanilla behavior is built-in, game configs only override what's different
 */

import type {
  GameConfig,
} from '../core/types'
import {
  VANILLA_POKEMON_OFFSETS,
  VANILLA_SAVE_LAYOUT,
} from '../core/types'
import type { MoveData, PokemonMoves } from './types'
import { bytesToGbaString, natureEffects, natures, statStrings } from './utils'

/**
 * Pokemon data class with vanilla Pokemon Emerald as the baseline
 * Game configs provide minimal overrides for different games
 */
export class PokemonData {
  protected readonly view: DataView
  protected readonly config: GameConfig
  protected readonly offsets: typeof VANILLA_POKEMON_OFFSETS
  protected readonly saveLayout: typeof VANILLA_SAVE_LAYOUT

  constructor (protected readonly data: Uint8Array, config: GameConfig) {
    // Merge config overrides with vanilla defaults
    this.offsets = { ...VANILLA_POKEMON_OFFSETS, ...config.offsetOverrides }
    this.saveLayout = { ...VANILLA_SAVE_LAYOUT, ...config.saveLayoutOverrides }
    const pokemonSize = config.pokemonSize ?? VANILLA_SAVE_LAYOUT.pokemonSize

    if (data.length < pokemonSize) {
      throw new Error(`Insufficient data for Pokemon: ${data.length} bytes`)
    }
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    this.config = config
  }

  // Basic unencrypted properties (common to all games)
  get personality () { return this.view.getUint32(this.offsets.personality, true) }
  get otId () { return this.view.getUint32(this.offsets.otId, true) }
  get currentHp () { return this.view.getUint16(this.offsets.currentHp, true) }
  get status () { return this.view.getUint8(this.offsets.status) }
  get level () { return this.view.getUint8(this.offsets.level) }
  get maxHp () { return this.view.getUint16(this.offsets.maxHp, true) }
  set maxHp (value) { this.view.setUint16(this.offsets.maxHp, value, true) }
  get attack () { return this.view.getUint16(this.offsets.attack, true) }
  set attack (value) { this.view.setUint16(this.offsets.attack, value, true) }
  get defense () { return this.view.getUint16(this.offsets.defense, true) }
  set defense (value) { this.view.setUint16(this.offsets.defense, value, true) }
  get speed () { return this.view.getUint16(this.offsets.speed, true) }
  set speed (value) { this.view.setUint16(this.offsets.speed, value, true) }
  get spAttack () { return this.view.getUint16(this.offsets.spAttack, true) }
  set spAttack (value) { this.view.setUint16(this.offsets.spAttack, value, true) }
  get spDefense () { return this.view.getUint16(this.offsets.spDefense, true) }
  set spDefense (value) { this.view.setUint16(this.offsets.spDefense, value, true) }

  private get nicknameRaw () {
    return new Uint8Array(this.view.buffer, this.view.byteOffset + this.offsets.nickname, this.offsets.nicknameLength)
  }

  private get otNameRaw () {
    return new Uint8Array(this.view.buffer, this.view.byteOffset + this.offsets.otName, this.offsets.otNameLength)
  }

  // Vanilla Emerald encryption methods (can be overridden by configs)
  protected getEncryptionKey (data: Uint8Array): number {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    const personality = view.getUint32(0x00, true)
    const otId = view.getUint32(0x04, true)
    return personality ^ otId
  }

  protected getSubstructOrder (personality: number): number[] {
    const orderTable = [
      [0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 1, 3], [0, 3, 1, 2], [0, 2, 3, 1], [0, 3, 2, 1],
      [1, 0, 2, 3], [1, 0, 3, 2], [2, 0, 1, 3], [3, 0, 1, 2], [2, 0, 3, 1], [3, 0, 2, 1],
      [1, 2, 0, 3], [1, 3, 0, 2], [2, 1, 0, 3], [3, 1, 0, 2], [2, 3, 0, 1], [3, 2, 0, 1],
      [1, 2, 3, 0], [1, 3, 2, 0], [2, 1, 3, 0], [3, 1, 2, 0], [2, 3, 1, 0], [3, 2, 1, 0],
    ]
    return orderTable[personality % 24]!
  }

  protected setEncryptedSubstruct (substructIndex: number, decryptedData: Uint8Array): void {
    const view = new DataView(this.data.buffer, this.data.byteOffset, this.data.byteLength)
    const personality = view.getUint32(0x00, true)
    const order = this.getSubstructOrder(personality)
    const actualIndex = order[substructIndex]!
    const substructOffset = 0x20 + actualIndex * 12

    if (decryptedData.length !== 12) {
      throw new Error(`Substruct data must be 12 bytes, got ${decryptedData.length}`)
    }

    // Encrypt the data
    const key = this.getEncryptionKey(this.data)
    for (let i = 0; i < 12; i += 4) {
      const decView = new DataView(decryptedData.buffer, decryptedData.byteOffset + i, 4)
      const decrypted = decView.getUint32(0, true)
      const encrypted = decrypted ^ key

      // Write encrypted data back to original location
      const origView = new DataView(this.data.buffer, this.data.byteOffset + substructOffset + i, 4)
      origView.setUint32(0, encrypted, true)
    }
  }

  protected getDecryptedSubstruct (data: Uint8Array, substructIndex: number): Uint8Array {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    const personality = view.getUint32(0x00, true)
    const order = this.getSubstructOrder(personality)
    const actualIndex = order[substructIndex]!
    const substructOffset = 0x20 + actualIndex * 12
    const encryptedData = new Uint8Array(data.buffer, data.byteOffset + substructOffset, 12)
    const decryptedData = new Uint8Array(12)

    const key = this.getEncryptionKey(data)
    for (let i = 0; i < 12; i += 4) {
      const encView = new DataView(encryptedData.buffer, encryptedData.byteOffset + i, 4)
      const encrypted = encView.getUint32(0, true)
      const decrypted = encrypted ^ key

      const decView = new DataView(decryptedData.buffer, i, 4)
      decView.setUint32(0, decrypted, true)
    }

    return decryptedData
  }

  // Game-specific data access with config overrides or vanilla defaults
  get speciesId () {
    const rawSpecies = this.config.getSpeciesId?.(this.data, this.view) ?? this.getVanillaSpeciesId()
    // Apply ID mapping if available
    return this.config.mappings?.pokemon?.get(rawSpecies)?.id ?? rawSpecies
  }

  get nameId () {
    const configName = this.config.getPokemonName?.(this.data, this.view)
    if (configName) return configName

    // For vanilla, try to get name from mapping
    const rawSpecies = this.getVanillaSpeciesId()
    return this.config.mappings?.pokemon?.get(rawSpecies)?.name ?? this.getVanillaPokemonName()
  }

  get item () {
    const rawItem = this.config.getItem?.(this.data, this.view) ?? this.getVanillaItem()
    // Apply ID mapping if available
    return this.config.mappings?.items?.get(rawItem)?.id ?? rawItem
  }

  get itemIdName () {
    const configName = this.config.getItemName?.(this.data, this.view)
    if (configName) return configName

    // For vanilla, try to get name from mapping
    const rawItem = this.getVanillaItem()
    return this.config.mappings?.items?.get(rawItem)?.name ?? this.getVanillaItemName()
  }

  get move1 () {
    const rawMove = this.config.getMove?.(this.data, this.view, 0) ?? this.getVanillaMove(0)
    // Apply ID mapping if available
    return this.config.mappings?.moves?.get(rawMove)?.id ?? rawMove
  }

  get move2 () {
    const rawMove = this.config.getMove?.(this.data, this.view, 1) ?? this.getVanillaMove(1)
    // Apply ID mapping if available
    return this.config.mappings?.moves?.get(rawMove)?.id ?? rawMove
  }

  get move3 () {
    const rawMove = this.config.getMove?.(this.data, this.view, 2) ?? this.getVanillaMove(2)
    // Apply ID mapping if available
    return this.config.mappings?.moves?.get(rawMove)?.id ?? rawMove
  }

  get move4 () {
    const rawMove = this.config.getMove?.(this.data, this.view, 3) ?? this.getVanillaMove(3)
    // Apply ID mapping if available
    return this.config.mappings?.moves?.get(rawMove)?.id ?? rawMove
  }

  get pp1 () {
    return this.config.getPP?.(this.data, this.view, 0) ?? this.getVanillaPP(0)
  }

  get pp2 () {
    return this.config.getPP?.(this.data, this.view, 1) ?? this.getVanillaPP(1)
  }

  get pp3 () {
    return this.config.getPP?.(this.data, this.view, 2) ?? this.getVanillaPP(2)
  }

  get pp4 () {
    return this.config.getPP?.(this.data, this.view, 3) ?? this.getVanillaPP(3)
  }

  get hpEV () {
    return this.config.getEV?.(this.data, this.view, 0) ?? this.getVanillaEV(0)
  }

  set hpEV (value) {
    if (this.config.setEV) {
      this.config.setEV(this.data, this.view, 0, value)
    } else {
      this.setVanillaEV(0, value)
    }
  }

  get atkEV () {
    return this.config.getEV?.(this.data, this.view, 1) ?? this.getVanillaEV(1)
  }

  set atkEV (value) {
    if (this.config.setEV) {
      this.config.setEV(this.data, this.view, 1, value)
    } else {
      this.setVanillaEV(1, value)
    }
  }

  get defEV () {
    return this.config.getEV?.(this.data, this.view, 2) ?? this.getVanillaEV(2)
  }

  set defEV (value) {
    if (this.config.setEV) {
      this.config.setEV(this.data, this.view, 2, value)
    } else {
      this.setVanillaEV(2, value)
    }
  }

  get speEV () {
    return this.config.getEV?.(this.data, this.view, 3) ?? this.getVanillaEV(3)
  }

  set speEV (value) {
    if (this.config.setEV) {
      this.config.setEV(this.data, this.view, 3, value)
    } else {
      this.setVanillaEV(3, value)
    }
  }

  get spaEV () {
    return this.config.getEV?.(this.data, this.view, 4) ?? this.getVanillaEV(4)
  }

  set spaEV (value) {
    if (this.config.setEV) {
      this.config.setEV(this.data, this.view, 4, value)
    } else {
      this.setVanillaEV(4, value)
    }
  }

  get spdEV () {
    return this.config.getEV?.(this.data, this.view, 5) ?? this.getVanillaEV(5)
  }

  set spdEV (value) {
    if (this.config.setEV) {
      this.config.setEV(this.data, this.view, 5, value)
    } else {
      this.setVanillaEV(5, value)
    }
  }

  get ivs (): readonly number[] {
    return this.config.getIVs?.(this.data, this.view) ?? this.getVanillaIVs()
  }

  set ivs (values: readonly number[]) {
    if (this.config.setIVs) {
      this.config.setIVs(this.data, this.view, values)
    } else {
      this.setVanillaIVs(values)
    }
  }

  get isShiny (): boolean {
    return this.config.isShiny?.(this.personality, this.otId) ?? this.getVanillaIsShiny()
  }

  get shinyNumber (): number {
    return this.config.getShinyValue?.(this.personality, this.otId) ?? this.getVanillaShinyNumber()
  }

  get isRadiant (): boolean {
    return this.config.isRadiant?.(this.personality, this.otId) ?? false // Vanilla doesn't have radiant
  }

  // Vanilla Emerald implementation methods (with encryption)
  private getVanillaSpeciesId (): number {
    try {
      const substruct0 = this.getDecryptedSubstruct(this.data, 0)
      const subView = new DataView(substruct0.buffer, substruct0.byteOffset, substruct0.byteLength)
      return subView.getUint16(0, true)
    } catch {
      return 0
    }
  }

  private getVanillaPokemonName (): string | undefined {
    return undefined // Vanilla stores raw species ID, name lookup is external
  }

  private getVanillaItem (): number {
    try {
      const substruct0 = this.getDecryptedSubstruct(this.data, 0)
      const subView = new DataView(substruct0.buffer, substruct0.byteOffset, substruct0.byteLength)
      return subView.getUint16(2, true)
    } catch {
      return 0
    }
  }

  private getVanillaItemName (): string | undefined {
    return undefined // Vanilla stores raw item ID, name lookup is external
  }

  private getVanillaMove (index: number): number {
    try {
      const substruct1 = this.getDecryptedSubstruct(this.data, 1)
      const subView = new DataView(substruct1.buffer, substruct1.byteOffset, substruct1.byteLength)
      return subView.getUint16(index * 2, true)
    } catch {
      return 0
    }
  }

  private getVanillaPP (index: number): number {
    try {
      const substruct1 = this.getDecryptedSubstruct(this.data, 1)
      return substruct1[8 + index]!
    } catch {
      return 0
    }
  }

  private getVanillaEV (index: number): number {
    try {
      const substruct2 = this.getDecryptedSubstruct(this.data, 2)
      return substruct2[index]!
    } catch {
      return 0
    }
  }

  private setVanillaEV (index: number, value: number): void {
    try {
      // Get current substruct 2 (EVs)
      const substruct2 = this.getDecryptedSubstruct(this.data, 2)

      // Modify the EV at the given index
      substruct2[index] = Math.max(0, Math.min(255, value))

      // Encrypt and write back to the original data
      this.setEncryptedSubstruct(2, substruct2)
    } catch (error) {
      console.warn('Failed to set vanilla EV:', error)
    }
  }

  private getVanillaIVs (): readonly number[] {
    try {
      const substruct3 = this.getDecryptedSubstruct(this.data, 3)
      const subView = new DataView(substruct3.buffer, substruct3.byteOffset, substruct3.byteLength)
      const ivData = subView.getUint32(4, true)

      return [
        (ivData >> 0) & 0x1F, // HP
        (ivData >> 5) & 0x1F, // Attack
        (ivData >> 10) & 0x1F, // Defense
        (ivData >> 15) & 0x1F, // Speed
        (ivData >> 20) & 0x1F, // Sp. Attack
        (ivData >> 25) & 0x1F, // Sp. Defense
      ]
    } catch {
      return [0, 0, 0, 0, 0, 0]
    }
  }

  private setVanillaIVs (values: readonly number[]): void {
    try {
      if (values.length !== 6) throw new Error('IVs array must have 6 values')

      // Get current substruct 3 (IVs and other data)
      const substruct3 = this.getDecryptedSubstruct(this.data, 3)
      const subView = new DataView(substruct3.buffer, substruct3.byteOffset, substruct3.byteLength)

      // Pack IVs into 32-bit value (same format as reading)
      let ivData = 0
      ivData |= (values[0]! & 0x1F) << 0 // HP
      ivData |= (values[1]! & 0x1F) << 5 // Attack
      ivData |= (values[2]! & 0x1F) << 10 // Defense
      ivData |= (values[3]! & 0x1F) << 15 // Speed
      ivData |= (values[4]! & 0x1F) << 20 // Sp. Attack
      ivData |= (values[5]! & 0x1F) << 25 // Sp. Defense

      // Write the packed IV data back to substruct 3 at offset 4
      subView.setUint32(4, ivData, true)

      // Encrypt and write back to the original data
      this.setEncryptedSubstruct(3, substruct3)
    } catch (error) {
      console.warn('Failed to set vanilla IVs:', error)
    }
  }

  private getVanillaIsShiny (): boolean {
    return this.getVanillaShinyNumber() < 8
  }

  private getVanillaShinyNumber (): number {
    const personality = this.view.getUint32(0x00, true)
    const otId = this.view.getUint32(0x04, true)
    const trainerId = otId & 0xFFFF
    const secretId = (otId >> 16) & 0xFFFF
    const personalityLow = personality & 0xFFFF
    const personalityHigh = (personality >> 16) & 0xFFFF
    return trainerId ^ secretId ^ personalityLow ^ personalityHigh
  }

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
    // Use config override or vanilla Gen 3 standard formula
    return this.config.calculateNature?.(this.personality) ?? natures[this.personality % 25]!
  }

  get natureRaw (): number {
    const nature = this.nature
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
