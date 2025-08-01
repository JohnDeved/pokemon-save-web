/**
 * Type definitions for mGBA WebSocket integration
 */

export interface SimpleMessage {
  command: 'watch' | 'eval'
  status: 'success' | 'error' | 'update'
  data: string[]
}

export type MemoryChangeListener = (address: number, size: number, data: Uint8Array) => void | Promise<void>
