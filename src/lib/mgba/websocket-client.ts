/**
 * WebSocket client for connecting to mGBA's eval API
 * Handles communication with the mGBA Lua HTTP server's WebSocket endpoint
 */

import WebSocket from 'isomorphic-ws'

// Simple EventEmitter implementation for browser compatibility
class EventEmitter {
  private events: Record<string, Array<(data: unknown) => void>> = {}

  setMaxListeners (_n: number): void {
    // No-op for browser compatibility
  }

  on (event: string, listener: (data: unknown) => void): void {
    if (!this.events[event]) {
      this.events[event] = []
    }
    this.events[event].push(listener)
  }

  off (event: string, listener: (data: unknown) => void): void {
    const listeners = this.events[event]
    if (listeners) {
      const index = listeners.indexOf(listener)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  emit (event: string, data: unknown): void {
    const listeners = this.events[event]
    if (listeners) {
      for (const listener of listeners) {
        listener(data)
      }
    }
  }
}

export interface MgbaEvalResponse {
  result?: unknown
  error?: string
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

// Constants for memory operations
const MEMORY_CONSTANTS = {
  DEFAULT_CHUNK_SIZE: 100,
  SMALL_READ_THRESHOLD: 10,
  EVAL_TIMEOUT_MS: 5000,
  MAX_LISTENERS: 100,
  CACHE_TIMEOUT_MS: 100, // Near real-time for game state sync
  MAX_CACHE_SIZE: 50,
} as const

// Default memory regions for Pokemon Emerald
const DEFAULT_PRELOAD_REGIONS = [
  { address: 0x20244e9, size: 7 }, // Party count + context
  { address: 0x20244ec, size: 600 }, // Full party data (6 * 100 bytes)
] as const

export class MgbaWebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null
  private connected = false

  // Real-time shared buffer system for memory caching
  private readonly memoryCache = new Map<string, MemoryRegion>()
  private cacheAccessCount = 0
  private sharedBufferConfig: SharedBufferConfig = {
    maxCacheSize: MEMORY_CONSTANTS.MAX_CACHE_SIZE,
    cacheTimeout: MEMORY_CONSTANTS.CACHE_TIMEOUT_MS,
    preloadRegions: [...DEFAULT_PRELOAD_REGIONS],
  }

  constructor (private readonly url = 'ws://localhost:7102/ws') {
    super()
    this.setMaxListeners(MEMORY_CONSTANTS.MAX_LISTENERS)
  }

  /**
   * Connect to the mGBA WebSocket server
   */
  async connect (): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)

        // Use compatible event handling for both browser and Node.js
        const setupEventHandlers = () => {
          if (!this.ws) return

          if ('addEventListener' in this.ws) {
            // Browser WebSocket API
            this.ws.addEventListener('open', () => {
              console.log('Connected to mGBA WebSocket server')
              this.connected = true
              resolve()
            })

            this.ws.addEventListener('error', (error) => {
              console.error('WebSocket error:', error)
              this.connected = false
              reject(error)
            })

            this.ws.addEventListener('close', () => {
              console.log('WebSocket connection closed')
              this.connected = false
            })
          } else if ('on' in this.ws) {
            // Node.js ws library API
            ;(this.ws as unknown as {
              on: (event: string, handler: (...args: unknown[]) => void) => void
            }).on('open', () => {
              console.log('Connected to mGBA WebSocket server')
              this.connected = true
              resolve()
            })

            ;(this.ws as unknown as {
              on: (event: string, handler: (...args: unknown[]) => void) => void
            }).on('error', (...args: unknown[]) => {
              const error = args[0] as Error
              console.error('WebSocket error:', error)
              this.connected = false
              reject(error)
            })

            ;(this.ws as unknown as {
              on: (event: string, handler: (...args: unknown[]) => void) => void
            }).on('close', () => {
              console.log('WebSocket connection closed')
              this.connected = false
            })
          }
        }

        setupEventHandlers()
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
      const messageHandler = (event: { data: unknown }) => {
        const message = typeof event.data === 'string' ? event.data : String(event.data)

        // Skip welcome messages and other non-JSON responses
        if (message.includes('Welcome to WebSocket Eval') ||
            message.includes('mGBA WebSocket server ready') ||
            !message.startsWith('{')) {
          return // Don't resolve/reject, wait for actual response
        }

        try {
          const response = JSON.parse(message) as MgbaEvalResponse
          if (this.ws) {
            if ('removeEventListener' in this.ws) {
              this.ws.removeEventListener('message', messageHandler)
            } else if ('off' in this.ws) {
              ;(this.ws as unknown as { off: (event: string, handler: unknown) => void }).off('message', messageHandler)
            }
          }
          resolve(response)
        } catch (error) {
          if (this.ws) {
            if ('removeEventListener' in this.ws) {
              this.ws.removeEventListener('message', messageHandler)
            } else if ('off' in this.ws) {
              ;(this.ws as unknown as { off: (event: string, handler: unknown) => void }).off('message', messageHandler)
            }
          }
          reject(new Error(`Failed to parse eval response: ${String(error)}`))
        }
      }

      // Add event listener using appropriate method
      if ('addEventListener' in this.ws) {
        this.ws.addEventListener('message', messageHandler)
      } else if ('on' in this.ws) {
        ;(this.ws as unknown as { on: (event: string, handler: unknown) => void }).on('message', messageHandler)
      }

      // Send the code to evaluate
      this.ws.send(code)

      // Timeout after configured time
      setTimeout(() => {
        if (this.ws) {
          if ('removeEventListener' in this.ws) {
            this.ws.removeEventListener('message', messageHandler)
          } else if ('off' in this.ws) {
            ;(this.ws as unknown as { off: (event: string, handler: unknown) => void }).off('message', messageHandler)
          }
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
    console.log('🔄 Preloading shared memory buffers...')

    for (const region of this.sharedBufferConfig.preloadRegions) {
      try {
        await this.getSharedBuffer(region.address, region.size)
        console.log(`✅ Preloaded region 0x${region.address.toString(16)} (${region.size} bytes)`)
      } catch (error) {
        console.warn(`⚠️  Failed to preload region 0x${region.address.toString(16)}: ${String(error)}`)
      }
    }
  }

  /**
   * Get data from shared buffer (with caching)
   * This method provides ultra-fast access to frequently used memory regions
   */
  async getSharedBuffer (address: number, size: number, useCache = true): Promise<Uint8Array> {
    const cacheKey = `${address}-${size}`
    const now = Date.now()

    // Check cache first
    if (useCache) {
      const cached = this.memoryCache.get(cacheKey)
      if (cached && !cached.dirty && (now - cached.lastUpdated) < this.sharedBufferConfig.cacheTimeout) {
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
