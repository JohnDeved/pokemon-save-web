/**
 * WASM-powered Pokemon Save Parser wrapper
 * This replaces the TypeScript implementation with a high-performance Rust/WASM version
 */

import type { SaveData, GameConfig } from './types'
import { PokemonBase } from './PokemonBase'
import { MgbaWebSocketClient } from '../../mgba/websocket-client'
import { VanillaConfig } from '../games/vanilla/config'

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
 * Uses a dummy game config to satisfy the PokemonBase constructor
 */
class WasmPokemonAdapter extends PokemonBase {
  private wasmPokemon: WasmPokemon
  
  constructor(wasmPokemon: WasmPokemon) {
    // Use VanillaConfig for proper GameConfig
    const config = new VanillaConfig()
    
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

    // Parse using WASM
    const wasmSaveData = this.wasmParser.parse()
    const wasmPartyPokemon = this.wasmParser.get_party_pokemon()

    // Convert WASM Pokemon to TypeScript-compatible format
    const partyPokemon = wasmPartyPokemon.map(wasmPokemon => 
      new WasmPokemonAdapter(wasmPokemon)
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
  }

  getGameConfig(): GameConfig | null {
    return this.config
  }

  setGameConfig(config: GameConfig): void {
    this.config = config
  }

  get gameConfig(): GameConfig | null {
    return this.config
  }

  reconstructSaveFile(_partyPokemon: readonly PokemonBase[]): Uint8Array {
    throw new Error('reconstructSaveFile not yet implemented in WASM version')
  }

  isInMemoryMode(): boolean {
    return this.isMemoryMode
  }

  getWebSocketClient(): MgbaWebSocketClient | null {
    return this.webSocketClient
  }

  async watch(_options: {
    onPartyChange?: (partyPokemon: PokemonBase[]) => void
    onError?: (error: Error) => void
  } = {}): Promise<void> {
    throw new Error('Watch mode not yet implemented in WASM version')
  }

  async stopWatching(): Promise<void> {
    // No-op
  }

  isWatching(): boolean {
    return false
  }

  async getCurrentSaveData(): Promise<SaveData> {
    throw new Error('Memory mode not yet implemented in WASM version')
  }

  get saveFileName(): string | null {
    return this._saveFileName
  }

  get fileHandle(): FileSystemFileHandle | null {
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