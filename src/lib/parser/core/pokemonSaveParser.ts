/**
 * Pokemon Save File Parser
 * TypeScript port of pokemon_save_parser.py with modern browser-compatible features
 */

import type {
  PlayTimeData,
  ParsedSaveData,
  SectorInfo,
} from './types.js'

import type { GameConfig } from '../configs/GameConfig.js'
import type { PokemonDataInterface } from './PokemonDataInterface.js'
import { autoDetectGameConfig } from '../configs/autoDetect.js'
import { SafeDataView } from './BasePokemonData.js'

// Import character map for decoding text
import charMap from '../data/pokemon_charmap.json'

/**
 * Helper function to parse Pokemon string from bytes using character map
 */
function parsePokemonStringFromBytes (bytes: Uint8Array): string {
  const result = []

  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i]!

    if (byte === 0xFF) break // End of string marker

    // @ts-expect-error TS doesn't know about the JSON import structure
    const char = charMap[byte] ?? `\\x${byte.toString(16).padStart(2, '0')}`
    result.push(char)
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
    if (!this.saveData || !this.config) {
      throw new Error('Save data and config not loaded')
    }

    for (let i = this.activeSlotStart; i < this.activeSlotStart + this.config.offsets.sectorsPerSlot; i++) {
      const info = this.getSectorInfo(i)
      if (info.valid) {
        this.sectorMap.set(info.id, i)
      }
    }
  }

  /**
   * Calculate checksum for sector data
   */
  private calculateSectorChecksum (data: Uint8Array): number {
    let checksum = 0
    for (let i = 0; i < data.length; i += 4) {
      const chunk = data.slice(i, i + 4)
      while (chunk.length < 4) {
        const newChunk = new Uint8Array(4)
        newChunk.set(chunk)
        chunk.set(newChunk)
      }
      const value = new DataView(chunk.buffer, chunk.byteOffset, 4).getUint32(0, true)
      checksum = (checksum + value) >>> 0
    }
    return checksum & 0xFFFF
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
   * Get SaveBlock1 data (sectors 1-4)
   */
  private getSaveBlock1 (): Uint8Array {
    if (!this.saveData || !this.config) {
      throw new Error('Save data and config not loaded')
    }

    const saveblock1 = new Uint8Array(this.config.offsets.saveblock1Size)
    let offset = 0

    for (let sectorId = 1; sectorId <= 4; sectorId++) {
      const sectorIndex = this.sectorMap.get(sectorId)
      if (sectorIndex === undefined) {
        throw new Error(`Sector ${sectorId} not found`)
      }

      const sectorStart = sectorIndex * this.config.offsets.sectorSize
      const sectorEnd = sectorStart + this.config.offsets.sectorDataSize
      const sectorData = this.saveData.slice(sectorStart, sectorEnd)

      saveblock1.set(sectorData, offset)
      offset += this.config.offsets.sectorDataSize
    }

    return saveblock1
  }

  /**
   * Parse play time data from SaveBlock1
   */
  private parsePlayTime (saveblock1Data: Uint8Array): PlayTimeData {
    if (!this.config) {
      throw new Error('Config not loaded')
    }

    const view = new SafeDataView(saveblock1Data.buffer, saveblock1Data.byteOffset, saveblock1Data.byteLength)
    const hours = view.getUint16(this.config.offsets.playTimeHours)
    const minutes = view.getUint8(this.config.offsets.playTimeMinutes)
    const seconds = view.getUint8(this.config.offsets.playTimeSeconds)

    return { hours, minutes, seconds }
  }

  /**
   * Parse save file and return structured data
   */
  async parseSaveFile (input?: File | ArrayBuffer | FileSystemFileHandle): Promise<ParsedSaveData> {
    if (input) {
      await this.loadSaveFile(input)
    }

    if (!this.saveData || !this.config) {
      throw new Error('No save data loaded')
    }

    this.determineActiveSlot()
    this.buildSectorMap()

    const saveblock1Data = this.getSaveBlock1()
    const partyPokemon = this.parsePartyPokemon(saveblock1Data)
    const playTime = this.parsePlayTime(saveblock1Data)

    return {
      partyPokemon,
      playTime,
    }
  }

  /**
   * Get the currently loaded game configuration
   */
  getGameConfig (): GameConfig | null {
    return this.config
  }

  /**
   * Update the party Pokémon in a SaveBlock1 buffer with the given PokemonDataInterface array.
   * Returns a new Uint8Array with the updated party data.
   * @param saveblock1 The original SaveBlock1 buffer
   * @param party Array of PokemonDataInterface (max length = config.offsets.maxPartySize)
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
      // Use the view data for each Pokemon (cast needed since interface doesn't expose view)
      const pokemonWithView = party[i]! as any
      if (pokemonWithView.view && pokemonWithView.view.getBytes) {
        updated.set(pokemonWithView.view.getBytes(0, this.config.offsets.partyPokemonSize), offset)
      } else {
        throw new Error(`Pokemon at index ${i} does not have valid view data`)
      }
    }
    return updated
  }

  /**
   * Reconstruct the full save file from a new party (PokemonDataInterface[]).
   * Returns a new Uint8Array representing the complete save file.
   * @param partyPokemon Array of PokemonDataInterface to update party in SaveBlock1
   */
  reconstructSaveFile (partyPokemon: readonly PokemonDataInterface[]): Uint8Array {
    if (!this.saveData || !this.config) {
      throw new Error('Save data and config not loaded')
    }

    // Get the current SaveBlock1 and update party
    const originalSaveblock1 = this.getSaveBlock1()
    const updatedSaveblock1 = this.updatePartyInSaveblock1(originalSaveblock1, partyPokemon)

    // Create a copy of the original save file
    const newSave = new Uint8Array(this.saveData)

    // Helper function to write a sector
    const writeSector = (sectorId: number, data: Uint8Array): void => {
      const sectorIndex = this.sectorMap.get(sectorId)
      if (sectorIndex === undefined) {
        throw new Error(`Sector ${sectorId} not found`)
      }

      const startOffset = sectorIndex * this.config!.offsets.sectorSize
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