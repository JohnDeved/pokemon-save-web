/**
 * Test Hybrid Pokemon Save Parser
 */
import { PokemonSaveParser } from '../core/HybridPokemonSaveParser'

describe('Hybrid Pokemon Save Parser', () => {
  test('should create parser instance', () => {
    const parser = new PokemonSaveParser()
    expect(parser).toBeDefined()
    expect(typeof parser.parse).toBe('function')
  })

  test('should report backend information', () => {
    const parser = new PokemonSaveParser()
    const info = parser.getBackendInfo()
    
    expect(info).toHaveProperty('backend')
    expect(info).toHaveProperty('wasmAvailable')
    expect(info.backend).toBe('typescript') // Should fallback to TypeScript initially
    expect(typeof info.wasmAvailable).toBe('boolean')
  })

  test('should have all expected methods', () => {
    const parser = new PokemonSaveParser()
    
    // Check that all methods exist
    expect(typeof parser.loadInputData).toBe('function')
    expect(typeof parser.parse).toBe('function')
    expect(typeof parser.getGameConfig).toBe('function')
    expect(typeof parser.setGameConfig).toBe('function')
    expect(typeof parser.reconstructSaveFile).toBe('function')
    expect(typeof parser.isInMemoryMode).toBe('function')
    expect(typeof parser.getWebSocketClient).toBe('function')
    expect(typeof parser.watch).toBe('function')
    expect(typeof parser.stopWatching).toBe('function')
    expect(typeof parser.isWatching).toBe('function')
    expect(typeof parser.getCurrentSaveData).toBe('function')
  })

  test('should handle game config operations', () => {
    const parser = new PokemonSaveParser()
    
    // Initially no config
    expect(parser.getGameConfig()).toBeNull()
    expect(parser.gameConfig).toBeNull()
    
    // Mock config for testing
    const mockConfig = {
      name: 'Test Config',
      pokemonSize: 100,
      maxPartySize: 6,
      saveLayout: {
        sectorSize: 4096,
        sectorDataSize: 3968,
        sectorCount: 32,
        slotsPerSave: 18,
        saveBlockSize: 3968 * 4,
        partyOffset: 0x238,
        partyCountOffset: 0x234,
        playTimeHours: 0x0E,
        playTimeMinutes: 0x10,
        playTimeSeconds: 0x11,
        playTimeMilliseconds: 0x12,
      },
      canHandle: () => true
    } as any
    
    parser.setGameConfig(mockConfig)
    expect(parser.getGameConfig()).toBe(mockConfig)
    expect(parser.gameConfig).toBe(mockConfig)
  })

  test('should not be in memory mode initially', () => {
    const parser = new PokemonSaveParser()
    expect(parser.isInMemoryMode()).toBe(false)
    expect(parser.isWatching()).toBe(false)
    expect(parser.getWebSocketClient()).toBeNull()
  })
})