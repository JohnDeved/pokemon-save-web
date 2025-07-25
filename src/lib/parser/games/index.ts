/**
 * Game configurations index
 * Automatically registers all available game configs
 */

import { GameConfigRegistry } from '../core/gameConfigRegistry'
import { QuetzalConfig } from './quetzal/config'
import { VanillaConfig } from './vanilla/config'

// Register configs in priority order (most specific first)
GameConfigRegistry.register(QuetzalConfig)
GameConfigRegistry.register(VanillaConfig) // Vanilla last as fallback

// Export the registry for use
export { GameConfigRegistry }

// Export individual configs for direct usage if needed
export { QuetzalConfig, VanillaConfig }
