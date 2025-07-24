/**
 * Main entry point for the Pokemon Save Parser
 * Provides clean API surface with dependency injection support
 */

// Core parser functionality
export { PokemonSaveParser } from './core/pokemonSaveParser'
export type * from './core/types'
export * from './core/utils'

// Configuration system
export type { GameConfig } from './core/types'
export { autoDetectGameConfig } from './core/autoDetect'

// Game-specific configurations
export { QuetzalConfig } from './games/quetzal/config'
export { VanillaConfig } from './games/vanilla/config'

// Base Pokemon data class (for extending with new games)
export { BasePokemonData } from './core/pokemonData'

// Legacy constants for backward compatibility
export { CONSTANTS } from './core/types'
