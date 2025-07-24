/**
 * Game configuration module exports
 * All game-specific configurations and auto-detection logic
 */

export type { GameConfig, PokemonMapping, ItemMapping, MoveMapping } from './GameConfig.js'

export { QuetzalConfig } from '../games/quetzal/index.js'
export { VanillaConfig } from '../games/vanilla/index.js'
export { autoDetectGameConfig, getAllGameConfigs, createGameConfigByName } from './autoDetect.js'