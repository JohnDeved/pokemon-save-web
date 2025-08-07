/**
 * Pokemon Save Parser with WASM backend only
 * Direct wrapper around the WASM implementation
 */

import type { SaveData, GameConfig } from './types'
import type { PokemonBase } from './PokemonBase'
import { MgbaWebSocketClient } from '../../mgba/websocket-client'

// Import the WASM parser directly
import { PokemonSaveParser as WasmParser } from './WasmPokemonSaveParser'

/**
 * Pokemon Save Parser that uses WASM exclusively
 */
export class PokemonSaveParser {
  private wasmParser: WasmParser

  constructor(forcedSlot?: 1 | 2, gameConfig?: GameConfig) {
    this.wasmParser = new WasmParser(forcedSlot, gameConfig)
  }

  /**
   * Load input data - delegates to WASM backend
   */
  async loadInputData(input: File | ArrayBuffer | FileSystemFileHandle | MgbaWebSocketClient): Promise<void> {
    return this.wasmParser.loadInputData(input)
  }

  /**
   * Parse input data and return structured data
   */
  async parse(input: File | ArrayBuffer | FileSystemFileHandle | MgbaWebSocketClient): Promise<SaveData> {
    return this.wasmParser.parse(input)
  }

  /**
   * Get current game configuration
   */
  getGameConfig(): GameConfig | null {
    return this.wasmParser.getGameConfig()
  }

  /**
   * Set game configuration
   */
  setGameConfig(config: GameConfig): void {
    this.wasmParser.setGameConfig(config)
  }

  /**
   * Get currently active game config
   */
  get gameConfig(): GameConfig | null {
    return this.wasmParser.gameConfig
  }

  /**
   * Reconstruct save file
   */
  reconstructSaveFile(partyPokemon: readonly PokemonBase[]): Uint8Array {
    return this.wasmParser.reconstructSaveFile(partyPokemon)
  }

  /**
   * Check if parser is in memory mode
   */
  isInMemoryMode(): boolean {
    return this.wasmParser.isInMemoryMode()
  }

  /**
   * Get WebSocket client
   */
  getWebSocketClient(): MgbaWebSocketClient | null {
    return this.wasmParser.getWebSocketClient()
  }

  /**
   * Start watching for changes
   */
  async watch(options: {
    onPartyChange?: (partyPokemon: PokemonBase[]) => void
    onError?: (error: Error) => void
  } = {}): Promise<void> {
    return this.wasmParser.watch(options)
  }

  /**
   * Stop watching for changes
   */
  async stopWatching(): Promise<void> {
    return this.wasmParser.stopWatching()
  }

  /**
   * Check if currently watching
   */
  isWatching(): boolean {
    return this.wasmParser.isWatching()
  }

  /**
   * Get current save data (memory mode only)
   */
  async getCurrentSaveData(): Promise<SaveData> {
    return this.wasmParser.getCurrentSaveData()
  }

  /**
   * Get information about the current backend being used
   */
  getBackendInfo(): { backend: 'wasm', wasmAvailable: boolean } {
    return {
      backend: 'wasm',
      wasmAvailable: true
    }
  }

  /**
   * Get save file name (delegated to backend)
   */
  get saveFileName(): string | null {
    return this.wasmParser.saveFileName
  }

  /**
   * Get file handle (delegated to backend)
   */
  get fileHandle(): FileSystemFileHandle | null {
    return this.wasmParser.fileHandle
  }
}

// Export for backwards compatibility
export default PokemonSaveParser

// Re-export everything else from the original module for compatibility
export * from './types'
export * from './PokemonBase'
export * from './utils'