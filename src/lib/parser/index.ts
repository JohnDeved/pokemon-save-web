/**
 * Pokemon Save Parser Library
 * Clean exports for the browser-ready TypeScript parser
 */

export { PokemonSaveParser as default, PokemonSaveParser } from './pokemonSaveParser.js'

export type {
  MoveData, PlayTimeData, PokemonEVs,
  PokemonIVs, PokemonMoves, PokemonStats, SaveData, SectorInfo,
} from './types.js'

export type { GameConfig, PokemonMapping, ItemMapping, MoveMapping } from './GameConfig.js'

export { QuetzalConfig } from './QuetzalConfig.js'
export { VanillaConfig } from './VanillaConfig.js'
export { autoDetectGameConfig, getAllGameConfigs, createGameConfigByName } from './autoDetect.js'

export {
  CONSTANTS,
  createMoveData, createPokemonEVs,
  createPokemonIVs, createPokemonMoves, createPokemonStats, getMoveIds,
  getPPValues, getTotalEVs,
  getTotalIVs, pokemonEVsToArray,
  pokemonIVsToArray,
  pokemonStatsToArray,
} from './types.js'
