/**
 * WebSocket client for connecting to mGBA's eval API
 * Handles communication with the mGBA Lua HTTP server's WebSocket endpoint
 */

import * as WebSocket from 'websocket'

type WebSocketConnection = WebSocket.connection

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

export interface WelcomeMessage {
  type: 'welcome'
  message: string
}

export interface ErrorMessage {
  type: 'error'
  error: string
}

export type WebSocketMessage = WatchMessage | MemoryUpdateMessage | WatchConfirmMessage | WelcomeMessage | ErrorMessage

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
  private evalWs: WebSocketConnection | null = null
  private watchWs: WebSocketConnection | null = null
  private evalConnected = false
  private watchConnected = false
  private baseUrl: string

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
  private memoryChangeListeners: MemoryChangeListener[] = []
  private isWatching = false

  constructor (baseUrlOrFullUrl = 'ws://localhost:7102') {
    // Handle backward compatibility: if URL contains /ws, /eval, or /watch, extract base URL
    if (baseUrlOrFullUrl.includes('/ws') || baseUrlOrFullUrl.includes('/eval') || baseUrlOrFullUrl.includes('/watch')) {
      this.baseUrl = baseUrlOrFullUrl.replace(/\/(ws|eval|watch)$/, '')
    } else {
      this.baseUrl = baseUrlOrFullUrl
    }
  }

  /**
   * Connect to the mGBA WebSocket server
   * Establishes connections to both eval and watch endpoints
   */
  async connect (): Promise<void> {
    await Promise.all([
      this.connectEval(),
      this.connectWatch()
    ])
  }

  /**
   * Connect to the eval endpoint for Lua code execution
   */
  private async connectEval (): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsClient = new WebSocket.client()

        wsClient.on('connectFailed', (error) => {
          console.error('WebSocket eval connection failed:', error)
          this.evalConnected = false
          reject(error)
        })

        wsClient.on('connect', (connection) => {
          console.log('Connected to mGBA WebSocket eval endpoint')
          this.evalWs = connection
          this.evalConnected = true

          connection.on('close', () => {
            console.log('WebSocket eval connection closed')
            this.evalConnected = false
            this.evalWs = null
          })

          connection.on('error', (error) => {
            console.error('WebSocket eval error:', error)
            this.evalConnected = false
          })

          resolve()
        })

        wsClient.connect(`${this.baseUrl}/eval`)
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Connect to the watch endpoint for memory monitoring
   */
  private async connectWatch (): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsClient = new WebSocket.client()

        wsClient.on('connectFailed', (error) => {
          console.error('WebSocket watch connection failed:', error)
          this.watchConnected = false
          reject(error)
        })

        wsClient.on('connect', (connection) => {
          console.log('Connected to mGBA WebSocket watch endpoint')
          this.watchWs = connection
          this.watchConnected = true

          connection.on('close', () => {
            console.log('WebSocket watch connection closed')
            this.watchConnected = false
            this.isWatching = false
            this.watchWs = null
          })

          connection.on('error', (error) => {
            console.error('WebSocket watch error:', error)
            this.watchConnected = false
          })

          connection.on('message', (message) => {
            const messageText = message.type === 'utf8' ? message.utf8Data : ''
            this.handleWatchMessage(messageText || '')
          })

          resolve()
        })

        wsClient.connect(`${this.baseUrl}/watch`)
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect (): void {
    if (this.evalWs) {
      this.evalWs.close()
      this.evalWs = null
    }
    if (this.watchWs) {
      this.watchWs.close()
      this.watchWs = null
    }
    this.evalConnected = false
    this.watchConnected = false
    this.isWatching = false
  }

  /**
   * Handle incoming WebSocket messages from watch endpoint
   */
  private handleWatchMessage (data: string): void {
    // Skip non-JSON messages (like welcome messages)
    if (!data.startsWith('{')) {
      return
    }

    try {
      const message = JSON.parse(data) as WebSocketMessage

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
          case 'welcome':
            // Silently handle welcome messages
            break
          case 'error':
            console.error('WebSocket watch error:', message.error)
            break
          default:
            console.warn('Unknown WebSocket message type:', (message as any).type)
        }
      }
    } catch (error) {
      console.warn('Failed to parse WebSocket message:', error)
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
    if (!this.isWatchConnected()) {
      throw new Error('Not connected to mGBA WebSocket watch endpoint')
    }

    // Use provided regions or fall back to preload regions
    const regionsToWatch = regions || this.sharedBufferConfig.preloadRegions
    
    if (regionsToWatch.length === 0) {
      throw new Error('No regions to watch. Configure preloadRegions or provide regions parameter.')
    }

    this.watchedRegions = [...regionsToWatch]

    const watchMessage: WatchMessage = {
      type: 'watch',
      regions: regionsToWatch
    }

    this.watchWs!.sendUTF(JSON.stringify(watchMessage))
    console.log(`🔍 Started watching ${regionsToWatch.length} memory regions`)
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
  /**
   * Check if connected to both eval and watch endpoints
   */
  isConnected (): boolean {
    return this.isEvalConnected() && this.isWatchConnected()
  }

  /**
   * Check if connected to eval endpoint
   */
  isEvalConnected (): boolean {
    return this.evalConnected && this.evalWs?.connected === true
  }

  /**
   * Check if connected to watch endpoint
   */
  isWatchConnected (): boolean {
    return this.watchConnected && this.watchWs?.connected === true
  }

  /**
   * Execute Lua code on the mGBA emulator
   */
  async eval (code: string): Promise<MgbaEvalResponse> {
    if (!this.isEvalConnected()) {
      throw new Error('Not connected to mGBA WebSocket eval endpoint')
    }

    return new Promise((resolve, reject) => {
      if (!this.evalWs) {
        reject(new Error('Eval WebSocket is null'))
        return
      }

      // Set up one-time message handler for this eval
      const messageHandler = (message: any) => {
        const messageText = message.type === 'utf8' ? message.utf8Data : (message.binaryData?.toString() || '')

        // Skip welcome messages and other non-JSON responses
        if (!messageText.startsWith('{')) {
          return // Don't resolve/reject, wait for actual response
        }

        try {
          const response = JSON.parse(messageText) as MgbaEvalResponse
          this.evalWs?.removeListener('message', messageHandler)
          resolve(response)
        } catch (error) {
          this.evalWs?.removeListener('message', messageHandler)
          reject(new Error(`Failed to parse eval response: ${String(error)}`))
        }
      }

      this.evalWs.on('message', messageHandler)

      // Send the code to evaluate
      this.evalWs.sendUTF(code)

      // Timeout after configured time
      setTimeout(() => {
        this.evalWs?.removeListener('message', messageHandler)
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
      region => region.address === address && region.size === size
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
