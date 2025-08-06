/**
 * Unified Parser Interface
 * Provides a common interface for both TypeScript and Go WASM parsers
 */

import type { SaveData } from './parser/core/types'
import type { PokemonBase } from './parser/core/PokemonBase'

// Re-export existing types
export type { SaveData, PokemonBase }

export interface UnifiedParserInterface {
  parse(input: File | FileSystemFileHandle): Promise<SaveData>
  parseSaveFile(): Promise<SaveData>
  reconstructSaveFile(partyPokemon: PokemonBase[]): Uint8Array
  saveFileName: string | null
  fileHandle: FileSystemFileHandle | null
}

export enum ParserType {
  TYPESCRIPT = 'typescript',
  GO_WASM = 'go-wasm',
  AUTO = 'auto'
}

export interface ParserConfig {
  type: ParserType
  wasmPath?: string
  fallbackToTypeScript?: boolean
}