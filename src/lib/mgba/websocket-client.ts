/**
 * WebSocket client for connecting to mGBA's eval API
 * Handles communication with the mGBA Lua HTTP server's WebSocket endpoint
 */

import WebSocket from 'isomorphic-ws'

export interface MgbaEvalResponse {
  result?: unknown
  error?: string
}

export interface WatchMessage {
  type: 'watch'
  regions: Array<{ address: number, size: number }>
}

export interface MemoryUpdateMessage {
  type: 'memoryUpdate'
  regions: Array<{
    address: number
    size: number
    data: number[]
  }>
  timestamp: number
}

export interface WatchConfirmMessage {
  type: 'watchConfirm'
  message: string
}

export type WebSocketMessage = WatchMessage | MemoryUpdateMessage | WatchConfirmMessage

export interface SimpleMessage {
  command: 'watch' | 'eval'
  data: string[]
}

export interface MemoryRegion {
  address: number
  size: number
  data: Uint8Array
  lastUpdated: number
  dirty: boolean
}

export interface SharedBufferConfig {
  maxCacheSize: number
  cacheTimeout: number // in milliseconds
  preloadRegions: Array<{ address: number, size: number }>
}

export type MemoryChangeListener = (address: number, size: number, data: Uint8Array) => void

// Constants for memory operations
const MEMORY_CONSTANTS = {
  DEFAULT_CHUNK_SIZE: 100,
  SMALL_READ_THRESHOLD: 10,
  EVAL_TIMEOUT_MS: 5000,
  MAX_LISTENERS: 100,
  CACHE_TIMEOUT_MS: 100, // Near real-time for game state sync
  MAX_CACHE_SIZE: 50,
} as const

export class MgbaWebSocketClient {
  private ws: WebSocket | null = null
  private connected = false

  // Real-time shared buffer system for memory caching
  private readonly memoryCache = new Map<string, MemoryRegion>()
  private cacheAccessCount = 0
  private sharedBufferConfig: SharedBufferConfig = {
    maxCacheSize: MEMORY_CONSTANTS.MAX_CACHE_SIZE,
    cacheTimeout: MEMORY_CONSTANTS.CACHE_TIMEOUT_MS,
    preloadRegions: [], // Will be set from config
  }

  // Memory watching system
  private watchedRegions: Array<{ address: number, size: number }> = []
  private readonly memoryChangeListeners: MemoryChangeListener[] = []
  private isWatching = false

  // Eval request handling
  private readonly pendingEvalHandlers: Array<(message: string) => boolean> = []

  constructor (private readonly url = 'ws://localhost:7102/ws') {
  }

