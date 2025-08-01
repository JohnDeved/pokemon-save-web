/**
 * mGBA Integration Module
 *
 * Provides WebSocket-based memory access to mGBA emulator with push-based updates.
 * The core parser (PokemonSaveParser) automatically uses memory mode when
 * passed an MgbaWebSocketClient instance.
 *
 * New Features:
 * - Push-based memory updates: Instead of constant polling, the server watches
 *   memory regions and sends updates only when they change
 * - Memory change listeners: React to real-time memory changes
 * - Intelligent caching: Watched regions use cached data, reducing network calls
 */

export { MgbaWebSocketClient } from './websocket-client'
export type {
  MgbaEvalResponse,
  MemoryRegion,
  SharedBufferConfig,
  MemoryChangeListener,
  WatchMessage,
  MemoryUpdateMessage,
  WatchConfirmMessage,
  WebSocketMessage,
  SimpleMessage,
} from './websocket-client'
