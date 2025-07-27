/**
 * Pokemon Save File Parser
 * TypeScript port of pokemon_save_parser.py with modern browser-compatible features
 */

import type {
  PlayTimeData,
  SaveData,
  SectorInfo,
  GameConfig,
} from './types'

import { VANILLA_EMERALD_SIGNATURE, VANILLA_POKEMON_OFFSETS, VANILLA_SAVE_LAYOUT } from './types'
import { PokemonBase } from './PokemonBase'
import { GameConfigRegistry } from '../games'
import { MgbaWebSocketClient } from '../../mgba/websocket-client'

// Import character map for decoding text
import charMap from '../data/pokemon_charmap.json'

/**
 * Effective configuration for the parser with defaults merged with config overrides
 */
interface EffectiveConfig {
  offsets: typeof VANILLA_POKEMON_OFFSETS
  saveLayout: typeof VANILLA_SAVE_LAYOUT
  pokemonSize: number
}

function createEffectiveConfig (config: GameConfig): EffectiveConfig {
  return {
    offsets: { ...VANILLA_POKEMON_OFFSETS, ...config.offsetOverrides },
    saveLayout: { ...VANILLA_SAVE_LAYOUT, ...config.saveLayoutOverrides },
    pokemonSize: config.pokemonSize ?? VANILLA_SAVE_LAYOUT.pokemonSize,
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
 * Handles parsing of Pokemon Emerald save files in the browser with dependency injection
 * Now supports both file-based and memory-based parsing via WebSocket
 */
export class PokemonSaveParser {
  private saveData: Uint8Array | null = null
  private activeSlotStart = 0
  private readonly sectorMap = new Map<number, number>()
  private readonly forcedSlot: 1 | 2 | undefined
  private config: GameConfig | null = null
  public saveFileName: string | null = null
  public fileHandle: FileSystemFileHandle | null = null

  // Memory mode properties
  private webSocketClient: MgbaWebSocketClient | null = null
  private isMemoryMode = false

  constructor (forcedSlot?: 1 | 2, gameConfig?: GameConfig) {
    this.forcedSlot = forcedSlot
    this.config = gameConfig ?? null
  }

  /**
   * Load input data from a File, ArrayBuffer, or WebSocket connection
   * When WebSocket is provided, switches to memory mode
   */
  async loadInputData (input: File | ArrayBuffer | FileSystemFileHandle | MgbaWebSocketClient): Promise<void> {
    try {
      // Always clear sectorMap before loading new data to avoid stale state
      this.sectorMap.clear()

      // Check if input is a WebSocket client for memory mode using proper instanceof check
      if (input instanceof MgbaWebSocketClient) {
        await this.initializeMemoryMode(input)
        return
      }

      // Reset memory mode for file operations
      this.isMemoryMode = false
      this.webSocketClient = null

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
        this.config = GameConfigRegistry.detectGameConfig(this.saveData)
        if (!this.config) {
          throw new Error('Unable to detect game type from save file')
        }
      }
    } catch (error) {
      throw new Error(`Failed to load save file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Initialize memory mode with WebSocket client and auto-detect config
   */
  private async initializeMemoryMode (client: MgbaWebSocketClient): Promise<void> {
    this.webSocketClient = client
    this.isMemoryMode = true

    // Check if connected
    if (!client.isConnected()) {
      throw new Error('WebSocket client is not connected to mGBA')
    }

    // Get game title to check compatibility
    const gameTitle = await client.getGameTitle()
    console.log(`Memory mode: Connected to game "${gameTitle}"`)

    // Auto-detect config based on game title using overloaded detectGameConfig method
    if (!this.config) {
      this.config = GameConfigRegistry.detectGameConfig(gameTitle)

      if (!this.config) {
        throw new Error(`Unsupported game for memory parsing: "${gameTitle}". No compatible config found.`)
      }
    } else {
      // Verify existing config can handle this game
      if (!this.config.canHandleMemory?.(gameTitle)) {
        throw new Error(`Current config "${this.config.name}" cannot handle memory parsing for "${gameTitle}"`)
      }
    }

    console.log(`Memory mode initialized for ${gameTitle} using config: ${this.config.name}`)

    // Configure and preload memory regions if defined in config
    if (this.config.memoryAddresses?.preloadRegions) {
      client.configureSharedBuffer({
        preloadRegions: [...this.config.memoryAddresses.preloadRegions],
      })
      await client.preloadSharedBuffers()
    }
  }

  /**
   * Get information about a specific sector
   */
  private getSectorInfo (sectorIndex: number): SectorInfo {
    if (!this.saveData || !this.config) {
      throw new Error('Save data and config not loaded')
    }

    const effectiveConfig = createEffectiveConfig(this.config)
    const footerOffset = (sectorIndex * effectiveConfig.saveLayout.sectorSize) + effectiveConfig.saveLayout.sectorSize - 12

    if (footerOffset + 12 > this.saveData.length) {
      return { id: -1, checksum: 0, counter: 0, valid: false }
    }

    try {
      const view = new DataView(
        this.saveData.buffer,
        this.saveData.byteOffset + footerOffset,
        12,
      )

      const sectorId = view.getUint16(0, true)
      const checksum = view.getUint16(2, true)
      const signature = view.getUint32(4, true)
      const counter = view.getUint32(8, true)

      if (signature !== VANILLA_EMERALD_SIGNATURE) {
        return { id: sectorId, checksum, counter, valid: false }
      }

      const sectorStart = sectorIndex * effectiveConfig.saveLayout.sectorSize
      const sectorData = this.saveData.slice(sectorStart, sectorStart + effectiveConfig.saveLayout.sectorDataSize)

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
      this.activeSlotStart = this.forcedSlot === 1 ? 0 : 14
      return
    }

    const getCounterSum = (range: number[]): number => {
      const infos = range.map(i => this.getSectorInfo(i))
      const validInfos = infos.filter(info => info.valid)
      const sum = validInfos.reduce((sum, info) => sum + info.counter, 0)
      return sum
    }

    this.activeSlotStart = this.config.determineActiveSlot?.(getCounterSum) ??
      this.getDefaultActiveSlot(getCounterSum)
  }

  /**
   * Default vanilla Emerald slot determination logic
   */
  private getDefaultActiveSlot (getCounterSum: (range: number[]) => number): number {
    // Slot 1: sectors 0-13 (14 sectors)
    // Slot 2: sectors 14-31 (18 sectors)
    const slot1Range = Array.from({ length: 14 }, (_, i) => i)
    const slot2Range = Array.from({ length: 18 }, (_, i) => i + 14)
    const slot1Sum = getCounterSum(slot1Range)
    const slot2Sum = getCounterSum(slot2Range)

    return slot2Sum > slot1Sum ? 14 : 0
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

    const effectiveConfig = createEffectiveConfig(this.config)
    const saveblock1Sectors = [1, 2, 3, 4].filter(id => this.sectorMap.has(id))
    if (saveblock1Sectors.length === 0) {
      // Instead of throwing, return a zero-filled buffer to allow parsing to continue gracefully
      return new Uint8Array(effectiveConfig.saveLayout.saveBlockSize)
    }

    const saveblock1Data = new Uint8Array(effectiveConfig.saveLayout.saveBlockSize)

    for (const sectorId of saveblock1Sectors) {
      const sectorIdx = this.sectorMap.get(sectorId)!
      const startOffset = sectorIdx * effectiveConfig.saveLayout.sectorSize
      const sectorData = this.saveData.slice(startOffset, startOffset + effectiveConfig.saveLayout.sectorDataSize)
      const chunkOffset = (sectorId - 1) * effectiveConfig.saveLayout.sectorDataSize

      saveblock1Data.set(
        sectorData.slice(0, effectiveConfig.saveLayout.sectorDataSize),
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

    const effectiveConfig = createEffectiveConfig(this.config)

    if (!this.sectorMap.has(0)) {
      throw new Error('SaveBlock2 sector (ID 0) not found')
    }

    const sectorIdx = this.sectorMap.get(0)!
    const startOffset = sectorIdx * effectiveConfig.saveLayout.sectorSize
    return this.saveData.slice(startOffset, startOffset + effectiveConfig.saveLayout.sectorDataSize)
  }

  /**
   * Parse party Pokemon from SaveBlock1 data or memory
   */
  private async parsePartyPokemon (saveblock1Data?: Uint8Array): Promise<PokemonBase[]> {
    if (!this.config) {
      throw new Error('Config not loaded')
    }

    // Memory mode: read directly from emulator memory
    if (this.isMemoryMode && this.webSocketClient) {
      return await this.parsePartyPokemonFromMemory()
    }

    // File mode: parse from SaveBlock1 data
    if (!saveblock1Data) {
      throw new Error('SaveBlock1 data required for file mode')
    }

    const effectiveConfig = createEffectiveConfig(this.config)
    const partyPokemon: PokemonBase[] = []

    for (let slot = 0; slot < effectiveConfig.saveLayout.maxPartySize; slot++) {
      const offset = effectiveConfig.saveLayout.partyOffset + slot * effectiveConfig.pokemonSize
      const data = saveblock1Data.slice(offset, offset + effectiveConfig.pokemonSize)

      if (data.length < effectiveConfig.pokemonSize) {
        break
      }

      try {
        const pokemon = new PokemonBase(data, this.config)
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
   * Parse party Pokemon directly from emulator memory
   * Uses addresses from config's memoryAddresses
   */
  private async parsePartyPokemonFromMemory (): Promise<PokemonBase[]> {
    if (!this.webSocketClient || !this.config) {
      throw new Error('Memory mode not properly initialized')
    }

    const { memoryAddresses } = this.config
    if (!memoryAddresses) {
      throw new Error(`Config "${this.config.name}" does not define memory addresses for memory parsing`)
    }

    // Get party count from memory
    const partyCountBuffer = await this.webSocketClient.getSharedBuffer(memoryAddresses.partyCount, 1)
    const partyCount = partyCountBuffer[0] ?? 0

    const maxPartySize = this.config.saveLayout.maxPartySize!
    const pokemonSize = this.config.saveLayout.pokemonSize!
    if (partyCount < 0 || partyCount > maxPartySize) {
      throw new Error(`Invalid party count read from memory: ${partyCount}. Expected 0-${maxPartySize}.`)
    }

    console.log(`📋 Reading ${partyCount} Pokemon from party memory`)

    const pokemon: PokemonBase[] = []

    for (let i = 0; i < partyCount; i++) {
      const pokemonAddress = memoryAddresses.partyData + (i * pokemonSize)

      console.log(`  Reading Pokemon ${i + 1} at address 0x${pokemonAddress.toString(16)}`)

      // Read the full Pokemon structure from memory
      const pokemonBytes = await this.webSocketClient.getSharedBuffer(pokemonAddress, pokemonSize)
      const pokemonInstance = new PokemonBase(pokemonBytes, this.config)

      // Stop at empty slots (species ID = 0)
      if (pokemonInstance.speciesId === 0) {
        break
      }

      pokemon.push(pokemonInstance)
    }

    console.log(`✅ Successfully read ${pokemon.length} Pokemon from memory`)
    return pokemon
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

    const effectiveConfig = createEffectiveConfig(this.config)
    const view = new DataView(saveblock2Data.buffer, saveblock2Data.byteOffset)

    return {
      hours: view.getUint16(effectiveConfig.saveLayout.playTimeHours, true), // u16 playTimeHours
      minutes: view.getUint8(effectiveConfig.saveLayout.playTimeMinutes), // u8 playTimeMinutes
      seconds: view.getUint8(effectiveConfig.saveLayout.playTimeSeconds), // u8 playTimeSeconds
    }
  }

  /**
   * Calculate checksum for a sector's data
   */
  private calculateSectorChecksum (sectorData: Uint8Array): number {
    if (!this.config) {
      throw new Error('Config not loaded')
    }

    const effectiveConfig = createEffectiveConfig(this.config)

    if (sectorData.length < effectiveConfig.saveLayout.sectorDataSize) {
      return 0
    }

    let checksum = 0
    const view = new DataView(sectorData.buffer, sectorData.byteOffset)

    for (let i = 0; i < effectiveConfig.saveLayout.sectorDataSize; i += 4) {
      if (i + 4 <= sectorData.length) {
        try {
          const value = view.getUint32(i, true)
          checksum += value
        } catch {
          break
        }
      }
    }

    return ((checksum >>> 16) + (checksum & 0xFFFF)) & 0xFFFF
  }

  /**
   * Update the party Pokémon in a SaveBlock1 buffer with the given PokemonInstance array.
   * Returns a new Uint8Array with the updated party data.
   * @param saveblock1 The original SaveBlock1 buffer
   * @param party Array of PokemonInstance (max length = config.layout.party.maxSize)
   */
  private updatePartyInSaveblock1 (saveblock1: Uint8Array, party: readonly PokemonBase[]): Uint8Array {
    if (!this.config) {
      throw new Error('Config not loaded')
    }

    const effectiveConfig = createEffectiveConfig(this.config)

    if (saveblock1.length < effectiveConfig.saveLayout.saveBlockSize) {
      throw new Error(`SaveBlock1 must be at least ${effectiveConfig.saveLayout.saveBlockSize} bytes`)
    }
    if (party.length > effectiveConfig.saveLayout.maxPartySize) {
      throw new Error(`Party size cannot exceed ${effectiveConfig.saveLayout.maxPartySize}`)
    }

    const updated = new Uint8Array(saveblock1)
    for (let i = 0; i < party.length; i++) {
      const offset = effectiveConfig.saveLayout.partyOffset + i * effectiveConfig.pokemonSize
      // Use the most up-to-date raw data for each Pokemon
      updated.set(party[i]!.rawBytes, offset)
    }
    return updated
  }

  /**
   * Parse input data and return structured data
   * Supports both file and memory input via WebSocket
   */
  async parseSaveFile (input: File | ArrayBuffer | FileSystemFileHandle | MgbaWebSocketClient): Promise<SaveData> {
    await this.loadInputData(input)

    // Memory mode: read directly from emulator memory
    if (this.isMemoryMode && this.webSocketClient) {
      const partyPokemon = await this.parsePartyPokemon()

      // TODO: Implement memory support for player name and playtime
      // These fields should be read from memory addresses when implemented
      return {
        party_pokemon: partyPokemon,
        player_name: 'MEMORY', // TODO: Read from memory if needed
        play_time: { hours: 0, minutes: 0, seconds: 0 }, // TODO: Read from memory if needed
        active_slot: 0, // Memory doesn't have multiple save slots
        sector_map: undefined, // Not applicable for memory parsing
        rawSaveData: undefined, // Not applicable for memory parsing
      }
    }

    // File mode: existing logic
    this.determineActiveSlot()
    this.buildSectorMap()

    const saveblock1Data = this.extractSaveblock1()
    const saveblock2Data = this.extractSaveblock2()

    const playerName = this.parsePlayerName(saveblock2Data)
    const partyPokemon = await this.parsePartyPokemon(saveblock1Data)
    const playTime = this.parsePlayTime(saveblock2Data)

    return {
      party_pokemon: partyPokemon,
      player_name: playerName,
      play_time: playTime,
      active_slot: this.activeSlotStart,
      sector_map: this.sectorMap,
      rawSaveData: this.saveData ?? undefined,
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
   * Get the currently active game config
   */
  get gameConfig (): GameConfig | null {
    return this.config
  }

  /**
   * Reconstruct the full save file from a new party (PokemonInstance[]).
   * Updates SaveBlock1 with the given party and returns a new Uint8Array representing the reconstructed save file.
   *
   * @param partyPokemon Array of PokemonInstance to update party in SaveBlock1
   */
  reconstructSaveFile (partyPokemon: readonly PokemonBase[]): Uint8Array {
    if (!this.saveData || !this.config) throw new Error('Save data and config not loaded')

    const effectiveConfig = createEffectiveConfig(this.config)
    const baseSaveblock1 = this.extractSaveblock1()
    const updatedSaveblock1 = this.updatePartyInSaveblock1(baseSaveblock1, partyPokemon)
    const newSave = new Uint8Array(this.saveData)

    // Helper to write a sector and update its checksum
    const writeSector = (sectorId: number, data: Uint8Array) => {
      if (!this.sectorMap.has(sectorId)) return
      const sectorIdx = this.sectorMap.get(sectorId)!
      const startOffset = sectorIdx * effectiveConfig.saveLayout.sectorSize
      newSave.set(data, startOffset)
      // Recalculate checksum for this sector
      const checksum = this.calculateSectorChecksum(data)
      const footerOffset = startOffset + effectiveConfig.saveLayout.sectorSize - 12
      const view = new DataView(newSave.buffer, newSave.byteOffset + footerOffset, 12)
      view.setUint16(2, checksum, true)
    }

    // Write SaveBlock1 (sectors 1-4)
    for (let sectorId = 1; sectorId <= 4; sectorId++) {
      const chunkOffset = (sectorId - 1) * effectiveConfig.saveLayout.sectorDataSize
      const chunk = updatedSaveblock1.slice(chunkOffset, chunkOffset + effectiveConfig.saveLayout.sectorDataSize)
      writeSector(sectorId, chunk)
    }
    return newSave
  }

  /**
   * Check if parser is in memory mode
   */
  isInMemoryMode (): boolean {
    return this.isMemoryMode
  }

  /**
   * Get the WebSocket client (for memory mode)
   */
  getWebSocketClient (): MgbaWebSocketClient | null {
    return this.webSocketClient
  }
}

// Export for easier usage
export default PokemonSaveParser
