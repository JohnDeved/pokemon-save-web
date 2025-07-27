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
   * Get a specific config by name
   */
  static getConfig(name: string): GameConfig | null {
    const registry = gameConfigRegistry
    
    // Try to find and instantiate config by name
    for (const ConfigClass of registry.configs) {
      try {
        const config = new ConfigClass()
        if (name === 'emerald' && config.name.toLowerCase().includes('emerald')) {
          return config
        }
        if (name === 'vanilla' && config.name.toLowerCase().includes('vanilla')) {
          return config
        }
        if (name === 'quetzal' && config.name.toLowerCase().includes('quetzal')) {
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
