/**
 * Simplified WebSocket client for connecting to mGBA's eval API
 * Focuses on core functionality: direct reads/writes, memory watching, and simple shared buffer
 */

import WebSocket from 'isomorphic-ws'
import { WebSocketResponseSchema, type SimpleMessage, type MemoryChangeListener, type WebSocketResponse, type WebSocketEvalResult } from './types'

// Re-export types for consumers
export type { MemoryChangeListener } from './types'

export class MgbaWebSocketClient {
  private ws: WebSocket | null = null
  private connected = false

  // Memory watching
  private watchedRegions: { address: number; size: number }[] = []
  private readonly memoryChangeListeners: MemoryChangeListener[] = []
  private watchingMemory = false

  // Memory cache for watched regions
  private readonly memoryCache = new Map<string, Uint8Array>()

  // Eval request handling
  private readonly pendingEvalHandlers: ((message: SimpleMessage) => boolean)[] = []

  constructor(private readonly url = 'ws://localhost:7102/ws') {}

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (this.connected) return

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)

        this.ws.addEventListener('open', () => {
          this.connected = true
          resolve()
        })

        this.ws.addEventListener('message', event => {
          const raw = event.data
          const data = typeof raw === 'string' ? raw : String(raw)
          this.handleMessage(data)
        })

        this.ws.addEventListener('close', () => {
          this.connected = false
          this.watchingMemory = false
          this.watchedRegions = []
        })

        this.ws.addEventListener('error', error => {
          reject(new Error(`WebSocket connection failed: ${String(error)}`))
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: string): void {
    // The original server sends a welcome message first, then JSON responses
    if (data.startsWith('Welcome to WebSocket')) {
      return // Ignore welcome message
    }

    try {
      const parsed = WebSocketResponseSchema.parse(JSON.parse(data))
      this.handleOriginalJsonResponse(parsed)
    } catch (error) {
      console.warn('Failed to parse WebSocket message as JSON:', error)
    }
  }

  /**
   * Handle JSON responses from original server format
   */
  private handleOriginalJsonResponse(response: WebSocketResponse): void {
    if (response.command === 'watch') {
      this.handleWatchResponse(response)
    } else if ('result' in response) {
      this.handleEvalResponse({
        command: 'eval',
        status: 'success',
        data: [JSON.stringify(response.result)],
      })
    } else if ('error' in response) {
      this.handleEvalResponse({
        command: 'eval',
        status: 'error',
        data: [response.error ?? 'Unknown error'],
      })
    }
  }

  /**
   * Handle watch response messages
   */
  private handleWatchResponse(response: WebSocketResponse): void {
    if (response.status === 'update' && response.updates) {
      // Handle memory updates
      for (const update of response.updates) {
        const { address, size, data } = update
        // Cache the updated memory data
        const cacheKey = `${address}-${size}`
        this.memoryCache.set(cacheKey, new Uint8Array(data))

        // Notify listeners about memory changes
        for (const listener of this.memoryChangeListeners) {
          try {
            listener(address, size, new Uint8Array(data))
          } catch (error) {
            console.error('Memory change listener error:', error)
          }
        }
      }
    }
  }

  /**
   * Handle eval response messages
   */
  private handleEvalResponse(message: SimpleMessage): void {
    // Find and remove the first handler that returns true
    const idx = this.pendingEvalHandlers.findIndex(handler => handler(message))
    if (idx !== -1) {
      this.pendingEvalHandlers.splice(idx, 1)
    }
  }

  /**
   * Start watching memory regions
   */
  async startWatching(regions: { address: number; size: number }[]): Promise<void> {
    if (!this.connected || !this.ws) {
      throw new Error('Not connected to mGBA WebSocket server')
    }

    if (regions.length === 0) {
      throw new Error('No regions to watch')
    }

    this.watchedRegions = [...regions]
    const regionLines = regions.map(r => `${r.address},${r.size}`)
    const message = ['watch', ...regionLines].join('\n')

    this.ws.send(message)
    this.watchingMemory = true
  }

  /**
   * Stop watching memory regions
   */
  async stopWatching(): Promise<void> {
    if (this.watchingMemory && this.ws) {
      this.ws.send('watch\n') // Send empty watch list to stop
    }
    this.watchingMemory = false
    this.watchedRegions = []
    this.memoryCache.clear()
  }

  /**
   * Execute Lua code via eval
   */
  async eval(code: string): Promise<WebSocketEvalResult> {
    if (!this.connected || !this.ws) {
      throw new Error('Not connected to WebSocket server')
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Eval request timed out'))
      }, 5000)

      const handler = (message: SimpleMessage): boolean => {
        if (message.command === 'eval') {
          clearTimeout(timeout)

          if (message.status === 'error') {
            resolve({ error: message.data.join('\n') })
          } else {
            const resultData = message.data.join('\n')
            resolve({ result: resultData })
          }
          return true
        }
        return false
      }

      this.pendingEvalHandlers.push(handler)
      // Send plain text Lua code for original server
      this.ws!.send(code)
    })
  }

  /**
   * Read bytes from memory - uses cached data if available, otherwise eval with read8
   */
  async readBytes(address: number, size: number): Promise<Uint8Array> {
    // Check if we can satisfy this read from any watched memory region
    const cachedData = this.getCachedMemory(address, size)
    if (cachedData) {
      return cachedData
    }

    // Fall back to direct eval read using read8 (simplest method)
    // Convert address to hex to avoid issues with large decimal numbers in Lua
    const hexAddress = `0x${address.toString(16)}`
    const code = `
      local bytes = {}
      local addr = ${hexAddress}
      for i = 0, ${size - 1} do
        bytes[i + 1] = emu:read8(addr + i)
      end
      return bytes
    `.trim()
    const result = await this.eval(code)

    if (result.error) {
      throw new Error(`Failed to read memory: ${result.error}`)
    }

    try {
      const bytes = JSON.parse(result.result ?? '[]')
      return new Uint8Array(bytes)
    } catch (error) {
      throw new Error(`Failed to parse memory data: ${String(error)}`)
    }
  }

  /**
   * Check if we can read the requested data from cached memory regions
   */
  private getCachedMemory(address: number, size: number): Uint8Array | null {
    for (const [cacheKey, watchedData] of this.memoryCache.entries()) {
      const [watchedAddressStr, watchedSizeStr] = cacheKey.split('-')
      const watchedAddress = Number(watchedAddressStr)
      const watchedSize = Number(watchedSizeStr)
      if (Number.isNaN(watchedAddress) || Number.isNaN(watchedSize) || address < watchedAddress || address + size > watchedAddress + watchedSize) {
        continue
      }
      const start = address - watchedAddress
      return watchedData.slice(start, start + size)
    }
    return null
  }

  /**
   * Write bytes to memory
   */
  async writeBytes(address: number, data: Uint8Array): Promise<void> {
    const bytes = [...data].join(',')
    // Convert address to hex to avoid issues with large decimal numbers in Lua
    const hexAddress = `0x${address.toString(16)}`
    const code = `
      local data = {${bytes}}
      local addr = ${hexAddress}
      for i = 1, #data do
        emu:write8(addr + i - 1, data[i])
      end
    `.trim()
    const result = await this.eval(code)

    if (result.error) {
      throw new Error(`Failed to write memory: ${result.error}`)
    }
  }

  /**
   * Add memory change listener
   */
  addMemoryChangeListener(listener: MemoryChangeListener): void {
    if (this.memoryChangeListeners.length >= 100) {
      throw new Error('Maximum number of listeners reached')
    }
    this.memoryChangeListeners.push(listener)
  }

  /**
   * Remove memory change listener
   */
  removeMemoryChangeListener(listener: MemoryChangeListener): void {
    const index = this.memoryChangeListeners.indexOf(listener)
    if (index !== -1) {
      this.memoryChangeListeners.splice(index, 1)
    }
  }

  /**
   * Check if currently watching memory
   */
  isWatching(): boolean {
    return this.watchingMemory
  }

  /**
   * Get currently watched regions
   */
  getWatchedRegions(): { address: number; size: number }[] {
    return [...this.watchedRegions]
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.connected = false
    this.watchingMemory = false
    this.watchedRegions = []
    this.memoryCache.clear()
    this.pendingEvalHandlers.length = 0
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected
  }

  /**
   * Get game title
   */
  async getGameTitle(): Promise<string> {
    const result = await this.eval('emu:getGameTitle()')
    if (result.error) {
      throw new Error(`Failed to get game title: ${result.error}`)
    }
    return result.result ?? 'Unknown Game'
  }
}
