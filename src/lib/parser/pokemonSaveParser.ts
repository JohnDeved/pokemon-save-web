/**
 * Pokemon Save File Parser
 * TypeScript port of pokemon_save_parser.py with modern browser-compatible features
 */

import {
  CONSTANTS,
  createMoveData,
  createPokemonMoves,
} from './types.js'

import type {
  MoveData,
  PlayTimeData,
  PokemonMoves,
  SaveData,
  SectorInfo,
} from './types.js'

// Import character map for decoding text
import charMap from './pokemon_charmap.json'
import { bytesToGbaString, getPokemonNature, mapItemToNameId, mapItemToPokeId, mapMoveToPokeId, mapSpeciesToPokeId, natureEffects, statStrings } from './utils'

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

  getBytes (byteOffset: number, length: number): Uint8Array {
    if (byteOffset + length > this.view.byteLength) {
      throw new RangeError(`Range ${byteOffset}:${byteOffset + length} out of bounds`)
    }
    return new Uint8Array(this.view.buffer, this.view.byteOffset + byteOffset, length)
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

  setBytes (byteOffset: number, bytes: Uint8Array): void {
    if (byteOffset + bytes.length > this.view.byteLength) {
      throw new RangeError(`Range ${byteOffset}:${byteOffset + bytes.length} out of bounds`)
    }
    new Uint8Array(this.view.buffer, this.view.byteOffset + byteOffset, bytes.length).set(bytes)
  }

  get byteLength (): number {
    return this.view.byteLength
  }
}

/**
 * Parses raw Pokemon data from save file bytes into structured format
 */
export class PokemonData {
  readonly view: SafeDataView

  constructor (private readonly data: Uint8Array) {
    if (data.length < CONSTANTS.PARTY_POKEMON_SIZE) {
      throw new Error(`Insufficient data for Pokemon: ${data.length} bytes`)
    }
    this.view = new SafeDataView(data.buffer, data.byteOffset, data.byteLength)
  }

  get personality () { return this.view.getUint32(0x00) }
  get natureRaw () { return this.view.getUint8(0x00) }
  set natureRaw (value: number) { this.view.setUint8(0x00, value) }
  get otId () { return this.view.getUint32(0x04) }
  get nicknameRaw () { return this.view.getBytes(0x08, CONSTANTS.POKEMON_NICKNAME_LENGTH) }
  get otNameRaw () { return this.view.getBytes(0x14, CONSTANTS.POKEMON_TRAINER_NAME_LENGTH) }
  get currentHp () { return this.view.getUint16(0x23) }
  get speciesId () { return mapSpeciesToPokeId(this.view.getUint16(0x28)) }
  get item () { return mapItemToPokeId(this.view.getUint16(0x2A)) }
  get itemIdName () { return mapItemToNameId(this.view.getUint16(0x2A)) }
  get move1 () { return mapMoveToPokeId(this.view.getUint16(0x34)) }
  get move2 () { return mapMoveToPokeId(this.view.getUint16(0x36)) }
  get move3 () { return mapMoveToPokeId(this.view.getUint16(0x38)) }
  get move4 () { return mapMoveToPokeId(this.view.getUint16(0x3A)) }
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
  get ivData () { return this.view.getUint32(0x50) }
  set ivData (value) { this.view.setUint32(0x50, value) }
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

  get shinyNumber (): number {
    // the 2nd byte of personality determines shininess
    return (this.personality >> 8) & 0xFF
  }

  get isShiny (): boolean {
    return this.shinyNumber === 1
  }

