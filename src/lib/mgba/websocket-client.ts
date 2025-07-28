/**
 * WebSocket client for connecting to mGBA's eval API
 * Handles communication with the mGBA Lua HTTP server's WebSocket endpoint
 */

import WebSocket from 'ws'

type WebSocketConnection = WebSocket

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

// Constants for memory operations and connection management
const MEMORY_CONSTANTS = {
  DEFAULT_CHUNK_SIZE: 100,
  SMALL_READ_THRESHOLD: 10,
  EVAL_TIMEOUT_MS: 5000,
  MAX_LISTENERS: 100,
  CACHE_TIMEOUT_MS: 100, // Near real-time for game state sync
  MAX_CACHE_SIZE: 50,
} as const

const CONNECTION_CONSTANTS = {
  CONNECTION_TIMEOUT_MS: 30000, // Increased for stability
  HEARTBEAT_INTERVAL_MS: 10000, // Ping every 10 seconds
  MESSAGE_TIMEOUT_MS: 15000, // Wait longer for messages
} as const

export class MgbaWebSocketClient {
  private evalWs: WebSocketConnection | null = null
  private watchWs: WebSocketConnection | null = null
  private evalConnected = false
  private watchConnected = false
  private readonly baseUrl: string

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

  // Connection health monitoring
  private lastPingTime = 0
  private heartbeatInterval: NodeJS.Timeout | null = null
  private messageSequence = 0

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
   * Establishes connections to both eval and watch endpoints with robust error handling
   */
  async connect (): Promise<void> {
    try {
      // Clean up any existing connections
      this.disconnect()

      // Connect to both endpoints concurrently
      await Promise.all([
        this.connectEval(),
        this.connectWatch(),
      ])

      // Start connection health monitoring
      this.startHeartbeat()

      console.log('✅ Successfully connected to both mGBA WebSocket endpoints')
    } catch (error) {
      // Clean up partial connections on failure
      this.disconnect()
      throw new Error(`Failed to connect to mGBA WebSocket server: ${String(error)}`)
    }
  }