  /**
   * Parse simple message format (command\ndata\ndata\n...)
   */
  private parseSimpleMessage (message: string): SimpleMessage | null {
    const lines = message.trim().split('\n')
      .map(line => line.trim())
      .filter(line => line !== '')

    if (lines.length === 0) return null

    const command = lines[0]?.trim().toLowerCase()
    if (command !== 'watch' && command !== 'eval') return null

    return {
      command: command as 'watch' | 'eval',
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
          console.log('Connected to mGBA WebSocket server')
          this.connected = true
          resolve()
        }

        const onError = (error: ErrorEvent | Event | unknown) => {
          console.error('WebSocket error:', error)
          this.connected = false
          reject(error instanceof Error ? error : new Error(String(error)))
        }

        const onClose = () => {
          console.log('WebSocket connection closed')
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
    // Skip non-message data (like welcome messages)
    if (!data || data.trim() === '') {
      return
    }

    try {
      // First check if any pending eval handlers can process this message
      for (let i = this.pendingEvalHandlers.length - 1; i >= 0; i--) {
        const handler = this.pendingEvalHandlers[i]
        if (handler && handler(data)) {
          // Handler processed the message, remove it and return
          this.pendingEvalHandlers.splice(i, 1)
          return
        }
      }

      // First try to parse as simple message format
      const simpleMessage = this.parseSimpleMessage(data)
      if (simpleMessage) {
        this.handleSimpleMessage(simpleMessage)
        return
      }

      // Fall back to JSON format for backward compatibility
      if (data.startsWith('{')) {
        const message = JSON.parse(data) as WebSocketMessage | MgbaEvalResponse

        // Handle structured messages
        if ('type' in message) {
          switch (message.type) {
            case 'memoryUpdate':
              this.handleMemoryUpdate(message)
              break
            case 'watchConfirm':
              console.log('Memory watching confirmed:', message.message)
              this.isWatching = true
              break
            default:
              console.warn('Unknown WebSocket message type:', message.type)
          }
        }
        return
      }

      // Handle plain text responses from server (e.g., watch confirmations)
      if (data.includes('Memory watching started')) {
        console.log('Memory watching confirmed:', data)
        this.isWatching = true
        return
      }

      // Handle other plain text server messages (like welcome messages)
      if (data.includes('Welcome to WebSocket')) {
        console.log('Server welcome:', data)
      }
    } catch (error) {
      console.warn('Failed to parse WebSocket message:', error)
    }
  }

  /**
   * Handle simple format messages
   */
  private handleSimpleMessage (message: SimpleMessage): void {
    switch (message.command) {
      case 'watch':
        // This would be a response from server, not typically expected
        console.log('Received watch command from server (unexpected)')
        break
      case 'eval':
        // This would be a response from server, not typically expected
        console.log('Received eval command from server (unexpected)')
        break
    }
  }

  /**
   * Handle memory update messages from the server
   */
  private handleMemoryUpdate (message: MemoryUpdateMessage): void {
    for (const region of message.regions) {
      const data = new Uint8Array(region.data)

      // Update cache
      const cacheKey = `${region.address}-${region.size}`
      this.memoryCache.set(cacheKey, {
        address: region.address,
        size: region.size,
        data: new Uint8Array(data), // Make a copy
        lastUpdated: Date.now(),
        dirty: false,
      })

      // Notify listeners
      for (const listener of this.memoryChangeListeners) {
        try {
          listener(region.address, region.size, data)
        } catch (error) {
          console.error('Error in memory change listener:', error)
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
  async eval (code: string, useSimpleFormat = true): Promise<MgbaEvalResponse> {
    if (!this.isConnected()) {
      throw new Error('Not connected to mGBA WebSocket server')
    }

    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('WebSocket is null'))
        return
      }

      // Create a handler that can process eval responses
      const messageHandler = (message: string): boolean => {
        // Skip welcome messages and other non-JSON/non-result responses
        if (!message.startsWith('{') && !message.includes('result') && !message.includes('error')) {
          return false // Don't consume this message
        }

        try {
          const response = JSON.parse(message) as MgbaEvalResponse
          resolve(response)
          return true // Consumed the message
        } catch (error) {
          reject(new Error(`Failed to parse eval response: ${String(error)}`))
          return true // Consumed the message (even though it failed)
        }
      }

      // Add handler to the list of pending eval handlers
      this.pendingEvalHandlers.push(messageHandler)

      // Send the code using the appropriate format
      if (useSimpleFormat) {
        const simpleMessage = this.createSimpleMessage('eval', [code])
        this.ws.send(simpleMessage)
      } else {
        // Legacy format - send raw code
        this.ws.send(code)
      }

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
   * Read multiple bytes from memory using the most appropriate method
   * Automatically chooses between readRange API and bulk Lua operations
   */
  async readBytes (address: number, length: number): Promise<Uint8Array> {
    // For very small reads, use bulk Lua which is more reliable
    if (length <= MEMORY_CONSTANTS.SMALL_READ_THRESHOLD) {
      return this.readBytesBulk(address, length)
    }

    try {
      // Try using readRange API - fastest for larger reads
      const luaCode = `(function()
        local data = emu:readRange(${address}, ${length})
        local bytes = {}
        for i = 1, #data do
          bytes[i] = string.byte(data, i)
        end
        return bytes
      end)()`

      const response = await this.eval(luaCode)
      if (response.error) {
        throw new Error(`Failed to read ${length} bytes at 0x${address.toString(16)}: ${response.error}`)
      }

      return new Uint8Array(response.result as number[])
    } catch (error) {
      // Fallback to bulk read if readRange fails
      console.warn(`readRange failed, falling back to bulk read: ${String(error)}`)
      return this.readBytesBulk(address, length)
    }
  }

  /**
   * Read multiple bytes using optimized bulk Lua operations (FAST)
   * This is 100x+ faster than individual byte reads
   */
  async readBytesBulk (address: number, length: number): Promise<Uint8Array> {
    const luaCode = `(function() 
      local r = {} 
      for i = 0, ${length - 1} do 
        r[i+1] = emu:read8(${address} + i) 
      end 
      return r 
    end)()`

    const response = await this.eval(luaCode)
    if (response.error) {
      throw new Error(`Failed to bulk read ${length} bytes at 0x${address.toString(16)}: ${response.error}`)
    }

    return new Uint8Array(response.result as number[])
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
   * Write multiple bytes to memory using the most appropriate method
   */
  async writeBytes (address: number, data: Uint8Array): Promise<void> {
    // For small writes, use individual byte writes for reliability
    if (data.length <= MEMORY_CONSTANTS.SMALL_READ_THRESHOLD) {
      return this.writeBytesBulk(address, data)
    }

    // For larger writes, use chunked approach
    return this.writeBytesChunked(address, data, MEMORY_CONSTANTS.DEFAULT_CHUNK_SIZE)
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
  async writeBytesChunked (address: number, data: Uint8Array, chunkSize = MEMORY_CONSTANTS.DEFAULT_CHUNK_SIZE): Promise<void> {
    for (let offset = 0; offset < data.length; offset += chunkSize) {
      const chunkEnd = Math.min(offset + chunkSize, data.length)
      const chunk = data.slice(offset, chunkEnd)
      await this.writeBytesBulk(address + offset, chunk)
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
   * Configure shared buffer settings
   */
  configureSharedBuffer (config: Partial<SharedBufferConfig>): void {
    this.sharedBufferConfig = { ...this.sharedBufferConfig, ...config }
  }

  /**
   * Preload commonly used memory regions into cache
   */
  async preloadSharedBuffers (): Promise<void> {
    for (const region of this.sharedBufferConfig.preloadRegions) {
      try {
        await this.getSharedBuffer(region.address, region.size)
      } catch (error) {
        console.warn(`⚠️  Failed to preload region 0x${region.address.toString(16)}: ${String(error)}`)
      }
    }
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
   * Get data from shared buffer (with caching)
   * This method provides ultra-fast access to frequently used memory regions
   * When memory watching is active, it prefers cached data to reduce polling
   */
  async getSharedBuffer (address: number, size: number, useCache = true): Promise<Uint8Array> {
    const cacheKey = `${address}-${size}`
    const now = Date.now()

    // If this region is being watched, prefer cached data (much longer timeout)
    const isWatchedRegion = this.isWatching && this.watchedRegions.some(
      region => region.address === address && region.size === size,
    )

    // Check cache first
    if (useCache) {
      const cached = this.memoryCache.get(cacheKey)
      if (cached && !cached.dirty) {
        const timeout = isWatchedRegion
          ? this.sharedBufferConfig.cacheTimeout * 1000 // Much longer timeout for watched regions
          : this.sharedBufferConfig.cacheTimeout

        if ((now - cached.lastUpdated) < timeout) {
          return cached.data
        }
      }
    }

    // For watched regions, if we have any cached data (even if expired), return it
    // The push updates will keep it fresh
    if (isWatchedRegion && useCache) {
      const cached = this.memoryCache.get(cacheKey)
      if (cached && !cached.dirty) {
        console.log(`🔍 Using cached data for watched region 0x${address.toString(16)} (age: ${now - cached.lastUpdated}ms)`)
        return cached.data
      }
    }

    // Read from memory using optimized method
    const data = await this.readBytes(address, size)

    // Cache the result
    if (useCache) {
      this.memoryCache.set(cacheKey, {
        address,
        size,
        data: new Uint8Array(data), // Make a copy
        lastUpdated: now,
        dirty: false,
      })

      // Cleanup cache periodically (every 10 accesses) to avoid overhead
      this.cacheAccessCount++
      if (this.cacheAccessCount % 10 === 0) {
        this.cleanupCache()
      }
    }

    return data
  }

  /**
   * Write data to shared buffer and mark cache as dirty
   */
  async setSharedBuffer (address: number, data: Uint8Array): Promise<void> {
    // Write to memory
    await this.writeBytes(address, data)

    // Mark related cache entries as dirty
    for (const [, region] of this.memoryCache.entries()) {
      const regionEnd = region.address + region.size
      const writeEnd = address + data.length

      // Check if write overlaps with cached region
      if (address < regionEnd && writeEnd > region.address) {
        region.dirty = true
      }
    }
  }

  /**
   * Invalidate specific cache entry
   */
  invalidateCache (address: number, size: number): void {
    const cacheKey = `${address}-${size}`
    this.memoryCache.delete(cacheKey)
  }

  /**
   * Clear all cached memory
   */
  clearCache (): void {
    this.memoryCache.clear()
  }

  /**
   * Clean up old cache entries
   */
  private cleanupCache (): void {
    const now = Date.now()
    const entries = Array.from(this.memoryCache.entries())

    // Remove expired entries
    for (const [key, region] of entries) {
      if ((now - region.lastUpdated) > this.sharedBufferConfig.cacheTimeout) {
        this.memoryCache.delete(key)
      }
    }

    // Remove oldest entries if cache is too large
    if (this.memoryCache.size > this.sharedBufferConfig.maxCacheSize) {
      const sortedEntries = entries.sort((a, b) => a[1].lastUpdated - b[1].lastUpdated)
      const toRemove = this.memoryCache.size - this.sharedBufferConfig.maxCacheSize

      for (let i = 0; i < toRemove; i++) {
        const entry = sortedEntries[i]
        if (entry) {
          this.memoryCache.delete(entry[0])
        }
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats (): { size: number, regions: Array<{ address: string, size: number, age: number, dirty: boolean }> } {
    const now = Date.now()
    const regions = Array.from(this.memoryCache.entries()).map(([, region]) => ({
      address: `0x${region.address.toString(16)}`,
      size: region.size,
      age: now - region.lastUpdated,
      dirty: region.dirty,
    }))

    return { size: this.memoryCache.size, regions }
  }
}
