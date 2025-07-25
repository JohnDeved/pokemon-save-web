/**
 * Game configurations index
 * Automatically registers all available game configs and provides utilities
 */

import { GameConfigRegistry } from '../core/gameConfigRegistry'
import { QuetzalConfig } from './quetzal/config'
import { VanillaConfig } from './vanilla/config'
import type { GameConfig } from '../core/types'

// Register configs in priority order (most specific first)
GameConfigRegistry.register(QuetzalConfig)
GameConfigRegistry.register(VanillaConfig) // Vanilla last as fallback

// Export the registry for use
export { GameConfigRegistry }

// Export individual configs for direct usage if needed
export { QuetzalConfig, VanillaConfig }

/**
 * Get all available game configurations
 * Useful for testing or displaying supported games
 */
export function getAllGameConfigs (): readonly GameConfig[] {
  return GameConfigRegistry.getRegisteredConfigs().map(ConfigClass => new ConfigClass())
}

/**
 * Create a specific game config by name
 * @param name The name of the game config to create
 * @returns The GameConfig instance, or null if not found
 */
export function createGameConfigByName (name: string): GameConfig | null {
  const config = getAllGameConfigs().find(config => config.name === name)
  return config ?? null
}
