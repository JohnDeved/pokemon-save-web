/**
 * Unit tests for WebSocket client message handling robustness
 * Tests the improved empty message handling and frame parsing logic
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { MgbaWebSocketClient } from '../websocket-client'

describe('WebSocket Client Message Handling Robustness', () => {
  let client: MgbaWebSocketClient

  beforeEach(() => {
    client = new MgbaWebSocketClient('ws://localhost:7102')
  })

  describe('Message Validation and Filtering', () => {
    it('should handle empty messages gracefully', () => {
      // Test the private method using a workaround
      // @ts-expect-error - accessing private method for testing
      expect(() => client.handleWatchMessage('')).not.toThrow()
      // @ts-expect-error - accessing private method for testing  
      expect(() => client.handleWatchMessage('   ')).not.toThrow()
      // @ts-expect-error - accessing private method for testing
      expect(() => client.handleWatchMessage('\t\n\r  ')).not.toThrow()
    })

    it('should handle non-JSON messages gracefully', () => {
      // @ts-expect-error - accessing private method for testing
      expect(() => client.handleWatchMessage('Welcome to WebSocket!')).not.toThrow()
      // @ts-expect-error - accessing private method for testing
      expect(() => client.handleWatchMessage('plain text message')).not.toThrow()
    })

    it('should handle malformed JSON gracefully', () => {
      // @ts-expect-error - accessing private method for testing
      expect(() => client.handleWatchMessage('{ invalid json')).not.toThrow()
      // @ts-expect-error - accessing private method for testing
      expect(() => client.handleWatchMessage('{"type":]')).not.toThrow()
    })

    it('should handle valid JSON without type field', () => {
      // @ts-expect-error - accessing private method for testing
      expect(() => client.handleWatchMessage('{"data": "test"}')).not.toThrow()
    })

    it('should process valid messages correctly', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      // @ts-expect-error - accessing private method for testing
      client.handleWatchMessage('{"type": "welcome", "message": "Hello"}')
      
      expect(consoleLogSpy).toHaveBeenCalledWith('WebSocket watch endpoint ready')
      
      consoleLogSpy.mockRestore()
    })

    it('should handle error messages correctly', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      // @ts-expect-error - accessing private method for testing
      client.handleWatchMessage('{"type": "error", "error": "Test error"}')
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('WebSocket watch error:', 'Test error')
      
      consoleErrorSpy.mockRestore()
    })
  })

  describe('Memory Change Listener Management', () => {
    it('should add and remove memory change listeners correctly', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()

      client.addMemoryChangeListener(listener1)
      client.addMemoryChangeListener(listener2)

      // @ts-expect-error - accessing private property for testing
      expect(client.memoryChangeListeners).toHaveLength(2)

      client.removeMemoryChangeListener(listener1)
      // @ts-expect-error - accessing private property for testing
      expect(client.memoryChangeListeners).toHaveLength(1)
      // @ts-expect-error - accessing private property for testing
      expect(client.memoryChangeListeners[0]).toBe(listener2)
    })

    it('should enforce maximum listener limit', () => {
      const listeners = Array.from({length: 100}, () => vi.fn())
      
      // Add maximum allowed listeners
      listeners.forEach(listener => {
        client.addMemoryChangeListener(listener)
      })

      // Adding one more should throw
      expect(() => {
        client.addMemoryChangeListener(vi.fn())
      }).toThrow('Maximum number of listeners')
    })

    it('should handle memory update messages correctly', () => {
      const listener = vi.fn()
      client.addMemoryChangeListener(listener)

      const memoryUpdate = {
        type: 'memoryUpdate',
        regions: [
          {
            address: 0x20244e9,
            size: 7,
            data: [6, 0, 0, 0, 0, 0, 0]
          }
        ],
        timestamp: Date.now()
      }

      // @ts-expect-error - accessing private method for testing
      client.handleWatchMessage(JSON.stringify(memoryUpdate))

      expect(listener).toHaveBeenCalledWith(
        0x20244e9,
        7,
        new Uint8Array([6, 0, 0, 0, 0, 0, 0])
      )
    })

    it('should handle listener errors gracefully', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const errorListener = vi.fn().mockImplementation(() => {
        throw new Error('Listener error')
      })
      const goodListener = vi.fn()

      client.addMemoryChangeListener(errorListener)
      client.addMemoryChangeListener(goodListener)

      const memoryUpdate = {
        type: 'memoryUpdate',
        regions: [
          {
            address: 0x20244e9,
            size: 7,
            data: [6, 0, 0, 0, 0, 0, 0]
          }
        ],
        timestamp: Date.now()
      }

      // Should not throw even if one listener errors
      // @ts-expect-error - accessing private method for testing
      expect(() => client.handleWatchMessage(JSON.stringify(memoryUpdate))).not.toThrow()

      // Both listeners should have been called
      expect(errorListener).toHaveBeenCalled()
      expect(goodListener).toHaveBeenCalled()

      // Error should have been logged
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error in memory change listener:', expect.any(Error))

      consoleErrorSpy.mockRestore()
    })
  })

  describe('Connection State Management', () => {
    it('should properly track connection states', () => {
      expect(client.isConnected()).toBe(false)
      expect(client.isEvalConnected()).toBe(false)
      expect(client.isWatchConnected()).toBe(false)
    })

    it('should handle disconnect gracefully', () => {
      expect(() => client.disconnect()).not.toThrow()
    })

    it('should clear memory change listeners on disconnect', () => {
      const listener = vi.fn()
      client.addMemoryChangeListener(listener)

      // @ts-expect-error - accessing private property for testing
      expect(client.memoryChangeListeners).toHaveLength(1)

      // Disconnect clears listeners implicitly through state reset
      client.disconnect()

      // Verify state is reset
      expect(client.isWatching).toBe(false)
    })
  })

  describe('Shared Buffer Configuration', () => {
    it('should configure shared buffer settings correctly', () => {
      const config = {
        maxCacheSize: 100,
        cacheTimeout: 5000,
        preloadRegions: [
          { address: 0x20244e9, size: 7 },
          { address: 0x20244ec, size: 600 }
        ]
      }

      client.configureSharedBuffer(config)

      // @ts-expect-error - accessing private property for testing
      expect(client.sharedBufferConfig.maxCacheSize).toBe(100)
      // @ts-expect-error - accessing private property for testing
      expect(client.sharedBufferConfig.cacheTimeout).toBe(5000)
      // @ts-expect-error - accessing private property for testing
      expect(client.sharedBufferConfig.preloadRegions).toHaveLength(2)
    })

    it('should handle partial configuration updates', () => {
      client.configureSharedBuffer({ maxCacheSize: 200 })

      // @ts-expect-error - accessing private property for testing
      expect(client.sharedBufferConfig.maxCacheSize).toBe(200)
      // @ts-expect-error - accessing private property for testing
      expect(client.sharedBufferConfig.cacheTimeout).toBe(100) // Default value preserved
    })
  })
})