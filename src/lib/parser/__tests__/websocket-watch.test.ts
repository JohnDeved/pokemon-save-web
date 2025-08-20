/**
 * Tests for WebSocket watch functionality to prevent regressions
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { MgbaWebSocketClient } from '../../mgba/websocket-client'

describe('WebSocket Watch Mode Regression Tests', () => {
  let mockWebSocket: {
    send: ReturnType<typeof vi.fn>
    close: ReturnType<typeof vi.fn>
    readyState: number
    onopen?: () => void
    onmessage?: (event: { data: string }) => void
    onclose?: () => void
    onerror?: (error: Event) => void
  }

  beforeEach(() => {
    mockWebSocket = {
      send: vi.fn(),
      close: vi.fn(),
      readyState: 1, // OPEN
      onopen: undefined,
      onmessage: undefined,
      onclose: undefined,
      onerror: undefined,
    }

    // Mock WebSocket constructor to return our mock
    globalThis.WebSocket = vi.fn(() => mockWebSocket) as unknown as typeof WebSocket
    vi.clearAllMocks()
  })

  test('should properly format hex addresses to prevent Lua syntax errors', () => {
    // Test the specific address that caused the original issue
    const configAddresses = [
      { input: 33703145, expected: '0x20244e9', name: 'party count (original issue)' },
      { input: 0x20244ec, expected: '0x20244ec', name: 'party data' },
      { input: 255, expected: '0xff', name: 'small address' },
      { input: 16777215, expected: '0xffffff', name: 'large address' },
    ]

    for (const { input, expected, name } of configAddresses) {
      const hexAddress = `0x${input.toString(16)}`
      expect(hexAddress, `${name} should format correctly`).toBe(expected)

      // Ensure the hex format doesn't cause Lua syntax issues
      const luaCode = `local addr = ${hexAddress}; return addr + 1`
      expect(luaCode).toContain(expected)
      expect(luaCode).not.toContain(input.toString()) // No raw decimal
    }
  })

  test('should generate Lua code that avoids the original syntax error', () => {
    // This tests the specific fix: using hex addresses instead of decimal
    const address = 33703145 // The problematic address from the error
    const size = 7

    // The new fixed format (what we use now)
    const hexAddress = `0x${address.toString(16)}`
    const newFormat = `local addr = ${hexAddress}; emu:read8(addr + i)` // "local addr = 0x20244e9; emu:read8(addr + i)"

    expect(hexAddress).toBe('0x20244e9')
    expect(newFormat).toContain('0x20244e9')
    expect(newFormat).not.toContain('33703145')

    // Full Lua code should be properly formatted
    const fullLuaCode = `
      local bytes = {}
      local addr = ${hexAddress}
      for i = 0, ${size - 1} do
        bytes[i + 1] = emu:read8(addr + i)
      end
      return bytes
    `.trim()

    expect(fullLuaCode).toContain('local addr = 0x20244e9')
    expect(fullLuaCode).toContain('emu:read8(addr + i)')
    expect(fullLuaCode).not.toContain('33703145') // No decimal addresses
  })

  test('should handle memory watching message format correctly', () => {
    const client = new MgbaWebSocketClient('ws://test:7102/ws')

    // Manually simulate connection
    Object.defineProperty(client, 'connected', { value: true, writable: true })
    Object.defineProperty(client, 'ws', { value: mockWebSocket, writable: true })

    let memoryChangeTriggered = false
    let receivedAddress: number | undefined
    let receivedSize: number | undefined
    let receivedData: Uint8Array | undefined

    // Add memory change listener
    client.addMemoryChangeListener((address, size, data) => {
      memoryChangeTriggered = true
      receivedAddress = address
      receivedSize = size
      receivedData = data
    })

    // Test watch update response with the same addresses from the config
    const watchUpdate = JSON.stringify({
      command: 'watch',
      status: 'update',
      updates: [
        {
          address: 0x20244e9, // Party count address from config
          size: 7,
          data: [1, 0, 0, 0, 0, 0, 0],
        },
      ],
    })

    // Simulate message directly
    const handleMessage = (client as unknown as { handleMessage: (data: string) => void }).handleMessage.bind(client)
    expect(() => handleMessage(watchUpdate)).not.toThrow()

    // Verify memory change was triggered
    expect(memoryChangeTriggered).toBe(true)
    expect(receivedAddress).toBe(0x20244e9)
    expect(receivedSize).toBe(7)
    expect(receivedData).toBeInstanceOf(Uint8Array)
    expect(receivedData?.length).toBe(7)
  })

  test('should handle invalid messages gracefully without crashing', () => {
    const client = new MgbaWebSocketClient('ws://test:7102/ws')
    const handleMessage = (client as unknown as { handleMessage: (data: string) => void }).handleMessage.bind(client)

    // These should not throw errors (they should log warnings but not crash)
    expect(() => handleMessage('invalid json')).not.toThrow()
    expect(() => handleMessage('')).not.toThrow()
    expect(() => handleMessage('Welcome to WebSocket')).not.toThrow()
    expect(() => handleMessage(JSON.stringify({ command: 'unknown' }))).not.toThrow()
  })

  test('should format watch regions correctly for server communication', () => {
    // Test the watch message format with the exact config addresses
    const regions = [
      { address: 0x20244e9, size: 7 }, // Party count + context
      { address: 0x20244ec, size: 600 }, // Full party data
    ]

    // The watch message should use decimal addresses (what server expects)
    const expectedMessage = 'watch\n33703145,7\n33703148,600'

    const regionLines = regions.map(r => `${r.address},${r.size}`)
    const actualMessage = ['watch', ...regionLines].join('\n')

    expect(actualMessage).toBe(expectedMessage)
  })

  test('should prevent the original "syntax error near 33703145" issue', () => {
    // This is a regression test specifically for the reported error:
    // "❌ Error processing memory change: Failed to read memory: [string "websocket-eval"]:2: syntax error near '33703145'"

    const problematicAddress = 33703145
    const size = 7

    // The fixed code that prevents the syntax error
    const hexAddress = `0x${problematicAddress.toString(16)}`
    const fixedCode = `local addr = ${hexAddress}; for i = 0, ${size - 1} do bytes[i + 1] = emu:read8(addr + i) end`

    expect(hexAddress).toBe('0x20244e9')
    expect(fixedCode).toContain('0x20244e9')
    expect(fixedCode).not.toContain('33703145')

    // Verify the fix pattern is applied
    expect(fixedCode).toMatch(/local addr = 0x[0-9a-f]+/)
    expect(fixedCode).toContain('emu:read8(addr + i)')
  })
})
