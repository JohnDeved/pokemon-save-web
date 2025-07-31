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
 * Simplified WebSocket client for mGBA with unified connection
 */
export class MgbaWebSocketClient {
  private readonly baseUrl: string
  private ws: WebSocket | null = null
  private connected = false

  // Memory watching state
  private watchedRegions: MemoryRegion[] = []
  private readonly sharedBuffer = new Map<number, Uint8Array>() // address -> data
  private readonly memoryChangeListeners: MemoryChangeListener[] = []

  constructor (baseUrl = 'ws://localhost:7102', private readonly autoReconnect = true) {
    this.baseUrl = baseUrl
  }

  /**
   * Connect to mGBA WebSocket with single unified endpoint
   */
  async connect (): Promise<void> {
    // Disconnect any existing connection first to ensure clean state
    this.disconnect()

    // Add small delay to ensure server is ready for new connections
    await new Promise(resolve => setTimeout(resolve, 50))

    try {
      await this.connectWebSocket()
    } catch (error) {
      this.disconnect()
      throw error
    }

    // Brief stability check to ensure connection is established
    await new Promise(resolve => setTimeout(resolve, 50))

    // Final verification
    if (!this.connected) {
      this.disconnect()
      throw new Error('Failed to establish WebSocket connection')
    }
  }

