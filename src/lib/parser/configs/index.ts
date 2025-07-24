/**
 * Game configuration module exports
 * All game-specific configurations and auto-detection logic
 */

export type { GameConfig, PokemonMapping, ItemMapping, MoveMapping } from './GameConfig.js'

export { QuetzalConfig } from './QuetzalConfig.js'
export { VanillaConfig } from './VanillaConfig.js'
export { autoDetectGameConfig, getAllGameConfigs, createGameConfigByName } from './autoDetect.js'