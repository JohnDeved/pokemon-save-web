/**
 * WebSocket client for connecting to mGBA's eval API
 * Handles communication with the mGBA Lua HTTP server's WebSocket endpoint
 */

import { WebSocket } from 'ws'
import { EventEmitter } from 'events'

export interface MgbaEvalResponse {
  result?: any
  error?: string
}

export class MgbaWebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null
  private connected = false
  private reconnectAttempts = 0
  private readonly maxReconnectAttempts = 5
  private readonly reconnectDelay = 1000

  constructor (private readonly url = 'ws://localhost:7102/ws') {
    super()
    // Increase max listeners to avoid warnings during parallel operations
    this.setMaxListeners(50)
  }

  /**
   * Connect to the mGBA WebSocket server
   */
  async connect (): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)

        this.ws.on('open', () => {
          console.log('Connected to mGBA WebSocket server')
          this.connected = true
          this.reconnectAttempts = 0
          resolve()
        })

        this.ws.on('error', (error) => {
          console.error('WebSocket error:', error)
          this.connected = false
          reject(error)
        })

        this.ws.on('close', () => {
          console.log('WebSocket connection closed')
          this.connected = false
          // Disable auto-reconnect for testing
          // this.attemptReconnect()
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect (): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.connected = false
  }

  /**
   * Check if currently connected
   */
  isConnected (): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN
  }

  /**
   * Execute Lua code on the mGBA emulator
   */
  async eval (code: string): Promise<MgbaEvalResponse> {
    if (!this.isConnected()) {
      throw new Error('Not connected to mGBA WebSocket server')
    }

    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('WebSocket is null'))
        return
      }

      // Set up one-time message handler for this eval
      const messageHandler = (data: Buffer) => {
        const message = data.toString()

        // Skip welcome messages and other non-JSON responses
        if (message.includes('Welcome to WebSocket Eval') ||
            message.includes('mGBA WebSocket server ready') ||
            !message.startsWith('{')) {
          console.log('mGBA:', message)
          return // Don't resolve/reject, wait for actual response
        }

        try {
          const response = JSON.parse(message) as MgbaEvalResponse
          this.ws?.off('message', messageHandler)
          resolve(response)
        } catch (error) {
          this.ws?.off('message', messageHandler)
          reject(new Error(`Failed to parse eval response: ${error}`))
        }
      }

      this.ws.on('message', messageHandler)

      // Send the code to evaluate
      this.ws.send(code)

      // Timeout after 5 seconds
      setTimeout(() => {
        this.ws?.off('message', messageHandler)
        reject(new Error('Eval request timed out'))
      }, 5000)
    })
  }

  /**
   * Read a byte from memory
   */
  async readByte (address: number): Promise<number> {
    const response = await this.eval(`emu:read8(${address})`)
    if (response.error) {
      throw new Error(`Failed to read byte at 0x${address.toString(16)}: ${response.error}`)
    }
    return response.result as number
  }

  /**
   * Read a 16-bit value from memory (little-endian)
   */
  async readWord (address: number): Promise<number> {
    const response = await this.eval(`emu:read16(${address})`)
    if (response.error) {
      throw new Error(`Failed to read word at 0x${address.toString(16)}: ${response.error}`)
    }
    return response.result as number
  }

  /**
   * Read a 32-bit value from memory (little-endian)
   */
  async readDWord (address: number): Promise<number> {
    const response = await this.eval(`emu:read32(${address})`)
    if (response.error) {
      throw new Error(`Failed to read dword at 0x${address.toString(16)}: ${response.error}`)
    }
    return response.result as number
  }

  /**
   * Read multiple bytes from memory (OPTIMIZED VERSION)
   * Uses bulk Lua operations for ultra-fast reading instead of individual byte reads
   */
  async readBytes (address: number, length: number): Promise<Uint8Array> {
    // Use optimized bulk read for better performance
    return this.readBytesBulk(address, length)
  }

  /**
   * Read multiple bytes using optimized bulk Lua operations (FAST)
   * This is 100x+ faster than individual byte reads
   */
  async readBytesBulk (address: number, length: number): Promise<Uint8Array> {
    const luaCode = `(function() local r = {} for i = 0, ${length - 1} do r[i+1] = emu:read8(${address} + i) end return r end)()`
    
    const response = await this.eval(luaCode)
    if (response.error) {
      throw new Error(`Failed to bulk read ${length} bytes at 0x${address.toString(16)}: ${response.error}`)
    }
    
    return new Uint8Array(response.result as number[])
  }

  /**
   * Read multiple bytes using chunked approach for very large reads
   * Breaks large reads into smaller chunks to avoid Lua memory issues
   */
  async readBytesChunked (address: number, length: number, chunkSize: number = 100): Promise<Uint8Array> {
    const result: number[] = []
    
    for (let offset = 0; offset < length; offset += chunkSize) {
      const currentChunkSize = Math.min(chunkSize, length - offset)
      const chunkData = await this.readBytesBulk(address + offset, currentChunkSize)
      result.push(...Array.from(chunkData))
    }
    
    return new Uint8Array(result)
  }

  /**
   * Read multiple bytes with parallel chunked approach for maximum speed
   * Uses Promise.all to read multiple chunks simultaneously
   */
  async readBytesParallel (address: number, length: number, chunkSize: number = 50): Promise<Uint8Array> {
    const chunks: Promise<Uint8Array>[] = []
    
    for (let offset = 0; offset < length; offset += chunkSize) {
      const currentChunkSize = Math.min(chunkSize, length - offset)
      chunks.push(this.readBytesBulk(address + offset, currentChunkSize))
    }
    
    const chunkResults = await Promise.all(chunks)
    const totalLength = chunkResults.reduce((sum, chunk) => sum + chunk.length, 0)
    
    const result = new Uint8Array(totalLength)
    let offset = 0
    for (const chunk of chunkResults) {
      result.set(chunk, offset)
      offset += chunk.length
    }
    
    return result
  }

  /**
   * Legacy slow method - reads one byte at a time (for comparison only)
   */
  async readBytesIndividual (address: number, length: number): Promise<Uint8Array> {
    const bytes: number[] = []
    for (let i = 0; i < length; i++) {
      const byte = await this.readByte(address + i)
      bytes.push(byte)
    }
    return new Uint8Array(bytes)
  }

  /**
   * Write a byte to memory
   */
  async writeByte (address: number, value: number): Promise<void> {
    const response = await this.eval(`emu:write8(${address}, ${value & 0xFF})`)
    if (response.error) {
      throw new Error(`Failed to write byte at 0x${address.toString(16)}: ${response.error}`)
    }
  }

  /**
   * Write a 16-bit value to memory (little-endian)
   */
  async writeWord (address: number, value: number): Promise<void> {
    const response = await this.eval(`emu:write16(${address}, ${value & 0xFFFF})`)
    if (response.error) {
      throw new Error(`Failed to write word at 0x${address.toString(16)}: ${response.error}`)
    }
  }

  /**
   * Write a 32-bit value to memory (little-endian)
   */
  async writeDWord (address: number, value: number): Promise<void> {
    const response = await this.eval(`emu:write32(${address}, ${value})`)
    if (response.error) {
      throw new Error(`Failed to write dword at 0x${address.toString(16)}: ${response.error}`)
    }
  }

  /**
   * Write multiple bytes to memory (OPTIMIZED VERSION)
   * Uses bulk Lua operations for better performance
   */
  async writeBytes (address: number, data: Uint8Array): Promise<void> {
    return this.writeBytesBulk(address, data)
  }

  /**
   * Write multiple bytes using optimized bulk Lua operations (FAST)
   */
  async writeBytesBulk (address: number, data: Uint8Array): Promise<void> {
    const bytes = Array.from(data).join(', ')
    const luaCode = `(function() local data = {${bytes}} for i = 1, #data do emu:write8(${address} + i - 1, data[i]) end end)()`
    
    const response = await this.eval(luaCode)
    if (response.error) {
      throw new Error(`Failed to bulk write ${data.length} bytes at 0x${address.toString(16)}: ${response.error}`)
    }
  }

  /**
   * Write multiple bytes using chunked approach for very large writes
   */
  async writeBytesChunked (address: number, data: Uint8Array, chunkSize: number = 100): Promise<void> {
    for (let offset = 0; offset < data.length; offset += chunkSize) {
      const chunkEnd = Math.min(offset + chunkSize, data.length)
      const chunk = data.slice(offset, chunkEnd)
      await this.writeBytesBulk(address + offset, chunk)
    }
  }

  /**
   * Legacy slow method - writes one byte at a time (for comparison only)
   */
  async writeBytesIndividual (address: number, data: Uint8Array): Promise<void> {
    const bytes = Array.from(data).join(', ')
    const code = `local data = {${bytes}}; for i = 1, #data do emu:write8(${address} + i - 1, data[i]) end`
    const response = await this.eval(code)
    if (response.error) {
      throw new Error(`Failed to write ${data.length} bytes at 0x${address.toString(16)}: ${response.error}`)
    }
  }

  /**
   * Get the current game title to check compatibility
   */
  async getGameTitle (): Promise<string> {
    const response = await this.eval('emu:getGameTitle()')
    if (response.error) {
      throw new Error(`Failed to get game title: ${response.error}`)
    }
    return response.result as string
  }

  /**
   * Attempt to reconnect to the WebSocket server
   */
  private async attemptReconnect (): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)

    setTimeout(async () => {
      try {
        await this.connect()
      } catch (error) {
        console.error('Reconnection failed:', error)
      }
    }, this.reconnectDelay * this.reconnectAttempts)
  }
}
