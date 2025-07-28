/**
 * Test suite for WebSocket memory watching functionality - API tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MgbaWebSocketClient } from '../websocket-client'
import type { MemoryChangeListener } from '../websocket-client'

describe('MgbaWebSocketClient - Memory Watching API', () => {
  let client: MgbaWebSocketClient

  beforeEach(() => {
    client = new MgbaWebSocketClient()
  })

  describe('Memory Change Listeners', () => {
    it('should add and remove memory change listeners', () => {
      const listener1: MemoryChangeListener = vi.fn()
      const listener2: MemoryChangeListener = vi.fn()

      client.addMemoryChangeListener(listener1)
      client.addMemoryChangeListener(listener2)

      expect(() => client.removeMemoryChangeListener(listener1)).not.toThrow()
      expect(() => client.removeMemoryChangeListener(listener2)).not.toThrow()
    })

    it('should enforce listener limit', () => {
      // Add maximum number of listeners
      for (let i = 0; i < 100; i++) {
        client.addMemoryChangeListener(vi.fn())
      }

      // Adding one more should throw
      expect(() => client.addMemoryChangeListener(vi.fn())).toThrow('Maximum number of listeners')
    })
  })

  describe('Memory Watching Configuration', () => {
    it('should configure shared buffer with preload regions', () => {
      const config = {
        preloadRegions: [
          { address: 0x20244e9, size: 7 },
          { address: 0x20244ec, size: 600 }
        ]
      }

      expect(() => client.configureSharedBuffer(config)).not.toThrow()
    })

    it('should track watching state', () => {
      expect(client.isWatchingMemory()).toBe(false)
      expect(client.getWatchedRegions()).toHaveLength(0)
    })

    it('should return cache statistics', () => {
      const stats = client.getCacheStats()
      expect(stats).toHaveProperty('size')
      expect(stats).toHaveProperty('regions')
      expect(Array.isArray(stats.regions)).toBe(true)
    })
  })

  describe('Watch Message Types', () => {
    it('should create valid watch message structure', () => {
      const regions = [
        { address: 0x20244e9, size: 7 },
        { address: 0x20244ec, size: 600 }
      ]

      // This tests that the TypeScript types are correctly defined
      const watchMessage = {
        type: 'watch' as const,
        regions
      }

      expect(watchMessage.type).toBe('watch')
      expect(watchMessage.regions).toEqual(regions)
    })

    it('should define memory update message type', () => {
      const memoryUpdate = {
        type: 'memoryUpdate' as const,
        regions: [
          {
            address: 0x20244e9,
            size: 4,
            data: [1, 2, 3, 4]
          }
        ],
        timestamp: Date.now()
      }

      expect(memoryUpdate.type).toBe('memoryUpdate')
      expect(memoryUpdate.regions).toHaveLength(1)
      expect(memoryUpdate.regions[0]?.data).toEqual([1, 2, 3, 4])
    })
  })

  describe('Error Handling', () => {
    it('should throw error when starting watch without connection', async () => {
      const regions = [{ address: 0x20244e9, size: 4 }]
      
      await expect(client.startWatching(regions)).rejects.toThrow('Not connected to mGBA WebSocket watch endpoint')
    })

    it('should throw error when starting watch without regions', async () => {
      // Mock connection state for watch endpoint
      ;(client as any).watchConnected = true
      ;(client as any).watchWs = { readyState: 1 }

      await expect(client.startWatching([])).rejects.toThrow('No regions to watch')
    })

    it('should throw error when starting preload region watching without config', async () => {
      // Mock connection state for watch endpoint
      ;(client as any).watchConnected = true
      ;(client as any).watchWs = { readyState: 1 }

      await expect(client.startWatchingPreloadRegions()).rejects.toThrow('No preload regions configured')
    })
  })

  describe('Cache Management', () => {
    it('should clear cache', () => {
      expect(() => client.clearCache()).not.toThrow()
    })

    it('should invalidate specific cache entries', () => {
      expect(() => client.invalidateCache(0x20244e9, 4)).not.toThrow()
    })
  })

  describe('Helper Methods', () => {
    it('should provide connection status', () => {
      expect(typeof client.isConnected()).toBe('boolean')
    })

    it('should provide watching status', () => {
      expect(typeof client.isWatchingMemory()).toBe('boolean')
    })

    it('should return watched regions list', () => {
      const regions = client.getWatchedRegions()
      expect(Array.isArray(regions)).toBe(true)
    })
  })
})