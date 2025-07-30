/**
 * Simplified WebSocket client for mGBA communication
 * Core features: direct reads, memory watching, shared buffer
 */

import WebSocket from 'isomorphic-ws'

export interface MgbaEvalResponse {
  result?: unknown
  error?: string
}

export interface MemoryRegion {
  address: number
  size: number
}

export interface WatchMessage {
  type: 'watch'
  regions: MemoryRegion[]
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

export interface ErrorMessage {
  type: 'error'
  error: string
}

export interface WelcomeMessage {
  type: 'welcome'
  message: string
}

export type WebSocketMessage = WatchMessage | MemoryUpdateMessage | WatchConfirmMessage | ErrorMessage | WelcomeMessage

// For backwards compatibility
export type SharedBufferConfig = Record<string, unknown>

export type MemoryChangeListener = (address: number, size: number, data: Uint8Array) => void

/**
 * Simplified WebSocket client for mGBA
 */
export class MgbaWebSocketClient {
  private readonly baseUrl: string
  private evalWs: WebSocket | null = null
  private watchWs: WebSocket | null = null
  private evalConnected = false
  private watchConnected = false

  // Memory watching state
  private watchedRegions: MemoryRegion[] = []
  private readonly sharedBuffer = new Map<number, Uint8Array>() // address -> data
  private memoryChangeListeners: MemoryChangeListener[] = []

  constructor (baseUrl = 'ws://localhost:7102', private autoReconnect = true) {
    this.baseUrl = baseUrl
  }