  /**
   * Connect to the eval endpoint for Lua code execution with enhanced error handling
   */
  private async connectEval (): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Eval connection timeout - ensure mGBA Docker container is running'))
      }, CONNECTION_CONSTANTS.CONNECTION_TIMEOUT_MS)

      try {
        const ws = new WebSocket(`${this.baseUrl}/eval`)

        ws.on('error', (error) => {
          clearTimeout(timeout)
          this.evalConnected = false
          reject(new Error(`Eval WebSocket connection failed: ${error.message}`))
        })

        ws.on('open', () => {
          clearTimeout(timeout)
          console.log('Connected to mGBA WebSocket eval endpoint')
          this.evalWs = ws
          this.evalConnected = true

          ws.on('close', (code, reason) => {
            console.error(`WebSocket eval connection closed: ${code} - ${reason.toString()}`)
            this.evalConnected = false
            this.evalWs = null
            // No automatic reconnection - let the application handle it
          })

          ws.on('error', (error) => {
            console.error('WebSocket eval error:', error)
            this.evalConnected = false
            // Don't set evalWs to null here to avoid race conditions
          })

          // Add ping/pong handling for connection health
          ws.on('pong', () => {
            this.lastPingTime = Date.now()
          })

          resolve()
        })
      } catch (error) {
        clearTimeout(timeout)
        reject(new Error(`Failed to create eval WebSocket: ${String(error)}`))
      }
    })
  }

  /**
   * Connect to the watch endpoint for memory monitoring with enhanced error handling
   */
  private async connectWatch (): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Watch connection timeout - ensure mGBA Docker container is running'))
      }, CONNECTION_CONSTANTS.CONNECTION_TIMEOUT_MS)

      try {
        const ws = new WebSocket(`${this.baseUrl}/watch`)

        ws.on('error', (error) => {
          clearTimeout(timeout)
          this.watchConnected = false
          reject(new Error(`Watch WebSocket connection failed: ${error.message}`))
        })

        ws.on('open', () => {
          clearTimeout(timeout)
          console.log('Connected to mGBA WebSocket watch endpoint')
          this.watchWs = ws
          this.watchConnected = true

          ws.on('close', (code, reason) => {
            console.error(`WebSocket watch connection closed: ${code} - ${reason.toString()}`)
            this.watchConnected = false
            this.isWatching = false
            this.watchWs = null
            // No automatic reconnection - let the application handle it
          })

          ws.on('error', (error) => {
            console.error('WebSocket watch error:', error)
            this.watchConnected = false
            // Don't set watchWs to null here to avoid race conditions
          })

          ws.on('message', (data) => {
            try {
              const messageText = data.toString()
              this.handleWatchMessage(messageText)
            } catch (error) {
              console.error('Error handling watch message:', error)
            }
          })

          // Add ping/pong handling for connection health
          ws.on('pong', () => {
            this.lastPingTime = Date.now()
          })

          resolve()
        })
      } catch (error) {
        clearTimeout(timeout)
        reject(new Error(`Failed to create watch WebSocket: ${String(error)}`))
      }
    })
  }

  /**
   * Disconnect from the WebSocket server and clean up resources
   */
  disconnect (): void {
    // Stop heartbeat
    this.stopHeartbeat()

    // Close connections gracefully
    if (this.evalWs && this.evalConnected) {
      try {
        this.evalWs.close()
      } catch (error) {
        console.warn('Error closing eval WebSocket:', error)
      }
    }

    if (this.watchWs && this.watchConnected) {
      try {
        this.watchWs.close()
      } catch (error) {
        console.warn('Error closing watch WebSocket:', error)
      }
    }

    // Reset state
    this.evalWs = null
    this.watchWs = null
    this.evalConnected = false
    this.watchConnected = false
    this.isWatching = false
    this.messageSequence = 0
  }

  /**
   * Start heartbeat monitoring to detect connection issues early
   */
  private startHeartbeat (): void {
    this.stopHeartbeat() // Clean up any existing interval
    this.lastPingTime = Date.now() // Initialize ping time

    this.heartbeatInterval = setInterval(() => {
      try {
        const now = Date.now()
        
        // Send ping frames to both connections if they're open
        if (this.evalWs && this.evalConnected && this.evalWs.readyState === WebSocket.OPEN) {
          this.evalWs.ping('ping')
        }
        
        if (this.watchWs && this.watchConnected && this.watchWs.readyState === WebSocket.OPEN) {
          this.watchWs.ping('ping')
        }

        // Check if we've received recent pongs (only if we've sent pings before)
        if (this.lastPingTime > 0 && (now - this.lastPingTime) > CONNECTION_CONSTANTS.HEARTBEAT_INTERVAL_MS * 3) {
          console.warn('WebSocket heartbeat timeout detected - no pong responses for extended period')
          // Don't auto-reconnect, just log the issue for debugging
        }
      } catch (error) {
        console.error('Heartbeat error:', error)
      }
    }, CONNECTION_CONSTANTS.HEARTBEAT_INTERVAL_MS)
  }

  /**
   * Stop heartbeat monitoring
   */
  private stopHeartbeat (): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  /**
   * Handle incoming WebSocket messages from watch endpoint
   */
  private handleWatchMessage (data: string): void {
    // Enhanced message validation and filtering
    if (!data || typeof data !== 'string') {
      console.warn('Received invalid message type:', typeof data)
      return
    }

    const trimmedData = data.trim()
    
    // Skip empty messages or whitespace-only messages
    if (trimmedData.length === 0) {
      // Silently ignore empty messages - these can come from ping/pong frames
      return
    }

    // Skip non-JSON messages (like plain text welcome messages from older server versions)
    if (!trimmedData.startsWith('{')) {
      console.log('Received non-JSON message:', trimmedData.substring(0, 100))
      return
    }

    try {
      const message = JSON.parse(trimmedData) as WebSocketMessage

      // Validate message structure
      if (!message || typeof message !== 'object' || !('type' in message)) {
        console.warn('Received message without type field:', trimmedData.substring(0, 100))
        return
      }

      // Handle structured messages
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
          console.log('WebSocket watch endpoint ready')
          break
        case 'error':
          console.error('WebSocket watch error:', message.error)
          break
        default:
          console.warn('Unknown WebSocket message type:', (message as { type: string }).type)
      }
    } catch (error) {
      console.warn('Failed to parse WebSocket message as JSON:', error)
      console.warn('Message preview:', trimmedData.substring(0, 200))
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
    const regionsToWatch = regions ?? this.sharedBufferConfig.preloadRegions

    if (regionsToWatch.length === 0) {
      throw new Error('No regions to watch. Configure preloadRegions or provide regions parameter.')
    }

    this.watchedRegions = [...regionsToWatch]

    const watchMessage: WatchMessage = {
      type: 'watch',
      regions: regionsToWatch,
    }

    this.watchWs!.send(JSON.stringify(watchMessage))
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
    return this.evalConnected && this.evalWs?.readyState === WebSocket.OPEN
  }

  /**
   * Check if connected to watch endpoint
   */
  isWatchConnected (): boolean {
    return this.watchConnected && this.watchWs?.readyState === WebSocket.OPEN
  }

  /**
   * Execute Lua code on the mGBA emulator with robust error handling
   */
  async eval (code: string): Promise<MgbaEvalResponse> {
    if (!this.isEvalConnected()) {
      throw new Error('Not connected to mGBA WebSocket eval endpoint. Call connect() first.')
    }

    if (!this.evalWs) {
      throw new Error('Eval WebSocket connection is null')
    }

    return new Promise((resolve, reject) => {
      ++this.messageSequence
      let responseReceived = false

      // Set up one-time message handler for this eval
      const messageHandler = (data: Buffer) => {
        if (responseReceived) return // Ignore duplicate messages

        const messageText = data.toString()

        // Skip non-JSON responses (like welcome messages)
        if (!messageText.startsWith('{')) {
          return
        }

        try {
          const response = JSON.parse(messageText) as MgbaEvalResponse
          responseReceived = true
          this.evalWs?.removeListener('message', messageHandler)
          this.evalWs?.removeListener('error', errorHandler)
          clearTimeout(timeout)
          resolve(response)
        } catch (error) {
          responseReceived = true
          this.evalWs?.removeListener('message', messageHandler)
          this.evalWs?.removeListener('error', errorHandler)
          clearTimeout(timeout)
          reject(new Error(`Failed to parse eval response: ${String(error)}`))
        }
      }

      // Set up error handler for connection issues
      const errorHandler = (error: Error) => {
        if (!responseReceived) {
          responseReceived = true
          this.evalWs?.removeListener('message', messageHandler)
          this.evalWs?.removeListener('error', errorHandler)
          clearTimeout(timeout)
          reject(new Error(`WebSocket error during eval: ${String(error)}`))
        }
      }

      // Set up timeout
      const timeout = setTimeout(() => {
        if (!responseReceived) {
          responseReceived = true
          this.evalWs?.removeListener('message', messageHandler)
          this.evalWs?.removeListener('error', errorHandler)
          reject(new Error(`Eval request timed out after ${CONNECTION_CONSTANTS.MESSAGE_TIMEOUT_MS}ms`))
        }
      }, CONNECTION_CONSTANTS.MESSAGE_TIMEOUT_MS)

      // Attach event handlers - null check for safety
      if (!this.evalWs) {
        responseReceived = true
        clearTimeout(timeout)
        reject(new Error('Eval WebSocket connection lost'))
        return
      }

      this.evalWs.on('message', messageHandler)
      this.evalWs.on('error', errorHandler)

      try {
        // Send the code to evaluate
        this.evalWs.send(code)
      } catch (error) {
        responseReceived = true
        this.evalWs.removeListener('message', messageHandler)
        this.evalWs.removeListener('error', errorHandler)
        clearTimeout(timeout)
        reject(new Error(`Failed to send eval request: ${String(error)}`))
      }
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
