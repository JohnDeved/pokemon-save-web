/**
 * Simplified WebSocket client for connecting to mGBA's eval API
 * Focuses on core functionality: direct reads/writes, memory watching, and simple shared buffer
 */

import WebSocket from 'isomorphic-ws'
import type { SimpleMessage, SharedBufferConfig, MemoryChangeListener } from './types'

// Re-export types for consumers
export type { MemoryChangeListener } from './types'

export class MgbaWebSocketClient {
  private ws: WebSocket | null = null
  private connected = false

  // Memory watching
  private watchedRegions: Array<{ address: number, size: number }> = []
  private readonly memoryChangeListeners: MemoryChangeListener[] = []
  private isWatching = false

  // Simple memory cache for watched regions
  private readonly watchedMemoryData = new Map<string, Uint8Array>()

  // Simple preload regions config for backward compatibility
  private preloadRegions: Array<{ address: number, size: number }> = []

  // Eval handling
  private readonly pendingEvalHandlers: Array<(message: SimpleMessage) => boolean> = []

  constructor (private readonly url = 'ws://localhost:7102/ws') {
  }

  /**
   * Connect to WebSocket server
   */
  async connect (): Promise<void> {
    if (this.connected) return

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          this.connected = true
          resolve()
        }

        this.ws.onmessage = (event) => {
          const data = event.data as string
          this.handleMessage(data)
        }

        this.ws.onclose = () => {
          this.connected = false
          this.isWatching = false
          this.watchedRegions = []
        }

