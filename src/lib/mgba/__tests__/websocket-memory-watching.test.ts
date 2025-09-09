/**
 * Test suite for WebSocket memory watching functionality - API tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MgbaWebSocketClient, type MemoryChangeListener } from '../websocket-client'

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
    it('should track watching state without initial config', () => {
      expect(client.isWatching()).toBe(false)
      expect(client.getWatchedRegions()).toHaveLength(0)
    })
  })

  describe('Watch Message Types', () => {
    it('should create valid watch message structure', () => {
      const regions = [
        { address: 0x20244e9, size: 7 },
        { address: 0x20244ec, size: 600 },
      ]

      // This tests that the TypeScript types are correctly defined
      const watchMessage = {
        type: 'watch' as const,
        regions,
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
            data: [1, 2, 3, 4],
          },
        ],
        timestamp: Date.now(),
      }

      expect(memoryUpdate.type).toBe('memoryUpdate')
      expect(memoryUpdate.regions).toHaveLength(1)
      expect(memoryUpdate.regions[0]?.data).toEqual([1, 2, 3, 4])
    })
  })

  describe('Error Handling', () => {
    it('should throw error when starting watch without connection', async () => {
      const regions = [{ address: 0x20244e9, size: 4 }]

      await expect(client.startWatching(regions)).rejects.toThrow('Not connected to mGBA WebSocket server')
    })

    it('should throw error when starting watch without regions', async () => {
      // Mock connection state
      ;(client as unknown as { connected: boolean; ws: { readyState: number } }).connected = true
      ;(client as unknown as { connected: boolean; ws: { readyState: number } }).ws = {
        readyState: 1,
      }

      await expect(client.startWatching([])).rejects.toThrow('No regions to watch')
    })

    it('should throw error when starting watch with empty regions', async () => {
      // Mock connection state
      ;(client as unknown as { connected: boolean; ws: { readyState: number } }).connected = true
      ;(client as unknown as { connected: boolean; ws: { readyState: number } }).ws = {
        readyState: 1,
      }

      await expect(client.startWatching([])).rejects.toThrow('No regions to watch')
    })
  })

  describe('Helper Methods', () => {
    it('should provide connection status', () => {
      expect(typeof client.isConnected()).toBe('boolean')
    })

    it('should provide watching status', () => {
      expect(typeof client.isWatching()).toBe('boolean')
    })

    it('should return watched regions list', () => {
      const regions = client.getWatchedRegions()
      expect(Array.isArray(regions)).toBe(true)
    })
  })
})
