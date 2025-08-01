/**
 * Test suite for simple message format parsing
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { MgbaWebSocketClient } from '../websocket-client'

describe('Simple Message Format', () => {
  let client: MgbaWebSocketClient

  beforeEach(() => {
    client = new MgbaWebSocketClient()
  })

  describe('Message Parsing', () => {
    it('should parse watch command with regions', () => {
      const message = 'watch\n132145,8\n154311,600'
      // Test the private method by accessing it through any
      const parsed = (client as any).parseSimpleMessage(message)

      expect(parsed).toEqual({
        command: 'watch',
        status: 'success',
        data: ['132145,8', '154311,600'],
      })
    })

    it('should parse eval command with code', () => {
      const message = 'eval\n1+1'
      const parsed = (client as any).parseSimpleMessage(message)

      expect(parsed).toEqual({
        command: 'eval',
        status: 'success',
        data: ['1+1'],
      })
    })

    it('should parse eval command with multiline code', () => {
      const message = 'eval\nlocal test = 1\nreturn test'
      const parsed = (client as any).parseSimpleMessage(message)

      expect(parsed).toEqual({
        command: 'eval',
        status: 'success',
        data: ['local test = 1', 'return test'],
      })
    })

    it('should return null for invalid commands', () => {
      const message = 'invalid\ndata'
      const parsed = (client as any).parseSimpleMessage(message)

      expect(parsed).toBeNull()
    })

    it('should return null for empty messages', () => {
      const message = ''
      const parsed = (client as any).parseSimpleMessage(message)

      expect(parsed).toBeNull()
    })

    it('should handle whitespace and empty lines', () => {
      const message = '  watch  \n\n  132145,8  \n  \n  154311,600  \n'
      const parsed = (client as any).parseSimpleMessage(message)

      expect(parsed).toEqual({
        command: 'watch',
        status: 'success',
        data: ['132145,8', '154311,600'],
      })
    })
  })

  describe('Watch Region Parsing', () => {
    it('should parse valid watch regions', () => {
      const data = ['132145,8', '154311,600', '100000,4']
      const regions = client.parseWatchRegions(data)

      expect(regions).toEqual([
        { address: 132145, size: 8 },
        { address: 154311, size: 600 },
        { address: 100000, size: 4 },
      ])
    })

    it('should filter out invalid regions', () => {
      const data = ['132145,8', 'invalid,data', '0,4', '100,0', '200,10']
      const regions = client.parseWatchRegions(data)

      expect(regions).toEqual([
        { address: 132145, size: 8 },
        { address: 200, size: 10 },
      ])
    })

    it('should handle whitespace in region data', () => {
      const data = ['  132145  ,  8  ', '154311, 600']
      const regions = client.parseWatchRegions(data)

      expect(regions).toEqual([
        { address: 132145, size: 8 },
        { address: 154311, size: 600 },
      ])
    })
  })

  describe('Message Creation', () => {
    it('should create simple watch message', () => {
      const message = (client as any).createSimpleMessage('watch', ['132145,8', '154311,600'])

      expect(message).toBe('watch\n132145,8\n154311,600')
    })

    it('should create simple eval message', () => {
      const message = (client as any).createSimpleMessage('eval', ['1+1'])

      expect(message).toBe('eval\n1+1')
    })

    it('should handle multiline eval', () => {
      const message = (client as any).createSimpleMessage('eval', ['local test = 1', 'return test'])

      expect(message).toBe('eval\nlocal test = 1\nreturn test')
    })
  })
})
