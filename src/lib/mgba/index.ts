/**
 * mGBA Integration Module
 * 
 * Provides WebSocket-based memory access to mGBA emulator for real-time
 * Pokémon save data reading and writing.
 */

export { MgbaWebSocketClient } from './websocket-client'
export type { MgbaEvalResponse } from './websocket-client'

export { EmeraldMemoryParser } from './memory-parser'

export {
  MEMORY_REGIONS,
  EMERALD_SAVE_LAYOUT,
  POKEMON_STRUCT,
  POKEMON_SUBSTRUCT,
  NATURES,
  getSubstructOrder,
  getNature,
  getGender,
  mapSaveOffsetToMemory,
  getPartyPokemonAddress,
  getPokemonFieldAddress
} from './memory-mapping'

export { main as testCliMain } from './test-cli'