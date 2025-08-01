/**
 * WebSocket client for connecting to mGBA's eval API
 * Handles communication with the mGBA Lua HTTP server's WebSocket endpoint
 */

import WebSocket from 'isomorphic-ws'

export interface SimpleMessage {
  command: 'watch' | 'eval'
  status: 'success' | 'error' | 'update'
  data: string[]
}

export interface MemoryRegion {
  address: number
  size: number
  data: Uint8Array
  lastUpdated: number
}

export interface SharedBufferConfig {
  preloadRegions: Array<{ address: number, size: number }>
}

export type MemoryChangeListener = (address: number, size: number, data: Uint8Array) => void | Promise<void>

// Constants for memory operations
const MEMORY_CONSTANTS = {
  EVAL_TIMEOUT_MS: 5000,
  MAX_LISTENERS: 100,
} as const

export class MgbaWebSocketClient {
  private ws: WebSocket | null = null
  private connected = false

  // Memory watching system
  private watchedRegions: Array<{ address: number, size: number }> = []
  private readonly memoryChangeListeners: MemoryChangeListener[] = []
  private isWatching = false

  // Eval request handling
  private readonly pendingEvalHandlers: Array<(message: SimpleMessage) => boolean> = []

  // Simple buffer for the latest memory data from watch updates
  private readonly latestMemoryData = new Map<string, Uint8Array>()

  // Preload regions configuration
  private sharedBufferConfig: SharedBufferConfig = {
    preloadRegions: [],
  }

  constructor (private readonly url = 'ws://localhost:7102/ws') {
  }

  /**
   * Parse simple message format
   * For outgoing messages (from client): command\ndata\ndata\n...
   * For incoming responses (from server): command\nstatus\ndata\ndata\n...
   */
  private parseSimpleMessage (message: string): SimpleMessage | null {
    const lines = message.trim().split('\n')
      .map(line => line.trim())
      .filter(line => line !== '')

    if (lines.length < 1) return null

    const command = lines[0]?.trim().toLowerCase()

    if (command !== 'watch' && command !== 'eval') return null

    // Check if this is a response format (has status) or request format (no status)
    if (lines.length >= 2) {
      const possibleStatus = lines[1]?.trim().toLowerCase()
      if (possibleStatus === 'success' || possibleStatus === 'error' || possibleStatus === 'update') {
        // This is a response format: command\nstatus\ndata...
        return {
          command: command as 'watch' | 'eval',
          status: possibleStatus as 'success' | 'error' | 'update',
          data: lines.slice(2),
        }
      }
    }

    // This is a request format: command\ndata...
    return {
      command: command as 'watch' | 'eval',
      status: 'success', // Default status for request messages
      data: lines.slice(1),
    }
  }

  /**
   * Create simple message format string
   */
  private createSimpleMessage (command: 'watch' | 'eval', data: string[]): string {
    return [command, ...data].join('\n')
  }

  /**
   * Parse watch regions from simple format (address,size per line)
   */
  parseWatchRegions (data: string[]): Array<{ address: number, size: number }> {
    return data.map(line => {
      const [addressStr, sizeStr] = line.split(',').map(s => s.trim())
      const address = parseInt(addressStr ?? '0', 10)
      const size = parseInt(sizeStr ?? '0', 10)
      return { address, size }
    }).filter(region => region.address > 0 && region.size > 0)
  }

