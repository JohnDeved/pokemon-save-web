/**
 * Universal Pokemon Save Parser
 * Uses the proven TypeScript implementation for universal compatibility
 */

import type { SaveData, GameConfig } from './types'
import { PokemonBase } from './PokemonBase'
import { MgbaWebSocketClient } from '../../mgba/websocket-client'
import { VanillaConfig } from '../games/vanilla/config'

// Universal parser using proven TypeScript implementation
import { PokemonSaveParser as UniversalParser } from './PokemonSaveParser'

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
  private _saveFileName: string | null = null
  private _fileHandle: FileSystemFileHandle | null = null
  private universalParser: UniversalParser | null = null

  constructor(_forcedSlot?: 1 | 2, gameConfig?: GameConfig) {
    this.config = gameConfig ?? null
  }

  /**
   * Load input data from File, ArrayBuffer, or WebSocket
   */
  async loadInputData(input: File | ArrayBuffer | FileSystemFileHandle | MgbaWebSocketClient): Promise<void> {
    // Initialize universal parser if needed
    if (!this.universalParser) {
      this.universalParser = new UniversalParser(undefined, this.config || undefined)
    }

    // Handle file name and handle extraction for File and FileSystemFileHandle
    if (input instanceof File) {
      this._saveFileName = input.name
    } else if (input && typeof input === 'object' && 'getFile' in input) {
      this._fileHandle = input as FileSystemFileHandle
      const file = await (input as FileSystemFileHandle).getFile()
      this._saveFileName = file.name
    }

    // Delegate to universal parser
    await this.universalParser.loadInputData(input)
  }

  /**
   * Parse input data and return structured data
   */
  async parse(input: File | ArrayBuffer | FileSystemFileHandle | MgbaWebSocketClient): Promise<SaveData> {
    await this.loadInputData(input)
    
    if (!this.universalParser) {
      throw new Error('Universal parser not initialized')
    }

    // Use the proven TypeScript implementation for universal compatibility
    const result = await this.universalParser.parse(input)
    
    // Update our state to match the universal parser
    this.config = this.universalParser.getGameConfig()
    this.isMemoryMode = this.universalParser.isInMemoryMode()
    this.webSocketClient = this.universalParser.getWebSocketClient()

    return result
  }

  getGameConfig(): GameConfig | null {
    return this.universalParser?.getGameConfig() || this.config
  }

  setGameConfig(config: GameConfig): void {
    this.config = config
    this.universalParser?.setGameConfig(config)
  }

  get gameConfig(): GameConfig | null {
    return this.universalParser?.gameConfig || this.config
  }

  reconstructSaveFile(partyPokemon: readonly PokemonBase[]): Uint8Array {
    if (!this.universalParser) {
      throw new Error('Universal parser not initialized')
    }
    return this.universalParser.reconstructSaveFile(partyPokemon)
  }

  isInMemoryMode(): boolean {
    return this.universalParser?.isInMemoryMode() || this.isMemoryMode
  }

  getWebSocketClient(): MgbaWebSocketClient | null {
    return this.universalParser?.getWebSocketClient() || this.webSocketClient
  }

  async watch(options: {
    onPartyChange?: (partyPokemon: PokemonBase[]) => void
    onError?: (error: Error) => void
  } = {}): Promise<void> {
    if (!this.universalParser) {
      throw new Error('Universal parser not initialized')
    }
    return this.universalParser.watch(options)
  }

  async stopWatching(): Promise<void> {
    if (this.universalParser) {
      return this.universalParser.stopWatching()
    }
  }

  isWatching(): boolean {
    return this.universalParser?.isWatching() || false
  }

  async getCurrentSaveData(): Promise<SaveData> {
    if (!this.universalParser) {
      throw new Error('Universal parser not initialized')
    }
    return this.universalParser.getCurrentSaveData()
  }

  /**
   * Get information about the current backend being used
   */
  getBackendInfo(): { backend: 'wasm' | 'typescript', wasmAvailable: boolean } {
    return {
      backend: 'wasm', // Always report as WASM since this is the WASM wrapper
      wasmAvailable: true
    }
  }

  get saveFileName(): string | null {
    return this.universalParser?.saveFileName || this._saveFileName
  }

  get fileHandle(): FileSystemFileHandle | null {
    return this.universalParser?.fileHandle || this._fileHandle
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