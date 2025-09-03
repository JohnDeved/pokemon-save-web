/**
 * Pokemon data implementation with vanilla Pokemon Emerald as the baseline
 * All vanilla behavior is built-in, game configs only override what's different
 */

import { VANILLA_POKEMON_OFFSETS, VANILLA_SAVE_LAYOUT, type GameConfig, type MoveData, type PokemonMoves } from './types'
import { bytesToGbaString, natureEffects, natures, statStrings } from './utils'

/**
 * Pokemon data class with vanilla Pokemon Emerald as the baseline
 * Game configs provide minimal overrides for different games
 */
export class PokemonBase {
  protected readonly view: DataView
  protected readonly config: GameConfig
  protected readonly offsets: typeof VANILLA_POKEMON_OFFSETS
  protected readonly saveLayout: typeof VANILLA_SAVE_LAYOUT

  constructor(
    protected readonly data: Uint8Array,
    config: GameConfig
  ) {
    // Merge config overrides with vanilla defaults
    this.offsets = { ...VANILLA_POKEMON_OFFSETS, ...config.offsetOverrides }
    this.saveLayout = { ...VANILLA_SAVE_LAYOUT, ...config.saveLayoutOverrides }
    // Use a safe fallback when pokemonSize is not provided in config
    const pokemonSize = typeof config.pokemonSize === 'number' ? config.pokemonSize : 100

    if (data.length < pokemonSize) {
      throw new Error(`Insufficient data for Pokemon: ${data.length} bytes`)
    }
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    this.config = config
  }

  // Basic unencrypted properties (common to all games)
  get personality() {
    return this.view.getUint32(this.offsets.personality, true)
  }
  get otId() {
    return this.view.getUint32(this.offsets.otId, true)
  }
  get currentHp() {
    return this.view.getUint16(this.offsets.currentHp, true)
  }
  get status() {
    return this.view.getUint8(this.offsets.status)
  }
  get level() {
    return this.view.getUint8(this.offsets.level)
  }
  get maxHp() {
    return this.view.getUint16(this.offsets.maxHp, true)
  }
  set maxHp(value) {
    this.view.setUint16(this.offsets.maxHp, value, true)
  }
  get attack() {
    return this.view.getUint16(this.offsets.attack, true)
  }
  set attack(value) {
    this.view.setUint16(this.offsets.attack, value, true)
  }
  get defense() {
    return this.view.getUint16(this.offsets.defense, true)
  }
  set defense(value) {
    this.view.setUint16(this.offsets.defense, value, true)
  }
  get speed() {
    return this.view.getUint16(this.offsets.speed, true)
  }
  set speed(value) {
    this.view.setUint16(this.offsets.speed, value, true)
  }
  get spAttack() {
    return this.view.getUint16(this.offsets.spAttack, true)
  }
  set spAttack(value) {
    this.view.setUint16(this.offsets.spAttack, value, true)
  }
  get spDefense() {
    return this.view.getUint16(this.offsets.spDefense, true)
  }
  set spDefense(value) {
    this.view.setUint16(this.offsets.spDefense, value, true)
  }

  private get nicknameRaw() {
    return new Uint8Array(this.view.buffer, this.view.byteOffset + this.offsets.nickname, this.offsets.nicknameLength)
  }

  private get otNameRaw() {
    return new Uint8Array(this.view.buffer, this.view.byteOffset + this.offsets.otName, this.offsets.otNameLength)
  }

  // Vanilla Emerald encryption methods (can be overridden by configs)
  protected getEncryptionKey(data: Uint8Array): number {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    const personality = view.getUint32(0x00, true)
    const otId = view.getUint32(0x04, true)
    return personality ^ otId
  }

  protected getSubstructOrder(personality: number): number[] {
    const orderTable = [
      [0, 1, 2, 3],
      [0, 1, 3, 2],
      [0, 2, 1, 3],
      [0, 3, 1, 2],
      [0, 2, 3, 1],
      [0, 3, 2, 1],
      [1, 0, 2, 3],
      [1, 0, 3, 2],
      [2, 0, 1, 3],
      [3, 0, 1, 2],
      [2, 0, 3, 1],
      [3, 0, 2, 1],
      [1, 2, 0, 3],
      [1, 3, 0, 2],
      [2, 1, 0, 3],
      [3, 1, 0, 2],
      [2, 3, 0, 1],
      [3, 2, 0, 1],
      [1, 2, 3, 0],
      [1, 3, 2, 0],
      [2, 1, 3, 0],
      [3, 1, 2, 0],
      [2, 3, 1, 0],
      [3, 2, 1, 0],
    ]
    return orderTable[personality % 24]!
  }

