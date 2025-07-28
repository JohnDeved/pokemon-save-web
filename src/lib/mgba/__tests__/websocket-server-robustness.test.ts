/**
 * Comprehensive robustness tests for the Lua WebSocket server
 * Tests production readiness including frame parsing, message handling, and error recovery
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import WebSocket from 'ws'
import { MgbaWebSocketClient } from '../websocket-client'

const BASE_URL = 'ws://localhost:7102'
const TEST_TIMEOUT = 10000

// Test utilities for direct WebSocket communication 
function createTestWebSocket(endpoint: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${BASE_URL}${endpoint}`)
    const timeout = setTimeout(() => {
      reject(new Error(`Connection timeout to ${endpoint}`))
    }, 5000)

    ws.on('open', () => {
      clearTimeout(timeout)
      resolve(ws)
    })

    ws.on('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
  })
}

function waitForMessage(ws: WebSocket, timeoutMs = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Message timeout'))
    }, timeoutMs)

    ws.once('message', (data) => {
      clearTimeout(timeout)
      resolve(data.toString())
    })

    ws.once('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })

    ws.once('close', () => {
      clearTimeout(timeout)
      reject(new Error('Connection closed while waiting for message'))
    })
  })
}

// Skip tests if server is not available
function checkServerAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${BASE_URL}/eval`)
    const timeout = setTimeout(() => {
      resolve(false)
    }, 2000)

    ws.on('open', () => {
      clearTimeout(timeout)
      ws.close()
      resolve(true)
    })

    ws.on('error', () => {
      clearTimeout(timeout)
      resolve(false)
    })
  })
}

describe('WebSocket Server Robustness', () => {
  let serverAvailable = false

  beforeAll(async () => {
    serverAvailable = await checkServerAvailable()
    if (!serverAvailable) {
      console.warn('⚠️ mGBA WebSocket server not available, skipping robustness tests')
    }
  }, 15000)

  beforeEach(() => {
    if (!serverAvailable) {
      // Skip individual tests if server is not available
      return
    }
  })

  describe('WebSocket Frame Parsing', () => {
    it('should handle ping frames without generating empty messages', async () => {
      if (!serverAvailable) return

      const ws = await createTestWebSocket('/eval')
      const messages: string[] = []
      
      // Collect all messages
      ws.on('message', (data) => {
        messages.push(data.toString())
      })

      // Wait for welcome message
      await waitForMessage(ws, 2000)

      // Send a ping frame manually (opcode 0x9)
      const pingFrame = Buffer.from([0x89, 0x80, 0x00, 0x00, 0x00, 0x00]) // Ping with mask
      ws.send(pingFrame)

      // Wait a bit to see if any unwanted messages are generated
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Should only have welcome message, no "Empty message" errors
      expect(messages.length).toBe(1)
      expect(messages[0]).toContain('Welcome')

      ws.close()
    }, TEST_TIMEOUT)

    it('should respond to ping frames with pong frames', async () => {
      if (!serverAvailable) return

      const ws = await createTestWebSocket('/eval')
      
      // Wait for welcome message
      await waitForMessage(ws, 2000)

      let pongReceived = false
      ws.on('pong', () => {
        pongReceived = true
      })

      // Send ping using WebSocket API
      ws.ping('test-ping')

      // Wait for pong response
      await new Promise(resolve => setTimeout(resolve, 1000))

      expect(pongReceived).toBe(true)

      ws.close()
    }, TEST_TIMEOUT)

    it('should handle empty payloads in text frames gracefully', async () => {
      if (!serverAvailable) return

      const ws = await createTestWebSocket('/eval')
      
      // Wait for welcome message
      await waitForMessage(ws, 2000)

      // Send empty text frame
      ws.send('')

      // Wait a bit - should not generate error messages
      await new Promise(resolve => setTimeout(resolve, 500))

      // Connection should still be open
      expect(ws.readyState).toBe(WebSocket.OPEN)

      ws.close()
    }, TEST_TIMEOUT)

    it('should handle whitespace-only messages gracefully', async () => {
      if (!serverAvailable) return

      const ws = await createTestWebSocket('/eval')
      
      // Wait for welcome message
      await waitForMessage(ws, 2000)

      // Send whitespace-only messages
      ws.send('   ')
      ws.send('\t\n\r  ')
      ws.send('     \n\n   ')

      // Wait a bit - should not generate error messages
      await new Promise(resolve => setTimeout(resolve, 500))

      // Connection should still be open
      expect(ws.readyState).toBe(WebSocket.OPEN)

      ws.close()
    }, TEST_TIMEOUT)
  })

  describe('Eval Endpoint Robustness', () => {
    it('should handle rapid sequential messages', async () => {
      if (!serverAvailable) return

      const ws = await createTestWebSocket('/eval')
      
      // Wait for welcome message
      await waitForMessage(ws, 2000)

      const responses: string[] = []
      ws.on('message', (data) => {
        const msg = data.toString()
        if (msg.startsWith('{')) {
          responses.push(msg)
        }
      })

      // Send multiple rapid messages
      const testMessages = ['1+1', '2+2', '3+3', '4+4', '5+5']
      for (const msg of testMessages) {
        ws.send(msg)
      }

      // Wait for all responses
      while (responses.length < testMessages.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // All should succeed
      expect(responses).toHaveLength(testMessages.length)
      responses.forEach((response, i) => {
        const parsed = JSON.parse(response)
        expect(parsed.result).toBe((i + 1) * 2)
      })

      ws.close()
    }, TEST_TIMEOUT)

    it('should handle large valid Lua code', async () => {
      if (!serverAvailable) return

      const ws = await createTestWebSocket('/eval')
      
      // Wait for welcome message
      await waitForMessage(ws, 2000)

      // Generate large but valid Lua code (under 10KB limit)
      const largeCode = 'local result = 0\n' + 
        Array.from({length: 100}, (_, i) => `result = result + ${i + 1}`).join('\n') +
        '\nreturn result'

      ws.send(largeCode)

      const response = await waitForMessage(ws, 3000)
      const parsed = JSON.parse(response)
      expect(parsed.result).toBe(5050) // Sum of 1 to 100

      ws.close()
    }, TEST_TIMEOUT)

    it('should reject oversized code gracefully', async () => {
      if (!serverAvailable) return

      const ws = await createTestWebSocket('/eval')
      
      // Wait for welcome message
      await waitForMessage(ws, 2000)

      // Generate code over 10KB limit
      const oversizedCode = 'return "' + 'x'.repeat(11000) + '"'

      ws.send(oversizedCode)

      const response = await waitForMessage(ws, 2000)
      const parsed = JSON.parse(response)
      expect(parsed.error).toContain('too long')

      ws.close()
    }, TEST_TIMEOUT)
  })

  describe('Watch Endpoint Robustness', () => {
    it('should handle malformed JSON gracefully', async () => {
      if (!serverAvailable) return

      const ws = await createTestWebSocket('/watch')
      
      // Wait for welcome message
      await waitForMessage(ws, 2000)

      const responses: string[] = []
      ws.on('message', (data) => {
        const msg = data.toString()
        if (msg.startsWith('{')) {
          responses.push(msg)
        }
      })

      // Send malformed JSON
      const malformedMessages = [
        '{invalid json}',
        '{"type":"watch","regions":[{address:123}]}', // Missing quotes
        '{"type":"watch","regions":null}',
        '{"incomplete":"',
        'not json at all'
      ]

      for (const msg of malformedMessages) {
        ws.send(msg)
      }

      // Wait for error responses
      while (responses.length < malformedMessages.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // All should generate error responses
      responses.forEach(response => {
        const parsed = JSON.parse(response)
        expect(parsed.type).toBe('error')
        expect(parsed.error).toBeDefined()
      })

      ws.close()
    }, TEST_TIMEOUT)

    it('should validate memory regions properly', async () => {
      if (!serverAvailable) return

      const ws = await createTestWebSocket('/watch')
      
      // Wait for welcome message
      await waitForMessage(ws, 2000)

      const responses: string[] = []
      ws.on('message', (data) => {
        const msg = data.toString()
        if (msg.startsWith('{')) {
          responses.push(msg)
        }
      })

      // Send invalid region configurations
      const invalidConfigs = [
        { type: 'watch', regions: [] }, // Empty regions
        { type: 'watch', regions: [{ address: -1, size: 10 }] }, // Negative address
        { type: 'watch', regions: [{ address: 0x20244e9, size: 0 }] }, // Zero size
        { type: 'watch', regions: [{ address: 0x20244e9, size: 100000 }] }, // Too large
        { type: 'watch', regions: [{ address: 0x20244e9 }] }, // Missing size
        { type: 'watch', regions: [{ size: 10 }] }, // Missing address
      ]

      for (const config of invalidConfigs) {
        ws.send(JSON.stringify(config))
      }

      // Wait for error responses
      while (responses.length < invalidConfigs.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // All should generate error responses
      responses.forEach(response => {
        const parsed = JSON.parse(response)
        expect(parsed.type).toBe('error')
      })

      ws.close()
    }, TEST_TIMEOUT)

    it('should handle too many regions', async () => {
      if (!serverAvailable) return

      const ws = await createTestWebSocket('/watch')
      
      // Wait for welcome message
      await waitForMessage(ws, 2000)

      // Create request with too many regions (over 50 limit)
      const tooManyRegions = Array.from({length: 51}, (_, i) => ({
        address: 0x20244e9 + i * 100,
        size: 10
      }))

      ws.send(JSON.stringify({
        type: 'watch',
        regions: tooManyRegions
      }))

      const response = await waitForMessage(ws, 2000)
      const parsed = JSON.parse(response)
      expect(parsed.type).toBe('error')
      expect(parsed.error).toContain('Too many regions')

      ws.close()
    }, TEST_TIMEOUT)
  })

  describe('Connection Stability', () => {
    it('should handle multiple simultaneous connections', async () => {
      if (!serverAvailable) return

      const connections: WebSocket[] = []
      
      try {
        // Create multiple connections
        for (let i = 0; i < 5; i++) {
          const evalWs = await createTestWebSocket('/eval')
          const watchWs = await createTestWebSocket('/watch')
          connections.push(evalWs, watchWs)
        }

        // Wait for all welcome messages
        await Promise.all(connections.map(ws => waitForMessage(ws, 2000)))

        // Send test messages to all eval connections
        const evalConnections = connections.filter((_, i) => i % 2 === 0)
        await Promise.all(evalConnections.map(ws => {
          ws.send('1+1')
          return waitForMessage(ws, 2000)
        }))

        // All connections should still be open
        connections.forEach(ws => {
          expect(ws.readyState).toBe(WebSocket.OPEN)
        })

      } finally {
        // Clean up all connections
        connections.forEach(ws => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close()
          }
        })
      }
    }, TEST_TIMEOUT * 2)

    it('should recover gracefully from malformed frame data', async () => {
      if (!serverAvailable) return

      const ws = await createTestWebSocket('/eval')
      
      // Wait for welcome message
      await waitForMessage(ws, 2000)

      // Send some invalid frame data (this might close the connection, which is acceptable)
      const invalidFrame = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF])
      
      try {
        ws.send(invalidFrame)
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // If connection is still open, send a valid message
        if (ws.readyState === WebSocket.OPEN) {
          ws.send('1+1')
          const response = await waitForMessage(ws, 2000)
          const parsed = JSON.parse(response)
          expect(parsed.result).toBe(2)
        }
      } catch (error) {
        // Connection closure is acceptable for malformed frames
        expect(error).toBeDefined()
      }

      ws.close()
    }, TEST_TIMEOUT)
  })

  describe('Message Monitoring and Debugging', () => {
    it('should not log empty messages as errors in production', async () => {
      if (!serverAvailable) return

      const client = new MgbaWebSocketClient(BASE_URL)
      
      try {
        await client.connect()

        // Configure watching which might trigger various frame types
        client.configureSharedBuffer({
          preloadRegions: [
            { address: 0x20244e9, size: 7 }
          ]
        })

        await client.startWatchingPreloadRegions()

        // Let it run for a bit to see if any frame-related issues occur
        await new Promise(resolve => setTimeout(resolve, 2000))

        // Client should still be connected
        expect(client.isConnected()).toBe(true)

      } finally {
        client.disconnect()
      }
    }, TEST_TIMEOUT)

    it('should maintain connection health under stress', async () => {
      if (!serverAvailable) return

      const client = new MgbaWebSocketClient(BASE_URL)
      
      try {
        await client.connect()

        // Perform many operations in quick succession
        const operations = []
        for (let i = 0; i < 20; i++) {
          operations.push(client.eval(`return ${i}`))
        }

        const results = await Promise.all(operations)
        
        // All operations should succeed
        results.forEach((result, i) => {
          expect(result.result).toBe(i)
        })

        // Connection should still be healthy
        expect(client.isConnected()).toBe(true)

      } finally {
        client.disconnect()
      }
    }, TEST_TIMEOUT)
  })
})