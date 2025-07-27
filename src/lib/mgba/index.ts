/**
 * mGBA Integration Module
 * 
 * Provides WebSocket-based memory access to mGBA emulator.
 * The core parser (PokemonSaveParser) automatically uses memory mode when
 * passed an MgbaWebSocketClient instance.
 */

export { MgbaWebSocketClient } from './websocket-client'
export type { MgbaEvalResponse } from './websocket-client'