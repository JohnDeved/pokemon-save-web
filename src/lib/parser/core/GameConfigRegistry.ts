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
  register(configClass: GameConfigConstructor): void {
    this.configs.push(configClass)
  }

  /**
   * Auto-detect the appropriate game configuration for save data or memory
   */
  detectGameConfig(saveData: Uint8Array): GameConfig | null
  detectGameConfig(gameTitle: string): GameConfig | null
  detectGameConfig(input: Uint8Array | string): GameConfig | null {
    // Try each registered config in order
    for (const ConfigClass of this.configs) {
      try {
        const config = new ConfigClass()

        // Check if input is save data (Uint8Array) or game title (string)
        if (typeof input === 'string') {
          // Memory mode: check if config can handle this game title
          if (config.canHandleMemory?.(input)) {
            return config
          }
        } else {
          // File mode: check if config can handle this save data
          if (config.canHandle(input)) {
            return config
          }
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
  getRegisteredConfigs(): readonly GameConfigConstructor[] {
    return [...this.configs]
  }

  /**
   * Clear all registered configs (for testing)
   */
  clear(): void {
    this.configs.length = 0
  }
}

// Export singleton instance
export const gameConfigRegistry = new GameConfigRegistry()
