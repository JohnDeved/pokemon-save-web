/**
 * WebAssembly wrapper for MoonBit Pokemon Save Parser
 * This module provides a TypeScript interface to the MoonBit WASM core
 */

import type {
  GameConfig,
  PlayTimeData,
  SaveData,
} from './types'

import type { PokemonBase } from './PokemonBase'
import { MgbaWebSocketClient } from '../../mgba/websocket-client'

// WASM module interface
interface PokemonParserWasm {
  init_parser(): void
  set_config(name: string, signature: number, pokemonSize: number, maxPartySize: number): void
  parse_save_data(saveBytes: Uint8Array): boolean
  get_party_count(): number
  get_pokemon_species_id(index: number): number
  get_pokemon_nickname(index: number): string
  get_pokemon_level(index: number): number
  get_pokemon_current_hp(index: number): number
  get_pokemon_max_hp(index: number): number
  get_pokemon_attack(index: number): number
  get_pokemon_defense(index: number): number
  get_pokemon_speed(index: number): number
  get_pokemon_sp_attack(index: number): number
  get_pokemon_sp_defense(index: number): number
  get_pokemon_nature(index: number): string
  get_pokemon_ot_name(index: number): string
  get_pokemon_ot_id(index: number): number
  get_pokemon_ability_number(index: number): number
  get_pokemon_shiny_number(index: number): number
  get_player_name(): string
  get_play_time_hours(): number
  get_play_time_minutes(): number
  get_play_time_seconds(): number
  get_active_slot(): number
  get_config_name(): string
}

// Simplified WASM Pokemon implementation with minimal interface
class WasmPokemonBase {
  constructor(
    private wasmModule: PokemonParserWasm,
    private index: number,
    private config: GameConfig
  ) {}

  get speciesId(): number { return this.wasmModule.get_pokemon_species_id(this.index) }
  get nickname(): string { return this.wasmModule.get_pokemon_nickname(this.index) }
  get level(): number { return this.wasmModule.get_pokemon_level(this.index) }
  get currentHp(): number { return this.wasmModule.get_pokemon_current_hp(this.index) }
  get maxHp(): number { return this.wasmModule.get_pokemon_max_hp(this.index) }
  get attack(): number { return this.wasmModule.get_pokemon_attack(this.index) }
  get defense(): number { return this.wasmModule.get_pokemon_defense(this.index) }
  get speed(): number { return this.wasmModule.get_pokemon_speed(this.index) }
  get spAttack(): number { return this.wasmModule.get_pokemon_sp_attack(this.index) }
  get spDefense(): number { return this.wasmModule.get_pokemon_sp_defense(this.index) }
  get nature(): string { return this.wasmModule.get_pokemon_nature(this.index) }
  get otName(): string { return this.wasmModule.get_pokemon_ot_name(this.index) }
  get otId(): number { return this.wasmModule.get_pokemon_ot_id(this.index) }
  get otId_str(): string { return this.otId.toString() }
  get abilityNumber(): number { return this.wasmModule.get_pokemon_ability_number(this.index) }
  get shinyNumber(): number { return this.wasmModule.get_pokemon_shiny_number(this.index) }
  get status(): number { return 0 } // Simplified for now
  get personality(): number { return 0 } // Simplified for now
  
  // Raw bytes access - simplified implementation
  get rawBytes(): Uint8Array {
    // In a full implementation, this would return the actual Pokemon bytes
    // For now, return empty array as this is complex to implement with WASM
    return new Uint8Array(this.config.pokemonSize)
  }

  // Additional properties that may be needed by existing code
  get move1(): number { return 0 }
  get move2(): number { return 0 }
  get move3(): number { return 0 }
  get move4(): number { return 0 }
  get pp1(): number { return 0 }
  get pp2(): number { return 0 }
  get pp3(): number { return 0 }
  get pp4(): number { return 0 }
  get hpEV(): number { return 0 }
  get atkEV(): number { return 0 }
  get defEV(): number { return 0 }
  get spdEV(): number { return 0 }
  get spAtkEV(): number { return 0 }
  get spDefEV(): number { return 0 }
  get hpIV(): number { return 0 }
  get atkIV(): number { return 0 }
  get defIV(): number { return 0 }
  get spdIV(): number { return 0 }
  get spAtkIV(): number { return 0 }
  get spDefIV(): number { return 0 }

