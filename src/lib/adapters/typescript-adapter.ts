/**
 * TypeScript Parser Adapter
 * Adapts the existing TypeScript parser to the unified interface
 */

import type { SaveData, PokemonBase, UnifiedParserInterface } from '../unified-parser'
import { PokemonSaveParser } from '../parser/core/PokemonSaveParser'

export class TypeScriptParserAdapter implements UnifiedParserInterface {
  private parser: PokemonSaveParser
  public saveFileName: string | null = null
  public fileHandle: FileSystemFileHandle | null = null

  constructor() {
    this.parser = new PokemonSaveParser()
  }

  async parse(input: File | FileSystemFileHandle): Promise<SaveData> {
    const result = await this.parser.parse(input)
    this.saveFileName = this.parser.saveFileName
    this.fileHandle = this.parser.fileHandle
    return result
  }

  async parseSaveFile(): Promise<SaveData> {
    return await this.parser.getCurrentSaveData()
  }

  reconstructSaveFile(partyPokemon: PokemonBase[]): Uint8Array {
    return this.parser.reconstructSaveFile(partyPokemon)
  }

  getGameConfig() {
    return this.parser.getGameConfig()
  }

  // Additional methods that might be useful
  async loadInputData(input: File | ArrayBuffer | FileSystemFileHandle) {
    return await this.parser.loadInputData(input)
  }
}