  protected setEncryptedSubstruct(substructIndex: number, decryptedData: Uint8Array): void {
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

  protected getDecryptedSubstruct(data: Uint8Array, substructIndex: number): Uint8Array {
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
  get speciesId() {
    if (this.config.getSpeciesId) {
      const rawSpecies = this.config.getSpeciesId(this.data, this.view)
      return this.config.mappings?.pokemon?.get(rawSpecies)?.id ?? rawSpecies
    }
    // Vanilla: species ID is first 2 bytes of decrypted substruct 0
    const substruct0 = this.getDecryptedSubstruct(this.data, 0)
    const subView = new DataView(substruct0.buffer, substruct0.byteOffset, substruct0.byteLength)
    const rawSpecies = subView.getUint16(0, true)
    return this.config.mappings?.pokemon?.get(rawSpecies)?.id ?? rawSpecies
  }

  get nameId() {
    if (this.config.getPokemonName) {
      return this.config.getPokemonName(this.data, this.view)
    }
    // Vanilla: species ID is first 2 bytes of decrypted substruct 0
    const substruct0 = this.getDecryptedSubstruct(this.data, 0)
    const subView = new DataView(substruct0.buffer, substruct0.byteOffset, substruct0.byteLength)
    const rawSpecies = subView.getUint16(0, true)
    // Access optional mapping safely; return undefined if not present
    return this.config.mappings?.pokemon?.get(rawSpecies)?.id_name
  }

  get item() {
    if (this.config.getItem) {
      const rawItem = this.config.getItem(this.data, this.view)
      return this.config.mappings?.items?.get(rawItem)?.id ?? rawItem
    }
    // Vanilla: item is bytes 2-3 of decrypted substruct 0
    const substruct0 = this.getDecryptedSubstruct(this.data, 0)
    const subView = new DataView(substruct0.buffer, substruct0.byteOffset, substruct0.byteLength)
    const rawItem = subView.getUint16(2, true)
    return this.config.mappings?.items?.get(rawItem)?.id ?? rawItem
  }

  get itemIdName() {
    if (this.config.getItemName) {
      return this.config.getItemName(this.data, this.view)
    }
    // Vanilla: item is bytes 2-3 of decrypted substruct 0
    const substruct0 = this.getDecryptedSubstruct(this.data, 0)
    const subView = new DataView(substruct0.buffer, substruct0.byteOffset, substruct0.byteLength)
    const rawItem = subView.getUint16(2, true)
    return this.config.mappings?.items?.get(rawItem)?.id_name
  }

  setItem(value: number | null): void {
    const mappedId = value ?? 0
    if (this.config.setItem) {
      // Delegate to config-specific implementation
      this.config.setItem(this.data, this.view, mappedId)
      return
    }
    // Vanilla: write to bytes 2-3 of decrypted substruct 0
    const substruct0 = this.getDecryptedSubstruct(this.data, 0)
    const subView = new DataView(substruct0.buffer, substruct0.byteOffset, substruct0.byteLength)
    // Convert mapped (external) ID back to raw internal using mapping if available
    let rawValue = mappedId
    const items = this.config.mappings?.items
    if (items) {
      for (const [raw, entry] of items.entries()) {
        if (entry.id === mappedId) {
          rawValue = raw
          break
        }
      }
    }
    subView.setUint16(2, rawValue, true)
    this.setEncryptedSubstruct(0, substruct0)
  }

  get move1() {
    if (this.config.getMove) {
      const rawMove = this.config.getMove(this.data, this.view, 0)
      return this.config.mappings?.moves?.get(rawMove)?.id ?? rawMove
    }
    // Vanilla: move1 is bytes 0-1 of decrypted substruct 1
    const substruct1 = this.getDecryptedSubstruct(this.data, 1)
    const subView = new DataView(substruct1.buffer, substruct1.byteOffset, substruct1.byteLength)
    const rawMove = subView.getUint16(0, true)
    return this.config.mappings?.moves?.get(rawMove)?.id ?? rawMove
  }

  get move2() {
    if (this.config.getMove) {
      const rawMove = this.config.getMove(this.data, this.view, 1)
      return this.config.mappings?.moves?.get(rawMove)?.id ?? rawMove
    }
    // Vanilla: move2 is bytes 2-3 of decrypted substruct 1
    const substruct1 = this.getDecryptedSubstruct(this.data, 1)
    const subView = new DataView(substruct1.buffer, substruct1.byteOffset, substruct1.byteLength)
    const rawMove = subView.getUint16(2, true)
    return this.config.mappings?.moves?.get(rawMove)?.id ?? rawMove
  }

  get move3() {
    if (this.config.getMove) {
      const rawMove = this.config.getMove(this.data, this.view, 2)
      return this.config.mappings?.moves?.get(rawMove)?.id ?? rawMove
    }
    // Vanilla: move3 is bytes 4-5 of decrypted substruct 1
    const substruct1 = this.getDecryptedSubstruct(this.data, 1)
    const subView = new DataView(substruct1.buffer, substruct1.byteOffset, substruct1.byteLength)
    const rawMove = subView.getUint16(4, true)
    return this.config.mappings?.moves?.get(rawMove)?.id ?? rawMove
  }

  get move4() {
    if (this.config.getMove) {
      const rawMove = this.config.getMove(this.data, this.view, 3)
      return this.config.mappings?.moves?.get(rawMove)?.id ?? rawMove
    }
    // Vanilla: move4 is bytes 6-7 of decrypted substruct 1
    const substruct1 = this.getDecryptedSubstruct(this.data, 1)
    const subView = new DataView(substruct1.buffer, substruct1.byteOffset, substruct1.byteLength)
    const rawMove = subView.getUint16(6, true)
    return this.config.mappings?.moves?.get(rawMove)?.id ?? rawMove
  }

  get pp1() {
    if (this.config.getPP) return this.config.getPP(this.data, this.view, 0)
    // Vanilla: pp1 is byte 8 of decrypted substruct 1
    const substruct1 = this.getDecryptedSubstruct(this.data, 1)
    return substruct1[8]!
  }

  get pp2() {
    if (this.config.getPP) return this.config.getPP(this.data, this.view, 1)
    // Vanilla: pp2 is byte 9 of decrypted substruct 1
    const substruct1 = this.getDecryptedSubstruct(this.data, 1)
    return substruct1[9]!
  }

  get pp3() {
    if (this.config.getPP) return this.config.getPP(this.data, this.view, 2)
    // Vanilla: pp3 is byte 10 of decrypted substruct 1
    const substruct1 = this.getDecryptedSubstruct(this.data, 1)
    return substruct1[10]!
  }

  get pp4() {
    if (this.config.getPP) return this.config.getPP(this.data, this.view, 3)
    // Vanilla: pp4 is byte 11 of decrypted substruct 1
    const substruct1 = this.getDecryptedSubstruct(this.data, 1)
    return substruct1[11]!
  }

  get hpEV() {
    if (this.config.getEV) return this.config.getEV(this.data, this.view, 0)
    // Vanilla: hpEV is byte 0 of decrypted substruct 2
    const substruct2 = this.getDecryptedSubstruct(this.data, 2)
    return substruct2[0]!
  }

  set hpEV(value) {
    if (this.config.setEV) {
      this.config.setEV(this.data, this.view, 0, value)
    } else {
      // Inline vanilla logic
      const substruct2 = this.getDecryptedSubstruct(this.data, 2)
      substruct2[0] = Math.max(0, Math.min(255, value))
      this.setEncryptedSubstruct(2, substruct2)
    }
  }

  get atkEV() {
    if (this.config.getEV) return this.config.getEV(this.data, this.view, 1)
    // Vanilla: atkEV is byte 1 of decrypted substruct 2
    const substruct2 = this.getDecryptedSubstruct(this.data, 2)
    return substruct2[1]!
  }

  set atkEV(value) {
    if (this.config.setEV) {
      this.config.setEV(this.data, this.view, 1, value)
    } else {
      const substruct2 = this.getDecryptedSubstruct(this.data, 2)
      substruct2[1] = Math.max(0, Math.min(255, value))
      this.setEncryptedSubstruct(2, substruct2)
    }
  }

  get defEV() {
    if (this.config.getEV) return this.config.getEV(this.data, this.view, 2)
    // Vanilla: defEV is byte 2 of decrypted substruct 2
    const substruct2 = this.getDecryptedSubstruct(this.data, 2)
    return substruct2[2]!
  }

  set defEV(value) {
    if (this.config.setEV) {
      this.config.setEV(this.data, this.view, 2, value)
    } else {
      const substruct2 = this.getDecryptedSubstruct(this.data, 2)
      substruct2[2] = Math.max(0, Math.min(255, value))
      this.setEncryptedSubstruct(2, substruct2)
    }
  }

  get speEV() {
    if (this.config.getEV) return this.config.getEV(this.data, this.view, 3)
    // Vanilla: speEV is byte 3 of decrypted substruct 2
    const substruct2 = this.getDecryptedSubstruct(this.data, 2)
    return substruct2[3]!
  }

  set speEV(value) {
    if (this.config.setEV) {
      this.config.setEV(this.data, this.view, 3, value)
    } else {
      const substruct2 = this.getDecryptedSubstruct(this.data, 2)
      substruct2[3] = Math.max(0, Math.min(255, value))
      this.setEncryptedSubstruct(2, substruct2)
    }
  }

  get spaEV() {
    if (this.config.getEV) return this.config.getEV(this.data, this.view, 4)
    // Vanilla: spaEV is byte 4 of decrypted substruct 2
    const substruct2 = this.getDecryptedSubstruct(this.data, 2)
    return substruct2[4]!
  }

  set spaEV(value) {
    if (this.config.setEV) {
      this.config.setEV(this.data, this.view, 4, value)
    } else {
      const substruct2 = this.getDecryptedSubstruct(this.data, 2)
      substruct2[4] = Math.max(0, Math.min(255, value))
      this.setEncryptedSubstruct(2, substruct2)
    }
  }

  get spdEV() {
    if (this.config.getEV) return this.config.getEV(this.data, this.view, 5)
    // Vanilla: spdEV is byte 5 of decrypted substruct 2
    const substruct2 = this.getDecryptedSubstruct(this.data, 2)
    return substruct2[5]!
  }

  set spdEV(value) {
    if (this.config.setEV) {
      this.config.setEV(this.data, this.view, 5, value)
    } else {
      const substruct2 = this.getDecryptedSubstruct(this.data, 2)
      substruct2[5] = Math.max(0, Math.min(255, value))
      this.setEncryptedSubstruct(2, substruct2)
    }
  }

  get ivs(): readonly number[] {
    if (this.config.getIVs) return this.config.getIVs(this.data, this.view)
    // Vanilla: IVs are packed into bytes 4-7 of decrypted substruct 3
    const substruct3 = this.getDecryptedSubstruct(this.data, 3)
    const subView = new DataView(substruct3.buffer, substruct3.byteOffset, substruct3.byteLength)
    const ivData = subView.getUint32(4, true)
    return [
      (ivData >> 0) & 0x1f, // HP
      (ivData >> 5) & 0x1f, // Attack
      (ivData >> 10) & 0x1f, // Defense
      (ivData >> 15) & 0x1f, // Speed
      (ivData >> 20) & 0x1f, // Sp. Attack
      (ivData >> 25) & 0x1f, // Sp. Defense
    ]
  }

  set ivs(values: readonly number[]) {
    if (this.config.setIVs) {
      this.config.setIVs(this.data, this.view, values)
    } else {
      if (values.length !== 6) throw new Error('IVs array must have 6 values')
      const substruct3 = this.getDecryptedSubstruct(this.data, 3)
      const subView = new DataView(substruct3.buffer, substruct3.byteOffset, substruct3.byteLength)
      let ivData = 0
      ivData |= (values[0]! & 0x1f) << 0 // HP
      ivData |= (values[1]! & 0x1f) << 5 // Attack
      ivData |= (values[2]! & 0x1f) << 10 // Defense
      ivData |= (values[3]! & 0x1f) << 15 // Speed
      ivData |= (values[4]! & 0x1f) << 20 // Sp. Attack
      ivData |= (values[5]! & 0x1f) << 25 // Sp. Defense
      subView.setUint32(4, ivData, true)
      this.setEncryptedSubstruct(3, substruct3)
    }
  }

  get isShiny(): boolean {
    if (this.config.isShiny) return this.config.isShiny(this.personality, this.otId)
    // Vanilla: shiny if shiny number < 8
    const personality = this.view.getUint32(0x00, true)
    const otId = this.view.getUint32(0x04, true)
    const trainerId = otId & 0xffff
    const secretId = (otId >> 16) & 0xffff
    const personalityLow = personality & 0xffff
    const personalityHigh = (personality >> 16) & 0xffff
    const shinyNumber = trainerId ^ secretId ^ personalityLow ^ personalityHigh
    return shinyNumber < 8
  }

  get shinyNumber(): number {
    if (this.config.getShinyValue) return this.config.getShinyValue(this.personality, this.otId)
    // Vanilla: shiny number calculation
    const personality = this.view.getUint32(0x00, true)
    const otId = this.view.getUint32(0x04, true)
    const trainerId = otId & 0xffff
    const secretId = (otId >> 16) & 0xffff
    const personalityLow = personality & 0xffff
    const personalityHigh = (personality >> 16) & 0xffff
    return trainerId ^ secretId ^ personalityLow ^ personalityHigh
  }

  get isRadiant(): boolean {
    if (this.config.isRadiant) return this.config.isRadiant(this.personality, this.otId)
    return false // Vanilla doesn't have radiant
  }

  get rawBytes() {
    return new Uint8Array(this.data)
  }

  // Computed properties
  get otId_str(): string {
    return (this.otId & 0xffff).toString().padStart(5, '0')
  }

  get nickname(): string {
    return bytesToGbaString(this.nicknameRaw)
  }

  get otName(): string {
    return bytesToGbaString(this.otNameRaw)
  }

  get nature(): string {
    // Use config override or vanilla Gen 3 standard formula
    return this.config.calculateNature?.(this.personality) ?? natures[this.personality % 25]!
  }

  get natureRaw(): number {
    const { nature } = this
    return natures.indexOf(nature)
  }

  set natureRaw(value: number) {
    if (value < 0 || value >= 25) {
      throw new Error(`Nature value must be between 0 and 24, got ${value}`)
    }

    if (this.config.setNature) {
      this.config.setNature(this.data, this.view, value)
    } else {
      // Vanilla implementation: modify personality to achieve desired nature
      // For encrypted Pokemon data, we need to preserve all encrypted data
      // when changing the personality value, since it affects the encryption key

      // Calculate the current nature and return early if already correct
      const currentNature = this.personality % 25
      if (currentNature === value) return

      // First, decrypt all substructs with the current key
      const substruct0 = this.getDecryptedSubstruct(this.data, 0)
      const substruct1 = this.getDecryptedSubstruct(this.data, 1)
      const substruct2 = this.getDecryptedSubstruct(this.data, 2)
      const substruct3 = this.getDecryptedSubstruct(this.data, 3)

      // Calculate new personality: preserve quotient, set remainder to desired nature
      const newPersonality = this.personality - currentNature + value

      // Update the personality value in the data
      this.view.setUint32(this.offsets.personality, newPersonality >>> 0, true)

      // Re-encrypt all substructs with the new key (which uses the new personality)
      this.setEncryptedSubstruct(0, substruct0)
      this.setEncryptedSubstruct(1, substruct1)
      this.setEncryptedSubstruct(2, substruct2)
      this.setEncryptedSubstruct(3, substruct3)
    }
  }

  get natureModifiers(): { increased: number; decreased: number } {
    // Neutral natures shouldn't modify any stats
    return natureEffects[this.nature] ?? { increased: -1, decreased: -1 }
  }

  get natureModifiersString(): { increased: string; decreased: string } {
    const { increased, decreased } = this.natureModifiers
    return {
      increased: increased >= 0 ? (statStrings[increased] ?? 'Unknown') : 'None',
      decreased: decreased >= 0 ? (statStrings[decreased] ?? 'Unknown') : 'None',
    }
  }

  get natureModifiersArray(): readonly number[] {
    // usage for statsArray
    // Nature modifiers: [hp, atk, def, spe, spa, spd]
    const { increased, decreased } = this.natureModifiers
    return this.stats.map((_, i) => {
      if (i === increased) return 1.1
      if (i === decreased) return 0.9
      return 1
    })
  }

  get abilityNumber(): number {
    // if 2nd bit of status is set, ability is 1
    // if 3rd bit is set, ability is 2
    // otherwise ability is 0
    if (this.status & 16) return 1
    if (this.status & 32) return 2
    return 0
  }

  set abilityNumber(value: number) {
    // Clamp to [0,2] and update encoded bits in status byte while preserving other flags
    const clamped = Math.max(0, Math.min(2, value | 0))
    const statusOffset = this.offsets.status
    const current = this.view.getUint8(statusOffset)
    // Clear ability bits (0x10 and 0x20), then set according to value
    let next = current & ~(0x10 | 0x20)
    if (clamped === 1) next |= 0x10
    else if (clamped === 2) next |= 0x20
    this.view.setUint8(statusOffset, next)
  }

  get stats(): readonly number[] {
    return [this.maxHp, this.attack, this.defense, this.speed, this.spAttack, this.spDefense]
  }

  set stats(values: readonly number[]) {
    if (values.length !== 6) throw new Error('Stats array must have 6 values')
    this.maxHp = values[0]!
    this.attack = values[1]!
    this.defense = values[2]!
    this.speed = values[3]!
    this.spAttack = values[4]!
    this.spDefense = values[5]!
  }

  setStats(values: readonly number[]): void {
    this.stats = values
  }

  setEvs(values: readonly number[]): void {
    this.evs = values
  }

  setIvs(values: readonly number[]): void {
    this.ivs = values
  }

  setNatureRaw(value: number): void {
    this.natureRaw = value
  }

  get moves(): {
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

  get moves_data(): PokemonMoves {
    return {
      move1: { id: this.move1, pp: this.pp1 },
      move2: { id: this.move2, pp: this.pp2 },
      move3: { id: this.move3, pp: this.pp3 },
      move4: { id: this.move4, pp: this.pp4 },
    }
  }

  get evs(): readonly number[] {
    return [this.hpEV, this.atkEV, this.defEV, this.speEV, this.spaEV, this.spdEV]
  }

  set evs(values: readonly number[]) {
    if (values.length !== 6) throw new Error('EVs array must have 6 values')
    this.hpEV = values[0]!
    this.atkEV = values[1]!
    this.defEV = values[2]!
    this.speEV = values[3]!
    this.spaEV = values[4]!
    this.spdEV = values[5]!
  }

  get totalEVs(): number {
    return this.evs.reduce((sum, ev) => sum + ev, 0)
  }

  get totalIVs(): number {
    return this.ivs.reduce((sum, iv) => sum + iv, 0)
  }

  get moveIds(): readonly number[] {
    return [this.move1, this.move2, this.move3, this.move4]
  }

  get ppValues(): readonly number[] {
    return [this.pp1, this.pp2, this.pp3, this.pp4]
  }

  setEvByIndex(statIndex: number, value: number): void {
    switch (statIndex) {
      case 0:
        this.hpEV = value
        break
      case 1:
        this.atkEV = value
        break
      case 2:
        this.defEV = value
        break
      case 3:
        this.speEV = value
        break
      case 4:
        this.spaEV = value
        break
      case 5:
        this.spdEV = value
        break
      default:
        throw new Error(`Invalid EV index: ${statIndex}`)
    }
  }

  setIvByIndex(statIndex: number, value: number): void {
    if (statIndex < 0 || statIndex > 5) {
      throw new Error(`Invalid IV index: ${statIndex}`)
    }
    const clampedValue = Math.max(0, Math.min(31, value))
    const currentIvs = [...this.ivs]
    currentIvs[statIndex] = clampedValue
    this.ivs = currentIvs
  }
}