  /**
   * Connect to mGBA WebSocket endpoints with enhanced state management and stress tolerance
   */
  async connect (): Promise<void> {
    // Disconnect any existing connections first to ensure clean state
    this.disconnect()
    
    // Connect sequentially to avoid overwhelming the server, with retries
    await this.connectWithRetry('eval')
    await this.connectWithRetry('watch')
    
    // Add verification delay and give more time for connections to stabilize under stress
    await new Promise(resolve => setTimeout(resolve, 200))
    
    // Additional verification step for stress scenarios - wait up to 3 seconds for both connections
    let verificationAttempts = 0
    while ((!this.evalConnected || !this.watchConnected) && verificationAttempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 100))
      verificationAttempts++
    }
  }

  /**
   * Connect with enhanced retry logic and server load handling
   */
  private async connectWithRetry (type: 'eval' | 'watch', maxRetries = 5): Promise<void> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (type === 'eval') {
          await this.connectEval()
        } else {
          await this.connectWatch()
        }
        
        // Add small delay between connections to avoid overwhelming server
        if (type === 'eval') {
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        
        return // Success
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (attempt < maxRetries) {
          // Enhanced exponential backoff for server load tolerance
          const baseDelay = Math.min(150 * Math.pow(1.4, attempt - 1), 800)
          const jitter = Math.random() * 100 // Add up to 100ms random jitter
          const delay = baseDelay + jitter

          console.debug(`${type} connection attempt ${attempt} failed, retrying in ${Math.round(delay)}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw new Error(`Failed to connect ${type} after ${maxRetries} attempts: ${lastError?.message}`)
  }

  /**
   * Disconnect all connections with improved cleanup
   */
  disconnect (): void {
    // Close connections gracefully with timeout
    if (this.evalWs) {
      try {
        this.evalWs.close()
      } catch (error) {
        console.debug('Error closing eval WebSocket:', error)
      }
      this.evalWs = null
    }

    if (this.watchWs) {
      try {
        this.watchWs.close()
      } catch (error) {
        console.debug('Error closing watch WebSocket:', error)
      }
      this.watchWs = null
    }

    // Reset connection states
    this.evalConnected = false
    this.watchConnected = false

    // Clear all cached data
    this.sharedBuffer.clear()
    this.watchedRegions = []
    this.memoryChangeListeners = []
  }

  /**
   * Execute Lua code with enhanced reliability and error recovery
   */
  async eval (code: string): Promise<MgbaEvalResponse> {
    // Auto-reconnect eval if needed for resilience during rapid test cycles
    if (!this.evalConnected || !this.evalWs) {
      if (this.autoReconnect) {
        try {
          await this.connectWithRetry('eval')
        } catch (error) {
          throw new Error(`Eval WebSocket not connected: ${error instanceof Error ? error.message : String(error)}`)
        }
      } else {
        throw new Error('Eval WebSocket not connected')
      }
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.evalWs?.removeListener('message', messageHandler)
        reject(new Error('Eval timeout'))
      }, 12000) // Extended timeout for stress scenarios

      const messageHandler = (data: Buffer) => {
        const messageText = data.toString()
        if (!messageText.startsWith('{')) return

        try {
          const response = JSON.parse(messageText) as MgbaEvalResponse
          this.evalWs?.removeListener('message', messageHandler)
          clearTimeout(timeout)
          resolve(response)
        } catch (error) {
          this.evalWs?.removeListener('message', messageHandler)
          clearTimeout(timeout)
          reject(new Error(`Failed to parse response: ${String(error)}`))
        }
      }

      this.evalWs?.on('message', messageHandler)
      this.evalWs?.send(code)
    })
  }

  /**
   * Read memory directly (uses shared buffer if available)
   */
  async readMemory (address: number, size: number): Promise<Uint8Array> {
    // Check if this region is in shared buffer
    for (const watchedRegion of this.watchedRegions) {
      if (address >= watchedRegion.address &&
          address + size <= watchedRegion.address + watchedRegion.size) {
        const bufferData = this.sharedBuffer.get(watchedRegion.address)
        if (bufferData) {
          const offset = address - watchedRegion.address
          return bufferData.slice(offset, offset + size)
        }
      }
    }

    // Direct read via eval
    const response = await this.eval(`
      local data = {}
      for i = 0, ${size - 1} do
        data[i + 1] = emu:read8(${address} + i)
      end
      return data
    `)

    if (response.error) {
      throw new Error(`Memory read failed: ${response.error}`)
    }

    const numbers = response.result as number[]
    return new Uint8Array(numbers)
  }

  /**
   * Start watching memory regions with enhanced timeout handling
   */
  async startWatching (regions: MemoryRegion[]): Promise<void> {
    // Auto-connect watch if needed for resilience
    if (!this.watchConnected || !this.watchWs) {
      if (this.autoReconnect) {
        try {
          await this.connectWithRetry('watch')
        } catch (error) {
          throw new Error(`Watch WebSocket not connected: ${error instanceof Error ? error.message : String(error)}`)
        }
      } else {
        throw new Error('Watch WebSocket not connected')
      }
    }

    // Validate regions on client side
    for (const region of regions) {
      if (region.address < 0 || region.address > 0xFFFFFFFF) {
        throw new Error(`Invalid address: 0x${region.address.toString(16)}`)
      }
      if (region.size <= 0 || region.size > 0x10000) {
        throw new Error(`Invalid size: ${region.size} (must be 1-65536)`)
      }
    }

    this.watchedRegions = [...regions]

    // Send structured watch message
    const messageLines = ['WATCH']
    for (const region of regions) {
      messageLines.push(`${region.address},${region.size}`)
    }
    const structuredMessage = messageLines.join('\n')

    // Send watch request and wait for confirmation or error with extended timeout
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.watchWs?.removeListener('message', handleResponse)
        reject(new Error('Watch setup timeout - no confirmation received'))
      }, 15000) // Increased timeout for stress scenarios

      const handleResponse = (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as WebSocketMessage
          if (message.type === 'watchConfirm') {
            clearTimeout(timeout)
            this.watchWs?.removeListener('message', handleResponse)
            resolve()
          } else if (message.type === 'error') {
            clearTimeout(timeout)
            this.watchWs?.removeListener('message', handleResponse)
            reject(new Error(message.error))
          }
        } catch (error) {
          // Ignore parsing errors for non-JSON messages
        }
      }

      this.watchWs!.on('message', handleResponse)
      this.watchWs!.send(structuredMessage)
    }).then(async () => {
      // Initialize shared buffer with current data after successful setup
      // Use Promise.allSettled to handle individual failures gracefully
      const initPromises = regions.map(async (region) => {
        try {
          const data = await this.readMemory(region.address, region.size)
          this.sharedBuffer.set(region.address, data)
          return { region, success: true }
        } catch (error) {
          console.warn(`Failed to initialize shared buffer for region 0x${region.address.toString(16)}: ${String(error)}`)
          return { region, success: false, error }
        }
      })
      
      const results = await Promise.allSettled(initPromises)
      const failed = results.filter(result => result.status === 'rejected' || 
        (result.status === 'fulfilled' && !result.value.success))
      
      if (failed.length > 0) {
        console.warn(`Failed to initialize ${failed.length}/${regions.length} shared buffer regions`)
      }
    })
  }

  /**
   * Add memory change listener
   */
  addMemoryChangeListener (listener: MemoryChangeListener): void {
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
   * Configure shared buffer (for API compatibility)
   */
  configureSharedBuffer (_config: unknown): void {
    // Simplified: no configuration needed
  }

  /**
   * Start watching preload regions from config
   */
  async startWatchingPreloadRegions (): Promise<void> {
    // Import config to get preload regions
    const { VanillaConfig } = await import('../parser/games/vanilla/config')
    const vanillaConfig = new VanillaConfig()
    const regions = vanillaConfig.memoryAddresses.preloadRegions

    await this.startWatching([...regions])
  }

  /**
   * Get shared buffer for compatibility
   */
  getSharedBuffer (): Map<number, Uint8Array>
  getSharedBuffer (address: number, size: number): Promise<Uint8Array>
  getSharedBuffer (address?: number, size?: number): Map<number, Uint8Array> | Promise<Uint8Array> {
    if (address !== undefined && size !== undefined) {
      // Parser-style usage: get specific memory region
      return this.readMemory(address, size)
    }
    // WebSocket client style usage: get full buffer map
    return this.sharedBuffer
  }

  /**
   * Check if client is connected (improved flexibility for testing)
   */
  isConnected (): boolean {
    return this.evalConnected && this.watchConnected
  }

  /**
   * Check if either connection is available (more lenient check)
   */
  hasAnyConnection (): boolean {
    return this.evalConnected || this.watchConnected
  }

  /**
   * Get game title from mGBA
   */
  async getGameTitle (): Promise<string> {
    try {
      const response = await this.eval('return emu:getGameTitle()')
      if (response.error) {
        throw new Error(response.error)
      }
      return String(response.result || 'Unknown Game')
    } catch (error) {
      console.warn('Failed to get game title:', error)
      return 'Unknown Game'
    }
  }

  /**
   * Check if watching memory (for compatibility)
   */
  isWatchingMemory (): boolean {
    return this.watchedRegions.length > 0
  }

  /**
   * Stop watching memory
   */
  async stopWatching (): Promise<void> {
    this.watchedRegions = []
    this.sharedBuffer.clear()
  }

  /**
   * Get watched regions (for compatibility)
   */
  getWatchedRegions (): MemoryRegion[] {
    return [...this.watchedRegions]
  }

  /**
   * Check eval connection status (for compatibility)
   */
  isEvalConnected (): boolean {
    return this.evalConnected
  }

  /**
   * Check watch connection status (for compatibility)
   */
  isWatchConnected (): boolean {
    return this.watchConnected
  }

  private async connectEval (): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${this.baseUrl}/eval`)

      // Reduced connection timeout for faster failure detection
      const timeout = setTimeout(() => {
        ws.close()
        reject(new Error('Eval connection timeout'))
      }, 3000)

      ws.on('open', () => {
        clearTimeout(timeout)
        this.evalWs = ws
        this.evalConnected = true
        resolve()
      })

      ws.on('error', (error: Error) => {
        clearTimeout(timeout)
        reject(new Error(`Eval connection failed: ${String(error)}`))
      })

      ws.on('close', () => {
        clearTimeout(timeout)
        // Only reset state if this is the current connection
        if (this.evalWs === ws) {
          this.evalConnected = false
          this.evalWs = null
        }
      })
    })
  }

  private async connectWatch (): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${this.baseUrl}/watch`)

      // Reduced connection timeout for faster failure detection
      const timeout = setTimeout(() => {
        ws.close()
        reject(new Error('Watch connection timeout'))
      }, 3000)

      ws.on('open', () => {
        clearTimeout(timeout)
        this.watchWs = ws
        this.watchConnected = true
        resolve()
      })

      ws.on('error', (error: Error) => {
        clearTimeout(timeout)
        reject(new Error(`Watch connection failed: ${String(error)}`))
      })

      ws.on('close', () => {
        clearTimeout(timeout)
        // Only reset state if this is the current connection
        if (this.watchWs === ws) {
          this.watchConnected = false
          this.watchWs = null
        }
      })

      ws.on('message', (data: Buffer) => {
        this.handleWatchMessage(data.toString())
      })
    })
  }

  private handleWatchMessage (messageText: string): void {
    try {
      const message = JSON.parse(messageText) as WebSocketMessage

      // Handle different message types
      switch (message.type) {
        case 'memoryUpdate':
          // Process memory update
          for (const region of message.regions) {
            // Update shared buffer
            const data = new Uint8Array(region.data)
            this.sharedBuffer.set(region.address, data)

            // Notify listeners
            for (const listener of this.memoryChangeListeners) {
              listener(region.address, region.size, data)
            }
          }
          break

        case 'watchConfirm':
          // Server confirmed it's watching memory regions
          console.log('Watch confirmed:', message.message)
          break

        case 'error':
          console.error('WebSocket error:', message.error)
          break

        case 'welcome':
          // Server welcome message - safe to ignore
          break

        default:
          console.warn('Unknown message type:', (message as { type?: unknown }).type)
      }
    } catch (error) {
      console.warn('Failed to parse watch message:', error)
    }
  }
}
