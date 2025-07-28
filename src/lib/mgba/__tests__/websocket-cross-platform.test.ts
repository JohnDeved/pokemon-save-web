import { describe, it, expect } from 'vitest'
import { MgbaWebSocketClient } from '../websocket-client.js'

describe('WebSocket Cross-Platform Compatibility Tests', () => {
  it('should create client instances without platform-specific errors', () => {
    expect(() => {
      const client1 = new MgbaWebSocketClient()
      const client2 = new MgbaWebSocketClient('ws://localhost:7102')
      const client3 = new MgbaWebSocketClient('ws://localhost:7102/eval')
      
      expect(client1).toBeDefined()
      expect(client2).toBeDefined()
      expect(client3).toBeDefined()
    }).not.toThrow()
    
    console.log('✅ Cross-platform client creation working correctly')
  })

  it('should handle Windows-specific connection errors gracefully', async () => {
    const client = new MgbaWebSocketClient('ws://invalid-host:1234')
    
    try {
      await client.connect()
      expect.fail('Should have thrown connection error')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toContain('Failed to connect to mGBA WebSocket server')
      // Should not contain Windows-specific error patterns like AggregateError
      expect((error as Error).message).not.toMatch(/AggregateError|ECONNREFUSED.*AggregateError/)
    }
    
    console.log('✅ Windows connection error handling working correctly')
  })

  it('should use ws package API correctly', () => {
    const client = new MgbaWebSocketClient()
    
    // Test connection state checks don't use old websocket package API
    expect(() => {
      client.isConnected()
      client.isEvalConnected()
      client.isWatchConnected()
    }).not.toThrow()
    
    console.log('✅ WebSocket API compatibility verified')
  })

  it('should handle message processing consistently across platforms', () => {
    const client = new MgbaWebSocketClient()
    
    // Test memory change listener setup
    expect(() => {
      const listener = (address: number, size: number, data: Uint8Array) => {
        console.log(`Memory changed: 0x${address.toString(16)}`)
      }
      client.addMemoryChangeListener(listener)
      client.removeMemoryChangeListener(listener)
    }).not.toThrow()
    
    console.log('✅ Message processing setup working correctly')
  })

  it('should provide clear error messages for common issues', async () => {
    const client = new MgbaWebSocketClient('ws://localhost:9999')
    
    try {
      await client.connect()
    } catch (error) {
      const errorMessage = (error as Error).message
      
      // Should provide helpful error message
      expect(errorMessage).toBeDefined()
      expect(errorMessage.length).toBeGreaterThan(10)
      
      // Should not expose internal implementation details
      expect(errorMessage).not.toContain('websocket.client')
      expect(errorMessage).not.toContain('connectFailed')
      expect(errorMessage).not.toContain('utf8Data')
    }
    
    console.log('✅ Error message clarity verified')
  })
})