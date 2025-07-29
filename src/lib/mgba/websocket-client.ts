/**
 * Simplified WebSocket client for mGBA communication
 * Core features: direct reads, memory watching, shared buffer
 * Enhanced with improved reliability, error handling, and connection health monitoring
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

export interface HeartbeatMessage {
  type: 'heartbeat'
  timestamp: number
}

export type WebSocketMessage = WatchMessage | MemoryUpdateMessage | WatchConfirmMessage | ErrorMessage | WelcomeMessage | HeartbeatMessage

// For backwards compatibility
export type SharedBufferConfig = Record<string, unknown>

export type MemoryChangeListener = (address: number, size: number, data: Uint8Array) => void
export type ConnectionStateListener = (connected: boolean, type: 'eval' | 'watch') => void

/**
 * Enhanced WebSocket client for mGBA with improved reliability
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
  private readonly memoryChangeListeners: MemoryChangeListener[] = []
  private readonly connectionStateListeners: ConnectionStateListener[] = []

  // Health monitoring
  private lastHeartbeat = 0
  private readonly heartbeatInterval = 30000 // 30 seconds
  private heartbeatTimer: NodeJS.Timeout | null = null

  // Connection resilience
  private reconnectAttempts = 0
  private readonly maxReconnectAttempts = 5
  private reconnectTimer: NodeJS.Timeout | null = null

  constructor (baseUrl = 'ws://localhost:7102') {
    this.baseUrl = baseUrl
  }

  /**
   * Connect to mGBA WebSocket endpoints with enhanced reliability
   */
  async connect (): Promise<void> {
    // Connect sequentially to avoid overwhelming the server, with retries
    await this.connectWithRetry('eval')
    await this.connectWithRetry('watch')

    // Start health monitoring after successful connection
    this.startHealthMonitoring()
    this.reconnectAttempts = 0 // Reset reconnection attempts on successful connection
  }

  /**
   * Connect with retry logic for better reliability
   */
  private async connectWithRetry (type: 'eval' | 'watch', maxRetries = 3): Promise<void> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (type === 'eval') {
          await this.connectEval()
        } else {
          await this.connectWatch()
        }
        return // Success
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        if (attempt < maxRetries) {
          // Wait before retry with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 3000)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    if (lastError) {
      throw lastError
    }

    throw new Error(`Connection failed with unknown error after ${maxRetries} attempts`)
  }

  /**
   * Disconnect all connections and cleanup
   */
  disconnect (): void {
    // Clear timers
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    // Close connections
    this.evalWs?.close()
    this.watchWs?.close()
    this.evalWs = null
    this.watchWs = null
    this.evalConnected = false
    this.watchConnected = false

    // Clear state
    this.sharedBuffer.clear()
    this.watchedRegions = []
    this.reconnectAttempts = 0
    this.lastHeartbeat = 0

    // Notify connection state listeners
    this.notifyConnectionStateListeners(false, 'eval')
    this.notifyConnectionStateListeners(false, 'watch')
  }

  /**
   * Add connection state listener
   */
  addConnectionStateListener (listener: ConnectionStateListener): void {
    this.connectionStateListeners.push(listener)
  }

  /**
   * Remove connection state listener
   */
  removeConnectionStateListener (listener: ConnectionStateListener): void {
    const index = this.connectionStateListeners.indexOf(listener)
    if (index >= 0) {
      this.connectionStateListeners.splice(index, 1)
    }
  }

  /**
   * Notify all connection state listeners
   */
  private notifyConnectionStateListeners (connected: boolean, type: 'eval' | 'watch'): void {
    for (const listener of this.connectionStateListeners) {
      try {
        listener(connected, type)
      } catch (error) {
        console.warn('Connection state listener error:', error)
      }
    }
  }

  /**
   * Start connection health monitoring
   */
  private startHealthMonitoring (): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
    }

    this.lastHeartbeat = Date.now()
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now()
      if (now - this.lastHeartbeat > this.heartbeatInterval * 2) {
        console.warn('WebSocket heartbeat timeout detected, attempting reconnection')
        this.handleConnectionLoss()
      }
    }, this.heartbeatInterval)
  }

  /**
   * Handle connection loss and attempt reconnection
   */
  private handleConnectionLoss (): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached, giving up')
      return
    }

    this.reconnectAttempts++
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000)

    console.log(`Connection lost, attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`)

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect()
        this.reconnectAttempts = 0 // Reset on successful reconnection
        console.log('Successfully reconnected to mGBA WebSocket')
      } catch (error) {
        console.error('Reconnection failed:', error)
        this.handleConnectionLoss() // Try again
      }
    }, delay)
  }

  /**
   * Execute Lua code and get result with enhanced error handling
   */
  async eval (code: string): Promise<MgbaEvalResponse> {
    if (!this.evalConnected || !this.evalWs) {
      throw new Error('Eval WebSocket not connected. Please call connect() first.')
    }

    if (!code || typeof code !== 'string') {
      throw new Error('Invalid Lua code provided')
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.evalWs?.removeListener('message', messageHandler)
        reject(new Error('Eval operation timed out after 10 seconds'))
      }, 10000)

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
          reject(new Error(`Failed to parse eval response: ${String(error)}`))
        }
      }

      try {
        this.evalWs?.on('message', messageHandler)
        this.evalWs?.send(code)
      } catch (error) {
        clearTimeout(timeout)
        reject(new Error(`Failed to send eval command: ${String(error)}`))
      }
    })
  }

  /**
   * Read memory directly with enhanced shared buffer optimization
   */
  async readMemory (address: number, size: number): Promise<Uint8Array> {
    if (!Number.isInteger(address) || address < 0) {
      throw new Error('Invalid memory address')
    }
    if (!Number.isInteger(size) || size <= 0) {
      throw new Error('Invalid memory size')
    }

    // Check if this region is in shared buffer with optimized lookup
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

    // Direct read via eval with error handling
    try {
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

      if (!Array.isArray(response.result)) {
        throw new Error('Invalid memory read response format')
      }

      const numbers = response.result as number[]
      return new Uint8Array(numbers)
    } catch (error) {
      throw new Error(`Failed to read memory at 0x${address.toString(16)}: ${String(error)}`)
    }
  }

  /**
   * Start watching memory regions for changes
   */
  async startWatching (regions: MemoryRegion[]): Promise<void> {
    if (!this.watchConnected || !this.watchWs) {
      throw new Error('Watch WebSocket not connected')
    }

    this.watchedRegions = [...regions]

    // Send structured watch message
    const messageLines = ['WATCH']
    for (const region of regions) {
      messageLines.push(`${region.address},${region.size}`)
    }
    const structuredMessage = messageLines.join('\n')

    this.watchWs.send(structuredMessage)

    // Initialize shared buffer with current data
    for (const region of regions) {
      try {
        const data = await this.readMemory(region.address, region.size)
        this.sharedBuffer.set(region.address, data)
      } catch (error) {
        console.warn(`Failed to initialize shared buffer for region 0x${region.address.toString(16)}: ${String(error)}`)
      }
    }
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
    return this.evalConnected && this.watchConnected
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

      // Add connection timeout
      const timeout = setTimeout(() => {
        ws.close()
        reject(new Error('Eval connection timeout - mGBA server may not be running'))
      }, 5000)

      ws.on('open', () => {
        clearTimeout(timeout)
        this.evalWs = ws
        this.evalConnected = true
        this.notifyConnectionStateListeners(true, 'eval')
        resolve()
      })

      ws.on('error', (error: Error) => {
        clearTimeout(timeout)
        reject(new Error(`Eval connection failed: ${error.message}. Please ensure mGBA WebSocket server is running on ${this.baseUrl}`))
      })

      ws.on('close', (code: number, reason: string) => {
        clearTimeout(timeout)
        this.evalConnected = false
        this.evalWs = null
        this.notifyConnectionStateListeners(false, 'eval')

        if (code !== 1000) { // 1000 is normal closure
          console.warn(`Eval WebSocket closed unexpectedly: ${code} ${reason}`)
          this.handleConnectionLoss()
        }
      })
    })
  }

  private async connectWatch (): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${this.baseUrl}/watch`)

      // Add connection timeout
      const timeout = setTimeout(() => {
        ws.close()
        reject(new Error('Watch connection timeout - mGBA server may not be running'))
      }, 5000)

      ws.on('open', () => {
        clearTimeout(timeout)
        this.watchWs = ws
        this.watchConnected = true
        this.notifyConnectionStateListeners(true, 'watch')
        resolve()
      })

      ws.on('error', (error: Error) => {
        clearTimeout(timeout)
        reject(new Error(`Watch connection failed: ${error.message}. Please ensure mGBA WebSocket server is running on ${this.baseUrl}`))
      })

      ws.on('close', (code: number, reason: string) => {
        clearTimeout(timeout)
        this.watchConnected = false
        this.watchWs = null
        this.notifyConnectionStateListeners(false, 'watch')

        if (code !== 1000) { // 1000 is normal closure
          console.warn(`Watch WebSocket closed unexpectedly: ${code} ${reason}`)
          this.handleConnectionLoss()
        }
      })

      ws.on('message', (data: Buffer) => {
        try {
          this.handleWatchMessage(data.toString())
          this.lastHeartbeat = Date.now() // Update heartbeat on any message
        } catch (error) {
          console.error('Error handling watch message:', error)
        }
      })
    })
  }

  private handleWatchMessage (messageText: string): void {
    if (!messageText || typeof messageText !== 'string') {
      console.warn('Received invalid watch message: empty or non-string')
      return
    }

    // Handle non-JSON messages (like raw text responses)
    if (!messageText.trim().startsWith('{')) {
      // Could be a simple text response, just log and continue
      if (messageText.length > 0) {
        console.debug('Received non-JSON watch message:', messageText.substring(0, 100))
      }
      return
    }

    try {
      const message = JSON.parse(messageText) as WebSocketMessage

      // Validate message structure
      if (typeof message !== 'object' || !('type' in message)) {
        console.warn('Received malformed watch message: missing type field')
        return
      }

      // Handle different message types with enhanced error checking
      switch (message.type) {
        case 'memoryUpdate':
          this.handleMemoryUpdate(message)
          break

        case 'watchConfirm':
          this.handleWatchConfirm(message)
          break

        case 'error':
          this.handleErrorMessage(message)
          break

        case 'welcome':
          console.debug('WebSocket welcome message received')
          break

        case 'heartbeat':
          this.lastHeartbeat = Date.now()
          break

        default:
          console.warn('Unknown WebSocket message type:', (message as { type?: unknown }).type)
      }
    } catch (error) {
      console.warn('Failed to parse watch message:', {
        error: error instanceof Error ? error.message : String(error),
        messageLength: messageText.length,
        messagePreview: messageText.substring(0, 100),
      })
    }
  }

  private handleMemoryUpdate (message: MemoryUpdateMessage): void {
    try {
      if (!('regions' in message) || !Array.isArray(message.regions)) {
        console.warn('Invalid memory update message: missing or invalid regions')
        return
      }

      for (const region of message.regions) {
        if (typeof region.address !== 'number' || !('data' in region) || !Array.isArray(region.data)) {
          console.warn('Invalid memory region in update:', region)
          continue
        }

        // Update shared buffer with validation
        const data = new Uint8Array(region.data)
        this.sharedBuffer.set(region.address, data)

        // Notify listeners with error handling
        for (const listener of this.memoryChangeListeners) {
          try {
            listener(region.address, region.size, data)
          } catch (error) {
            console.error('Memory change listener error:', error)
          }
        }
      }
    } catch (error) {
      console.error('Error handling memory update:', error)
    }
  }

  private handleWatchConfirm (message: WatchConfirmMessage): void {
    console.log('Watch confirmed:', message.message || 'Memory watching started')
  }

  private handleErrorMessage (message: ErrorMessage): void {
    console.error('WebSocket server error:', message.error || 'Unknown error')
  }
}