  // Stat setters (would need to be implemented in WASM for full functionality)
  set maxHp(_value: number) { 
    console.warn('WASM Pokemon stat modification not yet implemented')
  }
  set attack(_value: number) { 
    console.warn('WASM Pokemon stat modification not yet implemented')
  }
  set defense(_value: number) { 
    console.warn('WASM Pokemon stat modification not yet implemented')
  }
  set speed(_value: number) { 
    console.warn('WASM Pokemon stat modification not yet implemented')
  }
  set spAttack(_value: number) { 
    console.warn('WASM Pokemon stat modification not yet implemented')
  }
  set spDefense(_value: number) { 
    console.warn('WASM Pokemon stat modification not yet implemented')
  }
  set hpEV(_value: number) { 
    console.warn('WASM Pokemon EV modification not yet implemented')
  }
  set atkEV(_value: number) { 
    console.warn('WASM Pokemon EV modification not yet implemented')
  }
  set defEV(_value: number) { 
    console.warn('WASM Pokemon EV modification not yet implemented')
  }
  set spdEV(_value: number) { 
    console.warn('WASM Pokemon EV modification not yet implemented')
  }
  set spAtkEV(_value: number) { 
    console.warn('WASM Pokemon EV modification not yet implemented')
  }
  set spDefEV(_value: number) { 
    console.warn('WASM Pokemon EV modification not yet implemented')
  }
}

/**
 * WASM-based Pokemon Save Parser
 * Drop-in replacement for the TypeScript PokemonSaveParser
 */
export class PokemonSaveParser {
  private wasmModule: PokemonParserWasm | null = null
  private config: GameConfig | null = null
  public saveFileName: string | null = null
  public fileHandle: FileSystemFileHandle | null = null

  // Memory mode properties (WebSocket support maintained but limited)
  private webSocketClient: MgbaWebSocketClient | null = null
  private isMemoryMode = false

  constructor(
    _forcedSlot?: 1 | 2,
    gameConfig?: GameConfig
  ) {
    this.config = gameConfig ?? null
  }

