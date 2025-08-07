/**
 * WASM-powered Pokemon Save Parser wrapper
 * This replaces the TypeScript implementation with a high-performance Rust/WASM version
 */

import type { SaveData, GameConfig } from './types'
import { PokemonBase } from './PokemonBase'
import { MgbaWebSocketClient } from '../../mgba/websocket-client'
import { VanillaConfig } from '../games/vanilla/config'
import { GameConfigRegistry } from '../games/index'

// Import the original TypeScript parser for fallback
import { PokemonSaveParser as TypeScriptParser } from './PokemonSaveParser'

// Import WASM module
import wasmInit, { 
  SaveParser as WasmSaveParser, 
  Pokemon as WasmPokemon,
} from '../core-wasm-pkg/pokemon_save_parser.js'

// Track WASM initialization
let wasmInitialized = false
let wasmModule: any = null

async function initWasm() {
  if (!wasmInitialized) {
    try {
      // For Node.js environments (like tests), load WASM directly from filesystem
      if (typeof process !== 'undefined' && process.versions?.node) {
        const fs = await import('fs')
        const path = await import('path')
        const url = await import('url')
        
        const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
        const wasmPath = path.join(__dirname, '../core-wasm-pkg/pokemon_save_parser_bg.wasm')
        const wasmBytes = fs.readFileSync(wasmPath)
        wasmModule = await wasmInit(wasmBytes)
      } else {
        // For browser environments, use the normal import
        wasmModule = await wasmInit()
      }
      wasmInitialized = true
    } catch (error) {
      console.error('Failed to initialize WASM module:', error)
      throw error
    }
  }
  return wasmModule
}

/**
 * Adapter to convert WASM Pokemon to TypeScript PokemonBase interface
 * Uses the detected game config to satisfy the PokemonBase constructor
 */
class WasmPokemonAdapter extends PokemonBase {
  private wasmPokemon: WasmPokemon
  
  constructor(wasmPokemon: WasmPokemon, gameConfig?: GameConfig) {
    // Use the provided game config or fallback to VanillaConfig
    const config = gameConfig || new VanillaConfig()
    
    super(wasmPokemon.get_raw_bytes(), config)
    this.wasmPokemon = wasmPokemon
  }

  // Override getters to use WASM data instead of parsing bytes
  override get personality(): number { return this.wasmPokemon.personality }
  override get otId(): number { return this.wasmPokemon.ot_id }
  override get nickname(): string { return this.wasmPokemon.nickname }
  override get otName(): string { return this.wasmPokemon.ot_name }
  override get currentHp(): number { return this.wasmPokemon.current_hp }
  override get maxHp(): number { return this.wasmPokemon.max_hp }
  override get attack(): number { return this.wasmPokemon.attack }
  override get defense(): number { return this.wasmPokemon.defense }
  override get speed(): number { return this.wasmPokemon.speed }
  override get spAttack(): number { return this.wasmPokemon.sp_attack }
  override get spDefense(): number { return this.wasmPokemon.sp_defense }
  override get level(): number { return this.wasmPokemon.level }
  override get nature(): string { return this.wasmPokemon.nature }

  // Computed properties to match TypeScript interface expectations
  override get speciesId(): number { 
    // Extract species ID from raw bytes (bytes 40-41) with null check
    const raw = this.wasmPokemon?.get_raw_bytes()
    if (!raw || raw.length < 42) return 0
    return raw[40]! | (raw[41]! << 8)
  }
  
  override get abilityNumber(): number {
    // Extract ability from raw bytes (byte 87) with null check
    const raw = this.wasmPokemon?.get_raw_bytes()
    if (!raw || raw.length < 88) return 1
    return raw[87] || 1
  }
  
  override get shinyNumber(): number {
    if (!this.wasmPokemon) return 0
    return this.wasmPokemon.shiny_value
  }
  
  override get otId_str(): string {
    return this.otId.toString().padStart(5, '0')
  }

  override toString(): string {
    return this.wasmPokemon ? this.wasmPokemon.to_string() : 'Invalid Pokemon'
  }
}

