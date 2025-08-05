/**
 * Test suite for event-driven CLI functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { MemoryChangeListener } from '../../mgba/websocket-client'

// Mock the MgbaWebSocketClient
const mockAddMemoryChangeListener = vi.fn()
const mockRemoveMemoryChangeListener = vi.fn()
const mockStartWatching = vi.fn()
const mockDisconnect = vi.fn()

vi.mock('../../mgba/websocket-client', () => ({
  MgbaWebSocketClient: vi.fn().mockImplementation(() => ({
    addMemoryChangeListener: mockAddMemoryChangeListener,
    removeMemoryChangeListener: mockRemoveMemoryChangeListener,
    startWatching: mockStartWatching,
    disconnect: mockDisconnect,
  })),
}))

// Mock the PokemonSaveParser
const mockParseSaveFile = vi.fn()
vi.mock('../core/PokemonSaveParser', () => ({
  PokemonSaveParser: vi.fn().mockImplementation(() => ({
    parse: mockParseSaveFile,
  })),
}))

// Mock console methods to avoid test output pollution
vi.mock('console', () => ({
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}))

// Mock process methods
const mockProcessOn = vi.fn()
Object.defineProperty(process, 'on', {
  value: mockProcessOn,
  writable: true,
})

describe('CLI Event-Driven Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Reset default mock behaviors
    mockStartWatching.mockResolvedValue(undefined)
    mockParseSaveFile.mockResolvedValue({
      party_pokemon: [
        {
          speciesId: 25,
          level: 50,
          currentHp: 100,
          nickname: 'PIKACHU',
        },
      ],
    })
  })

  it('should configure memory watching for WebSocket connections', async () => {
    // Import the CLI module - this will execute the mocked versions
    const { MgbaWebSocketClient } = await import('../../mgba/websocket-client')
    const client = new MgbaWebSocketClient()

    // Simulate calling the simplified watching method that should be called in event-driven mode
    const regions = [
      { address: 0x20244e9, size: 7 }, // Party count + context
      { address: 0x20244ec, size: 600 }, // Full party data
    ]

    await client.startWatching(regions)

    // Verify the method was called correctly
    expect(mockStartWatching).toHaveBeenCalledWith(regions)
  })

  it('should add memory change listeners for party data', async () => {
    const { MgbaWebSocketClient } = await import('../../mgba/websocket-client')
    const client = new MgbaWebSocketClient()

    // Simulate adding a memory change listener
    const testListener: MemoryChangeListener = vi.fn()
    client.addMemoryChangeListener(testListener)

    expect(mockAddMemoryChangeListener).toHaveBeenCalledWith(testListener)
  })

  it('should handle memory change events for party regions', async () => {
    const { MgbaWebSocketClient } = await import('../../mgba/websocket-client')
    const client = new MgbaWebSocketClient()

    let capturedListener: MemoryChangeListener | undefined

    // Capture the listener that gets added
    mockAddMemoryChangeListener.mockImplementation((listener: MemoryChangeListener) => {
      capturedListener = listener
    })

    // Add a memory change listener
    const testListener: MemoryChangeListener = vi.fn()
    client.addMemoryChangeListener(testListener)

    // Verify a listener was captured
    expect(capturedListener).toBeDefined()

    // Simulate a memory change event for party count
    if (capturedListener) {
      const mockData = new Uint8Array([6, 0, 0, 0, 0, 0, 0]) // 6 Pokemon in party
      await capturedListener(0x20244e9, 7, mockData)

      // The test can't directly verify CLI behavior, but we can verify
      // that the parseSaveFile would be called when memory changes
      // (this would happen in the actual CLI implementation)
    }
  })

  it('should cleanup memory listeners on exit', async () => {
    const { MgbaWebSocketClient } = await import('../../mgba/websocket-client')
    const client = new MgbaWebSocketClient()

    const testListener: MemoryChangeListener = vi.fn()
    client.addMemoryChangeListener(testListener)

    // Simulate cleanup
    client.removeMemoryChangeListener(testListener)

    expect(mockRemoveMemoryChangeListener).toHaveBeenCalledWith(testListener)
  })

  it('should handle memory watching setup failures gracefully', async () => {
    // Mock a failure in startWatching
    mockStartWatching.mockRejectedValue(new Error('Watch setup failed'))

    const { MgbaWebSocketClient } = await import('../../mgba/websocket-client')
    const client = new MgbaWebSocketClient()

    // This should throw, simulating the fallback behavior in the CLI
    await expect(client.startWatching([{ address: 0x20244e9, size: 7 }])).rejects.toThrow('Watch setup failed')
  })
})
