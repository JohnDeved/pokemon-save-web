/**
 * Simple WebSocket client for mGBA communication
 * Basic features: direct reads, memory watching
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

export class MgbaWebSocketClient {
  private ws: WebSocket | null = null
  private connected = false
  private memoryUpdateListener: ((regions: MemoryUpdateMessage['regions']) => void) | null = null

  constructor(private readonly url = 'ws://localhost:7102/ws') {}

  async connect(): Promise<void> {
    if (this.connected) return

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)
        
        this.ws.onopen = () => {
          this.connected = true
          resolve()
        }
        
        this.ws.onerror = (error: any) => {
          this.connected = false
          reject(new Error(`WebSocket connection failed: ${error.message || 'Unknown error'}`))
        }
        
        this.ws.onclose = () => {
          this.connected = false
        }
        
        this.ws.onmessage = (event: any) => {
          try {
            const message = JSON.parse(event.data as string) as WebSocketMessage
            
            if (message.type === 'memoryUpdate' && this.memoryUpdateListener) {
              this.memoryUpdateListener(message.regions)
            }
          } catch (error) {
            // Ignore parse errors for non-JSON messages
          }
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.connected = false
  }

  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN
  }

  async eval(code: string): Promise<MgbaEvalResponse> {
    if (!this.isConnected()) {
      throw new Error('WebSocket not connected')
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Eval timeout'))
      }, 5000)

      const handleResponse = (event: any) => {
        try {
          const response = JSON.parse(event.data as string)
          if (response.result !== undefined || response.error !== undefined) {
            clearTimeout(timeout)
            this.ws?.removeEventListener('message', handleResponse)
            resolve(response)
          }
        } catch (error) {
          // Ignore parse errors
        }
      }

      this.ws?.addEventListener('message', handleResponse)
      this.ws?.send(code)
    })
  }

  async readMemoryDirect(address: number, size: number): Promise<Uint8Array> {
    const luaCode = `
      local data = {}
      for i = 0, ${size - 1} do
        data[i + 1] = memory.read8(${address} + i)
      end
      return data
    `
    
    const response = await this.eval(luaCode)
    if (response.error) {
      throw new Error(`Memory read failed: ${response.error}`)
    }
    
    const data = response.result as number[]
    return new Uint8Array(data)
  }

  async startWatching(regions: MemoryRegion[]): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('WebSocket not connected')
    }

    const watchMessage: WatchMessage = {
      type: 'watch',
      regions
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Watch setup timeout'))
      }, 5000)

      const handleResponse = (event: any) => {
        try {
          const response = JSON.parse(event.data as string)
          if (response.type === 'watchConfirm') {
            clearTimeout(timeout)
            this.ws?.removeEventListener('message', handleResponse)
            resolve()
          }
        } catch (error) {
          // Ignore parse errors
        }
      }

      this.ws?.addEventListener('message', handleResponse)
      this.ws?.send(JSON.stringify(watchMessage))
    })
  }

  onMemoryUpdate(listener: (regions: MemoryUpdateMessage['regions']) => void): void {
    this.memoryUpdateListener = listener
  }

  removeMemoryUpdateListener(): void {
    this.memoryUpdateListener = null
  }

  // Backward compatibility methods (simplified implementations)
  async getGameTitle(): Promise<string> {
    const response = await this.eval('return "Pokemon Game"')
    return (response.result as string) || "Unknown Game"
  }

  async getSharedBuffer(address: number, size: number): Promise<Uint8Array> {
    return this.readMemoryDirect(address, size)
  }
}

// For backwards compatibility
export const createWebSocketClient = (url?: string) => new MgbaWebSocketClient(url)