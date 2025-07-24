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

    console.log(`[buildSectorMap] activeSlotStart: ${this.activeSlotStart}, sectorsPerSlot: ${this.config.offsets.sectorsPerSlot}`)
    
    // First scan the active slot
    for (let i = this.activeSlotStart; i < this.activeSlotStart + this.config.offsets.sectorsPerSlot; i++) {
      const info = this.getSectorInfo(i)
      console.log(`[buildSectorMap] Active slot sector ${i}: id=${info.id}, valid=${info.valid}`)
      if (info.valid) {
        this.sectorMap.set(info.id, i)
        console.log(`[buildSectorMap] Added mapping: sector ID ${info.id} -> physical index ${i}`)
      }
    }
    
    // If we're missing critical sectors (1-4), scan all sectors to find them
    const criticalSectors = [1, 2, 3, 4]
    const missingSectors = criticalSectors.filter(id => !this.sectorMap.has(id))
    
    if (missingSectors.length > 0) {
      console.log(`[buildSectorMap] Missing critical sectors: ${missingSectors.join(', ')}, scanning all sectors...`)
      
      for (let i = 0; i < this.config.offsets.totalSectors; i++) {
        if (i >= this.activeSlotStart && i < this.activeSlotStart + this.config.offsets.sectorsPerSlot) {
          continue // Already scanned this sector
        }
        
        const info = this.getSectorInfo(i)
        if (info.valid && missingSectors.includes(info.id)) {
          this.sectorMap.set(info.id, i)
          console.log(`[buildSectorMap] Found missing sector: ID ${info.id} -> physical index ${i}`)
        }
      }
    }
    
    console.log(`[buildSectorMap] Final sector map:`, Array.from(this.sectorMap.entries()))
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

    console.log(`[parsePartyPokemon] SaveBlock1 size: ${saveblock1Data.length}, expected: ${this.config.offsets.saveblock1Size}`)
    console.log(`[parsePartyPokemon] Party start offset: ${this.config.offsets.partyStartOffset}, Pokemon size: ${this.config.offsets.partyPokemonSize}`)

    const partyPokemon: PokemonDataInterface[] = []

    for (let slot = 0; slot < this.config.offsets.maxPartySize; slot++) {
      const offset = this.config.offsets.partyStartOffset + slot * this.config.offsets.partyPokemonSize
      const data = saveblock1Data.slice(offset, offset + this.config.offsets.partyPokemonSize)

      console.log(`[parsePartyPokemon] Slot ${slot}: offset=${offset}, data.length=${data.length}`)

      if (data.length < this.config.offsets.partyPokemonSize) {
        console.log(`[parsePartyPokemon] Slot ${slot}: Insufficient data length`)
        break
      }

      try {
        const pokemon = this.config.createPokemonData(data)
        console.log(`[parsePartyPokemon] Slot ${slot}: speciesId=${pokemon.speciesId}`)
        // Check if Pokemon slot is empty (species ID = 0)
        if (pokemon.speciesId === 0) {
          console.log(`[parsePartyPokemon] Slot ${slot}: Empty slot (species ID = 0)`)
          break
        }
        partyPokemon.push(pokemon)
        console.log(`[parsePartyPokemon] Slot ${slot}: Added Pokemon (total: ${partyPokemon.length})`)
      } catch (error) {
        console.warn(`Failed to parse Pokemon at slot ${slot}:`, error)
        break
      }
    }

    console.log(`[parsePartyPokemon] Final party size: ${partyPokemon.length}`)
    return partyPokemon
  }

  /**
   * Get SaveBlock1 data (sectors 1-4, or equivalent based on available sectors)
   */
  private getSaveBlock1 (): Uint8Array {
    if (!this.saveData || !this.config) {
      throw new Error('Save data and config not loaded')
    }

    const saveblock1 = new Uint8Array(this.config.offsets.saveblock1Size)
    let offset = 0

    // Try standard sectors 1-4 first
    let saveblock1Sectors = [1, 2, 3, 4]
    let sectorsFound = saveblock1Sectors.filter(id => this.sectorMap.has(id))
    
    // If we don't have sectors 1-4, find the first 4 consecutive sectors we do have
    if (sectorsFound.length < 4) {
      console.log(`[getSaveBlock1] Standard sectors 1-4 not found, looking for alternatives...`)
      const availableSectors = Array.from(this.sectorMap.keys()).sort((a, b) => a - b)
      console.log(`[getSaveBlock1] Available sectors: ${availableSectors.join(', ')}`)
      
      // Try to find 4 consecutive sectors
      for (let i = 0; i <= availableSectors.length - 4; i++) {
        const consecutive = availableSectors.slice(i, i + 4)
        const isConsecutive = consecutive.every((val, idx) => idx === 0 || val === consecutive[idx - 1]! + 1)
        if (isConsecutive) {
          saveblock1Sectors = consecutive
          console.log(`[getSaveBlock1] Using consecutive sectors: ${saveblock1Sectors.join(', ')}`)
          break
        }
      }
      
      // If no consecutive sectors, just use the first 4
      if (saveblock1Sectors.length !== 4 || !saveblock1Sectors.every(id => this.sectorMap.has(id))) {
        saveblock1Sectors = availableSectors.slice(0, 4)
        console.log(`[getSaveBlock1] Using first 4 available sectors: ${saveblock1Sectors.join(', ')}`)
      }
    }

    for (const sectorId of saveblock1Sectors) {
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
      party_pokemon: partyPokemon, // For backward compatibility
      playTime,
      play_time: playTime, // For backward compatibility
    }
  }

  /**
   * Get the currently loaded game configuration
   */
  getGameConfig (): GameConfig | null {
    return this.config
  }

  /**
   * Set the game configuration manually
   * Useful for testing or when auto-detection fails
   */
  setGameConfig (config: GameConfig): void {
    this.config = config
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