  /**
   * Connect to unified WebSocket endpoint - should succeed on first attempt for healthy servers
   */
  private async connectWebSocket (): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.baseUrl.replace(/^http/, 'ws')}/ws`

      try {
        this.ws = new WebSocket(wsUrl)
      } catch (error) {
        reject(new Error(`Failed to create WebSocket: ${String(error)}`))
        return
      }

      // Set timeouts for connection reliability
      const connectTimeout = setTimeout(() => {
        this.ws?.close()
        reject(new Error('WebSocket connection timeout'))
      }, 10000)

      this.ws.onopen = () => {
        clearTimeout(connectTimeout)
        this.connected = true
        console.debug('✅ WebSocket connected successfully!')
        resolve()
      }

      this.ws.onmessage = (event: MessageEvent) => {
        this.handleMessage(String(event.data))
      }

      this.ws.onclose = (event: CloseEvent) => {
        clearTimeout(connectTimeout)
        this.connected = false

        if (event.wasClean) {
          console.debug('WebSocket closed cleanly')
        } else {
          console.debug(`WebSocket closed unexpectedly: ${event.code} ${event.reason}`)

          if (this.autoReconnect) {
            setTimeout(() => {
              this.connect().catch(console.error)
            }, 1000)
          }
        }
      }

      this.ws.onerror = (error: Event) => {
        clearTimeout(connectTimeout)
        console.debug('WebSocket error:', error)
        reject(new Error('WebSocket connection failed'))
      }
    })
  }

  /**
   * Handle incoming WebSocket messages with routing
   */
  private handleMessage (data: string): void {
    try {
      // Try to parse as JSON first
      const message = JSON.parse(data)

      if (message.type === 'welcome') {
        console.debug('Welcome message received:', message.message)
        return
      }

      if (message.type === 'error') {
        console.error('Server error:', message.error)
        return
      }

      if (message.type === 'memoryUpdate') {
        this.handleMemoryUpdate(message as MemoryUpdateMessage)
        return
      }

      if (message.type === 'watchConfirm') {
        console.debug('Watch confirmed:', message.message)
        return
      }

      // Handle eval response (with result or error)
      if (message.result !== undefined || message.error !== undefined) {
        // This is an eval response - handled by pending eval promises
        this.handleEvalResponse(message as MgbaEvalResponse)
        return
      }

      console.debug('Unknown message type:', message)
    } catch (error) {
      // If not JSON, treat as plain text response
      console.debug('Plain text message:', data)
    }
  }

  // Track pending eval requests
  private pendingEvals: Array<{
    resolve: (response: MgbaEvalResponse) => void
    reject: (error: Error) => void
    timeout: NodeJS.Timeout
  }> = []

  /**
   * Handle eval response
   */
  private handleEvalResponse (response: MgbaEvalResponse): void {
    const pending = this.pendingEvals.shift()
    if (pending) {
      clearTimeout(pending.timeout)
      pending.resolve(response)
    }
  }

  /**
   * Disconnect WebSocket connection with improved cleanup
   */
  disconnect (): void {
    if (this.ws) {
      try {
        this.ws.close(1000, 'Client disconnect') // Clean close with reason
      } catch (error) {
        console.debug('Error closing WebSocket:', error)
      }
      this.ws = null
    }

    this.connected = false
    this.watchedRegions = []
    this.sharedBuffer.clear()

    // Reject all pending evals
    this.pendingEvals.forEach(pending => {
      clearTimeout(pending.timeout)
      pending.reject(new Error('Connection closed'))
    })
    this.pendingEvals = []
  }

  /**
   * Execute Lua code with unified WebSocket connection
   */
  async eval (code: string): Promise<MgbaEvalResponse> {
    // Auto-reconnect if needed for resilience during rapid test cycles
    if (!this.connected || !this.ws) {
      if (this.autoReconnect) {
        try {
          await this.connect()
        } catch (error) {
          throw new Error(`WebSocket not connected: ${error instanceof Error ? error.message : String(error)}`)
        }
      } else {
        throw new Error('WebSocket not connected')
      }
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // Remove from pending list
        const index = this.pendingEvals.findIndex(p => p.timeout === timeout)
        if (index >= 0) {
          this.pendingEvals.splice(index, 1)
        }
        reject(new Error('Eval timeout'))
      }, 12000) // Extended timeout for stress scenarios

      // Add to pending requests queue
      this.pendingEvals.push({ resolve, reject, timeout })

      try {
        // Send plain Lua code for eval
        this.ws!.send(code)
      } catch (error) {
        // Remove from pending list
        const index = this.pendingEvals.findIndex(p => p.timeout === timeout)
        if (index >= 0) {
          this.pendingEvals.splice(index, 1)
        }
        clearTimeout(timeout)
        reject(new Error(`Failed to send eval: ${String(error)}`))
      }
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
   * Start watching memory regions with unified WebSocket connection
   */
  async startWatching (regions: MemoryRegion[]): Promise<void> {
    // Auto-connect if needed for resilience
    if (!this.connected || !this.ws) {
      if (this.autoReconnect) {
        try {
          await this.connect()
        } catch (error) {
          throw new Error(`WebSocket not connected: ${error instanceof Error ? error.message : String(error)}`)
        }
      } else {
        throw new Error('WebSocket not connected')
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

    // Send JSON watch message
    const watchMessage: WatchMessage = {
      type: 'watch',
      regions,
    }

    // Send watch request and wait for confirmation or error with extended timeout
    return new Promise<void>((resolve, reject) => {
      let resolved = false

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true
          reject(new Error('Watch setup timeout - no confirmation received'))
        }
      }, 15000) // Increased timeout for stress scenarios

      // Listen for confirmation (handled by message router)
      const originalHandler = this.handleMessage.bind(this)
      this.handleMessage = (data: string) => {
        try {
          const message = JSON.parse(data)
          if (message.type === 'watchConfirm' && !resolved) {
            resolved = true
            clearTimeout(timeout)
            this.handleMessage = originalHandler
            resolve()
            return
          } else if (message.type === 'error' && !resolved) {
            resolved = true
            clearTimeout(timeout)
            this.handleMessage = originalHandler
            reject(new Error(String(message.error)))
            return
          }
        } catch (error) {
          // Fall through to original handler
        }
        originalHandler(data)
      }

      try {
        this.ws!.send(JSON.stringify(watchMessage))
      } catch (error) {
        if (resolved) {
          return
        }
        resolved = true
        clearTimeout(timeout)
        this.handleMessage = originalHandler
        reject(new Error(`Failed to send watch message: ${String(error)}`))
      }
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
        (result.status === 'fulfilled' && result.value.success === false))

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
   * Check if client is connected
   */
  isConnected (): boolean {
    return this.connected
  }

  /**
   * Check if connection is available (for API compatibility)
   */
  hasAnyConnection (): boolean {
    return this.connected
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
    return this.connected
  }

  /**
   * Check watch connection status (for compatibility)
   */
  isWatchConnected (): boolean {
    return this.connected
  }

  /**
   * Handle memory update message from server
   */
  private handleMemoryUpdate (message: MemoryUpdateMessage): void {
    for (const region of message.regions) {
      // Update shared buffer
      const data = new Uint8Array(region.data)
      this.sharedBuffer.set(region.address, data)

      // Notify listeners
      for (const listener of this.memoryChangeListeners) {
        try {
          listener(region.address, region.size, data)
        } catch (error) {
          console.error('Memory change listener error:', error)
        }
      }
    }
  }
}
