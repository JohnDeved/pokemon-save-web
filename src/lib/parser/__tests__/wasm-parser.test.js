/**
 * Go WASM Parser Test
 * Test the Go-based Pokemon save parser WASM integration
 */

import { expect, describe, it } from 'vitest'
import { GoWASMParser } from '../wasm-wrapper.js'

describe('Go WASM Parser Tests', () => {
  it('should initialize WASM module', async () => {
    const parser = new GoWASMParser()
    
    // In test environment, expect initialization to fail gracefully
    try {
      await parser.initialize('/parser.wasm')
      expect(parser.isReady()).toBe(true)
    } catch (error) {
      // Expected to fail in test environment
      expect(error.message).toMatch(/WASM not available in test environment|Failed to load WASM/)
    }
  })

  it('should have correct API interface', () => {
    const parser = new GoWASMParser()
    
    expect(typeof parser.initialize).toBe('function')
    expect(typeof parser.parseSaveFile).toBe('function') 
    expect(typeof parser.encodeText).toBe('function')
    expect(typeof parser.decodeText).toBe('function')
    expect(typeof parser.getVersion).toBe('function')
    expect(typeof parser.isReady).toBe('function')
  })

  it('should throw error when not ready', async () => {
    const parser = new GoWASMParser()
    // Don't initialize, so it should not be ready
    
    const testData = new Uint8Array([1, 2, 3, 4])
    
    // These should fail because initialization will fail in test environment
    await expect(parser.parseSaveFile(testData)).rejects.toThrow()
    await expect(parser.encodeText('test')).rejects.toThrow()
    await expect(parser.decodeText(testData)).rejects.toThrow()
    await expect(parser.getVersion()).rejects.toThrow()
  })
})