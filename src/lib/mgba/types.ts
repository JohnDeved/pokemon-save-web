import { z } from 'zod'

/**
 * Type definitions for mGBA WebSocket integration
 */

export interface SimpleMessage {
  command: 'watch' | 'eval'
  status: 'success' | 'error' | 'update'
  data: string[]
}

export type MemoryChangeListener = (address: number, size: number, data: Uint8Array) => void | Promise<void>

// --- WebSocket message schemas ---
export const WebSocketMemoryUpdateSchema = z.object({
  address: z.number(),
  size: z.number(),
  data: z.array(z.number()),
})
export type WebSocketMemoryUpdate = z.infer<typeof WebSocketMemoryUpdateSchema>

export const WebSocketResponseSchema = z.object({
  command: z.string().optional(),
  status: z.enum(['success', 'error', 'update']).optional(),
  result: z.unknown().optional(),
  error: z.string().optional(),
  updates: z.array(WebSocketMemoryUpdateSchema).optional(),
})
export type WebSocketResponse = z.infer<typeof WebSocketResponseSchema>

export const WebSocketEvalResultSchema = z.object({
  result: z.string().optional(),
  error: z.string().optional(),
})
export type WebSocketEvalResult = z.infer<typeof WebSocketEvalResultSchema>
