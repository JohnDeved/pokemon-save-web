/**
 * Pokemon Save Parser with WASM acceleration and TypeScript fallback
 * This provides a smooth migration path from TypeScript to WASM
 */

import type { SaveData, GameConfig } from './types'
import type { PokemonBase } from './PokemonBase'
import { MgbaWebSocketClient } from '../../mgba/websocket-client'

// Import the original TypeScript parser as fallback
import { PokemonSaveParser as TypeScriptParser } from './PokemonSaveParser'

// Try to import WASM parser, but fallback gracefully if it fails
let WasmParser: any = null
let wasmAvailable = false

try {
  // This will be dynamically imported when WASM is ready
  import('./WasmPokemonSaveParser').then((module) => {
    WasmParser = module.PokemonSaveParser
    wasmAvailable = true
  }).catch(() => {
    console.log('WASM parser not available, using TypeScript fallback')
  })
} catch (error) {
  console.log('WASM parser not available, using TypeScript fallback')
}

/**
 * Hybrid Pokemon Save Parser that uses WASM when available, TypeScript as fallback
 */
export class PokemonSaveParser {
  private backendParser: TypeScriptParser
  private useWasm = false

  constructor(forcedSlot?: 1 | 2, gameConfig?: GameConfig) {
    // Always create TypeScript parser as fallback
    this.backendParser = new TypeScriptParser(forcedSlot, gameConfig)
    
    // Check if WASM is available and functional
    this.useWasm = wasmAvailable && WasmParser !== null
  }

  /**
   * Load input data - delegates to appropriate backend
   */
  async loadInputData(input: File | ArrayBuffer | FileSystemFileHandle | MgbaWebSocketClient): Promise<void> {
    if (this.useWasm && this.shouldUseWasm(input)) {
      try {
        const wasmParser = new WasmParser()
        await wasmParser.loadInputData(input)
        // If successful, we could switch to WASM for this instance
        // For now, stick with TypeScript for compatibility
      } catch (error) {
        console.warn('WASM parser failed, falling back to TypeScript:', error)
        this.useWasm = false
      }
    }
    
    // Always load into TypeScript parser for now
    return this.backendParser.loadInputData(input)
  }

  /**
   * Parse input data and return structured data
   */
  async parse(input: File | ArrayBuffer | FileSystemFileHandle | MgbaWebSocketClient): Promise<SaveData> {
    // For now, always use TypeScript parser to ensure compatibility
    // In future versions, we can switch to WASM for file parsing
    return this.backendParser.parse(input)
  }

  /**
   * Check if WASM should be used for this input
   */
  private shouldUseWasm(input: File | ArrayBuffer | FileSystemFileHandle | MgbaWebSocketClient): boolean {
    // For now, only use WASM for file inputs (not WebSocket/memory mode)
    return !(input instanceof MgbaWebSocketClient)
  }

  /**
   * Get current game configuration
   */
  getGameConfig(): GameConfig | null {
    return this.backendParser.getGameConfig()
  }

  /**
   * Set game configuration
   */
  setGameConfig(config: GameConfig): void {
    this.backendParser.setGameConfig(config)
  }

  /**
   * Get currently active game config
   */
  get gameConfig(): GameConfig | null {
    return this.backendParser.gameConfig
  }

  /**
   * Reconstruct save file
   */
  reconstructSaveFile(partyPokemon: readonly PokemonBase[]): Uint8Array {
    return this.backendParser.reconstructSaveFile(partyPokemon)
  }

  /**
   * Check if parser is in memory mode
   */
  isInMemoryMode(): boolean {
    return this.backendParser.isInMemoryMode()
  }

  /**
   * Get WebSocket client
   */
  getWebSocketClient(): MgbaWebSocketClient | null {
    return this.backendParser.getWebSocketClient()
  }

  /**
   * Start watching for changes
   */
  async watch(options: {
    onPartyChange?: (partyPokemon: PokemonBase[]) => void
    onError?: (error: Error) => void
  } = {}): Promise<void> {
    return this.backendParser.watch(options)
  }

  /**
   * Stop watching for changes
   */
  async stopWatching(): Promise<void> {
    return this.backendParser.stopWatching()
  }

  /**
   * Check if currently watching
   */
  isWatching(): boolean {
    return this.backendParser.isWatching()
  }

  /**
   * Get current save data (memory mode only)
   */
  async getCurrentSaveData(): Promise<SaveData> {
    return this.backendParser.getCurrentSaveData()
  }

  /**
   * Get information about the current backend being used
   */
  getBackendInfo(): { backend: 'wasm' | 'typescript', wasmAvailable: boolean } {
    return {
      backend: this.useWasm ? 'wasm' : 'typescript',
      wasmAvailable
    }
  }

  /**
   * Get save file name (delegated to backend)
   */
  get saveFileName(): string | null {
    return this.backendParser.saveFileName
  }

  /**
   * Get file handle (delegated to backend)
   */
  get fileHandle(): FileSystemFileHandle | null {
    return this.backendParser.fileHandle
  }
}

// Export for backwards compatibility
export default PokemonSaveParser

// Re-export everything else from the original module for compatibility
export * from './types'
export * from './PokemonBase'
export * from './utils'