  /**
   * Initialize WASM module
   */
  private async initWasm(): Promise<void> {
    if (this.wasmModule) {
      return // Already initialized
    }

    try {
      // Load WASM module
      /* @vite-ignore */
      const wasmPath = new URL('./wasm/pokemon-parser.wasm', import.meta.url)
      const wasmModule = await WebAssembly.instantiateStreaming(fetch(wasmPath))
      
      // Create interface to WASM exports
      this.wasmModule = {
        init_parser: wasmModule.instance.exports.init_parser as () => void,
        set_config: wasmModule.instance.exports.set_config as (name: string, signature: number, pokemonSize: number, maxPartySize: number) => void,
        parse_save_data: wasmModule.instance.exports.parse_save_data as (saveBytes: Uint8Array) => boolean,
        get_party_count: wasmModule.instance.exports.get_party_count as () => number,
        get_pokemon_species_id: wasmModule.instance.exports.get_pokemon_species_id as (index: number) => number,
        get_pokemon_nickname: wasmModule.instance.exports.get_pokemon_nickname as (index: number) => string,
        get_pokemon_level: wasmModule.instance.exports.get_pokemon_level as (index: number) => number,
        get_pokemon_current_hp: wasmModule.instance.exports.get_pokemon_current_hp as (index: number) => number,
        get_pokemon_max_hp: wasmModule.instance.exports.get_pokemon_max_hp as (index: number) => number,
        get_pokemon_attack: wasmModule.instance.exports.get_pokemon_attack as (index: number) => number,
        get_pokemon_defense: wasmModule.instance.exports.get_pokemon_defense as (index: number) => number,
        get_pokemon_speed: wasmModule.instance.exports.get_pokemon_speed as (index: number) => number,
        get_pokemon_sp_attack: wasmModule.instance.exports.get_pokemon_sp_attack as (index: number) => number,
        get_pokemon_sp_defense: wasmModule.instance.exports.get_pokemon_sp_defense as (index: number) => number,
        get_pokemon_nature: wasmModule.instance.exports.get_pokemon_nature as (index: number) => string,
        get_pokemon_ot_name: wasmModule.instance.exports.get_pokemon_ot_name as (index: number) => string,
        get_pokemon_ot_id: wasmModule.instance.exports.get_pokemon_ot_id as (index: number) => number,
        get_pokemon_ability_number: wasmModule.instance.exports.get_pokemon_ability_number as (index: number) => number,
        get_pokemon_shiny_number: wasmModule.instance.exports.get_pokemon_shiny_number as (index: number) => number,
        get_player_name: wasmModule.instance.exports.get_player_name as () => string,
        get_play_time_hours: wasmModule.instance.exports.get_play_time_hours as () => number,
        get_play_time_minutes: wasmModule.instance.exports.get_play_time_minutes as () => number,
        get_play_time_seconds: wasmModule.instance.exports.get_play_time_seconds as () => number,
        get_active_slot: wasmModule.instance.exports.get_active_slot as () => number,
        get_config_name: wasmModule.instance.exports.get_config_name as () => string,
      }

      // Initialize WASM parser
      this.wasmModule.init_parser()

      // Set config if available
      if (this.config) {
        this.wasmModule.set_config(
          this.config.name,
          this.config.signature ?? 0x08012025,
          this.config.pokemonSize,
          this.config.maxPartySize
        )
      }
    } catch (error) {
      throw new Error(`Failed to initialize WASM module: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Load input data from File, ArrayBuffer, FileSystemFileHandle, or WebSocket
   */
  async loadInputData(input: File | ArrayBuffer | FileSystemFileHandle | MgbaWebSocketClient): Promise<void> {
    await this.initWasm()

    if (!this.wasmModule) {
      throw new Error('WASM module not initialized')
    }

    try {
      // WebSocket mode detection
      if (input instanceof MgbaWebSocketClient) {
        this.isMemoryMode = true
        this.webSocketClient = input
        throw new Error('WebSocket memory mode not yet implemented in WASM parser')
      }

      // Reset memory mode for file operations
      this.isMemoryMode = false
      this.webSocketClient = null

      let buffer: ArrayBuffer

      // Handle FileSystemFileHandle
      if (typeof FileSystemFileHandle !== 'undefined' && input instanceof FileSystemFileHandle) {
        this.fileHandle = input
        input = await input.getFile()
      }

      if (input instanceof File) {
        this.saveFileName = input.name
        buffer = await input.arrayBuffer()
      } else {
        buffer = input as ArrayBuffer
      }

      // Pass data to WASM
      const success = this.wasmModule.parse_save_data(new Uint8Array(buffer))
      if (!success) {
        throw new Error('Failed to parse save data in WASM module')
      }

    } catch (error) {
      throw new Error(`Failed to load save file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Parse input data and return structured data
   */
  async parse(input: File | ArrayBuffer | FileSystemFileHandle | MgbaWebSocketClient): Promise<SaveData> {
    await this.loadInputData(input)

    if (!this.wasmModule) {
      throw new Error('WASM module not initialized')
    }

    // Memory mode handling
    if (this.isMemoryMode) {
      throw new Error('Memory mode parsing not yet implemented in WASM parser')
    }

    // Create Pokemon instances from WASM data
    const partyCount = this.wasmModule.get_party_count()
    const partyPokemon: PokemonBase[] = []

    for (let i = 0; i < partyCount; i++) {
      partyPokemon.push(new WasmPokemonBase(this.wasmModule, i, this.config!) as any)
    }

    // Get other save data
    const playerName = this.wasmModule.get_player_name()
    const playTime: PlayTimeData = {
      hours: this.wasmModule.get_play_time_hours(),
      minutes: this.wasmModule.get_play_time_minutes(),
      seconds: this.wasmModule.get_play_time_seconds(),
    }
    const activeSlot = this.wasmModule.get_active_slot()

    return {
      party_pokemon: partyPokemon,
      player_name: playerName,
      play_time: playTime,
      active_slot: activeSlot,
      // WASM mode doesn't have sector_map or rawSaveData
      sector_map: undefined,
      rawSaveData: undefined,
    }
  }

  /**
   * Get the current game configuration
   */
  getGameConfig(): GameConfig | null {
    return this.config
  }

  /**
   * Set the game configuration
   */
  setGameConfig(config: GameConfig): void {
    this.config = config
    
    // Update WASM module if initialized
    if (this.wasmModule) {
      this.wasmModule.set_config(
        config.name,
        config.signature ?? 0x08012025,
        config.pokemonSize,
        config.maxPartySize
      )
    }
  }

  /**
   * Get the currently active game config
   */
  get gameConfig(): GameConfig | null {
    return this.config
  }

  /**
   * Reconstruct save file (simplified implementation)
   */
  reconstructSaveFile(_partyPokemon: readonly PokemonBase[]): Uint8Array {
    throw new Error('Save file reconstruction not yet implemented in WASM parser')
  }

  /**
   * Check if parser is in memory mode
   */
  isInMemoryMode(): boolean {
    return this.isMemoryMode
  }

  /**
   * Get the WebSocket client
   */
  getWebSocketClient(): MgbaWebSocketClient | null {
    return this.webSocketClient
  }

  /**
   * Watch for Pokemon changes (memory mode)
   */
  async watch(_options: {
    onPartyChange?: (partyPokemon: PokemonBase[]) => void
    onError?: (error: Error) => void
  } = {}): Promise<void> {
    throw new Error('Watch mode not yet implemented in WASM parser')
  }

  /**
   * Stop watching for changes
   */
  async stopWatching(): Promise<void> {
    // Nothing to stop in current implementation
  }

  /**
   * Check if currently watching
   */
  isWatching(): boolean {
    return false
  }

  /**
   * Get current save data without re-parsing
   */
  async getCurrentSaveData(): Promise<SaveData> {
    throw new Error('getCurrentSaveData not yet implemented in WASM parser')
  }
}

// Export for easier usage
export default PokemonSaveParser