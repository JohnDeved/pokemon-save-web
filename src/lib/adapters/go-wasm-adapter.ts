/**
 * Go WASM Parser Adapter
 * Adapts the Go WASM parser to match the TypeScript parser interface
 */

import type { SaveData, PokemonBase, UnifiedParserInterface } from '../unified-parser'
import { GoWASMParser } from '../parser/wasm-wrapper.js'

export class GoWASMParserAdapter implements UnifiedParserInterface {
  private wasmParser: GoWASMParser
  public saveFileName: string | null = null
  public fileHandle: FileSystemFileHandle | null = null
  private lastSaveData: SaveData | null = null

  constructor(wasmPath = '/parser.wasm') {
    this.wasmParser = new GoWASMParser()
    // Initialize WASM module in the background
    this.wasmParser.initialize(wasmPath).catch(error => {
      console.warn('Failed to initialize Go WASM parser:', error)
    })
  }

  async parse(input: File | FileSystemFileHandle): Promise<SaveData> {
    let file: File
    
    if (input instanceof File) {
      file = input
      this.saveFileName = file.name
      this.fileHandle = null
    } else {
      // FileSystemFileHandle
      file = await input.getFile()
      this.saveFileName = file.name
      this.fileHandle = input
    }

    // Convert File to Uint8Array
    const arrayBuffer = await file.arrayBuffer()
    const saveData = new Uint8Array(arrayBuffer)

    // Parse with Go WASM
    const result = await this.wasmParser.parseSaveFile(saveData)
    this.lastSaveData = result
    return result
  }

  async parseSaveFile(): Promise<SaveData> {
    if (!this.lastSaveData) {
      throw new Error('No save data loaded. Call parse() first.')
    }
    return this.lastSaveData
  }

  reconstructSaveFile(partyPokemon: PokemonBase[]): Uint8Array {
    // For now, return the original raw save data since we don't have reconstruction logic in Go yet
    // This would need to be implemented in the Go parser and exposed via WASM
    if (this.lastSaveData?.rawSaveData) {
      return new Uint8Array(this.lastSaveData.rawSaveData)
    }
    throw new Error('No raw save data available for reconstruction')
  }

  async isReady(): Promise<boolean> {
    try {
      await this.wasmParser.initialize()
      return this.wasmParser.isReady()
    } catch {
      return false
    }
  }

  async getVersion(): Promise<string> {
    return await this.wasmParser.getVersion()
  }

  async encodeText(text: string, maxLength = 10): Promise<Uint8Array> {
    return await this.wasmParser.encodeText(text, maxLength)
  }

  async decodeText(data: Uint8Array): Promise<string> {
    return await this.wasmParser.decodeText(data)
  }
}