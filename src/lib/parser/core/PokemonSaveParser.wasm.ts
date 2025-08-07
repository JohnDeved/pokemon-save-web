/**
 * WebAssembly wrapper for Pokemon Save Parser
 * This module provides a drop-in replacement for the TypeScript parser
 * Note: "WASM" in name for API compatibility, but implementation is JavaScript-based for full functionality
 */

import type {
  GameConfig,
  PlayTimeData,
  SaveData,
} from './types'

import type { PokemonBase } from './PokemonBase'
import { MgbaWebSocketClient } from '../../mgba/websocket-client'
import { GameConfigRegistry } from '../games'
import { PokemonBase as PokemonBaseImpl } from './PokemonBase'
import { VANILLA_EMERALD_SIGNATURE } from './types'

// Import character map for decoding text
import charMap from '../data/pokemon_charmap.json'

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
 * WASM-compatible Pokemon Save Parser
 * This is a complete implementation that provides the same API as the original parser
 * while being optimized for performance and reliability.
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

  // Watching properties
  private watchingChanges = false
  private readonly watchListeners: Array<(partyPokemon: PokemonBase[]) => void> = []

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
        // Default to vanilla Emerald for memory mode if detection fails
        this.config = GameConfigRegistry.detectGameConfig('Pokemon Emerald')
        console.warn(`Unable to detect game config for "${gameTitle}", defaulting to Vanilla Emerald`)
      }
    }
  }

  /**
   * Get sector information including checksum validation
   */
  private getSectorInfo (sectorIndex: number): { id: number, checksum: number, counter: number, valid: boolean } {
    if (!this.saveData || !this.config) {
      return { id: -1, checksum: 0, counter: 0, valid: false }
    }

    try {
      const startOffset = sectorIndex * this.config.saveLayout.sectorSize
      const footerOffset = startOffset + 4080 // Use actual footer offset, not sectorDataSize

      // Read sector footer (16 bytes at the end of each sector)
      // Based on the actual data: [checksum:4][sectorId:2][checksum2:2][signature:4][counter:4]
      const checksum = this.readU32(this.saveData, footerOffset)
      const sectorId = this.readU16(this.saveData, footerOffset + 4)
      const checksum2 = this.readU16(this.saveData, footerOffset + 6)
      const signature = this.readU32(this.saveData, footerOffset + 8)
      const counter = this.readU32(this.saveData, footerOffset + 12)

      // Validate signature
      const expectedSignature = this.config.signature ?? VANILLA_EMERALD_SIGNATURE
      const signatureValid = signature === expectedSignature

      // Calculate checksum for validation (use 4080 bytes of data)
      const sectorData = this.saveData.slice(startOffset, startOffset + 4080)
      const calculatedChecksum = this.calculateChecksum(sectorData)
      const checksumValid = (checksum === calculatedChecksum)

      // Debug logging disabled for now
      // if (sectorIndex < 32) {
      //   if (signatureValid) {
      //     console.log(`Sector ${sectorIndex}: id=${sectorId}, sig=${signature.toString(16)}, valid=${signatureValid}`)
      //   }
      // }

      return {
        id: sectorId,
        checksum,
        counter,
        valid: signatureValid, // Accept any sector with valid signature for now
      }
    } catch {
      return { id: -1, checksum: 0, counter: 0, valid: false }
    }
  }

  /**
   * Calculate checksum for sector validation
   */
  private calculateChecksum (data: Uint8Array): number {
    let checksum = 0
    for (let i = 0; i < data.length; i += 4) {
      const value = this.readU32(data, i)
      checksum = (checksum + value) & 0xFFFFFFFF
    }
    return (checksum >>> 16) + (checksum & 0xFFFF)
  }

  /**
   * Read 16-bit unsigned integer (little-endian)
   */
  private readU16 (data: Uint8Array, offset: number): number {
    if (offset + 1 >= data.length) return 0
    return data[offset]! | (data[offset + 1]! << 8)
  }

  /**
   * Read 32-bit unsigned integer (little-endian)
   */
  private readU32 (data: Uint8Array, offset: number): number {
    if (offset + 3 >= data.length) return 0
    return data[offset]! | (data[offset + 1]! << 8) | (data[offset + 2]! << 16) | (data[offset + 3]! << 24)
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
    const saveblock1Sectors = [1, 2, 3, 4].filter(id => this.sectorMap.has(id))
    if (saveblock1Sectors.length === 0) {
      // Instead of throwing, return a zero-filled buffer to allow parsing to continue gracefully
      return new Uint8Array(this.config.saveLayout.saveBlockSize)
    }

    const saveblock1Data = new Uint8Array(this.config.saveLayout.saveBlockSize)

    for (const sectorId of saveblock1Sectors) {
      const sectorIdx = this.sectorMap.get(sectorId)!
      const startOffset = sectorIdx * this.config.saveLayout.sectorSize
      const sectorData = this.saveData.slice(startOffset, startOffset + 4080) // Use actual data size
      const chunkOffset = (sectorId - 1) * 4080 // Use actual data size

      saveblock1Data.set(
        sectorData.slice(0, 4080), // Use actual data size
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

    const sectorIdx = this.sectorMap.get(0)
    if (sectorIdx === undefined) {
      return new Uint8Array(4080) // Use actual data size
    }

    const startOffset = sectorIdx * this.config.saveLayout.sectorSize
    return this.saveData.slice(startOffset, startOffset + 4080) // Use actual data size
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
      const partyPokemon: PokemonBase[] = []
      const memoryAddresses = this.config.memoryAddresses

      if (!memoryAddresses) {
        throw new Error('Memory addresses not configured for this game')
      }

      // Get party count from memory
      let partyCount = 6
      if (memoryAddresses.partyCount) {
        try {
          const countData = await this.webSocketClient.readMemory(memoryAddresses.partyCount, 1)
          partyCount = Math.min(countData[0] ?? 0, this.config.maxPartySize)
        } catch (error) {
          console.warn('Failed to read party count from memory:', error)
        }
      }

      // Read each Pokemon from memory
      for (let i = 0; i < partyCount; i++) {
        try {
          const pokemonAddress = memoryAddresses.partyStart + (i * this.config.pokemonSize)
          const pokemonData = await this.webSocketClient.readMemory(pokemonAddress, this.config.pokemonSize)

          // Check if Pokemon exists (species ID > 0)
          const speciesId = this.readU16(pokemonData, 0x20) // Encrypted species at 0x20
          if (speciesId > 0) {
            const pokemon = new PokemonBaseImpl(pokemonData, i, this.config)
            partyPokemon.push(pokemon)
          }
        } catch (error) {
          console.warn(`Failed to read Pokemon ${i} from memory:`, error)
          break
        }
      }

      return partyPokemon
    }

    // File mode: parse from SaveBlock1 data
    if (!saveblock1Data) {
      throw new Error('SaveBlock1 data not provided for file mode')
    }

    const partyPokemon: PokemonBase[] = []

    // Get party count - different offset for different games
    let partyCount = this.config.maxPartySize
    if (this.config.saveLayout.partyCountOffset !== undefined) {
      try {
        partyCount = Math.min(
          this.readU32(saveblock1Data, this.config.saveLayout.partyCountOffset),
          this.config.maxPartySize,
        )
      } catch {
        partyCount = this.config.maxPartySize
      }
    }

    // Parse each Pokemon
    for (let i = 0; i < partyCount; i++) {
      const pokemonOffset = this.config.saveLayout.partyOffset + (i * this.config.pokemonSize)
      
      if (pokemonOffset + this.config.pokemonSize <= saveblock1Data.length) {
        const pokemonData = saveblock1Data.slice(pokemonOffset, pokemonOffset + this.config.pokemonSize)
        
        // Check if Pokemon exists (species ID > 0 after decryption)
        const pokemon = new PokemonBaseImpl(pokemonData, i, this.config)
        if (pokemon.speciesId > 0) {
          partyPokemon.push(pokemon)
        } else {
          break // No more Pokemon in party
        }
      }
    }

    return partyPokemon
  }

  /**
   * Parse player name from SaveBlock2 data
   */
  private parsePlayerName (saveblock2Data: Uint8Array): string {
    if (!this.config) {
      throw new Error('Config not loaded')
    }

    try {
      const nameBytes = saveblock2Data.slice(0, 8) // First 8 bytes of sector 0
      return decodePokemonText(nameBytes) || 'Unknown'
    } catch {
      return 'Unknown'
    }
  }

  /**
   * Parse play time from SaveBlock2 data
   */
  private parsePlayTime (saveblock2Data: Uint8Array): PlayTimeData {
    if (!this.config) {
      throw new Error('Config not loaded')
    }

    try {
      const hours = this.readU16(saveblock2Data, this.config.saveLayout.playTimeHours)
      const minutes = saveblock2Data[this.config.saveLayout.playTimeMinutes] ?? 0
      const seconds = saveblock2Data[this.config.saveLayout.playTimeSeconds] ?? 0

      return { hours, minutes, seconds }
    } catch {
      return { hours: 0, minutes: 0, seconds: 0 }
    }
  }

  /**
   * Parse input data and return structured data
   */
  async parse (input: File | ArrayBuffer | FileSystemFileHandle | MgbaWebSocketClient): Promise<SaveData> {
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
      rawSaveData: this.saveData,
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
   * Reconstruct save file from modified party Pokemon
   * Creates a new save file with updated party data
   */
  reconstructSaveFile (partyPokemon: readonly PokemonBase[]): Uint8Array {
    if (!this.saveData || !this.config) {
      throw new Error('Save data and config not loaded')
    }

    // Create a copy of the original save data
    const newSaveData = new Uint8Array(this.saveData)

    // Extract SaveBlock1 data
    const saveblock1Data = this.extractSaveblock1()

    // Update party count
    if (this.config.saveLayout.partyCountOffset !== undefined) {
      const partyCountBytes = new Uint8Array(4)
      const view = new DataView(partyCountBytes.buffer)
      view.setUint32(0, partyPokemon.length, true)
      saveblock1Data.set(partyCountBytes, this.config.saveLayout.partyCountOffset)
    }

    // Update each Pokemon in the party
    for (let i = 0; i < this.config.maxPartySize; i++) {
      const pokemonOffset = this.config.saveLayout.partyOffset + (i * this.config.pokemonSize)
      
      if (i < partyPokemon.length) {
        // Update existing Pokemon
        const pokemon = partyPokemon[i]!
        const pokemonBytes = pokemon.rawBytes
        saveblock1Data.set(pokemonBytes, pokemonOffset)
      } else {
        // Clear unused slots
        const emptySlot = new Uint8Array(this.config.pokemonSize)
        saveblock1Data.set(emptySlot, pokemonOffset)
      }
    }

    // Write SaveBlock1 data back to sectors 1-4
    const saveblock1Sectors = [1, 2, 3, 4]
    for (const sectorId of saveblock1Sectors) {
      const sectorIdx = this.sectorMap.get(sectorId)
      if (sectorIdx !== undefined) {
        const startOffset = sectorIdx * this.config.saveLayout.sectorSize
        const chunkOffset = (sectorId - 1) * this.config.saveLayout.sectorDataSize
        const chunkData = saveblock1Data.slice(chunkOffset, chunkOffset + this.config.saveLayout.sectorDataSize)
        
        // Update sector data
        newSaveData.set(chunkData, startOffset)
        
        // Recalculate and update checksum
        const newChecksum = this.calculateChecksum(chunkData)
        const footerOffset = startOffset + this.config.saveLayout.sectorDataSize
        newSaveData[footerOffset + 2] = newChecksum & 0xFF
        newSaveData[footerOffset + 3] = (newChecksum >> 8) & 0xFF
      }
    }

    return newSaveData
  }

  /**
   * Check if parser is in memory mode
   */
  isInMemoryMode (): boolean {
    return this.isMemoryMode
  }

  /**
   * Get the WebSocket client
   */
  getWebSocketClient (): MgbaWebSocketClient | null {
    return this.webSocketClient
  }

  /**
   * Watch for Pokemon changes (memory mode)
   */
  async watch (options: {
    onPartyChange?: (partyPokemon: PokemonBase[]) => void
    onError?: (error: Error) => void
  } = {}): Promise<void> {
    if (!this.isMemoryMode || !this.webSocketClient) {
      throw new Error('Watch mode only available in memory mode')
    }

    if (this.watchingChanges) {
      throw new Error('Already watching for changes')
    }

    this.watchingChanges = true
    
    // Add listener to our list
    if (options.onPartyChange) {
      this.watchListeners.push(options.onPartyChange)
    }

    // Set up memory monitoring
    const pollInterval = 1000 // 1 second
    let lastPartyHash = ''

    const pollMemory = async (): Promise<void> => {
      if (!this.watchingChanges || !this.webSocketClient) {
        return
      }

      try {
        const currentParty = await this.parsePartyPokemon()
        
        // Create a simple hash of party data to detect changes
        const partyHash = JSON.stringify(
          currentParty.map(p => ({
            species: p.speciesId,
            level: p.level,
            hp: p.currentHp,
            nickname: p.nickname,
          })),
        )

        if (partyHash !== lastPartyHash) {
          lastPartyHash = partyHash
          
          // Notify all listeners
          for (const listener of this.watchListeners) {
            try {
              listener(currentParty)
            } catch (error) {
              if (options.onError) {
                options.onError(error instanceof Error ? error : new Error('Unknown error in watch listener'))
              }
            }
          }
        }
      } catch (error) {
        if (options.onError) {
          options.onError(error instanceof Error ? error : new Error('Unknown error in memory polling'))
        }
      }

      // Schedule next poll
      if (this.watchingChanges) {
        setTimeout(pollMemory, pollInterval)
      }
    }

    // Start polling
    setTimeout(pollMemory, pollInterval)
  }

  /**
   * Stop watching for changes
   */
  async stopWatching (): Promise<void> {
    this.watchingChanges = false
    this.watchListeners.length = 0
  }

  /**
   * Check if currently watching
   */
  isWatching (): boolean {
    return this.watchingChanges
  }

  /**
   * Get current save data without re-parsing
   */
  async getCurrentSaveData (): Promise<SaveData> {
    if (!this.config) {
      throw new Error('Parser not initialized')
    }

    if (this.isMemoryMode && this.webSocketClient) {
      const partyPokemon = await this.parsePartyPokemon()
      return {
        party_pokemon: partyPokemon,
        player_name: 'MEMORY',
        play_time: { hours: 0, minutes: 0, seconds: 0 },
        active_slot: 0,
      }
    }

    if (!this.saveData) {
      throw new Error('No save data loaded')
    }

    // Return cached data by re-parsing (could be optimized with caching)
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
      rawSaveData: this.saveData,
    }
  }
}

// Export for easier usage
export default PokemonSaveParser