/**
 * Parser Factory
 * Automatically chooses between TypeScript and Go WASM parsers based on availability
 */

import type { UnifiedParserInterface, ParserConfig } from '../unified-parser'
import { ParserType } from '../unified-parser'
import { GoWASMParserAdapter } from './go-wasm-adapter'
import { TypeScriptParserAdapter } from './typescript-adapter'

export class ParserFactory {
  private static instance: ParserFactory | null = null
  private wasmAvailable: boolean | null = null

  private constructor() {}

  static getInstance(): ParserFactory {
    if (!ParserFactory.instance) {
      ParserFactory.instance = new ParserFactory()
    }
    return ParserFactory.instance
  }

  async createParser(config: ParserConfig = { type: ParserType.AUTO }): Promise<UnifiedParserInterface> {
    switch (config.type) {
      case ParserType.TYPESCRIPT:
        return new TypeScriptParserAdapter()

      case ParserType.GO_WASM:
        return new GoWASMParserAdapter(config.wasmPath)

      case ParserType.AUTO:
      default:
        // Try Go WASM first, fallback to TypeScript
        if (await this.isWasmAvailable(config.wasmPath)) {
          console.log('Using Go WASM parser')
          return new GoWASMParserAdapter(config.wasmPath)
        } else {
          console.log('Go WASM not available, using TypeScript parser')
          if (config.fallbackToTypeScript !== false) {
            return new TypeScriptParserAdapter()
          } else {
            throw new Error('Go WASM parser not available and fallback is disabled')
          }
        }
    }
  }

  private async isWasmAvailable(wasmPath?: string): Promise<boolean> {
    if (this.wasmAvailable !== null) {
      return this.wasmAvailable
    }

    try {
      // Check if WebAssembly is supported
      if (typeof WebAssembly === 'undefined') {
        this.wasmAvailable = false
        return false
      }

      // Try to create a Go WASM parser and initialize it
      const adapter = new GoWASMParserAdapter(wasmPath)
      this.wasmAvailable = await adapter.isReady()
      return this.wasmAvailable
    } catch (error) {
      console.warn('Go WASM parser check failed:', error)
      this.wasmAvailable = false
      return false
    }
  }

  // Reset the availability check (useful for testing)
  resetAvailabilityCheck(): void {
    this.wasmAvailable = null
  }
}

// Convenience function for creating a parser
export async function createParser(config?: ParserConfig): Promise<UnifiedParserInterface> {
  const factory = ParserFactory.getInstance()
  return await factory.createParser(config)
}