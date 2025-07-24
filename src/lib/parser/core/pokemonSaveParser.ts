/**
 * Pokemon Save File Parser
 * TypeScript port of pokemon_save_parser.py with modern browser-compatible features
 */

import type {
  PlayTimeData,
  SaveData,
  SectorInfo,
} from './types.js'

import type { GameConfig, PokemonDataInterface } from '../configs/GameConfig.js'
import { autoDetectGameConfig } from '../configs/autoDetect.js'
import { SafeDataView } from './safeDataView.js'

// Import character map for decoding text
import charMap from '../data/pokemon_charmap.json'

/**
 * Parses raw Pokemon data from save file bytes into structured format
 */
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
 * Handles parsing of Pokemon Emerald save files in the browser with dependency injection
 */
export class PokemonSaveParser {
  private saveData: Uint8Array | null = null
  private activeSlotStart = 0
  private readonly sectorMap = new Map<number, number>()
  private readonly forcedSlot: 1 | 2 | undefined
  private config: GameConfig | null = null
  public saveFileName: string | null = null
  public fileHandle: FileSystemFileHandle | null = null

  constructor (forcedSlot?: 1 | 2, gameConfig?: GameConfig) {
    this.forcedSlot = forcedSlot
    this.config = gameConfig ?? null
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

      // Auto-detect config if not provided
      if (!this.config) {
        this.config = autoDetectGameConfig(this.saveData)
        if (!this.config) {
          throw new Error('Unable to detect game type from save file')
        }
      }
    } catch (error) {
      throw new Error(`Failed to load save file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get information about a specific sector
   */
  private getSectorInfo (sectorIndex: number): SectorInfo {
    if (!this.saveData || !this.config) {
      throw new Error('Save data and config not loaded')
    }

    const footerOffset = (sectorIndex * this.config.offsets.sectorSize) + this.config.offsets.sectorSize - this.config.offsets.sectorFooterSize

    if (footerOffset + this.config.offsets.sectorFooterSize > this.saveData.length) {
      return { id: -1, checksum: 0, counter: 0, valid: false }
    }

    try {
      const view = new SafeDataView(
        this.saveData.buffer,
        this.saveData.byteOffset + footerOffset,
        this.config.offsets.sectorFooterSize,
      )

      const sectorId = view.getUint16(0)
      const checksum = view.getUint16(2)
      const signature = view.getUint32(4)
      const counter = view.getUint32(8)

      if (signature !== this.config.signature) {
        return { id: sectorId, checksum, counter, valid: false }
      }

      const sectorStart = sectorIndex * this.config.offsets.sectorSize
      const sectorData = this.saveData.slice(sectorStart, sectorStart + this.config.offsets.sectorDataSize)

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
    if (!this.config) {
      throw new Error('Config not loaded')
    }

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

    this.activeSlotStart = this.config.determineActiveSlot(getCounterSum)
    // console.log('[PokemonSaveParser] Selected activeSlotStart:', this.activeSlotStart);
  }

  /**
   * Build a mapping of sector IDs to physical sector indices
   */
  private buildSectorMap (): void {
    if (!this.config) {
      throw new Error('Config not loaded')
    }

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
    if (!this.saveData || !this.config) {
      throw new Error('Save data and config not loaded')
    }

    const saveblock1Sectors = [1, 2, 3, 4].filter(id => this.sectorMap.has(id))
    if (saveblock1Sectors.length === 0) {
      // Instead of throwing, return a zero-filled buffer to allow parsing to continue gracefully
      return new Uint8Array(this.config.offsets.saveblock1Size)
    }

    const saveblock1Data = new Uint8Array(this.config.offsets.saveblock1Size)

    for (const sectorId of saveblock1Sectors) {
      const sectorIdx = this.sectorMap.get(sectorId)!
      const startOffset = sectorIdx * this.config.offsets.sectorSize
      const sectorData = this.saveData.slice(startOffset, startOffset + this.config.offsets.sectorDataSize)
      const chunkOffset = (sectorId - 1) * this.config.offsets.sectorDataSize

      saveblock1Data.set(
        sectorData.slice(0, this.config.offsets.sectorDataSize),
        chunkOffset,
      )
    }

    return saveblock1Data
  }

  /**
   * Extract SaveBlock2 data from sector 0
   */
  private extractSaveblock2 (): Uint8Array {
    if (!this.saveData || !this.config) {
      throw new Error('Save data and config not loaded')
    }

    if (!this.sectorMap.has(0)) {
      throw new Error('SaveBlock2 sector (ID 0) not found')
    }

    const sectorIdx = this.sectorMap.get(0)!
    const startOffset = sectorIdx * this.config.offsets.sectorSize
    return this.saveData.slice(startOffset, startOffset + this.config.offsets.sectorDataSize)
  }

  /**
   * Parse party Pokemon from SaveBlock1 data
   */
  private parsePartyPokemon (saveblock1Data: Uint8Array): PokemonDataInterface[] {
    if (!this.config) {
      throw new Error('Config not loaded')
    }

    const partyPokemon: PokemonDataInterface[] = []

    for (let slot = 0; slot < this.config.offsets.maxPartySize; slot++) {
      const offset = this.config.offsets.partyStartOffset + slot * this.config.offsets.partyPokemonSize
      const data = saveblock1Data.slice(offset, offset + this.config.offsets.partyPokemonSize)

      if (data.length < this.config.offsets.partyPokemonSize) {
        break
      }

      try {
        const pokemon = this.config.createPokemonData(data)
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
    if (!this.config) {
      throw new Error('Config not loaded')
    }

    const view = new SafeDataView(saveblock2Data.buffer, saveblock2Data.byteOffset)

    return {
      hours: view.getUint32(this.config.offsets.playTimeHours), // playTimeHours offset
      minutes: view.getUint8(this.config.offsets.playTimeMinutes), // playTimeMinutes offset
      seconds: view.getUint8(this.config.offsets.playTimeSeconds), // playTimeSeconds offset
    }
  }

  /**
   * Calculate checksum for a sector's data
   */
  private calculateSectorChecksum (sectorData: Uint8Array): number {
    if (!this.config) {
      throw new Error('Config not loaded')
    }

    if (sectorData.length < this.config.offsets.sectorDataSize) {
      return 0
    }

    let checksum = 0
    const view = new SafeDataView(sectorData.buffer, sectorData.byteOffset)

    for (let i = 0; i < this.config.offsets.sectorDataSize; i += 4) {
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
   * @param party Array of PokemonData (max length = config.offsets.maxPartySize)
   */
  private updatePartyInSaveblock1 (saveblock1: Uint8Array, party: readonly PokemonDataInterface[]): Uint8Array {
    if (!this.config) {
      throw new Error('Config not loaded')
    }

    if (saveblock1.length < this.config.offsets.saveblock1Size) {
      throw new Error(`SaveBlock1 must be at least ${this.config.offsets.saveblock1Size} bytes`)
    }
    if (party.length > this.config.offsets.maxPartySize) {
      throw new Error(`Party size cannot exceed ${this.config.offsets.maxPartySize}`)
    }
    const updated = new Uint8Array(saveblock1)
    for (let i = 0; i < party.length; i++) {
      const offset = this.config.offsets.partyStartOffset + i * this.config.offsets.partyPokemonSize
      // Use the most up-to-date raw data for each Pokemon
      updated.set(party[i]!.rawBytes, offset)
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
   * Get the current game configuration
   */
  getGameConfig (): GameConfig | null {
    return this.config
  }

  /**
   * Set the game configuration (useful for testing or manual override)
   */
  setGameConfig (config: GameConfig): void {
    this.config = config
  }

  /**
   * Reconstruct the full save file from a new party (PokemonData[]).
   * Updates SaveBlock1 with the given party and returns a new Uint8Array representing the reconstructed save file.
   *
   * @param partyPokemon Array of PokemonData to update party in SaveBlock1
   */
  reconstructSaveFile (partyPokemon: readonly PokemonDataInterface[]): Uint8Array {
    if (!this.saveData || !this.config) throw new Error('Save data and config not loaded')
    const baseSaveblock1 = this.extractSaveblock1()
    const updatedSaveblock1 = this.updatePartyInSaveblock1(baseSaveblock1, partyPokemon)
    const newSave = new Uint8Array(this.saveData)

    // Helper to write a sector and update its checksum
    const writeSector = (sectorId: number, data: Uint8Array) => {
      if (!this.sectorMap.has(sectorId)) return
      const sectorIdx = this.sectorMap.get(sectorId)!
      const startOffset = sectorIdx * this.config!.offsets.sectorSize
      newSave.set(data, startOffset)
      // Recalculate checksum for this sector
      const checksum = this.calculateSectorChecksum(data)
      const footerOffset = startOffset + this.config!.offsets.sectorSize - this.config!.offsets.sectorFooterSize
      const view = new SafeDataView(newSave.buffer, newSave.byteOffset + footerOffset, this.config!.offsets.sectorFooterSize)
      view.setUint16(2, checksum)
    }

    // Write SaveBlock1 (sectors 1-4)
    for (let sectorId = 1; sectorId <= 4; sectorId++) {
      const chunkOffset = (sectorId - 1) * this.config.offsets.sectorDataSize
      const chunk = updatedSaveblock1.slice(chunkOffset, chunkOffset + this.config.offsets.sectorDataSize)
      writeSector(sectorId, chunk)
    }
    return newSave
  }
}

// Export for easier usage
export default PokemonSaveParser