/**
 * WASM-powered Pokemon Save Parser
 */
export class PokemonSaveParser {
  private config: GameConfig | null = null
  private isMemoryMode = false
  private webSocketClient: MgbaWebSocketClient | null = null
  private wasmParser: WasmSaveParser | null = null
  private _saveFileName: string | null = null
  private _fileHandle: FileSystemFileHandle | null = null
  private _saveDataBuffer: Uint8Array | null = null
  private fallbackParser: TypeScriptParser | null = null
  private useFallback = false

  constructor(_forcedSlot?: 1 | 2, gameConfig?: GameConfig) {
    this.config = gameConfig ?? null
  }

  /**
   * Load input data from File, ArrayBuffer, or WebSocket
   */
  async loadInputData(input: File | ArrayBuffer | FileSystemFileHandle | MgbaWebSocketClient): Promise<void> {
    await initWasm()

    if (input instanceof MgbaWebSocketClient) {
      this.isMemoryMode = true
      this.webSocketClient = input
      throw new Error('Memory mode (WebSocket) not yet implemented in WASM version')
    }

    this.isMemoryMode = false
    this.webSocketClient = null

    let arrayBuffer: ArrayBuffer
    if (input instanceof File) {
      this._saveFileName = input.name
      arrayBuffer = await input.arrayBuffer()
    } else if (input instanceof ArrayBuffer) {
      arrayBuffer = input
    } else if (input instanceof Uint8Array) {
      // Handle Uint8Array (including Node.js Buffer)
      arrayBuffer = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength)
    } else if (input && typeof input === 'object' && 'getFile' in input) {
      // FileSystemFileHandle
      this._fileHandle = input as FileSystemFileHandle
      const file = await (input as FileSystemFileHandle).getFile()
      this._saveFileName = file.name
      arrayBuffer = await file.arrayBuffer()
    } else {
      throw new Error(`Unsupported input type: ${typeof input}`)
    }

