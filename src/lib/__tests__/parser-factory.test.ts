/**
 * Parser Factory Tests
 * Test the unified parser interface and factory
 */

import { expect, describe, it, beforeEach } from 'vitest'
import { ParserFactory, createParser } from '../adapters/parser-factory'
import { ParserType } from '../unified-parser'

describe('Parser Factory Tests', () => {
  let factory: ParserFactory

  beforeEach(() => {
    factory = ParserFactory.getInstance()
    factory.resetAvailabilityCheck() // Reset for each test
  })

  it('should create a parser factory instance', () => {
    expect(factory).toBeDefined()
    expect(typeof factory.createParser).toBe('function')
  })

  it('should create TypeScript parser when explicitly requested', async () => {
    const parser = await factory.createParser({
      type: ParserType.TYPESCRIPT
    })
    
    expect(parser).toBeDefined()
    expect(typeof parser.parse).toBe('function')
    expect(typeof parser.parseSaveFile).toBe('function')
    expect(typeof parser.reconstructSaveFile).toBe('function')
  })

  it('should handle AUTO type and fallback gracefully', async () => {
    const parser = await factory.createParser({
      type: ParserType.AUTO,
      fallbackToTypeScript: true
    })
    
    expect(parser).toBeDefined()
    expect(typeof parser.parse).toBe('function')
  })

  it('should work with convenience function', async () => {
    const parser = await createParser({
      type: ParserType.TYPESCRIPT
    })
    
    expect(parser).toBeDefined()
    expect(typeof parser.parse).toBe('function')
  })

  it('should default to AUTO when no config provided', async () => {
    const parser = await createParser()
    
    expect(parser).toBeDefined()
    expect(typeof parser.parse).toBe('function')
  })
})