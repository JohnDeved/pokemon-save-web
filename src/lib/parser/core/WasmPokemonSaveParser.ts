/**
 * WASM-powered Pokemon Save Parser wrapper
 * This replaces the TypeScript implementation with a high-performance Rust/WASM version
 */

import type { SaveData as WasmSaveData, PlayTimeData as WasmPlayTimeData, Pokemon as WasmPokemon, SaveParser as WasmSaveParser } from '../core-wasm-pkg/pokemon_save_parser.js'
import wasmInit, * as WasmModule from '../core-wasm-pkg/pokemon_save_parser.js'
import type { SaveData, PlayTimeData, GameConfig } from './types'
import type { PokemonBase } from './PokemonBase'
import { MgbaWebSocketClient } from '../../mgba/websocket-client'

// Initialize WASM module (this should be done once)
let wasmInitialized = false
async function initWasm() {
  if (!wasmInitialized) {
    await wasmInit()
    wasmInitialized = true
  }
}

/**
 * WASM-powered Pokemon wrapper that mimics the original PokemonBase interface
 */
class WasmPokemonWrapper implements PokemonBase {
  constructor(private wasmPokemon: WasmPokemon) {}

  get rawBytes(): Uint8Array {
    return new Uint8Array(this.wasmPokemon.get_raw_bytes())
  }

  get personality(): number {
    return this.wasmPokemon.personality
  }

  set personality(value: number) {
    this.wasmPokemon.personality = value
  }

  get otId(): number {
    return this.wasmPokemon.ot_id
  }

  get otId_str(): string {
    return this.otId.toString()
  }

  get nickname(): string {
    return this.wasmPokemon.nickname
  }

  get otName(): string {
    return this.wasmPokemon.ot_name
  }

  get currentHp(): number {
    return this.wasmPokemon.current_hp
  }

  set currentHp(value: number) {
    this.wasmPokemon.current_hp = value
  }

  get maxHp(): number {
    return this.wasmPokemon.max_hp
  }

  get attack(): number {
    return this.wasmPokemon.attack
  }

  get defense(): number {
    return this.wasmPokemon.defense
  }

  get speed(): number {
    return this.wasmPokemon.speed
  }

  get spAttack(): number {
    return this.wasmPokemon.sp_attack
  }

  get spDefense(): number {
    return this.wasmPokemon.sp_defense
  }

  get level(): number {
    return this.wasmPokemon.level
  }

  set level(value: number) {
    this.wasmPokemon.level = value
  }

  get nature(): string {
    return this.wasmPokemon.nature
  }

  get isShiny(): boolean {
    return this.wasmPokemon.is_shiny
  }

  get shinyNumber(): number {
    return this.wasmPokemon.shiny_value
  }

  // Placeholder implementations for compatibility
  get speciesId(): number {
    // This would need to be implemented in Rust for real usage
    return 1 // Placeholder
  }

  get abilityNumber(): number {
    // This would need to be implemented in Rust for real usage
    return 1 // Placeholder
  }

  get ivs(): readonly number[] {
    // This would need to be implemented in Rust (requires decryption)
    return [31, 31, 31, 31, 31, 31] // Placeholder perfect IVs
  }

  get evs(): readonly number[] {
    // This would need to be implemented in Rust (requires decryption)
    return [0, 0, 0, 0, 0, 0] // Placeholder no EVs
  }

  // Methods for compatibility with existing interface
  setNatureRaw(natureIndex: number): void {
    // This would need to be implemented in Rust to modify personality
    console.warn('setNatureRaw not yet implemented in WASM version')
  }

  toString(): string {
    return this.wasmPokemon.to_string()
  }
}

/**
 * WASM-powered Pokemon Save Parser that replaces the TypeScript implementation
 */
export class PokemonSaveParser {
  private wasmParser: WasmSaveParser | null = null
  private config: GameConfig | null = null
  private isMemoryMode = false
  private webSocketClient: MgbaWebSocketClient | null = null

  constructor(forcedSlot?: 1 | 2, gameConfig?: GameConfig) {
    // Store config for compatibility but WASM parser doesn't use it yet
    this.config = gameConfig ?? null
  }