        this.ws.onerror = (error) => {
          reject(new Error(`WebSocket connection failed: ${String(error)}`))
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage (data: string): void {
    // The original server sends a welcome message first, then JSON responses
    if (data.startsWith('Welcome to WebSocket')) {
      return // Ignore welcome message
    }

    try {
      const parsed = JSON.parse(data)
      this.handleOriginalJsonResponse(parsed)
    } catch (error) {
      console.warn('Failed to parse WebSocket message as JSON:', error)
    }
  }

  /**
   * Handle JSON responses from original server format
   */
  private handleOriginalJsonResponse (response: any): void {
    if ('result' in response) {
      this.handleEvalResponse({
        command: 'eval',
        status: 'success',
        data: [JSON.stringify(response.result)],
      })
    } else if ('error' in response) {
      this.handleEvalResponse({
        command: 'eval',
        status: 'error',
        data: [response.error],
      })
    }
  }

  /**
   * Handle parsed JSON messages from server
   */
  private handleJsonMessage (message: any): void {
    switch (`${message.command}-${message.status}`) {
      case 'eval-success':
        this.handleEvalResponse({
          command: 'eval',
          status: 'success',
          data: [JSON.stringify(message.result)],
        })
        break
      case 'eval-error':
        this.handleEvalResponse({
          command: 'eval',
          status: 'error',
          data: [message.error],
        })
        break
      case 'watch-update':
        this.handleMemoryUpdate(message)
        break
      // Ignore watch success/error confirmations
    }
  }

  /**
   * Handle memory update messages from watching (JSON format)
   */
  private handleMemoryUpdate (message: any): void {
    if (message.updates && Array.isArray(message.updates)) {
      for (const update of message.updates) {
        const address = update.address
        const size = update.size
        const dataArray = update.data

        if (typeof address === 'number' && typeof size === 'number' && Array.isArray(dataArray)) {
          const data = new Uint8Array(dataArray)

          // Cache the data
          const cacheKey = `${address}-${size}`
          this.watchedMemoryData.set(cacheKey, data)

          // Notify listeners
          for (const listener of this.memoryChangeListeners) {
            try {
              listener(address, size, data)
            } catch (error) {
              console.error('Memory change listener error:', error)
            }
          }
        }
      }
    }
  }

  /**
   * Handle eval response messages
   */
  private handleEvalResponse (message: SimpleMessage): void {
    // Find pending handler for this response
    for (let i = this.pendingEvalHandlers.length - 1; i >= 0; i--) {
      const handler = this.pendingEvalHandlers[i]
      if (handler && handler(message)) {
        this.pendingEvalHandlers.splice(i, 1)
        break
      }
    }
  }

  /**
   * Start watching memory regions
   */
  async startWatching (regions: Array<{ address: number, size: number }>): Promise<void> {
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
    this.isWatching = true
  }

  /**
   * Stop watching memory regions
   */
  async stopWatching (): Promise<void> {
    if (this.isWatching && this.ws) {
      this.ws.send('watch\n') // Send empty watch list to stop
    }
    this.isWatching = false
    this.watchedRegions = []
    this.watchedMemoryData.clear()
  }

  /**
   * Execute Lua code via eval
   */
  async eval (code: string): Promise<{ result?: string, error?: string }> {
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
   * Read bytes from memory - uses cached data if available, otherwise eval
   */
  async readBytes (address: number, size: number): Promise<Uint8Array> {
    // Check if we can satisfy this read from any watched memory region
    const cachedData = this.getFromWatchedMemory(address, size)
    if (cachedData) {
      return cachedData
    }

    // Fall back to direct eval read
    const code = `
      local data = emu:readRange(${address}, ${size})
      local bytes = {}
      for i = 1, #data do
        bytes[i] = string.byte(data, i)
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
   * Check if we can read the requested data from any watched memory region
   */
  private getFromWatchedMemory (address: number, size: number): Uint8Array | null {
    for (const [cacheKey, watchedData] of this.watchedMemoryData.entries()) {
      const [watchedAddress, watchedSize] = cacheKey.split('-').map(Number)

      // Check if the requested range is within the watched region
      if (address >= watchedAddress && (address + size) <= (watchedAddress + watchedSize)) {
        const startOffset = address - watchedAddress
        const endOffset = startOffset + size
        return new Uint8Array(watchedData.slice(startOffset, endOffset))
      }
    }
    return null
  }

  /**
   * Write bytes to memory
   */
  async writeBytes (address: number, data: Uint8Array): Promise<void> {
    const bytes = Array.from(data).join(',')
    const code = `
      local data = {${bytes}}
      for i = 1, #data do
        emu:write8(${address} + i - 1, data[i])
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
  addMemoryChangeListener (listener: MemoryChangeListener): void {
    if (this.memoryChangeListeners.length >= 100) {
      throw new Error('Maximum number of listeners reached')
    }
    this.memoryChangeListeners.push(listener)
  }

  /**
   * Remove memory change listener
   */
  removeMemoryChangeListener (listener: MemoryChangeListener): void {
    const index = this.memoryChangeListeners.indexOf(listener)
    if (index >= 0) {
      this.memoryChangeListeners.splice(index, 1)
    }
  }

  /**
   * Check if currently watching memory
   */
  isWatchingMemory (): boolean {
    return this.isWatching
  }

  /**
   * Get currently watched regions
   */
  getWatchedRegions (): Array<{ address: number, size: number }> {
    return [...this.watchedRegions]
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect (): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.connected = false
    this.isWatching = false
    this.watchedRegions = []
    this.watchedMemoryData.clear()
    this.pendingEvalHandlers.length = 0
  }

  // Backward compatibility methods (simplified implementations)

  /**
   * Configure preload regions for backward compatibility
   */
  configureSharedBuffer (config: SharedBufferConfig): void {
    this.preloadRegions = [...config.preloadRegions]
  }

  /**
   * Start watching preload regions for backward compatibility
   */
  async startWatchingPreloadRegions (): Promise<void> {
    if (this.preloadRegions.length === 0) {
      throw new Error('No preload regions configured. Set preloadRegions in SharedBufferConfig.')
    }
    await this.startWatching(this.preloadRegions)
  }

  /**
   * Get shared buffer (cached memory data) for backward compatibility
   */
  async getSharedBuffer (address: number, size: number): Promise<Uint8Array> {
    return this.readBytes(address, size)
  }

  /**
   * Check if connected for backward compatibility
   */
  isConnected (): boolean {
    return this.connected
  }

  /**
   * Get game title for backward compatibility
   */
  async getGameTitle (): Promise<string> {
    const result = await this.eval('return emu:getGameTitle()')
    if (result.error) {
      throw new Error(`Failed to get game title: ${result.error}`)
    }
    return result.result?.replace(/"/g, '') ?? 'Unknown Game'
  }
}
