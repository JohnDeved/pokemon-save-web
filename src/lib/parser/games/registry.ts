/**
 * Registry of available game configurations
 * Centralized location for managing supported Pokemon games
 */

import type { GameConfig } from '../core/types'
import { QuetzalConfig } from './quetzal/config'
import { VanillaConfig } from './vanilla/config'

/**
 * Available game configurations
 * Order matters - specific ROM hacks should come before vanilla
 */
export const AVAILABLE_CONFIGS: ReadonlyArray<() => GameConfig> = [
  () => new QuetzalConfig(),
  () => new VanillaConfig(),
] as const