  /**
   * Load input data from File, ArrayBuffer, or WebSocket
   */
  async loadInputData(input: File | ArrayBuffer | FileSystemFileHandle | MgbaWebSocketClient): Promise<void> {
    await initWasm()

    if (input instanceof MgbaWebSocketClient) {
      // Memory mode not yet fully implemented in WASM
      this.isMemoryMode = true
      this.webSocketClient = input
      throw new Error('Memory mode (WebSocket) not yet implemented in WASM version')
    }

    // Reset memory mode for file operations
    this.isMemoryMode = false
    this.webSocketClient = null

    let buffer: ArrayBuffer

    // Handle FileSystemFileHandle if available (browser)
    if (typeof FileSystemFileHandle !== 'undefined' && input instanceof FileSystemFileHandle) {
      input = await input.getFile()
    }

    if (input instanceof File) {
      buffer = await input.arrayBuffer()
    } else {
      buffer = input as ArrayBuffer
    }

    // Create WASM parser and load data
    this.wasmParser = new WasmModule.SaveParser()
    const uint8Array = new Uint8Array(buffer)
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

    if (this.isMemoryMode) {
      throw new Error('Memory mode not yet implemented in WASM version')
    }

    // Parse using WASM
    const wasmSaveData = this.wasmParser.parse()
    const partyPokemon = this.wasmParser.get_party_pokemon()

    // Convert WASM Pokemon to wrapper objects
    const wrappedParty: PokemonBase[] = partyPokemon.map(p => new WasmPokemonWrapper(p))

    // Convert WASM data types to TypeScript interfaces
    const playTime: PlayTimeData = {
      hours: wasmSaveData.play_time.hours,
      minutes: wasmSaveData.play_time.minutes,
      seconds: wasmSaveData.play_time.seconds,
    }

    return {
      party_pokemon: wrappedParty,
      player_name: wasmSaveData.player_name,
      play_time: playTime,
      active_slot: wasmSaveData.active_slot,
      // Note: sector_map and rawSaveData not exposed by WASM yet
    }
  }

  /**
   * Get current game configuration
   */
  getGameConfig(): GameConfig | null {
    return this.config
  }

  /**
   * Set game configuration
   */
  setGameConfig(config: GameConfig): void {
    this.config = config
  }

  /**
   * Get currently active game config (alias)
   */
  get gameConfig(): GameConfig | null {
    return this.config
  }

  /**
   * Check if parser is in memory mode
   */
  isInMemoryMode(): boolean {
    return this.isMemoryMode
  }

  /**
   * Get WebSocket client (for memory mode)
   */
  getWebSocketClient(): MgbaWebSocketClient | null {
    return this.webSocketClient
  }

  /**
   * Reconstruct save file (not yet implemented in WASM)
   */
  reconstructSaveFile(partyPokemon: readonly PokemonBase[]): Uint8Array {
    throw new Error('reconstructSaveFile not yet implemented in WASM version')
  }

  /**
   * Memory watching methods (not yet implemented in WASM)
   */
  async watch(options: {
    onPartyChange?: (partyPokemon: PokemonBase[]) => void
    onError?: (error: Error) => void
  } = {}): Promise<void> {
    throw new Error('Watch mode not yet implemented in WASM version')
  }

  async stopWatching(): Promise<void> {
    // No-op for now
  }

  isWatching(): boolean {
    return false
  }

  async getCurrentSaveData(): Promise<SaveData> {
    if (!this.isMemoryMode) {
      throw new Error('getCurrentSaveData only available in memory mode')
    }
    throw new Error('Memory mode not yet implemented in WASM version')
  }
}

// Export for backwards compatibility
export default PokemonSaveParser

// Export utility functions from WASM
export const wasmUtils = {
  testWasm: () => initWasm().then(() => WasmModule.test_wasm()),
  bytesToGbaString: (bytes: Uint8Array) => WasmModule.bytes_to_gba_string(bytes),
  gbaStringToBytes: (text: string, length: number) => WasmModule.gba_string_to_bytes(text, length),
  getPokemonNature: (personality: number) => WasmModule.get_pokemon_nature(personality),
  calculateSectorChecksum: (data: Uint8Array) => WasmModule.calculate_sector_checksum(data),
  isPokemonShiny: (personality: number, otId: number) => WasmModule.is_pokemon_shiny(personality, otId),
  getShinyValue: (personality: number, otId: number) => WasmModule.get_shiny_value(personality, otId),
  formatPlayTime: (hours: number, minutes: number, seconds: number) => WasmModule.format_play_time(hours, minutes, seconds),
}