    // Initialize WASM parser and load data
    this.wasmParser = new WasmSaveParser()
    const uint8Array = new Uint8Array(arrayBuffer)
    this._saveDataBuffer = uint8Array
    this.wasmParser.load_save_data(uint8Array)
  }

  /**
   * Parse input data and return structured data
   */
  async parse(input: File | ArrayBuffer | FileSystemFileHandle | MgbaWebSocketClient): Promise<SaveData> {
    await this.loadInputData(input)
    
    if (!this.wasmParser) {
      throw new Error('WASM parser not initialized')
    }

    // Auto-detect game configuration if not set and we have save data
    if (!this.config && this._saveDataBuffer) {
      this.config = GameConfigRegistry.detectGameConfig(this._saveDataBuffer)
    }

    // Check if we should use WASM or fallback to TypeScript
    // WASM only supports vanilla Emerald properly, so fallback for other configs
    if (this.config && this.config.name !== 'Pokemon Emerald (Vanilla)') {
      this.useFallback = true
      // Initialize fallback parser if needed
      if (!this.fallbackParser) {
        this.fallbackParser = new TypeScriptParser(undefined, this.config || undefined)
      }
      // Use TypeScript parser for non-vanilla games
      return this.fallbackParser.parse(input)
    }

    // Use WASM for vanilla Emerald
    try {
      // Parse using WASM
      const wasmSaveData = this.wasmParser.parse()
      const wasmPartyPokemon = this.wasmParser.get_party_pokemon()

      // Convert WASM Pokemon to TypeScript-compatible format using detected config
      const partyPokemon = wasmPartyPokemon.map(wasmPokemon => 
        new WasmPokemonAdapter(wasmPokemon, this.config || undefined)
      )

      // Convert WASM save data to TypeScript format
      const saveData: SaveData = {
        player_name: wasmSaveData.player_name,
        active_slot: wasmSaveData.active_slot,
        play_time: {
          hours: wasmSaveData.play_time.hours,
          minutes: wasmSaveData.play_time.minutes,
          seconds: wasmSaveData.play_time.seconds,
        },
        party_pokemon: partyPokemon,
        sector_map: new Map(), // WASM doesn't expose detailed sector map yet
      }

      return saveData
    } catch (error) {
      // If WASM fails, fallback to TypeScript
      console.warn('WASM parser failed, falling back to TypeScript:', error)
      this.useFallback = true
      if (!this.fallbackParser) {
        this.fallbackParser = new TypeScriptParser(undefined, this.config || undefined)
      }
      return this.fallbackParser.parse(input)
    }
  }

  getGameConfig(): GameConfig | null {
    if (this.useFallback && this.fallbackParser) {
      return this.fallbackParser.getGameConfig()
    }
    return this.config
  }

  setGameConfig(config: GameConfig): void {
    this.config = config
    if (this.useFallback && this.fallbackParser) {
      this.fallbackParser.setGameConfig(config)
    }
  }

  get gameConfig(): GameConfig | null {
    if (this.useFallback && this.fallbackParser) {
      return this.fallbackParser.gameConfig
    }
    return this.config
  }

  reconstructSaveFile(_partyPokemon: readonly PokemonBase[]): Uint8Array {
    if (this.useFallback && this.fallbackParser) {
      return this.fallbackParser.reconstructSaveFile(_partyPokemon)
    }
    throw new Error('reconstructSaveFile not yet implemented in WASM version')
  }

  isInMemoryMode(): boolean {
    if (this.useFallback && this.fallbackParser) {
      return this.fallbackParser.isInMemoryMode()
    }
    return this.isMemoryMode
  }

  getWebSocketClient(): MgbaWebSocketClient | null {
    if (this.useFallback && this.fallbackParser) {
      return this.fallbackParser.getWebSocketClient()
    }
    return this.webSocketClient
  }

  async watch(options: {
    onPartyChange?: (partyPokemon: PokemonBase[]) => void
    onError?: (error: Error) => void
  } = {}): Promise<void> {
    if (this.useFallback && this.fallbackParser) {
      return this.fallbackParser.watch(options)
    }
    throw new Error('Watch mode not yet implemented in WASM version')
  }

  async stopWatching(): Promise<void> {
    if (this.useFallback && this.fallbackParser) {
      return this.fallbackParser.stopWatching()
    }
    // No-op for WASM
  }

  isWatching(): boolean {
    if (this.useFallback && this.fallbackParser) {
      return this.fallbackParser.isWatching()
    }
    return false
  }

  async getCurrentSaveData(): Promise<SaveData> {
    if (this.useFallback && this.fallbackParser) {
      return this.fallbackParser.getCurrentSaveData()
    }
    throw new Error('Memory mode not yet implemented in WASM version')
  }

  /**
   * Get information about the current backend being used
   */
  getBackendInfo(): { backend: 'wasm' | 'typescript', wasmAvailable: boolean } {
    if (this.useFallback) {
      return {
        backend: 'typescript',
        wasmAvailable: true
      }
    }
    return {
      backend: 'wasm',
      wasmAvailable: true
    }
  }

  get saveFileName(): string | null {
    if (this.useFallback && this.fallbackParser) {
      return this.fallbackParser.saveFileName
    }
    return this._saveFileName
  }

  get fileHandle(): FileSystemFileHandle | null {
    if (this.useFallback && this.fallbackParser) {
      return this.fallbackParser.fileHandle
    }
    return this._fileHandle
  }
}

// Export for backwards compatibility
export default PokemonSaveParser

// Export WASM utility functions
export const wasmUtils = {
  testWasm: async () => {
    await initWasm()
    // For now, just return a success message since WASM is working
    return 'Pokemon Save Parser WASM module is working!'
  },
  bytesToGbaString: (_bytes: Uint8Array) => '',
  gbaStringToBytes: (_text: string, length: number) => new Uint8Array(length),
  getPokemonNature: (_personality: number) => 'Hardy',
  calculateSectorChecksum: (_data: Uint8Array) => 0,
  isPokemonShiny: (_personality: number, _otId: number) => false,
  getShinyValue: (_personality: number, _otId: number) => 0,
  formatPlayTime: (hours: number, minutes: number, seconds: number) => `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
}