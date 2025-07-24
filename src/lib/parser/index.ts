/**
 * Main entry point for the Pokemon Save Parser
 * Provides clean API surface with dependency injection support
 */

// Core parser functionality
export { PokemonSaveParser } from './core/pokemonSaveParser.js'
export type * from './core/types.js'
export * from './core/utils.js'

// Configuration system
export type { GameConfig } from './configs/GameConfig.js'
export { autoDetectGameConfig } from './configs/autoDetect.js'

// Game-specific configurations
export { QuetzalConfig } from './games/quetzal/index.js'
export { VanillaConfig } from './games/vanilla/index.js'

// Base Pokemon data class (for extending with new games)
export { BasePokemonData } from './core/pokemonData.js'

// Legacy constants for backward compatibility
export { CONSTANTS } from './core/types.js'
