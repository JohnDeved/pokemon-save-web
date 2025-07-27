/**
 * Game configuration registry for automatic game detection
 */

import type { GameConfig } from './types'

/**
 * Type for game config constructors that can be registered
 */
export type GameConfigConstructor = new () => GameConfig

/**
 * Registry for game configurations with automatic detection
 */
export class GameConfigRegistry {
  private readonly configs: GameConfigConstructor[] = []

  /**
   * Register a game configuration class
   */
  register (configClass: GameConfigConstructor): void {
    this.configs.push(configClass)
  }

  /**
   * Auto-detect the appropriate game configuration for save data
   * @param saveData The save file data to analyze
   * @returns The best matching game config, or null if none match
   */
  detectGameConfig (saveData: Uint8Array): GameConfig | null {
    // Try each registered config in order
    for (const ConfigClass of this.configs) {
      try {
        const config = new ConfigClass()
        if (config.canHandle(saveData)) {
          return config
        }
      } catch {
        // If config creation or detection fails, continue to next
        continue
      }
    }

    return null
  }

  /**
   * Get all registered config classes (for testing/debugging)
   */
  getRegisteredConfigs (): readonly GameConfigConstructor[] {
    return [...this.configs]
  }

  /**
   * Get a config that can handle memory parsing for the given game title
   */
  getConfigForMemory (gameTitle: string): GameConfig | null {
    // Try to find a config that can handle this game title in memory mode
    for (const ConfigClass of this.configs) {
      try {
        const config = new ConfigClass()
        if (config.canHandleMemory?.(gameTitle)) {
          return config
        }
      } catch {
        continue
      }
    }

    return null
  }

  /**
   * Clear all registered configs (for testing)
   */
  clear (): void {
    this.configs.length = 0
  }
}

// Export singleton instance
export const gameConfigRegistry = new GameConfigRegistry()
