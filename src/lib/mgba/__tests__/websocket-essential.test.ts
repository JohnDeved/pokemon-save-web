/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/**
 * Essential WebSocket tests that run only when mGBA server is available
 * These tests verify core functionality but skip gracefully in CI
 */

import { describe, it, expect } from 'vitest'
import { MgbaWebSocketClient } from '../websocket-client'

const WEBSOCKET_URL = 'ws://localhost:7102'

/**
 * Quick check if mGBA WebSocket server is available
 */
async function isServerAvailable (): Promise<boolean> {
  try {
    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    await client.connect()
    client.disconnect()
    return true
  } catch {
    return false
  }
}

describe('WebSocket Essential Tests', () => {
  it('should connect to mGBA WebSocket server when available', async () => {
    const serverAvailable = await isServerAvailable()
    if (!serverAvailable) {
      console.log('⏭️  Skipping WebSocket connection test - mGBA server not available')
      return
    }

    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    await expect(client.connect()).resolves.not.toThrow()
    expect(() => client.disconnect()).not.toThrow()
  })

  it('should perform basic eval operations when server is available', async () => {
    const serverAvailable = await isServerAvailable()
    if (!serverAvailable) {
      console.log('⏭️  Skipping eval test - mGBA server not available')
      return
    }

    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    await client.connect()

    try {
      const result = await client.eval('return 42')
      expect(result.result).toBe(42)
    } finally {
      client.disconnect()
    }
  })

  it('should handle memory reading when server is available', async () => {
    const serverAvailable = await isServerAvailable()
    if (!serverAvailable) {
      console.log('⏭️  Skipping memory read test - mGBA server not available')
      return
    }

    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    await client.connect()

    try {
      const data = await client.getSharedBuffer(0x08000000, 4)
      expect(data).toBeInstanceOf(Uint8Array)
      expect(data.length).toBe(4)
    } finally {
      client.disconnect()
    }
  })

  it('should set up memory watching when server is available', async () => {
    const serverAvailable = await isServerAvailable()
    if (!serverAvailable) {
      console.log('⏭️  Skipping memory watching test - mGBA server not available')
      return
    }

    const client = new MgbaWebSocketClient(WEBSOCKET_URL)
    await client.connect()

    try {
      client.configureSharedBuffer({
        preloadRegions: [
          { address: 0x20244e9, size: 7 },
        ],
      })

      await expect(client.startWatchingPreloadRegions()).resolves.not.toThrow()
      expect(client.isWatchingMemory()).toBe(true)
    } finally {
      client.disconnect()
    }
  })
})