  get isRadiant (): boolean {
    return this.shinyNumber === 2
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

  get ivs (): readonly number[] {
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

/**
 * Decode Pokemon character-encoded text to string
 */
function decodePokemonText (bytes: Uint8Array): string {
  const result: string[] = []

  for (const byte of bytes) {
    if (byte === 0xFF) {
      // End of string marker
      break
    }

    const char = charMap[byte.toString() as keyof typeof charMap]
    if (char) {
      result.push(char)
    }
  }

  return result.join('').trim()
}

/**
 * Main Pokemon Save File Parser class
 * Handles parsing of Pokemon Emerald save files in the browser
 */
export class PokemonSaveParser {
  private saveData: Uint8Array | null = null
  private activeSlotStart = 0
  private readonly sectorMap = new Map<number, number>()
  private readonly forcedSlot: 1 | 2 | undefined
  public saveFileName: string | null = null
  public fileHandle: FileSystemFileHandle | null = null

  constructor (forcedSlot?: 1 | 2) {
    this.forcedSlot = forcedSlot
  }

  /**
   * Load save file data from a File or ArrayBuffer
   */
  async loadSaveFile (input: File | ArrayBuffer | FileSystemFileHandle): Promise<void> {
    try {
      // Always clear sectorMap before loading new data to avoid stale state
      this.sectorMap.clear()
      let buffer: ArrayBuffer

      // Only check instanceof FileSystemFileHandle if it exists (browser)
      if (typeof FileSystemFileHandle !== 'undefined' && input instanceof FileSystemFileHandle) {
        this.fileHandle = input
        input = await input.getFile()
      }

      if (input instanceof File) {
        // save the original file name for later use
        this.saveFileName = input.name

        // Check if arrayBuffer method exists (browser environment)
        if (typeof input.arrayBuffer === 'function') {
          buffer = await input.arrayBuffer()
        } else {
          // Fallback for test environments where File might not have arrayBuffer method
          const reader = new FileReader()
          buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
            reader.onload = () => { resolve(reader.result as ArrayBuffer) }
            reader.onerror = () => { reject(reader.error) }
            reader.readAsArrayBuffer(input as File)
          })
        }
      } else {
        buffer = input as ArrayBuffer
      }

      this.saveData = new Uint8Array(buffer)
    } catch (error) {
      throw new Error(`Failed to load save file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get information about a specific sector
   */
  private getSectorInfo (sectorIndex: number): SectorInfo {
    if (!this.saveData) {
      throw new Error('Save data not loaded')
    }

    const footerOffset = (sectorIndex * CONSTANTS.SECTOR_SIZE) + CONSTANTS.SECTOR_SIZE - CONSTANTS.SECTOR_FOOTER_SIZE

    if (footerOffset + CONSTANTS.SECTOR_FOOTER_SIZE > this.saveData.length) {
      return { id: -1, checksum: 0, counter: 0, valid: false }
    }

    try {
      const view = new SafeDataView(
        this.saveData.buffer,
        this.saveData.byteOffset + footerOffset,
        CONSTANTS.SECTOR_FOOTER_SIZE,
      )

      const sectorId = view.getUint16(0)
      const checksum = view.getUint16(2)
      const signature = view.getUint32(4)
      const counter = view.getUint32(8)

      if (signature !== CONSTANTS.EMERALD_SIGNATURE) {
        return { id: sectorId, checksum, counter, valid: false }
      }

      const sectorStart = sectorIndex * CONSTANTS.SECTOR_SIZE
      const sectorData = this.saveData.slice(sectorStart, sectorStart + CONSTANTS.SECTOR_DATA_SIZE)

      const calculatedChecksum = this.calculateSectorChecksum(sectorData)
      const valid = calculatedChecksum === checksum

      return { id: sectorId, checksum, counter, valid }
    } catch {
      return { id: -1, checksum: 0, counter: 0, valid: false }
    }
  }

  /**
   * Determine which save slot is active based on sector counters
   */
  private determineActiveSlot (): void {
    if (this.forcedSlot !== undefined) {
      // console.log('[PokemonSaveParser] Forced slot:', this.forcedSlot, '-> activeSlotStart:', this.forcedSlot === 1 ? 0 : 14);
      this.activeSlotStart = this.forcedSlot === 1 ? 0 : 14
      return
    }

    const getCounterSum = (range: number[]): number => {
      const infos = range.map(i => this.getSectorInfo(i))
      const validInfos = infos.filter(info => info.valid)
      const sum = validInfos.reduce((sum, info) => sum + info.counter, 0)
      // console.log('[PokemonSaveParser] Sector range:', range, 'Counters:', validInfos.map(i => i.counter), 'Sum:', sum);
      return sum
    }

    const slot1Range = Array.from({ length: 18 }, (_, i) => i)
    const slot2Range = Array.from({ length: 18 }, (_, i) => i + 14)
    const slot1Sum = getCounterSum(slot1Range)
    const slot2Sum = getCounterSum(slot2Range)

    // console.log('[PokemonSaveParser] Slot1 sum:', slot1Sum, 'Slot2 sum:', slot2Sum);
    this.activeSlotStart = slot2Sum >= slot1Sum ? 14 : 0
    // console.log('[PokemonSaveParser] Selected activeSlotStart:', this.activeSlotStart);
  }

  /**
   * Build a mapping of sector IDs to physical sector indices
   */
  private buildSectorMap (): void {
    this.sectorMap.clear()

    const sectorRange = this.forcedSlot !== undefined
      ? (this.forcedSlot === 1
          ? Array.from({ length: 18 }, (_, i) => i)
          : Array.from({ length: 18 }, (_, i) => i + 14))
      : Array.from({ length: 18 }, (_, i) => i + this.activeSlotStart)

    for (const i of sectorRange) {
      const sectorInfo = this.getSectorInfo(i)
      if (sectorInfo.valid) {
        this.sectorMap.set(sectorInfo.id, i)
      }
    }
  }

  /**
   * Extract SaveBlock1 data from sectors 1-4
   */
  private extractSaveblock1 (): Uint8Array {
    if (!this.saveData) {
      throw new Error('Save data not loaded')
    }

    const saveblock1Sectors = [1, 2, 3, 4].filter(id => this.sectorMap.has(id))
    if (saveblock1Sectors.length === 0) {
      // Instead of throwing, return a zero-filled buffer to allow parsing to continue gracefully
      return new Uint8Array(CONSTANTS.SAVEBLOCK1_SIZE)
    }

    const saveblock1Data = new Uint8Array(CONSTANTS.SAVEBLOCK1_SIZE)

    for (const sectorId of saveblock1Sectors) {
      const sectorIdx = this.sectorMap.get(sectorId)!
      const startOffset = sectorIdx * CONSTANTS.SECTOR_SIZE
      const sectorData = this.saveData.slice(startOffset, startOffset + CONSTANTS.SECTOR_DATA_SIZE)
      const chunkOffset = (sectorId - 1) * CONSTANTS.SECTOR_DATA_SIZE

      saveblock1Data.set(
        sectorData.slice(0, CONSTANTS.SECTOR_DATA_SIZE),
        chunkOffset,
      )
    }

    return saveblock1Data
  }

  /**
   * Extract SaveBlock2 data from sector 0
   */
  private extractSaveblock2 (): Uint8Array {
    if (!this.saveData) {
      throw new Error('Save data not loaded')
    }

    if (!this.sectorMap.has(0)) {
      throw new Error('SaveBlock2 sector (ID 0) not found')
    }

    const sectorIdx = this.sectorMap.get(0)!
    const startOffset = sectorIdx * CONSTANTS.SECTOR_SIZE
    return this.saveData.slice(startOffset, startOffset + CONSTANTS.SECTOR_DATA_SIZE)
  }

  /**
   * Parse party Pokemon from SaveBlock1 data
   */
  private parsePartyPokemon (saveblock1Data: Uint8Array): PokemonData[] {
    const partyPokemon: PokemonData[] = []

    for (let slot = 0; slot < CONSTANTS.MAX_PARTY_SIZE; slot++) {
      const offset = CONSTANTS.PARTY_START_OFFSET + slot * CONSTANTS.PARTY_POKEMON_SIZE
      const data = saveblock1Data.slice(offset, offset + CONSTANTS.PARTY_POKEMON_SIZE)

      if (data.length < CONSTANTS.PARTY_POKEMON_SIZE) {
        break
      }

      try {
        const pokemon = new PokemonData(data)
        // Check if Pokemon slot is empty (species ID = 0)
        if (pokemon.speciesId === 0) {
          break
        }
        partyPokemon.push(pokemon)
      } catch (error) {
        console.warn(`Failed to parse Pokemon at slot ${slot}:`, error)
        break
      }
    }

    return partyPokemon
  }

  /**
   * Parse player name from SaveBlock2 data
   */
  private parsePlayerName (saveblock2Data: Uint8Array): string {
    const playerNameBytes = saveblock2Data.slice(0, 8)
    return decodePokemonText(playerNameBytes)
  }

  /**
   * Parse play time from SaveBlock2 data
   */
  private parsePlayTime (saveblock2Data: Uint8Array): PlayTimeData {
    const view = new SafeDataView(saveblock2Data.buffer, saveblock2Data.byteOffset)

    return {
      hours: view.getUint32(0x10), // playTimeHours offset
      minutes: view.getUint8(0x14), // playTimeMinutes offset
      seconds: view.getUint8(0x15), // playTimeSeconds offset
    }
  }

  /**
   * Calculate checksum for a sector's data
   */
  private calculateSectorChecksum (sectorData: Uint8Array): number {
    if (sectorData.length < CONSTANTS.SECTOR_DATA_SIZE) {
      return 0
    }

    let checksum = 0
    const view = new SafeDataView(sectorData.buffer, sectorData.byteOffset)

    for (let i = 0; i < CONSTANTS.SECTOR_DATA_SIZE; i += 4) {
      if (i + 4 <= sectorData.length) {
        try {
          const value = view.getUint32(i)
          checksum += value
        } catch {
          break
        }
      }
    }

    return ((checksum >>> 16) + (checksum & 0xFFFF)) & 0xFFFF
  }

  /**
   * Update the party Pokémon in a SaveBlock1 buffer with the given PokemonData array.
   * Returns a new Uint8Array with the updated party data.
   * @param saveblock1 The original SaveBlock1 buffer
   * @param party Array of PokemonData (max length = CONSTANTS.MAX_PARTY_SIZE)
   */
  private updatePartyInSaveblock1 (saveblock1: Uint8Array, party: readonly PokemonData[]): Uint8Array {
    if (saveblock1.length < CONSTANTS.SAVEBLOCK1_SIZE) {
      throw new Error(`SaveBlock1 must be at least ${CONSTANTS.SAVEBLOCK1_SIZE} bytes`)
    }
    if (party.length > CONSTANTS.MAX_PARTY_SIZE) {
      throw new Error(`Party size cannot exceed ${CONSTANTS.MAX_PARTY_SIZE}`)
    }
    const updated = new Uint8Array(saveblock1)
    for (let i = 0; i < party.length; i++) {
      const offset = CONSTANTS.PARTY_START_OFFSET + i * CONSTANTS.PARTY_POKEMON_SIZE
      // Use the most up-to-date view data for each Pokemon
      updated.set(party[i]!.view.getBytes(0, CONSTANTS.PARTY_POKEMON_SIZE), offset)
    }
    return updated
  }

  /**
   * Parse the complete save file and return structured data
   */
  async parseSaveFile (input: File | ArrayBuffer | FileSystemFileHandle): Promise<SaveData> {
    await this.loadSaveFile(input)

    this.determineActiveSlot()
    this.buildSectorMap()

    const saveblock1Data = this.extractSaveblock1()
    const saveblock2Data = this.extractSaveblock2()

    const playerName = this.parsePlayerName(saveblock2Data)
    const partyPokemon = this.parsePartyPokemon(saveblock1Data)
    const playTime = this.parsePlayTime(saveblock2Data)

    return {
      party_pokemon: partyPokemon,
      player_name: playerName,
      play_time: playTime,
      active_slot: this.activeSlotStart,
      sector_map: new Map(this.sectorMap),
      rawSaveData: this.saveData!, // Attach raw save data for rehydration
    }
  }

  /**
   * Reconstruct the full save file from a new party (PokemonData[]).
   * Updates SaveBlock1 with the given party and returns a new Uint8Array representing the reconstructed save file.
   *
   * @param partyPokemon Array of PokemonData to update party in SaveBlock1
   */
  reconstructSaveFile (partyPokemon: readonly PokemonData[]): Uint8Array {
    if (!this.saveData) throw new Error('Save data not loaded')
    const baseSaveblock1 = this.extractSaveblock1()
    const updatedSaveblock1 = this.updatePartyInSaveblock1(baseSaveblock1, partyPokemon)
    const newSave = new Uint8Array(this.saveData)

    // Helper to write a sector and update its checksum
    const writeSector = (sectorId: number, data: Uint8Array) => {
      if (!this.sectorMap.has(sectorId)) return
      const sectorIdx = this.sectorMap.get(sectorId)!
      const startOffset = sectorIdx * CONSTANTS.SECTOR_SIZE
      newSave.set(data, startOffset)
      // Recalculate checksum for this sector
      const checksum = this.calculateSectorChecksum(data)
      const footerOffset = startOffset + CONSTANTS.SECTOR_SIZE - CONSTANTS.SECTOR_FOOTER_SIZE
      const view = new SafeDataView(newSave.buffer, newSave.byteOffset + footerOffset, CONSTANTS.SECTOR_FOOTER_SIZE)
      view.setUint16(2, checksum)
    }

    // Write SaveBlock1 (sectors 1-4)
    for (let sectorId = 1; sectorId <= 4; sectorId++) {
      const chunkOffset = (sectorId - 1) * CONSTANTS.SECTOR_DATA_SIZE
      const chunk = updatedSaveblock1.slice(chunkOffset, chunkOffset + CONSTANTS.SECTOR_DATA_SIZE)
      writeSector(sectorId, chunk)
    }
    return newSave
  }
}

// Export for easier usage
export default PokemonSaveParser
