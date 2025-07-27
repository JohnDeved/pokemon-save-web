/**
 * WebSocket client for connecting to mGBA's eval API
 * Handles communication with the mGBA Lua HTTP server's WebSocket endpoint
 */

import { WebSocket } from 'ws'

export interface MgbaEvalResponse {
  result?: any
  error?: string
}

export class MgbaWebSocketClient {
  private ws: WebSocket | null = null
  private connected = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  constructor(private url: string = 'ws://localhost:7102/ws') {}

  /**
   * Connect to the mGBA WebSocket server
   */
  async connect(): Promise<void> {
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
  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.connected = false
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN
  }

  /**
   * Execute Lua code on the mGBA emulator
   */
  async eval(code: string): Promise<MgbaEvalResponse> {
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
  async readByte(address: number): Promise<number> {
    const response = await this.eval(`emu:read8(${address})`)
    if (response.error) {
      throw new Error(`Failed to read byte at 0x${address.toString(16)}: ${response.error}`)
    }
    return response.result as number
  }

  /**
   * Read a 16-bit value from memory (little-endian)
   */
  async readWord(address: number): Promise<number> {
    const response = await this.eval(`emu:read16(${address})`)
    if (response.error) {
      throw new Error(`Failed to read word at 0x${address.toString(16)}: ${response.error}`)
    }
    return response.result as number
  }

  /**
   * Read a 32-bit value from memory (little-endian)
   */
  async readDWord(address: number): Promise<number> {
    const response = await this.eval(`emu:read32(${address})`)
    if (response.error) {
      throw new Error(`Failed to read dword at 0x${address.toString(16)}: ${response.error}`)
    }
    return response.result as number
  }

  /**
   * Read multiple bytes from memory
   */
  async readBytes (address: number, length: number): Promise<Uint8Array> {
    // For debugging, let's read one byte at a time first
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
  async writeByte(address: number, value: number): Promise<void> {
    const response = await this.eval(`emu:write8(${address}, ${value & 0xFF})`)
    if (response.error) {
      throw new Error(`Failed to write byte at 0x${address.toString(16)}: ${response.error}`)
    }
  }

  /**
   * Write a 16-bit value to memory (little-endian)
   */
  async writeWord(address: number, value: number): Promise<void> {
    const response = await this.eval(`emu:write16(${address}, ${value & 0xFFFF})`)
    if (response.error) {
      throw new Error(`Failed to write word at 0x${address.toString(16)}: ${response.error}`)
    }
  }

  /**
   * Write a 32-bit value to memory (little-endian)
   */
  async writeDWord(address: number, value: number): Promise<void> {
    const response = await this.eval(`emu:write32(${address}, ${value})`)
    if (response.error) {
      throw new Error(`Failed to write dword at 0x${address.toString(16)}: ${response.error}`)
    }
  }

  /**
   * Write multiple bytes to memory
   */
  async writeBytes (address: number, data: Uint8Array): Promise<void> {
    const bytes = Array.from(data).join(', ')
    const code = `local data = {${bytes}}; for i = 1, #data do emu:write8(${address} + i - 1, data[i]) end`
    const response = await this.eval(code)
    if (response.error) {
      throw new Error(`Failed to write ${data.length} bytes at 0x${address.toString(16)}: ${response.error}`)
    }
  }

  /**
   * Attempt to reconnect to the WebSocket server
   */
  private async attemptReconnect(): Promise<void> {
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