  /**
   * Connect to the mGBA WebSocket server
   */
  async connect (): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)

        const onOpen = () => {
          this.connected = true
          resolve()
        }

        const onError = (error: ErrorEvent | Event | unknown) => {
          console.error('WebSocket error:', error)
          this.connected = false
          reject(error instanceof Error ? error : new Error(String(error)))
        }

        const onClose = () => {
          this.connected = false
          this.isWatching = false
        }

        const onMessage = (event: { data: unknown }) => {
          this.handleWebSocketMessage(String(event.data))
        }

        this.ws.addEventListener('open', onOpen)
        this.ws.addEventListener('error', onError)
        this.ws.addEventListener('close', onClose)
        this.ws.addEventListener('message', onMessage)
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
    this.isWatching = false
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleWebSocketMessage (data: string): void {
    // Skip empty messages
    if (!data || data.trim() === '') {
      return
    }

    // First check if any pending eval handlers can process this message
    const simpleMessage = this.parseSimpleMessage(data)
    if (simpleMessage) {
      // Try eval handlers first
      for (let i = this.pendingEvalHandlers.length - 1; i >= 0; i--) {
        const handler = this.pendingEvalHandlers[i]
        if (handler && handler(simpleMessage)) {
          // Handler processed the message, remove it and return
          this.pendingEvalHandlers.splice(i, 1)
          return
        }
      }

      // Handle other message types
      this.handleSimpleMessage(simpleMessage)
    }
  }

  /**
   * Handle simple format messages
   */
  private handleSimpleMessage (message: SimpleMessage): void {
    switch (message.command) {
      case 'watch':
        if (message.status === 'success') {
          this.isWatching = true
        } else if (message.status === 'update') {
          this.handleMemoryUpdate(message)
        }
        break
      case 'eval':
        // Eval responses are handled by pending handlers
        break
    }
  }

  /**
   * Handle memory update messages from the server
   */
  private handleMemoryUpdate (message: SimpleMessage): void {
    // Parse memory update data: address,size,data_bytes
    for (const line of message.data) {
      const parts = line.split(',')
      if (parts.length >= 3) {
        const address = parseInt(parts[0] ?? '0', 10)
        const size = parseInt(parts[1] ?? '0', 10)
        const dataBytes = parts.slice(2).map(b => parseInt(b, 10)).filter(b => !isNaN(b))

        if (address > 0 && size > 0 && dataBytes.length === size) {
          const data = new Uint8Array(dataBytes)

          // Store latest data
          const cacheKey = `${address}-${size}`
          this.latestMemoryData.set(cacheKey, data)

          // Notify listeners
          for (const listener of this.memoryChangeListeners) {
            try {
              listener(address, size, data)
            } catch (error) {
              console.error('Error in memory change listener:', error)
            }
          }
        }
      }
    }
  }

  /**
   * Start watching memory regions for changes
   */
  async startWatching (regions?: Array<{ address: number, size: number }>): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected to mGBA WebSocket server')
    }

    // Use provided regions or fall back to preload regions
    const regionsToWatch = regions ?? this.sharedBufferConfig.preloadRegions

    if (regionsToWatch.length === 0) {
      throw new Error('No regions to watch. Configure preloadRegions or provide regions parameter.')
    }

    this.watchedRegions = [...regionsToWatch]

    // Create simple message format: watch\naddress,size\naddress,size\n...
    const regionLines = regionsToWatch.map(region => `${region.address},${region.size}`)
    const simpleMessage = this.createSimpleMessage('watch', regionLines)

    this.ws!.send(simpleMessage)
    console.log(`🔍 Started watching ${regionsToWatch.length} memory regions using simple format`)
  }

  /**
   * Stop watching memory regions
   */
  async stopWatching (): Promise<void> {
    this.watchedRegions = []
    this.isWatching = false
    // Note: We could send a stopWatch message to the server, but it's not necessary
    // as the server will clean up on disconnect
  }

  /**
   * Add a listener for memory changes
   */
  addMemoryChangeListener (listener: MemoryChangeListener): void {
    if (this.memoryChangeListeners.length >= MEMORY_CONSTANTS.MAX_LISTENERS) {
      throw new Error(`Maximum number of listeners (${MEMORY_CONSTANTS.MAX_LISTENERS}) exceeded`)
    }
    this.memoryChangeListeners.push(listener)
  }

  /**
   * Remove a memory change listener
   */
  removeMemoryChangeListener (listener: MemoryChangeListener): void {
    const index = this.memoryChangeListeners.indexOf(listener)
    if (index !== -1) {
      this.memoryChangeListeners.splice(index, 1)
    }
  }

  /**
   * Check if currently watching memory regions
   */
  isWatchingMemory (): boolean {
    return this.isWatching && this.watchedRegions.length > 0
  }

  /**
   * Get currently watched regions
   */
  getWatchedRegions (): Array<{ address: number, size: number }> {
    return [...this.watchedRegions]
  }

  isConnected (): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN
  }

  /**
   * Execute Lua code on the mGBA emulator
   */
  async eval (code: string): Promise<{ result?: string, error?: string }> {
    if (!this.isConnected()) {
      throw new Error('Not connected to mGBA WebSocket server')
    }

    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('WebSocket is null'))
        return
      }

      // Create a handler that can process eval responses
      const messageHandler = (message: SimpleMessage): boolean => {
        if (message.command !== 'eval') {
          return false // Not for us
        }

        if (message.status === 'success') {
          resolve({ result: message.data.join('\n') })
        } else if (message.status === 'error') {
          resolve({ error: message.data.join('\n') })
        }
        return true // Consumed the message
      }

      // Add handler to the list of pending eval handlers
      this.pendingEvalHandlers.push(messageHandler)

      // Send the code using simple format
      const simpleMessage = this.createSimpleMessage('eval', [code])
      this.ws.send(simpleMessage)

      // Timeout after configured time
      setTimeout(() => {
        // Remove the handler from pending list
        const index = this.pendingEvalHandlers.indexOf(messageHandler)
        if (index !== -1) {
          this.pendingEvalHandlers.splice(index, 1)
        }
        reject(new Error('Eval request timed out'))
      }, MEMORY_CONSTANTS.EVAL_TIMEOUT_MS)
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
    return parseInt(response.result ?? '0', 10)
  }

  /**
   * Read a 16-bit value from memory (little-endian)
   */
  async readWord (address: number): Promise<number> {
    const response = await this.eval(`emu:read16(${address})`)
    if (response.error) {
      throw new Error(`Failed to read word at 0x${address.toString(16)}: ${response.error}`)
    }
    return parseInt(response.result ?? '0', 10)
  }

  /**
   * Read a 32-bit value from memory (little-endian)
   */
  async readDWord (address: number): Promise<number> {
    const response = await this.eval(`emu:read32(${address})`)
    if (response.error) {
      throw new Error(`Failed to read dword at 0x${address.toString(16)}: ${response.error}`)
    }
    return parseInt(response.result ?? '0', 10)
  }

  /**
   * Read multiple bytes from memory using bulk Lua operations
   */
  async readBytes (address: number, length: number): Promise<Uint8Array> {
    // Check if we have this data from memory watching first
    const cacheKey = `${address}-${length}`
    const cachedData = this.latestMemoryData.get(cacheKey)
    if (cachedData) {
      return new Uint8Array(cachedData)
    }

    // Fall back to reading via eval
    const luaCode = `(function() 
      local r = {} 
      for i = 0, ${length - 1} do 
        r[i+1] = emu:read8(${address} + i) 
      end 
      return table.concat(r, ",")
    end)()`

    const response = await this.eval(luaCode)
    if (response.error) {
      throw new Error(`Failed to read ${length} bytes at 0x${address.toString(16)}: ${response.error}`)
    }

    const bytes = (response.result ?? '').split(',').map(b => parseInt(b.trim(), 10)).filter(b => !isNaN(b))
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
   * Write multiple bytes to memory using bulk Lua operations
   */
  async writeBytes (address: number, data: Uint8Array): Promise<void> {
    const bytes = Array.from(data).join(', ')
    const luaCode = `(function() local data = {${bytes}} for i = 1, #data do emu:write8(${address} + i - 1, data[i]) end end)()`

    const response = await this.eval(luaCode)
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
    return response.result ?? ''
  }

  /**
   * Configure shared buffer settings
   */
  configureSharedBuffer (config: Partial<SharedBufferConfig>): void {
    this.sharedBufferConfig = { ...this.sharedBufferConfig, ...config }
  }

  /**
   * Start watching the preload regions for memory changes
   */
  async startWatchingPreloadRegions (): Promise<void> {
    if (this.sharedBufferConfig.preloadRegions.length === 0) {
      throw new Error('No preload regions configured. Set preloadRegions in sharedBufferConfig.')
    }

    await this.startWatching(this.sharedBufferConfig.preloadRegions)
  }

  /**
   * Get data from memory, preferring cached data from watch updates
   */
  async getSharedBuffer (address: number, size: number): Promise<Uint8Array> {
    // First check if we have this data from memory watching
    const cacheKey = `${address}-${size}`
    const cachedData = this.latestMemoryData.get(cacheKey)
    if (cachedData) {
      return new Uint8Array(cachedData)
    }

    // Fall back to reading directly
    return this.readBytes(address, size)
  }
}
