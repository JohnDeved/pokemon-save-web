/**
 * Game configurations index
 * Automatically registers all available game configs
 */

import { gameConfigRegistry } from '../core/GameConfigRegistry'
import { QuetzalConfig } from './quetzal/config'
import { VanillaConfig } from './vanilla/config'

// Register configs in priority order (most specific first)
gameConfigRegistry.register(QuetzalConfig)
gameConfigRegistry.register(VanillaConfig) // Vanilla last as fallback

// Export the registry for use
export { gameConfigRegistry as GameConfigRegistry }

// Export individual configs for direct usage if needed
export { QuetzalConfig, VanillaConfig }
