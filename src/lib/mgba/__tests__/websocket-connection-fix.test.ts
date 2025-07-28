/**
 * Basic WebSocket connection test
 * Tests just the WebSocket connection fix without complex integration
 */

import { describe, it, expect } from 'vitest'
import { MgbaWebSocketClient } from '../websocket-client.js'

describe('WebSocket Client Connection Fix', () => {
  it('should create client without constructor errors', () => {
    // This test verifies the "WebSocket.client is not a constructor" fix
    expect(() => new MgbaWebSocketClient('ws://localhost:7102')).not.toThrow()
    console.log('✅ WebSocket client constructor working correctly')
  })

  it('should handle connection failure gracefully', async () => {
    const client = new MgbaWebSocketClient('ws://localhost:9999') // Non-existent server
    
    // Should reject with connection error, not constructor error
    await expect(client.connect()).rejects.toThrow()
    
    // Should be able to check connection status
    expect(client.isConnected()).toBe(false)
    expect(client.isEvalConnected()).toBe(false) 
    expect(client.isWatchConnected()).toBe(false)
    
    console.log('✅ Connection error handling working correctly')
  })

  it('should set up memory change listeners without errors', () => {
    const client = new MgbaWebSocketClient('ws://localhost:7102')
    
    const listener = (address: number, size: number, data: Uint8Array) => {
      console.log(`Memory change: 0x${address.toString(16)}`)
    }
    
    expect(() => client.addMemoryChangeListener(listener)).not.toThrow()
    expect(() => client.removeMemoryChangeListener(listener)).not.toThrow()
    
    console.log('✅ Memory listener system working correctly')
  })

  it('should configure shared buffer without errors', () => {
    const client = new MgbaWebSocketClient('ws://localhost:7102')
    
    expect(() => {
      client.configureSharedBuffer({
        maxCacheSize: 50,
        cacheTimeout: 100,
        preloadRegions: [
          { address: 0x20244e9, size: 7 },
          { address: 0x20244ec, size: 600 }
        ]
      })
    }).not.toThrow()
    
    console.log('✅ Shared buffer configuration working correctly')
  })
})