/**
 * Auto-detection functionality for selecting appropriate GameConfig
 * Based on save file characteristics
 */

import type { GameConfig } from '../core/types'
import { AVAILABLE_CONFIGS } from '../games/registry'

/**
 * Automatically detect the appropriate GameConfig for a save file
 * @param saveData The save file data to analyze
 * @returns The first matching GameConfig, or null if none match
 */
export function autoDetectGameConfig (saveData: Uint8Array): GameConfig | null {
  for (const createConfig of AVAILABLE_CONFIGS) {
    const config = createConfig()
    if (config.canHandle(saveData)) {
      return config
    }
  }

  return null
}

/**
 * Get all available game configurations
 * Useful for testing or displaying supported games
 */
export function getAllGameConfigs (): readonly GameConfig[] {
  return AVAILABLE_CONFIGS.map(createConfig => createConfig())
}

/**
 * Create a specific game config by name
 * @param name The name of the game config to create
 * @returns The GameConfig instance, or null if not found
 */
export function createGameConfigByName (name: string): GameConfig | null {
  const config = AVAILABLE_CONFIGS
    .map(createConfig => createConfig())
    .find(config => config.name === name)

  return config ?? null
}
