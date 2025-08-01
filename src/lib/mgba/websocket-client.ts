/**
 * Simplified WebSocket client for connecting to mGBA's eval API
 * Focuses on core functionality: direct reads/writes, memory watching, and simple shared buffer
 */

import WebSocket from 'isomorphic-ws'

export interface SimpleMessage {
  command: 'watch' | 'eval'
  status: 'success' | 'error' | 'update'
  data: string[]
}

// Kept for backward compatibility
export interface MemoryRegion {
  address: number
  size: number
  data: Uint8Array
  lastUpdated: number
}

// Kept for backward compatibility
export interface SharedBufferConfig {
  preloadRegions: Array<{ address: number, size: number }>
}

export type MemoryChangeListener = (address: number, size: number, data: Uint8Array) => void | Promise<void>

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
   * Parse simple message format from server (internal)
   */
  private parseSimpleMessageInternal (message: string): SimpleMessage | null {
    const lines = message.trim().split('\n').map(line => line.trim()).filter(line => line !== '')
    if (lines.length < 1) return null

    const command = lines[0]?.toLowerCase()
    if (command !== 'watch' && command !== 'eval') return null

    // Check for response format (command + status + data)
    if (lines.length >= 2) {
      const status = lines[1]?.toLowerCase()
      if (status === 'success' || status === 'error' || status === 'update') {
        return {
          command: command as 'watch' | 'eval',
          status: status as 'success' | 'error' | 'update',
          data: lines.slice(2),
        }
      }
    }

    // Handle request format (command + data) - for tests and client usage
    return {
      command: command as 'watch' | 'eval',
      status: 'success',
      data: lines.slice(1),
    }
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
    // Try parsing as JSON first (preferred format from server)
    try {
      const parsed = JSON.parse(data)
      if (parsed.result !== undefined || parsed.error !== undefined) {
        // Handle JSON eval response
        const message: SimpleMessage = {
          command: 'eval',
          status: parsed.error ? 'error' : 'success',
          data: parsed.error ? [parsed.error] : [JSON.stringify(parsed.result)],
        }
        this.handleSimpleMessage(message)
        return
      }
    } catch {
      // Not JSON, continue to other formats
    }

    // Try parsing as simple message format (used for watch updates)
    const simpleMessage = this.parseSimpleMessageInternal(data)
    if (simpleMessage) {
      this.handleSimpleMessage(simpleMessage)
      return
    }

    // Handle plain text responses (like watch confirmations)
    if (data.includes('Memory watching started') || data.includes('Welcome to WebSocket')) {
      // Confirmation messages, ignore for simplicity
    }
  }

  /**
   * Handle parsed simple messages
   */
  private handleSimpleMessage (message: SimpleMessage): void {
    if (message.command === 'watch' && message.status === 'update') {
      this.handleMemoryUpdate(message)
      return
    }

    if (message.command === 'eval') {
      this.handleEvalResponse(message)
    }
  }

  /**
   * Handle memory update messages from watching
   */
  private handleMemoryUpdate (message: SimpleMessage): void {
    for (const dataLine of message.data) {
      const parts = dataLine.split(',')
      if (parts.length >= 3 && parts[0] && parts[1]) {
        const address = parseInt(parts[0], 10)
        const size = parseInt(parts[1], 10)
        const dataBytes = parts.slice(2).map(b => parseInt(b, 10))
        const data = new Uint8Array(dataBytes)

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
            // Try to parse JSON result, otherwise return as string
            try {
              const parsed = JSON.parse(resultData)
              resolve({ result: JSON.stringify(parsed) })
            } catch {
              resolve({ result: resultData })
            }
          }
          return true
        }
        return false
      }

      this.pendingEvalHandlers.push(handler)
      const message = ['eval', code].join('\n')
      this.ws!.send(message)
    })
  }

  /**
   * Read bytes from memory - uses cached data if available, otherwise eval
   */
  async readBytes (address: number, size: number): Promise<Uint8Array> {
    // Check if we have this data cached from watching
    const cacheKey = `${address}-${size}`
    const cachedData = this.watchedMemoryData.get(cacheKey)
    if (cachedData) {
      return new Uint8Array(cachedData)
    }

    // Fall back to direct eval read
    const code = `local data = emu:readRange(${address}, ${size}) local bytes = {} for i = 1, #data do bytes[i] = string.byte(data, i) end return bytes`
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
   * Write bytes to memory
   */
  async writeBytes (address: number, data: Uint8Array): Promise<void> {
    const bytes = Array.from(data).join(',')
    const code = `local data = {${bytes}} for i = 1, #data do emu:write8(${address} + i - 1, data[i]) end`
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

  /**
   * Parse watch regions for backward compatibility (used in tests)
   */
  parseWatchRegions (data: string[]): Array<{ address: number, size: number }> {
    return data.map(line => {
      const parts = line.split(',')
      return {
        address: parseInt(parts[0] ?? '0', 10),
        size: parseInt(parts[1] ?? '0', 10),
      }
    }).filter(region => !isNaN(region.address) && !isNaN(region.size) && region.address > 0 && region.size > 0)
  }

  /**
   * Create simple message format string (for tests)
   */
  createSimpleMessage (command: 'watch' | 'eval', data: string[]): string {
    return [command, ...data].join('\n')
  }

  /**
   * Parse simple message (for tests) - public version of parseSimpleMessage
   */
  parseSimpleMessage (message: string): SimpleMessage | null {
    const lines = message.trim().split('\n').map(line => line.trim()).filter(line => line !== '')
    if (lines.length < 1) return null

    const command = lines[0]?.toLowerCase()
    if (command !== 'watch' && command !== 'eval') return null

    // Check for response format (command + status + data)
    if (lines.length >= 2) {
      const status = lines[1]?.toLowerCase()
      if (status === 'success' || status === 'error' || status === 'update') {
        return {
          command: command as 'watch' | 'eval',
          status: status as 'success' | 'error' | 'update',
          data: lines.slice(2),
        }
      }
    }

    // Handle request format (command + data) - for tests and client usage
    return {
      command: command as 'watch' | 'eval',
      status: 'success',
      data: lines.slice(1),
    }
  }
}
